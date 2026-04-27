import type { StepStatus } from './types'

export interface StatusPresetEntry {
  icon: string
  color: string
  label: string
}

/**
 * 預設狀態 → 視覺對應（T0305 Phase B4 拍板）。
 * 配色採用既有 hex（PLAN-030 拍板 5：不引入 design token）。
 */
export const STATUS_PRESET: Record<StepStatus, StatusPresetEntry> = {
  pending:          { icon: '○',  color: '#71717a', label: 'pending' },
  running:          { icon: '🔄', color: '#f59e0b', label: 'running' },
  // T0330 (PLAN-032 Sprint 2): awaiting-input visual contract.
  // sky-400 distinguishes from running's amber; solid dot signals "pending decision".
  'awaiting-input': { icon: '●',  color: '#38bdf8', label: 'awaiting-input' },
  completed:        { icon: '✓',  color: '#10b981', label: 'completed' },
  failed:           { icon: '✗',  color: '#ef4444', label: 'failed' },
  skipped:          { icon: '⏭',  color: '#f59e0b', label: 'skipped' },
  'rolled-back':    { icon: '↩',  color: '#71717a', label: 'rolled-back' },
}

/**
 * 群組合併時取「最差狀態」用於 pill 配色（compress mode）。
 * 優先級由高至低：failed > running > skipped > rolled-back > pending > completed。
 */
// T0330: awaiting-input ranks between running and skipped — needs user attention
// (not yet decided) but weaker than running (auto-executing).
const SEVERITY_ORDER: StepStatus[] = [
  'failed',
  'running',
  'awaiting-input',
  'skipped',
  'rolled-back',
  'pending',
  'completed',
]

export function worstStatus(statuses: StepStatus[]): StepStatus {
  for (const s of SEVERITY_ORDER) {
    if (statuses.includes(s)) return s
  }
  return 'pending'
}
