/**
 * T0788 / BUG-196: the notifications BAT holds back from a tab that waits for the user
 * (electron/notify-hold.ts). Shared by main (the `terminal:notify-hold-changed` payload, the
 * `terminal:notify-hold-list` answer) and the renderer (src/stores/notify-hold-store.ts).
 *
 * PLAN-068 W2 / T0904: a Tower tab of the BAT ↔ CT contract 2 also holds while the user has a draft
 * in its input box (`draft`) or is reading it (`reading`), and the queue takes inbox answers
 * (`kind: 'answer'`, sent by W5).
 *
 * 🔴 Never the text: an item says who sent it, when, and what it holds (text / Enter).
 */

/**
 * Why a tab's queue waits now: T0788's `permission` / `question` / `elicitation` / `input` (a prompt
 * waits for the user), `draft` (the user's unsent text, T0904), `reading` (the user reads, T0904),
 * `queued` (behind an item that is being sent).
 */
export type NotifyHoldReason = 'permission' | 'question' | 'elicitation' | 'input' | 'draft' | 'reading' | 'queued'

/** The reasons「立即送出」may skip (a prompt reason never: its Enter would answer the prompt, BUG-196). */
export const NOTIFY_HOLD_SKIPPABLE_REASONS: readonly NotifyHoldReason[] = ['draft', 'reading']

/** One held notification (a helper's `pty:write`, its Enter, or both), or an inbox answer. */
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
  /** T0904: `answer` = the user's answer from the inbox (W5); absent = a helper notification. */
  kind?: 'answer'
}

/** `terminal:notify-hold-changed`: tab `terminalId`'s held notifications now (empty = none). */
export interface NotifyHoldChangedEvent {
  terminalId: string
  items: NotifyHoldItem[]
  /** T0904: why the first item waits now (absent: an older main, or nothing waits). */
  reason?: NotifyHoldReason
}

/** T0904: `terminal:notify-hold-reminder` — a notification has waited for the user's draft this long. */
export interface NotifyHoldReminderEvent {
  terminalId: string
  /** Items held. */
  count: number
  /** ms epoch the first item began to wait. */
  heldSince: number
  reason: 'draft'
}

/**
 * PLAN-068 W5 / T0908: what `tower-inbox:answer` answers (electron/notify-hold.ts
 * `registerTowerInboxAnswerHandler`). `held` = it waits in the tab's queue (why: the tab's
 * `terminal:notify-hold-changed` reason). `FORBIDDEN` = a helper capability called it; `INVALID_ARGS`
 * = not `{ terminalId, text }`; `invalid` = not one line of ≤ 1,000 chars starting `U-n：` / `A-n：`;
 * `unavailable` = this host has no controller.
 */
export type TowerInboxAnswerResult =
  | { ok: true; held: boolean; holdId: string }
  | { ok: false; reason: 'invalid' | 'pty-not-found' | 'not-contract-tower' | 'held-full' | 'FORBIDDEN' | 'INVALID_ARGS' | 'unavailable' }

/**
 * T0971 / BUG-237: what `tower-inbox:menu-hint { terminalId, menu }` answers (electron/notify-hold.ts
 * `registerTowerInboxMenuHintHandler`, read only). `ids` = the `U-n` of `menu` whose answer BAT would close the
 * Tower's open menu for (`NotifyHoldController.menuEscPreview` → `menuEscDecision`); `via` = what says the menu
 * is open (`question`, or the menu record alone: `menu`; null = no menu BAT could close); `decision` = why
 * (diagnostics only). `FORBIDDEN` = a helper capability; `INVALID_ARGS` = not `{ terminalId, menu }` with a
 * well-formed menu object; `unavailable` = this host has no controller.
 */
export type TowerInboxMenuHintResult =
  | { ok: true; ids: string[]; via: 'question' | 'menu' | null; decision: string }
  | { ok: false; reason: 'FORBIDDEN' | 'INVALID_ARGS' | 'unavailable' }
