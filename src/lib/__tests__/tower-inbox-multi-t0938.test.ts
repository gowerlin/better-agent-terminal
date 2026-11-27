/**
 * T0938 (PLAN-070 item 4, CT 6.3.0 contract M1 / M3 / M4): multiple choice in「⏸ 待你決定」.
 *
 * - `inbox_features` knows `multi`
 * - `awaiting_user[].multi`: only the boolean `true`, with ≥ 2 usable options and the `multi` flag;
 *   anything else → single choice (no error, the item is kept)
 * - `recommended: "A、C"`: every code on a multiple-choice item; one unknown → none; single choice
 *   keeps one code (T0922)
 * - `multiAnswerText`: `options` order, each once, written as in `options`, joined with `、`
 */
import { describe, expect, it } from 'vitest'
import {
  awaitingIsMulti,
  checkInboxAnswer,
  matchRecommended,
  matchRecommendedCodes,
  multiAnswerText,
  parseAwaitingOptions,
  parseInboxFeatures,
  parseTowerInboxLists,
  type AwaitingOption,
} from '../tower-inbox'
import { parseTowerStateInbox } from '../ct-tower-overview'

const OPTIONS: AwaitingOption[] = parseAwaitingOptions(['A 甲', 'b 乙', 'C 丙']).options!
const ALL = ['recommended', 'dismiss', 'multi'] as const

function item(extra: Record<string, unknown>) {
  return { id: 'U-3', summary: 'made-up question', options: ['A 甲', 'b 乙', 'C 丙'], ...extra }
}

describe('inbox_features: multi', () => {
  it('is a known value', () => {
    expect(parseInboxFeatures(['recommended', 'dismiss', 'multi'])).toEqual(['recommended', 'dismiss', 'multi'])
    expect(parseInboxFeatures([' multi ', 'multi'])).toEqual(['multi'])
    expect(parseInboxFeatures(['MULTI'])).toEqual([])
  })
})

describe('awaitingIsMulti', () => {
  it('true only for the boolean true + ≥ 2 options + the flag', () => {
    expect(awaitingIsMulti(true, OPTIONS, ALL)).toBe(true)
    expect(awaitingIsMulti(true, OPTIONS.slice(0, 2), ['multi'])).toBe(true)
    for (const raw of ['true', 1, 'yes', false, null, undefined, {}]) expect(awaitingIsMulti(raw, OPTIONS, ALL)).toBe(false)
    expect(awaitingIsMulti(true, OPTIONS.slice(0, 1), ALL)).toBe(false)
    expect(awaitingIsMulti(true, null, ALL)).toBe(false)
    expect(awaitingIsMulti(true, OPTIONS, ['recommended', 'dismiss'])).toBe(false)
    expect(awaitingIsMulti(true, OPTIONS, [])).toBe(false)
  })
})

describe('matchRecommendedCodes', () => {
  it('multiple choice: every code, in options order, as written in options', () => {
    expect(matchRecommendedCodes('A、C', OPTIONS, true)).toEqual(['A', 'C'])
    expect(matchRecommendedCodes('C、a', OPTIONS, true)).toEqual(['A', 'C'])
    expect(matchRecommendedCodes(' B , c ', OPTIONS, true)).toEqual(['b', 'C'])
    expect(matchRecommendedCodes('A、A', OPTIONS, true)).toEqual(['A'])
    expect(matchRecommendedCodes('C', OPTIONS, true)).toEqual(['C'])
  })

  it('multiple choice: one code matching nothing → no recommendation at all', () => {
    expect(matchRecommendedCodes('A、D', OPTIONS, true)).toBeUndefined()
    expect(matchRecommendedCodes('A、', OPTIONS, true)).toBeUndefined()
    expect(matchRecommendedCodes('', OPTIONS, true)).toBeUndefined()
    expect(matchRecommendedCodes(['A'], OPTIONS, true)).toBeUndefined()
    expect(matchRecommendedCodes('A', null, true)).toBeUndefined()
  })

  it('single choice: one code only (= matchRecommended, T0922)', () => {
    expect(matchRecommendedCodes('a', OPTIONS, false)).toEqual(['A'])
    expect(matchRecommendedCodes('A、C', OPTIONS, false)).toBeUndefined()
    expect(matchRecommended('A、C', OPTIONS)).toBeUndefined()
  })
})

describe('parseTowerInboxLists: multi', () => {
  it('flag + multi: true + ≥ 2 options → multi, recommendedCodes (never recommended)', () => {
    const lists = parseTowerInboxLists({ inbox_features: [...ALL], awaiting_user: [item({ multi: true, recommended: 'C、A' })] })
    expect(lists.awaiting[0].multi).toBe(true)
    expect(lists.awaiting[0].recommendedCodes).toEqual(['A', 'C'])
    expect(lists.awaiting[0]).not.toHaveProperty('recommended')
  })

  it('a multiple-choice item with one unknown recommended code: kept, no recommendation', () => {
    const lists = parseTowerInboxLists({ inbox_features: [...ALL], awaiting_user: [item({ multi: true, recommended: 'A、Z' })] })
    expect(lists.awaiting).toHaveLength(1)
    expect(lists.skipped.awaiting).toBe(0)
    expect(lists.awaiting[0].multi).toBe(true)
    expect(lists.awaiting[0]).not.toHaveProperty('recommendedCodes')
  })

  it('no flag / not the boolean true / < 2 options → exactly the single-choice item of before', () => {
    const cases: Array<[unknown, Record<string, unknown>]> = [
      [['recommended', 'dismiss'], item({ multi: true, recommended: 'A' })],
      [undefined, item({ multi: true, recommended: 'A' })],
      [[...ALL], item({ multi: 'true', recommended: 'A' })],
      [[...ALL], item({ multi: 1, recommended: 'A' })],
      [[...ALL], item({ multi: true, recommended: 'A', options: ['A 甲'] })],
    ]
    for (const [features, raw] of cases) {
      const lists = parseTowerInboxLists({ inbox_features: features, awaiting_user: [raw] })
      expect(lists.skipped.awaiting).toBe(0)
      const entry = lists.awaiting[0]
      expect(entry).not.toHaveProperty('multi')
      expect(entry).not.toHaveProperty('recommendedCodes')
      expect(entry.recommended).toBe('A')
    }
    // a single-choice item with "A、C": not recommended (T0922 behaviour kept)
    const single = parseTowerInboxLists({ inbox_features: [...ALL], awaiting_user: [item({ recommended: 'A、C' })] }).awaiting[0]
    expect(single).not.toHaveProperty('recommended')
    expect(single).not.toHaveProperty('multi')
  })

  it('multi: true on a free answer (options: [] / invalid) is ignored', () => {
    const lists = parseTowerInboxLists({
      inbox_features: [...ALL],
      awaiting_user: [item({ id: 'U-1', multi: true, options: [] }), item({ id: 'U-2', multi: true, options: ['沒有代號'] })],
    })
    expect(lists.awaiting.map(entry => entry.multi)).toEqual([undefined, undefined])
    expect(lists.awaiting[1].optionsInvalid).toBe(true)
  })

  it('from a _tower-state.md: YAML `multi: true` (CORE schema) is the boolean', () => {
    const state = `---
schema_kind: tower-state
summary_version: 1
bat_contract: 2
inbox_features: ["recommended", "dismiss", "multi"]
awaiting_user:
  - id: "U-3"
    summary: "made-up"
    options: ["A 甲", "B 乙", "C 丙"]
    multi: true
    recommended: "A、C"
  - id: "U-4"
    summary: "made-up quoted"
    options: ["A 甲", "B 乙"]
    multi: "true"
---
`
    const lists = parseTowerStateInbox(state)!
    expect(lists.features).toEqual(['recommended', 'dismiss', 'multi'])
    expect(lists.awaiting[0].multi).toBe(true)
    expect(lists.awaiting[0].recommendedCodes).toEqual(['A', 'C'])
    expect(lists.awaiting[1]).not.toHaveProperty('multi')
  })
})

describe('multiAnswerText', () => {
  it('options order, each once, written as in options, joined with 、', () => {
    expect(multiAnswerText('U-3', ['C', 'A'], OPTIONS)).toBe('U-3：A、C')
    expect(multiAnswerText('U-3', new Set(['A']), OPTIONS)).toBe('U-3：A')
    expect(multiAnswerText('U-3', ['B', 'c', 'C', 'b'], OPTIONS)).toBe('U-3：b、C')
    expect(multiAnswerText('U-3', ['A', 'b', 'C'], OPTIONS)).toBe('U-3：A、b、C')
  })

  it('codes matching no option are dropped; none left → null', () => {
    expect(multiAnswerText('U-3', ['A', 'Z'], OPTIONS)).toBe('U-3：A')
    expect(multiAnswerText('U-3', ['Z'], OPTIONS)).toBeNull()
    expect(multiAnswerText('U-3', [], OPTIONS)).toBeNull()
  })

  it('the line passes the host check unchanged (single-id line, any text)', () => {
    expect(checkInboxAnswer(multiAnswerText('U-3', ['A', 'C'], OPTIONS))).toBe('ok')
  })
})
