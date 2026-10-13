// T0470 / BUG-116 — post-package check of the whisper binary in each mac .app.
// T0475 / BUG-117 / BUG-118 — plus the main-executable baseline cputype, every Mach-O
// under app.asar.unpacked, the embedded claude (mac + Linux).
//
// Fake electron-builder output trees (release/mac-arm64/*.app, release/linux-unpacked)
// are built in a temp dir with hand-written Mach-O / ELF headers.

import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterEach, describe, expect, it } from 'vitest'

import { whisperAddonDirCandidates } from '../../electron/whisper-addon-loader'

const require = createRequire(import.meta.url)
const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'verify-packaged-native.js')
const {
  DEFAULT_LINUX_ARCHS,
  DEFAULT_MAC_ARCHS,
  ELF_MACHINES,
  MACH_CPU_TYPES,
  elfMachine,
  isCrossArchAllowed,
  linuxAppOutDirName,
  machOCpuTypes,
  macAppOutDirName,
  macWhisperAddonDirCandidates,
  packagedEmbeddedClaudeCandidates,
  parseArgs,
  verifyPackagedLinux,
  verifyPackagedMac,
} = require(SCRIPT)
const nativeModules = require('../verify-native-modules.js')

const APP = 'BetterAgentTerminal.app'
const dirs = []

function makeOutDir() {
  const dir = mkdtempSync(path.join(os.tmpdir(), 't0475-release-'))
  dirs.push(dir)
  return dir
}

function thinMachO(arch) {
  const buf = Buffer.alloc(64)
  buf.writeUInt32LE(0xfeedfacf, 0)
  buf.writeUInt32LE(MACH_CPU_TYPES[arch], 4)
  return buf
}

function fatMachO(archs) {
  const buf = Buffer.alloc(8 + archs.length * 20 + 16)
  buf.writeUInt32BE(0xcafebabe, 0)
  buf.writeUInt32BE(archs.length, 4)
  archs.forEach((arch, i) => buf.writeUInt32BE(MACH_CPU_TYPES[arch], 8 + i * 20))
  return buf
}

function elf(machine) {
  const buf = Buffer.alloc(64)
  buf.writeUInt32BE(0x7f454c46, 0)
  buf[4] = 2 // ELFCLASS64
  buf[5] = 1 // little-endian
  buf.writeUInt16LE(machine, 18)
  return buf
}

function writeFile(filePath, content) {
  mkdirSync(path.dirname(filePath), { recursive: true })
  writeFileSync(filePath, content)
}

function unpacked(appPath, ...segments) {
  return path.join(appPath, 'Contents', 'Resources', 'app.asar.unpacked', ...segments)
}

function whisperPath(appPath, distDir, file = 'whisper.node') {
  return unpacked(appPath, 'node_modules', '@kutalia', 'whisper-node-addon', 'dist', distDir, file)
}

function claudePath(appPath, arch) {
  return unpacked(appPath, 'node_modules', '@anthropic-ai', `claude-code-darwin-${arch}`, 'claude')
}

/**
 * A healthy fake .app for `arch`: Mach-O main executable, whisper.node, embedded claude,
 * node-pty — all `arch` — plus the whisper linux / win32 builds (ELF / PE, never checked).
 * `omit` drops parts so a test can break exactly one thing.
 */
function makeApp(outDir, arch, { omit = [] } = {}) {
  const appPath = path.join(outDir, macAppOutDirName(arch), APP)
  if (!omit.includes('main')) writeFile(path.join(appPath, 'Contents', 'MacOS', 'BetterAgentTerminal'), thinMachO(arch))
  if (!omit.includes('whisper')) writeFile(whisperPath(appPath, `mac-${arch}`), thinMachO(arch))
  if (!omit.includes('claude')) writeFile(claudePath(appPath, arch), thinMachO(arch))
  writeFile(unpacked(appPath, 'node_modules', '@lydell', `node-pty-darwin-${arch}`, 'pty.node'), thinMachO(arch))
  writeFile(whisperPath(appPath, 'linux-x64', 'libwhisper.so'), elf(ELF_MACHINES.x64))
  writeFile(whisperPath(appPath, 'win32-x64'), Buffer.from('MZ\x90\x00'))
  writeFile(unpacked(appPath, 'node_modules', '@anthropic-ai', 'claude-code', 'package.json'), '{}')
  return appPath
}

function runCli(args) {
  try {
    const stdout = execFileSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8', stdio: 'pipe', timeout: 30000 })
    return { code: 0, stdout, stderr: '' }
  } catch (err) {
    return { code: err.status, stdout: String(err.stdout), stderr: String(err.stderr) }
  }
}

function problemIds(result, arch) {
  return result.archs.find((r) => r.arch === arch).apps.flatMap((a) => a.problems.map((p) => p.id))
}

afterEach(() => {
  while (dirs.length) rmSync(dirs.pop(), { recursive: true, force: true })
})

describe('shared rules', () => {
  it('mac whisper dirs match electron/whisper-addon-loader.ts and scripts/verify-native-modules.js', () => {
    for (const arch of ['x64', 'arm64']) {
      expect(macWhisperAddonDirCandidates(arch)).toEqual(whisperAddonDirCandidates('darwin', arch))
      expect(macWhisperAddonDirCandidates(arch)).toEqual(nativeModules.whisperAddonDirCandidates('darwin', arch))
    }
  })

  it('maps archs to electron-builder output dirs (x64 is the default arch)', () => {
    expect(macAppOutDirName('x64')).toBe('mac')
    expect(macAppOutDirName('arm64')).toBe('mac-arm64')
    expect(linuxAppOutDirName('x64')).toBe('linux-unpacked')
    expect(linuxAppOutDirName('arm64')).toBe('linux-arm64-unpacked')
  })

  it('defaults follow build.mac.target (arm64 only, D136) and the CI linux job (x64)', () => {
    expect(DEFAULT_MAC_ARCHS).toEqual(['arm64'])
    expect(DEFAULT_LINUX_ARCHS).toEqual(['x64'])
    const pkg = require('../../package.json')
    expect(pkg.build.mac.target.flatMap((t) => t.arch)).toEqual(DEFAULT_MAC_ARCHS)
  })

  it('embedded claude candidates: platform package first, bin/claude.exe fallback; Windows bin/claude.exe only', () => {
    const res = path.join('/r', 'Resources')
    const anthropic = path.join(res, 'app.asar.unpacked', 'node_modules', '@anthropic-ai')
    const wrapper = path.join(anthropic, 'claude-code', 'bin', 'claude.exe')
    expect(packagedEmbeddedClaudeCandidates(res, 'darwin', 'arm64')).toEqual([path.join(anthropic, 'claude-code-darwin-arm64', 'claude'), wrapper])
    expect(packagedEmbeddedClaudeCandidates(res, 'linux', 'x64', true)).toEqual([path.join(anthropic, 'claude-code-linux-x64-musl', 'claude'), wrapper])
    expect(packagedEmbeddedClaudeCandidates(res, 'win32', 'x64')).toEqual([wrapper])
  })

  it('reads thin / fat Mach-O and ELF headers (T0474 constants)', () => {
    expect(MACH_CPU_TYPES).toEqual({ x64: 0x01000007, arm64: 0x0100000c })
    expect(machOCpuTypes(thinMachO('arm64'))).toEqual([0x0100000c])
    expect(machOCpuTypes(fatMachO(['x64', 'arm64']))).toEqual([0x01000007, 0x0100000c])
    expect(machOCpuTypes(elf(0x3e))).toBeNull()
    expect(elfMachine(elf(0x3e))).toBe(0x3e)
    expect(elfMachine(thinMachO('x64'))).toBeNull()
  })

  it('a Java class file (0xCAFEBABE + version) is not a fat Mach-O', () => {
    const javaClass = Buffer.alloc(64)
    javaClass.writeUInt32BE(0xcafebabe, 0)
    javaClass.writeUInt16BE(0, 4) // minor
    javaClass.writeUInt16BE(52, 6) // major (Java 8)
    expect(machOCpuTypes(javaClass)).toBeNull()
  })

  it('only the whisper addon other-arch mac dirs are allowed to differ', () => {
    const w = 'node_modules/@kutalia/whisper-node-addon/dist'
    expect(isCrossArchAllowed(`${w}/mac-x64/whisper.node`, 'arm64')).toBe(true)
    expect(isCrossArchAllowed(`${w}/darwin-x64/whisper.node`, 'arm64')).toBe(true)
    expect(isCrossArchAllowed(`${w}/mac-arm64/whisper.node`, 'arm64')).toBe(false)
    expect(isCrossArchAllowed('node_modules/@anthropic-ai/claude-code-darwin-x64/claude', 'arm64')).toBe(false)
  })
})

describe('verifyPackagedMac', () => {
  it('arm64 .app with everything arm64 → ok (exit 0)', () => {
    const out = makeOutDir()
    const app = makeApp(out, 'arm64')

    const result = verifyPackagedMac(out)
    expect(result.ok).toBe(true)
    const checked = result.archs[0].apps[0]
    expect(checked.found).toBe(whisperPath(app, 'mac-arm64'))
    expect(checked.embeddedClaude.found).toBe(claudePath(app, 'arm64'))
    expect(checked.machOCount).toBe(3)
    expect(runCli(['--out', out]).code).toBe(0)
  })

  it('an x86_64 Mach-O mixed into the arm64 .app → fail (exit 1) naming the file', () => {
    const out = makeOutDir()
    const app = makeApp(out, 'arm64')
    const intruder = unpacked(app, 'node_modules', '@lydell', 'node-pty-darwin-x64', 'prebuilds', 'darwin-x64', 'pty.node')
    writeFile(intruder, thinMachO('x64'))

    const result = verifyPackagedMac(out)
    expect(result.ok).toBe(false)
    expect(problemIds(result, 'arm64')).toEqual(['foreign-arch'])
    expect(result.archs[0].apps[0].foreign.map((f) => f.path)).toEqual([intruder])

    const cli = runCli(['--out', out, '--arch', 'arm64'])
    expect(cli.code).toBe(1)
    expect(cli.stderr).toContain(`x86_64: ${intruder}`)
  })

  it('no embedded claude → fail (exit 1) listing both candidates (BUG-118)', () => {
    const out = makeOutDir()
    makeApp(out, 'arm64', { omit: ['claude'] })

    const result = verifyPackagedMac(out)
    expect(result.ok).toBe(false)
    expect(problemIds(result, 'arm64')).toEqual(['embedded-claude'])

    const cli = runCli(['--out', out])
    expect(cli.code).toBe(1)
    expect(cli.stderr).toContain('no embedded claude (BUG-118)')
    expect(cli.stderr).toContain(path.join('claude-code-darwin-arm64', 'claude'))
    expect(cli.stderr).toContain(path.join('claude-code', 'bin', 'claude.exe'))
  })

  it('embedded claude of the wrong arch → fail', () => {
    const out = makeOutDir()
    const app = makeApp(out, 'arm64', { omit: ['claude'] })
    writeFile(claudePath(app, 'arm64'), thinMachO('x64'))

    const result = verifyPackagedMac(out)
    expect(result.ok).toBe(false)
    expect(problemIds(result, 'arm64').sort()).toEqual(['embedded-claude', 'foreign-arch'])
  })

  it('bin/claude.exe (runtime fallback) of the right arch is accepted', () => {
    const out = makeOutDir()
    const app = makeApp(out, 'arm64', { omit: ['claude'] })
    const wrapper = unpacked(app, 'node_modules', '@anthropic-ai', 'claude-code', 'bin', 'claude.exe')
    writeFile(wrapper, thinMachO('arm64'))

    const result = verifyPackagedMac(out)
    expect(result.ok).toBe(true)
    expect(result.archs[0].apps[0].embeddedClaude.found).toBe(wrapper)
  })

  it('a fat binary containing the baseline → ok (exit 0)', () => {
    const out = makeOutDir()
    const app = makeApp(out, 'arm64')
    writeFile(unpacked(app, 'node_modules', 'some-universal', 'lib.dylib'), fatMachO(['x64', 'arm64']))

    expect(verifyPackagedMac(out).ok).toBe(true)
    expect(runCli(['--out', out]).code).toBe(0)
  })

  it('a fat binary without the baseline → fail', () => {
    const out = makeOutDir()
    const app = makeApp(out, 'arm64')
    writeFile(unpacked(app, 'node_modules', 'some-universal', 'lib.dylib'), fatMachO(['x64']))

    expect(problemIds(verifyPackagedMac(out), 'arm64')).toEqual(['foreign-arch'])
  })

  it('x86_64 files in the whisper mac-x64 dir are allowed (the addon ships every arch)', () => {
    const out = makeOutDir()
    const app = makeApp(out, 'arm64')
    writeFile(whisperPath(app, 'mac-x64'), thinMachO('x64'))
    writeFile(whisperPath(app, 'mac-x64', 'libggml.dylib'), thinMachO('x64'))

    expect(verifyPackagedMac(out).ok).toBe(true)
  })

  it('main executable of another arch than requested → fail, baseline problem only', () => {
    const out = makeOutDir()
    const app = makeApp(out, 'arm64', { omit: ['main'] })
    writeFile(path.join(app, 'Contents', 'MacOS', 'BetterAgentTerminal'), thinMachO('x64'))

    const result = verifyPackagedMac(out)
    expect(result.ok).toBe(false)
    expect(problemIds(result, 'arm64')).toEqual(['baseline'])
  })

  it('no Mach-O main executable → fail', () => {
    const out = makeOutDir()
    makeApp(out, 'arm64', { omit: ['main'] })

    expect(problemIds(verifyPackagedMac(out), 'arm64')).toEqual(['baseline'])
  })

  it('no whisper binary → fail (exit 1) and lists every path tried (T0470)', () => {
    const out = makeOutDir()
    const app = makeApp(out, 'arm64', { omit: ['whisper'] })
    writeFile(whisperPath(app, 'mac-x64'), thinMachO('x64')) // other arch only — must not count

    const result = verifyPackagedMac(out)
    expect(result.ok).toBe(false)
    expect(problemIds(result, 'arm64')).toEqual(['whisper'])
    expect(result.archs[0].apps[0].tried.map((p) => path.basename(path.dirname(p)))).toEqual(['mac-arm64', 'darwin-arm64'])

    const cli = runCli(['--out', out])
    expect(cli.code).toBe(1)
    expect(cli.stderr).toContain(path.join('dist', 'mac-arm64', 'whisper.node'))
    expect(cli.stderr).toContain(path.join('dist', 'darwin-arm64', 'whisper.node'))
  })

  it('only darwin-<arch>/ (whisper fallback dir) → ok', () => {
    const out = makeOutDir()
    const app = makeApp(out, 'arm64', { omit: ['whisper'] })
    writeFile(whisperPath(app, 'darwin-arm64'), thinMachO('arm64'))

    const result = verifyPackagedMac(out)
    expect(result.ok).toBe(true)
    expect(path.basename(path.dirname(result.archs[0].apps[0].found))).toBe('darwin-arm64')
  })

  it('no .app for a requested arch → fail (exit 1), not a silent skip', () => {
    const out = makeOutDir()
    makeApp(out, 'arm64')

    const result = verifyPackagedMac(out, ['x64', 'arm64'])
    expect(result.ok).toBe(false)
    const x64 = result.archs.find((r) => r.arch === 'x64')
    expect(x64.apps).toEqual([])
    expect(x64.appOutDir).toBe(path.join(out, 'mac'))
    expect(result.archs.find((r) => r.arch === 'arm64').ok).toBe(true)

    const cli = runCli(['--out', out, '--arch', 'x64,arm64'])
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

describe('verifyPackagedLinux', () => {
  function makeLinux(outDir, arch, claude) {
    const resources = path.join(outDir, linuxAppOutDirName(arch), 'resources')
    writeFile(path.join(resources, 'app.asar.unpacked', 'node_modules', '@anthropic-ai', 'claude-code', 'package.json'), '{}')
    if (claude) writeFile(path.join(resources, 'app.asar.unpacked', 'node_modules', '@anthropic-ai', `claude-code-linux-${arch}`, 'claude'), claude)
    return resources
  }

  it('claude-code-linux-x64/claude is an x86-64 ELF → ok (exit 0)', () => {
    const out = makeOutDir()
    makeLinux(out, 'x64', elf(ELF_MACHINES.x64))

    const result = verifyPackagedLinux(out)
    expect(result.ok).toBe(true)
    expect(runCli(['--platform', 'linux', '--out', out]).code).toBe(0)
  })

  it('no embedded claude → fail (exit 1, BUG-118)', () => {
    const out = makeOutDir()
    makeLinux(out, 'x64', null)

    const result = verifyPackagedLinux(out)
    expect(result.ok).toBe(false)
    expect(result.archs[0].problems.map((p) => p.id)).toEqual(['embedded-claude'])

    const cli = runCli(['--platform', 'linux', '--out', out])
    expect(cli.code).toBe(1)
    expect(cli.stderr).toContain('no embedded claude (BUG-118)')
    expect(cli.stderr).toContain(path.join('claude-code-linux-x64', 'claude'))
  })

  it('embedded claude is not an x86-64 ELF → fail', () => {
    const out = makeOutDir()
    makeLinux(out, 'x64', elf(ELF_MACHINES.arm64))
    expect(verifyPackagedLinux(out).ok).toBe(false)

    const out2 = makeOutDir()
    makeLinux(out2, 'x64', thinMachO('x64'))
    const cli = runCli(['--platform', 'linux', '--out', out2])
    expect(cli.code).toBe(1)
    expect(cli.stderr).toContain('not an ELF binary')
  })

  it('no linux-unpacked directory → fail', () => {
    const out = makeOutDir()
    const result = verifyPackagedLinux(out)
    expect(result.ok).toBe(false)
    expect(result.archs[0].problems.map((p) => p.id)).toEqual(['app-out-dir'])
  })
})

// The CI step must sit between packaging and upload, with the archs the package targets.
describe.each(['pre-release.yml', 'release.yml'])('.github/workflows/%s', (workflow) => {
  const yaml = require('js-yaml')
  const doc = yaml.load(readFileSync(path.join(path.dirname(SCRIPT), '..', '.github', 'workflows', workflow), 'utf8'))
  const steps = doc.jobs.build.steps
  const indexOf = (name) => steps.findIndex((s) => s.name === name)
  const uploadIndex = (platform) => steps.findIndex((s) => s.if === `matrix.platform == '${platform}'` && String(s.uses).startsWith('actions/upload-artifact'))

  it('verifies the mac .app after packaging and before upload (arm64 only)', () => {
    const verify = indexOf('Verify packaged native binaries (macOS arm64)')
    expect(verify).toBeGreaterThan(indexOf('Package for macOS'))
    expect(verify).toBeLessThan(uploadIndex('mac'))
    expect(steps[verify].if).toBe("matrix.platform == 'mac'")
    expect(steps[verify].run).toBe('node scripts/verify-packaged-native.js --platform mac --out release --arch arm64')
    expect(steps.some((s) => String(s.run).includes('--arch x64,arm64'))).toBe(false)
  })

  it('verifies the Linux package after packaging and before upload', () => {
    const verify = indexOf('Verify packaged embedded claude (Linux x64)')
    expect(verify).toBeGreaterThan(indexOf('Package for Linux'))
    expect(verify).toBeLessThan(uploadIndex('linux'))
    expect(steps[verify].if).toBe("matrix.platform == 'linux'")
    expect(steps[verify].run).toBe('node scripts/verify-packaged-native.js --platform linux --out release --arch x64')
  })
})

describe('parseArgs', () => {
  it('defaults to mac, <repo>/release and arm64', () => {
    const opts = parseArgs([])
    expect(opts.platform).toBe('mac')
    expect(opts.outDir).toBe(path.join(path.dirname(SCRIPT), '..', 'release'))
    expect(opts.archs).toEqual(['arm64'])
  })

  it('linux defaults to x64', () => {
    expect(parseArgs(['--platform', 'linux']).archs).toEqual(['x64'])
  })

  it('accepts --out and --arch', () => {
    const opts = parseArgs(['--out', 'some/dir', '--arch', 'x64,arm64'])
    expect(opts.outDir).toBe(path.resolve('some/dir'))
    expect(opts.archs).toEqual(['x64', 'arm64'])
  })

  it('rejects unknown or incomplete arguments', () => {
    expect(() => parseArgs(['--bogus'])).toThrow(/unknown or incomplete/)
    expect(() => parseArgs(['--out'])).toThrow(/unknown or incomplete/)
    expect(() => parseArgs(['--arch', ','])).toThrow(/at least one arch/)
    expect(() => parseArgs(['--platform', 'win'])).toThrow(/--platform must be one of/)
  })
})
