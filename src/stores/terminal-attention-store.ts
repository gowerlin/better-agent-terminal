/**
 * T0609 (BUG-153): renderer side of `terminal:attention-changed` — main (or a remote server) tells
 * every window that a tab waits for the user (a claude hook `blocked`) or for its Tower's answer
 * (tower questions). The Worker badge (TerminalThumbnail) and the Tower's batch close
 * (`reportedWorkersOfTower`) read it. In memory only — never saved with the workspace; a window
 * that reloads knows nothing until the tab's next change.
 */
import { useSyncExternalStore } from 'react'
import { isEmptyAttention, type TerminalAttentionEvent } from '../lib/terminal-attention'

type Listener = () => void

const attention = new Map<string, TerminalAttentionEvent>()
const listeners = new Set<Listener>()
/** Bumped on every change (`useTerminalAttentionVersion`: lists that count over many tabs). */
let version = 0

function notify(): void {
  version++
  for (const listener of listeners) listener()
}

export function setTerminalAttention(info: TerminalAttentionEvent): void {
  if (!info || typeof info.id !== 'string') return
  if (isEmptyAttention(info)) {
    if (attention.delete(info.id)) notify()
    return
  }
  attention.set(info.id, info)
  notify()
}

export function clearTerminalAttention(id: string): void {
  if (attention.delete(id)) notify()
}

export function getTerminalAttention(id: string): TerminalAttentionEvent | null {
  return attention.get(id) ?? null
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export function useTerminalAttention(id: string): TerminalAttentionEvent | null {
  return useSyncExternalStore(subscribe, () => getTerminalAttention(id), () => null)
}

/** Re-renders on any tab's change (the Tower's "Close reported Worker tabs (N)"). */
export function useTerminalAttentionVersion(): number {
  return useSyncExternalStore(subscribe, () => version, () => 0)
}

/** Tests. */
export function resetTerminalAttention(): void {
  if (attention.size === 0) return
  attention.clear()
  notify()
}
