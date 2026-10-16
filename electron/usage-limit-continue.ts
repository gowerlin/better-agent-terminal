/**
 * PLAN-044 / T0566 (D148): continue an agent after its usage limit resets.
 *
 *   - codex tab (yolo): `You've hit your usage limit … Try again at <time>.` → at reset + the
 *     Settings delay, the window holding the tab re-checks the screen and types the Settings text
 *     + Enter. A reset more than 5 h 15 min out (weekly) → hint only.
 *   - claude tab: the CLI continues by itself (2.1.234+, `autoContinueAtUsageLimit`) — BAT never
 *     types text there, it only shows what the CLI will do. The one gap: after a sleep past the
 *     reset the CLI waits on `Press enter to continue` → BAT sends Enter only (same delay / cancel
 *     rules).
 *   - non-yolo tab: hint only. Non-timed limits (spend cap, credits, seat, org): hint only.
 *
 * Detection runs on the PTY output stream (`PtyManager` `onPtyOutput`): the plain-text tail of
 * each tab is classified once the tab has been quiet for `USAGE_LIMIT_QUIET_MS`; only lines after
 * the last user input and the last automatic send count (`handledSeq`), so a limit the user or
 * BAT already acted on is history. Recognition rules: `src/lib/usage-limit.ts`.
 *
 * Cancelled by: user input in the tab (a local window's / a remote client's `pty:write` that is
 * not `isTerminalAutoReply`, T0551; BAT's own writes are flagged `auto` and do not count), the
 * screen no longer showing the limit when due, the tab ending, the Settings switch turned off,
 * the tab no longer yolo. At most `USAGE_LIMIT_MAX_CONSECUTIVE` automatic sends in a row per
 * tab (reset by user input, or by `USAGE_LIMIT_STREAK_RESET_MS` without a new limit), then hint
 * only.
 *
 * Off by default (Settings `usageLimitAutoContinue`); while off, `onOutput` returns at once and
 * nothing is tracked, shown or sent.
 *
 * Headless bat-server runs the same scheduler on its PtyManager (electron/remote/headless-entry.ts);
 * the events reach the client windows of that profile (`PROXIED_EVENTS`), and with no client
 * connected nothing is sent (logged).
 *
 * 🔴 No `electron` import here (shared with headless).
 */
import {
  classifyUsageLimitScreen,
  decideUsageLimit,
  plainTextFromOutput,
  USAGE_LIMIT_MAX_CONSECUTIVE_SENDS,
  USAGE_LIMIT_SCREEN_LINES,
  type UsageLimitAgent,
  type UsageLimitConfig,
  type UsageLimitContinueEvent,
  type UsageLimitDecision,
  type UsageLimitStatus,
  type UsageLimitStatusEvent,
} from '../src/lib/usage-limit'

/** A tab is classified once its output has been quiet this long (constant). */
export const USAGE_LIMIT_QUIET_MS = 5000
/** Automatic sends in a row per tab before it falls back to a hint (src/lib/usage-limit.ts). */
export const USAGE_LIMIT_MAX_CONSECUTIVE = USAGE_LIMIT_MAX_CONSECUTIVE_SENDS
/** A new limit this long after the last automatic send starts a new streak. */
export const USAGE_LIMIT_STREAK_RESET_MS = 30 * 60_000
/** Longest single timer; the due time is re-checked against the wall clock (sleep / resume). */
export const USAGE_LIMIT_MAX_TICK_MS = 60_000
/** Plain-text lines kept per tab. */
export const USAGE_LIMIT_TAIL_LINES = 200
const TAIL_LINE_MAX_CHARS = 2000

export const USAGE_LIMIT_CONTINUE_CHANNEL = 'terminal:usage-limit-continue'
export const USAGE_LIMIT_STATUS_CHANNEL = 'terminal:usage-limit-status'

/** What the scheduler needs from PtyManager. */
export interface UsageLimitPtyManager {
  isAlive(id: string): boolean
  isYoloTerminal(id: string): boolean
}

export interface UsageLimitSchedulerDeps {
  getPtyManager(): UsageLimitPtyManager | null
  readConfig(): UsageLimitConfig
  /** Re-read the config after this long; undefined = only on `refreshConfig()` (Electron). */
  configTtlMs?: number
  /** Sends `terminal:usage-limit-*` to the windows that may hold the tab. */
  emit(channel: string, payload: unknown): unknown
  /** Headless: whether any client is connected (false → nothing is sent). Undefined = always. */
  canDeliver?: () => boolean
  logger: { log(...args: unknown[]): void; warn(...args: unknown[]): void }
  now?: () => number
  setTimeout?: (callback: () => void, ms: number) => unknown
  clearTimeout?: (handle: unknown) => void
}

interface TailLine { seq: number; text: string; open: boolean }

interface TabState {
  lines: TailLine[]
  nextSeq: number
  carry: string
  quietTimer: unknown
  /** Lines up to this seq were acted on (user input / automatic send): no longer a limit. */
  handledSeq: number
  /** Last emitted status (JSON) — events only on change. */
  statusKey: string
}

interface Pending {
  action: 'text' | 'enter'
  agent: UsageLimitAgent
  dueAt: number
  resetsAt: number | null
  resetText: string | null
  scheduledAt: number
  timer: unknown
}

interface Streak { count: number; lastSentAt: number }

export class UsageLimitContinueScheduler {
  private readonly tabs = new Map<string, TabState>()
  private readonly pending = new Map<string, Pending>()
  private readonly streaks = new Map<string, Streak>()
  private config: UsageLimitConfig | null = null
  private configReadAt = 0
  private traceSeq = 0
  private readonly now: () => number
  private readonly setTimer: (callback: () => void, ms: number) => unknown
  private readonly clearTimer: (handle: unknown) => void

  constructor(private readonly deps: UsageLimitSchedulerDeps) {
    this.now = deps.now ?? Date.now
    this.setTimer = deps.setTimeout ?? ((cb, ms) => setTimeout(cb, ms))
    this.clearTimer = deps.clearTimeout ?? ((handle) => clearTimeout(handle as ReturnType<typeof setTimeout>))
  }

  /** Ids with a pending automatic send (tests / diagnostics). */
  pendingIds(): string[] {
    return [...this.pending.keys()]
  }

  /** The current config (cached; see `configTtlMs`). */
  getConfig(): UsageLimitConfig {
    const ttl = this.deps.configTtlMs
    if (!this.config || (ttl !== undefined && this.now() - this.configReadAt >= ttl)) this.loadConfig()
    return this.config as UsageLimitConfig
  }

  /** Settings changed (Electron `settings:save`): re-read; switching off drops everything. */
  refreshConfig(): void {
    this.loadConfig()
  }

  /** PTY output of tab `id` (raw, as broadcast). */
  onOutput(id: string, data: string): void {
    if (!this.getConfig().enabled) return
    let tab = this.tabs.get(id)
    if (!tab) {
      tab = { lines: [], nextSeq: 1, carry: '', quietTimer: null, handledSeq: 0, statusKey: 'null' }
      this.tabs.set(id, tab)
    }
    const { text, carry } = plainTextFromOutput(data, tab.carry)
    tab.carry = carry
    this.appendText(tab, text)
    if (tab.quietTimer !== null) this.clearTimer(tab.quietTimer)
    const state = tab
    state.quietTimer = this.setTimer(() => {
      if (this.tabs.get(id) !== state) return
      state.quietTimer = null
      this.evaluate(id)
    }, USAGE_LIMIT_QUIET_MS)
  }

  /** The user typed into tab `id` (not an auto reply, not BAT's own write): cancels, and the limit on screen is handled. */
  onUserInput(id: string): void {
    const tab = this.tabs.get(id)
    if (tab) tab.handledSeq = tab.nextSeq - 1
    this.streaks.delete(id)
    const pending = this.pending.get(id)
    if (pending) {
      this.drop(id)
      this.deps.logger.log(`[usage-limit] id=${id} → cancelled (user input while waiting; ${pending.action === 'text' ? 'text' : 'Enter'} was due ${new Date(pending.dueAt).toISOString()})`)
    }
    if (tab) this.setStatus(id, null)
  }

  /** Tab `id`'s PTY is gone. */
  onExit(id: string): void {
    const pending = this.pending.get(id)
    if (pending) this.deps.logger.log(`[usage-limit] id=${id} → cancelled (terminal ended)`)
    this.forget(id)
  }

  /** Clears every timer (app quit / server stop). */
  dispose(): void {
    for (const id of [...this.tabs.keys()]) this.forget(id, false)
    for (const id of [...this.pending.keys()]) this.drop(id)
  }

  // ── internals ──

  private loadConfig(): void {
    const before = this.config
    let next: UsageLimitConfig
    try {
      next = this.deps.readConfig()
    } catch (e) {
      this.deps.logger.warn('[usage-limit] reading settings failed; treated as off:', e)
      next = { enabled: false, text: '', delayMinutes: 0 }
    }
    this.config = next
    this.configReadAt = this.now()
    if (before && before.enabled !== next.enabled) {
      this.deps.logger.log(`[usage-limit] ${next.enabled ? 'enabled' : 'disabled'} (text="${next.text}" delayMinutes=${next.delayMinutes})`)
    }
    if (!next.enabled && before?.enabled) {
      for (const id of [...this.pending.keys()]) {
        this.drop(id)
        this.deps.logger.log(`[usage-limit] id=${id} → cancelled (turned off in Settings)`)
      }
      for (const id of [...this.tabs.keys()]) this.forget(id)
      this.streaks.clear()
    }
  }

  /** Appends plain text: the first part continues the open last line, each `\n` closes it. */
  private appendText(tab: TabState, text: string): void {
    if (!text) return
    const parts = text.split('\n')
    for (let i = 0; i < parts.length; i++) {
      const last = tab.lines[tab.lines.length - 1]
      if (i > 0 && last) last.open = false
      const part = parts[i]
      if (!part) continue
      if (last && last.open) last.text = (last.text + part).slice(-TAIL_LINE_MAX_CHARS)
      else tab.lines.push({ seq: tab.nextSeq++, text: part.slice(-TAIL_LINE_MAX_CHARS), open: true })
    }
    if (tab.lines.length > USAGE_LIMIT_TAIL_LINES) tab.lines.splice(0, tab.lines.length - USAGE_LIMIT_TAIL_LINES)
  }

  /** The bottom screen lines after `handledSeq` (blank lines dropped) and their seqs. */
  private screenOf(tab: TabState): { lines: string[]; seqs: number[] } {
    const lines: string[] = []
    const seqs: number[] = []
    for (let i = tab.lines.length - 1; i >= 0 && lines.length < USAGE_LIMIT_SCREEN_LINES; i--) {
      const line = tab.lines[i]
      if (line.seq <= tab.handledSeq) break
      const text = line.text.replace(/\n$/, '')
      if (!text.trim()) continue
      lines.unshift(text)
      seqs.unshift(line.seq)
    }
    return { lines, seqs }
  }

  private decide(id: string): { decision: UsageLimitDecision; seq: number | null } | null {
    const tab = this.tabs.get(id)
    if (!tab) return null
    const now = this.now()
    const { lines, seqs } = this.screenOf(tab)
    const decision = decideUsageLimit(classifyUsageLimitScreen(lines, now), now)
    const seq = decision.action !== 'none' && decision.line !== undefined ? seqs[decision.line] : null
    return { decision, seq }
  }

  /** The tab went quiet: what does its screen show now? */
  private evaluate(id: string): void {
    if (!this.getConfig().enabled) return
    const ptys = this.deps.getPtyManager()
    if (!ptys || !ptys.isAlive(id)) {
      this.forget(id)
      return
    }
    const result = this.decide(id)
    if (!result) return
    const { decision } = result
    const now = this.now()

    if (decision.action === 'none') {
      const pending = this.pending.get(id)
      if (pending) {
        this.drop(id)
        this.deps.logger.log(`[usage-limit] id=${id} → cancelled (the limit is no longer on screen)`)
      }
      this.setStatus(id, null)
      return
    }

    if (decision.action === 'hint') {
      const pending = this.pending.get(id)
      if (pending) {
        this.drop(id)
        this.deps.logger.log(`[usage-limit] id=${id} → cancelled (screen now shows hint ${decision.hint})`)
      }
      this.setStatus(id, { state: 'hint', agent: decision.agent, hint: decision.hint, resetsAt: decision.resetsAt, resetText: decision.resetText }, `detected ${decision.agent} limit → hint ${decision.hint}${decision.resetText ? ` (reset "${decision.resetText}")` : ''}`)
      return
    }

    const action = decision.action === 'send-text' ? 'text' : 'enter'
    const agent: UsageLimitAgent = decision.agent
    const resetsAt = decision.action === 'send-text' ? decision.resetsAt : null
    const resetText = decision.action === 'send-text' ? decision.resetText : null
    const what = decision.action === 'send-text' ? `codex limit (reset "${resetText}")` : 'claude waiting on "Press enter to continue"'

    if (!ptys.isYoloTerminal(id)) {
      if (this.pending.has(id)) {
        this.drop(id)
        this.deps.logger.log(`[usage-limit] id=${id} → cancelled (no longer a yolo tab)`)
      }
      this.setStatus(id, { state: 'hint', agent, hint: 'not-yolo', resetsAt, resetText }, `detected ${what} → hint only (not a yolo tab)`)
      return
    }

    const streak = this.streaks.get(id)
    if (streak && now - streak.lastSentAt > USAGE_LIMIT_STREAK_RESET_MS) this.streaks.delete(id)
    const sent = this.streaks.get(id)?.count ?? 0
    if (sent >= USAGE_LIMIT_MAX_CONSECUTIVE) {
      this.drop(id)
      this.setStatus(id, { state: 'hint', agent, hint: 'cap', resetsAt, resetText }, `detected ${what} → hint only (${sent} automatic sends in a row already)`)
      return
    }

    const config = this.getConfig()
    const delayMs = config.delayMinutes * 60_000
    const previous = this.pending.get(id)
    // Same limit still on screen (a redraw, a resize): keep the timer that is already running.
    if (previous && previous.action === action && previous.resetsAt === resetsAt) return
    const dueAt = (resetsAt ?? now) + delayMs
    if (previous) this.drop(id)
    this.deps.logger.log(`[usage-limit] id=${id} detected ${what} → scheduled ${action === 'text' ? 'text + Enter' : 'Enter only'} at ${new Date(dueAt).toISOString()} (delayMinutes=${config.delayMinutes})${previous ? ' (replaces the pending send)' : ''}`)
    this.arm(id, { action, agent, dueAt, resetsAt, resetText, scheduledAt: now })
    this.setStatus(id, { state: 'scheduled', agent, action, dueAt, resetsAt, resetText })
  }

  private arm(id: string, entry: Omit<Pending, 'timer'>): void {
    const wait = Math.max(0, Math.min(entry.dueAt - this.now(), USAGE_LIMIT_MAX_TICK_MS))
    const timer = this.setTimer(() => {
      const current = this.pending.get(id)
      if (!current || current.timer !== timer) return
      if (this.now() < current.dueAt) {
        this.arm(id, current) // long wait (or the clock moved): look again
        return
      }
      this.pending.delete(id)
      this.fire(id, current)
    }, wait)
    this.pending.set(id, { ...entry, timer })
  }

  /** Due: check again, then ask the window holding the tab to send. */
  private fire(id: string, entry: Pending): void {
    const tag = `[usage-limit] id=${id}`
    const fail = (reason: string) => {
      this.deps.logger.log(`${tag} → not sent (${reason})`)
      this.setStatus(id, null)
    }
    if (!this.getConfig().enabled) return fail('turned off in Settings')
    const ptys = this.deps.getPtyManager()
    if (!ptys || !ptys.isAlive(id)) {
      this.deps.logger.log(`${tag} → not sent (terminal no longer exists)`)
      this.forget(id)
      return
    }
    if (!ptys.isYoloTerminal(id)) return fail('no longer a yolo tab')
    const result = this.decide(id)
    const expected = entry.action === 'text' ? 'send-text' : 'send-enter'
    if (!result || result.decision.action !== expected) {
      const shows = !result ? 'nothing' : result.decision.action === 'hint' ? `hint ${result.decision.hint}` : result.decision.action
      return fail(`re-check failed: the screen shows ${shows}`)
    }
    if (this.deps.canDeliver && !this.deps.canDeliver()) return fail('no client connected')

    const config = this.getConfig()
    const traceId = `usage-limit-${this.now().toString(36)}-${(++this.traceSeq).toString(36)}`
    const event: UsageLimitContinueEvent = {
      id,
      action: entry.action,
      ...(entry.action === 'text' ? { text: config.text } : {}),
      agent: entry.agent,
      traceId,
    }
    const tab = this.tabs.get(id)
    if (tab) tab.handledSeq = tab.nextSeq - 1
    const streak = this.streaks.get(id)
    this.streaks.set(id, { count: (streak?.count ?? 0) + 1, lastSentAt: this.now() })
    const windows = this.deps.emit(USAGE_LIMIT_CONTINUE_CHANNEL, event)
    const late = this.now() - entry.dueAt
    this.deps.logger.log(`${tag} → send requested: ${entry.action === 'text' ? `text "${config.text}" + Enter` : 'Enter'} trace=${traceId} streak=${this.streaks.get(id)?.count}${late > 1000 ? ` (${Math.round(late / 1000)} s late)` : ''} (windows=${typeof windows === 'number' ? windows : 'n/a'})`)
    this.setStatus(id, null)
  }

  private drop(id: string): void {
    const pending = this.pending.get(id)
    if (!pending) return
    this.clearTimer(pending.timer)
    this.pending.delete(id)
  }

  private forget(id: string, clearStatus = true): void {
    this.drop(id)
    const tab = this.tabs.get(id)
    if (tab?.quietTimer) this.clearTimer(tab.quietTimer)
    if (tab && clearStatus) this.setStatus(id, null)
    this.tabs.delete(id)
    this.streaks.delete(id)
  }

  private setStatus(id: string, status: UsageLimitStatus | null, logLine?: string): void {
    const tab = this.tabs.get(id)
    const key = JSON.stringify(status)
    if (tab && tab.statusKey === key) return
    if (tab) tab.statusKey = key
    if (logLine) this.deps.logger.log(`[usage-limit] id=${id} ${logLine}`)
    const event: UsageLimitStatusEvent = { id, status }
    this.deps.emit(USAGE_LIMIT_STATUS_CHANNEL, event)
  }
}
