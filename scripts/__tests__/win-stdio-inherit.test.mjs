// T0866 / BUG-213 — scripts/win-stdio-inherit.cjs (afterPack copy of the Windows stdio-inheritance addon) and
// scripts/build-native-win.mjs on hosts that build nothing. The addon itself is covered by
// electron/__tests__/win-stdio-inherit.test.ts; the packaged checks by verify-packaged-native.test.mjs.

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterEach, describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const here = path.dirname(fileURLToPath(import.meta.url))
const {
  ADDON_FILE,
  afterPackWinStdioInherit,
  builderArchName,
  builtAddonPath,
  packagedAddonPath,
} = require('../win-stdio-inherit.cjs')

const dirs = []
function tmp() {
  const d = mkdtempSync(path.join(os.tmpdir(), 't0866-'))
  dirs.push(d)
  return d
}
afterEach(() => {
  while (dirs.length) rmSync(dirs.pop(), { recursive: true, force: true })
})

function context(platform, arch, projectDir) {
  const appOutDir = tmp()
  mkdirSync(path.join(appOutDir, 'resources'), { recursive: true })
  return {
    appOutDir,
    electronPlatformName: platform,
    arch,
    packager: { info: { projectDir }, getResourcesDir: (o) => path.join(o, 'resources') },
  }
}

describe('afterPackWinStdioInherit', () => {
  it('macOS / Linux: returns null and copies nothing', () => {
    for (const platform of ['darwin', 'linux']) {
      const ctx = context(platform, 1, tmp())
      expect(afterPackWinStdioInherit(ctx)).toBeNull()
      expect(existsSync(path.join(ctx.appOutDir, 'resources', 'native'))).toBe(false)
    }
  })

  it('win32 x64: copies the node-gyp build to resources/native/', () => {
    const project = tmp()
    const built = builtAddonPath(project)
    mkdirSync(path.dirname(built), { recursive: true })
    writeFileSync(built, 'PE-BYTES')
    const ctx = context('win32', 1, project) // electron-builder Arch.x64 = 1
    const lines = []
    const target = afterPackWinStdioInherit(ctx, { log: (l) => lines.push(l) })
    expect(target).toBe(packagedAddonPath(path.join(ctx.appOutDir, 'resources')))
    expect(path.basename(target)).toBe(ADDON_FILE)
    expect(readFileSync(target, 'utf8')).toBe('PE-BYTES')
    expect(lines[0]).toContain(path.join('resources', 'native', ADDON_FILE))
  })

  it('win32: a missing build or another arch fails the package', () => {
    expect(() => afterPackWinStdioInherit(context('win32', 1, tmp()), { log: () => {} })).toThrow(/npm run build:native-win/)
    expect(() => afterPackWinStdioInherit(context('win32', 3, tmp()), { log: () => {} })).toThrow(/built for x64 only, not arm64/)
  })

  it('builderArchName maps the electron-builder Arch enum', () => {
    expect([0, 1, 2, 3, 4, 'x64'].map(builderArchName)).toEqual(['ia32', 'x64', 'armv7l', 'arm64', 'universal', 'x64'])
  })
})

describe.runIf(process.platform !== 'win32')('build-native-win.mjs on macOS / Linux', () => {
  it('has nothing to build and exits 0', () => {
    const out = execFileSync(process.execPath, [path.join(here, '..', 'build-native-win.mjs')], { encoding: 'utf8', timeout: 30000 })
    expect(out).toContain('nothing to build')
  })
})

describe('package.json wiring (D291: an npm script, no install script)', () => {
  const pkg = require('../../package.json')
  it('build:native-win runs the script; build / build:dir run it before verify-native-modules; no postinstall build', () => {
    expect(pkg.scripts['build:native-win']).toBe('node scripts/build-native-win.mjs')
    for (const name of ['build', 'build:dir']) {
      const s = pkg.scripts[name]
      expect(s.indexOf('npm run build:native-win')).toBeGreaterThan(-1)
      expect(s.indexOf('npm run build:native-win')).toBeLessThan(s.indexOf('verify-native-modules.js'))
    }
    expect(pkg.scripts.postinstall).not.toMatch(/node-gyp|build-native|win-stdio/)
    expect(pkg.allowScripts).toEqual({ esbuild: true, sharp: true, '@anthropic-ai/claude-code': true })
    expect(pkg.devDependencies['node-gyp']).toMatch(/^\d+\.\d+\.\d+$/)
    expect(pkg.dependencies?.['node-gyp']).toBeUndefined()
    expect(pkg.build.afterPack).toBe('./scripts/version-manifest.cjs')
    expect(Object.keys(pkg.build).filter((k) => ['win', 'mac', 'linux'].includes(k)).filter((k) => pkg.build[k].files)).toEqual([])
  })

  it('the three Windows packaging workflows build it before verify-native-modules / build-version', () => {
    for (const wf of ['pre-release.yml', 'release.yml', 'desktop-build.yml']) {
      const y = readFileSync(path.join(here, '..', '..', '.github', 'workflows', wf), 'utf8')
      const step = y.indexOf('run: npm run build:native-win')
      expect(step, wf).toBeGreaterThan(-1)
      expect(y.slice(y.lastIndexOf('- name:', step), step)).toContain("if: matrix.platform == 'win'")
      expect(step, wf).toBeLessThan(y.indexOf('run: node scripts/build-version.js'))
      const verify = y.indexOf('run: node scripts/verify-native-modules.js')
      if (verify > -1) expect(step, wf).toBeLessThan(verify)
    }
  })
})
