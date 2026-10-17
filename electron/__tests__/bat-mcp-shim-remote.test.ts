// @vitest-environment node
/**
 * PLAN-047 M1 / T0584: scripts/bat-mcp.mjs (the real process, on stdio) against a real
 * RemoteServer with the T0582 query handlers and scoped capabilities (the main.ts wiring, as in
 * terminal-query-handlers.test.ts):
 *   - tower: discover → tools/list → bat_whoami is its capability → reads its Worker (masked)
 *   - worker: its tower's output → isError NOT_OWNER; its tower's state → ok
 *   - parallel calls share one connection; a pending bat_wait does not hold up the others
 *   - the shim answers the server's heartbeat pings: a wait across many of them survives
 *   - an unknown token → AUTH_FAILED; a channel this BAT lacks → UNSUPPORTED
 *   - bat-scripts.log: one tool-call line per call, never the token or the output
 */
import { spawn, type ChildProcessWithoutNullStreams } from 'child_process'
import * as fs from 'fs'
import { createRequire } from 'module'
import * as os from 'os'
import * as path from 'path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => {
  throw new Error('terminal-query-handlers / pty-manager must not import electron')
})
vi.mock('../remote/remote-logger', () => ({
  mirrorToBatScripts: () => {},
  pickWhitelistedEnv: () => ({}),
}))

import { logger } from '../logger'
import type { PtyManager as PtyManagerType } from '../pty-manager'
import { registerHandler } from '../remote/handler-registry'
import { HelperCapabilityRegistry } from '../remote/helper-capability'
import { RemoteServer } from '../remote/remote-server'
import { registerTerminalQueryHandlers, type TerminalQueryHandlers } from '../terminal-query-handlers'

const SHIM = path.resolve(__dirname, '..', '..', 'scripts', 'bat-mcp.mjs')
const SERVER_TOKEN = 'm'.repeat(32)
const MODERN = { _meta: { 'io.modelcontextprotocol/protocolVersion': '2026-07-28' } }

class FakePty {
  onData = vi.fn()
  onExit = vi.fn()
  kill = vi.fn()
  write = vi.fn()
  resize = vi.fn()
  pid = 0
}
const ptySpawn = vi.fn((_shell: string, _args: string[], _opts: unknown) => new FakePty())
let PtyManager: typeof PtyManagerType

/** A shim process and a JSON-RPC client on its stdio. */
class ShimClient {
  private buffer = ''
  private seq = 0
  private waiting = new Map<number | string, (msg: Record<string, unknown>) => void>()
  readonly stderr: string[] = []

  constructor(readonly child: ChildProcessWithoutNullStreams) {
    child.stdout.setEncoding('utf8')
    child.stdout.on('data', (chunk: string) => {
      this.buffer += chunk
      let nl: number
      while ((nl = this.buffer.indexOf('\n')) !== -1) {
        const line = this.buffer.slice(0, nl)
        this.buffer = this.buffer.slice(nl + 1)
        const msg = JSON.parse(line) as Record<string, unknown>
        this.waiting.get(msg.id as number)?.(msg)
        this.waiting.delete(msg.id as number)
      }
    })
    child.stderr.on('data', d => this.stderr.push(String(d)))
  }

  request(method: string, params: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
    const id = ++this.seq
    const reply = new Promise<Record<string, unknown>>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`no reply to ${method} #${id}`)), 20_000)
      this.waiting.set(id, msg => { clearTimeout(timer); resolve(msg) })
    })
    this.child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params: { ...MODERN, ...params } })}\n`)
    return reply
  }

  async tool(name: string, args: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
    const msg = await this.request('tools/call', { name, arguments: args })
    if (msg.error) throw new Error(`JSON-RPC error: ${JSON.stringify(msg.error)}`)
    return msg.result as Record<string, unknown>
  }

  end(): Promise<number | null> {
    this.child.stdin.end()
    return new Promise(resolve => this.child.once('exit', code => resolve(code)))
  }
}

describe('bat-mcp.mjs ↔ RemoteServer + capabilities (T0584)', () => {
  let dir: string
  let logDir: string
  let manager: PtyManagerType
  let registry: HelperCapabilityRegistry
  let server: RemoteServer
  let port: number
  let queries: TerminalQueryHandlers
  const fakes = new Map<string, FakePty>()
  const clients: ShimClient[] = []
  const issued: string[] = []

  function output(id: string, data: string) {
    ;(fakes.get(id)!.onData.mock.calls[0][0] as (d: string) => void)(data)
    ;(manager as unknown as { flushPtyOutputs(): void }).flushPtyOutputs()
  }

  function shim(token: string): ShimClient {
    const env: NodeJS.ProcessEnv = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.toUpperCase().startsWith('BAT_')))
    const child = spawn(process.execPath, [SHIM], {
      env: {
        ...env,
        BAT_REMOTE_PORT: String(port),
        BAT_REMOTE_TOKEN: token,
        BAT_SERVER_CERT_PATH: path.join(dir, 'server-cert.json'),
        BAT_HELPER_LOG_DIR: logDir,
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    const client = new ShimClient(child)
    clients.push(client)
    return client
  }

  const capability = (id: string, towerId?: string) => {
    const token = registry.issue(id, towerId ? { towerId } : {})
    issued.push(token)
    return token
  }

  beforeAll(async () => {
    vi.spyOn(logger, 'log').mockImplementation(() => {})
    vi.spyOn(logger, 'warn').mockImplementation(() => {})
    vi.spyOn(logger, 'error').mockImplementation(() => {})
    const req = createRequire(path.resolve(__dirname, '..', 'pty-manager.ts'))
    const resolved = req.resolve('@lydell/node-pty')
    req.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports: { spawn: ptySpawn } } as unknown as NodeJS.Module
    ;({ PtyManager } = await import('../pty-manager'))

    dir = fs.mkdtempSync(path.join(os.tmpdir(), 't0584-rs-'))
    logDir = path.join(dir, 'Logs')
    registry = new HelperCapabilityRegistry()
    manager = new PtyManager({
      emit: () => {},
      dataDir: dir,
      helperEnv: (id, customEnv) => { registry.issue(id, { towerId: customEnv.BAT_TOWER_TERMINAL_ID || undefined }); return {} },
      onPtyExit: id => { registry.revokeTerminal(id) },
    })
    const create = (id: string, towerId?: string) => {
      const before = ptySpawn.mock.results.length
      manager.create({ id, cwd: os.tmpdir(), type: 'terminal', shell: '/bin/sh', workspaceId: 'ws', ...(towerId ? { customEnv: { BAT_TOWER_TERMINAL_ID: towerId } } : {}) })
      fakes.set(id, ptySpawn.mock.results[before].value as FakePty)
    }
    create('mcp-tower')
    create('mcp-worker', 'mcp-tower')
    manager.setTerminalRole('mcp-tower', 'tower')
    queries = registerTerminalQueryHandlers({
      registerHandler,
      getPtyManager: () => manager,
      isWorkerOf: (c, t) => registry.isWorkerOf(c, t),
      knownSecrets: () => [SERVER_TOKEN],
      logger: { log: () => {} },
    })
    server = new RemoteServer({
      logger: { log: () => {}, warn: () => {}, error: () => {} },
      helperCapabilities: registry,
      isTerminalAlive: id => manager.isAlive(id),
      getPtyCapacity: () => manager.getCapacity(),
      heartbeatIntervalMs: 200, // many pings during one bat_wait: the shim must answer them
    })
    server.configDir = dir
    port = (await server.start(0, SERVER_TOKEN, 'localhost')).port
  })

  afterAll(async () => {
    for (const client of clients) client.child.kill()
    queries?.dispose()
    server?.stop()
    manager?.dispose()
    vi.restoreAllMocks()
    if (dir) fs.rmSync(dir, { recursive: true, force: true })
  })

  it('tower: discover → tools/list → whoami (its capability) → reads its Worker masked', async () => {
    const c = shim(capability('mcp-tower'))
    const discover = await c.request('server/discover')
    expect(discover.result).toMatchObject({ resultType: 'complete', supportedVersions: expect.arrayContaining(['2026-07-28']) })
    const list = (await c.request('tools/list')).result as { tools: Array<{ name: string }> }
    expect(list.tools.map(t => t.name)).toContain('bat_read_output')

    const me = await c.tool('bat_whoami')
    expect(me.structuredContent).toMatchObject({ terminalId: 'mcp-tower', role: 'tower', workspaceId: 'ws' })
    expect(me.structuredContent).not.toHaveProperty('ok')

    output('mcp-worker', `building...\r\nBAT_REMOTE_TOKEN=${SERVER_TOKEN}\r\n`)
    const read = await c.tool('bat_read_output', { terminalId: 'mcp-worker' })
    expect(read.isError).toBeUndefined()
    expect(read.structuredContent).toMatchObject({ terminalId: 'mcp-worker', lines: ['building...', 'BAT_REMOTE_TOKEN=[REDACTED:server-token]'], masked: 1 })
    expect((read.content as Array<{ text: string }>)[0].text).toContain('building...')

    const mine = await c.tool('bat_list_terminals')
    expect((mine.structuredContent as { terminals: Array<{ id: string }> }).terminals.map(t => t.id).sort()).toEqual(['mcp-tower', 'mcp-worker'])
    expect(await c.end()).toBe(0)
  })

  it('worker: reading its tower → isError NOT_OWNER; its tower’s state → ok', async () => {
    const c = shim(capability('mcp-worker', 'mcp-tower'))
    const denied = await c.tool('bat_read_output', { terminalId: 'mcp-tower' })
    expect(denied).toMatchObject({ isError: true, structuredContent: { code: 'NOT_OWNER' } })
    const state = await c.tool('bat_get_state', { terminalId: 'mcp-tower' })
    expect(state.structuredContent).toMatchObject({ terminalId: 'mcp-tower' })
    await c.end()
  })

  it('parallel calls share one connection; a pending wait does not hold up a whoami; pings answered', async () => {
    const c = shim(capability('mcp-tower'))
    const helpers = () => (server as unknown as { helpers: Map<unknown, unknown> }).helpers.size
    const before = helpers()
    const started = Date.now()
    // 1.5 s across ~7 heartbeats (200 ms): a shim that ignored pings is terminated after two
    const waits = [1, 2, 3].map(() => c.tool('bat_wait', { terminalId: 'mcp-worker', until: 'exit', timeoutMs: 1500 }))
    const me = await c.tool('bat_whoami')
    expect(me.structuredContent).toMatchObject({ terminalId: 'mcp-tower' })
    expect(Date.now() - started).toBeLessThan(1000)
    expect(helpers() - before).toBe(1)
    for (const waited of await Promise.all(waits)) {
      expect(waited.isError, JSON.stringify(waited)).toBeUndefined()
      expect(waited.structuredContent).toMatchObject({ changed: false })
    }
    await c.end()
  })

  it('an unknown token → AUTH_FAILED; a channel this BAT does not serve → UNSUPPORTED', async () => {
    const bad = shim('batcap.not-a-real-capability')
    expect(await bad.tool('bat_whoami')).toMatchObject({ isError: true, structuredContent: { code: 'AUTH_FAILED' } })
    await bad.end()
    const c = shim(capability('mcp-tower'))
    // no worktree:terminal-status handler on this server (T0585 is not wired here)
    expect(await c.tool('bat_worktree_status', { terminalId: 'mcp-worker' })).toMatchObject({ isError: true, structuredContent: { code: 'UNSUPPORTED' } })
    expect(await c.tool('bat_worktree_status')).toMatchObject({ isError: true, structuredContent: { code: 'UNSUPPORTED' } })
    await c.end()
  })

  it('bat-scripts.log: tool-call lines without tokens or output', () => {
    const log = fs.readFileSync(path.join(logDir, 'bat-scripts.log'), 'utf8')
    const calls = log.trim().split('\n').map(l => JSON.parse(l)).filter(e => e.script === 'bat-mcp' && e.event === 'tool-call')
    expect(calls.length).toBeGreaterThanOrEqual(10)
    expect(calls.find(e => e.tool === 'bat_read_output' && e.ok === true)).toMatchObject({ era: 'modern', durationMs: expect.any(Number) })
    expect(calls.find(e => e.code === 'NOT_OWNER')).toMatchObject({ tool: 'bat_read_output', ok: false })
    expect(log).not.toContain('building...')
    expect(log).not.toContain(SERVER_TOKEN)
    for (const token of issued) expect(log).not.toContain(token)
  })
})
