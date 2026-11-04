import * as crypto from 'crypto'
import * as fs from 'fs'
import * as net from 'net'
import { RingBuffer } from './ring-buffer'
import { writePortFile, removePortFile, removePidFile, writeTokenFile, removeTokenFile } from './pid-manager'
import { addPtyEntry, removePtyEntry, clearRegistry, writeRegistry } from './pty-registry'
import { defaultKillTreeDeps, killProcessTree, type KillTreeDeps } from './process-tree'
import {
  MAX_IDLE_EXTENSION_MS,
  TERMINAL_SERVER_PROTOCOL_MAX,
  TERMINAL_SERVER_PROTOCOL_MIN,
  negotiateProtocol,
  type ServerErrorCode,
  type ServerRequest,
  type ServerResponse,
} from './protocol'
import { guardPtySpawnFds, type PtyFdGuardDeps } from '../pty-spawn-fd-guard'

// Load @lydell/node-pty at runtime — same pattern as pty-manager.ts
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pty: any = null
let ptyAvailable = false
try {
  pty = require('@lydell/node-pty')
  if (pty && typeof pty.spawn === 'function') {
    ptyAvailable = true
  }
} catch {
  // node-pty not available in this environment
}

interface PtyEntry {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pty: any // IPty
  buffer: RingBuffer
  cwd: string
  pid: number
}

const DEFAULT_IDLE_TIMEOUT_MS = 30 * 60 * 1000 // 30 minutes (D031 default)
const DEFAULT_BUFFER_LINES = 1000               // D031 default

/**
 * T0705: the server's own settings, set by main.ts when it forks the server and read by
 * terminal-server.ts. They are not for the shells, so they are left out of every PTY's env.
 * `BAT_USER_DATA` (also set by the fork) stays: helper scripts in the tab read it.
 */
export const TERMINAL_SERVER_OWN_ENV_KEYS = ['BAT_IDLE_TIMEOUT_MS', 'BAT_SCROLL_BUFFER_LINES', 'BAT_TERMINAL_SERVER_BAT_VERSION'] as const

/**
 * T0857: a TCP connection that has not said a valid `server:hello` within this time is closed.
 * Clients send the hello in their first write, so this only ends connections that never will.
 */
export const SERVER_HELLO_TIMEOUT_MS = 10_000
/** T0857: an unauthenticated connection may send at most this much before its first newline. */
export const UNAUTHENTICATED_MAX_BUFFER = 64 * 1024

/**
 * The env a PTY starts with: the server's env without its own settings, then the env the
 * host sent (`PtyManager.buildPtyEnv`, wins over the server's), then the terminal defaults.
 */
export function buildServerPtyEnv(
  serverEnv: NodeJS.ProcessEnv,
  hostEnv: Record<string, string> | undefined,
): Record<string, string> {
  const inherited: Record<string, string | undefined> = { ...serverEnv }
  for (const key of TERMINAL_SERVER_OWN_ENV_KEYS) delete inherited[key]
  const ptyEnv: Record<string, string | undefined> = {
    ...inherited,
    ...(hostEnv ?? {}),
    TERM: 'xterm-256color',
    COLORTERM: 'truecolor',
    TERM_PROGRAM: 'better-agent-terminal',
    BAT_SESSION: '1',
    FORCE_COLOR: '3',
    CI: '',
  }
  // BUG-038: strip ELECTRON_RUN_AS_NODE so PTY children (npm run dev, npx electron .) don't
  // inherit Node-only mode from the Claude SDK fallback (claude-agent-manager.ts:511,1233).
  delete ptyEnv.ELECTRON_RUN_AS_NODE
  return ptyEnv as Record<string, string>
}

/** T0857 (D8): a new random TCP token (256 bits) for one server life. */
export function generateServerToken(): string {
  return crypto.randomBytes(32).toString('base64url')
}

/** Constant-time comparison of a presented token with the server's. */
export function tokensMatch(presented: unknown, expected: string): boolean {
  if (typeof presented !== 'string' || !expected) return false
  const a = Buffer.from(presented, 'utf8')
  const b = Buffer.from(expected, 'utf8')
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

/** T0540: injectable for tests (taskkill, platform, process exit). */
export interface TerminalServerDeps extends KillTreeDeps {
  exit: (code: number) => void
  /** BUG-205 / T0806: Linux PTY children keep only fd 0–2 (electron/pty-spawn-fd-guard.ts). */
  fdGuard: PtyFdGuardDeps
  /** T0857: what `server:hello-ok` reports (terminal-server.ts reads it from the fork env). */
  identity: { batVersion: string; holderDir?: string }
  /** T0857: the TCP token of this server's life (tests pass a fixed one). */
  generateToken: () => string
}

/** T0857: a TCP connection before / after its hello. */
interface TcpConnectionState {
  /** `client` = authenticated (gets broadcasts, keeps the server from idling); `shutdown-only` = right token, no common protocol */
  stage: 'pending' | 'client' | 'shutdown-only'
  helloTimer: ReturnType<typeof setTimeout> | null
}

/**
 * Core Terminal Server logic. Manages PTY instances, routes IPC/TCP messages,
 * and handles idle-timeout shutdown after all clients disconnect.
 *
 * Supports two transport channels (T0108):
 *   1. fork IPC — used by the initial BAT process
 *   2. TCP localhost — used when BAT restarts and reconnects
 *
 * PTY data/exit events are broadcast to ALL connected clients.
 * Other responses are sent back to the requesting client only.
 */
export class TerminalServer {
  private readonly ptys: Map<string, PtyEntry> = new Map()
  private idleTimer: ReturnType<typeof setTimeout> | null = null
  private readonly idleTimeoutMs: number
  private readonly bufferLines: number

  // TCP transport (T0108)
  private tcpServer: net.Server | null = null
  private readonly tcpClients: Set<net.Socket> = new Set()
  private _userDataPath = ''
  private shuttingDown = false
  private readonly deps: TerminalServerDeps
  // T0857: TCP authentication; '' until startTcpServer (no TCP listener, nothing to authenticate)
  private token = ''
  private readonly tcpStates: Map<net.Socket, TcpConnectionState> = new Map()
  // T0857 (D7): the one pending `server:extendIdle`; cleared when a client says hello again
  private idleExtensionMs: number | null = null

  constructor(
    idleTimeoutMs = DEFAULT_IDLE_TIMEOUT_MS,
    bufferLines = DEFAULT_BUFFER_LINES,
    deps: Partial<TerminalServerDeps> = {},
  ) {
    this.idleTimeoutMs = idleTimeoutMs
    this.bufferLines = bufferLines
    this.deps = {
      platform: deps.platform ?? defaultKillTreeDeps.platform,
      execFile: deps.execFile ?? defaultKillTreeDeps.execFile,
      exit: deps.exit ?? ((code) => process.exit(code)),
      fdGuard: deps.fdGuard ?? { platform: process.platform, fileExists: (p) => fs.existsSync(p) },
      identity: deps.identity ?? { batVersion: '' },
      generateToken: deps.generateToken ?? generateServerToken,
    }
  }

  // ── Transport layer ─────────────────────────────────────────────────────────

  /** Send a response back to the specific client that made the request. */
  private sendToClient(msg: ServerResponse, via: 'ipc' | 'tcp', socket?: net.Socket): void {
    if (via === 'tcp' && socket && !socket.destroyed) {
      socket.write(JSON.stringify(msg) + '\n')
    } else if (via === 'ipc' && process.send) {
      process.send(msg)
    }
  }

  /** Broadcast to ALL connected clients: fork IPC parent + every TCP client. */
  private broadcastToAll(msg: ServerResponse): void {
    if (process.connected && process.send) {
      process.send(msg)
    }
    for (const client of this.tcpClients) {
      if (!client.destroyed) {
        client.write(JSON.stringify(msg) + '\n')
      }
    }
  }

  // ── TCP server (T0108) ───────────────────────────────────────────────────────

  /**
   * Start a TCP server on a random localhost port and write the port to a file
   * so BAT can reconnect after restarting.
   */
  startTcpServer(userDataPath: string): void {
    this._userDataPath = userDataPath

    // T0113: Initialize PTY registry with server PID
    writeRegistry({ serverPid: process.pid, ptys: [], updatedAt: new Date().toISOString() }, userDataPath)

    // T0857 (D8): the token of this server's life, on disk before the port file says where we listen
    this.token = this.deps.generateToken()
    if (userDataPath) {
      try {
        writeTokenFile(this.token, userDataPath)
      } catch {
        process.stderr.write('[terminal-server] failed to write the token file — TCP clients cannot authenticate\n')
      }
    }

    this.tcpServer = net.createServer((socket) => this.acceptTcpConnection(socket))

    this.tcpServer.listen(0, '127.0.0.1', () => {
      const port = (this.tcpServer!.address() as net.AddressInfo).port
      if (userDataPath) {
        writePortFile(port, userDataPath)
      }
    })
  }

  /**
   * T0857: a new TCP connection is `pending` — no broadcasts, does not reset the idle countdown —
   * until its first request, a `server:hello` with this server's token. Anything else first →
   * `error` (UNAUTHENTICATED) and the socket closes. Before T0857 every connection was a client.
   */
  private acceptTcpConnection(socket: net.Socket): void {
    const state: TcpConnectionState = {
      stage: 'pending',
      helloTimer: setTimeout(() => {
        if (state.stage !== 'client') socket.destroy()
      }, SERVER_HELLO_TIMEOUT_MS),
    }
    this.tcpStates.set(socket, state)

    let lineBuffer = ''
    socket.on('data', (chunk) => {
      lineBuffer += chunk.toString()
      // JSON-line protocol: one JSON object per newline
      const lines = lineBuffer.split('\n')
      lineBuffer = lines.pop()!  // Keep incomplete trailing fragment
      for (const line of lines) {
        // a refused connection runs none of the lines that came with its first request
        if (socket.destroyed || !this.tcpStates.has(socket) || this.shuttingDown) return
        if (!line.trim()) continue
        let msg: unknown
        try {
          msg = JSON.parse(line)
        } catch {
          // Malformed JSON: ignored from a client (as before); from a pending connection it ends it
          if (state.stage === 'client') continue
          msg = null
        }
        this.handleTcpLine(msg, socket, state)
      }
      if (state.stage !== 'client' && lineBuffer.length > UNAUTHENTICATED_MAX_BUFFER) socket.destroy()
    })

    socket.on('close', () => {
      this.forgetTcpConnection(socket)
      // Start idle timer only if there are no remaining connections
      if (this.shouldStartIdle()) {
        this.startIdleTimer()
      }
    })

    socket.on('error', () => {
      this.forgetTcpConnection(socket)
    })
  }

  private forgetTcpConnection(socket: net.Socket): void {
    const state = this.tcpStates.get(socket)
    if (state?.helloTimer) clearTimeout(state.helloTimer)
    this.tcpStates.delete(socket)
    this.tcpClients.delete(socket)
  }

  private handleTcpLine(msg: unknown, socket: net.Socket, state: TcpConnectionState): void {
    const request = isRequestObject(msg) ? msg : null
    if (state.stage === 'client') {
      if (request) this.handleMessage(request as ServerRequest, 'tcp', socket)
      else this.sendToClient(errorResponse('unknown', 'BAD_REQUEST', 'request is not a JSON object'), 'tcp', socket)
      return
    }
    const requestType = typeof request?.type === 'string' ? request.type : 'unknown'
    if (state.stage === 'shutdown-only') {
      // no common protocol: the one request every version understands
      if (requestType === 'server:shutdown') {
        this.shutdown()
        return
      }
      if (requestType === 'server:ping') {
        this.sendToClient({ type: 'server:pong' }, 'tcp', socket)
        return
      }
      this.rejectAndClose(socket, errorResponse(requestType, 'NOT_ALLOWED', 'no common protocol: only server:shutdown / server:ping are accepted'))
      return
    }
    // pending: the first request must be a hello with the right token
    if (requestType !== 'server:hello' || !tokensMatch(request?.token, this.token)) {
      this.rejectAndClose(socket, errorResponse(requestType, 'UNAUTHENTICATED', 'server:hello with a valid token required'))
      return
    }
    const protocol = negotiateProtocol(
      { min: TERMINAL_SERVER_PROTOCOL_MIN, max: TERMINAL_SERVER_PROTOCOL_MAX },
      { min: request?.protocolMin, max: request?.protocolMax },
    )
    if (protocol === null) {
      state.stage = 'shutdown-only'
      this.sendToClient(this.noCommonProtocol(), 'tcp', socket)
      return
    }
    state.stage = 'client'
    if (state.helloTimer) {
      clearTimeout(state.helloTimer)
      state.helloTimer = null
    }
    this.tcpClients.add(socket)
    this.resetIdleTimer()  // New client resets idle countdown
    // D7: a client is back — the idle timeout is the configured one again
    this.idleExtensionMs = null
    this.sendToClient(this.helloOk(protocol), 'tcp', socket)
  }

  /** T0857: answer, then close once the answer is written (no further line of that write runs). */
  private rejectAndClose(socket: net.Socket, msg: ServerResponse): void {
    this.forgetTcpConnection(socket)
    if (socket.destroyed) return
    socket.end(JSON.stringify(msg) + '\n')
    // end() half-closes; never keep a refused socket around waiting for the peer
    const timer = setTimeout(() => socket.destroy(), 1000)
    timer.unref?.()
  }

  private helloOk(protocol: number): ServerResponse {
    const { batVersion, holderDir } = this.deps.identity
    return {
      type: 'server:hello-ok',
      protocol,
      batVersion,
      runtime: { name: process.versions.electron ? 'electron' : 'node', version: process.version },
      ...(holderDir ? { holderDir } : {}),
      pid: process.pid,
    }
  }

  private noCommonProtocol(): ServerResponse {
    return {
      ...errorResponse('server:hello', 'NO_COMMON_PROTOCOL', 'no common protocol version'),
      protocolMin: TERMINAL_SERVER_PROTOCOL_MIN,
      protocolMax: TERMINAL_SERVER_PROTOCOL_MAX,
    }
  }

  /** True when there are no active connections (IPC parent gone + no TCP clients). */
  private shouldStartIdle(): boolean {
    return !process.connected && this.tcpClients.size === 0
  }

  // ── Message dispatch ─────────────────────────────────────────────────────────

  /** Dispatch an incoming message to the appropriate handler. */
  handleMessage(msg: ServerRequest, via: 'ipc' | 'tcp' = 'ipc', socket?: net.Socket): void {
    // T0540: shutdown waits for the process trees to end; nothing new starts meanwhile.
    if (this.shuttingDown) return
    if (!isRequestObject(msg)) {
      this.sendToClient(errorResponse('unknown', 'BAD_REQUEST', 'request is not a JSON object'), via, socket)
      return
    }
    this.resetIdleTimer()

    switch (msg.type) {
      case 'pty:create':    this.createPty(msg, via, socket); break
      case 'pty:write':     this.writePty(msg); break
      case 'pty:resize':    this.resizePty(msg); break
      case 'pty:kill':      this.killPty(msg); break
      case 'pty:list':      this.listPtys(via, socket); break
      case 'pty:getBuffer': this.getBuffer(msg, via, socket); break
      case 'server:ping':
        this.sendToClient({ type: 'server:pong' }, via, socket); break
      case 'server:getConfig':
        this.sendToClient(
          { type: 'server:config', scrollBufferLines: this.bufferLines, idleTimeoutMs: this.idleTimeoutMs },
          via, socket,
        ); break
      case 'server:shutdown':
        this.shutdown()
        break
      // T0857: the fork IPC parent may say hello too (no token: it forked us); a TCP client
      // reaching here already did, so a repeated hello only reports the protocol again
      case 'server:hello': {
        const protocol = negotiateProtocol(
          { min: TERMINAL_SERVER_PROTOCOL_MIN, max: TERMINAL_SERVER_PROTOCOL_MAX },
          { min: msg.protocolMin, max: msg.protocolMax },
        )
        this.sendToClient(protocol === null ? this.noCommonProtocol() : this.helloOk(protocol), via, socket)
        break
      }
      case 'server:extendIdle':
        this.extendIdle(msg, via, socket)
        break
      default: {
        // T0857: before v1 an unknown request got no answer at all
        const type = (msg as { type?: unknown }).type
        this.sendToClient(errorResponse(typeof type === 'string' ? type : 'unknown', 'UNKNOWN_REQUEST', 'unknown request'), via, socket)
      }
    }
  }

  /**
   * T0857 (D7, for W4's installer quit): the next idle countdown uses `durationMs` instead of the
   * configured timeout — at least the configured one, at most MAX_IDLE_EXTENSION_MS (24 h). One
   * extension at a time (a second → ALREADY_EXTENDED); a client that says hello again restores
   * the configured timeout. `idleTimeoutMs` 0 (never idle out) stays 0.
   */
  private extendIdle(req: Extract<ServerRequest, { type: 'server:extendIdle' }>, via: 'ipc' | 'tcp', socket?: net.Socket): void {
    if (typeof req.durationMs !== 'number' || !Number.isFinite(req.durationMs) || req.durationMs <= 0) {
      this.sendToClient(errorResponse('server:extendIdle', 'BAD_REQUEST', 'durationMs must be a positive number'), via, socket)
      return
    }
    if (this.idleTimeoutMs === 0) {
      this.sendToClient({ type: 'server:idle-extended', idleTimeoutMs: 0, configuredIdleTimeoutMs: 0 }, via, socket)
      return
    }
    if (this.idleExtensionMs !== null) {
      this.sendToClient(errorResponse('server:extendIdle', 'ALREADY_EXTENDED', 'the idle timeout is already extended'), via, socket)
      return
    }
    this.idleExtensionMs = Math.min(Math.max(Math.round(req.durationMs), this.idleTimeoutMs), MAX_IDLE_EXTENSION_MS)
    this.sendToClient(
      { type: 'server:idle-extended', idleTimeoutMs: this.idleExtensionMs, configuredIdleTimeoutMs: this.idleTimeoutMs },
      via, socket,
    )
  }

  /** T0857: the timeout the next idle countdown uses. */
  get effectiveIdleTimeoutMs(): number {
    return this.idleExtensionMs ?? this.idleTimeoutMs
  }

  // ── PTY handlers ─────────────────────────────────────────────────────────────

  private createPty(
    req: Extract<ServerRequest, { type: 'pty:create' }>,
    via: 'ipc' | 'tcp',
    socket?: net.Socket,
  ): void {
    if (!ptyAvailable || !pty) {
      this.sendToClient({ type: 'error', requestType: 'pty:create', message: 'node-pty not available' }, via, socket)
      return
    }

    // T0111: Idempotent create — if PTY already exists (e.g. View→Reload), keep it alive.
    // initTerminals re-sends pty:create with the same IDs after renderer reload;
    // overwriting would destroy the running session and empty the ring buffer.
    const existing = this.ptys.get(req.id)
    if (existing) {
      this.sendToClient({ type: 'pty:created', id: req.id, pid: existing.pid }, via, socket)
      return
    }

    try {
      const ptyEnv = buildServerPtyEnv(process.env, req.env)

      // BUG-205 / T0806: on Linux the shell starts through the fd guard (pid / argv / env unchanged);
      // elsewhere `spawn` gets exactly what it got before.
      const guard = guardPtySpawnFds({ file: req.shell, args: req.args, env: ptyEnv }, this.deps.fdGuard)
      const ptyProcess = pty.spawn(guard.command.file, guard.command.args, {
        name: 'xterm-256color',
        cols: req.cols,
        rows: req.rows,
        cwd: req.cwd,
        env: guard.command.env,
      })

      const buffer = new RingBuffer(this.bufferLines)

      ptyProcess.onData((data: string) => {
        buffer.push(data)
        // Broadcast PTY output to all connected clients
        this.broadcastToAll({ type: 'pty:data', id: req.id, data })
      })

      ptyProcess.onExit(({ exitCode }: { exitCode: number }) => {
        this.handlePtyExit(req.id, ptyProcess, exitCode)
      })

      this.ptys.set(req.id, {
        pty: ptyProcess,
        buffer,
        cwd: req.cwd,
        pid: ptyProcess.pid as number,
      })

      // T0113: Track PTY PID in registry for orphan cleanup on crash
      if (this._userDataPath) {
        addPtyEntry(
          { id: req.id, pid: ptyProcess.pid as number, cwd: req.cwd, createdAt: new Date().toISOString() },
          process.pid,
          this._userDataPath,
        )
      }

      // pty:created only goes back to the requester. T0806: `fdGuard` only on Linux (main logs it;
      // the server's own stderr goes nowhere), so other platforms send the same message as before.
      const created: Extract<ServerResponse, { type: 'pty:created' }> = { type: 'pty:created', id: req.id, pid: ptyProcess.pid as number }
      if (guard.wrapped) created.fdGuard = 'closed'
      else if (guard.reason === 'no-bash') created.fdGuard = 'no-bash'
      this.sendToClient(created, via, socket)
    } catch (e) {
      this.sendToClient({ type: 'error', requestType: 'pty:create', message: String(e) }, via, socket)
    }
  }

  /**
   * BUG-101 (T0394): exit of a spawned PTY. When the id already belongs to a newer PTY
   * (restart = kill + create with the same id), the late exit of the old one must neither
   * delete the new entry / registry row nor tell clients that the new terminal exited.
   * A plain kill already removed the entry, so its exit is still broadcast.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private handlePtyExit(id: string, proc: any, exitCode: number): void {
    const current = this.ptys.get(id)
    if (current && current.pty !== proc) {
      process.stderr.write(`[terminal-server] stale exit ignored id=${id} (replaced by a newer PTY)\n`)
      return
    }
    this.ptys.delete(id)
    // T0113: Remove from registry
    if (this._userDataPath) removePtyEntry(id, this._userDataPath)
    // Broadcast PTY exit to all connected clients
    this.broadcastToAll({ type: 'pty:exit', id, exitCode })
  }

  private writePty(req: Extract<ServerRequest, { type: 'pty:write' }>): void {
    const entry = this.ptys.get(req.id)
    if (!entry) {
      // No client context for write — broadcast error (caller may be any client)
      this.broadcastToAll({ type: 'error', requestType: 'pty:write', message: `PTY ${req.id} not found` })
    } else {
      entry.pty.write(req.data)
    }
  }

  private resizePty(req: Extract<ServerRequest, { type: 'pty:resize' }>): void {
    const entry = this.ptys.get(req.id)
    if (entry) {
      entry.pty.resize(req.cols, req.rows)
    }
  }

  private killPty(req: Extract<ServerRequest, { type: 'pty:kill' }>): void {
    const entry = this.ptys.get(req.id)
    if (entry) {
      void this.endPty(req.id, entry)
      this.ptys.delete(req.id)
      // T0113: Remove from registry
      if (this._userDataPath) removePtyEntry(req.id, this._userDataPath)
    }
  }

  /**
   * T0540 (PLAN-042): end a PTY like direct mode (`PtyManager.kill`). On Windows
   * `taskkill /F /T` ends the whole tree first — `pty.kill()` alone leaves children the
   * agent started without a console (detached) running — then `pty.kill()` releases the
   * pseudo console. Elsewhere `pty.kill()` (SIGHUP to the shell) runs right away, as before.
   */
  private endPty(id: string, entry: PtyEntry): Promise<void> {
    const killPty = () => { try { entry.pty.kill() } catch { /* already dead */ } }
    if (this.deps.platform !== 'win32') {
      killPty()
      return Promise.resolve()
    }
    return killProcessTree(entry.pid, this.deps).then((result) => {
      if (result !== 'killed') {
        process.stderr.write(`[terminal-server] taskkill tree id=${id} pid=${entry.pid}: ${result}\n`)
      }
      killPty()
    })
  }

  private listPtys(via: 'ipc' | 'tcp', socket?: net.Socket): void {
    const ptys = Array.from(this.ptys.entries()).map(([id, entry]) => ({
      id,
      pid: entry.pid,
      cwd: entry.cwd,
    }))
    this.sendToClient({ type: 'pty:list', ptys }, via, socket)
  }

  private getBuffer(
    req: Extract<ServerRequest, { type: 'pty:getBuffer' }>,
    via: 'ipc' | 'tcp',
    socket?: net.Socket,
  ): void {
    const entry = this.ptys.get(req.id)
    if (entry) {
      this.sendToClient({ type: 'pty:buffer', id: req.id, lines: entry.buffer.getLines() }, via, socket)
    } else {
      this.sendToClient({ type: 'error', requestType: 'pty:getBuffer', message: `PTY ${req.id} not found` }, via, socket)
    }
  }

  // ── Idle management ──────────────────────────────────────────────────────────

  /** Start countdown to auto-shutdown. Called when the parent process disconnects. */
  startIdleTimer(): void {
    if (this.idleTimeoutMs === 0) return // idleTimeoutMs=0 means never auto-shutdown
    if (this.idleTimer) return           // Already running
    if (!this.shouldStartIdle()) return  // Still have active connections

    this.idleTimer = setTimeout(() => {
      this.shutdown()
    }, this.effectiveIdleTimeoutMs)
  }

  /** Reset idle countdown — called on every incoming message. */
  resetIdleTimer(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer)
      this.idleTimer = null
    }
  }

  // ── Shutdown ─────────────────────────────────────────────────────────────────

  /**
   * Gracefully kill all PTYs, close TCP connections, and exit the process.
   * T0540: on Windows the exit (and the pid-file removal main waits for) comes after every
   * PTY's process tree has ended (each taskkill is capped by its timeout).
   */
  shutdown(): void {
    if (this.shuttingDown) return
    this.shuttingDown = true
    this.resetIdleTimer()

    const ended = Promise.all([...this.ptys].map(([id, entry]) => this.endPty(id, entry)))
    this.ptys.clear()

    // Close all TCP connections (clients and not yet authenticated ones) and the TCP server
    for (const [conn, state] of this.tcpStates) {
      if (state.helloTimer) clearTimeout(state.helloTimer)
      try { conn.destroy() } catch { /* ignore */ }
    }
    for (const client of this.tcpClients) {
      try { client.destroy() } catch { /* ignore */ }
    }
    this.tcpStates.clear()
    this.tcpClients.clear()
    if (this.tcpServer) {
      this.tcpServer.close()
      this.tcpServer = null
    }

    void ended.then(() => {
      // Clean up PID file + port file + PTY registry
      if (this._userDataPath) {
        try { clearRegistry(this._userDataPath) } catch { /* ignore */ }
        try { removePidFile(this._userDataPath) } catch { /* ignore */ }
        try { removePortFile(this._userDataPath) } catch { /* ignore */ }
        try { removeTokenFile(this._userDataPath) } catch { /* ignore */ }
      }

      this.deps.exit(0)
    })
  }
}

function isRequestObject(msg: unknown): msg is { type?: unknown; [key: string]: unknown } {
  return typeof msg === 'object' && msg !== null && !Array.isArray(msg)
}

function errorResponse(requestType: string, code: ServerErrorCode, message: string): Extract<ServerResponse, { type: 'error' }> {
  return { type: 'error', requestType, message, code }
}
