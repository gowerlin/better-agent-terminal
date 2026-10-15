import { execFile } from 'child_process'

/**
 * T0540 (PLAN-042): end a PTY's whole process tree on Windows.
 *
 * node-pty's Windows `kill()` only ends the processes attached to the pseudo console
 * (shell, agent CLI, console children). A child the agent started without a console
 * (`detached`, DETACHED_PROCESS) is not attached and kept running after ✕ / restart /
 * quit; direct mode (`PtyManager.kill`) already ran `taskkill /F /T` for it.
 * `taskkill /T` walks the parent chain, so it must run while the shell is still alive:
 * call this before `pty.kill()`.
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
