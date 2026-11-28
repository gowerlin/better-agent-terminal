/**
 * T0971 / BUG-237: the「待辦」(Inbox) hint line「塔台正以選單詢問此題：在這裡回答會先關掉選單」follows the host's
 * own decision (`towerInbox.menuHint` → proxied `tower-inbox:menu-hint` → `menuEscDecision`):
 *
 *   - a `menu_open` left from an earlier menu while another menu is open (host: `stale`) → no hint (T0969 H-7)
 *   - the same menu, the times match (host: the ids) → the hint
 *   - an older host (`No handler for channel`) → T0968: the hint while the Tower tab is `question`
 *   - the menu record alone (T0968 Q-2, host `via: 'menu'`) → the hint; asked again every
 *     `INBOX_MENU_HINT_REFRESH_MS` so it goes when the record closes; nothing before the host answers
 *   - the tab badge asks nothing; the answer call is unchanged
 */
import { act } from 'react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import i18n from '../../i18n'
import en from '../../locales/en.json'
import { InboxPanel, InboxTabBadge } from '../InboxPanel'
import { workspaceStore } from '../../stores/workspace-store'
import { applyTowerContract, resetTowerContractStore } from '../../stores/tower-contract-store'
import { resetNotifyHoldStore } from '../../stores/notify-hold-store'
import { resetTerminalAttention, setTerminalAttention } from '../../stores/terminal-attention-store'
import { EMPTY_INBOX_FILES, resetInboxStore, setInboxFiles, type InboxFiles } from '../../stores/inbox-store'
import { resetDirWatches } from '../../stores/ct-dir-watch'
import { parseTowerState, parseTowerStateInbox } from '../../lib/ct-tower-overview'
import { INBOX_MENU_HINT_REFRESH_MS } from '../inbox/useInboxMenuHint'
import type { MenuOpen } from '../../lib/tower-inbox'
import type { TowerInboxMenuHintResult } from '../../types/notify-hold'
import type { Workspace } from '../../types'

const WS_DIR = '/tmp/t0971-ws'
const OPENED_AT = '2026-11-28T12:23:00+08:00'

const STATE = `---
schema_kind: tower-state
summary_version: 1
bat_contract: 2
inbox_features: ["recommended", "dismiss", "multi", "menu"]
awaiting_user:
  - id: "U-57"
    summary: "made-up question 57"
    options: ["A 甲", "B 乙"]
    created_at: "2026-11-28T12:20:00+08:00"
  - id: "U-58"
    summary: "made-up question 58"
    options: ["A 甲", "B 乙"]
    created_at: "2026-11-28T12:21:00+08:00"
menu_open: { ids: ["U-57"], opened_at: "${OPENED_AT}" }
---
# 塔台
`

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
let menuHint: ReturnType<typeof vi.fn>
/** What the fake host answers (or throws) for the next calls. */
let hostAnswer: (id: string, menu: MenuOpen) => TowerInboxMenuHintResult | Error

beforeAll(async () => {
  await i18n.changeLanguage('en')
})

beforeEach(() => {
  answer = vi.fn(async () => ({ ok: true, held: true, holdId: 'h-1' }))
  hostAnswer = () => ({ ok: true, ids: [], via: null, decision: 'no-menu' })
  menuHint = vi.fn(async (id: string, menu: MenuOpen) => {
    const result = hostAnswer(id, menu)
    if (result instanceof Error) throw result
    return result
  })
  ;(window as unknown as { electronAPI: unknown }).electronAPI = {
    fs: { readdir: vi.fn(async () => []), readFile: vi.fn(async () => ({ error: 'x' })), stat: vi.fn(async () => null), watch: vi.fn(async () => true), unwatch: vi.fn(async () => true), resetWatch: vi.fn(async () => true), onChanged: vi.fn(() => () => {}) },
    debug: { log: vi.fn() },
    pty: { onNotifyHoldChanged: vi.fn(() => () => {}), notifyHoldList: vi.fn(async () => []) },
    ctConfig: { readSources: vi.fn(async () => ({ global: { status: 'missing' }, defaults: { status: 'missing' } })) },
    towerInbox: { answer, menuHint },
  }
  ws = workspaceStore.addWorkspace('T0971', WS_DIR)
})

afterEach(async () => {
  cleanup()
  vi.useRealTimers()
  act(() => {
    workspaceStore.removeWorkspace(ws.id)
    resetTowerContractStore()
    resetNotifyHoldStore()
    resetInboxStore()
    resetTerminalAttention()
  })
  resetDirWatches()
  delete (window as unknown as { electronAPI?: unknown }).electronAPI
})

function tower() {
  const terminal = workspaceStore.addTerminal(ws.id, 'claude-cli')
  workspaceStore.setAutoTitle(terminal.id, 'Tower')
  applyTowerContract({ id: terminal.id, role: 'tower', towerContract: 2 })
  return terminal
}

function asking(id: string, reason: 'question' | null) {
  act(() => setTerminalAttention({ id, pendingQuestions: 0, ...(reason ? { blockedReason: reason, blockedSince: 1 } : {}) }))
}

function renderPanel() {
  act(() => setInboxFiles(WS_DIR, files(STATE)))
  return render(<InboxPanel workspaceId={ws.id} workspaceFolderPath={WS_DIR} />)
}

const q = (selector: string) => document.querySelector(selector) as HTMLElement | null
const row = (id: string) => q(`[data-inbox-awaiting="${id}"]`)!
const hint = (id: string) => q(`[data-inbox-menu-hint="${id}"]`)
const flush = () => act(async () => { for (let i = 0; i < 3; i++) await Promise.resolve() })
const sendButton = (el: HTMLElement) => Array.from(el.querySelectorAll('button')).find(b => b.textContent === en.inbox.answer.send) as HTMLButtonElement

describe('BUG-237: the hint follows the host', () => {
  it('T0969 H-7: a leftover menu_open while another menu is open (host: stale) → no hint, though the tab is `question`', async () => {
    const t1 = tower()
    asking(t1.id, 'question')
    hostAnswer = () => ({ ok: true, ids: [], via: 'question', decision: 'stale' })
    renderPanel()
    await flush()
    expect(menuHint).toHaveBeenCalledWith(t1.id, { ids: ['U-57'], openedAt: OPENED_AT })
    expect(hint('U-57')).toBeNull()
    expect(hint('U-58')).toBeNull()
  })

  it('the same menu, the times match (host: the ids) → the hint beside U-57 only', async () => {
    const t1 = tower()
    asking(t1.id, 'question')
    hostAnswer = () => ({ ok: true, ids: ['U-57'], via: 'question', decision: 'esc' })
    renderPanel()
    await flush()
    expect(hint('U-57')?.textContent).toBe(en.inbox.answer.menuOpenHint)
    expect(hint('U-58')).toBeNull()
  })

  it('nothing before the host answers (no flash of a stale hint)', async () => {
    const t1 = tower()
    asking(t1.id, 'question')
    let resolve: (r: TowerInboxMenuHintResult) => void = () => {}
    menuHint.mockImplementation(() => new Promise<TowerInboxMenuHintResult>(r => { resolve = r }))
    renderPanel()
    expect(hint('U-57')).toBeNull()
    await act(async () => { resolve({ ok: true, ids: ['U-57'], via: 'question', decision: 'esc' }) })
    await flush()
    expect(hint('U-57')).not.toBeNull()
  })

  it('asked again on an attention change: the menu closes → the hint goes', async () => {
    const t1 = tower()
    asking(t1.id, 'question')
    hostAnswer = () => ({ ok: true, ids: ['U-57'], via: 'question', decision: 'esc' })
    renderPanel()
    await flush()
    expect(hint('U-57')).not.toBeNull()
    hostAnswer = () => ({ ok: true, ids: [], via: null, decision: 'no-menu' })
    asking(t1.id, null)
    await flush()
    expect(hint('U-57')).toBeNull()
  })

  it('a refusal / no controller on the host → no hint', async () => {
    const t1 = tower()
    asking(t1.id, 'question')
    hostAnswer = () => ({ ok: false, reason: 'unavailable' })
    renderPanel()
    await flush()
    expect(hint('U-57')).toBeNull()
  })
})

describe('an older host (`No handler for channel`) → T0968', () => {
  it('shown while the tab is `question`, not otherwise', async () => {
    const t1 = tower()
    hostAnswer = () => new Error("Error invoking remote method 'tower-inbox:menu-hint': Error: No handler for channel: tower-inbox:menu-hint")
    asking(t1.id, 'question')
    renderPanel()
    await flush()
    expect(hint('U-57')?.textContent).toBe(en.inbox.answer.menuOpenHint)
    asking(t1.id, null)
    await flush()
    expect(hint('U-57')).toBeNull()
  })

  it('an older preload (no towerInbox.menuHint) → T0968 at once', () => {
    ;(window as unknown as { electronAPI: { towerInbox: unknown } }).electronAPI.towerInbox = { answer }
    const t1 = tower()
    asking(t1.id, 'question')
    renderPanel()
    expect(hint('U-57')).not.toBeNull()
  })
})

describe('T0968 Q-2: the menu record alone', () => {
  it('host via menu → the hint though the tab is not `question`; asked again until the record closes', async () => {
    vi.useFakeTimers()
    const t1 = tower()
    asking(t1.id, null)
    hostAnswer = () => ({ ok: true, ids: ['U-57'], via: 'menu', decision: 'esc' })
    renderPanel()
    await flush()
    expect(hint('U-57')).not.toBeNull()
    // the user closed the menu with Esc in the tab: no attention change, only the record closed
    hostAnswer = () => ({ ok: true, ids: [], via: null, decision: 'no-menu' })
    const calls = menuHint.mock.calls.length
    await act(async () => { vi.advanceTimersByTime(INBOX_MENU_HINT_REFRESH_MS) })
    await flush()
    expect(menuHint.mock.calls.length).toBeGreaterThan(calls)
    expect(hint('U-57')).toBeNull()
    // no more asking once nothing shows on the record alone
    const after = menuHint.mock.calls.length
    await act(async () => { vi.advanceTimersByTime(3 * INBOX_MENU_HINT_REFRESH_MS) })
    await flush()
    expect(menuHint.mock.calls.length).toBe(after)
  })
})

describe('unchanged', () => {
  it('the tab badge asks nothing; no menu_open asks nothing', async () => {
    const t1 = tower()
    asking(t1.id, 'question')
    act(() => setInboxFiles(WS_DIR, files(STATE)))
    render(<InboxTabBadge workspaceId={ws.id} workspaceFolderPath={WS_DIR} />)
    await flush()
    expect(menuHint).not.toHaveBeenCalled()
    cleanup()
    act(() => setInboxFiles(WS_DIR, files(STATE.replace(/^menu_open:.*$/m, ''))))
    render(<InboxPanel workspaceId={ws.id} workspaceFolderPath={WS_DIR} />)
    await flush()
    expect(menuHint).not.toHaveBeenCalled()
  })

  it('the answer still carries the menu (T0968), whatever the hint', async () => {
    const t1 = tower()
    asking(t1.id, 'question')
    hostAnswer = () => ({ ok: true, ids: [], via: 'question', decision: 'stale' })
    renderPanel()
    await flush()
    fireEvent.click(row('U-57').querySelector('[data-inbox-option="A"] input')!)
    fireEvent.click(sendButton(row('U-57')))
    await flush()
    expect(answer).toHaveBeenLastCalledWith(t1.id, 'U-57：A', { ids: ['U-57'], openedAt: OPENED_AT })
  })
})
