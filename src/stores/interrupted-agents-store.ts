/**
 * PLAN-055 B1 / T0766 (D211): the renderer side of the agent tabs a Terminal Server recovery
 * interrupted (main: electron/interrupted-agents.ts). Main sends the whole list on every change
 * (`terminal-server:agents-interrupted`, `reason: 'recovery' | 'update'`) and answers the pull
 * `terminal-server:query-interrupted-agents`; each window keeps only the ids of its own tabs.
 * Memory only — the ⏸ thumbnail mark and InterruptedAgentsDialog read it.
 *
 * Resuming (`resumeInterruptedAgent`):
 *   - a claude-cli tab the user opened (the renderer has its `agentPreset`): the workspace's
 *     `startClaudeCliPty` with `--resume` (WorkspaceView registers a handler per workspace; a
 *     workspace never mounted in this window is activated first)
 *   - any other claude tab (a helper-dispatched Worker, a claude typed into a shell): main's
 *     `terminal:resume-interrupted-agent`
 *   - codex / unknown: not resumable in B1 (codex: T0767)
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

/** A claude-cli agent (the only kind B1 resumes). */
export function isResumableAgent(agent: Pick<InterruptedAgentInfo, 'agent'>): boolean {
  return agent.agent === 'claude-cli' || agent.agent === 'claude-cli-worktree'
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

/** What a workspace's handler does: kill + `startClaudeCliPty` with `--resume`. */
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

/** Resumes one interrupted claude tab (see the file header for the two paths). */
export async function resumeInterruptedAgent(agent: InterruptedAgentInfo, deps: ResumeInterruptedAgentDeps): Promise<ResumeInterruptedAgentResult> {
  if (!isResumableAgent(agent)) return { ok: false, code: 'NOT_CLAUDE' }
  const terminal = deps.terminalOf(agent.terminalId)
  if (!terminal) return { ok: false, code: 'NOT_FOUND' }
  const preset = terminal.agentPreset
  if (preset === 'claude-cli' || preset === 'claude-cli-worktree') {
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
