/**
 * PLAN-068 W5 / T0908 (T0902 §2.4 / §4): sending one answer line from the「待辦」(Inbox) tab.
 *
 *   target                         path
 *   contract-2 Tower tab (PTY)     `tower-inbox:answer` (local IPC, or proxied to the tab's bat-server)
 *                                  → `NotifyHoldController.enqueueAnswer` (held by a prompt / `draft`)
 *   panel Tower (Claude Agent)     window event `PANEL_TOWER_ANSWER_EVENT` → the mounted panel puts
 *                                  the line in its input box and sends it (T0815's queued send path);
 *                                  refused while the panel's input box has text (`draft`, the panel
 *                                  knows it — no guessing)
 *
 * 🔴 Logs ids, lengths and results only, never the line.
 */
import { checkInboxAnswer, inboxAnswerLogIds } from './tower-inbox'
import type { InboxAnswerTarget } from './inbox-model'

/** Window event a Claude Agent panel (its `sessionId` = the tab id) answers synchronously. */
export const PANEL_TOWER_ANSWER_EVENT = 'bat:panel-tower-answer'

export interface PanelTowerAnswerDetail {
  sessionId: string
  text: string
  /** Called by the panel before the dispatch returns. */
  respond: (result: 'sent' | 'draft') => void
}

export type InboxAnswerOutcome =
  | { status: 'sent' }
  /** Waits in the Tower tab's queue (why: the tab's "📨 待送" reason). */
  | { status: 'held' }
  /** The panel's input box has text: the user sends or clears it first. */
  | { status: 'draft' }
  /** No panel with that id is mounted in this window. */
  | { status: 'not-mounted' }
  | { status: 'failed'; reason: string }

function log(message: string): void {
  try { window.electronAPI?.debug?.log?.(message) } catch { /* logging only */ }
}

/** `id=U-3`, or `id=U-1 ids=3` for a PLAN-069 batch line (ids and counts only). */
function answerId(text: string): string {
  return inboxAnswerLogIds(text)
}

/** Sends `text` to a Claude Agent panel Tower in this window. */
export function sendPanelTowerAnswer(sessionId: string, text: string): InboxAnswerOutcome {
  let result: 'sent' | 'draft' | null = null
  const detail: PanelTowerAnswerDetail = { sessionId, text, respond: (r) => { if (result === null) result = r } }
  window.dispatchEvent(new CustomEvent<PanelTowerAnswerDetail>(PANEL_TOWER_ANSWER_EVENT, { detail }))
  const outcome: InboxAnswerOutcome = result === 'sent' ? { status: 'sent' } : result === 'draft' ? { status: 'draft' } : { status: 'not-mounted' }
  log(`[tower-inbox] answer panel=${sessionId} ${answerId(text)} len=${text.length} → ${outcome.status}`)
  return outcome
}

/** Sends one answer line to `target`. Never throws. */
export async function sendInboxAnswer(target: InboxAnswerTarget, text: string): Promise<InboxAnswerOutcome> {
  const check = checkInboxAnswer(text)
  if (check !== 'ok') return { status: 'failed', reason: check }
  if (target.kind === 'panel') return sendPanelTowerAnswer(target.id, text)
  const api = window.electronAPI?.towerInbox
  if (!api?.answer) return { status: 'failed', reason: 'unsupported' }
  try {
    const result = await api.answer(target.id, text)
    const outcome: InboxAnswerOutcome = result?.ok
      ? (result.held ? { status: 'held' } : { status: 'sent' })
      : { status: 'failed', reason: result?.reason ?? 'unknown' }
    log(`[tower-inbox] answer terminal=${target.id} ${answerId(text)} len=${text.length} → ${outcome.status}${outcome.status === 'failed' ? ` (${outcome.reason})` : ''}`)
    return outcome
  } catch (err) {
    const reason = err instanceof Error && /No handler/i.test(err.message) ? 'unsupported' : 'error'
    log(`[tower-inbox] answer terminal=${target.id} ${answerId(text)} len=${text.length} → failed (${reason})`)
    return { status: 'failed', reason }
  }
}
