/**
 * PLAN-047 W1 / T0583: a Worker dispatched with `--isolation worktree` keeps its worktree record
 * (`terminal:created-externally` `ctWorktree`) on the tab and saves it like T0537's
 * `towerTerminalId` / `workorder`, so `--close-worker --worktree` still finds it after BAT reopens.
 *
 * - addExternalTerminal writes it (only when present); the Agent panel's `worktreePath` is untouched
 * - save() → load() round trip; malformed data dropped; detached adopt keeps it
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const replay = vi.hoisted(() => ({ requestPtyReplay: vi.fn() }))
vi.mock('../../lib/pty-replay', () => replay)

import { workspaceStore } from '../workspace-store'

interface SavedTerminal { id: string; ctWorktree?: unknown; [key: string]: unknown }

const saves: Array<{ terminals: SavedTerminal[] }> = []
let loadData: string | null = null
let adoptResult: { terminals: unknown[] } | null = null

const WT = {
  path: '/w/.bat-worktrees/repo/T0583',
  branch: 'ct/T0583',
  base: 'a'.repeat(40),
  mainCheckout: '/w/repo',
  workorder: 'T0583',
}

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

describe('ctWorktree on the Worker tab (T0583)', () => {
  it('addExternalTerminal writes it; a Worker without isolation has none', () => {
    const ws = workspaceStore.addWorkspace('ws', '/w/repo')
    const tower = workspaceStore.addTerminal(ws.id)
    const worker = workspaceStore.addExternalTerminal({ id: 'worker-1', cwd: WT.path, workspaceId: ws.id, towerTerminalId: tower.id, workorder: 'T0583', ctWorktree: WT })
    expect(worker).toMatchObject({ cwd: WT.path, ctWorktree: WT })
    expect(worker).not.toHaveProperty('worktreePath')
    const plain = workspaceStore.addExternalTerminal({ id: 'worker-2', cwd: '/w/repo', workspaceId: ws.id, towerTerminalId: tower.id, workorder: 'T0584' })
    expect(plain).not.toHaveProperty('ctWorktree')
  })

  it('save() → load() round trip keeps it', async () => {
    const ws = workspaceStore.addWorkspace('ws', '/w/repo')
    const tower = workspaceStore.addTerminal(ws.id)
    workspaceStore.addExternalTerminal({ id: 'worker-1', cwd: WT.path, workspaceId: ws.id, towerTerminalId: tower.id, workorder: 'T0583', ctWorktree: WT })
    await workspaceStore.save()
    expect(lastSaved().find(t => t.id === 'worker-1')?.ctWorktree).toEqual(WT)

    loadData = JSON.stringify(saves[saves.length - 1])
    workspaceStore.getState().workspaces.slice().forEach(w => workspaceStore.removeWorkspace(w.id))
    await workspaceStore.load()
    expect(terminal('worker-1')).toMatchObject({ towerTerminalId: tower.id, workorder: 'T0583', ctWorktree: WT })
    expect(terminal(tower.id)).not.toHaveProperty('ctWorktree')
  })

  it('malformed saved values are dropped', async () => {
    loadData = JSON.stringify({
      workspaces: [{ id: 'ws', name: 'ws', folderPath: '/w/repo', createdAt: 1 }],
      activeWorkspaceId: 'ws',
      terminals: [
        { id: 'a', workspaceId: 'ws', type: 'terminal', title: 'A', cwd: '/w', towerTerminalId: 't', workorder: 'T1', ctWorktree: { ...WT, base: 42 } },
        { id: 'b', workspaceId: 'ws', type: 'terminal', title: 'B', cwd: '/w', towerTerminalId: 't', workorder: 'T2', ctWorktree: 'x' },
      ],
    })
    await workspaceStore.load()
    expect(terminal('a')).not.toHaveProperty('ctWorktree')
    expect(terminal('b')).not.toHaveProperty('ctWorktree')
  })

  it('a detached window\'s list adopted back keeps it', async () => {
    const ws = workspaceStore.addWorkspace('ws', '/w/repo')
    adoptResult = { terminals: [{ id: 'worker-d', workspaceId: ws.id, type: 'terminal', title: 'W', towerTerminalId: 'tower-d', workorder: 'T0583', ctWorktree: WT }] }
    expect(await workspaceStore.adoptDetachedWorkspaceTerminals(ws.id)).toEqual(['worker-d'])
    expect(terminal('worker-d')?.ctWorktree).toEqual(WT)
  })
})
