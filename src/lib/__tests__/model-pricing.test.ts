// BUG-084 / T0374 — pricing lookup tests.
//
// The "legacy" block locks the ID → price mapping that ClaudeAgentPanel /
// CodexAgentPanel had inline before the shared module existed; it must not change.
// Claude 5 prices come only from T0368 report §4 (platform.claude.com pricing page).

import { describe, it, expect } from 'vitest'
import { P, getModelPricing, type ModelPricing } from '../model-pricing'

function expectPricing(actual: ModelPricing | null, expected: ModelPricing) {
  expect(actual).not.toBeNull()
  const p = actual as ModelPricing
  expect(p.input).toBeCloseTo(expected.input, 10)
  expect(p.output).toBeCloseTo(expected.output, 10)
  expect(p.cacheRead).toBeCloseTo(expected.cacheRead, 10)
  expect(p.cacheWrite5m).toBeCloseTo(expected.cacheWrite5m, 10)
  expect(p.cacheWrite1h).toBeCloseTo(expected.cacheWrite1h, 10)
}

const price = (input: number, output: number, cacheRead: number, cacheWrite5m: number, cacheWrite1h: number): ModelPricing =>
  ({ input, output, cacheRead, cacheWrite5m, cacheWrite1h })

describe('P()', () => {
  it('defaults to 0.1x cache read, 1.25x / 2x cache write', () => {
    expect(P(4, 20)).toEqual({ input: 4, output: 20, cacheRead: 0.4, cacheWrite5m: 5, cacheWrite1h: 8 })
  })

  it('honours cacheReadMultiplier', () => {
    expect(P(4, 20, { cacheReadMultiplier: 0.05 }).cacheRead).toBeCloseTo(0.2, 10)
    expect(P(10, 50, { cacheReadMultiplier: 0.025 }).cacheRead).toBeCloseTo(0.25, 10)
  })
})

describe('getModelPricing — legacy IDs (locked, pre-T0374 behaviour)', () => {
  const OPUS_NEW = price(5, 25, 0.5, 6.25, 10)
  const OPUS_OLD = price(15, 75, 1.5, 18.75, 30)
  const SONNET = price(3, 15, 0.3, 3.75, 6)
  const HAIKU_45 = price(1, 5, 0.1, 1.25, 2)
  const HAIKU_35 = price(0.8, 4, 0.08, 1, 1.6)
  const HAIKU_3 = price(0.25, 1.25, 0.025, 0.3125, 0.5)

  const cases: [string, ModelPricing][] = [
    ['claude-opus-4-7', OPUS_NEW],
    ['claude-opus-4-7[1m]', OPUS_NEW],
    ['claude-opus-4-6', OPUS_NEW],
    ['claude-opus-4-6[1m]', OPUS_NEW],
    ['claude-opus-4-5-20251101', OPUS_NEW],
    ['claude-opus-4-1-20250805', OPUS_OLD],
    ['claude-opus-4-20250514', OPUS_OLD],
    ['claude-opus-4-0', OPUS_OLD],
    ['claude-opus-4', OPUS_OLD],
    ['claude-3-opus-20240229', OPUS_OLD],
    ['claude-sonnet-4-6', SONNET],
    ['claude-sonnet-4-6[1m]', SONNET],
    ['claude-sonnet-4-5-20250929', SONNET],
    ['claude-sonnet-4-20250514', SONNET],
    ['claude-sonnet-4-0', SONNET],
    ['claude-3-7-sonnet-20250219', SONNET],
    ['claude-3-5-sonnet-20241022', SONNET],
    ['claude-haiku-4-5-20251001', HAIKU_45],
    ['claude-haiku-4-5', HAIKU_45],
    ['claude-3-5-haiku-20241022', HAIKU_35],
    ['claude-3-haiku-20240307', HAIKU_3],
  ]

  it.each(cases)('%s', (id, expected) => {
    expectPricing(getModelPricing(id), expected)
  })

  it.each(['default', 'opus', 'sonnet', 'gpt-5-codex', 'o3', ''])('unknown id %j → null', (id) => {
    expect(getModelPricing(id)).toBeNull()
  })
})

describe('getModelPricing — Claude 5 (T0368 §4)', () => {
  const cases: [string, ModelPricing][] = [
    // id, input / output, cache read, 5m / 1h cache write — all straight from the T0368 table
    ['claude-opus-5-5', price(4, 20, 0.2, 5, 8)],
    ['claude-opus-5-5[1m]', price(4, 20, 0.2, 5, 8)],
    ['claude-fable-5-1', price(10, 50, 0.25, 12.5, 20)],
    ['claude-sonnet-5-5', price(2, 10, 0.2, 2.5, 4)],
    ['claude-opus-5', price(5, 25, 0.5, 6.25, 10)],
    ['claude-opus-4-8', price(5, 25, 0.5, 6.25, 10)],
    ['claude-sonnet-5', price(2, 10, 0.2, 2.5, 4)],
    ['claude-fable-5', price(10, 50, 1, 12.5, 20)],
  ]

  it.each(cases)('%s', (id, expected) => {
    expectPricing(getModelPricing(id), expected)
  })

  it('point releases are not shadowed by their base model', () => {
    expect(getModelPricing('claude-opus-5-5')!.input).toBe(4)
    expect(getModelPricing('claude-opus-5')!.input).toBe(5)
    expect(getModelPricing('claude-fable-5-1')!.cacheRead).toBeCloseTo(0.25, 10)
    expect(getModelPricing('claude-fable-5')!.cacheRead).toBeCloseTo(1, 10)
  })
})
