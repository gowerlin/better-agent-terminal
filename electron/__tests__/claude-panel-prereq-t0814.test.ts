// @vitest-environment node
/**
 * T0814 (PLAN-058 W1): Claude panel prerequisite fixes.
 *
 * ① ELECTRON_RUN_AS_NODE (Electron-as-node fallback) goes into the SDK spawn env only — the main
 *   process's global `process.env` is never written (it used to hold the variable while a query ran).
 * ② `disposeSession` (`claude:dispose-session`, closing the tab): ends the query, `close()`s the CLI,
 *   drops the session. stopSession keeps the session (⏻ restart). A codex session closes as before.
 * ③ the query ending clears `queryInstance`: setModel / setPermissionMode / getContextUsage /
 *   stopTask no longer send requests to the ended query; account info / slash commands / agents
 *   (the SDK's cached `initialization`, no request) stay readable until the next query.
 * ④ `command_lifecycle` frames → one debug-level summary line, no `[claude:msg]` line.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => new Proxy({}, {
  get(_target, prop) {
    throw new Error(`claude-agent-manager must not touch electron: electron.${String(prop)}`)
  },
}))
const log = vi.hoisted(() => ({ log: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }))
vi.mock('../logger', () => ({ logger: log }))

const nodeResolver = vi.hoisted(() => ({ fallback: false }))
vi.mock('../node-resolver', () => ({
  getNodeExecutable: () => (nodeResolver.fallback ? 'C:\\BAT\\BetterAgentTerminal.exe' : 'node'),
  isElectronFallback: () => nodeResolver.fallback,
}))

const sdk = vi.hoisted(() => ({ query: vi.fn() }))
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: sdk.query,
  listSessions: vi.fn(),
  getSessionMessages: vi.fn(async () => []),
  getSubagentMessages: vi.fn(),
  listSubagents: vi.fn(),
}))

import { ClaudeAgentManager, commandLifecycleSummary, readQueryInit, sdkSpawnEnv } from '../claude-agent-manager'
import { registerClaudeHandlers } from '../handlers/claude'

const SDK_SESSION = '11111111-2222-3333-4444-555555555555'
const ACCOUNT = { email: 'demo@example.invalid', subscriptionType: 'max' }
const COMMANDS = [{ name: 'review', description: 'Review', argumentHint: '' }]
const AGENTS = [{ name: 'Explore', description: 'Read-only search' }]

type QueryArgs = { prompt: unknown; options: Record<string, unknown> }

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
    setModel: vi.fn(async (_m: string) => {}),
    setPermissionMode: vi.fn(async (_m: string) => {}),
    getContextUsage: vi.fn(async () => ({ categories: [], totalTokens: 1, maxTokens: 2, percentage: 50, model: 'm' })),
    accountInfo: vi.fn(async () => ACCOUNT),
    supportedCommands: vi.fn(async () => COMMANDS),
    supportedAgents: vi.fn(async () => AGENTS),
    close: vi.fn(),
  })
  return {
    q,
    push: (...m: unknown[]) => { queue.push(...m); wake?.() },
    end: (err?: Error) => { ended = true; failure = err ?? null; wake?.() },
  }
}

type Session = {
  queryInstance?: unknown
  lastQueryInit?: unknown
  state: { isStreaming: boolean }
  abortController: AbortController
  messageQueue: unknown[]
}

const managers: ClaudeAgentManager[] = []
let envBefore: string | undefined
beforeEach(() => {
  envBefore = process.env.ELECTRON_RUN_AS_NODE
  delete process.env.ELECTRON_RUN_AS_NODE
  nodeResolver.fallback = false
  for (const fn of Object.values(log)) fn.mockClear()
})
afterEach(() => {
  for (const m of managers.splice(0)) { m.killAll(); m.dispose() }
  sdk.query.mockReset()
  if (envBefore === undefined) delete process.env.ELECTRON_RUN_AS_NODE
  else process.env.ELECTRON_RUN_AS_NODE = envBefore
})

const tick = async (n = 5) => { for (let i = 0; i < n; i++) await new Promise(r => setTimeout(r, 0)) }

async function harness() {
  const emit = vi.fn()
  const m = new ClaudeAgentManager({ emit, getSettings: () => ({ notifyOnComplete: false }) })
  ;(m as unknown as { resolveRuntimeForSession: () => Promise<unknown> }).resolveRuntimeForSession = async () => ({ source: 'embedded', path: 'C:\\demo\\claude.exe' })
  managers.push(m)
  const queries: Array<ReturnType<typeof fakeQuery>> = []
  const calls: QueryArgs[] = []
  const envAtSpawn: Array<string | undefined> = []
  sdk.query.mockImplementation((args: QueryArgs) => {
    calls.push(args)
    envAtSpawn.push(process.env.ELECTRON_RUN_AS_NODE)
    const fq = fakeQuery()
    queries.push(fq)
    return fq.q
  })
  await m.startSession('s1', { cwd: process.cwd() })
  const sessions = (m as unknown as { sessions: Map<string, Session> }).sessions
  return { m, emit, sessions, session: () => sessions.get('s1'), queries, calls, envAtSpawn }
}

const init = { type: 'system', subtype: 'init', session_id: SDK_SESSION, model: 'claude-sonnet-4-6', cwd: process.cwd(), permissionMode: 'default' }
const result = { type: 'result', subtype: 'success', num_turns: 1, result: 'ok', total_cost_usd: 0.01, usage: { input_tokens: 1, output_tokens: 1 } }

/** One message → init → result → the query ends. */
async function runOneTurn(h: Awaited<ReturnType<typeof harness>>, index = 0, prompt = 'hello') {
  void h.m.sendMessage('s1', prompt)
  await vi.waitFor(() => expect(h.queries).toHaveLength(index + 1))
  h.queries[index].push(init, result)
  h.queries[index].end()
  await vi.waitFor(() => expect(h.session()?.state.isStreaming).toBe(false))
  await tick()
}

describe('① ELECTRON_RUN_AS_NODE only in the SDK spawn env (T0814)', () => {
  it('sdkSpawnEnv: added with electronRunAsNode, absent without; process.env untouched', () => {
    const before = { ...process.env }
    expect(sdkSpawnEnv({ source: 'embedded' }, { electronRunAsNode: true }).env?.ELECTRON_RUN_AS_NODE).toBe('1')
    expect(sdkSpawnEnv({ source: 'system' }, { electronRunAsNode: true }).env?.ELECTRON_RUN_AS_NODE).toBe('1')
    expect(sdkSpawnEnv({ source: 'embedded' }).env?.ELECTRON_RUN_AS_NODE).toBeUndefined()
    expect(sdkSpawnEnv({ source: 'embedded' }, { electronRunAsNode: false }).env?.ELECTRON_RUN_AS_NODE).toBeUndefined()
    expect(process.env).toEqual(before)
  })

  it('sdkSpawnEnv: a system runtime with the user\'s own task-tools setting still gets an env when the fallback needs it', () => {
    process.env.CLAUDE_CODE_ENABLE_TODO_TOOLS = '0'
    try {
      expect(sdkSpawnEnv({ source: 'system' })).toEqual({})
      const { env } = sdkSpawnEnv({ source: 'system' }, { electronRunAsNode: true })
      expect(env?.ELECTRON_RUN_AS_NODE).toBe('1')
      expect(env?.CLAUDE_CODE_ENABLE_TODO_TOOLS).toBe('0')
      expect(env?.PATH ?? env?.Path).toBe(process.env.PATH ?? process.env.Path)
    } finally {
      delete process.env.CLAUDE_CODE_ENABLE_TODO_TOOLS
    }
  })

  it('fallback query: spawn env has it, the global env never does (before, during, after)', async () => {
    nodeResolver.fallback = true
    const h = await harness()
    void h.m.sendMessage('s1', 'hello')
    await vi.waitFor(() => expect(h.queries).toHaveLength(1))
    expect(h.envAtSpawn[0]).toBeUndefined()
    expect(process.env.ELECTRON_RUN_AS_NODE).toBeUndefined()
    const options = h.calls[0].options as { env?: Record<string, string>; executable?: string }
    expect(options.env?.ELECTRON_RUN_AS_NODE).toBe('1')
    expect(options.executable).toBe('C:\\BAT\\BetterAgentTerminal.exe')
    h.queries[0].push(init)
    await tick()
    expect(process.env.ELECTRON_RUN_AS_NODE).toBeUndefined()
    h.queries[0].push(result)
    h.queries[0].end()
    await vi.waitFor(() => expect(h.session()?.state.isStreaming).toBe(false))
    expect(process.env.ELECTRON_RUN_AS_NODE).toBeUndefined()
  })

  it('no fallback: the spawn env does not get it', async () => {
    const h = await harness()
    await runOneTurn(h)
    const options = h.calls[0].options as { env?: Record<string, string>; executable?: string }
    expect(options.env?.ELECTRON_RUN_AS_NODE).toBeUndefined()
    expect(options.executable).toBeUndefined()
    expect(process.env.ELECTRON_RUN_AS_NODE).toBeUndefined()
  })

  it('a value the user already had in the global env is left alone (not deleted after the query)', async () => {
    process.env.ELECTRON_RUN_AS_NODE = 'user-value'
    nodeResolver.fallback = true
    const h = await harness()
    await runOneTurn(h)
    expect((h.calls[0].options as { env?: Record<string, string> }).env?.ELECTRON_RUN_AS_NODE).toBe('1')
    expect(process.env.ELECTRON_RUN_AS_NODE).toBe('user-value')
  })
})

describe('② disposeSession — closing the tab (T0814)', () => {
  it('during a query: aborts, close()s the CLI, drops the session; the finally starts nothing', async () => {
    const h = await harness()
    void h.m.sendMessage('s1', 'hello')
    await vi.waitFor(() => expect(h.queries).toHaveLength(1))
    h.queries[0].push(init)
    await tick()
    const controller = h.session()!.abortController
    expect(h.m.disposeSession('s1')).toBe(true)
    expect(h.queries[0].q.close).toHaveBeenCalledTimes(1)
    expect(controller.signal.aborted).toBe(true)
    expect(h.sessions.has('s1')).toBe(false)
    h.queries[0].end(new Error('aborted'))
    await tick(10)
    expect(h.queries).toHaveLength(1)
    expect(h.emit.mock.calls.filter(c => c[0] === 'claude:error')).toEqual([])
    // the tab is gone: per-session calls find no session
    expect(await h.m.setModel('s1', 'claude-opus-5-5')).toBe(false)
    expect(h.m.disposeSession('s1')).toBe(false)
  })

  it('idle session (query already ended): drops it; nothing left to close', async () => {
    const h = await harness()
    await runOneTurn(h)
    expect(h.m.disposeSession('s1')).toBe(true)
    expect(h.sessions.has('s1')).toBe(false)
    expect(h.queries[0].q.close).not.toHaveBeenCalled()
  })

  it('a queued message is dropped with the session (no new query after dispose)', async () => {
    const h = await harness()
    void h.m.sendMessage('s1', 'first')
    await vi.waitFor(() => expect(h.queries).toHaveLength(1))
    h.session()!.messageQueue.push({ prompt: 'second' })
    h.m.disposeSession('s1')
    h.queries[0].end(new Error('aborted'))
    await tick(10)
    expect(h.queries).toHaveLength(1)
  })

  it('stopSession still keeps the session (⏻ restart = stop + start)', async () => {
    const h = await harness()
    await runOneTurn(h)
    expect(await h.m.stopSession('s1')).toBe(true)
    expect(h.sessions.has('s1')).toBe(true)
  })

  it('unknown session → false', async () => {
    const h = await harness()
    expect(h.m.disposeSession('nope')).toBe(false)
  })

  it('handler claude:dispose-session: claude → disposeSession; codex → stopSession (as before)', async () => {
    const handlers = new Map<string, (...args: unknown[]) => unknown>()
    const sessionKinds = new Map<string, 'claude' | 'codex'>([['c1', 'codex']])
    const claude = { disposeSession: vi.fn(() => true), stopSession: vi.fn() }
    const codex = { stopSession: vi.fn(async () => true) }
    registerClaudeHandlers(((channel: string, fn: (...args: unknown[]) => unknown) => { handlers.set(channel, fn) }) as never, {
      emit: vi.fn(),
      homeDir: process.cwd(),
      getClaudeManager: () => claude as never,
      getCodexManager: () => codex as never,
      sessionKinds,
    })
    const fn = handlers.get('claude:dispose-session')!
    expect(fn).toBeTypeOf('function')
    expect(fn({}, 's1')).toBe(true)
    expect(claude.disposeSession).toHaveBeenCalledWith('s1')
    await fn({}, 'c1')
    expect(codex.stopSession).toHaveBeenCalledWith('c1')
    expect(claude.stopSession).not.toHaveBeenCalled()
  })
})

describe('③ the query ending clears queryInstance (T0814)', () => {
  it('ended query: no requests to it; init data still readable from its cache', async () => {
    const h = await harness()
    await runOneTurn(h)
    const q = h.queries[0].q
    expect(h.session()!.queryInstance).toBeUndefined()

    expect(await h.m.setModel('s1', 'claude-opus-5-5')).toBe(true)
    expect(q.setModel).not.toHaveBeenCalled()
    expect(await h.m.setPermissionMode('s1', 'acceptEdits')).toBe(true)
    expect(q.setPermissionMode).not.toHaveBeenCalled()
    expect(await h.m.getContextUsage('s1')).toBeNull()
    expect(q.getContextUsage).not.toHaveBeenCalled()
    expect(await h.m.stopTask('s1', 'toolu_x')).toBe(false)
    expect(q.stopTask).not.toHaveBeenCalled()

    expect(await h.m.getAccountInfo('s1')).toEqual(ACCOUNT)
    expect(await h.m.getSupportedCommands('s1')).toEqual(COMMANDS)
    expect(await h.m.getSupportedAgents('s1')).toEqual(AGENTS)
    // read once when the query ended, not per call
    await h.m.getAccountInfo('s1')
    expect(q.accountInfo).toHaveBeenCalledTimes(1)
  })

  it('the stored model / mode go to the next query', async () => {
    const h = await harness()
    await runOneTurn(h)
    await h.m.setModel('s1', 'claude-opus-5-5')
    await h.m.setPermissionMode('s1', 'acceptEdits')
    void h.m.sendMessage('s1', 'next')
    await vi.waitFor(() => expect(h.queries).toHaveLength(2))
    expect(h.calls[1].options.model).toBe('claude-opus-5-5')
    expect(h.calls[1].options.permissionMode).toBe('acceptEdits')
    expect(h.session()!.queryInstance).toBe(h.queries[1].q)
  })

  it('while a query runs, the calls still go to it', async () => {
    const h = await harness()
    void h.m.sendMessage('s1', 'hello')
    await vi.waitFor(() => expect(h.queries).toHaveLength(1))
    h.queries[0].push(init)
    await tick()
    await h.m.setModel('s1', 'claude-opus-5-5')
    expect(h.queries[0].q.setModel).toHaveBeenCalledWith('claude-opus-5-5')
    expect(await h.m.getContextUsage('s1')).not.toBeNull()
    h.queries[0].push(result)
    h.queries[0].end()
    await vi.waitFor(() => expect(h.session()?.queryInstance).toBeUndefined())
  })

  it('a queued message\'s new query is not cleared by the old query\'s finally', async () => {
    const h = await harness()
    void h.m.sendMessage('s1', 'first')
    await vi.waitFor(() => expect(h.queries).toHaveLength(1))
    h.queries[0].push(init)
    await tick()
    h.session()!.messageQueue.push({ prompt: 'second' })
    h.queries[0].push(result)
    h.queries[0].end()
    await vi.waitFor(() => expect(h.queries).toHaveLength(2))
    await tick()
    expect(h.session()!.queryInstance).toBe(h.queries[1].q)
  })

  it('stop, then a new message before the old query ends: the old finally leaves the new query alone', async () => {
    const h = await harness()
    void h.m.sendMessage('s1', 'first')
    await vi.waitFor(() => expect(h.queries).toHaveLength(1))
    h.queries[0].push(init)
    await tick()
    await h.m.stopSession('s1') // interrupt; the old query is still finishing
    expect(h.session()!.state.isStreaming).toBe(false)
    void h.m.sendMessage('s1', 'second')
    await vi.waitFor(() => expect(h.queries).toHaveLength(2))
    await vi.waitFor(() => expect(h.session()!.queryInstance).toBe(h.queries[1].q))
    h.queries[0].push(result)
    h.queries[0].end()
    await tick(10)
    expect(h.session()!.queryInstance).toBe(h.queries[1].q)
    await h.m.setModel('s1', 'claude-opus-5-5')
    expect(h.queries[1].q.setModel).toHaveBeenCalledWith('claude-opus-5-5')
    expect(h.queries[0].q.setModel).not.toHaveBeenCalled()
  })

  it('a query that ended before system/init keeps no init data', async () => {
    const h = await harness()
    void h.m.sendMessage('s1', 'hello')
    await vi.waitFor(() => expect(h.queries).toHaveLength(1))
    h.queries[0].end(new Error('spawn failed'))
    await vi.waitFor(() => expect(h.session()?.state.isStreaming).toBe(false))
    expect(h.session()!.queryInstance).toBeUndefined()
    expect(h.session()!.lastQueryInit).toBeUndefined()
    expect(await h.m.getAccountInfo('s1')).toBeNull()
    expect(await h.m.getSupportedCommands('s1')).toEqual([])
  })

  it('restSession drops the cached init data too (as it dropped the query before)', async () => {
    const h = await harness()
    await runOneTurn(h)
    h.m.restSession('s1')
    expect(await h.m.getAccountInfo('s1')).toBeNull()
    expect(await h.m.getSupportedAgents('s1')).toEqual([])
  })

  it('readQueryInit: a failing read settles as null / []', async () => {
    const reads = readQueryInit({
      accountInfo: () => Promise.reject(new Error('x')),
      supportedCommands: () => { throw new Error('sync') },
      supportedAgents: async () => AGENTS,
    } as never)
    expect(await reads.accountInfo).toBeNull()
    expect(await reads.supportedCommands).toEqual([])
    expect(await reads.supportedAgents).toEqual(AGENTS)
  })
})

describe('④ command_lifecycle log (T0814)', () => {
  it('summary for both shapes; null for other messages', () => {
    expect(commandLifecycleSummary({ type: 'command_lifecycle', uuid: 'abcdef12-3456', state: 'queued' })).toBe('[claude:lifecycle] state=queued uuid=abcdef12')
    expect(commandLifecycleSummary({ type: 'system', subtype: 'command_lifecycle', command_uuid: '99887766-aaaa', state: 'started' })).toBe('[claude:lifecycle] state=started uuid=99887766')
    expect(commandLifecycleSummary({ type: 'command_lifecycle' })).toBe('[claude:lifecycle] state=? uuid=none')
    expect(commandLifecycleSummary({ type: 'system', subtype: 'init' })).toBeNull()
    expect(commandLifecycleSummary({ type: 'result' })).toBeNull()
    expect(commandLifecycleSummary(null)).toBeNull()
  })

  it('a lifecycle frame logs one debug line and no [claude:msg] line; other messages unchanged', async () => {
    const h = await harness()
    void h.m.sendMessage('s1', 'hello')
    await vi.waitFor(() => expect(h.queries).toHaveLength(1))
    h.queries[0].push(init, { type: 'command_lifecycle', uuid: 'abcdef12-3456', state: 'queued' }, result)
    h.queries[0].end()
    await vi.waitFor(() => expect(h.session()?.state.isStreaming).toBe(false))
    const msgLines = log.log.mock.calls.map(c => String(c[0])).filter(l => l.startsWith('[claude:msg]'))
    expect(msgLines.some(l => l.includes('type=command_lifecycle'))).toBe(false)
    expect(msgLines.some(l => l.includes('type=system subtype=init'))).toBe(true)
    expect(msgLines.some(l => l.includes('type=result'))).toBe(true)
    expect(log.debug.mock.calls.map(c => c[0])).toContain('[claude:lifecycle] state=queued uuid=abcdef12')
  })
})
