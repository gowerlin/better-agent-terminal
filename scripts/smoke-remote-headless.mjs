#!/usr/bin/env node

/**
 * T0396 (PLAN-036 P0) — protocol-level smoke test against a RUNNING headless
 * bat-server. Connects as an ordinary remote client (TLS + SHA-256 fingerprint
 * pinning + token auth), walks the PTY lifecycle (S1-S8), the login-free
 * claude:* runtime channels (S9, T0401), the remote toolchain probe
 * (S10, T0411), the git / github / worktree channels (S11, T0405), the
 * fs sandbox fed by workspace:sync-roots (S12, T0406) and the remote Tower
 * helper env + helper capability path (S13, T0434).
 *
 *   node scripts/smoke-remote-headless.mjs --target wsl:Ubuntu-24.04
 *   node scripts/smoke-remote-headless.mjs --target wsl:Ubuntu-24.04 --json
 *   node scripts/smoke-remote-headless.mjs --url wss://127.0.0.1:9877 \
 *     --token-file ./server-token.json --fingerprint 22:3A:E4:...
 *
 * Exit code: 0 = every check PASS (WARN, and SKIP because the server is too
 * old for a check, are reported but tolerated), 1 = at least one FAIL / other
 * SKIP or leftover smoke PTY, 2 = bad arguments / connection info could not be
 * resolved.
 *
 * Ground rules (the server may be serving a real user at the same time):
 *   - client only: never restarts / stops / redeploys the server, and the
 *     wsl:<distro> target only READS the unit environment, the certificate
 *     fingerprint (just that field — the private key is never read) and the
 *     token file;
 *   - only touches PTYs it created itself (`smoke-<timestamp>-<rand>` ids) and
 *     kills all of them on every exit path; output of other PTYs (events are
 *     broadcast to every client) is ignored, never recorded;
 *   - S11 writes git state only in a repo it creates itself with
 *     `mktemp -d /tmp/bat-smoke-git.XXXXXX` (through its own smoke PTY) and
 *     removes it again; the user's repos are never touched;
 *   - S12 reads files only in a directory it creates itself with
 *     `mktemp -d /tmp/bat-smoke-fs.XXXXXX` (through its own smoke PTY), syncs
 *     roots only for its own connection (cleared again; the server also drops
 *     them when the connection closes) and removes the directory;
 *   - S13 runs bat-terminal inside its own smoke PTY with that PTY's helper env:
 *     the server token is only ever typed as its sha256; one run asks for a raw
 *     command (must be Forbidden), one for an agent no server registers
 *     (T0450+: Forbidden agent-not-allowed; before: authorized, nothing created)
 *     — no agent is ever started on the server;
 *   - never sends a wrong token: the server bans an IP after 5 failed auths and
 *     the user's own BAT client connects from the same loopback address. The
 *     negative check uses a wrong FINGERPRINT, which is rejected client-side
 *     before the auth frame (and the token) is sent.
 *
 * `electron/remote/remote-client.ts` imports `electron`, so the frame format of
 * `electron/remote/protocol.ts` is re-implemented here with `ws`;
 * scripts/__tests__/smoke-remote-headless.test.mjs guards it against drift.
 */

import { createHash, randomBytes } from 'node:crypto'
import { execFile } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { parseArgs as parseNodeArgs } from 'node:util'

import { WebSocket } from 'ws'

// ---------------------------------------------------------------------------
// protocol.ts mirror (drift-guarded by the unit test)
// ---------------------------------------------------------------------------

/** `RemoteFrameType` in electron/remote/protocol.ts. */
export const FRAME_TYPE = Object.freeze({
  INVOKE: 'invoke',
  INVOKE_RESULT: 'invoke-result',
  INVOKE_ERROR: 'invoke-error',
  EVENT: 'event',
  AUTH: 'auth',
  AUTH_RESULT: 'auth-result',
  PING: 'ping',
  PONG: 'pong',
})

/** Field names of `RemoteFrame` in electron/remote/protocol.ts. */
export const FRAME_FIELDS = Object.freeze(['type', 'id', 'channel', 'args', 'result', 'error', 'token'])

/** Invoke channels this smoke calls; every one must be in PROXIED_CHANNELS. */
export const SMOKE_CHANNELS = Object.freeze({
  SHELL_PATH: 'settings:get-shell-path',
  PTY_CREATE: 'pty:create',
  PTY_WRITE: 'pty:write',
  PTY_RESIZE: 'pty:resize',
  PTY_KILL: 'pty:kill',
  PTY_GET_CWD: 'pty:get-cwd',
  // T0401: claude:* runtime channels that need no login (S9)
  CLAUDE_CLI_PATH: 'claude:get-cli-path',
  CLAUDE_DETECT_RUNTIME: 'claude:detectRuntime',
  CLAUDE_AUTH_STATUS: 'claude:auth-status',
  // T0411: remote AI toolchain probe (S10)
  REMOTE_TOOLS_DETECT: 'remote-tools:detect',
  // T0405: git / github / worktree (S11) — read-only calls against the smoke's own temp repo
  GITHUB_CHECK_CLI: 'github:check-cli',
  GIT_GET_ROOT: 'git:getRoot',
  GIT_BRANCH: 'git:branch',
  GIT_LOG: 'git:log',
  GIT_STATUS: 'git:status',
  GIT_SCAFFOLD_HEALTH: 'git-scaffold:healthCheck',
  WORKTREE_STATUS: 'worktree:status',
  // T0406: fs sandbox (S12) — reads only the smoke's own temp dir; /etc must stay denied
  WORKSPACE_SYNC_ROOTS: 'workspace:sync-roots',
  FS_READDIR: 'fs:readdir',
  FS_READ_FILE: 'fs:readFile',
  FS_STAT: 'fs:stat',
})

/** S11 (T0405): template of the temp repo the smoke creates on the server — and the only path it removes. */
export const SMOKE_GIT_REPO_TEMPLATE = '/tmp/bat-smoke-git.XXXXXX'
export const SMOKE_GIT_REPO_RX = /^\/tmp\/bat-smoke-git\.[A-Za-z0-9]+$/
/** S12 (T0406): template of the temp dir the smoke creates on the server — and the only path it removes. */
export const SMOKE_FS_DIR_TEMPLATE = '/tmp/bat-smoke-fs.XXXXXX'
export const SMOKE_FS_DIR_RX = /^\/tmp\/bat-smoke-fs\.[A-Za-z0-9]+$/
/** S12: a directory / file outside every synced root that must stay denied. */
export const SMOKE_FS_OUTSIDE_DIR = '/etc'
export const SMOKE_FS_OUTSIDE_FILE = '/etc/hostname'
/** Answer of a denied `fs:readFile` (electron/handlers/fs.ts). */
export const FS_DENIED = Object.freeze({ error: 'Path access denied' })

/** S11: `github:check-cli` runs `gh auth status` (network, 10 s server-side limit). */
export const GITHUB_CHECK_CLI_TIMEOUT_MS = 20_000

/**
 * S10 invoke timeout: the server runs the login-view probe (20 s limit, `-l -i` loads the
 * user's rc files) in parallel with the server-view probe, so the default 10 s is too short.
 */
export const REMOTE_TOOLS_DETECT_TIMEOUT_MS = 30_000

/**
 * S13 (T0434, PLAN-036 K): `BAT_*` keys of a remote Tower tab once T0433 injects the helper
 * env (`buildHeadlessHelperEnv` + PtyManager); a Worker tab additionally has `BAT_TOWER_TERMINAL_ID`.
 * T0456: `BAT_HELPER_NODE` (`<installRoot>/bin/node`, which every server bundle ships).
 */
export const REMOTE_TOWER_ENV_KEYS = Object.freeze([
  'BAT_HELPER_DIR',
  'BAT_HELPER_LOG_DIR',
  'BAT_HELPER_NODE',
  'BAT_REMOTE_PORT',
  'BAT_REMOTE_TOKEN',
  'BAT_SERVER_CERT_PATH',
  'BAT_SESSION',
  'BAT_TERMINAL_ID',
  'BAT_WORKSPACE_ID',
])
/** S13: keys whose absence means "no helper env at all" — a server before T0433, or its `<installRoot>/scripts` helpers missing. */
const HELPER_ENV_MARKER_KEYS = Object.freeze(['BAT_HELPER_DIR', 'BAT_REMOTE_PORT', 'BAT_REMOTE_TOKEN'])
/**
 * S13: length of a helper capability (electron/remote/helper-capability.ts): `randomBytes(32)` as
 * base64url = 43 chars (T0432-T0448), `batcap.` + 43 = 50 chars since T0449.
 */
export const HELPER_CAPABILITY_LENGTHS = Object.freeze([43, 50])
/**
 * S13 agent probe: an agent id no server registers, so no agent is ever started on the server.
 * The capability's role check comes first (a wrong role is `role-not-allowed`); then a server
 * since T0450 refuses the unknown agent (`Forbidden: agent-not-allowed`), while T0433-T0449
 * servers authorize it and create nothing (no launch command). Either proves the helper →
 * capability (tower role) → create-agent-command path.
 */
export const S13_PROBE_AGENT = 'bat-smoke-unregistered-agent'
/** S13: node + TLS + 3 s helper invoke timeout, plus the shell. */
export const HELPER_PROBE_TIMEOUT_MS = 20_000
/** Check status reason: the server is too old for the check; reported as SKIP, does not fail the run. */
export const SERVER_TOO_OLD = 'server-too-old'
/** S13: what a helper prints when its capability / connection is refused (never expected in S13). */
const HELPER_REFUSED_RX = /Forbidden|Authentication failed|Cannot connect|Invalid token|Capability revoked|fingerprint-mismatch/

/** Events this smoke listens to; every one must be in PROXIED_EVENTS. */
export const SMOKE_EVENTS = Object.freeze({
  PTY_OUTPUT: 'pty:output',
  PTY_EXIT: 'pty:exit',
})

/**
 * S8 probe: a channel in HEADLESS_UNSUPPORTED. T0401: `claude:set-codex-sandbox-mode` stays
 * unsupported for good (the server bundle has no codex), and is unsupported on older servers too.
 * Harmless if it ever answered: an unknown session id is a no-op.
 */
export const UNSUPPORTED_PROBE_CHANNEL = 'claude:set-codex-sandbox-mode'
export const UNSUPPORTED_PROBE_ARGS = Object.freeze(['smoke-probe', 'read-only'])

/** Error text of handler-registry.ts `invokeHandler` for an unregistered channel. */
export const UNSUPPORTED_ERROR_RX = /No handler for channel: (\S+)/

export function buildAuthFrame(id, token, label) {
  return { type: FRAME_TYPE.AUTH, id, token, args: [label] }
}

export function buildInvokeFrame(id, channel, args) {
  return { type: FRAME_TYPE.INVOKE, id, channel, args }
}

// ---------------------------------------------------------------------------
// Arguments / connection info
// ---------------------------------------------------------------------------

export const NAME_RX = /^[A-Za-z0-9._-]+$/
const HOST_RX = /^[A-Za-z0-9.-]+$/
const POSIX_PATH_RX = /^\/[A-Za-z0-9._/ -]*$/
const FINGERPRINT_BYTES = 32
export const DEFAULT_TIMEOUT_MS = 10_000
export const DEFAULT_HOST = '127.0.0.1'
/** bat-server's default when neither --port nor BAT_SERVER_PORT is set (scripts/bat-server.mjs). */
export const BAT_SERVER_DEFAULT_PORT = 54321
export const WSL_SERVICE_NAME = 'bat-server'
const WSL_EXEC_TIMEOUT_MS = 15_000
const SMOKE_ID_PREFIX = 'smoke-'

const USAGE = `Usage: node scripts/smoke-remote-headless.mjs (--target wsl:<distro> | --url wss://host:port --token-file <path> --fingerprint <sha256>) [options]

  --target wsl:<distro>   Read port / token / certificate fingerprint from the WSL distro (read-only)
  --host <host>           wsl target: host to connect to (default ${DEFAULT_HOST})
  --port <port>           wsl target: override the port from the ${WSL_SERVICE_NAME} unit environment
  --url wss://host:port   Connect directly (SSH tunnel / Docker / any reachable server)
  --token-file <path>     direct target: server-token.json (plaintext record) or a raw token file
  --fingerprint <sha256>  direct target: expected certificate SHA-256 (any case, colons optional)
  --cwd <posix path>      Working directory for the smoke PTY (default: wsl $HOME, else /tmp)
  --timeout-ms <ms>       Per-step timeout (default ${DEFAULT_TIMEOUT_MS})
  --json                  Machine-readable output
  -h, --help              Show this help

Exit code: 0 = all checks PASS, 1 = a check failed / smoke PTY left behind, 2 = usage or setup error.`

export class UsageError extends Error {}

/**
 * Upper-case colon-separated hex, same rendering as certificate.ts /
 * remote-client.ts normalizeFingerprint. Throws unless it is exactly 32 bytes.
 */
export function normalizeFingerprint(raw) {
  if (typeof raw !== 'string') throw new UsageError('fingerprint must be a string')
  const trimmed = raw.trim().replace(/^sha256[:=]/i, '')
  if (!/^[0-9A-Fa-f:\s]+$/.test(trimmed)) {
    throw new UsageError(`fingerprint contains non-hex characters: ${JSON.stringify(raw)}`)
  }
  const hex = trimmed.replace(/[^0-9A-Fa-f]/g, '').toUpperCase()
  if (hex.length !== FINGERPRINT_BYTES * 2) {
    throw new UsageError(`fingerprint must be ${FINGERPRINT_BYTES} bytes of SHA-256, got ${hex.length / 2}`)
  }
  return hex.match(/.{2}/g).join(':')
}

export function parseTarget(value) {
  if (!value) throw new UsageError('Missing value for --target (expected wsl:<distro>)')
  if (value.startsWith('wsl:')) {
    const distro = value.slice('wsl:'.length)
    if (!NAME_RX.test(distro)) {
      throw new UsageError(`Invalid WSL distro name ${JSON.stringify(distro)} (allowed: ${NAME_RX})`)
    }
    return { kind: 'wsl', distro }
  }
  throw new UsageError(`Unsupported --target ${JSON.stringify(value)} (expected wsl:<distro>; use --url for other servers)`)
}

function parsePort(raw, flag) {
  if (!/^\d+$/.test(String(raw))) throw new UsageError(`Invalid ${flag} value: ${raw}`)
  const port = Number.parseInt(String(raw), 10)
  if (port < 1 || port > 65535) throw new UsageError(`Invalid ${flag} value: ${raw}`)
  return port
}

export function parseServerUrl(raw) {
  let url
  try {
    url = new URL(raw)
  } catch {
    throw new UsageError(`Invalid --url ${JSON.stringify(raw)}`)
  }
  if (url.protocol !== 'wss:') throw new UsageError(`--url must use wss:// (got ${url.protocol}//)`)
  if (!url.port) throw new UsageError('--url must include an explicit port (wss://host:port)')
  if (url.pathname !== '/' || url.search || url.hash || url.username || url.password) {
    throw new UsageError('--url must be wss://host:port with no path, query or credentials')
  }
  return `wss://${url.host}`
}

export function parseArgs(argv) {
  let values
  try {
    ;({ values } = parseNodeArgs({
      args: argv,
      strict: true,
      allowPositionals: false,
      options: {
        target: { type: 'string' },
        url: { type: 'string' },
        'token-file': { type: 'string' },
        fingerprint: { type: 'string' },
        host: { type: 'string' },
        port: { type: 'string' },
        cwd: { type: 'string' },
        'timeout-ms': { type: 'string' },
        json: { type: 'boolean', default: false },
        help: { type: 'boolean', short: 'h', default: false },
      },
    }))
  } catch (error) {
    throw new UsageError(error instanceof Error ? error.message : String(error))
  }

  const opts = { help: values.help, json: values.json, timeoutMs: DEFAULT_TIMEOUT_MS, cwd: null, target: null }
  if (opts.help) return opts

  if (values['timeout-ms'] !== undefined) {
    const ms = /^\d+$/.test(values['timeout-ms']) ? Number.parseInt(values['timeout-ms'], 10) : NaN
    if (!Number.isInteger(ms) || ms < 100) throw new UsageError(`Invalid --timeout-ms value: ${values['timeout-ms']}`)
    opts.timeoutMs = ms
  }
  if (values.cwd !== undefined) {
    if (!POSIX_PATH_RX.test(values.cwd) || values.cwd.split('/').includes('..')) {
      throw new UsageError(`--cwd must be an absolute POSIX path without special characters: ${JSON.stringify(values.cwd)}`)
    }
    opts.cwd = values.cwd
  }

  const hasTarget = values.target !== undefined
  const hasUrl = values.url !== undefined
  if (hasTarget === hasUrl) throw new UsageError('Specify exactly one of --target wsl:<distro> or --url wss://host:port')

  if (hasTarget) {
    if (values['token-file'] !== undefined || values.fingerprint !== undefined) {
      throw new UsageError('--token-file / --fingerprint only apply to --url (wsl targets read them from the distro)')
    }
    const target = parseTarget(values.target)
    const host = values.host ?? DEFAULT_HOST
    if (!HOST_RX.test(host)) throw new UsageError(`Invalid --host ${JSON.stringify(host)}`)
    opts.target = { ...target, host, port: values.port !== undefined ? parsePort(values.port, '--port') : null }
    return opts
  }

  if (values.host !== undefined || values.port !== undefined) {
    throw new UsageError('--host / --port only apply to --target (put them in --url instead)')
  }
  if (!values['token-file']) throw new UsageError('--url requires --token-file')
  if (!values.fingerprint) throw new UsageError('--url requires --fingerprint')
  opts.target = {
    kind: 'url',
    url: parseServerUrl(values.url),
    tokenFile: values['token-file'],
    fingerprint: normalizeFingerprint(values.fingerprint),
  }
  return opts
}

/**
 * Token from a server-token.json record (secrets.ts layout), the legacy
 * `{ token }` shape, or a bare token string.
 */
export function decodeTokenFile(raw) {
  const text = String(raw ?? '').trim()
  if (!text) throw new Error('token file is empty')
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    parsed = undefined
  }
  if (parsed !== undefined) {
    if (parsed && typeof parsed === 'object') {
      if (typeof parsed.token === 'string' && parsed.token) return parsed.token
      if (parsed.encrypted === true) {
        throw new Error('token file is encrypted (safeStorage); pass a plaintext token with --url/--token-file')
      }
      if (parsed.encrypted === false && typeof parsed.data === 'string' && parsed.data) return parsed.data
    }
    throw new Error('token file JSON has no usable token')
  }
  if (!/^[A-Za-z0-9._~+/=-]{8,}$/.test(text)) throw new Error('token file is neither JSON nor a bare token')
  return text
}

/** `systemctl show -p Environment --value` → { KEY: value }. */
export function parseUnitEnvironment(raw) {
  const env = {}
  const rx = /([A-Za-z_][A-Za-z0-9_]*)=("(?:[^"\\]|\\.)*"|\S*)/g
  for (const match of String(raw ?? '').matchAll(rx)) {
    let value = match[2]
    if (value.startsWith('"')) value = value.slice(1, -1).replace(/\\(.)/g, '$1')
    env[match[1]] = value
  }
  return env
}

/** grep -o output of server-cert.json → normalized fingerprint (only that field is ever read). */
export function parseFingerprintField(raw) {
  const match = /"fingerprint"\s*:\s*"([0-9A-Fa-f:]+)"/.exec(String(raw ?? ''))
  if (!match) throw new Error('server-cert.json has no fingerprint field')
  return normalizeFingerprint(match[1])
}

function wslExecFile(distro, args) {
  if (!NAME_RX.test(distro)) return Promise.reject(new Error(`Invalid WSL distro name "${distro}"`))
  return new Promise((resolve, reject) => {
    execFile(
      'wsl.exe',
      ['-d', distro, '--exec', ...args],
      { encoding: 'utf8', timeout: WSL_EXEC_TIMEOUT_MS, windowsHide: true, maxBuffer: 256 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          error.message = `wsl.exe ${args[0]} failed: ${String(stderr || error.message).trim()}`
          reject(error)
        } else {
          resolve(stdout)
        }
      },
    )
  })
}

function assertPosixPath(value, label) {
  if (typeof value !== 'string' || !POSIX_PATH_RX.test(value) || value.split('/').includes('..')) {
    throw new Error(`${label} is not a plain absolute POSIX path: ${JSON.stringify(value)}`)
  }
  return value.replace(/\/+$/, '') || '/'
}

/**
 * Read-only connection info for the bat-server in a WSL distro: the user unit's
 * Environment (BAT_SERVER_PORT / BAT_SERVER_DATA_DIR, as scripts/bat-server.mjs
 * reads them), the certificate fingerprint field and the token file.
 */
export async function resolveWslTarget(target, { exec } = {}) {
  const run = exec ?? ((args) => wslExecFile(target.distro, args))

  let unitEnv = {}
  let unitNote = 'unit environment read'
  try {
    unitEnv = parseUnitEnvironment(await run(['systemctl', '--user', 'show', '-p', 'Environment', '--value', WSL_SERVICE_NAME]))
  } catch (error) {
    unitNote = `unit environment unavailable (${error instanceof Error ? error.message : String(error)}); using defaults`
  }

  const home = assertPosixPath((await run(['printenv', 'HOME'])).trim(), 'WSL $HOME')
  const dataDir = assertPosixPath(
    unitEnv.BAT_SERVER_DATA_DIR || `${unitEnv.XDG_DATA_HOME || `${home}/.local/share`}/bat-server`,
    'bat-server data dir',
  )
  const port = target.port ?? (unitEnv.BAT_SERVER_PORT ? parsePort(unitEnv.BAT_SERVER_PORT, 'BAT_SERVER_PORT') : BAT_SERVER_DEFAULT_PORT)

  const fingerprint = parseFingerprintField(
    await run(['grep', '-o', '-E', '"fingerprint"[[:space:]]*:[[:space:]]*"[0-9A-Fa-f:]+"', `${dataDir}/server-cert.json`]),
  )
  const token = decodeTokenFile(await run(['cat', `${dataDir}/server-token.json`]))

  return {
    label: `wsl:${target.distro}`,
    url: `wss://${target.host}:${port}`,
    token,
    fingerprint,
    cwd: home,
    // T0404 (BUG-103): S1 flags a WSL server that does not report serverEnv=wsl.
    expectedServerEnv: 'wsl',
    notes: [unitNote, `data dir ${dataDir}`, `port ${port}${target.port ? ' (--port)' : unitEnv.BAT_SERVER_PORT ? ' (BAT_SERVER_PORT)' : ' (bat-server default)'}`],
  }
}

export function resolveUrlTarget(target, { readFile = readFileSync } = {}) {
  const token = decodeTokenFile(readFile(path.resolve(target.tokenFile), 'utf8'))
  return {
    label: target.url,
    url: target.url,
    token,
    fingerprint: target.fingerprint,
    cwd: '/tmp',
    notes: [`token file ${path.resolve(target.tokenFile)}`],
  }
}

// ---------------------------------------------------------------------------
// Minimal remote client (auth → invoke → events) with fingerprint pinning
// ---------------------------------------------------------------------------

export class SmokeClient {
  constructor({ url, token, fingerprint, timeoutMs = DEFAULT_TIMEOUT_MS, label = 'BAT smoke (T0396)', WebSocketImpl = WebSocket }) {
    this.url = url
    this.token = token
    this.expectedFingerprint = normalizeFingerprint(fingerprint)
    this.timeoutMs = timeoutMs
    this.label = label
    this.WebSocketImpl = WebSocketImpl
    this.ws = null
    this.seq = 0
    this.pending = new Map()
    this.listeners = new Set()
    this.authSent = false
    this.observedFingerprint = ''
  }

  get isOpen() {
    return this.ws !== null && this.ws.readyState === this.WebSocketImpl.OPEN
  }

  nextId() {
    this.seq += 1
    return `smoke-${this.seq}`
  }

  onEvent(listener) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /** Resolves with the auth-result metadata; rejects on pin mismatch, auth failure or timeout. */
  connect() {
    return new Promise((resolve, reject) => {
      // Chain validation is off because the server certificate is self-signed;
      // the SHA-256 pin below replaces it and is checked before the token is sent.
      const ws = new this.WebSocketImpl(this.url, { rejectUnauthorized: false, handshakeTimeout: this.timeoutMs })
      this.ws = ws
      let settled = false
      const settle = (error, value) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        if (error) {
          try { ws.terminate() } catch { /* already gone */ }
          reject(error)
        } else {
          resolve(value)
        }
      }
      const timer = setTimeout(() => settle(new Error(`connect timeout after ${this.timeoutMs}ms`)), this.timeoutMs)

      ws.on('upgrade', (res) => {
        const peer = res?.socket?.getPeerCertificate?.(false)
        let actual = ''
        try {
          actual = peer?.fingerprint256 ? normalizeFingerprint(peer.fingerprint256) : ''
        } catch {
          actual = ''
        }
        this.observedFingerprint = actual
        if (!actual) {
          settle(Object.assign(new Error('fingerprint-unavailable: server presented no certificate fingerprint'), { code: 'fingerprint-mismatch' }))
        } else if (actual !== this.expectedFingerprint) {
          settle(Object.assign(
            new Error(`fingerprint-mismatch: expected ${this.expectedFingerprint}, got ${actual}`),
            { code: 'fingerprint-mismatch' },
          ))
        }
      })

      ws.on('open', () => {
        if (settled) return
        this.authSent = true
        ws.send(JSON.stringify(buildAuthFrame(this.nextId(), this.token, this.label)))
      })

      ws.on('message', (raw) => {
        let frame
        try {
          frame = JSON.parse(raw.toString())
        } catch {
          return
        }
        if (frame.type === FRAME_TYPE.AUTH_RESULT) {
          if (frame.error) settle(Object.assign(new Error(`auth failed: ${frame.error}`), { code: 'auth-failed' }))
          else settle(null, frame.result)
          return
        }
        if (frame.type === FRAME_TYPE.INVOKE_RESULT || frame.type === FRAME_TYPE.INVOKE_ERROR) {
          const entry = this.pending.get(frame.id)
          if (!entry) return
          this.pending.delete(frame.id)
          clearTimeout(entry.timer)
          if (frame.type === FRAME_TYPE.INVOKE_ERROR) {
            entry.reject(Object.assign(new Error(frame.error || 'remote invoke failed'), { remote: true }))
          } else {
            entry.resolve(frame.result)
          }
          return
        }
        if (frame.type === FRAME_TYPE.EVENT && typeof frame.channel === 'string') {
          for (const listener of this.listeners) listener(frame.channel, Array.isArray(frame.args) ? frame.args : [])
        }
      })

      ws.on('close', (code) => {
        for (const [id, entry] of this.pending) {
          clearTimeout(entry.timer)
          entry.reject(new Error(`connection closed (code ${code})`))
          this.pending.delete(id)
        }
        settle(new Error(`connection closed before auth (code ${code})`))
      })

      ws.on('error', (error) => settle(error))
    })
  }

  invoke(channel, ...args) {
    return this.invokeWithTimeout(this.timeoutMs, channel, ...args)
  }

  /** `invoke` with its own timeout (T0411: S10 waits for the login-view probe). */
  invokeWithTimeout(timeoutMs, channel, ...args) {
    if (!this.isOpen) return Promise.reject(new Error('not connected'))
    const id = this.nextId()
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(Object.assign(new Error(`invoke ${channel} timed out after ${timeoutMs}ms`), { timeout: true }))
      }, timeoutMs)
      this.pending.set(id, { resolve, reject, timer })
      this.ws.send(JSON.stringify(buildInvokeFrame(id, channel, args)))
    })
  }

  close() {
    const ws = this.ws
    if (!ws || ws.readyState === this.WebSocketImpl.CLOSED) return Promise.resolve()
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        try { ws.terminate() } catch { /* ignore */ }
        resolve()
      }, 2000)
      ws.once('close', () => {
        clearTimeout(timer)
        resolve()
      })
      ws.close()
    })
  }
}

// ---------------------------------------------------------------------------
// PTY output tracking (own ids only)
// ---------------------------------------------------------------------------

// CSI / OSC / charset / keypad escapes; markers are matched on the stripped text.
const ANSI_RX = /\x1b\[[0-9;?]*[ -/]*[@-~]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|\x1b[()][0-9A-Za-z]|\x1b[=>]/g
const MAX_BUFFER_CHARS = 256 * 1024

export function stripAnsi(text) {
  return String(text).replace(ANSI_RX, '')
}

export class PtyTracker {
  constructor(ownIds) {
    this.ownIds = ownIds
    this.buffers = new Map()
    this.exits = new Map()
    this.waiters = new Set()
  }

  handle(channel, args) {
    const id = args[0]
    if (typeof id !== 'string' || !this.ownIds.has(id)) return // never record other PTYs
    if (channel === SMOKE_EVENTS.PTY_OUTPUT) {
      let buf = (this.buffers.get(id) ?? '') + stripAnsi(args[1] ?? '')
      if (buf.length > MAX_BUFFER_CHARS) buf = buf.slice(buf.length - MAX_BUFFER_CHARS)
      this.buffers.set(id, buf)
    } else if (channel === SMOKE_EVENTS.PTY_EXIT) {
      this.exits.set(id, args[1])
    } else {
      return
    }
    for (const waiter of [...this.waiters]) waiter()
  }

  mark(id) {
    return (this.buffers.get(id) ?? '').length
  }

  since(id, offset) {
    return (this.buffers.get(id) ?? '').slice(offset)
  }

  waitFor(predicate, timeoutMs, what) {
    return new Promise((resolve, reject) => {
      const check = () => {
        const value = predicate()
        if (value !== undefined && value !== null && value !== false) {
          this.waiters.delete(check)
          clearTimeout(timer)
          resolve(value)
        }
      }
      const timer = setTimeout(() => {
        this.waiters.delete(check)
        reject(new Error(`timed out after ${timeoutMs}ms waiting for ${what}`))
      }, timeoutMs)
      this.waiters.add(check)
      check()
    })
  }

  waitForOutput(id, regex, offset, timeoutMs) {
    return this.waitFor(() => regex.exec(this.since(id, offset)) ?? undefined, timeoutMs, `${regex} in output of ${id}`)
  }

  waitForExit(id, timeoutMs) {
    return this.waitFor(() => (this.exits.has(id) ? { exitCode: this.exits.get(id) } : undefined), timeoutMs, `pty:exit of ${id}`)
  }
}

// ---------------------------------------------------------------------------
// Smoke run
// ---------------------------------------------------------------------------

export const CHECKS = Object.freeze([
  ['S1', 'TLS + fingerprint pin + token auth; wrong fingerprint rejected'],
  ['S2', 'settings:get-shell-path returns a Linux shell path'],
  ['S3', 'pty:create emits output; pty:write echo marker round-trips'],
  ['S4', 'pty:resize 120x40 is visible to stty size'],
  ['S5', 'pty:create with the same id is idempotent (same $$)'],
  ['S6', 'PTY survives WS disconnect; write after reconnect + auth'],
  ['S7', 'pty:kill emits pty:exit; later write does not break the server'],
  ['S8', 'unsupported channel returns an explicit error'],
  ['S9', 'claude:get-cli-path / detectRuntime / auth-status answer without a login'],
  ['S10', 'remote-tools:detect returns a schema v1 report (linux, git ok)'],
  ['S11', 'github:check-cli answers; git / git-scaffold / worktree channels read a temp repo'],
  ['S12', 'fs:* denied before workspace:sync-roots; temp dir readable after it, / rejected, /etc still denied'],
  ['S13', 'remote Tower tab: BAT_* helper env, no server token; bat-terminal reaches the server with its capability'],
])

export function makeSmokeId(now = new Date(), rand = randomBytes(3).toString('hex')) {
  const p = (n) => String(n).padStart(2, '0')
  const stamp = `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}${p(now.getHours())}${p(now.getMinutes())}${p(now.getSeconds())}`
  return `${SMOKE_ID_PREFIX}${stamp}-${rand}`
}

/** Fingerprint with the first byte changed — guaranteed different from `fp`. */
export function corruptFingerprint(fp) {
  const bytes = normalizeFingerprint(fp).split(':')
  bytes[0] = bytes[0] === '00' ? '01' : '00'
  return bytes.join(':')
}

/**
 * T0403: `pty:create` answers `{ ok, created }`; servers before T0403 answer a bare boolean.
 * Smoke runs against both, so read either shape. `created` is null for the old shape.
 */
export function ptyCreateOutcome(result) {
  if (result && typeof result === 'object' && typeof result.created === 'boolean') {
    return { ok: result.ok !== false, created: result.created }
  }
  return { ok: result === true, created: null }
}

/**
 * S9 (T0401): judge the login-free claude:* answers.
 *   - get-cli-path: an absolute POSIX path (the claude terminal presets launch it)
 *   - detectRuntime: the bundled embedded claude is present and runs (`--version` parses)
 *   - auth-status: `null` (no login / `claude auth status` exits 1 when logged out) or `{ loggedIn: boolean }`
 */
export function checkClaudeRuntimeAnswers({ cliPath, runtime, auth }) {
  const problems = []
  if (typeof cliPath !== 'string' || !/^\/\S*$/.test(cliPath)) problems.push(`get-cli-path → ${JSON.stringify(cliPath)} (expected an absolute path)`)
  const embedded = runtime && typeof runtime === 'object' ? runtime.embedded : undefined
  if (!embedded || typeof embedded.path !== 'string' || !embedded.path) {
    problems.push(`detectRuntime → ${JSON.stringify(runtime)?.slice(0, 160)} (no embedded path)`)
  } else if (embedded.healthStatus !== 'healthy') {
    problems.push(`detectRuntime embedded ${embedded.path} → ${embedded.healthStatus}`)
  }
  const authOk = auth === null || (auth && typeof auth === 'object' && typeof auth.loggedIn === 'boolean')
  if (!authOk) problems.push(`auth-status → ${JSON.stringify(auth)?.slice(0, 160)}`)
  if (problems.length > 0) return { ok: false, evidence: problems.join('; ') }

  const system = runtime.system && typeof runtime.system === 'object'
    ? `${runtime.system.path} ${runtime.system.version} (${runtime.system.healthStatus})`
    : 'none'
  const login = auth === null ? 'null (not logged in / no status)' : `loggedIn=${auth.loggedIn}${auth.authMethod ? ` (${auth.authMethod})` : ''}`
  return {
    ok: true,
    evidence: `get-cli-path → ${cliPath}; embedded ${embedded.path} v${embedded.version} healthy; system ${system}; auth-status → ${login}`,
  }
}

/**
 * S10 (T0411): judge the `remote-tools:detect` answer (`RemoteToolsDetectResult`,
 * src/types/remote-tools.ts): `ok: true`, `schemaVersion: 1`, `env.osFamily = linux`
 * and `git` installed (`ok`) — every supported bat-server host ships git.
 */
export function checkRemoteToolsAnswer(result) {
  if (!result || typeof result !== 'object') return { ok: false, evidence: `remote-tools:detect → ${JSON.stringify(result)}` }
  if (result.ok !== true) {
    return { ok: false, evidence: `remote-tools:detect → ok=false errorCode=${result.errorCode}: ${String(result.error ?? '').slice(0, 160)}` }
  }
  const report = result.report
  const problems = []
  if (!report || report.schemaVersion !== 1) problems.push(`schemaVersion=${report?.schemaVersion} (expected 1)`)
  const env = report && typeof report.env === 'object' && report.env ? report.env : {}
  if (env.osFamily !== 'linux') problems.push(`env.osFamily=${env.osFamily} (expected linux)`)
  const tools = Array.isArray(report?.tools) ? report.tools : []
  const git = tools.find((t) => t && t.id === 'git')
  if (!git || git.status !== 'ok') problems.push(`git status=${git?.status ?? 'absent'} (expected ok)`)
  if (problems.length > 0) return { ok: false, evidence: problems.join('; ') }

  const statuses = tools.map((t) => `${t.id}=${t.status}${t.version ? `@${t.version}` : ''}`).join(' ')
  const warnings = Array.isArray(report.warnings) && report.warnings.length > 0 ? `; warnings: ${report.warnings.length}` : ''
  return {
    ok: true,
    evidence: `schema v1; ${env.osId ?? '?'} ${env.osVersion ?? ''} ${env.arch ?? ''} pkg=${env.pkgManager} priv=${env.privilege} wsl=${env.isWsl}; ` +
      `serverView=${report.serverViewAvailable}; ${statuses}${warnings}`,
  }
}

/**
 * S11 (T0405): judge the git / github answers. `repo` is the temp repo the smoke
 * created (one empty commit with message `<nonce>-s11`).
 *   - github:check-cli: `installed: true` with a boolean `authenticated` (WSL test
 *     host: gh in /usr/bin, not logged in ⇒ false); `authState` marks a T0405 server
 *   - git:getRoot / git-scaffold:healthCheck: the repo; git:branch: a name;
 *     git:log: the one smoke commit; git:status: clean
 *   - worktree:status of an unknown session: null
 */
export function checkGitAnswers({ repo, nonce, gh, root, branch, log, status, health, worktree }) {
  const problems = []
  const repoName = repo.split('/').pop()
  const isRepoPath = (value) => typeof value === 'string' && value.split('/').pop() === repoName
  if (!gh || typeof gh !== 'object' || gh.installed !== true || typeof gh.authenticated !== 'boolean') {
    problems.push(`github:check-cli → ${JSON.stringify(gh)?.slice(0, 200)} (expected installed: true)`)
  }
  if (!isRepoPath(root)) problems.push(`git:getRoot → ${JSON.stringify(root)} (expected ${repo})`)
  if (typeof branch !== 'string' || !branch) problems.push(`git:branch → ${JSON.stringify(branch)}`)
  if (!Array.isArray(log) || log.length !== 1 || log[0]?.message !== `${nonce}-s11`) {
    problems.push(`git:log → ${JSON.stringify(log)?.slice(0, 200)} (expected the one smoke commit)`)
  }
  if (!Array.isArray(status) || status.length !== 0) problems.push(`git:status → ${JSON.stringify(status)?.slice(0, 200)} (expected clean)`)
  if (!health || health.ok !== true || health.isRepo !== true || !isRepoPath(health.gitRoot)) {
    problems.push(`git-scaffold:healthCheck → ${JSON.stringify(health)?.slice(0, 200)}`)
  }
  if (worktree !== null) problems.push(`worktree:status(unknown session) → ${JSON.stringify(worktree)?.slice(0, 120)} (expected null)`)
  if (problems.length > 0) return { ok: false, evidence: problems.join('; ') }
  return {
    ok: true,
    evidence: `github:check-cli → installed ${gh.path} (${gh.source}), authenticated=${gh.authenticated}${gh.authState ? ` authState=${gh.authState}` : ''}; ` +
      `temp repo ${repo}: getRoot ok, branch ${branch}, log 1 commit ${String(log[0].hash).slice(0, 7)}, status clean, git-scaffold isRepo; worktree:status → null`,
  }
}

const isDenied = (value) => !!value && typeof value === 'object' && value.error === FS_DENIED.error

/**
 * S12 (T0406): judge the fs sandbox answers. `dir` is the temp dir the smoke created
 * with one file `smoke.txt` holding `<nonce>-s12` + newline.
 *   - before any sync: fs:readdir(dir) → [] and fs:readFile → denied (fail closed)
 *   - sync-roots(['/', dir]): ok, accepted exactly [dir], '/' rejected as a filesystem root
 *   - after: readdir lists smoke.txt, readFile returns the content, stat its size
 *   - outside: fs:readdir('/etc') → [] and fs:readFile('/etc/hostname') → denied
 */
export function checkFsSandboxAnswers({ dir, nonce, before, sync, readdir, readFile, stat, outside }) {
  const problems = []
  const content = `${nonce}-s12\n`
  if (!Array.isArray(before?.readdir) || before.readdir.length !== 0) problems.push(`fs:readdir before sync → ${JSON.stringify(before?.readdir)?.slice(0, 160)} (expected [])`)
  if (!isDenied(before?.readFile)) problems.push(`fs:readFile before sync → ${JSON.stringify(before?.readFile)?.slice(0, 160)} (expected denied)`)
  const rejected = Array.isArray(sync?.rejected) ? sync.rejected : []
  if (!sync || sync.ok !== true || !Array.isArray(sync.roots) || sync.roots.length !== 1 || sync.roots[0] !== dir) {
    problems.push(`workspace:sync-roots(['/', dir]) → ${JSON.stringify(sync)?.slice(0, 200)} (expected roots [${dir}])`)
  } else if (!rejected.some((r) => r && r.root === '/' && r.reason === 'filesystem root')) {
    problems.push(`workspace:sync-roots did not reject '/' → ${JSON.stringify(rejected)?.slice(0, 160)}`)
  }
  const names = Array.isArray(readdir) ? readdir.map((e) => e?.name) : null
  if (!names || names.length !== 1 || names[0] !== 'smoke.txt' || readdir[0].path !== `${dir}/smoke.txt`) {
    problems.push(`fs:readdir after sync → ${JSON.stringify(readdir)?.slice(0, 200)} (expected [smoke.txt])`)
  }
  if (!readFile || readFile.content !== content) problems.push(`fs:readFile after sync → ${JSON.stringify(readFile)?.slice(0, 160)}`)
  if (!stat || stat.size !== Buffer.byteLength(content)) problems.push(`fs:stat after sync → ${JSON.stringify(stat)}`)
  if (!Array.isArray(outside?.readdir) || outside.readdir.length !== 0) problems.push(`fs:readdir(${SMOKE_FS_OUTSIDE_DIR}) → ${JSON.stringify(outside?.readdir)?.slice(0, 120)} (expected [])`)
  if (!isDenied(outside?.readFile)) problems.push(`fs:readFile(${SMOKE_FS_OUTSIDE_FILE}) → ${JSON.stringify(outside?.readFile)?.slice(0, 120)} (expected denied)`)
  if (problems.length > 0) return { ok: false, evidence: problems.join('; ') }
  return {
    ok: true,
    evidence: `before sync: readdir [] + readFile denied; sync-roots → [${dir}], '/' rejected (filesystem root); ` +
      `readdir [smoke.txt], readFile ${JSON.stringify(readFile.content.trim())}, stat ${stat.size} B; ${SMOKE_FS_OUTSIDE_DIR} readdir [] + ${SMOKE_FS_OUTSIDE_FILE} denied`,
  }
}

/** S13: sha256 hex of the server token — the only form of the token the smoke ever types into a PTY. */
export function tokenDigest(token) {
  return createHash('sha256').update(String(token)).digest('hex')
}

/**
 * S13 shell line (run in the smoke's own Tower PTY): the BAT_* key names (values never printed),
 * how many env values hash to the server token (`x` without sha256sum), and the capability length.
 * The echoed command shows `[$(`, only the executed one prints `[<keys>]:[<n>]:[<len>]`.
 */
export function buildHelperEnvProbe(nonce, digest) {
  return `echo ${nonce}-s13-env:[$(env | sed -n 's/^\\(BAT_[A-Za-z0-9_]*\\)=.*/\\1/p' | sort | tr '\\n' ' ')]:[$(if command -v sha256sum >/dev/null 2>&1; then env | while IFS= read -r l; do printf '%s' "\${l#*=}" | sha256sum; done | grep -c '^${digest}'; else echo x; fi)]:[\${#BAT_REMOTE_TOKEN}]`
}

export function helperEnvProbeRx(nonce) {
  return new RegExp(`${nonce}-s13-env:\\[([A-Z0-9_ ]*)\\]:\\[(\\d+|x)\\]:\\[(\\d+)\\]`)
}

/** S13: the bundle's own node (`<installRoot>/bin/node`, sibling of `scripts/`), else `node` on PATH. */
const HELPER_NODE = 'n="$BAT_HELPER_DIR/../bin/node"; [ -x "$n" ] || n=node;'

/** S13: a raw command through bat-terminal = `terminal:create-with-command`, never allowed for a capability. */
export function buildHelperRawProbe(nonce) {
  return `${HELPER_NODE} "$n" "$BAT_HELPER_DIR/bat-terminal.mjs" --cwd /tmp echo ${nonce}-s13-denied; echo ${nonce}-s13-raw:[$?]`
}

/** S13: `terminal:create-agent-command` for an agent the server does not know — authorized, creates nothing. */
export function buildHelperAgentProbe(nonce, workspaceId) {
  return `${HELPER_NODE} "$n" "$BAT_HELPER_DIR/bat-terminal.mjs" --agent ${S13_PROBE_AGENT} --prompt ${nonce}-s13 --workspace ${workspaceId} --cwd /tmp; echo ${nonce}-s13-agent:[$?]`
}

/**
 * S13 (T0434): judge the env probe. `tokenMatches` is a number, or 'x' when the server has
 * no sha256sum. No helper env at all → `tooOld` (SKIP, not a failure): the server predates
 * T0433 or its helpers were never deployed.
 */
export function checkHelperEnvAnswer({ keys, tokenMatches, capabilityLength }) {
  const sorted = [...keys].sort()
  if (HELPER_ENV_MARKER_KEYS.every((k) => !sorted.includes(k))) {
    return {
      ok: false,
      tooOld: true,
      evidence: `remote PTY has no helper env (BAT_* = ${sorted.join(',') || 'none'}): server predates T0433, or <installRoot>/scripts has no helpers (dev deploy before T0434) — version insufficient`,
    }
  }
  const problems = []
  const missing = REMOTE_TOWER_ENV_KEYS.filter((k) => !sorted.includes(k))
  const extra = sorted.filter((k) => !REMOTE_TOWER_ENV_KEYS.includes(k))
  if (missing.length > 0) {
    // T0456: only the bundle node missing ⇒ a server deployed before T0456, or no <installRoot>/bin/node
    const hint = missing.length === 1 && missing[0] === 'BAT_HELPER_NODE'
      ? ' (server predates T0456, or <installRoot>/bin/node is missing — redeploy)'
      : ''
    problems.push(`missing ${missing.join(',')}${hint}`)
  }
  if (extra.length > 0) problems.push(`unexpected ${extra.join(',')}`)
  if (tokenMatches === 'x') problems.push('sha256sum not available on the server — server token check could not run')
  else if (tokenMatches !== 0) problems.push(`${tokenMatches} env value(s) equal the server token`)
  if (!HELPER_CAPABILITY_LENGTHS.includes(capabilityLength)) {
    problems.push(`BAT_REMOTE_TOKEN is ${capabilityLength} chars (a capability is ${HELPER_CAPABILITY_LENGTHS.join(' or ')})`)
  }
  const keyList = `BAT_* = ${sorted.join(',')}`
  return problems.length === 0
    ? { ok: true, tooOld: false, evidence: `${keyList}; no env value equals the server token (sha256); BAT_REMOTE_TOKEN is a ${capabilityLength}-char capability` }
    : { ok: false, tooOld: false, evidence: `${keyList}; ${problems.join('; ')}` }
}

/**
 * S13 (T0434): judge the two bat-terminal runs inside the Tower PTY.
 *   raw:   `{ code, text }` — must be refused with `Forbidden: channel-not-allowed`
 *   agent: `{ code, text, createdId, cwdAfter }` — the tower role reached create-agent-command
 *          and no terminal was created: T0450+ `Forbidden: agent-not-allowed` (exit 1), or on
 *          T0433-T0449 an authorized `false` answer, which bat-terminal reports as created
 *          (exit 0; since T0456 as `Failed to create terminal`, exit 1) — `cwdAfter`
 *          (pty:get-cwd of that id) must then be null. Any other Forbidden / auth / connect
 *          error fails.
 */
export function checkHelperProbeAnswers({ raw, agent }) {
  const problems = []
  const notes = []
  if (raw.code === 1 && /Forbidden: channel-not-allowed/.test(raw.text)) {
    notes.push('raw command → Forbidden: channel-not-allowed')
  } else {
    problems.push(`raw command: exit ${raw.code}, ${JSON.stringify(excerpt(raw.text, 120))} (expected exit 1 + Forbidden: channel-not-allowed)`)
  }
  if (!agent) {
    problems.push('agent probe not run')
  } else if (agent.code === 1 && /Forbidden: agent-not-allowed/.test(agent.text)) {
    notes.push(`create-agent-command reached with the tower role; ${S13_PROBE_AGENT} → Forbidden: agent-not-allowed (T0450+), nothing created`)
  } else if (HELPER_REFUSED_RX.test(agent.text)) {
    problems.push(`agent probe refused: exit ${agent.code}, ${JSON.stringify(excerpt(agent.text, 120))}`)
  } else if (agent.createdId && agent.cwdAfter != null) {
    problems.push(`agent probe created terminal ${agent.createdId} for an unregistered agent`)
  } else if (agent.code === 0 || (agent.code === 1 && /Failed to create terminal/.test(agent.text))) {
    notes.push(`create-agent-command authorized (bat-terminal exit ${agent.code}), no terminal created for ${S13_PROBE_AGENT}`)
  } else {
    problems.push(`agent probe: exit ${agent.code}, ${JSON.stringify(excerpt(agent.text, 120))}`)
  }
  return problems.length === 0
    ? { ok: true, evidence: notes.join('; ') }
    : { ok: false, evidence: [...problems, ...notes].join('; ') }
}

function excerpt(text, max = 160) {
  const flat = String(text).replace(/\r/g, '').replace(/\n+/g, '⏎').trim()
  return flat.length > max ? `…${flat.slice(flat.length - max)}` : flat
}

/**
 * Runs S1-S13 against one server. `deps.createClient` lets tests inject a fake;
 * everything else talks to the real server.
 */
export async function runSmoke(conn, { timeoutMs = DEFAULT_TIMEOUT_MS, cwd, createClient, log = () => {} } = {}) {
  const make = createClient ?? ((overrides = {}) => new SmokeClient({ url: conn.url, token: conn.token, fingerprint: conn.fingerprint, timeoutMs, ...overrides }))
  const results = new Map(CHECKS.map(([id, name]) => [id, { id, name, status: 'SKIP', evidence: 'not run' }]))
  const set = (id, status, evidence, reason) => {
    Object.assign(results.get(id), { status, evidence }, reason ? { reason } : {})
    log(results.get(id))
  }
  const ptyId = makeSmokeId()
  const ownIds = new Set([ptyId])
  const tracker = new PtyTracker(ownIds)
  const ptyCwd = cwd ?? conn.cwd ?? '/tmp'
  const nonce = randomBytes(4).toString('hex')
  let client = null
  let created = false
  let killed = false
  let shellPath
  let pidBefore = null
  const cleanup = { ptyId, killedInCleanup: false, leftover: null, evidence: '' }

  const attach = (c) => c.onEvent((channel, args) => tracker.handle(channel, args))
  const runCmdIn = async (id, command, regex) => {
    const offset = tracker.mark(id)
    const write = await client.invoke(SMOKE_CHANNELS.PTY_WRITE, id, `${command}\r`)
    if (!write || write.ok !== true) throw new Error(`pty:write returned ${JSON.stringify(write)}`)
    return tracker.waitForOutput(id, regex, offset, timeoutMs)
  }
  const runCmd = (command, regex) => runCmdIn(ptyId, command, regex)
  // S11's own PTY (temp git repo); killed in S11, re-checked in cleanup.
  const gitPty = { id: `${ptyId}-git`, created: false, killed: false }
  // S12's own PTY (temp fs dir); killed in S12, re-checked in cleanup.
  const fsPty = { id: `${ptyId}-fs`, created: false, killed: false }
  // S13's own Tower PTY (helper env); killed in S13, re-checked in cleanup.
  const towerPty = { id: `${ptyId}-tower`, created: false, killed: false }
  // A terminal the S13 agent probe must NOT create; killed in cleanup if it ever exists.
  let s13Stray = null

  try {
    // ── S1 ──
    try {
      const negative = make({ fingerprint: corruptFingerprint(conn.fingerprint) })
      let negativeEvidence
      try {
        await negative.connect()
        await negative.close()
        throw new Error('connection with a wrong fingerprint was ACCEPTED')
      } catch (error) {
        if (error.code !== 'fingerprint-mismatch') throw error
        if (negative.authSent) throw new Error('wrong-fingerprint connection sent the auth frame (token leaked to unpinned peer)')
        negativeEvidence = 'wrong fingerprint rejected at TLS upgrade, auth frame not sent'
      }
      client = make()
      attach(client)
      const meta = await client.connect()
      const platform = meta && typeof meta === 'object' ? meta.serverPlatform : undefined
      const summary = meta && typeof meta === 'object'
        ? `serverPlatform=${platform} arch=${meta.serverArch} env=${meta.serverEnv} node=${meta.nodeVersion} bundle=${meta.bundleVersion}`
        : `auth-result=${JSON.stringify(meta)}`
      const serverEnv = meta && typeof meta === 'object' ? meta.serverEnv : undefined
      const pinned = `pinned ${client.observedFingerprint.slice(0, 11)}…${client.observedFingerprint.slice(-5)}, auth ok (${summary})`
      if (platform !== undefined && platform !== 'linux') {
        set('S1', 'FAIL', `auth ok but serverPlatform=${platform} (expected linux); ${negativeEvidence}`)
      } else if (conn.expectedServerEnv && serverEnv !== conn.expectedServerEnv) {
        // T0404 (BUG-103): WARN, not FAIL — servers before T0404 always report native.
        set('S1', 'WARN', `${pinned}; env=${serverEnv} but target is ${conn.expectedServerEnv} (server older than T0404 / BUG-103?); ${negativeEvidence}`)
      } else {
        set('S1', 'PASS', `${pinned}; ${negativeEvidence}`)
      }
    } catch (error) {
      set('S1', 'FAIL', error instanceof Error ? error.message : String(error))
      return { checks: [...results.values()], cleanup, ptyId }
    }

    // ── S2 ──
    try {
      const result = await client.invoke(SMOKE_CHANNELS.SHELL_PATH, 'auto')
      if (typeof result === 'string' && /^\/[^\s]*$/.test(result)) {
        shellPath = result
        set('S2', 'PASS', `settings:get-shell-path('auto') → ${result}`)
      } else {
        set('S2', 'FAIL', `settings:get-shell-path('auto') → ${JSON.stringify(result)} (expected an absolute Linux path)`)
      }
    } catch (error) {
      set('S2', 'FAIL', error.message)
    }

    // ── S3 ──
    try {
      const offset = tracker.mark(ptyId)
      const createOpts = { id: ptyId, cwd: ptyCwd, type: 'terminal', ...(shellPath ? { shell: shellPath } : {}) }
      const result = await client.invoke(SMOKE_CHANNELS.PTY_CREATE, createOpts)
      const outcome = ptyCreateOutcome(result)
      if (!outcome.ok || outcome.created === false) throw new Error(`pty:create returned ${JSON.stringify(result)}`)
      created = true
      await tracker.waitFor(() => tracker.since(ptyId, offset).length > 0 || undefined, timeoutMs, `first pty:output of ${ptyId}`)
      const firstOutput = tracker.since(ptyId, offset)
      // The typed command echoes `$((40+2))`; only the executed command prints 42.
      const match = await runCmd(`echo ${nonce}-s3-$((40+2))`, new RegExp(`${nonce}-s3-42`))
      set('S3', 'PASS', `pty:create(${ptyId}, cwd=${ptyCwd}, shell=${shellPath ?? 'server default'}) → ${JSON.stringify(result)}; first output ${JSON.stringify(excerpt(firstOutput, 60))}; marker ${match[0]} seen`)
    } catch (error) {
      set('S3', 'FAIL', error.message)
    }

    if (created) {
      // ── S4 ──
      try {
        const result = await client.invoke(SMOKE_CHANNELS.PTY_RESIZE, ptyId, 120, 40)
        const match = await runCmd(`echo ${nonce}-s4:$(stty size)`, new RegExp(`${nonce}-s4:(\\d+) (\\d+)`))
        if (match[1] === '40' && match[2] === '120') {
          set('S4', 'PASS', `pty:resize → ${JSON.stringify(result ?? null)}; stty size → "${match[1]} ${match[2]}"`)
        } else {
          set('S4', 'FAIL', `stty size → "${match[1]} ${match[2]}" (expected "40 120")`)
        }
      } catch (error) {
        set('S4', 'FAIL', error.message)
      }

      // ── S5 ──
      try {
        pidBefore = (await runCmd(`echo ${nonce}-s5a:$$`, new RegExp(`${nonce}-s5a:(\\d+)`)))[1]
        const again = await client.invoke(SMOKE_CHANNELS.PTY_CREATE, { id: ptyId, cwd: ptyCwd, type: 'terminal', ...(shellPath ? { shell: shellPath } : {}) })
        const pidAfter = (await runCmd(`echo ${nonce}-s5b:$$`, new RegExp(`${nonce}-s5b:(\\d+)`)))[1]
        // T0403 server: must also report created:false (old server: bare true)
        const outcome = ptyCreateOutcome(again)
        if (outcome.ok && outcome.created !== true && pidBefore === pidAfter) {
          set('S5', 'PASS', `second pty:create → ${JSON.stringify(again)}; $$ ${pidBefore} → ${pidAfter} (same shell)`)
        } else {
          set('S5', 'FAIL', `second pty:create → ${JSON.stringify(again)}; $$ ${pidBefore} → ${pidAfter}`)
        }
      } catch (error) {
        set('S5', 'FAIL', error.message)
      }

      // ── S6 ──
      try {
        await client.close()
        client = make()
        attach(client)
        await client.connect()
        const match = await runCmd(`echo ${nonce}-s6:$((6*7)):$$`, new RegExp(`${nonce}-s6:42:(\\d+)`))
        const samePid = pidBefore === null ? 'n/a' : String(match[1] === pidBefore)
        if (pidBefore !== null && match[1] !== pidBefore) {
          set('S6', 'FAIL', `output after reconnect came from $$ ${match[1]}, before disconnect it was ${pidBefore}`)
        } else {
          set('S6', 'PASS', `closed WS, reconnected + auth; pty:write → output ${match[0].replace(/:\d+$/, '')} (same $$ ${match[1]}: ${samePid})`)
        }
      } catch (error) {
        set('S6', 'FAIL', error.message)
        if (!client?.isOpen) {
          try {
            client = make()
            attach(client)
            await client.connect()
          } catch { /* cleanup reports it */ }
        }
      }

      // ── S7 ──
      try {
        const result = await client.invoke(SMOKE_CHANNELS.PTY_KILL, ptyId)
        const exit = await tracker.waitForExit(ptyId, timeoutMs)
        killed = true
        const write = await client.invoke(SMOKE_CHANNELS.PTY_WRITE, ptyId, 'echo after-kill\r')
        const alive = await client.invoke(SMOKE_CHANNELS.SHELL_PATH, 'auto')
        const cwdAfter = await client.invoke(SMOKE_CHANNELS.PTY_GET_CWD, ptyId)
        const gone = write && write.ok === false && write.reason === 'pty-not-found' && cwdAfter == null
        if (result === true && gone && typeof alive === 'string') {
          set('S7', 'PASS', `pty:kill → true; pty:exit(${ptyId}, ${exit.exitCode}); write after kill → ${JSON.stringify(write)}; pty:get-cwd → ${JSON.stringify(cwdAfter)}; connection alive (shell-path ${alive})`)
        } else {
          set('S7', 'FAIL', `pty:kill → ${JSON.stringify(result)}; write after kill → ${JSON.stringify(write)}; pty:get-cwd → ${JSON.stringify(cwdAfter)}; follow-up invoke → ${JSON.stringify(alive)}`)
        }
      } catch (error) {
        set('S7', 'FAIL', error.message)
      }
    }

    // ── S8 ──
    try {
      if (!client?.isOpen) throw new Error('no live connection for the probe')
      const result = await client.invoke(UNSUPPORTED_PROBE_CHANNEL, ...UNSUPPORTED_PROBE_ARGS)
      set('S8', 'FAIL', `${UNSUPPORTED_PROBE_CHANNEL} unexpectedly answered ${JSON.stringify(result)?.slice(0, 120)}`)
    } catch (error) {
      if (error.remote && UNSUPPORTED_ERROR_RX.test(error.message)) {
        set('S8', 'PASS', `${UNSUPPORTED_PROBE_CHANNEL} → invoke-error "${error.message}"`)
      } else {
        set('S8', 'FAIL', `${UNSUPPORTED_PROBE_CHANNEL} → ${error.timeout ? 'TIMEOUT' : 'non-explicit failure'}: ${error.message}`)
      }
    }

    // ── S9 ──
    try {
      if (!client?.isOpen) throw new Error('no live connection for the claude probes')
      const outcome = checkClaudeRuntimeAnswers({
        cliPath: await client.invoke(SMOKE_CHANNELS.CLAUDE_CLI_PATH),
        runtime: await client.invoke(SMOKE_CHANNELS.CLAUDE_DETECT_RUNTIME),
        auth: await client.invoke(SMOKE_CHANNELS.CLAUDE_AUTH_STATUS),
      })
      set('S9', outcome.ok ? 'PASS' : 'FAIL', outcome.evidence)
    } catch (error) {
      set('S9', 'FAIL', error.remote && UNSUPPORTED_ERROR_RX.test(error.message)
        ? `${error.message} — server predates T0401 (claude:* not online)`
        : `${error.timeout ? 'TIMEOUT: ' : ''}${error.message}`)
    }

    // ── S10 ──
    try {
      if (!client?.isOpen) throw new Error('no live connection for the remote-tools probe')
      const timeout = Math.max(timeoutMs, REMOTE_TOOLS_DETECT_TIMEOUT_MS)
      const outcome = checkRemoteToolsAnswer(await client.invokeWithTimeout(timeout, SMOKE_CHANNELS.REMOTE_TOOLS_DETECT))
      set('S10', outcome.ok ? 'PASS' : 'FAIL', outcome.evidence)
    } catch (error) {
      set('S10', 'FAIL', error.remote && UNSUPPORTED_ERROR_RX.test(error.message)
        ? `${error.message} — server predates T0411 (remote-tools:detect not online)`
        : `${error.timeout ? 'TIMEOUT: ' : ''}${error.message}`)
    }

    // ── S11 ──
    {
      let repo = null
      let outcome = null
      try {
        if (!client?.isOpen) throw new Error('no live connection for the git probes')
        const gh = await client.invokeWithTimeout(Math.max(timeoutMs, GITHUB_CHECK_CLI_TIMEOUT_MS), SMOKE_CHANNELS.GITHUB_CHECK_CLI)
        ownIds.add(gitPty.id)
        const offset = tracker.mark(gitPty.id)
        const result = await client.invoke(SMOKE_CHANNELS.PTY_CREATE, { id: gitPty.id, cwd: ptyCwd, type: 'terminal', ...(shellPath ? { shell: shellPath } : {}) })
        if (!ptyCreateOutcome(result).ok) throw new Error(`pty:create(${gitPty.id}) returned ${JSON.stringify(result)}`)
        gitPty.created = true
        await tracker.waitFor(() => tracker.since(gitPty.id, offset).length > 0 || undefined, timeoutMs, `first pty:output of ${gitPty.id}`)
        // The echoed command shows `:$d`; only the executed one prints the /tmp path.
        const made = await runCmdIn(
          gitPty.id,
          `d=$(mktemp -d ${SMOKE_GIT_REPO_TEMPLATE}) && git -C "$d" init -q && git -C "$d" -c user.name=bat-smoke -c user.email=bat-smoke@localhost -c commit.gpgsign=false commit -q --no-verify --allow-empty -m ${nonce}-s11 && echo ${nonce}-s11-repo:$d`,
          new RegExp(`${nonce}-s11-repo:(/tmp/bat-smoke-git\\.[A-Za-z0-9]+)`),
        )
        repo = made[1]
        outcome = checkGitAnswers({
          repo,
          nonce,
          gh,
          root: await client.invoke(SMOKE_CHANNELS.GIT_GET_ROOT, repo),
          branch: await client.invoke(SMOKE_CHANNELS.GIT_BRANCH, repo),
          log: await client.invoke(SMOKE_CHANNELS.GIT_LOG, repo, 5),
          status: await client.invoke(SMOKE_CHANNELS.GIT_STATUS, repo),
          health: await client.invoke(SMOKE_CHANNELS.GIT_SCAFFOLD_HEALTH, repo),
          worktree: await client.invoke(SMOKE_CHANNELS.WORKTREE_STATUS, `${ptyId}-no-session`),
        })
      } catch (error) {
        outcome = {
          ok: false,
          evidence: error.remote && UNSUPPORTED_ERROR_RX.test(error.message)
            ? `${error.message} — server predates T0405 (git / github / worktree not online)`
            : `${error.timeout ? 'TIMEOUT: ' : ''}${error.message}`,
        }
      }
      if (gitPty.created) {
        try {
          if (!client?.isOpen) {
            client = make()
            attach(client)
            await client.connect()
          }
          if (repo && SMOKE_GIT_REPO_RX.test(repo)) {
            // `$((1+1))`: the echoed command never matches the marker, only the executed one.
            await runCmdIn(
              gitPty.id,
              `case "$d" in /tmp/bat-smoke-git.*) rm -rf -- "$d";; esac; test -e "$d" || echo ${nonce}-s11-gone-$((1+1))`,
              new RegExp(`${nonce}-s11-gone-2`),
            )
            outcome.evidence += '; temp repo removed'
          }
          await client.invoke(SMOKE_CHANNELS.PTY_KILL, gitPty.id)
          gitPty.killed = true
        } catch (error) {
          outcome = { ok: false, evidence: `${outcome.evidence}; S11 cleanup failed${repo ? ` (temp repo ${repo} may remain)` : ''}: ${error.message}` }
        }
      }
      set('S11', outcome.ok ? 'PASS' : 'FAIL', outcome.evidence)
    }

    // ── S12 ──
    {
      let dir = null
      let synced = false
      let outcome = null
      try {
        if (!client?.isOpen) throw new Error('no live connection for the fs probes')
        // Read-only probe first: a server before T0406 answers `No handler` and nothing is created.
        await client.invoke(SMOKE_CHANNELS.FS_STAT, '/tmp')
        ownIds.add(fsPty.id)
        const offset = tracker.mark(fsPty.id)
        const result = await client.invoke(SMOKE_CHANNELS.PTY_CREATE, { id: fsPty.id, cwd: ptyCwd, type: 'terminal', ...(shellPath ? { shell: shellPath } : {}) })
        if (!ptyCreateOutcome(result).ok) throw new Error(`pty:create(${fsPty.id}) returned ${JSON.stringify(result)}`)
        fsPty.created = true
        await tracker.waitFor(() => tracker.since(fsPty.id, offset).length > 0 || undefined, timeoutMs, `first pty:output of ${fsPty.id}`)
        // The echoed command shows `:$d`; only the executed one prints the /tmp path.
        const made = await runCmdIn(
          fsPty.id,
          `d=$(mktemp -d ${SMOKE_FS_DIR_TEMPLATE}) && printf '%s\\n' ${nonce}-s12 > "$d/smoke.txt" && echo ${nonce}-s12-dir:$d`,
          new RegExp(`${nonce}-s12-dir:(/tmp/bat-smoke-fs\\.[A-Za-z0-9]+)`),
        )
        dir = made[1]
        const file = `${dir}/smoke.txt`
        const before = {
          readdir: await client.invoke(SMOKE_CHANNELS.FS_READDIR, dir),
          readFile: await client.invoke(SMOKE_CHANNELS.FS_READ_FILE, file),
        }
        const sync = await client.invoke(SMOKE_CHANNELS.WORKSPACE_SYNC_ROOTS, ['/', dir])
        synced = true
        outcome = checkFsSandboxAnswers({
          dir,
          nonce,
          before,
          sync,
          readdir: await client.invoke(SMOKE_CHANNELS.FS_READDIR, dir),
          readFile: await client.invoke(SMOKE_CHANNELS.FS_READ_FILE, file),
          stat: await client.invoke(SMOKE_CHANNELS.FS_STAT, file),
          outside: {
            readdir: await client.invoke(SMOKE_CHANNELS.FS_READDIR, SMOKE_FS_OUTSIDE_DIR),
            readFile: await client.invoke(SMOKE_CHANNELS.FS_READ_FILE, SMOKE_FS_OUTSIDE_FILE),
          },
        })
      } catch (error) {
        outcome = {
          ok: false,
          evidence: error.remote && UNSUPPORTED_ERROR_RX.test(error.message)
            ? `${error.message} — server predates T0406 (fs:* / workspace:sync-roots not online)`
            : `${error.timeout ? 'TIMEOUT: ' : ''}${error.message}`,
        }
      }
      if (fsPty.created) {
        try {
          if (!client?.isOpen) {
            client = make()
            attach(client)
            await client.connect()
          } else if (synced) {
            // This connection's roots only; the server also drops them when the connection closes.
            await client.invoke(SMOKE_CHANNELS.WORKSPACE_SYNC_ROOTS, [])
            outcome.evidence += '; roots cleared'
          }
          if (dir && SMOKE_FS_DIR_RX.test(dir)) {
            // `$((1+1))`: the echoed command never matches the marker, only the executed one.
            await runCmdIn(
              fsPty.id,
              `case "$d" in /tmp/bat-smoke-fs.*) rm -rf -- "$d";; esac; test -e "$d" || echo ${nonce}-s12-gone-$((1+1))`,
              new RegExp(`${nonce}-s12-gone-2`),
            )
            outcome.evidence += '; temp dir removed'
          }
          await client.invoke(SMOKE_CHANNELS.PTY_KILL, fsPty.id)
          fsPty.killed = true
        } catch (error) {
          outcome = { ok: false, evidence: `${outcome.evidence}; S12 cleanup failed${dir ? ` (temp dir ${dir} may remain)` : ''}: ${error.message}` }
        }
      }
      set('S12', outcome.ok ? 'PASS' : 'FAIL', outcome.evidence)
    }

    // ── S13 ──
    {
      let outcome = null
      let tooOld = false
      try {
        if (!client?.isOpen) throw new Error('no live connection for the remote Tower probe')
        ownIds.add(towerPty.id)
        const offset = tracker.mark(towerPty.id)
        const workspaceId = `${ptyId}-ws`
        const result = await client.invoke(SMOKE_CHANNELS.PTY_CREATE, { id: towerPty.id, cwd: ptyCwd, type: 'terminal', workspaceId, ...(shellPath ? { shell: shellPath } : {}) })
        if (!ptyCreateOutcome(result).ok) throw new Error(`pty:create(${towerPty.id}) returned ${JSON.stringify(result)}`)
        towerPty.created = true
        await tracker.waitFor(() => tracker.since(towerPty.id, offset).length > 0 || undefined, timeoutMs, `first pty:output of ${towerPty.id}`)
        const capture = async (command, regex) => {
          const from = tracker.mark(towerPty.id)
          const write = await client.invoke(SMOKE_CHANNELS.PTY_WRITE, towerPty.id, `${command}\r`)
          if (!write || write.ok !== true) throw new Error(`pty:write returned ${JSON.stringify(write)}`)
          const match = await tracker.waitForOutput(towerPty.id, regex, from, Math.max(timeoutMs, HELPER_PROBE_TIMEOUT_MS))
          return { match, text: tracker.since(towerPty.id, from) }
        }
        const { match: envMatch } = await capture(buildHelperEnvProbe(nonce, tokenDigest(conn.token)), helperEnvProbeRx(nonce))
        const envAnswer = checkHelperEnvAnswer({
          keys: envMatch[1].trim().split(/\s+/).filter(Boolean),
          tokenMatches: envMatch[2] === 'x' ? 'x' : Number(envMatch[2]),
          capabilityLength: Number(envMatch[3]),
        })
        if (envAnswer.tooOld) {
          tooOld = true
          outcome = { ok: false, evidence: envAnswer.evidence }
        } else if (!envAnswer.ok) {
          outcome = envAnswer
        } else {
          const rawRun = await capture(buildHelperRawProbe(nonce), new RegExp(`${nonce}-s13-raw:\\[(\\d+)\\]`))
          const raw = { code: Number(rawRun.match[1]), text: rawRun.text }
          let agent = null
          // A refused capability counts as a failed auth on the server: do not try twice.
          if (!/Authentication failed|Cannot connect/.test(raw.text)) {
            const agentRun = await capture(buildHelperAgentProbe(nonce, workspaceId), new RegExp(`${nonce}-s13-agent:\\[(\\d+)\\]`))
            const createdId = /Terminal created: ([A-Za-z0-9._-]+)/.exec(agentRun.text)?.[1] ?? null
            const cwdAfter = createdId ? await client.invoke(SMOKE_CHANNELS.PTY_GET_CWD, createdId) : null
            if (createdId && cwdAfter != null) s13Stray = createdId
            agent = { code: Number(agentRun.match[1]), text: agentRun.text, createdId, cwdAfter }
          }
          const probes = checkHelperProbeAnswers({ raw, agent })
          outcome = { ok: probes.ok, evidence: `${envAnswer.evidence}; ${probes.evidence}` }
        }
      } catch (error) {
        outcome = { ok: false, evidence: `${error.timeout ? 'TIMEOUT: ' : ''}${error.message}` }
      }
      if (towerPty.created) {
        try {
          if (!client?.isOpen) {
            client = make()
            attach(client)
            await client.connect()
          }
          // Killing the Tower PTY also revokes its capability on the server.
          await client.invoke(SMOKE_CHANNELS.PTY_KILL, towerPty.id)
          towerPty.killed = true
        } catch (error) {
          outcome = { ok: false, evidence: `${outcome.evidence}; S13 cleanup failed: ${error.message}` }
          tooOld = false
        }
      }
      if (tooOld) set('S13', 'SKIP', outcome.evidence, SERVER_TOO_OLD)
      else set('S13', outcome.ok ? 'PASS' : 'FAIL', outcome.evidence)
    }
  } finally {
    // Kill our PTY on every path, then confirm it is gone (own id only).
    if (created) {
      try {
        if (!client?.isOpen) {
          client = make()
          attach(client)
          await client.connect()
        }
        if (!killed) {
          await client.invoke(SMOKE_CHANNELS.PTY_KILL, ptyId)
          cleanup.killedInCleanup = true
        }
        const probe = await client.invoke(SMOKE_CHANNELS.PTY_WRITE, ptyId, '\r')
        cleanup.leftover = !(probe && probe.ok === false && probe.reason === 'pty-not-found')
        cleanup.evidence = `existence probe pty:write(${ptyId}) → ${JSON.stringify(probe)}`
      } catch (error) {
        cleanup.leftover = true
        cleanup.evidence = `cleanup failed: ${error instanceof Error ? error.message : String(error)}`
      }
    } else {
      cleanup.leftover = false
      cleanup.evidence = 'no smoke PTY was created'
    }
    // T0405: S11's PTY (S11 kills it; only re-checked here).
    if (gitPty.created) {
      try {
        if (!client?.isOpen) {
          client = make()
          attach(client)
          await client.connect()
        }
        if (!gitPty.killed) await client.invoke(SMOKE_CHANNELS.PTY_KILL, gitPty.id)
        const probe = await client.invoke(SMOKE_CHANNELS.PTY_WRITE, gitPty.id, '\r')
        const left = !(probe && probe.ok === false && probe.reason === 'pty-not-found')
        cleanup.leftover = cleanup.leftover || left
        cleanup.evidence += `; pty:write(${gitPty.id}) → ${JSON.stringify(probe)}`
      } catch (error) {
        cleanup.leftover = true
        cleanup.evidence += `; S11 PTY cleanup failed: ${error instanceof Error ? error.message : String(error)}`
      }
    }
    // T0406: S12's PTY (S12 kills it; only re-checked here).
    if (fsPty.created) {
      try {
        if (!client?.isOpen) {
          client = make()
          attach(client)
          await client.connect()
        }
        if (!fsPty.killed) await client.invoke(SMOKE_CHANNELS.PTY_KILL, fsPty.id)
        const probe = await client.invoke(SMOKE_CHANNELS.PTY_WRITE, fsPty.id, '\r')
        const left = !(probe && probe.ok === false && probe.reason === 'pty-not-found')
        cleanup.leftover = cleanup.leftover || left
        cleanup.evidence += `; pty:write(${fsPty.id}) → ${JSON.stringify(probe)}`
      } catch (error) {
        cleanup.leftover = true
        cleanup.evidence += `; S12 PTY cleanup failed: ${error instanceof Error ? error.message : String(error)}`
      }
    }
    // T0434: S13's Tower PTY (S13 kills it; only re-checked here) and a stray agent-probe terminal.
    for (const extra of [towerPty.created ? towerPty : null, s13Stray ? { id: s13Stray, killed: false } : null]) {
      if (!extra) continue
      try {
        if (!client?.isOpen) {
          client = make()
          attach(client)
          await client.connect()
        }
        if (!extra.killed) await client.invoke(SMOKE_CHANNELS.PTY_KILL, extra.id)
        const probe = await client.invoke(SMOKE_CHANNELS.PTY_WRITE, extra.id, '\r')
        const left = !(probe && probe.ok === false && probe.reason === 'pty-not-found')
        cleanup.leftover = cleanup.leftover || left
        cleanup.evidence += `; pty:write(${extra.id}) → ${JSON.stringify(probe)}`
      } catch (error) {
        cleanup.leftover = true
        cleanup.evidence += `; S13 PTY cleanup failed: ${error instanceof Error ? error.message : String(error)}`
      }
    }
    await client?.close().catch(() => undefined)
  }

  return { checks: [...results.values()], cleanup, ptyId }
}

/**
 * WARN (T0404) and a SKIP because the server is too old for the check (T0434, `reason:
 * 'server-too-old'`) are reported but do not fail the run; any other SKIP (prerequisite failed) does.
 */
export function summarize(report) {
  const passed = report.checks.filter((c) => c.status === 'PASS').length
  const warned = report.checks.filter((c) => c.status === 'WARN').length
  const tooOld = report.checks.filter((c) => c.status === 'SKIP' && c.reason === SERVER_TOO_OLD).length
  const ok = passed + warned + tooOld === report.checks.length && report.cleanup.leftover === false
  return { ok, passed, warned, tooOld, total: report.checks.length }
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

export async function main(argv = process.argv.slice(2), io = { out: (s) => process.stdout.write(`${s}\n`), err: (s) => process.stderr.write(`${s}\n`) }) {
  let opts
  try {
    opts = parseArgs(argv)
  } catch (error) {
    io.err(`[smoke] ${error.message}`)
    io.err(USAGE)
    return 2
  }
  if (opts.help) {
    io.out(USAGE)
    return 0
  }

  let conn
  try {
    conn = opts.target.kind === 'wsl' ? await resolveWslTarget(opts.target) : resolveUrlTarget(opts.target)
  } catch (error) {
    io.err(`[smoke] cannot resolve connection info: ${error instanceof Error ? error.message : String(error)}`)
    return 2
  }

  const startedAt = new Date().toISOString()
  if (!opts.json) {
    io.out(`[smoke] target ${conn.label} → ${conn.url} (fingerprint ${conn.fingerprint.slice(0, 11)}…${conn.fingerprint.slice(-5)}; ${conn.notes.join('; ')})`)
  }
  const report = await runSmoke(conn, {
    timeoutMs: opts.timeoutMs,
    cwd: opts.cwd ?? undefined,
    log: opts.json ? () => {} : (check) => io.out(`${check.status.padEnd(4)} ${check.id} ${check.name} — ${check.evidence}`),
  })
  const summary = summarize(report)

  if (opts.json) {
    io.out(JSON.stringify({
      ok: summary.ok,
      target: conn.label,
      url: conn.url,
      fingerprint: conn.fingerprint,
      startedAt,
      finishedAt: new Date().toISOString(),
      ptyId: report.ptyId,
      checks: report.checks,
      cleanup: report.cleanup,
    }, null, 2))
  } else {
    for (const check of report.checks.filter((c) => c.status === 'SKIP')) {
      io.out(`SKIP ${check.id} ${check.name} — ${check.reason === SERVER_TOO_OLD ? 'server too old for this check (not a failure)' : 'prerequisite failed'}`)
    }
    io.out(`[smoke] cleanup: ${report.cleanup.leftover ? 'LEFTOVER smoke PTY' : 'no smoke PTY left'} (${report.cleanup.evidence})`)
    io.out(`[smoke] RESULT: ${summary.passed}/${summary.total} PASS${summary.warned ? `, ${summary.warned} WARN` : ''}${summary.tooOld ? `, ${summary.tooOld} SKIP (server too old)` : ''}${summary.ok ? '' : ' — FAILED'}`)
  }
  return summary.ok ? 0 : 1
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
if (invokedDirectly) {
  main().then((code) => {
    process.exitCode = code
  })
}
