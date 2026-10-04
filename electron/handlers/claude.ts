/**
 * PLAN-036 P1-F (T0401): `claude:*`, registered by both Electron main and the
 * headless bat-server (see ./types.ts). Moved verbatim from `electron/main.ts`
 * `registerProxiedHandlers()`; only the host couplings became deps:
 *   - `app.getPath('home')`          → `deps.homeDir`
 *   - `broadcastRuntimeEvent(...)`   → `deps.emit(...)` (Electron passes
 *     `createElectronClaudeEmit`, the same windows + broadcastHub fan-out)
 *   - module-level managers / map    → `getClaudeManager` / `getCodexManager` / `sessionKinds`
 *   - `MESSAGE_ARCHIVE_DIR`          → `messageArchiveDir`
 *
 * Host differences:
 *   - Codex: the server bundle has no codex (T0386 §1 C). Headless omits
 *     `getCodexManager` ⇒ `claude:set-codex-*` are not registered (they stay in
 *     HEADLESS_UNSUPPORTED) and a codex preset on start / resume / list throws
 *     `CODEX_UNSUPPORTED_MESSAGE` instead of silently returning undefined.
 *   - Message archive: renderer overflow cache on the user's own machine —
 *     ALWAYS_LOCAL_CHANNELS. Headless omits `messageArchiveDir` ⇒ not registered.
 *   - `claude:auth-login` / `account-*` / `rewind-to-prompt` are stubs on both hosts.
 *
 * 🔴 No `electron` import here (headless-electron-free guard).
 */
import * as fs from 'fs/promises'
import * as fsSync from 'fs'
import path from 'path'
import type { PermissionMode } from '@anthropic-ai/claude-agent-sdk'
import type { EffortLevel } from '../../src/types'
import type { ClaudeAgentManager } from '../claude-agent-manager'
import type { CodexAgentManager } from '../codex-agent-manager'
import { logger } from '../logger'
import type { HandlerRegistrar, HostDeps } from './types'

/** Thrown when a codex preset reaches a host without codex (headless bat-server). */
export const CODEX_UNSUPPORTED_MESSAGE = 'Codex agent is not available on this host (remote bat-server has no codex)'

/** Which manager owns a session: decided at start / resume, read by every per-session channel. */
export type ClaudeSessionKinds = Map<string, 'claude' | 'codex'>

export interface ClaudeHandlerDeps extends Pick<HostDeps, 'emit' | 'homeDir'> {
  /** Null while the host has not built its manager yet (Electron: before the first window). */
  getClaudeManager(): ClaudeAgentManager | null
  /** Absent ⇒ the host has no codex (headless): codex channels are not registered. */
  getCodexManager?: () => CodexAgentManager | null
  /** Electron passes its own map so `cleanupAllProcesses()` can clear it. Default: a new map. */
  sessionKinds?: ClaudeSessionKinds
  /** `<userData>/message-archives`. Absent ⇒ archive channels are not registered (always-local). */
  messageArchiveDir?: string
}

export function registerClaudeHandlers(register: HandlerRegistrar, deps: ClaudeHandlerDeps): void {
  const sessionKinds: ClaudeSessionKinds = deps.sessionKinds ?? new Map()
  const codex = (): CodexAgentManager | null => {
    if (!deps.getCodexManager) throw new Error(CODEX_UNSUPPORTED_MESSAGE)
    return deps.getCodexManager()
  }

  // Get Claude CLI path for claude-cli preset.
  //
  // BUG-054 (T0235): previously hard-coded the embedded binary; now defers to
  // resolveClaudeRuntime() so system-mode / customPath / fallback all honour
  // the same routing as SDK spawns in claude-agent-manager.
  //
  // No sessionId is available in this handler (the terminal preset is created
  // before any session), so degraded / version-warning events use the fixed
  // dedup key '__terminal__'. The toast UI already accepts an optional sessionId.
  //
  // On SystemClaudeUnavailableError (fallbackToEmbedded=false + system unusable)
  // we log and return '' — the renderer treats empty string as "no CLI" and the
  // degraded event still fires so the UI can surface a toast with detail.
  register('claude:get-cli-path', async () => {
    const TERMINAL_EVENT_KEY = '__terminal__'
    try {
      const { resolveClaudeRuntime, getRuntimeSettingsSnapshot, shouldEmitRuntimeEvent, SystemClaudeUnavailableError } = await import('../claude-runtime-router')
      const settings = getRuntimeSettingsSnapshot()
      try {
        const resolved = await resolveClaudeRuntime(settings)
        if (resolved.source === 'system-fallback-to-embedded' && resolved.degraded) {
          if (shouldEmitRuntimeEvent(TERMINAL_EVENT_KEY, 'degraded')) {
            const payload = {
              sessionId: TERMINAL_EVENT_KEY,
              reason: resolved.degraded.reason,
              detail: resolved.degraded.detail,
            }
            logger.log(`[runtime-router] terminal degraded: ${payload.reason}${payload.detail ? ` (${payload.detail})` : ''}`)
            deps.emit('claude:runtime-degraded', payload)
          }
        } else if (resolved.source === 'system' && resolved.healthStatus === 'version-warning') {
          if (shouldEmitRuntimeEvent(TERMINAL_EVENT_KEY, 'warning')) {
            const version = resolved.systemVersion || 'unknown'
            const payload = {
              sessionId: TERMINAL_EVENT_KEY,
              version,
              message: `System claude ${version} is older than recommended (requires >= 2.1.280 for Claude 5 models such as Opus 5.5). SDK will still load, but newer models may be rejected by the server.`,
            }
            logger.log(`[runtime-router] terminal version warning: ${version}`)
            deps.emit('claude:runtime-warning', payload)
          }
        }
        return resolved.path
      } catch (err) {
        if (err instanceof SystemClaudeUnavailableError) {
          // fallbackToEmbedded=false + system claude unusable. Surface a degraded
          // toast so the user sees why the terminal has no CLI, then return ''.
          if (shouldEmitRuntimeEvent(TERMINAL_EVENT_KEY, 'degraded')) {
            const payload = {
              sessionId: TERMINAL_EVENT_KEY,
              reason: err.reason,
              detail: err.detail,
            }
            logger.log(`[runtime-router] terminal system-unavailable (fallback disabled): ${payload.reason}${payload.detail ? ` (${payload.detail})` : ''}`)
            deps.emit('claude:runtime-degraded', payload)
          }
          return ''
        }
        throw err
      }
    } catch (err) {
      logger.error('[claude:get-cli-path] runtime resolution failed', err)
      return ''
    }
  })

  // PLAN-027 #1 (T0230): runtime detection — embedded health probe + system claude scan.
  // Routing decision (mode embedded/system) is owned by T0231 / #2; this handler
  // only reports what's available so the UI (T0232 / #3) can make the choice.
  register('claude:detectRuntime', async (_ctx, customPath?: string) => {
    const { detectSystemClaude, probeClaudeHealth } = await import('../claude-resolver')

    // PLAN-036 T0389: single embedded resolver shared with the router / agent-manager.
    const { resolveEmbeddedClaudePath } = await import('../claude-runtime-router')
    const embeddedPath = resolveEmbeddedClaudePath()

    const embeddedProbe = embeddedPath ? await probeClaudeHealth(embeddedPath) : null
    const systemInfo = await detectSystemClaude(customPath)

    return {
      embedded: {
        path: embeddedPath,
        version: embeddedProbe?.version ?? 'unknown',
        versionRaw: embeddedProbe?.versionRaw ?? '',
        healthStatus: embeddedProbe ? 'healthy' as const : 'spawn-failed' as const,
      },
      system: systemInfo,
    }
  })

  const getSessionManager = (sessionId: string) =>
    sessionKinds.get(sessionId) === 'codex' ? codex() : deps.getClaudeManager()

  // Integrated Agent SDKs. Codex intentionally shares the existing claude:* renderer
  // event surface so the chat panels can reuse the mature Claude UI plumbing.
  register('claude:start-session', async (_ctx, sessionId: string, options: { cwd: string; prompt?: string; permissionMode?: string; model?: string; effort?: string; apiVersion?: 'v1' | 'v2'; useWorktree?: boolean; worktreePath?: string; worktreeBranch?: string; agentPreset?: string; codexSandboxMode?: 'read-only' | 'workspace-write' | 'danger-full-access'; codexApprovalPolicy?: 'untrusted' | 'on-request' | 'never' }) => {
    if (options.agentPreset === 'codex-agent' || options.agentPreset === 'codex-agent-worktree') {
      const codexManager = codex() // throws before recording the session on a host without codex
      sessionKinds.set(sessionId, 'codex')
      return codexManager?.startSession(sessionId, options)
    }
    sessionKinds.set(sessionId, 'claude')
    return deps.getClaudeManager()?.startSession(sessionId, options)
  })
  register('claude:send-message', (_ctx, sessionId: string, prompt: string, images?: string[]) => getSessionManager(sessionId)?.sendMessage(sessionId, prompt, images))
  register('claude:stop-session', (_ctx, sessionId: string) => getSessionManager(sessionId)?.stopSession(sessionId))
  register('claude:abort-session', (_ctx, sessionId: string) => getSessionManager(sessionId)?.abortSession(sessionId))
  register('claude:set-permission-mode', (_ctx, sessionId: string, mode: string) => deps.getClaudeManager()?.setPermissionMode(sessionId, mode as PermissionMode))
  // Codex-only controls: not registered on a host without codex (stay HEADLESS_UNSUPPORTED).
  if (deps.getCodexManager) {
    register('claude:set-codex-sandbox-mode', (_ctx, sessionId: string, mode: 'read-only' | 'workspace-write' | 'danger-full-access') => codex()?.setSandboxMode(sessionId, mode))
    register('claude:set-codex-approval-policy', (_ctx, sessionId: string, policy: 'untrusted' | 'on-request' | 'never') => codex()?.setApprovalPolicy(sessionId, policy))
  }
  register('claude:set-model', (_ctx, sessionId: string, model: string) => getSessionManager(sessionId)?.setModel(sessionId, model))
  register('claude:set-effort', (_ctx, sessionId: string, effort: string) => getSessionManager(sessionId)?.setEffort(sessionId, effort as EffortLevel))
  register('claude:reset-session', (_ctx, sessionId: string) => getSessionManager(sessionId)?.resetSession(sessionId))
  register('claude:get-supported-models', (_ctx, sessionId: string) => getSessionManager(sessionId)?.getSupportedModels(sessionId))
  register('claude:get-account-info', (_ctx, sessionId: string) => getSessionManager(sessionId)?.getAccountInfo(sessionId))
  register('claude:get-supported-commands', (_ctx, sessionId: string) => getSessionManager(sessionId)?.getSupportedCommands(sessionId))
  register('claude:get-supported-agents', (_ctx, sessionId: string) => getSessionManager(sessionId)?.getSupportedAgents(sessionId))
  register('claude:get-worktree-status', (_ctx, sessionId: string) => getSessionManager(sessionId)?.getWorktreeStatus(sessionId))
  register('claude:cleanup-worktree', (_ctx, sessionId: string, deleteBranch: boolean) => getSessionManager(sessionId)?.cleanupWorktree(sessionId, deleteBranch))

  // claude auth status — query the auth state of the currently-selected runtime.
  //
  // BUG-054 (T0235): previously ran `execFile('claude', ...)` which resolved via
  // child-process PATH, so a system-mode user running with embedded fallback
  // could still see a stale "logged in" from whichever `claude` won the PATH
  // race. Now uses resolveClaudeRuntime() so the status always reflects the
  // binary BAT will actually spawn. Runtime resolution failure is treated as
  // "not logged in" (returning null) to preserve the existing API contract.
  register('claude:auth-status', async () => {
    const { execFile } = await import('child_process')
    let resolvedPath: string
    try {
      const { resolveClaudeRuntime, getRuntimeSettingsSnapshot } = await import('../claude-runtime-router')
      const resolved = await resolveClaudeRuntime(getRuntimeSettingsSnapshot())
      if (!resolved.path) return null
      resolvedPath = resolved.path
    } catch (err) {
      logger.error('[auth-status] runtime resolution failed', err)
      return null
    }
    return new Promise<{ loggedIn: boolean; email?: string; subscriptionType?: string; authMethod?: string } | null>((resolve) => {
      execFile(resolvedPath, ['auth', 'status'], { timeout: 10000, windowsHide: true }, (err, stdout) => {
        if (err) {
          logger.error('[auth-status]', err)
          resolve(null)
        } else {
          try {
            resolve(JSON.parse(stdout))
          } catch {
            resolve(null)
          }
        }
      })
    })
  })

  // claude auth logout — BUG-054 (T0235): same runtime-router change as auth-status
  // so logout hits the binary the user actually logged in with.
  register('claude:auth-logout', async () => {
    const { execFile } = await import('child_process')
    let resolvedPath: string
    try {
      const { resolveClaudeRuntime, getRuntimeSettingsSnapshot } = await import('../claude-runtime-router')
      const resolved = await resolveClaudeRuntime(getRuntimeSettingsSnapshot())
      if (!resolved.path) {
        return { success: false, error: 'Claude runtime not available' }
      }
      resolvedPath = resolved.path
    } catch (err) {
      logger.error('[auth-logout] runtime resolution failed', err)
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
    return new Promise<{ success: boolean; error?: string }>((resolve) => {
      execFile(resolvedPath, ['auth', 'logout'], { timeout: 10000, windowsHide: true }, (err) => {
        if (err) {
          logger.error('[auth-logout]', err)
          resolve({ success: false, error: err.message })
        } else {
          resolve({ success: true })
        }
      })
    })
  })
  register('claude:auth-login', async () => ({ success: false, error: 'Auth login is not available in this build' }))
  register('claude:account-list', async () => ({ accounts: [], activeAccountId: null, switchWarningShown: true }))
  register('claude:account-import-current', async () => null)
  register('claude:account-switch', async () => false)

  // Scan .claude/commands/ directories for skill files
  register('claude:scan-skills', async (_ctx, cwd: string) => {
    const fs = await import('fs')
    const pathMod = await import('path')
    const results: { name: string; description: string; scope: 'project' | 'global' }[] = []
    const homePath = deps.homeDir
    const seen = new Set<string>()

    // 1. Scan .claude/commands/ (flat .md files)
    const commandDirs: { dir: string; scope: 'project' | 'global' }[] = [
      { dir: pathMod.join(cwd, '.claude', 'commands'), scope: 'project' },
      { dir: pathMod.join(homePath, '.claude', 'commands'), scope: 'global' },
    ]
    for (const { dir, scope } of commandDirs) {
      try {
        if (!fs.existsSync(dir)) continue
        const files = fs.readdirSync(dir).filter((f: string) => f.endsWith('.md'))
        for (const file of files) {
          const name = file.replace(/\.md$/, '')
          if (seen.has(name)) continue
          seen.add(name)
          try {
            const content = fs.readFileSync(pathMod.join(dir, file), 'utf-8')
            const firstLine = content.split('\n').find((l: string) => l.trim()) || ''
            const description = firstLine.replace(/^#\s*/, '').trim()
            results.push({ name, description, scope })
          } catch {
            results.push({ name, description: '', scope })
          }
        }
      } catch { /* directory doesn't exist or not readable */ }
    }

    // 2. Scan skill directories (subdirs with SKILL.md)
    const skillDirs: { dir: string; scope: 'project' | 'global' }[] = [
      { dir: pathMod.join(cwd, '.claude', 'skills'), scope: 'project' },
      { dir: pathMod.join(cwd, '.copilot', 'skills'), scope: 'project' },
      { dir: pathMod.join(cwd, '.agents', 'skills'), scope: 'project' },
      { dir: pathMod.join(homePath, '.claude', 'skills'), scope: 'global' },
      { dir: pathMod.join(homePath, '.copilot', 'skills'), scope: 'global' },
      { dir: pathMod.join(homePath, '.agents', 'skills'), scope: 'global' },
    ]
    for (const { dir, scope } of skillDirs) {
      try {
        if (!fs.existsSync(dir)) continue
        const entries = fs.readdirSync(dir, { withFileTypes: true })
        for (const entry of entries) {
          if (!entry.isDirectory()) continue
          const name = entry.name
          if (seen.has(name)) continue
          const skillFile = pathMod.join(dir, name, 'SKILL.md')
          if (!fs.existsSync(skillFile)) continue
          seen.add(name)
          try {
            const content = fs.readFileSync(skillFile, 'utf-8')
            // Extract description from YAML frontmatter or first heading
            let description = ''
            const lines = content.split('\n')
            const hasFrontmatter = lines[0]?.trim() === '---'
            if (hasFrontmatter) {
              // Parse YAML frontmatter for description field
              for (let i = 1; i < lines.length; i++) {
                if (lines[i].trim() === '---') break
                const match = lines[i].match(/^description:\s*"?(.+?)"?\s*$/)
                if (match) { description = match[1]; break }
              }
            }
            if (!description) {
              // Fallback: first non-empty, non-frontmatter line
              let inFrontmatter = hasFrontmatter
              for (const line of lines) {
                const trimmed = line.trim()
                if (inFrontmatter) { if (trimmed === '---' && line !== lines[0]) inFrontmatter = false; continue }
                if (!trimmed) continue
                description = trimmed.replace(/^#\s*/, '').trim()
                break
              }
            }
            results.push({ name, description, scope })
          } catch {
            results.push({ name, description: '', scope })
          }
        }
      } catch { /* directory doesn't exist or not readable */ }
    }

    return results
  })

  // Scan star commands (ct-*, gsd-*) from skill directories — used for * command autocomplete
  register('claude:scan-star-commands', async (_ctx) => {
    const fs = await import('fs')
    const pathMod = await import('path')
    const homePath = deps.homeDir
    const results: { name: string; description: string; prefix: 'ct' | 'gsd' }[] = []
    const seen = new Set<string>()

    const skillDirs = [
      pathMod.join(homePath, '.claude', 'skills'),
      pathMod.join(homePath, '.copilot', 'skills'),
      pathMod.join(homePath, '.agents', 'skills'),
    ]

    for (const dir of skillDirs) {
      try {
        if (!fs.existsSync(dir)) continue
        const entries = fs.readdirSync(dir, { withFileTypes: true })
        for (const entry of entries) {
          if (!entry.isDirectory()) continue
          const dirName = entry.name
          // Only ct-* and gsd-* prefixed skills
          const ctMatch = dirName.match(/^(ct|gsd)-(.+)$/)
          if (!ctMatch) continue
          const prefix = ctMatch[1] as 'ct' | 'gsd'
          const shortName = ctMatch[2] // e.g. "exec", "do", "help"
          if (seen.has(dirName)) continue
          const skillFile = pathMod.join(dir, dirName, 'SKILL.md')
          if (!fs.existsSync(skillFile)) continue
          seen.add(dirName)
          try {
            const content = fs.readFileSync(skillFile, 'utf-8')
            let description = ''
            const lines = content.split('\n')
            const hasFrontmatter = lines[0]?.trim() === '---'
            if (hasFrontmatter) {
              for (let i = 1; i < lines.length; i++) {
                if (lines[i].trim() === '---') break
                const match = lines[i].match(/^description:\s*"?(.+?)"?\s*$/)
                if (match) { description = match[1]; break }
              }
            }
            if (!description) {
              let inFrontmatter = hasFrontmatter
              for (const line of lines) {
                const trimmed = line.trim()
                if (inFrontmatter) { if (trimmed === '---' && line !== lines[0]) inFrontmatter = false; continue }
                if (!trimmed) continue
                description = trimmed.replace(/^#\s*/, '').trim()
                break
              }
            }
            results.push({ name: shortName, description, prefix })
          } catch {
            results.push({ name: shortName, description: '', prefix })
          }
        }
      } catch { /* directory doesn't exist or not readable */ }
    }

    return results
  })

  // Read statusline extras: account label + plan, memsync status, cached rate limits
  register('claude:get-statusline-extras', async (_ctx) => {
    const homePath = deps.homeDir
    const claudeDir = process.env.CLAUDE_CONFIG_DIR || path.join(homePath, '.claude')
    const result: {
      accountLabel?: string
      planLabel?: string
      memsync?: { status: string; queueSize: number; age: string }
      rateLimits?: { five_hour?: { used_percentage: number; resets_at: number }; seven_day?: { used_percentage: number; resets_at: number } }
    } = {}

    // Account label + plan
    try {
      const labelFile = path.join(claudeDir, 'account-label.txt')
      if (fsSync.existsSync(labelFile)) {
        result.accountLabel = fsSync.readFileSync(labelFile, 'utf-8').trim()
      }
    } catch { /* silent */ }
    try {
      const cacheFile = path.join(claudeDir, 'cache', 'account-label.json')
      if (fsSync.existsSync(cacheFile)) {
        const cached = JSON.parse(fsSync.readFileSync(cacheFile, 'utf-8'))
        if (!result.accountLabel) result.accountLabel = cached.label || cached.email || ''
        result.planLabel = cached.planLabel || ''
      }
    } catch { /* silent */ }

    // Memsync status
    try {
      const statusFile = path.join(claudeDir, 'cache', 'memsync', 'status.json')
      if (fsSync.existsSync(statusFile)) {
        const ms = JSON.parse(fsSync.readFileSync(statusFile, 'utf-8'))
        const queueSize = Number(ms.queue_size || 0)
        const resultStr = String(ms.result || '')
        const updatedAt = ms.updated_at ? new Date(ms.updated_at).getTime() : 0
        const ageSec = updatedAt > 0 ? Math.max(0, Math.floor((Date.now() - updatedAt) / 1000)) : 0
        const ageLabel = ageSec > 0 ? (ageSec < 60 ? `${ageSec}s` : `${Math.floor(ageSec / 60)}m`) : ''
        result.memsync = { status: resultStr, queueSize, age: ageLabel }
      }
    } catch { /* silent */ }

    // Cached rate limits (written by gsd-statusline hook)
    try {
      const rlFile = path.join(claudeDir, 'cache', 'rate-limits.json')
      if (fsSync.existsSync(rlFile)) {
        const rl = JSON.parse(fsSync.readFileSync(rlFile, 'utf-8'))
        result.rateLimits = rl
      }
    } catch { /* silent */ }

    return result
  })
  register('claude:get-session-meta', (_ctx, sessionId: string) => getSessionManager(sessionId)?.getSessionMeta(sessionId))
  register('claude:get-context-usage', (_ctx, sessionId: string) => getSessionManager(sessionId)?.getContextUsage(sessionId))
  register('claude:resolve-permission', (_ctx, sessionId: string, toolUseId: string, result: { behavior: string; updatedInput?: Record<string, unknown>; updatedPermissions?: unknown[]; message?: string; dontAskAgain?: boolean }) => getSessionManager(sessionId)?.resolvePermission(sessionId, toolUseId, result))
  register('claude:resolve-ask-user', (_ctx, sessionId: string, toolUseId: string, answers: Record<string, string>) => getSessionManager(sessionId)?.resolveAskUser(sessionId, toolUseId, answers))
  register('claude:list-sessions', (_ctx, cwd: string, agentPreset?: string) =>
    (agentPreset === 'codex-agent' || agentPreset === 'codex-agent-worktree') ? codex()?.listSessions(cwd) : deps.getClaudeManager()?.listSessions(cwd))
  register('claude:resume-session', (_ctx, sessionId: string, sdkSessionId: string, cwd: string, model?: string, apiVersion?: 'v1' | 'v2', useWorktree?: boolean, worktreePath?: string, worktreeBranch?: string, agentPreset?: string, codexSandboxMode?: 'read-only' | 'workspace-write' | 'danger-full-access', codexApprovalPolicy?: 'untrusted' | 'on-request' | 'never') => {
    if (agentPreset === 'codex-agent' || agentPreset === 'codex-agent-worktree') {
      const codexManager = codex() // throws before recording the session on a host without codex
      sessionKinds.set(sessionId, 'codex')
      return codexManager?.resumeSession(sessionId, sdkSessionId, cwd, model, codexSandboxMode, codexApprovalPolicy, useWorktree, worktreePath, worktreeBranch)
    }
    sessionKinds.set(sessionId, 'claude')
    return deps.getClaudeManager()?.resumeSession(sessionId, sdkSessionId, cwd, model, apiVersion, useWorktree, worktreePath, worktreeBranch)
  })
  register('claude:fork-session', (_ctx, sessionId: string) => getSessionManager(sessionId)?.forkSession(sessionId))
  register('claude:rewind-to-prompt', () => ({ error: 'Rewind is not available in this build' }))
  register('claude:stop-task', (_ctx, sessionId: string, taskId: string) => getSessionManager(sessionId)?.stopTask(sessionId, taskId))
  register('claude:rest-session', (_ctx, sessionId: string) => getSessionManager(sessionId)?.restSession(sessionId))
  register('claude:wake-session', (_ctx, sessionId: string) => getSessionManager(sessionId)?.wakeSession(sessionId))
  register('claude:is-resting', (_ctx, sessionId: string) => getSessionManager(sessionId)?.isResting(sessionId) ?? false)
  register('claude:fetch-subagent-messages', (_ctx, sessionId: string, agentToolUseId: string) => getSessionManager(sessionId)?.fetchSubagentMessages(sessionId, agentToolUseId) ?? [])

  // Message archiving — renderer overflow cache on the user's machine: ALWAYS_LOCAL_CHANNELS, Electron only.
  const messageArchiveDir = deps.messageArchiveDir
  if (messageArchiveDir) {
    register('claude:archive-messages', async (_ctx, sessionId: string, messages: unknown[]) => {
      await fs.mkdir(messageArchiveDir, { recursive: true })
      const filePath = path.join(messageArchiveDir, `${sessionId}.jsonl`)
      const lines = messages.map(m => JSON.stringify(m)).join('\n') + '\n'
      await fs.appendFile(filePath, lines, 'utf-8')
      return true
    })
    register('claude:load-archived', async (_ctx, sessionId: string, offset: number, limit: number) => {
      const filePath = path.join(messageArchiveDir, `${sessionId}.jsonl`)
      try {
        const content = await fs.readFile(filePath, 'utf-8')
        const lines = content.trim().split('\n').filter(Boolean)
        const total = lines.length
        const end = total - offset
        const start = Math.max(0, end - limit)
        if (end <= 0) return { messages: [], total, hasMore: false }
        const slice = lines.slice(start, end)
        return { messages: slice.map(l => JSON.parse(l)), total, hasMore: start > 0 }
      } catch { return { messages: [], total: 0, hasMore: false } }
    })
    register('claude:clear-archive', async (_ctx, sessionId: string) => {
      const filePath = path.join(messageArchiveDir, `${sessionId}.jsonl`)
      try { await fs.unlink(filePath) } catch { /* ignore */ }
      return true
    })
  }
}
