/**
 * T0338 (PLAN-032 Sprint 5): Integration tests for WizardRunner state
 * transitions × ErrorMapper × Preflight × Recovery action union.
 *
 * Scope (AC-1): pure runner layer (no RTL). Synthetic WizardSteps mimic the
 * real flows without touching electronAPI. Each path verifies:
 *   1. snapshot.status sequence (state-machine guard satisfied)
 *   2. snapshot.mappedError.matchId on failure
 *   3. recovery action union resolves to expected `kind`
 *
 * Companion suite: integration.mapped-ux.test.tsx (Shell + RTL).
 */
import { describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_WIZARD_ERROR_REGISTRY,
  WizardRunner,
  WizardStepStatus,
  resolveWizardError,
  targetOSToErrorPlatform,
  type WizardChoiceRequest,
  type WizardContext,
  type WizardStep,
  type WizardTargetOS,
} from '../wizard-runner'

function makeCtx(overrides: Partial<WizardContext> = {}): WizardContext {
  return {
    targetOS: 'wsl-linux',
    profileDraft: { name: 'integration' },
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

function waitFor(states: WizardStepStatus[][], predicate: (last: WizardStepStatus[]) => boolean) {
  return new Promise<void>((resolve) => {
    const tick = () => {
      const last = states[states.length - 1]
      if (last && predicate(last)) resolve()
      else setTimeout(tick, 5)
    }
    tick()
  })
}

function captureStates(runner: WizardRunner, states: WizardStepStatus[][]) {
  // Initial snapshot already emitted in constructor.
  states.push(runner.getSnapshots().map((s) => s.status))
}

describe('integration.transitions (T0338) — runner × ErrorMapper × Preflight', () => {
  // ─────────────────────────────────────────────────────────────────────
  // Path 1: normal task path — pending → running → succeeded
  // ─────────────────────────────────────────────────────────────────────
  it('Path 1 — normal task path: pending → running → succeeded', async () => {
    const seq: WizardStepStatus[] = []
    const step: WizardStep = {
      id: 'detect-env',
      title: 'detect-env',
      appliesTo: 'all',
      async run() {
        // no-op
      },
    }
    const runner = new WizardRunner([step], makeCtx({ targetOS: 'docker-linux' }), (snaps) => {
      seq.push(snaps[0].status)
    })
    await runner.run()
    expect(seq[0]).toBe(WizardStepStatus.Pending)
    expect(seq).toContain(WizardStepStatus.Running)
    expect(seq[seq.length - 1]).toBe(WizardStepStatus.Succeeded)
  })

  // ─────────────────────────────────────────────────────────────────────
  // Path 2: input-step — pending → running → awaiting-input → running → succeeded
  // ─────────────────────────────────────────────────────────────────────
  it('Path 2 — input-step path: pending → running → awaiting-input → running → succeeded', async () => {
    const seq: WizardStepStatus[] = []
    let resolveChoice: ((v: string | null) => void) | null = null
    const ctx = makeCtx({ targetOS: 'ssh-linux' })
    ctx.requestChoice = (_req: WizardChoiceRequest) =>
      new Promise<string | null>((resolve) => {
        resolveChoice = resolve
      })

    const inputStep: WizardStep = {
      id: 'configure-ssh-host',
      title: 'configure-ssh-host',
      appliesTo: 'all',
      kind: 'input',
      async run(c) {
        await c.requestChoice!({
          stepId: 'configure-ssh-host',
          title: 'pick host',
          options: [{ value: 'alias-a', label: 'alias-a' }],
        })
      },
    }

    const runner = new WizardRunner([inputStep], ctx, (snaps) => {
      seq.push(snaps[0].status)
    })
    const p = runner.run()
    await new Promise<void>((resolve) => {
      const tick = () => {
        if (seq.includes(WizardStepStatus.AwaitingInput)) resolve()
        else setTimeout(tick, 5)
      }
      tick()
    })
    expect(seq).toContain(WizardStepStatus.AwaitingInput)
    resolveChoice!('alias-a')
    await p

    // Order invariant: awaiting-input precedes the final running → succeeded transition.
    const awaitIdx = seq.indexOf(WizardStepStatus.AwaitingInput)
    const finalSucceeded = seq.lastIndexOf(WizardStepStatus.Succeeded)
    expect(awaitIdx).toBeGreaterThan(-1)
    expect(seq.slice(awaitIdx + 1, finalSucceeded)).toContain(WizardStepStatus.Running)
    expect(seq[seq.length - 1]).toBe(WizardStepStatus.Succeeded)
  })

  // ─────────────────────────────────────────────────────────────────────
  // Path 3: failed → mapped → retry → succeeded
  // ─────────────────────────────────────────────────────────────────────
  it('Path 3 — failed (mapped) → retry recovery → running → succeeded', async () => {
    const seq: WizardStepStatus[] = []
    let attempts = 0
    const step: WizardStep = {
      id: 'verify-ssh-auth',
      title: 'verify-ssh-auth',
      appliesTo: 'all',
      retryable: true,
      async run() {
        attempts += 1
        if (attempts === 1) {
          const err = new Error('Permission denied (publickey).') as Error & { code?: string }
          err.code = 'permission-denied'
          throw err
        }
      },
    }
    const ctx = makeCtx({ targetOS: 'ssh-linux' })
    const runner = new WizardRunner([step], ctx, (snaps) => {
      seq.push(snaps[0].status)
    })
    const p = runner.run()
    await new Promise<void>((resolve) => {
      const tick = () => {
        if (seq.includes(WizardStepStatus.Failed)) resolve()
        else setTimeout(tick, 5)
      }
      tick()
    })
    // Verify mappedError on the failed snapshot.
    const failedSnap = runner.getSnapshots()[0]
    expect(failedSnap.mappedError?.matchId).toBe('ssh-permission-denied')
    // Recovery action union should include 'retry' (registry: edit-config / retry / cancel).
    const kinds = failedSnap.mappedError?.actions.map((a) => a.kind) ?? []
    expect(kinds).toContain('retry')

    await runner.retryCurrentStep()
    await p
    expect(attempts).toBe(2)
    expect(seq[seq.length - 1]).toBe(WizardStepStatus.Succeeded)
    // After failed we must have re-entered Running before final Succeeded.
    const failedIdx = seq.indexOf(WizardStepStatus.Failed)
    expect(seq.slice(failedIdx + 1)).toContain(WizardStepStatus.Running)
  })

  // ─────────────────────────────────────────────────────────────────────
  // Path 4: failed → fixed-and-retry recovery (registry kind) → succeeded
  // ─────────────────────────────────────────────────────────────────────
  it('Path 4 — failed (mapped to wsl-linger-failure with fixed-and-retry) → retry → succeeded', async () => {
    const seq: WizardStepStatus[] = []
    let attempts = 0
    const step: WizardStep = {
      id: 'write-systemd-unit',
      title: 'write-systemd-unit',
      appliesTo: 'all',
      retryable: true,
      async run() {
        attempts += 1
        if (attempts === 1) {
          const err = new Error('Could not enable linger for user') as Error & { code?: string }
          err.code = 'wsl-linger-failed'
          throw err
        }
      },
    }
    const ctx = makeCtx({ targetOS: 'wsl-linux' })
    const runner = new WizardRunner([step], ctx, (snaps) => {
      seq.push(snaps[0].status)
    })
    const p = runner.run()
    await new Promise<void>((resolve) => {
      const tick = () => {
        if (seq.includes(WizardStepStatus.Failed)) resolve()
        else setTimeout(tick, 5)
      }
      tick()
    })
    const failedSnap = runner.getSnapshots()[0]
    expect(failedSnap.mappedError?.matchId).toBe('wsl-linger-failure')
    const kinds = failedSnap.mappedError?.actions.map((a) => a.kind) ?? []
    expect(kinds).toContain('fixed-and-retry')
    expect(kinds).toContain('skip')

    // Shell dispatches fixed-and-retry → runner.retryCurrentStep() (same code path as retry).
    await runner.retryCurrentStep()
    await p
    expect(attempts).toBe(2)
    expect(seq[seq.length - 1]).toBe(WizardStepStatus.Succeeded)
  })

  // ─────────────────────────────────────────────────────────────────────
  // Path 5: preflight hard fail → mapped via errorCode → mappedError set
  // ─────────────────────────────────────────────────────────────────────
  it('Path 5 — preflight hard fail (docker-daemon-down) → failed with mappedError', async () => {
    const seq: WizardStepStatus[] = []
    const runSpy = vi.fn(async () => undefined)
    const step: WizardStep = {
      id: 'detect-env',
      title: 'detect-env',
      appliesTo: 'all',
      retryable: false,
      preflight: async () => ({
        ok: false,
        reason: 'docker daemon not reachable',
        errorCode: 'docker-daemon-down',
      }),
      run: runSpy,
    }
    const ctx = makeCtx({ targetOS: 'docker-linux' })
    const runner = new WizardRunner([step], ctx, (snaps) => {
      seq.push(snaps[0].status)
    })
    await expect(runner.run()).rejects.toThrow(/docker daemon not reachable/)

    expect(runSpy).not.toHaveBeenCalled()
    expect(seq[seq.length - 1]).toBe(WizardStepStatus.Failed)
    const snap = runner.getSnapshots()[0]
    expect(snap.mappedError?.matchId).toBe('docker-daemon-unavailable')
    const kinds = snap.mappedError?.actions.map((a) => a.kind) ?? []
    expect(kinds).toEqual(['open-link', 'fixed-and-retry', 'cancel'])
  })

  // ─────────────────────────────────────────────────────────────────────
  // Path 6: skip recovery → next step continues
  // ─────────────────────────────────────────────────────────────────────
  it('Path 6 — failed → skip recovery → next step runs to succeeded', async () => {
    const stepStates: WizardStepStatus[][] = []
    const stepA: WizardStep = {
      id: 'write-systemd-unit',
      title: 'write-systemd-unit',
      appliesTo: 'all',
      retryable: true,
      async run() {
        const err = new Error('Could not enable linger for user') as Error & { code?: string }
        err.code = 'wsl-linger-failed'
        throw err
      },
    }
    const stepBRun = vi.fn(async () => undefined)
    const stepB: WizardStep = {
      id: 'fetch-fingerprint',
      title: 'fetch-fingerprint',
      appliesTo: 'all',
      run: stepBRun,
    }
    const ctx = makeCtx({ targetOS: 'wsl-linux' })
    const runner = new WizardRunner([stepA, stepB], ctx, (snaps) => {
      stepStates.push(snaps.map((s) => s.status))
    })
    const p = runner.run()
    await waitFor(stepStates, (last) => last[0] === WizardStepStatus.Failed)

    const snap = runner.getSnapshots()[0]
    expect(snap.mappedError?.matchId).toBe('wsl-linger-failure')

    await runner.skipCurrentStep()
    await p
    expect(stepBRun).toHaveBeenCalledTimes(1)
    const finalSnaps = runner.getSnapshots()
    expect(finalSnaps[0].status).toBe(WizardStepStatus.Succeeded)
    expect(finalSnaps[0].skipped).toBe(true)
    expect(finalSnaps[1].status).toBe(WizardStepStatus.Succeeded)
  })

  // ─────────────────────────────────────────────────────────────────────
  // Bonus path 7: Sprint-3 wsl-not-installed entry — preflight errorCode
  // path. Verifies T0337 newer registry entry routes correctly.
  // ─────────────────────────────────────────────────────────────────────
  it('Path 7 — preflight wsl-not-installed → mapped to wsl-not-installed entry (open-link recovery)', async () => {
    const step: WizardStep = {
      id: 'detect-env',
      title: 'detect-env',
      appliesTo: 'all',
      retryable: false,
      preflight: async () => ({
        ok: false,
        reason: 'WSL2 is not installed on this Windows host',
        errorCode: 'wsl-not-installed',
      }),
      async run() {},
    }
    const ctx = makeCtx({ targetOS: 'wsl-linux' })
    const runner = new WizardRunner([step], ctx)
    await expect(runner.run()).rejects.toThrow(/WSL2 is not installed/)
    const snap = runner.getSnapshots()[0]
    expect(snap.mappedError?.matchId).toBe('wsl-not-installed')
    const openLink = snap.mappedError?.actions.find((a) => a.kind === 'open-link')
    expect(openLink).toBeDefined()
    if (openLink && openLink.kind === 'open-link') {
      expect(openLink.href).toMatch(/learn\.microsoft\.com/)
    }
  })

  // ─────────────────────────────────────────────────────────────────────
  // Bonus path 8: registry resolution sanity — every targetOS routes to
  // expected platform classification. Guards against ErrorMapper drift.
  // ─────────────────────────────────────────────────────────────────────
  it('Path 8 — targetOSToErrorPlatform routes each targetOS to the right registry platform', () => {
    const cases: Array<[WizardTargetOS, ReturnType<typeof targetOSToErrorPlatform>]> = [
      ['wsl-linux', 'wsl'],
      ['docker-linux', 'docker'],
      ['ssh-linux', 'ssh'],
      ['ssh-darwin', 'ssh'],
      ['local', 'local'],
    ]
    for (const [target, expected] of cases) {
      expect(targetOSToErrorPlatform(target)).toBe(expected)
    }
    // Sanity: resolveWizardError on an unknown error falls back (matchId=null)
    // and ships baseline retry/skip/cancel actions.
    const fallback = resolveWizardError(
      {
        platform: 'local',
        stepId: 'unknown',
        error: new Error('something nobody mapped'),
      },
      DEFAULT_WIZARD_ERROR_REGISTRY,
    )
    expect(fallback.matchId).toBeNull()
    expect(fallback.actions.map((a) => a.kind)).toEqual(['retry', 'skip', 'cancel'])
  })
})
