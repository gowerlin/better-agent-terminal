// @vitest-environment node
/**
 * T0498 — Cache History fed by real `ClaudeAgentManager.processMessage` status sequences:
 * - `claude:status` carries `lastCall` (the main agent's current API call) during a query and
 *   `lastCall: null` at query start / on the result.
 * - A: the pre-T0498 grand total added per-call rows that the result (R) row of the same query
 *   already contains, plus a stale row holding the previous result's totals; on V2 the previous
 *   result's `modelUsage` rode along on the next query's statuses and was added again as R rows.
 *   The pre-T0498 renderer logic is copied verbatim below to show the before / after numbers.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => new Proxy({}, {
  get(_target, prop) {
    throw new Error(`claude-agent-manager must not touch electron: electron.${String(prop)}`)
  },
}))

import { ClaudeAgentManager, createQueryCallTracker, mainAgentCall, trackStreamEventUsage } from '../claude-agent-manager'
import { applyStatusToCacheHistory, cacheHistoryGrandTotal, cacheHistoryRowCosts, type CacheHistoryEntry, type CacheHistoryStatus } from '../../src/lib/cache-history'
import { estimateCallCost } from '../../src/lib/model-pricing'

type Internals = {
  processMessage(sessionId: string, session: unknown, message: unknown): void
  resetQueryUsage(session: unknown): void
}

const managers: ClaudeAgentManager[] = []
afterEach(() => {
  for (const m of managers.splice(0)) { m.killAll(); m.dispose() }
})

const MODEL = 'claude-opus-5-5'
type Call = { id: string; input: number; read: number; write: number; output: number; sub?: string }

function harness() {
  const emit = vi.fn()
  const manager = new ClaudeAgentManager({ emit, getSettings: () => ({ notifyOnComplete: false }) })
  managers.push(manager)
  const session = {
    cwd: process.cwd(),
    state: { isStreaming: true, totalCost: 0, totalTokens: 0 },
    metadata: { totalCost: 0, inputTokens: 0, outputTokens: 0, durationMs: 0, numTurns: 0, contextWindow: 0, maxOutputTokens: 0, contextTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0, callCacheRead: 0, callCacheWrite: 0, lastQueryCalls: 0, lastCall: null } as Record<string, unknown>,
    activeTasks: new Map(),
    pendingPermissions: new Map(),
    pendingAskUser: new Map(),
    messageQueue: [],
  } as Record<string, unknown> & { callUsage?: unknown; metadata: Record<string, unknown> }
  const internals = manager as unknown as Internals
  const pm = (msg: unknown) => internals.processMessage('s1', session, msg)
  /** One query. `startReset`: 'v1' / 'v2-fixed' (resetQueryUsage), 'v2-old' (pre-T0498 V2: tracker only). */
  const query = (calls: Call[], startReset: 'v1' | 'v2-fixed' | 'v2-old' = 'v1') => {
    if (startReset === 'v2-old') session.callUsage = createQueryCallTracker()
    else internals.resetQueryUsage(session)
    pm({ type: 'system', subtype: 'init', session_id: 'sdk-1', model: MODEL, cwd: process.cwd(), permissionMode: 'default' })
    for (const c of calls) {
      const usage = { input_tokens: c.input, cache_read_input_tokens: c.read, cache_creation_input_tokens: c.write }
      if (c.sub) {
        // sub-agent call seen only as an assistant message (no forwarded stream events)
        pm({ type: 'assistant', parent_tool_use_id: c.sub, message: { id: c.id, model: MODEL, role: 'assistant', content: [], usage: { ...usage, output_tokens: c.output } } })
        continue
      }
      pm({ type: 'stream_event', parent_tool_use_id: null, event: { type: 'message_start', message: { id: c.id, model: MODEL, usage: { ...usage, output_tokens: 1 } } } })
      pm({ type: 'stream_event', parent_tool_use_id: null, event: { type: 'message_delta', usage: { output_tokens: c.output } } })
    }
    const sum = (k: keyof Call) => calls.reduce((s, c) => s + (c[k] as number), 0)
    pm({
      type: 'result', subtype: 'success', total_cost_usd: 0, num_turns: calls.length, duration_ms: 1,
      usage: { input_tokens: sum('input'), output_tokens: sum('output') },
      modelUsage: { [MODEL]: { inputTokens: sum('input'), outputTokens: sum('output'), cacheReadInputTokens: sum('read'), cacheCreationInputTokens: sum('write'), costUSD: 0.01 } },
    })
  }
  const statuses = () => emit.mock.calls.filter(c => c[0] === 'claude:status').map(c => c[2] as CacheHistoryStatus)
  return { session, query, statuses, internals }
}

const callCost = (c: Call) => estimateCallCost(MODEL, { inputTokens: c.input, cacheReadInputTokens: c.read, cacheCreationInputTokens: c.write, outputTokens: c.output })!.totalCost
const ctx = { timestamp: 1, messageCount: 0, turnStartMsgId: null }

// ---- pre-T0498 ClaudeAgentPanel logic, verbatim (row push + grand total loop) ----
function legacyRows(seq: CacheHistoryStatus[]): CacheHistoryEntry[] {
  const hist: CacheHistoryEntry[] = []
  for (const m of seq) {
    if (m.inputTokens > 0 && m.cacheReadTokens !== undefined) {
      const lastEntry = hist[hist.length - 1]
      const hasModelUsage = m.modelUsage && Object.keys(m.modelUsage).length > 0
      const isResult = !!hasModelUsage
      if (!lastEntry || lastEntry.cacheRead !== m.cacheReadTokens || lastEntry.totalInput !== m.inputTokens || (isResult !== lastEntry.isResult)) {
        const pct = Math.round((m.cacheReadTokens / m.inputTokens) * 100)
        hist.push({ pct, cacheRead: m.cacheReadTokens, cacheCreate: m.cacheCreationTokens || 0, totalInput: m.inputTokens, contextSize: m.contextTokens || 0, callCacheRead: m.callCacheRead || 0, callCacheWrite: m.callCacheWrite || 0, calls: isResult ? (m.lastQueryCalls || 0) : 1, isResult, modelUsage: m.modelUsage ? { ...m.modelUsage } : undefined, model: m.model, outputTokens: m.outputTokens || 0, cacheWrite5mTokens: m.cacheWrite5mTokens, cacheWrite1hTokens: m.cacheWrite1hTokens })
        while (hist.filter(h => !h.isResult).length > 20) {
          const idx = hist.findIndex(h => !h.isResult)
          if (idx >= 0) hist.splice(idx, 1); else break
        }
      }
    }
  }
  return hist
}
function legacyGrandTotal(hist: CacheHistoryEntry[]): number {
  let grandTotal = 0
  for (let i = 0; i < hist.length; i++) {
    if (!hist[i].isResult && i + 1 < hist.length && hist[i + 1].isResult) continue
    const models = cacheHistoryRowCosts(hist[i])
    if (models) { for (const m of models) { if (m.totalCost !== null) { grandTotal += m.totalCost } } }
  }
  return grandTotal
}
function legacyApiTotal(hist: CacheHistoryEntry[]): number {
  let apiTotal = 0
  for (const h of hist) if (h.isResult && h.modelUsage) for (const m of Object.values(h.modelUsage)) apiTotal += m.costUSD || 0
  return apiTotal
}
/** What a pre-T0498 server sent: the same statuses without the `lastCall` field. */
const withoutLastCall = (seq: CacheHistoryStatus[]) => seq.map(({ lastCall: _drop, ...rest }) => rest as CacheHistoryStatus)
const newRows = (seq: CacheHistoryStatus[]) => {
  const hist: CacheHistoryEntry[] = []
  for (const m of seq) applyStatusToCacheHistory(hist, m, ctx)
  return hist
}

// Scenario 1: three main-agent calls + one sub-agent call, then a two-call query.
const Q1: Call[] = [
  { id: 'msg_1', input: 2_000, read: 0, write: 20_000, output: 500 },
  { id: 'msg_2', input: 1_000, read: 20_000, write: 5_000, output: 800 },
  { id: 'msg_s', input: 3_000, read: 0, write: 10_000, output: 300, sub: 'toolu_agent' },
  { id: 'msg_3', input: 1_000, read: 25_000, write: 5_000, output: 1_200 },
]
const Q2: Call[] = [
  { id: 'msg_4', input: 2_000, read: 30_000, write: 0, output: 300 },
  { id: 'msg_5', input: 2_000, read: 32_000, write: 0, output: 400 },
]
// Scenario 2: one-call query, then a query whose calls are larger than the first query's total.
const Q3: Call[] = [{ id: 'msg_6', input: 1_000, read: 90_000, write: 9_000, output: 200 }]
const Q4: Call[] = [
  { id: 'msg_7', input: 1_000, read: 99_000, write: 5_000, output: 300 },
  { id: 'msg_8', input: 1_000, read: 104_000, write: 5_000, output: 400 },
]

describe('claude:status lastCall', () => {
  it('carries the main agent\'s current call during a query and null at init / result', () => {
    const h = harness()
    h.query(Q1)
    const seq = h.statuses()
    expect(seq[0].lastCall).toBeNull() // system init
    const calls = seq.filter(s => s.lastCall).map(s => s.lastCall!)
    expect(calls.map(c => [c.id, c.outputTokens])).toEqual([['msg_1', 1], ['msg_1', 500], ['msg_2', 1], ['msg_2', 800], ['msg_3', 1], ['msg_3', 1_200]])
    expect(calls[1]).toMatchObject({ model: MODEL, inputTokens: 2_000, cacheReadInputTokens: 0, cacheCreationInputTokens: 20_000 })
    expect(new Set(calls.map(c => c.query)).size).toBe(1)
    expect(seq[seq.length - 1].lastCall).toBeNull() // result
    expect(seq[seq.length - 1].modelUsage).toBeDefined()
    h.query(Q2)
    const q2 = h.statuses().slice(seq.length).filter(s => s.lastCall).map(s => s.lastCall!)
    expect(q2[0].query).not.toBe(calls[0].query)
  })

  it('mainAgentCall ignores sub-agent streams', () => {
    const t = createQueryCallTracker()
    expect(mainAgentCall(t)).toBeUndefined()
    trackStreamEventUsage(t, 'toolu_x', { type: 'message_start', message: { id: 'sub', model: MODEL, usage: { input_tokens: 9 } } })
    expect(mainAgentCall(t)).toBeUndefined()
    trackStreamEventUsage(t, '', { type: 'message_start', message: { id: 'main', model: MODEL, usage: { input_tokens: 5 } } })
    expect(mainAgentCall(t)).toMatchObject({ id: 'main', query: t.seq, inputTokens: 5 })
  })

  it('resetQueryUsage clears the previous result for V1 and V2 (runQueryV2 calls it)', () => {
    const h = harness()
    h.query(Q3)
    expect(h.session.metadata.modelUsage).toBeDefined()
    h.internals.resetQueryUsage(h.session)
    expect(h.session.metadata.modelUsage).toBeUndefined()
    expect(h.session.metadata.lastCall).toBeNull()
    expect(h.session.metadata.cacheWrite5mTokens).toBeUndefined()
    const src = readFileSync(join(__dirname, '..', 'claude-agent-manager.ts'), 'utf8')
    const v2 = src.slice(src.indexOf('private async runQueryV2('), src.indexOf('v2Session.stream()'))
    expect(v2).toContain('this.resetQueryUsage(session)')
    const v1 = src.slice(src.indexOf('private async runQuery('), src.indexOf('const generator = query('))
    expect(v1).toContain('this.resetQueryUsage(session)')
  })
})

describe('T0498 A — grand total before / after (processMessage replay)', () => {
  it('scenario 1 (V1): per-call rows covered by the result were added again', () => {
    const h = harness()
    h.query(Q1)
    h.query(Q2)
    const truth = [...Q1, ...Q2].reduce((s, c) => s + callCost(c), 0)
    expect(truth).toBeCloseTo(0.3354, 10)

    const before = legacyGrandTotal(legacyRows(withoutLastCall(h.statuses())))
    // rows 1 and 2 of query 1 (msg_1 priced with output 1, msg_2 with msg_1's output) on top of R1
    expect(before).toBeCloseTo(0.3354 + 0.10802 + 0.043, 10)

    const rows = newRows(h.statuses())
    expect(rows.map(r => r.isResult ? 'R' : r.callId)).toEqual(['msg_1', 'msg_2', 'msg_3', 'R', 'msg_4', 'msg_5', 'R'])
    expect(cacheHistoryGrandTotal(rows).total).toBeCloseTo(truth, 10)
    // each per-call row shows and prices that call (main agent only; the sub-agent call is in R)
    for (const r of rows.filter(x => !x.isResult)) {
      const c = [...Q1, ...Q2].find(x => x.id === r.callId)!
      expect([r.totalInput, r.cacheRead, r.cacheCreate, r.outputTokens]).toEqual([c.input + c.read + c.write, c.read, c.write, c.output])
      expect(cacheHistoryRowCosts(r)![0].totalCost).toBeCloseTo(callCost(c), 12)
    }
  })

  it('scenario 2 (V1): the next query\'s first row carried the previous result\'s totals', () => {
    const h = harness()
    h.query(Q3)
    h.query(Q4)
    const truth = [...Q3, ...Q4].reduce((s, c) => s + callCost(c), 0)
    expect(truth).toBeCloseTo(0.1836, 10)

    const legacy = legacyRows(withoutLastCall(h.statuses()))
    expect(legacy.map(r => r.isResult ? 'R' : r.totalInput)).toEqual([100_000, 'R', 100_000, 105_000, 110_000, 'R'])
    // the stale 100,000 row (= query 1 again) and msg_7 priced with query 1's output
    expect(legacyGrandTotal(legacy)).toBeCloseTo(0.1836 + 0.071 + 0.0528, 10)

    expect(cacheHistoryGrandTotal(newRows(h.statuses())).total).toBeCloseTo(truth, 10)
  })

  it('scenario 2 (V2): the previous result rode along as extra R rows (est. and real $ both inflated)', () => {
    const old = harness()
    old.query(Q3, 'v2-old')
    old.query(Q4, 'v2-old')
    const legacy = legacyRows(withoutLastCall(old.statuses()))
    expect(legacy.map(r => r.isResult ? `R${r.totalInput}` : r.totalInput)).toEqual([100_000, 'R100000', 'R105000', 'R110000', 'R215000'])
    // query 1's modelUsage counted three times
    expect(legacyGrandTotal(legacy)).toBeCloseTo(0.1836 + 2 * 0.071, 10)
    expect(legacyApiTotal(legacy)).toBeCloseTo(0.04, 10) // 4 × costUSD 0.01 for 2 queries

    const fixed = harness()
    fixed.query(Q3, 'v2-fixed')
    fixed.query(Q4, 'v2-fixed')
    const rows = newRows(fixed.statuses())
    expect(rows.map(r => r.isResult ? 'R' : r.callId)).toEqual(['msg_6', 'R', 'msg_7', 'msg_8', 'R'])
    expect(cacheHistoryGrandTotal(rows).total).toBeCloseTo(0.1836, 10)
    expect(legacyApiTotal(rows)).toBeCloseTo(0.02, 10)
  })
})
