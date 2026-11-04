// @vitest-environment node
/**
 * PLAN-038 U2 (T0833): client upload driver in main (electron/upload-client.ts) driven by the
 * renderer driver (src/lib/remote-upload.ts), against a real host `UploadStaging` (T0832) behind a
 * fake `invoke`. Covers: stop-and-wait, chunk retry once on invoke timeout (idempotent resend),
 * cancel, old server without `upload:*`, D272 limits, profile routing (no live connection → fail,
 * local window → not uploaded, never this machine), dialog-path allowlist, logs without file names,
 * and the main.ts / preload wiring (local ipcMain.handle, not proxied, not helper-callable).
 */
import { createHash } from 'crypto'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  MAX_TRANSFERS_PER_SENDER,
  UPLOAD_CLIENT_PROGRESS_CHANNEL,
  UploadClient,
  UploadNotConnectedError,
  classifyInvokeError,
  clipboardImageName,
  isInvokeTimeout,
  type UploadClientDeps,
  type UploadClientRoute,
} from '../upload-client'
import { UPLOAD_LIMITS, UPLOAD_TTL, UploadStaging } from '../upload-staging'
import { HELPER_CHANNEL_ROLES } from '../remote/helper-capability'
import { PROXIED_CHANNELS } from '../remote/protocol'
import {
  REMOTE_UPLOAD_LIMITS,
  uploadToRemoteHost,
  type RemoteUploadApi,
  type RemoteUploadProgressEvent,
} from '../../src/lib/remote-upload'

const SENDER = 7
const OTHER = 8
const PROFILE = 'p-remote'
const KEY = 'session-abcdef1234'
const CHUNK = UPLOAD_LIMITS.chunkBytes
const quiet = { log: () => {}, warn: () => {} }

let dataDir: string
let srcDir: string

beforeEach(() => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bat-t0833-host-'))
  srcDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bat-t0833-src-'))
})
afterEach(() => {
  fs.rmSync(dataDir, { recursive: true, force: true })
  fs.rmSync(srcDir, { recursive: true, force: true })
})

type Call = { profileId: string; channel: string; args: unknown[]; timeoutMs: number }

interface Harness {
  client: UploadClient
  staging: UploadStaging
  calls: Call[]
  progress: Array<{ senderId: number; event: RemoteUploadProgressEvent }>
  logs: string[]
  /** Replace to inject failures; default forwards to the staging host. */
  hook: { invoke?: (call: Call, forward: () => Promise<unknown>) => Promise<unknown> }
  route: { value: UploadClientRoute }
  clipboard: { png: Buffer | null }
  clock: { now: number }
  maxInFlight: () => number
}

function makeHarness(opts: Partial<UploadClientDeps> = {}): Harness {
  const staging = new UploadStaging({ getDataDir: () => dataDir, log: quiet, freeBytes: async () => null })
  const calls: Call[] = []
  const progress: Harness['progress'] = []
  const logs: string[] = []
  const hook: Harness['hook'] = {}
  const route = { value: { kind: 'remote', profileId: PROFILE } as UploadClientRoute }
  const clipboard = { png: null as Buffer | null }
  const clock = { now: 1_000_000 }
  let inFlight = 0
  let maxInFlight = 0
  const forwardTo = (channel: string, args: unknown[]): Promise<unknown> => {
    switch (channel) {
      case 'upload:begin': return staging.begin(args[0], args[1], args[2])
      case 'upload:chunk': return staging.chunk(args[0], args[1], args[2])
      case 'upload:finish': return staging.finish(args[0], args[1])
      case 'upload:abort': return staging.abort(args[0])
      default: return Promise.reject(new Error(`No handler for channel: ${channel}`))
    }
  }
  const client = new UploadClient({
    resolveRoute: async () => route.value,
    invoke: async (profileId, channel, args, timeoutMs) => {
      const call = { profileId, channel, args, timeoutMs }
      calls.push(call)
      inFlight++
      maxInFlight = Math.max(maxInFlight, inFlight)
      try {
        const forward = () => forwardTo(channel, args)
        return await (hook.invoke ? hook.invoke(call, forward) : forward())
      } finally {
        inFlight--
      }
    },
    readClipboardPng: async () => clipboard.png,
    emitProgress: (senderId, event) => progress.push({ senderId, event }),
    now: () => clock.now,
    log: { log: m => logs.push(m), warn: m => logs.push(m) },
    ...opts,
  })
  return { client, staging, calls, progress, logs, hook, route, clipboard, clock, maxInFlight: () => maxInFlight }
}

/** The preload API as the renderer sees it, bound to one sender. */
function apiFor(h: Harness, senderId = SENDER): RemoteUploadApi {
  const listeners = new Set<(e: RemoteUploadProgressEvent) => void>()
  const origLen = { n: 0 }
  // Fan progress pushed for this sender out to the renderer listeners.
  const pump = () => {
    while (origLen.n < h.progress.length) {
      const p = h.progress[origLen.n++]
      if (p.senderId === senderId) for (const l of listeners) l(p.event)
    }
  }
  const wrap = <T>(p: Promise<T>) => p.finally(pump)
  return {
    prepare: (key, sources) => wrap(h.client.prepare(senderId, key, sources)),
    begin: id => wrap(h.client.begin(senderId, id)),
    chunk: (id, offset, data) => wrap(h.client.chunk(senderId, id, offset, data)),
    finish: id => wrap(h.client.finish(senderId, id)),
    run: id => wrap(h.client.run(senderId, id)),
    abort: id => wrap(h.client.abort(senderId, id)),
    onProgress: cb => { listeners.add(cb); return () => listeners.delete(cb) },
  }
}

function bytes(n: number, seed = 1): Buffer {
  const b = Buffer.alloc(n)
  for (let i = 0; i < n; i++) b[i] = (i * 31 + seed) & 0xff
  return b
}

function blobOf(data: Buffer, name: string): Blob {
  return new File([new Uint8Array(data)], name)
}

const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex')

describe('limits and helpers', () => {
  it('renderer limits mirror UPLOAD_LIMITS (D272)', () => {
    expect(REMOTE_UPLOAD_LIMITS).toEqual({
      maxFileBytes: UPLOAD_LIMITS.maxFileBytes,
      maxSendBytes: UPLOAD_LIMITS.maxSendBytes,
      maxSendFiles: UPLOAD_LIMITS.maxSendFiles,
      chunkBytes: UPLOAD_LIMITS.chunkBytes,
    })
    expect(UPLOAD_LIMITS.maxFileBytes).toBe(50 * 1024 * 1024)
    expect(UPLOAD_LIMITS.maxSendBytes).toBe(100 * 1024 * 1024)
    expect(UPLOAD_LIMITS.maxSendFiles).toBe(10)
    expect(UPLOAD_LIMITS.chunkBytes).toBe(256 * 1024)
  })

  it('classifies transport errors', () => {
    expect(isInvokeTimeout(new Error('Remote invoke timeout: upload:chunk'))).toBe(true)
    expect(isInvokeTimeout(new Error('Not connected to remote server'))).toBe(false)
    expect(classifyInvokeError(new Error('No handler for channel: upload:begin')).code).toBe('SERVER_TOO_OLD')
    expect(classifyInvokeError(new Error('Not connected to remote server')).code).toBe('NOT_CONNECTED')
    expect(classifyInvokeError(new UploadNotConnectedError('x')).code).toBe('NOT_CONNECTED')
    expect(classifyInvokeError(new Error('Forbidden: channel-not-allowed')).code).toBe('FORBIDDEN')
    expect(classifyInvokeError(new Error('Remote invoke timeout: upload:finish')).code).toBe('TRANSPORT')
    expect(classifyInvokeError(new Error('Not authenticated')).code).toBe('TRANSPORT')
  })

  it('names clipboard images by local time', () => {
    expect(clipboardImageName(new Date(2026, 10, 4, 9, 5, 7))).toBe('clipboard-20261104-090507.png')
  })
})

describe('file source (renderer File.slice → main → host)', () => {
  it('uploads in 256 KiB chunks, one at a time, and returns the host path', async () => {
    const h = makeHarness()
    const data = bytes(CHUNK * 2 + 1234)
    const progress: number[] = []
    const out = await uploadToRemoteHost(KEY, [{ kind: 'file', file: blobOf(data, 'report 1.pdf') }], {
      api: apiFor(h),
      onProgress: p => progress.push(p.received),
    })
    expect(out.ok).toBe(true)
    const item = out.items[0]
    if (!item.ok) throw new Error(item.code)
    expect(item.name).toBe('report 1.pdf')
    expect(path.basename(item.serverPath)).toBe('report 1.pdf')
    expect(item.serverPath.startsWith(path.join(dataDir, 'uploads', KEY) + path.sep)).toBe(true)
    expect(fs.readFileSync(item.serverPath).equals(data)).toBe(true)
    const chunks = h.calls.filter(c => c.channel === 'upload:chunk')
    expect(chunks.map(c => c.args[1])).toEqual([0, CHUNK, CHUNK * 2])
    expect(chunks.every(c => Buffer.from(c.args[2] as string, 'base64').length <= CHUNK)).toBe(true)
    expect(h.calls.find(c => c.channel === 'upload:finish')?.args[1]).toBe(sha(data))
    expect(h.maxInFlight()).toBe(1)
    expect(progress).toEqual([CHUNK, CHUNK * 2, data.length])
    expect(h.calls.every(c => c.profileId === PROFILE)).toBe(true)
    expect(h.client.transferCount).toBe(0)
  })

  it('uploads an empty file (begin → finish, no chunk)', async () => {
    const h = makeHarness()
    const out = await uploadToRemoteHost(KEY, [{ kind: 'file', file: blobOf(Buffer.alloc(0), 'empty.txt') }], { api: apiFor(h) })
    expect(out.ok).toBe(true)
    expect(h.calls.map(c => c.channel)).toEqual(['upload:begin', 'upload:finish'])
  })

  it('stop-and-wait: a second chunk while one is in flight is BUSY', async () => {
    const h = makeHarness()
    const prep = await h.client.prepare(SENDER, KEY, [{ kind: 'file', name: 'a.bin', size: 10 }])
    if (!prep.ok || !prep.items[0].ok) throw new Error('prepare')
    const id = prep.items[0].transferId
    expect((await h.client.begin(SENDER, id)).ok).toBe(true)
    let release!: () => void
    h.hook.invoke = (call, forward) => call.channel === 'upload:chunk' ? new Promise(r => { release = () => r(forward()) }) : forward()
    const first = h.client.chunk(SENDER, id, 0, bytes(5))
    await new Promise(r => setImmediate(r))
    expect(await h.client.chunk(SENDER, id, 0, bytes(5))).toMatchObject({ ok: false, code: 'BUSY' })
    expect(await h.client.finish(SENDER, id)).toMatchObject({ ok: false, code: 'BUSY' })
    h.hook.invoke = undefined
    release()
    expect(await first).toEqual({ ok: true, received: 5 })
    expect(await h.client.chunk(SENDER, id, 3, bytes(5))).toMatchObject({ ok: false, code: 'BAD_OFFSET' })
    expect(await h.client.chunk(SENDER, id, 5, bytes(6))).toMatchObject({ ok: false, code: 'BAD_CHUNK' })
    expect(await h.client.chunk(SENDER, id, 5, Buffer.alloc(0))).toMatchObject({ ok: false, code: 'BAD_CHUNK' })
    expect(await h.client.chunk(SENDER, id, 5, bytes(CHUNK + 1))).toMatchObject({ ok: false, code: 'BAD_CHUNK' })
    expect(await h.client.finish(SENDER, id)).toMatchObject({ ok: false, code: 'SIZE_MISMATCH' })
    expect(await h.client.chunk(SENDER, id, 5, bytes(5, 9))).toEqual({ ok: true, received: 10 })
    expect(await h.client.finish(SENDER, id)).toMatchObject({ ok: true })
  })

  it('another window cannot touch the transfer (NOT_FOUND)', async () => {
    const h = makeHarness()
    const prep = await h.client.prepare(SENDER, KEY, [{ kind: 'file', name: 'a.bin', size: 1 }])
    if (!prep.ok || !prep.items[0].ok) throw new Error('prepare')
    const id = prep.items[0].transferId
    expect(await h.client.begin(OTHER, id)).toMatchObject({ ok: false, code: 'NOT_FOUND' })
    expect(await h.client.abort(OTHER, id)).toEqual({ ok: true, aborted: 0 })
    expect(await h.client.begin(SENDER, id)).toMatchObject({ ok: true })
    expect(await h.client.begin(SENDER, id)).toMatchObject({ ok: false, code: 'BAD_ARGS' })
    expect(await h.client.run(SENDER, id)).toMatchObject({ ok: false, code: 'BAD_ARGS' })
  })
})

describe('retry once on chunk invoke timeout (契約 C-4)', () => {
  it('a timed-out chunk the host already wrote is resent once and accepted (idempotent)', async () => {
    const h = makeHarness()
    let timedOut = false
    h.hook.invoke = async (call, forward) => {
      if (call.channel === 'upload:chunk' && call.args[1] === CHUNK && !timedOut) {
        timedOut = true
        await forward() // the host wrote it; the reply is lost
        throw new Error('Remote invoke timeout: upload:chunk')
      }
      return forward()
    }
    const data = bytes(CHUNK * 2 + 10)
    const out = await uploadToRemoteHost(KEY, [{ kind: 'file', file: blobOf(data, 'x.bin') }], { api: apiFor(h) })
    expect(out.ok).toBe(true)
    const chunks = h.calls.filter(c => c.channel === 'upload:chunk')
    expect(chunks.map(c => c.args[1])).toEqual([0, CHUNK, CHUNK, CHUNK * 2])
    expect(chunks[1].args[2]).toBe(chunks[2].args[2])
    const item = out.items[0]
    if (!item.ok) throw new Error(item.code)
    expect(fs.readFileSync(item.serverPath).equals(data)).toBe(true)
    expect(h.logs.some(l => /\[upload-client\] chunk .* retry=1/.test(l))).toBe(true)
  })

  it('a second timeout fails the transfer (TRANSPORT) and aborts the host upload', async () => {
    const h = makeHarness()
    h.hook.invoke = (call, forward) =>
      call.channel === 'upload:chunk' ? Promise.reject(new Error('Remote invoke timeout: upload:chunk')) : forward()
    const out = await uploadToRemoteHost(KEY, [{ kind: 'file', file: blobOf(bytes(100), 'x.bin') }], { api: apiFor(h) })
    expect(out.items[0]).toMatchObject({ ok: false, code: 'TRANSPORT' })
    expect(h.calls.filter(c => c.channel === 'upload:chunk')).toHaveLength(2)
    expect(h.calls.filter(c => c.channel === 'upload:abort')).toHaveLength(1)
    expect(fs.readdirSync(path.join(dataDir, 'uploads', KEY))).toEqual([])
  })

  it('a non-timeout failure is not retried', async () => {
    const h = makeHarness()
    h.hook.invoke = (call, forward) =>
      call.channel === 'upload:chunk' ? Promise.reject(new Error('Not connected to remote server')) : forward()
    const out = await uploadToRemoteHost(KEY, [{ kind: 'file', file: blobOf(bytes(100), 'x.bin') }], { api: apiFor(h) })
    expect(out.items[0]).toMatchObject({ ok: false, code: 'NOT_CONNECTED' })
    expect(h.calls.filter(c => c.channel === 'upload:chunk')).toHaveLength(1)
  })

  it('a host refusal is passed through and not retried', async () => {
    const h = makeHarness()
    h.hook.invoke = (call, forward) =>
      call.channel === 'upload:chunk' ? Promise.resolve({ ok: false, code: 'NO_SPACE', message: 'full' }) : forward()
    const out = await uploadToRemoteHost(KEY, [{ kind: 'file', file: blobOf(bytes(100), 'x.bin') }], { api: apiFor(h) })
    expect(out.items[0]).toMatchObject({ ok: false, code: 'NO_SPACE' })
    expect(h.calls.filter(c => c.channel === 'upload:chunk')).toHaveLength(1)
  })
})

describe('cancel', () => {
  it('AbortSignal mid-file → CANCELLED, host upload aborted, later files not sent', async () => {
    const h = makeHarness()
    const controller = new AbortController()
    h.hook.invoke = async (call, forward) => {
      const result = await forward()
      if (call.channel === 'upload:chunk' && call.args[1] === 0) controller.abort()
      return result
    }
    const out = await uploadToRemoteHost(KEY, [
      { kind: 'file', file: blobOf(bytes(CHUNK * 3), 'a.bin') },
      { kind: 'file', file: blobOf(bytes(10), 'b.bin') },
    ], { api: apiFor(h), signal: controller.signal })
    expect(out.cancelled).toBe(true)
    expect(out.items.map(i => (i.ok ? 'ok' : i.code))).toEqual(['CANCELLED', 'CANCELLED'])
    expect(h.calls.filter(c => c.channel === 'upload:chunk')).toHaveLength(1)
    expect(h.calls.filter(c => c.channel === 'upload:begin')).toHaveLength(1)
    expect(h.calls.filter(c => c.channel === 'upload:abort').length).toBeGreaterThanOrEqual(1)
    expect(fs.readdirSync(path.join(dataDir, 'uploads', KEY))).toEqual([])
    expect(h.client.transferCount).toBe(0)
  })

  it('abort(batchId) during run() ends it with CANCELLED after the chunk in flight', async () => {
    const h = makeHarness()
    const file = path.join(srcDir, 'big.bin')
    fs.writeFileSync(file, bytes(CHUNK * 4))
    h.client.noteSelectedPaths(SENDER, [file])
    const prep = await h.client.prepare(SENDER, KEY, [{ kind: 'path', path: file }])
    if (!prep.ok || !prep.items[0].ok) throw new Error('prepare')
    const id = prep.items[0].transferId
    h.hook.invoke = async (call, forward) => {
      const result = await forward()
      if (call.channel === 'upload:chunk' && call.args[1] === CHUNK) await h.client.abort(SENDER, prep.batchId)
      return result
    }
    expect(await h.client.run(SENDER, id)).toMatchObject({ ok: false, code: 'CANCELLED' })
    expect(h.calls.filter(c => c.channel === 'upload:chunk')).toHaveLength(2)
    expect(h.calls.filter(c => c.channel === 'upload:abort')).toHaveLength(1)
    expect(fs.readdirSync(path.join(dataDir, 'uploads', KEY))).toEqual([])
    expect(await h.client.abort(SENDER, id)).toEqual({ ok: true, aborted: 0 })
  })

  it('abort of a prepared transfer sends nothing to the host', async () => {
    const h = makeHarness()
    const prep = await h.client.prepare(SENDER, KEY, [{ kind: 'file', name: 'a', size: 1 }])
    if (!prep.ok) throw new Error('prepare')
    expect(await h.client.abort(SENDER, prep.batchId)).toEqual({ ok: true, aborted: 1 })
    expect(h.calls).toEqual([])
  })
})

describe('old server / routing (無 live 連線即失敗，不 fallback 本機)', () => {
  it('a host without upload:* → SERVER_TOO_OLD, remaining files not tried', async () => {
    const h = makeHarness()
    h.hook.invoke = call => Promise.reject(new Error(`No handler for channel: ${call.channel}`))
    const out = await uploadToRemoteHost(KEY, [
      { kind: 'file', file: blobOf(bytes(10), 'a.bin') },
      { kind: 'file', file: blobOf(bytes(10), 'b.bin') },
    ], { api: apiFor(h) })
    expect(out.ok).toBe(false)
    expect(out.items.map(i => (i.ok ? 'ok' : i.code))).toEqual(['SERVER_TOO_OLD', 'SERVER_TOO_OLD'])
    expect(h.calls.filter(c => c.channel === 'upload:begin')).toHaveLength(1)
  })

  it('a local window → NOT_REMOTE without reading any source or calling a host', async () => {
    const h = makeHarness()
    h.route.value = { kind: 'local' }
    let read = false
    h.clipboard.png = bytes(10)
    const c = new UploadClient({
      resolveRoute: async () => ({ kind: 'local' }),
      invoke: async () => { throw new Error('must not be called') },
      readClipboardPng: async () => { read = true; return bytes(1) },
      emitProgress: () => {},
      log: quiet,
    })
    expect(await c.prepare(SENDER, KEY, [{ kind: 'clipboard-image' }])).toMatchObject({ ok: false, code: 'NOT_REMOTE' })
    expect(read).toBe(false)
    expect(await h.client.prepare(SENDER, KEY, [{ kind: 'file', name: 'a', size: 1 }])).toMatchObject({ ok: false, code: 'NOT_REMOTE' })
    expect(h.calls).toEqual([])
  })

  it('a remote window whose own connection is down → NOT_CONNECTED', async () => {
    const h = makeHarness()
    h.route.value = { kind: 'refuse', profileId: PROFILE, reason: 'reconnecting' }
    expect(await h.client.prepare(SENDER, KEY, [{ kind: 'file', name: 'a', size: 1 }])).toMatchObject({ ok: false, code: 'NOT_CONNECTED' })
    expect(h.calls).toEqual([])
  })

  it('the connection drops after prepare → NOT_CONNECTED from begin (no other client is used)', async () => {
    const calls: string[] = []
    const c = new UploadClient({
      resolveRoute: async () => ({ kind: 'remote', profileId: PROFILE }),
      invoke: async (profileId, channel) => { calls.push(`${profileId}:${channel}`); throw new UploadNotConnectedError('gone') },
      readClipboardPng: async () => null,
      emitProgress: () => {},
      log: quiet,
    })
    const out = await uploadToRemoteHost(KEY, [{ kind: 'file', file: blobOf(bytes(3), 'a') }], {
      api: {
        prepare: (k, s) => c.prepare(SENDER, k, s),
        begin: id => c.begin(SENDER, id),
        chunk: (id, o, d) => c.chunk(SENDER, id, o, d),
        finish: id => c.finish(SENDER, id),
        run: id => c.run(SENDER, id),
        abort: id => c.abort(SENDER, id),
        onProgress: () => () => {},
      },
    })
    expect(out.items[0]).toMatchObject({ ok: false, code: 'NOT_CONNECTED' })
    expect(calls).toEqual([`${PROFILE}:upload:begin`])
  })
})

describe('limits (D272)', () => {
  it('more than 10 files → TOO_MANY_FILES, nothing prepared', async () => {
    const h = makeHarness()
    const sources = Array.from({ length: 11 }, (_, i) => ({ kind: 'file' as const, name: `f${i}`, size: 1 }))
    expect(await h.client.prepare(SENDER, KEY, sources)).toMatchObject({ ok: false, code: 'TOO_MANY_FILES' })
    expect(h.client.transferCount).toBe(0)
  })

  it('a send over 100 MiB → SEND_TOO_LARGE, nothing uploaded', async () => {
    const h = makeHarness()
    const fifty = UPLOAD_LIMITS.maxFileBytes
    expect(await h.client.prepare(SENDER, KEY, [
      { kind: 'file', name: 'a', size: fifty },
      { kind: 'file', name: 'b', size: fifty },
      { kind: 'file', name: 'c', size: 1 },
    ])).toMatchObject({ ok: false, code: 'SEND_TOO_LARGE' })
    expect(h.client.transferCount).toBe(0)
    const ok = await h.client.prepare(SENDER, KEY, [{ kind: 'file', name: 'a', size: fifty }, { kind: 'file', name: 'b', size: fifty }])
    expect(ok.ok).toBe(true)
    expect(h.calls).toEqual([])
  })

  it('one file over 50 MiB is refused as an item (TOO_LARGE); the others go', async () => {
    const h = makeHarness()
    const prep = await h.client.prepare(SENDER, KEY, [
      { kind: 'file', name: 'big', size: UPLOAD_LIMITS.maxFileBytes + 1 },
      { kind: 'file', name: 'ok', size: 2 },
    ])
    if (!prep.ok) throw new Error('prepare')
    expect(prep.items[0]).toMatchObject({ ok: false, code: 'TOO_LARGE' })
    expect(prep.items[1]).toMatchObject({ ok: true, name: 'ok', size: 2 })
  })

  it('bad session key / bad sources → BAD_ARGS', async () => {
    const h = makeHarness()
    expect(await h.client.prepare(SENDER, '../x', [{ kind: 'file', name: 'a', size: 1 }])).toMatchObject({ code: 'BAD_ARGS' })
    expect(await h.client.prepare(SENDER, KEY, [])).toMatchObject({ code: 'BAD_ARGS' })
    const prep = await h.client.prepare(SENDER, KEY, [{ kind: 'nope' }, { kind: 'file', name: 1, size: 1 }, { kind: 'file', name: 'a', size: -1 }])
    if (!prep.ok) throw new Error('prepare')
    expect(prep.items.map(i => (i.ok ? 'ok' : i.code))).toEqual(['BAD_ARGS', 'BAD_ARGS', 'BAD_ARGS'])
  })

  it(`one window holds at most ${MAX_TRANSFERS_PER_SENDER} transfers`, async () => {
    const h = makeHarness()
    const ten = Array.from({ length: 10 }, (_, i) => ({ kind: 'file' as const, name: `f${i}`, size: 1 }))
    expect((await h.client.prepare(SENDER, KEY, ten)).ok).toBe(true)
    expect((await h.client.prepare(SENDER, KEY, ten)).ok).toBe(true)
    expect(await h.client.prepare(SENDER, KEY, [ten[0]])).toMatchObject({ ok: false, code: 'TOO_MANY' })
    expect((await h.client.prepare(OTHER, KEY, [ten[0]])).ok).toBe(true)
  })

  it('a host QUOTA refusal at begin is passed through', async () => {
    const h = makeHarness()
    h.hook.invoke = (call, forward) =>
      call.channel === 'upload:begin' ? Promise.resolve({ ok: false, code: 'QUOTA', message: 'quota' }) : forward()
    const out = await uploadToRemoteHost(KEY, [{ kind: 'file', file: blobOf(bytes(3), 'a') }, { kind: 'file', file: blobOf(bytes(3), 'b') }], { api: apiFor(h) })
    expect(out.items.map(i => (i.ok ? 'ok' : i.code))).toEqual(['QUOTA', 'QUOTA'])
    expect(h.calls.filter(c => c.channel === 'upload:begin')).toHaveLength(2)
  })
})

describe('path source (dialog-selected only, read by main)', () => {
  it('uploads a path main returned from the attachment dialog', async () => {
    const h = makeHarness()
    const file = path.join(srcDir, '截圖 1.png')
    const data = bytes(CHUNK + 77)
    fs.writeFileSync(file, data)
    h.client.noteSelectedPaths(SENDER, [file])
    const out = await uploadToRemoteHost(KEY, [{ kind: 'path', path: file }], { api: apiFor(h) })
    const item = out.items[0]
    if (!item.ok) throw new Error(item.code)
    expect(item.name).toBe('截圖 1.png')
    expect(fs.readFileSync(item.serverPath).equals(data)).toBe(true)
    expect(h.progress.map(p => p.event.received)).toEqual([CHUNK, data.length])
    expect(h.progress.every(p => p.senderId === SENDER)).toBe(true)
    expect(h.maxInFlight()).toBe(1)
  })

  it('a path the dialog did not return to this window → NOT_SELECTED (never read)', async () => {
    const h = makeHarness()
    const file = path.join(srcDir, 'secret.txt')
    fs.writeFileSync(file, 'x')
    let statted = false
    const c = new UploadClient({
      resolveRoute: async () => ({ kind: 'remote', profileId: PROFILE }),
      invoke: async () => ({ ok: true }),
      readClipboardPng: async () => null,
      emitProgress: () => {},
      stat: async () => { statted = true; return { isFile: true, size: 1 } },
      log: quiet,
    })
    c.noteSelectedPaths(OTHER, [file])
    const prep = await c.prepare(SENDER, KEY, [{ kind: 'path', path: file }])
    if (!prep.ok) throw new Error('prepare')
    expect(prep.items[0]).toMatchObject({ ok: false, code: 'NOT_SELECTED' })
    expect(statted).toBe(false)
    const h2 = await h.client.prepare(SENDER, KEY, [{ kind: 'path', path: file }])
    if (!h2.ok) throw new Error('prepare')
    expect(h2.items[0]).toMatchObject({ code: 'NOT_SELECTED' })
  })

  it('a missing file / a directory / a file that shrinks → SOURCE_ERROR', async () => {
    const h = makeHarness()
    const missing = path.join(srcDir, 'gone.txt')
    h.client.noteSelectedPaths(SENDER, [missing, srcDir])
    const prep = await h.client.prepare(SENDER, KEY, [{ kind: 'path', path: missing }, { kind: 'path', path: srcDir }])
    if (!prep.ok) throw new Error('prepare')
    expect(prep.items.map(i => (i.ok ? 'ok' : i.code))).toEqual(['SOURCE_ERROR', 'SOURCE_ERROR'])

    const file = path.join(srcDir, 'shrink.bin')
    fs.writeFileSync(file, bytes(CHUNK * 2))
    h.client.noteSelectedPaths(SENDER, [file])
    const p2 = await h.client.prepare(SENDER, KEY, [{ kind: 'path', path: file }])
    if (!p2.ok || !p2.items[0].ok) throw new Error('prepare')
    fs.writeFileSync(file, bytes(CHUNK + 1))
    expect(await h.client.run(SENDER, p2.items[0].transferId)).toMatchObject({ ok: false, code: 'SOURCE_ERROR' })
    expect(h.calls.filter(c => c.channel === 'upload:abort')).toHaveLength(1)
  })

  it('disposeSender cancels the window\'s transfers and forgets its dialog paths', async () => {
    const h = makeHarness()
    const file = path.join(srcDir, 'a.txt')
    fs.writeFileSync(file, 'abc')
    h.client.noteSelectedPaths(SENDER, [file])
    const prep = await h.client.prepare(SENDER, KEY, [{ kind: 'file', name: 'a', size: 1 }])
    if (!prep.ok || !prep.items[0].ok) throw new Error('prepare')
    expect((await h.client.begin(SENDER, prep.items[0].transferId)).ok).toBe(true)
    await h.client.disposeSender(SENDER)
    expect(h.client.transferCount).toBe(0)
    expect(h.calls.filter(c => c.channel === 'upload:abort')).toHaveLength(1)
    const again = await h.client.prepare(SENDER, KEY, [{ kind: 'path', path: file }])
    if (!again.ok) throw new Error('prepare')
    expect(again.items[0]).toMatchObject({ code: 'NOT_SELECTED' })
  })
})

describe('clipboard source (read by main)', () => {
  it('uploads the clipboard PNG under a clipboard-<time>.png name', async () => {
    const h = makeHarness()
    h.clipboard.png = bytes(5000)
    const out = await uploadToRemoteHost(KEY, [{ kind: 'clipboard-image' }], { api: apiFor(h) })
    const item = out.items[0]
    if (!item.ok) throw new Error(item.code)
    expect(item.name).toMatch(/^clipboard-\d{8}-\d{6}\.png$/)
    expect(fs.readFileSync(item.serverPath).equals(h.clipboard.png)).toBe(true)
  })

  it('an empty clipboard → SOURCE_ERROR', async () => {
    const h = makeHarness()
    const out = await uploadToRemoteHost(KEY, [{ kind: 'clipboard-image' }], { api: apiFor(h) })
    expect(out.items[0]).toMatchObject({ ok: false, code: 'SOURCE_ERROR' })
    expect(h.calls).toEqual([])
  })
})

describe('idle transfers and logs', () => {
  it('a transfer without a call for 10 minutes is cancelled at the next prepare', async () => {
    const h = makeHarness()
    const prep = await h.client.prepare(SENDER, KEY, [{ kind: 'file', name: 'a', size: 1 }])
    if (!prep.ok || !prep.items[0].ok) throw new Error('prepare')
    const id = prep.items[0].transferId
    expect((await h.client.begin(SENDER, id)).ok).toBe(true)
    h.clock.now += UPLOAD_TTL.partMs + 1
    await h.client.prepare(SENDER, KEY, [{ kind: 'file', name: 'b', size: 1 }])
    expect(await h.client.chunk(SENDER, id, 0, bytes(1))).toMatchObject({ ok: false, code: 'NOT_FOUND' })
    expect(h.calls.filter(c => c.channel === 'upload:abort')).toHaveLength(1)
  })

  it('logs never carry the file name or path', async () => {
    const h = makeHarness()
    const file = path.join(srcDir, 'private-name-zz.txt')
    fs.writeFileSync(file, 'hello')
    h.client.noteSelectedPaths(SENDER, [file])
    await uploadToRemoteHost(KEY, [
      { kind: 'path', path: file },
      { kind: 'file', file: blobOf(bytes(3), 'another-private-yy.md') },
    ], { api: apiFor(h) })
    expect(h.logs.length).toBeGreaterThan(0)
    expect(h.logs.join('\n')).not.toMatch(/private-name-zz|another-private-yy|bat-t0833-src/)
    expect(h.logs.some(l => /ext=\.txt/.test(l) && /session=session-/.test(l))).toBe(true)
  })
})

describe('main.ts / preload wiring', () => {
  const root = path.resolve(__dirname, '..', '..')
  const main = fs.readFileSync(path.join(root, 'electron', 'main.ts'), 'utf8')
  const preload = fs.readFileSync(path.join(root, 'electron', 'preload.ts'), 'utf8')
  const channels = ['upload-client:prepare', 'upload-client:begin', 'upload-client:chunk', 'upload-client:finish', 'upload-client:run', 'upload-client:abort']

  it('upload-client:* are local ipcMain.handle channels: not proxied, not helper-callable', () => {
    for (const channel of channels) {
      expect(main).toContain(`ipcMain.handle('${channel}'`)
      expect(preload).toContain(`ipcRenderer.invoke('${channel}'`)
      expect(PROXIED_CHANNELS.has(channel)).toBe(false)
      expect(Object.prototype.hasOwnProperty.call(HELPER_CHANNEL_ROLES, channel)).toBe(false)
    }
    expect(preload).toContain(`ipcRenderer.on('${UPLOAD_CLIENT_PROGRESS_CHANNEL}'`)
  })

  it('only dialog:select-attachments paths become path sources; invoke goes to the profile\'s own live client', () => {
    const dialog = main.slice(main.indexOf("ipcMain.handle('dialog:select-attachments'"), main.indexOf("ipcMain.handle('upload-client:prepare'"))
    expect(dialog).toContain('uploadClient.noteSelectedPaths(trackUploadSender(event.sender), selection.files)')
    expect(main.match(/noteSelectedPaths\(/g)).toHaveLength(1)
    const wiring = main.slice(main.indexOf('const uploadClient = new UploadClient'), main.indexOf('function trackUploadSender'))
    expect(wiring).toContain('liveRemoteClient(profileId)')
    expect(wiring).not.toContain('invokeHandler')
    const route = main.slice(main.indexOf('async function resolveUploadRoute'), main.indexOf('const uploadClient = new UploadClient'))
    expect(route).toContain('planProfileProxiedInvokeRoute')
    expect(route).toContain("return { kind: 'local' }")
  })
})
