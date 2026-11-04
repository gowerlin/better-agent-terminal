/**
 * T0839 (PLAN-043 W2): facts → plan (pure). T0831 P-1–P-7 with D272:
 * healthy = 0 items, P-5 never in the first plan, P-6 not done, P-7 hint only.
 */
import { describe, expect, it } from 'vitest'
import {
  buildWslEnvPlan,
  compareWslVersions,
  isWslTooOld,
  type WslFacts,
  type WslSelectedDistroFacts,
} from '../wsl-env-plan'

function selected(overrides: Partial<WslSelectedDistroFacts> = {}): WslSelectedDistroFacts {
  return {
    name: 'Ubuntu-24.04',
    version: 2,
    state: 'Running',
    probe: 'ok',
    user: 'demo',
    uid: 1000,
    pid1: 'systemd',
    systemdRunning: true,
    wslConf: { status: 'ok', bootSystemd: 'true', userDefault: 'demo' },
    linger: true,
    ...overrides,
  }
}

function facts(overrides: Partial<WslFacts> = {}): WslFacts {
  return {
    v: 1,
    platform: 'win32',
    windowsBuild: 28000,
    wslInstalled: true,
    version: { available: true, wsl: '2.7.14.0' },
    distros: [{ name: 'Ubuntu-24.04', version: 2, state: 'Running' }],
    defaultDistro: 'Ubuntu-24.04',
    running: ['Ubuntu-24.04'],
    selected: selected(),
    policy: { status: 'absent', values: {}, allowWsl: null, allowWsl1: null, allowInboxWsl: null, allowNetworkingModeUserSetting: null, defaultNetworkingMode: null },
    wslConfig: { status: 'missing', encoding: null, networkingMode: null, instanceIdleTimeout: null },
    timedOut: false,
    durationMs: 120,
    ...overrides,
  }
}

const ids = (plan: ReturnType<typeof buildWslEnvPlan>) => plan.items.map((item) => item.id)
const noticeIds = (plan: ReturnType<typeof buildWslEnvPlan>) => plan.notices.map((notice) => notice.id)

describe('buildWslEnvPlan()', () => {
  it('🔴 healthy environment → 0 items and 0 notices (wizard unchanged)', () => {
    expect(buildWslEnvPlan(facts())).toEqual({ items: [], notices: [] })
  })

  it('healthy even when linger is not enabled yet (linger stays automatic)', () => {
    expect(buildWslEnvPlan(facts({ selected: selected({ linger: false }) }))).toEqual({ items: [], notices: [] })
  })

  it('P-5 / P-6 never appear: NAT, mirrored or instanceIdleTimeout facts add nothing', () => {
    const plan = buildWslEnvPlan(facts({
      wslConfig: { status: 'ok', encoding: 'utf8', networkingMode: 'nat', instanceIdleTimeout: null },
    }))
    expect(plan).toEqual({ items: [], notices: [] })
    expect(buildWslEnvPlan(facts({ wslConfig: { status: 'unparsable', encoding: 'utf8', networkingMode: null, instanceIdleTimeout: null } }))).toEqual({ items: [], notices: [] })
  })

  it('P-2: systemd not running → required, checked item + fixed linger item', () => {
    const plan = buildWslEnvPlan(facts({ selected: selected({ pid1: 'init', systemdRunning: false, wslConf: { status: 'missing', bootSystemd: null, userDefault: null }, linger: false }) }))
    expect(ids(plan)).toEqual(['enable-systemd', 'enable-linger'])
    expect(plan.items[0]).toMatchObject({
      scope: 'distro', effects: ['terminate-distro'], required: true, defaultChecked: true,
      labelKey: 'wizard.wsl.plan.item.enableSystemd.label', params: { distro: 'Ubuntu-24.04' },
    })
    expect(plan.items[0].disabledReasonKey).toBeUndefined()
    expect(plan.items[1]).toMatchObject({ scope: 'user', fixed: true, required: true, defaultChecked: true, effects: [] })
    expect(plan.notices).toEqual([])
  })

  it('P-2: declared systemd=true but not running yet still needs the terminate', () => {
    const plan = buildWslEnvPlan(facts({ selected: selected({ pid1: 'init', systemdRunning: false }) }))
    expect(ids(plan)).toEqual(['enable-systemd'])
  })

  it('P-2: unparsable / unreadable /etc/wsl.conf → item disabled, not checked', () => {
    const unparsable = buildWslEnvPlan(facts({ selected: selected({ systemdRunning: false, wslConf: { status: 'unparsable', bootSystemd: null, userDefault: null } }) }))
    expect(unparsable.items[0]).toMatchObject({ id: 'enable-systemd', defaultChecked: false, disabledReasonKey: 'wizard.wsl.plan.reason.wslConfUnparsable' })
    const unreadable = buildWslEnvPlan(facts({ selected: selected({ systemdRunning: false, wslConf: { status: 'unreadable', bootSystemd: null, userDefault: null } }) }))
    expect(unreadable.items[0]).toMatchObject({ disabledReasonKey: 'wizard.wsl.plan.reason.wslConfUnreadable', defaultChecked: false })
  })

  it('P-1: WSL1 distro → required but unchecked conversion, plus systemd when not declared', () => {
    const plan = buildWslEnvPlan(facts({ selected: selected({ version: 1, pid1: 'init', systemdRunning: false, wslConf: { status: 'missing', bootSystemd: null, userDefault: null }, linger: null }) }))
    expect(ids(plan)).toEqual(['wsl2-convert', 'enable-systemd', 'enable-linger'])
    expect(plan.items[0]).toMatchObject({ scope: 'distro', effects: ['terminate-distro', 'long-running'], required: true, defaultChecked: false })
  })

  it('P-1: WSL1 distro already declaring systemd=true → conversion only', () => {
    const plan = buildWslEnvPlan(facts({ selected: selected({ version: 1, pid1: 'init', systemdRunning: false, linger: true }) }))
    expect(ids(plan)).toEqual(['wsl2-convert'])
  })

  it('P-3: root default user → hint only, no item', () => {
    const plan = buildWslEnvPlan(facts({ selected: selected({ uid: 0, user: 'root' }) }))
    expect(plan.items).toEqual([])
    expect(plan.notices).toEqual([{ id: 'default-user-root', messageKey: 'wizard.wsl.plan.notice.defaultUserRoot', params: { distro: 'Ubuntu-24.04' }, severity: 'warning' }])
  })

  it('P-7: WSL too old (< 2.0.4) → warning notice; systemd item disabled with that reason', () => {
    const old = facts({ version: { available: true, wsl: '1.2.5.0' }, selected: selected({ systemdRunning: false, pid1: 'init' }) })
    const plan = buildWslEnvPlan(old)
    expect(noticeIds(plan)).toEqual(['wsl-too-old'])
    expect(plan.notices[0]).toMatchObject({ severity: 'warning', params: { version: '1.2.5.0', minimum: '2.0.4' } })
    expect(plan.items[0]).toMatchObject({ id: 'enable-systemd', disabledReasonKey: 'wizard.wsl.plan.reason.wslTooOld', defaultChecked: false })
  })

  it('P-7: inbox WSL (`--version` unavailable) is too old; healthy distro gets the hint only', () => {
    const plan = buildWslEnvPlan(facts({ version: { available: false, wsl: null } }))
    expect(plan.items).toEqual([])
    expect(noticeIds(plan)).toEqual(['wsl-too-old'])
  })

  it('policy AllowWSL=0 → blocking notice and nothing else', () => {
    const plan = buildWslEnvPlan(facts({
      policy: { status: 'present', values: { AllowWSL: 0 }, allowWsl: false, allowWsl1: null, allowInboxWsl: null, allowNetworkingModeUserSetting: null, defaultNetworkingMode: null },
      selected: selected({ version: 1, systemdRunning: false }),
    }))
    expect(plan).toEqual({ items: [], notices: [{ id: 'policy-wsl-disabled', messageKey: 'wizard.wsl.plan.notice.policyWslDisabled', severity: 'blocking' }] })
  })

  it('policy present but allowing WSL changes nothing', () => {
    const plan = buildWslEnvPlan(facts({
      policy: { status: 'present', values: { AllowWSL: 1, AllowNetworkingModeUserSetting: 0 }, allowWsl: true, allowWsl1: null, allowInboxWsl: null, allowNetworkingModeUserSetting: false, defaultNetworkingMode: null },
    }))
    expect(plan).toEqual({ items: [], notices: [] })
  })

  it('WSL not installed → blocking notice (Phase 3 adds the install item)', () => {
    const plan = buildWslEnvPlan(facts({ wslInstalled: false, version: { available: false, wsl: null }, distros: [], selected: null }))
    expect(plan).toEqual({ items: [], notices: [{ id: 'wsl-not-installed', messageKey: 'wizard.wsl.plan.notice.wslNotInstalled', severity: 'blocking' }] })
  })

  it('no distro / distro not in the list → nothing (pick-wsl-distro reports it)', () => {
    expect(buildWslEnvPlan(facts({ distros: [], defaultDistro: null, selected: null }))).toEqual({ items: [], notices: [] })
    expect(buildWslEnvPlan(facts({ selected: selected({ version: null, state: null, probe: 'skipped' }) }))).toEqual({ items: [], notices: [] })
  })

  it('probe failed → warning notice; WSL1 conversion (from the list) is still offered', () => {
    const failed = selected({ probe: 'failed', uid: null, user: null, pid1: null, systemdRunning: null, linger: null })
    expect(buildWslEnvPlan(facts({ selected: failed }))).toEqual({
      items: [],
      notices: [{ id: 'distro-probe-failed', messageKey: 'wizard.wsl.plan.notice.distroProbeFailed', params: { distro: 'Ubuntu-24.04' }, severity: 'warning' }],
    })
    expect(ids(buildWslEnvPlan(facts({ selected: { ...failed, version: 1 } })))).toEqual(['wsl2-convert'])
  })

  it('off Windows → empty plan', () => {
    expect(buildWslEnvPlan(facts({ platform: 'linux', wslInstalled: false }))).toEqual({ items: [], notices: [] })
  })

  it('every item carries the T0831 consent shape', () => {
    const plan = buildWslEnvPlan(facts({ selected: selected({ version: 1, systemdRunning: false, wslConf: { status: 'missing', bootSystemd: null, userDefault: null }, linger: false }) }))
    for (const item of plan.items) {
      expect(typeof item.id).toBe('string')
      expect(item.labelKey).toMatch(/^wizard\.wsl\.plan\./)
      expect(['machine', 'distro', 'user']).toContain(item.scope)
      expect(Array.isArray(item.effects)).toBe(true)
      expect(typeof item.required).toBe('boolean')
      expect(typeof item.defaultChecked).toBe('boolean')
    }
  })
})

describe('version helpers', () => {
  it('compareWslVersions compares numerically', () => {
    expect(compareWslVersions('2.0.4', '2.0.4.0')).toBe(0)
    expect(compareWslVersions('2.0.10', '2.0.4')).toBe(1)
    expect(compareWslVersions('1.9.99', '2.0.4')).toBe(-1)
  })

  it('isWslTooOld: unparsable version from a working --version is not too old; not installed is not too old', () => {
    expect(isWslTooOld({ wslInstalled: true, version: { available: true, wsl: null } })).toBe(false)
    expect(isWslTooOld({ wslInstalled: true, version: { available: true, wsl: '2.0.4.0' } })).toBe(false)
    expect(isWslTooOld({ wslInstalled: true, version: { available: true, wsl: '2.0.3' } })).toBe(true)
    expect(isWslTooOld({ wslInstalled: false, version: { available: false, wsl: null } })).toBe(false)
  })
})
