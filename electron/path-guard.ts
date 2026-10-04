import * as path from 'path'

/**
 * Workspace-based filesystem sandbox (PLAN-018 T0183).
 *
 * Every `fs:*` IPC handler and `image:read-as-data-url` must call
 * `assertPathAllowed(...)` at entry. Only paths inside a registered workspace
 * root are allowed; everything else is denied.
 *
 * Whitelist is rebuilt from all window registry entries at startup and on
 * every `workspace:save`, so add/remove workspace in the UI is reflected
 * immediately.
 *
 * Note: We intentionally do NOT resolve symlinks here (no `fs.realpathSync`).
 * `path.resolve` collapses `..` segments and turns the input absolute, which
 * is enough to stop trivial traversal like `fs:readFile('/workspace/../etc/passwd')`.
 * A symlink inside a workspace that points outside still produces a string
 * prefixed by the workspace root and is therefore allowed — that matches the
 * spirit of AC-7 (do not throw on symlinks in walks, only skip).
 *
 * T0406: the headless bat-server has no window registry; its allowlist is a
 * `SyncedWorkspaceRoots` fed by `workspace:sync-roots` (bottom of this file).
 */

/**
 * One allowlist of workspace roots. T0406: a factory so headless can keep its
 * own instance; the module-level functions below are Electron main's instance,
 * with unchanged behavior.
 */
export interface PathAllowlist {
  register(workspacePath: string): void
  unregister(workspacePath: string): void
  rebuild(workspacePaths: string[]): void
  list(): string[]
  isPathAllowed(requestedPath: string): boolean
}

function normalize(p: string): string {
  if (!p || typeof p !== 'string') return ''
  try {
    return path.resolve(p)
  } catch {
    return ''
  }
}

export function createPathAllowlist(): PathAllowlist {
  const allowed = new Set<string>()
  return {
    register(workspacePath) {
      const norm = normalize(workspacePath)
      if (norm) allowed.add(norm)
    },
    unregister(workspacePath) {
      const norm = normalize(workspacePath)
      if (norm) allowed.delete(norm)
    },
    rebuild(workspacePaths) {
      allowed.clear()
      for (const p of workspacePaths) {
        const norm = normalize(p)
        if (norm) allowed.add(norm)
      }
    },
    list() {
      return Array.from(allowed)
    },
    isPathAllowed(requestedPath) {
      if (!requestedPath) return false
      const resolved = normalize(requestedPath)
      if (!resolved) return false
      for (const root of allowed) {
        if (resolved === root) return true
        if (resolved.startsWith(root + path.sep)) return true
      }
      return false
    },
  }
}

const defaultAllowlist = createPathAllowlist()

/**
 * Add a workspace root to the allowlist. Idempotent.
 */
export function registerWorkspace(workspacePath: string): void {
  defaultAllowlist.register(workspacePath)
}

/**
 * Remove a workspace root from the allowlist. Idempotent.
 */
export function unregisterWorkspace(workspacePath: string): void {
  defaultAllowlist.unregister(workspacePath)
}

/**
 * Replace the entire allowlist with the provided workspace roots.
 * Used at startup and on every `workspace:save` to keep path-guard in sync
 * with the window registry without per-entry bookkeeping.
 */
export function rebuildWorkspaceAllowlist(workspacePaths: string[]): void {
  defaultAllowlist.rebuild(workspacePaths)
}

/**
 * List of currently-registered workspace roots (for diagnostics / tests).
 */
export function getRegisteredWorkspaces(): string[] {
  return defaultAllowlist.list()
}

/**
 * Non-throwing check used by recursive walks (e.g. `fs:search`) that want to
 * silently skip entries that leave the workspace instead of aborting the
 * entire operation (AC-7).
 */
export function isPathAllowed(requestedPath: string): boolean {
  return defaultAllowlist.isPathAllowed(requestedPath)
}

/**
 * Throwing guard used at IPC handler entry. Callers should wrap in
 * try/catch and return the standard `{ error }` shape to the renderer.
 */
export function assertPathAllowed(requestedPath: string): void {
  if (!isPathAllowed(requestedPath)) {
    throw new Error(`Path access denied: ${requestedPath}`)
  }
}

/**
 * Image size cap applied at `image:read-as-data-url`.
 */
export const MAX_IMAGE_SIZE = 10 * 1024 * 1024  // 10 MB

// ── T0406 (PLAN-036 P2-I): headless sandbox from client-synced roots ──

/** Most roots one connection may sync (a window rarely has more than a handful). */
export const MAX_SYNCED_ROOTS = 256
const MAX_SYNCED_ROOT_LENGTH = 4096

export interface RejectedRoot {
  root: unknown
  reason: string
}

export interface SyncRootsOutcome {
  /** Roots now in effect for the connection (resolved, deduplicated). */
  accepted: string[]
  rejected: RejectedRoot[]
}

/**
 * Why `root` cannot be a synced workspace root on this host, or null when it
 * can. Accepted: an absolute path of THIS host (the client converts with its
 * PathTranslator first) with no `..` segment that is not a filesystem root
 * (`/`, `C:\`) — a root there would open the whole filesystem.
 */
export function syncedRootRejection(root: unknown, pathImpl: path.PlatformPath = path): string | null {
  if (typeof root !== 'string' || root.length === 0) return 'not a non-empty string'
  if (root.length > MAX_SYNCED_ROOT_LENGTH) return 'too long'
  if (root.includes('\0')) return 'contains NUL'
  if (root.split(/[\\/]+/).includes('..')) return 'contains a .. segment'
  if (!pathImpl.isAbsolute(root)) return 'not an absolute path on the server'
  const resolved = pathImpl.resolve(root)
  if (resolved === pathImpl.parse(resolved).root) return 'filesystem root'
  return null
}

/**
 * T0406: fs sandbox of the headless bat-server. Headless has no window
 * registry, so every connected client pushes the workspace roots of its
 * windows (`workspace:sync-roots`, already in server form). Roots are kept per
 * connection and the allowlist is their union; a closed connection takes its
 * roots with it. Nothing synced ⇒ nothing allowed (fail closed).
 */
export class SyncedWorkspaceRoots {
  private readonly byConnection = new Map<string, string[]>()
  private readonly allowlist = createPathAllowlist()

  /**
   * Replace `connectionId`'s roots. Invalid entries are dropped and reported;
   * valid ones take effect. A payload that is not an array, or has more than
   * MAX_SYNCED_ROOTS entries, clears the connection's roots and throws.
   */
  setConnectionRoots(connectionId: string, roots: unknown): SyncRootsOutcome {
    if (!Array.isArray(roots) || roots.length > MAX_SYNCED_ROOTS) {
      this.removeConnection(connectionId)
      throw new Error(Array.isArray(roots)
        ? `workspace:sync-roots accepts at most ${MAX_SYNCED_ROOTS} roots (got ${roots.length})`
        : 'workspace:sync-roots expects an array of absolute server paths')
    }
    const accepted: string[] = []
    const rejected: RejectedRoot[] = []
    for (const root of roots) {
      const reason = syncedRootRejection(root)
      if (reason) {
        rejected.push({ root, reason })
        continue
      }
      const resolved = path.resolve(root as string)
      if (!accepted.includes(resolved)) accepted.push(resolved)
    }
    if (accepted.length > 0) this.byConnection.set(connectionId, accepted)
    else this.byConnection.delete(connectionId)
    this.rebuild()
    return { accepted: [...accepted], rejected }
  }

  /** Drop a connection's roots (connection closed). Returns whether it had any. */
  removeConnection(connectionId: string): boolean {
    const had = this.byConnection.delete(connectionId)
    if (had) this.rebuild()
    return had
  }

  /** Union of every connection's roots. */
  getRoots(): string[] {
    return this.allowlist.list()
  }

  getConnectionRoots(connectionId: string): string[] {
    return [...(this.byConnection.get(connectionId) ?? [])]
  }

  isPathAllowed(requestedPath: string): boolean {
    return this.allowlist.isPathAllowed(requestedPath)
  }

  private rebuild(): void {
    const union: string[] = []
    this.byConnection.forEach(roots => union.push(...roots))
    this.allowlist.rebuild(union)
  }
}
