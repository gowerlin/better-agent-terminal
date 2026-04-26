// PLAN-031 / T0318 — pure helper tests for server bundle download module.
//
// Only covers the pure functions exported from
// `electron/remote/server-bundle-download.ts`. Stream pipeline / fetch flow
// is integration-tested in Sprint 5 (out of scope per 工單 §238-243).

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  buildBaseURL,
  buildTarballURL,
  parseRateLimitHeaders,
  shouldRetryError,
  shouldThrottleProgress,
} from '../server-bundle-download-helpers'

const ORIGINAL_ENV = process.env.BAT_SERVER_BUNDLE_BASE_URL

describe('buildBaseURL', () => {
  beforeEach(() => {
    delete process.env.BAT_SERVER_BUNDLE_BASE_URL
  })
  afterEach(() => {
    if (ORIGINAL_ENV === undefined) delete process.env.BAT_SERVER_BUNDLE_BASE_URL
    else process.env.BAT_SERVER_BUNDLE_BASE_URL = ORIGINAL_ENV
  })

  it('falls back to GitHub Release URL when no override given', () => {
    expect(buildBaseURL('0.5.0')).toBe(
      'https://github.com/anthropics/better-agent-terminal/releases/download/server-bundle-v0.5.0',
    )
  })

  it('honors BAT_SERVER_BUNDLE_BASE_URL env override', () => {
    process.env.BAT_SERVER_BUNDLE_BASE_URL = 'https://mirror.example.com/bat'
    expect(buildBaseURL('0.5.0')).toBe('https://mirror.example.com/bat')
  })

  it('explicit override beats env override', () => {
    process.env.BAT_SERVER_BUNDLE_BASE_URL = 'https://env.example.com'
    expect(buildBaseURL('0.5.0', 'https://explicit.example.com/bat')).toBe(
      'https://explicit.example.com/bat',
    )
  })

  it('strips trailing slash from override', () => {
    expect(buildBaseURL('0.5.0', 'https://m.example.com/bat/')).toBe(
      'https://m.example.com/bat',
    )
  })

  it('strips trailing slash from env override', () => {
    process.env.BAT_SERVER_BUNDLE_BASE_URL = 'https://env.example.com/bat/'
    expect(buildBaseURL('0.5.0')).toBe('https://env.example.com/bat')
  })

  it('treats empty string override as missing (falls through to env/default)', () => {
    expect(buildBaseURL('0.5.0', '')).toBe(
      'https://github.com/anthropics/better-agent-terminal/releases/download/server-bundle-v0.5.0',
    )
  })

  it('embeds version into default GitHub URL', () => {
    expect(buildBaseURL('1.2.3-pre.4')).toContain('server-bundle-v1.2.3-pre.4')
  })
})

describe('buildTarballURL', () => {
  it('joins base + filename with single slash', () => {
    expect(buildTarballURL('https://m.example.com/bat', 'bat-server-linux-x64-v0.5.0.tar.gz')).toBe(
      'https://m.example.com/bat/bat-server-linux-x64-v0.5.0.tar.gz',
    )
  })

  it('tolerates trailing slash on baseURL', () => {
    expect(buildTarballURL('https://m.example.com/bat/', 'manifest.json')).toBe(
      'https://m.example.com/bat/manifest.json',
    )
  })

  it('passes filename through verbatim (defense, no special escaping)', () => {
    expect(buildTarballURL('https://x', 'a.b.c.tar.gz')).toBe('https://x/a.b.c.tar.gz')
  })
})

describe('shouldRetryError', () => {
  it('retries 5xx HTTP errors', () => {
    expect(shouldRetryError({ status: 500 })).toBe(true)
    expect(shouldRetryError({ status: 502 })).toBe(true)
    expect(shouldRetryError({ status: 599 })).toBe(true)
  })

  it('does not retry 4xx HTTP errors', () => {
    expect(shouldRetryError({ status: 400 })).toBe(false)
    expect(shouldRetryError({ status: 404 })).toBe(false)
  })

  it('does not retry 403 with X-RateLimit-Remaining=0', () => {
    expect(
      shouldRetryError({
        status: 403,
        headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '1700000000' },
      }),
    ).toBe(false)
  })

  it('handles capitalized X-RateLimit-Remaining header', () => {
    expect(
      shouldRetryError({
        status: 403,
        headers: { 'X-RateLimit-Remaining': '0' },
      }),
    ).toBe(false)
  })

  it('retries network errors (ECONNRESET, ETIMEDOUT, etc)', () => {
    expect(shouldRetryError({ code: 'ECONNRESET' })).toBe(true)
    expect(shouldRetryError({ code: 'ETIMEDOUT' })).toBe(true)
    expect(shouldRetryError({ code: 'ENOTFOUND' })).toBe(true)
    expect(shouldRetryError({ code: 'EAI_AGAIN' })).toBe(true)
  })

  it('never retries AbortError', () => {
    expect(shouldRetryError({ name: 'AbortError' })).toBe(false)
    expect(shouldRetryError({ name: 'AbortError', code: 'ECONNRESET' })).toBe(false)
  })

  it('does not retry unknown errors with no status/code', () => {
    expect(shouldRetryError({})).toBe(false)
  })
})

describe('parseRateLimitHeaders', () => {
  it('parses unix epoch seconds for X-RateLimit-Reset', () => {
    const result = parseRateLimitHeaders({
      'x-ratelimit-remaining': '0',
      'x-ratelimit-reset': '1700000000', // 2023-11-14T22:13:20.000Z
    })
    expect(result.remaining).toBe(0)
    expect(result.resetISO).toBe('2023-11-14T22:13:20.000Z')
  })

  it('parses ISO 8601 string for X-RateLimit-Reset', () => {
    const result = parseRateLimitHeaders({
      'x-ratelimit-remaining': '50',
      'x-ratelimit-reset': '2026-01-01T00:00:00Z',
    })
    expect(result.remaining).toBe(50)
    expect(result.resetISO).toBe('2026-01-01T00:00:00.000Z')
  })

  it('handles case-insensitive header names', () => {
    const result = parseRateLimitHeaders({
      'X-RateLimit-Remaining': '10',
      'X-RateLimit-Reset': '1700000000',
    })
    expect(result.remaining).toBe(10)
    expect(result.resetISO).toBe('2023-11-14T22:13:20.000Z')
  })

  it('defaults remaining to 60 when header missing', () => {
    const result = parseRateLimitHeaders({})
    expect(result.remaining).toBe(60)
    expect(result.resetISO).toBeNull()
  })

  it('returns null resetISO when reset header is malformed', () => {
    const result = parseRateLimitHeaders({
      'x-ratelimit-remaining': '0',
      'x-ratelimit-reset': 'not-a-date',
    })
    expect(result.remaining).toBe(0)
    expect(result.resetISO).toBeNull()
  })

  it('treats non-numeric remaining as default 60', () => {
    const result = parseRateLimitHeaders({
      'x-ratelimit-remaining': 'unknown',
    })
    expect(result.remaining).toBe(60)
  })
})

describe('shouldThrottleProgress', () => {
  it('first emission is never throttled', () => {
    expect(shouldThrottleProgress(0, 0, Date.now(), 100)).toBe(false)
  })

  it('throttles when neither byte nor time threshold reached', () => {
    const last = 1_000_000
    expect(shouldThrottleProgress(last, 0, last + 100, 500_000)).toBe(true)
  })

  it('emits when byte threshold (1MB) reached even if time below 500ms', () => {
    const last = 1_000_000
    expect(shouldThrottleProgress(last, 0, last + 100, 1024 * 1024)).toBe(false)
  })

  it('emits when time threshold (500ms) reached even if bytes below 1MB', () => {
    const last = 1_000_000
    expect(shouldThrottleProgress(last, 0, last + 500, 100)).toBe(false)
  })

  it('emits when both thresholds reached', () => {
    const last = 1_000_000
    expect(shouldThrottleProgress(last, 0, last + 600, 2 * 1024 * 1024)).toBe(false)
  })

  it('uses byte delta (currentBytes - lastEmitBytes), not absolute', () => {
    const last = 1_000_000
    // Already emitted 5MB; now at 5.5MB (delta 0.5MB) within 100ms → throttle
    expect(
      shouldThrottleProgress(last, 5 * 1024 * 1024, last + 100, 5 * 1024 * 1024 + 512 * 1024),
    ).toBe(true)
    // delta crosses 1MB → emit
    expect(
      shouldThrottleProgress(last, 5 * 1024 * 1024, last + 100, 6 * 1024 * 1024 + 1),
    ).toBe(false)
  })
})
