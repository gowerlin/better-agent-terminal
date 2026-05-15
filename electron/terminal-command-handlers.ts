import { resolvePersistedShellPathWithDiagnostics, type PersistedShellSettings } from './shell-path-resolver'
import { detectShellFamily, type ShellFamily } from '../src/utils/shell-quote'

interface HandlerContext {
  windowId: string | null
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
  invokeHandler(channel: string, args: unknown[], windowId?: string | null): Promise<unknown>
  getPtyManager(): TerminalPtyManager | null
  getAllWindows(): TerminalWindow[]
  readPersistedSettingsSync(): PersistedShellSettings | null
  buildAgentPromptCommand(opts: { agent?: string; prompt?: string; skill?: string; workorder?: string; workspaceId?: string; shellFamily?: ShellFamily }): Promise<BuiltAgentCommand | null>
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

  deps.registerHandler('terminal:create-with-command', (_ctx, opts: TerminalCommandOptions) => {
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
      for (const win of deps.getAllWindows()) {
        try {
          win.webContents.send('terminal:created-externally', {
            id: opts.id,
            cwd: opts.cwd,
            command: opts.command,
            workspaceId: opts.workspaceId,
          })
        } catch {
          // Window may be closing while remote terminal creation completes.
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
  })

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
    return deps.invokeHandler('terminal:create-with-command', [{
      id: opts.id,
      cwd: opts.cwd,
      command: resolved.command,
      shell: opts.shell,
      customEnv: opts.customEnv,
      workspaceId: opts.workspaceId,
    }], _ctx.windowId)
  })
}
