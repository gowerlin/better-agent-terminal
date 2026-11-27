/**
 * T0942 (D412): the「待辦」(Inbox) tab shows「✓ 已送出：<line>（HH:MM）」after an answer went out and keeps
 * what was sent — only a reminder, nothing is blocked.
 *
 * - sent: the mark with the line and the time, the selection kept, 送出 reads「重新送出」; another pick
 *   sends a new line (no confirmation); held →「已排入待送」
 * - the mark and the selection survive a remount (a tab switch); an item leaving the list forgets it
 * - failures (`failed` / `no-target`) are shown as before and never marked
 * - every kind of answer: single / multiple choice /「其他」/ the answer box / 🙋 完成 / 失敗 / 放棄 /
 *   略過 / batches (toolbar + each row)
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
import { EMPTY_INBOX_FILES, resetInboxStore, setInboxFiles, type InboxFiles } from '../../stores/inbox-store'
import { getInboxSentMap } from '../../stores/inbox-sent-store'
import { resetDirWatches } from '../../stores/ct-dir-watch'
import { parseTowerState, parseTowerStateInbox } from '../../lib/ct-tower-overview'
import type { Workspace } from '../../types'

const WS_DIR = '/tmp/t0942-ws'
const SECRET = 'made-up answer QZX'

const U1 = `  - id: "U-1"
    summary: "made-up single choice"
    options: ["A 甲（推薦）", "B 乙", "C 丙"]
    recommended: "A"
    created_at: "2026-11-27T10:00:00+08:00"
`
const U2 = `  - id: "U-2"
    summary: "made-up multiple choice"
    options: ["A 甲（推薦）", "B 乙", "C 丙（推薦）"]
    multi: true
    recommended: "A、C"
    created_at: "2026-11-27T10:01:00+08:00"
`
const U3 = `  - id: "U-3"
    summary: "made-up open question"
    options: []
    created_at: "2026-11-27T10:02:00+08:00"
`
const ACTIONS = `  - id: "A-1"
    title: "made-up check"
    kind: "verify"
    created_at: "2026-11-27T10:03:00+08:00"
  - id: "A-2"
    title: "made-up setting"
    kind: "manual"
    created_at: "2026-11-27T10:04:00+08:00"
`

const STATE = (awaiting = U1 + U2 + U3, actions = ACTIONS) => `---
schema_kind: tower-state
summary_version: 1
bat_contract: 2
inbox_features: ["recommended", "dismiss", "multi"]
awaiting_user:
${awaiting}user_actions:
${actions}---
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

// 15:42 local time: the mark shows `HH:MM`
const SENT_AT = new Date(2026, 10, 27, 15, 42, 7).getTime()

let ws: Workspace
let answer: ReturnType<typeof vi.fn>
let debugLog: ReturnType<typeof vi.fn>

beforeAll(async () => {
  await i18n.changeLanguage('en')
})

beforeEach(() => {
  vi.spyOn(Date, 'now').mockReturnValue(SENT_AT)
  answer = vi.fn(async () => ({ ok: true, held: false, holdId: 'h-1' }))
  debugLog = vi.fn()
  ;(window as unknown as { electronAPI: unknown }).electronAPI = {
    fs: { readdir: vi.fn(async () => []), readFile: vi.fn(async () => ({ error: 'x' })), stat: vi.fn(async () => null), watch: vi.fn(async () => true), unwatch: vi.fn(async () => true), resetWatch: vi.fn(async () => true), onChanged: vi.fn(() => () => {}) },
    debug: { log: debugLog },
    pty: { onNotifyHoldChanged: vi.fn(() => () => {}), notifyHoldList: vi.fn(async () => []) },
    ctConfig: { readSources: vi.fn(async () => ({ global: { status: 'missing' }, defaults: { status: 'missing' } })) },
    towerInbox: { answer },
  }
  ws = workspaceStore.addWorkspace('T0942', WS_DIR)
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

function renderPanel(state = STATE()) {
  act(() => setInboxFiles(WS_DIR, files(state)))
  return render(<InboxPanel workspaceId={ws.id} workspaceFolderPath={WS_DIR} />)
}

/** A tab switch: the panel unmounts and mounts again (the store keeps the records). */
function remount(view: ReturnType<typeof render>) {
  view.unmount()
  return render(<InboxPanel workspaceId={ws.id} workspaceFolderPath={WS_DIR} />)
}

const q = (selector: string) => document.querySelector(selector) as HTMLElement | null
const awaitingRow = (id: string) => q(`[data-inbox-awaiting="${id}"]`)!
const actionRow = (id: string) => q(`[data-inbox-action="${id}"]`)!
const marker = (id: string) => q(`[data-inbox-sent="${id}"]`)
const option = (el: HTMLElement, code: string) => el.querySelector(`[data-inbox-option="${code}"] input`) as HTMLInputElement
const otherRadio = (el: HTMLElement) => el.querySelector('[data-inbox-option-other] input') as HTMLInputElement
const primary = (el: HTMLElement) => el.querySelector('.inbox-entry-buttons .inbox-btn.primary') as HTMLButtonElement
const flush = () => act(async () => { await new Promise(r => setTimeout(r, 0)) })
const sentText = (line: string) => `✓ Sent: ${line} (15:42)`

describe('single choice', () => {
  it('sent → the mark with the line and time, the choice kept, 送出 reads 重新送出; another pick sends a new line', async () => {
    const t1 = tower()
    renderPanel()
    const row = awaitingRow('U-1')
    expect(primary(row).textContent).toBe(en.inbox.answer.send)
    expect(marker('U-1')).toBeNull()
    fireEvent.click(primary(row))
    await flush()
    expect(answer).toHaveBeenLastCalledWith(t1.id, 'U-1：A')
    expect(marker('U-1')!.textContent).toBe(sentText('U-1：A'))
    expect(marker('U-1')!.getAttribute('data-inbox-sent-status')).toBe('sent')
    expect(row.querySelector('[data-inbox-answer-status]')!.getAttribute('data-inbox-answer-status')).toBe('sent')
    // not reset: the sent (recommended) option is still picked
    expect(option(row, 'A').checked).toBe(true)
    expect(primary(row).textContent).toBe(en.inbox.answer.resend)
    expect(primary(row).disabled).toBe(false)

    // the user picked wrong: pick B and send again — no confirmation, a new line
    fireEvent.click(option(row, 'B'))
    expect(option(row, 'A').checked).toBe(false)
    fireEvent.click(primary(row))
    await flush()
    expect(answer).toHaveBeenCalledTimes(2)
    expect(answer).toHaveBeenLastCalledWith(t1.id, 'U-1：B')
    expect(marker('U-1')!.textContent).toBe(sentText('U-1：B'))
    expect(option(row, 'B').checked).toBe(true)
  })

  it('held in the Tower queue →「已排入待送」', async () => {
    tower()
    answer.mockResolvedValueOnce({ ok: true, held: true, holdId: 'h-2' })
    renderPanel()
    fireEvent.click(primary(awaitingRow('U-1')))
    await flush()
    expect(marker('U-1')!.textContent).toBe('✓ Queued for the Tower: U-1：A (15:42)')
    expect(marker('U-1')!.getAttribute('data-inbox-sent-status')).toBe('held')
    expect(awaitingRow('U-1').querySelector('[data-inbox-answer-status]')!.getAttribute('data-inbox-answer-status')).toBe('held')
  })

  it('a remount (tab switch) keeps the mark and the sent choice; the 推薦 default no longer applies', async () => {
    tower()
    const view = renderPanel()
    fireEvent.click(option(awaitingRow('U-1'), 'C'))
    fireEvent.click(primary(awaitingRow('U-1')))
    await flush()
    remount(view)
    const row = awaitingRow('U-1')
    expect(marker('U-1')!.textContent).toBe(sentText('U-1：C'))
    expect(option(row, 'C').checked).toBe(true)
    expect(option(row, 'A').checked).toBe(false)
    expect(primary(row).textContent).toBe(en.inbox.answer.resend)
    // the never-sent rows are as before
    expect(marker('U-2')).toBeNull()
    expect(primary(awaitingRow('U-2')).textContent).toBe(en.inbox.answer.send)
  })

  it('the item leaving the list (the Tower handled it) forgets the record; back again → as never sent', async () => {
    tower()
    renderPanel()
    fireEvent.click(primary(awaitingRow('U-1')))
    await flush()
    expect(getInboxSentMap(WS_DIR).has('U-1')).toBe(true)
    // the state file is read again with U-1 still listed: kept
    act(() => setInboxFiles(WS_DIR, files(STATE())))
    expect(marker('U-1')).not.toBeNull()
    act(() => setInboxFiles(WS_DIR, files(STATE(U2 + U3))))
    expect(q('[data-inbox-awaiting="U-1"]')).toBeNull()
    expect(getInboxSentMap(WS_DIR).has('U-1')).toBe(false)
    act(() => setInboxFiles(WS_DIR, files(STATE())))
    const row = awaitingRow('U-1')
    expect(marker('U-1')).toBeNull()
    expect(option(row, 'A').checked).toBe(true)
    expect(primary(row).textContent).toBe(en.inbox.answer.send)
  })

  it('failures are shown as before and never marked; a failure after a send keeps the earlier mark', async () => {
    tower()
    answer.mockResolvedValueOnce({ ok: false, reason: 'boom' })
    renderPanel()
    const row = awaitingRow('U-1')
    fireEvent.click(primary(row))
    await flush()
    expect(marker('U-1')).toBeNull()
    expect(row.querySelector('[data-inbox-answer-status]')!.getAttribute('data-inbox-answer-status')).toBe('failed')
    expect(primary(row).textContent).toBe(en.inbox.answer.send)
    expect(getInboxSentMap(WS_DIR).size).toBe(0)

    fireEvent.click(primary(row))
    await flush()
    expect(marker('U-1')!.textContent).toBe(sentText('U-1：A'))
    answer.mockResolvedValueOnce({ ok: false, reason: 'boom' })
    fireEvent.click(option(row, 'B'))
    fireEvent.click(primary(row))
    await flush()
    // the live failure is the first status; the earlier mark stays below it
    expect(row.querySelector('[data-inbox-answer-status]')!.getAttribute('data-inbox-answer-status')).toBe('failed')
    expect(marker('U-1')!.textContent).toBe(sentText('U-1：A'))
    expect(marker('U-1')!.hasAttribute('data-inbox-answer-status')).toBe(false)
  })

  it('no Tower → no-target as before, nothing marked', async () => {
    renderPanel()
    fireEvent.click(primary(awaitingRow('U-1')))
    await flush()
    expect(answer).not.toHaveBeenCalled()
    expect(awaitingRow('U-1').querySelector('[data-inbox-answer-status]')!.getAttribute('data-inbox-answer-status')).toBe('no-target')
    expect(marker('U-1')).toBeNull()
  })
})

describe('multiple choice / 其他 / the answer box', () => {
  it('multiple choice: the checks are kept, also after a remount', async () => {
    const t1 = tower()
    const view = renderPanel()
    fireEvent.click(option(awaitingRow('U-2'), 'B'))
    fireEvent.click(primary(awaitingRow('U-2')))
    await flush()
    expect(answer).toHaveBeenLastCalledWith(t1.id, 'U-2：A、B、C')
    expect(['A', 'B', 'C'].map(code => option(awaitingRow('U-2'), code).checked)).toEqual([true, true, true])
    expect(marker('U-2')!.textContent).toBe(sentText('U-2：A、B、C'))
    remount(view)
    expect(['A', 'B', 'C'].map(code => option(awaitingRow('U-2'), code).checked)).toEqual([true, true, true])
    // uncheck C and send again: the new line
    fireEvent.click(option(awaitingRow('U-2'), 'C'))
    fireEvent.click(primary(awaitingRow('U-2')))
    await flush()
    expect(answer).toHaveBeenLastCalledWith(t1.id, 'U-2：A、B')
    expect(marker('U-2')!.textContent).toBe(sentText('U-2：A、B'))
  })

  it('其他: the picked「其他」and its text are kept, also after a remount', async () => {
    const t1 = tower()
    const view = renderPanel()
    fireEvent.click(otherRadio(awaitingRow('U-1')))
    fireEvent.change(q('[data-inbox-other-input="U-1"]')!, { target: { value: SECRET } })
    fireEvent.click(primary(awaitingRow('U-1')))
    await flush()
    expect(answer).toHaveBeenLastCalledWith(t1.id, `U-1：${SECRET}`)
    expect(otherRadio(awaitingRow('U-1')).checked).toBe(true)
    expect((q('[data-inbox-other-input="U-1"]') as HTMLInputElement).value).toBe(SECRET)
    remount(view)
    expect(otherRadio(awaitingRow('U-1')).checked).toBe(true)
    expect(option(awaitingRow('U-1'), 'A').checked).toBe(false)
    expect((q('[data-inbox-other-input="U-1"]') as HTMLInputElement).value).toBe(SECRET)
    expect(marker('U-1')!.textContent).toBe(sentText(`U-1：${SECRET}`))
    // 🔴 logs never carry the answer (T0908 rule, unchanged)
    expect(debugLog.mock.calls.some(call => String(call[0]).includes(SECRET))).toBe(false)
  })

  it('the answer box keeps its text, also after a remount', async () => {
    const t1 = tower()
    const view = renderPanel()
    const input = () => awaitingRow('U-3').querySelector('.inbox-free-input') as HTMLInputElement
    fireEvent.change(input(), { target: { value: 'later' } })
    fireEvent.click(primary(awaitingRow('U-3')))
    await flush()
    expect(answer).toHaveBeenLastCalledWith(t1.id, 'U-3：later')
    expect(input().value).toBe('later')
    expect(primary(awaitingRow('U-3')).textContent).toBe(en.inbox.answer.resend)
    remount(view)
    expect(input().value).toBe('later')
    expect(marker('U-3')!.textContent).toBe(sentText('U-3：later'))
  })
})

describe('🙋 and 放棄 / 略過', () => {
  it('完成 and 失敗… mark the row; the failure form reads 重新送出 once sent', async () => {
    const t1 = tower()
    renderPanel()
    fireEvent.click(q('[data-inbox-done="A-1"]')!)
    await flush()
    expect(answer).toHaveBeenLastCalledWith(t1.id, 'A-1：完成')
    expect(marker('A-1')!.textContent).toBe(sentText('A-1：完成'))

    const failButton = Array.from(actionRow('A-1').querySelectorAll('button')).find(b => b.textContent === en.inbox.action.failed)!
    fireEvent.click(failButton)
    const send = actionRow('A-1').querySelector('[data-inbox-fail-send="A-1"]') as HTMLButtonElement
    expect(send.textContent).toBe(en.inbox.answer.resend)
    fireEvent.change(actionRow('A-1').querySelector('.inbox-free-input')!, { target: { value: 'no device' } })
    fireEvent.click(send)
    await flush()
    expect(answer).toHaveBeenLastCalledWith(t1.id, 'A-1：失敗 no device')
    expect(marker('A-1')!.textContent).toBe(sentText('A-1：失敗 no device'))

    // a never-sent action's failure form still reads 送出
    fireEvent.click(Array.from(actionRow('A-2').querySelectorAll('button')).find(b => b.textContent === en.inbox.action.failed)!)
    expect((actionRow('A-2').querySelector('[data-inbox-fail-send="A-2"]') as HTMLButtonElement).textContent).toBe(en.inbox.answer.send)
  })

  it('one row 放棄 / 略過 marks that row', async () => {
    const t1 = tower()
    renderPanel()
    fireEvent.click(q('[data-inbox-dismiss="U-2"]')!)
    fireEvent.click(q('[data-inbox-dismiss-send="U-2"]')!)
    await flush()
    expect(answer).toHaveBeenLastCalledWith(t1.id, 'U-2：放棄')
    expect(marker('U-2')!.textContent).toBe(sentText('U-2：放棄'))
    fireEvent.click(q('[data-inbox-dismiss="A-2"]')!)
    fireEvent.click(q('[data-inbox-dismiss-send="A-2"]')!)
    await flush()
    expect(answer).toHaveBeenLastCalledWith(t1.id, 'A-2：略過')
    expect(marker('A-2')!.textContent).toBe(sentText('A-2：略過'))
  })

  it('batches: the toolbar and each row of the line are marked; kept across a remount; forgotten with the items', async () => {
    const t1 = tower()
    const view = renderPanel()
    fireEvent.click(q('[data-inbox-check="U-1"]')!)
    fireEvent.click(q('[data-inbox-check="U-3"]')!)
    fireEvent.click(q('[data-inbox-dismiss-checked="awaiting"]')!)
    fireEvent.click(q('[data-inbox-dismiss-batch-send="awaiting"]')!)
    await flush()
    expect(answer).toHaveBeenLastCalledWith(t1.id, 'U-1、U-3：放棄')
    expect(marker('__batch__:awaiting')!.textContent).toBe(sentText('U-1、U-3：放棄'))
    expect(marker('U-1')!.textContent).toBe(sentText('U-1、U-3：放棄'))
    expect(marker('U-3')!.textContent).toBe(sentText('U-1、U-3：放棄'))
    expect(marker('U-2')).toBeNull()

    fireEvent.click(q('[data-inbox-dismiss-all="action"]')!)
    fireEvent.click(q('[data-inbox-dismiss-batch-send="action"]')!)
    await flush()
    expect(answer).toHaveBeenLastCalledWith(t1.id, 'A-1、A-2：略過')
    for (const id of ['__batch__:action', 'A-1', 'A-2']) expect(marker(id)!.textContent).toBe(sentText('A-1、A-2：略過'))

    remount(view)
    expect(marker('__batch__:awaiting')).not.toBeNull()
    expect(marker('U-1')).not.toBeNull()
    expect(marker('A-2')).not.toBeNull()

    // U-1 handled: its row record goes, the batch line stays while U-3 is listed
    act(() => setInboxFiles(WS_DIR, files(STATE(U2 + U3))))
    expect(getInboxSentMap(WS_DIR).has('U-1')).toBe(false)
    expect(marker('__batch__:awaiting')).not.toBeNull()
    // every id handled → the batch record goes too
    act(() => setInboxFiles(WS_DIR, files(STATE(U2, ''))))
    expect(getInboxSentMap(WS_DIR).has('__batch__:awaiting')).toBe(false)
    expect(getInboxSentMap(WS_DIR).has('__batch__:action')).toBe(false)
    expect(marker('__batch__:awaiting')).toBeNull()
  })
})

it('the three locales have the new strings', () => {
  for (const locale of [en, zhTW, zhCN]) {
    expect(locale.inbox.answer.resend).toBeTruthy()
    expect(locale.inbox.answer.sentMarker).toContain('{{text}}')
    expect(locale.inbox.answer.sentMarker).toContain('{{time}}')
    expect(locale.inbox.answer.heldMarker).toContain('{{text}}')
    expect(locale.inbox.answer.heldMarker).toContain('{{time}}')
  }
  expect(zhTW.inbox.answer.resend).toBe('重新送出')
  expect(zhTW.inbox.answer.sentMarker).toBe('✓ 已送出：{{text}}（{{time}}）')
  expect(zhTW.inbox.answer.heldMarker).toBe('✓ 已排入待送：{{text}}（{{time}}）')
})
