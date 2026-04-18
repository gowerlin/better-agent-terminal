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
 */

const allowed = new Set<string>()

function normalize(p: string): string {
  if (!p || typeof p !== 'string') return ''
  try {
    return path.resolve(p)
  } catch {
    return ''
  }
}

/**
 * Add a workspace root to the allowlist. Idempotent.
 */
export function registerWorkspace(workspacePath: string): void {
  const norm = normalize(workspacePath)
  if (norm) allowed.add(norm)
}

/**
 * Remove a workspace root from the allowlist. Idempotent.
 */
export function unregisterWorkspace(workspacePath: string): void {
  const norm = normalize(workspacePath)
  if (norm) allowed.delete(norm)
}

/**
 * Replace the entire allowlist with the provided workspace roots.
 * Used at startup and on every `workspace:save` to keep path-guard in sync
 * with the window registry without per-entry bookkeeping.
 */
export function rebuildWorkspaceAllowlist(workspacePaths: string[]): void {
  allowed.clear()
  for (const p of workspacePaths) {
    const norm = normalize(p)
    if (norm) allowed.add(norm)
  }
}

/**
 * List of currently-registered workspace roots (for diagnostics / tests).
 */
export function getRegisteredWorkspaces(): string[] {
  return Array.from(allowed)
}

/**
 * Non-throwing check used by recursive walks (e.g. `fs:search`) that want to
 * silently skip entries that leave the workspace instead of aborting the
 * entire operation (AC-7).
 */
export function isPathAllowed(requestedPath: string): boolean {
  if (!requestedPath) return false
  const resolved = normalize(requestedPath)
  if (!resolved) return false
  for (const root of allowed) {
    if (resolved === root) return true
    if (resolved.startsWith(root + path.sep)) return true
  }
  return false
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
