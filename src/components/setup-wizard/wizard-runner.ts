export type WizardTargetOS = 'local' | 'wsl-linux' | 'docker-linux' | 'ssh-linux' | 'ssh-darwin'

export interface WizardChoiceOption {
  label: string
  value: string
  description?: string
}

export interface WizardChoiceRequest {
  stepId: string
  title: string
  description?: string
  options: WizardChoiceOption[]
  allowSkip?: boolean
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
  state: Record<string, unknown>
  networkMode?: 'mirrored' | 'nat' | 'unknown'
  availableDistros?: Array<{ name: string; version: 1 | 2; state: 'Running' | 'Stopped' }>
  wslDistro?: string
  wslSystemdEnabled?: boolean
  serverInstallPath?: string
  serverPort?: number
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
  logger: WizardLogger
  requestChoice?: (request: WizardChoiceRequest) => Promise<string | null>
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
  run(ctx: WizardContext): Promise<void>
  rollback?(ctx: WizardContext): Promise<void>
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
  // T0309: when set, the next "retry" decision in runInternal redirects the
  // loop to this index instead of re-running the same failed step.
  private pendingJumpTarget: number | null = null

  constructor(
    steps: WizardStep[],
    private readonly ctx: WizardContext,
    private readonly onProgress?: (steps: WizardStepSnapshot[]) => void,
  ) {
    this.ctx.logger ??= defaultLogger()
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
    if (!current || current.status !== WizardStepStatus.Failed) {
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
   * downstream failure. Basic version (PARTIAL of full DOD): resets the
   * snapshot statuses for steps in [targetIndex, currentStepIndex] back to
   * Pending and unblocks the failure-await loop with a "retry" decision so
   * the runner re-enters the loop at targetIndex on the next iteration.
   *
   * Limitation (deferred): does NOT walk `rollback()` for the steps in
   * between — see workorder Step 5 note "TODO: jumpToStep with full
   * rollback chain (basic version landed)".
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

    // Reset snapshots for [targetIndex .. currentStepIndex]. Preserve
    // metadata (labelKey/groupKey/etc) but clear runtime state so the
    // re-run starts clean.
    for (let i = targetIndex; i <= this.currentStepIndex; i += 1) {
      this.transitionStatus(i, WizardStepStatus.Pending)
      const snap = this.stepSnapshots[i]
      snap.error = undefined
      snap.skipped = false
    }
    // Drop completed-step bookkeeping for the same range so retry/skip
    // accounting stays consistent on re-execution.
    for (let i = this.completedStepIndexes.length - 1; i >= 0; i -= 1) {
      if (this.completedStepIndexes[i] >= targetIndex) {
        this.completedStepIndexes.splice(i, 1)
      }
    }
    this.emitProgress()

    // Set pendingJumpTarget so the failure-loop's "retry" branch redirects
    // index = targetIndex - 1 instead of re-running the same failed step.
    this.pendingJumpTarget = targetIndex
    this.waitForRetry?.()
    this.waitForRetry = null
  }

  async cancel(): Promise<void> {
    this.cancelRequested = true
    if (this.currentStepIndex >= 0 && this.stepSnapshots[this.currentStepIndex].status === WizardStepStatus.Failed) {
      this.waitForRetry?.()
      this.waitForRetry = null
      this.waitForSkip?.()
      this.waitForSkip = null
    }
  }

  private async runInternal(): Promise<void> {
    for (let index = 0; index < this.activeSteps.length; index += 1) {
      if (this.cancelRequested) {
        await this.rollbackCompletedSteps()
        throw new Error('Wizard cancelled')
      }

      this.currentStepIndex = index
      const step = this.activeSteps[index]
      const snapshot = this.stepSnapshots[index]

      this.transitionStatus(index, WizardStepStatus.Running)
      snapshot.error = undefined
      snapshot.skipped = false
      this.emitProgress()

      try {
        // T0330: input-kind steps get a wrapped requestChoice so the runner
        // can flip status to AwaitingInput while the prompt is pending and
        // back to Running once resolved.
        const restoreRequestChoice = this.maybeWrapRequestChoice(step, index)
        try {
          await step.run(this.ctx)
        } finally {
          restoreRequestChoice()
        }
        if (!snapshot.skipped) {
          this.transitionStatus(index, WizardStepStatus.Succeeded)
          this.completedStepIndexes.push(index)
        }
        this.emitProgress()
      } catch (error) {
        this.transitionStatus(index, WizardStepStatus.Failed)
        snapshot.error = error instanceof Error ? error.message : String(error)
        this.emitProgress()

        if (snapshot.retryable && !this.cancelRequested) {
          const decision = await this.waitForRetryOrSkip()
          if (decision === 'retry') {
            if (this.pendingJumpTarget !== null) {
              const jumpTarget = this.pendingJumpTarget
              this.pendingJumpTarget = null
              // Set index = jumpTarget - 1 so the for-loop increment lands on jumpTarget.
              index = jumpTarget - 1
              continue
            }
            index -= 1
            continue
          }
          if (decision === 'skip') {
            this.completedStepIndexes.push(index)
            continue
          }
        }

        await this.rollbackFailedStep(step)
        await this.rollbackCompletedSteps()
        throw error
      }
    }
  }

  private waitForRetryOrSkip(): Promise<'retry' | 'skip' | 'cancel'> {
    return new Promise((resolve) => {
      this.waitForRetry = () => resolve('retry')
      this.waitForSkip = () => resolve('skip')

      if (this.cancelRequested) {
        resolve('cancel')
      }
    })
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

  private async rollbackFailedStep(step: WizardStep): Promise<void> {
    if (!step.rollback) {
      return
    }

    try {
      await step.rollback(this.ctx)
    } catch (error) {
      this.ctx.logger.warn(
        `Rollback failed for failed step ${step.id}: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  /**
   * T0330: when the active step is `kind: 'input'`, swap ctx.requestChoice
   * with a wrapped version that flips the step status between Running and
   * AwaitingInput. Returns a restore() that the caller MUST invoke (in a
   * finally block) to put the original requestChoice back. No-op when the
   * step is not input-kind or when ctx.requestChoice is unset.
   */
  private maybeWrapRequestChoice(step: WizardStep, index: number): () => void {
    if (step.kind !== 'input') return () => undefined
    const original = this.ctx.requestChoice
    if (typeof original !== 'function') return () => undefined

    this.ctx.requestChoice = async (request) => {
      // running -> awaiting-input
      this.transitionStatus(index, WizardStepStatus.AwaitingInput)
      this.emitProgress()
      try {
        return await original(request)
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

    return () => {
      this.ctx.requestChoice = original
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
