/**
 * T0968 (CT 6.4.0-pre.1 `menu_open`): the「待辦」(Inbox) tab
 *
 *   - every answer carries the Tower's menu (`tower-inbox:answer`'s third argument) only when CT declares
 *     `inbox_features: menu`; CT 6.3.x → the call is exactly T0908's (two arguments)
 *   - an item in `menu_open.ids` shows「塔台正以選單詢問此題：在這裡回答會先關掉選單」while the Tower tab shows
 *     `question` (Tower answer Q-2: `question` only); not for other items, not without `question`; three
 *     languages; the buttons and the send path are unchanged
 */
import { act } from 'react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import i18n from '../../i18n'
import en from '../../locales/en.json'
import zhTW from '../../locales/zh-TW.json'
import zhCN from '../../locales/zh-CN.json'
import { InboxPanel } from '../InboxPanel'
import { workspaceStore } from '../../stores/workspace-store'
import { applyTowerContract, resetTowerContractStore } from '../../stores/tower-contract-store'
import { resetNotifyHoldStore } from '../../stores/notify-hold-store'
import { resetTerminalAttention, setTerminalAttention } from '../../stores/terminal-attention-store'
import { EMPTY_INBOX_FILES, resetInboxStore, setInboxFiles, type InboxFiles } from '../../stores/inbox-store'
import { resetDirWatches } from '../../stores/ct-dir-watch'
import { parseTowerState, parseTowerStateInbox } from '../../lib/ct-tower-overview'
import type { Workspace } from '../../types'

const WS_DIR = '/tmp/t0968-ws'

const STATE = (head: string) => `---
schema_kind: tower-state
summary_version: 1
bat_contract: 2
${head}
awaiting_user:
  - id: "U-57"
    summary: "made-up question 57"
    options: ["A 甲", "B 乙"]
    created_at: "2026-11-28T12:20:00+08:00"
  - id: "U-58"
    summary: "made-up question 58"
    options: ["A 甲", "B 乙"]
    created_at: "2026-11-28T12:21:00+08:00"
user_actions:
  - id: "A-1"
    title: "made-up action"
---
# 塔台
`
const V640 = 'inbox_features: ["recommended", "dismiss", "multi", "menu"]\nmenu_open: { ids: ["U-57"], opened_at: "2026-11-28T12:23:00+08:00" }'
const V640_NO_MENU_OPEN = 'inbox_features: ["recommended", "dismiss", "multi", "menu"]'
const V630 = 'inbox_features: ["recommended", "dismiss", "multi"]\nmenu_open: { ids: ["U-57"], opened_at: "2026-11-28T12:23:00+08:00" }'

function files(state: string): InboxFiles {
  return {
    ...EMPTY_INBOX_FILES,
    hasCtDir: true,
    state: { status: 'loaded', parsed: parseTowerState(state) },
    lists: parseTowerStateInbox(state),
    waitingOrders: [],
    userInbox: 'on',
  }
}

let ws: Workspace
let answer: ReturnType<typeof vi.fn>

beforeAll(async () => {
  await i18n.changeLanguage('en')
})

beforeEach(() => {
  answer = vi.fn(async () => ({ ok: true, held: true, holdId: 'h-1' }))
  ;(window as unknown as { electronAPI: unknown }).electronAPI = {
    fs: { readdir: vi.fn(async () => []), readFile: vi.fn(async () => ({ error: 'x' })), stat: vi.fn(async () => null), watch: vi.fn(async () => true), unwatch: vi.fn(async () => true), resetWatch: vi.fn(async () => true), onChanged: vi.fn(() => () => {}) },
    debug: { log: vi.fn() },
    pty: { onNotifyHoldChanged: vi.fn(() => () => {}), notifyHoldList: vi.fn(async () => []) },
    ctConfig: { readSources: vi.fn(async () => ({ global: { status: 'missing' }, defaults: { status: 'missing' } })) },
    towerInbox: { answer },
  }
  ws = workspaceStore.addWorkspace('T0968', WS_DIR)
})

afterEach(async () => {
  cleanup()
  act(() => {
    workspaceStore.removeWorkspace(ws.id)
    resetTowerContractStore()
    resetNotifyHoldStore()
    resetInboxStore()
    resetTerminalAttention()
  })
  resetDirWatches()
  delete (window as unknown as { electronAPI?: unknown }).electronAPI
  await i18n.changeLanguage('en')
})

function tower() {
  const terminal = workspaceStore.addTerminal(ws.id, 'claude-cli')
  workspaceStore.setAutoTitle(terminal.id, 'Tower')
  applyTowerContract({ id: terminal.id, role: 'tower', towerContract: 2 })
  return terminal
}

function asking(id: string, reason: 'question' | 'permission' | null) {
  act(() => setTerminalAttention({ id, pendingQuestions: 0, ...(reason ? { blockedReason: reason, blockedSince: 1 } : {}) }))
}

function renderPanel(head: string) {
  act(() => setInboxFiles(WS_DIR, files(STATE(head))))
  return render(<InboxPanel workspaceId={ws.id} workspaceFolderPath={WS_DIR} />)
}

const q = (selector: string) => document.querySelector(selector) as HTMLElement | null
const row = (id: string) => q(`[data-inbox-awaiting="${id}"]`)!
const hint = (id: string) => q(`[data-inbox-menu-hint="${id}"]`)
const flush = () => act(async () => { await new Promise(r => setTimeout(r, 0)) })
const sendButton = (el: HTMLElement) => Array.from(el.querySelectorAll('button')).find(b => b.textContent === en.inbox.answer.send) as HTMLButtonElement

describe('the answer carries menu_open', () => {
  it('CT 6.4.0: the third argument is the menu (U-n and A-n alike)', async () => {
    const t1 = tower()
    renderPanel(V640)
    fireEvent.click(row('U-58').querySelector('[data-inbox-option="A"] input')!)
    fireEvent.click(sendButton(row('U-58')))
    await flush()
    expect(answer).toHaveBeenLastCalledWith(t1.id, 'U-58：A', { ids: ['U-57'], openedAt: '2026-11-28T12:23:00+08:00' })
    const action = q('[data-inbox-action="A-1"]')!
    fireEvent.click(Array.from(action.querySelectorAll('button')).find(b => b.textContent === en.inbox.action.done)!)
    await flush()
    expect(answer).toHaveBeenLastCalledWith(t1.id, 'A-1：完成', { ids: ['U-57'], openedAt: '2026-11-28T12:23:00+08:00' })
  })

  it('CT 6.4.0 without menu_open: null', async () => {
    const t1 = tower()
    renderPanel(V640_NO_MENU_OPEN)
    fireEvent.click(row('U-57').querySelector('[data-inbox-option="A"] input')!)
    fireEvent.click(sendButton(row('U-57')))
    await flush()
    expect(answer).toHaveBeenLastCalledWith(t1.id, 'U-57：A', null)
  })

  it('CT 6.3.x (menu_open without `menu`): two arguments, as T0908', async () => {
    const t1 = tower()
    renderPanel(V630)
    fireEvent.click(row('U-57').querySelector('[data-inbox-option="A"] input')!)
    fireEvent.click(sendButton(row('U-57')))
    await flush()
    expect(answer).toHaveBeenCalledTimes(1)
    expect(answer.mock.calls[0]).toEqual([t1.id, 'U-57：A'])
  })
})

describe('the hint line', () => {
  it('beside the item in menu_open while the Tower shows `question`; not beside the others', () => {
    const t1 = tower()
    asking(t1.id, 'question')
    renderPanel(V640)
    expect(hint('U-57')?.textContent).toBe(en.inbox.answer.menuOpenHint)
    expect(hint('U-58')).toBeNull()
    // placed after the summary, before the options; the buttons unchanged
    const summary = row('U-57').querySelector('[data-inbox-summary="U-57"]')!
    expect(summary.compareDocumentPosition(hint('U-57')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(sendButton(row('U-57'))).toBeTruthy()
  })

  it('not without `question` (only the record, or another prompt), not without menu_open / `menu`', () => {
    const t1 = tower()
    asking(t1.id, null)
    const { unmount } = renderPanel(V640)
    expect(hint('U-57')).toBeNull()
    asking(t1.id, 'permission')
    expect(hint('U-57')).toBeNull()
    unmount()
    asking(t1.id, 'question')
    for (const head of [V640_NO_MENU_OPEN, V630]) {
      const view = renderPanel(head)
      expect(hint('U-57')).toBeNull()
      view.unmount()
    }
  })

  it('follows `question`: shown while it lasts, gone after', () => {
    const t1 = tower()
    renderPanel(V640)
    expect(hint('U-57')).toBeNull()
    asking(t1.id, 'question')
    expect(hint('U-57')).not.toBeNull()
    asking(t1.id, null)
    expect(hint('U-57')).toBeNull()
  })

  it.each([
    ['zh-TW', zhTW.inbox.answer.menuOpenHint],
    ['zh-CN', zhCN.inbox.answer.menuOpenHint],
    ['en', en.inbox.answer.menuOpenHint],
  ])('%s', async (lang, text) => {
    await act(async () => { await i18n.changeLanguage(lang) })
    const t1 = tower()
    asking(t1.id, 'question')
    renderPanel(V640)
    expect(hint('U-57')?.textContent).toBe(text)
  })

  it('the three texts', () => {
    expect(zhTW.inbox.answer.menuOpenHint).toBe('塔台正以選單詢問此題：在這裡回答會先關掉選單')
    expect(zhCN.inbox.answer.menuOpenHint).toBe('塔台正以选单询问此题：在这里回答会先关掉选单')
    expect(en.inbox.answer.menuOpenHint).toBe('The Tower is asking this in its menu: answering here closes the menu first.')
  })
})
