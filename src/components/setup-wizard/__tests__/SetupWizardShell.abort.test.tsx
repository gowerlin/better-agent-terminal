/**
 * T0830 (PLAN-043): the Shell shows "Stop setup" while a step runs or waits for input; clicking
 * it shows "Stopping…" until the step settles and the rollback ran, then the cancelled notice.
 * The aborted step offers no retry / skip / cancel. No button on a failure screen (it has its
 * own cancel) or once the wizard is over.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import i18n from '../../../i18n'
import { SetupWizardShell } from '../SetupWizardShell'
import type { WizardContext, WizardStep } from '../wizard-runner'

function makeCtx(overrides: Partial<WizardContext> = {}): WizardContext {
  return {
    targetOS: 'wsl-linux',
    profileDraft: { name: 'abort-ui' },
    warnings: [],
    state: {},
    logger: { info: () => undefined, warn: () => undefined, error: () => undefined },
    ...overrides,
  }
}

const meta = {
  appliesTo: 'all' as const,
  retryable: true,
  labelKey: 'wizard.shared.step.detectEnv.label',
  groupKey: 'wizard.group.detection',
}

beforeEach(async () => {
  await i18n.changeLanguage('en')
})
afterEach(async () => {
  await i18n.changeLanguage('en')
})

describe('<SetupWizardShell> step abort (T0830)', () => {
  it('Stop setup → Stopping… → rolled back → cancelled notice, no recovery buttons', async () => {
    let release: (() => void) | null = null
    let rolledBack = false
    const step: WizardStep = {
      ...meta,
      id: 'slow',
      title: 'slow',
      async run(ctx) {
        // stops only some time after the abort (like a child process that takes a moment to end)
        await new Promise<void>((resolve) => ctx.signal!.addEventListener('abort', () => { release = resolve }, { once: true }))
        throw new Error('child ended')
      },
      async rollback() { rolledBack = true },
    }
    const { container } = render(<SetupWizardShell steps={[step]} ctx={makeCtx()} />)
    const button = await screen.findByTestId('wizard-abort')
    expect(button).toHaveTextContent('Stop setup')
    expect(button).not.toBeDisabled()

    fireEvent.click(button)
    await waitFor(() => expect(screen.getByTestId('wizard-abort')).toBeDisabled())
    expect(screen.getByTestId('wizard-abort')).toHaveTextContent('Stopping')
    expect(screen.getByTestId('wizard-aborting')).toBeInTheDocument()
    expect(rolledBack).toBe(false)

    release!()
    await screen.findByText('Setup was cancelled.')
    expect(rolledBack).toBe(true)
    expect(screen.queryByTestId('wizard-abort')).toBeNull()
    expect(container.querySelector('[data-action-kind="retry"]')).toBeNull()
    expect(container.querySelector('[data-action-kind="cancel"]')).toBeNull()
  })

  it('a step waiting for a choice can be stopped too; the prompt goes away', async () => {
    const step: WizardStep = {
      ...meta,
      id: 'pick',
      title: 'pick',
      kind: 'input',
      async run(ctx) {
        await ctx.requestChoice!({ stepId: 'pick', title: 'Pick a distro', options: [{ label: 'Ubuntu', value: 'u' }] })
      },
    }
    render(<SetupWizardShell steps={[step]} ctx={makeCtx()} />)
    await screen.findByText('Pick a distro')
    fireEvent.click(screen.getByTestId('wizard-abort'))
    await screen.findByText('Setup was cancelled.')
    expect(screen.queryByText('Pick a distro')).toBeNull()
  })

  it('no Stop button on a failure screen (it has its own cancel)', async () => {
    const step: WizardStep = { ...meta, id: 'bad', title: 'bad', async run() { throw new Error('boom') } }
    const { container } = render(<SetupWizardShell steps={[step]} ctx={makeCtx()} />)
    await waitFor(() => expect(container.querySelector('[data-action-kind="cancel"]')).not.toBeNull())
    expect(screen.queryByTestId('wizard-abort')).toBeNull()
  })

  it('zh-TW labels', async () => {
    await i18n.changeLanguage('zh-TW')
    const step: WizardStep = { ...meta, id: 'hang', title: 'hang', async run() { await new Promise(() => undefined) } }
    render(<SetupWizardShell steps={[step]} ctx={makeCtx()} />)
    const button = await screen.findByTestId('wizard-abort')
    expect(button).toHaveTextContent('中止設定')
    fireEvent.click(button)
    await waitFor(() => expect(screen.getByTestId('wizard-abort')).toHaveTextContent('正在中止'))
  })
})
