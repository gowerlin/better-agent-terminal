/**
 * PLAN-036 P2-I (T0406): `fs:*` / `image:read-as-data-url` / `workspace:sync-roots`,
 * registered by both Electron main and the headless bat-server (see ./types.ts).
 * Moved from `electron/main.ts`; handler bodies are unchanged except:
 *   - `isPathAllowed(...)` (the module-level Electron path-guard) → `allowed(...)`,
 *     i.e. `deps.pathGuard.isPathAllowed`; no guard ⇒ every path is denied
 *   - the `fs:changed` fan-out (`BrowserWindow.getAllWindows()` webContents.send +
 *     `broadcastHub.broadcast`) → `deps.emit('fs:changed', dirPath)`
 *   - the `fileWatchers` map is per registration, closed by the returned disposer
 *     (headless `stop()`)
 *   - T0916: `fs:watch` takes an optional `{ recreate: true }` (see `FsWatchOptions`)
 *
 * Host differences:
 *   - path guard: Electron passes the window-registry allowlist (`electron/path-guard.ts`,
 *     rebuilt on startup and every `workspace:save`); headless passes a
 *     `SyncedWorkspaceRoots` fed by `workspace:sync-roots` from each connected client.
 *   - `workspace:sync-roots`: only headless gives `workspaceRoots`. Electron answers
 *     `{ ok: false }` — its sandbox comes from its own registry, and roots pushed by a
 *     remote client must not widen it.
 *
 * `image:read-as-data-url` never used `nativeImage` (plain fs read + base64), so there
 * is nothing Electron-only to replace.
 *
 * 🔴 No `electron` import here (headless-electron-free guard).
 */
import * as fs from 'fs/promises'
import * as fsSync from 'fs'
import * as path from 'path'
import { logger } from '../logger'
import { MAX_IMAGE_SIZE, type SyncRootsOutcome } from '../path-guard'
import type { HandlerModuleDisposer, HandlerRegistrar, HostEmit, HostPathGuard } from './types'

/** Where `workspace:sync-roots` stores a connection's roots (headless: `SyncedWorkspaceRoots`). */
export interface WorkspaceRootsSink {
  setConnectionRoots(connectionId: string, roots: unknown): SyncRootsOutcome
}

export type SyncRootsResult =
  | { ok: true; roots: string[]; rejected: SyncRootsOutcome['rejected'] }
  | { ok: false; error: string }

export interface FsHandlerDeps {
  /** `fs:changed` sink. Electron: every window + broadcastHub; headless: broadcastHub. */
  emit: HostEmit
  /** Absent ⇒ every fs / image path is denied (fail closed, T0386 §4). */
  pathGuard?: HostPathGuard
  /** Headless only: backs `workspace:sync-roots`. */
  workspaceRoots?: WorkspaceRootsSink
}

/**
 * T0916 / BUG-220: `fs:watch(dir, { recreate: true })` keeps watching a directory that does not exist
 * yet, or that is deleted (or replaced) later: until it (re)appears, a non-recursive watch on its
 * nearest existing ancestor (allowed by the path guard) waits for it; then the usual recursive
 * watcher takes over and one `fs:changed` for `dir` is emitted. Without the option (and on a
 * bat-server older than T0916, which ignores it) `fs:watch` behaves as before: a missing directory
 * answers `false`. A directory that exists from the start emits exactly the same `fs:changed` events
 * either way. Event-driven only (no polling).
 */
export interface FsWatchOptions {
  recreate?: boolean
}

interface WatchEntry {
  close(): void
  /** Waiting on an ancestor for the directory to appear. */
  pending: boolean
  recreate: boolean
  /** Schedules the debounced `fs:changed` (no-op while pending). */
  notify(): void
}

/** At most one stat per this many ms while a `recreate` watcher receives events. */
export const DIR_GONE_CHECK_MS = 100
/** Coalesces an ancestor's events into one check for the awaited directory. */
export const PENDING_CHECK_MS = 100

function wantsRecreate(options: unknown): boolean {
  return !!options && typeof options === 'object' && (options as FsWatchOptions).recreate === true
}

function isDirectory(p: string): boolean {
  try { return fsSync.statSync(p).isDirectory() } catch { return false }
}

/** dev + ino of a directory (a new directory at the same path gets a new one); null if missing. */
function dirIdentity(p: string): string | null {
  try {
    const st = fsSync.statSync(p, { bigint: true })
    return st.isDirectory() ? `${st.dev}:${st.ino}` : null
  } catch { return null }
}

export const SYNC_ROOTS_HOST_MANAGED_ERROR =
  'this host builds its fs sandbox from its own workspace registry; synced roots are not used'

export function registerFsHandlers(register: HandlerRegistrar, deps: FsHandlerDeps): HandlerModuleDisposer {
  const isPathAllowed = (requestedPath: string): boolean => deps.pathGuard?.isPathAllowed(requestedPath) ?? false

  // T0406: the client pushes its windows' workspace roots, already in server form
  // (path-aware `array-of-strings`, translated by RemoteClient.invoke).
  register('workspace:sync-roots', async (ctx, roots: unknown): Promise<SyncRootsResult> => {
    if (!deps.workspaceRoots) return { ok: false, error: SYNC_ROOTS_HOST_MANAGED_ERROR }
    if (!ctx.connectionId) return { ok: false, error: 'workspace:sync-roots needs a remote connection' }
    const outcome = deps.workspaceRoots.setConnectionRoots(ctx.connectionId, roots)
    return { ok: true, roots: outcome.accepted, rejected: outcome.rejected }
  })

  // File system
  // File watcher for auto-refresh
  const fileWatchers = new Map<string, WatchEntry>()

  /**
   * The recursive watcher (unchanged since before T0916: one `fs:changed` 500 ms after the last
   * event). Returns null when `fsSync.watch` throws (e.g. the directory does not exist).
   * T0916: an entry with `recreate` also notices that its directory was deleted or replaced.
   */
  function startDirWatcher(dirPath: string, recreate: boolean): WatchEntry | null {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null
    let goneTimer: ReturnType<typeof setTimeout> | null = null
    let watcher: ReturnType<typeof fsSync.watch>
    const notify = () => {
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        deps.emit('fs:changed', dirPath)
      }, 500)
    }
    const entry: WatchEntry = {
      pending: false,
      recreate,
      notify,
      close: () => {
        if (goneTimer) clearTimeout(goneTimer)
        goneTimer = null
        watcher.close()
      },
    }
    try {
      watcher = fsSync.watch(dirPath, { recursive: true }, () => {
        notify()
        if (entry.recreate && !goneTimer) goneTimer = setTimeout(checkGone, DIR_GONE_CHECK_MS)
      })
    } catch { return null }
    const startIdentity = dirIdentity(dirPath)
    // T0916: Windows keeps firing `rename` for a deleted watched directory and never sends `error`,
    // so the debounce above never ends and a re-created directory is not seen. A stat at most every
    // DIR_GONE_CHECK_MS while events arrive (only for `recreate` entries) tells us.
    const checkGone = () => {
      goneTimer = null
      if (fileWatchers.get(dirPath) !== entry) return
      const now = dirIdentity(dirPath)
      if (now !== null && now === startIdentity) return
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = null
      replaceLost(dirPath, entry)
    }
    watcher.on('error', () => {
      if (entry.recreate && fileWatchers.get(dirPath) === entry) {
        if (debounceTimer) clearTimeout(debounceTimer)
        debounceTimer = null
        replaceLost(dirPath, entry)
        return
      }
      fileWatchers.delete(dirPath)
    })
    return entry
  }

  /** T0916: a `recreate` watcher lost its directory: tell the consumers once, then watch again. */
  function replaceLost(dirPath: string, entry: WatchEntry): void {
    try { entry.close() } catch { /* already closed */ }
    fileWatchers.delete(dirPath)
    deps.emit('fs:changed', dirPath)
    armRecreate(dirPath)
  }

  /**
   * T0916: watch `dirPath` with `recreate` — the recursive watcher when the directory exists,
   * otherwise a non-recursive watch on its nearest existing ancestor the guard allows (event-driven,
   * no polling), which switches to the recursive watcher and emits `fs:changed` once the directory
   * appears. False when neither can be set up (as `fs:watch` before T0916).
   */
  function armRecreate(dirPath: string): boolean {
    const real = startDirWatcher(dirPath, true)
    if (real) {
      fileWatchers.set(dirPath, real)
      return true
    }
    if (fsSync.existsSync(dirPath)) return false // exists but cannot be watched: as before T0916
    return armPending(dirPath)
  }

  function nearestWatchableAncestor(dirPath: string): string | null {
    let candidate = path.dirname(dirPath)
    for (;;) {
      if (!isPathAllowed(candidate)) return null
      if (isDirectory(candidate)) return candidate
      const up = path.dirname(candidate)
      if (up === candidate) return null
      candidate = up
    }
  }

  function armPending(dirPath: string): boolean {
    const ancestor = nearestWatchableAncestor(dirPath)
    if (!ancestor) return false
    let checkTimer: ReturnType<typeof setTimeout> | null = null
    let parentWatcher: ReturnType<typeof fsSync.watch>
    const entry: WatchEntry = {
      pending: true,
      recreate: true,
      notify: () => {},
      close: () => {
        if (checkTimer) clearTimeout(checkTimer)
        checkTimer = null
        parentWatcher.close()
      },
    }
    const check = () => {
      checkTimer = null
      if (fileWatchers.get(dirPath) !== entry) return
      if (!isDirectory(dirPath)) {
        // A missing level in between appeared: move the watch closer
        if (nearestWatchableAncestor(dirPath) !== ancestor) {
          entry.close()
          fileWatchers.delete(dirPath)
          armPending(dirPath)
        }
        return
      }
      entry.close()
      fileWatchers.delete(dirPath)
      const real = startDirWatcher(dirPath, true)
      if (!real) return // exists but cannot be watched: give up, as before T0916
      fileWatchers.set(dirPath, real)
      logger.debug('[fs-watch] watched directory appeared; watching it now')
      // Files written before the recursive watcher started are not reported by it
      real.notify()
    }
    const schedule = () => {
      if (!checkTimer) checkTimer = setTimeout(check, PENDING_CHECK_MS)
    }
    try {
      parentWatcher = fsSync.watch(ancestor, schedule)
    } catch { return false }
    parentWatcher.on('error', () => {
      if (fileWatchers.get(dirPath) !== entry) return
      try { entry.close() } catch { /* already closed */ }
      fileWatchers.delete(dirPath)
      armPending(dirPath)
    })
    fileWatchers.set(dirPath, entry)
    logger.debug('[fs-watch] watched directory missing; waiting for it to appear')
    // It may have appeared between the failed watch and now
    schedule()
    return true
  }

  register('fs:watch', (_ctx, _dirPath: string, options?: unknown) => {
    if (!isPathAllowed(_dirPath)) return false
    const recreate = wantsRecreate(options)
    const existing = fileWatchers.get(_dirPath)
    if (existing) {
      if (recreate) existing.recreate = true
      return true
    }
    if (recreate) return armRecreate(_dirPath)
    const entry = startDirWatcher(_dirPath, false)
    if (!entry) return false
    fileWatchers.set(_dirPath, entry)
    return true
  })
  // Force-destroy and re-create the watcher — used by CT panel refresh button
  // to recover from broken watcher state (e.g. after git mv buffer overflow).
  // T0916: a `recreate` watch stays `recreate` (a missing directory goes back to waiting for it).
  register('fs:reset-watch', (_ctx, _dirPath: string) => {
    if (!isPathAllowed(_dirPath)) return false
    const existing = fileWatchers.get(_dirPath)
    const recreate = existing?.recreate === true
    if (existing) {
      existing.close()
      fileWatchers.delete(_dirPath)
    }
    if (recreate) return armRecreate(_dirPath)
    // Re-create watcher (same logic as fs:watch)
    const entry = startDirWatcher(_dirPath, false)
    if (!entry) return false
    fileWatchers.set(_dirPath, entry)
    return true
  })

  register('fs:unwatch', (_ctx, _dirPath: string) => {
    if (!isPathAllowed(_dirPath)) return false
    const watcher = fileWatchers.get(_dirPath)
    if (watcher) {
      watcher.close()
      fileWatchers.delete(_dirPath)
    }
    return true
  })

  register('fs:readdir', async (_ctx, dirPath: string) => {
    if (!isPathAllowed(dirPath)) return []
    const IGNORED = new Set(['.git', 'node_modules', '.next', 'dist', 'dist-electron', '.cache', '__pycache__', '.DS_Store'])
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true })
      return entries
        .filter(e => !IGNORED.has(e.name))
        .sort((a, b) => { if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1; return a.name.localeCompare(b.name) })
        .map(e => ({ name: e.name, path: path.join(dirPath, e.name), isDirectory: e.isDirectory() }))
    } catch { return [] }
  })
  register('fs:readFile', async (_ctx, filePath: string) => {
    if (!isPathAllowed(filePath)) return { error: 'Path access denied' }
    try {
      const stat = await fs.stat(filePath)
      if (stat.size > 512 * 1024) return { error: 'File too large', size: stat.size }
      const content = await fs.readFile(filePath, 'utf-8')
      return { content }
    } catch { return { error: 'Failed to read file' } }
  })
  register('fs:stat', async (_ctx, filePath: string) => {
    if (!isPathAllowed(filePath)) return null
    try {
      const stat = await fs.stat(filePath)
      return { mtimeMs: stat.mtimeMs, size: stat.size }
    } catch { return null }
  })
  register('image:read-as-data-url', async (_ctx, filePath: string) => {
    if (!isPathAllowed(filePath)) throw new Error('Path access denied')
    try {
      const stat = await fs.stat(filePath)
      if (stat.size > MAX_IMAGE_SIZE) {
        throw new Error(`Image too large (${stat.size} > ${MAX_IMAGE_SIZE} bytes)`)
      }
      const ext = path.extname(filePath).toLowerCase()
      const mimeMap: Record<string, string> = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp' }
      const mime = mimeMap[ext] || 'image/png'
      const data = await fs.readFile(filePath)
      return `data:${mime};base64,${data.toString('base64')}`
    } catch (err) {
      logger.warn('[image:read-as-data-url] failed:', err instanceof Error ? err.message : String(err))
      throw err instanceof Error ? err : new Error(String(err))
    }
  })
  register('fs:search', async (_ctx, dirPath: string, query: string) => {
    // AC-7: starting point must be inside a workspace; recursive walk silently
    // skips entries that fall outside (symlinks, `..` → never throw).
    if (!isPathAllowed(dirPath)) return []
    const IGNORED = new Set(['.git', 'node_modules', '.next', 'dist', 'dist-electron', '.cache', '__pycache__', '.DS_Store', 'release'])
    const results: { name: string; path: string; isDirectory: boolean }[] = []
    const lowerQuery = query.toLowerCase()
    async function walk(dir: string, depth: number) {
      if (depth > 8 || results.length >= 100) return
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true })
        for (const e of entries) {
          if (results.length >= 100) return
          if (IGNORED.has(e.name)) continue
          const fullPath = path.join(dir, e.name)
          if (!isPathAllowed(fullPath)) continue  // AC-7: symlink jumps out → skip, don't throw
          if (e.name.toLowerCase().includes(lowerQuery)) results.push({ name: e.name, path: fullPath, isDirectory: e.isDirectory() })
          if (e.isDirectory()) await walk(fullPath, depth + 1)
        }
      } catch { /* skip */ }
    }
    await walk(dirPath, 0)
    return results.sort((a, b) => { if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1; return a.name.localeCompare(b.name) })
  })

  return () => {
    fileWatchers.forEach(watcher => {
      try { watcher.close() } catch { /* already closed */ }
    })
    fileWatchers.clear()
  }
}
