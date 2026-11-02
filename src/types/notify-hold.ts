/**
 * T0788 / BUG-196: the notifications BAT holds back from a tab that waits for the user
 * (electron/notify-hold.ts). Shared by main (the `terminal:notify-hold-changed` payload, the
 * `terminal:notify-hold-list` answer) and the renderer (src/stores/notify-hold-store.ts).
 *
 * 🔴 Never the text: an item says who sent it, when, and what it holds (text / Enter).
 */

/** One held notification (a helper's `pty:write`, its Enter, or both). */
export interface NotifyHoldItem {
  /** `h-<n>`, unique in this BAT process. */
  holdId: string
  /** The helper's terminal (a Worker tab); absent when the caller had no terminal. */
  sourceTerminalId?: string
  /** The work order it reported (`--source T####`, or the Worker tab's work order). */
  workorder?: string
  /** ms epoch the hold began. */
  heldAt: number
  /** The text is still to be written. */
  hasText: boolean
  /** The Enter (`--submit`) is still to be sent. */
  hasEnter: boolean
}

/** `terminal:notify-hold-changed`: tab `terminalId`'s held notifications now (empty = none). */
export interface NotifyHoldChangedEvent {
  terminalId: string
  items: NotifyHoldItem[]
}
