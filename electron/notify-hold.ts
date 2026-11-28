/**
 * T0788 / BUG-196 (D227): while a tab waits for the user — a claude permission prompt,
 * AskUserQuestion, an MCP elicitation (hook reasons `permission` / `question` / `elicitation`) or a
 * codex approval (OSC 7501 `input`) — the text and the Enter a helper sends into it
 * (`bat-notify --submit`: `pty:write` + `terminal:keypress`) are held here, not written. The Enter
 * used to answer the prompt for the user (T0787: 30 / 30 — "1. Yes", the first option); the text
 * alone was swallowed by the prompt.
 *
 * Contract (T0787 契約草案 v0, D227; items 5 / 9 / 10 are the Tower's interim values):
 *
 *   1. Held: a `pty:write` / `terminal:keypress` that came in with a helper capability
 *      (`ctx.helper`, i.e. over RemoteServer), to a tab whose `TerminalBlockedTracker` state is a
 *      hook / osc reason. `tower` (a Worker waiting for its Tower) never holds. A tab with
 *      `blockedDetection: none` is not held (BAT cannot tell), logged `skipped (detection none)`.
 *      While a tab has held items, every later helper write to it queues behind them (order kept).
 *   2. One item: a `pty:write`, plus the `terminal:keypress` of the same connection to the same tab
 *      within `NOTIFY_HOLD_PAIR_WINDOW_MS` (bat-notify waits 250 ms between them). A lone write
 *      (pre-fill) or a lone keypress is an item of its own.
 *   3. Held → `{ ok: true, held: true }`; bat-notify only checks `ok === false`, so its exit code
 *      and stdout do not change.
 *   4. Sent: once the tab left the hook / osc `blocked` and stayed quiet `NOTIFY_HOLD_QUIET_MS`
 *      (no user input, no new `blocked`), in order — text, `NOTIFY_HOLD_ENTER_DELAY_MS`, Enter (the
 *      `terminal:keypress` event: the window's xterm makes it, as before). `blocked` is checked
 *      again before every step.
 *   5. At most `NOTIFY_HOLD_MAX_PER_TARGET` items per tab (one more → `{ ok: false, reason:
 *      'held-full' }`, bat-notify exit 1; under `--ask` it cancels the question first). The Enter of
 *      a held write joins it and never counts as one more. Renew #1 (D228): no expiry — dropping it
 *      would lose a notify silently (the helper got `ok`), sending it would bring BUG-196 back.
 *   6. The windows show "N held" and cancel one or all (`list` / `cancel`, renderer IPC only);
 *      cancelling drops the PTY write only (toast, Worker ✓ unchanged).
 *   7. The PTY ending (exit / kill, so ⏻ restart), the Terminal Server recovery drop everything;
 *      nothing is persisted.
 *   8. Logs `[notify-hold] held|sent|cancelled|dropped terminal=<id> source=<id>
 *      reason=<r> len=<n>` — 🔴 never the text.
 *
 * Items 9 (the submit Enter is not user input: the renderer writes it `{ auto: true }`,
 * src/components/TerminalPanel.tsx) and 10 (no `--report-hold`) live outside this file.
 *
 * PLAN-068 W2 / T0904 (T0902 §2.4, R2′; GitHub #23 / #24) — only for a Tower tab that declared the
 * BAT ↔ CT contract 2 (`towerContractStatus` `match`, src/lib/tower-contract.ts); every other tab
 * behaves exactly as above (R9′):
 *
 *   - `draft`: the user's unsent text in the input box (S1, src/lib/tower-input-draft.ts, fed by
 *     `onUserInput`) holds helper notifications and answers. Released by the user's Enter / Ctrl+C and
 *     `NOTIFY_HOLD_QUIET_MS` quiet, or「立即送出」(`sendNow`). No time limit; after
 *     `NOTIFY_HOLD_DRAFT_REMIND_MS` the windows are told once (`emitReminder`, a system notification).
 *   - `reading`: the window reports the user reads the tab (`setReading`, proxied
 *     `terminal:reading-state`); holds helper notifications only (🔴 never an answer), at most
 *     `NOTIFY_HOLD_READING_MAX_MS` per queue.
 *   - atomic send: every helper notification goes through here — written at once when nothing holds
 *     it (pass-through) — and from its text until the submit Enter reaches the PTY (the window's
 *     `{ auto: true }` / `{ submit: true }` `\r`, at most `NOTIFY_HOLD_ATOMIC_MAX_MS`), the user's input
 *     to that tab is kept here and written right after it (`holdUserWrite` / `afterSubmitWrite`).
 *   - answers (`enqueueAnswer`, the inbox of W5): held by a prompt and by `draft`, not by `reading`;
 *     their Enter is the user's input (`userInput` on the keypress → the window writes `{ submit }`).
 *   - the T0788 reasons hold every tab, as before; 8 items per tab and no expiry still apply.
 *
 * T0940 / BUG-227 (D406) — keys that never stay in the input box do not make a `draft`:
 *   - 案 A: one key that came while a hook / osc prompt was shown (`onUserInput` `duringPrompt`,
 *     taken by electron/handlers/pty.ts before `noteUserInput` clears the hook reason) leaves the
 *     draft as it was (`trackDraftDuringPrompt`); a paste / several characters as before.
 *   - 案 B: claude's single-key survey seen in a contract-2 Tower's output (`onPtyOutput`, read only,
 *     `SingleKeyPromptScanner`) and answered by exactly one of its keys (`answersSingleKeyPrompt`).
 *     Every other write to the tab (the user's, a helper's, an answer, BAT's own, a mouse press)
 *     forgets the survey first.
 *
 * T0965 / BUG-236 (U-59：A) — an inbox answer never goes into claude's AskUserQuestion menu: a contract-2
 * Tower's answer is held while the tab is `question` or its menu may still be open (`hasOpenQuestionMenu`:
 * the user's input / a mouse press cleared `question`, the menu stayed — the reported case). Then, with
 * no draft, no user input / mouse press for `NOTIFY_HOLD_MENU_INPUT_QUIET_MS` and no PTY output for
 * `NOTIFY_HOLD_MENU_OUTPUT_QUIET_MS`, BAT writes one Esc (not user input) to close the menu; the PTY
 * output that follows says claude closed it (`closeQuestionMenu`), and after `NOTIFY_HOLD_QUIET_MS` the
 * answer goes as before. No output within `NOTIFY_HOLD_MENU_ESC_MAX_MS` → the answer stays held (never a
 * second Esc for it), logged. 🔴 Answers only: Worker notifications, `permission` / `elicitation` / codex
 * `input` and every other tab hold exactly as before. 「立即送出」releases a held answer only when the tab is
 * not `question` (the menu record alone may be stale). Logs `[notify-hold] menu esc …` (ids only).
 *
 * T0968 (CT 6.4.0-pre.1 `menu_open`, D492) — which answer may close the menu:
 *   - the window sends the Tower's `menu_open` with the answer (`tower-inbox:answer`'s optional `menu`,
 *     only when CT declares `inbox_features: menu`; `null` = CT declares it and no menu holds a `U-n`).
 *   - with that information, BAT writes the Esc only when one of the answer's `U-n` is in `menu.ids` and
 *     `opened_at` belongs to the menu record now open (`menuEscDecision`: from
 *     `NOTIFY_HOLD_MENU_OPENED_BEFORE_MS` before the record began to `NOTIFY_HOLD_MENU_OPENED_AFTER_MS` after
 *     it). Otherwise (an `A-n`, a `U-n` not in the menu, no `menu_open`, a `menu_open` left from an earlier
 *     menu) no Esc: the answer is held until the menu closes, logged `menu esc skipped … (<why>)` once.
 *   - without it (CT before 6.4.0, an older window, a malformed `menu`): exactly T0965.
 *   - a contract-2 Tower's Worker notifications are held by the menu record too (not only by `question`;
 *     never an Esc), whatever the CT version; sent by the T0788 rules once the record closes.
 *
 * PLAN-068 W5 / T0908: the windows' channels are registered here for both hosts and proxied
 * (`registerNotifyHoldHandlers`: `terminal:notify-hold-list` / `-cancel` / `-send-now`;
 * `registerTowerInboxAnswerHandler`: `tower-inbox:answer`), so a remote window sees and drives its
 * bat-server's queue. 🔴 None of them is a helper channel.
 *
 * Only reads `TerminalBlockedTracker` (through PtyManager); never changes how it decides.
 * Details: docs/agent-guide/notify-hold.md, docs/agent-guide/tower-inbox.md.
 *
 * 🔴 No `electron` import here (Electron main and headless bat-server share it).
 */
import type {
  NotifyHoldChangedEvent,
  NotifyHoldItem,
  NotifyHoldReason,
  NotifyHoldReminderEvent,
  TowerInboxAnswerResult,
} from '../src/types/notify-hold'
import { towerContractStatus } from '../src/lib/tower-contract'
import { checkInboxAnswer, checkInboxMenuInfo, inboxAnswerIds, inboxAnswerLogIds, parseCtTime, type InboxMenuInfo } from '../src/lib/tower-inbox'
import {
  NO_DRAFT,
  SingleKeyPromptScanner,
  answersSingleKeyPrompt,
  draftCause,
  trackDraft,
  trackDraftDuringPrompt,
  type DraftState,
} from '../src/lib/tower-input-draft'
import type { BlockedDetection, BlockedState } from './terminal-blocked-state'
import type { HandlerContext } from './remote/handler-registry'

/** Items held per tab at most; one more is refused (`held-full`). */
export const NOTIFY_HOLD_MAX_PER_TARGET = 8
/** After the tab left `blocked`, this long without user input / a new `blocked` before sending. */
export const NOTIFY_HOLD_QUIET_MS = 1_000
/** A `terminal:keypress` this soon after a held `pty:write` (same connection, same tab) joins it. */
export const NOTIFY_HOLD_PAIR_WINDOW_MS = 2_000
/** Between the text and its Enter, and between two items (bat-notify's `SUBMIT_KEYPRESS_DELAY_MS`). */
export const NOTIFY_HOLD_ENTER_DELAY_MS = 250
/** T0904: `reading` delays a queue at most this long (then it is sent while the user still reads). */
export const NOTIFY_HOLD_READING_MAX_MS = 60_000
/** T0904: a queue held by `draft` this long → the windows are told once (a system notification). */
export const NOTIFY_HOLD_DRAFT_REMIND_MS = 5 * 60_000
/** T0904: the user's input is kept at most this long after a notification's text, waiting for its Enter. */
export const NOTIFY_HOLD_ATOMIC_MAX_MS = 1_000
/** T0904: an inbox answer (W5) is one line of at most this many characters. */
export const NOTIFY_HOLD_ANSWER_MAX_CHARS = 1_000
/**
 * T0964 / BUG-235: claude's `user-prompt-submit` clears a contract-2 Tower's draft only when the user sent
 * nothing to the tab this long before the hook arrived (the hook comes 100–150 ms after claude took the
 * input box; what the user typed after that must stay a draft).
 */
export const NOTIFY_HOLD_SUBMIT_QUIET_MS = 300
/** T0964: …nor an Enter of the user's this long before it (that Enter itself submitted; what follows is new). */
export const NOTIFY_HOLD_SUBMIT_ENTER_GUARD_MS = 2_000
/**
 * T0965 / BUG-236: after BAT's Esc to an AskUserQuestion menu, the PTY must answer (claude redraws) within
 * this long; otherwise the answer stays held (the menu may still be open — its text never goes into it).
 */
export const NOTIFY_HOLD_MENU_ESC_MAX_MS = 3_000
/** T0965: no Esc while the user typed / clicked in the tab this recently (they may be answering in the menu). */
export const NOTIFY_HOLD_MENU_INPUT_QUIET_MS = 2_000
/** T0965: no Esc while the PTY wrote output this recently (an open menu is quiet; a working claude is not). */
export const NOTIFY_HOLD_MENU_OUTPUT_QUIET_MS = 1_000
/** T0965: what BAT writes to close the menu. */
const MENU_ESC = '\x1b'
/**
 * T0968: CT's `menu_open.opened_at` still belongs to the menu record that began this long after it. CT takes
 * the time, writes `_tower-state.md`, then the model writes the AskUserQuestion call and its PreToolUse hook
 * reaches BAT: seconds, up to about a minute for a long question (or a permission prompt for the write in a
 * non-yolo Tower). Older → a `menu_open` left from an earlier menu (CT stopped before its next write) — no Esc.
 * Erring this way only keeps the answer until the user closes the menu; erring the other way would close a
 * menu the answer is not for.
 */
export const NOTIFY_HOLD_MENU_OPENED_BEFORE_MS = 5 * 60_000
/**
 * T0968: …and at most this long before it (`opened_at` has whole seconds and comes from the same host's
 * clock; a later one was written after this menu opened, so it is not this menu's).
 */
export const NOTIFY_HOLD_MENU_OPENED_AFTER_MS = 5_000

/** T0968: why an answer may (`esc`) or may not close the open menu (`menuEscDecision`). */
export type MenuEscDecision = 'esc' | 'no-menu-open' | 'not-in-menu' | 'no-record' | 'stale' | 'not-this-menu'

/**
 * T0968: whether BAT may write the Esc for answer `text`. `menu` undefined = no information (T0965: `esc`);
 * `null` = CT declares `menu` and wrote no `menu_open`; else the answer's `U-n` (one of a batch line's is
 * enough) must be in `menu.ids` and `menu.openedAt` within [record − BEFORE, record + AFTER] of the record's
 * start `recordOpenedAt` (ms epoch, same clock as CT's time on this host; null = no record).
 */
export function menuEscDecision(menu: InboxMenuInfo | undefined, text: string, recordOpenedAt: number | null): MenuEscDecision {
  if (menu === undefined) return 'esc'
  if (menu === null) return 'no-menu-open'
  const ids = inboxAnswerIds(text).filter(id => id.startsWith('U-'))
  if (!ids.some(id => menu.ids.includes(id))) return 'not-in-menu'
  if (recordOpenedAt === null) return 'no-record'
  const openedAt = parseCtTime(menu.openedAt)
  if (openedAt === null || openedAt < recordOpenedAt - NOTIFY_HOLD_MENU_OPENED_BEFORE_MS) return 'stale'
  if (openedAt > recordOpenedAt + NOTIFY_HOLD_MENU_OPENED_AFTER_MS) return 'not-this-menu'
  return 'esc'
}

/** The `blocked` reasons that hold (a prompt in the tab waits for a key). */
export const NOTIFY_HOLD_REASONS: readonly string[] = ['permission', 'question', 'elicitation', 'input']

export const NOTIFY_HOLD_CHANGED_CHANNEL = 'terminal:notify-hold-changed'
/** T0904: once per draft-held queue after `NOTIFY_HOLD_DRAFT_REMIND_MS` (`NotifyHoldReminderEvent`). */
export const NOTIFY_HOLD_REMINDER_CHANNEL = 'terminal:notify-hold-reminder'

/** A work order id as accepted from `terminal:keypress` `source` (shown in the list, logged). */
const WORKORDER_PATTERN = /^[A-Za-z0-9._-]{1,64}$/

/** The `terminal:keypress` event payload (electron/handlers/terminal.ts builds the same). */
export interface NotifyHoldKeypress {
  targetId: string
  key: 'Enter'
  code: 'Enter'
  keyCode: 13
  source?: string
  reason?: string
  traceId?: string
  /** T0904: the Enter of an inbox answer — the user's input (the window writes it `{ submit: true }`). */
  userInput?: true
}

/** What the controller needs from PtyManager (the class satisfies it). */
export interface NotifyHoldPtyManager {
  isAlive(id: string): boolean
  getBlockedState(id: string): BlockedState | null
  getBlockedDetection(id: string): BlockedDetection
  writeWithResult(id: string, data: string): { ok: boolean; reason?: string }
  getWorkorder?(id: string): string | undefined
  /** T0904: the declared role / BAT ↔ CT contract (W0, T0903); absent = never a contract-2 Tower. */
  getTerminalRole?(id: string): string | undefined
  getTowerContract?(id: string): number | undefined
  /**
   * T0965 / BUG-236: the AskUserQuestion menu of tab `id` may still be open (also after `question` was
   * cleared by the user's input / a mouse press). Absent = never (no Esc, nothing more held).
   */
  hasOpenQuestionMenu?(id: string): boolean
  /** T0965: BAT's Esc closed the menu (the tracker drops it and a `question` still set). Absent = no Esc is sent. */
  closeQuestionMenu?(id: string, cause: string): boolean
  /** T0968: ms epoch (the wall clock) the menu record of tab `id` began, or null. Absent = unknown (`no-record`). */
  getQuestionMenuOpenedAt?(id: string): number | null
  /** T0965: ms epoch of tab `id`'s last output (`now`'s clock), or null. Absent = unknown (quiet). */
  getLastOutputAt?(id: string): number | null
}

export interface NotifyHoldDeps {
  getPtyManager(): NotifyHoldPtyManager | null
  /** Sends the held Enter (the `terminal:keypress` event); false = nobody can make it (headless, no client). */
  emitKeypress(payload: NotifyHoldKeypress): boolean
  /** The windows' "N held" (`terminal:notify-hold-changed`). Absent: nobody shows it. */
  emitChanged?(event: NotifyHoldChangedEvent): void
  /** T0904: a queue waited `NOTIFY_HOLD_DRAFT_REMIND_MS` for the user's draft. Absent: nobody is told. */
  emitReminder?(event: NotifyHoldReminderEvent): void
  logger: { log(message: string): void }
  mirrorToBatScripts?(event: string, payload: Record<string, unknown>): void
  /** Tests. Default `Date.now`. */
  now?(): number
  /** T0964: the clock of the submit windows. Default `now` when given (tests), else `performance.now()`. */
  monotonicNow?(): number
  /** Tests. Default `setTimeout` (unref'd) / `clearTimeout`. */
  setTimer?(fn: () => void, ms: number): unknown
  clearTimer?(handle: unknown): void
}

interface HeldItem {
  holdId: string
  targetId: string
  connectionId: string | null
  sourceTerminalId?: string
  workorder?: string
  heldAt: number
  /** The `blocked` reason when it was held (`queued` = held behind earlier items). */
  reason: string
  text?: string
  /** ms epoch the text came in (the pair window counts from it). */
  textAt?: number
  enter?: NotifyHoldKeypress
  /** T0904: an inbox answer (W5). */
  kind: 'notify' | 'answer'
  /** T0904: its text went out; only a prompt may still hold its Enter. */
  textSent?: boolean
  /** T0904:「立即送出」— `draft` / `reading` no longer hold it. */
  forced?: boolean
  /** T0968: an answer's `menu` from the window (`menuEscDecision`); undefined = none sent (T0965). */
  menu?: InboxMenuInfo
}

interface TargetQueue {
  items: HeldItem[]
  quietTimer: unknown
  sending: boolean
  /** T0904: ms epoch `reading` began to hold this queue (null = it has not). */
  readingSince: number | null
  readingCapTimer: unknown
  /** T0904: the draft reminder of this queue (armed / sent). */
  remindTimer: unknown
  reminded: boolean
  /** T0904: the reason last told to the windows. */
  lastReason: NotifyHoldReason | null
  /** T0965: the Esc BAT wrote for the head answer (one per answer), or null. */
  menuEsc: MenuEsc | null
  /** T0965: waits for the input / output quiet before the Esc. */
  menuTimer: unknown
  /** T0965: the answer whose wait before the Esc was logged (once per answer). */
  menuWaitLogged: string | null
  /** T0968: the answer whose skipped Esc was logged, and why (once per answer and reason). */
  menuSkipLogged: string | null
}

/** T0965 / BUG-236: BAT's Esc to the AskUserQuestion menu, for answer `holdId`. */
interface MenuEsc {
  holdId: string
  /** `sent` = waiting for the PTY to answer; `closed` = it did; `failed` = it did not / the write failed. */
  state: 'sent' | 'closed' | 'failed'
  timer: unknown
}

/** T0904: from a notification's text until its Enter reached the PTY, the user's input waits here. */
interface AtomicWindow {
  /** The helper connection whose keypress belongs to it; null = a send of this controller. */
  connectionId: string | null
  keypressSeen: boolean
  buffered: string[]
  timer: unknown
  /** Sends of this controller waiting for it to close. */
  waiters: Array<() => void>
}

export type NotifyHoldDecision =
  | { ok: true; held: true }
  | { ok: false; reason: 'held-full' }

/** T0904: `interceptWrite` of a contract-2 Tower that nothing holds — the write's own result. */
export type NotifyHoldWriteResult = { ok: boolean; reason?: string }

export type NotifyHoldAnswerResult =
  | { ok: true; held: boolean; holdId: string }
  | { ok: false; reason: 'invalid' | 'pty-not-found' | 'not-contract-tower' | 'held-full' }

/** One line of `[notify-hold]` (no text: its length only). */
function describe(item: HeldItem): string {
  return `terminal=${item.targetId} source=${item.kind === 'answer' ? 'answer' : item.sourceTerminalId ?? 'n/a'}${item.workorder ? ` workorder=${item.workorder}` : ''}`
}

function partsOf(item: HeldItem): string {
  if (item.text !== undefined && item.enter) return 'text+enter'
  return item.enter ? 'enter' : 'text'
}

export class NotifyHoldController {
  private readonly queues = new Map<string, TargetQueue>()
  /** T0904: per tab, the S1 draft state (every tab is tracked; only contract-2 Towers use it). */
  private readonly drafts = new Map<string, DraftState>()
  /** T0904: per tab, the windows / clients that report the user reads it. */
  private readonly readers = new Map<string, Set<string>>()
  /** T0904: per tab, the open atomic window. */
  private readonly atomics = new Map<string, AtomicWindow>()
  /** T0940 案 B: per contract-2 Tower, claude's single-key survey seen in its output. */
  private readonly singleKey = new SingleKeyPromptScanner()
  /** T0964: per tab, when the user last sent anything / an Enter (`monotonicNow`). */
  private readonly lastInputAt = new Map<string, number>()
  private readonly lastEnterAt = new Map<string, number>()
  /** T0965: per tab, when the user last typed or pressed a mouse button in it (`monotonicNow`). */
  private readonly lastTouchAt = new Map<string, number>()
  private seq = 0
  private disposed = false
  private readonly now: () => number
  private readonly monotonicNow: () => number

  constructor(private readonly deps: NotifyHoldDeps) {
    this.now = deps.now ?? (() => Date.now())
    this.monotonicNow = deps.monotonicNow ?? deps.now ?? (() => performance.now())
  }

  // ── intake (electron/handlers/pty.ts, electron/handlers/terminal.ts) ──

  /**
   * A `pty:write`: null = write it now (as before); otherwise the answer to give. T0904: a helper
   * write to a contract-2 Tower that nothing holds is written here (the write's result is the answer)
   * and opens the atomic window.
   */
  interceptWrite(ctx: HandlerContext, targetId: string, data: string): NotifyHoldDecision | NotifyHoldWriteResult | null {
    if (!ctx.helper || typeof targetId !== 'string' || typeof data !== 'string') return null
    this.singleKey.drop(targetId) // T0940: a helper write ends the single-key survey record
    const hold = this.holdReason(ctx, targetId, 'pty:write', 'notify')
    if (!hold) {
      const pm = this.deps.getPtyManager()
      if (this.disposed || !pm || !pm.isAlive(targetId) || !this.isContractTower(targetId)) return null
      const result = pm.writeWithResult(targetId, data)
      if (result.ok) {
        this.openAtomic(targetId, ctx.connectionId ?? null)
        this.deps.logger.log(`[notify-hold] passed terminal=${targetId} source=${ctx.helper.terminalId ?? 'n/a'} part=text len=${data.length} (atomic)`)
      }
      return result
    }
    const queue = this.queueOf(targetId)
    if (queue.items.length >= NOTIFY_HOLD_MAX_PER_TARGET) return this.full(ctx, targetId, hold, data.length)
    const now = this.now()
    const item = this.newItem(ctx, targetId, hold, now)
    item.text = data
    item.textAt = now
    queue.items.push(item)
    this.logHeld(item, 'text', data.length)
    this.afterChange(targetId)
    return { ok: true, held: true }
  }

  /** A `terminal:keypress` (already checked to be Enter): null = send it now; otherwise the answer. */
  interceptKeypress(ctx: HandlerContext, payload: NotifyHoldKeypress): NotifyHoldDecision | null {
    if (!ctx.helper) return null
    const targetId = payload.targetId
    const connectionId = ctx.connectionId ?? null
    // T0904: the Enter of a passed-through write goes out as before (the window makes it)
    const atomic = this.atomics.get(targetId)
    if (atomic && !atomic.keypressSeen && atomic.connectionId !== null && atomic.connectionId === connectionId
      && !this.promptReason(targetId)) {
      atomic.keypressSeen = true
      return null
    }
    const queue = this.queues.get(targetId)
    const now = this.now()
    // 2. the Enter of a held write from the same connection joins it
    if (queue) {
      for (let i = queue.items.length - 1; i >= 0; i--) {
        const item = queue.items[i]
        if (item.connectionId !== connectionId || item.kind === 'answer') continue
        if (item.text === undefined || item.enter || item.textAt === undefined) break
        if (now - item.textAt > NOTIFY_HOLD_PAIR_WINDOW_MS) break
        item.enter = payload
        // the notify's own `--source` wins over the Worker tab's work order (a write carries none)
        const workorder = workorderOf(payload.source)
        if (workorder) item.workorder = workorder
        this.logHeld(item, 'enter', 0)
        this.afterChange(targetId)
        return { ok: true, held: true }
      }
    }
    const hold = this.holdReason(ctx, targetId, 'terminal:keypress', 'notify')
    if (!hold) return null
    const current = this.queueOf(targetId)
    if (current.items.length >= NOTIFY_HOLD_MAX_PER_TARGET) return this.full(ctx, targetId, hold, 0)
    const item = this.newItem(ctx, targetId, hold, now)
    item.enter = payload
    const workorder = workorderOf(payload.source)
    if (workorder) item.workorder = workorder
    current.items.push(item)
    this.logHeld(item, 'enter', 0)
    this.afterChange(targetId)
    return { ok: true, held: true }
  }

  /**
   * T0904 (T0902 §2.4, for W5): the user's answer from the inbox — one line, typed into the Tower
   * tab and submitted. Held by a prompt and by `draft` (never by `reading`), queued behind held
   * notifications; otherwise sent at once. Its Enter is the user's input. Contract-2 Towers only.
   */
  enqueueAnswer(targetId: string, text: string, opts: { connectionId?: string | null; menu?: InboxMenuInfo } = {}): NotifyHoldAnswerResult {
    if (typeof targetId !== 'string' || typeof text !== 'string' || text.length === 0
      || text.length > NOTIFY_HOLD_ANSWER_MAX_CHARS || /[\r\n]/.test(text)) {
      return { ok: false, reason: 'invalid' }
    }
    const pm = this.deps.getPtyManager()
    if (this.disposed || !pm || !pm.isAlive(targetId)) return { ok: false, reason: 'pty-not-found' }
    if (!this.isContractTower(targetId)) return { ok: false, reason: 'not-contract-tower' }
    // T0964 / BUG-235: the same line already waits in this tab's queue (its text not sent yet) → not
    // queued twice; answered as held, the item already there (a resend after it went out is not caught)
    const waiting = this.queues.get(targetId)?.items.find(item => item.kind === 'answer' && !item.textSent && item.text === text)
    if (waiting) {
      if (opts.menu !== undefined) waiting.menu = opts.menu // T0968: the window's newer reading of the menu
      this.deps.logger.log(`[notify-hold] answer duplicate ${describe(waiting)} holdId=${waiting.holdId} len=${text.length} (already held)`)
      return { ok: true, held: true, holdId: waiting.holdId }
    }
    const hold = this.holdReason(null, targetId, 'answer', 'answer')
    const queue = this.queueOf(targetId)
    if (queue.items.length >= NOTIFY_HOLD_MAX_PER_TARGET) {
      this.deps.logger.log(`[notify-hold] dropped terminal=${targetId} source=answer reason=held-full (${hold ?? 'none'}) len=${text.length} max=${NOTIFY_HOLD_MAX_PER_TARGET}`)
      if (queue.items.length === 0) this.deleteQueue(targetId, queue)
      return { ok: false, reason: 'held-full' }
    }
    const now = this.now()
    const item: HeldItem = {
      holdId: `h-${++this.seq}`,
      targetId,
      connectionId: opts.connectionId ?? null,
      heldAt: now,
      reason: hold ?? 'none',
      kind: 'answer',
      text,
      textAt: now,
      enter: { targetId, key: 'Enter', code: 'Enter', keyCode: 13, source: 'answer', reason: 'answer', userInput: true },
      ...(opts.menu !== undefined ? { menu: opts.menu } : {}),
    }
    queue.items.push(item)
    if (hold) {
      this.logHeld(item, 'text', text.length)
      this.afterChange(targetId)
    } else {
      this.deps.logger.log(`[notify-hold] answer ${describe(item)} len=${text.length} (sending)`)
      this.emitChangedEvent(targetId)
      void this.send(targetId, queue)
    }
    return { ok: true, held: !!hold, holdId: item.holdId }
  }

  // ── events (PtyManager deps, pty:write's user input) ──

  /** PTY `id`'s `blocked` (or turn) changed: arm / cancel the quiet wait. */
  onBlockedChange(id: string): void {
    if (this.queues.has(id)) this.schedule(id)
  }

  /**
   * The user typed into tab `id`: the quiet wait starts again. T0904: `data` feeds the S1 draft state
   * (only user input that is not a terminal reply comes here, electron/handlers/pty.ts). T0940:
   * `duringPrompt` = a hook / osc prompt was shown when it came (案 A); a single-key survey seen in
   * the output is answered by it or forgotten (案 B).
   */
  onUserInput(id: string, data?: string, opts: { duringPrompt?: boolean } = {}): void {
    if (typeof data === 'string' && data.length > 0) {
      const prev = this.drafts.get(id) ?? NO_DRAFT
      const now = this.now()
      const survey = this.singleKey.take(id, now)
      let next: DraftState
      if (opts.duringPrompt) {
        next = trackDraftDuringPrompt(prev, data)
      } else if (survey && answersSingleKeyPrompt(survey, prev, data, now)) {
        next = prev
        this.deps.logger.log(`[notify-hold] single-key prompt answered terminal=${id} legend=${survey.legend} (no draft)`)
      } else {
        next = trackDraft(prev, data)
      }
      if (next.draft || next.inPaste) this.drafts.set(id, next)
      else this.drafts.delete(id)
      // T0964 / BUG-235 (diagnostics): what made the draft — a kind and a length, never the text
      if (!prev.draft && next.draft) {
        this.deps.logger.log(`[notify-hold] draft set terminal=${id} cause=${draftCause(prev, data) ?? 'unknown'} bytes=${data.length}${opts.duringPrompt ? ' (during prompt)' : ''}`)
      }
      const at = this.monotonicNow()
      this.lastInputAt.set(id, at)
      this.lastTouchAt.set(id, at) // T0965
      if (!prev.inPaste && data.includes('\r')) this.lastEnterAt.set(id, at)
    }
    const queue = this.queues.get(id)
    if (!queue) return
    if (queue.quietTimer !== null) {
      this.clearTimer(queue.quietTimer)
      queue.quietTimer = null
    }
    this.schedule(id)
  }

  /**
   * T0964 / BUG-235: claude took the input box of tab `id` (an applied `user-prompt-submit` hook,
   * PtyManager `onUserPromptSubmit`). A contract-2 Tower's draft typed before that is gone from the input
   * box, so it no longer holds anything — unless the user sent anything in the last
   * `NOTIFY_HOLD_SUBMIT_QUIET_MS`, or an Enter in the last `NOTIFY_HOLD_SUBMIT_ENTER_GUARD_MS` (the hook
   * may come after what the user typed next; BAT cannot order the two, so then the draft is kept). Other
   * tabs, a paste still open, no draft: nothing changes.
   */
  onPromptSubmitted(id: string): void {
    if (this.disposed || typeof id !== 'string') return
    const state = this.drafts.get(id)
    if (!state?.draft || state.inPaste || !this.isContractTower(id)) return
    const now = this.monotonicNow()
    const sinceInput = now - (this.lastInputAt.get(id) ?? -Infinity)
    const lastEnter = this.lastEnterAt.get(id)
    const sinceEnter = lastEnter === undefined ? Infinity : now - lastEnter
    if (sinceInput < NOTIFY_HOLD_SUBMIT_QUIET_MS || sinceEnter < NOTIFY_HOLD_SUBMIT_ENTER_GUARD_MS) {
      this.deps.logger.log(`[notify-hold] draft kept terminal=${id} (user-prompt-submit; input ${Math.round(sinceInput)} ms / Enter ${Number.isFinite(sinceEnter) ? Math.round(sinceEnter) : 'none'} ms before)`)
      return
    }
    this.drafts.delete(id)
    this.deps.logger.log(`[notify-hold] draft cleared terminal=${id} (user-prompt-submit)`)
    if (this.queues.has(id)) this.schedule(id)
  }

  /**
   * T0904: a user write to tab `id` (not a helper's). true = kept here (the atomic window of a
   * notification is open; written right after its Enter); false = write it now. `submit` = the
   * window's `{ auto: true }` / `{ submit: true }` write: its `\r` is the notification's Enter.
   */
  holdUserWrite(id: string, data: string, opts: { submit?: boolean } = {}): boolean {
    if (opts.submit) this.singleKey.drop(id) // T0940: BAT's own write ends the survey record
    const atomic = this.atomics.get(id)
    if (!atomic || typeof data !== 'string') return false
    if (opts.submit && data.includes('\r')) return false
    atomic.buffered.push(data)
    return true
  }

  /** T0904: a `{ auto: true }` / `{ submit: true }` write reached PTY `id`; its `\r` closes the atomic window. */
  afterSubmitWrite(id: string, data: string): void {
    this.singleKey.drop(id) // T0940
    if (typeof data === 'string' && data.includes('\r') && this.atomics.has(id)) this.closeAtomic(id, 'enter')
  }

  /**
   * T0940 案 B: output of PTY `id` (PtyManager `onPtyOutput`; read only, nothing is changed). Only a
   * contract-2 Tower is scanned for claude's single-key survey.
   */
  onPtyOutput(id: string, data: string): void {
    if (this.disposed || typeof id !== 'string' || typeof data !== 'string' || data.length === 0) return
    // T0965: the PTY answered BAT's Esc — claude closed the AskUserQuestion menu
    const queue = this.queues.get(id)
    if (queue?.menuEsc?.state === 'sent') this.menuEscAnswered(id, queue, queue.menuEsc)
    if (!this.isContractTower(id)) {
      if (this.singleKey.has(id)) this.singleKey.forget(id)
      return
    }
    const record = this.singleKey.scan(id, data, this.now())
    if (record) this.deps.logger.log(`[notify-hold] single-key prompt shown terminal=${id} legend=${record.legend}`)
  }

  /** T0940: the user pressed a mouse button in tab `id` (it may have answered the survey): forget it. */
  onMousePress(id: string): void {
    this.singleKey.drop(id)
    this.lastTouchAt.set(id, this.monotonicNow()) // T0965: no Esc to a menu the user just clicked
  }

  /**
   * T0940 案 A: tab `id` shows a hook / osc prompt now (asked before `noteUserInput` clears it).
   * T0965: + a contract-2 Tower's AskUserQuestion menu that may still be open (an arrow key after the first
   * key cleared `question` is a menu key, not a draft).
   */
  isPromptShown(id: string): boolean {
    return this.promptReason(id) !== null || (this.questionMenuOpen(id) && this.isContractTower(id))
  }

  /**
   * T0904: a window / client (`reporter`) reports whether the user reads tab `id` (proxied
   * `terminal:reading-state`). Reading while any reporter says so.
   */
  setReading(id: string, reporter: string, reading: boolean): void {
    if (typeof id !== 'string' || !id) return
    let set = this.readers.get(id)
    const before = !!set && set.size > 0
    if (reading) {
      if (!set) {
        set = new Set()
        this.readers.set(id, set)
      }
      set.add(reporter)
    } else if (set) {
      set.delete(reporter)
      if (set.size === 0) this.readers.delete(id)
    }
    const after = this.readingActive(id)
    if (before === after) return
    this.deps.logger.log(`[notify-hold] reading terminal=${id} reading=${after}`)
    if (this.queues.has(id)) this.schedule(id)
  }

  /** PTY `id` is gone (exit / kill / restart's kill): everything held for it is dropped. */
  onPtyExit(id: string): void {
    this.dropAll(id, 'pty-ended')
    this.forgetTab(id)
  }

  /** The Terminal Server died; the rebuilt shells run none of the agents: everything is dropped. */
  onServerRecovery(): void {
    for (const id of [...this.queues.keys()]) this.dropAll(id, 'server-recovery')
    for (const id of new Set([...this.drafts.keys(), ...this.readers.keys(), ...this.atomics.keys()])) this.forgetTab(id)
    this.singleKey.clear()
  }

  // ── the windows (renderer IPC) ──

  /** Held items of tab `id`, or of every tab. */
  list(id?: string): NotifyHoldChangedEvent[] {
    const ids = id !== undefined ? (this.queues.has(id) ? [id] : []) : [...this.queues.keys()]
    return ids.map(terminalId => this.eventOf(terminalId))
  }

  /** Cancels one held item of tab `id` (`holdId`), or all of them; returns how many. */
  cancel(id: string, holdId?: string): number {
    const queue = this.queues.get(id)
    if (!queue) return 0
    const victims = holdId === undefined ? [...queue.items] : queue.items.filter(item => item.holdId === holdId)
    for (const item of victims) this.remove(queue, item, 'cancelled', 'user')
    if (victims.length > 0) this.afterChange(id)
    return victims.length
  }

  /**
   * T0904「立即送出」: `draft` / `reading` no longer hold tab `id`'s items up to `holdId` (all when
   * absent; order kept). A prompt still holds them (their Enter would answer it, BUG-196). Returns how
   * many items were released.
   */
  sendNow(id: string, holdId?: string): number {
    const queue = this.queues.get(id)
    if (!queue) return 0
    const last = holdId === undefined ? queue.items.length - 1 : queue.items.findIndex(item => item.holdId === holdId)
    if (last < 0) return 0
    for (let i = 0; i <= last; i++) queue.items[i].forced = true
    this.deps.logger.log(`[notify-hold] send-now terminal=${id} count=${last + 1}${this.promptReason(id) ? ` (still held: ${this.promptReason(id)})` : ''}`)
    if (queue.quietTimer !== null) {
      this.clearTimer(queue.quietTimer)
      queue.quietTimer = null
    }
    if (!queue.sending && this.headHold(id) === null) {
      this.emitChangedEvent(id)
      void this.send(id, queue)
    } else {
      this.schedule(id)
    }
    return last + 1
  }

  /** Items held for tab `id` (tests, logs). */
  count(id: string): number {
    return this.queues.get(id)?.items.length ?? 0
  }

  /** T0904: tab `id`'s S1 draft state (tests, logs). */
  hasDraft(id: string): boolean {
    return this.drafts.get(id)?.draft ?? false
  }

  dispose(): void {
    this.disposed = true
    for (const queue of this.queues.values()) this.clearQueueTimers(queue)
    this.queues.clear()
    for (const atomic of this.atomics.values()) {
      this.clearTimer(atomic.timer)
      for (const resolve of atomic.waiters.splice(0)) resolve()
    }
    this.atomics.clear()
    this.drafts.clear()
    this.lastInputAt.clear() // T0964
    this.lastEnterAt.clear()
    this.lastTouchAt.clear() // T0965
    this.readers.clear()
    this.singleKey.clear()
  }

  // ── internals ──

  /** T0904: tab `id` is a Tower that declared the BAT ↔ CT contract this BAT speaks (W0). */
  private isContractTower(id: string): boolean {
    const pm = this.deps.getPtyManager()
    if (!pm?.getTowerContract) return false
    return towerContractStatus(pm.getTerminalRole?.(id) ?? null, pm.getTowerContract(id) ?? null) === 'match'
  }

  /** T0788: the prompt reason tab `id` waits on (every tab), or null. */
  private promptReason(id: string): NotifyHoldReason | null {
    const state = this.deps.getPtyManager()?.getBlockedState(id) ?? null
    return state && NOTIFY_HOLD_REASONS.includes(state.reason) ? state.reason as NotifyHoldReason : null
  }

  /** T0965: tab `id`'s AskUserQuestion menu may still be open (PtyManager; absent = never). */
  private questionMenuOpen(id: string): boolean {
    return this.deps.getPtyManager()?.hasOpenQuestionMenu?.(id) === true
  }

  private readingActive(id: string): boolean {
    return (this.readers.get(id)?.size ?? 0) > 0
  }

  /** Why a helper write (or an answer) to `targetId` is held now, or null (written as before). */
  private holdReason(ctx: HandlerContext | null, targetId: string, channel: string, kind: 'notify' | 'answer'): NotifyHoldReason | null {
    if (this.disposed) return null
    const queue = this.queues.get(targetId)
    if (queue && queue.items.length > 0) return 'queued'
    const pm = this.deps.getPtyManager()
    if (!pm || !pm.isAlive(targetId)) return null
    const prompt = this.promptReason(targetId)
    if (prompt) return prompt
    if (this.isContractTower(targetId)) {
      if (this.atomics.has(targetId)) return 'queued'
      // T0965 / BUG-236: the menu may still be open though `question` was cleared — never typed into it
      // T0968: Worker notifications too (their Enter would pick an option); never an Esc for them
      if (this.questionMenuOpen(targetId)) return 'question'
      if (this.hasDraft(targetId)) return 'draft'
      if (kind === 'notify' && this.readingActive(targetId)) return 'reading'
    }
    if (ctx && pm.getBlockedDetection(targetId) === 'none') {
      this.deps.logger.log(`[notify-hold] skipped (detection none) terminal=${targetId} source=${ctx.helper?.terminalId ?? 'n/a'} channel=${channel}`)
    }
    return null
  }

  /**
   * What holds the first item of tab `id`'s queue now (null = it may go). A prompt holds every tab
   * (T0788); `draft` / `reading` / an open atomic window only a contract-2 Tower, and only before the
   * item's text went out.
   */
  private headHold(id: string): NotifyHoldReason | null {
    const prompt = this.promptReason(id)
    if (prompt) return prompt
    const queue = this.queues.get(id)
    const head = queue?.items[0]
    if (!queue || !head || head.textSent || !this.isContractTower(id)) return null
    if (this.atomics.has(id)) return 'queued'
    // T0965 / BUG-236: an answer waits for the menu to close (「立即送出」releases it: the record may be stale)
    // T0968: a Worker notification too
    if (!head.forced && this.questionMenuOpen(id)) return 'question'
    if (head.forced) return null
    if (this.hasDraft(id)) return 'draft'
    if (head.kind !== 'answer' && this.readingActive(id) && !this.readingCapped(queue)) return 'reading'
    return null
  }

  private readingCapped(queue: TargetQueue): boolean {
    return queue.readingSince !== null && this.now() - queue.readingSince >= NOTIFY_HOLD_READING_MAX_MS
  }

  private queueOf(id: string): TargetQueue {
    let queue = this.queues.get(id)
    if (!queue) {
      queue = {
        items: [],
        quietTimer: null,
        sending: false,
        readingSince: null,
        readingCapTimer: null,
        remindTimer: null,
        reminded: false,
        lastReason: null,
        menuEsc: null,
        menuTimer: null,
        menuWaitLogged: null,
        menuSkipLogged: null,
      }
      this.queues.set(id, queue)
    }
    return queue
  }

  private deleteQueue(id: string, queue: TargetQueue): void {
    this.clearQueueTimers(queue)
    if (this.queues.get(id) === queue) this.queues.delete(id)
  }

  private clearQueueTimers(queue: TargetQueue): void {
    if (queue.quietTimer !== null) this.clearTimer(queue.quietTimer)
    if (queue.readingCapTimer !== null) this.clearTimer(queue.readingCapTimer)
    if (queue.remindTimer !== null) this.clearTimer(queue.remindTimer)
    queue.quietTimer = null
    queue.readingCapTimer = null
    queue.remindTimer = null
    this.clearMenuTimer(queue) // T0965
    this.endMenuEsc(queue)
  }

  private newItem(ctx: HandlerContext, targetId: string, reason: string, now: number): HeldItem {
    const sourceTerminalId = ctx.helper?.terminalId
    const workorder = sourceTerminalId ? this.deps.getPtyManager()?.getWorkorder?.(sourceTerminalId) : undefined
    const item: HeldItem = {
      holdId: `h-${++this.seq}`,
      targetId,
      connectionId: ctx.connectionId ?? null,
      ...(sourceTerminalId ? { sourceTerminalId } : {}),
      ...(workorder ? { workorder } : {}),
      heldAt: now,
      reason,
      kind: 'notify',
    }
    return item
  }

  private full(ctx: HandlerContext, targetId: string, reason: string, len: number): NotifyHoldDecision {
    this.deps.logger.log(`[notify-hold] dropped terminal=${targetId} source=${ctx.helper?.terminalId ?? 'n/a'} reason=held-full (${reason}) len=${len} max=${NOTIFY_HOLD_MAX_PER_TARGET}`)
    this.mirror('dropped', { targetTerminalId: targetId, sourceTerminalId: ctx.helper?.terminalId, reason: 'held-full', len })
    return { ok: false, reason: 'held-full' }
  }

  private logHeld(item: HeldItem, part: 'text' | 'enter', len: number): void {
    this.deps.logger.log(`[notify-hold] held ${describe(item)} reason=${item.reason} part=${part} len=${len} queued=${this.count(item.targetId)}`)
    this.mirror('held', { targetTerminalId: item.targetId, sourceTerminalId: item.sourceTerminalId, holdId: item.holdId, reason: item.reason, part, len })
  }

  private mirror(action: string, payload: Record<string, unknown>): void {
    try {
      this.deps.mirrorToBatScripts?.('notify-hold', { action, ...payload })
    } catch { /* logging only */ }
  }

  private itemsOf(id: string): NotifyHoldItem[] {
    return (this.queues.get(id)?.items ?? []).map(item => ({
      holdId: item.holdId,
      ...(item.sourceTerminalId ? { sourceTerminalId: item.sourceTerminalId } : {}),
      ...(item.workorder ? { workorder: item.workorder } : {}),
      heldAt: item.heldAt,
      hasText: item.text !== undefined,
      hasEnter: !!item.enter,
      ...(item.kind === 'answer' ? { kind: 'answer' as const } : {}),
    }))
  }

  private eventOf(id: string): NotifyHoldChangedEvent {
    const items = this.itemsOf(id)
    const reason = this.shownReason(id, items.length > 0 ? this.headHold(id) : null)
    return { terminalId: id, items, ...(reason ? { reason } : {}) }
  }

  /** T0904: the reason the windows see — contract-2 Towers only (every other tab: as before, none). */
  private shownReason(id: string, reason: NotifyHoldReason | null): NotifyHoldReason | null {
    return reason && this.isContractTower(id) ? reason : null
  }

  /** Tells the windows the queue of `id` now (items and why the first waits). */
  private emitChangedEvent(id: string): void {
    const event = this.eventOf(id)
    const queue = this.queues.get(id)
    if (queue) queue.lastReason = event.reason ?? null
    try {
      this.deps.emitChanged?.(event)
    } catch (e) {
      this.deps.logger.log(`[notify-hold] emitChanged failed terminal=${id}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  /** The queue changed: tell the windows, drop an empty queue, (re)consider sending. */
  private afterChange(id: string): void {
    const queue = this.queues.get(id)
    this.emitChangedEvent(id)
    if (!queue) return
    if (queue.items.length === 0) {
      if (queue.quietTimer !== null) this.clearTimer(queue.quietTimer)
      queue.quietTimer = null
      if (!queue.sending) this.deleteQueue(id, queue)
      return
    }
    this.schedule(id)
  }

  /** 4. held → no wait; not held → wait `NOTIFY_HOLD_QUIET_MS` (unless a wait / a send runs). */
  private schedule(id: string): void {
    const queue = this.queues.get(id)
    if (!queue || queue.items.length === 0 || this.disposed) return
    const reason = this.headHold(id)
    this.noteHold(id, queue, reason)
    if (this.shownReason(id, reason) !== queue.lastReason) this.emitChangedEvent(id)
    if (reason) {
      if (queue.quietTimer !== null) {
        this.clearTimer(queue.quietTimer)
        queue.quietTimer = null
      }
      if (reason === 'question') this.considerMenuEsc(id, queue) // T0965
      else this.clearMenuTimer(queue)
      return
    }
    this.clearMenuTimer(queue) // T0965
    if (queue.sending || queue.quietTimer !== null) return
    queue.quietTimer = this.setTimer(() => {
      if (this.queues.get(id) !== queue) return
      queue.quietTimer = null
      void this.send(id, queue)
    }, NOTIFY_HOLD_QUIET_MS)
  }

  /** T0904: the `reading` limit and the `draft` reminder of a queue held by them. */
  private noteHold(id: string, queue: TargetQueue, reason: NotifyHoldReason | null): void {
    if (reason === 'reading' && queue.readingSince === null) {
      queue.readingSince = this.now()
      queue.readingCapTimer = this.setTimer(() => {
        queue.readingCapTimer = null
        if (this.queues.get(id) !== queue) return
        this.deps.logger.log(`[notify-hold] reading limit terminal=${id} after=${NOTIFY_HOLD_READING_MAX_MS}ms count=${queue.items.length}`)
        this.schedule(id)
      }, NOTIFY_HOLD_READING_MAX_MS)
    }
    if (reason === 'draft' && !queue.reminded && queue.remindTimer === null && queue.items.length > 0) {
      const heldSince = queue.items[0].heldAt
      queue.remindTimer = this.setTimer(() => {
        queue.remindTimer = null
        if (this.queues.get(id) !== queue || queue.reminded) return
        if (this.headHold(id) !== 'draft') return // armed again the next time `draft` holds it
        queue.reminded = true
        this.deps.logger.log(`[notify-hold] reminder terminal=${id} reason=draft count=${queue.items.length}`)
        try {
          this.deps.emitReminder?.({ terminalId: id, count: queue.items.length, heldSince: queue.items[0]?.heldAt ?? heldSince, reason: 'draft' })
        } catch (e) {
          this.deps.logger.log(`[notify-hold] emitReminder failed terminal=${id}: ${e instanceof Error ? e.message : String(e)}`)
        }
      }, Math.max(0, heldSince + NOTIFY_HOLD_DRAFT_REMIND_MS - this.now()))
    }
  }

  // ── T0965 / BUG-236: BAT's Esc to the AskUserQuestion menu (answers only) ──

  /**
   * Tab `id`'s head is an answer held by `question` (the prompt, or the menu record alone): writes one Esc
   * once the user left the tab alone and its output is quiet. One Esc per answer, whatever came of it.
   */
  private considerMenuEsc(id: string, queue: TargetQueue): void {
    const head = queue.items[0]
    const pm = this.deps.getPtyManager()
    if (!head || head.kind !== 'answer' || head.textSent || !pm?.closeQuestionMenu || !this.isContractTower(id)) return
    const prompt = this.promptReason(id)
    if (prompt !== 'question' && (prompt !== null || head.forced || !this.questionMenuOpen(id))) return
    if (queue.menuEsc?.holdId === head.holdId) return
    // T0968: with CT's `menu_open`, only an answer to this very menu closes it; any other waits for it to close
    const decision = menuEscDecision(head.menu, head.text ?? '', pm.getQuestionMenuOpenedAt?.(id) ?? null)
    if (decision !== 'esc') {
      this.clearMenuTimer(queue)
      const logged = `${head.holdId}:${decision}`
      if (queue.menuSkipLogged !== logged) {
        queue.menuSkipLogged = logged
        this.deps.logger.log(`[notify-hold] menu esc skipped terminal=${id} holdId=${head.holdId} (${decision}; held until the menu closes)`)
      }
      return
    }
    let wait: 'draft' | 'input' | 'output' | null = null
    let waitMs = 0
    if (this.hasDraft(id)) {
      wait = 'draft' // the user types into the menu's text field; the next input / change looks again
    } else {
      const touched = this.lastTouchAt.get(id)
      const inputLeft = touched === undefined ? 0 : touched + NOTIFY_HOLD_MENU_INPUT_QUIET_MS - this.monotonicNow()
      const lastOutput = pm.getLastOutputAt?.(id) ?? null
      const outputLeft = lastOutput === null ? 0 : lastOutput + NOTIFY_HOLD_MENU_OUTPUT_QUIET_MS - this.now()
      if (inputLeft > 0) wait = 'input'
      else if (outputLeft > 0) wait = 'output'
      waitMs = Math.max(inputLeft, outputLeft)
    }
    if (wait) {
      if (queue.menuWaitLogged !== head.holdId) {
        queue.menuWaitLogged = head.holdId
        this.deps.logger.log(`[notify-hold] menu esc waits terminal=${id} holdId=${head.holdId} (${wait})`)
      }
      if (wait !== 'draft' && queue.menuTimer === null) {
        queue.menuTimer = this.setTimer(() => {
          queue.menuTimer = null
          if (this.queues.get(id) === queue) this.schedule(id)
        }, Math.ceil(waitMs))
      }
      return
    }
    this.clearMenuTimer(queue)
    this.singleKey.drop(id) // T0940: BAT's own write
    const result = pm.writeWithResult(id, MENU_ESC)
    const esc: MenuEsc = { holdId: head.holdId, state: result.ok ? 'sent' : 'failed', timer: null }
    queue.menuEsc = esc
    if (!result.ok) {
      this.deps.logger.log(`[notify-hold] menu esc failed terminal=${id} holdId=${head.holdId} (${result.reason ?? 'unknown'}; the answer stays held)`)
      return
    }
    this.deps.logger.log(`[notify-hold] menu esc terminal=${id} holdId=${head.holdId} (${prompt === 'question' ? 'question' : 'menu still open'})`)
    esc.timer = this.setTimer(() => {
      esc.timer = null
      if (queue.menuEsc !== esc || esc.state !== 'sent') return
      esc.state = 'failed'
      this.deps.logger.log(`[notify-hold] menu esc no effect terminal=${id} holdId=${esc.holdId} after=${NOTIFY_HOLD_MENU_ESC_MAX_MS}ms (the answer stays held)`)
    }, NOTIFY_HOLD_MENU_ESC_MAX_MS)
  }

  /** The PTY wrote output after BAT's Esc: claude closed the menu; the answer goes after the quiet wait. */
  private menuEscAnswered(id: string, queue: TargetQueue, esc: MenuEsc): void {
    esc.state = 'closed'
    if (esc.timer !== null) this.clearTimer(esc.timer)
    esc.timer = null
    this.deps.logger.log(`[notify-hold] menu esc answered terminal=${id} holdId=${esc.holdId} (the menu closed)`)
    this.deps.getPtyManager()?.closeQuestionMenu?.(id, 'BAT Esc')
    if (this.queues.get(id) === queue) this.schedule(id)
  }

  private clearMenuTimer(queue: TargetQueue): void {
    if (queue.menuTimer !== null) this.clearTimer(queue.menuTimer)
    queue.menuTimer = null
  }

  private endMenuEsc(queue: TargetQueue): void {
    if (queue.menuEsc?.timer !== null && queue.menuEsc?.timer !== undefined) this.clearTimer(queue.menuEsc.timer)
    queue.menuEsc = null
  }

  /** Sends the held items of `id` in order; stops (keeps the rest) when something holds the tab again. */
  private async send(id: string, queue: TargetQueue): Promise<void> {
    if (queue.sending) return
    queue.sending = true
    try {
      let pause = false
      while (queue.items.length > 0 && !this.disposed && this.queues.get(id) === queue) {
        const pm = this.deps.getPtyManager()
        if (!pm || !pm.isAlive(id)) {
          this.dropAll(id, 'pty-ended')
          return
        }
        if (this.headHold(id)) return // waits for the next change
        if (pause) {
          // between two items; everything is checked again after it
          pause = false
          await this.wait(NOTIFY_HOLD_ENTER_DELAY_MS)
          continue
        }
        pause = true
        const item = queue.items[0]
        if (item.text !== undefined) {
          const text = item.text
          this.singleKey.drop(id) // T0940
          const result = pm.writeWithResult(id, text)
          delete item.text
          if (!result.ok) {
            this.remove(queue, item, 'dropped', `write-failed:${result.reason ?? 'unknown'}`, text.length)
            this.afterChange(id)
            continue
          }
          item.textSent = true
          // T0904: the user's input waits until this item's Enter reached the PTY
          if (item.enter && this.isContractTower(id)) this.openAtomic(id, null)
          this.deps.logger.log(`[notify-hold] sent ${describe(item)} reason=${item.reason} part=text len=${text.length}`)
          this.mirror('sent', { targetTerminalId: id, sourceTerminalId: item.sourceTerminalId, holdId: item.holdId, part: 'text', len: text.length })
          if (item.enter) {
            this.afterChange(id)
            await this.wait(NOTIFY_HOLD_ENTER_DELAY_MS)
            if (!queue.items.includes(item) || this.queues.get(id) !== queue) continue // cancelled / dropped meanwhile
            if (this.promptReason(id)) return // the Enter waits for the next change
            if (!this.deps.getPtyManager()?.isAlive(id)) {
              this.dropAll(id, 'pty-ended')
              return
            }
          }
        }
        if (item.enter) {
          if (!this.deps.emitKeypress(item.enter)) {
            this.remove(queue, item, 'dropped', 'no-receiver')
            this.afterChange(id)
            continue
          }
          this.deps.logger.log(`[notify-hold] sent ${describe(item)} reason=${item.reason} part=enter len=0`)
          this.mirror('sent', { targetTerminalId: id, sourceTerminalId: item.sourceTerminalId, holdId: item.holdId, part: 'enter' })
        }
        this.remove(queue, item, null, '')
        this.afterChange(id)
        // T0904: the next item waits until this one's Enter reached the PTY (the window's `\r`)
        if (this.atomics.has(id)) await this.whenAtomicClosed(id)
      }
    } finally {
      queue.sending = false
      if (this.queues.get(id) === queue) {
        if (queue.items.length === 0) this.deleteQueue(id, queue)
        else this.schedule(id)
      }
    }
  }

  // ── T0904: the atomic window ──

  private openAtomic(id: string, connectionId: string | null): void {
    if (this.atomics.has(id)) this.closeAtomic(id, 'replaced')
    const atomic: AtomicWindow = { connectionId, keypressSeen: false, buffered: [], timer: null, waiters: [] }
    atomic.timer = this.setTimer(() => {
      if (this.atomics.get(id) === atomic) this.closeAtomic(id, 'timeout')
    }, NOTIFY_HOLD_ATOMIC_MAX_MS)
    this.atomics.set(id, atomic)
  }

  /** Writes the kept user input of `id` (in order) and lets held items go again. */
  private closeAtomic(id: string, cause: 'enter' | 'timeout' | 'replaced'): void {
    const atomic = this.atomics.get(id)
    if (!atomic) return
    this.atomics.delete(id)
    this.clearTimer(atomic.timer)
    let bytes = 0
    if (atomic.buffered.length > 0) {
      const pm = this.deps.getPtyManager()
      for (const chunk of atomic.buffered) {
        bytes += chunk.length
        pm?.writeWithResult(id, chunk)
      }
    }
    if (atomic.buffered.length > 0 || cause !== 'enter') {
      this.deps.logger.log(`[notify-hold] atomic closed terminal=${id} cause=${cause} kept=${atomic.buffered.length} bytes=${bytes}`)
    }
    for (const resolve of atomic.waiters.splice(0)) resolve()
    if (this.queues.has(id)) this.schedule(id)
  }

  private whenAtomicClosed(id: string): Promise<void> {
    const atomic = this.atomics.get(id)
    if (!atomic) return Promise.resolve()
    return new Promise(resolve => { atomic.waiters.push(resolve) })
  }

  /** The PTY is gone: its draft, readers and atomic window too (nothing kept is written). */
  private forgetTab(id: string): void {
    this.drafts.delete(id)
    this.lastInputAt.delete(id) // T0964
    this.lastEnterAt.delete(id)
    this.lastTouchAt.delete(id) // T0965
    this.readers.delete(id)
    this.singleKey.forget(id)
    const atomic = this.atomics.get(id)
    if (atomic) {
      this.atomics.delete(id)
      this.clearTimer(atomic.timer)
      for (const resolve of atomic.waiters.splice(0)) resolve()
    }
  }

  private dropAll(id: string, cause: string): void {
    const queue = this.queues.get(id)
    if (!queue) return
    const count = queue.items.length
    for (const item of [...queue.items]) this.remove(queue, item, 'dropped', cause)
    this.deleteQueue(id, queue)
    if (count > 0) {
      this.deps.logger.log(`[notify-hold] dropped terminal=${id} count=${count} (${cause})`)
      try {
        this.deps.emitChanged?.({ terminalId: id, items: [] })
      } catch { /* the windows may be gone */ }
    }
  }

  /** Takes `item` out; logs `action` (null = it was sent, already logged). */
  private remove(queue: TargetQueue, item: HeldItem, action: 'cancelled' | 'dropped' | null, cause: string, len?: number): void {
    const index = queue.items.indexOf(item)
    if (index < 0) return
    queue.items.splice(index, 1)
    if (queue.menuEsc?.holdId === item.holdId) this.endMenuEsc(queue) // T0965
    if (queue.menuWaitLogged === item.holdId) queue.menuWaitLogged = null
    if (queue.menuSkipLogged?.startsWith(`${item.holdId}:`)) queue.menuSkipLogged = null // T0968
    if (!action) return
    const parts = len !== undefined ? 'text' : partsOf(item)
    const length = len ?? item.text?.length ?? 0
    this.deps.logger.log(`[notify-hold] ${action} ${describe(item)} reason=${item.reason} part=${parts} len=${length} (${cause})`)
    this.mirror(action, { targetTerminalId: item.targetId, sourceTerminalId: item.sourceTerminalId, holdId: item.holdId, cause, len: length })
  }

  private wait(ms: number): Promise<void> {
    return new Promise(resolve => { this.setTimer(resolve, ms) })
  }

  private setTimer(fn: () => void, ms: number): unknown {
    if (this.deps.setTimer) return this.deps.setTimer(fn, ms)
    const handle = setTimeout(fn, ms)
    ;(handle as { unref?: () => void }).unref?.()
    return handle
  }

  private clearTimer(handle: unknown): void {
    if (handle === null || handle === undefined) return
    if (this.deps.clearTimer) this.deps.clearTimer(handle)
    else clearTimeout(handle as ReturnType<typeof setTimeout>)
  }
}

function workorderOf(source: unknown): string | undefined {
  return typeof source === 'string' && WORKORDER_PATTERN.test(source) ? source : undefined
}

// ─── PLAN-068 W5 / T0908: the windows' channels (Electron main and headless alike; proxied) ───

type RegisterHandler = (channel: string, handler: (ctx: HandlerContext, ...args: unknown[]) => unknown) => void

export const TOWER_INBOX_ANSWER_CHANNEL = 'tower-inbox:answer'

/**
 * T0908 (T0902 §2.4 / §5, R7): `tower-inbox:answer { terminalId, text }` — the Inbox tab's answer
 * line into a contract-2 Tower tab, through `enqueueAnswer` (held by a prompt / `draft`, not by
 * `reading`; its Enter is the user's input). Local window: Electron main; remote window: proxied to
 * the bat-server running the tab. 🔴 Not in `HELPER_CHANNEL_ROLES`, and a helper capability is refused
 * here too (`FORBIDDEN`): no agent can answer for the user. The text must pass `checkInboxAnswer`
 * (one line, ≤ 1,000 chars, `^[UA]-\d+[：:]` + text). Logs ids and lengths only, never the text.
 * T0968: an optional `menu` (CT 6.4.0 `menu_open`, `checkInboxMenuInfo`) goes with the answer
 * (`menuEscDecision`); absent or malformed → none (T0965), a malformed one logged.
 */
export function registerTowerInboxAnswerHandler(opts: {
  registerHandler: RegisterHandler
  getNotifyHold: () => Pick<NotifyHoldController, 'enqueueAnswer'> | null
  logger: { log(message: string): void }
}): void {
  // literal channel name: the IPC binding guard scans for it (proxied-channels-binding.test.ts)
  opts.registerHandler('tower-inbox:answer', (ctx: HandlerContext, raw?: unknown): TowerInboxAnswerResult => {
    if (ctx?.helper) {
      opts.logger.log(`[tower-inbox] answer refused: helper capability terminal=${ctx.helper.terminalId}`)
      return { ok: false, reason: 'FORBIDDEN' }
    }
    const args = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : null
    const terminalId = args?.terminalId
    if (!args || typeof terminalId !== 'string' || !terminalId || terminalId.length > 256) return { ok: false, reason: 'INVALID_ARGS' }
    const check = checkInboxAnswer(args.text)
    if (check !== 'ok') {
      opts.logger.log(`[tower-inbox] answer rejected terminal=${terminalId} check=${check} len=${typeof args.text === 'string' ? args.text.length : 0}`)
      return { ok: false, reason: 'invalid' }
    }
    const text = args.text as string
    const controller = opts.getNotifyHold()
    if (!controller) return { ok: false, reason: 'unavailable' }
    // T0968: only an object given by the window counts (an older window sends no `menu` key)
    const menuCheck = checkInboxMenuInfo(args.menu)
    const menu = menuCheck === 'invalid' ? undefined : menuCheck
    if (menuCheck === 'invalid') opts.logger.log(`[tower-inbox] answer menu ignored terminal=${terminalId} (malformed)`)
    else if (menu !== undefined) opts.logger.log(`[tower-inbox] answer menu terminal=${terminalId} ${menu === null ? 'menu_open=none' : `menu_open=${menu.ids.join(',')}`}`)
    const result = controller.enqueueAnswer(terminalId, text, { connectionId: ctx?.connectionId ?? null, ...(menu !== undefined ? { menu } : {}) })
    // PLAN-069 / T0922: a batch line logs its first id and the id count (`id=U-1 ids=3`); one id as before
    opts.logger.log(`[tower-inbox] answer terminal=${terminalId} ${inboxAnswerLogIds(text)} len=${text.length} → ${result.ok ? (result.held ? 'held' : 'sending') : result.reason}`)
    return result
  })
}

/**
 * T0908 (T0904 follow-up 1): `terminal:notify-hold-list` / `-cancel` / `-send-now` — the windows'
 * "📨 待送" list, cancel and「立即送出」. Registered on both hosts (was Electron-local IPC until T0908),
 * so a remote profile window reaches its bat-server's queue; the events `terminal:notify-hold-changed`
 * / `-reminder` go to the connected clients too (PROXIED_EVENTS). Answers keep their T0788 shapes (a
 * list / a number). 🔴 Not in `HELPER_CHANNEL_ROLES`; a helper capability gets `[]` / `0`.
 */
export function registerNotifyHoldHandlers(opts: {
  registerHandler: RegisterHandler
  getNotifyHold: () => Pick<NotifyHoldController, 'list' | 'cancel' | 'sendNow'> | null
  logger: { log(message: string): void }
}): void {
  const refused = (ctx: HandlerContext, channel: string): boolean => {
    if (!ctx?.helper) return false
    opts.logger.log(`[notify-hold] ${channel} refused: helper capability terminal=${ctx.helper.terminalId}`)
    return true
  }
  opts.registerHandler('terminal:notify-hold-list', (ctx: HandlerContext) => {
    if (refused(ctx, 'terminal:notify-hold-list')) return []
    return opts.getNotifyHold()?.list() ?? []
  })
  opts.registerHandler('terminal:notify-hold-cancel', (ctx: HandlerContext, terminalId?: unknown, holdId?: unknown) => {
    if (refused(ctx, 'terminal:notify-hold-cancel')) return 0
    const controller = opts.getNotifyHold()
    if (typeof terminalId !== 'string' || !controller) return 0
    return controller.cancel(terminalId, typeof holdId === 'string' ? holdId : undefined)
  })
  opts.registerHandler('terminal:notify-hold-send-now', (ctx: HandlerContext, terminalId?: unknown, holdId?: unknown) => {
    if (refused(ctx, 'terminal:notify-hold-send-now')) return 0
    const controller = opts.getNotifyHold()
    if (typeof terminalId !== 'string' || !controller) return 0
    return controller.sendNow(terminalId, typeof holdId === 'string' ? holdId : undefined)
  })
}
