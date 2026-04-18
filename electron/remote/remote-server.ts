import { WebSocketServer, WebSocket } from 'ws'
import { randomBytes } from 'crypto'
import { networkInterfaces } from 'os'
import * as https from 'https'
import * as path from 'path'
import { invokeHandler } from './handler-registry'
import { logger } from '../logger'
import { broadcastHub } from './broadcast-hub'
import { PROXIED_EVENTS, type RemoteFrame } from './protocol'
import { loadOrCreateServerCertificate } from './certificate'
import { readSecretFile, writeSecretFile } from './secrets'

export type BindInterface = 'localhost' | 'tailscale' | 'all'

interface AuthenticatedClient {
  ws: WebSocket
  label: string
  connectedAt: number
}

export interface StartServerResult {
  port: number
  token: string
  fingerprint: string
  bindInterface: BindInterface
  host: string
}

const TOKEN_FILENAME = 'server-token.json'

function resolveBindHost(
  bindInterface: BindInterface
): { host: string; error?: string } {
  if (bindInterface === 'localhost') return { host: '127.0.0.1' }
  if (bindInterface === 'all') return { host: '0.0.0.0' }
  // tailscale — find first 100.x.y.z interface; fail-closed if absent.
  const nets = networkInterfaces()
  for (const iface of Object.values(nets)) {
    if (!iface) continue
    for (const net of iface) {
      if (net.family === 'IPv4' && !net.internal && net.address.startsWith('100.')) {
        return { host: net.address }
      }
    }
  }
  return {
    host: '',
    error:
      'bind-interface=tailscale selected but no Tailscale (100.x.y.z) IPv4 interface was found'
  }
}

export class RemoteServer {
  private wss: WebSocketServer | null = null
  private httpsServer: https.Server | null = null
  private token: string = ''
  private fingerprint: string = ''
  private currentBindInterface: BindInterface = 'localhost'
  private currentHost: string = '127.0.0.1'
  private clients: Map<WebSocket, AuthenticatedClient> = new Map()
  private broadcastListener: ((...args: unknown[]) => void) | null = null
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null
  configDir: string = '' // Set by main.ts to app.getPath('userData')

  get port(): number | null {
    const addr = this.wss?.address()
    if (addr && typeof addr === 'object') return addr.port
    return null
  }

  get isRunning(): boolean {
    return this.wss !== null
  }

  get currentToken(): string {
    return this.token
  }

  get currentFingerprint(): string {
    return this.fingerprint
  }

  get bindInterface(): BindInterface {
    return this.currentBindInterface
  }

  get host(): string {
    return this.currentHost
  }

  get connectedClients(): { label: string; connectedAt: number }[] {
    return Array.from(this.clients.values()).map(c => ({
      label: c.label,
      connectedAt: c.connectedAt
    }))
  }

  private tokenPath(): string {
    return path.join(this.configDir, TOKEN_FILENAME)
  }

  private loadPersistedToken(): string | null {
    if (!this.configDir) return null
    return readSecretFile(this.tokenPath())
  }

  private persistToken(token: string): void {
    if (!this.configDir) return
    try {
      writeSecretFile(this.tokenPath(), token)
    } catch (e) {
      logger.warn('[RemoteServer] Failed to persist token:', e)
    }
  }

  async start(
    port: number = 9876,
    token?: string,
    bindInterface: BindInterface = 'localhost'
  ): Promise<StartServerResult> {
    if (this.wss) throw new Error('Server already running')

    if (!this.configDir) {
      throw new Error('RemoteServer: configDir not set — cannot load certificate')
    }

    const bindResolution = resolveBindHost(bindInterface)
    if (bindResolution.error) {
      // fail-closed per PLAN-018 Q2.A
      throw new Error(bindResolution.error)
    }

    // Priority: explicit token > persisted token > new random token
    this.token = token || this.loadPersistedToken() || randomBytes(16).toString('hex')
    this.currentBindInterface = bindInterface
    this.currentHost = bindResolution.host

    const { cert, key, fingerprint } = await loadOrCreateServerCertificate(
      this.configDir
    )
    this.fingerprint = fingerprint

    // Build an HTTPS server so the WebSocket upgrade runs over TLS.
    this.httpsServer = https.createServer({ cert, key })

    await new Promise<void>((resolve, reject) => {
      const onError = (err: Error) => {
        this.httpsServer?.off('listening', onListening)
        reject(err)
      }
      const onListening = () => {
        this.httpsServer?.off('error', onError)
        resolve()
      }
      this.httpsServer!.once('error', onError)
      this.httpsServer!.once('listening', onListening)
      this.httpsServer!.listen(port, bindResolution.host)
    })

    this.wss = new WebSocketServer({ server: this.httpsServer })

    this.wss.on('connection', (ws) => {
      let authenticated = false

      // Auth timeout — must authenticate within 5 seconds
      const authTimeout = setTimeout(() => {
        if (!authenticated) {
          this.sendFrame(ws, { type: 'auth-result', id: '0', error: 'Auth timeout' })
          ws.close()
        }
      }, 5000)

      ws.on('message', async (raw) => {
        let frame: RemoteFrame
        try {
          frame = JSON.parse(raw.toString())
        } catch {
          return // ignore malformed
        }

        // Auth handshake
        if (frame.type === 'auth') {
          if (frame.token === this.token) {
            authenticated = true
            clearTimeout(authTimeout)
            this.clients.set(ws, {
              ws,
              label: (frame.args?.[0] as string) || 'Remote Client',
              connectedAt: Date.now()
            })
            this.sendFrame(ws, { type: 'auth-result', id: frame.id, result: true })
            logger.log(`[RemoteServer] Client authenticated: ${this.clients.get(ws)?.label}`)
          } else {
            this.sendFrame(ws, { type: 'auth-result', id: frame.id, error: 'Invalid token' })
            ws.close()
          }
          return
        }

        if (!authenticated) {
          this.sendFrame(ws, { type: 'invoke-error', id: frame.id, error: 'Not authenticated' })
          return
        }

        // Pong
        if (frame.type === 'ping') {
          this.sendFrame(ws, { type: 'pong', id: frame.id })
          return
        }

        // Invoke
        if (frame.type === 'invoke' && frame.channel) {
          try {
            // Strip trailing nulls — JSON serializes undefined → null, breaking default params
            let args = frame.args || []
            while (args.length > 0 && args[args.length - 1] == null) {
              args = args.slice(0, -1)
            }
            const result = await invokeHandler(frame.channel, args)
            this.sendFrame(ws, { type: 'invoke-result', id: frame.id, result })
          } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err)
            this.sendFrame(ws, { type: 'invoke-error', id: frame.id, error: message })
          }
          return
        }
      })

      ws.on('close', () => {
        clearTimeout(authTimeout)
        const client = this.clients.get(ws)
        if (client) {
          logger.log(`[RemoteServer] Client disconnected: ${client.label}`)
        }
        this.clients.delete(ws)
      })

      ws.on('error', (err) => {
        logger.error('[RemoteServer] WebSocket error:', err.message)
        this.clients.delete(ws)
      })
    })

    // Subscribe to broadcastHub → push proxied events to all clients
    this.broadcastListener = (channel: unknown, ...args: unknown[]) => {
      if (typeof channel !== 'string') return
      if (!PROXIED_EVENTS.has(channel)) return
      const frame: RemoteFrame = {
        type: 'event',
        id: '0',
        channel,
        args
      }
      const data = JSON.stringify(frame)
      for (const client of this.clients.values()) {
        if (client.ws.readyState === WebSocket.OPEN) {
          client.ws.send(data)
        }
      }
    }
    broadcastHub.on('broadcast', this.broadcastListener)

    // Heartbeat — detect dead connections every 30 seconds
    this.heartbeatInterval = setInterval(() => {
      if (!this.wss) return
      for (const client of this.clients.values()) {
        if (client.ws.readyState !== WebSocket.OPEN) {
          this.clients.delete(client.ws)
          continue
        }
        client.ws.ping()
      }
    }, 30000)

    // Persist token after server is listening (encrypted via safeStorage)
    this.persistToken(this.token)

    logger.log(
      `[RemoteServer] Started on ${this.currentHost}:${port} (bind=${bindInterface}), ` +
        `fingerprint=${fingerprint.substring(0, 23)}..., token=${this.token.substring(0, 8)}...`
    )
    return {
      port,
      token: this.token,
      fingerprint,
      bindInterface,
      host: this.currentHost
    }
  }

  stop(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }

    if (this.broadcastListener) {
      broadcastHub.off('broadcast', this.broadcastListener)
      this.broadcastListener = null
    }

    // Close all client connections
    for (const client of this.clients.values()) {
      client.ws.close()
    }
    this.clients.clear()

    if (this.wss) {
      this.wss.close()
      this.wss = null
    }

    if (this.httpsServer) {
      this.httpsServer.close()
      this.httpsServer = null
    }

    logger.log('[RemoteServer] Stopped')
  }

  private sendFrame(ws: WebSocket, frame: RemoteFrame): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(frame))
    }
  }
}
