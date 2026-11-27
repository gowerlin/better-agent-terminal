/**
 * T0938 (PLAN-070 item 4, CT 6.3.0): multiple choice in「⏸ 待你決定」.
 *
 * - `inbox_features: multi` + `multi: true` + ≥ 2 options → check boxes (`role="group"`) and a「可複選」line;
 *   every recommended code marked and checked by default
 * - 送出 sends `U-n：A、C` in `options` order / `U-n：A`; nothing checked → cannot send
 * -「其他」stays last and is exclusive with the checks; sends `U-n：<文字>`
 * - no flag / `multi` not `true` / one option → the single-choice row of before
 * - 放棄… still there on a multiple-choice item
 * - T0937 follow-up: the plain answer box (`options: []`) shows the 放棄 / 略過 hint
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
import { resetDirWatches } from '../../stores/ct-dir-watch'
import { parseTowerState, parseTowerStateInbox } from '../../lib/ct-tower-overview'
import type { Workspace } from '../../types'

const WS_DIR = '/tmp/t0938-ws'

const STATE = (features: string | null) => `---
schema_kind: tower-state
summary_version: 1
bat_contract: 2
${features === null ? '' : `inbox_features: ${features}\n`}awaiting_user:
  - id: "U-3"
    summary: "made-up multiple-choice question"
    options: ["A 甲（推薦）", "B 乙", "C 丙（推薦）"]
    multi: true
    recommended: "A、C"
    created_at: "2026-11-27T10:00:00+08:00"
  - id: "U-4"
    summary: "made-up multiple-choice question without a recommendation"
    options: ["A 甲", "B 乙", "C 丙"]
    multi: true
    created_at: "2026-11-27T10:01:00+08:00"
  - id: "U-5"
    summary: "made-up one-option question"
    options: ["A 甲"]
    multi: true
    recommended: "A"
    created_at: "2026-11-27T10:02:00+08:00"
  - id: "U-6"
    summary: "made-up quoted multi"
    options: ["A 甲", "B 乙"]
    multi: "true"
    recommended: "B"
    created_at: "2026-11-27T10:03:00+08:00"
  - id: "U-7"
    summary: "made-up open question"
    options: []
    created_at: "2026-11-27T10:04:00+08:00"
---
# 塔台
`
const MULTI = '["recommended", "dismiss", "multi"]'
const NO_MULTI = '["recommended", "dismiss"]'

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
  answer = vi.fn(async () => ({ ok: true, held: false, holdId: 'h-1' }))
  ;(window as unknown as { electronAPI: unknown }).electronAPI = {
    fs: { readdir: vi.fn(async () => []), readFile: vi.fn(async () => ({ error: 'x' })), stat: vi.fn(async () => null), watch: vi.fn(async () => true), unwatch: vi.fn(async () => true), resetWatch: vi.fn(async () => true), onChanged: vi.fn(() => () => {}) },
    debug: { log: vi.fn() },
    pty: { onNotifyHoldChanged: vi.fn(() => () => {}), notifyHoldList: vi.fn(async () => []) },
    ctConfig: { readSources: vi.fn(async () => ({ global: { status: 'missing' }, defaults: { status: 'missing' } })) },
    towerInbox: { answer },
  }
  ws = workspaceStore.addWorkspace('T0938', WS_DIR)
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

function tower() {
  const terminal = workspaceStore.addTerminal(ws.id, 'claude-cli')
  workspaceStore.setAutoTitle(terminal.id, 'Tower')
  applyTowerContract({ id: terminal.id, role: 'tower', towerContract: 2 })
  return terminal
}

function renderPanel(features: string | null) {
  act(() => setInboxFiles(WS_DIR, files(STATE(features))))
  return render(<InboxPanel workspaceId={ws.id} workspaceFolderPath={WS_DIR} />)
}

const q = (selector: string) => document.querySelector(selector) as HTMLElement | null
const row = (id: string) => q(`[data-inbox-awaiting="${id}"]`)!
const flush = () => act(async () => { await new Promise(r => setTimeout(r, 0)) })
const sendButton = (el: HTMLElement) => Array.from(el.querySelectorAll('button')).find(b => b.textContent === en.inbox.answer.send) as HTMLButtonElement
const option = (el: HTMLElement, code: string) => el.querySelector(`[data-inbox-option="${code}"] input`) as HTMLInputElement
const other = (el: HTMLElement) => el.querySelector('[data-inbox-option-other] input') as HTMLInputElement
const otherInput = (el: HTMLElement) => el.querySelector('[data-inbox-other-input]') as HTMLInputElement | null

describe('multiple choice', () => {
  it('flag + multi: true → check boxes in a group, 可複選, every recommended code checked and marked', () => {
    tower()
    renderPanel(MULTI)
    const entry = row('U-3')
    const list = entry.querySelector('[data-inbox-option-list="U-3"]')!
    expect(list.getAttribute('role')).toBe('group')
    expect(list.getAttribute('data-inbox-multi')).toBe('U-3')
    expect(entry.querySelector('[data-inbox-multi-hint="U-3"]')!.textContent).toBe(en.inbox.answer.multiHint)
    for (const code of ['A', 'B', 'C']) expect(option(entry, code).type).toBe('checkbox')
    expect([option(entry, 'A').checked, option(entry, 'B').checked, option(entry, 'C').checked]).toEqual([true, false, true])
    expect(Array.from(entry.querySelectorAll('[data-inbox-recommended]')).map(el => el.getAttribute('data-inbox-recommended'))).toEqual(['A', 'C'])
    // 其他 is last, a check box, not checked, not 推薦
    const last = list.lastElementChild!
    expect(last.getAttribute('data-inbox-option-other')).toBe('U-3')
    expect(last.hasAttribute('data-inbox-option')).toBe(false)
    expect(other(entry).type).toBe('checkbox')
    expect(other(entry).checked).toBe(false)
    expect(last.querySelector('[data-inbox-recommended]')).toBeNull()
    // without a recommendation nothing is checked → cannot send
    const plain = row('U-4')
    expect(['A', 'B', 'C'].map(code => option(plain, code).checked)).toEqual([false, false, false])
    expect(sendButton(plain).disabled).toBe(true)
  })

  it('sends the recommended default `U-3：A、C`', async () => {
    const t1 = tower()
    renderPanel(MULTI)
    fireEvent.click(sendButton(row('U-3')))
    await flush()
    expect(answer).toHaveBeenLastCalledWith(t1.id, 'U-3：A、C')
    expect(row('U-3').querySelector('[data-inbox-answer-status]')!.getAttribute('data-inbox-answer-status')).toBe('sent')
  })

  it('two checks → `U-4：A、C` in options order (not the order checked); one check → `U-4：A`', async () => {
    const t1 = tower()
    renderPanel(MULTI)
    const entry = row('U-4')
    fireEvent.click(option(entry, 'C'))
    fireEvent.click(option(entry, 'A'))
    expect(sendButton(entry).disabled).toBe(false)
    fireEvent.click(sendButton(entry))
    await flush()
    expect(answer).toHaveBeenLastCalledWith(t1.id, 'U-4：A、C')
    // sent → reset to the default (nothing checked here)
    expect(['A', 'B', 'C'].map(code => option(entry, code).checked)).toEqual([false, false, false])
    fireEvent.click(option(entry, 'A'))
    fireEvent.click(sendButton(entry))
    await flush()
    expect(answer).toHaveBeenLastCalledWith(t1.id, 'U-4：A')
  })

  it('unchecking every option → cannot send', async () => {
    tower()
    renderPanel(MULTI)
    const entry = row('U-3')
    fireEvent.click(option(entry, 'A'))
    fireEvent.click(option(entry, 'C'))
    expect(sendButton(entry).disabled).toBe(true)
    fireEvent.click(sendButton(entry))
    await flush()
    expect(answer).not.toHaveBeenCalled()
  })

  it('「其他」and the checks are exclusive; 其他 sends `U-n：<文字>`', async () => {
    const t1 = tower()
    renderPanel(MULTI)
    const entry = row('U-3')
    fireEvent.click(other(entry))
    expect(other(entry).checked).toBe(true)
    expect(['A', 'B', 'C'].map(code => option(entry, code).checked)).toEqual([false, false, false])
    const input = otherInput(entry)!
    expect(input).not.toBeNull()
    expect(sendButton(entry).disabled).toBe(true)
    // checking an option clears 其他 (and closes its box)
    fireEvent.click(option(entry, 'B'))
    expect(other(entry).checked).toBe(false)
    expect(otherInput(entry)).toBeNull()
    expect(['A', 'B', 'C'].map(code => option(entry, code).checked)).toEqual([false, true, false])
    // back to 其他: the checks are cleared again
    fireEvent.click(other(entry))
    expect(option(entry, 'B').checked).toBe(false)
    fireEvent.change(otherInput(entry)!, { target: { value: '放棄 這題不需要了' } })
    expect(entry.querySelector('[data-inbox-other-hint="U-3"]')!.textContent).toBe(en.inbox.answer.otherDismissHint)
    fireEvent.change(otherInput(entry)!, { target: { value: 'both, but later' } })
    fireEvent.click(sendButton(entry))
    await flush()
    expect(answer).toHaveBeenLastCalledWith(t1.id, 'U-3：both, but later')
    // sent → the default checks are back
    expect([option(entry, 'A').checked, option(entry, 'C').checked]).toEqual([true, true])
  })

  it('unchecking 其他 leaves nothing checked (not the default)', () => {
    tower()
    renderPanel(MULTI)
    const entry = row('U-3')
    fireEvent.click(other(entry))
    fireEvent.click(other(entry))
    expect(other(entry).checked).toBe(false)
    expect(otherInput(entry)).toBeNull()
    expect(['A', 'B', 'C'].map(code => option(entry, code).checked)).toEqual([false, false, false])
    expect(sendButton(row('U-3')).disabled).toBe(true)
  })

  it('放棄… is still there on a multiple-choice item', async () => {
    const t1 = tower()
    renderPanel(MULTI)
    fireEvent.click(q('[data-inbox-dismiss="U-3"]')!)
    fireEvent.click(q('[data-inbox-dismiss-send="U-3"]')!)
    await flush()
    expect(answer).toHaveBeenLastCalledWith(t1.id, 'U-3：放棄')
  })
})

describe('single choice as before', () => {
  for (const features of [NO_MULTI, null]) {
    it(`without the multi flag the same item is a radio group (features: ${features})`, async () => {
      const t1 = tower()
      renderPanel(features)
      const entry = row('U-3')
      const list = entry.querySelector('[data-inbox-option-list="U-3"]')!
      expect(list.getAttribute('role')).toBe('radiogroup')
      expect(list.hasAttribute('data-inbox-multi')).toBe(false)
      expect(entry.querySelector('[data-inbox-multi-hint]')).toBeNull()
      for (const code of ['A', 'B', 'C']) expect(option(entry, code).type).toBe('radio')
      // "A、C" on a single-choice item is no recommendation
      expect(entry.querySelector('[data-inbox-recommended]')).toBeNull()
      expect(sendButton(entry).disabled).toBe(true)
      fireEvent.click(option(entry, 'B'))
      fireEvent.click(sendButton(entry))
      await flush()
      expect(answer).toHaveBeenLastCalledWith(t1.id, 'U-3：B')
    })
  }

  it('multi: true with one option, and multi: "true", stay single choice', () => {
    tower()
    renderPanel(MULTI)
    for (const [id, recommended] of [['U-5', 'A'], ['U-6', 'B']] as const) {
      const entry = row(id)
      expect(entry.querySelector(`[data-inbox-option-list="${id}"]`)!.getAttribute('role')).toBe('radiogroup')
      expect(entry.querySelector('[data-inbox-multi-hint]')).toBeNull()
      expect(option(entry, recommended).type).toBe('radio')
      expect(option(entry, recommended).checked).toBe(true)
      expect(entry.querySelector(`[data-inbox-recommended="${recommended}"]`)).not.toBeNull()
    }
  })
})

describe('T0937 follow-up: the plain answer box hint', () => {
  it('`options: []`: text starting with the word 放棄 / 略過 shows the hint and still sends', async () => {
    const t1 = tower()
    renderPanel(MULTI)
    const entry = row('U-7')
    const input = entry.querySelector('input.inbox-free-input') as HTMLInputElement
    expect(entry.querySelector('[data-inbox-free-hint]')).toBeNull()
    fireEvent.change(input, { target: { value: '放棄了一半' } })
    expect(entry.querySelector('[data-inbox-free-hint]')).toBeNull()
    for (const text of ['放棄 這題不需要了', '略過', '  放棄，以後再說']) {
      fireEvent.change(input, { target: { value: text } })
      expect(entry.querySelector('[data-inbox-free-hint="U-7"]')!.textContent).toBe(en.inbox.answer.otherDismissHint)
    }
    fireEvent.change(input, { target: { value: '略過' } })
    expect(sendButton(entry).disabled).toBe(false)
    fireEvent.click(sendButton(entry))
    await flush()
    expect(answer).toHaveBeenLastCalledWith(t1.id, 'U-7：略過')
  })
})

describe('locales', () => {
  it('the three locales have multiHint', () => {
    expect(en.inbox.answer.multiHint).toBe('Select one or more')
    expect(zhTW.inbox.answer.multiHint).toBe('可複選')
    expect(zhCN.inbox.answer.multiHint).toBe('可多选')
  })
})
