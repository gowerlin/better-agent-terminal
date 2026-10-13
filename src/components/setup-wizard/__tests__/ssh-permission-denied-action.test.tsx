/**
 * T0511 (T0510 其他觀察 1): when the real `verify-ssh-auth` step fails with
 * `permission-denied`, the failed step must show the `ssh-permission-denied`
 * registry actions ("Edit SSH settings" → configure-ssh-host, retry, cancel),
 * not the generic fallback set. Before T0511 the step threw a plain Error
 * (no `code`) whose message reads `permission-denied: ...`, so neither the
 * errorCode lookup nor the `/permission denied/i` pattern matched.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, waitFor } from '@testing-library/react'
import i18n from '../../../i18n'
import en from '../../../locales/en.json'
import zhCN from '../../../locales/zh-CN.json'
import zhTW from '../../../locales/zh-TW.json'
import { SetupWizardShell } from '../SetupWizardShell'
import { DEFAULT_WIZARD_ERROR_REGISTRY, resolveWizardError } from '../error-mapper'
import { verifySshAuthStep } from '../steps/ssh/verify-auth'
import { WizardRunner, type WizardContext, type WizardStep } from '../wizard-runner'

function installApi(): void {
  ;(window as unknown as { electronAPI: unknown }).electronAPI = {
    shell: { openExternal: vi.fn() },
    ssh: {
      probeAuth: vi.fn(async () => ({ ok: false, errorCode: 'permission-denied', error: 'Permission denied (publickey).' })),
    },
  }
}

function makeCtx(): WizardContext {
  return {
    targetOS: 'ssh-linux',
    profileDraft: { name: 't0511' },
    warnings: [],
    state: { sshHost: 'bat-t0510-nouser', sshUser: '' },
    logger: { info: () => undefined, warn: () => undefined, error: () => undefined },
  }
}

const configureStub: WizardStep = {
  id: 'configure-ssh-host',
  title: 'configure-ssh-host',
  appliesTo: 'all',
  labelKey: 'wizard.ssh.step.configureHost.label',
  groupKey: 'wizard.group.connection',
  async run() {},
}

beforeAll(async () => {
  await i18n.changeLanguage('zh-TW')
})

afterAll(async () => {
  await i18n.changeLanguage('en')
})

afterEach(() => {
  delete (window as unknown as { electronAPI?: unknown }).electronAPI
  vi.restoreAllMocks()
})

describe('verify-ssh-auth permission-denied → mapped "Edit SSH settings" (T0511)', () => {
  it('the thrown error carries code permission-denied', async () => {
    installApi()
    const err = await verifySshAuthStep.run(makeCtx()).then(() => null, (e: unknown) => e)
    expect(err).toBeInstanceOf(Error)
    expect((err as Error & { code?: string }).code).toBe('permission-denied')
    expect((err as Error).message).toMatch(/^permission-denied: SSH server rejected our key/)
  })

  it('the step message alone (no errorCode) still maps to ssh-permission-denied', () => {
    const mapped = resolveWizardError(
      {
        platform: 'ssh',
        stepId: 'verify-ssh-auth',
        error: new Error('permission-denied: SSH server rejected our key.'),
      },
      DEFAULT_WIZARD_ERROR_REGISTRY,
    )
    expect(mapped.matchId).toBe('ssh-permission-denied')
  })

  it('the Shell renders the mapped actions and Edit SSH settings jumps to configure-ssh-host', async () => {
    installApi()
    const jumpSpy = vi.spyOn(WizardRunner.prototype, 'jumpToStep').mockResolvedValue(undefined)
    const { container } = render(
      <SetupWizardShell steps={[configureStub, verifySshAuthStep]} ctx={makeCtx()} />,
    )
    let actions: Element | null = null
    await waitFor(() => {
      actions = container.querySelector('.bat-stepper-failed-actions')
      expect(actions).not.toBeNull()
    })
    const buttons = Array.from(actions!.querySelectorAll('button'))
    expect(buttons.map((b) => b.getAttribute('data-action-kind'))).toEqual(['edit-config', 'retry', 'cancel'])
    const edit = buttons[0]
    expect(edit.textContent).toBe('修改 SSH 設定')
    fireEvent.click(edit)
    await waitFor(() => {
      expect(jumpSpy).toHaveBeenCalledWith(0)
    })
  })

  it('wizard.action.editSshSettings exists in all three locales', () => {
    expect(en.wizard.action.editSshSettings).toBe('Edit SSH settings')
    expect(zhTW.wizard.action.editSshSettings).toBe('修改 SSH 設定')
    expect(zhCN.wizard.action.editSshSettings).toBe('修改 SSH 设置')
  })
})
