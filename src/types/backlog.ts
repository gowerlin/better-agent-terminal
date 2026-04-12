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

function sectionToStatus(heading: string): PlanStatus {
  const h = heading.toUpperCase()
  if (h.includes('DONE') || h.includes('已完成')) return 'DONE'
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
