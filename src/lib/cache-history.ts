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
 *   and sub-agent included.
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
    if (!lastEntry || lastEntry.cacheRead !== m.cacheReadTokens || lastEntry.totalInput !== m.inputTokens || (isResult !== lastEntry.isResult)) {
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
