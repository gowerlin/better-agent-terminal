/**
 * PLAN-041 / T0538: a Worker's report to its Tower marks the Worker tab "reported", and a Tower's
 * "Close reported Worker tabs (N)" closes exactly those.
 *
 * - findReportingWorkers: `source` = the Worker's work order (trimmed / upper-cased) AND
 *   `targetId` = its Tower; anything else marks nothing
 * - workersOfTower / reportedWorkersOfTower: the batch list and N (0 → the item is disabled)
 * - markWorkerReported: marks + saves; the report survives save() → load() and a detached
 *   window's list adopted back; nothing else changes
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const replay = vi.hoisted(() => ({ requestPtyReplay: vi.fn() }))
vi.mock('../../lib/pty-replay', () => replay)

import { findReportingWorkers, reportedWorkersOfTower, workersOfTower, workspaceStore } from '../workspace-store'
import type { TerminalInstance } from '../../types'

interface SavedTerminal { id: string; workerReport?: { message: string; reportedAt: number }; [key: string]: unknown }

const saves: Array<{ terminals: SavedTerminal[] }> = []
let loadData: string | null = null
let adoptResult: { terminals: unknown[] } | null = null
const kill = vi.fn()

beforeEach(() => {
  saves.length = 0
  loadData = null
  adoptResult = null
  kill.mockReset()
  ;(window as unknown as { electronAPI: unknown }).electronAPI = {
    debug: { log: vi.fn() },
    pty: { kill },
    claude: { stopSession: vi.fn() },
    workspace: {
      save: vi.fn(async (data: string) => { saves.push(JSON.parse(data)); return true }),
      load: vi.fn(async () => loadData),
      adoptDetached: vi.fn(async () => adoptResult),
    },
  }
  workspaceStore.getState().workspaces.slice().forEach(w => workspaceStore.removeWorkspace(w.id))
})

afterEach(() => {
  workspaceStore.stopAutoSave()
})

const tab = (id: string, extra: Partial<TerminalInstance> = {}) => ({ id, ...extra })
const terminal = (id: string) => workspaceStore.getState().terminals.find(t => t.id === id)
const lastSaved = () => saves[saves.length - 1].terminals

describe('findReportingWorkers (T0538)', () => {
  const tabs = [
    tab('tower-a'),
    tab('tower-b'),
    tab('w1', { towerTerminalId: 'tower-a', workorder: 'T0538' }),
    tab('w2', { towerTerminalId: 'tower-a', workorder: 'T0539' }),
    tab('w3', { towerTerminalId: 'tower-b', workorder: 'T0538' }),
    tab('plain', {}),
  ]

  it('source = the work order and target = its Tower → that Worker only', () => {
    expect(findReportingWorkers(tabs, 'tower-a', 'T0538')).toEqual(['w1'])
    expect(findReportingWorkers(tabs, 'tower-b', 'T0538')).toEqual(['w3'])
    expect(findReportingWorkers(tabs, 'tower-a', 'T0539')).toEqual(['w2'])
  })

  it('source is trimmed and upper-cased like --workorder', () => {
    expect(findReportingWorkers(tabs, 'tower-a', '  t0538 ')).toEqual(['w1'])
  })

  it('a matching work order under another Tower, another work order, or no / non-work-order source → nothing', () => {
    expect(findReportingWorkers(tabs, 'tower-b', 'T0539')).toEqual([])
    expect(findReportingWorkers(tabs, 'tower-a', 'T0540')).toEqual([])
    expect(findReportingWorkers(tabs, 'tower-a', undefined)).toEqual([])
    expect(findReportingWorkers(tabs, 'tower-a', '')).toEqual([])
    // bat-notify called with a terminal id as --source
    expect(findReportingWorkers(tabs, 'tower-a', 'w1')).toEqual([])
    expect(findReportingWorkers(tabs, 'w1', 'T0538')).toEqual([])
    expect(findReportingWorkers(tabs, '', 'T0538')).toEqual([])
  })

  it('every Worker of that Tower with that work order (Renew re-dispatch) is marked', () => {
    expect(findReportingWorkers([...tabs, tab('w1b', { towerTerminalId: 'tower-a', workorder: 'T0538' })], 'tower-a', 'T0538')).toEqual(['w1', 'w1b'])
  })
})

describe('batch close list (T0538)', () => {
  const report = { message: 'T0538 完成', reportedAt: 1 }
  const tabs = [
    tab('tower-a'),
    tab('w1', { towerTerminalId: 'tower-a', workorder: 'T0538', workerReport: report }),
    tab('w2', { towerTerminalId: 'tower-a', workorder: 'T0539' }),
    tab('w3', { towerTerminalId: 'tower-b', workorder: 'T0540', workerReport: report }),
    tab('w4', { towerTerminalId: 'tower-a', workorder: 'T0541', workerReport: report }),
  ]

  it('lists the reported Workers of that Tower only, in tab order', () => {
    expect(workersOfTower(tabs, 'tower-a').map(t => t.id)).toEqual(['w1', 'w2', 'w4'])
    expect(reportedWorkersOfTower(tabs, 'tower-a').map(t => t.id)).toEqual(['w1', 'w4'])
    expect(reportedWorkersOfTower(tabs, 'tower-b').map(t => t.id)).toEqual(['w3'])
  })

  it('N = 0 when no Worker reported; a tab that is not a Tower has no Workers', () => {
    expect(reportedWorkersOfTower(tabs.filter(t => t.id !== 'w1' && t.id !== 'w4'), 'tower-a')).toEqual([])
    expect(workersOfTower(tabs, 'w2')).toEqual([])
    expect(reportedWorkersOfTower(tabs, 'w2')).toEqual([])
  })
})

describe('workspaceStore.markWorkerReported (T0538)', () => {
  function setup() {
    const ws = workspaceStore.addWorkspace('ws', '/tmp/ws')
    const tower = workspaceStore.addTerminal(ws.id)
    workspaceStore.addExternalTerminal({ id: 'w1', cwd: '/tmp/ws', workspaceId: ws.id, towerTerminalId: tower.id, workorder: 'T0538' })
    workspaceStore.addExternalTerminal({ id: 'w2', cwd: '/tmp/ws', workspaceId: ws.id, towerTerminalId: tower.id, workorder: 'T0539' })
    return { ws, tower }
  }

  it('marks the reporting Worker with the message, saves, and changes nothing else', async () => {
    const { tower } = setup()
    expect(workspaceStore.markWorkerReported({ targetId: tower.id, source: 'T0538', message: 'T0538 完成' })).toEqual(['w1'])
    expect(terminal('w1')?.workerReport).toMatchObject({ message: 'T0538 完成' })
    expect(typeof terminal('w1')?.workerReport?.reportedAt).toBe('number')
    expect(terminal('w2')).not.toHaveProperty('workerReport')
    expect(terminal(tower.id)).not.toHaveProperty('workerReport')
    await workspaceStore.save()
    expect(lastSaved().find(t => t.id === 'w1')?.workerReport).toMatchObject({ message: 'T0538 完成' })
    expect(lastSaved().find(t => t.id === 'w2')).not.toHaveProperty('workerReport')
    // display only — nothing closed
    expect(kill).not.toHaveBeenCalled()
    expect(terminal('w1')).toBeDefined()
  })

  it('a later report replaces the message; a non-matching notify marks nothing and does not save', async () => {
    const { tower } = setup()
    workspaceStore.markWorkerReported({ targetId: tower.id, source: 'T0538', message: 'T0538 需要協助' })
    workspaceStore.markWorkerReported({ targetId: tower.id, source: 'T0538', message: 'T0538 完成' })
    expect(terminal('w1')?.workerReport?.message).toBe('T0538 完成')
    await workspaceStore.save()
    const before = saves.length
    expect(workspaceStore.markWorkerReported({ targetId: 'other-tower', source: 'T0538', message: 'x' })).toEqual([])
    expect(workspaceStore.markWorkerReported({ targetId: tower.id, source: 'T9999', message: 'x' })).toEqual([])
    await Promise.resolve()
    expect(saves.length).toBe(before)
  })

  it('a long message is cut to 200 characters', () => {
    const { tower } = setup()
    workspaceStore.markWorkerReported({ targetId: tower.id, source: 'T0538', message: 'x'.repeat(500) })
    expect(terminal('w1')?.workerReport?.message).toHaveLength(200)
  })

  it('save() → load() keeps the report (still shown after BAT reopens); invalid saved values are dropped', async () => {
    const { tower } = setup()
    workspaceStore.markWorkerReported({ targetId: tower.id, source: 'T0538', message: 'T0538 完成' })
    await workspaceStore.save()
    const saved = saves[saves.length - 1] as { terminals: SavedTerminal[] }
    saved.terminals.find(t => t.id === 'w2')!.workerReport = { message: 42 } as unknown as SavedTerminal['workerReport']
    loadData = JSON.stringify(saved)
    workspaceStore.getState().workspaces.slice().forEach(w => workspaceStore.removeWorkspace(w.id))
    await workspaceStore.load()
    expect(terminal('w1')).toMatchObject({ towerTerminalId: tower.id, workorder: 'T0538', workerReport: { message: 'T0538 完成' } })
    expect(terminal('w2')).not.toHaveProperty('workerReport')
    expect(reportedWorkersOfTower(workspaceStore.getState().terminals, tower.id).map(t => t.id)).toEqual(['w1'])
  })

  it('a detached window\'s list adopted back keeps a report this window did not see', async () => {
    const ws = workspaceStore.addWorkspace('ws', '/tmp/ws')
    workspaceStore.addExternalTerminal({ id: 'w-d', cwd: '/tmp/ws', workspaceId: ws.id, towerTerminalId: 'tower-d', workorder: 'T0538' })
    adoptResult = { terminals: [{ id: 'w-d', workspaceId: ws.id, type: 'terminal', title: 'Remote: claude', towerTerminalId: 'tower-d', workorder: 'T0538', workerReport: { message: 'T0538 完成', reportedAt: 5 } }] }
    await workspaceStore.adoptDetachedWorkspaceTerminals(ws.id)
    expect(terminal('w-d')?.workerReport).toEqual({ message: 'T0538 完成', reportedAt: 5 })
  })

  it('closing the reported Workers through closeTerminalNow keeps the unreported one', async () => {
    const { tower } = setup()
    workspaceStore.markWorkerReported({ targetId: tower.id, source: 'T0538', message: 'T0538 完成' })
    for (const w of reportedWorkersOfTower(workspaceStore.getState().terminals, tower.id)) {
      workspaceStore.closeTerminalNow(w.id, { cleanWorktree: false })
    }
    expect(kill).toHaveBeenCalledTimes(1)
    expect(kill).toHaveBeenCalledWith('w1')
    expect(terminal('w1')).toBeUndefined()
    expect(terminal('w2')).toBeDefined()
    await workspaceStore.save()
    expect(lastSaved().map(t => t.id)).toEqual(expect.arrayContaining([tower.id, 'w2']))
    expect(lastSaved().some(t => t.id === 'w1')).toBe(false)
  })
})
