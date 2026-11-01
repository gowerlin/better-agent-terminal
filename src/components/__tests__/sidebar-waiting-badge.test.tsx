/**
 * T0735 (D200 ③④⑤): the workspace list shows ⚠️ on every workspace (the active one included) that
 * has a tab waiting for the user — any tab: a Tower tab in AskUserQuestion, a Worker on a
 * permission prompt, a plain codex tab on `input`. `⚠️ N` for N > 1. The tooltip lists the tabs and
 * why, without any question text; a click selects the workspace and the tab waiting longest, a
 * click elsewhere on the row only selects the workspace. `?` (a Worker waiting for its Tower) never
 * shows it; a cleared state removes it.
 */
import { act } from 'react'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { fireEvent, render } from '@testing-library/react'
import i18n from '../../i18n'
import { Sidebar } from '../Sidebar'
import { workspaceStore } from '../../stores/workspace-store'
import { resetTerminalAttention, setTerminalAttention, setViewingState } from '../../stores/terminal-attention-store'
import { WaitingTotalBadge } from '../WorkspaceWaitingBadge'
import type { TerminalAttentionEvent } from '../../lib/terminal-attention'
import type { Workspace } from '../../types'

const replay = vi.hoisted(() => ({ requestPtyReplay: vi.fn() }))
vi.mock('../../lib/pty-replay', () => replay)

/** Any electronAPI call resolves to undefined, any `on*` returns an unsubscribe. */
function permissiveApi(): unknown {
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
  })
}

beforeAll(async () => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
  await i18n.changeLanguage('en')
})

afterAll(() => {
  vi.unstubAllGlobals()
})

const ev = (id: string, extra: Partial<TerminalAttentionEvent> = {}): TerminalAttentionEvent => ({ id, pendingQuestions: 0, ...extra })
const clock = (epoch: number) => new Date(epoch).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
const T = new Date(2026, 10, 1, 13, 0).getTime()

let wsA: Workspace
let wsB: Workspace
let ids: { tower: string; worker: string; asking: string; codex: string }

beforeEach(() => {
  ;(window as unknown as { electronAPI: unknown }).electronAPI = permissiveApi()
  resetTerminalAttention()
  wsA = workspaceStore.addWorkspace('T0735-A', '/tmp/a')
  wsB = workspaceStore.addWorkspace('T0735-B', '/tmp/b')
  const tower = workspaceStore.addTerminal(wsA.id, 'claude-cli', { launchRole: 'tower' })
  workspaceStore.setAutoTitle(tower.id, 'Claude CLI · Tower')
  const worker = workspaceStore.addTerminal(wsB.id)
  workspaceStore.setAutoTitle(worker.id, 'Worker T0001')
  const asking = workspaceStore.addTerminal(wsB.id)
  workspaceStore.setAutoTitle(asking.id, 'Worker T0002')
  const codex = workspaceStore.addTerminal(wsB.id, 'codex-cli')
  workspaceStore.setAutoTitle(codex.id, 'Codex CLI')
  ids = { tower: tower.id, worker: worker.id, asking: asking.id, codex: codex.id }
  workspaceStore.setActiveWorkspace(wsB.id)
})

afterEach(() => {
  resetTerminalAttention()
  workspaceStore.removeWorkspace(wsA.id)
  workspaceStore.removeWorkspace(wsB.id)
  vi.useRealTimers()
})

function renderSidebar(onSelectWorkspace: (id: string) => void = (id) => workspaceStore.setActiveWorkspace(id)) {
  const noop = () => {}
  return render(
    <Sidebar
      width={240}
      workspaces={[wsA, wsB]}
      activeWorkspaceId={workspaceStore.getState().activeWorkspaceId}
      windowId="w1"
      groups={[]}
      activeGroup={null}
      archivedWorkspaces={[]}
      onSetActiveGroup={noop}
      onSetWorkspaceGroup={noop}
      onSelectWorkspace={onSelectWorkspace}
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

const rowOf = (container: HTMLElement, name: string) =>
  [...container.querySelectorAll('.workspace-item')].find(el => el.textContent?.includes(name)) as HTMLElement
const badgeOf = (container: HTMLElement, name: string) => rowOf(container, name).querySelector('.workspace-waiting-badge') as HTMLElement | null

describe('workspace list ⚠️ (T0735)', () => {
  test('a Tower tab in AskUserQuestion → ⚠️ on its workspace (not the active one); cleared → gone', () => {
    const { container } = renderSidebar()
    expect(badgeOf(container, 'T0735-A')).toBeNull()
    act(() => setTerminalAttention(ev(ids.tower, { blockedReason: 'question', blockedSince: T })))
    const badge = badgeOf(container, 'T0735-A')!
    expect(badge).toHaveTextContent(/^⚠️$/)
    expect(badge.title).toBe([
      'Waiting for you: 1 tab(s)',
      `• Claude CLI · Tower: Waiting for you: a question to answer (since ${clock(T)})`,
      'Click to go to Claude CLI · Tower (waiting longest)',
    ].join('\n'))
    // ask-user-question-done → empty state; nobody looked at the tab → faded (D203), looked at → gone
    act(() => setTerminalAttention(ev(ids.tower)))
    expect(badgeOf(container, 'T0735-A')).toHaveClass('missed')
    act(() => setViewingState(ids.tower, true))
    expect(badgeOf(container, 'T0735-A')).toBeNull()
  })

  test('? (a Worker waiting for its Tower) and a busy turn never show it', () => {
    const { container } = renderSidebar()
    act(() => {
      setTerminalAttention(ev(ids.asking, { blockedReason: 'tower', blockedSince: T, pendingQuestions: 1, questionsSince: T }))
      setTerminalAttention(ev(ids.worker, { busy: true }))
    })
    expect(badgeOf(container, 'T0735-B')).toBeNull()
  })

  test('the active workspace too; N > 1 → ⚠️ N; the click goes to the tab waiting longest', () => {
    vi.useFakeTimers()
    const dispatched: string[] = []
    const onSwitch = (e: Event) => dispatched.push((e as CustomEvent).detail.tab)
    window.addEventListener('workspace-switch-tab', onSwitch)
    try {
      workspaceStore.setActiveWorkspace(wsA.id)
      const onSelect = vi.fn((id: string) => workspaceStore.setActiveWorkspace(id))
      const { container } = renderSidebar(onSelect)
      act(() => {
        setTerminalAttention(ev(ids.worker, { blockedReason: 'permission', blockedSince: T + 60_000 }))
        setTerminalAttention(ev(ids.codex, { blockedReason: 'input', blockedSince: T }))
        setTerminalAttention(ev(ids.asking, { blockedReason: 'tower', blockedSince: T - 60_000, pendingQuestions: 1 }))
      })
      const badge = badgeOf(container, 'T0735-B')!
      expect(badge).toHaveTextContent('⚠️ 2')
      expect(badge.title.split('\n')).toEqual([
        'Waiting for you: 2 tab(s)',
        `• Codex CLI: Waiting for you: codex needs input, an approval or a question (since ${clock(T)})`,
        `• Worker T0001: Waiting for you: a permission prompt (since ${clock(T + 60_000)})`,
        'Click to go to Codex CLI (waiting longest)',
      ])
      act(() => fireEvent.click(badge))
      expect(onSelect).toHaveBeenCalledWith(wsB.id)
      expect(workspaceStore.getState().activeWorkspaceId).toBe(wsB.id)
      expect(workspaceStore.getState().focusedTerminalId).toBe(ids.codex)
      act(() => { vi.runAllTimers() })
      expect(dispatched).toEqual(['terminal'])

      // the active workspace shows its own ⚠️ as well
      act(() => setTerminalAttention(ev(ids.tower, { blockedReason: 'elicitation', blockedSince: T })))
      expect(badgeOf(container, 'T0735-A')).toHaveTextContent(/^⚠️$/)
    } finally {
      window.removeEventListener('workspace-switch-tab', onSwitch)
    }
  })

  test('a click elsewhere on the row still only selects the workspace', () => {
    const onSelect = vi.fn()
    const { container } = renderSidebar(onSelect)
    act(() => setTerminalAttention(ev(ids.tower, { blockedReason: 'question', blockedSince: T })))
    const focusedBefore = workspaceStore.getState().focusedTerminalId
    fireEvent.click(rowOf(container, 'T0735-A').querySelector('.workspace-folder')!)
    expect(onSelect).toHaveBeenCalledWith(wsA.id)
    expect(workspaceStore.getState().focusedTerminalId).toBe(focusedBefore)
  })
})

describe('faded ⚠️ on the row (T0735 D203)', () => {
  test('ended unseen → faded, no count; a click goes to that tab; looked at → gone; solid wins', () => {
    vi.useFakeTimers()
    vi.setSystemTime(T)
    workspaceStore.setActiveWorkspace(wsB.id)
    const { container } = renderSidebar()
    act(() => setTerminalAttention(ev(ids.tower, { blockedReason: 'question', blockedSince: 1 })))
    act(() => setTerminalAttention(ev(ids.tower)))
    const faded = badgeOf(container, 'T0735-A')!
    expect(faded).toHaveClass('missed')
    expect(faded).toHaveAttribute('data-waiting', 'missed')
    expect(faded).toHaveTextContent(/^⚠️$/)
    expect(faded.title.split('\n')).toEqual([
      'A wait for you ended while you were away',
      `• Claude CLI · Tower: Waited for you at ${clock(T)}, ended`,
      'Click to go to Claude CLI · Tower (waiting longest)',
    ])
    // another tab of A waits now → solid with the waiting count only
    const second = workspaceStore.addTerminal(wsA.id)
    workspaceStore.setAutoTitle(second.id, 'Terminal 2')
    act(() => setTerminalAttention(ev(second.id, { blockedReason: 'permission', blockedSince: 1 })))
    expect(badgeOf(container, 'T0735-A')).not.toHaveClass('missed')
    expect(badgeOf(container, 'T0735-A')).toHaveTextContent(/^⚠️$/)
    expect(badgeOf(container, 'T0735-A')!.getAttribute('data-waiting-target')).toBe(second.id)
    act(() => setTerminalAttention(ev(second.id)))
    // the click on a faded mark goes to the tab whose wait began first
    act(() => fireEvent.click(badgeOf(container, 'T0735-A')!))
    expect(workspaceStore.getState().focusedTerminalId).toBe(ids.tower)
    act(() => setViewingState(ids.tower, true))
    act(() => setViewingState(second.id, true))
    expect(badgeOf(container, 'T0735-A')).toBeNull()
  })
})

describe('total ⚠️ — 工作區 tab title / collapsed sidebar (T0735 D202 ②③)', () => {
  function renderTotal() {
    return render(
      <button className="left-sidebar-tab" data-testid="tab">
        Workspaces
        <WaitingTotalBadge workspaces={[wsA, wsB]} hintKey="sidebar.waitingForUserShowList" />
      </button>,
    )
  }

  test('nothing waits → nothing; waiting tabs in two workspaces → ⚠️ N with the workspace names', () => {
    const { container } = renderTotal()
    expect(container.querySelector('.workspace-waiting-badge')).toBeNull()
    act(() => {
      setTerminalAttention(ev(ids.tower, { blockedReason: 'question', blockedSince: T }))
      setTerminalAttention(ev(ids.codex, { blockedReason: 'input', blockedSince: T }))
      setTerminalAttention(ev(ids.worker, { blockedReason: 'permission', blockedSince: T }))
      setTerminalAttention(ev(ids.asking, { blockedReason: 'tower', blockedSince: T, pendingQuestions: 1 }))
    })
    const badge = container.querySelector('.workspace-waiting-badge') as HTMLElement
    expect(badge).toHaveTextContent('⚠️ 3')
    expect(badge.title.split('\n')).toEqual([
      'Waiting for you: 3 tab(s) in 2 workspace(s)',
      '• T0735-A: 1',
      '• T0735-B: 2',
      'Click to show the workspace list',
    ])
    // a click without `onClick` is the tab button's own (switch tabs only)
    const focusedBefore = workspaceStore.getState().focusedTerminalId
    const activeBefore = workspaceStore.getState().activeWorkspaceId
    const tabClick = vi.fn()
    container.querySelector('[data-testid="tab"]')!.addEventListener('click', tabClick)
    fireEvent.click(badge)
    expect(tabClick).toHaveBeenCalledTimes(1)
    expect(workspaceStore.getState().focusedTerminalId).toBe(focusedBefore) // no tab jump
    expect(workspaceStore.getState().activeWorkspaceId).toBe(activeBefore)
  })

  test('only missed waits → faded, no count; solid as soon as one waits', () => {
    const { container } = renderTotal()
    act(() => setTerminalAttention(ev(ids.codex, { blockedReason: 'input', blockedSince: T })))
    act(() => setTerminalAttention(ev(ids.codex)))
    const faded = container.querySelector('.workspace-waiting-badge') as HTMLElement
    expect(faded).toHaveClass('missed')
    expect(faded).toHaveTextContent(/^⚠️$/)
    expect(faded.title.split('\n')).toEqual([
      'A wait for you ended while you were away',
      '• T0735-B: a wait ended while you were away',
      'Click to show the workspace list',
    ])
    act(() => setTerminalAttention(ev(ids.tower, { blockedReason: 'question', blockedSince: T })))
    expect(container.querySelector('.workspace-waiting-badge')).not.toHaveClass('missed')
    expect((container.querySelector('.workspace-waiting-badge') as HTMLElement).title.split('\n')).toEqual([
      'Waiting for you: 1 tab(s) in 1 workspace(s)',
      '• T0735-A: 1',
      '• T0735-B: a wait ended while you were away',
      'Click to show the workspace list',
    ])
  })

  test('collapsed sidebar: the click runs `onClick` (expand) once, without selecting a tab', () => {
    const expand = vi.fn()
    // as in App: next to the expand button, not inside it
    const { container } = render(
      <div className="left-sidebar-collapsed">
        <WaitingTotalBadge workspaces={[wsA, wsB]} hintKey="sidebar.waitingForUserExpand" onClick={expand} />
      </div>,
    )
    act(() => setTerminalAttention(ev(ids.tower, { blockedReason: 'elicitation', blockedSince: T })))
    const badge = container.querySelector('.workspace-waiting-badge') as HTMLElement
    expect(badge).toHaveTextContent(/^⚠️$/)
    expect(badge.title.split('\n').at(-1)).toBe('Click to expand the sidebar')
    const focusedBefore = workspaceStore.getState().focusedTerminalId
    fireEvent.click(badge)
    expect(expand).toHaveBeenCalledTimes(1)
    expect(workspaceStore.getState().focusedTerminalId).toBe(focusedBefore)
  })
})
