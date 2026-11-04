/**
 * T0851 (PLAN-052 W2): `WizardChoiceOption.disabled` — the Shell shows the
 * option with its reason but it cannot be picked. Options without `disabled`
 * render exactly as before (WSL / SSH prompts unchanged).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import i18n from '../../../i18n'
import { SetupWizardShell } from '../SetupWizardShell'
import type { WizardContext, WizardStep } from '../wizard-runner'

function makeCtx(): WizardContext {
  return {
    targetOS: 'docker-linux',
    profileDraft: { name: 'test-profile' },
    warnings: [],
    state: {},
    logger: { info: () => undefined, warn: () => undefined, error: () => undefined },
  }
}

beforeEach(async () => {
  await i18n.changeLanguage('en')
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('<SetupWizardShell> disabled choice options (T0851)', () => {
  it('shows a disabled option with its reason; clicking it does not answer', async () => {
    const answers: Array<string | null> = []
    const step: WizardStep = {
      id: 'pick-container',
      title: 'pick-container',
      appliesTo: 'all',
      kind: 'input',
      async run(ctx) {
        answers.push(await ctx.requestChoice!({
          stepId: 'pick-container',
          title: 'Choose an existing container',
          options: [
            { label: 'usable', value: 'usable', description: 'bat-server:latest · running' },
            {
              label: 'blocked',
              value: 'blocked',
              description: 'alpine · stopped',
              disabled: true,
              disabledReasonKey: 'wizard.docker.pickContainer.container.disabled.portInUse',
              disabledReasonParams: { port: '9876' },
            },
          ],
        }))
      },
    }
    render(<SetupWizardShell steps={[step]} ctx={makeCtx()} />)

    const blocked = await screen.findByRole('button', { name: 'blocked' })
    expect(blocked).toBeDisabled()
    const reason = i18n.t('wizard.docker.pickContainer.container.disabled.portInUse', { port: '9876' })
    expect(reason).toContain('9876')
    expect(screen.getByText(reason)).toBeInTheDocument()
    expect(blocked.getAttribute('aria-describedby')).toContain('-option-blocked-disabled')

    fireEvent.click(blocked)
    expect(answers).toEqual([])

    const usable = screen.getByRole('button', { name: 'usable' })
    expect(usable).not.toBeDisabled()
    expect(usable.hasAttribute('disabled')).toBe(false)
    expect(usable.getAttribute('style')).toBeNull()
    expect(usable.getAttribute('aria-describedby')).toBe('bat-wizard-active-prompt-option-usable')
    fireEvent.click(usable)
    await vi.waitFor(() => expect(answers).toEqual(['usable']))
  })

  it('options without disabled render as before (no description -> bare button)', async () => {
    const step: WizardStep = {
      id: 'pick-wsl-distro',
      title: 'pick-wsl-distro',
      appliesTo: 'all',
      kind: 'input',
      async run(ctx) {
        await ctx.requestChoice!({
          stepId: 'pick-wsl-distro',
          title: 'Choose a WSL2 distro',
          options: [{ label: 'Ubuntu', value: 'Ubuntu' }],
        })
      },
    }
    render(<SetupWizardShell steps={[step]} ctx={makeCtx()} />)

    const option = await screen.findByRole('button', { name: 'Ubuntu' })
    expect(option.hasAttribute('disabled')).toBe(false)
    expect(option.hasAttribute('aria-describedby')).toBe(false)
    expect(option.closest('.bat-wizard-choice-item')).toBeNull()
  })
})
