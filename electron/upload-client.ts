/**
 * PLAN-038 U2 (T0833): client-side upload driver in Electron main. A remote window's attachments
 * are uploaded to the host the window is bound to, over that profile's own `RemoteClient`, with
 * the host's `upload:*` channels (T0832 回報區〈介面契約〉, electron/handlers/uploads.ts).
 *
 * Renderer API (local `ipcMain.handle`, not PROXIED_CHANNELS; wired in electron/main.ts):
 *   upload-client:prepare(sessionKey, sources)   validate sources + D272 per-send limits, no network
 *   upload-client:begin(transferId)              `file` source: host `upload:begin`
 *   upload-client:chunk(transferId, offset, data) `file` source: one chunk, stop-and-wait
 *   upload-client:finish(transferId)             `file` source: host `upload:finish` → serverPath
 *   upload-client:run(transferId)                `path` / `clipboard-image`: main reads + uploads it all
 *   upload-client:abort(transferId | batchId)    cancel (best-effort host `upload:abort`)
 *   upload-client:progress (main → renderer)     after every chunk the host confirmed
 *
 * 🔴 T0436: main never reads a path the renderer made up. `file` bytes come from the renderer
 * (File.slice); a `path` must be one main returned from `dialog:select-attachments` to that same
 * window (`noteSelectedPaths`); the clipboard image is read by main.
 * 🔴 Routing: the window's own profile connection only (`resolveRoute`); a local window →
 * `NOT_REMOTE`, a remote window without a live connection → `NOT_CONNECTED`. Never this machine.
 * 🔴 Transport (契約 C-4): one chunk in flight per transfer, files of a send one after another
 * (the renderer driver, src/lib/remote-upload.ts), a chunk invoke that times out is resent once
 * (same offset and bytes); anything else fails the transfer and aborts it on the host.
 * 🔴 Logs: transfer / upload id, first 8 chars of the session key, size, extension, result —
 * never the file name, path or content (契約 C-10).
 *
 * No `electron` import: main passes everything electron-specific in `UploadClientDeps`.
 */
import { createHash, randomBytes, type Hash } from 'crypto'
import * as fs from 'fs/promises'
import * as path from 'path'
import { logger } from './logger'
import { UPLOAD_LIMITS, UPLOAD_TTL, isValidSessionKey, logExtension, sanitizeUploadName } from './upload-staging'
import type {
  RemoteUploadBeginResult,
  RemoteUploadChunkResult,
  RemoteUploadErrorCode,
  RemoteUploadFailure,
  RemoteUploadFinishResult,
  RemoteUploadPrepareResult,
  RemoteUploadPreparedItem,
  RemoteUploadProgressEvent,
  RemoteUploadSourceDescriptor,
} from '../src/lib/remote-upload'

/** Main → renderer progress event channel. */
export const UPLOAD_CLIENT_PROGRESS_CHANNEL = 'upload-client:progress'

/** Timeouts of the host invokes (契約 C-4: a chunk that times out is resent once). */
export const UPLOAD_CLIENT_TIMEOUTS = Object.freeze({
  beginMs: 30_000,
  chunkMs: 30_000,
  finishMs: 30_000,
  abortMs: 10_000,
})

/** Transfers one window may hold at once (prepared or open); prepare beyond it → `TOO_MANY`. */
export const MAX_TRANSFERS_PER_SENDER = 20
/** Paths remembered per window from `dialog:select-attachments` (oldest dropped first). */
export const MAX_SELECTED_PATHS_PER_SENDER = 200
/** Longest `file` source name accepted from the renderer (the host sanitizes it further). */
export const MAX_SOURCE_NAME_CHARS = 1024

export type UploadClientRoute =
  | { kind: 'remote'; profileId: string }
  | { kind: 'local' }
  | { kind: 'refuse'; profileId: string; reason: string }

/** Thrown by `deps.invoke` when the profile has no live client (mapped to `NOT_CONNECTED`). */
export class UploadNotConnectedError extends Error {
  readonly code = 'NOT_CONNECTED'
}

export interface UploadClientFileHandle {
  read(buffer: Buffer, offset: number, length: number, position: number): Promise<{ bytesRead: number }>
  close(): Promise<void>
}

export interface UploadClientDeps {
  /** The calling window's route (same rules as the proxied IPC binding in main.ts). */
  resolveRoute: (senderId: number) => Promise<UploadClientRoute>
  /** Invoke on that profile's own live client; throw `UploadNotConnectedError` when there is none. */
  invoke: (profileId: string, channel: string, args: unknown[], timeoutMs: number) => Promise<unknown>
  /** This machine's clipboard image as PNG, or null. */
  readClipboardPng: () => Promise<Buffer | null>
  /** Pushes a progress event to the window (no-op when it is gone). */
  emitProgress: (senderId: number, event: RemoteUploadProgressEvent) => void
  stat?: (filePath: string) => Promise<{ isFile: boolean; size: number }>
  open?: (filePath: string) => Promise<UploadClientFileHandle>
  now?: () => number
  log?: { log: (message: string) => void; warn: (message: string) => void }
  timeouts?: Partial<typeof UPLOAD_CLIENT_TIMEOUTS>
}

type TransferState = 'prepared' | 'open' | 'done' | 'failed'

interface Transfer {
  id: string
  batchId: string
  senderId: number
  profileId: string
  sessionKey: string
  kind: RemoteUploadSourceDescriptor['kind']
  name: string
  size: number
  /** `path` source. */
  filePath?: string
  /** `clipboard-image` source. */
  data?: Buffer
  state: TransferState
  uploadId: string | null
  chunkBytes: number
  sent: number
  hash: Hash
  busy: boolean
  cancelled: boolean
  lastActivity: number
}

const fail = (code: RemoteUploadErrorCode, message: string): RemoteUploadFailure => ({ ok: false, code, message })

const HOST_CODES: ReadonlySet<string> = new Set([
  'BAD_ARGS', 'TOO_LARGE', 'QUOTA', 'TOO_MANY', 'NO_SPACE', 'NOT_FOUND', 'BAD_OFFSET', 'BAD_CHUNK',
  'SIZE_MISMATCH', 'HASH_MISMATCH', 'FORBIDDEN', 'IO_ERROR',
])

/** A `{ ok: false, code, message }` from the host, or null when `value` is not one. */
function hostFailure(value: unknown): RemoteUploadFailure | null {
  if (!value || typeof value !== 'object') return null
  const v = value as { ok?: unknown; code?: unknown; message?: unknown }
  if (v.ok !== false) return null
  const code = typeof v.code === 'string' && HOST_CODES.has(v.code) ? (v.code as RemoteUploadErrorCode) : 'IO_ERROR'
  return fail(code, typeof v.message === 'string' ? v.message : 'host refused the upload')
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** RemoteClient rejects a timed-out invoke with `Remote invoke timeout: <channel>`. */
export function isInvokeTimeout(error: unknown): boolean {
  return /^Remote invoke timeout:/.test(errorMessage(error))
}

/** Maps an invoke rejection to a client code (契約 C-2 transport errors). */
export function classifyInvokeError(error: unknown): RemoteUploadFailure {
  const message = errorMessage(error)
  if (error instanceof UploadNotConnectedError || (error as { code?: unknown })?.code === 'NOT_CONNECTED' || /^Not connected to remote server/.test(message)) {
    return fail('NOT_CONNECTED', message)
  }
  if (/No handler for channel: upload:/.test(message)) return fail('SERVER_TOO_OLD', message)
  if (/Forbidden/.test(message)) return fail('FORBIDDEN', message)
  return fail('TRANSPORT', message)
}

function shortKey(key: string): string {
  return key.slice(0, 8)
}

function toBuffer(data: unknown): Buffer | null {
  if (Buffer.isBuffer(data)) return data
  if (data instanceof Uint8Array) return Buffer.from(data.buffer, data.byteOffset, data.byteLength)
  if (data instanceof ArrayBuffer) return Buffer.from(data)
  return null
}

/** `clipboard-YYYYMMDD-HHMMSS.png` in local time. */
export function clipboardImageName(at: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `clipboard-${at.getFullYear()}${p(at.getMonth() + 1)}${p(at.getDate())}-${p(at.getHours())}${p(at.getMinutes())}${p(at.getSeconds())}.png`
}

const defaultStat = async (filePath: string) => {
  const st = await fs.stat(filePath)
  return { isFile: st.isFile(), size: st.size }
}
const defaultOpen = (filePath: string): Promise<UploadClientFileHandle> => fs.open(filePath, 'r')
const defaultLog = { log: (m: string) => logger.log(m), warn: (m: string) => logger.warn(m) }

export class UploadClient {
  private readonly transfers = new Map<string, Transfer>()
  private readonly selected = new Map<number, string[]>()
  private readonly deps: Required<Omit<UploadClientDeps, 'timeouts'>> & { timeouts: typeof UPLOAD_CLIENT_TIMEOUTS }

  constructor(deps: UploadClientDeps) {
    this.deps = {
      stat: defaultStat,
      open: defaultOpen,
      now: () => Date.now(),
      log: defaultLog,
      ...deps,
      timeouts: { ...UPLOAD_CLIENT_TIMEOUTS, ...deps.timeouts },
    }
  }

  /** Paths main returned to `senderId` from its attachment dialog: the only `path` sources it may upload. */
  noteSelectedPaths(senderId: number, paths: readonly string[]): void {
    const list = (this.selected.get(senderId) ?? []).filter(p => !paths.includes(p))
    for (const p of paths) if (typeof p === 'string' && p) list.push(p)
    this.selected.set(senderId, list.slice(-MAX_SELECTED_PATHS_PER_SENDER))
  }

  private isSelected(senderId: number, filePath: string): boolean {
    return this.selected.get(senderId)?.includes(filePath) ?? false
  }

  /** Number of live transfers (tests / diagnostics). */
  get transferCount(): number {
    return this.transfers.size
  }

  async prepare(senderId: number, sessionKey: unknown, sources: unknown): Promise<RemoteUploadPrepareResult> {
    if (!isValidSessionKey(sessionKey)) return fail('BAD_ARGS', 'sessionKey must match /^[a-zA-Z0-9._-]+$/ (≤ 128 chars)')
    if (!Array.isArray(sources) || sources.length === 0) return fail('BAD_ARGS', 'sources must be a non-empty array')
    const tag = `session=${shortKey(sessionKey)} files=${sources.length}`
    if (sources.length > UPLOAD_LIMITS.maxSendFiles) {
      this.deps.log.log(`[upload-client] prepare ${tag} result=TOO_MANY_FILES`)
      return fail('TOO_MANY_FILES', `at most ${UPLOAD_LIMITS.maxSendFiles} files per send`)
    }
    await this.expireIdle()
    const route = await this.deps.resolveRoute(senderId)
    if (route.kind === 'local') return fail('NOT_REMOTE', 'this window is not a remote window')
    if (route.kind === 'refuse') {
      this.deps.log.log(`[upload-client] prepare ${tag} profile=${route.profileId} result=NOT_CONNECTED reason=${route.reason}`)
      return fail('NOT_CONNECTED', `profile ${route.profileId} is not connected (${route.reason})`)
    }
    const held = [...this.transfers.values()].filter(t => t.senderId === senderId).length
    if (held + sources.length > MAX_TRANSFERS_PER_SENDER) {
      this.deps.log.log(`[upload-client] prepare ${tag} result=TOO_MANY`)
      return fail('TOO_MANY', `this window already holds ${held} transfers`)
    }

    type Ready = { kind: RemoteUploadSourceDescriptor['kind']; name: string; size: number; filePath?: string; data?: Buffer }
    const prepared: Array<Ready | RemoteUploadFailure> = []
    for (const source of sources) prepared.push(await this.readSource(senderId, source))
    const total = prepared.reduce((sum, p) => sum + ('ok' in p ? 0 : p.size), 0)
    if (total > UPLOAD_LIMITS.maxSendBytes) {
      this.deps.log.log(`[upload-client] prepare ${tag} bytes=${total} result=SEND_TOO_LARGE`)
      return fail('SEND_TOO_LARGE', `the files of one send total ${total} bytes; the limit is ${UPLOAD_LIMITS.maxSendBytes}`)
    }

    const batchId = `b-${randomBytes(8).toString('hex')}`
    const now = this.deps.now()
    const items: RemoteUploadPreparedItem[] = prepared.map(p => {
      if ('ok' in p) return p
      const id = `t-${randomBytes(8).toString('hex')}`
      this.transfers.set(id, {
        id, batchId, senderId, profileId: route.profileId, sessionKey,
        kind: p.kind, name: p.name, size: p.size, filePath: p.filePath, data: p.data,
        state: 'prepared', uploadId: null, chunkBytes: UPLOAD_LIMITS.chunkBytes, sent: 0,
        hash: createHash('sha256'), busy: false, cancelled: false, lastActivity: now,
      })
      return { ok: true, transferId: id, kind: p.kind, name: p.name, size: p.size }
    })
    const refused = items.filter(i => !i.ok).length
    this.deps.log.log(`[upload-client] prepare ${tag} batch=${batchId} bytes=${total} refused=${refused} profile=${route.profileId} result=ok`)
    return { ok: true, batchId, items }
  }

  private async readSource(senderId: number, source: unknown): Promise<
    { kind: RemoteUploadSourceDescriptor['kind']; name: string; size: number; filePath?: string; data?: Buffer } | RemoteUploadFailure
  > {
    const s = (source && typeof source === 'object' ? source : {}) as Record<string, unknown>
    if (s.kind === 'file') {
      if (typeof s.name !== 'string' || s.name.length > MAX_SOURCE_NAME_CHARS) return fail('BAD_ARGS', 'file name must be a string')
      if (typeof s.size !== 'number' || !Number.isSafeInteger(s.size) || s.size < 0) return fail('BAD_ARGS', 'file size must be a non-negative integer')
      if (s.size > UPLOAD_LIMITS.maxFileBytes) return fail('TOO_LARGE', `file is larger than ${UPLOAD_LIMITS.maxFileBytes} bytes`)
      return { kind: 'file', name: s.name, size: s.size }
    }
    if (s.kind === 'path') {
      if (typeof s.path !== 'string' || !s.path) return fail('BAD_ARGS', 'path must be a string')
      if (!this.isSelected(senderId, s.path)) return fail('NOT_SELECTED', 'only paths chosen in this window\'s attachment dialog can be uploaded')
      let st: { isFile: boolean; size: number }
      try {
        st = await this.deps.stat(s.path)
      } catch (error) {
        return fail('SOURCE_ERROR', `cannot read the file (${(error as NodeJS.ErrnoException)?.code ?? 'error'})`)
      }
      if (!st.isFile) return fail('SOURCE_ERROR', 'not a regular file')
      if (st.size > UPLOAD_LIMITS.maxFileBytes) return fail('TOO_LARGE', `file is larger than ${UPLOAD_LIMITS.maxFileBytes} bytes`)
      return { kind: 'path', name: path.basename(s.path.replace(/\\/g, '/')), size: st.size, filePath: s.path }
    }
    if (s.kind === 'clipboard-image') {
      let png: Buffer | null
      try {
        png = await this.deps.readClipboardPng()
      } catch (error) {
        return fail('SOURCE_ERROR', `cannot read the clipboard: ${errorMessage(error)}`)
      }
      if (!png || png.length === 0) return fail('SOURCE_ERROR', 'the clipboard has no image')
      if (png.length > UPLOAD_LIMITS.maxFileBytes) return fail('TOO_LARGE', `image is larger than ${UPLOAD_LIMITS.maxFileBytes} bytes`)
      return { kind: 'clipboard-image', name: clipboardImageName(new Date(this.deps.now())), size: png.length, data: png }
    }
    return fail('BAD_ARGS', 'unknown source kind')
  }

  /** The sender's transfer, or a failure (unknown / another window's → NOT_FOUND). */
  private own(senderId: number, transferId: unknown): Transfer | RemoteUploadFailure {
    const t = typeof transferId === 'string' ? this.transfers.get(transferId) : undefined
    if (!t || t.senderId !== senderId) return fail('NOT_FOUND', 'no such transfer')
    if (t.cancelled) return fail('CANCELLED', 'cancelled')
    if (t.busy) return fail('BUSY', 'a call for this transfer is still in flight')
    return t
  }

  private tag(t: Transfer): string {
    return `transfer=${t.id} id=${t.uploadId ?? '-'} session=${shortKey(t.sessionKey)} size=${t.size} ext=${logExtension(sanitizeUploadName(t.name))}`
  }

  /** Ends a transfer on failure: drops it, aborts the host upload (best effort), logs. */
  private async failTransfer(t: Transfer, failure: RemoteUploadFailure, step: string): Promise<RemoteUploadFailure> {
    const result = t.cancelled ? fail('CANCELLED', 'cancelled') : failure
    t.state = 'failed'
    this.transfers.delete(t.id)
    this.deps.log.log(`[upload-client] ${step} ${this.tag(t)} result=${result.code}`)
    await this.abortOnHost(t)
    return result
  }

  private async abortOnHost(t: Transfer): Promise<void> {
    if (!t.uploadId) return
    const uploadId = t.uploadId
    t.uploadId = null
    try {
      await this.deps.invoke(t.profileId, 'upload:abort', [uploadId], this.deps.timeouts.abortMs)
    } catch (error) {
      this.deps.log.warn(`[upload-client] abort transfer=${t.id} id=${uploadId} failed: ${classifyInvokeError(error).code}`)
    }
  }

  /** Runs `step` with the transfer marked busy (stop-and-wait). */
  private async withBusy<T>(t: Transfer, step: () => Promise<T>): Promise<T> {
    t.busy = true
    t.lastActivity = this.deps.now()
    try {
      return await step()
    } finally {
      t.busy = false
      t.lastActivity = this.deps.now()
    }
  }

  async begin(senderId: number, transferId: unknown): Promise<RemoteUploadBeginResult> {
    const t = this.own(senderId, transferId)
    if ('ok' in t) return t
    if (t.state !== 'prepared') return fail('BAD_ARGS', 'transfer already begun')
    if (t.kind !== 'file') return fail('BAD_ARGS', 'begin is for file sources; use run')
    return this.withBusy(t, () => this.openOnHost(t))
  }

  private async openOnHost(t: Transfer): Promise<RemoteUploadBeginResult> {
    let result: unknown
    try {
      result = await this.deps.invoke(t.profileId, 'upload:begin', [t.sessionKey, t.name, t.size], this.deps.timeouts.beginMs)
    } catch (error) {
      return this.failTransfer(t, classifyInvokeError(error), 'begin')
    }
    const refused = hostFailure(result)
    if (refused) return this.failTransfer(t, refused, 'begin')
    const r = result as { ok?: unknown; uploadId?: unknown; chunkBytes?: unknown }
    if (r?.ok !== true || typeof r.uploadId !== 'string' || !r.uploadId) {
      return this.failTransfer(t, fail('TRANSPORT', 'unexpected upload:begin result'), 'begin')
    }
    t.uploadId = r.uploadId
    const hostChunk = typeof r.chunkBytes === 'number' && Number.isSafeInteger(r.chunkBytes) && r.chunkBytes > 0 ? r.chunkBytes : UPLOAD_LIMITS.chunkBytes
    t.chunkBytes = Math.min(hostChunk, UPLOAD_LIMITS.chunkBytes)
    if (t.cancelled) return this.failTransfer(t, fail('CANCELLED', 'cancelled'), 'begin')
    t.state = 'open'
    this.deps.log.log(`[upload-client] begin ${this.tag(t)} result=ok`)
    return { ok: true, chunkBytes: t.chunkBytes }
  }

  async chunk(senderId: number, transferId: unknown, offset: unknown, data: unknown): Promise<RemoteUploadChunkResult> {
    const t = this.own(senderId, transferId)
    if ('ok' in t) return t
    if (t.state !== 'open' || t.kind !== 'file') return fail('BAD_ARGS', 'transfer is not an open file upload')
    const bytes = toBuffer(data)
    if (!bytes || bytes.length === 0 || bytes.length > t.chunkBytes) return fail('BAD_CHUNK', `chunk must be 1–${t.chunkBytes} bytes`)
    if (offset !== t.sent) return fail('BAD_OFFSET', `offset must be ${t.sent}`)
    if (t.sent + bytes.length > t.size) return fail('BAD_CHUNK', 'chunk goes past the declared size')
    return this.withBusy(t, () => this.sendChunk(t, bytes))
  }

  /** One chunk to the host; an invoke timeout is resent once with the same offset and bytes. */
  private async sendChunk(t: Transfer, bytes: Buffer): Promise<RemoteUploadChunkResult> {
    const offset = t.sent
    const args = [t.uploadId, offset, bytes.toString('base64')]
    let result: unknown
    try {
      result = await this.deps.invoke(t.profileId, 'upload:chunk', args, this.deps.timeouts.chunkMs)
    } catch (error) {
      if (!isInvokeTimeout(error) || t.cancelled) return this.failTransfer(t, classifyInvokeError(error), 'chunk')
      this.deps.log.log(`[upload-client] chunk ${this.tag(t)} offset=${offset} retry=1`)
      try {
        result = await this.deps.invoke(t.profileId, 'upload:chunk', args, this.deps.timeouts.chunkMs)
      } catch (retryError) {
        return this.failTransfer(t, classifyInvokeError(retryError), 'chunk')
      }
    }
    const refused = hostFailure(result)
    if (refused) return this.failTransfer(t, refused, 'chunk')
    const received = (result as { ok?: unknown; received?: unknown })?.received
    if ((result as { ok?: unknown })?.ok !== true || received !== offset + bytes.length) {
      return this.failTransfer(t, fail('TRANSPORT', `host confirmed ${String(received)} bytes, expected ${offset + bytes.length}`), 'chunk')
    }
    if (t.cancelled) return this.failTransfer(t, fail('CANCELLED', 'cancelled'), 'chunk')
    t.hash.update(bytes)
    t.sent = received
    this.deps.emitProgress(t.senderId, { batchId: t.batchId, transferId: t.id, received: t.sent, size: t.size })
    return { ok: true, received: t.sent }
  }

  async finish(senderId: number, transferId: unknown): Promise<RemoteUploadFinishResult> {
    const t = this.own(senderId, transferId)
    if ('ok' in t) return t
    if (t.state !== 'open' || t.kind !== 'file') return fail('BAD_ARGS', 'transfer is not an open file upload')
    if (t.sent !== t.size) return fail('SIZE_MISMATCH', `sent ${t.sent} of ${t.size} bytes`)
    return this.withBusy(t, () => this.finishOnHost(t))
  }

  private async finishOnHost(t: Transfer): Promise<RemoteUploadFinishResult> {
    if (t.cancelled) return this.failTransfer(t, fail('CANCELLED', 'cancelled'), 'finish')
    const sha256 = t.hash.digest('hex')
    let result: unknown
    try {
      result = await this.deps.invoke(t.profileId, 'upload:finish', [t.uploadId, sha256], this.deps.timeouts.finishMs)
    } catch (error) {
      return this.failTransfer(t, classifyInvokeError(error), 'finish')
    }
    const refused = hostFailure(result)
    if (refused) return this.failTransfer(t, refused, 'finish')
    const r = result as { ok?: unknown; serverPath?: unknown; size?: unknown }
    if (r?.ok !== true || typeof r.serverPath !== 'string' || !r.serverPath) {
      return this.failTransfer(t, fail('TRANSPORT', 'unexpected upload:finish result'), 'finish')
    }
    t.state = 'done'
    t.uploadId = null
    this.transfers.delete(t.id)
    this.deps.log.log(`[upload-client] finish ${this.tag(t)} result=ok`)
    return { ok: true, serverPath: r.serverPath, size: typeof r.size === 'number' ? r.size : t.size }
  }

  /** `path` / `clipboard-image`: begin, every chunk (stop-and-wait), finish. */
  async run(senderId: number, transferId: unknown): Promise<RemoteUploadFinishResult> {
    const t = this.own(senderId, transferId)
    if ('ok' in t) return t
    if (t.state !== 'prepared') return fail('BAD_ARGS', 'transfer already begun')
    if (t.kind === 'file') return fail('BAD_ARGS', 'run is for path / clipboard sources; use begin / chunk / finish')
    return this.withBusy(t, async () => {
      const begun = await this.openOnHost(t)
      if (!begun.ok) return begun
      let handle: UploadClientFileHandle | null = null
      try {
        if (t.kind === 'path') {
          try {
            handle = await this.deps.open(t.filePath!)
          } catch (error) {
            return this.failTransfer(t, fail('SOURCE_ERROR', `cannot open the file (${(error as NodeJS.ErrnoException)?.code ?? 'error'})`), 'run')
          }
        }
        while (t.sent < t.size) {
          if (t.cancelled) return this.failTransfer(t, fail('CANCELLED', 'cancelled'), 'run')
          const length = Math.min(t.chunkBytes, t.size - t.sent)
          let bytes: Buffer
          if (handle) {
            const buffer = Buffer.alloc(length)
            let bytesRead: number
            try {
              ;({ bytesRead } = await handle.read(buffer, 0, length, t.sent))
            } catch (error) {
              return this.failTransfer(t, fail('SOURCE_ERROR', `cannot read the file (${(error as NodeJS.ErrnoException)?.code ?? 'error'})`), 'run')
            }
            if (bytesRead !== length) return this.failTransfer(t, fail('SOURCE_ERROR', 'the file got shorter while it was uploaded'), 'run')
            bytes = buffer
          } else {
            bytes = t.data!.subarray(t.sent, t.sent + length)
          }
          const sent = await this.sendChunk(t, bytes)
          if (!sent.ok) return sent
        }
        return await this.finishOnHost(t)
      } finally {
        if (handle) await handle.close().catch(() => undefined)
        t.data = undefined
      }
    })
  }

  /**
   * Cancels a transfer, or every transfer of a batch. A call in flight ends with `CANCELLED` once
   * its host invoke returns; the host upload is aborted (best effort). Idempotent.
   */
  async abort(senderId: number, id: unknown): Promise<{ ok: true; aborted: number }> {
    if (typeof id !== 'string') return { ok: true, aborted: 0 }
    const targets = [...this.transfers.values()].filter(t => t.senderId === senderId && (t.id === id || t.batchId === id) && !t.cancelled)
    for (const t of targets) await this.cancel(t)
    return { ok: true, aborted: targets.length }
  }

  private async cancel(t: Transfer): Promise<void> {
    t.cancelled = true
    if (t.busy) return // the call in flight ends it (failTransfer) when its invoke returns
    this.transfers.delete(t.id)
    t.state = 'failed'
    this.deps.log.log(`[upload-client] abort ${this.tag(t)} result=CANCELLED`)
    await this.abortOnHost(t)
  }

  /** The window is gone: cancel its transfers and forget its dialog paths. */
  async disposeSender(senderId: number): Promise<void> {
    this.selected.delete(senderId)
    const targets = [...this.transfers.values()].filter(t => t.senderId === senderId && !t.cancelled)
    for (const t of targets) await this.cancel(t)
  }

  /** Transfers without a call for UPLOAD_TTL.partMs (the renderer went away mid-send) are cancelled. */
  async expireIdle(): Promise<void> {
    const now = this.deps.now()
    const idle = [...this.transfers.values()].filter(t => !t.busy && !t.cancelled && now - t.lastActivity > UPLOAD_TTL.partMs)
    for (const t of idle) await this.cancel(t)
  }
}
