// @vitest-environment node
/**
 * T0381 / BUG-090 (D128): the setup wizard reads the BAT server fingerprint
 * from the TLS handshake. Every path is time-bounded and destroys its socket.
 */
import { EventEmitter } from 'events'
import * as net from 'net'
import * as tls from 'tls'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { generateSelfSignedCert, type CertificateBundle } from '../remote/certificate'
import {
  DEFAULT_FINGERPRINT_HOST,
  DEFAULT_FINGERPRINT_TIMEOUT_MS,
  fetchTlsFingerprint,
  resetTlsConnectImplForTests,
  setTlsConnectImplForTests,
} from '../tls-fingerprint'

const FINGERPRINT_FORMAT = /^[0-9A-F]{2}(:[0-9A-F]{2}){31}$/

let bundle: CertificateBundle
const servers: net.Server[] = []

beforeAll(async () => {
  bundle = await generateSelfSignedCert(1)
}, 30_000)

afterEach(async () => {
  resetTlsConnectImplForTests()
  vi.useRealTimers()
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))))
})

function listen(server: net.Server): Promise<number> {
  servers.push(server)
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve((server.address() as net.AddressInfo).port))
  })
}

async function waitForNoConnections(server: net.Server): Promise<number> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const count = await new Promise<number>((resolve) => server.getConnections((_err, n) => resolve(n)))
    if (count === 0) return 0
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
  return new Promise<number>((resolve) => server.getConnections((_err, n) => resolve(n)))
}

describe('fetchTlsFingerprint — real sockets', () => {
  it('defaults to 127.0.0.1 with a 5s budget', () => {
    expect(DEFAULT_FINGERPRINT_HOST).toBe('127.0.0.1')
    expect(DEFAULT_FINGERPRINT_TIMEOUT_MS).toBe(5_000)
  })

  it('returns the peer certificate fingerprint in the same format certificate.ts pins', async () => {
    const server = tls.createServer({ cert: bundle.cert, key: bundle.key })
    const port = await listen(server)

    const result = await fetchTlsFingerprint(port)

    expect(result).toEqual({ ok: true, fingerprint: bundle.fingerprint })
    expect(bundle.fingerprint).toMatch(FINGERPRINT_FORMAT)
    expect(await waitForNoConnections(server)).toBe(0)
  })

  it('times out when the peer accepts TCP but never speaks TLS, and drops the connection', async () => {
    // resume(): read (and discard) client bytes so the server notices the
    // client's FIN/RST; a paused socket would never observe the close.
    const server = net.createServer((socket) => { socket.resume() })
    const port = await listen(server)

    const started = Date.now()
    const result = await fetchTlsFingerprint(port, { timeoutMs: 300 })

    expect(result).toMatchObject({ ok: false, errorCode: 'fingerprint-timeout' })
    expect(Date.now() - started).toBeLessThan(3_000)
    expect(await waitForNoConnections(server)).toBe(0)
  })

  it('maps a refused connection to fingerprint-unreachable', async () => {
    const probe = net.createServer()
    const port = await new Promise<number>((resolve) => {
      probe.listen(0, '127.0.0.1', () => resolve((probe.address() as net.AddressInfo).port))
    })
    await new Promise<void>((resolve) => probe.close(() => resolve()))

    const result = await fetchTlsFingerprint(port)

    expect(result).toMatchObject({ ok: false, errorCode: 'fingerprint-unreachable' })
  })

  it('maps a non-TLS peer to fingerprint-handshake-failed', async () => {
    const server = net.createServer((socket) => {
      socket.resume()
      socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n')
    })
    const port = await listen(server)

    const result = await fetchTlsFingerprint(port, { timeoutMs: 2_000 })

    expect(result).toMatchObject({ ok: false, errorCode: 'fingerprint-handshake-failed' })
    expect(await waitForNoConnections(server)).toBe(0)
  })

  it.each([0, -1, 65_536, 1.5, Number.NaN])('rejects invalid port %s without connecting', async (port) => {
    const connect = vi.fn()
    setTlsConnectImplForTests(connect as unknown as (options: tls.ConnectionOptions) => tls.TLSSocket)

    const result = await fetchTlsFingerprint(port)

    expect(result).toMatchObject({ ok: false, errorCode: 'fingerprint-invalid-port' })
    expect(connect).not.toHaveBeenCalled()
  })
})

class FakeSocket extends EventEmitter {
  destroy = vi.fn(() => this)
  getPeerCertificate = vi.fn((): Partial<tls.PeerCertificate> => ({}))
}

describe('fetchTlsFingerprint — mocked tls.connect', () => {
  it('connects with rejectUnauthorized:false to the requested host/port', async () => {
    const socket = new FakeSocket()
    socket.getPeerCertificate.mockReturnValue({ fingerprint256: 'ab:'.repeat(31) + 'cd' })
    const connect = vi.fn(() => {
      queueMicrotask(() => socket.emit('secureConnect'))
      return socket as unknown as tls.TLSSocket
    })
    setTlsConnectImplForTests(connect)

    const result = await fetchTlsFingerprint(9876)

    expect(connect).toHaveBeenCalledWith({ host: '127.0.0.1', port: 9876, rejectUnauthorized: false })
    expect(result).toEqual({ ok: true, fingerprint: 'AB:'.repeat(31) + 'CD' })
    expect(socket.destroy).toHaveBeenCalledTimes(1)
  })

  it('destroys the socket when the timeout fires', async () => {
    vi.useFakeTimers()
    const socket = new FakeSocket()
    setTlsConnectImplForTests(() => socket as unknown as tls.TLSSocket)

    const pending = fetchTlsFingerprint(9876)
    await vi.advanceTimersByTimeAsync(DEFAULT_FINGERPRINT_TIMEOUT_MS)
    const result = await pending

    expect(result).toMatchObject({ ok: false, errorCode: 'fingerprint-timeout' })
    expect(socket.destroy).toHaveBeenCalledTimes(1)
    // Late events after settling are swallowed (no unhandled 'error').
    expect(() => socket.emit('error', new Error('late'))).not.toThrow()
  })

  it('destroys the socket and fails when the peer presents no certificate', async () => {
    const socket = new FakeSocket()
    setTlsConnectImplForTests(() => {
      queueMicrotask(() => socket.emit('secureConnect'))
      return socket as unknown as tls.TLSSocket
    })

    const result = await fetchTlsFingerprint(9876)

    expect(result).toMatchObject({ ok: false, errorCode: 'fingerprint-handshake-failed' })
    expect(socket.destroy).toHaveBeenCalledTimes(1)
  })

  it('classifies socket errors by errno code', async () => {
    for (const [code, expected] of [
      ['ECONNREFUSED', 'fingerprint-unreachable'],
      ['EHOSTUNREACH', 'fingerprint-unreachable'],
      ['ECONNRESET', 'fingerprint-handshake-failed'],
      ['ERR_SSL_WRONG_VERSION_NUMBER', 'fingerprint-handshake-failed'],
    ] as const) {
      const socket = new FakeSocket()
      setTlsConnectImplForTests(() => {
        queueMicrotask(() => socket.emit('error', Object.assign(new Error(code), { code })))
        return socket as unknown as tls.TLSSocket
      })

      const result = await fetchTlsFingerprint(9876)

      expect(result).toMatchObject({ ok: false, errorCode: expected })
      expect(socket.destroy).toHaveBeenCalledTimes(1)
    }
  })

  it('maps a synchronous tls.connect throw instead of leaking it', async () => {
    setTlsConnectImplForTests(() => {
      throw Object.assign(new Error('getaddrinfo ENOTFOUND'), { code: 'ENOTFOUND' })
    })

    await expect(fetchTlsFingerprint(9876)).resolves.toMatchObject({ ok: false, errorCode: 'fingerprint-unreachable' })
  })
})
