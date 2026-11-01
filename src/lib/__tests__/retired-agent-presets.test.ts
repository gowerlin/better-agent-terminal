/**
 * T0718 / D123 Phase 2: the retired `claude-code-v2` preset in saved data reads as
 * `claude-code` — pure functions, the lookup in `agent-launch-settings`, and that the preset is
 * gone from every list BAT shows.
 */
import { describe, expect, it } from 'vitest'
import {
  RETIRED_AGENT_PRESETS,
  isRetiredAgentPreset,
  migrateAgentCustomArgs,
  migrateAgentPresetId,
  migrateRetiredPresetTitle,
  migrateSettingsAgentFields,
  migrateTerminalAgentPreset,
  migrateWorkspaceAgentFields,
} from '../retired-agent-presets'
import { hasWorkspaceArgsOverride, resolveEffectiveAgentArgs, resolveEffectiveDefaultAgent } from '../agent-launch-settings'
import { AGENT_PRESETS } from '../../types/agent-presets'
import { isClaudeSdk, isIntegrated } from '../../types/agent-runtime'
import { resolveControlTowerAgentRuntime } from '../../utils/control-tower-launch'

const V2 = 'claude-code-v2'

describe('retired presets (T0718)', () => {
  it('claude-code-v2 → claude-code; other ids and non-strings unchanged', () => {
    expect(RETIRED_AGENT_PRESETS).toEqual({ [V2]: 'claude-code' })
    expect(isRetiredAgentPreset(V2)).toBe(true)
    expect(migrateAgentPresetId(V2)).toBe('claude-code')
    for (const id of ['claude-code', 'claude-code-worktree', 'claude-cli', 'codex-cli', 'none', '', 'toString', '__proto__']) {
      expect(isRetiredAgentPreset(id), id).toBe(false)
      expect(migrateAgentPresetId(id), id).toBe(id)
    }
    expect(migrateAgentPresetId(undefined)).toBeUndefined()
    expect(migrateAgentPresetId(42)).toBe(42)
  })

  it('the preset is no longer offered anywhere', () => {
    expect(AGENT_PRESETS.map(p => p.id)).not.toContain(V2)
    expect(AGENT_PRESETS.map(p => p.name)).not.toContain('Claude Agent V2')
    expect(isClaudeSdk(V2)).toBe(false)
    expect(isIntegrated(V2)).toBe(false)
    // claude-code is untouched
    expect(isClaudeSdk('claude-code')).toBe(true)
    expect(AGENT_PRESETS.find(p => p.id === 'claude-code')?.name).toBe('Claude Agent V1')
    expect(resolveControlTowerAgentRuntime('claude-code')).toMatchObject({ command: 'claude', prefix: '/' })
  })

  it('a default tab title moves with the preset; a typed title stays', () => {
    expect(migrateRetiredPresetTitle('Claude Agent V2')).toBe('Claude Agent V1')
    expect(migrateRetiredPresetTitle('My V2 tab')).toBe('My V2 tab')
    expect(migrateRetiredPresetTitle(undefined)).toBeUndefined()
  })
})

describe('migrateAgentCustomArgs (T0718)', () => {
  it('moves the retired entry when claude-code has none', () => {
    expect(migrateAgentCustomArgs({ [V2]: '--verbose', 'codex-cli': '-m x' }, 'settings'))
      .toEqual({ 'claude-code': '--verbose', 'codex-cli': '-m x' })
    expect(migrateAgentCustomArgs({ [V2]: '--verbose' }, 'workspace')).toEqual({ 'claude-code': '--verbose' })
  })

  it('claude-code\'s own entry wins; the retired one is dropped', () => {
    expect(migrateAgentCustomArgs({ 'claude-code': '--a', [V2]: '--b' }, 'settings')).toEqual({ 'claude-code': '--a' })
    expect(migrateAgentCustomArgs({ 'claude-code': '--a', [V2]: '--b' }, 'workspace')).toEqual({ 'claude-code': '--a' })
  })

  it('workspace layer: an empty claude-code override is its own entry; an empty retired override moves', () => {
    expect(migrateAgentCustomArgs({ 'claude-code': '', [V2]: '--b' }, 'workspace')).toEqual({ 'claude-code': '' })
    expect(migrateAgentCustomArgs({ [V2]: '' }, 'workspace')).toEqual({ 'claude-code': '' })
  })

  it('settings layer: an empty entry is no entry', () => {
    expect(migrateAgentCustomArgs({ 'claude-code': '', [V2]: '--b' }, 'settings')).toEqual({ 'claude-code': '--b' })
    expect(migrateAgentCustomArgs({ [V2]: '  ' }, 'settings')).toEqual({})
  })

  it('non-string retired values are dropped, not moved', () => {
    expect(migrateAgentCustomArgs({ [V2]: 5 }, 'workspace')).toEqual({})
  })

  it('returns the same reference when there is nothing to migrate', () => {
    const record = { 'claude-code': '--a' }
    expect(migrateAgentCustomArgs(record, 'settings')).toBe(record)
    expect(migrateAgentCustomArgs(undefined, 'settings')).toBeUndefined()
    expect(migrateAgentCustomArgs(null, 'workspace')).toBeNull()
    const arr = ['x']
    expect(migrateAgentCustomArgs(arr, 'workspace')).toBe(arr)
  })

  it('does not mutate its input', () => {
    const record = { [V2]: '--b' }
    migrateAgentCustomArgs(record, 'settings')
    expect(record).toEqual({ [V2]: '--b' })
  })
})

describe('saved workspace / settings / tab (T0718)', () => {
  it('workspace: defaultAgent and agentCustomArgs; other fields kept, nothing added', () => {
    const ws = { id: 'w', name: 'n', folderPath: '/p', defaultAgent: V2, agentCustomArgs: { [V2]: '' } }
    expect(migrateWorkspaceAgentFields(ws)).toEqual({ id: 'w', name: 'n', folderPath: '/p', defaultAgent: 'claude-code', agentCustomArgs: { 'claude-code': '' } })
    const argsOnly = { id: 'w', agentCustomArgs: { [V2]: '--x' } }
    expect(migrateWorkspaceAgentFields(argsOnly)).toEqual({ id: 'w', agentCustomArgs: { 'claude-code': '--x' } })
    expect(Object.keys(migrateWorkspaceAgentFields(argsOnly))).not.toContain('defaultAgent')
    const clean = { id: 'w', defaultAgent: 'codex-cli' }
    expect(migrateWorkspaceAgentFields(clean)).toBe(clean)
  })

  it('settings: same fields, settings-layer args rule', () => {
    const settings = { theme: 'dark', defaultAgent: V2, agentCustomArgs: { 'claude-code': '', [V2]: '--v' } }
    expect(migrateSettingsAgentFields(settings)).toEqual({ theme: 'dark', defaultAgent: 'claude-code', agentCustomArgs: { 'claude-code': '--v' } })
    const clean = { defaultAgent: 'claude-cli' }
    expect(migrateSettingsAgentFields(clean)).toBe(clean)
  })

  it('tab: preset and its default title (title / autoTitle); typed title and other fields kept', () => {
    expect(migrateTerminalAgentPreset({ id: 't', agentPreset: V2, title: 'Claude Agent V2', sdkSessionId: 's', model: 'm' }))
      .toEqual({ id: 't', agentPreset: 'claude-code', title: 'Claude Agent V1', sdkSessionId: 's', model: 'm' })
    expect(migrateTerminalAgentPreset({ id: 't', agentPreset: V2, title: 'mine', alias: 'a', autoTitle: 'Claude Agent V2' }))
      .toEqual({ id: 't', agentPreset: 'claude-code', title: 'mine', alias: 'a', autoTitle: 'Claude Agent V1' })
    const other = { id: 'x', agentPreset: 'claude-code', title: 'Claude Agent V2' }
    expect(migrateTerminalAgentPreset(other)).toBe(other)
  })
})

describe('agent-launch-settings reads retired presets as their replacement (T0718)', () => {
  it('default agent: workspace and Settings layers', () => {
    expect(resolveEffectiveDefaultAgent({ defaultAgent: V2 }, { defaultAgent: 'codex-cli' })).toEqual({ agent: 'claude-code', source: 'workspace' })
    expect(resolveEffectiveDefaultAgent({}, { defaultAgent: V2 })).toEqual({ agent: 'claude-code', source: 'settings' })
    expect(resolveEffectiveDefaultAgent(null, null)).toEqual({ agent: 'claude-code', source: 'builtin' })
  })

  it('args: a retired key answers a lookup for the replacement, and a lookup for the retired id', () => {
    // helper dispatch looks up [terminal-driven id, requested id]
    expect(resolveEffectiveAgentArgs(null, { agentCustomArgs: { [V2]: '--v2' } }, ['claude-cli', 'claude-code']))
      .toEqual({ args: '--v2', source: 'settings', presetId: 'claude-code' })
    expect(resolveEffectiveAgentArgs({ agentCustomArgs: { [V2]: '' } }, { agentCustomArgs: { 'claude-code': '--g' } }, 'claude-code'))
      .toEqual({ args: '', source: 'workspace', presetId: 'claude-code' })
    expect(resolveEffectiveAgentArgs(null, { agentCustomArgs: { 'claude-code': '--own', [V2]: '--v2' } }, V2))
      .toEqual({ args: '--own', source: 'settings', presetId: 'claude-code' })
    expect(hasWorkspaceArgsOverride({ agentCustomArgs: { [V2]: '' } }, 'claude-code')).toBe(true)
    expect(hasWorkspaceArgsOverride({ agentCustomArgs: { [V2]: '' } }, V2)).toBe(true)
  })

  it('lookups without retired data are unchanged', () => {
    expect(resolveEffectiveAgentArgs({ agentCustomArgs: { 'claude-cli': '' } }, { agentCustomArgs: { 'claude-cli': '--g' } }, 'claude-cli'))
      .toEqual({ args: '', source: 'workspace', presetId: 'claude-cli' })
    expect(resolveEffectiveAgentArgs(null, { agentCustomArgs: { 'codex-cli': ' -m x ' } }, ['codex-cli', 'codex-agent']))
      .toEqual({ args: '-m x', source: 'settings', presetId: 'codex-cli' })
    expect(resolveEffectiveAgentArgs(null, null, 'claude-cli')).toEqual({ args: '', source: 'builtin' })
  })
})
