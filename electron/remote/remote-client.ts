import WebSocket from 'ws'
import type { TLSSocket, PeerCertificate } from 'tls'
import { randomBytes } from 'crypto'
import { BrowserWindow } from 'electron'
import { PROXIED_EVENTS, type RemoteFrame } from './protocol'
import { logger } from '../logger'

interface PendingInvoke {
  resolve: (result: unknown) => void
  reject: (error: Error) => void
  timer: ReturnType<typeof setTimeout>
}

export interface ConnectResult {
  ok: boolean
  fingerprint?: string
  error?: string
  errorCode?:
    | 'auth-failed'
    | 'fingerprint-mismatch'
    | 'timeout'
    | 'network'
    | 'unknown'
}

function normalizeFingerprint(fp: string): string {
  // Accept both lower/upper case, with or without colons, and render as
  // upper-case colon-separated hex — matches certificate.ts.
  return fp.replace(/[^0-9a-fA-F]/g, '').toUpperCase().match(/.{2}/g)?.join(':') || ''
}

// Exponential backoff constants (PLAN-018 T0184).
// Delay = min(30s, 1s * 2^attempt) + random(0, 1s) jitter.
export const RECONNECT_BASE_MS = 1_000
export const RECONNECT_MAX_MS = 30_000
export const RECONNECT_JITTER_MS = 1_000

/**
 * Compute the next reconnect delay using exponential backoff with jitter.
 * Exported for unit tests. `rand` is injectable for deterministic assertions.
 */
export function computeReconnectDelay(attempt: number, rand: () => number = Math.random): number {
  const exp = RECONNECT_BASE_MS * Math.pow(2, Math.max(0, attempt))
  const base = Math.min(RECONNECT_MAX_MS, exp)
  return base + rand() * RECONNECT_JITTER_MS
}

export class RemoteClient {
  private ws: WebSocket | null = null
  private pending: Map<string, PendingInvoke> = new Map()
  private getWindows: () => BrowserWindow[]
  private _connected = false
  private _connectedFingerprint = ''
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private reconnectAttempts = 0
  private host = ''
  private port = 0
  private token = ''
  private label = ''
  private expectedFingerprint = ''
  private shouldReconnect = false

  constructor(getWindows: () => BrowserWindow[]) {
    this.getWindows = getWindows
  }

  get isConnected(): boolean {
    return this._connected && this.ws?.readyState === WebSocket.OPEN
  }

  get connectionInfo(): { host: string; port: number; fingerprint: string } | null {
    if (!this._connected) return null
    return { host: this.host, port: this.port, fingerprint: this._connectedFingerprint }
  }

  /**
   * Connect to a remote server.
   *
   * @param expectedFingerprint Optional — when empty the first successful
   * connection performs TOFU (trust on first use) and returns the server's
   * fingerprint so the caller can pin it for subsequent connects.
   */
  connect(
    host: string,
    port: number,
    token: string,
    label?: string,
    expectedFingerprint?: string
  ): Promise<ConnectResult> {
    if (this.ws) this.disconnect()

    this.host = host
    this.port = port
    this.token = token
    this.label = label || `Client-${randomBytes(3).toString('hex')}`
    this.expectedFingerprint = expectedFingerprint
      ? normalizeFingerprint(expectedFingerprint)
      : ''
    this.shouldReconnect = true

    return this.doConnect()
  }

  private doConnect(): Promise<ConnectResult> {
    return new Promise((resolve) => {
      const url = `wss://${this.host}:${this.port}`
      // We verify the self-signed cert ourselves via fingerprint pinning below,
      // so the normal trust chain check is disabled.
      this.ws = new WebSocket(url, { rejectUnauthorized: false })

      let settled = false
      let observedFingerprint = ''
      const settle = (result: ConnectResult) => {
        if (settled) return
        settled = true
        clearTimeout(authTimeout)
        resolve(result)
      }

      const authTimeout = setTimeout(() => {
        this._connected = false
        this.ws?.close()
        settle({ ok: false, error: 'Connection timeout', errorCode: 'timeout' })
      }, 10000)

      // Fingerprint verification on upgrade — access the underlying TLS socket.
      this.ws.on('upgrade', (res) => {
        const sock = res.socket as TLSSocket | undefined
        const peer: PeerCertificate | undefined = sock?.getPeerCertificate
          ? sock.getPeerCertificate(false)
          : undefined
        const fp = peer?.fingerprint256
          ? normalizeFingerprint(peer.fingerprint256)
          : ''
        observedFingerprint = fp

        if (this.expectedFingerprint && fp && fp !== this.expectedFingerprint) {
          logger.error(
            `[RemoteClient] Fingerprint mismatch: expected ${this.expectedFingerprint.substring(0, 23)}... ` +
              `got ${fp.substring(0, 23)}...`
          )
          this._connected = false
          this.ws?.close()
          settle({
            ok: false,
            error: 'Server fingerprint does not match the pinned value',
            errorCode: 'fingerprint-mismatch',
            fingerprint: fp
          })
        }
      })

      this.ws.on('open', () => {
        // Send auth frame (fingerprint already validated during upgrade)
        const authFrame: RemoteFrame = {
          type: 'auth',
          id: this.nextId(),
          token: this.token,
          args: [this.label]
        }
        this.ws!.send(JSON.stringify(authFrame))
      })

      this.ws.on('message', (raw) => {
        let frame: RemoteFrame
        try {
          frame = JSON.parse(raw.toString())
        } catch {
          return
        }

        // Auth result
        if (frame.type === 'auth-result') {
          if (frame.error) {
            this._connected = false
            logger.error(`[RemoteClient] Auth failed: ${frame.error}`)
            settle({ ok: false, error: frame.error, errorCode: 'auth-failed' })
          } else {
            this._connected = true
            this._connectedFingerprint = observedFingerprint
            this.reconnectAttempts = 0
            logger.log(
              `[RemoteClient] Connected to ${this.host}:${this.port} ` +
                `(fingerprint=${observedFingerprint.substring(0, 23)}...)`
            )
            settle({ ok: true, fingerprint: observedFingerprint })
          }
          return
        }

        // Invoke result
        if (frame.type === 'invoke-result' || frame.type === 'invoke-error') {
          const pending = this.pending.get(frame.id)
          if (pending) {
            clearTimeout(pending.timer)
            this.pending.delete(frame.id)
            if (frame.type === 'invoke-error') {
              pending.reject(new Error(frame.error || 'Remote invoke failed'))
            } else {
              pending.resolve(frame.result)
            }
          }
          return
        }

        // Pong (ignore)
        if (frame.type === 'pong') return

        // Event — forward to renderer
        if (frame.type === 'event' && frame.channel && PROXIED_EVENTS.has(frame.channel)) {
          for (const win of this.getWindows()) {
            if (!win.isDestroyed()) {
              win.webContents.send(frame.channel, ...(frame.args || []))
            }
          }
          return
        }
      })

      this.ws.on('close', () => {
        const wasConnected = this._connected
        this._connected = false

        // Reject all pending invokes
        for (const [id, pending] of this.pending) {
          clearTimeout(pending.timer)
          pending.reject(new Error('Connection closed'))
          this.pending.delete(id)
        }

        if (wasConnected) {
          logger.log('[RemoteClient] Disconnected')
        }

        if (!settled) {
          settle({ ok: false, error: 'Connection closed before auth', errorCode: 'network' })
        }

        // Auto-reconnect if we should
        if (this.shouldReconnect && wasConnected) {
          this.scheduleReconnect()
        }
      })

      this.ws.on('error', (err) => {
        logger.error('[RemoteClient] WebSocket error:', err.message)
        if (!settled) {
          this._connected = false
          settle({ ok: false, error: err.message, errorCode: 'network' })
        }
      })
    })
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return
    const delay = computeReconnectDelay(this.reconnectAttempts)
    this.reconnectAttempts += 1
    logger.log(
      `[RemoteClient] Reconnecting in ${Math.round(delay)}ms ` +
        `(attempt ${this.reconnectAttempts})`
    )
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null
      if (!this.shouldReconnect) return
      try {
        const res = await this.doConnect()
        if (!res.ok && this.shouldReconnect) {
          this.scheduleReconnect()
        }
      } catch {
        if (this.shouldReconnect) {
          this.scheduleReconnect()
        }
      }
    }, delay)
  }

  disconnect(): void {
    this.shouldReconnect = false
    this._connected = false
    this.reconnectAttempts = 0

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    // Reject all pending
    for (const [id, pending] of this.pending) {
      clearTimeout(pending.timer)
      pending.reject(new Error('Disconnected'))
      this.pending.delete(id)
    }

    if (this.ws) {
      this.ws.close()
      this.ws = null
    }

    logger.log('[RemoteClient] Disconnected')
  }

  invoke(channel: string, args: unknown[], timeout = 30000): Promise<unknown> {
    if (!this.isConnected) {
      return Promise.reject(new Error('Not connected to remote server'))
    }

    const id = this.nextId()
    const frame: RemoteFrame = { type: 'invoke', id, channel, args }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`Remote invoke timeout: ${channel}`))
      }, timeout)

      this.pending.set(id, { resolve, reject, timer })
      this.ws!.send(JSON.stringify(frame))
    })
  }

  private _counter = 0
  private nextId(): string {
    return `${Date.now()}-${++this._counter}`
  }
}
