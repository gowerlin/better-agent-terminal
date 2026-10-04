// @vitest-environment node
/**
 * T0447 (T0445 #1 / #2 / #3): RemoteServer frame hardening on a real headless server
 * (T0388 harness: in-process server + wss + real node-pty). Raw `ws` connections send the
 * frames a hostile peer would; `invokeHandler` is spied to prove no handler ran.
 *
 *   #1 a revoked helper connection never falls through to the client invoke path —
 *      neither a pipelined frame right behind the revoking one, nor a later frame from a
 *      peer that does not answer the close frame (the socket is terminated, not closed)
 *   #2 prototype-key / non-string channels and non-array args from a helper are denied,
 *      the connection and the server survive
 *   #3 unauthenticated (and authenticated) `null` / `1` / `"str"` / `[]` frames close the
 *      connection; no unhandled rejection, the server keeps serving
 */
import * as os from 'os'
import type { TLSSocket } from 'tls'
import WebSocket from 'ws'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { HelperCapabilityRegistry } from '../helper-capability'
import { invokeHandler } from '../handler-registry'
import type { RemoteFrame } from '../protocol'
import { startHeadlessHarness, type HeadlessHarness } from './helpers/headless-harness'

vi.mock('../handler-registry', async importOriginal => {
  const actual = await importOriginal<typeof import('../handler-registry')>()
  return { ...actual, invokeHandler: vi.fn(actual.invokeHandler) }
})

const invokeSpy = vi.mocked(invokeHandler)

const CWD = os.tmpdir()
const SHELL = process.platform === 'win32' ? undefined : '/bin/sh'

let seq = 0
const termId = (label: string) => `t0447-${label}-${process.pid}-${seq++}`
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

let registry: HelperCapabilityRegistry
let harness: HeadlessHarness
const unhandled: unknown[] = []
const onUnhandled = (reason: unknown) => { unhandled.push(reason) }

interface RawConn {
  ws: WebSocket
  frames: RemoteFrame[]
  /** Resolves with the close code once the connection is gone. */
  closed: Promise<number>
  isClosed(): boolean
}

async function openRaw(): Promise<RawConn> {
  const ws = new WebSocket(`wss://127.0.0.1:${harness.port}`, { rejectUnauthorized: false })
  const frames: RemoteFrame[] = []
  let closedFlag = false
  ws.on('error', () => {}) // writes after a server-side terminate may EPIPE / ECONNRESET
  ws.on('message', raw => {
    try { frames.push(JSON.parse(raw.toString())) } catch { /* ignore */ }
  })
  const closed = new Promise<number>(resolve => ws.once('close', code => { closedFlag = true; resolve(code) }))
  await new Promise<void>((resolve, reject) => {
    ws.once('upgrade', res => {
      expect((res.socket as TLSSocket).getPeerCertificate().fingerprint256).toBe(harness.fingerprint)
    })
    ws.once('open', () => resolve())
    ws.once('error', reject)
  })
  return { ws, frames, closed, isClosed: () => closedFlag }
}

async function waitForFrame(conn: RawConn, id: string): Promise<RemoteFrame> {
  let found: RemoteFrame | undefined
  await vi.waitFor(() => {
    found = conn.frames.find(f => f.id === id)
    expect(found).toBeDefined()
  }, { timeout: 5_000, interval: 20 })
  return found!
}

async function authRaw(conn: RawConn, token: string): Promise<void> {
  conn.ws.send(JSON.stringify({ type: 'auth', id: 'auth-1', token, args: ['T0447 raw'] }))
  const result = await waitForFrame(conn, 'auth-1')
  expect(result.error).toBeUndefined()
}

const invokeFrame = (id: string, channel: unknown, args: unknown) =>
  JSON.stringify({ type: 'invoke', id, channel, args })

async function createPty(id: string): Promise<void> {
  const result = await harness.invoke('pty:create', { id, cwd: CWD, type: 'terminal', ...(SHELL ? { shell: SHELL } : {}) })
  expect(result).toMatchObject({ ok: true, created: true })
}

/** The server still answers the BAT client (it did not crash). */
async function expectServerAlive(): Promise<void> {
  expect(await harness.invoke('pty:get-cwd', 'no-such-terminal')).toBeNull()
}

beforeAll(async () => {
  process.on('unhandledRejection', onUnhandled)
  registry = new HelperCapabilityRegistry()
  harness = await startHeadlessHarness({ helperCapabilities: registry })
})

afterAll(async () => {
  await harness?.dispose()
  process.off('unhandledRejection', onUnhandled)
})

beforeEach(() => {
  unhandled.length = 0
})

describe('T0445 #1 — a revoked helper never reaches the client invoke path', () => {
  it('pipelined [ping, invoke pty:create] right behind the revocation: no handler runs, no PTY, socket terminated', async () => {
    const id = termId('revoked')
    await createPty(id)
    const conn = await openRaw()
    await authRaw(conn, registry.issue(id))
    registry.revokeTerminal(id)

    const evilId = termId('evil-pipelined')
    invokeSpy.mockClear()
    conn.ws.send(JSON.stringify({ type: 'ping', id: 'p-1' }))
    conn.ws.send(invokeFrame('i-1', 'pty:create', [{ id: evilId, cwd: CWD, type: 'terminal' }]))
    conn.ws.send(invokeFrame('i-2', 'fs:readdir', [CWD]))

    const code = await conn.closed
    await sleep(300)
    expect(invokeSpy).not.toHaveBeenCalled()
    // terminate(), not close(): no CLOSING window in which the peer keeps sending.
    expect(code).toBe(1006)
    expect(await harness.invoke('pty:get-buffer', evilId)).toBeNull()
    await harness.invoke('pty:kill', id)
  })

  it('a later frame from a peer that never answers the close frame: no handler runs, no PTY', async () => {
    const id = termId('revoked-delayed')
    await createPty(id)
    const conn = await openRaw()
    await authRaw(conn, registry.issue(id))
    registry.revokeTerminal(id)

    const evilId = termId('evil-delayed')
    invokeSpy.mockClear()
    conn.ws.send(JSON.stringify({ type: 'ping', id: 'p-1' }))
    // Stop reading: the client never sees (nor answers) the server's close frame, so a
    // close()d server socket would sit in CLOSING for `ws`'s 30 s closeTimeout.
    ;(conn.ws as unknown as { _socket: { pause(): void } })._socket.pause()
    await sleep(400)
    conn.ws.send(invokeFrame('i-1', 'pty:create', [{ id: evilId, cwd: CWD, type: 'terminal' }]))
    await sleep(600)

    expect(invokeSpy).not.toHaveBeenCalled()
    expect(await harness.invoke('pty:get-buffer', evilId)).toBeNull()
    conn.ws.terminate()
    await harness.invoke('pty:kill', id)
  })
})

describe('T0445 #2 — prototype-key / non-string channels from a helper', () => {
  let towerId: string
  let conn: RawConn

  beforeAll(async () => {
    towerId = termId('tower')
    await createPty(towerId)
    conn = await openRaw()
    await authRaw(conn, registry.issue(towerId))
  })

  afterAll(async () => {
    conn.ws.terminate()
    await harness.invoke('pty:kill', towerId)
  })

  it.each([
    ['constructor', 'constructor'],
    ['__proto__', '__proto__'],
    ['toString', 'toString'],
    ['hasOwnProperty', 'hasOwnProperty'],
    ['valueOf', 'valueOf'],
    ['number', 123],
    ['object', { a: 1 }],
    ['array', ['pty:write']],
  ])('channel %s → Forbidden, the connection and the server survive', async (_label, channel) => {
    invokeSpy.mockClear()
    const frameId = `c-${seq++}`
    conn.ws.send(invokeFrame(frameId, channel, [towerId]))
    const reply = await waitForFrame(conn, frameId)
    expect(reply).toMatchObject({ type: 'invoke-error', error: 'Forbidden: channel-not-allowed' })
    expect(invokeSpy).not.toHaveBeenCalled()
    expect(conn.isClosed()).toBe(false)
    expect(unhandled).toEqual([])
    await expectServerAlive()
  })

  it('non-array args → Forbidden: invalid-args, no handler runs', async () => {
    const worker = await openRaw()
    await authRaw(worker, registry.issue(termId('worker'), { towerId }))
    invokeSpy.mockClear()
    worker.ws.send(invokeFrame('a-1', 'pty:write', { 0: towerId, length: 2 }))
    expect(await waitForFrame(worker, 'a-1')).toMatchObject({ type: 'invoke-error', error: 'Forbidden: invalid-args' })
    expect(invokeSpy).not.toHaveBeenCalled()
    expect(unhandled).toEqual([])
    worker.ws.terminate()
    await expectServerAlive()
  })
})

describe('T0445 #3 — malformed frames close the connection, the server survives', () => {
  const MALFORMED = ['null', '1', '"str"', '[]', '{"type":5,"id":"x"}', '{"id":"x"}']

  it.each(MALFORMED)('unauthenticated %s → connection closed, no unhandled rejection', async raw => {
    const conn = await openRaw()
    conn.ws.send(raw)
    await conn.closed
    await sleep(50)
    expect(unhandled).toEqual([])
    await expectServerAlive()
  })

  it.each(['null', '[]', '"str"'])('authenticated client %s → connection closed, no handler runs', async raw => {
    const conn = await openRaw()
    await authRaw(conn, harness.token)
    invokeSpy.mockClear()
    conn.ws.send(raw)
    await conn.closed
    await sleep(50)
    expect(invokeSpy).not.toHaveBeenCalled()
    expect(unhandled).toEqual([])
    await expectServerAlive()
  })
})
