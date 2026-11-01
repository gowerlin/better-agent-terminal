// @vitest-environment node
/**
 * T0725 / D195: the Claude panel (SDK spawn) turns on the CLI's task tools for Claude 5 models with
 * `CLAUDE_CODE_ENABLE_TODO_TOOLS=1`, for both runtimes, unless the environment already sets
 * `CLAUDE_CODE_ENABLE_TODO_TOOLS` or `CLAUDE_CODE_ENABLE_TASKS`. The update guard
 * (`DISABLE_UPDATES`, embedded only) is unchanged.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => new Proxy({}, {
  get(_target, prop) {
    throw new Error(`claude-agent-manager must not touch electron: electron.${String(prop)}`)
  },
}))

import { claudeTodoToolsEnv, sdkSpawnEnv } from '../claude-agent-manager'

const KEYS = ['CLAUDE_CODE_ENABLE_TODO_TOOLS', 'CLAUDE_CODE_ENABLE_TASKS', 'DISABLE_UPDATES'] as const
const saved: Record<string, string | undefined> = {}

beforeEach(() => {
  for (const k of KEYS) { saved[k] = process.env[k]; delete process.env[k] }
})
afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k]
    else process.env[k] = saved[k]
  }
})

describe('claudeTodoToolsEnv (T0725)', () => {
  it('adds CLAUDE_CODE_ENABLE_TODO_TOOLS=1 when neither variable is set', () => {
    expect(claudeTodoToolsEnv({})).toEqual({ CLAUDE_CODE_ENABLE_TODO_TOOLS: '1' })
  })

  it.each([
    ['CLAUDE_CODE_ENABLE_TODO_TOOLS', '0'],
    ['CLAUDE_CODE_ENABLE_TODO_TOOLS', 'false'],
    ['CLAUDE_CODE_ENABLE_TODO_TOOLS', '1'],
    ['CLAUDE_CODE_ENABLE_TODO_TOOLS', ''],
    ['CLAUDE_CODE_ENABLE_TASKS', 'false'],
    ['CLAUDE_CODE_ENABLE_TASKS', '1'],
  ])('respects an existing %s=%j (adds nothing)', (key, value) => {
    expect(claudeTodoToolsEnv({ [key]: value })).toEqual({})
  })
})

describe('sdkSpawnEnv (T0725)', () => {
  it('embedded: update guard + todo tools, on top of the inherited env', () => {
    process.env.T0725_PROBE = 'kept'
    try {
      const { env } = sdkSpawnEnv({ source: 'embedded' })
      expect(env).toMatchObject({ DISABLE_UPDATES: '1', CLAUDE_CODE_ENABLE_TODO_TOOLS: '1', T0725_PROBE: 'kept' })
    } finally {
      delete process.env.T0725_PROBE
    }
  })

  it('system: todo tools only, never DISABLE_UPDATES', () => {
    const { env } = sdkSpawnEnv({ source: 'system' })
    expect(env?.CLAUDE_CODE_ENABLE_TODO_TOOLS).toBe('1')
    expect(env).not.toHaveProperty('DISABLE_UPDATES')
  })

  it('does not overwrite a user value', () => {
    process.env.CLAUDE_CODE_ENABLE_TODO_TOOLS = '0'
    expect(sdkSpawnEnv({ source: 'embedded' }).env?.CLAUDE_CODE_ENABLE_TODO_TOOLS).toBe('0')
    expect(sdkSpawnEnv({ source: 'system' })).toEqual({})
  })

  it('CLAUDE_CODE_ENABLE_TASKS set: no todo flag added', () => {
    process.env.CLAUDE_CODE_ENABLE_TASKS = 'false'
    const { env } = sdkSpawnEnv({ source: 'embedded' })
    expect(env).not.toHaveProperty('CLAUDE_CODE_ENABLE_TODO_TOOLS')
    expect(env?.CLAUDE_CODE_ENABLE_TASKS).toBe('false')
  })

  it('does not write to process.env', () => {
    sdkSpawnEnv({ source: 'embedded' })
    expect(process.env.CLAUDE_CODE_ENABLE_TODO_TOOLS).toBeUndefined()
  })
})
