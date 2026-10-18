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
import { isTerminalAutoReply, normalizeWorkorderId, type CloseWorkerPtyManager } from './close-worker'
import type { CtMode } from './ct-mode'
import type { CtWorktreeRecord } from './ct-worktree'
import { LaunchSuspectWatcher, TerminalBlockedTracker, type BlockedDetection, type BlockedState, type HookReportEvent, type HookReportResult } from './terminal-blocked-state'
import { CodexStateScanner, lastCodexState } from '../src/lib/codex-terminal-state'

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
   * T0448 (T0445 #4): the `customEnv` this process was spawned with. `restart` re-uses it: a
   * restarted worker keeps `BAT_TOWER_TERMINAL_ID`, so headless re-issues it a worker capability
   * for the same tower instead of promoting it to tower. T0525 (BUG-131): recorded on every
   * spawn path (Terminal Server too) and re-used by Electron's restart and the Terminal Server
   * recovery rebuild as well — workspace / global env vars and `CT_MODE` / `CT_INTERACTIVE`
   * survive them.
   */
  customEnv?: Record<string, string>
  /**
   * T0523 / BUG-129: the workspace this PTY was created for (its `BAT_WORKSPACE_ID`). `restart`
   * passes it on; before T0523 a restarted PTY got `BAT_WORKSPACE_ID=''`.
   */
  workspaceId?: string
  /** T0525 (BUG-131): the `agentPreset` it was created with (decides `claudeCliUpdateGuardEnv`). */
  agentPreset?: string
  /**
   * PLAN-041 / T0535: the work order a Tower dispatched this Worker for (`terminal:create-agent-command`
   * `workorder`, normalized). With `customEnv.BAT_TOWER_TERMINAL_ID` it is what `--close-worker`
   * looks up. Kept by `restart` and the Terminal Server recovery. Not known to a PTY registered
   * from the Terminal Server's list (T0108) or re-created by a restored tab after BAT reopens —
   * main then takes it from the saved tab (T0537, `electron/worker-ownership.ts`).
   */
  workorder?: string
  /**
   * PLAN-047 W1 / T0583: the worktree a `--isolation worktree` dispatch created for this Worker
   * (electron/ct-worktree.ts) — `--close-worker --worktree remove|archive` cleans it after the tab
   * closes. Kept by `restart` and the Terminal Server recovery, like `workorder`; after BAT reopens
   * main takes it from the saved tab (T0537 path).
   */
  worktree?: CtWorktreeRecord
  /**
   * T0565 / D148: the role a program in this tab declared (`bat-terminal.mjs --set-role tower`,
   * `terminal:set-role`) and the CT mode it declared with it (`--mode`; undefined = never given).
   * Kept by `restart` and the Terminal Server recovery; gone with the instance when the PTY ends.
   * Not known to a PTY registered from the Terminal Server's list (T0108) until CT declares again.
   */
  role?: 'tower'
  towerMode?: CtMode
}

/**
 * PLAN-047 M1 / T0582: what the helper query channels (`terminal:whoami` / `list` / `get-state`,
 * electron/terminal-query-handlers.ts) read about a running PTY. A copy; never the env.
 */
export interface PtyTerminalInfo {
  id: string
  cwd: string
  workspaceId?: string
  /** `customEnv.BAT_TOWER_TERMINAL_ID`: the Tower that dispatched it. */
  towerTerminalId?: string
  workorder?: string
  agentPreset?: string
  role?: 'tower'
  towerMode?: CtMode
  yolo: boolean
}

/**
 * T0582: a PTY that ended recently (exit / kill), so `terminal:get-state` can answer `exited` and
 * `terminal:read-output` can still read its last output. At most `EXITED_PTY_RECORD_MAX`, for
 * `EXITED_PTY_RECORD_TTL_MS`; a running PTY with the same id (restart, re-create) wins.
 */
export interface ExitedPtyRecord extends Omit<PtyTerminalInfo, 'yolo' | 'role' | 'towerMode'> {
  exitedAt: number
  /** Unknown for a kill until the process's own exit arrives (it may never). */
  exitCode?: number
  lastOutputAt: number | null
  /** The last `EXITED_PTY_TAIL_MAX_CHARS` of its replay buffer (`total` as it was). */
  tail: PtyReplayBuffer
  /**
   * PLAN-047 Q3 / T0589: `PtyInstance.worktree` of an isolated Worker, so `worktree:terminal-status`
   * still answers after its tab closed (electron/worktree-status-handlers.ts).
   */
  worktree?: CtWorktreeRecord
  /** T0600: when its claude ran `SessionStart` (ms epoch); absent = not reported before it ended. */
  agentStartedAt?: number
  /** T0642: the session id its claude's last `SessionStart` sent; absent = none known when it ended. */
  claudeSessionId?: string
}

/** T0582: exited PTYs remembered (oldest dropped first). */
export const EXITED_PTY_RECORD_MAX = 32
/** T0582: how long an exited PTY is remembered. */
export const EXITED_PTY_RECORD_TTL_MS = 10 * 60_000
/** T0582: raw output kept per exited PTY (UTF-16 code units). */
export const EXITED_PTY_TAIL_MAX_CHARS = 32 * 1024

/** T0535: `CreatePtyOptions` + the work order of a helper-dispatched Worker (main-side only); T0583: + its worktree. */
export type PtyManagerCreateOptions = CreatePtyOptions & { workorder?: string; worktree?: CtWorktreeRecord }

/** T0525 (BUG-131): what a PTY's env is built from; recorded on the instance for rebuilds. */
interface PtyEnvSpec {
  customEnv: Record<string, string>
  workspaceId?: string
  agentPreset?: string
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
   * T0481 (BUG-119): with it, `dataDir` is injected as `BAT_USER_DATA` too — the helpers find
   * `server-cert.json` / `Logs` there instead of guessing the directory from the app name
   * (a `--runtime=N` instance has no `BAT_RUNTIME` in its PTYs). Same name and value the
   * Terminal Server's PTYs already inherit from its process env (main.ts fork).
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
   * revokes the PTY's helper capability here (Electron too since T0575). Undefined = no hook.
   */
  onPtyExit?: (id: string) => void
  /**
   * PLAN-048 / T0607: the Terminal Server died and its PTYs are being rebuilt under the same ids
   * (no `onPtyExit` for them) — Electron cancels every pending tower question here. A throwing
   * listener is logged and ignored. Undefined = no hook.
   */
  onServerRecovery?: () => void
  /**
   * T0609 (BUG-153): PTY `id`'s `blocked` changed (a hook report, the user's input, the PTY
   * ending, the Terminal Server recovery) — the renderer push (electron/terminal-attention.ts).
   * Called synchronously; a throwing listener is logged and ignored. Undefined = no hook.
   */
  onBlockedChange?: (id: string) => void
  /**
   * T0433: extra env for the helpers (`bat-terminal.mjs` / `bat-notify.mjs`) inside PTY `id`,
   * spread last so neither `customEnv` nor the inherited env can override it. Called once
   * per PTY actually spawned — never for an idempotent re-create of a running id, whose
   * env (and helper capability) must stay valid. Both hosts issue the PTY's capability here
   * (`BAT_REMOTE_PORT` / `BAT_REMOTE_TOKEN`; Electron since T0575, `buildLocalHelperEnv`); the
   * server token never goes through it. Inherited `BAT_REMOTE_*` it does not supply are dropped
   * from the PTY env (a BAT started inside a BAT tab, T0575). Undefined = nothing extra.
   */
  helperEnv?: (id: string, customEnv: Record<string, string>) => Record<string, string>
  /**
   * PLAN-044 / T0566: every chunk of live PTY output (direct and Terminal Server), as it is
   * queued for the `pty:output` broadcast — not the T0108 replay of a reconnected Terminal
   * Server. The usage-limit scheduler reads the screen from it. A throwing listener is logged
   * and ignored. Undefined = no hook.
   */
  onPtyOutput?: (id: string, data: string) => void
  /**
   * PLAN-047 / T0576: the PTYs that survived on the Terminal Server — called with the T0108
   * replay list (`pty:list` after a reconnect; ids registered from it are running) and with `[]`
   * when the Terminal Server died (T0112 recovery: no earlier PTY survives; the rebuilt ones are
   * new spawns). Electron settles its restored helper capabilities here. A throwing listener is
   * logged and ignored. Undefined = no hook.
   */
  onSurvivingPtys?: (ids: string[]) => void
  /**
   * PLAN-050 / T0642: a `session-start` report changed running PTY `id`'s claude session id
   * (`getClaudeSessionId`). Not called when the PTY ends (`onPtyExit`) or for the Terminal Server
   * recovery (`onServerRecovery`), which drop it. Electron persists the session ids here. A
   * throwing listener is logged and ignored. Undefined = no hook.
   */
  onClaudeSessionChange?: (id: string) => void
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

export class PtyManager implements CloseWorkerPtyManager {
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

  // T0535 (PLAN-041): when each PTY last produced output / got input typed in a local window.
  // `--close-worker` refuses a busy Worker and cancels a delayed close on either.
  private lastOutputAt: Map<string, number> = new Map()
  private lastUserInputAt: Map<string, number> = new Map()
  // BUG-151 / T0598: input that reached a dispatched PTY before its launch command (in order)
  private dispatchInputHolds: Map<string, string[]> = new Map()
  // T0582: recently ended PTYs (insertion order = oldest first), for the helper query channels
  private exitedPtys: Map<string, ExitedPtyRecord> = new Map()
  // PLAN-047 M1b-1 / T0590: `blocked` (claude hooks) and each terminal's `blockedDetection`
  // T0609: `deps` is assigned by the constructor before any report can arrive
  // T0642: + the claude session id of a `session-start` (`onClaudeSessionChange`)
  private blockedTracker = new TerminalBlockedTracker(
    logger,
    undefined,
    id => this.deps.onBlockedChange?.(id),
    id => this.deps.onClaudeSessionChange?.(id),
  )
  // T0600 option B: `[agent-command] launch-suspect` (log only)
  private launchSuspect = new LaunchSuspectWatcher(logger)
  // T0621: codex's OSC 7501 in the live output (read only) → `blockedTracker.observeCodexState`
  private codexStates = new CodexStateScanner()

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

  // BUG-146 / T0578: while the Recovery prompt is unanswered, `pty:create` waits here instead of
  // spawning a direct shell for an id that may be running on the surviving Terminal Server.
  private createHold: { waiters: Array<() => void>; heldIds: string[]; releaseTimer: ReturnType<typeof setTimeout> | null } | null = null
  /** How long a recover waits for the Terminal Server's PTY list before releasing anyway. */
  static readonly CREATE_HOLD_LIST_TIMEOUT_MS = 5_000

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

  /**
   * T0140: `BAT_HELPER_DIR` env entry, omitted when the host has no helper dir.
   * T0481: plus `BAT_USER_DATA` (the helpers' data dir) under the same condition, so headless
   * — no `helperDir`; its helper paths come from `helperEnv` — is unchanged.
   */
  private localHelperEnv(): { BAT_HELPER_DIR?: string; BAT_USER_DATA?: string } {
    if (!this.deps.helperDir) return {}
    return {
      BAT_HELPER_DIR: this.deps.helperDir,
      ...(this.deps.dataDir ? { BAT_USER_DATA: this.deps.dataDir } : {}),
    }
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

  /**
   * T0525 (BUG-131): the env of PTY `id` — one builder for the first `pty:create` (all three
   * spawn paths), `restart` and the Terminal Server recovery rebuild, so none of them drops part
   * of it again. Helper values (`localHelperEnv`, `helperEnv` — `BAT_REMOTE_*`, the PTY's
   * capability) are read at call time, never copied from the previous process.
   * `noFlicker: false` = the child_process fallback, which has never set CLAUDE_CODE_NO_FLICKER.
   */
  private buildPtyEnv(
    id: string,
    spec: PtyEnvSpec,
    helperEnv: Record<string, string>,
    { noFlicker = true }: { noFlicker?: boolean } = {},
  ): Record<string, string> {
    const { customEnv, workspaceId, agentPreset } = spec
    const env: Record<string, string> = {
      ...this.inheritedEnv() as Record<string, string>,
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
      ...claudeCliUpdateGuardEnv(agentPreset),
      // T0133: Each PTY knows its own terminal ID (for Worker→Tower auto-notify)
      BAT_TERMINAL_ID: id,
      // T0176: Each PTY knows its own workspace ID (for Worker cwd routing)
      BAT_WORKSPACE_ID: workspaceId ?? '',
      // T0140: Absolute path to helper scripts (bat-terminal.mjs, bat-notify.mjs).
      // Dev: <project-root>/scripts, packaged: <install-root>/resources/scripts.
      // T0481: + BAT_USER_DATA, overriding the one the Terminal Server inherited (stale once
      // a long-lived server outlives a userData move).
      ...this.localHelperEnv(),
      // Force color output
      FORCE_COLOR: '3',
      // Suppress ED2-induced viewport flicker in Claude Code streaming
      // (xterm.js issue #5801: ED2 inside DEC 2026 sync blocks resets viewportY)
      ...(noFlicker ? { CLAUDE_CODE_NO_FLICKER: '1' } : {}),
      // Ensure not detected as CI environment
      CI: '',
      // T0129 / T0433: RemoteServer connection info so PTY children (the helpers) can connect back
      // via WebSocket — the host's helper env with the PTY's own capability (T0575: Electron too,
      // no longer the server token), last so nothing overrides it
      ...helperEnv,
    }
    // T0575 (T0574 gap 4): no inherited BAT_REMOTE_*. A BAT started inside another BAT's tab
    // would hand the outer session's credentials on when its own RemoteServer is not listening.
    // The host's helper env and an explicit customEnv value are kept.
    for (const key of ['BAT_REMOTE_PORT', 'BAT_REMOTE_TOKEN']) {
      if (!(key in helperEnv) && !(key in customEnv)) delete env[key]
    }
    return env
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
    this.notifySurvivingPtys(ptys.map(p => p.id))
    // BUG-146: the surviving ids are registered — a held create of one of them is now idempotent
    this.releaseCreates('Terminal Server PTY list')
  }

  /** T0576: `deps.onSurvivingPtys`; a throwing listener must not break the replay / recovery. */
  private notifySurvivingPtys(ids: string[]): void {
    if (!this.deps.onSurvivingPtys) return
    try {
      this.deps.onSurvivingPtys(ids)
    } catch (e) {
      logger.warn('[PtyManager] onSurvivingPtys listener failed:', e)
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
      // T0621 (C-7): the replay skips `enqueuePtyOutput` — restore a codex tab from its last
      // OSC 7501 (`agentStarted` = now; nothing found = as before)
      const codexState = this.instances.has(id) ? lastCodexState(data) : null
      if (codexState) {
        logger.log(`[PtyManager] replay: PTY ${id} last codex state=${codexState}`)
        this.blockedTracker.observeCodexState(id, codexState)
      }
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
    this.recordExit(id, exitCode)
    this.instances.delete(id)
    this.replayBuffers.delete(id)
    this.clearActivity(id)
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
    this.recordExit(id, exitCode)
    this.instances.delete(id)
    this.replayBuffers.delete(id)
    this.clearActivity(id)
    this.notifyPtyExit(id)
    this.broadcast('pty:exit', id, exitCode)
  }

  /**
   * T0582: remember PTY `id` as ended — call before its instance / replay buffer / activity go.
   * No instance (the process's own exit after a kill): only fills in the exit code.
   */
  private recordExit(id: string, exitCode?: number): void {
    this.dispatchInputHolds.delete(id) // T0598: nothing left to write after
    const instance = this.instances.get(id)
    const now = Date.now()
    this.pruneExitedPtys(now)
    if (!instance) {
      const record = this.exitedPtys.get(id)
      if (record && record.exitCode === undefined && exitCode !== undefined) record.exitCode = exitCode
      return
    }
    const buf = this.replayBuffers.get(id)
    const data = buf ? buf.data.slice(-EXITED_PTY_TAIL_MAX_CHARS) : ''
    const startedAt = this.blockedTracker.getStartedAt(id) // T0600
    const claudeSessionId = this.blockedTracker.getSessionId(id) // T0642
    const record: ExitedPtyRecord = {
      id,
      cwd: instance.cwd,
      ...(instance.workspaceId ? { workspaceId: instance.workspaceId } : {}),
      ...(instance.customEnv?.BAT_TOWER_TERMINAL_ID ? { towerTerminalId: instance.customEnv.BAT_TOWER_TERMINAL_ID } : {}),
      ...(instance.workorder ? { workorder: instance.workorder } : {}),
      ...(instance.agentPreset ? { agentPreset: instance.agentPreset } : {}),
      exitedAt: now,
      ...(exitCode !== undefined ? { exitCode } : {}),
      lastOutputAt: this.lastOutputAt.get(id) ?? null,
      tail: { data, total: buf?.total ?? 0 },
      ...(instance.worktree ? { worktree: { ...instance.worktree } } : {}),
      ...(startedAt !== null ? { agentStartedAt: startedAt } : {}),
      ...(claudeSessionId !== null ? { claudeSessionId } : {}),
    }
    this.exitedPtys.delete(id)
    this.exitedPtys.set(id, record)
    while (this.exitedPtys.size > EXITED_PTY_RECORD_MAX) {
      const oldest = this.exitedPtys.keys().next().value
      if (oldest === undefined) break
      this.exitedPtys.delete(oldest)
    }
  }

  private pruneExitedPtys(now: number): void {
    for (const [id, record] of this.exitedPtys) {
      if (now - record.exitedAt < EXITED_PTY_RECORD_TTL_MS) break
      this.exitedPtys.delete(id)
    }
  }

  /** T0535: forget a gone PTY's output / input times. */
  private clearActivity(id: string): void {
    this.lastOutputAt.delete(id)
    this.lastUserInputAt.delete(id)
    this.blockedTracker.clear(id, 'the PTY ended') // T0590: exit / kill (restart kills first)
    this.blockedTracker.clearStarted(id) // T0600
    this.launchSuspect.clear(id)
    this.codexStates.clear(id) // T0621
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
    this.lastOutputAt.set(id, Date.now())
    this.launchSuspect.output(id, data) // T0600 option B
    // T0621: read only — the data goes to the renderer unchanged
    for (const state of this.codexStates.feed(id, data)) {
      if (this.instances.has(id)) this.blockedTracker.observeCodexState(id, state)
    }
    if (this.deps.onPtyOutput) {
      try {
        this.deps.onPtyOutput(id, data)
      } catch (e) {
        logger.warn(`[PtyManager] onPtyOutput listener failed id=${id}:`, e)
      }
    }
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

  /**
   * T0535 (PLAN-041): running Worker PTYs recorded with `workorder` (normalized), dispatched by
   * `towerId` (`customEnv.BAT_TOWER_TERMINAL_ID`); `towerId` null = whoever dispatched them.
   */
  findWorkerTerminals(towerId: string | null, workorder: string): string[] {
    const wanted = normalizeWorkorderId(workorder)
    if (!wanted) return []
    const ids: string[] = []
    for (const [id, inst] of this.instances) {
      if (inst.workorder !== wanted) continue
      if (towerId !== null && inst.customEnv?.BAT_TOWER_TERMINAL_ID !== towerId) continue
      ids.push(id)
    }
    return ids
  }

  /** T0537: the work order recorded on PTY `id` by this process (undefined = none recorded). */
  getWorkorder(id: string): string | undefined {
    return this.instances.get(id)?.workorder
  }

  /** T0583: the worktree recorded on PTY `id` by this process (undefined = not an isolated Worker). */
  getWorktree(id: string): CtWorktreeRecord | undefined {
    return this.instances.get(id)?.worktree
  }

  /** T0562: the `agentPreset` PTY `id` was created with (undefined = none recorded). */
  getAgentPreset(id: string): string | undefined {
    return this.instances.get(id)?.agentPreset
  }

  /**
   * T0565 / D148: record the role PTY `id` declared (`terminal:set-role`). `mode` undefined keeps
   * the recorded mode (CT passes it every time, so there is no "clear"). false = no such PTY.
   */
  setTerminalRole(id: string, role: 'tower', mode?: CtMode): boolean {
    const instance = this.instances.get(id)
    if (!instance) return false
    instance.role = role
    if (mode) instance.towerMode = mode
    return true
  }

  /** T0565: the role PTY `id` declared (undefined = none). */
  getTerminalRole(id: string): 'tower' | undefined {
    return this.instances.get(id)?.role
  }

  /** T0565: the CT mode a Tower PTY declared (undefined = not a Tower, or no `--mode` given). */
  getTowerMode(id: string): CtMode | undefined {
    const instance = this.instances.get(id)
    return instance?.role === 'tower' ? instance.towerMode : undefined
  }

  /**
   * T0565 / D148: whether PTY `id` runs Control Tower in yolo mode. The one place PLAN-044
   * (T0566) asks; Electron and headless alike. T0566 (Tower ruling on T0565): a Tower's declared
   * mode wins — a Tower that declared `--mode` is yolo only when it declared `yolo`, whatever
   * `CT_MODE` its env carries; otherwise a Worker dispatched with `--mode yolo`
   * (`customEnv.CT_MODE`).
   */
  isYoloTerminal(id: string): boolean {
    const instance = this.instances.get(id)
    if (!instance) return false
    if (instance.role === 'tower' && instance.towerMode) return instance.towerMode === 'yolo'
    return instance.customEnv?.CT_MODE === 'yolo'
  }

  /** T0535: the Tower terminal that dispatched PTY `id` (`customEnv.BAT_TOWER_TERMINAL_ID`). */
  getTowerTerminalId(id: string): string | undefined {
    return this.instances.get(id)?.customEnv?.BAT_TOWER_TERMINAL_ID || undefined
  }

  /** T0582: running PTY ids. */
  listTerminalIds(): string[] {
    return [...this.instances.keys()]
  }

  /** T0582: what the helper query channels read about running PTY `id` (null = not running). */
  getTerminalInfo(id: string): PtyTerminalInfo | null {
    const instance = this.instances.get(id)
    if (!instance) return null
    const towerTerminalId = instance.customEnv?.BAT_TOWER_TERMINAL_ID || undefined
    return {
      id,
      cwd: instance.cwd,
      ...(instance.workspaceId ? { workspaceId: instance.workspaceId } : {}),
      ...(towerTerminalId ? { towerTerminalId } : {}),
      ...(instance.workorder ? { workorder: instance.workorder } : {}),
      ...(instance.agentPreset ? { agentPreset: instance.agentPreset } : {}),
      ...(instance.role ? { role: instance.role } : {}),
      ...(instance.role === 'tower' && instance.towerMode ? { towerMode: instance.towerMode } : {}),
      yolo: this.isYoloTerminal(id),
    }
  }

  /**
   * T0582: the record of PTY `id` if it ended within `EXITED_PTY_RECORD_TTL_MS` (and is one of the
   * last `EXITED_PTY_RECORD_MAX`); null when it runs again or is not remembered. A copy.
   */
  getExitedPty(id: string): ExitedPtyRecord | null {
    if (this.instances.has(id)) return null
    this.pruneExitedPtys(Date.now())
    const record = this.exitedPtys.get(id)
    return record ? { ...record, tail: { ...record.tail }, ...(record.worktree ? { worktree: { ...record.worktree } } : {}) } : null
  }

  /** T0582: ids of the remembered exited PTYs that do not run again (oldest first). */
  listExitedPtyIds(): string[] {
    this.pruneExitedPtys(Date.now())
    return [...this.exitedPtys.keys()].filter(id => !this.instances.has(id))
  }

  /** T0535: when PTY `id` last produced output (ms epoch); null = none seen by this process. */
  getLastOutputAt(id: string): number | null {
    return this.lastOutputAt.get(id) ?? null
  }

  /** T0535: when input was last typed into PTY `id` from a local window (`noteUserInput`). */
  getLastUserInputAt(id: string): number | null {
    return this.lastUserInputAt.get(id) ?? null
  }

  /**
   * T0535: the user typed into PTY `id` (`pty:write` from a local window, or a headless client).
   * Helper writes (RemoteServer) and, since T0551, writes made only of the terminal's own
   * replies (`isTerminalAutoReply`, electron/close-worker.ts) are not passed here.
   */
  noteUserInput(id: string): void {
    if (!this.instances.has(id)) return
    this.lastUserInputAt.set(id, Date.now())
    this.blockedTracker.clearForUserInput(id) // T0590; T0621: not codex's `input`
  }

  // ── PLAN-047 M1b-1 / T0590: `blocked` (electron/terminal-blocked-state.ts) ──

  /**
   * A claude hook of running PTY `id` (`terminal:report-hook`); null = not running. T0642: + the
   * session id of a `session-start` (validated by the handler). T0657: + the hook's `agent_id` of a
   * `permission-request` / `post-tool-batch` (validated by the handler).
   */
  reportHookEvent(id: string, event: HookReportEvent, toolName?: string, sessionId?: string, agentId?: string): { result: HookReportResult; state: BlockedState | null } | null {
    if (!this.instances.has(id)) return null
    return this.blockedTracker.report(id, event, toolName, sessionId, agentId)
  }

  /** What running PTY `id` is blocked on, or null (not blocked / not running). */
  getBlockedState(id: string): BlockedState | null {
    return this.instances.has(id) ? this.blockedTracker.get(id) : null
  }

  /**
   * Whether terminal `id` was launched with BAT's claude hooks (`buildBatMcpLaunchArgs`). Kept per
   * id — before the PTY exists (claude-cli tabs decide first), across `restart` / the Terminal
   * Server recovery and after it exits; a later decision for the id replaces it.
   * T0621: `osc` = a codex tab (the dispatch's version check, or the first OSC 7501 seen).
   */
  setBlockedDetection(id: string, mode: BlockedDetection): void {
    this.blockedTracker.setDetection(id, mode)
  }

  getBlockedDetection(id: string): BlockedDetection {
    return this.blockedTracker.getDetection(id)
  }

  /**
   * T0600 (D154): when the claude of running PTY `id` ran its `SessionStart` hook (ms epoch), or
   * null (not reported yet / not running). T0621: or its codex sent the first OSC 7501. An exited PTY's time is `ExitedPtyRecord.agentStartedAt`.
   */
  getAgentStartedAt(id: string): number | null {
    return this.instances.has(id) ? this.blockedTracker.getStartedAt(id) : null
  }

  /**
   * PLAN-050 / T0642 (D167): the session id the claude of running PTY `id` sent with its last
   * `SessionStart` hook, or null (not reported / not running). An exited PTY's is
   * `ExitedPtyRecord.claudeSessionId`.
   */
  getClaudeSessionId(id: string): string | null {
    return this.instances.has(id) ? this.blockedTracker.getSessionId(id) : null
  }

  /**
   * T0642: puts back the session id saved for running PTY `id` before BAT closed (Electron, after the
   * Terminal Server's PTY list). Ignored when the PTY does not run, already has one, or it is not a
   * UUID. True when it was set.
   */
  restoreClaudeSessionId(id: string, sessionId: string): boolean {
    if (!this.instances.has(id)) return false
    return this.blockedTracker.restoreSessionId(id, sessionId)
  }

  /** T0450: running PTYs and the `maxInstances` cap (0 = unlimited) — the helper creation quota. */
  getCapacity(): { count: number; max: number } {
    const max = this.deps.maxInstances
    return { count: this.instances.size, max: max && max > 0 ? max : 0 }
  }

  /**
   * The shell `create` starts when it gets no `shell`. Public for BUG-149 / T0593: helper
   * dispatch quotes for this same shell when Settings has no persisted `shell`.
   */
  getDefaultShell(): string {
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
  createWithResult(options: PtyManagerCreateOptions): PtyCreateResult {
    const existed = this.instances.has(options.id)
    const ok = this.create(options)
    return { ok, created: ok && !existed }
  }

  /**
   * BUG-146 / T0578: hold `pty:create` (the `pty:create` handler waits on `whenCreatesReleased`)
   * until the Recovery prompt is answered. Before the answer PtyManager is connected to no
   * Terminal Server, so a create would spawn a direct shell for an id that may still run on the
   * surviving server — a second, hidden shell whose output joins the tab's.
   */
  holdCreates(reason: string): void {
    if (this.createHold) return
    this.createHold = { waiters: [], heldIds: [], releaseTimer: null }
    logger.log(`[BUG-146] pty:create held (${reason})`)
  }

  isCreateHeld(): boolean {
    return this.createHold !== null
  }

  /**
   * Resolves true when the hold ends (right away without one); `id` is only logged. Waiters
   * resume in the order they came.
   * T0580: `timeoutMs` → resolves false once it passes with the hold still on, and the waiter
   * leaves the hold (a helper dispatch gives up before its own invoke timeout). `channel` names
   * the caller in the log line.
   */
  whenCreatesReleased(id?: string, opts: { timeoutMs?: number; channel?: string } = {}): Promise<boolean> {
    const hold = this.createHold
    if (!hold) return Promise.resolve(true)
    const { timeoutMs, channel = 'pty:create' } = opts
    if (id) {
      hold.heldIds.push(id)
      logger.log(`[BUG-146] ${channel} id=${id} held until the Recovery prompt is answered${timeoutMs !== undefined ? ` (at most ${timeoutMs} ms)` : ''}`)
    }
    return new Promise(resolve => {
      let timer: ReturnType<typeof setTimeout> | null = null
      const waiter = () => {
        if (timer) clearTimeout(timer)
        resolve(true)
      }
      hold.waiters.push(waiter)
      if (timeoutMs === undefined) return
      timer = setTimeout(() => {
        const at = hold.waiters.indexOf(waiter)
        if (at !== -1) hold.waiters.splice(at, 1)
        const heldAt = id ? hold.heldIds.indexOf(id) : -1
        if (heldAt !== -1) hold.heldIds.splice(heldAt, 1)
        resolve(false)
      }, timeoutMs)
    })
  }

  /** Ends the hold: the waiting creates run now, against whatever connection there is. No-op without a hold. */
  releaseCreates(reason: string): void {
    const hold = this.createHold
    if (!hold) return
    this.createHold = null
    if (hold.releaseTimer) clearTimeout(hold.releaseTimer)
    logger.log(`[BUG-146] pty:create released (${reason}): ${hold.heldIds.length} held create(s)${hold.heldIds.length ? ` [${hold.heldIds.join(', ')}]` : ''}`)
    for (const resolve of hold.waiters) resolve()
  }

  /**
   * After "recover" connected and asked for `pty:list`: the hold ends when the list arrives
   * (`handleReplayList` registers the surviving ids first, so their held creates answer
   * `created: false`), or after `timeoutMs` if it never does.
   */
  releaseCreatesOnReplayList(timeoutMs: number = PtyManager.CREATE_HOLD_LIST_TIMEOUT_MS): void {
    const hold = this.createHold
    if (!hold || hold.releaseTimer) return
    hold.releaseTimer = setTimeout(() => {
      logger.warn(`[BUG-146] no Terminal Server PTY list within ${timeoutMs} ms — releasing the held creates`)
      this.releaseCreates('PTY list timeout')
    }, timeoutMs)
  }

  create(options: PtyManagerCreateOptions): boolean {
    const { id, cwd, type, shell: shellOverride, customEnv = {}, workspaceId, agentPreset } = options
    // T0535: recorded only when it is a valid work order id (same grammar as --workorder)
    const workorder = normalizeWorkorderId(options.workorder) ?? undefined
    // T0583: the worktree of an isolated Worker (main-side only, like workorder)
    const worktree = options.worktree
    // T0404: a re-sent create for a running id stays idempotent below; only new ids count.
    const limit = this.deps.maxInstances
    if (limit && limit > 0 && !this.instances.has(id) && this.instances.size >= limit) {
      logger.warn(`[PtyManager] pty:create REFUSED id=${id} — PTY limit reached (${this.instances.size}/${limit})`)
      throw new PtyLimitError(limit)
    }
    const envSpec: PtyEnvSpec = { customEnv, workspaceId, agentPreset }

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
        // T0523: a PTY re-registered from the server's list (T0108) does not know its workspace.
        // T0525: nor its customEnv / agentPreset — kept from the same re-create for a later
        // restart / recovery. The running PTY itself is left untouched.
        const existing = this.instances.get(id)
        if (existing && !existing.workspaceId && workspaceId) existing.workspaceId = workspaceId
        if (existing && !existing.customEnv && options.customEnv) existing.customEnv = { ...options.customEnv }
        if (existing && !existing.agentPreset && agentPreset) existing.agentPreset = agentPreset
        if (existing && !existing.workorder && workorder) existing.workorder = workorder
        if (existing && !existing.worktree && worktree) existing.worktree = worktree
        return true
      }
      this.sendToServer({
        type: 'pty:create',
        id,
        shell,
        args,
        cwd,
        cols: 120,
        rows: 30,
        env: this.buildPtyEnv(id, envSpec, this.helperEnvFor(id, customEnv)),
      })
      // T0112: Store shell/args so handleServerDeath() can rebuild after crash.
      // T0525: + what the env was built from, so the rebuild can build it again.
      this.instances.set(id, { process: null, type, cwd, usePty: true, shell, shellArgs: args, awaitingCreated: true, customEnv, workspaceId, agentPreset, workorder, worktree })
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

    // BUG-146: `pty:create`, `pty:restart` and the helper dispatch (T0580) wait for the hold; a
    // caller that does not would still spawn directly, as before T0578
    if (this.createHold) logger.warn(`[BUG-146] pty:create id=${id} spawns directly while creates are held (synchronous caller)`)

    // Fallback: direct PTY spawn (node-pty or child_process)
    let usedPty = false
    // T0433: once per spawned PTY (the child_process fallback reuses it)
    const helperEnv = this.helperEnvFor(id, customEnv)

    if (ptyAvailable && pty) {
      try {
        // Set UTF-8 and terminal environment variables, merge custom env (T0525: buildPtyEnv)
        const envWithUtf8 = this.buildPtyEnv(id, envSpec, helperEnv)

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

        this.instances.set(id, { process: ptyProcess, type, cwd, usePty: true, customEnv, workspaceId, agentPreset, workorder, worktree })
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
        const envWithUtf8 = this.buildPtyEnv(id, envSpec, helperEnv, { noFlicker: false })

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

        this.instances.set(id, { process: childProcess, type, cwd, usePty: false, customEnv, workspaceId, agentPreset, workorder, worktree })
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
   * BUG-151 / T0598: a helper dispatch writes its launch command into PTY `id` a moment after
   * creating it, while the new tab already has the keyboard focus (BUG-135 / T0532). Until
   * `writeDispatchCommand`, input for `id` (`writeWithResult`: `pty:write`) waits: written first,
   * a stray keystroke became part of the command line (`, 'C:\…\claude.exe' …` →
   * `bash: ,: command not found`). The terminal's own replies (`isTerminalAutoReply`) are not held.
   */
  holdInputForDispatch(id: string): void {
    if (this.instances.has(id)) this.dispatchInputHolds.set(id, [])
  }

  /** BUG-151 / T0598: writes the dispatch command, then the input held since `holdInputForDispatch`. */
  writeDispatchCommand(id: string, command: string): void {
    const held = this.dispatchInputHolds.get(id) ?? []
    this.dispatchInputHolds.delete(id)
    this.write(id, command)
    if (this.instances.has(id)) this.launchSuspect.watch(id) // T0600 option B: a "command not found" right after it
    if (held.length === 0) return
    const bytes = held.reduce((n, data) => n + Buffer.byteLength(data), 0)
    logger.log(`[agent-command] id=${id} input before the dispatch command: ${held.length} write(s), ${bytes} bytes → sent after it`)
    for (const data of held) this.write(id, data)
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

    // BUG-151 / T0598: the dispatch command of this PTY is not written yet — the input follows it
    const held = this.dispatchInputHolds.get(id)
    if (held && !isTerminalAutoReply(data)) {
      held.push(data)
      return { ok: true, reason: 'held-until-dispatch' }
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
      this.recordExit(id)
      this.instances.delete(id)
      this.replayBuffers.delete(id)
      this.clearActivity(id)
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
      this.recordExit(id)
      this.instances.delete(id)
      this.replayBuffers.delete(id)
      this.clearActivity(id)
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
   * Kill + create with the same id. The new process gets the old one's `customEnv`, workspace
   * (T0523, `BAT_WORKSPACE_ID`) and `agentPreset`; `create` builds the rest of the env anew
   * (`buildPtyEnv`), so helper values are the current ones.
   * T0448 (T0445 #4): headless — the restarted helper capability keeps the same role and tower
   * binding (the kill revokes the old token; `helperEnv` issues the new one).
   * T0525 (BUG-131): Electron too — before it the env was rebuilt without `customEnv`, losing
   * workspace / global env vars and a Worker's `BAT_TOWER_TERMINAL_ID` / `CT_MODE` / `CT_INTERACTIVE`.
   * T0535: + its `workorder`, so `--close-worker` still finds a restarted Worker.
   * T0565: + the declared role / Tower mode, so a restarted yolo Tower stays one.
   */
  restart(id: string, cwd: string, shell?: string): boolean {
    const instance = this.instances.get(id)
    if (instance) {
      const type = instance.type
      const customEnv = instance.customEnv ? { ...instance.customEnv } : undefined
      const { workspaceId, agentPreset, workorder, worktree, role, towerMode } = instance
      this.kill(id)
      const ok = this.create({
        id, cwd, type, shell,
        ...(customEnv ? { customEnv } : {}),
        ...(workspaceId ? { workspaceId } : {}),
        ...(agentPreset ? { agentPreset } : {}),
        ...(workorder ? { workorder } : {}),
        ...(worktree ? { worktree } : {}),
      })
      if (ok && role) this.setTerminalRole(id, role, towerMode)
      return ok
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
      // T0576: none of the server's PTYs survives; the rebuild below spawns new ones
      this.notifySurvivingPtys([])
      // T0590: the rebuilt shells run no claude yet (T0600: nor `agentStarted`; T0621: nor codex)
      this.blockedTracker.clearAll('Terminal Server recovery')
      this.codexStates.dispose()
      // T0607: the rebuilt shells run none of the agents that asked
      try {
        this.deps.onServerRecovery?.()
      } catch (e) {
        logger.warn('[PtyManager] onServerRecovery listener failed:', e)
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

      // Rebuild all PTYs that were running before the crash.
      // T0525 (BUG-131): with the same env a first pty:create builds (before it: none, so the
      // PTY got the new server's inherited env — BAT_* missing or stale, customEnv gone).
      // Helper values are the current ones; customEnv / workspace / preset are the recorded ones.
      const oldInstances = new Map(this.instances)
      this.instances.clear()
      for (const [id, inst] of oldInstances) {
        const shell = inst.shell || this.getDefaultShell()
        const args = inst.shellArgs || []
        const customEnv = inst.customEnv ?? {}
        const env = this.buildPtyEnv(
          id,
          { customEnv, workspaceId: inst.workspaceId, agentPreset: inst.agentPreset },
          this.helperEnvFor(id, customEnv),
        )
        this.sendToServer({
          type: 'pty:create',
          id,
          shell,
          args,
          cwd: inst.cwd,
          cols: 120,
          rows: 30,
          env,
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
      this.lastOutputAt.clear()
      this.lastUserInputAt.clear()
      this.blockedTracker.dispose()
      this.launchSuspect.dispose()
      this.codexStates.dispose()
      return
    }
    for (const [id] of this.instances) {
      this.kill(id)
    }
  }
}
