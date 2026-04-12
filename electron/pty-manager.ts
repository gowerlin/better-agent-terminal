import { BrowserWindow } from 'electron'
import { spawn, ChildProcess } from 'child_process'
import type { CreatePtyOptions } from '../src/types'
import { broadcastHub } from './remote/broadcast-hub'
import { logger } from './logger'

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
  process: any // IPty or ChildProcess
  type: 'terminal'  // Unified to 'terminal' - agent types handled by agentPreset
  cwd: string
  usePty: boolean
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

  constructor(getWindows: () => BrowserWindow[]) {
    this.getWindows = getWindows
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

    // Try node-pty first, fallback to child_process if it fails
    let usedPty = false

    if (ptyAvailable && pty) {
      try {
        // Set UTF-8 and terminal environment variables, merge custom env
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
          CI: ''
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
          CI: ''
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
    const instance = this.instances.get(id)
    if (instance && instance.usePty) {
      instance.process.resize(cols, rows)
    }
  }

  kill(id: string): boolean {
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

  dispose(): void {
    for (const [id] of this.instances) {
      this.kill(id)
    }
  }
}
