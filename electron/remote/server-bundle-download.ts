// Server bundle runtime download module (PLAN-031 / T0318).
//
// Downloads server bundle tarballs for given arch:
//   1. fetch manifest.json → parseManifest (T0317)
//   2. lookup tarball entry by arch (T0319 detected)
//   3. local cache by SHA → skip download if cached
//   4. fetch tarball → pipe through createSha256Stream (T0317) → tmp file
//   5. compareSha256 (T0317, timing-safe) → rename tmp → final
//   6. progress event throttle by 1MB or 500ms
//   7. exponential backoff 500/1500/3000ms; 4xx/abort/rate-limit no retry
//   8. GitHub rate limit detection (HTTP 403 + X-RateLimit-Remaining: 0)
//   9. fallback URL via options.baseURL or BAT_SERVER_BUNDLE_BASE_URL env
//
// Result-based API (no throw). All errors → { ok: false, errorCode, error }.
// Spec source: T0314 §3.2/§3.3/§3.5/§8 + T0318 工單 §22-218.

import { createWriteStream } from 'node:fs'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'
import { logger } from '../logger'
import {
  compareSha256,
  createSha256Stream,
  parseManifest,
  type ServerBundleManifest,
  type TarballEntry,
} from '../../src/lib/server-bundle-manifest'
import { type ServerBundleArch } from '../../src/lib/arch-normalize'
import {
  buildBaseURL,
  buildTarballURL,
  parseRateLimitHeaders,
  shouldRetryError,
  shouldThrottleProgress,
} from '../../src/lib/server-bundle-download-helpers'

export type { ServerBundleArch } from '../../src/lib/arch-normalize'
export {
  buildBaseURL,
  buildTarballURL,
  parseRateLimitHeaders,
  shouldRetryError,
  shouldThrottleProgress,
} from '../../src/lib/server-bundle-download-helpers'

export interface DownloadOptions {
  arch: ServerBundleArch
  version: string
  cacheDir: string
  baseURL?: string
  onProgress?: (event: ProgressEvent) => void
  signal?: AbortSignal
  githubToken?: string
}

export interface ProgressEvent {
  phase: 'manifest' | 'tarball'
  bytesDownloaded: number
  /** -1 if unknown (manifest phase or no Content-Length). */
  bytesTotal: number
  /** 0–100, or -1 if total unknown. */
  percent: number
}

export type DownloadErrorCode =
  | 'manifest-fetch-failed'
  | 'manifest-parse-failed'
  | 'arch-not-in-manifest'
  | 'tarball-fetch-failed'
  | 'sha-mismatch'
  | 'cache-write-failed'
  | 'rate-limited'
  | 'aborted'
  | 'network-error'

export type DownloadResult =
  | {
      ok: true
      tarballPath: string
      sha256: string
      sizeBytes: number
      fromCache: boolean
    }
  | { ok: false; error: string; errorCode: DownloadErrorCode }

const RETRY_DELAYS_MS = [500, 1500, 3000] // 4 attempts total (1 immediate + 3 retries)

// ────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ────────────────────────────────────────────────────────────────────────────

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError())
      return
    }
    const t = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    const onAbort = () => {
      clearTimeout(t)
      reject(abortError())
    }
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

function abortError(): Error {
  const e = new Error('Aborted')
  ;(e as Error & { name: string }).name = 'AbortError'
  return e
}

function headersToRecord(h: Headers): Record<string, string> {
  const out: Record<string, string> = {}
  h.forEach((v, k) => {
    out[k.toLowerCase()] = v
  })
  return out
}

interface FetchAttemptError {
  status?: number
  code?: string
  name?: string
  headers?: Record<string, string>
  message: string
}

function toAttemptError(err: unknown): FetchAttemptError {
  if (err instanceof Error) {
    const e = err as Error & { code?: string; cause?: { code?: string } }
    return {
      name: e.name,
      code: e.code ?? e.cause?.code,
      message: e.message,
    }
  }
  return { message: String(err) }
}

/**
 * Fetch with retry. Returns Response on success. Throws structured error on
 * final failure: { kind: 'rate-limited' | 'aborted' | 'http' | 'network', ... }.
 */
async function fetchWithRetry(
  url: string,
  init: RequestInit,
  signal: AbortSignal | undefined,
  githubToken: string | undefined,
): Promise<Response> {
  const attempts = RETRY_DELAYS_MS.length + 1
  let lastError: FetchAttemptError = { message: 'no attempt made' }

  const headers: Record<string, string> = {
    ...(init.headers as Record<string, string> | undefined),
  }
  if (githubToken) headers['Authorization'] = `Bearer ${githubToken}`

  for (let attempt = 0; attempt < attempts; attempt++) {
    if (signal?.aborted) {
      throw new DownloadError('aborted', 'Download aborted by caller.')
    }
    try {
      const res = await fetch(url, { ...init, headers, signal })
      if (res.ok) return res

      // HTTP error path
      const respHeaders = headersToRecord(res.headers)
      if (
        res.status === 403 &&
        respHeaders['x-ratelimit-remaining'] === '0'
      ) {
        const { resetISO } = parseRateLimitHeaders(respHeaders)
        const resetMsg = resetISO ? `Reset at ${resetISO}.` : 'Reset time unknown.'
        throw new DownloadError(
          'rate-limited',
          `GitHub rate limit exceeded for ${url}. ${resetMsg} Consider setting GITHUB_TOKEN env or BAT_SERVER_BUNDLE_BASE_URL.`,
        )
      }

      lastError = {
        status: res.status,
        headers: respHeaders,
        message: `HTTP ${res.status} ${res.statusText} for ${url}`,
      }
      if (!shouldRetryError(lastError)) {
        throw new DownloadError(
          res.status === 404 ? 'manifest-fetch-failed' : 'network-error',
          lastError.message,
        )
      }
    } catch (err) {
      if (err instanceof DownloadError) throw err
      lastError = toAttemptError(err)
      if (lastError.name === 'AbortError') {
        throw new DownloadError('aborted', 'Download aborted by caller.')
      }
      if (!shouldRetryError(lastError)) {
        throw new DownloadError(
          'network-error',
          `Fetch failed for ${url}: ${lastError.message}`,
        )
      }
    }

    if (attempt < attempts - 1) {
      logger.warn(
        `[server-bundle] fetch attempt ${attempt + 1}/${attempts} failed for ${url}; retrying in ${RETRY_DELAYS_MS[attempt]}ms — ${lastError.message}`,
      )
      try {
        await delay(RETRY_DELAYS_MS[attempt], signal)
      } catch {
        throw new DownloadError('aborted', 'Download aborted during retry backoff.')
      }
    }
  }

  throw new DownloadError(
    'network-error',
    `Fetch failed after ${attempts} attempts for ${url}: ${lastError.message}`,
  )
}

class DownloadError extends Error {
  constructor(public errorCode: DownloadErrorCode, message: string) {
    super(message)
    this.name = 'DownloadError'
  }
}

function emitProgress(
  state: { lastMs: number; lastBytes: number },
  phase: 'manifest' | 'tarball',
  bytesDownloaded: number,
  bytesTotal: number,
  onProgress: ((event: ProgressEvent) => void) | undefined,
  force = false,
): void {
  if (!onProgress) return
  const now = Date.now()
  if (!force && shouldThrottleProgress(state.lastMs, state.lastBytes, now, bytesDownloaded)) {
    return
  }
  state.lastMs = now
  state.lastBytes = bytesDownloaded
  const percent =
    bytesTotal > 0 ? Math.min(100, Math.floor((bytesDownloaded / bytesTotal) * 100)) : -1
  try {
    onProgress({ phase, bytesDownloaded, bytesTotal, percent })
  } catch (err) {
    logger.warn(`[server-bundle] progress callback threw: ${(err as Error).message}`)
  }
}

async function tryUnlink(p: string): Promise<void> {
  try {
    await fs.unlink(p)
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code
    if (code !== 'ENOENT') {
      logger.warn(`[server-bundle] failed to unlink ${p}: ${(err as Error).message}`)
    }
  }
}

async function checkCache(
  cachePath: string,
  expected: TarballEntry,
  signal: AbortSignal | undefined,
): Promise<boolean> {
  let stat
  try {
    stat = await fs.stat(cachePath)
  } catch {
    return false
  }
  if (!stat.isFile() || stat.size !== expected.size) {
    await tryUnlink(cachePath)
    return false
  }
  // Verify SHA against cache. Use createSha256Stream so the verification path
  // matches the download path exactly.
  try {
    const { stream, getDigest } = createSha256Stream()
    const fh = await fs.open(cachePath, 'r')
    try {
      const readable = fh.createReadStream()
      const sink = new (await import('node:stream')).Writable({
        write(_chunk, _enc, cb) {
          cb()
        },
      })
      await pipeline(readable, stream, sink, { signal })
    } finally {
      await fh.close()
    }
    const actual = await getDigest()
    if (compareSha256(expected.sha256, actual)) {
      return true
    }
    logger.warn(
      `[server-bundle] cache SHA mismatch at ${cachePath} (expected ${expected.sha256.slice(0, 16)}…, got ${actual.slice(0, 16)}…); deleting stale file`,
    )
    await tryUnlink(cachePath)
    return false
  } catch (err) {
    logger.warn(`[server-bundle] cache verify failed: ${(err as Error).message}`)
    await tryUnlink(cachePath)
    return false
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Public entry
// ────────────────────────────────────────────────────────────────────────────

export async function downloadServerBundle(
  options: DownloadOptions,
): Promise<DownloadResult> {
  const { arch, version, cacheDir, signal, onProgress } = options
  const githubToken =
    options.githubToken ??
    (typeof process !== 'undefined' ? process.env.GITHUB_TOKEN : undefined)
  const baseURL = buildBaseURL(version, options.baseURL)
  const manifestURL = `${baseURL}/manifest.json`

  const progressState = { lastMs: 0, lastBytes: 0 }

  // ── Phase 1: Manifest fetch ────────────────────────────────────────────
  let manifest: ServerBundleManifest
  try {
    logger.log(`[server-bundle] fetching manifest from ${manifestURL}`)
    emitProgress(progressState, 'manifest', 0, -1, onProgress, true)
    const res = await fetchWithRetry(manifestURL, { method: 'GET' }, signal, githubToken)
    const text = await res.text()
    emitProgress(progressState, 'manifest', text.length, text.length, onProgress, true)
    const parsed = parseManifest(text)
    if (!parsed.ok) {
      logger.error(`[server-bundle] manifest parse failed: ${parsed.error}`)
      return {
        ok: false,
        errorCode: 'manifest-parse-failed',
        error: `Manifest parse failed: ${parsed.error}`,
      }
    }
    manifest = parsed.manifest
  } catch (err) {
    if (err instanceof DownloadError) {
      const code: DownloadErrorCode =
        err.errorCode === 'network-error' ? 'manifest-fetch-failed' : err.errorCode
      logger.error(`[server-bundle] manifest fetch failed: ${err.message}`)
      return { ok: false, errorCode: code, error: err.message }
    }
    const msg = err instanceof Error ? err.message : String(err)
    logger.error(`[server-bundle] manifest fetch unknown error: ${msg}`)
    return { ok: false, errorCode: 'manifest-fetch-failed', error: msg }
  }

  // ── Phase 2: Arch lookup ───────────────────────────────────────────────
  const entry = manifest.tarballs[arch]
  if (!entry) {
    return {
      ok: false,
      errorCode: 'arch-not-in-manifest',
      error: `Manifest v${manifest.version} has no entry for arch ${arch}`,
    }
  }

  // ── Phase 3: Cache check ───────────────────────────────────────────────
  try {
    await fs.mkdir(cacheDir, { recursive: true })
  } catch (err) {
    const msg = (err as Error).message
    logger.error(`[server-bundle] cacheDir mkdir failed: ${msg}`)
    return {
      ok: false,
      errorCode: 'cache-write-failed',
      error: `Cache dir mkdir failed (${cacheDir}): ${msg}`,
    }
  }

  const cachePath = path.join(cacheDir, entry.filename)
  const tmpPath = `${cachePath}.tmp`

  if (await checkCache(cachePath, entry, signal)) {
    logger.log(`[server-bundle] cache hit for ${arch} v${manifest.version} at ${cachePath}`)
    return {
      ok: true,
      tarballPath: cachePath,
      sha256: entry.sha256,
      sizeBytes: entry.size,
      fromCache: true,
    }
  }

  // ── Phase 4: Tarball download ──────────────────────────────────────────
  const tarballURL = buildTarballURL(baseURL, entry.filename)
  // Reset progress state for tarball phase.
  progressState.lastMs = 0
  progressState.lastBytes = 0
  emitProgress(progressState, 'tarball', 0, entry.size, onProgress, true)

  await tryUnlink(tmpPath) // clean up any stale tmp from previous failed run

  let res: Response
  try {
    logger.log(`[server-bundle] downloading tarball from ${tarballURL}`)
    res = await fetchWithRetry(tarballURL, { method: 'GET' }, signal, githubToken)
  } catch (err) {
    if (err instanceof DownloadError) {
      const code: DownloadErrorCode =
        err.errorCode === 'network-error' ? 'tarball-fetch-failed' : err.errorCode
      logger.error(`[server-bundle] tarball fetch failed: ${err.message}`)
      return { ok: false, errorCode: code, error: err.message }
    }
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, errorCode: 'tarball-fetch-failed', error: msg }
  }

  if (!res.body) {
    return {
      ok: false,
      errorCode: 'tarball-fetch-failed',
      error: `Response body missing for ${tarballURL}`,
    }
  }

  // ── Phase 5: Stream → SHA + tmp file ──────────────────────────────────
  const { stream: shaStream, getDigest } = createSha256Stream()
  const writeStream = createWriteStream(tmpPath)

  // Progress wrapper: count bytes flowing through shaStream.
  let downloaded = 0
  const totalBytes = entry.size
  shaStream.on('data', (chunk: Buffer) => {
    downloaded += chunk.length
    emitProgress(progressState, 'tarball', downloaded, totalBytes, onProgress)
  })

  // Convert Web ReadableStream → Node Readable (Node 18+ / Electron 41 native).
  // res.body is a Web ReadableStream<Uint8Array>; Readable.fromWeb wraps it.
  const nodeReadable = Readable.fromWeb(
    res.body as unknown as Parameters<typeof Readable.fromWeb>[0],
  )

  try {
    await pipeline(nodeReadable, shaStream, writeStream, { signal })
  } catch (err) {
    await tryUnlink(tmpPath)
    if ((err as Error).name === 'AbortError') {
      return { ok: false, errorCode: 'aborted', error: 'Download aborted by caller.' }
    }
    const msg = (err as Error).message
    logger.error(`[server-bundle] pipeline failed: ${msg}`)
    return {
      ok: false,
      errorCode: 'cache-write-failed',
      error: `Stream write failed: ${msg}`,
    }
  }

  // Final progress emission (force).
  emitProgress(progressState, 'tarball', downloaded, totalBytes, onProgress, true)

  // ── Phase 6: SHA verify ───────────────────────────────────────────────
  const actualSha = await getDigest()
  if (!compareSha256(entry.sha256, actualSha)) {
    await tryUnlink(tmpPath)
    const msg = `Tarball SHA mismatch for ${entry.filename}: expected ${entry.sha256.slice(0, 16)}…, got ${actualSha.slice(0, 16)}…`
    logger.error(`[server-bundle] ${msg}`)
    return { ok: false, errorCode: 'sha-mismatch', error: msg }
  }

  // ── Phase 7: Atomic rename → final cache path ─────────────────────────
  try {
    await fs.rename(tmpPath, cachePath)
  } catch (err) {
    await tryUnlink(tmpPath)
    const msg = (err as Error).message
    logger.error(`[server-bundle] rename failed: ${msg}`)
    return {
      ok: false,
      errorCode: 'cache-write-failed',
      error: `Cache rename failed: ${msg}`,
    }
  }

  logger.log(
    `[server-bundle] downloaded ${entry.filename} (${entry.size} bytes) for ${arch} v${manifest.version}`,
  )
  return {
    ok: true,
    tarballPath: cachePath,
    sha256: entry.sha256,
    sizeBytes: entry.size,
    fromCache: false,
  }
}
