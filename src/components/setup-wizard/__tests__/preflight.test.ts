/**
 * T0332 (PLAN-032 Sprint 2): WizardPreflight + runner integration tests.
 */
import { describe, expect, it, vi } from 'vitest'
import {
  WizardRunner,
  WizardStepStatus,
  createPreflightCache,
  getPreflightCached,
  setPreflightCached,
  type WizardContext,
  type WizardPreflightCache,
  type WizardPreflightResult,
  type WizardStep,
} from '../wizard-runner'

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

describe('preflight cache helpers (T0332)', () => {
  it('cache miss returns undefined', () => {
    const cache = createPreflightCache()
    expect(getPreflightCached(cache, 'missing')).toBeUndefined()
  })

  it('cache hit returns same result after set', () => {
    const cache = createPreflightCache()
    const result: WizardPreflightResult = { ok: true, cacheKey: 'k1' }
    setPreflightCached(cache, 'k1', result, 1000)
    expect(getPreflightCached(cache, 'k1', 1500)).toBe(result)
  })

  it('TTL expiry returns undefined and evicts', () => {
    const cache = createPreflightCache()
    const result: WizardPreflightResult = { ok: true, cacheKey: 'k', ttlMs: 500 }
    setPreflightCached(cache, 'k', result, 1000)
    expect(getPreflightCached(cache, 'k', 1400)).toBe(result)
    expect(getPreflightCached(cache, 'k', 1500)).toBeUndefined()
    expect(cache.has('k')).toBe(false)
  })

  it('result without ttlMs is cached permanently within session', () => {
    const cache = createPreflightCache()
    const result: WizardPreflightResult = { ok: true }
    setPreflightCached(cache, 'forever', result, 0)
    expect(getPreflightCached(cache, 'forever', Number.MAX_SAFE_INTEGER)).toBe(result)
  })

  it('createPreflightCache returns a fresh Map per call', () => {
    const a = createPreflightCache()
    const b = createPreflightCache()
    expect(a).not.toBe(b)
    setPreflightCached(a, 'x', { ok: true }, 0)
    expect(b.has('x')).toBe(false)
  })
})

describe('runner preflight integration (T0332)', () => {
  it('preflight ok -> step.run() executes', async () => {
    const runSpy = vi.fn(async () => undefined)
    const step: WizardStep = {
      id: 's',
      title: 's',
      appliesTo: 'all',
      preflight: async () => ({ ok: true }),
      run: runSpy,
    }
    const ctx = makeCtx()
    const runner = new WizardRunner([step], ctx)
    await runner.run()
    expect(runSpy).toHaveBeenCalledTimes(1)
    expect(runner.getSnapshots()[0].status).toBe(WizardStepStatus.Succeeded)
    expect(ctx.warnings).toEqual([])
  })

  it('preflight hard fail -> step.run() NOT called, snapshot.failed + mappedError set', async () => {
    const runSpy = vi.fn(async () => undefined)
    const step: WizardStep = {
      id: 'docker-daemon-check',
      title: 'docker-daemon-check',
      appliesTo: 'all',
      retryable: false,
      preflight: async () => ({
        ok: false,
        reason: 'docker daemon not reachable',
        errorCode: 'docker-daemon-down',
      }),
      run: runSpy,
    }
    const ctx = makeCtx()
    const runner = new WizardRunner([step], ctx)
    await expect(runner.run()).rejects.toThrow(/docker daemon not reachable/)
    expect(runSpy).not.toHaveBeenCalled()
    const snap = runner.getSnapshots()[0]
    expect(snap.status).toBe(WizardStepStatus.Failed)
    expect(snap.error).toMatch(/docker daemon not reachable/)
    expect(snap.mappedError).toBeDefined()
    expect(snap.mappedError?.rawError).toMatch(/docker daemon not reachable/)
  })

  it('preflight warningOnly -> step.run() executes + ctx.warnings populated', async () => {
    const runSpy = vi.fn(async () => undefined)
    const step: WizardStep = {
      id: 's',
      title: 's',
      appliesTo: 'all',
      preflight: async () => ({
        ok: false,
        warningOnly: true,
        reason: 'systemd not enabled',
      }),
      run: runSpy,
    }
    const ctx = makeCtx()
    const runner = new WizardRunner([step], ctx)
    await runner.run()
    expect(runSpy).toHaveBeenCalledTimes(1)
    expect(ctx.warnings).toContain('systemd not enabled')
    expect(runner.getSnapshots()[0].status).toBe(WizardStepStatus.Succeeded)
  })

  it('preflight throws -> synthesized hard fail with error.message', async () => {
    const runSpy = vi.fn(async () => undefined)
    const step: WizardStep = {
      id: 's',
      title: 's',
      appliesTo: 'all',
      retryable: false,
      preflight: async () => {
        throw new Error('network unreachable')
      },
      run: runSpy,
    }
    const ctx = makeCtx()
    const runner = new WizardRunner([step], ctx)
    await expect(runner.run()).rejects.toThrow(/network unreachable/)
    expect(runSpy).not.toHaveBeenCalled()
    const snap = runner.getSnapshots()[0]
    expect(snap.status).toBe(WizardStepStatus.Failed)
    expect(snap.error).toMatch(/network unreachable/)
    expect(snap.mappedError).toBeDefined()
  })

  it('no preflight -> behavior unchanged from T0331 baseline', async () => {
    const runSpy = vi.fn(async () => undefined)
    const step: WizardStep = {
      id: 's',
      title: 's',
      appliesTo: 'all',
      run: runSpy,
    }
    const ctx = makeCtx()
    const runner = new WizardRunner([step], ctx)
    await runner.run()
    expect(runSpy).toHaveBeenCalledTimes(1)
    expect(runner.getSnapshots()[0].status).toBe(WizardStepStatus.Succeeded)
    expect(ctx.warnings).toEqual([])
  })

  it('preflight cacheKey -> result stored in ctx.preflightCache', async () => {
    const result: WizardPreflightResult = { ok: true, cacheKey: 'docker-daemon' }
    const step: WizardStep = {
      id: 's',
      title: 's',
      appliesTo: 'all',
      preflight: async () => result,
      run: async () => undefined,
    }
    const ctx = makeCtx()
    const runner = new WizardRunner([step], ctx)
    await runner.run()
    expect(ctx.preflightCache).toBeDefined()
    const cache = ctx.preflightCache as WizardPreflightCache
    expect(getPreflightCached(cache, 'docker-daemon')).toBe(result)
  })

  it('runner injects preflightCache when ctx omits one', async () => {
    const ctx = makeCtx()
    expect(ctx.preflightCache).toBeUndefined()
    const step: WizardStep = {
      id: 's',
      title: 's',
      appliesTo: 'all',
      run: async () => undefined,
    }
    const runner = new WizardRunner([step], ctx)
    await runner.run()
    expect(ctx.preflightCache).toBeDefined()
    expect(ctx.preflightCache).toBeInstanceOf(Map)
  })

  it('runner preserves caller-provided preflightCache', async () => {
    const cache = createPreflightCache()
    setPreflightCached(cache, 'pre-existing', { ok: true }, 0)
    const ctx = makeCtx({ preflightCache: cache })
    const step: WizardStep = {
      id: 's',
      title: 's',
      appliesTo: 'all',
      run: async () => undefined,
    }
    const runner = new WizardRunner([step], ctx)
    await runner.run()
    expect(ctx.preflightCache).toBe(cache)
    expect(getPreflightCached(cache, 'pre-existing', Number.MAX_SAFE_INTEGER)).toBeDefined()
  })

  it('preflight hard fail allows retry which re-invokes preflight + run', async () => {
    let preflightCalls = 0
    const runSpy = vi.fn(async () => undefined)
    const step: WizardStep = {
      id: 's',
      title: 's',
      appliesTo: 'all',
      retryable: true,
      preflight: async () => {
        preflightCalls += 1
        if (preflightCalls === 1) {
          return { ok: false, reason: 'transient' }
        }
        return { ok: true }
      },
      run: runSpy,
    }
    const ctx = makeCtx()
    const runner = new WizardRunner([step], ctx)
    const p = runner.run()
    await new Promise<void>((resolve) => {
      const tick = () => {
        if (runner.getSnapshots()[0].status === WizardStepStatus.Failed) resolve()
        else setTimeout(tick, 5)
      }
      tick()
    })
    await runner.retryCurrentStep()
    await p
    expect(preflightCalls).toBe(2)
    expect(runSpy).toHaveBeenCalledTimes(1)
    expect(runner.getSnapshots()[0].status).toBe(WizardStepStatus.Succeeded)
  })
})