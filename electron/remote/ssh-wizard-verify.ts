/**
 * T0387 / BUG-093: SSH setup wizard verification against the REMOTE host.
 *
 * The SSH wizard used to run the shared WSL `fetch-fingerprint` /
 * `connect-test` steps against `localhost:<serverPort>` with no tunnel, so it
 * handshook with this BAT's own RemoteServer and pinned the wrong fingerprint.
 * This module gives the wizard:
 *
 *   - `WizardTunnelRegistry`: short-lived `ssh -L` tunnels (built on the same
 *     `SshTunnel` the RemoteClient uses) keyed by wizard session. The local
 *     end is OS-assigned and never one of the host RemoteServer's ports. Every
 *     tunnel is closed by the wizard (connect-test finally / step rollback),
 *     when the owning renderer is destroyed, or on app quit.
 *   - `readRemoteServerIdentity()`: one ssh exec that reads the remote
 *     bat-server's certificate fingerprint (only the `fingerprint` field — the
 *     private key never leaves the host) and its token, so the wizard can
 *     cross-check the handshake and run connect-test.
 *
 * Every ssh call goes through `buildBaseSshArgs` (identifier validation,
 * BatchMode, ConnectTimeout) and `spawn` with array args; no shell on the
 * local side.
 */
import type { ChildProcess } from 'child_process'
import { logger } from '../logger'
import { SshTunnel, type SshTunnelOptions, type SshTunnelWarning } from './ssh-tunnel'
import {
  buildBaseSshArgs,
  buildBaseSshSpawnEnv,
  escapeSingleQuotesStrict,
  validateSshIdentifier,
} from './ssh-args'
import { shutdownSshProcess } from './ssh-process-lifecycle'

const SESSION_ID_RE = /^[a-zA-Z0-9._-]{1,64}$/
const FINGERPRINT_RE = /^[0-9A-F]{2}(:[0-9A-F]{2}){31}$/

export interface WizardTunnelRequest {
  /** Wizard session id; one tunnel per session. */
  sessionId: string
  sshHost: string
  sshUser: string
  sshPort?: number
  sshKeyPath?: string
  /** bat-server port on the SSH host (the profile's `remotePort`). */
  remotePort: number
}

export type WizardTunnelErrorCode = 'ssh-tunnel-invalid-input' | 'ssh-tunnel-failed'

export type WizardTunnelOpenResult =
  | { ok: true; localPort: number }
  | { ok: false; errorCode: WizardTunnelErrorCode; error: string }

/** Subset of `SshTunnel` the registry relies on (tests inject fakes). */
export interface WizardTunnelHandle {
  start(): Promise<{ localPort: number }>
  stop(): Promise<void>
  isAlive(): boolean
  on(event: 'warning', listener: (warning: SshTunnelWarning) => void): unknown
  on(event: 'tunnel-down', listener: () => void): unknown
}

export interface WizardTunnelRegistryDeps {
  createTunnel?: (options: SshTunnelOptions) => WizardTunnelHandle
  /** Host RemoteServer ports (resolved + running); the local end must avoid them. */
  reservedPorts?: () => number[]
}

interface TunnelEntry {
  key: string
  tunnel: WizardTunnelHandle
  localPort: number
  owner?: number
}

function isPort(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 65535
}

function validateTunnelRequest(request: WizardTunnelRequest): string | null {
  if (!request || typeof request !== 'object') return 'missing tunnel request'
  if (typeof request.sessionId !== 'string' || !SESSION_ID_RE.test(request.sessionId)) {
    return `invalid wizard session id: ${JSON.stringify(request.sessionId)}`
  }
  if (!isPort(request.remotePort)) return `invalid remote port: ${String(request.remotePort)}`
  if (request.sshPort !== undefined && !isPort(request.sshPort)) {
    return `invalid SSH port: ${String(request.sshPort)}`
  }
  try {
    validateSshIdentifier(request.sshHost, 'sshHost')
    validateSshIdentifier(request.sshUser, 'sshUser')
    if (typeof request.sshKeyPath === 'string' && request.sshKeyPath.trim().length > 0) {
      validateSshIdentifier(request.sshKeyPath, 'sshKeyPath')
    }
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }
  return null
}

function describeWarning(warning: SshTunnelWarning | null): string {
  switch (warning?.kind) {
    case 'permission-denied':
      return 'SSH authentication was rejected (Permission denied)'
    case 'host-key-verification':
      return 'SSH host key verification failed'
    case 'connection-refused':
      return 'the SSH host refused the connection'
    default:
      return ''
  }
}

export class WizardTunnelRegistry {
  private readonly entries = new Map<string, TunnelEntry>()
  private readonly createTunnel: (options: SshTunnelOptions) => WizardTunnelHandle
  private readonly reservedPorts: () => number[]

  constructor(deps: WizardTunnelRegistryDeps = {}) {
    this.createTunnel = deps.createTunnel ?? ((options) => new SshTunnel(options))
    this.reservedPorts = deps.reservedPorts ?? (() => [])
  }

  get size(): number {
    return this.entries.size
  }

  /**
   * Open (or reuse) the session's tunnel. Reuses a live tunnel only when the
   * connection target is unchanged; otherwise the old one is stopped first.
   */
  async open(request: WizardTunnelRequest, owner?: number): Promise<WizardTunnelOpenResult> {
    const invalid = validateTunnelRequest(request)
    if (invalid) {
      return { ok: false, errorCode: 'ssh-tunnel-invalid-input', error: `Cannot open SSH tunnel: ${invalid}` }
    }

    const key = JSON.stringify([
      request.sshUser,
      request.sshHost,
      request.sshPort ?? null,
      request.sshKeyPath ?? null,
      request.remotePort,
    ])
    const existing = this.entries.get(request.sessionId)
    if (existing && existing.key === key && existing.tunnel.isAlive()) {
      return { ok: true, localPort: existing.localPort }
    }
    if (existing) await this.close(request.sessionId)

    const target = `${request.sshUser}@${request.sshHost}`
    const tunnel = this.createTunnel({
      sshHost: request.sshHost,
      sshUser: request.sshUser,
      sshPort: request.sshPort,
      sshKeyPath: request.sshKeyPath,
      remotePort: request.remotePort,
      // localPort omitted: OS-assigned free loopback port.
    })
    let lastWarning: SshTunnelWarning | null = null
    tunnel.on('warning', (warning) => {
      lastWarning = warning
    })
    tunnel.on('tunnel-down', () => {
      const entry = this.entries.get(request.sessionId)
      if (entry?.tunnel === tunnel) this.entries.delete(request.sessionId)
    })

    let localPort: number
    try {
      ;({ localPort } = await tunnel.start())
    } catch (error) {
      const reason = describeWarning(lastWarning) || (error instanceof Error ? error.message : String(error))
      logger.warn(`[ssh-wizard-verify] tunnel to ${target} failed: ${reason}`)
      return {
        ok: false,
        errorCode: 'ssh-tunnel-failed',
        error: `Could not open the SSH tunnel to ${target} (remote port ${request.remotePort}): ${reason}`,
      }
    }

    // OS-assigned ports are free by definition; guard anyway so the wizard can
    // never end up talking to this BAT's own RemoteServer again (BUG-093).
    if (this.reservedPorts().includes(localPort)) {
      await tunnel.stop().catch(() => undefined)
      return {
        ok: false,
        errorCode: 'ssh-tunnel-failed',
        error: `SSH tunnel local port ${localPort} collides with this BAT's remote server port; retry to pick another port.`,
      }
    }

    this.entries.set(request.sessionId, { key, tunnel, localPort, owner })
    logger.log(`[ssh-wizard-verify] tunnel ${request.sessionId}: 127.0.0.1:${localPort} → ${target}:${request.remotePort}`)
    return { ok: true, localPort }
  }

  async close(sessionId: string): Promise<void> {
    const entry = this.entries.get(sessionId)
    if (!entry) return
    this.entries.delete(sessionId)
    await entry.tunnel.stop().catch(() => undefined)
    logger.log(`[ssh-wizard-verify] tunnel ${sessionId} closed`)
  }

  async closeOwnedBy(owner: number): Promise<void> {
    const ids = [...this.entries].filter(([, entry]) => entry.owner === owner).map(([id]) => id)
    await Promise.all(ids.map((id) => this.close(id)))
  }

  async closeAll(): Promise<void> {
    await Promise.all([...this.entries.keys()].map((id) => this.close(id)))
  }
}

// ── Remote server identity ────────────────────────────────────────────────

export interface RemoteServerIdentityRequest {
  sshHost: string
  sshUser: string
  sshPort?: number
  sshKeyPath?: string
  targetOS: 'ssh-linux' | 'ssh-darwin'
  /** Absolute remote $HOME from verify-ssh-auth. */
  serverHome: string
}

export type RemoteServerIdentityResult =
  | { ok: true; fingerprint: string | null; token: string | null }
  | { ok: false; error: string }

type SpawnFn = (
  command: string,
  args: readonly string[],
  options?: { stdio?: unknown; windowsHide?: boolean; env?: NodeJS.ProcessEnv },
) => ChildProcess

export interface RemoteIdentityDeps {
  spawn?: SpawnFn
  timeoutMs?: number
}

const IDENTITY_TIMEOUT_MS = 15_000
const MAX_OUTPUT_BYTES = 64 * 1024

/**
 * bat-server's default data dir (`electron/remote/dataDir.ts`) for the units
 * the SSH wizard writes: they set no `BAT_SERVER_DATA_DIR` / `XDG_DATA_HOME`.
 */
export function remoteServerDataDir(targetOS: 'ssh-linux' | 'ssh-darwin', serverHome: string): string {
  if (typeof serverHome !== 'string' || !/^\/[A-Za-z0-9._/-]*$/.test(serverHome) || serverHome.split('/').includes('..')) {
    throw new Error(`serverHome must be an absolute path without special characters: ${JSON.stringify(serverHome)}`)
  }
  const home = serverHome.replace(/\/+$/, '')
  return targetOS === 'ssh-darwin'
    ? `${home}/Library/Application Support/bat-server`
    : `${home}/.local/share/bat-server`
}

/**
 * Remote command: print `BAT_FP=<fingerprint>` (sed extracts only that field
 * from server-cert.json, so the private key is never sent) and
 * `BAT_TOKEN=<server-token.json on one line>`. Missing files print nothing /
 * an empty value; the command itself always exits 0.
 */
export function buildIdentityCommand(dataDir: string): string {
  const dir = escapeSingleQuotesStrict(dataDir, 'dataDir')
  return [
    `sed -n 's/^.*"fingerprint"[[:space:]]*:[[:space:]]*"\\([0-9A-Fa-f:]*\\)".*$/BAT_FP=\\1/p' '${dir}/server-cert.json' 2>/dev/null`,
    "printf 'BAT_TOKEN='",
    `cat '${dir}/server-token.json' 2>/dev/null | tr -d '\\r\\n'`,
    'echo',
  ].join('; ')
}

function decodeTokenJson(raw: string): string | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as { token?: unknown; encrypted?: unknown; data?: unknown }
    if (typeof parsed.token === 'string' && parsed.token) return parsed.token
    if (parsed.encrypted === false && typeof parsed.data === 'string' && parsed.data) return parsed.data
  } catch {
    return null
  }
  return null
}

export function parseIdentityOutput(stdout: string): { fingerprint: string | null; token: string | null } {
  let fingerprint: string | null = null
  let token: string | null = null
  for (const line of stdout.split(/\r?\n/)) {
    if (line.startsWith('BAT_FP=') && fingerprint === null) {
      const candidate = line.slice('BAT_FP='.length).trim().toUpperCase()
      if (FINGERPRINT_RE.test(candidate)) fingerprint = candidate
    } else if (line.startsWith('BAT_TOKEN=') && token === null) {
      token = decodeTokenJson(line.slice('BAT_TOKEN='.length).trim())
    }
  }
  return { fingerprint, token }
}

export async function readRemoteServerIdentity(
  request: RemoteServerIdentityRequest,
  deps: RemoteIdentityDeps = {},
): Promise<RemoteServerIdentityResult> {
  let args: string[]
  try {
    if (request.targetOS !== 'ssh-linux' && request.targetOS !== 'ssh-darwin') {
      throw new Error(`unsupported targetOS: ${String(request.targetOS)}`)
    }
    if (request.sshPort !== undefined && !isPort(request.sshPort)) {
      throw new Error(`invalid SSH port: ${String(request.sshPort)}`)
    }
    const command = buildIdentityCommand(remoteServerDataDir(request.targetOS, request.serverHome))
    args = [...buildBaseSshArgs(request), command]
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }

  const spawn = deps.spawn ?? (await import('child_process')).spawn
  const timeoutMs = deps.timeoutMs ?? IDENTITY_TIMEOUT_MS

  let proc: ChildProcess
  try {
    proc = spawn('ssh', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      env: { ...process.env, ...buildBaseSshSpawnEnv() },
    })
  } catch (error) {
    return { ok: false, error: `ssh spawn failed: ${error instanceof Error ? error.message : String(error)}` }
  }

  let stdout = ''
  let stderr = ''
  proc.stdout?.on('data', (chunk: Buffer | string) => {
    if (stdout.length < MAX_OUTPUT_BYTES) stdout += typeof chunk === 'string' ? chunk : chunk.toString('utf8')
  })
  proc.stderr?.on('data', (chunk: Buffer | string) => {
    if (stderr.length < MAX_OUTPUT_BYTES) stderr += typeof chunk === 'string' ? chunk : chunk.toString('utf8')
  })

  const outcome = await new Promise<{ code: number | null; timedOut: boolean; spawnError?: Error }>((resolve) => {
    let settled = false
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      void shutdownSshProcess(proc).catch(() => undefined)
      resolve({ code: null, timedOut: true })
    }, timeoutMs)
    proc.on('error', (error: Error) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve({ code: null, timedOut: false, spawnError: error })
    })
    proc.on('exit', (code) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve({ code: code ?? 1, timedOut: false })
    })
  })

  if (outcome.spawnError) return { ok: false, error: `ssh spawn failed: ${outcome.spawnError.message}` }
  if (outcome.timedOut) return { ok: false, error: `reading the remote bat-server identity timed out after ${timeoutMs}ms` }
  if (outcome.code !== 0) {
    return { ok: false, error: `ssh exited with code ${outcome.code}: ${stderr.trim() || stdout.trim() || 'no output'}` }
  }
  return { ok: true, ...parseIdentityOutput(stdout) }
}
