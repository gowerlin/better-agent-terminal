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

export interface WizardStep {
  id: string
  title: string
  appliesTo: WizardTargetOS[] | 'all'
  run(ctx: WizardContext): Promise<void>
  rollback?(ctx: WizardContext): Promise<void>
  retryable?: boolean
}

export enum WizardStepStatus {
  Pending = 'pending',
  Running = 'running',
  Succeeded = 'succeeded',
  Failed = 'failed',
  RolledBack = 'rolled-back',
}

export interface WizardStepSnapshot {
  id: string
  title: string
  status: WizardStepStatus
  retryable: boolean
  error?: string
  skipped?: boolean
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
    }))
    this.emitProgress()
  }

  getSnapshots(): WizardStepSnapshot[] {
    return this.stepSnapshots.map((snapshot) => ({ ...snapshot }))
  }

  async run(): Promise<void> {
    if (!this.runPromise) {
      this.runPromise = this.runInternal()
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
    current.status = WizardStepStatus.Succeeded
    current.skipped = true
    current.error = undefined
    this.emitProgress()
    this.waitForSkip?.()
    this.waitForSkip = null
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

      snapshot.status = WizardStepStatus.Running
      snapshot.error = undefined
      snapshot.skipped = false
      this.emitProgress()

      try {
        await step.run(this.ctx)
        if (!snapshot.skipped) {
          snapshot.status = WizardStepStatus.Succeeded
          this.completedStepIndexes.push(index)
        }
        this.emitProgress()
      } catch (error) {
        snapshot.status = WizardStepStatus.Failed
        snapshot.error = error instanceof Error ? error.message : String(error)
        this.emitProgress()

        if (snapshot.retryable && !this.cancelRequested) {
          const decision = await this.waitForRetryOrSkip()
          if (decision === 'retry') {
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
      const snapshot = this.stepSnapshots[index]
      if (!step.rollback) {
        continue
      }

      try {
        await step.rollback(this.ctx)
        snapshot.status = WizardStepStatus.RolledBack
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

  private emitProgress(): void {
    this.onProgress?.(this.getSnapshots())
  }
}
