/**
 * Agent Runtime — Core Type Definitions
 *
 * Defines the universal agent abstraction layer that allows BAT
 * to support multiple CLI agents (Claude, Codex, Gemini, Copilot, custom)
 * through a single runtime interface.
 */

// ── Provider Mode ──────────────────────────────────────────────────
export type ProviderMode = 'integrated' | 'terminal-driven' | 'hybrid'

// ── Agent Capabilities ─────────────────────────────────────────────
export interface AgentCapabilities {
  canStreamMessages: boolean
  canShowStructuredToolCalls: boolean
  canRequestApproval: boolean
  canAttachImages: boolean
  canResume: boolean
  canFork: boolean
  canSwitchModel: boolean
  canShowUsage: boolean
  canShowSubtasks: boolean
}

// ── Agent Definition ───────────────────────────────────────────────
export interface AgentDefinition {
  id: string
  name: string
  icon: string
  color: string
  providerId: string
  providerMode: ProviderMode
  defaultCommand?: string
  defaultArgs?: string[]
  supportsWorktree: boolean
  supportsStructuredEvents: boolean
  supportsImages: boolean
  supportsResume: boolean
  supportsModelSelection: boolean
  supportsApprovalFlow: boolean
  supportsSandbox: boolean
  supportsYolo: boolean
  suggested?: boolean
  debug?: boolean
  /** Provider-specific settings schema (sandbox modes, approval policies, etc.) */
  launchOptions?: AgentLaunchOption[]
}

// ── Launch Options (provider-specific configurable params) ──────────
export interface AgentLaunchOption {
  key: string
  label: string
  type: 'select' | 'boolean' | 'string'
  options?: { value: string; label: string }[]
  defaultValue?: string | boolean
}

// ── Agent Session ──────────────────────────────────────────────────
export type AgentSessionState = 'created' | 'starting' | 'ready' | 'busy' | 'stopped' | 'error'

export interface AgentSession {
  sessionId: string
  workspaceId: string
  terminalId: string
  agentDefinitionId: string
  runtimeState: AgentSessionState
  cwd: string
  originalCwd: string
  worktreePath?: string
  worktreeBranch?: string
  launchMode: ProviderMode
  persistedSessionToken?: string
  capabilitiesSnapshot: AgentCapabilities
  metadata: Record<string, unknown>
}

// ── Agent Event ────────────────────────────────────────────────────
export type AgentEventType =
  | 'session_started'
  | 'session_ready'
  | 'message_user'
  | 'message_assistant'
  | 'tool_started'
  | 'tool_updated'
  | 'tool_finished'
  | 'status_changed'
  | 'error'
  | 'session_stopped'

export interface AgentEvent {
  type: AgentEventType
  sessionId: string
  timestamp: number
  data?: unknown
}

// ── Provider Interface ─────────────────────────────────────────────
export interface AgentProvider {
  readonly id: string
  readonly mode: ProviderMode
  getCapabilities(): AgentCapabilities
  /** Validate that the CLI/SDK is available on this system */
  checkAvailability(): Promise<{ available: boolean; message?: string }>
}

// ── Custom CLI Definition (user-defined) ───────────────────────────
export interface CustomCliDefinition {
  id: string
  name: string
  icon: string
  color: string
  command: string
  args?: string[]
  supportsWorktree?: boolean
  sandboxFlag?: string
  yoloFlag?: string
}
