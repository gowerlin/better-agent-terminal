/**
 * Control Tower Work Order Parser
 * 解析 _ct-workorders/ 目錄下的 .md 工單檔案
 */

export type WorkOrderStatus =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'DONE'
  | 'FAILED'
  | 'BLOCKED'
  | 'PARTIAL'
  | 'INTERRUPTED'
  | 'URGENT'

export interface WorkOrder {
  id: string           // e.g. 'T0001'
  filename: string     // e.g. 'T0001-create-project-context.md'
  title: string        // e.g. '建立專案上下文'
  status: WorkOrderStatus
  createdAt: string    // raw time string
  startedAt?: string
  completedAt?: string
  estimatedSize?: string // 大 / 中 / 小
  contextRisk?: string   // 高 / 中 / 低
  targetSubproject?: string
}

const STATUS_VALUES = new Set<WorkOrderStatus>([
  'PENDING', 'IN_PROGRESS', 'DONE', 'FAILED', 'BLOCKED', 'PARTIAL', 'INTERRUPTED', 'URGENT',
])

/**
 * 從工單 .md 內容解析 metadata
 * 容錯設計：欄位缺失不報錯，返回 partial data
 */
export function parseWorkOrder(filename: string, content: string): WorkOrder {
  const extractField = (label: string): string | undefined => {
    const regex = new RegExp(`\\*\\*${label}\\*\\*[：:]\\s*(.+)`, 'm')
    const match = content.match(regex)
    return match?.[1]?.trim()
  }

  const id = extractField('工單編號') ?? filenameToId(filename)
  const title = extractField('任務名稱') ?? extractField('標題') ?? filenameToTitle(filename)
  const rawStatus = extractField('狀態')?.toUpperCase() as WorkOrderStatus | undefined
  const status: WorkOrderStatus = rawStatus && STATUS_VALUES.has(rawStatus) ? rawStatus : 'PENDING'

  return {
    id,
    filename,
    title,
    status,
    createdAt: extractField('建立時間') ?? '',
    startedAt: extractField('開始時間'),
    completedAt: extractField('完成時間'),
    estimatedSize: extractField('預估規模'),
    contextRisk: extractField('Context Window 風險'),
    targetSubproject: extractField('目標子專案'),
  }
}

/** T0001-create-project-context.md → T0001 */
function filenameToId(filename: string): string {
  const match = filename.match(/^(T\d+)/)
  return match?.[1] ?? filename.replace('.md', '')
}

/** T0001-create-project-context.md → create project context */
function filenameToTitle(filename: string): string {
  return filename
    .replace(/^T\d+-/, '')
    .replace(/\.md$/, '')
    .replace(/-/g, ' ')
}

/** 判斷檔案是否為工單（排除 _ 開頭的系統檔和 .yaml） */
export function isWorkOrderFile(filename: string): boolean {
  return filename.endsWith('.md') && !filename.startsWith('_') && /^T\d+/.test(filename)
}

/** 依狀態返回色碼 class name */
export function statusColor(status: WorkOrderStatus): string {
  switch (status) {
    case 'PENDING': return 'ct-status-pending'
    case 'IN_PROGRESS': return 'ct-status-in-progress'
    case 'DONE': return 'ct-status-done'
    case 'FAILED': return 'ct-status-failed'
    case 'BLOCKED': return 'ct-status-blocked'
    case 'PARTIAL': return 'ct-status-partial'
    case 'INTERRUPTED': return 'ct-status-interrupted'
    case 'URGENT': return 'ct-status-urgent'
    default: return 'ct-status-pending'
  }
}

/** 狀態 badge 文字 */
export function statusLabel(status: WorkOrderStatus): string {
  switch (status) {
    case 'PENDING': return '⏳ Pending'
    case 'IN_PROGRESS': return '🔄 In Progress'
    case 'DONE': return '✅ Done'
    case 'FAILED': return '❌ Failed'
    case 'BLOCKED': return '🚫 Blocked'
    case 'PARTIAL': return '⚠️ Partial'
    case 'INTERRUPTED': return '⏸️ Interrupted'
    case 'URGENT': return '🔥 Urgent'
    default: return status
  }
}
