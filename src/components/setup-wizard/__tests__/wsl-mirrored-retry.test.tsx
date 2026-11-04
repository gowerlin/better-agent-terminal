/**
 * T0841 (PLAN-043 W4, P-5): "Switch to Mirrored and retry" after connect-test
 * failed under NAT.
 *  - when it is offered (pure `wslMirroredRetryOffer`): NAT only; never with a
 *    WSL networking policy, a non-mirrored mode the user declared, a .wslconfig
 *    BAT cannot parse, Windows / WSL too old — those get a hint only
 *  - the consent box (one optional item, unchecked, every Running distro listed)
 *  - apply through IPC (mocked: no `wsl --shutdown` ever runs here), changes
 *    recorded, then connect-test runs again with a longer wait
 *  - error screen entries, the Shell action, i18n in all three locales
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import i18n from '../../../i18n'
import en from '../../../locales/en.json'
import zhTW from '../../../locales/zh-TW.json'
import zhCN from '../../../locales/zh-CN.json'
import { SetupWizardShell } from '../SetupWizardShell'
import { WIZARD_STEP_ABORTED_MESSAGE, type WizardConsentRequest, type WizardContext } from '../wizard-runner'
import { DEFAULT_WIZARD_ERROR_REGISTRY, resolveWizardError } from '../error-mapper'
import { WizardConsentChecklist } from '../WizardConsentChecklist'
import {
  MIRRORED_CONNECT_ATTEMPTS,
  WSL_MIRRORED_RETRY_ERROR_KEY,
  WSL_MIRRORED_RETRY_REQUEST_KEY,
  buildMirroredConsentRequest,
  connectTestStep,
  requestWslMirroredRetry,
} from '../steps/wsl/connect-test'
import { readWslAppliedChanges } from '../steps/wsl/apply-wsl-environment'
import {
  WSL_MIRRORED_MIN_WINDOWS_BUILD,
  wslMirroredRetryOffer,
  type WslEnvApplyResult,
  type WslFacts,
} from '../wsl-env-plan'

const CONFIG = 'C:\\Users\\alice\\.wslconfig'
const BACKUP = `${CONFIG}.bat-backup-20261104-130000`

function facts(overrides: Partial<WslFacts> = {}): WslFacts {
  return {
    v: 1,
    platform: 'win32',
    windowsBuild: 26100,
    wslInstalled: true,
    version: { available: true, wsl: '2.7.14.0' },
    distros: [{ name: 'Ubuntu', version: 2, state: 'Running' }, { name: 'Debian', version: 2, state: 'Running' }],
    defaultDistro: 'Ubuntu',
    running: ['Ubuntu', 'Debian'],
    selected: null,
    policy: { status: 'absent', values: {}, allowWsl: null, allowWsl1: null, allowInboxWsl: null, allowNetworkingModeUserSetting: null, defaultNetworkingMode: null },
    wslConfig: { status: 'missing', encoding: null, networkingMode: null, instanceIdleTimeout: null },
    timedOut: false,
    durationMs: 1,
    ...overrides,
  }
}

const policy = (overrides: Partial<WslFacts['policy']>): WslFacts['policy'] => ({
  status: 'present', values: {}, allowWsl: null, allowWsl1: null, allowInboxWsl: null, allowNetworkingModeUserSetting: null, defaultNetworkingMode: null, ...overrides,
})
const wslConfig = (overrides: Partial<WslFacts['wslConfig']>): WslFacts['wslConfig'] => ({
  status: 'ok', encoding: 'utf8', networkingMode: null, instanceIdleTimeout: null, ...overrides,
})

const APPLIED: WslEnvApplyResult = {
  ok: true,
  outcome: 'applied',
  terminated: true,
  changes: [{ item: 'network-mirrored', kind: 'file', path: CONFIG, backupPath: BACKUP }],
}

let testConnection: ReturnType<typeof vi.fn>
let detectFacts: ReturnType<typeof vi.fn>
let applyNetworkMirrored: ReturnType<typeof vi.fn>

function installApi(extra: Record<string, unknown> = {}) {
  ;(window as unknown as { electronAPI: unknown }).electronAPI = {
    platform: 'win32',
    remote: { testConnection },
    wsl: { detectFacts, applyNetworkMirrored, ...extra },
    wizard: { abortOperation: vi.fn().mockResolvedValue({ ok: true, found: true }) },
    debug: { log: vi.fn() },
  }
}

function makeCtx(overrides: Partial<WizardContext> = {}): WizardContext {
  return {
    targetOS: 'wsl-linux',
    profileDraft: { name: 'mirrored' },
    warnings: [],
    state: {},
    logger: { info: () => undefined, warn: () => undefined, error: () => undefined },
    wslDistro: 'Ubuntu',
    serverPort: 9877,
    fingerprint: 'AB:CD',
    remoteToken: 'tok',
    networkMode: 'nat',
    ...overrides,
  }
}

async function runStep(ctx: WizardContext): Promise<(Error & { code?: string }) | null> {
  vi.useFakeTimers()
  const pending = connectTestStep.run(ctx).then(() => null, (error: Error) => error)
  await vi.runAllTimersAsync()
  const result = await pending
  vi.useRealTimers()
  return result as (Error & { code?: string }) | null
}

beforeEach(async () => {
  await i18n.changeLanguage('en')
  testConnection = vi.fn(async () => ({ ok: false, error: 'ECONNREFUSED' }))
  detectFacts = vi.fn(async () => facts())
  applyNetworkMirrored = vi.fn(async () => APPLIED)
  installApi()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('wslMirroredRetryOffer() (T0841)', () => {
  it('NAT with nothing in the way → offered, with every Running distro', () => {
    expect(wslMirroredRetryOffer('nat', facts())).toEqual({ offer: true, running: ['Ubuntu', 'Debian'], declaredMirrored: false })
  })

  it.each(['mirrored', 'unknown', 'none', 'consomme', null, undefined])('actual mode %s → not offered, no hint', (mode) => {
    expect(wslMirroredRetryOffer(mode, facts())).toEqual({ offer: false, reason: 'not-nat', hintKey: null })
  })

  it('not on Windows → not offered', () => {
    expect(wslMirroredRetryOffer('nat', facts({ platform: 'linux' }))).toMatchObject({ offer: false, reason: 'not-nat' })
  })

  it.each([
    ['AllowNetworkingModeUserSetting=0', policy({ allowNetworkingModeUserSetting: false })],
    ['DefaultNetworkingMode=1 (NAT)', policy({ defaultNetworkingMode: 1 })],
    ['DefaultNetworkingMode=3 (Mirrored)', policy({ defaultNetworkingMode: 3 })],
  ])('policy %s → hint only', (_name, p) => {
    expect(wslMirroredRetryOffer('nat', facts({ policy: p }))).toEqual({ offer: false, reason: 'policy', hintKey: 'wizard.wsl.mirrored.hint.policy' })
  })

  it('policy key present without networking values → offered', () => {
    expect(wslMirroredRetryOffer('nat', facts({ policy: policy({ allowWsl: true }) })).offer).toBe(true)
  })

  it('policy unreadable → hint only', () => {
    expect(wslMirroredRetryOffer('nat', facts({ policy: policy({ status: 'unknown' }) }))).toMatchObject({ offer: false, reason: 'policy-unknown' })
  })

  it.each(['nat', 'none', 'consomme', 'virtioproxy', 'unknown'] as const)('user declared networkingMode=%s → hint with the mode', (mode) => {
    expect(wslMirroredRetryOffer('nat', facts({ wslConfig: wslConfig({ networkingMode: mode }) }))).toEqual({
      offer: false, reason: 'declared', hintKey: 'wizard.wsl.mirrored.hint.declared', params: { mode },
    })
  })

  it('declared mirrored but still NAT → offered (shutdown applies it)', () => {
    expect(wslMirroredRetryOffer('nat', facts({ wslConfig: wslConfig({ networkingMode: 'mirrored' }) }))).toMatchObject({ offer: true, declaredMirrored: true })
  })

  it.each(['unreadable', 'invalid-encoding', 'unparsable'] as const)('.wslconfig %s → hint only', (status) => {
    expect(wslMirroredRetryOffer('nat', facts({ wslConfig: wslConfig({ status }) }))).toMatchObject({ offer: false, reason: 'wslconfig-unreadable' })
  })

  it('Windows too old / WSL too old → hint only; unknown build is not "too old"', () => {
    expect(wslMirroredRetryOffer('nat', facts({ windowsBuild: WSL_MIRRORED_MIN_WINDOWS_BUILD - 1 }))).toMatchObject({ reason: 'windows-unsupported' })
    expect(wslMirroredRetryOffer('nat', facts({ windowsBuild: WSL_MIRRORED_MIN_WINDOWS_BUILD })).offer).toBe(true)
    expect(wslMirroredRetryOffer('nat', facts({ windowsBuild: null })).offer).toBe(true)
    expect(wslMirroredRetryOffer('nat', facts({ version: { available: false, wsl: null } }))).toMatchObject({ reason: 'wsl-too-old' })
  })

  it('policy wins over a declared mode (checked first)', () => {
    expect(wslMirroredRetryOffer('nat', facts({ policy: policy({ defaultNetworkingMode: 1 }), wslConfig: wslConfig({ networkingMode: 'nat' }) })))
      .toMatchObject({ offer: false, reason: 'policy' })
  })
})

describe('connect-test failure under NAT (T0841)', () => {
  it('offered → wsl-connect-test-failed-nat (raw error kept), the NAT warning, no change made', async () => {
    const ctx = makeCtx()
    const error = await runStep(ctx)
    expect(error?.code).toBe('wsl-connect-test-failed-nat')
    expect(error?.message).toBe('ECONNREFUSED')
    expect(ctx.warnings).toEqual([en.wizard.wsl.warning.connectFailedNat])
    expect(ctx.state[WSL_MIRRORED_RETRY_ERROR_KEY]).toBe('ECONNREFUSED')
    expect(detectFacts).toHaveBeenCalledWith('Ubuntu')
    expect(applyNetworkMirrored).not.toHaveBeenCalled()
  })

  it('policy → connect-test-failed as before plus a hint line; never offered', async () => {
    detectFacts.mockResolvedValue(facts({ policy: policy({ allowNetworkingModeUserSetting: false }) }))
    const ctx = makeCtx()
    const error = await runStep(ctx)
    expect(error?.code).toBe('connect-test-failed')
    expect(ctx.warnings).toEqual([en.wizard.wsl.warning.connectFailedNat, en.wizard.wsl.mirrored.hint.policy])
  })

  it('user declared nat → connect-test-failed plus the "declared" hint', async () => {
    detectFacts.mockResolvedValue(facts({ wslConfig: wslConfig({ networkingMode: 'nat' }) }))
    const ctx = makeCtx()
    const error = await runStep(ctx)
    expect(error?.code).toBe('connect-test-failed')
    expect(ctx.warnings[1]).toBe(i18n.t('wizard.wsl.mirrored.hint.declared', { mode: 'nat' }))
  })

  it('probe fails / old preload → connect-test-failed exactly as before', async () => {
    detectFacts.mockRejectedValue(new Error('wsl.exe timed out'))
    const ctx = makeCtx()
    expect((await runStep(ctx))?.code).toBe('connect-test-failed')
    expect(ctx.warnings).toEqual([en.wizard.wsl.warning.connectFailedNat])

    installApi({ detectFacts: undefined })
    const old = makeCtx()
    expect((await runStep(old))?.code).toBe('connect-test-failed')
  })

  it('mirrored failure or SSH / Docker target → never checks facts (no new behaviour)', async () => {
    for (const ctx of [makeCtx({ networkMode: 'mirrored' }), makeCtx({ targetOS: 'ssh-linux', wslDistro: undefined }), makeCtx({ targetOS: 'docker-linux', wslDistro: undefined, networkMode: undefined })]) {
      expect((await runStep(ctx))?.code).toBe('connect-test-failed')
    }
    expect(detectFacts).not.toHaveBeenCalled()
  })

  it('NAT that connects → nothing checked, nothing offered', async () => {
    testConnection.mockResolvedValue({ ok: true, metadata: null })
    const ctx = makeCtx()
    expect(await runStep(ctx)).toBeNull()
    expect(detectFacts).not.toHaveBeenCalled()
    expect(ctx.warnings).toEqual([])
  })
})

describe('the consent box (T0841)', () => {
  it('one optional item, unchecked, user scope, shuts down every distro, lists Running distros', () => {
    const request = buildMirroredConsentRequest('Ubuntu', ['Ubuntu', 'Debian'], false)
    expect(request).toMatchObject({
      stepId: 'connect-test',
      runningDistros: ['Ubuntu', 'Debian'],
      confirmKey: 'wizard.wsl.mirrored.confirm',
      declineKey: 'wizard.wsl.mirrored.decline',
      params: { distro: 'Ubuntu' },
    })
    expect(request.items).toEqual([{
      id: 'network-mirrored',
      labelKey: 'wizard.wsl.mirrored.item.label',
      detailKey: 'wizard.wsl.mirrored.item.detail',
      scope: 'user',
      effects: ['shutdown-all-distros'],
      required: false,
      defaultChecked: false,
    }])
    expect(buildMirroredConsentRequest('Ubuntu', [], true).items[0].detailKey).toBe('wizard.wsl.mirrored.item.detailDeclared')
  })

  it('renders with the T0840 checklist: scope tag, shutdown warning, summary with the Running distros', () => {
    const onSubmit = vi.fn()
    render(<WizardConsentChecklist request={buildMirroredConsentRequest('Ubuntu', ['Ubuntu', 'Debian'], false)} regionId="r" onSubmit={onSubmit} />)
    const box = screen.getByRole('checkbox', { name: new RegExp(en.wizard.wsl.mirrored.item.label) }) as HTMLInputElement
    expect(box.checked).toBe(false)
    expect(screen.getByText(en.wizard.wsl.plan.scope.user)).toBeTruthy()
    expect(screen.getByText(en.wizard.wsl.plan.tag.optional)).toBeTruthy()
    expect(screen.queryByTestId('wizard-consent-summary')).toBeNull()
    fireEvent.click(box)
    expect(screen.getByTestId('wizard-consent-summary')).toHaveTextContent(en.wizard.wsl.plan.summaryShutdownAll)
    expect(screen.getByTestId('wizard-consent-summary')).toHaveTextContent('Ubuntu, Debian')
    expect(screen.getByTestId('wizard-consent-confirm')).toHaveTextContent(en.wizard.wsl.mirrored.confirm)
    fireEvent.click(screen.getByTestId('wizard-consent-confirm'))
    expect(onSubmit).toHaveBeenLastCalledWith(['network-mirrored'])
    fireEvent.click(screen.getByTestId('wizard-consent-decline'))
    expect(onSubmit).toHaveBeenLastCalledWith([])
  })

  it('T0840 checklists keep their single confirm button', () => {
    render(<WizardConsentChecklist request={{ stepId: 'p', titleKey: 'wizard.wsl.plan.title', items: [], params: { distro: 'U' } }} regionId="r" onSubmit={() => undefined} />)
    expect(screen.getByTestId('wizard-consent-confirm')).toHaveTextContent(en.wizard.wsl.plan.confirm)
    expect(screen.queryByTestId('wizard-consent-decline')).toBeNull()
  })
})

describe('retry with Mirrored (T0841)', () => {
  function retryCtx(answer: string[] | null, overrides: Partial<WizardContext> = {}) {
    const requests: WizardConsentRequest[] = []
    const marks: Array<string | null> = []
    const ctx = makeCtx({
      requestConsent: async (request) => {
        requests.push(request)
        return answer
      },
      setUninterruptible: (key) => { marks.push(key) },
      ...overrides,
    })
    ctx.state[WSL_MIRRORED_RETRY_ERROR_KEY] = 'ECONNREFUSED'
    requestWslMirroredRetry(ctx.state)
    return { ctx, requests, marks }
  }

  it('consent → apply (uninterruptible meanwhile) → change recorded → longer connection test succeeds', async () => {
    testConnection
      .mockResolvedValueOnce({ ok: false, error: 'ECONNREFUSED' })
      .mockResolvedValueOnce({ ok: false, error: 'ECONNREFUSED' })
      .mockResolvedValue({ ok: true, metadata: null })
    const { ctx, requests, marks } = retryCtx(['network-mirrored'])
    expect(await runStep(ctx)).toBeNull()
    expect(ctx.state[WSL_MIRRORED_RETRY_REQUEST_KEY]).toBeUndefined()
    expect(requests).toHaveLength(1)
    expect(requests[0].runningDistros).toEqual(['Ubuntu', 'Debian'])
    expect(applyNetworkMirrored).toHaveBeenCalledTimes(1)
    expect(applyNetworkMirrored.mock.calls[0][0]).toBe('Ubuntu')
    expect(marks).toEqual(['wizard.wsl.mirrored.uninterruptible', null])
    expect(readWslAppliedChanges(ctx.state)).toEqual([{ ...APPLIED.changes[0], distro: 'Ubuntu' }])
    expect(ctx.networkMode).toBe('mirrored')
    expect(testConnection).toHaveBeenCalledTimes(3)
    expect(ctx.connectTestSkipped).toBe(false)
  })

  it('after the switch the test waits longer before giving up, then fails as a normal failure', async () => {
    const { ctx } = retryCtx(['network-mirrored'])
    const error = await runStep(ctx)
    expect(testConnection).toHaveBeenCalledTimes(MIRRORED_CONNECT_ATTEMPTS)
    expect(error?.code).toBe('connect-test-failed')
  })

  it('declined → nothing applied, same NAT error (and offer) again, no connection attempt', async () => {
    for (const answer of [[], null]) {
      applyNetworkMirrored.mockClear()
      testConnection.mockClear()
      const { ctx } = retryCtx(answer)
      const error = await runStep(ctx)
      expect(error?.code).toBe('wsl-connect-test-failed-nat')
      expect(error?.message).toBe('ECONNREFUSED')
      expect(applyNetworkMirrored).not.toHaveBeenCalled()
      expect(testConnection).not.toHaveBeenCalled()
    }
  })

  it('re-detects before asking: a policy that appeared meanwhile → hint, no consent, no change', async () => {
    detectFacts.mockResolvedValue(facts({ policy: policy({ defaultNetworkingMode: 1 }) }))
    const { ctx, requests } = retryCtx(['network-mirrored'])
    const error = await runStep(ctx)
    expect(error?.code).toBe('connect-test-failed')
    expect(requests).toHaveLength(0)
    expect(applyNetworkMirrored).not.toHaveBeenCalled()
    expect(ctx.warnings).toContain(en.wizard.wsl.mirrored.hint.policy)
  })

  it.each([
    ['wsl-network-mode-policy', 'wsl-network-mode-policy'],
    ['wsl-network-mode-declared', 'wsl-network-mode-declared'],
    ['wsl-shutdown-failed', 'wsl-shutdown-failed'],
    ['wsl-network-mode-not-applied', 'wsl-network-mode-not-applied'],
    ['wsl-env-apply-invalid', 'wsl-wslconfig-write-failed'],
  ] as const)('apply fails with %s → step error %s, changes made so far still recorded', async (errorCode, expected) => {
    applyNetworkMirrored.mockResolvedValue({ ok: false, errorCode, error: 'boom', changes: APPLIED.changes, terminated: true })
    const { ctx, marks } = retryCtx(['network-mirrored'])
    const error = await runStep(ctx)
    expect(error?.code).toBe(expected)
    expect(readWslAppliedChanges(ctx.state)).toHaveLength(1)
    expect(marks).toEqual(['wizard.wsl.mirrored.uninterruptible', null])
    expect(testConnection).not.toHaveBeenCalled()
  })

  it('apply aborted → the wizard abort error', async () => {
    applyNetworkMirrored.mockResolvedValue({ ok: false, errorCode: 'wsl-shutdown-failed', error: 'Aborted.', changes: [], terminated: false, aborted: true })
    const { ctx } = retryCtx(['network-mirrored'])
    expect((await runStep(ctx))?.message).toBe(WIZARD_STEP_ABORTED_MESSAGE)
  })

  it('passes an operationId when the step has a signal (abortable before / after the shutdown)', async () => {
    testConnection.mockResolvedValue({ ok: true, metadata: null })
    const { ctx } = retryCtx(['network-mirrored'], { signal: new AbortController().signal })
    await runStep(ctx)
    expect(applyNetworkMirrored.mock.calls[0][1]).toEqual({ operationId: expect.any(String) })
  })
})

describe('error screens (T0841)', () => {
  const resolve = (code: string, platform: 'wsl' | 'ssh' = 'wsl') =>
    resolveWizardError({ platform, stepId: 'connect-test', errorCode: code, error: new Error('raw') }, DEFAULT_WIZARD_ERROR_REGISTRY)

  it('NAT failure offers "Switch to Mirrored and retry" first, then retry / skip / cancel', () => {
    const mapped = resolve('wsl-connect-test-failed-nat')
    expect(mapped.matchId).toBe('wsl-connect-test-failed-nat')
    expect(mapped.actions.map((a) => a.kind)).toEqual(['wsl-mirrored-retry', 'retry', 'skip', 'cancel'])
    expect(mapped.title).toBe(en.wizard.wsl.error.connectTestFailedNat.title)
  })

  it('apply failures map to one entry with retry / skip / cancel', () => {
    for (const code of ['wsl-network-mode-policy', 'wsl-network-mode-declared', 'wsl-wslconfig-write-failed', 'wsl-shutdown-failed', 'wsl-network-mode-not-applied']) {
      const mapped = resolve(code)
      expect(mapped.matchId).toBe('wsl-mirrored-retry-failed')
      expect(mapped.actions.map((a) => a.kind)).toEqual(['retry', 'skip', 'cancel'])
      expect(mapped.rawError).toBe('raw')
    }
  })

  it('connect-test-failed is unchanged (SSH / Docker / WSL without the offer)', () => {
    for (const platform of ['wsl', 'ssh'] as const) {
      const mapped = resolve('connect-test-failed', platform)
      expect(mapped.matchId).toBe('connect-test-failed')
      expect(mapped.actions.map((a) => a.kind)).toEqual(['retry', 'skip', 'cancel'])
    }
  })
})

describe('<SetupWizardShell> "Switch to Mirrored and retry" (T0841)', () => {
  it('error screen → action → consent box → apply → connection test passes → changes listed', async () => {
    let switched = false
    applyNetworkMirrored.mockImplementation(async () => {
      switched = true
      return APPLIED
    })
    testConnection.mockImplementation(async () => (switched ? { ok: true, metadata: null } : { ok: false, error: 'ECONNREFUSED' }))
    render(<SetupWizardShell steps={[connectTestStep]} ctx={makeCtx()} />)

    const action = await screen.findByRole('button', { name: en.wizard.action.wslMirroredRetry }, { timeout: 5000 })
    expect(action.getAttribute('data-action-kind')).toBe('wsl-mirrored-retry')
    expect(applyNetworkMirrored).not.toHaveBeenCalled()
    fireEvent.click(action)

    const box = await screen.findByRole('checkbox', { name: new RegExp(en.wizard.wsl.mirrored.item.label) })
    fireEvent.click(box)
    expect(screen.getByTestId('wizard-consent-summary')).toHaveTextContent('Ubuntu, Debian')
    fireEvent.click(screen.getByTestId('wizard-consent-confirm'))

    const changes = await screen.findByTestId('wizard-wsl-applied-changes')
    expect(changes).toHaveTextContent(BACKUP)
    expect(changes).toHaveTextContent(i18n.t('wizard.wsl.apply.changes.wslconfig', { path: CONFIG }))
    await waitFor(() => expect(screen.getByText(i18n.t('wizard.progress.complete'))).toBeTruthy())
    expect(applyNetworkMirrored).toHaveBeenCalledTimes(1)
  }, 15_000)

  it('declining in the consent box changes nothing and shows the same error screen again', async () => {
    render(<SetupWizardShell steps={[connectTestStep]} ctx={makeCtx()} />)
    fireEvent.click(await screen.findByRole('button', { name: en.wizard.action.wslMirroredRetry }, { timeout: 5000 }))
    fireEvent.click(await screen.findByTestId('wizard-consent-decline'))
    expect(await screen.findByRole('button', { name: en.wizard.action.wslMirroredRetry })).toBeTruthy()
    expect(applyNetworkMirrored).not.toHaveBeenCalled()
  }, 15_000)
})

describe('i18n (T0841)', () => {
  const KEYS = [
    'wizard.action.wslMirroredRetry',
    'wizard.wsl.error.connectTestFailedNat.title',
    'wizard.wsl.error.connectTestFailedNat.body',
    'wizard.wsl.error.mirroredFailed.title',
    'wizard.wsl.error.mirroredFailed.body',
    'wizard.wsl.apply.changes.wslconfig',
    'wizard.wsl.mirrored.title',
    'wizard.wsl.mirrored.description',
    'wizard.wsl.mirrored.confirm',
    'wizard.wsl.mirrored.decline',
    'wizard.wsl.mirrored.uninterruptible',
    'wizard.wsl.mirrored.item.label',
    'wizard.wsl.mirrored.item.detail',
    'wizard.wsl.mirrored.item.detailDeclared',
    'wizard.wsl.mirrored.hint.policy',
    'wizard.wsl.mirrored.hint.policyUnknown',
    'wizard.wsl.mirrored.hint.declared',
    'wizard.wsl.mirrored.hint.wslconfigUnreadable',
    'wizard.wsl.mirrored.hint.windowsUnsupported',
    'wizard.wsl.mirrored.hint.wslTooOld',
  ]
  const get = (locale: unknown, key: string) => key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], locale)
  const placeholders = (text: string) => [...text.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort()

  it.each([['en', en], ['zh-TW', zhTW], ['zh-CN', zhCN]] as const)('%s has every key; zh keeps the placeholders and is translated', (name, locale) => {
    for (const key of KEYS) {
      const value = get(locale, key)
      expect(value, `${name} missing ${key}`).toBeTypeOf('string')
      expect(placeholders(value as string)).toEqual(placeholders(get(en, key) as string))
      if (name !== 'en') expect(value).not.toBe(get(en, key))
    }
  })

  it('every hint key the offer can return exists', () => {
    const reasons: Array<Partial<WslFacts>> = [
      { policy: policy({ allowNetworkingModeUserSetting: false }) },
      { policy: policy({ status: 'unknown' }) },
      { wslConfig: wslConfig({ networkingMode: 'nat' }) },
      { wslConfig: wslConfig({ status: 'unparsable' }) },
      { windowsBuild: 19045 },
      { version: { available: false, wsl: null } },
    ]
    for (const overrides of reasons) {
      const offer = wslMirroredRetryOffer('nat', facts(overrides))
      expect(offer.offer).toBe(false)
      if (!offer.offer) expect(KEYS).toContain(offer.hintKey)
    }
  })
})
