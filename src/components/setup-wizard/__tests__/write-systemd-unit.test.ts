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

type WriteUnitResult = { ok: boolean; error?: string }
type EnableLingerResult = { ok: boolean; error?: string }
type StartServiceResult = { ok: boolean; error?: string; token?: string }

let writeUnitMock: ReturnType<typeof vi.fn>
let enableLingerMock: ReturnType<typeof vi.fn>
let startServiceMock: ReturnType<typeof vi.fn>
let removeUnitMock: ReturnType<typeof vi.fn>

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

  ;(globalThis as unknown as { window: unknown }).window = {
    electronAPI: {
      platform: 'win32',
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
