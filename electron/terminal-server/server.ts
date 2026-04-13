import * as net from 'net'
import { RingBuffer } from './ring-buffer'
import { writePortFile, removePortFile, removePidFile } from './pid-manager'
import type { ServerRequest, ServerResponse } from './protocol'

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

  constructor(idleTimeoutMs = DEFAULT_IDLE_TIMEOUT_MS, bufferLines = DEFAULT_BUFFER_LINES) {
    this.idleTimeoutMs = idleTimeoutMs
    this.bufferLines = bufferLines
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
    this.tcpServer = net.createServer((socket) => {
      this.tcpClients.add(socket)
      this.resetIdleTimer()  // New connection resets idle countdown

      let lineBuffer = ''
      socket.on('data', (chunk) => {
        lineBuffer += chunk.toString()
        // JSON-line protocol: one JSON object per newline
        const lines = lineBuffer.split('\n')
        lineBuffer = lines.pop()!  // Keep incomplete trailing fragment
        for (const line of lines) {
          if (line.trim()) {
            try {
              const msg = JSON.parse(line) as ServerRequest
              this.handleMessage(msg, 'tcp', socket)
            } catch {
              // Ignore malformed JSON
            }
          }
        }
      })

      socket.on('close', () => {
        this.tcpClients.delete(socket)
        // Start idle timer only if there are no remaining connections
        if (this.shouldStartIdle()) {
          this.startIdleTimer()
        }
      })

      socket.on('error', () => {
        this.tcpClients.delete(socket)
      })
    })

    this.tcpServer.listen(0, '127.0.0.1', () => {
      const port = (this.tcpServer!.address() as net.AddressInfo).port
      if (userDataPath) {
        writePortFile(port, userDataPath)
      }
    })
  }

  /** True when there are no active connections (IPC parent gone + no TCP clients). */
  private shouldStartIdle(): boolean {
    return !process.connected && this.tcpClients.size === 0
  }

  // ── Message dispatch ─────────────────────────────────────────────────────────

  /** Dispatch an incoming message to the appropriate handler. */
  handleMessage(msg: ServerRequest, via: 'ipc' | 'tcp' = 'ipc', socket?: net.Socket): void {
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
    }
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

    try {
      const ptyProcess = pty.spawn(req.shell, req.args, {
        name: 'xterm-256color',
        cols: req.cols,
        rows: req.rows,
        cwd: req.cwd,
        env: {
          ...process.env,
          ...(req.env ?? {}),
          TERM: 'xterm-256color',
          COLORTERM: 'truecolor',
          TERM_PROGRAM: 'better-agent-terminal',
          BAT_SESSION: '1',
          FORCE_COLOR: '3',
          CI: '',
        } as Record<string, string>,
      })

      const buffer = new RingBuffer(this.bufferLines)

      ptyProcess.onData((data: string) => {
        buffer.push(data)
        // Broadcast PTY output to all connected clients
        this.broadcastToAll({ type: 'pty:data', id: req.id, data })
      })

      ptyProcess.onExit(({ exitCode }: { exitCode: number }) => {
        this.ptys.delete(req.id)
        // Broadcast PTY exit to all connected clients
        this.broadcastToAll({ type: 'pty:exit', id: req.id, exitCode })
      })

      this.ptys.set(req.id, {
        pty: ptyProcess,
        buffer,
        cwd: req.cwd,
        pid: ptyProcess.pid as number,
      })

      // pty:created only goes back to the requester
      this.sendToClient({ type: 'pty:created', id: req.id, pid: ptyProcess.pid as number }, via, socket)
    } catch (e) {
      this.sendToClient({ type: 'error', requestType: 'pty:create', message: String(e) }, via, socket)
    }
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
      try { entry.pty.kill() } catch { /* already dead */ }
      this.ptys.delete(req.id)
    }
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
    }, this.idleTimeoutMs)
  }

  /** Reset idle countdown — called on every incoming message. */
  resetIdleTimer(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer)
      this.idleTimer = null
    }
  }

  // ── Shutdown ─────────────────────────────────────────────────────────────────

  /** Gracefully kill all PTYs, close TCP connections, and exit the process. */
  shutdown(): void {
    this.resetIdleTimer()

    for (const [, entry] of this.ptys) {
      try { entry.pty.kill() } catch { /* ignore */ }
    }
    this.ptys.clear()

    // Close all TCP clients and the TCP server
    for (const client of this.tcpClients) {
      try { client.destroy() } catch { /* ignore */ }
    }
    this.tcpClients.clear()
    if (this.tcpServer) {
      this.tcpServer.close()
      this.tcpServer = null
    }

    // Clean up PID file + port file
    if (this._userDataPath) {
      try { removePidFile(this._userDataPath) } catch { /* ignore */ }
      try { removePortFile(this._userDataPath) } catch { /* ignore */ }
    }

    process.exit(0)
  }
}
