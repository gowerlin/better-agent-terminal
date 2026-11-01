import { describe, expect, it } from 'vitest'
import { backgroundAgentResultLabel, isBackgroundAgentCall } from '../agent-task-label'

describe('isBackgroundAgentCall (T0759)', () => {
  it('main-process flag or run_in_background: true', () => {
    expect(isBackgroundAgentCall({ input: {}, isBackground: true })).toBe(true)
    expect(isBackgroundAgentCall({ input: { run_in_background: true } })).toBe(true)
    expect(isBackgroundAgentCall({ input: { run_in_background: false } })).toBe(false)
    expect(isBackgroundAgentCall({ input: {} })).toBe(false)
  })
})

describe('backgroundAgentResultLabel (T0759 / BUG-190)', () => {
  it('a finished background Agent shows its end label', () => {
    expect(backgroundAgentResultLabel({ isBackground: true, status: 'completed', description: '[completed] sub-agent finished' })).toBe('[completed] sub-agent finished')
    expect(backgroundAgentResultLabel({ isBackground: true, status: 'error', description: '[failed] boom' })).toBe('[failed] boom')
    expect(backgroundAgentResultLabel({ isBackground: true, status: 'completed', description: '[stopped] probe' })).toBe('[stopped] probe')
    expect(backgroundAgentResultLabel({ isBackground: true, status: 'completed', description: '[stopped by user] probe' })).toBe('[stopped by user] probe')
  })

  it('nothing while running, for a foreground Agent, or without an end label', () => {
    expect(backgroundAgentResultLabel({ isBackground: true, status: 'running', description: '[completed] x' })).toBeNull()
    expect(backgroundAgentResultLabel({ status: 'completed', description: '[completed] x' })).toBeNull()
    expect(backgroundAgentResultLabel({ isBackground: true, status: 'completed', description: 'T0759 bg probe' })).toBeNull()
    expect(backgroundAgentResultLabel({ isBackground: true, status: 'error', description: '[stop failed] x' })).toBeNull()
    expect(backgroundAgentResultLabel({ isBackground: true, status: 'completed' })).toBeNull()
  })
})
