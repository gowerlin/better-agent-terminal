/**
 * PLAN-068 W2 / T0904: the「📨 待送」menu of a Tower tab says why its notifications wait and offers
 *「立即送出」only for the reasons it may skip (`draft` / `reading`, never a prompt).
 *
 * - store: `reason` of `terminal:notify-hold-changed` is kept per tab; an event without it (an older
 *   main, or not a contract-2 Tower) shows none — the menu is then exactly the T0788 one
 * - thumbnail: reason text (three languages), answer items labelled, send-now → IPC
 */
import { act } from 'react'
import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import i18n from '../../i18n'
import { TerminalThumbnail, clearPreviewCache, notifyHoldReasonKey } from '../TerminalThumbnail'
import { applyNotifyHold, getNotifyHoldReason, resetNotifyHoldStore } from '../../stores/notify-hold-store'
import type { NotifyHoldChangedEvent } from '../../types/notify-hold'
import type { TerminalInstance } from '../../types'
import en from '../../locales/en.json'
import zhTW from '../../locales/zh-TW.json'
import zhCN from '../../locales/zh-CN.json'

const sendNow = vi.fn(async () => 1)
const cancel = vi.fn(async () => 1)

beforeAll(async () => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
  await i18n.changeLanguage('en')
  ;(window as unknown as { electronAPI: unknown }).electronAPI = {
    debug: { log: vi.fn() },
    pty: { onOutput: vi.fn(() => () => {}), notifyHoldSendNow: sendNow, notifyHoldCancel: cancel },
    claude: { onMessage: vi.fn(() => () => {}), onStream: vi.fn(() => () => {}) },
    agent: { getDefinition: vi.fn(async () => null) },
  }
})

afterEach(async () => {
  act(() => resetNotifyHoldStore())
  sendNow.mockClear()
  cancel.mockClear()
  document.body.innerHTML = ''
  await i18n.changeLanguage('en')
})

afterAll(() => {
  vi.unstubAllGlobals()
})

const term: TerminalInstance = { id: 'tower', workspaceId: 'ws', type: 'terminal', title: 'Tower tab', cwd: '/tmp/ws', scrollbackBuffer: [] }

const event = (reason?: NotifyHoldChangedEvent['reason'], kind?: 'answer'): NotifyHoldChangedEvent => ({
  terminalId: 'tower',
  items: [{ holdId: 'h-1', workorder: 'T0001', heldAt: Date.now(), hasText: true, hasEnter: true, ...(kind ? { kind } : {}) }],
  ...(reason ? { reason } : {}),
})

function openMenu(): HTMLElement {
  clearPreviewCache(term.id)
  render(<TerminalThumbnail terminal={term} isActive={false} onClick={vi.fn()} />)
  fireEvent.click(document.querySelector('.notify-hold-badge') as HTMLElement)
  return document.querySelector('.notify-hold-menu') as HTMLElement
}

describe('notify-hold store: reason', () => {
  test('kept per tab; an event without it clears it; an empty queue clears it', () => {
    act(() => applyNotifyHold(event('draft')))
    expect(getNotifyHoldReason('tower')).toBe('draft')
    act(() => applyNotifyHold(event()))
    expect(getNotifyHoldReason('tower')).toBeNull()
    act(() => applyNotifyHold(event('reading')))
    act(() => applyNotifyHold({ terminalId: 'tower', items: [] }))
    expect(getNotifyHoldReason('tower')).toBeNull()
  })
})

describe('the「📨 待送」menu', () => {
  test.each([
    ['draft', en.notifyHold.reasonDraft, true],
    ['reading', en.notifyHold.reasonReading, true],
    ['permission', en.notifyHold.reasonPrompt, false],
    ['input', en.notifyHold.reasonPrompt, false],
    ['queued', en.notifyHold.reasonQueued, false],
  ] as const)('%s: the reason is shown; send-now offered = %s', (reason, text, offered) => {
    act(() => applyNotifyHold(event(reason)))
    const menu = openMenu()
    expect(menu.querySelector('.notify-hold-reason')?.textContent).toBe(text)
    expect(menu.querySelector('[data-action="send-held-notifications-now"]') !== null).toBe(offered)
    expect(document.querySelector('.notify-hold-badge')?.getAttribute('data-notify-hold-reason')).toBe(reason)
  })

  test('no reason (T0788 tab / older main): the menu is the T0788 one — no reason line, no send-now', () => {
    act(() => applyNotifyHold(event()))
    const menu = openMenu()
    expect(menu.querySelector('.notify-hold-reason')).toBeNull()
    expect(menu.querySelector('[data-action="send-held-notifications-now"]')).toBeNull()
    expect(document.querySelector('.notify-hold-badge')?.getAttribute('title')).toBe(en.notifyHold.badgeTooltip.replace('{{count}}', '1'))
  })

  test('send-now asks main for the tab (all items)', async () => {
    act(() => applyNotifyHold(event('draft')))
    const menu = openMenu()
    await act(async () => { fireEvent.click(menu.querySelector('[data-action="send-held-notifications-now"]') as HTMLElement) })
    expect(sendNow).toHaveBeenCalledWith('tower', undefined)
  })

  test('an answer item says so (no work order / source)', () => {
    act(() => applyNotifyHold(event('draft', 'answer')))
    const menu = openMenu()
    expect(menu.querySelector('.notify-hold-item')?.textContent).toContain(en.notifyHold.answerSource)
    expect(menu.querySelector('.notify-hold-item')?.textContent).not.toContain('T0001')
  })

  test.each([
    ['zh-TW', zhTW],
    ['zh-CN', zhCN],
  ] as const)('%s texts', async (lang, locale) => {
    await i18n.changeLanguage(lang)
    act(() => applyNotifyHold(event('draft')))
    const menu = openMenu()
    expect(menu.querySelector('.notify-hold-reason')?.textContent).toBe(locale.notifyHold.reasonDraft)
    expect(screen.getByText(locale.notifyHold.sendNow, { exact: false })).toBeTruthy()
  })

  test('every reason has a key in all three languages', () => {
    for (const reason of ['permission', 'question', 'elicitation', 'input', 'draft', 'reading', 'queued'] as const) {
      const key = notifyHoldReasonKey(reason).split('.')[1] as keyof typeof en.notifyHold
      for (const locale of [en, zhTW, zhCN]) expect(locale.notifyHold[key]).toBeTruthy()
    }
    for (const key of ['sendNow', 'sendNowTooltip', 'answerSource', 'reminderTitle', 'reminderBody'] as const) {
      for (const locale of [en, zhTW, zhCN]) expect(locale.notifyHold[key]).toBeTruthy()
    }
  })
})
