import { EventEmitter } from 'events'
import type { ChildProcess } from 'child_process'
import type { Server, Socket } from 'net'
import { logger } from '../logger'
import { buildBaseSshArgs, buildBaseSshSpawnEnv } from './ssh-args'
import { shutdownSshProcess } from './ssh-process-lifecycle'

export interface SshTunnelOptions {
  sshHost: string
  sshUser: string
  sshPort?: number       // default 22; only emitted as -p when not 22
  sshKeyPath?: string    // when undefined, OpenSSH default key search applies
  remotePort: number     // BAT server bind port on the SSH host
  localPort?: number     // when undefined, an OS-assigned free port is picked
}

type SpawnFn = (
  command: string,
  args: readonly string[],
  options?: { stdio?: unknown; windowsHide?: boolean; env?: NodeJS.ProcessEnv },
) => ChildProcess

type CreateServerFn = () => Server
type CreateConnectionFn = (opts: { host: string; port: number }) => Socket

/**
 * Test/integration injection point. Production code uses dynamic imports of
 * `child_process` / `net`; tests pass mocks here so no real ssh subprocess
 * or arbitrary outbound TCP is created (T0284 守則 #8).
 */
export interface SshTunnelDeps {
  spawn?: SpawnFn
  createServer?: CreateServerFn
  createConnection?: CreateConnectionFn
  readyTimeoutMs?: number
  pollIntervalMs?: number
}

const DEFAULT_READY_TIMEOUT_MS = 10_000
const DEFAULT_POLL_INTERVAL_MS = 200

export type SshTunnelWarningKind =
  | 'permission-denied'
  | 'connection-refused'
  | 'host-key-verification'
  | 'unknown'

export interface SshTunnelWarning {
  kind: SshTunnelWarningKind
  text: string
}

/**
 * Long-lived SSH local-forward tunnel built on the system `ssh` CLI.
 *
 * Spec source: T0266 §5 (spawn args + polling) and §8 (reconnect chain).
 * The exact arg layout is frozen and asserted in tests/ssh-tunnel.test.ts.
 *
 * Lifecycle: caller invokes `start()` → process is spawned and we poll
 * `127.0.0.1:<localPort>` until the forward accepts a TCP connection.
 * `stop()` is the only path that suppresses the `tunnel-down` event; any
 * other exit (network drop, host key change, ssh server shutdown) emits it
 * so RemoteClient can rebuild the tunnel before retrying wss.
 */
export class SshTunnel extends EventEmitter {
  private process: ChildProcess | null = null
  private actualLocalPort = 0
  private stopRequested = false
  private readonly readyTimeoutMs: number
  private readonly pollIntervalMs: number

  constructor(
    private readonly options: SshTunnelOptions,
    private readonly deps: SshTunnelDeps = {},
  ) {
    super()
    this.readyTimeoutMs = deps.readyTimeoutMs ?? DEFAULT_READY_TIMEOUT_MS
    this.pollIntervalMs = deps.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS
  }

  /**
   * Pure helper: build the exact ssh argv vector. Exposed for test4 so the
   * frozen spec can be asserted token-by-token without spawning anything.
   */
  static buildSpawnArgs(opts: SshTunnelOptions, localPort: number): string[] {
    // Tunnel-specific opts are spliced before `--` by buildBaseSshArgs so the
    // shared BatchMode/ConnectTimeout/StrictHostKeyChecking prefix (EC-003) +
    // user@host validation (F-004) apply uniformly across all 4 ssh sites.
    return buildBaseSshArgs(opts, [
      '-N',
      '-L', `${localPort}:localhost:${opts.remotePort}`,
      '-o', 'ServerAliveInterval=30',
      '-o', 'ServerAliveCountMax=3',
      '-o', 'ExitOnForwardFailure=yes',
      '-o', 'StreamLocalBindUnlink=yes',
    ])
  }

  get localPort(): number {
    return this.actualLocalPort
  }

  isAlive(): boolean {
    return this.process !== null && this.process.exitCode === null
  }

  async start(): Promise<{ localPort: number }> {
    if (this.isAlive()) {
      return { localPort: this.actualLocalPort }
    }
    this.stopRequested = false
    const localPort = this.options.localPort ?? (await this.pickFreePort())
    this.actualLocalPort = localPort

    const spawn = this.deps.spawn ?? (await import('child_process')).spawn
    const args = SshTunnel.buildSpawnArgs(this.options, localPort)
    const proc = spawn('ssh', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      env: { ...process.env, ...buildBaseSshSpawnEnv() },
    })
    this.process = proc

    const stderr = (proc as { stderr?: NodeJS.EventEmitter }).stderr
    stderr?.on('data', (chunk: Buffer | string) => {
      const text = typeof chunk === 'string' ? chunk : chunk.toString('utf8')
      const warning = classifyStderr(text)
      if (warning) {
        logger.warn(`[SshTunnel] stderr (${warning.kind}): ${text.trim()}`)
        this.emit('warning', warning)
      }
    })

    proc.on('exit', (code, signal) => {
      const wasStopped = this.stopRequested
      this.process = null
      if (!wasStopped) {
        logger.warn(
          `[SshTunnel] ssh exited unexpectedly (code=${code}, signal=${signal}); emitting tunnel-down`,
        )
        this.emit('tunnel-down')
      }
    })

    try {
      await this.waitUntilReady(localPort)
      logger.log(
        `[SshTunnel] ready on 127.0.0.1:${localPort} → ${this.options.sshUser}@${this.options.sshHost}:${this.options.remotePort}`,
      )
      return { localPort }
    } catch (err) {
      // start() failed — escalate SIGTERM → SIGKILL via the shared helper so
      // the subprocess doesn't linger (BUG-063) and its eventual exit doesn't
      // fire tunnel-down on the next event loop.
      this.stopRequested = true
      await shutdownSshProcess(proc, { logger }).catch(() => {
        /* helper already swallowed kill races; never throw out of stop path */
      })
      this.process = null
      throw err
    }
  }

  async stop(): Promise<void> {
    this.stopRequested = true
    const proc = this.process
    this.process = null
    if (proc) {
      // Await the shutdown so RemoteClient.disconnect() (BUG-067 fix) can
      // observe the ssh subprocess actually exited before resolving.
      await shutdownSshProcess(proc, { logger }).catch(() => {
        /* helper already handles internal kill races */
      })
    }
  }

  private async pickFreePort(): Promise<number> {
    const createServer =
      this.deps.createServer ?? (await import('net')).createServer
    return new Promise((resolve, reject) => {
      const srv = createServer()
      const fail = (err: Error) => {
        try { srv.close() } catch { /* ignore */ }
        reject(err)
      }
      srv.once('error', fail)
      srv.listen(0, '127.0.0.1', () => {
        const addr = srv.address()
        if (addr && typeof addr === 'object' && typeof addr.port === 'number') {
          const port = addr.port
          srv.close(() => resolve(port))
        } else {
          fail(new Error('failed to resolve OS-assigned local port'))
        }
      })
    })
  }

  private async waitUntilReady(port: number): Promise<void> {
    const createConnection =
      this.deps.createConnection ?? (await import('net')).createConnection
    const startedAt = Date.now()
    while (Date.now() - startedAt < this.readyTimeoutMs) {
      if (this.stopRequested) {
        throw new Error('ssh tunnel start aborted')
      }
      if (!this.process) {
        throw new Error('ssh process exited before tunnel became ready')
      }
      const ok = await tryConnect(createConnection, port)
      if (ok) return
      await sleep(this.pollIntervalMs)
    }
    throw new Error(
      `ssh tunnel readiness timeout after ${this.readyTimeoutMs}ms (127.0.0.1:${port})`,
    )
  }
}

function tryConnect(
  createConnection: CreateConnectionFn,
  port: number,
): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false
    const settle = (v: boolean) => {
      if (settled) return
      settled = true
      try { sock.destroy() } catch { /* ignore */ }
      resolve(v)
    }
    const sock = createConnection({ host: '127.0.0.1', port })
    sock.once('connect', () => settle(true))
    sock.once('error', () => settle(false))
  })
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

function classifyStderr(text: string): SshTunnelWarning | null {
  if (text.includes('Permission denied')) {
    return { kind: 'permission-denied', text }
  }
  if (text.includes('Connection refused')) {
    return { kind: 'connection-refused', text }
  }
  if (text.includes('Host key verification failed')) {
    return { kind: 'host-key-verification', text }
  }
  return null
}
