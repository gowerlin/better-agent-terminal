import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import {
  WIZARD_CANCELLED_MESSAGE,
  WizardRunner,
  WizardStepStatus,
  type WizardChoiceRequest,
  type WizardConsentRequest,
  type WizardContext,
  type WizardStep,
  type WizardStepSnapshot,
  type WizardTargetOS,
  type WizardTextRequest,
} from './wizard-runner'
import { buildDockerWizardSteps, createDockerWizardContext } from './docker-flow'
import { buildSshWizardSteps, createSshWizardContext } from './ssh-flow'
import { buildWslWizardSteps, createWslWizardContext } from './wsl-flow'
import {
  DEFAULT_WIZARD_ERROR_REGISTRY,
  readWizardErrorParams,
  resolveWizardError,
  targetOSToErrorPlatform,
  type WizardMappedError,
  type WizardRecoveryAction,
} from './error-mapper'
import { importServerBundleForRetry } from './server-bundle-import'
import { WizardConsentChecklist, WslAppliedChangesBox } from './WizardConsentChecklist'
import { requestWslMirroredRetry } from './steps/wsl/connect-test'
import { readWslAppliedChanges } from './steps/wsl/apply-wsl-environment'
import { Stepper } from '../stepper/Stepper'
import { RemoteToolsEntry } from '../profiles/RemoteToolsEntry'
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

  // T0413 (PLAN-037 F): keep the wizard open on success so the completion block
  // (remote AI tools check) stays visible; the user closes it from the header.
  const handleComplete = (profileId: string) => {
    onComplete(profileId)
  }

  // T0378 (BUG-087 C): `steps` MUST keep a stable identity. SetupWizardShell's
  // runner effect depends on it, so a fresh array on every host re-render used
  // to cancel the live runner (-> rollback of completed steps, e.g. the
  // installed server bundle being rm -rf'd) and silently restart the wizard.
  const steps = useMemo(() => resolveWizardSteps(targetOS), [targetOS])

  return {
    isOpen,
    key: instanceKey,
    steps,
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
      // T0660 (BUG-161): a mapped error shows its translated title; the raw
      // (English) message stays for unmapped errors and in the detail panel.
      errorMessage: s.mappedError?.matchId ? s.mappedError.title : s.error,
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
  // T0830: a step the user aborted is not an error to recover from.
  if (snap.aborted) return null
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
 * T0507: registry entries name their labels by i18n key (`labelKey`), so the
 * buttons follow the UI language.
 */
function defaultActionLabel(
  action: WizardRecoveryAction,
  t: TFunction,
): string {
  if (action.labelKey) return t(action.labelKey, action.label ?? action.kind)
  if (action.label) return action.label
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
    case 'import-server-bundle':
      return t('wizard.action.importServerBundle')
    case 'wsl-mirrored-retry':
      return t('wizard.action.wslMirroredRetry')
    default:
      return action.kind
  }
}

/** T0547: result line of a recovery action that runs outside the runner (bundle import). */
interface ActionNotice {
  tone: 'info' | 'success' | 'error'
  text: string
}

interface StepDetailPanelProps {
  active: WizardStepSnapshot | null
  readOnly: WizardStepSnapshot | null
  activeChoice: WizardChoiceRequest | null
  onChoiceSelect: (value: string | null) => void
  activeText: WizardTextRequest | null
  onTextSubmit: (value: string | null) => void
  activeConsent: WizardConsentRequest | null
  onConsentSubmit: (checkedIds: string[]) => void
  onBackToCurrent: () => void
  ctx: WizardContext
  mappedError: WizardMappedError | null
  actionNotice: ActionNotice | null
}

function StepDetailPanel({
  active,
  readOnly,
  activeChoice,
  onChoiceSelect,
  activeText,
  onTextSubmit,
  activeConsent,
  onConsentSubmit,
  onBackToCurrent,
  ctx,
  mappedError,
  actionNotice,
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
        <p>{t('wizard.noStep')}</p>
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
        <div className="bat-wizard-detail-kicker">
          {isReadOnly ? t('wizard.readonly.viewing') : t('wizard.currentStep')}
        </div>
        <h3 className="bat-wizard-detail-title">{label}</h3>
        {description && <p className="bat-wizard-detail-description">{description}</p>}
      </header>

      <div className="bat-wizard-detail-body">
        {display.status === WizardStepStatus.Running && !display.aborting && (
          <p className="bat-wizard-running">{t('wizard.running')}</p>
        )}
        {!isReadOnly && display.aborting && (
          <p className="bat-wizard-running" role="status" data-testid="wizard-aborting">{t('wizard.abort.aborting')}</p>
        )}
        {/* T0840: the step waits on something an abort cannot stop (wsl --set-version). */}
        {!isReadOnly && display.uninterruptibleKey && (
          <p className="bat-wizard-running" data-testid="wizard-uninterruptible">{t(display.uninterruptibleKey)}</p>
        )}
        {!isReadOnly && display.aborting && display.abortSlow && (
          <p className="bat-wizard-running" data-testid="wizard-abort-slow">{t('wizard.abort.slow')}</p>
        )}
        {showMappedError && mappedError && (
          <div className="bat-wizard-mapped-error" role="alert">
            <h4 className="bat-wizard-mapped-error-title">{mappedError.title}</h4>
            {mappedError.body && (
              <p className="bat-wizard-mapped-error-body">{mappedError.body}</p>
            )}
            {detailMode === 'hidden-by-default' && !showRawError && (
              <button
                type="button"
                className="bat-wizard-link-btn"
                onClick={() => setShowRawError(true)}
              >
                {t('wizard.action.showDetails', 'Show details')}
              </button>
            )}
            {rawVisible && mappedError.rawError && (
              <pre className="bat-wizard-mapped-error-raw">
                {mappedError.rawError}
              </pre>
            )}
          </div>
        )}
        {!isReadOnly && actionNotice && (
          <p
            className="bat-wizard-action-notice"
            role={actionNotice.tone === 'error' ? 'alert' : 'status'}
            data-tone={actionNotice.tone}
          >
            {actionNotice.text}
          </p>
        )}
        {!showMappedError && display.status === WizardStepStatus.Failed && display.error && (
          <p className="bat-wizard-error-text" role="alert">
            {display.aborted ? t('wizard.abort.stepAborted') : display.error}
          </p>
        )}
        {display.skipped && (
          <p className="bat-wizard-skipped-note">{t('wizard.skippedNote')}</p>
        )}
      </div>

      {!isReadOnly && activeChoice && (
        <div
          id={PROMPT_REGION_ID}
          className="bat-wizard-prompt"
          role="group"
          aria-label={activeChoice.title}
        >
          <h4 className="bat-wizard-prompt-title">{activeChoice.title}</h4>
          {activeChoice.description && (
            <p className="bat-wizard-prompt-description">{activeChoice.description}</p>
          )}
          <div className="bat-wizard-actions">
            {activeChoice.options.map((option) => {
              // T0851: a disabled option is shown with its reason but cannot be picked.
              const disabledReason = option.disabled && option.disabledReasonKey
                ? t(option.disabledReasonKey, option.disabledReasonParams ?? {})
                : ''
              const describedBy = [
                option.description ? `${PROMPT_REGION_ID}-option-${option.value}` : '',
                disabledReason ? `${PROMPT_REGION_ID}-option-${option.value}-disabled` : '',
              ].filter(Boolean).join(' ')
              const button = (
                <button
                  key={option.value}
                  className="profile-action-btn bat-wizard-choice"
                  onClick={() => { if (!option.disabled) onChoiceSelect(option.value) }}
                  type="button"
                  disabled={option.disabled || undefined}
                  style={option.disabled ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
                  aria-describedby={describedBy || undefined}
                >
                  {option.labelKey ? t(option.labelKey, option.label) : option.label}
                </button>
              )
              if (!option.description && !disabledReason) return button
              // T0660 (BUG-161): the option description sits under its button,
              // outside it, so the button's accessible name stays the label.
              return (
                <div
                  key={option.value}
                  className="bat-wizard-choice-item"
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', maxWidth: 280 }}
                >
                  {button}
                  {option.description && (
                    <p
                      id={`${PROMPT_REGION_ID}-option-${option.value}`}
                      className="bat-wizard-prompt-description"
                    >
                      {option.description}
                    </p>
                  )}
                  {disabledReason && (
                    <p
                      id={`${PROMPT_REGION_ID}-option-${option.value}-disabled`}
                      className="bat-wizard-prompt-description bat-wizard-choice-disabled-reason"
                    >
                      {disabledReason}
                    </p>
                  )}
                </div>
              )
            })}
            {activeChoice.allowSkip && (
              <button
                className="profile-action-btn bat-wizard-choice"
                onClick={() => onChoiceSelect(null)}
                type="button"
              >
                {t('wizard.action.skipChoice')}
              </button>
            )}
          </div>
        </div>
      )}

      {!isReadOnly && activeText && (
        <TextPrompt key={activeText.stepId} request={activeText} onSubmit={onTextSubmit} />
      )}

      {!isReadOnly && activeConsent && (
        <WizardConsentChecklist
          key={activeConsent.stepId}
          request={activeConsent}
          regionId={PROMPT_REGION_ID}
          onSubmit={onConsentSubmit}
        />
      )}

      {isReadOnly && (
        <div className="bat-wizard-actions">
          <button
            className="profile-action-btn"
            onClick={onBackToCurrent}
            type="button"
          >
            {t('wizard.readonly.back')}
          </button>
        </div>
      )}

      {ctx.warnings.length > 0 && (
        <div className="bat-wizard-box bat-wizard-warnings">
          <div className="bat-wizard-box-header">
            {t('wizard.warningHeader')}
          </div>
          {ctx.warnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </div>
      )}
    </div>
  )
}

interface TextPromptProps {
  request: WizardTextRequest
  onSubmit: (value: string | null) => void
}

/** T0502: free-text prompt for ctx.requestText; blocks submit while `validate` fails. */
function TextPrompt({ request, onSubmit }: TextPromptProps) {
  const { t } = useTranslation()
  const [value, setValue] = useState(request.initialValue ?? '')
  const [errorKey, setErrorKey] = useState<string | null>(null)
  const title = request.titleKey ? t(request.titleKey, request.title) : request.title
  const description = request.descriptionKey
    ? t(request.descriptionKey, request.description ?? '')
    : request.description
  const inputId = `${PROMPT_REGION_ID}-text`
  const errorId = `${inputId}-error`

  const submit = () => {
    const trimmed = value.trim()
    const invalid = request.validate?.(trimmed) ?? null
    setErrorKey(invalid)
    if (!invalid) onSubmit(trimmed)
  }

  return (
    <form
      id={PROMPT_REGION_ID}
      className="bat-wizard-prompt"
      aria-label={title}
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
    >
      <label htmlFor={inputId} className="bat-wizard-prompt-title">{title}</label>
      {description && <p className="bat-wizard-prompt-description">{description}</p>}
      <input
        id={inputId}
        className="profile-name-input bat-wizard-text-input"
        value={value}
        placeholder={request.placeholder}
        onChange={(event) => {
          setValue(event.target.value)
          setErrorKey(null)
        }}
        aria-invalid={errorKey !== null}
        aria-describedby={errorKey ? errorId : undefined}
        autoFocus
        spellCheck={false}
        autoComplete="off"
      />
      {errorKey && (
        <p id={errorId} className="bat-wizard-field-error" role="alert">{t(errorKey)}</p>
      )}
      <div className="bat-wizard-actions">
        <button
          className="profile-action-btn primary"
          type="submit"
        >
          {t('wizard.action.submitText')}
        </button>
        <button
          className="profile-action-btn"
          onClick={() => onSubmit(null)}
          type="button"
        >
          {t('wizard.action.cancelText')}
        </button>
      </div>
    </form>
  )
}

interface WizardErrorNotice {
  title: string | null
  text: string
}

/**
 * T0660 (BUG-161): what the error box shows when run() rejects — a cancel, or
 * a failure the runner does not wait on (non-retryable step). A coded step
 * error shows its translated title / body; anything else its raw message.
 */
function describeWizardError(error: unknown, targetOS: WizardTargetOS, t: TFunction): WizardErrorNotice {
  const errorObj = error instanceof Error ? error : new Error(String(error))
  if (errorObj.message === WIZARD_CANCELLED_MESSAGE) return { title: null, text: t('wizard.cancelled') }
  const code = (errorObj as Error & { code?: unknown }).code
  if (typeof code !== 'string') return { title: null, text: errorObj.message }
  const mapped = resolveWizardError(
    {
      platform: targetOSToErrorPlatform(targetOS),
      stepId: '',
      errorCode: code,
      params: readWizardErrorParams(errorObj),
      error: errorObj,
    },
    DEFAULT_WIZARD_ERROR_REGISTRY,
  )
  return mapped.matchId ? { title: mapped.title, text: mapped.body } : { title: null, text: errorObj.message }
}

export function SetupWizardShell({ steps, ctx, onComplete }: SetupWizardShellProps) {
  const { t } = useTranslation()
  const [stepStates, setStepStates] = useState<WizardStepSnapshot[]>([])
  const [activeChoice, setActiveChoice] = useState<WizardChoiceRequest | null>(null)
  const [activeText, setActiveText] = useState<WizardTextRequest | null>(null)
  const [activeConsent, setActiveConsent] = useState<WizardConsentRequest | null>(null)
  // T0660: the rejection itself; describeWizardError renders it in the UI language.
  const [wizardFailure, setWizardFailure] = useState<{ error: unknown } | null>(null)
  const [complete, setComplete] = useState(false)
  const [createdProfileId, setCreatedProfileId] = useState<string | null>(null)
  const [readOnlyStepId, setReadOnlyStepId] = useState<string | null>(null)
  const [actionNotice, setActionNotice] = useState<ActionNotice | null>(null)
  const importBusyRef = useRef(false)
  const choiceResolverRef = useRef<((value: string | null) => void) | null>(null)
  const textResolverRef = useRef<((value: string | null) => void) | null>(null)
  const consentResolverRef = useRef<((value: string[] | null) => void) | null>(null)
  const runnerRef = useRef<WizardRunner | null>(null)

  useEffect(() => {
    const runnerCtx: WizardContext = {
      ...ctx,
      requestChoice: (request) => new Promise<string | null>((resolve) => {
        choiceResolverRef.current = resolve
        setActiveChoice(request)
      }),
      // T0502: typed input (e.g. an SSH host that is not an alias).
      requestText: (request) => new Promise<string | null>((resolve) => {
        textResolverRef.current = resolve
        setActiveText(request)
      }),
      // T0840 (PLAN-043 W3): the WSL environment checklist ("consent once").
      requestConsent: (request) => new Promise<string[] | null>((resolve) => {
        consentResolverRef.current = resolve
        setActiveConsent(request)
      }),
    }

    // T0378 (BUG-087 C): once this effect is torn down the runner is cancelled
    // and rolls back; its snapshots must not overwrite a newer runner's UI.
    let disposed = false
    const runner = new WizardRunner(steps, runnerCtx, (snapshots) => {
      if (!disposed) setStepStates(snapshots)
    })
    runnerRef.current = runner
    void runner.run()
      .then(() => {
        if (disposed) return
        setComplete(true)
        // T0552: an upgrade updates the existing profile instead of creating one.
        const resultProfileId = runnerCtx.createdProfileId ?? runnerCtx.updatedProfileId
        if (resultProfileId) {
          setCreatedProfileId(resultProfileId)
          onComplete?.(resultProfileId)
        }
      })
      .catch((error) => {
        if (!disposed) setWizardFailure({ error })
      })

    return () => {
      disposed = true
      void runner.cancel()
      runnerRef.current = null
    }
  }, [ctx, steps])

  const wizardError = wizardFailure ? describeWizardError(wizardFailure.error, ctx.targetOS, t) : null

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

  // T0547: an action notice belongs to the step it was run on.
  const activeStepId = activeStep?.id
  useEffect(() => {
    setActionNotice(null)
  }, [activeStepId])

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

  const handleTextSubmit = (value: string | null) => {
    textResolverRef.current?.(value)
    textResolverRef.current = null
    setActiveText(null)
  }

  const handleConsentSubmit = (checkedIds: string[]) => {
    consentResolverRef.current?.(checkedIds)
    consentResolverRef.current = null
    setActiveConsent(null)
  }

  // T0830 (PLAN-043): stop the running (or waiting) step; the runner aborts it,
  // waits for it to settle, rolls back and run() rejects with "cancelled".
  const abortableStep = stepStates.find(
    (s) => s.status === WizardStepStatus.Running || s.status === WizardStepStatus.AwaitingInput,
  ) ?? null
  const handleAbort = () => {
    choiceResolverRef.current = null
    textResolverRef.current = null
    consentResolverRef.current = null
    setActiveChoice(null)
    setActiveText(null)
    setActiveConsent(null)
    void runnerRef.current?.cancel()
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
    setActionNotice(null)
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
      // T0841 (PLAN-043 W4, P-5): connect-test reads the request on its next
      // run and asks for consent before changing anything (`.wslconfig`,
      // `wsl --shutdown`); declining just fails the step again.
      case 'wsl-mirrored-retry':
        requestWslMirroredRetry(ctx.state)
        await runner?.retryCurrentStep()
        return
      // T0547 (D146): offline / intranet — import a local tarball, then retry the
      // step (the distributor finds it in the cache, verified by its sidecar).
      case 'import-server-bundle': {
        if (importBusyRef.current) return
        importBusyRef.current = true
        setActionNotice({ tone: 'info', text: t('wizard.shared.bundleImport.importing') })
        try {
          const outcome = await importServerBundleForRetry(ctx.state, t)
          if (outcome.status === 'cancelled') {
            setActionNotice(null)
            return
          }
          setActionNotice({ tone: outcome.status === 'imported' ? 'success' : 'error', text: outcome.message })
          if (outcome.status === 'imported') await runner?.retryCurrentStep()
        } finally {
          importBusyRef.current = false
        }
        return
      }
    }
  }

  return (
    <section className="bat-wizard-shell">
      <header className="bat-wizard-header">
        <div>
          <h2 className="bat-wizard-title">{t(`wizard.title.${ctx.targetOS}`, ctx.targetOS)}</h2>
          <p className="bat-wizard-progress-text">
            {t('wizard.progress.label', { completed: completedCount, total })} ({progressPercent}%)
          </p>
        </div>
        <div className="bat-wizard-progress-track">
          <div
            className="bat-wizard-progress-fill"
            style={{ width: `${progressPercent}%` }}
            role="progressbar"
            aria-valuenow={progressPercent}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>
      </header>

      <div className="bat-wizard-grid">
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
              // T0830: an aborted step has no retry / skip / cancel (the run is over).
              if (!snap || snap.aborted) return null
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
                <div className="bat-stepper-failed-actions">
                  {baseActions.map((action, i) => {
                    const disabled =
                      snap.retryable === false &&
                      (action.kind === 'retry' ||
                        action.kind === 'fixed-and-retry' ||
                        action.kind === 'skip')
                    if (disabled) return null
                    const tone = action.kind === 'cancel' ? ' danger' : ''
                    return (
                      <button
                        key={`${action.kind}-${i}`}
                        className={`profile-action-btn bat-wizard-action-btn${tone}`}
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
            activeText={activeText}
            onTextSubmit={handleTextSubmit}
            activeConsent={activeConsent}
            onConsentSubmit={handleConsentSubmit}
            onBackToCurrent={handleBackToCurrent}
            ctx={ctx}
            mappedError={activeMappedError}
            actionNotice={actionNotice}
          />
        </div>
      </div>

      {abortableStep && !wizardError && !complete && (
        <div className="bat-wizard-actions bat-wizard-abort-bar">
          <button
            type="button"
            className="profile-action-btn bat-wizard-action-btn danger"
            data-testid="wizard-abort"
            disabled={abortableStep.aborting === true}
            onClick={handleAbort}
          >
            {abortableStep.aborting ? t('wizard.abort.aborting') : t('wizard.abort.button')}
          </button>
        </div>
      )}

      {wizardError && (
        <div className="bat-wizard-box bat-wizard-error-box">
          <div className="bat-wizard-box-header">
            {t('wizard.errorHeader')}
          </div>
          {wizardError.title && <p className="bat-wizard-mapped-error-title">{wizardError.title}</p>}
          <p>{wizardError.text}</p>
        </div>
      )}

      {complete && !wizardError && (
        <div className="bat-wizard-box bat-wizard-complete">
          {t('wizard.progress.complete')}
        </div>
      )}

      {/* T0840 (D272): WSL environment fixes are kept on done / cancel; list them with the backups. */}
      {(complete || wizardError) && <WslAppliedChangesBox changes={readWslAppliedChanges(ctx.state)} />}

      {/* T0413 (PLAN-037 F): remote AI toolchain check for the profile just created. */}
      {complete && !wizardError && createdProfileId && (
        <div className="bat-wizard-remote-tools" style={{ flexShrink: 0, maxHeight: '45vh', overflowY: 'auto' }}>
          <RemoteToolsEntry profileId={createdProfileId} host="wizard" />
        </div>
      )}
    </section>
  )
}