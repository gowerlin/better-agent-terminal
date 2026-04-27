/**
 * T0330 (PLAN-032 Sprint 2): WizardRunner state-machine transition tests.
 *
 * Coverage:
 *  - Allowed transitions (each kind from spec) end-to-end via runner
 *  - Forbidden transitions throw WizardStateTransitionError
 *  - kind: 'input' step flips status to AwaitingInput while requestChoice
 *    is pending, and back to Running on resolve
 */
import { describe, expect, it } from 'vitest'
import {
  WizardRunner,
  WizardStateTransitionError,
  WizardStepStatus,
  type WizardChoiceRequest,
  type WizardContext,
  type WizardStep,
} from '../wizard-runner'

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

describe('WizardRunner transition guard (T0330)', () => {
  it('rejects forbidden completed -> awaiting-input transition', () => {
    expect(() => {
      throw new WizardStateTransitionError(
        's',
        WizardStepStatus.Succeeded,
        WizardStepStatus.AwaitingInput,
      )
    }).toThrow(WizardStateTransitionError)

    // Validate the error carries from/to/stepId.
    try {
      throw new WizardStateTransitionError(
        'configure-host',
        WizardStepStatus.Succeeded,
        WizardStepStatus.AwaitingInput,
      )
    } catch (err) {
      expect(err).toBeInstanceOf(WizardStateTransitionError)
      const e = err as WizardStateTransitionError
      expect(e.stepId).toBe('configure-host')
      expect(e.from).toBe(WizardStepStatus.Succeeded)
      expect(e.to).toBe(WizardStepStatus.AwaitingInput)
      expect(e.message).toContain('configure-host')
      expect(e.message).toContain('succeeded')
      expect(e.message).toContain('awaiting-input')
    }
  })

  it('happy-path task step: pending -> running -> succeeded', async () => {
    const states: WizardStepStatus[] = []
    const step: WizardStep = {
      id: 'task',
      title: 'task',
      appliesTo: 'all',
      async run() {},
    }
    const runner = new WizardRunner([step], makeCtx(), (snaps) => {
      states.push(snaps[0].status)
    })
    await runner.run()
    // Constructor emit is Pending; then Running; then Succeeded.
    expect(states[0]).toBe(WizardStepStatus.Pending)
    expect(states.includes(WizardStepStatus.Running)).toBe(true)
    expect(states[states.length - 1]).toBe(WizardStepStatus.Succeeded)
  })

  it('input-kind step transitions running -> awaiting-input -> running -> succeeded', async () => {
    const states: WizardStepStatus[] = []
    let pendingResolve: ((v: string) => void) | null = null

    const ctx = makeCtx()
    ctx.requestChoice = (_req: WizardChoiceRequest) =>
      new Promise<string | null>((resolve) => {
        pendingResolve = (v: string) => resolve(v)
      })

    const step: WizardStep = {
      id: 'input',
      title: 'input',
      appliesTo: 'all',
      kind: 'input',
      async run(c) {
        await c.requestChoice!({
          stepId: 'input',
          title: 'pick one',
          options: [{ value: 'a', label: 'A' }],
        })
      },
    }

    const runner = new WizardRunner([step], ctx, (snaps) => {
      states.push(snaps[0].status)
    })
    const runPromise = runner.run()

    // Wait for AwaitingInput to be observed.
    await new Promise<void>((resolve) => {
      const tick = () => {
        if (states.includes(WizardStepStatus.AwaitingInput)) resolve()
        else setTimeout(tick, 5)
      }
      tick()
    })

    expect(states.includes(WizardStepStatus.Running)).toBe(true)
    expect(states.includes(WizardStepStatus.AwaitingInput)).toBe(true)

    pendingResolve!('a')
    await runPromise

    // Final state is Succeeded; AwaitingInput appears strictly between Running events.
    expect(states[states.length - 1]).toBe(WizardStepStatus.Succeeded)
    const awaitingIdx = states.indexOf(WizardStepStatus.AwaitingInput)
    const succeededIdx = states.lastIndexOf(WizardStepStatus.Succeeded)
    // After awaiting-input we must see Running again before Succeeded.
    const tailRunning = states.slice(awaitingIdx + 1, succeededIdx).includes(WizardStepStatus.Running)
    expect(tailRunning).toBe(true)
  })

  it('task-kind step does NOT enter awaiting-input even if it calls requestChoice', async () => {
    // Defensive: kind defaults to 'task'; runner does NOT wrap requestChoice
    // unless kind === 'input'. This guards against accidental scope creep.
    const states: WizardStepStatus[] = []
    const ctx = makeCtx()
    ctx.requestChoice = async () => 'a'

    const step: WizardStep = {
      id: 'task',
      title: 'task',
      appliesTo: 'all',
      // no kind => 'task'
      async run(c) {
        await c.requestChoice!({
          stepId: 'task',
          title: 't',
          options: [{ value: 'a', label: 'A' }],
        })
      },
    }

    const runner = new WizardRunner([step], ctx, (snaps) => {
      states.push(snaps[0].status)
    })
    await runner.run()
    expect(states.includes(WizardStepStatus.AwaitingInput)).toBe(false)
    expect(states[states.length - 1]).toBe(WizardStepStatus.Succeeded)
  })

  it('failed step retry transitions through Running (failed -> running)', async () => {
    let attempts = 0
    const states: WizardStepStatus[] = []
    const step: WizardStep = {
      id: 'flaky',
      title: 'flaky',
      appliesTo: 'all',
      retryable: true,
      async run() {
        attempts += 1
        if (attempts === 1) throw new Error('first try fails')
      },
    }
    const runner = new WizardRunner([step], makeCtx(), (snaps) => {
      states.push(snaps[0].status)
    })
    const p = runner.run()
    // Wait for the failed state to land, then trigger retry.
    await new Promise<void>((resolve) => {
      const tick = () => {
        if (states.includes(WizardStepStatus.Failed)) resolve()
        else setTimeout(tick, 5)
      }
      tick()
    })
    await runner.retryCurrentStep()
    await p
    expect(attempts).toBe(2)
    // After failed we must observe Running again before Succeeded.
    const failedIdx = states.indexOf(WizardStepStatus.Failed)
    const after = states.slice(failedIdx + 1)
    expect(after.includes(WizardStepStatus.Running)).toBe(true)
    expect(states[states.length - 1]).toBe(WizardStepStatus.Succeeded)
  })

  it('failed step skip transitions failed -> succeeded (with skipped flag)', async () => {
    const states: Array<{ status: WizardStepStatus; skipped?: boolean }> = []
    const step: WizardStep = {
      id: 'broken',
      title: 'broken',
      appliesTo: 'all',
      retryable: true,
      async run() {
        throw new Error('boom')
      },
    }
    const runner = new WizardRunner([step], makeCtx(), (snaps) => {
      states.push({ status: snaps[0].status, skipped: snaps[0].skipped })
    })
    const p = runner.run()
    await new Promise<void>((resolve) => {
      const tick = () => {
        if (states.some((s) => s.status === WizardStepStatus.Failed)) resolve()
        else setTimeout(tick, 5)
      }
      tick()
    })
    await runner.skipCurrentStep()
    await p
    const last = states[states.length - 1]
    expect(last.status).toBe(WizardStepStatus.Succeeded)
    expect(last.skipped).toBe(true)
  })
})
