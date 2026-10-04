// @vitest-environment node
// T0396 — scripts/smoke-remote-headless.mjs (PLAN-036 P0 protocol-level smoke)
// T0411 — S10 remote-tools:detect
// T0405 — S11 git / github / worktree

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { PROXIED_CHANNELS, PROXIED_EVENTS } from '../../electron/remote/protocol'
import { HEADLESS_UNSUPPORTED } from '../../electron/remote/headless-channel-status'
import {
  CHECKS,
  FRAME_FIELDS,
  FRAME_TYPE,
  NAME_RX,
  PtyTracker,
  GITHUB_CHECK_CLI_TIMEOUT_MS,
  REMOTE_TOOLS_DETECT_TIMEOUT_MS,
  SMOKE_CHANNELS,
  SMOKE_GIT_REPO_RX,
  SMOKE_GIT_REPO_TEMPLATE,
  SMOKE_EVENTS,
  UNSUPPORTED_ERROR_RX,
  UNSUPPORTED_PROBE_ARGS,
  UNSUPPORTED_PROBE_CHANNEL,
  UsageError,
  buildAuthFrame,
  buildInvokeFrame,
  checkClaudeRuntimeAnswers,
  checkGitAnswers,
  checkRemoteToolsAnswer,
  corruptFingerprint,
  decodeTokenFile,
  main,
  makeSmokeId,
  normalizeFingerprint,
  parseArgs,
  parseFingerprintField,
  parseUnitEnvironment,
  resolveWslTarget,
  runSmoke,
  stripAnsi,
  summarize,
} from '../smoke-remote-headless.mjs'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const readSource = (rel) => readFileSync(path.join(ROOT, rel), 'utf8')

const FP = '22:3A:E4:C7:4F:4F:7C:D1:23:09:11:A1:DB:62:CD:82:A9:31:66:95:48:D0:34:CD:6C:42:9C:B7:0A:D1:79:97'

// ---------------------------------------------------------------------------
// Drift guard against electron/remote/protocol.ts
// ---------------------------------------------------------------------------

describe('frame format drift guard (protocol.ts)', () => {
  const protocol = readSource('electron/remote/protocol.ts')

  it('FRAME_TYPE equals the RemoteFrameType union', () => {
    const union = /export type RemoteFrameType\s*=\s*([^\n]+)/.exec(protocol)
    expect(union).not.toBeNull()
    const types = [...union[1].matchAll(/'([^']+)'/g)].map((m) => m[1])
    expect(new Set(Object.values(FRAME_TYPE))).toEqual(new Set(types))
    expect(Object.values(FRAME_TYPE)).toHaveLength(types.length)
  })

  it('FRAME_FIELDS equals the RemoteFrame interface fields', () => {
    const body = /export interface RemoteFrame\s*\{([\s\S]*?)\n\}/.exec(protocol)
    expect(body).not.toBeNull()
    const fields = [...body[1].matchAll(/^\s*(\w+)\??\s*:/gm)].map((m) => m[1])
    expect([...FRAME_FIELDS].sort()).toEqual([...fields].sort())
  })

  it('built frames only use RemoteFrame fields and known frame types', () => {
    for (const frame of [buildAuthFrame('1', 'tok', 'label'), buildInvokeFrame('2', 'pty:kill', ['x'])]) {
      for (const key of Object.keys(frame)) expect(FRAME_FIELDS).toContain(key)
      expect(Object.values(FRAME_TYPE)).toContain(frame.type)
    }
  })

  it('every invoke channel / event the smoke uses is proxied', () => {
    for (const channel of Object.values(SMOKE_CHANNELS)) expect(PROXIED_CHANNELS.has(channel), channel).toBe(true)
    for (const event of Object.values(SMOKE_EVENTS)) expect(PROXIED_EVENTS.has(event), event).toBe(true)
  })

  it('S8 probe is a headless-unsupported channel; the channels S2-S7 / S9 / S10 call are not', () => {
    expect(PROXIED_CHANNELS.has(UNSUPPORTED_PROBE_CHANNEL)).toBe(true)
    expect(HEADLESS_UNSUPPORTED[UNSUPPORTED_PROBE_CHANNEL]).toBeDefined()
    expect(UNSUPPORTED_PROBE_ARGS).toEqual(['smoke-probe', 'read-only'])
    for (const channel of Object.values(SMOKE_CHANNELS)) expect(HEADLESS_UNSUPPORTED[channel], channel).toBeUndefined()
  })

  it('UNSUPPORTED_ERROR_RX matches the handler-registry error text', () => {
    const registry = readSource('electron/remote/handler-registry.ts')
    const template = /throw new Error\(`(No handler for channel: )\$\{channel\}`\)/.exec(registry)
    expect(template).not.toBeNull()
    expect(UNSUPPORTED_ERROR_RX.test(`${template[1]}claude:x`)).toBe(true)
  })

  it('auth frame carries token + label where remote-server.ts reads them', () => {
    const server = readSource('electron/remote/remote-server.ts')
    expect(server).toContain('this.isTokenAccepted(frame.token)')
    expect(server).toContain('frame.args?.[0]')
    const frame = buildAuthFrame('7', 'secret', 'smoke')
    expect(frame).toEqual({ type: 'auth', id: '7', token: 'secret', args: ['smoke'] })
  })
})

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

describe('parseArgs', () => {
  it('accepts --target wsl:<distro> with defaults', () => {
    const opts = parseArgs(['--target', 'wsl:Ubuntu-24.04'])
    expect(opts.target).toEqual({ kind: 'wsl', distro: 'Ubuntu-24.04', host: '127.0.0.1', port: null })
    expect(opts.json).toBe(false)
    expect(opts.timeoutMs).toBe(10_000)
    expect(opts.cwd).toBeNull()
  })

  it('accepts --host / --port / --json / --timeout-ms / --cwd for wsl', () => {
    const opts = parseArgs(['--target', 'wsl:Debian', '--host', 'localhost', '--port', '9877', '--json', '--timeout-ms', '5000', '--cwd', '/tmp/x'])
    expect(opts.target).toMatchObject({ host: 'localhost', port: 9877 })
    expect(opts).toMatchObject({ json: true, timeoutMs: 5000, cwd: '/tmp/x' })
  })

  it.each([
    'Ubuntu 24.04', 'Ubuntu;rm', 'a&b', '$(id)', 'x/y', '', 'Ubuntu"',
  ])('rejects distro %j (whitelist)', (distro) => {
    expect(() => parseArgs(['--target', `wsl:${distro}`])).toThrow(UsageError)
  })

  it('distro whitelist is /^[A-Za-z0-9._-]+$/', () => {
    expect(String(NAME_RX)).toBe('/^[A-Za-z0-9._-]+$/')
  })

  it('rejects unknown target kinds', () => {
    expect(() => parseArgs(['--target', 'ssh:host'])).toThrow(/Unsupported --target/)
  })

  it('accepts the direct --url form and normalizes the fingerprint', () => {
    const opts = parseArgs(['--url', 'wss://127.0.0.1:9877', '--token-file', 'tok.json', '--fingerprint', FP.replace(/:/g, '').toLowerCase()])
    expect(opts.target).toEqual({ kind: 'url', url: 'wss://127.0.0.1:9877', tokenFile: 'tok.json', fingerprint: FP })
  })

  it.each([
    [['--url', 'ws://h:1', '--token-file', 't', '--fingerprint', FP], /wss:\/\//],
    [['--url', 'wss://h', '--token-file', 't', '--fingerprint', FP], /explicit port/],
    [['--url', 'wss://h:1/path', '--token-file', 't', '--fingerprint', FP], /no path/],
    [['--url', 'wss://h:1', '--fingerprint', FP], /--token-file/],
    [['--url', 'wss://h:1', '--token-file', 't'], /--fingerprint/],
    [['--url', 'wss://h:1', '--token-file', 't', '--fingerprint', 'AB:CD'], /32 bytes/],
    [['--target', 'wsl:U', '--url', 'wss://h:1'], /exactly one/],
    [[], /exactly one/],
    [['--target', 'wsl:U', '--fingerprint', FP], /only apply to --url/],
    [['--url', 'wss://h:1', '--token-file', 't', '--fingerprint', FP, '--port', '2'], /only apply to --target/],
    [['--target', 'wsl:U', '--port', '70000'], /Invalid --port/],
    [['--target', 'wsl:U', '--port', '12a'], /Invalid --port/],
    [['--target', 'wsl:U', '--host', 'h;x'], /Invalid --host/],
    [['--target', 'wsl:U', '--timeout-ms', '10'], /Invalid --timeout-ms/],
    [['--target', 'wsl:U', '--cwd', 'relative'], /--cwd/],
    [['--target', 'wsl:U', '--cwd', '/a/../b'], /--cwd/],
    [['--target', 'wsl:U', '--bogus'], /Unknown option/],
  ])('rejects %j', (argv, message) => {
    expect(() => parseArgs(argv)).toThrow(message)
  })

  it('--help short-circuits validation', () => {
    expect(parseArgs(['-h']).help).toBe(true)
  })

  it('main returns 2 on usage errors and 0 on --help', async () => {
    const out = []
    const io = { out: (s) => out.push(s), err: (s) => out.push(s) }
    expect(await main(['--target', 'wsl:bad name'], io)).toBe(2)
    expect(await main(['--help'], io)).toBe(0)
    expect(out.join('\n')).toContain('Usage:')
  })
})

// ---------------------------------------------------------------------------
// Fingerprint / token / unit parsing
// ---------------------------------------------------------------------------

describe('normalizeFingerprint', () => {
  it('normalizes case, colons, whitespace and a sha256 prefix', () => {
    const bare = FP.replace(/:/g, '')
    expect(normalizeFingerprint(bare.toLowerCase())).toBe(FP)
    expect(normalizeFingerprint(`sha256:${FP.toLowerCase()}`)).toBe(FP)
    expect(normalizeFingerprint(` ${FP} `)).toBe(FP)
  })

  it('rejects wrong length and non-hex input', () => {
    expect(() => normalizeFingerprint(FP.slice(0, -3))).toThrow(/32 bytes/)
    expect(() => normalizeFingerprint(`${FP}:00`)).toThrow(/32 bytes/)
    expect(() => normalizeFingerprint(FP.replace('22', 'ZZ'))).toThrow(/non-hex/)
    expect(() => normalizeFingerprint(undefined)).toThrow()
  })

  it('corruptFingerprint always yields a different valid fingerprint', () => {
    expect(corruptFingerprint(FP)).not.toBe(FP)
    expect(normalizeFingerprint(corruptFingerprint(FP))).toBe(corruptFingerprint(FP))
    const zero = `00${FP.slice(2)}`
    expect(corruptFingerprint(zero)).not.toBe(zero)
  })
})

describe('decodeTokenFile', () => {
  it('reads the plaintext secrets.ts record, the legacy shape and a bare token', () => {
    expect(decodeTokenFile(JSON.stringify({ v: 1, encrypted: false, data: 'abcDEF123_-' }))).toBe('abcDEF123_-')
    expect(decodeTokenFile('{"token":"legacy-token"}')).toBe('legacy-token')
    expect(decodeTokenFile('  bare-token-123\n')).toBe('bare-token-123')
  })

  it('refuses encrypted, empty and garbage files', () => {
    expect(() => decodeTokenFile(JSON.stringify({ v: 1, encrypted: true, data: 'x' }))).toThrow(/encrypted/)
    expect(() => decodeTokenFile('')).toThrow(/empty/)
    expect(() => decodeTokenFile('{"v":1}')).toThrow(/no usable token/)
    expect(() => decodeTokenFile('not a token!')).toThrow(/neither JSON/)
  })
})

describe('parseUnitEnvironment / parseFingerprintField', () => {
  it('parses systemctl show Environment output, including quoted values', () => {
    expect(parseUnitEnvironment('BAT_PORT=9877 BAT_SERVER_PORT=9877 BAT_SERVER_DATA_DIR=/home/u/.local/share/bat-server\n')).toEqual({
      BAT_PORT: '9877',
      BAT_SERVER_PORT: '9877',
      BAT_SERVER_DATA_DIR: '/home/u/.local/share/bat-server',
    })
    expect(parseUnitEnvironment('A="x y" B=z')).toEqual({ A: 'x y', B: 'z' })
    expect(parseUnitEnvironment('')).toEqual({})
  })

  it('extracts only the fingerprint field', () => {
    expect(parseFingerprintField(`"fingerprint": "${FP.toLowerCase()}"\n`)).toBe(FP)
    expect(() => parseFingerprintField('"cert": "..."')).toThrow(/no fingerprint/)
  })
})

describe('resolveWslTarget (read-only, array args)', () => {
  const fakeExec = (responses) => {
    const calls = []
    const exec = async (args) => {
      calls.push(args)
      const key = args[0]
      const value = responses[key]
      if (value instanceof Error) throw value
      if (typeof value === 'function') return value(args)
      if (value === undefined) throw new Error(`unexpected ${key}`)
      return value
    }
    return { exec, calls }
  }

  it('uses the unit environment and reads only the fingerprint field', async () => {
    const { exec, calls } = fakeExec({
      systemctl: 'BAT_SERVER_PORT=9877 BAT_SERVER_DATA_DIR=/home/u/.local/share/bat-server\n',
      printenv: '/home/u\n',
      grep: `"fingerprint": "${FP}"\n`,
      cat: JSON.stringify({ v: 1, encrypted: false, data: 'tok-123456' }),
    })
    const conn = await resolveWslTarget({ kind: 'wsl', distro: 'Ubuntu-24.04', host: '127.0.0.1', port: null }, { exec })
    expect(conn).toMatchObject({ url: 'wss://127.0.0.1:9877', token: 'tok-123456', fingerprint: FP, cwd: '/home/u', label: 'wsl:Ubuntu-24.04', expectedServerEnv: 'wsl' })
    expect(calls).toEqual([
      ['systemctl', '--user', 'show', '-p', 'Environment', '--value', 'bat-server'],
      ['printenv', 'HOME'],
      ['grep', '-o', '-E', '"fingerprint"[[:space:]]*:[[:space:]]*"[0-9A-Fa-f:]+"', '/home/u/.local/share/bat-server/server-cert.json'],
      ['cat', '/home/u/.local/share/bat-server/server-token.json'],
    ])
    // server-cert.json (which holds the private key) is never cat'ed.
    expect(calls.some((a) => a[0] === 'cat' && a[1].endsWith('server-cert.json'))).toBe(false)
  })

  it('falls back to bat-server defaults without a unit and honours --port', async () => {
    const { exec } = fakeExec({
      systemctl: new Error('Unit bat-server.service could not be found'),
      printenv: '/home/u\n',
      grep: `"fingerprint":"${FP}"`,
      cat: '{"token":"legacy-token"}',
    })
    const noPort = await resolveWslTarget({ kind: 'wsl', distro: 'U', host: '127.0.0.1', port: null }, { exec })
    expect(noPort.url).toBe('wss://127.0.0.1:54321')
    expect(noPort.notes[0]).toMatch(/unavailable/)
    const withPort = await resolveWslTarget({ kind: 'wsl', distro: 'U', host: 'localhost', port: 9000 }, { exec })
    expect(withPort.url).toBe('wss://localhost:9000')
  })

  it('rejects a data dir with shell-special characters', async () => {
    const { exec } = fakeExec({
      systemctl: 'BAT_SERVER_DATA_DIR=/home/u/$(id)',
      printenv: '/home/u\n',
    })
    await expect(resolveWslTarget({ kind: 'wsl', distro: 'U', host: '127.0.0.1', port: null }, { exec })).rejects.toThrow(/POSIX path/)
  })
})

// ---------------------------------------------------------------------------
// Output tracking
// ---------------------------------------------------------------------------

describe('PtyTracker', () => {
  it('records only own ids and strips ANSI escapes', async () => {
    const tracker = new PtyTracker(new Set(['smoke-1']))
    tracker.handle('pty:output', ['user-terminal', 'SECRET user output'])
    tracker.handle('pty:output', ['smoke-1', '\x1b[1;32mhello\x1b[0m \x1b]0;title\x07world'])
    expect(tracker.buffers.has('user-terminal')).toBe(false)
    expect(tracker.since('smoke-1', 0)).toBe('hello world')
    await expect(tracker.waitForOutput('smoke-1', /hello (\w+)/, 0, 100)).resolves.toMatchObject({ 1: 'world' })
    await expect(tracker.waitForOutput('smoke-1', /nope/, 0, 50)).rejects.toThrow(/timed out/)
    tracker.handle('pty:exit', ['user-terminal', 0])
    tracker.handle('pty:exit', ['smoke-1', 0])
    expect([...tracker.exits.keys()]).toEqual(['smoke-1'])
  })

  it('stripAnsi leaves plain text untouched', () => {
    expect(stripAnsi('40 120\r\n')).toBe('40 120\r\n')
  })

  it('makeSmokeId uses the smoke- prefix and a timestamp', () => {
    expect(makeSmokeId(new Date(2026, 9, 5, 1, 2, 3), 'abcdef')).toBe('smoke-20261005010203-abcdef')
  })
})

// ---------------------------------------------------------------------------
// runSmoke against an in-memory fake server
// ---------------------------------------------------------------------------

/** Evaluates the handful of shell expansions the smoke types. */
function fakeShellEval(command, pty) {
  // T0405 S11: temp repo setup / removal lines
  const made = /echo (\S+)-s11-repo:\$d$/.exec(command.trim())
  if (made) return `${made[1]}-s11-repo:${FAKE_REPO}`
  const gone = /echo (\S+)-s11-gone-\$\(\(1\+1\)\)$/.exec(command.trim())
  if (gone) return `${gone[1]}-s11-gone-2`
  const echo = /^echo (.*)$/.exec(command.trim())
  if (!echo) return ''
  return echo[1]
    .replace(/\$\(\((\d+)([+*])(\d+)\)\)/g, (_, a, op, b) => String(op === '+' ? Number(a) + Number(b) : Number(a) * Number(b)))
    .replace(/\$\(stty size\)/g, `${pty.rows} ${pty.cols}`)
    .replace(/\$\$/g, String(pty.pid))
}

const CLI_PATH = '/home/u/.local/bat-server/node_modules/@anthropic-ai/claude-code/bin/claude'
const FAKE_REPO = '/tmp/bat-smoke-git.Ab12Cd'
const GH_NOT_LOGGED_IN = { installed: true, authenticated: false, authState: 'unauthenticated', path: '/usr/bin/gh', source: 'path', attemptedPaths: ['/usr/local/bin/gh', '/usr/bin/gh'] }

/** T0405: git channel answers for the S11 temp repo (`nonce` = the one smoke commit's message prefix). */
function gitAnswers(nonce) {
  return {
    root: FAKE_REPO,
    branch: 'master',
    log: [{ hash: 'a'.repeat(40), author: 'bat-smoke', date: '2026-10-05 04:00:00 +0800', message: `${nonce}-s11` }],
    status: [],
    health: { ok: true, isRepo: true, gitRoot: FAKE_REPO },
    worktree: null,
  }
}

/** T0411: `remote-tools:detect` answer of a WSL Ubuntu server (trimmed RemoteToolsDetectResult). */
function remoteToolsReport(overrides = {}) {
  return {
    ok: true,
    report: {
      schemaVersion: 1,
      env: { osFamily: 'linux', osId: 'ubuntu', osVersion: '24.04', arch: 'x86_64', musl: false, pkgManager: 'apt', privilege: 'passwordless', isWsl: true, hasTimeout: true, authEnv: {} },
      tools: [
        { id: 'claude', status: 'missing', login: 'n/a', serverVisible: false },
        { id: 'git', status: 'ok', path: '/usr/bin/git', version: '2.43.0', login: 'n/a', serverVisible: true },
      ],
      serverViewAvailable: true,
      warnings: [],
      ...overrides,
    },
  }
}

function createFakeServer({ legacyCreate = false, acceptWrongFingerprint = false, rejectCreate = false, firstKillFails = false, probeAnswers = false, probeHangs = false, preClaude = false, preRemoteTools = false, preGit = false, serverEnv = 'native' } = {}) {
  const ptys = new Map()
  const s11 = { nonce: null, repoRemoved: false }
  const clients = new Set()
  const log = []
  const probeArgs = []
  const invokeTimeouts = []
  let nextPid = 100
  let killCalls = 0
  const emit = (channel, ...args) => {
    for (const c of clients) if (c.isOpen) for (const l of c.listeners) l(channel, args)
  }
  const handlers = {
    'settings:get-shell-path': () => '/bin/bash',
    'pty:create': (opts) => {
      if (rejectCreate) return legacyCreate ? false : { ok: false, created: false }
      const created = !ptys.has(opts.id)
      if (created) {
        ptys.set(opts.id, { pid: nextPid++, rows: 30, cols: 120 })
        setTimeout(() => emit('pty:output', opts.id, '\x1b[?2004h$ '), 1)
      }
      return legacyCreate ? true : { ok: true, created }
    },
    'pty:write': (id, data) => {
      const pty = ptys.get(id)
      if (!pty) return { ok: false, reason: 'pty-not-found' }
      const made = /(\S+)-s11-repo:\$d/.exec(data)
      if (made) s11.nonce = made[1].split(' ').pop()
      if (data.includes('rm -rf -- "$d"')) s11.repoRemoved = true
      setTimeout(() => emit('pty:output', id, `${data}\r\n${fakeShellEval(data, pty)}\r\n$ `), 1)
      return { ok: true }
    },
    'pty:resize': (id, cols, rows) => {
      const pty = ptys.get(id)
      if (pty) Object.assign(pty, { cols, rows })
      return undefined
    },
    'pty:kill': (id) => {
      killCalls += 1
      if (firstKillFails && killCalls === 1) throw Object.assign(new Error('kill exploded'), { remote: true })
      if (!ptys.delete(id)) return false
      setTimeout(() => emit('pty:exit', id, 0), 1)
      return true
    },
    'pty:get-cwd': (id) => (ptys.has(id) ? '/home/u' : null),
    ...(preClaude ? {} : {
      'claude:get-cli-path': () => CLI_PATH,
      'claude:detectRuntime': () => ({
        embedded: { path: CLI_PATH, version: '2.1.289', versionRaw: '2.1.289 (Claude Code)', healthStatus: 'healthy' },
        system: null,
      }),
      'claude:auth-status': () => null,
    }),
    ...(preRemoteTools ? {} : { 'remote-tools:detect': () => remoteToolsReport() }),
    ...(preGit ? {} : {
      'github:check-cli': () => GH_NOT_LOGGED_IN,
      'git:getRoot': (cwd) => (cwd === FAKE_REPO ? FAKE_REPO : null),
      'git:branch': (cwd) => (cwd === FAKE_REPO ? 'master' : null),
      'git:log': (cwd) => (cwd === FAKE_REPO ? gitAnswers(s11.nonce).log : []),
      'git:status': () => [],
      'git-scaffold:healthCheck': (cwd) => (cwd === FAKE_REPO ? gitAnswers(s11.nonce).health : { ok: true, isRepo: false, gitRoot: null }),
      'worktree:status': () => null,
    }),
  }

  class FakeClient {
    constructor({ fingerprint }) {
      this.fingerprint = fingerprint
      this.listeners = new Set()
      this.isOpen = false
      this.authSent = false
      this.observedFingerprint = FP
    }
    onEvent(l) { this.listeners.add(l) }
    async connect() {
      if (this.fingerprint !== FP && !acceptWrongFingerprint) {
        throw Object.assign(new Error('fingerprint-mismatch: test'), { code: 'fingerprint-mismatch' })
      }
      this.isOpen = true
      this.authSent = true
      clients.add(this)
      log.push('connect')
      return { serverPlatform: 'linux', serverArch: 'x64', serverEnv, nodeVersion: '24', bundleVersion: 't' }
    }
    async close() {
      this.isOpen = false
      clients.delete(this)
      log.push('close')
    }
    async invoke(channel, ...args) {
      if (!this.isOpen) throw new Error('not connected')
      log.push(channel)
      if (channel === UNSUPPORTED_PROBE_CHANNEL) {
        probeArgs.push(args)
        if (probeAnswers) return []
        if (probeHangs) throw Object.assign(new Error('invoke timed out'), { timeout: true })
      }
      const handler = handlers[channel]
      if (!handler) throw Object.assign(new Error(`No handler for channel: ${channel}`), { remote: true })
      return handler(...args)
    }
    async invokeWithTimeout(timeoutMs, channel, ...args) {
      invokeTimeouts.push([channel, timeoutMs])
      return this.invoke(channel, ...args)
    }
  }

  const conn = { url: 'wss://fake:1', token: 'tok', fingerprint: FP, cwd: '/home/u' }
  const createClient = (overrides = {}) => new FakeClient({ fingerprint: overrides.fingerprint ?? FP })
  return { conn, createClient, ptys, log, handlers, probeArgs, invokeTimeouts, s11 }
}

describe('runSmoke (fake server)', () => {
  it('passes S1-S11 and leaves no smoke PTY behind', async () => {
    const fake = createFakeServer()
    const report = await runSmoke(fake.conn, { createClient: fake.createClient, timeoutMs: 500 })
    expect(report.checks.map((c) => `${c.id}:${c.status}`)).toEqual(CHECKS.map(([id]) => `${id}:PASS`))
    expect(report.cleanup).toMatchObject({ leftover: false, killedInCleanup: false })
    expect(report.ptyId).toMatch(/^smoke-\d{14}-[0-9a-f]{6}$/)
    expect(fake.ptys.size).toBe(0)
    expect(fake.log.filter((c) => c === 'pty:kill')).toHaveLength(2) // S7 + S11's own PTY
    // S6 really reconnected: two successful connects before the probe.
    expect(fake.log.filter((c) => c === 'connect').length).toBeGreaterThanOrEqual(2)
    expect(summarize(report)).toEqual({ ok: true, passed: 11, warned: 0, total: 11 })
    expect(fake.probeArgs).toEqual([['smoke-probe', 'read-only']])
    // S10 waits for the 20 s login-view probe, not the 500 ms default
    expect(fake.invokeTimeouts).toEqual([['remote-tools:detect', REMOTE_TOOLS_DETECT_TIMEOUT_MS], ['github:check-cli', GITHUB_CHECK_CLI_TIMEOUT_MS]])
    expect(report.checks.find((c) => c.id === 'S10').evidence).toMatch(/schema v1; ubuntu 24\.04 x86_64 pkg=apt .*git=ok@2\.43\.0/)
  })

  it('passes S1-S11 against a server before T0403 (pty:create answers a bare boolean)', async () => {
    const fake = createFakeServer({ legacyCreate: true })
    const report = await runSmoke(fake.conn, { createClient: fake.createClient, timeoutMs: 500 })
    expect(report.checks.map((c) => `${c.id}:${c.status}`)).toEqual(CHECKS.map(([id]) => `${id}:PASS`))
    expect(fake.ptys.size).toBe(0)
  })

  it('fails S5 when a T0403 server reports the re-sent pty:create as a new spawn', async () => {
    const fake = createFakeServer()
    const create = fake.handlers['pty:create']
    fake.handlers['pty:create'] = (opts) => ({ ...create(opts), created: true })
    const report = await runSmoke(fake.conn, { createClient: fake.createClient, timeoutMs: 500 })
    const status = Object.fromEntries(report.checks.map((c) => [c.id, c.status]))
    expect(status).toMatchObject({ S3: 'PASS', S5: 'FAIL' })
  })

  it('kills its PTY in cleanup when S7 fails to kill it', async () => {
    const fake = createFakeServer({ firstKillFails: true })
    const report = await runSmoke(fake.conn, { createClient: fake.createClient, timeoutMs: 300 })
    const status = Object.fromEntries(report.checks.map((c) => [c.id, c.status]))
    expect(status).toMatchObject({ S6: 'PASS', S7: 'FAIL', S8: 'PASS' })
    expect(report.cleanup).toMatchObject({ leftover: false, killedInCleanup: true })
    expect(fake.ptys.size).toBe(0)
    expect(summarize(report).ok).toBe(false)
  })

  it('skips S4-S7 when pty:create is refused and has nothing to clean up', async () => {
    const fake = createFakeServer({ rejectCreate: true })
    const report = await runSmoke(fake.conn, { createClient: fake.createClient, timeoutMs: 150 })
    const status = Object.fromEntries(report.checks.map((c) => [c.id, c.status]))
    expect(status).toEqual({ S1: 'PASS', S2: 'PASS', S3: 'FAIL', S4: 'SKIP', S5: 'SKIP', S6: 'SKIP', S7: 'SKIP', S8: 'PASS', S9: 'PASS', S10: 'PASS', S11: 'FAIL' })
    expect(report.cleanup).toMatchObject({ leftover: false, killedInCleanup: false })
    expect(fake.log).not.toContain('pty:kill')
  })

  it('T0404: S1 shows env= and WARNs (does not fail) when a WSL target reports another serverEnv', async () => {
    const fake = createFakeServer()
    const report = await runSmoke({ ...fake.conn, expectedServerEnv: 'wsl' }, { createClient: fake.createClient, timeoutMs: 500 })
    const s1 = report.checks.find((c) => c.id === 'S1')
    expect(s1.status).toBe('WARN')
    expect(s1.evidence).toMatch(/env=native but target is wsl/)
    expect(report.checks.filter((c) => c.id !== 'S1').every((c) => c.status === 'PASS')).toBe(true)
    expect(summarize(report)).toEqual({ ok: true, passed: 10, warned: 1, total: 11 })
  })

  it('T0404: S1 passes with env=wsl on a WSL target; non-WSL targets never WARN on env', async () => {
    const wsl = createFakeServer({ serverEnv: 'wsl' })
    const wslReport = await runSmoke({ ...wsl.conn, expectedServerEnv: 'wsl' }, { createClient: wsl.createClient, timeoutMs: 500 })
    expect(wslReport.checks[0]).toMatchObject({ id: 'S1', status: 'PASS' })
    expect(wslReport.checks[0].evidence).toMatch(/env=wsl/)

    const url = createFakeServer()
    const urlReport = await runSmoke(url.conn, { createClient: url.createClient, timeoutMs: 500 })
    expect(urlReport.checks[0]).toMatchObject({ id: 'S1', status: 'PASS' })
    expect(urlReport.checks[0].evidence).toMatch(/env=native/)
  })

  it('fails S1 and stops when a wrong fingerprint is accepted', async () => {
    const fake = createFakeServer({ acceptWrongFingerprint: true })
    const report = await runSmoke(fake.conn, { createClient: fake.createClient, timeoutMs: 150 })
    expect(report.checks[0]).toMatchObject({ id: 'S1', status: 'FAIL' })
    expect(report.checks[0].evidence).toMatch(/ACCEPTED/)
    expect(report.checks.slice(1).every((c) => c.status === 'SKIP')).toBe(true)
    expect(fake.ptys.size).toBe(0)
  })

  it('S9 fails, naming the cause, against a server before T0401 (claude:* not online)', async () => {
    const fake = createFakeServer({ preClaude: true })
    const report = await runSmoke(fake.conn, { createClient: fake.createClient, timeoutMs: 300 })
    const s9 = report.checks.find((c) => c.id === 'S9')
    expect(s9.status).toBe('FAIL')
    expect(s9.evidence).toMatch(/No handler for channel: claude:get-cli-path — server predates T0401/)
    expect(report.checks.filter((c) => c.id !== 'S9').every((c) => c.status === 'PASS')).toBe(true)
  })

  it('S10 fails, naming the cause, against a server before T0411 (remote-tools:detect not online)', async () => {
    const fake = createFakeServer({ preRemoteTools: true })
    const report = await runSmoke(fake.conn, { createClient: fake.createClient, timeoutMs: 300 })
    const s10 = report.checks.find((c) => c.id === 'S10')
    expect(s10.status).toBe('FAIL')
    expect(s10.evidence).toMatch(/No handler for channel: remote-tools:detect — server predates T0411/)
    expect(report.checks.filter((c) => c.id !== 'S10').every((c) => c.status === 'PASS')).toBe(true)
    expect(summarize(report).ok).toBe(false)
  })

  it('S10 fails when the probe reports an error or a non-linux / git-less host', async () => {
    const answers = [
      { ok: false, errorCode: 'timeout', error: 'probe timed out after 20000 ms' },
      remoteToolsReport({ schemaVersion: 2 }),
      remoteToolsReport({ env: { osFamily: 'darwin', pkgManager: 'brew', privilege: 'password-required', isWsl: false } }),
      remoteToolsReport({ tools: [{ id: 'git', status: 'missing', login: 'n/a', serverVisible: false }] }),
    ]
    for (const answer of answers) {
      const fake = createFakeServer()
      fake.handlers['remote-tools:detect'] = () => answer
      const report = await runSmoke(fake.conn, { createClient: fake.createClient, timeoutMs: 300 })
      expect(report.checks.find((c) => c.id === 'S10').status, JSON.stringify(answer)).toBe('FAIL')
    }
  })

  it('S11 creates a /tmp temp repo through its own PTY, removes it and kills that PTY', async () => {
    const fake = createFakeServer()
    const report = await runSmoke(fake.conn, { createClient: fake.createClient, timeoutMs: 500 })
    const s11 = report.checks.find((c) => c.id === 'S11')
    expect(s11.status).toBe('PASS')
    expect(s11.evidence).toMatch(/authenticated=false authState=unauthenticated/)
    expect(s11.evidence).toContain(`temp repo ${FAKE_REPO}`)
    expect(s11.evidence).toMatch(/temp repo removed$/)
    expect(fake.s11.repoRemoved).toBe(true)
    expect(fake.ptys.size).toBe(0)
    expect(report.cleanup.evidence).toContain(`pty:write(${report.ptyId}-git)`)
    expect(report.cleanup.leftover).toBe(false)
    // gh auth status is a network round trip: S11 waits longer than the default
    expect(fake.invokeTimeouts).toContainEqual(['github:check-cli', 20_000])
  })

  it('S11 fails, naming the cause, against a server before T0405 — and creates no repo / PTY', async () => {
    const fake = createFakeServer({ preGit: true })
    const report = await runSmoke(fake.conn, { createClient: fake.createClient, timeoutMs: 300 })
    const s11 = report.checks.find((c) => c.id === 'S11')
    expect(s11.status).toBe('FAIL')
    expect(s11.evidence).toMatch(/No handler for channel: github:check-cli — server predates T0405/)
    expect(fake.log.filter((c) => c === 'pty:create')).toHaveLength(2) // S3 + S5 only
    expect(report.checks.filter((c) => c.id !== 'S11').every((c) => c.status === 'PASS')).toBe(true)
    expect(summarize(report).ok).toBe(false)
  })

  it('S11 fails when gh is missing or a git channel answers wrong, and still cleans up', async () => {
    const breakages = [
      (h) => { h['github:check-cli'] = () => ({ installed: false, authenticated: false, attemptedPaths: [] }) },
      (h) => { h['git:log'] = () => [] },
      (h) => { h['git:status'] = () => [{ status: '??', file: 'x' }] },
    ]
    for (const breakIt of breakages) {
      const fake = createFakeServer()
      breakIt(fake.handlers)
      const report = await runSmoke(fake.conn, { createClient: fake.createClient, timeoutMs: 300 })
      expect(report.checks.find((c) => c.id === 'S11').status).toBe('FAIL')
      expect(fake.s11.repoRemoved).toBe(true)
      expect(fake.ptys.size).toBe(0)
    }
  })

  it('S8 fails on an answer or a timeout instead of an explicit error', async () => {
    for (const option of [{ probeAnswers: true }, { probeHangs: true }]) {
      const fake = createFakeServer(option)
      const report = await runSmoke(fake.conn, { createClient: fake.createClient, timeoutMs: 300 })
      expect(report.checks.find((c) => c.id === 'S8').status).toBe('FAIL')
    }
  })
})

describe('checkClaudeRuntimeAnswers (S9, T0401)', () => {
  const healthy = { embedded: { path: CLI_PATH, version: '2.1.289', healthStatus: 'healthy' }, system: null }

  it('accepts the bundle claude with no login (auth-status null)', () => {
    const outcome = checkClaudeRuntimeAnswers({ cliPath: CLI_PATH, runtime: healthy, auth: null })
    expect(outcome.ok).toBe(true)
    expect(outcome.evidence).toContain(`get-cli-path → ${CLI_PATH}`)
    expect(outcome.evidence).toContain('auth-status → null')
  })

  it('accepts a logged-in / logged-out status object', () => {
    for (const loggedIn of [true, false]) {
      expect(checkClaudeRuntimeAnswers({ cliPath: CLI_PATH, runtime: healthy, auth: { loggedIn, authMethod: 'none' } }).ok).toBe(true)
    }
  })

  it('rejects an empty cli path, a broken embedded claude, or a malformed auth status', () => {
    expect(checkClaudeRuntimeAnswers({ cliPath: '', runtime: healthy, auth: null }).ok).toBe(false)
    expect(checkClaudeRuntimeAnswers({ cliPath: 'C:\\claude.exe', runtime: healthy, auth: null }).ok).toBe(false)
    const broken = { embedded: { path: CLI_PATH, version: 'unknown', healthStatus: 'spawn-failed' }, system: null }
    expect(checkClaudeRuntimeAnswers({ cliPath: CLI_PATH, runtime: broken, auth: null }).evidence).toMatch(/spawn-failed/)
    expect(checkClaudeRuntimeAnswers({ cliPath: CLI_PATH, runtime: null, auth: null }).ok).toBe(false)
    expect(checkClaudeRuntimeAnswers({ cliPath: CLI_PATH, runtime: healthy, auth: 'yes' }).ok).toBe(false)
  })
})

describe('checkGitAnswers (S11, T0405)', () => {
  const ok = (overrides = {}) => checkGitAnswers({ repo: FAKE_REPO, nonce: 'n1', gh: GH_NOT_LOGGED_IN, ...gitAnswers('n1'), ...overrides })

  it('accepts an installed, not logged-in gh and the temp repo answers', () => {
    const outcome = ok()
    expect(outcome.ok).toBe(true)
    expect(outcome.evidence).toContain('github:check-cli → installed /usr/bin/gh (path), authenticated=false authState=unauthenticated')
    expect(outcome.evidence).toContain('branch master, log 1 commit aaaaaaa, status clean')
  })

  it('a logged-in gh passes too (authenticated is reported, not required to be false)', () => {
    expect(ok({ gh: { ...GH_NOT_LOGGED_IN, authenticated: true, authState: 'authenticated' } }).ok).toBe(true)
  })

  it('rejects each wrong answer by name', () => {
    expect(ok({ gh: { installed: false, authenticated: false } }).evidence).toMatch(/github:check-cli/)
    expect(ok({ gh: { installed: true } }).evidence).toMatch(/github:check-cli/)
    expect(ok({ root: null }).evidence).toMatch(/git:getRoot → null/)
    expect(ok({ branch: null }).evidence).toMatch(/git:branch → null/)
    expect(ok({ log: [{ message: 'other' }] }).evidence).toMatch(/git:log/)
    expect(ok({ status: [{ status: 'M', file: 'a' }] }).evidence).toMatch(/git:status/)
    expect(ok({ health: { ok: true, isRepo: false, gitRoot: null } }).evidence).toMatch(/git-scaffold:healthCheck/)
    expect(ok({ worktree: { diff: '' } }).evidence).toMatch(/worktree:status/)
  })

  it('the temp repo pattern only matches what mktemp makes from the template', () => {
    expect(SMOKE_GIT_REPO_TEMPLATE).toBe('/tmp/bat-smoke-git.XXXXXX')
    expect(SMOKE_GIT_REPO_RX.test(FAKE_REPO)).toBe(true)
    for (const bad of ['/tmp', '/tmp/', '/home/u/repo', '/tmp/bat-smoke-git.', '/tmp/bat-smoke-git.a/..', '/tmp/bat-smoke-git.a b']) {
      expect(SMOKE_GIT_REPO_RX.test(bad), bad).toBe(false)
    }
  })
})

describe('checkRemoteToolsAnswer (S10, T0411)', () => {
  it('accepts a schema v1 linux report with git ok', () => {
    const outcome = checkRemoteToolsAnswer(remoteToolsReport())
    expect(outcome.ok).toBe(true)
    expect(outcome.evidence).toContain('claude=missing git=ok@2.43.0')
    expect(outcome.evidence).toContain('wsl=true')
  })

  it('rejects non-objects, error results and each failed expectation by name', () => {
    expect(checkRemoteToolsAnswer(null).ok).toBe(false)
    expect(checkRemoteToolsAnswer({ ok: false, errorCode: 'no-markers', error: 'x' }).evidence).toMatch(/errorCode=no-markers/)
    expect(checkRemoteToolsAnswer(remoteToolsReport({ schemaVersion: 2 })).evidence).toMatch(/schemaVersion=2/)
    expect(checkRemoteToolsAnswer(remoteToolsReport({ env: { osFamily: 'darwin' } })).evidence).toMatch(/osFamily=darwin/)
    expect(checkRemoteToolsAnswer(remoteToolsReport({ tools: [] })).evidence).toMatch(/git status=absent/)
  })
})
