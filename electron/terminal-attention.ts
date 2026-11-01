/**
 * T0609 (BUG-153): `terminal:attention-changed` — main tells the windows that a tab now waits for
 * the user (a claude hook `blocked`, T0590; codex's `input`, T0621 / T0623) or for its Tower's answer (pending tower questions,
 * T0607), or no longer does. The Worker badge (src/components/TerminalThumbnail.tsx) and the
 * Tower's "Close reported Worker tabs (N)" read it (src/lib/terminal-attention.ts).
 *
 * T0694 (D180): + `busy` — the tab's agent is in a turn (claude hook `UserPromptSubmit` → `Stop`, codex
 * OSC 7501 `working` → `idle` / `clear`, or a quiet fallback; `TerminalBlockedTracker`); the renderer
 * shows a reported Worker that works again as `resumed`, not ✓.
 *
 * Event driven, no polling: the blocked tracker (`PtyManagerDeps.onBlockedChange`) and the
 * tower-question store (`TowerQuestionDeps.onChange`, its expiry included) call `refresh(id)`;
 * refreshes are coalesced to one microtask, the state is recomputed and sent only when it changed.
 * Same precedence as `terminal:get-state` (`stateOf`, electron/terminal-query-handlers.ts): a hook
 * reason (codex's `input` included) over `tower`. The helper / MCP answers are unchanged — this is a separate push.
 *
 * Electron main sends it to every window + broadcastHub (remote clients of this BAT); headless
 * bat-server to its connected clients (`PROXIED_EVENTS` → the client windows of that profile).
 *
 * 🔴 The payload carries state fields only (`TerminalAttentionEvent`): never a question, an
 * option, an answer or a token (D155). `[attention]` log lines carry the same fields.
 * 🔴 No `electron` import here (shared with headless).
 *
 * T0749 (BUG-182): + `terminal:attention-snapshot` (`registerAttentionSnapshotHandler`) — the
 * attention of the tabs a window asks about as this host has them now, plus whether each one's PTY
 * still runs here. A remote profile window asks after it connects again (src/App.tsx →
 * `reconcileTerminalAttention`, src/stores/terminal-attention-store.ts): pushes sent while it was
 * disconnected never reach it, and a restarted server has no PTY (and sends no exit) for the tabs
 * it had before. Read only, state fields only (the push's payload); a bat-server older than T0749
 * has no handler and the window keeps what it had.
 */
import { isEmptyAttention, type TerminalAttentionEvent, type TerminalAttentionSnapshotEntry } from '../src/lib/terminal-attention'

export type { TerminalAttentionSnapshotEntry }
import type { BlockedState } from './terminal-blocked-state'
import type { QuestionSummary } from './tower-questions'

export const ATTENTION_CHANGED_CHANNEL = 'terminal:attention-changed'
export const ATTENTION_SNAPSHOT_CHANNEL = 'terminal:attention-snapshot'
/** T0749: at most this many ids per `terminal:attention-snapshot` (the rest are not answered). */
export const ATTENTION_SNAPSHOT_MAX_IDS = 1000
const ATTENTION_SNAPSHOT_MAX_ID_LENGTH = 256


export interface TerminalAttentionDeps {
  /** What running PTY `id` is blocked on (`PtyManager.getBlockedState`); null = not blocked / gone. */
  getBlockedState(id: string): BlockedState | null
  /** T0694: whether running PTY `id`'s agent is in a turn (`PtyManager.isAgentTurnActive`). Absent ⇒ never. */
  isTurnActive?(id: string): boolean
  /** The tower-question store's `summaryFor`. Absent ⇒ no questions. */
  getQuestionSummary?(id: string): QuestionSummary
  emit(channel: string, payload: unknown): unknown
  logger?: { log(...args: unknown[]): void }
  /** Tests. Default `queueMicrotask`. */
  schedule?(fn: () => void): void
}

/** Tab `id`'s attention now (an empty one = nothing to show). */
export function computeTerminalAttention(id: string, blocked: BlockedState | null, questions: QuestionSummary | null, busy = false): TerminalAttentionEvent {
  const pendingQuestions = questions?.pending ?? 0
  const event: TerminalAttentionEvent = { id, pendingQuestions }
  if (busy) event.busy = true // T0694: only when true (an idle tab's event is unchanged)
  if (blocked) {
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
  if (event.busy) parts.push('busy') // T0694
  return parts.join(' ')
}

export class TerminalAttentionNotifier {
  /** Tab id → key of the last non-empty state sent (absent = nothing / empty sent). */
  private readonly sent = new Map<string, string>()
  private readonly dirty = new Set<string>()
  private flushScheduled = false
  private disposed = false

  constructor(private readonly deps: TerminalAttentionDeps) {}

  /** Tab `id`'s blocked state, turn (T0694) or questions may have changed. */
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
      event = computeTerminalAttention(id, this.deps.getBlockedState(id), this.deps.getQuestionSummary?.(id) ?? null, this.deps.isTurnActive?.(id) ?? false)
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

  /**
   * T0749: tab `id`'s attention as `send` would compute it now — not sent, `sent` unchanged (the
   * next change is still pushed). Null when it cannot be computed.
   */
  current(id: string): TerminalAttentionEvent | null {
    try {
      return computeTerminalAttention(id, this.deps.getBlockedState(id), this.deps.getQuestionSummary?.(id) ?? null, this.deps.isTurnActive?.(id) ?? false)
    } catch {
      return null
    }
  }

  dispose(): void {
    this.disposed = true
    this.dirty.clear()
    this.sent.clear()
  }
}

/** T0749: the ids of a snapshot request — non-empty strings, de-duplicated, at most `ATTENTION_SNAPSHOT_MAX_IDS`. */
export function normalizeAttentionSnapshotIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const ids: string[] = []
  const seen = new Set<string>()
  for (const value of raw) {
    if (ids.length >= ATTENTION_SNAPSHOT_MAX_IDS) break
    if (typeof value !== 'string' || !value || value.length > ATTENTION_SNAPSHOT_MAX_ID_LENGTH || seen.has(value)) continue
    seen.add(value)
    ids.push(value)
  }
  return ids
}

/** T0749: the answer for `ids` — a PTY that does not run here has no attention. */
export function attentionSnapshot(
  ids: readonly string[],
  isAlive: (id: string) => boolean,
  current: (id: string) => TerminalAttentionEvent | null,
): TerminalAttentionSnapshotEntry[] {
  return ids.map((id) => {
    const alive = isAlive(id)
    return { id, alive, attention: alive ? current(id) ?? { id, pendingQuestions: 0 } : null }
  })
}

/**
 * T0749 (BUG-182): `terminal:attention-snapshot(ids)` on this host — Electron main and headless
 * bat-server register the same handler. Answers `TerminalAttentionSnapshotEntry[]`, one per valid id.
 * 🔴 Read only, state fields only; the `[attention]` log line has counts only.
 */
export function registerAttentionSnapshotHandler(opts: {
  registerHandler: (channel: string, handler: (ctx: unknown, ids?: unknown) => unknown) => void
  getNotifier: () => TerminalAttentionNotifier | null
  isAlive: (id: string) => boolean
  logger?: { log(...args: unknown[]): void }
}): void {
  opts.registerHandler(ATTENTION_SNAPSHOT_CHANNEL, (_ctx, raw) => {
    const ids = normalizeAttentionSnapshotIds(raw)
    const notifier = opts.getNotifier()
    const entries = attentionSnapshot(ids, opts.isAlive, id => notifier?.current(id) ?? null)
    const gone = entries.filter(e => !e.alive).length
    const nonEmpty = entries.filter(e => !isEmptyAttention(e.attention)).length
    opts.logger?.log(`[attention] snapshot ids=${ids.length} gone=${gone} nonEmpty=${nonEmpty}`)
    return entries
  })
}
