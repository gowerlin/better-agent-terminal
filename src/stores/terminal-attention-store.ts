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
 */
import { useSyncExternalStore } from 'react'
import { isEmptyAttention, type TerminalAttentionEvent } from '../lib/terminal-attention'

type Listener = () => void

const attention = new Map<string, TerminalAttentionEvent>()
/** T0694: tab id → receive order of its running turn's start (absent = no turn running). */
const turnStarts = new Map<string, number>()
/** T0694: tab id → receive order of the latest Worker notify for it. */
const notifySeqs = new Map<string, number>()
/** T0694: this window's receive order (turn starts and notifies share it). */
let seq = 0
const listeners = new Set<Listener>()
/** Bumped on every change (`useTerminalAttentionVersion`: lists that count over many tabs). */
let version = 0

function notify(): void {
  version++
  for (const listener of listeners) listener()
}

export function setTerminalAttention(info: TerminalAttentionEvent): void {
  if (!info || typeof info.id !== 'string') return
  // T0694: a turn starts when this window sees `busy` go from absent to true
  const wasBusy = attention.get(info.id)?.busy === true
  const busy = info.busy === true
  if (busy && !wasBusy) turnStarts.set(info.id, ++seq)
  else if (!busy) turnStarts.delete(info.id)
  if (isEmptyAttention(info)) {
    if (attention.delete(info.id)) notify()
    return
  }
  attention.set(info.id, info)
  notify()
}

export function clearTerminalAttention(id: string): void {
  turnStarts.delete(id) // T0694: the PTY is gone, so is its turn
  if (attention.delete(id)) notify()
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
  if (attention.size === 0) return
  attention.clear()
  notify()
}
