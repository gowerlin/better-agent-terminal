/**
 * T0413 (PLAN-037 F): remote tools panel in the setup wizard completion block.
 * Steps are injected (no real wizard flow); only remoteTools.* is mocked on electronAPI.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, renderHook, screen, waitFor } from '@testing-library/react'
import i18n from '../../../i18n'
import { SetupWizardShell, useWslWizardController } from '../SetupWizardShell'
import type { WizardContext, WizardStep } from '../wizard-runner'
import type { RemoteToolsDetectResult } from '../../../types/remote-tools'

const DETECT_FAIL: RemoteToolsDetectResult = { ok: false, errorCode: 'connect-failed', error: 'unreachable' }

function makeCtx(): WizardContext {
  return {
    targetOS: 'wsl-linux',
    profileDraft: { name: 'test-profile' },
    warnings: [],
    state: {},
    logger: { info: () => undefined, warn: () => undefined, error: () => undefined },
  }
}

function step(id: string, run: WizardStep['run']): WizardStep {
  return {
    id,
    title: `legacy-${id}`,
    appliesTo: 'all',
    retryable: true,
    labelKey: 'wizard.shared.step.writeProfile.label',
    groupKey: 'wizard.group.profile',
    editableFromFailure: false,
    run,
  }
}

const writeProfile = (profileId: string) => step('write-profile', async (ctx) => { ctx.createdProfileId = profileId })
const noProfile = () => step('noop', async () => undefined)

let originalApi: unknown
let detect: ReturnType<typeof vi.fn>

beforeAll(async () => {
  await i18n.changeLanguage('en')
})

beforeEach(() => {
  originalApi = (window as unknown as { electronAPI?: unknown }).electronAPI
  detect = vi.fn().mockResolvedValue(DETECT_FAIL)
  ;(window as unknown as { electronAPI: unknown }).electronAPI = { remoteTools: { detect, detectHere: vi.fn() } }
})

afterEach(() => {
  ;(window as unknown as { electronAPI?: unknown }).electronAPI = originalApi
})

describe('SetupWizardShell completion block — remote tools', () => {
  it('shows the panel after success and detects the created profile', async () => {
    const onComplete = vi.fn()
    render(<SetupWizardShell steps={[writeProfile('p-new')]} ctx={makeCtx()} onComplete={onComplete} />)
    expect(await screen.findByTestId('remote-tools-entry-wizard')).toBeInTheDocument()
    await waitFor(() => expect(detect).toHaveBeenCalledWith('p-new'))
    expect(detect).toHaveBeenCalledTimes(1)
    expect(onComplete).toHaveBeenCalledWith('p-new')
  })

  it('does not show the panel while steps are still running', () => {
    const hanging = step('hang', () => new Promise<void>(() => undefined))
    render(<SetupWizardShell steps={[writeProfile('p-new'), hanging]} ctx={makeCtx()} />)
    expect(screen.queryByTestId('remote-tools-entry-wizard')).toBeNull()
    expect(detect).not.toHaveBeenCalled()
  })

  it('without a created profile id the panel is not shown', async () => {
    render(<SetupWizardShell steps={[noProfile()]} ctx={makeCtx()} />)
    expect(await screen.findByText(i18n.t('wizard.progress.complete'))).toBeInTheDocument()
    expect(screen.queryByTestId('remote-tools-entry-wizard')).toBeNull()
    expect(detect).not.toHaveBeenCalled()
  })
})

describe('setup wizard controller', () => {
  it('stays open after completion so the completion block is visible', () => {
    const onComplete = vi.fn()
    const { result } = renderHook(() => useWslWizardController(onComplete))
    act(() => result.current.open('box'))
    expect(result.current.isOpen).toBe(true)
    act(() => result.current.handleComplete('p-new'))
    expect(onComplete).toHaveBeenCalledWith('p-new')
    expect(result.current.isOpen).toBe(true)
    act(() => result.current.close())
    expect(result.current.isOpen).toBe(false)
  })
})
