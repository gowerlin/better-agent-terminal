import { resolvePersistedShellPathWithDiagnostics, type PersistedShellSettings } from './shell-path-resolver'
import { detectShellFamily, quoteArgForShell, type ShellFamily } from '../src/utils/shell-quote'
import { agentRegistry } from './agent-runtime/agent-registry'

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
}

export interface BuiltAgentCommand {
  command: string
  agentId: string
  prompt: string
  prefixNormalized: boolean
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

export function registerTerminalCommandHandlers(deps: TerminalCommandHandlerDeps): void {
  const delay = deps.setTimeout ?? setTimeout

  const createWithCommand = (_ctx: HandlerContext, opts: TerminalCommandOptions) => {
    const ptyManager = deps.getPtyManager()
    const reusedExisting = ptyManager ? ptyManager.isAlive(opts.id) : false
    const customEnv = deps.pickWhitelistedEnv(opts.customEnv)
    const sourceTerminalId = opts.customEnv?.BAT_TERMINAL_ID
    const workspaceId = opts.workspaceId ?? opts.customEnv?.BAT_WORKSPACE_ID
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
      workspaceId: opts.workspaceId,
    })
    if (created && opts.command) {
      delay(() => {
        ptyManager.write(opts.id, opts.command + '\r')
      }, 500)
    }
    if (created && !_ctx.windowId) {
      const payload = {
        id: opts.id,
        cwd: opts.cwd,
        command: opts.command,
        workspaceId: opts.workspaceId,
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
    deps.logger.log(`[remote][terminal] ${outcomeEvent} id=${opts.id} result=${created} workspaceId=${workspaceId ?? 'n/a'}`)
    deps.mirrorToBatScripts(outcomeEvent, {
      channel: 'terminal:create-with-command',
      terminalId: opts.id,
      reusedExisting,
      result: created,
      customEnv,
      sourceTerminalId,
      workspaceId,
      windowId: invokerWindowId,
    })
    return created
  }
  deps.registerHandler('terminal:create-with-command', (ctx, opts) => createWithCommand(ctx, opts as TerminalCommandOptions))

  deps.registerHandler('terminal:create-agent-command', async (_ctx, opts: TerminalAgentCommandOptions) => {
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

    const settings = deps.readPersistedSettingsSync()
    const shellResolution = resolveTerminalShell(opts.shell, settings, deps)
    const shellFamily = detectShellFamily(shellResolution.shell ?? shellResolution.basename)

    const resolved = await deps.buildAgentPromptCommand({
      agent: opts.agent,
      prompt: opts.prompt,
      skill: opts.skill,
      workorder: opts.workorder,
      workspaceId: opts.workspaceId,
      shellFamily,
    })
    if (!resolved) return false

    if (resolved.prefixNormalized) {
      deps.logger.log(`[agent-command] prefix-normalized agent=${resolved.agentId} prompt=${resolved.prompt}`)
      deps.mirrorToBatScripts('prefix-normalized', {
        channel: 'terminal:create-agent-command',
        terminalId: opts.id,
        agentId: resolved.agentId,
        prompt: resolved.prompt,
      })
    }

    deps.logger.log(`[agent-command] resolved agent=${opts.agent || 'default'} to ${resolved.agentId}`)
    const commandOptions: TerminalCommandOptions = {
      id: opts.id,
      cwd: opts.cwd,
      command: resolved.command,
      shell: opts.shell,
      customEnv: opts.customEnv,
      workspaceId: opts.workspaceId,
    }
    if (deps.invokeHandler) {
      return deps.invokeHandler('terminal:create-with-command', [commandOptions], _ctx.windowId)
    }
    return createWithCommand(_ctx, commandOptions)
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
 *   - Electron: `<userData>/settings.json`, the workspace's `defaultAgent` from the
 *     window registry, and the Windows elevation probe (T0377).
 *   - headless: `<dataDir>/settings.json`, no workspace default agent (the client's
 *     window registry is not on the server), no elevation.
 */
export interface AgentPromptCommandDeps {
  readSettings(): AgentCommandSettings | null
  resolveWorkspaceDefaultAgent(workspaceId?: string): Promise<string | null>
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
    const workspaceAgent = opts.agent && opts.agent !== 'default'
      ? null
      : await deps.resolveWorkspaceDefaultAgent(opts.workspaceId)
    const requestedAgent = opts.agent && opts.agent !== 'default'
      ? opts.agent
      : (workspaceAgent || settings?.defaultAgent || 'claude-code')
    const agentId = toTerminalDrivenAgentId(requestedAgent)
    const extraArgs = settings?.agentCustomArgs?.[agentId] || settings?.agentCustomArgs?.[requestedAgent] || ''

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
    }
  }
}
