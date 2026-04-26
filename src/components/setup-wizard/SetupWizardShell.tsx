import { useEffect, useRef, useState } from 'react'
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

interface SetupWizardShellProps {
  steps: WizardStep[]
  ctx: WizardContext
  onComplete?: (profileId: string) => void
}

function statusIcon(step: WizardStepSnapshot): string {
  if (step.skipped) return '⏭'
  switch (step.status) {
    case WizardStepStatus.Pending:
      return '⏳'
    case WizardStepStatus.Running:
      return '🔄'
    case WizardStepStatus.Succeeded:
      return '✅'
    case WizardStepStatus.Failed:
      return '❌'
    case WizardStepStatus.RolledBack:
      return '↩'
    default:
      return '⏳'
  }
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

export function SetupWizardShell({ steps, ctx, onComplete }: SetupWizardShellProps) {
  const [stepStates, setStepStates] = useState<WizardStepSnapshot[]>([])
  const [activeChoice, setActiveChoice] = useState<WizardChoiceRequest | null>(null)
  const [wizardError, setWizardError] = useState<string | null>(null)
  const [complete, setComplete] = useState(false)
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

  const completedCount = stepStates.filter((step) => step.status === WizardStepStatus.Succeeded || step.skipped).length
  const progressPercent = stepStates.length === 0 ? 0 : Math.round((completedCount / stepStates.length) * 100)
  const currentFailedStep = stepStates.find((step) => step.status === WizardStepStatus.Failed)

  return (
    <section className="rounded-xl border border-neutral-800 bg-neutral-950 p-5 text-neutral-100 shadow-lg">
      <header className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Setup Wizard</h2>
          <p className="text-sm text-neutral-400">{progressPercent}% complete</p>
        </div>
        <div className="h-2 w-40 overflow-hidden rounded-full bg-neutral-800">
          <div className="h-full bg-emerald-500 transition-all" style={{ width: `${progressPercent}%` }} />
        </div>
      </header>

      <ol className="space-y-3">
        {stepStates.map((step) => (
          <li
            key={step.id}
            className="flex items-start justify-between gap-3 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2"
          >
            <div className="flex items-start gap-3">
              <span className="text-lg leading-none">{statusIcon(step)}</span>
              <div>
                <div className="font-medium text-neutral-100">{step.title}</div>
                <div className="text-xs uppercase tracking-wide text-neutral-500">{step.id}</div>
                {step.error && <div className="mt-1 text-sm text-rose-300">{step.error}</div>}
                {step.skipped && <div className="mt-1 text-sm text-amber-300">Skipped by user</div>}
              </div>
            </div>
            <span className="rounded-full bg-neutral-800 px-2 py-1 text-xs text-neutral-300">{step.status}</span>
          </li>
        ))}
      </ol>

      {activeChoice && (
        <div className="mt-4 rounded-lg border border-sky-700 bg-sky-950/40 p-4">
          <h3 className="font-medium text-sky-100">{activeChoice.title}</h3>
          {activeChoice.description && <p className="mt-1 text-sm text-sky-200">{activeChoice.description}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            {activeChoice.options.map((option) => (
              <button
                key={option.value}
                className="rounded-md border border-sky-600 px-3 py-2 text-sm text-sky-100 transition hover:bg-sky-900"
                onClick={() => {
                  choiceResolverRef.current?.(option.value)
                  choiceResolverRef.current = null
                  setActiveChoice(null)
                }}
                type="button"
              >
                {option.label}
              </button>
            ))}
            {activeChoice.allowSkip && (
              <button
                className="rounded-md border border-neutral-700 px-3 py-2 text-sm text-neutral-200 transition hover:bg-neutral-800"
                onClick={() => {
                  choiceResolverRef.current?.(null)
                  choiceResolverRef.current = null
                  setActiveChoice(null)
                }}
                type="button"
              >
                Skip
              </button>
            )}
          </div>
        </div>
      )}

      {ctx.warnings.length > 0 && (
        <div className="mt-4 rounded-lg border border-amber-700 bg-amber-950/30 p-4 text-sm text-amber-200">
          {ctx.warnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </div>
      )}

      {wizardError && (
        <div className="mt-4 rounded-lg border border-rose-700 bg-rose-950/30 p-4 text-sm text-rose-200">
          {wizardError}
        </div>
      )}

      {complete && !wizardError && (
        <div className="mt-4 rounded-lg border border-emerald-700 bg-emerald-950/30 p-4 text-sm text-emerald-200">
          Wizard complete.
        </div>
      )}

      <div className="mt-4 flex gap-2">
        <button
          className="rounded-md border border-neutral-700 px-3 py-2 text-sm text-neutral-100 transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!currentFailedStep?.retryable}
          onClick={() => void runnerRef.current?.retryCurrentStep()}
          type="button"
        >
          Retry
        </button>
        <button
          className="rounded-md border border-neutral-700 px-3 py-2 text-sm text-neutral-100 transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!currentFailedStep}
          onClick={() => void runnerRef.current?.skipCurrentStep()}
          type="button"
        >
          Skip
        </button>
        <button
          className="rounded-md border border-rose-700 px-3 py-2 text-sm text-rose-100 transition hover:bg-rose-950"
          onClick={() => void runnerRef.current?.cancel()}
          type="button"
        >
          Cancel
        </button>
      </div>
    </section>
  )
}
