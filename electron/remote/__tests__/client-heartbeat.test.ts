// @vitest-environment node
/**
 * T0455: client heartbeat checks pong on a real RemoteServer (wss on loopback, file
 * certificate in a temp dir, raw `ws` clients authenticating with the server token).
 *
 *   - a client that stops answering ping (half-open) is terminated after missing
 *     `CLIENT_MAX_MISSED_HEARTBEATS` (2) heartbeats in a row: `getClientCount()` drops,
 *     `onClientCountChange` / `onClientDisconnect` fire, and the T0404 orphan reclaimer arms
 *   - missing one heartbeat and then answering resets the count — the client stays
 *   - a client answering every ping stays
 */
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import WebSocket from 'ws'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CLIENT_MAX_MISSED_HEARTBEATS, RemoteServer } from '../remote-server'
import { HeadlessOrphanPtyReclaimer } from '../headless-entry'
import type { RemoteFrame } from '../protocol'

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
const TOKEN = 'a'.repeat(32)
const INTERVAL = 100

interface Started {
  server: RemoteServer
  port: number
  logs: string[]
}

let current: { server: RemoteServer; dir: string; sockets: WebSocket[]; cleanup: (() => void)[] } | null = null

afterEach(() => {
  if (!current) return
  for (const fn of current.cleanup) fn()
  for (const ws of current.sockets) ws.terminate()
  current.server.stop()
  fs.rmSync(current.dir, { recursive: true, force: true })
  current = null
})

async function startServer(): Promise<Started> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bat-t0455-'))
  const logs: string[] = []
  const record = (...args: unknown[]) => { logs.push(args.map(String).join(' ')) }
  const server = new RemoteServer({
    logger: { log: record, warn: record, error: record },
    heartbeatIntervalMs: INTERVAL,
  })
  server.configDir = dir
  current = { server, dir, sockets: [], cleanup: [] }
  const started = await server.start(0, TOKEN, 'localhost')
  return { server, port: started.port, logs }
}

interface Conn {
  ws: WebSocket
  closed: Promise<number>
  isClosed(): boolean
  /** Pings the server sent this connection so far. */
  pings(): number
}

/**
 * Opens a client and authenticates with the server token. `answerPing(n)` decides whether
 * the n-th ping (1-based) gets a pong; omitted = the `ws` default auto-pong.
 */
async function connectClient(s: Started, label: string, answerPing?: (n: number) => boolean): Promise<Conn> {
  const ws = new WebSocket(`wss://127.0.0.1:${s.port}`, { rejectUnauthorized: false, autoPong: !answerPing })
  current?.sockets.push(ws)
  const frames: RemoteFrame[] = []
  let closedFlag = false
  let pingCount = 0
  ws.on('error', () => {})
  ws.on('message', raw => {
    try { frames.push(JSON.parse(raw.toString())) } catch { /* ignore */ }
  })
  ws.on('ping', data => {
    pingCount++
    if (answerPing && answerPing(pingCount)) ws.pong(data)
  })
  const closed = new Promise<number>(resolve => ws.once('close', code => { closedFlag = true; resolve(code) }))
  await new Promise<void>((resolve, reject) => {
    ws.once('open', () => resolve())
    ws.once('error', reject)
  })
  ws.send(JSON.stringify({ type: 'auth', id: 'auth-1', token: TOKEN, args: [label] }))
  await vi.waitFor(() => {
    const result = frames.find(f => f.id === 'auth-1')
    expect(result).toBeDefined()
    expect(result?.error).toBeUndefined()
  }, { timeout: 5_000, interval: 10 })
  return { ws, closed, isClosed: () => closedFlag, pings: () => pingCount }
}

describe('T0455 — client heartbeat checks pong', () => {
  it('tolerates exactly one missed heartbeat', () => {
    expect(CLIENT_MAX_MISSED_HEARTBEATS).toBe(2)
  })

  it('a half-open client is terminated after 2 missed heartbeats; count drops and the orphan reclaim arms', async () => {
    const s = await startServer()
    const counts: number[] = []
    const disconnected: string[] = []
    const reclaim = vi.fn(() => 3)
    const reclaimer = new HeadlessOrphanPtyReclaimer({ idleMs: 50, reclaim, log: () => {} })
    current!.cleanup.push(
      s.server.onClientCountChange(count => { counts.push(count); reclaimer.update(count) }),
      s.server.onClientDisconnect(id => { disconnected.push(id) }),
      () => reclaimer.dispose(),
    )

    const live = await connectClient(s, 'Live')
    const silent = await connectClient(s, 'Silent', () => false)
    expect(s.server.getClientCount()).toBe(2)

    expect(await silent.closed).toBe(1006)
    expect(s.server.getClientCount()).toBe(1)
    // Not on the first missed ping: the 2nd ping went out before the client was cut.
    expect(silent.pings()).toBeGreaterThanOrEqual(CLIENT_MAX_MISSED_HEARTBEATS)
    expect(disconnected).toHaveLength(1)
    expect(s.logs.some(l => l.includes('Client missed 2 heartbeats; terminated: Silent'))).toBe(true)
    await vi.waitFor(() => expect(counts.at(-1)).toBe(1))

    // The live client keeps the server from reclaiming; once it is gone too the reclaim fires.
    await sleep(INTERVAL * 3)
    expect(live.isClosed()).toBe(false)
    expect(reclaim).not.toHaveBeenCalled()
    live.ws.close()
    await live.closed
    await vi.waitFor(() => expect(counts.at(-1)).toBe(0))
    await vi.waitFor(() => expect(reclaim).toHaveBeenCalledTimes(1))
  })

  it('a client that only half-opens is terminated even when it is the last one (reclaim arms)', async () => {
    const s = await startServer()
    const reclaim = vi.fn(() => 1)
    const reclaimer = new HeadlessOrphanPtyReclaimer({ idleMs: 50, reclaim, log: () => {} })
    current!.cleanup.push(
      s.server.onClientCountChange(count => reclaimer.update(count)),
      () => reclaimer.dispose(),
    )
    const silent = await connectClient(s, 'Silent', () => false)
    expect(s.server.getClientCount()).toBe(1)
    expect(await silent.closed).toBe(1006)
    expect(s.server.getClientCount()).toBe(0)
    await vi.waitFor(() => expect(reclaim).toHaveBeenCalledTimes(1))
  })

  it('missing one heartbeat and then answering resets the count — the client stays', async () => {
    const s = await startServer()
    // Skips every other ping: never 2 misses in a row.
    const flaky = await connectClient(s, 'Flaky', n => n % 2 === 0)
    await vi.waitFor(() => expect(flaky.pings()).toBeGreaterThanOrEqual(8), { timeout: 5_000, interval: 20 })
    expect(flaky.isClosed()).toBe(false)
    expect(s.server.getClientCount()).toBe(1)
    expect(s.logs.some(l => l.includes('missed'))).toBe(false)
  })

  it('a client answering every ping stays', async () => {
    const s = await startServer()
    const steady = await connectClient(s, 'Steady')
    await sleep(INTERVAL * 6)
    expect(steady.isClosed()).toBe(false)
    expect(s.server.getClientCount()).toBe(1)
  })
})
