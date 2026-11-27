/**
 * PLAN-069 / T0922: the「待辦」(Inbox) tab's recommended option and 放棄 / 略過 (CT 6.2.0).
 *
 * - `recommended` → a「推薦」mark and selected by default (the user can still pick another); CT's
 *   order and its「（推薦）」text kept
 * - `inbox_features` without `dismiss` → no 放棄 / 略過 / check box / 全部 control at all (as before)
 * - with `dismiss`: per row `U-n：放棄[ 文字]` / `A-n：略過[ 文字]`; batches `U-1、U-3：放棄 …`; 「全部」
 *   expanded when sent to the ids listed then; each list sends its own line
 * - logs: ids / lengths only, never a summary, an option or the note
 */
import { act } from 'react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
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

const WS_DIR = '/tmp/t0922-ws'
const SECRET = '原文標記QZX'

const STATE = (features: string | null, awaiting = DEFAULT_AWAITING, actions = DEFAULT_ACTIONS) => `---
schema_kind: tower-state
summary_version: 1
bat_contract: 2
${features === null ? '' : `inbox_features: ${features}\n`}awaiting_user:
${awaiting}user_actions:
${actions}---
# 塔台
`

const DEFAULT_AWAITING = `  - id: "U-3"
    workorder: "T0901"
    summary: "${SECRET} 收單方式"
    options: ["A 接受（推薦）", "B 退回", "C 先放著"]
    recommended: "a"
    created_at: "2026-11-25T21:00:00+08:00"
  - id: "U-5"
    summary: "${SECRET} 沒有推薦"
    options: ["A 甲", "B 乙"]
    created_at: "2026-11-25T21:01:00+08:00"
`
const DEFAULT_ACTIONS = `  - id: "A-2"
    title: "${SECRET} 重裝驗收"
    kind: "verify"
    created_at: "2026-11-25T21:02:00+08:00"
  - id: "A-3"
    title: "${SECRET} 手動設定"
    kind: "manual"
    created_at: "2026-11-25T21:03:00+08:00"
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
let debugLog: ReturnType<typeof vi.fn>

beforeAll(async () => {
  await i18n.changeLanguage('en')
})

beforeEach(() => {
  answer = vi.fn(async () => ({ ok: true, held: false, holdId: 'h-1' }))
  debugLog = vi.fn()
  ;(window as unknown as { electronAPI: unknown }).electronAPI = {
    fs: { readdir: vi.fn(async () => []), readFile: vi.fn(async () => ({ error: 'x' })), stat: vi.fn(async () => null), watch: vi.fn(async () => true), unwatch: vi.fn(async () => true), resetWatch: vi.fn(async () => true), onChanged: vi.fn(() => () => {}) },
    debug: { log: debugLog },
    pty: { onNotifyHoldChanged: vi.fn(() => () => {}), notifyHoldList: vi.fn(async () => []) },
    ctConfig: { readSources: vi.fn(async () => ({ global: { status: 'missing' }, defaults: { status: 'missing' } })) },
    towerInbox: { answer },
  }
  ws = workspaceStore.addWorkspace('T0922', WS_DIR)
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

function renderPanel(state: string) {
  act(() => setInboxFiles(WS_DIR, files(state)))
  return render(<InboxPanel workspaceId={ws.id} workspaceFolderPath={WS_DIR} />)
}

const q = (selector: string) => document.querySelector(selector) as HTMLElement | null
const flush = () => act(async () => { await new Promise(r => setTimeout(r, 0)) })
const sendButton = (row: HTMLElement) => Array.from(row.querySelectorAll('button')).find(b => b.textContent === en.inbox.answer.send) as HTMLButtonElement
// T0942: once sent, the same button reads「重新送出」
const resendButton = (row: HTMLElement) => Array.from(row.querySelectorAll('button')).find(b => b.textContent === en.inbox.answer.resend) as HTMLButtonElement

const DISMISS_SELECTORS = [
  '[data-inbox-dismiss]',
  '[data-inbox-check]',
  '[data-inbox-dismiss-toolbar]',
  '[data-inbox-dismiss-checked]',
  '[data-inbox-dismiss-all]',
]

describe('推薦 mark and default selection', () => {
  it('marks the recommended option, selects it, and sends it; another pick overrides', async () => {
    const t1 = tower()
    renderPanel(STATE(null))
    const row = q('[data-inbox-awaiting="U-3"]')!
    expect(row.querySelector('[data-inbox-recommended]')!.getAttribute('data-inbox-recommended')).toBe('A')
    expect(row.querySelector('[data-inbox-recommended]')!.textContent).toBe(en.inbox.recommended)
    // CT's order and its「（推薦）」text are kept
    expect(Array.from(row.querySelectorAll('[data-inbox-option]')).map(el => el.getAttribute('data-inbox-option'))).toEqual(['A', 'B', 'C'])
    expect(row.querySelector('[data-inbox-option="A"]')!.textContent).toContain('接受（推薦）')
    expect((row.querySelector('[data-inbox-option="A"] input') as HTMLInputElement).checked).toBe(true)
    expect(sendButton(row).disabled).toBe(false)
    fireEvent.click(sendButton(row))
    await flush()
    expect(answer).toHaveBeenLastCalledWith(t1.id, 'U-3：A')

    fireEvent.click(row.querySelector('[data-inbox-option="C"] input')!)
    expect((row.querySelector('[data-inbox-option="A"] input') as HTMLInputElement).checked).toBe(false)
    // T0942: a sent row's 送出 reads「重新送出」
    fireEvent.click(resendButton(row))
    await flush()
    expect(answer).toHaveBeenLastCalledWith(t1.id, 'U-3：C')
  })

  it('no recommended → nothing selected, no mark (as before)', () => {
    tower()
    renderPanel(STATE(null))
    const row = q('[data-inbox-awaiting="U-5"]')!
    expect(row.querySelector('[data-inbox-recommended]')).toBeNull()
    expect(Array.from(row.querySelectorAll('input[type="radio"]')).some(el => (el as HTMLInputElement).checked)).toBe(false)
    expect(sendButton(row).disabled).toBe(true)
  })

  it('CT fixture: `recommended: "c1"` marks the code `C1`', () => {
    tower()
    renderPanel(fs.readFileSync(path.join(__dirname, '../../lib/__tests__/fixtures/ct-tower-state-v620.md'), 'utf8'))
    expect(q('[data-inbox-awaiting="U-4"] [data-inbox-recommended]')!.getAttribute('data-inbox-recommended')).toBe('C1')
    expect(q('[data-inbox-awaiting="U-6"] [data-inbox-recommended]')).toBeNull()
    // the fixture lists `dismiss` → the controls are there
    expect(q('[data-inbox-dismiss="U-3"]')).not.toBeNull()
  })

  it('the three locales have the new strings', () => {
    for (const locale of [en, zhTW, zhCN]) {
      expect(typeof locale.inbox.recommended).toBe('string')
      expect(Object.keys(locale.inbox.dismiss).sort()).toEqual(Object.keys(en.inbox.dismiss).sort())
    }
    expect(zhTW.inbox.recommended).toBe('推薦')
  })
})

describe('without `dismiss` in inbox_features', () => {
  for (const [label, features] of [['missing', null], ['recommended only', '["recommended"]'], ['not an array', '"dismiss"'], ['unknown values', '["future-value"]']] as const) {
    it(`${label} → no 放棄 / 略過 / check box / 全部 control`, () => {
      tower()
      renderPanel(STATE(features))
      expect(q('[data-inbox-awaiting="U-3"]')).not.toBeNull()
      expect(q('[data-inbox-action="A-2"]')).not.toBeNull()
      for (const selector of DISMISS_SELECTORS) expect(q(selector)).toBeNull()
      // the T0908 controls are all still there
      expect(q('[data-inbox-done="A-2"]')).not.toBeNull()
    })
  }
})

describe('with `dismiss`: one row', () => {
  // (a text input drops line breaks itself, jsdom as browsers; `dismissAnswerText` turning \r\n into a
  // space is in src/lib/__tests__/tower-inbox-plan069.test.ts — here a tab takes the same path)
  it('放棄 without and with a note (tabs / breaks → spaces); cancel sends nothing', async () => {
    const t1 = tower()
    renderPanel(STATE(DISMISS))
    fireEvent.click(q('[data-inbox-dismiss="U-3"]')!)
    fireEvent.click(q('[data-inbox-dismiss-cancel="U-3"]')!)
    expect(q('[data-inbox-dismiss-form="U-3"]')).toBeNull()
    expect(answer).not.toHaveBeenCalled()

    fireEvent.click(q('[data-inbox-dismiss="U-3"]')!)
    fireEvent.click(q('[data-inbox-dismiss-send="U-3"]')!)
    await flush()
    expect(answer).toHaveBeenLastCalledWith(t1.id, 'U-3：放棄')

    fireEvent.click(q('[data-inbox-dismiss="U-5"]')!)
    fireEvent.change(q('[data-inbox-dismiss-note="U-5"]')!, { target: { value: `改走 ${SECRET}\t另一條` } })
    fireEvent.click(q('[data-inbox-dismiss-send="U-5"]')!)
    await flush()
    expect(answer).toHaveBeenLastCalledWith(t1.id, `U-5：放棄 改走 ${SECRET} 另一條`)
    expect(q('[data-inbox-awaiting="U-5"] [data-inbox-answer-status]')!.getAttribute('data-inbox-answer-status')).toBe('sent')
  })

  it('略過 on a user action, with and without a note', async () => {
    const t1 = tower()
    renderPanel(STATE(DISMISS))
    fireEvent.click(q('[data-inbox-dismiss="A-2"]')!)
    fireEvent.click(q('[data-inbox-dismiss-send="A-2"]')!)
    await flush()
    expect(answer).toHaveBeenLastCalledWith(t1.id, 'A-2：略過')
    fireEvent.click(q('[data-inbox-dismiss="A-3"]')!)
    fireEvent.change(q('[data-inbox-dismiss-note="A-3"]')!, { target: { value: '沒有機器' } })
    fireEvent.keyDown(q('[data-inbox-dismiss-note="A-3"]')!, { key: 'Enter' })
    await flush()
    expect(answer).toHaveBeenLastCalledWith(t1.id, 'A-3：略過 沒有機器')
  })
})

describe('with `dismiss`: batches', () => {
  it('放棄勾選（N）: confirm lists the ids, one line, checks cleared after sending', async () => {
    const t1 = tower()
    renderPanel(STATE(DISMISS))
    const checked = q('[data-inbox-dismiss-checked="awaiting"]') as HTMLButtonElement
    expect(checked.disabled).toBe(true)
    fireEvent.click(q('[data-inbox-check="U-3"]')!)
    fireEvent.click(q('[data-inbox-check="U-5"]')!)
    expect(checked.textContent).toBe('Dismiss selected (2)')
    fireEvent.click(checked)
    expect(q('[data-inbox-dismiss-confirm]')!.getAttribute('data-inbox-dismiss-confirm')).toBe('U-3,U-5')
    expect(q('[data-inbox-dismiss-confirm]')!.textContent).toContain('U-3、U-5')
    expect(answer).not.toHaveBeenCalled() // confirmation first
    fireEvent.change(q('[data-inbox-dismiss-batch-note="awaiting"]')!, { target: { value: '整批不做' } })
    fireEvent.click(q('[data-inbox-dismiss-batch-send="awaiting"]')!)
    await flush()
    expect(answer).toHaveBeenCalledTimes(1)
    expect(answer).toHaveBeenLastCalledWith(t1.id, 'U-3、U-5：放棄 整批不做')
    expect(q('[data-inbox-dismiss-confirm]')).toBeNull()
    expect((q('[data-inbox-check="U-3"]') as HTMLInputElement).checked).toBe(false)
  })

  it('one checked → the single-id line; cancel sends nothing', async () => {
    const t1 = tower()
    renderPanel(STATE(DISMISS))
    fireEvent.click(q('[data-inbox-check="A-3"]')!)
    fireEvent.click(q('[data-inbox-dismiss-checked="action"]')!)
    fireEvent.click(q('[data-inbox-dismiss-batch-cancel="action"]')!)
    expect(answer).not.toHaveBeenCalled()
    fireEvent.click(q('[data-inbox-dismiss-checked="action"]')!)
    fireEvent.click(q('[data-inbox-dismiss-batch-send="action"]')!)
    await flush()
    expect(answer).toHaveBeenLastCalledWith(t1.id, 'A-3：略過')
  })

  it('「全部」is expanded when sent, to the ids listed then (no wildcard)', async () => {
    const t1 = tower()
    renderPanel(STATE(DISMISS))
    fireEvent.click(q('[data-inbox-dismiss-all="awaiting"]')!)
    expect(q('[data-inbox-dismiss-confirm]')!.getAttribute('data-inbox-dismiss-confirm')).toBe('U-3,U-5')
    // the file changes while the confirmation is open: U-5 left, U-7 arrived
    const next = `  - id: "U-3"
    summary: "s3"
    created_at: "2026-11-25T21:00:00+08:00"
  - id: "U-7"
    summary: "s7"
    created_at: "2026-11-25T21:05:00+08:00"
`
    act(() => setInboxFiles(WS_DIR, files(STATE(DISMISS, next))))
    expect(q('[data-inbox-dismiss-confirm]')!.getAttribute('data-inbox-dismiss-confirm')).toBe('U-3,U-7')
    fireEvent.click(q('[data-inbox-dismiss-batch-send="awaiting"]')!)
    await flush()
    expect(answer).toHaveBeenLastCalledWith(t1.id, 'U-3、U-7：放棄')
    expect(answer.mock.calls.every(call => !String(call[1]).includes('*'))).toBe(true)
  })

  it('both lists: each sends its own line (one answer call each)', async () => {
    const t1 = tower()
    renderPanel(STATE(DISMISS))
    fireEvent.click(q('[data-inbox-dismiss-all="awaiting"]')!)
    fireEvent.click(q('[data-inbox-dismiss-batch-send="awaiting"]')!)
    fireEvent.click(q('[data-inbox-dismiss-all="action"]')!)
    fireEvent.change(q('[data-inbox-dismiss-batch-note="action"]')!, { target: { value: '這版不驗' } })
    fireEvent.click(q('[data-inbox-dismiss-batch-send="action"]')!)
    await flush()
    expect(answer.mock.calls).toEqual([[t1.id, 'U-3、U-5：放棄'], [t1.id, 'A-2、A-3：略過 這版不驗']])
  })

  it('logs carry ids and lengths only — no summary, option, title or note', async () => {
    tower()
    renderPanel(STATE(DISMISS))
    fireEvent.click(q('[data-inbox-check="U-3"]')!)
    fireEvent.click(q('[data-inbox-check="U-5"]')!)
    fireEvent.click(q('[data-inbox-dismiss-checked="awaiting"]')!)
    fireEvent.change(q('[data-inbox-dismiss-batch-note="awaiting"]')!, { target: { value: `${SECRET} 原因` } })
    fireEvent.click(q('[data-inbox-dismiss-batch-send="awaiting"]')!)
    fireEvent.click(q('[data-inbox-dismiss="A-2"]')!)
    fireEvent.change(q('[data-inbox-dismiss-note="A-2"]')!, { target: { value: `${SECRET} 略過原因` } })
    fireEvent.click(q('[data-inbox-dismiss-send="A-2"]')!)
    await flush()
    const lines = debugLog.mock.calls.map(call => String(call[0])).filter(line => line.includes('[tower-inbox]'))
    expect(lines.some(line => line.includes('id=U-3 ids=2'))).toBe(true)
    expect(lines.some(line => line.includes('id=A-2 '))).toBe(true)
    const all = debugLog.mock.calls.map(call => String(call[0])).join('\n')
    for (const leak of [SECRET, '原因', '收單方式', '接受', '重裝驗收']) expect(all).not.toContain(leak)
  })
})
