// @vitest-environment node
// (The directive only takes effect in test files; every test that imports this
// harness must carry it too — the global vitest environment is jsdom.)
/**
 * T0388 (PLAN-036): in-process headless bat-server + real `ws` client.
 *
 * `startHeadlessHarness()` runs `createHeadlessServer` on port 0 with a
 * `mkdtemp` dataDir, connects over wss with fingerprint pinning (the same
 * check RemoteClient does), authenticates, and exposes
 * `invoke(channel, ...args)` that goes through the real frame protocol —
 * the path a remote-profile window takes.
 */
import { randomBytes } from 'crypto'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import type { TLSSocket } from 'tls'
import WebSocket from 'ws'
import {
  createHeadlessServer,
  type HeadlessServer,
  type HeadlessServerOptions,
} from '../../headless-entry'
import type { RemoteFrame } from '../../protocol'

const quietLogger = { log: () => {}, warn: () => {}, error: () => {} }

export function makeHeadlessDataDir(label = 'harness'): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), `bat-headless-${label}-`))
}

export function removeHeadlessDataDir(dataDir: string): void {
  fs.rmSync(dataDir, { recursive: true, force: true })
}

export interface HeadlessEventFrame {
  channel: string
  args: unknown[]
}

export interface HeadlessClient {
  invoke(channel: string, ...args: unknown[]): Promise<unknown>
  /** Every event frame received so far, in order. */
  readonly events: HeadlessEventFrame[]
  waitForEvent(channel: string, predicate?: (args: unknown[]) => boolean, timeoutMs?: number): Promise<unknown[]>
  close(): Promise<void>
}

export interface HeadlessHarness extends HeadlessClient {
  server: HeadlessServer
  dataDir: string
  port: number
  fingerprint: string
  token: string
  /** Open an additional authenticated client against the same server. */
  connect(): Promise<HeadlessClient>
  /** Closes every client, stops the server, removes the dataDir if the harness created it. */
  dispose(): Promise<void>
}

export interface HeadlessHarnessOptions extends Partial<Omit<HeadlessServerOptions, 'port' | 'dataDir'>> {
  dataDir?: string
  timeoutMs?: number
}

const DEFAULT_TIMEOUT_MS = 5_000

export async function connectHeadlessClient(opts: {
  port: number
  token: string
  fingerprint: string
  timeoutMs?: number
}): Promise<HeadlessClient> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS
  // Self-signed cert: verified by fingerprint pinning below, like RemoteClient.
  const ws = new WebSocket(`wss://127.0.0.1:${opts.port}`, { rejectUnauthorized: false })
  const pending = new Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void; timer: NodeJS.Timeout }>()
  const events: HeadlessEventFrame[] = []
  const eventWaiters = new Set<(event: HeadlessEventFrame) => void>()
  let nextId = 0

  const settlePending = (id: string, fn: (entry: { resolve: (v: unknown) => void; reject: (e: Error) => void }) => void) => {
    const entry = pending.get(id)
    if (!entry) return
    pending.delete(id)
    clearTimeout(entry.timer)
    fn(entry)
  }

  const send = (frame: RemoteFrame): Promise<unknown> =>
    new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(frame.id)
        reject(new Error(`headless harness: ${frame.type} ${frame.channel ?? ''} timed out after ${timeoutMs}ms`))
      }, timeoutMs)
      pending.set(frame.id, { resolve, reject, timer })
      ws.send(JSON.stringify(frame))
    })

  ws.on('message', raw => {
    let frame: RemoteFrame
    try { frame = JSON.parse(raw.toString()) } catch { return }
    if (frame.type === 'event' && frame.channel) {
      const event = { channel: frame.channel, args: frame.args ?? [] }
      events.push(event)
      for (const waiter of [...eventWaiters]) waiter(event)
      return
    }
    if (frame.type === 'invoke-result' || frame.type === 'auth-result' || frame.type === 'invoke-error') {
      settlePending(frame.id, ({ resolve, reject }) => {
        if (frame.error !== undefined) reject(new Error(frame.error))
        else resolve(frame.result)
      })
    }
  })
  ws.on('close', () => {
    for (const id of [...pending.keys()]) {
      settlePending(id, ({ reject }) => reject(new Error('headless harness: connection closed')))
    }
  })

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('headless harness: connect timed out')), timeoutMs)
    ws.once('upgrade', res => {
      const observed = (res.socket as TLSSocket).getPeerCertificate().fingerprint256
      if (observed !== opts.fingerprint) {
        clearTimeout(timer)
        ws.terminate()
        reject(new Error(`headless harness: fingerprint mismatch (expected ${opts.fingerprint}, got ${observed})`))
      }
    })
    ws.once('open', () => { clearTimeout(timer); resolve() })
    ws.once('error', err => { clearTimeout(timer); reject(err) })
  })

  await send({ type: 'auth', id: `auth-${nextId++}`, token: opts.token, args: ['T0388 headless harness'] })

  return {
    events,
    invoke(channel, ...args) {
      return send({ type: 'invoke', id: `invoke-${nextId++}`, channel, args })
    },
    waitForEvent(channel, predicate = () => true, waitMs = timeoutMs) {
      const already = events.find(e => e.channel === channel && predicate(e.args))
      if (already) return Promise.resolve(already.args)
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          eventWaiters.delete(waiter)
          reject(new Error(`headless harness: no ${channel} event within ${waitMs}ms`))
        }, waitMs)
        const waiter = (event: HeadlessEventFrame) => {
          if (event.channel !== channel || !predicate(event.args)) return
          clearTimeout(timer)
          eventWaiters.delete(waiter)
          resolve(event.args)
        }
        eventWaiters.add(waiter)
      })
    },
    close() {
      if (ws.readyState === WebSocket.CLOSED) return Promise.resolve()
      return new Promise<void>(resolve => {
        ws.once('close', () => resolve())
        ws.close()
      })
    },
  }
}

export async function startHeadlessHarness(opts: HeadlessHarnessOptions = {}): Promise<HeadlessHarness> {
  const { dataDir: requestedDataDir, timeoutMs, ...serverOpts } = opts
  const dataDir = requestedDataDir ?? makeHeadlessDataDir()
  const token = serverOpts.token ?? randomBytes(16).toString('hex')
  const server = await createHeadlessServer({ logger: quietLogger, ...serverOpts, dataDir, token, port: 0 })
  const clients: HeadlessClient[] = []

  try {
    const started = await server.start()
    const connect = async () => {
      const client = await connectHeadlessClient({ port: started.port, token, fingerprint: started.fingerprint, timeoutMs })
      clients.push(client)
      return client
    }
    const primary = await connect()

    return {
      ...primary,
      events: primary.events,
      server,
      dataDir,
      port: started.port,
      fingerprint: started.fingerprint,
      token,
      connect,
      async dispose() {
        await Promise.all(clients.splice(0).map(c => c.close()))
        await server.stop()
        if (!requestedDataDir) removeHeadlessDataDir(dataDir)
      },
    }
  } catch (error) {
    await Promise.all(clients.splice(0).map(c => c.close()))
    await server.stop()
    if (!requestedDataDir) removeHeadlessDataDir(dataDir)
    throw error
  }
}
