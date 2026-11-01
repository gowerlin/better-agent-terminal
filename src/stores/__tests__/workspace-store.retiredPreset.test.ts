/**
 * T0718 / D123 Phase 2: saved data that names the retired `claude-code-v2` preset loads as
 * `claude-code` — the window load (also what a detached window loads), adopting a detached
 * window's tabs, and Settings — and no tab is lost.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../lib/pty-replay', () => ({ requestPtyReplay: vi.fn() }))

import { workspaceStore } from '../workspace-store'
import { settingsStore } from '../settings-store'

const V2 = 'claude-code-v2'
let loaded: string | null = null
let saved: string | null = null
let settingsLoaded: string | null = null
let adoptResult: { terminals: unknown[] } | null = null

beforeEach(() => {
  ;(window as unknown as { electronAPI: unknown }).electronAPI = {
    debug: { log: vi.fn() },
    settings: { save: vi.fn(async () => true), load: vi.fn(async () => settingsLoaded) },
    workspace: {
      save: vi.fn(async (data: string) => { saved = data; return true }),
      load: vi.fn(async () => loaded),
      adoptDetached: vi.fn(async () => adoptResult),
      onReload: () => () => {},
      onReattached: () => () => {},
    },
  }
})

afterEach(() => {
  workspaceStore.stopAutoSave()
  workspaceStore.getState().workspaces.slice().forEach(w => workspaceStore.removeWorkspace(w.id))
  workspaceStore.getState().terminals.slice().forEach(t => workspaceStore.removeTerminal(t.id))
  loaded = saved = settingsLoaded = null
  adoptResult = null
})

const flush = () => new Promise(r => setTimeout(r, 0))

describe('workspace load with a retired preset (T0718)', () => {
  it('tabs, workspace default agent and args are migrated; every tab is kept; the next save writes claude-code', async () => {
    loaded = JSON.stringify({
      workspaces: [
        { id: 'w1', name: 'one', folderPath: '/tmp/one', createdAt: 1, defaultAgent: V2, agentCustomArgs: { [V2]: '--v2', 'codex-cli': '-m x' } },
        { id: 'w2', name: 'two', folderPath: '/tmp/two', createdAt: 2, agentCustomArgs: { 'claude-code': '--own', [V2]: '--v2' } },
      ],
      activeWorkspaceId: 'w1',
      terminals: [
        { id: 't1', workspaceId: 'w1', agentPreset: V2, title: 'Claude Agent V2', sdkSessionId: 'sdk-1', model: 'claude-opus-5-5' },
        { id: 't2', workspaceId: 'w1', agentPreset: V2, title: 'renamed', alias: 'renamed' },
        { id: 't3', workspaceId: 'w2', agentPreset: 'claude-code', title: 'Claude Agent V1' },
        { id: 't4', workspaceId: 'w2', agentPreset: 'claude-cli', title: 'Claude CLI' },
        { id: 't5', workspaceId: 'w2', agentPreset: 'claude-code-worktree', title: 'Claude Agent V1 (Worktree)', sdkSessionId: 'sdk-5' },
        { id: 't6', workspaceId: 'w2', agentPreset: 'claude-code', title: 'mine', autoTitle: 'Claude Agent V1', sdkSessionId: 'sdk-6', model: 'claude-opus-5-5' },
      ],
    })
    await workspaceStore.load()

    const state = workspaceStore.getState()
    expect(state.terminals.map(t => t.id)).toEqual(['t1', 't2', 't3', 't4', 't5', 't6'])
    const t = (id: string) => state.terminals.find(x => x.id === id)!
    expect(t('t1')).toMatchObject({ agentPreset: 'claude-code', title: 'Claude Agent', sdkSessionId: 'sdk-1', model: 'claude-opus-5-5' })
    expect(t('t2')).toMatchObject({ agentPreset: 'claude-code', title: 'renamed', alias: 'renamed' })
    // T0722: the pre-rename default titles move to the current names; typed titles stay
    expect(t('t3')).toMatchObject({ agentPreset: 'claude-code', title: 'Claude Agent' })
    expect(t('t4')).toMatchObject({ agentPreset: 'claude-cli', title: 'Claude CLI' })
    expect(t('t5')).toMatchObject({ agentPreset: 'claude-code-worktree', title: 'Claude Agent (Worktree)', sdkSessionId: 'sdk-5' })
    expect(t('t6')).toMatchObject({ agentPreset: 'claude-code', title: 'mine', autoTitle: 'Claude Agent', sdkSessionId: 'sdk-6', model: 'claude-opus-5-5' })

    const ws = (id: string) => state.workspaces.find(w => w.id === id)!
    expect(ws('w1')).toMatchObject({ defaultAgent: 'claude-code', agentCustomArgs: { 'claude-code': '--v2', 'codex-cli': '-m x' } })
    expect(ws('w2').agentCustomArgs).toEqual({ 'claude-code': '--own' })
    expect(workspaceStore.getEffectiveDefaultAgent('w1')).toEqual({ agent: 'claude-code', source: 'workspace' })

    await workspaceStore.save()
    await flush()
    expect(saved).not.toContain(V2)
    expect(saved).not.toContain('Claude Agent V2')
    expect(saved).not.toContain('Claude Agent V1')
  })

  it('a detached window\'s tabs adopted after it closes are migrated too', async () => {
    const ws = workspaceStore.addWorkspace('d', '/tmp/d')
    adoptResult = { terminals: [{ id: 'dv2', workspaceId: ws.id, agentPreset: V2, title: 'Claude Agent V2', sdkSessionId: 'sdk-d' }] }
    const ids = await workspaceStore.adoptDetachedWorkspaceTerminals(ws.id)
    expect(ids).toEqual(['dv2'])
    expect(workspaceStore.getState().terminals.find(x => x.id === 'dv2')).toMatchObject({ agentPreset: 'claude-code', title: 'Claude Agent', sdkSessionId: 'sdk-d' })
  })
})

describe('settings load with a retired preset (T0718)', () => {
  it('defaultAgent and agentCustomArgs read as claude-code; other settings kept', async () => {
    settingsLoaded = JSON.stringify({ defaultAgent: V2, agentCustomArgs: { [V2]: '--v2', 'claude-cli': '--c' }, fontSize: 15 })
    await settingsStore.load()
    const s = settingsStore.getSettings()
    expect(s.defaultAgent).toBe('claude-code')
    expect(s.agentCustomArgs).toEqual({ 'claude-code': '--v2', 'claude-cli': '--c' })
    expect(s.fontSize).toBe(15)
    expect(settingsStore.getAgentCustomArgs(V2)).toBe('')
  })

  it('claude-code\'s own Settings args win', async () => {
    settingsLoaded = JSON.stringify({ agentCustomArgs: { 'claude-code': '--own', [V2]: '--v2' } })
    await settingsStore.load()
    expect(settingsStore.getSettings().agentCustomArgs).toEqual({ 'claude-code': '--own' })
  })
})
