// T0472 — verify-native-modules.js: embedded claude must be the native binary (not the
// npm placeholder stub) and better-sqlite3 must have its compiled .node.
//
// Fake node_modules trees are built in a temp dir. Executables are faked with their
// magic bytes only: the check reads the head of the file, never runs it.

import { execFileSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterEach, describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'verify-native-modules.js')
const {
  CLAUDE_STUB_MARKER,
  EMBEDDED_RUNTIME_REQUIRED_HOSTS,
  WHISPER_ADDON_REQUIRED_HOSTS,
  classifyEmbeddedClaude,
  executableFormat,
  verifyEmbeddedRuntime,
  whisperAddonDirCandidates,
} = require(SCRIPT)

// Shape of @anthropic-ai/claude-code 2.1.289's bin/claude.exe placeholder (500 bytes upstream).
const STUB = [
  `echo "Error: ${CLAUDE_STUB_MARKER}." >&2`,
  'echo "" >&2',
  'echo "Either postinstall did not run (--ignore-scripts, some pnpm configs)" >&2',
  'echo "Run the postinstall manually (adjust path for local vs global install):" >&2',
  'echo "  node node_modules/@anthropic-ai/claude-code/install.cjs" >&2',
  'exit 1',
  '',
].join('\n')

const MAGIC = {
  pe: Buffer.from([0x4d, 0x5a, 0x90, 0x00]),
  elf: Buffer.from([0x7f, 0x45, 0x4c, 0x46]),
  macho: Buffer.from([0xcf, 0xfa, 0xed, 0xfe]),
}
const HOST_FORMAT = { win32: 'pe', linux: 'elf', darwin: 'macho' }

const dirs = []

function makeRoot() {
  const dir = mkdtempSync(path.join(os.tmpdir(), 't0472-root-'))
  dirs.push(dir)
  return dir
}

function writeFile(root, rel, content) {
  const p = path.join(root, ...rel.split('/'))
  mkdirSync(path.dirname(p), { recursive: true })
  writeFileSync(p, content)
  return p
}

const CLAUDE_REL = 'node_modules/@anthropic-ai/claude-code/bin/claude.exe'
const SQLITE_REL = 'node_modules/better-sqlite3/build/Release/better_sqlite3.node'

/** A fake executable: magic bytes + padding past the stub-size threshold. */
function fakeExecutable(format, size = 64 * 1024) {
  const buf = Buffer.alloc(size)
  MAGIC[format].copy(buf)
  return buf
}

function writeClaude(root, content) {
  return writeFile(root, CLAUDE_REL, content)
}

afterEach(() => {
  while (dirs.length) rmSync(dirs.pop(), { recursive: true, force: true })
})

describe('executableFormat', () => {
  it('recognises PE, ELF and Mach-O (both byte orders, fat) headers', () => {
    expect(executableFormat(MAGIC.pe)).toBe('pe')
    expect(executableFormat(MAGIC.elf)).toBe('elf')
    for (const magic of [0xfeedface, 0xfeedfacf, 0xcefaedfe, 0xcffaedfe, 0xcafebabe]) {
      const buf = Buffer.alloc(4)
      buf.writeUInt32BE(magic)
      expect(executableFormat(buf)).toBe('macho')
    }
  })

  it('returns null for scripts and short files', () => {
    expect(executableFormat(Buffer.from(STUB))).toBeNull()
    expect(executableFormat(Buffer.from('#!/bin/sh\n'))).toBeNull()
    expect(executableFormat(Buffer.alloc(0))).toBeNull()
    expect(executableFormat(Buffer.from([0x7f]))).toBeNull()
  })
})

describe('classifyEmbeddedClaude', () => {
  it('a host-format executable is native', () => {
    const root = makeRoot()
    for (const [platform, format] of Object.entries(HOST_FORMAT)) {
      const p = writeClaude(root, fakeExecutable(format))
      expect(classifyEmbeddedClaude(p, platform)).toMatchObject({ status: 'native', format })
    }
  })

  it('the running node binary counts as native for this host', () => {
    expect(classifyEmbeddedClaude(process.execPath, process.platform).status).toBe('native')
  })

  it('the npm placeholder is a stub', () => {
    const p = writeClaude(makeRoot(), STUB)
    expect(classifyEmbeddedClaude(p, 'win32')).toEqual({ status: 'stub', size: Buffer.byteLength(STUB), format: null })
  })

  it('the stub is detected by content even when padded past the size threshold', () => {
    const p = writeClaude(makeRoot(), STUB + '#'.repeat(3000) + '\n'.repeat(2000))
    expect(classifyEmbeddedClaude(p, 'linux').status).toBe('stub')
  })

  it('size is only a tie-breaker: a tiny non-executable without the marker is a stub', () => {
    const p = writeClaude(makeRoot(), '#!/bin/sh\necho "reworded upstream stub" >&2\nexit 1\n')
    expect(classifyEmbeddedClaude(p, 'darwin').status).toBe('stub')
  })

  it('a large non-executable is not native (and not called a stub)', () => {
    const p = writeClaude(makeRoot(), Buffer.alloc(64 * 1024, 0x20))
    expect(classifyEmbeddedClaude(p, 'win32')).toMatchObject({ status: 'not-native', format: null })
  })

  it('a binary for another platform is not native', () => {
    const p = writeClaude(makeRoot(), fakeExecutable('elf'))
    expect(classifyEmbeddedClaude(p, 'win32')).toMatchObject({ status: 'not-native', format: 'elf' })
    expect(classifyEmbeddedClaude(p, 'darwin')).toMatchObject({ status: 'not-native', format: 'elf' })
  })

  it('platforms without a fixed format accept any executable', () => {
    const p = writeClaude(makeRoot(), fakeExecutable('elf'))
    expect(classifyEmbeddedClaude(p, 'freebsd').status).toBe('native')
  })

  it('missing file or a directory is missing', () => {
    const root = makeRoot()
    expect(classifyEmbeddedClaude(path.join(root, ...CLAUDE_REL.split('/')), 'win32').status).toBe('missing')
    mkdirSync(path.join(root, ...CLAUDE_REL.split('/')), { recursive: true })
    expect(classifyEmbeddedClaude(path.join(root, ...CLAUDE_REL.split('/')), 'win32').status).toBe('missing')
  })
})

describe('verifyEmbeddedRuntime', () => {
  it('blocks on the same desktop hosts as the whisper check', () => {
    expect(EMBEDDED_RUNTIME_REQUIRED_HOSTS).toEqual(['win32-x64', 'linux-x64', 'darwin-arm64'])
    expect(EMBEDDED_RUNTIME_REQUIRED_HOSTS).toEqual(WHISPER_ADDON_REQUIRED_HOSTS)
  })

  it('darwin-x64 is not a desktop package host (D136 / D137): whisper and runtime only warn', () => {
    expect(WHISPER_ADDON_REQUIRED_HOSTS).not.toContain('darwin-x64')
    const root = makeRoot()
    writeClaude(root, STUB)
    const result = verifyEmbeddedRuntime(root, 'darwin', 'x64')
    expect(result.host).toBe('darwin-x64')
    expect(result.problems.map((p) => p.id)).toEqual(['embedded-claude', 'better-sqlite3'])
    expect(result.blocking).toBe(false)
  })

  it('complete tree: no problems', () => {
    const root = makeRoot()
    writeClaude(root, fakeExecutable('pe'))
    writeFile(root, SQLITE_REL, '')
    expect(verifyEmbeddedRuntime(root, 'win32', 'x64')).toEqual({ host: 'win32-x64', problems: [], blocking: false })
  })

  it('stub claude blocks a desktop host and points at install.cjs', () => {
    const root = makeRoot()
    writeClaude(root, STUB)
    writeFile(root, SQLITE_REL, '')
    const result = verifyEmbeddedRuntime(root, 'win32', 'x64')
    expect(result.blocking).toBe(true)
    expect(result.problems).toHaveLength(1)
    expect(result.problems[0]).toMatchObject({ id: 'embedded-claude', status: 'stub' })
    expect(result.problems[0].fix[0]).toBe('node node_modules/@anthropic-ai/claude-code/install.cjs')
  })

  it('missing claude.exe and missing better_sqlite3.node are both reported', () => {
    const root = makeRoot()
    mkdirSync(path.join(root, 'node_modules', 'better-sqlite3'), { recursive: true })
    const result = verifyEmbeddedRuntime(root, 'linux', 'x64')
    expect(result.blocking).toBe(true)
    expect(result.problems.map((p) => [p.id, p.status])).toEqual([
      ['embedded-claude', 'missing'],
      ['better-sqlite3', 'missing'],
    ])
    expect(result.problems[1].details[0]).toBe(`expected: ${path.join(root, ...SQLITE_REL.split('/'))}`)
    expect(result.problems[1].fix[0]).toContain('electron-rebuild -f -w better-sqlite3')
  })

  it('missing better_sqlite3.node alone blocks a desktop host', () => {
    const root = makeRoot()
    writeClaude(root, fakeExecutable('macho'))
    const result = verifyEmbeddedRuntime(root, 'darwin', 'arm64')
    expect(result.blocking).toBe(true)
    expect(result.problems.map((p) => p.id)).toEqual(['better-sqlite3'])
  })

  it('non-desktop host (linux-arm64 server-bundle runner): problems warn, never block', () => {
    const root = makeRoot()
    writeClaude(root, STUB)
    const result = verifyEmbeddedRuntime(root, 'linux', 'arm64')
    expect(result.host).toBe('linux-arm64')
    expect(result.problems.map((p) => p.id)).toEqual(['embedded-claude', 'better-sqlite3'])
    expect(result.blocking).toBe(false)
  })
})

describe('CLI on a fake project tree', () => {
  // The script resolves the project root from its own location, so it is copied into
  // <root>/scripts/ and run there.
  function makeProject({ claude, sqlite = true }) {
    const root = makeRoot()
    mkdirSync(path.join(root, 'scripts'))
    copyFileSync(SCRIPT, path.join(root, 'scripts', 'verify-native-modules.js'))
    for (const mod of ['@kutalia/whisper-node-addon', '@lydell/node-pty', 'better-sqlite3']) {
      writeFile(root, `node_modules/${mod}/package.json`, '{}')
    }
    const whisperDir = whisperAddonDirCandidates(process.platform, process.arch)[0]
    if (whisperDir) writeFile(root, `node_modules/@kutalia/whisper-node-addon/dist/${whisperDir}/whisper.node`, '')
    if (claude !== undefined) writeClaude(root, claude)
    if (sqlite) writeFile(root, SQLITE_REL, '')
    return root
  }

  function runCli(root) {
    const env = { ...process.env }
    delete env.VITEST // the script skips main() under vitest
    try {
      const stdout = execFileSync(process.execPath, [path.join(root, 'scripts', 'verify-native-modules.js')], {
        encoding: 'utf8', stdio: 'pipe', timeout: 30000, env,
      })
      return { code: 0, stdout, stderr: '' }
    } catch (err) {
      return { code: err.status, stdout: String(err.stdout), stderr: String(err.stderr) }
    }
  }

  const host = `${process.platform}-${process.arch}`
  const desktopHost = EMBEDDED_RUNTIME_REQUIRED_HOSTS.includes(host)
  const hostFormat = HOST_FORMAT[process.platform] ?? 'elf'

  it('exits 0 with a native claude and better_sqlite3.node', () => {
    const { code, stdout } = runCli(makeProject({ claude: fakeExecutable(hostFormat) }))
    expect(code).toBe(0)
    expect(stdout).toContain('embedded claude: native, better-sqlite3: .node present')
  })

  it.runIf(desktopHost)('exits 1 on the stub with an actionable message', () => {
    const { code, stderr } = runCli(makeProject({ claude: STUB }))
    expect(code).toBe(1)
    expect(stderr).toContain('Embedded claude (@anthropic-ai/claude-code) is not the native binary')
    expect(stderr).toContain('npm placeholder stub')
    expect(stderr).toContain('node node_modules/@anthropic-ai/claude-code/install.cjs')
    expect(stderr).toContain('本機開發：npm 12 install scripts（T0471）')
  })

  it.runIf(desktopHost)('exits 1 when better_sqlite3.node is missing', () => {
    const { code, stderr } = runCli(makeProject({ claude: fakeExecutable(hostFormat), sqlite: false }))
    expect(code).toBe(1)
    expect(stderr).toContain('better-sqlite3 is installed but its native module was never built')
    expect(stderr).toContain('npx electron-rebuild -f -w better-sqlite3')
  })
})
