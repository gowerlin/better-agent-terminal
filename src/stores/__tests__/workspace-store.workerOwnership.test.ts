/**
 * PLAN-041 / T0537: a Worker tab keeps its Tower id and work order (`terminal:created-externally`
 * `towerTerminalId` / `workorder`) and saves them with the tab, so main can still find the Worker
 * for `--close-worker` after BAT reopens (electron/worker-ownership.ts reads the saved tabs).
 *
 * - addExternalTerminal writes both fields (only those present)
 * - save() → load() round trip; data saved before T0537 loads exactly as before
 * - a detached window's list adopted back keeps them; ✕ (closeTerminalNow) drops them with the tab
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const replay = vi.hoisted(() => ({ requestPtyReplay: vi.fn() }))
vi.mock('../../lib/pty-replay', () => replay)

import { workspaceStore } from '../workspace-store'

interface SavedTerminal { id: string; towerTerminalId?: string; workorder?: string; [key: string]: unknown }

const saves: Array<{ terminals: SavedTerminal[] }> = []
let loadData: string | null = null
let adoptResult: { terminals: unknown[] } | null = null

beforeEach(() => {
  saves.length = 0
  loadData = null
  adoptResult = null
  ;(window as unknown as { electronAPI: unknown }).electronAPI = {
    debug: { log: vi.fn() },
    pty: { kill: vi.fn() },
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

const terminal = (id: string) => workspaceStore.getState().terminals.find(t => t.id === id)
const lastSaved = () => saves[saves.length - 1].terminals

describe('Worker ownership on the tab (T0537)', () => {
  it('addExternalTerminal writes towerTerminalId / workorder; a tab without them has neither', () => {
    const ws = workspaceStore.addWorkspace('ws', '/tmp/ws')
    const tower = workspaceStore.addTerminal(ws.id)
    const worker = workspaceStore.addExternalTerminal({ id: 'worker-1', cwd: '/tmp/ws', workspaceId: ws.id, towerTerminalId: tower.id, workorder: 'T0537' })
    expect(worker).toMatchObject({ id: 'worker-1', towerTerminalId: tower.id, workorder: 'T0537' })
    expect(terminal('worker-1')).toMatchObject({ towerTerminalId: tower.id, workorder: 'T0537' })

    const plain = workspaceStore.addExternalTerminal({ id: 'plain-1', cwd: '/tmp/ws', workspaceId: ws.id })
    expect(plain).not.toHaveProperty('towerTerminalId')
    expect(plain).not.toHaveProperty('workorder')
  })

  it('save() → load() round trip keeps both fields', async () => {
    const ws = workspaceStore.addWorkspace('ws', '/tmp/ws')
    const tower = workspaceStore.addTerminal(ws.id)
    workspaceStore.addExternalTerminal({ id: 'worker-1', cwd: '/tmp/ws', workspaceId: ws.id, towerTerminalId: tower.id, workorder: 'T0537' })
    await workspaceStore.save()
    expect(lastSaved().find(t => t.id === 'worker-1')).toMatchObject({ towerTerminalId: tower.id, workorder: 'T0537' })
    expect(lastSaved().find(t => t.id === tower.id)?.workorder).toBeUndefined()

    loadData = JSON.stringify(saves[saves.length - 1])
    workspaceStore.getState().workspaces.slice().forEach(w => workspaceStore.removeWorkspace(w.id))
    expect(terminal('worker-1')).toBeUndefined()
    await workspaceStore.load()
    expect(terminal('worker-1')).toMatchObject({ id: 'worker-1', workspaceId: ws.id, towerTerminalId: tower.id, workorder: 'T0537' })
    expect(terminal(tower.id)).not.toHaveProperty('workorder')

    // and saved again unchanged
    await workspaceStore.save()
    expect(lastSaved().find(t => t.id === 'worker-1')).toMatchObject({ towerTerminalId: tower.id, workorder: 'T0537' })
  })

  it('data saved before T0537 loads exactly as before (no new fields)', async () => {
    loadData = JSON.stringify({
      workspaces: [{ id: 'ws-old', name: 'old', folderPath: '/tmp/old', createdAt: 1 }],
      activeWorkspaceId: 'ws-old',
      terminals: [{ id: 'old-1', workspaceId: 'ws-old', type: 'terminal', title: 'Remote: claude', cwd: '/tmp/old' }],
      activeTerminalId: null,
    })
    await workspaceStore.load()
    expect(terminal('old-1')).toEqual({
      id: 'old-1',
      workspaceId: 'ws-old',
      type: 'terminal',
      agentPreset: undefined,
      title: 'Remote: claude',
      alias: undefined,
      cwd: '/tmp/old',
      sdkSessionId: undefined,
      model: undefined,
      agentParams: undefined,
      sessionMeta: undefined,
      scrollbackBuffer: [],
      pid: undefined,
    })
  })

  it('non-string values in saved data are dropped', async () => {
    loadData = JSON.stringify({
      workspaces: [{ id: 'ws', name: 'ws', folderPath: '/tmp/ws', createdAt: 1 }],
      activeWorkspaceId: 'ws',
      terminals: [{ id: 'w', workspaceId: 'ws', type: 'terminal', title: 'W', cwd: '/tmp/ws', towerTerminalId: 42, workorder: '' }],
    })
    await workspaceStore.load()
    expect(terminal('w')).not.toHaveProperty('towerTerminalId')
    expect(terminal('w')).not.toHaveProperty('workorder')
  })

  it('a detached window\'s list adopted back keeps them', async () => {
    const ws = workspaceStore.addWorkspace('ws', '/tmp/ws')
    adoptResult = { terminals: [{ id: 'worker-d', workspaceId: ws.id, type: 'terminal', title: 'Remote: claude', towerTerminalId: 'tower-d', workorder: 'T0538' }] }
    expect(await workspaceStore.adoptDetachedWorkspaceTerminals(ws.id)).toEqual(['worker-d'])
    expect(terminal('worker-d')).toMatchObject({ towerTerminalId: 'tower-d', workorder: 'T0538' })
  })

  it('✕ (closeTerminalNow) removes the tab and its ownership from the saved list', async () => {
    const ws = workspaceStore.addWorkspace('ws', '/tmp/ws')
    workspaceStore.addExternalTerminal({ id: 'worker-1', cwd: '/tmp/ws', workspaceId: ws.id, towerTerminalId: 'tower-1', workorder: 'T0537' })
    workspaceStore.closeTerminalNow('worker-1')
    await workspaceStore.save()
    expect(lastSaved().some(t => t.id === 'worker-1' || t.workorder === 'T0537')).toBe(false)
  })
})
