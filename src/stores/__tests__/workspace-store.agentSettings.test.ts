/**
 * PLAN-040 / T0529: workspace default agent + launch args — set / clear / persist / restore,
 * and the effective values the UI consumers (dispatch buttons, new agent terminals) read.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../lib/pty-replay', () => ({ requestPtyReplay: vi.fn() }))

import { workspaceStore } from '../workspace-store'
import { settingsStore } from '../settings-store'

let saved: string | null = null

beforeEach(() => {
  ;(window as unknown as { electronAPI: unknown }).electronAPI = {
    debug: { log: vi.fn() },
    settings: { save: vi.fn(async () => true) },
    workspace: {
      save: vi.fn(async (data: string) => { saved = data; return true }),
      load: vi.fn(async () => saved),
      onReload: () => () => {},
      onReattached: () => () => {},
    },
  }
})

afterEach(() => {
  workspaceStore.stopAutoSave()
  saved = null
})

const flush = () => new Promise(r => setTimeout(r, 0))
const savedWorkspace = (id: string) => (JSON.parse(saved!).workspaces as Array<Record<string, unknown>>).find(w => w.id === id)

describe('workspace agent settings (T0529)', () => {
  it('sets and clears the default agent; every change is saved at once', async () => {
    const ws = workspaceStore.addWorkspace('agent', '/tmp/agent')
    workspaceStore.setWorkspaceDefaultAgent(ws.id, 'codex-cli')
    await flush()
    expect(savedWorkspace(ws.id)?.defaultAgent).toBe('codex-cli')

    workspaceStore.setWorkspaceDefaultAgent(ws.id, undefined)
    await flush()
    expect(savedWorkspace(ws.id)).not.toHaveProperty('defaultAgent')
  })

  it('per-preset args override: set (empty included) / clear', async () => {
    const ws = workspaceStore.addWorkspace('args', '/tmp/args')
    workspaceStore.setWorkspaceAgentCustomArg(ws.id, 'codex-cli', '--model gpt-5')
    workspaceStore.setWorkspaceAgentCustomArg(ws.id, 'claude-cli', '')
    await flush()
    expect(savedWorkspace(ws.id)?.agentCustomArgs).toEqual({ 'codex-cli': '--model gpt-5', 'claude-cli': '' })

    workspaceStore.setWorkspaceAgentCustomArg(ws.id, 'codex-cli', undefined)
    await flush()
    expect(savedWorkspace(ws.id)?.agentCustomArgs).toEqual({ 'claude-cli': '' })

    workspaceStore.setWorkspaceAgentCustomArg(ws.id, 'claude-cli', undefined)
    await flush()
    expect(savedWorkspace(ws.id)).not.toHaveProperty('agentCustomArgs')
  })

  it('restores both fields on load', async () => {
    const ws = workspaceStore.addWorkspace('restore', '/tmp/restore')
    workspaceStore.setWorkspaceDefaultAgent(ws.id, 'codex-cli')
    workspaceStore.setWorkspaceAgentCustomArg(ws.id, 'codex-cli', '-c model=o3')
    await flush()
    const persisted = saved!

    // wipe the in-memory values, then restore from what was persisted (app restart)
    workspaceStore.setWorkspaceDefaultAgent(ws.id, undefined)
    workspaceStore.setWorkspaceAgentCustomArg(ws.id, 'codex-cli', undefined)
    await flush()
    saved = persisted
    await workspaceStore.load()
    const restored = workspaceStore.getState().workspaces.find(w => w.id === ws.id)
    expect(restored?.defaultAgent).toBe('codex-cli')
    expect(restored?.agentCustomArgs).toEqual({ 'codex-cli': '-c model=o3' })
  })

  it('effective values read the latest state (UI consumers)', () => {
    settingsStore.setDefaultAgent('claude-code')
    settingsStore.setAgentCustomArg('codex-cli', '--yolo')
    settingsStore.setAgentCustomArg('claude-cli', '--dangerously-skip-permissions')
    const a = workspaceStore.addWorkspace('A', '/tmp/a')
    const b = workspaceStore.addWorkspace('B', '/tmp/b')
    workspaceStore.setWorkspaceDefaultAgent(a.id, 'codex-cli')
    workspaceStore.setWorkspaceAgentCustomArg(a.id, 'codex-cli', '--model gpt-5')

    expect(workspaceStore.getEffectiveDefaultAgent(a.id)).toEqual({ agent: 'codex-cli', source: 'workspace' })
    expect(workspaceStore.getEffectiveAgentArgs(a.id, 'codex-cli')).toBe('--model gpt-5')
    expect(workspaceStore.getEffectiveAgentArgs(a.id, 'claude-cli')).toBe('--dangerously-skip-permissions')

    // B follows the global settings
    expect(workspaceStore.getEffectiveDefaultAgent(b.id)).toEqual({ agent: 'claude-code', source: 'settings' })
    expect(workspaceStore.getEffectiveAgentArgs(b.id, 'codex-cli')).toBe('--yolo')

    // empty override = no args
    workspaceStore.setWorkspaceAgentCustomArg(b.id, 'claude-cli', '')
    expect(workspaceStore.getEffectiveAgentArgs(b.id, 'claude-cli')).toBe('')
  })
})
