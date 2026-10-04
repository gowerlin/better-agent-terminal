// BUG-085 / T0377 — codex-cli launch command disables daemon auto-start when BAT is elevated.

import { describe, it, expect, afterEach } from 'vitest'

import { agentRegistry, CODEX_DISABLE_DAEMON_ARGS } from '../agent-runtime/agent-registry'

const DAEMON_FLAG = CODEX_DISABLE_DAEMON_ARGS.join(' ')

afterEach(() => {
  agentRegistry.setElevated(false)
})

describe('buildLaunchCommand — codex-cli elevation flag', () => {
  it('uses -c features.daemon_auto_start=false (not --no-daemon)', () => {
    expect(DAEMON_FLAG).toBe('-c features.daemon_auto_start=false')
  })

  it('defaults to not elevated', () => {
    expect(agentRegistry.isElevated()).toBe(false)
  })

  it('is unchanged when not elevated', () => {
    expect(agentRegistry.buildLaunchCommand('codex-cli')).toBe('codex')
  })

  it('injects the flag right after `codex` when elevated', () => {
    agentRegistry.setElevated(true)
    expect(agentRegistry.buildLaunchCommand('codex-cli')).toBe(`codex ${DAEMON_FLAG}`)
  })

  it('keeps the flag before launch options when elevated', () => {
    agentRegistry.setElevated(true)
    expect(agentRegistry.buildLaunchCommand('codex-cli', { 'approval-mode': 'full-auto' }))
      .toBe(`codex ${DAEMON_FLAG} --full-auto`)
  })

  it('does not append the user customArgs itself (callers do)', () => {
    agentRegistry.setElevated(true)
    expect(agentRegistry.buildLaunchCommand('codex-cli', undefined, '--yolo')).toBe(`codex ${DAEMON_FLAG}`)
  })

  it('skips injection when customArgs already contain --no-daemon', () => {
    agentRegistry.setElevated(true)
    expect(agentRegistry.buildLaunchCommand('codex-cli', undefined, '--yolo --no-daemon')).toBe('codex')
  })

  it('skips injection when customArgs already set daemon_auto_start', () => {
    agentRegistry.setElevated(true)
    expect(agentRegistry.buildLaunchCommand('codex-cli', undefined, '-c features.daemon_auto_start=false')).toBe('codex')
    expect(agentRegistry.buildLaunchCommand('codex-cli', undefined, '--disable daemon_auto_start')).toBe('codex')
  })

  it('never injects for codex-agent / codex-agent-worktree (SDK path)', () => {
    agentRegistry.setElevated(true)
    expect(agentRegistry.buildLaunchCommand('codex-agent')).toBeNull()
    expect(agentRegistry.buildLaunchCommand('codex-agent-worktree')).toBeNull()
  })

  it('never injects for other terminal-driven agents', () => {
    agentRegistry.setElevated(true)
    expect(agentRegistry.buildLaunchCommand('gemini-cli')).toBe('gemini')
    expect(agentRegistry.buildLaunchCommand('copilot-cli')).toBe('gh copilot')
  })
})
