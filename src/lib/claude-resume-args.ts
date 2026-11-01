/**
 * PLAN-055 B1 / T0766: the `--resume` argument BAT adds when it resumes a claude-cli tab the
 * Terminal Server recovery interrupted (electron/interrupted-agents.ts).
 *
 *   - session id known (a UUID, `CLAUDE_SESSION_ID_PATTERN`) → `--resume=<id>` (`session`)
 *   - session id unknown (no hooks, an older claude) → `--resume` without a value: claude's own
 *     picker, filtered by the cwd (`picker`)
 *   - the custom args already resume / continue / pick a session (`--resume` / `-r` / `--continue` /
 *     `-c` / `--session-id` / `--from-pr` / `--teleport`, or a short-flag group holding `r` / `c`)
 *     → nothing added (`none`, reason `user-args`): theirs would decide anyway
 *
 * 🔴 Always the `=` form: `-r, --resume [value]` takes an optional value, so a bare `--resume <id>`
 * could take the next argument instead (same reason as `--mcp-config=`). Never `--fork-session`:
 * the resumed claude keeps the same session id (ListAgents, `claudeSessionId`, CT's closeout).
 * The session file is not checked: its directory name under `<config>/projects/` is overridable
 * (`CLAUDE_CODE_PROJECT_DIR_NAME`), cut at 200 characters + a hash, and compared case-insensitively
 * on Windows (claude 2.1.316, T0766) — claude itself reports `No conversation found with session ID`.
 *
 * Shared by Electron main (helper-dispatched Workers) and the renderer (tabs): no electron / DOM import.
 */

/** The claude session id grammar (same as electron/terminal-blocked-state.ts `CLAUDE_SESSION_ID_PATTERN`). */
export const CLAUDE_RESUME_SESSION_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type ClaudeResumeMode = 'session' | 'picker' | 'none'

export interface ClaudeResumeArgsDecision {
  mode: ClaudeResumeMode
  /** What goes after BAT's args, before the custom args; null for `none`. */
  arg: string | null
  /** Why `none`. */
  reason?: 'user-args'
}

/**
 * Whether the user's own claude args already choose the session: `--resume` / `--continue` /
 * `--session-id` / `--from-pr` / `--teleport` (with a value or `=`), `-r` / `-c`, or a short-flag
 * group holding `r` or `c` (`-cr`, `-rabc`).
 */
export function userArgsSetClaudeResume(extraArgs: string | undefined | null): boolean {
  return /(^|\s)(--(resume|continue|session-id|from-pr|teleport)(\s|=|$)|-[A-Za-z]*[rc])/.test(extraArgs ?? '')
}

/** The `--resume` argument for a session id (null = unknown) and the tab's custom args. */
export function claudeResumeArgs(sessionId: string | null | undefined, extraArgs: string | undefined | null): ClaudeResumeArgsDecision {
  if (userArgsSetClaudeResume(extraArgs)) return { mode: 'none', arg: null, reason: 'user-args' }
  if (sessionId && CLAUDE_RESUME_SESSION_ID_PATTERN.test(sessionId)) return { mode: 'session', arg: `--resume=${sessionId}` }
  return { mode: 'picker', arg: '--resume' }
}
