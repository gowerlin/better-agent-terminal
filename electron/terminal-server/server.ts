import { RingBuffer } from './ring-buffer'
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
 * Core Terminal Server logic. Manages PTY instances, routes IPC messages,
 * and handles idle-timeout shutdown after the parent process disconnects.
 */
export class TerminalServer {
  private readonly ptys: Map<string, PtyEntry> = new Map()
  private idleTimer: ReturnType<typeof setTimeout> | null = null
  private readonly idleTimeoutMs: number
  private readonly bufferLines: number

  constructor(idleTimeoutMs = DEFAULT_IDLE_TIMEOUT_MS, bufferLines = DEFAULT_BUFFER_LINES) {
    this.idleTimeoutMs = idleTimeoutMs
    this.bufferLines = bufferLines
  }

  private send(msg: ServerResponse): void {
    if (process.send) {
      process.send(msg)
    }
  }

  /** Dispatch an incoming IPC message to the appropriate handler. */
  handleMessage(msg: ServerRequest): void {
    this.resetIdleTimer()

    switch (msg.type) {
      case 'pty:create':    this.createPty(msg); break
      case 'pty:write':     this.writePty(msg); break
      case 'pty:resize':    this.resizePty(msg); break
      case 'pty:kill':      this.killPty(msg); break
      case 'pty:list':      this.listPtys(); break
      case 'pty:getBuffer': this.getBuffer(msg); break
      case 'server:ping':   this.send({ type: 'server:pong' }); break
      case 'server:getConfig':
        this.send({ type: 'server:config', scrollBufferLines: this.bufferLines, idleTimeoutMs: this.idleTimeoutMs })
        break
      case 'server:shutdown':
        this.shutdown()
        break
    }
  }

  private createPty(req: Extract<ServerRequest, { type: 'pty:create' }>): void {
    if (!ptyAvailable || !pty) {
      this.send({ type: 'error', requestType: 'pty:create', message: 'node-pty not available' })
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
        this.send({ type: 'pty:data', id: req.id, data })
      })

      ptyProcess.onExit(({ exitCode }: { exitCode: number }) => {
        this.ptys.delete(req.id)
        this.send({ type: 'pty:exit', id: req.id, exitCode })
      })

      this.ptys.set(req.id, {
        pty: ptyProcess,
        buffer,
        cwd: req.cwd,
        pid: ptyProcess.pid as number,
      })

      this.send({ type: 'pty:created', id: req.id, pid: ptyProcess.pid as number })
    } catch (e) {
      this.send({ type: 'error', requestType: 'pty:create', message: String(e) })
    }
  }

  private writePty(req: Extract<ServerRequest, { type: 'pty:write' }>): void {
    const entry = this.ptys.get(req.id)
    if (entry) {
      entry.pty.write(req.data)
    } else {
      this.send({ type: 'error', requestType: 'pty:write', message: `PTY ${req.id} not found` })
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

  private listPtys(): void {
    const ptys = Array.from(this.ptys.entries()).map(([id, entry]) => ({
      id,
      pid: entry.pid,
      cwd: entry.cwd,
    }))
    this.send({ type: 'pty:list', ptys })
  }

  private getBuffer(req: Extract<ServerRequest, { type: 'pty:getBuffer' }>): void {
    const entry = this.ptys.get(req.id)
    if (entry) {
      this.send({ type: 'pty:buffer', id: req.id, lines: entry.buffer.getLines() })
    } else {
      this.send({ type: 'error', requestType: 'pty:getBuffer', message: `PTY ${req.id} not found` })
    }
  }

  /** Start countdown to auto-shutdown. Call when parent process disconnects. */
  startIdleTimer(): void {
    if (this.idleTimeoutMs === 0) return // idleTimeoutMs=0 means never auto-shutdown
    if (this.idleTimer) return           // Already running

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

  /** Gracefully kill all PTYs and exit the process. */
  shutdown(): void {
    this.resetIdleTimer()
    for (const [, entry] of this.ptys) {
      try { entry.pty.kill() } catch { /* ignore */ }
    }
    this.ptys.clear()
    process.exit(0)
  }
}
