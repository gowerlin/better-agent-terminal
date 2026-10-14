/**
 * T0523 / BUG-129: which workspace a helper-dispatched terminal belongs to.
 *
 * A Tower dispatches with `bat-terminal.mjs --notify-id "$BAT_TERMINAL_ID" --workspace
 * "$BAT_WORKSPACE_ID"`. Both values come from the Tower shell's environment, which BAT sets
 * once when the PTY is spawned. When that environment does not describe the tab the Tower
 * runs in any more (a `pty:restart` / Terminal Server recovery dropped it, or the agent CLI
 * restored the environment of an earlier session), the Worker tab used to land in whatever
 * workspace `--workspace` named, and `--agent default` resolved against that workspace too.
 *
 * The persisted window registry knows which workspace each tab belongs to (a tab never moves
 * between workspaces; every creation path saves it). So the Tower terminal (`--notify-id`)
 * decides when the registry knows it, and `--workspace` is the fallback:
 *   - Tower terminal found → its workspace (logged when `--workspace` named another one)
 *   - otherwise `--workspace` as given (the renderer falls back to the active workspace when
 *     the id is unknown, T0137 / T0361)
 *   - neither → the active workspace, decided by the renderer (T0137 / BUG-031)
 *
 * 🔴 No `electron` import here: called from the shared terminal command handlers.
 */

export type DispatchWorkspaceSource = 'tower-terminal' | 'requested' | 'active'

export interface DispatchWorkspaceResolution {
  /** Workspace to land in; undefined = the window's active workspace (renderer decides). */
  workspaceId?: string
  /** Its name when the registry has it (alias first). */
  workspaceName?: string
  /** The registry has this workspace (a window of this BAT holds it). */
  known: boolean
  source: DispatchWorkspaceSource
  /** `--workspace` as sent by the helper. */
  requestedWorkspaceId?: string
  /** `--notify-id` (the Tower terminal). */
  towerTerminalId?: string
  /** `--workspace` named a workspace other than the Tower terminal's. */
  mismatch: boolean
}

export interface DispatchWorkspaceRequest {
  towerTerminalId?: string
  requestedWorkspaceId?: string
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function nonEmpty(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

/** Registry entries as far as this module reads them (`WindowEntry` matches structurally). */
export interface DispatchRegistryEntry {
  workspaces?: unknown[]
  terminals?: unknown[]
}

function findWorkspace(entries: DispatchRegistryEntry[], workspaceId: string): { known: boolean; workspaceName?: string } {
  for (const entry of entries) {
    for (const raw of Array.isArray(entry.workspaces) ? entry.workspaces : []) {
      const ws = asRecord(raw)
      if (ws?.id === workspaceId) {
        const workspaceName = nonEmpty(ws.alias) ?? nonEmpty(ws.name)
        return workspaceName ? { known: true, workspaceName } : { known: true }
      }
    }
  }
  return { known: false }
}

function findTerminalWorkspace(entries: DispatchRegistryEntry[], terminalId: string): string | undefined {
  for (const entry of entries) {
    for (const raw of Array.isArray(entry.terminals) ? entry.terminals : []) {
      const terminal = asRecord(raw)
      if (terminal?.id === terminalId) return nonEmpty(terminal.workspaceId)
    }
  }
  return undefined
}

export function resolveDispatchWorkspaceFromEntries(
  entries: DispatchRegistryEntry[],
  request: DispatchWorkspaceRequest,
): DispatchWorkspaceResolution {
  const towerTerminalId = nonEmpty(request.towerTerminalId)
  const requestedWorkspaceId = nonEmpty(request.requestedWorkspaceId)
  const towerWorkspaceId = towerTerminalId ? findTerminalWorkspace(entries, towerTerminalId) : undefined

  if (towerWorkspaceId) {
    return {
      workspaceId: towerWorkspaceId,
      ...findWorkspace(entries, towerWorkspaceId),
      source: 'tower-terminal',
      requestedWorkspaceId,
      towerTerminalId,
      mismatch: Boolean(requestedWorkspaceId) && requestedWorkspaceId !== towerWorkspaceId,
    }
  }
  if (requestedWorkspaceId) {
    return {
      workspaceId: requestedWorkspaceId,
      ...findWorkspace(entries, requestedWorkspaceId),
      source: 'requested',
      requestedWorkspaceId,
      towerTerminalId,
      mismatch: false,
    }
  }
  return { source: 'active', known: false, towerTerminalId, mismatch: false }
}

/** The resolution without a registry (headless bat-server): `--workspace` as given. */
export function passThroughDispatchWorkspace(request: DispatchWorkspaceRequest): DispatchWorkspaceResolution {
  return resolveDispatchWorkspaceFromEntries([], request)
}
