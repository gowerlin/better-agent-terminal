/**
 * T0830 (PLAN-043): every wizard step can be stopped while it runs.
 *
 * Runner (mock steps):
 *   - cancel() during a running step fires ctx.signal, shows `aborting`, waits for the step to settle,
 *     rolls back the aborted step and then the completed steps in reverse, rejects "Wizard cancelled";
 *     the aborted step ends `aborted` (rolled back), never on the failure screen
 *   - a step that ignores the signal: rollback starts only after it settles; `abortSlow` after
 *     WIZARD_ABORT_SLOW_NOTICE_MS; a step that resolves after the abort is still rolled back
 *   - a pending prompt (input-kind or not) rejects on abort (it used to wait forever)
 *   - a throw after the abort ends as "cancelled", not as the step's error
 *   - between steps / on the failure screen cancel() behaves as before (T0426); retry gets a fresh signal
 *   - ctx.signal is set only while a step runs
 * runAbortableOperation / WizardOperationRegistry:
 *   - no signal → the call gets no operation id; abort → wizard.abortOperation(id); aborted before → no call
 *   - registry: begin/abort/end, early abort remembered (TTL, cap), invalid ids ignored
 * WSL steps with a fake main (abortOperation ends the pending child):
 *   - install-server-bundle: abort during the download / the install → the child is ended, nothing recorded,
 *     nothing deleted; an install that finished despite the abort is recorded and rolled back
 *   - write-systemd-unit: abort during the start check → the unit written by this run is removed and the
 *     keep-alive pin released
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  WIZARD_ABORT_SLOW_NOTICE_MS,
  WIZARD_CANCELLED_MESSAGE,
  WIZARD_STEP_ABORTED_MESSAGE,
  WizardRunner,
  WizardStepStatus,
  throwIfWizardAborted,
  type WizardContext,
  type WizardStep,
} from '../wizard-runner'
import { runAbortableOperation } from '../wizard-abort'
import {
  WIZARD_EARLY_ABORT_MAX,
  WIZARD_EARLY_ABORT_TTL_MS,
  WizardOperationRegistry,
} from '../wizard-operation-registry'
import { installServerBundleStep } from '../steps/wsl/install-server-bundle'
import { writeSystemdUnitStep } from '../steps/wsl/write-systemd-unit'

function makeCtx(overrides: Partial<WizardContext> = {}): WizardContext {
  return {
    targetOS: 'wsl-linux',
    profileDraft: { name: 'abort' },
    warnings: [],
    state: {},
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    ...overrides,
  }
}

async function waitForStatus(runner: WizardRunner, stepId: string, status: WizardStepStatus): Promise<void> {
  await vi.waitFor(() => {
    const snap = runner.getSnapshots().find((s) => s.id === stepId)
    if (snap?.status !== status) throw new Error(`${stepId} is ${snap?.status}`)
  })
}

const snapOf = (runner: WizardRunner, id: string) => runner.getSnapshots().find((s) => s.id === id)!

/** A step whose run() waits for ctx.signal (like an abortable IPC call), then throws the abort error. */
function abortableStep(id: string, order: string[]): WizardStep {
  return {
    id,
    title: id,
    appliesTo: 'all',
    async run(ctx) {
      order.push(`${id}:run`)
      await new Promise<void>((resolve) => ctx.signal!.addEventListener('abort', () => resolve(), { once: true }))
      order.push(`${id}:child-ended`)
      throwIfWizardAborted(ctx)
    },
    async rollback() { order.push(`${id}:rollback`) },
  }
}

const okStep = (id: string, order: string[]): WizardStep => ({
  id,
  title: id,
  appliesTo: 'all',
  async run() { order.push(`${id}:run`) },
  async rollback() { order.push(`${id}:rollback`) },
})

afterEach(() => {
  vi.useRealTimers()
  delete (globalThis as unknown as { window?: unknown }).window
})

describe('WizardRunner step abort (T0830)', () => {
  it('aborts the running step, then rolls it back and the completed steps in reverse', async () => {
    const order: string[] = []
    const ctx = makeCtx()
    const snapshots: Array<{ id: string; status: string; aborting?: boolean }> = []
    const runner = new WizardRunner(
      [okStep('a', order), okStep('b', order), abortableStep('c', order), okStep('d', order)],
      ctx,
      (snaps) => { const c = snaps[2]; snapshots.push({ id: c.id, status: c.status, aborting: c.aborting }) },
    )
    const run = runner.run().then(() => null, (err: unknown) => err)
    await waitForStatus(runner, 'c', WizardStepStatus.Running)
    expect(ctx.signal?.aborted).toBe(false)

    await runner.cancel()
    const err = await run
    expect((err as Error).message).toBe(WIZARD_CANCELLED_MESSAGE)
    expect(order).toEqual(['a:run', 'b:run', 'c:run', 'c:child-ended', 'c:rollback', 'b:rollback', 'a:rollback'])
    expect(snapshots.some((s) => s.aborting === true)).toBe(true)
    const c = snapOf(runner, 'c')
    expect(c.status).toBe(WizardStepStatus.RolledBack)
    expect(c.aborted).toBe(true)
    expect(c.aborting).toBe(false)
    expect(c.error).toBe(WIZARD_STEP_ABORTED_MESSAGE)
    expect(c.mappedError).toBeUndefined()
    expect(snapOf(runner, 'd').status).toBe(WizardStepStatus.Pending)
    expect(ctx.signal).toBeUndefined()
  })

  it('a step without rollback ends failed + aborted (no retry / skip offered: the run is over)', async () => {
    const order: string[] = []
    const step = { ...abortableStep('c', order), rollback: undefined }
    const runner = new WizardRunner([okStep('a', order), step], makeCtx())
    const run = runner.run().then(() => null, (err: unknown) => err)
    await waitForStatus(runner, 'c', WizardStepStatus.Running)
    await runner.cancel()
    expect(((await run) as Error).message).toBe(WIZARD_CANCELLED_MESSAGE)
    expect(snapOf(runner, 'c')).toMatchObject({ status: WizardStepStatus.Failed, aborted: true })
    expect(order).toEqual(['a:run', 'c:run', 'c:child-ended', 'a:rollback'])
  })

  it('waits for a step that ignores the signal; rollback only after it settles; abortSlow after the notice delay', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const order: string[] = []
    let finish: (() => void) | null = null
    const stubborn: WizardStep = {
      id: 's',
      title: 's',
      appliesTo: 'all',
      async run() {
        order.push('s:run')
        await new Promise<void>((resolve) => { finish = resolve })
        order.push('s:done') // resolves normally (e.g. an IPC call that cannot be interrupted)
      },
      async rollback() { order.push('s:rollback') },
    }
    const runner = new WizardRunner([okStep('a', order), stubborn], makeCtx())
    const run = runner.run().then(() => null, (err: unknown) => err)
    for (let i = 0; i < 10 && !finish; i += 1) await Promise.resolve()
    expect(finish).not.toBeNull()

    await runner.cancel()
    expect(snapOf(runner, 's').aborting).toBe(true)
    expect(snapOf(runner, 's').abortSlow).toBeFalsy()
    vi.advanceTimersByTime(WIZARD_ABORT_SLOW_NOTICE_MS)
    expect(snapOf(runner, 's').abortSlow).toBe(true)
    expect(order).toEqual(['a:run', 's:run'])

    finish!()
    expect(((await run) as Error).message).toBe(WIZARD_CANCELLED_MESSAGE)
    expect(order).toEqual(['a:run', 's:run', 's:done', 's:rollback', 'a:rollback'])
    expect(snapOf(runner, 's')).toMatchObject({ status: WizardStepStatus.RolledBack, aborted: true, abortSlow: false })
  })

  it.each([
    ['input-kind step', 'input' as const],
    ['task step that prompts', 'task' as const],
  ])('a pending prompt rejects on abort (%s)', async (_name, kind) => {
    const order: string[] = []
    const prompting: WizardStep = {
      id: 'p',
      title: 'p',
      appliesTo: 'all',
      kind,
      async run(ctx) {
        order.push('p:ask')
        await ctx.requestChoice!({ stepId: 'p', title: 'pick', options: [{ label: 'x', value: 'x' }] })
        order.push('p:answered')
      },
    }
    const ctx = makeCtx({ requestChoice: () => new Promise<string | null>(() => undefined) })
    const original = ctx.requestChoice
    const runner = new WizardRunner([okStep('a', order), prompting], ctx)
    const run = runner.run().then(() => null, (err: unknown) => err)
    await vi.waitFor(() => { if (!order.includes('p:ask')) throw new Error('not asked') })
    await runner.cancel()
    expect(((await run) as Error).message).toBe(WIZARD_CANCELLED_MESSAGE)
    expect(order).toEqual(['a:run', 'p:ask', 'a:rollback'])
    expect(ctx.requestChoice).toBe(original)
  })

  it('a throw after the abort ends as "cancelled", not as the step error or the failure screen', async () => {
    const order: string[] = []
    const thrower: WizardStep = {
      id: 't',
      title: 't',
      appliesTo: 'all',
      async run(ctx) {
        await new Promise<void>((resolve) => ctx.signal!.addEventListener('abort', () => resolve(), { once: true }))
        throw new Error('child killed: exit 143')
      },
      async rollback() { order.push('t:rollback') },
    }
    const runner = new WizardRunner([thrower], makeCtx())
    const run = runner.run().then(() => null, (err: unknown) => err)
    await waitForStatus(runner, 't', WizardStepStatus.Running)
    await runner.cancel()
    expect(((await run) as Error).message).toBe(WIZARD_CANCELLED_MESSAGE)
    expect(snapOf(runner, 't')).toMatchObject({ aborted: true, error: WIZARD_STEP_ABORTED_MESSAGE, status: WizardStepStatus.RolledBack })
  })

  it('cancel from the failure screen is unchanged (T0426); a retry gets a fresh, unaborted signal', async () => {
    const order: string[] = []
    const signals: AbortSignal[] = []
    let attempts = 0
    const flaky: WizardStep = {
      id: 'f',
      title: 'f',
      appliesTo: 'all',
      async run(ctx) {
        signals.push(ctx.signal!)
        attempts += 1
        throw new Error(`broke ${attempts}`)
      },
      async rollback() { order.push('f:rollback') },
    }
    const runner = new WizardRunner([okStep('a', order), flaky], makeCtx())
    const run = runner.run().then(() => null, (err: unknown) => err)
    await waitForStatus(runner, 'f', WizardStepStatus.Failed)
    await runner.retryCurrentStep()
    await vi.waitFor(() => { if (attempts < 2) throw new Error('no retry yet') })
    await waitForStatus(runner, 'f', WizardStepStatus.Failed)
    expect(signals).toHaveLength(2)
    expect(signals[0]).not.toBe(signals[1])
    expect(signals.every((s) => !s.aborted)).toBe(true)

    await runner.cancel()
    expect(((await run) as Error).message).toBe(WIZARD_CANCELLED_MESSAGE)
    expect(order).toEqual(['a:run', 'f:rollback', 'a:rollback'])
    expect(snapOf(runner, 'f').aborted).toBeFalsy()
  })

  it('a completed run leaves no signal on ctx', async () => {
    const ctx = makeCtx()
    const seen: Array<AbortSignal | undefined> = []
    await new WizardRunner([{ id: 'x', title: 'x', appliesTo: 'all', async run(c) { seen.push(c.signal) } }], ctx).run()
    expect(seen[0]).toBeInstanceOf(AbortSignal)
    expect(ctx.signal).toBeUndefined()
  })
})

describe('runAbortableOperation (T0830)', () => {
  it('no signal: the call gets no operation id and nothing is aborted', async () => {
    const abortOperation = vi.fn()
    ;(globalThis as unknown as { window: unknown }).window = { electronAPI: { wizard: { abortOperation } } }
    const call = vi.fn(async (id: string | undefined) => id)
    await expect(runAbortableOperation(undefined, call)).resolves.toBeUndefined()
    expect(abortOperation).not.toHaveBeenCalled()
  })

  it('abort while the call runs sends wizard.abortOperation(id) once', async () => {
    const abortOperation = vi.fn(async () => ({ ok: true, found: true }))
    ;(globalThis as unknown as { window: unknown }).window = { electronAPI: { wizard: { abortOperation } } }
    const controller = new AbortController()
    let id: string | undefined
    let release: (() => void) | null = null
    const pending = runAbortableOperation(controller.signal, (operationId) => {
      id = operationId
      return new Promise<string>((resolve) => { release = () => resolve('done') })
    })
    expect(id).toMatch(/^[A-Za-z0-9_-]{8,64}$/)
    controller.abort()
    controller.abort()
    expect(abortOperation).toHaveBeenCalledTimes(1)
    expect(abortOperation).toHaveBeenCalledWith(id)
    release!()
    await expect(pending).resolves.toBe('done')
  })

  it('an already-aborted signal throws without calling', async () => {
    const controller = new AbortController()
    controller.abort()
    const call = vi.fn()
    await expect(runAbortableOperation(controller.signal, call)).rejects.toThrow(WIZARD_STEP_ABORTED_MESSAGE)
    expect(call).not.toHaveBeenCalled()
  })
})

describe('WizardOperationRegistry (T0830)', () => {
  it('begin → abort → signal aborted; end unregisters', () => {
    const registry = new WizardOperationRegistry()
    const op = registry.begin('op-12345678')
    expect(op.signal?.aborted).toBe(false)
    expect(registry.abort('op-12345678')).toBe(true)
    expect(op.signal?.aborted).toBe(true)
    op.end()
    op.end()
    expect(registry.size).toBe(0)
  })

  it('no / invalid id: no signal, abort ignored', () => {
    const registry = new WizardOperationRegistry()
    for (const id of [undefined, '', 'short', 'has space 123', '../../etc/passwd', 42, 'x'.repeat(65)]) {
      expect(registry.begin(id).signal).toBeUndefined()
      expect(registry.abort(id)).toBe(false)
    }
    expect(registry.size).toBe(0)
  })

  it('an abort that arrives first is remembered; it expires after the TTL; the list is capped', () => {
    let now = 1_000
    const registry = new WizardOperationRegistry(() => now)
    expect(registry.abort('early-0001')).toBe(false)
    expect(registry.begin('early-0001').signal?.aborted).toBe(true)
    expect(registry.begin('early-0001').signal?.aborted).toBe(false) // used up

    registry.abort('early-0002')
    now += WIZARD_EARLY_ABORT_TTL_MS
    expect(registry.begin('early-0002').signal?.aborted).toBe(false)

    for (let i = 0; i <= WIZARD_EARLY_ABORT_MAX; i += 1) registry.abort(`cap-${String(i).padStart(6, '0')}`)
    expect(registry.begin('cap-000000').signal?.aborted).toBe(false) // oldest dropped
    expect(registry.begin(`cap-${String(WIZARD_EARLY_ABORT_MAX).padStart(6, '0')}`).signal?.aborted).toBe(true)
  })
})

// ── WSL steps with a fake main process ──────────────────────────────────────

interface Pending { channel: string; resolve: (value: unknown) => void; aborted: unknown }

function installFakeMain(options: { finishInstallDespiteAbort?: boolean } = {}) {
  const calls: string[] = []
  const pending = new Map<string, Pending>()
  const ended: string[] = []
  const hold = (channel: string, operationId: string | undefined, aborted: unknown, fallback: unknown) => {
    calls.push(channel)
    if (!operationId) return Promise.resolve(fallback)
    return new Promise((resolve) => pending.set(operationId, { channel, resolve, aborted }))
  }
  const finish = (channel: string, value: unknown) => {
    for (const [id, p] of pending) {
      if (p.channel === channel) { pending.delete(id); p.resolve(value) }
    }
  }
  const record = (name: string, value: unknown) => vi.fn(async () => { calls.push(name); return value })
  const api = {
    platform: 'win32',
    update: { getVersion: vi.fn(async () => '0.7.4') },
    remote: {
      serverBundle: {
        distribute: vi.fn((opts: { operationId?: string }) => hold('distribute', opts.operationId,
          { ok: false, errorCode: 'aborted', error: 'Aborted' },
          { ok: true, tarballPath: 'C:\\cache\\b.tar.gz', source: 'cache' })),
        onDistributeProgress: vi.fn(() => () => undefined),
      },
    },
    wizard: {
      // the fake main ends the child of that operation, as main.ts does via the registry
      abortOperation: vi.fn(async (id: string) => {
        const p = pending.get(id)
        if (!p) return { ok: true, found: false }
        ended.push(p.channel)
        if (p.channel === 'installBundle' && options.finishInstallDespiteAbort) return { ok: true, found: true }
        pending.delete(id)
        p.resolve(p.aborted)
        return { ok: true, found: true }
      }),
    },
    wsl: {
      resolveHome: vi.fn(async () => '/home/demo'),
      installBundle: vi.fn((_d: string, _t: string, _r: string, opts: { operationId?: string }) => hold('installBundle', opts.operationId,
        { ok: false, error: 'Server bundle install aborted', aborted: true }, { ok: true, previous: 'none' })),
      uninstallBundle: record('uninstallBundle', { ok: true }),
      restoreBundle: record('restoreBundle', { ok: true, outcome: 'restored' }),
      detectNetworkMode: vi.fn(async () => ({ actual: 'mirrored', declared: 'mirrored', mirroredSupported: true })),
      pickServerPort: vi.fn(async () => ({ ok: true, port: 9877 })),
      keepAlive: record('keepAlive', { ok: true }),
      releaseKeepAlive: record('releaseKeepAlive', { ok: true }),
    },
    wslSystemd: {
      snapshotUnit: vi.fn(async () => ({ ok: true, content: null, active: false, enabled: false })),
      writeUnit: record('writeUnit', { ok: true }),
      enableLinger: vi.fn(async () => ({ ok: true })),
      startService: vi.fn((_d: string, _s: string, opts: { operationId?: string }) => hold('startService', opts.operationId,
        { ok: false, error: 'Service start aborted', errorCode: 'wsl-service-start-aborted' }, { ok: true, token: 't' })),
      removeUnit: record('removeUnit', { ok: true }),
      restoreUnit: record('restoreUnit', { ok: true }),
    },
  }
  ;(globalThis as unknown as { window: unknown }).window = { electronAPI: api }
  return { api, calls, ended, finish, isPending: (channel: string) => [...pending.values()].some((p) => p.channel === channel) }
}

const wslCtx = () => makeCtx({ wslDistro: 'Ubuntu-24.04', serverInstallPath: '~/.local/bat-server', wslSystemdEnabled: true })

describe('WSL steps abort their child process in main (T0830)', () => {
  it('install-server-bundle: abort during the download ends it; nothing installed or deleted', async () => {
    const main = installFakeMain()
    const runner = new WizardRunner([installServerBundleStep], wslCtx())
    const run = runner.run().then(() => null, (err: unknown) => err)
    await vi.waitFor(() => { if (!main.isPending('distribute')) throw new Error('not downloading') })
    await runner.cancel()
    expect(((await run) as Error).message).toBe(WIZARD_CANCELLED_MESSAGE)
    expect(main.ended).toEqual(['distribute'])
    expect(main.api.wsl.installBundle).not.toHaveBeenCalled()
    expect(main.calls).not.toContain('uninstallBundle')
  })

  it('install-server-bundle: abort during the install ends it; nothing recorded, nothing deleted', async () => {
    const main = installFakeMain()
    const ctx = wslCtx()
    const runner = new WizardRunner([installServerBundleStep], ctx)
    const run = runner.run().then(() => null, (err: unknown) => err)
    await vi.waitFor(() => { if (!main.isPending('distribute')) throw new Error('not downloading') })
    main.finish('distribute', { ok: true, tarballPath: 'C:\\cache\\b.tar.gz', source: 'cache' })
    await vi.waitFor(() => { if (!main.isPending('installBundle')) throw new Error('not installing') })
    const [, , , opts] = main.api.wsl.installBundle.mock.calls[0] as [string, string, string, { keepPrevious: boolean; operationId: string }]
    expect(opts).toEqual({ keepPrevious: true, operationId: expect.any(String) })
    await runner.cancel()
    expect(((await run) as Error).message).toBe(WIZARD_CANCELLED_MESSAGE)
    expect(main.ended).toEqual(['installBundle'])
    expect(main.calls).not.toContain('uninstallBundle')
    expect(main.calls).not.toContain('restoreBundle')
    expect(ctx.state.wslBundleInstall).toBeUndefined()
  })

  it('install-server-bundle: an install that finished despite the abort is recorded and rolled back', async () => {
    const main = installFakeMain({ finishInstallDespiteAbort: true })
    const runner = new WizardRunner([installServerBundleStep], wslCtx())
    const run = runner.run().then(() => null, (err: unknown) => err)
    await vi.waitFor(() => { if (!main.isPending('distribute')) throw new Error('not downloading') })
    main.finish('distribute', { ok: true, tarballPath: 'C:\\cache\\b.tar.gz', source: 'cache' })
    await vi.waitFor(() => { if (!main.isPending('installBundle')) throw new Error('not installing') })
    await runner.cancel()
    main.finish('installBundle', { ok: true, previous: 'none' })
    expect(((await run) as Error).message).toBe(WIZARD_CANCELLED_MESSAGE)
    expect(main.calls).toContain('uninstallBundle')
    expect(main.api.wsl.detectNetworkMode).not.toHaveBeenCalled()
  })

  it('write-systemd-unit: abort during the start check ends it; the unit this run wrote is removed', async () => {
    const main = installFakeMain()
    const ctx = wslCtx()
    ctx.serverInstallPath = '/home/demo/.local/bat-server'
    const runner = new WizardRunner([writeSystemdUnitStep], ctx)
    const run = runner.run().then(() => null, (err: unknown) => err)
    await vi.waitFor(() => { if (!main.isPending('startService')) throw new Error('not starting') })
    await runner.cancel()
    expect(((await run) as Error).message).toBe(WIZARD_CANCELLED_MESSAGE)
    expect(main.ended).toEqual(['startService'])
    expect(main.calls).toEqual(expect.arrayContaining(['writeUnit', 'keepAlive', 'removeUnit', 'releaseKeepAlive']))
    expect(main.calls.indexOf('removeUnit')).toBeGreaterThan(main.calls.indexOf('startService'))
    expect(snapOf(runner, 'write-systemd-unit')).toMatchObject({ aborted: true, status: WizardStepStatus.RolledBack })
  })
})
