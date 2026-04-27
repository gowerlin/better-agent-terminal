import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  WizardRunner,
  WizardStepStatus,
  type WizardChoiceRequest,
  type WizardContext,
  type WizardStep,
  type WizardStepSnapshot,
  type WizardTargetOS,
} from './wizard-runner'
import { buildDockerWizardSteps, createDockerWizardContext } from './docker-flow'
import { buildSshWizardSteps, createSshWizardContext } from './ssh-flow'
import { buildWslWizardSteps, createWslWizardContext } from './wsl-flow'
import { Stepper } from '../stepper/Stepper'
import type { StepDescriptor, StepStatus } from '../stepper/types'

interface SetupWizardShellProps {
  steps: WizardStep[]
  ctx: WizardContext
  onComplete?: (profileId: string) => void
}

function resolveWizardSteps(targetOS: WizardTargetOS): WizardStep[] {
  switch (targetOS) {
    case 'wsl-linux':
      return buildWslWizardSteps()
    case 'docker-linux':
      return buildDockerWizardSteps()
    case 'ssh-linux':
    case 'ssh-darwin':
      return buildSshWizardSteps()
    default:
      return []
  }
}

function createWizardContext(targetOS: WizardTargetOS, initial: { profileName: string }): WizardContext {
  switch (targetOS) {
    case 'wsl-linux':
      return createWslWizardContext(initial)
    case 'docker-linux':
      return createDockerWizardContext(initial)
    case 'ssh-linux':
    case 'ssh-darwin':
      return createSshWizardContext(initial)
    default:
      throw new Error(`Setup wizard is not implemented for ${targetOS}.`)
  }
}

function useSetupWizardController(targetOS: WizardTargetOS, onComplete: (profileId: string) => void) {
  const [isOpen, setIsOpen] = useState(false)
  const [ctx, setCtx] = useState<WizardContext | null>(null)
  const [instanceKey, setInstanceKey] = useState(0)

  const open = (profileName = '') => {
    setCtx(createWizardContext(targetOS, { profileName }))
    setInstanceKey((value) => value + 1)
    setIsOpen(true)
  }

  const close = () => {
    setIsOpen(false)
    setCtx(null)
  }

  const handleComplete = (profileId: string) => {
    onComplete(profileId)
    close()
  }

  return {
    isOpen,
    key: instanceKey,
    steps: resolveWizardSteps(targetOS),
    ctx,
    open,
    close,
    handleComplete,
  }
}

export function useWslWizardController(onComplete: (profileId: string) => void) {
  return useSetupWizardController('wsl-linux', onComplete)
}

export function useDockerWizardController(onComplete: (profileId: string) => void) {
  return useSetupWizardController('docker-linux', onComplete)
}

// T0287: SSH wizard controller — Phase 4 capstone entry point. Defaults to
// ssh-linux; verify-ssh-auth flips ctx.targetOS to ssh-darwin if the probe
// detects a macOS server (Journey C cross-OS scenario).
export function useSshWizardController(onComplete: (profileId: string) => void) {
  return useSetupWizardController('ssh-linux', onComplete)
}

/**
 * Map runner snapshot status → Stepper StepStatus.
 * `succeeded + skipped` collapses to 'skipped' so the visual matches user intent.
 */
function mapStepStatus(snapshot: WizardStepSnapshot): StepStatus {
  if (snapshot.skipped) return 'skipped'
  switch (snapshot.status) {
    case WizardStepStatus.Pending:
      return 'pending'
    case WizardStepStatus.Running:
      return 'running'
    // T0330: input-kind step waiting on requestChoice.
    case WizardStepStatus.AwaitingInput:
      return 'awaiting-input'
    case WizardStepStatus.Succeeded:
      return 'completed'
    case WizardStepStatus.Failed:
      return 'failed'
    case WizardStepStatus.RolledBack:
      return 'rolled-back'
    default:
      return 'pending'
  }
}

/**
 * Build StepDescriptor[] for <Stepper>. Prefer i18n keys; fall back to
 * legacy `title` when keys are missing (back-compat for steps not yet
 * migrated).
 */
// T0330: shared DOM id for the active prompt region. The Stepper wires
// aria-describedby={PROMPT_REGION_ID} on awaiting-input steps so screen
// readers announce the prompt as the step's description.
const PROMPT_REGION_ID = 'bat-wizard-active-prompt'

function buildStepDescriptors(
  snapshots: WizardStepSnapshot[],
  t: (key: string, opts?: Record<string, unknown>) => string,
): StepDescriptor[] {
  return snapshots.map((s) => {
    const label = s.labelKey ? t(s.labelKey) : s.title
    const description = s.descriptionKey ? t(s.descriptionKey) : undefined
    const groupLabel = s.groupKey ? t(s.groupKey) : undefined
    const status = mapStepStatus(s)
    return {
      id: s.id,
      label,
      description,
      groupLabel,
      status,
      retryable: s.retryable,
      errorMessage: s.error,
      // T0330: only set promptRegionId on awaiting-input rows so non-input
      // steps don't pick up a stray aria-describedby pointer.
      promptRegionId: status === 'awaiting-input' ? PROMPT_REGION_ID : undefined,
    }
  })
}

interface StepDetailPanelProps {
  active: WizardStepSnapshot | null
  readOnly: WizardStepSnapshot | null
  activeChoice: WizardChoiceRequest | null
  onChoiceSelect: (value: string | null) => void
  onBackToCurrent: () => void
  ctx: WizardContext
}

function StepDetailPanel({
  active,
  readOnly,
  activeChoice,
  onChoiceSelect,
  onBackToCurrent,
  ctx,
}: StepDetailPanelProps) {
  const { t } = useTranslation()
  const display = readOnly ?? active
  const isReadOnly = readOnly !== null

  if (!display) {
    return (
      <div className="bat-wizard-detail bat-wizard-detail-empty">
        <p className="text-sm text-neutral-400">{t('wizard.noStep')}</p>
      </div>
    )
  }

  const label = display.labelKey ? t(display.labelKey) : display.title
  const description = display.descriptionKey ? t(display.descriptionKey) : undefined

  return (
    <div className="bat-wizard-detail">
      <header className="bat-wizard-detail-header">
        <div className="text-xs uppercase tracking-wide text-neutral-500">
          {isReadOnly ? t('wizard.readonly.viewing') : t('wizard.currentStep')}
        </div>
        <h3 className="text-base font-semibold text-neutral-100">{label}</h3>
        {description && <p className="mt-1 text-sm text-neutral-400">{description}</p>}
      </header>

      <div className="bat-wizard-detail-body">
        {display.status === WizardStepStatus.Running && (
          <p className="text-sm text-sky-300">⏳ {t('wizard.currentStep')}…</p>
        )}
        {display.status === WizardStepStatus.Failed && display.error && (
          <p className="mt-2 text-sm text-rose-300" role="alert">
            {display.error}
          </p>
        )}
        {display.skipped && (
          <p className="mt-2 text-sm text-amber-300">{t('wizard.skippedNote')}</p>
        )}
      </div>

      {!isReadOnly && activeChoice && (
        <div
          id={PROMPT_REGION_ID}
          className="mt-3 rounded-lg border border-sky-700 bg-sky-950/40 p-4"
          role="group"
          aria-label={activeChoice.title}
        >
          <h4 className="font-medium text-sky-100">{activeChoice.title}</h4>
          {activeChoice.description && (
            <p className="mt-1 text-sm text-sky-200">{activeChoice.description}</p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {activeChoice.options.map((option) => (
              <button
                key={option.value}
                className="rounded-md border border-sky-600 px-3 py-2 text-sm text-sky-100 transition hover:bg-sky-900"
                onClick={() => onChoiceSelect(option.value)}
                type="button"
              >
                {option.label}
              </button>
            ))}
            {activeChoice.allowSkip && (
              <button
                className="rounded-md border border-neutral-700 px-3 py-2 text-sm text-neutral-200 transition hover:bg-neutral-800"
                onClick={() => onChoiceSelect(null)}
                type="button"
              >
                {t('wizard.action.skipChoice')}
              </button>
            )}
          </div>
        </div>
      )}

      {isReadOnly && (
        <div className="mt-3">
          <button
            className="rounded-md border border-neutral-700 px-3 py-2 text-sm text-neutral-100 transition hover:bg-neutral-800"
            onClick={onBackToCurrent}
            type="button"
          >
            ← {t('wizard.readonly.back')}
          </button>
        </div>
      )}

      {ctx.warnings.length > 0 && (
        <div className="mt-3 rounded-lg border border-amber-700 bg-amber-950/30 p-3 text-sm text-amber-200">
          <div className="text-xs uppercase tracking-wide text-amber-400">
            {t('wizard.warningHeader')}
          </div>
          {ctx.warnings.map((warning) => (
            <p key={warning} className="mt-1">{warning}</p>
          ))}
        </div>
      )}
    </div>
  )
}

export function SetupWizardShell({ steps, ctx, onComplete }: SetupWizardShellProps) {
  const { t } = useTranslation()
  const [stepStates, setStepStates] = useState<WizardStepSnapshot[]>([])
  const [activeChoice, setActiveChoice] = useState<WizardChoiceRequest | null>(null)
  const [wizardError, setWizardError] = useState<string | null>(null)
  const [complete, setComplete] = useState(false)
  const [readOnlyStepId, setReadOnlyStepId] = useState<string | null>(null)
  const choiceResolverRef = useRef<((value: string | null) => void) | null>(null)
  const runnerRef = useRef<WizardRunner | null>(null)

  useEffect(() => {
    const runnerCtx: WizardContext = {
      ...ctx,
      requestChoice: (request) => new Promise<string | null>((resolve) => {
        choiceResolverRef.current = resolve
        setActiveChoice(request)
      }),
    }

    const runner = new WizardRunner(steps, runnerCtx, setStepStates)
    runnerRef.current = runner
    void runner.run()
      .then(() => {
        setComplete(true)
        if (runnerCtx.createdProfileId) {
          onComplete?.(runnerCtx.createdProfileId)
        }
      })
      .catch((error) => setWizardError(error instanceof Error ? error.message : String(error)))

    return () => {
      void runner.cancel()
      runnerRef.current = null
    }
  }, [ctx, steps])

  const completedCount = stepStates.filter(
    (step) => step.status === WizardStepStatus.Succeeded || step.skipped,
  ).length
  const total = stepStates.length
  const progressPercent = total === 0 ? 0 : Math.round((completedCount / total) * 100)

  // Resolve active step (running or first failed). Falls back to first
  // pending if nothing is running yet.
  const activeStep = useMemo(() => {
    const running = stepStates.find((s) => s.status === WizardStepStatus.Running)
    if (running) return running
    // T0330: awaiting-input step is the user's focus while a choice is pending.
    const awaiting = stepStates.find((s) => s.status === WizardStepStatus.AwaitingInput)
    if (awaiting) return awaiting
    const failed = stepStates.find((s) => s.status === WizardStepStatus.Failed)
    if (failed) return failed
    const firstPending = stepStates.find((s) => s.status === WizardStepStatus.Pending)
    if (firstPending) return firstPending
    return stepStates[stepStates.length - 1] ?? null
  }, [stepStates])

  const readOnlyStep = useMemo(() => {
    if (!readOnlyStepId) return null
    return stepStates.find((s) => s.id === readOnlyStepId) ?? null
  }, [readOnlyStepId, stepStates])

  const stepDescriptors = useMemo(() => buildStepDescriptors(stepStates, t), [stepStates, t])
  const currentIndex = useMemo(() => {
    if (!activeStep) return 0
    return stepStates.findIndex((s) => s.id === activeStep.id)
  }, [activeStep, stepStates])

  const handleChoiceSelect = (value: string | null) => {
    choiceResolverRef.current?.(value)
    choiceResolverRef.current = null
    setActiveChoice(null)
  }

  const handleStepClick = (step: StepDescriptor, _index: number) => {
    // Only completed/skipped steps are clickable (set via clickableSteps).
    setReadOnlyStepId(step.id)
  }

  const handleBackToCurrent = () => setReadOnlyStepId(null)

  // Locate nearest editable predecessor to the current failed step.
  const findEditableTarget = (failedIndex: number): number | null => {
    for (let i = failedIndex - 1; i >= 0; i -= 1) {
      if (stepStates[i].editableFromFailure) return i
    }
    return null
  }

  return (
    <section className="rounded-xl border border-neutral-800 bg-neutral-950 p-5 text-neutral-100 shadow-lg bat-wizard-shell">
      <header className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">{t(`wizard.title.${ctx.targetOS}`, ctx.targetOS)}</h2>
          <p className="text-sm text-neutral-400">
            {t('wizard.progress.label', { completed: completedCount, total })} ({progressPercent}%)
          </p>
        </div>
        <div className="h-2 w-40 overflow-hidden rounded-full bg-neutral-800">
          <div
            className="h-full bg-emerald-500 transition-all"
            style={{ width: `${progressPercent}%` }}
            role="progressbar"
            aria-valuenow={progressPercent}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>
      </header>

      <div className="bat-wizard-grid grid grid-cols-1 gap-4 md:grid-cols-[minmax(220px,300px)_1fr]">
        <div className="bat-wizard-stepper-col">
          <Stepper
            steps={stepDescriptors}
            currentIndex={currentIndex}
            orientation="vertical"
            groupingMode="none"
            clickableSteps="completed"
            onStepClick={handleStepClick}
            ariaLabel={t(`wizard.title.${ctx.targetOS}`, ctx.targetOS)}
            renderFailedActions={(_step, index) => {
              const snap = stepStates[index]
              const editableTarget = findEditableTarget(index)
              return (
                <div className="bat-stepper-failed-actions flex flex-wrap gap-2">
                  {snap?.retryable !== false && (
                    <button
                      className="rounded-md border border-neutral-700 px-2 py-1 text-xs text-neutral-100 transition hover:bg-neutral-800"
                      onClick={() => void runnerRef.current?.retryCurrentStep()}
                      type="button"
                    >
                      {t('wizard.action.retry')}
                    </button>
                  )}
                  {snap?.retryable !== false && (
                    <button
                      className="rounded-md border border-neutral-700 px-2 py-1 text-xs text-neutral-100 transition hover:bg-neutral-800"
                      onClick={() => void runnerRef.current?.skipCurrentStep()}
                      type="button"
                    >
                      {t('wizard.action.skip')}
                    </button>
                  )}
                  {snap?.editableFromFailure === false && editableTarget !== null && (
                    <button
                      className="rounded-md border border-amber-700 px-2 py-1 text-xs text-amber-100 transition hover:bg-amber-950"
                      onClick={() => void runnerRef.current?.jumpToStep(editableTarget)}
                      type="button"
                    >
                      {t('wizard.action.editConfig')}
                    </button>
                  )}
                  <button
                    className="rounded-md border border-rose-700 px-2 py-1 text-xs text-rose-100 transition hover:bg-rose-950"
                    onClick={() => void runnerRef.current?.cancel()}
                    type="button"
                  >
                    {t('wizard.action.cancel')}
                  </button>
                </div>
              )
            }}
          />
        </div>

        <div className="bat-wizard-detail-col">
          <StepDetailPanel
            active={activeStep}
            readOnly={readOnlyStep}
            activeChoice={activeChoice}
            onChoiceSelect={handleChoiceSelect}
            onBackToCurrent={handleBackToCurrent}
            ctx={ctx}
          />
        </div>
      </div>

      {wizardError && (
        <div className="mt-4 rounded-lg border border-rose-700 bg-rose-950/30 p-4 text-sm text-rose-200">
          <div className="text-xs uppercase tracking-wide text-rose-400">
            {t('wizard.errorHeader')}
          </div>
          <p className="mt-1">{wizardError}</p>
        </div>
      )}

      {complete && !wizardError && (
        <div className="mt-4 rounded-lg border border-emerald-700 bg-emerald-950/30 p-4 text-sm text-emerald-200">
          {t('wizard.progress.complete')}
        </div>
      )}
    </section>
  )
}
