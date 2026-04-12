/**
 * Decision Log types and parser for _ct-workorders/_decision-log.md
 * Parses the decisions index table into structured DecisionEntry objects.
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
 * Looks for a Markdown table with ID, 日期/Date, 標題, 相關工單 columns.
 */
export function parseDecisionLog(content: string): DecisionEntry[] {
  const entries: DecisionEntry[] = []

  // Parse all tables; decision log typically has a single index table
  const rows = parseMdTable(content)

  for (const row of rows) {
    // Support both English and Chinese column names
    const id = (row['ID'] ?? row['編號'])?.trim()
    if (!id) continue

    const date = (row['日期'] ?? row['Date'])?.trim() ?? ''
    const title = (row['標題'] ?? row['決策'] ?? row['Title'])?.trim() ?? ''
    const relatedWorkOrder = (row['相關工單'] ?? row['工單'] ?? row['Related WO'])?.trim() || undefined

    entries.push({
      id,
      date,
      title,
      relatedWorkOrder,
    })
  }

  return entries
}
