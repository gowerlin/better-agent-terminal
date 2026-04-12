/**
 * Generic Markdown table parser
 * Handles standard pipe-delimited tables with potential emoji in headers and values
 *
 * Supports:
 *   - Single and multiple tables in a content block
 *   - Headers with emoji (e.g., 🔴 High, 🧪 VERIFY)
 *   - Full-width and half-width characters in cells
 *   - Separator lines (|---|---|)
 */

export type TableRow = Record<string, string>

/**
 * Parse all table rows from a Markdown content block.
 * When multiple tables are present, rows from all tables are combined.
 * Returns rows as key-value records with header column names as keys.
 *
 * @param content - Markdown content containing one or more pipe tables
 * @returns Array of row objects keyed by column header names
 */
export function parseMdTable(content: string): TableRow[] {
  const allRows: TableRow[] = []
  const lines = content.split('\n')

  let headers: string[] = []
  let hasSeparator = false

  for (const line of lines) {
    const trimmed = line.trim()

    if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) {
      // Leaving a table block — reset state for next potential table
      if (hasSeparator) {
        headers = []
        hasSeparator = false
      }
      continue
    }

    // Split on | and strip outer empty cells, trim whitespace from each cell
    const cells = trimmed
      .split('|')
      .slice(1, -1)
      .map(c => c.trim())

    if (cells.length === 0) continue

    // Detect separator row: cells contain only dashes, colons, and spaces
    // e.g. |---|---| or |:--|--:|
    const isSeparator = cells.every(c => /^[-: ]+$/.test(c))

    if (isSeparator) {
      hasSeparator = true
      continue
    }

    if (!hasSeparator) {
      // Header row appears before the separator line
      headers = cells
      continue
    }

    // Data row: map cells to headers
    if (headers.length === 0) continue

    const row: TableRow = {}
    for (let i = 0; i < headers.length; i++) {
      row[headers[i]] = cells[i] ?? ''
    }
    allRows.push(row)
  }

  return allRows
}
