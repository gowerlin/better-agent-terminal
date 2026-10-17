/**
 * T0609 (BUG-153): the Worker badge says whether the Worker waits for the user (⚠️, claude hook
 * `blocked`), waits for its Tower's answer (?, a tower question or the old CT `T#### 提問`), or
 * reported (✓); the Tower's "Close reported Worker tabs (N)" counts only ✓ and follows
 * `terminal:attention-changed` without a new terminal list. The batch close confirm drops a listed
 * Worker that starts waiting (source guard).
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { act } from 'react'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import i18n from '../../i18n'
import en from '../../locales/en.json'
import { ThumbnailBar } from '../ThumbnailBar'
import { resetTerminalAttention, setTerminalAttention } from '../../stores/terminal-attention-store'
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
  resetTerminalAttention()
})

const term = (id: string, title: string, extra: Partial<TerminalInstance> = {}): TerminalInstance => ({
  id, workspaceId: 'ws', type: 'terminal', title, cwd: '/tmp/ws', scrollbackBuffer: [], ...extra,
})
const report = { message: 'T0601 完成', reportedAt: 1 }
const ev = (id: string, extra: Partial<TerminalAttentionEvent> = {}): TerminalAttentionEvent => ({ id, pendingQuestions: 0, ...extra })
const clock = (epoch: number) => new Date(epoch).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
const T = new Date(2026, 9, 18, 5, 30).getTime()

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

describe('Worker badge: waits for the user / for the Tower / reported (T0609)', () => {
  test('hook blocked → ⚠️ with the reason and since time; tower question → ?; report → ✓', () => {
    setTerminalAttention(ev('w1', { blockedReason: 'permission', blockedSince: T }))
    setTerminalAttention(ev('w2', { blockedReason: 'tower', blockedSince: T, pendingQuestions: 1, questionsSince: T }))
    renderBar([
      term('tower', 'Tower'),
      term('w1', 'Worker one', { towerTerminalId: 'tower', workorder: 'T0601', workerReport: report }),
      term('w2', 'Worker two', { towerTerminalId: 'tower', workorder: 'T0602', workerReport: report }),
      term('w3', 'Worker three', { towerTerminalId: 'tower', workorder: 'T0603', workerReport: report }),
      term('w4', 'Worker four', { towerTerminalId: 'tower', workorder: 'T0604' }),
    ])
    const blocked = badgeOf('Worker one')!
    expect(blocked).toHaveTextContent('⚠️ T0601')
    expect(blocked).toHaveClass('worker-badge', 'blocked')
    expect(blocked).not.toHaveClass('reported')
    expect(blocked.dataset.attention).toBe('blocked')
    expect(blocked.dataset.blockedReason).toBe('permission')
    expect(blocked.getAttribute('title')).toBe(`Worker for T0601, dispatched by Tower\n${en.workerTabs.blockedTooltip.permission.replace('{{time}}', clock(T))}`)

    const asked = badgeOf('Worker two')!
    expect(asked).toHaveTextContent('? T0602')
    expect(asked).toHaveClass('worker-badge', 'question')
    expect(asked.dataset.attention).toBe('question')
    expect(asked.getAttribute('title')).toBe(`Worker for T0602, dispatched by Tower\n${en.workerTabs.questionTooltip.replace('{{time}}', clock(T))}`)

    expect(badgeOf('Worker three')).toHaveTextContent('✓ T0603')
    expect(badgeOf('Worker three')).toHaveClass('reported')
    expect(badgeOf('Worker four')).toHaveTextContent('T0604')
    expect(badgeOf('Worker four')!.dataset.attention).toBeUndefined()
    // only the ✓ Worker is counted
    expect(reportedItem()).toHaveTextContent('Close reported Worker tabs (1)')
  })

  test('every hook reason has its own tooltip; more than one pending question is counted', () => {
    setTerminalAttention(ev('w1', { blockedReason: 'question', blockedSince: T }))
    setTerminalAttention(ev('w2', { blockedReason: 'elicitation', blockedSince: T }))
    setTerminalAttention(ev('w3', { pendingQuestions: 3, questionsSince: T }))
    renderBar([
      term('tower', 'Tower'),
      term('w1', 'Worker one', { towerTerminalId: 'tower', workorder: 'T0601' }),
      term('w2', 'Worker two', { towerTerminalId: 'tower', workorder: 'T0602' }),
      term('w3', 'Worker three', { towerTerminalId: 'tower', workorder: 'T0603' }),
    ])
    expect(badgeOf('Worker one')!.getAttribute('title')).toContain(en.workerTabs.blockedTooltip.question.replace('{{time}}', clock(T)))
    expect(badgeOf('Worker two')!.getAttribute('title')).toContain(en.workerTabs.blockedTooltip.elicitation.replace('{{time}}', clock(T)))
    expect(badgeOf('Worker three')).toHaveTextContent('? T0603')
    expect(badgeOf('Worker three')!.getAttribute('title')).toContain(en.workerTabs.questionPendingTooltip.replace('{{count}}', '3'))
  })

  test('old CT `T#### 提問` (workerQuestion) → ?, asked time in the tooltip, not counted', () => {
    renderBar([
      term('tower', 'Tower'),
      term('w1', 'Worker one', { towerTerminalId: 'tower', workorder: 'T0601', workerQuestion: { message: 'T0601 提問', askedAt: T } }),
    ])
    expect(badgeOf('Worker one')).toHaveTextContent('? T0601')
    expect(badgeOf('Worker one')!.getAttribute('title')).toContain(en.workerTabs.questionTooltip.replace('{{time}}', clock(T)))
    expect(reportedItem()).toHaveTextContent('Close reported Worker tabs (0)')
  })

  test('a default Worker title (T0553) shows only the mark', () => {
    setTerminalAttention(ev('w1', { blockedReason: 'permission', blockedSince: T }))
    renderBar([
      term('tower', 'Tower'),
      term('w1', 'claude · Worker · T0601', { towerTerminalId: 'tower', workorder: 'T0601' }),
      term('w2', 'claude · Worker · T0602', { towerTerminalId: 'tower', workorder: 'T0602' }),
    ])
    expect(badgeOf('claude · Worker · T0601')).toHaveTextContent(/^⚠️$/)
    // running Worker with the work order in its title: no badge (T0553)
    expect(badgeOf('claude · Worker · T0602')).toBeNull()
  })

  test('main\'s events update the badge and the Tower count without a new terminal list', () => {
    renderBar([
      term('tower', 'Tower'),
      term('w1', 'Worker one', { towerTerminalId: 'tower', workorder: 'T0601', workerReport: report }),
    ])
    expect(badgeOf('Worker one')).toHaveTextContent('✓ T0601')
    expect(reportedItem()).toHaveTextContent('(1)')
    act(() => setTerminalAttention(ev('w1', { blockedReason: 'tower', blockedSince: T, pendingQuestions: 1, questionsSince: T })))
    expect(badgeOf('Worker one')).toHaveTextContent('? T0601')
    expect(reportedItem()).toHaveTextContent('(0)')
    // a hook prompt while the question is pending: the user comes first
    act(() => setTerminalAttention(ev('w1', { blockedReason: 'permission', blockedSince: T + 1, pendingQuestions: 1, questionsSince: T })))
    expect(badgeOf('Worker one')).toHaveTextContent('⚠️ T0601')
    // answered (empty state) → its report again
    act(() => setTerminalAttention(ev('w1')))
    expect(badgeOf('Worker one')).toHaveTextContent('✓ T0601')
    expect(reportedItem()).toHaveTextContent('(1)')
  })

  test('a non-Worker tab never shows a badge, even when blocked', () => {
    setTerminalAttention(ev('plain', { blockedReason: 'permission', blockedSince: T }))
    renderBar([term('plain', 'Plain shell')])
    expect(badgeOf('Plain shell')).toBeNull()
  })
})

describe('batch close source guard (T0609)', () => {
  const source = readFileSync(resolve(__dirname, '../WorkspaceView.tsx'), 'utf8')
  const batch = source.slice(source.indexOf('const batchCloseList'), source.indexOf('// T0538: every listed tab closed elsewhere'))

  test('the list and the confirm re-check reportedWorkersOfTower; the view follows the attention store', () => {
    expect(source).toContain('useTerminalAttentionVersion()')
    expect(batch.match(/reportedWorkersOfTower\(terminals, batchCloseWorkers\.towerId\)/g)).toHaveLength(2)
    expect(batch).toContain('workspaceStore.closeTerminalNow(id, { cleanWorktree: false })')
    expect(source).not.toMatch(/window\.confirm\(/)
  })
})
