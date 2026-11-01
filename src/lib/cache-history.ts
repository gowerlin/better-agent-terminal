// T0498 — Claude panel Cache History rows and total, moved out of ClaudeAgentPanel so the row
// semantics and the grand total can be tested against real `claude:status` sequences.
import { estimateCallCost, estimateModelUsageCost, type CacheWriteSplit, type ModelUsageTokens, type TokenUsage } from './model-pricing'

/** The main agent's latest API call, as `claude-agent-manager` sends it in `claude:status` (T0498). */
export interface LastCallUsage extends TokenUsage {
  id: string
  model: string
  /** distinct per query; the result row of a query covers the per-call rows with its number */
  query: number
}

/** The `claude:status` fields the Cache History reads. */
export interface CacheHistoryStatus extends CacheWriteSplit {
  model?: string
  totalCost?: number
  inputTokens: number
  outputTokens?: number
  contextTokens?: number
  cacheReadTokens?: number
  cacheCreationTokens?: number
  callCacheRead?: number
  callCacheWrite?: number
  lastQueryCalls?: number
  /** the CLI's running totals since the session began (T0744 / BUG-181), not this turn's */
  modelUsage?: Record<string, ModelUsageTokens & { costUSD: number }>
  /** null: a T0498+ server with no call in flight; absent: a pre-T0498 server */
  lastCall?: LastCallUsage | null
}

export interface CacheHistoryEntry extends CacheWriteSplit {
  pct: number
  cacheRead: number
  cacheCreate: number
  totalInput: number
  contextSize: number
  callCacheRead: number
  callCacheWrite: number
  calls: number
  isResult?: boolean
  modelUsage?: CacheHistoryStatus['modelUsage']
  model?: string
  outputTokens?: number
  timestamp?: number
  messageCount?: number
  turnStartMsgId?: string | null
  apiTotalCost?: number
  /** per-call rows from `lastCall` only (absent on result rows and on rows from a pre-T0498 server) */
  callId?: string
  query?: number
  /**
   * Result rows (T0744 / BUG-181): the CLI's running totals as received (`modelUsage` is the turn's
   * share of them, see `turnModelUsage`), and how that share was taken.
   */
  cumulativeModelUsage?: ModelUsageMap
  usageBasis?: TurnUsageBasis
}

/** Per-model token / cost map as `claude:status` carries it (`modelUsage`). */
export type ModelUsageMap = Record<string, ModelUsageTokens & { costUSD: number }>

/**
 * How a result row's numbers relate to the CLI's running totals (T0744 / BUG-181):
 * - `turn`: this result's totals minus the previous result's — the turn's own usage.
 * - `includes-prior`: no earlier result to subtract (a resumed or forked session, or a panel
 *   remounted mid-session): the row is the session's running total so far, earlier turns included.
 * - `reset`: some total went down (the CLI restarted its running total, e.g. a zeroed crash result
 *   or a `/clear`): the row is the new running total as received.
 */
export type TurnUsageBasis = 'turn' | 'includes-prior' | 'reset'

/**
 * The running totals the next result is subtracted from (T0744 / BUG-181). `modelUsage: null` is
 * unknown: the next result's row is `includes-prior`. The panel keeps one per session; Clear keeps
 * it (the rows go, the session's totals do not).
 */
export interface CacheHistoryUsageBaseline {
  modelUsage: ModelUsageMap | null
}

/** A new session: its running totals start at 0. */
export const freshUsageBaseline = (): CacheHistoryUsageBaseline => ({ modelUsage: {} })
/** A resumed / forked session (or one whose earlier results this panel did not see). */
export const unknownUsageBaseline = (): CacheHistoryUsageBaseline => ({ modelUsage: null })

const USAGE_TOKEN_FIELDS = ['inputTokens', 'outputTokens', 'cacheReadInputTokens', 'cacheCreationInputTokens'] as const
/** Float slack for `costUSD` (the CLI adds doubles); token counts are integers and compared exactly. */
const COST_EPSILON = 1e-9

function cloneModelUsage(mu: ModelUsageMap): ModelUsageMap {
  const out: ModelUsageMap = {}
  for (const [model, stats] of Object.entries(mu)) out[model] = { ...stats, ...(stats.longPrompt ? { longPrompt: { ...stats.longPrompt } } : {}) }
  return out
}

function sameModelUsage(a: ModelUsageMap, b: ModelUsageMap): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  for (const k of keys) {
    const x = a[k]
    const y = b[k]
    if (!x || !y) return false
    for (const f of USAGE_TOKEN_FIELDS) if ((x[f] || 0) !== (y[f] || 0)) return false
    if (Math.abs((x.costUSD || 0) - (y.costUSD || 0)) > COST_EPSILON) return false
  }
  return true
}

/**
 * T0744 / BUG-181 — the only place that turns the CLI's session-wide running totals into one
 * turn's usage. The CLI (2.1.316; SDK 0.3.316 `SDKResultSuccess.modelUsage` / `total_cost_usd`)
 * reports every model's totals since the session began — a resumed or forked session continues
 * from its transcript's totals, a `/clear` restarts them, a crash result may be zeroed.
 *
 * Per model: `current - previous` (a model new to the session starts from 0). Any field below the
 * previous value, or a model that disappeared -> the totals were reset: the row is `current` as
 * received (`reset`). `previous: null` (unknown) -> `current` as received (`includes-prior`).
 * Models with nothing new this turn are left out (unless that leaves none). `longPrompt` is the
 * current query's own tracker (not a running total) and is kept as is.
 */
export function turnModelUsage(current: ModelUsageMap, previous: ModelUsageMap | null): { modelUsage: ModelUsageMap; basis: TurnUsageBasis } {
  if (!previous) return { modelUsage: cloneModelUsage(current), basis: 'includes-prior' }
  let reset = false
  for (const [model, prev] of Object.entries(previous)) {
    const cur = current[model]
    const prevHasUsage = USAGE_TOKEN_FIELDS.some(f => (prev[f] || 0) > 0) || (prev.costUSD || 0) > COST_EPSILON
    if (!cur) { if (prevHasUsage) reset = true; continue }
    if (USAGE_TOKEN_FIELDS.some(f => (cur[f] || 0) < (prev[f] || 0))) reset = true
    if ((cur.costUSD || 0) < (prev.costUSD || 0) - COST_EPSILON) reset = true
  }
  if (reset) return { modelUsage: cloneModelUsage(current), basis: 'reset' }
  const all: ModelUsageMap = {}
  const used: ModelUsageMap = {}
  for (const [model, cur] of Object.entries(current)) {
    const prev = previous[model]
    const d: ModelUsageMap[string] = {
      inputTokens: (cur.inputTokens || 0) - (prev?.inputTokens || 0),
      outputTokens: (cur.outputTokens || 0) - (prev?.outputTokens || 0),
      cacheReadInputTokens: (cur.cacheReadInputTokens || 0) - (prev?.cacheReadInputTokens || 0),
      cacheCreationInputTokens: (cur.cacheCreationInputTokens || 0) - (prev?.cacheCreationInputTokens || 0),
      costUSD: Math.max(0, (cur.costUSD || 0) - (prev?.costUSD || 0)),
    }
    if (cur.longPrompt) d.longPrompt = { ...cur.longPrompt }
    all[model] = d
    if (USAGE_TOKEN_FIELDS.some(f => d[f] > 0) || d.costUSD > COST_EPSILON) used[model] = d
  }
  return { modelUsage: Object.keys(used).length > 0 ? used : all, basis: 'turn' }
}

/** Running totals of the last R row in `hist` (rows from before T0744 carry them as `modelUsage`). */
function lastResultTotals(hist: CacheHistoryEntry[]): ModelUsageMap {
  for (let i = hist.length - 1; i >= 0; i--) {
    const h = hist[i]
    if (h.isResult) return h.cumulativeModelUsage ?? h.modelUsage ?? {}
  }
  return {}
}

export interface CacheHistoryContext {
  timestamp: number
  messageCount: number
  turnStartMsgId: string | null
}

export const MAX_CACHE_HISTORY_CALL_ROWS = 20

/**
 * Records one `claude:status` in the history. Returns what happened, so the caller can track
 * the last result (cache expiry warning).
 *
 * - Result status (`modelUsage` set, no `lastCall`): one R row — the whole turn, every model
 *   and sub-agent included. `modelUsage` is the session's running total, so the row holds this
 *   result minus `baseline` (`turnModelUsage`, T0744 / BUG-181) and `baseline` moves on to this
 *   result. Without `baseline` the previous R row of `hist` is used (none: 0). A result whose
 *   totals equal the baseline (the same result re-sent, e.g. by setModel) adds no row.
 * - Streaming status with `lastCall`: one row per main-agent API call, with that call's own
 *   tokens; later statuses of the same call (`message_delta`) update the row in place.
 * - `lastCall: null` and no `modelUsage` (query start, model change): no row. The session-wide
 *   `inputTokens` / `cacheReadTokens` still hold the last result's totals at that point.
 * - Status without `lastCall` (a pre-T0498 server): the old row, taken from the session-wide
 *   `inputTokens` / `cacheReadTokens`, which keep the largest call — or the last result's
 *   totals — rather than the current call.
 */
export function applyStatusToCacheHistory(
  hist: CacheHistoryEntry[],
  m: CacheHistoryStatus,
  ctx: CacheHistoryContext,
  baseline?: CacheHistoryUsageBaseline,
): 'result' | 'call' | 'updated' | null {
  const call = m.lastCall
  let kind: 'result' | 'call' | 'updated' | null = null
  if (call) {
    const prompt = call.inputTokens + call.cacheReadInputTokens + call.cacheCreationInputTokens
    if (prompt <= 0) return null
    const entry: CacheHistoryEntry = {
      pct: Math.round((call.cacheReadInputTokens / prompt) * 100),
      cacheRead: call.cacheReadInputTokens,
      cacheCreate: call.cacheCreationInputTokens,
      totalInput: prompt,
      contextSize: m.contextTokens || 0,
      callCacheRead: call.cacheReadInputTokens,
      callCacheWrite: call.cacheCreationInputTokens,
      calls: 1,
      isResult: false,
      model: call.model || m.model,
      outputTokens: call.outputTokens,
      cacheWrite5mTokens: m.cacheWrite5mTokens,
      cacheWrite1hTokens: m.cacheWrite1hTokens,
      timestamp: ctx.timestamp,
      messageCount: ctx.messageCount,
      turnStartMsgId: ctx.turnStartMsgId,
      apiTotalCost: m.totalCost || 0,
      callId: call.id,
      query: call.query,
    }
    const last = hist[hist.length - 1]
    if (last && !last.isResult && last.callId === call.id && last.query === call.query) {
      Object.assign(last, entry, { timestamp: last.timestamp })
      return 'updated'
    }
    hist.push(entry)
    kind = 'call'
  } else if (m.inputTokens > 0 && m.cacheReadTokens !== undefined) {
    const lastEntry = hist[hist.length - 1]
    const hasModelUsage = m.modelUsage && Object.keys(m.modelUsage).length > 0
    const isResult = !!hasModelUsage
    if (!isResult && m.lastCall === null) return null
    if (isResult) {
      const previous = baseline ? baseline.modelUsage : lastResultTotals(hist)
      if (previous && sameModelUsage(previous, m.modelUsage!)) return null
      const turn = turnModelUsage(m.modelUsage!, previous)
      let cacheRead = 0, cacheCreate = 0, totalInput = 0, outputTokens = 0
      for (const u of Object.values(turn.modelUsage)) {
        cacheRead += u.cacheReadInputTokens
        cacheCreate += u.cacheCreationInputTokens
        totalInput += u.inputTokens + u.cacheReadInputTokens + u.cacheCreationInputTokens
        outputTokens += u.outputTokens
      }
      const pct = totalInput > 0 ? Math.round((cacheRead / totalInput) * 100) : 0
      hist.push({ pct, cacheRead, cacheCreate, totalInput, contextSize: m.contextTokens || 0, callCacheRead: m.callCacheRead || 0, callCacheWrite: m.callCacheWrite || 0, calls: m.lastQueryCalls || 0, isResult: true, modelUsage: turn.modelUsage, model: m.model, outputTokens, cacheWrite5mTokens: m.cacheWrite5mTokens, cacheWrite1hTokens: m.cacheWrite1hTokens, timestamp: ctx.timestamp, messageCount: ctx.messageCount, turnStartMsgId: ctx.turnStartMsgId, apiTotalCost: m.totalCost || 0, cumulativeModelUsage: cloneModelUsage(m.modelUsage!), usageBasis: turn.basis })
      if (baseline) baseline.modelUsage = cloneModelUsage(m.modelUsage!)
      kind = 'result'
    } else if (!lastEntry || lastEntry.cacheRead !== m.cacheReadTokens || lastEntry.totalInput !== m.inputTokens || (isResult !== lastEntry.isResult)) {
      const pct = Math.round((m.cacheReadTokens / m.inputTokens) * 100)
      hist.push({ pct, cacheRead: m.cacheReadTokens, cacheCreate: m.cacheCreationTokens || 0, totalInput: m.inputTokens, contextSize: m.contextTokens || 0, callCacheRead: m.callCacheRead || 0, callCacheWrite: m.callCacheWrite || 0, calls: isResult ? (m.lastQueryCalls || 0) : 1, isResult, modelUsage: m.modelUsage ? { ...m.modelUsage } : undefined, model: m.model, outputTokens: m.outputTokens || 0, cacheWrite5mTokens: m.cacheWrite5mTokens, cacheWrite1hTokens: m.cacheWrite1hTokens, timestamp: ctx.timestamp, messageCount: ctx.messageCount, turnStartMsgId: ctx.turnStartMsgId, apiTotalCost: m.totalCost || 0 })
      kind = isResult ? 'result' : 'call'
    }
  }
  // Trim: keep max 20 non-result entries; result entries are extra
  while (hist.filter(h => !h.isResult).length > MAX_CACHE_HISTORY_CALL_ROWS) {
    const idx = hist.findIndex(h => !h.isResult)
    if (idx >= 0) hist.splice(idx, 1); else break
  }
  return kind
}

export interface CacheHistoryModelCost {
  model: string
  cacheRead: number
  cacheWrite: number
  input: number
  output: number
  readCost: number | null
  writeCost: number | null
  totalCost: number | null
}

/** Per-model cost lines of one row (one line for a per-call row); null when the row has no model. */
export function cacheHistoryRowCosts(h: CacheHistoryEntry): CacheHistoryModelCost[] | null {
  const hasModelUsage = h.modelUsage && Object.keys(h.modelUsage).length > 0
  if (hasModelUsage) {
    const models: CacheHistoryModelCost[] = []
    for (const [model, stats] of Object.entries(h.modelUsage!)) {
      const totalIn = stats.inputTokens + stats.cacheReadInputTokens + stats.cacheCreationInputTokens
      // T0484: summed over the turn's calls; the `longPrompt` part is priced at the long-prompt tier
      const cost = estimateModelUsageCost(model, stats, h)
      models.push({ model, cacheRead: stats.cacheReadInputTokens, cacheWrite: stats.cacheCreationInputTokens, input: totalIn, output: stats.outputTokens, readCost: cost?.readCost ?? null, writeCost: cost?.writeCost ?? null, totalCost: cost?.totalCost ?? null })
    }
    return models
  }
  if (h.model) {
    const output = h.outputTokens || 0
    const uncachedInput = Math.max(0, h.totalInput - h.cacheRead - h.cacheCreate)
    // T0484: a single call — its own prompt length (input + cache read + cache write) picks the tier
    const cost = estimateCallCost(h.model, { inputTokens: uncachedInput, outputTokens: output, cacheReadInputTokens: h.cacheRead, cacheCreationInputTokens: h.cacheCreate }, h)
    return [{ model: h.model, cacheRead: h.cacheRead, cacheWrite: h.cacheCreate, input: h.totalInput, output, readCost: cost?.readCost ?? null, writeCost: cost?.writeCost ?? null, totalCost: cost?.totalCost ?? null }]
  }
  return null
}

/**
 * Rows the grand total adds up. A result row is the whole query (summed by the SDK over every
 * call, sub-agents included), so the per-call rows of that query are already in it and are left
 * out. The per-call rows before a result belong to the query of the last of them; rows of an
 * earlier query (one that ended without a result, e.g. aborted) stay in. Pre-T0498 rows carry
 * no query, so a result covers all of them. Rows after the last result (query still running)
 * stay in.
 */
export function cacheHistoryTotalRows(hist: CacheHistoryEntry[]): boolean[] {
  const counted = hist.map(() => true)
  let segmentStart = 0
  for (let i = 0; i < hist.length; i++) {
    if (!hist[i].isResult) continue
    const covered = i > segmentStart ? hist[i - 1].query : undefined
    for (let j = segmentStart; j < i; j++) {
      if (covered === undefined || hist[j].query === undefined || hist[j].query === covered) counted[j] = false
    }
    segmentStart = i + 1
  }
  return counted
}

/** A result row's real $ (sum of its models' `costUSD`, the turn's share since T0744); null on other rows. */
export function cacheHistoryRealCost(h: CacheHistoryEntry): number | null {
  if (!h.isResult || !h.modelUsage) return null
  return Object.values(h.modelUsage).reduce((s, m) => s + (m.costUSD || 0), 0)
}

/**
 * Real $ total (T0744 / BUG-181): the R rows' `costUSD` added up. Each row is its turn's share of the
 * running total, so this equals the last result's running total when the history starts at a new
 * session (or at an `includes-prior` row) and no reset happened.
 */
export function cacheHistoryApiTotal(hist: CacheHistoryEntry[]): { total: number; hasApiCost: boolean } {
  let total = 0
  let hasApiCost = false
  for (const h of hist) {
    if (!h.isResult || !h.modelUsage) continue
    for (const m of Object.values(h.modelUsage)) { if (m.costUSD) { total += m.costUSD; hasApiCost = true } }
  }
  return { total, hasApiCost }
}

export function cacheHistoryGrandTotal(hist: CacheHistoryEntry[]): { total: number; hasAnyCost: boolean } {
  const counted = cacheHistoryTotalRows(hist)
  let total = 0
  let hasAnyCost = false
  for (let i = 0; i < hist.length; i++) {
    if (!counted[i]) continue
    const models = cacheHistoryRowCosts(hist[i])
    if (models) { for (const m of models) { if (m.totalCost !== null) { total += m.totalCost; hasAnyCost = true } } }
  }
  return { total, hasAnyCost }
}
