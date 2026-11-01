/**
 * T0498 — Cache History rows (`applyStatusToCacheHistory`) and grand total (`cacheHistoryGrandTotal`).
 * T0744 / BUG-181 — R rows from the CLI's session running totals (`turnModelUsage`, `cacheHistoryApiTotal`).
 * The end-to-end replay through `ClaudeAgentManager.processMessage` is in
 * electron/__tests__/claude-cache-history-last-call.test.ts.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  applyStatusToCacheHistory,
  cacheHistoryApiTotal,
  cacheHistoryGrandTotal,
  cacheHistoryRealCost,
  cacheHistoryRowCosts,
  cacheHistoryTotalRows,
  freshUsageBaseline,
  MAX_CACHE_HISTORY_CALL_ROWS,
  turnModelUsage,
  unknownUsageBaseline,
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
    // T0744: the R row also records the running totals it was taken from; with no earlier result
    // (a new session) its numbers are those totals, as before
    const r = a.find(h => h.isResult)!
    expect(r.usageBasis).toBe('turn')
    expect(r.cumulativeModelUsage).toEqual(r.modelUsage)
    expect(a.map(({ cumulativeModelUsage: _c, usageBasis: _u, ...rest }) => rest)).toEqual(b)
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

// ── T0744 / BUG-181: the CLI's `modelUsage` / `total_cost_usd` are session running totals ──
describe('T0744 — R rows from the CLI running totals', () => {
  type MU = NonNullable<CacheHistoryStatus['modelUsage']>
  const H55 = 'claude-haiku-5-5'
  const H45 = 'claude-haiku-4-5'
  const u = (input: number, write: number, read: number, output: number, costUSD: number) =>
    ({ inputTokens: input, cacheCreationInputTokens: write, cacheReadInputTokens: read, outputTokens: output, costUSD })
  /** A result status carrying running totals, the way claude-agent-manager forwards the CLI's result. */
  const resultOf = (mu: MU, lastQueryCalls = 1): CacheHistoryStatus => {
    let input = 0, read = 0, write = 0, output = 0, cost = 0
    for (const s of Object.values(mu)) { input += s.inputTokens + s.cacheReadInputTokens + s.cacheCreationInputTokens; read += s.cacheReadInputTokens; write += s.cacheCreationInputTokens; output += s.outputTokens; cost += s.costUSD }
    return status({ model: H55, inputTokens: input, cacheReadTokens: read, cacheCreationTokens: write, outputTokens: output, totalCost: cost, lastQueryCalls, modelUsage: mu, lastCall: null })
  }
  const add = (a: MU, b: MU): MU => {
    const out: MU = JSON.parse(JSON.stringify(a))
    for (const [k, v] of Object.entries(b)) {
      const o = out[k] ?? u(0, 0, 0, 0, 0)
      out[k] = u(o.inputTokens + v.inputTokens, o.cacheCreationInputTokens + v.cacheCreationInputTokens, o.cacheReadInputTokens + v.cacheReadInputTokens, o.outputTokens + v.outputTokens, o.costUSD + v.costUSD)
    }
    return out
  }

  // T0739〈用量〉: per-turn `result.usage` and the running `total_cost_usd`. The turn of ⑤'s background
  // sub-agent + CLI follow-up (no own usage line; +0.005329 on haiku-5-5) and the haiku-4-5 prompt
  // suggestion after ⑥ (+0.008099) land in the next result. Their token counts are not in T0739 and
  // are made up here (example values).
  const T0739_TURNS: Array<{ name: string; usage: MU }> = [
    { name: '①', usage: { [H55]: u(2, 21_679, 18_282, 8, 0.004650) } },
    { name: '②', usage: { [H55]: u(4, 17_300, 66_522, 89, 0.004170) } },
    { name: '③', usage: { [H55]: u(4, 4_227, 88_685, 151, 0.002303) } },
    { name: '④', usage: { [H55]: u(10, 8_938, 265_630, 849, 0.005421) } },
    { name: '⑤', usage: { [H55]: u(4, 4_878, 115_520, 212, 0.002907) } },
    // ⑥ on haiku-4-5, plus the background sub-agent turn on haiku-5-5 before it (example tokens)
    { name: '⑥', usage: { [H55]: u(6, 3_000, 52_000, 300, 0.005329), [H45]: u(26, 48_391, 94_317, 474, 0.108610) } },
    // ⑦ on haiku-5-5, plus the haiku-4-5 prompt suggestion after ⑥ (example tokens)
    { name: '⑦', usage: { [H55]: u(2, 5_410, 62_526, 8, 0.001711), [H45]: u(3, 0, 48_000, 20, 0.008099) } },
  ]
  const runningTotals = (): MU[] => {
    const out: MU[] = []
    let acc: MU = {}
    for (const t of T0739_TURNS) { acc = add(acc, t.usage); out.push(acc) }
    return out
  }
  const realCost = (h: CacheHistoryEntry) => Object.values(h.modelUsage!).reduce((s, m) => s + m.costUSD, 0)

  it('T0739 numbers: each R row is its turn; real $ total = the last running total (0.1432), not the old ~0.34', () => {
    const totals = runningTotals()
    expect(Object.values(totals.at(-1)!).reduce((s, m) => s + m.costUSD, 0)).toBeCloseTo(0.143200, 6)
    // the pre-T0744 panel added the running totals up
    const oldSum = totals.reduce((s, mu) => s + Object.values(mu).reduce((x, m) => x + m.costUSD, 0), 0)
    expect(oldSum).toBeCloseTo(0.3372, 4) // T0739 reported ~0.34

    const hist: CacheHistoryEntry[] = []
    const baseline = freshUsageBaseline()
    for (const mu of totals) expect(applyStatusToCacheHistory(hist, resultOf(mu), ctx(), baseline)).toBe('result')
    expect(hist).toHaveLength(T0739_TURNS.length)
    expect(hist.every(h => h.usageBasis === 'turn')).toBe(true)
    hist.forEach((h, i) => {
      const turn = T0739_TURNS[i].usage
      expect(Object.keys(h.modelUsage!).sort(), T0739_TURNS[i].name).toEqual(Object.keys(turn).sort())
      for (const [model, want] of Object.entries(turn)) {
        const got = h.modelUsage![model]
        expect([got.inputTokens, got.cacheCreationInputTokens, got.cacheReadInputTokens, got.outputTokens]).toEqual([want.inputTokens, want.cacheCreationInputTokens, want.cacheReadInputTokens, want.outputTokens])
        expect(got.costUSD).toBeCloseTo(want.costUSD, 9)
      }
      const w = Object.values(turn)
      const read = w.reduce((s, x) => s + x.cacheReadInputTokens, 0)
      const all = w.reduce((s, x) => s + x.inputTokens + x.cacheReadInputTokens + x.cacheCreationInputTokens, 0)
      expect([h.cacheRead, h.totalInput, h.outputTokens, h.pct]).toEqual([read, all, w.reduce((s, x) => s + x.outputTokens, 0), Math.round((read / all) * 100)])
      expect(h.cumulativeModelUsage).toEqual(totals[i])
    })
    // ② as T0739 measured it: running cache read 84,804 = ① 18,282 + ② 66,522; the row shows 66,522
    expect(totals[1][H55].cacheReadInputTokens).toBe(84_804)
    expect(hist[1].cacheRead).toBe(66_522)
    expect(realCost(hist[1])).toBeCloseTo(0.004170, 9)

    const api = cacheHistoryApiTotal(hist)
    expect(api.hasApiCost).toBe(true)
    expect(api.total).toBeCloseTo(0.143200, 9)
    expect(hist.reduce((s, h) => s + cacheHistoryRealCost(h)!, 0)).toBeCloseTo(api.total, 12)
    // est. $: the rows' estimates add up to the estimate of the last running totals (prices are linear)
    const lastEst = Object.entries(totals.at(-1)!).reduce((s, [m, x]) => s + estimateModelUsageCost(m, x)!.totalCost, 0)
    expect(cacheHistoryGrandTotal(hist).total).toBeCloseTo(lastEst, 12)
    expect(baseline.modelUsage).toEqual(totals.at(-1))
  })

  it('a model new to the session starts from 0; a model with nothing new this turn is left out of the row', () => {
    const t1: MU = { [H55]: u(1, 100, 1_000, 10, 0.01) }
    const t2: MU = { [H55]: u(1, 100, 1_000, 10, 0.01), [H45]: u(5, 500, 5_000, 50, 0.05) }
    const r = turnModelUsage(t2, t1)
    expect(r.basis).toBe('turn')
    expect(Object.keys(r.modelUsage)).toEqual([H45])
    expect(r.modelUsage[H45]).toEqual(u(5, 500, 5_000, 50, 0.05))
    // nothing new at all: the models stay, at 0
    const same = turnModelUsage(t1, t1)
    expect(same).toEqual({ modelUsage: { [H55]: u(0, 0, 0, 0, 0) }, basis: 'turn' })
  })

  it('a total that went down (reset, e.g. /clear or a zeroed crash result): the row is the new totals; next row diffs from them', () => {
    const hist: CacheHistoryEntry[] = []
    const baseline = freshUsageBaseline()
    applyStatusToCacheHistory(hist, resultOf({ [H55]: u(10, 1_000, 50_000, 100, 0.05) }), ctx(), baseline)
    applyStatusToCacheHistory(hist, resultOf({ [H55]: u(2, 200, 3_000, 20, 0.004) }), ctx(), baseline)
    applyStatusToCacheHistory(hist, resultOf({ [H55]: u(3, 300, 7_000, 30, 0.006) }), ctx(), baseline)
    expect(hist.map(h => h.usageBasis)).toEqual(['turn', 'reset', 'turn'])
    expect(hist[1].modelUsage![H55]).toEqual(u(2, 200, 3_000, 20, 0.004))
    expect(hist[2].modelUsage![H55].cacheReadInputTokens).toBe(4_000)
    expect(hist[2].modelUsage![H55].costUSD).toBeCloseTo(0.002, 12)
    // what was spent: 0.05 before the reset + 0.006 after
    expect(cacheHistoryApiTotal(hist).total).toBeCloseTo(0.056, 12)
    // only the token count dropping, or a model disappearing, is also a reset
    expect(turnModelUsage({ [H55]: u(10, 1_000, 49_999, 100, 0.06) }, { [H55]: u(10, 1_000, 50_000, 100, 0.05) }).basis).toBe('reset')
    expect(turnModelUsage({ [H55]: u(10, 1_000, 50_000, 100, 0.05) }, { [H55]: u(10, 1_000, 50_000, 100, 0.05), [H45]: u(1, 0, 0, 1, 0.001) }).basis).toBe('reset')
    // float noise in costUSD is not a reset
    expect(turnModelUsage({ [H55]: u(10, 1_000, 50_000, 100, 0.3 - 1e-15) }, { [H55]: u(10, 1_000, 50_000, 100, 0.3) }).basis).toBe('turn')
  })

  it('resume: the first result is R* (includes-prior, the running total as received); later rows are turns; real $ total = the running total', () => {
    const totals = runningTotals()
    const hist: CacheHistoryEntry[] = []
    const baseline = unknownUsageBaseline()
    // the panel resumed after ⑥: it never saw ①–⑥
    applyStatusToCacheHistory(hist, resultOf(totals[5]), ctx(), baseline)
    applyStatusToCacheHistory(hist, resultOf(totals[6]), ctx(), baseline)
    expect(hist.map(h => h.usageBasis)).toEqual(['includes-prior', 'turn'])
    expect(hist[0].modelUsage).toEqual(totals[5])
    expect(realCost(hist[1])).toBeCloseTo(0.001711 + 0.008099, 9)
    expect(cacheHistoryApiTotal(hist).total).toBeCloseTo(0.143200, 9)
  })

  it('the same result re-sent (setModel, Clear then setModel) adds no row; Clear keeps the baseline', () => {
    const totals = runningTotals()
    const hist: CacheHistoryEntry[] = []
    const baseline = freshUsageBaseline()
    applyStatusToCacheHistory(hist, resultOf(totals[0]), ctx(), baseline)
    expect(applyStatusToCacheHistory(hist, resultOf(totals[0]), ctx(), baseline)).toBeNull()
    hist.length = 0 // the panel's Clear button
    expect(applyStatusToCacheHistory(hist, resultOf(totals[0]), ctx(), baseline)).toBeNull()
    expect(hist).toHaveLength(0)
    applyStatusToCacheHistory(hist, resultOf(totals[1]), ctx(), baseline)
    expect(hist[0].usageBasis).toBe('turn')
    expect(hist[0].cacheRead).toBe(66_522)
  })

  it('without a baseline argument the previous R row of the history is the baseline (none: 0)', () => {
    const totals = runningTotals()
    const hist: CacheHistoryEntry[] = []
    applyStatusToCacheHistory(hist, resultOf(totals[0]), ctx())
    applyStatusToCacheHistory(hist, resultOf(totals[1]), ctx())
    expect(hist.map(h => [h.usageBasis, h.cacheRead])).toEqual([['turn', 18_282], ['turn', 66_522]])
    // a row from before T0744 (running totals in `modelUsage`, no `cumulativeModelUsage`) works the same
    const old: CacheHistoryEntry[] = [{ ...hist[0], modelUsage: totals[0], cumulativeModelUsage: undefined, usageBasis: undefined }]
    applyStatusToCacheHistory(old, resultOf(totals[1]), ctx())
    expect(old[1].cacheRead).toBe(66_522)
  })

  it('keeps the query own longPrompt split (not a running total); pricing still clamps it to the row', () => {
    const prev: MU = { [H55]: u(1_000, 0, 200_000, 100, 0.03) }
    const cur: MU = { [H55]: { ...u(2_000, 0, 300_000, 200, 0.08), longPrompt: { inputTokens: 1_000, outputTokens: 100, cacheReadInputTokens: 100_000, cacheCreationInputTokens: 0 } } }
    const r = turnModelUsage(cur, prev)
    expect(r.modelUsage[H55].longPrompt).toEqual({ inputTokens: 1_000, outputTokens: 100, cacheReadInputTokens: 100_000, cacheCreationInputTokens: 0 })
    expect(r.modelUsage[H55].longPrompt).not.toBe(cur[H55].longPrompt)
    // the whole delta (1,000 input / 100,000 read / 100 output) is the long-prompt call
    expect(estimateModelUsageCost(H55, r.modelUsage[H55])!.totalCost).toBeCloseTo((1_000 * 0.50 + 100_000 * 0.05 + 100 * 2.50) / 1e6, 12)
  })

  it('ClaudeAgentPanel passes its baseline and takes real $ from cache-history.ts (no inline costUSD sums)', () => {
    const src = readFileSync(join(__dirname, '..', '..', 'components', 'ClaudeAgentPanel.tsx'), 'utf8')
    expect(src).toContain('cacheUsageBaselineRef.current)')
    expect(src).toContain('cacheHistoryApiTotal(hist)')
    expect(src).toContain('cacheHistoryRealCost(h)')
    expect(src).not.toMatch(/apiTotal \+= m\.costUSD/)
    expect(src).not.toMatch(/reduce\(\(s, m\) => s \+ \(m\.costUSD/)
  })
})
