/**
 * PLAN-050 / T0644: `TerminalInstance.launchRole` ("Open Claude as Tower").
 *
 * - addTerminal with `{ launchRole: 'tower' }` records it; without it the tab has no such field
 * - save → load keeps it (BAT reopen relaunches with `<ws> · Tower`); old data / other values stay without it
 * - detached adoption keeps it
 * - WorkspaceView (source guard): the session name follows `launchRole`, read from the store in
 *   startClaudeCliPty (new tab, restore, ⏻ restart); the entry only names — no set-role, nothing typed
 */
import * as fs from 'fs'
import * as path from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const replay = vi.hoisted(() => ({ requestPtyReplay: vi.fn() }))
vi.mock('../../lib/pty-replay', () => replay)

import { workspaceStore } from '../workspace-store'
import type { TerminalInstance } from '../../types'

interface SavedTerminal { id: string; launchRole?: string; [key: string]: unknown }

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

describe('launchRole (T0644)', () => {
  it('addTerminal records launchRole only when asked', () => {
    const ws = workspaceStore.addWorkspace('ws', '/tmp/ws')
    const tower = workspaceStore.addTerminal(ws.id, 'claude-cli', { launchRole: 'tower' })
    const plain = workspaceStore.addTerminal(ws.id, 'claude-cli')
    expect(tower.launchRole).toBe('tower')
    expect(tower.title).toBe('Claude CLI')
    expect(plain).not.toHaveProperty('launchRole')
  })

  it('save → load keeps it; old data and unknown values stay without it', async () => {
    const ws = workspaceStore.addWorkspace('ws', '/tmp/ws')
    const tower = workspaceStore.addTerminal(ws.id, 'claude-cli', { launchRole: 'tower' })
    const plain = workspaceStore.addTerminal(ws.id, 'claude-cli')
    await workspaceStore.save()
    expect(lastSaved().find(t => t.id === tower.id)?.launchRole).toBe('tower')
    expect(lastSaved().find(t => t.id === plain.id)?.launchRole).toBeUndefined()

    loadData = JSON.stringify({
      workspaces: workspaceStore.getState().workspaces,
      activeWorkspaceId: ws.id,
      terminals: [
        ...lastSaved(),
        { id: 'odd', workspaceId: ws.id, type: 'terminal', title: 'Claude CLI', agentPreset: 'claude-cli', launchRole: 'worker' },
      ],
    })
    workspaceStore.getState().terminals.slice().forEach(t => workspaceStore.removeTerminal(t.id))
    await workspaceStore.load()
    expect(terminal(tower.id)?.launchRole).toBe('tower')
    expect(terminal(plain.id)).not.toHaveProperty('launchRole')
    expect(terminal('odd')).not.toHaveProperty('launchRole')
  })

  it('detached adoption keeps it', async () => {
    const ws = workspaceStore.addWorkspace('d', '/tmp/d')
    const existing = workspaceStore.addTerminal(ws.id, 'claude-cli', { launchRole: 'tower' })
    adoptResult = { terminals: [
      { id: existing.id, workspaceId: ws.id, title: 'Claude CLI · Tower', agentPreset: 'claude-cli', launchRole: 'tower' },
      { id: 'new', workspaceId: ws.id, title: 'Claude CLI · Tower', agentPreset: 'claude-cli', launchRole: 'tower' },
    ] }
    await workspaceStore.adoptDetachedWorkspaceTerminals(ws.id)
    expect(terminal(existing.id)?.launchRole).toBe('tower')
    expect(terminal('new')?.launchRole).toBe('tower')
  })
})

describe('WorkspaceView "Open Claude as Tower" (T0644, source guard)', () => {
  const view = fs.readFileSync(path.resolve(__dirname, '../../components/WorkspaceView.tsx'), 'utf8')
  // the handler's code without its comments
  const handler = (/const handleAddClaudeCliAsTower = useCallback\(async \(\) => \{([\s\S]*?)\n {2}\}, \[/.exec(view)?.[1] ?? '')
    .split('\n').filter(line => !line.trim().startsWith('//')).join('\n')

  it('opens a claude-cli tab with launchRole tower, titled by setAutoTitle, through startClaudeCliPty', () => {
    expect(handler).toContain("workspaceStore.addTerminal(workspace.id, 'claude-cli' as AgentPresetId, { launchRole: 'tower' })")
    expect(handler).toContain("workspaceStore.setAutoTitle(terminal.id, towerTerminalTitle({ agentPreset: 'claude-cli' }))")
    expect(handler).toContain('await startClaudeCliPty(terminal.id, workspace.folderPath, false)')
  })

  it('only names the session: no role, nothing typed, no user rename', () => {
    expect(handler).not.toMatch(/setRole|set-role|applyTerminalRole|pty\.write|renameTerminal/)
  })

  it('startClaudeCliPty picks the name from the stored launchRole (new tab, restore, ⏻ restart)', () => {
    expect(view).toMatch(/const launchRole = workspaceStore\.getState\(\)\.terminals\.find\(t => t\.id === terminalId\)\?\.launchRole/)
    expect(view).toMatch(/launchRole === 'tower'\s*\n\s*\? claudeSessionName\(\{ role: 'tower', workspaceName: sessionWorkspaceNameRef\.current \}\)\s*\n\s*: claudeSessionName\(\{ role: 'tab', workspaceName: sessionWorkspaceNameRef\.current, terminalId \}\)/)
    expect(view).toContain('onAddClaudeCliAsTower={handleAddClaudeCliAsTower}')
  })
})
