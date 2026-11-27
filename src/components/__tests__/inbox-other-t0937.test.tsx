/**
 * T0937 (PLAN-070 item 1): the「待辦」(Inbox) tab's「⏸ 待你決定」gets「其他（自由回答）」.
 *
 * - an item with options ends its radio group with「其他」; never the default, never 推薦
 * - picking it opens a one-line box below the list; 送出 / Enter sends `U-n：<文字>` through
 *   `tower-inbox:answer`; blank cannot be sent; Enter while an IME is composing does not send
 * - text starting with the word 放棄 / 略過 shows a hint and can still be sent
 * - picking an option again closes the box (the text is kept)
 * - `options: []` and invalid options keep the plain answer box (no「其他」)
 * - shown with and without `inbox_features: dismiss`
 * - the 放棄 note is a reason only (placeholder text)
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

const WS_DIR = '/tmp/t0937-ws'

const STATE = (features: string | null) => `---
schema_kind: tower-state
summary_version: 1
bat_contract: 2
${features === null ? '' : `inbox_features: ${features}\n`}awaiting_user:
  - id: "U-3"
    summary: "made-up question with a recommendation"
    options: ["A 接受", "B 退回"]
    recommended: "A"
    created_at: "2026-11-27T10:00:00+08:00"
  - id: "U-4"
    summary: "made-up question without a recommendation"
    options: ["A 甲", "B 乙"]
    created_at: "2026-11-27T10:01:00+08:00"
  - id: "U-5"
    summary: "made-up open question"
    options: []
    created_at: "2026-11-27T10:02:00+08:00"
  - id: "U-6"
    summary: "made-up question with bad options"
    options: ["沒有代號"]
    created_at: "2026-11-27T10:03:00+08:00"
---
# 塔台
`
const DISMISS = '["recommended", "dismiss"]'

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
  ws = workspaceStore.addWorkspace('T0937', WS_DIR)
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
const otherRadio = (el: HTMLElement) => el.querySelector('[data-inbox-option-other] input') as HTMLInputElement
const otherInput = (el: HTMLElement) => el.querySelector('[data-inbox-other-input]') as HTMLInputElement | null

describe('「其他（自由回答）」', () => {
  for (const features of [DISMISS, null]) {
    it(`is the last item of the radio group, not selected and not 推薦 (dismiss: ${features !== null})`, () => {
      tower()
      renderPanel(features)
      for (const id of ['U-3', 'U-4']) {
        const list = row(id).querySelector(`[data-inbox-option-list="${id}"]`)!
        const last = list.lastElementChild!
        expect(last.getAttribute('data-inbox-option-other')).toBe(id)
        expect(last.tagName).toBe('LABEL')
        expect(last.hasAttribute('data-inbox-option')).toBe(false)
        expect(last.textContent).toBe(en.inbox.answer.other)
        expect(last.querySelector('[data-inbox-recommended]')).toBeNull()
        expect((last.querySelector('input') as HTMLInputElement).type).toBe('radio')
        expect((last.querySelector('input') as HTMLInputElement).checked).toBe(false)
        expect((last.querySelector('input') as HTMLInputElement).name).toBe(`inbox-${id}`)
        expect(otherInput(row(id))).toBeNull()
      }
      // the recommended option is still selected by default (T0922)
      expect((row('U-3').querySelector('[data-inbox-option="A"] input') as HTMLInputElement).checked).toBe(true)
    })
  }

  it('picked → a box below the list (before the buttons); 送出 sends `U-n：<文字>`', async () => {
    const t1 = tower()
    renderPanel(DISMISS)
    const entry = row('U-3')
    fireEvent.click(otherRadio(entry))
    expect(otherRadio(entry).checked).toBe(true)
    expect((entry.querySelector('[data-inbox-option="A"] input') as HTMLInputElement).checked).toBe(false)
    const input = otherInput(entry)!
    expect(input).not.toBeNull()
    expect(input.classList.contains('inbox-free-input')).toBe(true)
    expect(input.maxLength).toBe(900)
    const list = entry.querySelector('[data-inbox-option-list="U-3"]')!
    const buttons = entry.querySelector('[data-inbox-entry-buttons="U-3"]')!
    expect(list.contains(input)).toBe(false)
    expect(list.compareDocumentPosition(input) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(input.compareDocumentPosition(buttons) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    // blank → cannot be sent
    expect(sendButton(entry).disabled).toBe(true)
    fireEvent.change(input, { target: { value: '   ' } })
    expect(sendButton(entry).disabled).toBe(true)
    fireEvent.keyDown(input, { key: 'Enter' })
    await flush()
    expect(answer).not.toHaveBeenCalled()

    fireEvent.change(input, { target: { value: 'a third way\tplease' } })
    expect(sendButton(entry).disabled).toBe(false)
    fireEvent.click(sendButton(entry))
    await flush()
    expect(answer).toHaveBeenLastCalledWith(t1.id, 'U-3：a third way please')
    expect(entry.querySelector('[data-inbox-answer-status]')!.getAttribute('data-inbox-answer-status')).toBe('sent')
    // sent → back to the default selection, the box closed
    expect(otherInput(entry)).toBeNull()
    expect((entry.querySelector('[data-inbox-option="A"] input') as HTMLInputElement).checked).toBe(true)
  })

  it('Enter sends; Enter while an IME is composing does not', async () => {
    const t1 = tower()
    renderPanel(null)
    const entry = row('U-4')
    fireEvent.click(otherRadio(entry))
    const input = otherInput(entry)!
    fireEvent.change(input, { target: { value: '自訂答案' } })
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true })
    await flush()
    expect(answer).not.toHaveBeenCalled()
    fireEvent.keyDown(input, { key: 'Enter' })
    await flush()
    expect(answer).toHaveBeenLastCalledWith(t1.id, 'U-4：自訂答案')
  })

  it('text starting with the word 放棄 / 略過 shows a hint, and can still be sent', async () => {
    const t1 = tower()
    renderPanel(DISMISS)
    const entry = row('U-4')
    fireEvent.click(otherRadio(entry))
    const input = otherInput(entry)!
    fireEvent.change(input, { target: { value: '放棄了一半' } })
    expect(entry.querySelector('[data-inbox-other-hint]')).toBeNull() // not the word (CT's rule)
    fireEvent.change(input, { target: { value: '改用 B 的做法' } })
    expect(entry.querySelector('[data-inbox-other-hint]')).toBeNull()
    for (const text of ['放棄 這題不需要了', '略過', '  放棄，以後再說']) {
      fireEvent.change(input, { target: { value: text } })
      expect(entry.querySelector('[data-inbox-other-hint="U-4"]')!.textContent).toBe(en.inbox.answer.otherDismissHint)
    }
    expect(sendButton(entry).disabled).toBe(false)
    fireEvent.change(input, { target: { value: '放棄 這題不需要了' } })
    fireEvent.click(sendButton(entry))
    await flush()
    expect(answer).toHaveBeenLastCalledWith(t1.id, 'U-4：放棄 這題不需要了')
  })

  it('picking an option again closes the box; the text is kept for when 其他 is picked again', async () => {
    const t1 = tower()
    renderPanel(null)
    const entry = row('U-4')
    fireEvent.click(otherRadio(entry))
    fireEvent.change(otherInput(entry)!, { target: { value: 'kept text' } })
    fireEvent.click(entry.querySelector('[data-inbox-option="B"] input')!)
    expect(otherInput(entry)).toBeNull()
    expect(otherRadio(entry).checked).toBe(false)
    fireEvent.click(sendButton(entry))
    await flush()
    expect(answer).toHaveBeenLastCalledWith(t1.id, 'U-4：B')
    fireEvent.click(otherRadio(entry))
    expect(otherInput(entry)!.value).toBe('')  // a sent answer resets the row
    fireEvent.change(otherInput(entry)!, { target: { value: 'kept text' } })
    fireEvent.click(entry.querySelector('[data-inbox-option="A"] input')!)
    fireEvent.click(otherRadio(entry))
    expect(otherInput(entry)!.value).toBe('kept text')
  })

  it('`options: []` and invalid options keep the plain answer box, without「其他」', () => {
    tower()
    renderPanel(DISMISS)
    for (const id of ['U-5', 'U-6']) {
      const entry = row(id)
      expect(entry.querySelector('[data-inbox-option-other]')).toBeNull()
      expect(entry.querySelector('[data-inbox-option-list]')).toBeNull()
      expect(entry.querySelector('[data-inbox-other-input]')).toBeNull()
      expect(entry.querySelectorAll('input.inbox-free-input')).toHaveLength(1)
    }
    expect(row('U-6').textContent).toContain(en.inbox.answer.optionsInvalid)
  })
})

describe('放棄 note', () => {
  it('the placeholder asks for a reason only', () => {
    tower()
    renderPanel(DISMISS)
    fireEvent.click(q('[data-inbox-dismiss="U-3"]')!)
    expect(q('[data-inbox-dismiss-note="U-3"]')!.getAttribute('placeholder')).toBe('Reason (one line, optional)')
    expect(en.inbox.dismiss.dismissNote).toBe('Reason (one line, optional)')
    expect(zhTW.inbox.dismiss.dismissNote).toBe('原因（一行，選填）')
    expect(zhCN.inbox.dismiss.dismissNote).toBe('原因（一行，选填）')
  })

  it('the three locales have the new strings', () => {
    expect(en.inbox.answer.other).toBe('Other (free answer)')
    expect(zhTW.inbox.answer.other).toBe('其他（自由回答）')
    expect(zhCN.inbox.answer.other).toBe('其他（自由回答）')
    for (const locale of [en, zhTW, zhCN]) expect(locale.inbox.answer.otherDismissHint).toMatch(/放棄.*略過/)
  })
})
