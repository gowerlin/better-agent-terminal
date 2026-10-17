// @vitest-environment node
// PLAN-047 M1 / T0584: scripts/bat-mcp.mjs — the MCP side, with a stub `invoke`:
//   - legacy (`initialize`, `ping`) and modern 2026-07-28 (`server/discover`, `_meta` version,
//     `resultType`, tools/list `ttlMs` / `cacheScope`); unsupported version → -32022
//   - tools/list: the six tools, read-only annotations
//   - every tool forwards to its channel with only its known keys (bat_worktree_status via stub)
//   - results: structuredContent = channel reply without `ok`; `{ ok:false, code }` → isError
//   - errors: unknown tool -32602, unknown method -32601, parse error, notifications unanswered
//   - classifyInvokeError: old BAT → UNSUPPORTED, other Forbidden → FORBIDDEN
//   - audit: one tool-call event (tool / ok / code / duration / traceparent), never the arguments
//   - the real process on stdio: --version, a modern session, CONNECT_FAILED outside BAT
import { spawn, spawnSync } from 'child_process'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { afterAll, describe, expect, it } from 'vitest'
import {
  classifyInvokeError,
  createMcpServer,
  MODERN_PROTOCOL,
  RPC,
  SUPPORTED_PROTOCOLS,
  TOOLS,
  WAIT_INVOKE_TIMEOUT_MS,
} from '../bat-mcp.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const SHIM = join(here, '..', 'bat-mcp.mjs')
const modern = { _meta: { 'io.modelcontextprotocol/protocolVersion': MODERN_PROTOCOL } }

/** A server whose invoke records calls and answers from `replies[channel]`. */
function setup(replies = {}) {
  const calls = []
  const events = []
  let clock = 1000
  const server = createMcpServer({
    invoke: async (channel, args, timeoutMs) => {
      calls.push({ channel, args, timeoutMs })
      clock += 7
      const reply = replies[channel]
      if (typeof reply === 'function') return reply(args)
      return reply ?? { ok: true, result: { ok: true } }
    },
    log: (event, data) => events.push({ event, ...data }),
    now: () => clock,
  })
  let seq = 0
  const request = (method, params) => server.handleMessage({ jsonrpc: '2.0', id: ++seq, method, ...(params === undefined ? {} : { params }) })
  // meta null = a legacy request (no _meta protocol version)
  const call = (name, args, meta = modern._meta) => request('tools/call', { name, ...(args === undefined ? {} : { arguments: args }), ...(meta === null ? {} : { _meta: meta }) })
  return { server, calls, events, request, call }
}

describe('handshake: legacy and modern (dual-era)', () => {
  it('legacy initialize answers a legacy version; ping answers {}', async () => {
    const { request } = setup()
    const init = await request('initialize', { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 't', version: '0' } })
    expect(init.result).toMatchObject({ protocolVersion: '2025-11-25', capabilities: { tools: { listChanged: false } }, serverInfo: { name: 'bat' } })
    expect((await request('initialize', { protocolVersion: '2099-01-01' })).result.protocolVersion).toBe('2025-11-25')
    expect((await request('ping')).result).toEqual({})
  })

  it('modern server/discover: resultType, versions, tools capability, serverInfo in _meta', async () => {
    const { request } = setup()
    const r = (await request('server/discover', modern)).result
    expect(r).toMatchObject({ resultType: 'complete', cacheScope: 'private', capabilities: { tools: {} } })
    expect(r.supportedVersions).toEqual(SUPPORTED_PROTOCOLS)
    expect(r.supportedVersions[0]).toBe('2026-07-28')
    expect(r.ttlMs).toBeGreaterThan(0)
    expect(r._meta['io.modelcontextprotocol/serverInfo']).toMatchObject({ name: 'bat' })
  })

  it('an unsupported _meta version → -32022 with the supported list', async () => {
    const { request } = setup()
    const r = await request('tools/list', { _meta: { 'io.modelcontextprotocol/protocolVersion': '1900-01-01' } })
    expect(r.error).toEqual({ code: RPC.UNSUPPORTED_PROTOCOL_VERSION, message: 'Unsupported protocol version', data: { supported: SUPPORTED_PROTOCOLS, requested: '1900-01-01' } })
  })

  it('notifications are not answered; unknown methods are -32601; bad JSON is -32700', async () => {
    const { server, request } = setup()
    expect(await server.handleMessage({ jsonrpc: '2.0', method: 'notifications/initialized' })).toBeNull()
    expect((await request('logging/setLevel', modern)).error.code).toBe(RPC.METHOD_NOT_FOUND)
    expect(JSON.parse(await server.handleLine('{nope')).error.code).toBe(RPC.PARSE_ERROR)
    expect(await server.handleLine('   ')).toBeNull()
    expect((await server.handleMessage({ id: 1, method: 'ping' })).error.code).toBe(RPC.INVALID_REQUEST)
  })
})

describe('tools/list', () => {
  it('lists the six contract tools, all read-only', async () => {
    const { request } = setup()
    const legacy = (await request('tools/list')).result
    expect(legacy.resultType).toBeUndefined()
    expect(legacy.tools.map(t => t.name)).toEqual([
      'bat_whoami', 'bat_list_terminals', 'bat_get_state', 'bat_read_output', 'bat_wait', 'bat_worktree_status',
    ])
    for (const tool of legacy.tools) {
      expect(tool.annotations.readOnlyHint, tool.name).toBe(true)
      expect(tool.inputSchema.type).toBe('object')
    }
    const m = (await request('tools/list', modern)).result
    expect(m).toMatchObject({ resultType: 'complete', cacheScope: 'private' })
    expect(m.ttlMs).toBeGreaterThan(0)
    expect(m.tools).toEqual(legacy.tools)
  })
})

describe('tools/call forwards to the channel', () => {
  const cases = [
    ['bat_whoami', { terminalId: 'ignored' }, 'terminal:whoami', []],
    ['bat_list_terminals', { scope: 'workspace', extra: 1 }, 'terminal:list', [{ scope: 'workspace' }]],
    ['bat_get_state', { terminalId: 'w1' }, 'terminal:get-state', [{ terminalId: 'w1' }]],
    ['bat_read_output', { terminalId: 'w1', cursor: '42', maxLines: 5, junk: true }, 'terminal:read-output', [{ terminalId: 'w1', cursor: '42', maxLines: 5 }]],
    ['bat_wait', { terminalId: 'w1', until: 'exit', fromState: 'working', timeoutMs: 30000 }, 'terminal:wait', [{ terminalId: 'w1', until: 'exit', fromState: 'working', timeoutMs: 30000 }]],
    ['bat_worktree_status', { workorder: 'T0585', terminalId: 'w1' }, 'worktree:terminal-status', [{ terminalId: 'w1', workorder: 'T0585' }]],
  ]
  for (const [tool, args, channel, forwarded] of cases) {
    it(`${tool} → ${channel}`, async () => {
      const { call, calls } = setup()
      const r = await call(tool, args)
      expect(r.result.isError).toBeUndefined()
      expect(calls).toEqual([{ channel, args: forwarded, timeoutMs: TOOLS.find(t => t.name === tool).timeoutMs }])
    })
  }

  it('bat_wait waits longer than terminal:wait (45 s); others use the helper 3 s', () => {
    expect(WAIT_INVOKE_TIMEOUT_MS).toBeGreaterThanOrEqual(50_000)
    expect(TOOLS.find(t => t.name === 'bat_wait').timeoutMs).toBe(WAIT_INVOKE_TIMEOUT_MS)
    expect(TOOLS.find(t => t.name === 'bat_whoami').timeoutMs).toBe(3000)
  })

  it('T0600: bat_wait accepts until agent-started; summaries say whether the agent started (nothing when it cannot be told)', async () => {
    expect(TOOLS.find(t => t.name === 'bat_wait').inputSchema.properties.until.enum).toEqual(['state-change', 'exit', 'idle', 'agent-started'])
    expect(TOOLS.find(t => t.name === 'bat_get_state').description).toContain('agentStarted')
    const { call, calls } = setup({
      'terminal:get-state': { ok: true, result: { ok: true, terminalId: 'w1', state: 'idle', idleMs: 9000, blockedDetection: 'hook', agentStarted: true, agentStartedAt: 5 } },
      'terminal:wait': { ok: true, result: { ok: true, terminalId: 'w1', changed: false, state: 'idle', blockedDetection: 'hook', agentStarted: false, waitedMs: 100 } },
    })
    expect((await call('bat_get_state', { terminalId: 'w1' })).result.content[0].text).toBe('w1: idle, idle 9000 ms, agent started')
    expect((await call('bat_wait', { terminalId: 'w1', until: 'agent-started' })).result.content[0].text).toBe('changed=false state=idle, agent not started yet after 100 ms')
    expect(calls.at(-1).args).toEqual([{ terminalId: 'w1', until: 'agent-started' }])
    const { call: callNone } = setup({ 'terminal:get-state': { ok: true, result: { ok: true, terminalId: 'c1', state: 'idle', idleMs: 1, blockedDetection: 'none', agentStarted: null } } })
    expect((await callNone('bat_get_state', { terminalId: 'c1' })).result.content[0].text).toBe('c1: idle, idle 1 ms')
  })

  it('no arguments = this tab (no terminalId sent)', async () => {
    const { call, calls } = setup()
    await call('bat_get_state')
    expect(calls[0].args).toEqual([{}])
  })

  it('success: structuredContent is the reply without ok; content is a summary (+ output lines)', async () => {
    const { call } = setup({
      'terminal:read-output': { ok: true, result: { ok: true, terminalId: 'w1', lines: ['hello', 'world'], nextCursor: '120', truncated: false, skippedLines: 0, partialLine: true, masked: 1, state: 'working' } },
      'worktree:terminal-status': { ok: true, result: { ok: true, isolated: false } },
    })
    const r = (await call('bat_read_output', { terminalId: 'w1' })).result
    expect(r.resultType).toBe('complete')
    expect(r.structuredContent).toEqual({ terminalId: 'w1', lines: ['hello', 'world'], nextCursor: '120', truncated: false, skippedLines: 0, partialLine: true, masked: 1, state: 'working' })
    expect(r.content[0].text).toBe('2 lines from w1 (nextCursor=120, state=working, partialLine, masked=1)\nhello\nworld')
    const wt = (await call('bat_worktree_status', {})).result
    expect(wt.structuredContent).toEqual({ isolated: false })
    expect(wt.content[0].text).toBe('not an isolated worktree')
  })

  it('bat_worktree_status summary follows the T0585 reply (lists + counts)', async () => {
    const reply = {
      ok: true, terminalId: 'w1', isolated: true, workorder: 'T0585', path: '/r/.bat-worktrees/r/T0585', branch: 'ct/T0585',
      base: 'b', mainCheckout: '/r', head: 'h', mainHead: 'm', ahead: 2, behind: 1, dirty: [], dirtyCount: 0,
      changedFiles: ['a.ts', 'b.ts'], changedCount: 3, outOfScopeFiles: ['b.ts'], touchesCtWorkorders: false,
      conflicts: ['a.ts'], computedAt: 1, cached: false,
    }
    const { call } = setup({ 'worktree:terminal-status': { ok: true, result: reply } })
    const r = (await call('bat_worktree_status', { workorder: 'T0585' })).result
    expect(r.content[0].text).toBe('ct/T0585 at /r/.bat-worktrees/r/T0585, ahead 2, behind 1, 3 changed files, 1 out of scope, 1 conflict')
    const { ok: _ok, ...data } = reply
    expect(r.structuredContent).toEqual(data)
    const { call: dirtyCall } = setup({ 'worktree:terminal-status': { ok: true, result: { ...reply, dirty: ['x'], dirtyCount: 1, conflicts: null } } })
    expect((await dirtyCall('bat_worktree_status', {})).result.content[0].text).toContain('1 uncommitted')
    const { call: ambiguous } = setup({ 'worktree:terminal-status': { ok: true, result: { ok: false, code: 'AMBIGUOUS' } } })
    expect((await ambiguous('bat_worktree_status', { workorder: 'T0585' })).result).toMatchObject({ isError: true, structuredContent: { code: 'AMBIGUOUS' } })
  })

  it('bat_worktree_status summary names a closed tab / git source (T0589); structuredContent keeps source', async () => {
    const reply = {
      ok: true, terminalId: null, source: 'git', isolated: true, workorder: 'T0589', path: '/r/.bat-worktrees/r/T0589', branch: 'ct/T0589',
      base: 'b', mainCheckout: '/r', head: 'h', mainHead: 'm', ahead: 1, behind: 0, dirty: null, dirtyCount: null, worktreeMissing: true,
      changedFiles: ['a.ts'], changedCount: 1, outOfScopeFiles: [], touchesCtWorkorders: false, conflicts: [], computedAt: 1, cached: false,
    }
    const { call } = setup({ 'worktree:terminal-status': { ok: true, result: reply } })
    const r = (await call('bat_worktree_status', { workorder: 'T0589' })).result
    expect(r.content[0].text).toBe('ct/T0589 at /r/.bat-worktrees/r/T0589 (no tab; from git), ahead 1, behind 0, worktree missing, 1 changed file')
    expect(r.structuredContent).toMatchObject({ source: 'git', terminalId: null, worktreeMissing: true })
    const { call: exited } = setup({ 'worktree:terminal-status': { ok: true, result: { ...reply, terminalId: 'w1', source: 'exited', exited: true, exitedAt: 5 } } })
    expect((await exited('bat_worktree_status', { workorder: 'T0589' })).result.content[0].text).toMatch(/^ct\/T0589 at \/r\/\.bat-worktrees\/r\/T0589 \(tab closed\), /)
    const { call: plain } = setup({ 'worktree:terminal-status': { ok: true, result: { ok: true, terminalId: 'w1', source: 'exited', exited: true, exitedAt: 5, isolated: false } } })
    expect((await plain('bat_worktree_status', { terminalId: 'w1' })).result.content[0].text).toBe('w1: not an isolated worktree (tab closed)')
  })

  it('legacy calls get no resultType', async () => {
    const { call } = setup()
    const r = (await call('bat_whoami', {}, null)).result
    expect(r.resultType).toBeUndefined()
    expect(r.structuredContent).toEqual({})
  })
})

describe('errors', () => {
  it('a channel { ok:false, code } is a tool result with isError, not a JSON-RPC error', async () => {
    const { call } = setup({ 'terminal:read-output': { ok: true, result: { ok: false, code: 'NOT_OWNER' } } })
    const r = await call('bat_read_output', { terminalId: 'tower' })
    expect(r.error).toBeUndefined()
    expect(r.result).toEqual({ resultType: 'complete', isError: true, content: [{ type: 'text', text: 'NOT_OWNER' }], structuredContent: { code: 'NOT_OWNER' } })
  })

  it('connection / auth / unsupported outcomes carry their code and message', async () => {
    for (const code of ['CONNECT_FAILED', 'AUTH_FAILED', 'UNSUPPORTED', 'TIMEOUT', 'TOO_MANY_WAITS']) {
      const { call } = setup({ 'terminal:wait': { ok: false, code, message: 'why' } })
      const r = (await call('bat_wait', { until: 'exit' })).result
      expect(r).toMatchObject({ isError: true, structuredContent: { code, message: 'why' } })
      expect(r.content[0].text).toBe(`${code}: why`)
    }
  })

  it('unknown tool → JSON-RPC -32602', async () => {
    const { call, calls } = setup()
    const r = await call('bat_nope', {})
    expect(r.error).toEqual({ code: RPC.INVALID_PARAMS, message: 'Unknown tool: bat_nope' })
    expect(calls).toEqual([])
  })

  it('arguments that are not an object → INVALID_ARGS without a call', async () => {
    const { call, calls } = setup()
    const r = (await call('bat_get_state', ['x'])).result
    expect(r).toMatchObject({ isError: true, structuredContent: { code: 'INVALID_ARGS' } })
    expect(calls).toEqual([])
  })

  it('classifyInvokeError: an older BAT is UNSUPPORTED', () => {
    expect(classifyInvokeError('No handler for channel: worktree:terminal-status').code).toBe('UNSUPPORTED')
    expect(classifyInvokeError('Forbidden: channel-not-allowed').code).toBe('UNSUPPORTED')
    expect(classifyInvokeError('Forbidden: role-not-allowed')).toEqual({ code: 'FORBIDDEN', message: 'role-not-allowed' })
    expect(classifyInvokeError('boom')).toEqual({ code: 'ERROR', message: 'boom' })
  })
})

describe('audit', () => {
  it('one tool-call event: tool, ok / code, duration, era, traceparent — no arguments, no output', async () => {
    const { call, events } = setup({ 'terminal:read-output': { ok: true, result: { ok: true, lines: ['SECRET-OUTPUT'], nextCursor: '1', state: 'idle', terminalId: 'w1' } } })
    await call('bat_read_output', { terminalId: 'w1', cursor: 'CURSOR-ARG' }, { ...modern._meta, traceparent: '00-abc-def-01' })
    await call('bat_get_state', {}, null)
    expect(events).toEqual([
      { event: 'tool-call', tool: 'bat_read_output', ok: true, durationMs: 7, era: 'modern', traceparent: '00-abc-def-01' },
      { event: 'tool-call', tool: 'bat_get_state', ok: true, durationMs: 7, era: 'legacy' },
    ])
    const { call: callErr, events: errEvents } = setup({ 'terminal:wait': { ok: true, result: { ok: false, code: 'NOT_OWNER' } } })
    await callErr('bat_wait', { until: 'exit' })
    expect(errEvents[0]).toMatchObject({ tool: 'bat_wait', ok: false, code: 'NOT_OWNER' })
    expect(JSON.stringify([...events, ...errEvents])).not.toMatch(/SECRET-OUTPUT|CURSOR-ARG/)
  })
})

describe('the shim process on stdio', () => {
  const logDir = mkdtempSync(join(tmpdir(), 't0584-shim-'))
  afterAll(() => rmSync(logDir, { recursive: true, force: true }))
  const cleanEnv = () => ({
    ...Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.toUpperCase().startsWith('BAT_'))),
    BAT_HELPER_LOG_DIR: logDir,
  })

  it('--version', () => {
    const r = spawnSync(process.execPath, [SHIM, '--version'], { encoding: 'utf8', env: cleanEnv() })
    expect(r.status).toBe(0)
    expect(r.stdout).toMatch(/^bat-mcp\.mjs v\d/)
  })

  it('serves a modern session; outside BAT a tool is CONNECT_FAILED; exits when stdin ends', async () => {
    const child = spawn(process.execPath, [SHIM], { env: cleanEnv(), stdio: ['pipe', 'pipe', 'pipe'] })
    let out = ''
    child.stdout.on('data', d => { out += d })
    const lines = [
      { jsonrpc: '2.0', id: 'd', method: 'server/discover', params: modern },
      { jsonrpc: '2.0', id: 'l', method: 'tools/list', params: modern },
      { jsonrpc: '2.0', id: 'w', method: 'tools/call', params: { name: 'bat_whoami', arguments: {}, ...modern } },
    ]
    child.stdin.end(lines.map(l => JSON.stringify(l)).join('\n') + '\n')
    const code = await new Promise(resolve => child.on('exit', resolve))
    expect(code).toBe(0)
    const replies = Object.fromEntries(out.trim().split('\n').map(l => JSON.parse(l)).map(r => [r.id, r]))
    expect(replies.d.result.resultType).toBe('complete')
    expect(replies.l.result.tools).toHaveLength(6)
    expect(replies.w.result).toMatchObject({ isError: true, structuredContent: { code: 'CONNECT_FAILED' } })
  })
})
