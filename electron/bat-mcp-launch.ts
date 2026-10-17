/**
 * PLAN-047 M1 / T0584: the launch arguments that attach the `bat` MCP server (scripts/bat-mcp.mjs,
 * a stdio shim to this host's RemoteServer) to a claude / codex tab BAT starts.
 *
 *   - claude: `--mcp-config=<file>`, the file written here under `<dataDir>/bat-mcp/claude.json`
 *     (command / args only — no token, no env value: the shim inherits `BAT_REMOTE_PORT` /
 *     `BAT_REMOTE_TOKEN` from the PTY). `=` form because `--mcp-config <configs...>` is variadic
 *     and would swallow the prompt that follows. Never `--strict-mcp-config`.
 *   - codex: `-c mcp_servers.bat.command=… -c mcp_servers.bat.args=[…] -c
 *     mcp_servers.bat.tool_timeout_sec=60` (TOML literal strings, shell-quoted per family).
 *
 * One implementation for every launch path: the renderer (`agent:bat-mcp-launch-args`, proxied,
 * so a remote window gets the server's paths) and `terminal:create-agent-command`
 * (`createAgentPromptCommandBuilder`). Raw command mode is never touched.
 *
 * 🔴 No `electron` import: headless registers the same handler.
 */
import * as fs from 'fs'
import * as path from 'path'
import { quoteArgForShell, type ShellFamily } from '../src/utils/shell-quote'
import type { HandlerRegistrar } from './handlers/types'

export const BAT_MCP_SERVER_NAME = 'bat'
export const BAT_MCP_SHIM = 'bat-mcp.mjs'
export const BAT_MCP_CONFIG_DIR = 'bat-mcp'
export const BAT_MCP_CLAUDE_CONFIG = 'claude.json'
/** Codex's default `tool_timeout_sec` is 60 s; the shim waits up to 55 s for `bat_wait`. */
export const BAT_MCP_CODEX_TOOL_TIMEOUT_SEC = 60
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
  const dir = path.join(dataDir, BAT_MCP_CONFIG_DIR)
  const file = path.join(dir, BAT_MCP_CLAUDE_CONFIG)
  const content = claudeMcpConfigContent(server)
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
  fs?: BatMcpFs
  logger?: { log(message: string): void; warn(message: string): void }
}

export interface BatMcpLaunchRequest {
  agentId: string
  shellFamily: ShellFamily
  /** The tab's effective custom args (appended by the caller after these). */
  extraArgs?: string
}

export type BatMcpLaunchResult =
  | { injected: true; kind: BatMcpAgentKind; args: string }
  | { injected: false; reason: string; kind?: BatMcpAgentKind }

/**
 * The arguments to put right after the agent's base command (before the custom args), or why
 * none. Writes the claude config file as a side effect.
 */
export function buildBatMcpLaunchArgs(host: BatMcpHost, request: BatMcpLaunchRequest): BatMcpLaunchResult {
  const kind = batMcpAgentKind(request.agentId)
  if (!kind) return { injected: false, reason: 'not a claude / codex tab' }
  if (!isBatMcpEnabled(host.readSettings())) return { injected: false, kind, reason: 'turned off in Settings' }
  const userReason = userArgsAttachBatMcp(kind, request.extraArgs)
  if (userReason) return { injected: false, kind, reason: userReason }
  if (!host.endpointReady()) return { injected: false, kind, reason: 'RemoteServer not listening (no helper endpoint in the tab)' }
  const helperDir = host.helperDir()
  const fsImpl = host.fs ?? fs
  const shim = helperDir ? path.join(helperDir, BAT_MCP_SHIM) : null
  if (!shim || !fsImpl.existsSync(shim)) return { injected: false, kind, reason: `${BAT_MCP_SHIM} not found${helperDir ? ` in ${helperDir}` : ''}` }
  const server: BatMcpServerCommand = { command: host.nodeCommand(), args: [shim] }
  const shell = request.shellFamily

  if (kind === 'claude') {
    let configPath: string
    try {
      configPath = ensureClaudeMcpConfig(host.dataDir(), server, fsImpl)
    } catch (error) {
      return { injected: false, kind, reason: `cannot write the MCP config: ${error instanceof Error ? error.message : String(error)}` }
    }
    return { injected: true, kind, args: quoteArgForShell(`--mcp-config=${configPath}`, shell) }
  }

  const prefix = `mcp_servers.${BAT_MCP_SERVER_NAME}`
  const overrides = [
    `${prefix}.command=${tomlString(server.command)}`,
    `${prefix}.args=[${server.args.map(tomlString).join(', ')}]`,
    `${prefix}.tool_timeout_sec=${BAT_MCP_CODEX_TOOL_TIMEOUT_SEC}`,
  ]
  return { injected: true, kind, args: overrides.map(value => `-c ${quoteArgForShell(value, shell)}`).join(' ') }
}

/** `base` + the MCP args (when injected), the custom args still to be appended by the caller. */
export function withBatMcpArgs(base: string, result: BatMcpLaunchResult): string {
  return result.injected ? `${base} ${result.args}` : base
}

function narrowShellFamily(value: unknown): ShellFamily {
  return value === 'pwsh' || value === 'cmd' ? value : 'posix'
}

/** One log line per decision (claude / codex tabs only). Args are logged: they hold no secret. */
export function logBatMcpDecision(logger: BatMcpHost['logger'], source: string, agentId: string, result: BatMcpLaunchResult): void {
  if (!logger || (!result.injected && !result.kind)) return
  if (result.injected) logger.log(`[bat-mcp] ${source} agent=${agentId} → injected: ${result.args}`)
  else logger.log(`[bat-mcp] ${source} agent=${agentId} → not injected (${result.reason})`)
}

/** `buildBatMcpLaunchArgs` on `host`, logging each decision as `source` (`tab` / `dispatch`). */
export function createBatMcpLaunchArgs(host: BatMcpHost, source: string): (request: BatMcpLaunchRequest) => BatMcpLaunchResult {
  return request => {
    const result = buildBatMcpLaunchArgs(host, request)
    logBatMcpDecision(host.logger, source, request.agentId, result)
    return result
  }
}

/**
 * `agent:bat-mcp-launch-args` — `(agentId, shellFamily, extraArgs?)` → the args string ('' = none).
 * Registered by Electron main and headless (a remote window asks the server that runs the tab).
 */
export function registerBatMcpHandlers(register: HandlerRegistrar, host: BatMcpHost): void {
  const launchArgs = createBatMcpLaunchArgs(host, 'tab')
  register(BAT_MCP_LAUNCH_ARGS_CHANNEL, (_ctx, agentId: unknown, shellFamily: unknown, extraArgs: unknown) => {
    if (typeof agentId !== 'string') return ''
    const result = launchArgs({
      agentId,
      shellFamily: narrowShellFamily(shellFamily),
      extraArgs: typeof extraArgs === 'string' ? extraArgs : undefined,
    })
    return result.injected ? result.args : ''
  })
}
