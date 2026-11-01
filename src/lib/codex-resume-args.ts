/**
 * PLAN-055 B2 / T0767 (D211 P-4 a): the `resume` subcommand BAT adds when it resumes a codex tab the
 * Terminal Server recovery interrupted (electron/interrupted-agents.ts). BAT has no codex session id,
 * so the resume is codex's own picker: `codex resume` without a session id lists the sessions
 * recorded for the current directory (codex filters by cwd unless `--all`), and the rebuilt shell
 * already sits in the tab's cwd.
 *
 *   - default → `resume` right after BAT's args (BAT MCP `-c mcp_servers.bat.*` / `--no-daemon` /
 *     the dispatch's `-c check_for_update_on_startup=false`), before the custom args (`picker`)
 *   - the custom args already run a `resume` / `fork` subcommand → nothing added (`none`, reason
 *     `user-args`): theirs decide (the registry places its daemon `-c` first for that case, T0377)
 *
 * 🔴 Never `--last` (two codex tabs in one cwd would both take the most recent session) and no
 * session id guessed from `~/.codex/sessions` (D211 P-4 c). No prompt (P-2).
 *
 * Checked with the embedded codex 0.166.0 (T0767): `codex resume --help` takes the same options as
 * `codex` itself plus `--last` / `--all` / `--include-non-interactive`, and options given before the
 * subcommand reach it — `codex -c sandbox_mode=bogus resume` fails on that config value, and
 * `codex --no-daemon resume --remote …` reports `--no-daemon cannot be used with --remote`.
 *
 * Shared by Electron main (helper-dispatched Workers, a codex typed into a shell) and the renderer
 * (codex-cli tabs): no electron / DOM import.
 */

/** The subcommand BAT adds (codex's resume picker). */
export const CODEX_RESUME_SUBCOMMAND = 'resume'

export interface CodexResumeArgsDecision {
  /** `picker` = codex's resume menu; `none` = the custom args already resume / fork. */
  mode: 'picker' | 'none'
  /** What goes after BAT's args, before the custom args; null for `none`. */
  arg: typeof CODEX_RESUME_SUBCOMMAND | null
  /** Why `none`. */
  reason?: 'user-args'
}

/** Whether the user's own codex args already run a `resume` / `fork` subcommand (a bare word). */
export function userArgsSetCodexResume(extraArgs: string | undefined | null): boolean {
  return /(^|\s)(resume|fork)(\s|$)/.test(extraArgs ?? '')
}

/** The `resume` argument for a codex tab with these custom args. */
export function codexResumeArgs(extraArgs: string | undefined | null): CodexResumeArgsDecision {
  if (userArgsSetCodexResume(extraArgs)) return { mode: 'none', arg: null, reason: 'user-args' }
  return { mode: 'picker', arg: CODEX_RESUME_SUBCOMMAND }
}

/**
 * The resume command of a codex tab: `launchWithBatArgs` (the launch command with BAT's args, as a
 * normal launch builds it), then `resume`, then the custom args.
 */
export function codexResumeCommand(launchWithBatArgs: string, extraArgs: string | undefined | null): { command: string; decision: CodexResumeArgsDecision } {
  const decision = codexResumeArgs(extraArgs)
  const parts = [launchWithBatArgs]
  if (decision.arg) parts.push(decision.arg)
  const custom = (extraArgs ?? '').trim()
  if (custom) parts.push(custom)
  return { command: parts.join(' '), decision }
}
