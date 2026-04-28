/**
 * Backlog (PLAN) types and parser for _ct-workorders/_backlog.md
 * Parses Markdown index tables into structured BacklogEntry objects.
 *
 * Type definitions only — component implementation in T0068.
 */

import { parseMdTable } from '../utils/md-table-parser'
import {
  extractFrontmatterBlock,
  parseFrontmatterYaml,
  detectStatusDrift,
  type ParseSource,
  type ParseWarning,
  type CtPlanFrontmatterV1,
  type CtIndexFrontmatterV1,
} from '../utils/ct-frontmatter'

const VALID_PLAN_FM_STATUSES = new Set<string>([
  'IDEA', 'PLANNED', 'IN_PROGRESS', 'DONE', 'DROPPED',
])

function priorityFromFmEnum(raw: string | undefined): PlanPriority {
  if (!raw) return 'Unknown'
  const v = raw.toLowerCase()
  if (v === 'critical' || v === 'high') return 'High'
  if (v === 'medium') return 'Medium'
  if (v === 'low') return 'Low'
  return 'Unknown'
}

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
  /** PLAN-034: parser path */
  parseSource?: ParseSource
  /** PLAN-034: non-fatal warnings */
  parseWarnings?: ParseWarning[]
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

  // PLAN-034: strip frontmatter so it never bleeds into the section walker.
  const { body } = extractFrontmatterBlock(content)

  const sectionParts = body.split(/(?=^## )/m)

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
    const isArchived = linkPath.includes('_archive/')
    const filename = linkPath.split('/').pop() ?? linkPath
    const { raw: fmRaw, body } = extractFrontmatterBlock(content)
    const warnings: ParseWarning[] = []

    // ─── Frontmatter-first path ──────────────────────────────────────────
    if (fmRaw != null) {
      const { data: fm, warning } = parseFrontmatterYaml<CtPlanFrontmatterV1>(fmRaw, 'plan')
      if (fm) {
        const rawStatus = (fm.status ?? '').toString().trim().toUpperCase()
        const isValidFmStatus = VALID_PLAN_FM_STATUSES.has(rawStatus)

        if (!isValidFmStatus) {
          warnings.push({
            kind: 'unknown_status',
            field: 'status',
            frontmatter_value: fm.status,
            detail: `unknown plan frontmatter status ${JSON.stringify(fm.status)}`,
          })
        }

        const bodyStatusRaw = extractPlanField(body, ['狀態', 'Status']) ?? undefined
        const drift = detectStatusDrift(fm.status, bodyStatusRaw)
        if (drift) warnings.push(drift)

        // Spec: unknown status → never PENDING / never IDEA bucket; archived
        // plans default to DONE so panel still groups them.
        const status: PlanStatus = isValidFmStatus
          ? (rawStatus as PlanStatus)
          : (isArchived ? 'DONE' : 'IDEA')

        const priority = fm.priority
          ? priorityFromFmEnum(fm.priority)
          : extractPriorityFromPlanContent(body)

        return {
          id: fm.id || 'PLAN-???',
          filename,
          title: fm.title ?? '',
          priority,
          status,
          createdAt: fm.created_at ?? '',
          isArchived,
          linkPath,
          parseSource: 'frontmatter',
          parseWarnings: warnings.length > 0 ? warnings : undefined,
        }
      }
      if (warning) warnings.push(warning)
    } else {
      warnings.push({ kind: 'missing_frontmatter' })
    }

    // ─── Legacy markdown fallback (unchanged behaviour) ──────────────────
    // Match first line starting with '# ... PLAN-\d+'
    const headerRe = /^#\s*(?:[^\w\s]+\s*)?(PLAN-\d+)\s*(?:[—\-:：]\s*)?(.*)$/m
    const headerMatch = body.match(headerRe)
    if (!headerMatch) return null

    const id = headerMatch[1]
    let title = headerMatch[2].trim()

    const titleField = extractPlanField(body, ['標題', 'Title'])
    if (titleField) {
      title = titleField
    } else if (!title || /^[a-z0-9-]+$/.test(title)) {
      title = title.replace(/-/g, ' ')
    }

    const priority = extractPriorityFromPlanContent(body)

    const statusRaw = extractPlanField(body, ['狀態', 'Status']) ?? ''
    const status: PlanStatus = mapPlanStatusText(statusRaw) ?? (isArchived ? 'DONE' : 'IDEA')

    const createdAt =
      extractPlanField(body, ['完成時間', '取消日期', '建立時間', '提出時間', '登記時間', '時間']) ?? ''

    return {
      id,
      filename,
      title,
      priority,
      status,
      createdAt,
      isArchived,
      linkPath,
      parseSource: 'legacy_markdown',
      parseWarnings: warnings.length > 0 ? warnings : undefined,
    }
  } catch (err) {
    console.warn('[parsePlanFile] failed for', linkPath, err)
    return null
  }
}

// ─── Index frontmatter parser (PLAN-034 Sprint 3) ──────────────────────────

export interface BacklogStats {
  total: number
  breakdown: Partial<Record<PlanStatus, number>>
  source: ParseSource
  warnings: ParseWarning[]
}

/**
 * Read `_backlog.md` index frontmatter for stats panel (O(1)).
 * Falls back to deriving counts from `parseBacklog()` entries when
 * frontmatter is missing or invalid.
 */
export function parseBacklogStats(content: string): BacklogStats {
  const { raw: fmRaw } = extractFrontmatterBlock(content)
  const warnings: ParseWarning[] = []

  if (fmRaw != null) {
    const { data: fm, warning } = parseFrontmatterYaml<CtIndexFrontmatterV1>(fmRaw, 'index')
    if (fm) {
      const breakdown: Partial<Record<PlanStatus, number>> = {}
      for (const [k, v] of Object.entries(fm.breakdown ?? {})) {
        const key = k.toUpperCase() as PlanStatus
        if (VALID_PLAN_FM_STATUSES.has(key) && typeof v === 'number') {
          breakdown[key] = v
        }
      }
      const sum = Object.values(breakdown).reduce<number>((a, b) => a + (b ?? 0), 0)
      const total = typeof fm.total === 'number' ? fm.total : sum
      if (total !== sum) {
        warnings.push({
          kind: 'metadata_drift',
          field: 'total',
          frontmatter_value: String(total),
          detail: `breakdown sum (${sum}) ≠ total (${total}); breakdown wins per spec`,
        })
      }
      return { total: sum, breakdown, source: 'frontmatter', warnings }
    }
    if (warning) warnings.push(warning)
  } else {
    warnings.push({ kind: 'missing_frontmatter' })
  }

  // Legacy fallback: derive from body entries.
  const entries = parseBacklog(content)
  const breakdown: Partial<Record<PlanStatus, number>> = {}
  for (const e of entries) {
    breakdown[e.status] = (breakdown[e.status] ?? 0) + 1
  }
  return { total: entries.length, breakdown, source: 'legacy_markdown', warnings }
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
