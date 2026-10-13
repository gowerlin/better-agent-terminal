// @vitest-environment node
/**
 * T0484 — ClaudeAgentManager:
 * - `estimateModelLimits()`: what `setModel()` shows until the next query's `modelUsage`
 *   (Claude 5 values from platform.claude.com/docs/en/models/overview, 2026-10-13).
 * - Per-call usage tracking → `modelUsage[model].longPrompt` for Haiku 5.5 prompt-length pricing.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => new Proxy({}, {
  get(_target, prop) {
    throw new Error(`claude-agent-manager must not touch electron: electron.${String(prop)}`)
  },
}))

import {
  ClaudeAgentManager,
  estimateModelLimits,
  createQueryCallTracker,
  recordCallUsage,
  trackStreamEventUsage,
  attachLongPromptUsage,
} from '../claude-agent-manager'

const ONE_MIL = 1_000_000

describe('estimateModelLimits', () => {
  it.each(['claude-opus-5-5', 'claude-fable-5-1', 'claude-sonnet-5-5', 'claude-haiku-5-5'])('%s → 1M context / 128K output', (id) => {
    expect(estimateModelLimits(id)).toEqual({ contextWindow: ONE_MIL, maxOutputTokens: 128_000 })
  })

  it('a [1m] suffix on a Claude 5 id changes nothing', () => {
    expect(estimateModelLimits('claude-opus-5-5[1m]')).toEqual({ contextWindow: ONE_MIL, maxOutputTokens: 128_000 })
  })

  // Pre-T0484 rule, unchanged: `[1m]` → 1M else 200K; `haiku` → 8192 else 64000.
  it.each([
    ['claude-opus-4-7', 200_000, 64_000],
    ['claude-opus-4-7[1m]', ONE_MIL, 64_000],
    ['claude-opus-4-6', 200_000, 64_000],
    ['claude-opus-4-6[1m]', ONE_MIL, 64_000],
    ['claude-sonnet-4-6', 200_000, 64_000],
    ['claude-sonnet-4-6[1m]', ONE_MIL, 64_000],
    ['claude-haiku-4-5-20251001', 200_000, 8_192],
  ] as const)('legacy %s → %i / %i', (id, contextWindow, maxOutputTokens) => {
    expect(estimateModelLimits(id)).toEqual({ contextWindow, maxOutputTokens })
  })

  // Not listed on the models overview page → pre-T0484 estimate.
  it.each([
    ['claude-opus-5', 200_000, 64_000],
    ['claude-sonnet-5', 200_000, 64_000],
    ['claude-fable-5', 200_000, 64_000],
    ['default', 200_000, 64_000],
    ['opus', 200_000, 64_000],
    ['haiku', 200_000, 8_192],
    ['some-future-model[1m]', ONE_MIL, 64_000],
  ] as const)('unknown / alias %s → %i / %i', (id, contextWindow, maxOutputTokens) => {
    expect(estimateModelLimits(id)).toEqual({ contextWindow, maxOutputTokens })
  })
})

const zero = { inputTokens: 0, outputTokens: 0, cacheReadInputTokens: 0, cacheCreationInputTokens: 0 }

describe('per-call usage tracking', () => {
  it('message_start names the call, message_delta updates the call on the same origin', () => {
    const t = createQueryCallTracker()
    trackStreamEventUsage(t, '', { type: 'message_start', message: { id: 'msg_a', model: 'claude-haiku-5-5', usage: { input_tokens: 10, cache_read_input_tokens: 120_000, output_tokens: 1 } } })
    trackStreamEventUsage(t, 'toolu_1', { type: 'message_start', message: { id: 'msg_b', model: 'claude-haiku-5-5', usage: { input_tokens: 5 } } })
    trackStreamEventUsage(t, '', { type: 'message_delta', usage: { output_tokens: 900 } })
    trackStreamEventUsage(t, 'toolu_1', { type: 'message_delta', usage: { output_tokens: 40 } })
    expect(t.calls.get('msg_a')).toEqual({ model: 'claude-haiku-5-5', inputTokens: 10, outputTokens: 900, cacheReadInputTokens: 120_000, cacheCreationInputTokens: 0 })
    expect(t.calls.get('msg_b')).toEqual({ model: 'claude-haiku-5-5', inputTokens: 5, outputTokens: 40, cacheReadInputTokens: 0, cacheCreationInputTokens: 0 })
  })

  it('assistant-message usage merges into the same call (largest value wins)', () => {
    const t = createQueryCallTracker()
    recordCallUsage(t, 'msg_a', 'claude-haiku-5-5', { input_tokens: 10, output_tokens: 3 })
    recordCallUsage(t, 'msg_a', undefined, { input_tokens: 10, output_tokens: 700 })
    recordCallUsage(t, 'msg_a', 'claude-haiku-5-5', { input_tokens: 10, output_tokens: 3 })
    expect(t.calls.get('msg_a')!.outputTokens).toBe(700)
    expect(t.calls.size).toBe(1)
  })

  it('ignores events without an id / usage', () => {
    const t = createQueryCallTracker()
    trackStreamEventUsage(t, '', { type: 'message_delta', usage: { output_tokens: 5 } })
    recordCallUsage(t, undefined, 'x', { input_tokens: 1 })
    recordCallUsage(t, 'msg_x', 'x', undefined)
    expect(t.calls.size).toBe(0)
  })

  it('attachLongPromptUsage sums only calls over 100,000 prompt tokens, per model', () => {
    const t = createQueryCallTracker()
    recordCallUsage(t, 'm1', 'claude-haiku-5-5', { input_tokens: 1_000, cache_read_input_tokens: 99_000, output_tokens: 10 }) // 100,000 → short
    recordCallUsage(t, 'm2', 'claude-haiku-5-5', { input_tokens: 1_001, cache_read_input_tokens: 99_000, output_tokens: 20 }) // 100,001 → long
    recordCallUsage(t, 'm3', 'claude-haiku-5-5', { input_tokens: 2, cache_creation_input_tokens: 200_000, output_tokens: 30 }) // long
    recordCallUsage(t, 'm4', 'claude-opus-5-5', { input_tokens: 500_000, output_tokens: 40 }) // long, other model
    const mu: Record<string, typeof zero & { costUSD: number; longPrompt?: typeof zero }> = {
      'claude-haiku-5-5': { ...zero, costUSD: 0 },
      'claude-opus-5-5': { ...zero, costUSD: 0 },
    }
    attachLongPromptUsage(mu, t)
    expect(mu['claude-haiku-5-5'].longPrompt).toEqual({ inputTokens: 1_003, outputTokens: 50, cacheReadInputTokens: 99_000, cacheCreationInputTokens: 200_000 })
    // tracked for every model; the renderer ignores it where the price has no prompt-length tier
    expect(mu['claude-opus-5-5'].longPrompt).toEqual({ inputTokens: 500_000, outputTokens: 40, cacheReadInputTokens: 0, cacheCreationInputTokens: 0 })
  })

  it('attachLongPromptUsage matches a suffixed modelUsage key and drops unknown models', () => {
    const t = createQueryCallTracker()
    recordCallUsage(t, 'm1', 'claude-haiku-5-5', { input_tokens: 150_000 })
    recordCallUsage(t, 'm2', 'claude-unknown', { input_tokens: 150_000 })
    const mu: Record<string, typeof zero & { costUSD: number; longPrompt?: typeof zero }> = { 'claude-haiku-5-5[1m]': { ...zero, costUSD: 0 } }
    attachLongPromptUsage(mu, t)
    expect(mu['claude-haiku-5-5[1m]'].longPrompt!.inputTokens).toBe(150_000)
    expect(Object.keys(mu)).toEqual(['claude-haiku-5-5[1m]'])
  })

  it('no long calls / no tracker → modelUsage untouched', () => {
    const mu = { 'claude-haiku-5-5': { ...zero, costUSD: 0 } }
    attachLongPromptUsage(mu, undefined)
    const t = createQueryCallTracker()
    recordCallUsage(t, 'm1', 'claude-haiku-5-5', { input_tokens: 100_000 })
    attachLongPromptUsage(mu, t)
    expect(mu).toEqual({ 'claude-haiku-5-5': { ...zero, costUSD: 0 } })
  })
})

// End to end through processMessage: stream events + sub-agent assistant message + result.
type ProcessHook = { processMessage(sessionId: string, session: unknown, message: unknown): void }

const managers: ClaudeAgentManager[] = []
afterEach(() => {
  for (const m of managers.splice(0)) { m.killAll(); m.dispose() }
})

describe('processMessage → claude:status modelUsage.longPrompt', () => {
  it('reports the long-prompt part of the turn and resets for the next query', () => {
    const emit = vi.fn()
    const manager = new ClaudeAgentManager({ emit, getSettings: () => ({ notifyOnComplete: false }) })
    managers.push(manager)
    const session = {
      cwd: process.cwd(),
      state: { isStreaming: true, totalCost: 0, totalTokens: 0 },
      metadata: { totalCost: 0, inputTokens: 0, outputTokens: 0, durationMs: 0, numTurns: 0, contextWindow: 0, maxOutputTokens: 0, contextTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0, callCacheRead: 0, callCacheWrite: 0, lastQueryCalls: 0 } as Record<string, unknown>,
      activeTasks: new Map(),
      pendingPermissions: new Map(),
      pendingAskUser: new Map(),
      messageQueue: [],
    } as Record<string, unknown> & { callUsage?: unknown; metadata: Record<string, unknown> }
    const pm = (msg: unknown) => (manager as unknown as ProcessHook).processMessage('s1', session, msg)

    // main agent: 30K prompt (short)
    pm({ type: 'stream_event', parent_tool_use_id: null, event: { type: 'message_start', message: { id: 'msg_1', model: 'claude-haiku-5-5', usage: { input_tokens: 30_000, output_tokens: 1 } } } })
    pm({ type: 'stream_event', parent_tool_use_id: null, event: { type: 'message_delta', usage: { output_tokens: 100 } } })
    // sub-agent: only an assistant message, 180K prompt (long)
    pm({ type: 'assistant', parent_tool_use_id: 'toolu_x', message: { id: 'msg_2', model: 'claude-haiku-5-5', role: 'assistant', content: [], usage: { input_tokens: 1_000, cache_read_input_tokens: 179_000, output_tokens: 200 } } })
    pm({
      type: 'result', subtype: 'success', total_cost_usd: 0.1, num_turns: 2, duration_ms: 1,
      usage: { input_tokens: 31_000, output_tokens: 300 },
      modelUsage: { 'claude-haiku-5-5': { inputTokens: 31_000, outputTokens: 300, cacheReadInputTokens: 179_000, cacheCreationInputTokens: 0, costUSD: 0.1 } },
    })

    const statuses = emit.mock.calls.filter(c => c[0] === 'claude:status').map(c => c[2] as { modelUsage?: Record<string, { longPrompt?: unknown }> })
    const last = statuses[statuses.length - 1]
    expect(last.modelUsage!['claude-haiku-5-5'].longPrompt).toEqual({ inputTokens: 1_000, outputTokens: 200, cacheReadInputTokens: 179_000, cacheCreationInputTokens: 0 })
    // tracker is cleared after the result, so the next query starts empty
    expect((session.callUsage as { calls: Map<string, unknown> }).calls.size).toBe(0)
  })
})

describe('setModel → claude:status limits', () => {
  it.each([
    ['claude-haiku-5-5', ONE_MIL, 128_000],
    ['claude-haiku-4-5-20251001', 200_000, 8_192],
    ['claude-opus-4-7[1m]', ONE_MIL, 64_000],
  ] as const)('%s → %i / %i', async (model, contextWindow, maxOutputTokens) => {
    const emit = vi.fn()
    const manager = new ClaudeAgentManager({ emit, getSettings: () => ({}) })
    managers.push(manager)
    const session = { apiVersion: 'v1', metadata: { contextWindow: 0, maxOutputTokens: 0 }, messageQueue: [], activeTasks: new Map(), pendingPermissions: new Map(), pendingAskUser: new Map(), abortController: new AbortController(), state: {} }
    ;(manager as unknown as { sessions: Map<string, unknown> }).sessions.set('s1', session)
    expect(await manager.setModel('s1', model)).toBe(true)
    const status = emit.mock.calls.filter(c => c[0] === 'claude:status').pop()![2] as { contextWindow: number; maxOutputTokens: number }
    expect(status.contextWindow).toBe(contextWindow)
    expect(status.maxOutputTokens).toBe(maxOutputTokens)
  })
})
