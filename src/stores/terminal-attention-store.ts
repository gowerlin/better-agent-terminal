/**
 * T0609 (BUG-153): renderer side of `terminal:attention-changed` — main (or a remote server) tells
 * every window that a tab waits for the user (a claude hook `blocked`) or for its Tower's answer
 * (tower questions). The Worker badge (TerminalThumbnail) and the Tower's batch close
 * (`reportedWorkersOfTower`) read it. In memory only — never saved with the workspace; a window
 * that reloads knows nothing until the tab's next change.
 *
 * T0694 (D180): + the order this window received two things in — a tab's turn starting (`busy`
 * false → true) and a Worker notify for the tab (`noteWorkerNotified`, from `markWorkerReported`).
 * A turn that started after the tab's latest notify = the Worker works again after it reported
 * (`isWorkerResumedAfterReport` → `resumed`, not ✓). Only this window's own receive order counts:
 * no time from main or a remote host is compared with the renderer's `reportedAt`. A tab whose
 * notify this window never saw (the report came from the saved workspace, or a detached window it
 * adopted) counts as notified before any turn this window sees start. Memory only, like the rest.
 *
 * T0735 (D203): + the waits for the user this window saw begin, and those that ended while the
 * user was not looking at the tab ("missed": a faded ⚠️). The user looks at a tab while it is the
 * active tab and the window has focus (`setViewingState`, from App). A miss clears when the tab
 * is looked at, waits again, or is closed (`retainTerminals`). Rules: `nextWaitMemory`
 * (src/lib/terminal-attention.ts); times are this renderer's clock. Memory only.
 */
import { useSyncExternalStore } from 'react'
import { isEmptyAttention, isViewedTerminal, nextWaitMemory, type MissedWait, type TerminalAttentionEvent, type WaitMemory } from '../lib/terminal-attention'

type Listener = () => void

const attention = new Map<string, TerminalAttentionEvent>()
/** T0694: tab id → receive order of its running turn's start (absent = no turn running). */
const turnStarts = new Map<string, number>()
/** T0694: tab id → receive order of the latest Worker notify for it. */
const notifySeqs = new Map<string, number>()
/** T0694: this window's receive order (turn starts and notifies share it). */
let seq = 0
const listeners = new Set<Listener>()
/** T0735: tab id → the renderer time its current wait began (absent = not waiting / start unseen). */
const waitStarts = new Map<string, number>()
/** T0735: tab id → its wait that ended unseen. */
const missedWaits = new Map<string, MissedWait>()
/** T0735: the active tab and whether the window has focus (App). */
let viewing: { activeTerminalId: string | null; windowFocused: boolean } = { activeTerminalId: null, windowFocused: false }
/** Bumped on every change (`useTerminalAttentionVersion`: lists that count over many tabs). */
let version = 0

function notify(): void {
  version++
  for (const listener of listeners) listener()
}

/** T0735: apply `nextWaitMemory` for tab `id` going from `prev` to `next`; true = the miss changed. */
function updateWaitMemory(id: string, prev: TerminalAttentionEvent | null, next: TerminalAttentionEvent | null): boolean {
  const memory: WaitMemory = { startedAt: waitStarts.get(id) ?? null, missed: missedWaits.get(id) ?? null }
  const viewed = isViewedTerminal(id, viewing.activeTerminalId, viewing.windowFocused)
  const after = nextWaitMemory(memory, prev, next, viewed, Date.now())
  if (after.startedAt === null) waitStarts.delete(id)
  else waitStarts.set(id, after.startedAt)
  if (after.missed === memory.missed) return false
  if (after.missed) missedWaits.set(id, after.missed)
  else missedWaits.delete(id)
  return true
}

export function setTerminalAttention(info: TerminalAttentionEvent): void {
  if (!info || typeof info.id !== 'string') return
  const missChanged = updateWaitMemory(info.id, attention.get(info.id) ?? null, isEmptyAttention(info) ? null : info) // T0735
  // T0694: a turn starts when this window sees `busy` go from absent to true
  const wasBusy = attention.get(info.id)?.busy === true
  const busy = info.busy === true
  if (busy && !wasBusy) turnStarts.set(info.id, ++seq)
  else if (!busy) turnStarts.delete(info.id)
  if (isEmptyAttention(info)) {
    if (attention.delete(info.id) || missChanged) notify()
    return
  }
  attention.set(info.id, info)
  notify()
}

export function clearTerminalAttention(id: string): void {
  turnStarts.delete(id) // T0694: the PTY is gone, so is its turn
  const missChanged = updateWaitMemory(id, attention.get(id) ?? null, null) // T0735: a PTY exit ends a wait too
  if (attention.delete(id) || missChanged) notify()
}

/** T0735 (D203): the wait of tab `id` that ended unseen, or null. */
export function getMissedWait(id: string): MissedWait | null {
  return missedWaits.get(id) ?? null
}

/**
 * T0735 (D203 ③): the window's active tab and focus changed. The tab now looked at loses its miss.
 */
export function setViewingState(activeTerminalId: string | null, windowFocused: boolean): void {
  viewing = { activeTerminalId, windowFocused }
  if (activeTerminalId && windowFocused && missedWaits.delete(activeTerminalId)) notify()
}

/** T0735 (D203 ③): tabs no longer in this window's list are forgotten (closed → no faded ⚠️). */
export function retainTerminals(ids: Iterable<string>): void {
  const keep = new Set(ids)
  let changed = false
  for (const id of [...missedWaits.keys()]) {
    if (!keep.has(id)) { missedWaits.delete(id); changed = true }
  }
  for (const id of [...waitStarts.keys()]) if (!keep.has(id)) waitStarts.delete(id)
  if (changed) notify()
}

export function getTerminalAttention(id: string): TerminalAttentionEvent | null {
  return attention.get(id) ?? null
}

/** T0694: a Worker notify for these tabs was received (any kind: report, `提問`, `--ask`). */
export function noteWorkerNotified(ids: readonly string[]): void {
  if (ids.length === 0) return
  const at = ++seq
  for (const id of ids) notifySeqs.set(id, at)
  notify()
}

/**
 * T0694: tab `id`'s agent is in a turn this window saw start after the tab's latest Worker notify
 * (none seen = before). `workerAttention` shows a reported tab as `resumed` then.
 */
export function isWorkerResumedAfterReport(id: string): boolean {
  const start = turnStarts.get(id)
  if (start === undefined) return false
  const notified = notifySeqs.get(id)
  return notified === undefined || start > notified
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export function useTerminalAttention(id: string): TerminalAttentionEvent | null {
  return useSyncExternalStore(subscribe, () => getTerminalAttention(id), () => null)
}

/** T0735: `getMissedWait` for a component. */
export function useMissedWait(id: string): MissedWait | null {
  return useSyncExternalStore(subscribe, () => getMissedWait(id), () => null)
}

/** T0694: `isWorkerResumedAfterReport` for a component. */
export function useWorkerResumed(id: string): boolean {
  return useSyncExternalStore(subscribe, () => isWorkerResumedAfterReport(id), () => false)
}

/** Re-renders on any tab's change (the Tower's "Close reported Worker tabs (N)"). */
export function useTerminalAttentionVersion(): number {
  return useSyncExternalStore(subscribe, () => version, () => 0)
}

/** Tests. */
export function resetTerminalAttention(): void {
  turnStarts.clear()
  notifySeqs.clear()
  waitStarts.clear()
  missedWaits.clear()
  viewing = { activeTerminalId: null, windowFocused: false }
  if (attention.size === 0) return
  attention.clear()
  notify()
}
