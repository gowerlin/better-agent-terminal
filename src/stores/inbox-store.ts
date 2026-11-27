/**
 * PLAN-068 W4 / T0906: renderer state of the「待辦」(Inbox) tab.
 *
 *   - the CT files of a workspace folder, as `InboxDataSource` loaded them (one loader per window for
 *     the workspace it shows; the tab title badge, the tab and the overview's R6 read the same copy)
 *   - the Tower picked in a workspace's picker (memory only)
 *   - "open this" requests between the sidebar tabs: Inbox → Control Tower sub-tab (Bugs / Backlog /
 *     Work orders), Control Tower overview → Inbox (R6). App moves the dock; the target panel takes the
 *     pending request when it mounts or hears the event.
 *
 * In memory only; nothing here is saved. Never any terminal output or message text.
 */
import { useSyncExternalStore } from 'react'
import type { BugEntry } from '../types/bug-tracker'
import type { BacklogEntry } from '../types/backlog'
import type { WorkOrderStatus } from '../types/control-tower'
import type { TowerStateParse } from '../lib/ct-tower-overview'
import type { TowerInboxLists } from '../lib/tower-inbox'
import { nextRecentlyClosed, type RecentlyClosed } from '../lib/inbox-model'
import { pruneInboxSent, resetInboxSentStore } from './inbox-sent-store'

/** `_tower-state.md` as the loader read it. */
export type InboxStateLoad =
  | { status: 'missing' }
  | { status: 'error'; error: string }
  | { status: 'loaded'; parsed: TowerStateParse }

export interface InboxFiles {
  /** `_ct-workorders/` readable; null = not loaded yet. */
  hasCtDir: boolean | null
  state: InboxStateLoad | null
  bugs: BugEntry[]
  plans: BacklogEntry[]
  /** Status of every work order file directly in `_ct-workorders/`. */
  orderStatuses: WorkOrderStatus[]
  /** Files that exist but could not be read (relative names), shown as a muted line. */
  readErrors: string[]
  /**
   * PLAN-068 W5 / T0908: the contract v2 lists of `_tower-state.md` (`awaiting_user` / `user_actions`
   * / `reminders`); null / absent = no usable summary.
   */
  lists?: TowerInboxLists | null
  /** T0908: open work orders whose frontmatter `waiting_user` names a pending decision. */
  waitingOrders?: Array<{ orderId: string; userId: string }>
  /** T0908: CT `user_inbox` (project `_tower-config.yaml`, then the global layer); absent = `on`. */
  userInbox?: 'on' | 'off'
}

export const EMPTY_INBOX_FILES: InboxFiles = Object.freeze({
  hasCtDir: null,
  state: null,
  bugs: [],
  plans: [],
  orderStatuses: [],
  readErrors: [],
}) as InboxFiles

type Listener = () => void

const files = new Map<string, InboxFiles>()
/** T0908: per folder, the last items that left `awaiting_user` / `user_actions` (newest first, ≤ 10). */
const recentlyClosed = new Map<string, RecentlyClosed[]>()
/**
 * T0908: per folder, only `_tower-state.md` (`bat_contract` + lists) of a workspace that is not the one
 * a window shows — the workspace list's `⏸N` (`InboxStateSource`).
 */
const stateOnly = new Map<string, { batContract: number | null; lists: TowerInboxLists | null }>()
const selectedTowers = new Map<string, string>()
const listeners = new Set<Listener>()
let version = 0

function notify(): void {
  version++
  for (const listener of listeners) listener()
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export function setInboxFiles(folder: string, next: InboxFiles): void {
  const prev = files.get(folder)
  // T0908: an item gone from a list that was read both times is closed (CT removes it on the answer)
  if (prev?.lists && next.lists) {
    const closed = nextRecentlyClosed(recentlyClosed.get(folder) ?? [], prev.lists, next.lists, Date.now())
    if (closed !== recentlyClosed.get(folder)) recentlyClosed.set(folder, closed)
  }
  files.set(folder, next)
  // T0942: an item gone from the lists (read this time) takes its「已送出」record with it
  if (next.lists) pruneInboxSent(folder, new Set([...next.lists.awaiting.map(item => item.id), ...next.lists.actions.map(item => item.id)]))
  notify()
}

const NO_CLOSED: readonly RecentlyClosed[] = Object.freeze([])

/** T0908: the recently closed items of `folder` (memory only, this run). */
export function getRecentlyClosed(folder: string | null | undefined): readonly RecentlyClosed[] {
  return (folder && recentlyClosed.get(folder)) || NO_CLOSED
}

export function useRecentlyClosed(folder: string | null | undefined): readonly RecentlyClosed[] {
  return useSyncExternalStore(subscribe, () => getRecentlyClosed(folder), () => NO_CLOSED)
}

/** T0908: `_tower-state.md` only, for a workspace no window shows (null clears it). */
export function setInboxStateOnly(folder: string, value: { batContract: number | null; lists: TowerInboxLists | null } | null): void {
  if (value === null) {
    if (stateOnly.delete(folder)) notify()
    return
  }
  stateOnly.set(folder, value)
  notify()
}

/**
 * T0908: `bat_contract` and the lists of `folder` — the full copy when a window loads it, else the
 * state-only copy; null = nothing read.
 */
export function getInboxStateLists(folder: string | null | undefined): { batContract: number | null; lists: TowerInboxLists | null } | null {
  if (!folder) return null
  const full = files.get(folder)
  if (full && full.hasCtDir !== null) {
    const parsed = full.state?.status === 'loaded' ? full.state.parsed : null
    const batContract = parsed?.kind === 'summary' && typeof parsed.summary.batContract === 'number' ? parsed.summary.batContract : null
    return { batContract, lists: full.lists ?? null }
  }
  return stateOnly.get(folder) ?? null
}

export function getInboxFiles(folder: string | null | undefined): InboxFiles {
  return (folder && files.get(folder)) || EMPTY_INBOX_FILES
}

export function useInboxFiles(folder: string | null | undefined): InboxFiles {
  return useSyncExternalStore(subscribe, () => getInboxFiles(folder), () => EMPTY_INBOX_FILES)
}

/** The Tower picked in workspace `workspaceId`'s picker (null = none picked → the first one). */
export function setSelectedInboxTower(workspaceId: string, terminalId: string | null): void {
  if (terminalId) selectedTowers.set(workspaceId, terminalId)
  else selectedTowers.delete(workspaceId)
  notify()
}

export function getSelectedInboxTower(workspaceId: string | null | undefined): string | null {
  return (workspaceId && selectedTowers.get(workspaceId)) || null
}

export function useSelectedInboxTower(workspaceId: string | null | undefined): string | null {
  return useSyncExternalStore(subscribe, () => getSelectedInboxTower(workspaceId), () => null)
}

export function useInboxStoreVersion(): number {
  return useSyncExternalStore(subscribe, () => version, () => 0)
}

// ─── Navigation between sidebar tabs ───────────────────────────────────────

/** Window event: App shows the dockable panel (`detail.panel`) wherever it is docked. */
export const OPEN_DOCK_PANEL_EVENT = 'bat:open-dock-panel'
/** Window event: a mounted Control Tower panel switches to `detail.tab`. */
export const OPEN_CONTROL_TOWER_TAB_EVENT = 'bat:open-control-tower-tab'

export type ControlTowerTabRequest = 'bugs' | 'backlog' | 'orders'

let pendingControlTowerTab: ControlTowerTabRequest | null = null

/** Show the Inbox tab (R6:「在待辦分頁查看」). */
export function requestOpenInbox(): void {
  window.dispatchEvent(new CustomEvent(OPEN_DOCK_PANEL_EVENT, { detail: { panel: 'inbox' } }))
}

/** Show the Control Tower panel on `tab`; a panel not mounted yet takes it when it mounts. */
export function requestControlTowerTab(tab: ControlTowerTabRequest): void {
  pendingControlTowerTab = tab
  window.dispatchEvent(new CustomEvent(OPEN_DOCK_PANEL_EVENT, { detail: { panel: 'control-tower' } }))
  window.dispatchEvent(new CustomEvent(OPEN_CONTROL_TOWER_TAB_EVENT, { detail: { tab } }))
}

/** The Control Tower panel takes the request once (on mount, or when the event arrives). */
export function takeControlTowerTabRequest(): ControlTowerTabRequest | null {
  const tab = pendingControlTowerTab
  pendingControlTowerTab = null
  return tab
}

/** Tests only. */
export function resetInboxStore(): void {
  files.clear()
  recentlyClosed.clear()
  stateOnly.clear()
  selectedTowers.clear()
  pendingControlTowerTab = null
  resetInboxSentStore()
  notify()
}
