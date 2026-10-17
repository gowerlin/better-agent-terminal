/**
 * T0609 (BUG-153): what a Worker tab's thumbnail badge says — the tab waits for the user, waits
 * for its Tower's answer, or reported — and which Workers the Tower's "Close reported Worker tabs
 * (N)" counts. Shared by main (the `terminal:attention-changed` payload, electron/terminal-attention.ts)
 * and the renderer (workspace-store, TerminalThumbnail). No `electron` / DOM import.
 *
 *   attention                                         source                         badge
 *   blocked / permission | question | elicitation     main: claude hook (T0590)       ⚠️
 *   blocked / tower, or pending questions > 0         main: tower questions (T0607)   ?
 *   the Worker's latest report ends with `提問`       renderer: `workerQuestion`      ?   (old CT fallback)
 *   any other report (完成 / BLOCKED / 需要協助 …)    renderer: `workerReport`        ✓   (counted by batch close)
 *
 * Precedence: waits for the user > waits for the Tower > reported (`workerAttention`).
 * 🔴 The payload carries state fields only — never a question, an option or an answer (D155).
 */

/** What a claude hook reports (electron/terminal-blocked-state.ts `HookBlockedReason`). */
export type AttentionHookReason = 'permission' | 'question' | 'elicitation'
export type AttentionBlockedReason = AttentionHookReason | 'tower'

export const ATTENTION_HOOK_REASONS: readonly AttentionHookReason[] = ['permission', 'question', 'elicitation']

/**
 * `terminal:attention-changed` payload: tab `id`'s state now. No `blockedReason` and
 * `pendingQuestions: 0` = nothing to show (the renderer forgets the tab).
 */
export interface TerminalAttentionEvent {
  id: string
  /** Same precedence as `terminal:get-state`: a hook reason over `tower`. */
  blockedReason?: AttentionBlockedReason
  /** ms epoch the tab entered `blockedReason`. */
  blockedSince?: number
  /** Pending questions this tab asked its Tower (blocking or not). */
  pendingQuestions: number
  /** ms epoch of its oldest pending question (`pendingQuestions > 0` only). */
  questionsSince?: number
}

export function isEmptyAttention(event: TerminalAttentionEvent | null | undefined): boolean {
  return !event || (!event.blockedReason && !(event.pendingQuestions > 0))
}

export function isHookReason(reason: unknown): reason is AttentionHookReason {
  return (ATTENTION_HOOK_REASONS as readonly unknown[]).includes(reason)
}

/**
 * Old CT fallback (work order file round trip, no structured question): a Worker that asks its
 * Tower notifies `T#### 提問` (CT's fixed message). Trailing whitespace is ignored.
 */
export function isQuestionNotifyMessage(message: unknown): boolean {
  return typeof message === 'string' && /提問\s*$/.test(message)
}

export type WorkerAttention =
  | { kind: 'blocked'; reason: AttentionHookReason; since: number | null }
  | { kind: 'question'; since: number | null; pending: number; source: 'question' | 'notify' }
  | { kind: 'reported'; message: string; reportedAt: number }

export interface WorkerAttentionTab {
  workerReport?: { message: string; reportedAt: number }
  workerQuestion?: { message: string; askedAt: number }
}

/** The badge of a Worker tab: main's state first, then its latest report. null = running. */
export function workerAttention(tab: WorkerAttentionTab, attention: TerminalAttentionEvent | null | undefined): WorkerAttention | null {
  if (attention && isHookReason(attention.blockedReason)) {
    return { kind: 'blocked', reason: attention.blockedReason, since: attention.blockedSince ?? null }
  }
  if (attention && (attention.blockedReason === 'tower' || attention.pendingQuestions > 0)) {
    const since = attention.blockedReason === 'tower' ? attention.blockedSince : attention.questionsSince
    return { kind: 'question', since: since ?? null, pending: attention.pendingQuestions, source: 'question' }
  }
  if (tab.workerQuestion) return { kind: 'question', since: tab.workerQuestion.askedAt, pending: 0, source: 'notify' }
  if (tab.workerReport) return { kind: 'reported', message: tab.workerReport.message, reportedAt: tab.workerReport.reportedAt }
  return null
}
