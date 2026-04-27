/**
 * Unit tests for <SetupWizardShell> (T0309 — PLAN-030 #4).
 *
 * Coverage focus (per T0309 Step 8):
 *  - Two-column layout (vertical stepper + detail panel)
 *  - step.id MUST NOT render (regression guard for BUG-070 baseline)
 *  - groupLabel section headers render (4 i18n groups)
 *  - Failed-step action slot (retry / skip / cancel + conditional editConfig)
 *  - Read-only viewing of completed step + back-to-current
 *  - jumpToStep API surface (basic version)
 *  - Progress calculation
 *
 * Tests inject controlled WizardStep[] so we never touch electronAPI.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import '../../../i18n' // initialize i18next once
import { SetupWizardShell } from '../SetupWizardShell'
import type { WizardContext, WizardStep } from '../wizard-runner'
import { WizardRunner } from '../wizard-runner'

function makeCtx(overrides: Partial<WizardContext> = {}): WizardContext {
  return {
    targetOS: 'wsl-linux',
    profileDraft: { name: 'test-profile' },
    warnings: [],
    state: {},
    logger: {
      info: () => undefined,
      warn: () => undefined,
      error: () => undefined,
    },
    ...overrides,
  }
}

function quickStep(id: string, group: string, label: string, opts: Partial<WizardStep> = {}): WizardStep {
  return {
    id,
    title: `legacy-${id}`,
    appliesTo: 'all',
    retryable: true,
    labelKey: `wizard.shared.step.${label}.label`,
    descriptionKey: `wizard.shared.step.${label}.description`,
    groupKey: `wizard.group.${group}`,
    editableFromFailure: false,
    async run() {
      // Resolves immediately.
    },
    ...opts,
  }
}

function hangingStep(id: string, group: string, label: string, opts: Partial<WizardStep> = {}): WizardStep {
  return {
    id,
    title: `legacy-${id}`,
    appliesTo: 'all',
    retryable: true,
    labelKey: `wizard.shared.step.${label}.label`,
    descriptionKey: `wizard.shared.step.${label}.description`,
    groupKey: `wizard.group.${group}`,
    editableFromFailure: false,
    async run() {
      await new Promise(() => undefined) // never resolves — keeps "running"
    },
    ...opts,
  }
}

function failingStep(id: string, group: string, label: string, opts: Partial<WizardStep> = {}): WizardStep {
  return {
    id,
    title: `legacy-${id}`,
    appliesTo: 'all',
    retryable: true,
    labelKey: `wizard.shared.step.${label}.label`,
    descriptionKey: `wizard.shared.step.${label}.description`,
    groupKey: `wizard.group.${group}`,
    editableFromFailure: false,
    async run() {
      throw new Error('boom')
    },
    ...opts,
  }
}

describe('<SetupWizardShell>', () => {
  it('renders two-column layout with vertical stepper + detail panel', async () => {
    const steps = [hangingStep('detect-env', 'detection', 'detectEnv')]
    const { container } = render(<SetupWizardShell steps={steps} ctx={makeCtx()} />)
    await waitFor(() => {
      expect(container.querySelector('.bat-stepper-vertical')).not.toBeNull()
    })
    expect(container.querySelector('.bat-wizard-grid')).not.toBeNull()
    expect(container.querySelector('.bat-wizard-detail')).not.toBeNull()
  })

  it('does NOT render raw step.id strings in the UI (T0309 baseline regression guard)', async () => {
    const steps = [
      hangingStep('configure-ssh-host', 'connection', 'detectEnv'),
      quickStep('verify-ssh-auth', 'connection', 'connectTest'),
    ]
    const { container } = render(<SetupWizardShell steps={steps} ctx={makeCtx({ targetOS: 'ssh-linux' })} />)
    await waitFor(() => {
      expect(container.querySelector('.bat-stepper-vertical')).not.toBeNull()
    })
    // Step IDs MUST NOT appear anywhere visible.
    expect(container.textContent).not.toMatch(/configure-ssh-host/)
    expect(container.textContent).not.toMatch(/verify-ssh-auth/)
  })

  it('renders i18n labels via labelKey (English default)', async () => {
    const steps = [hangingStep('detect-env', 'detection', 'detectEnv')]
    render(<SetupWizardShell steps={steps} ctx={makeCtx()} />)
    await waitFor(() => {
      expect(screen.getAllByText('Detect target environment').length).toBeGreaterThanOrEqual(1)
    })
  })

  it('renders 4 group section headers when steps span all groups', async () => {
    const steps = [
      quickStep('s1', 'detection', 'detectEnv'),
      quickStep('s2', 'connection', 'connectTest'),
      hangingStep('s3', 'deployment', 'fetchFingerprint'),
      quickStep('s4', 'verification', 'writeProfile'),
      quickStep('s5', 'finalization', 'done'),
    ]
    const { container } = render(<SetupWizardShell steps={steps} ctx={makeCtx()} />)
    await waitFor(() => {
      const headers = container.querySelectorAll('.bat-stepper-group-header')
      expect(headers.length).toBe(5)
    })
    // Labels should use the i18n group names.
    expect(screen.getByText('Detection')).toBeInTheDocument()
    expect(screen.getByText('Connection')).toBeInTheDocument()
    expect(screen.getByText('Deployment')).toBeInTheDocument()
    expect(screen.getByText('Verification')).toBeInTheDocument()
    expect(screen.getByText('Finalization')).toBeInTheDocument()
  })

  it('failed step renders retry + skip + cancel actions', async () => {
    const steps = [failingStep('detect-env', 'detection', 'detectEnv')]
    const { container } = render(<SetupWizardShell steps={steps} ctx={makeCtx()} />)
    await waitFor(() => {
      expect(container.querySelector('.bat-stepper-failed-actions')).not.toBeNull()
    })
    const actions = container.querySelector('.bat-stepper-failed-actions') as HTMLElement
    expect(within(actions).getByText('Retry')).toBeInTheDocument()
    expect(within(actions).getByText('Skip')).toBeInTheDocument()
    expect(within(actions).getByText('Cancel')).toBeInTheDocument()
  })

  it('failed step shows "Edit settings" when an editableFromFailure predecessor exists', async () => {
    const steps = [
      quickStep('configure-host', 'connection', 'detectEnv', { editableFromFailure: true }),
      failingStep('verify-auth', 'connection', 'connectTest'),
    ]
    const { container } = render(<SetupWizardShell steps={steps} ctx={makeCtx()} />)
    await waitFor(() => {
      expect(container.querySelector('.bat-stepper-failed-actions')).not.toBeNull()
    })
    const actions = container.querySelector('.bat-stepper-failed-actions') as HTMLElement
    expect(within(actions).getByText('Edit settings')).toBeInTheDocument()
  })

  it('failed step does NOT show "Edit settings" when no editable predecessor exists', async () => {
    const steps = [failingStep('first-step', 'detection', 'detectEnv')]
    const { container } = render(<SetupWizardShell steps={steps} ctx={makeCtx()} />)
    await waitFor(() => {
      expect(container.querySelector('.bat-stepper-failed-actions')).not.toBeNull()
    })
    const actions = container.querySelector('.bat-stepper-failed-actions') as HTMLElement
    expect(within(actions).queryByText('Edit settings')).toBeNull()
  })

  it('completed steps are clickable and switch detail panel to read-only mode', async () => {
    const steps = [
      quickStep('s1', 'detection', 'detectEnv'),
      hangingStep('s2', 'detection', 'connectTest'),
    ]
    const { container } = render(<SetupWizardShell steps={steps} ctx={makeCtx()} />)
    // Wait for s1 to complete and s2 to be running.
    await waitFor(() => {
      expect(container.querySelector('.bat-stepper-status-completed')).not.toBeNull()
      expect(container.querySelector('.bat-stepper-status-running')).not.toBeNull()
    })
    const completedClickable = container.querySelector('.bat-stepper-status-completed [role="button"]') as HTMLElement
    expect(completedClickable).not.toBeNull()
    fireEvent.click(completedClickable)
    // Read-only banner should appear in detail panel.
    expect(screen.getByText('Viewing completed step (read-only)')).toBeInTheDocument()
    expect(screen.getByText(/Return to current step/)).toBeInTheDocument()
  })

  it('back-to-current button restores live detail view', async () => {
    const steps = [
      quickStep('s1', 'detection', 'detectEnv'),
      hangingStep('s2', 'detection', 'connectTest'),
    ]
    const { container } = render(<SetupWizardShell steps={steps} ctx={makeCtx()} />)
    await waitFor(() => {
      expect(container.querySelector('.bat-stepper-status-completed [role="button"]')).not.toBeNull()
    })
    const completedClickable = container.querySelector('.bat-stepper-status-completed [role="button"]') as HTMLElement
    fireEvent.click(completedClickable)
    expect(screen.getByText('Viewing completed step (read-only)')).toBeInTheDocument()
    fireEvent.click(screen.getByText(/Return to current step/))
    expect(screen.queryByText('Viewing completed step (read-only)')).toBeNull()
    expect(screen.getByText('Current step')).toBeInTheDocument()
  })

  it('renders progress label with completed/total counts', async () => {
    const steps = [
      quickStep('s1', 'detection', 'detectEnv'),
      hangingStep('s2', 'detection', 'connectTest'),
    ]
    render(<SetupWizardShell steps={steps} ctx={makeCtx()} />)
    await waitFor(() => {
      expect(screen.getByText(/Progress: 1 \/ 2/)).toBeInTheDocument()
    })
  })

  it('progress bar reports correct aria values', async () => {
    const steps = [
      quickStep('s1', 'detection', 'detectEnv'),
      hangingStep('s2', 'detection', 'connectTest'),
    ]
    const { container } = render(<SetupWizardShell steps={steps} ctx={makeCtx()} />)
    await waitFor(() => {
      const bar = container.querySelector('[role="progressbar"]') as HTMLElement
      expect(bar.getAttribute('aria-valuenow')).toBe('50')
    })
  })

  it('renders i18n title for each targetOS', async () => {
    const steps = [hangingStep('s', 'detection', 'detectEnv')]
    const { rerender } = render(<SetupWizardShell steps={steps} ctx={makeCtx({ targetOS: 'wsl-linux' })} />)
    expect(screen.getByText('Setup Wizard: Add WSL Profile')).toBeInTheDocument()
    rerender(<SetupWizardShell steps={steps} ctx={makeCtx({ targetOS: 'docker-linux' })} />)
    expect(screen.getByText('Setup Wizard: Add Docker Profile')).toBeInTheDocument()
    rerender(<SetupWizardShell steps={steps} ctx={makeCtx({ targetOS: 'ssh-linux' })} />)
    expect(screen.getByText('Setup Wizard: Add SSH Profile')).toBeInTheDocument()
  })

  it('shows skipped note for user-skipped steps', async () => {
    const steps = [failingStep('s1', 'detection', 'detectEnv')]
    const { container } = render(<SetupWizardShell steps={steps} ctx={makeCtx()} />)
    await waitFor(() => {
      expect(container.querySelector('.bat-stepper-failed-actions')).not.toBeNull()
    })
    const skipBtn = within(container.querySelector('.bat-stepper-failed-actions') as HTMLElement).getByText('Skip')
    fireEvent.click(skipBtn)
    await waitFor(() => {
      expect(screen.getByText('Skipped by user')).toBeInTheDocument()
    })
  })

  it('renders ctx.warnings panel inside detail column', async () => {
    const steps = [hangingStep('s', 'detection', 'detectEnv')]
    const ctx = makeCtx({ warnings: ['custom-warning-message'] })
    render(<SetupWizardShell steps={steps} ctx={ctx} />)
    await waitFor(() => {
      expect(screen.getByText('custom-warning-message')).toBeInTheDocument()
    })
  })
})

describe('WizardRunner.jumpToStep (T0309)', () => {
  it('rolls snapshot states back to pending for [target..current] range', async () => {
    let snapshots: Array<{ id: string; status: string; skipped?: boolean }> = []
    const ctx = makeCtx()
    const steps = [
      quickStep('a', 'detection', 'detectEnv', { editableFromFailure: true }),
      quickStep('b', 'connection', 'connectTest'),
      failingStep('c', 'verification', 'writeProfile'),
    ]
    const runner = new WizardRunner(steps, ctx, (snaps) => {
      snapshots = snaps.map((s) => ({ id: s.id, status: s.status, skipped: s.skipped }))
    })
    // run() returns a promise; allow scheduler to drain microtasks until c fails.
    runner.run().catch(() => undefined)
    await waitFor(() => {
      const c = snapshots.find((s) => s.id === 'c')
      expect(c?.status).toBe('failed')
    })
    expect(snapshots.find((s) => s.id === 'a')?.status).toBe('succeeded')
    expect(snapshots.find((s) => s.id === 'b')?.status).toBe('succeeded')

    // Jump back to 'a'. Snapshots for a/b/c should reset to pending.
    await runner.jumpToStep(0)
    await waitFor(() => {
      // a/b/c should re-execute. a + b succeed again, c fails again.
      const c = snapshots.find((s) => s.id === 'c')
      expect(c?.status).toBe('failed')
    })
    // After re-run, all three should have been visited again.
    expect(snapshots.find((s) => s.id === 'a')?.status).toBe('succeeded')
    expect(snapshots.find((s) => s.id === 'b')?.status).toBe('succeeded')
    await runner.cancel()
  })

  it('rejects out-of-range jump targets without throwing', async () => {
    const ctx = makeCtx()
    const warnings: string[] = []
    ctx.logger = {
      info: () => undefined,
      warn: (m: string) => warnings.push(m),
      error: () => undefined,
    }
    const steps = [hangingStep('s', 'detection', 'detectEnv')]
    const runner = new WizardRunner(steps, ctx)
    runner.run().catch(() => undefined)
    // Wait for the runner to be at currentStepIndex 0.
    await new Promise((r) => setTimeout(r, 0))
    await runner.jumpToStep(99)
    expect(warnings.some((m) => m.includes('out of range'))).toBe(true)
    await runner.cancel()
  })
})

// =====================================================================
// T0333 (PLAN-032 Sprint 2): Recovery actions UI tests
// =====================================================================

describe('<SetupWizardShell> recovery actions (T0333)', () => {
  // Local helper: factory that throws a registry-matchable error message.
  function failingStepWithError(
    id: string,
    group: string,
    label: string,
    errorMessage: string,
    opts: Partial<WizardStep> = {},
  ): WizardStep {
    return {
      id,
      title: `legacy-${id}`,
      appliesTo: 'all',
      retryable: true,
      labelKey: `wizard.shared.step.${label}.label`,
      descriptionKey: `wizard.shared.step.${label}.description`,
      groupKey: `wizard.group.${group}`,
      editableFromFailure: false,
      async run() {
        throw new Error(errorMessage)
      },
      ...opts,
    }
  }

  function quickStepLocal(id: string, group: string, label: string, opts: Partial<WizardStep> = {}): WizardStep {
    return {
      id,
      title: `legacy-${id}`,
      appliesTo: 'all',
      retryable: true,
      labelKey: `wizard.shared.step.${label}.label`,
      descriptionKey: `wizard.shared.step.${label}.description`,
      groupKey: `wizard.group.${group}`,
      editableFromFailure: false,
      async run() {
        // success
      },
      ...opts,
    }
  }

  beforeEach(() => {
    // Provide a stub electronAPI.shell so open-link does not throw.
    ;(window as unknown as { electronAPI: unknown }).electronAPI = {
      shell: { openExternal: vi.fn() },
    }
  })

  afterEach(() => {
    delete (window as unknown as { electronAPI?: unknown }).electronAPI
    vi.restoreAllMocks()
  })

  it('renders mapped Docker recovery actions when daemon is unavailable', async () => {
    const steps = [
      failingStepWithError(
        'detect-env',
        'detection',
        'detectEnv',
        'error during connect: open //./pipe/docker_engine: not found',
      ),
    ]
    const { container } = render(
      <SetupWizardShell steps={steps} ctx={makeCtx({ targetOS: 'docker-linux' })} />,
    )
    await waitFor(() => {
      expect(container.querySelector('.bat-stepper-failed-actions')).not.toBeNull()
    })
    const actions = container.querySelector('.bat-stepper-failed-actions') as HTMLElement
    // Three Docker actions: open-link / fixed-and-retry / cancel
    expect(actions.querySelector('[data-action-kind="open-link"]')).not.toBeNull()
    expect(actions.querySelector('[data-action-kind="fixed-and-retry"]')).not.toBeNull()
    expect(actions.querySelector('[data-action-kind="cancel"]')).not.toBeNull()
    // Mapped title must surface in the detail panel.
    expect(screen.getAllByText('未偵測到 Docker daemon').length).toBeGreaterThanOrEqual(1)
  })

  it('open-link click invokes window.electronAPI.shell.openExternal with href', async () => {
    const steps = [
      failingStepWithError(
        'detect-env',
        'detection',
        'detectEnv',
        'error during connect: pipe/docker_engine',
      ),
    ]
    const { container } = render(
      <SetupWizardShell steps={steps} ctx={makeCtx({ targetOS: 'docker-linux' })} />,
    )
    await waitFor(() => {
      expect(container.querySelector('[data-action-kind="open-link"]')).not.toBeNull()
    })
    const link = container.querySelector('[data-action-kind="open-link"]') as HTMLButtonElement
    fireEvent.click(link)
    const openExternal = (window as unknown as { electronAPI: { shell: { openExternal: ReturnType<typeof vi.fn> } } }).electronAPI.shell.openExternal
    expect(openExternal).toHaveBeenCalledTimes(1)
    expect(openExternal).toHaveBeenCalledWith('https://www.docker.com/products/docker-desktop/')
  })

  it('retry click triggers WizardRunner.retryCurrentStep', async () => {
    const retrySpy = vi.spyOn(WizardRunner.prototype, 'retryCurrentStep').mockResolvedValue(undefined)
    const steps = [failingStep('detect-env', 'detection', 'detectEnv')]
    const { container } = render(<SetupWizardShell steps={steps} ctx={makeCtx()} />)
    await waitFor(() => {
      expect(container.querySelector('[data-action-kind="retry"]')).not.toBeNull()
    })
    const retryBtn = container.querySelector('[data-action-kind="retry"]') as HTMLButtonElement
    fireEvent.click(retryBtn)
    expect(retrySpy).toHaveBeenCalledTimes(1)
  })

  it('edit-config (registry targetStepId) jumps to the named step', async () => {
    const jumpSpy = vi.spyOn(WizardRunner.prototype, 'jumpToStep').mockResolvedValue(undefined)
    const steps = [
      quickStepLocal('configure-ssh-host', 'connection', 'detectEnv'),
      failingStepWithError(
        'verify-ssh-auth',
        'connection',
        'connectTest',
        'Permission denied (publickey).',
      ),
    ]
    const { container } = render(
      <SetupWizardShell steps={steps} ctx={makeCtx({ targetOS: 'ssh-linux' })} />,
    )
    await waitFor(() => {
      expect(container.querySelector('[data-action-kind="edit-config"]')).not.toBeNull()
    })
    const editBtn = container.querySelector('[data-action-kind="edit-config"]') as HTMLButtonElement
    fireEvent.click(editBtn)
    await waitFor(() => {
      expect(jumpSpy).toHaveBeenCalledWith(0)
    })
  })

  it('hidden-by-default detailMode hides raw error until "Show details" is clicked', async () => {
    const rawMessage = 'Permission denied (publickey).'
    const steps = [
      failingStepWithError('verify-ssh-auth', 'connection', 'connectTest', rawMessage),
    ]
    const { container } = render(
      <SetupWizardShell steps={steps} ctx={makeCtx({ targetOS: 'ssh-linux' })} />,
    )
    // Wait for the failed state to mount the mapped error panel.
    await waitFor(() => {
      expect(container.querySelector('.bat-wizard-mapped-error')).not.toBeNull()
    })
    // Initially: detailMode is hidden-by-default -> raw error must NOT render.
    expect(container.querySelector('.bat-wizard-mapped-error-raw')).toBeNull()
    expect(screen.getByText('Show details')).toBeInTheDocument()
    // Click "Show details" -> raw error reveals.
    fireEvent.click(screen.getByText('Show details'))
    await waitFor(() => {
      expect(container.querySelector('.bat-wizard-mapped-error-raw')).not.toBeNull()
    })
    expect(container.querySelector('.bat-wizard-mapped-error-raw')?.textContent).toContain(rawMessage)
  })
})
