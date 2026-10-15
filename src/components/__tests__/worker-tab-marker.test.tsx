/**
 * PLAN-041 / T0538: Worker tabs in the thumbnail bar.
 *   - a Worker tab shows its work order (✓ once reported), tooltip names the Tower
 *   - Worker tab menu: "Close this Worker" → the ✕ path (onCloseWorker)
 *   - Tower tab menu: "Close reported Worker tabs (N)", disabled at N = 0
 *   - other tabs: no badge, no Worker items
 *   - source guard: the batch close confirms in-page (no window.confirm) and closes through
 *     workspaceStore.closeTerminalNow without cleaning worktrees
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import i18n from '../../i18n'
import en from '../../locales/en.json'
import { ThumbnailBar } from '../ThumbnailBar'
import type { TerminalInstance } from '../../types'

beforeAll(async () => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
  await i18n.changeLanguage('en')
})

afterAll(() => {
  vi.unstubAllGlobals()
})

beforeEach(() => {
  ;(window as unknown as { electronAPI: unknown }).electronAPI = {
    debug: { log: vi.fn() },
    pty: { onOutput: vi.fn(() => () => {}) },
    claude: { onMessage: vi.fn(() => () => {}), onStream: vi.fn(() => () => {}) },
    agent: { getDefinition: vi.fn(async () => null) },
  }
})

const term = (id: string, title: string, extra: Partial<TerminalInstance> = {}): TerminalInstance => ({
  id, workspaceId: 'ws', type: 'terminal', title, cwd: '/tmp/ws', scrollbackBuffer: [], ...extra,
})
const report = { message: 'T0538 完成', reportedAt: 1 }

function renderBar(terminals: TerminalInstance[]) {
  const onCloseWorker = vi.fn()
  const onCloseReportedWorkers = vi.fn()
  render(
    <ThumbnailBar
      terminals={terminals}
      focusedTerminalId={null}
      onFocus={() => {}}
      showAddButton={true}
      onCloseWorker={onCloseWorker}
      onCloseReportedWorkers={onCloseReportedWorkers}
    />,
  )
  return { onCloseWorker, onCloseReportedWorkers }
}

const thumbnailOf = (title: string) => screen.getByText(title).closest('.thumbnail') as HTMLElement
function openMenu(title: string): HTMLElement {
  fireEvent.contextMenu(thumbnailOf(title))
  return document.body.querySelector('.context-menu') as HTMLElement
}

describe('Worker tab badge (T0538)', () => {
  test('a Worker tab shows its work order; ✓ and the message once reported; tooltip names the Tower', () => {
    renderBar([
      term('tower', 'Tower'),
      term('w1', 'Remote: claude', { towerTerminalId: 'tower', workorder: 'T0538', workerReport: report }),
      term('w2', 'Remote: codex', { towerTerminalId: 'tower', workorder: 'T0539' }),
    ])
    const reported = within(thumbnailOf('Remote: claude')).getByText('✓ T0538')
    expect(reported).toHaveClass('worker-badge', 'reported')
    expect(reported.getAttribute('title')).toBe('Worker for T0538, dispatched by Tower\nReported: T0538 完成')
    const pending = within(thumbnailOf('Remote: codex')).getByText('T0539')
    expect(pending).toHaveClass('worker-badge')
    expect(pending).not.toHaveClass('reported')
    expect(pending.getAttribute('title')).toBe(`Worker for T0539, dispatched by Tower\n${en.workerTabs.notReportedTooltip}`)
    // title / other tabs unchanged
    expect(thumbnailOf('Tower').querySelector('.worker-badge')).toBeNull()
  })

  test('the Tower is not in this list → short id in the tooltip', () => {
    renderBar([term('w1', 'Remote: claude', { towerTerminalId: 'abcdef0123456789', workorder: 'T0538' })])
    expect(within(thumbnailOf('Remote: claude')).getByText('T0538').getAttribute('title')).toContain('dispatched by abcdef01')
  })
})

describe('Worker / Tower context menu (T0538)', () => {
  test('Worker tab: "Close this Worker" goes to the ✕ path', () => {
    const { onCloseWorker, onCloseReportedWorkers } = renderBar([
      term('tower', 'Tower'),
      term('w1', 'Remote: claude', { towerTerminalId: 'tower', workorder: 'T0538' }),
    ])
    const menu = openMenu('Remote: claude')
    expect(within(menu).queryByText(/Close reported Worker tabs/)).toBeNull()
    fireEvent.click(within(menu).getByText(/Close this Worker/))
    expect(onCloseWorker).toHaveBeenCalledWith('w1')
    expect(onCloseReportedWorkers).not.toHaveBeenCalled()
  })

  test('Tower tab: "Close reported Worker tabs (N)" counts only its reported Workers', () => {
    const { onCloseReportedWorkers } = renderBar([
      term('tower', 'Tower'),
      term('w1', 'Remote: claude', { towerTerminalId: 'tower', workorder: 'T0538', workerReport: report }),
      term('w2', 'Remote: codex', { towerTerminalId: 'tower', workorder: 'T0539' }),
      term('w3', 'Other worker', { towerTerminalId: 'other-tower', workorder: 'T0540', workerReport: report }),
    ])
    const menu = openMenu('Tower')
    expect(within(menu).queryByText(/Close this Worker/)).toBeNull()
    const item = within(menu).getByText('✕ Close reported Worker tabs (1)')
    expect(item).toBeEnabled()
    fireEvent.click(item)
    expect(onCloseReportedWorkers).toHaveBeenCalledWith('tower')
  })

  test('N = 0: the item is shown disabled', () => {
    const { onCloseReportedWorkers } = renderBar([
      term('tower', 'Tower'),
      term('w2', 'Remote: codex', { towerTerminalId: 'tower', workorder: 'T0539' }),
    ])
    const item = within(openMenu('Tower')).getByText('✕ Close reported Worker tabs (0)')
    expect(item).toBeDisabled()
    fireEvent.click(item)
    expect(onCloseReportedWorkers).not.toHaveBeenCalled()
  })

  test('a tab with no Workers that is not a Worker: neither item', () => {
    renderBar([term('plain', 'Plain shell')])
    const menu = openMenu('Plain shell')
    expect(within(menu).queryByText(/Close this Worker/)).toBeNull()
    expect(within(menu).queryByText(/Close reported Worker tabs/)).toBeNull()
    expect(within(menu).getByText(/Set as Supervisor/)).toBeInTheDocument()
  })
})

describe('batch close source guard (T0538)', () => {
  const source = readFileSync(resolve(__dirname, '../WorkspaceView.tsx'), 'utf8')
  const batch = source.slice(source.indexOf('const handleConfirmBatchClose'), source.indexOf('// T0538: every listed tab closed elsewhere'))

  test('confirms in-page, closes through closeTerminalNow without cleaning worktrees', () => {
    expect(batch).toContain('workspaceStore.closeTerminalNow(id, { cleanWorktree: false })')
    expect(source).not.toMatch(/window\.confirm\(/)
    expect(source).toContain('worker-batch-close-dialog')
    expect(source).toContain('onCloseWorker={handleCloseTerminal}')
  })
})
