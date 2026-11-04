/**
 * T0840 (PLAN-043 W3): "detect → list → consent once → apply".
 *  - runner `requestConsent` (wrapped like requestChoice, T0330) and the
 *    `setUninterruptible` marker
 *  - plan-wsl-environment / apply-wsl-environment / wsl-systemd-check
 *  - the checklist and the applied-changes box (RTL)
 *  - no regression: 0 items → no checklist; SSH / Docker flows have no new step
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import i18n from '../../../i18n'
import { SetupWizardShell } from '../SetupWizardShell'
import {
  WizardRunner,
  WizardStepStatus,
  WIZARD_CANCELLED_MESSAGE,
  type WizardConsentRequest,
  type WizardContext,
  type WizardStep,
} from '../wizard-runner'
import { WizardConsentChecklist } from '../WizardConsentChecklist'
import { planWslEnvironmentStep } from '../steps/wsl/plan-wsl-environment'
import { applyWslEnvironmentStep, readWslAppliedChanges } from '../steps/wsl/apply-wsl-environment'
import { wslSystemdCheckStep } from '../steps/wsl/wsl-systemd-check'
import { buildWslWizardSteps } from '../wsl-flow'
import { buildSshWizardSteps } from '../ssh-flow'
import { buildDockerWizardSteps } from '../docker-flow'
import { buildWslEnvPlan, type WslEnvApplyResult, type WslFacts, type WslSelectedDistroFacts } from '../wsl-env-plan'

function makeCtx(overrides: Partial<WizardContext> = {}): WizardContext {
  return {
    targetOS: 'wsl-linux',
    profileDraft: { name: 'test' },
    warnings: [],
    state: {},
    logger: { info: () => undefined, warn: () => undefined, error: () => undefined },
    ...overrides,
  }
}

function selected(overrides: Partial<WslSelectedDistroFacts> = {}): WslSelectedDistroFacts {
  return {
    name: 'Ubuntu',
    version: 2,
    state: 'Running',
    probe: 'ok',
    user: 'alice',
    uid: 1000,
    pid1: 'systemd',
    systemdRunning: true,
    wslConf: { status: 'ok', bootSystemd: 'true', userDefault: 'alice' },
    linger: true,
    ...overrides,
  }
}

function facts(overrides: Partial<WslFacts> = {}): WslFacts {
  return {
    v: 1,
    platform: 'win32',
    windowsBuild: 26100,
    wslInstalled: true,
    version: { available: true, wsl: '2.7.14.0' },
    distros: [{ name: 'Ubuntu', version: 2, state: 'Running' }],
    defaultDistro: 'Ubuntu',
    running: ['Ubuntu'],
    selected: selected(),
    policy: { status: 'absent', values: {}, allowWsl: null, allowWsl1: null, allowInboxWsl: null, allowNetworkingModeUserSetting: null, defaultNetworkingMode: null },
    wslConfig: { status: 'missing', encoding: null, networkingMode: null, instanceIdleTimeout: null },
    timedOut: false,
    durationMs: 1,
    ...overrides,
  }
}

const NEEDS_SYSTEMD = () => facts({ selected: selected({ pid1: 'init', systemdRunning: false, wslConf: { status: 'ok', bootSystemd: 'false', userDefault: null }, linger: false }) })
const WSL1 = () => facts({
  distros: [{ name: 'Ubuntu', version: 1, state: 'Stopped' }],
  running: [],
  selected: selected({ version: 1, state: 'Stopped', pid1: 'init', systemdRunning: false }),
})

function installApi(wsl: Record<string, unknown>) {
  ;(window as unknown as { electronAPI: unknown }).electronAPI = {
    platform: 'win32',
    wsl,
    wizard: { abortOperation: vi.fn().mockResolvedValue({ ok: true, found: true }) },
  }
}

async function thrown(run: () => Promise<unknown>): Promise<Error & { code?: string; params?: Record<string, unknown> }> {
  try {
    await run()
  } catch (error) {
    return error as Error & { code?: string }
  }
  throw new Error('expected a throw')
}

beforeEach(async () => {
  await i18n.changeLanguage('en')
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('WizardRunner requestConsent (T0840)', () => {
  it('input step: running → awaiting-input while the checklist is open → succeeded', async () => {
    const states: WizardStepStatus[] = []
    let resolve!: (ids: string[] | null) => void
    const requestConsent = vi.fn((_req: WizardConsentRequest) => new Promise<string[] | null>((r) => { resolve = r }))
    let got: string[] | null = null
    const step: WizardStep = {
      id: 'consent',
      title: 'consent',
      appliesTo: 'all',
      kind: 'input',
      async run(ctx) {
        got = await ctx.requestConsent!({ stepId: 'consent', titleKey: 't', items: [] })
      },
    }
    const runner = new WizardRunner([step], makeCtx({ requestConsent }), (s) => states.push(s[0].status))
    const run = runner.run()
    await waitFor(() => expect(states).toContain(WizardStepStatus.AwaitingInput))
    resolve(['a'])
    await run
    expect(got).toEqual(['a'])
    expect(states).toEqual([
      WizardStepStatus.Pending,
      WizardStepStatus.Running,
      WizardStepStatus.AwaitingInput,
      WizardStepStatus.Running,
      WizardStepStatus.Succeeded,
    ])
  })

  it('cancel() while the checklist is open rejects it and rolls back (T0830 abort)', async () => {
    const requestConsent = vi.fn(() => new Promise<string[] | null>(() => undefined))
    const rollback = vi.fn()
    const step: WizardStep = {
      id: 'consent',
      title: 'consent',
      appliesTo: 'all',
      kind: 'input',
      async run(ctx) {
        await ctx.requestConsent!({ stepId: 'consent', titleKey: 't', items: [] })
      },
      rollback,
    }
    const states: WizardStepStatus[] = []
    const runner = new WizardRunner([step], makeCtx({ requestConsent }), (s) => states.push(s[0].status))
    const run = runner.run()
    await waitFor(() => expect(states).toContain(WizardStepStatus.AwaitingInput))
    await runner.cancel()
    await expect(run).rejects.toThrow(WIZARD_CANCELLED_MESSAGE)
    expect(rollback).toHaveBeenCalledTimes(1)
  })

  it('setUninterruptible marks the snapshot and is cleared when the step ends', async () => {
    const seen: Array<string | undefined> = []
    let release!: () => void
    const step: WizardStep = {
      id: 'long',
      title: 'long',
      appliesTo: 'all',
      async run(ctx) {
        ctx.setUninterruptible?.('wizard.wsl.apply.uninterruptible.convert')
        await new Promise<void>((r) => { release = r })
      },
    }
    const ctx = makeCtx()
    const runner = new WizardRunner([step], ctx, (s) => seen.push(s[0].uninterruptibleKey))
    const run = runner.run()
    await waitFor(() => expect(seen).toContain('wizard.wsl.apply.uninterruptible.convert'))
    release()
    await run
    expect(runner.getSnapshots()[0].uninterruptibleKey).toBeUndefined()
    expect(ctx.setUninterruptible).toBeUndefined()
  })
})

describe('plan-wsl-environment (T0840)', () => {
  it('healthy environment: 0 items → no checklist, nothing approved, no warning', async () => {
    const detectFacts = vi.fn().mockResolvedValue(facts())
    installApi({ detectFacts })
    const requestConsent = vi.fn()
    const ctx = makeCtx({ wslDistro: 'Ubuntu', requestConsent })
    await planWslEnvironmentStep.run(ctx)
    expect(requestConsent).not.toHaveBeenCalled()
    expect(ctx.state.wslApprovedItems).toEqual([])
    expect(ctx.warnings).toEqual([])
    // No signal → called exactly as T0839 (distro only).
    expect(detectFacts).toHaveBeenCalledWith('Ubuntu')
  })

  it('with a signal the probe gets an operation id (abortable)', async () => {
    const detectFacts = vi.fn().mockResolvedValue(facts())
    installApi({ detectFacts })
    const ctx = makeCtx({ wslDistro: 'Ubuntu', signal: new AbortController().signal })
    await planWslEnvironmentStep.run(ctx)
    expect(detectFacts).toHaveBeenCalledWith('Ubuntu', { operationId: expect.any(String) })
  })

  it('systemd needed → asks once with the plan items, stores what was approved', async () => {
    installApi({ detectFacts: vi.fn().mockResolvedValue(NEEDS_SYSTEMD()) })
    const requestConsent = vi.fn(async (req: WizardConsentRequest) => {
      expect(req.items.map((i) => i.id)).toEqual(['enable-systemd', 'enable-linger'])
      expect(req.runningDistros).toEqual(['Ubuntu'])
      expect(req.params).toEqual({ distro: 'Ubuntu' })
      return ['enable-systemd']
    })
    const ctx = makeCtx({ wslDistro: 'Ubuntu', requestConsent })
    await planWslEnvironmentStep.run(ctx)
    expect(requestConsent).toHaveBeenCalledTimes(1)
    // Fixed linger is always included.
    expect(ctx.state.wslApprovedItems).toEqual(['enable-systemd', 'enable-linger'])
  })

  it('required item unchecked → wsl-env-required-declined', async () => {
    installApi({ detectFacts: vi.fn().mockResolvedValue(NEEDS_SYSTEMD()) })
    const ctx = makeCtx({ wslDistro: 'Ubuntu', requestConsent: async () => [] })
    const error = await thrown(() => planWslEnvironmentStep.run(ctx))
    expect(error.code).toBe('wsl-env-required-declined')
    expect(ctx.state.wslApprovedItems).toEqual([])
  })

  it('WSL 2 conversion unchecked → wsl-requires-wsl2 (the pre-T0840 error)', async () => {
    installApi({ detectFacts: vi.fn().mockResolvedValue(facts({ ...WSL1(), selected: { ...WSL1().selected!, wslConf: { status: 'ok', bootSystemd: 'true', userDefault: null } } })) })
    const error = await thrown(() => planWslEnvironmentStep.run(makeCtx({ wslDistro: 'Ubuntu', requestConsent: async () => [] })))
    expect(error.code).toBe('wsl-requires-wsl2')
  })

  it('required item that cannot be checked → wsl-env-item-unavailable, even if its id comes back', async () => {
    const unparsable = facts({ selected: selected({ pid1: 'init', systemdRunning: false, wslConf: { status: 'unparsable', bootSystemd: null, userDefault: null } }) })
    expect(buildWslEnvPlan(unparsable).items[0].disabledReasonKey).toBeDefined()
    installApi({ detectFacts: vi.fn().mockResolvedValue(unparsable) })
    const error = await thrown(() => planWslEnvironmentStep.run(makeCtx({ wslDistro: 'Ubuntu', requestConsent: async () => ['enable-systemd'] })))
    expect(error.code).toBe('wsl-env-item-unavailable')
  })

  it('WSL disabled by policy → wsl-policy-blocked, no checklist', async () => {
    const policy = facts({ policy: { ...facts().policy, status: 'present', allowWsl: false } })
    installApi({ detectFacts: vi.fn().mockResolvedValue(policy) })
    const requestConsent = vi.fn()
    const error = await thrown(() => planWslEnvironmentStep.run(makeCtx({ wslDistro: 'Ubuntu', requestConsent })))
    expect(error.code).toBe('wsl-policy-blocked')
    expect(requestConsent).not.toHaveBeenCalled()
  })

  it('P-3 root user / P-7 old WSL → warnings only, no items', async () => {
    installApi({ detectFacts: vi.fn().mockResolvedValue(facts({ version: { available: true, wsl: '1.2.5.0' }, selected: selected({ uid: 0, user: 'root' }) })) })
    const requestConsent = vi.fn()
    const ctx = makeCtx({ wslDistro: 'Ubuntu', requestConsent })
    await planWslEnvironmentStep.run(ctx)
    expect(requestConsent).not.toHaveBeenCalled()
    expect(ctx.warnings).toHaveLength(2)
    expect(ctx.warnings.join(' ')).toMatch(/root/)
    expect(ctx.warnings.join(' ')).toMatch(/1\.2\.5\.0/)
  })

  it('older preload without detectFacts → behaves as before T0840 (0 items)', async () => {
    installApi({})
    const ctx = makeCtx({ wslDistro: 'Ubuntu' })
    await planWslEnvironmentStep.run(ctx)
    expect(ctx.state.wslApprovedItems).toEqual([])
  })
})

describe('apply-wsl-environment (T0840)', () => {
  const ok = (outcome: 'applied' | 'already', changes: WslEnvApplyResult['changes'] = []): WslEnvApplyResult =>
    ({ ok: true, outcome, changes, terminated: outcome === 'applied' })

  it('nothing approved → no IPC call', async () => {
    const applyEnvItem = vi.fn()
    installApi({ applyEnvItem })
    await applyWslEnvironmentStep.run(makeCtx({ wslDistro: 'Ubuntu', state: { wslApprovedItems: [] } }))
    expect(applyEnvItem).not.toHaveBeenCalled()
  })

  it('applies conversion before systemd (linger is left to write-systemd-unit) and records the changes', async () => {
    const applyEnvItem = vi.fn(async (_d: string, item: string) =>
      item === 'wsl2-convert'
        ? ok('applied', [{ item: 'wsl2-convert', kind: 'wsl-version' }])
        : ok('applied', [{ item: 'enable-systemd', kind: 'file', path: '/etc/wsl.conf', backupPath: '/etc/wsl.conf.bat-backup-20261104-120000' }]))
    installApi({ applyEnvItem })
    const ctx = makeCtx({ wslDistro: 'Ubuntu', state: { wslApprovedItems: ['enable-linger', 'enable-systemd', 'wsl2-convert'] } })
    await applyWslEnvironmentStep.run(ctx)
    expect(applyEnvItem.mock.calls.map((c) => c[1])).toEqual(['wsl2-convert', 'enable-systemd'])
    expect(readWslAppliedChanges(ctx.state)).toEqual([
      { item: 'wsl2-convert', kind: 'wsl-version', distro: 'Ubuntu' },
      { item: 'enable-systemd', kind: 'file', path: '/etc/wsl.conf', backupPath: '/etc/wsl.conf.bat-backup-20261104-120000', distro: 'Ubuntu' },
    ])
  })

  it('marks the conversion uninterruptible while it runs', async () => {
    const marks: Array<string | null> = []
    const applyEnvItem = vi.fn(async () => ok('applied'))
    installApi({ applyEnvItem })
    const ctx = makeCtx({ wslDistro: 'Ubuntu', state: { wslApprovedItems: ['wsl2-convert'] }, setUninterruptible: (k) => marks.push(k) })
    await applyWslEnvironmentStep.run(ctx)
    expect(marks).toEqual(['wizard.wsl.apply.uninterruptible.convert', null])
  })

  it('required failure → coded error; changes made before the failure are kept', async () => {
    installApi({
      applyEnvItem: vi.fn(async () => ({
        ok: false, errorCode: 'wsl-systemd-enable-failed', error: 'still init', terminated: true,
        changes: [{ item: 'enable-systemd', kind: 'file', path: '/etc/wsl.conf', backupPath: null }],
      })),
    })
    const ctx = makeCtx({ wslDistro: 'Ubuntu', state: { wslApprovedItems: ['enable-systemd'], wslEnvPlan: buildWslEnvPlan(NEEDS_SYSTEMD()) } })
    const error = await thrown(() => applyWslEnvironmentStep.run(ctx))
    expect(error.code).toBe('wsl-systemd-enable-failed')
    expect(readWslAppliedChanges(ctx.state)).toHaveLength(1)
  })

  it('aborted result → abort error (the runner treats it as cancelled)', async () => {
    installApi({ applyEnvItem: vi.fn(async () => ({ ok: false, errorCode: 'wsl-systemd-enable-failed', error: 'Aborted.', changes: [], terminated: false, aborted: true })) })
    const error = await thrown(() => applyWslEnvironmentStep.run(makeCtx({ wslDistro: 'Ubuntu', state: { wslApprovedItems: ['enable-systemd'] } })))
    expect(error.name).toBe('AbortError')
  })

  it('rollback clears the approval but keeps the change list (D272: never undone)', async () => {
    const ctx = makeCtx({ state: { wslApprovedItems: ['enable-systemd'], wslAppliedChanges: [{ item: 'enable-systemd', kind: 'file', path: '/etc/wsl.conf', backupPath: null, distro: 'Ubuntu' }] } })
    await applyWslEnvironmentStep.rollback!(ctx)
    expect(ctx.state.wslApprovedItems).toBeUndefined()
    expect(readWslAppliedChanges(ctx.state)).toHaveLength(1)
  })
})

describe('wsl-systemd-check is a verification (T0840)', () => {
  it('systemd not PID 1 → wsl-systemd-disabled', async () => {
    installApi({ systemdRunning: vi.fn().mockResolvedValue(false), systemdEnabled: vi.fn() })
    const ctx = makeCtx({ wslDistro: 'Ubuntu' })
    const error = await thrown(() => wslSystemdCheckStep.run(ctx))
    expect(error.code).toBe('wsl-systemd-disabled')
    expect(ctx.wslSystemdEnabled).toBe(false)
  })

  it('running → passes; older preload falls back to systemdEnabled', async () => {
    installApi({ systemdRunning: vi.fn().mockResolvedValue(true) })
    const ctx = makeCtx({ wslDistro: 'Ubuntu' })
    await wslSystemdCheckStep.run(ctx)
    expect(ctx.wslSystemdEnabled).toBe(true)
    const systemdEnabled = vi.fn().mockResolvedValue(true)
    installApi({ systemdEnabled })
    await wslSystemdCheckStep.run(makeCtx({ wslDistro: 'Ubuntu' }))
    expect(systemdEnabled).toHaveBeenCalledWith('Ubuntu')
  })
})

describe('flows (T0840 no regression)', () => {
  it('WSL flow: the two new steps sit between pick-wsl-distro and wsl-systemd-check, WSL only', () => {
    const ids = buildWslWizardSteps().map((s) => s.id)
    expect(ids.slice(0, 5)).toEqual(['detect-env', 'pick-wsl-distro', 'plan-wsl-environment', 'apply-wsl-environment', 'wsl-systemd-check'])
    expect(planWslEnvironmentStep.appliesTo).toEqual(['wsl-linux'])
    expect(applyWslEnvironmentStep.appliesTo).toEqual(['wsl-linux'])
  })

  it('SSH and Docker flows have neither new step', () => {
    for (const ids of [buildSshWizardSteps().map((s) => s.id), buildDockerWizardSteps().map((s) => s.id)]) {
      expect(ids).not.toContain('plan-wsl-environment')
      expect(ids).not.toContain('apply-wsl-environment')
    }
  })
})

describe('<WizardConsentChecklist> (T0840)', () => {
  const plan = () => buildWslEnvPlan(facts({
    distros: [{ name: 'Ubuntu', version: 1, state: 'Running' }, { name: 'Debian', version: 2, state: 'Running' }],
    running: ['Ubuntu', 'Debian'],
    selected: selected({ version: 1, pid1: 'init', systemdRunning: false, wslConf: { status: 'missing', bootSystemd: null, userDefault: null }, linger: false }),
  }))

  it('lists every item with its scope and effects; defaults follow the plan; fixed items have a disabled checked box', () => {
    const items = plan().items
    expect(items.map((i) => i.id)).toEqual(['wsl2-convert', 'enable-systemd', 'enable-linger'])
    render(<WizardConsentChecklist request={{ stepId: 'p', titleKey: 'wizard.wsl.plan.title', items, params: { distro: 'Ubuntu' }, runningDistros: ['Ubuntu', 'Debian'] }} regionId="r" onSubmit={() => undefined} />)
    const convert = screen.getByRole('checkbox', { name: /Convert Ubuntu to WSL 2/ }) as HTMLInputElement
    const systemd = screen.getByRole('checkbox', { name: /Turn on systemd in Ubuntu/ }) as HTMLInputElement
    const linger = screen.getByRole('checkbox', { name: /linger/ }) as HTMLInputElement
    expect(convert.checked).toBe(false)
    expect(systemd.checked).toBe(true)
    expect(linger.checked).toBe(true)
    expect(linger.disabled).toBe(true)
    expect(screen.getAllByText(i18n.t('wizard.wsl.plan.scope.distro')).length).toBe(2)
    expect(screen.getByText(i18n.t('wizard.wsl.plan.scope.user'))).toBeTruthy()
    expect(screen.getAllByText(new RegExp(i18n.t('wizard.wsl.plan.effect.terminateDistro', { distro: 'Ubuntu' }).replace(/[()]/g, '.'))).length).toBe(2)
    expect(screen.getByText(/cannot be stopped midway/)).toBeTruthy()
    // Required conversion unchecked → note.
    expect(screen.getByTestId('wizard-consent-required-missing')).toBeTruthy()
    // Summary with the running distros (an item that terminates is checked).
    expect(screen.getByTestId('wizard-consent-summary')).toHaveTextContent('Ubuntu, Debian')
  })

  it('submits the checked ids (fixed included); checking the required item clears the note', () => {
    const onSubmit = vi.fn()
    render(<WizardConsentChecklist request={{ stepId: 'p', titleKey: 'wizard.wsl.plan.title', items: plan().items, params: { distro: 'Ubuntu' } }} regionId="r" onSubmit={onSubmit} />)
    fireEvent.click(screen.getByRole('checkbox', { name: /Convert Ubuntu to WSL 2/ }))
    expect(screen.queryByTestId('wizard-consent-required-missing')).toBeNull()
    expect(screen.getByTestId('wizard-consent-summary')).toHaveTextContent(i18n.t('wizard.wsl.plan.runningNone'))
    fireEvent.click(screen.getByTestId('wizard-consent-confirm'))
    expect(onSubmit).toHaveBeenCalledWith(['wsl2-convert', 'enable-systemd', 'enable-linger'])
  })

  it('an item that cannot be checked shows why and stays unchecked', () => {
    const items = buildWslEnvPlan(facts({ selected: selected({ pid1: 'init', systemdRunning: false, wslConf: { status: 'unparsable', bootSystemd: null, userDefault: null } }) })).items
    render(<WizardConsentChecklist request={{ stepId: 'p', titleKey: 'wizard.wsl.plan.title', items, params: { distro: 'Ubuntu' } }} regionId="r" onSubmit={() => undefined} />)
    const box = screen.getByRole('checkbox', { name: /Turn on systemd/ }) as HTMLInputElement
    expect(box.checked).toBe(false)
    expect(box.disabled).toBe(true)
    expect(screen.getByTestId('wizard-consent-disabled-reason')).toHaveTextContent(i18n.t('wizard.wsl.plan.reason.wslConfUnparsable'))
  })
})

describe('<SetupWizardShell> with the WSL checklist (T0840)', () => {
  function planStep(): WizardStep {
    return planWslEnvironmentStep
  }

  it('shows the checklist, confirm continues to apply, done screen lists the changes', async () => {
    installApi({
      detectFacts: vi.fn().mockResolvedValue(NEEDS_SYSTEMD()),
      applyEnvItem: vi.fn(async () => ({
        ok: true, outcome: 'applied', terminated: true,
        changes: [{ item: 'enable-systemd', kind: 'file', path: '/etc/wsl.conf', backupPath: '/etc/wsl.conf.bat-backup-20261104-120000' }],
      })),
    })
    render(<SetupWizardShell steps={[planStep(), applyWslEnvironmentStep]} ctx={makeCtx({ wslDistro: 'Ubuntu' })} />)
    const confirm = await screen.findByTestId('wizard-consent-confirm')
    expect(screen.getByRole('form', { name: i18n.t('wizard.wsl.plan.title', { distro: 'Ubuntu' }) })).toBeTruthy()
    fireEvent.click(confirm)
    const box = await screen.findByTestId('wizard-wsl-applied-changes')
    expect(box).toHaveTextContent('/etc/wsl.conf.bat-backup-20261104-120000')
    expect(box).toHaveTextContent(i18n.t('wizard.wsl.apply.changes.note'))
    await waitFor(() => expect(screen.getByText(i18n.t('wizard.progress.complete'))).toBeTruthy())
  })

  it('healthy environment: no checklist and no changes box', async () => {
    installApi({ detectFacts: vi.fn().mockResolvedValue(facts()), applyEnvItem: vi.fn() })
    render(<SetupWizardShell steps={[planStep(), applyWslEnvironmentStep]} ctx={makeCtx({ wslDistro: 'Ubuntu' })} />)
    await waitFor(() => expect(screen.getByText(i18n.t('wizard.progress.complete'))).toBeTruthy())
    expect(screen.queryByTestId('wizard-consent')).toBeNull()
    expect(screen.queryByTestId('wizard-wsl-applied-changes')).toBeNull()
  })

  it('stop while the checklist is open → cancelled, checklist gone', async () => {
    installApi({ detectFacts: vi.fn().mockResolvedValue(NEEDS_SYSTEMD()), applyEnvItem: vi.fn() })
    render(<SetupWizardShell steps={[planStep(), applyWslEnvironmentStep]} ctx={makeCtx({ wslDistro: 'Ubuntu' })} />)
    await screen.findByTestId('wizard-consent-confirm')
    fireEvent.click(screen.getByTestId('wizard-abort'))
    await waitFor(() => expect(screen.getByText(i18n.t('wizard.cancelled'))).toBeTruthy())
    expect(screen.queryByTestId('wizard-consent')).toBeNull()
  })
})
