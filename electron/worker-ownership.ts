/**
 * PLAN-041 / T0537: Worker ownership saved with the tabs, for `--close-worker` after BAT reopens.
 *
 * T0535 keeps a Worker's tower (`customEnv.BAT_TOWER_TERMINAL_ID`) and work order on its
 * PtyInstance, in memory only. After BAT reopens, the PTY is either registered again from the
 * Terminal Server's list (T0108, no customEnv) or re-created by the restored tab as a plain shell
 * — neither knows its tower or work order, so `--close-worker` answered NOT_FOUND. Tab and Tower
 * ids survive the reopen, and the renderer saves `towerTerminalId` / `workorder` with the Worker
 * tab (`addExternalTerminal` → `workspace:save` → window registry). This module lets the
 * scheduler fall back to that saved data for a running PTY this process recorded nothing for.
 *
 * Why main reads the registry instead of the restored tab handing the ownership back with
 * `pty:create`: the registry holds every saved tab, so a Worker in a workspace that has not been
 * opened since the reopen (its PTY still running on the Terminal Server, no `pty:create` yet) is
 * found too; and the ownership comes only from what BAT windows saved (`workspace:save` needs a
 * window — `ctx.windowId`), never from a request parameter.
 *
 * What this process recorded wins over the saved data (a Worker dispatched in this session,
 * `pty:restart`, the Terminal Server recovery). A saved tab counts only while its PTY runs.
 *
 * PLAN-047 W1 / T0583: a Worker dispatched with `--isolation worktree` saves its worktree with the tab
 * (`ctWorktree`), so `--close-worker --worktree remove|archive` still cleans it after BAT reopens.
 * Only a record that follows the location / branch rules (`parseCtWorktreeRecord`) is taken.
 *
 * 🔴 No `electron` import here (unit-tested without Electron).
 */
import { normalizeWorkorderId, type CloseWorkerPtyManager } from './close-worker'
import { parseCtWorktreeRecord, type CtWorktreeRecord } from './ct-worktree'

export interface SavedWorkerOwnership {
  towerTerminalId: string
  workorder: string
  /** T0583: the saved worktree of an isolated Worker (its work order matches the tab's). */
  worktree?: CtWorktreeRecord
}

/** What the fallback needs from PtyManager on top of the scheduler's view. */
export interface WorkerOwnershipPtyManager extends CloseWorkerPtyManager {
  /** The work order this process recorded on PTY `id`; undefined = none. */
  getWorkorder(id: string): string | undefined
  /** T0583: the worktree this process recorded on PTY `id`. */
  getWorktree?(id: string): CtWorktreeRecord | undefined
}

/**
 * Saved Worker tabs by terminal id: tabs saved with a Tower id and a valid work order
 * (normalized). Entries are window registry entries; a detached window's tabs are in its
 * parent's entry (`saveDetachedWorkspaceTerminals`). The first tab wins when an id repeats.
 */
export function savedWorkerOwnership(entries: ReadonlyArray<{ terminals?: unknown }>, platform: NodeJS.Platform = process.platform): Map<string, SavedWorkerOwnership> {
  const owned = new Map<string, SavedWorkerOwnership>()
  for (const entry of entries) {
    if (!Array.isArray(entry?.terminals)) continue
    for (const t of entry.terminals as unknown[]) {
      if (!t || typeof t !== 'object') continue
      const { id, towerTerminalId, workorder, ctWorktree } = t as { id?: unknown; towerTerminalId?: unknown; workorder?: unknown; ctWorktree?: unknown }
      if (typeof id !== 'string' || !id || owned.has(id)) continue
      if (typeof towerTerminalId !== 'string' || !towerTerminalId.trim()) continue
      const normalized = normalizeWorkorderId(workorder)
      if (!normalized) continue
      const worktree = parseCtWorktreeRecord(ctWorktree, platform)
      owned.set(id, {
        towerTerminalId: towerTerminalId.trim(),
        workorder: normalized,
        ...(worktree && worktree.workorder === normalized ? { worktree } : {}),
      })
    }
  }
  return owned
}

/**
 * The scheduler's PTY view with the saved ownership filled in for running PTYs this process
 * recorded no work order for. `getSaved` is read once, on first use (one request = one snapshot).
 */
export function withSavedWorkerOwnership(
  ptys: WorkerOwnershipPtyManager,
  getSaved: () => Map<string, SavedWorkerOwnership>,
  logger?: { log(...args: unknown[]): void },
): CloseWorkerPtyManager {
  let saved: Map<string, SavedWorkerOwnership> | null = null
  const savedFor = (id: string): SavedWorkerOwnership | undefined => {
    if (ptys.getWorkorder(id) !== undefined || !ptys.isAlive(id)) return undefined
    saved ??= getSaved()
    return saved.get(id)
  }
  return {
    findWorkerTerminals(towerId, workorder) {
      const wanted = normalizeWorkorderId(workorder)
      if (!wanted) return []
      const ids = ptys.findWorkerTerminals(towerId, wanted)
      saved ??= getSaved()
      for (const [id, own] of saved) {
        if (own.workorder !== wanted || ids.includes(id)) continue
        if (towerId !== null && own.towerTerminalId !== towerId) continue
        if (!savedFor(id)) continue
        logger?.log(`[close-worker] id=${id} workorder=${wanted}: ownership from the saved tab (tower=${own.towerTerminalId})`)
        ids.push(id)
      }
      return ids
    },
    getTowerTerminalId(id) {
      return ptys.getWorkorder(id) !== undefined ? ptys.getTowerTerminalId(id) : savedFor(id)?.towerTerminalId
    },
    getLastOutputAt: id => ptys.getLastOutputAt(id),
    getLastUserInputAt: id => ptys.getLastUserInputAt(id),
    isAlive: id => ptys.isAlive(id),
    // T0583: what this process recorded, else the saved tab's (same rule as the ownership)
    getWorktree: id => ptys.getWorktree?.(id) ?? savedFor(id)?.worktree,
  }
}
