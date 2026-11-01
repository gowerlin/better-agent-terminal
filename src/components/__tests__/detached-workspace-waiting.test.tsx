/**
 * T0761 (D200 ⑥ / D212): a detached workspace's "waits for the user" ⚠️ in its parent main window.
 *
 *   detached window  `DetachedWaitingReporter` sums its own workspace (same `waitingSummary`, its own
 *                    D203 miss memory) and sends the entry whenever it changes, an empty one included
 *   main             forwards it (sender = the detached window; sanitized) to the parent window
 *   parent window    `setDetachedWaiting` → a row `↗ <name> (detached) ⚠️ N` below the list only while
 *                    something waits or was missed; the 工作區 tab title / collapsed bar count it;
 *                    a click → `focusDetachedTerminal(workspace, tab waiting longest)`
 *
 * The list still hides detached workspaces (D201): no report, or an empty one → no row.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { act, fireEvent, render } from '@testing-library/react'
import i18n from '../../i18n'
import { Sidebar } from '../Sidebar'
import { workspaceStore } from '../../stores/workspace-store'
import { getDetachedWaiting, resetTerminalAttention, setDetachedWaiting, setTerminalAttention, setViewingState } from '../../stores/terminal-attention-store'
import { DetachedWaitingReporter, WaitingTotalBadge } from '../WorkspaceWaitingBadge'
import {
  DETACHED_WAITING_MAX_TABS,
  DETACHED_WAITING_MAX_TITLE,
  detachedWaitingWorkspaces,
  mergeWaitingSummary,
  sanitizeDetachedWaitingReport,
  type DetachedWaitingReport,
  type TerminalAttentionEvent,
} from '../../lib/terminal-attention'
import type { Workspace } from '../../types'

const replay = vi.hoisted(() => ({ requestPtyReplay: vi.fn() }))
vi.mock('../../lib/pty-replay', () => replay)

/** Any electronAPI call resolves to undefined, any `on*` returns an unsubscribe; calls are recorded. */
function permissiveApi(): Record<string, Record<string, ReturnType<typeof vi.fn>>> {
  const leaf = (name: string) => vi.fn((..._args: unknown[]) => (name.startsWith('on') ? () => {} : Promise.resolve(undefined)))
  const namespace = () => {
    const cache: Record<string, unknown> = {}
    return new Proxy(cache, {
      get(target, prop) {
        if (typeof prop !== 'string' || prop === 'then') return undefined
        if (!(prop in target)) target[prop] = leaf(prop)
        return target[prop]
      },
    })
  }
  const namespaces: Record<string, unknown> = {}
  return new Proxy(namespaces, {
    get(target, prop) {
      if (typeof prop !== 'string' || prop === 'then') return undefined
      if (!(prop in target)) target[prop] = namespace()
      return target[prop]
    },
  }) as Record<string, Record<string, ReturnType<typeof vi.fn>>>
}

let api: ReturnType<typeof permissiveApi>

beforeAll(async () => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
  await i18n.changeLanguage('en')
})

afterAll(() => {
  vi.unstubAllGlobals()
})

const ev = (id: string, extra: Partial<TerminalAttentionEvent> = {}): TerminalAttentionEvent => ({ id, pendingQuestions: 0, ...extra })
const T = new Date(2026, 10, 2, 3, 0).getTime()

let wsA: Workspace
let wsC: Workspace

beforeEach(() => {
  api = permissiveApi()
  ;(window as unknown as { electronAPI: unknown }).electronAPI = api
  resetTerminalAttention()
  wsA = workspaceStore.addWorkspace('T0761-A', '/tmp/a')
  wsC = workspaceStore.addWorkspace('T0761-C', '/tmp/c')
})

afterEach(() => {
  resetTerminalAttention()
  workspaceStore.removeWorkspace(wsA.id)
  workspaceStore.removeWorkspace(wsC.id)
})

const report = (extra: Partial<DetachedWaitingReport> = {}): DetachedWaitingReport => ({
  tabs: [
    { id: 'c-2', title: 'Codex CLI', reason: 'input', since: T + 5000 },
    { id: 'c-1', title: 'Claude CLI · Tower', reason: 'question', since: T },
  ],
  missed: [],
  ...extra,
})

function renderSidebar(detachedWorkspaces: Workspace[]) {
  const noop = () => {}
  return render(
    <Sidebar
      width={240}
      workspaces={[wsA]}
      activeWorkspaceId={wsA.id}
      windowId="w1"
      groups={[]}
      activeGroup={null}
      archivedWorkspaces={[]}
      detachedWorkspaces={detachedWorkspaces}
      onSetActiveGroup={noop}
      onSetWorkspaceGroup={noop}
      onSelectWorkspace={noop}
      onAddWorkspace={noop}
      onRemoveWorkspace={noop}
      onRenameWorkspace={noop}
      onReorderWorkspaces={noop}
      onArchiveWorkspace={noop}
      onUnarchiveWorkspace={noop}
      onOpenEnvVars={noop}
      onDetachWorkspace={noop}
      onOpenProfiles={noop}
      onOpenSettings={noop}
      onCollapse={noop}
    />,
  )
}

const detachedRow = (container: HTMLElement) => container.querySelector('.detached-waiting-item') as HTMLElement | null

describe('report sanitizing (main and the parent take only these fields)', () => {
  test('not an object with two arrays → null', () => {
    expect(sanitizeDetachedWaitingReport(null)).toBeNull()
    expect(sanitizeDetachedWaitingReport('x')).toBeNull()
    expect(sanitizeDetachedWaitingReport({ tabs: [] })).toBeNull()
    expect(sanitizeDetachedWaitingReport({ tabs: {}, missed: [] })).toBeNull()
  })

  test('hook reasons only, extra fields dropped, sorted, titles cut, ids checked', () => {
    const clean = sanitizeDetachedWaitingReport({
      tabs: [
        { id: 'b', title: 'B', reason: 'permission', since: T + 1, question: 'secret text' },
        { id: 'a', title: 'x'.repeat(DETACHED_WAITING_MAX_TITLE + 50), reason: 'elicitation', since: T },
        { id: 'tower', title: 'T', reason: 'tower', since: T },
        { id: '', title: 'empty', reason: 'question', since: T },
        { id: 'n', title: 'no since', reason: 'question', since: 'soon' },
      ],
      missed: [
        { id: 'm2', title: 'M2', reason: 'input', startedAt: T + 10 },
        { id: 'm1', title: 'M1', reason: 'question', startedAt: T },
        { id: 'm3', title: 'M3', reason: 'question' },
      ],
    })
    expect(clean).not.toBeNull()
    expect(clean!.tabs.map(tab => tab.id)).toEqual(['a', 'b', 'n'])
    expect(clean!.tabs[0].title).toHaveLength(DETACHED_WAITING_MAX_TITLE)
    expect(clean!.tabs[2].since).toBeNull()
    expect(JSON.stringify(clean)).not.toContain('secret text')
    expect(clean!.missed.map(tab => tab.id)).toEqual(['m1', 'm2'])
  })

  test(`at most ${DETACHED_WAITING_MAX_TABS} tabs per list`, () => {
    const many = Array.from({ length: DETACHED_WAITING_MAX_TABS + 10 }, (_, i) => ({ id: `t${i}`, title: `t${i}`, reason: 'question', since: T + i }))
    expect(sanitizeDetachedWaitingReport({ tabs: many, missed: [] })!.tabs).toHaveLength(DETACHED_WAITING_MAX_TABS)
  })

  test('merge: detached entries after the listed ones, totals add up, empty reports skipped', () => {
    const detached = detachedWaitingWorkspaces(
      [{ id: 'x', name: 'X' }, { id: 'y', name: 'Y', alias: 'Why' }, { id: 'z', name: 'Z' }],
      (id) => (id === 'x' ? report() : id === 'y' ? report({ tabs: [], missed: [{ id: 'm', title: 'M', reason: 'question', startedAt: T }] }) : { tabs: [], missed: [] }),
    )
    expect(detached.map(ws => [ws.workspaceId, ws.name, ws.detached])).toEqual([['x', 'X', true], ['y', 'Why', true]])
    const merged = mergeWaitingSummary({ total: 1, missedTotal: 0, workspaces: [{ workspaceId: 'a', name: 'A', tabs: [report().tabs[0]], missed: [] }] }, detached)
    expect(merged.total).toBe(3)
    expect(merged.missedTotal).toBe(1)
    expect(merged.workspaces.map(ws => ws.workspaceId)).toEqual(['a', 'x', 'y'])
  })
})

describe('detached window: DetachedWaitingReporter', () => {
  const sent = () => api.workspace.reportDetachedWaiting.mock.calls.map(call => call[0] as DetachedWaitingReport)

  test('sends its workspace entry on every change (an empty one too), never twice the same', () => {
    const tab = workspaceStore.addTerminal(wsC.id, 'claude-cli')
    workspaceStore.setAutoTitle(tab.id, 'Claude CLI')
    const other = workspaceStore.addTerminal(wsA.id, 'claude-cli') // another workspace: never in the report
    render(<DetachedWaitingReporter workspace={wsC} />)
    expect(sent()).toEqual([{ tabs: [], missed: [] }])

    act(() => {
      setTerminalAttention(ev(other.id, { blockedReason: 'permission', blockedSince: T }))
    })
    expect(sent()).toHaveLength(1)

    act(() => {
      setTerminalAttention(ev(tab.id, { blockedReason: 'question', blockedSince: T }))
    })
    expect(sent()).toHaveLength(2)
    expect(sent()[1]).toEqual({ tabs: [{ id: tab.id, title: 'Claude CLI', reason: 'question', since: T }], missed: [] })

    act(() => {
      setTerminalAttention(ev(tab.id, { blockedReason: 'question', blockedSince: T, busy: true })) // same wait
    })
    expect(sent()).toHaveLength(2)
  })

  test('D203 in the detached window: an unseen end → missed; seen → nothing', () => {
    const tab = workspaceStore.addTerminal(wsC.id, 'claude-cli')
    workspaceStore.setAutoTitle(tab.id, 'Claude CLI')
    render(<DetachedWaitingReporter workspace={wsC} />)
    act(() => {
      setViewingState(null, false)
      setTerminalAttention(ev(tab.id, { blockedReason: 'permission', blockedSince: T }))
      setTerminalAttention(ev(tab.id))
    })
    const last = sent()[sent().length - 1]
    expect(last.tabs).toEqual([])
    expect(last.missed.map(m => [m.id, m.reason])).toEqual([[tab.id, 'permission']])

    act(() => {
      setViewingState(tab.id, true) // the user looks at it in the detached window
    })
    expect(sent()[sent().length - 1]).toEqual({ tabs: [], missed: [] })
  })
})

describe('parent window: the detached workspace row', () => {
  test('no report or an empty one → no row (the list still hides the workspace)', () => {
    const { container } = renderSidebar([wsC])
    expect(detachedRow(container)).toBeNull()
    expect(container.textContent).not.toContain('T0761-C')
    act(() => setDetachedWaiting(wsC.id, { tabs: [], missed: [] }))
    expect(detachedRow(container)).toBeNull()
  })

  test('waiting tabs → `↗ <name> (detached) ⚠️ N`; a click focuses the tab waiting longest in the detached window', () => {
    const { container } = renderSidebar([wsC])
    act(() => setDetachedWaiting(wsC.id, sanitizeDetachedWaitingReport(report())))
    const row = detachedRow(container)!
    expect(row).not.toBeNull()
    expect(row.textContent).toContain('↗ T0761-C (detached)')
    const badge = row.querySelector('.workspace-waiting-badge') as HTMLElement
    expect(badge.textContent).toBe('⚠️ 2')
    expect(badge.dataset.waiting).toBe('waiting')
    expect(badge.dataset.waitingTarget).toBe('c-1')
    expect(row.title).toContain('Claude CLI · Tower')
    expect(row.title).toContain('Codex CLI')
    expect(row.title).toContain('detached window')

    fireEvent.click(row)
    expect(api.workspace.focusDetachedTerminal).toHaveBeenCalledWith(wsC.id, 'c-1')

    act(() => setDetachedWaiting(wsC.id, { tabs: [], missed: [] }))
    expect(detachedRow(container)).toBeNull()
    expect(getDetachedWaiting(wsC.id)).toBeNull()
  })

  test('missed only → a faded ⚠️ without a count; the click goes to that tab', () => {
    const { container } = renderSidebar([wsC])
    act(() => setDetachedWaiting(wsC.id, { tabs: [], missed: [{ id: 'm1', title: 'Worker T0001', reason: 'permission', startedAt: T }] }))
    const badge = detachedRow(container)!.querySelector('.workspace-waiting-badge') as HTMLElement
    expect(badge.className).toContain('missed')
    expect(badge.textContent).toBe('⚠️')
    fireEvent.click(detachedRow(container)!)
    expect(api.workspace.focusDetachedTerminal).toHaveBeenCalledWith(wsC.id, 'm1')
  })

  test('a workspace not passed as detached never shows a row from a report', () => {
    const { container } = renderSidebar([])
    act(() => setDetachedWaiting(wsC.id, report()))
    expect(detachedRow(container)).toBeNull()
  })

  test('the tab title / collapsed bar total counts detached workspaces and names them', () => {
    const tower = workspaceStore.addTerminal(wsA.id, 'claude-cli')
    workspaceStore.setAutoTitle(tower.id, 'Tower')
    const { container } = render(<WaitingTotalBadge workspaces={[wsA]} detachedWorkspaces={[wsC]} hintKey="sidebar.waitingForUserShowList" />)
    act(() => {
      setTerminalAttention(ev(tower.id, { blockedReason: 'question', blockedSince: T }))
      setDetachedWaiting(wsC.id, report())
    })
    const badge = container.querySelector('.waiting-total') as HTMLElement
    expect(badge.textContent).toBe('⚠️ 3')
    expect(badge.title).toContain('T0761-C (detached)')
  })
})

describe('wiring (source guards)', () => {
  const root = join(__dirname, '..', '..', '..')
  const read = (rel: string) => readFileSync(join(root, rel), 'utf8')

  test('main: the workspace is the sender\'s own and the payload is sanitized; focus brings the window to the front', () => {
    const main = read('electron/main.ts')
    const on = main.slice(main.indexOf("ipcMain.on('workspace:detached-waiting'"), main.indexOf("ipcMain.handle('workspace:focus-detached-terminal'"))
    expect(on).toContain('getDetachedWorkspaceIdByWebContents(event.sender)')
    expect(on).toContain('sanitizeDetachedWaitingReport(report)')
    expect(on).toContain("'workspace:detached-waiting-changed'")
    const focus = main.slice(main.indexOf("ipcMain.handle('workspace:focus-detached-terminal'"))
    expect(focus.slice(0, 1200)).toContain('bringWindowToFront(win)')
    expect(focus.slice(0, 1200)).toContain("'workspace:focus-terminal'")
  })

  test('App: the detached window reports, the parent stores (sanitized), reattach clears, the list still hides detached workspaces', () => {
    const app = read('src/App.tsx')
    expect(app).toContain('<DetachedWaitingReporter workspace={ws} />')
    expect(app).toContain('setDetachedWaiting(workspaceId, sanitizeDetachedWaitingReport(report))')
    expect(app).toContain('setDetachedWaiting(wsId, null)')
    expect(app).toContain('const nonDetachedWorkspaces = state.workspaces.filter(w => !detachedIds.has(w.id))')
    expect(app).toContain('terminal.workspaceId !== detachedWorkspaceId')
  })
})
