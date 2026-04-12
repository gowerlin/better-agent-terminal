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
  | 'OPEN'    // 🔴 Open / 處理中 section
  | 'VERIFY'  // 🧪 驗收中 section
  | 'FIXED'   // ✅ 已修復 section
  | 'CLOSED'  // 🚫 已關閉 / WONTFIX section

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
 * Headings like '🔴 Open / 處理中', '🧪 驗收中 (VERIFY)', '✅ 已修復', '🚫 已關閉 / WONTFIX'
 */
function sectionToStatus(heading: string): BugStatus {
  if (heading.includes('VERIFY') || heading.includes('驗收')) return 'VERIFY'
  if (heading.includes('FIXED') || heading.includes('已修復')) return 'FIXED'
  if (heading.includes('CLOSED') || heading.includes('已關閉') || heading.includes('WONTFIX')) return 'CLOSED'
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
    case 'OPEN':   return 'ct-bug-status-open'
    case 'VERIFY': return 'ct-bug-status-verify'
    case 'FIXED':  return 'ct-bug-status-fixed'
    case 'CLOSED': return 'ct-bug-status-closed'
  }
}

/** Status badge display label */
export function bugStatusLabel(status: BugStatus): string {
  switch (status) {
    case 'OPEN':   return '🔴 Open'
    case 'VERIFY': return '🧪 Verify'
    case 'FIXED':  return '✅ Fixed'
    case 'CLOSED': return '🚫 Closed'
  }
}
