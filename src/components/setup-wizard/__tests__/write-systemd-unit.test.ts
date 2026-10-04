/**
 * T0337 (PLAN-032 Sprint 3, BUG-072): regression tests for write-systemd-unit
 * step — linger throw with errorCode, service start timeout vs generic
 * failure, end-to-end mappedError snapshots from WizardRunner.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  WizardRunner,
  WizardStepStatus,
  type WizardContext,
} from '../wizard-runner'
import { writeSystemdUnitStep } from '../steps/wsl/write-systemd-unit'
import { connectTestStep } from '../steps/wsl/connect-test'
import { writeProfileStep } from '../steps/wsl/write-profile'

type WriteUnitResult = { ok: boolean; error?: string }
type EnableLingerResult = { ok: boolean; error?: string }
type StartServiceResult = { ok: boolean; error?: string; errorCode?: string; token?: string }
type PickServerPortResult = { ok: true; port: number } | { ok: false; errorCode: string; error: string }

let writeUnitMock: ReturnType<typeof vi.fn>
let enableLingerMock: ReturnType<typeof vi.fn>
let startServiceMock: ReturnType<typeof vi.fn>
let removeUnitMock: ReturnType<typeof vi.fn>
let pickServerPortMock: ReturnType<typeof vi.fn>

function makeCtx(overrides: Partial<WizardContext> = {}): WizardContext {
  return {
    targetOS: 'wsl-linux',
    profileDraft: { name: 'test wsl' },
    warnings: [],
    state: {},
    logger: { info: () => undefined, warn: () => undefined, error: () => undefined },
    wslDistro: 'Ubuntu',
    serverInstallPath: '/opt/bat-server',
    wslSystemdEnabled: true,
    serverPort: 9876,
    ...overrides,
  }
}

beforeEach(() => {
  writeUnitMock = vi.fn(async (): Promise<WriteUnitResult> => ({ ok: true }))
  enableLingerMock = vi.fn(async (): Promise<EnableLingerResult> => ({ ok: true }))
  startServiceMock = vi.fn(async (): Promise<StartServiceResult> => ({ ok: true, token: 't-1' }))
  removeUnitMock = vi.fn(async (): Promise<{ ok: boolean }> => ({ ok: true }))
  pickServerPortMock = vi.fn(async (): Promise<PickServerPortResult> => ({ ok: true, port: 9877 }))

  ;(globalThis as unknown as { window: unknown }).window = {
    electronAPI: {
      platform: 'win32',
      // T0378: write-systemd-unit resolves the distro $HOME for absolute paths.
      // T0382: the server port is picked on the Windows side.
      wsl: { resolveHome: vi.fn(async () => '/home/tester'), pickServerPort: pickServerPortMock },
      wslSystemd: {
        writeUnit: writeUnitMock,
        enableLinger: enableLingerMock,
        startService: startServiceMock,
        removeUnit: removeUnitMock,
      },
    },
  }
})

afterEach(() => {
  vi.restoreAllMocks()
  delete (globalThis as unknown as { window?: unknown }).window
})

describe('write-systemd-unit (T0337 / BUG-072)', () => {
  it('AC-5 case 1: linger failure throws with code=wsl-linger-failed and pushes warning', async () => {
    enableLingerMock.mockResolvedValueOnce({
      ok: false,
      error: 'No such device or address',
    } as EnableLingerResult)

    const ctx = makeCtx()
    let caught: (Error & { code?: string }) | null = null
    try {
      await writeSystemdUnitStep.run(ctx)
    } catch (e) {
      caught = e as Error & { code?: string }
    }
    expect(caught).not.toBeNull()
    expect(caught?.code).toBe('wsl-linger-failed')
    expect(caught?.message).toMatch(/Could not enable linger/)
    expect(ctx.warnings).toContainEqual(expect.stringMatching(/Unable to enable linger/))
    expect(startServiceMock).not.toHaveBeenCalled()
  })

  it('AC-5 case 2: service start timeout throws with code=wsl-service-start-timeout', async () => {
    startServiceMock.mockResolvedValueOnce({
      ok: false,
      error: 'Timed out waiting for bat-server.service to become active',
    } as StartServiceResult)

    const ctx = makeCtx()
    let caught: (Error & { code?: string }) | null = null
    try {
      await writeSystemdUnitStep.run(ctx)
    } catch (e) {
      caught = e as Error & { code?: string }
    }
    expect(caught).not.toBeNull()
    expect(caught?.code).toBe('wsl-service-start-timeout')
    expect(caught?.message).toMatch(/Timed out/i)
  })

  it('AC-5 case 3: service start non-timeout failure throws with code=wsl-service-start-failed', async () => {
    startServiceMock.mockResolvedValueOnce({
      ok: false,
      error: 'permission denied accessing /run/systemd',
    } as StartServiceResult)

    const ctx = makeCtx()
    let caught: (Error & { code?: string }) | null = null
    try {
      await writeSystemdUnitStep.run(ctx)
    } catch (e) {
      caught = e as Error & { code?: string }
    }
    expect(caught).not.toBeNull()
    expect(caught?.code).toBe('wsl-service-start-failed')
    expect(caught?.message).toMatch(/permission denied/)
  })

  it('AC-5 case 4: linger fail snapshot.mappedError.matchId === wsl-linger-failure with fixed-and-retry', async () => {
    enableLingerMock.mockResolvedValueOnce({
      ok: false,
      error: 'Could not enable linger: No such device or address',
    } as EnableLingerResult)

    const ctx = makeCtx()
    const runner = new WizardRunner([writeSystemdUnitStep], ctx)
    const runPromise = runner.run().catch(() => undefined)
    await new Promise<void>((resolve) => {
      const tick = () =>
        runner.getSnapshots()[0].status === WizardStepStatus.Failed
          ? resolve()
          : setTimeout(tick, 5)
      tick()
    })
    const snap = runner.getSnapshots()[0]
    await runner.cancel()
    await runPromise

    expect(snap.status).toBe(WizardStepStatus.Failed)
    expect(snap.mappedError?.matchId).toBe('wsl-linger-failure')
    const kinds = snap.mappedError?.actions.map((a) => a.kind) ?? []
    expect(kinds).toContain('fixed-and-retry')
    expect(kinds).toContain('skip')
    expect(kinds).toContain('cancel')
  })

  it('AC-5 case 5: timeout snapshot.mappedError.matchId === wsl-service-start-timeout', async () => {
    startServiceMock.mockResolvedValueOnce({
      ok: false,
      error: 'Timed out waiting for bat-server.service to become active',
    } as StartServiceResult)

    const ctx = makeCtx()
    const runner = new WizardRunner([writeSystemdUnitStep], ctx)
    const runPromise = runner.run().catch(() => undefined)
    await new Promise<void>((resolve) => {
      const tick = () =>
        runner.getSnapshots()[0].status === WizardStepStatus.Failed
          ? resolve()
          : setTimeout(tick, 5)
      tick()
    })
    const snap = runner.getSnapshots()[0]
    await runner.cancel()
    await runPromise

    expect(snap.status).toBe(WizardStepStatus.Failed)
    expect(snap.mappedError?.matchId).toBe('wsl-service-start-timeout')
    expect(snap.mappedError?.body).toMatch(/journalctl/)
    const kinds = snap.mappedError?.actions.map((a) => a.kind) ?? []
    expect(kinds).toContain('fixed-and-retry')
  })
})

/**
 * T0382 (BUG-091, D128): the port is picked on the Windows side (never the
 * host RemoteServer port), written into the unit, and then read from the same
 * ctx.serverPort by connect-test and write-profile.
 */
describe('write-systemd-unit server port (T0382 / BUG-091)', () => {
  async function failedSnapshot(ctx: WizardContext) {
    const runner = new WizardRunner([writeSystemdUnitStep], ctx)
    const runPromise = runner.run().catch(() => undefined)
    await new Promise<void>((resolve) => {
      const tick = () =>
        runner.getSnapshots()[0].status === WizardStepStatus.Failed
          ? resolve()
          : setTimeout(tick, 5)
      tick()
    })
    const snap = runner.getSnapshots()[0]
    await runner.cancel()
    await runPromise
    return snap
  }

  it('writes the picked port into the unit and ctx.serverPort (auto mode)', async () => {
    const ctx = makeCtx({ serverPort: undefined })
    await writeSystemdUnitStep.run(ctx)

    expect(pickServerPortMock).toHaveBeenCalledWith(undefined)
    expect(ctx.serverPort).toBe(9877)
    const unit = writeUnitMock.mock.calls[0][1] as { environment: Record<string, string> }
    expect(unit.environment.BAT_PORT).toBe('9877')
    expect(unit.environment.BAT_SERVER_PORT).toBe('9877')
  })

  it('passes a user-specified port (ctx.state.serverPort) through for validation', async () => {
    pickServerPortMock.mockResolvedValueOnce({ ok: true, port: 12345 })
    const ctx = makeCtx({ state: { serverPort: 12345 } })
    await writeSystemdUnitStep.run(ctx)

    expect(pickServerPortMock).toHaveBeenCalledWith(12345)
    expect(ctx.serverPort).toBe(12345)
  })

  it('uses the picked port for the no-systemd fallback hint as well', async () => {
    const ctx = makeCtx({ wslSystemdEnabled: false })
    await writeSystemdUnitStep.run(ctx)
    expect(ctx.fallbackStartHint).toMatch(/--port 9877$/)
    expect(writeUnitMock).not.toHaveBeenCalled()
  })

  it('stops before writing the unit when the user-specified port is taken -> wsl-port-in-use', async () => {
    pickServerPortMock.mockResolvedValueOnce({
      ok: false,
      errorCode: 'wsl-port-in-use',
      error: "Port 9876 is used by this BAT's own remote server; choose another port for the WSL server.",
    })
    const snap = await failedSnapshot(makeCtx({ state: { serverPort: 9876 } }))

    expect(writeUnitMock).not.toHaveBeenCalled()
    expect(startServiceMock).not.toHaveBeenCalled()
    expect(snap.mappedError?.matchId).toBe('wsl-port-in-use')
    expect(snap.mappedError?.actions.map((a) => a.kind)).toEqual(['retry', 'cancel'])
  })

  it('maps startService errorCode=wsl-port-in-use (journal EADDRINUSE) to the port entry', async () => {
    startServiceMock.mockResolvedValueOnce({
      ok: false,
      errorCode: 'wsl-port-in-use',
      error: 'bat-server.service could not bind its port 9877 (EADDRINUSE). bat-server.service exited and was restarted by systemd 1 time(s) during the start check.',
    } as StartServiceResult)

    const ctx = makeCtx()
    let caught: (Error & { code?: string }) | null = null
    try {
      await writeSystemdUnitStep.run(ctx)
    } catch (e) {
      caught = e as Error & { code?: string }
    }
    expect(caught?.code).toBe('wsl-port-in-use')

    startServiceMock.mockResolvedValueOnce({
      ok: false,
      errorCode: 'wsl-port-in-use',
      error: 'bat-server.service could not bind its port 9877 (EADDRINUSE).',
    } as StartServiceResult)
    const snap = await failedSnapshot(makeCtx())
    expect(snap.mappedError?.matchId).toBe('wsl-port-in-use')
  })

  it('prefers the errorCode from main over the timeout regex', async () => {
    // journal text mentions "timeout" but main classified the crash as a generic start failure
    startServiceMock.mockResolvedValueOnce({
      ok: false,
      errorCode: 'wsl-service-start-failed',
      error: 'bat-server.service did not stay active (ActiveState=failed, SubState=failed).\n--- journalctl ---\nconnect timeout to upstream',
    } as StartServiceResult)
    let caught: (Error & { code?: string }) | null = null
    try {
      await writeSystemdUnitStep.run(makeCtx())
    } catch (e) {
      caught = e as Error & { code?: string }
    }
    expect(caught?.code).toBe('wsl-service-start-failed')
  })

  it('connect-test and write-profile read the same ctx.serverPort as the unit', async () => {
    const testConnection = vi.fn(async () => ({ ok: true, metadata: null }))
    const create = vi.fn(async () => ({ id: 'p-1', name: 'test wsl', type: 'remote', createdAt: 0, updatedAt: 0 }))
    const update = vi.fn(async () => true)
    const api = (globalThis as unknown as { window: { electronAPI: Record<string, unknown> } }).window.electronAPI
    api.remote = { testConnection }
    api.profile = { create, update, delete: vi.fn(async () => true) }

    const ctx = makeCtx({ serverPort: undefined })
    await writeSystemdUnitStep.run(ctx)
    ctx.fingerprint = 'AA:BB'
    await connectTestStep.run(ctx)
    await writeProfileStep.run(ctx)

    const unit = writeUnitMock.mock.calls[0][1] as { environment: Record<string, string> }
    expect(unit.environment.BAT_PORT).toBe('9877')
    expect(testConnection).toHaveBeenCalledWith('localhost', 9877, 't-1', 'AA:BB')
    expect(create).toHaveBeenCalledWith('test wsl', expect.objectContaining({ remotePort: 9877 }))
    expect(update).toHaveBeenCalledWith('p-1', expect.objectContaining({ remotePort: 9877 }))
  })

  it('connect-test and write-profile refuse to fall back to 9876 when no port was resolved', async () => {
    const ctx = makeCtx({ serverPort: undefined, fingerprint: 'AA:BB', remoteToken: 't-1' })
    await expect(connectTestStep.run(ctx)).rejects.toThrow(/Server port was not resolved/)
    await expect(writeProfileStep.run(ctx)).rejects.toThrow(/Server port was not resolved/)
  })
})
