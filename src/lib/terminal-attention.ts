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

/**
 * T0749 (BUG-182): one tab of a `terminal:attention-snapshot` answer (electron/terminal-attention.ts)
 * — the host's state now, which a remote window applies after it connects again.
 */
export interface TerminalAttentionSnapshotEntry {
  id: string
  /** The tab's PTY runs on the host now. */
  alive: boolean
  /** Its attention now (an empty one = nothing to show); null when `alive` is false. */
  attention: TerminalAttentionEvent | null
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

/**
 * T0762 (D200 / D203 for the Claude Agent panel): the cards a panel shows that wait for the user.
 * The panel runs the SDK in the host process, not in a PTY, so main never pushes
 * `terminal:attention-changed` for it; the panel (src/components/ClaudeAgentPanel.tsx) tells the
 * renderer store instead (`setPanelWaiting`, src/stores/terminal-attention-store.ts), and the store
 * hands every reader the same `TerminalAttentionEvent` shape (`panelAttentionEvent` /
 * `pickTerminalAttention`), so the thumbnail ⚠️, the workspace list, the D203 faded ⚠️ and a detached
 * window's report all go through `waitingForUser` / `waitingSummary` / `nextWaitMemory` unchanged.
 *   - `permission` — the tool permission card (`claude:permission-request`, ExitPlanMode included)
 *   - `question`   — the AskUserQuestion card (`claude:ask-user`)
 *   - `turnEnded`  — the query failed or was stopped (error / stop / interrupt / abort) after the
 *                    latest request: a card still on screen no longer waits for the user. A `result`
 *                    does not count: a background sub-agent (T0759) can still ask after its main
 *                    turn's result, and an answered card is gone anyway.
 */
export interface ClaudePanelCards {
  permission: boolean
  question: boolean
  turnEnded: boolean
}

/** T0762: what a Claude Agent panel waits for the user on now (the permission card first); null = nothing. */
export function claudePanelWaitingReason(cards: ClaudePanelCards): AttentionHookReason | null {
  if (cards.turnEnded) return null
  if (cards.permission) return 'permission'
  return cards.question ? 'question' : null
}

/** T0762: several panels of one tab (a pinned pane renders a second one): `permission` over `question`. */
export function combinePanelWaitingReasons(reasons: Iterable<AttentionHookReason | null | undefined>): AttentionHookReason | null {
  let result: AttentionHookReason | null = null
  for (const reason of reasons) {
    if (reason === 'permission') return 'permission'
    if (reason && !result) result = reason
  }
  return result
}

/** T0762: the attention a waiting panel stands for (`since` = renderer time the wait began). */
export function panelAttentionEvent(id: string, reason: AttentionHookReason, since: number): TerminalAttentionEvent {
  return { id, blockedReason: reason, blockedSince: since, pendingQuestions: 0 }
}

/**
 * T0762: the attention a reader gets for a tab — main's (`pty`) while it waits for the user, otherwise
 * the panel's while that waits, otherwise main's. A Claude Agent panel tab has no PTY, so in practice
 * one of the two is null; returns one of the given objects (stable for `useSyncExternalStore`).
 */
export function pickTerminalAttention(
  pty: TerminalAttentionEvent | null | undefined,
  panel: TerminalAttentionEvent | null | undefined,
): TerminalAttentionEvent | null {
  if (isWaitingForUser(pty)) return pty ?? null
  return panel ?? pty ?? null
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
  /** T0761: the workspace is in a detached window (its parent shows that window's report). */
  detached?: boolean
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

/**
 * T0774 (BUG-193, D216): a click on an unfocused window gives it the focus first and switches tabs only
 * on its `click`. T0774 measured (Electron 41.2.1 / Chromium 146, Windows; Playwright CDP click and a real
 * OS click through user32 SendInput): `window.focus` → `pointerdown` about 1.6 ms later → (the button
 * held) → `pointerup` / `mouseup` / `click` → the active tab changes. So when the window gets the focus
 * back, the tab active at that moment is not counted as looked at yet (its faded ⚠️ stays):
 *   - no `pointerdown` within `FOCUS_REGAIN_POINTER_GRACE_MS` (Alt+Tab, `focus()`) → judged then (D203)
 *   - a `pointerdown` → judged `FOCUS_REGAIN_CLICK_SETTLE_MS` after its `pointerup` / `pointercancel`
 *     (the click and what it switches to — some handlers switch a tick later — are handled by then)
 *   - a button held longer than `FOCUS_REGAIN_MAX_HOLD_MS` (a drag that never ends) → judged then
 * Waits that end meanwhile count the window as focused (no faded ⚠️ flashes up and goes); only the
 * clearing of the held tab's older faded ⚠️ waits. Gate: `createFocusRegainGate` (terminal-attention-store).
 */
/** 60× the measured focus → pointerdown gap; also the delay before an Alt+Tab clears the held tab. */
export const FOCUS_REGAIN_POINTER_GRACE_MS = 100
/** After the regain click's pointerup: covers its click handler and a tab switch deferred by a tick. */
export const FOCUS_REGAIN_CLICK_SETTLE_MS = 50
/** A press that never ends (pointer lost): stop holding after this long. */
export const FOCUS_REGAIN_MAX_HOLD_MS = 10_000

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

/**
 * T0761 (D200 ⑥ / D212): a detached window's ⚠️ in its parent main window. The parent's list hides
 * a detached workspace and does not know the tabs opened in its detached window; the user looks at
 * those tabs (D203 "viewed") only there. So the detached window sums its own workspace (the same
 * `waitingSummary`, with its own miss memory) and sends this report through main
 * (`workspace:detached-waiting`, local IPC) to its parent, which only shows it: a row for the
 * workspace while it has a waiting or missed tab, counted in the 工作區 tab title and the collapsed
 * bar too. Tab titles and reasons only — never a question's text (D155).
 */
export interface DetachedWaitingReport {
  /** Longest waiting first. */
  tabs: WaitingTab[]
  /** Earliest wait first. `startedAt` is the detached window's clock (same machine as its parent). */
  missed: MissedTab[]
}

/** T0761: a report carries at most this many tabs per list (one workspace's tabs). */
export const DETACHED_WAITING_MAX_TABS = 64
/** T0761: id / title length a report keeps (longer titles are cut, longer ids drop the tab). */
export const DETACHED_WAITING_MAX_ID = 200
export const DETACHED_WAITING_MAX_TITLE = 200

/** T0761: what the detached window sends for its workspace's summary entry (none = empty). */
export function detachedWaitingReport(entry: Pick<WaitingWorkspace, 'tabs' | 'missed'> | null | undefined): DetachedWaitingReport {
  return { tabs: entry ? [...entry.tabs] : [], missed: entry ? [...entry.missed] : [] }
}

/** T0761: a report is empty = the parent shows nothing for the workspace. */
export function isEmptyDetachedWaitingReport(report: DetachedWaitingReport | null | undefined): boolean {
  return !report || (report.tabs.length === 0 && report.missed.length === 0)
}

function finiteOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function cleanTabBase(value: unknown): { id: string; title: string; reason: AttentionHookReason } | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Record<string, unknown>
  if (typeof raw.id !== 'string' || !raw.id || raw.id.length > DETACHED_WAITING_MAX_ID) return null
  if (!isHookReason(raw.reason)) return null
  const title = typeof raw.title === 'string' ? raw.title.slice(0, DETACHED_WAITING_MAX_TITLE) : ''
  return { id: raw.id, title, reason: raw.reason }
}

/**
 * T0761: the report as received (main from the detached window, the parent from main) — only the
 * fields above, hook reasons only, at most `DETACHED_WAITING_MAX_TABS` per list. Not an object with
 * two arrays → null (ignored).
 */
export function sanitizeDetachedWaitingReport(value: unknown): DetachedWaitingReport | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Record<string, unknown>
  if (!Array.isArray(raw.tabs) || !Array.isArray(raw.missed)) return null
  const tabs: WaitingTab[] = []
  for (const item of raw.tabs.slice(0, DETACHED_WAITING_MAX_TABS)) {
    const base = cleanTabBase(item)
    if (base) tabs.push({ ...base, since: finiteOrNull((item as Record<string, unknown>).since) })
  }
  const missed: MissedTab[] = []
  for (const item of raw.missed.slice(0, DETACHED_WAITING_MAX_TABS)) {
    const base = cleanTabBase(item)
    const startedAt = base ? finiteOrNull((item as Record<string, unknown>).startedAt) : null
    if (base && startedAt !== null) missed.push({ ...base, startedAt })
  }
  return { tabs: tabs.sort(compareWaitingTabs), missed: missed.sort((a, b) => a.startedAt - b.startedAt) }
}

/**
 * T0761: the summary entries of the parent's detached workspaces (in the order given) whose report
 * has a waiting or missed tab; `detached: true` marks them for the tooltip and the row.
 */
export function detachedWaitingWorkspaces(
  workspaces: readonly WaitingWorkspaceSource[],
  getReport: (workspaceId: string) => DetachedWaitingReport | null | undefined,
): WaitingWorkspace[] {
  const result: WaitingWorkspace[] = []
  for (const workspace of workspaces) {
    const report = getReport(workspace.id)
    if (!report || isEmptyDetachedWaitingReport(report)) continue
    result.push({ workspaceId: workspace.id, name: workspace.alias || workspace.name, tabs: report.tabs, missed: report.missed, detached: true })
  }
  return result
}

/** T0761: `summary` (the listed workspaces) plus the detached ones after them; the totals add up. */
export function mergeWaitingSummary(summary: WaitingSummary, detached: readonly WaitingWorkspace[]): WaitingSummary {
  if (detached.length === 0) return summary
  let total = summary.total
  let missedTotal = summary.missedTotal
  for (const entry of detached) {
    total += entry.tabs.length
    missedTotal += entry.missed.length
  }
  return { total, missedTotal, workspaces: [...summary.workspaces, ...detached] }
}
