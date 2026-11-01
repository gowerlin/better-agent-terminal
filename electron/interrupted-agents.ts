/**
 * PLAN-055 B1 / T0766 (D211): the agent tabs a Terminal Server recovery interrupted.
 *
 * The recovery (`PtyManager.handleServerDeath`, T0112 / T0704) rebuilds every PTY as a plain shell
 * under the same id — the claude / codex that ran in it is gone, and `blockedTracker.clearAll` drops
 * its `agentStarted` / claude session id. Just before that `clearAll`, PtyManager collects what it
 * still knows of each tab (`collectInterruptedAgentSources`) and hands it to
 * `PtyManagerDeps.onAgentsInterrupted`; Electron main builds the snapshot here
 * (`buildInterruptedAgentSnapshot`), keeps it in `interruptedAgents` and tells its windows
 * (`terminal-server:agents-interrupted`). The renderer lists the tabs (InterruptedAgentsDialog, a ⏸
 * mark on the thumbnail) and resumes a claude tab on request:
 *   - a tab the user opened (`launchedBy: 'tab'`): the renderer's `startClaudeCliPty` with
 *     `--resume=<id>` (src/components/WorkspaceView.tsx)
 *   - a helper-dispatched Worker (`launchedBy: 'dispatch'`, the renderer has no `agentPreset`):
 *     `terminal:resume-interrupted-agent` → `resumeInterruptedDispatchAgent` (the dispatch's
 *     `createAgentPromptCommandBuilder` with `resume`, written into the rebuilt shell)
 *
 * Which tabs count (an approximation, T0765 ①): an `agentPreset` other than `none`, or a
 * `session-start` / OSC 7501 seen (`startedAt`), or a claude session id. A tab whose claude the user
 * had already left is listed too (BAT has no `SessionEnd` hook, D211 P-7). Plain shells are not.
 *
 * An entry leaves the list when the tab is resumed, dismissed (略過), closed / restarted (its PTY
 * ends, `onPtyExit`) or its claude reports a new `session-start`. Nothing resumes on its own (D211
 * P-1); the list lives until BAT quits (P-5: `claude-sessions.json` keeps a copy of the session ids
 * for the running process only, never restored on reopen); Towers are not notified (P-3).
 *
 * 🔴 No `electron` import. Session ids are logged by their first 8 characters only; no token here.
 * codex tabs are listed only — resuming them is B2 (T0767).
 */
import { claudeResumeArgs, type ClaudeResumeMode } from '../src/lib/claude-resume-args'
import { CLAUDE_SESSION_ID_PATTERN, sessionIdForLog, type BlockedDetection } from './terminal-blocked-state'

/** What PtyManager knows of one rebuilt PTY right before the recovery clears its tracker state. */
export interface InterruptedAgentSource {
  terminalId: string
  cwd: string
  /** The shell the rebuilt PTY runs (`PtyInstance.shell`; undefined = the default shell). */
  shell?: string
  workspaceId?: string
  agentPreset?: string
  workorder?: string
  /** `customEnv.BAT_TOWER_TERMINAL_ID`. */
  towerTerminalId?: string
  role?: 'tower'
  /** `getStartedAt`: the claude `session-start` / codex OSC 7501 (ms), or null. */
  startedAt: number | null
  /** The claude session id its last `session-start` sent, or null. */
  sessionId: string | null
  blockedDetection: BlockedDetection
}

export type InterruptedAgentLaunch = 'tab' | 'dispatch'

/** One interrupted agent tab (the payload of `terminal-server:agents-interrupted`). */
export interface InterruptedAgent {
  terminalId: string
  workspaceId?: string
  /** The terminal-driven agent id (`claude-cli`, `claude-cli-worktree`, `codex-cli`, …) or `unknown`. */
  agent: string
  claudeSessionId: string | null
  /** The `--name=` it was launched with (claudeSessionNameRecords), or null. */
  claudeSessionName: string | null
  workorder?: string
  towerTerminalId?: string
  role?: 'tower'
  launchedBy: InterruptedAgentLaunch
  cwd: string
  shell?: string
  /** When the recovery interrupted it (ms epoch). */
  at: number
}

/** `agentPreset` names an agent (anything but a plain shell). */
export function isAgentPreset(preset: string | undefined): boolean {
  return !!preset && preset !== 'none'
}

/** A claude-cli tab (the only kind B1 resumes). */
export function isClaudeCliAgent(agent: string): boolean {
  return agent === 'claude-cli' || agent === 'claude-cli-worktree'
}

function agentOf(source: InterruptedAgentSource): string {
  if (isAgentPreset(source.agentPreset)) return source.agentPreset!
  if (source.sessionId) return 'claude-cli'
  if (source.blockedDetection === 'osc') return 'codex-cli'
  return 'unknown'
}

/** Whether a rebuilt PTY was (probably) running an agent (see the file header). */
export function wasRunningAgent(source: InterruptedAgentSource): boolean {
  return isAgentPreset(source.agentPreset) || source.startedAt !== null || source.sessionId !== null
}

export interface InterruptedAgentSnapshotOptions {
  /** The `--name=` recorded for the terminal (claudeSessionNameRecords), or null. */
  nameOf(terminalId: string): string | null
  now: number
}

/** The interrupted agent tabs among the rebuilt PTYs; plain shells are left out. */
export function buildInterruptedAgentSnapshot(sources: readonly InterruptedAgentSource[], opts: InterruptedAgentSnapshotOptions): InterruptedAgent[] {
  const out: InterruptedAgent[] = []
  for (const source of sources) {
    if (!wasRunningAgent(source)) continue
    const sessionId = source.sessionId && CLAUDE_SESSION_ID_PATTERN.test(source.sessionId) ? source.sessionId : null
    out.push({
      terminalId: source.terminalId,
      ...(source.workspaceId ? { workspaceId: source.workspaceId } : {}),
      agent: agentOf(source),
      claudeSessionId: sessionId,
      claudeSessionName: opts.nameOf(source.terminalId),
      ...(source.workorder ? { workorder: source.workorder } : {}),
      ...(source.towerTerminalId ? { towerTerminalId: source.towerTerminalId } : {}),
      ...(source.role ? { role: source.role } : {}),
      launchedBy: source.workorder || source.towerTerminalId ? 'dispatch' : 'tab',
      cwd: source.cwd,
      ...(source.shell ? { shell: source.shell } : {}),
      at: opts.now,
    })
  }
  return out
}

/** Why an entry left the list (logged). */
export type InterruptedAgentRemoval = 'resumed' | 'dismissed' | 'pty-ended' | 'session-start'

export interface InterruptedAgentsLogger {
  log(message: string): void
}

/** One line per entry: id, agent, launch, session prefix — never a full session id. */
export function describeInterruptedAgent(agent: InterruptedAgent): string {
  return `terminal=${agent.terminalId} agent=${agent.agent} launchedBy=${agent.launchedBy}${agent.workorder ? ` workorder=${agent.workorder}` : ''} session=${agent.claudeSessionId ? sessionIdForLog(agent.claudeSessionId) : 'unknown'}`
}

/**
 * The interrupted tabs of this process (Electron main; memory only, plus the session id copy in
 * `claude-sessions.json`, see ClaudeSessionPersistence). Listeners run after every change.
 */
export class InterruptedAgentsStore {
  private readonly entries = new Map<string, InterruptedAgent>()
  private readonly listeners = new Set<(reason: 'recovery' | 'update') => void>()

  constructor(private readonly logger?: InterruptedAgentsLogger) {}

  /**
   * A recovery's snapshot. An id already listed (a second recovery before the user acted) keeps the
   * session id it had when the new snapshot has none — the tracker was cleared by the first one.
   */
  record(snapshot: readonly InterruptedAgent[]): void {
    for (const agent of snapshot) {
      const previous = this.entries.get(agent.terminalId)
      const merged: InterruptedAgent = previous && !agent.claudeSessionId && previous.claudeSessionId
        ? { ...agent, claudeSessionId: previous.claudeSessionId, claudeSessionName: agent.claudeSessionName ?? previous.claudeSessionName }
        : agent
      this.entries.delete(agent.terminalId)
      this.entries.set(agent.terminalId, merged)
      this.logger?.log(`[interrupted-agents] interrupted: ${describeInterruptedAgent(merged)}`)
    }
    this.logger?.log(`[interrupted-agents] recovery interrupted ${snapshot.length} agent tab(s); listed ${this.entries.size}`)
    this.emit('recovery')
  }

  list(): InterruptedAgent[] {
    return [...this.entries.values()].map(agent => ({ ...agent }))
  }

  get(terminalId: string): InterruptedAgent | null {
    const agent = this.entries.get(terminalId)
    return agent ? { ...agent } : null
  }

  has(terminalId: string): boolean {
    return this.entries.has(terminalId)
  }

  /** True when it was listed. */
  remove(terminalId: string, cause: InterruptedAgentRemoval): boolean {
    if (!this.entries.delete(terminalId)) return false
    this.logger?.log(`[interrupted-agents] removed: terminal=${terminalId} (${cause})`)
    this.emit('update')
    return true
  }

  /** The listed claude session ids (for `claude-sessions.json`). */
  interruptedSessions(): Array<{ terminalId: string; sessionId: string; at: number }> {
    const out: Array<{ terminalId: string; sessionId: string; at: number }> = []
    for (const agent of this.entries.values()) {
      if (agent.claudeSessionId) out.push({ terminalId: agent.terminalId, sessionId: agent.claudeSessionId, at: agent.at })
    }
    return out
  }

  onChange(listener: (reason: 'recovery' | 'update') => void): () => void {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  private emit(reason: 'recovery' | 'update'): void {
    for (const listener of this.listeners) {
      try { listener(reason) } catch { /* a listener must not break the store */ }
    }
  }
}

// ── `terminal:resume-interrupted-agent` (main.ts `ipcMain.handle`: renderer only, never a helper /
// RemoteServer channel — interrupted-agents.test.ts guards it) ──

export type ResumeInterruptedAgentResult =
  | { ok: true; mode: ClaudeResumeMode; reason?: 'user-args' }
  | { ok: false; code: 'NOT_FOUND' | 'NOT_RUNNING' | 'NOT_CLAUDE' | 'BUILD_FAILED'; message?: string }

/** What `resumeInterruptedDispatchAgent` builds the command with (the dispatch builder's subset). */
export interface ResumeCommandRequest {
  agent: string
  workspaceId?: string
  workorder?: string
  terminalId: string
  shell?: string
  resume: { sessionId: string | null; sessionName?: string }
}

export interface ResumeCommandBuilt {
  command: string
  resume?: { mode: ClaudeResumeMode; reason?: 'user-args' }
}

export interface ResumeDispatchDeps {
  store: InterruptedAgentsStore
  isRunning(terminalId: string): boolean
  /** `createAgentPromptCommandBuilder` with `resume` (main.ts wires the dispatch's own builder). */
  buildCommand(request: ResumeCommandRequest): Promise<ResumeCommandBuilt | null>
  /** `PtyManager.writeDispatchCommand` (or `write`), with the trailing `\r`. */
  writeCommand(terminalId: string, command: string): void
  logger: InterruptedAgentsLogger
}

/**
 * Resumes an interrupted claude tab in its rebuilt shell: the dispatch's command builder with
 * `--resume=<id>` (or `--resume`) and no prompt (D211 P-2), written into the shell (idle, new: no
 * kill needed). The entry leaves the list. The renderer sends here the tabs it cannot launch
 * itself — a helper-dispatched Worker (no renderer `agentPreset`), a claude typed into a shell; a
 * claude-cli tab the user opened goes through its own `startClaudeCliPty` instead.
 */
export async function resumeInterruptedDispatchAgent(deps: ResumeDispatchDeps, terminalId: unknown): Promise<ResumeInterruptedAgentResult> {
  if (typeof terminalId !== 'string' || !terminalId) return { ok: false, code: 'NOT_FOUND', message: 'terminalId required' }
  const agent = deps.store.get(terminalId)
  if (!agent) return { ok: false, code: 'NOT_FOUND' }
  if (!isClaudeCliAgent(agent.agent)) return { ok: false, code: 'NOT_CLAUDE', message: `agent ${agent.agent}` }
  if (!deps.isRunning(terminalId)) return { ok: false, code: 'NOT_RUNNING' }
  const built = await deps.buildCommand({
    agent: agent.agent,
    ...(agent.workspaceId ? { workspaceId: agent.workspaceId } : {}),
    ...(agent.workorder ? { workorder: agent.workorder } : {}),
    terminalId,
    ...(agent.shell ? { shell: agent.shell } : {}),
    resume: { sessionId: agent.claudeSessionId, ...(agent.claudeSessionName ? { sessionName: agent.claudeSessionName } : {}) },
  })
  if (!built) {
    deps.logger.log(`[interrupted-agents] resume failed: terminal=${terminalId} (no command)`)
    return { ok: false, code: 'BUILD_FAILED' }
  }
  const decision = built.resume ?? claudeResumeArgs(agent.claudeSessionId, '')
  deps.writeCommand(terminalId, built.command + '\r')
  deps.store.remove(terminalId, 'resumed')
  deps.logger.log(`[interrupted-agents] resumed dispatch: ${describeInterruptedAgent(agent)} mode=${decision.mode}${decision.reason ? ` reason=${decision.reason}` : ''}`)
  return { ok: true, mode: decision.mode, ...(decision.reason ? { reason: decision.reason } : {}) }
}
