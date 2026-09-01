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

/**
 * T0360/BUG-082: 本函式**刻意不做 ID 驗證**。
 *
 * 上游 `workOrderId` 一律來自 `filenameToId()`（`src/types/control-tower.ts`），
 * 已受該處的 `WORKORDER_ID_PATTERN` 文法約束；此處再加一道會改變回傳型別
 * （`string` → `string | null`），波及 App.tsx / WorkspaceView.tsx 四個呼叫點，
 * 屬純 regression 風險而無新防護。
 *
 * 若日後改為接受使用者自由輸入的 ID，請改為 import
 * `WORKORDER_ID_PATTERN`（已 export）而非再抄一份 regex —— 四處分歧正是 BUG-082 的根因。
 */
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
