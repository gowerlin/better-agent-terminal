/**
 * PLAN-036 P0-C (T0390): `pty:*` + `settings:get-shell-path`, registered by
 * both Electron main and headless bat-server (see ./types.ts).
 *
 * The two hosts differ only in what they pass in:
 *   - Electron: the app-wide PtyManager (Terminal Server proxy or direct), shell
 *     from the local renderer is trusted as before.
 *   - headless: its own PtyManager (broadcastHub emit, no helper dir, BAT_* env
 *     scrubbed), and `validateShell` on — the shell path arrives from a remote
 *     client, so it must be an absolute path to an existing file (T0386 §5).
 *
 * 🔴 No `electron` import here (headless-electron-free guard).
 */
import * as fs from 'fs'
import * as path from 'path'
import type { CreatePtyOptions, PtyCreateResult } from '../../src/types'
import { logger } from '../logger'
import { PtyLimitError, type PtyManager } from '../pty-manager'
import { resolveShellPath } from '../shell-path-resolver'
import type { HandlerRegistrar } from './types'

export interface PtyHandlerDeps {
  /** Null while the host has not built its PtyManager yet (Electron: before app ready). */
  getPtyManager(): PtyManager | null
  /** Reject client-supplied shells that are not an absolute path to an existing file. */
  validateShell?: boolean
}

/**
 * Why `shell` is unacceptable, or null when it is fine. Empty / undefined is fine:
 * PtyManager then picks the host default shell.
 */
export function shellPathRejection(
  shell: unknown,
  statSync: (p: string) => { isFile(): boolean } = fs.statSync,
): string | null {
  if (shell === undefined || shell === null || shell === '') return null
  if (typeof shell !== 'string') return 'shell must be a string'
  if (!path.isAbsolute(shell)) return 'shell must be an absolute path'
  try {
    if (!statSync(shell).isFile()) return 'shell is not a file'
  } catch {
    return 'shell does not exist'
  }
  return null
}

export function registerPtyHandlers(register: HandlerRegistrar, deps: PtyHandlerDeps): void {
  const rejectShell = (channel: string, shell: unknown): boolean => {
    if (!deps.validateShell) return false
    const reason = shellPathRejection(shell)
    if (!reason) return false
    logger.warn(`[pty] ${channel} rejected: ${reason} (${JSON.stringify(shell)})`)
    return true
  }

  // T0403: `{ ok, created }` — `created: false` tells the renderer the PTY was already running
  // (reload / reconnect), so it replays `pty:get-buffer` and does not retype an agent command.
  // Clients older than T0403 only test truthiness; `normalizePtyCreateResult` (renderer)
  // reads a bare boolean from an older server as "created".
  // T0424: over the PTY cap (PtyLimitError) → `{ ok: false, created: false, code, limit }`.
  // A thrown error crosses the remote WebSocket and Electron IPC as its message string only,
  // so the renderer could not tell "limit reached" apart without English string matching.
  register('pty:create', (_ctx, options: unknown): PtyCreateResult => {
    const opts = options as CreatePtyOptions
    if (rejectShell('pty:create', opts?.shell)) return { ok: false, created: false }
    const manager = deps.getPtyManager()
    if (!manager) return { ok: false, created: false }
    try {
      return manager.createWithResult(opts)
    } catch (err) {
      if (err instanceof PtyLimitError) return { ok: false, created: false, code: err.code, limit: err.limit }
      throw err
    }
  })
  // T0215 (BUG-050 階段 1):改用 writeWithResult 回 `{ok, reason}`,讓 bat-notify 可據以 exit 1
  register('pty:write', (_ctx, id: string, data: string) =>
    deps.getPtyManager()?.writeWithResult(id, data) ?? { ok: false, reason: 'manager-not-ready' }
  )
  register('pty:resize', (_ctx, id: string, cols: number, rows: number) => {
    logger.log(`[resize] pty:resize id=${id} cols=${cols} rows=${rows}`)
    return deps.getPtyManager()?.resize(id, cols, rows)
  })
  register('pty:kill', (_ctx, id: string) => deps.getPtyManager()?.kill(id))
  register('pty:restart', (_ctx, id: string, cwd: string, shellPath?: string) => {
    // Validate before restart() kills the running shell.
    if (rejectShell('pty:restart', shellPath)) return false
    return deps.getPtyManager()?.restart(id, cwd, shellPath)
  })
  register('pty:get-cwd', (_ctx, id: string) => deps.getPtyManager()?.getCwd(id))
  // T0403: replay buffer, answered to the caller only (an invoke result, never a broadcast).
  register('pty:get-buffer', (_ctx, id: string) => deps.getPtyManager()?.getReplayBuffer(id) ?? null)

  const shellPathCache = new Map<string, string>()
  register('settings:get-shell-path', (_ctx, shellType: string) => {
    const cached = shellPathCache.get(shellType)
    if (cached) return cached

    const result = resolveShellPath(shellType, {
      platform: process.platform,
      env: process.env,
      existsSync: fs.existsSync,
    })
    shellPathCache.set(shellType, result)
    return result
  })
}
