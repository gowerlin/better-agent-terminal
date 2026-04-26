import WebSocket from 'ws'
import type { TLSSocket, PeerCertificate } from 'tls'
import { randomBytes } from 'crypto'
import { BrowserWindow } from 'electron'
import { extractTargetOSMeta, type ProfileEntry } from '../profile-manager'
import { PROXIED_EVENTS, type AuthResult, type AuthResultMetadata, type RemoteFrame } from './protocol'
import {
  normalizePathsInResult,
  translateInvokeArgs,
  translateRemoteEventArgs,
} from './path-aware-channels'
import { createTranslator, IdentityTranslator, type PathTranslator } from './path-translator'
import { SshTunnel } from './ssh-tunnel'
import { logger } from '../logger'

// PLAN-007 T0284: After this many consecutive failed tunnel restarts the
// reconnect chain stops trying. Surfaced via existing connection-error path
// (no new IPC channel — T0270 channel set is frozen, AC9).
export const TUNNEL_MAX_RESTART_FAILURES = 5

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
const AUTH_TIMEOUT_MS = 6_000
const DEFAULT_INVOKE_TIMEOUT_MS = 30_000

export class RemoteClient {
  private ws: WebSocket | null = null
  private pending: Map<string, PendingInvoke> = new Map()
  private getWindows: () => BrowserWindow[]
  private profile: ProfileEntry | null
  private translator: PathTranslator = new IdentityTranslator()
  private serverMetadataValue: AuthResultMetadata | null = null
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

  // PLAN-007 T0284: SSH tunnel state. Non-null only when the bound profile is
  // ssh-linux/ssh-darwin with useSshTunnel === true. wss host/port are
  // rewritten to 127.0.0.1:<localPort> once the tunnel is up.
  private tunnel: SshTunnel | null = null
  private remoteServerPort = 0   // pre-tunnel destination port on the SSH host
  private tunnelRestartFailures = 0

  constructor(getWindows: () => BrowserWindow[], profile?: ProfileEntry | null) {
    this.getWindows = getWindows
    this.profile = profile ?? null
  }

  get isConnected(): boolean {
    return this._connected && this.ws?.readyState === WebSocket.OPEN
  }

  get connectionInfo(): { host: string; port: number; fingerprint: string } | null {
    if (!this._connected) return null
    return { host: this.host, port: this.port, fingerprint: this._connectedFingerprint }
  }

  get serverMetadata(): AuthResultMetadata | null {
    return this.serverMetadataValue
  }

  setProfile(profile: ProfileEntry | null): void {
    this.profile = profile
    if (this.serverMetadataValue) {
      this.updateTranslatorFromProfile()
    }
  }

  setTranslator(translator: PathTranslator): void {
    this.translator = translator
  }

  /**
   * Connect to a remote server.
   *
   * @param expectedFingerprint Optional — when empty the first successful
   * connection performs TOFU (trust on first use) and returns the server's
   * fingerprint so the caller can pin it for subsequent connects.
   */
  async connect(
    host: string,
    port: number,
    token: string,
    label?: string,
    expectedFingerprint?: string
  ): Promise<ConnectResult> {
    // BUG-067 (T0299): await disconnect() so the previous tunnel's ssh
    // subprocess fully exits before we spawn a fresh one for the new connect.
    if (this.ws) await this.disconnect()

    this.host = host
    this.port = port
    this.token = token
    this.label = label || `Client-${randomBytes(3).toString('hex')}`
    this.expectedFingerprint = expectedFingerprint
      ? normalizeFingerprint(expectedFingerprint)
      : ''
    this.shouldReconnect = true
    this.remoteServerPort = port

    // PLAN-007 T0284: prepare SshTunnel from profile metadata. doConnect()
    // will lazily start it before opening the wss socket.
    this.maybeCreateTunnel()

    return this.doConnect()
  }

  /**
   * PLAN-007 T0284: instantiate SshTunnel iff the bound profile asks for it.
   * Idempotent — safe to call repeatedly during reconnect.
   */
  private maybeCreateTunnel(): void {
    if (this.tunnel) return
    if (!this.profile) return
    const meta = extractTargetOSMeta(this.profile)
    if (meta.targetOS !== 'ssh-linux' && meta.targetOS !== 'ssh-darwin') return
    if (!meta.useSshTunnel) return
    if (!meta.sshHost || !meta.sshUser) {
      logger.warn(
        '[RemoteClient] profile requests SSH tunnel but sshHost/sshUser are blank — skipping',
      )
      return
    }

    this.tunnel = new SshTunnel({
      sshHost: meta.sshHost,
      sshUser: meta.sshUser,
      sshPort: meta.sshPort,
      sshKeyPath: meta.sshKeyPath,
      remotePort: this.remoteServerPort,
      localPort: meta.tunnelLocalPort,
    })

    this.tunnel.on('tunnel-down', () => {
      logger.warn('[RemoteClient] SshTunnel reported tunnel-down — closing wss to trigger reconnect')
      // Closing the socket fires the existing 'close' handler which decides
      // whether to schedule a reconnect (shouldReconnect && wasConnected).
      try { this.ws?.close() } catch { /* ignore */ }
      // Defensive: if wss was never connected (e.g. tunnel died mid-handshake)
      // the close handler will not schedule, so push a reconnect ourselves.
      if (this.shouldReconnect && !this._connected) {
        this.scheduleReconnect()
      }
    })
  }

  /**
   * PLAN-007 T0284 reconnect chain step 1: ensure the SSH tunnel is up
   * before attempting wss. Returns false (with error) when tunnel start
   * keeps failing past TUNNEL_MAX_RESTART_FAILURES so the caller can
   * surface a connection-error and stop retrying.
   */
  private async ensureTunnelReady(): Promise<{ ok: true } | { ok: false; error: string }> {
    if (!this.tunnel) return { ok: true }
    if (this.tunnel.isAlive()) {
      // Tunnel is up; this.port should already point at its localPort.
      return { ok: true }
    }
    try {
      const { localPort } = await this.tunnel.start()
      // Rewrite wss target to the loopback port the tunnel forwards from.
      this.host = '127.0.0.1'
      this.port = localPort
      this.tunnelRestartFailures = 0
      return { ok: true }
    } catch (err) {
      this.tunnelRestartFailures += 1
      const msg = err instanceof Error ? err.message : String(err)
      logger.error(
        `[RemoteClient] SshTunnel start failed (attempt ${this.tunnelRestartFailures}/${TUNNEL_MAX_RESTART_FAILURES}): ${msg}`,
      )
      return { ok: false, error: msg }
    }
  }

  private async doConnect(): Promise<ConnectResult> {
    // PLAN-007 T0284: ensure tunnel is up before opening wss. If the
    // profile doesn't use a tunnel this is a no-op.
    const tunnelReady = await this.ensureTunnelReady()
    if (!tunnelReady.ok) {
      return {
        ok: false,
        error: `SSH tunnel unavailable: ${tunnelReady.error}`,
        errorCode: 'network',
      }
    }
    return this.openWss()
  }

  private openWss(): Promise<ConnectResult> {
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
      }, AUTH_TIMEOUT_MS)

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
            this.applyAuthResult(frame.result as AuthResult | undefined)
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
          const translatedArgs = translateRemoteEventArgs(
            frame.channel,
            frame.args || [],
            this.translator,
          )
          for (const win of this.getWindows()) {
            if (!win.isDestroyed()) {
              win.webContents.send(frame.channel, ...translatedArgs)
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
    // PLAN-007 T0284: bail when SSH tunnel restarts have repeatedly failed.
    // Surface the failure to renderers via the existing connection-error
    // channel rather than introducing a new IPC name (AC9).
    if (
      this.tunnel
      && this.tunnelRestartFailures >= TUNNEL_MAX_RESTART_FAILURES
    ) {
      // AC9: T0270 froze the IPC channel set, so we surface this via a
      // structured logger.error instead of inventing a new channel. The
      // wizard work in T0285 will add the user-visible modal hookup using
      // an existing channel (e.g. piggy-back on auth-result with an
      // errorType discriminator) once it ships.
      logger.error(
        `[RemoteClient] tunnel restart gave up: errorType=tunnel host=${this.host} port=${this.port} ` +
          `failures=${this.tunnelRestartFailures}`,
      )
      this.shouldReconnect = false
      return
    }
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
        // doConnect() will run ensureTunnelReady() first, so a dead tunnel
        // is rebuilt before the wss attempt (PLAN-007 T0284 reconnect chain).
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

  async disconnect(): Promise<void> {
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

    // PLAN-007 T0284 + BUG-067 (T0299): tear down the SSH tunnel and await
    // the ssh subprocess's actual exit so the next connect() doesn't race a
    // half-dead forwarder. start() will rebuild the tunnel on the next
    // connect() if the profile still asks for it.
    if (this.tunnel) {
      const t = this.tunnel
      this.tunnel = null
      this.tunnelRestartFailures = 0
      try {
        await t.stop()
      } catch (err) {
        logger.warn(
          '[RemoteClient] tunnel stop failed during disconnect:',
          err instanceof Error ? err.message : String(err),
        )
      }
    }

    logger.log('[RemoteClient] Disconnected')
  }

  invoke(channel: string, args: unknown[], timeout = DEFAULT_INVOKE_TIMEOUT_MS): Promise<unknown> {
    if (!this.isConnected) {
      return Promise.reject(new Error('Not connected to remote server'))
    }

    const id = this.nextId()
    const translatedArgs = translateInvokeArgs(channel, args, this.translator)
    const frame: RemoteFrame = { type: 'invoke', id, channel, args: translatedArgs }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`Remote invoke timeout: ${channel}`))
      }, timeout)

      this.pending.set(id, {
        resolve: (result) => {
          resolve(normalizePathsInResult(channel, result, this.translator))
        },
        reject,
        timer,
      })
      this.ws!.send(JSON.stringify(frame))
    })
  }

  private applyAuthResult(result: AuthResult | undefined): void {
    if (result && typeof result === 'object') {
      this.serverMetadataValue = result
      this.updateTranslatorFromProfile()
      return
    }
    this.serverMetadataValue = null
    this.translator = new IdentityTranslator()
  }

  private updateTranslatorFromProfile(): void {
    if (!this.profile) {
      this.translator = new IdentityTranslator()
      return
    }

    try {
      this.translator = createTranslator(this.profile)
    } catch (error) {
      logger.warn(
        '[RemoteClient] translator not available, using Identity:',
        error instanceof Error ? error.message : String(error),
      )
      this.translator = new IdentityTranslator()
    }
  }

  private _counter = 0
  private nextId(): string {
    return `${Date.now()}-${++this._counter}`
  }
}
