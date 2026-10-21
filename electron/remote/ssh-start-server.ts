import type { ChildProcess, StdioOptions } from 'child_process'
import { logger } from '../logger'
import { buildBaseSshArgs, buildBaseSshSpawnEnv, escapeSingleQuotesStrict } from './ssh-args'
import { shutdownSshProcess } from './ssh-process-lifecycle'
import {
  assertBundleInstallRoot,
  buildSshBundleDiscardPreviousCommand,
  buildSshBundleRestoreCommand,
  parseBundleRestoreOutcome,
  type BundleRestoreOutcome,
} from '../server-bundle-install-script'

export interface StartServerOptions {
  sshHost: string
  /** Empty: the user comes from ~/.ssh/config (T0505). */
  sshUser: string
  sshPort?: number
  sshKeyPath?: string
  targetOS: 'ssh-linux' | 'ssh-darwin'
  /**
   * Where the server bundle was extracted (e.g. `~/.local/bat-server` or the
   * already-resolved `/home/alice/.local/bat-server`). A leading `~` / `~/` is
   * expanded against `serverHome` before rendering (T0379 / BUG-088), so the
   * service unit's ExecStart is always an absolute `${installPath}/bin/bat-server`.
   * v1 only supports `~/.local/bat-server`; sudo `/opt/bat-server` is excluded
   * (D-SSH-8) and not handled here.
   */
  installPath: string
  /** Default 51820 (v1 hard-coded; out-of-scope to dynamic-pick per工單). */
  serverPort?: number
  /**
   * Remote `$HOME` parsed by `verify-ssh-auth`. Required: every path written
   * into the unit/plist (and the unit/plist file location itself) is made
   * absolute from it (T0379 / BUG-088, D126). systemd does not expand `~` in
   * `ExecStart`, launchd does not expand `~` in `ProgramArguments`, and bash
   * does not expand `~` inside the single-quoted `mkdir` / `cat >` / `launchctl`
   * arguments below. Must start with `/` and pass `resolveServerHome()`.
   */
  serverHome: string
  /**
   * T0554 (BUG-141): before overwriting, copy the existing unit / plist to
   * `<file>.bat-prev` and report the service state (`previous`), so a cancelled
   * upgrade can put both back (`stopServerOnRemote` `restore-previous`). The
   * wizard asks for it once per run; a retry keeps the first backup.
   */
  backupPrevious?: boolean
}

/** T0554: the service before this run touched it. */
export interface ServicePrevious {
  /** A unit / plist existed and was copied to `<file>.bat-prev`. */
  unit: boolean
  active: boolean
  enabled: boolean
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
  /** T0554: set once the backup ran (`backupPrevious`), on failures too. */
  previous?: ServicePrevious
}

export type StartServerProgress = (phase: StartServerPhase) => void

type SpawnFn = (
  command: string,
  args: readonly string[],
  options: { stdio?: StdioOptions; windowsHide?: boolean; env?: NodeJS.ProcessEnv },
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
/** T0554: backup of the unit / plist the wizard overwrote (systemd / launchd ignore the suffix). */
const UNIT_BACKUP_SUFFIX = '.bat-prev'

/**
 * Bash single-quote escape: `'` becomes `'\''`. Test-facing wrapper around
 * the shared `escapeSingleQuotesStrict` (T0296) that:
 *   - rejects `\n` (heredoc framing) — pre-existing contract
 *   - rejects `\r` / NUL / other control chars (EC-002, T0293)
 * Error message preserves the legacy `/forbidden newline/` substring for
 * the `\n` case; electron/__tests__/ssh-start-server.test.ts asserts it
 * ("escapeSingleQuotes escapes apostrophes and rejects newline / control chars").
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

/**
 * Validate the remote `$HOME` (T0379 / BUG-088). Same shape rule as the WSL
 * `resolveHome()` (T0378): absolute, conservative charset, no `..` segment.
 * Returned without trailing slash (`/` itself becomes `''` so joins stay
 * `/<rest>`).
 */
function resolveServerHome(serverHome: unknown): string {
  if (typeof serverHome !== 'string' || serverHome.length === 0) {
    throw new Error('serverHome is required to build absolute service paths (verify-ssh-auth must resolve the remote $HOME first)')
  }
  if (!/^\/[A-Za-z0-9._/-]*$/.test(serverHome) || serverHome.split('/').includes('..')) {
    throw new Error(`serverHome must be an absolute path without special characters: ${JSON.stringify(serverHome)}`)
  }
  return serverHome.replace(/\/+$/, '')
}

/**
 * Expand a leading `~` / `~/` against the validated remote home (T0379 / D126).
 * Absolute paths pass through unchanged. `~user/...` and relative paths are
 * rejected: neither systemd `ExecStart` nor launchd `ProgramArguments` would
 * resolve them, and guessing would write a unit that cannot start.
 */
function expandHomePath(path: string, home: string): string {
  if (path === '~') return home || '/'
  if (path.startsWith('~/')) return `${home}${path.slice(1)}`
  if (path.startsWith('/')) return path
  throw new Error(`installPath must be absolute or start with ~/ (got ${JSON.stringify(path)})`)
}

/** Absolute install path for the service definition (T0379). */
function resolveInstallPath(opts: StartServerOptions): string {
  return expandHomePath(opts.installPath, resolveServerHome(opts.serverHome))
}

function systemdUnitPath(home: string): { dir: string; file: string } {
  return {
    dir: `${home}/.config/systemd/user`,
    file: `${home}/.config/systemd/user/bat-server.service`,
  }
}

function launchdPlistPath(home: string): { dir: string; file: string } {
  return {
    dir: `${home}/Library/LaunchAgents`,
    file: `${home}/Library/LaunchAgents/com.bat-server.plist`,
  }
}

/**
 * Port the service listens on (T0511 / BUG-121). Rendered into the unit /
 * plist and the verify script, so it must be a plain integer.
 */
function resolveServerPort(opts: Pick<StartServerOptions, 'serverPort'>): number {
  const port = opts.serverPort ?? DEFAULT_SERVER_PORT
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`serverPort must be an integer in 1-65535 (got ${JSON.stringify(opts.serverPort)})`)
  }
  return port
}

/**
 * bat-server arguments (T0511 / BUG-121). bat-server reads the port from
 * `--port` / `BAT_SERVER_PORT` and the bind address only from
 * `--bind-interface` (scripts/bat-server.mjs); both flags exist since the
 * first bundle (T0272), so every deployed bundle accepts them. Before T0511
 * the unit / plist set `BAT_REMOTE_PORT` / `BAT_REMOTE_BIND`, which bat-server
 * never reads (it listened on its 54321 default). Flags also win over any
 * `BAT_SERVER_PORT` the service manager might pass down.
 * T0425 (BUG-098, D134): loopback only — BAT reaches it via `ssh -L`.
 */
function serverArgs(port: number): string[] {
  return ['--port', String(port), '--bind-interface', 'localhost']
}

function renderSystemdUnit(opts: StartServerOptions): string {
  const port = resolveServerPort(opts)
  // T0297 F-005: reject structural chars in installPath before interpolating.
  // `\n` / `\r` already rejected upstream by escapeSingleQuotesStrict (T0296),
  // but `[ ] =` would still inject INI sections / key-value pairs.
  // T0379 / BUG-088 (D126): systemd does not expand `~` in ExecStart, so the
  // path is made absolute from serverHome here. `%h` is deliberately not used.
  const safeInstallPath = validateSystemdValue(resolveInstallPath(opts), 'installPath')
  return [
    '[Unit]',
    'Description=BAT remote server (PLAN-007)',
    'After=network.target',
    '',
    '[Service]',
    'Type=simple',
    `ExecStart=${safeInstallPath}/bin/bat-server ${serverArgs(port).join(' ')}`,
    'Restart=on-failure',
    'RestartSec=5s',
    '',
    '[Install]',
    'WantedBy=default.target',
    '',
  ].join('\n')
}

function renderLaunchdPlist(opts: StartServerOptions): string {
  const port = resolveServerPort(opts)
  // T0297 F-005: every value interpolated into `<string>...</string>` runs
  // through escapeXml so attacker-controlled chars cannot terminate the
  // element early and inject siblings (e.g. `</string><key>RunAsUser</key>...`).
  const labelXml = escapeXml(LAUNCHD_LABEL)
  // T0379 / BUG-088: launchd hands ProgramArguments to execvp without `~`
  // expansion (launchd.plist(5)), so the path is made absolute first.
  const installPathXml = escapeXml(resolveInstallPath(opts))
  const argStrings = serverArgs(port).map((arg) => `    <string>${escapeXml(arg)}</string>`)
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
    ...argStrings,
    '  </array>',
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

/**
 * T0554 (BUG-141): copy the unit / plist about to be overwritten to
 * `<file>.bat-prev` (a missing file removes a stale backup) and print the
 * service state. Built from constants plus the validated `$HOME`.
 */
function buildBackupCommand(targetOS: StartServerOptions['targetOS'], file: string): string {
  const lines = [
    `unit='${escapeSingleQuotes(file)}'`,
    `prev="$unit${UNIT_BACKUP_SUFFIX}"`,
    'if [ -f "$unit" ]; then cp -p -- "$unit" "$prev" || exit 1; echo BAT_PREV_UNIT=1; else rm -f -- "$prev" || exit 1; echo BAT_PREV_UNIT=0; fi',
  ]
  if (targetOS === 'ssh-linux') {
    lines.push(
      `if systemctl --user is-active --quiet ${SERVICE_NAME} 2>/dev/null; then echo BAT_PREV_ACTIVE=1; else echo BAT_PREV_ACTIVE=0; fi`,
      `if systemctl --user is-enabled --quiet ${SERVICE_NAME} 2>/dev/null; then echo BAT_PREV_ENABLED=1; else echo BAT_PREV_ENABLED=0; fi`,
    )
  } else {
    lines.push(`if launchctl list ${LAUNCHD_LABEL} >/dev/null 2>&1; then echo BAT_PREV_ACTIVE=1; echo BAT_PREV_ENABLED=1; else echo BAT_PREV_ACTIVE=0; echo BAT_PREV_ENABLED=0; fi`)
  }
  return lines.join('\n')
}

/** T0554: backup stdout -> previous state; null when a marker is missing. */
function parseBackupOutput(stdout: string): ServicePrevious | null {
  const values = new Map<string, string>()
  for (const line of stdout.split(/\r?\n/)) {
    const match = /^(BAT_PREV_(?:UNIT|ACTIVE|ENABLED))=([01])$/.exec(line.trim())
    if (match) values.set(match[1], match[2])
  }
  const unit = values.get('BAT_PREV_UNIT')
  const active = values.get('BAT_PREV_ACTIVE')
  const enabled = values.get('BAT_PREV_ENABLED')
  if (unit === undefined || active === undefined || enabled === undefined) return null
  return { unit: unit === '1', active: active === '1', enabled: enabled === '1' }
}

/** Verify polls once a second (bat-server may still be generating its TLS cert). */
const VERIFY_ATTEMPTS = 20

/**
 * Remote verify script (T0511 / BUG-121). Passes only when the service's own
 * process has a TCP socket listening on `port`:
 *   - systemd: `is-active` = active, then the unit's MainPID must own a LISTEN
 *     socket on the port (/proc/net/tcp{,6} inode ↔ /proc/<pid>/fd). Another
 *     process holding the port does not count.
 *   - launchd: the job's PID from `launchctl list` must hold the LISTEN
 *     socket (`lsof -a -p <pid> -iTCP:<port> -sTCP:LISTEN`).
 * It polls up to VERIFY_ATTEMPTS seconds. Before T0511 the probe fell back to
 * `pgrep -x bat-server`, which never matches (the process is node; its
 * name is `MainThread`), and grepped `ss` output for the port without
 * checking the owner. Runs under `sh -c` so the loop does not depend on the
 * login shell.
 */
function buildVerifyCommand(targetOS: StartServerOptions['targetOS'], port: number): string {
  const loop = (probe: string, failure: string): string => [
    'i=0',
    `while :; do ${probe}; i=$((i+1)); if [ "$i" -ge ${VERIFY_ATTEMPTS} ]; then break; fi; sleep 1; done`,
    `echo "${failure}" >&2`,
    'exit 1',
  ].join('; ')
  let script: string
  if (targetOS === 'ssh-linux') {
    const portHex = port.toString(16).toUpperCase().padStart(4, '0')
    const probe = [
      `state=$(systemctl --user is-active ${SERVICE_NAME} 2>/dev/null)`,
      `pid=$(systemctl --user show -p MainPID ${SERVICE_NAME} 2>/dev/null | cut -d= -f2)`,
      'if [ "$state" = active ] && [ -n "$pid" ] && [ "$pid" != 0 ]; then'
        + ` for n in $(awk '$4 == "0A" && $2 ~ /:${portHex}$/ { print $10 }' /proc/net/tcp /proc/net/tcp6 2>/dev/null); do`
        + ' if ls -l "/proc/$pid/fd" 2>/dev/null | grep -qF "socket:[$n]"; then'
        + ` echo "${SERVICE_NAME} active (pid $pid), listening on port ${port}"; exit 0;`
        + ' fi; done; fi',
    ].join('; ')
    script = loop(probe, `${SERVICE_NAME}.service is \${state:-unknown} (MainPID \${pid:-?}); no socket of that process listens on port ${port}`)
  } else {
    const probe = [
      `pid=$(launchctl list 2>/dev/null | awk '$3 == "${LAUNCHD_LABEL}" { print $1 }')`,
      'case "$pid" in ""|-|*[!0-9]*) ;; *)'
        + ` if lsof -nP -a -p "$pid" -iTCP:${port} -sTCP:LISTEN >/dev/null 2>&1; then`
        + ` echo "${LAUNCHD_LABEL} running (pid $pid), listening on port ${port}"; exit 0;`
        + ' fi ;; esac',
    ].join('; ')
    script = loop(probe, `${LAUNCHD_LABEL} pid \${pid:--}; no socket of that process listens on port ${port}`)
  }
  return `sh -c '${escapeSingleQuotes(script)}'`
}

function buildSshConnectArgs(opts: StartServerOptions): string[] {
  // F-004 (leading `-`) + control-char + whitespace rejection now lives in
  // buildBaseSshArgs.validateSshIdentifier (T0296). `@` in sshUser remains
  // forbidden here for legacy reasons — it would still parse but is almost
  // certainly garbage. Errors mirror the historic message format so log-greps
  // keep working. electron/__tests__/ssh-start-server.test.ts covers the `@`
  // check ("an sshUser containing @ …", T0688; teardown rejects it earlier, in
  // validateTeardownConnect) and the validateSshIdentifier rules ("an sshHost
  // starting with - is rejected before any ssh exec (T0296 F-004)").
  if (typeof opts.sshUser === 'string' && opts.sshUser.includes('@')) {
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
    proc = spawn('ssh', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      env: { ...process.env, ...buildBaseSshSpawnEnv() },
    })
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
      // BUG-063 (T0299): escalate SIGTERM → SIGKILL via the shared helper so a
      // stuck remote shell can't survive the timeout as a zombie. Fire-and-
      // forget — runSsh resolves on the timeout, lifecycle continues async.
      void shutdownSshProcess(proc).catch(() => { /* swallow kill races */ })
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
  const port = resolveServerPort(opts)

  const connectArgs = buildSshConnectArgs(opts)
  const isLinux = opts.targetOS === 'ssh-linux'
  const method: 'systemd' | 'launchd' = isLinux ? 'systemd' : 'launchd'
  // T0379: resolved before any ssh exec, so a bad serverHome throws here and no
  // file is written. Paths must be absolute: the commands below single-quote
  // them, and bash does not expand `~` inside quotes.
  const home = resolveServerHome(opts.serverHome)
  const paths = isLinux ? systemdUnitPath(home) : launchdPlistPath(home)
  const content = isLinux ? renderSystemdUnit(opts) : renderLaunchdPlist(opts)
  const escapedFile = escapeSingleQuotes(paths.file)

  // ── Stage 0 (T0554): back up the unit / plist this run overwrites ───────
  onProgress('writing-unit')
  let previous: ServicePrevious | undefined
  if (opts.backupPrevious === true) {
    const backupExec = await runSsh(spawn, connectArgs, buildBackupCommand(opts.targetOS, paths.file), timeoutMs)
    const parsed = backupExec.ok ? parseBackupOutput(backupExec.stdout) : null
    if (!parsed) {
      const err = backupExec.ok
        ? 'unit-write-failed: could not read the current service state before changing it'
        : summariseFailure('unit-write-failed: backing up the current service', backupExec)
      logger.warn(`[ssh-start-server] ${err}`)
      return { ok: false, method: 'failed', servicePath: paths.file, error: err, errorCode: 'unit-write-failed' }
    }
    previous = parsed
  }
  const withPrevious = (result: StartServerResult): StartServerResult => (previous ? { ...result, previous } : result)

  // ── Stage 1: write unit/plist ───────────────────────────────────────────
  const writeCmd = buildWriteUnitCommand(paths.dir, paths.file, content)
  const writeExec = await runSsh(spawn, connectArgs, writeCmd, timeoutMs)
  if (!writeExec.ok) {
    const err = summariseFailure('unit-write-failed', writeExec)
    logger.warn(`[ssh-start-server] ${err}`)
    return withPrevious({ ok: false, method: 'failed', servicePath: paths.file, error: err, errorCode: 'unit-write-failed' })
  }

  // ── Stage 2: enable + start ─────────────────────────────────────────────
  onProgress('enabling')
  const enableCmd = isLinux
    ? [
        // T0505: no user (ssh config picked it) -> linger the login user.
        opts.sshUser
          ? `loginctl enable-linger '${escapeSingleQuotes(opts.sshUser)}'`
          : 'loginctl enable-linger "$(id -un)"',
        'systemctl --user daemon-reload',
        // T0511: restart, not `enable --now` — a service that is already up
        // (re-run of the wizard) must pick up the new bundle and unit args.
        `systemctl --user enable ${SERVICE_NAME}`,
        `systemctl --user restart ${SERVICE_NAME}`,
      ].join(' && ')
    // T0511: unload first (ignored when not loaded) so a re-run reloads the plist.
    : `launchctl unload '${escapedFile}' >/dev/null 2>&1; launchctl load -w '${escapedFile}'`
  const enableExec = await runSsh(spawn, connectArgs, enableCmd, timeoutMs)
  if (!enableExec.ok) {
    // distinguish enable-failed (could not register/load) vs start-failed
    // (loaded but won't run). systemd `enable --now` covers both. We look
    // for systemd's distinctive "Job for X failed" / "exited with status" /
    // "ExecStart" markers — generic "Failed to ..." goes to enable-failed.
    const isStartIssue = /\bJob for\b|exited with|crashed|Active:\s*failed|ExecStart|Process exited/i.test(enableExec.stderr)
    // T0688: the error / log prefix follows errorCode.
    const errorCode = isStartIssue ? 'start-failed' : 'enable-failed'
    const err = summariseFailure(errorCode, enableExec)
    logger.warn(`[ssh-start-server] ${err}`)
    return withPrevious({
      ok: false,
      method: 'failed',
      servicePath: paths.file,
      error: err,
      errorCode,
    })
  }

  // ── Stage 3: verify ──────────────────────────────────────────────────────
  // 'starting' is a UI-only beat between enable success and the verify probe;
  // the actual `start` happened inside Stage 2's `restart` / `load -w`.
  onProgress('starting')
  const verifyCmd = buildVerifyCommand(opts.targetOS, port)
  onProgress('verifying')
  const verifyExec = await runSsh(spawn, connectArgs, verifyCmd, timeoutMs)
  if (!verifyExec.ok) {
    const err = summariseFailure('verify-failed', verifyExec)
    logger.warn(`[ssh-start-server] ${err}`)
    return withPrevious({ ok: false, method: 'failed', servicePath: paths.file, error: err, errorCode: 'verify-failed', checkOutput: verifyExec.stdout || verifyExec.stderr })
  }

  return withPrevious({
    ok: true,
    method,
    servicePath: paths.file,
    checkOutput: verifyExec.stdout.trim(),
  })
}

// ── T0426 (BUG-100): rollback teardown — stop-server / uninstall-bundle ─────

export interface StopServerOptions {
  sshHost: string
  sshUser: string
  sshPort?: number
  sshKeyPath?: string
  targetOS: 'ssh-linux' | 'ssh-darwin'
  /** Remote `$HOME` (same rule as `StartServerOptions.serverHome`). */
  serverHome: string
  /**
   * T0554 (BUG-141): `stop` (default) disables the service and deletes the unit
   * / plist; `restore-previous` puts back `<file>.bat-prev` (`restore` says
   * whether to enable and start it); `discard-backup` only deletes the backup
   * (the wizard finished).
   */
  action?: 'stop' | 'restore-previous' | 'discard-backup'
  restore?: { enabled: boolean; start: boolean }
}

export interface UninstallBundleOptions {
  sshHost: string
  sshUser: string
  sshPort?: number
  sshKeyPath?: string
  /**
   * The directory the upload created: absolute (`/home/alice/.local/bat-server`,
   * `/opt/bat-server`) or `~/...`. Its last segment must be `bat-server`.
   */
  installPath: string
  /**
   * T0554 (BUG-141): `remove` (default) deletes the install; `restore-previous`
   * puts `<installPath>.bat-old` back (and with `startService` starts the
   * service again afterwards); `discard-previous` deletes `<installPath>.bat-old`.
   * The last two need an absolute install path.
   */
  mode?: 'remove' | 'restore-previous' | 'discard-previous'
  startService?: 'ssh-linux' | 'ssh-darwin'
}

export type SshTeardownResult = { ok: true; outcome?: BundleRestoreOutcome } | { ok: false; error: string }

/**
 * Teardown whitelist (T0426, stricter than `validateSshIdentifier`). Host and
 * user are spliced into argv only (`-- user@host`), never into the remote
 * command, but rollback takes them straight from the renderer, so they are
 * held to a closed charset: `[A-Za-z0-9._-]`, plus `:` for the host so IPv6
 * literals (`fe80::1`) still work. `@` is rejected (user and host arrive as
 * separate fields). Neither may start with `-` (would parse as an ssh option).
 * T0505: the user may be empty / missing (ssh config decides it); the host is
 * then the whole target, which `buildBaseSshArgs` holds to the same charset.
 */
const TEARDOWN_HOST_RE = /^(?!-)[A-Za-z0-9._:-]{1,253}$/
const TEARDOWN_USER_RE = /^(?!-)[A-Za-z0-9._-]{1,64}$/
const TEARDOWN_TARGETS = new Set(['ssh-linux', 'ssh-darwin'])
/** Last path segment every SSH install path ends in (configure-host options). */
const BUNDLE_DIR_NAME = 'bat-server'

function validateTeardownConnect(opts: SshConnectFields): void {
  if (typeof opts.sshHost !== 'string' || !TEARDOWN_HOST_RE.test(opts.sshHost)) {
    throw new Error(`Invalid sshHost for teardown: ${JSON.stringify(opts.sshHost)}`)
  }
  const noUser = opts.sshUser === undefined || opts.sshUser === ''
  if (!noUser && (typeof opts.sshUser !== 'string' || !TEARDOWN_USER_RE.test(opts.sshUser))) {
    throw new Error(`Invalid sshUser for teardown: ${JSON.stringify(opts.sshUser)}`)
  }
  if (opts.sshPort !== undefined
    && !(Number.isInteger(opts.sshPort) && opts.sshPort >= 1 && opts.sshPort <= 65535)) {
    throw new Error(`Invalid sshPort for teardown: ${JSON.stringify(opts.sshPort)}`)
  }
  // sshKeyPath is a local (often Windows) path handed to `-i` as one argv
  // element; buildBaseSshArgs runs validateSshIdentifier on it.
}

type SshConnectFields = Pick<StopServerOptions, 'sshHost' | 'sshUser' | 'sshPort' | 'sshKeyPath'>

/**
 * Remote command for `ssh:stop-server`. Built from constants plus the
 * validated `$HOME` only. Idempotent: every teardown action ignores "not
 * there" (unknown unit, unloaded job, missing file); only the final check —
 * service gone and unit/plist file removed — decides the exit status.
 * `loginctl enable-linger` is deliberately left alone (it may predate BAT).
 */
function buildStopServerCommand(opts: StopServerOptions): string {
  if (!TEARDOWN_TARGETS.has(opts.targetOS)) {
    throw new Error(`Invalid targetOS for teardown: ${JSON.stringify(opts.targetOS)}`)
  }
  const home = resolveServerHome(opts.serverHome)
  const action = opts.action ?? 'stop'
  if (action === 'restore-previous') return buildRestoreServiceCommand(opts.targetOS, home, opts.restore)
  if (action === 'discard-backup') {
    const file = opts.targetOS === 'ssh-linux' ? systemdUnitPath(home).file : launchdPlistPath(home).file
    return `rm -f -- '${escapeSingleQuotes(file + UNIT_BACKUP_SUFFIX)}'`
  }
  if (action !== 'stop') {
    throw new Error(`Invalid teardown action: ${JSON.stringify(action)}`)
  }
  if (opts.targetOS === 'ssh-linux') {
    const unit = escapeSingleQuotes(systemdUnitPath(home).file)
    return [
      `systemctl --user disable --now ${SERVICE_NAME} >/dev/null 2>&1`,
      `rm -f '${unit}'`,
      'systemctl --user daemon-reload >/dev/null 2>&1',
      `systemctl --user reset-failed ${SERVICE_NAME} >/dev/null 2>&1`,
      `if systemctl --user is-active --quiet ${SERVICE_NAME}; then echo '${SERVICE_NAME} is still active' >&2; exit 1; fi`,
      `test ! -e '${unit}' || { echo 'could not remove ${unit}' >&2; exit 1; }`,
    ].join('; ')
  }
  const plist = escapeSingleQuotes(launchdPlistPath(home).file)
  return [
    `launchctl unload -w '${plist}' >/dev/null 2>&1`,
    `launchctl remove ${LAUNCHD_LABEL} >/dev/null 2>&1`,
    `rm -f '${plist}'`,
    `test ! -e '${plist}' || { echo 'could not remove ${plist}' >&2; exit 1; }`,
  ].join('; ')
}

/**
 * T0554 (BUG-141): put back the unit / plist `buildBackupCommand` saved, with
 * the enabled state it had; start it only when asked (the wizard leaves it
 * stopped while the previous bundle still has to be restored).
 */
function buildRestoreServiceCommand(
  targetOS: StopServerOptions['targetOS'],
  home: string,
  restore: StopServerOptions['restore'],
): string {
  if (!restore || typeof restore.enabled !== 'boolean' || typeof restore.start !== 'boolean') {
    throw new Error(`Invalid restore options for teardown: ${JSON.stringify(restore)}`)
  }
  const file = targetOS === 'ssh-linux' ? systemdUnitPath(home).file : launchdPlistPath(home).file
  const lines = [
    `unit='${escapeSingleQuotes(file)}'`,
    `prev="$unit${UNIT_BACKUP_SUFFIX}"`,
    '[ -f "$prev" ] || { echo "no backup of $unit to restore" >&2; exit 1; }',
  ]
  if (targetOS === 'ssh-linux') {
    lines.push(
      `systemctl --user stop ${SERVICE_NAME} >/dev/null 2>&1`,
      'mv -f -- "$prev" "$unit" || exit 1',
      'systemctl --user daemon-reload || exit 1',
      `systemctl --user ${restore.enabled ? 'enable' : 'disable'} ${SERVICE_NAME} >/dev/null 2>&1`,
    )
    if (restore.start) lines.push(`systemctl --user restart ${SERVICE_NAME} || exit 1`)
  } else {
    lines.push(
      'launchctl unload "$unit" >/dev/null 2>&1',
      'mv -f -- "$prev" "$unit" || exit 1',
    )
    if (restore.start) lines.push('launchctl load -w "$unit" || exit 1')
  }
  return lines.join('\n')
}

/** T0554: start the service again once the previous bundle is back. */
function buildStartServiceCommand(targetOS: unknown): string {
  if (targetOS === 'ssh-linux') {
    return `systemctl --user restart ${SERVICE_NAME} || { echo "server bundle restore: restored, but could not start ${SERVICE_NAME}" >&2; exit 1; }`
  }
  if (targetOS === 'ssh-darwin') {
    return `launchctl load -w "$HOME/Library/LaunchAgents/${LAUNCHD_LABEL}.plist" || { echo "server bundle restore: restored, but could not load ${LAUNCHD_LABEL}" >&2; exit 1; }`
  }
  throw new Error(`Invalid startService for teardown: ${JSON.stringify(targetOS)}`)
}

/**
 * Validate the install path for `rm -rf` (T0426). Accepts `~/<rel>` or an
 * absolute path over `[A-Za-z0-9._/-]`, with no `.` / `..` / empty segment,
 * whose last segment is `bat-server` — so a bad renderer value can never widen
 * the delete to `$HOME`, `/` or an unrelated directory. Returns the shell
 * operand: `"$HOME"/'<rel>'` (the remote shell expands `$HOME`, which is a
 * constant here) or `'<abs>'`.
 */
function resolveUninstallTarget(installPath: unknown): string {
  if (typeof installPath !== 'string') {
    throw new Error('installPath must be a string')
  }
  const trimmed = installPath.replace(/\/+$/, '')
  const fromHome = trimmed.startsWith('~/')
  const rest = fromHome ? trimmed.slice(2) : trimmed.startsWith('/') ? trimmed.slice(1) : null
  if (rest === null || !/^[A-Za-z0-9._/-]+$/.test(rest)) {
    throw new Error(`installPath must be absolute or start with ~/ and use only [A-Za-z0-9._/-]: ${JSON.stringify(installPath)}`)
  }
  const segments = rest.split('/')
  if (segments.some((s) => s === '' || s === '.' || s === '..')) {
    throw new Error(`installPath must not contain empty, . or .. segments: ${JSON.stringify(installPath)}`)
  }
  if (segments[segments.length - 1] !== BUNDLE_DIR_NAME) {
    throw new Error(`installPath must end in /${BUNDLE_DIR_NAME}: ${JSON.stringify(installPath)}`)
  }
  return fromHome ? `"$HOME"/'${escapeSingleQuotes(rest)}'` : `'${escapeSingleQuotes(`/${rest}`)}'`
}

/** Remote command for `ssh:uninstall-bundle`. `rm -rf` on a missing path is a no-op. */
function buildUninstallBundleCommand(installPath: unknown): string {
  const target = resolveUninstallTarget(installPath)
  return `rm -rf -- ${target} && test ! -e ${target}`
}

/**
 * T0554 (BUG-141): `ssh:uninstall-bundle` with a mode. `restore-previous` /
 * `discard-previous` work on `<installPath>.bat-old` through the shared
 * install-script builders, so the root must pass both the T0426 rule (ends in
 * `/bat-server`) and the T0552 install-root rule (absolute).
 */
function buildBundleTeardownCommand(opts: UninstallBundleOptions): string {
  const mode = opts.mode ?? 'remove'
  if (mode === 'remove') return buildUninstallBundleCommand(opts.installPath)
  resolveUninstallTarget(opts.installPath)
  const root = assertBundleInstallRoot(opts.installPath)
  if (mode === 'restore-previous') {
    const start = opts.startService === undefined ? undefined : buildStartServiceCommand(opts.startService)
    return buildSshBundleRestoreCommand(escapeSingleQuotes(root), start)
  }
  if (mode === 'discard-previous') return buildSshBundleDiscardPreviousCommand(escapeSingleQuotes(root))
  throw new Error(`Invalid uninstall mode: ${JSON.stringify(mode)}`)
}

async function runTeardown(
  label: string,
  opts: SshConnectFields,
  buildCommand: () => string,
  deps: StarterDeps,
  readOutcome?: (stdout: string) => BundleRestoreOutcome | null,
): Promise<SshTeardownResult> {
  let connectArgs: string[]
  let command: string
  try {
    validateTeardownConnect(opts)
    connectArgs = buildSshConnectArgs(opts as StartServerOptions)
    command = buildCommand()
  } catch (error) {
    return { ok: false, error: `${label}: ${error instanceof Error ? error.message : String(error)}` }
  }
  const spawn = deps.spawn ?? (await import('child_process')).spawn
  const exec = await runSsh(spawn, connectArgs, command, deps.timeoutMs ?? DEFAULT_TIMEOUT_MS)
  if (!exec.ok) {
    const err = summariseFailure(label, exec)
    logger.warn(`[ssh-start-server] ${err}`)
    return { ok: false, error: err }
  }
  if (readOutcome) {
    const outcome = readOutcome(exec.stdout)
    if (!outcome) return { ok: false, error: `${label}: the remote script did not report an outcome` }
    return { ok: true, outcome }
  }
  return { ok: true }
}

/**
 * T0426 (BUG-100): undo `startServerOnRemote` — stop + disable the service and
 * delete the unit / plist. Safe to call when start-server only got halfway or
 * never ran (rollback of a failed step).
 */
export function stopServerOnRemote(opts: StopServerOptions, deps: StarterDeps = {}): Promise<SshTeardownResult> {
  return runTeardown('stop-server-failed', opts, () => buildStopServerCommand(opts), deps)
}

/**
 * T0426 (BUG-100): undo the bundle upload — `rm -rf` the install directory.
 * T0554 (BUG-141): or restore / discard the previous install (`mode`).
 */
export function uninstallBundleOnRemote(opts: UninstallBundleOptions, deps: StarterDeps = {}): Promise<SshTeardownResult> {
  return runTeardown(
    'uninstall-bundle-failed',
    opts,
    () => buildBundleTeardownCommand(opts),
    deps,
    opts.mode === 'restore-previous' ? parseBundleRestoreOutcome : undefined,
  )
}

// re-exported so tests can render unit content directly without spawning ssh
export const __internals = {
  renderSystemdUnit,
  renderLaunchdPlist,
  buildWriteUnitCommand,
  buildVerifyCommand,
  resolveServerPort,
  serverArgs,
  buildSshConnectArgs,
  escapeSingleQuotes,
  escapeXml,
  validateSystemdValue,
  resolveServerHome,
  expandHomePath,
  systemdUnitPath,
  launchdPlistPath,
  buildStopServerCommand,
  buildUninstallBundleCommand,
  buildBundleTeardownCommand,
  buildBackupCommand,
  parseBackupOutput,
  buildRestoreServiceCommand,
  resolveUninstallTarget,
  SERVICE_NAME,
  LAUNCHD_LABEL,
  DEFAULT_SERVER_PORT,
}
