/**
 * T0974: CT's own 6.4.0-pre.2 examples (copied byte for byte from CT, see the fixture READMEs).
 *
 *   - CT's `tower-state-v642.md` (`menu_open` right after `awaiting_user`, CT 6.4.0-pre.2 R1) reads like
 *     BAT's own T0971 fixture: `menu_open.ids` = ["U-61"], `user_actions` / `reminders` unchanged.
 *   - CT's five duplicate-key samples (CT 6.4.0-pre.2 R6, `check-frontmatter.py` `duplicate-key`): BAT's
 *     js-yaml load rejects a repeated key, so the whole file counts as having no summary (never the first or
 *     last value of the key), and nothing throws.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseTowerState, parseTowerStateInbox, towerStateBatContract } from '../ct-tower-overview'
import { inboxMenuInfo, parseMenuOpen } from '../tower-inbox'
import { parseWorkOrder } from '../../types/control-tower'

const FIXTURES = join(__dirname, '..', '..', 'types', '__tests__', 'fixtures')
const read = (dir: string, name: string) => readFileSync(join(FIXTURES, dir, name), 'utf8')

describe('CT 6.4.0-pre.2 example tower-state-v642.md', () => {
  const text = read('ct-tower-state-v642', 'tower-state-v642.md')

  it('summary and contract as usual', () => {
    const parsed = parseTowerState(text)
    expect(parsed.kind).toBe('summary')
    expect(towerStateBatContract(parsed)).toBe(2)
  })

  it('menu_open (after awaiting_user) → ids ["U-61"]; the other lists unchanged', () => {
    const lists = parseTowerStateInbox(text)!
    expect(lists).not.toBeNull()
    expect(lists.menuFeature).toBe(true)
    expect(lists.menuOpen).toEqual({ ids: ['U-61'], openedAt: '2026-11-28T15:40:00+08:00' })
    expect(lists.menuOpenInvalid).toBeUndefined()
    expect(inboxMenuInfo(lists)).toEqual({ ids: ['U-61'], openedAt: '2026-11-28T15:40:00+08:00' })
    expect(lists.awaiting.map(item => item.id)).toEqual(['U-57', 'U-59', 'U-60', 'U-61'])
    expect(lists.actions.map(item => item.id)).toEqual(['A-2'])
    expect(lists.reminders.map(item => item.id)).toEqual(['weekly-log-review'])
    expect(lists.features).toEqual(['recommended', 'dismiss', 'multi'])
    expect(lists.skipped).toEqual({ awaiting: 0, actions: 0, reminders: 0 })
  })

  it('parseMenuOpen on the raw value: the same result', () => {
    const awaitingIds = new Set(['U-57', 'U-59', 'U-60', 'U-61'])
    expect(parseMenuOpen({ ids: ['U-61'], opened_at: '2026-11-28T15:40:00+08:00' }, awaitingIds))
      .toEqual({ ids: ['U-61'], openedAt: '2026-11-28T15:40:00+08:00' })
  })
})

describe('CT 6.4.0-pre.2 duplicate-key samples → the whole file has no summary', () => {
  it.each([
    'dup-key-top.md',
    'dup-key-nested.md',
    'dup-key-item.md',
    'dup-key-menu-open-flow.md',
  ])('%s: parseTowerState no-summary, no contract, no inbox lists, no throw', name => {
    const text = read('ct-tower-state-dup-key', name)
    let parsed: ReturnType<typeof parseTowerState> | undefined
    expect(() => { parsed = parseTowerState(text) }).not.toThrow()
    expect(parsed!.kind).toBe('no-summary')
    expect(parsed!.kind === 'no-summary' && parsed!.summaryError).toMatch(/^YAML parse error: duplicated mapping key/)
    expect(towerStateBatContract(parsed)).toBeNull()
    expect(() => parseTowerStateInbox(text)).not.toThrow()
    expect(parseTowerStateInbox(text)).toBeNull()
  })

  it('dup-key-workorder.md (a work order, not a tower-state): not a tower-state summary either', () => {
    const text = read('ct-tower-state-dup-key', 'dup-key-workorder.md')
    expect(parseTowerState(text).kind).toBe('no-summary')
    expect(parseTowerStateInbox(text)).toBeNull()
  })

  it('dup-key-workorder.md through the work order parser: frontmatter rejected (warning), legacy fallback, no throw', () => {
    const text = read('ct-tower-state-dup-key', 'dup-key-workorder.md')
    let wo: ReturnType<typeof parseWorkOrder> | undefined
    expect(() => { wo = parseWorkOrder('T0001-dup-key-workorder.md', text) }).not.toThrow()
    expect(wo!.parseSource).toBe('legacy_markdown')
    expect(wo!.parseWarnings?.some(w => w.kind === 'invalid_frontmatter' && /duplicated mapping key/.test(w.detail ?? ''))).toBe(true)
    // neither of the two repeated `status` values is taken from the frontmatter
    expect(wo!.status).not.toBe('PENDING')
    expect(wo!.status).not.toBe('IN_PROGRESS')
  })
})
