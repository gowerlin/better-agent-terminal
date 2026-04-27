/**
 * T0335 (PLAN-032 Sprint 3, BUG-074): regression tests for the SSH
 * configure-ssh-host step. Verifies the empty-host throw is deferred
 * until the user actively submits via ctx.requestChoice and that the
 * structured errorCode reaches WizardErrorMapper.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { configureSshHostStep } from '../steps/ssh/configure-host'
import {
  DEFAULT_WIZARD_ERROR_REGISTRY,
  resolveWizardError,
} from '../error-mapper'
import {
  WizardRunner,
  WizardStepStatus,
  type WizardChoiceRequest,
  type WizardContext,
} from '../wizard-runner'

function installElectronApi(hosts: string[]) {
  const listHosts = vi.fn().mockResolvedValue(hosts)
  ;(globalThis as unknown as { window: typeof window }).window =
    (globalThis as unknown as { window?: typeof window }).window ??
    ({} as typeof window)
  ;(window as unknown as { electronAPI: { ssh: { listHosts: typeof listHosts } } }).electronAPI = {
    ssh: { listHosts },
  } as never
  return listHosts
}

function makeCtx(overrides: Partial<WizardContext> = {}): WizardContext {
  return {
    targetOS: 'ssh-linux',
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

function waitForStatus(
  states: WizardStepStatus[],
  target: WizardStepStatus,
): Promise<void> {
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

describe('configure-ssh-host (T0335 / BUG-074)', () => {
  it('AC-5 #1: open with aliases + requestChoice -> awaiting-input, no throw', async () => {
    installElectronApi(['alias-a', 'alias-b'])
    const states: WizardStepStatus[] = []

    const ctx = makeCtx()
    ctx.requestChoice = (_req: WizardChoiceRequest) =>
      new Promise<string | null>(() => undefined)

    const runner = new WizardRunner([configureSshHostStep], ctx, (snaps) => {
      states.push(snaps[0].status)
    })
    void runner.run()
    await waitForStatus(states, WizardStepStatus.AwaitingInput)

    expect(states.includes(WizardStepStatus.AwaitingInput)).toBe(true)
    expect(states.includes(WizardStepStatus.Failed)).toBe(false)

    await runner.cancel()
  })

  it('AC-5 #3: user picks alias -> succeeded + state.sshHost set + profileDraft populated', async () => {
    installElectronApi(['my-alias'])
    let resolveChoice: ((v: string | null) => void) | null = null

    const ctx = makeCtx()
    ctx.requestChoice = (_req: WizardChoiceRequest) =>
      new Promise<string | null>((resolve) => {
        resolveChoice = resolve
      })

    const states: WizardStepStatus[] = []
    const runner = new WizardRunner([configureSshHostStep], ctx, (snaps) => {
      states.push(snaps[0].status)
    })
    const p = runner.run()
    await waitForStatus(states, WizardStepStatus.AwaitingInput)
    resolveChoice!('my-alias')
    await p

    expect(states[states.length - 1]).toBe(WizardStepStatus.Succeeded)
    expect((ctx.state as { sshHost?: string }).sshHost).toBe('my-alias')
    expect((ctx.state as { sshAlias?: string }).sshAlias).toBe('my-alias')
    expect((ctx.profileDraft as { sshHost?: string }).sshHost).toBe('my-alias')
  })

  it('AC-5 #4: user submits empty -> failed with errorCode + mappedError matchId', async () => {
    installElectronApi(['only-alias'])
    const ctx = makeCtx()
    ctx.requestChoice = async () => null

    const snapshots: Array<{ status: WizardStepStatus; error?: string; mappedErrorMatchId?: string | null }> = []
    const runner = new WizardRunner([configureSshHostStep], ctx, (snaps) => {
      const s = snaps[0]
      snapshots.push({
        status: s.status,
        error: s.error,
        mappedErrorMatchId: s.mappedError?.matchId ?? undefined,
      })
    })
    const p = runner.run()
    p.catch(() => undefined) // suppress unhandled rejection (cancel() races with throw)
    await new Promise<void>((resolve) => {
      const tick = () => {
        if (snapshots.some((s) => s.status === WizardStepStatus.Failed)) resolve()
        else setTimeout(tick, 5)
      }
      tick()
    })

    const failed = snapshots.find((s) => s.status === WizardStepStatus.Failed)
    expect(failed).toBeDefined()
    expect(failed!.error).toMatch(/SSH host is required/)
    expect(failed!.mappedErrorMatchId).toBe('ssh-configure-host-empty')
  })

  it('AC-5 #5 (legacy): no requestChoice in ctx + empty host -> throws with structured errorCode', async () => {
    installElectronApi([])
    const ctx = makeCtx()

    const snapshots: Array<{ status: WizardStepStatus; mappedErrorMatchId?: string | null; error?: string }> = []
    const runner = new WizardRunner([configureSshHostStep], ctx, (snaps) => {
      const s = snaps[0]
      snapshots.push({
        status: s.status,
        mappedErrorMatchId: s.mappedError?.matchId ?? undefined,
        error: s.error,
      })
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
    expect(failed!.mappedErrorMatchId).toBe('ssh-configure-host-empty')
    expect(failed!.error).toMatch(/SSH host is required/)
  })

  it('AC-5 #6: pre-set sshHost short-circuits the prompt and succeeds without calling requestChoice', async () => {
    installElectronApi(['unused-alias'])
    const requestChoice = vi.fn().mockResolvedValue(null)

    const ctx = makeCtx({ state: { sshHost: 'pre-set-host' } })
    ctx.requestChoice = requestChoice as unknown as WizardContext['requestChoice']

    const states: WizardStepStatus[] = []
    const runner = new WizardRunner([configureSshHostStep], ctx, (snaps) => {
      states.push(snaps[0].status)
    })
    await runner.run()
    expect(states[states.length - 1]).toBe(WizardStepStatus.Succeeded)
    expect(requestChoice).not.toHaveBeenCalled()
  })

  it('AC-3 errorCode mapping: configure-host-empty resolves to ssh-configure-host-empty entry with edit-config + cancel actions', () => {
    const mapped = resolveWizardError(
      {
        platform: 'ssh',
        stepId: 'configure-ssh-host',
        errorCode: 'configure-host-empty',
        error: new Error('SSH host is required (pick an alias from ~/.ssh/config or type host).'),
      },
      DEFAULT_WIZARD_ERROR_REGISTRY,
    )
    expect(mapped.matchId).toBe('ssh-configure-host-empty')
    expect(mapped.title).toBe('SSH 主機名稱為必填')
    expect(mapped.detailMode).toBe('hidden-by-default')
    const kinds = mapped.actions.map((a) => a.kind)
    expect(kinds).toContain('edit-config')
    expect(kinds).toContain('cancel')
  })

  it('AC-3 regex fallback: missing errorCode but matching pattern still resolves to ssh-configure-host-empty', () => {
    const mapped = resolveWizardError(
      {
        platform: 'ssh',
        stepId: 'configure-ssh-host',
        error: new Error('SSH host is required (no errorCode)'),
      },
      DEFAULT_WIZARD_ERROR_REGISTRY,
    )
    expect(mapped.matchId).toBe('ssh-configure-host-empty')
  })
})
