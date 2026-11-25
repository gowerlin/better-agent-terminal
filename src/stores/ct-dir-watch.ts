/**
 * T0906: one `fs:watch` per directory for this window, shared by the Control Tower panel and the
 * Inbox data source.
 *
 * Main keeps one watcher per path and `fs:unwatch` closes it whoever asked for it
 * (electron/handlers/fs.ts) — two components watching `_ct-workorders/` would stop each other's
 * auto-refresh. This counts users per path: the first `acquireDirWatch` calls `fs.watch`, the last
 * release calls `fs.unwatch`. `fs:changed` still reaches every listener of the window.
 *
 * Known limit: the count is per window; another window (a detached one) watching the same path
 * still shares main's watcher, as before T0906.
 *
 * T0916 / BUG-220: the watch asks for `{ recreate: true }`, so a `_ct-workorders/` created after the
 * workspace was opened (a first Tower run), or deleted and created again, still gets `fs:changed`
 * (electron/handlers/fs.ts `FsWatchOptions`). Only this module passes the option. A bat-server older
 * than T0916 ignores it: a missing directory is then not watched, as before.
 */

const users = new Map<string, number>()

/** Starts watching `dirPath` (or joins the window's watch); call the returned function to leave. */
export function acquireDirWatch(dirPath: string): () => void {
  const count = users.get(dirPath) ?? 0
  users.set(dirPath, count + 1)
  if (count === 0) callFs('watch', dirPath, { recreate: true })
  let released = false
  return () => {
    if (released) return
    released = true
    const left = (users.get(dirPath) ?? 1) - 1
    if (left > 0) {
      users.set(dirPath, left)
      return
    }
    users.delete(dirPath)
    callFs('unwatch', dirPath)
  }
}

function callFs(method: 'watch' | 'unwatch', dirPath: string, options?: { recreate: true }): void {
  try {
    const fsApi = window.electronAPI?.fs
    const result = method === 'watch' ? fsApi?.watch?.(dirPath, options) : fsApi?.unwatch?.(dirPath)
    if (result && typeof result.catch === 'function') result.catch(() => false)
  } catch { /* no fs bridge (tests) */ }
}

/** Tests only. */
export function dirWatchUsers(dirPath: string): number {
  return users.get(dirPath) ?? 0
}

/** Tests only. */
export function resetDirWatches(): void {
  users.clear()
}
