/**
 * T0498 — Cache History rows (`applyStatusToCacheHistory`) and grand total (`cacheHistoryGrandTotal`).
 * The end-to-end replay through `ClaudeAgentManager.processMessage` is in
 * electron/__tests__/claude-cache-history-last-call.test.ts.
 */
import { describe, expect, it } from 'vitest'
import {
  applyStatusToCacheHistory,
  cacheHistoryGrandTotal,
  cacheHistoryRowCosts,
  cacheHistoryTotalRows,
  MAX_CACHE_HISTORY_CALL_ROWS,
  type CacheHistoryEntry,
  type CacheHistoryStatus,
  type LastCallUsage,
} from '../cache-history'
import { estimateCallCost, estimateModelUsageCost } from '../model-pricing'

const ctx = (timestamp = 1) => ({ timestamp, messageCount: 0, turnStartMsgId: null })
const status = (over: Partial<CacheHistoryStatus>): CacheHistoryStatus => ({ model: 'claude-opus-5-5', totalCost: 0, inputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0, ...over })
const call = (id: string, query: number, input: number, read: number, write: number, output: number, model = 'claude-opus-5-5'): LastCallUsage =>
  ({ id, query, model, inputTokens: input, cacheReadInputTokens: read, cacheCreationInputTokens: write, outputTokens: output })

describe('applyStatusToCacheHistory — per-call rows (lastCall)', () => {
  it('records the call\'s own tokens, not the session-wide max / last result totals', () => {
    const hist: CacheHistoryEntry[] = []
    // session-wide fields still hold the previous result's totals (the pre-T0498 leftover)
    const kind = applyStatusToCacheHistory(hist, status({ inputTokens: 900_000, cacheReadTokens: 850_000, outputTokens: 7_000, lastCall: call('msg_1', 1, 2_000, 30_000, 8_000, 1) }), ctx())
    expect(kind).toBe('call')
    expect(hist).toHaveLength(1)
    expect(hist[0]).toMatchObject({ isResult: false, calls: 1, totalInput: 40_000, cacheRead: 30_000, cacheCreate: 8_000, callCacheRead: 30_000, callCacheWrite: 8_000, outputTokens: 1, pct: 75, callId: 'msg_1', query: 1, model: 'claude-opus-5-5' })
  })

  it('updates the same call in place (message_delta) and keeps its first timestamp', () => {
    const hist: CacheHistoryEntry[] = []
    applyStatusToCacheHistory(hist, status({ lastCall: call('msg_1', 1, 2_000, 30_000, 8_000, 1) }), ctx(10))
    const kind = applyStatusToCacheHistory(hist, status({ lastCall: call('msg_1', 1, 2_000, 30_000, 8_000, 640) }), ctx(20))
    expect(kind).toBe('updated')
    expect(hist).toHaveLength(1)
    expect(hist[0].outputTokens).toBe(640)
    expect(hist[0].timestamp).toBe(10)
    // the row is priced with exactly the tokens it shows
    const [line] = cacheHistoryRowCosts(hist[0])!
    expect(line.totalCost).toBe(estimateCallCost('claude-opus-5-5', { inputTokens: 2_000, cacheReadInputTokens: 30_000, cacheCreationInputTokens: 8_000, outputTokens: 640 }, hist[0])!.totalCost)
  })

  it('a new call (or the same id in another query) is a new row', () => {
    const hist: CacheHistoryEntry[] = []
    applyStatusToCacheHistory(hist, status({ lastCall: call('msg_1', 1, 1, 10, 0, 1) }), ctx())
    applyStatusToCacheHistory(hist, status({ lastCall: call('msg_2', 1, 1, 20, 0, 1) }), ctx())
    applyStatusToCacheHistory(hist, status({ lastCall: call('msg_2', 2, 1, 20, 0, 1) }), ctx())
    expect(hist.map(h => [h.callId, h.query])).toEqual([['msg_1', 1], ['msg_2', 1], ['msg_2', 2]])
  })

  it('prices the call by its API model id and its own prompt length (Haiku 5.5 tiers)', () => {
    const hist: CacheHistoryEntry[] = []
    applyStatusToCacheHistory(hist, status({ model: 'haiku', lastCall: call('a', 1, 1_000, 99_000, 0, 10, 'claude-haiku-5-5') }), ctx())
    applyStatusToCacheHistory(hist, status({ model: 'haiku', lastCall: call('b', 1, 1_001, 99_000, 0, 10, 'claude-haiku-5-5') }), ctx())
    expect(hist.map(h => h.model)).toEqual(['claude-haiku-5-5', 'claude-haiku-5-5'])
    const short = cacheHistoryRowCosts(hist[0])![0].totalCost!
    const long = cacheHistoryRowCosts(hist[1])![0].totalCost!
    expect(short).toBeCloseTo((1_000 * 0.10 + 99_000 * 0.01 + 10 * 0.50) / 1e6, 12)
    expect(long).toBeCloseTo((1_001 * 0.50 + 99_000 * 0.05 + 10 * 2.50) / 1e6, 12)
  })

  it('falls back to the status model when the call has none, and skips an empty call', () => {
    const hist: CacheHistoryEntry[] = []
    expect(applyStatusToCacheHistory(hist, status({ lastCall: call('a', 1, 0, 0, 0, 0) }), ctx())).toBeNull()
    applyStatusToCacheHistory(hist, status({ model: 'claude-sonnet-5-5', lastCall: { ...call('a', 1, 5, 0, 0, 1), model: '' } }), ctx())
    expect(hist[0].model).toBe('claude-sonnet-5-5')
  })

  it('lastCall: null without modelUsage (query start / init / setModel) adds no row', () => {
    const hist: CacheHistoryEntry[] = []
    applyStatusToCacheHistory(hist, status({ inputTokens: 500_000, cacheReadTokens: 400_000, modelUsage: { 'claude-opus-5-5': { inputTokens: 1, outputTokens: 1, cacheReadInputTokens: 400_000, cacheCreationInputTokens: 99_999, costUSD: 1 } }, lastCall: null }), ctx())
    expect(hist).toHaveLength(1)
    // next query starts: modelUsage cleared, session-wide totals still the last result's
    expect(applyStatusToCacheHistory(hist, status({ inputTokens: 500_000, cacheReadTokens: 400_000, lastCall: null }), ctx())).toBeNull()
    expect(hist).toHaveLength(1)
  })

  it('result statuses keep the pre-T0498 R row', () => {
    const hist: CacheHistoryEntry[] = []
    const mu = { 'claude-opus-5-5': { inputTokens: 10, outputTokens: 20, cacheReadInputTokens: 30, cacheCreationInputTokens: 40, costUSD: 0.5 } }
    expect(applyStatusToCacheHistory(hist, status({ inputTokens: 80, cacheReadTokens: 30, cacheCreationTokens: 40, outputTokens: 20, lastQueryCalls: 3, modelUsage: mu, lastCall: null, totalCost: 2 }), ctx())).toBe('result')
    expect(hist[0]).toMatchObject({ isResult: true, calls: 3, totalInput: 80, cacheRead: 30, cacheCreate: 40, outputTokens: 20, apiTotalCost: 2 })
    expect(hist[0].modelUsage).toEqual(mu)
    expect(hist[0].modelUsage).not.toBe(mu)
    // same result again (e.g. setModel after the turn) is not a second row
    expect(applyStatusToCacheHistory(hist, status({ inputTokens: 80, cacheReadTokens: 30, cacheCreationTokens: 40, modelUsage: mu, lastCall: null }), ctx())).toBeNull()
    expect(hist).toHaveLength(1)
  })

  it('keeps at most 20 per-call rows, dropping the oldest; result rows stay', () => {
    const hist: CacheHistoryEntry[] = []
    applyStatusToCacheHistory(hist, status({ inputTokens: 1, cacheReadTokens: 0, modelUsage: { m: { inputTokens: 1, outputTokens: 0, cacheReadInputTokens: 0, cacheCreationInputTokens: 0, costUSD: 0 } } }), ctx())
    for (let i = 0; i < 25; i++) applyStatusToCacheHistory(hist, status({ lastCall: call(`msg_${i}`, 1, 10, 0, 0, 1) }), ctx())
    expect(hist.filter(h => !h.isResult)).toHaveLength(MAX_CACHE_HISTORY_CALL_ROWS)
    expect(hist[0].isResult).toBe(true)
    expect(hist[1].callId).toBe('msg_5')
  })
})

describe('applyStatusToCacheHistory — pre-T0498 server (no lastCall field)', () => {
  // verbatim copy of the pre-T0498 ClaudeAgentPanel onStatus block (minus the result ref)
  function legacyPush(hist: CacheHistoryEntry[], m: CacheHistoryStatus, c: ReturnType<typeof ctx>) {
    if (m.inputTokens > 0 && m.cacheReadTokens !== undefined) {
      const lastEntry = hist[hist.length - 1]
      const hasModelUsage = m.modelUsage && Object.keys(m.modelUsage).length > 0
      const isResult = !!hasModelUsage
      if (!lastEntry || lastEntry.cacheRead !== m.cacheReadTokens || lastEntry.totalInput !== m.inputTokens || (isResult !== lastEntry.isResult)) {
        const pct = Math.round((m.cacheReadTokens / m.inputTokens) * 100)
        const entry = { pct, cacheRead: m.cacheReadTokens, cacheCreate: m.cacheCreationTokens || 0, totalInput: m.inputTokens, contextSize: m.contextTokens || 0, callCacheRead: m.callCacheRead || 0, callCacheWrite: m.callCacheWrite || 0, calls: isResult ? (m.lastQueryCalls || 0) : 1, isResult, modelUsage: m.modelUsage ? { ...m.modelUsage } : undefined, model: m.model, outputTokens: m.outputTokens || 0, cacheWrite5mTokens: m.cacheWrite5mTokens, cacheWrite1hTokens: m.cacheWrite1hTokens, timestamp: c.timestamp, messageCount: c.messageCount, turnStartMsgId: c.turnStartMsgId, apiTotalCost: m.totalCost || 0 }
        hist.push(entry)
        while (hist.filter(h => !h.isResult).length > 20) {
          const idx = hist.findIndex(h => !h.isResult)
          if (idx >= 0) hist.splice(idx, 1); else break
        }
      }
    }
  }

  it('builds exactly the rows the old panel built', () => {
    const seq: CacheHistoryStatus[] = [
      status({ inputTokens: 0 }),
      status({ inputTokens: 20_000, cacheReadTokens: 0, cacheCreationTokens: 20_000, callCacheWrite: 20_000, contextTokens: 20_000, outputTokens: 1 }),
      status({ inputTokens: 20_000, cacheReadTokens: 0, cacheCreationTokens: 20_000, callCacheWrite: 20_000, contextTokens: 20_000, outputTokens: 500 }),
      status({ inputTokens: 26_000, cacheReadTokens: 20_000, cacheCreationTokens: 6_000, callCacheRead: 20_000, contextTokens: 26_000, outputTokens: 500 }),
      status({ inputTokens: 46_000, cacheReadTokens: 20_000, cacheCreationTokens: 26_000, outputTokens: 900, lastQueryCalls: 2, modelUsage: { 'claude-opus-5-5': { inputTokens: 0, outputTokens: 900, cacheReadInputTokens: 20_000, cacheCreationInputTokens: 26_000, costUSD: 0.2 } } }),
      status({ inputTokens: 46_000, cacheReadTokens: 20_000, cacheCreationTokens: 26_000, outputTokens: 900 }),
      ...Array.from({ length: 30 }, (_, i) => status({ inputTokens: 50_000 + i, cacheReadTokens: i })),
    ]
    const a: CacheHistoryEntry[] = []
    const b: CacheHistoryEntry[] = []
    seq.forEach((m, i) => { applyStatusToCacheHistory(a, m, ctx(i)); legacyPush(b, m, ctx(i)) })
    expect(a).toEqual(b)
  })
})

describe('cacheHistoryGrandTotal', () => {
  const opus = (id: string, query: number, input: number, read: number, write: number, output: number) => call(id, query, input, read, write, output)
  const sumUsage = (calls: LastCallUsage[]) => ({
    inputTokens: calls.reduce((s, c) => s + c.inputTokens, 0),
    outputTokens: calls.reduce((s, c) => s + c.outputTokens, 0),
    cacheReadInputTokens: calls.reduce((s, c) => s + c.cacheReadInputTokens, 0),
    cacheCreationInputTokens: calls.reduce((s, c) => s + c.cacheCreationInputTokens, 0),
  })
  const resultStatus = (calls: LastCallUsage[]) => {
    const u = sumUsage(calls)
    return status({ inputTokens: u.inputTokens + u.cacheReadInputTokens + u.cacheCreationInputTokens, cacheReadTokens: u.cacheReadInputTokens, cacheCreationTokens: u.cacheCreationInputTokens, outputTokens: u.outputTokens, lastQueryCalls: calls.length, modelUsage: { 'claude-opus-5-5': { ...u, costUSD: 0 } }, lastCall: null })
  }
  const callCost = (c: LastCallUsage) => estimateCallCost(c.model, c)!.totalCost

  it('a result covers the per-call rows of its query: total = sum of result rows = sum of every call', () => {
    const q1 = [opus('a', 1, 2_000, 0, 20_000, 500), opus('b', 1, 1_000, 20_000, 5_000, 800), opus('c', 1, 1_000, 25_000, 5_000, 1_200)]
    const q2 = [opus('d', 2, 2_000, 30_000, 0, 300), opus('e', 2, 2_000, 32_000, 0, 400)]
    const hist: CacheHistoryEntry[] = []
    for (const [calls] of [[q1], [q2]] as const) {
      for (const c of calls) applyStatusToCacheHistory(hist, status({ lastCall: c }), ctx())
      applyStatusToCacheHistory(hist, resultStatus(calls), ctx())
    }
    expect(cacheHistoryTotalRows(hist)).toEqual([false, false, false, true, false, false, true])
    const { total, hasAnyCost } = cacheHistoryGrandTotal(hist)
    expect(hasAnyCost).toBe(true)
    const perCall = [...q1, ...q2].reduce((s, c) => s + callCost(c), 0)
    const results = estimateModelUsageCost('claude-opus-5-5', sumUsage(q1))!.totalCost + estimateModelUsageCost('claude-opus-5-5', sumUsage(q2))!.totalCost
    expect(total).toBeCloseTo(results, 12)
    expect(total).toBeCloseTo(perCall, 12)
  })

  it('rows of a query that ended without a result stay in; so do the rows of the running query', () => {
    const aborted = [opus('a', 1, 1_000, 0, 10_000, 50)]
    const q2 = [opus('b', 2, 1_000, 10_000, 0, 100)]
    const running = [opus('c', 3, 500, 11_000, 0, 20)]
    const hist: CacheHistoryEntry[] = []
    for (const c of [...aborted, ...q2]) applyStatusToCacheHistory(hist, status({ lastCall: c }), ctx())
    applyStatusToCacheHistory(hist, resultStatus(q2), ctx())
    for (const c of running) applyStatusToCacheHistory(hist, status({ lastCall: c }), ctx())
    expect(cacheHistoryTotalRows(hist)).toEqual([true, false, true, true])
    expect(cacheHistoryGrandTotal(hist).total).toBeCloseTo(callCost(aborted[0]) + callCost(q2[0]) + callCost(running[0]), 12)
  })

  it('pre-T0498 rows (no query) before a result are all covered by it', () => {
    const hist: CacheHistoryEntry[] = [
      { pct: 0, cacheRead: 0, cacheCreate: 0, totalInput: 900_000, contextSize: 0, callCacheRead: 0, callCacheWrite: 0, calls: 1, model: 'claude-opus-5-5', outputTokens: 9_000 },
      { pct: 0, cacheRead: 0, cacheCreate: 0, totalInput: 30_000, contextSize: 0, callCacheRead: 0, callCacheWrite: 0, calls: 1, model: 'claude-opus-5-5' },
    ]
    applyStatusToCacheHistory(hist, resultStatus([opus('a', 1, 30_000, 0, 0, 10)]), ctx())
    expect(cacheHistoryTotalRows(hist)).toEqual([false, false, true])
    expect(cacheHistoryGrandTotal(hist).total).toBeCloseTo(callCost(opus('a', 1, 30_000, 0, 0, 10)), 12)
  })

  it('unknown models contribute nothing and leave hasAnyCost false', () => {
    const hist: CacheHistoryEntry[] = []
    applyStatusToCacheHistory(hist, status({ lastCall: call('a', 1, 10, 0, 0, 1, 'gpt-5') }), ctx())
    expect(cacheHistoryGrandTotal(hist)).toEqual({ total: 0, hasAnyCost: false })
    expect(cacheHistoryGrandTotal([])).toEqual({ total: 0, hasAnyCost: false })
  })
})
