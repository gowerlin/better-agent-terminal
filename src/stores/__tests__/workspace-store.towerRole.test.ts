/**
 * T0562 / D147: `terminal:role-changed` → `workspaceStore.applyTerminalRole`.
 *
 * - a tab whose title BAT generated becomes `<agent> · Tower` and is saved; save → load keeps it
 * - a name the user gave the tab (renameTerminal) is kept, nothing is saved
 * - an earlier Tower title is recomputed; the same title again changes nothing
 * - `autoTitle` (BAT's title the rules cannot recognize) round-trips through save → load and
 *   detached adoption; old data without it stays without it
 * - App.tsx routes the event through the same ownership check as `terminal:close-requested`
 */
import * as fs from 'fs'
import * as path from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const replay = vi.hoisted(() => ({ requestPtyReplay: vi.fn() }))
vi.mock('../../lib/pty-replay', () => replay)

import { workspaceStore } from '../workspace-store'
import type { TerminalInstance } from '../../types'

interface SavedTerminal { id: string; title?: string; autoTitle?: string; [key: string]: unknown }

const saves: Array<{ terminals: SavedTerminal[] }> = []
let loadData: string | null = null
let adoptResult: { terminals: Partial<TerminalInstance>[] } | null = null

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
  workspaceStore.getState().terminals.slice().forEach(t => workspaceStore.removeTerminal(t.id))
})

afterEach(() => {
  workspaceStore.stopAutoSave()
})

const terminal = (id: string) => workspaceStore.getState().terminals.find(t => t.id === id)
const lastSaved = () => saves[saves.length - 1].terminals
const TOWER = { role: 'tower' as const }

async function reload(wsId: string): Promise<void> {
  await workspaceStore.save()
  loadData = JSON.stringify({ workspaces: workspaceStore.getState().workspaces, activeWorkspaceId: wsId, terminals: lastSaved() })
  workspaceStore.getState().terminals.slice().forEach(t => workspaceStore.removeTerminal(t.id))
  await workspaceStore.load()
}

describe('applyTerminalRole (T0562)', () => {
  it('a BAT title becomes <agent> · Tower, saved, and still there after save → load', async () => {
    const ws = workspaceStore.addWorkspace('ws', '/tmp/ws')
    const tab = workspaceStore.addTerminal(ws.id, 'claude-cli')
    expect(tab.title).toBe('Claude CLI')
    expect(workspaceStore.applyTerminalRole({ id: tab.id, ...TOWER, agent: 'codex-cli' })).toEqual({ result: 'applied', title: 'Claude CLI · Tower' })
    expect(terminal(tab.id)?.title).toBe('Claude CLI · Tower')
    await Promise.resolve()
    await workspaceStore.save()
    expect(lastSaved().find(t => t.id === tab.id)?.title).toBe('Claude CLI · Tower')

    await reload(ws.id)
    expect(terminal(tab.id)?.title).toBe('Claude CLI · Tower')
  })

  it('a plain terminal (New Terminal) → the --agent hint, else Terminal · Tower', () => {
    const ws = workspaceStore.addWorkspace('ws', '/tmp/ws')
    const a = workspaceStore.addTerminal(ws.id)
    const b = workspaceStore.addTerminal(ws.id)
    expect(workspaceStore.applyTerminalRole({ id: a.id, ...TOWER, agent: 'claude-cli', agentName: 'Claude CLI' }).title).toBe('Claude CLI · Tower')
    expect(workspaceStore.applyTerminalRole({ id: b.id, ...TOWER }).title).toBe('Terminal · Tower')
  })

  it('the PTY agent comes before the hint; a custom CLI uses the registry name', () => {
    const ws = workspaceStore.addWorkspace('ws', '/tmp/ws')
    const a = workspaceStore.addTerminal(ws.id)
    expect(workspaceStore.applyTerminalRole({ id: a.id, ...TOWER, ptyAgent: 'codex-cli', agent: 'claude-cli' }).title).toBe('Codex CLI · Tower')
    // WorkspaceView.handleAddAgent titles a custom CLI tab with the registry name (setAutoTitle)
    const c = workspaceStore.addTerminal(ws.id, 'my-cli')
    expect(c.title).toBe('New Terminal')
    workspaceStore.setAutoTitle(c.id, 'My CLI')
    expect(workspaceStore.applyTerminalRole({ id: c.id, ...TOWER, ptyAgent: 'my-cli', ptyAgentName: 'My CLI' }).title).toBe('My CLI · Tower')
  })

  it('a name the user gave the tab is kept (nothing saved); an earlier Tower title is recomputed', async () => {
    const ws = workspaceStore.addWorkspace('ws', '/tmp/ws')
    const tab = workspaceStore.addTerminal(ws.id, 'claude-cli')
    workspaceStore.renameTerminal(tab.id, '我的塔台')
    await workspaceStore.save()
    const before = saves.length
    expect(workspaceStore.applyTerminalRole({ id: tab.id, ...TOWER })).toEqual({ result: 'kept', title: '我的塔台' })
    expect(terminal(tab.id)?.title).toBe('我的塔台')
    await Promise.resolve()
    expect(saves.length).toBe(before)

    // the user typed a preset name: still a BAT-looking title, so it may be replaced
    const other = workspaceStore.addTerminal(ws.id)
    workspaceStore.renameTerminal(other.id, 'Codex CLI')
    expect(workspaceStore.applyTerminalRole({ id: other.id, ...TOWER, ptyAgent: 'codex-cli' }).title).toBe('Codex CLI · Tower')

    const tower = workspaceStore.addTerminal(ws.id)
    workspaceStore.applyTerminalRole({ id: tower.id, ...TOWER })
    expect(terminal(tower.id)?.title).toBe('Terminal · Tower')
    expect(workspaceStore.applyTerminalRole({ id: tower.id, ...TOWER, agent: 'codex-cli' })).toEqual({ result: 'applied', title: 'Codex CLI · Tower' })
    expect(workspaceStore.applyTerminalRole({ id: tower.id, ...TOWER, agent: 'codex-cli' })).toEqual({ result: 'unchanged', title: 'Codex CLI · Tower' })
    // renamed after it became a Tower: kept from then on
    workspaceStore.renameTerminal(tower.id, 'CT')
    expect(workspaceStore.applyTerminalRole({ id: tower.id, ...TOWER }).result).toBe('kept')
  })

  it('a tab this window does not have → not-found', () => {
    expect(workspaceStore.applyTerminalRole({ id: 'nope', ...TOWER }).result).toBe('not-found')
  })

  it('helper-created tabs: Worker and command titles are BAT titles; a user rename of them is kept', () => {
    const ws = workspaceStore.addWorkspace('ws', '/tmp/ws')
    const base = { cwd: '/tmp/ws', workspaceId: ws.id }
    workspaceStore.addExternalTerminal({ ...base, id: 'w', command: 'claude x', agent: 'claude-cli', towerTerminalId: 't', workorder: 'T0551' })
    workspaceStore.addExternalTerminal({ ...base, id: 'n', command: '"C:\\Program Files\\nodejs\\node.exe" x.mjs' })
    workspaceStore.addExternalTerminal({ ...base, id: 'r', command: 'node x.mjs' })
    expect(terminal('n')).toMatchObject({ title: 'node', autoTitle: 'node' })
    workspaceStore.renameTerminal('r', 'node')
    expect(terminal('r')?.autoTitle).toBeUndefined()

    expect(workspaceStore.applyTerminalRole({ id: 'w', ...TOWER }).title).toBe('Terminal · Tower')
    expect(workspaceStore.applyTerminalRole({ id: 'n', ...TOWER, agent: 'claude-cli' }).title).toBe('Claude CLI · Tower')
    expect(workspaceStore.applyTerminalRole({ id: 'r', ...TOWER }).result).toBe('kept')
  })
})

describe('autoTitle persistence (T0562)', () => {
  it('save → load keeps autoTitle; data without it stays without it; a pre-T0553 title is recomputed as BAT\'s', async () => {
    const ws = workspaceStore.addWorkspace('ws', '/tmp/ws')
    workspaceStore.addExternalTerminal({ id: 'n', cwd: '/tmp/ws', workspaceId: ws.id, command: 'node x.mjs' })
    await workspaceStore.save()
    expect(lastSaved().find(t => t.id === 'n')).toMatchObject({ title: 'node', autoTitle: 'node' })

    loadData = JSON.stringify({ workspaces: workspaceStore.getState().workspaces, activeWorkspaceId: ws.id, terminals: [
      ...lastSaved(),
      { id: 'old', workspaceId: ws.id, type: 'terminal', title: 'node' },
      { id: 'legacy', workspaceId: ws.id, type: 'terminal', title: 'Remote: pwsh' },
    ] })
    workspaceStore.getState().terminals.slice().forEach(t => workspaceStore.removeTerminal(t.id))
    await workspaceStore.load()
    expect(terminal('n')).toMatchObject({ title: 'node', autoTitle: 'node' })
    expect(terminal('old')).not.toHaveProperty('autoTitle')
    expect(terminal('legacy')).toMatchObject({ title: 'pwsh', autoTitle: 'pwsh' })

    // old data (no autoTitle) with a command title: treated as the user's name — kept
    expect(workspaceStore.applyTerminalRole({ id: 'old', ...TOWER }).result).toBe('kept')
    expect(workspaceStore.applyTerminalRole({ id: 'legacy', ...TOWER }).title).toBe('Terminal · Tower')
  })

  it('detached: the Tower title and autoTitle the detached window saved are adopted', async () => {
    const ws = workspaceStore.addWorkspace('d', '/tmp/d')
    const tab = workspaceStore.addTerminal(ws.id)
    adoptResult = { terminals: [
      { id: tab.id, workspaceId: ws.id, title: 'Claude CLI · Tower' },
      { id: 'n', workspaceId: ws.id, title: 'node', autoTitle: 'node' },
    ] }
    await workspaceStore.adoptDetachedWorkspaceTerminals(ws.id)
    expect(terminal(tab.id)?.title).toBe('Claude CLI · Tower')
    expect(terminal('n')).toMatchObject({ title: 'node', autoTitle: 'node' })
  })
})

describe('App.tsx terminal:role-changed routing (T0562, source guard)', () => {
  const app = fs.readFileSync(path.resolve(__dirname, '../../App.tsx'), 'utf8')
  it('the window holding the tab applies it (same ownership check as close-requested)', () => {
    expect(app).toMatch(/onRoleChanged\(\(info\) => \{[\s\S]*?ownsTerminalForCloseRequest\(terminal, detachedWorkspaceId, detachedIds\)[\s\S]*?workspaceStore\.applyTerminalRole\(info\)/)
  })
  it('BAT-generated titles use setAutoTitle, not renameTerminal (a user rename)', () => {
    const view = fs.readFileSync(path.resolve(__dirname, '../../components/WorkspaceView.tsx'), 'utf8')
    const install = fs.readFileSync(path.resolve(__dirname, '../../hooks/useRemoteToolInstall.ts'), 'utf8')
    expect(view).toContain('workspaceStore.setAutoTitle(terminal.id, def.name)')
    expect(install).toContain('workspaceStore.setAutoTitle(terminal.id, translate(')
    expect(view).not.toContain('renameTerminal(')
    expect(install).not.toContain('renameTerminal(')
  })
})
