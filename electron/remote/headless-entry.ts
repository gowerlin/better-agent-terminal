import { createHash, randomBytes } from 'crypto'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import type { HandlerModule, HandlerModuleDisposer, HandlerRegistrar, HostDeps } from '../handlers/types'
import { registerClaudeHandlers } from '../handlers/claude'
import { registerFsHandlers } from '../handlers/fs'
import { registerGitHandlers, type GitHandlerDeps } from '../handlers/git'
import { registerPtyHandlers } from '../handlers/pty'
import {
  buildProbeEnv,
  REMOTE_TOOLS_DETECT_CHANNEL,
  runRemoteToolsDetect,
  type RemoteToolsHandlerDeps,
} from '../handlers/remote-tools'
import { registerTerminalHandlers } from '../handlers/terminal'
import { createBatMcpLaunchArgs, defaultClaudeSettingsFiles, registerBatMcpHandlers, type BatMcpHost } from '../bat-mcp-launch'
import { createCodexNoDaemonSupportCheck, createCodexOscVersionCheck } from '../codex-osc-version'
import { registerReportHookHandler } from '../terminal-blocked-state'
import { WorkerCloseScheduler } from '../close-worker'
import { CtWorktreeService } from '../ct-worktree'
import { UsageLimitContinueScheduler } from '../usage-limit-continue'
import { registerTerminalQueryHandlers } from '../terminal-query-handlers'
import { registerTowerQuestionHandlers } from '../tower-questions'
import { TerminalAttentionNotifier } from '../terminal-attention'
import { registerWorktreeStatusHandler } from '../worktree-status-handlers'
import { mirrorToBatScripts } from './remote-logger'
import { normalizeUsageLimitConfig } from '../../src/lib/usage-limit'
import type { HandlerContext } from '../handlers/types'
import type { PersistedShellSettings } from '../shell-path-resolver'
import {
  AGENT_CHECK_PENDING,
  AGENT_UNAVAILABLE,
  createAgentPromptCommandBuilder,
  normalizeAgentAlias,
  type AgentCommandSettings,
  type AgentUnavailableResult,
} from '../terminal-command-handlers'
import type { RemoteToolId, RemoteToolsDetectResult } from '../../src/types/remote-tools'
import { agentRegistry } from '../agent-runtime/agent-registry'
import { ClaudeAgentManager } from '../claude-agent-manager'
import {
  configureRuntimeRouter,
  getRuntimeSettingsSnapshot,
  resolveClaudeRuntime,
  resolveEmbeddedClaudePath,
  type EmbeddedClaudeLayout,
} from '../claude-runtime-router'
import { createClaudeNameSupportCheck } from '../claude-version-check'
import { claudeSessionNameRecords } from '../claude-session-name-record'
import { resolveGitBinary } from '../gh-resolver'
import { logger as defaultLogger } from '../logger'
import { SyncedWorkspaceRoots } from '../path-guard'
import { PtyManager } from '../pty-manager'
import { worktreeManager } from '../worktree-manager'
import { broadcastHub } from './broadcast-hub'
import {
  FileCertificateProvider,
  type CertificateProvider,
} from './certificate'
import { registerHandler, type HandlerContext as RemoteHandlerContext } from './handler-registry'
import {
  RemoteServer,
  type BindInterface,
  type ServerEnvInfo,
} from './remote-server'
import {
  detectSecretStrategy,
  readSecretFile,
  setSecretStrategy,
  type SecretStrategy,
  writeSecretFile,
} from './secrets'
import { acquireLock, releaseLock } from './lockfile'
import { HelperCapabilityRegistry, type HelperTowerSpawnQuota } from './helper-capability'
import {
  createHeadlessDefaultHandlers,
  readHeadlessSettings,
  type HeadlessHandlerRegistration,
} from './headless-handlers'

export type { HeadlessHandlerRegistration }

/**
 * T0390: inherited env keys a remote shell must not see. Everything BAT_*
 * describes the session that launched bat-server (e.g. started by hand from a
 * BAT terminal: BAT_HELPER_DIR / BAT_REMOTE_PORT / BAT_REMOTE_TOKEN /
 * BAT_TERMINAL_ID / BAT_TOWER_TERMINAL_ID) or server configuration — never the
 * remote shell. PtyManager still sets its own per-PTY BAT_SESSION /
 * BAT_TERMINAL_ID / BAT_WORKSPACE_ID afterwards, and (T0433) the per-PTY helper
 * env from `buildHeadlessHelperEnv` — BAT_REMOTE_TOKEN there is the PTY's
 * capability, never the server token (no getRemoteServerInfo on headless).
 */
export function isHeadlessScrubbedEnvKey(key: string): boolean {
  return key.toUpperCase().startsWith('BAT_')
}

/** T0404: no authenticated client for this long ⇒ every PTY is killed. */
export const HEADLESS_PTY_IDLE_RECLAIM_DEFAULT_MS = 24 * 60 * 60 * 1000
/** T0404: most PTYs one headless server runs at once. */
export const HEADLESS_MAX_PTYS_DEFAULT = 64
/** T0404: env overrides, read by `resolveHeadlessPtyLimits` (systemd: `Environment=` in a unit drop-in). */
export const HEADLESS_PTY_IDLE_HOURS_ENV = 'BAT_SERVER_PTY_IDLE_HOURS'
export const HEADLESS_MAX_PTYS_ENV = 'BAT_SERVER_MAX_PTYS'
/** setTimeout fires immediately above 2^31-1 ms (~24.8 days); longer idle limits are clamped to it. */
const MAX_TIMER_MS = 2_147_483_647
const HOUR_MS = 60 * 60 * 1000

export interface HeadlessPtyLimits {
  /** 0 = never reclaim. */
  idleReclaimMs: number
  /** 0 = unlimited. */
  maxPtys: number
}

/**
 * T0404: options win over env, env over defaults. Env: `BAT_SERVER_PTY_IDLE_HOURS`
 * (non-negative number, fractions allowed, 0 = never reclaim) and
 * `BAT_SERVER_MAX_PTYS` (non-negative integer, 0 = unlimited). An invalid env
 * value is reported through `warn` and the default is used.
 */
export function resolveHeadlessPtyLimits(
  opts: { ptyIdleReclaimMs?: number; maxPtys?: number } = {},
  env: NodeJS.ProcessEnv = process.env,
  warn: (message: string) => void = () => {},
): HeadlessPtyLimits {
  let idleReclaimMs = HEADLESS_PTY_IDLE_RECLAIM_DEFAULT_MS
  if (opts.ptyIdleReclaimMs !== undefined) {
    idleReclaimMs = opts.ptyIdleReclaimMs
  } else {
    const raw = env[HEADLESS_PTY_IDLE_HOURS_ENV]?.trim()
    if (raw) {
      const hours = Number(raw)
      if (Number.isFinite(hours) && hours >= 0) idleReclaimMs = Math.round(hours * HOUR_MS)
      else warn(`[headless] ignoring ${HEADLESS_PTY_IDLE_HOURS_ENV}=${JSON.stringify(raw)} (expected hours >= 0); using ${HEADLESS_PTY_IDLE_RECLAIM_DEFAULT_MS / HOUR_MS}h`)
    }
  }
  if (!Number.isFinite(idleReclaimMs) || idleReclaimMs < 0) idleReclaimMs = HEADLESS_PTY_IDLE_RECLAIM_DEFAULT_MS
  if (idleReclaimMs > MAX_TIMER_MS) {
    warn(`[headless] orphan PTY idle limit ${idleReclaimMs}ms exceeds the timer maximum; clamped to ${MAX_TIMER_MS}ms`)
    idleReclaimMs = MAX_TIMER_MS
  }

  let maxPtys = HEADLESS_MAX_PTYS_DEFAULT
  if (opts.maxPtys !== undefined) {
    maxPtys = opts.maxPtys
  } else {
    const raw = env[HEADLESS_MAX_PTYS_ENV]?.trim()
    if (raw) {
      const parsed = Number(raw)
      if (Number.isInteger(parsed) && parsed >= 0) maxPtys = parsed
      else warn(`[headless] ignoring ${HEADLESS_MAX_PTYS_ENV}=${JSON.stringify(raw)} (expected an integer >= 0); using ${HEADLESS_MAX_PTYS_DEFAULT}`)
    }
  }
  if (!Number.isInteger(maxPtys) || maxPtys < 0) maxPtys = HEADLESS_MAX_PTYS_DEFAULT

  return { idleReclaimMs, maxPtys }
}

function formatDuration(ms: number): string {
  if (ms % HOUR_MS === 0) return `${ms / HOUR_MS}h`
  if (ms % 60_000 === 0) return `${ms / 60_000}min`
  return `${ms}ms`
}

/**
 * T0404: kills every PTY once no authenticated client has been connected for
 * `idleMs`. Feed it the client count: 0 arms the timer (if not armed yet), any
 * other count cancels it. A server that starts with no client is armed from the
 * start. `idleMs <= 0` disables it.
 */
export class HeadlessOrphanPtyReclaimer {
  private timer: ReturnType<typeof setTimeout> | null = null
  private disposed = false

  constructor(private readonly opts: {
    idleMs: number
    /** Kill every PTY; returns how many were killed. */
    reclaim: () => number
    log: (message: string) => void
  }) {}

  get armed(): boolean {
    return this.timer !== null
  }

  update(clientCount: number): void {
    if (this.disposed || this.opts.idleMs <= 0) return
    if (clientCount > 0) {
      this.cancel()
      return
    }
    if (this.timer) return
    this.timer = setTimeout(() => {
      this.timer = null
      const killed = this.opts.reclaim()
      this.opts.log(
        `[headless] no authenticated client for ${formatDuration(this.opts.idleMs)} — reclaimed ${killed} orphan PTY(s)`,
      )
    }, this.opts.idleMs)
    this.timer.unref?.()
  }

  /** Final: later `update` calls are ignored (RemoteServer.stop() still reports its last count drop). */
  dispose(): void {
    this.disposed = true
    this.cancel()
  }

  private cancel(): void {
    if (!this.timer) return
    clearTimeout(this.timer)
    this.timer = null
  }
}

/** T0433: where a headless PTY's helpers reach this server. */
export interface HeadlessHelperEndpoint {
  /** The RemoteServer's bound port. */
  port: number
  /** `<dataDir>/server-cert.json` — the helpers pin this server's fingerprint (`_bat-cert.mjs`). */
  certPath: string
  /** Absolute dir for the helpers' `bat-scripts.log` (`_bat-logger.mjs`): `<dataDir>/Logs`. */
  logDir: string
}

/** T0433: helpers `BAT_HELPER_DIR` must hold for the helper env to be injected at all. */
export const HEADLESS_REQUIRED_HELPER_SCRIPTS = ['bat-terminal.mjs', 'bat-notify.mjs'] as const

/** T0456: key of `PATH` in `env` (`Path` on Windows), `undefined` when absent. */
function findPathKey(env: Record<string, string | undefined>): string | undefined {
  return Object.keys(env).find(key => key.toUpperCase() === 'PATH')
}

/**
 * T0456 (T0434 遭遇問題 2): `PATH` of a headless PTY with `binDir` appended — the PATH the
 * PTY would get otherwise (`customEnv` over the inherited env, as PtyManager merges them),
 * so a `node` the user installed still wins. Already on it ⇒ unchanged.
 */
function headlessHelperPathEnv(
  binDir: string,
  customEnv: Record<string, string>,
  inheritedEnv: NodeJS.ProcessEnv,
  delimiter: string,
): Record<string, string> {
  const customKey = findPathKey(customEnv)
  const inheritedKey = findPathKey(inheritedEnv)
  const key = customKey ?? inheritedKey ?? 'PATH'
  const current = (customKey !== undefined ? customEnv[customKey] : inheritedKey !== undefined ? inheritedEnv[inheritedKey] : '') ?? ''
  const entries = current.split(delimiter).filter(entry => entry.length > 0)
  if (entries.includes(binDir)) return { [key]: current }
  return { [key]: [...entries, binDir].join(delimiter) }
}

/**
 * T0433 (PLAN-036 P3 / K): helper env of headless PTY `id` — issues its capability
 * (worker when `customEnv.BAT_TOWER_TERMINAL_ID` names its tower, else tower) and returns
 * `BAT_REMOTE_PORT` / `BAT_REMOTE_TOKEN` (= that capability) / `BAT_SERVER_CERT_PATH` /
 * `BAT_HELPER_DIR` / `BAT_HELPER_LOG_DIR`. The server token is never an input.
 * T0456: also `PATH` with the bundle's `<installRoot>/bin` (sibling of `helperDir`)
 * appended, and `BAT_HELPER_NODE=<installRoot>/bin/node` when that node exists — a remote
 * PATH need not have `node` (WSL smoke S10 `node=missing`).
 *
 * Returns `{}` and issues nothing when the helpers could not work anyway: server not
 * listening yet, no helper dir / helpers missing from it (a bundle built before T0433),
 * or an id the registry refuses. A remote shell then has no `BAT_REMOTE_*` /
 * `BAT_HELPER_DIR`, i.e. the pre-T0433 state the skills already degrade from — and its
 * `PATH` is left alone.
 */
export function buildHeadlessHelperEnv(opts: {
  id: string
  customEnv: Record<string, string>
  capabilities: HelperCapabilityRegistry
  endpoint: HeadlessHelperEndpoint | null
  helperDir?: string
  exists?: (p: string) => boolean
  log?: (message: string) => void
  /** T0456: env the PTY inherits (PtyManager: `process.env` minus BAT_*); default `process.env`. */
  inheritedEnv?: NodeJS.ProcessEnv
  /** T0456: `PATH` separator; default `path.delimiter`. */
  pathDelimiter?: string
}): Record<string, string> {
  const { id, customEnv, capabilities, endpoint, helperDir } = opts
  const exists = opts.exists ?? fs.existsSync
  if (!endpoint || !helperDir) return {}
  if (!HEADLESS_REQUIRED_HELPER_SCRIPTS.every(name => exists(path.join(helperDir, name)))) {
    opts.log?.(`[headless] helper env skipped: terminal=${id} (helpers missing from ${helperDir})`)
    return {}
  }
  const towerId = typeof customEnv.BAT_TOWER_TERMINAL_ID === 'string' ? customEnv.BAT_TOWER_TERMINAL_ID : undefined
  let token: string
  try {
    token = capabilities.issue(id, { towerId })
  } catch (error) {
    opts.log?.(`[headless] helper env skipped: terminal=${id} (${error instanceof Error ? error.message : String(error)})`)
    return {}
  }
  const binDir = path.join(path.dirname(helperDir), 'bin')
  const helperNode = path.join(binDir, 'node')
  return {
    BAT_REMOTE_PORT: String(endpoint.port),
    BAT_REMOTE_TOKEN: token,
    BAT_SERVER_CERT_PATH: endpoint.certPath,
    BAT_HELPER_DIR: helperDir,
    BAT_HELPER_LOG_DIR: endpoint.logDir,
    ...(exists(helperNode) ? { BAT_HELPER_NODE: helperNode } : {}),
    ...headlessHelperPathEnv(binDir, customEnv, opts.inheritedEnv ?? process.env, opts.pathDelimiter ?? path.delimiter),
  }
}

/**
 * T0390: `pty:*` + `settings:get-shell-path` on headless. One PtyManager per
 * server, direct spawn (no Terminal Server). PTYs outlive client disconnects —
 * a reconnecting client re-sends `pty:create` with the same id, which is
 * idempotent — and are killed by `pty:kill`, server `stop()`, or (T0404) the
 * orphan reclaim once no client has been connected for the idle limit.
 * T0404: `maxPtys` caps concurrent PTYs (0 = unlimited); `onManager` hands the
 * manager to the server for that reclaim.
 * T0432: `helperCapabilities` — a PTY that exits or is killed loses its helper
 * capability (revoked in the registry the RemoteServer authenticates against).
 * T0433: with `helperCapabilities` + `helperEndpoint`, every spawned PTY gets its own
 * capability and helper env (`buildHeadlessHelperEnv`); `helperDir` is the bundle's
 * `<installRoot>/scripts`. `BAT_HELPER_DIR` comes only from there, never from `host`.
 * PLAN-041 / T0536: `isUserInput` — which `pty:write` is the user typing (cancels a pending
 * `--close-worker`); the server passes "a client connection, not a helper".
 * PLAN-044 / T0566: the usage-limit scheduler (electron/usage-limit-continue.ts) on this
 * PtyManager; config from `<dataDir>/settings.json` (a remote window's Settings saves there,
 * `settings:save` is proxied), re-read every `USAGE_LIMIT_CONFIG_TTL_MS`. Events go to the
 * connected clients; `usageLimitCanDeliver` false (no client) → nothing is sent. User input =
 * the same `isUserInput` rule.
 * PLAN-048 / T0607: `onPtyExit` — also told of every PTY that is gone (the tower-question store).
 * T0609: `onBlockedChange` — a PTY's hook `blocked` changed (the attention push).
 */
export const USAGE_LIMIT_CONFIG_TTL_MS = 5000

export function createHeadlessPtyModule(opts: {
  maxPtys?: number
  onManager?: (manager: PtyManager) => void
  helperCapabilities?: HelperCapabilityRegistry
  helperDir?: string
  helperEndpoint?: () => HeadlessHelperEndpoint | null
  isUserInput?: (ctx: HandlerContext) => boolean
  usageLimitCanDeliver?: () => boolean
  onPtyExit?: (id: string) => void
  /** T0609: a PTY's hook `blocked` changed (the attention push of the query module). */
  onBlockedChange?: (id: string) => void
} = {}): HandlerModule {
  return (register, host) => {
    const capabilities = opts.helperCapabilities
    const getEndpoint = opts.helperEndpoint
    let manager: PtyManager | null = null
    const usageLimit = new UsageLimitContinueScheduler({
      getPtyManager: () => manager,
      readConfig: () => normalizeUsageLimitConfig(host.getSettings()),
      configTtlMs: USAGE_LIMIT_CONFIG_TTL_MS,
      emit: (channel, payload) => host.emit(channel, payload),
      ...(opts.usageLimitCanDeliver ? { canDeliver: opts.usageLimitCanDeliver } : {}),
      logger: defaultLogger,
    })
    manager = new PtyManager({
      emit: host.emit,
      dataDir: host.dataDir,
      dropInheritedEnv: isHeadlessScrubbedEnvKey,
      maxInstances: opts.maxPtys ?? HEADLESS_MAX_PTYS_DEFAULT,
      helperEnv: capabilities && getEndpoint
        ? (id, customEnv) => buildHeadlessHelperEnv({
            id,
            customEnv,
            capabilities,
            endpoint: getEndpoint(),
            helperDir: opts.helperDir,
            log: message => defaultLogger.log(message),
          })
        : undefined,
      onPtyExit: id => {
        usageLimit.onExit(id)
        if (capabilities && capabilities.revokeTerminal(id) > 0) defaultLogger.log(`[headless] helper capability revoked: terminal=${id}`)
        opts.onPtyExit?.(id) // T0607
      },
      onPtyOutput: (id, data) => usageLimit.onOutput(id, data),
      ...(opts.onBlockedChange ? { onBlockedChange: opts.onBlockedChange } : {}), // T0609
    })
    const ptys = manager
    registerPtyHandlers(register, {
      getPtyManager: () => ptys,
      validateShell: true,
      ...(opts.isUserInput ? { isUserInput: opts.isUserInput } : {}),
      onUserInput: id => usageLimit.onUserInput(id),
    })
    opts.onManager?.(ptys)
    return () => {
      usageLimit.dispose()
      ptys.dispose()
    }
  }
}

export const registerHeadlessPtyHandlers: HandlerModule = createHeadlessPtyModule()

/**
 * T0401: install root of the running server bundle — `staging/` in the tarball,
 * i.e. two levels above the bundled `electron/remote/headless-entry.js`
 * (same anchor as `resolveBundleVersion`). Running from source (tests, dev) it
 * is the repo root.
 */
export function defaultHeadlessInstallRoot(): string {
  return path.resolve(__dirname, '..', '..')
}

/**
 * T0401: embedded claude for headless. The server bundle ships the POSIX
 * wrapper `<installRoot>/node_modules/@anthropic-ai/claude-code/bin/claude`
 * (build-server-bundle.mjs pruneAnthropicPackages). When it is not there —
 * running from the repo, where npm installed `bin/claude.exe` — fall back to
 * resolving the package from the module graph, like Electron dev.
 */
export function resolveHeadlessEmbeddedLayout(
  installRoot: string,
  exists: (p: string) => boolean = fs.existsSync,
): EmbeddedClaudeLayout {
  const bundleLayout: EmbeddedClaudeLayout = { kind: 'server-bundle', installRoot }
  return exists(resolveEmbeddedClaudePath(bundleLayout)) ? bundleLayout : { kind: 'node-modules' }
}

/**
 * T0401: `claude:*` on headless. One ClaudeAgentManager per server, built from
 * the headless `HostDeps` (broadcastHub emit, no notifier ⇒ no completion
 * notifications). The runtime router reads `claudeRuntime` from
 * `<dataDir>/settings.json` and resolves embedded to the bundle's `bin/claude`.
 * Spawn env: ClaudeAgentManager sets `DISABLE_AUTOUPDATER=1` process-wide and
 * `sdkSpawnEnv` adds `DISABLE_UPDATES=1` for embedded only (never for system).
 *
 * No codex (`getCodexManager` omitted): `claude:set-codex-*` stay unregistered
 * and a codex preset is rejected with CODEX_UNSUPPORTED_MESSAGE. No message
 * archive (ALWAYS_LOCAL_CHANNELS — the client answers it).
 */
export function createHeadlessClaudeModule(opts: { installRoot?: string } = {}): HandlerModule {
  return (register, host) => {
    const installRoot = opts.installRoot ?? defaultHeadlessInstallRoot()
    configureRuntimeRouter({
      getDataDir: () => host.dataDir,
      getEmbeddedLayout: () => resolveHeadlessEmbeddedLayout(installRoot),
    })
    const manager = new ClaudeAgentManager(host)
    registerClaudeHandlers(register, {
      emit: host.emit,
      homeDir: host.homeDir,
      getClaudeManager: () => manager,
    })
    return () => {
      manager.killAll()
      manager.dispose()
    }
  }
}

/**
 * T0431: the settings fields `terminal:*` reads from `<dataDir>/settings.json`,
 * dropping values of the wrong type (the file is hand-editable on the server).
 */
export function readHeadlessTerminalSettings(raw: Record<string, unknown>): PersistedShellSettings & AgentCommandSettings {
  const settings: PersistedShellSettings & AgentCommandSettings = {}
  if (typeof raw.shell === 'string') settings.shell = raw.shell
  if (typeof raw.customShellPath === 'string') settings.customShellPath = raw.customShellPath
  if (typeof raw.defaultAgent === 'string') settings.defaultAgent = raw.defaultAgent
  const customArgs = raw.agentCustomArgs
  if (customArgs && typeof customArgs === 'object' && !Array.isArray(customArgs)) {
    const args: Record<string, string> = {}
    for (const [agentId, value] of Object.entries(customArgs)) {
      if (typeof value === 'string') args[agentId] = value
    }
    settings.agentCustomArgs = args
  }
  return settings
}

/**
 * T0431 (PLAN-036 P3 / K): `terminal:create-with-command` / `create-agent-command` /
 * `notify` / `keypress` on headless (electron/handlers/terminal.ts). PTYs are created
 * on the pty module's PtyManager; events go to the connected clients only. Agent
 * command: `<dataDir>/settings.json` (`defaultAgent` / `agentCustomArgs`), no workspace
 * default agent (the client's window registry is not here), no elevation; claude
 * resolves through the runtime router the claude module configured (bundle `bin/claude`).
 * `countRemoteReceivers`: clients that will get the keypress broadcast — without it,
 * `terminal:keypress` never answers `no-client`.
 * PLAN-041 / T0536: `terminal:close-worker` is the Electron scheduler (electron/close-worker.ts)
 * on this server's PtyManager; `terminal:close-requested` goes to the connected clients, whose
 * window holding the tab closes it. `isWorkerOf` (the helper capability registry) is the extra
 * ownership check. No client connected when the timer fires ⇒ nobody closes the tab (it is still
 * there on the next connect).
 */
export function createHeadlessTerminalModule(opts: {
  getPtyManager: () => PtyManager | null
  countRemoteReceivers?: (ctx: HandlerContext) => number
  /** T0433: refuse agents this server cannot run (`createHeadlessAgentAvailabilityCheck`). */
  checkAgentAvailable?: (agentId: string) => Promise<AgentUnavailableResult | null>
  /** T0536: whether PTY `terminalId` is a worker dispatched by tower `towerId`. */
  isWorkerOf?: (terminalId: string, towerId: string) => boolean
  /** T0583: `--isolation worktree` / `--worktree` cleanup. Default: the resolved git, `BAT_*` scrubbed. */
  ctWorktree?: CtWorktreeService
  /** T0584: bundle root whose `scripts/bat-mcp.mjs` dispatched claude / codex get; absent ⇒ none. */
  batMcpInstallRoot?: string
}): HandlerModule {
  return (register, host) => {
    const readSettings = () => readHeadlessTerminalSettings(host.getSettings())
    const batMcpLaunchArgs = opts.batMcpInstallRoot
      ? createBatMcpLaunchArgs(createHeadlessBatMcpHost(opts.batMcpInstallRoot, host, fs.existsSync, opts.getPtyManager), 'dispatch')
      : undefined
    const countRemoteReceivers = opts.countRemoteReceivers
    // PLAN-047 W1 / T0583: git runs on this server, in the server's checkout of the dispatch cwd
    const ctWorktree = opts.ctWorktree ?? new CtWorktreeService({
      gitBinary: createHeadlessGitBinaryResolver(),
      env: () => buildProbeEnv(process.env, isHeadlessScrubbedEnvKey),
    })
    const workerCloser = new WorkerCloseScheduler({
      getPtyManager: opts.getPtyManager,
      ...(opts.isWorkerOf ? { isOwnedBy: opts.isWorkerOf } : {}),
      cleanupWorktree: (record, mode) => ctWorktree.cleanup(record, mode),
      emit: (channel, payload) => {
        host.emit(channel, payload)
        return countRemoteReceivers ? countRemoteReceivers({ windowId: null }) : undefined
      },
      logger: defaultLogger,
    })
    registerTerminalHandlers(register, {
      getPtyManager: opts.getPtyManager,
      emit: (channel, payload) => {
        host.emit(channel, payload)
        return 0
      },
      readSettings,
      buildAgentPromptCommand: createAgentPromptCommandBuilder({
        readSettings,
        resolveWorkspaceAgentSettings: async () => null,
        ensureElevationApplied: async () => {},
        batMcpLaunchArgs, // T0584
        // T0641: the claude on this server (no workspace names here: a Worker is `BAT · Worker · T####`)
        ...(batMcpLaunchArgs ? { claudeNameSupport: headlessClaudeNameSupport } : {}),
        // T0621 (C-5): the codex on this server, probed here
        codexWritesOsc: createCodexOscVersionCheck({ logger: defaultLogger }),
        recordBlockedDetection: (terminalId, detection) => opts.getPtyManager()?.setBlockedDetection(terminalId, detection),
        logger: defaultLogger,
      }),
      countRemoteReceivers: opts.countRemoteReceivers,
      checkAgentAvailable: opts.checkAgentAvailable,
      validateShell: true,
      workerCloser,
      ctWorktree,
    })
    return () => workerCloser.dispose()
  }
}

/**
 * PLAN-047 M1 / T0584: the `bat` MCP server of a claude / codex tab on this server — the shim
 * `<installRoot>/scripts/bat-mcp.mjs` run by the bundle's node (`<installRoot>/bin/node`, else
 * `node`), the claude config under `<dataDir>/bat-mcp/`, Settings `batMcpEnabled` from
 * `<dataDir>/settings.json` (default on). Same rule as the helper env: no helpers in
 * `<installRoot>/scripts` (`HEADLESS_REQUIRED_HELPER_SCRIPTS`) ⇒ no endpoint in the tab ⇒ none.
 */
/** T0641 (C-3): whether the claude this server's claude-cli tabs launch knows `--name`. */
const headlessClaudeNameSupport = createClaudeNameSupportCheck({
  resolveRuntime: () => resolveClaudeRuntime(getRuntimeSettingsSnapshot()),
  logger: defaultLogger,
})
/** T0651: whether the codex this server's codex-cli tabs launch knows `--no-daemon`. */
const headlessCodexNoDaemonSupport = createCodexNoDaemonSupportCheck({ logger: defaultLogger })

export function createHeadlessBatMcpHost(
  installRoot: string,
  host: HostDeps,
  exists: (p: string) => boolean = fs.existsSync,
  /** T0590: where the launch decision is recorded as the tab's `blockedDetection`. */
  getPtyManager?: () => PtyManager | null,
): BatMcpHost {
  const helperDir = path.join(installRoot, 'scripts')
  const helperNode = path.join(installRoot, 'bin', 'node')
  return {
    dataDir: () => host.dataDir,
    helperDir: () => HEADLESS_REQUIRED_HELPER_SCRIPTS.every(name => exists(path.join(helperDir, name))) ? helperDir : undefined,
    nodeCommand: () => exists(helperNode) ? helperNode : 'node',
    // answering a client (or a helper) means this server listens: its PTYs have the endpoint
    endpointReady: () => true,
    readSettings: () => host.getSettings(),
    recordBlockedDetection: (terminalId, detection) => getPtyManager?.()?.setBlockedDetection(terminalId, detection),
    // T0600: the server user's claude settings (`host.homeDir`) that can turn the hooks off
    claudeSettingsFiles: () => defaultClaudeSettingsFiles(process.env, process.platform, host.homeDir),
    // T0641: the session name of a remote window's claude-cli tab (the window sends the name)
    claudeNameSupport: headlessClaudeNameSupport,
    recordClaudeSessionName: (terminalId, record) => claudeSessionNameRecords.set(terminalId, record),
    // T0651: `--no-daemon` for a remote window's codex tab without the MCP args
    codexNoDaemonSupport: headlessCodexNoDaemonSupport,
    logger: defaultLogger,
  }
}

/** T0584: `agent:bat-mcp-launch-args` on headless (a remote window's claude-cli / codex tab). */
export function createHeadlessBatMcpModule(opts: { installRoot?: string; getPtyManager?: () => PtyManager | null } = {}): HandlerModule {
  return (register, host) => {
    registerBatMcpHandlers(register, createHeadlessBatMcpHost(opts.installRoot ?? defaultHeadlessInstallRoot(), host, fs.existsSync, opts.getPtyManager))
  }
}

/**
 * PLAN-047 M1 / T0582: the read-only helper queries (`terminal:whoami` / `list` / `get-state` /
 * `read-output` / `wait`, electron/terminal-query-handlers.ts — the module Electron main registers)
 * on this server's PtyManager. The caller's scope uses this server's capability registry
 * (`isWorkerOf`); no saved tabs here (no titles, no workspace of a PTY the server did not create
 * with one). `knownSecrets`: the server token, masked out of read-output literally.
 * PLAN-048 / T0607 (C-10): + the tower-question channels (electron/tower-questions.ts, the module
 * Electron main registers) — a Tower and its Workers on this server ask / answer each other; the
 * store is this server process's memory. `onPtyExit` hands it the PTYs that are gone (the pty
 * module's exit hook); a server restart ends every PTY, and old ids answer `lost`.
 * T0609 (BUG-153): + `terminal:attention-changed` to the connected clients (electron/terminal-attention.ts)
 * from the tower-question store and the pty module's `blocked` changes (`onBlockedChange`).
 */
export function createHeadlessTerminalQueryModule(opts: {
  getPtyManager: () => PtyManager | null
  isWorkerOf?: (terminalId: string, towerId: string) => boolean
  knownSecrets?: () => readonly string[]
  /** T0585: `worktree:terminal-status`. Default: the resolved git, `BAT_*` scrubbed. */
  ctWorktree?: CtWorktreeService
  /** T0607: subscribes to the PTYs that are gone; returns the unsubscribe. */
  onPtyExit?: (listener: (id: string) => void) => () => void
  /** T0609: subscribes to the PTYs whose hook `blocked` changed; returns the unsubscribe. */
  onBlockedChange?: (listener: (id: string) => void) => () => void
}): HandlerModule {
  return (register, host) => {
    // T0609 (BUG-153): a tab waits for the user / its Tower's answer → the connected clients
    let attention: TerminalAttentionNotifier | null = null
    const towerQuestions = registerTowerQuestionHandlers({
      registerHandler: register,
      getPtyManager: opts.getPtyManager,
      isWorkerOf: opts.isWorkerOf ?? (() => false),
      ...(opts.knownSecrets ? { knownSecrets: opts.knownSecrets } : {}),
      logger: defaultLogger,
      mirrorToBatScripts,
      onChange: workerId => attention?.refresh(workerId),
    })
    attention = new TerminalAttentionNotifier({
      getBlockedState: id => opts.getPtyManager()?.getBlockedState(id) ?? null,
      getQuestionSummary: id => towerQuestions.summaryFor(id),
      emit: (channel, payload) => host.emit(channel, payload),
      logger: defaultLogger,
    })
    const notifier = attention
    const unsubscribeBlocked = opts.onBlockedChange?.(id => notifier.refresh(id))
    const unsubscribeExit = opts.onPtyExit?.(id => towerQuestions.terminalEnded(id))
    const queries = registerTerminalQueryHandlers({
      registerHandler: register,
      getPtyManager: opts.getPtyManager,
      isWorkerOf: opts.isWorkerOf ?? (() => false),
      ...(opts.knownSecrets ? { knownSecrets: opts.knownSecrets } : {}),
      getQuestionSummary: terminalId => towerQuestions.summaryFor(terminalId), // T0607
      // T0642: kept in memory only (headless does not persist, C-8)
      getClaudeSessionName: terminalId => claudeSessionNameRecords.get(terminalId)?.name ?? null,
      logger: defaultLogger,
      mirrorToBatScripts,
    })
    // PLAN-047 W1-2 / T0585: `worktree:terminal-status` — git runs on this server, in its checkout;
    // Workers are found as `--close-worker` finds them here (PtyManager + `isWorkerOf`).
    const ctWorktree = opts.ctWorktree ?? new CtWorktreeService({
      gitBinary: createHeadlessGitBinaryResolver(),
      env: () => buildProbeEnv(process.env, isHeadlessScrubbedEnvKey),
    })
    // PLAN-047 M1b-1 / T0590: `terminal:report-hook` (claude hooks of a tab on this server)
    registerReportHookHandler({
      registerHandler: register,
      getPtyManager: opts.getPtyManager,
      logger: defaultLogger,
      mirrorToBatScripts,
    })
    registerWorktreeStatusHandler({
      registerHandler: register,
      getWorkerView: opts.getPtyManager,
      isWorkerOf: opts.isWorkerOf ?? (() => false),
      status: record => ctWorktree.status(record),
      // PLAN-047 Q3 / T0589: after the Worker tab closed (exited record, then git)
      getExitedView: opts.getPtyManager,
      getTerminalCwd: terminalId => opts.getPtyManager()?.getTerminalInfo(terminalId)?.cwd,
      statusFromGit: query => ctWorktree.statusFromGit(query),
      logger: defaultLogger,
      mirrorToBatScripts,
    })
    return () => {
      unsubscribeExit?.()
      unsubscribeBlocked?.()
      towerQuestions.dispose()
      queries.dispose()
      notifier.dispose()
    }
  }
}

/**
 * T0433: the last `remote-tools:detect` result of this server, shared by the
 * `remote-tools:detect` handler and the agent availability check. Concurrent callers
 * share one in-flight probe.
 */
export class HeadlessRemoteToolsCache {
  private last: { at: number; result: RemoteToolsDetectResult } | null = null
  private inflight: Promise<RemoteToolsDetectResult> | null = null

  constructor(private readonly opts: {
    detect: () => Promise<RemoteToolsDetectResult>
    now?: () => number
  }) {}

  detect(): Promise<RemoteToolsDetectResult> {
    if (this.inflight) return this.inflight
    const run = this.opts.detect().then(result => {
      this.last = { at: (this.opts.now ?? Date.now)(), result }
      return result
    }).finally(() => {
      if (this.inflight === run) this.inflight = null
    })
    this.inflight = run
    return run
  }

  /** Last finished detection and when it finished, or null. */
  peek(): { at: number; result: RemoteToolsDetectResult } | null {
    return this.last
  }
}

/**
 * T0433: agents (terminal-driven ids) the server bundle does not ship, mapped to the
 * remote tools detection entry that says whether the machine has them. Claude is bundled
 * (always runnable); agents the detection has no entry for are not judged.
 */
export const HEADLESS_AGENT_TOOLS: Readonly<Record<string, RemoteToolId>> = {
  'codex-cli': 'codex',
}

/** T0433: detection statuses under which the agent runs in a remote login shell. */
const RUNNABLE_TOOL_STATUSES: ReadonlySet<string> = new Set(['ok', 'error'])
/** A runnable result is trusted this long; a not-runnable one only briefly (just installed?). */
export const HEADLESS_AGENT_CHECK_RUNNABLE_TTL_MS = 10 * 60 * 1000
export const HEADLESS_AGENT_CHECK_MISSING_TTL_MS = 30 * 1000
/** Under bat-terminal.mjs's 3 s invoke timeout. */
export const HEADLESS_AGENT_CHECK_WAIT_MS = 2000

/**
 * T0433 (T0431 遭遇問題 4): `terminal:create-agent-command` for an agent this server cannot
 * run answers `AGENT_UNAVAILABLE` instead of typing `codex …` into a shell that prints
 * `command not found`. The decision reuses the PLAN-037 remote tools detection (no new
 * probe): the cached result while fresh, else a detection bounded by `waitMs`. Still
 * running ⇒ the last (stale) result when there is one, else `AGENT_CHECK_PENDING` (retry;
 * the detection keeps going and fills the cache). A failed detection (Windows host, probe
 * error) or an agent the detection has no entry for ⇒ not judged (null, launched as before).
 */
export function createHeadlessAgentAvailabilityCheck(
  cache: HeadlessRemoteToolsCache,
  opts: { now?: () => number; waitMs?: number } = {},
): (agentId: string) => Promise<AgentUnavailableResult | null> {
  const now = opts.now ?? Date.now
  const waitMs = opts.waitMs ?? HEADLESS_AGENT_CHECK_WAIT_MS
  const toolStatus = (result: RemoteToolsDetectResult, tool: RemoteToolId) =>
    result.ok ? result.report.tools.find(t => t.id === tool)?.status : undefined
  const isFresh = (cached: { at: number; result: RemoteToolsDetectResult }, tool: RemoteToolId) => {
    const status = toolStatus(cached.result, tool)
    const ttl = status && RUNNABLE_TOOL_STATUSES.has(status)
      ? HEADLESS_AGENT_CHECK_RUNNABLE_TTL_MS
      : HEADLESS_AGENT_CHECK_MISSING_TTL_MS
    return now() - cached.at < ttl
  }

  return async agentId => {
    const tool = HEADLESS_AGENT_TOOLS[agentId]
    if (!tool) return null

    const cached = cache.peek()
    let result: RemoteToolsDetectResult | null = cached && isFresh(cached, tool) ? cached.result : null
    if (!result) {
      let timer: ReturnType<typeof setTimeout> | undefined
      const timedOut = Symbol('timed-out')
      const outcome = await Promise.race([
        cache.detect().catch(() => null),
        new Promise<typeof timedOut>(resolve => { timer = setTimeout(() => resolve(timedOut), waitMs) }),
      ])
      if (timer) clearTimeout(timer)
      if (outcome === timedOut) {
        const stale = cache.peek()
        if (!stale) {
          return {
            ok: false,
            code: AGENT_CHECK_PENDING,
            agentId,
            tool,
            error: `Checking whether ${tool} is installed on this server; retry in a few seconds.`,
          }
        }
        result = stale.result
      } else {
        result = outcome
      }
    }
    if (!result || !result.ok) return null

    const status = toolStatus(result, tool)
    if (!status || RUNNABLE_TOOL_STATUSES.has(status)) return null
    return {
      ok: false,
      code: AGENT_UNAVAILABLE,
      agentId,
      tool,
      status,
      error: `${tool} is not available on this server (remote tools detection: ${status}). ` +
        `The server bundle ships claude only; install ${tool} on the server (remote tools panel), or dispatch with --agent claude.`,
    }
  }
}

/** T0411: test seams for `remote-tools:detect` (fake execFile / platform / env). */
export type HeadlessRemoteToolsOverrides = Omit<RemoteToolsHandlerDeps, 'isScrubbedEnvKey'>

/**
 * T0411 (PLAN-037 B): `remote-tools:detect` on headless — the T0408 probe on the
 * server machine. Probe env is the server env minus `isHeadlessScrubbedEnvKey`
 * (same rule as headless PTYs), so `BAT_*` never reaches the probe shell.
 */
export function createHeadlessRemoteToolsModule(
  overrides: HeadlessRemoteToolsOverrides = {},
  cache: HeadlessRemoteToolsCache = createHeadlessRemoteToolsCache(overrides),
): HandlerModule {
  return register => {
    // T0433: answered through the cache the agent availability check reads.
    register(REMOTE_TOOLS_DETECT_CHANNEL, () => cache.detect())
  }
}

/** T0433: the T0408 probe on this server (`isHeadlessScrubbedEnvKey` env), behind a cache. */
export function createHeadlessRemoteToolsCache(overrides: HeadlessRemoteToolsOverrides = {}): HeadlessRemoteToolsCache {
  return new HeadlessRemoteToolsCache({
    detect: () => runRemoteToolsDetect({ ...overrides, isScrubbedEnvKey: isHeadlessScrubbedEnvKey }),
  })
}

/**
 * T0405: git executable for headless. The systemd user service PATH has no
 * ~/.local/bin (T0407 / T0414), so `resolveGitBinary` also scans the usual
 * install locations. A hit is cached; a miss falls back to plain `git` and is
 * retried on the next call (git installed while the server runs).
 */
export function createHeadlessGitBinaryResolver(resolve: typeof resolveGitBinary = resolveGitBinary): () => string {
  let cached: string | null = null
  return () => {
    if (cached) return cached
    const result = resolve()
    if (result.found && result.path) cached = result.path
    return result.path ?? 'git'
  }
}

/** T0405: test seams for `github:check-cli` (fake spawn / execFileSync / gh resolve / env). */
export type HeadlessGitOverrides = Omit<GitHandlerDeps, 'getGithubCliPath' | 'isScrubbedEnvKey'>

/**
 * T0405: `worktree:*` / `git:*` / `git-scaffold:*` / `github:*` on headless —
 * git and gh run on the server machine. `githubCliPath` comes from
 * `<dataDir>/settings.json`. The worktree singleton (shared with the claude
 * module's ClaudeAgentManager) uses the same resolved git.
 * T0423: the git / gh children of `git:*` / `github:*` get the server env minus
 * `isHeadlessScrubbedEnvKey` (same rule as headless PTYs), so `BAT_*` never
 * reaches them. T0429: so do `git-scaffold:*` (simple-git; the keys simple-git
 * refuses are dropped too) and the worktree singleton's git children — the latter
 * also for the claude module's (ClaudeAgentManager) worktree sessions.
 */
export function createHeadlessGitModule(overrides: HeadlessGitOverrides = {}): HandlerModule {
  return (register, host) => {
    const getGitBinary = overrides.getGitBinary ?? createHeadlessGitBinaryResolver()
    const getEnv = overrides.getEnv ?? (() => process.env)
    worktreeManager.setGitBinaryResolver(getGitBinary)
    worktreeManager.setEnvProvider(() => buildProbeEnv(getEnv(), isHeadlessScrubbedEnvKey))
    registerGitHandlers(register, {
      ...overrides,
      getGitBinary,
      isScrubbedEnvKey: isHeadlessScrubbedEnvKey,
      getGithubCliPath: () => {
        const value = host.getSettings().githubCliPath
        return typeof value === 'string' ? value : undefined
      },
    })
  }
}

/**
 * T0406 (PLAN-036 P2-I): `fs:*` / `image:read-as-data-url` / `workspace:sync-roots`
 * on headless. The sandbox is a per-server `SyncedWorkspaceRoots`: each client
 * connection pushes its windows' roots (server form), the allowlist is the union,
 * and nothing is allowed before a push (fail closed). `onRoots` hands the store to
 * the server, which drops a connection's roots when it closes. `fs:changed` goes
 * out through `host.emit` (broadcastHub → clients, translated back by the client).
 */
export function createHeadlessFsModule(opts: { onRoots?: (roots: SyncedWorkspaceRoots) => void } = {}): HandlerModule {
  return (register, host) => {
    const roots = new SyncedWorkspaceRoots()
    const dispose = registerFsHandlers(register, { emit: host.emit, pathGuard: roots, workspaceRoots: roots })
    opts.onRoots?.(roots)
    return dispose
  }
}

/**
 * Shared domain modules for one headless server; `installRoot` overrides the bundle
 * location (tests). T0404: `pty` carries the PTY cap and the manager hand-off.
 * T0411: `remoteTools` overrides the probe's execFile / platform / env (tests).
 * T0405: `git` overrides the gh spawn / resolve (tests).
 * T0406: `fs.onRoots` hands over the synced-roots store.
 * T0431: `terminal.countRemoteReceivers` feeds the keypress `no-client` check; the
 * terminal module shares the pty module's PtyManager.
 * T0433: PTY helpers live in `<installRoot>/scripts`; `terminal:create-agent-command`
 * checks the agent against the remote tools detection the `remote-tools:detect` handler
 * shares (`HeadlessRemoteToolsCache`).
 */
export function createHeadlessHandlerModules(opts: {
  installRoot?: string
  pty?: Parameters<typeof createHeadlessPtyModule>[0]
  remoteTools?: HeadlessRemoteToolsOverrides
  git?: HeadlessGitOverrides
  fs?: Parameters<typeof createHeadlessFsModule>[0]
  terminal?: {
    countRemoteReceivers?: (ctx: HandlerContext) => number
    isWorkerOf?: (terminalId: string, towerId: string) => boolean
    /** T0582: secrets masked literally in `terminal:read-output` (the server token). */
    knownSecrets?: () => readonly string[]
  }
} = {}): HandlerModule[] {
  let ptyManager: PtyManager | null = null
  // T0607: the tower-question store hears of PTYs that are gone
  const ptyExitListeners = new Set<(id: string) => void>()
  // T0609: the attention push hears of `blocked` changes
  const blockedChangeListeners = new Set<(id: string) => void>()
  const toolsCache = createHeadlessRemoteToolsCache(opts.remoteTools)
  const ptyModule = createHeadlessPtyModule({
    helperDir: path.join(opts.installRoot ?? defaultHeadlessInstallRoot(), 'scripts'),
    ...opts.pty,
    onManager: manager => {
      ptyManager = manager
      opts.pty?.onManager?.(manager)
    },
    onPtyExit: id => {
      opts.pty?.onPtyExit?.(id)
      for (const listener of [...ptyExitListeners]) listener(id)
    },
    onBlockedChange: id => {
      opts.pty?.onBlockedChange?.(id)
      for (const listener of [...blockedChangeListeners]) listener(id)
    },
  })
  return [
    ptyModule, // T0390
    createHeadlessClaudeModule({ installRoot: opts.installRoot }), // T0401
    createHeadlessTerminalModule({ // T0431
      getPtyManager: () => ptyManager,
      countRemoteReceivers: opts.terminal?.countRemoteReceivers,
      isWorkerOf: opts.terminal?.isWorkerOf, // T0536
      checkAgentAvailable: createHeadlessAgentAvailabilityCheck(toolsCache), // T0433
      batMcpInstallRoot: opts.installRoot ?? defaultHeadlessInstallRoot(), // T0584
    }),
    createHeadlessBatMcpModule({ installRoot: opts.installRoot, getPtyManager: () => ptyManager }), // T0584; T0590: blockedDetection
    createHeadlessTerminalQueryModule({ // T0582; T0607: + tower questions
      getPtyManager: () => ptyManager,
      isWorkerOf: opts.terminal?.isWorkerOf,
      knownSecrets: opts.terminal?.knownSecrets,
      onPtyExit: listener => {
        ptyExitListeners.add(listener)
        return () => { ptyExitListeners.delete(listener) }
      },
      onBlockedChange: listener => {
        blockedChangeListeners.add(listener)
        return () => { blockedChangeListeners.delete(listener) }
      },
    }),
    createHeadlessRemoteToolsModule(opts.remoteTools, toolsCache), // T0411
    createHeadlessGitModule(opts.git), // T0405
    createHeadlessFsModule(opts.fs), // T0406
  ]
}

/**
 * PLAN-036 / D129 (T0388): shared domain modules (`electron/handlers/*.ts`)
 * headless bat-server registers — the same modules Electron main registers
 * with its own deps. A module going online here must delete its channels from
 * `HEADLESS_UNSUPPORTED` (headless-channel-status.ts) in the same commit, or
 * the parity test fails.
 */
export const HEADLESS_HANDLER_MODULES: readonly HandlerModule[] = createHeadlessHandlerModules()

/**
 * Headless side of `HostDeps`: events go to connected remote clients only
 * (broadcastHub → RemoteServer → PROXIED_EVENTS filter); no helper dir, no
 * desktop notifier, no settings side effects. No `pathGuard` here: the fs
 * module builds its own per-server synced-roots guard (T0406,
 * `createHeadlessFsModule`), fail-closed until a client pushes
 * `workspace:sync-roots` (T0386 §4).
 */
export function createHeadlessHostDeps(dataDir: string): HostDeps {
  return {
    emit: (channel, ...args) => broadcastHub.broadcast(channel, ...args),
    dataDir,
    homeDir: os.homedir(),
    getSettings: () => readHeadlessSettings(dataDir),
  }
}

export interface HeadlessServerOptions {
  dataDir: string
  port: number
  token?: string
  bindInterface?: BindInterface
  secretStrategy?: SecretStrategy
  certificateProvider?: CertificateProvider
  handlers?: HeadlessHandlerRegistration[]
  /** T0401: server bundle install root (embedded claude lookup). Default: `defaultHeadlessInstallRoot()`. */
  installRoot?: string
  /**
   * T0404: kill every PTY after this long without an authenticated client (0 = never).
   * Default: env `BAT_SERVER_PTY_IDLE_HOURS`, else 24h.
   */
  ptyIdleReclaimMs?: number
  /** T0404: most concurrent PTYs (0 = unlimited). Default: env `BAT_SERVER_MAX_PTYS`, else 64. */
  maxPtys?: number
  /** T0411: `remote-tools:detect` test seams (fake execFile / platform / env). */
  remoteTools?: HeadlessRemoteToolsOverrides
  /** T0405: `github:check-cli` / git test seams (fake gh spawn / resolve / env). */
  git?: HeadlessGitOverrides
  /** BUG-103: server environment for auth metadata (tests). Default: `detectServerEnv()`. */
  detectServerEnv?: () => ServerEnvInfo
  /**
   * T0432: per-PTY helper capabilities this server accepts. Default: a fresh registry per
   * server (memory only — a restarted server accepts none of the old tokens). `stop()`
   * clears it.
   */
  helperCapabilities?: HelperCapabilityRegistry
  /** T0450: tower helpers' terminal creation quota (tests inject a clock). Default: a fresh one per server. */
  helperSpawnQuota?: HelperTowerSpawnQuota
  logger?: {
    log: (...args: unknown[]) => void
    warn: (...args: unknown[]) => void
    error: (...args: unknown[]) => void
  }
}

export interface HeadlessServerInfo {
  port: number
  bindAddress: string
  fingerprint: string
  tokenHash: string
  startTime: number
  pid: number
  bundleVersion: string
}

export interface HeadlessServer {
  start(): Promise<{ port: number; fingerprint: string; bindAddress: string }>
  stop(): Promise<void>
  rotateToken(opts?: { gracePeriodMs?: number }): Promise<{ token: string; oldToken: string; oldValidUntil: number }>
  renewCertificate(): Promise<{ fingerprint: string; expiresAt: number }>
  getInfo(): HeadlessServerInfo
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex').slice(0, 8)
}

function resolveBundleVersion(): string {
  try {
    const pkgPath = path.resolve(__dirname, '..', '..', 'package.json')
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as { version?: string }
    return pkg.version || '0.0.0'
  } catch {
    return '0.0.0'
  }
}

export function getHeadlessBundleVersion(): string {
  return resolveBundleVersion()
}

export async function loadOrGenerateToken(dataDir: string): Promise<string> {
  const tokenPath = path.join(dataDir, 'server-token.json')
  const persisted = readSecretFile(tokenPath)
  if (persisted) return persisted

  const token = randomBytes(32).toString('base64url')
  writeSecretFile(tokenPath, token)
  return token
}

export async function createHeadlessServer(opts: HeadlessServerOptions): Promise<HeadlessServer> {
  fs.mkdirSync(opts.dataDir, { recursive: true })
  const strategy = opts.secretStrategy ?? detectSecretStrategy()
  setSecretStrategy(strategy)

  let resolvedToken = opts.token ?? (await loadOrGenerateToken(opts.dataDir))
  const certificateProvider =
    opts.certificateProvider ?? new FileCertificateProvider(opts.dataDir)
  let ptyManager: PtyManager | null = null
  let fsRoots: SyncedWorkspaceRoots | null = null
  const helperCapabilities = opts.helperCapabilities ?? new HelperCapabilityRegistry()
  const remoteServer = new RemoteServer({
    certificateProvider,
    logger: opts.logger,
    detectServerEnv: opts.detectServerEnv,
    // T0432: helpers inside headless PTYs authenticate with their PTY's capability.
    // T0579: default role table (`HELPER_CHANNEL_ROLES`), the same as Electron's local one — a
    // tower may also dispatch in raw command mode (`terminal:create-with-command`).
    helperCapabilities,
    isTerminalAlive: id => ptyManager?.isAlive(id) ?? false,
    // T0450 (T0445 #7): a tower helper launches registry agents only, within its creation
    // quota; helpers never take the last PTY slots the clients need.
    // T0527: a shorthand (`codex` → `codex-cli`) counts only once normalized to a registry id;
    // the terminal handler normalizes the same way before launching (normalizeAgentAlias).
    isKnownAgent: agent => agentRegistry.getDefinition(normalizeAgentAlias(agent)) !== undefined,
    getPtyCapacity: () => ptyManager?.getCapacity() ?? null,
    helperSpawnQuota: opts.helperSpawnQuota,
  })
  remoteServer.configDir = opts.dataDir
  const log = opts.logger ?? defaultLogger
  const ptyLimits = resolveHeadlessPtyLimits(opts, process.env, message => log.warn(message))

  // T0385: built-ins first so caller-supplied handlers can override them.
  // T0388: shared domain modules sit between the two.
  const register: HandlerRegistrar = registerHandler
  for (const registration of createHeadlessDefaultHandlers({ dataDir: opts.dataDir })) {
    register(registration.channel, registration.handler)
  }
  const hostDeps = createHeadlessHostDeps(opts.dataDir)
  const moduleDisposers: HandlerModuleDisposer[] = []
  const handlerModules = createHeadlessHandlerModules({
    installRoot: opts.installRoot,
    pty: {
      maxPtys: ptyLimits.maxPtys,
      onManager: manager => { ptyManager = manager },
      helperCapabilities,
      // T0433: helpers in this server's PTYs reach it on its bound port with their own
      // capability, pin <dataDir>/server-cert.json, and log under <dataDir>/Logs.
      helperEndpoint: () => {
        const port = remoteServer.port
        return port
          ? {
              port,
              certPath: path.join(opts.dataDir, 'server-cert.json'),
              logDir: path.join(opts.dataDir, 'Logs'),
            }
          : null
      },
      // T0536: only a BAT window's typing cancels a pending --close-worker, not a helper's write.
      isUserInput: ctx => remoteServer.isClientConnection(ctx.connectionId),
      // T0566: an automatic continue needs a client window to type it (Enter is a client keypress).
      usageLimitCanDeliver: () => remoteServer.countBroadcastReceivers(undefined) > 0,
    },
    remoteTools: opts.remoteTools,
    git: opts.git,
    fs: { onRoots: roots => { fsRoots = roots } },
    // T0431: every authenticated client gets the broadcast except the invoking one.
    // T0432: helper (capability) connections are not clients — they neither receive
    // broadcasts nor count, whether they invoke or merely stay connected.
    terminal: {
      countRemoteReceivers: ctx => remoteServer.countBroadcastReceivers(ctx.connectionId),
      // T0536: a tower closes only a worker holding a capability bound to it.
      isWorkerOf: (terminalId, towerId) => helperCapabilities.isWorkerOf(terminalId, towerId),
      // T0582: read-output masks this server's token literally
      knownSecrets: () => [remoteServer.currentToken],
    },
  })
  for (const registerModule of handlerModules) {
    const dispose = registerModule(register, hostDeps)
    if (dispose) moduleDisposers.push(dispose)
  }
  for (const registration of opts.handlers ?? []) {
    register(registration.channel, registration.handler)
  }

  // T0404: orphan PTY reclaim — headless only; Electron's PtyManager has neither cap nor timer.
  const reclaimer = new HeadlessOrphanPtyReclaimer({
    idleMs: ptyLimits.idleReclaimMs,
    reclaim: () => ptyManager?.killAll() ?? 0,
    log: message => log.log(message),
  })
  const unsubscribeClientCount = remoteServer.onClientCountChange(count => reclaimer.update(count))
  // T0406: a closed connection's synced fs roots stop counting toward the allowlist.
  const unsubscribeClientDisconnect = remoteServer.onClientDisconnect(connectionId => {
    if (fsRoots?.removeConnection(connectionId)) {
      log.log(`[headless] fs roots of a closed connection dropped; ${fsRoots.getRoots().length} root(s) remain`)
    }
  })
  log.log(
    `[headless] orphan PTY reclaim: ${ptyLimits.idleReclaimMs > 0 ? `after ${formatDuration(ptyLimits.idleReclaimMs)} without a client` : 'disabled'}; ` +
      `PTY limit: ${ptyLimits.maxPtys > 0 ? ptyLimits.maxPtys : 'unlimited'}`,
  )

  let lockHeld = false
  let info: HeadlessServerInfo = {
    port: opts.port,
    bindAddress: '127.0.0.1',
    fingerprint: '',
    tokenHash: hashToken(resolvedToken),
    startTime: 0,
    pid: process.pid,
    bundleVersion: resolveBundleVersion(),
  }

  return {
    async start() {
      if (!lockHeld) {
        acquireLock(opts.dataDir)
        lockHeld = true
      }

      try {
        const started = await remoteServer.start(
          opts.port,
          resolvedToken,
          opts.bindInterface ?? 'localhost'
        )
        info = {
          ...info,
          port: started.port,
          bindAddress: started.host,
          fingerprint: started.fingerprint,
          startTime: Date.now(),
        }
        reclaimer.update(remoteServer.getClientCount())
        return {
          port: started.port,
          fingerprint: started.fingerprint,
          bindAddress: started.host,
        }
      } catch (error) {
        if (lockHeld) {
          releaseLock(opts.dataDir)
          lockHeld = false
        }
        throw error
      }
    },

    async stop() {
      try {
        unsubscribeClientCount()
        reclaimer.dispose()
        remoteServer.stop()
        unsubscribeClientDisconnect()
        for (const dispose of moduleDisposers.splice(0)) {
          try {
            dispose()
          } catch (error) {
            opts.logger?.warn('[headless] handler module dispose failed:', error)
          }
        }
        // T0432: no helper capability outlives the server.
        helperCapabilities.clear()
      } finally {
        if (lockHeld) {
          releaseLock(opts.dataDir)
          lockHeld = false
        }
      }
    },

    async rotateToken(rotationOpts) {
      const rotated = await remoteServer.rotateToken(rotationOpts)
      resolvedToken = rotated.token
      info = {
        ...info,
        tokenHash: hashToken(rotated.token),
      }
      return rotated
    },

    async renewCertificate() {
      const renewed = await remoteServer.renewCertificate()
      info = {
        ...info,
        fingerprint: renewed.fingerprint,
      }
      return renewed
    },

    getInfo() {
      return {
        ...info,
        port: remoteServer.port ?? info.port,
        bindAddress: remoteServer.host || info.bindAddress,
        fingerprint: remoteServer.currentFingerprint || info.fingerprint,
      }
    }
  }
}
