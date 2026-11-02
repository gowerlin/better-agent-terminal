// T0797: Linux helpers for the GitHub Actions Linux runner acceptance (e2e/linux/).
//
// Everything here only reads the system (/proc, /etc/os-release, ldd, ldconfig) or starts the AppImage under
// test. Nothing changes a sysctl, AppArmor profile or sandbox setting: when the system refuses (FUSE missing,
// user namespaces restricted), the refusal is the result and is recorded as such.

import { execFile, spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

export interface CmdResult {
  /** exit code; null when the process was killed (timeout) or could not start */
  code: number | null
  stdout: string
  stderr: string
  ms: number
  timedOut: boolean
  error?: string
}

/**
 * execFile that never rejects; output trimmed to `outLimit` chars per stream (default 2000, for reports).
 * Pass a larger limit when the caller searches the output (e.g. `ldconfig -p`, which is far longer than 2000
 * chars: T0798 found `libfuse2` reported as not found because its line was cut off).
 */
export function runCmd(file: string, args: string[], timeoutMs = 30_000, outLimit = 2000): Promise<CmdResult> {
  const started = Date.now()
  return new Promise(resolve => {
    execFile(file, args, { timeout: timeoutMs, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 }, (err, stdout, stderr) => {
      const e = err as (NodeJS.ErrnoException & { killed?: boolean; code?: number | string; signal?: string }) | null
      const timedOut = !!e && (e.killed === true || e.signal === 'SIGTERM') && Date.now() - started >= timeoutMs - 50
      resolve({
        code: e ? (typeof e.code === 'number' ? e.code : null) : 0,
        stdout: String(stdout ?? '').trim().slice(0, outLimit),
        stderr: String(stderr ?? '').trim().slice(0, outLimit),
        ms: Date.now() - started,
        timedOut,
        error: e && typeof e.code !== 'number' ? `${e.code ?? ''} ${e.message}`.trim().slice(0, 400) : undefined,
      })
    })
  })
}

export function describeCmd(r: CmdResult): string {
  const parts = [`exit=${r.code ?? 'none'}`, `${r.ms}ms`]
  if (r.timedOut) parts.push('TIMEOUT')
  if (r.stdout) parts.push(`stdout=${JSON.stringify(r.stdout)}`)
  if (r.stderr) parts.push(`stderr=${JSON.stringify(r.stderr)}`)
  if (r.error) parts.push(`error=${JSON.stringify(r.error)}`)
  return parts.join(' ')
}

function readText(file: string): string | null {
  try {
    return fs.readFileSync(file, 'utf8')
  } catch {
    return null
  }
}

/** Minimal ANSI strip for reading shell output (CSI, OSC, single ESC sequences). */
export function stripAnsi(s: string): string {
  return s
    .replace(/\x1b\][^\x07\x1b]*(\x07|\x1b\\)/g, '')
    .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '')
    .replace(/\x1b[@-Z\\-_]/g, '')
}

// ---------------------------------------------------------------- system facts

export interface SystemInfo {
  os: string
  kernel: string
  glibc: string
  /** /proc/sys/kernel/apparmor_restrict_unprivileged_userns ('absent' when the file does not exist) */
  apparmorRestrictUserns: string
  /** /proc/sys/kernel/unprivileged_userns_clone ('absent' when the file does not exist) */
  unprivilegedUsernsClone: string
  /** /proc/sys/user/max_user_namespaces */
  maxUserNamespaces: string
  devFuse: boolean
  libfuse2: string
  display: string
}

export async function systemInfo(): Promise<SystemInfo> {
  const osRelease = readText('/etc/os-release') ?? ''
  const pretty = /^PRETTY_NAME="?([^"\n]*)"?/m.exec(osRelease)?.[1] ?? 'unknown'
  const uname = await runCmd('uname', ['-r'])
  // `ldd --version` prints e.g. "ldd (Ubuntu GLIBC 2.35-0ubuntu3.8) 2.35" on its first line
  const ldd = await runCmd('ldd', ['--version'])
  const sys = (p: string) => (readText(p) ?? 'absent').trim()
  const ldconfig = await runCmd('ldconfig', ['-p'], 30_000, 4 * 1024 * 1024)
  const fuse2 = ldconfig.stdout.split('\n').filter(l => /libfuse\.so\.2/.test(l)).map(l => l.trim()).join('; ')
  return {
    os: pretty,
    kernel: uname.stdout || describeCmd(uname),
    glibc: (ldd.stdout.split('\n')[0] ?? '').trim() || describeCmd(ldd),
    apparmorRestrictUserns: sys('/proc/sys/kernel/apparmor_restrict_unprivileged_userns'),
    unprivilegedUsernsClone: sys('/proc/sys/kernel/unprivileged_userns_clone'),
    maxUserNamespaces: sys('/proc/sys/user/max_user_namespaces'),
    devFuse: fs.existsSync('/dev/fuse'),
    libfuse2: fuse2 || 'not found (ldconfig -p)',
    display: process.env.DISPLAY ?? '(unset)',
  }
}

// ---------------------------------------------------------------- process / sandbox facts

/** argv of a running process from /proc/<pid>/cmdline ('' when unreadable). */
export function procCmdline(pid: number): string[] {
  const raw = readText(`/proc/${pid}/cmdline`)
  return raw ? raw.split('\0').filter(Boolean) : []
}

export interface SandboxView {
  pid: number
  type: string
  /** NSpid line of /proc/<pid>/status; two or more values = the process lives in its own PID namespace */
  nspid: string
  /**
   * Seccomp line (2 = a seccomp-bpf filter is installed). Informational only: the local WSL run with
   * `--no-sandbox` still showed 2 on GPU / Utility / Tab, so it does not tell whether the sandbox is on.
   */
  seccomp: string
  sandboxed: boolean
}

/**
 * Chromium sandbox evidence for Electron child processes, without relying on Electron's own flags:
 * a renderer under the namespace or setuid sandbox runs in its own PID namespace (`NSpid` lists two
 * values); `--no-sandbox` leaves it in the parent's namespace (one value).
 */
export function sandboxView(pid: number, type: string): SandboxView {
  const status = readText(`/proc/${pid}/status`) ?? ''
  const nspid = /^NSpid:\s*(.*)$/m.exec(status)?.[1]?.trim() ?? '?'
  const seccomp = /^Seccomp:\s*(.*)$/m.exec(status)?.[1]?.trim() ?? '?'
  const sandboxed = nspid.split(/\s+/).length > 1
  return { pid, type, nspid, seccomp, sandboxed }
}

// ---------------------------------------------------------------- BAT debug log

export interface DebugLogView {
  files: string[]
  /** the `[startup] Debug logging started. PID=… argv=…` line (electron/logger.ts) */
  startupLine: string
  /** the `[sandbox] …` line (T0799, electron/linux-sandbox-fallback.ts); '' when missing */
  sandboxLine: string
  /** `[CRASH] …` lines (electron/main.ts uncaughtException / unhandledRejection / *-process-gone, early-crash-log.ts) */
  crashLines: string[]
  errorCount: number
  errorSamples: string[]
}

/**
 * Reads `<userData>/Logs/debug-*.log`. Line format (electron/logger.ts `writeToFile`): `[<ts>] [<LEVEL>] <message>`.
 * Fatal = any `[CRASH]` line; `[ERROR]` lines are counted and sampled, not judged.
 */
export function readDebugLogs(userData: string): DebugLogView {
  const dir = path.join(userData, 'Logs')
  let files: string[] = []
  try {
    files = fs.readdirSync(dir).filter(f => /^debug-.*\.log$/.test(f)).sort()
  } catch { /* no Logs directory */ }
  const lines = files.flatMap(f => (readText(path.join(dir, f)) ?? '').split('\n'))
  const clip = (l: string) => (l.length > 300 ? `${l.slice(0, 300)}…` : l)
  const errors = lines.filter(l => /\] \[ERROR\] /.test(l))
  return {
    files: files.map(f => path.join(dir, f)),
    startupLine: clip(lines.find(l => l.includes('[startup] Debug logging started.')) ?? ''),
    sandboxLine: clip(lines.find(l => l.includes('] [sandbox] ')) ?? ''),
    crashLines: lines.filter(l => l.includes('[CRASH]')).map(clip),
    errorCount: errors.length,
    errorSamples: errors.slice(0, 8).map(clip),
  }
}

// ---------------------------------------------------------------- plain launch (level ②)

export interface PlainLaunchResult {
  /** process still running after `holdMs` */
  aliveAfterHold: boolean
  exitCode: number | null
  exitSignal: string | null
  /** stderr / stdout tail (2000 chars) */
  outputTail: string
  /** the first 2000 chars of stderr / stdout (T0799: the launcher's line comes first and falls out of the tail) */
  outputHead: string
  /** how the process ended: 'SIGTERM' (exited within the grace period) / 'SIGKILL' / 'exited by itself' */
  ended: string
  ms: number
  /** ms after spawn when `ready()` first returned true; null when it never did (or no `ready` was given) */
  readyAfterMs: number | null
  /** when the SIGTERM was sent (ISO); null when the process exited by itself first */
  termSentAt: string | null
}

export interface PlainLaunchOptions {
  /** polled every 500 ms; the `holdMs` hold starts when it returns true (T0799: the debug log exists) */
  ready?: () => boolean
  /** longest wait for `ready` before the hold starts anyway (default 0 = no wait) */
  readyMaxMs?: number
}

/**
 * Starts the AppImage the way a user does from a terminal (no Playwright, no debugging flags), waits until
 * `opts.ready()` (at most `opts.readyMaxMs`; T0799: a slow FUSE + xz start on 24.04 took > 20 s before the
 * debug log existed), waits `holdMs`, then sends SIGTERM to its process group and SIGKILL after `graceMs`.
 * Children killed by that SIGTERM log `[CRASH] child-process-gone`; callers judge only lines before `termSentAt`. BAT answers SIGTERM with
 * its quit confirmation dialog (T0144, electron/main.ts `before-quit`), so 'SIGKILL' after a SIGTERM is
 * expected when nobody answers the dialog; it is recorded, not judged.
 */
export function plainLaunch(executable: string, args: string[], env: Record<string, string>, holdMs = 20_000, graceMs = 10_000, opts: PlainLaunchOptions = {}): Promise<PlainLaunchResult> {
  const started = Date.now()
  return new Promise(resolve => {
    let out = ''
    let head = ''
    let exitCode: number | null = null
    let exitSignal: string | null = null
    let exited = false
    let readyAfterMs: number | null = null
    let termSentAt: string | null = null
    const child = spawn(executable, args, { env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] })
    const keep = (d: Buffer) => {
      const t = d.toString('utf8')
      if (head.length < 2000) head = (head + t).slice(0, 2000)
      out = (out + t).slice(-8000)
    }
    child.stdout?.on('data', keep)
    child.stderr?.on('data', keep)
    // a spawn failure (EACCES, ENOENT) emits 'error' and no 'exit'
    child.on('error', err => { exited = true; out += `\nspawn error: ${err.message}` })
    child.on('exit', (code, signal) => { exited = true; exitCode = code; exitSignal = signal })
    const killGroup = (sig: NodeJS.Signals) => {
      try { if (child.pid) process.kill(-child.pid, sig) } catch { /* gone */ }
    }
    const finish = (aliveAfterHold: boolean, ended: string) => resolve({
      aliveAfterHold, exitCode, exitSignal, outputTail: out.slice(-2000), outputHead: head, ended, ms: Date.now() - started, readyAfterMs, termSentAt,
    })
    const hold = () => setTimeout(() => {
      if (exited) { finish(false, 'exited by itself'); return }
      termSentAt = new Date().toISOString()
      killGroup('SIGTERM')
      setTimeout(() => {
        if (exited) { finish(true, 'SIGTERM'); return }
        killGroup('SIGKILL')
        setTimeout(() => finish(true, 'SIGKILL'), 2_000)
      }, graceMs)
    }, holdMs)
    const readyMaxMs = opts.ready ? opts.readyMaxMs ?? 0 : 0
    const poll = () => {
      let ok = false
      try { ok = !!opts.ready?.() } catch { /* not ready */ }
      if (ok) readyAfterMs = Date.now() - started
      if (ok || exited || Date.now() - started >= readyMaxMs) { hold(); return }
      setTimeout(poll, 500)
    }
    poll()
  })
}
