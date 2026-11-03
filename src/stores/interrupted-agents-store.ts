/**
 * PLAN-055 B1 / T0766 (D211): the renderer side of the agent tabs a Terminal Server recovery
 * interrupted (main: electron/interrupted-agents.ts). Main sends the whole list on every change
 * (`terminal-server:agents-interrupted`, `reason: 'recovery' | 'update'`) and answers the pull
 * `terminal-server:query-interrupted-agents`; each window keeps only the ids of its own tabs.
 * Memory only — the ⏸ thumbnail mark and InterruptedAgentsDialog read it.
 *
 * Resuming (`resumeInterruptedAgent`):
 *   - a claude-cli / codex-cli tab the user opened (the renderer has its `agentPreset`): the
 *     workspace's handler — `startClaudeCliPty` with `--resume`, or (T0767) ⏻'s path with codex's
 *     `resume` picker (WorkspaceView registers a handler per workspace; a workspace never mounted
 *     in this window is activated first)
 *   - any other claude / codex tab (a helper-dispatched Worker, an agent typed into a shell): main's
 *     `terminal:resume-interrupted-agent`
 *   - unknown: not resumable
 * Nothing resumes on its own (D211 P-1).
 */
import { useSyncExternalStore } from 'react'

/** Mirror of electron/interrupted-agents.ts `InterruptedAgent`. */
export interface InterruptedAgentInfo {
  terminalId: string
  workspaceId?: string
  agent: string
  claudeSessionId: string | null
  claudeSessionName: string | null
  workorder?: string
  towerTerminalId?: string
  role?: 'tower'
  launchedBy: 'tab' | 'dispatch'
  cwd: string
  shell?: string
  at: number
  /** PLAN-063 / T0821: `upgrade` = ended by an upgrade (first start after it); absent = a Terminal Server recovery. */
  cause?: 'upgrade'
}

/** Mirror of electron/upgrade-interruption.ts `UpgradeInterruptionNotice`. */
export interface UpgradeInterruptionNotice {
  previousVersion: string
  currentVersion: string
  /** Terminals the upgrade ended. */
  ptyCount: number
  /** Of those, the agent tabs listed in InterruptedAgentsDialog. */
  agentCount: number
}

/** T0821: a notice main sent, as far as the renderer trusts it (null = nothing to show). */
export function parseUpgradeInterruptionNotice(raw: unknown): UpgradeInterruptionNotice | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const { previousVersion, currentVersion, ptyCount, agentCount } = raw as Record<string, unknown>
  if (typeof previousVersion !== 'string' || typeof currentVersion !== 'string') return null
  if (typeof ptyCount !== 'number' || !Number.isInteger(ptyCount) || ptyCount < 1) return null
  const agents = typeof agentCount === 'number' && Number.isInteger(agentCount) && agentCount > 0 ? agentCount : 0
  return { previousVersion, currentVersion, ptyCount, agentCount: agents }
}

/** Every listed entry was ended by an upgrade (InterruptedAgentsDialog's title / text). */
export function allUpgradeInterrupted(list: readonly Pick<InterruptedAgentInfo, 'cause'>[]): boolean {
  return list.length > 0 && list.every(agent => agent.cause === 'upgrade')
}

export interface InterruptedAgentsEvent {
  reason: 'recovery' | 'update'
  agents: InterruptedAgentInfo[]
}

/** Mirror of electron/interrupted-agents.ts `ResumeInterruptedAgentResult`. */
export type ResumeInterruptedAgentResult =
  | { ok: true; mode: 'session' | 'picker' | 'none'; reason?: 'user-args' }
  | { ok: false; code: string; message?: string }

/** Window event: open InterruptedAgentsDialog (the ⏸ mark, the recovery toast). */
export const OPEN_INTERRUPTED_AGENTS_EVENT = 'bat:open-interrupted-agents'

let agents = new Map<string, InterruptedAgentInfo>()
let version = 0
const listeners = new Set<() => void>()

function notify(): void {
  version++
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

/** A claude-cli agent (B1: `--resume`). */
export function isClaudeResumableAgent(agent: Pick<InterruptedAgentInfo, 'agent'>): boolean {
  return agent.agent === 'claude-cli' || agent.agent === 'claude-cli-worktree'
}

/** A codex-cli agent (B2 / T0767: codex's `resume` picker). */
export function isCodexResumableAgent(agent: Pick<InterruptedAgentInfo, 'agent'>): boolean {
  return agent.agent === 'codex-cli'
}

/** An agent BAT can resume: claude-cli or codex-cli (mirror of `isResumableInterruptedAgent`, electron/interrupted-agents.ts). */
export function isResumableAgent(agent: Pick<InterruptedAgentInfo, 'agent'>): boolean {
  return isClaudeResumableAgent(agent) || isCodexResumableAgent(agent)
}

/** The renderer presets a workspace handler resumes itself (a tab the user opened). */
function hasTabResumePreset(preset: string | undefined): boolean {
  return preset === 'claude-cli' || preset === 'claude-cli-worktree' || preset === 'codex-cli'
}

/**
 * Replaces the list with main's, keeping only the tabs this window has (`ownsTerminal`). Returns the
 * kept entries.
 */
export function setInterruptedAgents(list: readonly InterruptedAgentInfo[] | null | undefined, ownsTerminal: (terminalId: string) => boolean): InterruptedAgentInfo[] {
  const next = new Map<string, InterruptedAgentInfo>()
  for (const agent of list ?? []) {
    if (agent && typeof agent.terminalId === 'string' && ownsTerminal(agent.terminalId)) next.set(agent.terminalId, agent)
  }
  const changed = next.size !== agents.size || [...next].some(([id, agent]) => agents.get(id) !== agent)
  agents = next
  if (changed) notify()
  return [...next.values()]
}

export function getInterruptedAgent(terminalId: string): InterruptedAgentInfo | null {
  return agents.get(terminalId) ?? null
}

export function listInterruptedAgents(): InterruptedAgentInfo[] {
  return [...agents.values()]
}

/** Drops an entry here at once (main confirms with its next list). */
export function forgetInterruptedAgent(terminalId: string): void {
  if (agents.delete(terminalId)) notify()
}

export function useInterruptedAgentsVersion(): number {
  return useSyncExternalStore(subscribe, () => version)
}

export function useInterruptedAgent(terminalId: string): InterruptedAgentInfo | null {
  return useSyncExternalStore(subscribe, () => agents.get(terminalId) ?? null)
}

export function useInterruptedAgents(): InterruptedAgentInfo[] {
  useInterruptedAgentsVersion()
  return listInterruptedAgents()
}

// ── resume ──

/** What a workspace's handler does: kill + `startClaudeCliPty` with `--resume`; codex-cli (T0767): ⏻ + `resume`. */
export type TabResumeHandler = (agent: InterruptedAgentInfo) => Promise<ResumeInterruptedAgentResult>

const tabResumeHandlers = new Map<string, TabResumeHandler>()
const handlerWaiters = new Map<string, Array<(handler: TabResumeHandler) => void>>()

/** WorkspaceView registers its `startClaudeCliPty` resume while mounted. */
export function registerTabResumeHandler(workspaceId: string, handler: TabResumeHandler): () => void {
  tabResumeHandlers.set(workspaceId, handler)
  const waiters = handlerWaiters.get(workspaceId)
  if (waiters) {
    handlerWaiters.delete(workspaceId)
    for (const resolve of waiters) resolve(handler)
  }
  return () => {
    if (tabResumeHandlers.get(workspaceId) === handler) tabResumeHandlers.delete(workspaceId)
  }
}

function waitForTabResumeHandler(workspaceId: string, timeoutMs: number): Promise<TabResumeHandler | null> {
  const existing = tabResumeHandlers.get(workspaceId)
  if (existing) return Promise.resolve(existing)
  return new Promise((resolve) => {
    let done = false
    const waiter = (handler: TabResumeHandler) => {
      if (done) return
      done = true
      resolve(handler)
    }
    const list = handlerWaiters.get(workspaceId) ?? []
    list.push(waiter)
    handlerWaiters.set(workspaceId, list)
    setTimeout(() => {
      if (done) return
      done = true
      const remaining = (handlerWaiters.get(workspaceId) ?? []).filter(w => w !== waiter)
      if (remaining.length > 0) handlerWaiters.set(workspaceId, remaining)
      else handlerWaiters.delete(workspaceId)
      resolve(null)
    }, timeoutMs)
  })
}

export interface ResumeInterruptedAgentDeps {
  /** The tab's renderer `agentPreset` and workspace (null = not a tab of this window). */
  terminalOf(terminalId: string): { agentPreset?: string; workspaceId: string } | null
  /** Main's `terminal:resume-interrupted-agent`. */
  resumeInMain(terminalId: string): Promise<ResumeInterruptedAgentResult>
  /** Mounts the workspace's view (no handler registered yet). */
  activateWorkspace(workspaceId: string): void
  /** Default 5000 ms. */
  handlerTimeoutMs?: number
}

/** Resumes one interrupted claude / codex tab (see the file header for the two paths). */
export async function resumeInterruptedAgent(agent: InterruptedAgentInfo, deps: ResumeInterruptedAgentDeps): Promise<ResumeInterruptedAgentResult> {
  if (!isResumableAgent(agent)) return { ok: false, code: 'NOT_RESUMABLE' }
  const terminal = deps.terminalOf(agent.terminalId)
  if (!terminal) return { ok: false, code: 'NOT_FOUND' }
  if (hasTabResumePreset(terminal.agentPreset)) {
    let handler = tabResumeHandlers.get(terminal.workspaceId) ?? null
    if (!handler) {
      deps.activateWorkspace(terminal.workspaceId)
      handler = await waitForTabResumeHandler(terminal.workspaceId, deps.handlerTimeoutMs ?? 5000)
    }
    if (!handler) return { ok: false, code: 'NO_WORKSPACE_VIEW' }
    const result = await handler(agent)
    if (result.ok) forgetInterruptedAgent(agent.terminalId)
    return result
  }
  const result = await deps.resumeInMain(agent.terminalId)
  if (result.ok) forgetInterruptedAgent(agent.terminalId)
  return result
}

/** Tests only. */
export function resetInterruptedAgentsStoreForTests(): void {
  agents = new Map()
  tabResumeHandlers.clear()
  handlerWaiters.clear()
  notify()
}
