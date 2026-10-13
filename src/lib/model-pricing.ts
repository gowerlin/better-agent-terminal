// BUG-084 / T0374 — shared per-MTok model pricing for the Cache History cost view
// (previously duplicated inline in ClaudeAgentPanel.tsx and CodexAgentPanel.tsx).
//
// Exact model match only, no fallback: unknown IDs return null and the UI shows `—`.
// Ref: https://platform.claude.com/docs/en/about-claude/pricing

export interface ModelPricing {
  input: number
  output: number
  cacheRead: number
  cacheWrite5m: number
  cacheWrite1h: number
}

export function P(input: number, output: number, opts?: { cacheReadMultiplier?: number }): ModelPricing {
  const cacheReadMultiplier = opts?.cacheReadMultiplier ?? 0.1
  return { input, output, cacheRead: input * cacheReadMultiplier, cacheWrite5m: input * 1.25, cacheWrite1h: input * 2 }
}

export const MODEL_PRICING: Record<string, ModelPricing> = {
  // Claude 5 — T0368 §4 (pricing page, 2026-10-04). Opus 5.5 / Fable 5.1 cache read is 0.05x / 0.025x.
  // T0483 (pricing page, 2026-10-13): Sonnet 5.5 cache read is now 0.05x too (was 0.1x).
  'opus-5-5':  P(4, 20, { cacheReadMultiplier: 0.05 }),
  'fable-5-1': P(10, 50, { cacheReadMultiplier: 0.025 }),
  'sonnet-5-5': P(2, 10, { cacheReadMultiplier: 0.05 }),
  // Haiku 5.5 is priced by prompt length: a request whose prompt (all input tokens, cache reads
  // and writes included) is over 100,000 tokens pays the `-long` prices (T0483, pricing page).
  'haiku-5-5': P(0.10, 0.50), 'haiku-5-5-long': P(0.50, 2.50),
  'opus-5':    P(5, 25),    'opus-4-8':  P(5, 25),
  'sonnet-5':  P(2, 10),    'fable-5':   P(10, 50),
  'opus-4-7':  P(5, 25),    'opus-4-6':  P(5, 25),    'opus-4-5':  P(5, 25),
  'opus-4-1':  P(15, 75),   'opus-4':    P(15, 75),   'opus-3': P(15, 75),
  'sonnet-4-6': P(3, 15),   'sonnet-4-5': P(3, 15),   'sonnet-4': P(3, 15),
  'sonnet-3-7': P(3, 15),   'sonnet-3-5': P(3, 15),
  'haiku-4-5': P(1, 5),     'haiku-3-5': P(0.80, 4),  'haiku-3': P(0.25, 1.25),
}

export const HAIKU_5_5_LONG_PROMPT_THRESHOLD = 100_000

// `promptTokens` only matters for Haiku 5.5; without it the up-to-100K prices are returned.
export function getModelPricing(model: string, opts?: { promptTokens?: number }): ModelPricing | null {
  // `includes` is a prefix trap: the point releases must be checked before their base model.
  if (model.includes('haiku-5-5')) {
    const long = (opts?.promptTokens ?? 0) > HAIKU_5_5_LONG_PROMPT_THRESHOLD
    return MODEL_PRICING[long ? 'haiku-5-5-long' : 'haiku-5-5']
  }
  if (model.includes('opus-5-5')) return MODEL_PRICING['opus-5-5']
  if (model.includes('opus-5')) return MODEL_PRICING['opus-5']
  if (model.includes('opus-4-8')) return MODEL_PRICING['opus-4-8']
  if (model.includes('fable-5-1')) return MODEL_PRICING['fable-5-1']
  if (model.includes('fable-5')) return MODEL_PRICING['fable-5']
  if (model.includes('sonnet-5-5')) return MODEL_PRICING['sonnet-5-5']
  if (model.includes('sonnet-5')) return MODEL_PRICING['sonnet-5']
  if (model.includes('opus-4-7')) return MODEL_PRICING['opus-4-7']
  if (model.includes('opus-4-6')) return MODEL_PRICING['opus-4-6']
  if (model.includes('opus-4-5')) return MODEL_PRICING['opus-4-5']
  if (model.includes('opus-4-1')) return MODEL_PRICING['opus-4-1']
  if (model.includes('opus-4-0') || model.match(/opus-4(?!-)\b/) || model.match(/opus-4-2\d{7}/)) return MODEL_PRICING['opus-4']
  if (model.includes('opus-3') || model.includes('3-opus')) return MODEL_PRICING['opus-3']
  if (model.includes('sonnet-4-6')) return MODEL_PRICING['sonnet-4-6']
  if (model.includes('sonnet-4-5')) return MODEL_PRICING['sonnet-4-5']
  if (model.includes('sonnet-4-0') || model.match(/sonnet-4(?!-)\b/) || model.match(/sonnet-4-2\d{7}/)) return MODEL_PRICING['sonnet-4']
  if (model.includes('sonnet-3-7') || model.includes('3-7-sonnet')) return MODEL_PRICING['sonnet-3-7']
  if (model.includes('sonnet-3-5') || model.includes('3-5-sonnet')) return MODEL_PRICING['sonnet-3-5']
  if (model.includes('haiku-4') || model.includes('4-5-haiku')) return MODEL_PRICING['haiku-4-5']
  if (model.includes('haiku-3-5') || model.includes('3-5-haiku')) return MODEL_PRICING['haiku-3-5']
  if (model.includes('haiku-3') || model.includes('3-haiku')) return MODEL_PRICING['haiku-3']
  return null
}

// T0484 — Cache History cost math (moved out of ClaudeAgentPanel so the Haiku 5.5 prompt-length
// tiers can be tested). The arithmetic order is the panel's pre-T0484 one, so every model whose
// price does not depend on prompt length gets bit-identical results.

export interface TokenUsage {
  inputTokens: number           // uncached input
  outputTokens: number
  cacheReadInputTokens: number
  cacheCreationInputTokens: number
}

/**
 * Per-model usage summed over the API calls of one query. `longPrompt` is the part that came
 * from calls whose prompt was over HAIKU_5_5_LONG_PROMPT_THRESHOLD tokens (it is included in
 * the totals, not added to them); the main process fills it from per-call stream usage.
 */
export interface ModelUsageTokens extends TokenUsage {
  longPrompt?: TokenUsage
}

/** Aggregate 5m / 1h cache write split of the query; used to weight the cache write price. */
export interface CacheWriteSplit {
  cacheWrite5mTokens?: number
  cacheWrite1hTokens?: number
}

export interface UsageCost {
  readCost: number
  writeCost: number
  totalCost: number
}

function cacheWritePrice(p: ModelPricing, split?: CacheWriteSplit): number {
  let writePrice = p.cacheWrite5m
  if (split && split.cacheWrite5mTokens !== undefined && split.cacheWrite1hTokens !== undefined) {
    const total5m1h = split.cacheWrite5mTokens + split.cacheWrite1hTokens
    if (total5m1h > 0) writePrice = (split.cacheWrite5mTokens * p.cacheWrite5m + split.cacheWrite1hTokens * p.cacheWrite1h) / total5m1h
  }
  return writePrice
}

function costAt(p: ModelPricing, usage: TokenUsage, split?: CacheWriteSplit): UsageCost {
  const writePrice = cacheWritePrice(p, split)
  const readCost = (usage.cacheReadInputTokens / 1_000_000) * p.cacheRead
  const writeCost = (usage.cacheCreationInputTokens / 1_000_000) * writePrice
  const inputCost = (usage.inputTokens / 1_000_000) * p.input
  const outputCost = (usage.outputTokens / 1_000_000) * p.output
  return { readCost, writeCost, totalCost: readCost + writeCost + inputCost + outputCost }
}

/** A request's prompt length counts all of its input tokens, cache reads and writes included. */
export function promptTokensOf(usage: TokenUsage): number {
  return usage.inputTokens + usage.cacheReadInputTokens + usage.cacheCreationInputTokens
}

/** Cost of a single API call: the price tier is picked from that call's own prompt length. */
export function estimateCallCost(model: string, usage: TokenUsage, split?: CacheWriteSplit): UsageCost | null {
  const p = getModelPricing(model, { promptTokens: promptTokensOf(usage) })
  return p ? costAt(p, usage, split) : null
}

/**
 * Cost of a per-model total summed over several calls. Pricing is linear, so pricing the
 * `longPrompt` part at the long-prompt tier and the rest at the base tier equals pricing each
 * call by its own prompt length and adding the results up.
 */
export function estimateModelUsageCost(model: string, usage: ModelUsageTokens, split?: CacheWriteSplit): UsageCost | null {
  const base = getModelPricing(model)
  if (!base) return null
  const longTier = usage.longPrompt ? getModelPricing(model, { promptTokens: HAIKU_5_5_LONG_PROMPT_THRESHOLD + 1 }) : null
  if (!usage.longPrompt || !longTier || longTier === base) return costAt(base, usage, split)
  // Clamp: the per-call tracking can never legitimately exceed the SDK's own totals.
  const lp = usage.longPrompt
  const long: TokenUsage = {
    inputTokens: Math.min(lp.inputTokens, usage.inputTokens),
    outputTokens: Math.min(lp.outputTokens, usage.outputTokens),
    cacheReadInputTokens: Math.min(lp.cacheReadInputTokens, usage.cacheReadInputTokens),
    cacheCreationInputTokens: Math.min(lp.cacheCreationInputTokens, usage.cacheCreationInputTokens),
  }
  const short: TokenUsage = {
    inputTokens: usage.inputTokens - long.inputTokens,
    outputTokens: usage.outputTokens - long.outputTokens,
    cacheReadInputTokens: usage.cacheReadInputTokens - long.cacheReadInputTokens,
    cacheCreationInputTokens: usage.cacheCreationInputTokens - long.cacheCreationInputTokens,
  }
  const a = costAt(base, short, split)
  const b = costAt(longTier, long, split)
  return { readCost: a.readCost + b.readCost, writeCost: a.writeCost + b.writeCost, totalCost: a.totalCost + b.totalCost }
}
