/**
 * Control Tower Work Order Parser
 * 解析 _ct-workorders/ 目錄下的 .md 工單檔案
 *
 * PLAN-034 Sprint 3: frontmatter-first parsing.
 *   - YAML frontmatter (schema_version: 1, schema_kind: workorder) is the SoT.
 *   - Falls back to legacy markdown table grep when frontmatter is missing.
 *   - Invalid / unknown status from frontmatter → 'INVALID' (never PENDING).
 */

import {
  extractFrontmatterBlock,
  parseFrontmatterYaml,
  detectStatusDrift,
  type ParseSource,
  type ParseWarning,
  type CtWorkorderFrontmatterV1,
} from '../utils/ct-frontmatter'

export type WorkOrderStatus =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'DONE'
  | 'FIXED'
  | 'FAILED'
  | 'BLOCKED'
  | 'PARTIAL'
  | 'INTERRUPTED'
  | 'URGENT'
  | 'INVALID'

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
  /** PLAN-034: which parser path produced this record. */
  parseSource?: ParseSource
  /** PLAN-034: non-fatal parser warnings (missing/invalid frontmatter, drift, unknown status). */
  parseWarnings?: ParseWarning[]
}

const STATUS_VALUES = new Set<WorkOrderStatus>([
  'PENDING', 'IN_PROGRESS', 'DONE', 'FIXED', 'FAILED', 'BLOCKED', 'PARTIAL', 'INTERRUPTED', 'URGENT', 'INVALID',
])

const VALID_FRONTMATTER_STATUSES = new Set<WorkOrderStatus>([
  'PENDING', 'IN_PROGRESS', 'DONE', 'FIXED', 'FAILED', 'BLOCKED', 'PARTIAL', 'INTERRUPTED', 'URGENT',
])

/**
 * 從工單 .md 內容解析 metadata
 *
 * 解析順序：
 *   1. YAML frontmatter (schema_version: 1, schema_kind: workorder) — SoT
 *   2. Fallback: legacy markdown table / bullet list grep
 *
 * 容錯設計：欄位缺失不報錯，返回 partial data
 *
 * Frontmatter status 僅接受 spec 定義的 9 個 enum；invalid value 標記為
 * 'INVALID'，**絕不** fallback 為 'PENDING'（BUG-077 regression guard）。
 */
export function parseWorkOrder(filename: string, content: string): WorkOrder {
  const { raw: fmRaw, body } = extractFrontmatterBlock(content)
  const warnings: ParseWarning[] = []

  // ─── Path A: frontmatter present ────────────────────────────────────────
  if (fmRaw != null) {
    const { data: fm, warning } = parseFrontmatterYaml<CtWorkorderFrontmatterV1>(fmRaw, 'workorder')

    if (fm) {
      // Validate status enum — INVALID rather than PENDING when unknown.
      const rawStatus = (fm.status ?? '').toString().trim().toUpperCase()
      const status: WorkOrderStatus = VALID_FRONTMATTER_STATUSES.has(rawStatus as WorkOrderStatus)
        ? (rawStatus as WorkOrderStatus)
        : 'INVALID'

      if (status === 'INVALID') {
        warnings.push({
          kind: 'unknown_status',
          field: 'status',
          frontmatter_value: fm.status,
          detail: `unknown frontmatter status ${JSON.stringify(fm.status)}`,
        })
      }

      // Drift detection: compare frontmatter vs body table value (warning only).
      const bodyStatus = extractFieldFromBody(body, '狀態')
      const drift = detectStatusDrift(fm.status, bodyStatus)
      if (drift) warnings.push(drift)

      return {
        id: fm.id || filenameToId(filename),
        filename,
        title: fm.title ?? filenameToTitle(filename),
        status,
        createdAt: fm.created_at ?? '',
        startedAt: fm.started_at,
        completedAt: fm.completed_at,
        estimatedSize: fm.sizing,
        contextRisk: undefined,
        targetSubproject: fm.project,
        parseSource: 'frontmatter',
        parseWarnings: warnings.length > 0 ? warnings : undefined,
      }
    }

    // Frontmatter present but invalid — fall through to legacy parser, but
    // attach the warning so the panel can surface it.
    if (warning) warnings.push(warning)
  } else {
    warnings.push({ kind: 'missing_frontmatter' })
  }

  // ─── Path B: legacy markdown fallback ──────────────────────────────────
  const legacy = parseWorkOrderLegacy(filename, body)
  return {
    ...legacy,
    parseSource: 'legacy_markdown',
    parseWarnings: warnings.length > 0 ? warnings : undefined,
  }
}

// ─── Legacy parser (unchanged behaviour from pre-PLAN-034) ─────────────────

function parseWorkOrderLegacy(filename: string, content: string): WorkOrder {
  const id = extractFieldFromBody(content, '工單編號') ?? filenameToId(filename)
  const title = extractFieldFromBody(content, '任務名稱') ?? extractFieldFromBody(content, '標題') ?? filenameToTitle(filename)

  // Prefer markdown form, fall back to bare YAML-ish line.
  const rawMarkdownStatus = extractFieldFromBody(content, '狀態')
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
    createdAt: extractFieldFromBody(content, '建立時間') ?? '',
    startedAt: extractFieldFromBody(content, '開始時間'),
    completedAt: extractFieldFromBody(content, '完成時間'),
    estimatedSize: extractFieldFromBody(content, '預估規模'),
    contextRisk: extractFieldFromBody(content, 'Context Window 風險'),
    targetSubproject: extractFieldFromBody(content, '目標子專案'),
  }
}

/**
 * 支援多種欄位格式：
 *   - 列表：- **欄位**：值 / - 欄位：值
 *   - 表格：| **欄位** | 值 | / | 欄位 | 值 |
 *   - bold-only：**欄位**：值
 */
function extractFieldFromBody(content: string, label: string): string | undefined {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const listRegex = new RegExp(`^-\\s+\\*{0,2}${escaped}\\*{0,2}[：:]\\s*(.+)`, 'm')
  const listMatch = content.match(listRegex)
  if (listMatch) return listMatch[1]?.trim()

  const tableRegex = new RegExp(`\\|\\s*\\*{0,2}${escaped}\\*{0,2}\\s*\\|\\s*(.+?)\\s*\\|`, 'm')
  const tableMatch = content.match(tableRegex)
  if (tableMatch) return tableMatch[1]?.trim()

  const boldRegex = new RegExp(`\\*\\*${escaped}\\*\\*[：:]\\s*(.+)`, 'm')
  const boldMatch = content.match(boldRegex)
  return boldMatch?.[1]?.trim()
}

/** 從 raw 字串中提取第一個有效狀態關鍵字，忽略括號附加文字 */
function extractStatusKeyword(raw: string | undefined): WorkOrderStatus | undefined {
  if (!raw) return undefined
  const keyword = raw.toUpperCase().match(/^[^A-Z]*(DONE|FIXED|IN_PROGRESS|PENDING|BLOCKED|PARTIAL|INTERRUPTED|FAILED|URGENT)/)?.[1]
  return keyword && STATUS_VALUES.has(keyword as WorkOrderStatus) ? keyword as WorkOrderStatus : undefined
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
    case 'FIXED': return 'ct-status-fixed'
    case 'FAILED': return 'ct-status-failed'
    case 'BLOCKED': return 'ct-status-blocked'
    case 'PARTIAL': return 'ct-status-partial'
    case 'INTERRUPTED': return 'ct-status-interrupted'
    case 'URGENT': return 'ct-status-urgent'
    case 'INVALID': return 'ct-status-invalid'
    default: return 'ct-status-pending'
  }
}

/** 狀態 badge 文字 */
export function statusLabel(status: WorkOrderStatus): string {
  switch (status) {
    case 'PENDING': return '⏳ Pending'
    case 'IN_PROGRESS': return '🔄 In Progress'
    case 'DONE': return '✅ Done'
    case 'FIXED': return '✅ Fixed'
    case 'FAILED': return '❌ Failed'
    case 'BLOCKED': return '🚫 Blocked'
    case 'PARTIAL': return '⚠️ Partial'
    case 'INTERRUPTED': return '⏸️ Interrupted'
    case 'URGENT': return '🔥 Urgent'
    case 'INVALID': return '⚠️ Invalid'
    default: return status
  }
}
