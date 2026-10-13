// T0470 / BUG-116 — post-package check of the whisper binary in each mac .app.
//
// Fake electron-builder output trees (release/mac/*.app for x64, release/mac-arm64/*.app
// for arm64) are built in a temp dir; the script must pass only when every arch has a
// .app holding whisper.node under app.asar.unpacked (mac-<arch>/ or darwin-<arch>/).

import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterEach, describe, expect, it } from 'vitest'

import { whisperAddonDirCandidates } from '../../electron/whisper-addon-loader'

const require = createRequire(import.meta.url)
const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'verify-packaged-native.js')
const {
  DEFAULT_MAC_ARCHS,
  macAppOutDirName,
  macWhisperAddonDirCandidates,
  parseArgs,
  verifyPackagedMac,
} = require(SCRIPT)
const nativeModules = require('../verify-native-modules.js')

const APP = 'BetterAgentTerminal.app'
const dirs = []

function makeOutDir() {
  const dir = mkdtempSync(path.join(os.tmpdir(), 't0470-release-'))
  dirs.push(dir)
  return dir
}

function makeApp(outDir, arch) {
  const appPath = path.join(outDir, macAppOutDirName(arch), APP)
  mkdirSync(path.join(appPath, 'Contents', 'Resources'), { recursive: true })
  return appPath
}

function addBinary(appPath, distDir) {
  const dir = path.join(
    appPath, 'Contents', 'Resources', 'app.asar.unpacked',
    'node_modules', '@kutalia', 'whisper-node-addon', 'dist', distDir,
  )
  mkdirSync(dir, { recursive: true })
  writeFileSync(path.join(dir, 'whisper.node'), '')
}

function runCli(outDir) {
  try {
    const stdout = execFileSync(process.execPath, [SCRIPT, '--out', outDir], { encoding: 'utf8', stdio: 'pipe', timeout: 30000 })
    return { code: 0, stdout, stderr: '' }
  } catch (err) {
    return { code: err.status, stdout: String(err.stdout), stderr: String(err.stderr) }
  }
}

afterEach(() => {
  while (dirs.length) rmSync(dirs.pop(), { recursive: true, force: true })
})

describe('mac whisper dir rule', () => {
  it('matches electron/whisper-addon-loader.ts and scripts/verify-native-modules.js', () => {
    for (const arch of ['x64', 'arm64']) {
      expect(macWhisperAddonDirCandidates(arch)).toEqual(whisperAddonDirCandidates('darwin', arch))
      expect(macWhisperAddonDirCandidates(arch)).toEqual(nativeModules.whisperAddonDirCandidates('darwin', arch))
    }
  })

  it('maps archs to electron-builder mac output dirs (x64 is the default arch)', () => {
    expect(macAppOutDirName('x64')).toBe('mac')
    expect(macAppOutDirName('arm64')).toBe('mac-arm64')
    expect(DEFAULT_MAC_ARCHS).toEqual(['x64', 'arm64'])
  })
})

describe('verifyPackagedMac', () => {
  it('both archs carry mac-<arch>/whisper.node → ok (exit 0)', () => {
    const out = makeOutDir()
    addBinary(makeApp(out, 'x64'), 'mac-x64')
    addBinary(makeApp(out, 'arm64'), 'mac-arm64')

    const result = verifyPackagedMac(out)
    expect(result.ok).toBe(true)
    expect(result.archs.map((r) => r.apps[0].found)).toEqual([
      path.join(out, 'mac', APP, 'Contents', 'Resources', 'app.asar.unpacked', 'node_modules', '@kutalia', 'whisper-node-addon', 'dist', 'mac-x64', 'whisper.node'),
      path.join(out, 'mac-arm64', APP, 'Contents', 'Resources', 'app.asar.unpacked', 'node_modules', '@kutalia', 'whisper-node-addon', 'dist', 'mac-arm64', 'whisper.node'),
    ])
    expect(runCli(out).code).toBe(0)
  })

  it('one arch lacks its binary → fail (exit 1) and lists every path tried', () => {
    const out = makeOutDir()
    addBinary(makeApp(out, 'x64'), 'mac-arm64') // wrong arch only — must not count
    addBinary(makeApp(out, 'arm64'), 'mac-arm64')

    const result = verifyPackagedMac(out)
    expect(result.ok).toBe(false)
    const x64 = result.archs.find((r) => r.arch === 'x64')
    expect(x64.ok).toBe(false)
    expect(x64.apps[0].tried.map((p) => path.basename(path.dirname(p)))).toEqual(['mac-x64', 'darwin-x64'])
    expect(result.archs.find((r) => r.arch === 'arm64').ok).toBe(true)

    const cli = runCli(out)
    expect(cli.code).toBe(1)
    expect(cli.stderr).toContain('x64')
    expect(cli.stderr).toContain(path.join('dist', 'mac-x64', 'whisper.node'))
    expect(cli.stderr).toContain(path.join('dist', 'darwin-x64', 'whisper.node'))
  })

  it('only darwin-<arch>/ (fallback dir) → ok (exit 0)', () => {
    const out = makeOutDir()
    addBinary(makeApp(out, 'x64'), 'darwin-x64')
    addBinary(makeApp(out, 'arm64'), 'darwin-arm64')

    const result = verifyPackagedMac(out)
    expect(result.ok).toBe(true)
    expect(result.archs.every((r) => path.basename(path.dirname(r.apps[0].found)).startsWith('darwin-'))).toBe(true)
    expect(runCli(out).code).toBe(0)
  })

  it('no .app for an arch → fail (exit 1), not a silent skip', () => {
    const out = makeOutDir()
    addBinary(makeApp(out, 'arm64'), 'mac-arm64')

    const result = verifyPackagedMac(out)
    expect(result.ok).toBe(false)
    const x64 = result.archs.find((r) => r.arch === 'x64')
    expect(x64.apps).toEqual([])
    expect(x64.appOutDir).toBe(path.join(out, 'mac'))

    const cli = runCli(out)
    expect(cli.code).toBe(1)
    expect(cli.stderr).toContain(`no .app found in ${path.join(out, 'mac')}`)
  })

  it('missing output dir entirely → fail for every arch', () => {
    const out = path.join(makeOutDir(), 'does-not-exist')
    const result = verifyPackagedMac(out)
    expect(result.ok).toBe(false)
    expect(result.archs.every((r) => r.apps.length === 0)).toBe(true)
  })
})

describe('parseArgs', () => {
  it('defaults to <repo>/release and x64,arm64', () => {
    const opts = parseArgs([])
    expect(opts.outDir).toBe(path.join(path.dirname(SCRIPT), '..', 'release'))
    expect(opts.archs).toEqual(['x64', 'arm64'])
  })

  it('accepts --out and --arch', () => {
    const opts = parseArgs(['--out', 'some/dir', '--arch', 'arm64'])
    expect(opts.outDir).toBe(path.resolve('some/dir'))
    expect(opts.archs).toEqual(['arm64'])
  })

  it('rejects unknown or incomplete arguments', () => {
    expect(() => parseArgs(['--bogus'])).toThrow(/unknown or incomplete/)
    expect(() => parseArgs(['--out'])).toThrow(/unknown or incomplete/)
    expect(() => parseArgs(['--arch', ','])).toThrow(/at least one arch/)
  })
})
