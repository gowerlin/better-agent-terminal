import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
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
import {
  DEFAULT_WIZARD_ERROR_REGISTRY,
  resolveWizardError,
  targetOSToErrorPlatform,
  type WizardMappedError,
  type WizardRecoveryAction,
} from './error-mapper'
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

// T0287: SSH wizard controller -- Phase 4 capstone entry point. Defaults to
// ssh-linux; verify-ssh-auth flips ctx.targetOS to ssh-darwin if the probe
// detects a macOS server (Journey C cross-OS scenario).
export function useSshWizardController(onComplete: (profileId: string) => void) {
  return useSetupWizardController('ssh-linux', onComplete)
}

/**
 * Map runner snapshot status -> Stepper StepStatus.
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
  t: TFunction,
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

/**
 * T0333: resolve registered/fallback recovery actions for a failed step.
 * Returns null when the step is not in failed state.
 */
function resolveMappedErrorForSnapshot(
  snap: WizardStepSnapshot | null,
  targetOS: WizardTargetOS,
): WizardMappedError | null {
  if (!snap || snap.status !== WizardStepStatus.Failed) return null
  // T0339 / BUG-076: prefer the runner-shipped mappedError (single source of
  // truth). The runner resolves errors with full context (errorCode + message)
  // so the stage-1 exact errorCode match is preserved. Re-resolving here from
  // `snap.error` alone drops `errorCode`, bypassing the exact match and falling
  // back to regex/fallback (e.g. wsl-not-installed renders as the generic
  // "step failed" instead of the mapped MSFT install link).
  if (snap.mappedError) return snap.mappedError
  // Defensive fallback: reached only when the runner did not ship a
  // mappedError. Current runner always ships one on failure (wizard-runner.ts
  // line ~464), so this path is dead code today but kept so future runner
  // refactors don't silently break the Shell's mapped error UI.
  const rawMessage = snap.error ?? 'Unknown wizard step error'
  return resolveWizardError(
    {
      platform: targetOSToErrorPlatform(targetOS),
      stepId: snap.id,
      error: new Error(rawMessage),
    },
    DEFAULT_WIZARD_ERROR_REGISTRY,
  )
}

/**
 * T0333: default labels per action kind when registry omits an explicit
 * `label`. open-link / custom kinds always carry their own label by type.
 */
function defaultActionLabel(
  action: WizardRecoveryAction,
  t: TFunction,
): string {
  if ('label' in action && action.label) return action.label
  switch (action.kind) {
    case 'retry':
      return t('wizard.action.retry')
    case 'fixed-and-retry':
      return t('wizard.action.fixedAndRetry', 'Already fixed, retry')
    case 'skip':
      return t('wizard.action.skip')
    case 'cancel':
      return t('wizard.action.cancel')
    case 'edit-config':
      return t('wizard.action.editConfig')
    default:
      return action.kind
  }
}

interface StepDetailPanelProps {
  active: WizardStepSnapshot | null
  readOnly: WizardStepSnapshot | null
  activeChoice: WizardChoiceRequest | null
  onChoiceSelect: (value: string | null) => void
  onBackToCurrent: () => void
  ctx: WizardContext
  mappedError: WizardMappedError | null
}

function StepDetailPanel({
  active,
  readOnly,
  activeChoice,
  onChoiceSelect,
  onBackToCurrent,
  ctx,
  mappedError,
}: StepDetailPanelProps) {
  const { t } = useTranslation()
  const display = readOnly ?? active
  const isReadOnly = readOnly !== null
  const [showRawError, setShowRawError] = useState(false)

  // Reset reveal toggle whenever the displayed step changes so a fresh failure
  // re-applies its detailMode default.
  useEffect(() => {
    setShowRawError(false)
  }, [display?.id, display?.status])

  if (!display) {
    return (
      <div className="bat-wizard-detail bat-wizard-detail-empty">
        <p className="text-sm text-neutral-400">{t('wizard.noStep')}</p>
      </div>
    )
  }

  const label = display.labelKey ? t(display.labelKey) : display.title
  const description = display.descriptionKey ? t(display.descriptionKey) : undefined

  const showMappedError = !isReadOnly && mappedError && display.status === WizardStepStatus.Failed
  const detailMode = mappedError?.detailMode ?? 'append-raw'
  const rawVisible = detailMode === 'append-raw' || showRawError

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
          <p className="text-sm text-sky-300">{t('wizard.currentStep')}...</p>
        )}
        {showMappedError && mappedError && (
          <div className="bat-wizard-mapped-error mt-2" role="alert">
            <h4 className="text-sm font-semibold text-rose-200">{mappedError.title}</h4>
            {mappedError.body && (
              <p className="mt-1 text-sm text-rose-100">{mappedError.body}</p>
            )}
            {detailMode === 'hidden-by-default' && !showRawError && (
              <button
                type="button"
                className="mt-2 text-xs text-rose-300 underline"
                onClick={() => setShowRawError(true)}
              >
                {t('wizard.action.showDetails', 'Show details')}
              </button>
            )}
            {rawVisible && mappedError.rawError && (
              <pre className="bat-wizard-mapped-error-raw mt-2 whitespace-pre-wrap rounded border border-rose-900/60 bg-rose-950/40 p-2 text-xs text-rose-200">
                {mappedError.rawError}
              </pre>
            )}
          </div>
        )}
        {!showMappedError && display.status === WizardStepStatus.Failed && display.error && (
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
            {t('wizard.readonly.back')}
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

  // T0333: derive mappedError for the panel's active step (failed steps only).
  const activeMappedError = useMemo(
    () => resolveMappedErrorForSnapshot(activeStep, ctx.targetOS),
    [activeStep, ctx.targetOS],
  )

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

  // T0333: dispatch a single recovery action against runner / shell.
  const dispatchAction = async (
    action: WizardRecoveryAction,
    failedIndex: number,
  ): Promise<void> => {
    const runner = runnerRef.current
    switch (action.kind) {
      case 'retry':
      case 'fixed-and-retry':
        await runner?.retryCurrentStep()
        return
      case 'skip':
        await runner?.skipCurrentStep()
        return
      case 'cancel':
        await runner?.cancel()
        return
      case 'open-link':
        try {
          window.electronAPI?.shell?.openExternal?.(action.href)
        } catch (err) {
          console.warn('[SetupWizardShell] open-link failed:', err)
        }
        return
      case 'edit-config': {
        let targetIndex: number | null = null
        if (action.targetStepId) {
          const idx = stepStates.findIndex((s) => s.id === action.targetStepId)
          if (idx >= 0) targetIndex = idx
        }
        if (targetIndex === null) {
          targetIndex = findEditableTarget(failedIndex)
        }
        if (targetIndex !== null) {
          await runner?.jumpToStep(targetIndex)
        }
        return
      }
      case 'custom':
        try {
          await action.run()
        } catch (err) {
          console.warn('[SetupWizardShell] custom action failed:', err)
        }
        return
    }
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
              if (!snap) return null
              const mapped = resolveMappedErrorForSnapshot(snap, ctx.targetOS)
              const editableTarget = findEditableTarget(index)
              const baseActions: WizardRecoveryAction[] = mapped
                ? [...mapped.actions]
                : [{ kind: 'retry' }, { kind: 'skip' }, { kind: 'cancel' }]

              // T0333: preserve legacy "Edit settings" affordance when an
              // editable predecessor exists and the registry didn't already
              // emit an edit-config action. Insert before cancel (or append).
              if (
                editableTarget !== null &&
                snap.editableFromFailure === false &&
                !baseActions.some((a) => a.kind === 'edit-config')
              ) {
                const cancelIdx = baseActions.findIndex((a) => a.kind === 'cancel')
                const editAction: WizardRecoveryAction = { kind: 'edit-config' }
                if (cancelIdx >= 0) {
                  baseActions.splice(cancelIdx, 0, editAction)
                } else {
                  baseActions.push(editAction)
                }
              }

              return (
                <div className="bat-stepper-failed-actions flex flex-wrap gap-2">
                  {baseActions.map((action, i) => {
                    const disabled =
                      snap.retryable === false &&
                      (action.kind === 'retry' ||
                        action.kind === 'fixed-and-retry' ||
                        action.kind === 'skip')
                    if (disabled) return null
                    const tone =
                      action.kind === 'cancel'
                        ? 'border-rose-700 text-rose-100 hover:bg-rose-950'
                        : action.kind === 'edit-config'
                        ? 'border-amber-700 text-amber-100 hover:bg-amber-950'
                        : action.kind === 'open-link'
                        ? 'border-sky-700 text-sky-100 hover:bg-sky-950'
                        : 'border-neutral-700 text-neutral-100 hover:bg-neutral-800'
                    return (
                      <button
                        key={`${action.kind}-${i}`}
                        className={`rounded-md border px-2 py-1 text-xs transition ${tone}`}
                        onClick={() => void dispatchAction(action, index)}
                        type="button"
                        data-action-kind={action.kind}
                      >
                        {defaultActionLabel(action, t)}
                      </button>
                    )
                  })}
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
            mappedError={activeMappedError}
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