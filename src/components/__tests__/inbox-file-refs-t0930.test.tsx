/**
 * T0930: file references in the「待辦」(Inbox) tab open in the「檔案」tab.
 *
 * - a found `workorder` / `ref` tag and a found path / id in the summary / title are buttons; a click
 *   dispatches `workspace-switch-tab` (files) and `file-tree-reveal` with the resolved path
 * - not found, outside the workspace, `..`, URLs: plain text; the text itself never changes
 * - without a workspace folder nothing is checked
 * All paths are made up.
 */
import { act } from 'react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import i18n from '../../i18n'
import { InboxPanel } from '../InboxPanel'
import { AwaitingList } from '../inbox/InboxLists'
import { workspaceStore } from '../../stores/workspace-store'
import { applyTowerContract, resetTowerContractStore } from '../../stores/tower-contract-store'
import { resetNotifyHoldStore } from '../../stores/notify-hold-store'
import { EMPTY_INBOX_FILES, resetInboxStore, setInboxFiles, type InboxFiles } from '../../stores/inbox-store'
import { resetDirWatches } from '../../stores/ct-dir-watch'
import { parseTowerState, parseTowerStateInbox } from '../../lib/ct-tower-overview'
import type { Workspace } from '../../types'

const WS_DIR = '/tmp/t0930-ws'
const CT = `${WS_DIR}/_ct-workorders`

const STATE = `---
schema_kind: tower-state
summary_version: 1
bat_contract: 2
awaiting_user:
  - id: "U-1"
    workorder: "T0901"
    summary: "T0901 Q-1：比較 \`docs/sample/guide.md\` 與 docs/sample/missing.md，另見 BUG-048、D370、https://example.test/docs/x.md、\`../outside/a.md\`、/elsewhere/b.md"
    options: ["A ok", "B no"]
  - id: "U-2"
    workorder: "T0999"
    summary: "Nothing here exists: T0999 and \`docs/none.md\`"
user_actions:
  - id: "A-1"
    title: "Run \`results/M-9.md\` again"
    ref: "PLAN-067"
reminders:
  - id: "weekly"
    title: "Review docs/sample/guide.md"
    ref: "T0901"
    due_at: "2000-01-01"
---
# 塔台
`

const EXISTING = new Set([
  `${WS_DIR}/docs/sample/guide.md`,
  `${CT}/results/M-9.md`,
  `${CT}/_decision-log.md`,
])
const LISTINGS: Record<string, Array<{ name: string; path: string; isDirectory: boolean }>> = {
  [CT]: [
    { name: 'T0901-sample-order.md', path: `${CT}/T0901-sample-order.md`, isDirectory: false },
    { name: '_archive', path: `${CT}/_archive`, isDirectory: true },
  ],
  [`${CT}/_archive/bugs`]: [
    { name: 'BUG-048-sample-bug.md', path: `${CT}/_archive/bugs/BUG-048-sample-bug.md`, isDirectory: false },
  ],
  [`${CT}/_archive/plans`]: [],
}

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
let fsApi: { readdir: ReturnType<typeof vi.fn>; stat: ReturnType<typeof vi.fn> }

beforeAll(async () => {
  await i18n.changeLanguage('en')
})

beforeEach(() => {
  fsApi = {
    readdir: vi.fn(async (dir: string) => LISTINGS[dir] ?? []),
    stat: vi.fn(async (path: string) => (EXISTING.has(path) ? { mtimeMs: 1, size: 1 } : null)),
  }
  ;(window as unknown as { electronAPI: unknown }).electronAPI = {
    fs: { ...fsApi, readFile: vi.fn(async () => ({ error: 'x' })), watch: vi.fn(async () => true), unwatch: vi.fn(async () => true), resetWatch: vi.fn(async () => true), onChanged: vi.fn(() => () => {}) },
    debug: { log: vi.fn() },
    pty: { onNotifyHoldChanged: vi.fn(() => () => {}), notifyHoldList: vi.fn(async () => []) },
    ctConfig: { readSources: vi.fn(async () => ({ global: { status: 'missing' }, defaults: { status: 'missing' } })) },
    towerInbox: { answer: vi.fn(async () => ({ ok: true, held: false, holdId: 'h-1' })) },
  }
  ws = workspaceStore.addWorkspace('T0930', WS_DIR)
  const terminal = workspaceStore.addTerminal(ws.id, 'claude-cli')
  workspaceStore.setAutoTitle(terminal.id, 'Tower')
  applyTowerContract({ id: terminal.id, role: 'tower', towerContract: 2 })
})

afterEach(() => {
  cleanup()
  act(() => {
    workspaceStore.removeWorkspace(ws.id)
    resetTowerContractStore()
    resetNotifyHoldStore()
    resetInboxStore()
  })
  resetDirWatches()
  delete (window as unknown as { electronAPI?: unknown }).electronAPI
})

function renderPanel() {
  act(() => setInboxFiles(WS_DIR, files()))
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

describe('⏸ 待你決定', () => {
  it('links the found tag, path, ids; everything else stays text', async () => {
    renderPanel()
    const entry = el('[data-inbox-awaiting="U-1"]')
    const summary = entry.querySelector('[data-inbox-summary="U-1"]')!
    await waitFor(() => expect(linksIn(summary).length).toBe(4))
    expect(linksIn(summary)).toEqual([
      ['T0901', '_ct-workorders/T0901-sample-order.md'],
      ['docs/sample/guide.md', 'docs/sample/guide.md'],
      ['BUG-048', '_ct-workorders/_archive/bugs/BUG-048-sample-bug.md'],
      ['D370', '_ct-workorders/_decision-log.md'],
    ])
    // the text is unchanged
    expect(summary.textContent).toBe('T0901 Q-1：比較 `docs/sample/guide.md` 與 docs/sample/missing.md，另見 BUG-048、D370、https://example.test/docs/x.md、`../outside/a.md`、/elsewhere/b.md')
    // the head tag
    const tag = entry.querySelector('.inbox-entry-head [data-inbox-file-ref]') as HTMLButtonElement
    expect(tag.tagName).toBe('BUTTON')
    expect(tag.textContent).toBe('T0901')
    expect(tag.title).toBe('_ct-workorders/T0901-sample-order.md')
    expect(tag.classList.contains('inbox-item-source')).toBe(true)
    // the outside / missing / URL pieces were never even checked outside the workspace
    const statted = fsApi.stat.mock.calls.map(call => call[0] as string)
    expect(statted.every(path => path.startsWith(`${WS_DIR}/`))).toBe(true)
    expect(statted.some(path => path.includes('..') || path.includes('example.test'))).toBe(false)
  })

  it('a click opens the file in the Files tab and reveals it', async () => {
    renderPanel()
    const summary = el('[data-inbox-summary="U-1"]')
    await waitFor(() => expect(linksIn(summary).length).toBe(4))
    const events = recordEvents()
    fireEvent.click(summary.querySelector('[data-inbox-file-ref="docs/sample/guide.md"]')!)
    fireEvent.click(el('[data-inbox-awaiting="U-1"] .inbox-entry-head [data-inbox-file-ref]'))
    events.stop()
    expect(events.seen).toEqual([
      ['workspace-switch-tab', { tab: 'files' }],
      ['file-tree-reveal', { path: `${WS_DIR}/docs/sample/guide.md` }],
      ['workspace-switch-tab', { tab: 'files' }],
      ['file-tree-reveal', { path: `${CT}/T0901-sample-order.md` }],
    ])
  })

  it('files that do not exist are not links', async () => {
    renderPanel()
    await waitFor(() => expect(linksIn(el('[data-inbox-summary="U-1"]')).length).toBe(4))
    const entry = el('[data-inbox-awaiting="U-2"]')
    expect(linksIn(entry)).toEqual([])
    expect(entry.querySelector('.inbox-entry-head .inbox-item-source')?.tagName).toBe('SPAN')
    expect(entry.querySelector('[data-inbox-summary="U-2"]')!.textContent).toBe('Nothing here exists: T0999 and `docs/none.md`')
  })
})

describe('🙋 待你執行 and ⏰ 到期提醒', () => {
  it('a path resolved under _ct-workorders/ links; a missing ref tag stays text', async () => {
    renderPanel()
    const action = el('[data-inbox-action="A-1"]')
    await waitFor(() => expect(linksIn(action)).toEqual([['results/M-9.md', '_ct-workorders/results/M-9.md']]))
    expect(action.querySelector('.inbox-entry-head .inbox-item-source')?.tagName).toBe('SPAN')
  })

  it('reminder tag and title link', async () => {
    renderPanel()
    const reminder = el('[data-inbox-reminder="weekly"]')
    await waitFor(() => expect(linksIn(reminder)).toEqual([
      ['T0901', '_ct-workorders/T0901-sample-order.md'],
      ['docs/sample/guide.md', 'docs/sample/guide.md'],
    ]))
  })
})

describe('bounded and read-only', () => {
  it('each folder is listed at most once per list check', async () => {
    renderPanel()
    await waitFor(() => expect(linksIn(el('[data-inbox-summary="U-1"]')).length).toBe(4))
    // three lists, each lists `_ct-workorders/` at most once
    const hot = fsApi.readdir.mock.calls.filter(call => call[0] === CT).length
    expect(hot).toBeLessThanOrEqual(3)
  })

  it('without a workspace folder nothing is checked and nothing links', async () => {
    const lists = parseTowerStateInbox(STATE)!
    render(<AwaitingList items={lists.awaiting.map(item => ({ ...item, waitingOrders: [] }))} skipped={0} targets={{ targets: [], auto: null }} />)
    await Promise.resolve()
    expect(fsApi.stat).not.toHaveBeenCalled()
    expect(fsApi.readdir).not.toHaveBeenCalled()
    expect(document.querySelectorAll('[data-inbox-file-ref]').length).toBe(0)
  })
})
