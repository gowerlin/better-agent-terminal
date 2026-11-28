/**
 * T0966 (U-58: A): the「待辦」(Inbox) tab no longer counts the user's own held answers as「待送 N 則通知」.
 *
 * - only answers held in the Tower tab's queue → not listed in「👷 Worker 等你」, not counted on the title
 * - Worker notifications + answers → only the Worker notifications are listed and counted
 * - the「已排入待送」mark shows why the answer still waits (the thumbnail menu's reason text) while its
 *   queue item is still queued and the tab reports a reason; otherwise the mark alone, as before
 * - the three locales have the strings
 */
import { act } from 'react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import i18n from '../../i18n'
import en from '../../locales/en.json'
import zhTW from '../../locales/zh-TW.json'
import zhCN from '../../locales/zh-CN.json'
import { InboxPanel, InboxTabBadge } from '../InboxPanel'
import { workspaceStore } from '../../stores/workspace-store'
import { applyTowerContract, resetTowerContractStore } from '../../stores/tower-contract-store'
import { applyNotifyHold, resetNotifyHoldStore } from '../../stores/notify-hold-store'
import { EMPTY_INBOX_FILES, resetInboxStore, setInboxFiles, type InboxFiles } from '../../stores/inbox-store'
import { resetDirWatches } from '../../stores/ct-dir-watch'
import { parseTowerState, parseTowerStateInbox } from '../../lib/ct-tower-overview'
import type { NotifyHoldItem } from '../../types/notify-hold'
import type { Workspace } from '../../types'

const WS_DIR = '/tmp/t0966-ws'

const STATE = `---
schema_kind: tower-state
summary_version: 1
bat_contract: 2
awaiting_user:
  - id: "U-1"
    summary: "made-up single choice"
    options: ["A 甲", "B 乙"]
    created_at: "2026-11-28T10:00:00+08:00"
---
# 塔台
`

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
let answer: ReturnType<typeof vi.fn>

beforeAll(async () => {
  await i18n.changeLanguage('en')
})

beforeEach(() => {
  answer = vi.fn(async () => ({ ok: true, held: true, holdId: 'h-7' }))
  ;(window as unknown as { electronAPI: unknown }).electronAPI = {
    fs: { readdir: vi.fn(async () => []), readFile: vi.fn(async () => ({ error: 'x' })), stat: vi.fn(async () => null), watch: vi.fn(async () => true), unwatch: vi.fn(async () => true), resetWatch: vi.fn(async () => true), onChanged: vi.fn(() => () => {}) },
    debug: { log: vi.fn() },
    pty: { onNotifyHoldChanged: vi.fn(() => () => {}), notifyHoldList: vi.fn(async () => []) },
    ctConfig: { readSources: vi.fn(async () => ({ global: { status: 'missing' }, defaults: { status: 'missing' } })) },
    towerInbox: { answer },
  }
  ws = workspaceStore.addWorkspace('T0966', WS_DIR)
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
  vi.restoreAllMocks()
  delete (window as unknown as { electronAPI?: unknown }).electronAPI
})

function tower() {
  const terminal = workspaceStore.addTerminal(ws.id, 'claude-cli')
  workspaceStore.setAutoTitle(terminal.id, 'Tower')
  applyTowerContract({ id: terminal.id, role: 'tower', towerContract: 2 })
  return terminal
}

function renderPanel() {
  act(() => setInboxFiles(WS_DIR, files()))
  return render(
    <>
      <span data-testid="tab">Inbox<InboxTabBadge workspaceId={ws.id} workspaceFolderPath={WS_DIR} /></span>
      <InboxPanel workspaceId={ws.id} workspaceFolderPath={WS_DIR} />
    </>,
  )
}

const q = (selector: string) => document.querySelector(selector) as HTMLElement | null
const badge = () => q('[data-inbox-badge]')?.getAttribute('data-inbox-badge') ?? null
const workers = () => q('[data-inbox-section="workers"]')!
const heldRows = () => workers().querySelectorAll('[data-inbox-worker="held"]')
const flush = () => act(async () => { await new Promise(r => setTimeout(r, 0)) })
const answerItem = (holdId: string, heldAt = 5): NotifyHoldItem => ({ holdId, heldAt, hasText: true, hasEnter: true, kind: 'answer' })
const workerItem = (holdId: string, heldAt = 5): NotifyHoldItem => ({ holdId, heldAt, hasText: true, hasEnter: true, sourceTerminalId: 'w-1', workorder: 'T0001' })

describe('「👷 Worker 等你」counts Worker notifications only', () => {
  it('only answers held → not listed, not counted on the title (the ⏸ item still counts)', () => {
    const t1 = tower()
    act(() => applyNotifyHold({ terminalId: t1.id, items: [answerItem('h-1'), answerItem('h-2')], reason: 'draft' }))
    renderPanel()
    expect(heldRows()).toHaveLength(0)
    expect(badge()).toBe('1') // U-1 only
  })

  it('Worker notifications + answers → only the Worker notifications are listed and counted', () => {
    const t1 = tower()
    act(() => applyNotifyHold({ terminalId: t1.id, items: [answerItem('h-1', 3), workerItem('h-2', 8), answerItem('h-3', 9), workerItem('h-4', 12)], reason: 'draft' }))
    renderPanel()
    expect(heldRows()).toHaveLength(1)
    expect(heldRows()[0].textContent).toContain(i18n.t('inbox.worker.held', { title: 'Tower', count: 2 }))
    expect(badge()).toBe('2') // U-1 + the Tower tab's Worker notifications (one row)
  })

  it('Worker notifications without `kind` are listed as before', () => {
    const t1 = tower()
    act(() => applyNotifyHold({ terminalId: t1.id, items: [workerItem('h-1')] }))
    renderPanel()
    expect(heldRows()).toHaveLength(1)
    expect(badge()).toBe('2')
  })
})

describe('the「已排入待送」mark shows why the answer waits', () => {
  const marker = () => q('[data-inbox-sent="U-1"]')
  const reasonLine = () => q('[data-inbox-sent-hold-reason="U-1"]')
  const send = async () => {
    fireEvent.click(q('[data-inbox-awaiting="U-1"] [data-inbox-option="A"] input')!)
    fireEvent.click(q('[data-inbox-awaiting="U-1"] .inbox-entry-buttons .inbox-btn.primary')!)
    await flush()
  }

  it.each([
    ['draft', en.notifyHold.reasonDraft],
    ['reading', en.notifyHold.reasonReading],
    ['permission', en.notifyHold.reasonPrompt],
    ['queued', en.notifyHold.reasonQueued],
  ] as const)('reason %s → the thumbnail menu text next to the mark', async (reason, text) => {
    const t1 = tower()
    renderPanel()
    await send()
    expect(answer).toHaveBeenLastCalledWith(t1.id, 'U-1：A')
    expect(marker()!.getAttribute('data-inbox-sent-status')).toBe('held')
    // main reports the queue: the answer waits, and why
    act(() => applyNotifyHold({ terminalId: t1.id, items: [answerItem('h-7')], reason }))
    expect(reasonLine()!.textContent).toBe(i18n.t('inbox.answer.heldReason', { reason: text }))
    expect(reasonLine()!.getAttribute('data-reason')).toBe(reason)
    // the mark's own text is unchanged (T0942)
    expect(marker()!.textContent).toMatch(/^✓ Queued for the Tower: U-1：A \(\d\d:\d\d\)$/)
  })

  it('no reason reported, or the answer left the queue → the mark alone, as before', async () => {
    const t1 = tower()
    renderPanel()
    await send()
    expect(reasonLine()).toBeNull() // nothing reported yet
    act(() => applyNotifyHold({ terminalId: t1.id, items: [answerItem('h-7')] }))
    expect(reasonLine()).toBeNull() // no reason (an older main)
    act(() => applyNotifyHold({ terminalId: t1.id, items: [answerItem('h-8')], reason: 'draft' }))
    expect(reasonLine()).toBeNull() // another item: this answer is no longer queued
    act(() => applyNotifyHold({ terminalId: t1.id, items: [], reason: 'draft' }))
    expect(reasonLine()).toBeNull()
    expect(marker()!.getAttribute('data-inbox-sent-status')).toBe('held')
  })

  it('an older host without `holdId` → the mark alone', async () => {
    const t1 = tower()
    answer.mockResolvedValueOnce({ ok: true, held: true })
    renderPanel()
    await send()
    act(() => applyNotifyHold({ terminalId: t1.id, items: [answerItem('h-7')], reason: 'draft' }))
    expect(marker()!.getAttribute('data-inbox-sent-status')).toBe('held')
    expect(reasonLine()).toBeNull()
  })
})

it('the three locales have the strings; the 📨 line names Worker notifications', () => {
  for (const locale of [en, zhTW, zhCN]) {
    expect(locale.inbox.answer.heldReason).toContain('{{reason}}')
    expect(locale.inbox.worker.held).toContain('{{title}}')
    expect(locale.inbox.worker.held).toContain('{{count}}')
    expect(locale.inbox.worker.held).toContain('Worker')
  }
  expect(zhTW.inbox.worker.held).toBe('📨 {{title}}：待送 {{count}} 則 Worker 通知')
  expect(zhTW.inbox.answer.heldReason).toBe('保留原因：{{reason}}')
})
