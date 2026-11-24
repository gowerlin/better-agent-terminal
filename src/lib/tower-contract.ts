/**
 * PLAN-068 W0 / T0903 (D329 / D330): the BAT ↔ CT contract version gate (T0902 §6′ / §3.1′ / R11).
 *
 * A Control Tower running in a tab declares the contract it speaks with
 * `bat-terminal.mjs --set-role tower --bat-contract <n>` (electron/terminal-role.ts). Main records the
 * value on the PTY (`PtyManager.setTerminalRole` / `getTowerContract`, beside `role` / `towerMode`):
 * kept by ⏻ restart and the Terminal Server recovery, gone with the PTY, overwritten by every
 * `--set-role` (one without `--bat-contract` clears it = not declared), never saved.
 *
 * The new features of PLAN-068 (W1–W9: notification protection, turn cards, inbox) run only for a
 * Tower tab whose declaration matches `BAT_CONTRACT_VERSION`; this module is the one place that
 * decides it (`towerContractStatus`, §6′「分頁宣告」column). T0788's hold (dialog protection) is not
 * gated — it keeps working for every tab.
 *
 * 🔴 No `electron` / DOM import here (shared by main, headless and the renderer).
 */

/** The highest BAT ↔ CT contract this BAT supports (T0902 §3.1: BAT declares its maximum). */
export const BAT_CONTRACT_VERSION = 2

/**
 * One Tower tab's state against this BAT:
 * - `match`        — declared `BAT_CONTRACT_VERSION`: the new features are on
 * - `ct-outdated`  — a Tower that declared nothing, or an older contract (P-1, badge `CT↑`)
 * - `bat-outdated` — a Tower that declared a newer contract than this BAT supports (P-2, badge `BAT↑`)
 * - `not-tower`    — not a declared Tower: nothing changes (no badge, no hint)
 */
export type TowerContractStatus = 'match' | 'ct-outdated' | 'bat-outdated' | 'not-tower'

/**
 * `--bat-contract` / `terminal:set-role` `batContract` value → the declared contract, or null when it
 * is not a whole number ≥ 1 (a usage error). A string must be digits only (surrounding blanks allowed).
 */
export function parseBatContract(raw: unknown): number | null {
  let value: number
  if (typeof raw === 'number') {
    value = raw
  } else if (typeof raw === 'string') {
    const text = raw.trim()
    if (!/^[0-9]+$/.test(text)) return null
    value = Number(text)
  } else {
    return null
  }
  return Number.isSafeInteger(value) && value >= 1 ? value : null
}

/** T0902 §6′: a tab's state from its role and the contract it declared (null / undefined = none). */
export function towerContractStatus(role: string | null | undefined, towerContract: number | null | undefined): TowerContractStatus {
  if (role !== 'tower') return 'not-tower'
  if (typeof towerContract !== 'number' || !Number.isFinite(towerContract)) return 'ct-outdated'
  if (towerContract === BAT_CONTRACT_VERSION) return 'match'
  return towerContract > BAT_CONTRACT_VERSION ? 'bat-outdated' : 'ct-outdated'
}

/** The states that show a badge and a hint (P-1 / P-2). */
export function towerContractMismatch(status: TowerContractStatus): status is 'ct-outdated' | 'bat-outdated' {
  return status === 'ct-outdated' || status === 'bat-outdated'
}
