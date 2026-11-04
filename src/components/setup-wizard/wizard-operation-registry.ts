/**
 * T0830 (PLAN-043): main-process registry of abortable setup-wizard IPC
 * operations. A wizard step that passes `operationId` with an IPC call
 * (server bundle download, WSL bundle install, WSL service start) gets an
 * AbortSignal for it here; `wizard:abort-operation` aborts it. Without an
 * `operationId` the handler gets no signal and behaves exactly as before.
 *
 * Pure (no electron / DOM import): main.ts constructs it; the renderer side is
 * `runAbortableOperation` (wizard-abort.ts). An abort that reaches main before
 * the operation registered (both are IPC messages) is remembered briefly so the
 * operation starts already aborted.
 */

/** Ids the renderer generates (`newWizardOperationId`). Anything else is ignored. */
export const WIZARD_OPERATION_ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/

/** How long an abort for a not-yet-registered id is remembered. */
export const WIZARD_EARLY_ABORT_TTL_MS = 60_000
/** At most this many remembered early aborts (oldest dropped). */
export const WIZARD_EARLY_ABORT_MAX = 64

export function isWizardOperationId(value: unknown): value is string {
  return typeof value === 'string' && WIZARD_OPERATION_ID_PATTERN.test(value)
}

export interface WizardOperationScope {
  /** Undefined when the call carried no (valid) operation id. */
  signal: AbortSignal | undefined
  /** Unregister; safe to call more than once. */
  end(): void
}

export class WizardOperationRegistry {
  private readonly operations = new Map<string, AbortController>()
  private readonly earlyAborts = new Map<string, number>()

  constructor(private readonly now: () => number = () => Date.now()) {}

  begin(operationId: unknown): WizardOperationScope {
    if (!isWizardOperationId(operationId)) return { signal: undefined, end: () => undefined }
    const controller = new AbortController()
    this.operations.set(operationId, controller)
    this.pruneEarlyAborts()
    if (this.earlyAborts.delete(operationId)) controller.abort()
    return {
      signal: controller.signal,
      end: () => {
        if (this.operations.get(operationId) === controller) this.operations.delete(operationId)
      },
    }
  }

  /** Abort a registered operation (true), or remember the id until it registers (false). */
  abort(operationId: unknown): boolean {
    if (!isWizardOperationId(operationId)) return false
    const controller = this.operations.get(operationId)
    if (controller) {
      controller.abort()
      return true
    }
    this.pruneEarlyAborts()
    this.earlyAborts.set(operationId, this.now() + WIZARD_EARLY_ABORT_TTL_MS)
    while (this.earlyAborts.size > WIZARD_EARLY_ABORT_MAX) {
      const oldest = this.earlyAborts.keys().next().value
      if (oldest === undefined) break
      this.earlyAborts.delete(oldest)
    }
    return false
  }

  /** Registered (not ended) operations; for tests and logs. */
  get size(): number {
    return this.operations.size
  }

  private pruneEarlyAborts(): void {
    const now = this.now()
    for (const [id, expiresAt] of this.earlyAborts) {
      if (expiresAt <= now) this.earlyAborts.delete(id)
    }
  }
}
