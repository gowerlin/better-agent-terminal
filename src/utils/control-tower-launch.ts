import type { AgentPresetId } from '../types/agent-presets'

export type ControlTowerWorkOrderAction = 'exec' | 'done'

export interface ControlTowerAgentRuntime {
  command: 'claude' | 'codex'
  prefix: '/' | '$'
  argsPresetId: AgentPresetId
}

const CLAUDE_PRESETS = new Set<AgentPresetId>([
  'claude-code',
  'claude-code-v2',
  'claude-code-worktree',
  'claude-cli',
  'claude-cli-worktree',
])

const CODEX_PRESETS = new Set<AgentPresetId>([
  'codex-agent',
  'codex-agent-worktree',
  'codex-cli',
])

export function resolveControlTowerAgentRuntime(agentPreset?: string): ControlTowerAgentRuntime {
  if (agentPreset && CODEX_PRESETS.has(agentPreset as AgentPresetId)) {
    return {
      command: 'codex',
      prefix: '$',
      argsPresetId: 'codex-cli',
    }
  }

  if (agentPreset && CLAUDE_PRESETS.has(agentPreset as AgentPresetId)) {
    return {
      command: 'claude',
      prefix: '/',
      argsPresetId: 'claude-cli',
    }
  }

  return {
    command: 'claude',
    prefix: '/',
    argsPresetId: 'claude-cli',
  }
}

export function buildControlTowerWorkOrderCommand(
  runtime: ControlTowerAgentRuntime,
  action: ControlTowerWorkOrderAction,
  workOrderId: string,
  customArgs = ''
): string {
  const args = customArgs.trim()
  const suffix = args ? ` ${args}` : ''
  return `${runtime.command} "${runtime.prefix}ct-${action} ${workOrderId.trim()}"${suffix}`
}
