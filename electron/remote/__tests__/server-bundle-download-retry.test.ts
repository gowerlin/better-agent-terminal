// T0548 — server-bundle download: connection errors are classified across the
// fetch error's cause chain and go through the existing retry table.
//
// Error shapes are the ones Node 24 / Electron 41 fetch (undici) throws on
// Windows (probed with ELECTRON_RUN_AS_NODE, T0548 report):
//   127.0.0.1:<closed>  TypeError('fetch failed') ← Error{code:'ECONNREFUSED', errno:-4078}
//   localhost:<closed>  TypeError('fetch failed') ← AggregateError{code} ← [Error ×2]
//   127.0.0.1:9         TypeError('fetch failed') ← Error('bad port')  (no code)
// The tests also cover shapes with the code stripped (only errno / message,
// or only inside AggregateError.errors) so the classification does not depend
// on which layer carries `code`.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as os from 'node:os'
import * as path from 'node:path'
import * as fs from 'node:fs/promises'
import { createHash, randomUUID } from 'node:crypto'
import { getSystemErrorMap } from 'node:util'
import * as net from 'node:net'

import { downloadServerBundle, toAttemptError } from '../server-bundle-download'

const VERSION = '0.5.0'
const ARCH = 'linux-x64' as const

function fetchFailed(cause: unknown): TypeError {
  return new TypeError('fetch failed', { cause })
}

function sysError(message: string, fields: { code?: string; errno?: number | string }): Error {
  return Object.assign(new Error(message), fields)
}

function aggregate(errors: Error[], code?: string): AggregateError {
  const e = new AggregateError(errors, '')
  if (code) Object.assign(e, { code })
  return e
}

function makeManifest() {
  const tarballs: Record<string, { filename: string; sha256: string; size: number }> = {}
  const bodies: Record<string, Buffer> = {}
  for (const arch of ['linux-x64', 'linux-arm64', 'darwin-arm64']) {
    const buf = Buffer.from(`tarball::${arch}::${'x'.repeat(512)}`)
    bodies[arch] = buf
    tarballs[arch] = {
      filename: `bat-server-${arch}-v${VERSION}.tar.gz`,
      sha256: createHash('sha256').update(buf).digest('hex'),
      size: buf.length,
    }
  }
  return {
    manifest: { schemaVersion: '1', version: VERSION, buildDate: '2026-04-01T00:00:00.000Z', tarballs },
    bodies,
  }
}

let cacheDir: string

beforeEach(() => {
  cacheDir = path.join(os.tmpdir(), `bat-t0548-${randomUUID()}`)
  vi.useFakeTimers()
})

afterEach(async () => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  await fs.rm(cacheDir, { recursive: true, force: true }).catch(() => {})
})

async function runDownload() {
  const pending = downloadServerBundle({
    arch: ARCH,
    version: VERSION,
    cacheDir,
    baseURL: 'https://mirror.example.com/bat',
  })
  // Retry backoff uses setTimeout; drain it without waiting 5 s of real time.
  await vi.runAllTimersAsync()
  return pending
}

describe('toAttemptError (T0548)', () => {
  it('reads the code from cause (ECONNREFUSED on 127.0.0.1)', () => {
    const err = fetchFailed(sysError('connect ECONNREFUSED 127.0.0.1:59999', { code: 'ECONNREFUSED', errno: -4078 }))
    const a = toAttemptError(err)
    expect(a.code).toBe('ECONNREFUSED')
    expect(a.name).toBe('TypeError')
    expect(a.message).toBe('fetch failed (connect ECONNREFUSED 127.0.0.1:59999)')
  })

  it('reads the code from AggregateError.errors when no layer above has one', () => {
    const err = fetchFailed(
      aggregate([
        sysError('connect ECONNREFUSED ::1:59999', { code: 'ECONNREFUSED' }),
        sysError('connect ECONNREFUSED 127.0.0.1:59999', { code: 'ECONNREFUSED' }),
      ]),
    )
    expect(toAttemptError(err).code).toBe('ECONNREFUSED')
  })

  it('maps a negative numeric errno to its system error name', () => {
    // libuv errno differs per OS (Windows -4077, Linux -104); use the host's own.
    const errno = [...getSystemErrorMap()].find(([, [name]]) => name === 'ECONNRESET')![0]
    const err = fetchFailed(sysError('socket closed', { errno }))
    expect(toAttemptError(err).code).toBe('ECONNRESET')
  })

  it('accepts a string errno', () => {
    expect(toAttemptError(fetchFailed(sysError('lookup failed', { errno: 'ENOTFOUND' }))).code).toBe('ENOTFOUND')
  })

  it('falls back to a code token in the message', () => {
    expect(toAttemptError(fetchFailed(new Error('connect ETIMEDOUT 10.0.0.1:443'))).code).toBe('ETIMEDOUT')
  })

  it('treats undici connect timeout as ETIMEDOUT', () => {
    const err = fetchFailed(sysError('Connect Timeout Error', { code: 'UND_ERR_CONNECT_TIMEOUT' }))
    expect(toAttemptError(err).code).toBe('ETIMEDOUT')
  })

  it('prefers a retryable code over a non-retryable one found first', () => {
    const err = fetchFailed(
      aggregate([
        sysError('weird', { code: 'EWEIRD' }),
        sysError('connect ECONNRESET', { code: 'ECONNRESET' }),
      ]),
    )
    expect(toAttemptError(err).code).toBe('ECONNRESET')
  })

  it('leaves "bad port" without a code', () => {
    const a = toAttemptError(fetchFailed(new Error('bad port')))
    expect(a.code).toBeUndefined()
    expect(a.message).toBe('fetch failed (bad port)')
  })

  it('survives a cyclic cause chain', () => {
    const a = new Error('a') as Error & { cause?: unknown }
    const b = new Error('b', { cause: a })
    a.cause = b
    expect(() => toAttemptError(a)).not.toThrow()
  })

  it('real fetch to a closed local port is classified as ECONNREFUSED', async () => {
    vi.useRealTimers()
    const port = await new Promise<number>((resolve) => {
      const srv = net.createServer()
      srv.listen(0, '127.0.0.1', () => {
        const p = (srv.address() as net.AddressInfo).port
        srv.close(() => resolve(p))
      })
    })
    for (const host of ['127.0.0.1', 'localhost']) {
      const err = await fetch(`http://${host}:${port}/manifest.json`).then(
        () => null,
        (e: unknown) => e,
      )
      expect(err, host).not.toBeNull()
      expect(toAttemptError(err).code, host).toBe('ECONNREFUSED')
    }
  })

  it('non-Error values keep the old shape', () => {
    expect(toAttemptError('boom')).toEqual({ message: 'boom' })
  })
})

describe('downloadServerBundle retry on connection errors (T0548)', () => {
  it('Windows-shape ECONNREFUSED without cause.code (AggregateError) → retried 4×', async () => {
    let attempts = 0
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      attempts++
      throw fetchFailed(
        aggregate([
          sysError('connect ECONNREFUSED ::1:59999', { errno: -4078 }),
          sysError('connect ECONNREFUSED 127.0.0.1:59999', { errno: -4078 }),
        ]),
      )
    })
    const result = await runDownload()
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errorCode).toBe('manifest-fetch-failed')
    expect(attempts).toBe(4)
    expect(result.error).toMatch(/after 4 attempts/)
    expect(result.error).toMatch(/ECONNREFUSED/)
  })

  it('transient connection error then success → downloads', async () => {
    const { manifest, bodies } = makeManifest()
    let manifestCalls = 0
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const u = String(url)
      if (u.endsWith('/manifest.json')) {
        manifestCalls++
        if (manifestCalls === 1) throw fetchFailed(new Error('read ECONNRESET'))
        return new Response(JSON.stringify(manifest), { status: 200 })
      }
      return new Response(new Uint8Array(bodies[ARCH]), { status: 200 })
    })
    const result = await runDownload()
    expect(result.ok).toBe(true)
    expect(manifestCalls).toBe(2)
  })

  it('"bad port" (no code anywhere) → not retried', async () => {
    let attempts = 0
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      attempts++
      throw fetchFailed(new Error('bad port'))
    })
    const result = await runDownload()
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errorCode).toBe('manifest-fetch-failed')
    expect(attempts).toBe(1)
    expect(result.error).toMatch(/bad port/)
  })

  it('HTTP 404 → not retried (unchanged)', async () => {
    let attempts = 0
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      attempts++
      return new Response('not found', { status: 404, statusText: 'Not Found' })
    })
    const result = await runDownload()
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errorCode).toBe('manifest-fetch-failed')
    expect(attempts).toBe(1)
  })

  it('SHA mismatch on the tarball → not retried (unchanged)', async () => {
    const { manifest, bodies } = makeManifest()
    let tarballCalls = 0
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const u = String(url)
      if (u.endsWith('/manifest.json')) return new Response(JSON.stringify(manifest), { status: 200 })
      tarballCalls++
      const wrong = Buffer.from(bodies[ARCH])
      wrong[0] ^= 0xff
      return new Response(new Uint8Array(wrong), { status: 200 })
    })
    const result = await runDownload()
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errorCode).toBe('sha-mismatch')
    expect(tarballCalls).toBe(1)
  })
})
