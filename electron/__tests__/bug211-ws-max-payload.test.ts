// @vitest-environment node
/**
 * T0837 (BUG-211 reproduction) / T0842 (fix): a remote window's Claude panel sends every attached
 * image as a data URL inside ONE `claude:send-message` invoke frame (T0436). The RemoteServer
 * accepts at most `WS_MAX_PAYLOAD_BYTES` = 32 MiB per message (`electron/remote/ws-limits.ts`).
 * This file runs a real RemoteServer (wss on loopback, file certificate in a temp dir) and a real
 * RemoteClient and records what happens on each side of that limit.
 *
 *   - raw ws (server behaviour, unchanged): a frame of exactly 32 MiB reaches the handler;
 *     32 MiB + 1 byte closes the socket 1009 (the server log now names the client, T0842)
 *   - RemoteClient: 2 images of 10 MiB (~28 MB frame) go through
 *   - RemoteClient: 3 images of 10 MiB (~42 MB frame): T0837 measured a 1009 close of the whole
 *     connection; since T0842 the client rejects the call locally with `FRAME_TOO_LARGE`, sends
 *     nothing, and the connection and every other in-flight invoke are unaffected
 *   - the panels' remote image budget (`src/lib/remote-image-budget.ts`, 20 MiB) fits one frame
 *     even with a long CJK prompt
 */
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import WebSocket from 'ws'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { RemoteServer } from '../remote/remote-server'
import { RemoteClient } from '../remote/remote-client'
import { registerHandler } from '../remote/handler-registry'
import type { RemoteFrame } from '../remote/protocol'
import { WS_MAX_PAYLOAD_BYTES } from '../remote/ws-limits'
import { REMOTE_IMAGE_BUDGET_BYTES, checkRemoteImageBudget } from '../../src/lib/remote-image-budget'

const TOKEN = 'b'.repeat(32)
const MiB = 1024 * 1024
const SERVER_MAX_PAYLOAD = WS_MAX_PAYLOAD_BYTES
/** Mirrors `MAX_ATTACHMENT_IMAGE_BYTES` (src/lib/image-attachment.ts) / `MAX_IMAGE_SIZE` (path-guard). */
const PANEL_MAX_IMAGE_BYTES = 10 * MiB
const DATA_URL_PREFIX = 'data:image/png;base64,'

/** A data URL the size FileReader.readAsDataURL produces for an image of `rawBytes` bytes. */
function fakeImageDataUrl(rawBytes: number): string {
  // T0842: with real base64 padding, so the decoded size is exactly `rawBytes` (same length as before)
  const padding = (3 - (rawBytes % 3)) % 3
  return DATA_URL_PREFIX + 'A'.repeat(4 * Math.ceil(rawBytes / 3) - padding) + '='.repeat(padding)
}

/** The byte length of the invoke frame RemoteClient.invoke sends for `claude:send-message`. */
function sendMessageFrameBytes(images: string[], prompt = 'look', id = `${Date.now()}-1`): number {
  const frame: RemoteFrame = { type: 'invoke', id, channel: 'claude:send-message', args: ['sess-1', prompt, images] }
  return Buffer.byteLength(JSON.stringify(frame))
}

const sendMessageCalls: Array<{ sessionId: unknown; prompt: unknown; imageCount: number; imageChars: number }> = []
registerHandler('claude:send-message', (_ctx, sessionId: unknown, prompt: unknown, images?: unknown) => {
  const list = Array.isArray(images) ? (images as string[]) : []
  sendMessageCalls.push({ sessionId, prompt, imageCount: list.length, imageChars: list.reduce((n, s) => n + s.length, 0) })
  return true
})
// Stands in for any other proxied invoke of the same window / profile that is still in flight.
let releaseSlow: (() => void) | null = null
registerHandler('test:t0837-slow', () => new Promise<string>(resolve => { releaseSlow = () => resolve('slow-done') }))
registerHandler('test:t0837-ping', () => 'pong')

interface Started {
  server: RemoteServer
  port: number
  logs: string[]
  counts: number[]
}

let current: { server: RemoteServer; dir: string; sockets: WebSocket[]; clients: RemoteClient[] } | null = null

afterEach(async () => {
  sendMessageCalls.length = 0
  releaseSlow = null
  if (!current) return
  for (const c of current.clients) await c.disconnect().catch(() => undefined)
  for (const ws of current.sockets) ws.terminate()
  current.server.stop()
  fs.rmSync(current.dir, { recursive: true, force: true })
  current = null
})

async function startServer(): Promise<Started> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bat-t0837-'))
  const logs: string[] = []
  const record = (...args: unknown[]) => { logs.push(args.map(String).join(' ')) }
  const server = new RemoteServer({ logger: { log: record, warn: record, error: record } })
  server.configDir = dir
  current = { server, dir, sockets: [], clients: [] }
  const started = await server.start(0, TOKEN, 'localhost')
  const counts: number[] = []
  server.onClientCountChange(n => { counts.push(n) })
  return { server, port: started.port, logs, counts }
}

interface RawConn {
  ws: WebSocket
  frames: RemoteFrame[]
  closed: Promise<number>
}

async function connectRaw(s: Started): Promise<RawConn> {
  const ws = new WebSocket(`wss://127.0.0.1:${s.port}`, { rejectUnauthorized: false })
  current?.sockets.push(ws)
  const frames: RemoteFrame[] = []
  ws.on('error', () => {})
  ws.on('message', raw => {
    try { frames.push(JSON.parse(raw.toString())) } catch { /* ignore */ }
  })
  const closed = new Promise<number>(resolve => ws.once('close', code => resolve(code)))
  await new Promise<void>((resolve, reject) => {
    ws.once('open', () => resolve())
    ws.once('error', reject)
  })
  ws.send(JSON.stringify({ type: 'auth', id: 'auth-1', token: TOKEN, args: ['T0837 raw'] }))
  await vi.waitFor(() => {
    const r = frames.find(f => f.id === 'auth-1')
    expect(r).toBeDefined()
    expect(r?.error).toBeUndefined()
  }, { timeout: 5_000, interval: 10 })
  return { ws, frames, closed }
}

/** A `claude:send-message` invoke frame of exactly `bytes` bytes (ASCII, so chars = bytes). */
function exactSizeSendMessageFrame(id: string, bytes: number): string {
  const head = JSON.stringify({ type: 'invoke', id, channel: 'claude:send-message', args: ['sess-1', 'x', [DATA_URL_PREFIX]] })
  // pad the data URL: insert filler before its closing quote
  const insertAt = head.lastIndexOf('"]]}')
  const filler = 'A'.repeat(bytes - Buffer.byteLength(head))
  const out = head.slice(0, insertAt) + filler + head.slice(insertAt)
  expect(Buffer.byteLength(out)).toBe(bytes)
  return out
}

async function connectClient(s: Started, label: string): Promise<{ client: RemoteClient; closeCodes: number[] }> {
  const client = new RemoteClient(() => [])
  current?.clients.push(client)
  const closeCodes: number[] = []
  const res = await client.connect('127.0.0.1', s.port, TOKEN, label)
  expect(res.ok).toBe(true)
  // RemoteClient keeps its socket private; watch it only to read the close code.
  const ws = (client as unknown as { ws: WebSocket }).ws
  ws.on('close', code => { closeCodes.push(code) })
  return { client, closeCodes }
}

describe('T0837 / BUG-211 — frame size arithmetic', () => {
  it('base64 data URLs: 2 panel-max images fit, 3 do not; 3 × 8 MiB already exceed 32 MiB', () => {
    const tenMiB = fakeImageDataUrl(PANEL_MAX_IMAGE_BYTES)
    expect(tenMiB.length).toBe(DATA_URL_PREFIX.length + 13_981_016)
    const two = sendMessageFrameBytes([tenMiB, tenMiB])
    const three = sendMessageFrameBytes([tenMiB, tenMiB, tenMiB])
    const five = sendMessageFrameBytes(Array(5).fill(tenMiB))
    const threeEight = sendMessageFrameBytes(Array(3).fill(fakeImageDataUrl(8 * MiB)))
    expect(two).toBeLessThanOrEqual(SERVER_MAX_PAYLOAD)
    expect(three).toBeGreaterThan(SERVER_MAX_PAYLOAD)
    expect(threeEight).toBeGreaterThan(SERVER_MAX_PAYLOAD)
    // Largest total raw image size that still fits with a short prompt (one image, no per-image overhead).
    const fixed = sendMessageFrameBytes([DATA_URL_PREFIX]) - DATA_URL_PREFIX.length
    const maxRawSingle = Math.floor((SERVER_MAX_PAYLOAD - fixed - DATA_URL_PREFIX.length) / 4) * 3
    console.info(`[T0837] frame bytes: 2×10MiB=${two} 3×10MiB=${three} 5×10MiB=${five} 3×8MiB=${threeEight} limit=${SERVER_MAX_PAYLOAD}; ` +
      `max raw image bytes in one frame ≈ ${maxRawSingle} (${(maxRawSingle / MiB).toFixed(2)} MiB)`)
    expect(maxRawSingle).toBeGreaterThan(24 * MiB - 256)
    expect(maxRawSingle).toBeLessThan(24 * MiB)
  })

  it('T0842: the shared limit is 32 MiB; images within the panel budget fit one frame with a long CJK prompt', () => {
    expect(WS_MAX_PAYLOAD_BYTES).toBe(32 * MiB)
    // the worst split for base64 padding: several images summing to just under the budget
    const within = [
      fakeImageDataUrl(10 * MiB),
      fakeImageDataUrl(REMOTE_IMAGE_BUDGET_BYTES - 10 * MiB - 4 * 1024),
      fakeImageDataUrl(1024), fakeImageDataUrl(1024), fakeImageDataUrl(1024),
    ]
    expect(checkRemoteImageBudget(within, true)).toBeNull()
    const longPrompt = '請看這些截圖並說明差異。\n'.repeat(40_000) // ~1.6 MB UTF-8, JSON-escaped newlines
    expect(sendMessageFrameBytes(within, longPrompt)).toBeLessThan(SERVER_MAX_PAYLOAD)
    // two images at the panel's per-image cap pass the budget; three do not
    const tenMiB = fakeImageDataUrl(PANEL_MAX_IMAGE_BYTES)
    expect(checkRemoteImageBudget([tenMiB, tenMiB], true)).toBeNull()
    expect(checkRemoteImageBudget([tenMiB, tenMiB, tenMiB], true)).not.toBeNull()
  })
})

describe('T0837 / BUG-211 — real RemoteServer', () => {
  it('raw ws: exactly 32 MiB reaches the handler; 32 MiB + 1 byte closes the socket with 1009', async () => {
    const s = await startServer()

    const ok = await connectRaw(s)
    ok.ws.send(exactSizeSendMessageFrame('inv-ok', SERVER_MAX_PAYLOAD))
    await vi.waitFor(() => expect(ok.frames.find(f => f.id === 'inv-ok')?.type).toBe('invoke-result'), { timeout: 15_000, interval: 20 })
    expect(sendMessageCalls).toHaveLength(1)

    const over = await connectRaw(s)
    over.ws.send(exactSizeSendMessageFrame('inv-over', SERVER_MAX_PAYLOAD + 1))
    const code = await over.closed
    console.info(`[T0837] raw over-limit close code=${code}; server log: ${s.logs.filter(l => /payload|disconnected|error/i.test(l)).join(' | ')}`)
    expect(code).toBe(1009)
    expect(over.frames.find(f => f.id === 'inv-over')).toBeUndefined()
    expect(sendMessageCalls).toHaveLength(1) // the handler never saw the oversized frame
    expect(s.logs.some(l => l.includes('Max payload size exceeded'))).toBe(true)
    // T0842: the log line names the connection
    expect(s.logs.some(l => l.includes('Max payload size exceeded') && l.includes('(client: T0837 raw)'))).toBe(true)
    // the other connection is still open
    expect(ok.ws.readyState).toBe(WebSocket.OPEN)
  }, 60_000)

  it('RemoteClient: 2 × 10 MiB images go through in one claude:send-message', async () => {
    const s = await startServer()
    const { client, closeCodes } = await connectClient(s, 'T0837 two-images')
    const img = fakeImageDataUrl(PANEL_MAX_IMAGE_BYTES)
    await expect(client.invoke('claude:send-message', ['sess-1', 'two images', [img, img]])).resolves.toBe(true)
    expect(sendMessageCalls).toEqual([{ sessionId: 'sess-1', prompt: 'two images', imageCount: 2, imageChars: 2 * img.length }])
    expect(client.isConnected).toBe(true)
    expect(closeCodes).toEqual([])
  }, 60_000)

  it('T0842: RemoteClient rejects 3 × 10 MiB images locally (FRAME_TOO_LARGE); the connection and other invokes are unaffected', async () => {
    const s = await startServer()
    const victim = await connectClient(s, 'T0837 profile-A')
    const bystander = await connectClient(s, 'T0837 profile-B')
    expect(s.server.getClientCount()).toBe(2)

    // Another invoke of the same client (another tab of the same profile) is still in flight.
    const slow = victim.client.invoke('test:t0837-slow', [])
    await vi.waitFor(() => expect(releaseSlow).not.toBeNull(), { timeout: 5_000, interval: 10 })

    const img = fakeImageDataUrl(PANEL_MAX_IMAGE_BYTES)
    const expectedBytes = sendMessageFrameBytes([img, img, img], 'three images', 'x')
    const err = await victim.client.invoke('claude:send-message', ['sess-1', 'three images', [img, img, img]])
      .then(() => null, (e: unknown) => e as Error & { code?: string; bytes?: number; limit?: number })
    expect(err).not.toBeNull()
    expect(err!.message).toMatch(/^FRAME_TOO_LARGE: claude:send-message frame is \d+ bytes; the remote connection accepts at most 33554432 bytes$/)
    expect(err!.code).toBe('FRAME_TOO_LARGE')
    expect(err!.limit).toBe(SERVER_MAX_PAYLOAD)
    // the real frame id is a few characters longer than 'x'
    expect(Math.abs((err!.bytes ?? 0) - expectedBytes)).toBeLessThan(64)
    console.info(`[T0842] send-message rejected locally: ${err!.message}; client close codes=${JSON.stringify(victim.closeCodes)}`)

    // nothing reached the server, the connection stays up, nothing reconnects
    expect(sendMessageCalls).toHaveLength(0)
    expect(victim.closeCodes).toEqual([])
    expect(victim.client.isConnected).toBe(true)
    expect(victim.client.isReconnecting).toBe(false)
    expect(s.server.getClientCount()).toBe(2)
    expect(s.counts).toEqual([1, 2]) // the two connects only: nobody left
    expect(s.logs.some(l => l.includes('Max payload size exceeded'))).toBe(false)

    // the in-flight invoke of the same client still completes, and new ones work
    releaseSlow?.()
    await expect(slow).resolves.toBe('slow-done')
    await expect(victim.client.invoke('test:t0837-ping', [])).resolves.toBe('pong')
    await expect(victim.client.invoke('claude:send-message', ['sess-1', 'two images', [img, img]])).resolves.toBe(true)
    expect(sendMessageCalls).toEqual([{ sessionId: 'sess-1', prompt: 'two images', imageCount: 2, imageChars: 2 * img.length }])

    // The other profile's connection is untouched.
    expect(bystander.client.isConnected).toBe(true)
    await expect(bystander.client.invoke('test:t0837-ping', [])).resolves.toBe('pong')
    expect(bystander.closeCodes).toEqual([])
    expect(victim.closeCodes).toEqual([])
  }, 90_000)
})
