/**
 * T0336 (PLAN-032 Sprint 3, BUG-073): regression tests for detect-env Docker
 * branch — preflight ok / fail, cache hit, TTL expiry, WSL passthrough,
 * errorCode Stage-1 mapping.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_WIZARD_ERROR_REGISTRY,
  WizardRunner,
  WizardStepStatus,
  createPreflightCache,
  resolveWizardError,
  type WizardContext,
} from '../wizard-runner'
import { detectEnvStep } from '../steps/wsl/detect-env'

type DockerStatus = { available: boolean; version?: string; error?: string }

function makeCtx(overrides: Partial<WizardContext> = {}): WizardContext {
  return {
    targetOS: 'docker-linux',
    profileDraft: { name: 'test' },
    warnings: [],
    state: {},
    logger: { info: () => undefined, warn: () => undefined, error: () => undefined },
    preflightCache: createPreflightCache(),
    ...overrides,
  }
}

let dockerStatusMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  dockerStatusMock = vi.fn()
  ;(globalThis as unknown as { window: unknown }).window = {
    electronAPI: {
      platform: 'win32',
      docker: { status: dockerStatusMock },
      wsl: { list: vi.fn(async () => []) },
    },
  }
})

afterEach(() => {
  vi.restoreAllMocks()
  delete (globalThis as unknown as { window?: unknown }).window
})

describe('detect-env preflight (T0336 / BUG-073)', () => {
  it('AC-5 case 1: preflight ok caches docker-daemon-status with TTL 30s', async () => {
    dockerStatusMock.mockResolvedValueOnce({ available: true, version: '24.0' } as DockerStatus)
    const ctx = makeCtx()
    const result = await detectEnvStep.preflight!(ctx)
    expect(result).toEqual({ ok: true, cacheKey: 'docker-daemon-status', ttlMs: 30_000 })
  })

  it('AC-5 case 2: preflight hard fail returns errorCode + 5s TTL; runner snapshot maps to docker-daemon-unavailable with open-link', async () => {
    dockerStatusMock.mockResolvedValue({
      available: false,
      error: 'error during connect: pipe/docker_engine: not found',
    } as DockerStatus)
    const ctx = makeCtx()
    const result = await detectEnvStep.preflight!(ctx)
    expect(result.ok).toBe(false)
    expect(result.errorCode).toBe('docker-daemon-down')
    expect(result.cacheKey).toBe('docker-daemon-status')
    expect(result.ttlMs).toBe(5_000)
    expect(result.reason).toMatch(/pipe\/docker_engine/)

    // runner integration: detectEnvStep is retryable, so the runner blocks on
    // retry/skip/cancel after failing. Observe the failed snapshot via polling,
    // then cancel to unblock the run promise.
    const ctx2 = makeCtx()
    const runner = new WizardRunner([detectEnvStep], ctx2)
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
    expect(snap.mappedError?.matchId).toBe('docker-daemon-unavailable')
    const kinds = snap.mappedError?.actions.map((a) => a.kind) ?? []
    expect(kinds).toContain('open-link')
    expect(kinds).toContain('fixed-and-retry')
    expect(kinds).toContain('cancel')
    const openLink = snap.mappedError?.actions.find((a) => a.kind === 'open-link')
    expect(openLink && 'href' in openLink ? openLink.href : null).toBe(
      'https://www.docker.com/products/docker-desktop/',
    )
  })

  it('AC-5 case 3: preflight cache hit short-circuits docker.status', async () => {
    dockerStatusMock.mockResolvedValueOnce({ available: true, version: '24.0' } as DockerStatus)
    const ctx = makeCtx()
    // Run preflight twice in same wizard session — second call must hit cache.
    const r1 = await detectEnvStep.preflight!(ctx)
    // Manually seed cache (the runner does this via setPreflightCached after each preflight).
    ctx.preflightCache!.set('docker-daemon-status', { result: r1, storedAt: Date.now() })
    const r2 = await detectEnvStep.preflight!(ctx)
    expect(r2).toBe(r1)
    expect(dockerStatusMock).toHaveBeenCalledTimes(1)
  })

  it('AC-5 case 4: TTL 5s expiry allows daemon down -> up retry', async () => {
    // First call: down. Cache entry stored with TTL 5s.
    dockerStatusMock.mockResolvedValueOnce({
      available: false,
      error: 'pipe/docker_engine missing',
    } as DockerStatus)
    const ctx = makeCtx()
    const r1 = await detectEnvStep.preflight!(ctx)
    expect(r1.ok).toBe(false)
    // Seed cache with old timestamp so TTL has expired.
    ctx.preflightCache!.set('docker-daemon-status', {
      result: r1,
      storedAt: Date.now() - 6_000,
    })
    // Second call: daemon now up — preflight must NOT use stale cache.
    dockerStatusMock.mockResolvedValueOnce({ available: true, version: '24.0' } as DockerStatus)
    const r2 = await detectEnvStep.preflight!(ctx)
    expect(r2.ok).toBe(true)
    expect(dockerStatusMock).toHaveBeenCalledTimes(2)
  })

  it('AC-5 case 5: WSL branch ok when wsl.list resolves (60s TTL, no docker.status)', async () => {
    const ctx = makeCtx({ targetOS: 'wsl-linux' })
    const wslList = (window as unknown as { electronAPI: { wsl: { list: ReturnType<typeof vi.fn> } } })
      .electronAPI.wsl.list
    const result = await detectEnvStep.preflight!(ctx)
    expect(result).toEqual({ ok: true, cacheKey: 'wsl-list-status', ttlMs: 60_000 })
    expect(dockerStatusMock).not.toHaveBeenCalled()
    expect(wslList).toHaveBeenCalledTimes(1)
  })

  it('T0337 case A: WSL preflight fail when wsl.list throws -> errorCode wsl-not-installed', async () => {
    ;(window as unknown as { electronAPI: { wsl: { list: ReturnType<typeof vi.fn> } } })
      .electronAPI.wsl.list = vi.fn(async () => {
        throw new Error('wsl: command not found')
      })
    const ctx = makeCtx({ targetOS: 'wsl-linux' })
    const result = await detectEnvStep.preflight!(ctx)
    expect(result.ok).toBe(false)
    expect(result.errorCode).toBe('wsl-not-installed')
    expect(result.cacheKey).toBe('wsl-list-status')
    expect(result.ttlMs).toBe(5_000)
    expect(result.reason).toMatch(/wsl: command not found/)
  })

  it('T0337 case B: WSL preflight short-circuits on non-Windows host with errorCode wsl-not-on-windows', async () => {
    ;(window as unknown as { electronAPI: { platform: string } }).electronAPI.platform = 'darwin'
    const ctx = makeCtx({ targetOS: 'wsl-linux' })
    const result = await detectEnvStep.preflight!(ctx)
    expect(result.ok).toBe(false)
    expect(result.errorCode).toBe('wsl-not-on-windows')
    // No cacheKey since platform check is cheap and never changes per session.
    expect(result.cacheKey).toBeUndefined()
  })

  it('T0337 case C: WSL preflight failure runner snapshot maps to wsl-not-installed with open-link', async () => {
    ;(window as unknown as { electronAPI: { wsl: { list: ReturnType<typeof vi.fn> } } })
      .electronAPI.wsl.list = vi.fn(async () => {
        throw new Error('wsl: command not found')
      })
    const ctx = makeCtx({ targetOS: 'wsl-linux' })
    const runner = new WizardRunner([detectEnvStep], ctx)
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
    expect(snap.mappedError?.matchId).toBe('wsl-not-installed')
    const kinds = snap.mappedError?.actions.map((a) => a.kind) ?? []
    expect(kinds).toContain('open-link')
    expect(kinds).toContain('fixed-and-retry')
  })

  it('AC-5 case 6: errorCode Stage 1 lookup hits docker-daemon-unavailable', () => {
    const mapped = resolveWizardError(
      {
        platform: 'docker',
        stepId: 'detect-env',
        errorCode: 'docker-daemon-down',
        error: new Error('any raw stderr'),
      },
      DEFAULT_WIZARD_ERROR_REGISTRY,
    )
    expect(mapped.matchId).toBe('docker-daemon-unavailable')
    expect(mapped.actions.map((a) => a.kind)).toContain('open-link')
  })
})