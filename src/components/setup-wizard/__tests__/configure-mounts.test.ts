/**
 * T0340 (PLAN-032 Sprint 4): regression tests for the Docker configure-mounts
 * step. configure-mounts uses native dialog.selectFolder() instead of
 * ctx.requestChoice — the runner's input-step wrap is therefore inert here.
 *
 * Per Q1=A (minimal abstraction, no requestChoice helper for native dialogs)
 * and AC-4: the step keeps kind:'input' as the semantic marker but does not
 * gain awaiting-input transition. This test verifies:
 *   - kind:'input' attribute present (semantic marker)
 *   - happy path with pre-existing mounts → succeeded without dialog
 *   - empty mounts + dialog cancel → terminal failed (post-submit; the
 *     dialog itself is the user-input gate)
 *   - validateMounts failure surfaces as terminal failed
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { configureMountsStep } from '../steps/docker/configure-mounts'
import {
  WizardRunner,
  WizardStepStatus,
  type WizardContext,
} from '../wizard-runner'

interface ValidateMountsResult {
  ok: boolean
  errors: string[]
}

function installElectronApi(opts: {
  selectFolder: () => Promise<string[] | null | undefined>
  validateMounts: (
    mounts: Array<{ host: string; container: string }>,
  ) => Promise<ValidateMountsResult>
}) {
  const selectFolder = vi.fn(opts.selectFolder)
  const validateMounts = vi.fn(opts.validateMounts)
  ;(globalThis as unknown as { window: typeof window }).window =
    (globalThis as unknown as { window?: typeof window }).window ??
    ({} as typeof window)
  ;(window as unknown as {
    electronAPI: {
      dialog: { selectFolder: typeof selectFolder }
      docker: { validateMounts: typeof validateMounts }
    }
  }).electronAPI = {
    dialog: { selectFolder },
    docker: { validateMounts },
  } as never
  return { selectFolder, validateMounts }
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

afterEach(() => {
  vi.restoreAllMocks()
  delete (window as unknown as { electronAPI?: unknown }).electronAPI
})

describe('configure-mounts (T0340 / PLAN-032 Sprint 4)', () => {
  it('AC-4 #1: kind:"input" attribute present (semantic marker; native dialog used in lieu of requestChoice)', () => {
    expect(configureMountsStep.kind).toBe('input')
  })

  it('AC-4: pre-existing mounts in state → succeeded without dialog prompt', async () => {
    const { selectFolder, validateMounts } = installElectronApi({
      selectFolder: async () => null,
      validateMounts: async () => ({ ok: true, errors: [] }),
    })
    const ctx = makeCtx({
      state: {
        dockerMounts: [{ host: '/host/repo', container: '/workspace/repo' }],
      },
    })

    const states: WizardStepStatus[] = []
    const runner = new WizardRunner([configureMountsStep], ctx, (snaps) => {
      states.push(snaps[0].status)
    })
    await runner.run()

    expect(states[states.length - 1]).toBe(WizardStepStatus.Succeeded)
    expect(selectFolder).not.toHaveBeenCalled()
    expect(validateMounts).toHaveBeenCalledTimes(1)
    expect(
      (ctx.profileDraft as { dockerMounts?: Array<{ host: string }> }).dockerMounts,
    ).toEqual([{ host: '/host/repo', container: '/workspace/repo' }])
  })

  it('AC-4: empty mounts + user picks folder → succeeded with default container path', async () => {
    installElectronApi({
      selectFolder: async () => ['/host/picked-folder'],
      validateMounts: async () => ({ ok: true, errors: [] }),
    })
    const ctx = makeCtx()

    const states: WizardStepStatus[] = []
    const runner = new WizardRunner([configureMountsStep], ctx, (snaps) => {
      states.push(snaps[0].status)
    })
    await runner.run()

    expect(states[states.length - 1]).toBe(WizardStepStatus.Succeeded)
    const mounts = (ctx.state as { dockerMounts?: Array<{ host: string; container: string }> }).dockerMounts
    expect(mounts).toEqual([{ host: '/host/picked-folder', container: '/workspace/picked-folder' }])
  })

  it('AC-4: empty mounts + dialog cancelled → terminal failed (post-submit dialog gate)', async () => {
    installElectronApi({
      selectFolder: async () => null,
      validateMounts: async () => ({ ok: true, errors: [] }),
    })
    const ctx = makeCtx()

    const snapshots: Array<{ status: WizardStepStatus; error?: string }> = []
    const runner = new WizardRunner([configureMountsStep], ctx, (snaps) => {
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
    expect(failed!.error).toMatch(/Select at least one host folder/)

    await runner.cancel()
  })

  it('AC-4: validateMounts failure → terminal failed with validation errors', async () => {
    installElectronApi({
      selectFolder: async () => ['/host/repo'],
      validateMounts: async () => ({ ok: false, errors: ['Path does not exist'] }),
    })
    const ctx = makeCtx()

    const snapshots: Array<{ status: WizardStepStatus; error?: string }> = []
    const runner = new WizardRunner([configureMountsStep], ctx, (snaps) => {
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
    expect(failed!.error).toMatch(/Path does not exist/)

    await runner.cancel()
  })
})
