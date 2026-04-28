/**
 * T0340 (PLAN-032 Sprint 4): regression tests for the Docker pick-container
 * step. Verifies the input contract:
 *   - kind:'input' attribute present
 *   - mode picker uses ctx.requestChoice → snapshot transitions through
 *     awaiting-input
 *   - pre-set state.containerMode short-circuits the prompt
 *   - mode='existing' + zero containers → terminal failed (post-submit
 *     env-shape validation; no awaiting-input detour)
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { pickContainerStep } from '../steps/docker/pick-container'
import {
  WizardRunner,
  WizardStepStatus,
  type WizardChoiceRequest,
  type WizardContext,
} from '../wizard-runner'

interface DockerContainerEntry {
  name: string
  state: 'running' | 'exited' | 'created'
}

function installElectronApi(containers: DockerContainerEntry[]) {
  const listContainers = vi.fn().mockResolvedValue(containers)
  const removeContainer = vi.fn().mockResolvedValue(undefined)
  ;(globalThis as unknown as { window: typeof window }).window =
    (globalThis as unknown as { window?: typeof window }).window ??
    ({} as typeof window)
  ;(window as unknown as {
    electronAPI: { docker: { listContainers: typeof listContainers; removeContainer: typeof removeContainer } }
  }).electronAPI = {
    docker: { listContainers, removeContainer },
  } as never
  return { listContainers, removeContainer }
}

function makeCtx(overrides: Partial<WizardContext> = {}): WizardContext {
  return {
    targetOS: 'docker-linux',
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

describe('pick-container (T0340 / PLAN-032 Sprint 4)', () => {
  it('AC-3 #1: kind:"input" attribute present', () => {
    expect(pickContainerStep.kind).toBe('input')
  })

  it('AC-3 #2: mode picker → ctx.requestChoice → awaiting-input snapshot', async () => {
    installElectronApi([{ name: 'existing-1', state: 'running' }])
    const states: WizardStepStatus[] = []

    const ctx = makeCtx()
    ctx.requestChoice = (_req: WizardChoiceRequest) =>
      new Promise<string | null>(() => undefined)

    const runner = new WizardRunner([pickContainerStep], ctx, (snaps) => {
      states.push(snaps[0].status)
    })
    void runner.run()
    await waitForStatus(states, WizardStepStatus.AwaitingInput)

    expect(states.includes(WizardStepStatus.AwaitingInput)).toBe(true)
    expect(states.includes(WizardStepStatus.Failed)).toBe(false)

    await runner.cancel()
  })

  it('AC-3 #2: user picks "new" mode → succeeded + state.containerMode populated', async () => {
    installElectronApi([])
    let resolveChoice: ((v: string | null) => void) | null = null

    const ctx = makeCtx()
    ctx.requestChoice = (_req: WizardChoiceRequest) =>
      new Promise<string | null>((resolve) => {
        resolveChoice = resolve
      })

    const states: WizardStepStatus[] = []
    const runner = new WizardRunner([pickContainerStep], ctx, (snaps) => {
      states.push(snaps[0].status)
    })
    const p = runner.run()
    await waitForStatus(states, WizardStepStatus.AwaitingInput)
    resolveChoice!('new')
    await p

    expect(states[states.length - 1]).toBe(WizardStepStatus.Succeeded)
    expect((ctx.state as { containerMode?: string }).containerMode).toBe('new')
    expect(typeof (ctx.state as { dockerContainer?: string }).dockerContainer).toBe('string')
  })

  it('AC-3 #2: user picks "existing" with containers → succeeded + first container chosen', async () => {
    installElectronApi([
      { name: 'first', state: 'running' },
      { name: 'second', state: 'exited' },
    ])
    let resolveChoice: ((v: string | null) => void) | null = null

    const ctx = makeCtx()
    ctx.requestChoice = (_req: WizardChoiceRequest) =>
      new Promise<string | null>((resolve) => {
        resolveChoice = resolve
      })

    const states: WizardStepStatus[] = []
    const runner = new WizardRunner([pickContainerStep], ctx, (snaps) => {
      states.push(snaps[0].status)
    })
    const p = runner.run()
    await waitForStatus(states, WizardStepStatus.AwaitingInput)
    resolveChoice!('existing')
    await p

    expect(states[states.length - 1]).toBe(WizardStepStatus.Succeeded)
    expect((ctx.state as { containerMode?: string }).containerMode).toBe('existing')
    expect((ctx.state as { dockerContainer?: string }).dockerContainer).toBe('first')
  })

  it('Pre-set state.containerMode short-circuits the prompt', async () => {
    installElectronApi([{ name: 'preset', state: 'running' }])
    const requestChoice = vi.fn().mockResolvedValue(null)

    const ctx = makeCtx({ state: { containerMode: 'existing' } })
    ctx.requestChoice = requestChoice as unknown as WizardContext['requestChoice']

    const states: WizardStepStatus[] = []
    const runner = new WizardRunner([pickContainerStep], ctx, (snaps) => {
      states.push(snaps[0].status)
    })
    await runner.run()

    expect(states[states.length - 1]).toBe(WizardStepStatus.Succeeded)
    expect(states.includes(WizardStepStatus.AwaitingInput)).toBe(false)
    expect(requestChoice).not.toHaveBeenCalled()
  })

  it('AC-3 #2: mode="existing" but zero containers → terminal failed after submit', async () => {
    installElectronApi([])
    let resolveChoice: ((v: string | null) => void) | null = null

    const ctx = makeCtx()
    ctx.requestChoice = (_req: WizardChoiceRequest) =>
      new Promise<string | null>((resolve) => {
        resolveChoice = resolve
      })

    const snapshots: Array<{ status: WizardStepStatus; error?: string }> = []
    const runner = new WizardRunner([pickContainerStep], ctx, (snaps) => {
      snapshots.push({ status: snaps[0].status, error: snaps[0].error })
    })
    const p = runner.run()
    p.catch(() => undefined)
    await new Promise<void>((resolve) => {
      const tick = () => {
        if (snapshots.some((s) => s.status === WizardStepStatus.AwaitingInput)) resolve()
        else setTimeout(tick, 5)
      }
      tick()
    })
    resolveChoice!('existing')

    await new Promise<void>((resolve) => {
      const tick = () => {
        if (snapshots.some((s) => s.status === WizardStepStatus.Failed)) resolve()
        else setTimeout(tick, 5)
      }
      tick()
    })

    const failed = snapshots.find((s) => s.status === WizardStepStatus.Failed)
    expect(failed).toBeDefined()
    expect(failed!.error).toMatch(/No Docker containers found/)
    // awaiting-input must precede failed (post-submit validation).
    const awaitIdx = snapshots.findIndex((s) => s.status === WizardStepStatus.AwaitingInput)
    const failedIdx = snapshots.findIndex((s) => s.status === WizardStepStatus.Failed)
    expect(awaitIdx).toBeGreaterThanOrEqual(0)
    expect(failedIdx).toBeGreaterThan(awaitIdx)

    await runner.cancel()
  })
})
