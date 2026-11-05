// @vitest-environment node
/**
 * PLAN-065 W1 / T0857: Terminal Server protocol v1.
 *
 * A — negotiation (`negotiateProtocol`, `HelloReader`)
 * B — a real TerminalServer on 127.0.0.1 (temp userData): hello / token, unauthenticated first
 *     request → error + close, no broadcasts before the hello, no common protocol (shutdown only),
 *     unknown request → error, token file
 * C — `server:extendIdle` (D7): cap, once, restored by a hello, idle 0
 * D — the client against a fake server before v1 (no hello: protocol 0) and a silent one (timeout)
 * E — PtyManager in TCP mode: hello, heartbeat liveness from the pid file (T0856 Q3), TCP close
 * F — the token never reaches an env, a log or a command line
 *
 * Nothing here signals a real process (PtyManager's `serverWatchdog` is mocked) or spawns a PTY.
 * vitest runs tests in a forked worker (`process.connected`): the server's IPC path is stubbed
 * wherever a test would make it send to the runner.
 */
import * as fs from 'fs'
import * as net from 'net'
import * as os from 'os'
import * as path from 'path'
import type { ChildProcess } from 'child_process'
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'

vi.mock('electron', () => {
  throw new Error('pty-manager must not import electron (PLAN-036 T0389)')
})

import {
  HELLO_TIMEOUT_MS,
  HelloReader,
  MAX_IDLE_EXTENSION_MS,
  TERMINAL_SERVER_PROTOCOL_MAX,
  TERMINAL_SERVER_PROTOCOL_MIN,
  createLineParser,
  helloOpeningLines,
  negotiateProtocol,
  openHelloConnection,
  shutdownLines,
  type ServerRequest,
  type ServerResponse,
} from '../terminal-server/protocol'
import { TerminalServer, SERVER_HELLO_TIMEOUT_MS, buildServerPtyEnv, tokensMatch } from '../terminal-server/server'
import { getTokenFilePath, readPortFile, readTokenFile, removeTokenFile, writePidFile, writeTokenFile } from '../terminal-server/pid-manager'
import { PtyManager, type PtyManagerDeps, type ServerWatchdogDeps } from '../pty-manager'
import { logger } from '../logger'

const TOKEN = 'T0857-test-token-0123456789abcdefghijklmnopqrstuv'
const flush = (ms = 0) => new Promise<void>(r => setTimeout(r, ms))

async function until(check: () => boolean, timeoutMs = 3000): Promise<void> {
  const start = Date.now()
  while (!check()) {
    if (Date.now() - start > timeoutMs) throw new Error('until: timed out')
    await flush(10)
  }
}

/** A raw client: what it received, and whether the server closed it. */
function rawClient(port: number) {
  const socket = new net.Socket()
  const received: ServerResponse[] = []
  let closed = false
  socket.on('data', createLineParser(msg => received.push(msg as ServerResponse)))
  socket.on('close', () => { closed = true })
  socket.on('error', () => { /* closed below */ })
  const ready = new Promise<void>(r => socket.connect(port, '127.0.0.1', () => r()))
  return {
    socket,
    received,
    get closed() { return closed },
    ready,
    send(...msgs: unknown[]) { socket.write(msgs.map(m => JSON.stringify(m) + '\n').join('')) },
    hello(token = TOKEN, min = TERMINAL_SERVER_PROTOCOL_MIN, max = TERMINAL_SERVER_PROTOCOL_MAX) {
      return { type: 'server:hello', protocolMin: min, protocolMax: max, token }
    },
  }
}

// ── A ────────────────────────────────────────────────────────────────────────

describe('A: negotiation', () => {
  it('picks the highest version both ranges contain', () => {
    expect(negotiateProtocol({ min: 1, max: 1 }, { min: 1, max: 1 })).toBe(1)
    expect(negotiateProtocol({ min: 1, max: 3 }, { min: 2, max: 5 })).toBe(3)
    expect(negotiateProtocol({ min: 1, max: 3 }, { min: 0, max: 2 })).toBe(2)
  })

  it('no common version, or a malformed range → null', () => {
    expect(negotiateProtocol({ min: 1, max: 1 }, { min: 2, max: 4 })).toBeNull()
    expect(negotiateProtocol({ min: 2, max: 3 }, { min: 0, max: 1 })).toBeNull()
    expect(negotiateProtocol({ min: 1, max: 1 }, { min: 'x', max: 1 })).toBeNull()
    expect(negotiateProtocol({ min: 1, max: 1 }, { min: 1.5, max: 2 })).toBeNull()
    expect(negotiateProtocol({ min: 1, max: 1 }, { min: undefined, max: undefined })).toBeNull()
  })

  it('HelloReader: hello-ok → v1; pong first → protocol 0; errors → refused / incompatible', () => {
    const ok = { type: 'server:hello-ok', protocol: 1, batVersion: 'x', runtime: { name: 'node', version: 'v1' }, pid: 7 } as const
    expect(new HelloReader().feed(ok)).toEqual({ ok: true, protocol: 1, hello: ok })
    expect(new HelloReader().feed({ type: 'server:pong' })).toEqual({ ok: true, protocol: 0, hello: null })
    expect(new HelloReader().feed({ type: 'error', requestType: 'server:hello', message: '', code: 'UNAUTHENTICATED' }))
      .toEqual({ ok: false, reason: 'unauthenticated' })
    expect(new HelloReader().feed({ type: 'error', requestType: 'server:hello', message: '', code: 'NO_COMMON_PROTOCOL' }))
      .toEqual({ ok: false, reason: 'incompatible' })
    // a server that "picked" a protocol we do not speak
    expect(new HelloReader().feed({ ...ok, protocol: 9 })).toEqual({ ok: false, reason: 'incompatible' })
  })

  it('HelloReader keeps what is not part of the hello, in order', () => {
    const reader = new HelloReader()
    expect(reader.feed({ type: 'pty:data', id: 'a', data: '1' })).toBeNull()
    expect(reader.feed({ type: 'pty:data', id: 'a', data: '2' })).toBeNull()
    expect(reader.feed({ type: 'server:pong' })).toMatchObject({ ok: true, protocol: 0 })
    reader.feed({ type: 'pty:data', id: 'a', data: '3' })
    expect(reader.held.map(m => (m as { data: string }).data)).toEqual(['1', '2', '3'])
  })

  it('the opening lines are hello then ping; shutdown lines are hello then shutdown', () => {
    const open = helloOpeningLines(TOKEN).trim().split('\n').map(l => JSON.parse(l))
    expect(open).toEqual([
      { type: 'server:hello', protocolMin: TERMINAL_SERVER_PROTOCOL_MIN, protocolMax: TERMINAL_SERVER_PROTOCOL_MAX, token: TOKEN },
      { type: 'server:ping' },
    ])
    expect(shutdownLines(null).trim().split('\n').map(l => JSON.parse(l).type)).toEqual(['server:hello', 'server:shutdown'])
    expect(JSON.parse(shutdownLines(null).split('\n')[0]).token).toBe('')
  })

  it('HELLO_TIMEOUT_MS is the 3 s the probe / reconnect waited before v1', () => {
    expect(HELLO_TIMEOUT_MS).toBe(3_000)
  })
})

// ── B ────────────────────────────────────────────────────────────────────────

describe('B: a real TerminalServer over TCP', () => {
  let dir: string
  let server: TerminalServer
  let exit: ReturnType<typeof vi.fn<(code: number) => void>>
  let port: number

  beforeEach(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 't0857-srv-'))
    exit = vi.fn<(code: number) => void>()
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    server = new TerminalServer(30 * 60_000, 100, { exit, identity: { batVersion: '9.9.9' }, generateToken: () => TOKEN, platform: 'linux' })
    server.startTcpServer(dir)
    await until(() => readPortFile(dir) !== null)
    port = readPortFile(dir)!
  })

  afterEach(async () => {
    server.shutdown()
    await flush(20)
    vi.restoreAllMocks()
    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('hello with the token → hello-ok (protocol, BAT version, runtime, pid), then the session works', async () => {
    const c = rawClient(port)
    await c.ready
    c.send(c.hello(), { type: 'server:ping' }, { type: 'pty:list' })
    await until(() => c.received.length >= 3)
    expect(c.received[0]).toEqual({
      type: 'server:hello-ok',
      protocol: 1,
      batVersion: '9.9.9',
      runtime: { name: process.versions.electron ? 'electron' : 'node', version: process.version },
      pid: process.pid,
    })
    expect(c.received.slice(1)).toEqual([{ type: 'server:pong' }, { type: 'pty:list', ptys: [] }])
    expect(c.closed).toBe(false)
    c.socket.destroy()
  })

  it('openHelloConnection: right token → v1; wrong / missing token → unauthenticated', async () => {
    const good = await openHelloConnection(port, TOKEN, { keepOpen: true })
    expect(good.result).toMatchObject({ ok: true, protocol: 1 })
    expect(good.socket).not.toBeNull()
    good.socket!.destroy()
    expect((await openHelloConnection(port, 'wrong')).result).toEqual({ ok: false, reason: 'unauthenticated' })
    expect((await openHelloConnection(port, null)).result).toEqual({ ok: false, reason: 'unauthenticated' })
  })

  it('an unauthenticated first request (an old main: pty:list) → error and the socket closes; nothing after it runs', async () => {
    const c = rawClient(port)
    await c.ready
    c.send({ type: 'pty:list' }, { type: 'server:shutdown' })
    await until(() => c.closed)
    expect(c.received).toEqual([{ type: 'error', requestType: 'pty:list', message: expect.any(String), code: 'UNAUTHENTICATED' }])
    await flush(20)
    expect(exit).not.toHaveBeenCalled()
  })

  it('a hello with a wrong token → error and close; malformed JSON first → close', async () => {
    const c = rawClient(port)
    await c.ready
    c.send(c.hello('nope'), { type: 'server:shutdown' })
    await until(() => c.closed)
    expect(c.received).toEqual([expect.objectContaining({ type: 'error', requestType: 'server:hello', code: 'UNAUTHENTICATED' })])
    const d = rawClient(port)
    await d.ready
    d.socket.write('{not json\n')
    await until(() => d.closed)
    expect(d.received[0]).toMatchObject({ type: 'error', code: 'UNAUTHENTICATED' })
    expect(exit).not.toHaveBeenCalled()
  })

  it('a connection that never says hello is closed after SERVER_HELLO_TIMEOUT_MS', async () => {
    expect(SERVER_HELLO_TIMEOUT_MS).toBe(10_000)
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    try {
      const c = rawClient(port)
      await c.ready
      await vi.waitUntil(() => (server as unknown as { tcpStates: Map<unknown, unknown> }).tcpStates.size === 1, { timeout: 2000 })
      vi.advanceTimersByTime(SERVER_HELLO_TIMEOUT_MS)
      vi.useRealTimers()
      await until(() => c.closed)
    } finally {
      vi.useRealTimers()
    }
  })

  it('broadcasts (PTY output) reach authenticated clients only', async () => {
    if (process.send) vi.spyOn(process as unknown as { send: (m: unknown) => boolean }, 'send').mockImplementation(() => true)
    const pending = rawClient(port)
    const client = rawClient(port)
    await Promise.all([pending.ready, client.ready])
    client.send(client.hello())
    await until(() => client.received.length === 1)
    ;(server as unknown as { broadcastToAll(msg: ServerResponse): void }).broadcastToAll({ type: 'pty:data', id: 'x', data: 'secret output' })
    await until(() => client.received.length === 2)
    await flush(50)
    expect(client.received[1]).toEqual({ type: 'pty:data', id: 'x', data: 'secret output' })
    expect(pending.received).toEqual([])
    pending.socket.destroy()
    client.socket.destroy()
  })

  it('right token, no common protocol → NO_COMMON_PROTOCOL with the server range; only ping / shutdown afterwards', async () => {
    const c = rawClient(port)
    await c.ready
    c.send(c.hello(TOKEN, 5, 7), { type: 'server:ping' }, { type: 'pty:list' })
    await until(() => c.closed)
    expect(c.received).toEqual([
      { type: 'error', requestType: 'server:hello', message: expect.any(String), code: 'NO_COMMON_PROTOCOL', protocolMin: 1, protocolMax: 1 },
      { type: 'server:pong' },
      expect.objectContaining({ type: 'error', requestType: 'pty:list', code: 'NOT_ALLOWED' }),
    ])
    expect(exit).not.toHaveBeenCalled()

    // …but it can still be shut down (D5: a client can always end a server it cannot use)
    const d = rawClient(port)
    await d.ready
    d.send(d.hello(TOKEN, 5, 7), { type: 'server:shutdown' })
    await until(() => exit.mock.calls.length > 0)
    expect(exit).toHaveBeenCalledWith(0)
  })

  it('shutdownLines with the token shut the server down; without it they do not', async () => {
    const bad = rawClient(port)
    await bad.ready
    bad.socket.write(shutdownLines('wrong'))
    await until(() => bad.closed)
    expect(exit).not.toHaveBeenCalled()
    const good = rawClient(port)
    await good.ready
    good.socket.write(shutdownLines(readTokenFile(dir)))
    await until(() => exit.mock.calls.length > 0)
    // shutdown removes the token file with the pid / port files
    await until(() => !fs.existsSync(getTokenFilePath(dir)))
  })

  it('an unknown request → error UNKNOWN_REQUEST, and the connection stays usable', async () => {
    const c = rawClient(port)
    await c.ready
    c.send(c.hello(), { type: 'server:frobnicate' }, 42, { type: 'server:ping' })
    await until(() => c.received.length >= 4)
    expect(c.received[1]).toEqual({ type: 'error', requestType: 'server:frobnicate', message: 'unknown request', code: 'UNKNOWN_REQUEST' })
    expect(c.received[2]).toMatchObject({ type: 'error', code: 'BAD_REQUEST' })
    expect(c.received[3]).toEqual({ type: 'server:pong' })
    expect(c.closed).toBe(false)
    c.socket.destroy()
  })

  it('the token file: the token, 0600 on POSIX, written before the port file', () => {
    expect(readTokenFile(dir)).toBe(TOKEN)
    if (process.platform !== 'win32') {
      expect(fs.statSync(getTokenFilePath(dir)).mode & 0o777).toBe(0o600)
    }
    expect(fs.readdirSync(dir).filter(f => f.endsWith('.tmp'))).toEqual([])
  })
})

describe('B: unknown request over IPC, token helpers', () => {
  afterEach(() => vi.restoreAllMocks())

  it('the fork IPC parent gets error UNKNOWN_REQUEST too, and a hello without a token', () => {
    const server = new TerminalServer(0, 100, { identity: { batVersion: '1.2.3' } })
    const sent: ServerResponse[] = []
    vi.spyOn(server as unknown as { sendToClient(m: ServerResponse): void }, 'sendToClient').mockImplementation((m) => { sent.push(m) })
    server.handleMessage({ type: 'server:nope' } as unknown as ServerRequest, 'ipc')
    server.handleMessage({ type: 'server:hello', protocolMin: 0, protocolMax: 9, token: '' }, 'ipc')
    server.handleMessage({ type: 'server:hello', protocolMin: 4, protocolMax: 9, token: '' }, 'ipc')
    expect(sent[0]).toEqual({ type: 'error', requestType: 'server:nope', message: 'unknown request', code: 'UNKNOWN_REQUEST' })
    expect(sent[1]).toMatchObject({ type: 'server:hello-ok', protocol: 1, batVersion: '1.2.3' })
    expect(sent[2]).toMatchObject({ type: 'error', code: 'NO_COMMON_PROTOCOL' })
  })

  it('tokensMatch: exact match only', () => {
    expect(tokensMatch(TOKEN, TOKEN)).toBe(true)
    expect(tokensMatch(TOKEN + 'x', TOKEN)).toBe(false)
    expect(tokensMatch('', TOKEN)).toBe(false)
    expect(tokensMatch(undefined, TOKEN)).toBe(false)
    expect(tokensMatch('', '')).toBe(false)
  })

  it('a rewrite of the token file replaces it; remove; missing → null', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 't0857-tok-'))
    try {
      writeTokenFile('a', dir)
      writeTokenFile('b', dir)
      expect(readTokenFile(dir)).toBe('b')
      removeTokenFile(dir)
      expect(readTokenFile(dir)).toBeNull()
      removeTokenFile(dir) // no throw
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })
})

// ── C ────────────────────────────────────────────────────────────────────────

describe('C: server:extendIdle (D7)', () => {
  const CONFIGURED = 30 * 60_000
  let server: TerminalServer
  let sent: ServerResponse[]
  let exit: ReturnType<typeof vi.fn<(code: number) => void>>

  function extend(durationMs: unknown) {
    server.handleMessage({ type: 'server:extendIdle', durationMs } as ServerRequest, 'ipc')
    return sent[sent.length - 1]
  }

  beforeEach(() => {
    exit = vi.fn<(code: number) => void>()
    server = new TerminalServer(CONFIGURED, 100, { exit, platform: 'linux' })
    sent = []
    vi.spyOn(server as unknown as { sendToClient(m: ServerResponse): void }, 'sendToClient').mockImplementation((m) => { sent.push(m) })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('capped at 24 h, never below the configured timeout', () => {
    expect(MAX_IDLE_EXTENSION_MS).toBe(24 * 60 * 60 * 1000)
    expect(extend(48 * 3600_000)).toEqual({ type: 'server:idle-extended', idleTimeoutMs: MAX_IDLE_EXTENSION_MS, configuredIdleTimeoutMs: CONFIGURED })
    expect(server.effectiveIdleTimeoutMs).toBe(MAX_IDLE_EXTENSION_MS)
    const other = new TerminalServer(CONFIGURED, 100)
    const out: ServerResponse[] = []
    vi.spyOn(other as unknown as { sendToClient(m: ServerResponse): void }, 'sendToClient').mockImplementation((m) => { out.push(m) })
    other.handleMessage({ type: 'server:extendIdle', durationMs: 1000 }, 'ipc')
    expect(out[0]).toMatchObject({ idleTimeoutMs: CONFIGURED })
  })

  it('only once: a second request → ALREADY_EXTENDED, the first stays', () => {
    extend(2 * 3600_000)
    expect(extend(24 * 3600_000)).toMatchObject({ type: 'error', code: 'ALREADY_EXTENDED' })
    expect(server.effectiveIdleTimeoutMs).toBe(2 * 3600_000)
  })

  it('bad durations → BAD_REQUEST, nothing changes', () => {
    for (const bad of [-1, 0, Number.NaN, 'x', undefined]) expect(extend(bad)).toMatchObject({ type: 'error', code: 'BAD_REQUEST' })
    expect(server.effectiveIdleTimeoutMs).toBe(CONFIGURED)
  })

  it('idle timeout 0 (never idle out) stays 0', () => {
    const forever = new TerminalServer(0, 100)
    const out: ServerResponse[] = []
    vi.spyOn(forever as unknown as { sendToClient(m: ServerResponse): void }, 'sendToClient').mockImplementation((m) => { out.push(m) })
    forever.handleMessage({ type: 'server:extendIdle', durationMs: 3600_000 }, 'ipc')
    expect(out[0]).toEqual({ type: 'server:idle-extended', idleTimeoutMs: 0, configuredIdleTimeoutMs: 0 })
    expect(forever.effectiveIdleTimeoutMs).toBe(0)
  })

  it('the idle countdown uses the extension', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    vi.spyOn(server as unknown as { shouldStartIdle(): boolean }, 'shouldStartIdle').mockReturnValue(true)
    extend(2 * 3600_000)
    server.startIdleTimer()
    vi.advanceTimersByTime(CONFIGURED + 1000)
    expect(exit).not.toHaveBeenCalled()
    expect((server as unknown as { shuttingDown: boolean }).shuttingDown).toBe(false)
    vi.advanceTimersByTime(2 * 3600_000 - CONFIGURED)
    expect((server as unknown as { shuttingDown: boolean }).shuttingDown).toBe(true)
  })

  it('a client that says hello again restores the configured timeout (and may extend again)', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 't0857-idle-'))
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    const tcp = new TerminalServer(CONFIGURED, 100, { exit, generateToken: () => TOKEN, platform: 'linux' })
    try {
      tcp.startTcpServer(dir)
      await until(() => readPortFile(dir) !== null)
      const out: ServerResponse[] = []
      type Send = { sendToClient(m: ServerResponse, via: 'ipc' | 'tcp', s?: net.Socket): void }
      const original = (tcp as unknown as Send).sendToClient.bind(tcp)
      // only the IPC path is stubbed; TCP answers go through the real socket
      vi.spyOn(tcp as unknown as Send, 'sendToClient').mockImplementation((m, via, s) => {
        if (via === 'ipc') out.push(m)
        else original(m, via, s)
      })
      tcp.handleMessage({ type: 'server:extendIdle', durationMs: 24 * 3600_000 }, 'ipc')
      expect(tcp.effectiveIdleTimeoutMs).toBe(MAX_IDLE_EXTENSION_MS)
      const conn = await openHelloConnection(readPortFile(dir)!, TOKEN)
      expect(conn.result).toMatchObject({ ok: true, protocol: 1 })
      expect(tcp.effectiveIdleTimeoutMs).toBe(CONFIGURED)
      tcp.handleMessage({ type: 'server:extendIdle', durationMs: 3600_000 }, 'ipc')
      expect(out[out.length - 1]).toMatchObject({ type: 'server:idle-extended', idleTimeoutMs: 3600_000 })
      // a refused connection does not restore it
      await openHelloConnection(readPortFile(dir)!, 'wrong')
      expect(tcp.effectiveIdleTimeoutMs).toBe(3600_000)
    } finally {
      tcp.shutdown()
      await flush(20)
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })
})

// ── D / E: fake servers ──────────────────────────────────────────────────────

type FakeMode = 'v1' | 'legacy' | 'silent'

/** A Terminal Server stand-in: v1 (hello-ok), legacy (before T0857: ignores hello, broadcasts at once), silent. */
class FakeTcpServer {
  autoPong = true
  /** T0867: pongs written so far (the E tests wait until the manager has handled each one). */
  pongsWritten = 0
  readonly received: ServerRequest[] = []
  readonly sockets = new Set<net.Socket>()
  private server: net.Server
  port = 0
  constructor(readonly mode: FakeMode, readonly pid = 4242) {
    this.server = net.createServer((socket) => {
      this.sockets.add(socket)
      socket.on('close', () => this.sockets.delete(socket))
      socket.on('error', () => {})
      if (mode === 'legacy') this.write(socket, { type: 'pty:data', id: 'old', data: 'early output' })
      socket.on('data', createLineParser((raw) => {
        const msg = raw as ServerRequest
        this.received.push(msg)
        if (mode === 'silent') return
        if (msg.type === 'server:hello' && mode === 'v1') {
          this.write(socket, { type: 'server:hello-ok', protocol: 1, batVersion: '0.7.5', runtime: { name: 'node', version: 'v24.0.0' }, pid: this.pid })
        }
        if (msg.type === 'server:ping' && this.autoPong) { this.pongsWritten++; this.write(socket, { type: 'server:pong' }) }
        if (msg.type === 'pty:list') this.write(socket, { type: 'pty:list', ptys: [] })
      }))
    })
  }
  write(socket: net.Socket, msg: ServerResponse) { if (!socket.destroyed) socket.write(JSON.stringify(msg) + '\n') }
  listen(): Promise<number> {
    return new Promise(r => this.server.listen(0, '127.0.0.1', () => { this.port = (this.server.address() as net.AddressInfo).port; r(this.port) }))
  }
  dropAll() { for (const s of this.sockets) s.destroy() }
  close(): Promise<void> {
    this.dropAll()
    return new Promise(r => this.server.close(() => r()))
  }
}

describe('D: the client against a server before v1 and a silent one', () => {
  const servers: FakeTcpServer[] = []
  afterEach(async () => { await Promise.all(servers.splice(0).map(s => s.close())) })

  it('a server before v1 (no hello-ok, pong) → protocol 0 at its pong; its early output is kept', async () => {
    const legacy = new FakeTcpServer('legacy')
    servers.push(legacy)
    const port = await legacy.listen()
    const started = Date.now()
    const conn = await openHelloConnection(port, TOKEN)
    expect(conn.result).toEqual({ ok: true, protocol: 0, hello: null })
    expect(Date.now() - started).toBeLessThan(HELLO_TIMEOUT_MS) // the pong decides, not a timeout
    expect(conn.held).toEqual([{ type: 'pty:data', id: 'old', data: 'early output' }])
  })

  it('a server that answers nothing → timeout', async () => {
    const silent = new FakeTcpServer('silent')
    servers.push(silent)
    const port = await silent.listen()
    expect((await openHelloConnection(port, TOKEN, { timeoutMs: 200 })).result).toEqual({ ok: false, reason: 'timeout' })
  })

  it('nothing listening → closed', async () => {
    const gone = new FakeTcpServer('v1')
    const port = await gone.listen()
    await gone.close()
    expect((await openHelloConnection(port, TOKEN)).result).toEqual({ ok: false, reason: 'closed' })
  })
})

describe('E: PtyManager in TCP mode', () => {
  const INTERVAL = 10_000
  let dataDir: string
  let mono: number
  let alive: Set<number>
  let watchdog: ServerWatchdogDeps
  let emit: ReturnType<typeof vi.fn<PtyManagerDeps['emit']>>
  let manager: PtyManager
  let refork: ReturnType<typeof vi.fn<() => Promise<ChildProcess | null>>>
  let logs: string[]
  let fake: FakeTcpServer

  const logged = (text: string) => logs.some(l => l.includes(text))
  const statuses = () => emit.mock.calls.filter(([c]) => c === 'terminal-server:status').map(([, s]) => s)

  let sendSpy: MockInstance<(msg: ServerRequest) => void>
  let pongSpy: MockInstance<() => void>
  /** the ping openHelloConnection sends with the hello (not through sendToServer) */
  const OPENING_PINGS = helloOpeningLines(TOKEN).trim().split('\n').filter(l => JSON.parse(l).type === 'server:ping').length
  const heartbeatPingsSent = () => sendSpy.mock.calls.filter(([m]) => m.type === 'server:ping').length
  const pingsReceived = () => fake.received.filter(m => m.type === 'server:ping').length

  /**
   * T0867: wait (real setTimeout, not the faked setInterval) until every ping the heartbeat sent has
   * reached the fake server and every pong the fake server wrote has been handled by the manager.
   * Before T0867 a fixed `flush(20)` after all the ticks: on the Linux CI runner the socket I/O was
   * not done by then (2 of 12 pings received, the pong not yet handled).
   */
  async function settle() {
    await until(() => pingsReceived() === OPENING_PINGS + heartbeatPingsSent() && pongSpy.mock.calls.length === fake.pongsWritten)
  }

  /**
   * Advance the heartbeat interval and the fake monotonic clock together, one second at a time;
   * after each step the socket I/O it started is settled, so each ping (and its pong) lands before
   * the next tick, as it would 10 s apart in real time.
   */
  async function advance(ms: number) {
    for (let left = ms; left > 0; left -= 1000) {
      mono += Math.min(1000, left)
      vi.advanceTimersByTime(Math.min(1000, left))
      await settle()
    }
  }

  beforeEach(async () => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 't0857-pty-'))
    mono = 1_000_000
    alive = new Set([4242])
    logs = []
    const capture = (...args: unknown[]) => { logs.push(args.map(String).join(' ')) }
    vi.spyOn(logger, 'log').mockImplementation(capture)
    vi.spyOn(logger, 'warn').mockImplementation(capture)
    vi.spyOn(logger, 'error').mockImplementation(capture)
    watchdog = {
      now: () => mono,
      isProcessAlive: (pid) => alive.has(pid),
      killTree: vi.fn(async (pid: number) => { alive.delete(pid); return 'killed' as const }),
      kill: vi.fn((pid: number) => { if (!alive.delete(pid)) throw new Error('ESRCH') }),
      platform: 'linux',
    }
    emit = vi.fn<PtyManagerDeps['emit']>()
    manager = new PtyManager({ emit, dataDir, serverWatchdog: watchdog })
    // T0867: count what the heartbeat sends and what reaches handlePong (both call through)
    sendSpy = vi.spyOn(manager, 'sendToServer')
    pongSpy = vi.spyOn(manager as unknown as { handlePong(): void }, 'handlePong')
    refork = vi.fn(async () => null)
    manager.onRequestNewServer = refork
    fake = new FakeTcpServer('v1')
    await fake.listen()
    // the heartbeat interval is created by connectToServer: fake it before
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
  })

  afterEach(async () => {
    manager.beginShutdown()
    manager.dispose()
    vi.useRealTimers()
    await fake.close()
    vi.restoreAllMocks()
    fs.rmSync(dataDir, { recursive: true, force: true })
  })

  it('connects with hello + token; logs the protocol, never the token', async () => {
    const result = await manager.connectToServer(fake.port, TOKEN)
    expect(result).toMatchObject({ ok: true, protocol: 1, hello: { pid: 4242, batVersion: '0.7.5' } })
    expect(fake.received[0]).toEqual({ type: 'server:hello', protocolMin: 1, protocolMax: 1, token: TOKEN })
    expect(logged('TCP connected to Terminal Server on port')).toBe(true)
    expect(logged('protocol 1, BAT 0.7.5, runtime node v24.0.0, pid 4242')).toBe(true)
    expect(logs.some(l => l.includes(TOKEN))).toBe(false)
  })

  it('a server before v1 → protocol 0, its early output reaches the tab', async () => {
    const legacy = new FakeTcpServer('legacy')
    await legacy.listen()
    try {
      const result = await manager.connectToServer(legacy.port, TOKEN)
      expect(result).toEqual({ ok: true, protocol: 0, hello: null })
      expect(logged('protocol 0 (no hello: a server before T0857)')).toBe(true)
      // the held pty:data went through the normal output path (batched → ring buffer)
      const internals = manager as unknown as { replayBuffers: Map<string, { total: number }> ; outputBatches?: unknown }
      await until(() => (internals.replayBuffers.get('old')?.total ?? 0) > 0 || emit.mock.calls.some(([c, id]) => c === 'pty:output' && id === 'old'), 2000)
    } finally {
      manager.beginShutdown()
      await legacy.close()
    }
  })

  it('a refused hello → { ok: false, reason } and no TCP channel', async () => {
    const realServerDir = fs.mkdtempSync(path.join(os.tmpdir(), 't0857-real-'))
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    const real = new TerminalServer(0, 100, { exit: vi.fn<(code: number) => void>(), generateToken: () => TOKEN, platform: 'linux' })
    try {
      real.startTcpServer(realServerDir)
      vi.useRealTimers()
      await until(() => readPortFile(realServerDir) !== null)
      vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
      expect(await manager.connectToServer(readPortFile(realServerDir)!, 'wrong')).toEqual({ ok: false, reason: 'unauthenticated' })
      expect((manager as unknown as { useServer: boolean }).useServer).toBe(false)
    } finally {
      real.shutdown()
      fs.rmSync(realServerDir, { recursive: true, force: true })
    }
  })

  it('3 late ticks with the server process (pid file) alive and the socket open → no recovery, only `late pong`', async () => {
    writePidFile(4242, dataDir)
    await manager.connectToServer(fake.port, TOKEN)
    fake.autoPong = false
    await advance(12 * INTERVAL)
    expect(refork).not.toHaveBeenCalled()
    expect(statuses()).toEqual([])
    expect(logged('server process and TCP connection alive — no recovery')).toBe(true)
    // the pings went over TCP
    expect(fake.received.filter(m => m.type === 'server:ping').length).toBeGreaterThanOrEqual(12)
  })

  it('3 late ticks with the pid-file process gone → recovery (reason=heartbeat)', async () => {
    writePidFile(4343, dataDir) // the pid file wins over the hello-ok pid
    alive.add(4343)
    await manager.connectToServer(fake.port, TOKEN)
    fake.autoPong = false
    await advance(3 * INTERVAL)
    expect(statuses()).toEqual([])
    alive.delete(4343)
    await advance(INTERVAL)
    await until(() => statuses().includes('failed'), 2000)
    expect(logged('server process=gone tcp=connected — server dead')).toBe(true)
    expect(logged('attempting recovery... (reason=heartbeat)')).toBe(true)
    expect(refork).toHaveBeenCalledTimes(1)
  })

  it('no pid file → the hello-ok pid decides', async () => {
    await manager.connectToServer(fake.port, TOKEN)
    fake.autoPong = false
    await advance(4 * INTERVAL)
    expect(refork).not.toHaveBeenCalled() // 4242 (hello-ok) is alive
    alive.delete(4242)
    await advance(INTERVAL)
    await until(() => refork.mock.calls.length === 1, 2000)
  })

  it('a pong ends the late run; the TCP close still recovers at once', async () => {
    writePidFile(4242, dataDir)
    await manager.connectToServer(fake.port, TOKEN)
    fake.autoPong = false
    await advance(3 * INTERVAL)
    fake.autoPong = true
    await advance(INTERVAL)
    expect(logged('[heartbeat] late pong arrived after')).toBe(true)
    fake.dropAll()
    await until(() => refork.mock.calls.length === 1, 2000)
    expect(logged('attempting recovery... (reason=tcp-close)')).toBe(true)
  })
})

// ── F ────────────────────────────────────────────────────────────────────────

describe('F: the token stays between the server and the main process', () => {
  afterEach(() => vi.restoreAllMocks())

  it('starting the TCP server puts no token in process.env, a PTY env or the stderr log', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 't0857-env-'))
    const stderr: string[] = []
    vi.spyOn(process.stderr, 'write').mockImplementation((chunk: unknown) => { stderr.push(String(chunk)); return true })
    const server = new TerminalServer(0, 100, { exit: vi.fn<(code: number) => void>(), generateToken: () => TOKEN, platform: 'linux' })
    try {
      server.startTcpServer(dir)
      await until(() => readPortFile(dir) !== null)
      await openHelloConnection(readPortFile(dir)!, 'wrong')
      await openHelloConnection(readPortFile(dir)!, TOKEN)
      expect(Object.values(process.env).some(v => v?.includes(TOKEN))).toBe(false)
      expect(Object.values(buildServerPtyEnv(process.env, { A: 'b' })).some(v => v.includes(TOKEN))).toBe(false)
      expect(stderr.join('')).not.toContain(TOKEN)
    } finally {
      server.shutdown()
      await flush(20)
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  it('source guard: the token is read from its file only, never from / into an env or argv, never logged', () => {
    const read = (rel: string) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8')
    const main = read('main.ts')
    const fork = main.slice(main.indexOf('function forkTerminalServer('), main.indexOf('\n}\n', main.indexOf('function forkTerminalServer(')))
    expect(fork).not.toMatch(/token/i)
    expect(read('terminal-server.ts')).not.toMatch(/process\.env\.[A-Z_]*TOKEN/)
    expect(read('terminal-server/server.ts')).not.toMatch(/process\.env\.[A-Z_]*TOKEN/)
    // PtyManager's env builder and the server's PTY env never mention the Terminal Server token
    const pty = read('pty-manager.ts')
    const buildEnv = pty.slice(pty.indexOf('  private buildPtyEnv('), pty.indexOf('  /** Inject Terminal Server IPC reference'))
    expect(buildEnv).not.toMatch(/readTokenFile|bat-pty-server\.token/)
    // no log line interpolates a token variable
    for (const file of ['main.ts', 'pty-manager.ts', 'terminal-server/server.ts', 'terminal-server/protocol.ts', 'terminal-server.ts']) {
      const logs = read(file).split('\n').filter(l => /logger\.(log|warn|error)|stderr\.write/.test(l))
      expect(logs.filter(l => /\$\{\s*token\b|\$\{this\.token|, token\)/.test(l))).toEqual([])
    }
  })
})
