/**
 * Backlog (PLAN) types and parser for _ct-workorders/_backlog.md
 * Parses Markdown index tables into structured BacklogEntry objects.
 *
 * Type definitions only — component implementation in T0068.
 */

import { parseMdTable } from '../utils/md-table-parser'

export type PlanPriority = 'High' | 'Medium' | 'Low' | 'Unknown'

export type PlanStatus =
  | 'IDEA'        // Idea / 想法
  | 'PLANNED'     // Planned / 已規劃
  | 'IN_PROGRESS' // In Progress / 進行中
  | 'DONE'        // Done / 已完成
  | 'DROPPED'     // Dropped / 已放棄

export interface BacklogEntry {
  /** PLAN identifier, e.g. 'PLAN-001' */
  id: string
  /** Filename only, e.g. 'PLAN-001-some-feature.md' */
  filename: string
  /** Plan title */
  title: string
  /** Priority level */
  priority: PlanPriority
  /** Status from section grouping */
  status: PlanStatus
  /** Date string from 建立時間 or 時間 column */
  createdAt: string
  /** True when linkPath contains '_archive/' */
  isArchived: boolean
  /** Relative path from _ct-workorders/ for readFile calls */
  linkPath: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function extractLinkPath(cell: string): string {
  const match = cell.match(/\[.*?\]\((.+?)\)/)
  return match?.[1]?.trim() ?? ''
}

function extractPriority(cell: string): PlanPriority {
  const upper = cell.toUpperCase()
  if (upper.includes('HIGH')) return 'High'
  if (upper.includes('MEDIUM')) return 'Medium'
  if (upper.includes('LOW')) return 'Low'
  return 'Unknown'
}

/**
 * Extract priority from a PLAN file's metadata block.
 * Supports two layouts used across historical PLAN files:
 *   1. Bullet list:    `- **優先級**：🔴 High` / `**Priority**: Medium`
 *   2. Markdown table: `| **優先級** | 🟢 Low |` / `| **Priority** | Medium |`
 * Used as fallback when _backlog.md row lacks 優先級 column (e.g. Completed table).
 * BUG-045 (parser face): table format silently returned 'Unknown' before T0195.
 */
export function extractPriorityFromPlanContent(content: string): PlanPriority {
  // Bullet list form: exclude `|` from capture to avoid swallowing table rows.
  const bulletMatch = content.match(/(?:優先級|Priority)[^\n|]*?[:：]\s*([^\n|]+)/i)
  if (bulletMatch) {
    const p = extractPriority(bulletMatch[1])
    if (p !== 'Unknown') return p
  }

  // Markdown table cell form: `| (**)?優先級(**)? | <value> |`.
  const tableMatch = content.match(/\|\s*\*?\*?\s*(?:優先級|Priority)\s*\*?\*?\s*\|\s*([^|\n]+?)\s*\|/i)
  if (tableMatch) {
    const p = extractPriority(tableMatch[1])
    if (p !== 'Unknown') return p
  }

  return 'Unknown'
}

function sectionToStatus(heading: string): PlanStatus {
  const h = heading.toUpperCase()
  if (h.includes('DONE') || h.includes('COMPLETED') || h.includes('已完成')) return 'DONE'
  if (h.includes('DROPPED') || h.includes('已放棄')) return 'DROPPED'
  if (h.includes('IN_PROGRESS') || h.includes('進行中')) return 'IN_PROGRESS'
  if (h.includes('PLANNED') || h.includes('已規劃')) return 'PLANNED'
  return 'IDEA'
}

/** Parse status from an individual row's 狀態 cell (overrides section heading). */
function rowStatusToStatus(cell: string): PlanStatus | null {
  const u = cell.toUpperCase()
  // Check more specific statuses before IDEA to avoid false matches
  if (u.includes('IN_PROGRESS') || u.includes('進行中') || u.includes('🔄')) return 'IN_PROGRESS'
  if (u.includes('PLANNED') || u.includes('已規劃') || u.includes('📋')) return 'PLANNED'
  if (u.includes('DONE') || u.includes('已完成') || u.includes('✅')) return 'DONE'
  if (u.includes('DROPPED') || u.includes('已放棄') || u.includes('🚫')) return 'DROPPED'
  if (u.includes('IDEA') || u.includes('💡')) return 'IDEA'
  return null
}

// ─── Parser ─────────────────────────────────────────────────────────────────

/**
 * Parse _backlog.md content into an array of BacklogEntry.
 */
export function parseBacklog(content: string): BacklogEntry[] {
  const entries: BacklogEntry[] = []

  const sectionParts = content.split(/(?=^## )/m)

  for (const part of sectionParts) {
    const firstNewline = part.indexOf('\n')
    if (firstNewline === -1) continue

    const headingLine = part.substring(0, firstNewline).trim()
    if (!headingLine.startsWith('#')) continue

    const heading = headingLine.replace(/^#+\s*/, '').trim()
    const sectionContent = part.substring(firstNewline + 1)
    const sectionStatus = sectionToStatus(heading)

    const rows = parseMdTable(sectionContent)

    for (const row of rows) {
      const id = row['ID']?.trim()
      if (!id || !id.startsWith('PLAN-')) continue

      const title = row['標題']?.trim() ?? ''
      const priority = extractPriority(row['優先級']?.trim() ?? '')

      const linkCell = row['連結']?.trim() ?? ''
      const linkPath = extractLinkPath(linkCell)
      const isArchived = linkPath.includes('_archive/')
      const filename = linkPath.split('/').pop() ?? linkPath

      const createdAt = row['建立時間']?.trim() ?? row['提出時間']?.trim() ?? row['時間']?.trim() ?? ''

      // Row-level 狀態 column overrides section heading (Active section mixes multiple statuses)
      const statusCell = row['狀態']?.trim() ?? ''
      const rowStatus = statusCell ? rowStatusToStatus(statusCell) : null
      const status = rowStatus ?? sectionStatus

      entries.push({
        id,
        filename,
        title,
        priority,
        status,
        createdAt,
        isArchived,
        linkPath,
      })
    }
  }

  return entries
}

// ─── Single-file parser (for archived entries) ─────────────────────────────

/** Map raw status text (cell / bullet value) to PlanStatus. */
function mapPlanStatusText(raw: string): PlanStatus | null {
  const u = raw.toUpperCase()
  if (u.includes('IN_PROGRESS') || u.includes('進行中') || u.includes('🔄')) return 'IN_PROGRESS'
  if (u.includes('PLANNED') || u.includes('已規劃') || u.includes('📋')) return 'PLANNED'
  if (u.includes('DROPPED') || u.includes('已放棄') || u.includes('🚫')) return 'DROPPED'
  if (u.includes('DONE') || u.includes('COMPLETED') || u.includes('已完成') || u.includes('✅')) return 'DONE'
  if (u.includes('IDEA') || u.includes('💡')) return 'IDEA'
  return null
}

/**
 * Extract a metadata field from a PLAN file's content.
 * Supports both bullet and markdown table layouts.
 */
function extractPlanField(content: string, labels: string[]): string | null {
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const bulletRe = new RegExp(`[-*]\\s*\\*?\\*?\\s*${escaped}\\s*\\*?\\*?\\s*[:：]\\s*([^\\n|]+)`, 'i')
    const bulletMatch = content.match(bulletRe)
    if (bulletMatch) {
      const v = bulletMatch[1].trim()
      if (v) return v
    }
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
 * Parse a single archived PLAN-*.md file into a BacklogEntry.
 *
 * Handles header formats:
 *   # PLAN-### — Title
 *   # 📋 PLAN-###：Title
 *   # 💡 PLAN-###：Title
 *   # PLAN-###-kebab-case-title
 *
 * Priority via `extractPriorityFromPlanContent` (bullet + table tolerant).
 * Always sets `isArchived: true`. Returns null on parse failure.
 */
export function parsePlanFile(content: string, linkPath: string): BacklogEntry | null {
  try {
    // Match first line starting with '# ... PLAN-\d+'
    const headerRe = /^#\s*(?:[^\w\s]+\s*)?(PLAN-\d+)\s*(?:[—\-:：]\s*)?(.*)$/m
    const headerMatch = content.match(headerRe)
    if (!headerMatch) return null

    const id = headerMatch[1]
    let title = headerMatch[2].trim()

    // Fall back to 標題 metadata field when header is kebab-case (e.g. PLAN-010-upstream-sync-...)
    const titleField = extractPlanField(content, ['標題', 'Title'])
    if (titleField) {
      title = titleField
    } else if (!title || /^[a-z0-9-]+$/.test(title)) {
      // Header was kebab slug with no separator — humanize it
      title = title.replace(/-/g, ' ')
    }

    const priority = extractPriorityFromPlanContent(content)

    const statusRaw = extractPlanField(content, ['狀態', 'Status']) ?? ''
    const status: PlanStatus = mapPlanStatusText(statusRaw) ?? 'DONE' // archived defaults to DONE

    const createdAt =
      extractPlanField(content, ['完成時間', '取消日期', '建立時間', '提出時間', '登記時間', '時間']) ?? ''

    const filename = linkPath.split('/').pop() ?? linkPath

    return {
      id,
      filename,
      title,
      priority,
      status,
      createdAt,
      isArchived: true,
      linkPath,
    }
  } catch (err) {
    console.warn('[parsePlanFile] failed for', linkPath, err)
    return null
  }
}

// ─── Display helpers ─────────────────────────────────────────────────────────

export function planStatusColor(status: PlanStatus): string {
  switch (status) {
    case 'IDEA':        return 'ct-plan-status-idea'
    case 'PLANNED':     return 'ct-plan-status-planned'
    case 'IN_PROGRESS': return 'ct-plan-status-in-progress'
    case 'DONE':        return 'ct-plan-status-done'
    case 'DROPPED':     return 'ct-plan-status-dropped'
  }
}

export function planStatusLabel(status: PlanStatus): string {
  switch (status) {
    case 'IDEA':        return '💡 Idea'
    case 'PLANNED':     return '📋 Planned'
    case 'IN_PROGRESS': return '🔄 In Progress'
    case 'DONE':        return '✅ Done'
    case 'DROPPED':     return '🚫 Dropped'
  }
}
