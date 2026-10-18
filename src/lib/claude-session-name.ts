/**
 * PLAN-050 / T0641 (D167, T0640 contract C-1): the session name BAT gives a claude-cli tab with
 * `claude --name=<name>` — what claude's ListAgents shows, so a Control Tower in another session can
 * tell BAT's Towers and Workers apart.
 *
 *   - Worker (helper dispatch with a work order): `<ws> · Worker · <T####>`
 *   - Tower (T0644 "open as Tower"): `<ws> · Tower`
 *   - any other claude-cli tab: `<ws> · <short id>` (the terminal id without `-`, first 6
 *     characters, lower case)
 *
 * `<ws>` = the workspace's `alias ?? name`, cleaned: C0 / C1 control characters removed, runs of
 * white space collapsed to one space, trimmed, leading `/` removed (claude addresses `/…` names
 * differently), at most 60 characters. The whole name is at most 200 characters (claude's limit);
 * a longer one is cut in `<ws>`, so the role and `T####` at the end always stay. An empty `<ws>`
 * becomes `BAT`. A `"` becomes `'` (cmd has no escape for `"` inside a quoted argument: the name
 * goes on the command line, `quoteArgForShell`).
 *
 * The name is the value BAT launched the tab with, not a live one: a later `/rename` in claude is
 * not seen (T0640 risk 3). Not the tab title (T0553 / T0562): that one the user can change.
 *
 * 🔴 Shared by Electron main, headless and the renderer: no `electron` / DOM import.
 */

export const CLAUDE_SESSION_NAME_MAX = 200
export const CLAUDE_SESSION_NAME_WORKSPACE_MAX = 60
export const CLAUDE_SESSION_NAME_SEPARATOR = ' · '
/** `<ws>` when the workspace name is unknown or cleans to nothing. */
export const CLAUDE_SESSION_NAME_FALLBACK_WORKSPACE = 'BAT'
export const CLAUDE_SESSION_SHORT_ID_LENGTH = 6

// Same grammar as src/types/control-tower.ts WORKORDER_ID_PATTERN (that module pulls js-yaml into
// whoever imports it; parity is asserted in src/lib/__tests__/claude-session-name.test.ts).
const WORKORDER_ID_PATTERN = /^(?:[A-Z]{2,4}-)?T\d+$/

// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001f\u007f-\u009f]/g

export type ClaudeSessionNameInput =
  | { role: 'worker'; workspaceName?: string | null; workorder: string }
  | { role: 'tower'; workspaceName?: string | null }
  | { role: 'tab'; workspaceName?: string | null; terminalId: string }

/** `value` cut to at most `max` UTF-16 units, never inside a surrogate pair. */
function cutToLength(value: string, max: number): string {
  let out = ''
  for (const ch of value) {
    if (out.length + ch.length > max) break
    out += ch
  }
  return out
}

function cleanText(value: string): string {
  return value.replace(CONTROL_CHARS, '').replace(/"/g, "'").replace(/\s+/g, ' ').trim().replace(/^\/+/, '').trim()
}

/** The `<ws>` part: cleaned, at most 60 characters; '' when nothing is left. */
export function cleanSessionWorkspaceName(name: string | null | undefined): string {
  const cleaned = cleanText(typeof name === 'string' ? name : '')
  return Array.from(cleaned).slice(0, CLAUDE_SESSION_NAME_WORKSPACE_MAX).join('').trimEnd()
}

/** The terminal id's short form: without `-`, first 6 characters, lower case; '' when none. */
export function claudeSessionShortId(terminalId: string): string {
  return terminalId.replace(/-/g, '').slice(0, CLAUDE_SESSION_SHORT_ID_LENGTH).toLowerCase()
}

/** The name for `input`, or null (a worker without a valid work order id, a tab without an id). */
export function claudeSessionName(input: ClaudeSessionNameInput): string | null {
  let suffix: string
  if (input.role === 'worker') {
    const workorder = typeof input.workorder === 'string' ? input.workorder.trim() : ''
    if (!WORKORDER_ID_PATTERN.test(workorder)) return null
    suffix = `${CLAUDE_SESSION_NAME_SEPARATOR}Worker${CLAUDE_SESSION_NAME_SEPARATOR}${workorder}`
  } else if (input.role === 'tower') {
    suffix = `${CLAUDE_SESSION_NAME_SEPARATOR}Tower`
  } else {
    const shortId = cleanText(claudeSessionShortId(typeof input.terminalId === 'string' ? input.terminalId : ''))
    if (!shortId) return null
    suffix = `${CLAUDE_SESSION_NAME_SEPARATOR}${shortId}`
  }
  const budget = CLAUDE_SESSION_NAME_MAX - suffix.length
  if (budget < 1) return null
  const workspace = cutToLength(cleanSessionWorkspaceName(input.workspaceName) || CLAUDE_SESSION_NAME_FALLBACK_WORKSPACE, budget).trimEnd()
  return `${workspace || cutToLength(CLAUDE_SESSION_NAME_FALLBACK_WORKSPACE, budget)}${suffix}`
}

/**
 * A name that came over IPC (the renderer computed it with `claudeSessionName`), made safe to put
 * on the command line again: the same cleaning, at most 200 characters. null = nothing left / not
 * a string.
 */
export function normalizeClaudeSessionName(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const name = cutToLength(cleanText(value), CLAUDE_SESSION_NAME_MAX).trimEnd()
  return name || null
}
