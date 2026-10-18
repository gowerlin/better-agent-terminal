export type WizardTargetOS = 'local' | 'wsl-linux' | 'docker-linux' | 'ssh-linux' | 'ssh-darwin'

import i18next from 'i18next'
import {
  DEFAULT_WIZARD_ERROR_REGISTRY,
  readWizardErrorParams,
  resolveWizardError,
  targetOSToErrorPlatform,
  type WizardMappedError,
} from './error-mapper'

export type { WizardMappedError } from './error-mapper'
export {
  DEFAULT_WIZARD_ERROR_REGISTRY,
  resolveWizardError,
  targetOSToErrorPlatform,
} from './error-mapper'

import {
  createPreflightCache,
  setPreflightCached,
  type WizardPreflightCache,
  type WizardPreflightResult,
} from './preflight'

export type {
  WizardPreflightCache,
  WizardPreflightCacheEntry,
  WizardPreflightResult,
} from './preflight'
export {
  createPreflightCache,
  getPreflightCached,
  setPreflightCached,
} from './preflight'

export interface WizardChoiceOption {
  label: string
  value: string
  description?: string
  /** T0502: i18n key for the button text; `label` is the fallback. */
  labelKey?: string
}

export interface WizardChoiceRequest {
  stepId: string
  title: string
  description?: string
  options: WizardChoiceOption[]
  allowSkip?: boolean
}

/**
 * T0502: free-text prompt (e.g. typing an SSH host). Text fields are i18n
 * keys the Shell translates, with the plain strings as fallbacks. The Shell
 * blocks submit while `validate` returns an i18n error key; the step must
 * still validate what it gets back. Resolves `null` when the user cancels.
 */
export interface WizardTextRequest {
  stepId: string
  title: string
  titleKey?: string
  description?: string
  descriptionKey?: string
  placeholder?: string
  initialValue?: string
  /** Returns an i18n error key for an invalid value, `null` when valid. */
  validate?: (value: string) => string | null
}

export interface WizardLogger {
  info(message: string): void
  warn(message: string): void
  error(message: string): void
}

export interface WizardContext {
  targetOS: WizardTargetOS
  profileDraft: Record<string, unknown>
  warnings: string[]
  /** T0332: per-wizard-session preflight result cache. Runner injects createPreflightCache() if unset. */
  preflightCache?: WizardPreflightCache
  state: Record<string, unknown>
  /** T0383 (BUG-089): actual WSL networking mode from `wslinfo --networking-mode`. */
  networkMode?: 'mirrored' | 'nat' | 'virtioproxy' | 'none' | 'unknown'
  availableDistros?: Array<{ name: string; version: 1 | 2; state: 'Running' | 'Stopped' }>
  wslDistro?: string
  wslSystemdEnabled?: boolean
  /** T0378 (BUG-087 B): absolute $HOME of the WSL distro user (systemd never expands `~`). */
  wslHome?: string
  serverInstallPath?: string
  serverPort?: number
  /**
   * T0387 (BUG-093): where fetch-fingerprint / connect-test reach the server.
   * Set only by the SSH flow (tunnel local end, or the remote host in direct
   * mode). Unset = WSL / Docker default (`127.0.0.1` / `localhost` +
   * `serverPort`).
   */
  verifyEndpoint?: { host: string; port: number }
  remoteToken?: string
  systemdServiceActive?: boolean
  fallbackStartHint?: string
  fingerprint?: string | null
  serverMetadata?: {
    serverPlatform: 'win32' | 'linux' | 'darwin'
    serverArch: 'x64' | 'arm64'
    serverEnv?: 'native' | 'wsl' | 'docker' | 'ssh'
    wslDistro?: string
    dockerMounts?: Array<{ host: string; container: string }>
    serverHome?: string
    nodeVersion: string
    claudeVersion?: string
    bundleVersion: string
    glibcVersion?: string
  } | null
  connectTestSkipped?: boolean
  createdProfileId?: string
  /** T0444 (BUG-111): every profile id write-profile created this run; rollback deletes them all. */
  createdProfileIds?: string[]
  /**
   * T0552 (BUG-138): an existing profile write-profile updated instead of
   * creating one (the shell opens it on done, like `createdProfileId`), and the
   * values it overwrote, which rollback writes back.
   */
  updatedProfileId?: string
  updatedProfiles?: Array<{ id: string; previous: Record<string, unknown> }>
  logger: WizardLogger
  requestChoice?: (request: WizardChoiceRequest) => Promise<string | null>
  /** T0502: free-text prompt; unset when the UI cannot take typed input. */
  requestText?: (request: WizardTextRequest) => Promise<string | null>
}

/**
 * T0330 (PLAN-032 Sprint 2): step semantics. `task` (default) runs to
 * completion without user interaction; `input` waits for ctx.requestChoice
 * (or similar) and the runner snapshots `awaiting-input` while pending.
 *
 * Marking a step `kind: 'input'` is metadata for the runner to wrap
 * ctx.requestChoice — the step itself does NOT have to change. Steps that
 * never call requestChoice (e.g. SSH configure-host today) still benefit
 * because Sprint 3 (T0335) will refactor them to use the same channel.
 */
export type WizardStepKind = 'task' | 'input'

export interface WizardStep {
  id: string
  title: string
  appliesTo: WizardTargetOS[] | 'all'
  /** T0330: defaults to 'task'. See WizardStepKind. */
  kind?: WizardStepKind
  /**
   * T0332: optional pre-flight check executed before run(). Return ok:false
   * to block run() (hard fail, surfaces via ErrorMapper) or warningOnly:true
   * to record a warning on ctx.warnings without blocking. Step authors may
   * use ctx.preflightCache + getPreflightCached/setPreflightCached helpers to
   * memoize expensive checks (e.g. docker daemon ping) per wizard session.
   */
  preflight?(ctx: WizardContext): Promise<WizardPreflightResult>
  run(ctx: WizardContext): Promise<void>
  rollback?(ctx: WizardContext): Promise<void>
  /**
   * T0554 (BUG-141): called once every step has succeeded (or been skipped),
   * in step order, before run() resolves. For what a step keeps around only so
   * its rollback can undo it (e.g. the previous server bundle at
   * `<root>.bat-old`), which is no longer needed once the wizard is done.
   * Best effort: a throw is logged and added to ctx.warnings; the wizard still
   * completes.
   */
  finalize?(ctx: WizardContext): Promise<void>
  /**
   * T0500: called on the jump target (after the jump-back rollback chain,
   * before it re-runs) so an `editableFromFailure` step asks for its input
   * again instead of reusing the value it stored last time. Steps mark the
   * input for re-entry rather than deleting it: the target is not rolled back
   * on a jump, so its rollback (and ownership checks) may still need the old
   * values until the re-run replaces them. Never called on retry / skip.
   */
  resetForEdit?(ctx: WizardContext): void | Promise<void>
  retryable?: boolean
  // T0309 (PLAN-030 #4): user-facing metadata. SetupWizardShell prefers
  // labelKey over the legacy `title`; keys are resolved via i18next at
  // render time. groupKey drives the vertical-stepper section header.
  // editableFromFailure marks steps the user can jump back to from a
  // downstream failure (e.g. configure-ssh-host after verify-ssh-auth fails).
  labelKey?: string
  descriptionKey?: string
  groupKey?: string
  editableFromFailure?: boolean
}

export enum WizardStepStatus {
  Pending = 'pending',
  Running = 'running',
  /** T0330: input-kind step waiting for user decision (e.g. requestChoice). */
  AwaitingInput = 'awaiting-input',
  Succeeded = 'succeeded',
  Failed = 'failed',
  RolledBack = 'rolled-back',
}

/**
 * T0330: thrown when a status transition violates the state-machine guard.
 * Surfaces from/to + stepId so callers can debug runner regressions.
 */
export class WizardStateTransitionError extends Error {
  constructor(
    public readonly stepId: string,
    public readonly from: WizardStepStatus,
    public readonly to: WizardStepStatus,
  ) {
    super(`Invalid wizard step transition for ${stepId}: ${from} -> ${to}`)
    this.name = 'WizardStateTransitionError'
  }
}

/**
 * T0330: allowed status transitions. Workorder spec mandates:
 *  - allowed: pending->running/awaiting-input, running->awaiting-input/failed/succeeded,
 *             awaiting-input->running/failed/succeeded, failed->running (retry) /succeeded (skip)
 *  - forbidden: succeeded->awaiting-input, failed->awaiting-input (no implicit retry),
 *               skipped (status=succeeded+skipped flag)->awaiting-input, rolled-back->*
 *
 * Practical adjustments (vs spec literal):
 *  - retry transitions failed->running directly (not failed->pending->running) — this
 *    matches the existing runner loop (index -= 1; continue;).
 *  - jumpToStep resets [target..current] back to pending; we allow
 *    succeeded->pending and failed->pending as part of the jump-back semantics.
 *  - rollback can land on any step that has a rollback() handler, so we allow
 *    transitions to rolled-back from running/succeeded/failed/awaiting-input.
 */
const ALLOWED_TRANSITIONS: Record<WizardStepStatus, WizardStepStatus[]> = {
  [WizardStepStatus.Pending]: [
    WizardStepStatus.Running,
    WizardStepStatus.AwaitingInput,
    WizardStepStatus.RolledBack,
  ],
  [WizardStepStatus.Running]: [
    WizardStepStatus.AwaitingInput,
    WizardStepStatus.Succeeded,
    WizardStepStatus.Failed,
    WizardStepStatus.RolledBack,
    WizardStepStatus.Pending, // jumpToStep reset
  ],
  [WizardStepStatus.AwaitingInput]: [
    WizardStepStatus.Running,
    WizardStepStatus.Failed,
    WizardStepStatus.Succeeded,
    WizardStepStatus.RolledBack,
    WizardStepStatus.Pending, // jumpToStep reset
  ],
  [WizardStepStatus.Failed]: [
    WizardStepStatus.Running, // retry
    WizardStepStatus.Succeeded, // skip (snapshot.skipped=true)
    WizardStepStatus.Pending, // jumpToStep reset
    WizardStepStatus.RolledBack,
  ],
  [WizardStepStatus.Succeeded]: [
    WizardStepStatus.Pending, // jumpToStep reset over completed step
    WizardStepStatus.RolledBack,
  ],
  [WizardStepStatus.RolledBack]: [],
}

function assertTransition(
  stepId: string,
  from: WizardStepStatus,
  to: WizardStepStatus,
): void {
  if (from === to) return
  const allowed = ALLOWED_TRANSITIONS[from]
  if (!allowed.includes(to)) {
    throw new WizardStateTransitionError(stepId, from, to)
  }
}

export interface WizardStepSnapshot {
  id: string
  title: string
  status: WizardStepStatus
  retryable: boolean
  error?: string
  skipped?: boolean
  // T0309: mirrored from WizardStep so the UI never has to look up the
  // original step descriptor when rendering snapshots.
  labelKey?: string
  descriptionKey?: string
  groupKey?: string
  editableFromFailure?: boolean
  /**
   * T0331 (PLAN-032 Sprint 2): structured error mapping result. Set when a
   * step throws and the runner resolves the error against
   * DEFAULT_WIZARD_ERROR_REGISTRY. UI prefers `mappedError.title`/`body` over
   * the raw `error` string.
   */
  mappedError?: WizardMappedError
}

/** run() rejects with this message when the user cancels (the Shell shows `wizard.cancelled`). */
export const WIZARD_CANCELLED_MESSAGE = 'Wizard cancelled'

/**
 * T0660 (BUG-161): a recovery warning in the UI language. The step is named
 * by its i18n label (`labelKey`), or its English `title` when it has none;
 * `english` is used when i18next is not initialized or lacks the key.
 */
function recoveryWarning(key: string, step: WizardStep, error: string, english: string): string {
  if (!i18next.isInitialized || !i18next.exists(key)) return english
  const stepLabel = step.labelKey && i18next.exists(step.labelKey) ? i18next.t(step.labelKey) : step.title
  return i18next.t(key, { step: stepLabel, error })
}

function defaultLogger(): WizardLogger {
  return {
    info: (message: string) => console.info(`[wizard] ${message}`),
    warn: (message: string) => console.warn(`[wizard] ${message}`),
    error: (message: string) => console.error(`[wizard] ${message}`),
  }
}

export class WizardRunner {
  private readonly activeSteps: WizardStep[]
  private readonly stepSnapshots: WizardStepSnapshot[]
  private readonly completedStepIndexes: number[] = []
  private currentStepIndex = -1
  private rollbackInProgress = false
  private cancelRequested = false
  private runPromise: Promise<void> | null = null
  private waitForRetry: (() => void) | null = null
  private waitForSkip: (() => void) | null = null
  // T0426 (BUG-099): cancel() resolves the failure wait with 'cancel' (it used
  // to reuse waitForRetry, so the failed step was never rolled back).
  private waitForCancel: (() => void) | null = null
  // T0309 / T0489: jumpToStep resolves the failure wait with 'jump'; runInternal
  // rolls back (target, failed] and then re-enters the loop at this index.
  private waitForJump: (() => void) | null = null
  private pendingJumpTarget: number | null = null
  // T0489: set while the jump-back rollback chain runs; retry / skip are ignored.
  private jumpInProgress = false
  private jumpSettled: (() => void) | null = null

  constructor(
    steps: WizardStep[],
    private readonly ctx: WizardContext,
    private readonly onProgress?: (steps: WizardStepSnapshot[]) => void,
  ) {
    this.ctx.logger ??= defaultLogger()
    // T0332: ensure a per-wizard-session preflight cache exists. Callers may
    // inject their own (e.g. for tests / cross-runner reuse); otherwise we
    // start with a fresh Map.
    this.ctx.preflightCache ??= createPreflightCache()
    this.activeSteps = steps.filter((step) => step.appliesTo === 'all' || step.appliesTo.includes(ctx.targetOS))
    this.stepSnapshots = this.activeSteps.map((step) => ({
      id: step.id,
      title: step.title,
      status: WizardStepStatus.Pending,
      retryable: step.retryable !== false,
      labelKey: step.labelKey,
      descriptionKey: step.descriptionKey,
      groupKey: step.groupKey,
      editableFromFailure: step.editableFromFailure,
    }))
    this.emitProgress()
  }

  getSnapshots(): WizardStepSnapshot[] {
    return this.stepSnapshots.map((snapshot) => ({ ...snapshot }))
  }

  async run(): Promise<void> {
    if (!this.runPromise) {
      // BUG-066 (T0300): clear runPromise on rejection so the caller can
      // retry by calling run() again on the same instance. Re-throw to
      // preserve the rejection contract for the original caller.
      this.runPromise = this.runInternal().catch((err) => {
        this.runPromise = null
        throw err
      })
    }
    return this.runPromise
  }

  async retryCurrentStep(): Promise<void> {
    const current = this.currentStepIndex >= 0 ? this.stepSnapshots[this.currentStepIndex] : null
    if (!current || current.status !== WizardStepStatus.Failed || !current.retryable) {
      return
    }
    this.waitForRetry?.()
    this.waitForRetry = null
  }

  async skipCurrentStep(): Promise<void> {
    const current = this.currentStepIndex >= 0 ? this.stepSnapshots[this.currentStepIndex] : null
    if (!current || current.status !== WizardStepStatus.Failed || this.jumpInProgress) {
      return
    }
    this.transitionStatus(this.currentStepIndex, WizardStepStatus.Succeeded)
    current.skipped = true
    current.error = undefined
    this.emitProgress()
    this.waitForSkip?.()
    this.waitForSkip = null
  }

  /**
   * T0309: jump back to an earlier `editableFromFailure` step from a
   * downstream failure. T0489: before re-running from `targetIndex`, the
   * runner rolls back what the steps after it did — the failed step first,
   * then completed (or skipped) steps after the target in reverse order, the
   * same chain cancel() walks. The target step itself is not rolled back: it
   * re-runs and replaces its own output; T0500: its resetForEdit() runs first
   * so it asks for its input again. Each step's rollback only undoes what
   * this wizard run owns (T0444), and a rollback that throws is logged, added
   * to ctx.warnings and does not block the jump (best-effort, like cancel).
   *
   * Only valid while the current step waits on a failure decision (failed and
   * retryable); otherwise it warns and does nothing. Resolves once the
   * rollback chain has finished and the snapshots are reset to Pending.
   */
  async jumpToStep(targetIndex: number): Promise<void> {
    if (targetIndex < 0 || targetIndex >= this.activeSteps.length) {
      this.ctx.logger.warn(`jumpToStep: targetIndex ${targetIndex} out of range`)
      return
    }
    if (this.currentStepIndex < 0) return
    if (targetIndex > this.currentStepIndex) {
      this.ctx.logger.warn(
        `jumpToStep: cannot jump forward (target=${targetIndex} current=${this.currentStepIndex})`,
      )
      return
    }
    const current = this.stepSnapshots[this.currentStepIndex]
    const resolveJump = this.waitForJump
    if (current.status !== WizardStepStatus.Failed || !resolveJump || this.jumpInProgress) {
      this.ctx.logger.warn(`jumpToStep: step ${current.id} is not waiting on a failure decision`)
      return
    }

    this.pendingJumpTarget = targetIndex
    this.jumpInProgress = true
    const settled = new Promise<void>((resolve) => {
      this.jumpSettled = resolve
    })
    this.clearFailureWaiters()
    resolveJump()
    await settled
  }

  async cancel(): Promise<void> {
    this.cancelRequested = true
    if (this.currentStepIndex >= 0 && this.stepSnapshots[this.currentStepIndex].status === WizardStepStatus.Failed) {
      const resolveCancel = this.waitForCancel
      this.clearFailureWaiters()
      resolveCancel?.()
    }
  }

  private clearFailureWaiters(): void {
    this.waitForRetry = null
    this.waitForSkip = null
    this.waitForCancel = null
    this.waitForJump = null
  }

  private async runInternal(): Promise<void> {
    for (let index = 0; index < this.activeSteps.length; index += 1) {
      if (this.cancelRequested) {
        await this.rollbackCompletedSteps()
        throw new Error(WIZARD_CANCELLED_MESSAGE)
      }

      this.currentStepIndex = index
      const step = this.activeSteps[index]
      const snapshot = this.stepSnapshots[index]
      // T0489: a jump target stays in the completed list until it re-runs, so
      // a cancel during the jump-back rollback still rolls it back.
      this.forgetCompletedStep(index)

      this.transitionStatus(index, WizardStepStatus.Running)
      snapshot.error = undefined
      snapshot.skipped = false
      this.emitProgress()

      try {
        // T0332: preflight hook. Run before step.run(). Hard failure
        // (ok:false + !warningOnly) bypasses step.run() and goes through the
        // same ErrorMapper + retry/skip/rollback pipeline as a step throw.
        // warningOnly appends to ctx.warnings and continues. Throws are
        // synthesized into hard failures.
        if (typeof step.preflight === 'function') {
          let preflightResult: WizardPreflightResult
          try {
            preflightResult = await step.preflight(this.ctx)
          } catch (preflightErr) {
            const e =
              preflightErr instanceof Error
                ? preflightErr
                : new Error(String(preflightErr))
            preflightResult = { ok: false, reason: e.message }
          }
          if (preflightResult.cacheKey) {
            // Step authors who want caching can also use getPreflightCached
            // directly; runner stores the result here so adjacent steps may
            // share it via the same key.
            setPreflightCached(
              this.ctx.preflightCache!,
              preflightResult.cacheKey,
              preflightResult,
            )
          }
          if (!preflightResult.ok && !preflightResult.warningOnly) {
            const err = new Error(
              preflightResult.reason ?? 'Preflight check failed',
            ) as Error & { code?: string }
            if (preflightResult.errorCode) err.code = preflightResult.errorCode
            // Throw into the existing catch arm so retry/skip/rollback +
            // ErrorMapper resolution stays in one place.
            throw err
          }
          if (!preflightResult.ok && preflightResult.warningOnly) {
            this.ctx.warnings.push(
              preflightResult.reason ?? `preflight warning: ${step.id}`,
            )
            this.emitProgress()
          }
        }

        // T0330: input-kind steps get a wrapped requestChoice (T0502: and
        // requestText) so the runner can flip status to AwaitingInput while
        // the prompt is pending and back to Running once resolved.
        const restoreInputRequests = this.maybeWrapInputRequests(step, index)
        try {
          await step.run(this.ctx)
        } finally {
          restoreInputRequests()
        }
        if (!snapshot.skipped) {
          this.transitionStatus(index, WizardStepStatus.Succeeded)
          this.completedStepIndexes.push(index)
        }
        this.emitProgress()
      } catch (error) {
        this.transitionStatus(index, WizardStepStatus.Failed)
        const errorObj = error instanceof Error ? error : new Error(String(error))
        // T0331: resolve raw error into structured mapping. Errors with a
        // `code` property (string) populate stage-1 errorCode lookup.
        const errorCode =
          typeof (errorObj as Error & { code?: unknown }).code === 'string'
            ? ((errorObj as Error & { code?: string }).code as string)
            : undefined
        snapshot.mappedError = resolveWizardError(
          {
            platform: targetOSToErrorPlatform(this.ctx.targetOS),
            stepId: step.id,
            errorCode,
            params: readWizardErrorParams(errorObj),
            error: errorObj,
          },
          DEFAULT_WIZARD_ERROR_REGISTRY,
        )
        // Preserve raw message in snapshot.error for backwards compatibility
        // with existing UI/tests that read snapshot.error directly.
        snapshot.error = errorObj.message
        this.emitProgress()

        if (snapshot.retryable && !this.cancelRequested) {
          const decision = await this.waitForRetryOrSkip()
          if (decision === 'jump') {
            const jumpTarget = this.pendingJumpTarget ?? index
            this.pendingJumpTarget = null
            await this.rollbackForJump(index, jumpTarget)
            // Set index = jumpTarget - 1 so the for-loop increment lands on jumpTarget.
            index = jumpTarget - 1
            continue
          }
          if (decision === 'retry') {
            index -= 1
            continue
          }
          if (decision === 'skip') {
            this.completedStepIndexes.push(index)
            continue
          }
          // T0426 (BUG-099): cancelled from the failure screen. The failed
          // step may have got halfway (e.g. start-server wrote the unit), so
          // roll it back first, then the completed steps in reverse order.
          await this.rollbackFailedStep(step, index)
          await this.rollbackCompletedSteps()
          throw new Error(WIZARD_CANCELLED_MESSAGE)
        }

        await this.rollbackFailedStep(step)
        await this.rollbackCompletedSteps()
        throw error
      }
    }
    await this.finalizeCompletedSteps()
  }

  /** T0554: every step finished; run finalize() in step order (best effort). */
  private async finalizeCompletedSteps(): Promise<void> {
    for (const index of [...this.completedStepIndexes].sort((a, b) => a - b)) {
      const step = this.activeSteps[index]
      if (!step.finalize) continue
      try {
        await step.finalize(this.ctx)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        this.ctx.logger.warn(`Finalize failed for ${step.id}: ${message}`)
        const warning = recoveryWarning(
          'wizard.shared.warning.finalizeFailed',
          step,
          message,
          `Could not finish cleaning up after "${step.title}": ${message}`,
        )
        if (!this.ctx.warnings.includes(warning)) this.ctx.warnings.push(warning)
        this.emitProgress()
      }
    }
  }

  private waitForRetryOrSkip(): Promise<'retry' | 'skip' | 'cancel' | 'jump'> {
    return new Promise((resolve) => {
      this.waitForRetry = () => resolve('retry')
      this.waitForSkip = () => resolve('skip')
      this.waitForCancel = () => resolve('cancel')
      this.waitForJump = () => resolve('jump')

      if (this.cancelRequested) {
        resolve('cancel')
      }
    })
  }

  /**
   * T0489: jump-back rollback chain. Rolls back the failed step (when it lies
   * after the target), then completed / skipped steps after the target in
   * reverse completion order, then calls the target's resetForEdit (T0500),
   * then resets [target .. failed] to Pending. The
   * statuses go straight to Pending (not RolledBack, which is terminal) since
   * those steps re-run. Rollback errors never block the jump: they are logged
   * and surfaced on ctx.warnings because the wizard keeps going.
   */
  private async rollbackForJump(failedIndex: number, targetIndex: number): Promise<void> {
    try {
      if (failedIndex > targetIndex) {
        await this.rollbackStepForJump(failedIndex)
      }
      for (const index of [...this.completedStepIndexes].reverse()) {
        if (index > targetIndex) await this.rollbackStepForJump(index)
      }
      for (let i = this.completedStepIndexes.length - 1; i >= 0; i -= 1) {
        if (this.completedStepIndexes[i] > targetIndex) {
          this.completedStepIndexes.splice(i, 1)
        }
      }
      await this.resetTargetForEdit(targetIndex)
      for (let i = targetIndex; i <= failedIndex; i += 1) {
        this.transitionStatus(i, WizardStepStatus.Pending)
        const snap = this.stepSnapshots[i]
        snap.error = undefined
        snap.mappedError = undefined
        snap.skipped = false
      }
      this.emitProgress()
    } finally {
      this.jumpInProgress = false
      this.jumpSettled?.()
      this.jumpSettled = null
    }
  }

  private async rollbackStepForJump(index: number): Promise<void> {
    const step = this.activeSteps[index]
    if (!step.rollback) return
    try {
      await step.rollback(this.ctx)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.ctx.logger.warn(`Rollback failed for ${step.id} while jumping back: ${message}`)
      const warning = recoveryWarning(
        'wizard.shared.warning.jumpRollbackFailed',
        step,
        message,
        `Could not undo "${step.title}" before going back: ${message}`,
      )
      if (!this.ctx.warnings.includes(warning)) this.ctx.warnings.push(warning)
      this.emitProgress()
    }
  }

  /**
   * T0500: let the jump target ask for its input again. Runs after the
   * rollback chain so the rolled-back steps still saw the old values. A throw
   * is logged and does not block the jump; the step then re-runs with its
   * stored input, as before T0500.
   */
  private async resetTargetForEdit(targetIndex: number): Promise<void> {
    const step = this.activeSteps[targetIndex]
    if (!step.resetForEdit) return
    try {
      await step.resetForEdit(this.ctx)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.ctx.logger.warn(`resetForEdit failed for ${step.id}: ${message}`)
    }
  }

  private forgetCompletedStep(index: number): void {
    const position = this.completedStepIndexes.indexOf(index)
    if (position >= 0) this.completedStepIndexes.splice(position, 1)
  }

  private async rollbackCompletedSteps(): Promise<void> {
    if (this.rollbackInProgress) {
      return
    }
    this.rollbackInProgress = true

    // Roll back in reverse execution order so each step tears down only the
    // state it introduced after its dependents are already gone.
    for (const index of [...this.completedStepIndexes].reverse()) {
      const step = this.activeSteps[index]
      if (!step.rollback) {
        continue
      }

      try {
        await step.rollback(this.ctx)
        this.transitionStatus(index, WizardStepStatus.RolledBack)
      } catch (error) {
        this.ctx.logger.warn(
          `Rollback failed for ${step.id}: ${error instanceof Error ? error.message : String(error)}`,
        )
      }
      this.emitProgress()
    }
  }

  /**
   * Roll back the step that failed. With `index` (cancel path, T0426) a
   * successful rollback also marks the step rolled-back; without it (a
   * non-retryable failure) the snapshot keeps showing the failure.
   */
  private async rollbackFailedStep(step: WizardStep, index?: number): Promise<void> {
    if (!step.rollback) {
      return
    }

    try {
      await step.rollback(this.ctx)
      if (index !== undefined) {
        this.transitionStatus(index, WizardStepStatus.RolledBack)
        this.emitProgress()
      }
    } catch (error) {
      this.ctx.logger.warn(
        `Rollback failed for failed step ${step.id}: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  /**
   * T0330: when the active step is `kind: 'input'`, swap ctx.requestChoice
   * (T0502: and ctx.requestText) with wrapped versions that flip the step
   * status between Running and AwaitingInput. Returns a restore() that the
   * caller MUST invoke (in a finally block) to put the originals back. No-op
   * when the step is not input-kind; an unset request function stays unset.
   */
  private maybeWrapInputRequests(step: WizardStep, index: number): () => void {
    if (step.kind !== 'input') return () => undefined
    const originalChoice = this.ctx.requestChoice
    const originalText = this.ctx.requestText

    if (typeof originalChoice === 'function') {
      this.ctx.requestChoice = (request) => this.awaitInput(index, () => originalChoice(request))
    }
    if (typeof originalText === 'function') {
      this.ctx.requestText = (request) => this.awaitInput(index, () => originalText(request))
    }

    return () => {
      this.ctx.requestChoice = originalChoice
      this.ctx.requestText = originalText
    }
  }

  private async awaitInput<T>(index: number, ask: () => Promise<T>): Promise<T> {
    // running -> awaiting-input
    this.transitionStatus(index, WizardStepStatus.AwaitingInput)
    this.emitProgress()
    try {
      return await ask()
    } finally {
      // awaiting-input -> running (regardless of whether user chose or skipped)
      // Only flip back if step is still in awaiting-input — guards against
      // concurrent transitions (e.g. cancel during input).
      const snap = this.stepSnapshots[index]
      if (snap && snap.status === WizardStepStatus.AwaitingInput) {
        this.transitionStatus(index, WizardStepStatus.Running)
        this.emitProgress()
      }
    }
  }

  /**
   * T0330: centralized status transition with state-machine guard.
   * All snapshot.status assignments MUST go through this helper so the
   * ALLOWED_TRANSITIONS table catches regressions.
   */
  private transitionStatus(index: number, to: WizardStepStatus): void {
    const snap = this.stepSnapshots[index]
    if (!snap) return
    assertTransition(snap.id, snap.status, to)
    snap.status = to
  }

  private emitProgress(): void {
    this.onProgress?.(this.getSnapshots())
  }
}
