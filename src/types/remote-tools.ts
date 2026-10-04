// Remote AI toolchain detection report (PLAN-037 / T0408; spec: T0407 §1 / §3).
//
// Produced by `electron/remote-tools/parse.ts` from the fixed probe scripts in
// `electron/remote-tools/probe-script.ts`, carried over the proxied
// `remote-tools:detect` channel (T0411) and rendered by the tools panel (T0410).
//
// Security contract (T0407 §6): the enum fields here (`status`, `login`,
// `pkgManager`, `privilege`, `musl`, `osFamily`, `isWsl`) are the only values an
// install recipe may branch on. Free-form strings (`path`, `version`, `osId`,
// `arch`, ...) come from the remote host and are for display only — never
// interpolate them into a command.

export const REMOTE_TOOLS_SCHEMA_VERSION = 1 as const

/** Probed tools, in display order. */
export const REMOTE_TOOL_IDS = [
  'claude',
  'git',
  'gh',
  'codex',
  'curl',
  'bash',
  'rg',
  'uv',
  'python3',
  'node',
] as const
export type RemoteToolId = typeof REMOTE_TOOL_IDS[number]

export const REMOTE_TOOL_TIERS = ['required', 'recommended', 'optional', 'prerequisite'] as const
export type RemoteToolTier = typeof REMOTE_TOOL_TIERS[number]

/** Base tier per tool (T0407 §1). Use `remoteToolTier()` to apply the musl rule. */
export const REMOTE_TOOL_TIER: Readonly<Record<RemoteToolId, RemoteToolTier>> = {
  claude: 'required',
  git: 'required',
  gh: 'recommended',
  codex: 'recommended',
  curl: 'prerequisite',
  bash: 'prerequisite',
  rg: 'optional',
  uv: 'optional',
  python3: 'optional',
  node: 'optional',
}

/** Tools whose login state the probe checks (exit code only). */
export const REMOTE_TOOLS_WITH_LOGIN = ['claude', 'codex', 'gh'] as const
export type RemoteToolWithLogin = typeof REMOTE_TOOLS_WITH_LOGIN[number]

/**
 * Effective tier: ripgrep is optional (Claude Code bundles its own) except on
 * musl, where the bundled binary does not run and a system `rg` is required.
 */
export function remoteToolTier(id: RemoteToolId, env: Pick<RemoteToolsEnv, 'musl'>): RemoteToolTier {
  if (id === 'rg' && env.musl) return 'required'
  return REMOTE_TOOL_TIER[id]
}

export const REMOTE_TOOL_STATUSES = ['ok', 'missing', 'interop-only', 'not-on-path', 'too-old', 'error'] as const
/**
 * - `ok`           found on the login PATH and `--version` answered
 * - `missing`      not found anywhere the probe looks
 * - `interop-only` WSL: only a Windows binary under `/mnt/<drive>/` resolves (never executed)
 * - `not-on-path`  installed in `~/.local/bin` / `/usr/local/bin` / `/opt/homebrew/bin`
 *                  but not on the login PATH (typical right after a first install)
 * - `too-old`      claude below `HEALTHY_MIN` (`electron/claude-resolver.ts`)
 * - `error`        found on PATH but `--version` printed nothing
 */
export type RemoteToolStatus = typeof REMOTE_TOOL_STATUSES[number]

export const REMOTE_TOOL_LOGIN_STATES = ['loggedIn', 'loggedOut', 'unknown', 'n/a'] as const
/** `n/a`: the tool has no login, or it is not runnable so the check was skipped. */
export type RemoteToolLoginState = typeof REMOTE_TOOL_LOGIN_STATES[number]

export interface RemoteToolReport {
  id: RemoteToolId
  status: RemoteToolStatus
  /** Display only. Resolved path (or the off-PATH / interop path that was found). */
  path?: string
  /** Display only. Parsed `X.Y.Z[...]`; absent when unknown. */
  version?: string
  /** Set for `claude` / `codex` / `gh`; `n/a` for every other tool. */
  login?: RemoteToolLoginState
  /**
   * Fallback hint for `claude` / `codex` / `gh`: whether the tool's credential
   * file exists (existence only — the probe never reads it). On macOS claude
   * keeps credentials in the Keychain, so `false` there proves nothing.
   */
  credentialFilePresent?: boolean
  /** Whether the server process (headless handler PATH) can see this tool. */
  serverVisible: boolean
}

export const REMOTE_OS_FAMILIES = ['linux', 'darwin', 'unknown'] as const
export type RemoteOsFamily = typeof REMOTE_OS_FAMILIES[number]

export const REMOTE_PKG_MANAGERS = ['apt', 'dnf', 'yum', 'apk', 'brew', 'none'] as const
export type RemotePkgManager = typeof REMOTE_PKG_MANAGERS[number]

export const REMOTE_PRIVILEGES = ['root', 'passwordless', 'password-required', 'sudo-missing'] as const
/**
 * - `root`              uid 0 — install commands must drop the `sudo` prefix (Docker)
 * - `passwordless`      `sudo -n true` succeeded
 * - `password-required` sudo exists but needs a password (also the fallback when unknown)
 * - `sudo-missing`      not root and no `sudo` binary
 */
export type RemotePrivilege = typeof REMOTE_PRIVILEGES[number]

/** Environment variables whose presence (never value) the probe reports. */
export const REMOTE_AUTH_ENV_VARS = [
  'ANTHROPIC_API_KEY',
  'CLAUDE_CODE_OAUTH_TOKEN',
  'OPENAI_API_KEY',
  'GH_TOKEN',
  'GITHUB_TOKEN',
] as const
export type RemoteAuthEnvVar = typeof REMOTE_AUTH_ENV_VARS[number]

export interface RemoteToolsEnv {
  osFamily: RemoteOsFamily
  /** Display only. `/etc/os-release` `ID` (e.g. `ubuntu`, `alpine`), or `macos`. */
  osId?: string
  /** Display only. `/etc/os-release` `ID_LIKE` (e.g. `debian`). */
  osIdLike?: string
  /** Display only. `/etc/os-release` `VERSION_ID`, or `sw_vers -productVersion`. */
  osVersion?: string
  /** Display only. Raw `uname -m` (e.g. `x86_64`, `aarch64`, `arm64`). */
  arch?: string
  musl: boolean
  pkgManager: RemotePkgManager
  privilege: RemotePrivilege
  isWsl: boolean
  /** Whether `timeout` (or `gtimeout`) exists; without it per-command limits fall back to the overall probe timeout. */
  hasTimeout: boolean
  /** Presence of auth env vars in the login shell. */
  authEnv: Readonly<Record<RemoteAuthEnvVar, boolean>>
}

export interface RemoteToolsReport {
  schemaVersion: typeof REMOTE_TOOLS_SCHEMA_VERSION
  env: RemoteToolsEnv
  /** One entry per `REMOTE_TOOL_IDS`, same order. */
  tools: RemoteToolReport[]
  /** False when the server-view probe failed; every `serverVisible` is then `false` and meaningless. */
  serverViewAvailable: boolean
  /** Parser notes (dropped lines, truncated values, ...). Display / logging only. */
  warnings: string[]
}

export const REMOTE_TOOLS_DETECT_ERROR_CODES = [
  'host-platform', // detection is not supported on this host (Windows main process)
  'spawn-failed', // the login shell could not be started
  'timeout', // the probe did not finish in time
  'no-markers', // output had no complete BEGIN/END block
] as const
export type RemoteToolsDetectErrorCode = typeof REMOTE_TOOLS_DETECT_ERROR_CODES[number]

export type RemoteToolsDetectResult =
  | { ok: true; report: RemoteToolsReport }
  | { ok: false; errorCode: RemoteToolsDetectErrorCode; error: string }
