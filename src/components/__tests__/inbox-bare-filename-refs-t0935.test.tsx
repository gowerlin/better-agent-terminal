/**
 * T0935: file names written without a `/` in the「待辦」(Inbox) tab link when the file exists in the
 * workspace root or in `_ct-workorders/` (T0930's existence check, display and click path, reused).
 *
 * - `(_reply-….md)`, `` `package.json` ``, `README.md` in a sentence: links, open the resolved path
 * - root first, then `_ct-workorders/`
 * - a missing name, a version number and a domain name with no such file stay plain text; the text
 *   itself never changes
 * - the same in a「💬 塔台訊息」card (open card body)
 * All paths are made up.
 */
import { act } from 'react'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import i18n from '../../i18n'
import { InboxPanel } from '../InboxPanel'
import { workspaceStore } from '../../stores/workspace-store'
import { applyTowerContract, resetTowerContractStore } from '../../stores/tower-contract-store'
import { applyTowerCardsEntries, resetTowerCardsStore } from '../../stores/tower-cards-store'
import { resetPanelTowerStore } from '../../stores/panel-tower-store'
import { resetNotifyHoldStore } from '../../stores/notify-hold-store'
import { EMPTY_INBOX_FILES, resetInboxStore, setInboxFiles, type InboxFiles } from '../../stores/inbox-store'
import { resetDirWatches } from '../../stores/ct-dir-watch'
import { parseTowerState, parseTowerStateInbox } from '../../lib/ct-tower-overview'
import { INBOX_FOLDED_STORAGE_KEY } from '../../lib/inbox-model'
import type { TowerCard } from '../../types/tower-cards'
import type { Workspace } from '../../types'

const WS_DIR = '/tmp/t0935-ws'
const CT = `${WS_DIR}/_ct-workorders`

const AWAITING = '比較 `package.json` 與 README.md，版本 0.8.0、v1.2，見 example.org 與 missing-notes.md'
const ACTION = '回覆對方專案 (_reply-2026-11-26-topic.md)'
const REMINDER = '更新 CHANGELOG.md。'

const STATE = `---
schema_kind: tower-state
summary_version: 1
bat_contract: 2
awaiting_user:
  - id: "U-1"
    summary: "${AWAITING}"
    options: ["A ok", "B no"]
user_actions:
  - id: "A-1"
    title: "${ACTION}"
reminders:
  - id: "weekly"
    title: "${REMINDER}"
    due_at: "2000-01-01"
---
# 塔台
`

// README.md exists in both places: the root wins. The reply file is only in _ct-workorders/.
const EXISTING = new Set([
  `${WS_DIR}/package.json`,
  `${WS_DIR}/README.md`,
  `${CT}/README.md`,
  `${CT}/_reply-2026-11-26-topic.md`,
  `${WS_DIR}/CHANGELOG.md`,
])

function files(): InboxFiles {
  return {
    ...EMPTY_INBOX_FILES,
    hasCtDir: true,
    state: { status: 'loaded', parsed: parseTowerState(STATE) },
    lists: parseTowerStateInbox(STATE),
    waitingOrders: [],
    userInbox: 'on',
  }
}

let ws: Workspace
let towerId: string
let fsApi: { readdir: ReturnType<typeof vi.fn>; stat: ReturnType<typeof vi.fn> }

beforeAll(async () => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
  await i18n.changeLanguage('en')
})

beforeEach(() => {
  fsApi = {
    readdir: vi.fn(async () => []),
    stat: vi.fn(async (path: string) => (EXISTING.has(path) ? { mtimeMs: 1, size: 1 } : null)),
  }
  ;(window as unknown as { electronAPI: unknown }).electronAPI = {
    fs: { ...fsApi, readFile: vi.fn(async () => ({ error: 'x' })), watch: vi.fn(async () => true), unwatch: vi.fn(async () => true), resetWatch: vi.fn(async () => true), onChanged: vi.fn(() => () => {}) },
    debug: { log: vi.fn() },
    pty: { onNotifyHoldChanged: vi.fn(() => () => {}), notifyHoldList: vi.fn(async () => []), onOutput: vi.fn(() => () => {}) },
    claude: { onMessage: vi.fn(() => () => {}), onStream: vi.fn(() => () => {}) },
    agent: { getDefinition: vi.fn(async () => null) },
    ctConfig: { readSources: vi.fn(async () => ({ global: { status: 'missing' }, defaults: { status: 'missing' } })) },
    towerInbox: { answer: vi.fn(async () => ({ ok: true, held: false, holdId: 'h-1' })) },
    towerCards: {
      list: vi.fn(async () => ({ ok: true, entries: [] })),
      markRead: vi.fn(async () => ({ ok: true, changed: 1 })),
      pin: vi.fn(async () => ({ ok: true, changed: 1 })),
      clear: vi.fn(async () => ({ ok: true, changed: 1 })),
      setPanelTower: vi.fn(async () => ({ ok: true, changed: 1 })),
      onChanged: vi.fn(() => () => {}),
    },
  }
  localStorage.removeItem(INBOX_FOLDED_STORAGE_KEY)
  ws = workspaceStore.addWorkspace('T0935', WS_DIR)
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

function renderPanel(cards: TowerCard[] = []) {
  act(() => {
    setInboxFiles(WS_DIR, files())
    if (cards.length) {
      applyTowerCardsEntries([{ terminalId: towerId, alive: true, revision: 1, cards, unread: cards.length, stopsWithoutMessage: 0 }])
    }
  })
  render(<InboxPanel workspaceId={ws.id} workspaceFolderPath={WS_DIR} />)
}

const el = (selector: string) => document.querySelector(selector) as HTMLElement
const linksIn = (root: Element) => Array.from(root.querySelectorAll('[data-inbox-file-ref]')).map(a => [a.textContent, a.getAttribute('data-inbox-file-ref')])

function recordEvents() {
  const seen: Array<[string, unknown]> = []
  const onTab = (e: Event) => seen.push(['workspace-switch-tab', (e as CustomEvent).detail])
  const onReveal = (e: Event) => seen.push(['file-tree-reveal', (e as CustomEvent).detail])
  window.addEventListener('workspace-switch-tab', onTab)
  window.addEventListener('file-tree-reveal', onReveal)
  return { seen, stop: () => { window.removeEventListener('workspace-switch-tab', onTab); window.removeEventListener('file-tree-reveal', onReveal) } }
}

describe('file names without a slash', () => {
  it('existing names link (root first); missing names, versions and domains stay text', async () => {
    renderPanel()
    const summary = el('[data-inbox-summary="U-1"]')
    await waitFor(() => expect(linksIn(summary)).toEqual([
      ['package.json', 'package.json'],
      ['README.md', 'README.md'],
    ]))
    expect(summary.textContent).toBe(AWAITING)
    // the domain and the missing name were checked (root, then _ct-workorders/) and did not link
    const statted = fsApi.stat.mock.calls.map(call => call[0] as string)
    expect(statted).toContain(`${WS_DIR}/example.org`)
    expect(statted).toContain(`${CT}/missing-notes.md`)
    expect(statted.some(path => path.includes('0.8.0') || path.includes('v1.2'))).toBe(false)
    expect(statted.every(path => path.startsWith(`${WS_DIR}/`))).toBe(true)
  })

  it('a name only in _ct-workorders/ links there; a sentence-final name without its period', async () => {
    renderPanel()
    const action = el('[data-inbox-action="A-1"]')
    await waitFor(() => expect(linksIn(action)).toEqual([['_reply-2026-11-26-topic.md', '_ct-workorders/_reply-2026-11-26-topic.md']]))
    const reminder = el('[data-inbox-reminder="weekly"]')
    await waitFor(() => expect(linksIn(reminder)).toEqual([['CHANGELOG.md', 'CHANGELOG.md']]))
    expect(reminder.textContent).toContain(REMINDER)
  })

  it('a click opens the resolved file in the Files tab', async () => {
    renderPanel()
    const action = el('[data-inbox-action="A-1"]')
    await waitFor(() => expect(linksIn(action).length).toBe(1))
    await waitFor(() => expect(linksIn(el('[data-inbox-summary="U-1"]')).length).toBe(2))
    const events = recordEvents()
    fireEvent.click(action.querySelector('[data-inbox-file-ref]')!)
    fireEvent.click(el('[data-inbox-summary="U-1"] [data-inbox-file-ref="package.json"]'))
    events.stop()
    expect(events.seen).toEqual([
      ['workspace-switch-tab', { tab: 'files' }],
      ['file-tree-reveal', { path: `${CT}/_reply-2026-11-26-topic.md` }],
      ['workspace-switch-tab', { tab: 'files' }],
      ['file-tree-reveal', { path: `${WS_DIR}/package.json` }],
    ])
  })

  it('an open 💬 card links names in its body', async () => {
    const text = ['已寫好回覆 (_reply-2026-11-26-topic.md)', '另見 nothing-here.md 與 github.com'].join('\n')
    const c: TowerCard = { id: 'tc-t0935-1', terminalId: towerId, source: 'hook', text, truncated: false, createdAt: 1_000_000, read: false, pinned: false }
    renderPanel([c])
    const card = el(`[data-tower-card="${c.id}"]`)
    fireEvent.click(card.querySelector('.tower-card-toggle')!)
    const body = card.querySelector('.tower-card-body')!
    await waitFor(() => expect(linksIn(body)).toEqual([['_reply-2026-11-26-topic.md', '_ct-workorders/_reply-2026-11-26-topic.md']]))
    expect(Array.from(body.querySelectorAll('.tower-card-line')).map(line => line.textContent)).toEqual(text.split('\n'))
  })
})
