/**
 * T0338 (PLAN-032 Sprint 5): Integration tests for mapped UX cases — covers
 * the 6 DEFAULT_WIZARD_ERROR_REGISTRY entries shipped through Sprint 3
 * end-to-end (errorCode → ErrorMapper → SetupWizardShell render → recovery
 * action click → state flow). Each entry gets one synthetic step that throws
 * the registry-matchable error, then drives the recovery button via RTL.
 *
 * Companion suite: integration.transitions.test.ts (runner-only AC-1).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, waitFor, within } from '@testing-library/react'
import '../../../i18n' // initialize i18next once
import { SetupWizardShell } from '../SetupWizardShell'
import {
  WizardRunner,
  type WizardContext,
  type WizardStep,
  type WizardTargetOS,
} from '../wizard-runner'

function makeCtx(targetOS: WizardTargetOS, overrides: Partial<WizardContext> = {}): WizardContext {
  return {
    targetOS,
    profileDraft: { name: 'integration-ux' },
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

function failingStep(
  id: string,
  errorMessage: string,
  errorCode?: string,
  opts: Partial<WizardStep> = {},
): WizardStep {
  return {
    id,
    title: id,
    appliesTo: 'all',
    retryable: true,
    labelKey: `wizard.shared.step.detectEnv.label`,
    descriptionKey: `wizard.shared.step.detectEnv.description`,
    groupKey: `wizard.group.detection`,
    editableFromFailure: false,
    async run() {
      const err = new Error(errorMessage) as Error & { code?: string }
      if (errorCode) err.code = errorCode
      throw err
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

async function waitForFailedActions(container: HTMLElement) {
  await waitFor(() => {
    expect(container.querySelector('.bat-stepper-failed-actions')).not.toBeNull()
  })
  return container.querySelector('.bat-stepper-failed-actions') as HTMLElement
}

describe('integration.mapped-ux (T0338) — 6 registry entries × Shell render × recovery click', () => {
  // ─────────────────────────────────────────────────────────────────────
  // 1. docker-daemon-unavailable (BUG-073, T0336)
  // ─────────────────────────────────────────────────────────────────────
  it('1. docker-daemon-unavailable — open-link click invokes shell.openExternal with Docker URL', async () => {
    const step = failingStep(
      'detect-env',
      'error during connect: open //./pipe/docker_engine: not found',
      'docker-daemon-down',
    )
    const { container, getAllByText } = render(
      <SetupWizardShell steps={[step]} ctx={makeCtx('docker-linux')} />,
    )
    const actions = await waitForFailedActions(container)
    expect(getAllByText('未偵測到 Docker daemon').length).toBeGreaterThanOrEqual(1)
    expect(actions.querySelector('[data-action-kind="open-link"]')).not.toBeNull()
    expect(actions.querySelector('[data-action-kind="fixed-and-retry"]')).not.toBeNull()
    expect(actions.querySelector('[data-action-kind="cancel"]')).not.toBeNull()

    const link = actions.querySelector('[data-action-kind="open-link"]') as HTMLButtonElement
    fireEvent.click(link)
    const openExternal = (
      window as unknown as { electronAPI: { shell: { openExternal: ReturnType<typeof vi.fn> } } }
    ).electronAPI.shell.openExternal
    expect(openExternal).toHaveBeenCalledWith('https://www.docker.com/products/docker-desktop/')
  })

  // ─────────────────────────────────────────────────────────────────────
  // 2. wsl-linger-failure (BUG-072, T0337)
  // ─────────────────────────────────────────────────────────────────────
  it('2. wsl-linger-failure — fixed-and-retry click triggers retry on runner', async () => {
    const retrySpy = vi.spyOn(WizardRunner.prototype, 'retryCurrentStep').mockResolvedValue(undefined)
    const step = failingStep(
      'write-systemd-unit',
      'Could not enable linger for user',
      'wsl-linger-failed',
    )
    const { container, getAllByText } = render(
      <SetupWizardShell steps={[step]} ctx={makeCtx('wsl-linux')} />,
    )
    const actions = await waitForFailedActions(container)
    expect(getAllByText('無法自動啟用 systemd lingering').length).toBeGreaterThanOrEqual(1)

    const btn = actions.querySelector('[data-action-kind="fixed-and-retry"]') as HTMLButtonElement
    expect(btn).not.toBeNull()
    expect(btn.textContent).toContain('我已執行命令，重試')
    fireEvent.click(btn)
    expect(retrySpy).toHaveBeenCalledTimes(1)
  })

  // ─────────────────────────────────────────────────────────────────────
  // 3. wsl-service-start-timeout (spec § 6, T0337)
  // ─────────────────────────────────────────────────────────────────────
  it('3. wsl-service-start-timeout — skip click flips snapshot to skipped + succeeded', async () => {
    const step = failingStep(
      'write-systemd-unit',
      'Timed out waiting for bat-server.service to become active',
      'wsl-service-start-timeout',
    )
    const { container, getAllByText, findByText } = render(
      <SetupWizardShell steps={[step]} ctx={makeCtx('wsl-linux')} />,
    )
    const actions = await waitForFailedActions(container)
    expect(getAllByText('BAT systemd 服務啟動逾時').length).toBeGreaterThanOrEqual(1)
    expect(actions.querySelector('[data-action-kind="fixed-and-retry"]')).not.toBeNull()
    expect(actions.querySelector('[data-action-kind="cancel"]')).not.toBeNull()

    const skipBtn = actions.querySelector('[data-action-kind="skip"]') as HTMLButtonElement
    expect(skipBtn).not.toBeNull()
    fireEvent.click(skipBtn)
    // Skipped note surfaces in detail panel.
    expect(await findByText('Skipped by user')).toBeInTheDocument()
  })

  // ─────────────────────────────────────────────────────────────────────
  // 4. wsl-not-installed (T0337 extra coverage; T0339/BUG-076 unskipped)
  //
  // T0338 Sprint 5 originally discovered that SetupWizardShell re-resolved the
  // registry from `error.message` alone, dropping `errorCode` and bypassing
  // the stage-1 exact match for entries that ship errorCodes only (no
  // patterns). T0339 fixes the Shell to prefer `snapshot.mappedError` (single
  // source of truth, runner already resolved with full context), so this case
  // now passes and the prior fallback regression guard (#4b) is removed.
  // ─────────────────────────────────────────────────────────────────────
  it('4. wsl-not-installed — open-link uses Microsoft WSL install guide', async () => {
    const step = failingStep(
      'detect-env',
      'WSL2 is not installed on this Windows host',
      'wsl-not-installed',
    )
    const { container, getAllByText } = render(
      <SetupWizardShell steps={[step]} ctx={makeCtx('wsl-linux')} />,
    )
    const actions = await waitForFailedActions(container)
    expect(getAllByText('找不到 WSL2').length).toBeGreaterThanOrEqual(1)

    const link = actions.querySelector('[data-action-kind="open-link"]') as HTMLButtonElement
    expect(link).not.toBeNull()
    expect(link.textContent).toContain('安裝 WSL2 指南')
    fireEvent.click(link)
    const openExternal = (
      window as unknown as { electronAPI: { shell: { openExternal: ReturnType<typeof vi.fn> } } }
    ).electronAPI.shell.openExternal
    expect(openExternal).toHaveBeenCalledWith('https://learn.microsoft.com/en-us/windows/wsl/install')
  })

  // ─────────────────────────────────────────────────────────────────────
  // 5. ssh-permission-denied (spec § 6, Sprint 3 baseline)
  // ─────────────────────────────────────────────────────────────────────
  it('5. ssh-permission-denied — hidden-by-default detail mode + edit-config jumps to configure-ssh-host', async () => {
    const jumpSpy = vi.spyOn(WizardRunner.prototype, 'jumpToStep').mockResolvedValue(undefined)
    const configureStep: WizardStep = {
      id: 'configure-ssh-host',
      title: 'configure-ssh-host',
      appliesTo: 'all',
      labelKey: 'wizard.shared.step.detectEnv.label',
      groupKey: 'wizard.group.connection',
      async run() {},
    }
    const verifyStep = failingStep(
      'verify-ssh-auth',
      'Permission denied (publickey).',
      'permission-denied',
      { groupKey: 'wizard.group.connection' },
    )
    const { container, getAllByText, getByText, findByText } = render(
      <SetupWizardShell steps={[configureStep, verifyStep]} ctx={makeCtx('ssh-linux')} />,
    )
    const actions = await waitForFailedActions(container)
    expect(getAllByText('SSH 認證失敗').length).toBeGreaterThanOrEqual(1)

    // detailMode hidden-by-default — raw error pre block must NOT render initially.
    expect(container.querySelector('.bat-wizard-mapped-error-raw')).toBeNull()
    fireEvent.click(getByText('Show details'))
    await waitFor(() => {
      expect(container.querySelector('.bat-wizard-mapped-error-raw')).not.toBeNull()
    })
    expect(container.querySelector('.bat-wizard-mapped-error-raw')?.textContent).toContain(
      'Permission denied',
    )

    // edit-config registry action targets configure-ssh-host (index 0).
    const editBtn = actions.querySelector('[data-action-kind="edit-config"]') as HTMLButtonElement
    expect(editBtn).not.toBeNull()
    fireEvent.click(editBtn)
    await waitFor(() => {
      expect(jumpSpy).toHaveBeenCalledWith(0)
    })
    // Confirm `findByText` works post-action — sanity that Shell did not unmount.
    expect(await findByText('SSH 認證失敗')).toBeInTheDocument()
  })

  // ─────────────────────────────────────────────────────────────────────
  // 6. ssh-configure-host-empty (BUG-074, T0335)
  //
  // The real configure-ssh-host step has `kind: 'input'` and only throws
  // configure-host-empty AFTER the user submits empty via ctx.requestChoice
  // (covered by configure-host.test.ts AC-5 #4 at the runner layer). The
  // Shell-layer integration here verifies the rendered UX once the throw
  // lands: registry-mandated edit-config + cancel buttons, no retry/skip,
  // hidden-by-default detail mode. Driving the Shell's allowSkip=true prompt
  // through RTL adds no extra mapped-UX signal beyond what 6 covers below
  // (see configure-host.test.ts for the full input-step flow).
  // ─────────────────────────────────────────────────────────────────────
  // (Intentionally folded into 6b — see below.)

  // 6. Direct ErrorMapper coverage for ssh-configure-host-empty: drives the
  // failed branch without needing the Shell's requestChoice plumbing. Confirms
  // the registry mapping + UI rendering when the throw lands.
  it('6. ssh-configure-host-empty — synchronous throw renders mapped title + edit-config + cancel buttons', async () => {
    const step = failingStep(
      'configure-ssh-host',
      'SSH host is required (pick an alias from ~/.ssh/config or type host).',
      'configure-host-empty',
      { groupKey: 'wizard.group.connection', editableFromFailure: true },
    )
    const { container, getAllByText } = render(
      <SetupWizardShell steps={[step]} ctx={makeCtx('ssh-linux')} />,
    )
    const actions = await waitForFailedActions(container)
    expect(getAllByText('SSH 主機名稱為必填').length).toBeGreaterThanOrEqual(1)

    // Registry-mandated kinds: edit-config + cancel (no retry/skip).
    expect(actions.querySelector('[data-action-kind="edit-config"]')).not.toBeNull()
    expect(actions.querySelector('[data-action-kind="cancel"]')).not.toBeNull()
    expect(actions.querySelector('[data-action-kind="retry"]')).toBeNull()
    expect(actions.querySelector('[data-action-kind="skip"]')).toBeNull()

    // detailMode hidden-by-default — raw block hidden until "Show details" clicked.
    expect(container.querySelector('.bat-wizard-mapped-error-raw')).toBeNull()
    expect(within(actions).queryByText('修改 SSH 設定')).not.toBeNull()
  })
})
