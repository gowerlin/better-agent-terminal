import { createHash, randomBytes } from 'crypto'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import type { HandlerModule, HandlerRegistrar, HostDeps } from '../handlers/types'
import { broadcastHub } from './broadcast-hub'
import {
  FileCertificateProvider,
  type CertificateProvider,
} from './certificate'
import { registerHandler, type HandlerContext as RemoteHandlerContext } from './handler-registry'
import {
  RemoteServer,
  type BindInterface,
} from './remote-server'
import {
  detectSecretStrategy,
  readSecretFile,
  setSecretStrategy,
  type SecretStrategy,
  writeSecretFile,
} from './secrets'
import { acquireLock, releaseLock } from './lockfile'
import {
  createHeadlessDefaultHandlers,
  readHeadlessSettings,
  type HeadlessHandlerRegistration,
} from './headless-handlers'

export type { HeadlessHandlerRegistration }

/**
 * PLAN-036 / D129 (T0388): shared domain modules (`electron/handlers/*.ts`)
 * headless bat-server registers — the same modules Electron main registers
 * with its own deps. Empty until T0390 (`pty:*`). A module going online here
 * must delete its channels from `HEADLESS_UNSUPPORTED`
 * (headless-channel-status.ts) in the same commit, or the parity test fails.
 */
export const HEADLESS_HANDLER_MODULES: readonly HandlerModule[] = []

/**
 * Headless side of `HostDeps`: events go to connected remote clients only
 * (broadcastHub → RemoteServer → PROXIED_EVENTS filter); no helper dir, no
 * desktop notifier, no settings side effects, no fs path guard yet (fs
 * handlers fail closed until `workspace:sync-roots`, T0386 §4).
 */
export function createHeadlessHostDeps(dataDir: string): HostDeps {
  return {
    emit: (channel, ...args) => broadcastHub.broadcast(channel, ...args),
    dataDir,
    homeDir: os.homedir(),
    getSettings: () => readHeadlessSettings(dataDir),
  }
}

export interface HeadlessServerOptions {
  dataDir: string
  port: number
  token?: string
  bindInterface?: BindInterface
  secretStrategy?: SecretStrategy
  certificateProvider?: CertificateProvider
  handlers?: HeadlessHandlerRegistration[]
  logger?: {
    log: (...args: unknown[]) => void
    warn: (...args: unknown[]) => void
    error: (...args: unknown[]) => void
  }
}

export interface HeadlessServerInfo {
  port: number
  bindAddress: string
  fingerprint: string
  tokenHash: string
  startTime: number
  pid: number
  bundleVersion: string
}

export interface HeadlessServer {
  start(): Promise<{ port: number; fingerprint: string; bindAddress: string }>
  stop(): Promise<void>
  rotateToken(opts?: { gracePeriodMs?: number }): Promise<{ token: string; oldToken: string; oldValidUntil: number }>
  renewCertificate(): Promise<{ fingerprint: string; expiresAt: number }>
  getInfo(): HeadlessServerInfo
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex').slice(0, 8)
}

function resolveBundleVersion(): string {
  try {
    const pkgPath = path.resolve(__dirname, '..', '..', 'package.json')
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as { version?: string }
    return pkg.version || '0.0.0'
  } catch {
    return '0.0.0'
  }
}

export function getHeadlessBundleVersion(): string {
  return resolveBundleVersion()
}

export async function loadOrGenerateToken(dataDir: string): Promise<string> {
  const tokenPath = path.join(dataDir, 'server-token.json')
  const persisted = readSecretFile(tokenPath)
  if (persisted) return persisted

  const token = randomBytes(32).toString('base64url')
  writeSecretFile(tokenPath, token)
  return token
}

export async function createHeadlessServer(opts: HeadlessServerOptions): Promise<HeadlessServer> {
  fs.mkdirSync(opts.dataDir, { recursive: true })
  const strategy = opts.secretStrategy ?? detectSecretStrategy()
  setSecretStrategy(strategy)

  let resolvedToken = opts.token ?? (await loadOrGenerateToken(opts.dataDir))
  const certificateProvider =
    opts.certificateProvider ?? new FileCertificateProvider(opts.dataDir)
  const remoteServer = new RemoteServer({
    certificateProvider,
    logger: opts.logger,
  })
  remoteServer.configDir = opts.dataDir

  // T0385: built-ins first so caller-supplied handlers can override them.
  // T0388: shared domain modules sit between the two.
  const register: HandlerRegistrar = registerHandler
  for (const registration of createHeadlessDefaultHandlers({ dataDir: opts.dataDir })) {
    register(registration.channel, registration.handler)
  }
  const hostDeps = createHeadlessHostDeps(opts.dataDir)
  for (const registerModule of HEADLESS_HANDLER_MODULES) {
    registerModule(register, hostDeps)
  }
  for (const registration of opts.handlers ?? []) {
    register(registration.channel, registration.handler)
  }

  let lockHeld = false
  let info: HeadlessServerInfo = {
    port: opts.port,
    bindAddress: '127.0.0.1',
    fingerprint: '',
    tokenHash: hashToken(resolvedToken),
    startTime: 0,
    pid: process.pid,
    bundleVersion: resolveBundleVersion(),
  }

  return {
    async start() {
      if (!lockHeld) {
        acquireLock(opts.dataDir)
        lockHeld = true
      }

      try {
        const started = await remoteServer.start(
          opts.port,
          resolvedToken,
          opts.bindInterface ?? 'localhost'
        )
        info = {
          ...info,
          port: started.port,
          bindAddress: started.host,
          fingerprint: started.fingerprint,
          startTime: Date.now(),
        }
        return {
          port: started.port,
          fingerprint: started.fingerprint,
          bindAddress: started.host,
        }
      } catch (error) {
        if (lockHeld) {
          releaseLock(opts.dataDir)
          lockHeld = false
        }
        throw error
      }
    },

    async stop() {
      try {
        remoteServer.stop()
      } finally {
        if (lockHeld) {
          releaseLock(opts.dataDir)
          lockHeld = false
        }
      }
    },

    async rotateToken(rotationOpts) {
      const rotated = await remoteServer.rotateToken(rotationOpts)
      resolvedToken = rotated.token
      info = {
        ...info,
        tokenHash: hashToken(rotated.token),
      }
      return rotated
    },

    async renewCertificate() {
      const renewed = await remoteServer.renewCertificate()
      info = {
        ...info,
        fingerprint: renewed.fingerprint,
      }
      return renewed
    },

    getInfo() {
      return {
        ...info,
        port: remoteServer.port ?? info.port,
        bindAddress: remoteServer.host || info.bindAddress,
        fingerprint: remoteServer.currentFingerprint || info.fingerprint,
      }
    }
  }
}
