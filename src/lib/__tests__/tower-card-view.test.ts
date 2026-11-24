/**
 * PLAN-068 W6 / T0909: pure decisions of the「💬 塔台訊息」section and the panel Tower definition
 * (T0909 Q-1, Tower answer A: `workspaceHasPanelTowers` / `panelTowerTerminalIds`).
 */
import { describe, expect, it } from 'vitest'
import {
  TOWER_CARD_FOLD_CHARS,
  TOWER_CARD_FOLD_LINES,
  TOWER_CARD_PREVIEW_CHARS,
  TOWER_CARDS_MIN_CLAUDE_VERSION,
  isCodexTower,
  isTowerCardHighlightLine,
  orderTowerCards,
  showsClaudeTooOldHint,
  towerCardFold,
  towerCardHighlights,
  towerCardLines,
  towerCardPreview,
  towerCardsBadgeCount,
  towerCardsForSection,
  towerCardTime,
} from '../tower-card-view'
import { CLAUDE_PANEL_PRESETS, panelTowerTerminalIds, workspaceHasPanelTowers } from '../inbox-model'
import type { TowerCard, TowerCardsEntry } from '../../types/tower-cards'

const card = (id: string, createdAt: number, extra: Partial<TowerCard> = {}): TowerCard => ({
  id, terminalId: 't', source: 'hook', text: id, truncated: false, createdAt, read: false, pinned: false, ...extra,
})
const entry = (cards: TowerCard[], stopsWithoutMessage = 0): TowerCardsEntry => ({
  terminalId: 't', alive: true, revision: 1, cards, unread: cards.filter(c => !c.read).length, stopsWithoutMessage,
})

describe('highlight lines (a hint only)', () => {
  it.each([
    ['⏸ 待你決定：U-3', true],
    ['🙋 待你執行：A-2', true],
    ['  ⏸ 待你決定：U-3', true],
    ['- ⏸ 待你決定：U-3', true],
    ['> 🙋 待你執行：A-2', true],
    ['1. ⏸ 待你決定：U-3', true],
    ['⏸ 待你決定: U-3', true],
    ['⏸ 待你決定 U-3', false],
    ['見 ⏸ 待你決定：U-3', false],
    ['待你決定：U-3', false],
    ['', false],
  ])('%j → %s', (line, expected) => {
    expect(isTowerCardHighlightLine(line)).toBe(expected)
  })

  it('splits lines (CRLF too) and lists the highlighted ones trimmed', () => {
    const text = 'done\r\n  ⏸ 待你決定：U-1\nplain\n🙋 待你執行：A-1'
    expect(towerCardLines(text).map(l => l.highlight)).toEqual([false, true, false, true])
    expect(towerCardHighlights(text)).toEqual(['⏸ 待你決定：U-1', '🙋 待你執行：A-1'])
  })
})

describe('preview and folding', () => {
  it('preview = first non-empty line, cut by characters (not UTF-16 units)', () => {
    expect(towerCardPreview('\n\n  hello  \nworld')).toBe('hello')
    const long = '😀'.repeat(TOWER_CARD_PREVIEW_CHARS + 5)
    expect([...towerCardPreview(long)].length).toBe(TOWER_CARD_PREVIEW_CHARS + 1) // + "…"
    expect(towerCardPreview('')).toBe('')
  })

  it('folds by lines and by characters', () => {
    expect(towerCardFold('a\nb')).toEqual({ folded: false, head: 'a\nb' })
    const many = Array.from({ length: TOWER_CARD_FOLD_LINES + 1 }, (_, i) => `l${i}`).join('\n')
    const byLines = towerCardFold(many)
    expect(byLines.folded).toBe(true)
    expect(byLines.head.split('\n')).toHaveLength(TOWER_CARD_FOLD_LINES)
    const wide = towerCardFold('x'.repeat(TOWER_CARD_FOLD_CHARS + 1))
    expect(wide).toEqual({ folded: true, head: 'x'.repeat(TOWER_CARD_FOLD_CHARS) })
  })
})

describe('order and merge', () => {
  it('pinned first, newest first within each', () => {
    const cards = [card('a', 1), card('b', 3), card('c', 2, { pinned: true }), card('d', 4, { pinned: true })]
    expect(orderTowerCards(cards).map(c => c.id)).toEqual(['d', 'c', 'b', 'a'])
  })

  it('one source: no labels; several: each card labelled with its tab title', () => {
    const one = towerCardsForSection([{ terminalId: 't', title: 'T', entry: entry([card('a', 1)]) }])
    expect(one[0].sourceTitle).toBeUndefined()
    const merged = towerCardsForSection([
      { terminalId: 'p1', title: 'P1', entry: entry([card('a', 1)]) },
      { terminalId: 'p2', title: 'P2', entry: entry([card('b', 2)]) },
      { terminalId: 'p3', title: 'P3', entry: null },
    ])
    expect(merged.map(c => [c.id, c.sourceTitle])).toEqual([['b', 'P2'], ['a', 'P1']])
  })
})

describe('notes and badge', () => {
  it('G7: stops without a message and no card', () => {
    expect(TOWER_CARDS_MIN_CLAUDE_VERSION).toBe('2.1.47')
    expect(showsClaudeTooOldHint(entry([], 1))).toBe(true)
    expect(showsClaudeTooOldHint(entry([card('a', 1)], 1))).toBe(false)
    expect(showsClaudeTooOldHint(entry([], 0))).toBe(false)
    expect(showsClaudeTooOldHint(null)).toBe(false)
  })

  it('codex: the role payload wins over the tab preset', () => {
    expect(isCodexTower({ agentPreset: 'codex-cli' })).toBe(true)
    expect(isCodexTower({ agent: 'codex', agentPreset: 'claude-cli' })).toBe(true)
    expect(isCodexTower({ agent: 'claude-cli', agentPreset: 'codex-cli' })).toBe(false)
    expect(isCodexTower({ agentPreset: 'claude-cli' })).toBe(false)
    expect(isCodexTower({})).toBe(false)
  })

  it('thumbnail count only while the tab counts', () => {
    expect(towerCardsBadgeCount(3, true)).toBe(3)
    expect(towerCardsBadgeCount(3, false)).toBe(0)
    expect(towerCardsBadgeCount(0, true)).toBe(0)
  })

  it('time HH:MM, bad input safe', () => {
    expect(towerCardTime(new Date(2026, 10, 25, 3, 7).getTime())).toBe('03:07')
    expect(towerCardTime(Number.NaN)).toBe('--:--')
  })
})

describe('panel Tower (T0909 Q-1 A)', () => {
  const tabs = [
    { id: 'p1', agentPreset: 'claude-code' },
    { id: 'p2', agentPreset: 'claude-code-worktree' },
    { id: 'cx', agentPreset: 'codex-agent' },
    { id: 'cli', agentPreset: 'claude-cli' },
    { id: 'none' },
  ]

  it('state file 2 and no declared Tower → every Claude Agent panel', () => {
    expect(CLAUDE_PANEL_PRESETS).toEqual(['claude-code', 'claude-code-worktree'])
    expect(workspaceHasPanelTowers(2, 0)).toBe(true)
    expect(panelTowerTerminalIds(tabs, 2, 0)).toEqual(['p1', 'p2'])
  })

  it.each([
    ['a declared Tower tab', 2, 1],
    ['state file v1', 1, 0],
    ['no bat_contract', null, 0],
    ['state file unread', undefined, 0],
    ['state file newer', 3, 0],
  ])('%s → none', (_why, state, declared) => {
    expect(workspaceHasPanelTowers(state as number | null | undefined, declared as number)).toBe(false)
    expect(panelTowerTerminalIds(tabs, state as number | null | undefined, declared as number)).toEqual([])
  })
})
