/**
 * T0381 / BUG-090 (D128): read a BAT server's TLS certificate fingerprint
 * straight from the TLS handshake.
 *
 * The previous implementation sent `GET https://localhost:<port>/fingerprint`,
 * but RemoteServer / bat-server only handles WebSocket upgrades — the HTTP
 * request never got a response and the IPC had no timeout, so the setup
 * wizard hung forever. Here we connect, take
 * `getPeerCertificate().fingerprint256` once the handshake completes, and
 * destroy the socket immediately. Every path is bounded by `timeoutMs`
 * (connect + handshake combined) and always destroys the socket, so no
 * connection is left behind.
 *
 * `fingerprint256` uses the same upper-case, colon-separated SHA-256 format
 * that `electron/remote/certificate.ts` `computeFingerprint()` writes into
 * `remoteFingerprint` (locked by electron/__tests__/tls-fingerprint.test.ts).
 */
import * as tls from 'tls'

export type FingerprintErrorCode =
  | 'fingerprint-invalid-port'
  | 'fingerprint-invalid-host'
  | 'fingerprint-timeout'
  | 'fingerprint-unreachable'
  | 'fingerprint-handshake-failed'

export type FetchFingerprintResult =
  | { ok: true; fingerprint: string }
  | { ok: false; errorCode: FingerprintErrorCode; error: string }

export interface FetchFingerprintOptions {
  host?: string
  timeoutMs?: number
}

export const DEFAULT_FINGERPRINT_HOST = '127.0.0.1'
export const DEFAULT_FINGERPRINT_TIMEOUT_MS = 5_000

/** T0387: hostname / IPv4 / IPv6 literal; no leading `-`, no whitespace. */
const HOST_RE = /^[a-zA-Z0-9._:-]{1,253}$/
const FINGERPRINT_RE = /^[0-9A-F]{2}(:[0-9A-F]{2}){31}$/
const UNREACHABLE_CODES = new Set([
  'ECONNREFUSED',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'ENOTFOUND',
  'EAI_AGAIN',
  'EADDRNOTAVAIL',
])

type TlsConnectImpl = (options: tls.ConnectionOptions) => tls.TLSSocket

let tlsConnectImpl: TlsConnectImpl = (options) => tls.connect(options)

export function setTlsConnectImplForTests(impl: TlsConnectImpl): void {
  tlsConnectImpl = impl
}

export function resetTlsConnectImplForTests(): void {
  tlsConnectImpl = (options) => tls.connect(options)
}

function classifySocketError(error: unknown, target: string): FetchFingerprintResult {
  const code = typeof (error as { code?: unknown })?.code === 'string' ? (error as { code: string }).code : ''
  const message = error instanceof Error ? error.message : String(error)
  if (UNREACHABLE_CODES.has(code)) {
    return { ok: false, errorCode: 'fingerprint-unreachable', error: `Cannot reach ${target}: ${message}` }
  }
  return { ok: false, errorCode: 'fingerprint-handshake-failed', error: `TLS handshake with ${target} failed: ${message}` }
}

export function fetchTlsFingerprint(
  port: number,
  options: FetchFingerprintOptions = {},
): Promise<FetchFingerprintResult> {
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return Promise.resolve({
      ok: false,
      errorCode: 'fingerprint-invalid-port',
      error: `Invalid server port: ${String(port)}`,
    })
  }

  const host = options.host ?? DEFAULT_FINGERPRINT_HOST
  if (typeof host !== 'string' || !HOST_RE.test(host) || host.startsWith('-')) {
    return Promise.resolve({
      ok: false,
      errorCode: 'fingerprint-invalid-host',
      error: `Invalid server host: ${JSON.stringify(host)}`,
    })
  }
  const timeoutMs = options.timeoutMs ?? DEFAULT_FINGERPRINT_TIMEOUT_MS
  const target = `${host}:${port}`

  return new Promise<FetchFingerprintResult>((resolve) => {
    let settled = false
    let socket: tls.TLSSocket | null = null

    const finish = (result: FetchFingerprintResult): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      socket?.destroy()
      resolve(result)
    }

    const timer = setTimeout(() => {
      finish({
        ok: false,
        errorCode: 'fingerprint-timeout',
        error: `TLS handshake with ${target} did not complete within ${timeoutMs}ms`,
      })
    }, timeoutMs)

    try {
      // rejectUnauthorized:false — the server certificate is self-signed; we
      // only read its fingerprint here (TOFU pinning happens at connect time).
      socket = tlsConnectImpl({ host, port, rejectUnauthorized: false })
    } catch (error) {
      finish(classifySocketError(error, target))
      return
    }

    // Keep a permanent error listener: a late error after finish() must not
    // become an unhandled 'error' event.
    socket.on('error', (error) => finish(classifySocketError(error, target)))
    socket.once('close', () => {
      finish({
        ok: false,
        errorCode: 'fingerprint-handshake-failed',
        error: `Connection to ${target} closed before the TLS handshake completed`,
      })
    })
    socket.once('secureConnect', () => {
      const certificate = socket?.getPeerCertificate()
      const fingerprint = typeof certificate?.fingerprint256 === 'string' ? certificate.fingerprint256.toUpperCase() : ''
      if (!FINGERPRINT_RE.test(fingerprint)) {
        finish({
          ok: false,
          errorCode: 'fingerprint-handshake-failed',
          error: `Server at ${target} did not present a certificate`,
        })
        return
      }
      finish({ ok: true, fingerprint })
    })
  })
}
