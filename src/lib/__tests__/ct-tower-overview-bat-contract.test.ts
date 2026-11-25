/**
 * PLAN-068 W4 / T0906 (T0902 §3.3): `_tower-state.md` frontmatter `bat_contract`.
 * A whole number ≥ 1 is kept; missing / anything else = contract v1 (absent). `summary_version` is not
 * involved, unknown keys stay ignored, and a YAML error is isolated as before (T0701 / T0894).
 */
import { describe, expect, it } from 'vitest'
import { parseTowerState, towerStateBatContract } from '../ct-tower-overview'

const state = (extra: string) => `---\nschema_kind: tower-state\nsummary_version: 1\n${extra}---\n\n# 塔台\n`

describe('bat_contract', () => {
  it('an integer ≥ 1 is read; summary_version unchanged', () => {
    const parsed = parseTowerState(state('bat_contract: 2\nct_version: "6.1.0"\nfuture_key: x\n'))
    expect(parsed.kind).toBe('summary')
    if (parsed.kind !== 'summary') return
    expect(parsed.summary.batContract).toBe(2)
    expect(parsed.summary.summaryVersion).toBe(1)
    expect(towerStateBatContract(parsed)).toBe(2)
  })

  it('missing / not an integer / < 1 → absent (v1)', () => {
    for (const extra of ['', 'bat_contract: "2"\n', 'bat_contract: 2.5\n', 'bat_contract: 0\n', 'bat_contract: -1\n', 'bat_contract: [2]\n', 'bat_contract: true\n']) {
      const parsed = parseTowerState(state(extra))
      expect(parsed.kind).toBe('summary')
      if (parsed.kind !== 'summary') continue
      expect(parsed.summary).not.toHaveProperty('batContract')
      expect(towerStateBatContract(parsed)).toBeNull()
    }
  })

  it('a file without a summary or with a YAML error → null, the parse stays isolated', () => {
    expect(towerStateBatContract(parseTowerState('# no frontmatter\n'))).toBeNull()
    const broken = parseTowerState('---\nschema_kind: tower-state\nbat_contract: [\n---\n')
    expect(broken.kind).toBe('no-summary')
    expect(towerStateBatContract(broken)).toBeNull()
    expect(towerStateBatContract(null)).toBeNull()
  })

  it('a future contract number is kept as written', () => {
    expect(towerStateBatContract(parseTowerState(state('bat_contract: 3\n')))).toBe(3)
  })
})
