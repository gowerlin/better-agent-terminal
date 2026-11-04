/**
 * PLAN-038 U2 (T0833): renderer upload driver (src/lib/remote-upload.ts) against a fake
 * `window.electronAPI.upload`: sequencing (one file and one chunk at a time), batch-level
 * failures, per-item failures, stop-on-fatal, cancel, progress, and the default API lookup.
 * The main side against a real host is electron/__tests__/upload-client.test.ts.
 */
import { afterEach, describe, expect, it } from 'vitest'
import {
  readBlobSlice,
  stopsRemainingUploads,
  uploadToRemoteHost,
  type RemoteUploadApi,
  type RemoteUploadFinishResult,
  type RemoteUploadPrepareResult,
  type RemoteUploadProgressEvent,
  type RemoteUploadSourceDescriptor,
} from '../remote-upload'

type Log = string[]

function fakeApi(opts: {
  prepare?: (sources: RemoteUploadSourceDescriptor[]) => RemoteUploadPrepareResult
  run?: (id: string) => Promise<RemoteUploadFinishResult>
  chunkBytes?: number
  chunkHook?: (id: string, offset: number) => Promise<void> | void
} = {}): { api: RemoteUploadApi; log: Log; emit: (e: RemoteUploadProgressEvent) => void; received: Map<string, number[]> } {
  const log: Log = []
  const listeners = new Set<(e: RemoteUploadProgressEvent) => void>()
  const emit = (e: RemoteUploadProgressEvent) => { for (const l of listeners) l(e) }
  const received = new Map<string, number[]>()
  const sizes = new Map<string, number>()
  let inFlight = 0
  const track = async <T>(name: string, f: () => Promise<T>): Promise<T> => {
    inFlight++
    if (inFlight > 1) throw new Error('two calls in flight')
    log.push(name)
    try { return await f() } finally { inFlight-- }
  }
  const api: RemoteUploadApi = {
    prepare: async (_key, sources) => {
      log.push(`prepare:${sources.length}`)
      if (opts.prepare) return opts.prepare(sources)
      return {
        ok: true,
        batchId: 'b1',
        items: sources.map((s, i) => {
          const size = s.kind === 'file' ? s.size : 10
          sizes.set(`t${i}`, size)
          return { ok: true as const, transferId: `t${i}`, kind: s.kind, name: s.kind === 'file' ? s.name : `n${i}`, size }
        }),
      }
    },
    begin: id => track(`begin:${id}`, async () => ({ ok: true as const, chunkBytes: opts.chunkBytes ?? 4 })),
    chunk: (id, offset, data) => track(`chunk:${id}:${offset}:${data.byteLength}`, async () => {
      await opts.chunkHook?.(id, offset)
      const got = [...(received.get(id) ?? []), ...data]
      received.set(id, got)
      emit({ batchId: 'b1', transferId: id, received: offset + data.byteLength, size: sizes.get(id) ?? 0 })
      return { ok: true as const, received: offset + data.byteLength }
    }),
    finish: id => track(`finish:${id}`, async () => ({ ok: true as const, serverPath: `/srv/${id}`, size: sizes.get(id) ?? 0 })),
    run: id => track(`run:${id}`, () => opts.run ? opts.run(id) : Promise.resolve({ ok: true as const, serverPath: `/srv/${id}`, size: 10 })),
    abort: async id => { log.push(`abort:${id}`); return { ok: true as const, aborted: 0 } },
    onProgress: cb => { listeners.add(cb); return () => listeners.delete(cb) },
  }
  return { api, log, emit, received }
}

const blob = (text: string, name = 'f.txt') => new File([text], name)

afterEach(() => {
  delete (window as unknown as { electronAPI?: unknown }).electronAPI
})

describe('uploadToRemoteHost', () => {
  it('nothing to upload → ok with no items, no IPC', async () => {
    const { api, log } = fakeApi()
    expect(await uploadToRemoteHost('k', [], { api })).toEqual({ ok: true, cancelled: false, items: [] })
    expect(log).toEqual([])
  })

  it('without window.electronAPI.upload → NOT_REMOTE for every item', async () => {
    const out = await uploadToRemoteHost('k', [{ kind: 'file', file: blob('a', 'a.txt') }])
    expect(out.items).toEqual([{ ok: false, code: 'NOT_REMOTE', message: expect.any(String), name: 'a.txt' }])
  })

  it('uses window.electronAPI.upload by default', async () => {
    const { api, log } = fakeApi()
    ;(window as unknown as { electronAPI: unknown }).electronAPI = { upload: api }
    const out = await uploadToRemoteHost('k', [{ kind: 'clipboard-image' }])
    expect(out.ok).toBe(true)
    expect(log).toContain('run:t0')
  })

  it('file sources: begin → chunks of chunkBytes (one at a time) → finish; files in order', async () => {
    const { api, log, received } = fakeApi({ chunkBytes: 4 })
    const out = await uploadToRemoteHost('k', [
      { kind: 'file', file: blob('0123456789', 'a.txt') },
      { kind: 'path', path: 'C:\\x\\b.bin' },
      { kind: 'file', file: blob('xy'), name: 'renamed.txt' },
    ], { api })
    expect(out.ok).toBe(true)
    expect(log).toEqual([
      'prepare:3',
      'begin:t0', 'chunk:t0:0:4', 'chunk:t0:4:4', 'chunk:t0:8:2', 'finish:t0',
      'run:t1',
      'begin:t2', 'chunk:t2:0:2', 'finish:t2',
      'abort:b1',
    ])
    expect(String.fromCharCode(...(received.get('t0') ?? []))).toBe('0123456789')
    expect(out.items).toEqual([
      { ok: true, name: 'a.txt', serverPath: '/srv/t0', size: 10 },
      { ok: true, name: 'n1', serverPath: '/srv/t1', size: 10 },
      { ok: true, name: 'renamed.txt', serverPath: '/srv/t2', size: 2 },
    ])
  })

  it('passes descriptors only (name / size / path), never the File object', async () => {
    let seen: RemoteUploadSourceDescriptor[] = []
    const { api } = fakeApi({ prepare: s => { seen = s; return { ok: false, code: 'NOT_CONNECTED', message: 'down' } } })
    await uploadToRemoteHost('k', [{ kind: 'file', file: blob('abc', 'a.txt') }, { kind: 'path', path: '/p' }, { kind: 'clipboard-image' }], { api })
    expect(seen).toEqual([{ kind: 'file', name: 'a.txt', size: 3 }, { kind: 'path', path: '/p' }, { kind: 'clipboard-image' }])
  })

  it('a batch-level failure (SEND_TOO_LARGE / NOT_CONNECTED) fails every item, nothing uploaded', async () => {
    const { api, log } = fakeApi({ prepare: () => ({ ok: false, code: 'SEND_TOO_LARGE', message: 'too big' }) })
    const out = await uploadToRemoteHost('k', [{ kind: 'file', file: blob('a') }, { kind: 'clipboard-image' }], { api })
    expect(out.ok).toBe(false)
    expect(out.items.map(i => (i.ok ? 'ok' : i.code))).toEqual(['SEND_TOO_LARGE', 'SEND_TOO_LARGE'])
    expect(log).toEqual(['prepare:2'])
  })

  it('a prepare that throws → TRANSPORT', async () => {
    const { api } = fakeApi()
    api.prepare = async () => { throw new Error('ipc gone') }
    const out = await uploadToRemoteHost('k', [{ kind: 'clipboard-image' }], { api })
    expect(out.items[0]).toMatchObject({ ok: false, code: 'TRANSPORT', message: 'ipc gone' })
  })

  it('an item refused at prepare fails alone; the others still upload', async () => {
    const { api, log } = fakeApi({
      prepare: () => ({
        ok: true,
        batchId: 'b1',
        items: [
          { ok: false, code: 'TOO_LARGE', message: 'big' },
          { ok: true, transferId: 't1', kind: 'path', name: 'b', size: 10 },
        ],
      }),
    })
    const out = await uploadToRemoteHost('k', [{ kind: 'file', file: blob('a', 'a.txt') }, { kind: 'path', path: '/b' }], { api })
    expect(out.items[0]).toMatchObject({ ok: false, code: 'TOO_LARGE', name: 'a.txt' })
    expect(out.items[1]).toMatchObject({ ok: true, serverPath: '/srv/t1' })
    expect(log).toContain('run:t1')
  })

  it('an item failure that is not fatal (QUOTA) lets the next file go; a fatal one (SERVER_TOO_OLD) stops the rest', async () => {
    const results: Record<string, RemoteUploadFinishResult> = {
      t0: { ok: false, code: 'QUOTA', message: 'q' },
      t1: { ok: false, code: 'SERVER_TOO_OLD', message: 'old' },
    }
    const { api, log } = fakeApi({ run: async id => results[id] ?? { ok: true, serverPath: `/srv/${id}`, size: 10 } })
    const out = await uploadToRemoteHost('k', [{ kind: 'path', path: '/a' }, { kind: 'path', path: '/b' }, { kind: 'path', path: '/c' }], { api })
    expect(out.items.map(i => (i.ok ? 'ok' : i.code))).toEqual(['QUOTA', 'SERVER_TOO_OLD', 'SERVER_TOO_OLD'])
    expect(log.filter(l => l.startsWith('run:'))).toEqual(['run:t0', 'run:t1'])
    expect(log).toContain('abort:t0')
  })

  it('stopsRemainingUploads: connection-level codes only', () => {
    for (const code of ['NOT_REMOTE', 'NOT_CONNECTED', 'SERVER_TOO_OLD', 'TRANSPORT', 'CANCELLED', 'FORBIDDEN'] as const) {
      expect(stopsRemainingUploads(code)).toBe(true)
    }
    for (const code of ['QUOTA', 'TOO_LARGE', 'HASH_MISMATCH', 'NO_SPACE', 'SOURCE_ERROR', 'NOT_SELECTED'] as const) {
      expect(stopsRemainingUploads(code)).toBe(false)
    }
  })

  it('cancel mid-file: no more chunks, batch aborted, every unfinished item CANCELLED', async () => {
    const controller = new AbortController()
    const { api, log } = fakeApi({ chunkBytes: 2, chunkHook: (_id, offset) => { if (offset === 2) controller.abort() } })
    const out = await uploadToRemoteHost('k', [{ kind: 'file', file: blob('abcdefgh') }, { kind: 'clipboard-image' }], { api, signal: controller.signal })
    expect(out.cancelled).toBe(true)
    expect(out.ok).toBe(false)
    expect(out.items.map(i => (i.ok ? 'ok' : i.code))).toEqual(['CANCELLED', 'CANCELLED'])
    expect(log.filter(l => l.startsWith('chunk:'))).toEqual(['chunk:t0:0:2', 'chunk:t0:2:2'])
    expect(log).not.toContain('run:t1')
    expect(log.filter(l => l === 'abort:b1').length).toBeGreaterThanOrEqual(1)
  })

  it('an already aborted signal uploads nothing', async () => {
    const controller = new AbortController()
    controller.abort()
    const { api, log } = fakeApi()
    const out = await uploadToRemoteHost('k', [{ kind: 'clipboard-image' }], { api, signal: controller.signal })
    expect(out).toMatchObject({ ok: false, cancelled: true })
    expect(log).toEqual([])
  })

  it('progress: per file and for the whole send, only for this batch\'s current transfer', async () => {
    const { api, emit } = fakeApi({ chunkBytes: 4 })
    const seen: Array<[number, number, number, number]> = []
    api.run = async id => {
      emit({ batchId: 'other', transferId: id, received: 99, size: 99 })
      emit({ batchId: 'b1', transferId: id, received: 5, size: 10 })
      emit({ batchId: 'b1', transferId: id, received: 10, size: 10 })
      return { ok: true, serverPath: `/srv/${id}`, size: 10 }
    }
    await uploadToRemoteHost('k', [{ kind: 'file', file: blob('123456') }, { kind: 'path', path: '/b' }], {
      api,
      onProgress: p => seen.push([p.index, p.received, p.batchReceived, p.batchSize]),
    })
    expect(seen).toEqual([
      [0, 4, 4, 16], [0, 6, 6, 16],
      [1, 5, 11, 16], [1, 10, 16, 16],
    ])
  })

  it('a host that confirms the wrong byte count → TRANSPORT (no endless loop)', async () => {
    const { api } = fakeApi()
    api.chunk = async () => ({ ok: true, received: 0 })
    const out = await uploadToRemoteHost('k', [{ kind: 'file', file: blob('abc') }], { api })
    expect(out.items[0]).toMatchObject({ ok: false, code: 'TRANSPORT' })
  })

  it('a chunk call that throws → TRANSPORT and the transfer is aborted', async () => {
    const { api, log } = fakeApi()
    api.chunk = async () => { throw new Error('ipc') }
    const out = await uploadToRemoteHost('k', [{ kind: 'file', file: blob('abc') }, { kind: 'path', path: '/b' }], { api })
    expect(out.items.map(i => (i.ok ? 'ok' : i.code))).toEqual(['TRANSPORT', 'TRANSPORT'])
    expect(log).toContain('abort:t0')
  })
})

describe('readBlobSlice', () => {
  it('reads a byte range', async () => {
    const bytes = await readBlobSlice(new Blob([new Uint8Array([1, 2, 3, 4, 5])]), 1, 4)
    expect([...bytes]).toEqual([2, 3, 4])
  })
})
