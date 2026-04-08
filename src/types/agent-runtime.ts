/**
 * Agent Runtime Types — Shared between main process and renderer.
 *
 * This file provides the renderer-side type definitions and registry
 * that mirrors the main process agent-registry for UI consumption.
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

// ── Launch Option (for Settings UI) ────────────────────────────────
export interface AgentLaunchOption {
  key: string
  label: string
  type: 'select' | 'boolean' | 'string'
  options?: { value: string; label: string }[]
  defaultValue?: string | boolean
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
  launchOptions?: AgentLaunchOption[]
}

// ── Custom CLI Definition ──────────────────────────────────────────
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

// ── Helper functions ───────────────────────────────────────────────

/** Check if a definition ID represents a Claude SDK integrated agent */
export function isClaudeSdk(id: string): boolean {
  return id === 'claude-code' || id === 'claude-code-v2' || id === 'claude-code-worktree'
}

/** Check if a definition ID represents a Claude CLI terminal agent */
export function isClaudeCli(id: string): boolean {
  return id === 'claude-cli' || id === 'claude-cli-worktree'
}

/** Check if a definition ID is an integrated (SDK-based) agent */
export function isIntegrated(id: string): boolean {
  // Currently only claude-code variants are integrated
  return isClaudeSdk(id)
}

/** Check if this is an active agent (not 'none' and not undefined) */
export function isAgent(id: string | undefined): boolean {
  return !!id && id !== 'none'
}

/** Check if this agent supports worktree */
export function isWorktreeAgent(id: string): boolean {
  return id === 'claude-code-worktree' || id === 'claude-cli-worktree'
}
