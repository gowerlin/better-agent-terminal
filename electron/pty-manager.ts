import * as net from 'net'
import { app, BrowserWindow } from 'electron'
import { spawn, ChildProcess } from 'child_process'
import type { CreatePtyOptions } from '../src/types'
import { broadcastHub } from './remote/broadcast-hub'
import { logger } from './logger'
import type { ServerRequest, ServerResponse } from './terminal-server/protocol'
import { readRegistry, clearRegistry } from './terminal-server/pty-registry'

// Try to import @lydell/node-pty, fall back to child_process if not available
let pty: typeof import('@lydell/node-pty') | null = null
let ptyAvailable = false
try {
  pty = require('@lydell/node-pty')
  // Test if native module works by checking if spawn function exists and module is properly built
  if (pty && typeof pty.spawn === 'function') {
    ptyAvailable = true
    logger.log('node-pty loaded successfully (using @lydell/node-pty)')
  } else {
    logger.warn('node-pty loaded but spawn function not available')
  }
} catch (e) {
  logger.warn('@lydell/node-pty not available, falling back to child_process:', e)
}

interface PtyInstance {
  process: any // IPty or ChildProcess, or null when Terminal Server manages the PTY
  type: 'terminal'  // Unified to 'terminal' - agent types handled by agentPreset
  cwd: string
  usePty: boolean
  shell?: string       // Stored for heartbeat recovery rebuild (T0112)
  shellArgs?: string[] // Stored for heartbeat recovery rebuild (T0112)
}

export class PtyManager {
  private instances: Map<string, PtyInstance> = new Map()
  private getWindows: () => BrowserWindow[]

  // PTY output batching: accumulate data over 16ms windows to reduce IPC overhead
  private outputBuffers: Map<string, string> = new Map()
  private outputFlushTimer: ReturnType<typeof setTimeout> | null = null
  private static readonly BATCH_INTERVAL_MS = 16

  // Output ring buffer for supervisor queries (last N lines per terminal)
  private static readonly RING_BUFFER_LINES = 50
  private outputRingBuffers: Map<string, string[]> = new Map()

  // Terminal Server proxy (PLAN-008 Phase 2b / T0107)
  private serverProcess: ChildProcess | null = null

  // TCP reconnect channel (T0108)
  private tcpSocket: net.Socket | null = null

  // Heartbeat watchdog (T0112)
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null
  private lastPong: number = Date.now()
  private isRecovering = false
  private static readonly HEARTBEAT_INTERVAL_MS = 10_000  // 10 seconds
  private static readonly HEARTBEAT_TIMEOUT_MS = 3_000    // 3 seconds no pong → dead

  /** Callback provided by main.ts to re-fork a new Terminal Server process. */
  onRequestNewServer: (() => Promise<ChildProcess | null>) | null = null

  /** Callback provided by main.ts to get RemoteServer port/token for env injection (T0129). */
  getRemoteServerInfo: (() => { port: number; token: string } | null) | null = null

  constructor(getWindows: () => BrowserWindow[]) {
    this.getWindows = getWindows
  }

  /** Inject Terminal Server IPC reference; enables proxy mode for all future PTY operations. */
  setServerProcess(server: ChildProcess): void {
    this.serverProcess = server
    this.setupServerListener()
    // T0112: Fast-path death detection via IPC exit event
    server.once('exit', () => {
      if (!this.isRecovering) {
        logger.log('[PtyManager] Terminal Server IPC process exited — triggering recovery')
        this.handleServerDeath()
      }
    })
    this.lastPong = Date.now()
    this.startHeartbeat()
    logger.log('[PtyManager] Terminal Server connected via IPC — proxy mode active')
  }

  /** True when the fork IPC channel to the Terminal Server is still open. */
  isIpcConnected(): boolean {
    return this.serverProcess !== null && this.serverProcess.connected
  }

  /**
   * Connect to an already-running Terminal Server via TCP (T0108 reconnect path).
   * Returns true if the connection succeeds within 3 seconds.
   */
  public connectToServer(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      // T0111: Close existing TCP socket before opening a new one to avoid
      // duplicate message delivery (Terminal Server broadcasts to ALL clients).
      if (this.tcpSocket && !this.tcpSocket.destroyed) {
        this.tcpSocket.destroy()
        this.tcpSocket = null
      }

      const socket = new net.Socket()

      socket.setTimeout(3000)

      socket.connect(port, '127.0.0.1', () => {
        socket.setTimeout(0)
        this.tcpSocket = socket
        this.setupTcpListener()
        logger.log(`[PtyManager] TCP connected to Terminal Server on port ${port}`)
        resolve(true)
      })

      socket.on('error', () => {
        socket.destroy()
        resolve(false)
      })

      socket.on('timeout', () => {
        socket.destroy()
        resolve(false)
      })

      socket.on('close', () => {
        if (this.tcpSocket === socket) {
          this.tcpSocket = null
          logger.log('[PtyManager] TCP connection to Terminal Server closed')
          // T0112: Fast-path death detection via TCP close (more immediate than heartbeat)
          if (!this.isRecovering) {
            this.handleServerDeath()
          }
        }
      })
    })
  }

  /** Set up JSON-line framing on the TCP socket and route messages through handleServerMessage. */
  private setupTcpListener(): void {
    if (!this.tcpSocket) return
    let lineBuffer = ''
    this.tcpSocket.on('data', (chunk: Buffer) => {
      lineBuffer += chunk.toString()
      const lines = lineBuffer.split('\n')
      lineBuffer = lines.pop()!
      for (const line of lines) {
        if (line.trim()) {
          try {
            this.handleServerMessage(JSON.parse(line) as ServerResponse)
          } catch {
            logger.error('[PtyManager] TCP: failed to parse server message')
          }
        }
      }
    })
  }

  /** True when there is an active connection to the Terminal Server (IPC or TCP). */
  private get useServer(): boolean {
    return (this.serverProcess !== null && this.serverProcess.connected) ||
           (this.tcpSocket !== null && !this.tcpSocket.destroyed)
  }

  /**
   * Send a request to the Terminal Server via whichever channel is available.
   * Prefers IPC (fork) over TCP when both are connected.
   */
  public sendToServer(msg: ServerRequest): void {
    if (this.serverProcess?.connected) {
      this.serverProcess.send(msg)
    } else if (this.tcpSocket && !this.tcpSocket.destroyed) {
      this.tcpSocket.write(JSON.stringify(msg) + '\n')
    } else {
      logger.warn('[PtyManager] sendToServer: no active server connection')
    }
  }

  /** Route responses from the Terminal Server into the broadcast pipeline. */
  private handleServerMessage(msg: ServerResponse): void {
    switch (msg.type) {
      case 'pty:data':
        this.handlePtyData(msg.id, msg.data); break
      case 'pty:exit':
        this.handlePtyExit(msg.id, msg.exitCode); break
      case 'pty:created':
        logger.log(`[PtyManager] server spawned PTY ${msg.id} (pid ${msg.pid})`); break
      case 'pty:list':
        this.handleReplayList(msg.ptys); break
      case 'pty:buffer':
        this.handleReplayBuffer(msg.id, msg.lines); break
      case 'server:pong':
        this.lastPong = Date.now(); break  // T0112: heartbeat ACK
      case 'error':
        logger.error('[PtyManager] server error:', msg); break
    }
  }

  /** Route IPC messages from the Terminal Server through handleServerMessage. */
  private setupServerListener(): void {
    if (!this.serverProcess) return
    this.serverProcess.on('message', (msg: ServerResponse) => {
      this.handleServerMessage(msg)
    })
  }

  /**
   * Called when a pty:list response arrives during buffer replay (T0108).
   * Registers active PTY instances and requests their ring buffers.
   */
  private handleReplayList(ptys: Array<{ id: string; pid: number; cwd: string }>): void {
    logger.log(`[PtyManager] replay: ${ptys.length} active PTY(s) found on reconnect`)
    for (const { id, cwd } of ptys) {
      // Register the instance so write/resize/kill work after reconnect
      if (!this.instances.has(id)) {
        this.instances.set(id, { process: null, type: 'terminal', cwd, usePty: true })
      }
      // Request the ring buffer for this PTY
      this.sendToServer({ type: 'pty:getBuffer', id })
    }
  }

  /**
   * Called when a pty:buffer response arrives during buffer replay (T0108).
   * Broadcasts the buffered output to the renderer so xterm.js renders it.
   */
  private handleReplayBuffer(id: string, lines: string[]): void {
    if (lines.length > 0) {
      // Re-join lines with \n to reconstruct the original output stream
      const data = lines.join('\n')
      this.broadcast('pty:output', id, data)
      logger.log(`[PtyManager] replayed buffer for PTY ${id}: ${lines.length} lines`)
    }
  }

  private handlePtyData(id: string, data: string): void {
    // Reuse the same output batching + ring buffer path as direct PTY mode
    this.enqueuePtyOutput(id, data)
  }

  private handlePtyExit(id: string, exitCode: number): void {
    this.instances.delete(id)
    this.broadcast('pty:exit', id, exitCode)
  }

  private broadcast(channel: string, ...args: unknown[]) {
    for (const win of this.getWindows()) {
      if (!win.isDestroyed()) {
        try {
          win.webContents.send(channel, ...args)
        } catch {
          // Render frame may be disposed during window reload/close
        }
      }
    }
    broadcastHub.broadcast(channel, ...args)
  }

  /** Enqueue PTY output and flush in batched intervals */
  private enqueuePtyOutput(id: string, data: string) {
    const prev = this.outputBuffers.get(id) || ''
    this.outputBuffers.set(id, prev + data)
    if (!this.outputFlushTimer) {
      this.outputFlushTimer = setTimeout(() => {
        this.flushPtyOutputs()
      }, PtyManager.BATCH_INTERVAL_MS)
    }
  }

  private flushPtyOutputs() {
    this.outputFlushTimer = null
    for (const [id, data] of this.outputBuffers) {
      this.broadcast('pty:output', id, data)
      this.appendToRingBuffer(id, data)
    }
    this.outputBuffers.clear()
  }

  /** Append raw data to the ring buffer (last N lines) for supervisor queries */
  private appendToRingBuffer(id: string, data: string) {
    let lines = this.outputRingBuffers.get(id) || []
    const newLines = data.split('\n')
    // Merge last existing line with first new chunk (they may be partial)
    if (lines.length > 0 && newLines.length > 0) {
      lines[lines.length - 1] += newLines.shift()!
    }
    lines = lines.concat(newLines)
    // Keep only last N lines
    if (lines.length > PtyManager.RING_BUFFER_LINES) {
      lines = lines.slice(-PtyManager.RING_BUFFER_LINES)
    }
    this.outputRingBuffers.set(id, lines)
  }

  /** Get last N lines of output for a terminal (supervisor query) */
  getLastOutput(id: string, lineCount: number = 30): string[] {
    const lines = this.outputRingBuffers.get(id) || []
    return lines.slice(-lineCount)
  }

  /** Write data to a specific terminal's PTY (cross-terminal send) */
  writeToTerminal(id: string, data: string): boolean {
    const instance = this.instances.get(id)
    if (!instance) return false
    if (this.useServer) {
      this.sendToServer({ type: 'pty:write', id, data })
      return true
    }
    if (instance.usePty) {
      instance.process.write(data)
    } else {
      instance.process.stdin?.write(data)
    }
    return true
  }

  /** Check if a PTY instance is alive */
  isAlive(id: string): boolean {
    return this.instances.has(id)
  }

  private getDefaultShell(): string {
    if (process.platform === 'win32') {
      // Prefer PowerShell 7 (pwsh) over Windows PowerShell
      const fs = require('fs')
      const pwshPaths = [
        'C:\\Program Files\\PowerShell\\7\\pwsh.exe',
        'C:\\Program Files (x86)\\PowerShell\\7\\pwsh.exe',
        process.env.LOCALAPPDATA + '\\Microsoft\\WindowsApps\\pwsh.exe'
      ]
      for (const p of pwshPaths) {
        if (fs.existsSync(p)) {
          return p
        }
      }
      return 'powershell.exe'
    } else if (process.platform === 'darwin') {
      return process.env.SHELL || '/bin/zsh'
    } else {
      // Linux - detect available shell
      const fs = require('fs')
      if (process.env.SHELL) {
        return process.env.SHELL
      } else if (fs.existsSync('/bin/bash')) {
        return '/bin/bash'
      } else {
        return '/bin/sh'
      }
    }
  }

  create(options: CreatePtyOptions): boolean {
    const { id, cwd, type, shell: shellOverride, customEnv = {} } = options

    const shell = shellOverride || this.getDefaultShell()
    let args: string[] = []

    // For PowerShell (pwsh or powershell), bypass execution policy to allow unsigned scripts
    if (shell.includes('powershell') || shell.includes('pwsh')) {
      args = ['-ExecutionPolicy', 'Bypass', '-NoLogo']
    } else if (process.platform === 'win32' && shell.includes('bash')) {
      // Git Bash on Windows — use login interactive shell
      args = ['--login', '-i']
    } else if (process.platform === 'darwin' || process.platform === 'linux') {
      // Use login interactive shell to source profile files (.zshrc, .bashrc, .profile, etc.)
      // This ensures PATH and other environment variables are properly set
      // -l = login shell, -i = interactive shell
      args = ['-l', '-i']
    }

    // Proxy to Terminal Server if IPC connection is live
    if (this.useServer) {
      // T0111: Skip if PTY already exists on server (idempotent — handles View→Reload).
      // initTerminals re-sends pty:create with the same IDs after renderer reload;
      // sending to server would overwrite the running PTY and clear its ring buffer.
      if (this.instances.has(id)) {
        logger.log(`[PtyManager] pty:create SKIP (idempotent) id=${id} — already registered`)
        return true
      }
      // T0129: Inject RemoteServer port/token so PTY children can connect back via WebSocket
      const remoteInfo = this.getRemoteServerInfo?.() ?? null
      const envWithUtf8 = {
        ...process.env as Record<string, string>,
        ...customEnv,
        LANG: 'en_US.UTF-8',
        LC_ALL: 'en_US.UTF-8',
        PYTHONIOENCODING: 'utf-8',
        PYTHONUTF8: '1',
        TERM: 'xterm-256color',
        COLORTERM: 'truecolor',
        TERM_PROGRAM: 'better-agent-terminal',
        TERM_PROGRAM_VERSION: '1.0',
        BAT_SESSION: '1',
        FORCE_COLOR: '3',
        CLAUDE_CODE_NO_FLICKER: '1',
        CI: '',
        ...(remoteInfo ? { BAT_REMOTE_PORT: String(remoteInfo.port), BAT_REMOTE_TOKEN: remoteInfo.token } : {}),
      }
      this.sendToServer({
        type: 'pty:create',
        id,
        shell,
        args,
        cwd,
        cols: 120,
        rows: 30,
        env: envWithUtf8,
      })
      // T0112: Store shell/args so handleServerDeath() can rebuild after crash
      this.instances.set(id, { process: null, type, cwd, usePty: true, shell, shellArgs: args })
      logger.log(`[PtyManager] pty:create ${id} → Terminal Server`)
      return true
    }

    // Fallback: direct PTY spawn (node-pty or child_process)
    let usedPty = false

    if (ptyAvailable && pty) {
      try {
        // Set UTF-8 and terminal environment variables, merge custom env
        // T0129: Inject RemoteServer port/token so PTY children can connect back via WebSocket
        const remoteInfoLocal = this.getRemoteServerInfo?.() ?? null
        const envWithUtf8 = {
          ...process.env,
          ...customEnv,  // Merge custom environment variables
          // UTF-8 encoding
          LANG: 'en_US.UTF-8',
          LC_ALL: 'en_US.UTF-8',
          PYTHONIOENCODING: 'utf-8',
          PYTHONUTF8: '1',
          // Terminal capabilities - let apps know we are a real PTY
          TERM: 'xterm-256color',
          COLORTERM: 'truecolor',
          TERM_PROGRAM: 'better-agent-terminal',
          TERM_PROGRAM_VERSION: '1.0',
          // BAT session identification (for Control Tower auto-session detection)
          BAT_SESSION: '1',
          // Force color output
          FORCE_COLOR: '3',
          // Suppress ED2-induced viewport flicker in Claude Code streaming
          // (xterm.js issue #5801: ED2 inside DEC 2026 sync blocks resets viewportY)
          CLAUDE_CODE_NO_FLICKER: '1',
          // Ensure not detected as CI environment
          CI: '',
          // T0129: RemoteServer connection info for CLI tools
          ...(remoteInfoLocal ? { BAT_REMOTE_PORT: String(remoteInfoLocal.port), BAT_REMOTE_TOKEN: remoteInfoLocal.token } : {}),
        }

        const ptyProcess = pty.spawn(shell, args, {
          name: 'xterm-256color',
          cols: 120,
          rows: 30,
          cwd,
          env: envWithUtf8 as { [key: string]: string }
        })

        ptyProcess.onData((data: string) => {
          this.enqueuePtyOutput(id, data)
        })

        ptyProcess.onExit(({ exitCode }: { exitCode: number }) => {
          this.broadcast('pty:exit', id, exitCode)
          this.instances.delete(id)
        })

        this.instances.set(id, { process: ptyProcess, type, cwd, usePty: true })
        usedPty = true
        logger.log('Created terminal using node-pty')
      } catch (e) {
        logger.warn('node-pty spawn failed, falling back to child_process:', e)
        ptyAvailable = false // Don't try again
      }
    }

    if (!usedPty) {
      try {
        // Fallback to child_process with proper stdio
        // For PowerShell, add -NoExit and UTF-8 command
        let shellArgs = [...args]
        if (shell.includes('powershell') || shell.includes('pwsh')) {
          shellArgs.push(
            '-NoExit',
            '-Command',
            '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; [Console]::InputEncoding = [System.Text.Encoding]::UTF8; $OutputEncoding = [System.Text.Encoding]::UTF8'
          )
        }

        // Set UTF-8 and terminal environment variables, merge custom env (child_process fallback)
        // T0129: Inject RemoteServer port/token so PTY children can connect back via WebSocket
        const remoteInfoFallback = this.getRemoteServerInfo?.() ?? null
        const envWithUtf8 = {
          ...process.env,
          ...customEnv,  // Merge custom environment variables
          // UTF-8 encoding
          LANG: 'en_US.UTF-8',
          LC_ALL: 'en_US.UTF-8',
          PYTHONIOENCODING: 'utf-8',
          PYTHONUTF8: '1',
          // Terminal capabilities (limited in child_process mode)
          TERM: 'xterm-256color',
          COLORTERM: 'truecolor',
          TERM_PROGRAM: 'better-agent-terminal',
          TERM_PROGRAM_VERSION: '1.0',
          // BAT session identification (for Control Tower auto-session detection)
          BAT_SESSION: '1',
          FORCE_COLOR: '3',
          CI: '',
          // T0129: RemoteServer connection info for CLI tools
          ...(remoteInfoFallback ? { BAT_REMOTE_PORT: String(remoteInfoFallback.port), BAT_REMOTE_TOKEN: remoteInfoFallback.token } : {}),
        }

        const childProcess = spawn(shell, shellArgs, {
          cwd,
          env: envWithUtf8 as NodeJS.ProcessEnv,
          stdio: ['pipe', 'pipe', 'pipe'],
          shell: false,
          windowsHide: true
        })

        childProcess.stdout?.on('data', (data: Buffer) => {
          this.enqueuePtyOutput(id, data.toString())
        })

        childProcess.stderr?.on('data', (data: Buffer) => {
          this.enqueuePtyOutput(id, data.toString())
        })

        childProcess.on('exit', (exitCode: number | null) => {
          this.broadcast('pty:exit', id, exitCode ?? 0)
          this.instances.delete(id)
        })

        childProcess.on('error', (error) => {
          logger.error('Child process error:', error)
          this.broadcast('pty:output', id, `\r\n[Error: ${error.message}]\r\n`)
        })

        // Send initial message
        this.broadcast('pty:output', id, `[Terminal - child_process mode]\r\n`)

        this.instances.set(id, { process: childProcess, type, cwd, usePty: false })
        logger.log('Created terminal using child_process fallback')
      } catch (error) {
        logger.error('Failed to create terminal:', error)
        return false
      }
    }

    return true
  }

  write(id: string, data: string): void {
    if (this.useServer && this.instances.has(id)) {
      this.sendToServer({ type: 'pty:write', id, data })
      return
    }
    const instance = this.instances.get(id)
    if (instance) {
      if (instance.usePty) {
        instance.process.write(data)
      } else {
        // For child_process, write to stdin only (shell handles echo)
        const cp = instance.process as ChildProcess
        cp.stdin?.write(data)
      }
    }
  }

  resize(id: string, cols: number, rows: number): void {
    if (this.useServer && this.instances.has(id)) {
      this.sendToServer({ type: 'pty:resize', id, cols, rows })
      return
    }
    const instance = this.instances.get(id)
    if (instance && instance.usePty) {
      instance.process.resize(cols, rows)
    }
  }

  kill(id: string): boolean {
    if (this.useServer && this.instances.has(id)) {
      this.sendToServer({ type: 'pty:kill', id })
      this.instances.delete(id)
      return true
    }
    const instance = this.instances.get(id)
    if (instance) {
      const pid: number | undefined = instance.process.pid
      if (instance.usePty) {
        instance.process.kill()
      } else {
        (instance.process as ChildProcess).kill()
      }
      // On Windows, kill() only terminates the direct shell process.
      // Use taskkill /T to forcefully terminate the entire process tree.
      if (process.platform === 'win32' && pid) {
        try {
          const { execFileSync } = require('child_process')
          execFileSync('taskkill', ['/F', '/T', '/PID', String(pid)], { stdio: 'ignore', timeout: 3000, windowsHide: true })
        } catch { /* process may already be gone */ }
      }
      this.instances.delete(id)
      return true
    }
    return false
  }

  restart(id: string, cwd: string, shell?: string): boolean {
    const instance = this.instances.get(id)
    if (instance) {
      const type = instance.type
      this.kill(id)
      return this.create({ id, cwd, type, shell })
    }
    return false
  }

  getCwd(id: string): string | null {
    const instance = this.instances.get(id)
    if (instance) {
      return instance.cwd
    }
    return null
  }

  /** Start sending periodic ping messages to the Terminal Server (T0112). */
  private startHeartbeat(): void {
    this.stopHeartbeat()
    this.lastPong = Date.now()
    this.heartbeatTimer = setInterval(() => {
      const elapsed = Date.now() - this.lastPong
      if (elapsed > PtyManager.HEARTBEAT_INTERVAL_MS + PtyManager.HEARTBEAT_TIMEOUT_MS) {
        logger.error(`[PtyManager] heartbeat timeout (${elapsed}ms since last pong) — server dead`)
        if (!this.isRecovering) {
          this.handleServerDeath()
        }
        return
      }
      this.sendToServer({ type: 'server:ping' })
    }, PtyManager.HEARTBEAT_INTERVAL_MS)
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer !== null) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  /** Attempt to recover from Terminal Server death: re-fork + rebuild all PTYs (T0112). */
  private async handleServerDeath(): Promise<void> {
    if (this.isRecovering) return
    this.isRecovering = true
    try {
      logger.error('[PtyManager] Terminal Server died — attempting recovery...')
      this.stopHeartbeat()

      // Notify renderer: server is recovering
      this.broadcast('terminal-server:status', 'recovering')

      // Clean up dead connection state
      this.serverProcess = null
      if (this.tcpSocket && !this.tcpSocket.destroyed) {
        this.tcpSocket.destroy()
        this.tcpSocket = null
      }

      // T0113: Kill orphan PTY processes from registry before re-forking
      try {
        const userDataPath = app.getPath('userData')
        const registry = readRegistry(userDataPath)
        if (registry?.ptys.length) {
          for (const entry of registry.ptys) {
            try { process.kill(entry.pid, 'SIGTERM') } catch { /* already dead */ }
          }
          // Windows: force-kill process trees to ensure child shells die
          if (process.platform === 'win32') {
            const { execFile } = require('child_process')
            for (const entry of registry.ptys) {
              try { execFile('taskkill', ['/F', '/T', '/PID', String(entry.pid)]) } catch { /* ignore */ }
            }
          }
          logger.log(`[PtyManager] Killed ${registry.ptys.length} orphan PTY(s) from registry`)
        }
        clearRegistry(userDataPath)
      } catch (e) {
        logger.warn('[PtyManager] Failed to clean orphan PTYs from registry:', e)
      }

      // Request main.ts to re-fork a new server
      const newServer = this.onRequestNewServer ? await this.onRequestNewServer() : null
      if (!newServer) {
        logger.error('[PtyManager] re-fork failed or no callback — Terminal Server unavailable')
        this.broadcast('terminal-server:status', 'failed')
        return
      }

      // setServerProcess also starts a new heartbeat
      this.setServerProcess(newServer)

      // Rebuild all PTYs that were running before the crash
      const oldInstances = new Map(this.instances)
      this.instances.clear()
      for (const [id, inst] of oldInstances) {
        const shell = inst.shell || this.getDefaultShell()
        const args = inst.shellArgs || []
        this.sendToServer({
          type: 'pty:create',
          id,
          shell,
          args,
          cwd: inst.cwd,
          cols: 120,
          rows: 30,
        })
        this.instances.set(id, { ...inst, process: null })
      }

      // Notify renderer: recovery complete
      this.broadcast('terminal-server:status', 'recovered')
      logger.log('[PtyManager] Terminal Server recovery complete')
    } finally {
      this.isRecovering = false
    }
  }

  dispose(): void {
    this.stopHeartbeat()  // T0112: stop heartbeat before cleanup
    if (this.useServer) {
      // Don't kill server PTYs — Terminal Server survives BAT restarts (T0108 reconnection).
      // Only clean up any direct (non-proxy) fallback instances that have a live process.
      for (const [, inst] of this.instances) {
        if (inst.process) {
          try {
            if (inst.usePty) inst.process.kill()
            else (inst.process as ChildProcess).kill()
          } catch { /* already gone */ }
        }
      }
      this.serverProcess = null
      this.instances.clear()
      return
    }
    for (const [id] of this.instances) {
      this.kill(id)
    }
  }
}
