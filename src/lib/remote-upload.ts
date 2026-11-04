/**
 * PLAN-038 U2 (T0833): renderer side of the client upload driver. A remote window (SSH, Docker
 * outside the mounts, another WSL distro) uploads local attachments to the host it is bound to
 * and gets back one host path per file (`serverPath`), or the reason it failed. T0834 (panels)
 * and T0835 (terminal) call `uploadToRemoteHost`; on any failure they fall back to the T0437
 * refusal (D272).
 *
 * Three sources, none of which lets main read a path the renderer made up (T0436):
 *   - `file`             a dropped `File` (or any Blob): the renderer slices it and hands main
 *                        256 KiB chunks (`upload.chunk`), one in flight at a time;
 *   - `path`             a path main itself returned from `dialog:select-attachments` (main keeps
 *                        the list per window and refuses any other path: `NOT_SELECTED`); main reads it;
 *   - `clipboard-image`  main reads the clipboard PNG itself.
 *
 * Main side (`electron/upload-client.ts`) routes by the window's bound profile to its own
 * `RemoteClient` (no live connection → `NOT_CONNECTED`; a local window → `NOT_REMOTE`; never this
 * machine), does stop-and-wait, retries a chunk once on an invoke timeout, computes the sha256,
 * enforces the per-send limits (D272) and pushes progress. Contract with the host: T0832 回報區
 * 〈介面契約〉; docs: docs/agent-guide/remote-file-upload.md「client 端（T0833）」.
 *
 * This module is pure at import time (no `window` access until a function runs).
 */

/** Host error codes (`UploadErrorCode`, electron/upload-staging.ts; T0832 契約 C-3). */
export type RemoteUploadHostErrorCode =
  | 'BAD_ARGS'
  | 'TOO_LARGE'
  | 'QUOTA'
  | 'TOO_MANY'
  | 'NO_SPACE'
  | 'NOT_FOUND'
  | 'BAD_OFFSET'
  | 'BAD_CHUNK'
  | 'SIZE_MISMATCH'
  | 'HASH_MISMATCH'
  | 'FORBIDDEN'
  | 'IO_ERROR'

/** Codes only the client driver produces. */
export type RemoteUploadClientOnlyErrorCode =
  /** The window is a local window: nothing to upload, attach the path as before. */
  | 'NOT_REMOTE'
  /** Remote window without a live connection of its own profile (never falls back to this machine). */
  | 'NOT_CONNECTED'
  /** The host has no `upload:*` handler (bat-server before T0832). */
  | 'SERVER_TOO_OLD'
  /** An invoke failed or timed out (a chunk: after its one retry); the connection may be gone. */
  | 'TRANSPORT'
  /** Cancelled by the caller. */
  | 'CANCELLED'
  /** A call for a transfer that already has one in flight (stop-and-wait). */
  | 'BUSY'
  /** A `path` source main did not return from `dialog:select-attachments` for this window. */
  | 'NOT_SELECTED'
  /** The source could not be read: missing / not a file / changed while reading / empty clipboard. */
  | 'SOURCE_ERROR'
  /** All files of one send together are over `maxSendBytes`: nothing is uploaded. */
  | 'SEND_TOO_LARGE'
  /** More than `maxSendFiles` files in one send: nothing is uploaded. */
  | 'TOO_MANY_FILES'

export type RemoteUploadErrorCode = RemoteUploadHostErrorCode | RemoteUploadClientOnlyErrorCode

export type RemoteUploadFailure = { ok: false; code: RemoteUploadErrorCode; message: string }

/** D272 limits, mirrored from `UPLOAD_LIMITS` (electron/upload-staging.ts; parity test in electron/__tests__/upload-client.test.ts). */
export const REMOTE_UPLOAD_LIMITS = Object.freeze({
  maxFileBytes: 50 * 1024 * 1024,
  maxSendBytes: 100 * 1024 * 1024,
  maxSendFiles: 10,
  chunkBytes: 256 * 1024,
})

/** What the renderer sends main in `upload.prepare` (no File objects cross IPC here). */
export type RemoteUploadSourceDescriptor =
  | { kind: 'file'; name: string; size: number }
  | { kind: 'path'; path: string }
  | { kind: 'clipboard-image' }

export type RemoteUploadPreparedItem =
  | { ok: true; transferId: string; kind: RemoteUploadSourceDescriptor['kind']; name: string; size: number }
  | RemoteUploadFailure

export type RemoteUploadPrepareResult =
  | { ok: true; batchId: string; items: RemoteUploadPreparedItem[] }
  | RemoteUploadFailure

export type RemoteUploadBeginResult = { ok: true; chunkBytes: number } | RemoteUploadFailure
export type RemoteUploadChunkResult = { ok: true; received: number } | RemoteUploadFailure
export type RemoteUploadFinishResult = { ok: true; serverPath: string; size: number } | RemoteUploadFailure

/** Pushed by main after every chunk the host confirmed (`upload-client:progress`). */
export interface RemoteUploadProgressEvent {
  batchId: string
  transferId: string
  received: number
  size: number
}

/** `window.electronAPI.upload` (electron/preload.ts). */
export interface RemoteUploadApi {
  prepare: (sessionKey: string, sources: RemoteUploadSourceDescriptor[]) => Promise<RemoteUploadPrepareResult>
  /** `file` sources only: opens the upload on the host. */
  begin: (transferId: string) => Promise<RemoteUploadBeginResult>
  /** `file` sources only: one chunk (≤ chunkBytes) at `offset` = bytes already confirmed. */
  chunk: (transferId: string, offset: number, data: Uint8Array) => Promise<RemoteUploadChunkResult>
  /** `file` sources only: all bytes sent → host path. */
  finish: (transferId: string) => Promise<RemoteUploadFinishResult>
  /** `path` / `clipboard-image` sources: main uploads the whole file. */
  run: (transferId: string) => Promise<RemoteUploadFinishResult>
  /** A transfer id or a batch id (= every transfer of the batch). Idempotent. */
  abort: (id: string) => Promise<{ ok: true; aborted: number }>
  onProgress: (callback: (event: RemoteUploadProgressEvent) => void) => () => void
}

/** One attachment to upload. `file`: a dropped File (its `name` is used unless `name` is given). */
export type RemoteUploadSource =
  | { kind: 'file'; file: Blob; name?: string }
  | { kind: 'path'; path: string }
  | { kind: 'clipboard-image' }

export type RemoteUploadItemResult =
  | { ok: true; name: string; serverPath: string; size: number }
  | (RemoteUploadFailure & { name?: string })

export interface RemoteUploadProgress {
  /** Index into `sources` of the file being uploaded. */
  index: number
  received: number
  size: number
  /** Confirmed bytes of the whole send / total bytes of the files that will be uploaded. */
  batchReceived: number
  batchSize: number
}

export interface RemoteUploadOptions {
  onProgress?: (progress: RemoteUploadProgress) => void
  signal?: AbortSignal
  /** Defaults to `window.electronAPI.upload`. */
  api?: RemoteUploadApi
}

export interface RemoteUploadOutcome {
  /** Every item uploaded. */
  ok: boolean
  /** Set when the user cancelled (items not finished carry `CANCELLED`). */
  cancelled: boolean
  /** One result per source, same order. */
  items: RemoteUploadItemResult[]
}

/**
 * Failures after which the remaining files are not tried (same answer for each of them, or a
 * connection that is gone — every further chunk would wait for its own timeout).
 */
const STOP_REMAINING: ReadonlySet<RemoteUploadErrorCode> = new Set<RemoteUploadErrorCode>([
  'NOT_REMOTE', 'NOT_CONNECTED', 'SERVER_TOO_OLD', 'TRANSPORT', 'CANCELLED', 'FORBIDDEN',
])

/** True when the failure means "use the T0437 refusal for the rest of this send too". */
export function stopsRemainingUploads(code: RemoteUploadErrorCode): boolean {
  return STOP_REMAINING.has(code)
}

function failure(code: RemoteUploadErrorCode, message: string, name?: string): RemoteUploadItemResult {
  return name === undefined ? { ok: false, code, message } : { ok: false, code, message, name }
}

function defaultApi(): RemoteUploadApi | null {
  const api = (globalThis as { window?: { electronAPI?: { upload?: RemoteUploadApi } } }).window?.electronAPI?.upload
  return api ?? null
}

/** Bytes of `blob[start, end)`; `Blob.arrayBuffer` where available, FileReader otherwise. */
export async function readBlobSlice(blob: Blob, start: number, end: number): Promise<Uint8Array> {
  const part = blob.slice(start, end)
  if (typeof part.arrayBuffer === 'function') return new Uint8Array(await part.arrayBuffer())
  return new Promise<Uint8Array>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer))
    reader.onerror = () => reject(reader.error ?? new Error('FileReader failed'))
    reader.readAsArrayBuffer(part)
  })
}

function sourceName(source: RemoteUploadSource): string | undefined {
  if (source.kind === 'file') return source.name ?? (source.file as Blob & { name?: string }).name ?? ''
  return undefined
}

function toDescriptor(source: RemoteUploadSource): RemoteUploadSourceDescriptor {
  if (source.kind === 'file') return { kind: 'file', name: sourceName(source) ?? '', size: source.file.size }
  if (source.kind === 'path') return { kind: 'path', path: source.path }
  return { kind: 'clipboard-image' }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/**
 * T0835: what main answered, as a result — an answer that is not an object with a boolean `ok`
 * (`undefined` from a stub or an old preload, a string, …) is a `TRANSPORT` failure, never a throw.
 */
function asResult<T extends { ok: boolean }>(value: unknown, what: string): T | RemoteUploadFailure {
  if (typeof value === 'object' && value !== null && typeof (value as { ok?: unknown }).ok === 'boolean') {
    const result = value as T | RemoteUploadFailure
    if (result.ok === false && typeof (result as RemoteUploadFailure).code !== 'string') {
      return { ok: false, code: 'TRANSPORT', message: `main answered ${what} with a failure without a code` }
    }
    return result
  }
  return { ok: false, code: 'TRANSPORT', message: `main answered ${what} without a result` }
}

/** `api.abort` without ever throwing (a stub may return a non-promise or throw synchronously). */
function abortQuietly(api: RemoteUploadApi, id: string): void {
  try {
    void Promise.resolve(api.abort(id)).catch(() => undefined)
  } catch {
    // nothing to release
  }
}

/**
 * Uploads `sources` to the host the calling window is bound to, one file after another (never in
 * parallel), and returns one result per source. Never throws: IPC errors, and answers from main
 * that are not results (e.g. `undefined`, T0835), become `TRANSPORT`.
 * `sessionKey`: the panel's sessionId, or the terminal tab's PTY id (T0832 契約 C-5).
 */
export async function uploadToRemoteHost(
  sessionKey: string,
  sources: readonly RemoteUploadSource[],
  options: RemoteUploadOptions = {},
): Promise<RemoteUploadOutcome> {
  const api = options.api ?? defaultApi()
  const names = sources.map(sourceName)
  const all = (code: RemoteUploadErrorCode, message: string): RemoteUploadOutcome => ({
    ok: false,
    cancelled: code === 'CANCELLED',
    items: sources.map((_, i) => failure(code, message, names[i])),
  })
  if (sources.length === 0) return { ok: true, cancelled: false, items: [] }
  if (!api) return all('NOT_REMOTE', 'upload API is not available in this window')
  if (options.signal?.aborted) return all('CANCELLED', 'cancelled before the upload started')

  let prepared: RemoteUploadPrepareResult
  try {
    prepared = asResult<RemoteUploadPrepareResult>(await api.prepare(sessionKey, sources.map(toDescriptor)), 'prepare')
  } catch (error) {
    return all('TRANSPORT', errorMessage(error))
  }
  if (!prepared.ok) return all(prepared.code, prepared.message)
  if (!Array.isArray(prepared.items) || typeof prepared.batchId !== 'string') {
    return all('TRANSPORT', 'main answered prepare without a batch')
  }
  const batchId = prepared.batchId
  const items = prepared.items.map((item): RemoteUploadPreparedItem => asResult<RemoteUploadPreparedItem>(item, 'prepare'))

  const results: RemoteUploadItemResult[] = sources.map((_, i) => {
    const item = items[i]
    if (!item) return failure('BAD_ARGS', 'main returned fewer items than sources', names[i])
    if (!item.ok) return failure(item.code, item.message, names[i])
    return failure('CANCELLED', 'not uploaded', item.name)
  })
  const batchSize = items.reduce((sum, item) => sum + (item.ok ? item.size : 0), 0)
  let batchDone = 0
  let current: { index: number; transferId: string; size: number } | null = null

  let unsubscribe: () => void = () => {}
  try {
    const off = api.onProgress(event => {
      if (!event || event.batchId !== batchId || !current || event.transferId !== current.transferId) return
      options.onProgress?.({
        index: current.index,
        received: event.received,
        size: event.size,
        batchReceived: batchDone + event.received,
        batchSize,
      })
    })
    if (typeof off === 'function') unsubscribe = off
  } catch {
    // no progress events; the upload itself still runs
  }
  let cancelled = false
  const onAbort = () => {
    cancelled = true
    abortQuietly(api, batchId)
  }
  options.signal?.addEventListener('abort', onAbort, { once: true })

  try {
    let stop: RemoteUploadFailure | null = null
    for (let i = 0; i < sources.length; i++) {
      const item = items[i]
      if (!item || !item.ok) continue
      if (cancelled || options.signal?.aborted) {
        cancelled = true
        results[i] = failure('CANCELLED', 'cancelled', item.name)
        continue
      }
      if (stop) {
        results[i] = failure(stop.code, stop.message, item.name)
        continue
      }
      current = { index: i, transferId: item.transferId, size: item.size }
      const source = sources[i]
      let result: RemoteUploadFinishResult
      try {
        result = source.kind === 'file'
          ? await sendFile(api, item.transferId, source.file, () => cancelled || !!options.signal?.aborted)
          : asResult<RemoteUploadFinishResult>(await api.run(item.transferId), 'run')
      } catch (error) {
        result = { ok: false, code: 'TRANSPORT', message: errorMessage(error) }
      }
      current = null
      if (result.ok) {
        results[i] = { ok: true, name: item.name, serverPath: result.serverPath, size: result.size }
        batchDone += item.size
        continue
      }
      // Main drops a transfer on its own failure; abort covers the cases it never saw (a throw here).
      abortQuietly(api, item.transferId)
      const code: RemoteUploadErrorCode = cancelled || options.signal?.aborted ? 'CANCELLED' : result.code
      if (code === 'CANCELLED') cancelled = true
      results[i] = failure(code, result.message, item.name)
      if (stopsRemainingUploads(code)) stop = { ok: false, code, message: result.message }
    }
  } finally {
    options.signal?.removeEventListener('abort', onAbort)
    try {
      unsubscribe()
    } catch {
      // already gone
    }
    // Releases what is left of the batch in main (prepared, never started). Idempotent.
    abortQuietly(api, batchId)
  }
  return { ok: results.every(r => r.ok), cancelled, items: results }
}

/** `file` source: begin → chunks (stop-and-wait) → finish. */
async function sendFile(
  api: RemoteUploadApi,
  transferId: string,
  file: Blob,
  isCancelled: () => boolean,
): Promise<RemoteUploadFinishResult> {
  const begun = asResult<RemoteUploadBeginResult>(await api.begin(transferId), 'begin')
  if (!begun.ok) return begun
  const chunkBytes = Math.max(1, Math.min(begun.chunkBytes, REMOTE_UPLOAD_LIMITS.chunkBytes))
  let offset = 0
  while (offset < file.size) {
    if (isCancelled()) return { ok: false, code: 'CANCELLED', message: 'cancelled' }
    let bytes: Uint8Array
    try {
      bytes = await readBlobSlice(file, offset, Math.min(file.size, offset + chunkBytes))
    } catch (error) {
      return { ok: false, code: 'SOURCE_ERROR', message: `could not read the file: ${errorMessage(error)}` }
    }
    if (bytes.byteLength === 0) return { ok: false, code: 'SOURCE_ERROR', message: 'the file got shorter while it was read' }
    const sent = asResult<RemoteUploadChunkResult>(await api.chunk(transferId, offset, bytes), 'chunk')
    if (!sent.ok) return sent
    if (sent.received !== offset + bytes.byteLength) {
      return { ok: false, code: 'TRANSPORT', message: `host confirmed ${sent.received} bytes, expected ${offset + bytes.byteLength}` }
    }
    offset = sent.received
  }
  if (isCancelled()) return { ok: false, code: 'CANCELLED', message: 'cancelled' }
  return asResult<RemoteUploadFinishResult>(await api.finish(transferId), 'finish')
}
