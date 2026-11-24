/**
 * PLAN-068 W4 / T0906: the「待辦」(Inbox) tab.
 *
 * - §6′ screens: every row of the table (match / P-1 / P-2 / P-3, both sources) and the title badge
 *   (`!` on a mismatch, the count on a match); a mismatch shows only the picker and the hint —
 *   BAT data included (Tower answer Q-2)
 * - layout: fixed section order, one-line empty sections, folding remembered in localStorage,
 *   picker only with > 1 declared Tower, `todo` all items with long ones folded
 * - BAT data: pending-verify BUG → Control Tower Bugs; counts; Worker waits from the existing stores
 * - R6: the overview links `todo` to the Inbox only on a match, else lists it as before
 * - plumbing: tab name in three languages, an old docking save keeps working, one shared
 *   `_ct-workorders/` watch, the data source reading through the panel's fs pipeline
 */
import { act } from 'react'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import i18n from '../../i18n'
import en from '../../locales/en.json'
import zhTW from '../../locales/zh-TW.json'
import zhCN from '../../locales/zh-CN.json'
import { InboxPanel, InboxTabBadge } from '../InboxPanel'
import { InboxDataSource, loadInboxFiles } from '../inbox/InboxDataSource'
import { TowerOverview } from '../TowerOverview'
import { ControlTowerPanel } from '../ControlTowerPanel'
import { workspaceStore } from '../../stores/workspace-store'
import { applyTowerContract, resetTowerContractStore } from '../../stores/tower-contract-store'
import { applyHooksStatus, resetHooksStatusStore } from '../../stores/hooks-status-store'
import { resetTerminalAttention, setTerminalAttention } from '../../stores/terminal-attention-store'
import { applyNotifyHold, resetNotifyHoldStore } from '../../stores/notify-hold-store'
import { resetInterruptedAgentsStoreForTests, setInterruptedAgents } from '../../stores/interrupted-agents-store'
import {
  EMPTY_INBOX_FILES,
  OPEN_DOCK_PANEL_EVENT,
  getInboxFiles,
  resetInboxStore,
  setInboxFiles,
  takeControlTowerTabRequest,
  type InboxFiles,
} from '../../stores/inbox-store'
import { acquireDirWatch, dirWatchUsers, resetDirWatches } from '../../stores/ct-dir-watch'
import { parseTowerState } from '../../lib/ct-tower-overview'
import { INBOX_FOLDED_STORAGE_KEY } from '../../lib/inbox-model'
import { DEFAULT_DOCKING_CONFIG, DOCKABLE_PANELS, normalizeDockingConfig, type Workspace } from '../../types'
import type { BugEntry } from '../../types/bug-tracker'

const WS_DIR = '/tmp/t0906-ws'
const CT = `${WS_DIR}/_ct-workorders`

const stateFile = (extra = '') =>
  `---\nschema_kind: tower-state\nsummary_version: 1\n${extra}todo:\n  - "first to-do"\n  - "${'long '.repeat(60)}"\n---\n# 塔台\n`

const order = (id: string, status: string) =>
  `---
schema_version: 1
schema_kind: workorder
id: ${id}
title: "${id} title"
status: ${status}
---

# ${id}
`

const bug = (id: string, status: BugEntry['status']): BugEntry => ({
  id, filename: `${id}.md`, title: `${id} title`, severity: 'Low', status, reportedAt: '', isArchived: false, linkPath: `${id}.md`,
})

function files(stateExtra: string | null, extra: Partial<InboxFiles> = {}): InboxFiles {
  return {
    ...EMPTY_INBOX_FILES,
    hasCtDir: true,
    state: stateExtra === null ? { status: 'missing' } : { status: 'loaded', parsed: parseTowerState(stateFile(stateExtra)) },
    bugs: [bug('BUG-1', 'OPEN'), bug('BUG-2', 'FIXED'), bug('BUG-3', 'VERIFY')],
    orderStatuses: ['PENDING', 'IN_PROGRESS', 'DONE'],
    ...extra,
  }
}

function fsApi(fileMap: Record<string, string> = {}) {
  return {
    readdir: vi.fn(async (dir: string) => {
      const prefix = `${dir}/`
      const names = Object.keys(fileMap).filter(p => p.startsWith(prefix) && !p.slice(prefix.length).includes('/'))
      if (names.length === 0 && dir !== CT) throw new Error('ENOENT')
      return names.map(p => ({ name: p.slice(prefix.length), path: p, isDirectory: false }))
    }),
    readFile: vi.fn(async (path: string) => (path in fileMap ? { content: fileMap[path] } : { error: 'Failed to read file' })),
    stat: vi.fn(async (path: string) => (path in fileMap ? { mtimeMs: 0, size: 1 } : null)),
    watch: vi.fn(async () => true),
    unwatch: vi.fn(async () => true),
    resetWatch: vi.fn(async () => true),
    onChanged: vi.fn((_cb: (p: string) => void) => () => {}),
  }
}

let ws: Workspace
let fs: ReturnType<typeof fsApi>

beforeAll(async () => {
  await i18n.changeLanguage('en')
})

beforeEach(() => {
  fs = fsApi()
  ;(window as unknown as { electronAPI: unknown }).electronAPI = {
    fs,
    debug: { log: vi.fn() },
    pty: { onNotifyHoldChanged: vi.fn(() => () => {}), notifyHoldList: vi.fn(async () => []) },
    ctConfig: { readSources: vi.fn(async () => ({ global: { status: 'missing' }, defaults: { status: 'missing' } })) },
  }
  localStorage.removeItem(INBOX_FOLDED_STORAGE_KEY)
  ws = workspaceStore.addWorkspace('T0906', WS_DIR)
})

afterEach(() => {
  cleanup()
  act(() => {
    workspaceStore.removeWorkspace(ws.id)
    resetTowerContractStore()
    resetHooksStatusStore() // T0910
    resetTerminalAttention()
    resetNotifyHoldStore()
    resetInterruptedAgentsStoreForTests()
    resetInboxStore()
  })
  resetDirWatches()
  delete (window as unknown as { electronAPI?: unknown }).electronAPI
})

afterAll(async () => {
  await i18n.changeLanguage('en')
})

function tower(title: string, towerContract: number | null) {
  const terminal = workspaceStore.addTerminal(ws.id, 'claude-cli')
  workspaceStore.setAutoTitle(terminal.id, title)
  applyTowerContract({ id: terminal.id, role: 'tower', towerContract: towerContract ?? undefined })
  return terminal
}

function renderPanel() {
  return render(
    <>
      <span data-testid="tab">Inbox<InboxTabBadge workspaceId={ws.id} workspaceFolderPath={WS_DIR} /></span>
      <InboxPanel workspaceId={ws.id} workspaceFolderPath={WS_DIR} />
    </>,
  )
}

const badge = () => document.querySelector('[data-inbox-badge]')?.getAttribute('data-inbox-badge') ?? null
const gate = () => document.querySelector('[data-inbox-gate]')?.getAttribute('data-inbox-gate') ?? null
const sections = () => Array.from(document.querySelectorAll('[data-inbox-section]')).map(el => el.getAttribute('data-inbox-section'))

describe('§6′ screens', () => {
  it('Tower 2 × state 2: everything, sections in fixed order, count on the title', () => {
    tower('Claude CLI · Tower', 2)
    act(() => setInboxFiles(WS_DIR, files('bat_contract: 2\n')))
    renderPanel()
    expect(gate()).toBeNull()
    expect(document.querySelector('[data-inbox-verdict]')?.getAttribute('data-inbox-verdict')).toBe('match')
    expect(sections()).toEqual(['decide', 'act', 'remind', 'workers', 'messages', 'todo', 'counts'])
    // W5 / W6 sections: one line「(none)」, no placeholder text
    for (const id of ['decide', 'remind', 'messages', 'workers']) {
      const section = document.querySelector(`[data-inbox-section="${id}"]`) as HTMLElement
      expect(section.textContent).toContain(en.inbox.none)
    }
    expect(document.body.textContent).not.toMatch(/後續版本|later version/)
    expect(badge()).toBe('2') // two BUGs to accept, no Worker waits
  })

  it('T0910: Tower 2 × state 2 without BAT hooks → one hooks line under the header; a mismatch shows none', () => {
    const t = tower('Claude CLI · Tower', 2)
    act(() => {
      setInboxFiles(WS_DIR, files(`bat_contract: 2${String.fromCharCode(10)}`))
      applyHooksStatus({ id: t.id, hooksStatus: { state: 'none', reason: 'not-launched-by-bat' } })
    })
    renderPanel()
    expect(document.querySelector('[data-inbox-hooks]')?.getAttribute('data-inbox-hooks')).toBe('not-launched-by-bat')
    expect(document.querySelector('.inbox-header')?.nextElementSibling?.getAttribute('data-inbox-hooks')).toBe('not-launched-by-bat')
    cleanup()
    act(() => { applyTowerContract({ id: t.id, role: 'tower', towerContract: undefined }) })
    renderPanel()
    expect(gate()).toBe('P-1')
    expect(document.querySelector('[data-inbox-hooks]')).toBeNull()
  })

  it('Tower 2 × state v1: P-3 only, `!` on the title, no BAT data', () => {
    tower('T', 2)
    act(() => setInboxFiles(WS_DIR, files('')))
    renderPanel()
    expect(gate()).toBe('P-3')
    expect(screen.getByText(i18n.t('inbox.gate.stateBehind', { supported: 2 }))).toBeTruthy()
    expect(sections()).toEqual([])
    expect(screen.queryByText(/BUG-2/)).toBeNull()
    expect(badge()).toBe('!')
  })

  it('Tower 2 × state 3: P-2 (the state file is newer)', () => {
    tower('T', 2)
    act(() => setInboxFiles(WS_DIR, files('bat_contract: 3\n')))
    renderPanel()
    expect(gate()).toBe('P-2')
    expect(screen.getByText(i18n.t('towerContract.batOutdated', { supported: 2, requested: 3 }))).toBeTruthy()
    expect(badge()).toBe('!')
  })

  it('Tower not declared: P-1 whatever the state file says', () => {
    tower('T', null)
    act(() => setInboxFiles(WS_DIR, files('bat_contract: 2\n')))
    renderPanel()
    expect(gate()).toBe('P-1')
    expect(screen.getByText(i18n.t('towerContract.ctOutdated', { supported: 2 }))).toBeTruthy()
    expect(badge()).toBe('!')
  })

  it('Tower 3: P-2 whatever the state file says', () => {
    tower('T', 3)
    act(() => setInboxFiles(WS_DIR, files('bat_contract: 2\n')))
    renderPanel()
    expect(gate()).toBe('P-2')
    expect(screen.getByText(i18n.t('towerContract.batOutdated', { supported: 2, requested: 3 }))).toBeTruthy()
  })

  it('no declared Tower: the state file decides (2 → on, v1 → P-1, missing file noted)', () => {
    act(() => setInboxFiles(WS_DIR, files('bat_contract: 2\n')))
    const { unmount } = renderPanel()
    expect(gate()).toBeNull()
    expect(screen.getByText(en.inbox.noTower)).toBeTruthy()
    unmount()
    act(() => setInboxFiles(WS_DIR, files(null)))
    renderPanel()
    expect(gate()).toBe('P-1')
    expect(screen.getByText(i18n.t('inbox.gate.stateV1', { supported: 2 }))).toBeTruthy()
    expect(screen.getByText(en.inbox.stateMissing)).toBeTruthy()
    expect(badge()).toBe('!')
  })

  it('no declared Tower and no _ct-workorders/: "no Control Tower here", no badge', () => {
    act(() => setInboxFiles(WS_DIR, { ...EMPTY_INBOX_FILES, hasCtDir: false }))
    renderPanel()
    expect(document.querySelector('[data-inbox-empty="no-ct"]')).toBeTruthy()
    expect(gate()).toBeNull()
    expect(badge()).toBeNull()
  })

  it('still loading: no gate and no badge yet', () => {
    tower('T', 2)
    renderPanel()
    expect(gate()).toBeNull()
    expect(badge()).toBeNull()
    expect(screen.getByText(en.inbox.loading)).toBeTruthy()
  })
})

describe('Tower picker', () => {
  it('appears with two declared Towers and follows the picked one', () => {
    tower('Tower A', 2)
    const b = tower('Tower B', null)
    act(() => setInboxFiles(WS_DIR, files('bat_contract: 2\n')))
    renderPanel()
    const picker = screen.getByLabelText(en.inbox.towerPicker) as HTMLSelectElement
    expect(Array.from(picker.options).map(o => o.textContent)).toEqual(['Tower A', 'Tower B'])
    expect(gate()).toBeNull()
    act(() => { fireEvent.change(picker, { target: { value: b.id } }) })
    expect(gate()).toBe('P-1')
    expect(badge()).toBe('!')
  })

  it('one declared Tower: its name, no picker', () => {
    tower('Only Tower', 2)
    act(() => setInboxFiles(WS_DIR, files('bat_contract: 2\n')))
    renderPanel()
    expect(screen.queryByLabelText(en.inbox.towerPicker)).toBeNull()
    expect(screen.getByText('Only Tower')).toBeTruthy()
  })
})

describe('BAT data', () => {
  beforeEach(() => {
    tower('Tower', 2)
    act(() => setInboxFiles(WS_DIR, files('bat_contract: 2\n')))
  })

  it('BUGs to accept go to the Control Tower Bugs tab', () => {
    const opened: unknown[] = []
    const listener = (e: Event) => opened.push((e as CustomEvent).detail)
    window.addEventListener(OPEN_DOCK_PANEL_EVENT, listener)
    renderPanel()
    const act1 = document.querySelector('[data-inbox-section="act"]') as HTMLElement
    expect(Array.from(act1.querySelectorAll('[data-inbox-bug]')).map(el => el.getAttribute('data-inbox-bug'))).toEqual(['BUG-2', 'BUG-3'])
    fireEvent.click(within(act1).getAllByText(en.inbox.open)[0])
    window.removeEventListener(OPEN_DOCK_PANEL_EVENT, listener)
    expect(opened).toEqual([{ panel: 'control-tower' }])
    expect(takeControlTowerTabRequest()).toBe('bugs')
  })

  it('counts row: open BUGs, PLANs in progress, open work orders', () => {
    renderPanel()
    const counts = document.querySelector('[data-inbox-section="counts"]') as HTMLElement
    expect(counts.textContent).toContain(i18n.t('inbox.counts.bugs', { count: 1 }))
    expect(counts.textContent).toContain(i18n.t('inbox.counts.plans', { count: 0 }))
    expect(counts.textContent).toContain(i18n.t('inbox.counts.orders', { count: 2 }))
  })

  it('todo: folded by default, every item, long ones fold; folding is remembered', () => {
    const { unmount } = renderPanel()
    const todo = () => document.querySelector('[data-inbox-section="todo"]') as HTMLElement
    expect(todo().querySelector('.inbox-todo')).toBeNull()
    fireEvent.click(within(todo()).getByRole('button', { expanded: false }))
    const items = todo().querySelectorAll('.inbox-todo-item')
    expect(items).toHaveLength(2)
    expect(items[1].textContent).toContain('…')
    fireEvent.click(within(items[1] as HTMLElement).getByText(en.inbox.todoMore))
    expect(items[1].textContent).not.toContain('…')
    expect(JSON.parse(localStorage.getItem(INBOX_FOLDED_STORAGE_KEY) ?? '{}').todo).toBe(false)
    unmount()
    renderPanel()
    expect(todo().querySelector('.inbox-todo')).toBeTruthy()
  })

  it('Worker waits: ⚠️ / 📨 / ⏸ of this workspace; they count on the title', () => {
    const w1 = workspaceStore.addTerminal(ws.id, 'claude-cli')
    workspaceStore.setAutoTitle(w1.id, 'Worker 1')
    const w2 = workspaceStore.addTerminal(ws.id, 'claude-cli')
    workspaceStore.setAutoTitle(w2.id, 'Worker 2')
    const towerId = workspaceStore.getWorkspaceTerminals(ws.id)[0].id
    act(() => {
      setTerminalAttention({ id: w1.id, pendingQuestions: 0, blockedReason: 'permission', blockedSince: 1 })
      setTerminalAttention({ id: w2.id, pendingQuestions: 1, blockedReason: 'tower' }) // waits for the Tower: not listed
      applyNotifyHold({ terminalId: towerId, items: [{ holdId: 'h-1', heldAt: 5, hasText: true, hasEnter: true }] })
      setInterruptedAgents([{ terminalId: w2.id, agent: 'claude-cli', claudeSessionId: null, claudeSessionName: null, launchedBy: 'tab', cwd: WS_DIR, at: 9 }], () => true)
    })
    renderPanel()
    const workers = document.querySelector('[data-inbox-section="workers"]') as HTMLElement
    expect(Array.from(workers.querySelectorAll('[data-inbox-worker]')).map(el => el.getAttribute('data-inbox-worker'))).toEqual(['waiting', 'held', 'interrupted'])
    expect(workers.textContent).toContain(i18n.t('inbox.worker.waiting', { title: 'Worker 1', reason: en.inbox.worker.reason.permission }))
    expect(badge()).toBe('5') // 3 waits + 2 BUGs
    fireEvent.click(within(workers).getAllByText(en.inbox.worker.goTo)[0])
    expect(workspaceStore.getState().focusedTerminalId).toBe(w1.id)
  })
})

describe('R6: the overview `todo`', () => {
  const overview = (todoInInbox: boolean) => render(
    <TowerOverview
      towerState={{ status: 'loaded', parsed: parseTowerState(stateFile('bat_contract: 2\n')), mtime: null }}
      workOrders={[]}
      projectConfig={null}
      configSources={null}
      sprintStatus={null}
      ctDirPath={CT}
      onOpenFile={vi.fn()}
      todoInInbox={todoInInbox}
      onOpenInbox={vi.fn()}
    />,
  )

  it('on a match: only the count and a link to the Inbox', () => {
    overview(true)
    expect(screen.getByText(i18n.t('controlTower.overview.todoInInbox', { count: 2 }))).toBeTruthy()
    expect(screen.queryByText('first to-do')).toBeNull()
  })

  it('otherwise: listed as before (T0701)', () => {
    overview(false)
    expect(screen.getByText('first to-do')).toBeTruthy()
    expect(screen.queryByText(i18n.t('controlTower.overview.todoInInbox', { count: 2 }))).toBeNull()
  })

  async function panelWithState(stateExtra: string) {
    fs = fsApi({ [`${CT}/_tower-state.md`]: stateFile(stateExtra), [`${CT}/T0001-a.md`]: order('T0001', 'PENDING') })
    ;(window as unknown as { electronAPI: { fs: unknown } }).electronAPI.fs = fs
    render(<ControlTowerPanel isVisible={true} workspaceFolderPath={WS_DIR} workspaceId={ws.id} />)
    for (let i = 0; i < 8; i++) await act(async () => { await new Promise(r => setTimeout(r, 0)) })
    fireEvent.click(screen.getByText(en.controlTower.tab.sprint))
  }

  it('Control Tower panel: declared v2 Tower + state 2 → link', async () => {
    tower('T', 2)
    await panelWithState('bat_contract: 2\n')
    expect(screen.getByText(i18n.t('controlTower.overview.todoInInbox', { count: 2 }))).toBeTruthy()
    expect(screen.queryByText('first to-do')).toBeNull()
  })

  it('Control Tower panel: Tower not declared → todo listed as before', async () => {
    tower('T', null)
    await panelWithState('bat_contract: 2\n')
    expect(screen.getByText('first to-do')).toBeTruthy()
  })

  it('Control Tower panel without a workspace id (older caller) → listed as before', async () => {
    fs = fsApi({ [`${CT}/_tower-state.md`]: stateFile('bat_contract: 2\n'), [`${CT}/T0001-a.md`]: order('T0001', 'PENDING') })
    ;(window as unknown as { electronAPI: { fs: unknown } }).electronAPI.fs = fs
    render(<ControlTowerPanel isVisible={true} workspaceFolderPath={WS_DIR} />)
    for (let i = 0; i < 8; i++) await act(async () => { await new Promise(r => setTimeout(r, 0)) })
    fireEvent.click(screen.getByText(en.controlTower.tab.sprint))
    expect(screen.getByText('first to-do')).toBeTruthy()
  })
})

describe('plumbing', () => {
  it('tab name in three languages', () => {
    expect(en.workspace.inbox).toBe('Inbox')
    expect(zhTW.workspace.inbox).toBe('待辦')
    expect(zhCN.workspace.inbox).toBe('待办')
  })

  it('docking: inbox on the right before control-tower; an old save keeps its zones and gets inbox', () => {
    expect(DEFAULT_DOCKING_CONFIG.inbox).toBe('right')
    expect(DOCKABLE_PANELS.indexOf('inbox')).toBe(DOCKABLE_PANELS.indexOf('control-tower') - 1)
    const old = { files: 'left', git: 'main', 'git-graph': 'main', github: 'main', snippets: 'right', skills: 'main', agents: 'right', 'control-tower': 'left' }
    expect(normalizeDockingConfig(old)).toEqual({ ...old, inbox: 'right' })
    expect(normalizeDockingConfig({ inbox: 'nowhere' })).toEqual(DEFAULT_DOCKING_CONFIG)
    expect(normalizeDockingConfig(null)).toEqual(DEFAULT_DOCKING_CONFIG)
  })

  it('one fs:watch per directory: the last user unwatches', () => {
    const a = acquireDirWatch(CT)
    const b = acquireDirWatch(CT)
    expect(fs.watch).toHaveBeenCalledTimes(1)
    a()
    a()
    expect(fs.unwatch).not.toHaveBeenCalled()
    expect(dirWatchUsers(CT)).toBe(1)
    b()
    expect(fs.unwatch).toHaveBeenCalledTimes(1)
    expect(dirWatchUsers(CT)).toBe(0)
  })

  it('data source: reads the CT files, joins the watch, reloads on a change', async () => {
    fs = fsApi({
      [`${CT}/_tower-state.md`]: stateFile('bat_contract: 2\n'),
      [`${CT}/_bug-tracker.md`]: '## ✅ 已修復\n\n| ID | 標題 | 嚴重度 | 報修時間 |\n|---|---|---|---|\n| [BUG-9](BUG-9-x.md) | x | Low | 2026-11-25 |\n',
      [`${CT}/T0001-a.md`]: order('T0001', 'PENDING'),
      [`${CT}/T0002-b.md`]: order('T0002', 'DONE'),
    })
    let changed: ((p: string) => void) | null = null
    fs.onChanged = vi.fn((cb: (p: string) => void) => { changed = cb; return () => {} })
    ;(window as unknown as { electronAPI: { fs: unknown } }).electronAPI.fs = fs
    const { unmount } = render(<InboxDataSource folder={WS_DIR} />)
    for (let i = 0; i < 8; i++) await act(async () => { await new Promise(r => setTimeout(r, 0)) })
    const loaded = getInboxFiles(WS_DIR)
    expect(loaded.hasCtDir).toBe(true)
    expect(loaded.state?.status).toBe('loaded')
    expect(loaded.orderStatuses.sort()).toEqual(['DONE', 'PENDING'])
    expect(fs.watch).toHaveBeenCalledWith(CT)
    const reads = fs.readdir.mock.calls.length
    await act(async () => { changed?.(CT) })
    for (let i = 0; i < 8; i++) await act(async () => { await new Promise(r => setTimeout(r, 0)) })
    expect(fs.readdir.mock.calls.length).toBe(reads + 1)
    unmount()
    expect(fs.unwatch).toHaveBeenCalledWith(CT)
  })

  it('no _ct-workorders/ → hasCtDir false', async () => {
    const result = await loadInboxFiles('/nowhere')
    expect(result.hasCtDir).toBe(false)
  })
})
