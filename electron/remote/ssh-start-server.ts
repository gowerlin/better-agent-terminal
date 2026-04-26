import type { ChildProcess } from 'child_process'
import { logger } from '../logger'
import { buildBaseSshArgs, escapeSingleQuotesStrict } from './ssh-args'

export interface StartServerOptions {
  sshHost: string
  sshUser: string
  sshPort?: number
  sshKeyPath?: string
  targetOS: 'ssh-linux' | 'ssh-darwin'
  /**
   * Where the server bundle was extracted (e.g. `~/.local/bat-server`). The
   * service unit's ExecStart is `${installPath}/bin/bat-server`.
   * v1 only supports `~/.local/bat-server`; sudo `/opt/bat-server` is excluded
   * (D-SSH-8) and not handled here.
   */
  installPath: string
  /** Default 51820 (v1 hard-coded; out-of-scope to dynamic-pick per工單). */
  serverPort?: number
  /**
   * Remote `$HOME` parsed by `verify-ssh-auth`. Currently informational; the
   * unit/plist use `~` (systemd resolves `%h` itself; launchd resolves `~/Library`
   * via the user's session). Captured here so the option surface mirrors
   * spec §4 and downstream consumers can render `journalctl --user-unit` paths.
   */
  serverHome: string
}

export type StartServerErrorCode =
  | 'unit-write-failed'
  | 'enable-failed'
  | 'start-failed'
  | 'verify-failed'
  | 'unknown'

export type StartServerPhase = 'writing-unit' | 'enabling' | 'starting' | 'verifying'

export interface StartServerResult {
  ok: boolean
  method: 'systemd' | 'launchd' | 'failed'
  servicePath: string
  checkOutput?: string
  error?: string
  errorCode?: StartServerErrorCode
}

export type StartServerProgress = (phase: StartServerPhase) => void

type SpawnFn = (
  command: string,
  args: readonly string[],
  options?: { stdio?: unknown; windowsHide?: boolean },
) => ChildProcess

/**
 * Test injection point. Production resolves spawn via dynamic-imported
 * `child_process` (D042 secure spawn — never goes through a shell). Tests pass
 * a mock so no real ssh subprocess fires (T0286 守則 #8).
 */
export interface StarterDeps {
  spawn?: SpawnFn
  /** Total wall budget for any single ssh exec. Default 30s. */
  timeoutMs?: number
}

const DEFAULT_TIMEOUT_MS = 30_000
const DEFAULT_SERVER_PORT = 51820
const SERVICE_NAME = 'bat-server'
const LAUNCHD_LABEL = 'com.bat-server'

/**
 * Bash single-quote escape: `'` becomes `'\''`. Test-facing wrapper around
 * the shared `escapeSingleQuotesStrict` (T0296) that:
 *   - rejects `\n` (heredoc framing) — pre-existing contract
 *   - rejects `\r` / NUL / other control chars (EC-002, T0293)
 * Error message preserves the legacy `/forbidden newline/` substring for
 * the `\n` case to keep test7 in ssh-start-server.test.ts green.
 */
function escapeSingleQuotes(value: string): string {
  if (value.includes('\n')) {
    throw new Error(`Value contains forbidden newline: ${value}`)
  }
  return escapeSingleQuotesStrict(value, 'value')
}

/**
 * XML structural escape for plist `<string>...</string>` interpolation
 * (T0297, F-005). Complements `escapeSingleQuotesStrict` (control char +
 * single-quote injection) by neutralising the 5 XML special chars so a
 * malicious `installPath` like `/tmp</string><key>Foo</key><string>x`
 * cannot break out of the `<string>` element and inject extra plist keys.
 *
 * Order matters: `&` must run first or subsequent entity refs get
 * double-escaped (`&lt;` → `&amp;lt;`).
 */
function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * Reject systemd unit values containing structural chars (T0297, F-005).
 * `\n` / `\r` are already caught by `escapeSingleQuotesStrict` upstream,
 * but the heredoc body is written verbatim — so a value with `\n[Service]\n`
 * would still inject a new section. `[`, `]`, `=` are systemd's section /
 * key=value structural chars; anything containing them in a path is almost
 * certainly an attack or misuse. Fail-fast (throw) to make the failure loud.
 */
function validateSystemdValue(value: string, fieldName: string): string {
  if (/[\n\r\[\]=]/.test(value)) {
    throw new Error(
      `${fieldName} contains forbidden char (\\n, \\r, [, ], =) for systemd unit: ${JSON.stringify(value)}`,
    )
  }
  return value
}

function systemdUnitPath(): { dir: string; file: string } {
  return {
    dir: '~/.config/systemd/user',
    file: '~/.config/systemd/user/bat-server.service',
  }
}

function launchdPlistPath(): { dir: string; file: string } {
  return {
    dir: '~/Library/LaunchAgents',
    file: '~/Library/LaunchAgents/com.bat-server.plist',
  }
}

function renderSystemdUnit(opts: StartServerOptions): string {
  const port = opts.serverPort ?? DEFAULT_SERVER_PORT
  // T0297 F-005: reject structural chars in installPath before interpolating.
  // `\n` / `\r` already rejected upstream by escapeSingleQuotesStrict (T0296),
  // but `[ ] =` would still inject INI sections / key-value pairs.
  const safeInstallPath = validateSystemdValue(opts.installPath, 'installPath')
  // %h is resolved by systemd to the user's home; we keep installPath as
  // literal `~/.local/bat-server` so the unit is portable when copied.
  return [
    '[Unit]',
    'Description=BAT remote server (PLAN-007)',
    'After=network.target',
    '',
    '[Service]',
    'Type=simple',
    'Environment=BAT_REMOTE_BIND=localhost',
    `Environment=BAT_REMOTE_PORT=${port}`,
    `ExecStart=${safeInstallPath}/bin/bat-server`,
    'Restart=on-failure',
    'RestartSec=5s',
    '',
    '[Install]',
    'WantedBy=default.target',
    '',
  ].join('\n')
}

function renderLaunchdPlist(opts: StartServerOptions): string {
  const port = opts.serverPort ?? DEFAULT_SERVER_PORT
  // T0297 F-005: every value interpolated into `<string>...</string>` runs
  // through escapeXml so attacker-controlled chars cannot terminate the
  // element early and inject siblings (e.g. `</string><key>RunAsUser</key>...`).
  const labelXml = escapeXml(LAUNCHD_LABEL)
  const installPathXml = escapeXml(opts.installPath)
  const portXml = escapeXml(String(port))
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
    '<plist version="1.0">',
    '<dict>',
    '  <key>Label</key>',
    `  <string>${labelXml}</string>`,
    '  <key>ProgramArguments</key>',
    '  <array>',
    `    <string>${installPathXml}/bin/bat-server</string>`,
    '  </array>',
    '  <key>EnvironmentVariables</key>',
    '  <dict>',
    '    <key>BAT_REMOTE_BIND</key>',
    '    <string>localhost</string>',
    '    <key>BAT_REMOTE_PORT</key>',
    `    <string>${portXml}</string>`,
    '  </dict>',
    '  <key>RunAtLoad</key>',
    '  <true/>',
    '  <key>KeepAlive</key>',
    '  <dict>',
    '    <key>Crashed</key>',
    '    <true/>',
    '    <key>SuccessfulExit</key>',
    '    <false/>',
    '  </dict>',
    '</dict>',
    '</plist>',
    '',
  ].join('\n')
}

/**
 * Build the remote shell command that mkdir + heredoc-writes a service unit
 * file. The single-quoted `<< 'EOF'` prevents server-side shell from
 * expanding `$USER` / `%h` / `$HOME` inside the unit content (守則 #10).
 */
function buildWriteUnitCommand(dir: string, file: string, content: string): string {
  return [
    `mkdir -p '${escapeSingleQuotes(dir)}'`,
    `cat > '${escapeSingleQuotes(file)}' << 'EOF'`,
    content,
    'EOF',
  ].join('\n')
}

function buildSshConnectArgs(opts: StartServerOptions): string[] {
  // F-004 (leading `-`) + control-char + whitespace rejection now lives in
  // buildBaseSshArgs.validateSshIdentifier (T0296). `@` in sshUser remains
  // forbidden here for legacy reasons — it would still parse but is almost
  // certainly garbage. Errors mirror the historic message format so existing
  // test7's guard regex (and any future log-grep) keeps working.
  if (opts.sshUser.includes('@')) {
    throw new Error(`Invalid sshUser: ${opts.sshUser}`)
  }
  return buildBaseSshArgs(opts)
}

interface SshExecResult {
  ok: boolean
  exitCode: number | null
  stdout: string
  stderr: string
  spawnError?: Error
  timedOut: boolean
}

async function runSsh(
  spawn: SpawnFn,
  connectArgs: string[],
  remoteCommand: string,
  timeoutMs: number,
): Promise<SshExecResult> {
  const args = [...connectArgs, remoteCommand]
  let proc: ChildProcess
  try {
    proc = spawn('ssh', args, { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { ok: false, exitCode: null, stdout: '', stderr: message, timedOut: false, spawnError: error instanceof Error ? error : new Error(message) }
  }

  let stdout = ''
  let stderr = ''
  proc.stdout?.on('data', (chunk: Buffer | string) => {
    stdout += typeof chunk === 'string' ? chunk : chunk.toString('utf8')
  })
  proc.stderr?.on('data', (chunk: Buffer | string) => {
    stderr += typeof chunk === 'string' ? chunk : chunk.toString('utf8')
  })

  const result: { exitCode: number | null; timedOut: boolean; spawnError?: Error } = await new Promise((resolve) => {
    let settled = false
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      try { proc.kill('SIGTERM') } catch { /* noop */ }
      resolve({ exitCode: null, timedOut: true })
    }, timeoutMs)
    proc.on('error', (err: Error) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve({ exitCode: null, timedOut: false, spawnError: err })
    })
    proc.on('exit', (code) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve({ exitCode: code ?? 1, timedOut: false })
    })
  })

  return {
    ok: result.exitCode === 0 && !result.timedOut && !result.spawnError,
    exitCode: result.exitCode,
    stdout,
    stderr,
    spawnError: result.spawnError,
    timedOut: result.timedOut,
  }
}

function summariseFailure(label: string, exec: SshExecResult): string {
  if (exec.spawnError) return `${label}: spawn error: ${exec.spawnError.message}`
  if (exec.timedOut) return `${label}: timed out`
  const detail = exec.stderr.trim() || exec.stdout.trim() || `exited with code ${exec.exitCode}`
  return `${label}: ${detail}`
}

/**
 * Land the service unit (systemd or launchd), enable + start it, then verify
 * it's actually running. Each stage is a separate ssh exec so failures pinpoint
 * a specific phase via `errorCode`. Stages run sequentially; on first failure
 * the chain aborts (no further ssh execs).
 */
export async function startServerOnRemote(
  opts: StartServerOptions,
  onProgress: StartServerProgress = () => { /* noop */ },
  deps: StarterDeps = {},
): Promise<StartServerResult> {
  const spawn = deps.spawn ?? (await import('child_process')).spawn
  const timeoutMs = deps.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const port = opts.serverPort ?? DEFAULT_SERVER_PORT

  const connectArgs = buildSshConnectArgs(opts)
  const isLinux = opts.targetOS === 'ssh-linux'
  const method: 'systemd' | 'launchd' = isLinux ? 'systemd' : 'launchd'
  const paths = isLinux ? systemdUnitPath() : launchdPlistPath()
  const content = isLinux ? renderSystemdUnit(opts) : renderLaunchdPlist(opts)
  const escapedFile = escapeSingleQuotes(paths.file)

  // ── Stage 1: write unit/plist ───────────────────────────────────────────
  onProgress('writing-unit')
  const writeCmd = buildWriteUnitCommand(paths.dir, paths.file, content)
  const writeExec = await runSsh(spawn, connectArgs, writeCmd, timeoutMs)
  if (!writeExec.ok) {
    const err = summariseFailure('unit-write-failed', writeExec)
    logger.warn(`[ssh-start-server] ${err}`)
    return { ok: false, method: 'failed', servicePath: paths.file, error: err, errorCode: 'unit-write-failed' }
  }

  // ── Stage 2: enable + start ─────────────────────────────────────────────
  onProgress('enabling')
  const enableCmd = isLinux
    ? [
        `loginctl enable-linger '${escapeSingleQuotes(opts.sshUser)}'`,
        'systemctl --user daemon-reload',
        `systemctl --user enable --now ${SERVICE_NAME}`,
      ].join(' && ')
    : `launchctl load -w '${escapedFile}'`
  const enableExec = await runSsh(spawn, connectArgs, enableCmd, timeoutMs)
  if (!enableExec.ok) {
    const err = summariseFailure('enable-failed', enableExec)
    logger.warn(`[ssh-start-server] ${err}`)
    // distinguish enable-failed (could not register/load) vs start-failed
    // (loaded but won't run). systemd `enable --now` covers both. We look
    // for systemd's distinctive "Job for X failed" / "exited with status" /
    // "ExecStart" markers — generic "Failed to ..." goes to enable-failed.
    const isStartIssue = /\bJob for\b|exited with|crashed|Active:\s*failed|ExecStart|Process exited/i.test(enableExec.stderr)
    return {
      ok: false,
      method: 'failed',
      servicePath: paths.file,
      error: err,
      errorCode: isStartIssue ? 'start-failed' : 'enable-failed',
    }
  }

  // ── Stage 3: verify ──────────────────────────────────────────────────────
  // 'starting' is a UI-only beat between enable success and the verify probe;
  // the actual `start` happened inside Stage 2's `enable --now` / `load -w`.
  onProgress('starting')
  const verifyCmd = isLinux
    ? `systemctl --user is-active ${SERVICE_NAME} && (ss -tnlp 2>/dev/null | grep ':${port}' || pgrep -x ${SERVICE_NAME})`
    : `launchctl list | grep ${LAUNCHD_LABEL} && pgrep -x ${SERVICE_NAME}`
  onProgress('verifying')
  const verifyExec = await runSsh(spawn, connectArgs, verifyCmd, timeoutMs)
  if (!verifyExec.ok) {
    const err = summariseFailure('verify-failed', verifyExec)
    logger.warn(`[ssh-start-server] ${err}`)
    return { ok: false, method: 'failed', servicePath: paths.file, error: err, errorCode: 'verify-failed', checkOutput: verifyExec.stdout || verifyExec.stderr }
  }

  return {
    ok: true,
    method,
    servicePath: paths.file,
    checkOutput: verifyExec.stdout.trim(),
  }
}

// re-exported so tests can render unit content directly without spawning ssh
export const __internals = {
  renderSystemdUnit,
  renderLaunchdPlist,
  buildWriteUnitCommand,
  buildSshConnectArgs,
  escapeSingleQuotes,
  escapeXml,
  validateSystemdValue,
  systemdUnitPath,
  launchdPlistPath,
  SERVICE_NAME,
  LAUNCHD_LABEL,
  DEFAULT_SERVER_PORT,
}
