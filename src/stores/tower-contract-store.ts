/**
 * PLAN-068 W0 / T0903 (T0902 §6′): renderer side of the BAT ↔ CT contract gate.
 *
 * Main sends `terminal:role-changed { id, role, …, towerContract }` every time a program in a tab runs
 * `bat-terminal.mjs --set-role tower [--bat-contract <n>]` (electron/terminal-role.ts). This store keeps,
 * per tab, the declared contract and its state (`towerContractStatus`, src/lib/tower-contract.ts):
 * `match` / `ct-outdated` (P-1, badge `CT↑`) / `bat-outdated` (P-2, badge `BAT↑`). The tab thumbnail
 * shows the badge (`useTowerContract`); App.tsx shows the hint as a toast once per tab
 * (`claimTowerContractHint`).
 *
 * In memory only, like main's value: never saved with the workspace. A tab leaves the store when its
 * PTY exits (main drops the value then; a ⏻ restart keeps it on both sides — main sends no exit for
 * the replaced process). Every window applies every event (cheap); only the window holding the tab
 * shows the toast.
 */
import { useSyncExternalStore } from 'react'
import { BAT_CONTRACT_VERSION, parseBatContract, towerContractMismatch, towerContractStatus, type TowerContractStatus } from '../lib/tower-contract'

export interface TowerContractEntry {
  /** The contract the Tower declared (null = none). */
  towerContract: number | null
  status: Exclude<TowerContractStatus, 'not-tower'>
}

type Listener = () => void

const entries = new Map<string, TowerContractEntry>()
const hinted = new Set<string>()
const listeners = new Set<Listener>()
let version = 0

function notify(): void {
  version++
  for (const listener of listeners) listener()
}

/**
 * Applies one `terminal:role-changed` payload; returns the tab's entry (null = not a Tower, nothing
 * recorded). A missing / invalid `towerContract` (an older main) counts as not declared.
 */
export function applyTowerContract(info: { id?: unknown; role?: unknown; towerContract?: unknown } | null | undefined): TowerContractEntry | null {
  if (!info || typeof info.id !== 'string' || !info.id) return null
  const id = info.id
  const towerContract = parseBatContract(info.towerContract)
  const status = towerContractStatus(typeof info.role === 'string' ? info.role : null, towerContract)
  if (status === 'not-tower') {
    if (entries.delete(id)) notify()
    return null
  }
  const prev = entries.get(id)
  if (prev && prev.status === status && prev.towerContract === towerContract) return prev
  const entry: TowerContractEntry = { towerContract, status }
  entries.set(id, entry)
  notify()
  return entry
}

/** The tab's PTY ended (main forgot its role and contract). The once-per-tab hint stays claimed. */
export function clearTowerContract(id: string): void {
  if (entries.delete(id)) notify()
}

export function getTowerContract(id: string): TowerContractEntry | null {
  return entries.get(id) ?? null
}

/**
 * true the first time a tab's entry is a mismatch (P-1 / P-2): the caller shows the toast. Later
 * calls for the same tab are false — one toast per tab for the life of this window.
 */
export function claimTowerContractHint(id: string, entry: TowerContractEntry | null): boolean {
  if (!entry || !towerContractMismatch(entry.status) || hinted.has(id)) return false
  hinted.add(id)
  return true
}

/** The badge text: `CT↑` (P-1) / `BAT↑` (P-2); null = no badge. */
export function towerContractBadge(entry: TowerContractEntry | null): string | null {
  if (!entry) return null
  return entry.status === 'ct-outdated' ? 'CT↑' : entry.status === 'bat-outdated' ? 'BAT↑' : null
}

/** The i18n key and values of the hint (tooltip and toast); null = no hint. */
export function towerContractHint(entry: TowerContractEntry | null): { key: string; values: { supported: number; requested?: number } } | null {
  if (!entry) return null
  if (entry.status === 'ct-outdated') return { key: 'towerContract.ctOutdated', values: { supported: BAT_CONTRACT_VERSION } }
  if (entry.status === 'bat-outdated') {
    return { key: 'towerContract.batOutdated', values: { supported: BAT_CONTRACT_VERSION, requested: entry.towerContract ?? BAT_CONTRACT_VERSION } }
  }
  return null
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export function useTowerContract(id: string): TowerContractEntry | null {
  return useSyncExternalStore(subscribe, () => getTowerContract(id), () => null)
}

/** T0906: re-renders on any tab's change (the Inbox lists the declared Towers of a workspace). */
export function useTowerContractVersion(): number {
  return useSyncExternalStore(subscribe, () => version, () => 0)
}

/** Tests only. */
export function resetTowerContractStore(): void {
  entries.clear()
  hinted.clear()
  notify()
}
