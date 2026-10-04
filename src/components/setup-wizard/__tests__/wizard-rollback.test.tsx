/**
 * T0378 (BUG-087 C): a retryable failure must not roll back earlier,
 * already-succeeded steps; rollback only happens when the wizard is
 * cancelled. Root cause of the field bug: useSetupWizardController returned a
 * fresh `steps` array on every host re-render, which re-ran SetupWizardShell's
 * runner effect -> runner.cancel() -> rollback (install-server-bundle's
 * `rm -rf` of the bundle) while a new runner restarted the wizard.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, renderHook, waitFor } from '@testing-library/react'
import '../../../i18n'
import { SetupWizardShell, useWslWizardController } from '../SetupWizardShell'
import { WizardRunner, WizardStepStatus, type WizardContext, type WizardStep } from '../wizard-runner'

function makeCtx(): WizardContext {
  return {
    targetOS: 'wsl-linux',
    profileDraft: { name: 'rollback' },
    warnings: [],
    state: {},
    logger: { info: () => undefined, warn: () => undefined, error: () => undefined },
  }
}

function makeSteps() {
  const installRollback = vi.fn(async () => undefined)
  const installRun = vi.fn(async () => undefined)
  let failNext = true
  const unitRun = vi.fn(async () => {
    if (failNext) {
      failNext = false
      throw new Error('Could not enable linger: No such device or address')
    }
  })
  const steps: WizardStep[] = [
    {
      id: 'install-server-bundle',
      title: 'install',
      appliesTo: 'all',
      retryable: true,
      run: installRun,
      rollback: installRollback,
    },
    {
      id: 'write-systemd-unit',
      title: 'unit',
      appliesTo: 'all',
      retryable: true,
      run: unitRun,
    },
  ]
  return { steps, installRun, installRollback, unitRun }
}

function waitForStatus(runner: WizardRunner, index: number, status: WizardStepStatus): Promise<void> {
  return new Promise((resolve) => {
    const tick = () => (runner.getSnapshots()[index].status === status ? resolve() : setTimeout(tick, 5))
    tick()
  })
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('WizardRunner rollback policy (T0378 / BUG-087 C)', () => {
  it('a retryable failure keeps earlier steps intact; retry resumes at the failed step', async () => {
    const { steps, installRun, installRollback, unitRun } = makeSteps()
    const runner = new WizardRunner(steps, makeCtx())
    const runPromise = runner.run()

    await waitForStatus(runner, 1, WizardStepStatus.Failed)
    expect(installRollback).not.toHaveBeenCalled()
    expect(runner.getSnapshots()[0].status).toBe(WizardStepStatus.Succeeded)

    await runner.retryCurrentStep()
    await runPromise

    expect(installRun).toHaveBeenCalledTimes(1)
    expect(unitRun).toHaveBeenCalledTimes(2)
    expect(installRollback).not.toHaveBeenCalled()
    expect(runner.getSnapshots().map((s) => s.status)).toEqual([
      WizardStepStatus.Succeeded,
      WizardStepStatus.Succeeded,
    ])
  })

  it('cancelling the wizard rolls the completed steps back and marks them rolled-back', async () => {
    const { steps, installRollback } = makeSteps()
    const runner = new WizardRunner(steps, makeCtx())
    const runPromise = runner.run().catch((error: Error) => error)

    await waitForStatus(runner, 1, WizardStepStatus.Failed)
    await runner.cancel()
    const error = await runPromise

    expect((error as Error).message).toBe('Wizard cancelled')
    expect(installRollback).toHaveBeenCalledTimes(1)
    expect(runner.getSnapshots()[0].status).toBe(WizardStepStatus.RolledBack)
  })
})

describe('wizard controller / shell lifecycle (T0378 / BUG-087 C)', () => {
  it('useWslWizardController returns the same steps array across re-renders', () => {
    const { result, rerender } = renderHook(() => useWslWizardController(() => undefined))
    const first = result.current.steps
    rerender()
    rerender()
    expect(result.current.steps).toBe(first)
  })

  it('a host re-render does not cancel the live runner nor roll back completed steps', async () => {
    const { steps, installRun, installRollback, unitRun } = makeSteps()
    const ctx = makeCtx()
    const view = render(<SetupWizardShell steps={steps} ctx={ctx} onComplete={() => undefined} />)
    await waitFor(() => expect(unitRun).toHaveBeenCalledTimes(1))

    // Host re-renders (new callback identity, same ctx + stable steps).
    view.rerender(<SetupWizardShell steps={steps} ctx={ctx} onComplete={() => undefined} />)
    view.rerender(<SetupWizardShell steps={steps} ctx={ctx} onComplete={() => undefined} />)
    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(installRun).toHaveBeenCalledTimes(1)
    expect(installRollback).not.toHaveBeenCalled()
    view.unmount()
  })

  it('closing the wizard (unmount) is a cancel and does roll back', async () => {
    const { steps, installRollback, unitRun } = makeSteps()
    const view = render(<SetupWizardShell steps={steps} ctx={makeCtx()} />)
    await waitFor(() => expect(unitRun).toHaveBeenCalledTimes(1))
    view.unmount()
    await waitFor(() => expect(installRollback).toHaveBeenCalledTimes(1))
  })
})
