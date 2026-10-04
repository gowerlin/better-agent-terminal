// Fixed probe scripts for remote AI toolchain detection (PLAN-037 / T0408; spec: T0407 §3).
//
// Both scripts are compile-time constants: POSIX sh, zero interpolation, no
// external input. They are assembled from plain single-quoted lines on purpose —
// this file contains no template literals, which the guard test enforces.
//
// Output contract: `key=value` lines between `PROBE_BEGIN_MARKER` and
// `PROBE_END_MARKER`, parsed by `./parse.ts` against a key whitelist.
//
// Security (T0407 §6):
//   - login checks keep only the exit code (stdout / stderr go to /dev/null);
//     `gh auth token` / `--show-token` never appear (guard test)
//   - credential files are only tested with `[ -e ]`, never read
//   - auth env vars are reported as set / unset, never echoed
//   - on WSL a `/mnt/<drive>/...` hit is classified as interop and never executed
//
// This module does not import `electron` and does not spawn anything by itself:
// `runProbe()` takes the execFile implementation as a parameter (wired in T0411).

import * as pathModule from 'path'
import type { ExecFileOptions } from 'child_process'

export const PROBE_BEGIN_MARKER = '__BAT_TOOLS_PROBE_V1_BEGIN__'
export const PROBE_END_MARKER = '__BAT_TOOLS_PROBE_V1_END__'

/** Overall limit for the login-view probe (rc files + up to 10 `--version` + 3 login checks). */
export const LOGIN_PROBE_TIMEOUT_MS = 20000
/** The server-view probe only runs `command -v`. */
export const SERVER_PROBE_TIMEOUT_MS = 5000

// Shared helpers. `bat_locate` sets bat_state (found | interop | offpath | missing)
// and bat_path for one tool name.
const PROBE_PRELUDE: readonly string[] = [
  'bat_emit() { printf \'%s=%s\\n\' "$1" "$2"; }',
  'bat_wsl=0',
  'if [ -e /proc/sys/fs/binfmt_misc/WSLInterop ] || [ -e /proc/sys/fs/binfmt_misc/WSLInterop-late ] || [ -n "${WSL_DISTRO_NAME:-}" ]; then bat_wsl=1; fi',
  'bat_locate() {',
  '  bat_state=missing',
  '  bat_path=$(command -v "$1" 2>/dev/null) || bat_path=\'\'',
  '  case "$bat_path" in /*) ;; *) bat_path=\'\' ;; esac',
  '  if [ -n "$bat_path" ]; then',
  '    bat_state=found',
  '    if [ "$bat_wsl" = 1 ]; then',
  '      case "$bat_path" in /mnt/[a-z]/*) bat_state=interop ;; esac',
  '    fi',
  '  fi',
  '}',
]

const PROBE_BEGIN: readonly string[] = ['printf \'\\n%s\\n\' \'' + PROBE_BEGIN_MARKER + '\'']
const PROBE_END: readonly string[] = ['printf \'%s\\n\' \'' + PROBE_END_MARKER + '\'']

const TOOL_NAMES = 'claude git gh codex curl bash rg uv python3 node'

/**
 * Login view (what the user sees in a remote terminal): environment, then per
 * tool path / state / version, login exit codes and credential-file presence.
 */
const LOGIN_PROBE_BODY: readonly string[] = [
  'bat_to=\'\'',
  'if command -v timeout >/dev/null 2>&1; then bat_to=timeout; elif command -v gtimeout >/dev/null 2>&1; then bat_to=gtimeout; fi',
  'bat_run() {',
  '  bat_secs=$1; shift',
  '  if [ -n "$bat_to" ]; then "$bat_to" "$bat_secs" "$@"; else "$@"; fi',
  '}',
  // Exit code only: stdout and stderr are discarded (claude auth status prints the account email).
  'bat_login() {',
  '  bat_run 8 "$@" >/dev/null 2>&1 </dev/null',
  '  bat_emit "tool.$bat_name.login" "$?"',
  '}',
  // --- environment ---
  'bat_emit env.wsl "$bat_wsl"',
  'if [ -n "$bat_to" ]; then bat_emit env.timeout 1; else bat_emit env.timeout 0; fi',
  'bat_emit env.uname_s "$(uname -s 2>/dev/null)"',
  'bat_emit env.arch "$(uname -m 2>/dev/null)"',
  'if [ -r /etc/os-release ]; then',
  '  bat_emit env.os_id "$(sed -n \'s/^ID=//p\' /etc/os-release 2>/dev/null | head -n1)"',
  '  bat_emit env.os_id_like "$(sed -n \'s/^ID_LIKE=//p\' /etc/os-release 2>/dev/null | head -n1)"',
  '  bat_emit env.os_version "$(sed -n \'s/^VERSION_ID=//p\' /etc/os-release 2>/dev/null | head -n1)"',
  'elif command -v sw_vers >/dev/null 2>&1; then',
  '  bat_emit env.os_id macos',
  '  bat_emit env.os_version "$(sw_vers -productVersion 2>/dev/null)"',
  'fi',
  'if [ -e /lib/ld-musl-x86_64.so.1 ] || [ -e /lib/ld-musl-aarch64.so.1 ] || ldd --version 2>&1 | grep -qi musl; then bat_emit env.musl 1; else bat_emit env.musl 0; fi',
  'bat_pkg=none',
  'for bat_name in apt-get dnf yum apk brew; do',
  '  bat_locate "$bat_name"',
  '  if [ "$bat_state" = found ]; then bat_pkg=$bat_name; break; fi',
  'done',
  'bat_emit env.pkg "$bat_pkg"',
  'bat_locate sudo',
  'if [ "$(id -u 2>/dev/null)" = 0 ]; then bat_emit env.priv root',
  'elif [ "$bat_state" != found ]; then bat_emit env.priv sudo-missing',
  'elif bat_run 5 sudo -n true >/dev/null 2>&1 </dev/null; then bat_emit env.priv passwordless',
  'else bat_emit env.priv password-required',
  'fi',
  'if [ -n "${ANTHROPIC_API_KEY:-}" ]; then bat_emit env.auth.ANTHROPIC_API_KEY 1; else bat_emit env.auth.ANTHROPIC_API_KEY 0; fi',
  'if [ -n "${CLAUDE_CODE_OAUTH_TOKEN:-}" ]; then bat_emit env.auth.CLAUDE_CODE_OAUTH_TOKEN 1; else bat_emit env.auth.CLAUDE_CODE_OAUTH_TOKEN 0; fi',
  'if [ -n "${OPENAI_API_KEY:-}" ]; then bat_emit env.auth.OPENAI_API_KEY 1; else bat_emit env.auth.OPENAI_API_KEY 0; fi',
  'if [ -n "${GH_TOKEN:-}" ]; then bat_emit env.auth.GH_TOKEN 1; else bat_emit env.auth.GH_TOKEN 0; fi',
  'if [ -n "${GITHUB_TOKEN:-}" ]; then bat_emit env.auth.GITHUB_TOKEN 1; else bat_emit env.auth.GITHUB_TOKEN 0; fi',
  // --- tools ---
  'for bat_name in ' + TOOL_NAMES + '; do',
  '  bat_locate "$bat_name"',
  '  if [ "$bat_state" != found ]; then',
  '    for bat_dir in "$HOME/.local/bin" /usr/local/bin /opt/homebrew/bin; do',
  '      if [ -f "$bat_dir/$bat_name" ] && [ -x "$bat_dir/$bat_name" ]; then',
  '        bat_state=offpath',
  '        bat_path="$bat_dir/$bat_name"',
  '        break',
  '      fi',
  '    done',
  '  fi',
  '  bat_emit "tool.$bat_name.state" "$bat_state"',
  '  if [ -n "$bat_path" ]; then bat_emit "tool.$bat_name.path" "$bat_path"; fi',
  '  if [ "$bat_state" = found ]; then',
  '    bat_emit "tool.$bat_name.version" "$(bat_run 5 "$bat_path" --version 2>/dev/null </dev/null | head -n1)"',
  '    case "$bat_name" in',
  '      claude) bat_login "$bat_path" auth status ;;',
  '      codex) bat_login "$bat_path" login status ;;',
  '      gh) bat_login "$bat_path" auth status --hostname github.com ;;',
  '    esac',
  '  fi',
  'done',
  // Credential files: existence only, never read.
  'if [ -e "${CLAUDE_CONFIG_DIR:-$HOME/.claude}/.credentials.json" ]; then bat_emit tool.claude.cred 1; else bat_emit tool.claude.cred 0; fi',
  'if [ -e "${CODEX_HOME:-$HOME/.codex}/auth.json" ]; then bat_emit tool.codex.cred 1; else bat_emit tool.codex.cred 0; fi',
  'if [ -e "${GH_CONFIG_DIR:-${XDG_CONFIG_HOME:-$HOME/.config}/gh}/hosts.yml" ]; then bat_emit tool.gh.cred 1; else bat_emit tool.gh.cred 0; fi',
]

/** Server view (the headless handler's own PATH): visibility only, nothing is executed. */
const SERVER_PROBE_BODY: readonly string[] = [
  'for bat_name in ' + TOOL_NAMES + '; do',
  '  bat_locate "$bat_name"',
  '  bat_emit "tool.$bat_name.state" "$bat_state"',
  '  if [ -n "$bat_path" ]; then bat_emit "tool.$bat_name.path" "$bat_path"; fi',
  'done',
]

export const LOGIN_PROBE_SCRIPT: string = [...PROBE_PRELUDE, ...PROBE_BEGIN, ...LOGIN_PROBE_BODY, ...PROBE_END, ''].join('\n')

export const SERVER_PROBE_SCRIPT: string = [...PROBE_PRELUDE, ...PROBE_BEGIN, ...SERVER_PROBE_BODY, ...PROBE_END, ''].join('\n')

// ── login shell selection ─────────────────────────────────────────────────────

export const LOGIN_SHELL_FALLBACK = '/bin/sh'
const LOGIN_SHELL_PATH_RE = /^\/[A-Za-z0-9._/-]+$/
const LOGIN_SHELL_BASENAMES: ReadonlySet<string> = new Set(['bash', 'zsh', 'sh', 'dash', 'ksh'])

/**
 * Pick the shell the login-view probe runs under (same rule as the remote PTY):
 * an absolute, plain path whose basename is a known POSIX-family shell, else `/bin/sh`.
 */
export function selectLoginShell(candidate: string | undefined | null): string {
  if (typeof candidate !== 'string' || !LOGIN_SHELL_PATH_RE.test(candidate) || candidate.endsWith('/')) return LOGIN_SHELL_FALLBACK
  if (!LOGIN_SHELL_BASENAMES.has(pathModule.posix.basename(candidate))) return LOGIN_SHELL_FALLBACK
  return candidate
}

// ── invocation assembly ───────────────────────────────────────────────────────

export interface ProbeInvocation {
  file: string
  args: string[]
  options: ExecFileOptions & { encoding: 'utf8' }
}

/**
 * Re-exec stub run by the login shell. The login + interactive shell loads the
 * user's profile and rc files (PATH from nvm / the codex installer lives there),
 * then hands the probe — passed as `$1`, never spliced into this string — to
 * `/bin/sh`, so the probe always runs with POSIX sh semantics even when the
 * login shell is zsh (no word splitting, `nomatch`) or ksh.
 */
export const LOGIN_PROBE_REEXEC = 'exec /bin/sh -c "$1"'
const LOGIN_PROBE_ARGV0 = 'bat-tools-probe'

/** `<shell> -l -i -c <re-exec stub> bat-tools-probe <LOGIN_PROBE_SCRIPT>`; stdin is closed by `runProbe`. */
export function buildLoginProbeInvocation(shellCandidate: string | undefined | null): ProbeInvocation {
  return {
    file: selectLoginShell(shellCandidate),
    args: ['-l', '-i', '-c', LOGIN_PROBE_REEXEC, LOGIN_PROBE_ARGV0, LOGIN_PROBE_SCRIPT],
    options: { encoding: 'utf8', timeout: LOGIN_PROBE_TIMEOUT_MS, maxBuffer: 1024 * 1024, windowsHide: true },
  }
}

/** `/bin/sh -c <SERVER_PROBE_SCRIPT>` with the caller's (server process) environment. */
export function buildServerProbeInvocation(): ProbeInvocation {
  return {
    file: '/bin/sh',
    args: ['-c', SERVER_PROBE_SCRIPT],
    options: { encoding: 'utf8', timeout: SERVER_PROBE_TIMEOUT_MS, maxBuffer: 1024 * 1024, windowsHide: true },
  }
}

// ── injectable runner ─────────────────────────────────────────────────────────

/** Minimal `child_process.execFile` shape; tests and the WSL harness inject their own. */
export type ProbeExecFile = (
  file: string,
  args: string[],
  options: ProbeInvocation['options'],
  callback: (error: (Error & { code?: string | number; killed?: boolean; signal?: string | null }) | null, stdout: string | Buffer, stderr: string | Buffer) => void,
) => { stdin?: { end(): void } | null } | void

export type ProbeRunResult =
  | { ok: true; stdout: string; exitError?: string }
  | { ok: false; errorCode: 'spawn-failed' | 'timeout'; error: string; stdout: string }

function toText(value: string | Buffer | undefined | null): string {
  if (typeof value === 'string') return value
  return value ? value.toString('utf8') : ''
}

/**
 * Run one probe invocation. A non-zero exit is not a failure on its own — rc or
 * logout files can fail after the probe printed its block — so stdout is always
 * returned for `parse.ts` to judge; only a spawn error or a timeout is reported
 * as a failure (the parser still gets whatever was printed).
 */
export function runProbe(execFileImpl: ProbeExecFile, invocation: ProbeInvocation): Promise<ProbeRunResult> {
  return new Promise(resolve => {
    let child: ReturnType<ProbeExecFile>
    try {
      child = execFileImpl(invocation.file, invocation.args, invocation.options, (error, stdout, stderr) => {
        const out = toText(stdout)
        if (!error) {
          resolve({ ok: true, stdout: out })
          return
        }
        if (error.code === 'ENOENT' || error.code === 'EACCES') {
          resolve({ ok: false, errorCode: 'spawn-failed', error: error.message, stdout: out })
          return
        }
        if (error.killed || error.code === 'ETIMEDOUT') {
          resolve({ ok: false, errorCode: 'timeout', error: 'probe timed out after ' + String(invocation.options.timeout) + ' ms', stdout: out })
          return
        }
        const errText = toText(stderr).trim().split('\n').slice(-1)[0] ?? ''
        resolve({ ok: true, stdout: out, exitError: errText || error.message })
      })
    } catch (err) {
      resolve({ ok: false, errorCode: 'spawn-failed', error: err instanceof Error ? err.message : String(err), stdout: '' })
      return
    }
    // stdin as /dev/null: nothing in the probe may wait on input.
    try {
      child?.stdin?.end()
    } catch {
      // stdin already closed
    }
  })
}
