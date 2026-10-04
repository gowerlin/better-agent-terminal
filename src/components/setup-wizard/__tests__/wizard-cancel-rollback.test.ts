/**
 * T0426 (BUG-099): cancelling from a failure screen rolls back the failed step
 * itself (it may have got halfway), then the completed steps in reverse order.
 * Before the fix cancel() resolved the failure wait as "retry", so the loop
 * only rolled back completed steps.
 *
 * Also covers the per-step guards that keep those rollbacks safe on a
 * half-executed step (no teardown of things an earlier setup left behind) and
 * BUG-100: SSH start-server / install-server-bundle rollback goes through the
 * now-implemented `ssh.stopServer` / `ssh.uninstallBundle` without throwing.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  WizardRunner,
  WizardStepStatus,
  type WizardContext,
  type WizardStep,
} from '../wizard-runner'
import { installSshServerBundleStep } from '../steps/ssh/install-server-bundle'
import { startServerStep } from '../steps/ssh/start-server'
import { writeSystemdUnitStep } from '../steps/wsl/write-systemd-unit'
import { installDockerServerBundleStep } from '../steps/docker/install-server-bundle'

function makeCtx(overrides: Partial<WizardContext> = {}): WizardContext {
  return {
    targetOS: 'wsl-linux',
    profileDraft: { name: 'cancel-rollback' },
    warnings: [],
    state: {},
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    ...overrides,
  }
}

async function waitForFailed(runner: WizardRunner, stepId: string): Promise<void> {
  await vi.waitFor(() => {
    const snap = runner.getSnapshots().find((s) => s.id === stepId)
    if (snap?.status !== WizardStepStatus.Failed) throw new Error('not failed yet')
  })
}

/** Start the runner, wait for `stepId` to fail, cancel, return the rejection. */
async function cancelAtFailure(runner: WizardRunner, stepId: string): Promise<unknown> {
  const run = runner.run().then(() => null, (err: unknown) => err)
  await waitForFailed(runner, stepId)
  await runner.cancel()
  return run
}

describe('WizardRunner cancel from a failure (T0426 / BUG-099)', () => {
  it('rolls back the failed step first, then completed steps in reverse', async () => {
    const order: string[] = []
    const step = (id: string, fail = false): WizardStep => ({
      id,
      title: id,
      appliesTo: 'all',
      async run() {
        if (fail) throw new Error(`${id} broke`)
      },
      async rollback() {
        order.push(id)
      },
    })
    const runner = new WizardRunner([step('a'), step('b'), step('c', true), step('d')], makeCtx())

    const error = await cancelAtFailure(runner, 'c')

    expect((error as Error).message).toBe('Wizard cancelled')
    expect(order).toEqual(['c', 'b', 'a'])
    const statuses = Object.fromEntries(runner.getSnapshots().map((s) => [s.id, s.status]))
    expect(statuses).toEqual({
      a: WizardStepStatus.RolledBack,
      b: WizardStepStatus.RolledBack,
      c: WizardStepStatus.RolledBack,
      d: WizardStepStatus.Pending,
    })
  })

  it('a throwing failed-step rollback is logged; completed steps are still rolled back', async () => {
    const ctx = makeCtx()
    const completedRollback = vi.fn(async () => undefined)
    const runner = new WizardRunner(
      [
        { id: 'ok', title: 'ok', appliesTo: 'all', async run() {}, rollback: completedRollback },
        {
          id: 'bad',
          title: 'bad',
          appliesTo: 'all',
          async run() { throw new Error('boom') },
          async rollback() { throw new Error('rollback boom') },
        },
      ],
      ctx,
    )

    const error = await cancelAtFailure(runner, 'bad')

    expect((error as Error).message).toBe('Wizard cancelled')
    expect(completedRollback).toHaveBeenCalledTimes(1)
    expect(ctx.logger.warn).toHaveBeenCalledWith('Rollback failed for failed step bad: rollback boom')
    expect(runner.getSnapshots()[1].status).toBe(WizardStepStatus.Failed)
  })

  it('a failed step without rollback() is fine', async () => {
    const completedRollback = vi.fn(async () => undefined)
    const runner = new WizardRunner(
      [
        { id: 'ok', title: 'ok', appliesTo: 'all', async run() {}, rollback: completedRollback },
        { id: 'bad', title: 'bad', appliesTo: 'all', async run() { throw new Error('boom') } },
      ],
      makeCtx(),
    )
    expect(((await cancelAtFailure(runner, 'bad')) as Error).message).toBe('Wizard cancelled')
    expect(completedRollback).toHaveBeenCalledTimes(1)
  })

  it('retry and skip still do not roll the failed step back', async () => {
    let attempts = 0
    const rollback = vi.fn(async () => undefined)
    const flaky: WizardStep = {
      id: 'flaky',
      title: 'flaky',
      appliesTo: 'all',
      async run() {
        attempts += 1
        if (attempts === 1) throw new Error('first try fails')
      },
      rollback,
    }
    const retryRunner = new WizardRunner([flaky], makeCtx())
    const retried = retryRunner.run()
    await waitForFailed(retryRunner, 'flaky')
    await retryRunner.retryCurrentStep()
    await retried
    expect(rollback).not.toHaveBeenCalled()

    const skipRunner = new WizardRunner(
      [{ ...flaky, async run() { throw new Error('always') } }],
      makeCtx(),
    )
    const skipped = skipRunner.run()
    await waitForFailed(skipRunner, 'flaky')
    await skipRunner.skipCurrentStep()
    await skipped
    expect(rollback).not.toHaveBeenCalled()
  })

  it('a non-retryable failure keeps its behaviour: rollback + original error, snapshot stays failed', async () => {
    const rollback = vi.fn(async () => undefined)
    const runner = new WizardRunner(
      [{ id: 'fatal', title: 'fatal', appliesTo: 'all', retryable: false, async run() { throw new Error('fatal error') }, rollback }],
      makeCtx(),
    )
    await expect(runner.run()).rejects.toThrow('fatal error')
    expect(rollback).toHaveBeenCalledTimes(1)
    expect(runner.getSnapshots()[0].status).toBe(WizardStepStatus.Failed)
  })
})

// ── SSH (BUG-100 + half-executed guards) ─────────────────────────────────────

let sshApi: Record<string, ReturnType<typeof vi.fn>>
let distributeMock: ReturnType<typeof vi.fn>

function sshCtx(state: Record<string, unknown> = {}): WizardContext {
  return makeCtx({
    targetOS: 'ssh-linux',
    serverPort: 51820,
    state: {
      sshHost: 'devbox.example',
      sshUser: 'alice',
      sshInstallPath: '~/.local/bat-server',
      sshServerHome: '/home/alice',
      sshServerArch: 'x86_64',
      ...state,
    },
  })
}

describe('SSH rollback through ssh.stopServer / ssh.uninstallBundle (T0426)', () => {
  beforeEach(() => {
    distributeMock = vi.fn(async () => ({ ok: true, tarballPath: 'C:\\cache\\bat-server.tar.gz', source: 'cache' }))
    sshApi = {
      uploadBundle: vi.fn(async () => ({ ok: true })),
      onUploadProgress: vi.fn(() => () => undefined),
      uninstallBundle: vi.fn(async () => ({ ok: true })),
      startServer: vi.fn(async () => ({ ok: true, method: 'systemd', servicePath: '/home/alice/.config/systemd/user/bat-server.service' })),
      onStartProgress: vi.fn(() => () => undefined),
      stopServer: vi.fn(async () => ({ ok: true })),
    }
    ;(globalThis as unknown as { window: unknown }).window = {
      electronAPI: {
        update: { getVersion: vi.fn(async () => '0.5.9') },
        remote: { serverBundle: { distribute: distributeMock, onDistributeProgress: vi.fn(() => () => undefined) } },
        ssh: sshApi,
      },
    }
  })

  afterEach(() => {
    delete (globalThis as unknown as { window?: unknown }).window
  })

  it('a later step fails → cancel → stop-server then uninstall-bundle (remote service + bundle removed)', async () => {
    const order: string[] = []
    sshApi.stopServer.mockImplementation(async () => { order.push('stopServer'); return { ok: true } })
    sshApi.uninstallBundle.mockImplementation(async () => { order.push('uninstallBundle'); return { ok: true } })
    const ctx = sshCtx()
    const failing: WizardStep = { id: 'fetch-fingerprint', title: 'f', appliesTo: 'all', async run() { throw new Error('unreachable') } }
    const runner = new WizardRunner([installSshServerBundleStep, startServerStep, failing], ctx)

    const error = await cancelAtFailure(runner, 'fetch-fingerprint')

    expect((error as Error).message).toBe('Wizard cancelled')
    expect(order).toEqual(['stopServer', 'uninstallBundle'])
    expect(sshApi.stopServer).toHaveBeenCalledWith({
      sshHost: 'devbox.example',
      sshUser: 'alice',
      sshPort: undefined,
      sshKeyPath: undefined,
      targetOS: 'ssh-linux',
      serverHome: '/home/alice',
    })
    expect(sshApi.uninstallBundle.mock.calls[0][0]).toMatchObject({ installPath: '/home/alice/.local/bat-server' })
    expect(ctx.logger.warn).not.toHaveBeenCalled()
    expect(ctx.systemdServiceActive).toBe(false)
  })

  it('start-server fails on the remote → cancel rolls it back too (stop-server is idempotent)', async () => {
    sshApi.startServer.mockResolvedValue({ ok: false, method: 'failed', servicePath: '', errorCode: 'enable-failed', error: 'enable-failed: nope' })
    const runner = new WizardRunner([installSshServerBundleStep, startServerStep], sshCtx())

    await cancelAtFailure(runner, 'start-server')

    expect(sshApi.stopServer).toHaveBeenCalledTimes(1)
    expect(sshApi.uninstallBundle).toHaveBeenCalledTimes(1)
  })

  it('start-server fails before reaching the remote → its rollback leaves the remote alone', async () => {
    const ctx = sshCtx({ sshServerHome: '/home/alice', sshInstallPath: undefined })
    await expect(startServerStep.run(ctx)).rejects.toThrow(/Install path/)
    await startServerStep.rollback!(ctx)
    expect(sshApi.stopServer).not.toHaveBeenCalled()
  })

  it('install fails before the upload (download) → rollback does not delete an existing bundle', async () => {
    distributeMock.mockResolvedValue({ ok: false, errorCode: 'download-failed', error: 'offline' })
    const ctx = sshCtx()
    await expect(installSshServerBundleStep.run(ctx)).rejects.toThrow(/download-failed/)
    await installSshServerBundleStep.rollback!(ctx)
    expect(sshApi.uninstallBundle).not.toHaveBeenCalled()
  })

  it('install fails during the upload → rollback removes the partial bundle', async () => {
    sshApi.uploadBundle.mockResolvedValue({ ok: false, error: 'tar: unexpected EOF' })
    const ctx = sshCtx()
    await expect(installSshServerBundleStep.run(ctx)).rejects.toThrow(/unexpected EOF/)
    await installSshServerBundleStep.rollback!(ctx)
    expect(sshApi.uninstallBundle.mock.calls[0][0]).toMatchObject({ installPath: '/home/alice/.local/bat-server' })
  })

  it('a failing stop-server IPC is a warning, never a throw', async () => {
    sshApi.stopServer.mockResolvedValue({ ok: false, error: 'stop-server-failed: timed out' })
    const ctx = sshCtx()
    await startServerStep.run(ctx)
    await expect(startServerStep.rollback!(ctx)).resolves.toBeUndefined()
    expect(ctx.logger.warn).toHaveBeenCalledWith('Failed to stop bat-server over SSH (ssh-linux): stop-server-failed: timed out')
  })
})

// ── WSL / Docker half-executed guards ────────────────────────────────────────

describe('WSL write-systemd-unit rollback on a half-executed step (T0426)', () => {
  let wslSystemd: Record<string, ReturnType<typeof vi.fn>>
  let wsl: Record<string, ReturnType<typeof vi.fn>>

  beforeEach(() => {
    wslSystemd = {
      writeUnit: vi.fn(async () => ({ ok: true })),
      enableLinger: vi.fn(async () => ({ ok: false, error: 'No such device or address' })),
      startService: vi.fn(async () => ({ ok: true, token: 't' })),
      removeUnit: vi.fn(async () => ({ ok: true })),
    }
    wsl = {
      resolveHome: vi.fn(async () => '/home/tester'),
      pickServerPort: vi.fn(async () => ({ ok: true, port: 9877 })),
      keepAlive: vi.fn(async () => ({ ok: true })),
      releaseKeepAlive: vi.fn(async () => ({ ok: true })),
    }
    ;(globalThis as unknown as { window: unknown }).window = { electronAPI: { platform: 'win32', wsl, wslSystemd } }
  })

  afterEach(() => {
    delete (globalThis as unknown as { window?: unknown }).window
  })

  const wslCtx = () => makeCtx({ wslDistro: 'Ubuntu', serverInstallPath: '/home/tester/.local/bat-server', wslSystemdEnabled: true })

  it('failure after the unit was written (linger) → cancel removes the unit and releases the distro', async () => {
    const runner = new WizardRunner([writeSystemdUnitStep], wslCtx())
    await cancelAtFailure(runner, 'write-systemd-unit')
    expect(wslSystemd.removeUnit).toHaveBeenCalledWith('Ubuntu', 'bat-server.service', { path: '/home/tester/.config/systemd/user/bat-server.service' })
    expect(wsl.releaseKeepAlive).toHaveBeenCalledWith('Ubuntu')
  })

  it('failure before the unit was written (port pick) → cancel leaves an existing unit alone', async () => {
    wsl.pickServerPort.mockResolvedValue({ ok: false, errorCode: 'wsl-port-in-use', error: 'no free port' })
    const runner = new WizardRunner([writeSystemdUnitStep], wslCtx())
    await cancelAtFailure(runner, 'write-systemd-unit')
    expect(wslSystemd.writeUnit).not.toHaveBeenCalled()
    expect(wslSystemd.removeUnit).not.toHaveBeenCalled()
  })
})

describe('Docker install-server-bundle rollback on a failed re-run (T0426)', () => {
  let execCommand: ReturnType<typeof vi.fn>

  beforeEach(() => {
    execCommand = vi.fn(async () => ({ ok: true }))
    ;(globalThis as unknown as { window: unknown }).window = {
      electronAPI: { docker: { inspectContainer: vi.fn(async () => ({ image: null })), execCommand } },
    }
  })

  afterEach(() => {
    delete (globalThis as unknown as { window?: unknown }).window
  })

  it('does not reuse the install path from an earlier attempt', async () => {
    const ctx = makeCtx({
      targetOS: 'docker-linux',
      serverInstallPath: '/opt/bat-server', // left by an earlier successful attempt
      state: { containerMode: 'existing', dockerContainer: 'my-dev' },
    })
    await expect(installDockerServerBundleStep.run(ctx)).rejects.toThrow(/Unable to inspect/)
    await installDockerServerBundleStep.rollback!(ctx)
    expect(execCommand).not.toHaveBeenCalled()
  })
})
