/**
 * BUG-206 / BUG-207 / T0807 (D253): on Linux a `child_process` child only keeps its stdio fds.
 *
 * Same cause as BUG-205 (T0805 / T0806, `electron/pty-spawn-fd-guard.ts`): Chromium opens its files
 * and sockets without FD_CLOEXEC, `@lydell/node-pty` 1.1.0 opens every pty master without it, and
 * libuv forks + execs a `child_process` child without closing them. So on Linux:
 *  - BUG-206: the headless bat-server and the Electron direct mode hold every tab's pty master, and
 *    every `child_process` child (claude CLI of the Claude panel, git — whose hooks run repo code —,
 *    codex, ssh…) inherited all of them;
 *  - BUG-207: every child of the Electron main process inherited Chromium's ~49 descriptors.
 * Windows (handles not inheritable) and macOS (`POSIX_SPAWN_CLOEXEC_DEFAULT`) are not affected and
 * are left alone: nothing is installed there.
 *
 * How: `installChildProcessFdGuard()` wraps the two libuv entry points every `child_process` API ends
 * in — `process_wrap` `Process.prototype.spawn` (spawn / execFile / exec / fork, also from inside
 * third-party code such as the Claude Agent SDK) and `spawn_sync.spawn` (spawnSync / execFileSync /
 * execSync). Each spawn whose command resolves to an executable file is run through bash, which
 * closes every fd ≥ <stdio count> listed in /proc/self/fd and then `exec`s the original command:
 *
 *   /bin/bash -c <CHILD_FD_GUARD_SCRIPT> bat-child-fd-guard <flags> <BASH_ENV> <PWD> <keep> <extra> <argv0> <target> <args…>
 *
 * Invariants (T0807, checked in WSL — docs/agent-guide/linux-pty-fd-inheritance.md):
 *  - fds 0 … stdio.length-1 stay open (the child's stdio, an extra `pipe`, fork's IPC channel that
 *    `NODE_CHANNEL_FD` names); so does the fd the child env's `CRASHDUMP_SIGNAL_FD` names (Electron's
 *    own crash reporting in an `ELECTRON_RUN_AS_NODE` child, unchanged);
 *  - the pid is the command's (the wrapper `exec`s into it); argv is the one libuv would have
 *    passed (argv[0] = `args[0]`, i.e. `argv0` / `file`, via `exec -a`), and the executed file is the
 *    one libuv's PATH search would have picked (same search, done here: `resolveChildExecutable`);
 *  - a command that does not resolve to an executable file is NOT wrapped, so `spawn` still fails
 *    with the same ENOENT / EACCES error (and no process exists that could inherit anything);
 *  - env: `BASH_ENV` is not given to the wrapper (bash would source it) and re-exported, `PWD` is
 *    re-exported or unset as it was, an absent `SHLVL` stays absent (/usr/bin/env -u SHLVL, only when
 *    argv0 = file — otherwise argv0 wins and the child sees `SHLVL=0`); bash's own `_`, a non-directory
 *    `OLDPWD` and a rewritten exported `SHELLOPTS` / `BASHOPTS` / `BASH_FUNC_*%%` remain (same as T0806);
 *  - cwd, uid / gid, detached (setsid), stdio, timeouts and kill semantics are libuv's, untouched;
 *  - the script is a fixed string; every value is a positional parameter, never parsed as shell
 *    code (CLAUDE.md "Child Process Spawning").
 *
 * Not wrapped: not Linux; no bash; the command does not resolve; it already is a PTY / child fd
 * guard (the `PtyManager` child_process fallback); inside `runWithoutChildProcessFdGuard()` (the
 * Terminal Server fork: PLAN-062 option C, out of scope). Any unexpected binding call shape or an
 * exception in the guard spawns the original command unchanged and logs one line (fail open: a
 * broken guard must not stop BAT from starting git / claude).
 *
 * `guardChildSpawn` / `resolveChildExecutable` are pure (no electron, no fs — the caller passes
 * `fileExists` / `isExecutableFile`). Installed by `electron/main.ts` (Electron main process) and
 * `scripts/bat-server.mjs` (headless, via `server-entry`); never by the Terminal Server.
 */
import * as fs from 'fs'
import * as path from 'path'
import { PTY_FD_GUARD_BASH_CANDIDATES, PTY_FD_GUARD_ENV_PATH, PTY_FD_GUARD_SCRIPT } from './pty-spawn-fd-guard'

/** `$0` of the wrapper bash: bash prefixes its own error messages with it. */
export const CHILD_FD_GUARD_NAME = 'bat-child-fd-guard'

/** libuv's PATH when the child env has none (glibc `_PATH_DEFPATH`). */
export const CHILD_FD_GUARD_DEFAULT_PATH = '/usr/bin:/bin'

/**
 * The fixed wrapper script. `$1` = flags (`B` re-export BASH_ENV from `$2`, `W` re-export PWD from
 * `$3`, `P` unset PWD, `S` exec through /usr/bin/env -u SHLVL), `$4` = keep every fd below this
 * (the stdio count), `$5` = one more fd to keep (empty = none), `$6` = argv0, `$7` = the file to
 * exec, the rest = its arguments. The fd loop runs in a function (positional parameters, no
 * variable that could shadow an exported one) with `local -` / `local GLOBIGNORE` like T0806's.
 */
export const CHILD_FD_GUARD_SCRIPT = [
  'case $1 in *B*) export BASH_ENV="$2";; esac',
  'case $1 in *W*) export PWD="$3";; *P*) unset PWD;; esac',
  '_bat_close_fds() {',
  '  local - _bat_fd GLOBIGNORE=',
  '  set +f',
  '  for _bat_fd in /proc/self/fd/*; do',
  '    _bat_fd=${_bat_fd##*/}',
  "    case $_bat_fd in ''|*[!0-9]*) continue;; esac",
  '    if (( _bat_fd < $1 )) || [[ $_bat_fd == "$2" ]]; then continue; fi',
  '    exec {_bat_fd}>&-',
  '  done',
  '}',
  'if (( BASH_VERSINFO[0] > 4 || (BASH_VERSINFO[0] == 4 && BASH_VERSINFO[1] >= 1) )); then _bat_close_fds "$4" "$5"; fi',
  'unset -f _bat_close_fds',
  `case $1 in *S*) shift 6; exec ${PTY_FD_GUARD_ENV_PATH} -u SHLVL -- "$@";; esac`,
  'shift 5',
  'exec -a "$1" "${@:2}"',
].join('\n')

/** What a libuv spawn is about to run (async and sync bindings carry the same fields). */
export interface ChildSpawnRequest {
  file: string
  /** argv including argv[0] (`argv0` option, else `file`) */
  args: readonly string[]
  cwd?: string
  /** `KEY=value` list; undefined = the child inherits this process's environment */
  envPairs?: readonly string[]
  /** number of fds the child gets from `stdio` (0 … n-1) */
  stdioCount: number
}

export interface ChildFdGuardDeps {
  platform: NodeJS.Platform
  /** existence of the wrapper bash and /usr/bin/env (`fs.existsSync` in production) */
  fileExists: (p: string) => boolean
  /** regular file with execute permission for this process (stat + access X_OK in production) */
  isExecutableFile: (p: string) => boolean
  /** this process's cwd (a relative `cwd` / PATH entry is resolved against the child's cwd) */
  cwd: () => string
  /** this process's env, used when `envPairs` is undefined */
  processEnv: () => NodeJS.ProcessEnv
}

export type ChildFdGuardSkipReason = 'not-linux' | 'no-bash' | 'not-found' | 'already-guarded'

export type ChildFdGuardResult =
  | { wrapped: true; file: string; args: string[]; envPairs: string[] }
  | { wrapped: false; reason: ChildFdGuardSkipReason }

const keyOf = (pair: string): string => {
  const i = pair.indexOf('=')
  return i < 0 ? pair : pair.slice(0, i)
}

function lastValue(pairs: readonly string[], key: string): string | undefined {
  let value: string | undefined
  for (const p of pairs) if (keyOf(p) === key) value = p.slice(key.length + 1)
  return value
}

/**
 * The file libuv would `execve` for `file` (uv__execvpe): a name with a slash as is, otherwise the
 * first executable candidate on the child env's PATH (default `/usr/bin:/bin`; an empty entry is the
 * cwd). Relative results stay relative to the child's cwd (the wrapper runs there too) but always
 * contain a slash, so bash never searches PATH again. null = libuv would fail (ENOENT / EACCES).
 */
export function resolveChildExecutable(
  file: string,
  pathValue: string | undefined,
  childCwd: string,
  isExecutableFile: (p: string) => boolean,
): string | null {
  if (file === '') return null
  const abs = (p: string) => path.posix.resolve(childCwd, p)
  if (file.includes('/')) return isExecutableFile(abs(file)) ? file : null
  for (const dir of (pathValue ?? CHILD_FD_GUARD_DEFAULT_PATH).split(':')) {
    // always contains a slash ("/" → "/file", "bin" → "bin/file", "" → "./file")
    const candidate = dir === '' ? `./${file}` : `${dir.replace(/\/+$/, '')}/${file}`
    if (isExecutableFile(abs(candidate))) return candidate
  }
  return null
}

function isAlreadyGuarded(req: ChildSpawnRequest): boolean {
  return (PTY_FD_GUARD_BASH_CANDIDATES as readonly string[]).includes(req.file)
    && req.args[1] === '-c'
    && (req.args[2] === PTY_FD_GUARD_SCRIPT || req.args[2] === CHILD_FD_GUARD_SCRIPT)
}

/**
 * Returns what to hand libuv instead of `req`, or why it is left alone. Pure: platform and file
 * checks come from `deps`.
 */
export function guardChildSpawn(req: ChildSpawnRequest, deps: ChildFdGuardDeps): ChildFdGuardResult {
  if (deps.platform !== 'linux') return { wrapped: false, reason: 'not-linux' }
  const wrapper = PTY_FD_GUARD_BASH_CANDIDATES.find(p => deps.fileExists(p))
  if (!wrapper) return { wrapped: false, reason: 'no-bash' }
  if (isAlreadyGuarded(req)) return { wrapped: false, reason: 'already-guarded' }

  const pairs: string[] = req.envPairs
    ? [...req.envPairs]
    : Object.entries(deps.processEnv()).filter((e): e is [string, string] => typeof e[1] === 'string').map(([k, v]) => `${k}=${v}`)
  const childCwd = path.posix.resolve(deps.cwd(), req.cwd || '.')
  const resolved = resolveChildExecutable(req.file, lastValue(pairs, 'PATH'), childCwd, deps.isExecutableFile)
  if (resolved === null) return { wrapped: false, reason: 'not-found' }

  const argv0 = req.args.length > 0 ? req.args[0] : req.file
  let flags = ''
  const bashEnv = lastValue(pairs, 'BASH_ENV')
  if (bashEnv !== undefined) flags += 'B'
  const pwd = lastValue(pairs, 'PWD')
  flags += pwd !== undefined ? 'W' : 'P'
  // /usr/bin/env sets argv[0] to its operand: only when that already is argv0 (the usual case).
  let target = resolved
  if (lastValue(pairs, 'SHLVL') === undefined && argv0 === req.file && deps.fileExists(PTY_FD_GUARD_ENV_PATH)) {
    flags += 'S'
    target = req.file // env searches the same PATH itself, argv[0] stays `file`
  }

  const stdioCount = Number.isInteger(req.stdioCount) && req.stdioCount >= 3 ? req.stdioCount : 3
  const crash = lastValue(pairs, 'CRASHDUMP_SIGNAL_FD')
  const extra = crash !== undefined && /^\d+$/.test(crash) && Number(crash) >= stdioCount ? String(Number(crash)) : ''

  return {
    wrapped: true,
    file: wrapper,
    args: [wrapper, '-c', CHILD_FD_GUARD_SCRIPT, CHILD_FD_GUARD_NAME, flags, bashEnv ?? '', pwd ?? '', String(stdioCount), extra, argv0, target, ...req.args.slice(1)],
    envPairs: bashEnv !== undefined ? pairs.filter(p => keyOf(p) !== 'BASH_ENV') : pairs,
  }
}

// ── installation (patches this process's libuv bindings; Linux only) ──────────────────────────

let optOutDepth = 0

/**
 * Runs `fn` with the guard off for every spawn it makes synchronously (`fork()` / `spawn()` reach
 * libuv before they return). Used only for the Terminal Server fork (PLAN-062 option C).
 */
export function runWithoutChildProcessFdGuard<T>(fn: () => T): T {
  optOutDepth++
  try {
    return fn()
  } finally {
    optOutDepth--
  }
}

export interface ChildProcessFdGuardInstallOptions {
  log: (line: string) => void
  platform?: NodeJS.Platform
  /** `process.binding` (tests pass fakes) */
  binding?: (name: string) => unknown
  fileExists?: (p: string) => boolean
  isExecutableFile?: (p: string) => boolean
}

export type ChildProcessFdGuardInstallResult =
  | { installed: true; uninstall: () => void }
  | { installed: false; reason: 'not-linux' | 'no-bash' | 'already-installed' | 'no-binding' }

let installed = false

function defaultIsExecutableFile(p: string): boolean {
  try {
    if (!fs.statSync(p).isFile()) return false
    fs.accessSync(p, fs.constants.X_OK)
    return true
  } catch {
    return false
  }
}

type AnyFn = (...a: unknown[]) => unknown

/**
 * Installs the guard in this process. Not Linux → does nothing (`not-linux`), so Windows / macOS
 * spawn exactly as before. Never throws.
 */
export function installChildProcessFdGuard(opts: ChildProcessFdGuardInstallOptions): ChildProcessFdGuardInstallResult {
  const platform = opts.platform ?? process.platform
  if (platform !== 'linux') return { installed: false, reason: 'not-linux' }
  if (installed) return { installed: false, reason: 'already-installed' }

  const rawExists = opts.fileExists ?? fs.existsSync
  const known = new Map<string, boolean>()
  const fileExists = (p: string): boolean => {
    let v = known.get(p)
    if (v === undefined) { v = rawExists(p); known.set(p, v) }
    return v
  }
  if (!PTY_FD_GUARD_BASH_CANDIDATES.some(p => fileExists(p))) {
    opts.log(`[child-fd-guard] no bash at ${PTY_FD_GUARD_BASH_CANDIDATES.join(' / ')}; child_process children keep inherited fds (BUG-206 / BUG-207)`)
    return { installed: false, reason: 'no-bash' }
  }

  let processProto: { spawn: AnyFn } | undefined
  let spawnSync: { spawn: AnyFn } | undefined
  try {
    const binding = opts.binding ?? ((name: string) => (process as unknown as { binding(n: string): unknown }).binding(name))
    const pw = binding('process_wrap') as { Process?: { prototype?: { spawn?: unknown } } } | undefined
    const ss = binding('spawn_sync') as { spawn?: unknown } | undefined
    if (typeof pw?.Process?.prototype?.spawn === 'function') processProto = pw.Process.prototype as { spawn: AnyFn }
    if (typeof ss?.spawn === 'function') spawnSync = ss as { spawn: AnyFn }
  } catch { /* reported below */ }
  if (!processProto || !spawnSync) {
    opts.log('[child-fd-guard] process_wrap / spawn_sync binding unavailable; child_process children keep inherited fds (BUG-206 / BUG-207)')
    return { installed: false, reason: 'no-binding' }
  }

  const deps: ChildFdGuardDeps = {
    platform,
    fileExists,
    isExecutableFile: opts.isExecutableFile ?? defaultIsExecutableFile,
    cwd: () => process.cwd(),
    processEnv: () => process.env,
  }
  const logged = new Set<string>()
  const once = (key: string, line: string) => {
    if (logged.has(key)) return
    logged.add(key)
    opts.log(line)
  }

  /** Returns the arguments to call the original binding with (the same array when not wrapped). */
  const guardCall = (kind: 'async' | 'sync', a: unknown[]): unknown[] => {
    if (optOutDepth > 0) return a
    try {
      if (kind === 'async' && typeof a[0] === 'string' && Array.isArray(a[1])) {
        // Node ≥ 24.x: spawn(file, args, cwd, envPairs, stdio, flags, uid, gid)
        const r = guardChildSpawn({
          file: a[0], args: a[1] as string[], cwd: typeof a[2] === 'string' ? a[2] : undefined,
          envPairs: Array.isArray(a[3]) ? a[3] as string[] : undefined, stdioCount: Array.isArray(a[4]) ? a[4].length : 3,
        }, deps)
        if (!r.wrapped) return a
        const next = [...a]
        next[0] = r.file
        next[1] = r.args
        next[3] = r.envPairs
        return next
      }
      const o = a[0] as Record<string, unknown> | null | undefined
      if (o && typeof o === 'object' && typeof o.file === 'string' && Array.isArray(o.args)) {
        // spawn_sync.spawn(options) (and process_wrap's older spawn(options))
        const r = guardChildSpawn({
          file: o.file, args: o.args as string[], cwd: typeof o.cwd === 'string' ? o.cwd : undefined,
          envPairs: Array.isArray(o.envPairs) ? o.envPairs as string[] : undefined, stdioCount: Array.isArray(o.stdio) ? o.stdio.length : 3,
        }, deps)
        if (!r.wrapped) return a
        return [{ ...o, file: r.file, args: r.args, envPairs: r.envPairs }, ...a.slice(1)]
      }
      once(`shape-${kind}`, `[child-fd-guard] unexpected ${kind} spawn binding call; spawning unguarded (BUG-206 / BUG-207)`)
    } catch (err) {
      once(`error-${kind}`, `[child-fd-guard] guard failed (${err instanceof Error ? err.message : String(err)}); spawning unguarded`)
    }
    return a
  }

  const originalAsync = processProto.spawn
  const originalSync = spawnSync.spawn
  processProto.spawn = function guardedSpawn(this: unknown, ...a: unknown[]) {
    return originalAsync.apply(this, guardCall('async', a))
  }
  spawnSync.spawn = function guardedSpawnSync(this: unknown, ...a: unknown[]) {
    return originalSync.apply(this, guardCall('sync', a))
  }
  installed = true
  opts.log(`[child-fd-guard] installed (${PTY_FD_GUARD_BASH_CANDIDATES.find(p => fileExists(p))}): child_process children keep only their stdio fds (BUG-206 / BUG-207)`)

  return {
    installed: true,
    uninstall: () => {
      if (processProto) processProto.spawn = originalAsync
      if (spawnSync) spawnSync.spawn = originalSync
      installed = false
    },
  }
}
