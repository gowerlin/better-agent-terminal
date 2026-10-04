// @vitest-environment node
/**
 * T0451 (T0445 #9): helper connection hygiene on a real RemoteServer (wss on loopback,
 * file certificate in a temp dir, raw `ws` helpers authenticating with capabilities).
 *
 *   - a denial log carries the helper's `channel` cut to 64 chars with control characters
 *     escaped (no forged log line); a non-string channel is denied and never logged
 *   - one capability holds at most 4 connections at a time; the 5th auth is refused
 *   - more than 30 denials within a minute terminate the connection; the capability is then
 *     refused (and nothing more logged) until the window ends
 *   - the heartbeat pings helpers and terminates one that did not answer (half-open)
 */
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import WebSocket from 'ws'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { HelperCapabilityRegistry } from '../helper-capability'
import {
  HELPER_DENIAL_THRESHOLD,
  HELPER_DENIAL_WINDOW_MS,
  HELPER_LOG_CHANNEL_MAX_CHARS,
  HELPER_MAX_CONNECTIONS_PER_CAPABILITY,
  RemoteServer,
  formatLogChannel,
  isHelperThrottled,
  recordHelperDenial,
  type AuthFailureEntry,
} from '../remote-server'
import type { RemoteFrame } from '../protocol'

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

interface Started {
  server: RemoteServer
  registry: HelperCapabilityRegistry
  port: number
  logs: string[]
}

let current: { server: RemoteServer; dir: string; sockets: WebSocket[] } | null = null

afterEach(() => {
  if (!current) return
  for (const ws of current.sockets) ws.terminate()
  current.server.stop()
  fs.rmSync(current.dir, { recursive: true, force: true })
  current = null
})

async function startServer(opts: { heartbeatIntervalMs?: number } = {}): Promise<Started> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bat-t0451-'))
  const logs: string[] = []
  const record = (...args: unknown[]) => { logs.push(args.map(String).join(' ')) }
  const registry = new HelperCapabilityRegistry()
  const server = new RemoteServer({
    logger: { log: record, warn: record, error: record },
    helperCapabilities: registry,
    isTerminalAlive: () => true,
    heartbeatIntervalMs: opts.heartbeatIntervalMs,
  })
  server.configDir = dir
  current = { server, dir, sockets: [] }
  const started = await server.start(0, 'a'.repeat(32), 'localhost')
  return { server, registry, port: started.port, logs }
}

interface Conn {
  ws: WebSocket
  frames: RemoteFrame[]
  closed: Promise<number>
  isClosed(): boolean
}

async function open(s: Started, wsOpts: WebSocket.ClientOptions = {}): Promise<Conn> {
  const ws = new WebSocket(`wss://127.0.0.1:${s.port}`, { rejectUnauthorized: false, ...wsOpts })
  current?.sockets.push(ws)
  const frames: RemoteFrame[] = []
  let closedFlag = false
  ws.on('error', () => {})
  ws.on('message', raw => {
    try { frames.push(JSON.parse(raw.toString())) } catch { /* ignore */ }
  })
  const closed = new Promise<number>(resolve => ws.once('close', code => { closedFlag = true; resolve(code) }))
  await new Promise<void>((resolve, reject) => {
    ws.once('open', () => resolve())
    ws.once('error', reject)
  })
  return { ws, frames, closed, isClosed: () => closedFlag }
}

async function waitForFrame(conn: Conn, id: string): Promise<RemoteFrame> {
  let found: RemoteFrame | undefined
  await vi.waitFor(() => {
    found = conn.frames.find(f => f.id === id)
    expect(found).toBeDefined()
  }, { timeout: 5_000, interval: 10 })
  return found!
}

/** Opens a connection and authenticates; resolves with the conn and the auth-result error (undefined = accepted). */
async function auth(s: Started, token: string, wsOpts?: WebSocket.ClientOptions): Promise<{ conn: Conn; error: string | undefined }> {
  const conn = await open(s, wsOpts)
  conn.ws.send(JSON.stringify({ type: 'auth', id: 'auth-1', token, args: ['T0451'] }))
  const result = await waitForFrame(conn, 'auth-1')
  return { conn, error: result.error }
}

async function authOk(s: Started, token: string, wsOpts?: WebSocket.ClientOptions): Promise<Conn> {
  const { conn, error } = await auth(s, token, wsOpts)
  expect(error).toBeUndefined()
  return conn
}

const invoke = (conn: Conn, id: string, channel: unknown, args: unknown = []) =>
  conn.ws.send(JSON.stringify({ type: 'invoke', id, channel, args }))

const deniedLines = (logs: string[]) => logs.filter(l => l.includes('Helper invoke denied'))

describe('formatLogChannel', () => {
  it('leaves an ordinary channel unchanged', () => {
    expect(formatLogChannel('fs:readdir')).toBe('fs:readdir')
  })

  it('escapes control characters, line separators and backslashes', () => {
    expect(formatLogChannel('a\nb\r\tc\u0000d\u001be\u007f\u009b  \\'))
      .toBe('a\\nb\\r\\tc\\x00d\\x1be\\x7f\\x9b\\u2028\\u2029\\\\')
  })

  it(`cuts at ${HELPER_LOG_CHANNEL_MAX_CHARS} chars and says how much was dropped`, () => {
    const out = formatLogChannel('x'.repeat(10_000))
    expect(out).toBe(`${'x'.repeat(HELPER_LOG_CHANNEL_MAX_CHARS)}…(+${10_000 - HELPER_LOG_CHANNEL_MAX_CHARS} chars)`)
  })

  it('does not split a surrogate pair at the cut', () => {
    const out = formatLogChannel('x'.repeat(HELPER_LOG_CHANNEL_MAX_CHARS - 1) + '😀' + 'y')
    expect(out.startsWith('x'.repeat(HELPER_LOG_CHANNEL_MAX_CHARS - 1) + '…')).toBe(true)
    expect(out).not.toMatch(/[\ud800-\udfff]/)
  })

  it.each([
    [42, '<number>'],
    [null, '<null>'],
    [undefined, '<undefined>'],
    [['pty:write'], '<array>'],
    [{ secret: 'leak' }, '<object>'],
    [true, '<boolean>'],
  ])('non-string %j is named by type only', (value, expected) => {
    expect(formatLogChannel(value)).toBe(expected)
  })
})

describe('recordHelperDenial / isHelperThrottled', () => {
  it(`throttles past ${HELPER_DENIAL_THRESHOLD} denials and forgets after the window`, () => {
    const store = new Map<string, AuthFailureEntry>()
    const t0 = 1_000_000
    for (let i = 1; i <= HELPER_DENIAL_THRESHOLD; i++) expect(recordHelperDenial(store, 'k', t0 + i)).toBe(i)
    expect(isHelperThrottled(store, 'k', t0 + 100)).toBe(false)
    expect(recordHelperDenial(store, 'k', t0 + 101)).toBe(HELPER_DENIAL_THRESHOLD + 1)
    expect(isHelperThrottled(store, 'k', t0 + 102)).toBe(true)
    expect(isHelperThrottled(store, 'other', t0 + 102)).toBe(false)
    expect(isHelperThrottled(store, 'k', t0 + 1 + HELPER_DENIAL_WINDOW_MS + 1)).toBe(false)
    expect(store.has('k')).toBe(false)
    expect(recordHelperDenial(store, 'k', t0 + 2 * HELPER_DENIAL_WINDOW_MS)).toBe(1)
  })
})

describe('T0445 #9 — denial log channel', () => {
  it('a channel with a newline and a forged log line is escaped onto one line', async () => {
    const s = await startServer()
    const conn = await authOk(s, s.registry.issue('t0451-tower'))
    const forged = 'fs:readdir\n[RemoteServer] Client authenticated: Evil\r\n'
    invoke(conn, 'i-1', forged)
    expect(await waitForFrame(conn, 'i-1')).toMatchObject({ type: 'invoke-error', error: 'Forbidden: channel-not-allowed' })

    const lines = deniedLines(s.logs)
    expect(lines).toHaveLength(1)
    expect(lines[0]).not.toMatch(/[\r\n]/)
    expect(lines[0]).toContain('channel=fs:readdir\\n[RemoteServer] Client authenticated: Evil\\r\\n role=tower')
    expect(s.logs.some(l => l.startsWith('[RemoteServer] Client authenticated'))).toBe(false)
  })

  it('an oversized channel is cut to 64 chars in the log', async () => {
    const s = await startServer()
    const conn = await authOk(s, s.registry.issue('t0451-tower'))
    invoke(conn, 'i-1', 'z'.repeat(100_000))
    expect(await waitForFrame(conn, 'i-1')).toMatchObject({ error: 'Forbidden: channel-not-allowed' })

    const [line] = deniedLines(s.logs)
    expect(line).toContain(`channel=${'z'.repeat(64)}…(+${100_000 - 64} chars) role=tower`)
    expect(line.length).toBeLessThan(400)
  })

  it.each([
    ['number', 42, '<number>'],
    ['object', { secret: 'leak-me' }, '<object>'],
    ['missing', undefined, '<undefined>'],
  ])('a %s channel is denied (not dropped) and its value is not logged', async (_label, channel, shown) => {
    const s = await startServer()
    const conn = await authOk(s, s.registry.issue('t0451-tower'))
    invoke(conn, 'i-1', channel)
    expect(await waitForFrame(conn, 'i-1')).toMatchObject({ type: 'invoke-error', error: 'Forbidden: channel-not-allowed' })
    const [line] = deniedLines(s.logs)
    expect(line).toContain(`channel=${shown} role=tower`)
    expect(s.logs.join('\n')).not.toContain('leak-me')
  })
})

describe('T0445 #9 — connections per capability', () => {
  it(`${HELPER_MAX_CONNECTIONS_PER_CAPABILITY} connections are accepted, the next one is refused; closing one frees a slot`, async () => {
    const s = await startServer()
    const token = s.registry.issue('t0451-tower')
    const conns: Conn[] = []
    for (let i = 0; i < HELPER_MAX_CONNECTIONS_PER_CAPABILITY; i++) conns.push(await authOk(s, token))
    expect(s.server.getHelperConnectionCount()).toBe(HELPER_MAX_CONNECTIONS_PER_CAPABILITY)

    const fifth = await auth(s, token)
    expect(fifth.error).toBe('Too many helper connections')
    await fifth.conn.closed
    expect(s.server.getHelperConnectionCount()).toBe(HELPER_MAX_CONNECTIONS_PER_CAPABILITY)
    expect(s.logs.some(l => l.includes('Helper connection refused') && l.includes('reason=connection-limit'))).toBe(true)

    // Another capability is unaffected.
    await authOk(s, s.registry.issue('t0451-other-tower'))

    conns[0].ws.close()
    await vi.waitFor(() => expect(s.server.getHelperConnectionCount()).toBe(HELPER_MAX_CONNECTIONS_PER_CAPABILITY))
    await authOk(s, token)
  })

  it('a refused 5th connection is not an auth failure: the server token still authenticates', async () => {
    const s = await startServer()
    const token = s.registry.issue('t0451-tower')
    for (let i = 0; i < HELPER_MAX_CONNECTIONS_PER_CAPABILITY; i++) await authOk(s, token)
    for (let i = 0; i < 6; i++) expect((await auth(s, token)).error).toBe('Too many helper connections')
    await authOk(s, 'a'.repeat(32))
  })
})

describe('T0445 #9 — helper denial throttle', () => {
  it(`denial ${HELPER_DENIAL_THRESHOLD + 1} terminates the connection; the capability is refused afterwards, silently`, async () => {
    const s = await startServer()
    const token = s.registry.issue('t0451-tower')
    const conn = await authOk(s, token)

    for (let i = 1; i <= HELPER_DENIAL_THRESHOLD; i++) invoke(conn, `i-${i}`, 'fs:readdir')
    expect(await waitForFrame(conn, `i-${HELPER_DENIAL_THRESHOLD}`)).toMatchObject({ error: 'Forbidden: channel-not-allowed' })
    expect(conn.isClosed()).toBe(false)
    expect(deniedLines(s.logs)).toHaveLength(HELPER_DENIAL_THRESHOLD)

    invoke(conn, 'over', 'fs:readdir')
    invoke(conn, 'after', 'fs:readdir')
    expect(await conn.closed).toBe(1006)
    expect(conn.frames.find(f => f.id === 'after')).toBeUndefined()
    expect(s.server.getHelperConnectionCount()).toBe(0)
    expect(s.logs.filter(l => l.includes('Helper throttled'))).toHaveLength(1)
    expect(deniedLines(s.logs)).toHaveLength(HELPER_DENIAL_THRESHOLD)

    const logCount = s.logs.length
    for (let i = 0; i < 3; i++) expect((await auth(s, token)).error).toBe('Too many denied requests')
    expect(s.logs.slice(logCount).filter(l => l.includes('Helper'))).toEqual([])

    // Other capabilities and the server token are unaffected.
    await authOk(s, s.registry.issue('t0451-other-tower'))
    await authOk(s, 'a'.repeat(32))
  })

  it('connection-limit refusals count as denials too (a reconnect loop is throttled)', async () => {
    const s = await startServer()
    const token = s.registry.issue('t0451-tower')
    for (let i = 0; i < HELPER_MAX_CONNECTIONS_PER_CAPABILITY; i++) await authOk(s, token)
    for (let i = 0; i < HELPER_DENIAL_THRESHOLD + 1; i++) {
      expect((await auth(s, token)).error).toBe('Too many helper connections')
    }
    expect(s.logs.filter(l => l.includes('Helper connection refused'))).toHaveLength(HELPER_DENIAL_THRESHOLD)
    expect(s.logs.filter(l => l.includes('Helper throttled'))).toHaveLength(1)
    expect((await auth(s, token)).error).toBe('Too many denied requests')
  })
})

describe('T0445 #9 — heartbeat covers helpers', () => {
  it('a half-open helper (never answers ping) is terminated; a live one survives', async () => {
    const s = await startServer({ heartbeatIntervalMs: 100 })
    const silent = await authOk(s, s.registry.issue('t0451-silent'), { autoPong: false })
    const live = await authOk(s, s.registry.issue('t0451-live'))
    expect(s.server.getHelperConnectionCount()).toBe(2)

    expect(await silent.closed).toBe(1006)
    await vi.waitFor(() => expect(s.server.getHelperConnectionCount()).toBe(1))
    expect(s.logs.some(l => l.includes('Helper missed a heartbeat') && l.includes('terminal=t0451-silent'))).toBe(true)

    await sleep(400)
    expect(live.isClosed()).toBe(false)
    expect(s.server.getHelperConnectionCount()).toBe(1)
    invoke(live, 'p-1', 'fs:readdir')
    expect(await waitForFrame(live, 'p-1')).toMatchObject({ error: 'Forbidden: channel-not-allowed' })
  })

  it('a half-open helper frees its slot under the connection cap', async () => {
    const s = await startServer({ heartbeatIntervalMs: 100 })
    const token = s.registry.issue('t0451-tower')
    const conns: Conn[] = []
    for (let i = 0; i < HELPER_MAX_CONNECTIONS_PER_CAPABILITY; i++) conns.push(await authOk(s, token, { autoPong: false }))
    expect((await auth(s, token)).error).toBe('Too many helper connections')
    await Promise.all(conns.map(c => c.closed))
    await vi.waitFor(() => expect(s.server.getHelperConnectionCount()).toBe(0))
    await authOk(s, token)
  })
})
