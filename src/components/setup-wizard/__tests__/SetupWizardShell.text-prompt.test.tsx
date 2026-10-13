/**
 * T0502: <SetupWizardShell> renders ctx.requestText as a text prompt (used by
 * configure-ssh-host for a typed host) and translates choice option labelKey.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import i18n from '../../../i18n'
import { SetupWizardShell } from '../SetupWizardShell'
import type { WizardContext, WizardStep } from '../wizard-runner'
import { parseManualSshHost } from '../steps/ssh/configure-host'

function makeCtx(): WizardContext {
  return {
    targetOS: 'ssh-linux',
    profileDraft: { name: 'test-profile' },
    warnings: [],
    state: {},
    logger: { info: () => undefined, warn: () => undefined, error: () => undefined },
  }
}

function textStep(onValue: (value: string | null) => void): WizardStep {
  return {
    id: 'configure-ssh-host',
    title: 'configure-ssh-host',
    appliesTo: 'all',
    kind: 'input',
    retryable: true,
    labelKey: 'wizard.ssh.step.configureHost.label',
    async run(ctx) {
      const value = await ctx.requestText!({
        stepId: 'configure-ssh-host',
        title: 'Enter SSH host',
        titleKey: 'wizard.ssh.manualHost.title',
        descriptionKey: 'wizard.ssh.manualHost.description',
        placeholder: 'user@example.com:22',
        initialValue: 'old-host',
        validate: (input) => (parseManualSshHost(input) ? null : 'wizard.ssh.manualHost.invalid'),
      })
      onValue(value)
    },
  }
}

beforeEach(async () => {
  await i18n.changeLanguage('en')
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('<SetupWizardShell> text prompt (T0502)', () => {
  it('shows the translated prompt with the initial value', async () => {
    render(<SetupWizardShell steps={[textStep(() => undefined)]} ctx={makeCtx()} />)

    const input = await screen.findByRole('textbox', { name: i18n.t('wizard.ssh.manualHost.title') })
    expect((input as HTMLInputElement).value).toBe('old-host')
    expect(input.getAttribute('placeholder')).toBe('user@example.com:22')
    expect(screen.getByText(i18n.t('wizard.ssh.manualHost.description'))).toBeTruthy()
  })

  it('blocks an invalid value with the translated error and submits a valid one', async () => {
    const onValue = vi.fn()
    render(<SetupWizardShell steps={[textStep(onValue)]} ctx={makeCtx()} />)
    const input = await screen.findByRole('textbox', { name: i18n.t('wizard.ssh.manualHost.title') })

    fireEvent.change(input, { target: { value: '-oProxyCommand=calc' } })
    fireEvent.click(screen.getByRole('button', { name: i18n.t('wizard.action.submitText') }))

    expect(await screen.findByRole('alert')).toHaveTextContent(i18n.t('wizard.ssh.manualHost.invalid'))
    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(onValue).not.toHaveBeenCalled()

    fireEvent.change(input, { target: { value: '  deploy@build.example.com:2222  ' } })
    expect(screen.queryByRole('alert')).toBeNull()
    fireEvent.submit(input.closest('form')!)

    await waitFor(() => expect(onValue).toHaveBeenCalledWith('deploy@build.example.com:2222'))
    await waitFor(() => expect(screen.queryByRole('textbox')).toBeNull())
  })

  it('cancel resolves the prompt with null', async () => {
    const onValue = vi.fn()
    render(<SetupWizardShell steps={[textStep(onValue)]} ctx={makeCtx()} />)
    await screen.findByRole('textbox', { name: i18n.t('wizard.ssh.manualHost.title') })

    fireEvent.click(screen.getByRole('button', { name: i18n.t('wizard.action.cancelText') }))

    await waitFor(() => expect(onValue).toHaveBeenCalledWith(null))
  })

  it('uses zh-TW strings when the language is zh-TW', async () => {
    await i18n.changeLanguage('zh-TW')
    render(<SetupWizardShell steps={[textStep(() => undefined)]} ctx={makeCtx()} />)

    expect(await screen.findByRole('textbox', { name: '輸入 SSH 主機' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '確定' })).toBeTruthy()
  })
})

describe('<SetupWizardShell> choice option labelKey (T0502)', () => {
  it('renders the translated label for an option with labelKey and the plain label otherwise', async () => {
    const step: WizardStep = {
      id: 'configure-ssh-host',
      title: 'configure-ssh-host',
      appliesTo: 'all',
      kind: 'input',
      async run(ctx) {
        await ctx.requestChoice!({
          stepId: 'configure-ssh-host',
          title: 'Select SSH host',
          options: [
            { label: 'alpha', value: 'alpha' },
            { label: 'Enter host manually…', labelKey: 'wizard.ssh.manualHost.option', value: 'manual' },
          ],
        })
      },
    }
    await i18n.changeLanguage('zh-CN')
    render(<SetupWizardShell steps={[step]} ctx={makeCtx()} />)

    expect(await screen.findByRole('button', { name: 'alpha' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '手动输入主机…' })).toBeTruthy()
  })
})
