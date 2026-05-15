/**
 * Resolves the shell command string used when dispatching the `claude-cli`
 * (or `claude-cli-worktree`) agent through `terminal:create-agent-command`
 * — i.e. the BAT remote / bat-terminal.mjs auto-session path that builds a
 * raw command for the spawned PTY.
 *
 * Renderer-side `claude-cli` launches go through `claude:get-cli-path` and
 * pick up `claudeRuntime.customPath` / `mode` / `fallbackToEmbedded` via the
 * existing resolver. The remote path used to hardcode the bare `'claude'`
 * string, which broke when `claude` is not on the BAT-spawned shell's PATH
 * (e.g. Windows installs to `~/.local/bin`, downstream 花見紅茶 BUG-005).
 *
 * Returns the quoted absolute path when the resolver succeeds, or the bare
 * `'claude'` string as a degraded fallback when the resolver throws — keeping
 * the previous behaviour for any caller running in a degraded environment.
 */
import { logger } from './logger'

export async function resolveClaudeBaseCommand(): Promise<string> {
  try {
    const { resolveClaudeRuntime, getRuntimeSettingsSnapshot } = await import('./claude-runtime-router')
    const resolved = await resolveClaudeRuntime(getRuntimeSettingsSnapshot())
    return resolved.path ? `"${resolved.path}"` : 'claude'
  } catch (err) {
    logger.warn('[agent-command] claude-cli runtime resolution failed, falling back to bare claude:', err)
    return 'claude'
  }
}
