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
  isArchived?: boolean   // true for orders loaded from _archive/workorders/
}

const STATUS_VALUES = new Set<WorkOrderStatus>([
  'PENDING', 'IN_PROGRESS', 'DONE', 'FAILED', 'BLOCKED', 'PARTIAL', 'INTERRUPTED', 'URGENT',
])

/**
 * 從工單 .md 內容解析 metadata
 * 容錯設計：欄位缺失不報錯，返回 partial data
 * 支援：
 *   - 列表格式：- **狀態**：DONE / - 狀態：DONE（bold 選用，全形/半形冒號）
 *   - 表格格式：| **狀態** | DONE | / | 狀態 | DONE |（bold 選用）
 *   - YAML frontmatter 格式：status: DONE
 *   - 狀態值後帶註解仍可正確萃取：DONE <!-- 備注 --> / DONE（附加說明）
 */
export function parseWorkOrder(filename: string, content: string): WorkOrder {
  const extractField = (label: string): string | undefined => {
    // 格式 A：列表格式（bold 選用）— - **欄位**：值 / - 欄位：值
    const listRegex = new RegExp(`^-\\s+\\*{0,2}${label}\\*{0,2}[：:]\\s*(.+)`, 'm')
    const listMatch = content.match(listRegex)
    if (listMatch) return listMatch[1]?.trim()

    // 格式 B：Markdown 表格格式（bold 選用）— | **欄位** | 值 |
    const tableRegex = new RegExp(`\\|\\s*\\*{0,2}${label}\\*{0,2}\\s*\\|\\s*(.+?)\\s*\\|`, 'm')
    const tableMatch = content.match(tableRegex)
    if (tableMatch) return tableMatch[1]?.trim()

    // 格式 C：原始 bold-only 格式（向後相容，無列表前綴）
    const boldRegex = new RegExp(`\\*\\*${label}\\*\\*[：:]\\s*(.+)`, 'm')
    const boldMatch = content.match(boldRegex)
    return boldMatch?.[1]?.trim()
  }

  /** 從 raw 字串中提取第一個有效狀態關鍵字，忽略括號附加文字 */
  const extractStatusKeyword = (raw: string | undefined): WorkOrderStatus | undefined => {
    if (!raw) return undefined
    const keyword = raw.toUpperCase().match(/^[^A-Z]*(DONE|IN_PROGRESS|PENDING|BLOCKED|PARTIAL|INTERRUPTED|FAILED|URGENT)/)?.[1]
    return keyword && STATUS_VALUES.has(keyword as WorkOrderStatus) ? keyword as WorkOrderStatus : undefined
  }

  const id = extractField('工單編號') ?? filenameToId(filename)
  const title = extractField('任務名稱') ?? extractField('標題') ?? filenameToTitle(filename)

  // 優先 Markdown 格式，找不到再試 YAML frontmatter
  const rawMarkdownStatus = extractField('狀態')
  const yamlMatch = !rawMarkdownStatus ? content.match(/^status:\s*(\S+)/im) : null
  const status: WorkOrderStatus =
    extractStatusKeyword(rawMarkdownStatus) ??
    extractStatusKeyword(yamlMatch?.[1]) ??
    'PENDING'

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
