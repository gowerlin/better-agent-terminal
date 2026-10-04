import * as net from 'net'
import * as path from 'path'
import { spawn, ChildProcess } from 'child_process'
import { PTY_LIMIT_REACHED, type CreatePtyOptions, type PtyCreateResult, type PtyReplayBuffer } from '../src/types'
import { broadcastHub } from './remote/broadcast-hub'
import { logger } from './logger'
import type { ServerRequest, ServerResponse } from './terminal-server/protocol'
import { readRegistry, clearRegistry } from './terminal-server/pty-registry'
import { getRuntimeSettingsSnapshot } from './claude-runtime-router'
import { claudeUpdateGuardEnv } from './claude-resolver'
import { resolvePtyLocaleEnv } from './pty-locale-env'

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
  /**
   * BUG-101 (T0394): pty:create was sent to the Terminal Server and its pty:created has not
   * arrived yet. The server answers pty:created before any exit of the PTY it spawns, so a
   * pty:exit for this id seen while this is set belongs to the process it replaced.
   */
  awaitingCreated?: boolean
  /**
   * T0448 (T0445 #4): the `customEnv` this process was spawned with. `restart` re-uses it when
   * the host binds helper env to it (`deps.helperEnv`): a restarted worker keeps
   * `BAT_TOWER_TERMINAL_ID`, so it is re-issued a worker capability for the same tower instead
   * of being promoted to tower.
   */
  customEnv?: Record<string, string>
}

/**
 * Host dependencies (PLAN-036 T0389). PtyManager does not import `electron`:
 * Electron main builds these with `createElectronPtyDeps()` (main.ts), the
 * headless bat-server with its own emit / dataDir.
 */
export interface PtyManagerDeps {
  /** Deliver PTY events (`pty:output` / `pty:exit` / `terminal-server:status`) to subscribers. */
  emit: (channel: string, ...args: unknown[]) => void
  /** Data directory holding the Terminal Server PTY registry (Electron = userData). */
  dataDir: string
  /**
   * T0140: absolute path to the helper scripts (bat-terminal.mjs, bat-notify.mjs),
   * injected into PTY env as `BAT_HELPER_DIR`. Empty / undefined = not injected
   * (headless: not set — `helperEnv` supplies `BAT_HELPER_DIR` together with the PTY's
   * capability, T0433).
   */
  helperDir?: string
  /**
   * T0390: drop inherited `process.env` keys before the PTY env is built (true = drop).
   * Headless passes a BAT_* filter so a bat-server started from inside a BAT terminal
   * does not leak that session's `BAT_HELPER_DIR` / `BAT_REMOTE_TOKEN` / `BAT_TOWER_TERMINAL_ID`
   * into remote shells. Undefined = inherit everything (Electron, pre-T0390 behaviour).
   */
  dropInheritedEnv?: (key: string) => boolean
  /**
   * T0404: most PTYs this manager runs at once; `pty:create` for a new id beyond it throws
   * `PtyLimitError` (running PTYs are untouched). Headless only. Undefined / 0 = unlimited
   * (Electron: local PTY lifetime is owned by the windows).
   */
  maxInstances?: number
  /**
   * T0432: called with the id of a PTY that is gone — killed (`kill` / `killAll` / restart's
   * kill), exited on its own, or (T0433) failed to spawn. A stale exit of a replaced process is not reported. May be
   * called twice for one PTY (kill, then its exit); listeners must be idempotent. Headless
   * revokes the PTY's helper capability here. Undefined = no hook (Electron).
   */
  onPtyExit?: (id: string) => void
  /**
   * T0433: extra env for the helpers (`bat-terminal.mjs` / `bat-notify.mjs`) inside PTY `id`,
   * spread last so neither `customEnv` nor the inherited env can override it. Called once
   * per PTY actually spawned — never for an idempotent re-create of a running id, whose
   * env (and helper capability) must stay valid. Headless issues the PTY's capability here
   * (`BAT_REMOTE_TOKEN`); the server token never goes through it. Undefined = nothing
   * extra (Electron: `getRemoteServerInfo` + `helperDir` as before).
   */
  helperEnv?: (id: string, customEnv: Record<string, string>) => Record<string, string>
}

/** T0404: `pty:create` refused because the manager already runs `maxInstances` PTYs. */
export class PtyLimitError extends Error {
  readonly code = PTY_LIMIT_REACHED
  constructor(readonly limit: number) {
    super(`PTY limit reached: this server already runs ${limit} terminals (max ${limit}). Close a terminal and try again.`)
    this.name = 'PtyLimitError'
  }
}

/** Minimal window surface `createWindowBroadcastEmit` needs (structurally matches BrowserWindow). */
export interface PtyEventWindow {
  isDestroyed(): boolean
  webContents: { send(channel: string, ...args: unknown[]): void }
}

/**
 * Electron emit: send to every live window, then mirror to remote clients via
 * broadcastHub (the pre-T0389 `PtyManager.broadcast` behaviour).
 */
export function createWindowBroadcastEmit(getWindows: () => PtyEventWindow[]): PtyManagerDeps['emit'] {
  return (channel, ...args) => {
    for (const win of getWindows()) {
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
}

/**
 * T0403: raw replay buffer cap per PTY, in UTF-16 code units (JS string length). Trimming
 * runs once the buffer passes cap + slack, so a busy terminal does not re-copy 256K on
 * every 16ms flush.
 */
export const REPLAY_BUFFER_MAX_CHARS = 256 * 1024
const REPLAY_BUFFER_TRIM_SLACK = 64 * 1024

/**
 * T0403: keep at most `max` trailing chars of `buf`, starting the kept part where a replay
 * into a fresh terminal is safe: right after a `\n`, else at an ESC (start of a sequence,
 * never its middle), else at the plain cut point moved off a surrogate-pair half.
 */
export function trimReplayBuffer(buf: string, max: number): string {
  if (buf.length <= max) return buf
  const cut = buf.length - max
  const nl = buf.indexOf('\n', cut)
  if (nl !== -1) return buf.slice(nl + 1)
  const esc = buf.indexOf('\x1b', cut)
  if (esc !== -1) return buf.slice(esc)
  const code = buf.charCodeAt(cut)
  return buf.slice(code >= 0xdc00 && code <= 0xdfff ? cut + 1 : cut)
}

// BUG-084 / T0372: a claude-cli terminal running the embedded binary also gets DISABLE_UPDATES
// (see claudeUpdateGuardEnv), so a manual `claude update` cannot rename the binary inside
// app.asar.unpacked. Decided from the persisted runtime mode — the same snapshot
// `claude:get-cli-path` resolves from right before the renderer creates this PTY. System mode,
// including its async fallback-to-embedded case, and plain terminals are left updatable;
// DISABLE_AUTOUPDATER still covers the background updater everywhere.
function claudeCliUpdateGuardEnv(agentPreset?: string): Record<string, string> {
  if (agentPreset !== 'claude-cli' && agentPreset !== 'claude-cli-worktree') return {}
  return claudeUpdateGuardEnv(getRuntimeSettingsSnapshot().mode === 'embedded' ? 'embedded' : 'system')
}

export class PtyManager {
  private instances: Map<string, PtyInstance> = new Map()
  private readonly deps: PtyManagerDeps

  // PTY output batching: accumulate data over 16ms windows to reduce IPC overhead
  private outputBuffers: Map<string, string> = new Map()
  private outputFlushTimer: ReturnType<typeof setTimeout> | null = null
  private static readonly BATCH_INTERVAL_MS = 16

  // Output ring buffer for supervisor queries (last N lines per terminal)
  private static readonly RING_BUFFER_LINES = 50
  private outputRingBuffers: Map<string, string[]> = new Map()

  // T0403: raw output tail per PTY for `pty:get-buffer` replay (VT sequences intact, unlike
  // the line ring buffer above). Appended in the same tick as the pty:output broadcast.
  private replayBuffers: Map<string, PtyReplayBuffer> = new Map()

  // Terminal Server proxy (PLAN-008 Phase 2b / T0107)
  private serverProcess: ChildProcess | null = null

  // TCP reconnect channel (T0108)
  private tcpSocket: net.Socket | null = null

  // Heartbeat watchdog (T0112)
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null
  private lastPong: number = Date.now()
  private isRecovering = false
  // T0150 (BUG-035): set by main.ts before graceful shutdown so the watchdog
  // does not mistake the intentional TCP close / IPC exit for a crash and
  // re-fork an orphan Terminal Server.
  private isShuttingDown = false
  private static readonly HEARTBEAT_INTERVAL_MS = 10_000  // 10 seconds
  private static readonly HEARTBEAT_TIMEOUT_MS = 3_000    // 3 seconds no pong → dead

  /** Callback provided by main.ts to re-fork a new Terminal Server process. */
  onRequestNewServer: (() => Promise<ChildProcess | null>) | null = null

  /** Callback provided by main.ts to get RemoteServer port/token for env injection (T0129). */
  getRemoteServerInfo: (() => { port: number; token: string } | null) | null = null

  constructor(deps: PtyManagerDeps) {
    this.deps = deps
  }

  /** `process.env` minus the keys the host asked to drop (T0390). */
  private inheritedEnv(): NodeJS.ProcessEnv {
    const drop = this.deps.dropInheritedEnv
    if (!drop) return process.env
    const env: NodeJS.ProcessEnv = {}
    for (const [key, value] of Object.entries(process.env)) {
      if (!drop(key)) env[key] = value
    }
    return env
  }

  /** T0140: `BAT_HELPER_DIR` env entry, omitted when the host has no helper dir. */
  private helperDirEnv(): { BAT_HELPER_DIR?: string } {
    return this.deps.helperDir ? { BAT_HELPER_DIR: this.deps.helperDir } : {}
  }

  /** T0433: `deps.helperEnv` for a PTY about to be spawned; a throwing host yields none. */
  private helperEnvFor(id: string, customEnv: Record<string, string>): Record<string, string> {
    if (!this.deps.helperEnv) return {}
    try {
      return this.deps.helperEnv(id, customEnv)
    } catch (e) {
      logger.warn(`[PtyManager] helperEnv failed id=${id}:`, e)
      return {}
    }
  }

  /** BUG-102 (T0398): UTF-8 locale entries, spread after `customEnv`. */
  private localeEnv(customEnv: Record<string, string>): Record<string, string> {
    return resolvePtyLocaleEnv({ platform: process.platform, inheritedEnv: this.inheritedEnv(), customEnv })
  }

  /** Inject Terminal Server IPC reference; enables proxy mode for all future PTY operations. */
  setServerProcess(server: ChildProcess): void {
    this.serverProcess = server
    this.setupServerListener()
    // T0112: Fast-path death detection via IPC exit event
    server.once('exit', () => {
      if (this.isShuttingDown) {
        // T0150 (BUG-035): intentional shutdown, skip re-fork
        logger.log('[PtyManager] Terminal Server IPC exit during shutdown — skip re-fork')
        return
      }
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
          if (this.isShuttingDown) {
            // T0150 (BUG-035): intentional shutdown via sendShutdownToServer,
            // do not mistake for a crash and re-fork an orphan server.
            logger.log('[PtyManager] TCP close during shutdown — skip re-fork')
            return
          }
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
        this.handlePtyCreated(msg.id, msg.pid); break
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
      // T0403: a fresh main process (BAT reopened) has seen none of this PTY's output yet;
      // seed its replay buffer so a later pty:get-buffer (e.g. View→Reload) still has it.
      // A buffer that already holds output is left alone — it would duplicate the history.
      if (!this.replayBuffers.get(id)?.total) this.appendToReplayBuffer(id, data)
      this.broadcast('pty:output', id, data)
      logger.log(`[PtyManager] replayed buffer for PTY ${id}: ${lines.length} lines`)
    }
  }

  private handlePtyData(id: string, data: string): void {
    // Reuse the same output batching + ring buffer path as direct PTY mode
    this.enqueuePtyOutput(id, data)
  }

  private handlePtyCreated(id: string, pid: number): void {
    const instance = this.instances.get(id)
    if (instance) instance.awaitingCreated = false
    logger.log(`[PtyManager] server spawned PTY ${id} (pid ${pid})`)
  }

  /**
   * Exit reported by the Terminal Server. BUG-101 (T0394): the server already drops the late
   * exit of a restarted PTY; this covers the window where the old PTY exits between the server
   * handling pty:kill and pty:create — that exit then arrives here after restart() registered
   * the new instance, and must neither delete it nor reach the renderer.
   */
  private handlePtyExit(id: string, exitCode: number): void {
    if (this.instances.get(id)?.awaitingCreated) {
      logger.log(`[PtyManager] stale exit ignored id=${id} (server has not confirmed the new PTY yet)`)
      return
    }
    this.instances.delete(id)
    this.replayBuffers.delete(id)
    this.notifyPtyExit(id)
    this.broadcast('pty:exit', id, exitCode)
  }

  /**
   * T0390: exit of a directly spawned process. When the id already belongs to a newer
   * process (restart = kill + create with the same id), the late exit of the old one must
   * neither delete the new entry nor tell the renderer that the new terminal exited.
   */
  private handleDirectExit(id: string, proc: unknown, exitCode: number): void {
    const current = this.instances.get(id)
    if (current && current.process !== proc) {
      logger.log(`[PtyManager] stale exit ignored id=${id} (replaced by a newer process)`)
      return
    }
    this.instances.delete(id)
    this.replayBuffers.delete(id)
    this.notifyPtyExit(id)
    this.broadcast('pty:exit', id, exitCode)
  }

  /** T0432: `deps.onPtyExit`; a throwing listener must not break exit / kill handling. */
  private notifyPtyExit(id: string): void {
    if (!this.deps.onPtyExit) return
    try {
      this.deps.onPtyExit(id)
    } catch (e) {
      logger.warn(`[PtyManager] onPtyExit listener failed id=${id}:`, e)
    }
  }

  private broadcast(channel: string, ...args: unknown[]) {
    this.deps.emit(channel, ...args)
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
      // T0403: after the broadcast, same tick — pty:get-buffer can never return output that
      // has not been broadcast yet. A late flush for an id that already exited is dropped.
      if (this.instances.has(id)) this.appendToReplayBuffer(id, data)
    }
    this.outputBuffers.clear()
  }

  /** T0403: append raw output to the PTY's replay buffer, trimming past the cap. */
  private appendToReplayBuffer(id: string, data: string) {
    const prev = this.replayBuffers.get(id)
    let buf = (prev?.data ?? '') + data
    if (buf.length > REPLAY_BUFFER_MAX_CHARS + REPLAY_BUFFER_TRIM_SLACK) {
      buf = trimReplayBuffer(buf, REPLAY_BUFFER_MAX_CHARS)
    }
    this.replayBuffers.set(id, { data: buf, total: (prev?.total ?? 0) + data.length })
  }

  /**
   * T0403: `pty:get-buffer` — the PTY's recent raw output for replay into a terminal view
   * that missed it (renderer reload, BAT reopened). Null when the id has no running PTY.
   * Returned to the caller only; never broadcast.
   */
  getReplayBuffer(id: string): PtyReplayBuffer | null {
    if (!this.instances.has(id)) return null
    const buf = this.replayBuffers.get(id)
    return buf ? { data: buf.data, total: buf.total } : { data: '', total: 0 }
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

  /**
   * T0403: `pty:create` with whether a process was actually spawned. `created: false` = the
   * id was already running (idempotent re-create, T0111 / T0390) and was left untouched.
   * Throws `PtyLimitError` over the cap; the `pty:create` handler turns it into result
   * fields (T0424).
   */
  createWithResult(options: CreatePtyOptions): PtyCreateResult {
    const existed = this.instances.has(options.id)
    const ok = this.create(options)
    return { ok, created: ok && !existed }
  }

  create(options: CreatePtyOptions): boolean {
    const { id, cwd, type, shell: shellOverride, customEnv = {}, workspaceId, agentPreset } = options
    // T0404: a re-sent create for a running id stays idempotent below; only new ids count.
    const limit = this.deps.maxInstances
    if (limit && limit > 0 && !this.instances.has(id) && this.instances.size >= limit) {
      logger.warn(`[PtyManager] pty:create REFUSED id=${id} — PTY limit reached (${this.instances.size}/${limit})`)
      throw new PtyLimitError(limit)
    }
    const updateGuardEnv = claudeCliUpdateGuardEnv(agentPreset)

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
      const helperEnv = this.helperEnvFor(id, customEnv)
      const envWithUtf8 = {
        ...this.inheritedEnv() as Record<string, string>,
        ...customEnv,
        // BUG-102 (T0398): per-platform UTF-8 locale; customEnv LANG / LC_* win
        ...this.localeEnv(customEnv),
        PYTHONIOENCODING: 'utf-8',
        PYTHONUTF8: '1',
        TERM: 'xterm-256color',
        COLORTERM: 'truecolor',
        TERM_PROGRAM: 'better-agent-terminal',
        TERM_PROGRAM_VERSION: '1.0',
        BAT_SESSION: '1',
        // BUG-059: prevent embedded claude self-rename + global npm install which orphans app.asar.unpacked binary
        DISABLE_AUTOUPDATER: '1',
        // T0372: embedded claude-cli preset only (DISABLE_UPDATES=1)
        ...updateGuardEnv,
        // T0133: Each PTY knows its own terminal ID (for Worker→Tower auto-notify)
        BAT_TERMINAL_ID: id,
        // T0176: Each PTY knows its own workspace ID (for Worker cwd routing)
        BAT_WORKSPACE_ID: workspaceId ?? '',
        // T0140: Absolute path to helper scripts (bat-terminal.mjs, bat-notify.mjs).
        // Dev: <project-root>/scripts, packaged: <install-root>/resources/scripts.
        ...this.helperDirEnv(),
        FORCE_COLOR: '3',
        CLAUDE_CODE_NO_FLICKER: '1',
        CI: '',
        ...(remoteInfo ? { BAT_REMOTE_PORT: String(remoteInfo.port), BAT_REMOTE_TOKEN: remoteInfo.token } : {}),
        // T0433: host helper env (headless: per-PTY capability), last so nothing overrides it
        ...helperEnv,
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
      this.instances.set(id, { process: null, type, cwd, usePty: true, shell, shellArgs: args, awaitingCreated: true })
      logger.log(`[PtyManager] pty:create ${id} → Terminal Server`)
      return true
    }

    // T0390: direct mode is idempotent too. A renderer reload / remote reconnect re-sends
    // pty:create with the same id; spawning again would orphan the running shell (its output
    // keeps arriving under the same id) and the old exit would later delete the new entry.
    if (this.instances.has(id)) {
      logger.log(`[PtyManager] pty:create SKIP (idempotent, direct) id=${id} — already running`)
      return true
    }

    // Fallback: direct PTY spawn (node-pty or child_process)
    let usedPty = false
    // T0433: once per spawned PTY (the child_process fallback reuses it)
    const helperEnv = this.helperEnvFor(id, customEnv)

    if (ptyAvailable && pty) {
      try {
        // Set UTF-8 and terminal environment variables, merge custom env
        // T0129: Inject RemoteServer port/token so PTY children can connect back via WebSocket
        const remoteInfoLocal = this.getRemoteServerInfo?.() ?? null
        const envWithUtf8 = {
          ...this.inheritedEnv(),
          ...customEnv,  // Merge custom environment variables
          // UTF-8 encoding (BUG-102 / T0398: per-platform locale; customEnv LANG / LC_* win)
          ...this.localeEnv(customEnv),
          PYTHONIOENCODING: 'utf-8',
          PYTHONUTF8: '1',
          // Terminal capabilities - let apps know we are a real PTY
          TERM: 'xterm-256color',
          COLORTERM: 'truecolor',
          TERM_PROGRAM: 'better-agent-terminal',
          TERM_PROGRAM_VERSION: '1.0',
          // BAT session identification (for Control Tower auto-session detection)
          BAT_SESSION: '1',
          // BUG-059: prevent embedded claude self-rename + global npm install which orphans app.asar.unpacked binary
          DISABLE_AUTOUPDATER: '1',
          // T0372: embedded claude-cli preset only (DISABLE_UPDATES=1)
          ...updateGuardEnv,
          // T0133: Each PTY knows its own terminal ID (for Worker→Tower auto-notify)
          BAT_TERMINAL_ID: id,
          // T0176: Each PTY knows its own workspace ID (for Worker cwd routing)
          BAT_WORKSPACE_ID: workspaceId ?? '',
          // T0140: Absolute path to helper scripts (bat-terminal.mjs, bat-notify.mjs).
          ...this.helperDirEnv(),
          // Force color output
          FORCE_COLOR: '3',
          // Suppress ED2-induced viewport flicker in Claude Code streaming
          // (xterm.js issue #5801: ED2 inside DEC 2026 sync blocks resets viewportY)
          CLAUDE_CODE_NO_FLICKER: '1',
          // Ensure not detected as CI environment
          CI: '',
          // T0129: RemoteServer connection info for CLI tools
          ...(remoteInfoLocal ? { BAT_REMOTE_PORT: String(remoteInfoLocal.port), BAT_REMOTE_TOKEN: remoteInfoLocal.token } : {}),
          // T0433: host helper env (headless: per-PTY capability), last so nothing overrides it
          ...helperEnv,
        }

        // BUG-038: strip ELECTRON_RUN_AS_NODE so `npm run dev` / `npx electron .` inside BAT
        // terminals don't inherit Node-only mode from the Claude SDK fallback (claude-agent-manager.ts:511,1233).
        delete (envWithUtf8 as Record<string, string | undefined>).ELECTRON_RUN_AS_NODE

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
          this.handleDirectExit(id, ptyProcess, exitCode)
        })

        this.instances.set(id, { process: ptyProcess, type, cwd, usePty: true, customEnv })
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
          ...this.inheritedEnv(),
          ...customEnv,  // Merge custom environment variables
          // UTF-8 encoding (BUG-102 / T0398: per-platform locale; customEnv LANG / LC_* win)
          ...this.localeEnv(customEnv),
          PYTHONIOENCODING: 'utf-8',
          PYTHONUTF8: '1',
          // Terminal capabilities (limited in child_process mode)
          TERM: 'xterm-256color',
          COLORTERM: 'truecolor',
          TERM_PROGRAM: 'better-agent-terminal',
          TERM_PROGRAM_VERSION: '1.0',
          // BAT session identification (for Control Tower auto-session detection)
          BAT_SESSION: '1',
          // BUG-059: prevent embedded claude self-rename + global npm install which orphans app.asar.unpacked binary
          DISABLE_AUTOUPDATER: '1',
          // T0372: embedded claude-cli preset only (DISABLE_UPDATES=1)
          ...updateGuardEnv,
          // T0133: Each PTY knows its own terminal ID (for Worker→Tower auto-notify)
          BAT_TERMINAL_ID: id,
          // T0176: Each PTY knows its own workspace ID (for Worker cwd routing)
          BAT_WORKSPACE_ID: workspaceId ?? '',
          // T0140: Absolute path to helper scripts (bat-terminal.mjs, bat-notify.mjs).
          ...this.helperDirEnv(),
          FORCE_COLOR: '3',
          CI: '',
          // T0129: RemoteServer connection info for CLI tools
          ...(remoteInfoFallback ? { BAT_REMOTE_PORT: String(remoteInfoFallback.port), BAT_REMOTE_TOKEN: remoteInfoFallback.token } : {}),
          // T0433: host helper env (headless: per-PTY capability), last so nothing overrides it
          ...helperEnv,
        }

        // BUG-038: strip ELECTRON_RUN_AS_NODE (same rationale as node-pty branch above).
        delete (envWithUtf8 as Record<string, string | undefined>).ELECTRON_RUN_AS_NODE

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
          this.handleDirectExit(id, childProcess, exitCode ?? 0)
        })

        childProcess.on('error', (error) => {
          logger.error('Child process error:', error)
          this.broadcast('pty:output', id, `\r\n[Error: ${error.message}]\r\n`)
        })

        // Send initial message
        this.broadcast('pty:output', id, `[Terminal - child_process mode]\r\n`)

        this.instances.set(id, { process: childProcess, type, cwd, usePty: false, customEnv })
        logger.log('Created terminal using child_process fallback')
      } catch (error) {
        logger.error('Failed to create terminal:', error)
        // T0433: nothing was spawned — revoke what `helperEnv` issued for it
        this.notifyPtyExit(id)
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

  /**
   * T0215 (BUG-050 階段 1) — pty:write 顯性化錯誤回傳路徑。
   * 與舊 `write()` 併存:舊 write 供內部 caller(fire-and-forget、void return),
   * 本方法供 RemoteServer invoke 鏈回傳 `{ ok, reason }`,讓 bat-notify 可據以 exit 1。
   *
   * 覆蓋 T0214 silent drop 條件 #1/#3/#4/#5/#8/#9。useServer 分支樂觀回 ok(reason=queued),
   * refork race(條件 #2/#6/#7)留給 PLAN-024 階段 2 的 correlation id 方案。
   */
  writeWithResult(id: string, data: string): { ok: boolean; reason?: string } {
    // Manager-level check
    if (!this.instances.has(id)) {
      return { ok: false, reason: 'pty-not-found' }
    }

    // useServer 分支:fire-and-forget,樂觀回 ok。
    // 本分支無法真正保證 terminal-server 寫入成功(refork race),為階段 2 技術債。
    if (this.useServer) {
      this.sendToServer({ type: 'pty:write', id, data })
      return { ok: true, reason: 'queued' }
    }

    const instance = this.instances.get(id)!
    if (instance.usePty) {
      try {
        instance.process.write(data)
        return { ok: true }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e)
        return { ok: false, reason: `pty-write-threw:${msg}` }
      }
    }

    // 非 usePty(child_process)分支
    const cp = instance.process as ChildProcess
    if (!cp?.stdin) {
      return { ok: false, reason: 'stdin-missing' }
    }
    cp.stdin.write(data)
    return { ok: true }
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
      this.replayBuffers.delete(id)
      this.notifyPtyExit(id)
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
      this.replayBuffers.delete(id)
      this.notifyPtyExit(id)
      return true
    }
    return false
  }

  /** T0404: kill every PTY this manager runs; returns how many were killed. */
  killAll(): number {
    let killed = 0
    for (const id of [...this.instances.keys()]) {
      if (this.kill(id)) killed++
    }
    return killed
  }

  /**
   * Kill + create with the same id. T0448 (T0445 #4): with `deps.helperEnv` (headless) the new
   * process gets the old one's `customEnv`, so its helper capability keeps the same role and
   * tower binding (the kill revokes the old token; `helperEnv` issues the new one). Without it
   * (Electron) the env is rebuilt from scratch, as before.
   */
  restart(id: string, cwd: string, shell?: string): boolean {
    const instance = this.instances.get(id)
    if (instance) {
      const type = instance.type
      const customEnv = this.deps.helperEnv && instance.customEnv ? { ...instance.customEnv } : undefined
      this.kill(id)
      return this.create({ id, cwd, type, shell, ...(customEnv ? { customEnv } : {}) })
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
      // T0150 (BUG-035): defense-in-depth — beginShutdown() already clears the
      // timer, but if a tick races with shutdown, swallow it here too.
      if (this.isShuttingDown) return
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

  /**
   * T0150 (BUG-035): mark PtyManager as intentionally shutting down so the
   * heartbeat watchdog skips re-fork on the upcoming TCP close / IPC exit.
   *
   * Called by main.ts `stopTerminalServerGracefully()` BEFORE any kill action.
   * Idempotent. The flag is never reset because the process is about to exit.
   */
  beginShutdown(): void {
    if (this.isShuttingDown) return
    this.isShuttingDown = true
    // Also stop the heartbeat timer so the next tick cannot race with shutdown.
    this.stopHeartbeat()
    logger.log('[PtyManager] beginShutdown() — watchdog disarmed')
  }

  /** Attempt to recover from Terminal Server death: re-fork + rebuild all PTYs (T0112). */
  private async handleServerDeath(): Promise<void> {
    // T0150 (BUG-035): defense-in-depth guard at the recovery entry. All four
    // call sites already check isShuttingDown, but if a future caller forgets,
    // this prevents the orphan re-fork regression from coming back.
    if (this.isShuttingDown) {
      logger.log('[PtyManager] handleServerDeath called during shutdown — skip re-fork')
      return
    }
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
        const userDataPath = this.deps.dataDir
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
      // T0149 (BUG-034 bonus): destroy the TCP socket so the event loop can exit.
      // A refed TCP socket keeps main's event loop alive, which on Windows leaves
      // the crashpad-handler and main process lingering after quit.
      try {
        if (this.tcpSocket && !this.tcpSocket.destroyed) {
          this.tcpSocket.destroy()
        }
      } catch { /* best-effort */ }
      this.tcpSocket = null
      this.serverProcess = null
      this.instances.clear()
      this.replayBuffers.clear()
      return
    }
    for (const [id] of this.instances) {
      this.kill(id)
    }
  }
}
