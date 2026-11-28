/**
 * T0968 (CT 6.4.0-pre.1, CT D927): `inbox_features: menu` + the top-level `menu_open` of `_tower-state.md`.
 *
 *   - the four CT examples (src/types/__tests__/fixtures/ct-tower-state-v640/, copies of CT commit
 *     `7fee085`): block map, flow mapping, block list, and `menu_open` without `menu` (ignored)
 *   - `menu_open` counts only with `menu`; malformed → absent and flagged, the other lists unchanged
 *   - `INBOX_FEATURES` / `features` unchanged (T0922 / T0938 assertions stay)
 *   - what an answer carries (`inboxMenuInfo`), its host check (`checkInboxMenuInfo`), the hint ids
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseTowerStateInbox } from '../ct-tower-overview'
import {
  INBOX_FEATURES,
  checkInboxMenuInfo,
  hasInboxMenuFeature,
  inboxMenuInfo,
  parseMenuOpen,
} from '../tower-inbox'
import { inboxMenuHintIds, type InboxAnswerTarget } from '../inbox-model'

const FIXTURES = join(__dirname, '..', '..', 'types', '__tests__', 'fixtures', 'ct-tower-state-v640')
const fixture = (name: string) => readFileSync(join(FIXTURES, `${name}.md`), 'utf8')

const STATE = (lines: string) => `---
schema_kind: tower-state
summary_version: 1
bat_contract: 2
${lines}
awaiting_user:
  - id: "U-57"
    summary: "made-up question 57"
    options: ["A 甲", "B 乙"]
  - id: "U-58"
    summary: "made-up question 58"
    options: ["A 甲", "B 乙"]
---
# body
`

describe('the CT 6.4.0-pre.1 examples', () => {
  it('tower-state-v640: block map, flow ids — both U-n in menu order', () => {
    const lists = parseTowerStateInbox(fixture('tower-state-v640'))!
    expect(lists.menuFeature).toBe(true)
    expect(lists.menuOpen).toEqual({ ids: ['U-57', 'U-58'], openedAt: '2026-11-28T12:23:00+08:00' })
    expect(lists.menuOpenInvalid).toBeUndefined()
    expect(lists.features).toEqual(['recommended', 'dismiss', 'multi'])
    expect(lists.awaiting.map(item => item.id)).toEqual(['U-57', 'U-58'])
    expect(inboxMenuInfo(lists)).toEqual({ ids: ['U-57', 'U-58'], openedAt: '2026-11-28T12:23:00+08:00' })
  })

  it('tower-state-v640-flow: one flow mapping', () => {
    const lists = parseTowerStateInbox(fixture('tower-state-v640-flow'))!
    expect(lists.menuOpen).toEqual({ ids: ['U-58'], openedAt: '2026-11-28T12:23:00+08:00' })
  })

  it('tower-state-v640-block-list: ids as a block list, order kept (U-58 first)', () => {
    const lists = parseTowerStateInbox(fixture('tower-state-v640-block-list'))!
    expect(lists.menuOpen).toEqual({ ids: ['U-58', 'U-57'], openedAt: '2026-11-28T12:23:00+08:00' })
  })

  it('tower-state-v640-menu-ignored: no `menu` in inbox_features → menu_open is not read (= CT 6.3.x)', () => {
    const lists = parseTowerStateInbox(fixture('tower-state-v640-menu-ignored'))!
    expect(lists.menuFeature).toBeUndefined()
    expect(lists.menuOpen).toBeUndefined()
    expect(lists.menuOpenInvalid).toBeUndefined()
    expect(inboxMenuInfo(lists)).toBeUndefined()
    expect(lists.awaiting).toHaveLength(2)
  })
})

describe('menu_open rules', () => {
  it('`menu` without menu_open → null (no open menu holds a U-n)', () => {
    const lists = parseTowerStateInbox(STATE('inbox_features: ["recommended", "dismiss", "multi", "menu"]'))!
    expect(lists.menuFeature).toBe(true)
    expect(lists.menuOpen).toBeUndefined()
    expect(inboxMenuInfo(lists)).toBeNull()
  })

  it('CT 6.3.x (no `menu`), no inbox_features at all → undefined; nothing added to the lists object', () => {
    for (const lines of ['inbox_features: ["recommended", "dismiss", "multi"]', '']) {
      const lists = parseTowerStateInbox(STATE(lines))!
      expect(inboxMenuInfo(lists)).toBeUndefined()
      expect(Object.keys(lists)).not.toContain('menuFeature')
      expect(Object.keys(lists)).not.toContain('menuOpen')
      expect(Object.keys(lists)).not.toContain('menuOpenInvalid')
    }
  })

  it.each([
    ['not an object', 'menu_open: "U-57"'],
    ['no ids', 'menu_open: { opened_at: "2026-11-28T12:23:00+08:00" }'],
    ['empty ids', 'menu_open: { ids: [], opened_at: "2026-11-28T12:23:00+08:00" }'],
    ['five ids', 'menu_open: { ids: ["U-1", "U-2", "U-3", "U-4", "U-5"], opened_at: "2026-11-28T12:23:00+08:00" }'],
    ['an A-n', 'menu_open: { ids: ["A-1"], opened_at: "2026-11-28T12:23:00+08:00" }'],
    ['a number', 'menu_open: { ids: [57], opened_at: "2026-11-28T12:23:00+08:00" }'],
    ['a duplicate', 'menu_open: { ids: ["U-57", "U-57"], opened_at: "2026-11-28T12:23:00+08:00" }'],
    ['not in awaiting_user', 'menu_open: { ids: ["U-99"], opened_at: "2026-11-28T12:23:00+08:00" }'],
    ['no opened_at', 'menu_open: { ids: ["U-57"] }'],
    ['a bare date', 'menu_open: { ids: ["U-57"], opened_at: "2026-11-28" }'],
    ['not a time', 'menu_open: { ids: ["U-57"], opened_at: "soon" }'],
  ])('malformed (%s) → treated as absent, flagged; the lists stay', (_name, line) => {
    const lists = parseTowerStateInbox(STATE(`inbox_features: ["menu"]\n${line}`))!
    expect(lists.menuOpen).toBeUndefined()
    expect(lists.menuOpenInvalid).toBe(true)
    expect(inboxMenuInfo(lists)).toBeNull()
    expect(lists.awaiting.map(item => item.id)).toEqual(['U-57', 'U-58'])
  })

  it('INBOX_FEATURES and `features` do not change (menu is read on its own)', () => {
    expect(INBOX_FEATURES).toEqual(['recommended', 'dismiss', 'multi'])
    expect(hasInboxMenuFeature(['menu'])).toBe(true)
    expect(hasInboxMenuFeature([' menu '])).toBe(true)
    expect(hasInboxMenuFeature(['MENU', 3, null])).toBe(false)
    expect(hasInboxMenuFeature('menu')).toBe(false)
  })

  it('parseMenuOpen accepts +0800 too (CT readers accept both)', () => {
    expect(parseMenuOpen({ ids: ['U-1'], opened_at: '2026-11-28T12:23:00+0800' }, new Set(['U-1']))).toEqual({ ids: ['U-1'], openedAt: '2026-11-28T12:23:00+0800' })
  })
})

describe('checkInboxMenuInfo (host side)', () => {
  it('absent → undefined, null → null, well formed → a copy', () => {
    expect(checkInboxMenuInfo(undefined)).toBeUndefined()
    expect(checkInboxMenuInfo(null)).toBeNull()
    const raw = { ids: ['U-1', 'U-2'], openedAt: '2026-11-28T12:23:00+08:00', extra: 1 }
    expect(checkInboxMenuInfo(raw)).toEqual({ ids: ['U-1', 'U-2'], openedAt: '2026-11-28T12:23:00+08:00' })
  })

  it.each([
    'U-1', 3, [], { ids: [] }, { ids: ['U-1'] }, { ids: ['A-1'], openedAt: '2026-11-28T12:23:00+08:00' },
    { ids: ['U-1', 'U-1'], openedAt: '2026-11-28T12:23:00+08:00' },
    { ids: ['U-1', 'U-2', 'U-3', 'U-4', 'U-5'], openedAt: '2026-11-28T12:23:00+08:00' },
    { ids: ['U-1'], openedAt: '2026-11-28' }, { ids: ['U-1'], openedAt: 'x'.repeat(65) },
  ])('malformed %j → invalid', (raw) => {
    expect(checkInboxMenuInfo(raw)).toBe('invalid')
  })
})

describe('inboxMenuHintIds', () => {
  const tab: InboxAnswerTarget = { kind: 'tab', id: 'tower', title: 'Tower' }
  const panel: InboxAnswerTarget = { kind: 'panel', id: 'panel', title: 'Panel' }
  const menu = { ids: ['U-57'] }

  it('the menu ids while a Tower tab shows `question`', () => {
    expect(inboxMenuHintIds(menu, [tab], () => 'question')).toEqual(['U-57'])
  })

  it('nothing otherwise: no `question` (only the menu record — Q-2), no menu_open, no `menu`, a panel Tower', () => {
    expect(inboxMenuHintIds(menu, [tab], () => undefined)).toEqual([])
    expect(inboxMenuHintIds(menu, [tab], () => 'permission')).toEqual([])
    expect(inboxMenuHintIds(null, [tab], () => 'question')).toEqual([])
    expect(inboxMenuHintIds(undefined, [tab], () => 'question')).toEqual([])
    expect(inboxMenuHintIds(menu, [panel], () => 'question')).toEqual([])
  })
})
