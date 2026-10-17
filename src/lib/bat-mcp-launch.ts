/**
 * PLAN-047 M1 / T0584: renderer side of the `bat` MCP injection. The host that runs the tab
 * (`agent:bat-mcp-launch-args`, proxied for a remote window, electron/bat-mcp-launch.ts) decides
 * and builds the args; they go right after the base command, before the custom args.
 * Only claude-cli / claude-cli-worktree / codex-cli ask. Any failure (a server older than T0584
 * has no handler) leaves the command as it was.
 */
import { detectShellFamily } from '../utils/shell-quote'

const BAT_MCP_AGENTS: ReadonlySet<string> = new Set(['claude-cli', 'claude-cli-worktree', 'codex-cli'])

/** `baseCommand` + the `bat` MCP args for `agentId` (or `baseCommand` unchanged). */
export async function withBatMcpLaunchArgs(
  baseCommand: string,
  agentId: string | undefined,
  shell: string | undefined,
  extraArgs: string | undefined,
): Promise<string> {
  if (!agentId || !BAT_MCP_AGENTS.has(agentId)) return baseCommand
  try {
    const args = await window.electronAPI.agent?.batMcpLaunchArgs?.(agentId, detectShellFamily(shell ?? ''), extraArgs)
    return typeof args === 'string' && args ? `${baseCommand} ${args}` : baseCommand
  } catch (err) {
    window.electronAPI?.debug?.log(`[bat-mcp] agent=${agentId}: launch args unavailable (${err instanceof Error ? err.message : String(err)})`)
    return baseCommand
  }
}
