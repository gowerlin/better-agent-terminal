/**
 * T0378 (BUG-086): "WSL installed, no distro" gets its own classification
 * (wsl-no-distro) with i18n guidance towards `wsl --install -d Ubuntu-24.04`;
 * "WSL not installed" keeps its existing mapping.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import i18n from '../../../i18n'
import en from '../../../locales/en.json'
import zhTW from '../../../locales/zh-TW.json'
import zhCN from '../../../locales/zh-CN.json'
import {
  DEFAULT_WIZARD_ERROR_REGISTRY,
  WizardRunner,
  WizardStepStatus,
  resolveWizardError,
  type WizardContext,
} from '../wizard-runner'
import { pickWslDistroStep } from '../steps/wsl/pick-wsl-distro'
import { detectEnvStep } from '../steps/wsl/detect-env'

function makeCtx(): WizardContext {
  return {
    targetOS: 'wsl-linux',
    profileDraft: { name: 'no-distro' },
    warnings: [],
    state: {},
    logger: { info: () => undefined, warn: () => undefined, error: () => undefined },
  }
}

function installWsl(list: ReturnType<typeof vi.fn>) {
  ;(globalThis as unknown as { window: unknown }).window = {
    electronAPI: { platform: 'win32', wsl: { list } },
  }
}

afterEach(async () => {
  vi.restoreAllMocks()
  delete (globalThis as unknown as { window?: unknown }).window
  await i18n.changeLanguage('en')
})

describe('wsl-no-distro (T0378 / BUG-086)', () => {
  it('i18n keys exist in en / zh-TW / zh-CN and mention Ubuntu-24.04 + --list --online', () => {
    for (const locale of [en, zhTW, zhCN] as Array<typeof en>) {
      const entry = locale.wizard.wsl.error.noDistro
      expect(entry.title.length).toBeGreaterThan(0)
      expect(entry.body).toContain('wsl --install -d Ubuntu-24.04')
      expect(entry.body).toContain('wsl --list --online')
    }
  })

  it('detect-env passes when WSL is installed with an empty distro list', async () => {
    installWsl(vi.fn(async () => ({ distros: [], default: null })))
    const ctx = makeCtx()
    await expect(detectEnvStep.preflight!(ctx)).resolves.toMatchObject({ ok: true })
    await expect(detectEnvStep.run(ctx)).resolves.toBeUndefined()
  })

  it('detect-env keeps the wsl-not-installed mapping when wsl.list rejects', async () => {
    installWsl(vi.fn(async () => { throw new Error('Command failed: wsl -l -v') }))
    const result = await detectEnvStep.preflight!(makeCtx())
    expect(result.ok).toBe(false)
    expect(result.errorCode).toBe('wsl-not-installed')
    const mapped = resolveWizardError(
      { platform: 'wsl', stepId: 'detect-env', errorCode: result.errorCode, error: new Error(result.reason) },
      DEFAULT_WIZARD_ERROR_REGISTRY,
    )
    expect(mapped.matchId).toBe('wsl-not-installed')
  })

  it('pick-wsl-distro throws code=wsl-no-distro on an empty list', async () => {
    installWsl(vi.fn(async () => ({ distros: [], default: null })))
    let caught: (Error & { code?: string }) | null = null
    try {
      await pickWslDistroStep.run(makeCtx())
    } catch (error) {
      caught = error as Error & { code?: string }
    }
    expect(caught?.code).toBe('wsl-no-distro')
    expect(caught?.message).toContain('wsl --install -d Ubuntu-24.04')
  })

  it('runner maps the failure to wsl-no-distro with localized text and fixed-and-retry', async () => {
    await i18n.changeLanguage('zh-TW')
    installWsl(vi.fn(async () => ({ distros: [], default: null })))
    const runner = new WizardRunner([pickWslDistroStep], makeCtx())
    const runPromise = runner.run().catch(() => undefined)
    await new Promise<void>((resolve) => {
      const tick = () => (runner.getSnapshots()[0].status === WizardStepStatus.Failed ? resolve() : setTimeout(tick, 5))
      tick()
    })
    const snap = runner.getSnapshots()[0]
    await runner.cancel()
    await runPromise

    expect(snap.mappedError?.matchId).toBe('wsl-no-distro')
    expect(snap.mappedError?.title).toBe(zhTW.wizard.wsl.error.noDistro.title)
    expect(snap.mappedError?.body).toContain('wsl --install -d Ubuntu-24.04')
    expect(snap.mappedError?.actions.map((a) => a.kind)).toEqual(['fixed-and-retry', 'cancel'])
  })

  it('regex fallback maps a code-less message too, and follows the UI language', async () => {
    await i18n.changeLanguage('en')
    const mapped = resolveWizardError(
      { platform: 'wsl', stepId: 'pick-wsl-distro', error: new Error('No WSL distros found.') },
      DEFAULT_WIZARD_ERROR_REGISTRY,
    )
    expect(mapped.matchId).toBe('wsl-no-distro')
    expect(mapped.title).toBe(en.wizard.wsl.error.noDistro.title)
  })

  it('pick-wsl-distro clears a cached $HOME from a previously picked distro', async () => {
    installWsl(vi.fn(async () => ({ distros: [{ name: 'Debian', version: 2, state: 'Stopped' }], default: 'Debian' })))
    const ctx = { ...makeCtx(), wslDistro: 'Ubuntu-24.04', wslHome: '/home/old' }
    await pickWslDistroStep.run(ctx)
    expect(ctx.wslDistro).toBe('Debian')
    expect(ctx.wslHome).toBeUndefined()
  })
})
