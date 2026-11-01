/**
 * T0609 (BUG-153): what a Worker tab's thumbnail badge says — the tab waits for the user, waits
 * for its Tower's answer, or reported — and which Workers the Tower's "Close reported Worker tabs
 * (N)" counts. Shared by main (the `terminal:attention-changed` payload, electron/terminal-attention.ts)
 * and the renderer (workspace-store, TerminalThumbnail). No `electron` / DOM import.
 *
 *   attention                                         source                         badge
 *   blocked / permission | question | elicitation     main: claude hook (T0590)       ⚠️
 *   blocked / input                                   main: codex OSC 7501 (T0621)    ⚠️  (T0623)
 *   blocked / tower, or pending questions > 0         main: tower questions (T0607)   ?
 *   the Worker's latest report ends with `提問`       renderer: `workerQuestion`      ?   (old CT fallback)
 *   reported, then a turn started (T0694)             main: `busy` + renderer order    ↻   (not counted by batch close)
 *   any other report (完成 / BLOCKED / 需要協助 …)    renderer: `workerReport`        ✓   (counted by batch close)
 *
 * Precedence: waits for the user > waits for the Tower > reported, working again > reported (`workerAttention`).
 * T0694 (D180): `resumed` — a Worker that reported and then started a new turn (a Renew in the same
 * tab): main says the turn runs (`busy`), the renderer says it started after the report by the order
 * it received the two events (src/stores/terminal-attention-store.ts `isWorkerResumedAfterReport`;
 * never by comparing main's / a remote host's times with `reportedAt`). The turn ends without a new
 * report → ✓ again; a new report → ✓. In memory only.
 * T0613 (BUG-154): the notify of `bat-notify --ask` (it carries `questionId`) is no report: it
 * clears the tab's `workerReport` / `workerQuestion`, so once the question ends the tab shows
 * nothing (still working) until the Worker notifies again (`workerNotifyKind`).
 * 🔴 The payload carries state fields only — never a question, an option or an answer (D155).
 *
 * T0735 (D200): "waits for the user" (⚠️) is one rule for every tab, not only Workers —
 * `waitingForUser` (a hook reason: permission / question / elicitation, codex `input`). `?` (`tower`,
 * pending questions), ✓ and ↻ never count. A non-Worker tab's thumbnail shows ⚠️ by it, and the
 * workspace list sums it per workspace (`workspaceWaitingTabs`; the ⚠️ click goes to
 * `oldestWaitingTab`). Main already pushes `terminal:attention-changed` for every PTY (no Worker
 * filter), so nothing changed in main.
 */

/**
 * Waits for the user (⚠️): what a claude hook reports (electron/terminal-blocked-state.ts
 * `HookBlockedReason`), or T0623: codex's `input` (OSC 7501 `state=blocked`, T0621) — same badge,
 * same batch-close rule.
 */
export type AttentionHookReason = 'permission' | 'question' | 'elicitation' | 'input'
export type AttentionBlockedReason = AttentionHookReason | 'tower'

export const ATTENTION_HOOK_REASONS: readonly AttentionHookReason[] = ['permission', 'question', 'elicitation', 'input']

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
  /**
   * T0694: the tab's agent is in a turn (claude `UserPromptSubmit` → `Stop`, codex OSC 7501 `working`
   * → `idle` / `clear`, or main's quiet fallback). Present only when true; a `none` tab never has it.
   */
  busy?: true
}

export function isEmptyAttention(event: TerminalAttentionEvent | null | undefined): boolean {
  return !event || (!event.blockedReason && !(event.pendingQuestions > 0) && event.busy !== true)
}

/**
 * T0694 (d2): the batch-close confirm marks a listed tab "still printing" when its last output is this
 * recent. Same value as main's `CLOSE_WORKER_IDLE_MS` (electron/close-worker.ts, the quiet a
 * `--close-worker` waits for); a renderer copy because that module is main-only
 * (electron/__tests__/agent-turn-attention.test.ts checks they are equal).
 */
export const BATCH_CLOSE_RECENT_OUTPUT_MS = 5000

/** T0694: whether a tab whose last output was at `lastActivityTime` (renderer clock) still prints at `now`. */
export function isRecentlyPrinting(lastActivityTime: number | null | undefined, now: number): boolean {
  return typeof lastActivityTime === 'number' && Number.isFinite(lastActivityTime) && now - lastActivityTime < BATCH_CLOSE_RECENT_OUTPUT_MS
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

/**
 * What a Worker's `terminal:notified` says about its tab (`markWorkerReported`):
 *   - `ask`      T0613: it carries `questionId` (`bat-notify --ask`) — main's attention shows the
 *                question; the tab keeps neither a report nor the old CT fallback
 *   - `question` T0609: old CT `T#### 提問` without `--ask` — `workerQuestion` until the next notify
 *   - `report`   anything else — `workerReport` (✓)
 * An older helper sends no `questionId`: its `--ask` notify is read by its message as before.
 */
export function workerNotifyKind(info: { message?: unknown; questionId?: unknown }): 'ask' | 'question' | 'report' {
  if (typeof info.questionId === 'string' && info.questionId !== '') return 'ask'
  return isQuestionNotifyMessage(info.message) ? 'question' : 'report'
}

export type WorkerAttention =
  | { kind: 'blocked'; reason: AttentionHookReason; since: number | null }
  | { kind: 'question'; since: number | null; pending: number; source: 'question' | 'notify' }
  | { kind: 'resumed'; message: string; reportedAt: number }
  | { kind: 'reported'; message: string; reportedAt: number }

export interface WorkerAttentionTab {
  workerReport?: { message: string; reportedAt: number }
  workerQuestion?: { message: string; askedAt: number }
}

/**
 * The badge of a Worker tab: main's state first, then its latest report. null = running.
 * T0694: `resumed` = this window saw a turn start after the tab's latest report
 * (`isWorkerResumedAfterReport`, src/stores/terminal-attention-store.ts); only a reported tab can be.
 */
export function workerAttention(tab: WorkerAttentionTab, attention: TerminalAttentionEvent | null | undefined, resumed = false): WorkerAttention | null {
  const waiting = waitingForUser(attention)
  if (waiting) return { kind: 'blocked', reason: waiting.reason, since: waiting.since }
  if (attention && (attention.blockedReason === 'tower' || attention.pendingQuestions > 0)) {
    const since = attention.blockedReason === 'tower' ? attention.blockedSince : attention.questionsSince
    return { kind: 'question', since: since ?? null, pending: attention.pendingQuestions, source: 'question' }
  }
  if (tab.workerQuestion) return { kind: 'question', since: tab.workerQuestion.askedAt, pending: 0, source: 'notify' }
  if (tab.workerReport) return { kind: resumed ? 'resumed' : 'reported', message: tab.workerReport.message, reportedAt: tab.workerReport.reportedAt }
  return null
}

/** T0735: what a tab waits for the user on (⚠️), and since when (ms epoch; null = unknown). */
export interface WaitingForUser {
  reason: AttentionHookReason
  since: number | null
}

/**
 * T0735 (D200 ①): whether a tab — any tab, Worker or not — waits for the user: a claude hook reason
 * (permission / question / elicitation) or codex's `input`. The same rule as the Worker ⚠️
 * (`workerAttention`'s first branch). Waiting for the Tower (`tower`, pending questions) is not.
 */
export function waitingForUser(attention: TerminalAttentionEvent | null | undefined): WaitingForUser | null {
  if (!attention || !isHookReason(attention.blockedReason)) return null
  const since = attention.blockedSince
  return { reason: attention.blockedReason, since: typeof since === 'number' && Number.isFinite(since) ? since : null }
}

export function isWaitingForUser(attention: TerminalAttentionEvent | null | undefined): boolean {
  return waitingForUser(attention) !== null
}

/** T0735: the fields of a tab the workspace list needs (`TerminalInstance` fits). */
export interface WaitingTabSource {
  id: string
  workspaceId: string
  title: string
}

export interface WaitingTab extends WaitingForUser {
  id: string
  title: string
}

/** T0735 (D200 ⑤): longest waiting first — earliest `since`; an unknown `since` last. Stable for ties. */
export function compareWaitingTabs(a: WaitingForUser, b: WaitingForUser): number {
  if (a.since === b.since) return 0
  if (a.since === null) return 1
  if (b.since === null) return -1
  return a.since - b.since
}

/**
 * T0735 (D200 ②③): the tabs of `workspaceId` that wait for the user, longest waiting first
 * (`compareWaitingTabs`; ties keep the tab order). Empty = no ⚠️ on the workspace.
 */
export function workspaceWaitingTabs(
  terminals: readonly WaitingTabSource[],
  workspaceId: string,
  getAttention: (id: string) => TerminalAttentionEvent | null | undefined,
): WaitingTab[] {
  const waiting: WaitingTab[] = []
  for (const terminal of terminals) {
    if (terminal.workspaceId !== workspaceId) continue
    const state = waitingForUser(getAttention(terminal.id))
    if (state) waiting.push({ id: terminal.id, title: terminal.title, ...state })
  }
  return waiting.sort(compareWaitingTabs)
}

/** T0735 (D200 ⑤): the tab a click on the workspace ⚠️ goes to; null = none waits. */
export function oldestWaitingTab(waiting: readonly WaitingTab[]): WaitingTab | null {
  return waiting.length === 0 ? null : [...waiting].sort(compareWaitingTabs)[0]
}

/** T0735 (D202): the fields of a workspace the summary needs (`Workspace` fits). */
export interface WaitingWorkspaceSource {
  id: string
  name: string
  alias?: string
}

export interface WaitingWorkspace {
  workspaceId: string
  /** `alias || name`, as the workspace list shows it. */
  name: string
  /** Longest waiting first (`workspaceWaitingTabs`). */
  tabs: WaitingTab[]
  /** D203: tabs whose wait ended unseen, earliest wait first (`workspaceMissedTabs`). */
  missed: MissedTab[]
}

export interface WaitingSummary {
  /** Waiting tabs over all `workspaces` (D203 ④: the number shows these only). */
  total: number
  /** D203: tabs whose wait ended unseen, over all `workspaces`. */
  missedTotal: number
  /** Only the workspaces with a waiting or a missed tab, in the order given. */
  workspaces: WaitingWorkspace[]
}

/**
 * T0735 (D200 / D202): the one summary every "waits for the user" ⚠️ outside a thumbnail reads —
 * a workspace row (its own entry), the 工作區 tab title and the collapsed sidebar (`total`). Only
 * the workspaces passed count (the window passes the ones its list shows).
 */
export function waitingSummary(
  terminals: readonly WaitingTabSource[],
  workspaces: readonly WaitingWorkspaceSource[],
  getAttention: (id: string) => TerminalAttentionEvent | null | undefined,
  getMissed: (id: string) => MissedWait | null | undefined = () => null,
): WaitingSummary {
  const result: WaitingWorkspace[] = []
  let total = 0
  let missedTotal = 0
  for (const workspace of workspaces) {
    const tabs = workspaceWaitingTabs(terminals, workspace.id, getAttention)
    const missed = workspaceMissedTabs(terminals, workspace.id, getAttention, getMissed)
    if (tabs.length === 0 && missed.length === 0) continue
    total += tabs.length
    missedTotal += missed.length
    result.push({ workspaceId: workspace.id, name: workspace.alias || workspace.name, tabs, missed })
  }
  return { total, missedTotal, workspaces: result }
}

/**
 * T0735 (D203 ④): what a workspace row / the 工作區 tab / the collapsed bar shows — a solid ⚠️
 * (with the waiting count) when any tab waits, otherwise a faded ⚠️ (no count) when any wait was
 * missed, otherwise nothing.
 */
export type WaitingMarkKind = 'waiting' | 'missed' | null

export function waitingMarkKind(waiting: number, missed: number): WaitingMarkKind {
  if (waiting > 0) return 'waiting'
  return missed > 0 ? 'missed' : null
}

/**
 * T0735 (D203 ④): the tab a click on a workspace's ⚠️ goes to: the tab waiting longest; with
 * nothing waiting, the missed tab whose wait started first.
 */
export function waitingClickTarget(workspace: Pick<WaitingWorkspace, 'tabs' | 'missed'>): { id: string; title: string } | null {
  return oldestWaitingTab(workspace.tabs) ?? workspace.missed[0] ?? null
}

/**
 * T0735 (D203): a wait that ended while its tab was not being looked at. `startedAt` is the
 * renderer's clock when this window saw the wait begin (never main's / a remote host's time).
 * Renderer memory only (src/stores/terminal-attention-store.ts).
 */
export interface MissedWait {
  reason: AttentionHookReason
  startedAt: number
}

export interface MissedTab extends MissedWait {
  id: string
  title: string
}

/**
 * T0735 (D203 ②③): a tab's wait memory after its state changes from `prev` to `next`.
 *   - a wait starts (no hook reason → one): remember when (`now`), drop an older miss (solid again)
 *   - a wait ends (hook reason → none) while `viewed`: forget it
 *   - a wait ends unseen: it becomes a miss (`startedAt` = when it began)
 *   - otherwise (still waiting, reason changed, never waited): unchanged
 * `viewed` = the tab is the active tab and the window has focus (`isViewedTerminal`).
 */
export interface WaitMemory {
  /** Renderer time the current wait began; null = not waiting (or its start was not seen). */
  startedAt: number | null
  missed: MissedWait | null
}

export function nextWaitMemory(
  memory: WaitMemory,
  prev: TerminalAttentionEvent | null | undefined,
  next: TerminalAttentionEvent | null | undefined,
  viewed: boolean,
  now: number,
): WaitMemory {
  const was = waitingForUser(prev)
  const is = waitingForUser(next)
  if (is && !was) return { startedAt: now, missed: null }
  if (is) return memory.startedAt === null ? { startedAt: now, missed: null } : memory
  if (!was) return memory
  if (viewed || memory.startedAt === null) return { startedAt: null, missed: null }
  return { startedAt: null, missed: { reason: was.reason, startedAt: memory.startedAt } }
}

/** T0735 (D203 ③): the tab the user looks at — the active tab while the window has focus. */
export function isViewedTerminal(id: string, activeTerminalId: string | null | undefined, windowFocused: boolean): boolean {
  return windowFocused && !!activeTerminalId && activeTerminalId === id
}

/** T0735 (D203): a missed wait to show — only while the tab does not wait again. */
export function missedWaitToShow(attention: TerminalAttentionEvent | null | undefined, missed: MissedWait | null | undefined): MissedWait | null {
  return missed && !isWaitingForUser(attention) ? missed : null
}

/** T0735 (D203): the missed tabs of `workspaceId`, earliest wait first (ties keep the tab order). */
export function workspaceMissedTabs(
  terminals: readonly WaitingTabSource[],
  workspaceId: string,
  getAttention: (id: string) => TerminalAttentionEvent | null | undefined,
  getMissed: (id: string) => MissedWait | null | undefined,
): MissedTab[] {
  const missed: MissedTab[] = []
  for (const terminal of terminals) {
    if (terminal.workspaceId !== workspaceId) continue
    const miss = missedWaitToShow(getAttention(terminal.id), getMissed(terminal.id))
    if (miss) missed.push({ id: terminal.id, title: terminal.title, ...miss })
  }
  return missed.sort((a, b) => a.startedAt - b.startedAt)
}
