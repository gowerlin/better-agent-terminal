/**
 * PLAN-068 W9 / T0910 (T0902 §7.2): renderer side of each contract Tower tab's BAT hooks status.
 *
 * Main (or a remote bat-server, proxied) sends `terminal:hooks-status { id, hooksStatus }` when a Tower
 * that declared `--bat-contract` gets another status (electron/pty-manager.ts `refreshHooksStatus`):
 * at `--set-role`, at its first hook report, after a ⏻ restart / the Terminal Server recovery. This store
 * keeps the latest per tab; the thumbnail badge `🪝✕` and the Inbox header line read it, and show it
 * only for a Tower whose contract matches (R9′ — the caller checks `tower-contract-store`).
 *
 * In memory only. A tab leaves the store when its PTY exits. The store subscribes itself (once) the first
 * time a component reads it; nothing in App.tsx. Codes only — never a path or content.
 */
import { useSyncExternalStore } from 'react'
import { parseHooksStatus, type HooksStatus } from '../lib/hooks-status'

type Listener = () => void

const entries = new Map<string, HooksStatus>()
const listeners = new Set<Listener>()
let subscribed = false

function notify(): void {
  for (const listener of listeners) listener()
}

/** Applies one `terminal:hooks-status` payload (an invalid / null status removes the tab's entry). */
export function applyHooksStatus(info: { id?: unknown; hooksStatus?: unknown } | null | undefined): HooksStatus | null {
  if (!info || typeof info.id !== 'string' || !info.id) return null
  const status = parseHooksStatus(info.hooksStatus)
  if (!status) {
    if (entries.delete(info.id)) notify()
    return null
  }
  entries.set(info.id, status)
  notify()
  return status
}

export function clearHooksStatus(id: string): void {
  if (entries.delete(id)) notify()
}

export function getHooksStatus(id: string): HooksStatus | null {
  return entries.get(id) ?? null
}

/** Subscribes to main's events once (no-op without the preload API, e.g. tests). */
export function ensureHooksStatusSubscription(): void {
  if (subscribed) return
  const pty = typeof window !== 'undefined' ? window.electronAPI?.pty : undefined
  if (!pty?.onHooksStatus) return
  subscribed = true
  pty.onHooksStatus(info => { applyHooksStatus(info) })
  pty.onExit?.((id: string) => { clearHooksStatus(id) })
}

function subscribe(listener: Listener): () => void {
  ensureHooksStatusSubscription()
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export function useHooksStatus(id: string | null | undefined): HooksStatus | null {
  return useSyncExternalStore(subscribe, () => (id ? getHooksStatus(id) : null), () => null)
}

/** Tests only. */
export function resetHooksStatusStore(): void {
  entries.clear()
  subscribed = false
  notify()
}
