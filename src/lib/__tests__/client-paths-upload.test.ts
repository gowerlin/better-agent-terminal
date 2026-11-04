/**
 * T0834 (PLAN-038 U3): send-time upload helpers of src/lib/client-paths.ts. The panels' RTL
 * coverage is src/__tests__/remote-upload-panels.test.tsx.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import {
  attachmentRefusalText,
  classifyResolvedPaths,
  isUploadableReason,
  resolveAttachmentsForSend,
  uploadFailureReason,
  type SendAttachment,
} from '../client-paths'
import type { RemoteUploadOutcome, RemoteUploadSource, uploadToRemoteHost } from '../remote-upload'

const resolveClientPaths = vi.fn()
const log = vi.fn()

beforeEach(() => {
  resolveClientPaths.mockReset()
  log.mockReset()
  ;(window as unknown as { electronAPI: unknown }).electronAPI = { remote: { resolveClientPaths }, debug: { log } }
})

afterEach(() => {
  vi.restoreAllMocks()
})

/** Echo t(): key + params, so tests see which key and values were used. */
const t = (key: string, params?: Record<string, string | number>) =>
  params ? `${key}${JSON.stringify(params)}` : key

function fakeUpload(outcome: (sources: readonly RemoteUploadSource[]) => RemoteUploadOutcome) {
  return vi.fn(async (_key: string, sources: readonly RemoteUploadSource[]) => outcome(sources)) as unknown as typeof uploadToRemoteHost & ReturnType<typeof vi.fn>
}

describe('classifyResolvedPaths', () => {
  test('reachable / uploadable / refused, paired by input and fail-closed', () => {
    const paths = ['C:\\a', 'C:\\b', 'C:\\c', 'C:\\d', 'C:\\e', 'C:\\f']
    expect(classifyResolvedPaths(paths, [
      { input: 'C:\\a', serverPath: '/mnt/c/a', reachable: true },
      { input: 'C:\\b', serverPath: null, reachable: false, reason: 'ssh-local-file' },
      { input: 'C:\\c', serverPath: null, reachable: false, reason: 'invalid-path' },
      { input: 'C:\\d', serverPath: null, reachable: false }, // no reason → not uploaded
      { input: 'C:\\other', serverPath: null, reachable: false, reason: 'ssh-local-file' }, // mismatched
      { input: 'C:\\f', serverPath: '', reachable: true }, // reachable without a path
    ])).toEqual([
      { kind: 'reachable', serverPath: '/mnt/c/a' },
      { kind: 'upload' },
      { kind: 'rejected' },
      { kind: 'rejected' },
      { kind: 'rejected' },
      { kind: 'rejected' },
    ])
    expect(classifyResolvedPaths(['C:\\a'], null)).toEqual([{ kind: 'rejected' }])
  })

  test('every unreachable reason but invalid-path is uploadable', () => {
    expect(isUploadableReason('ssh-local-file')).toBe(true)
    expect(isUploadableReason('outside-wsl-distro')).toBe(true)
    expect(isUploadableReason('outside-docker-mounts')).toBe(true)
    expect(isUploadableReason('no-translator')).toBe(true)
    expect(isUploadableReason('invalid-path')).toBe(false)
    expect(isUploadableReason(undefined)).toBe(false)
  })
})

describe('resolveAttachmentsForSend', () => {
  const fileA = new Blob(['aaa'])
  const files: SendAttachment[] = [
    { path: 'C:\\x\\local.txt', name: 'local.txt' },
    { path: 'C:\\x\\dropped.txt', name: 'dropped.txt', file: fileA },
    { path: 'C:\\x\\picked.txt', name: 'picked.txt' },
    { path: 'C:\\x\\bad', name: 'bad' },
  ]
  function answers() {
    resolveClientPaths.mockResolvedValue([
      { input: files[0].path, serverPath: '/mnt/c/x/local.txt', reachable: true },
      { input: files[1].path, serverPath: null, reachable: false, reason: 'ssh-local-file' },
      { input: files[2].path, serverPath: null, reachable: false, reason: 'ssh-local-file' },
      { input: files[3].path, serverPath: null, reachable: false, reason: 'invalid-path' },
    ])
  }

  test('no attachments: no IPC at all', async () => {
    const upload = fakeUpload(() => ({ ok: true, cancelled: false, items: [] }))
    expect(await resolveAttachmentsForSend([], { sessionKey: 's', upload })).toEqual({
      serverPaths: [], displayNames: [], rejected: [], uploadFailed: [], uploaded: 0, cancelled: false,
    })
    expect(resolveClientPaths).not.toHaveBeenCalled()
    expect(upload).not.toHaveBeenCalled()
  })

  test('nothing unreachable: no upload, display names as before (last / segment)', async () => {
    resolveClientPaths.mockResolvedValue([{ input: files[0].path, serverPath: '/mnt/c/x/local.txt', reachable: true }])
    const upload = fakeUpload(() => ({ ok: true, cancelled: false, items: [] }))
    const onUploadStart = vi.fn()
    const r = await resolveAttachmentsForSend([files[0]], { sessionKey: 's', upload, onUploadStart })
    expect(r.serverPaths).toEqual(['/mnt/c/x/local.txt'])
    expect(r.displayNames).toEqual(['local.txt'])
    expect(upload).not.toHaveBeenCalled()
    expect(onUploadStart).not.toHaveBeenCalled()
    expect(log).not.toHaveBeenCalled()
  })

  test('a dropped File goes as a file source, a dialog path as a path source; order is kept', async () => {
    answers()
    const upload = fakeUpload(sources => ({
      ok: true,
      cancelled: false,
      items: sources.map((_, i) => ({ ok: true as const, name: `n${i}`, serverPath: `/up/${i}`, size: 3 })),
    }))
    const onUploadStart = vi.fn()
    const r = await resolveAttachmentsForSend(files, { sessionKey: 'sess-1', upload, onUploadStart })
    expect(upload).toHaveBeenCalledTimes(1)
    expect(upload.mock.calls[0][0]).toBe('sess-1')
    expect(upload.mock.calls[0][1]).toEqual([
      { kind: 'file', file: fileA, name: 'dropped.txt' },
      { kind: 'path', path: 'C:\\x\\picked.txt' },
    ])
    expect(onUploadStart).toHaveBeenCalledWith(['C:\\x\\dropped.txt', 'C:\\x\\picked.txt'])
    expect(r).toEqual({
      serverPaths: ['/mnt/c/x/local.txt', '/up/0', '/up/1'],
      displayNames: ['local.txt', 'dropped.txt', 'picked.txt'],
      rejected: ['C:\\x\\bad'],
      uploadFailed: [],
      uploaded: 2,
      cancelled: false,
    })
    // the log has counts only, no names or paths
    const line = String(log.mock.calls.at(-1)?.[0])
    expect(line).toBe('[attachments] upload: files=2 ok=2 failed=0')
  })

  test('progress maps back to the attachment path', async () => {
    answers()
    const onUploadProgress = vi.fn()
    const upload = vi.fn(async (_key: string, sources: readonly RemoteUploadSource[], opts?: { onProgress?: (p: { index: number; received: number; size: number; batchReceived: number; batchSize: number }) => void }) => {
      opts?.onProgress?.({ index: 1, received: 1, size: 4, batchReceived: 4, batchSize: 7 })
      opts?.onProgress?.({ index: 0, received: 0, size: 0, batchReceived: 0, batchSize: 0 })
      return { ok: true, cancelled: false, items: sources.map(() => ({ ok: true as const, name: 'n', serverPath: '/p', size: 1 })) }
    }) as unknown as typeof uploadToRemoteHost
    await resolveAttachmentsForSend(files, { sessionKey: 's', upload, onUploadProgress })
    expect(onUploadProgress).toHaveBeenNthCalledWith(1, 'C:\\x\\picked.txt', 0.25)
    expect(onUploadProgress).toHaveBeenNthCalledWith(2, 'C:\\x\\dropped.txt', 1)
  })

  test('a failed upload is refused with its code; the others still go', async () => {
    answers()
    const upload = fakeUpload(() => ({
      ok: false,
      cancelled: false,
      items: [
        { ok: false, code: 'TOO_LARGE', message: 'big', name: 'dropped.txt' },
        { ok: true, name: 'picked.txt', serverPath: '/up/picked.txt', size: 1 },
      ],
    }))
    const r = await resolveAttachmentsForSend(files, { sessionKey: 's', upload })
    expect(r.serverPaths).toEqual(['/mnt/c/x/local.txt', '/up/picked.txt'])
    expect(r.uploadFailed).toEqual([{ path: 'C:\\x\\dropped.txt', name: 'dropped.txt', code: 'TOO_LARGE' }])
    expect(r.uploaded).toBe(1)
    expect(String(log.mock.calls.at(-1)?.[0])).toBe('[attachments] upload: files=2 ok=1 failed=1 codes=TOO_LARGE')
  })

  test('cancelled: nothing is returned to send', async () => {
    answers()
    const upload = fakeUpload(sources => ({
      ok: false,
      cancelled: true,
      items: sources.map(() => ({ ok: false as const, code: 'CANCELLED' as const, message: 'cancelled' })),
    }))
    const r = await resolveAttachmentsForSend(files, { sessionKey: 's', upload })
    expect(r).toEqual({ serverPaths: [], displayNames: [], rejected: [], uploadFailed: [], uploaded: 0, cancelled: true })
  })

  test('an upload that throws, or a resolver IPC failure, never throws', async () => {
    answers()
    const upload = vi.fn(async () => { throw new Error('boom') }) as unknown as typeof uploadToRemoteHost
    const r = await resolveAttachmentsForSend(files, { sessionKey: 's', upload })
    expect(r.uploadFailed.map(f => f.code)).toEqual(['TRANSPORT', 'TRANSPORT'])

    resolveClientPaths.mockRejectedValueOnce(new Error('ipc'))
    const r2 = await resolveAttachmentsForSend([files[1]], { sessionKey: 's', upload })
    expect(r2.rejected).toEqual(['C:\\x\\dropped.txt'])
    expect(upload).toHaveBeenCalledTimes(1)
  })
})

describe('refusal text', () => {
  test('codes map to reasons with the D272 limits', () => {
    expect(uploadFailureReason('TOO_LARGE')).toEqual({ key: 'claude.uploadError.tooLarge', params: { limit: 50 } })
    expect(uploadFailureReason('SEND_TOO_LARGE')).toEqual({ key: 'claude.uploadError.sendTooLarge', params: { limit: 100 } })
    expect(uploadFailureReason('TOO_MANY_FILES')).toEqual({ key: 'claude.uploadError.tooManyFiles', params: { count: 10 } })
    expect(uploadFailureReason('QUOTA').key).toBe('claude.uploadError.quota')
    expect(uploadFailureReason('TOO_MANY').key).toBe('claude.uploadError.quota')
    expect(uploadFailureReason('NO_SPACE').key).toBe('claude.uploadError.noSpace')
    expect(uploadFailureReason('SERVER_TOO_OLD').key).toBe('claude.uploadError.serverTooOld')
    expect(uploadFailureReason('NOT_CONNECTED').key).toBe('claude.uploadError.connection')
    expect(uploadFailureReason('TRANSPORT').key).toBe('claude.uploadError.connection')
    expect(uploadFailureReason('SOURCE_ERROR').key).toBe('claude.uploadError.source')
    expect(uploadFailureReason('NOT_SELECTED').key).toBe('claude.uploadError.source')
    expect(uploadFailureReason('HASH_MISMATCH')).toEqual({ key: 'claude.uploadError.other', params: { code: 'HASH_MISMATCH' } })
  })

  test('nothing refused → null; only T0437 rejections → the T0437 sentence alone', () => {
    expect(attachmentRefusalText({ rejected: [], uploadFailed: [] }, t)).toBeNull()
    expect(attachmentRefusalText({ rejected: ['C:\\x\\a.txt', '/h/b.md'], uploadFailed: [] }, t))
      .toBe('claude.attachmentNotOnRemoteHost{"files":"a.txt, b.md"}')
  })

  test('upload failures are named in the sentence and grouped by reason', () => {
    const text = attachmentRefusalText({
      rejected: ['C:\\x\\bad'],
      uploadFailed: [
        { path: 'p1', name: 'one.bin', code: 'TOO_LARGE' },
        { path: 'p2', name: 'two.log', code: 'TRANSPORT' },
        { path: 'p3', name: 'three.bin', code: 'TOO_LARGE' },
      ],
    }, t)
    expect(text).toBe(
      'claude.attachmentNotOnRemoteHost{"files":"bad, one.bin, two.log, three.bin"} '
      + 'claude.attachmentUploadFailed{"details":"one.bin, three.bin (claude.uploadError.tooLarge{\\"limit\\":50}); two.log (claude.uploadError.connection)"}',
    )
  })
})
