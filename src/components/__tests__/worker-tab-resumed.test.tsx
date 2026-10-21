/**
 * T0694 (D180): a Worker that reported and then works again shows ↻ (`resumed`, its own tooltip),
 * not ✓, and the Tower's "Close reported Worker tabs (N)" does not count it; the turn ends → ✓.
 * d2: the batch-close confirm marks a listed tab that printed within 5 s "still printing" (a mark
 * only, the tab stays listed); the three locales have the new keys.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { act } from 'react'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import i18n from '../../i18n'
import en from '../../locales/en.json'
import zhTW from '../../locales/zh-TW.json'
import zhCN from '../../locales/zh-CN.json'
import { ThumbnailBar } from '../ThumbnailBar'
import { WorkerBatchCloseDialog } from '../WorkspaceView'
import { noteWorkerNotified, resetTerminalAttention, setTerminalAttention } from '../../stores/terminal-attention-store'
import type { TerminalAttentionEvent } from '../../lib/terminal-attention'
import type { TerminalInstance } from '../../types'

beforeAll(async () => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
  await i18n.changeLanguage('en')
})

afterAll(() => {
  vi.unstubAllGlobals()
})

beforeEach(() => {
  resetTerminalAttention()
  ;(window as unknown as { electronAPI: unknown }).electronAPI = {
    debug: { log: vi.fn() },
    pty: { onOutput: vi.fn(() => () => {}) },
    claude: { onMessage: vi.fn(() => () => {}), onStream: vi.fn(() => () => {}) },
    agent: { getDefinition: vi.fn(async () => null) },
  }
})

afterEach(() => {
  vi.useRealTimers()
  resetTerminalAttention()
})

const term = (id: string, title: string, extra: Partial<TerminalInstance> = {}): TerminalInstance => ({
  id, workspaceId: 'ws', type: 'terminal', title, cwd: '/tmp/ws', scrollbackBuffer: [], ...extra,
})
const report = { message: 'T0694 完成', reportedAt: 1 }
const ev = (id: string, extra: Partial<TerminalAttentionEvent> = {}): TerminalAttentionEvent => ({ id, pendingQuestions: 0, ...extra })

function renderBar(terminals: TerminalInstance[]) {
  render(
    <ThumbnailBar
      terminals={terminals}
      focusedTerminalId={null}
      onFocus={() => {}}
      showAddButton={true}
      onCloseWorker={vi.fn()}
      onCloseReportedWorkers={vi.fn()}
    />,
  )
}

const thumbnailOf = (title: string) => screen.getByText(title).closest('.thumbnail') as HTMLElement
const badgeOf = (title: string) => thumbnailOf(title).querySelector('.worker-badge') as HTMLElement | null
function reportedItem(): HTMLElement {
  fireEvent.contextMenu(thumbnailOf('Tower'))
  const menu = document.body.querySelector('.context-menu') as HTMLElement
  const item = within(menu).getByText(/Close reported Worker tabs/)
  document.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  return item
}

describe('Worker badge: reported, then working again (T0694)', () => {
  test('↻ with its tooltip, not counted; the turn ends → ✓ counted; a new turn → ↻ again', () => {
    noteWorkerNotified(['w1', 'w2']) // both reported (this window saw the notifies)
    renderBar([
      term('tower', 'Tower'),
      term('w1', 'Worker one', { towerTerminalId: 'tower', workorder: 'T0694', workerReport: report }),
      term('w2', 'Worker two', { towerTerminalId: 'tower', workorder: 'T0695', workerReport: report }),
    ])
    expect(badgeOf('Worker one')).toHaveTextContent('✓ T0694')
    expect(reportedItem()).toHaveTextContent('Close reported Worker tabs (2)')

    act(() => setTerminalAttention(ev('w1', { busy: true })))
    const badge = badgeOf('Worker one')!
    expect(badge).toHaveTextContent('↻ T0694')
    expect(badge).not.toHaveTextContent('✓')
    expect(badge).toHaveClass('worker-badge', 'resumed')
    expect(badge).not.toHaveClass('reported')
    expect(badge.dataset.attention).toBe('resumed')
    expect(badge.getAttribute('title')).toBe(`Worker for T0694, dispatched by Tower\n${en.workerTabs.resumedTooltip.replace('{{message}}', 'T0694 完成')}`)
    expect(badgeOf('Worker two')).toHaveTextContent('✓ T0695')
    expect(reportedItem()).toHaveTextContent('Close reported Worker tabs (1)')

    act(() => setTerminalAttention(ev('w1')))
    expect(badgeOf('Worker one')).toHaveTextContent('✓ T0694')
    expect(reportedItem()).toHaveTextContent('Close reported Worker tabs (2)')
    act(() => setTerminalAttention(ev('w1', { busy: true })))
    expect(badgeOf('Worker one')).toHaveTextContent('↻ T0694')
  })

  test('blocked / a tower question still win over ↻; a default Worker title shows only the mark', () => {
    noteWorkerNotified(['w1', 'w2'])
    renderBar([
      term('tower', 'Tower'),
      term('w1', 'claude · Worker · T0694', { towerTerminalId: 'tower', workorder: 'T0694', workerReport: report }),
      term('w2', 'Worker two', { towerTerminalId: 'tower', workorder: 'T0695', workerReport: report }),
    ])
    act(() => setTerminalAttention(ev('w1', { busy: true })))
    expect(badgeOf('claude · Worker · T0694')).toHaveTextContent(/^↻$/)
    act(() => setTerminalAttention(ev('w2', { busy: true })))
    act(() => setTerminalAttention(ev('w2', { busy: true, blockedReason: 'permission', blockedSince: 1 })))
    expect(badgeOf('Worker two')).toHaveTextContent('⚠️ T0695')
    act(() => setTerminalAttention(ev('w2', { busy: true, blockedReason: 'tower', blockedSince: 1, pendingQuestions: 1 })))
    expect(badgeOf('Worker two')).toHaveTextContent('? T0695')
    act(() => setTerminalAttention(ev('w2', { busy: true })))
    expect(badgeOf('Worker two')).toHaveTextContent('↻ T0695')
    expect(reportedItem()).toHaveTextContent('Close reported Worker tabs (0)')
  })
})

describe('batch-close confirm: "still printing" (T0694 d2)', () => {
  const NOW = new Date(2026, 9, 22, 1, 0, 0).getTime()
  const workers = [
    term('w1', 'Worker one', { towerTerminalId: 'tower', workorder: 'T0694', workerReport: report }),
    term('w2', 'Worker two', { towerTerminalId: 'tower', workorder: 'T0695', workerReport: report }),
    term('w3', 'Worker three', { towerTerminalId: 'tower', workorder: 'T0696', workerReport: report }),
  ]
  const lastOutput: Record<string, number | undefined> = { w1: NOW - 1_000, w2: NOW - 5_000, w3: undefined }

  test('a tab that printed within 5 s is marked, the others not; all stay listed; the mark goes away after 5 s', () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] })
    vi.setSystemTime(NOW)
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(<WorkerBatchCloseDialog towerTitle="Tower" workers={workers} onCancel={onCancel} onConfirm={onConfirm} lastActivityOf={id => lastOutput[id]} />)
    const dialog = document.body.querySelector('.worker-batch-close-dialog') as HTMLElement
    const items = [...dialog.querySelectorAll('li')]
    expect(items.map(li => li.dataset.terminalId)).toEqual(['w1', 'w2', 'w3'])
    expect(items.map(li => li.dataset.stillPrinting ?? null)).toEqual(['true', null, null])
    const mark = items[0].querySelector('.worker-batch-close-printing') as HTMLElement
    expect(mark).toHaveTextContent(en.workerTabs.batchCloseStillPrinting)
    expect(mark.getAttribute('title')).toBe(en.workerTabs.batchCloseStillPrintingTooltip.replace('{{seconds}}', '5'))
    expect(items[1].querySelector('.worker-batch-close-printing')).toBeNull()
    expect(within(dialog).getByText('Close 3 tabs')).toBeTruthy()

    act(() => { vi.advanceTimersByTime(4_000) }) // w1's output is now 5 s old
    expect([...dialog.querySelectorAll('li')].map(li => li.dataset.stillPrinting ?? null)).toEqual([null, null, null])

    fireEvent.click(dialog.querySelector('[data-action="confirm-batch-close"]') as HTMLElement)
    expect(onConfirm).toHaveBeenCalledTimes(1)
    fireEvent.click(within(dialog).getByText('Cancel'))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  test('the three locales have the new keys', () => {
    for (const locale of [en, zhTW, zhCN]) {
      expect(locale.workerTabs.resumedTooltip).toContain('{{message}}')
      expect(locale.workerTabs.batchCloseStillPrinting).toBeTruthy()
      expect(locale.workerTabs.batchCloseStillPrintingTooltip).toContain('{{seconds}}')
    }
    expect(zhTW.workerTabs.batchCloseStillPrinting).toBe('仍在輸出')
  })

  test('source guard: the view lists through reportedWorkersOfTower and renders this dialog (never window.confirm)', () => {
    const source = readFileSync(resolve(__dirname, '../WorkspaceView.tsx'), 'utf8')
    expect(source).toContain('<WorkerBatchCloseDialog')
    expect(source).toContain('workers={batchCloseList}')
    expect(source).toContain('onConfirm={handleConfirmBatchClose}')
    expect(source).not.toMatch(/window\.confirm\(/)
  })
})
