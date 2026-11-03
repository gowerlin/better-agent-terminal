// @vitest-environment node
/**
 * T0769 / BUG-192: a message sent while a background Agent keeps the query open (the turn already
 * has its `result`) goes into the same query with `Query.streamInput` — the query is not aborted,
 * no second query starts, the background Agent stays running. When the query's input has closed
 * (`streamInput` rejects at once), the message waits for the query to end and goes out with resume;
 * the renderer lists it and can cancel it (D214 P-1). A message sent while the turn itself runs
 * keeps the old interrupt-and-resend path (P-2). Message shapes: SDK 0.3.316 / CLI 2.1.316 against
 * the T0727 fake API (T0759 / T0768 reports).
 *
 * T0815 (PLAN-058 W0): these frames' `system/init` carries no `capabilities`, i.e. a CLI without
 * `command_lifecycle` receipts (`msg_lifecycle_v1`) — such a CLI keeps exactly these pre-T0815
 * paths. The receipt-tracked path (CLI 2.1.316) is `claude-send-during-turn.test.ts`.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => new Proxy({}, {
  get(_target, prop) {
    throw new Error(`claude-agent-manager must not touch electron: electron.${String(prop)}`)
  },
}))
vi.mock('../logger', () => ({ logger: { log: vi.fn(), error: vi.fn(), warn: vi.fn() } }))

const sdk = vi.hoisted(() => ({ query: vi.fn() }))
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: sdk.query,
  listSessions: vi.fn(),
  getSessionMessages: vi.fn(async () => []),
  getSubagentMessages: vi.fn(),
  listSubagents: vi.fn(),
}))

import { ClaudeAgentManager, buildUserContent } from '../claude-agent-manager'

const TOOL = 'toolu_t0769_bg'
const TASK = 'a0769bg'
const SDK_SESSION = '11111111-2222-3333-4444-555555555555'
const PNG = 'data:image/png;base64,iVBORw0KGgo='

type QueryArgs = { prompt: unknown; options: Record<string, unknown> }
type Session = {
  state: { isStreaming: boolean; messages: Array<{ id: string; status?: string; result?: string }> }
  abortController: AbortController
  activeTasks: Map<string, { toolUseId: string; background?: boolean }>
  messageQueue: Array<{ prompt: string; queuedId?: string }>
  pendingPermissions: Map<string, unknown>
  metadata: { modelUsage?: unknown }
  mainTurnDone?: boolean
}

/** A query whose messages the test pushes; the async iterator ends (or throws) on `end()`. */
function fakeQuery() {
  const queue: unknown[] = []
  let wake: (() => void) | null = null
  let ended = false
  let failure: Error | null = null
  async function* messages() {
    for (;;) {
      if (queue.length) { yield queue.shift(); continue }
      if (ended) { if (failure) throw failure; return }
      await new Promise<void>(resolve => { wake = resolve })
      wake = null
    }
  }
  const q = Object.assign(messages(), {
    streamInput: vi.fn(async (_stream: AsyncIterable<unknown>) => {}),
    interrupt: vi.fn(async () => {}),
    stopTask: vi.fn(async (_id: string) => {}),
    close: vi.fn(),
  })
  return {
    q,
    push: (...m: unknown[]) => { queue.push(...m); wake?.() },
    end: (err?: Error) => { ended = true; failure = err ?? null; wake?.() },
  }
}

const managers: ClaudeAgentManager[] = []
afterEach(() => {
  for (const m of managers.splice(0)) { m.killAll(); m.dispose() }
  sdk.query.mockReset()
})

const tick = async (n = 5) => { for (let i = 0; i < n; i++) await new Promise(r => setTimeout(r, 0)) }

async function harness(opts: { resume?: boolean } = {}) {
  const emit = vi.fn()
  const m = new ClaudeAgentManager({ emit, getSettings: () => ({ notifyOnComplete: false }) })
  ;(m as unknown as { resolveRuntimeForSession: () => Promise<unknown> }).resolveRuntimeForSession = async () => ({ source: 'embedded', path: 'C:\\demo\\claude.exe' })
  managers.push(m)
  const queries: Array<ReturnType<typeof fakeQuery>> = []
  const calls: QueryArgs[] = []
  sdk.query.mockImplementation((args: QueryArgs) => {
    calls.push(args)
    const fq = fakeQuery()
    queries.push(fq)
    return fq.q
  })
  await m.startSession('s1', { cwd: process.cwd(), ...(opts.resume ? { sdkSessionId: SDK_SESSION } : {}) })
  const session = (m as unknown as { sessions: Map<string, Session> }).sessions.get('s1')!
  const sent = (channel: string) => emit.mock.calls.filter(c => c[0] === channel).map(c => c[2])
  const call = () => {
    let c: { status?: string; description?: string; result?: string } = {}
    for (const [channel, , payload] of emit.mock.calls) {
      if ((channel === 'claude:tool-use' || channel === 'claude:tool-result') && (payload as { id: string }).id === TOOL) c = { ...c, ...(payload as object) }
    }
    return c
  }
  return { m, emit, session, queries, calls, sent, call }
}

const init = { type: 'system', subtype: 'init', session_id: SDK_SESSION, model: 'claude-sonnet-4-6', cwd: process.cwd(), permissionMode: 'default' }
const bgAgent = [
  { type: 'assistant', parent_tool_use_id: null, message: { id: 'msg-1', model: 'claude-sonnet-4-6', role: 'assistant', content: [{ type: 'tool_use', id: TOOL, name: 'Agent', input: { description: 'T0769 bg probe', prompt: 'p', subagent_type: 'general-purpose' } }] } },
  { type: 'system', subtype: 'task_started', task_id: TASK, tool_use_id: TOOL, description: 'T0769 bg probe', subagent_type: 'general-purpose', is_backgrounded: true, task_type: 'local_agent' },
  { type: 'user', parent_tool_use_id: null, message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: TOOL, content: [{ type: 'text', text: 'Async agent launched successfully.' }] }] }, tool_use_result: { status: 'async_launched', isAsync: true } },
]
const result = (cost = 0.01) => ({
  type: 'result', subtype: 'success', num_turns: 2, result: 'launched', total_cost_usd: cost,
  usage: { input_tokens: 10, output_tokens: 5 },
  modelUsage: { 'claude-sonnet-4-6': { inputTokens: 10, outputTokens: 5, cacheReadInputTokens: 0, cacheCreationInputTokens: 0, costUSD: cost } },
})
const notification = { type: 'system', subtype: 'task_notification', task_id: TASK, tool_use_id: TOOL, status: 'completed', output_file: 'x', summary: 'sub-agent finished' }

/** First message → main turn launches a background Agent → result; the query stays open. */
async function launchBackgroundAgent(h: Awaited<ReturnType<typeof harness>>) {
  void h.m.sendMessage('s1', 'start a background agent')
  await vi.waitFor(() => expect(h.queries).toHaveLength(1))
  h.queries[0].push(init, ...bgAgent, result())
  await tick()
  expect(h.session.mainTurnDone).toBe(true)
  expect(h.session.state.isStreaming).toBe(true)
  expect(h.call().status).toBe('running')
}

async function streamed(fq: ReturnType<typeof fakeQuery>, n = 0): Promise<unknown[]> {
  const out: unknown[] = []
  for await (const msg of fq.q.streamInput.mock.calls[n][0]) out.push(msg)
  return out
}

describe('message after the result while a background Agent keeps the query open (T0769 / BUG-192)', () => {
  it('goes into the same query: streamInput, no abort, no second query, the background Agent stays', async () => {
    const h = await harness()
    await launchBackgroundAgent(h)
    const permissions = h.session.pendingPermissions
    permissions.set('toolu_perm', { resolve: () => {} })

    await expect(h.m.sendMessage('s1', 'next')).resolves.toBe(true)

    const fq = h.queries[0]
    expect(fq.q.streamInput).toHaveBeenCalledTimes(1)
    expect(await streamed(fq)).toEqual([{ type: 'user', message: { role: 'user', content: 'next' }, parent_tool_use_id: null }])
    expect(h.session.abortController.signal.aborted).toBe(false)
    expect(h.calls).toHaveLength(1)
    expect(h.call().status).toBe('running')
    expect([...h.session.activeTasks.keys()]).toEqual([TASK])
    expect(h.session.pendingPermissions.has('toolu_perm')).toBe(true)
    expect(h.session.messageQueue).toEqual([])
    expect(h.sent('claude:message').some(m => (m as { role: string; content: string }).role === 'user' && (m as { content: string }).content === 'next')).toBe(true)
    expect(h.session.mainTurnDone).toBe(false)

    // the injected turn answers; then the background Agent finishes and the query ends normally
    fq.push({ type: 'assistant', parent_tool_use_id: null, message: { id: 'msg-2', model: 'claude-sonnet-4-6', role: 'assistant', content: [{ type: 'text', text: 'followup answer' }] } }, result(0.02))
    await tick()
    expect(h.session.mainTurnDone).toBe(true)
    fq.push(notification)
    await tick()
    expect(h.call().status).toBe('completed')
    expect(h.call().description).toBe('[completed] sub-agent finished')
    fq.end()
    await tick()
    expect(h.session.state.isStreaming).toBe(false)
    expect(h.calls).toHaveLength(1)
    expect(h.call().result).not.toBe('Agent terminated unexpectedly')
  })

  it('the injected turn gets its own Cache History row: per-query usage is reset on injection', async () => {
    const h = await harness()
    await launchBackgroundAgent(h)
    expect(h.session.metadata.modelUsage).toBeDefined()
    await h.m.sendMessage('s1', 'next')
    expect(h.session.metadata.modelUsage).toBeUndefined()
    h.queries[0].push(result(0.03))
    await tick()
    expect(h.session.metadata.modelUsage).toBeDefined()
  })

  it('images go as content blocks, the same builder as the first message', async () => {
    const h = await harness()
    await launchBackgroundAgent(h)
    await h.m.sendMessage('s1', 'look', [PNG])
    const [msg] = await streamed(h.queries[0]) as Array<{ message: { content: unknown } }>
    expect(msg.message.content).toEqual(buildUserContent('look', [PNG]))
    expect(msg.message.content).toEqual([
      { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'iVBORw0KGgo=' } },
      { type: 'text', text: 'look' },
    ])
  })

  it('a blank message is not sent (BUG-177) and does not abort', async () => {
    const h = await harness()
    await launchBackgroundAgent(h)
    await h.m.sendMessage('s1', '  ')
    expect(h.queries[0].q.streamInput).not.toHaveBeenCalled()
    expect(h.session.abortController.signal.aborted).toBe(false)
    expect(h.session.messageQueue).toEqual([])
  })
})

describe('input already closed: the message waits for the query to end (D214 P-1)', () => {
  it('streamInput rejects → listed as queued, sent with resume when the query ends, no "interrupted" prefix', async () => {
    const h = await harness()
    await launchBackgroundAgent(h)
    const fq = h.queries[0]
    fq.q.streamInput.mockRejectedValueOnce(new Error('ProcessTransport is not ready for writing'))
    await h.m.sendMessage('s1', 'next')
    await tick()
    expect(h.session.abortController.signal.aborted).toBe(false)
    expect(h.session.messageQueue.map(q => q.prompt)).toEqual(['next'])
    const listed = h.sent('claude:queued-messages')
    expect(listed).toHaveLength(1)
    expect(listed[0]).toEqual([expect.objectContaining({ id: expect.stringMatching(/^queued-/), content: 'next', messageId: expect.stringMatching(/^user-/) })])

    fq.push(notification)
    fq.end()
    await vi.waitFor(() => expect(h.calls).toHaveLength(2))
    expect(h.calls[1].prompt).toBe('next')
    expect(h.calls[1].options.resume).toBe(SDK_SESSION)
    expect(h.sent('claude:queued-messages').at(-1)).toEqual([])
  })

  it('cancel removes it: nothing is sent when the query ends; idle when no turn runs', async () => {
    const h = await harness()
    await launchBackgroundAgent(h)
    const fq = h.queries[0]
    fq.q.streamInput.mockRejectedValueOnce(new Error('ProcessTransport is not ready for writing'))
    await h.m.sendMessage('s1', 'next')
    await tick()
    const [[item]] = h.sent('claude:queued-messages') as Array<Array<{ id: string }>>
    await expect(h.m.cancelQueuedMessage('s1', item.id)).resolves.toEqual({ cancelled: true, idle: true })
    expect(h.sent('claude:queued-messages').at(-1)).toEqual([])
    await expect(h.m.cancelQueuedMessage('s1', item.id)).resolves.toEqual({ cancelled: false, idle: true })
    fq.end()
    await tick()
    expect(h.calls).toHaveLength(1)
  })

  it('rejects after the query already ended → sent at once with resume (not stuck in the queue)', async () => {
    const h = await harness()
    await launchBackgroundAgent(h)
    const fq = h.queries[0]
    let reject!: (e: Error) => void
    fq.q.streamInput.mockImplementationOnce(() => new Promise<void>((_ok, no) => { reject = no }))
    await h.m.sendMessage('s1', 'next')
    fq.end()
    await tick()
    expect(h.session.state.isStreaming).toBe(false)
    reject(new Error('Query closed'))
    await vi.waitFor(() => expect(h.calls).toHaveLength(2))
    expect(h.calls[1].prompt).toBe('next')
    expect(h.sent('claude:queued-messages')).toEqual([])
  })
})

describe('unchanged paths', () => {
  it('message while the turn itself runs (no result yet): interrupt and resend as before (P-2)', async () => {
    const h = await harness()
    void h.m.sendMessage('s1', 'first')
    await vi.waitFor(() => expect(h.queries).toHaveLength(1))
    h.queries[0].push(init)
    await tick()
    await h.m.sendMessage('s1', 'second')
    expect(h.queries[0].q.streamInput).not.toHaveBeenCalled()
    expect(h.session.abortController.signal.aborted).toBe(true)
    expect(h.session.messageQueue.map(q => q.prompt)).toEqual(['[使用者先前的訊息（已中斷）: "first"]\n\nsecond'])
    expect(h.sent('claude:queued-messages')).toEqual([])
  })

  it('result without a background Agent, query not ended yet: the old path, not streamInput (the SDK closes the input at that result)', async () => {
    const h = await harness()
    void h.m.sendMessage('s1', 'first')
    await vi.waitFor(() => expect(h.queries).toHaveLength(1))
    h.queries[0].push(init, result())
    await tick()
    expect(h.session.mainTurnDone).toBe(true)
    expect(h.session.state.isStreaming).toBe(true)
    await h.m.sendMessage('s1', 'second')
    expect(h.queries[0].q.streamInput).not.toHaveBeenCalled()
    expect(h.session.messageQueue).toHaveLength(1)
    h.queries[0].end()
    await vi.waitFor(() => expect(h.calls).toHaveLength(2))
  })

  it('no open query: a new query as before', async () => {
    const h = await harness()
    void h.m.sendMessage('s1', 'first')
    await vi.waitFor(() => expect(h.queries).toHaveLength(1))
    h.queries[0].push(init, result())
    h.queries[0].end()
    await tick()
    expect(h.session.state.isStreaming).toBe(false)
    void h.m.sendMessage('s1', 'second')
    await vi.waitFor(() => expect(h.calls).toHaveLength(2))
    expect(h.calls[1].prompt).toBe('second')
    expect(h.queries[0].q.streamInput).not.toHaveBeenCalled()
  })

  it('the query declares perTaskStopAffordance (Esc spares background Agents)', async () => {
    const h = await harness()
    void h.m.sendMessage('s1', 'first')
    await vi.waitFor(() => expect(h.calls).toHaveLength(1))
    expect(h.calls[0].options.perTaskStopAffordance).toBe(true)
  })
})

describe('stopSession (Esc) while a background Agent runs', () => {
  it('interrupts the turn but keeps the query streaming: the next message is injected, not a second query', async () => {
    const h = await harness()
    await launchBackgroundAgent(h)
    await h.m.sendMessage('s1', 'next')
    await h.m.stopSession('s1')
    expect(h.queries[0].q.interrupt).toHaveBeenCalledTimes(1)
    expect(h.session.state.isStreaming).toBe(true)
    expect(h.session.abortController.signal.aborted).toBe(false)
    h.queries[0].push({ type: 'result', subtype: 'error_during_execution', num_turns: 1, total_cost_usd: 0.02, errors: [] })
    await tick()
    await h.m.sendMessage('s1', 'again')
    expect(h.queries[0].q.streamInput).toHaveBeenCalledTimes(2)
    expect(h.calls).toHaveLength(1)
    expect(h.call().status).toBe('running')
  })

  it('without a background Agent: idle at once as before', async () => {
    const h = await harness()
    void h.m.sendMessage('s1', 'first')
    await vi.waitFor(() => expect(h.queries).toHaveLength(1))
    h.queries[0].push(init)
    await tick()
    await h.m.stopSession('s1')
    expect(h.queries[0].q.interrupt).toHaveBeenCalledTimes(1)
    expect(h.session.state.isStreaming).toBe(false)
  })
})

describe('resume retry guard (T0769, T0768 G0)', () => {
  it('"exited with code" after system/init does not restart the prompt fresh', async () => {
    const h = await harness({ resume: true })
    void h.m.sendMessage('s1', 'first')
    await vi.waitFor(() => expect(h.queries).toHaveLength(1))
    h.queries[0].push(init)
    await tick()
    h.queries[0].end(new Error('Claude Code process exited with code 1'))
    await tick()
    expect(h.calls).toHaveLength(1)
    expect(h.sent('claude:message').some(m => String((m as { content: string }).content).includes('Starting fresh'))).toBe(false)
    expect(h.sent('claude:error')).toHaveLength(1)
  })

  it('before system/init it still retries without resume (unchanged)', async () => {
    const h = await harness({ resume: true })
    void h.m.sendMessage('s1', 'first')
    await vi.waitFor(() => expect(h.queries).toHaveLength(1))
    h.queries[0].end(new Error('Claude Code process exited with code 1'))
    await vi.waitFor(() => expect(h.calls).toHaveLength(2))
    expect(h.calls[0].options.resume).toBe(SDK_SESSION)
    expect(h.calls[1].options.resume).toBeUndefined()
    expect(h.sent('claude:message').some(m => String((m as { content: string }).content).includes('Starting fresh'))).toBe(true)
  })
})
