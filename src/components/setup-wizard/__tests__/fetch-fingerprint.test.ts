/**
 * T0381 (BUG-090): fetch-fingerprint unwraps the structured IPC result,
 * retries only while nothing is listening yet, and surfaces the failure code
 * so WizardErrorMapper resolves it (i18n) for the WSL / SSH / Docker flows.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import i18n from '../../../i18n'
import en from '../../../locales/en.json'
import zhTW from '../../../locales/zh-TW.json'
import zhCN from '../../../locales/zh-CN.json'
import {
  DEFAULT_WIZARD_ERROR_REGISTRY,
  resolveWizardError,
  type WizardContext,
} from '../wizard-runner'
import { fetchFingerprintStep, resetFetchFingerprintImplForTests } from '../steps/wsl/fetch-fingerprint'
import { buildWslWizardSteps } from '../wsl-flow'
import { buildSshWizardSteps } from '../ssh-flow'
import { buildDockerWizardSteps } from '../docker-flow'

const FP = 'AB:'.repeat(31) + 'CD'
const CODES = [
  ['fingerprint-timeout', 'fingerprintTimeout'],
  ['fingerprint-unreachable', 'fingerprintUnreachable'],
  ['fingerprint-handshake-failed', 'fingerprintHandshakeFailed'],
  ['fingerprint-invalid-port', 'fingerprintInvalidPort'],
] as const

function makeCtx(overrides: Partial<WizardContext> = {}): WizardContext {
  return {
    targetOS: 'wsl-linux',
    profileDraft: { name: 'fp' },
    warnings: [],
    state: {},
    serverPort: 9876,
    logger: { info: () => undefined, warn: () => undefined, error: () => undefined },
    ...overrides,
  }
}

function installIpc(fetchFingerprint: ReturnType<typeof vi.fn>) {
  ;(globalThis as unknown as { window: unknown }).window = {
    electronAPI: { wsl: { fetchFingerprint } },
  }
}

async function runCatching(ctx: WizardContext): Promise<(Error & { code?: string }) | null> {
  try {
    await fetchFingerprintStep.run(ctx)
    return null
  } catch (error) {
    return error as Error & { code?: string }
  }
}

afterEach(async () => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  resetFetchFingerprintImplForTests()
  delete (globalThis as unknown as { window?: unknown }).window
  await i18n.changeLanguage('en')
})

describe('fetchFingerprintStep (T0381 / BUG-090)', () => {
  it('is the same step in the WSL, SSH and Docker flows', () => {
    for (const steps of [buildWslWizardSteps(), buildSshWizardSteps(), buildDockerWizardSteps()]) {
      expect(steps).toContain(fetchFingerprintStep)
    }
  })

  it('stores the fingerprint from a successful IPC result', async () => {
    const ipc = vi.fn(async () => ({ ok: true, fingerprint: FP }))
    installIpc(ipc)
    const ctx = makeCtx({ serverPort: 51820 })

    await fetchFingerprintStep.run(ctx)

    expect(ctx.fingerprint).toBe(FP)
    expect(ipc).toHaveBeenCalledWith(51820)
  })

  it('skips without calling IPC when the service is known to be down', async () => {
    const ipc = vi.fn()
    installIpc(ipc)
    const ctx = makeCtx({ systemdServiceActive: false })

    await fetchFingerprintStep.run(ctx)

    expect(ctx.fingerprint).toBeNull()
    expect(ipc).not.toHaveBeenCalled()
  })

  it.each(['fingerprint-timeout', 'fingerprint-handshake-failed', 'fingerprint-invalid-port'])(
    'fails once with code=%s (no retry loop)',
    async (errorCode) => {
      const ipc = vi.fn(async () => ({ ok: false, errorCode, error: `raw ${errorCode}` }))
      installIpc(ipc)

      const error = await runCatching(makeCtx())

      expect(error?.code).toBe(errorCode)
      expect(error?.message).toBe(`raw ${errorCode}`)
      expect(ipc).toHaveBeenCalledTimes(1)
    },
  )

  it('retries fingerprint-unreachable a bounded number of times, then fails with that code', async () => {
    vi.useFakeTimers()
    const ipc = vi.fn(async () => ({ ok: false, errorCode: 'fingerprint-unreachable', error: 'refused' }))
    installIpc(ipc)

    const pending = runCatching(makeCtx())
    await vi.runAllTimersAsync()
    const error = await pending

    expect(error?.code).toBe('fingerprint-unreachable')
    expect(ipc).toHaveBeenCalledTimes(5)
  })

  it('recovers when the server starts listening during the retry window', async () => {
    vi.useFakeTimers()
    const ipc = vi.fn()
      .mockResolvedValueOnce({ ok: false, errorCode: 'fingerprint-unreachable', error: 'refused' })
      .mockResolvedValueOnce({ ok: true, fingerprint: FP })
    installIpc(ipc)
    const ctx = makeCtx()

    const pending = fetchFingerprintStep.run(ctx)
    await vi.runAllTimersAsync()
    await pending

    expect(ctx.fingerprint).toBe(FP)
    expect(ipc).toHaveBeenCalledTimes(2)
  })
})

describe('fingerprint error mapping (T0381 / BUG-090)', () => {
  it('i18n title/body exist in en / zh-TW / zh-CN', () => {
    for (const locale of [en, zhTW, zhCN] as Array<typeof en>) {
      for (const [, key] of CODES) {
        const entry = locale.wizard.shared.error[key]
        expect(entry.title.length).toBeGreaterThan(0)
        expect(entry.body.length).toBeGreaterThan(0)
      }
    }
  })

  it.each(CODES)('maps %s at stage 1 on every platform', async (errorCode, key) => {
    await i18n.changeLanguage('en')
    for (const platform of ['wsl', 'ssh', 'docker'] as const) {
      const mapped = resolveWizardError(
        { platform, stepId: 'fetch-fingerprint', errorCode, error: new Error('raw detail') },
        DEFAULT_WIZARD_ERROR_REGISTRY,
      )
      expect(mapped.matchId).toBe(errorCode)
      expect(mapped.title).toBe(en.wizard.shared.error[key].title)
      expect(mapped.rawError).toBe('raw detail')
    }
  })
})
