/**
 * T0816 (PLAN-062 option A3, BUG-209): the AppImage keepalive pipe, and the stdio of the Terminal Server fork.
 *
 * The AppImage runtime forks: the child runs the FUSE mount (its `/proc/<pid>/exe` is the `.AppImage`
 * file, it never execs) and holds the write end of a "keepalive" pipe; the parent keeps the read end and
 * execs AppRun → BAT. When every holder of the read end is gone, the FUSE process unmounts
 * `/tmp/.mount_*` and exits. BAT's main process holds the read end at fd 3 on a normal start (fd 5 under
 * Playwright, after its own fd 3 / 4).
 *
 * BUG-209: the Terminal Server fork put its IPC channel on fd 3, which replaced the keepalive at fd 3
 * in the child, so a server kept across a BAT quit ran from an unmounted image (`/proc/<server>/exe`
 * read back ENOTCONN, T0812). Now the server gets the keepalive explicitly at fd 4 (`stdio[4]`) and the
 * fd guard closes everything else ≥ 3 except the IPC fd (`runWithoutCrashpadClient`,
 * electron/child-process-fd-guard.ts).
 *
 * `findAppImageKeepaliveFd` only reads /proc through `deps` (tests pass a fake /proc) and never throws.
 * No electron import.
 */
import * as fs from 'fs'

/** The fd the Terminal Server gets the keepalive at (`stdio[4]`; 3 is fork's IPC channel). */
export const TERMINAL_SERVER_KEEPALIVE_FD = 4

export interface AppImageKeepaliveDeps {
  /** `process.env` (only `APPIMAGE` is read) */
  env: NodeJS.ProcessEnv
  /** this process's pid (never taken for the runtime process) */
  selfPid: number
  readdir: (dir: string) => string[]
  readlink: (p: string) => string
  readFile: (p: string) => string
  /** realpath of the `APPIMAGE` value (may throw) */
  realpath: (p: string) => string
}

export type AppImageKeepaliveSkipReason =
  | 'not-appimage' // APPIMAGE not set: not started from an AppImage
  | 'no-runtime-process' // no process whose exe is the AppImage file
  | 'not-found' // no pipe of this process whose other end the runtime process holds
  | 'ambiguous' // more than one such pipe
  | 'error' // /proc unreadable

export type AppImageKeepaliveResult =
  | { fd: number; runtimePid: number }
  | { fd: null; reason: AppImageKeepaliveSkipReason; detail?: string }

const PIPE = /^pipe:\[(\d+)\]$/
const DELETED = ' (deleted)'

/** O_ACCMODE of an open fd from /proc/<pid>/fdinfo/<fd> (`flags:` is octal); null when unreadable. */
function accessMode(deps: AppImageKeepaliveDeps, pid: string, fd: string): number | null {
  try {
    const m = /^flags:\s+([0-7]+)/m.exec(deps.readFile(`/proc/${pid}/fdinfo/${fd}`))
    return m ? parseInt(m[1], 8) & 3 : null
  } catch {
    return null
  }
}

/** fd → pipe inode for the numeric fds of `/proc/<pid>/fd` that are pipes (unreadable entries skipped). */
function pipesOf(deps: AppImageKeepaliveDeps, pid: string): Map<number, string> {
  const out = new Map<number, string>()
  for (const name of deps.readdir(`/proc/${pid}/fd`)) {
    if (!/^\d+$/.test(name)) continue
    try {
      const m = PIPE.exec(deps.readlink(`/proc/${pid}/fd/${name}`))
      if (m) out.set(Number(name), m[1])
    } catch { /* closed meanwhile */ }
  }
  return out
}

/**
 * The fd of this process that is the AppImage keepalive: a pipe fd ≥ 3 whose other end (a different
 * access mode on the same pipe inode, i.e. not a shared file description) is held by a process whose
 * exe is the `APPIMAGE` file. null with a reason otherwise; never throws.
 */
export function findAppImageKeepaliveFd(deps: AppImageKeepaliveDeps): AppImageKeepaliveResult {
  const appImage = deps.env.APPIMAGE
  if (!appImage) return { fd: null, reason: 'not-appimage' }
  try {
    const names = new Set([appImage])
    try { names.add(deps.realpath(appImage)) } catch { /* the file may be gone; compare the value only */ }

    const self = String(deps.selfPid)
    const own = new Map<string, Array<{ fd: number; mode: number | null }>>() // inode → this process's fds
    for (const [fd, inode] of pipesOf(deps, 'self')) {
      if (fd < 3) continue // stdio: never the keepalive (the runtime execs with them untouched)
      const list = own.get(inode) ?? []
      list.push({ fd, mode: accessMode(deps, 'self', String(fd)) })
      own.set(inode, list)
    }

    const runtimePids: string[] = []
    for (const name of deps.readdir('/proc')) {
      if (!/^\d+$/.test(name) || name === self) continue
      let exe: string
      try { exe = deps.readlink(`/proc/${name}/exe`) } catch { continue } // other users' / gone
      if (exe.endsWith(DELETED)) exe = exe.slice(0, -DELETED.length)
      if (names.has(exe)) runtimePids.push(name)
    }
    if (runtimePids.length === 0) return { fd: null, reason: 'no-runtime-process' }

    const matches = new Map<string, { fd: number; runtimePid: number }>() // inode → lowest own fd
    for (const pid of runtimePids) {
      let theirs: Map<number, string>
      try { theirs = pipesOf(deps, pid) } catch { continue }
      for (const [fd, inode] of theirs) {
        const mine = own.get(inode)
        if (!mine) continue
        const mode = accessMode(deps, pid, String(fd))
        // the other end of the pipe: a shared description (inherited by both) has the same mode
        const other = mine.filter(m => m.mode !== null && mode !== null && m.mode !== mode)
        if (other.length === 0) continue
        const lowest = Math.min(...other.map(m => m.fd))
        const prev = matches.get(inode)
        if (!prev || lowest < prev.fd) matches.set(inode, { fd: lowest, runtimePid: Number(pid) })
      }
    }
    if (matches.size === 0) return { fd: null, reason: 'not-found' }
    if (matches.size > 1) return { fd: null, reason: 'ambiguous', detail: `${matches.size} pipes` }
    return [...matches.values()][0]
  } catch (err) {
    return { fd: null, reason: 'error', detail: err instanceof Error ? err.message : String(err) }
  }
}

/** Production deps: the real /proc of this process. */
export function defaultAppImageKeepaliveDeps(): AppImageKeepaliveDeps {
  return {
    env: process.env,
    selfPid: process.pid,
    readdir: dir => fs.readdirSync(dir),
    readlink: p => fs.readlinkSync(p),
    readFile: p => fs.readFileSync(p, 'utf8'),
    realpath: p => fs.realpathSync(p),
  }
}

export type TerminalServerStdio = Array<'ignore' | 'ipc' | number>

export interface TerminalServerForkPlan {
  stdio: TerminalServerStdio
  /** the main-process fd passed as the server's fd 4; null = none */
  keepaliveFd: number | null
  /** one `[terminal-server]` debug log line (Linux only; null elsewhere) */
  log: string | null
}

/**
 * The stdio of the Terminal Server fork. Not Linux → `['ignore','ignore','ignore','ipc']` and no log, no
 * /proc read (Windows / macOS unchanged). Linux → the same, plus the keepalive as `stdio[4]` when found.
 * 🔴 Never `'ignore'` in slot 4: libuv leaves fd 4 alone for UV_IGNORE and the fd guard keeps every fd
 * below the stdio count, so the main process's own fd 4 would reach the server (T0812). `find` failing
 * or throwing → no keepalive (start as before), logged.
 */
export function planTerminalServerFork(platform: NodeJS.Platform, find: () => AppImageKeepaliveResult): TerminalServerForkPlan {
  const base: TerminalServerStdio = ['ignore', 'ignore', 'ignore', 'ipc']
  if (platform !== 'linux') return { stdio: base, keepaliveFd: null, log: null }
  let r: AppImageKeepaliveResult
  try {
    r = find()
  } catch (err) {
    r = { fd: null, reason: 'error', detail: err instanceof Error ? err.message : String(err) }
  }
  const prefix = '[terminal-server] fork (Linux, PLAN-062 A3): fd guard without crashpad client'
  if (r.fd !== null) {
    return {
      stdio: [...base, r.fd],
      keepaliveFd: r.fd,
      log: `${prefix}; AppImage keepalive fd ${r.fd} → ${TERMINAL_SERVER_KEEPALIVE_FD} (runtime pid ${r.runtimePid})`,
    }
  }
  return {
    stdio: base,
    keepaliveFd: null,
    log: `${prefix}; AppImage keepalive: none (${r.reason}${r.detail ? `: ${r.detail}` : ''})`,
  }
}
