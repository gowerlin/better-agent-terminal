/**
 * T0788 / BUG-196: renderer side of the helper notifications main holds while a tab waits for the
 * user (electron/notify-hold.ts). Main sends `terminal:notify-hold-changed`; a window mounted later
 * pulls `terminal:notify-hold-list` once. The tab thumbnail shows "N held" (`useNotifyHold`) and
 * cancels one or all (`cancelNotifyHold`). In memory only; never the text (D155-style: who, when).
 *
 * Local IPC: a remote profile window's tabs are held on the bat-server, which has no list — they
 * show nothing here (docs/agent-guide/notify-hold.md「已知限制」).
 */
import { useSyncExternalStore } from 'react'
import type { NotifyHoldChangedEvent, NotifyHoldItem, NotifyHoldReason } from '../types/notify-hold'

type Listener = () => void

const EMPTY: readonly NotifyHoldItem[] = Object.freeze([])
const held = new Map<string, readonly NotifyHoldItem[]>()
/** PLAN-068 W2 / T0904: why tab `id`'s first item waits (contract-2 Towers only; absent = not shown). */
const reasons = new Map<string, NotifyHoldReason>()
const listeners = new Set<Listener>()
let wired = false

function notify(): void {
  for (const listener of listeners) listener()
}

/** Applies main's event (or one entry of the pulled list). */
export function applyNotifyHold(info: NotifyHoldChangedEvent): void {
  if (!info || typeof info.terminalId !== 'string' || !Array.isArray(info.items)) return
  if (info.items.length === 0) {
    reasons.delete(info.terminalId)
    if (!held.delete(info.terminalId)) return
  } else {
    held.set(info.terminalId, info.items.map(item => ({ ...item })))
    if (typeof info.reason === 'string') reasons.set(info.terminalId, info.reason)
    else reasons.delete(info.terminalId)
  }
  notify()
}

/** Tests. */
export function resetNotifyHoldStore(): void {
  held.clear()
  reasons.clear()
  wired = false
  notify()
}

export function getNotifyHold(id: string): readonly NotifyHoldItem[] {
  return held.get(id) ?? EMPTY
}

function wire(): void {
  if (wired) return
  const pty = typeof window !== 'undefined' ? window.electronAPI?.pty : undefined
  if (!pty?.onNotifyHoldChanged) return
  wired = true
  pty.onNotifyHoldChanged(applyNotifyHold)
  pty.notifyHoldList?.()
    .then(list => { for (const entry of list ?? []) applyNotifyHold(entry) })
    .catch(() => { /* an older main: nothing held */ })
}

function subscribe(listener: Listener): () => void {
  wire()
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export function useNotifyHold(id: string): readonly NotifyHoldItem[] {
  return useSyncExternalStore(subscribe, () => getNotifyHold(id), () => EMPTY)
}

/** T0904: why tab `id`'s held notifications wait now (null = not shown: an older main, not a contract-2 Tower). */
export function getNotifyHoldReason(id: string): NotifyHoldReason | null {
  return reasons.get(id) ?? null
}

export function useNotifyHoldReason(id: string): NotifyHoldReason | null {
  return useSyncExternalStore(subscribe, () => getNotifyHoldReason(id), () => null)
}

/** T0904:「立即送出」— `draft` / `reading` stop holding tab `id`'s items (up to `holdId`, or all). */
export async function sendNowNotifyHold(id: string, holdId?: string): Promise<number> {
  const pty = window.electronAPI?.pty
  if (!pty?.notifyHoldSendNow) return 0
  try {
    const count = await pty.notifyHoldSendNow(id, holdId)
    window.electronAPI.debug?.log(`[notify-hold] send-now requested terminal=${id} hold=${holdId ?? 'all'} released=${count}`)
    return typeof count === 'number' ? count : 0
  } catch (e) {
    window.electronAPI.debug?.log(`[notify-hold] send-now failed terminal=${id}: ${e instanceof Error ? e.message : String(e)}`)
    return 0
  }
}

/** Cancels one held notification of tab `id` (`holdId`), or all of them. */
export async function cancelNotifyHold(id: string, holdId?: string): Promise<number> {
  const pty = window.electronAPI?.pty
  if (!pty?.notifyHoldCancel) return 0
  try {
    const count = await pty.notifyHoldCancel(id, holdId)
    window.electronAPI.debug?.log(`[notify-hold] cancel requested terminal=${id} hold=${holdId ?? 'all'} cancelled=${count}`)
    return typeof count === 'number' ? count : 0
  } catch (e) {
    window.electronAPI.debug?.log(`[notify-hold] cancel failed terminal=${id}: ${e instanceof Error ? e.message : String(e)}`)
    return 0
  }
}
