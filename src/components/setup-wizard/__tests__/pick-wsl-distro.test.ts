/**
 * T0340 (PLAN-032 Sprint 4): regression tests for the WSL pick-wsl-distro
 * step. Verifies the input contract:
 *   - kind:'input' attribute present
 *   - >1 v2 distro → ctx.requestChoice → snapshot transitions through
 *     awaiting-input → succeeded after user picks
 *   - 1 v2 distro → auto-pick, no awaiting-input
 *   - 0 distros / no v2 → terminal failed (env preflight, not pre-submit
 *     input validation; spec § 2 allows terminal throw "when possible")
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { pickWslDistroStep } from '../steps/wsl/pick-wsl-distro'
import {
  WizardRunner,
  WizardStepStatus,
  type WizardChoiceRequest,
  type WizardContext,
} from '../wizard-runner'

interface WslDistroEntry {
  name: string
  version: 1 | 2
  state: 'Running' | 'Stopped'
}

function installElectronApi(distros: WslDistroEntry[], defaultName?: string) {
  const list = vi.fn().mockResolvedValue({ distros, default: defaultName })
  ;(globalThis as unknown as { window: typeof window }).window =
    (globalThis as unknown as { window?: typeof window }).window ??
    ({} as typeof window)
  ;(window as unknown as { electronAPI: { wsl: { list: typeof list } } }).electronAPI = {
    wsl: { list },
  } as never
  return list
}

function makeCtx(overrides: Partial<WizardContext> = {}): WizardContext {
  return {
    targetOS: 'wsl-linux',
    profileDraft: { name: 'test' },
    warnings: [],
    state: {},
    logger: {
      info: () => undefined,
      warn: () => undefined,
      error: () => undefined,
    },
    ...overrides,
  }
}

function waitForStatus(states: WizardStepStatus[], target: WizardStepStatus): Promise<void> {
  return new Promise((resolve) => {
    const tick = () => {
      if (states.includes(target)) resolve()
      else setTimeout(tick, 5)
    }
    tick()
  })
}

afterEach(() => {
  vi.restoreAllMocks()
  delete (window as unknown as { electronAPI?: unknown }).electronAPI
})

describe('pick-wsl-distro (T0340 / PLAN-032 Sprint 4)', () => {
  it('AC-2 #1: kind:"input" attribute present', () => {
    expect(pickWslDistroStep.kind).toBe('input')
  })

  it('AC-2 #2-3: multiple v2 distros → ctx.requestChoice → awaiting-input snapshot', async () => {
    installElectronApi([
      { name: 'Ubuntu', version: 2, state: 'Running' },
      { name: 'Debian', version: 2, state: 'Stopped' },
    ])
    const states: WizardStepStatus[] = []

    const ctx = makeCtx()
    ctx.requestChoice = (_req: WizardChoiceRequest) =>
      new Promise<string | null>(() => undefined)

    const runner = new WizardRunner([pickWslDistroStep], ctx, (snaps) => {
      states.push(snaps[0].status)
    })
    void runner.run()
    await waitForStatus(states, WizardStepStatus.AwaitingInput)

    expect(states.includes(WizardStepStatus.AwaitingInput)).toBe(true)
    expect(states.includes(WizardStepStatus.Failed)).toBe(false)

    await runner.cancel()
  })

  it('AC-2 #3: user picks distro → succeeded + ctx.wslDistro set', async () => {
    installElectronApi([
      { name: 'Ubuntu', version: 2, state: 'Running' },
      { name: 'Debian', version: 2, state: 'Stopped' },
    ])
    let resolveChoice: ((v: string | null) => void) | null = null

    const ctx = makeCtx()
    ctx.requestChoice = (_req: WizardChoiceRequest) =>
      new Promise<string | null>((resolve) => {
        resolveChoice = resolve
      })

    const states: WizardStepStatus[] = []
    const runner = new WizardRunner([pickWslDistroStep], ctx, (snaps) => {
      states.push(snaps[0].status)
    })
    const p = runner.run()
    await waitForStatus(states, WizardStepStatus.AwaitingInput)
    resolveChoice!('Debian')
    await p

    expect(states[states.length - 1]).toBe(WizardStepStatus.Succeeded)
    expect(ctx.wslDistro).toBe('Debian')
  })

  it('Single v2 distro auto-picks, no awaiting-input transition', async () => {
    installElectronApi([{ name: 'Ubuntu', version: 2, state: 'Running' }])
    const requestChoice = vi.fn().mockResolvedValue(null)

    const ctx = makeCtx()
    ctx.requestChoice = requestChoice as unknown as WizardContext['requestChoice']

    const states: WizardStepStatus[] = []
    const runner = new WizardRunner([pickWslDistroStep], ctx, (snaps) => {
      states.push(snaps[0].status)
    })
    await runner.run()

    expect(states[states.length - 1]).toBe(WizardStepStatus.Succeeded)
    expect(states.includes(WizardStepStatus.AwaitingInput)).toBe(false)
    expect(requestChoice).not.toHaveBeenCalled()
    expect(ctx.wslDistro).toBe('Ubuntu')
  })

  it('AC-2 #4: zero distros → terminal failed (env preflight, no awaiting-input)', async () => {
    installElectronApi([])
    const ctx = makeCtx()

    const snapshots: Array<{ status: WizardStepStatus; error?: string }> = []
    const runner = new WizardRunner([pickWslDistroStep], ctx, (snaps) => {
      snapshots.push({ status: snaps[0].status, error: snaps[0].error })
    })
    const p = runner.run()
    p.catch(() => undefined)
    await new Promise<void>((resolve) => {
      const tick = () => {
        if (snapshots.some((s) => s.status === WizardStepStatus.Failed)) resolve()
        else setTimeout(tick, 5)
      }
      tick()
    })

    const failed = snapshots.find((s) => s.status === WizardStepStatus.Failed)
    expect(failed).toBeDefined()
    expect(failed!.error).toMatch(/No WSL distros found/)
    // Env preflight failure must not detour through awaiting-input.
    expect(snapshots.some((s) => s.status === WizardStepStatus.AwaitingInput)).toBe(false)

    await runner.cancel()
  })

  it('AC-2 #4: only WSL1 distros → terminal failed with v2 hint', async () => {
    installElectronApi([{ name: 'LegacyDistro', version: 1, state: 'Running' }])
    const ctx = makeCtx()

    const snapshots: Array<{ status: WizardStepStatus; error?: string }> = []
    const runner = new WizardRunner([pickWslDistroStep], ctx, (snaps) => {
      snapshots.push({ status: snaps[0].status, error: snaps[0].error })
    })
    const p = runner.run()
    p.catch(() => undefined)
    await new Promise<void>((resolve) => {
      const tick = () => {
        if (snapshots.some((s) => s.status === WizardStepStatus.Failed)) resolve()
        else setTimeout(tick, 5)
      }
      tick()
    })

    const failed = snapshots.find((s) => s.status === WizardStepStatus.Failed)
    expect(failed!.error).toMatch(/WSL2/)
    expect(snapshots.some((s) => s.status === WizardStepStatus.AwaitingInput)).toBe(false)

    await runner.cancel()
  })
})
