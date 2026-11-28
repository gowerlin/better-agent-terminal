import { execFile } from 'child_process'

/**
 * T0540 (PLAN-042): end a PTY's whole process tree on Windows.
 *
 * node-pty's Windows `kill()` only ends the processes attached to the pseudo console
 * (shell, agent CLI, console children). A child the agent started without a console
 * (`detached`, DETACHED_PROCESS) is not attached and kept running after ✕ / restart /
 * quit; direct mode (`PtyManager.kill`) already ran `taskkill /F /T` for it.
 * `taskkill /T` walks the parent chain, so it must run while the shell is still alive:
 * call this before the pseudo console is released (T0983: `releaseExitedPty` below, which
 * replaced node-pty's `pty.kill()` on Windows — BUG-238).
 */

export const TASKKILL_TIMEOUT_MS = 3000

export type ExecFileLike = (
  file: string,
  args: string[],
  options: { timeout: number; windowsHide: boolean },
  callback: (error: Error | null) => void,
) => unknown

export interface KillTreeDeps {
  platform: NodeJS.Platform
  execFile: ExecFileLike
}

export type KillTreeResult = 'killed' | 'failed' | 'not-windows' | 'invalid-pid'

export const defaultKillTreeDeps: KillTreeDeps = {
  platform: process.platform,
  execFile: execFile as unknown as ExecFileLike,
}

export function isValidPid(pid: unknown): pid is number {
  return typeof pid === 'number' && Number.isSafeInteger(pid) && pid > 0
}

/** Resolves once taskkill finished or timed out; never rejects. */
export function killProcessTree(pid: unknown, deps: KillTreeDeps = defaultKillTreeDeps): Promise<KillTreeResult> {
  if (deps.platform !== 'win32') return Promise.resolve('not-windows')
  if (!isValidPid(pid)) return Promise.resolve('invalid-pid')
  return new Promise((resolve) => {
    try {
      deps.execFile(
        'taskkill',
        ['/F', '/T', '/PID', String(pid)],
        { timeout: TASKKILL_TIMEOUT_MS, windowsHide: true },
        (error) => resolve(error ? 'failed' : 'killed'),
      )
    } catch {
      resolve('failed')
    }
  })
}

export type ExitedPtyReleaseResult = 'released' | `failed:${string}` | `skipped:${string}`

/** T0983: PTY objects `releaseExitedPty` already released (the native kill must never run twice on one pseudo console). */
const releasedPtys = new WeakSet<object>()

/**
 * T0983 (PLAN-066 F4 option D, D522; BUG-238): release a Windows PTY's pseudo console without node-pty's `kill()`.
 *
 * Used (a) for a PTY whose shell exited by itself, once its tab is closed (✕), restarted (⏻) or rebuilt with the same
 * id — until then its conhost stays (the tab still shows `[Process exited …]`); and (b) by BAT's own end of a PTY after
 * its process tree was ended (T0540 order: tree first, then this). Steps, each guarded so one failing does not skip the
 * rest: `_close()` (writes become no-ops, as `Terminal.kill()` does) → ClosePseudoConsole (`_agent._ptyNative.kill`;
 * conhost ends, and with it every process still attached to that console) → destroy conin (T0889) → dispose the conout
 * relay (shared Worker: its `close` after the 1 s drain; node-pty's own Worker in direct mode).
 *
 * 🔴 Never node-pty's `kill()`: with the shell already gone its console-list query fails (`AttachConsole failed`) and
 * 5 s later it calls `process.kill` on the old shell pid, which may by then belong to another process (BUG-238).
 * Not win32 → `skipped:not-win32` before the object is read. Not node-pty 1.1.0's Windows shape → `skipped:shape`,
 * nothing touched (the caller logs it). A second call for the same object → `skipped:already`.
 */
export function releaseExitedPty(proc: unknown, platform: NodeJS.Platform = process.platform): ExitedPtyReleaseResult {
  if (platform !== 'win32') return 'skipped:not-win32'
  if (!proc || typeof proc !== 'object') return 'skipped:shape'
  if (releasedPtys.has(proc)) return 'skipped:already'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let agent: any, native: any, ptyHandle: unknown, inSocket: any, conout: any
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    agent = (proc as any)._agent
    native = agent?._ptyNative
    ptyHandle = agent?._pty
    inSocket = agent?.inSocket
    conout = agent?._conoutSocketWorker
  } catch {
    return 'skipped:shape'
  }
  if (
    typeof native?.kill !== 'function' ||
    typeof ptyHandle !== 'number' ||
    typeof inSocket?.destroy !== 'function' ||
    typeof conout?.dispose !== 'function'
  ) {
    return 'skipped:shape'
  }
  releasedPtys.add(proc)
  const failed: string[] = []
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const close = (proc as any)._close
    if (typeof close === 'function') close.call(proc)
  } catch {
    failed.push('close')
  }
  try {
    native.kill(ptyHandle)
  } catch {
    failed.push('pseudo-console')
  }
  try {
    if (inSocket.destroyed !== true) inSocket.destroy()
  } catch {
    failed.push('conin')
  }
  try {
    conout.dispose()
  } catch {
    failed.push('conout')
  }
  return failed.length ? `failed:${failed.join(',')}` : 'released'
}
