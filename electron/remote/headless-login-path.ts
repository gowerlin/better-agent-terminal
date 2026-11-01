// PLAN-057 / T0755 (D206 / D207): the headless server (bat-server) takes the login shell's PATH
// at startup.
//
// bat-server is started by a systemd user unit / launchd / a container ENTRYPOINT, so its PATH is
// the system default: `~/.local/bin`, nvm, Homebrew are missing. Terminal tabs re-read the rc files
// (`-l -i`), but the server process's own children (the Claude panel's Bash tool and MCP servers,
// system-runtime claude, codex, the remote tools "server view") inherit `process.env.PATH`.
//
// Design (T0754 measurements; details in docs/agent-guide/headless-login-shell-path.md):
//   - `<shell> -l -i -c '<printf PATH between a random marker>'`, only the last marker pair counts
//     (rc output, MOTD and OSC titles land around it).
//   - `spawn` with `detached: true` (own process group, no controlling tty: a background group on
//     a tty is stopped by SIGTTOU). The timeout kills the whole group with SIGKILL: an interactive
//     bash ignores SIGTERM, and a plain kill leaves grandchildren behind. 🔴 Never use the
//     `timeout` option of `execFile` / `spawnSync` (T0754 data D: 8 s / 38 s hangs).
//   - Finish on `exit`, not `close`, and `destroy()` the pipes: a grandchild started with `setsid`
//     can hold stdout open long after the shell is gone.
//   - Merge: login PATH first, then the entries only the original PATH had, deduplicated (first
//     occurrence wins). Login entries must be absolute; output with a newline or NUL is rejected.
//   - Any failure leaves PATH untouched and logs one line; the server starts as usual.
//   - Switch: `<dataDir>/settings.json` `headlessLoginShellPath` (`!== false` = on), read once at
//     startup. Off → no spawn, `process.env` not touched. No environment-variable override (D207).
//   - The log never contains the PATH itself, only counts.
//
// Called by scripts/bat-server.mjs before `createHeadlessServer` (never from inside it: tests
// call `createHeadlessServer` directly). This module must not import `electron`.

import { spawn as nodeSpawn, type ChildProcess, type SpawnOptions } from 'child_process'
import { randomBytes } from 'crypto'
import * as os from 'os'
import * as pathModule from 'path'
import { readHeadlessSettings } from './headless-handlers'
import { selectLoginShell } from '../remote-tools/probe-script'

/** Kill the login shell's process group after this long (T0754: median 123 ms, MOTD ~180 ms). */
export const LOGIN_SHELL_PATH_TIMEOUT_MS = 3000
/** After the SIGKILL, stop waiting for `exit` after this long (it normally arrives at once). */
export const LOGIN_SHELL_PATH_KILL_GRACE_MS = 500
/** Only the tail of stdout is kept; the marker is printed last. */
export const LOGIN_SHELL_PATH_MAX_STDOUT = 256 * 1024
/** `<dataDir>/settings.json` key; `!== false` = on (D206). */
export const HEADLESS_LOGIN_SHELL_PATH_SETTING = 'headlessLoginShellPath'

const LOG_PREFIX = '[bat-server] login shell PATH:'
const SHELL_PATH_RE = /^\/[A-Za-z0-9._/-]+$/
const WSL_DRIVE_ENTRY_RE = /^\/mnt\/[A-Za-z]\//

// ── pure logic ────────────────────────────────────────────────────────────────

export interface LoginShellChoice {
  shell: string
  /** fish prints `$PATH` as a list; it gets `string join : $PATH`. */
  kind: 'posix' | 'fish'
}

/**
 * `SHELL` → passwd shell → `/bin/sh`. POSIX-family shells go through `selectLoginShell` (same
 * whitelist as the remote PTY and the tools probe); an absolute `fish` is accepted separately.
 */
export function selectHeadlessLoginShell(envShell: string | undefined, userShell: string | undefined): LoginShellChoice {
  const candidate = envShell || userShell
  if (typeof candidate === 'string' && SHELL_PATH_RE.test(candidate) && pathModule.posix.basename(candidate) === 'fish') {
    return { shell: candidate, kind: 'fish' }
  }
  return { shell: selectLoginShell(candidate), kind: 'posix' }
}

/** A fresh marker per run, so nothing an rc file prints can forge it. */
export function makeLoginShellPathMarker(): string {
  return `__BAT_LOGIN_PATH_${randomBytes(12).toString('hex')}__`
}

/** argv for the login shell. The marker is `[A-Za-z0-9_]` only, safe inside single quotes. */
export function buildLoginShellPathArgs(kind: LoginShellChoice['kind'], marker: string): string[] {
  const value = kind === 'fish' ? '(string join : $PATH)' : '"$PATH"'
  return ['-l', '-i', '-c', `printf '\\n%s%s%s\\n' '${marker}' ${value} '${marker}'`]
}

export type LoginShellPathFailure = 'no-marker' | 'invalid-chars' | 'no-absolute-entries'

export type LoginShellPathResolution =
  | { ok: true; path: string; added: number; total: number; mntEntries: number }
  | { ok: false; reason: LoginShellPathFailure }

/** The value between the last marker pair in `stdout`, or `null`. */
export function extractMarkedValue(stdout: string, marker: string): string | null {
  const end = stdout.lastIndexOf(marker)
  if (end < 0) return null
  const start = stdout.lastIndexOf(marker, end - marker.length)
  if (start < 0 || start + marker.length > end) return null
  return stdout.slice(start + marker.length, end)
}

function splitPath(value: string, delimiter: string): string[] {
  return value.split(delimiter).filter(entry => entry.length > 0)
}

/**
 * Parse the shell's stdout and merge with the original PATH. Pure: no I/O, no `process.env`.
 * Login entries must be absolute (others are dropped); a newline or NUL anywhere in the marked
 * value rejects the whole result. Entries only the original PATH had are kept after the login
 * entries, so an entry an rc file removed does not disappear.
 */
export function resolveLoginShellPath(input: {
  stdout: string
  marker: string
  originalPath: string | undefined
  delimiter?: string
}): LoginShellPathResolution {
  const delimiter = input.delimiter ?? ':'
  const raw = extractMarkedValue(input.stdout, input.marker)
  if (raw === null) return { ok: false, reason: 'no-marker' }
  if (/[\n\r\0]/.test(raw)) return { ok: false, reason: 'invalid-chars' }
  const loginEntries = splitPath(raw, delimiter).filter(entry => entry.startsWith('/'))
  if (loginEntries.length === 0) return { ok: false, reason: 'no-absolute-entries' }

  const originalEntries = splitPath(input.originalPath ?? '', delimiter)
  const originalSet = new Set(originalEntries)
  const seen = new Set<string>()
  const merged: string[] = []
  for (const entry of [...loginEntries, ...originalEntries]) {
    if (seen.has(entry)) continue
    seen.add(entry)
    merged.push(entry)
  }
  return {
    ok: true,
    path: merged.join(delimiter),
    added: merged.filter(entry => !originalSet.has(entry)).length,
    total: merged.length,
    mntEntries: merged.filter(entry => WSL_DRIVE_ENTRY_RE.test(entry)).length,
  }
}

// ── running the login shell ───────────────────────────────────────────────────

export type LoginShellSpawn = (file: string, args: string[], options: SpawnOptions) => ChildProcess

export interface LoginShellRunDeps {
  spawn?: LoginShellSpawn
  /** Signal a whole process group: default `process.kill(-pid, signal)`. */
  killGroup?: (pid: number, signal: NodeJS.Signals) => void
  setTimer?: (fn: () => void, ms: number) => unknown
  clearTimer?: (handle: unknown) => void
  timeoutMs?: number
  killGraceMs?: number
}

export type LoginShellRunResult =
  | { kind: 'exited'; stdout: string; code: number | null; signal: NodeJS.Signals | null }
  | { kind: 'timeout'; stdout: string }
  | { kind: 'spawn-error'; code: string }

/**
 * Run the login shell detached and collect stdout. On timeout SIGKILL the process group; the run
 * ends on `exit` (never `close`) and the pipes are destroyed so a grandchild holding them cannot
 * keep the server waiting.
 */
export function runLoginShell(shell: string, args: string[], env: NodeJS.ProcessEnv, deps: LoginShellRunDeps = {}): Promise<LoginShellRunResult> {
  const spawnFn = deps.spawn ?? (nodeSpawn as LoginShellSpawn)
  const killGroup = deps.killGroup ?? ((pid: number, signal: NodeJS.Signals) => { process.kill(-pid, signal) })
  const setTimer = deps.setTimer ?? ((fn: () => void, ms: number) => setTimeout(fn, ms))
  const clearTimer = deps.clearTimer ?? ((handle: unknown) => clearTimeout(handle as ReturnType<typeof setTimeout>))
  const timeoutMs = deps.timeoutMs ?? LOGIN_SHELL_PATH_TIMEOUT_MS
  const killGraceMs = deps.killGraceMs ?? LOGIN_SHELL_PATH_KILL_GRACE_MS

  return new Promise<LoginShellRunResult>(resolve => {
    let child: ChildProcess
    try {
      child = spawnFn(shell, args, { detached: true, stdio: ['ignore', 'pipe', 'pipe'], env, windowsHide: true })
    } catch (error) {
      resolve({ kind: 'spawn-error', code: errorCode(error) })
      return
    }

    let stdout = ''
    let settled = false
    let timedOut = false
    let timer: unknown = null
    let graceTimer: unknown = null

    const finish = (result: LoginShellRunResult) => {
      if (settled) return
      settled = true
      if (timer !== null) clearTimer(timer)
      if (graceTimer !== null) clearTimer(graceTimer)
      child.stdout?.destroy()
      child.stderr?.destroy()
      resolve(result)
    }

    child.stdout?.setEncoding('utf8')
    child.stdout?.on('data', (chunk: string) => {
      stdout += chunk
      if (stdout.length > LOGIN_SHELL_PATH_MAX_STDOUT) stdout = stdout.slice(-LOGIN_SHELL_PATH_MAX_STDOUT)
    })
    // stderr is drained and dropped (`-i` without a tty prints job-control warnings there).
    child.stderr?.on('data', () => {})
    child.stdout?.on('error', () => {})
    child.stderr?.on('error', () => {})

    child.on('error', (error: Error) => {
      finish({ kind: 'spawn-error', code: errorCode(error) })
    })
    child.on('exit', (code: number | null, signal: NodeJS.Signals | null) => {
      finish(timedOut ? { kind: 'timeout', stdout } : { kind: 'exited', stdout, code, signal })
    })

    timer = setTimer(() => {
      if (settled) return
      timedOut = true
      const pid = child.pid
      if (typeof pid === 'number' && pid > 0) {
        try {
          killGroup(pid, 'SIGKILL')
        } catch {
          try { child.kill('SIGKILL') } catch { /* already gone */ }
        }
      }
      graceTimer = setTimer(() => finish({ kind: 'timeout', stdout }), killGraceMs)
    }, timeoutMs)
  })
}

function errorCode(error: unknown): string {
  const code = (error as NodeJS.ErrnoException | undefined)?.code
  return typeof code === 'string' && /^[A-Z0-9_]+$/.test(code) ? code : 'unknown'
}

// ── applying it at startup ────────────────────────────────────────────────────

export interface HeadlessLoginPathLogger {
  log: (message: string) => void
  warn?: (message: string) => void
}

export interface ApplyHeadlessLoginShellPathDeps extends LoginShellRunDeps {
  platform?: NodeJS.Platform
  /** Read and written in place; default `process.env`. */
  env?: NodeJS.ProcessEnv
  getUserShell?: () => string | undefined
  readSettings?: (dataDir: string) => Record<string, unknown>
  makeMarker?: () => string
  now?: () => number
}

export type ApplyHeadlessLoginShellPathResult =
  | { status: 'applied'; shell: string; elapsedMs: number; added: number; total: number; mntEntries: number }
  | { status: 'off' }
  | { status: 'skipped'; reason: 'win32' }
  | { status: 'failed'; reason: string; shell: string; elapsedMs: number }

function defaultUserShell(): string | undefined {
  try {
    const shell = os.userInfo().shell
    return typeof shell === 'string' && shell.length > 0 ? shell : undefined
  } catch {
    return undefined
  }
}

/** True unless `<dataDir>/settings.json` has `headlessLoginShellPath: false`. */
export function isHeadlessLoginShellPathEnabled(settings: Record<string, unknown>): boolean {
  return settings[HEADLESS_LOGIN_SHELL_PATH_SETTING] !== false
}

/**
 * Called once by bat-server before the server is created. Never throws: every failure leaves
 * `PATH` as it was, logs one line and lets the server start.
 */
export async function applyHeadlessLoginShellPath(opts: {
  dataDir: string
  logger?: HeadlessLoginPathLogger
  deps?: ApplyHeadlessLoginShellPathDeps
}): Promise<ApplyHeadlessLoginShellPathResult> {
  const deps = opts.deps ?? {}
  const logger = opts.logger ?? console
  const warn = (message: string) => (logger.warn ?? logger.log).call(logger, message)

  const platform = deps.platform ?? process.platform
  if (platform === 'win32') {
    logger.log(`${LOG_PREFIX} skipped (win32)`)
    return { status: 'skipped', reason: 'win32' }
  }

  let settings: Record<string, unknown>
  try {
    settings = (deps.readSettings ?? readHeadlessSettings)(opts.dataDir)
  } catch {
    settings = {}
  }
  if (!isHeadlessLoginShellPathEnabled(settings)) {
    logger.log(`${LOG_PREFIX} off (setting)`)
    return { status: 'off' }
  }

  const env = deps.env ?? process.env
  const now = deps.now ?? (() => Date.now())
  const { shell, kind } = selectHeadlessLoginShell(env.SHELL, (deps.getUserShell ?? defaultUserShell)())
  const marker = (deps.makeMarker ?? makeLoginShellPathMarker)()
  const started = now()

  let result: ApplyHeadlessLoginShellPathResult
  try {
    const run = await runLoginShell(shell, buildLoginShellPathArgs(kind, marker), env, deps)
    const elapsedMs = Math.max(0, Math.round(now() - started))
    if (run.kind === 'spawn-error') {
      result = { status: 'failed', reason: `spawn error ${run.code}`, shell, elapsedMs }
    } else if (run.kind === 'timeout') {
      result = { status: 'failed', reason: `timeout ${deps.timeoutMs ?? LOGIN_SHELL_PATH_TIMEOUT_MS} ms`, shell, elapsedMs }
    } else {
      const resolved = resolveLoginShellPath({ stdout: run.stdout, marker, originalPath: env.PATH })
      if (!resolved.ok) {
        const exit = run.signal ? `signal ${run.signal}` : `exit ${run.code}`
        result = { status: 'failed', reason: `${resolved.reason}, ${exit}`, shell, elapsedMs }
      } else {
        env.PATH = resolved.path
        result = {
          status: 'applied',
          shell,
          elapsedMs,
          added: resolved.added,
          total: resolved.total,
          mntEntries: resolved.mntEntries,
        }
      }
    }
  } catch (error) {
    result = { status: 'failed', reason: `error ${errorCode(error)}`, shell, elapsedMs: Math.max(0, Math.round(now() - started)) }
  }

  if (result.status === 'applied') {
    logger.log(
      `${LOG_PREFIX} applied (shell=${result.shell}, ${result.elapsedMs} ms, +${result.added} entries, ` +
        `${result.total} total, /mnt ${result.mntEntries})`,
    )
  } else if (result.status === 'failed') {
    warn(`${LOG_PREFIX} failed (${result.reason}; shell=${result.shell}, ${result.elapsedMs} ms) — PATH unchanged`)
  }
  return result
}
