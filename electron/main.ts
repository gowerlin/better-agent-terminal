import { app, BrowserWindow, ipcMain, dialog, shell, Menu, Tray, powerMonitor, clipboard, nativeImage, crashReporter, Notification } from 'electron'
import path from 'path'
import { pathToFileURL } from 'url'
import * as fs from 'fs/promises'
import * as fsSync from 'fs'
import { execFileSync, spawnSync, fork } from 'child_process'
import { WindowRegistry } from './window-registry'
import { createAgentPromptCommandBuilder } from './terminal-command-handlers'
import { createTerminalWindowEmit, registerTerminalHandlers } from './handlers/terminal'
import { registerPtyHandlers } from './handlers/pty'
import { registerClaudeHandlers } from './handlers/claude'
import { registerGitHandlers } from './handlers/git'
import { registerFsHandlers } from './handlers/fs'
import { detectRemoteToolsForProfile, registerRemoteToolsHandlers, runRemoteToolsDetect } from './handlers/remote-tools'
import { createRemoteToolInstallIpc, PendingRemoteToolInstalls } from '../src/lib/remote-tools/install-request'

// Fix PATH for GUI-launched apps on macOS.
// When launched via .dmg / Applications, macOS gives a minimal PATH that
// doesn't include Homebrew (/opt/homebrew/bin), NVM, etc.
// We source the user's login shell to get the real PATH.
if (process.platform === 'darwin') {
  try {
    const shell = process.env.SHELL || '/bin/zsh'
    // fish stores PATH as a list; use string join to get colon-separated output
    const isFish = shell.endsWith('/fish') || shell === 'fish'
    const cmd = isFish ? 'string join : $PATH' : 'echo $PATH'
    const rawPath = execFileSync(shell, ['-l', '-c', cmd], {
      timeout: 3000,
      encoding: 'utf8',
      windowsHide: true,
    }).trim()
    if (rawPath) {
      process.env.PATH = rawPath
    }
  } catch {
    // Fallback: prepend the most common node locations
    const extraPaths = [
      '/opt/homebrew/bin',
      '/usr/local/bin',
      `${process.env.HOME}/.volta/bin`,
    ]
    // Resolve nvm: find the latest installed version's bin directory.
    // NOTE: This intentionally duplicates the semver sort from node-resolver.ts
    // because this code runs at the top level before any ES module imports,
    // and importing node-resolver here would break the PATH fix ordering.
    try {
      const nvmDir = `${process.env.HOME}/.nvm/versions/node`
      const versions = fsSync.readdirSync(nvmDir).filter((v: string) => v.startsWith('v'))
      if (versions.length > 0) {
        versions.sort((a: string, b: string) => {
          const pa = a.replace(/^v/, '').split('.').map(Number)
          const pb = b.replace(/^v/, '').split('.').map(Number)
          for (let i = 0; i < 3; i++) { const d = (pa[i]||0) - (pb[i]||0); if (d !== 0) return d; }
          return 0
        })
        extraPaths.push(`${nvmDir}/${versions[versions.length - 1]}/bin`)
      }
    } catch { /* nvm not installed */ }
    process.env.PATH = `${extraPaths.join(':')}:${process.env.PATH || ''}`
  }
}

// Hide the console window on Windows.
// electron.exe is a console-subsystem app, so Windows allocates a visible
// console window. We call ShowWindow(GetConsoleWindow(), SW_HIDE) via
// PowerShell P/Invoke to hide it. This only affects dev mode — the packaged
// app uses the GUI subsystem and has no console.
if (process.platform === 'win32') {
  try {
    spawnSync('powershell', [
      '-NoProfile', '-NonInteractive', '-Command',
      "Add-Type -N W -M '[DllImport(\"user32.dll\")]public static extern bool ShowWindow(IntPtr h,int s);[DllImport(\"kernel32.dll\")]public static extern IntPtr GetConsoleWindow();' -Pa;[W]::ShowWindow([W]::GetConsoleWindow(),0)"
    ], { windowsHide: true, timeout: 5000, stdio: 'ignore' })
  } catch { /* ignore — console stays visible */ }
}

import { PtyManager, createWindowBroadcastEmit, type PtyManagerDeps } from './pty-manager'
import { configureRuntimeRouter } from './claude-runtime-router'
import { ClaudeAgentManager, createElectronClaudeEmit, createElectronNotifier, type ClaudeAgentManagerDeps } from './claude-agent-manager'
import { CodexAgentManager } from './codex-agent-manager'
import { checkForUpdates, UpdateCheckResult } from './update-checker'
import { clipboardImageToDataUrl, readSelectedAttachments } from './image-attachments'
import { snippetDb, CreateSnippetInput } from './snippet-db'
import { ProfileManager, type ProfileEntry, type ProfileSnapshot } from './profile-manager'
import { registerHandler, invokeHandler } from './remote/handler-registry'
import { broadcastHub } from './remote/broadcast-hub'
import { PROXIED_CHANNELS } from './remote/protocol'
import { ALWAYS_LOCAL_CHANNELS } from './remote/headless-channel-status'
import { isHeadlessScrubbedEnvKey } from './remote/headless-entry'
import { RemoteServer } from './remote/remote-server'
import { RemoteClient, collectWorkspaceRoots, shouldSyncWorkspaceRoots } from './remote/remote-client'
import { clientPathTranslatorForProfile, IdentityTranslator, resolveClientPaths, type PathTranslator } from './remote/path-translator'
import { describeSameTargetWarning, detachedSenderRouteIdentity, formatRemoteNotConnectedError, planProfileProxiedInvokeRoute, planProfileStatusPushes, REMOTE_CLIENT_STATUS_CHANGED_CHANNEL, REMOTE_INVOKE_REFUSED_CHANNEL, REMOTE_NOT_CONNECTED, resolveDetachedProfileBinding, senderBindingProfileId, shouldDropProfileConnectionOnUpdate, type DetachedWindowRecord, type SenderProfileBinding } from './remote/remote-connect-plan'
import { collectProfileWindows, DISCONNECT_ALL_TIMEOUT_MS, IDLE_GRACE_MS, RemoteConnectionRegistry, settleWithin } from './remote/remote-connection-registry'
import {
  classifyConnectFailure,
  classifyInvokeFailure,
  describeRemoteProfileFailure,
  type RemoteProfileFailure,
} from './remote/remote-profile-error'
import { getConnectionInfo } from './remote/tunnel-manager'
import { closeAllSshWizardTunnels, registerSshSetupHandlers } from './remote/ssh-setup-handlers'
import { logger, type LogLevel } from './logger'
import { isServerRunning, readPidFile, readPortFile, removePidFile, removePortFile } from './terminal-server/pid-manager'
import { readRegistry, clearRegistry } from './terminal-server/pty-registry'
import { agentRegistry } from './agent-runtime/agent-registry'
import { getWindowsElevation } from './windows-elevation'
import { installNavigationGuards } from './navigation-guard'
import { buildExecutableConfirmDialog, EXECUTABLE_CONFIRM_OPEN_INDEX, handleOpenExternal, handleOpenPath } from './open-external-guard'
import type { CustomCliDefinition } from './agent-runtime/types'
import { registerVoiceHandlers } from './voice-handler'
import {
  logDrift as ctDriftLog,
  readRecentDrift as ctDriftReadRecent,
  type DriftEntry as CtDriftEntry,
} from './ct-drift-telemetry'
import type { ParseWarning as CtParseWarning } from '../src/utils/ct-frontmatter'
import * as dockerDetect from './docker-detect'
import * as dockerLifecycle from './docker-lifecycle'
import * as dockerValidate from './docker-validate'
import * as wslDetect from './wsl-detect'
import * as wslSystemd from './wsl-systemd'
import { WslKeepAlive } from './wsl-keepalive'
import { createWslFolderDefaultResolver, wslDistroForFolderDialog } from './wsl-workspace-folder'
import { fetchTlsFingerprint, type FetchFingerprintResult } from './tls-fingerprint'
import {
  isPathAllowed,
  rebuildWorkspaceAllowlist,
} from './path-guard'
import * as net from 'net'

// Startup timing — capture module load time before anything else
const _processStart = Number(process.env._BAT_T0 || Date.now())
console.log(`[startup] main.ts module loaded: +${Date.now() - _processStart}ms from process start`)

// Global error handlers — prevent silent crashes in main process
process.on('uncaughtException', (error: NodeJS.ErrnoException) => {
  // EPIPE errors are expected when writing to pipes of killed subprocesses (e.g. Claude agent)
  // They are harmless and should not pollute logs.
  if (error.code === 'EPIPE') return
  logger.error(`[CRASH] uncaughtException: ${error.stack || error.message}`)
})
process.on('unhandledRejection', (reason) => {
  logger.error(`[CRASH] unhandledRejection: ${reason instanceof Error ? reason.stack || reason.message : String(reason)}`)
})

// GPU disk cache: set dedicated path to avoid "Unable to move the cache" errors on Windows.
// These errors block GPU compositing and can add seconds to first paint.
app.commandLine.appendSwitch('gpu-disk-cache-dir', path.join(app.getPath('temp'), 'bat-gpu-cache'))
// Disable GPU shader disk cache (another source of "Unable to create cache" errors)
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache')

// Disable Service Workers — we don't use them, and a corrupted SW database
// causes Chromium to block the renderer for 4+ seconds on Windows during I/O recovery.
app.commandLine.appendSwitch('disable-features', 'ServiceWorker')

// Set app name (shown in dock/taskbar instead of "Electron" during dev)
app.setName('BetterAgentTerminal')

// --runtime=N or BAT_RUNTIME=N: allow multiple independent instances with separate data directories
// Each runtime gets its own user data path and single-instance lock
// CLI arg takes precedence over env var; env var works reliably in dev mode (vite-plugin-electron)
const runtimeArg = process.argv.find(a => a.startsWith('--runtime='))
const runtimeId = runtimeArg ? runtimeArg.split('=')[1] : (process.env.BAT_RUNTIME || undefined)
if (runtimeId) {
  const basePath = app.getPath('userData')
  const runtimePath = path.join(path.dirname(basePath), `${path.basename(basePath)}-runtime-${runtimeId}`)
  app.setPath('userData', runtimePath)
  console.log(`[runtime] BAT_RUNTIME=${runtimeId}, userData=${runtimePath}`)
} else {
  console.log(`[runtime] default instance, userData=${app.getPath('userData')}`)
}

// PLAN-036 T0389: claude-runtime-router no longer imports electron — wire the
// settings directory (userData) and embedded install layout from the host.
configureRuntimeRouter({
  getDataDir: () => app.getPath('userData'),
  getEmbeddedLayout: () => app.isPackaged
    ? { kind: 'electron-packaged', resourcesPath: process.resourcesPath }
    : { kind: 'node-modules' },
})

// Set AppUserModelId for Windows taskbar pinning (must be before app.whenReady)
if (process.platform === 'win32') {
  const appModelId = runtimeId
    ? `org.tonyq.better-agent-terminal.runtime-${runtimeId}`
    : 'org.tonyq.better-agent-terminal'
  app.setAppUserModelId(appModelId)

  // Fix Start Menu shortcut AppUserModelId for Windows notifications (issue #77).
  // NSIS installer may not embed the AppUserModelId into the .lnk, causing Windows
  // to silently drop all toast notifications. Patch it at startup if needed.
  if (!runtimeId) {
    try {
      const shortcutPath = path.join(
        app.getPath('appData'),
        'Microsoft', 'Windows', 'Start Menu', 'Programs', 'BetterAgentTerminal.lnk'
      )
      if (fsSync.existsSync(shortcutPath)) {
        const shortcut = shell.readShortcutLink(shortcutPath)
        if (shortcut.appUserModelId !== appModelId) {
          shell.writeShortcutLink(shortcutPath, 'update', { appUserModelId: appModelId })
        }
      }
    } catch { /* non-critical — notification may not work but app still runs */ }
  }
}

// Single instance lock — if a second instance is launched, focus existing and open new window
// Each --runtime=N has its own lock (via separate userData path)
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  // Another instance with the same runtime is already running
  app.quit()
}

const windowMap = new Map<string, BrowserWindow>() // windowId → BrowserWindow

// Terminal Server (PLAN-008 Phase 2) — independent process managing PTYs
// Started once at app launch; intentionally outlives the BAT main process.
// IPC reference is kept so PtyManager can proxy PTY operations to the server.
let _terminalServerStarted = false
let _terminalServerProcess: import('child_process').ChildProcess | null = null
// T0110: Stores pending recovery state when BAT restarts and finds live PTYs
let pendingRecovery: { port: number; ptyCount: number } | null = null

/**
 * Probe a running Terminal Server to count how many PTY processes are alive.
 * Opens a temporary TCP connection, sends pty:list, and returns the count.
 * Times out after 3 seconds and returns 0 on failure.
 */
async function probeServerPtyCount(port: number): Promise<number> {
  return new Promise((resolve) => {
    const socket = new net.Socket()
    let lineBuffer = ''
    let resolved = false

    const done = (count: number) => {
      if (resolved) return
      resolved = true
      clearTimeout(timer)
      socket.destroy()
      resolve(count)
    }

    const timer = setTimeout(() => done(0), 3000)

    socket.connect(port, '127.0.0.1', () => {
      socket.write(JSON.stringify({ type: 'pty:list' }) + '\n')
    })

    socket.on('data', (chunk: Buffer) => {
      lineBuffer += chunk.toString()
      const lines = lineBuffer.split('\n')
      lineBuffer = lines.pop()!
      for (const line of lines) {
        if (!line.trim()) continue
        try {
          const msg = JSON.parse(line) as { type: string; ptys?: unknown[] }
          if (msg.type === 'pty:list' && Array.isArray(msg.ptys)) {
            done(msg.ptys.length)
          }
        } catch { /* ignore malformed JSON */ }
      }
    })

    socket.on('error', () => done(0))
    socket.on('close', () => done(0))
  })
}

/**
 * Send a server:shutdown command to a running Terminal Server via TCP.
 * Used when the user chooses "fresh start" in the recovery prompt.
 */
async function sendShutdownToServer(port: number): Promise<void> {
  return new Promise((resolve) => {
    const socket = new net.Socket()
    socket.setTimeout(2000)
    socket.connect(port, '127.0.0.1', () => {
      socket.write(JSON.stringify({ type: 'server:shutdown' }) + '\n')
      socket.setTimeout(500)
    })
    socket.on('close', resolve)
    socket.on('error', resolve)
    socket.on('timeout', () => { socket.destroy(); resolve() })
  })
}

/**
 * Fork the Terminal Server as a detached child process.
 * The server manages PTY instances independently and survives BAT restarts.
 * It shuts itself down after 30 minutes of idle (no parent connection).
 *
 * NOTE (packaging): dist-electron/terminal-server.js must NOT be inside the
 * ASAR archive for fork() to work in the packaged app. Add it to asarUnpack
 * in electron-builder config before releasing.
 */
async function startTerminalServer(): Promise<void> {
  if (_terminalServerStarted) return
  _terminalServerStarted = true

  const userDataPath = app.getPath('userData')

  // Orphan cleanup: PID file exists but process is already dead — clean up stale files
  const orphanPid = readPidFile(userDataPath)
  if (orphanPid !== null && !isServerRunning(userDataPath)) {
    logger.log(`[terminal-server] orphan PID ${orphanPid} detected — cleaning up stale files`)
    try { process.kill(orphanPid, 'SIGTERM') } catch { /* process already gone */ }

    // T0113: Kill orphan PTY processes tracked in registry
    const registry = readRegistry(userDataPath)
    if (registry?.ptys.length) {
      for (const entry of registry.ptys) {
        try { process.kill(entry.pid, 'SIGTERM') } catch { /* already dead */ }
        if (process.platform === 'win32') {
          try {
            require('child_process').execFileSync('taskkill', ['/F', '/T', '/PID', String(entry.pid)], { stdio: 'ignore' })
          } catch { /* ignore */ }
        }
      }
      logger.log(`[terminal-server] Cleaned ${registry.ptys.length} orphan PTY process(es) from registry`)
    }
    clearRegistry(userDataPath)

    removePidFile(userDataPath)
    removePortFile(userDataPath)
  }

  if (isServerRunning(userDataPath)) {
    const port = readPortFile(userDataPath)
    if (port) {
      // T0110: Probe PTY count first — if there are live terminals, defer to user
      const ptyCount = await probeServerPtyCount(port)
      if (ptyCount > 0) {
        pendingRecovery = { port, ptyCount }
        logger.log(`[terminal-server] ${ptyCount} live PTYs detected — deferring to user recovery decision`)
        return  // Recovery prompt will handle reconnect or fresh-start
      }
      // Server alive but no PTYs — T0108: try silent reconnect
      if (ptyManager) {
        const connected = await ptyManager.connectToServer(port)
        if (connected) {
          logger.log(`[terminal-server] reconnected to existing server on port ${port}`)
          // Request PTY list — handleReplayList will fetch and replay buffers
          ptyManager.sendToServer({ type: 'pty:list' })
          return
        }
        logger.warn('[terminal-server] PID alive but TCP connect failed — stale server, restarting')
      } else {
        logger.log('[terminal-server] existing server detected but ptyManager not ready — skipping fork')
        return
      }
    } else {
      logger.warn('[terminal-server] existing server has no port file — skipping reconnect, restarting')
    }
    // Stale server: clean up files and fall through to fork a fresh one
    removePidFile(userDataPath)
    removePortFile(userDataPath)
  }

  const serverScript = path.join(__dirname, 'terminal-server.js')

  if (!fsSync.existsSync(serverScript)) {
    logger.warn(`[terminal-server] server script not found: ${serverScript} — skipping (expected in prod build)`)
    return
  }

  try {
    // Read Terminal Server config from settings.json (T0109)
    const tsSettings = readPersistedSettingsSync()
    const scrollBufferLines = tsSettings?.terminalServerScrollBufferLines ?? 1000
    const idleTimeoutMinutes = tsSettings?.terminalServerIdleTimeoutMinutes ?? 30

    const child = fork(serverScript, [], {
      detached: true,
      stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
      env: {
        ...process.env,
        BAT_USER_DATA: userDataPath,
        BAT_SCROLL_BUFFER_LINES: String(scrollBufferLines),
        BAT_IDLE_TIMEOUT_MS: String(idleTimeoutMinutes * 60000),
      },
    })

    child.on('error', (err) => {
      logger.error(`[terminal-server] fork error: ${err}`)
    })

    logger.log(`[terminal-server] started with pid ${child.pid}`)

    // Keep IPC reference so PtyManager can proxy PTY operations
    _terminalServerProcess = child

    // Connect PtyManager IPC immediately (ptyManager is guaranteed created before this call)
    if (ptyManager) {
      ptyManager.setServerProcess(child)
    }

    // Allow BAT main process to exit while server keeps running
    child.unref()
  } catch (err) {
    logger.error(`[terminal-server] failed to fork: ${err}`)
  }
}

/**
 * Re-fork a Terminal Server after a crash (T0112 heartbeat recovery).
 * Resets the startup guard so startTerminalServer() can run again, then
 * forks a fresh server and returns its ChildProcess.
 */
async function reforkTerminalServer(): Promise<import('child_process').ChildProcess | null> {
  logger.log('[terminal-server] re-forking after heartbeat-detected crash...')
  _terminalServerStarted = false
  _terminalServerProcess = null

  const userDataPath = app.getPath('userData')
  removePidFile(userDataPath)
  removePortFile(userDataPath)

  const serverScript = path.join(__dirname, 'terminal-server.js')
  if (!fsSync.existsSync(serverScript)) {
    logger.error('[terminal-server] re-fork: server script not found — cannot recover')
    return null
  }

  try {
    const tsSettings = readPersistedSettingsSync()
    const scrollBufferLines = tsSettings?.terminalServerScrollBufferLines ?? 1000
    const idleTimeoutMinutes = tsSettings?.terminalServerIdleTimeoutMinutes ?? 30

    const child = fork(serverScript, [], {
      detached: true,
      stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
      env: {
        ...process.env,
        BAT_USER_DATA: userDataPath,
        BAT_SCROLL_BUFFER_LINES: String(scrollBufferLines),
        BAT_IDLE_TIMEOUT_MS: String(idleTimeoutMinutes * 60000),
      },
    })

    child.on('error', (err) => {
      logger.error(`[terminal-server] re-fork error: ${err}`)
    })

    _terminalServerStarted = true
    _terminalServerProcess = child
    logger.log(`[terminal-server] re-forked with pid ${child.pid}`)
    child.unref()
    return child
  } catch (err) {
    logger.error(`[terminal-server] re-fork failed: ${err}`)
    return null
  }
}

let ptyManager: PtyManager | null = null
let claudeManager: ClaudeAgentManager | null = null
let codexManager: CodexAgentManager | null = null
const sessionManagerMap = new Map<string, 'claude' | 'codex'>()
let updateCheckResult: UpdateCheckResult | null = null
const profileManager = new ProfileManager()
// T0384 (BUG-092, D128): one long-lived `wsl.exe` per WSL profile distro so
// WSL does not idle-stop it (and bat-server with it) while BAT runs.
const wslKeepAlive = new WslKeepAlive()
const remoteServer = new RemoteServer()
// T0463 (PLAN-039): one RemoteClient per remote profile — replaces the single
// module-level slot, so opening a second remote profile no longer pushes the
// first one out. Keyed by the bound profile id:
// - each profile's connect / pin change / disconnect is serialised on its own
//   mutex (PLAN-018 T0184, T0430, T0442); different profiles run in parallel
// - a client sends remote events only to its own profile's windows
//   (`getWindowsForProfile(profileId)`) — local-profile windows never see them
// - the entry records what its client was asked to connect to (pre-tunnel
//   host/port, token, observed fingerprint; T0419 reuse) — connectionInfo can't
//   serve: an SSH tunnel rewrites host/port to 127.0.0.1:<localPort>
// Every teardown goes through `client.disconnect()` (T0465 tunnel port claims).
const remoteConnections = new RemoteConnectionRegistry<RemoteClient, ProfileEntry>({
  createClient: (profileId, profile) => bindRemoteClient(new RemoteClient(() => getWindowsForProfile(profileId), profile), profileId),
  countLiveWindows: (profileId) => getWindowsForProfile(profileId).length,
  onReleased: (profileId, reason) => {
    logger.log(`[remote] released the connection of profile ${profileId} (${reason}: no window left)`)
    pushRemoteClientStatus(profileId)
  },
})
const detachedWindows = new Map<string, BrowserWindow>() // workspaceId → BrowserWindow
// T0446 (BUG-112): workspaceId → the detached window's parent and the profile binding it inherits.
const detachedWindowRecords = new Map<string, DetachedWindowRecord>()
let isAppQuitting = false // Distinguishes Cmd+Q (preserve) from Cmd+W (remove window)
let tray: Tray | null = null

interface PersistedSettings {
  minimizeToTray?: boolean
  enableDevTools?: boolean
  loggingEnabled?: boolean
  logLevel?: LogLevel
  terminalServerScrollBufferLines?: number
  terminalServerIdleTimeoutMinutes?: number
  language?: string
  remotePort?: number
  defaultAgent?: string
  agentCustomArgs?: Record<string, string>
  shell?: string
  customShellPath?: string
  githubCliPath?: string
}

const REMOTE_PORT_MIN = 1024
const REMOTE_PORT_MAX = 65535
const REMOTE_PORT_DEFAULT = 9876

/**
 * Resolve effective RemoteServer port at startup.
 * Priority: BAT_REMOTE_PORT env > settings.remotePort > default 9876.
 * Invalid values silently fall back to the next priority.
 */
function readRemotePortSync(): number {
  const envRaw = process.env.BAT_REMOTE_PORT
  if (envRaw) {
    const envPort = Number(envRaw)
    if (Number.isInteger(envPort) && envPort >= REMOTE_PORT_MIN && envPort <= REMOTE_PORT_MAX) {
      return envPort
    }
    logger.warn(`[settings] BAT_REMOTE_PORT="${envRaw}" out of range, ignoring`)
  }
  const persisted = readPersistedSettingsSync()?.remotePort
  if (persisted !== undefined) {
    if (Number.isInteger(persisted) && persisted >= REMOTE_PORT_MIN && persisted <= REMOTE_PORT_MAX) {
      return persisted
    }
    logger.warn(`[settings] settings.remotePort=${persisted} out of range, ignoring`)
  }
  return REMOTE_PORT_DEFAULT
}

function normalizeLogLevel(level: unknown): LogLevel {
  if (level === 'error' || level === 'warn' || level === 'info' || level === 'log' || level === 'debug') {
    return level
  }
  return 'debug'
}

function readPersistedSettingsSync(): PersistedSettings | null {
  try {
    const configPath = path.join(app.getPath('userData'), 'settings.json')
    const data = fsSync.readFileSync(configPath, 'utf-8')
    const parsed = JSON.parse(data) as PersistedSettings
    return parsed
  } catch {
    return null
  }
}

function readLoggingConfigSync(): { loggingEnabled: boolean; logLevel: LogLevel } {
  const parsed = readPersistedSettingsSync()
  return {
    loggingEnabled: parsed?.loggingEnabled !== false,
    logLevel: normalizeLogLevel(parsed?.logLevel),
  }
}

async function resolveWorkspaceDefaultAgent(workspaceId?: string): Promise<string | null> {
  if (!workspaceId) return null
  try {
    const entries = await windowRegistry.readAll()
    for (const entry of entries) {
      const workspaces = Array.isArray(entry.workspaces) ? entry.workspaces : []
      const workspace = workspaces.find((w: unknown) => {
        return typeof w === 'object' && w !== null && (w as { id?: unknown }).id === workspaceId
      }) as { defaultAgent?: unknown } | undefined
      if (typeof workspace?.defaultAgent === 'string' && workspace.defaultAgent) {
        return workspace.defaultAgent
      }
    }
  } catch (error) {
    logger.warn('[agent-command] failed to resolve workspace default agent:', error)
  }
  return null
}

// T0377 / BUG-085: detect BAT's own Windows elevation once and feed it to the (sync)
// agent registry, which then adds `-c features.daemon_auto_start=false` to codex-cli
// launch commands. Every launch-command entry point awaits this so an early build
// (restored terminals, Tower dispatch right after startup) never races the detection.
let elevationApplied: Promise<void> | null = null
function ensureElevationApplied(): Promise<void> {
  if (!elevationApplied) {
    elevationApplied = getWindowsElevation().then((elevated) => {
      agentRegistry.setElevated(elevated)
      logger.log(`[startup] windows elevation=${elevated}${elevated ? ' (codex-cli launches with daemon auto-start disabled)' : ''}`)
    })
  }
  return elevationApplied
}

// T0431: built in electron/terminal-command-handlers.ts (shared with headless); Electron supplies
// userData settings, the window-registry workspace default agent and the elevation probe.
const buildAgentPromptCommand = createAgentPromptCommandBuilder({
  readSettings: readPersistedSettingsSync,
  resolveWorkspaceDefaultAgent,
  ensureElevationApplied,
  logger,
})

/** Read minimizeToTray from persisted settings file (sync, for use in close handler) */
function isMinimizeToTrayEnabled(): boolean {
  return readPersistedSettingsSync()?.minimizeToTray === true
}

/** Read enableDevTools from persisted settings file (sync, for menu building) */
function isDevToolsEnabled(): boolean {
  const persisted = readPersistedSettingsSync()
  // Dev mode: enabled by default, but can be explicitly disabled via settings
  if (VITE_DEV_SERVER_URL) return persisted?.enableDevTools !== false
  // Production: disabled by default, must be explicitly enabled via settings
  return persisted?.enableDevTools === true
}

function getCrashesDir(): string {
  return path.join(app.getPath('userData'), 'Crashes')
}

function openFolder(folderPath: string, label: string): void {
  if (!folderPath) {
    logger.error(`[menu] missing path for ${label}`)
    return
  }
  shell.openPath(folderPath).then((result) => {
    if (result) logger.error(`[menu] failed to open ${label}: ${result}`)
  }).catch((error) => {
    logger.error(`[menu] failed to open ${label}:`, error)
  })
}

/** Build (or rebuild) the system tray context menu with per-window entries. */
function rebuildTrayMenu() {
  if (!tray) return
  const entries: Electron.MenuItemConstructorOptions[] = []

  // "Show All Windows"
  entries.push({
    label: 'Show All Windows',
    click: () => {
      for (const win of windowMap.values()) {
        if (!win.isDestroyed()) { win.show(); win.focus() }
      }
    }
  })

  // Per-window entries
  if (windowMap.size > 0) {
    entries.push({ type: 'separator' })
    for (const [wId, win] of windowMap) {
      if (win.isDestroyed()) continue
      // Build a short label from window title or workspace names
      const label = win.getTitle() || `Window ${wId.slice(0, 8)}`
      entries.push({
        label,
        submenu: [
          {
            label: 'Show',
            click: () => { if (!win.isDestroyed()) { win.show(); win.focus() } }
          },
          {
            label: 'Remove from profile',
            click: () => {
              windowRegistry.getEntry(wId).then(async (entry) => {
                if (!entry?.profileId) {
                  await windowRegistry.removeEntry(wId)
                  if (!win.isDestroyed()) win.destroy()
                  rebuildTrayMenu()
                  return
                }
                const profileId = entry.profileId!
                await windowRegistry.removeEntry(wId)
                await profileManager.save(profileId).catch(() => { /* ignore */ })
                const remaining = (await windowRegistry.readAll()).filter(e =>
                  e.profileId === profileId && windowMap.has(e.id) && e.id !== wId
                )
                if (remaining.length === 0) {
                  await profileManager.deactivateProfile(profileId)
                }
                if (!win.isDestroyed()) win.destroy()
                rebuildTrayMenu()
              }).catch(() => { /* ignore */ })
            }
          }
        ]
      })
    }
  }

  entries.push({ type: 'separator' })
  entries.push({
    label: 'Quit',
    click: () => {
      app.quit()
    }
  })

  tray.setContextMenu(Menu.buildFromTemplate(entries))
}

/**
 * Open http(s) links in the system browser, never inside Electron; any other
 * scheme (file: → ShellExecute would run a .bat / .exe) is dropped (T0457).
 * Every window that loads the preload needs this — an external page loaded
 * there would see window.electronAPI (T0458).
 */
function guardWindowNavigation(win: BrowserWindow) {
  installNavigationGuards(win, {
    appUrl: VITE_DEV_SERVER_URL || pathToFileURL(path.join(__dirname, '../dist/index.html')).href,
    openExternal: (url) => { shell.openExternal(url) },
    warn: (message) => logger.warn(message),
  })
}

/** Attach a will-resize throttle to a BrowserWindow to reduce DWM pressure on Windows. */
function setupResizeThrottle(win: BrowserWindow, label: string) {
  let lastResizeTime = 0
  let throttledCount = 0
  win.on('will-resize', (event, newBounds) => {
    const now = Date.now()
    const elapsed = now - lastResizeTime
    if (elapsed < 100) {
      event.preventDefault()
      throttledCount++
    } else {
      if (throttledCount > 0) {
        logger.log(`[resize] ${label} will-resize: ${throttledCount} events throttled since last ALLOWED`)
        throttledCount = 0
      }
      lastResizeTime = now
      logger.log(`[resize] ${label} will-resize ALLOWED ${newBounds.width}x${newBounds.height}`)
    }
  })
}

function getAllWindows(): BrowserWindow[] {
  const wins: BrowserWindow[] = []
  for (const win of windowMap.values()) {
    if (!win.isDestroyed()) wins.push(win)
  }
  for (const win of detachedWindows.values()) {
    if (!win.isDestroyed()) wins.push(win)
  }
  return wins
}

/**
 * PLAN-036 T0389: Electron host deps for PtyManager — the pre-DI behaviour:
 * events go to every window + broadcastHub, the Terminal Server registry lives
 * in userData, and `BAT_HELPER_DIR` is dev `<project-root>/scripts` or packaged
 * `<install-root>/resources/scripts` (T0140, aligned with T0139 extraResources).
 */
function createElectronPtyDeps(): PtyManagerDeps {
  return {
    emit: createWindowBroadcastEmit(getAllWindows),
    dataDir: app.getPath('userData'),
    helperDir: app.isPackaged
      ? path.join(process.resourcesPath, 'scripts')
      : path.join(__dirname, '..', 'scripts'),
  }
}

/**
 * PLAN-036 T0400: Electron host deps for ClaudeAgentManager — the pre-DI
 * behaviour: events go to every window + broadcastHub, completion notifications
 * use Electron `Notification` (click focuses a window), and settings are read
 * fresh from `userData/settings.json` on every notification.
 */
function createElectronClaudeDeps(): ClaudeAgentManagerDeps {
  return {
    emit: createElectronClaudeEmit(getAllWindows),
    notifier: createElectronNotifier(Notification, getAllWindows),
    getSettings: () => {
      try {
        const parsed: unknown = JSON.parse(fsSync.readFileSync(path.join(app.getPath('userData'), 'settings.json'), 'utf-8'))
        return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {}
      } catch {
        return {} // settings file doesn't exist or is invalid
      }
    },
  }
}

/** Sync filter: windows whose registry entry's profileId matches `profileId`.
 *  Used to scope remote event broadcasts to the correct profile's windows. */
function getWindowsForProfile(profileId: string | null): BrowserWindow[] {
  // T0464: shared with the lifecycle tests — a window hidden to the tray stays in
  // windowMap and counts as live (the remote registry's countLiveWindows).
  return collectProfileWindows({
    profileId,
    registryEntries: windowRegistry.getCachedEntries(),
    windows: windowMap,
    // T0446 (BUG-112): a detached window belongs to its parent's profile (keyed by workspaceId, not a registry id).
    detachedWindows,
    detachedProfileId: (workspaceId) => senderBindingProfileId(resolveDetachedBindingSync(workspaceId)),
  })
}

/** Reverse lookup: find windowId from a WebContents (for IPC sender context) */
function getWindowIdByWebContents(wc: Electron.WebContents): string | null {
  for (const [id, win] of windowMap) {
    if (!win.isDestroyed() && win.webContents === wc) return id
  }
  return null
}

/** T0446 (BUG-112): workspaceId of the detached window owning `wc`, null for any other sender. */
function getDetachedWorkspaceIdByWebContents(wc: Electron.WebContents): string | null {
  for (const [workspaceId, win] of detachedWindows) {
    if (!win.isDestroyed() && win.webContents === wc) return workspaceId
  }
  return null
}

function isLiveRegistryWindow(windowId: string | null): windowId is string {
  const win = windowId ? windowMap.get(windowId) : undefined
  return !!win && !win.isDestroyed()
}

/** T0446: a detached window's binding from the cached registry (sync, for event fan-out). */
function resolveDetachedBindingSync(workspaceId: string): SenderProfileBinding {
  const record = detachedWindowRecords.get(workspaceId)
  const parentId = record?.parentWindowId ?? null
  const parentEntry = isLiveRegistryWindow(parentId) ? windowRegistry.getCachedEntries().find(e => e.id === parentId) : undefined
  return resolveDetachedProfileBinding(record, parentEntry ? parentEntry.profileId ?? null : undefined)
}

/** T0446: a detached window's binding — its parent's, or the one recorded at detach time once the parent is gone. */
async function resolveDetachedBinding(workspaceId: string): Promise<SenderProfileBinding> {
  const record = detachedWindowRecords.get(workspaceId)
  const parentId = record?.parentWindowId ?? null
  let parentProfileId: string | null | undefined
  if (isLiveRegistryWindow(parentId)) {
    try {
      const parentEntry = await windowRegistry.getEntry(parentId)
      parentProfileId = parentEntry ? parentEntry.profileId ?? null : undefined
    } catch (err) {
      logger.warn(`[detached] parent ${parentId} entry unreadable for ${workspaceId}:`, err)
    }
  }
  return resolveDetachedProfileBinding(record, parentProfileId)
}

/**
 * T0446 (BUG-112): profile binding of an IPC sender — a registry window's own entry,
 * a detached workspace window's parent's (fail-closed `unresolved` when unknown).
 * Other senders have none. Handlers still get `getWindowIdByWebContents` (null for
 * a detached window); this only decides which profile the sender acts for.
 */
async function getSenderProfileBinding(wc: Electron.WebContents): Promise<SenderProfileBinding> {
  const windowId = getWindowIdByWebContents(wc)
  if (windowId) return { kind: 'bound', profileId: (await windowRegistry.getEntry(windowId))?.profileId ?? null }
  const workspaceId = getDetachedWorkspaceIdByWebContents(wc)
  if (workspaceId !== null) return resolveDetachedBinding(workspaceId)
  return { kind: 'bound', profileId: null }
}

const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
const GITHUB_REPO_URL = 'https://github.com/gowerlin/better-agent-terminal'

function buildMenu() {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        {
          label: '📂 Open Application Data Folder',
          click: () => openFolder(app.getPath('userData'), 'app data folder'),
        },
        {
          label: '📋 Open Logs Folder',
          click: () => openFolder(logger.getLogsDir(), 'logs folder'),
        },
        {
          label: '💥 Open Crash Reports Folder',
          click: () => openFolder(getCrashesDir(), 'crash reports folder'),
        },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        ...(isDevToolsEnabled() ? [{ role: 'toggleDevTools' as const }] : []),
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'GitHub Repository',
          click: () => shell.openExternal(GITHUB_REPO_URL)
        },
        {
          label: 'Report Issue',
          click: () => shell.openExternal(`${GITHUB_REPO_URL}/issues`)
        },
        {
          label: 'Releases',
          click: () => shell.openExternal(`${GITHUB_REPO_URL}/releases`)
        },
        { type: 'separator' },
        {
          label: 'About',
          click: () => {
            const focusedWin = BrowserWindow.getFocusedWindow() || [...windowMap.values()][0]
            if (focusedWin) {
              let upstreamVersion = 'unknown'
              let upstreamAuthor = 'TonyQ'
              let upstreamRepo = 'https://github.com/tony1223/better-agent-terminal'
              try {
                const versionJsonPath = path.join(app.getAppPath(), 'version.json')
                const versionData = JSON.parse(fsSync.readFileSync(versionJsonPath, 'utf-8'))
                upstreamVersion = versionData.upstream?.version ?? upstreamVersion
                upstreamAuthor = versionData.upstream?.author ?? upstreamAuthor
                upstreamRepo = versionData.upstream?.repo ?? upstreamRepo
              } catch {}
              dialog.showMessageBox(focusedWin, {
                type: 'info',
                title: 'About Better Agent Terminal',
                message: 'Better Agent Terminal',
                detail: `Version: ${app.getVersion()}

Author: Gower
Fork from: ${upstreamAuthor} — ${upstreamRepo}
Upstream version: ${upstreamVersion}

A terminal aggregator with multi-workspace support and Claude Agent integration.`
              })
            }
          }
        }
      ]
    }
  ]

  // Add Update menu item if update is available
  if (updateCheckResult?.hasUpdate && updateCheckResult.latestRelease) {
    template.push({
      label: '🎉 Update Available!',
      submenu: [
        {
          label: `View ${updateCheckResult.latestRelease.tagName} on GitHub`,
          click: () => shell.openExternal(`${GITHUB_REPO_URL}/releases`)
        }
      ]
    })
  }

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

function createWindow(windowId: string, bounds?: { x: number; y: number; width: number; height: number }) {
  const win = new BrowserWindow({
    width: bounds?.width || 1400,
    height: bounds?.height || 900,
    x: bounds?.x,
    y: bounds?.y,
    minWidth: 800,
    minHeight: 600,
    show: true,
    backgroundColor: '#1a1a1a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    },
    frame: true,
    titleBarStyle: 'default',
    title: 'Better Agent Terminal',
    icon: nativeImage.createFromPath(path.join(__dirname, process.platform === 'win32' ? '../assets/icon.ico' : '../assets/icon.png'))
  })

  windowMap.set(windowId, win)

  if (process.platform === 'darwin') {
    const dockIcon = nativeImage.createFromPath(path.join(__dirname, '../assets/icon.png'))
    app.dock.setIcon(dockIcon)
  }

  // Create managers once (shared across all windows)
  // Note: ptyManager is created in app.whenReady before startTerminalServer (T0108).
  // The guard below handles edge-case window creation before ready (should not occur normally).
  if (!ptyManager) {
    ptyManager = new PtyManager(createElectronPtyDeps())
  }
  if (!claudeManager) claudeManager = new ClaudeAgentManager(createElectronClaudeDeps())
  if (!codexManager) codexManager = new CodexAgentManager(getAllWindows)

  const urlParam = `?windowId=${encodeURIComponent(windowId)}`
  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL + urlParam)
    if (windowMap.size === 1) win.webContents.openDevTools({ mode: 'detach' })
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'), { search: urlParam })
  }

  guardWindowNavigation(win)

  setupResizeThrottle(win, `window-${windowId.slice(0, 12)}`)

  // Save window bounds on move/resize (debounced)
  let boundsTimer: ReturnType<typeof setTimeout> | null = null
  const saveBounds = () => {
    if (boundsTimer) clearTimeout(boundsTimer)
    boundsTimer = setTimeout(() => {
      if (win.isDestroyed()) return
      const b = win.getBounds()
      windowRegistry.getEntry(windowId).then(entry => {
        if (entry) {
          entry.bounds = b
          entry.lastActiveAt = Date.now()
          windowRegistry.saveEntry(entry)
        }
      })
    }, 1000)
  }
  win.on('moved', saveBounds)
  win.on('resized', saveBounds)

  win.on('close', (e) => {
    if (isAppQuitting) {
      // App quitting (Cmd+Q): save handled by before-quit, just let it close
      return
    }

    e.preventDefault()
    windowRegistry.getEntry(windowId).then(async (entry) => {
      if (!entry?.profileId) {
        // No profile — just close and remove entry
        await windowRegistry.removeEntry(windowId)
        win.destroy()
        rebuildTrayMenu()
        return
      }

      // Count how many windows this profile currently has open
      const allEntries = await windowRegistry.readAll()
      const profileWindowCount = allEntries.filter(e =>
        e.profileId === entry.profileId && windowMap.has(e.id)
      ).length

      const minimizeToTray = isMinimizeToTrayEnabled()

      if (profileWindowCount <= 1) {
        if (minimizeToTray) {
          // Last window — minimize to tray instead of closing
          win.hide()
          return
        }
        // Last window in profile — preserve snapshot but mark profile inactive
        await profileManager.deactivateProfile(entry.profileId!)
        win.destroy()
        rebuildTrayMenu()
        return
      }

      // No workspaces — silently remove from profile without asking
      if (!entry.workspaces || entry.workspaces.length === 0) {
        const profileId = entry.profileId!
        await windowRegistry.removeEntry(windowId)
        await profileManager.save(profileId).catch(() => { /* ignore */ })
        const remaining = (await windowRegistry.readAll()).filter(e =>
          e.profileId === profileId && windowMap.has(e.id) && e.id !== windowId
        )
        if (remaining.length === 0) {
          await profileManager.deactivateProfile(profileId)
        }
        win.destroy()
        rebuildTrayMenu()
        return
      }

      // Multiple windows — ask user (even when minimizeToTray is enabled)
      const buttons = minimizeToTray
        ? ['Remove from profile', 'Minimize to tray', 'Cancel']
        : ['Remove from profile', 'Close only', 'Cancel']
      const detail = minimizeToTray
        ? 'Remove from profile: this window won\'t be restored next time.\nMinimize to tray: hide this window but keep it in the profile.'
        : 'Remove from profile: this window won\'t be restored next time.\nClose only: preserve it in the profile for next launch.'

      const { response } = await dialog.showMessageBox(win, {
        type: 'question',
        buttons,
        defaultId: 1,
        cancelId: 2,
        title: 'Close Window',
        message: 'How do you want to close this window?',
        detail,
      })

      if (response === 2) return // Cancel

      if (response === 0) {
        // Remove from profile: delete entry, then save remaining windows
        const profileId = entry.profileId!
        await windowRegistry.removeEntry(windowId)
        await profileManager.save(profileId).catch(() => { /* ignore */ })
        // If that was the last open window for this profile, deactivate it
        const remaining = (await windowRegistry.readAll()).filter(e =>
          e.profileId === profileId && windowMap.has(e.id) && e.id !== windowId
        )
        if (remaining.length === 0) {
          await profileManager.deactivateProfile(profileId)
        }
        win.destroy()
        rebuildTrayMenu()
        return
      }

      // response === 1: Close only / Minimize to tray
      if (entry.profileId) {
        await profileManager.save(entry.profileId).catch(() => { /* ignore */ })
      }
      if (minimizeToTray) {
        win.hide()
      } else {
        win.destroy()
        rebuildTrayMenu()
      }
    }).catch(() => { /* ignore */ })
  })

  win.on('closed', () => {
    windowMap.delete(windowId)
    noteRemoteWindowClosed()
    rebuildTrayMenu()
    // Close detached windows that were opened from this window
    // (for now close all detached — same as before)
    if (windowMap.size === 0) {
      for (const [, dw] of detachedWindows) {
        if (!dw.isDestroyed()) dw.close()
      }
      detachedWindows.clear()
      detachedWindowRecords.clear()
    }
  })

  // Rebuild tray menu after window title is available
  win.webContents.on('page-title-updated', () => rebuildTrayMenu())

  return win
}

/** T0384: hold exactly the distros of the persisted WSL profiles (no-op off Windows). */
async function syncWslKeepAlive(reason: string): Promise<void> {
  if (process.platform !== 'win32') return
  try {
    const { profiles } = await profileManager.list()
    const distros = profiles
      .filter(p => p.targetOS === 'wsl-linux' && typeof p.wslDistro === 'string' && p.wslDistro.length > 0)
      .map(p => p.wslDistro as string)
    wslKeepAlive.sync(distros)
    logger.log(`[wsl-keepalive] sync (${reason}): ${distros.length ? distros.join(', ') : 'none'}`)
  } catch (err) {
    logger.error(`[wsl-keepalive] sync (${reason}) failed: ${err}`)
  }
}

/**
 * Resolves once the SSH subprocesses it started tearing down (wizard tunnels, every
 * remote profile's client and tunnel) exited, at most DISCONNECT_ALL_TIMEOUT_MS
 * (T0464); the synchronous teardown below runs meanwhile. Never rejects.
 */
async function cleanupAllProcesses(): Promise<void> {
  try { wslKeepAlive.stopAll() } catch { /* ignore */ }
  // T0387: never leave an SSH wizard verification tunnel (`ssh -L`) behind.
  const wizardTunnelsClosed = Promise.resolve().then(() => closeAllSshWizardTunnels())
  // T0463 / T0464: every profile's client (and its SSH tunnel), all at once.
  const remoteClientsClosed = remoteConnections.disconnectAll(DISCONNECT_ALL_TIMEOUT_MS)
  try { remoteServer.stop() } catch { /* ignore */ }
  try { claudeManager?.killAll() } catch { /* ignore */ }
  try { claudeManager?.dispose() } catch { /* ignore */ }
  try { codexManager?.killAll() } catch { /* ignore */ }
  try { codexManager?.dispose() } catch { /* ignore */ }
  try { ptyManager?.dispose() } catch { /* ignore */ }
  claudeManager = null
  codexManager = null
  sessionManagerMap.clear()
  ptyManager = null
  const t0 = Date.now()
  const settled = await settleWithin([wizardTunnelsClosed, remoteClientsClosed], DISCONNECT_ALL_TIMEOUT_MS)
  logger.log(`[quit] ssh subprocesses ${settled ? 'exited' : `still running after ${DISCONNECT_ALL_TIMEOUT_MS}ms — not waiting longer`} (${Date.now() - t0}ms)`)
}

// Handle launch arguments (kept for backward compat but no longer spawns processes)
const profileArg = process.argv.find(a => a.startsWith('--profile='))
const launchProfileId = profileArg ? profileArg.split('=')[1] || null : null

const windowRegistry = new WindowRegistry()
profileManager.setWindowRegistry(windowRegistry)

// PLAN-018 T0183 — path sandbox: rebuild the workspace allowlist from every
// registered window entry. Called at startup and on every workspace:save.
async function syncPathGuardFromRegistry(): Promise<void> {
  try {
    const entries = await windowRegistry.readAll()
    const paths: string[] = []
    for (const entry of entries) {
      const workspaces = (entry.workspaces as Array<{ folderPath?: string }> | undefined) || []
      for (const ws of workspaces) {
        if (ws?.folderPath) paths.push(ws.folderPath)
      }
    }
    rebuildWorkspaceAllowlist(paths)
  } catch (err) {
    logger.warn('[path-guard] syncFromRegistry failed:', err)
  }
}

// PLAN-036 T0406 — headless fs sandbox: a remote-profile connection hands its
// server the workspace roots of every window bound to that profile (client form;
// RemoteClient.invoke converts them with the profile's PathTranslator). Pushed
// after every auth (RemoteClient) and after workspace:save / workspace:load of a
// bound window. Local windows never push.
function bindRemoteClient(client: RemoteClient, profileId: string): RemoteClient {
  client.setWorkspaceRootsProvider(async () => collectWorkspaceRoots(await windowRegistry.readAll(), profileId))
  // T0443: status is computed from the profile's registry entry, so a ping from a
  // candidate that is not (or no longer) the entry's client is harmless.
  client.setStatusChangeListener(() => pushRemoteClientStatus(profileId))
  return client
}

/**
 * T0463 (PLAN-039): a window closed. A profile left without any live window
 * (getWindowsForProfile: registry and detached windows; a window hidden to the
 * tray still counts) has its connection released by the registry after the idle
 * grace, counted again at expiry. The closed window's registry entry may already
 * be gone, so every profile with a connection is checked.
 */
function noteRemoteWindowClosed(): void {
  for (const [profileId, result] of remoteConnections.noteAnyWindowClosed()) {
    if (result === 'scheduled' && remoteConnections.pendingRelease(profileId) === 'idle') logger.log(`[remote] profile ${profileId} has no window left — releasing its connection in ${IDLE_GRACE_MS / 1000}s unless a window returns`)
  }
}

/** T0464 (T0459 Q3): two profiles on one server are allowed, but logged. */
function warnSameTargetProfiles(profileId: string | null, outcome: { target: { host: string; port: number }; sameTargetProfileIds: string[] }): void {
  const warning = describeSameTargetWarning(profileId ?? '(unbound)', outcome.target, outcome.sameTargetProfileIds)
  if (warning) logger.warn(warning)
}

/** T0463: the profile's own client while it is connected (null otherwise). */
function liveRemoteClient(profileId: string | null | undefined): RemoteClient | null {
  if (!profileId || !remoteConnections.isProfileLive(profileId)) return null
  return remoteConnections.get(profileId)?.client ?? null
}

// T0443: last status pushed per profile — identical pings (a client's own
// disconnect() plus the entry change around it) are sent once.
const lastPushedRemoteStatus = new Map<string, string>()

/** T0443: push `remote:client-status-changed` to the windows bound to each profile. */
function pushRemoteClientStatus(...profileIds: Array<string | null | undefined>): void {
  for (const status of planProfileStatusPushes(profileIds, (profileId) => remoteConnections.connectionState(profileId), lastPushedRemoteStatus)) {
    logger.log(`[remote-status] profile ${status.profileId} → ${status.state}${status.reason ? ` (${status.reason})` : ''}`)
    for (const win of getWindowsForProfile(status.profileId)) {
      win.webContents.send(REMOTE_CLIENT_STATUS_CHANGED_CHANNEL, status)
    }
  }
}

function syncRemoteWorkspaceRoots(windowProfileId: string | null | undefined): void {
  const entry = windowProfileId ? remoteConnections.get(windowProfileId) : undefined
  const client = entry?.client
  if (!entry || !client || !shouldSyncWorkspaceRoots(windowProfileId, entry.profileId, client.isConnected)) return
  void client.syncWorkspaceRoots()
}

type SnapshotLoadResult =
  | { kind: 'ok'; snapshot: ProfileSnapshot | null }
  | ({ kind: 'remote-unreachable' } & RemoteProfileFailure)

async function loadProfileSnapshotDetailed(profileId: string): Promise<SnapshotLoadResult> {
  const profileEntry = await profileManager.getProfile(profileId)
  if (profileEntry?.type === 'remote' && profileEntry.remoteHost && profileEntry.remoteToken) {
    if (!profileEntry.remoteFingerprint) {
      logger.warn(`[profile] remote profile ${profileId} is missing remoteFingerprint — refusing to connect (legacy plaintext setup, please re-pair)`)
      return {
        kind: 'remote-unreachable',
        reason: 'trust',
        host: profileEntry.remoteHost,
        port: profileEntry.remotePort || 9876,
        label: profileEntry.name || profileId,
        error: 'Profile has no pinned server fingerprint (legacy setup)',
      }
    }

    const host = profileEntry.remoteHost
    const port = profileEntry.remotePort || 9876
    const label = profileEntry.name || profileId
    const token = profileEntry.remoteToken
    // T0463 (PLAN-039): the profile's own registry entry. A live client for the same
    // target + pin is reused (no second handshake); otherwise a candidate connects
    // pinned and only replaces the entry's client on success (T0430 / T0442) — a
    // failed candidate is disconnected so its SSH tunnel / reconnect timer go too.
    // Other profiles' connections are never touched.
    const outcome = await remoteConnections.connect({
      profileId,
      profile: profileEntry,
      request: { host, port, token },
      run: (client, expectedFingerprint) => client.connect(host, port, token, undefined, expectedFingerprint),
    }).catch((err: unknown) => ({ kind: 'threw' as const, err }))
    pushRemoteClientStatus(profileId)
    switch (outcome.kind) {
      case 'threw': {
        const message = outcome.err instanceof Error ? outcome.err.message : String(outcome.err)
        logger.error(`[profile] remote profile ${profileId} connect threw:`, message)
        return { kind: 'remote-unreachable', reason: 'unreachable', host, port, label, error: message }
      }
      case 'reject':
        logger.warn(`[profile] remote connect refused for profile ${profileId} (${host}:${port}) [${outcome.errorCode}]: ${outcome.error}`)
        return { kind: 'remote-unreachable', reason: 'trust', host, port, label, error: outcome.error }
      case 'limit':
        logger.warn(`[profile] remote connect refused for profile ${profileId} (${host}:${port}): ${outcome.cap} remote profiles already connected`)
        return { kind: 'remote-unreachable', reason: 'limit', host, port, label, limit: outcome.cap, error: `Too many remote profiles connected at once (limit ${outcome.cap})` }
      case 'aborted':
        return { kind: 'remote-unreachable', reason: 'unreachable', host, port, label, error: 'Connection was torn down while connecting' }
      case 'failed': {
        const result = outcome.result
        const reason = classifyConnectFailure(result)
        logger.error(`[profile] remote connect failed for profile ${profileId} (${host}:${port}) [${reason}/${result.errorCode ?? 'unknown'}]: ${result.error ?? 'unknown'}`)
        return { kind: 'remote-unreachable', reason, host, port, label, error: result.error }
      }
      case 'reuse':
        logger.log(`[profile] remote profile ${profileId} → reusing its verified client (${host}:${port})`)
        break
      case 'connected':
        warnSameTargetProfiles(profileId, outcome)
        break
    }
    const client = outcome.client
    const targetProfileId = profileEntry.remoteProfileId || 'default'
    try {
      const snapshot = await client.invoke('profile:load-snapshot', [targetProfileId]) as ProfileSnapshot | null
      logger.log(`[profile] remote profile ${profileId} → got ${snapshot?.windows?.length ?? 0} window(s) from remote (target: ${targetProfileId})`)
      return { kind: 'ok', snapshot }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      const reason = classifyInvokeFailure(err)
      logger.error(`[profile] remote profile ${profileId} snapshot fetch failed [${reason}]: ${message}`)
      return { kind: 'remote-unreachable', reason, host, port, label, error: message }
    }
  }

  return { kind: 'ok', snapshot: await profileManager.loadSnapshot(profileId) }
}

function showRemoteProfileFailureDialog(failure: RemoteProfileFailure): void {
  // T0464: the `limit` dialog follows the UI language (main has no i18next).
  const { title, message, detail } = describeRemoteProfileFailure(failure, { lang: readPersistedSettingsSync()?.language, idleGraceMs: IDLE_GRACE_MS })
  dialog.showMessageBox({
    type: 'warning',
    title,
    message,
    detail,
    buttons: ['OK'],
  }).catch(() => { /* ignore */ })
}

async function pickFallbackProfileId(excludeProfileId: string): Promise<string | null> {
  const { profiles } = await profileManager.list()
  const local = profiles.filter(p => p.type !== 'remote' && p.id !== excludeProfileId)
  if (local.length > 0) {
    return (local.find(p => p.id === 'default') || local[0]).id
  }
  const other = profiles.find(p => p.id !== excludeProfileId)
  return other?.id || null
}

app.whenReady().then(async () => {
  const t0 = Date.now()
  logger.init(app.getPath('userData'), readLoggingConfigSync())
  logger.log(`[startup] ═══════════════════════════════════════`)
  logger.log(`[startup] app.whenReady fired at +${t0 - _t0}ms from IPC reg, +${t0 - _processStart}ms from process`)
  app.setPath('crashDumps', getCrashesDir())
  crashReporter.start({
    submitURL: '',
    uploadToServer: false,
    compress: false,
  })
  logger.log(`[startup] crashDumps path: ${app.getPath('crashDumps')}`)

  app.on('render-process-gone', (_event, _webContents, details) => {
    logger.error(`[CRASH] render-process-gone reason=${details.reason} exitCode=${details.exitCode}`)
  })

  app.on('child-process-gone', (_event, details) => {
    logger.error(`[CRASH] child-process-gone type=${details.type} reason=${details.reason} exitCode=${details.exitCode}`)
  })

  // Register voice handlers only after app is ready because it installs
  // permission handling on session.defaultSession.
  registerVoiceHandlers(getAllWindows)

  // Create system tray icon
  try {
    const trayIconName = process.platform === 'win32' ? 'icon.ico' : 'icon.png'
    // In dev: assets/ is relative to electron/ output dir
    // In packaged app: assets/ is at app root (included in files[])
    const devPath = path.join(__dirname, '..', 'assets', trayIconName)
    const packagedPath = path.join(app.getAppPath(), 'assets', trayIconName)
    const iconFile = fsSync.existsSync(devPath) ? devPath : packagedPath
    const trayIcon = nativeImage.createFromPath(iconFile).resize({ width: 16, height: 16 })
    tray = new Tray(trayIcon)
    tray.setToolTip('Better Agent Terminal')
    rebuildTrayMenu()
    tray.on('double-click', () => {
      const wins = BrowserWindow.getAllWindows()
      if (wins.length > 0) {
        wins.forEach(w => { w.show(); w.focus() })
      }
    })
    logger.log('[startup] system tray created')
  } catch (err) {
    logger.error('[startup] failed to create system tray:', err)
  }

  // Initialize PtyManager before starting Terminal Server so TCP reconnect can use it (T0108)
  if (!ptyManager) {
    ptyManager = new PtyManager(createElectronPtyDeps())
    // T0112: Provide re-fork callback so PtyManager can restart the server after a crash
    ptyManager.onRequestNewServer = reforkTerminalServer
  }

  // T0377: kick off elevation detection early (non-blocking; launch-command builders await it)
  void ensureElevationApplied()

  // Start Terminal Server (PLAN-008 Phase 2) as independent background process
  await startTerminalServer()

  // Load user-defined custom CLIs from disk
  try {
    const dataPath = path.join(app.getPath('userData'), 'custom-clis.json')
    const data = await fs.promises.readFile(dataPath, 'utf-8')
    const clis = JSON.parse(data) as CustomCliDefinition[]
    for (const cli of clis) {
      agentRegistry.registerCustomCli(cli)
    }
    logger.log(`[startup] loaded ${clis.length} custom CLIs`)
  } catch {
    // No custom CLIs file yet — normal on first run
  }

  // Ensure profile system is initialized (migrates from workspaces.json on first run)
  const migratedEntries = await windowRegistry.ensureInitialized()

  // If migration just happened (first run after upgrade), save migrated data as profile snapshot
  // BEFORE clearing windows.json, so workspaces aren't lost
  if (migratedEntries.length > 0) {
    const profileIds = [...new Set(migratedEntries.filter(e => e.profileId).map(e => e.profileId!))]
    for (const pid of profileIds) {
      const saved = await profileManager.save(pid).catch(() => false)
      logger.log(`[startup] saved migration snapshot for profile ${pid}: ${saved}`)
    }
  }

  // Collect window IDs to create
  const windowsToCreate: { id: string; bounds?: { x: number; y: number; width: number; height: number } }[] = []

  // Clear windows.json — it's purely runtime state, snapshots are the source of truth
  await windowRegistry.clear()

  // Helper: apply a snapshot's windows into the registry
  const applySnapshot = async (profileId: string, snapshot: ProfileSnapshot): Promise<number> => {
    if (!snapshot || snapshot.windows.length === 0) return 0
    for (const winSnap of snapshot.windows) {
      const entry = await windowRegistry.createEntry({ profileId })
      entry.workspaces = winSnap.workspaces
      entry.activeWorkspaceId = winSnap.activeWorkspaceId
      entry.activeGroup = winSnap.activeGroup
      entry.terminals = winSnap.terminals
      entry.activeTerminalId = winSnap.activeTerminalId
      entry.bounds = winSnap.bounds
      await windowRegistry.saveEntry(entry)
      windowsToCreate.push({ id: entry.id, bounds: winSnap.bounds })
    }
    return snapshot.windows.length
  }

  // Helper: restore windows for a profile at startup
  const restoreFromSnapshot = async (profileId: string): Promise<{ count: number; unreachable?: RemoteProfileFailure }> => {
    const result = await loadProfileSnapshotDetailed(profileId)
    if (result.kind === 'remote-unreachable') {
      return { count: 0, unreachable: { reason: result.reason, host: result.host, port: result.port, label: result.label, error: result.error, limit: result.limit } }
    }
    if (!result.snapshot) return { count: 0 }
    return { count: await applySnapshot(profileId, result.snapshot) }
  }

  // Track remote-unreachable failures so we can show a dialog once windows exist
  const unreachableFailures: RemoteProfileFailure[] = []

  if (launchProfileId) {
    // --profile= launch: restore that profile's windows
    const { count, unreachable } = await restoreFromSnapshot(launchProfileId)
    if (unreachable) unreachableFailures.push(unreachable)
    if (count === 0 && !unreachable) {
      // No snapshot — create empty window
      const entry = await windowRegistry.createEntry({ profileId: launchProfileId })
      windowsToCreate.push({ id: entry.id })
    }
    if (!unreachable) await profileManager.activateProfile(launchProfileId)
    logger.log(`[startup] profile launch ${launchProfileId} → ${windowsToCreate.length} window(s)`)

    // Remote unreachable and no other windows — fall back to any available profile
    if (unreachable && windowsToCreate.length === 0) {
      const fallbackId = await pickFallbackProfileId(launchProfileId)
      if (fallbackId) {
        logger.log(`[startup] remote launch profile unreachable, falling back to ${fallbackId}`)
        const { count: fbCount, unreachable: fbUnreachable } = await restoreFromSnapshot(fallbackId)
        if (fbUnreachable) unreachableFailures.push(fbUnreachable)
        await profileManager.activateProfile(fallbackId)
        if (fbCount === 0) {
          const entry = await windowRegistry.createEntry({ profileId: fallbackId })
          windowsToCreate.push({ id: entry.id })
        }
      } else {
        const entry = await windowRegistry.createEntry({ profileId: launchProfileId })
        windowsToCreate.push({ id: entry.id })
      }
    }
  } else {
    // Normal launch: restore windows for all active profiles
    let activeProfileIds = await profileManager.getActiveProfileIds()
    logger.log(`[startup] active profiles: ${activeProfileIds.join(', ') || '(none)'}`)

    // If no active profiles, fallback to default or first local profile
    if (activeProfileIds.length === 0) {
      const { profiles } = await profileManager.list()
      const fallback = profiles.find(p => p.id === 'default') || profiles.find(p => p.type === 'local') || profiles[0]
      const fallbackId = fallback?.id || 'default'
      activeProfileIds = [fallbackId]
      await profileManager.activateProfile(fallbackId)
      logger.log(`[startup] no active profiles, falling back to ${fallbackId}`)
    }

    for (const pid of activeProfileIds) {
      const { count, unreachable } = await restoreFromSnapshot(pid)
      if (unreachable) unreachableFailures.push(unreachable)
      logger.log(`[startup] restored ${count} window(s) from profile ${pid}${unreachable ? ' (remote unreachable)' : ''}`)
    }

    // If no windows (all snapshots empty or remote unreachable), create one empty window
    if (windowsToCreate.length === 0) {
      // Prefer a local fallback when the only active profiles were remote-unreachable
      let fallbackPid = activeProfileIds[0]
      if (unreachableFailures.length > 0) {
        const localFallback = await pickFallbackProfileId(fallbackPid)
        if (localFallback) {
          fallbackPid = localFallback
          await profileManager.activateProfile(localFallback)
          const { count } = await restoreFromSnapshot(localFallback)
          if (count > 0) {
            logger.log(`[startup] fell back to local profile ${localFallback} → ${count} window(s)`)
          }
        }
      }
      if (windowsToCreate.length === 0) {
        const entry = await windowRegistry.createEntry({ profileId: fallbackPid })
        windowsToCreate.push({ id: entry.id })
        logger.log(`[startup] created empty window for profile ${fallbackPid}`)
      }
    }
  }

  // PLAN-018 T0183 — seed path-guard before any renderer loads so FileTree /
  // workspace-open flows can read folderPath immediately.
  await syncPathGuardFromRegistry()
  logger.log(`[startup] path-guard seeded with ${(await windowRegistry.readAll()).reduce((n, e) => n + ((e.workspaces as any[])?.length || 0), 0)} workspace(s)`)

  const t1 = Date.now()
  buildMenu()
  logger.log(`[startup] buildMenu: ${Date.now() - t1}ms`)
  remoteServer.configDir = app.getPath('userData')

  // T0129: Auto-start RemoteServer so PTY terminals get BAT_REMOTE_PORT/TOKEN env vars
  // T0218 (PLAN-021): Resolve port from env > settings.json > default.
  const startupPort = readRemotePortSync()
  try {
    await remoteServer.start(startupPort)
    logger.log(`[startup] RemoteServer auto-started on port ${remoteServer.port}`)
  } catch (err) {
    logger.warn(
      `[startup] RemoteServer auto-start failed on port ${startupPort} (non-blocking):`,
      err
    )
  }

  // T0129: Wire up PtyManager → RemoteServer info callback for env var injection
  if (ptyManager) {
    ptyManager.getRemoteServerInfo = () => {
      if (!remoteServer.isRunning || !remoteServer.port) return null
      return { port: remoteServer.port, token: remoteServer.currentToken }
    }
  }

  // Create all windows in this process
  for (const w of windowsToCreate) {
    const t2 = Date.now()
    const win = createWindow(w.id, w.bounds)
    logger.log(`[startup] createWindow ${w.id}: ${Date.now() - t2}ms`)
    // Startup instrumentation on first window only
    if (windowMap.size === 1) {
      win.webContents.on('did-start-loading', () => {
        logger.log(`[startup] did-start-loading: +${Date.now() - t0}ms from whenReady`)
      })
      win.webContents.on('dom-ready', () => {
        logger.log(`[startup] dom-ready: +${Date.now() - t0}ms from whenReady`)
      })
      win.webContents.on('did-finish-load', async () => {
        logger.log(`[startup] did-finish-load: +${Date.now() - t0}ms from whenReady`)
        // T0110/T0111: Notify renderer if there are live PTYs to recover.
        // pendingRecovery is set by startTerminalServer() on initial startup.
        // On View→Reload the main process stays alive but pendingRecovery is null,
        // so we re-probe the server to catch PTYs created before the reload.
        if (!pendingRecovery) {
          const userDataPath = app.getPath('userData')
          const port = readPortFile(userDataPath)
          if (port !== null && isServerRunning(userDataPath)) {
            const ptyCount = await probeServerPtyCount(port)
            if (ptyCount > 0) {
              pendingRecovery = { port, ptyCount }
              logger.log(`[terminal-server] reload detected ${ptyCount} live PTYs — offering recovery`)
            }
          }
        }
        if (pendingRecovery) {
          win.webContents.send('terminal-server:recovery-available', { ptyCount: pendingRecovery.ptyCount })
        }
      })
      const ipcSub = () => {
        logger.log(`[startup] first-renderer-ipc: +${Date.now() - t0}ms from whenReady`)
        win.webContents.removeListener('ipc-message', ipcSub)
      }
      win.webContents.on('ipc-message', ipcSub)
    }
  }

  // Show any remote-unreachable notifications after windows are created
  for (const fail of unreachableFailures) {
    showRemoteProfileFailureDialog(fail)
  }

  // Second instance launched — open a new window in existing process
  app.on('second-instance', async (_event, argv) => {
    // Check if launched with --profile=
    const profileArg2 = argv.find(a => a.startsWith('--profile='))
    const profileId2 = profileArg2 ? profileArg2.split('=')[1] || null : null

    if (profileId2) {
      // Open profile (focus if already open, otherwise restore from snapshot)
      const entries = await windowRegistry.readAll()
      const existing = entries.filter(e => e.profileId === profileId2)
      const openWin = existing.find(e => {
        const w = windowMap.get(e.id)
        return w && !w.isDestroyed()
      })
      if (openWin) {
        const w = windowMap.get(openWin.id)!
        if (w.isMinimized()) w.restore()
        w.focus()
      } else {
        await profileManager.activateProfile(profileId2)
        const result = await loadProfileSnapshotDetailed(profileId2)
        if (result.kind === 'remote-unreachable') {
          showRemoteProfileFailureDialog(result)
          await profileManager.deactivateProfile(profileId2).catch(() => { /* ignore */ })
          return
        }
        const snapshot = result.snapshot
        if (snapshot && snapshot.windows.length > 0) {
          for (const winSnap of snapshot.windows) {
            const entry = await windowRegistry.createEntry({ profileId: profileId2 })
            entry.workspaces = winSnap.workspaces
            entry.activeWorkspaceId = winSnap.activeWorkspaceId
            entry.activeGroup = winSnap.activeGroup
            entry.terminals = winSnap.terminals
            entry.activeTerminalId = winSnap.activeTerminalId
            entry.bounds = winSnap.bounds
            await windowRegistry.saveEntry(entry)
            createWindow(entry.id, winSnap.bounds)
          }
        } else {
          const entry = await windowRegistry.createEntry({ profileId: profileId2 })
          createWindow(entry.id)
        }
      }
    } else {
      // No profile arg — open new window inheriting first active profile
      const activeIds = await profileManager.getActiveProfileIds()
      const pid = activeIds[0] || 'default'
      const entry = await windowRegistry.createEntry({ profileId: pid })
      createWindow(entry.id)
    }
  })

  // T0384: start keep-alive holders at startup (not lazily on first connect) so
  // the distro — and bat-server via linger — is already up when the user connects.
  void syncWslKeepAlive('startup')

  // Listen for system resume from sleep/hibernate
  powerMonitor.on('resume', () => {
    logger.log('System resumed from sleep')
    for (const win of getAllWindows()) {
      win.webContents.send('system:resume')
    }
  })

  // Check for updates after startup (if enabled in settings)
  setTimeout(async () => {
    try {
      // Read settings to check if update checking is enabled (default: true)
      let updateEnabled = true
      try {
        const configPath = path.join(app.getPath('userData'), 'settings.json')
        const data = fsSync.readFileSync(configPath, 'utf-8')
        const parsed = JSON.parse(data)
        if (parsed.checkForUpdates === false) updateEnabled = false
      } catch { /* settings file doesn't exist or is invalid */ }

      if (!updateEnabled) return

      updateCheckResult = await checkForUpdates()
      if (updateCheckResult.hasUpdate) {
        // Rebuild menu to show update option
        buildMenu()
      }
    } catch (error) {
      logger.error('Failed to check for updates:', error)
    }
  }, 2000)
})

// Cleanup runs once: before-quit covers cmd+Q / File→Quit paths,
// window-all-closed covers the user closing the last window.
// Runs once; every caller gets the same promise (T0464: quit awaits it).
let _cleanupPromise: Promise<void> | null = null
function runCleanupOnce(): Promise<void> {
  if (!_cleanupPromise) _cleanupPromise = cleanupAllProcesses().catch(() => undefined)
  return _cleanupPromise
}

// PLAN-012 / T0144: Quit confirmation dialog state.
// Prevents recursion when user confirms quit and app.quit() re-triggers before-quit.
let _quitConfirmed = false

/**
 * PLAN-012 / T0144: Quit dialog i18n strings (hardcoded in main for now).
 *
 * TODO(i18n-main): Electron main process has no i18next instance (i18next lives in
 * renderer only). Keeping strings inline here until a shared main-side i18n helper
 * is introduced. Keep these in sync with src/locales/{en,zh-TW,zh-CN}.json `quit.dialog.*`.
 */
function getQuitDialogStrings(lang: string | undefined) {
  const code = (lang || '').toLowerCase()
  if (code.startsWith('zh-tw') || code === 'zh' || code.startsWith('zh-hant')) {
    return {
      message: '離開 Better Agent Terminal？',
      checkbox: '結束 Terminal Server',
      ok: '離開',
      cancel: '取消',
    }
  }
  if (code.startsWith('zh-cn') || code.startsWith('zh-hans')) {
    return {
      message: '退出 Better Agent Terminal？',
      checkbox: '同时结束 Terminal Server（版本更新前建议勾选）',
      ok: '退出',
      cancel: '取消',
    }
  }
  return {
    message: 'Quit Better Agent Terminal?',
    checkbox: 'Also stop Terminal Server (recommended before version upgrade)',
    ok: 'Quit',
    cancel: 'Cancel',
  }
}

/**
 * PLAN-012 / T0149 (BUG-034 fix): Stop the Terminal Server gracefully.
 *
 * Strategy — tries A → B → C → D in order, stops at first success:
 *   A) Fork path: if _terminalServerProcess is a live child, SIGTERM + wait for exit
 *   B) TCP shutdown: read portfile, send `server:shutdown` (covers BAT reconnect path
 *      where _terminalServerProcess is null because server was already running)
 *   C) Wait for pidfile removal — server's shutdown hook calls removePidFile()
 *   D) Force-kill fallback: read pidfile → SIGKILL (Unix) or taskkill /F /T (Windows)
 *
 * Why Step C matters: TCP shutdown is async; the server needs ~100-500ms to run
 * its graceful shutdown hook. Polling pidfile is the signal that shutdown completed.
 *
 * Root cause of previous implementation (T0144): only handled fork path (A). BAT's
 * reconnect path left _terminalServerProcess=null, so the function early-returned
 * and SIGTERM was never fired. See T0148 research for full investigation.
 *
 * Resolves once the server has stopped or every path has been exhausted. Does not throw.
 */
async function stopTerminalServerGracefully(): Promise<void> {
  // T0150 (BUG-035): disarm PtyManager heartbeat watchdog BEFORE any kill action.
  // Otherwise the watchdog mistakes the intentional TCP close / IPC exit for a
  // crash and re-forks an orphan Terminal Server, which then refs the event
  // loop and prevents main from exiting cleanly.
  try {
    ptyManager?.beginShutdown()
  } catch (err) {
    logger.error(`[quit] failed to disarm PtyManager watchdog: ${err}`)
  }

  const TIMEOUT_MS = 1500
  const userDataPath = app.getPath('userData')
  const pidPath = path.join(userDataPath, 'bat-pty-server.pid')

  const waitForPidFileRemoval = async (timeoutMs: number): Promise<boolean> => {
    const start = Date.now()
    while (Date.now() - start < timeoutMs) {
      try {
        await fs.access(pidPath)
        // File still exists — keep polling
      } catch {
        return true // ENOENT = removed
      }
      await new Promise<void>((r) => setTimeout(r, 50))
    }
    return false
  }

  // Step A: Fork path (original behavior — preserved for dev serve)
  const child = _terminalServerProcess
  if (child && child.connected) {
    const sigtermStopped = await new Promise<boolean>((resolve) => {
      let resolved = false
      const finish = (ok: boolean) => {
        if (resolved) return
        resolved = true
        resolve(ok)
      }

      try { child.once('exit', () => finish(true)) } catch { /* listener failure non-fatal */ }

      try {
        child.kill('SIGTERM')
      } catch (err) {
        logger.warn(`[quit] SIGTERM to terminal server failed: ${err}`)
      }

      setTimeout(() => finish(false), TIMEOUT_MS)
    })

    if (sigtermStopped) {
      logger.log('[quit] terminal server stopped (via SIGTERM)')
      return
    }
    logger.warn('[quit] SIGTERM did not exit within timeout, falling back to TCP shutdown')
  }

  // Step B: TCP shutdown (reconnect path + Step A timeout fallback)
  try {
    const port = readPortFile(userDataPath)
    if (port) {
      await sendShutdownToServer(port)

      // Step C: Wait for pidfile removal (signals graceful shutdown completion)
      const gone = await waitForPidFileRemoval(TIMEOUT_MS)
      if (gone) {
        logger.log('[quit] terminal server stopped (via TCP shutdown)')
        return
      }
      logger.warn('[quit] TCP shutdown sent but pidfile still present, falling back to force kill')
    }
  } catch (err) {
    logger.warn(`[quit] TCP shutdown failed: ${err}`)
  }

  // Step D: Force-kill fallback
  try {
    const pid = readPidFile(userDataPath)
    if (pid) {
      if (process.platform === 'win32') {
        const { execFile } = await import('child_process')
        const ok = await new Promise<boolean>((resolve) => {
          execFile(
            'taskkill',
            ['/F', '/T', '/PID', String(pid)],
            { timeout: 3000, windowsHide: true },
            (err) => resolve(!err)
          )
        })
        if (ok) {
          logger.log('[quit] terminal server stopped (via taskkill /F /T)')
          return
        }
        logger.error(`[quit] taskkill for PID ${pid} failed`)
      } else {
        try {
          process.kill(pid, 'SIGKILL')
          logger.log('[quit] terminal server stopped (via SIGKILL)')
          return
        } catch (err) {
          logger.error(`[quit] SIGKILL for PID ${pid} failed: ${err}`)
        }
      }
    }
  } catch (err) {
    logger.error(`[quit] force kill failed: ${err}`)
  }

  logger.error('[quit] terminal server stop failed — no handle / port / pid available')
}

app.on('before-quit', async (e) => {
  // PLAN-012 / T0144: Second pass after confirmation — skip all prompts/cleanup
  // so the real shutdown can proceed (the heavy lifting already ran on the first pass).
  if (_quitConfirmed) return

  if (!isAppQuitting) {
    e.preventDefault()
    isAppQuitting = true

    // PLAN-012 / T0144: Ask the user whether to quit and whether to also stop
    // the Terminal Server. Defaults: button=Quit, checkbox=unchecked (server
    // stays alive in the background, matching pre-T0144 behavior).
    let shouldStopServer = false
    try {
      const lang = readPersistedSettingsSync()?.language
      const s = getQuitDialogStrings(lang)
      const parent = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
      const result = parent
        ? await dialog.showMessageBox(parent, {
            type: 'question',
            buttons: [s.cancel, s.ok],
            defaultId: 1,
            cancelId: 0,
            title: 'Better Agent Terminal',
            message: s.message,
            checkboxLabel: s.checkbox,
            checkboxChecked: false,
          })
        : await dialog.showMessageBox({
            type: 'question',
            buttons: [s.cancel, s.ok],
            defaultId: 1,
            cancelId: 0,
            title: 'Better Agent Terminal',
            message: s.message,
            checkboxLabel: s.checkbox,
            checkboxChecked: false,
          })

      if (result.response !== 1) {
        // User clicked Cancel (or closed the dialog) — abort the quit.
        isAppQuitting = false
        logger.log('[quit] user cancelled quit dialog')
        return
      }
      shouldStopServer = result.checkboxChecked === true
      logger.log(`[quit] user confirmed quit (stopTerminalServer=${shouldStopServer})`)
    } catch (err) {
      // If the dialog itself blows up, fall back to the previous behavior:
      // proceed with quit, leave the server alive.
      logger.error(`[quit] confirmation dialog failed, proceeding with quit: ${err}`)
    }

    // Notify all renderer windows to flush their latest state (workspace + layout)
    try {
      const savePromises: Promise<void>[] = []
      for (const [, win] of windowMap) {
        if (!win.isDestroyed() && win.webContents) {
          const p = new Promise<void>((resolve) => {
            // Give renderer 2s max to save, then proceed anyway
            const timeout = setTimeout(resolve, 2000)
            win.webContents.send('workspace:flush-save')
            ipcMain.once('workspace:flush-save-done', () => {
              clearTimeout(timeout)
              resolve()
            })
          })
          savePromises.push(p)
        }
      }
      await Promise.all(savePromises)
      logger.log(`[quit] flushed ${savePromises.length} renderer(s)`)
    } catch (err) {
      logger.error(`[quit] failed to flush renderers: ${err}`)
    }

    // Save all open windows' profiles before quitting
    try {
      const allEntries = await windowRegistry.readAll()
      const profileIds = [...new Set(allEntries.filter(e => e.profileId).map(e => e.profileId!))]
      await Promise.all(profileIds.map(pid => profileManager.save(pid).catch(() => { /* ignore */ })))
      logger.log(`[quit] saved ${profileIds.length} profile snapshot(s)`)
    } catch (err) {
      logger.error(`[quit] failed to save profiles: ${err}`)
    }

    // PLAN-012 / T0144: Optionally stop the Terminal Server before quitting.
    // Runs *after* renderer flushes so PTYs can persist their state first.
    if (shouldStopServer) {
      try {
        // T0149 (BUG-034): stopTerminalServerGracefully now logs internally
        // with the actual method used (SIGTERM / TCP shutdown / taskkill / SIGKILL)
        // or an error if every path failed — removed the unconditional success log
        // here because it fired even on early-returns and masked the real outcome.
        await stopTerminalServerGracefully()
      } catch (err) {
        logger.error(`[quit] stopTerminalServerGracefully failed: ${err}`)
      }
    }

    // T0464: wait (at most DISCONNECT_ALL_TIMEOUT_MS) for remote clients and their
    // ssh subprocesses to exit before the real quit.
    await runCleanupOnce()
    _quitConfirmed = true
    app.quit()
  }
})

// T0384: belt-and-braces for quit paths that skip runCleanupOnce — never leave
// an orphaned `wsl.exe` holder keeping a distro alive after BAT exits.
app.on('will-quit', () => {
  try { wslKeepAlive.stopAll() } catch { /* ignore */ }
  void closeAllSshWizardTunnels().catch(() => undefined)
})

app.on('window-all-closed', () => {
  // If minimizeToTray is active and windows are just hidden, don't quit
  if (isMinimizeToTrayEnabled() && !isAppQuitting) return

  const cleanup = runCleanupOnce()
  app.quit()
  // Force exit — child processes (PTY shells, Claude CLI) may keep the event loop alive.
  // T0464: the countdown starts once the ssh subprocesses exited (cleanup waits at
  // most DISCONNECT_ALL_TIMEOUT_MS), so the force exit never cuts that wait short.
  if (process.platform !== 'darwin') {
    void cleanup.finally(() => setTimeout(() => process.exit(0), 2000))
  }
})

app.on('activate', async () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    const entry = await windowRegistry.createEntry()
    createWindow(entry.id)
  }
})

// ── Proxied handler registration (callable by both IPC and remote server) ──

function registerProxiedHandlers() {
  const MESSAGE_ARCHIVE_DIR = path.join(app.getPath('userData'), 'message-archives')

  // PTY + settings:get-shell-path — shared with headless bat-server (PLAN-036 T0390)
  registerPtyHandlers(registerHandler, { getPtyManager: () => ptyManager })

  // terminal:create-with-command / create-agent-command / notify / keypress — shared with
  // headless bat-server (PLAN-036 T0431, electron/handlers/terminal.ts). Events go to every
  // window + broadcastHub (remote clients of this BAT).
  registerTerminalHandlers(registerHandler, {
    getPtyManager: () => ptyManager,
    emit: createTerminalWindowEmit(() => BrowserWindow.getAllWindows(), (channel, payload) => broadcastHub.broadcast(channel, payload)),
    readSettings: readPersistedSettingsSync,
    buildAgentPromptCommand,
    existsSync: fsSync.existsSync,
  })

  // Workspace persistence — save/load from window registry entry
  registerHandler('workspace:save', async (ctx, data: string) => {
    if (!ctx.windowId) return false
    const parsed = JSON.parse(data)
    const entry = await windowRegistry.getEntry(ctx.windowId)
    if (!entry) return false
    entry.workspaces = parsed.workspaces || []
    entry.activeWorkspaceId = parsed.activeWorkspaceId || null
    entry.activeGroup = parsed.activeGroup || null
    entry.terminals = parsed.terminals || []
    entry.activeTerminalId = parsed.activeTerminalId || null
    entry.layout = parsed.layout || undefined
    entry.lastActiveAt = Date.now()
    await windowRegistry.saveEntry(entry)
    // PLAN-018 T0183 — refresh path-guard allowlist after every save, so
    // add/remove/rename workspace propagates to the sandbox immediately.
    await syncPathGuardFromRegistry()
    // T0406 — a remote-profile window: hand its server the new roots.
    syncRemoteWorkspaceRoots(entry.profileId)
    // Also persist to profile snapshot so force-quit doesn't lose state
    if (entry.profileId) {
      profileManager.save(entry.profileId).catch(() => { /* ignore */ })
    }
    broadcastHub.broadcast('workspace:reload', data)
    return true
  })
  registerHandler('workspace:load', async (ctx) => {
    if (!ctx.windowId) return null
    const entry = await windowRegistry.getEntry(ctx.windowId)
    if (!entry) return null
    // T0406 — a remote window's workspaces reach the registry (applySnapshot) only
    // after the connect-time push, so push again once the window loads them.
    syncRemoteWorkspaceRoots(entry.profileId)
    return JSON.stringify({
      workspaces: entry.workspaces,
      activeWorkspaceId: entry.activeWorkspaceId,
      activeGroup: entry.activeGroup,
      terminals: entry.terminals,
      activeTerminalId: entry.activeTerminalId,
      layout: entry.layout,
    })
  })

  // Settings persistence
  registerHandler('settings:save', async (_ctx, data: string) => {
    const configPath = path.join(app.getPath('userData'), 'settings.json')
    await fs.writeFile(configPath, data, 'utf-8')
    try {
      const parsed = JSON.parse(data) as PersistedSettings
      logger.setConfig({
        loggingEnabled: parsed.loggingEnabled !== false,
        logLevel: normalizeLogLevel(parsed.logLevel),
      })
    } catch (error) {
      logger.error('[settings] Failed to parse settings payload for logging config:', error)
    }
    // Rebuild menu to reflect devtools toggle change
    buildMenu()
    return true
  })
  registerHandler('settings:load', async (_ctx) => {
    const configPath = path.join(app.getPath('userData'), 'settings.json')
    try { return await fs.readFile(configPath, 'utf-8') } catch { return null }
  })
  registerHandler('settings:get-logging-info', async () => {
    return {
      ...logger.getInfo(),
      crashesDir: getCrashesDir(),
    }
  })
  registerHandler('settings:cleanup-logs', async () => {
    return { deletedCount: logger.cleanupOldLogs(10) }
  })

  // claude:* — shared with headless bat-server (PLAN-036 T0401, electron/handlers/claude.ts)
  registerClaudeHandlers(registerHandler, {
    emit: createElectronClaudeEmit(getAllWindows),
    homeDir: app.getPath('home'),
    getClaudeManager: () => claudeManager,
    getCodexManager: () => codexManager,
    sessionKinds: sessionManagerMap,
    messageArchiveDir: MESSAGE_ARCHIVE_DIR,
  })

  // remote-tools:* — shared with headless bat-server (PLAN-037 T0411, electron/handlers/remote-tools.ts).
  // Local window on macOS / Linux: this machine's toolchain; Windows: host-platform.
  registerRemoteToolsHandlers(registerHandler, { isScrubbedEnvKey: isHeadlessScrubbedEnvKey })

  // worktree:* / git:* / git-scaffold:* / github:* — shared with headless bat-server
  // (PLAN-036 T0405, electron/handlers/git.ts). Local: plain `git` on PATH, githubCliPath from userData.
  registerGitHandlers(registerHandler, {
    getGithubCliPath: () => readPersistedSettingsSync()?.githubCliPath,
  })

  // fs:* / image:read-as-data-url / workspace:sync-roots — shared with headless bat-server
  // (PLAN-036 T0406, electron/handlers/fs.ts). Local: the window-registry path-guard
  // (rebuilt on startup and every workspace:save); fs:changed goes to every window +
  // remote clients, as before. No workspaceRoots: synced roots never widen this host's sandbox.
  registerFsHandlers(registerHandler, {
    emit: (channel, ...args) => {
      for (const win of BrowserWindow.getAllWindows()) {
        if (!win.isDestroyed()) {
          try { win.webContents.send(channel, ...args) } catch { /* window closing */ }
        }
      }
      broadcastHub.broadcast(channel, ...args)
    },
    pathGuard: { isPathAllowed },
  })

  // Snippets
  registerHandler('snippet:getAll', (_ctx) => snippetDb.getAll())
  registerHandler('snippet:getById', (_ctx, id: number) => snippetDb.getById(id))
  registerHandler('snippet:create', (_ctx, input: CreateSnippetInput) => snippetDb.create(input))
  registerHandler('snippet:update', (_ctx, id: number, updates: Partial<CreateSnippetInput>) => snippetDb.update(id, updates))
  registerHandler('snippet:delete', (_ctx, id: number) => snippetDb.delete(id))
  registerHandler('snippet:toggleFavorite', (_ctx, id: number) => snippetDb.toggleFavorite(id))
  registerHandler('snippet:search', (_ctx, query: string) => snippetDb.search(query))
  registerHandler('snippet:getCategories', (_ctx) => snippetDb.getCategories())
  registerHandler('snippet:getFavorites', (_ctx) => snippetDb.getFavorites())
  registerHandler('snippet:getByWorkspace', (_ctx, workspaceId?: string) => snippetDb.getByWorkspace(workspaceId))

  // T0437 (BUG-105): attachment paths → the window's host form (ALWAYS_LOCAL; a detached
  // window is routed in bindProxiedHandlersToIpc, its windowId is null here).
  registerHandler('remote:resolve-client-paths', async (ctx, paths: unknown, purpose: unknown) => {
    const profileId = ctx.windowId ? (await windowRegistry.getEntry(ctx.windowId))?.profileId ?? null : null
    return resolveClientPaths(await clientPathTranslatorForBinding({ kind: 'bound', profileId }, 'local'), paths, purpose)
  })

  // Profile (subset exposed to remote clients)
  registerHandler('profile:list', (_ctx) => profileManager.list())
  // Local-only profile list (never proxied to remote). Used by the renderer
  // to resolve the window's own identity when connected to a remote host,
  // since the proxied profile:list returns the REMOTE host's profiles and
  // the client's local aliases won't be found there.
  ipcMain.handle('profile:list-local', () => profileManager.list())
  registerHandler('profile:load', (_ctx, profileId: string) => profileManager.load(profileId))
  registerHandler('profile:load-snapshot', (_ctx, profileId: string) => profileManager.loadSnapshot(profileId))
  registerHandler('profile:get-active-ids', (_ctx) => profileManager.getActiveProfileIds())
  registerHandler('profile:activate', (_ctx, profileId: string) => profileManager.activateProfile(profileId))
  registerHandler('profile:deactivate', (_ctx, profileId: string) => profileManager.deactivateProfile(profileId))
}

// ── Bind all proxied handlers to ipcMain ──

// Channels that MUST run locally even when connected to a remote host.
// These handlers depend on ctx.windowId which the remote protocol doesn't
// forward; proxying them would return null and break the UI.
// The snapshot data for workspaces is already replicated into the local
// windowRegistry via applySnapshot() at startup, so reading locally works.
// The set lives in remote/headless-channel-status.ts (ALWAYS_LOCAL_CHANNELS),
// shared with the headless parity ledger (T0390).

const DETACHED_WORKSPACE_CHANNELS = new Set(['workspace:load', 'workspace:save'])

/**
 * T0453 (BUG-113): workspace:load / workspace:save from a detached workspace window,
 * which has no registry entry of its own. Load returns the parent window's entry,
 * read-only. Save is a no-op: the parent window owns that entry (its store holds every
 * workspace and autosaves), so a second writer would overwrite it. Once the parent's
 * entry is gone (window removed from the profile) load returns null → "Workspace not found".
 */
async function invokeDetachedWorkspacePersistence(channel: string, workspaceId: string): Promise<unknown> {
  if (channel === 'workspace:save') return true
  const parentWindowId = detachedWindowRecords.get(workspaceId)?.parentWindowId ?? null
  if (!parentWindowId) {
    logger.warn(`[detached] ${workspaceId}: no parent window recorded, workspace:load → null`)
    return null
  }
  const data = await invokeHandler('workspace:load', [], parentWindowId)
  if (data === null) logger.warn(`[detached] ${workspaceId}: parent window ${parentWindowId} has no registry entry, workspace:load → null`)
  return data
}

/**
 * T0437 (BUG-105): the translator deciding which client paths a sender's host can read.
 * Unbound / local profile → Identity. A remote profile → the live connection's translator
 * when the slot serves it, otherwise one built from the profile (null = reject all).
 * `missingProfile`: a registry window whose profile is gone routes locally ('local'); a
 * detached window in that state is refused ('refuse'), so it resolves nothing.
 */
async function clientPathTranslatorForBinding(
  binding: SenderProfileBinding,
  missingProfile: 'local' | 'refuse',
): Promise<PathTranslator | null> {
  if (binding.kind === 'unresolved') return null
  if (!binding.profileId) return new IdentityTranslator()
  const profile = await profileManager.getProfile(binding.profileId).catch(() => null)
  if (!profile) return missingProfile === 'local' ? new IdentityTranslator() : null
  if (profile.type !== 'remote') return new IdentityTranslator()
  const live = remoteConnections.get(profile.id)?.client?.pathTranslator ?? null
  return clientPathTranslatorForProfile(profile, live)
}

/** T0437: `remote:resolve-client-paths` from a detached workspace window — its parent's profile. */
async function resolveDetachedClientPaths(workspaceId: string, args: unknown[]): Promise<unknown> {
  const translator = await clientPathTranslatorForBinding(await resolveDetachedBinding(workspaceId), 'refuse')
  return resolveClientPaths(translator, args[0], args[1])
}

function bindProxiedHandlersToIpc() {
  for (const channel of PROXIED_CHANNELS) {
    ipcMain.handle(channel, async (event, ...args: unknown[]) => {
      const windowId = getWindowIdByWebContents(event.sender)

      // T0453 (BUG-113): a detached workspace window reads its parent's workspaces, never writes them.
      if (!windowId && DETACHED_WORKSPACE_CHANNELS.has(channel)) {
        const detachedWorkspaceId = getDetachedWorkspaceIdByWebContents(event.sender)
        if (detachedWorkspaceId !== null) return invokeDetachedWorkspacePersistence(channel, detachedWorkspaceId)
      }

      // T0437: a detached workspace window resolves attachment paths as its parent's profile.
      if (!windowId && channel === 'remote:resolve-client-paths') {
        const detachedWorkspaceId = getDetachedWorkspaceIdByWebContents(event.sender)
        if (detachedWorkspaceId !== null) return resolveDetachedClientPaths(detachedWorkspaceId, args)
      }

      // ALWAYS_LOCAL channels never proxy.
      if (ALWAYS_LOCAL_CHANNELS.has(channel)) {
        return invokeHandler(channel, args, windowId)
      }

      // Route per sender window's profile type. A remote profile window
      // proxies to the remote server; a local profile window stays local
      // even if another window has an active remote connection.
      let senderIsRemote = false
      let senderProfileId: string | null = null
      if (windowId) {
        const entry = await windowRegistry.getEntry(windowId)
        if (entry?.profileId) {
          senderProfileId = entry.profileId
          const profile = await profileManager.getProfile(entry.profileId)
          senderIsRemote = profile?.type === 'remote'
        }
      } else {
        // T0446 (BUG-112): a detached workspace window routes as its parent window's
        // profile (fail-closed when that cannot be resolved). Its handlers still get
        // windowId null, so a local detached window behaves exactly as before.
        const detachedWorkspaceId = getDetachedWorkspaceIdByWebContents(event.sender)
        if (detachedWorkspaceId !== null) {
          const binding = await resolveDetachedBinding(detachedWorkspaceId)
          const boundProfileId = senderBindingProfileId(binding)
          const profile = boundProfileId ? await profileManager.getProfile(boundProfileId).catch(() => null) : null
          ;({ senderIsRemote, senderProfileId } = detachedSenderRouteIdentity(binding, profile ? profile.type : null))
        }
      }

      // T0443 (BUG-110): a remote-profile window that is not served by its own live
      // connection (no client, reconnecting, gave up) is refused, never run on this
      // machine; each refusal is also pushed to the window (the renderer shows one
      // notice per outage). T0463: only the sender profile's own registry entry
      // counts — another profile's connection never serves (or blocks) it.
      const conn = senderProfileId ? remoteConnections.connectionState(senderProfileId) : null
      const route = planProfileProxiedInvokeRoute({ senderIsRemote, senderProfileId, conn })
      if (route.kind === 'local') return invokeHandler(channel, args, windowId)
      const senderClient = route.kind === 'remote' ? liveRemoteClient(senderProfileId) : null
      if (senderClient) return senderClient.invoke(channel, args)
      const profileId = route.kind === 'refuse' ? route.profileId : senderProfileId ?? ''
      const reason = route.kind === 'refuse' ? route.reason : 'no-client'
      if (!event.sender.isDestroyed()) {
        event.sender.send(REMOTE_INVOKE_REFUSED_CHANNEL, { errorCode: REMOTE_NOT_CONNECTED, profileId, reason, channel })
      }
      throw Object.assign(new Error(formatRemoteNotConnectedError(channel, profileId, reason)), { code: REMOTE_NOT_CONNECTED, profileId, reason })
    })
  }
}

// ── Renderer debug log (fire-and-forget, no blocking) ──
ipcMain.on('debug:log', (_event, ...args: unknown[]) => {
  logger.log('[RENDERER]', ...args)
})

ipcMain.on('log:renderer-write', (_event, level: unknown, args: unknown[]) => {
  const payload = Array.isArray(args) ? args : [args]
  logger.writeRenderer(level, payload)
})

// ── Local-only IPC handlers (not proxied) ──

// T0393 (PLAN-036 P0-E): a WSL profile window's folder dialog opens in the
// distro user's home (`\\wsl.localhost\<distro>\home\<user>`). Same routing
// condition as bindProxiedHandlersToIpc: only while the window is actually
// served by its remote connection. Anything else → null (original default).
const resolveWslFolderDefault = createWslFolderDefaultResolver({
  log: (message) => logger.warn(message),
})

async function wslFolderDefaultForSender(sender: Electron.WebContents): Promise<string | null> {
  if (process.platform !== 'win32') return null
  try {
    // T0446: a detached workspace window uses its parent window's binding.
    const profileId = senderBindingProfileId(await getSenderProfileBinding(sender))
    if (!profileId || !liveRemoteClient(profileId)) return null
    const distro = wslDistroForFolderDialog(await profileManager.getProfile(profileId))
    if (!distro) return null
    const defaultPath = await resolveWslFolderDefault(distro)
    logger.log(`[wsl-folder] select-folder default for ${distro}: ${defaultPath ?? '(fallback to home)'}`)
    return defaultPath
  } catch (err) {
    logger.warn('[wsl-folder] select-folder default failed:', err)
    return null
  }
}

function registerLocalHandlers() {
  ipcMain.handle('dialog:select-folder', async (event) => {
    const parentWin = BrowserWindow.fromWebContents(event.sender)
    const wslDefaultPath = await wslFolderDefaultForSender(event.sender)
    const result = await dialog.showOpenDialog(parentWin!, {
      defaultPath: wslDefaultPath ?? app.getPath('home'),
      properties: ['openDirectory', 'createDirectory', 'multiSelections'],
    })
    return result.canceled ? null : result.filePaths
  })

  ipcMain.handle('dialog:select-images', async (event) => {
    const parentWin = BrowserWindow.fromWebContents(event.sender)
    const result = await dialog.showOpenDialog(parentWin!, {
      defaultPath: app.getPath('home'),
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] }],
      properties: ['openFile', 'multiSelections'],
    })
    return result.canceled ? [] : result.filePaths
  })

  ipcMain.handle('dialog:select-files', async (event) => {
    const parentWin = BrowserWindow.fromWebContents(event.sender)
    const result = await dialog.showOpenDialog(parentWin!, {
      defaultPath: app.getPath('home'),
      properties: ['openFile', 'multiSelections'],
    })
    return result.canceled ? [] : result.filePaths
  })

  // T0436 / BUG-108: Claude / Codex panel attachments. Images are read here, on the
  // client, from the paths this dialog returned — the renderer passes no path. Local-only
  // on purpose (not PROXIED_CHANNELS / registerHandler): see electron/image-attachments.ts.
  ipcMain.handle('dialog:select-attachments', async (event) => {
    const parentWin = BrowserWindow.fromWebContents(event.sender)
    const result = await dialog.showOpenDialog(parentWin!, {
      defaultPath: app.getPath('home'),
      properties: ['openFile', 'multiSelections'],
    })
    return readSelectedAttachments(result.canceled ? [] : result.filePaths)
  })

  ipcMain.handle('dialog:confirm', async (event, message: string, title?: string) => {
    const parentWin = BrowserWindow.fromWebContents(event.sender)
    const result = await dialog.showMessageBox(parentWin!, {
      type: 'warning',
      buttons: ['OK', 'Cancel'],
      defaultId: 1,
      cancelId: 1,
      title: title || 'Confirm',
      message,
    })
    return result.response === 0
  })

  // T0460 / BUG-105: file: URLs open with openPath; an executable asks first (main-side
  // dialog, Cancel is the default). T0461: other URLs reach shell.openExternal only for
  // http / https / mailto, and shell:open-path asks before an executable too.
  const statForOpen = (filePath: string) => {
    try {
      const st = fsSync.statSync(filePath)
      return { isFile: st.isFile(), mode: st.mode }
    } catch {
      return null
    }
  }
  const confirmExecutableFor = (sender: Electron.WebContents) => async (filePath: string) => {
    const options = buildExecutableConfirmDialog(filePath, process.platform, readPersistedSettingsSync()?.language)
    const parentWin = BrowserWindow.fromWebContents(sender)
    const result = parentWin ? await dialog.showMessageBox(parentWin, options) : await dialog.showMessageBox(options)
    return result.response === EXECUTABLE_CONFIRM_OPEN_INDEX
  }
  ipcMain.handle('shell:open-external', async (event, url: string) => handleOpenExternal(url, {
    platform: process.platform,
    openPath: (filePath) => shell.openPath(filePath),
    openExternal: (target) => shell.openExternal(target),
    exists: (filePath) => fsSync.existsSync(filePath),
    stat: statForOpen,
    confirmExecutable: confirmExecutableFor(event.sender),
    notifyNotFound: (filePath) => {
      dialog.showMessageBox({ type: 'warning', title: 'File not found', message: `File does not exist:\n${filePath}` })
    },
    logError: (message) => logger.error(message),
  }))
  ipcMain.handle('shell:open-path', async (event, folderPath: string) => handleOpenPath(folderPath, {
    platform: process.platform,
    openPath: (filePath) => shell.openPath(filePath),
    stat: statForOpen,
    confirmExecutable: confirmExecutableFor(event.sender),
    logError: (message) => logger.error(message),
  }))
  ipcMain.handle('shell:open-in-editor', async (_event, folderPath: string, editorType: 'code' | 'code-insiders', customPath?: string) => {
    const { execFile } = await import('child_process')
    const defaultCmd = editorType === 'code-insiders' ? 'code-insiders' : 'code'
    const raw = customPath?.trim().replace(/^["']+|["']+$/g, '').trim()
    const executable = raw || defaultCmd
    return new Promise<{ success: boolean; error?: { type: string; executable: string; message: string } }>((resolve) => {
      execFile(executable, ['--new-window', folderPath], { timeout: 10000, windowsHide: true }, (err) => {
        if (err) {
          logger.error(`Failed to open ${folderPath} in ${executable}:`, err)
          if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
            resolve({ success: false, error: { type: 'ENOENT', executable, message: `Executable not found: ${executable}` } })
            return
          }
          resolve({ success: false, error: { type: 'EXEC_ERROR', executable, message: err.message } })
          return
        }
        resolve({ success: true })
      })
    })
  })

  ipcMain.handle('update:check', async () => {
    try { return await checkForUpdates() }
    catch (error) { logger.error('Failed to check for updates:', error); return { hasUpdate: false, currentVersion: app.getVersion(), latestRelease: null } }
  })
  ipcMain.handle('update:get-version', () => app.getVersion())

  ipcMain.handle('clipboard:saveImage', async () => {
    const image = clipboard.readImage()
    if (image.isEmpty()) return null
    const os = await import('os')
    const filePath = path.join(os.tmpdir(), `bat-clipboard-${Date.now()}.png`)
    await fs.writeFile(filePath, image.toPNG())
    return filePath
  })
  // T0436 / BUG-108: panel paste attachments take the image straight from this machine's
  // clipboard (no temp file, no proxied image:read-as-data-url). clipboard:saveImage stays
  // for PromptBox, which needs a file path for the terminal agent.
  ipcMain.handle('clipboard:read-image-data-url', () => clipboardImageToDataUrl(clipboard.readImage()))
  ipcMain.handle('clipboard:writeImage', async (_event, filePath: string) => {
    const image = nativeImage.createFromPath(filePath)
    if (image.isEmpty()) return false
    clipboard.writeImage(image)
    return true
  })

  // Remote server handlers (always local)
  ipcMain.handle('remote:start-server', async (_event, port?: number, token?: string, bindInterface?: 'localhost' | 'tailscale' | 'all') => {
    try { return await remoteServer.start(port, token, bindInterface) }
    catch (err: unknown) { return { error: err instanceof Error ? err.message : String(err) } }
  })
  ipcMain.handle('remote:stop-server', async () => {
    remoteServer.stop()
    return true
  })
  ipcMain.handle('remote:server-status', async () => ({
    running: remoteServer.isRunning,
    port: remoteServer.port,
    bindInterface: remoteServer.bindInterface,
    host: remoteServer.host,
    fingerprint: remoteServer.currentFingerprint,
    clients: remoteServer.connectedClients
  }))

  // T0218 (PLAN-021): Hot-switch RemoteServer to a new port, retaining token.
  // On failure, attempts rollback to the old port so existing PTYs with
  // BAT_REMOTE_PORT env var don't break.
  ipcMain.handle('remote:restart-server', async (_event, newPort: number) => {
    try {
      if (!Number.isInteger(newPort) || newPort < REMOTE_PORT_MIN || newPort > REMOTE_PORT_MAX) {
        return { error: `Port ${newPort} out of range [${REMOTE_PORT_MIN}, ${REMOTE_PORT_MAX}]` }
      }
      return await remoteServer.restart(newPort)
    } catch (err: unknown) {
      return { error: err instanceof Error ? err.message : String(err) }
    }
  })

  // Mobile QR code connection: ensure server is running, return connection URL
  ipcMain.handle('tunnel:get-connection', async () => {
    try {
      if (!remoteServer.isRunning) {
        await remoteServer.start()
      }
      const port = remoteServer.port!
      const token = remoteServer.currentToken
      const fingerprint = remoteServer.currentFingerprint
      return getConnectionInfo(port, token, fingerprint)
    } catch (err: unknown) {
      return { error: err instanceof Error ? err.message : String(err) }
    }
  })

  // Remote client handlers
  ipcMain.handle('remote:connect', async (event, host: string, port: number, token: string, label?: string, fingerprint?: string) => {
    let boundProfileId: string | null = null
    try {
      // T0446 (BUG-112): a detached workspace window connects as its parent window's
      // profile; one whose binding cannot be resolved must not connect unpinned.
      const senderBinding = await getSenderProfileBinding(event.sender)
      if (senderBinding.kind === 'unresolved') {
        logger.warn(`[remote:connect] refused for a detached window with an unresolved profile binding (${host}:${port})`)
        return { error: 'Detached window profile binding could not be resolved', errorCode: 'binding-unresolved' }
      }
      boundProfileId = senderBinding.profileId
      const boundProfile = boundProfileId ? await profileManager.getProfile(boundProfileId) : null
      // T0463 (PLAN-039): keyed by the bound profile — a window without a binding has
      // no registry key and is refused (binding-missing). T0419 (BUG-096): pin with the
      // bound profile's fingerprint and reuse the client loadProfileSnapshotDetailed
      // already verified. T0430: a failed connect keeps the entry's current client and
      // tears down the candidate (SSH tunnel, reconnect timer).
      const outcome = await remoteConnections.connect({
        profileId: boundProfileId,
        profile: boundProfile,
        request: { host, port, token, fingerprint },
        run: (client, expectedFingerprint) => client.connect(host, port, token, label, expectedFingerprint),
      })
      pushRemoteClientStatus(boundProfileId)
      switch (outcome.kind) {
        case 'reject':
          logger.warn(`[remote:connect] refused for profile ${boundProfileId} (${host}:${port}) [${outcome.errorCode}]: ${outcome.error}`)
          return { error: outcome.error, errorCode: outcome.errorCode }
        case 'limit':
          logger.warn(`[remote:connect] refused for profile ${boundProfileId} (${host}:${port}): ${outcome.cap} remote profiles already connected`)
          return { error: `Too many remote profiles connected at once (limit ${outcome.cap})`, errorCode: 'remote-limit', limit: outcome.cap }
        case 'aborted':
          return { error: 'Connection was torn down while connecting', errorCode: 'aborted' }
        case 'failed':
          logger.warn(`[remote:connect] connect failed for profile ${boundProfileId} (${host}:${port}) [${outcome.result.errorCode ?? 'unknown'}]; keeping current client`)
          return { error: outcome.result.error || 'Connection failed (auth rejected or unreachable)', errorCode: outcome.result.errorCode, fingerprint: outcome.result.fingerprint }
        case 'reuse':
          logger.log(`[remote:connect] reusing verified client for profile ${boundProfileId} (${host}:${port})`)
          return { connected: true, fingerprint: outcome.fingerprint }
        case 'connected':
          warnSameTargetProfiles(boundProfileId, outcome)
          return { connected: true, fingerprint: outcome.result.fingerprint }
      }
    } catch (err: unknown) {
      pushRemoteClientStatus(boundProfileId)
      return { error: err instanceof Error ? err.message : String(err) }
    }
  })
  ipcMain.handle('remote:disconnect', async (event) => {
    // T0463: sender-scoped — only the connection of the profile the sender window is
    // bound to (a detached window: its parent's, T0446); other profiles are untouched.
    const profileId = senderBindingProfileId(await getSenderProfileBinding(event.sender))
    if (!profileId) return true
    await remoteConnections.dropProfile(profileId)
    pushRemoteClientStatus(profileId)
    return true
  })
  ipcMain.handle('remote:client-status', async (event) => {
    // T0446: a detached workspace window reports its parent window's connection.
    // T0463: the sender profile's own registry entry.
    const client = liveRemoteClient(senderBindingProfileId(await getSenderProfileBinding(event.sender)))
    return {
      connected: !!client,
      info: client?.connectionInfo ?? null,
    }
  })
  ipcMain.handle('remote:test-connection', async (_event, host: string, port: number, token: string, fingerprint?: string) => {
    const testClient = new RemoteClient(() => [])
    try {
      const result = await testClient.connect(host, port, token, undefined, fingerprint)
      testClient.disconnect()
      return {
        ok: result.ok,
        fingerprint: result.fingerprint,
        errorCode: result.errorCode,
        error: result.error,
        metadata: testClient.serverMetadata,
      }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  })
  // PLAN-031 T0319 — main process arch detection (WSL/Docker/SSH dispatch).
  // Renderer passes profileId; main resolves to full ProfileEntry via
  // profileManager — never trust an inline profile object from the renderer.
  ipcMain.handle('remote:detect-arch', async (_event, profileId: string) => {
    if (typeof profileId !== 'string' || !/^[a-zA-Z0-9._-]+$/.test(profileId)) {
      return { ok: false, error: 'Invalid profileId', errorCode: 'detect-failed' as const }
    }
    const profile = await profileManager.getProfile(profileId)
    if (!profile) {
      return { ok: false, error: `Profile not found: ${profileId}`, errorCode: 'no-state' as const }
    }
    const { detectRemoteArch } = await import('./remote/arch-detect')
    return detectRemoteArch(profile)
  })

  // PLAN-037 T0411 — remote toolchain detection for a profile from a window not
  // bound to it (setup wizard, settings): short connection to the profile's
  // bat-server → remote-tools:detect → disconnect. profileId validated like
  // remote:detect-arch; connection parameters come from the stored profile.
  ipcMain.handle('remote:detect-tools', async (_event, profileId: string) =>
    detectRemoteToolsForProfile(profileId, {
      getProfile: id => profileManager.getProfile(id),
      createClient: profile => new RemoteClient(() => [], profile),
      detectLocal: () => runRemoteToolsDetect({ isScrubbedEnvKey: isHeadlessScrubbedEnvKey }),
    }),
  )

  // PLAN-031 T0318 — server bundle download (manifest fetch + tarball + SHA verify).
  // Cancellation IPC deferred to T0320 distributor; current API is fire-and-resolve.
  ipcMain.handle(
    'server-bundle:download',
    async (
      evt,
      opts: {
        arch: 'linux-x64' | 'linux-arm64' | 'darwin-arm64'
        version: string
        baseURL?: string
        githubToken?: string
      },
    ) => {
      if (
        !opts ||
        typeof opts.arch !== 'string' ||
        !['linux-x64', 'linux-arm64', 'darwin-arm64'].includes(opts.arch) ||
        typeof opts.version !== 'string' ||
        opts.version.length === 0
      ) {
        return {
          ok: false as const,
          errorCode: 'manifest-fetch-failed' as const,
          error: 'Invalid arguments to server-bundle:download',
        }
      }
      const cacheDir = path.join(app.getPath('userData'), 'bat-server-bundles')
      const { downloadServerBundle } = await import('./remote/server-bundle-download')
      const onProgress = (event: {
        phase: 'manifest' | 'tarball'
        bytesDownloaded: number
        bytesTotal: number
        percent: number
      }) => {
        if (!evt.sender.isDestroyed()) {
          evt.sender.send('server-bundle:download-progress', event)
        }
      }
      return downloadServerBundle({
        arch: opts.arch,
        version: opts.version,
        cacheDir,
        baseURL: opts.baseURL,
        githubToken: opts.githubToken,
        onProgress,
      })
    },
  )

  // PLAN-031 T0320 — server bundle distributor (cache → baseline → download).
  // Resolves arch from profile, then dispatches three-layer lookup. Composes
  // T0316 baseline / T0317 SHA / T0318 download / T0319 detectRemoteArch.
  ipcMain.handle(
    'server-bundle:distribute',
    async (
      evt,
      opts: {
        // Either profileId (existing profile) OR draftProfile (wizard pre-write).
        // T0321: WSL install-bundle step runs before writeProfileStep so no
        // persisted profile exists yet — pass draftProfile with the minimal
        // fields needed by detectRemoteArch (targetOS + per-OS target field).
        profileId?: string
        draftProfile?: {
          targetOS: 'local' | 'wsl-linux' | 'docker-linux' | 'ssh-linux' | 'ssh-darwin'
          wslDistro?: string
          dockerContainer?: string
          dockerHost?: string
          sshHost?: string
          sshUser?: string
          sshPort?: number
          sshKeyPath?: string
          useSshTunnel?: boolean
          sshServerArch?: string
        }
        version?: string
        baseURL?: string
        githubToken?: string
      },
    ) => {
      let profile: ProfileEntry | null = null
      if (opts && typeof opts.profileId === 'string' && /^[a-zA-Z0-9._-]+$/.test(opts.profileId)) {
        profile = await profileManager.getProfile(opts.profileId)
        if (!profile) {
          return {
            ok: false as const,
            errorCode: 'arch-detection-failed' as const,
            error: `Profile not found: ${opts.profileId}`,
          }
        }
      } else if (opts && opts.draftProfile && typeof opts.draftProfile.targetOS === 'string') {
        const draft = opts.draftProfile
        // Validate per-OS target identifier with the same regex used by other
        // child_process spawn paths (CLAUDE.md Child Process Spawning rule).
        const NAME_RX = /^[a-zA-Z0-9._-]+$/
        if (draft.targetOS === 'wsl-linux') {
          if (!draft.wslDistro || !NAME_RX.test(draft.wslDistro)) {
            return {
              ok: false as const,
              errorCode: 'arch-detection-failed' as const,
              error: 'draftProfile.wslDistro missing or invalid',
            }
          }
        } else if (draft.targetOS === 'docker-linux') {
          if (!draft.dockerContainer || !NAME_RX.test(draft.dockerContainer)) {
            return {
              ok: false as const,
              errorCode: 'arch-detection-failed' as const,
              error: 'draftProfile.dockerContainer missing or invalid',
            }
          }
        } else if (draft.targetOS === 'ssh-linux' || draft.targetOS === 'ssh-darwin') {
          // T0322 — SSH path requires sshHost + sshUser + cached sshServerArch
          // (verify-auth step writes ctx.state.sshServerArch from `uname -sm`).
          // Distributor's arch-detect reads profile.sshServerArch directly with
          // no SSH re-fetch, so it must be present in the draftProfile.
          if (!draft.sshHost || typeof draft.sshHost !== 'string' || draft.sshHost.trim() === '') {
            return {
              ok: false as const,
              errorCode: 'arch-detection-failed' as const,
              error: 'draftProfile.sshHost missing or invalid',
            }
          }
          if (!draft.sshUser || !NAME_RX.test(draft.sshUser)) {
            return {
              ok: false as const,
              errorCode: 'arch-detection-failed' as const,
              error: 'draftProfile.sshUser missing or invalid',
            }
          }
          if (!draft.sshServerArch || typeof draft.sshServerArch !== 'string' || draft.sshServerArch.trim() === '') {
            return {
              ok: false as const,
              errorCode: 'arch-detection-failed' as const,
              error: 'draftProfile.sshServerArch missing — run verify-auth before install-bundle',
            }
          }
        }
        const now = Date.now()
        profile = {
          id: '__wizard_draft__',
          name: '__wizard_draft__',
          type: 'remote',
          createdAt: now,
          updatedAt: now,
          targetOS: draft.targetOS,
          wslDistro: draft.wslDistro,
          dockerContainer: draft.dockerContainer,
          dockerHost: draft.dockerHost,
          sshHost: draft.sshHost,
          sshUser: draft.sshUser,
          sshPort: draft.sshPort,
          sshKeyPath: draft.sshKeyPath,
          useSshTunnel: draft.useSshTunnel,
          sshServerArch: draft.sshServerArch,
        } as ProfileEntry
      } else {
        return {
          ok: false as const,
          errorCode: 'arch-detection-failed' as const,
          error: 'Either profileId or draftProfile must be provided',
        }
      }
      const { distributeServerBundle } = await import('./remote/server-bundle-distributor')
      const onProgress = (event: {
        phase: 'manifest' | 'tarball'
        bytesDownloaded: number
        bytesTotal: number
        percent: number
      }) => {
        if (!evt.sender.isDestroyed()) {
          evt.sender.send('server-bundle:distribute-progress', event)
        }
      }
      return distributeServerBundle({
        profile,
        version: opts.version,
        baseURL: opts.baseURL,
        githubToken: opts.githubToken,
        onProgress,
      })
    },
  )

  ipcMain.handle('remote:list-profiles', async (_event, host: string, port: number, token: string, fingerprint?: string) => {
    const tempClient = new RemoteClient(() => [])
    try {
      const result = await tempClient.connect(host, port, token, undefined, fingerprint)
      if (!result.ok) return { error: result.error || 'Connection failed', errorCode: result.errorCode, fingerprint: result.fingerprint }
      const listed = await tempClient.invoke('profile:list', []) as { profiles: { id: string; name: string; type: string }[]; activeProfileIds: string[] }
      tempClient.disconnect()
      return {
        profiles: listed.profiles.map(p => ({ id: p.id, name: p.name, type: p.type })),
        activeProfileIds: listed.activeProfileIds ?? [],
        fingerprint: result.fingerprint,
      }
    } catch (err) {
      tempClient.disconnect()
      return { error: err instanceof Error ? err.message : String(err) }
    }
  })

  // Profile handlers (local-only — list/load/activate/deactivate/get-active-ids are proxied)
  ipcMain.handle('profile:create', async (_event, name: string, options?: { type?: 'local' | 'remote'; remoteHost?: string; remotePort?: number; remoteToken?: string; remoteProfileId?: string; remoteFingerprint?: string }) => {
    const created = await profileManager.create(name, options)
    void syncWslKeepAlive('profile:create')
    return created
  })
  ipcMain.handle('profile:save', async (_event, profileId: string) => profileManager.save(profileId))
  ipcMain.handle('profile:delete', async (_event, profileId: string) => {
    const deleted = await profileManager.delete(profileId)
    void syncWslKeepAlive('profile:delete')
    return deleted
  })
  ipcMain.handle('profile:rename', async (_event, profileId: string, newName: string) => profileManager.rename(profileId, newName))
  ipcMain.handle('profile:duplicate', async (_event, profileId: string, newName: string) => {
    const duplicated = await profileManager.duplicate(profileId, newName)
    void syncWslKeepAlive('profile:duplicate')
    return duplicated
  })
  ipcMain.handle('profile:update', async (_event, profileId: string, updates: { remoteHost?: string; remotePort?: number; remoteToken?: string; remoteProfileId?: string; remoteFingerprint?: string; targetOS?: 'local' | 'wsl-linux' | 'docker-linux' | 'ssh-linux' | 'ssh-darwin'; wslDistro?: string; dockerContainer?: string; dockerHost?: string; dockerMounts?: Array<{ host: string; container: string }>; sshHost?: string; sshUser?: string; sshPort?: number; sshKeyPath?: string; useSshTunnel?: boolean; tunnelLocalPort?: number; sshServerArch?: string }) => {
    const previousFingerprint = (await profileManager.getProfile(profileId))?.remoteFingerprint
    const updated = await profileManager.update(profileId, updates)
    void syncWslKeepAlive('profile:update')
    // T0442: a pin change fails closed — the profile's client was verified against the
    // old pin. dropProfile queues on that profile's mutex, so a connect still in flight
    // with the old pin settles first and is dropped here (its entry already exists);
    // the window reconnects with the new pin. T0463: only this profile's connection.
    if (shouldDropProfileConnectionOnUpdate({
      applied: updated,
      previousFingerprint,
      nextFingerprint: updates.remoteFingerprint,
      hasConnection: remoteConnections.has(profileId),
    })) {
      logger.warn(`[profile:update] remoteFingerprint changed for profile ${profileId}; disconnecting its remote client`)
      await remoteConnections.dropProfile(profileId)
      pushRemoteClientStatus(profileId)
    }
    return updated
  })
  ipcMain.handle('profile:get', async (_event, profileId: string) => profileManager.getProfile(profileId))
  ipcMain.handle('docker:status', () => dockerDetect.dockerStatus())
  ipcMain.handle('docker:list-containers', () => dockerDetect.listContainers())
  ipcMain.handle('docker:inspect-container', (_event, name: string) => dockerDetect.inspectContainer(name))
  ipcMain.handle('docker:validate-mounts', (_event, mounts: Array<{ host: string; container: string }>) => dockerValidate.validateMountTable(mounts))
  ipcMain.handle('docker:start-container', (_event, name: string, options?: { createIfMissing?: boolean; image?: string; mounts?: Array<{ host: string; container: string }>; port?: number; restartPolicy?: string; token?: string; dataVolume?: string }) =>
    dockerLifecycle.startContainer(name, options))
  ipcMain.handle('docker:stop-container', (_event, name: string, options?: { remove?: boolean }) => dockerLifecycle.stopContainer(name, options))
  ipcMain.handle('docker:remove-container', (_event, name: string) => dockerLifecycle.removeContainer(name))
  ipcMain.handle('docker:restart-container', (_event, name: string) => dockerLifecycle.restartContainer(name))
  ipcMain.handle('docker:get-container-logs', (_event, name: string, options?: { tail?: number; follow?: boolean }) => dockerLifecycle.getContainerLogs(name, options))
  ipcMain.handle('docker:get-container-health', (_event, name: string) => dockerLifecycle.getContainerHealth(name))
  ipcMain.handle('wsl:list', () => wslDetect.list())
  ipcMain.handle('wsl:systemd-enabled', (_event, distro: string) => wslDetect.systemdEnabled(distro))
  ipcMain.handle('wsl:detect-network-mode', (_event, distro: string) => wslDetect.detectNetworkMode(distro))
  // T0378 (BUG-087 B): absolute $HOME so the systemd unit never contains `~`.
  ipcMain.handle('wsl:resolve-home', (_event, distro: string) => wslDetect.resolveHome(distro))
  ipcMain.handle('wsl:install-bundle', (_event, distro: string, tarballPath: string, installPath: string) =>
    wslDetect.installBundle(distro, tarballPath, installPath))
  ipcMain.handle('wsl:uninstall-bundle', async (_event, distro: string, installPath: string) => {
    try {
      await wslDetect.uninstallBundle(distro, installPath)
      return { ok: true as const }
    } catch (error) {
      return {
        ok: false as const,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  })
  // T0304 / BUG-069: runs in main so the renderer bundle never imports Node
  // builtins (D090). T0381 / BUG-090 (D128): the fingerprint is read from the
  // TLS handshake itself (the server has no HTTP handler), bounded by a 5s
  // timeout; failures come back as structured error codes for ErrorMapper.
  // T0387 / BUG-093: optional host — the SSH wizard targets its tunnel's local
  // end (127.0.0.1) or, in direct mode, the remote host. WSL / Docker omit it
  // and keep the 127.0.0.1 default. fetchTlsFingerprint validates the host.
  ipcMain.handle('wsl:fetch-fingerprint', async (_event, port: number, host?: string): Promise<FetchFingerprintResult> => {
    const result = await fetchTlsFingerprint(port, host === undefined ? {} : { host })
    if (!result.ok) {
      logger.warn(`[wizard] fetch-fingerprint ${result.errorCode}: ${result.error}`)
    }
    return result
  })
  // T0382 / BUG-091 (D128): pick the WSL bat-server port on the Windows side.
  // Mirrored mode shares localhost, so the host RemoteServer's port — both the
  // resolved startup port (env > settings > default) and the one actually
  // running — must never be handed to the WSL server.
  ipcMain.handle('wsl:pick-server-port', async (_event, preferredPort?: number): Promise<wslSystemd.PickServerPortResult> => {
    const excludePorts = [readRemotePortSync()]
    if (remoteServer.port) excludePorts.push(remoteServer.port)
    const result = await wslSystemd.pickServerPort({ excludePorts, preferredPort })
    if (result.ok) {
      logger.log(`[wizard] pick-server-port -> ${result.port} (excluded host ports: ${excludePorts.join(', ')})`)
    } else {
      logger.warn(`[wizard] pick-server-port ${result.errorCode}: ${result.error}`)
    }
    return result
  })
  // T0387: the SSH wizard tunnel's local end must avoid the host RemoteServer
  // ports (same pair the WSL port picker excludes).
  registerSshSetupHandlers(ipcMain, {
    reservedPorts: () => {
      const ports = [readRemotePortSync()]
      if (remoteServer.port) ports.push(remoteServer.port)
      return ports
    },
  })

  // T0348 / BUG-078 — Control Tower drift telemetry IPC.
  // Renderer parses workorder frontmatter and produces ParseWarning[]; main
  // process owns the log file (D090: no node:fs in renderer bundle).
  ipcMain.handle('ctDrift:log', (_event, file: string, warnings: CtParseWarning[] | undefined): number => {
    return ctDriftLog(file, warnings, { userDataDir: app.getPath('userData') })
  })
  ipcMain.handle('ctDrift:readRecent', (_event, options?: { days?: number }): CtDriftEntry[] => {
    return ctDriftReadRecent({
      userDataDir: app.getPath('userData'),
      days: options?.days,
    })
  })

  ipcMain.handle('wsl-systemd:write-unit', (_event, distro: string, unit: { path?: string; content?: string; execStart?: string; description?: string; environment?: Record<string, string> }) =>
    wslSystemd.writeUnit(distro, unit))
  ipcMain.handle('wsl-systemd:enable-linger', (_event, distro: string) => wslSystemd.enableLinger(distro))
  // T0382 (BUG-091): only dataDir / timeoutMs cross IPC; the stability window
  // (stableMs / pollMs) stays at its main-side defaults.
  ipcMain.handle('wsl-systemd:start-service', (_event, distro: string, serviceName: string, options?: { dataDir?: string; timeoutMs?: number }) =>
    wslSystemd.startService(distro, serviceName, { dataDir: options?.dataDir, timeoutMs: options?.timeoutMs }))
  // T0384 (BUG-092): the wizard pins a holder right after writing the unit so
  // the distro survives the fingerprint / connect-test steps; rollback unpins.
  ipcMain.handle('wsl:keep-alive', (_event, distro: string) => {
    try {
      wslKeepAlive.pin(distro)
      return { ok: true as const }
    } catch (err) {
      return { ok: false as const, error: err instanceof Error ? err.message : String(err) }
    }
  })
  ipcMain.handle('wsl:release-keep-alive', (_event, distro: string) => {
    wslKeepAlive.unpin(distro)
    return { ok: true as const }
  })
  ipcMain.handle('wsl-systemd:remove-unit', (_event, distro: string, serviceName: string, options?: { path?: string }) =>
    wslSystemd.removeUnit(distro, serviceName, options))

  // Get the profile ID this instance was launched with (--profile= argument)
  ipcMain.handle('app:get-launch-profile', () => launchProfileId)
  ipcMain.handle('app:get-window-id', (event) => getWindowIdByWebContents(event.sender))
  // Get the profile ID bound to this window's registry entry
  // (T0446: a detached workspace window reports its parent window's binding.)
  ipcMain.handle('app:get-window-profile', async (event) =>
    senderBindingProfileId(await getSenderProfileBinding(event.sender)))
  ipcMain.handle('app:get-user-data-path', () => app.getPath('userData'))
  // Get this window's index within its profile (1-based)
  ipcMain.handle('app:get-window-index', async (event) => {
    const windowId = getWindowIdByWebContents(event.sender)
    if (!windowId) return 1
    const entries = await windowRegistry.readAll()
    const entry = entries.find(e => e.id === windowId)
    if (!entry?.profileId) return 1
    const sameProfile = entries.filter(e => e.profileId === entry.profileId)
    return sameProfile.findIndex(e => e.id === windowId) + 1
  })

  // Dock badge count (macOS/Linux)
  ipcMain.handle('app:set-dock-badge', (_event, count: number) => {
    if (process.platform === 'darwin') {
      app.dock.setBadge(count > 0 ? String(count) : '')
    } else if (process.platform === 'linux') {
      app.setBadgeCount(count)
    }
  })

  // Open new empty window (Cmd+N) — inherits profileId from source window
  ipcMain.handle('app:new-window', async (event) => {
    // T0446 (BUG-112): from a detached workspace window, inherit its parent's profile;
    // an unresolved binding must not open an unbound (local) window.
    const sourceBinding = await getSenderProfileBinding(event.sender)
    if (sourceBinding.kind === 'unresolved') {
      logger.warn('[app:new-window] refused: detached source window has an unresolved profile binding')
      return null
    }
    const profileId = sourceBinding.profileId ?? undefined
    const entry = await windowRegistry.createEntry({ profileId })
    createWindow(entry.id)
    return entry.id
  })

  ipcMain.handle('app:restart', () => {
    app.relaunch()
    app.quit()
    return true
  })

  // Open profile windows (focus existing if already open, otherwise restore all from snapshot)
  const openProfileWindows = async (profileId: string) => {
    const entries = await windowRegistry.readAll()
    const existingForProfile = entries.filter(e => e.profileId === profileId)

    // If any windows already open for this profile, focus the most recent one
    const openWindows = existingForProfile.filter(e => {
      const win = windowMap.get(e.id)
      return win && !win.isDestroyed()
    })
    if (openWindows.length > 0) {
      const mostRecent = openWindows.sort((a, b) => b.lastActiveAt - a.lastActiveAt)[0]
      const win = windowMap.get(mostRecent.id)!
      if (win.isMinimized()) win.restore()
      win.focus()
      return { alreadyOpen: true, windowId: mostRecent.id }
    }

    // Mark profile as active
    await profileManager.activateProfile(profileId)

    // Load profile snapshot (handles both local and remote profiles)
    const result = await loadProfileSnapshotDetailed(profileId)
    if (result.kind === 'remote-unreachable') {
      showRemoteProfileFailureDialog(result)
      await profileManager.deactivateProfile(profileId).catch(() => { /* ignore */ })
      // T0464: the cap refusal has its own code (the dialog above already explained it).
      return { alreadyOpen: false, windowIds: [], error: result.reason === 'limit' ? 'remote-limit' : 'remote-unreachable' }
    }
    const snapshot = result.snapshot
    if (snapshot && snapshot.windows.length > 0) {
      const windowIds: string[] = []
      for (const winSnap of snapshot.windows) {
        const entry = await windowRegistry.createEntry({ profileId })
        entry.workspaces = winSnap.workspaces
        entry.activeWorkspaceId = winSnap.activeWorkspaceId
        entry.activeGroup = winSnap.activeGroup
        entry.terminals = winSnap.terminals
        entry.activeTerminalId = winSnap.activeTerminalId
        entry.bounds = winSnap.bounds
        await windowRegistry.saveEntry(entry)
        createWindow(entry.id, winSnap.bounds)
        windowIds.push(entry.id)
      }
      return { alreadyOpen: false, windowIds }
    }

    // Fallback: no snapshot data, open empty window
    const entry = await windowRegistry.createEntry({ profileId })
    createWindow(entry.id)
    return { alreadyOpen: false, windowIds: [entry.id] }
  }
  ipcMain.handle('app:open-new-instance', async (_event, profileId: string) => openProfileWindows(profileId))

  // PLAN-037 T0412 — cross-window remote-tool install (both local-only). A local window
  // (wizard / ProfileCard) parks { profileId, toolId, kind } and the profile's window is
  // opened or focused; only a connected window bound to that profile can take it (taking
  // deletes it), then rebuilds the command from its own detection and runs it in a tab.
  const pendingRemoteToolInstalls = new PendingRemoteToolInstalls()
  const remoteToolInstallIpc = createRemoteToolInstallIpc(pendingRemoteToolInstalls, {
    getProfile: id => profileManager.getProfile(id),
    openProfileWindow: openProfileWindows,
    notifyProfileWindows: (profileId) => {
      for (const win of getWindowsForProfile(profileId)) win.webContents.send('remote-tools:install-pending')
    },
  })
  ipcMain.handle('remote-tools:request-install', async (_event, request: unknown) =>
    remoteToolInstallIpc.requestInstall(request))
  ipcMain.handle('remote-tools:take-pending-install', async (event) => {
    // T0446: registry windows only — a detached workspace window (no entry) takes
    // nothing; its parent window takes the request.
    const senderWindowId = getWindowIdByWebContents(event.sender)
    const senderEntry = senderWindowId ? await windowRegistry.getEntry(senderWindowId) : null
    const profileId = senderEntry?.profileId ?? null
    // Same "is this window's remote connection live" rule as remote:client-status.
    const connected = !!liveRemoteClient(profileId)
    return remoteToolInstallIpc.takePendingInstall({ profileId, connected })
  })

  // Cross-window workspace move (re-index only, no session rebuild)
  ipcMain.handle('workspace:move-to-window', async (_event, sourceWindowId: string, targetWindowId: string, workspaceId: string, insertIndex: number) => {
    const sourceEntry = await windowRegistry.getEntry(sourceWindowId)
    const targetEntry = await windowRegistry.getEntry(targetWindowId)
    if (!sourceEntry || !targetEntry) return false

    // Find workspace in source
    const srcWorkspaces = sourceEntry.workspaces as any[]
    const wsIndex = srcWorkspaces.findIndex((w: any) => w.id === workspaceId)
    if (wsIndex === -1) return false
    const [workspace] = srcWorkspaces.splice(wsIndex, 1)

    // Move associated terminals (single pass)
    const movedTerminals: any[] = []
    const remainingTerminals: any[] = []
    for (const t of sourceEntry.terminals as any[]) {
      if (t.workspaceId === workspaceId) movedTerminals.push(t)
      else remainingTerminals.push(t)
    }
    sourceEntry.terminals = remainingTerminals

    // Insert workspace at target position
    const tgtWorkspaces = targetEntry.workspaces as any[]
    const clampedIndex = Math.min(insertIndex, tgtWorkspaces.length)
    tgtWorkspaces.splice(clampedIndex, 0, workspace)
    ;(targetEntry.terminals as any[]).push(...movedTerminals)

    // Fix activeWorkspaceId if the moved workspace was active in source
    if (sourceEntry.activeWorkspaceId === workspaceId) {
      sourceEntry.activeWorkspaceId = srcWorkspaces[0]?.id || null
    }
    // Set moved workspace as active in target
    targetEntry.activeWorkspaceId = workspaceId

    // Fix activeTerminalId in source if it belonged to the moved workspace
    const movedTerminalIds = new Set(movedTerminals.map((t: any) => t.id))
    if (sourceEntry.activeTerminalId && movedTerminalIds.has(sourceEntry.activeTerminalId)) {
      sourceEntry.activeTerminalId = null
    }

    // Save both entries
    sourceEntry.lastActiveAt = Date.now()
    targetEntry.lastActiveAt = Date.now()
    await windowRegistry.saveEntry(sourceEntry)
    await windowRegistry.saveEntry(targetEntry)

    // Notify both renderers to reload
    const sourceWin = windowMap.get(sourceWindowId)
    const targetWin = windowMap.get(targetWindowId)
    if (sourceWin && !sourceWin.isDestroyed()) sourceWin.webContents.send('workspace:reload')
    if (targetWin && !targetWin.isDestroyed()) targetWin.webContents.send('workspace:reload')
    broadcastHub.broadcast('workspace:reload')

    logger.log(`[workspace] Moved workspace ${workspaceId} from ${sourceWindowId} to ${targetWindowId}`)
    return true
  })

  // Workspace detach/reattach (local window management)
  ipcMain.handle('workspace:detach', async (event, workspaceId: string) => {
    if (detachedWindows.has(workspaceId)) {
      const existing = detachedWindows.get(workspaceId)!
      if (!existing.isDestroyed()) existing.focus()
      return true
    }
    // T0446 (BUG-112): the detached window acts for the parent's profile; record the
    // parent and its binding now so routing still knows it once the parent is gone.
    const parentRecord = event.sender.isDestroyed() ? null : getDetachedWorkspaceIdByWebContents(event.sender)
    const record: DetachedWindowRecord = {
      parentWindowId: parentRecord !== null
        ? detachedWindowRecords.get(parentRecord)?.parentWindowId ?? null
        : getWindowIdByWebContents(event.sender),
      profileId: null,
      resolved: false,
    }
    try {
      const binding = await getSenderProfileBinding(event.sender)
      if (binding.kind === 'bound') Object.assign(record, { profileId: binding.profileId, resolved: true })
    } catch (err) {
      logger.warn(`[detached] profile binding unreadable when detaching ${workspaceId}:`, err)
    }
    if (detachedWindows.has(workspaceId)) {
      const existing = detachedWindows.get(workspaceId)!
      if (!existing.isDestroyed()) existing.focus()
      return true
    }
    const parentWin = BrowserWindow.fromWebContents(event.sender)
    const detachedWin = new BrowserWindow({
      width: 900, height: 700, minWidth: 600, minHeight: 400,
      webPreferences: { preload: path.join(__dirname, 'preload.js'), nodeIntegration: false, contextIsolation: true },
      frame: true, titleBarStyle: 'default', icon: nativeImage.createFromPath(path.join(__dirname, process.platform === 'win32' ? '../assets/icon.ico' : '../assets/icon.png'))
    })
    guardWindowNavigation(detachedWin)
    setupResizeThrottle(detachedWin, 'detached')
    detachedWindows.set(workspaceId, detachedWin)
    detachedWindowRecords.set(workspaceId, record)
    logger.log(`[detached] ${workspaceId} detached from window ${record.parentWindowId ?? '(none)'} profile=${record.resolved ? record.profileId ?? '(none)' : '(unresolved)'}`)
    const urlParam = `?detached=${encodeURIComponent(workspaceId)}`
    if (VITE_DEV_SERVER_URL) { detachedWin.loadURL(VITE_DEV_SERVER_URL + urlParam) }
    else { detachedWin.loadFile(path.join(__dirname, '../dist/index.html'), { search: urlParam }) }
    detachedWin.on('closed', () => {
      if (detachedWindows.get(workspaceId) === detachedWin) {
        detachedWindows.delete(workspaceId)
        detachedWindowRecords.delete(workspaceId)
      }
      noteRemoteWindowClosed()
      if (parentWin && !parentWin.isDestroyed()) parentWin.webContents.send('workspace:reattached', workspaceId)
    })
    if (parentWin && !parentWin.isDestroyed()) parentWin.webContents.send('workspace:detached', workspaceId)
    return true
  })

  ipcMain.handle('workspace:reattach', async (_event, workspaceId: string) => {
    const win = detachedWindows.get(workspaceId)
    if (win && !win.isDestroyed()) win.close()
    detachedWindows.delete(workspaceId)
    detachedWindowRecords.delete(workspaceId)
    return true
  })

  // ── Agent Runtime IPC ──

  ipcMain.handle('agent:list-definitions', () => {
    return agentRegistry.listAll()
  })

  ipcMain.handle('agent:get-definition', (_event, id: string) => {
    return agentRegistry.get(id) ?? null
  })

  ipcMain.handle('agent:build-launch-command', async (_event, definitionId: string, options?: Record<string, string | boolean>) => {
    await ensureElevationApplied()
    // Renderer appends agentCustomArgs itself; pass the persisted copy only so the
    // registry can skip flags the user already set (T0377 daemon opt-out dedup).
    const extraArgs = readPersistedSettingsSync()?.agentCustomArgs?.[definitionId]
    return agentRegistry.buildLaunchCommand(definitionId, options, extraArgs)
  })

  ipcMain.handle('agent:register-custom-cli', (_event, def: CustomCliDefinition) => {
    return agentRegistry.registerCustomCli(def)
  })

  ipcMain.handle('agent:remove-custom-cli', (_event, id: string) => {
    return agentRegistry.removeCustomCli(id)
  })

  ipcMain.handle('agent:list-custom-clis', () => {
    return agentRegistry.listCustomClis()
  })

  ipcMain.handle('agent:save-custom-clis', async () => {
    try {
      const customClis = agentRegistry.listCustomClis()
      const dataPath = path.join(app.getPath('userData'), 'custom-clis.json')
      await fs.promises.writeFile(dataPath, JSON.stringify(customClis, null, 2), 'utf-8')
      return true
    } catch (err) {
      console.error('[agent] Failed to save custom CLIs:', err)
      return false
    }
  })

  ipcMain.handle('agent:load-custom-clis', async () => {
    try {
      const dataPath = path.join(app.getPath('userData'), 'custom-clis.json')
      const data = await fs.promises.readFile(dataPath, 'utf-8')
      const clis = JSON.parse(data) as CustomCliDefinition[]
      for (const cli of clis) {
        agentRegistry.registerCustomCli(cli)
      }
      return true
    } catch {
      return false
    }
  })

  // ── Supervisor / cross-terminal IPC ──
  ipcMain.handle('supervisor:list-workers', (_event, workspaceTerminalIds: string[]) => {
    if (!ptyManager) return []
    return workspaceTerminalIds.map(id => ({
      id,
      lastOutput: ptyManager!.getLastOutput(id, 10).join('\n'),
      alive: ptyManager!.isAlive(id)
    }))
  })

  ipcMain.handle('supervisor:send-to-worker', (_event, targetId: string, text: string) => {
    if (!ptyManager) return false
    return ptyManager.writeToTerminal(targetId, text)
  })

  ipcMain.handle('supervisor:get-worker-output', (_event, targetId: string, lines: number) => {
    if (!ptyManager) return []
    return ptyManager.getLastOutput(targetId, lines)
  })

  // T0111: Pull-model query — renderer calls this after mounting to catch events sent before listener was ready
  ipcMain.handle('terminal-server:query-pending-recovery', () => {
    return pendingRecovery ? { ptyCount: pendingRecovery.ptyCount } : null
  })

  // T0110: Recovery prompt IPC handlers
  ipcMain.on('terminal-server:recover', async () => {
    if (!pendingRecovery) return
    const { port } = pendingRecovery
    pendingRecovery = null
    if (!ptyManager) return

    // T0111: If IPC is still connected (View→Reload case), skip TCP connect to avoid
    // dual-channel output duplication (broadcastToAll would send via IPC + TCP both).
    if (ptyManager.isIpcConnected()) {
      logger.log(`[terminal-server] user chose recovery — IPC already active, sending pty:list directly`)
      ptyManager.sendToServer({ type: 'pty:list' })
      return
    }

    const connected = await ptyManager.connectToServer(port)
    if (connected) {
      logger.log(`[terminal-server] user chose recovery — connected to port ${port}`)
      ptyManager.sendToServer({ type: 'pty:list' })
    } else {
      // Server died while prompt was showing — fall back to new server
      logger.warn('[terminal-server] recovery failed (server died) — falling back to new server')
      const userDataPath = app.getPath('userData')
      removePidFile(userDataPath)
      removePortFile(userDataPath)
      _terminalServerStarted = false
      await startTerminalServer()
    }
  })

  ipcMain.on('terminal-server:fresh-start', async () => {
    if (!pendingRecovery) return
    const { port } = pendingRecovery
    pendingRecovery = null

    // Shutdown old server gracefully
    try { await sendShutdownToServer(port) } catch { /* server may already be dead */ }

    const userDataPath = app.getPath('userData')
    removePidFile(userDataPath)
    removePortFile(userDataPath)

    _terminalServerStarted = false
    await startTerminalServer()
  })

}

// ── Initialize all IPC ──
const _t0 = Date.now()
registerProxiedHandlers()
bindProxiedHandlersToIpc()
registerLocalHandlers()
console.log(`[startup] IPC registration: ${Date.now() - _t0}ms`)
