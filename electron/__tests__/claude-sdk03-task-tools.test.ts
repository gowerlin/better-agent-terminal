// @vitest-environment node
/**
 * T0718 (SDK 0.3, check ③): SDK sessions now get the task-tracking tools `TaskCreate` /
 * `TaskUpdate` / `TaskGet` / `TaskList` (0.3.142, instead of `TodoWrite`). Only the sub-agent
 * tools `Agent` / `Task` may be tracked in `session.activeTasks` (CLAUDE.md "Sub-agent / Active
 * Tasks Tracking"); the task-tracking tools are ordinary tool calls.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => new Proxy({}, {
  get(_target, prop) {
    throw new Error(`claude-agent-manager must not touch electron: electron.${String(prop)}`)
  },
}))

import { ClaudeAgentManager } from '../claude-agent-manager'

type Internals = { processMessage(sessionId: string, session: unknown, message: unknown): void }

const managers: ClaudeAgentManager[] = []
afterEach(() => {
  for (const m of managers.splice(0)) { m.killAll(); m.dispose() }
})

function harness() {
  const emit = vi.fn()
  const manager = new ClaudeAgentManager({ emit, getSettings: () => ({ notifyOnComplete: false }) })
  managers.push(manager)
  const session = {
    cwd: process.cwd(),
    permissionMode: 'default',
    state: { isStreaming: true, totalCost: 0, totalTokens: 0, messages: [] as unknown[] },
    metadata: { totalCost: 0, inputTokens: 0, outputTokens: 0, durationMs: 0, numTurns: 0, contextWindow: 0, maxOutputTokens: 0, contextTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0, callCacheRead: 0, callCacheWrite: 0, lastQueryCalls: 0, lastCall: null },
    activeTasks: new Map<string, unknown>(),
    pendingPermissions: new Map(),
    pendingAskUser: new Map(),
    messageQueue: [],
    abortController: new AbortController(),
  }
  ;(manager as unknown as { sessions: Map<string, unknown> }).sessions.set('s1', session)
  const pm = (msg: unknown) => (manager as unknown as Internals).processMessage('s1', session, msg)
  const toolUse = (id: string, name: string, input: Record<string, unknown> = {}) => pm({
    type: 'assistant',
    parent_tool_use_id: null,
    message: { id: `msg-${id}`, model: 'claude-opus-5-5', role: 'assistant', content: [{ type: 'tool_use', id, name, input }] },
  })
  const toolCalls = () => emit.mock.calls.filter(c => c[0] === 'claude:tool-use').map(c => c[2] as { id: string; toolName: string })
  return { session, toolUse, toolCalls }
}

describe('SDK 0.3 task-tracking tools are not sub-agents (T0718)', () => {
  it('TaskCreate / TaskUpdate / TaskGet / TaskList: tool cards, no activeTasks entry', () => {
    const h = harness()
    h.toolUse('toolu_c', 'TaskCreate', { subject: 'Write tests', description: 'd' })
    h.toolUse('toolu_u', 'TaskUpdate', { taskId: '1', status: 'in_progress' })
    h.toolUse('toolu_g', 'TaskGet', { taskId: '1' })
    h.toolUse('toolu_l', 'TaskList', {})
    expect(h.session.activeTasks.size).toBe(0)
    expect(h.toolCalls().map(t => t.toolName)).toEqual(['TaskCreate', 'TaskUpdate', 'TaskGet', 'TaskList'])
  })

  it('Agent and Task are still tracked', () => {
    const h = harness()
    h.toolUse('toolu_a', 'Agent', { description: 'explore', subagent_type: 'Explore' })
    h.toolUse('toolu_t', 'Task', { description: 'legacy name' })
    expect([...h.session.activeTasks.keys()]).toEqual(['toolu_a', 'toolu_t'])
  })
})
