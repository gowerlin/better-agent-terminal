/**
 * PLAN-044 / T0566 (D148): usage-limit recognition (src/lib/usage-limit.ts).
 *
 * Sentences are the CLI strings T0564 read from claude 2.1.300 / codex 0.160.0–0.162.1 (no live
 * sample): positive and negative samples for each, quoting in a reply, the CLI's own auto
 * continue lines, the stale phase; reset times (12 h, minutes, next day, next year, IANA zone,
 * local zone, expired, more than 7 days out); the decision table; settings normalisation; ANSI
 * stripping.
 */
import { afterAll, describe, expect, it } from 'vitest'
import {
  classifyUsageLimitScreen,
  clampUsageLimitDelayMinutes,
  decideUsageLimit,
  normalizeUsageLimitConfig,
  parseClaudeResetTime,
  parseCodexResetTime,
  plainTextFromOutput,
  sanitizeUsageLimitText,
  usageLimitRecheckFailure,
  USAGE_LIMIT_DEFAULT_TEXT,
} from '../usage-limit'

// T0684: NOW and local() are local wall clocks, and the claude cases read `4pm (Asia/Taipei)` as
// one hour after NOW; so this file runs in Asia/Taipei whatever the host zone (CI runs in UTC).
// The product reads the zone in the sentence (`3pm (UTC)` / `(America/New_York)` cases below).
const ORIGINAL_TZ = process.env.TZ
process.env.TZ = 'Asia/Taipei'
afterAll(() => {
  if (ORIGINAL_TZ === undefined) delete process.env.TZ
  else process.env.TZ = ORIGINAL_TZ
})

/** 2026-10-16 15:00 local time. */
const NOW = new Date(2026, 9, 16, 15, 0, 0).getTime()
const local = (month: number, day: number, hour: number, minute = 0, year = 2026) => new Date(year, month, day, hour, minute).getTime()
const classify = (lines: string[], now = NOW) => classifyUsageLimitScreen(lines, now)
const decide = (lines: string[], now = NOW) => decideUsageLimit(classify(lines, now), now)

const CLAUDE_PROMPT = ['╭──────────────────────────────╮', '│ >                            │', '╰──────────────────────────────╯', '  ? for shortcuts']
const CODEX_PROMPT = ['› Ask Codex to do anything', '', '  ⏎ send   ⇧⏎ newline   ⌃T transcript   ⌃C quit', '  100% context left']

describe('claude limit sentences', () => {
  it.each([
    ['session limit', 'session'],
    ['weekly limit', 'weekly'],
    ['Opus limit', 'model'],
    ['Sonnet limit', 'model'],
    ['Fable limit', 'model'],
    ['usage limit', 'usage'],
    ['limit', 'usage'],
  ])('You’ve hit your %s · resets 4pm (Asia/Taipei) → %s', (name, limit) => {
    const screen = classify(['⏺ Working on it', `  ⎿  You've hit your ${name} · resets 4pm (Asia/Taipei)`, ...CLAUDE_PROMPT])
    expect(screen).toMatchObject({ kind: 'claude-limit', limit, resetText: '4pm (Asia/Taipei)' })
    expect((screen as { resetsAt: number }).resetsAt).toBe(Date.UTC(2026, 9, 16, 8, 0))
  })

  it('with · progress saved, a curly apostrophe, and the Fable "reached" form', () => {
    expect(classify(['You’ve hit your session limit · resets 3:30pm (Asia/Taipei) · progress saved'])).toMatchObject({ kind: 'claude-limit', limit: 'session', resetText: '3:30pm (Asia/Taipei)' })
    expect(classify(["You've reached your Fable limit."])).toMatchObject({ kind: 'claude-limit', limit: 'model', resetsAt: null })
  })

  it.each([
    "You've hit your monthly spend limit · raise it at claude.ai/settings",
    "You've hit your team's shared budget",
    "You're out of usage credits · buy more at claude.ai",
    'Your org is out of usage · contact your admin',
    "Your seat type doesn't include usage credits",
  ])('non-timed: %s', (line) => {
    expect(classify([line])).toMatchObject({ kind: 'claude-blocked' })
    expect(decide([line])).toMatchObject({ action: 'hint', agent: 'claude', hint: 'non-timed' })
  })

  it.each([
    "You've used 90% of your session limit · resets 3pm (Asia/Taipei)",
    'Approaching weekly limit',
    "You're now using usage credits · Your session limit resets 3pm (Asia/Taipei)",
    "You've hit your fast limit · resets in 4m",
  ])('warnings and the fast limit are not a stop: %s', (line) => {
    expect(classify([line])).toEqual({ kind: 'none' })
  })

  it('a reply quoting the sentence (mid-line, in quotes or backticks) does not match', () => {
    expect(classify(["The CLI prints You've hit your session limit · resets 3pm when you run out."])).toEqual({ kind: 'none' })
    expect(classify(['"You\'ve hit your session limit · resets 3pm (Asia/Taipei)" is the message'])).toEqual({ kind: 'none' })
    expect(classify(["`You've hit your session limit · resets 3pm (Asia/Taipei)`"])).toEqual({ kind: 'none' })
    expect(classify(["  - You've hit your session limit · resets 3pm (Asia/Taipei) — that line means the 5 h window is used up"])).toEqual({ kind: 'none' })
  })
})

describe('claude CLI auto continue (2.1.234+) and the stale phase', () => {
  const limit = "  ⎿  You've hit your session limit · resets 4pm (Asia/Taipei)"

  it.each([
    'Usage limit reached · continuing automatically at 4pm · esc to cancel',
    'Continuing automatically at 4pm · esc to cancel',
    'Usage limit reached again · continuing automatically at 4pm · esc to cancel',
  ])('"%s" below the limit → hint cli-auto', (status) => {
    expect(decide([limit, status, ...CLAUDE_PROMPT])).toMatchObject({ action: 'hint', agent: 'claude', hint: 'cli-auto', resetText: '4pm' })
  })

  it('Automatic continue stopped / cancelled → hint cli-stopped', () => {
    expect(decide([limit, 'Automatic continue stopped · the usage limit now resets more than 24 hours out, so this task will not resume on its own (/rate-limit-options to wait anyway)'])).toMatchObject({ hint: 'cli-stopped' })
    expect(decide([limit, 'Automatic continue cancelled · /rate-limit-options to re-arm'])).toMatchObject({ hint: 'cli-stopped' })
  })

  it('Usage limit available again · continuing now → nothing to show', () => {
    expect(decide([limit, 'Usage limit available again · continuing now'])).toMatchObject({ action: 'none' })
  })

  // T0692: CLI 2.1.306 (already in 2.1.300) appends this notice when the armed auto continue fires
  // at the reset (its desktop notification: "Usage limit reset — Claude is continuing your task"),
  // the same moment as `Usage limit available again · continuing now`. Unrecognised, the scan went
  // up to the earlier `Usage limit reached · continuing automatically at …` notice and kept cli-auto.
  it('Usage limit reset · continuing automatically (the CLI resumed at the reset) → nothing to show', () => {
    const resumed = 'Usage limit reset · continuing automatically'
    expect(classify([resumed])).toEqual({ kind: 'claude-cli-resumed', line: 0 })
    expect(classify([`  ⎿  ${resumed}`])).toMatchObject({ kind: 'claude-cli-resumed' })
    const screen = [limit, 'Usage limit reached · continuing automatically at 4pm · esc to cancel', resumed, '⏺ Picking up where I left off', ...CLAUDE_PROMPT]
    expect(classify(screen)).toEqual({ kind: 'claude-cli-resumed', line: 2 })
    expect(decide(screen)).toEqual({ action: 'none', line: 2 })
    // a newer limit below it still wins
    expect(decide([resumed, 'Usage limit reached again · continuing automatically at 4pm · esc to cancel'])).toMatchObject({ hint: 'cli-auto' })
    // quoted in a reply
    expect(classify([`The CLI prints ${resumed} when it resumes.`])).toEqual({ kind: 'none' })
    expect(classify([`"${resumed}"`])).toEqual({ kind: 'none' })
  })

  it.each([
    // other 2.1.306 strings near it (T0690): reset grants, the workflow wait, the warning
    'Session limit reset',
    'Limits reset',
    'Weekly limits reset',
    'Usage limit reset. Re-running 2 waiting agents.',
    'Approaching your 5-hour usage limit · resets 4pm (Asia/Taipei)',
  ])('not a resume or a limit: %s', (line) => {
    expect(classify([line])).toEqual({ kind: 'none' })
  })

  it('the limit without the CLI line (API key, old CLI, setting off) → hint cli-unavailable; weekly / model → weekly', () => {
    expect(decide([limit, ...CLAUDE_PROMPT])).toMatchObject({ action: 'hint', hint: 'cli-unavailable', resetText: '4pm (Asia/Taipei)' })
    expect(decide(["You've hit your weekly limit · resets Oct 20, 3pm (Asia/Taipei)"])).toMatchObject({ action: 'hint', hint: 'weekly' })
    expect(decide(["You've hit your Opus limit · resets 4pm (Asia/Taipei)"])).toMatchObject({ action: 'hint', hint: 'weekly' })
    // a "session" reset further than 5 h 15 min out is not a 5-hour window
    expect(decide(["You've hit your usage limit · resets 11pm (Asia/Taipei)"])).toMatchObject({ action: 'hint', hint: 'weekly' })
  })

  it('stale: "Your usage limit has reset" + "Press enter to continue" → send Enter only', () => {
    expect(decide([limit, 'Your usage limit has reset', 'Press enter to continue', ...CLAUDE_PROMPT])).toMatchObject({ action: 'send-enter', agent: 'claude' })
    expect(decide(['Your usage limit has reset · Press enter to continue'])).toMatchObject({ action: 'send-enter' })
    // either line alone is not the stale phase
    expect(decide(['Press enter to continue'])).toMatchObject({ action: 'none' })
    expect(decide([limit, 'Your usage limit has reset'])).toMatchObject({ action: 'hint', hint: 'cli-unavailable' })
  })

  it('the bottom-most recognised line wins', () => {
    expect(decide(['Usage limit reached · continuing automatically at 4pm · esc to cancel', 'Automatic continue cancelled · /rate-limit-options to re-arm'])).toMatchObject({ hint: 'cli-stopped' })
    expect(decide(['Automatic continue cancelled · /rate-limit-options to re-arm', 'Usage limit reached again · continuing automatically at 4pm · esc to cancel'])).toMatchObject({ hint: 'cli-auto' })
  })
})

describe('codex limit sentences', () => {
  it.each([
    'Upgrade to Plus to continue using Codex (https://chatgpt.com/explore/plus), or try again at 3:30 PM.',
    'Upgrade to Pro (https://chatgpt.com/explore/pro), visit https://chatgpt.com/settings/usage to purchase more credits or try again at 3:30 PM.',
    'Visit https://chatgpt.com/settings/usage to purchase more credits or try again at 3:30 PM.',
    'To get more access now, send a request to your admin or try again at 3:30 PM.',
  ])('plan sentence %# → send text at the reset', (tail) => {
    const lines = ['• Done with step 1.', '', `■ You've hit your usage limit. ${tail}`, '', ...CODEX_PROMPT]
    expect(decide(lines)).toEqual({ action: 'send-text', agent: 'codex', line: 2, resetsAt: local(9, 16, 15, 30), resetText: '3:30 PM' })
  })

  it('a message wrapped over several screen lines', () => {
    const lines = [
      "■ You've hit your usage limit. Upgrade to Plus to continue using Codex",
      '(https://chatgpt.com/explore/plus), or try again at',
      '3:30 PM.',
      ...CODEX_PROMPT,
    ]
    expect(decide(lines)).toMatchObject({ action: 'send-text', resetsAt: local(9, 16, 15, 30) })
  })

  it('Try again at (capital) and the dated form', () => {
    expect(decide(["You've hit your usage limit. Try again at 3:05 PM."])).toMatchObject({ action: 'send-text', resetsAt: local(9, 16, 15, 5) })
    expect(decide(["You've hit your usage limit. Try again at Oct 16th, 2026 7:05 PM."])).toMatchObject({ action: 'send-text', resetsAt: local(9, 16, 19, 5) })
  })

  it('a model limit is still time based', () => {
    const screen = classify(["You've hit your usage limit for gpt-5.5-codex. Switch to another model now, or try again at 4:00 PM."])
    expect(screen).toMatchObject({ kind: 'codex-limit', model: 'gpt-5.5-codex', resetsAt: local(9, 16, 16, 0) })
  })

  it('try again later → hint no-reset-time; a weekly-length reset → hint weekly', () => {
    expect(decide(["You've hit your usage limit. Upgrade to Plus to continue using Codex (https://chatgpt.com/explore/plus), or try again later."])).toMatchObject({ action: 'hint', agent: 'codex', hint: 'no-reset-time' })
    expect(decide(["You've hit your usage limit. Try again at Oct 20th, 2026 9:00 AM."])).toMatchObject({ action: 'hint', hint: 'weekly', resetsAt: local(9, 20, 9, 0) })
    // 5 h 15 min is the line: 20:15 still a session window, 20:16 not
    expect(decide(["You've hit your usage limit. Try again at 8:15 PM."])).toMatchObject({ action: 'send-text' })
    expect(decide(["You've hit your usage limit. Try again at 8:16 PM."])).toMatchObject({ action: 'hint', hint: 'weekly' })
  })

  it.each([
    'Your workspace is out of credits. Ask your admin to add more.',
    'You hit your spend cap. Raise it in settings.',
    "Usage limit reached. You've reached your usage limit. Increase your limits to continue using codex.",
    "You're out of credits.",
  ])('non-timed: %s', (line) => {
    expect(decide([line])).toMatchObject({ action: 'hint', agent: 'codex', hint: 'non-timed' })
  })

  it('quoted in a reply, mid-line → none', () => {
    expect(decide(["• Codex answers You've hit your usage limit. Try again at 3:05 PM. when the plan is used up"])).toMatchObject({ action: 'none' })
    expect(decide(["  \"You've hit your usage limit. Try again at 3:05 PM.\""])).toMatchObject({ action: 'none' })
  })
})

describe('reset times', () => {
  it('claude: on the hour, with minutes, next day, a date, next year, an explicit year (IANA zone)', () => {
    const tz = 'Asia/Taipei' // UTC+8, no DST
    const now = Date.UTC(2026, 9, 16, 7, 0) // 15:00 Taipei
    expect(parseClaudeResetTime(`3pm (${tz})`, now)).toBe(Date.UTC(2026, 9, 16, 7, 0))
    expect(parseClaudeResetTime(`3:30pm (${tz})`, now)).toBe(Date.UTC(2026, 9, 16, 7, 30))
    expect(parseClaudeResetTime(`12am (${tz})`, now)).toBe(Date.UTC(2026, 9, 16, 16, 0)) // midnight, next day
    expect(parseClaudeResetTime(`12pm (${tz})`, now)).toBe(Date.UTC(2026, 9, 17, 4, 0)) // noon already past → tomorrow
    expect(parseClaudeResetTime(`2pm (${tz})`, now)).toBe(Date.UTC(2026, 9, 17, 6, 0))
    expect(parseClaudeResetTime(`Oct 20, 3pm (${tz})`, now)).toBe(Date.UTC(2026, 9, 20, 7, 0))
    const lateDec = Date.UTC(2026, 11, 31, 4, 0) // Dec 31 12:00 Taipei
    expect(parseClaudeResetTime(`Jan 2, 3pm (${tz})`, lateDec)).toBe(Date.UTC(2027, 0, 2, 7, 0))
    expect(parseClaudeResetTime(`Jan 2, 2027, 3pm (${tz})`, lateDec)).toBe(Date.UTC(2027, 0, 2, 7, 0))
  })

  it('claude: a zone with DST, and an unknown zone (local time)', () => {
    const now = Date.UTC(2026, 6, 1, 12, 0) // July: New York is UTC-4
    expect(parseClaudeResetTime('3pm (America/New_York)', now)).toBe(Date.UTC(2026, 6, 1, 19, 0))
    expect(parseClaudeResetTime('3pm (UTC)', now)).toBe(Date.UTC(2026, 6, 1, 15, 0))
    expect(parseClaudeResetTime('4pm (Not/AZone)', NOW)).toBe(local(9, 16, 16, 0))
    expect(parseClaudeResetTime('4pm', NOW)).toBe(local(9, 16, 16, 0))
  })

  it('codex: local time, same day / dated / ordinal suffixes / narrow no-break space', () => {
    expect(parseCodexResetTime('3:05 PM', NOW)).toBe(local(9, 16, 15, 5))
    expect(parseCodexResetTime('3:05 PM', NOW)).toBe(local(9, 16, 15, 5))
    expect(parseCodexResetTime('Oct 17th, 2026 3:05 PM', NOW)).toBe(local(9, 17, 15, 5))
    expect(parseCodexResetTime('Oct 1st, 2026 3:05 AM', local(9, 1, 1, 0))).toBe(local(9, 1, 3, 5))
    expect(parseCodexResetTime('Jan 2nd, 2027 9:00 AM', local(11, 31, 20, 0))).toBe(local(0, 2, 9, 0, 2027))
    // a time a few minutes past still counts (minute resolution)
    expect(parseCodexResetTime('2:55 PM', NOW)).toBe(local(9, 16, 14, 55))
    // further past → the next day
    expect(parseCodexResetTime('2:00 PM', NOW)).toBe(local(9, 17, 14, 0))
  })

  it('expired, more than 7 days out, or garbage → null', () => {
    expect(parseCodexResetTime('Oct 15th, 2026 3:05 PM', NOW)).toBeNull()
    expect(parseClaudeResetTime('Oct 15, 2026, 3pm', NOW)).toBeNull()
    expect(parseCodexResetTime('Oct 30th, 2026 3:05 PM', NOW)).toBeNull()
    expect(parseClaudeResetTime('Oct 30, 3pm', NOW)).toBeNull()
    // a date without a year that already passed → next year → more than 7 days out
    expect(parseClaudeResetTime('Oct 15, 3pm', NOW)).toBeNull()
    expect(parseCodexResetTime('13:05 PM', NOW)).toBeNull()
    expect(parseCodexResetTime('soon', NOW)).toBeNull()
    expect(parseClaudeResetTime('in 4m', NOW)).toBeNull()
    expect(decide(["You've hit your usage limit. Try again at Oct 15th, 2026 3:05 PM."])).toMatchObject({ action: 'hint', hint: 'no-reset-time' })
  })
})

describe('settings', () => {
  it('off unless usageLimitAutoContinue === true; text and delay defaults / clamps', () => {
    expect(normalizeUsageLimitConfig(undefined)).toEqual({ enabled: false, text: USAGE_LIMIT_DEFAULT_TEXT, delayMinutes: 2 })
    expect(normalizeUsageLimitConfig({ usageLimitAutoContinue: 'true' })).toMatchObject({ enabled: false })
    expect(normalizeUsageLimitConfig({ usageLimitAutoContinue: true, usageLimitContinueText: ' go on ', usageLimitContinueDelayMinutes: 0 })).toEqual({ enabled: true, text: 'go on', delayMinutes: 0 })
    expect(clampUsageLimitDelayMinutes(90)).toBe(60)
    expect(clampUsageLimitDelayMinutes(-3)).toBe(0)
    expect(clampUsageLimitDelayMinutes(2.6)).toBe(3)
    expect(clampUsageLimitDelayMinutes('x')).toBe(2)
    expect(clampUsageLimitDelayMinutes('5')).toBe(5)
  })

  it('text: control characters flattened, empty → default, capped length', () => {
    expect(sanitizeUsageLimitText('繼續\r\n執行')).toBe('繼續 執行')
    expect(sanitizeUsageLimitText('\x1b[31m')).toBe('[31m')
    expect(sanitizeUsageLimitText('   ')).toBe(USAGE_LIMIT_DEFAULT_TEXT)
    expect(sanitizeUsageLimitText(42)).toBe(USAGE_LIMIT_DEFAULT_TEXT)
    expect(sanitizeUsageLimitText('x'.repeat(500))).toHaveLength(200)
  })
})

describe('plain text from terminal output', () => {
  it('drops styles and OSC, turns cursor moves into line breaks and cursor-forward into a space', () => {
    const { text } = plainTextFromOutput('\x1b]0;title\x07\x1b[1m\x1b[31m■\x1b[0m You\x1b[1Cve\x1b[5;1Hnext\r\nline\rover')
    expect(text).toBe('■ You ve\nnext\nline\nover')
  })

  it('keeps an escape sequence split across chunks for the next chunk', () => {
    const first = plainTextFromOutput('abc\x1b[3')
    expect(first).toEqual({ text: 'abc', carry: '\x1b[3' })
    expect(plainTextFromOutput('1mdef', first.carry)).toEqual({ text: 'def', carry: '' })
  })
})

describe('renderer re-check', () => {
  it('same action still on screen → null; otherwise the reason', () => {
    const codex = ["You've hit your usage limit. Try again at 3:05 PM.", ...CODEX_PROMPT]
    expect(usageLimitRecheckFailure(codex, 'text', NOW)).toBeNull()
    expect(usageLimitRecheckFailure(codex, 'enter', NOW)).toBe('screen shows send-text')
    expect(usageLimitRecheckFailure([...codex, '• Continuing with step 2'], 'text', NOW)).toBeNull()
    expect(usageLimitRecheckFailure(['Your usage limit has reset', 'Press enter to continue'], 'enter', NOW)).toBeNull()
    expect(usageLimitRecheckFailure(['Your usage limit has reset', 'Press enter to continue', 'Usage limit available again · continuing now'], 'enter', NOW)).toBe('screen shows none')
    expect(usageLimitRecheckFailure(["You've hit your session limit · resets 4pm", 'Continuing automatically at 4pm · esc to cancel'], 'enter', NOW)).toBe('screen shows hint cli-auto')
  })
})
