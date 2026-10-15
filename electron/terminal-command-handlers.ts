import { resolvePersistedShellPathWithDiagnostics, type PersistedShellSettings } from './shell-path-resolver'
import { detectShellFamily, quoteArgForShell, type ShellFamily } from '../src/utils/shell-quote'
import {
  resolveEffectiveAgentArgs,
  resolveEffectiveDefaultAgent,
  type AgentLaunchSource,
  type WorkspaceAgentLaunchFields,
} from '../src/lib/agent-launch-settings'
import { agentRegistry } from './agent-runtime/agent-registry'
import {
  passThroughDispatchWorkspace,
  type DispatchCwdCheck,
  type DispatchWorkspaceRequest,
  type DispatchWorkspaceResolution,
} from './dispatch-workspace'
import { normalizeWorkorderId } from './close-worker'

// 🔴 No `electron` import here: PLAN-036 T0431 registers these handlers on
// headless bat-server too (electron/handlers/terminal.ts).

interface HandlerContext {
  windowId: string | null
  connectionId?: string | null
}

type Handler = (ctx: HandlerContext, ...args: unknown[]) => Promise<unknown> | unknown

interface TerminalWindow {
  webContents: {
    send(channel: string, payload: unknown): void
  }
}

interface TerminalPtyManager {
  isAlive(id: string): boolean
  create(options: {
    id: string
    cwd: string
    type: 'terminal'
    shell?: string
    customEnv?: Record<string, string>
    workspaceId?: string
    /** T0535 (PLAN-041): the work order of a dispatched Worker (`--close-worker` looks it up). */
    workorder?: string
  }): boolean
  write(id: string, data: string): void
}

interface TerminalCommandOptions {
  id: string
  cwd: string
  command: string
  shell?: string
  customEnv?: Record<string, string>
  workspaceId?: string
  /** T0523: answer `TerminalCreatedReport` instead of `true` (bat-terminal.mjs sends it). */
  reportLanding?: boolean
  /** T0535: set by create-agent-command (skill mode) — recorded on the PTY for `--close-worker`. */
  workorder?: string
}

interface TerminalAgentCommandOptions {
  id: string
  cwd: string
  agent?: string
  prompt?: string
  skill?: string
  workorder?: string
  shell?: string
  customEnv?: Record<string, string>
  workspaceId?: string
  reportLanding?: boolean
}

/**
 * T0523: what a created terminal answers when the caller asked for `reportLanding` (instead
 * of `true`). bat-terminal.mjs prints it; older helpers treat any non-`false`,
 * non-`{ ok: false }` result as success, so they keep working against this.
 */
export interface TerminalCreatedReport {
  ok: true
  terminalId: string
  workspace: {
    /** Absent: the active workspace of the window (the renderer decides). */
    id?: string
    name?: string
    source: DispatchWorkspaceResolution['source']
    requestedId?: string
    mismatch: boolean
    /** BUG-132: present when the cwd is not under the landing workspace's folderPath. */
    cwdCheck?: DispatchCwdReport
  }
  /** create-agent-command only. */
  agent?: {
    requested: string
    id: string
    source: BuiltAgentCommand['agentSource']
  }
}

/** BUG-132: what the helper prints when the cwd is not under the landing workspace's folderPath. */
export interface DispatchCwdReport {
  status: 'outside' | 'other-workspace'
  cwd: string
  /** The landing workspace's folderPath. */
  folderPath: string
  cwdWorkspace?: { id: string; name?: string }
}

/**
 * BUG-132: yolo dispatch refused — the cwd belongs to another workspace than the one the
 * terminal would land in (the Tower shell's `BAT_*` can come from another tab).
 */
export const DISPATCH_CWD_OTHER_WORKSPACE = 'DISPATCH_CWD_OTHER_WORKSPACE' as const
/** T0527: `--agent <id>` is not an agent registry id (nor a shorthand of one). */
export const AGENT_UNKNOWN = 'AGENT_UNKNOWN' as const

export interface DispatchRefusal {
  ok: false
  code: typeof DISPATCH_CWD_OTHER_WORKSPACE | typeof AGENT_UNKNOWN
  /** English, human-readable; bat-terminal.mjs prints it. */
  error: string
  cwd?: string
  landingWorkspace?: { id: string; name?: string }
  cwdWorkspace?: { id: string; name?: string }
  agentId?: string
  knownAgents?: string[]
}

/** T0433: `terminal:create-agent-command` refused — the agent cannot run on this host. */
export const AGENT_UNAVAILABLE = 'AGENT_UNAVAILABLE' as const
/** T0433: refused for now — the host is still checking whether the agent can run; retry shortly. */
export const AGENT_CHECK_PENDING = 'AGENT_CHECK_PENDING' as const

/**
 * T0433: what `terminal:create-agent-command` answers instead of creating a terminal that
 * would only print `command not found` (headless: an agent the server bundle does not ship
 * and the remote tools detection does not find). `error` is the English, human-readable text
 * bat-terminal.mjs prints.
 */
export interface AgentUnavailableResult {
  ok: false
  code: typeof AGENT_UNAVAILABLE | typeof AGENT_CHECK_PENDING
  agentId: string
  /** Tool id of the remote tools detection (`codex`), when the decision came from it. */
  tool?: string
  /** Its detection status (`missing` / `not-on-path` / `interop-only`). */
  status?: string
  error: string
}

export interface BuiltAgentCommand {
  command: string
  agentId: string
  prompt: string
  prefixNormalized: boolean
  /**
   * T0523: where the agent came from — `explicit` (`--agent <id>`), `workspace` (the
   * workspace's defaultAgent), `settings` (settings.defaultAgent) or `builtin` (claude-code).
   */
  agentSource?: 'explicit' | 'workspace' | 'settings' | 'builtin'
  /**
   * T0529: where the appended custom args came from — `workspace` (the landing workspace's
   * agentCustomArgs override), `settings` (settings.agentCustomArgs) or `builtin` (none).
   */
  argsSource?: AgentLaunchSource
}

export interface TerminalCommandHandlerDeps {
  registerHandler(channel: string, handler: Handler): void
  /**
   * create-agent-command → create-with-command hop. Absent (T0431, shared module):
   * the create-with-command handler registered here is called directly with the same ctx.
   */
  invokeHandler?(channel: string, args: unknown[], windowId?: string | null): Promise<unknown>
  getPtyManager(): TerminalPtyManager | null
  /**
   * T0431: event sink for `terminal:created-externally` (Electron: windows + broadcastHub;
   * headless: broadcastHub). Absent: sent to `getAllWindows()` only (pre-T0431 behaviour).
   */
  emit?(channel: string, payload: unknown): unknown
  getAllWindows?(): TerminalWindow[]
  /** T0431 (headless): why a client-supplied `shell` is unacceptable, or null when fine. */
  rejectShell?(shell: unknown): string | null
  readPersistedSettingsSync(): PersistedShellSettings | null
  buildAgentPromptCommand(opts: AgentPromptCommandOptions): Promise<BuiltAgentCommand | null>
  /**
   * T0433 (headless): why the resolved agent cannot run on this host, or null when it can
   * (or cannot be judged). Absent (Electron): every agent is launched as before.
   */
  checkAgentAvailable?(agentId: string): Promise<AgentUnavailableResult | null>
  /**
   * T0523 / BUG-129: the workspace a helper-dispatched terminal (no invoking window) lands
   * in — Electron: the `--notify-id` Tower terminal's workspace from the window registry.
   * Absent (headless: the client's workspaces are not on the server): `--workspace` as given;
   * the client renderer then prefers the Tower terminal's workspace (`towerTerminalId` in
   * `terminal:created-externally`).
   */
  resolveDispatchWorkspace?(request: DispatchWorkspaceRequest): Promise<DispatchWorkspaceResolution>
  /** T0527: agent registry lookup for `--agent`. Default: `agentRegistry`. */
  isKnownAgent?(agentId: string): boolean
  /** T0527: ids listed when `--agent` is unknown. Default: `agentRegistry` definitions. */
  listAgentIds?(): string[]
  pickWhitelistedEnv(env?: Record<string, string>): Record<string, string | undefined>
  mirrorToBatScripts(event: string, payload: Record<string, unknown>): void
  logger: {
    log(...args: unknown[]): void
    warn(...args: unknown[]): void
  }
  platform?: NodeJS.Platform
  env?: NodeJS.ProcessEnv
  existsSync?: (path: string) => boolean
  setTimeout?: (callback: () => void, ms: number) => unknown
}

function shellBasename(shellPath: string | undefined): string {
  if (!shellPath) return 'pty-default'
  const normalized = shellPath.replace(/\\/g, '/')
  return normalized.split('/').pop() || shellPath
}

function resolveTerminalShell(
  explicitShell: string | undefined,
  settings: PersistedShellSettings | null,
  deps: TerminalCommandHandlerDeps
) {
  if (explicitShell) {
    return {
      shell: explicitShell,
      basename: shellBasename(explicitShell),
      persistedShell: settings?.shell || 'unset',
      source: 'explicit',
      fallback: false,
      fallbackReason: undefined,
    }
  }

  const resolved = resolvePersistedShellPathWithDiagnostics(settings, {
    platform: deps.platform ?? process.platform,
    env: deps.env ?? process.env,
    existsSync: deps.existsSync,
  })

  return {
    shell: resolved.shellPath,
    basename: shellBasename(resolved.shellPath),
    persistedShell: resolved.persistedShell,
    source: resolved.shellPath ? 'persisted' : 'pty-default',
    fallback: resolved.fallback,
    fallbackReason: resolved.fallbackReason,
  }
}

/** T0523: `undefined` → `(active)` etc. for one-line logs. */
function describeWorkspace(resolution: DispatchWorkspaceResolution): string {
  if (!resolution.workspaceId) return '(active)'
  return resolution.workspaceName ? `${resolution.workspaceId} (${resolution.workspaceName})` : resolution.workspaceId
}

function describeNamed(ws: { id: string; name?: string }): string {
  return ws.name ? `${ws.id} (${ws.name})` : ws.id
}

function quotedNamed(ws: { id: string; name?: string }): string {
  return ws.name ? `"${ws.name}" (${ws.id})` : ws.id
}

function isKnownRegistryAgent(agentId: string): boolean {
  return agentRegistry.getDefinition(agentId) !== undefined
}

/**
 * T0527 (T0526): `--agent codex` / `--agent claude` → the registry id `codex-cli` /
 * `claude-cli`. Maps only to an id `isKnownAgent` accepts: the id itself, its lower-case
 * form, or `<id>-cli`. Anything else comes back unchanged (and stays unknown), so a
 * registry-agent check of the result (headless helper capability, T0450) still refuses it.
 */
export function normalizeAgentAlias(agent: string, isKnownAgent: (agentId: string) => boolean = isKnownRegistryAgent): string {
  if (isKnownAgent(agent)) return agent
  const lower = agent.trim().toLowerCase()
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(lower)) return agent
  if (isKnownAgent(lower)) return lower
  if (isKnownAgent(`${lower}-cli`)) return `${lower}-cli`
  return agent
}

/** T0527: the `customEnv.CT_MODE` the helper injects for `--mode yolo`. */
function isYoloDispatch(customEnv?: Record<string, string>): boolean {
  return customEnv?.CT_MODE === 'yolo'
}

/** BUG-132: the report part of a cwd check, only when it warns. */
function cwdReport(check: DispatchCwdCheck | undefined): DispatchCwdReport | undefined {
  if (!check || (check.status !== 'outside' && check.status !== 'other-workspace') || !check.cwd || !check.folderPath) return undefined
  return {
    status: check.status,
    cwd: check.cwd,
    folderPath: check.folderPath,
    ...(check.cwdWorkspace ? { cwdWorkspace: { id: check.cwdWorkspace.id, ...(check.cwdWorkspace.name ? { name: check.cwdWorkspace.name } : {}) } } : {}),
  }
}

export function registerTerminalCommandHandlers(deps: TerminalCommandHandlerDeps): void {
  const delay = deps.setTimeout ?? setTimeout

  /**
   * T0523 / BUG-129: the workspace of a terminal a helper creates (no invoking window). A
   * terminal a window creates keeps the `workspaceId` the window sent — the window adds the
   * tab itself and never sees `terminal:created-externally`.
   */
  const resolveWorkspace = async (ctx: HandlerContext, opts: { cwd?: string; workspaceId?: string; customEnv?: Record<string, string> }): Promise<DispatchWorkspaceResolution> => {
    const request: DispatchWorkspaceRequest = {
      towerTerminalId: opts.customEnv?.BAT_TOWER_TERMINAL_ID,
      requestedWorkspaceId: opts.workspaceId,
      ...(typeof opts.cwd === 'string' ? { cwd: opts.cwd } : {}),
    }
    if (ctx.windowId || !deps.resolveDispatchWorkspace) return passThroughDispatchWorkspace(request)
    try {
      const resolution = await deps.resolveDispatchWorkspace(request)
      if (resolution.mismatch) {
        deps.logger.warn(`[T0523] dispatch workspace mismatch: tower=${resolution.towerTerminalId} belongs to workspace=${describeWorkspace(resolution)}, --workspace=${resolution.requestedWorkspaceId} → using the tower's workspace`)
      }
      return resolution
    } catch (error) {
      deps.logger.warn('[T0523] dispatch workspace resolution failed, using --workspace as given:', error)
      return passThroughDispatchWorkspace(request)
    }
  }

  /**
   * BUG-132: act on the cwd check main attached to the landing (helper dispatches only).
   * cwd under another workspace → refused in yolo (the Tower's `BAT_*` may come from another
   * tab and the Worker would report to the wrong Tower), warned otherwise; cwd under no
   * workspace → warned (cross-project dispatch). Returns the refusal, or null to go on.
   */
  const applyCwdCheck = (channel: string, opts: { id: string; customEnv?: Record<string, string> }, landing: DispatchWorkspaceResolution): DispatchRefusal | null => {
    const check = landing.cwdCheck
    if (!check) return null
    const yolo = isYoloDispatch(opts.customEnv)
    const refuse = check.status === 'other-workspace' && yolo
    const action = refuse ? 'refuse' : check.status === 'outside' || check.status === 'other-workspace' ? 'warn' : 'proceed'
    deps.mirrorToBatScripts('dispatch-cwd-check', {
      channel,
      terminalId: opts.id,
      status: check.status,
      reason: check.reason,
      cwd: check.cwd,
      workspaceId: landing.workspaceId,
      workspaceName: landing.workspaceName,
      workspaceSource: landing.source,
      folderPath: check.folderPath,
      cwdWorkspaceId: check.cwdWorkspace?.id,
      cwdWorkspaceName: check.cwdWorkspace?.name,
      mode: opts.customEnv?.CT_MODE,
      action,
    })
    if (action === 'proceed') return null
    const cwdOwner = check.cwdWorkspace ? describeNamed(check.cwdWorkspace) : 'none'
    deps.logger.warn(`[BUG-132] dispatch cwd outside the landing workspace: cwd=${check.cwd} landing=${describeWorkspace(landing)} folderPath=${check.folderPath} workspaceSource=${landing.source} cwdWorkspace=${cwdOwner} mode=${opts.customEnv?.CT_MODE ?? 'n/a'} → ${refuse ? 'refused (yolo)' : 'created with a warning'}`)
    if (!refuse || !check.cwdWorkspace || !landing.workspaceId) return null
    deps.mirrorToBatScripts('ipc-result', { channel, terminalId: opts.id, result: false, reason: DISPATCH_CWD_OTHER_WORKSPACE })
    const landingWorkspace = { id: landing.workspaceId, ...(landing.workspaceName ? { name: landing.workspaceName } : {}) }
    const cwdWorkspace = { id: check.cwdWorkspace.id, ...(check.cwdWorkspace.name ? { name: check.cwdWorkspace.name } : {}) }
    const via = landing.source === 'tower-terminal'
      ? `the workspace of the --notify-id terminal ${landing.towerTerminalId}`
      : 'the --workspace workspace'
    return {
      ok: false,
      code: DISPATCH_CWD_OTHER_WORKSPACE,
      error: `cwd ${check.cwd} belongs to workspace ${quotedNamed(cwdWorkspace)}, but this dispatch would land in workspace ${quotedNamed(landingWorkspace)} (${via}). `
        + "The Tower shell's BAT_TERMINAL_ID / BAT_WORKSPACE_ID may come from another tab (an environment the agent CLI saved), "
        + 'so the Worker would report to that tab. Not created in yolo mode: check which workspace this Tower runs in, '
        + 'then dispatch again with the right --notify-id / --workspace (or without --mode yolo to create it with a warning).',
      cwd: check.cwd,
      landingWorkspace,
      cwdWorkspace,
    }
  }

  /** T0527: an explicit `--agent` the registry does not know (after shorthand normalization). */
  const unknownAgent = (opts: { id: string; agent?: string }): { agent?: string; refusal: DispatchRefusal | null } => {
    if (typeof opts.agent !== 'string' || opts.agent === '' || opts.agent === 'default') return { agent: opts.agent, refusal: null }
    const isKnown = deps.isKnownAgent ?? isKnownRegistryAgent
    const agent = normalizeAgentAlias(opts.agent, isKnown)
    if (agent !== opts.agent) deps.logger.log(`[agent-command] agent shorthand ${opts.agent} → ${agent}`)
    if (isKnown(agent)) return { agent, refusal: null }
    const knownAgents = (deps.listAgentIds?.() ?? agentRegistry.getAllDefinitions().map(def => def.id)).filter(id => id !== 'none')
    deps.logger.warn(`[agent-command] unknown agent=${opts.agent}`)
    deps.mirrorToBatScripts('ipc-result', {
      channel: 'terminal:create-agent-command',
      terminalId: opts.id,
      result: false,
      reason: AGENT_UNKNOWN,
      agentId: opts.agent,
    })
    return {
      agent,
      refusal: {
        ok: false,
        code: AGENT_UNKNOWN,
        agentId: opts.agent,
        knownAgents,
        error: `Unknown agent id '${opts.agent}'. Known agent ids: ${knownAgents.join(', ')} (or 'default' for the workspace / Settings default agent).`,
      },
    }
  }

  const createWithCommand = async (_ctx: HandlerContext, opts: TerminalCommandOptions, resolved?: DispatchWorkspaceResolution) => {
    const ptyManager = deps.getPtyManager()
    const reusedExisting = ptyManager ? ptyManager.isAlive(opts.id) : false
    const customEnv = deps.pickWhitelistedEnv(opts.customEnv)
    // T0539: the dispatching Tower (`--notify-id`, sent as the Worker's BAT_TOWER_TERMINAL_ID;
    // headless checks it is the caller's own terminal). Diagnostics only. Before T0539 this read
    // `customEnv.BAT_TERMINAL_ID`, which bat-terminal.mjs never sends — always empty.
    const sourceTerminalId = opts.customEnv?.BAT_TOWER_TERMINAL_ID
    const landing = resolved ?? await resolveWorkspace(_ctx, opts)
    const workspaceId = landing.workspaceId ?? opts.customEnv?.BAT_WORKSPACE_ID
    const invokerWindowId = _ctx.windowId ?? null

    deps.logger.log(`[remote][terminal] ipc-invoke channel=terminal:create-with-command id=${opts.id} reused=${reusedExisting} source=${sourceTerminalId ?? 'n/a'} windowId=${invokerWindowId ?? 'n/a'}`)
    deps.mirrorToBatScripts('ipc-invoke', {
      channel: 'terminal:create-with-command',
      terminalId: opts.id,
      reusedExisting,
      customEnv,
      sourceTerminalId,
      workspaceId,
      windowId: invokerWindowId,
      hasCommand: Boolean(opts.command),
    })

    // BUG-132: create-agent-command already checked the landing it passes in.
    const cwdRefusal = resolved ? null : applyCwdCheck('terminal:create-with-command', opts, landing)
    if (cwdRefusal) return cwdRefusal

    if (!ptyManager) {
      deps.logger.log('[remote][terminal] ipc-result channel=terminal:create-with-command result=false reason=no-pty-manager')
      deps.mirrorToBatScripts('ipc-result', {
        channel: 'terminal:create-with-command',
        terminalId: opts.id,
        result: false,
        reason: 'no-pty-manager',
      })
      return false
    }

    const shellRejection = deps.rejectShell?.(opts.shell) ?? null
    if (shellRejection) {
      deps.logger.warn(`[remote][terminal] ipc-result channel=terminal:create-with-command result=false reason=invalid-shell (${shellRejection})`)
      deps.mirrorToBatScripts('ipc-result', {
        channel: 'terminal:create-with-command',
        terminalId: opts.id,
        result: false,
        reason: 'invalid-shell',
      })
      return false
    }

    const settings = deps.readPersistedSettingsSync()
    const shellResolution = resolveTerminalShell(opts.shell, settings, deps)
    const fallbackReason = shellResolution.fallbackReason ? ` reason=${shellResolution.fallbackReason}` : ''
    deps.logger.log(`[remote][terminal] shell-resolution channel=terminal:create-with-command id=${opts.id} basename=${shellResolution.basename} persistedShell=${shellResolution.persistedShell} source=${shellResolution.source} fallback=${shellResolution.fallback ? 'yes' : 'no'}${fallbackReason}`)
    deps.mirrorToBatScripts('shell-resolution', {
      channel: 'terminal:create-with-command',
      terminalId: opts.id,
      basename: shellResolution.basename,
      persistedShell: shellResolution.persistedShell,
      source: shellResolution.source,
      fallback: shellResolution.fallback,
      fallbackReason: shellResolution.fallbackReason,
    })

    const created = ptyManager.create({
      id: opts.id,
      cwd: opts.cwd,
      type: 'terminal',
      shell: shellResolution.shell,
      customEnv: opts.customEnv,
      workspaceId: landing.workspaceId,
      ...(opts.workorder ? { workorder: opts.workorder } : {}),
    })
    if (created && opts.command) {
      delay(() => {
        ptyManager.write(opts.id, opts.command + '\r')
      }, 500)
    }
    if (created && !_ctx.windowId) {
      // T0537 (PLAN-041): the work order the PTY recorded, so the tab saves it with its tower.
      const workorder = opts.workorder ? normalizeWorkorderId(opts.workorder) : null
      const payload = {
        id: opts.id,
        cwd: opts.cwd,
        command: opts.command,
        workspaceId: landing.workspaceId,
        // T0523: the renderer lands the tab next to the Tower terminal when it holds it
        // (headless has no registry to resolve this on the server).
        ...(landing.towerTerminalId ? { towerTerminalId: landing.towerTerminalId } : {}),
        ...(workorder ? { workorder } : {}),
        // T0523: the registry has this workspace (a window of this BAT holds it), so a window
        // without it skips the event instead of adding the tab to its active workspace.
        ...(landing.known ? { workspaceResolved: true } : {}),
      }
      if (deps.emit) {
        deps.emit('terminal:created-externally', payload)
      } else {
        for (const win of deps.getAllWindows?.() ?? []) {
          try {
            win.webContents.send('terminal:created-externally', payload)
          } catch {
            // Window may be closing while remote terminal creation completes.
          }
        }
      }
    }

    const outcomeEvent = reusedExisting ? 'terminal-reused' : 'terminal-created'
    deps.logger.log(`[remote][terminal] ${outcomeEvent} id=${opts.id} result=${created} workspaceId=${workspaceId ?? 'n/a'} workspaceSource=${landing.source} requestedWorkspaceId=${landing.requestedWorkspaceId ?? 'n/a'}`)
    deps.mirrorToBatScripts(outcomeEvent, {
      channel: 'terminal:create-with-command',
      terminalId: opts.id,
      reusedExisting,
      result: created,
      customEnv,
      sourceTerminalId,
      workspaceId,
      workspaceName: landing.workspaceName,
      workspaceSource: landing.source,
      requestedWorkspaceId: landing.requestedWorkspaceId,
      workspaceMismatch: landing.mismatch,
      windowId: invokerWindowId,
    })
    if (created && opts.reportLanding) {
      const cwdCheck = cwdReport(landing.cwdCheck)
      const report: TerminalCreatedReport = {
        ok: true,
        terminalId: opts.id,
        workspace: {
          ...(landing.workspaceId ? { id: landing.workspaceId } : {}),
          ...(landing.workspaceName ? { name: landing.workspaceName } : {}),
          source: landing.source,
          ...(landing.requestedWorkspaceId ? { requestedId: landing.requestedWorkspaceId } : {}),
          mismatch: landing.mismatch,
          ...(cwdCheck ? { cwdCheck } : {}),
        },
      }
      return report
    }
    return created
  }
  deps.registerHandler('terminal:create-with-command', (ctx, opts) => createWithCommand(ctx, opts as TerminalCommandOptions))

  deps.registerHandler('terminal:create-agent-command', async (_ctx, rawOpts) => {
    const opts = rawOpts as TerminalAgentCommandOptions
    const hasPrompt = typeof opts?.prompt === 'string' && opts.prompt.length > 0
    const hasSkillPayload = typeof opts?.skill === 'string' && typeof opts?.workorder === 'string'
    if (!hasPrompt && !hasSkillPayload) {
      deps.logger.warn('[agent-command] missing prompt or skill/workorder for terminal:create-agent-command')
      return false
    }
    if (hasPrompt && hasSkillPayload) {
      deps.logger.warn('[agent-command] received both prompt and skill/workorder for terminal:create-agent-command')
      return false
    }

    // T0527: `--agent codex` → codex-cli; an id the registry does not know is refused with the
    // known ids (it used to fail later as a bare `false`).
    const agentCheck = unknownAgent(opts)
    if (agentCheck.refusal) return agentCheck.refusal

    const settings = deps.readPersistedSettingsSync()
    const shellResolution = resolveTerminalShell(opts.shell, settings, deps)
    const shellFamily = detectShellFamily(shellResolution.shell ?? shellResolution.basename)
    // T0523 / BUG-129: `--agent default` follows the workspace the terminal lands in.
    const landing = await resolveWorkspace(_ctx, opts)
    const cwdRefusal = applyCwdCheck('terminal:create-agent-command', opts, landing)
    if (cwdRefusal) return cwdRefusal

    const resolved = await deps.buildAgentPromptCommand({
      agent: agentCheck.agent,
      prompt: opts.prompt,
      skill: opts.skill,
      workorder: opts.workorder,
      workspaceId: landing.workspaceId,
      shellFamily,
    })
    if (!resolved) return false

    const unavailable = await deps.checkAgentAvailable?.(resolved.agentId) ?? null
    if (unavailable) {
      deps.logger.warn(`[agent-command] refused agent=${resolved.agentId} code=${unavailable.code} tool=${unavailable.tool ?? 'n/a'} status=${unavailable.status ?? 'n/a'}`)
      deps.mirrorToBatScripts('ipc-result', {
        channel: 'terminal:create-agent-command',
        terminalId: opts.id,
        result: false,
        reason: unavailable.code,
        agentId: resolved.agentId,
        tool: unavailable.tool,
        status: unavailable.status,
      })
      return unavailable
    }

    if (resolved.prefixNormalized) {
      deps.logger.log(`[agent-command] prefix-normalized agent=${resolved.agentId} prompt=${resolved.prompt}`)
      deps.mirrorToBatScripts('prefix-normalized', {
        channel: 'terminal:create-agent-command',
        terminalId: opts.id,
        agentId: resolved.agentId,
        prompt: resolved.prompt,
      })
    }

    deps.logger.log(`[agent-command] resolved agent=${opts.agent || 'default'} to ${resolved.agentId} source=${resolved.agentSource ?? 'n/a'} workspace=${describeWorkspace(landing)} workspaceSource=${landing.source} argsSource=${resolved.argsSource ?? 'n/a'}`)
    const commandOptions: TerminalCommandOptions = {
      id: opts.id,
      cwd: opts.cwd,
      command: resolved.command,
      shell: opts.shell,
      customEnv: opts.customEnv,
      workspaceId: landing.workspaceId,
      ...(opts.reportLanding ? { reportLanding: true } : {}),
      // T0535 (PLAN-041): the Worker's work order, for `--close-worker` (skill mode only)
      ...(hasSkillPayload ? { workorder: opts.workorder } : {}),
    }
    const result = deps.invokeHandler
      ? await deps.invokeHandler('terminal:create-with-command', [commandOptions], _ctx.windowId)
      : await createWithCommand(_ctx, commandOptions, landing)
    if (result && typeof result === 'object' && (result as { ok?: unknown }).ok === true) {
      const report = result as TerminalCreatedReport
      // Through invokeHandler the second resolution saw the already-resolved id: keep the first.
      report.workspace = {
        ...report.workspace,
        source: landing.source,
        ...(landing.requestedWorkspaceId ? { requestedId: landing.requestedWorkspaceId } : {}),
        mismatch: landing.mismatch,
      }
      report.agent = { requested: opts.agent || 'default', id: resolved.agentId, source: resolved.agentSource }
      return report
    }
    return result
  })
}

// ── Agent launch command (moved from electron/main.ts in T0431, logic unchanged) ──

export interface AgentPromptCommandOptions {
  agent?: string
  prompt?: string
  skill?: string
  workorder?: string
  workspaceId?: string
  shellFamily?: ShellFamily
}

/** Settings fields `buildAgentPromptCommand` reads. */
export interface AgentCommandSettings {
  defaultAgent?: string
  agentCustomArgs?: Record<string, string>
}

/**
 * Host-specific inputs of `buildAgentPromptCommand`.
 *   - Electron: `<userData>/settings.json`, the workspace's `defaultAgent` / `agentCustomArgs`
 *     from the window registry (T0529), and the Windows elevation probe (T0377).
 *   - headless: `<dataDir>/settings.json`, no workspace settings (the client's
 *     window registry is not on the server), no elevation.
 */
export interface AgentPromptCommandDeps {
  readSettings(): AgentCommandSettings | null
  /**
   * T0529: the landing workspace's agent fields (`defaultAgent`, `agentCustomArgs`), or null
   * (no workspace id / not found). Replaces T0523's `resolveWorkspaceDefaultAgent`.
   */
  resolveWorkspaceAgentSettings(workspaceId?: string): Promise<WorkspaceAgentLaunchFields | null>
  /** Resolves once `agentRegistry.setElevated` has been applied (codex-cli launch args). */
  ensureElevationApplied(): Promise<void>
  /** Default: `agentRegistry.buildLaunchCommand(agentId, undefined, extraArgs)`. */
  buildLaunchCommand?(agentId: string, extraArgs: string): string | null
  /** Default: `resolveClaudeBaseCommand` (claude runtime router). */
  resolveClaudeBaseCommand?(shellFamily?: ShellFamily): Promise<string>
  logger: {
    warn(...args: unknown[]): void
  }
}

export function toTerminalDrivenAgentId(agentId: string): string {
  if (agentId === 'claude-code-worktree') return 'claude-cli-worktree'
  if (agentId === 'claude-code' || agentId === 'claude-code-v2') return 'claude-cli'
  if (agentId === 'codex-agent' || agentId === 'codex-agent-worktree') return 'codex-cli'
  return agentId
}

function isCodexAgentId(agentId: string): boolean {
  return agentId === 'codex-cli' || agentId === 'codex-agent' || agentId === 'codex-agent-worktree'
}

// T0360/BUG-082: Work order ID grammar — optional 2-4 char uppercase prefix
// (cross-project / delegate work orders such as CP-T0113, CT-T001) + T + digits.
// ⚠️ Sibling copies that must stay in sync (no shared module path across the
// helper / main / renderer boundary):
//   - scripts/bat-terminal.mjs           WORKORDER_ID_PATTERN
//   - src/types/control-tower.ts         WORKORDER_ID_PREFIX
//   - src/utils/control-tower-launch.ts  buildControlTowerWorkOrderCommand()
const WORKORDER_ID_PATTERN = /^(?:[A-Z]{2,4}-)?T\d+$/

function buildControlTowerSkillPrompt(agentId: string, skill: string, workorder: string): string | null {
  if (!/^(ct-exec|ct-done)$/.test(skill) || !WORKORDER_ID_PATTERN.test(workorder)) return null
  const prefix = isCodexAgentId(agentId) ? '$' : '/'
  return `${prefix}${skill} ${workorder}`
}

function normalizeControlTowerPromptForAgent(agentId: string, prompt: string): { prompt: string; normalized: boolean } {
  if (!isCodexAgentId(agentId) || !prompt.startsWith('/ct-')) {
    return { prompt, normalized: false }
  }

  return {
    prompt: `$${prompt.slice(1)}`,
    normalized: true,
  }
}

/** Builds the `buildAgentPromptCommand` that `terminal:create-agent-command` uses on this host. */
export function createAgentPromptCommandBuilder(deps: AgentPromptCommandDeps): (opts: AgentPromptCommandOptions) => Promise<BuiltAgentCommand | null> {
  const buildLaunchCommand = deps.buildLaunchCommand
    ?? ((agentId: string, extraArgs: string) => agentRegistry.buildLaunchCommand(agentId, undefined, extraArgs))
  const resolveClaudeBase = deps.resolveClaudeBaseCommand
    ?? (async (shellFamily?: ShellFamily) => {
      const { resolveClaudeBaseCommand } = await import('./resolve-claude-base-command')
      return resolveClaudeBaseCommand(shellFamily)
    })

  return async (opts) => {
    const settings = deps.readSettings()
    // T0529 / D142: the landing workspace supplies both the default agent (D140 order:
    // workspace → Settings → claude-code) and the custom args — for `--agent <id>` as well.
    const workspace = await deps.resolveWorkspaceAgentSettings(opts.workspaceId)
    const explicitAgent = opts.agent && opts.agent !== 'default' ? opts.agent : null
    const defaultAgent = resolveEffectiveDefaultAgent(workspace, settings)
    const requestedAgent = explicitAgent ?? defaultAgent.agent
    const agentSource: BuiltAgentCommand['agentSource'] = explicitAgent ? 'explicit' : defaultAgent.source
    const agentId = toTerminalDrivenAgentId(requestedAgent)
    const effectiveArgs = resolveEffectiveAgentArgs(workspace, settings, [agentId, requestedAgent])
    const extraArgs = effectiveArgs.args

    await deps.ensureElevationApplied()
    let baseCommand = buildLaunchCommand(agentId, extraArgs)

    // Claude CLI launch is normally routed through the integrated runtime helper
    // in renderer-created terminals (WorkspaceView.startClaudeCliPty → claude:get-cli-path).
    // BAT remote terminals and bat-terminal.mjs auto-session build the command here, so we
    // invoke the same runtime resolver to honour claudeRuntime.customPath / fallbackToEmbedded.
    // Without this, a system-mode install with `claude` not on the BAT-spawned shell's PATH
    // dies with "claude: command not found" (downstream 花見紅茶 BUG-005 / T0050-T0054).
    if (!baseCommand && (agentId === 'claude-cli' || agentId === 'claude-cli-worktree')) {
      baseCommand = await resolveClaudeBase(opts.shellFamily)
    }

    if (!baseCommand) {
      deps.logger.warn(`[agent-command] cannot build launch command for agent=${requestedAgent} resolved=${agentId}`)
      return null
    }

    const prompt = opts.skill && opts.workorder
      ? buildControlTowerSkillPrompt(agentId, opts.skill, opts.workorder)
      : opts.prompt
    if (!prompt) {
      deps.logger.warn(`[agent-command] invalid prompt payload for agent=${requestedAgent} resolved=${agentId} skill=${opts.skill ?? 'n/a'} workorder=${opts.workorder ?? 'n/a'}`)
      return null
    }

    const normalized = normalizeControlTowerPromptForAgent(agentId, prompt)
    const commandWithArgs = extraArgs.trim() ? `${baseCommand} ${extraArgs.trim()}` : baseCommand
    return {
      command: `${commandWithArgs} ${quoteArgForShell(normalized.prompt, opts.shellFamily ?? 'posix')}`,
      agentId,
      prompt: normalized.prompt,
      prefixNormalized: normalized.normalized,
      agentSource,
      argsSource: effectiveArgs.source,
    }
  }
}
