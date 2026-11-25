/**
 * PLAN-068 W6 / T0909 (T0909 Q-1, Tower answer A): decides, for the Claude Agent panels this window
 * shows, whether each is a panel Tower (`panelTowerTerminalIds`, src/lib/inbox-model.ts) and tells the
 * host through `createPanelTowerSync` (src/stores/panel-tower-store.ts). Mounted once per window (App:
 * the main window's workspaces; a detached window: its own workspace).
 *
 * Inputs: the workspace's `_tower-state.md` as `inbox-store` has it (loaded by `InboxDataSource` for the
 * workspace a window shows; a workspace never shown has no state → not a match → false), and its
 * declared Tower tabs (`tower-contract-store`). Re-decided whenever any of them changes.
 */
import { useEffect, useMemo, useSyncExternalStore } from 'react'
import { workspaceStore, ownsTerminalForCloseRequest } from '../../stores/workspace-store'
import { getTowerContract, useTowerContractVersion } from '../../stores/tower-contract-store'
import { getInboxFiles, useInboxStoreVersion } from '../../stores/inbox-store'
import { createPanelTowerSync } from '../../stores/panel-tower-store'
import { towerStateBatContract } from '../../lib/ct-tower-overview'
import { CLAUDE_PANEL_PRESETS, panelTowerTerminalIds } from '../../lib/inbox-model'
import type { AppState } from '../../types'

const subscribeWorkspaces = (listener: () => void) => workspaceStore.subscribe(listener)
const workspaceState = () => workspaceStore.getState()

/** Every Claude panel of the window's workspaces → whether it is a panel Tower now. */
export function decidePanelTowers(
  state: Pick<AppState, 'workspaces' | 'terminals'>,
  owns: (workspaceId: string) => boolean,
  deps: {
    stateContract: (folder: string) => number | null
    isDeclaredTower: (terminalId: string) => boolean
  },
): Map<string, boolean> {
  const desired = new Map<string, boolean>()
  for (const workspace of state.workspaces) {
    if (!owns(workspace.id)) continue
    const terminals = state.terminals.filter(t => t.workspaceId === workspace.id)
    const panels = terminals.filter(t => typeof t.agentPreset === 'string' && CLAUDE_PANEL_PRESETS.includes(t.agentPreset))
    if (panels.length === 0) continue
    const declared = terminals.filter(t => deps.isDeclaredTower(t.id)).length
    const towers = new Set(panelTowerTerminalIds(panels, deps.stateContract(workspace.folderPath), declared))
    for (const panel of panels) desired.set(panel.id, towers.has(panel.id))
  }
  return desired
}

export function PanelTowerSync({ detachedWorkspaceId, detachedIds }: { detachedWorkspaceId: string | null; detachedIds: ReadonlySet<string> }) {
  const state = useSyncExternalStore(subscribeWorkspaces, workspaceState, workspaceState)
  const contractVersion = useTowerContractVersion()
  const inboxVersion = useInboxStoreVersion()
  const sync = useMemo(() => createPanelTowerSync({
    setPanelTower: (id, tower) => window.electronAPI.towerCards.setPanelTower(id, tower),
    log: (message) => window.electronAPI.debug.log(message),
  }), [])

  useEffect(() => {
    // a remote window that connected again: its bat-server may have restarted and forgotten them
    return window.electronAPI.remote?.onClientStatusChanged?.((status) => sync.onStatus(status))
  }, [sync])

  useEffect(() => {
    const desired = decidePanelTowers(
      state,
      (workspaceId) => ownsTerminalForCloseRequest({ workspaceId }, detachedWorkspaceId, detachedIds),
      {
        stateContract: (folder) => {
          const files = getInboxFiles(folder)
          return files.state?.status === 'loaded' ? towerStateBatContract(files.state.parsed) : null
        },
        isDeclaredTower: (id) => getTowerContract(id) !== null,
      },
    )
    sync.apply(desired)
  }, [state, contractVersion, inboxVersion, detachedWorkspaceId, detachedIds, sync])

  return null
}
