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
import { useInboxFiles, useSelectedInboxTower, type InboxFiles } from '../../stores/inbox-store'
import { towerStateBatContract } from '../../lib/ct-tower-overview'
import {
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
  const actionCount = inboxActionCount({ workerItems: workerItems.length, pendingBugs: pendingBugs.length })
  const badge = !loading && applies ? inboxTabBadge(verdictModel.verdict, actionCount) : null
  return { ...verdictModel, files, loading, applies, workerItems, pendingBugs, counts, todo, actionCount, badge }
}
