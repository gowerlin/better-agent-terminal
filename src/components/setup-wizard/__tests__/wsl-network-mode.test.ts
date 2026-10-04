/**
 * T0383 (BUG-089): the WSL networking warning is chosen from the actual mode
 * (`wslinfo --networking-mode`) and the declared one (`.wslconfig`), goes
 * through i18n, and NAT is never treated as something the user must change.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from '../../../i18n'
import en from '../../../locales/en.json'
import zhTW from '../../../locales/zh-TW.json'
import zhCN from '../../../locales/zh-CN.json'
import type { WizardContext } from '../wizard-runner'
import { installServerBundleStep, selectNetworkModeWarning } from '../steps/wsl/install-server-bundle'
import { connectTestStep } from '../steps/wsl/connect-test'

type Info = Parameters<typeof selectNetworkModeWarning>[0]

const info = (actual: Info['actual'], declared: Info['declared'] = null, mirroredSupported: boolean | null = null): Info =>
  ({ actual, declared, mirroredSupported })

let detectNetworkModeMock: ReturnType<typeof vi.fn>
let testConnectionMock: ReturnType<typeof vi.fn>

function makeCtx(overrides: Partial<WizardContext> = {}): WizardContext {
  return {
    targetOS: 'wsl-linux',
    profileDraft: { name: 'net' },
    warnings: [],
    state: {},
    logger: { info: () => undefined, warn: () => undefined, error: () => undefined },
    wslDistro: 'Ubuntu-24.04',
    serverPort: 9877,
    ...overrides,
  }
}

beforeEach(async () => {
  await i18n.changeLanguage('en')
  detectNetworkModeMock = vi.fn(async () => info('mirrored', 'mirrored', true))
  testConnectionMock = vi.fn(async () => ({ ok: true, metadata: null }))
  ;(globalThis as unknown as { window: unknown }).window = {
    electronAPI: {
      update: { getVersion: vi.fn(async () => '0.5.9') },
      remote: {
        serverBundle: {
          distribute: vi.fn(async () => ({ ok: true, tarballPath: 'C:\\cache\\bat-server.tar.gz', source: 'cache' })),
          onDistributeProgress: vi.fn(() => () => undefined),
        },
        testConnection: testConnectionMock,
      },
      wsl: {
        resolveHome: vi.fn(async () => '/home/gower'),
        installBundle: vi.fn(async () => ({ ok: true })),
        uninstallBundle: vi.fn(async () => ({ ok: true })),
        detectNetworkMode: detectNetworkModeMock,
      },
    },
  }
})

afterEach(async () => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  delete (globalThis as unknown as { window?: unknown }).window
  await i18n.changeLanguage('en')
})

describe('selectNetworkModeWarning() (T0383 / BUG-089)', () => {
  it('stays quiet for mirrored, whatever was declared', () => {
    expect(selectNetworkModeWarning(info('mirrored'))).toBeNull()
    expect(selectNetworkModeWarning(info('mirrored', 'mirrored', true))).toBeNull()
    expect(selectNetworkModeWarning(info('mirrored', 'nat'))).toBeNull()
  })

  it('stays quiet for unknown (old WSL / probe failure)', () => {
    expect(selectNetworkModeWarning(info('unknown'))).toBeNull()
    expect(selectNetworkModeWarning(info('unknown', 'mirrored', true))).toBeNull()
  })

  it('nat without a mirrored declaration is informational', () => {
    expect(selectNetworkModeWarning(info('nat'))?.key).toBe('wizard.wsl.warning.networkNat')
    expect(selectNetworkModeWarning(info('nat', 'nat', true))?.key).toBe('wizard.wsl.warning.networkNat')
    expect(selectNetworkModeWarning(info('nat', 'unknown', true))?.key).toBe('wizard.wsl.warning.networkNat')
  })

  it('declared mirrored but actual nat: restart, unsupported Windows, or both', () => {
    expect(selectNetworkModeWarning(info('nat', 'mirrored', true))?.key).toBe('wizard.wsl.warning.networkMirroredPendingRestart')
    expect(selectNetworkModeWarning(info('nat', 'mirrored', false))?.key).toBe('wizard.wsl.warning.networkMirroredUnsupported')
    expect(selectNetworkModeWarning(info('nat', 'mirrored', null))?.key).toBe('wizard.wsl.warning.networkMirroredNotApplied')
  })

  it('other modes are flagged as unverified with the mode name', () => {
    expect(selectNetworkModeWarning(info('virtioproxy'))).toEqual({ key: 'wizard.wsl.warning.networkUnverified', params: { mode: 'virtioproxy' } })
    expect(selectNetworkModeWarning(info('none', 'mirrored', true))).toEqual({ key: 'wizard.wsl.warning.networkUnverified', params: { mode: 'none' } })
  })

  it('every warning key exists in en / zh-TW / zh-CN', () => {
    const keys = Object.keys(en.wizard.wsl.warning)
    expect(keys.sort()).toEqual([
      'connectFailedNat',
      'networkMirroredNotApplied',
      'networkMirroredPendingRestart',
      'networkMirroredUnsupported',
      'networkNat',
      'networkUnverified',
    ])
    for (const locale of [zhTW, zhCN]) {
      expect(Object.keys(locale.wizard.wsl.warning).sort()).toEqual(keys)
      for (const key of keys) {
        expect((locale.wizard.wsl.warning as Record<string, string>)[key]).toBeTruthy()
      }
    }
    // the shutdown hint must say it stops every distro
    expect(en.wizard.wsl.warning.networkMirroredPendingRestart).toMatch(/wsl --shutdown/)
    expect(zhTW.wizard.wsl.warning.networkMirroredPendingRestart).toMatch(/所有/)
  })
})

describe('install-server-bundle networking warning (T0383 / BUG-089)', () => {
  it('BUG-089 machine: mirrored detected -> no warning (route heuristic gone)', async () => {
    const ctx = makeCtx()
    await installServerBundleStep.run(ctx)
    expect(detectNetworkModeMock).toHaveBeenCalledWith('Ubuntu-24.04')
    expect(ctx.networkMode).toBe('mirrored')
    expect(ctx.warnings).toEqual([])
  })

  it('nat -> translated informational warning that does not demand Mirrored', async () => {
    detectNetworkModeMock.mockResolvedValueOnce(info('nat', null, true))
    const ctx = makeCtx()
    await installServerBundleStep.run(ctx)
    expect(ctx.networkMode).toBe('nat')
    expect(ctx.warnings).toEqual([en.wizard.wsl.warning.networkNat])
  })

  it('uses the active language', async () => {
    await i18n.changeLanguage('zh-TW')
    detectNetworkModeMock.mockResolvedValueOnce(info('nat', 'mirrored', true))
    const ctx = makeCtx()
    await installServerBundleStep.run(ctx)
    expect(ctx.warnings).toEqual([zhTW.wizard.wsl.warning.networkMirroredPendingRestart])
  })

  it('interpolates the mode for unverified modes', async () => {
    detectNetworkModeMock.mockResolvedValueOnce(info('virtioproxy'))
    const ctx = makeCtx()
    await installServerBundleStep.run(ctx)
    expect(ctx.warnings).toHaveLength(1)
    expect(ctx.warnings[0]).toContain('"virtioproxy"')
  })

  it('a failed probe is unknown and silent', async () => {
    detectNetworkModeMock.mockRejectedValueOnce(new Error('ipc failed'))
    const ctx = makeCtx()
    await installServerBundleStep.run(ctx)
    expect(ctx.networkMode).toBe('unknown')
    expect(ctx.warnings).toEqual([])
  })

  it('a preset state.networkMode skips detection', async () => {
    const ctx = makeCtx({ state: { networkMode: 'nat' } })
    await installServerBundleStep.run(ctx)
    expect(detectNetworkModeMock).not.toHaveBeenCalled()
    expect(ctx.networkMode).toBe('nat')
    expect(ctx.warnings).toEqual([en.wizard.wsl.warning.networkNat])
  })
})

describe('connect-test NAT hint (T0383 / BUG-089)', () => {
  const ready = { fingerprint: 'AB:CD', remoteToken: 'tok' }

  it('does not warn up front when NAT connects fine', async () => {
    const ctx = makeCtx({ ...ready, networkMode: 'nat' })
    await connectTestStep.run(ctx)
    expect(ctx.warnings).toEqual([])
  })

  it('suggests Mirrored / distro IP only after localhost failed under NAT', async () => {
    vi.useFakeTimers()
    testConnectionMock.mockResolvedValue({ ok: false, error: 'ECONNREFUSED' })
    const ctx = makeCtx({ ...ready, networkMode: 'nat' })

    const pending = connectTestStep.run(ctx).catch((error: Error) => error)
    await vi.runAllTimersAsync()
    const error = await pending

    expect((error as Error).message).toBe('ECONNREFUSED')
    expect(ctx.warnings).toEqual([en.wizard.wsl.warning.connectFailedNat])
  })

  it('no NAT hint when the failure happens under mirrored', async () => {
    vi.useFakeTimers()
    testConnectionMock.mockResolvedValue({ ok: false, error: 'ECONNREFUSED' })
    const ctx = makeCtx({ ...ready, networkMode: 'mirrored' })

    const pending = connectTestStep.run(ctx).catch((error: Error) => error)
    await vi.runAllTimersAsync()
    await pending

    expect(ctx.warnings).toEqual([])
  })
})
