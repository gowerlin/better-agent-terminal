/**
 * T0971: CT 6.4.0-pre.2 and BUG-237 (pure parts).
 *
 *   - B-1: where `menu_open` sits among the top-level keys does not matter (CT 6.4.0-pre.2 R1 moves it right
 *     after `awaiting_user`); BAT's own fixture src/types/__tests__/fixtures/ct-tower-state-v642/
 *   - B-2: CT writes in several steps, so `menu_open.ids` may name an id that is not (yet / any more) in
 *     `awaiting_user`: the whole `menu_open` is then invalid (`menuOpenInvalid`, no Esc) — 🔴 never "the valid
 *     part of the ids"
 *   - BUG-237: `inboxMenuHintIdsFromHost` — the hint follows the host's answer; `unsupported` → T0968's rule
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseTowerState, parseTowerStateInbox, towerStateBatContract } from '../ct-tower-overview'
import { inboxMenuInfo } from '../tower-inbox'
import { inboxMenuHintIdsFromHost, type InboxAnswerTarget, type InboxMenuHintAnswer } from '../inbox-model'

const FIXTURES = join(__dirname, '..', '..', 'types', '__tests__', 'fixtures', 'ct-tower-state-v642')
const fixture = (name: string) => readFileSync(join(FIXTURES, `${name}.md`), 'utf8')

const MENU_OPEN = 'menu_open:\n  ids: ["U-57", "U-58"]\n  opened_at: "2026-11-28T15:23:00+08:00"'
const AWAITING = `awaiting_user:
  - id: "U-57"
    summary: "made-up question 57"
    options: ["A 甲", "B 乙"]
  - id: "U-58"
    summary: "made-up question 58"
    options: ["A 甲", "B 乙"]`
const ACTIONS = 'user_actions:\n  - id: "A-1"\n    title: "made-up action"'
const REMINDERS = 'reminders:\n  - id: "made-up-reminder"\n    title: "made-up reminder"\n    due_at: "2026-11-29T09:00:00+08:00"'
const HEAD = 'schema_kind: tower-state\nsummary_version: 1\nbat_contract: 2\ninbox_features: ["recommended", "dismiss", "multi", "menu"]\nupdated_at: "2026-11-28T15:30:00+0800"'
const state = (...blocks: string[]) => `---\n${blocks.join('\n')}\n---\n# body\n`

describe('B-1: menu_open after awaiting_user (CT 6.4.0-pre.2 R1)', () => {
  it('BAT\'s fixture: menu_open between awaiting_user and user_actions → read; the other lists unchanged', () => {
    const text = fixture('tower-state-v642-menu-after-awaiting')
    const lists = parseTowerStateInbox(text)!
    expect(lists.menuFeature).toBe(true)
    expect(lists.menuOpen).toEqual({ ids: ['U-57', 'U-58'], openedAt: '2026-11-28T15:23:00+08:00' })
    expect(lists.menuOpenInvalid).toBeUndefined()
    expect(inboxMenuInfo(lists)).toEqual({ ids: ['U-57', 'U-58'], openedAt: '2026-11-28T15:23:00+08:00' })
    expect(lists.awaiting.map(item => item.id)).toEqual(['U-57', 'U-58'])
    expect(lists.actions.map(item => item.id)).toEqual(['A-1'])
    expect(lists.reminders.map(item => item.id)).toEqual(['made-up-reminder'])
    expect(lists.features).toEqual(['recommended', 'dismiss', 'multi'])
    expect(lists.skipped).toEqual({ awaiting: 0, actions: 0, reminders: 0 })
    // the overview summary and the contract read the same file as before
    expect(parseTowerState(text).kind).toBe('summary')
    expect(towerStateBatContract(parseTowerState(text))).toBe(2)
  })

  it.each([
    ['after updated_at (6.4.0-pre.1)', [HEAD, MENU_OPEN, AWAITING, ACTIONS, REMINDERS]],
    ['right after awaiting_user (6.4.0-pre.2)', [HEAD, AWAITING, MENU_OPEN, ACTIONS, REMINDERS]],
    ['after reminders (last)', [HEAD, AWAITING, ACTIONS, REMINDERS, MENU_OPEN]],
    ['before schema_kind (first)', [MENU_OPEN, HEAD, AWAITING, ACTIONS, REMINDERS]],
  ])('%s → the same lists', (_name, blocks) => {
    const lists = parseTowerStateInbox(state(...blocks))!
    expect(lists.menuOpen).toEqual({ ids: ['U-57', 'U-58'], openedAt: '2026-11-28T15:23:00+08:00' })
    expect(lists.menuOpenInvalid).toBeUndefined()
    expect(lists.awaiting.map(item => item.id)).toEqual(['U-57', 'U-58'])
    expect(lists.actions.map(item => item.id)).toEqual(['A-1'])
    expect(lists.reminders.map(item => item.id)).toEqual(['made-up-reminder'])
  })
})

describe('B-2: menu_open.ids not all in awaiting_user (CT writing in steps) → the whole menu_open is invalid', () => {
  it.each([
    ['one of two missing', '["U-57", "U-99"]'],
    ['the last of three missing', '["U-57", "U-58", "U-99"]'],
    ['the first missing', '["U-99", "U-57"]'],
  ])('%s → no menu_open (never the valid part), flagged; no Esc information', (_name, ids) => {
    const lists = parseTowerStateInbox(state(HEAD, AWAITING, `menu_open:\n  ids: ${ids}\n  opened_at: "2026-11-28T15:23:00+08:00"`, ACTIONS))!
    expect(lists.menuOpen).toBeUndefined()
    expect(lists.menuOpenInvalid).toBe(true)
    // the answer tells the host "no menu holds a U-n" (`null` → `no-menu-open`: no Esc)
    expect(inboxMenuInfo(lists)).toBeNull()
    expect(lists.awaiting.map(item => item.id)).toEqual(['U-57', 'U-58'])
  })

  it('menu_open written before awaiting_user has the id (CT step 1 of 2) → invalid until the next write', () => {
    const before = parseTowerStateInbox(state(HEAD, 'awaiting_user:\n  - id: "U-57"\n    summary: "made-up"\n    options: ["A 甲", "B 乙"]', 'menu_open:\n  ids: ["U-57", "U-58"]\n  opened_at: "2026-11-28T15:23:00+08:00"'))!
    expect(before.menuOpenInvalid).toBe(true)
    const after = parseTowerStateInbox(state(HEAD, AWAITING, MENU_OPEN))!
    expect(after.menuOpen?.ids).toEqual(['U-57', 'U-58'])
  })
})

describe('BUG-237: inboxMenuHintIdsFromHost', () => {
  const tab: InboxAnswerTarget = { kind: 'tab', id: 'tower', title: 'Tower' }
  const tab2: InboxAnswerTarget = { kind: 'tab', id: 'tower-2', title: 'Tower 2' }
  const panel: InboxAnswerTarget = { kind: 'panel', id: 'panel', title: 'Panel' }
  const menu = { ids: ['U-57', 'U-58'] }
  const answers = (map: Record<string, InboxMenuHintAnswer>) => (id: string) => map[id]

  it('the host says it would close the menu → those ids (menu order); says no (stale) → nothing', () => {
    expect(inboxMenuHintIdsFromHost(menu, [tab], answers({ tower: { ids: ['U-58', 'U-57'], via: 'question' } }), () => 'question')).toEqual(['U-57', 'U-58'])
    expect(inboxMenuHintIdsFromHost(menu, [tab], answers({ tower: { ids: [], via: 'question' } }), () => 'question')).toEqual([])
  })

  it('the menu record alone (T0968 Q-2): shown when the host says so, though the tab is not `question`', () => {
    expect(inboxMenuHintIdsFromHost(menu, [tab], answers({ tower: { ids: ['U-57', 'U-58'], via: 'menu' } }), () => undefined)).toEqual(['U-57', 'U-58'])
  })

  it('not answered yet → nothing (even while `question`)', () => {
    expect(inboxMenuHintIdsFromHost(menu, [tab], answers({}), () => 'question')).toEqual([])
  })

  it('unsupported (an older host) → T0968: the menu ids while the tab is `question`, else nothing', () => {
    expect(inboxMenuHintIdsFromHost(menu, [tab], answers({ tower: 'unsupported' }), () => 'question')).toEqual(['U-57', 'U-58'])
    expect(inboxMenuHintIdsFromHost(menu, [tab], answers({ tower: 'unsupported' }), () => undefined)).toEqual([])
  })

  it('ids outside menu are ignored; several Tower tabs are joined; a panel Tower never; no menu → nothing', () => {
    expect(inboxMenuHintIdsFromHost(menu, [tab], answers({ tower: { ids: ['U-99'], via: 'question' } }), () => 'question')).toEqual([])
    expect(inboxMenuHintIdsFromHost(menu, [tab, tab2], answers({ tower: { ids: [], via: null }, 'tower-2': { ids: ['U-58'], via: 'question' } }), () => 'question')).toEqual(['U-58'])
    expect(inboxMenuHintIdsFromHost(menu, [panel], answers({ panel: { ids: ['U-57'], via: 'question' } }), () => 'question')).toEqual([])
    expect(inboxMenuHintIdsFromHost(null, [tab], answers({ tower: { ids: ['U-57'], via: 'question' } }), () => 'question')).toEqual([])
    expect(inboxMenuHintIdsFromHost(undefined, [tab], answers({ tower: { ids: ['U-57'], via: 'question' } }), () => 'question')).toEqual([])
  })
})
