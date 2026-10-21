/**
 * PLAN-044 / T0566 (D148): recognising an agent's usage-limit stop on a terminal tab's screen.
 *
 * Shared by Electron main / headless bat-server (`electron/usage-limit-continue.ts`, which reads
 * the PTY output) and the renderer (the re-check against the xterm buffer right before sending).
 * Pure: no `electron`, no DOM.
 *
 * Message sources (T0564 §1a / §1d / §2a, read from the CLI binaries, no live sample):
 *   - claude CLI 2.1.300: `You've hit your <session|weekly|Opus|Sonnet|Fable|usage> limit · resets 3pm (Asia/Taipei)`
 *     (`· progress saved` may follow), non-timed `monthly spend limit` / `team's shared budget` /
 *     `out of usage credits` / `org is out of usage` / `seat type …`; the CLI's own auto-continue
 *     (2.1.234+) prints `… continuing automatically at 3pm …`, `Automatic continue stopped|cancelled …`,
 *     `Usage limit available again · continuing now` / `Usage limit reset · continuing automatically`
 *     when it resumes, and after a sleep past the reset `Your usage limit has reset` + `Press enter to continue`.
 *   - codex-cli 0.160.0 / 0.162.1: `You've hit your usage limit[ for <model>]. … Try again at 3:05 PM.`
 *     (`try again later.` without a time), non-timed `Your workspace is out of credits` /
 *     `You hit your spend cap` / `Usage limit reached. You've reached your usage limit` /
 *     `You're out of credits.`
 *
 * Only a whole sentence at the start of a line counts (a TUI prefix such as `■ ` / `⎿ ` / `> ` is
 * allowed; a quote, backtick or any letter before it is not), and the bottom-most recognised line
 * of the screen wins — an agent quoting the sentence in the middle of a reply does not match.
 */

export type UsageLimitAgent = 'claude' | 'codex'

// ── Settings (D148 D3) ──

export const USAGE_LIMIT_DEFAULT_TEXT = '繼續'
export const USAGE_LIMIT_DEFAULT_DELAY_MINUTES = 2
export const USAGE_LIMIT_MAX_DELAY_MINUTES = 60
export const USAGE_LIMIT_MAX_TEXT_LENGTH = 200

export interface UsageLimitConfig {
  enabled: boolean
  text: string
  delayMinutes: number
}

/** The persisted settings fields (`AppSettings`, settings.json). */
export interface UsageLimitSettingsFields {
  usageLimitAutoContinue?: unknown
  usageLimitContinueText?: unknown
  usageLimitContinueDelayMinutes?: unknown
}

/** Control characters become spaces (the text is typed into an agent's composer, never a command). */
export function sanitizeUsageLimitText(raw: unknown): string {
  if (typeof raw !== 'string') return USAGE_LIMIT_DEFAULT_TEXT
  // eslint-disable-next-line no-control-regex
  const text = raw.replace(/[\x00-\x1f\x7f-\x9f]+/g, ' ').trim().slice(0, USAGE_LIMIT_MAX_TEXT_LENGTH).trim()
  return text || USAGE_LIMIT_DEFAULT_TEXT
}

export function clampUsageLimitDelayMinutes(raw: unknown): number {
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : NaN
  if (!Number.isFinite(n)) return USAGE_LIMIT_DEFAULT_DELAY_MINUTES
  return Math.min(USAGE_LIMIT_MAX_DELAY_MINUTES, Math.max(0, Math.round(n)))
}

/** Default off (D148 D3): only `usageLimitAutoContinue === true` turns it on. */
export function normalizeUsageLimitConfig(raw: UsageLimitSettingsFields | null | undefined): UsageLimitConfig {
  return {
    enabled: raw?.usageLimitAutoContinue === true,
    text: sanitizeUsageLimitText(raw?.usageLimitContinueText),
    delayMinutes: clampUsageLimitDelayMinutes(raw?.usageLimitContinueDelayMinutes),
  }
}

// ── Screen text ──

// eslint-disable-next-line no-control-regex
const INCOMPLETE_ESCAPE_TAIL = /\x1b(?:\[[0-?]*[ -/]*|\][^\x07\x1b]*\x1b?|[P^_X][^\x1b]*\x1b?|[()#%]?)$/
const CARRY_MAX = 4096

/**
 * Plain text from raw terminal output, keeping line structure: cursor moves to another line
 * (`CSI H / f / A / B / E / F / d / G`) and a lone CR become line breaks, a cursor-forward
 * (`CSI C`, which ConPTY uses for runs of spaces) becomes a space, every other sequence goes.
 * `carry` is the incomplete escape sequence at the end of the previous chunk; the result's
 * `carry` is the one at the end of this chunk.
 */
export function plainTextFromOutput(data: string, carry = ''): { text: string; carry: string } {
  let raw = carry + data
  let nextCarry = ''
  const tail = INCOMPLETE_ESCAPE_TAIL.exec(raw)
  if (tail && tail[0].length <= CARRY_MAX) {
    nextCarry = tail[0]
    raw = raw.slice(0, tail.index)
  }
  const text = raw
    // eslint-disable-next-line no-control-regex
    .replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, '')
    // eslint-disable-next-line no-control-regex
    .replace(/\x1b[P^_X][^\x1b]*\x1b\\/g, '')
    // eslint-disable-next-line no-control-regex
    .replace(/\x1b\[[0-?]*[ -/]*([@-~])/g, (_m, final: string) => ('HfABEFdG'.includes(final) ? '\n' : final === 'C' ? ' ' : ''))
    // eslint-disable-next-line no-control-regex
    .replace(/\x1b[()#%][0-9A-Za-z@]?/g, '')
    // eslint-disable-next-line no-control-regex
    .replace(/\x1b[@-Z\\-_=>78]?/g, '')
    .replace(/\r\n?/g, '\n')
    .replace(/\t/g, ' ')
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x08\x0b-\x1f\x7f]/g, '')
  return { text, carry: nextCarry }
}

/** How many non-empty screen lines (from the bottom) the classifier looks at. */
export const USAGE_LIMIT_SCREEN_LINES = 40

// ── Classification ──

/** Characters a TUI may put before a message (bullets, box drawing, prompt marks, spaces). */
const PREFIX = '^[^\\p{L}\\p{N}"\'`“”‘’]{0,8}?'
const APOS = `['’]`
const DOT = '[·•]'

/** The reset text after `resets` (strict: what `parseClaudeResetTime` reads, plus a zone). */
const CLAUDE_RESET_TEXT = '(?:[A-Za-z]{3,9}\\.? \\d{1,2},\\s*(?:\\d{4},\\s*)?)?\\d{1,2}(?::\\d{2})?\\s*[AaPp][Mm](?:\\s*\\([^)]+\\))?'
const CLAUDE_LIMIT_RE = new RegExp(
  `${PREFIX}You${APOS}ve (?:hit|reached) your (session limit|weekly limit|Opus limit|Sonnet limit|Fable limit|usage limit|limit)(?=\\s*(?:${DOT}|\\.|$))(?:\\s*${DOT}\\s*resets\\s+(${CLAUDE_RESET_TEXT}))?(?:\\s*${DOT}\\s*progress saved)?\\s*\\.?\\s*$`,
  'u',
)
const CLAUDE_BLOCKED_RE = new RegExp(
  `${PREFIX}(?:You${APOS}ve hit your (?:monthly spend limit|team${APOS}s shared budget)|You${APOS}re out of usage credits|Your org is out of usage|Your seat type doesn${APOS}t include usage credits)`,
  'u',
)
const CLAUDE_AUTO_RE = new RegExp(`${PREFIX}(?:Usage limit reached(?: again)?\\s*${DOT}\\s*)?continuing automatically(?: at (.+?))?(?:\\s*${DOT}.*)?$`, 'iu')
// `Usage limit reset · continuing automatically` (T0692): the notice when the armed auto continue fires at the reset.
const CLAUDE_RESUMED_RE = new RegExp(`${PREFIX}(?:Usage limit available again\\b|Continuing shortly\\b|Usage limit reset\\s*${DOT}\\s*continuing automatically\\b)`, 'u')
const CLAUDE_STOPPED_RE = new RegExp(`${PREFIX}Automatic continue (?:stopped|cancell?ed|canceled)\\b`, 'u')
const CLAUDE_STALE_HEAD_RE = new RegExp(`${PREFIX}Your usage limit has reset\\b`, 'u')
const CLAUDE_STALE_PRESS_RE = new RegExp(`${PREFIX}Press enter to continue\\b`, 'iu')

const CODEX_LIMIT_RE = new RegExp(`${PREFIX}You${APOS}ve hit your usage limit(?: for (.+?))?\\.(?:\\s|$)`, 'u')
const CODEX_BLOCKED_RE = new RegExp(
  `${PREFIX}(?:Your workspace is out of credits|You hit your spend cap|Usage limit reached\\. You${APOS}ve reached your usage limit|You${APOS}re out of credits\\.)`,
  'u',
)
const CODEX_TRY_AT_RE = /\btry again at (.+?)\.(?:\s|$)/i
/** A codex message wraps over this many screen lines at most (it carries URLs). */
const CODEX_JOIN_LINES = 8

export type ClaudeLimitKind = 'session' | 'weekly' | 'model' | 'usage'

export type UsageLimitScreen =
  | { kind: 'none' }
  | { kind: 'codex-limit'; line: number; resetsAt: number | null; resetText: string | null; model?: string }
  | { kind: 'codex-blocked'; line: number }
  | { kind: 'claude-limit'; line: number; limit: ClaudeLimitKind; resetsAt: number | null; resetText: string | null }
  | { kind: 'claude-blocked'; line: number }
  | { kind: 'claude-cli-auto'; line: number; at: string | null }
  | { kind: 'claude-cli-resumed'; line: number }
  | { kind: 'claude-cli-stopped'; line: number }
  | { kind: 'claude-stale'; line: number }

function claudeLimitKind(name: string): ClaudeLimitKind {
  if (name === 'session limit') return 'session'
  if (name === 'weekly limit') return 'weekly'
  if (name === 'usage limit' || name === 'limit') return 'usage'
  return 'model'
}

function normalizeSpaces(s: string): string {
  return s.replace(/[   ]/g, ' ')
}

/**
 * The bottom-most usage-limit related line of `lines` (screen lines, top to bottom; blank lines
 * are allowed and skipped). `line` is the index into `lines`. Times resolve against `now`.
 */
export function classifyUsageLimitScreen(lines: readonly string[], now: number): UsageLimitScreen {
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = normalizeSpaces(lines[i]).trimEnd()
    if (!line.trim()) continue

    if (CLAUDE_STALE_PRESS_RE.test(line)) {
      // `Press enter to continue` alone is too generic: it must follow `Your usage limit has reset`.
      for (let j = i - 1; j >= Math.max(0, i - 4); j--) {
        if (CLAUDE_STALE_HEAD_RE.test(normalizeSpaces(lines[j]))) return { kind: 'claude-stale', line: i }
      }
      continue
    }
    if (CLAUDE_STALE_HEAD_RE.test(line)) {
      // Both on one line counts; the head alone (no prompt below it yet) is not the stale phase.
      if (/press enter to continue/i.test(line)) return { kind: 'claude-stale', line: i }
      continue
    }
    if (CLAUDE_RESUMED_RE.test(line)) return { kind: 'claude-cli-resumed', line: i }
    const auto = CLAUDE_AUTO_RE.exec(line)
    if (auto) return { kind: 'claude-cli-auto', line: i, at: auto[1]?.trim() || null }
    if (CLAUDE_STOPPED_RE.test(line)) return { kind: 'claude-cli-stopped', line: i }

    if (CODEX_BLOCKED_RE.test(line)) return { kind: 'codex-blocked', line: i }
    if (CLAUDE_BLOCKED_RE.test(line)) return { kind: 'claude-blocked', line: i }

    const codex = CODEX_LIMIT_RE.exec(line)
    if (codex) {
      const joined = [line, ...lines.slice(i + 1, i + CODEX_JOIN_LINES).map(l => normalizeSpaces(l).trim())]
        .filter(Boolean).join(' ')
      const at = CODEX_TRY_AT_RE.exec(joined)
      const resetText = at ? at[1].trim() : null
      const resetsAt = resetText ? parseCodexResetTime(resetText, now) : null
      return { kind: 'codex-limit', line: i, resetsAt, resetText, ...(codex[1] ? { model: codex[1].trim() } : {}) }
    }

    const claude = CLAUDE_LIMIT_RE.exec(line)
    if (claude) {
      const resetText = claude[2]?.trim() || null
      return {
        kind: 'claude-limit',
        line: i,
        limit: claudeLimitKind(claude[1]),
        resetsAt: resetText ? parseClaudeResetTime(resetText, now) : null,
        resetText,
      }
    }
  }
  return { kind: 'none' }
}

// ── Decision (D148) ──

/** A reset further out than this is not a 5-hour session window: hint only (T0564 §3b). */
export const USAGE_LIMIT_SHORT_WINDOW_MS = (5 * 60 + 15) * 60_000
/** A parsed reset further out than this is treated as unparsable. */
export const USAGE_LIMIT_MAX_AHEAD_MS = 7 * 24 * 60 * 60_000
/** A parsed reset this far in the past still counts as "now" (minute resolution, clock skew). */
export const USAGE_LIMIT_PAST_GRACE_MS = 10 * 60_000

export type UsageLimitHint =
  /** claude: the CLI shows it will continue on its own. */
  | 'cli-auto'
  /** claude: the CLI's automatic continue was stopped or cancelled. */
  | 'cli-stopped'
  /** claude: a limit without the CLI's `continuing automatically` (API key, old CLI, setting off …). */
  | 'cli-unavailable'
  /** weekly, a model limit, or a reset more than 5 h 15 min out. */
  | 'weekly'
  /** codex `try again later` / no readable reset time. */
  | 'no-reset-time'
  /** spend cap, credits, seat, org budget: time does not lift it. */
  | 'non-timed'

export type UsageLimitDecision =
  | { action: 'none'; line?: number }
  | { action: 'send-text'; agent: 'codex'; line: number; resetsAt: number; resetText: string | null }
  | { action: 'send-enter'; agent: 'claude'; line: number }
  | { action: 'hint'; agent: UsageLimitAgent; line: number; hint: UsageLimitHint; resetsAt: number | null; resetText: string | null }

export function decideUsageLimit(screen: UsageLimitScreen, now: number): UsageLimitDecision {
  switch (screen.kind) {
    case 'none':
      return { action: 'none' }
    case 'claude-cli-resumed':
      return { action: 'none', line: screen.line }
    case 'codex-limit': {
      const base = { agent: 'codex' as const, line: screen.line, resetsAt: screen.resetsAt, resetText: screen.resetText }
      if (screen.resetsAt === null) return { action: 'hint', ...base, hint: 'no-reset-time' }
      if (screen.resetsAt - now > USAGE_LIMIT_SHORT_WINDOW_MS) return { action: 'hint', ...base, hint: 'weekly' }
      return { action: 'send-text', agent: 'codex', line: screen.line, resetsAt: screen.resetsAt, resetText: screen.resetText }
    }
    case 'codex-blocked':
      return { action: 'hint', agent: 'codex', line: screen.line, hint: 'non-timed', resetsAt: null, resetText: null }
    case 'claude-stale':
      return { action: 'send-enter', agent: 'claude', line: screen.line }
    case 'claude-cli-auto':
      return { action: 'hint', agent: 'claude', line: screen.line, hint: 'cli-auto', resetsAt: null, resetText: screen.at }
    case 'claude-cli-stopped':
      return { action: 'hint', agent: 'claude', line: screen.line, hint: 'cli-stopped', resetsAt: null, resetText: null }
    case 'claude-blocked':
      return { action: 'hint', agent: 'claude', line: screen.line, hint: 'non-timed', resetsAt: null, resetText: null }
    case 'claude-limit': {
      const weekly = screen.limit === 'weekly' || screen.limit === 'model'
        || (screen.resetsAt !== null && screen.resetsAt - now > USAGE_LIMIT_SHORT_WINDOW_MS)
      return {
        action: 'hint',
        agent: 'claude',
        line: screen.line,
        hint: weekly ? 'weekly' : 'cli-unavailable',
        resetsAt: screen.resetsAt,
        resetText: screen.resetText,
      }
    }
  }
}

// ── Reset time parsing ──

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

interface WallClock { year: number; month: number; day: number; hour: number; minute: number }

function monthIndex(name: string): number {
  return MONTHS.indexOf(name.slice(0, 3).toLowerCase())
}

function to24h(hour: number, ampm: string): number | null {
  if (hour < 1 || hour > 12) return null
  const pm = ampm.toLowerCase() === 'pm'
  return (hour % 12) + (pm ? 12 : 0)
}

/** Offset (ms) of time zone `tz` from UTC at instant `epoch`; null = unknown zone. */
function tzOffsetMs(epoch: number, tz: string): number | null {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric',
    }).formatToParts(new Date(epoch))
    const get = (type: string) => Number(parts.find(p => p.type === type)?.value)
    const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'), get('second'))
    return asUtc - Math.floor(epoch / 1000) * 1000
  } catch {
    return null
  }
}

/** Wall clock of `epoch` in `tz` (null = the local zone). */
function wallClockAt(epoch: number, tz: string | null): WallClock {
  if (tz) {
    const offset = tzOffsetMs(epoch, tz)
    if (offset !== null) {
      const d = new Date(epoch + offset)
      return { year: d.getUTCFullYear(), month: d.getUTCMonth(), day: d.getUTCDate(), hour: d.getUTCHours(), minute: d.getUTCMinutes() }
    }
  }
  const d = new Date(epoch)
  return { year: d.getFullYear(), month: d.getMonth(), day: d.getDate(), hour: d.getHours(), minute: d.getMinutes() }
}

/** Epoch of a wall clock in `tz` (null / unknown zone = the local zone). */
function epochOf(w: WallClock, tz: string | null): number {
  if (tz) {
    const guess = Date.UTC(w.year, w.month, w.day, w.hour, w.minute)
    const first = tzOffsetMs(guess, tz)
    if (first !== null) {
      let t = guess - first
      const second = tzOffsetMs(t, tz)
      if (second !== null && second !== first) t = guess - second
      return t
    }
  }
  return new Date(w.year, w.month, w.day, w.hour, w.minute).getTime()
}

/**
 * Resolves a reset wall clock against `now`: no date → the next such time (today, else
 * tomorrow); a date without a year → this year, else next year. Past by more than the grace
 * or more than 7 days ahead → null (not schedulable).
 */
function resolveReset(
  parts: { month?: number; day?: number; year?: number; hour: number; minute: number },
  tz: string | null,
  now: number,
): number | null {
  const today = wallClockAt(now, tz)
  let t: number
  if (parts.month === undefined || parts.day === undefined) {
    const w = { year: today.year, month: today.month, day: today.day, hour: parts.hour, minute: parts.minute }
    t = epochOf(w, tz)
    if (t < now - USAGE_LIMIT_PAST_GRACE_MS) {
      const next = new Date(Date.UTC(today.year, today.month, today.day + 1))
      t = epochOf({ year: next.getUTCFullYear(), month: next.getUTCMonth(), day: next.getUTCDate(), hour: parts.hour, minute: parts.minute }, tz)
    }
  } else {
    const year = parts.year ?? today.year
    t = epochOf({ year, month: parts.month, day: parts.day, hour: parts.hour, minute: parts.minute }, tz)
    if (parts.year === undefined && t < now - USAGE_LIMIT_PAST_GRACE_MS) {
      t = epochOf({ year: year + 1, month: parts.month, day: parts.day, hour: parts.hour, minute: parts.minute }, tz)
    }
  }
  if (!Number.isFinite(t)) return null
  if (t < now - USAGE_LIMIT_PAST_GRACE_MS) return null
  if (t - now > USAGE_LIMIT_MAX_AHEAD_MS) return null
  return t
}

const CLAUDE_TIME_RE = /^(?:([A-Za-z]{3,9})\.? (\d{1,2}),\s*(?:(\d{4}),\s*)?)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\s*(?:\(([^)]+)\))?\s*$/i

/**
 * claude: `3pm`, `3:30pm`, `Oct 20, 3pm`, `Oct 20, 2027, 3pm`, each optionally followed by
 * ` (<IANA zone>)` (unknown zone → local). en-US, 12-hour, minutes omitted on the hour.
 */
export function parseClaudeResetTime(text: string, now: number): number | null {
  const m = CLAUDE_TIME_RE.exec(normalizeSpaces(text).trim())
  if (!m) return null
  const hour = to24h(Number(m[4]), m[6])
  const minute = m[5] ? Number(m[5]) : 0
  if (hour === null || minute > 59) return null
  const tz = m[7]?.trim() || null
  if (m[1]) {
    const month = monthIndex(m[1])
    const day = Number(m[2])
    if (month < 0 || day < 1 || day > 31) return null
    return resolveReset({ month, day, year: m[3] ? Number(m[3]) : undefined, hour, minute }, tz, now)
  }
  return resolveReset({ hour, minute }, tz, now)
}

const CODEX_TIME_RE = /^(?:([A-Za-z]{3,9})\.? (\d{1,2})(?:st|nd|rd|th)?,?\s*(?:(\d{4})\s+)?)?(\d{1,2}):(\d{2})\s*([AP]M)\s*$/i

/** codex: `3:05 PM` (same day) or `Oct 17th, 2026 3:05 PM`; the local time zone, no zone shown. */
export function parseCodexResetTime(text: string, now: number): number | null {
  const m = CODEX_TIME_RE.exec(normalizeSpaces(text).trim())
  if (!m) return null
  const hour = to24h(Number(m[4]), m[6])
  const minute = Number(m[5])
  if (hour === null || minute > 59) return null
  if (m[1]) {
    const month = monthIndex(m[1])
    const day = Number(m[2])
    if (month < 0 || day < 1 || day > 31) return null
    return resolveReset({ month, day, year: m[3] ? Number(m[3]) : undefined, hour, minute }, null, now)
  }
  return resolveReset({ hour, minute }, null, now)
}

// ── Status shown on the tab (main → renderer) ──

export type UsageLimitStatusHint = UsageLimitHint | 'not-yolo' | 'cap'

export type UsageLimitStatus =
  | { state: 'scheduled'; agent: UsageLimitAgent; action: 'text' | 'enter'; dueAt: number; resetsAt: number | null; resetText: string | null }
  | { state: 'hint'; agent: UsageLimitAgent; hint: UsageLimitStatusHint; resetsAt: number | null; resetText: string | null }

/** `terminal:usage-limit-status` payload (status null = nothing to show). */
export interface UsageLimitStatusEvent {
  id: string
  status: UsageLimitStatus | null
}

/** `terminal:usage-limit-continue` payload: the window holding tab `id` re-checks and sends. */
export interface UsageLimitContinueEvent {
  id: string
  action: 'text' | 'enter'
  /** Typed before Enter when `action` is `text`. */
  text?: string
  agent: UsageLimitAgent
  traceId: string
}

/** Automatic sends in a row per tab before it falls back to a hint (claude's own `rearm_cap` is 2 too). */
export const USAGE_LIMIT_MAX_CONSECUTIVE_SENDS = 2

/** Pause between the typed text and the synthetic Enter (codex treats a fast burst as a paste). */
export const USAGE_LIMIT_ENTER_DELAY_MS = 300

/**
 * Renderer re-check right before sending: the screen must still lead to the same action
 * (codex limit with a near reset → text; claude stale → Enter). Returns null when it does, else
 * a short reason for the log.
 */
export function usageLimitRecheckFailure(lines: readonly string[], action: 'text' | 'enter', now: number): string | null {
  const decision = decideUsageLimit(classifyUsageLimitScreen(lines, now), now)
  const expected = action === 'text' ? 'send-text' : 'send-enter'
  if (decision.action === expected) return null
  return decision.action === 'hint' ? `screen shows hint ${decision.hint}` : `screen shows ${decision.action}`
}
