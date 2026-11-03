// T0802 / D247: renderer copy of the main process's whisper availability (electron/voice-availability.ts).
// One subscription per window, started by the first reader. Before the main process answers — and in any
// environment without the IPC (tests, old preload) — the state is `unknown(pending)`, which keeps the
// pre-T0802 behaviour. See docs/agent-guide/voice-availability.md.

import { useSyncExternalStore } from 'react'
import { VOICE_AVAILABILITY_PENDING, type VoiceAvailability } from './voice-availability'

let current: VoiceAvailability = VOICE_AVAILABILITY_PENDING
let started = false
let unsubscribeIpc: (() => void) | null = null
const listeners = new Set<() => void>()

function isAvailability(v: unknown): v is VoiceAvailability {
  const s = (v as { state?: unknown } | null)?.state
  return s === 'available' || s === 'unavailable' || s === 'unknown'
}

function set(next: unknown): void {
  if (!isAvailability(next)) return
  current = next
  for (const l of listeners) l()
}

function voiceApi() {
  try {
    return (window as unknown as { electronAPI?: { voice?: Partial<Window['electronAPI']['voice']> } }).electronAPI?.voice
  } catch {
    return undefined
  }
}

function ensureStarted(): void {
  if (started) return
  started = true
  const api = voiceApi()
  try {
    unsubscribeIpc = api?.onAvailabilityChanged?.((a) => set(a)) ?? null
  } catch { /* old preload */ }
  try {
    void api?.getAvailability?.().then(set, () => { /* stays unknown */ })
  } catch { /* old preload */ }
}

export function getVoiceAvailabilitySnapshot(): VoiceAvailability {
  ensureStarted()
  return current
}

function subscribe(listener: () => void): () => void {
  ensureStarted()
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export function useVoiceAvailability(): VoiceAvailability {
  return useSyncExternalStore(subscribe, getVoiceAvailabilitySnapshot, getVoiceAvailabilitySnapshot)
}

/** Settings › Voice「重新檢查」. Resolves with the new state (or the current one when the IPC is missing / fails). */
export async function recheckVoiceAvailability(): Promise<VoiceAvailability> {
  ensureStarted()
  try {
    const next = await voiceApi()?.recheckAvailability?.()
    set(next)
  } catch { /* keep the current state */ }
  return current
}

/** Tests only. */
export function __setVoiceAvailabilityForTests(next: VoiceAvailability | null): void {
  if (next === null) {
    unsubscribeIpc?.()
    unsubscribeIpc = null
    started = false
    current = VOICE_AVAILABILITY_PENDING
    for (const l of listeners) l()
    return
  }
  started = true
  set(next)
}
