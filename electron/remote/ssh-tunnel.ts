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

// T0465: OpenSSH's messages when the local end of `-L` cannot be bound, e.g.
// `bind [127.0.0.1]:51234: Address already in use` followed by
// `channel_setup_fwd_listener_tcpip: cannot listen to port: 51234` and
// `Could not request local forwarding.` Fallback signal only (see
// isLocalBindFailure).
const LOCAL_BIND_FAILURE_RE =
  /Address already in use|cannot listen to port|Could not request local forwarding/i

/** Internal: the dynamically picked local port was taken before ssh bound it. */
class LocalPortInUseError extends Error {
  constructor(readonly port: number) {
    super(`local port ${port} already in use`)
    this.name = 'LocalPortInUseError'
  }
}

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
    if (this.options.localPort !== undefined) {
      // Fixed port: no retry — a bind conflict on a user-chosen port would
      // just repeat, so it takes the existing error path (T0465).
      return this.startOnPort(this.options.localPort, false)
    }
    try {
      return await this.startOnPort(await this.pickFreePort(), true)
    } catch (err) {
      if (!(err instanceof LocalPortInUseError)) throw err
      // T0465: pickFreePort() releases the port before `ssh -L` binds it, so
      // another process can take it in between. Pick a fresh port and retry
      // exactly once; a second failure takes the existing error path.
      logger.warn(
        `[SshTunnel] local port ${err.port} was taken before ssh could bind it; retrying once on a new port`,
      )
      this.stopRequested = false
      const retryPort = await this.pickFreePort()
      if (this.stopRequested) {
        throw new Error('ssh tunnel start aborted')
      }
      return this.startOnPort(retryPort, false)
    }
  }

  /**
   * One spawn + readiness attempt on `localPort`. With `retryOnBindFailure`,
   * an ssh exit caused by the local port being taken rejects with
   * `LocalPortInUseError` and does not emit `tunnel-down` (start() retries
   * instead); every other outcome behaves exactly as a non-retry attempt.
   */
  private async startOnPort(
    localPort: number,
    retryOnBindFailure: boolean,
  ): Promise<{ localPort: number }> {
    this.actualLocalPort = localPort

    const spawn = this.deps.spawn ?? (await import('child_process')).spawn
    const args = SshTunnel.buildSpawnArgs(this.options, localPort)
    const proc = spawn('ssh', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      env: { ...process.env, ...buildBaseSshSpawnEnv() },
    })
    this.process = proc

    let starting = true
    let stderrReportsBindFailure = false
    // Set when an unsolicited exit happened during a retry-eligible start; its
    // tunnel-down is held back until we know whether start() will retry.
    let deferredExit: { code: number | null; signal: NodeJS.Signals | null } | null = null

    const stderr = (proc as { stderr?: NodeJS.EventEmitter }).stderr
    stderr?.on('data', (chunk: Buffer | string) => {
      const text = typeof chunk === 'string' ? chunk : chunk.toString('utf8')
      if (LOCAL_BIND_FAILURE_RE.test(text)) stderrReportsBindFailure = true
      const warning = classifyStderr(text)
      if (warning) {
        logger.warn(`[SshTunnel] stderr (${warning.kind}): ${text.trim()}`)
        this.emit('warning', warning)
      }
    })

    proc.on('exit', (code, signal) => {
      const wasStopped = this.stopRequested
      if (this.process === proc) this.process = null
      if (!wasStopped) {
        if (retryOnBindFailure && starting) {
          deferredExit = { code, signal }
          return
        }
        this.emitTunnelDown(code, signal)
      }
    })

    try {
      await this.waitUntilReady(localPort)
      starting = false
      logger.log(
        `[SshTunnel] ready on 127.0.0.1:${localPort} → ${this.options.sshUser}@${this.options.sshHost}:${this.options.remotePort}`,
      )
      return { localPort }
    } catch (err) {
      starting = false
      const abortedByCaller = this.stopRequested
      // start() failed — escalate SIGTERM → SIGKILL via the shared helper so
      // the subprocess doesn't linger (BUG-063) and its eventual exit doesn't
      // fire tunnel-down on the next event loop.
      this.stopRequested = true
      await shutdownSshProcess(proc, { logger }).catch(() => {
        /* helper already swallowed kill races; never throw out of stop path */
      })
      if (this.process === proc) this.process = null
      const exit = deferredExit as { code: number | null; signal: NodeJS.Signals | null } | null
      if (exit) {
        if (
          !abortedByCaller
          && (await this.isLocalBindFailure(localPort, exit.code, stderrReportsBindFailure))
        ) {
          throw new LocalPortInUseError(localPort)
        }
        this.emitTunnelDown(exit.code, exit.signal)
      }
      throw err
    }
  }

  private emitTunnelDown(code: number | null, signal: NodeJS.Signals | null): void {
    logger.warn(
      `[SshTunnel] ssh exited unexpectedly (code=${code}, signal=${signal}); emitting tunnel-down`,
    )
    this.emit('tunnel-down')
  }

  /**
   * T0465: did ssh exit because `localPort` was already bound? Structured
   * signals decide: OpenSSH exits 255 when a forward fails under
   * `ExitOnForwardFailure=yes`, and a probe bind of the port failing with
   * `EADDRINUSE` confirms the conflict. ssh's stderr bind message is only the
   * fallback, for when the other process released the port before the probe.
   */
  private async isLocalBindFailure(
    localPort: number,
    exitCode: number | null,
    stderrReportsBindFailure: boolean,
  ): Promise<boolean> {
    if (exitCode !== 255) return false
    if (await this.isPortInUse(localPort)) return true
    return stderrReportsBindFailure
  }

  private async isPortInUse(port: number): Promise<boolean> {
    const createServer =
      this.deps.createServer ?? (await import('net')).createServer
    return new Promise((resolve) => {
      const srv = createServer()
      srv.once('error', (err: NodeJS.ErrnoException) => {
        try { srv.close() } catch { /* ignore */ }
        resolve(err.code === 'EADDRINUSE')
      })
      srv.listen(port, '127.0.0.1', () => {
        srv.close(() => resolve(false))
      })
    })
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
