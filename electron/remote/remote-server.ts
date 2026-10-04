import { WebSocketServer, WebSocket } from 'ws'
import { randomBytes } from 'crypto'
import { networkInterfaces } from 'os'
import * as os from 'os'
import * as https from 'https'
import * as fs from 'fs'
import * as path from 'path'
import { invokeHandler } from './handler-registry'
import { logger as defaultLogger } from '../logger'
import { broadcastHub } from './broadcast-hub'
import { PROXIED_EVENTS, type AuthResultMetadata, type AuthServerEnv, type RemoteFrame } from './protocol'
import {
  FileCertificateProvider,
  type CertificateProvider,
  type LoadedCertificateBundle,
} from './certificate'
import { readSecretFile, writeSecretFile } from './secrets'
import {
  authorizeHelperInvoke,
  safeTokenEqual,
  type HelperCapabilityRegistry,
  type HelperCapabilityRole,
} from './helper-capability'

export type BindInterface = 'localhost' | 'tailscale' | 'all' | `ip:${string}`

interface AuthenticatedClient {
  ws: WebSocket
  label: string
  connectedAt: number
  /** T0406: handed to handlers as `ctx.connectionId` (per-connection state, e.g. synced fs roots). */
  connectionId: string
}

/**
 * T0432: a connection authenticated with a per-PTY capability (helper inside a PTY).
 * Kept apart from `clients`: it gets no broadcasts and does not count as a client.
 */
interface HelperConnection {
  ws: WebSocket
  /** `HelperCapabilityRegistry.lookup` key — re-checked on every frame (revocation). */
  capabilityKey: string
  terminalId: string
  role: HelperCapabilityRole
  connectionId: string
}

export interface StartServerResult {
  port: number
  token: string
  fingerprint: string
  bindInterface: BindInterface
  host: string
}

export interface AuthFailureEntry {
  count: number
  firstFailAt: number
  bannedUntil?: number
}

export interface RotateTokenResult {
  token: string
  oldToken: string
  oldValidUntil: number
}

interface RemoteServerLogger {
  log: (...args: unknown[]) => void
  warn: (...args: unknown[]) => void
  error: (...args: unknown[]) => void
}

interface RemoteServerOptions {
  certificateProvider?: CertificateProvider
  logger?: RemoteServerLogger
  /** BUG-103: server environment reported in auth metadata. Default: `detectServerEnv()` per auth. */
  detectServerEnv?: () => ServerEnvInfo
  /**
   * T0432: per-PTY capabilities accepted at auth (headless). Absent = only the server
   * token authenticates (Electron, unchanged).
   */
  helperCapabilities?: HelperCapabilityRegistry
  /** T0432: PTY liveness for helper `terminal:create-agent-command` (absent ⇒ denied). */
  isTerminalAlive?: (id: string) => boolean
}

const TOKEN_FILENAME = 'server-token.json'

export const AUTH_FAIL_WINDOW_MS = 60_000
export const AUTH_FAIL_THRESHOLD = 5
export const AUTH_BAN_DURATION_MS = 10 * 60_000
const WS_MAX_PAYLOAD_BYTES = 32 * 1024 * 1024

export function normalizeIp(raw: string): string {
  if (!raw) return ''
  const lower = raw.toLowerCase()
  if (lower.startsWith('::ffff:')) return raw.slice(7)
  return raw
}

export function isIpBanned(
  store: Map<string, AuthFailureEntry>,
  ip: string,
  now: number
): boolean {
  const entry = store.get(ip)
  if (!entry?.bannedUntil) return false
  if (now < entry.bannedUntil) return true
  store.delete(ip)
  return false
}

export function recordAuthFailure(
  store: Map<string, AuthFailureEntry>,
  ip: string,
  now: number
): boolean {
  const existing = store.get(ip)
  if (!existing || now - existing.firstFailAt > AUTH_FAIL_WINDOW_MS) {
    store.set(ip, { count: 1, firstFailAt: now })
    return false
  }
  existing.count += 1
  if (existing.count >= AUTH_FAIL_THRESHOLD) {
    existing.bannedUntil = now + AUTH_BAN_DURATION_MS
    return true
  }
  return false
}

function resolveBindHost(
  bindInterface: BindInterface
): { host: string; error?: string } {
  if (bindInterface === 'localhost') return { host: '127.0.0.1' }
  if (bindInterface === 'all') return { host: '0.0.0.0' }
  if (bindInterface.startsWith('ip:')) {
    const host = bindInterface.slice(3).trim()
    if (!host) return { host: '', error: 'bind-interface=ip requires an explicit IPv4/IPv6 address' }
    return { host }
  }
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

function resolveBundleVersion(): string {
  try {
    const electron = require('electron') as { app?: { getVersion(): string } }
    if (electron.app?.getVersion) {
      return electron.app.getVersion()
    }
  } catch {
    // ignore
  }

  try {
    const pkgPath = path.resolve(__dirname, '..', '..', 'package.json')
    const raw = fs.readFileSync(pkgPath, 'utf8')
    const pkg = JSON.parse(raw) as { version?: string }
    if (pkg.version) return pkg.version
  } catch {
    // ignore
  }

  return '0.0.0'
}

/** What `detectServerEnv` reads; every field defaults to the real process (tests inject). */
export interface ServerEnvProbe {
  platform: NodeJS.Platform
  env: NodeJS.ProcessEnv
  readProcVersion: () => string
}

export interface ServerEnvInfo {
  serverEnv: Extract<AuthServerEnv, 'native' | 'wsl'>
  /** Only when `WSL_DISTRO_NAME` is set; a systemd unit may not carry it (then `/proc/version` decides alone). */
  wslDistro?: string
}

/**
 * BUG-103 (T0404): WSL = Linux with `WSL_DISTRO_NAME` set, or `/proc/version`
 * mentioning Microsoft (any case). Anything unreadable or unexpected falls back
 * to `'native'` — this only feeds auth metadata and must never fail an auth.
 */
export function detectServerEnv(probe: Partial<ServerEnvProbe> = {}): ServerEnvInfo {
  try {
    if ((probe.platform ?? process.platform) !== 'linux') return { serverEnv: 'native' }
    const distro = (probe.env ?? process.env).WSL_DISTRO_NAME?.trim()
    if (distro) return { serverEnv: 'wsl', wslDistro: distro }
    const readProcVersion = probe.readProcVersion ?? (() => fs.readFileSync('/proc/version', 'utf8'))
    if (/microsoft/i.test(readProcVersion())) return { serverEnv: 'wsl' }
  } catch {
    // fall through to native
  }
  return { serverEnv: 'native' }
}

function safeHomedir(): string | undefined {
  try {
    return os.homedir() || undefined
  } catch {
    return undefined
  }
}

export function buildAuthMetadata(envInfo: ServerEnvInfo = detectServerEnv()): AuthResultMetadata {
  const metadata: AuthResultMetadata = {
    serverPlatform: os.platform() as AuthResultMetadata['serverPlatform'],
    serverArch: os.arch() as AuthResultMetadata['serverArch'],
    serverEnv: envInfo.serverEnv,
    nodeVersion: process.versions.node,
    bundleVersion: resolveBundleVersion(),
  }
  // BUG-103: WSL only — native keeps its pre-T0404 shape (the SSH wizard prefers
  // `metadata.serverHome` over the home it probed, so a native server must not start sending one).
  if (envInfo.serverEnv === 'wsl') {
    if (envInfo.wslDistro) metadata.wslDistro = envInfo.wslDistro
    const home = safeHomedir()
    if (home) metadata.serverHome = home
  }
  return metadata
}

export class RemoteServer {
  private wss: WebSocketServer | null = null
  private httpsServer: https.Server | null = null
  private token: string = ''
  private previousToken: { token: string; validUntil: number } | null = null
  private fingerprint: string = ''
  private certificateExpiresAt = 0
  private currentBindInterface: BindInterface = 'localhost'
  private currentHost: string = '127.0.0.1'
  private clients: Map<WebSocket, AuthenticatedClient> = new Map()
  private helpers: Map<WebSocket, HelperConnection> = new Map()
  private authFailures: Map<string, AuthFailureEntry> = new Map()
  private broadcastListener: ((...args: unknown[]) => void) | null = null
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null
  private readonly certificateProvider?: CertificateProvider
  private readonly log: RemoteServerLogger
  private readonly detectEnv: () => ServerEnvInfo
  private readonly helperCapabilities?: HelperCapabilityRegistry
  private readonly isTerminalAlive?: (id: string) => boolean
  private clientCountListeners: Set<(count: number) => void> = new Set()
  private clientDisconnectListeners: Set<(connectionId: string) => void> = new Set()
  private lastNotifiedClientCount = 0
  configDir: string = ''

  constructor(options: RemoteServerOptions = {}) {
    this.certificateProvider = options.certificateProvider
    this.log = options.logger ?? defaultLogger
    this.detectEnv = options.detectServerEnv ?? (() => detectServerEnv())
    this.helperCapabilities = options.helperCapabilities
    this.isTerminalAlive = options.isTerminalAlive
  }

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

  get certificateExpiry(): number {
    return this.certificateExpiresAt
  }

  /**
   * T0404: number of authenticated clients (unauthenticated sockets do not count).
   * T0432: helper (capability) connections do not count either — a helper kept
   * connected must not hold off the orphan PTY reclaim.
   */
  getClientCount(): number {
    return this.clients.size
  }

  /**
   * T0432: clients that receive broadcasts, not counting `excludeConnectionId` (the
   * invoker when it is a client). Helper connections never receive broadcasts.
   */
  countBroadcastReceivers(excludeConnectionId?: string | null): number {
    let count = 0
    for (const client of this.clients.values()) {
      if (client.connectionId !== excludeConnectionId) count++
    }
    return count
  }

  /** T0432: open helper (capability) connections. */
  getHelperConnectionCount(): number {
    return this.helpers.size
  }

  /**
   * T0404: called with the new authenticated-client count whenever it changes
   * (auth success, close / error / heartbeat cleanup, stop). Returns an unsubscribe.
   */
  onClientCountChange(listener: (count: number) => void): () => void {
    this.clientCountListeners.add(listener)
    return () => {
      this.clientCountListeners.delete(listener)
    }
  }

  /**
   * T0406: called with the `connectionId` of every authenticated client that
   * goes away (close / error / heartbeat cleanup / stop). Returns an unsubscribe.
   */
  onClientDisconnect(listener: (connectionId: string) => void): () => void {
    this.clientDisconnectListeners.add(listener)
    return () => {
      this.clientDisconnectListeners.delete(listener)
    }
  }

  /** Removes an authenticated client (no-op if it is not one) and reports its connection id. */
  private dropClient(ws: WebSocket): void {
    const client = this.clients.get(ws)
    if (!client) return
    this.clients.delete(ws)
    for (const listener of Array.from(this.clientDisconnectListeners)) {
      try {
        listener(client.connectionId)
      } catch (e) {
        this.log.warn('[RemoteServer] client disconnect listener failed:', e)
      }
    }
  }

  private notifyClientCount(): void {
    const count = this.clients.size
    if (count === this.lastNotifiedClientCount) return
    this.lastNotifiedClientCount = count
    for (const listener of [...this.clientCountListeners]) {
      try {
        listener(count)
      } catch (e) {
        this.log.warn('[RemoteServer] client count listener failed:', e)
      }
    }
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
      this.log.warn('[RemoteServer] Failed to persist token:', e)
    }
  }

  private getCertificateProvider(): CertificateProvider {
    return this.certificateProvider ?? new FileCertificateProvider(this.configDir)
  }

  private applyLoadedCertificate(bundle: LoadedCertificateBundle): void {
    this.fingerprint = bundle.fingerprint
    this.certificateExpiresAt = bundle.expiresAt
  }

  // T0432: constant-time comparison (`safeTokenEqual`: a length mismatch is false first).
  private isTokenAccepted(candidate?: string): boolean {
    if (!candidate) return false
    if (safeTokenEqual(candidate, this.token)) return true
    if (this.previousToken && Date.now() <= this.previousToken.validUntil) {
      return safeTokenEqual(candidate, this.previousToken.token)
    }
    if (this.previousToken && Date.now() > this.previousToken.validUntil) {
      this.previousToken = null
    }
    return false
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
      throw new Error(bindResolution.error)
    }

    this.token = token || this.loadPersistedToken() || randomBytes(16).toString('hex')
    this.currentBindInterface = bindInterface
    this.currentHost = bindResolution.host

    const bundle = await this.getCertificateProvider().load()
    const { cert, key } = bundle
    this.applyLoadedCertificate(bundle)

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

    this.wss = new WebSocketServer({
      server: this.httpsServer,
      maxPayload: WS_MAX_PAYLOAD_BYTES
    })

    this.wss.on('connection', (ws, req) => {
      const clientIp = normalizeIp(req.socket?.remoteAddress || '')

      if (clientIp && isIpBanned(this.authFailures, clientIp, Date.now())) {
        this.log.warn(
          `[RemoteServer] Rejected banned IP ${clientIp} (brute-force throttle active)`
        )
        this.sendFrame(ws, { type: 'auth-result', id: '0', error: 'Too many failed attempts' })
        ws.close()
        return
      }

      let authenticated = false

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
          return
        }

        if (frame.type === 'auth') {
          if (this.isTokenAccepted(frame.token)) {
            // T0432: a socket is a client or a helper, never both.
            this.dropHelper(ws)
            authenticated = true
            clearTimeout(authTimeout)
            if (clientIp) this.authFailures.delete(clientIp)
            this.clients.set(ws, {
              ws,
              label: (frame.args?.[0] as string) || 'Remote Client',
              connectedAt: Date.now(),
              connectionId: randomBytes(8).toString('hex'),
            })
            this.sendFrame(ws, { type: 'auth-result', id: frame.id, result: buildAuthMetadata(this.detectEnv()) })
            this.log.log(`[RemoteServer] Client authenticated: ${this.clients.get(ws)?.label}`)
            this.notifyClientCount()
          } else if (this.acceptHelper(ws, frame.token)) {
            authenticated = true
            clearTimeout(authTimeout)
            if (clientIp) this.authFailures.delete(clientIp)
            this.sendFrame(ws, { type: 'auth-result', id: frame.id, result: buildAuthMetadata(this.detectEnv()) })
          } else {
            if (clientIp) {
              const banned = recordAuthFailure(this.authFailures, clientIp, Date.now())
              if (banned) {
                this.log.warn(
                  `[RemoteServer] IP ${clientIp} banned for ${AUTH_BAN_DURATION_MS / 60000}min ` +
                    `after ${AUTH_FAIL_THRESHOLD} failed auth attempts`
                )
              }
            }
            this.sendFrame(ws, { type: 'auth-result', id: frame.id, error: 'Invalid token' })
            ws.close()
          }
          return
        }

        if (!authenticated) {
          this.sendFrame(ws, { type: 'invoke-error', id: frame.id, error: 'Not authenticated' })
          ws.close()
          return
        }

        if (this.helpers.has(ws)) {
          await this.handleHelperFrame(ws, frame)
          return
        }

        if (frame.type === 'ping') {
          this.sendFrame(ws, { type: 'pong', id: frame.id })
          return
        }

        if (frame.type === 'invoke' && frame.channel) {
          try {
            let args = frame.args || []
            while (args.length > 0 && args[args.length - 1] == null) {
              args = args.slice(0, -1)
            }
            const result = await invokeHandler(frame.channel, args, null, this.clients.get(ws)?.connectionId)
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
        this.dropHelper(ws)
        const client = this.clients.get(ws)
        if (client) {
          this.log.log(`[RemoteServer] Client disconnected: ${client.label}`)
        }
        this.dropClient(ws)
        this.notifyClientCount()
      })

      ws.on('error', (err) => {
        this.log.error('[RemoteServer] WebSocket error:', err.message)
        this.dropHelper(ws)
        this.dropClient(ws)
        this.notifyClientCount()
      })
    })

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

    this.heartbeatInterval = setInterval(() => {
      if (!this.wss) return
      for (const client of this.clients.values()) {
        if (client.ws.readyState !== WebSocket.OPEN) {
          this.dropClient(client.ws)
          continue
        }
        client.ws.ping()
      }
      for (const helper of Array.from(this.helpers.values())) {
        if (helper.ws.readyState !== WebSocket.OPEN) this.dropHelper(helper.ws)
      }
      this.notifyClientCount()
    }, 30000)

    this.persistToken(this.token)

    const actualPort = this.port ?? port
    // T0432: no part of the token is logged (T0420 out-of-scope ②).
    this.log.log(
      `[RemoteServer] Started on ${this.currentHost}:${actualPort} (bind=${bindInterface}), ` +
        `fingerprint=${this.fingerprint.substring(0, 23)}...`
    )
    return {
      port: actualPort,
      token: this.token,
      fingerprint: this.fingerprint,
      bindInterface,
      host: this.currentHost
    }
  }

  async rotateToken(opts: { gracePeriodMs?: number } = {}): Promise<RotateTokenResult> {
    const oldToken = this.token || this.loadPersistedToken() || randomBytes(16).toString('hex')
    const token = randomBytes(32).toString('base64url')
    const oldValidUntil = Date.now() + (opts.gracePeriodMs ?? 300_000)

    this.previousToken = { token: oldToken, validUntil: oldValidUntil }
    this.token = token
    this.persistToken(token)

    this.log.log(
      `[RemoteServer] Token rotated; old token valid until ${new Date(oldValidUntil).toISOString()}`
    )
    return { token, oldToken, oldValidUntil }
  }

  async renewCertificate(): Promise<{ fingerprint: string; expiresAt: number }> {
    const bundle = await this.getCertificateProvider().renew()
    this.applyLoadedCertificate(bundle)
    const tlsServer = this.httpsServer as https.Server & {
      setSecureContext?: (options: { cert: string; key: string }) => void
    }
    tlsServer.setSecureContext?.({ cert: bundle.cert, key: bundle.key })
    this.log.log(
      `[RemoteServer] Certificate renewed; fingerprint=${bundle.fingerprint.substring(0, 23)}...`
    )
    return {
      fingerprint: bundle.fingerprint,
      expiresAt: bundle.expiresAt
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

    for (const client of Array.from(this.clients.values())) {
      client.ws.close()
      this.dropClient(client.ws)
    }
    for (const helper of Array.from(this.helpers.values())) {
      helper.ws.close()
      this.dropHelper(helper.ws)
    }
    this.notifyClientCount()

    if (this.wss) {
      this.wss.close()
      this.wss = null
    }

    if (this.httpsServer) {
      this.httpsServer.close()
      this.httpsServer = null
    }

    this.log.log('[RemoteServer] Stopped')
  }

  async restart(newPort: number): Promise<StartServerResult & { restartError?: string }> {
    const oldPort = this.port
    const oldToken = this.token
    const oldBind = this.currentBindInterface

    if (!this.wss) {
      return this.start(newPort, oldToken || undefined, oldBind)
    }

    if (oldPort === newPort) {
      return {
        port: oldPort,
        token: oldToken,
        fingerprint: this.fingerprint,
        bindInterface: oldBind,
        host: this.currentHost,
      }
    }

    this.log.log(`[RemoteServer] Hot-switching port ${oldPort} → ${newPort} (bind=${oldBind})`)

    this.stop()

    try {
      const result = await this.start(newPort, oldToken, oldBind)
      this.log.log(`[RemoteServer] Hot-switch to ${newPort} succeeded`)
      return result
    } catch (err) {
      const newErr = err instanceof Error ? err.message : String(err)
      this.log.warn(`[RemoteServer] Hot-switch to ${newPort} failed: ${newErr} — attempting rollback to ${oldPort}`)
      try {
        if (oldPort === null) throw new Error('No previous port to recover')
        const recovered = await this.start(oldPort, oldToken, oldBind)
        return { ...recovered, restartError: newErr }
      } catch (recoverErr) {
        const recoverMsg = recoverErr instanceof Error ? recoverErr.message : String(recoverErr)
        throw new Error(
          `Failed to bind new port ${newPort} (${newErr}); rollback to old port ${oldPort} also failed (${recoverMsg})`
        )
      }
    }
  }

  /** T0432: authenticates `ws` as a helper when `token` is a live capability. */
  private acceptHelper(ws: WebSocket, token: unknown): boolean {
    // A client socket cannot step down to a helper (it would keep its broadcasts).
    if (this.clients.has(ws)) return false
    const verified = this.helperCapabilities?.verify(token)
    if (!verified) return false
    const { terminalId, role } = verified.capability
    this.helpers.set(ws, {
      ws,
      capabilityKey: verified.key,
      terminalId,
      role,
      connectionId: randomBytes(8).toString('hex'),
    })
    this.log.log(`[RemoteServer] Helper authenticated: role=${role} terminal=${terminalId}`)
    return true
  }

  private dropHelper(ws: WebSocket): void {
    const helper = this.helpers.get(ws)
    if (!helper) return
    this.helpers.delete(ws)
    this.log.log(`[RemoteServer] Helper disconnected: role=${helper.role} terminal=${helper.terminalId}`)
  }

  /**
   * T0432: every frame of a helper connection. The capability is looked up again (the
   * PTY exited ⇒ revoked ⇒ the connection is closed), then an invoke must pass
   * `authorizeHelperInvoke` (channel whitelist + target binding) before any handler runs.
   */
  private async handleHelperFrame(ws: WebSocket, frame: RemoteFrame): Promise<void> {
    const helper = this.helpers.get(ws)
    if (!helper) return
    const capability = this.helperCapabilities?.lookup(helper.capabilityKey) ?? null
    if (!capability) {
      this.log.warn(`[RemoteServer] Helper capability revoked: role=${helper.role} terminal=${helper.terminalId}`)
      this.sendFrame(ws, { type: 'invoke-error', id: frame.id, error: 'Capability revoked' })
      this.dropHelper(ws)
      ws.close()
      return
    }

    if (frame.type === 'ping') {
      this.sendFrame(ws, { type: 'pong', id: frame.id })
      return
    }
    if (frame.type !== 'invoke' || !frame.channel) return

    let args = frame.args || []
    while (args.length > 0 && args[args.length - 1] == null) {
      args = args.slice(0, -1)
    }
    const decision = authorizeHelperInvoke(capability, frame.channel, args, { isTerminalAlive: this.isTerminalAlive })
    if (!decision.ok) {
      this.log.warn(
        `[RemoteServer] Helper invoke denied: channel=${frame.channel} role=${capability.role} ` +
          `terminal=${capability.terminalId} reason=${decision.reason}`
      )
      this.sendFrame(ws, { type: 'invoke-error', id: frame.id, error: `Forbidden: ${decision.reason}` })
      return
    }
    try {
      const result = await invokeHandler(frame.channel, args, null, helper.connectionId)
      this.sendFrame(ws, { type: 'invoke-result', id: frame.id, result })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      this.sendFrame(ws, { type: 'invoke-error', id: frame.id, error: message })
    }
  }

  private sendFrame(ws: WebSocket, frame: RemoteFrame): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(frame))
    }
  }
}
