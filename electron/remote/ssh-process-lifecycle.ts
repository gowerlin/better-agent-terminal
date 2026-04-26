import type { ChildProcess } from 'child_process'

/**
 * Shared ssh subprocess shutdown (T0299 / BUG-063). SIGTERM → grace →
 * SIGKILL → final wait; returns the method that caused the exit.
 */

export type ShutdownMethod = 'sigterm' | 'sigkill' | 'timeout'

export interface ShutdownOptions {
  gracePeriodMs?: number
  timeoutMs?: number
  logger?: { warn: (message: string) => void }
}

export interface ShutdownResult {
  exited: boolean
  method: ShutdownMethod
}

const DEFAULT_GRACE_MS = 1_000
const DEFAULT_TIMEOUT_MS = 5_000

export async function shutdownSshProcess(
  proc: ChildProcess,
  opts: ShutdownOptions = {},
): Promise<ShutdownResult> {
  const grace = opts.gracePeriodMs ?? DEFAULT_GRACE_MS
  const total = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS

  if (proc.exitCode != null || proc.signalCode != null) {
    return { exited: true, method: 'sigterm' }
  }

  const exitPromise = new Promise<void>((resolve) => {
    proc.once('exit', () => resolve())
  })

  try { proc.kill('SIGTERM') } catch { /* race with OS reap */ }

  const sigtermStage = await Promise.race([
    exitPromise.then(() => 'exited' as const),
    sleep(grace).then(() => 'timeout' as const),
  ])
  if (sigtermStage === 'exited') return { exited: true, method: 'sigterm' }

  const pidLabel = proc.pid ?? 'unknown'
  opts.logger?.warn(
    `[ssh-process-lifecycle] ssh pid=${pidLabel} did not exit after SIGTERM ${grace}ms — escalating to SIGKILL`,
  )
  try { proc.kill('SIGKILL') } catch { /* same race */ }

  const remaining = Math.max(0, total - grace)
  const sigkillStage = await Promise.race([
    exitPromise.then(() => 'exited' as const),
    sleep(remaining).then(() => 'timeout' as const),
  ])
  if (sigkillStage === 'exited') return { exited: true, method: 'sigkill' }

  opts.logger?.warn(
    `[ssh-process-lifecycle] ssh pid=${pidLabel} did not exit after SIGKILL ${remaining}ms — giving up`,
  )
  return { exited: false, method: 'timeout' }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
