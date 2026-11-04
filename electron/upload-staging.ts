/**
 * PLAN-038 U1 (T0832): host-side staging for files a client window uploads to the host it is
 * bound to (SSH / Docker outside the mounts / another WSL distro, where the agent on the host
 * cannot read the client's path; T0828 回報區 is the design SoT, limits are D272).
 *
 * Layout: `<dataDir>/uploads/<sessionKey>/<uploadId>/<file name>`; while it is being written the
 * file is `<file name>.part`, renamed when `finish` matches the sha256. POSIX: directories 0700,
 * files 0600. Cleanup: `disposeSession` (panel / tab closed), `sweep` (startup + hourly: uploads
 * older than 24 h, unfinished `.part` older than 10 min).
 *
 * Results are `{ ok: true, … } | { ok: false, code, message }` (codes: `UploadErrorCode`); the
 * channels in `electron/handlers/uploads.ts` return them as is. Contract: T0832 回報區〈介面契約〉.
 *
 * Logs carry the upload id, the first 8 chars of the session key, size, extension and result —
 * never the file name or content.
 *
 * 🔴 No `electron` import (headless bat-server runs this under plain node), and nothing reads the
 * data dir at import time: the host passes `getDataDir` and it is read on first use.
 */
import { createHash, randomBytes } from 'crypto'
import * as fs from 'fs/promises'
import * as path from 'path'
import { logger } from './logger'

const MiB = 1024 * 1024

/** D272 limits. Client-side ones (per send) are enforced by the client (T0833); listed here as the shared source. */
export const UPLOAD_LIMITS = Object.freeze({
  /** One file. Host: `upload:begin` → `TOO_LARGE`. */
  maxFileBytes: 50 * MiB,
  /** All files of one send. Client only. */
  maxSendBytes: 100 * MiB,
  /** Files of one send. Client only. */
  maxSendFiles: 10,
  /** Everything staged for one session key (finished + in progress). Host: `upload:begin` → `QUOTA`. */
  maxSessionBytes: 500 * MiB,
  /** Uploads of one session key in progress at the same time. Host: `upload:begin` → `TOO_MANY`. */
  maxActivePerSession: 10,
  /** Raw bytes of one `upload:chunk` (base64 is ~4/3 of it). Host: larger → `BAD_CHUNK`. */
  chunkBytes: 256 * 1024,
  /** Free space kept on the host disk beyond the file itself. Host: `upload:begin` → `NO_SPACE`. */
  reserveFreeBytes: 64 * MiB,
})

/** Cleanup timings (D272). */
export const UPLOAD_TTL = Object.freeze({
  /** A finished upload is removed this long after its last write. */
  finishedMs: 24 * 60 * 60 * 1000,
  /** An unfinished upload (`.part`, or no chunk for this long) is removed. */
  partMs: 10 * 60 * 1000,
  /** Sweep interval (plus once at start). */
  sweepIntervalMs: 60 * 60 * 1000,
})

export type UploadErrorCode =
  | 'BAD_ARGS' // a parameter is missing / of the wrong type / outside the whitelist
  | 'TOO_LARGE' // size > maxFileBytes
  | 'QUOTA' // the session key would exceed maxSessionBytes
  | 'TOO_MANY' // maxActivePerSession uploads already in progress for the session key
  | 'NO_SPACE' // host disk: free < size + reserveFreeBytes, or ENOSPC while writing
  | 'NOT_FOUND' // unknown / finished / aborted / expired uploadId
  | 'BAD_OFFSET' // chunk offset ≠ bytes received so far (and not a resend of the last chunk)
  | 'BAD_CHUNK' // not base64, empty, > chunkBytes, or past the declared size
  | 'SIZE_MISMATCH' // finish before every declared byte arrived
  | 'HASH_MISMATCH' // finish sha256 ≠ sha256 of the received bytes (the upload is removed)
  | 'FORBIDDEN' // called with a helper capability (PTY token)
  | 'IO_ERROR' // any other file system failure

export type UploadFailure = { ok: false; code: UploadErrorCode; message: string }
export type UploadBeginResult = { ok: true; uploadId: string; chunkBytes: number } | UploadFailure
export type UploadChunkResult = { ok: true; received: number } | UploadFailure
export type UploadFinishResult = { ok: true; serverPath: string; size: number } | UploadFailure
export type UploadAbortResult = { ok: true; aborted: boolean } | UploadFailure

/** Session keys (Claude / Codex panel sessionId, terminal PTY id) and upload ids: CLAUDE.md external-input whitelist. */
export const UPLOAD_KEY_PATTERN = /^[a-zA-Z0-9._-]+$/
const MAX_SESSION_KEY_LENGTH = 128
const UPLOAD_ID_PATTERN = /^[0-9a-f]{16}$/
const SHA256_PATTERN = /^[0-9a-fA-F]{64}$/
const BASE64_PATTERN = /^[A-Za-z0-9+/]*={0,2}$/
const PART_SUFFIX = '.part'

/** Max file name length after cleaning, in code points and in UTF-8 bytes (ext4 / APFS limit is 255 bytes incl. `.part`). */
export const MAX_STAGED_NAME_CHARS = 120
export const MAX_STAGED_NAME_BYTES = 200
const MAX_KEPT_EXTENSION_CHARS = 20
const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[0-9¹²³]|lpt[0-9¹²³])$/i
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001f\u007f-\u009f]/g
const WINDOWS_INVALID = /[<>:"|?*]/g

export function isValidSessionKey(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= MAX_SESSION_KEY_LENGTH
    && UPLOAD_KEY_PATTERN.test(value) && value !== '.' && value !== '..'
}

function utf8Length(value: string): number {
  return Buffer.byteLength(value, 'utf8')
}

/** Cut `value` to at most `maxChars` code points and `maxBytes` UTF-8 bytes without splitting a code point. */
function cutTo(value: string, maxChars: number, maxBytes: number): string {
  let out = ''
  let chars = 0
  let bytes = 0
  for (const ch of value) {
    const size = utf8Length(ch)
    if (chars + 1 > maxChars || bytes + size > maxBytes) break
    out += ch
    chars += 1
    bytes += size
  }
  return out
}

/**
 * The name a staged file gets on the host: basename only (`/` and `\` both separate), control
 * characters dropped, `< > : " | ? *` → `_`, leading blanks and trailing dots / blanks trimmed, Windows
 * reserved device names prefixed with `_`, `.` / `..` / empty → `file`, at most
 * MAX_STAGED_NAME_CHARS code points / MAX_STAGED_NAME_BYTES bytes keeping the extension.
 * Same result on every host platform.
 */
export function sanitizeUploadName(raw: unknown): string {
  const input = typeof raw === 'string' ? raw : ''
  const base = input.split(/[/\\]/).pop() ?? ''
  let name = base.replace(CONTROL_CHARS, '').replace(WINDOWS_INVALID, '_')
  name = name.replace(/^\s+/, '').replace(/[\s.]+$/, '')
  if (!name) return 'file'
  const dot = name.lastIndexOf('.')
  let stem = dot > 0 ? name.slice(0, dot) : name
  let ext = dot > 0 ? name.slice(dot) : ''
  if (Array.from(ext).length > MAX_KEPT_EXTENSION_CHARS + 1) {
    stem = name
    ext = ''
  }
  if (WINDOWS_RESERVED.test(stem.replace(/[\s.]+$/, ''))) stem = `_${stem}`
  const extChars = Array.from(ext).length
  const fitted = cutTo(stem, MAX_STAGED_NAME_CHARS - extChars, MAX_STAGED_NAME_BYTES - utf8Length(ext))
  const result = (fitted.replace(/[\s.]+$/, '') || 'file') + ext
  return result
}

/** Extension for the logs: lowercase, `[a-z0-9]` only, ≤ 10 chars; `-` when there is none. */
export function logExtension(name: string): string {
  const dot = name.lastIndexOf('.')
  if (dot <= 0) return '-'
  const ext = name.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 10)
  return ext ? `.${ext}` : '-'
}

function shortKey(sessionKey: string): string {
  return sessionKey.slice(0, 8)
}

function fail(code: UploadErrorCode, message: string): UploadFailure {
  return { ok: false, code, message }
}

function errnoCode(error: unknown): string | undefined {
  return error && typeof error === 'object' ? (error as NodeJS.ErrnoException).code : undefined
}

interface ActiveUpload {
  id: string
  sessionKey: string
  name: string
  size: number
  received: number
  hash: ReturnType<typeof createHash>
  dir: string
  partPath: string
  finalPath: string
  lastActivity: number
  /** offset / length / sha256 of the last chunk written: a resend of it is acknowledged, not written twice. */
  last: { offset: number; length: number; digest: string } | null
  /** Serializes chunk / finish / abort of one upload. */
  queue: Promise<unknown>
  closed: boolean
}

export interface UploadStagingLog {
  log(message: string): void
  warn(message: string): void
}

export interface UploadStagingOptions {
  /** Host state dir (Electron: userData, headless: bat-server dataDir). Read on first use only. */
  getDataDir: () => string
  /** Free bytes on the file system holding `dir`; null = unknown (check skipped). Default `fs.statfs`. */
  freeBytes?: (dir: string) => Promise<number | null>
  now?: () => number
  randomId?: () => string
  platform?: NodeJS.Platform
  log?: UploadStagingLog
  /** Test hook: replaces the append of one chunk. */
  appendChunk?: (file: string, data: Buffer) => Promise<void>
}

async function defaultFreeBytes(dir: string): Promise<number | null> {
  try {
    const stats = await fs.statfs(dir)
    return Number(stats.bavail) * Number(stats.bsize)
  } catch {
    return null
  }
}

const defaultLog: UploadStagingLog = {
  log: message => logger.log(message),
  warn: message => logger.warn(message),
}

export class UploadStaging {
  private readonly active = new Map<string, ActiveUpload>()
  private readonly opts: Required<Omit<UploadStagingOptions, 'appendChunk'>> & Pick<UploadStagingOptions, 'appendChunk'>
  private sweepTimer: ReturnType<typeof setInterval> | null = null
  private sweeping: Promise<unknown> | null = null

  constructor(opts: UploadStagingOptions) {
    this.opts = {
      freeBytes: defaultFreeBytes,
      now: () => Date.now(),
      randomId: () => randomBytes(8).toString('hex'),
      platform: process.platform,
      log: defaultLog,
      ...opts,
    }
  }

  /** `<dataDir>/uploads` (absolute). */
  get root(): string {
    return path.resolve(this.opts.getDataDir(), 'uploads')
  }

  private get posix(): boolean {
    return this.opts.platform !== 'win32'
  }

  /** `path.resolve(...parts)` under the uploads root, or null when it would leave it. */
  private inside(...parts: string[]): string | null {
    const root = this.root
    const resolved = path.resolve(root, ...parts)
    return resolved.startsWith(root + path.sep) ? resolved : null
  }

  private async ensureDir(dir: string): Promise<void> {
    await fs.mkdir(dir, { recursive: true, mode: 0o700 })
    if (this.posix) await fs.chmod(dir, 0o700)
  }

  async begin(sessionKey: unknown, name: unknown, size: unknown): Promise<UploadBeginResult> {
    if (!isValidSessionKey(sessionKey)) return fail('BAD_ARGS', 'sessionKey must match /^[a-zA-Z0-9._-]+$/ (≤ 128 chars)')
    if (typeof name !== 'string') return fail('BAD_ARGS', 'name must be a string')
    if (typeof size !== 'number' || !Number.isSafeInteger(size) || size < 0) return fail('BAD_ARGS', 'size must be a non-negative integer')
    const tag = `session=${shortKey(sessionKey)} size=${size} ext=${logExtension(sanitizeUploadName(name))}`
    if (size > UPLOAD_LIMITS.maxFileBytes) {
      this.opts.log.log(`[upload] begin ${tag} result=TOO_LARGE`)
      return fail('TOO_LARGE', `file is larger than ${UPLOAD_LIMITS.maxFileBytes} bytes`)
    }
    await this.expireIdle()
    const sessionActive = [...this.active.values()].filter(u => u.sessionKey === sessionKey)
    if (sessionActive.length >= UPLOAD_LIMITS.maxActivePerSession) {
      this.opts.log.log(`[upload] begin ${tag} result=TOO_MANY`)
      return fail('TOO_MANY', `${UPLOAD_LIMITS.maxActivePerSession} uploads already in progress for this session`)
    }
    const sessionDir = this.inside(sessionKey)
    if (!sessionDir) return fail('BAD_ARGS', 'sessionKey resolves outside the uploads directory')
    try {
      await this.ensureDir(this.root)
      const used = await this.sessionUsage(sessionKey, sessionDir)
      if (used + size > UPLOAD_LIMITS.maxSessionBytes) {
        this.opts.log.log(`[upload] begin ${tag} used=${used} result=QUOTA`)
        return fail('QUOTA', `session staging would exceed ${UPLOAD_LIMITS.maxSessionBytes} bytes (${used} in use)`)
      }
      const free = await this.opts.freeBytes(this.root)
      if (free !== null && free < size + UPLOAD_LIMITS.reserveFreeBytes) {
        this.opts.log.log(`[upload] begin ${tag} free=${free} result=NO_SPACE`)
        return fail('NO_SPACE', `host disk has ${free} bytes free; needs ${size + UPLOAD_LIMITS.reserveFreeBytes}`)
      }
      if (free === null) this.opts.log.log(`[upload] begin ${tag} free=unknown (statfs unavailable)`)

      let id = ''
      for (let attempt = 0; attempt < 5 && !id; attempt++) {
        const candidate = this.opts.randomId()
        if (UPLOAD_ID_PATTERN.test(candidate) && !this.active.has(candidate)) id = candidate
      }
      if (!id) return fail('IO_ERROR', 'could not allocate an upload id')
      const dir = this.inside(sessionKey, id)
      const fileName = sanitizeUploadName(name)
      const finalPath = dir ? this.inside(sessionKey, id, fileName) : null
      const partPath = dir ? this.inside(sessionKey, id, fileName + PART_SUFFIX) : null
      if (!dir || !finalPath || !partPath || path.dirname(finalPath) !== dir) {
        return fail('BAD_ARGS', 'name resolves outside the upload directory')
      }
      await this.ensureDir(sessionDir)
      await fs.mkdir(dir, { mode: 0o700 }) // fails if it exists: a fresh directory per upload
      if (this.posix) await fs.chmod(dir, 0o700)
      const handle = await fs.open(partPath, 'wx', 0o600)
      await handle.close()
      this.active.set(id, {
        id,
        sessionKey,
        name: fileName,
        size,
        received: 0,
        hash: createHash('sha256'),
        dir,
        partPath,
        finalPath,
        lastActivity: this.opts.now(),
        last: null,
        queue: Promise.resolve(),
        closed: false,
      })
      this.opts.log.log(`[upload] begin id=${id} ${tag} result=ok`)
      return { ok: true, uploadId: id, chunkBytes: UPLOAD_LIMITS.chunkBytes }
    } catch (error) {
      const code = errnoCode(error) === 'ENOSPC' ? 'NO_SPACE' : 'IO_ERROR'
      this.opts.log.warn(`[upload] begin ${tag} result=${code} errno=${errnoCode(error) ?? '-'}`)
      return fail(code, code === 'NO_SPACE' ? 'host disk is full' : 'could not create the staging file')
    }
  }

  /** Runs `task` after every earlier task of the same upload. */
  private serialize<T>(upload: ActiveUpload, task: () => Promise<T>): Promise<T> {
    const run = upload.queue.then(task, task)
    upload.queue = run.catch(() => undefined)
    return run
  }

  chunk(uploadId: unknown, offset: unknown, data: unknown): Promise<UploadChunkResult> {
    const upload = typeof uploadId === 'string' ? this.active.get(uploadId) : undefined
    if (!upload) return Promise.resolve(fail('NOT_FOUND', 'unknown upload id'))
    return this.serialize(upload, async (): Promise<UploadChunkResult> => {
      if (upload.closed) return fail('NOT_FOUND', 'upload is no longer open')
      if (typeof offset !== 'number' || !Number.isSafeInteger(offset) || offset < 0) return fail('BAD_ARGS', 'offset must be a non-negative integer')
      if (typeof data !== 'string' || data.length === 0 || data.length % 4 !== 0 || !BASE64_PATTERN.test(data)) {
        return fail('BAD_CHUNK', 'data must be non-empty base64')
      }
      if (data.length > Math.ceil(UPLOAD_LIMITS.chunkBytes / 3) * 4) return fail('BAD_CHUNK', `chunk is larger than ${UPLOAD_LIMITS.chunkBytes} bytes`)
      const bytes = Buffer.from(data, 'base64')
      if (bytes.length === 0 || bytes.length > UPLOAD_LIMITS.chunkBytes) return fail('BAD_CHUNK', `chunk must be 1–${UPLOAD_LIMITS.chunkBytes} bytes`)
      upload.lastActivity = this.opts.now()
      if (offset !== upload.received) {
        const digest = createHash('sha256').update(bytes).digest('hex')
        const last = upload.last
        if (last && offset === last.offset && bytes.length === last.length && digest === last.digest) {
          return { ok: true, received: upload.received } // resend of the chunk already written
        }
        return fail('BAD_OFFSET', `offset ${offset} ≠ received ${upload.received}`)
      }
      if (offset + bytes.length > upload.size) return fail('BAD_CHUNK', `chunk ends past the declared size ${upload.size}`)
      try {
        if (this.opts.appendChunk) await this.opts.appendChunk(upload.partPath, bytes)
        else await fs.appendFile(upload.partPath, bytes)
      } catch (error) {
        const code = errnoCode(error) === 'ENOSPC' ? 'NO_SPACE' : 'IO_ERROR'
        this.opts.log.warn(`[upload] chunk id=${upload.id} session=${shortKey(upload.sessionKey)} offset=${offset} result=${code} errno=${errnoCode(error) ?? '-'}`)
        await this.drop(upload)
        return fail(code, code === 'NO_SPACE' ? 'host disk is full; upload removed' : 'write failed; upload removed')
      }
      upload.hash.update(bytes)
      upload.received += bytes.length
      upload.last = { offset, length: bytes.length, digest: createHash('sha256').update(bytes).digest('hex') }
      return { ok: true, received: upload.received }
    })
  }

  finish(uploadId: unknown, sha256: unknown): Promise<UploadFinishResult> {
    const upload = typeof uploadId === 'string' ? this.active.get(uploadId) : undefined
    if (!upload) return Promise.resolve(fail('NOT_FOUND', 'unknown upload id'))
    return this.serialize(upload, async (): Promise<UploadFinishResult> => {
      if (upload.closed) return fail('NOT_FOUND', 'upload is no longer open')
      if (typeof sha256 !== 'string' || !SHA256_PATTERN.test(sha256)) return fail('BAD_ARGS', 'sha256 must be 64 hex chars')
      const tag = `id=${upload.id} session=${shortKey(upload.sessionKey)} size=${upload.size} ext=${logExtension(upload.name)}`
      if (upload.received !== upload.size) {
        upload.lastActivity = this.opts.now()
        return fail('SIZE_MISMATCH', `received ${upload.received} of ${upload.size} bytes`)
      }
      const actual = upload.hash.copy().digest('hex')
      if (actual !== sha256.toLowerCase()) {
        this.opts.log.log(`[upload] finish ${tag} result=HASH_MISMATCH`)
        await this.drop(upload)
        return fail('HASH_MISMATCH', 'sha256 does not match the received bytes; upload removed')
      }
      try {
        await fs.rename(upload.partPath, upload.finalPath)
      } catch (error) {
        this.opts.log.warn(`[upload] finish ${tag} result=IO_ERROR errno=${errnoCode(error) ?? '-'}`)
        await this.drop(upload)
        return fail('IO_ERROR', 'could not finalize the staged file; upload removed')
      }
      upload.closed = true
      this.active.delete(upload.id)
      this.opts.log.log(`[upload] finish ${tag} result=ok`)
      return { ok: true, serverPath: upload.finalPath, size: upload.size }
    })
  }

  async abort(uploadId: unknown): Promise<UploadAbortResult> {
    if (typeof uploadId !== 'string') return fail('BAD_ARGS', 'uploadId must be a string')
    const upload = this.active.get(uploadId)
    if (!upload) return { ok: true, aborted: false }
    return this.serialize(upload, async (): Promise<UploadAbortResult> => {
      if (upload.closed) return { ok: true, aborted: false }
      await this.drop(upload)
      this.opts.log.log(`[upload] abort id=${upload.id} session=${shortKey(upload.sessionKey)} received=${upload.received} result=ok`)
      return { ok: true, aborted: true }
    })
  }

  /** Closes an in-progress upload and removes its directory (never throws). */
  private async drop(upload: ActiveUpload): Promise<void> {
    upload.closed = true
    this.active.delete(upload.id)
    try {
      await fs.rm(upload.dir, { recursive: true, force: true })
    } catch (error) {
      this.opts.log.warn(`[upload] remove id=${upload.id} failed errno=${errnoCode(error) ?? '-'}`)
    }
  }

  /** In-progress uploads with no chunk for UPLOAD_TTL.partMs are dropped. */
  private async expireIdle(): Promise<number> {
    const now = this.opts.now()
    const idle = [...this.active.values()].filter(u => now - u.lastActivity > UPLOAD_TTL.partMs)
    for (const upload of idle) {
      await this.serialize(upload, async () => {
        if (!upload.closed) {
          await this.drop(upload)
          this.opts.log.log(`[upload] expire id=${upload.id} session=${shortKey(upload.sessionKey)} received=${upload.received}`)
        }
      })
    }
    return idle.length
  }

  /** Bytes the session key holds: declared size of its in-progress uploads + size of every other file under its dir. */
  private async sessionUsage(sessionKey: string, sessionDir: string): Promise<number> {
    let total = 0
    const activeIds = new Set<string>()
    for (const upload of this.active.values()) {
      if (upload.sessionKey !== sessionKey) continue
      activeIds.add(upload.id)
      total += upload.size
    }
    let entries: string[]
    try {
      entries = await fs.readdir(sessionDir)
    } catch {
      return total
    }
    for (const entry of entries) {
      if (activeIds.has(entry)) continue
      const dir = path.join(sessionDir, entry)
      try {
        const stat = await fs.lstat(dir)
        if (!stat.isDirectory()) { total += stat.size; continue }
        for (const file of await fs.readdir(dir)) {
          const fileStat = await fs.lstat(path.join(dir, file))
          if (fileStat.isFile()) total += fileStat.size
        }
      } catch { /* removed meanwhile */ }
    }
    return total
  }

  /**
   * Removes everything staged for `sessionKey` (panel `claude:dispose-session`; a terminal tab's
   * PTY id from T0835). In-progress uploads of it are aborted. Never throws; an invalid key is a no-op.
   */
  async disposeSession(sessionKey: unknown): Promise<{ removed: boolean }> {
    if (!isValidSessionKey(sessionKey)) return { removed: false }
    for (const upload of [...this.active.values()]) {
      if (upload.sessionKey === sessionKey) await this.serialize(upload, async () => { if (!upload.closed) await this.drop(upload) })
    }
    let sessionDir: string | null
    try {
      sessionDir = this.inside(sessionKey)
    } catch {
      return { removed: false }
    }
    if (!sessionDir) return { removed: false }
    try {
      await fs.lstat(sessionDir)
    } catch {
      return { removed: false }
    }
    try {
      await fs.rm(sessionDir, { recursive: true, force: true })
      this.opts.log.log(`[upload] dispose session=${shortKey(sessionKey)} result=ok`)
      return { removed: true }
    } catch (error) {
      this.opts.log.warn(`[upload] dispose session=${shortKey(sessionKey)} result=IO_ERROR errno=${errnoCode(error) ?? '-'}`)
      return { removed: false }
    }
  }

  /**
   * TTL sweep: drops idle in-progress uploads, removes upload dirs whose newest entry is older than
   * UPLOAD_TTL.finishedMs, dirs still holding a `.part` older than UPLOAD_TTL.partMs that no live
   * upload owns (left by an earlier process), and session dirs left empty. Never throws.
   */
  async sweep(): Promise<{ removed: number }> {
    if (this.sweeping) return { removed: 0 }
    const run = this.sweepOnce()
    this.sweeping = run
    try {
      return await run
    } finally {
      this.sweeping = null
    }
  }

  private async sweepOnce(): Promise<{ removed: number }> {
    let removed = await this.expireIdle()
    let root: string
    try {
      root = this.root
    } catch {
      return { removed }
    }
    let sessions: string[]
    try {
      sessions = await fs.readdir(root)
    } catch {
      return { removed }
    }
    const now = this.opts.now()
    const activeIds = new Set(this.active.keys())
    for (const session of sessions) {
      const sessionDir = path.join(root, session)
      let uploads: string[]
      try {
        const stat = await fs.lstat(sessionDir)
        if (!stat.isDirectory()) continue
        uploads = await fs.readdir(sessionDir)
      } catch { continue }
      let left = uploads.length
      for (const entry of uploads) {
        if (activeIds.has(entry)) continue
        const dir = path.join(sessionDir, entry)
        try {
          const stat = await fs.lstat(dir)
          if (!stat.isDirectory()) continue
          let newest = stat.mtimeMs
          let hasPart = false
          for (const file of await fs.readdir(dir)) {
            const fileStat = await fs.lstat(path.join(dir, file))
            newest = Math.max(newest, fileStat.mtimeMs)
            if (file.endsWith(PART_SUFFIX)) hasPart = true
          }
          const age = now - newest
          if ((hasPart && age > UPLOAD_TTL.partMs) || age > UPLOAD_TTL.finishedMs) {
            await fs.rm(dir, { recursive: true, force: true })
            removed += 1
            left -= 1
          }
        } catch { /* removed meanwhile */ }
      }
      if (left === 0) {
        try { await fs.rmdir(sessionDir) } catch { /* not empty / gone */ }
      }
    }
    if (removed > 0) this.opts.log.log(`[upload] sweep removed=${removed}`)
    return { removed }
  }

  /** Sweeps now and every UPLOAD_TTL.sweepIntervalMs (timer unref'd). Returns a stop function. */
  startSweeper(intervalMs: number = UPLOAD_TTL.sweepIntervalMs): () => void {
    this.stopSweeper()
    void this.sweep()
    const timer = setInterval(() => { void this.sweep() }, intervalMs)
    timer.unref?.()
    this.sweepTimer = timer
    return () => this.stopSweeper()
  }

  stopSweeper(): void {
    if (this.sweepTimer) clearInterval(this.sweepTimer)
    this.sweepTimer = null
  }

  /** Number of uploads in progress (tests / diagnostics). */
  get activeCount(): number {
    return this.active.size
  }
}
