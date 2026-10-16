/**
 * PLAN-044 / T0566 (D148): renderer side of the usage-limit auto continue.
 *
 * - Status: main (or a remote server) sends `terminal:usage-limit-status`; the tab thumbnail shows
 *   it (`useUsageLimitStatus`). In memory only — never saved with the workspace.
 * - Continue: main sends `terminal:usage-limit-continue` when the reset (+ delay) is due; the
 *   window holding the tab (App.tsx, `ownsTerminalForCloseRequest`) calls
 *   `runUsageLimitContinue`. A mounted TerminalPanel registered a sender for the tab: it re-checks
 *   the xterm screen (`usageLimitRecheckFailure`), types the text through the automatic write
 *   path and sends Enter as a synthetic keydown (the `bat-notify --submit` path). A tab without a
 *   mounted panel falls back to writing the text and `\r` (main already re-checked its screen).
 *   Every write here is `{ auto: true }`: not the user's input.
 */
import { useSyncExternalStore } from 'react'
import { USAGE_LIMIT_ENTER_DELAY_MS, type UsageLimitContinueEvent, type UsageLimitStatus, type UsageLimitStatusEvent } from '../lib/usage-limit'

type Listener = () => void

const statuses = new Map<string, UsageLimitStatus>()
const listeners = new Set<Listener>()

function notify(): void {
  for (const listener of listeners) listener()
}

export function setUsageLimitStatus(info: UsageLimitStatusEvent): void {
  if (!info || typeof info.id !== 'string') return
  if (info.status) statuses.set(info.id, info.status)
  else if (!statuses.delete(info.id)) return
  notify()
}

export function clearUsageLimitStatus(id: string): void {
  if (statuses.delete(id)) notify()
}

export function getUsageLimitStatus(id: string): UsageLimitStatus | null {
  return statuses.get(id) ?? null
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export function useUsageLimitStatus(id: string): UsageLimitStatus | null {
  return useSyncExternalStore(subscribe, () => getUsageLimitStatus(id), () => null)
}

// ── Sending ──

export type UsageLimitSendResult = { ok: true; path: string } | { ok: false; reason: string }
export type UsageLimitSender = (info: UsageLimitContinueEvent) => Promise<UsageLimitSendResult>

const senders = new Map<string, UsageLimitSender>()

/** A mounted TerminalPanel offers its xterm for tab `id`; returns the unregister function. */
export function registerUsageLimitSender(id: string, sender: UsageLimitSender): () => void {
  senders.set(id, sender)
  return () => {
    if (senders.get(id) === sender) senders.delete(id)
  }
}

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

/** Fallback without a mounted xterm: text, a pause, then `\r` — all as automatic writes. */
async function sendWithoutTerminalView(info: UsageLimitContinueEvent): Promise<UsageLimitSendResult> {
  const pty = window.electronAPI.pty
  if (info.action === 'text' && info.text) {
    await pty.write(info.id, info.text, { auto: true })
    await sleep(USAGE_LIMIT_ENTER_DELAY_MS)
  }
  await pty.write(info.id, '\r', { auto: true })
  return { ok: true, path: 'pty-write (tab not mounted)' }
}

/** The window holding tab `info.id` continues it. */
export async function runUsageLimitContinue(info: UsageLimitContinueEvent): Promise<UsageLimitSendResult> {
  const log = (message: string) => window.electronAPI.debug.log(message)
  const what = info.action === 'text' ? `text "${info.text ?? ''}" + Enter` : 'Enter'
  log(`[usage-limit] continue received id=${info.id} agent=${info.agent} ${what} trace=${info.traceId}`)
  const sender = senders.get(info.id)
  let result: UsageLimitSendResult
  try {
    result = sender ? await sender(info) : await sendWithoutTerminalView(info)
  } catch (e) {
    result = { ok: false, reason: `error: ${e instanceof Error ? e.message : String(e)}` }
  }
  log(result.ok
    ? `[usage-limit] id=${info.id} → sent ${what} trace=${info.traceId} path=${result.path}`
    : `[usage-limit] id=${info.id} → not sent (${result.reason}) trace=${info.traceId}`)
  clearUsageLimitStatus(info.id)
  return result
}
