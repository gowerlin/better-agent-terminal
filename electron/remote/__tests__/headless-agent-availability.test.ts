// @vitest-environment node
/**
 * T0433 (T0431 遭遇問題 4): headless `terminal:create-agent-command` refuses an agent the
 * server cannot run — structured `AGENT_UNAVAILABLE` / `AGENT_CHECK_PENDING` instead of
 * typing `codex …` into a shell that prints `command not found`.
 *
 *   - the decision reuses the PLAN-037 remote tools detection (`HeadlessRemoteToolsCache`)
 *   - runnable statuses (ok / error) pass; missing / not-on-path / interop-only refuse
 *   - claude and agents the detection has no entry for are not judged
 *   - cache: runnable results trusted 10 min, not-runnable 30 s; in-flight probe shared
 *   - slow probe: stale result if any, else AGENT_CHECK_PENDING; failed probe: not judged
 *   - handler: a refusal creates no PTY and is returned as-is
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RemoteToolsDetectResult, RemoteToolStatus } from '../../../src/types/remote-tools'
import { REMOTE_TOOL_IDS } from '../../../src/types/remote-tools'
import {
  AGENT_CHECK_PENDING,
  AGENT_UNAVAILABLE,
  registerTerminalCommandHandlers,
  type AgentUnavailableResult,
  type TerminalCommandHandlerDeps,
} from '../../terminal-command-handlers'
import {
  HEADLESS_AGENT_CHECK_MISSING_TTL_MS,
  HEADLESS_AGENT_CHECK_RUNNABLE_TTL_MS,
  HeadlessRemoteToolsCache,
  createHeadlessAgentAvailabilityCheck,
} from '../headless-entry'

function report(codex: RemoteToolStatus): RemoteToolsDetectResult {
  return {
    ok: true,
    report: {
      schemaVersion: 1,
      env: {} as never,
      tools: REMOTE_TOOL_IDS.map(id => ({ id, status: id === 'codex' ? codex : 'ok', serverVisible: true })),
      serverViewAvailable: true,
      warnings: [],
    },
  }
}

function makeCache(results: Array<RemoteToolsDetectResult | Promise<RemoteToolsDetectResult>>, now: () => number) {
  const detect = vi.fn(async () => {
    const next = results.length > 1 ? results.shift()! : results[0]
    return next
  })
  return { cache: new HeadlessRemoteToolsCache({ detect, now }), detect }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('createHeadlessAgentAvailabilityCheck (T0433)', () => {
  it.each<RemoteToolStatus>(['missing', 'not-on-path', 'interop-only'])('codex %s → AGENT_UNAVAILABLE', async status => {
    const { cache } = makeCache([report(status)], () => 0)
    const result = await createHeadlessAgentAvailabilityCheck(cache)('codex-cli')
    expect(result).toMatchObject({ ok: false, code: AGENT_UNAVAILABLE, agentId: 'codex-cli', tool: 'codex', status })
    expect(result?.error).toMatch(/codex is not available on this server/)
  })

  it.each<RemoteToolStatus>(['ok', 'error'])('codex %s → runnable (null)', async status => {
    const { cache } = makeCache([report(status)], () => 0)
    expect(await createHeadlessAgentAvailabilityCheck(cache)('codex-cli')).toBeNull()
  })

  it('claude (bundled) and agents the detection has no entry for are not judged — no probe runs', async () => {
    const { cache, detect } = makeCache([report('missing')], () => 0)
    const check = createHeadlessAgentAvailabilityCheck(cache)
    for (const agent of ['claude-cli', 'claude-cli-worktree', 'gemini-cli', 'copilot-cli', 'my-custom']) {
      expect(await check(agent)).toBeNull()
    }
    expect(detect).not.toHaveBeenCalled()
  })

  it('a failed detection (Windows host / probe error) does not judge', async () => {
    const { cache } = makeCache([{ ok: false, errorCode: 'host-platform', error: 'Windows' }], () => 0)
    expect(await createHeadlessAgentAvailabilityCheck(cache)('codex-cli')).toBeNull()
  })

  it('reuses a fresh result: runnable for 10 min, not-runnable for 30 s', async () => {
    let t = 0
    const now = () => t
    const { cache, detect } = makeCache([report('ok'), report('missing'), report('ok')], now)
    const check = createHeadlessAgentAvailabilityCheck(cache, { now })

    expect(await check('codex-cli')).toBeNull()
    t = HEADLESS_AGENT_CHECK_RUNNABLE_TTL_MS - 1
    expect(await check('codex-cli')).toBeNull()
    expect(detect).toHaveBeenCalledTimes(1)

    t = HEADLESS_AGENT_CHECK_RUNNABLE_TTL_MS + 1 // expired → probe again → now missing
    expect(await check('codex-cli')).toMatchObject({ code: AGENT_UNAVAILABLE })
    expect(detect).toHaveBeenCalledTimes(2)

    t += HEADLESS_AGENT_CHECK_MISSING_TTL_MS - 1
    expect(await check('codex-cli')).toMatchObject({ code: AGENT_UNAVAILABLE })
    expect(detect).toHaveBeenCalledTimes(2)

    t += 2 // a just-installed codex is picked up after 30 s
    expect(await check('codex-cli')).toBeNull()
    expect(detect).toHaveBeenCalledTimes(3)
  })

  it('a result from the remote-tools:detect handler (same cache) is used', async () => {
    const { cache, detect } = makeCache([report('missing')], () => 0)
    await cache.detect() // the tools panel ran a detection
    expect(await createHeadlessAgentAvailabilityCheck(cache, { now: () => 0 })('codex-cli')).toMatchObject({ code: AGENT_UNAVAILABLE })
    expect(detect).toHaveBeenCalledTimes(1)
  })

  it('slow probe with nothing cached → AGENT_CHECK_PENDING; the probe still fills the cache', async () => {
    let release!: (r: RemoteToolsDetectResult) => void
    const slow = new Promise<RemoteToolsDetectResult>(resolve => { release = resolve })
    const { cache, detect } = makeCache([slow], () => 0)
    const check = createHeadlessAgentAvailabilityCheck(cache, { now: () => 0, waitMs: 20 })

    const pending = await check('codex-cli')
    expect(pending).toMatchObject({ ok: false, code: AGENT_CHECK_PENDING, agentId: 'codex-cli', tool: 'codex' })
    expect(pending?.error).toMatch(/retry/)

    release(report('ok'))
    await vi.waitFor(() => expect(cache.peek()).not.toBeNull())
    expect(await check('codex-cli')).toBeNull()
    expect(detect).toHaveBeenCalledTimes(1)
  })

  it('slow probe with a stale result → decides on the stale result', async () => {
    let t = 0
    let release!: (r: RemoteToolsDetectResult) => void
    const slow = new Promise<RemoteToolsDetectResult>(resolve => { release = resolve })
    const { cache } = makeCache([report('missing'), slow], () => t)
    const check = createHeadlessAgentAvailabilityCheck(cache, { now: () => t, waitMs: 20 })
    expect(await check('codex-cli')).toMatchObject({ code: AGENT_UNAVAILABLE })
    t = HEADLESS_AGENT_CHECK_MISSING_TTL_MS + 1
    expect(await check('codex-cli')).toMatchObject({ code: AGENT_UNAVAILABLE, status: 'missing' })
    release(report('ok'))
  })

  it('a probe that throws → not judged (null)', async () => {
    const cache = new HeadlessRemoteToolsCache({ detect: async () => { throw new Error('probe crashed') } })
    expect(await createHeadlessAgentAvailabilityCheck(cache, { waitMs: 50 })('codex-cli')).toBeNull()
  })

  it('concurrent detections share one probe', async () => {
    const { cache, detect } = makeCache([report('ok')], () => 0)
    await Promise.all([cache.detect(), cache.detect(), cache.detect()])
    expect(detect).toHaveBeenCalledTimes(1)
  })
})

describe('terminal:create-agent-command with checkAgentAvailable (T0433)', () => {
  function setup(checkAgentAvailable?: TerminalCommandHandlerDeps['checkAgentAvailable']) {
    const handlers = new Map<string, (ctx: { windowId: string | null }, ...args: unknown[]) => unknown>()
    const ptyManager = { isAlive: vi.fn(() => false), create: vi.fn(() => true), write: vi.fn() }
    const mirror = vi.fn()
    registerTerminalCommandHandlers({
      registerHandler: (channel, handler) => { handlers.set(channel, handler) },
      getPtyManager: () => ptyManager,
      emit: vi.fn(),
      readPersistedSettingsSync: () => ({}),
      buildAgentPromptCommand: async opts => ({ command: `codex '${opts.prompt}'`, agentId: 'codex-cli', prompt: opts.prompt ?? '', prefixNormalized: false }),
      checkAgentAvailable,
      pickWhitelistedEnv: env => env ?? {},
      mirrorToBatScripts: mirror,
      logger: { log: vi.fn(), warn: vi.fn() },
      setTimeout: cb => { cb(); return 0 },
    })
    const invoke = (opts: unknown) => handlers.get('terminal:create-agent-command')!({ windowId: null }, opts)
    return { invoke, ptyManager, mirror }
  }

  it('returns the refusal as-is and creates no PTY', async () => {
    const refusal: AgentUnavailableResult = { ok: false, code: AGENT_UNAVAILABLE, agentId: 'codex-cli', tool: 'codex', status: 'missing', error: 'codex is not available' }
    const check = vi.fn(async () => refusal)
    const { invoke, ptyManager, mirror } = setup(check)
    expect(await invoke({ id: 'w1', cwd: '/tmp', agent: 'codex-cli', prompt: '$ct-exec T1' })).toEqual(refusal)
    expect(check).toHaveBeenCalledWith('codex-cli')
    expect(ptyManager.create).not.toHaveBeenCalled()
    expect(mirror).toHaveBeenCalledWith('ipc-result', expect.objectContaining({ result: false, reason: AGENT_UNAVAILABLE, agentId: 'codex-cli' }))
  })

  it('runnable (null) and no check at all (Electron) both create the terminal', async () => {
    for (const check of [vi.fn(async () => null), undefined]) {
      const { invoke, ptyManager } = setup(check)
      expect(await invoke({ id: 'w2', cwd: '/tmp', agent: 'codex-cli', prompt: 'p' })).toBe(true)
      expect(ptyManager.create).toHaveBeenCalledTimes(1)
    }
  })
})
