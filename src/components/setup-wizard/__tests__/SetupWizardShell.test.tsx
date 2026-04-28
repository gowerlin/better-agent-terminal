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

// =====================================================================
// T0334 (PLAN-032 Sprint 2): Mapped error visual snapshot
// =====================================================================

describe('<SetupWizardShell> mapped error visual snapshot (T0334)', () => {
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

  beforeEach(() => {
    ;(window as unknown as { electronAPI: unknown }).electronAPI = {
      shell: { openExternal: vi.fn() },
    }
  })

  afterEach(() => {
    delete (window as unknown as { electronAPI?: unknown }).electronAPI
    vi.restoreAllMocks()
  })

  // Helper for entries that match via Stage-1 errorCode (no regex pattern fallback).
  function failingStepWithErrorCode(
    id: string,
    group: string,
    label: string,
    errorMessage: string,
    errorCode: string,
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
        const err = new Error(errorMessage) as Error & { code?: string }
        err.code = errorCode
        throw err
      },
      ...opts,
    }
  }

  it('locks docker daemon mapped-error visual contract (title / body / raw / actions)', async () => {
    const rawMessage = 'error during connect: open //./pipe/docker_engine: not found'
    const steps = [
      failingStepWithError('detect-env', 'detection', 'detectEnv', rawMessage),
    ]
    const { container } = render(
      <SetupWizardShell steps={steps} ctx={makeCtx({ targetOS: 'docker-linux' })} />,
    )
    await waitFor(() => {
      expect(container.querySelector('.bat-wizard-mapped-error')).not.toBeNull()
    })
    const panel = container.querySelector('.bat-wizard-mapped-error') as HTMLElement

    // L1 Title — rose-200 semibold heading.
    const title = panel.querySelector('h4') as HTMLElement
    expect(title.textContent).toBe('未偵測到 Docker daemon')
    expect(title.className).toContain('text-rose-200')
    expect(title.className).toContain('font-semibold')

    // L2 Body — rose-100 paragraph (mapped body, not raw).
    const body = panel.querySelector('p') as HTMLElement
    expect(body.textContent).toContain('Docker Desktop')
    expect(body.className).toContain('text-rose-100')

    // L3 Raw — append-raw mode renders <pre> immediately with border + dark bg.
    const raw = panel.querySelector('pre.bat-wizard-mapped-error-raw') as HTMLElement
    expect(raw).not.toBeNull()
    expect(raw.textContent).toContain(rawMessage)
    expect(raw.className).toContain('border-rose-900/60')
    expect(raw.className).toContain('bg-rose-950/40')

    // L4 Actions — three buttons in spec order: open-link, fixed-and-retry, cancel.
    const actions = container.querySelector('.bat-stepper-failed-actions') as HTMLElement
    const buttons = Array.from(actions.querySelectorAll('button[data-action-kind]'))
    const fingerprint = buttons.map((btn) => ({
      kind: btn.getAttribute('data-action-kind'),
      label: btn.textContent?.trim() ?? '',
    }))
    expect(fingerprint).toMatchInlineSnapshot(`
      [
        {
          "kind": "open-link",
          "label": "下載 Docker Desktop",
        },
        {
          "kind": "fixed-and-retry",
          "label": "我已啟動 Docker，重試",
        },
        {
          "kind": "cancel",
          "label": "取消",
        },
      ]
    `)
  })

  // ---------------------------------------------------------------------
  // T0341 (PLAN-032 Sprint 5): visual snapshot補完 — 5 entries to cover the
  // remaining DEFAULT_WIZARD_ERROR_REGISTRY mapped-error panels (T0334 already
  // locked docker-daemon-unavailable). Together = 6 entries fully covered.
  // ---------------------------------------------------------------------

  it('locks wsl-linger-failure mapped-error visual contract (T0341)', async () => {
    const rawMessage = 'Could not enable linger: Failed to enable unit'
    const steps = [
      failingStepWithError('write-systemd-unit', 'deployment', 'fetchFingerprint', rawMessage),
    ]
    const { container } = render(
      <SetupWizardShell steps={steps} ctx={makeCtx({ targetOS: 'wsl-linux' })} />,
    )
    await waitFor(() => {
      expect(container.querySelector('.bat-wizard-mapped-error')).not.toBeNull()
    })
    const panel = container.querySelector('.bat-wizard-mapped-error') as HTMLElement

    const title = panel.querySelector('h4') as HTMLElement
    expect(title.textContent).toBe('無法自動啟用 systemd lingering')
    expect(title.className).toContain('text-rose-200')

    const body = panel.querySelector('p') as HTMLElement
    expect(body.textContent).toContain('loginctl enable-linger')
    expect(body.className).toContain('text-rose-100')

    // append-raw mode: <pre> renders immediately without "Show details" gate.
    const raw = panel.querySelector('pre.bat-wizard-mapped-error-raw') as HTMLElement
    expect(raw).not.toBeNull()
    expect(raw.textContent).toContain(rawMessage)

    const actions = container.querySelector('.bat-stepper-failed-actions') as HTMLElement
    const fingerprint = Array.from(actions.querySelectorAll('button[data-action-kind]')).map((btn) => ({
      kind: btn.getAttribute('data-action-kind'),
      label: btn.textContent?.trim() ?? '',
    }))
    expect(fingerprint).toMatchInlineSnapshot(`
      [
        {
          "kind": "fixed-and-retry",
          "label": "我已執行命令，重試",
        },
        {
          "kind": "skip",
          "label": "略過此步驟",
        },
        {
          "kind": "cancel",
          "label": "取消",
        },
      ]
    `)
  })

  it('locks wsl-service-start-timeout mapped-error visual contract (T0341)', async () => {
    const rawMessage = 'Timed out waiting for bat-server.service to become active'
    const steps = [
      failingStepWithError('write-systemd-unit', 'deployment', 'fetchFingerprint', rawMessage),
    ]
    const { container } = render(
      <SetupWizardShell steps={steps} ctx={makeCtx({ targetOS: 'wsl-linux' })} />,
    )
    await waitFor(() => {
      expect(container.querySelector('.bat-wizard-mapped-error')).not.toBeNull()
    })
    const panel = container.querySelector('.bat-wizard-mapped-error') as HTMLElement

    const title = panel.querySelector('h4') as HTMLElement
    expect(title.textContent).toBe('BAT systemd 服務啟動逾時')

    const body = panel.querySelector('p') as HTMLElement
    expect(body.textContent).toContain('journalctl --user -u bat-server.service')

    // append-raw: <pre> visible immediately.
    const raw = panel.querySelector('pre.bat-wizard-mapped-error-raw') as HTMLElement
    expect(raw).not.toBeNull()
    expect(raw.textContent).toContain(rawMessage)

    const actions = container.querySelector('.bat-stepper-failed-actions') as HTMLElement
    const fingerprint = Array.from(actions.querySelectorAll('button[data-action-kind]')).map((btn) => ({
      kind: btn.getAttribute('data-action-kind'),
      label: btn.textContent?.trim() ?? '',
    }))
    expect(fingerprint).toMatchInlineSnapshot(`
      [
        {
          "kind": "fixed-and-retry",
          "label": "我已檢查 journal，重試",
        },
        {
          "kind": "skip",
          "label": "略過此步驟（手動啟動）",
        },
        {
          "kind": "cancel",
          "label": "取消",
        },
      ]
    `)
  })

  it('locks wsl-not-installed mapped-error visual contract (T0341, errorCode-only entry)', async () => {
    // wsl-not-installed has no regex patterns — only Stage-1 errorCode match.
    // This locks BUG-076 fix: SetupWizardShell preserves runner-shipped
    // mappedError so pure-errorCode entries don't fall through to fallback.
    const rawMessage = 'wsl.exe not found on PATH'
    const steps = [
      failingStepWithErrorCode(
        'detect-env',
        'detection',
        'detectEnv',
        rawMessage,
        'wsl-not-installed',
      ),
    ]
    const { container } = render(
      <SetupWizardShell steps={steps} ctx={makeCtx({ targetOS: 'wsl-linux' })} />,
    )
    await waitFor(() => {
      expect(container.querySelector('.bat-wizard-mapped-error')).not.toBeNull()
    })
    const panel = container.querySelector('.bat-wizard-mapped-error') as HTMLElement

    const title = panel.querySelector('h4') as HTMLElement
    expect(title.textContent).toBe('找不到 WSL2')

    const body = panel.querySelector('p') as HTMLElement
    expect(body.textContent).toContain('wsl --install')

    // append-raw mode.
    const raw = panel.querySelector('pre.bat-wizard-mapped-error-raw') as HTMLElement
    expect(raw).not.toBeNull()
    expect(raw.textContent).toContain(rawMessage)

    const actions = container.querySelector('.bat-stepper-failed-actions') as HTMLElement
    const fingerprint = Array.from(actions.querySelectorAll('button[data-action-kind]')).map((btn) => ({
      kind: btn.getAttribute('data-action-kind'),
      label: btn.textContent?.trim() ?? '',
    }))
    expect(fingerprint).toMatchInlineSnapshot(`
      [
        {
          "kind": "open-link",
          "label": "安裝 WSL2 指南",
        },
        {
          "kind": "fixed-and-retry",
          "label": "我已安裝 WSL2，重試",
        },
        {
          "kind": "cancel",
          "label": "取消",
        },
      ]
    `)
  })

  it('locks ssh-permission-denied mapped-error visual contract (T0341, hidden-by-default detail mode)', async () => {
    const rawMessage = 'Permission denied (publickey).'
    const steps = [
      failingStepWithError('verify-ssh-auth', 'connection', 'connectTest', rawMessage),
    ]
    const { container } = render(
      <SetupWizardShell steps={steps} ctx={makeCtx({ targetOS: 'ssh-linux' })} />,
    )
    await waitFor(() => {
      expect(container.querySelector('.bat-wizard-mapped-error')).not.toBeNull()
    })
    const panel = container.querySelector('.bat-wizard-mapped-error') as HTMLElement

    const title = panel.querySelector('h4') as HTMLElement
    expect(title.textContent).toBe('SSH 認證失敗')

    const body = panel.querySelector('p') as HTMLElement
    expect(body.textContent).toContain('SSH key')

    // hidden-by-default: <pre> NOT rendered until "Show details" click; instead
    // a reveal button surfaces.
    expect(panel.querySelector('pre.bat-wizard-mapped-error-raw')).toBeNull()
    expect(within(panel).getByText('Show details')).toBeInTheDocument()

    const actions = container.querySelector('.bat-stepper-failed-actions') as HTMLElement
    const fingerprint = Array.from(actions.querySelectorAll('button[data-action-kind]')).map((btn) => ({
      kind: btn.getAttribute('data-action-kind'),
      label: btn.textContent?.trim() ?? '',
    }))
    expect(fingerprint).toMatchInlineSnapshot(`
      [
        {
          "kind": "edit-config",
          "label": "修改 SSH 設定",
        },
        {
          "kind": "retry",
          "label": "重試",
        },
        {
          "kind": "cancel",
          "label": "取消",
        },
      ]
    `)
  })

  it('locks ssh-configure-host-empty mapped-error visual contract (T0341, strict 2-action set)', async () => {
    const rawMessage = 'SSH host is required'
    const steps = [
      failingStepWithError('configure-ssh-host', 'connection', 'detectEnv', rawMessage),
    ]
    const { container } = render(
      <SetupWizardShell steps={steps} ctx={makeCtx({ targetOS: 'ssh-linux' })} />,
    )
    await waitFor(() => {
      expect(container.querySelector('.bat-wizard-mapped-error')).not.toBeNull()
    })
    const panel = container.querySelector('.bat-wizard-mapped-error') as HTMLElement

    const title = panel.querySelector('h4') as HTMLElement
    expect(title.textContent).toBe('SSH 主機名稱為必填')

    const body = panel.querySelector('p') as HTMLElement
    expect(body.textContent).toContain('~/.ssh/config')

    // hidden-by-default: <pre> not visible at first paint.
    expect(panel.querySelector('pre.bat-wizard-mapped-error-raw')).toBeNull()
    expect(within(panel).getByText('Show details')).toBeInTheDocument()

    // Strict action set: edit-config + cancel only (no retry / skip — empty
    // value is a user mistake, not an environment error).
    const actions = container.querySelector('.bat-stepper-failed-actions') as HTMLElement
    const fingerprint = Array.from(actions.querySelectorAll('button[data-action-kind]')).map((btn) => ({
      kind: btn.getAttribute('data-action-kind'),
      label: btn.textContent?.trim() ?? '',
    }))
    expect(fingerprint).toMatchInlineSnapshot(`
      [
        {
          "kind": "edit-config",
          "label": "修改 SSH 設定",
        },
        {
          "kind": "cancel",
          "label": "取消",
        },
      ]
    `)
  })
})

