/**
 * PLAN-040 / T0529: workspace-level default agent and agent launch arguments.
 *
 * Single source of truth for "which agent and which custom args does this workspace use".
 * Shared by the renderer (dispatch buttons, new agent terminals, Workspace settings dialog)
 * and the main process (`terminal:create-agent-command`, `agent:build-launch-command`), so
 * the two can never disagree. Pure: no electron / DOM imports.
 *
 * Lookup order
 *   - default agent: workspace `defaultAgent` → Settings `defaultAgent` → `claude-code` (D140)
 *   - custom args, per preset id (D142):
 *       workspace `agentCustomArgs` HAS the key (an empty string included) → it replaces the
 *       global value as a whole (not concatenated); empty = no custom args in this workspace
 *       workspace has no key → Settings `agentCustomArgs[preset]`
 */

export const BUILTIN_DEFAULT_AGENT = 'claude-code'

export type AgentLaunchSource = 'workspace' | 'settings' | 'builtin'

/** Fields read from a workspace; also accepts untyped window-registry data (validated here). */
export interface WorkspaceAgentLaunchFields {
  defaultAgent?: unknown
  agentCustomArgs?: unknown
}

/** Fields read from the global settings. */
export interface GlobalAgentLaunchFields {
  defaultAgent?: unknown
  agentCustomArgs?: unknown
}

export interface EffectiveDefaultAgent {
  agent: string
  source: AgentLaunchSource
}

export interface EffectiveAgentArgs {
  /** Trimmed; '' = no custom args. */
  args: string
  /** `builtin` = neither the workspace nor Settings has args for this preset. */
  source: AgentLaunchSource
  /** The preset id whose entry supplied `args` (absent when `source` is `builtin`). */
  presetId?: string
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function argsRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

export function resolveEffectiveDefaultAgent(
  workspace: WorkspaceAgentLaunchFields | null | undefined,
  settings: GlobalAgentLaunchFields | null | undefined,
): EffectiveDefaultAgent {
  const fromWorkspace = nonEmptyString(workspace?.defaultAgent)
  if (fromWorkspace) return { agent: fromWorkspace, source: 'workspace' }
  const fromSettings = nonEmptyString(settings?.defaultAgent)
  if (fromSettings) return { agent: fromSettings, source: 'settings' }
  return { agent: BUILTIN_DEFAULT_AGENT, source: 'builtin' }
}

/**
 * Custom launch args for `presetIds` (one id, or candidates in priority order — the helper
 * dispatch looks up the terminal-driven id first, then the id it was asked for).
 * The workspace layer is checked across all candidates before the global layer.
 */
export function resolveEffectiveAgentArgs(
  workspace: WorkspaceAgentLaunchFields | null | undefined,
  settings: GlobalAgentLaunchFields | null | undefined,
  presetIds: string | readonly string[],
): EffectiveAgentArgs {
  const ids = (typeof presetIds === 'string' ? [presetIds] : presetIds).filter(id => !!id)

  const workspaceArgs = argsRecord(workspace?.agentCustomArgs)
  if (workspaceArgs) {
    for (const id of ids) {
      if (!Object.prototype.hasOwnProperty.call(workspaceArgs, id)) continue
      const value = workspaceArgs[id]
      if (typeof value !== 'string') continue
      return { args: value.trim(), source: 'workspace', presetId: id }
    }
  }

  const globalArgs = argsRecord(settings?.agentCustomArgs)
  if (globalArgs) {
    for (const id of ids) {
      const value = globalArgs[id]
      if (typeof value === 'string' && value.trim()) {
        return { args: value.trim(), source: 'settings', presetId: id }
      }
    }
  }

  return { args: '', source: 'builtin' }
}

/** True when the workspace overrides the global args of `presetId` (an empty override included). */
export function hasWorkspaceArgsOverride(
  workspace: WorkspaceAgentLaunchFields | null | undefined,
  presetId: string,
): boolean {
  const workspaceArgs = argsRecord(workspace?.agentCustomArgs)
  return !!workspaceArgs
    && Object.prototype.hasOwnProperty.call(workspaceArgs, presetId)
    && typeof workspaceArgs[presetId] === 'string'
}

/** `base` + effective args, separated by one space; `base` unchanged when there are none. */
export function appendAgentArgs(base: string, args: string): string {
  const trimmed = args.trim()
  return trimmed ? `${base} ${trimmed}` : base
}
