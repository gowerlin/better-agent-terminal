/**
 * Decision Log types and parser for _ct-workorders/_decision-log.md
 * Parses the decisions index table into structured DecisionEntry objects.
 * Supports both v3 (manual migration) and v4 (auto-generated) formats.
 *
 * Type definitions only — component implementation in T0068.
 * Note: _decision-log.md is a single file (no individual per-decision files).
 */

import { parseMdTable } from '../utils/md-table-parser'

export interface DecisionEntry {
  /** Decision identifier, e.g. 'D029' */
  id: string
  /** Decision date, e.g. '2026-04-12' */
  date: string
  /** Decision title / summary */
  title: string
  /** Related work order ID, e.g. 'T0065' */
  relatedWorkOrder?: string
}

// ─── Parser ─────────────────────────────────────────────────────────────────

/**
 * Parse _decision-log.md content into an array of DecisionEntry.
 * Supports two formats:
 *   v3: index table with columns ID | 日期 | 標題 | 相關工單
 *       headings like ### D031 2026-04-13 — Title
 *   v4: index table with columns ID | 時間 | 摘要 | 背景
 *       headings like ## D001：Title
 * Falls back to heading-based extraction when the table yields no results.
 */
export function parseDecisionLog(content: string): DecisionEntry[] {
  // 1. Try parsing from the index table first
  const entries = parseFromTable(content)
  if (entries.length > 0) return entries

  // 2. Fallback: extract from heading lines
  return parseFromHeadings(content)
}

/** Parse decision entries from the Markdown index table. */
function parseFromTable(content: string): DecisionEntry[] {
  const entries: DecisionEntry[] = []
  const rows = parseMdTable(content)

  for (const row of rows) {
    const id = (row['ID'] ?? row['編號'])?.trim()
    if (!id) continue

    // v3: 日期/Date    v4: 時間
    const date = (row['日期'] ?? row['Date'] ?? row['時間'])?.trim() ?? ''
    // v3: 標題/決策/Title    v4: 摘要
    const title = (row['標題'] ?? row['決策'] ?? row['Title'] ?? row['摘要'])?.trim() ?? ''
    const relatedWorkOrder = (row['相關工單'] ?? row['工單'] ?? row['Related WO'])?.trim() || undefined

    entries.push({ id, date, title, relatedWorkOrder })
  }

  return entries
}

/**
 * Fallback parser: extract decision entries from heading lines.
 * Matches:
 *   v3: ### D031 2026-04-13 — Title
 *   v4: ## D001：Title  (date extracted from body **時間**：...)
 */
function parseFromHeadings(content: string): DecisionEntry[] {
  const entries: DecisionEntry[] = []
  const lines = content.split('\n')

  // v3 heading: ### D### YYYY-MM-DD — Title
  const v3Pattern = /^#{2,3}\s+(D\d+)\s+(\d{4}-\d{2}-\d{2})\s*[—–-]\s*(.+)/
  // v4 heading: ## D###：Title  or ## D###: Title
  const v4Pattern = /^#{2,3}\s+(D\d+)[：:]\s*(.+)/

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    const v3Match = v3Pattern.exec(line)
    if (v3Match) {
      entries.push({
        id: v3Match[1],
        date: v3Match[2],
        title: v3Match[3].trim(),
      })
      continue
    }

    const v4Match = v4Pattern.exec(line)
    if (v4Match) {
      // Try to extract date from body lines below
      const date = extractDateFromBody(lines, i + 1)
      entries.push({
        id: v4Match[1],
        date,
        title: v4Match[2].trim(),
      })
    }
  }

  return entries
}

/** Scan body lines after a heading to find **時間**：... or **日期**：... */
function extractDateFromBody(lines: string[], startIdx: number): string {
  const dateFieldPattern = /^\*\*(?:時間|日期|Date)\*\*[：:]\s*(.+)/
  for (let i = startIdx; i < lines.length && i < startIdx + 10; i++) {
    const trimmed = lines[i].trim()
    // Stop at the next heading
    if (/^#{1,3}\s/.test(trimmed)) break
    const match = dateFieldPattern.exec(trimmed)
    if (match) return match[1].trim()
  }
  return ''
}
