/**
 * PLAN-040 / T0529 (D142): effective default agent and launch args of a workspace.
 * The same module is imported by electron/terminal-command-handlers.ts (helper dispatch),
 * so renderer and main cannot disagree.
 */
import { describe, expect, it } from 'vitest'
import {
  appendAgentArgs,
  BUILTIN_DEFAULT_AGENT,
  hasWorkspaceArgsOverride,
  resolveEffectiveAgentArgs,
  resolveEffectiveDefaultAgent,
} from '../agent-launch-settings'

describe('resolveEffectiveDefaultAgent (D140 order)', () => {
  it('workspace → Settings → claude-code', () => {
    expect(resolveEffectiveDefaultAgent({ defaultAgent: 'codex-cli' }, { defaultAgent: 'gemini-cli' }))
      .toEqual({ agent: 'codex-cli', source: 'workspace' })
    expect(resolveEffectiveDefaultAgent({}, { defaultAgent: 'gemini-cli' }))
      .toEqual({ agent: 'gemini-cli', source: 'settings' })
    expect(resolveEffectiveDefaultAgent(undefined, {}))
      .toEqual({ agent: BUILTIN_DEFAULT_AGENT, source: 'builtin' })
    expect(BUILTIN_DEFAULT_AGENT).toBe('claude-code')
  })

  it('unset / empty / wrong-typed workspace value follows Settings', () => {
    for (const defaultAgent of [undefined, '', 42, null, ['codex-cli']]) {
      expect(resolveEffectiveDefaultAgent({ defaultAgent }, { defaultAgent: 'codex-cli' }))
        .toEqual({ agent: 'codex-cli', source: 'settings' })
    }
  })
})

describe('resolveEffectiveAgentArgs (D142: per preset, replace not concatenate)', () => {
  const settings = { agentCustomArgs: { 'codex-cli': '--yolo', 'claude-cli': '--dangerously-skip-permissions' } }

  it('no workspace key → global value', () => {
    expect(resolveEffectiveAgentArgs({ agentCustomArgs: { 'claude-cli': '--x' } }, settings, 'codex-cli'))
      .toEqual({ args: '--yolo', source: 'settings', presetId: 'codex-cli' })
    expect(resolveEffectiveAgentArgs(undefined, settings, 'codex-cli').args).toBe('--yolo')
  })

  it('workspace key replaces the global value as a whole', () => {
    expect(resolveEffectiveAgentArgs({ agentCustomArgs: { 'codex-cli': '  --model gpt-5 -c x=1  ' } }, settings, 'codex-cli'))
      .toEqual({ args: '--model gpt-5 -c x=1', source: 'workspace', presetId: 'codex-cli' })
  })

  it('empty workspace string = no args in this workspace', () => {
    expect(resolveEffectiveAgentArgs({ agentCustomArgs: { 'codex-cli': '' } }, settings, 'codex-cli'))
      .toEqual({ args: '', source: 'workspace', presetId: 'codex-cli' })
    expect(resolveEffectiveAgentArgs({ agentCustomArgs: { 'codex-cli': '   ' } }, settings, 'codex-cli').args).toBe('')
  })

  it('nothing anywhere → builtin, no args', () => {
    expect(resolveEffectiveAgentArgs({}, {}, 'gemini-cli')).toEqual({ args: '', source: 'builtin' })
    expect(resolveEffectiveAgentArgs(null, null, 'gemini-cli')).toEqual({ args: '', source: 'builtin' })
  })

  it('candidate ids: the workspace layer wins over the global layer for any candidate', () => {
    // helper dispatch: terminal-driven id first, then the id asked for
    expect(resolveEffectiveAgentArgs({ agentCustomArgs: { 'claude-code': '--model opus' } }, settings, ['claude-cli', 'claude-code']))
      .toEqual({ args: '--model opus', source: 'workspace', presetId: 'claude-code' })
    expect(resolveEffectiveAgentArgs({}, { agentCustomArgs: { 'claude-code': '--model opus' } }, ['claude-cli', 'claude-code']))
      .toEqual({ args: '--model opus', source: 'settings', presetId: 'claude-code' })
  })

  it('ignores malformed registry data', () => {
    expect(resolveEffectiveAgentArgs({ agentCustomArgs: { 'codex-cli': 42 } }, settings, 'codex-cli').source).toBe('settings')
    expect(resolveEffectiveAgentArgs({ agentCustomArgs: ['--x'] }, settings, 'codex-cli').source).toBe('settings')
    expect(resolveEffectiveAgentArgs({ agentCustomArgs: 'x' }, { agentCustomArgs: 'y' }, 'codex-cli').source).toBe('builtin')
    // inherited keys are not overrides
    expect(resolveEffectiveAgentArgs({ agentCustomArgs: {} }, settings, 'constructor').source).toBe('builtin')
  })

  it('hasWorkspaceArgsOverride / appendAgentArgs', () => {
    expect(hasWorkspaceArgsOverride({ agentCustomArgs: { 'codex-cli': '' } }, 'codex-cli')).toBe(true)
    expect(hasWorkspaceArgsOverride({ agentCustomArgs: { 'codex-cli': '' } }, 'claude-cli')).toBe(false)
    expect(hasWorkspaceArgsOverride(undefined, 'codex-cli')).toBe(false)
    expect(appendAgentArgs('codex', ' --yolo ')).toBe('codex --yolo')
    expect(appendAgentArgs('codex', '  ')).toBe('codex')
  })
})
