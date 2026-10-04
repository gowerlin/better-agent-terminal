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
  const fileWatchers = new Map<string, ReturnType<typeof fsSync.watch>>()
  register('fs:watch', (_ctx, _dirPath: string) => {
    if (!isPathAllowed(_dirPath)) return false
    if (fileWatchers.has(_dirPath)) return true
    try {
      let debounceTimer: ReturnType<typeof setTimeout> | null = null
      const watcher = fsSync.watch(_dirPath, { recursive: true }, () => {
        if (debounceTimer) clearTimeout(debounceTimer)
        debounceTimer = setTimeout(() => {
          deps.emit('fs:changed', _dirPath)
        }, 500)
      })
      watcher.on('error', () => {
        fileWatchers.delete(_dirPath)
      })
      fileWatchers.set(_dirPath, watcher)
      return true
    } catch { return false }
  })
  // Force-destroy and re-create the watcher — used by CT panel refresh button
  // to recover from broken watcher state (e.g. after git mv buffer overflow).
  register('fs:reset-watch', (_ctx, _dirPath: string) => {
    if (!isPathAllowed(_dirPath)) return false
    const existing = fileWatchers.get(_dirPath)
    if (existing) {
      existing.close()
      fileWatchers.delete(_dirPath)
    }
    // Re-create watcher (same logic as fs:watch)
    try {
      let debounceTimer: ReturnType<typeof setTimeout> | null = null
      const watcher = fsSync.watch(_dirPath, { recursive: true }, () => {
        if (debounceTimer) clearTimeout(debounceTimer)
        debounceTimer = setTimeout(() => {
          deps.emit('fs:changed', _dirPath)
        }, 500)
      })
      watcher.on('error', () => {
        fileWatchers.delete(_dirPath)
      })
      fileWatchers.set(_dirPath, watcher)
      return true
    } catch { return false }
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
