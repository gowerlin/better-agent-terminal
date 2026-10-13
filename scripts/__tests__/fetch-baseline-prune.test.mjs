// T0492 — fetch-baseline-tarball.mjs removes baseline tarballs / sidecars of other
// versions from dist-baseline/ after the current version is in place: electron-builder
// packs every `bat-server-<arch>-v*.tar.gz` there into the local installer.

import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterEach, describe, expect, it } from 'vitest'

import { staleBaselineFiles } from '../fetch-baseline-tarball.mjs'

const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'fetch-baseline-tarball.mjs')

const dirs = []
afterEach(() => {
  while (dirs.length) rmSync(dirs.pop(), { recursive: true, force: true })
})

describe('staleBaselineFiles', () => {
  it('selects only baseline files of other versions', () => {
    const names = [
      'bat-server-linux-x64-v0.5.9-pre.4.tar.gz',
      'bat-server-linux-x64-v0.5.9-pre.4.tar.gz.sha256',
      'bat-server-linux-x64-v0.6.0-pre.1.tar.gz',
      'bat-server-linux-x64-v0.6.0-pre.1.tar.gz.sha256',
      'bat-server-linux-x64-v0.6.0-pre.5.tar.gz',
      'bat-server-linux-x64-v0.6.0-pre.5.tar.gz.sha256',
      'bat-server-linux-arm64-v0.6.0-pre.5.tar.gz',
      'bat-server-darwin-arm64-v0.6.0-pre.4.tar.gz',
      'manifest.json',
      'notes.txt',
      'bat-server-win32-x64-v0.5.0.tar.gz',
      'bat-server-linux-x64-v0.5.0.zip',
    ]
    expect(staleBaselineFiles(names, '0.6.0-pre.5')).toEqual([
      'bat-server-linux-x64-v0.5.9-pre.4.tar.gz',
      'bat-server-linux-x64-v0.5.9-pre.4.tar.gz.sha256',
      'bat-server-linux-x64-v0.6.0-pre.1.tar.gz',
      'bat-server-linux-x64-v0.6.0-pre.1.tar.gz.sha256',
      'bat-server-darwin-arm64-v0.6.0-pre.4.tar.gz',
    ])
  })

  it('keeps every arch of the current version (the Linux package carries linux-arm64 too)', () => {
    const names = ['linux-x64', 'linux-arm64', 'darwin-arm64'].map((a) => `bat-server-${a}-v0.6.0.tar.gz`)
    expect(staleBaselineFiles(names, '0.6.0')).toEqual([])
  })

  it('does not treat a prerelease of the same base as current', () => {
    expect(staleBaselineFiles(['bat-server-linux-x64-v0.6.0-pre.5.tar.gz'], '0.6.0')).toEqual([
      'bat-server-linux-x64-v0.6.0-pre.5.tar.gz',
    ])
  })
})

describe('CLI prunes after a cache hit', () => {
  function makeDir() {
    const dir = mkdtempSync(path.join(os.tmpdir(), 't0492-baseline-'))
    dirs.push(dir)
    return dir
  }

  // Cache hit for the current tarball + a manifest for the current version: no network.
  function seedCurrent(dir, version) {
    const name = `bat-server-linux-x64-v${version}.tar.gz`
    const body = Buffer.from(`fake ${name}`)
    writeFileSync(path.join(dir, name), body)
    writeFileSync(path.join(dir, `${name}.sha256`), `${createHash('sha256').update(body).digest('hex')}  ${name}\n`)
    writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({ version }) + '\n')
  }

  function run(dir, extra = []) {
    const env = { ...process.env }
    delete env.BAT_BASELINE_VERSION
    return spawnSync(process.execPath, [
      SCRIPT, '--host-os', 'win', '--host-arch', 'x64', '--version', '9.9.9',
      '--output-dir', dir, '--source-url', 'http://127.0.0.1:9/never-fetched', ...extra,
    ], { encoding: 'utf8', timeout: 30000, env })
  }

  it('removes other versions and leaves the current version and unrelated files', () => {
    const dir = makeDir()
    seedCurrent(dir, '9.9.9')
    for (const name of [
      'bat-server-linux-x64-v9.9.8.tar.gz',
      'bat-server-linux-x64-v9.9.8.tar.gz.sha256',
      'bat-server-linux-arm64-v9.9.9.tar.gz',
      'keep-me.txt',
    ]) writeFileSync(path.join(dir, name), 'x')

    const result = run(dir)
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('removed stale baseline bat-server-linux-x64-v9.9.8.tar.gz (not v9.9.9)')
    expect(readdirSync(dir).sort()).toEqual([
      'bat-server-linux-arm64-v9.9.9.tar.gz',
      'bat-server-linux-x64-v9.9.9.tar.gz',
      'bat-server-linux-x64-v9.9.9.tar.gz.sha256',
      'keep-me.txt',
      'manifest.json',
    ])
  })

  it('--dry-run only reports', () => {
    const dir = makeDir()
    seedCurrent(dir, '9.9.9')
    writeFileSync(path.join(dir, 'bat-server-linux-x64-v9.9.8.tar.gz'), 'x')

    const result = run(dir, ['--dry-run'])
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('[dry-run] would remove stale baseline bat-server-linux-x64-v9.9.8.tar.gz')
    expect(existsSync(path.join(dir, 'bat-server-linux-x64-v9.9.8.tar.gz'))).toBe(true)
  })
})
