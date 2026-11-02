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
 * Only reads `TerminalBlockedTracker` (through PtyManager); never changes how it decides.
 * Details: docs/agent-guide/notify-hold.md.
 *
 * 🔴 No `electron` import here (Electron main and headless bat-server share it).
 */
import type { NotifyHoldChangedEvent, NotifyHoldItem } from '../src/types/notify-hold'
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

/** The `blocked` reasons that hold (a prompt in the tab waits for a key). */
export const NOTIFY_HOLD_REASONS: readonly string[] = ['permission', 'question', 'elicitation', 'input']

export const NOTIFY_HOLD_CHANGED_CHANNEL = 'terminal:notify-hold-changed'

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
}

/** What the controller needs from PtyManager (the class satisfies it). */
export interface NotifyHoldPtyManager {
  isAlive(id: string): boolean
  getBlockedState(id: string): BlockedState | null
  getBlockedDetection(id: string): BlockedDetection
  writeWithResult(id: string, data: string): { ok: boolean; reason?: string }
  getWorkorder?(id: string): string | undefined
}

export interface NotifyHoldDeps {
  getPtyManager(): NotifyHoldPtyManager | null
  /** Sends the held Enter (the `terminal:keypress` event); false = nobody can make it (headless, no client). */
  emitKeypress(payload: NotifyHoldKeypress): boolean
  /** The windows' "N held" (`terminal:notify-hold-changed`). Absent: nobody shows it. */
  emitChanged?(event: NotifyHoldChangedEvent): void
  logger: { log(message: string): void }
  mirrorToBatScripts?(event: string, payload: Record<string, unknown>): void
  /** Tests. Default `Date.now`. */
  now?(): number
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
}

interface TargetQueue {
  items: HeldItem[]
  quietTimer: unknown
  sending: boolean
}

export type NotifyHoldDecision =
  | { ok: true; held: true }
  | { ok: false; reason: 'held-full' }

/** One line of `[notify-hold]` (no text: its length only). */
function describe(item: HeldItem): string {
  return `terminal=${item.targetId} source=${item.sourceTerminalId ?? 'n/a'}${item.workorder ? ` workorder=${item.workorder}` : ''}`
}

function partsOf(item: HeldItem): string {
  if (item.text !== undefined && item.enter) return 'text+enter'
  return item.enter ? 'enter' : 'text'
}

export class NotifyHoldController {
  private readonly queues = new Map<string, TargetQueue>()
  private seq = 0
  private disposed = false
  private readonly now: () => number

  constructor(private readonly deps: NotifyHoldDeps) {
    this.now = deps.now ?? (() => Date.now())
  }

  // ── intake (electron/handlers/pty.ts, electron/handlers/terminal.ts) ──

  /** A `pty:write`: null = write it now (as before); otherwise the answer to give. */
  interceptWrite(ctx: HandlerContext, targetId: string, data: string): NotifyHoldDecision | null {
    if (!ctx.helper || typeof targetId !== 'string' || typeof data !== 'string') return null
    const hold = this.holdReason(ctx, targetId, 'pty:write')
    if (!hold) return null
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
    const queue = this.queues.get(targetId)
    const connectionId = ctx.connectionId ?? null
    const now = this.now()
    // 2. the Enter of a held write from the same connection joins it
    if (queue) {
      for (let i = queue.items.length - 1; i >= 0; i--) {
        const item = queue.items[i]
        if (item.connectionId !== connectionId) continue
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
    const hold = this.holdReason(ctx, targetId, 'terminal:keypress')
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

  // ── events (PtyManager deps, pty:write's user input) ──

  /** PTY `id`'s `blocked` (or turn) changed: arm / cancel the quiet wait. */
  onBlockedChange(id: string): void {
    if (this.queues.has(id)) this.schedule(id)
  }

  /** The user typed into tab `id`: the quiet wait starts again. */
  onUserInput(id: string): void {
    const queue = this.queues.get(id)
    if (!queue || queue.quietTimer === null) return
    this.clearTimer(queue.quietTimer)
    queue.quietTimer = null
    this.schedule(id)
  }

  /** PTY `id` is gone (exit / kill / restart's kill): everything held for it is dropped. */
  onPtyExit(id: string): void {
    this.dropAll(id, 'pty-ended')
  }

  /** The Terminal Server died; the rebuilt shells run none of the agents: everything is dropped. */
  onServerRecovery(): void {
    for (const id of [...this.queues.keys()]) this.dropAll(id, 'server-recovery')
  }

  // ── the windows (renderer IPC) ──

  /** Held items of tab `id`, or of every tab. */
  list(id?: string): NotifyHoldChangedEvent[] {
    const ids = id !== undefined ? (this.queues.has(id) ? [id] : []) : [...this.queues.keys()]
    return ids.map(terminalId => ({ terminalId, items: this.itemsOf(terminalId) }))
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

  /** Items held for tab `id` (tests, logs). */
  count(id: string): number {
    return this.queues.get(id)?.items.length ?? 0
  }

  dispose(): void {
    this.disposed = true
    for (const queue of this.queues.values()) {
      if (queue.quietTimer !== null) this.clearTimer(queue.quietTimer)
    }
    this.queues.clear()
  }

  // ── internals ──

  /** Why a helper write to `targetId` is held now, or null (written as before). */
  private holdReason(ctx: HandlerContext, targetId: string, channel: string): string | null {
    if (this.disposed) return null
    const queue = this.queues.get(targetId)
    if (queue && queue.items.length > 0) return 'queued'
    const pm = this.deps.getPtyManager()
    if (!pm || !pm.isAlive(targetId)) return null
    const state = pm.getBlockedState(targetId)
    if (state && NOTIFY_HOLD_REASONS.includes(state.reason)) return state.reason
    if (pm.getBlockedDetection(targetId) === 'none') {
      this.deps.logger.log(`[notify-hold] skipped (detection none) terminal=${targetId} source=${ctx.helper?.terminalId ?? 'n/a'} channel=${channel}`)
    }
    return null
  }

  private isHolding(id: string): boolean {
    const state = this.deps.getPtyManager()?.getBlockedState(id) ?? null
    return !!state && NOTIFY_HOLD_REASONS.includes(state.reason)
  }

  private queueOf(id: string): TargetQueue {
    let queue = this.queues.get(id)
    if (!queue) {
      queue = { items: [], quietTimer: null, sending: false }
      this.queues.set(id, queue)
    }
    return queue
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
    }))
  }

  /** The queue changed: tell the windows, drop an empty queue, (re)consider sending. */
  private afterChange(id: string): void {
    const queue = this.queues.get(id)
    try {
      this.deps.emitChanged?.({ terminalId: id, items: this.itemsOf(id) })
    } catch (e) {
      this.deps.logger.log(`[notify-hold] emitChanged failed terminal=${id}: ${e instanceof Error ? e.message : String(e)}`)
    }
    if (!queue) return
    if (queue.items.length === 0) {
      if (queue.quietTimer !== null) this.clearTimer(queue.quietTimer)
      queue.quietTimer = null
      if (!queue.sending) this.queues.delete(id)
      return
    }
    this.schedule(id)
  }

  /** 4. blocked → no wait; not blocked → wait `NOTIFY_HOLD_QUIET_MS` (unless a wait / a send runs). */
  private schedule(id: string): void {
    const queue = this.queues.get(id)
    if (!queue || queue.items.length === 0 || this.disposed) return
    if (this.isHolding(id)) {
      if (queue.quietTimer !== null) {
        this.clearTimer(queue.quietTimer)
        queue.quietTimer = null
      }
      return
    }
    if (queue.sending || queue.quietTimer !== null) return
    queue.quietTimer = this.setTimer(() => {
      if (this.queues.get(id) !== queue) return
      queue.quietTimer = null
      void this.send(id, queue)
    }, NOTIFY_HOLD_QUIET_MS)
  }

  /** Sends the held items of `id` in order; stops (keeps the rest) when the tab is `blocked` again. */
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
        if (this.isHolding(id)) return // waits for the next change
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
          const result = pm.writeWithResult(id, text)
          delete item.text
          if (!result.ok) {
            this.remove(queue, item, 'dropped', `write-failed:${result.reason ?? 'unknown'}`, text.length)
            this.afterChange(id)
            continue
          }
          this.deps.logger.log(`[notify-hold] sent ${describe(item)} reason=${item.reason} part=text len=${text.length}`)
          this.mirror('sent', { targetTerminalId: id, sourceTerminalId: item.sourceTerminalId, holdId: item.holdId, part: 'text', len: text.length })
          if (item.enter) {
            this.afterChange(id)
            await this.wait(NOTIFY_HOLD_ENTER_DELAY_MS)
            if (!queue.items.includes(item) || this.queues.get(id) !== queue) continue // cancelled / dropped meanwhile
            if (this.isHolding(id)) return // the Enter waits for the next change
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
      }
    } finally {
      queue.sending = false
      if (this.queues.get(id) === queue) {
        if (queue.items.length === 0) this.queues.delete(id)
        else this.schedule(id)
      }
    }
  }

  private dropAll(id: string, cause: string): void {
    const queue = this.queues.get(id)
    if (!queue) return
    const count = queue.items.length
    for (const item of [...queue.items]) this.remove(queue, item, 'dropped', cause)
    if (queue.quietTimer !== null) this.clearTimer(queue.quietTimer)
    queue.quietTimer = null
    this.queues.delete(id)
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
