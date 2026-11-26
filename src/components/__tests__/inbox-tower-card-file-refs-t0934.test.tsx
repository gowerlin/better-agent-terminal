/**
 * T0934: file references in the「💬 塔台訊息」cards open in the「檔案」tab (T0930's recognition,
 * existence check and display, reused).
 *
 * - a collapsed card: its highlighted lines link; the one-line preview inside the toggle button stays
 *   plain text (no button inside the button)
 * - an open card: the shown lines link (found paths / ids only; missing, outside, URLs stay text);
 *   the text itself never changes
 * - a click dispatches `workspace-switch-tab` (files) + `file-tree-reveal` and does not toggle the
 *   card, mark it read or pin it
 * - a folded card checks only its head until「顯示全部」
 * - without a workspace folder nothing is checked
 * All paths are made up.
 */
import { act } from 'react'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import i18n from '../../i18n'
import en from '../../locales/en.json'
import { InboxPanel } from '../InboxPanel'
import { TowerCardsSection } from '../inbox/TowerCardsSection'
import { workspaceStore } from '../../stores/workspace-store'
import { applyTowerContract, resetTowerContractStore } from '../../stores/tower-contract-store'
import { applyTowerCardsEntries, resetTowerCardsStore } from '../../stores/tower-cards-store'
import { resetPanelTowerStore } from '../../stores/panel-tower-store'
import { resetNotifyHoldStore } from '../../stores/notify-hold-store'
import { EMPTY_INBOX_FILES, resetInboxStore, setInboxFiles, type InboxFiles } from '../../stores/inbox-store'
import { resetDirWatches } from '../../stores/ct-dir-watch'
import { parseTowerState } from '../../lib/ct-tower-overview'
import { INBOX_FOLDED_STORAGE_KEY } from '../../lib/inbox-model'
import { TOWER_CARD_FOLD_LINES } from '../../lib/tower-card-view'
import type { TowerCard, TowerCardsEntry } from '../../types/tower-cards'
import type { Workspace } from '../../types'

const WS_DIR = '/tmp/t0934-ws'
const CT = `${WS_DIR}/_ct-workorders`

const EXISTING = new Set([
  `${WS_DIR}/docs/sample/guide.md`,
  `${WS_DIR}/docs/tail/late.md`,
  `${CT}/_decision-log.md`,
])
const LISTINGS: Record<string, Array<{ name: string; path: string; isDirectory: boolean }>> = {
  [CT]: [{ name: 'T0901-sample-order.md', path: `${CT}/T0901-sample-order.md`, isDirectory: false }],
}

function files(): InboxFiles {
  return {
    ...EMPTY_INBOX_FILES,
    hasCtDir: true,
    state: { status: 'loaded', parsed: parseTowerState('---\nschema_kind: tower-state\nsummary_version: 1\nbat_contract: 2\n---\n# 塔台\n') },
  }
}

let seq = 0
function card(terminalId: string, text: string, extra: Partial<TowerCard> = {}): TowerCard {
  seq++
  return { id: `tc-r-${seq}`, terminalId, source: 'hook', text, truncated: false, createdAt: 1_000_000 + seq * 60_000, read: false, pinned: false, ...extra }
}

function entry(terminalId: string, cards: TowerCard[]): TowerCardsEntry {
  return { terminalId, alive: true, revision: ++seq, cards, unread: cards.filter(c => !c.read).length, stopsWithoutMessage: 0 }
}

let ws: Workspace
let towerId: string
let fsApi: { readdir: ReturnType<typeof vi.fn>; stat: ReturnType<typeof vi.fn> }
let cardsApi: Record<'list' | 'markRead' | 'pin' | 'clear' | 'setPanelTower' | 'onChanged', ReturnType<typeof vi.fn>>

beforeAll(async () => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
  await i18n.changeLanguage('en')
})

beforeEach(() => {
  fsApi = {
    readdir: vi.fn(async (dir: string) => LISTINGS[dir] ?? []),
    stat: vi.fn(async (path: string) => (EXISTING.has(path) ? { mtimeMs: 1, size: 1 } : null)),
  }
  cardsApi = {
    list: vi.fn(async () => ({ ok: true, entries: [] })),
    markRead: vi.fn(async () => ({ ok: true, changed: 1 })),
    pin: vi.fn(async () => ({ ok: true, changed: 1 })),
    clear: vi.fn(async () => ({ ok: true, changed: 1 })),
    setPanelTower: vi.fn(async () => ({ ok: true, changed: 1 })),
    onChanged: vi.fn(() => () => {}),
  }
  ;(window as unknown as { electronAPI: unknown }).electronAPI = {
    fs: { ...fsApi, readFile: vi.fn(async () => ({ error: 'x' })), watch: vi.fn(async () => true), unwatch: vi.fn(async () => true), resetWatch: vi.fn(async () => true), onChanged: vi.fn(() => () => {}) },
    debug: { log: vi.fn() },
    pty: { onNotifyHoldChanged: vi.fn(() => () => {}), notifyHoldList: vi.fn(async () => []), onOutput: vi.fn(() => () => {}) },
    claude: { onMessage: vi.fn(() => () => {}), onStream: vi.fn(() => () => {}) },
    agent: { getDefinition: vi.fn(async () => null) },
    ctConfig: { readSources: vi.fn(async () => ({ global: { status: 'missing' }, defaults: { status: 'missing' } })) },
    towerCards: cardsApi,
  }
  localStorage.removeItem(INBOX_FOLDED_STORAGE_KEY)
  ws = workspaceStore.addWorkspace('T0934', WS_DIR)
  const terminal = workspaceStore.addTerminal(ws.id, 'claude-cli')
  workspaceStore.setAutoTitle(terminal.id, 'Tower')
  applyTowerContract({ id: terminal.id, role: 'tower', towerContract: 2 })
  towerId = terminal.id
})

afterEach(() => {
  cleanup()
  act(() => {
    workspaceStore.removeWorkspace(ws.id)
    resetTowerContractStore()
    resetTowerCardsStore()
    resetPanelTowerStore()
    resetNotifyHoldStore()
    resetInboxStore()
  })
  resetDirWatches()
  delete (window as unknown as { electronAPI?: unknown }).electronAPI
})

afterAll(async () => {
  vi.unstubAllGlobals()
  await i18n.changeLanguage('en')
})

function renderWith(cards: TowerCard[]) {
  act(() => {
    setInboxFiles(WS_DIR, files())
    applyTowerCardsEntries([entry(towerId, cards)])
  })
  render(<InboxPanel workspaceId={ws.id} workspaceFolderPath={WS_DIR} />)
}

const cardEl = (id: string) => document.querySelector(`[data-tower-card="${id}"]`) as HTMLElement
const toggleOf = (id: string) => cardEl(id).querySelector('.tower-card-toggle') as HTMLButtonElement
const linksIn = (root: Element) => Array.from(root.querySelectorAll('[data-inbox-file-ref]')).map(a => [a.textContent, a.getAttribute('data-inbox-file-ref')])

function recordEvents() {
  const seen: Array<[string, unknown]> = []
  const onTab = (e: Event) => seen.push(['workspace-switch-tab', (e as CustomEvent).detail])
  const onReveal = (e: Event) => seen.push(['file-tree-reveal', (e as CustomEvent).detail])
  window.addEventListener('workspace-switch-tab', onTab)
  window.addEventListener('file-tree-reveal', onReveal)
  return { seen, stop: () => { window.removeEventListener('workspace-switch-tab', onTab); window.removeEventListener('file-tree-reveal', onReveal) } }
}

const HIGHLIGHT = '⏸ 待你決定：U-1 看 `docs/sample/guide.md` 與 T0901'
const TEXT = [
  'T0901 完成，報告在 docs/sample/guide.md',
  HIGHLIGHT,
  '另見 D370、docs/sample/missing.md、https://example.test/docs/x.md、`../outside/a.md`、/elsewhere/b.md、T0999',
].join('\n')

describe('a collapsed card', () => {
  it('its highlighted line links; the preview inside the toggle stays plain text', async () => {
    const c = card(towerId, TEXT)
    renderWith([c])
    const highlight = cardEl(c.id).querySelector('[data-tower-card-highlight="true"]')!
    await waitFor(() => expect(linksIn(highlight)).toEqual([
      ['docs/sample/guide.md', 'docs/sample/guide.md'],
      ['T0901', '_ct-workorders/T0901-sample-order.md'],
    ]))
    expect(highlight.textContent).toBe(HIGHLIGHT)
    // 🔴 no interactive element inside the toggle button; the preview has no link
    const toggle = toggleOf(c.id)
    expect(toggle.querySelectorAll('button, a, [data-inbox-file-ref]').length).toBe(0)
    expect(toggle.querySelector('.tower-card-preview')?.textContent).toBe('T0901 完成，報告在 docs/sample/guide.md')
    // only the shown highlight was checked: the body's D370 / T0999 were not looked up
    expect(fsApi.stat.mock.calls.some(call => String(call[0]).endsWith('_decision-log.md'))).toBe(false)
  })

  it('a click on a highlight link opens the file, the card stays collapsed and unread', async () => {
    const c = card(towerId, TEXT)
    renderWith([c])
    const highlight = cardEl(c.id).querySelector('[data-tower-card-highlight="true"]')!
    await waitFor(() => expect(linksIn(highlight).length).toBe(2))
    const events = recordEvents()
    fireEvent.click(highlight.querySelector('[data-inbox-file-ref="docs/sample/guide.md"]')!)
    events.stop()
    expect(events.seen).toEqual([
      ['workspace-switch-tab', { tab: 'files' }],
      ['file-tree-reveal', { path: `${WS_DIR}/docs/sample/guide.md` }],
    ])
    expect(toggleOf(c.id).getAttribute('aria-expanded')).toBe('false')
    expect(cardEl(c.id).querySelector('.tower-card-body')).toBeNull()
    expect(cardsApi.markRead).not.toHaveBeenCalled()
    expect(cardsApi.pin).not.toHaveBeenCalled()
  })
})

describe('an open card', () => {
  it('found paths / ids link, the rest stays text, the text is unchanged', async () => {
    const c = card(towerId, TEXT)
    renderWith([c])
    fireEvent.click(toggleOf(c.id))
    const body = cardEl(c.id).querySelector('.tower-card-body')!
    // missing.md, the URL, `..`, the outside absolute path and T0999 are not links
    await waitFor(() => expect(linksIn(body)).toEqual([
      ['T0901', '_ct-workorders/T0901-sample-order.md'],
      ['docs/sample/guide.md', 'docs/sample/guide.md'],
      ['docs/sample/guide.md', 'docs/sample/guide.md'],
      ['T0901', '_ct-workorders/T0901-sample-order.md'],
      ['D370', '_ct-workorders/_decision-log.md'],
    ]))
    expect(Array.from(body.querySelectorAll('.tower-card-line')).map(line => line.textContent)).toEqual(TEXT.split('\n'))
    // nothing outside the workspace was even checked
    const statted = fsApi.stat.mock.calls.map(call => call[0] as string)
    expect(statted.every(path => path.startsWith(`${WS_DIR}/`))).toBe(true)
    expect(statted.some(path => path.includes('..') || path.includes('example.test'))).toBe(false)
  })

  it('a click opens the file; the card stays open, read once, not pinned', async () => {
    const c = card(towerId, TEXT)
    renderWith([c])
    fireEvent.click(toggleOf(c.id))
    expect(cardsApi.markRead).toHaveBeenCalledTimes(1)
    const body = cardEl(c.id).querySelector('.tower-card-body')!
    await waitFor(() => expect(linksIn(body).length).toBeGreaterThan(0))
    const events = recordEvents()
    fireEvent.click(body.querySelector('[data-inbox-file-ref="_ct-workorders/_decision-log.md"]')!)
    events.stop()
    expect(events.seen).toEqual([
      ['workspace-switch-tab', { tab: 'files' }],
      ['file-tree-reveal', { path: `${CT}/_decision-log.md` }],
    ])
    expect(toggleOf(c.id).getAttribute('aria-expanded')).toBe('true')
    expect(cardEl(c.id).querySelector('.tower-card-body')).not.toBeNull()
    expect(cardsApi.markRead).toHaveBeenCalledTimes(1)
    expect(cardsApi.pin).not.toHaveBeenCalled()
  })

  it('a folded card checks its head only until「顯示全部」', async () => {
    const lines = Array.from({ length: TOWER_CARD_FOLD_LINES + 5 }, (_, i) => `line ${i}`)
    lines[0] = 'head docs/sample/guide.md'
    lines[lines.length - 1] = 'tail docs/tail/late.md'
    const c = card(towerId, lines.join('\n'))
    renderWith([c])
    fireEvent.click(toggleOf(c.id))
    const body = () => cardEl(c.id).querySelector('.tower-card-body')!
    await waitFor(() => expect(linksIn(body())).toEqual([['docs/sample/guide.md', 'docs/sample/guide.md']]))
    expect(fsApi.stat.mock.calls.some(call => String(call[0]).includes('late.md'))).toBe(false)
    fireEvent.click(screen.getByText(en.inbox.cards.showAll))
    await waitFor(() => expect(linksIn(body())).toEqual([
      ['docs/sample/guide.md', 'docs/sample/guide.md'],
      ['docs/tail/late.md', 'docs/tail/late.md'],
    ]))
  })
})

describe('without a workspace folder', () => {
  it('nothing is checked and nothing links', async () => {
    const c = card(towerId, TEXT)
    act(() => { applyTowerCardsEntries([entry(towerId, [c])]) })
    render(<TowerCardsSection sources={[{ terminalId: towerId, title: 'Tower' }]} codex={false} folded={false} onToggle={() => {}} />)
    fireEvent.click(toggleOf(c.id))
    await Promise.resolve()
    expect(fsApi.stat).not.toHaveBeenCalled()
    expect(fsApi.readdir).not.toHaveBeenCalled()
    expect(document.querySelectorAll('[data-inbox-file-ref]').length).toBe(0)
    expect(cardEl(c.id).querySelector('.tower-card-body')?.textContent).toContain('docs/sample/guide.md')
  })
})
