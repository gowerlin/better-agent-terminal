/**
 * T0835 (T0834 遭遇問題 4): `uploadToRemoteHost` never throws, also when main answers with
 * something that is not a result (`undefined` from a stub or an old preload, a string, …):
 * each such answer is a `TRANSPORT` failure, and the batch is still released.
 */
import { describe, expect, test, vi } from 'vitest'
import { uploadToRemoteHost, type RemoteUploadApi } from '../remote-upload'

function api(overrides: Partial<Record<keyof RemoteUploadApi, unknown>> = {}): RemoteUploadApi {
  const base = {
    prepare: vi.fn(async (_key: string, sources: Array<{ kind: string }>) => ({
      ok: true,
      batchId: 'b',
      items: sources.map((s, i) => ({ ok: true, transferId: `t${i}`, kind: s.kind, name: `n${i}`, size: 1 })),
    })),
    begin: vi.fn(async () => ({ ok: true, chunkBytes: 262144 })),
    chunk: vi.fn(async (_id: string, offset: number, data: Uint8Array) => ({ ok: true, received: offset + data.byteLength })),
    finish: vi.fn(async () => ({ ok: true, serverPath: '/srv/n0', size: 1 })),
    run: vi.fn(async () => ({ ok: true, serverPath: '/srv/n0', size: 1 })),
    abort: vi.fn(async () => ({ ok: true, aborted: 0 })),
    onProgress: vi.fn(() => () => {}),
  }
  return { ...base, ...overrides } as unknown as RemoteUploadApi
}

const file = () => ({ kind: 'file' as const, file: new Blob(['x']), name: 'a.txt' })
const clip = () => ({ kind: 'clipboard-image' as const })

describe('uploadToRemoteHost — answers that are not results', () => {
  test.each([
    ['undefined', undefined],
    ['null', null],
    ['a string', 'ok'],
    ['an object without ok', { batchId: 'b' }],
    ['ok: true without items', { ok: true, batchId: 'b' }],
    ['ok: false without a code', { ok: false }],
  ])('prepare → %s: TRANSPORT for every source, no throw', async (_label, answer) => {
    const a = api({ prepare: vi.fn(async () => answer) })
    const outcome = await uploadToRemoteHost('s', [file(), clip()], { api: a })
    expect(outcome.ok).toBe(false)
    expect(outcome.cancelled).toBe(false)
    expect(outcome.items.map(i => (i.ok ? 'ok' : i.code))).toEqual(['TRANSPORT', 'TRANSPORT'])
  })

  test('prepare item undefined: that source TRANSPORT, the other still uploads', async () => {
    const a = api({
      prepare: vi.fn(async () => ({ ok: true, batchId: 'b', items: [undefined, { ok: true, transferId: 't1', kind: 'clipboard-image', name: 'c.png', size: 1 }] })),
    })
    const outcome = await uploadToRemoteHost('s', [file(), clip()], { api: a })
    expect(outcome.items[0]).toMatchObject({ ok: false, code: 'TRANSPORT' })
    expect(outcome.items[1]).toMatchObject({ ok: true, serverPath: '/srv/n0' })
  })

  test.each(['begin', 'chunk', 'finish'] as const)('file source, %s → undefined: TRANSPORT, transfer aborted', async step => {
    const a = api({ [step]: vi.fn(async () => undefined) })
    const outcome = await uploadToRemoteHost('s', [file()], { api: a })
    expect(outcome.items[0]).toMatchObject({ ok: false, code: 'TRANSPORT' })
    expect(a.abort).toHaveBeenCalledWith('t0')
  })

  test('clipboard source, run → undefined: TRANSPORT (was a TypeError)', async () => {
    const a = api({ run: vi.fn(async () => undefined) })
    const outcome = await uploadToRemoteHost('s', [clip()], { api: a })
    expect(outcome.items[0]).toMatchObject({ ok: false, code: 'TRANSPORT' })
  })

  test('abort returns a non-promise / throws, onProgress returns nothing: the upload still completes', async () => {
    const a = api({
      abort: vi.fn(() => { throw new Error('sync throw') }),
      onProgress: vi.fn(() => undefined),
    })
    const outcome = await uploadToRemoteHost('s', [clip()], { api: a })
    expect(outcome).toMatchObject({ ok: true, items: [{ ok: true, serverPath: '/srv/n0' }] })
    const b = api({ abort: vi.fn(() => undefined), run: vi.fn(async () => undefined) })
    await expect(uploadToRemoteHost('s', [clip()], { api: b })).resolves.toMatchObject({ ok: false })
  })

  test('the whole permissive stub (every call → undefined) refuses without throwing', async () => {
    const undef = vi.fn(async () => undefined)
    const a = { prepare: undef, begin: undef, chunk: undef, finish: undef, run: undef, abort: undef, onProgress: vi.fn(() => undefined) } as unknown as RemoteUploadApi
    const outcome = await uploadToRemoteHost('s', [file()], { api: a })
    expect(outcome.items[0]).toMatchObject({ ok: false, code: 'TRANSPORT' })
  })
})
