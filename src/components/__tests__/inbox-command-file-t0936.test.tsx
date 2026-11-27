/**
 * T0936 / BUG-226: the `command` of a「🙋 待你執行」item in the「待辦」(Inbox) tab.
 *
 * - the command is one existing file (`soleFileRef`): a link and「開啟」, no「複製指令」; both open the
 *   resolved file in the Files tab
 * - the command is one missing file: plain text and「複製指令」, as before T0936
 * - a real command with an existing path in it: the path links,「複製指令」copies the whole command
 * - a quoted path with spaces and a CT id as the whole command are one file too
 * All paths are made up.
 */
import { act } from 'react'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import i18n from '../../i18n'
import en from '../../locales/en.json'
import { InboxPanel } from '../InboxPanel'
import { workspaceStore } from '../../stores/workspace-store'
import { applyTowerContract, resetTowerContractStore } from '../../stores/tower-contract-store'
import { resetTowerCardsStore } from '../../stores/tower-cards-store'
import { resetPanelTowerStore } from '../../stores/panel-tower-store'
import { resetNotifyHoldStore } from '../../stores/notify-hold-store'
import { EMPTY_INBOX_FILES, resetInboxStore, setInboxFiles, type InboxFiles } from '../../stores/inbox-store'
import { resetDirWatches } from '../../stores/ct-dir-watch'
import { parseTowerState, parseTowerStateInbox } from '../../lib/ct-tower-overview'
import { INBOX_FOLDED_STORAGE_KEY } from '../../lib/inbox-model'
import type { Workspace } from '../../types'

const WS_DIR = '/tmp/t0936-ws'
const CT = `${WS_DIR}/_ct-workorders`

const REPLY = '_ct-workorders/_reply-2026-11-27-topic.md'
const MISSING = '_ct-workorders/_reply-2026-11-27-missing.md'
const RUN = 'pwsh -File e2e/manual/check.ps1 -Out docs/missing.md'
const SPACED = '"docs/a b.md"'

const STATE = `---
schema_kind: tower-state
summary_version: 1
bat_contract: 2
user_actions:
  - id: "A-1"
    title: "審閱回覆稿"
    command: "${REPLY}"
  - id: "A-2"
    title: "審閱另一份回覆稿"
    command: "${MISSING}"
  - id: "A-3"
    title: "跑檢查"
    command: "${RUN}"
  - id: "A-4"
    title: "看說明"
    command: '${SPACED}'
  - id: "A-5"
    title: "看工單"
    command: "T0936"
---
# 塔台
`

const EXISTING = new Set([
  `${WS_DIR}/${REPLY}`,
  `${WS_DIR}/e2e/manual/check.ps1`,
  `${WS_DIR}/docs/a b.md`,
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
let writeText: ReturnType<typeof vi.fn>
let answer: ReturnType<typeof vi.fn>

beforeAll(async () => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
  await i18n.changeLanguage('en')
})

beforeEach(() => {
  writeText = vi.fn(async () => {})
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
  answer = vi.fn(async () => ({ ok: true, held: false, holdId: 'h-1' }))
  const readdir = vi.fn(async (dir: string) => (dir === CT ? [{ name: 'T0936-sample.md', isDirectory: false }] : []))
  const stat = vi.fn(async (path: string) => (EXISTING.has(path) ? { mtimeMs: 1, size: 1 } : null))
  ;(window as unknown as { electronAPI: unknown }).electronAPI = {
    fs: { readdir, stat, readFile: vi.fn(async () => ({ error: 'x' })), watch: vi.fn(async () => true), unwatch: vi.fn(async () => true), resetWatch: vi.fn(async () => true), onChanged: vi.fn(() => () => {}) },
    debug: { log: vi.fn() },
    pty: { onNotifyHoldChanged: vi.fn(() => () => {}), notifyHoldList: vi.fn(async () => []), onOutput: vi.fn(() => () => {}) },
    claude: { onMessage: vi.fn(() => () => {}), onStream: vi.fn(() => () => {}) },
    agent: { getDefinition: vi.fn(async () => null) },
    ctConfig: { readSources: vi.fn(async () => ({ global: { status: 'missing' }, defaults: { status: 'missing' } })) },
    towerInbox: { answer },
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
  ws = workspaceStore.addWorkspace('T0936', WS_DIR)
  const terminal = workspaceStore.addTerminal(ws.id, 'claude-cli')
  workspaceStore.setAutoTitle(terminal.id, 'Tower')
  applyTowerContract({ id: terminal.id, role: 'tower', towerContract: 2 })
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

function renderPanel() {
  act(() => setInboxFiles(WS_DIR, files()))
  render(<InboxPanel workspaceId={ws.id} workspaceFolderPath={WS_DIR} />)
}

const row = (id: string) => document.querySelector(`[data-inbox-action="${id}"]`) as HTMLElement
const commandOf = (id: string) => row(id).querySelector('.inbox-command') as HTMLElement
const linksIn = (root: Element) => Array.from(root.querySelectorAll('[data-inbox-file-ref]')).map(a => [a.textContent, a.getAttribute('data-inbox-file-ref')])

function recordEvents() {
  const seen: Array<[string, unknown]> = []
  const onTab = (e: Event) => seen.push(['workspace-switch-tab', (e as CustomEvent).detail])
  const onReveal = (e: Event) => seen.push(['file-tree-reveal', (e as CustomEvent).detail])
  window.addEventListener('workspace-switch-tab', onTab)
  window.addEventListener('file-tree-reveal', onReveal)
  return { seen, stop: () => { window.removeEventListener('workspace-switch-tab', onTab); window.removeEventListener('file-tree-reveal', onReveal) } }
}

describe('🙋 command that is a file (T0936)', () => {
  it('an existing file: a link and Open, no Copy; both open the resolved file', async () => {
    renderPanel()
    await waitFor(() => expect(row('A-1').querySelector('[data-inbox-command-file="A-1"]')).not.toBeNull())
    const command = commandOf('A-1')
    expect(linksIn(command)).toEqual([[REPLY, REPLY]])
    expect(command.querySelector('code')!.textContent).toBe(REPLY)
    expect(command.querySelector('code')!.getAttribute('title')).toBe(en.inbox.action.openNote)
    expect(row('A-1').querySelector('[data-inbox-copy="A-1"]')).toBeNull()
    const open = row('A-1').querySelector('[data-inbox-open="A-1"]') as HTMLElement
    expect(open.textContent).toBe(en.inbox.action.open)
    const events = recordEvents()
    fireEvent.click(open)
    fireEvent.click(command.querySelector('[data-inbox-file-ref]')!)
    events.stop()
    const expected: Array<[string, unknown]> = [
      ['workspace-switch-tab', { tab: 'files' }],
      ['file-tree-reveal', { path: `${WS_DIR}/${REPLY}` }],
    ]
    expect(events.seen).toEqual([...expected, ...expected])
    expect(writeText).not.toHaveBeenCalled()
    expect(answer).not.toHaveBeenCalled() // opening never sends or runs anything
  })

  it('a missing file: plain text and Copy, as before', async () => {
    renderPanel()
    await waitFor(() => expect(row('A-1').querySelector('[data-inbox-command-file="A-1"]')).not.toBeNull())
    const command = commandOf('A-2')
    expect(command.getAttribute('data-inbox-command-file')).toBeNull()
    expect(linksIn(command)).toEqual([])
    expect(command.querySelector('code')!.textContent).toBe(MISSING)
    expect(command.querySelector('code')!.getAttribute('title')).toBe(en.inbox.action.commandNote)
    expect(row('A-2').querySelector('[data-inbox-open]')).toBeNull()
    fireEvent.click(row('A-2').querySelector('[data-inbox-copy="A-2"]')!)
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(MISSING))
  })

  it('a real command: its existing path links, Copy copies the whole command', async () => {
    renderPanel()
    const command = commandOf('A-3')
    await waitFor(() => expect(linksIn(command)).toEqual([['e2e/manual/check.ps1', 'e2e/manual/check.ps1']]))
    expect(command.querySelector('code')!.textContent).toBe(RUN)
    expect(row('A-3').querySelector('[data-inbox-open]')).toBeNull()
    const events = recordEvents()
    fireEvent.click(command.querySelector('[data-inbox-file-ref]')!)
    events.stop()
    expect(events.seen).toEqual([
      ['workspace-switch-tab', { tab: 'files' }],
      ['file-tree-reveal', { path: `${WS_DIR}/e2e/manual/check.ps1` }],
    ])
    fireEvent.click(row('A-3').querySelector('[data-inbox-copy="A-3"]')!)
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(RUN))
  })

  it('a quoted path with spaces and a CT id as the whole command open their file', async () => {
    renderPanel()
    await waitFor(() => expect(row('A-4').querySelector('[data-inbox-open="A-4"]')).not.toBeNull())
    await waitFor(() => expect(row('A-5').querySelector('[data-inbox-open="A-5"]')).not.toBeNull())
    expect(commandOf('A-4').querySelector('code')!.textContent).toBe(SPACED)
    expect(linksIn(commandOf('A-5'))).toEqual([['T0936', '_ct-workorders/T0936-sample.md']])
    const events = recordEvents()
    fireEvent.click(row('A-4').querySelector('[data-inbox-open="A-4"]')!)
    fireEvent.click(row('A-5').querySelector('[data-inbox-open="A-5"]')!)
    events.stop()
    expect(events.seen).toEqual([
      ['workspace-switch-tab', { tab: 'files' }],
      ['file-tree-reveal', { path: `${WS_DIR}/docs/a b.md` }],
      ['workspace-switch-tab', { tab: 'files' }],
      ['file-tree-reveal', { path: `${CT}/T0936-sample.md` }],
    ])
  })
})
