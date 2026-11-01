// @vitest-environment node
/**
 * T0759 / BUG-190: a background Agent (`run_in_background: true`, and the CLI 2.1.316 default)
 * gets its tool_result at launch. It stays in `activeTasks` / `running` (= the active task bar)
 * until its task_notification, which ends it with `[completed] …` / `[failed] …` / `[stopped] …`.
 * A foreground Agent keeps the CLAUDE.md rule: its tool_result ends it.
 *
 * Message sequences below are the ones SDK 0.3.316 / CLI 2.1.316 emitted against the T0727 fake
 * Anthropic API (T0759 report, 「查證」).
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => new Proxy({}, {
  get(_target, prop) {
    throw new Error(`claude-agent-manager must not touch electron: electron.${String(prop)}`)
  },
}))

import { ClaudeAgentManager } from '../claude-agent-manager'

type Internals = {
  processMessage(sessionId: string, session: unknown, message: unknown): void
  stopTask(sessionId: string, toolUseId: string): Promise<boolean>
}
type Call = { id: string; status?: string; description?: string; result?: string; isBackground?: boolean }

const managers: ClaudeAgentManager[] = []
afterEach(() => {
  for (const m of managers.splice(0)) { m.killAll(); m.dispose() }
})

const TOOL = 'toolu_t0727_1'
const TASK = 'aa365634e49ef6cee'
const LAUNCH = 'Async agent launched successfully.\nagentId: aa365634e49ef6cee'

function harness() {
  const emit = vi.fn()
  const manager = new ClaudeAgentManager({ emit, getSettings: () => ({ notifyOnComplete: false }) })
  managers.push(manager)
  const session = {
    cwd: process.cwd(),
    permissionMode: 'default',
    state: { isStreaming: true, totalCost: 0, totalTokens: 0, messages: [] as unknown[] },
    metadata: { totalCost: 0, inputTokens: 0, outputTokens: 0, durationMs: 0, numTurns: 0, contextWindow: 0, maxOutputTokens: 0, contextTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0, callCacheRead: 0, callCacheWrite: 0, lastQueryCalls: 0, lastCall: null },
    activeTasks: new Map<string, { toolUseId: string; background?: boolean }>(),
    pendingPermissions: new Map(),
    pendingAskUser: new Map(),
    messageQueue: [],
    abortController: new AbortController(),
    queryInstance: undefined as undefined | { stopTask: (id: string) => Promise<void> },
  }
  ;(manager as unknown as { sessions: Map<string, unknown> }).sessions.set('s1', session)
  const internals = manager as unknown as Internals
  const pm = (msg: unknown) => internals.processMessage('s1', session, msg)
  const agentUse = (input: Record<string, unknown>) => pm({
    type: 'assistant',
    parent_tool_use_id: null,
    message: { id: 'msg-1', model: 'claude-sonnet-4-6', role: 'assistant', content: [{ type: 'tool_use', id: TOOL, name: 'Agent', input: { description: 'T0759 bg probe', prompt: 'p', subagent_type: 'general-purpose', ...input } }] },
  })
  const taskStarted = (isBackgrounded: boolean) => pm({ type: 'system', subtype: 'task_started', task_id: TASK, tool_use_id: TOOL, description: 'T0759 bg probe', subagent_type: 'general-purpose', is_backgrounded: isBackgrounded, task_type: 'local_agent' })
  const toolResult = (text: string, toolUseResult?: Record<string, unknown>) => pm({
    type: 'user',
    parent_tool_use_id: null,
    message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: TOOL, content: [{ type: 'text', text }] }] },
    ...(toolUseResult ? { tool_use_result: toolUseResult } : {}),
  })
  const notification = (status: 'completed' | 'failed' | 'stopped', summary: string) => pm({ type: 'system', subtype: 'task_notification', task_id: TASK, tool_use_id: TOOL, status, output_file: 'x', summary })
  const result = () => pm({ type: 'result', subtype: 'success', num_turns: 2, result: 'launched', total_cost_usd: 0 })
  /** The tool call as the renderer sees it: every claude:tool-use / claude:tool-result merged. */
  const call = (): Call => {
    let c: Call = { id: TOOL }
    for (const [channel, , payload] of emit.mock.calls) {
      if ((channel === 'claude:tool-use' || channel === 'claude:tool-result') && (payload as Call).id === TOOL) c = { ...c, ...(payload as Call) }
    }
    return c
  }
  const entries = () => [...session.activeTasks.entries()].filter(([, t]) => t.toolUseId === TOOL)
  return { session, internals, agentUse, taskStarted, toolResult, notification, result, call, entries, pm }
}

describe('background Agent stays active until its task_notification (T0759 / BUG-190)', () => {
  it('run_in_background: true → running after the launch tool_result and the main result, completed with [completed] on the notification', () => {
    const h = harness()
    h.agentUse({ run_in_background: true })
    h.taskStarted(true)
    h.toolResult(LAUNCH, { status: 'async_launched', isAsync: true })
    h.result()
    expect(h.call().status).toBe('running')
    expect(h.call().isBackground).toBe(true)
    expect(h.call().result).toContain('Async agent launched')
    expect(h.entries()).toHaveLength(1)

    h.notification('completed', 'sub-agent finished')
    expect(h.call().status).toBe('completed')
    expect(h.call().description).toBe('[completed] sub-agent finished')
    expect(h.entries()).toHaveLength(0)
  })

  it('no run_in_background (CLI default = background): the CLI flag is enough', () => {
    const h = harness()
    h.agentUse({})
    h.taskStarted(true)
    h.toolResult(LAUNCH, { status: 'async_launched', isAsync: true })
    expect(h.call().status).toBe('running')
    h.notification('failed', 'boom')
    expect(h.call().status).toBe('error')
    expect(h.call().description).toBe('[failed] boom')
    expect(h.entries()).toHaveLength(0)
  })

  it('no task_started (older CLI): tool_use_result.status async_launched keeps it; the notification finds it by tool_use_id', () => {
    const h = harness()
    h.agentUse({ run_in_background: true })
    h.toolResult(LAUNCH, { status: 'async_launched', isAsync: true })
    expect(h.call().status).toBe('running')
    h.notification('stopped', 'T0759 bg probe')
    expect(h.call().status).toBe('completed')
    expect(h.call().description).toBe('[stopped] T0759 bg probe')
    expect(h.entries()).toHaveLength(0)
  })

  it('a foreground Agent moved to the background (task_updated is_backgrounded) is kept too', () => {
    const h = harness()
    h.agentUse({ run_in_background: false })
    h.taskStarted(false)
    h.pm({ type: 'system', subtype: 'task_updated', task_id: TASK, patch: { is_backgrounded: true } })
    h.toolResult('Agent is running in the background.')
    expect(h.call().status).toBe('running')
    expect(h.call().isBackground).toBe(true)
    h.notification('completed', 'done later')
    expect(h.call().description).toBe('[completed] done later')
    expect(h.entries()).toHaveLength(0)
  })

  it('an error tool_result still ends a background Agent', () => {
    const h = harness()
    h.agentUse({ run_in_background: true })
    h.taskStarted(true)
    h.pm({ type: 'user', parent_tool_use_id: null, message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: TOOL, is_error: true, content: 'launch failed' }] } })
    expect(h.call().status).toBe('error')
    expect(h.entries()).toHaveLength(0)
  })

  it('one entry per sub-agent: task_started re-keys the tool_use entry to the task_id', () => {
    const h = harness()
    h.agentUse({ run_in_background: true })
    expect([...h.session.activeTasks.keys()]).toEqual([TOOL])
    h.taskStarted(true)
    expect([...h.session.activeTasks.keys()]).toEqual([TASK])
  })
})

describe('foreground Agent is unchanged (CLAUDE.md "Sub-agent / Active Tasks Tracking")', () => {
  it('task_started (not backgrounded) → notification → tool_result: completed with the result, no entry left', () => {
    const h = harness()
    h.agentUse({ run_in_background: false })
    h.taskStarted(false)
    expect(h.call().status).toBe('running')
    expect(h.call().isBackground).toBeUndefined()
    h.notification('completed', 'sub-agent finished')
    h.toolResult('[Subagent hand-back] sub-agent finished', { status: 'completed' })
    expect(h.call().status).toBe('completed')
    expect(h.call().result).toContain('Subagent hand-back')
    expect(h.entries()).toHaveLength(0)
  })

  it('no task events at all: the tool_result ends it', () => {
    const h = harness()
    h.agentUse({ run_in_background: false })
    h.toolResult('done')
    expect(h.call().status).toBe('completed')
    expect(h.entries()).toHaveLength(0)
  })
})

describe('stopTask (T0759)', () => {
  it('sends the task_id from task_started, not the tool_use_id', async () => {
    const h = harness()
    const stopTask = vi.fn(async () => {})
    h.session.queryInstance = { stopTask }
    h.agentUse({ run_in_background: true })
    h.taskStarted(true)
    h.toolResult(LAUNCH, { status: 'async_launched' })
    await expect(h.internals.stopTask('s1', TOOL)).resolves.toBe(true)
    expect(stopTask).toHaveBeenCalledWith(TASK)
  })

  it('background: a stop that rejects after the task already ended does not overwrite the result', async () => {
    const h = harness()
    let reject!: (e: Error) => void
    h.session.queryInstance = { stopTask: () => new Promise<void>((_ok, no) => { reject = no }) }
    h.agentUse({ run_in_background: true })
    h.taskStarted(true)
    h.toolResult(LAUNCH, { status: 'async_launched' })
    h.result()
    const stopping = h.internals.stopTask('s1', TOOL)
    h.notification('completed', 'sub-agent finished')
    reject(new Error('Query closed before response received'))
    await expect(stopping).resolves.toBe(false)
    expect(h.call().status).toBe('completed')
    expect(h.call().description).toBe('[completed] sub-agent finished')
  })

  it('background: a stop that fails while it still runs keeps it running', async () => {
    const h = harness()
    h.session.queryInstance = { stopTask: async () => { throw new Error('no') } }
    h.agentUse({ run_in_background: true })
    h.taskStarted(true)
    h.toolResult(LAUNCH, { status: 'async_launched' })
    await expect(h.internals.stopTask('s1', TOOL)).resolves.toBe(false)
    expect(h.call().status).toBe('running')
    expect(h.call().description).toBe('[stop failed] T0759 bg probe')
    expect(h.entries()).toHaveLength(1)
  })
})
