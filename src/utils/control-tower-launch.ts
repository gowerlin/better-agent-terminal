import type { AgentPresetId } from '../types/agent-presets'
import type { ControlTowerPromptRequest, ControlTowerPromptResult } from '../types/ct-dispatch-prompt'

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
  customArgs = '',
  /** T0710: the prompt argument the host quoted (`terminal:control-tower-prompt`); absent = the pre-T0710 form. */
  quotedPrompt?: string
): string {
  const args = customArgs.trim()
  const suffix = args ? ` ${args}` : ''
  const prompt = quotedPrompt ?? `"${runtime.prefix}ct-${action} ${workOrderId.trim()}"`
  return `${runtime.command} ${prompt}${suffix}`
}

export interface ControlTowerCommandHost {
  resolvePrompt?(request: ControlTowerPromptRequest): Promise<ControlTowerPromptResult>
  log?(...args: unknown[]): void
}

function defaultControlTowerCommandHost(): ControlTowerCommandHost {
  const api = typeof window !== 'undefined' ? window.electronAPI : undefined
  return {
    resolvePrompt: api?.ctDispatch?.resolvePrompt,
    log: api?.debug?.log,
  }
}

/**
 * T0710: the panel's one-click dispatch command. Claude: unchanged (`claude "/ct-exec T####"`).
 * Codex: the host that runs the tab decides `$ct-exec` / `$ct:ct-exec` (CT installed by zip or as
 * the `ct` plugin, electron/ct-install-detect.ts) and quotes it for the shell
 * `terminal:create-with-command` starts — `$ct:ct-exec` must stay literal in pwsh / bash. When the
 * host cannot answer (a bat-server before T0710: `No handler`), the pre-T0710 command (`$ct-<action>`).
 * `customEnv` = the env the tab is created with (its `CODEX_HOME` counts).
 */
export async function resolveControlTowerWorkOrderCommand(
  runtime: ControlTowerAgentRuntime,
  action: ControlTowerWorkOrderAction,
  workOrderId: string,
  customArgs = '',
  customEnv?: Record<string, string>,
  host: ControlTowerCommandHost = defaultControlTowerCommandHost(),
): Promise<string> {
  if (runtime.command !== 'codex' || !host.resolvePrompt) {
    return buildControlTowerWorkOrderCommand(runtime, action, workOrderId, customArgs)
  }
  try {
    const result = await host.resolvePrompt({
      agent: runtime.argsPresetId,
      skill: `ct-${action}`,
      workorder: workOrderId.trim(),
      ...(customEnv ? { customEnv } : {}),
    })
    if (result?.ok) {
      host.log?.(`[ct-launch] codex skill name=$${result.skillName?.name ?? `ct-${action}`} reason=${result.skillName?.reason ?? 'n/a'} shell=${result.shellFamily}`)
      return buildControlTowerWorkOrderCommand(runtime, action, workOrderId, customArgs, result.quotedPrompt)
    }
    host.log?.(`[ct-launch] host refused the CT prompt (${result?.error ?? 'no result'}); using $ct-${action}`)
  } catch (error) {
    host.log?.(`[ct-launch] host cannot decide the Codex skill name (${error instanceof Error ? error.message : String(error)}); using $ct-${action}`)
  }
  return buildControlTowerWorkOrderCommand(runtime, action, workOrderId, customArgs)
}
