/**
 * T0553: the title of a tab `terminal:created-externally` adds (`addExternalTerminal`).
 *
 * - Worker: `<agent> · Worker · <workorder>`; other tabs: the agent or the command's file name;
 *   no `Remote:` prefix — a tab a remote server created is marked `remoteOrigin` instead
 * - a name the user gave the tab (renameTerminal) survives save → load
 * - a tab saved with the pre-T0553 `Remote: …` title gets the new title when it is restored
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const replay = vi.hoisted(() => ({ requestPtyReplay: vi.fn() }))
vi.mock('../../lib/pty-replay', () => replay)

import { workspaceStore } from '../workspace-store'

interface SavedTerminal { id: string; title?: string; remoteOrigin?: boolean; [key: string]: unknown }

const saves: Array<{ terminals: SavedTerminal[] }> = []
let loadData: string | null = null

beforeEach(() => {
  saves.length = 0
  loadData = null
  ;(window as unknown as { electronAPI: unknown }).electronAPI = {
    debug: { log: vi.fn() },
    pty: { kill: vi.fn() },
    claude: { stopSession: vi.fn() },
    workspace: {
      save: vi.fn(async (data: string) => { saves.push(JSON.parse(data)); return true }),
      load: vi.fn(async () => loadData),
      adoptDetached: vi.fn(async () => null),
    },
  }
  workspaceStore.getState().workspaces.slice().forEach(w => workspaceStore.removeWorkspace(w.id))
})

afterEach(() => {
  workspaceStore.stopAutoSave()
})

const terminal = (id: string) => workspaceStore.getState().terminals.find(t => t.id === id)
const lastSaved = () => saves[saves.length - 1].terminals
const CLAUDE_COMMAND = "'C:\\Users\\me\\.local\\bin\\claude.exe' '/ct-exec T0551'"

describe('helper-created tab titles (T0553)', () => {
  it('Worker tabs: <agent> · Worker · <workorder> (claude, codex, an agent the renderer does not know)', () => {
    const ws = workspaceStore.addWorkspace('ws', '/tmp/ws')
    const base = { cwd: '/tmp/ws', workspaceId: ws.id, towerTerminalId: 'tower-1' }
    expect(workspaceStore.addExternalTerminal({ ...base, id: 'w1', command: CLAUDE_COMMAND, agent: 'claude-cli', agentName: 'Claude CLI', workorder: 'T0551' })?.title)
      .toBe('Claude CLI · Worker · T0551')
    expect(workspaceStore.addExternalTerminal({ ...base, id: 'w2', command: "codex '$ct-exec T0552'", agent: 'codex-cli', workorder: 'T0552' })?.title)
      .toBe('Codex CLI · Worker · T0552')
    expect(workspaceStore.addExternalTerminal({ ...base, id: 'w3', command: 'node /x/w.mjs', agent: 'e2e-worker', agentName: 'E2E worker', workorder: 'T0553' })?.title)
      .toBe('E2E worker · Worker · T0553')
  })

  it('other tabs: the agent, the command file name, or Terminal — never "Remote:"', () => {
    const ws = workspaceStore.addWorkspace('ws', '/tmp/ws')
    const base = { cwd: '/tmp/ws', workspaceId: ws.id }
    expect(workspaceStore.addExternalTerminal({ ...base, id: 'a', command: 'claude "/ct-exec T0551"' })?.title).toBe('Claude CLI')
    expect(workspaceStore.addExternalTerminal({ ...base, id: 'b', command: '"C:\\Program Files\\nodejs\\node.exe" x.mjs' })?.title).toBe('node')
    expect(workspaceStore.addExternalTerminal({ ...base, id: 'c' })?.title).toBe('Terminal')
    for (const id of ['a', 'b', 'c']) expect(terminal(id)).not.toHaveProperty('remoteOrigin')
  })

  it('a tab a remote server created is marked remoteOrigin (saved and loaded), its title has no "Remote:"', async () => {
    const ws = workspaceStore.addWorkspace('ws', '/tmp/ws')
    const added = workspaceStore.addExternalTerminal({ id: 'r1', cwd: '/srv/ws', workspaceId: ws.id, command: 'claude', agent: 'claude-cli', towerTerminalId: 't', workorder: 'T0551', remote: true })
    expect(added).toMatchObject({ title: 'Claude CLI · Worker · T0551', remoteOrigin: true })
    await workspaceStore.save()
    expect(lastSaved().find(t => t.id === 'r1')).toMatchObject({ title: 'Claude CLI · Worker · T0551', remoteOrigin: true })

    loadData = JSON.stringify({ workspaces: workspaceStore.getState().workspaces, activeWorkspaceId: ws.id, terminals: lastSaved() })
    workspaceStore.removeTerminal('r1')
    await workspaceStore.load()
    expect(terminal('r1')).toMatchObject({ title: 'Claude CLI · Worker · T0551', remoteOrigin: true })
  })

  it('a name the user gave the tab is kept through save → load', async () => {
    const ws = workspaceStore.addWorkspace('ws', '/tmp/ws')
    workspaceStore.addExternalTerminal({ id: 'w1', cwd: '/tmp/ws', workspaceId: ws.id, command: CLAUDE_COMMAND, agent: 'claude-cli', towerTerminalId: 't', workorder: 'T0551' })
    workspaceStore.renameTerminal('w1', 'login fix')
    await workspaceStore.save()
    loadData = JSON.stringify({ workspaces: workspaceStore.getState().workspaces, activeWorkspaceId: ws.id, terminals: lastSaved() })
    workspaceStore.removeTerminal('w1')
    await workspaceStore.load()
    expect(terminal('w1')?.title).toBe('login fix')
  })

  it('tabs saved with the pre-T0553 "Remote: …" title get the new title when restored; other titles stay', async () => {
    loadData = JSON.stringify({
      workspaces: [{ id: 'ws-old', name: 'old', folderPath: '/tmp/old', createdAt: 1 }],
      activeWorkspaceId: 'ws-old',
      terminals: [
        { id: 'w', workspaceId: 'ws-old', type: 'terminal', title: "Remote: 'C:\\Users\\me\\.local\\bin\\claude.exe'", cwd: '/tmp/old', towerTerminalId: 't', workorder: 'T0538', workerReport: { message: 'T0538 完成', reportedAt: 5 } },
        { id: 'cut', workspaceId: 'ws-old', type: 'terminal', title: "Remote: 'C:\\Program", cwd: '/tmp/old', towerTerminalId: 't', workorder: 'T0539' },
        { id: 'raw', workspaceId: 'ws-old', type: 'terminal', title: 'Remote: node', cwd: '/tmp/old' },
        { id: 'none', workspaceId: 'ws-old', type: 'terminal', title: 'Remote Terminal', cwd: '/tmp/old' },
        { id: 'user', workspaceId: 'ws-old', type: 'terminal', title: 'Tower A', cwd: '/tmp/old' },
      ],
    })
    await workspaceStore.load()
    expect(terminal('w')).toMatchObject({ title: 'Claude CLI · Worker · T0538', workerReport: { message: 'T0538 完成', reportedAt: 5 } })
    expect(terminal('cut')?.title).toBe('Terminal · Worker · T0539')
    expect(terminal('raw')?.title).toBe('node')
    expect(terminal('none')?.title).toBe('Terminal')
    expect(terminal('user')?.title).toBe('Tower A')
    for (const id of ['w', 'cut', 'raw', 'none', 'user']) expect(terminal(id)).not.toHaveProperty('remoteOrigin')

    // saved in the new form
    await workspaceStore.save()
    expect(lastSaved().find(t => t.id === 'w')?.title).toBe('Claude CLI · Worker · T0538')
  })
})
