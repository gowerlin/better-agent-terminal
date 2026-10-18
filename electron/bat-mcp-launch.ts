/**
 * PLAN-047 M1 / T0584: the launch arguments that attach the `bat` MCP server (scripts/bat-mcp.mjs,
 * a stdio shim to this host's RemoteServer) to a claude / codex tab BAT starts.
 *
 *   - claude: `--mcp-config=<file>`, the file written here under `<dataDir>/bat-mcp/claude.json`
 *     (command / args only — no token, no env value: the shim inherits `BAT_REMOTE_PORT` /
 *     `BAT_REMOTE_TOKEN` from the PTY). `=` form because `--mcp-config <configs...>` is variadic
 *     and would swallow the prompt that follows. Never `--strict-mcp-config`.
 *   - codex: `-c mcp_servers.bat.command=… -c mcp_servers.bat.args=[…] -c
 *     mcp_servers.bat.env_vars=[…] -c mcp_servers.bat.tool_timeout_sec=60` (TOML literal strings,
 *     shell-quoted per family). codex starts a stdio MCP server with a default env allow-list
 *     only (no `BAT_*`), so `env_vars` forwards the shim's variables **by name** (T0586 / BUG-148);
 *     never `mcp_servers.bat.env = { … }`, which would put the token value on the command line.
 *
 * PLAN-047 M1b-1 / T0590: + claude's `blocked` hooks, same entry, same conditions (Settings
 * `batMcpEnabled`, the endpoint), claude only: `--settings=<dataDir>/bat-mcp/claude-settings.json`
 * (`hooks` only — no `disableAllHooks`, permission, model or any other key; no token), each hook
 * running `<node> '<helperDir>/bat-hook.mjs' <event>` (electron/terminal-blocked-state.ts). Not
 * injected when the custom args already pass `--settings` (their own `--mcp-config` only skips the
 * MCP part) or `bat-hook.mjs` is missing. A file, not a JSON string: the hook commands hold quotes
 * that would need a second quoting layer per shell family on the command line. `=` form like
 * `--mcp-config=` (claude 2.1.300: `--settings <file-or-json>` takes one value, `=` is safe either
 * way). The launch decision is recorded as the terminal's `blockedDetection` (`hook` / `none`) when
 * the caller names the terminal (`recordBlockedDetection`).
 *
 * T0600 (D154): + `SessionStart` (async) → `agentStarted` (electron/terminal-blocked-state.ts). A
 * claude whose own settings turn hooks off (`disableAllHooks` in the managed / user settings file,
 * `allowManagedHooksOnly` in the managed one: `claudeHooksDisabledBy`) still gets the args, but the
 * terminal is recorded `none`: no hook will report, so neither `blocked` nor `agentStarted` can.
 *
 * PLAN-050 / T0641 (D167, T0640 contract C-2 / C-3): + claude's session name, `--name=<name>`
 * (`=` form, last of BAT's args, before the custom args), the name the caller computed with
 * `claudeSessionName` (src/lib/claude-session-name.ts). A part of its own: **not** tied to Settings
 * `batMcpEnabled` or the endpoint, no Settings switch. Not injected (`nameReason`): no name sent
 * (`no-name`), the custom args set one (`user-args`), the system runtime's claude is `< 2.1.76` or
 * its version unknown (`claude-too-old` / `version-unknown`, electron/claude-version-check.ts — the
 * caller passes that check's result as `claudeNameSupport`; absent = `version-unknown`). The
 * decision is recorded per terminal (`recordClaudeSessionName`, electron/claude-session-name-record.ts).
 *
 * One implementation for every launch path: the renderer (`agent:bat-mcp-launch-args`, proxied,
 * so a remote window gets the server's paths) and `terminal:create-agent-command`
 * (`createAgentPromptCommandBuilder`). Raw command mode is never touched.
 *
 * 🔴 No `electron` import: headless registers the same handler.
 */
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { quoteArgForShell, type ShellFamily } from '../src/utils/shell-quote'
import { normalizeClaudeSessionName } from '../src/lib/claude-session-name'
import type { HandlerRegistrar } from './handlers/types'
import type { ClaudeNameSupport } from './claude-version-check'
import type { ClaudeSessionNameReason, ClaudeSessionNameRecord } from './claude-session-name-record'

export const BAT_MCP_SERVER_NAME = 'bat'
export const BAT_MCP_SHIM = 'bat-mcp.mjs'
export const BAT_MCP_CONFIG_DIR = 'bat-mcp'
export const BAT_MCP_CLAUDE_CONFIG = 'claude.json'
/** T0590: the claude `--settings` file holding BAT's `blocked` hooks (same directory). */
export const BAT_MCP_CLAUDE_SETTINGS = 'claude-settings.json'
/** T0590: the hook script (`BAT_HELPER_DIR`, beside `bat-mcp.mjs`). */
export const BAT_HOOK_SCRIPT = 'bat-hook.mjs'
/** T0590: claude's per-hook timeout (seconds); the script itself ends within 2 s. */
export const BAT_HOOK_TIMEOUT_SEC = 5
/** Codex's default `tool_timeout_sec` is 60 s; the shim waits up to 55 s for `bat_wait`. */
export const BAT_MCP_CODEX_TOOL_TIMEOUT_SEC = 60
/**
 * T0586 / BUG-148: the env names codex forwards to the shim (`mcp_servers.bat.env_vars`; names
 * only, an unset name is skipped). Everything `scripts/bat-mcp.mjs`, `_bat-cert.mjs` and
 * `_bat-logger.mjs` read: endpoint + token, the tab id (audit log), the userData / cert / log
 * resolution (T0481), and the userData fallbacks codex's default list may lack (`APPDATA` is in
 * codex's Windows default, `XDG_CONFIG_HOME` is not in its Unix one).
 */
export const BAT_MCP_CODEX_ENV_VARS = [
  'BAT_REMOTE_PORT',
  'BAT_REMOTE_TOKEN',
  'BAT_TERMINAL_ID',
  'BAT_USER_DATA',
  'BAT_SERVER_CERT_PATH',
  'BAT_HELPER_LOG_DIR',
  'BAT_RUNTIME',
  'APPDATA',
  'XDG_CONFIG_HOME',
] as const
export const BAT_MCP_LAUNCH_ARGS_CHANNEL = 'agent:bat-mcp-launch-args'

export type BatMcpAgentKind = 'claude' | 'codex'

/** Terminal-driven agent ids BAT assembles the launch command of. */
export function batMcpAgentKind(agentId: string): BatMcpAgentKind | null {
  if (agentId === 'claude-cli' || agentId === 'claude-cli-worktree') return 'claude'
  if (agentId === 'codex-cli') return 'codex'
  return null
}

/** Settings → Advanced → BAT MCP; on unless explicitly `false`. */
export function isBatMcpEnabled(settings: Record<string, unknown> | null | undefined): boolean {
  return settings?.batMcpEnabled !== false
}

/** Why the user's own args already attach MCP for this agent, or null. */
export function userArgsAttachBatMcp(kind: BatMcpAgentKind, extraArgs: string | undefined): string | null {
  const args = extraArgs ?? ''
  if (kind === 'claude') return /(^|\s)--mcp-config(\s|=|$)/.test(args) ? 'custom args already pass --mcp-config' : null
  return /mcp_servers\.bat[.=]/.test(args) ? 'custom args already define mcp_servers.bat' : null
}

/** T0590: why the user's own claude args rule out BAT's `--settings` (hooks), or null. */
export function userArgsPassClaudeSettings(extraArgs: string | undefined): string | null {
  return /(^|\s)--settings(\s|=|$)/.test(extraArgs ?? '') ? 'custom args already pass --settings' : null
}

/**
 * T0641: the user's own claude args name the session — `--name` / `-n` (with a value or `=`), or a
 * short-flag group holding `n` (`-cn <name>`, `-nfoo`). claude takes the last `--name`, so theirs
 * would win over BAT's anyway; BAT then adds none and records `user-args`.
 */
export function userArgsSetClaudeName(extraArgs: string | undefined): boolean {
  return /(^|\s)(--name(\s|=|$)|-[A-Za-z]*n)/.test(extraArgs ?? '')
}

/**
 * T0590: claude hook event → what `scripts/bat-hook.mjs <event>` reports. `async` = runs in the
 * background (claude does not wait): the clearing events. The blocking ones run before the prompt /
 * dialog shows, so the report lands before the user can answer it.
 */
export const BAT_CLAUDE_HOOKS: ReadonlyArray<{ hookEvent: string; matcher?: string; event: string; async?: true }> = [
  { hookEvent: 'PermissionRequest', event: 'permission-request' },
  { hookEvent: 'PreToolUse', matcher: 'AskUserQuestion', event: 'ask-user-question' },
  { hookEvent: 'Notification', matcher: 'elicitation_dialog|elicitation_url_dialog', event: 'elicitation' },
  // T0594: the question answered (also by mouse, which is no input); only that tool starts node
  { hookEvent: 'PostToolUse', matcher: 'AskUserQuestion', event: 'ask-user-question-done', async: true },
  // T0620: the elicitation dialog closed (also by mouse, or the request cancelled / timed out).
  // ElicitationResult runs after the user's answer (not when the request was aborted);
  // `elicitation_response` follows it in every case, so either one alone still clears
  { hookEvent: 'ElicitationResult', event: 'elicitation-done', async: true },
  { hookEvent: 'Notification', matcher: 'elicitation_response', event: 'elicitation-done', async: true },
  { hookEvent: 'UserPromptSubmit', event: 'user-prompt-submit', async: true },
  { hookEvent: 'Stop', event: 'stop', async: true },
  // T0600: the launch confirmation (`agentStarted`); any `source`, which is not sent. async: claude
  // must not wait for it, and its stdout would go into the conversation (the script prints nothing)
  { hookEvent: 'SessionStart', event: 'session-start', async: true },
]

/** T0600: a claude settings file that can turn BAT's hooks off; `managed` = the machine's policy file. */
export interface ClaudeSettingsFile {
  file: string
  managed: boolean
}

/**
 * T0600: the claude settings files `claudeHooksDisabledBy` reads, highest precedence first: the
 * managed settings file (claude 2.1.300: `C:\Program Files\ClaudeCode`, `/Library/Application
 * Support/ClaudeCode`, `/etc/claude-code`), then the user's (`$CLAUDE_CONFIG_DIR` or `~/.claude`).
 * Project files (`<cwd>/.claude/settings[.local].json`) are not known at the launch decision.
 */
export function defaultClaudeSettingsFiles(
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
  homeDir: string = os.homedir(),
): ClaudeSettingsFile[] {
  const managedDir = platform === 'win32' ? 'C:\\Program Files\\ClaudeCode'
    : platform === 'darwin' ? '/Library/Application Support/ClaudeCode'
      : '/etc/claude-code'
  const p = platform === 'win32' ? path.win32 : path.posix
  const userDir = env.CLAUDE_CONFIG_DIR?.trim() || p.join(homeDir, '.claude')
  return [
    { file: p.join(managedDir, 'managed-settings.json'), managed: true },
    { file: p.join(userDir, 'settings.json'), managed: false },
  ]
}

/**
 * T0600: why claude will run none of BAT's hooks, or null: `allowManagedHooksOnly: true` in the
 * managed file, or `disableAllHooks: true` in the first file (in precedence order) that sets it.
 * Unreadable / not JSON = not set. MDM / server-managed policies are not seen.
 */
export function claudeHooksDisabledBy(files: readonly ClaudeSettingsFile[], fsImpl: Pick<BatMcpFs, 'readFileSync'> = fs): string | null {
  for (const { file, managed } of files) {
    let parsed: unknown
    try { parsed = JSON.parse(fsImpl.readFileSync(file, 'utf8')) } catch { continue }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) continue
    const settings = parsed as Record<string, unknown>
    if (managed && settings.allowManagedHooksOnly === true) return `allowManagedHooksOnly in ${file}`
    if (typeof settings.disableAllHooks === 'boolean') return settings.disableAllHooks ? `disableAllHooks in ${file}` : null
  }
  return null
}

/**
 * T0590: the shell command of one hook. claude runs it through bash (Git Bash on Windows) or, on
 * Windows without Git Bash, PowerShell; the same string must work in both. The node command is a
 * bare word (local `node`); the script path single-quoted (literal in bash and PowerShell), with
 * `/` on Windows (node takes `C:/…`; bash would eat backslashes). null = not representable in
 * both (a `'` in a path, a node command that needs quoting on Windows).
 */
export function batHookCommand(nodeCommand: string, script: string, event: string, platform: NodeJS.Platform = process.platform): string | null {
  const scriptPath = platform === 'win32' ? script.replace(/\\/g, '/') : script
  if (scriptPath.includes("'") || nodeCommand.includes("'")) return null
  let nodeWord: string
  if (/^[A-Za-z0-9_./:@+-]+$/.test(nodeCommand)) nodeWord = nodeCommand
  else if (platform === 'win32') return null // PowerShell needs `& '…'`, and `&` backgrounds in bash
  else nodeWord = `'${nodeCommand}'`
  return `${nodeWord} '${scriptPath}' ${event}`
}

/** T0590: the claude `--settings` file content: `hooks` only. null = a command is not representable. */
export function claudeHookSettingsContent(nodeCommand: string, script: string, platform: NodeJS.Platform = process.platform): string | null {
  const hooks: Record<string, Array<Record<string, unknown>>> = {}
  for (const hook of BAT_CLAUDE_HOOKS) {
    const command = batHookCommand(nodeCommand, script, hook.event, platform)
    if (!command) return null
    const entries = hooks[hook.hookEvent] ??= []
    entries.push({
      ...(hook.matcher ? { matcher: hook.matcher } : {}),
      hooks: [{ type: 'command', command, timeout: BAT_HOOK_TIMEOUT_SEC, ...(hook.async ? { async: true } : {}) }],
    })
  }
  return `${JSON.stringify({ hooks }, null, 2)}\n`
}

/** A TOML string: literal (`'…'`) unless the value holds `'` or a control character. */
export function tomlString(value: string): string {
  // eslint-disable-next-line no-control-regex
  if (!/['\u0000-\u001f\u007f]/.test(value)) return `'${value}'`
  // eslint-disable-next-line no-control-regex
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/[\u0000-\u001f\u007f]/g, ch => `\\u${ch.charCodeAt(0).toString(16).padStart(4, '0')}`)}"`
}

export interface BatMcpServerCommand {
  command: string
  args: string[]
}

/** The claude `--mcp-config` file content: the `bat` stdio server, command and args only. */
export function claudeMcpConfigContent(server: BatMcpServerCommand): string {
  return `${JSON.stringify({
    mcpServers: {
      [BAT_MCP_SERVER_NAME]: { type: 'stdio', command: server.command, args: server.args },
    },
  }, null, 2)}\n`
}

export interface BatMcpFs {
  readFileSync(file: string, encoding: 'utf8'): string
  writeFileSync(file: string, data: string, encoding: 'utf8'): void
  mkdirSync(dir: string, opts: { recursive: true }): unknown
  renameSync(from: string, to: string): void
  existsSync(file: string): boolean
}

/** Writes `<dataDir>/bat-mcp/claude.json` when its content differs (temp file + rename); returns the path. */
export function ensureClaudeMcpConfig(dataDir: string, server: BatMcpServerCommand, fsImpl: BatMcpFs = fs): string {
  return ensureBatMcpFile(dataDir, BAT_MCP_CLAUDE_CONFIG, claudeMcpConfigContent(server), fsImpl)
}

/** `<dataDir>/bat-mcp/<name>` = `content`, rewritten only when it differs (temp file + rename). */
export function ensureBatMcpFile(dataDir: string, name: string, content: string, fsImpl: BatMcpFs = fs): string {
  const dir = path.join(dataDir, BAT_MCP_CONFIG_DIR)
  const file = path.join(dir, name)
  let current: string | null = null
  try { current = fsImpl.readFileSync(file, 'utf8') } catch { /* missing */ }
  if (current === content) return file
  fsImpl.mkdirSync(dir, { recursive: true })
  const tmp = `${file}.${process.pid}.tmp`
  fsImpl.writeFileSync(tmp, content, 'utf8')
  fsImpl.renameSync(tmp, file)
  return file
}

export interface BatMcpHost {
  /** `<userData>` (Electron) / `<dataDir>` (headless): where `bat-mcp/claude.json` goes. */
  dataDir(): string
  /** Directory holding `bat-mcp.mjs` (Electron: resources/scripts; headless: `<installRoot>/scripts`). */
  helperDir(): string | undefined
  /** `node` (Electron) / the bundle's `<installRoot>/bin/node` when present (headless). */
  nodeCommand(): string
  /** RemoteServer listening, i.e. the tab's PTY gets `BAT_REMOTE_PORT` / `BAT_REMOTE_TOKEN`. */
  endpointReady(): boolean
  readSettings(): Record<string, unknown> | null
  /**
   * T0590: records the launch decision of terminal `terminalId` as its `blockedDetection`
   * (`PtyManager.setBlockedDetection`). Called only when the request names the terminal.
   */
  recordBlockedDetection?(terminalId: string, detection: 'hook' | 'none'): void
  /** T0600: the claude settings files that can turn hooks off. Absent ⇒ `defaultClaudeSettingsFiles()`. */
  claudeSettingsFiles?(): readonly ClaudeSettingsFile[]
  /**
   * T0641: whether the claude a claude-cli launch now runs knows `--name`
   * (`createClaudeNameSupportCheck`). Asked by `agent:bat-mcp-launch-args` only when a name could
   * go in. Absent ⇒ `version-unknown` (never injected).
   */
  claudeNameSupport?(): Promise<ClaudeNameSupport>
  /** T0641: records the session name decision of terminal `terminalId` (`claudeSessionNameRecords`). */
  recordClaudeSessionName?(terminalId: string, record: ClaudeSessionNameRecord): void
  /** The platform the hook commands run on (tests). Default `process.platform`. */
  platform?: NodeJS.Platform
  fs?: BatMcpFs
  logger?: { log(message: string): void; warn(message: string): void }
}

export interface BatMcpLaunchRequest {
  agentId: string
  shellFamily: ShellFamily
  /** The tab's effective custom args (appended by the caller after these). */
  extraArgs?: string
  /** T0590: the terminal being launched; its `blockedDetection` is recorded. */
  terminalId?: string
  /** T0641: the claude session name (`claudeSessionName`); cleaned again here. */
  sessionName?: string
  /** T0641: the `claudeNameSupport` check's result for this launch. Absent ⇒ `version-unknown`. */
  claudeNameSupport?: ClaudeNameSupport
}

/**
 * `injected` = some args (MCP and / or, claude only, the hooks and / or the session name). `mcp` /
 * `hooks` say which; `mcpReason` / `hooksReason` why a part is missing (`hooks` is always false for
 * codex). T0600: `hooksDisabled` = the hooks went in, but claude's own settings turn them off.
 * T0641 (claude only): `name` = the session name that went in, else `nameReason`.
 */
export type BatMcpLaunchResult =
  | { injected: true; kind: BatMcpAgentKind; args: string; mcp: boolean; hooks: boolean; mcpReason?: string; hooksReason?: string; hooksDisabled?: string; name?: string; nameReason?: ClaudeSessionNameReason }
  | { injected: false; reason: string; kind?: BatMcpAgentKind; hooksReason?: string; nameReason?: ClaudeSessionNameReason }

type ClaudeNameDecision = { name: string; reason?: undefined } | { name?: undefined; reason: ClaudeSessionNameReason }

/** T0641: the claude session name of `request`, or why none (C-3). */
function claudeNameDecision(request: BatMcpLaunchRequest): ClaudeNameDecision {
  if (userArgsSetClaudeName(request.extraArgs)) return { reason: 'user-args' }
  const name = normalizeClaudeSessionName(request.sessionName)
  if (!name) return { reason: 'no-name' }
  const support = request.claudeNameSupport
  if (!support) return { reason: 'version-unknown' }
  return support.inject ? { name } : { reason: support.reason }
}

/** T0641: a session name could go in (claude, a name, not set by the custom args): ask `claudeNameSupport`. */
export function needsClaudeNameSupport(request: Pick<BatMcpLaunchRequest, 'agentId' | 'extraArgs' | 'sessionName'>): boolean {
  return batMcpAgentKind(request.agentId) === 'claude'
    && !userArgsSetClaudeName(request.extraArgs)
    && normalizeClaudeSessionName(request.sessionName) !== null
}

/** T0590: the `blockedDetection` a launch decision gives the terminal. */
export function blockedDetectionOf(result: BatMcpLaunchResult): 'hook' | 'none' {
  return result.injected && result.hooks && !result.hooksDisabled ? 'hook' : 'none'
}

/**
 * The arguments to put right after the agent's base command (before the custom args), or why
 * none. Writes the claude config / settings files as a side effect.
 */
export function buildBatMcpLaunchArgs(host: BatMcpHost, request: BatMcpLaunchRequest): BatMcpLaunchResult {
  const kind = batMcpAgentKind(request.agentId)
  if (!kind) return { injected: false, reason: 'not a claude / codex tab' }
  const shell = request.shellFamily
  // T0641: the session name, independent of `batMcpEnabled` and the endpoint (D167)
  const nameDecision = kind === 'claude' ? claudeNameDecision(request) : null
  const nameArgs = nameDecision?.name ? quoteArgForShell(`--name=${nameDecision.name}`, shell) : null
  const nameFields = !nameDecision ? {} : nameDecision.name ? { name: nameDecision.name } : { nameReason: nameDecision.reason }
  if (!isBatMcpEnabled(host.readSettings())) {
    const off = 'turned off in Settings'
    return nameArgs
      ? { injected: true, kind, args: nameArgs, mcp: false, hooks: false, mcpReason: off, hooksReason: off, ...nameFields }
      : { injected: false, kind, reason: off, ...nameFields }
  }
  const helperDir = host.helperDir()
  const fsImpl = host.fs ?? fs
  const endpointReason = host.endpointReady() ? null : 'RemoteServer not listening (no helper endpoint in the tab)'

  let mcpArgs: string | null = null
  let mcpReason = userArgsAttachBatMcp(kind, request.extraArgs) ?? endpointReason
  const shim = helperDir ? path.join(helperDir, BAT_MCP_SHIM) : null
  if (!mcpReason && (!shim || !fsImpl.existsSync(shim))) mcpReason = `${BAT_MCP_SHIM} not found${helperDir ? ` in ${helperDir}` : ''}`
  if (!mcpReason && shim) {
    const server: BatMcpServerCommand = { command: host.nodeCommand(), args: [shim] }
    if (kind === 'claude') {
      try {
        mcpArgs = quoteArgForShell(`--mcp-config=${ensureClaudeMcpConfig(host.dataDir(), server, fsImpl)}`, shell)
      } catch (error) {
        mcpReason = `cannot write the MCP config: ${error instanceof Error ? error.message : String(error)}`
      }
    } else {
      mcpArgs = codexMcpOverrides(server).map(value => `-c ${quoteArgForShell(value, shell)}`).join(' ')
    }
  }

  // T0590: claude's `blocked` hooks
  let hooksArgs: string | null = null
  let hooksReason: string | null = null
  if (kind === 'claude') {
    hooksReason = userArgsPassClaudeSettings(request.extraArgs) ?? endpointReason
    const hookScript = helperDir ? path.join(helperDir, BAT_HOOK_SCRIPT) : null
    if (!hooksReason && (!hookScript || !fsImpl.existsSync(hookScript))) hooksReason = `${BAT_HOOK_SCRIPT} not found${helperDir ? ` in ${helperDir}` : ''}`
    if (!hooksReason && hookScript) {
      const content = claudeHookSettingsContent(host.nodeCommand(), hookScript, host.platform ?? process.platform)
      if (!content) {
        hooksReason = 'the hook command cannot be written for both bash and PowerShell (a quote in the path?)'
      } else {
        try {
          hooksArgs = quoteArgForShell(`--settings=${ensureBatMcpFile(host.dataDir(), BAT_MCP_CLAUDE_SETTINGS, content, fsImpl)}`, shell)
        } catch (error) {
          hooksReason = `cannot write the hook settings: ${error instanceof Error ? error.message : String(error)}`
        }
      }
    }
  }

  if (!mcpArgs && !hooksArgs && !nameArgs) {
    return { injected: false, kind, reason: mcpReason ?? 'nothing to inject', ...(hooksReason ? { hooksReason } : {}), ...nameFields }
  }
  // T0600: injected anyway (harmless; a report still proves the hooks run), recorded as `none`
  let hooksDisabled: string | null = null
  if (hooksArgs) {
    try {
      const files = host.claudeSettingsFiles ? host.claudeSettingsFiles() : defaultClaudeSettingsFiles(process.env, host.platform ?? process.platform)
      hooksDisabled = claudeHooksDisabledBy(files, fsImpl)
    } catch { /* not checked */ }
  }
  return {
    injected: true,
    kind,
    args: [mcpArgs, hooksArgs, nameArgs].filter(Boolean).join(' '),
    mcp: mcpArgs !== null,
    hooks: hooksArgs !== null,
    ...(mcpReason ? { mcpReason } : {}),
    ...(hooksReason ? { hooksReason } : {}),
    ...(hooksDisabled ? { hooksDisabled } : {}),
    ...nameFields,
  }
}

/** The codex `-c` values (unquoted) that define the `bat` stdio server. */
export function codexMcpOverrides(server: BatMcpServerCommand): string[] {
  const prefix = `mcp_servers.${BAT_MCP_SERVER_NAME}`
  return [
    `${prefix}.command=${tomlString(server.command)}`,
    `${prefix}.args=[${server.args.map(tomlString).join(', ')}]`,
    `${prefix}.env_vars=[${BAT_MCP_CODEX_ENV_VARS.map(tomlString).join(', ')}]`,
    `${prefix}.tool_timeout_sec=${BAT_MCP_CODEX_TOOL_TIMEOUT_SEC}`,
  ]
}

/** `base` + the MCP args (when injected), the custom args still to be appended by the caller. */
export function withBatMcpArgs(base: string, result: BatMcpLaunchResult): string {
  return result.injected ? `${base} ${result.args}` : base
}

function narrowShellFamily(value: unknown): ShellFamily {
  return value === 'pwsh' || value === 'cmd' ? value : 'posix'
}

/**
 * One log line per decision (claude / codex tabs only). Args are logged: they hold no secret.
 * T0590: claude lines say whether the hooks went in (`hooks=yes` / `hooks=no (<reason>)`);
 * T0600: `hooks=yes (turned off: <reason>)` when claude's own settings disable them.
 * T0641: + `name=yes` / `name=no (<reason>)` on claude lines.
 */
export function logBatMcpDecision(logger: BatMcpHost['logger'], source: string, agentId: string, result: BatMcpLaunchResult, terminalId?: string): void {
  if (!logger || (!result.injected && !result.kind)) return
  const tab = terminalId ? ` terminal=${terminalId}` : ''
  const hooks = result.kind === 'claude'
    ? `; hooks=${result.injected && result.hooks ? `yes${result.hooksDisabled ? ` (turned off: ${result.hooksDisabled})` : ''}` : `no (${result.hooksReason ?? (result.injected ? 'n/a' : result.reason)})`}`
      + `; name=${result.injected && result.name ? 'yes' : `no (${result.nameReason ?? 'n/a'})`}`
    : ''
  if (result.injected) {
    const mcp = result.mcp ? '' : `; mcp=no (${result.mcpReason ?? 'n/a'})`
    logger.log(`[bat-mcp] ${source} agent=${agentId}${tab} → injected: ${result.args}${mcp}${hooks}`)
  } else {
    logger.log(`[bat-mcp] ${source} agent=${agentId}${tab} → not injected (${result.reason})${hooks}`)
  }
}

/**
 * `buildBatMcpLaunchArgs` on `host`, logging each decision as `source` (`tab` / `dispatch`) and
 * (T0590) recording a named terminal's `blockedDetection`; T0641: and its session name decision
 * (`not-claude-cli` for codex / other agents).
 */
export function createBatMcpLaunchArgs(host: BatMcpHost, source: string): (request: BatMcpLaunchRequest) => BatMcpLaunchResult {
  return request => {
    const result = buildBatMcpLaunchArgs(host, request)
    logBatMcpDecision(host.logger, source, request.agentId, result, request.terminalId)
    if (request.terminalId && result.kind) {
      try {
        host.recordBlockedDetection?.(request.terminalId, blockedDetectionOf(result))
      } catch (error) {
        host.logger?.warn(`[bat-mcp] recording blockedDetection of ${request.terminalId} failed: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
    if (request.terminalId) {
      const name = result.injected && result.name ? result.name : null
      try {
        host.recordClaudeSessionName?.(request.terminalId, { name, ...(name ? {} : { reason: result.nameReason ?? 'not-claude-cli' }), at: Date.now() })
      } catch (error) {
        host.logger?.warn(`[bat-mcp] recording the session name of ${request.terminalId} failed: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
    return result
  }
}

/** T0641: `request` + `host.claudeNameSupport()` when a session name could go in. Never rejects. */
export async function withClaudeNameSupport(host: Pick<BatMcpHost, 'claudeNameSupport' | 'logger'>, request: BatMcpLaunchRequest): Promise<BatMcpLaunchRequest> {
  if (!host.claudeNameSupport || !needsClaudeNameSupport(request)) return request
  try {
    return { ...request, claudeNameSupport: await host.claudeNameSupport() }
  } catch (error) {
    host.logger?.warn(`[bat-mcp] claude version check failed: ${error instanceof Error ? error.message : String(error)}`)
    return request
  }
}

const TERMINAL_ID_ARG = /^[A-Za-z0-9._-]{1,128}$/

/**
 * `agent:bat-mcp-launch-args` — `(agentId, shellFamily, extraArgs?, terminalId?, sessionName?)` →
 * the args string ('' = none). Registered by Electron main and headless (a remote window asks the
 * server that runs the tab). T0590: `terminalId` (a renderer before T0590 sends none) gets the
 * decision as its `blockedDetection`. T0641: `sessionName` (a renderer before T0641 sends none →
 * `no-name`), checked against the claude this host would launch (`claudeNameSupport`).
 */
export function registerBatMcpHandlers(register: HandlerRegistrar, host: BatMcpHost): void {
  const launchArgs = createBatMcpLaunchArgs(host, 'tab')
  register(BAT_MCP_LAUNCH_ARGS_CHANNEL, async (_ctx, agentId: unknown, shellFamily: unknown, extraArgs: unknown, terminalId: unknown, sessionName: unknown) => {
    if (typeof agentId !== 'string') return ''
    const name = normalizeClaudeSessionName(sessionName)
    const result = launchArgs(await withClaudeNameSupport(host, {
      agentId,
      shellFamily: narrowShellFamily(shellFamily),
      extraArgs: typeof extraArgs === 'string' ? extraArgs : undefined,
      ...(typeof terminalId === 'string' && TERMINAL_ID_ARG.test(terminalId) ? { terminalId } : {}),
      ...(name ? { sessionName: name } : {}),
    }))
    return result.injected ? result.args : ''
  })
}
