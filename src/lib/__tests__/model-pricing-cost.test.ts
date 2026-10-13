// T0484 — Cache History cost math (estimateCallCost / estimateModelUsageCost).
//
// The "unchanged" blocks pin every model whose price does not depend on prompt length to the
// pre-T0484 ClaudeAgentPanel formula (copied verbatim below) with exact equality.

import { describe, it, expect } from 'vitest'
import {
  getModelPricing,
  estimateCallCost,
  estimateModelUsageCost,
  promptTokensOf,
  MODEL_PRICING,
  type CacheWriteSplit,
  type TokenUsage,
} from '../model-pricing'

// Pre-T0484 ClaudeAgentPanel `calcModelCosts`, modelUsage branch (per-model, price picked
// without a prompt length).
function legacyModelUsageCost(model: string, stats: TokenUsage, h: CacheWriteSplit) {
  const p = getModelPricing(model)
  if (!p) return null
  let writePrice = p.cacheWrite5m
  if (h.cacheWrite5mTokens !== undefined && h.cacheWrite1hTokens !== undefined) {
    const total5m1h = h.cacheWrite5mTokens + h.cacheWrite1hTokens
    if (total5m1h > 0) writePrice = (h.cacheWrite5mTokens * p.cacheWrite5m + h.cacheWrite1hTokens * p.cacheWrite1h) / total5m1h
  }
  const readCost = (stats.cacheReadInputTokens / 1_000_000) * p.cacheRead
  const writeCost = (stats.cacheCreationInputTokens / 1_000_000) * writePrice
  const inputCost = (stats.inputTokens / 1_000_000) * p.input
  const outputCost = (stats.outputTokens / 1_000_000) * p.output
  return { readCost, writeCost, totalCost: readCost + writeCost + inputCost + outputCost }
}

// Pre-T0484 ClaudeAgentPanel `calcModelCosts`, single-call row branch.
function legacyCallRowCost(model: string, h: { cacheRead: number; cacheCreate: number; totalInput: number; outputTokens: number } & CacheWriteSplit) {
  const p = getModelPricing(model)
  if (!p) return null
  const output = h.outputTokens || 0
  let writePrice = p.cacheWrite5m
  if (h.cacheWrite5mTokens !== undefined && h.cacheWrite1hTokens !== undefined) {
    const total5m1h = h.cacheWrite5mTokens + h.cacheWrite1hTokens
    if (total5m1h > 0) writePrice = (h.cacheWrite5mTokens * p.cacheWrite5m + h.cacheWrite1hTokens * p.cacheWrite1h) / total5m1h
  }
  const readCost = (h.cacheRead / 1_000_000) * p.cacheRead
  const writeCost = (h.cacheCreate / 1_000_000) * writePrice
  const uncachedInput = Math.max(0, h.totalInput - h.cacheRead - h.cacheCreate)
  const inputCost = (uncachedInput / 1_000_000) * p.input
  const outputCost = (output / 1_000_000) * p.output
  return { readCost, writeCost, totalCost: readCost + writeCost + inputCost + outputCost }
}

const u = (inputTokens: number, outputTokens: number, cacheReadInputTokens: number, cacheCreationInputTokens: number): TokenUsage =>
  ({ inputTokens, outputTokens, cacheReadInputTokens, cacheCreationInputTokens })

// Haiku 5.5 per-MTok prices (pricing page, T0483): ≤100K 0.10 / 0.50, >100K 0.50 / 2.50;
// cache read 0.1x, cache write 1.25x (5m) / 2x (1h).
const SHORT = { input: 0.1, output: 0.5, cacheRead: 0.01, write5m: 0.125, write1h: 0.2 }
const LONG = { input: 0.5, output: 2.5, cacheRead: 0.05, write5m: 0.625, write1h: 1 }
const manual = (p: typeof SHORT, t: TokenUsage) =>
  (t.inputTokens * p.input + t.outputTokens * p.output + t.cacheReadInputTokens * p.cacheRead + t.cacheCreationInputTokens * p.write5m) / 1_000_000

const OTHER_MODELS = [
  'claude-opus-5-5', 'claude-fable-5-1', 'claude-sonnet-5-5', 'claude-opus-5', 'claude-sonnet-5', 'claude-fable-5',
  'claude-opus-4-8', 'claude-opus-4-7', 'claude-opus-4-7[1m]', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001',
  'claude-3-5-haiku-20241022', 'claude-3-opus-20240229',
]
const SPLITS: CacheWriteSplit[] = [{}, { cacheWrite5mTokens: 0, cacheWrite1hTokens: 0 }, { cacheWrite5mTokens: 3_000, cacheWrite1hTokens: 7_000 }]
const USAGES: TokenUsage[] = [u(0, 0, 0, 0), u(1_234, 5_678, 90_000, 4_321), u(77, 12_345, 980_000, 150_001), u(250_000, 64_000, 0, 0)]

describe('promptTokensOf', () => {
  it('counts uncached input, cache reads and cache writes', () => {
    expect(promptTokensOf(u(10, 999, 20, 30))).toBe(60)
  })
})

describe('estimateCallCost — Haiku 5.5 tier by the call\'s own prompt length', () => {
  it('≤100K prompt → base prices', () => {
    const t = u(10_000, 2_000, 60_000, 5_000)
    expect(estimateCallCost('claude-haiku-5-5', t)!.totalCost).toBeCloseTo(manual(SHORT, t), 12)
  })

  it('exactly 100,000 prompt tokens → still base prices', () => {
    const t = u(10_000, 2_000, 80_000, 10_000)
    expect(promptTokensOf(t)).toBe(100_000)
    expect(estimateCallCost('claude-haiku-5-5', t)!.totalCost).toBeCloseTo(manual(SHORT, t), 12)
  })

  it('100,001 prompt tokens → long-prompt prices for the whole call (output included)', () => {
    const t = u(10_001, 2_000, 80_000, 10_000)
    const c = estimateCallCost('claude-haiku-5-5', t)!
    expect(c.totalCost).toBeCloseTo(manual(LONG, t), 12)
    expect(c.readCost).toBeCloseTo(80_000 * LONG.cacheRead / 1_000_000, 12)
    expect(c.writeCost).toBeCloseTo(10_000 * LONG.write5m / 1_000_000, 12)
  })

  it('weights the cache write price by the 5m / 1h split', () => {
    const t = u(0, 0, 0, 200_000)
    const c = estimateCallCost('claude-haiku-5-5', t, { cacheWrite5mTokens: 1, cacheWrite1hTokens: 3 })!
    expect(c.writeCost).toBeCloseTo(200_000 * ((1 * LONG.write5m + 3 * LONG.write1h) / 4) / 1_000_000, 12)
  })

  it('unknown model → null', () => {
    expect(estimateCallCost('gpt-5-codex', u(1, 1, 1, 1))).toBeNull()
  })
})

describe('estimateModelUsageCost — Haiku 5.5 summed over calls', () => {
  it('no longPrompt part → everything at base prices (pre-T0484 result)', () => {
    const t = u(5_000, 3_000, 400_000, 20_000)
    expect(estimateModelUsageCost('claude-haiku-5-5', t)!.totalCost).toBeCloseTo(manual(SHORT, t), 12)
  })

  it('mixed turn: each call priced by its own prompt length, then summed', () => {
    // three calls: 60K (short), 100,000 (short, boundary), 150K (long)
    const c1 = u(2_000, 1_000, 55_000, 3_000)
    const c2 = u(1_000, 500, 95_000, 4_000)
    const c3 = u(3_000, 4_000, 140_000, 7_000)
    expect(promptTokensOf(c2)).toBe(100_000)
    const total = u(6_000, 5_500, 290_000, 14_000)
    const perCall = [c1, c2, c3].map(c => estimateCallCost('claude-haiku-5-5', c)!)
    const expected = perCall.reduce((s, c) => s + c.totalCost, 0)
    const got = estimateModelUsageCost('claude-haiku-5-5', { ...total, longPrompt: c3 })!
    expect(got.totalCost).toBeCloseTo(expected, 12)
    expect(got.readCost).toBeCloseTo(perCall.reduce((s, c) => s + c.readCost, 0), 12)
    expect(got.writeCost).toBeCloseTo(perCall.reduce((s, c) => s + c.writeCost, 0), 12)
    // and it is more than the pre-T0484 all-base estimate
    expect(got.totalCost).toBeGreaterThan(manual(SHORT, total))
  })

  it('all calls long → everything at long-prompt prices', () => {
    const t = u(5_000, 3_000, 400_000, 20_000)
    expect(estimateModelUsageCost('claude-haiku-5-5', { ...t, longPrompt: t })!.totalCost).toBeCloseTo(manual(LONG, t), 12)
  })

  it('clamps a longPrompt part larger than the totals', () => {
    const t = u(5_000, 3_000, 400_000, 20_000)
    const tooBig = u(9_000, 9_000, 900_000, 90_000)
    expect(estimateModelUsageCost('claude-haiku-5-5', { ...t, longPrompt: tooBig })!.totalCost).toBeCloseTo(manual(LONG, t), 12)
  })

  it('unknown model → null even with a longPrompt part', () => {
    expect(estimateModelUsageCost('o3', { ...u(1, 1, 1, 1), longPrompt: u(1, 1, 1, 1) })).toBeNull()
  })
})

describe('other models — results identical to the pre-T0484 panel formula', () => {
  for (const model of OTHER_MODELS) {
    it(`${model}: modelUsage branch, with and without a longPrompt part`, () => {
      for (const split of SPLITS) {
        for (const t of USAGES) {
          const legacy = legacyModelUsageCost(model, t, split)
          expect(legacy).not.toBeNull()
          expect(estimateModelUsageCost(model, t, split)).toEqual(legacy)
          // a longPrompt part must not change anything for a model without prompt-length tiers
          expect(estimateModelUsageCost(model, { ...t, longPrompt: t }, split)).toEqual(legacy)
        }
      }
    })

    it(`${model}: single-call row branch`, () => {
      for (const split of SPLITS) {
        for (const t of USAGES) {
          const h = { cacheRead: t.cacheReadInputTokens, cacheCreate: t.cacheCreationInputTokens, totalInput: promptTokensOf(t), outputTokens: t.outputTokens, ...split }
          const uncached = Math.max(0, h.totalInput - h.cacheRead - h.cacheCreate)
          const got = estimateCallCost(model, u(uncached, h.outputTokens, h.cacheRead, h.cacheCreate), split)
          expect(got).toEqual(legacyCallRowCost(model, h))
        }
      }
    })
  }

  it('Haiku 5.5 calls at or under 100K are unchanged too', () => {
    const t = u(1_234, 5_678, 90_000, 4_321)
    expect(promptTokensOf(t)).toBeLessThanOrEqual(100_000)
    expect(estimateModelUsageCost('claude-haiku-5-5', t)).toEqual(legacyModelUsageCost('claude-haiku-5-5', t, {}))
    expect(estimateCallCost('claude-haiku-5-5', t)).toEqual(legacyModelUsageCost('claude-haiku-5-5', t, {}))
  })

  it('every MODEL_PRICING key except the Haiku 5.5 tiers ignores prompt length', () => {
    for (const key of Object.keys(MODEL_PRICING).filter(k => !k.startsWith('haiku-5-5'))) {
      const id = `claude-${key}`
      expect(getModelPricing(id, { promptTokens: 999_999 })).toBe(getModelPricing(id))
    }
  })
})
