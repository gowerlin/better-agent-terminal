/**
 * T0830 (PLAN-043): renderer side of abortable wizard IPC. With `signal`
 * (a step's `ctx.signal`) the call gets a fresh operation id; when the signal
 * aborts, `wizard:abort-operation` tells main to abort it (main then ends the
 * child process: see wizard-operation-registry.ts). Without a signal the call
 * is made with `undefined` and must then send exactly the pre-T0830 arguments.
 */
import { wizardAbortError } from './wizard-runner'

export function newWizardOperationId(): string {
  const cryptoApi = globalThis.crypto
  if (cryptoApi && typeof cryptoApi.randomUUID === 'function') return cryptoApi.randomUUID()
  return `op-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}

export async function runAbortableOperation<T>(
  signal: AbortSignal | undefined,
  call: (operationId: string | undefined) => Promise<T>,
): Promise<T> {
  if (!signal) return call(undefined)
  if (signal.aborted) throw wizardAbortError()
  const operationId = newWizardOperationId()
  const onAbort = () => {
    try {
      void Promise.resolve(window.electronAPI?.wizard?.abortOperation?.(operationId)).catch(() => undefined)
    } catch {
      // An older preload without wizard.abortOperation: the call runs to its own end.
    }
  }
  signal.addEventListener('abort', onAbort, { once: true })
  try {
    return await call(operationId)
  } finally {
    signal.removeEventListener('abort', onAbort)
  }
}
