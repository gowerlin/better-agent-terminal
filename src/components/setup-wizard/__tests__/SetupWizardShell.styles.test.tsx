/**
 * T0658 (BUG-163): the app does not load Tailwind, so the wizard's Tailwind
 * utility classes had no effect (white native buttons, no progress bar, no
 * prompt box). Buttons / the text input must use the Profiles panel classes
 * (`.profile-action-btn`, `.profile-name-input`, settings.css) and the rest the
 * `.bat-wizard-*` classes in setup-wizard.css.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import i18n from '../../../i18n'
import { SetupWizardShell } from '../SetupWizardShell'
import type { WizardContext, WizardStep } from '../wizard-runner'

function makeCtx(): WizardContext {
  return {
    targetOS: 'wsl-linux',
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

describe('<SetupWizardShell> styles use app classes, not Tailwind (T0658)', () => {
  it('choice options are .profile-action-btn buttons inside the prompt box', async () => {
    const step: WizardStep = {
      id: 'pick-wsl-distro',
      title: 'pick-wsl-distro',
      appliesTo: 'all',
      kind: 'input',
      async run(ctx) {
        await ctx.requestChoice!({
          stepId: 'pick-wsl-distro',
          title: 'Choose a WSL2 distro',
          options: [
            { label: 'Ubuntu', value: 'Ubuntu' },
            { label: 'Debian', value: 'Debian' },
          ],
          allowSkip: true,
        })
      },
    }
    render(<SetupWizardShell steps={[step]} ctx={makeCtx()} />)

    const option = await screen.findByRole('button', { name: 'Ubuntu' })
    expect(option.classList.contains('profile-action-btn')).toBe(true)
    expect(option.className).not.toMatch(/\b(rounded-md|border-sky-600|px-3|py-2)\b/)
    expect(screen.getByRole('button', { name: i18n.t('wizard.action.skipChoice') }).classList.contains('profile-action-btn')).toBe(true)
    expect(option.closest('#bat-wizard-active-prompt')?.classList.contains('bat-wizard-prompt')).toBe(true)
  })

  it('text prompt uses .profile-name-input and a primary submit button', async () => {
    const step: WizardStep = {
      id: 'configure-ssh-host',
      title: 'configure-ssh-host',
      appliesTo: 'all',
      kind: 'input',
      async run(ctx) {
        await ctx.requestText!({ stepId: 'configure-ssh-host', title: 'Enter SSH host' })
      },
    }
    render(<SetupWizardShell steps={[step]} ctx={makeCtx()} />)

    const input = await screen.findByRole('textbox', { name: 'Enter SSH host' })
    expect(input.classList.contains('profile-name-input')).toBe(true)
    const submit = screen.getByRole('button', { name: i18n.t('wizard.action.submitText') })
    expect(submit.className).toBe('profile-action-btn primary')
  })

  it('failed-step recovery buttons use .profile-action-btn; cancel is .danger', async () => {
    const step: WizardStep = {
      id: 'install-server-bundle',
      title: 'install-server-bundle',
      appliesTo: 'all',
      retryable: true,
      async run() {
        throw new Error('boom')
      },
    }
    const { container } = render(<SetupWizardShell steps={[step]} ctx={makeCtx()} />)

    await waitFor(() => {
      expect(container.querySelector('.bat-stepper-failed-actions button')).not.toBeNull()
    })
    const buttons = Array.from(container.querySelectorAll<HTMLButtonElement>('.bat-stepper-failed-actions button'))
    for (const btn of buttons) expect(btn.classList.contains('profile-action-btn')).toBe(true)
    const cancel = container.querySelector('[data-action-kind="cancel"]') as HTMLElement
    expect(cancel.classList.contains('danger')).toBe(true)
  })

  it('source guard: no Tailwind utility classes left in SetupWizardShell.tsx', () => {
    const src = readFileSync(resolve(__dirname, '../SetupWizardShell.tsx'), 'utf8')
    const classValues = [...src.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)].map((m) => m[1] ?? m[2])
    expect(classValues.length).toBeGreaterThan(20)
    const tailwind = /(^|\s)(?:mt|mb|p|px|py|gap|w|h)-\d|(^|\s)(?:text|bg|border)-(?:xs|sm|base|lg|neutral|sky|rose|amber|emerald)\b|(^|\s)(?:rounded(?:-\w+)?|flex|grid|uppercase|underline|transition)(?=\s|$)/
    const offenders = classValues.filter((value) => tailwind.test(value))
    expect(offenders).toEqual([])
  })
})
