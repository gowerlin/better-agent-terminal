// T0470 / BUG-116 — post-package check of the whisper binary in each mac .app.
// T0475 / BUG-117 / BUG-118 — plus the main-executable baseline cputype, every Mach-O
// under app.asar.unpacked, the embedded claude (mac + Linux).
// T0546 — Windows (PE claude.exe), and the installer slimming checks on every platform
// (C1 duplicate claude, C2a SDK binary, C3 baseline, C4 runtime packages, C5 whisper dirs).
// T0547 (D146) — no resources/bat-server-baseline at all on any platform.
// T0689 — resources/scripts holds exactly the runtime helpers (serverBundleHelperScripts) on every platform.
// T0691 / BUG-169 — resources/package.json = { name, version } of the packaged app (the helpers' version) on every platform.
//
// Fake electron-builder output trees (release/mac-arm64/*.app, release/linux-unpacked,
// release/win-unpacked) are built in a temp dir with hand-written Mach-O / ELF / PE headers
// and a hand-written app.asar (writeAsar; one test checks the reader against @electron/asar).

import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
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
  DEFAULT_WIN_ARCHS,
  ELF_MACHINES,
  MACH_CPU_TYPES,
  PE_MACHINES,
  allowedWhisperDistDirs,
  asarFiles,
  dynamicRuntimePackages,
  elfMachine,
  isCrossArchAllowed,
  linuxAppOutDirName,
  machOCpuTypes,
  macAppOutDirName,
  macWhisperAddonDirCandidates,
  packagedEmbeddedClaudeCandidates,
  parseArgs,
  peMachine,
  readAsar,
  readAsarFile,
  runtimeHelperScripts,
  verifyPackagedLayout,
  verifyPackagedLinux,
  verifyPackagedMac,
  verifyPackagedWin,
  winAppOutDirName,
} = require(SCRIPT)
const nativeModules = require('../verify-native-modules.js')
const { afterPack, versionManifestContent, versionManifestProblems } = require('../version-manifest.cjs')

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

function pe(machine) {
  const buf = Buffer.alloc(0x100)
  buf.write('MZ', 0, 'latin1')
  buf.writeUInt32LE(0x80, 0x3c)
  buf.writeUInt32BE(0x50450000, 0x80) // 'PE\0\0'
  buf.writeUInt16LE(machine, 0x84)
  return buf
}

function writeFile(filePath, content) {
  mkdirSync(path.dirname(filePath), { recursive: true })
  writeFileSync(filePath, content)
}

function relFiles(dir) {
  const out = []
  const walk = (current, prefix) => {
    let entries = []
    try {
      entries = readdirSync(current, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entries) {
      const rel = prefix ? `${prefix}/${e.name}` : e.name
      if (e.isDirectory()) walk(path.join(current, e.name), rel)
      else out.push(rel)
    }
  }
  walk(dir, '')
  return out
}

/**
 * A minimal app.asar (same layout as @electron/asar): `packed` files are stored in the
 * archive; every file already under app.asar.unpacked/ is listed as an unpacked entry.
 */
function writeAsar(resourcesPath, packed) {
  const header = { files: {} }
  const put = (rel, node) => {
    const parts = rel.split('/')
    let dir = header
    for (const part of parts.slice(0, -1)) dir = (dir.files[part] ??= { files: {} })
    dir.files[parts[parts.length - 1]] = node
  }
  const chunks = []
  let offset = 0
  for (const [rel, content] of Object.entries(packed)) {
    const buf = Buffer.from(content)
    put(rel, { size: buf.length, offset: String(offset) })
    chunks.push(buf)
    offset += buf.length
  }
  const unpackedDir = path.join(resourcesPath, 'app.asar.unpacked')
  for (const rel of relFiles(unpackedDir)) put(rel, { size: statSync(path.join(unpackedDir, rel)).size, unpacked: true })
  const json = Buffer.from(JSON.stringify(header))
  const padded = Math.ceil(json.length / 4) * 4
  const headerBuf = Buffer.alloc(8 + padded)
  headerBuf.writeUInt32LE(4 + padded, 0)
  headerBuf.writeInt32LE(json.length, 4)
  json.copy(headerBuf, 8)
  const sizeBuf = Buffer.alloc(8)
  sizeBuf.writeUInt32LE(4, 0)
  sizeBuf.writeUInt32LE(headerBuf.length, 4)
  writeFile(path.join(resourcesPath, 'app.asar'), Buffer.concat([sizeBuf, headerBuf, ...chunks]))
}

/** T0691: the version every healthy fixture packages (app.asar package.json = resources/package.json). */
const APP_VERSION = '1.2.3-pre.4'

/** dist-electron entries requiring ws / node-pty, plus ws itself, packed in the asar. */
const HEALTHY_PACKED = {
  'package.json': JSON.stringify({ name: 'better-agent-terminal', version: APP_VERSION, main: 'dist-electron/main.js' }),
  'dist-electron/main.js': 'require("./main-abc.js")',
  'dist-electron/main-abc.js': 'const ws=require("ws"),fs=require("node:fs"),p=require("path");require("electron")',
  'dist-electron/preload.js': 'require("electron")',
  'dist-electron/terminal-server.js': 'require("@lydell/node-pty")',
  'node_modules/ws/package.json': '{"name":"ws"}',
}

/** Unpacked runtime packages every healthy fixture has (the computed-path ones + node-pty). */
function writeRuntimePackages(resourcesPath, platform, arch) {
  const nm = path.join(resourcesPath, 'app.asar.unpacked', 'node_modules')
  for (const name of [...dynamicRuntimePackages(platform, arch), '@lydell/node-pty']) {
    writeFile(path.join(nm, ...name.split('/'), 'package.json'), JSON.stringify({ name }))
  }
}

/** T0689: resources/scripts with the runtime helpers (the packaged BAT_HELPER_DIR). */
function writeHelperScripts(resourcesPath, names = runtimeHelperScripts()) {
  for (const name of names) writeFile(path.join(resourcesPath, 'scripts', name), '')
}

/** T0691: resources/package.json as the afterPack hook writes it (the helpers' version source). */
function writeHelperVersion(resourcesPath, content = versionManifestContent('better-agent-terminal', APP_VERSION)) {
  writeFile(path.join(resourcesPath, 'package.json'), content)
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
function makeApp(outDir, arch, { omit = [], packed = HEALTHY_PACKED } = {}) {
  const appPath = path.join(outDir, macAppOutDirName(arch), APP)
  const resources = path.join(appPath, 'Contents', 'Resources')
  if (!omit.includes('main')) writeFile(path.join(appPath, 'Contents', 'MacOS', 'BetterAgentTerminal'), thinMachO(arch))
  if (!omit.includes('whisper')) writeFile(whisperPath(appPath, `mac-${arch}`), thinMachO(arch))
  if (!omit.includes('claude')) writeFile(claudePath(appPath, arch), thinMachO(arch))
  writeFile(unpacked(appPath, 'node_modules', '@lydell', `node-pty-darwin-${arch}`, 'pty.node'), thinMachO(arch))
  writeFile(whisperPath(appPath, 'js', 'index.js'), '')
  writeRuntimePackages(resources, 'darwin', arch)
  if (!omit.includes('helpers')) writeHelperScripts(resources)
  if (!omit.includes('version')) writeHelperVersion(resources)
  writeAsar(resources, packed)
  return appPath
}

function makeLinux(outDir, arch, claude, { packed = HEALTHY_PACKED } = {}) {
  const resources = path.join(outDir, linuxAppOutDirName(arch), 'resources')
  writeRuntimePackages(resources, 'linux', arch)
  writeHelperScripts(resources)
  writeHelperVersion(resources)
  if (claude) writeFile(path.join(resources, 'app.asar.unpacked', 'node_modules', '@anthropic-ai', `claude-code-linux-${arch}`, 'claude'), claude)
  writeAsar(resources, packed)
  return resources
}

function makeWin(outDir, { claude = pe(PE_MACHINES.x64), packed = HEALTHY_PACKED, extra = () => {} } = {}) {
  const resources = path.join(outDir, winAppOutDirName('x64'), 'resources')
  const anthropic = path.join(resources, 'app.asar.unpacked', 'node_modules', '@anthropic-ai')
  writeRuntimePackages(resources, 'win32', 'x64')
  writeHelperScripts(resources)
  writeHelperVersion(resources)
  if (claude) writeFile(path.join(anthropic, 'claude-code', 'bin', 'claude.exe'), claude)
  writeFile(path.join(anthropic, 'claude-code-win32-x64', 'package.json'), '{}')
  writeFile(path.join(resources, 'app.asar.unpacked', 'node_modules', '@kutalia', 'whisper-node-addon', 'dist', 'win32-x64', 'whisper.node'), pe(PE_MACHINES.x64))
  extra(resources)
  writeAsar(resources, packed)
  return resources
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

  it('runtime helpers = serverBundleHelperScripts = the package.json extraResources whitelist (T0689)', () => {
    const helpers = ['_bat-cert.mjs', '_bat-logger.mjs', 'bat-hook.mjs', 'bat-mcp.mjs', 'bat-notify.mjs', 'bat-terminal.mjs']
    expect(runtimeHelperScripts()).toEqual(helpers)
    const pkg = require('../../package.json')
    const entry = pkg.build.extraResources.find((e) => e.from === 'scripts')
    expect([...entry.filter].sort()).toEqual(helpers)
    expect(runtimeHelperScripts("const serverBundleHelperScripts = [\n  'b.mjs',\n  'a.mjs',\n]")).toEqual(['a.mjs', 'b.mjs'])
    expect(() => runtimeHelperScripts('const helpers = []')).toThrow(/serverBundleHelperScripts/)
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
    expect(checked.layout.baselines).toEqual([])
    expect(checked.layout.helperScripts).toEqual(runtimeHelperScripts())
    expect(checked.layout.runtime.packages).toEqual(['@anthropic-ai/claude-code', '@kutalia/whisper-node-addon', '@lydell/node-pty', '@openai/codex-darwin-arm64', 'ws'])
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

  it('a whisper mac-x64 dir is not a foreign-arch problem, but T0546 C5 flags the dir itself', () => {
    const out = makeOutDir()
    const app = makeApp(out, 'arm64')
    writeFile(whisperPath(app, 'mac-x64'), thinMachO('x64'))
    writeFile(whisperPath(app, 'mac-x64', 'libggml.dylib'), thinMachO('x64'))

    const result = verifyPackagedMac(out)
    expect(problemIds(result, 'arm64')).toEqual(['whisper-platforms'])
    expect(result.archs[0].apps[0].foreign).toEqual([])
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
    expect(problemIds(result, 'arm64')).toEqual(['whisper', 'whisper-platforms'])
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

  it('Contents/Resources/scripts with a dev script, or without the helpers → fail (exit 1, T0689)', () => {
    const out = makeOutDir()
    const app = makeApp(out, 'arm64')
    writeFile(path.join(app, 'Contents', 'Resources', 'scripts', 'run-legacy-tests.mjs'), '')

    const result = verifyPackagedMac(out)
    expect(problemIds(result, 'arm64')).toEqual(['helper-scripts'])
    expect(result.archs[0].apps[0].problems[0].details).toEqual(['extra: run-legacy-tests.mjs'])
    const cli = runCli(['--out', out])
    expect(cli.code).toBe(1)
    expect(cli.stderr).toContain('extra: run-legacy-tests.mjs')
    expect(cli.stderr).toContain('T0689 helper-scripts')

    const out2 = makeOutDir()
    makeApp(out2, 'arm64', { omit: ['helpers'] })
    const missing = verifyPackagedMac(out2)
    expect(problemIds(missing, 'arm64')).toEqual(['helper-scripts'])
    expect(missing.archs[0].apps[0].problems[0].details).toEqual(runtimeHelperScripts().map((n) => `missing: ${n}`))
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
  it('any server bundle baseline in the AppImage → fail (D146 / T0547)', () => {
    const out = makeOutDir()
    const resources = makeLinux(out, 'x64', elf(ELF_MACHINES.x64))
    writeFile(path.join(resources, 'bat-server-baseline', 'bat-server-linux-x64-v1.0.0.tar.gz'), '')

    const result = verifyPackagedLinux(out)
    expect(result.archs[0].problems.map((p) => p.id)).toEqual(['server-bundle-baseline'])
    expect(result.archs[0].problems[0].details[0]).toContain('bat-server-linux-x64-v1.0.0.tar.gz')
  })

  it('an empty bat-server-baseline directory → fail (D146 / T0547)', () => {
    const out = makeOutDir()
    const resources = makeLinux(out, 'x64', elf(ELF_MACHINES.x64))
    mkdirSync(path.join(resources, 'bat-server-baseline'))

    const result = verifyPackagedLinux(out)
    expect(result.archs[0].problems.map((p) => p.id)).toEqual(['server-bundle-baseline'])
    expect(result.archs[0].problems[0].details[0]).toContain('empty directory')
  })

  it('claude-code-linux-x64/claude is an x86-64 ELF → ok (exit 0)', () => {
    const out = makeOutDir()
    makeLinux(out, 'x64', elf(ELF_MACHINES.x64))

    const result = verifyPackagedLinux(out)
    expect(result.ok).toBe(true)
    expect(result.archs[0].layout.helperScripts).toEqual(runtimeHelperScripts())
    const cli = runCli(['--platform', 'linux', '--out', out])
    expect(cli.code).toBe(0)
    expect(cli.stdout).toContain('6 runtime helper(s) in resources/scripts')
  })

  it('resources/scripts missing a helper or carrying a build script → fail (exit 1, T0689)', () => {
    const out = makeOutDir()
    const resources = makeLinux(out, 'x64', elf(ELF_MACHINES.x64))
    rmSync(path.join(resources, 'scripts', '_bat-logger.mjs'))
    writeFile(path.join(resources, 'scripts', 'build-server-bundle.mjs'), '')

    const result = verifyPackagedLinux(out)
    expect(result.archs[0].problems.map((p) => p.id)).toEqual(['helper-scripts'])
    expect(result.archs[0].problems[0].details).toEqual(['missing: _bat-logger.mjs', 'extra: build-server-bundle.mjs'])
    const cli = runCli(['--platform', 'linux', '--out', out])
    expect(cli.code).toBe(1)
    expect(cli.stderr).toContain('missing: _bat-logger.mjs')
    expect(cli.stderr).toContain('extra: build-server-bundle.mjs')
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

  it('verifies the Windows package after packaging and before upload (T0546)', () => {
    const verify = indexOf('Verify packaged native binaries (Windows x64)')
    expect(verify).toBeGreaterThan(indexOf('Package for Windows'))
    expect(verify).toBeLessThan(uploadIndex('win'))
    expect(steps[verify].if).toBe("matrix.platform == 'win'")
    expect(steps[verify].run).toBe('node scripts/verify-packaged-native.js --platform win --out release --arch x64')
  })

  it('reports artifact sizes after every package step and before any upload (T0546, never fails the job)', () => {
    const report = indexOf('Report artifact sizes')
    expect(report).toBeGreaterThan(Math.max(indexOf('Package for Windows'), indexOf('Package for macOS'), indexOf('Package for Linux')))
    expect(report).toBeLessThan(Math.min(uploadIndex('win'), uploadIndex('mac'), uploadIndex('linux')))
    expect(steps[report].if).toBeUndefined()
    expect(steps[report].run).toBe('node scripts/report-artifact-sizes.mjs --out release')
    expect(steps[report]['continue-on-error']).toBe(true)
  })

  it('verifies the Linux package after packaging and before upload', () => {
    const verify = indexOf('Verify packaged embedded claude (Linux x64)')
    expect(verify).toBeGreaterThan(indexOf('Package for Linux'))
    expect(verify).toBeLessThan(uploadIndex('linux'))
    expect(steps[verify].if).toBe("matrix.platform == 'linux'")
    expect(steps[verify].run).toBe('node scripts/verify-packaged-native.js --platform linux --out release --arch x64')
  })
})

describe('verifyPackagedWin (T0546)', () => {
  const ids = (out) => verifyPackagedWin(out).archs[0].problems.map((p) => p.id)

  it('bin/claude.exe is an x64 PE and nothing extra is packaged → ok (exit 0)', () => {
    const out = makeOutDir()
    makeWin(out)

    const result = verifyPackagedWin(out)
    expect(result.ok).toBe(true)
    expect(result.archs[0].peMachine).toBe(PE_MACHINES.x64)
    expect(result.archs[0].layout.baselines).toEqual([])
    expect(result.archs[0].layout.helperScripts).toEqual(runtimeHelperScripts())
    expect(winAppOutDirName('arm64')).toBe('win-arm64-unpacked')
    const cli = runCli(['--platform', 'win', '--out', out])
    expect(cli.code).toBe(0)
    expect(cli.stdout).toContain('every windows package passed (x64)')
  })

  it('the second claude.exe in claude-code-win32-x64 → fail (C1)', () => {
    const out = makeOutDir()
    makeWin(out, { extra: (r) => writeFile(path.join(r, 'app.asar.unpacked', 'node_modules', '@anthropic-ai', 'claude-code-win32-x64', 'claude.exe'), pe(PE_MACHINES.x64)) })
    expect(ids(out)).toEqual(['duplicate-claude'])
  })

  it('no bin/claude.exe, or the npm stub (not a PE) → fail (exit 1)', () => {
    const out = makeOutDir()
    makeWin(out, { claude: null })
    expect(ids(out)).toEqual(['embedded-claude'])

    const out2 = makeOutDir()
    makeWin(out2, { claude: Buffer.from('#!/usr/bin/env node\nconsole.error("claude native binary not installed.")\n') })
    const cli = runCli(['--platform', 'win', '--out', out2])
    expect(cli.code).toBe(1)
    expect(cli.stderr).toContain('not a PE image')
  })

  it('an arm64 PE in the x64 package → fail', () => {
    const out = makeOutDir()
    makeWin(out, { claude: pe(PE_MACHINES.arm64) })
    expect(verifyPackagedWin(out).archs[0].problems[0].message).toContain('PE machine 0xaa64')
  })

  it('no win-unpacked directory → fail', () => {
    expect(ids(makeOutDir())).toEqual(['app-out-dir'])
  })

  it('reads PE headers', () => {
    expect(peMachine(pe(PE_MACHINES.x64))).toBe(0x8664)
    expect(peMachine(elf(ELF_MACHINES.x64))).toBeNull()
    expect(peMachine(Buffer.from('MZ'))).toBeNull()
  })

  // ── layout checks shared by every platform (exercised through the Windows tree) ──

  it('any @anthropic-ai/claude-agent-sdk* file, unpacked or packed → fail (C2a)', () => {
    const out = makeOutDir()
    makeWin(out, { extra: (r) => writeFile(path.join(r, 'app.asar.unpacked', 'node_modules', '@anthropic-ai', 'claude-agent-sdk-win32-x64', 'claude.exe'), pe(PE_MACHINES.x64)) })
    expect(ids(out)).toEqual(['sdk-binary'])

    const out2 = makeOutDir()
    makeWin(out2, { packed: { ...HEALTHY_PACKED, 'node_modules/@anthropic-ai/claude-agent-sdk/sdk.mjs': '' } })
    expect(ids(out2)).toEqual(['sdk-binary'])
  })

  it('whisper dist/ only keeps js/ and the platform dirs (C5)', () => {
    expect(allowedWhisperDistDirs('win32', 'x64')).toEqual(['js', 'win32-x64'])
    expect(allowedWhisperDistDirs('linux', 'x64')).toEqual(['js', 'linux-x64'])
    expect(allowedWhisperDistDirs('darwin', 'arm64')).toEqual(['js', 'mac-arm64', 'darwin-arm64'])
    for (const [platform, arch] of [['win32', 'x64'], ['linux', 'x64'], ['darwin', 'arm64']]) {
      expect(allowedWhisperDistDirs(platform, arch).slice(1)).toEqual(whisperAddonDirCandidates(platform, arch))
    }
    const out = makeOutDir()
    makeWin(out, { extra: (r) => writeFile(path.join(r, 'app.asar.unpacked', 'node_modules', '@kutalia', 'whisper-node-addon', 'dist', 'linux-x64', 'libwhisper.so'), elf(ELF_MACHINES.x64)) })
    const problem = verifyPackagedWin(out).archs[0].problems[0]
    expect(problem.id).toBe('whisper-platforms')
    expect(problem.details).toEqual(['node_modules/@kutalia/whisper-node-addon/dist/linux-x64'])
  })

  it('a package dist-electron requires but the package lacks → fail naming it (C4)', () => {
    const out = makeOutDir()
    makeWin(out, { packed: { ...HEALTHY_PACKED, 'dist-electron/main-abc.js': 'require("ws");require("opencc-js");x.resolve("@scope/pkg/package.json");require(`${dyn}`)' } })
    const problem = verifyPackagedWin(out).archs[0].problems[0]
    expect(problem.id).toBe('runtime-require')
    expect(problem.details).toEqual(['opencc-js (required by dist-electron/main-abc.js)', '@scope/pkg (required by dist-electron/main-abc.js)'])
  })

  it('a missing dependency of a packaged package → fail; a nested node_modules copy satisfies it (C4)', () => {
    const packed = {
      ...HEALTHY_PACKED,
      'dist-electron/main-abc.js': 'require("ws");require("ajv-formats/dist/formats")',
      'node_modules/ajv-formats/package.json': '{"dependencies":{"ajv":"^8"}}',
    }
    const out = makeOutDir()
    makeWin(out, { packed })
    expect(verifyPackagedWin(out).archs[0].problems[0].details).toEqual(['ajv (required by ajv-formats)'])

    const out2 = makeOutDir()
    makeWin(out2, { packed: { ...packed, 'node_modules/ajv-formats/node_modules/ajv/package.json': '{}' } })
    expect(verifyPackagedWin(out2).ok).toBe(true)
  })

  it('a computed-path package (dynamicRuntimePackages) missing → fail', () => {
    const out = makeOutDir()
    makeWin(out, { extra: (r) => rmSync(path.join(r, 'app.asar.unpacked', 'node_modules', '@openai'), { recursive: true, force: true }) })
    expect(verifyPackagedWin(out).archs[0].problems[0].details).toEqual(['@openai/codex-win32-x64 (required by (computed path))'])
  })

  it('a dist-electron entry missing from app.asar → fail', () => {
    const out = makeOutDir()
    const { 'dist-electron/preload.js': _dropped, ...packed } = HEALTHY_PACKED
    makeWin(out, { packed })
    expect(verifyPackagedWin(out).archs[0].problems[0].details).toEqual(['dist-electron/preload.js'])
  })

  it('resources/scripts with the dev scripts (the old "*.mjs" filter) → fail naming each (T0689)', () => {
    const out = makeOutDir()
    makeWin(out, { extra: (r) => {
      for (const name of ['bat-server.mjs', 'run-legacy-tests.mjs']) writeFile(path.join(r, 'scripts', name), '')
      writeFile(path.join(r, 'scripts', 'hooks', 'pre-commit'), '')
    } })
    expect(ids(out)).toEqual(['helper-scripts'])
    expect(verifyPackagedWin(out).archs[0].problems[0].details).toEqual(['extra: bat-server.mjs', 'extra: hooks/pre-commit', 'extra: run-legacy-tests.mjs'])
    const cli = runCli(['--platform', 'win', '--out', out])
    expect(cli.code).toBe(1)
    expect(cli.stderr).toContain('extra: run-legacy-tests.mjs')
  })

  it('no resources/scripts at all → fail listing every helper (T0689)', () => {
    const out = makeOutDir()
    makeWin(out, { extra: (r) => rmSync(path.join(r, 'scripts'), { recursive: true, force: true }) })
    expect(ids(out)).toEqual(['helper-scripts'])
    expect(verifyPackagedWin(out).archs[0].problems[0].details).toEqual(runtimeHelperScripts().map((n) => `missing: ${n}`))
  })

  it('verifyPackagedLayout takes the expected helper list as an option (T0689)', () => {
    const out = makeOutDir()
    const resources = makeWin(out)
    const layout = verifyPackagedLayout(resources, 'win32', 'x64', { helperScripts: ['bat-terminal.mjs'] })
    expect(layout.problems.map((p) => p.id)).toEqual(['helper-scripts'])
    expect(layout.problems[0].details).toEqual(runtimeHelperScripts().filter((n) => n !== 'bat-terminal.mjs').map((n) => `extra: ${n}`))
  })

  it('reads an app.asar written by @electron/asar (packed and unpacked files)', async () => {
    const asar = require('@electron/asar')
    const src = makeOutDir()
    writeFile(path.join(src, 'dist-electron', 'main.js'), 'require("ws")')
    writeFile(path.join(src, 'node_modules', 'ws', 'package.json'), '{"name":"ws"}')
    writeFile(path.join(src, 'native', 'addon.node'), 'binary')
    const dest = path.join(makeOutDir(), 'app.asar')
    await asar.createPackageWithOptions(src, dest, { unpack: '*.node' })

    const archive = readAsar(dest)
    expect(asarFiles(archive).sort()).toEqual(['dist-electron/main.js', 'native/addon.node', 'node_modules/ws/package.json'])
    expect(String(readAsarFile(archive, 'node_modules/ws/package.json'))).toBe('{"name":"ws"}')
    expect(String(readAsarFile(archive, 'dist-electron/main.js'))).toBe('require("ws")')
    expect(String(readAsarFile(archive, 'native/addon.node'))).toBe('binary')
    expect(readAsarFile(archive, 'missing.js')).toBeNull()
  })
})

// T0691 / BUG-169: the helpers' version file, on each platform's real resources directory.
describe.each([
  {
    platform: 'mac',
    build: (out, opts) => path.join(makeApp(out, 'arm64', opts), 'Contents', 'Resources'),
    checked: (out) => verifyPackagedMac(out).archs[0].apps[0],
    cli: ['--platform', 'mac'],
  },
  {
    platform: 'linux',
    build: (out, opts) => makeLinux(out, 'x64', elf(ELF_MACHINES.x64), opts),
    checked: (out) => verifyPackagedLinux(out).archs[0],
    cli: ['--platform', 'linux'],
  },
  {
    platform: 'win',
    build: (out, opts) => makeWin(out, opts),
    checked: (out) => verifyPackagedWin(out).archs[0],
    cli: ['--platform', 'win'],
  },
])('helper-version on $platform (T0691)', ({ build, checked, cli }) => {
  const manifestPath = (resources) => path.join(resources, 'package.json')
  const versionProblems = (out) => checked(out).problems.filter((p) => p.id === 'helper-version')

  it('resources/package.json = { name, version } of the packaged app → ok (exit 0)', () => {
    const out = makeOutDir()
    const resources = build(out, {})
    const result = checked(out)
    expect(result.problems).toEqual([])
    expect(result.layout.helperVersion).toEqual({ path: manifestPath(resources), version: APP_VERSION, expectedVersion: APP_VERSION, problems: [] })
    const run = runCli([...cli, '--out', out])
    expect(run.code).toBe(0)
    expect(run.stdout).toContain(`helper version ${APP_VERSION}`)
  })

  it('missing → fail (exit 1)', () => {
    const out = makeOutDir()
    rmSync(manifestPath(build(out, {})))
    expect(versionProblems(out).map((p) => p.details)).toEqual([['missing (the afterPack hook did not run)']])
    expect(checked(out).problems.map((p) => p.id)).toEqual(['helper-version'])
    const run = runCli([...cli, '--out', out])
    expect(run.code).toBe(1)
    expect(run.stderr).toContain('T0691 helper-version')
  })

  it('version 0.0.0 → fail', () => {
    const out = makeOutDir()
    writeHelperVersion(build(out, {}), versionManifestContent('better-agent-terminal', '0.0.0'))
    expect(versionProblems(out).map((p) => p.details)).toEqual([["version is 0.0.0 (the helpers' fallback)"]])
  })

  it('an extra field (e.g. the whole app package.json) → fail', () => {
    const out = makeOutDir()
    writeHelperVersion(build(out, {}), JSON.stringify({ name: 'better-agent-terminal', version: APP_VERSION, main: 'dist-electron/main.js' }))
    expect(versionProblems(out).map((p) => p.details)).toEqual([['extra field(s): main (only name / version allowed)']])
  })

  it('a version other than the app.asar package.json → fail (exit 1)', () => {
    const out = makeOutDir()
    build(out, { packed: { ...HEALTHY_PACKED, 'package.json': JSON.stringify({ name: 'better-agent-terminal', version: '9.9.9', main: 'dist-electron/main.js' }) } })
    expect(versionProblems(out).map((p) => p.details)).toEqual([[`version is ${APP_VERSION}, expected 9.9.9 (app.asar package.json)`]])
    const run = runCli([...cli, '--out', out])
    expect(run.code).toBe(1)
    expect(run.stderr).toContain(`version is ${APP_VERSION}, expected 9.9.9`)
  })

  it('app.asar package.json without a version → only the file itself is checked', () => {
    const out = makeOutDir()
    build(out, { packed: { ...HEALTHY_PACKED, 'package.json': '{"main":"dist-electron/main.js"}' } })
    expect(checked(out).problems).toEqual([])
    expect(checked(out).layout.helperVersion.expectedVersion).toBeNull()
  })
})

describe('version-manifest.cjs (T0691)', () => {
  it('writes only name / version, in the server bundle format', () => {
    expect(versionManifestContent('better-agent-terminal', '0.7.1')).toBe('{\n  "name": "better-agent-terminal",\n  "version": "0.7.1"\n}\n')
    expect(versionManifestProblems(versionManifestContent('better-agent-terminal', '0.7.1'), '0.7.1')).toEqual([])
  })

  it('reports every problem of a version file', () => {
    expect(versionManifestProblems('not json')[0]).toMatch(/^not valid JSON/)
    expect(versionManifestProblems('[]')).toEqual(['not a JSON object'])
    expect(versionManifestProblems('{"version":""}')).toEqual(['name is missing or empty', 'version is missing or empty'])
    expect(versionManifestProblems('{"name":"x","version":"1.0.0"}', '1.0.1')).toEqual(['version is 1.0.0, expected 1.0.1 (app.asar package.json)'])
    expect(versionManifestProblems('{"name":"x","version":"1.0.0"}')).toEqual([])
  })

  it('the server bundle uses the same function (no second copy of the format)', () => {
    const source = readFileSync(path.join(path.dirname(SCRIPT), 'build-server-bundle.mjs'), 'utf8')
    expect(source).toContain("import versionManifest from './version-manifest.cjs'")
    expect(source).toContain("writeFileSync(path.join(stagingRoot, 'package.json'), versionManifest.versionManifestContent(pkg.name, version), 'utf8')")
    expect(source).not.toMatch(/JSON\.stringify\(\{\s*name:\s*pkg\.name/)
  })

  it('package.json build.afterPack is the hook; no platform-level files / extraResources (T0546)', () => {
    const pkg = require('../../package.json')
    expect(pkg.build.afterPack).toBe('./scripts/version-manifest.cjs')
    for (const platform of ['win', 'mac', 'linux']) {
      expect(pkg.build[platform].files).toBeUndefined()
      expect(pkg.build[platform].extraResources).toBeUndefined()
    }
  })

  // electron-builder calls afterPack with the packager after extraResources are copied, before signing.
  it.each([
    ['win', (appOutDir) => path.join(appOutDir, 'resources')],
    ['linux', (appOutDir) => path.join(appOutDir, 'resources')],
    ['mac', (appOutDir) => path.join(appOutDir, 'BetterAgentTerminal.app', 'Contents', 'Resources')],
  ])('afterPack writes the packaged version into the %s resources directory', async (_platform, resourcesDir) => {
    const appOutDir = makeOutDir()
    mkdirSync(resourcesDir(appOutDir), { recursive: true })
    const packager = { appInfo: { name: 'better-agent-terminal', version: '0.7.2-pre.1' }, getResourcesDir: resourcesDir }
    await afterPack({ appOutDir, packager })
    expect(readFileSync(path.join(resourcesDir(appOutDir), 'package.json'), 'utf8')).toBe(versionManifestContent('better-agent-terminal', '0.7.2-pre.1'))
  })

  it('afterPack fails the build when the packager has no version', async () => {
    const appOutDir = makeOutDir()
    const packager = { appInfo: { name: 'better-agent-terminal', version: '' }, getResourcesDir: () => appOutDir }
    await expect(afterPack({ appOutDir, packager })).rejects.toThrow(/name \/ version unavailable/)
  })
})

describe('parseArgs', () => {
  it('defaults to mac, <repo>/release and arm64', () => {
    const opts = parseArgs([])
    expect(opts.platform).toBe('mac')
    expect(opts.outDir).toBe(path.join(path.dirname(SCRIPT), '..', 'release'))
    expect(opts.archs).toEqual(['arm64'])
  })

  it('linux and win default to x64', () => {
    expect(parseArgs(['--platform', 'linux']).archs).toEqual(['x64'])
    expect(parseArgs(['--platform', 'win']).archs).toEqual(DEFAULT_WIN_ARCHS)
    expect(DEFAULT_WIN_ARCHS).toEqual(['x64'])
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
    expect(() => parseArgs(['--platform', 'bsd'])).toThrow(/--platform must be one of/)
  })
})
