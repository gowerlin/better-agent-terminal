/**
 * PLAN-068 W4 / T0906: the「待辦」(Inbox) data of one workspace, for the tab, its title badge and the
 * Control Tower overview (R6). The decisions are the pure functions of `src/lib/inbox-model.ts`; this
 * file only gathers their inputs from the stores.
 */
import { useSyncExternalStore } from 'react'
import { workspaceStore } from '../../stores/workspace-store'
import { getTowerContract, useTowerContractVersion } from '../../stores/tower-contract-store'
import { getTerminalAttention, useTerminalAttentionVersion } from '../../stores/terminal-attention-store'
import { getNotifyHold, useNotifyHoldVersion } from '../../stores/notify-hold-store'
import { getInterruptedAgent, useInterruptedAgentsVersion } from '../../stores/interrupted-agents-store'
import { getInboxStateLists, useInboxFiles, useInboxStoreVersion, useRecentlyClosed, useSelectedInboxTower, type InboxFiles } from '../../stores/inbox-store'
import { towerStateBatContract } from '../../lib/ct-tower-overview'
import { dueReminders, type AwaitingItem, type DueReminder, type InboxFeature, type UserAction } from '../../lib/tower-inbox'
import {
  inboxAnswerTargets,
  panelTowerTerminalIds,
  type InboxAnswerTarget,
  type RecentlyClosed,
  inboxActionCount,
  inboxApplies,
  inboxCounts,
  inboxTabBadge,
  inboxVerdict,
  pendingVerifyBugs,
  pickInboxTower,
  workerWaitItems,
  type InboxCounts,
  type InboxTower,
  type InboxVerdict,
  type WorkerWaitItem,
} from '../../lib/inbox-model'
import type { BugEntry } from '../../types/bug-tracker'
import type { AppState } from '../../types'

const subscribeWorkspaces = (listener: () => void) => workspaceStore.subscribe(listener)
const workspaceState = () => workspaceStore.getState()

function useWorkspaceState(): AppState {
  return useSyncExternalStore(subscribeWorkspaces, workspaceState, workspaceState)
}

export interface InboxVerdictModel {
  /** Declared Tower tabs of the workspace, tab order. */
  towers: InboxTower[]
  /** The one the tab follows (picked, else the first); null = none declared. */
  tower: InboxTower | null
  verdict: InboxVerdict
}

/** §6′ for workspace `workspaceId`, given its state file's `bat_contract` (null = v1). */
export function useInboxVerdict(workspaceId: string | null | undefined, stateContract: number | null): InboxVerdictModel {
  const state = useWorkspaceState()
  useTowerContractVersion()
  const selected = useSelectedInboxTower(workspaceId)
  const towers: InboxTower[] = []
  if (workspaceId) {
    for (const terminal of state.terminals) {
      if (terminal.workspaceId !== workspaceId) continue
      const entry = getTowerContract(terminal.id)
      if (entry) towers.push({ id: terminal.id, title: terminal.title, towerContract: entry.towerContract })
    }
  }
  const tower = pickInboxTower(towers, selected)
  return { towers, tower, verdict: inboxVerdict(tower, stateContract) }
}

export interface InboxModel extends InboxVerdictModel {
  files: InboxFiles
  /** Files still loading for this folder. */
  loading: boolean
  /** A declared Tower or a `_ct-workorders/` folder exists (`inboxApplies`). */
  applies: boolean
  workerItems: WorkerWaitItem[]
  pendingBugs: BugEntry[]
  counts: InboxCounts
  todo: string[]
  /** T0908: `awaiting_user` (oldest first), each with the open work orders paused on it. */
  awaiting: Array<AwaitingItem & { waitingOrders: string[] }>
  /** T0908: `user_actions` (oldest first). */
  actions: UserAction[]
  /** T0908: reminders due or due within 7 days. */
  reminders: DueReminder[]
  /** T0908: items skipped as malformed, per list. */
  skipped: { awaiting: number; actions: number; reminders: number }
  /** PLAN-069 / T0922: the known CT `inbox_features` (`dismiss` → the 放棄 / 略過 controls). */
  features: InboxFeature[]
  /** T0908: CT `user_inbox` (off = CT writes neither list). */
  userInbox: 'on' | 'off'
  /** T0908: items that left the lists this run (newest first, ≤ 10). */
  recentlyClosed: readonly RecentlyClosed[]
  /** T0908: where an answer goes (`auto` when exactly one). */
  answerTargets: { targets: InboxAnswerTarget[]; auto: InboxAnswerTarget | null }
  /** Things that need your hands (title number). */
  actionCount: number
  /** Text after the tab name (`!` / count / null). */
  badge: string | null
}

export function useInboxModel(workspaceId: string | null | undefined, folder: string | null | undefined): InboxModel {
  const files = useInboxFiles(folder)
  const stateContract = files.state?.status === 'loaded' ? towerStateBatContract(files.state.parsed) : null
  const verdictModel = useInboxVerdict(workspaceId, stateContract)
  const state = useWorkspaceState()
  useTerminalAttentionVersion()
  useNotifyHoldVersion()
  useInterruptedAgentsVersion()

  const terminals = workspaceId ? state.terminals.filter(t => t.workspaceId === workspaceId) : []
  const workerItems = workerWaitItems(terminals, {
    getAttention: getTerminalAttention,
    getHeld: (id) => {
      const items = getNotifyHold(id)
      return { count: items.length, since: items.length > 0 ? Math.min(...items.map(item => item.heldAt)) : null }
    },
    getInterrupted: (id) => {
      const agent = getInterruptedAgent(id)
      return agent ? { agent: agent.agent, at: agent.at } : null
    },
  })
  const pendingBugs = pendingVerifyBugs(files.bugs)
  const counts = inboxCounts(files.bugs, files.plans, files.orderStatuses)
  const todo = files.state?.status === 'loaded' && files.state.parsed.kind === 'summary' ? files.state.parsed.summary.todo : []
  const loading = files.hasCtDir === null
  const applies = inboxApplies(verdictModel.towers.length > 0, files.hasCtDir)
  // T0908: the contract v2 lists (shown only on a match; `user_inbox: off` = CT writes none)
  const userInbox = files.userInbox ?? 'on'
  const lists = files.lists ?? null
  const waitingByUser = new Map<string, string[]>()
  for (const entry of files.waitingOrders ?? []) waitingByUser.set(entry.userId, [...(waitingByUser.get(entry.userId) ?? []), entry.orderId])
  const awaiting = (lists?.awaiting ?? []).map(item => ({ ...item, waitingOrders: waitingByUser.get(item.id) ?? [] }))
  const actions = lists?.actions ?? []
  const reminders = dueReminders(lists?.reminders ?? [], Date.now())
  const skipped = lists?.skipped ?? { awaiting: 0, actions: 0, reminders: 0 }
  const features = lists?.features ?? []
  const recentlyClosed = useRecentlyClosed(folder)
  // panel Towers: T0909's definition (`panelTowerTerminalIds`, same file as the verdict)
  const panelIds = new Set(panelTowerTerminalIds(terminals, stateContract, verdictModel.towers.length))
  const panels = terminals.filter(t => panelIds.has(t.id)).map(t => ({ id: t.id, title: t.title }))
  const answerTargets = inboxAnswerTargets(verdictModel.towers, panels, stateContract)
  const actionCount = inboxActionCount({
    workerItems: workerItems.length,
    pendingBugs: pendingBugs.length,
    awaiting: awaiting.length,
    actions: actions.length,
    reminders: reminders.length,
  })
  const badge = !loading && applies ? inboxTabBadge(verdictModel.verdict, actionCount) : null
  return {
    ...verdictModel, files, loading, applies, workerItems, pendingBugs, counts, todo,
    awaiting, actions, reminders, skipped, features, userInbox, recentlyClosed, answerTargets, actionCount, badge,
  }
}

/**
 * T0908: the `⏸N` of a workspace (pending decisions), for the Tower thumbnail and the workspace
 * list: the number of `awaiting_user` items when the workspace's Inbox judges `match` (§6′, the
 * Tower its picker follows), else 0. Reads whichever copy of the state file this window has (the
 * full Inbox load, or the state-only one of `InboxStateSource`); 0 when nothing was read.
 */
export function useInboxAwaitingCount(workspaceId: string | null | undefined, folder: string | null | undefined): number {
  useInboxStoreVersion()
  const copy = getInboxStateLists(folder)
  const { verdict } = useInboxVerdict(workspaceId, copy?.batContract ?? null)
  if (!copy || verdict.kind !== 'match') return 0
  return copy.lists?.awaiting.length ?? 0
}
