// Pure helper functions for server bundle download (PLAN-031 / T0318).
//
// Extracted from `electron/remote/server-bundle-download.ts` so they can be
// unit-tested without dragging the composite tsconfig.node.json project into
// the renderer test config (mirrors T0319's split between `arch-detect.ts`
// and `arch-detect-result.ts`).
//
// No fs, no fetch, no env reads except `process.env.BAT_SERVER_BUNDLE_BASE_URL`
// which is read inside `buildBaseURL` (tested via env stubbing).

import { DEFAULT_RELEASE_BASE_URL } from './arch-normalize'

const PROGRESS_BYTE_THRESHOLD = 1024 * 1024 // 1 MB
const PROGRESS_TIME_THRESHOLD_MS = 500

/**
 * Resolve base URL precedence: explicit override → env → default GitHub Release.
 * Trailing slashes are stripped to keep `${base}/${file}` predictable.
 */
export function buildBaseURL(version: string, override?: string): string {
  const envOverride =
    typeof process !== 'undefined' && process.env
      ? process.env.BAT_SERVER_BUNDLE_BASE_URL
      : undefined
  const raw =
    (override && override.length > 0 ? override : undefined) ??
    (envOverride && envOverride.length > 0 ? envOverride : undefined) ??
    `${DEFAULT_RELEASE_BASE_URL}/server-bundle-v${version}`
  return raw.endsWith('/') ? raw.slice(0, -1) : raw
}

/**
 * Compose `${baseURL}/${filename}`. Tolerates trailing slash on baseURL.
 */
export function buildTarballURL(baseURL: string, filename: string): string {
  const trimmed = baseURL.endsWith('/') ? baseURL.slice(0, -1) : baseURL
  return `${trimmed}/${filename}`
}

/**
 * Decide whether to retry a fetch error.
 *   - AbortError → never retry
 *   - 4xx → never retry
 *   - 403 + X-RateLimit-Remaining=0 → never retry (rate-limited)
 *   - 5xx → retry
 *   - network errors (ECONNRESET / ETIMEDOUT / etc) → retry
 *   - everything else → no retry (fail-safe)
 */
export function shouldRetryError(error: {
  status?: number
  code?: string
  name?: string
  headers?: Record<string, string>
}): boolean {
  if (error.name === 'AbortError') return false

  const headers = error.headers ?? {}
  if (
    error.status === 403 &&
    (headers['x-ratelimit-remaining'] === '0' ||
      headers['X-RateLimit-Remaining'] === '0')
  ) {
    return false
  }

  if (typeof error.status === 'number') {
    if (error.status >= 500 && error.status < 600) return true
    if (error.status >= 400 && error.status < 500) return false
  }

  const retryableCodes = new Set([
    'ECONNRESET',
    'ETIMEDOUT',
    'ENOTFOUND',
    'EAI_AGAIN',
    'ECONNREFUSED',
    'EPIPE',
    'UND_ERR_SOCKET',
  ])
  if (error.code && retryableCodes.has(error.code)) return true

  return false
}

/**
 * Parse GitHub rate-limit headers. Accepts unix timestamp (seconds) or ISO
 * string for `X-RateLimit-Reset`. Defaults remaining to 60 if missing
 * (GitHub anonymous quota baseline).
 */
export function parseRateLimitHeaders(
  headers: Record<string, string>,
): { remaining: number; resetISO: string | null } {
  const lower: Record<string, string> = {}
  for (const [k, v] of Object.entries(headers)) {
    lower[k.toLowerCase()] = v
  }

  const remainingRaw = lower['x-ratelimit-remaining']
  const remaining =
    remainingRaw !== undefined && /^\d+$/.test(remainingRaw)
      ? parseInt(remainingRaw, 10)
      : 60

  const resetRaw = lower['x-ratelimit-reset']
  let resetISO: string | null = null
  if (resetRaw && resetRaw.length > 0) {
    if (/^\d+$/.test(resetRaw)) {
      const ms = parseInt(resetRaw, 10) * 1000
      if (Number.isFinite(ms)) resetISO = new Date(ms).toISOString()
    } else {
      const ms = Date.parse(resetRaw)
      if (!Number.isNaN(ms)) resetISO = new Date(ms).toISOString()
    }
  }

  return { remaining, resetISO }
}

/**
 * Throttle progress emission: emit when 1MB downloaded since last OR 500ms
 * elapsed since last, whichever first. First event (`lastEmitMs === 0`) always
 * emits.
 */
export function shouldThrottleProgress(
  lastEmitMs: number,
  lastEmitBytes: number,
  currentMs: number,
  currentBytes: number,
): boolean {
  if (lastEmitMs === 0) return false
  const byteDelta = currentBytes - lastEmitBytes
  const timeDelta = currentMs - lastEmitMs
  if (byteDelta >= PROGRESS_BYTE_THRESHOLD) return false
  if (timeDelta >= PROGRESS_TIME_THRESHOLD_MS) return false
  return true
}
