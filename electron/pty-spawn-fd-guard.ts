/**
 * BUG-205 / T0806 (D252): on Linux a PTY child only keeps fd 0–2.
 *
 * Chromium opens its files and sockets without FD_CLOEXEC, libuv (`child_process`) forks and
 * execs without closing them, and `@lydell/node-pty` 1.1.0 `forkpty` + `execvp` does not close
 * them either — nor does it set FD_CLOEXEC on the pty masters it opens. So on Linux every shell
 * BAT spawns inherited the main process's / Terminal Server's descriptors and the pty master of
 * every tab opened before it (T0805). Windows (ConPTY, handles not inheritable) and macOS
 * (`posix_spawn` + `POSIX_SPAWN_CLOEXEC_DEFAULT`) are not affected and are left alone.
 *
 * The fix runs the PTY child through bash, which closes every fd ≥ 3 listed in /proc/self/fd and
 * then `exec`s the original command:
 *
 *   /bin/bash -c <PTY_FD_GUARD_SCRIPT> bat-pty-fd-guard <flags> <BASH_ENV value> <file> <args…>
 *
 * Invariants (T0806, checked in WSL — see docs/agent-guide/linux-pty-fd-inheritance.md):
 *  - the pid is the shell's: the wrapper `exec`s into it (node-pty's / child_process's pid stays right);
 *  - argv is the one node-pty / child_process gave before: argv[0] = `file` as passed, then `args`
 *    verbatim (they are positional parameters, never parsed by a shell);
 *  - the environment the shell receives equals the env passed in, except variables every shell
 *    maintains itself (`_`, a stale `PWD` / `OLDPWD`) and bash's rewrite of an exported
 *    `SHELLOPTS` / `BASHOPTS` / `IFS` / `BASH_FUNC_*%%` (same meaning); the three variables bash
 *    would change are handled: `BASH_ENV` is not given to the wrapper (bash would source it) and
 *    re-exported by the script, `PWD` / `SHLVL` that were absent are removed again;
 *  - cwd is untouched (the wrapper does not `cd`);
 *  - the script is a fixed string; the shell path and every argument are positional parameters,
 *    so no user input is ever parsed as shell code (CLAUDE.md "Child Process Spawning").
 *
 * No bash (`PTY_FD_GUARD_BASH_CANDIDATES` all missing) → the command is returned unchanged and the
 * caller logs one line. Pure: no electron, no fs — the caller passes `platform` / `fileExists`.
 * Single implementation, used by the Terminal Server (`electron/terminal-server/server.ts`), the
 * `PtyManager` direct node-pty branch and its `child_process.spawn` fallback (headless uses the
 * same `PtyManager`).
 */

/** `$0` of the wrapper bash: bash prefixes its own error messages with it. */
export const PTY_FD_GUARD_NAME = 'bat-pty-fd-guard'

/** Wrapper shells tried in order (usrmerge systems have both; NixOS has neither → not wrapped). */
export const PTY_FD_GUARD_BASH_CANDIDATES: readonly string[] = ['/bin/bash', '/usr/bin/bash']

/** Removes `SHLVL` again when the original env had none (bash's `exec` would export `SHLVL=0`). */
export const PTY_FD_GUARD_ENV_PATH = '/usr/bin/env'

/**
 * The fixed wrapper script. `$1` = flags (`B` re-export BASH_ENV from `$2`, `P` unset PWD,
 * `S` drop SHLVL through /usr/bin/env), `$2` = the BASH_ENV value (empty when unused), the rest is
 * the original command. The fd loop runs in a function so `local -` / `local GLOBIGNORE` keep an
 * exported `SHELLOPTS=…noglob…` / `GLOBIGNORE` from hiding /proc/self/fd entries without changing
 * what is exported. `{var}>&-` needs bash ≥ 4.1; an older bash skips the loop and only `exec`s.
 */
export const PTY_FD_GUARD_SCRIPT = [
  'case $1 in *B*) export BASH_ENV="$2";; esac',
  'case $1 in *P*) unset PWD;; esac',
  `case $1 in *S*) set -- "$1" "$2" ${PTY_FD_GUARD_ENV_PATH} -u SHLVL -- "\${@:3}";; esac`,
  'shift 2',
  '_bat_close_fds() {',
  '  local - _bat_fd GLOBIGNORE=',
  '  set +f',
  '  for _bat_fd in /proc/self/fd/*; do',
  '    _bat_fd=${_bat_fd##*/}',
  '    case $_bat_fd in 0|1|2|*[!0-9]*) ;; *) exec {_bat_fd}>&- ;; esac',
  '  done',
  '}',
  'if (( BASH_VERSINFO[0] > 4 || (BASH_VERSINFO[0] == 4 && BASH_VERSINFO[1] >= 1) )); then _bat_close_fds; fi',
  'unset -f _bat_close_fds',
  'exec "$@"',
].join('\n')

export type PtySpawnEnv = Record<string, string | undefined>

export interface PtySpawnCommand<E extends PtySpawnEnv = PtySpawnEnv> {
  file: string
  args: string[]
  env: E
}

export interface PtyFdGuardDeps {
  platform: NodeJS.Platform
  /** existence check for the wrapper bash and /usr/bin/env (`fs.existsSync` in production) */
  fileExists: (path: string) => boolean
}

export type PtyFdGuardResult<E extends PtySpawnEnv = PtySpawnEnv> =
  | { wrapped: true; wrapper: string; command: PtySpawnCommand<E> }
  | { wrapped: false; reason: 'not-linux' | 'no-bash'; command: PtySpawnCommand<E> }

/** Value of `pty:created`'s `fdGuard` (Terminal Server → main, Linux only) and of the debug log. */
export type PtyFdGuardOutcome = 'closed' | 'no-bash'

const isSet = (env: PtySpawnEnv, key: string): boolean => typeof env[key] === 'string'

/**
 * Returns the command to spawn instead of `cmd`. Not Linux → `cmd` itself (same objects, so
 * Windows / macOS spawn exactly what they did before T0806). Linux without bash → `cmd` itself,
 * `reason: 'no-bash'`.
 */
export function guardPtySpawnFds<E extends PtySpawnEnv>(cmd: PtySpawnCommand<E>, deps: PtyFdGuardDeps): PtyFdGuardResult<E> {
  if (deps.platform !== 'linux') return { wrapped: false, reason: 'not-linux', command: cmd }
  const wrapper = PTY_FD_GUARD_BASH_CANDIDATES.find(p => deps.fileExists(p))
  if (!wrapper) return { wrapped: false, reason: 'no-bash', command: cmd }

  let flags = ''
  let bashEnv = ''
  let env = cmd.env
  if (isSet(cmd.env, 'BASH_ENV')) {
    flags += 'B'
    bashEnv = cmd.env.BASH_ENV as string
    const copy = { ...cmd.env }
    delete copy.BASH_ENV
    env = copy
  }
  if (!isSet(cmd.env, 'PWD')) flags += 'P'
  // Without /usr/bin/env the shell gets SHLVL=0 instead of none (every shell that uses SHLVL turns both into 1).
  if (!isSet(cmd.env, 'SHLVL') && deps.fileExists(PTY_FD_GUARD_ENV_PATH)) flags += 'S'

  return {
    wrapped: true,
    wrapper,
    command: {
      file: wrapper,
      args: ['-c', PTY_FD_GUARD_SCRIPT, PTY_FD_GUARD_NAME, flags || '-', bashEnv, cmd.file, ...cmd.args],
      env,
    },
  }
}

/** One debug-log line for a Linux spawn without the guard (never logs env values). */
export function describePtyFdGuardSkip(file: string, where: string): string {
  return `[pty-fd-guard] ${where}: no bash at ${PTY_FD_GUARD_BASH_CANDIDATES.join(' / ')}; spawning ${file} directly, inherited fds stay open (BUG-205)`
}
