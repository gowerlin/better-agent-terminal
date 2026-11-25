/**
 * PLAN-068 W5 / T0908: the CT contract v2 lists of the「待辦」(Inbox) tab and the answers.
 *
 * - ⏸ 待你決定: option buttons → `U-n：<代號>`; a free answer when the options are unusable; ⏸ 暫停中
 *   for a work order's `waiting_user`; the source's short label
 * - 🙋 待你執行: `command` copy only (never run), 完成 → `A-n：完成`, 失敗… → `A-n：失敗 <說明>`
 * - ⏰ 到期提醒: only due / within 7 days; 最近已結 after an item left the file
 * - answer targets: one contract-2 Tower → sent; two → the user picks; none declared → the panel
 *   Tower (window event; refused while its input box has a draft); held → said so
 * - `user_inbox: off` → the two sections say so; a mismatch → nothing of it; the title number
 * - ⏸N: the workspace badge, the detached report's `awaiting`
 */
import { act } from 'react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import * as fsNode from 'fs'
import * as pathNode from 'path'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import i18n from '../../i18n'
import en from '../../locales/en.json'
import zhTW from '../../locales/zh-TW.json'
import zhCN from '../../locales/zh-CN.json'
import { InboxPanel, InboxTabBadge } from '../InboxPanel'
import { InboxAwaitingBadge } from '../inbox/InboxAwaitingBadge'
import { workspaceStore } from '../../stores/workspace-store'
import { applyTowerContract, resetTowerContractStore } from '../../stores/tower-contract-store'
import { resetNotifyHoldStore } from '../../stores/notify-hold-store'
import { EMPTY_INBOX_FILES, resetInboxStore, setInboxFiles, setInboxStateOnly, type InboxFiles } from '../../stores/inbox-store'
import { resetDirWatches } from '../../stores/ct-dir-watch'
import { parseTowerState, parseTowerStateInbox } from '../../lib/ct-tower-overview'
import { PANEL_TOWER_ANSWER_EVENT, type PanelTowerAnswerDetail } from '../../lib/inbox-answer'
import { detachedWaitingReport, sanitizeDetachedWaitingReport } from '../../lib/terminal-attention'
import type { Workspace } from '../../types'

const WS_DIR = '/tmp/t0908-ws'

const STATE = (contract = 2, extra = '') => `---
schema_kind: tower-state
summary_version: 1
bat_contract: ${contract}
next_ids:
  user: "U-6"
  action: "A-3"
awaiting_user:
  - id: "U-3"
    workorder: "T0901"
    kind: "decision"
    source: "breakpoint-A"
    summary: "T0901 research: inbox or cards"
    options: ["A inbox", "B cards"]
    created_at: "2026-11-25T03:10:23+0800"
  - id: "U-5"
    summary: "Release 0.8.1?"
    options: ["yes please", "no"]
    created_at: "2026-11-25T04:00:00+08:00"
  - id: "bad"
    summary: "skipped"
user_actions:
  - id: "A-2"
    title: "NSIS reinstall acceptance"
    ref: "D324"
    kind: "verify"
    command: "pwsh -File e2e/manual/nsis.ps1 -Version 0.8.0-pre.2"
reminders:
  - id: "weekly-log-review"
    title: "Weekly log review"
    ref: "PLAN-067"
    last_at: "2026-11-18"
    due_at: "2000-01-01"
  - id: "far-away"
    title: "Far away"
    due_at: "2999-01-01"
${extra}---
# 塔台
`

function files(state: string, extra: Partial<InboxFiles> = {}): InboxFiles {
  return {
    ...EMPTY_INBOX_FILES,
    hasCtDir: true,
    state: { status: 'loaded', parsed: parseTowerState(state) },
    lists: parseTowerStateInbox(state),
    waitingOrders: [{ orderId: 'T0901', userId: 'U-3' }, { orderId: 'T0999', userId: 'U-9' }],
    userInbox: 'on',
    ...extra,
  }
}

let ws: Workspace
let answer: ReturnType<typeof vi.fn>
let writeText: ReturnType<typeof vi.fn>

beforeAll(async () => {
  await i18n.changeLanguage('en')
})

beforeEach(() => {
  answer = vi.fn(async () => ({ ok: true, held: false, holdId: 'h-1' }))
  writeText = vi.fn(async () => {})
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
  ;(window as unknown as { electronAPI: unknown }).electronAPI = {
    fs: { readdir: vi.fn(async () => []), readFile: vi.fn(async () => ({ error: 'x' })), stat: vi.fn(async () => null), watch: vi.fn(async () => true), unwatch: vi.fn(async () => true), resetWatch: vi.fn(async () => true), onChanged: vi.fn(() => () => {}) },
    debug: { log: vi.fn() },
    pty: { onNotifyHoldChanged: vi.fn(() => () => {}), notifyHoldList: vi.fn(async () => []) },
    ctConfig: { readSources: vi.fn(async () => ({ global: { status: 'missing' }, defaults: { status: 'missing' } })) },
    towerInbox: { answer },
  }
  ws = workspaceStore.addWorkspace('T0908', WS_DIR)
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

function tower(title: string, towerContract: number | null) {
  const terminal = workspaceStore.addTerminal(ws.id, 'claude-cli')
  workspaceStore.setAutoTitle(terminal.id, title)
  applyTowerContract({ id: terminal.id, role: 'tower', towerContract: towerContract ?? undefined })
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

const q = (selector: string) => document.querySelector(selector) as HTMLElement | null
const flush = () => act(async () => { await new Promise(r => setTimeout(r, 0)) })

describe('⏸ 待你決定', () => {
  it('lists awaiting_user oldest first with options, label, paused work order; sends U-n：<code>', async () => {
    const t1 = tower('Tower', 2)
    act(() => setInboxFiles(WS_DIR, files(STATE())))
    renderPanel()
    const items = Array.from(document.querySelectorAll('[data-inbox-awaiting]')).map(el => el.getAttribute('data-inbox-awaiting'))
    expect(items).toEqual(['U-3', 'U-5'])
    expect(q('[data-inbox-awaiting="U-3"]')!.textContent).toContain(en.inbox.source['breakpoint-A'])
    expect(q('[data-inbox-paused]')!.getAttribute('data-inbox-paused')).toBe('T0901')
    expect(q('[data-inbox-skipped]')!.getAttribute('data-inbox-skipped')).toBe('1')
    // 2 decisions + 1 action + 1 due reminder (the far one is not counted)
    expect(q('[data-inbox-badge]')!.getAttribute('data-inbox-badge')).toBe('4')

    const row = q('[data-inbox-awaiting="U-3"]')!
    fireEvent.click(row.querySelector('[data-inbox-option="B"] input')!)
    fireEvent.click(Array.from(row.querySelectorAll('button')).find(b => b.textContent === en.inbox.answer.send)!)
    await flush()
    expect(answer).toHaveBeenCalledWith(t1.id, 'U-3：B')
    expect(row.querySelector('[data-inbox-answer-status]')!.getAttribute('data-inbox-answer-status')).toBe('sent')
  })

  it('options not `<code> <text>` → a free answer box (Enter sends one line)', async () => {
    const t1 = tower('Tower', 2)
    act(() => setInboxFiles(WS_DIR, files(STATE())))
    renderPanel()
    const row = q('[data-inbox-awaiting="U-5"]')!
    expect(row.querySelector('[data-inbox-option]')).toBeNull()
    expect(row.textContent).toContain(en.inbox.answer.optionsInvalid)
    const input = row.querySelector('input.inbox-free-input') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'not yet' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await flush()
    expect(answer).toHaveBeenCalledWith(t1.id, 'U-5：not yet')
  })

  it('held in the Tower queue → says so', async () => {
    tower('Tower', 2)
    answer.mockResolvedValueOnce({ ok: true, held: true, holdId: 'h-2' })
    act(() => setInboxFiles(WS_DIR, files(STATE())))
    renderPanel()
    const row = q('[data-inbox-awaiting="U-3"]')!
    fireEvent.click(row.querySelector('[data-inbox-option="A"] input')!)
    fireEvent.click(Array.from(row.querySelectorAll('button')).find(b => b.textContent === en.inbox.answer.send)!)
    await flush()
    expect(row.querySelector('[data-inbox-answer-status]')!.getAttribute('data-inbox-answer-status')).toBe('held')
  })
})

describe('🙋 待你執行 / ⏰ 到期提醒 / 最近已結', () => {
  it('command: copy only; 完成 and 失敗 send the contract lines', async () => {
    const t1 = tower('Tower', 2)
    act(() => setInboxFiles(WS_DIR, files(STATE())))
    renderPanel()
    const row = q('[data-inbox-action="A-2"]')!
    expect(row.textContent).toContain(en.inbox.actionKind.verify)
    fireEvent.click(row.querySelector('[data-inbox-copy="A-2"]')!)
    await flush()
    expect(writeText).toHaveBeenCalledWith('pwsh -File e2e/manual/nsis.ps1 -Version 0.8.0-pre.2')
    expect(answer).not.toHaveBeenCalled() // copying never sends or runs anything
    fireEvent.click(row.querySelector('[data-inbox-done="A-2"]')!)
    await flush()
    expect(answer).toHaveBeenLastCalledWith(t1.id, 'A-2：完成')
    fireEvent.click(Array.from(row.querySelectorAll('button')).find(b => b.textContent === en.inbox.action.failed)!)
    fireEvent.change(row.querySelector('input.inbox-free-input')!, { target: { value: 'installer error' } })
    fireEvent.click(row.querySelector('[data-inbox-fail-send="A-2"]')!)
    await flush()
    expect(answer).toHaveBeenLastCalledWith(t1.id, 'A-2：失敗 installer error')
  })

  it('reminders: only due / within 7 days', () => {
    tower('Tower', 2)
    act(() => setInboxFiles(WS_DIR, files(STATE())))
    renderPanel()
    expect(Array.from(document.querySelectorAll('[data-inbox-reminder]')).map(el => el.getAttribute('data-inbox-reminder'))).toEqual(['weekly-log-review'])
  })

  it('an item gone from the file shows under 最近已結', () => {
    tower('Tower', 2)
    act(() => setInboxFiles(WS_DIR, files(STATE())))
    renderPanel()
    expect(q('[data-inbox-recent]')).toBeNull()
    const after = STATE().replace(/  - id: "U-3"[\s\S]*?created_at: "2026-11-25T03:10:23\+0800"\n/, '')
    act(() => setInboxFiles(WS_DIR, files(after)))
    expect(q('[data-inbox-recent]')!.getAttribute('data-inbox-recent')).toBe('1')
    expect(q('[data-inbox-recent]')!.textContent).toContain('U-3')
  })
})

describe('answer targets', () => {
  it('two contract-2 Towers → the user picks', async () => {
    tower('Tower A', 2)
    const b = tower('Tower B', 2)
    act(() => setInboxFiles(WS_DIR, files(STATE())))
    renderPanel()
    const row = q('[data-inbox-action="A-2"]')!
    fireEvent.click(row.querySelector('[data-inbox-done="A-2"]')!)
    await flush()
    expect(answer).not.toHaveBeenCalled()
    fireEvent.click(row.querySelector(`[data-inbox-target="${b.id}"]`)!)
    await flush()
    expect(answer).toHaveBeenCalledWith(b.id, 'A-2：完成')
  })

  it('no declared Tower, state file 2 → the Claude panel Tower (refused while it has a draft)', async () => {
    const panel = workspaceStore.addTerminal(ws.id, 'claude-code')
    act(() => setInboxFiles(WS_DIR, files(STATE())))
    let draft = true
    const seen: string[] = []
    const listener = (e: Event) => {
      const detail = (e as CustomEvent<PanelTowerAnswerDetail>).detail
      if (detail.sessionId !== panel.id) return
      seen.push(detail.text)
      detail.respond(draft ? 'draft' : 'sent')
    }
    window.addEventListener(PANEL_TOWER_ANSWER_EVENT, listener)
    try {
      renderPanel()
      const row = q('[data-inbox-action="A-2"]')!
      fireEvent.click(row.querySelector('[data-inbox-done="A-2"]')!)
      await flush()
      expect(row.querySelector('[data-inbox-answer-status]')!.getAttribute('data-inbox-answer-status')).toBe('draft')
      draft = false
      fireEvent.click(row.querySelector('[data-inbox-done="A-2"]')!)
      await flush()
      expect(row.querySelector('[data-inbox-answer-status]')!.getAttribute('data-inbox-answer-status')).toBe('sent')
      expect(seen).toEqual(['A-2：完成', 'A-2：完成'])
      expect(answer).not.toHaveBeenCalled()
    } finally {
      window.removeEventListener(PANEL_TOWER_ANSWER_EVENT, listener)
    }
  })

  it('no panel mounted → not-mounted; no target at all → no-target', async () => {
    workspaceStore.addTerminal(ws.id, 'claude-code')
    act(() => setInboxFiles(WS_DIR, files(STATE())))
    renderPanel()
    const row = q('[data-inbox-action="A-2"]')!
    fireEvent.click(row.querySelector('[data-inbox-done="A-2"]')!)
    await flush()
    expect(row.querySelector('[data-inbox-answer-status]')!.getAttribute('data-inbox-answer-status')).toBe('not-mounted')
    cleanup()
    act(() => { for (const t of workspaceStore.getState().terminals.filter(t => t.workspaceId === ws.id)) workspaceStore.removeTerminal(t.id) })
    renderPanel()
    fireEvent.click(q('[data-inbox-done="A-2"]')!)
    await flush()
    expect(q('[data-inbox-answer-status]')!.getAttribute('data-inbox-answer-status')).toBe('no-target')
  })
})

describe('gating and user_inbox', () => {
  it('user_inbox: off → the note, no CT items; the BAT parts stay', () => {
    tower('Tower', 2)
    act(() => setInboxFiles(WS_DIR, files(STATE(), { userInbox: 'off' })))
    renderPanel()
    expect(q('[data-inbox-off]')).not.toBeNull()
    expect(q('[data-inbox-awaiting]')).toBeNull()
    expect(q('[data-inbox-action]')).toBeNull()
  })

  it('a non-matching Tower shows none of it (only the gate)', () => {
    tower('Tower', null)
    act(() => setInboxFiles(WS_DIR, files(STATE())))
    renderPanel()
    expect(q('[data-inbox-gate]')!.getAttribute('data-inbox-gate')).toBe('P-1')
    expect(q('[data-inbox-awaiting]')).toBeNull()
    expect(q('[data-inbox-badge]')!.getAttribute('data-inbox-badge')).toBe('!')
  })
})

describe('⏸N', () => {
  it('the workspace badge counts awaiting_user on a match only; a click opens the Inbox', () => {
    tower('Tower', 2)
    act(() => setInboxFiles(WS_DIR, files(STATE())))
    const opened: unknown[] = []
    const onOpen = (e: Event) => opened.push((e as CustomEvent).detail)
    window.addEventListener('bat:open-dock-panel', onOpen)
    try {
      render(<InboxAwaitingBadge workspaceId={ws.id} folderPath={WS_DIR} />)
      const badge = q('[data-inbox-awaiting-count]')!
      expect(badge.textContent).toBe('⏸2')
      fireEvent.click(badge)
      expect(opened).toEqual([{ panel: 'inbox' }])
    } finally {
      window.removeEventListener('bat:open-dock-panel', onOpen)
    }
  })

  it('state-only copy (another workspace) works; a mismatch shows nothing', () => {
    tower('Tower', 2)
    act(() => setInboxStateOnly(WS_DIR, { batContract: 2, lists: parseTowerStateInbox(STATE()) }))
    const { unmount } = render(<InboxAwaitingBadge workspaceId={ws.id} folderPath={WS_DIR} />)
    expect(q('[data-inbox-awaiting-count]')!.getAttribute('data-inbox-awaiting-count')).toBe('2')
    unmount()
    act(() => setInboxStateOnly(WS_DIR, { batContract: 1, lists: parseTowerStateInbox(STATE(1)) }))
    render(<InboxAwaitingBadge workspaceId={ws.id} folderPath={WS_DIR} />)
    expect(q('[data-inbox-awaiting-count]')).toBeNull()
  })

  it('a detached report carries awaiting (sanitized: whole numbers 1 … 9999 only)', () => {
    expect(detachedWaitingReport(null)).toEqual({ tabs: [], missed: [] })
    expect(detachedWaitingReport(null, 3)).toEqual({ tabs: [], missed: [], awaiting: 3 })
    expect(sanitizeDetachedWaitingReport({ tabs: [], missed: [], awaiting: 3 })).toEqual({ tabs: [], missed: [], awaiting: 3 })
    for (const bad of [0, -1, 1.5, '3', 10000]) {
      expect(sanitizeDetachedWaitingReport({ tabs: [], missed: [], awaiting: bad })).toEqual({ tabs: [], missed: [] })
    }
  })
})

describe('plumbing', () => {
  it('three languages have every W5 key', () => {
    const keys = (obj: Record<string, unknown>, prefix = ''): string[] => Object.entries(obj).flatMap(([k, v]) =>
      v && typeof v === 'object' ? keys(v as Record<string, unknown>, `${prefix}${k}.`) : [`${prefix}${k}`])
    const enKeys = keys(en.inbox as Record<string, unknown>).sort()
    expect(keys(zhTW.inbox as Record<string, unknown>).sort()).toEqual(enKeys)
    expect(keys(zhCN.inbox as Record<string, unknown>).sort()).toEqual(enKeys)
    for (const key of ['answer.send', 'action.copy', 'remind.overdue', 'source.worker-question', 'userInboxOff', 'awaitingBadge']) expect(enKeys).toContain(key)
  })

  it('the Claude panel answers the window event, refusing on a draft (source guard)', () => {
    const source = fsNode.readFileSync(pathNode.resolve(__dirname, '../ClaudeAgentPanel.tsx'), 'utf8')
    expect(source).toContain('window.addEventListener(PANEL_TOWER_ANSWER_EVENT, handler)')
    expect(source).toMatch(/inputValueRef\.current\.trim\(\) !== '' \|\| hasDraftRef\.current[\s\S]{0,80}detail\.respond\('draft'\)/)
    expect(source).toContain('void handleSendRef.current()')
  })

  it('the panel title string is free of the answer text in logs (sendInboxAnswer logs ids / lengths)', () => {
    const source = fsNode.readFileSync(pathNode.resolve(__dirname, '../../lib/inbox-answer.ts'), 'utf8')
    for (const line of source.split('\n').filter(l => l.includes('log(`'))) expect(line).not.toMatch(/\$\{text\}/)
    void screen
  })
})
