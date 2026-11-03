// @vitest-environment node
/**
 * T0815 (PLAN-058 W0, D259 — replaces D214 P-2): a message sent while a query runs goes into that
 * query with `Query.streamInput` and its own `uuid`; the CLI queues it after the current turn (or
 * folds it into the turn at a tool boundary) and reports `command_lifecycle` frames. Never an abort,
 * a second query, an "interrupted" prefix, or cleared permission / AskUserQuestion cards. No `queued`
 * receipt within INJECT_RECEIPT_TIMEOUT_MS, or a rejected write → the message waits for the query to
 * end and goes out with resume (never sent twice). Cancel → `Query.cancelAsyncMessage` (single
 * helper); Esc cancels every waiting message. `resetQueryUsage` runs when a sent message's own turn
 * starts. A `result` reports `pendingTurns` (sent messages that still need a turn).
 *
 * Frame shapes: SDK 0.3.316 / CLI 2.1.316 (T0813 probes; lifecycle states from the CLI's schema:
 * queued / started / completed / cancelled / discarded / refused). The pre-T0815 paths for a CLI
 * without receipts: claude-send-during-background-agent.test.ts.
 */
import * as fs from 'fs'
import * as path from 'path'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => new Proxy({}, {
  get(_target, prop) {
    throw new Error(`claude-agent-manager must not touch electron: electron.${String(prop)}`)
  },
}))
vi.mock('../logger', () => ({ logger: { log: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() } }))

const sdk = vi.hoisted(() => ({ query: vi.fn() }))
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: sdk.query,
  listSessions: vi.fn(),
  getSessionMessages: vi.fn(async () => []),
  getSubagentMessages: vi.fn(),
  listSubagents: vi.fn(),
}))

import {
  ClaudeAgentManager,
  INJECT_RECEIPT_TIMEOUT_MS,
  LIFECYCLE_CAPABILITY,
  cancelSdkQueuedMessage,
  parseCommandLifecycle,
} from '../claude-agent-manager'

const SDK_SESSION = '11111111-2222-3333-4444-555555555555'
const TOOL = 'toolu_t0815_bg'
const TASK = 'a0815bg'

type QueryArgs = { prompt: unknown; options: Record<string, unknown> }
type Session = {
  state: { isStreaming: boolean }
  abortController: AbortController
  activeTasks: Map<string, unknown>
  messageQueue: Array<{ prompt: string; queuedId?: string }>
  pendingSends: Map<string, { state: string; uuid: string }>
  pendingPermissions: Map<string, unknown>
  pendingAskUser: Map<string, unknown>
  metadata: { modelUsage?: unknown }
  callUsage?: object
  mainTurnDone?: boolean
  lifecycleReceipts?: boolean
}
type Streamed = { type: string; uuid?: string; message: { content: unknown }; parent_tool_use_id: null }

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
    interrupt: vi.fn(async (): Promise<{ still_queued: string[] } | undefined> => undefined),
    cancelAsyncMessage: vi.fn(async (_uuid: string) => true),
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
  vi.useRealTimers()
  for (const m of managers.splice(0)) { m.killAll(); m.dispose() }
  sdk.query.mockReset()
})

/** setImmediate is never faked here, so this works with fake setTimeout. */
const tick = async (n = 8) => { for (let i = 0; i < n; i++) await new Promise(r => setImmediate(r)) }

async function harness() {
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
  await m.startSession('s1', { cwd: process.cwd() })
  const session = (m as unknown as { sessions: Map<string, Session> }).sessions.get('s1')!
  const sent = (channel: string) => emit.mock.calls.filter(c => c[0] === channel).map(c => c[2])
  const listed = () => (sent('claude:queued-messages').at(-1) ?? []) as Array<{ id: string; content: string; waitsFor?: string; messageId?: string }>
  return { m, emit, session, queries, calls, sent, listed }
}

const init = (capabilities: string[] | null = ['interrupt_receipt_v1', LIFECYCLE_CAPABILITY]) => ({
  type: 'system', subtype: 'init', session_id: SDK_SESSION, model: 'claude-haiku-5-5', cwd: process.cwd(), permissionMode: 'default',
  ...(capabilities ? { capabilities } : {}),
})
const lifecycle = (uuid: string, state: string) => ({ type: 'system', subtype: 'command_lifecycle', command_uuid: uuid, state })
const result = (cost = 0.01) => ({
  type: 'result', subtype: 'success', num_turns: 1, result: 'ok', total_cost_usd: cost,
  usage: { input_tokens: 10, output_tokens: 5 },
  modelUsage: { 'claude-haiku-5-5': { inputTokens: 10, outputTokens: 5, cacheReadInputTokens: 0, cacheCreationInputTokens: 0, costUSD: cost } },
})
const answer = (text: string, id = `msg-${text}`) => ({ type: 'assistant', parent_tool_use_id: null, message: { id, model: 'claude-haiku-5-5', role: 'assistant', content: [{ type: 'text', text }] } })

async function streamed(fq: ReturnType<typeof fakeQuery>, n = 0): Promise<Streamed[]> {
  const out: Streamed[] = []
  for await (const msg of fq.q.streamInput.mock.calls[n][0]) out.push(msg as Streamed)
  return out
}

/** First message → its query runs (init seen, turn still going). */
async function firstTurn(h: Awaited<ReturnType<typeof harness>>, caps?: string[] | null) {
  void h.m.sendMessage('s1', 'first')
  await vi.waitFor(() => expect(h.queries).toHaveLength(1))
  h.queries[0].push(init(caps))
  await tick()
}

/** Send while the turn runs; returns the uuid the message carried. */
let lastStreamed: Streamed | undefined
async function sendDuringTurn(h: Awaited<ReturnType<typeof harness>>, text: string, n = 0): Promise<string> {
  await expect(h.m.sendMessage('s1', text)).resolves.toBe(true)
  await tick()
  const [msg] = await streamed(h.queries[0], n)
  lastStreamed = msg
  expect(msg.uuid).toMatch(/^[0-9a-f-]{36}$/)
  return msg.uuid!
}

describe('send during the main turn → into the same query (D259 ①)', () => {
  it('streamInput with a uuid; no abort, no second query, cards kept, no prefix; listed as waiting for the turn', async () => {
    const h = await harness()
    await firstTurn(h)
    h.session.pendingPermissions.set('toolu_perm', { resolve: () => {} })
    h.session.pendingAskUser.set('toolu_ask', { resolve: () => {} })
    const callUsage = h.session.callUsage

    const uuid = await sendDuringTurn(h, 'second')

    const msg = lastStreamed!
    expect(msg).toEqual({ type: 'user', message: { role: 'user', content: 'second' }, parent_tool_use_id: null, uuid })
    expect(h.queries[0].q.streamInput).toHaveBeenCalledTimes(1)
    expect(h.session.abortController.signal.aborted).toBe(false)
    expect(h.calls).toHaveLength(1)
    expect(h.session.pendingPermissions.has('toolu_perm')).toBe(true)
    expect(h.session.pendingAskUser.has('toolu_ask')).toBe(true)
    expect(h.session.messageQueue).toEqual([])
    expect(h.sent('claude:message').some(m => String((m as { content: string }).content).includes('已中斷'))).toBe(false)
    expect(h.listed()).toEqual([expect.objectContaining({ id: uuid, content: 'second', waitsFor: 'turn', messageId: expect.stringMatching(/^user-/) })])
    // 🔴 not reset at send: the running turn is still streaming
    expect(h.session.callUsage).toBe(callUsage)
  })

  it('queued → first result says 1 turn pending → started resets usage → its result ends it', async () => {
    const h = await harness()
    await firstTurn(h)
    const uuid = await sendDuringTurn(h, 'second')
    const fq = h.queries[0]
    fq.push(lifecycle(uuid, 'queued'), answer('alpha'), result(0.01))
    await tick()
    expect(h.sent('claude:result').at(-1)).toEqual(expect.objectContaining({ pendingTurns: 1 }))
    expect(h.session.mainTurnDone).toBe(true)
    expect(h.session.metadata.modelUsage).toBeDefined()
    expect(h.listed().map(q => q.id)).toEqual([uuid])

    const before = h.session.callUsage
    fq.push(lifecycle(uuid, 'started'))
    await tick()
    expect(h.session.callUsage).not.toBe(before) // its own Cache History row (T0744 / T0498)
    expect(h.session.metadata.modelUsage).toBeUndefined()
    expect(h.session.mainTurnDone).toBe(false)
    expect(h.listed()).toEqual([])

    fq.push(init(), answer('beta'), result(0.02), lifecycle(uuid, 'completed'))
    await tick()
    expect(h.sent('claude:result').at(-1)).toEqual(expect.objectContaining({ pendingTurns: 0 }))
    expect(h.session.pendingSends.size).toBe(0)
    fq.end()
    await tick()
    expect(h.calls).toHaveLength(1)
    expect(h.session.state.isStreaming).toBe(false)
  })

  it('init before `started` (the other frame order): the init does not reset, `started` does, once', async () => {
    const h = await harness()
    await firstTurn(h)
    const uuid = await sendDuringTurn(h, 'second')
    const fq = h.queries[0]
    fq.push(lifecycle(uuid, 'queued'), result())
    await tick()
    const before = h.session.callUsage
    fq.push(init())
    await tick()
    expect(h.session.callUsage).toBe(before)
    expect(h.session.metadata.modelUsage).toBeDefined()
    fq.push(lifecycle(uuid, 'started'))
    await tick()
    const afterStarted = h.session.callUsage
    expect(afterStarted).not.toBe(before)
    expect(h.session.metadata.modelUsage).toBeUndefined()
    fq.push(answer('beta'))
    await tick()
    expect(h.session.callUsage).toBe(afterStarted)
  })

  it('folded into the running turn (permission card answered): no reset, the same result answers both', async () => {
    const h = await harness()
    await firstTurn(h)
    const uuid = await sendDuringTurn(h, 'while the card waits')
    const fq = h.queries[0]
    const usage = h.session.callUsage
    fq.push(lifecycle(uuid, 'queued'), lifecycle(uuid, 'started'))
    await tick()
    expect(h.session.callUsage).toBe(usage) // shares the turn's row
    expect(h.listed()).toEqual([])
    fq.push(answer('both'), lifecycle(uuid, 'completed'), result())
    await tick()
    expect(h.sent('claude:result').at(-1)).toEqual(expect.objectContaining({ pendingTurns: 0 }))
  })

  it('a blank message is not sent (BUG-177) and does not abort', async () => {
    const h = await harness()
    await firstTurn(h)
    await h.m.sendMessage('s1', '   ')
    await tick()
    expect(h.queries[0].q.streamInput).not.toHaveBeenCalled()
    expect(h.session.abortController.signal.aborted).toBe(false)
    expect(h.listed()).toEqual([])
  })

  it('after the result while a background Agent runs (T0769) → the same tracked path', async () => {
    const h = await harness()
    await firstTurn(h)
    const fq = h.queries[0]
    fq.push(
      { type: 'assistant', parent_tool_use_id: null, message: { id: 'msg-bg', model: 'claude-haiku-5-5', role: 'assistant', content: [{ type: 'tool_use', id: TOOL, name: 'Agent', input: { description: 'bg', prompt: 'p', subagent_type: 'general-purpose' } }] } },
      { type: 'system', subtype: 'task_started', task_id: TASK, tool_use_id: TOOL, description: 'bg', is_backgrounded: true, task_type: 'local_agent' },
      result(),
    )
    await tick()
    expect(h.sent('claude:result').at(-1)).toEqual(expect.objectContaining({ pendingTurns: 0 }))
    const uuid = await sendDuringTurn(h, 'next')
    expect(h.session.abortController.signal.aborted).toBe(false)
    expect([...h.session.activeTasks.keys()]).toEqual([TASK])
    expect(h.session.pendingSends.get(uuid)?.state).toBe('sending')
  })
})

describe('no receipt / rejected write → waits for the query to end, never sent twice', () => {
  it(`no \`queued\` receipt in ${INJECT_RECEIPT_TIMEOUT_MS} ms → queued until the query ends, then sent with resume`, async () => {
    const h = await harness()
    await firstTurn(h)
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const uuid = await sendDuringTurn(h, 'second')
    vi.advanceTimersByTime(INJECT_RECEIPT_TIMEOUT_MS - 1)
    expect(h.session.messageQueue).toEqual([])
    vi.advanceTimersByTime(1)
    expect(h.session.messageQueue.map(q => q.queuedId)).toEqual([uuid])
    expect(h.listed()).toEqual([expect.objectContaining({ id: uuid, waitsFor: 'query' })])
    h.queries[0].push(result())
    await tick()
    expect(h.sent('claude:result').at(-1)).toEqual(expect.objectContaining({ pendingTurns: 1 }))
    h.queries[0].end()
    await tick()
    expect(h.calls).toHaveLength(2)
    expect(h.calls[1].prompt).toBe('second')
    expect(h.calls[1].options.resume).toBe(SDK_SESSION)
    expect(h.listed()).toEqual([])
  })

  it('a late receipt after the timeout drops the queued copy: nothing sent when the query ends', async () => {
    const h = await harness()
    await firstTurn(h)
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const uuid = await sendDuringTurn(h, 'second')
    vi.advanceTimersByTime(INJECT_RECEIPT_TIMEOUT_MS)
    expect(h.session.messageQueue).toHaveLength(1)
    h.queries[0].push(lifecycle(uuid, 'queued'))
    await tick()
    expect(h.session.messageQueue).toEqual([])
    expect(h.listed()).toEqual([expect.objectContaining({ id: uuid, waitsFor: 'turn' })])
    h.queries[0].push(result(), lifecycle(uuid, 'started'), result(), lifecycle(uuid, 'completed'))
    h.queries[0].end()
    await tick()
    expect(h.calls).toHaveLength(1)
  })

  it('a receipt in time: the timer never queues it', async () => {
    const h = await harness()
    await firstTurn(h)
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const uuid = await sendDuringTurn(h, 'second')
    h.queries[0].push(lifecycle(uuid, 'queued'))
    await tick()
    vi.advanceTimersByTime(INJECT_RECEIPT_TIMEOUT_MS * 3)
    expect(h.session.messageQueue).toEqual([])
    expect(h.session.pendingSends.get(uuid)?.state).toBe('queued')
  })

  it('a rejected write → queued until the query ends (and the timer does not queue it again)', async () => {
    const h = await harness()
    await firstTurn(h)
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    h.queries[0].q.streamInput.mockRejectedValueOnce(new Error('ProcessTransport is not ready for writing'))
    await h.m.sendMessage('s1', 'second')
    await tick()
    expect(h.session.messageQueue.map(q => q.prompt)).toEqual(['second'])
    vi.advanceTimersByTime(INJECT_RECEIPT_TIMEOUT_MS * 2)
    expect(h.session.messageQueue).toHaveLength(1)
    h.queries[0].end()
    await tick()
    expect(h.calls).toHaveLength(2)
    expect(h.calls[1].prompt).toBe('second')
  })

  it('rejected after the query already ended → sent at once with resume', async () => {
    const h = await harness()
    await firstTurn(h)
    let reject!: (e: Error) => void
    h.queries[0].q.streamInput.mockImplementationOnce(() => new Promise<void>((_ok, no) => { reject = no }))
    await h.m.sendMessage('s1', 'second')
    h.queries[0].push(result())
    h.queries[0].end()
    await tick()
    // the query's end took the never-started message and sent it with resume
    expect(h.calls).toHaveLength(2)
    expect(h.calls[1].prompt).toBe('second')
    reject(new Error('Query closed'))
    await tick()
    expect(h.calls).toHaveLength(2) // not twice
  })

  it('`refused` before it started → queued until the query ends', async () => {
    const h = await harness()
    await firstTurn(h)
    const uuid = await sendDuringTurn(h, 'second')
    h.queries[0].push(lifecycle(uuid, 'refused'))
    await tick()
    expect(h.session.messageQueue.map(q => q.queuedId)).toEqual([uuid])
    h.queries[0].end()
    await tick()
    expect(h.calls).toHaveLength(2)
  })

  it('queued but the query ended before it started (CLI exited) → sent with resume, once', async () => {
    const h = await harness()
    await firstTurn(h)
    const uuid = await sendDuringTurn(h, 'second')
    h.queries[0].push(lifecycle(uuid, 'queued'), result())
    h.queries[0].end()
    await tick()
    expect(h.calls).toHaveLength(2)
    expect(h.calls[1].prompt).toBe('second')
    expect(h.session.pendingSends.size).toBe(0)
  })

  it('a message sent while the query is still being created waits for it to end (no abort)', async () => {
    const h = await harness()
    let release!: () => void
    const gate = new Promise<void>(r => { release = r })
    ;(h.m as unknown as { resolveRuntimeForSession: () => Promise<unknown> }).resolveRuntimeForSession = async () => { await gate; return { source: 'embedded', path: 'C:\\demo\\claude.exe' } }
    void h.m.sendMessage('s1', 'first')
    await tick()
    expect(h.session.state.isStreaming).toBe(true)
    await h.m.sendMessage('s1', 'second')
    expect(h.session.abortController.signal.aborted).toBe(false)
    expect(h.session.messageQueue.map(q => q.prompt)).toEqual(['second'])
    expect(h.listed()).toEqual([expect.objectContaining({ content: 'second', waitsFor: 'query' })])
    release()
    await vi.waitFor(() => expect(h.queries).toHaveLength(1))
    h.queries[0].push(init(), result())
    h.queries[0].end()
    await vi.waitFor(() => expect(h.calls).toHaveLength(2))
    expect(h.calls[1].prompt).toBe('second')
  })
})

describe('receipts known only from the init capability', () => {
  it('sent before the first init: the timer starts at the init that advertises receipts', async () => {
    const h = await harness()
    void h.m.sendMessage('s1', 'first')
    await vi.waitFor(() => expect(h.queries).toHaveLength(1))
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const uuid = await sendDuringTurn(h, 'second')
    vi.advanceTimersByTime(INJECT_RECEIPT_TIMEOUT_MS * 5)
    expect(h.session.messageQueue).toEqual([]) // no timer yet
    h.queries[0].push(init())
    await tick()
    vi.advanceTimersByTime(INJECT_RECEIPT_TIMEOUT_MS)
    expect(h.session.messageQueue.map(q => q.queuedId)).toEqual([uuid])
  })

  it('an init without the capability: the message counts as delivered (no fallback), and later sends use the old paths', async () => {
    const h = await harness()
    void h.m.sendMessage('s1', 'first')
    await vi.waitFor(() => expect(h.queries).toHaveLength(1))
    await sendDuringTurn(h, 'second')
    h.queries[0].push(init(null))
    await tick()
    expect(h.session.lifecycleReceipts).toBe(false)
    expect(h.session.pendingSends.size).toBe(0)
    expect(h.listed()).toEqual([])
    await h.m.sendMessage('s1', 'third') // pre-T0815 interrupt-and-resend (D214 P-2) for such a CLI
    expect(h.session.abortController.signal.aborted).toBe(true)
    expect(h.queries[0].q.streamInput).toHaveBeenCalledTimes(1)
  })
})

describe('cancel a waiting message (D259 ②)', () => {
  it('queued in the CLI → cancelAsyncMessage(uuid) → cancelled, gone from the list', async () => {
    const h = await harness()
    await firstTurn(h)
    const uuid = await sendDuringTurn(h, 'second')
    h.queries[0].push(lifecycle(uuid, 'queued'))
    await tick()
    await expect(h.m.cancelQueuedMessage('s1', uuid)).resolves.toEqual({ cancelled: true, idle: false })
    expect(h.queries[0].q.cancelAsyncMessage).toHaveBeenCalledWith(uuid)
    expect(h.listed()).toEqual([])
    h.queries[0].push(lifecycle(uuid, 'cancelled'), result())
    await tick()
    expect(h.sent('claude:result').at(-1)).toEqual(expect.objectContaining({ pendingTurns: 0 }))
  })

  it('idle once the turn has its result and nothing else waits', async () => {
    const h = await harness()
    await firstTurn(h)
    const uuid = await sendDuringTurn(h, 'second')
    h.queries[0].push(lifecycle(uuid, 'queued'), result())
    await tick()
    await expect(h.m.cancelQueuedMessage('s1', uuid)).resolves.toEqual({ cancelled: true, idle: true })
  })

  it('already started (the CLI no longer has it) → cancelled: false, gone from the list', async () => {
    const h = await harness()
    await firstTurn(h)
    const uuid = await sendDuringTurn(h, 'second')
    h.queries[0].push(lifecycle(uuid, 'queued'))
    await tick()
    h.queries[0].q.cancelAsyncMessage.mockResolvedValueOnce(false)
    await expect(h.m.cancelQueuedMessage('s1', uuid)).resolves.toEqual({ cancelled: false, idle: false })
    expect(h.listed()).toEqual([])
  })

  it('before its receipt → cancelled; a late `queued` receipt cancels it again; the timer never queues it', async () => {
    const h = await harness()
    await firstTurn(h)
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const uuid = await sendDuringTurn(h, 'second')
    h.queries[0].q.cancelAsyncMessage.mockResolvedValueOnce(false)
    await expect(h.m.cancelQueuedMessage('s1', uuid)).resolves.toEqual({ cancelled: true, idle: false })
    expect(h.listed()).toEqual([])
    h.queries[0].push(lifecycle(uuid, 'queued'))
    await tick()
    expect(h.queries[0].q.cancelAsyncMessage).toHaveBeenCalledTimes(2)
    vi.advanceTimersByTime(INJECT_RECEIPT_TIMEOUT_MS * 2)
    expect(h.session.messageQueue).toEqual([])
    h.queries[0].push(result())
    h.queries[0].end()
    await tick()
    expect(h.calls).toHaveLength(1)
  })

  it('a copy waiting for the query to end is removed without a CLI call', async () => {
    const h = await harness()
    await firstTurn(h)
    h.queries[0].q.streamInput.mockRejectedValueOnce(new Error('ProcessTransport is not ready for writing'))
    await h.m.sendMessage('s1', 'second')
    await tick()
    const [item] = h.listed()
    await expect(h.m.cancelQueuedMessage('s1', item.id)).resolves.toEqual({ cancelled: true, idle: false })
    expect(h.queries[0].q.cancelAsyncMessage).not.toHaveBeenCalled()
    h.queries[0].end()
    await tick()
    expect(h.calls).toHaveLength(1)
  })
})

describe('Esc (stopSession) cancels every waiting message (D259 ③)', () => {
  it('cancels each in the CLI before the interrupt, empties the list; the next message works', async () => {
    const h = await harness()
    await firstTurn(h)
    const a = await sendDuringTurn(h, 'second', 0)
    const b = await sendDuringTurn(h, 'third', 1)
    const fq = h.queries[0]
    fq.push(lifecycle(a, 'queued'), lifecycle(b, 'queued'))
    await tick()
    fq.q.interrupt.mockResolvedValueOnce({ still_queued: [b] })
    await h.m.stopSession('s1')
    await tick()
    const cancels = fq.q.cancelAsyncMessage.mock.calls.map(c => c[0])
    expect(cancels.slice(0, 2).sort()).toEqual([a, b].sort())
    expect(cancels.filter(u => u === b)).toHaveLength(2) // once more for the still_queued one
    const firstCancel = Math.min(...fq.q.cancelAsyncMessage.mock.invocationCallOrder)
    expect(firstCancel).toBeLessThan(fq.q.interrupt.mock.invocationCallOrder[0])
    expect(h.listed()).toEqual([])
    expect(h.session.messageQueue).toEqual([])
    fq.push({ type: 'result', subtype: 'error_during_execution', num_turns: 1, total_cost_usd: 0.01, errors: [] }, lifecycle(a, 'cancelled'), lifecycle(b, 'cancelled'))
    await tick()
    expect(h.sent('claude:result').at(-1)).toEqual(expect.objectContaining({ pendingTurns: 0 }))
    fq.end()
    await tick()
    expect(h.calls).toHaveLength(1)
    void h.m.sendMessage('s1', 'after esc')
    await vi.waitFor(() => expect(h.calls).toHaveLength(2))
    expect(h.calls[1].prompt).toBe('after esc')
  })

  it('a copy waiting for the query to end is dropped too', async () => {
    const h = await harness()
    await firstTurn(h)
    h.queries[0].q.streamInput.mockRejectedValueOnce(new Error('ProcessTransport is not ready for writing'))
    await h.m.sendMessage('s1', 'second')
    await tick()
    expect(h.session.messageQueue).toHaveLength(1)
    await h.m.stopSession('s1')
    expect(h.session.messageQueue).toEqual([])
    h.queries[0].end()
    await tick()
    expect(h.calls).toHaveLength(1)
  })

  it('stop / double-Esc (abortSession) drops everything; no timer sends it later', async () => {
    const h = await harness()
    await firstTurn(h)
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    await sendDuringTurn(h, 'second')
    h.m.abortSession('s1')
    expect(h.session.pendingSends.size).toBe(0)
    expect(h.listed()).toEqual([])
    vi.advanceTimersByTime(INJECT_RECEIPT_TIMEOUT_MS * 2)
    h.queries[0].end()
    await tick()
    expect(h.calls).toHaveLength(1)
  })
})

describe('helpers and SDK upgrade guard', () => {
  it('parseCommandLifecycle: both shapes; anything else null', () => {
    expect(parseCommandLifecycle(lifecycle('u-1', 'queued'))).toEqual({ uuid: 'u-1', state: 'queued' })
    expect(parseCommandLifecycle({ type: 'command_lifecycle', uuid: 'u-2', state: 'started' })).toEqual({ uuid: 'u-2', state: 'started' })
    expect(parseCommandLifecycle({ type: 'system', subtype: 'command_lifecycle', state: 'queued' })).toBeNull()
    expect(parseCommandLifecycle({ type: 'system', subtype: 'init' })).toBeNull()
    expect(parseCommandLifecycle(null)).toBeNull()
  })

  it('cancelSdkQueuedMessage: true only for a true answer; a missing / throwing method is false', async () => {
    const q = (fn?: unknown) => (fn ? { cancelAsyncMessage: fn } : {}) as never
    await expect(cancelSdkQueuedMessage(q(async () => true), 'u')).resolves.toBe(true)
    await expect(cancelSdkQueuedMessage(q(async () => false), 'u')).resolves.toBe(false)
    await expect(cancelSdkQueuedMessage(q(async () => { throw new Error('Query closed') }), 'u')).resolves.toBe(false)
    await expect(cancelSdkQueuedMessage(q(() => { throw new Error('sync') }), 'u')).resolves.toBe(false)
    await expect(cancelSdkQueuedMessage(q(), 'u')).resolves.toBe(false)
  })

  it('🔴 SDK upgrade: the installed SDK still has Query.cancelAsyncMessage (cancel_async_message)', () => {
    const sdkDir = path.join(__dirname, '..', '..', 'node_modules', '@anthropic-ai', 'claude-agent-sdk')
    const mjs = fs.readFileSync(path.join(sdkDir, 'sdk.mjs'), 'utf8')
    expect(mjs).toMatch(/cancelAsyncMessage\(\w+\)\{return\(await this\.request\(\{subtype:"cancel_async_message",message_uuid:\w+\}\)\)\.response\.cancelled\}/)
    const dts = fs.readFileSync(path.join(sdkDir, 'sdk.d.ts'), 'utf8')
    // When the Query type gains it, drop the cast in cancelSdkQueuedMessage and update this check.
    expect(dts.includes('cancelAsyncMessage')).toBe(false)
    expect(dts).toContain("subtype: 'cancel_async_message'")
  })

  it('🔴 cancelAsyncMessage is called only inside cancelSdkQueuedMessage', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'claude-agent-manager.ts'), 'utf8')
    const uses = src.split('\n').filter(l => /\.cancelAsyncMessage\b/.test(l) && !l.trim().startsWith('*') && !l.trim().startsWith('//'))
    expect(uses).toHaveLength(1)
    expect(uses[0]).toContain('const fn = (instance as unknown as { cancelAsyncMessage?')
  })
})
