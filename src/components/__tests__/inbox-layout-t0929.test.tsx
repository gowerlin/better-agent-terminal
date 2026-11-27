/**
 * T0929: the「待辦」(Inbox) entry layout (structure only; answers and sending are covered by
 * inbox-w5 / inbox-plan069).
 *
 * - the summary / title is a block of its own after the head line, not inside it
 * - every option is its own block element inside the option list (the radio group)
 * - 送出 and 放棄… sit in one button line outside the option list; the 放棄 note opens after that line
 * - without `dismiss`: the button line holds only 送出, same place
 * - a free answer: the input, then the button line
 * - 🙋 待你執行: the title below the head line; 完成 / 失敗… / 略過… in their own line
 */
import { act } from 'react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import i18n from '../../i18n'
import en from '../../locales/en.json'
import { InboxPanel } from '../InboxPanel'
import { workspaceStore } from '../../stores/workspace-store'
import { applyTowerContract, resetTowerContractStore } from '../../stores/tower-contract-store'
import { resetNotifyHoldStore } from '../../stores/notify-hold-store'
import { EMPTY_INBOX_FILES, resetInboxStore, setInboxFiles, type InboxFiles } from '../../stores/inbox-store'
import { resetDirWatches } from '../../stores/ct-dir-watch'
import { parseTowerState, parseTowerStateInbox } from '../../lib/ct-tower-overview'
import type { Workspace } from '../../types'

const WS_DIR = '/tmp/t0929-ws'

const STATE = (features: string | null) => `---
schema_kind: tower-state
summary_version: 1
bat_contract: 2
${features === null ? '' : `inbox_features: ${features}\n`}awaiting_user:
  - id: "U-3"
    workorder: "T0901"
    kind: "decision"
    source: "breakpoint-A"
    summary: "A long made-up question about how the sample feature should be merged and what to keep"
    options: ["A ok", "B no", "C later"]
    recommended: "A"
    created_at: "2026-11-25T21:00:00+08:00"
  - id: "U-5"
    summary: "A made-up free answer question"
    options: ["yes please", "no"]
    created_at: "2026-11-25T21:01:00+08:00"
user_actions:
  - id: "A-2"
    title: "Run the sample acceptance script"
    kind: "verify"
    command: "pwsh -File sample.ps1"
    created_at: "2026-11-25T21:02:00+08:00"
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

beforeAll(async () => {
  await i18n.changeLanguage('en')
})

beforeEach(() => {
  ;(window as unknown as { electronAPI: unknown }).electronAPI = {
    fs: { readdir: vi.fn(async () => []), readFile: vi.fn(async () => ({ error: 'x' })), stat: vi.fn(async () => null), watch: vi.fn(async () => true), unwatch: vi.fn(async () => true), resetWatch: vi.fn(async () => true), onChanged: vi.fn(() => () => {}) },
    debug: { log: vi.fn() },
    pty: { onNotifyHoldChanged: vi.fn(() => () => {}), notifyHoldList: vi.fn(async () => []) },
    ctConfig: { readSources: vi.fn(async () => ({ global: { status: 'missing' }, defaults: { status: 'missing' } })) },
    towerInbox: { answer: vi.fn(async () => ({ ok: true, held: false, holdId: 'h-1' })) },
  }
  ws = workspaceStore.addWorkspace('T0929', WS_DIR)
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

function renderPanel(features: string | null) {
  act(() => setInboxFiles(WS_DIR, files(STATE(features))))
  render(<InboxPanel workspaceId={ws.id} workspaceFolderPath={WS_DIR} />)
}

const row = (selector: string) => document.querySelector(selector) as HTMLElement
const buttonTexts = (el: Element) => Array.from(el.querySelectorAll('button')).map(b => b.textContent)
/** Children of `el` in DOM order, by a marker attribute (or class) each one carries. */
const order = (el: Element, markers: string[]) =>
  Array.from(el.children).map(child => markers.find(m => child.matches(m)) ?? null).filter(Boolean)

describe('⏸ 待你決定 with options', () => {
  for (const features of [DISMISS, null]) {
    it(`summary below the head, one option per block, buttons in their own line (dismiss: ${features !== null})`, () => {
      renderPanel(features)
      const entry = row('[data-inbox-awaiting="U-3"]')
      const head = entry.querySelector('.inbox-entry-head')!
      const summary = entry.querySelector('[data-inbox-summary="U-3"]')!
      expect(summary.textContent).toContain('long made-up question')
      expect(head.contains(summary)).toBe(false)
      expect(summary.parentElement).toBe(entry)
      expect(head.textContent).not.toContain('long made-up question')
      expect(head.querySelector('.inbox-item-id')?.textContent).toBe('U-3')
      expect(!!head.querySelector('[data-inbox-check="U-3"]')).toBe(features !== null)

      const list = entry.querySelector('[data-inbox-option-list="U-3"]')!
      expect(list.getAttribute('role')).toBe('radiogroup')
      const options = Array.from(list.children)
      // T0937 (Q-1 A, Tower-approved): the list ends with「其他」, which carries no `data-inbox-option`
      expect(options.filter(o => o.hasAttribute('data-inbox-option')).map(o => o.getAttribute('data-inbox-option'))).toEqual(['A', 'B', 'C'])
      expect(options[options.length - 1].getAttribute('data-inbox-option-other')).toBe('U-3')
      for (const option of options) expect(option.tagName).toBe('LABEL')
      expect(list.querySelector('button')).toBeNull()
      // the 推薦 mark stays inside its option, and the recommended option is still selected
      expect(list.querySelector('[data-inbox-option="A"] [data-inbox-recommended="A"]')).not.toBeNull()
      expect((list.querySelector('[data-inbox-option="A"] input') as HTMLInputElement).checked).toBe(true)

      const buttons = entry.querySelector('[data-inbox-entry-buttons="U-3"]')!
      expect(list.contains(buttons)).toBe(false)
      expect(buttons.parentElement).toBe(list.parentElement)
      expect(list.nextElementSibling).toBe(buttons)
      expect(buttonTexts(buttons)).toEqual(features !== null
        ? [en.inbox.answer.send, en.inbox.dismiss.dismiss]
        : [en.inbox.answer.send])
      // the e2e path (t0913) still finds 送出 through the outer answer block
      expect(entry.querySelector('.inbox-options .inbox-btn.primary')?.textContent).toBe(en.inbox.answer.send)

      expect(order(entry, ['.inbox-entry-head', '[data-inbox-summary]', '.inbox-options'])).toEqual(['.inbox-entry-head', '[data-inbox-summary]', '.inbox-options'])
    })
  }

  it('the 放棄 note opens after the button line, not inside it', () => {
    renderPanel(DISMISS)
    const entry = row('[data-inbox-awaiting="U-3"]')
    fireEvent.click(entry.querySelector('[data-inbox-dismiss="U-3"]')!)
    const form = entry.querySelector('[data-inbox-dismiss-form="U-3"]')!
    const buttons = entry.querySelector('[data-inbox-entry-buttons="U-3"]')!
    expect(buttons.contains(form)).toBe(false)
    expect(buttons.compareDocumentPosition(form) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(buttonTexts(buttons)).toEqual([en.inbox.answer.send, en.inbox.dismiss.dismiss])
  })
})

describe('⏸ 待你決定 with a free answer', () => {
  it('the input, then the button line (送出 / 放棄…)', () => {
    renderPanel(DISMISS)
    const entry = row('[data-inbox-awaiting="U-5"]')
    expect(entry.querySelector('.inbox-entry-head')!.contains(entry.querySelector('[data-inbox-summary="U-5"]'))).toBe(false)
    const block = entry.querySelector('.inbox-free')!
    const input = block.querySelector('input.inbox-free-input')!
    const buttons = entry.querySelector('[data-inbox-entry-buttons="U-5"]')!
    expect(input.parentElement).toBe(block)
    expect(buttons.parentElement).toBe(block)
    expect(buttons.contains(input)).toBe(false)
    expect(input.compareDocumentPosition(buttons) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(buttonTexts(buttons)).toEqual([en.inbox.answer.send, en.inbox.dismiss.dismiss])
    expect(entry.querySelector('.inbox-free .inbox-btn.primary')?.textContent).toBe(en.inbox.answer.send)
  })
})

describe('🙋 待你執行', () => {
  it('the title below the head; 完成 / 失敗… / 略過… in their own line; the 略過 note after it', () => {
    renderPanel(DISMISS)
    const entry = row('[data-inbox-action="A-2"]')
    const head = entry.querySelector('.inbox-entry-head')!
    const title = entry.querySelector('[data-inbox-summary="A-2"]')!
    expect(title.textContent).toBe('Run the sample acceptance script')
    expect(head.contains(title)).toBe(false)
    expect(title.parentElement).toBe(entry)
    const buttons = entry.querySelector('[data-inbox-entry-buttons="A-2"]')!
    expect(buttons.parentElement).toBe(entry)
    expect(buttonTexts(buttons)).toEqual([en.inbox.action.done, en.inbox.action.failed, en.inbox.dismiss.skip])
    expect(buttons.querySelector('input')).toBeNull()
    fireEvent.click(entry.querySelector('[data-inbox-dismiss="A-2"]')!)
    const form = entry.querySelector('[data-inbox-dismiss-form="A-2"]')!
    expect(buttons.contains(form)).toBe(false)
    expect(form.parentElement).toBe(entry)
  })
})
