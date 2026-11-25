/**
 * PLAN-068 W1 / T0904 (T0902 §2.4 B0, R3′): how the renderer makes the Enter of a helper
 * notification (`bat-notify --submit` → `terminal:keypress`) and of an inbox answer.
 *
 *   - a Tower tab that declared the BAT ↔ CT contract 2 (`towerContractStatus` `match`):
 *     `terminal.input('\r', false)` — xterm's own data path, not user input: the viewport does not
 *     jump to the bottom, the selection stays, the focus does not move. Same bytes (`\r`) as the
 *     Enter key (xterm 5.5 has no kitty / win32-input keyboard protocol).
 *   - every other tab (a v1 / undeclared Tower, a tab that is not a Tower) and T0566's usage-limit
 *     continue: the synthetic keydown as before (`dispatchSyntheticEnterKeydown`).
 *
 * 🔴 No DOM / electron import (tests run it against a real xterm).
 */
import type { TowerContractStatus } from './tower-contract'

export type SubmitEnterPath = 'xterm-input' | 'dom-keydown'

/** B0 only for a contract-2 Tower; everything else keeps the keydown path. */
export function towerSubmitEnterPath(status: TowerContractStatus | null | undefined): SubmitEnterPath {
  return status === 'match' ? 'xterm-input' : 'dom-keydown'
}

/** B0: the Enter through xterm's data path, not as user input. */
export function submitEnterWithoutFocus(terminal: { input(data: string, wasUserInput?: boolean): void }): void {
  terminal.input('\r', false)
}
