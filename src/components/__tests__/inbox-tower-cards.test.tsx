/**
 * PLAN-068 W6 / T0909: the「💬 塔台訊息」section of the Inbox tab and the thumbnail `💬N`.
 *
 * - cards of the selected Tower: newest first, pinned on top, ● unread, open = read (host call),
 *   📌 pin (PIN_LIMIT line), 「全部已讀」, 「清除」, long text folds, truncated marker
 * - 🔴 plain text: HTML in a card is shown as text, never parsed
 * - `⏸ 待你決定：` / `🙋 待你執行：` lines highlighted (a hint only)
 * - unread count on the section title only; 🔴 the tab title number does not change
 * - codex Tower → the fixed line; G7 (stops without a message, no card) → "claude too old"
 * - no declared Tower + state file 2 → the workspace's Claude panels' cards merged (T0909 Q-1 A)
 * - mismatch → no section at all (whole tab gated)
 * - thumbnail `💬N`: a matching Tower / a panel Tower only
 */
import { act } from 'react'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import i18n from '../../i18n'
import en from '../../locales/en.json'
import { InboxPanel, InboxTabBadge } from '../InboxPanel'
import { TerminalThumbnail } from '../TerminalThumbnail'
import { workspaceStore } from '../../stores/workspace-store'
import { applyTowerContract, resetTowerContractStore } from '../../stores/tower-contract-store'
import { applyTowerCardsEntries, resetTowerCardsStore } from '../../stores/tower-cards-store'
import { createPanelTowerSync, resetPanelTowerStore } from '../../stores/panel-tower-store'
import { EMPTY_INBOX_FILES, resetInboxStore, setInboxFiles, type InboxFiles } from '../../stores/inbox-store'
import { parseTowerState } from '../../lib/ct-tower-overview'
import { INBOX_FOLDED_STORAGE_KEY } from '../../lib/inbox-model'
import { TOWER_CARD_FOLD_LINES } from '../../lib/tower-card-view'
import type { TowerCard, TowerCardsEntry } from '../../types/tower-cards'
import type { Workspace } from '../../types'

const WS_DIR = '/tmp/t0909-ws'

function files(stateContract: number | null): InboxFiles {
  const extra = stateContract === null ? '' : `bat_contract: ${stateContract}\n`
  return {
    ...EMPTY_INBOX_FILES,
    hasCtDir: true,
    state: { status: 'loaded', parsed: parseTowerState(`---\nschema_kind: tower-state\nsummary_version: 1\n${extra}---\n# 塔台\n`) },
  }
}

let seq = 0
function card(terminalId: string, text: string, extra: Partial<TowerCard> = {}): TowerCard {
  seq++
  return { id: `tc-x-${seq}`, terminalId, source: 'hook', text, truncated: false, createdAt: 1_000_000 + seq * 60_000, read: false, pinned: false, ...extra }
}

function entry(terminalId: string, cards: TowerCard[], extra: Partial<TowerCardsEntry> = {}): TowerCardsEntry {
  return { terminalId, alive: true, revision: ++seq, cards, unread: cards.filter(c => !c.read).length, stopsWithoutMessage: 0, ...extra }
}

let ws: Workspace
let cardsApi: {
  list: ReturnType<typeof vi.fn>
  markRead: ReturnType<typeof vi.fn>
  pin: ReturnType<typeof vi.fn>
  clear: ReturnType<typeof vi.fn>
  setPanelTower: ReturnType<typeof vi.fn>
  onChanged: ReturnType<typeof vi.fn>
}

beforeAll(async () => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
  await i18n.changeLanguage('en')
})

beforeEach(() => {
  cardsApi = {
    list: vi.fn(async () => ({ ok: true, entries: [] })),
    markRead: vi.fn(async () => ({ ok: true, changed: 1 })),
    pin: vi.fn(async () => ({ ok: true, changed: 1 })),
    clear: vi.fn(async () => ({ ok: true, changed: 1 })),
    setPanelTower: vi.fn(async () => ({ ok: true, changed: 1 })),
    onChanged: vi.fn(() => () => {}),
  }
  ;(window as unknown as { electronAPI: unknown }).electronAPI = {
    fs: { resetWatch: vi.fn(async () => true) },
    debug: { log: vi.fn() },
    pty: { onNotifyHoldChanged: vi.fn(() => () => {}), notifyHoldList: vi.fn(async () => []), onOutput: vi.fn(() => () => {}) },
    claude: { onMessage: vi.fn(() => () => {}), onStream: vi.fn(() => () => {}) },
    agent: { getDefinition: vi.fn(async () => null) },
    towerCards: cardsApi,
  }
  localStorage.removeItem(INBOX_FOLDED_STORAGE_KEY)
  ws = workspaceStore.addWorkspace('T0909', WS_DIR)
})

afterEach(() => {
  cleanup()
  act(() => {
    workspaceStore.removeWorkspace(ws.id)
    resetTowerContractStore()
    resetTowerCardsStore()
    resetPanelTowerStore()
    resetInboxStore()
  })
  delete (window as unknown as { electronAPI?: unknown }).electronAPI
})

afterAll(async () => {
  vi.unstubAllGlobals()
  await i18n.changeLanguage('en')
})

function tower(title: string, towerContract: number | null, preset = 'claude-cli', agent?: string) {
  const terminal = workspaceStore.addTerminal(ws.id, preset)
  workspaceStore.setAutoTitle(terminal.id, title)
  applyTowerContract({ id: terminal.id, role: 'tower', towerContract: towerContract ?? undefined, ...(agent ? { agent } : {}) })
  return terminal
}

function renderPanel() {
  return render(
    <>
      <span data-testid="tab">Inbox<InboxTabBadge workspaceId={ws.id} workspaceFolderPath={WS_DIR} /></span>
      <InboxPanel workspaceId={ws.id} workspaceFolderPath={WS_DIR} />
    </>,
  )
}

const section = () => document.querySelector('[data-inbox-section="messages"]') as HTMLElement | null
const cardEls = () => Array.from(document.querySelectorAll('[data-tower-card]')) as HTMLElement[]
const badge = () => document.querySelector('[data-inbox-badge]')?.getAttribute('data-inbox-badge') ?? null

describe('cards of the selected Tower', () => {
  it('newest first, pinned on top, ● unread, unread count on the section title only', () => {
    const t1 = tower('Claude CLI · Tower', 2)
    const older = card(t1.id, 'older message')
    const pinned = card(t1.id, 'pinned message', { pinned: true, read: true })
    const newer = card(t1.id, 'newer message')
    act(() => {
      setInboxFiles(WS_DIR, files(2))
      applyTowerCardsEntries([entry(t1.id, [older, pinned, newer])])
    })
    renderPanel()
    expect(cardEls().map(el => el.getAttribute('data-tower-card'))).toEqual([pinned.id, newer.id, older.id])
    expect(section()?.textContent).toContain(i18n.t('inbox.cards.unread', { count: 2 }))
    expect(cardEls()[1].textContent).toContain('●')
    expect(cardEls()[0].textContent).toContain('📌')
    // 🔴 the tab title number is not the unread count: no BUGs / Worker waits → no number at all
    expect(badge()).toBeNull()
  })

  it('opening an unread card marks it read on the host; opening a read card does not', () => {
    const t1 = tower('T', 2)
    const unread = card(t1.id, 'first line\nsecond line')
    const read = card(t1.id, 'already read', { read: true })
    act(() => {
      setInboxFiles(WS_DIR, files(2))
      applyTowerCardsEntries([entry(t1.id, [unread, read])])
    })
    renderPanel()
    const toggleOf = (id: string) => document.querySelector(`[data-tower-card="${id}"] .tower-card-toggle`) as HTMLElement
    fireEvent.click(toggleOf(unread.id))
    expect(cardsApi.markRead).toHaveBeenCalledWith(t1.id, [unread.id])
    expect(document.querySelector(`[data-tower-card="${unread.id}"] .tower-card-body`)?.textContent).toContain('second line')
    fireEvent.click(toggleOf(read.id))
    expect(cardsApi.markRead).toHaveBeenCalledTimes(1)
  })

  it('pin / unpin go to the host; PIN_LIMIT shows the limit', async () => {
    const t1 = tower('T', 2)
    const c = card(t1.id, 'msg')
    act(() => {
      setInboxFiles(WS_DIR, files(2))
      applyTowerCardsEntries([entry(t1.id, [c])])
    })
    cardsApi.pin.mockResolvedValueOnce({ ok: false, code: 'PIN_LIMIT' })
    renderPanel()
    await act(async () => { fireEvent.click(document.querySelector('.tower-card-pin') as HTMLElement) })
    expect(cardsApi.pin).toHaveBeenCalledWith(t1.id, c.id, true)
    expect(screen.getByRole('status').textContent).toBe(i18n.t('inbox.cards.pinLimit', { limit: 10 }))
  })

  it('「全部已讀」and「清除」(unpinned only) go to the host', () => {
    const t1 = tower('T', 2)
    act(() => {
      setInboxFiles(WS_DIR, files(2))
      applyTowerCardsEntries([entry(t1.id, [card(t1.id, 'a'), card(t1.id, 'b')])])
    })
    renderPanel()
    fireEvent.click(screen.getByText(en.inbox.cards.markAllRead))
    expect(cardsApi.markRead).toHaveBeenCalledWith(t1.id)
    fireEvent.click(screen.getByText(en.inbox.cards.clear))
    expect(cardsApi.clear).toHaveBeenCalledWith(t1.id)
  })

  it('🔴 plain text: HTML is shown as text, never parsed', () => {
    const t1 = tower('T', 2)
    const html = '<img src=x onerror="alert(1)"><b>bold</b>'
    const c = card(t1.id, html)
    act(() => {
      setInboxFiles(WS_DIR, files(2))
      applyTowerCardsEntries([entry(t1.id, [c])])
    })
    renderPanel()
    fireEvent.click(document.querySelector('.tower-card-toggle') as HTMLElement)
    expect(section()?.querySelector('img')).toBeNull()
    expect(section()?.querySelector('b')).toBeNull()
    expect(document.querySelector('.tower-card-body')?.textContent).toContain(html)
  })

  it('highlights `⏸ 待你決定：` / `🙋 待你執行：` lines, collapsed and open', () => {
    const t1 = tower('T', 2)
    const c = card(t1.id, 'T0906 完成\n⏸ 待你決定：U-3 選 A 或 B\n- 🙋 待你執行：A-2 重裝驗收\n普通的行')
    act(() => {
      setInboxFiles(WS_DIR, files(2))
      applyTowerCardsEntries([entry(t1.id, [c])])
    })
    renderPanel()
    const highlighted = () => Array.from(document.querySelectorAll('[data-tower-card-highlight="true"]')).map(el => el.textContent)
    expect(highlighted()).toEqual(['⏸ 待你決定：U-3 選 A 或 B', '- 🙋 待你執行：A-2 重裝驗收'])
    fireEvent.click(document.querySelector('.tower-card-toggle') as HTMLElement)
    expect(highlighted()).toEqual(['⏸ 待你決定：U-3 選 A 或 B', '- 🙋 待你執行：A-2 重裝驗收'])
    expect(document.querySelectorAll('.tower-card-body .tower-card-line').length).toBe(4)
  })

  it('long text folds until「顯示全部」; a truncated card is marked', () => {
    const t1 = tower('T', 2)
    const lines = Array.from({ length: TOWER_CARD_FOLD_LINES + 10 }, (_, i) => `line ${i}`)
    const c = card(t1.id, lines.join('\n'), { truncated: true })
    act(() => {
      setInboxFiles(WS_DIR, files(2))
      applyTowerCardsEntries([entry(t1.id, [c])])
    })
    renderPanel()
    expect(document.querySelector('[data-tower-card-truncated]')?.textContent).toBe(en.inbox.cards.truncated)
    fireEvent.click(document.querySelector('.tower-card-toggle') as HTMLElement)
    expect(document.querySelectorAll('.tower-card-body .tower-card-line').length).toBe(TOWER_CARD_FOLD_LINES)
    fireEvent.click(screen.getByText(en.inbox.cards.showAll))
    expect(document.querySelectorAll('.tower-card-body .tower-card-line').length).toBe(lines.length)
  })
})

describe('notes', () => {
  it('codex Tower: the fixed line, no cards', () => {
    tower('Codex CLI · Tower', 2, 'codex-cli')
    act(() => setInboxFiles(WS_DIR, files(2)))
    renderPanel()
    expect(document.querySelector('[data-tower-cards-note="codex"]')?.textContent).toBe(en.inbox.cards.codexNote)
  })

  it('codex named by the role payload (`--agent codex`) counts too', () => {
    tower('Tower', 2, 'none', 'codex')
    act(() => setInboxFiles(WS_DIR, files(2)))
    renderPanel()
    expect(document.querySelector('[data-tower-cards-note="codex"]')).not.toBeNull()
  })

  it('G7: stops without a message and no card → claude too old (2.1.47)', () => {
    const t1 = tower('T', 2)
    act(() => {
      setInboxFiles(WS_DIR, files(2))
      applyTowerCardsEntries([entry(t1.id, [], { stopsWithoutMessage: 2 })])
    })
    renderPanel()
    expect(document.querySelector('[data-tower-cards-note="claude-too-old"]')?.textContent).toBe(i18n.t('inbox.cards.claudeTooOld', { version: '2.1.47' }))
  })

  it('G7 hint goes away once a card exists', () => {
    const t1 = tower('T', 2)
    act(() => {
      setInboxFiles(WS_DIR, files(2))
      applyTowerCardsEntries([entry(t1.id, [card(t1.id, 'x')], { stopsWithoutMessage: 2 })])
    })
    renderPanel()
    expect(document.querySelector('[data-tower-cards-note]')).toBeNull()
  })

  it('codex / G7 text in three languages', () => {
    for (const lang of ['en', 'zh-TW', 'zh-CN']) {
      expect(i18n.getResource(lang, 'translation', 'inbox.cards.codexNote')).toMatch(/codex/)
      expect(i18n.getResource(lang, 'translation', 'inbox.cards.claudeTooOld')).toContain('{{version}}')
    }
  })
})

describe('version gate and panel Towers', () => {
  it('mismatch (P-1): no 💬 section at all', () => {
    const t1 = tower('T', null)
    act(() => {
      setInboxFiles(WS_DIR, files(2))
      applyTowerCardsEntries([entry(t1.id, [card(t1.id, 'kept from before')])])
    })
    renderPanel()
    expect(section()).toBeNull()
    expect(cardEls()).toEqual([])
  })

  it('no declared Tower, state file 2: the workspace Claude panels are merged, each card labelled', () => {
    const p1 = workspaceStore.addTerminal(ws.id, 'claude-code')
    workspaceStore.setAutoTitle(p1.id, 'Panel A')
    const p2 = workspaceStore.addTerminal(ws.id, 'claude-code-worktree')
    workspaceStore.setAutoTitle(p2.id, 'Panel B')
    const codexPanel = workspaceStore.addTerminal(ws.id, 'codex-agent')
    act(() => {
      setInboxFiles(WS_DIR, files(2))
      applyTowerCardsEntries([
        entry(p1.id, [card(p1.id, 'from A', { source: 'panel' })]),
        entry(p2.id, [card(p2.id, 'from B', { source: 'panel' })]),
        entry(codexPanel.id, [card(codexPanel.id, 'never shown', { source: 'panel' })]),
      ])
    })
    renderPanel()
    expect(cardEls().map(el => el.querySelector('.tower-card-source')?.textContent)).toEqual(['Panel B', 'Panel A'])
    expect(section()?.textContent).not.toContain('never shown')
  })
})

describe('thumbnail 💬N', () => {
  const thumb = (id: string) => {
    const terminal = workspaceStore.getState().terminals.find(tm => tm.id === id)!
    return render(<TerminalThumbnail terminal={terminal} isActive={false} onClick={() => {}} />)
  }
  const unreadBadge = () => document.querySelector('[data-tower-cards-unread]')?.getAttribute('data-tower-cards-unread') ?? null

  it('a matching Tower shows its unread count', () => {
    const t1 = tower('T', 2)
    act(() => { applyTowerCardsEntries([entry(t1.id, [card(t1.id, 'a'), card(t1.id, 'b', { read: true }), card(t1.id, 'c')])]) })
    thumb(t1.id)
    expect(unreadBadge()).toBe('2')
    expect(document.querySelector('[data-tower-cards-unread]')?.textContent).toBe('💬2')
  })

  it('a Tower that no longer matches shows none (cards kept by the host until the PTY ends)', () => {
    const t1 = tower('T', null)
    act(() => { applyTowerCardsEntries([entry(t1.id, [card(t1.id, 'a')])]) })
    thumb(t1.id)
    expect(unreadBadge()).toBeNull()
  })

  it('a panel Tower (decided by this window) shows it; any other panel does not', () => {
    const p1 = workspaceStore.addTerminal(ws.id, 'claude-code')
    act(() => {
      applyTowerCardsEntries([entry(p1.id, [card(p1.id, 'a', { source: 'panel' })])])
    })
    const { unmount } = thumb(p1.id)
    expect(unreadBadge()).toBeNull()
    unmount()
    act(() => { createPanelTowerSync({ setPanelTower: async () => ({ ok: true, changed: 1 }) }).apply(new Map([[p1.id, true]])) })
    thumb(p1.id)
    expect(unreadBadge()).toBe('1')
  })
})
