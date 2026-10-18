/**
 * T0609 (BUG-153): `terminal:attention-changed` — main tells the windows that a tab now waits for
 * the user (a claude hook `blocked`, T0590) or for its Tower's answer (pending tower questions,
 * T0607), or no longer does. The Worker badge (src/components/TerminalThumbnail.tsx) and the
 * Tower's "Close reported Worker tabs (N)" read it (src/lib/terminal-attention.ts).
 *
 * Event driven, no polling: the blocked tracker (`PtyManagerDeps.onBlockedChange`) and the
 * tower-question store (`TowerQuestionDeps.onChange`, its expiry included) call `refresh(id)`;
 * refreshes are coalesced to one microtask, the state is recomputed and sent only when it changed.
 * Same precedence as `terminal:get-state` (`stateOf`, electron/terminal-query-handlers.ts): a hook
 * reason over `tower`. The helper / MCP answers are unchanged — this is a separate push.
 *
 * Electron main sends it to every window + broadcastHub (remote clients of this BAT); headless
 * bat-server to its connected clients (`PROXIED_EVENTS` → the client windows of that profile).
 *
 * 🔴 The payload carries state fields only (`TerminalAttentionEvent`): never a question, an
 * option, an answer or a token (D155). `[attention]` log lines carry the same fields.
 * 🔴 No `electron` import here (shared with headless).
 */
import { isEmptyAttention, type TerminalAttentionEvent } from '../src/lib/terminal-attention'
import type { BlockedState } from './terminal-blocked-state'
import type { QuestionSummary } from './tower-questions'

export const ATTENTION_CHANGED_CHANNEL = 'terminal:attention-changed'

export interface TerminalAttentionDeps {
  /** What running PTY `id` is blocked on (`PtyManager.getBlockedState`); null = not blocked / gone. */
  getBlockedState(id: string): BlockedState | null
  /** The tower-question store's `summaryFor`. Absent ⇒ no questions. */
  getQuestionSummary?(id: string): QuestionSummary
  emit(channel: string, payload: unknown): unknown
  logger?: { log(...args: unknown[]): void }
  /** Tests. Default `queueMicrotask`. */
  schedule?(fn: () => void): void
}

/** Tab `id`'s attention now (an empty one = nothing to show). */
export function computeTerminalAttention(id: string, blocked: BlockedState | null, questions: QuestionSummary | null): TerminalAttentionEvent {
  const pendingQuestions = questions?.pending ?? 0
  const event: TerminalAttentionEvent = { id, pendingQuestions }
  // T0621: codex's `input` (OSC 7501) is not shown on the badge (yet): a query answer only
  if (blocked && blocked.reason !== 'input') {
    event.blockedReason = blocked.reason
    event.blockedSince = blocked.since
  } else if (questions && questions.blockingSince !== null) {
    event.blockedReason = 'tower'
    event.blockedSince = questions.blockingSince
  }
  if (pendingQuestions > 0 && questions?.pendingSince != null) event.questionsSince = questions.pendingSince
  return event
}

function describe(event: TerminalAttentionEvent): string {
  if (isEmptyAttention(event)) return 'none'
  const parts: string[] = []
  if (event.blockedReason) parts.push(`blocked reason=${event.blockedReason}`)
  parts.push(`pendingQuestions=${event.pendingQuestions}`)
  return parts.join(' ')
}

export class TerminalAttentionNotifier {
  /** Tab id → key of the last non-empty state sent (absent = nothing / empty sent). */
  private readonly sent = new Map<string, string>()
  private readonly dirty = new Set<string>()
  private flushScheduled = false
  private disposed = false

  constructor(private readonly deps: TerminalAttentionDeps) {}

  /** Tab `id`'s blocked state or questions may have changed. */
  refresh(id: string): void {
    if (this.disposed || typeof id !== 'string' || !id) return
    this.dirty.add(id)
    if (this.flushScheduled) return
    this.flushScheduled = true
    const schedule = this.deps.schedule ?? ((fn: () => void) => queueMicrotask(fn))
    schedule(() => this.flush())
  }

  /** Recomputes the dirty tabs now and sends what changed. */
  flush(): void {
    this.flushScheduled = false
    if (this.disposed) return
    // a refresh while computing (the question store's sweep) is picked up by this loop
    while (this.dirty.size > 0) {
      const id = this.dirty.values().next().value as string
      this.dirty.delete(id)
      this.send(id)
    }
  }

  private send(id: string): void {
    let event: TerminalAttentionEvent
    try {
      event = computeTerminalAttention(id, this.deps.getBlockedState(id), this.deps.getQuestionSummary?.(id) ?? null)
    } catch (e) {
      this.deps.logger?.log(`[attention] terminal=${id} → not computed (${e instanceof Error ? e.message : String(e)})`)
      return
    }
    const empty = isEmptyAttention(event)
    const key = empty ? null : JSON.stringify(event)
    const last = this.sent.get(id) ?? null
    if (key === last) return
    if (key === null) this.sent.delete(id)
    else this.sent.set(id, key)
    const windows = this.deps.emit(ATTENTION_CHANGED_CHANNEL, event)
    this.deps.logger?.log(`[attention] terminal=${id} → ${describe(event)}${typeof windows === 'number' ? ` windows=${windows}` : ''}`)
  }

  dispose(): void {
    this.disposed = true
    this.dirty.clear()
    this.sent.clear()
  }
}
