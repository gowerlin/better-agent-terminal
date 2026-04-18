/**
 * Bug Tracker types and parser for _ct-workorders/_bug-tracker.md
 * Parses Markdown index tables into structured BugEntry objects.
 *
 * Index strategy: reads summary tables from _bug-tracker.md
 * Detail content: loaded on-demand via readFile for individual BUG-*.md files
 */

import { parseMdTable } from '../utils/md-table-parser'

export type BugSeverity = 'High' | 'Medium' | 'Low' | 'Unknown'

export type BugStatus =
  | 'OPEN'    // 🔴 Open / 待處理 section
  | 'FIXING'  // ⏳ 修復中 section
  | 'FIXED'   // ✅ 已修復 section
  | 'VERIFY'  // 🧪 驗收中 section
  | 'CLOSED'  // 🚫 已關閉 section
  | 'WONTFIX' // 🚫 不修復

export interface BugEntry {
  /** BUG identifier, e.g. 'BUG-001' */
  id: string
  /** Filename only, e.g. 'BUG-001-claude-oauth-paste-truncated.md' */
  filename: string
  /** Bug title */
  title: string
  /** Severity level */
  severity: BugSeverity
  /** High-level status from section grouping */
  status: BugStatus
  /** Date string from 報修時間 or 關閉時間 column */
  reportedAt: string
  /** Related work order ID, e.g. 'T0006' */
  relatedWorkOrder?: string
  /** True when linkPath contains '_archive/' */
  isArchived: boolean
  /** Relative path from _ct-workorders/ for readFile calls */
  linkPath: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Extract markdown link target: [text](path) → path */
function extractLinkPath(cell: string): string {
  const match = cell.match(/\[.*?\]\((.+?)\)/)
  return match?.[1]?.trim() ?? ''
}

/** Extract severity from cell content which may contain emoji */
function extractSeverity(cell: string): BugSeverity {
  const upper = cell.toUpperCase()
  if (upper.includes('HIGH')) return 'High'
  if (upper.includes('MEDIUM')) return 'Medium'
  if (upper.includes('LOW')) return 'Low'
  return 'Unknown'
}

/**
 * Determine BugStatus from section heading text.
 *
 * Matching strategy: check for compound headings first (e.g. heading
 * contains both '已關閉' and 'WONTFIX') to avoid misclassification,
 * then fall back to single-keyword matching.
 *
 * Expected headings:
 *   '🔴 Open / 處理中'
 *   '⏳ 修復中 (FIXING)'
 *   '✅ 已修復'  or  '✅ 已修復 (FIXED)'
 *   '🧪 驗收中 (VERIFY)'
 *   '🚫 已關閉'  or  '🚫 已關閉 (CLOSED)'
 *   '⛔ 不修復 (WONTFIX)'
 *
 * Tolerant: also handles legacy combined heading '🚫 已關閉 / WONTFIX'
 * by treating it as CLOSED (the more common case).
 */
function sectionToStatus(heading: string): BugStatus {
  const hasWontfix = heading.includes('WONTFIX') || heading.includes('不修復')
  const hasClosed  = heading.includes('CLOSED')  || heading.includes('已關閉')

  // Compound heading (legacy): '已關閉 / WONTFIX' → prefer CLOSED
  // Standalone WONTFIX section: '不修復 (WONTFIX)' without '已關閉' → WONTFIX
  if (hasWontfix && !hasClosed) return 'WONTFIX'
  if (hasClosed)  return 'CLOSED'

  if (heading.includes('VERIFY')  || heading.includes('驗收'))  return 'VERIFY'
  if (heading.includes('FIXED')   || heading.includes('已修復')) return 'FIXED'
  if (heading.includes('FIXING')  || heading.includes('修復中')) return 'FIXING'
  return 'OPEN'
}

// ─── Parser ─────────────────────────────────────────────────────────────────

/**
 * Parse _bug-tracker.md content into an array of BugEntry.
 * Splits by ## section headers, maps each section to a BugStatus,
 * then parses the Markdown table within each section.
 */
export function parseBugTracker(content: string): BugEntry[] {
  const entries: BugEntry[] = []

  // Split content before each ## heading (lookahead, doesn't consume)
  const sectionParts = content.split(/(?=^## )/m)

  for (const part of sectionParts) {
    const firstNewline = part.indexOf('\n')
    if (firstNewline === -1) continue

    const headingLine = part.substring(0, firstNewline).trim()
    if (!headingLine.startsWith('#')) continue

    const heading = headingLine.replace(/^#+\s*/, '').trim()
    const sectionContent = part.substring(firstNewline + 1)
    const status = sectionToStatus(heading)

    const rows = parseMdTable(sectionContent)

    for (const row of rows) {
      const id = row['ID']?.trim()
      if (!id || !id.startsWith('BUG-')) continue

      const title = row['標題']?.trim() ?? ''
      const severity = extractSeverity(row['嚴重度']?.trim() ?? '')

      const linkCell = row['連結']?.trim() ?? ''
      const linkPath = extractLinkPath(linkCell)
      const isArchived = linkPath.includes('_archive/')
      const filename = linkPath.split('/').pop() ?? linkPath

      // Date: Open section has 報修時間, Closed section has 關閉時間
      const reportedAt = row['報修時間']?.trim() ?? row['關閉時間']?.trim() ?? ''

      // Related work order: present in VERIFY and FIXED sections
      const relatedWorkOrder = row['修復工單']?.trim() || row['相關工單']?.trim() || undefined

      entries.push({
        id,
        filename,
        title,
        severity,
        status,
        reportedAt,
        relatedWorkOrder,
        isArchived,
        linkPath,
      })
    }
  }

  return entries
}

// ─── Single-file parser (for archived entries) ─────────────────────────────

/** Extract status keyword from raw cell/value and map to BugStatus. */
function mapStatusText(raw: string): BugStatus | null {
  const u = raw.toUpperCase()
  // Compound check first
  const hasWontfix = u.includes('WONTFIX') || u.includes('不修復')
  const hasClosed = u.includes('CLOSED') || u.includes('已關閉')
  if (hasWontfix && !hasClosed) return 'WONTFIX'
  if (hasClosed) return 'CLOSED'
  if (u.includes('VERIFY') || u.includes('驗收')) return 'VERIFY'
  if (u.includes('FIXED') || u.includes('已修復')) return 'FIXED'
  if (u.includes('FIXING') || u.includes('修復中')) return 'FIXING'
  if (u.includes('OPEN') || u.includes('待處理') || u.includes('處理中')) return 'OPEN'
  return null
}

/**
 * Extract a metadata field from an archived BUG file's content.
 * Supports both bullet (`- **欄位**：值` / `- **欄位**: 值`) and
 * markdown table (`| **欄位** | 值 |`) layouts.
 */
function extractField(content: string, labels: string[]): string | null {
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    // Bullet form (supports both : and ：, with/without bold)
    const bulletRe = new RegExp(`[-*]\\s*\\*?\\*?\\s*${escaped}\\s*\\*?\\*?\\s*[:：]\\s*([^\\n|]+)`, 'i')
    const bulletMatch = content.match(bulletRe)
    if (bulletMatch) {
      const v = bulletMatch[1].trim()
      if (v) return v
    }
    // Table form
    const tableRe = new RegExp(`\\|\\s*\\*?\\*?\\s*${escaped}\\s*\\*?\\*?\\s*\\|\\s*([^|\\n]+?)\\s*\\|`, 'i')
    const tableMatch = content.match(tableRe)
    if (tableMatch) {
      const v = tableMatch[1].trim()
      if (v) return v
    }
  }
  return null
}

/**
 * Parse a single archived BUG-*.md file into a BugEntry.
 *
 * Handles header formats:
 *   # BUG-### — Title
 *   # 🐛 BUG-###：Title    (full-width colon)
 *   # 🐛 BUG-###:Title     (half-width colon)
 *
 * Handles metadata formats:
 *   - Bullet: `- **狀態**：value` / `- **狀態**: value`
 *   - Table:  `| **狀態** | value |`
 *
 * Always sets `isArchived: true` since this parser targets `_archive/bugs/`.
 * Returns null on unrecoverable parse failure.
 */
export function parseBugFile(content: string, linkPath: string): BugEntry | null {
  try {
    // Match first line starting with '# ... BUG-\d+'
    const headerRe = /^#\s*(?:[^\w\s]+\s*)?(BUG-\d+)\s*(?:[—\-:：]\s*)?(.*)$/m
    const headerMatch = content.match(headerRe)
    if (!headerMatch) return null

    const id = headerMatch[1]
    const title = headerMatch[2].trim()

    const statusRaw = extractField(content, ['狀態', 'Status']) ?? ''
    const status: BugStatus = mapStatusText(statusRaw) ?? 'CLOSED' // archived defaults to CLOSED

    const severityRaw = extractField(content, ['嚴重度', 'Severity']) ?? ''
    const severity = extractSeverity(severityRaw)

    // Prefer closure/fix dates for archived items, fall back to report time
    const reportedAt =
      extractField(content, ['結案日期', '關閉時間', '完成時間', '修復時間', '取消日期', '報修時間']) ?? ''

    const relatedWorkOrder =
      extractField(content, ['修復工單', '相關工單']) ?? undefined

    const filename = linkPath.split('/').pop() ?? linkPath

    return {
      id,
      filename,
      title,
      severity,
      status,
      reportedAt,
      relatedWorkOrder,
      isArchived: true,
      linkPath,
    }
  } catch (err) {
    console.warn('[parseBugFile] failed for', linkPath, err)
    return null
  }
}

// ─── Display helpers ─────────────────────────────────────────────────────────

/** CSS class name for severity badge */
export function bugSeverityColor(severity: BugSeverity): string {
  switch (severity) {
    case 'High':   return 'ct-bug-severity-high'
    case 'Medium': return 'ct-bug-severity-medium'
    case 'Low':    return 'ct-bug-severity-low'
    default:       return 'ct-bug-severity-low'
  }
}

/** CSS class name for status badge */
export function bugStatusColor(status: BugStatus): string {
  switch (status) {
    case 'OPEN':    return 'ct-bug-status-open'
    case 'FIXING':  return 'ct-bug-status-fixing'
    case 'FIXED':   return 'ct-bug-status-fixed'
    case 'VERIFY':  return 'ct-bug-status-verify'
    case 'CLOSED':  return 'ct-bug-status-closed'
    case 'WONTFIX': return 'ct-bug-status-wontfix'
  }
}

/** Status badge display label */
export function bugStatusLabel(status: BugStatus): string {
  switch (status) {
    case 'OPEN':    return '🔴 Open'
    case 'FIXING':  return '⏳ Fixing'
    case 'FIXED':   return '✅ Fixed'
    case 'VERIFY':  return '🧪 Verify'
    case 'CLOSED':  return '🚫 Closed'
    case 'WONTFIX': return '🚫 Won\'t Fix'
  }
}
