import { app } from 'electron'
import path from 'path'
import * as fs from 'fs/promises'
import * as fsSync from 'fs'
import { logger } from './logger'

/** Persisted UI layout snapshot — collected from renderer localStorage */
export interface WindowLayout {
  sidebar?: { width: number; collapsed: boolean }
  rightPanel?: { width: number; collapsed: boolean; activeTab?: string }
  split?: { pinned: unknown; ratio: number }
  thumbnailBar?: { height: number; collapsed: boolean }
  docking?: Record<string, string>
  workspaceTab?: string
  maximized?: boolean
}

export interface WindowEntry {
  id: string
  profileId?: string
  workspaces: unknown[]
  activeWorkspaceId: string | null
  activeGroup: string | null
  terminals: unknown[]
  activeTerminalId: string | null
  bounds?: { x: number; y: number; width: number; height: number }
  lastActiveAt: number
  /** Phase 1: UI layout persistence — split/sidebar/thumbnail state */
  layout?: WindowLayout
}

function getRegistryPath(): string {
  return path.join(app.getPath('userData'), 'windows.json')
}

function getWorkspacesPath(): string {
  return path.join(app.getPath('userData'), 'workspaces.json')
}

function generateId(): string {
  return `win-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export class WindowRegistry {
  private cachedEntries: WindowEntry[] | null = null

  async readAll(): Promise<WindowEntry[]> {
    try {
      const data = await fs.readFile(getRegistryPath(), 'utf-8')
      const entries = JSON.parse(data) as WindowEntry[]
      this.cachedEntries = entries
      return entries
    } catch {
      return []
    }
  }

  async getEntry(windowId: string): Promise<WindowEntry | null> {
    const entries = await this.readAll()
    return entries.find(e => e.id === windowId) || null
  }

  /** Sync access to the last-loaded entries. Returns [] if not yet loaded.
   *  Use only for hot-path lookups (e.g. event broadcast) where async I/O isn't viable. */
  getCachedEntries(): WindowEntry[] {
    return this.cachedEntries ?? []
  }

  async saveEntry(entry: WindowEntry): Promise<void> {
    return this.exclusive(() => this.saveEntryUnlocked(entry))
  }

  private async saveEntryUnlocked(entry: WindowEntry): Promise<void> {
    const entries = await this.readAll()
    const idx = entries.findIndex(e => e.id === entry.id)
    if (idx >= 0) {
      entries[idx] = entry
    } else {
      entries.push(entry)
    }
    await this.writeAll(entries)
  }

  async removeEntry(windowId: string): Promise<void> {
    return this.exclusive(async () => {
      const entries = await this.readAll()
      const filtered = entries.filter(e => e.id !== windowId)
      await this.writeAll(filtered)
    })
  }

  /**
   * T0491: read-modify-write of one entry, serialized with every other `saveEntry` /
   * `removeEntry` / `updateEntry` / `withEntry`, so two writers of the same entry (a parent
   * window's save and its detached window's save) can never interleave read and write.
   * The call is queued synchronously. Returns null (nothing written) when the entry is gone.
   */
  updateEntry<T>(windowId: string, mutate: (entry: WindowEntry) => T): Promise<{ entry: WindowEntry; result: T } | null> {
    return this.exclusive(async () => {
      const entry = (await this.readAll()).find(e => e.id === windowId)
      if (!entry) return null
      const result = mutate(entry)
      await this.saveEntryUnlocked(entry)
      return { entry, result }
    })
  }

  /** T0491: read one entry in the same queue as `updateEntry` (sees every write queued before it). */
  withEntry<T>(windowId: string, read: (entry: WindowEntry | null) => T): Promise<T> {
    return this.exclusive(async () => read((await this.readAll()).find(e => e.id === windowId) ?? null))
  }

  /** T0491: resolves once every entry mutation queued so far has been written. */
  whenIdle(): Promise<void> {
    return this.exclusive(async () => undefined)
  }

  private mutationQueue: Promise<unknown> = Promise.resolve()

  private exclusive<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.mutationQueue.then(fn, fn)
    this.mutationQueue = run.catch(() => undefined)
    return run
  }

  async clear(): Promise<void> {
    await this.writeAll([])
  }

  async createEntry(opts?: { profileId?: string }): Promise<WindowEntry> {
    const entry: WindowEntry = {
      id: generateId(),
      profileId: opts?.profileId,
      workspaces: [],
      activeWorkspaceId: null,
      activeGroup: null,
      terminals: [],
      activeTerminalId: null,
      lastActiveAt: Date.now(),
    }
    await this.saveEntry(entry)
    return entry
  }

  /** On first launch: migrate from workspaces.json if windows.json doesn't exist */
  async ensureInitialized(): Promise<WindowEntry[]> {
    if (fsSync.existsSync(getRegistryPath())) {
      return this.readAll()
    }

    logger.log('[window-registry] First launch — migrating from workspaces.json')

    // Try to read existing workspaces.json
    let workspacesData: { workspaces: unknown[]; activeWorkspaceId: string | null; activeGroup: string | null; terminals?: unknown[]; activeTerminalId?: string | null } = {
      workspaces: [],
      activeWorkspaceId: null,
      activeGroup: null,
      terminals: [],
      activeTerminalId: null,
    }

    try {
      const raw = await fs.readFile(getWorkspacesPath(), 'utf-8')
      const parsed = JSON.parse(raw)
      workspacesData = {
        workspaces: parsed.workspaces || [],
        activeWorkspaceId: parsed.activeWorkspaceId || null,
        activeGroup: parsed.activeGroup || null,
        terminals: parsed.terminals || [],
        activeTerminalId: parsed.activeTerminalId || null,
      }
      logger.log(`[window-registry] Read workspaces.json: ${workspacesData.workspaces.length} workspaces, ${(workspacesData.terminals || []).length} terminals`)
    } catch (e) {
      logger.log(`[window-registry] No workspaces.json to migrate: ${e}`)
    }

    // Read active profile ID to link the migrated window entry
    let activeProfileId: string | undefined
    try {
      const profileIndexPath = path.join(app.getPath('userData'), 'profiles', 'index.json')
      const profileIndex = JSON.parse(await fs.readFile(profileIndexPath, 'utf-8'))
      // Support both old (activeProfileId) and new (activeProfileIds) formats
      activeProfileId = profileIndex.activeProfileIds?.[0] || profileIndex.activeProfileId || 'default'
    } catch {
      activeProfileId = 'default'
    }

    // Create a single window entry from existing data
    const entry: WindowEntry = {
      id: generateId(),
      profileId: activeProfileId,
      workspaces: workspacesData.workspaces,
      activeWorkspaceId: workspacesData.activeWorkspaceId,
      activeGroup: workspacesData.activeGroup,
      terminals: workspacesData.terminals || [],
      activeTerminalId: workspacesData.activeTerminalId || null,
      lastActiveAt: Date.now(),
    }

    const entries = [entry]
    await this.writeAll(entries)
    logger.log(`[window-registry] Migrated ${workspacesData.workspaces.length} workspaces to window ${entry.id}`)
    return entries
  }

  /** Re-migrate from workspaces.json when windows.json has only empty entries */
  async remigrateFromWorkspacesJson(): Promise<WindowEntry | null> {
    logger.log('[window-registry] Attempting re-migration from workspaces.json')
    try {
      const raw = await fs.readFile(getWorkspacesPath(), 'utf-8')
      const parsed = JSON.parse(raw)
      const workspaces = parsed.workspaces || []
      if (workspaces.length === 0) {
        logger.log('[window-registry] workspaces.json exists but has no workspaces')
        return null
      }

      let activeProfileId: string | undefined
      try {
        const profileIndexPath = path.join(app.getPath('userData'), 'profiles', 'index.json')
        const profileIndex = JSON.parse(await fs.readFile(profileIndexPath, 'utf-8'))
        activeProfileId = profileIndex.activeProfileIds?.[0] || profileIndex.activeProfileId || 'default'
      } catch {
        activeProfileId = 'default'
      }

      const entry: WindowEntry = {
        id: generateId(),
        profileId: activeProfileId,
        workspaces,
        activeWorkspaceId: parsed.activeWorkspaceId || null,
        activeGroup: parsed.activeGroup || null,
        terminals: parsed.terminals || [],
        activeTerminalId: parsed.activeTerminalId || null,
        lastActiveAt: Date.now(),
      }
      await this.writeAll([entry])
      logger.log(`[window-registry] Re-migrated ${workspaces.length} workspaces to window ${entry.id}`)
      return entry
    } catch (e) {
      logger.log(`[window-registry] Re-migration failed: ${e}`)
      return null
    }
  }

  private writeQueue: Promise<void> = Promise.resolve()

  private async writeAll(entries: WindowEntry[]): Promise<void> {
    // Serialize writes to prevent race conditions
    this.writeQueue = this.writeQueue.then(async () => {
      await fs.writeFile(getRegistryPath(), JSON.stringify(entries, null, 2), 'utf-8')
    }).catch(e => {
      logger.error('[window-registry] writeAll failed:', e)
    })
    await this.writeQueue
    this.cachedEntries = entries
  }
}

// ── T0491: terminals of a detached workspace (BUG-113 known limitation) ──
//
// A detached workspace window has no registry entry; its parent window's entry holds the
// workspace. Before T0491 the detached window's save was a no-op, so terminals opened or
// closed there were lost. Now, while a workspace is detached, its terminal list in the
// parent's entry belongs to the detached window: the detached window's save replaces only
// that workspace's terminals, and the parent's own save keeps them as persisted (its
// in-memory copy is the one from before the detach). The parent gives the list back up
// only after it adopted it (`workspace:adopt-detached`) or reloaded the whole entry.

function persistedTerminalWorkspaceId(terminal: unknown): unknown {
  return terminal && typeof terminal === 'object' ? (terminal as { workspaceId?: unknown }).workspaceId : undefined
}

/** Terminals of `workspaceId` in `terminals`, in order. */
export function workspaceTerminals(terminals: unknown[], workspaceId: string): unknown[] {
  return terminals.filter(t => persistedTerminalWorkspaceId(t) === workspaceId)
}

/**
 * `terminals` with `workspaceId`'s terminals replaced by those of `replacement` (other
 * workspaces' terminals in `replacement` are ignored). The new list takes the place of the
 * first old one, or goes last; every other terminal keeps its position.
 */
export function replaceWorkspaceTerminals(terminals: unknown[], workspaceId: string, replacement: unknown[]): unknown[] {
  const own = workspaceTerminals(replacement, workspaceId)
  const at = terminals.findIndex(t => persistedTerminalWorkspaceId(t) === workspaceId)
  const rest = terminals.filter(t => persistedTerminalWorkspaceId(t) !== workspaceId)
  if (at < 0) return [...rest, ...own]
  return [...rest.slice(0, at), ...own, ...rest.slice(at)]
}

/** parent windowId → workspaces whose terminal list a detached window owns (in memory only). */
export class DetachedTerminalOwners {
  private owners = new Map<string, Set<string>>()

  claim(parentWindowId: string, workspaceId: string): void {
    const set = this.owners.get(parentWindowId) ?? new Set<string>()
    set.add(workspaceId)
    this.owners.set(parentWindowId, set)
  }

  release(parentWindowId: string, workspaceId: string): void {
    const set = this.owners.get(parentWindowId)
    if (!set) return
    set.delete(workspaceId)
    if (set.size === 0) this.owners.delete(parentWindowId)
  }

  /** Releases every workspace of `parentWindowId` for which `keep` is false. */
  releaseUnless(parentWindowId: string, keep: (workspaceId: string) => boolean): void {
    for (const workspaceId of this.owned(parentWindowId)) {
      if (!keep(workspaceId)) this.release(parentWindowId, workspaceId)
    }
  }

  owned(parentWindowId: string): string[] {
    return [...(this.owners.get(parentWindowId) ?? [])]
  }
}

/** Fields of a `workspace:save` payload the registry persists. */
export interface WorkspaceSavePayload {
  workspaces?: unknown[]
  activeWorkspaceId?: string | null
  activeGroup?: string | null
  terminals?: unknown[]
  activeTerminalId?: string | null
  layout?: WindowLayout
}

/**
 * A registry window's own `workspace:save`. Terminals of `ownedWorkspaceIds` (workspaces
 * detached from this window) keep what the entry holds instead of the window's copy.
 */
export function saveWindowWorkspaces(
  registry: WindowRegistry,
  windowId: string,
  payload: WorkspaceSavePayload,
  ownedWorkspaceIds: () => string[],
): Promise<WindowEntry | null> {
  return registry.updateEntry(windowId, entry => {
    let terminals = payload.terminals || []
    for (const workspaceId of ownedWorkspaceIds()) {
      terminals = replaceWorkspaceTerminals(terminals, workspaceId, entry.terminals || [])
    }
    entry.workspaces = payload.workspaces || []
    entry.activeWorkspaceId = payload.activeWorkspaceId || null
    entry.activeGroup = payload.activeGroup || null
    entry.terminals = terminals
    entry.activeTerminalId = payload.activeTerminalId || null
    entry.layout = payload.layout || undefined
    entry.lastActiveAt = Date.now()
  }).then(r => r?.entry ?? null)
}

/** A detached window's `workspace:save`: only `workspaceId`'s terminals reach the parent entry. */
export function saveDetachedWorkspaceTerminals(
  registry: WindowRegistry,
  parentWindowId: string,
  workspaceId: string,
  payload: WorkspaceSavePayload,
): Promise<WindowEntry | null> {
  return registry.updateEntry(parentWindowId, entry => {
    entry.terminals = replaceWorkspaceTerminals(entry.terminals || [], workspaceId, payload.terminals || [])
  }).then(r => r?.entry ?? null)
}
