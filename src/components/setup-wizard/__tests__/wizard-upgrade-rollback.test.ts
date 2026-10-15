/**
 * T0554 (BUG-141): re-running the WSL / SSH wizard on a working server is an
 * upgrade. If a step after the install fails and the user cancels, rollback
 * used to delete the whole install (T0489) after T0552 had already swapped the
 * previous one out, so the server was gone. Now an upgrade puts the previous
 * bundle, unit and service state back; a first install is still removed; a
 * finished wizard removes the kept previous bundle (WizardStep.finalize).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WizardRunner, WizardStepStatus, type WizardContext, type WizardStep } from '../wizard-runner'
import { installServerBundleStep } from '../steps/wsl/install-server-bundle'
import { writeSystemdUnitStep } from '../steps/wsl/write-systemd-unit'
import { installSshServerBundleStep } from '../steps/ssh/install-server-bundle'
import { startServerStep } from '../steps/ssh/start-server'

function makeCtx(overrides: Partial<WizardContext> = {}): WizardContext {
  return {
    targetOS: 'wsl-linux',
    profileDraft: { name: 'upgrade' },
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

async function cancelAtFailure(runner: WizardRunner, stepId: string): Promise<unknown> {
  const run = runner.run().then(() => null, (err: unknown) => err)
  await waitForStatus(runner, stepId, WizardStepStatus.Failed)
  await runner.cancel()
  return run
}

function failingStep(id = 'fetch-fingerprint'): WizardStep {
  return { id, title: id, appliesTo: 'all', async run() { throw new Error('unreachable') } }
}

const okStep = (id: string): WizardStep => ({ id, title: id, appliesTo: 'all', async run() {} })

describe('WizardRunner.finalize (T0554)', () => {
  it('runs finalize in step order once every step succeeded', async () => {
    const order: string[] = []
    const step = (id: string): WizardStep => ({ id, title: id, appliesTo: 'all', async run() {}, async finalize() { order.push(id) } })
    await new WizardRunner([step('a'), okStep('b'), step('c')], makeCtx()).run()
    expect(order).toEqual(['a', 'c'])
  })

  it('never finalizes a cancelled run', async () => {
    const finalize = vi.fn(async () => undefined)
    const runner = new WizardRunner([{ ...okStep('a'), finalize }, failingStep()], makeCtx())
    await cancelAtFailure(runner, 'fetch-fingerprint')
    expect(finalize).not.toHaveBeenCalled()
  })

  it('a throwing finalize is a warning; the wizard still completes', async () => {
    const ctx = makeCtx()
    const later = vi.fn(async () => undefined)
    await expect(new WizardRunner([
      { ...okStep('a'), async finalize() { throw new Error('cleanup boom') } },
      { ...okStep('b'), finalize: later },
    ], ctx).run()).resolves.toBeUndefined()
    expect(later).toHaveBeenCalledTimes(1)
    expect(ctx.logger.warn).toHaveBeenCalledWith('Finalize failed for a: cleanup boom')
    expect(ctx.warnings.some((w) => w.includes('cleanup boom'))).toBe(true)
  })
})

// ── WSL ─────────────────────────────────────────────────────────────────────

const ROOT = '/home/gower/.local/bat-server'
const UNIT = '/home/gower/.config/systemd/user/bat-server.service'

interface WslOptions {
  previous?: 'kept' | 'none' | 'unmanaged'
  unit?: string | null
  active?: boolean
  enabled?: boolean
}

let calls: string[]
let wsl: Record<string, ReturnType<typeof vi.fn>>
let wslSystemd: Record<string, ReturnType<typeof vi.fn>>

function installWslApi(options: WslOptions = {}): void {
  calls = []
  const record = <T>(name: string, value: T) => vi.fn(async (...args: unknown[]) => {
    calls.push(name)
    void args
    return value
  })
  wsl = {
    resolveHome: vi.fn(async () => '/home/gower'),
    installBundle: record('installBundle', { ok: true, previous: options.previous ?? 'kept' }),
    uninstallBundle: record('uninstallBundle', { ok: true }),
    restoreBundle: record('restoreBundle', { ok: true, outcome: 'restored' }),
    discardPreviousBundle: record('discardPreviousBundle', { ok: true }),
    detectNetworkMode: vi.fn(async () => ({ actual: 'mirrored', declared: 'mirrored', mirroredSupported: true })),
    pickServerPort: vi.fn(async () => ({ ok: true, port: 9877, reusedExistingPort: true })),
    keepAlive: vi.fn(async () => ({ ok: true })),
    releaseKeepAlive: vi.fn(async () => ({ ok: true })),
  }
  wslSystemd = {
    snapshotUnit: record('snapshotUnit', {
      ok: true,
      content: options.unit === undefined ? '[Service]\nExecStart="/home/gower/.local/bat-server/bin/bat-server"\n' : options.unit,
      active: options.active ?? true,
      enabled: options.enabled ?? true,
    }),
    writeUnit: record('writeUnit', { ok: true }),
    enableLinger: vi.fn(async () => ({ ok: true })),
    startService: record('startService', { ok: true, token: 't' }),
    removeUnit: record('removeUnit', { ok: true }),
    restoreUnit: record('restoreUnit', { ok: true }),
    restartService: record('restartService', { ok: true }),
  }
  ;(globalThis as unknown as { window: unknown }).window = {
    electronAPI: {
      platform: 'win32',
      update: { getVersion: vi.fn(async () => '0.6.1') },
      remote: {
        serverBundle: {
          distribute: vi.fn(async () => ({ ok: true, tarballPath: 'C:\\cache\\bat-server.tar.gz', source: 'cache' })),
          onDistributeProgress: vi.fn(() => () => undefined),
        },
      },
      wsl,
      wslSystemd,
    },
  }
}

function wslCtx(): WizardContext {
  return makeCtx({ wslDistro: 'Ubuntu-24.04', serverInstallPath: '~/.local/bat-server', wslSystemdEnabled: true })
}

afterEach(() => {
  delete (globalThis as unknown as { window?: unknown }).window
})

describe('WSL upgrade cancelled after the install (T0554 / BUG-141)', () => {
  it('a later step fails → cancel: previous unit restored stopped, previous bundle restored, then the service started again', async () => {
    installWslApi()
    const ctx = wslCtx()
    const runner = new WizardRunner([installServerBundleStep, writeSystemdUnitStep, failingStep()], ctx)

    expect(((await cancelAtFailure(runner, 'fetch-fingerprint')) as Error).message).toBe('Wizard cancelled')

    expect(wsl.installBundle).toHaveBeenCalledWith('Ubuntu-24.04', 'C:\\cache\\bat-server.tar.gz', ROOT, { keepPrevious: true })
    expect(wslSystemd.restoreUnit).toHaveBeenCalledWith('Ubuntu-24.04', 'bat-server.service', {
      path: UNIT,
      content: '[Service]\nExecStart="/home/gower/.local/bat-server/bin/bat-server"\n',
      enabled: true,
      start: false,
    })
    expect(wsl.restoreBundle).toHaveBeenCalledWith('Ubuntu-24.04', ROOT)
    expect(wslSystemd.restartService).toHaveBeenCalledWith('Ubuntu-24.04', 'bat-server.service')
    const rollbackCalls = calls.slice(calls.indexOf('startService') + 1)
    expect(rollbackCalls).toEqual(['restoreUnit', 'restoreBundle', 'restartService'])
    expect(wsl.uninstallBundle).not.toHaveBeenCalled()
    expect(wslSystemd.removeUnit).not.toHaveBeenCalled()
    expect(wsl.discardPreviousBundle).not.toHaveBeenCalled()
    expect(wsl.releaseKeepAlive).toHaveBeenCalledWith('Ubuntu-24.04')
    expect(ctx.state.wslBundleInstall).toBeUndefined()
    expect(ctx.state.wslUnitSnapshot).toBeUndefined()
    expect(ctx.state.wslServiceStartAfterBundleRestore).toBeUndefined()
  })

  it('the previous server was stopped and disabled → restored that way, not started', async () => {
    installWslApi({ active: false, enabled: false })
    const runner = new WizardRunner([installServerBundleStep, writeSystemdUnitStep, failingStep()], wslCtx())
    await cancelAtFailure(runner, 'fetch-fingerprint')
    expect(wslSystemd.restoreUnit).toHaveBeenCalledWith('Ubuntu-24.04', 'bat-server.service', expect.objectContaining({ enabled: false, start: false }))
    expect(wsl.restoreBundle).toHaveBeenCalledTimes(1)
    expect(wslSystemd.restartService).not.toHaveBeenCalled()
  })

  it('first install (nothing before) → cancel removes the unit and the bundle as before', async () => {
    installWslApi({ previous: 'none', unit: null, active: false, enabled: false })
    const runner = new WizardRunner([installServerBundleStep, writeSystemdUnitStep, failingStep()], wslCtx())
    await cancelAtFailure(runner, 'fetch-fingerprint')
    expect(wslSystemd.removeUnit).toHaveBeenCalledWith('Ubuntu-24.04', 'bat-server.service', { path: UNIT })
    expect(wsl.uninstallBundle).toHaveBeenCalledWith('Ubuntu-24.04', ROOT)
    expect(wsl.restoreBundle).not.toHaveBeenCalled()
    expect(wslSystemd.restoreUnit).not.toHaveBeenCalled()
    expect(wslSystemd.restartService).not.toHaveBeenCalled()
  })

  it('finished wizard: the kept previous bundle is removed, nothing rolled back', async () => {
    installWslApi()
    const ctx = wslCtx()
    await new WizardRunner([installServerBundleStep, writeSystemdUnitStep, okStep('done')], ctx).run()
    expect(wsl.discardPreviousBundle).toHaveBeenCalledWith('Ubuntu-24.04', ROOT)
    expect(calls[calls.length - 1]).toBe('discardPreviousBundle')
    expect(wsl.restoreBundle).not.toHaveBeenCalled()
    expect(wslSystemd.restoreUnit).not.toHaveBeenCalled()
    expect(ctx.state.wslBundleInstall).toBeUndefined()
  })

  it('finished first install: nothing to discard', async () => {
    installWslApi({ previous: 'none', unit: null })
    await new WizardRunner([installServerBundleStep, writeSystemdUnitStep, okStep('done')], wslCtx()).run()
    expect(wsl.discardPreviousBundle).not.toHaveBeenCalled()
  })

  it('a failing cleanup is a warning; the wizard still completes', async () => {
    installWslApi()
    wsl.discardPreviousBundle.mockResolvedValue({ ok: false, error: 'server bundle cleanup: /x.bat-old is not a BAT server bundle install' })
    const ctx = wslCtx()
    await expect(new WizardRunner([installServerBundleStep, okStep('done')], ctx).run()).resolves.toBeUndefined()
    expect(ctx.warnings.some((w) => w.includes('.bat-old'))).toBe(true)
  })

  it('a root that was not a BAT install (extracted over) → cancel deletes nothing', async () => {
    installWslApi({ previous: 'unmanaged', unit: null })
    const ctx = wslCtx()
    const runner = new WizardRunner([installServerBundleStep, failingStep()], ctx)
    await cancelAtFailure(runner, 'fetch-fingerprint')
    expect(wsl.uninstallBundle).not.toHaveBeenCalled()
    expect(wsl.restoreBundle).not.toHaveBeenCalled()
    expect(ctx.logger.warn).toHaveBeenCalledWith(expect.stringContaining('was not a BAT server bundle install'))
  })

  it('restoring the bundle fails → warning, the service is not started on the new bundle', async () => {
    installWslApi()
    wsl.restoreBundle.mockResolvedValue({ ok: false, error: 'mv: cannot move' })
    const ctx = wslCtx()
    await cancelAtFailure(new WizardRunner([installServerBundleStep, writeSystemdUnitStep, failingStep()], ctx), 'fetch-fingerprint')
    expect(wslSystemd.restartService).not.toHaveBeenCalled()
    expect(ctx.logger.warn).toHaveBeenCalledWith('Failed to restore the previous BAT server bundle: mv: cannot move')
  })

  it('nothing kept to restore (missing) → warning, root left as it is', async () => {
    installWslApi()
    wsl.restoreBundle.mockResolvedValue({ ok: true, outcome: 'missing' })
    const ctx = wslCtx()
    await cancelAtFailure(new WizardRunner([installServerBundleStep, writeSystemdUnitStep, failingStep()], ctx), 'fetch-fingerprint')
    expect(wslSystemd.restartService).not.toHaveBeenCalled()
    expect(wsl.uninstallBundle).not.toHaveBeenCalled()
    expect(ctx.logger.warn).toHaveBeenCalledWith(expect.stringContaining('No previous BAT server bundle'))
  })

  it('write-systemd-unit fails before writing (port pick) → the previous server still starts again after the bundle restore', async () => {
    installWslApi()
    wsl.pickServerPort.mockResolvedValue({ ok: false, errorCode: 'wsl-port-in-use', error: 'no free port' })
    const runner = new WizardRunner([installServerBundleStep, writeSystemdUnitStep], wslCtx())
    await cancelAtFailure(runner, 'write-systemd-unit')
    expect(wslSystemd.writeUnit).not.toHaveBeenCalled()
    expect(wslSystemd.restoreUnit).not.toHaveBeenCalled()
    expect(wslSystemd.removeUnit).not.toHaveBeenCalled()
    expect(calls.slice(-2)).toEqual(['restoreBundle', 'restartService'])
  })

  it('a retry of write-systemd-unit keeps the first snapshot (not the unit the failed attempt wrote)', async () => {
    installWslApi()
    let lingerCalls = 0
    wslSystemd.enableLinger.mockImplementation(async () => {
      lingerCalls += 1
      return lingerCalls === 1 ? { ok: false, error: 'No such device or address' } : { ok: true }
    })
    const ctx = wslCtx()
    const runner = new WizardRunner([installServerBundleStep, writeSystemdUnitStep, failingStep()], ctx)
    const run = runner.run().then(() => null, (err: unknown) => err)
    await waitForStatus(runner, 'write-systemd-unit', WizardStepStatus.Failed)
    await runner.retryCurrentStep()
    await waitForStatus(runner, 'fetch-fingerprint', WizardStepStatus.Failed)
    await runner.cancel()
    await run
    expect(wslSystemd.snapshotUnit).toHaveBeenCalledTimes(1)
    expect(wslSystemd.restoreUnit).toHaveBeenCalledTimes(1)
  })

  it('a failed snapshot stops the step before anything changes', async () => {
    installWslApi()
    wslSystemd.snapshotUnit.mockResolvedValue({ ok: false, error: 'wsl.exe exited' })
    const ctx = wslCtx()
    ctx.wslHome = '/home/gower'
    ctx.serverInstallPath = ROOT
    await expect(writeSystemdUnitStep.run(ctx)).rejects.toThrow(/Could not read the current BAT service/)
    expect(wsl.pickServerPort).not.toHaveBeenCalled()
    expect(wslSystemd.writeUnit).not.toHaveBeenCalled()
  })
})

// ── SSH ─────────────────────────────────────────────────────────────────────

let ssh: Record<string, ReturnType<typeof vi.fn>>

function installSshApi(options: { previous?: 'kept' | 'none'; service?: { unit: boolean; active: boolean; enabled: boolean } } = {}): void {
  calls = []
  const record = <T>(name: string, value: T) => vi.fn(async () => {
    calls.push(name)
    return value
  })
  ssh = {
    uploadBundle: record('uploadBundle', { ok: true, previous: options.previous ?? 'kept' }),
    onUploadProgress: vi.fn(() => () => undefined),
    startServer: record('startServer', {
      ok: true,
      method: 'systemd',
      servicePath: '/home/alice/.config/systemd/user/bat-server.service',
      previous: options.service ?? { unit: true, active: true, enabled: true },
    }),
    onStartProgress: vi.fn(() => () => undefined),
    stopServer: record('stopServer', { ok: true }),
    uninstallBundle: record('uninstallBundle', { ok: true, outcome: 'restored' }),
  }
  ;(globalThis as unknown as { window: unknown }).window = {
    electronAPI: {
      update: { getVersion: vi.fn(async () => '0.6.1') },
      remote: {
        serverBundle: {
          distribute: vi.fn(async () => ({ ok: true, tarballPath: 'C:\\cache\\bat-server.tar.gz', source: 'cache' })),
          onDistributeProgress: vi.fn(() => () => undefined),
        },
      },
      ssh,
    },
  }
}

function sshCtx(): WizardContext {
  return makeCtx({
    targetOS: 'ssh-linux',
    serverPort: 9876,
    state: {
      sshHost: 'devbox.example',
      sshUser: 'alice',
      sshInstallPath: '~/.local/bat-server',
      sshServerHome: '/home/alice',
      sshServerArch: 'x86_64',
    },
  })
}

const SSH_CONN = { sshHost: 'devbox.example', sshUser: 'alice', sshPort: undefined, sshKeyPath: undefined }

describe('SSH upgrade cancelled after the install (T0554 / BUG-141)', () => {
  beforeEach(() => installSshApi())

  it('a later step fails → cancel: previous unit restored stopped, previous bundle restored and started', async () => {
    const ctx = sshCtx()
    await cancelAtFailure(new WizardRunner([installSshServerBundleStep, startServerStep, failingStep()], ctx), 'fetch-fingerprint')

    expect(ssh.uploadBundle.mock.calls[0][0].options).toMatchObject({ installPath: '/home/alice/.local/bat-server', keepPrevious: true })
    expect(ssh.startServer.mock.calls[0][0].options.backupPrevious).toBe(true)
    expect(ssh.stopServer).toHaveBeenCalledWith({
      ...SSH_CONN,
      targetOS: 'ssh-linux',
      serverHome: '/home/alice',
      action: 'restore-previous',
      restore: { enabled: true, start: false },
    })
    expect(ssh.uninstallBundle).toHaveBeenCalledWith({
      ...SSH_CONN,
      installPath: '/home/alice/.local/bat-server',
      mode: 'restore-previous',
      startService: 'ssh-linux',
    })
    expect(calls.slice(-2)).toEqual(['stopServer', 'uninstallBundle'])
  })

  it('the previous service was stopped → restored without starting', async () => {
    installSshApi({ service: { unit: true, active: false, enabled: true } })
    await cancelAtFailure(new WizardRunner([installSshServerBundleStep, startServerStep, failingStep()], sshCtx()), 'fetch-fingerprint')
    expect(ssh.uninstallBundle.mock.calls[0][0]).not.toHaveProperty('startService')
  })

  it('first install → cancel stops / removes as before (T0426)', async () => {
    installSshApi({ previous: 'none', service: { unit: false, active: false, enabled: false } })
    await cancelAtFailure(new WizardRunner([installSshServerBundleStep, startServerStep, failingStep()], sshCtx()), 'fetch-fingerprint')
    expect(ssh.stopServer).toHaveBeenCalledWith({ ...SSH_CONN, targetOS: 'ssh-linux', serverHome: '/home/alice' })
    expect(ssh.uninstallBundle).toHaveBeenCalledWith({ ...SSH_CONN, installPath: '/home/alice/.local/bat-server' })
  })

  it('finished wizard: the bundle kept at .bat-old and the unit backup are removed', async () => {
    const ctx = sshCtx()
    await new WizardRunner([installSshServerBundleStep, startServerStep, okStep('done')], ctx).run()
    expect(ssh.uninstallBundle).toHaveBeenCalledWith({ ...SSH_CONN, installPath: '/home/alice/.local/bat-server', mode: 'discard-previous' })
    expect(ssh.stopServer).toHaveBeenCalledWith({ ...SSH_CONN, targetOS: 'ssh-linux', serverHome: '/home/alice', action: 'discard-backup' })
    expect(ssh.uninstallBundle).toHaveBeenCalledTimes(1)
    expect(ssh.stopServer).toHaveBeenCalledTimes(1)
  })

  it('a retry of start-server does not take a second backup', async () => {
    let attempts = 0
    ssh.startServer.mockImplementation(async (request: { options: { backupPrevious?: boolean } }) => {
      attempts += 1
      calls.push(`startServer(backup=${String(request.options.backupPrevious)})`)
      return attempts === 1
        ? { ok: false, method: 'failed', servicePath: '', errorCode: 'verify-failed', error: 'verify-failed: no socket', previous: { unit: true, active: true, enabled: true } }
        : { ok: true, method: 'systemd', servicePath: '/x' }
    })
    const ctx = sshCtx()
    const runner = new WizardRunner([installSshServerBundleStep, startServerStep, failingStep()], ctx)
    const run = runner.run().then(() => null, (err: unknown) => err)
    await waitForStatus(runner, 'start-server', WizardStepStatus.Failed)
    await runner.retryCurrentStep()
    await waitForStatus(runner, 'fetch-fingerprint', WizardStepStatus.Failed)
    await runner.cancel()
    await run
    expect(calls.filter((c) => c.startsWith('startServer('))).toEqual(['startServer(backup=true)', 'startServer(backup=false)'])
    expect(ssh.stopServer.mock.calls[0][0]).toMatchObject({ action: 'restore-previous' })
  })
})
