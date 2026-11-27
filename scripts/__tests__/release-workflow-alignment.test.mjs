// T0945 — release.yml (push `v*` tag) must build exactly like pre-release.yml (workflow_dispatch).
// The only intended differences: trigger, how the version is resolved, the release step itself
// (name, prerelease flag), the Homebrew / Chocolatey opt-ins, and the macOS signing steps, which run
// only when the APPLE_CERTIFICATE_P12 secret exists. Without that secret the macOS steps must be
// pre-release.yml's (before T0945 the keychain import ran unconditionally and failed on an empty
// certificate, so a tag push produced no release).

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import yaml from 'js-yaml'
import { describe, expect, it } from 'vitest'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const load = (name) => yaml.load(readFileSync(join(ROOT, '.github', 'workflows', name), 'utf8'))

const release = load('release.yml')
const pre = load('pre-release.yml')

const SIGNED = "matrix.platform == 'mac' && env.HAS_APPLE_CERT == 'true'"
const UNSIGNED = "matrix.platform == 'mac' && env.HAS_APPLE_CERT != 'true'"

const stepNamed = (job, name) => {
  const found = job.steps.filter((s) => s.name === name)
  expect(found, `step "${name}"`).toHaveLength(1)
  return found[0]
}

// A step as pre-release.yml would have it: drop the signing-only steps and map the unsigned
// macOS package step's condition back to pre-release.yml's plain mac condition.
const releaseBuildAsPre = () =>
  release.jobs.build.steps
    .filter((s) => s.if !== SIGNED)
    .map((s) => (s.if === UNSIGNED ? { ...s, if: "matrix.platform == 'mac'" } : s))

describe('release.yml vs pre-release.yml (T0945)', () => {
  it('both workflows parse and keep their intended triggers', () => {
    expect(release.on).toEqual({ push: { tags: ['v*'] } })
    expect(Object.keys(pre.on)).toEqual(['workflow_dispatch'])
  })

  it('typecheck / tests / server-bundle / server-bundle-manifest jobs are identical', () => {
    for (const job of ['typecheck', 'tests', 'server-bundle', 'server-bundle-manifest']) {
      expect(release.jobs[job], job).toEqual(pre.jobs[job])
    }
  })

  it('build job: same needs, matrix and runner', () => {
    expect(release.jobs.build.needs).toEqual(pre.jobs.build.needs)
    expect(release.jobs.build.strategy).toEqual(pre.jobs.build.strategy)
    expect(release.jobs.build['runs-on']).toEqual(pre.jobs.build['runs-on'])
  })

  it('build job: without the signing secret the steps are pre-release.yml steps', () => {
    const got = releaseBuildAsPre()
    expect(got.map((s) => s.name)).toEqual(pre.jobs.build.steps.map((s) => s.name))
    got.forEach((step, i) => {
      const want = pre.jobs.build.steps[i]
      // The version string comes from the pushed tag in release.yml (needs.prepare.outputs.tag,
      // e.g. v0.8.0) and from `v` + the input in pre-release.yml: the same value, different source.
      if (step.name === 'Update version and build') {
        expect(step.env).toEqual({ VERSION: '${{ needs.prepare.outputs.tag }}' })
        expect(want.env).toEqual({ VERSION: 'v${{ needs.prepare.outputs.version }}' })
        expect({ ...step, env: undefined }).toEqual({ ...want, env: undefined })
        return
      }
      expect(step, step.name).toEqual(want)
    })
  })

  it('build job: Windows cleanup and verify-native-modules sit where pre-release.yml has them', () => {
    const names = release.jobs.build.steps.map((s) => s.name)
    const at = (n) => names.indexOf(n)
    expect(at('Windows cleanup (avoid EPERM locks)')).toBe(at('Install dependencies') - 1)
    expect(at('Verify required native modules present')).toBe(at('Build Windows stdio-inheritance addon (BUG-213)') + 1)
    expect(at('Verify required native modules present')).toBe(at('Update version and build') - 1)
    expect(stepNamed(release.jobs.build, 'Verify required native modules present').run).toBe(
      'node scripts/verify-native-modules.js',
    )
  })

  it('build job: macOS signing runs only when the APPLE_CERTIFICATE_P12 secret exists', () => {
    expect(release.jobs.build.env).toEqual({ HAS_APPLE_CERT: "${{ secrets.APPLE_CERTIFICATE_P12 != '' }}" })

    const signedOnly = release.jobs.build.steps.filter((s) => s.if === SIGNED).map((s) => s.name)
    expect(signedOnly).toEqual([
      'Import Code Signing Certificate',
      'Verify Apple notarization credentials',
      'Package for macOS (signed, notarized)',
    ])

    // Every step that reads an Apple secret is one of the signed-only steps.
    for (const step of release.jobs.build.steps) {
      if (JSON.stringify(step).includes('secrets.APPLE_')) expect(signedOnly, step.name).toContain(step.name)
    }

    const signed = stepNamed(release.jobs.build, 'Package for macOS (signed, notarized)')
    const unsigned = stepNamed(release.jobs.build, 'Package for macOS')
    expect(signed.run).toBe(unsigned.run)
    expect(Object.keys(signed.env).sort()).toEqual(['APPLE_APP_SPECIFIC_PASSWORD', 'APPLE_ID', 'APPLE_TEAM_ID'])
    expect(unsigned.env).toBeUndefined()
    expect(unsigned.if).toBe(UNSIGNED)
  })

  it('release job: same needs and artifacts; server bundle release identical', () => {
    const r = release.jobs.release
    const p = pre.jobs.release
    expect(r.needs).toEqual(p.needs)
    expect(r.permissions).toEqual(p.permissions)
    expect(stepNamed(r, 'Download all artifacts')).toEqual(stepNamed(p, 'Download all artifacts'))
    expect(stepNamed(r, 'Display downloaded files')).toEqual(stepNamed(p, 'Display downloaded files'))
    expect(stepNamed(r, 'Create server bundle release')).toEqual(stepNamed(p, 'Create server bundle release'))

    const create = stepNamed(r, 'Create Release')
    const createPre = stepNamed(p, 'Create Pre-Release')
    expect(create.with.files).toBe(createPre.with.files)
    expect(create.with.generate_release_notes).toBe(true)
    expect(create.with.prerelease).toBe("${{ contains(github.ref, '-pre') }}")
  })

  it('release job: Homebrew / Chocolatey stay opt-in and skip -pre tags', () => {
    expect(stepNamed(release.jobs.release, 'Update Homebrew tap').if).toBe(
      "${{ !contains(github.ref, '-pre') && vars.HOMEBREW_TAP_REPO != '' }}",
    )
    expect(release.jobs.choco.if).toBe("${{ !contains(github.ref, '-pre') && vars.CHOCOLATEY_PUBLISH == 'true' }}")
  })
})
