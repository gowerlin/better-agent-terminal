/**
 * T0701 (D184): Control Tower panel「總覽」data — pure functions, no IO, no React.
 *
 *   - tower state: the machine-readable YAML frontmatter of `_ct-workorders/_tower-state.md`
 *     (contract v1, `docs/agent-guide/ct-tower-overview.md`); without it only the「最後更新」line
 *   - `*config`: the union of the default / global / project layers, each key with its effective
 *     value and the layer it came from (CT `tower-config.md` § 三層設定架構)
 *   - work order phase: which statuses count as open (listed in the overview) or closed
 *
 * 🔴 Read-only and no Markdown section slicing (D184): to-dos and next ids come from the
 * frontmatter summary only. The「最後更新」line (`LAST_UPDATED_LINE`) is the single text match.
 */
import yaml from 'js-yaml'
import { extractFrontmatterBlock } from '../utils/ct-frontmatter'
import type { WorkOrderStatus } from '../types/control-tower'
import { parseTowerInboxLists, type TowerInboxLists } from './tower-inbox'

// ─── Tower state summary ────────────────────────────────────────────────────

export interface TowerStateSummary {
  summaryVersion: number
  updatedAt?: string
  session?: string
  /** `next_ids` in file order; keys and values shown as written. */
  nextIds: Array<{ key: string; value: string }>
  /** `todo`, all items (the view shows the first `TOWER_STATE_TODO_LIMIT`). */
  todo: string[]
  /**
   * PLAN-068 W4 / T0906 (T0902 §3.3 / §6′): `bat_contract`, the BAT ↔ CT contract the CT writing this
   * file speaks. Set only for a whole number ≥ 1; absent (missing, not an integer) = contract v1.
   * Not tied to `summary_version` (that stays the overview's format).
   */
  batContract?: number
}

export const TOWER_STATE_TODO_LIMIT = 5

export type TowerStateParse =
  | { kind: 'summary'; summary: TowerStateSummary }
  /** No usable summary. `summaryError` is set when a frontmatter block exists but is not one. */
  | { kind: 'no-summary'; lastUpdated: string | null; summaryError?: string }

/** The one text match allowed outside the summary (D184). */
const LAST_UPDATED_LINE = /最後更新\s*[:：]\s*(.+)/

/** First「最後更新：…」line's text as written, or null. */
export function extractLastUpdatedLine(content: string): string | null {
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(LAST_UPDATED_LINE)
    const text = match?.[1]?.trim()
    if (text) return text
  }
  return null
}

/** Longest reason text kept from an error that is not a js-yaml `YAMLException`. */
const ERROR_REASON_MAX_CHARS = 120

/**
 * T0894 (BUG-217): one line for a YAML load error — js-yaml's `reason` plus the 1-based line and
 * column of its `mark`. 🔴 Never the `message`'s snippet (it quotes the file's lines) or any other
 * file content: the result goes to the debug log. `lineOffset` = lines of the file before the parsed
 * text (1 for a frontmatter block: the opening `---`), so the line is the file's.
 */
export function describeYamlError(err: unknown, lineOffset = 0): string {
  const e = err as { reason?: unknown; mark?: { line?: unknown; column?: unknown } } | null
  if (e && typeof e === 'object' && typeof e.reason === 'string') {
    const line = e.mark?.line
    const column = e.mark?.column
    const at = typeof line === 'number' && typeof column === 'number'
      ? ` at line ${line + 1 + lineOffset}, column ${column + 1}`
      : ''
    return `YAML parse error: ${e.reason.split(/\r?\n/)[0].slice(0, ERROR_REASON_MAX_CHARS)}${at}`
  }
  const message = err instanceof Error ? err.message : String(err)
  return `YAML parse error: ${message.split(/\r?\n/)[0].slice(0, ERROR_REASON_MAX_CHARS)}`
}

/** A frontmatter value named in a summary error: short scalars as JSON, anything else by type only. */
function valueForError(value: unknown): string {
  if (value === undefined) return 'undefined'
  if (value === null || typeof value === 'number' || typeof value === 'boolean') return JSON.stringify(value)
  if (typeof value === 'string' && value.length <= 40) return JSON.stringify(value)
  return `a ${Array.isArray(value) ? 'list' : typeof value === 'object' ? 'map' : typeof value}`
}

function scalarText(value: unknown): string | null {
  if (value == null) return null
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return null
}

/**
 * Read the summary of a `_tower-state.md`. Accepted only when the file starts with a YAML
 * frontmatter block whose `schema_kind` is `tower-state` and `summary_version` an integer ≥ 1;
 * versions above 1 are read for the fields this version knows. Unknown keys are ignored, a
 * missing field is simply absent, a YAML error means "no summary" (never throws).
 */
export function parseTowerState(content: string): TowerStateParse {
  const text = content.charCodeAt(0) === 0xfeff ? content.slice(1) : content
  const noSummary = (summaryError?: string): TowerStateParse => ({
    kind: 'no-summary',
    lastUpdated: extractLastUpdatedLine(text),
    ...(summaryError ? { summaryError } : {}),
  })

  const { raw } = extractFrontmatterBlock(text)
  if (raw == null) return noSummary()

  let data: unknown
  try {
    data = yaml.load(raw, { schema: yaml.CORE_SCHEMA })
  } catch (err) {
    return noSummary(describeYamlError(err, 1))
  }
  if (data == null || typeof data !== 'object' || Array.isArray(data)) return noSummary('frontmatter is not a map')

  const fm = data as Record<string, unknown>
  if (fm.schema_kind !== 'tower-state') return noSummary(`schema_kind is ${valueForError(fm.schema_kind)}, not "tower-state"`)
  const version = fm.summary_version
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    return noSummary(`summary_version ${valueForError(version)} is not an integer ≥ 1`)
  }

  const summary: TowerStateSummary = { summaryVersion: version, nextIds: [], todo: [] }
  const updatedAt = scalarText(fm.updated_at)
  if (updatedAt) summary.updatedAt = updatedAt
  const session = scalarText(fm.session)
  if (session) summary.session = session
  if (fm.next_ids && typeof fm.next_ids === 'object' && !Array.isArray(fm.next_ids)) {
    for (const [key, value] of Object.entries(fm.next_ids as Record<string, unknown>)) {
      const shown = scalarText(value)
      if (shown != null && shown !== '') summary.nextIds.push({ key, value: shown })
    }
  }
  if (Array.isArray(fm.todo)) {
    for (const item of fm.todo) {
      const shown = scalarText(item)
      if (shown != null && shown.trim() !== '') summary.todo.push(shown)
    }
  }
  const batContract = fm.bat_contract
  if (typeof batContract === 'number' && Number.isSafeInteger(batContract) && batContract >= 1) {
    summary.batContract = batContract
  }
  return { kind: 'summary', summary }
}

/**
 * PLAN-068 W4 / T0906: the `bat_contract` a loaded `_tower-state.md` declares; null = contract v1
 * (no usable summary, field missing or not a whole number ≥ 1).
 */
export function towerStateBatContract(parsed: TowerStateParse | null | undefined): number | null {
  return parsed?.kind === 'summary' && typeof parsed.summary.batContract === 'number' ? parsed.summary.batContract : null
}

/**
 * PLAN-068 W5 / T0908: the contract v2 lists of a `_tower-state.md` (`parseTowerInboxLists`,
 * src/lib/tower-inbox.ts). Same acceptance as `parseTowerState` (a `tower-state` frontmatter with
 * `summary_version` ≥ 1); anything else → null. Never throws.
 */
export function parseTowerStateInbox(content: string): TowerInboxLists | null {
  const text = content.charCodeAt(0) === 0xfeff ? content.slice(1) : content
  const { raw } = extractFrontmatterBlock(text)
  if (raw == null) return null
  let data: unknown
  try {
    data = yaml.load(raw, { schema: yaml.CORE_SCHEMA })
  } catch {
    return null
  }
  if (data == null || typeof data !== 'object' || Array.isArray(data)) return null
  const fm = data as Record<string, unknown>
  const version = fm.summary_version
  if (fm.schema_kind !== 'tower-state' || typeof version !== 'number' || !Number.isInteger(version) || version < 1) return null
  return parseTowerInboxLists(fm)
}

/**
 * T0908: CT's `user_inbox` (T0902 §6′: `off` = CT writes neither `awaiting_user` nor `user_actions`).
 * Values of the config layers (`parseTowerConfigYaml`), highest first; the first one set decides.
 * `off` / `false` / `no` → off; anything else, or nothing set → on.
 */
export function effectiveUserInbox(...layers: Array<ReadonlyMap<string, string> | null | undefined>): 'on' | 'off' {
  for (const layer of layers) {
    const value = layer?.get('user_inbox')
    if (value === undefined) continue
    return /^(off|false|no)$/i.test(value.trim()) ? 'off' : 'on'
  }
  return 'on'
}

/** What was last logged about one workspace's `_tower-state.md` summary error (memory only). */
export interface SummaryErrorLogState {
  error: string
  contentHash: string
}

/** FNV-1a 32-bit over UTF-16 code units, as 8 hex digits — only to notice a changed file. */
export function contentHash(content: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < content.length; i++) {
    hash ^= content.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

/**
 * T0894 (BUG-217): whether a reload of `_tower-state.md` logs its summary error. The same error
 * on the same content is logged once (the `_ct-workorders/` watcher reloads on every change in the
 * directory); a changed error or changed content logs again, and the first reload without an
 * error after a logged one logs that it cleared. Lines name the file only, never its content or path.
 */
export function towerStateSummaryLog(
  prev: SummaryErrorLogState | null,
  content: string,
  parsed: TowerStateParse,
): { next: SummaryErrorLogState | null; line: string | null } {
  const error = parsed.kind === 'no-summary' ? parsed.summaryError : undefined
  if (!error) {
    return { next: null, line: prev ? '[ct-overview] _tower-state.md summary error cleared' : null }
  }
  const hash = contentHash(content)
  if (prev && prev.error === error && prev.contentHash === hash) return { next: prev, line: null }
  return { next: { error, contentHash: hash }, line: `[ct-overview] _tower-state.md summary ignored: ${error}` }
}

// ─── *config layers ─────────────────────────────────────────────────────────

export type ConfigLayer = 'project' | 'global' | 'default'

/** One row of `tower-config.md` § 可用選項 (columns: 選項 / 有效值 / 預設 / 說明). */
export interface ConfigDefaultRow {
  key: string
  validValues: string
  defaultValue: string
  description: string
}

function stripTicks(cell: string): string {
  return cell.replace(/`/g, '').trim()
}

/**
 * Parse the § 可用選項 table of an installed `tower-config.md`. Only the first table after the
 * `### 可用選項` heading and before the next heading counts; key cells lose their backticks.
 */
export function parseTowerConfigDefaults(markdown: string): ConfigDefaultRow[] {
  const rows: ConfigDefaultRow[] = []
  let inSection = false
  let inTable = false
  for (const line of markdown.split(/\r?\n/)) {
    if (/^#{1,6}\s/.test(line)) {
      if (inSection) break
      inSection = /^#{2,6}\s+可用選項\s*$/.test(line)
      continue
    }
    if (!inSection) continue
    const trimmed = line.trim()
    if (!trimmed.startsWith('|')) {
      if (inTable) break
      continue
    }
    inTable = true
    const cells = trimmed.replace(/^\|/, '').replace(/\|$/, '').split('|')
    if (cells.length < 3) continue
    if (cells.every(c => /^\s*:?-{3,}:?\s*$/.test(c))) continue // separator row
    const key = stripTicks(cells[0])
    if (!key || key === '選項') continue // header row
    rows.push({
      key,
      validValues: stripTicks(cells[1]),
      defaultValue: stripTicks(cells[2]),
      description: cells.slice(3).join('|').trim(),
    })
  }
  return rows
}

/** Display form of a YAML value: strings as written, `""` for empty, JSON for maps / lists. */
export function formatConfigValue(value: unknown): string {
  if (value === null || value === undefined) return 'null'
  if (typeof value === 'string') return value === '' ? '""' : value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return JSON.stringify(value)
}

/**
 * Keys of a config layer file. CT writes them under a `control-tower:` map (`tower-config.md`
 * § 持久化檔案格式); older project files (this repo's) are flat. Both are read: top-level keys
 * first, then the `control-tower` map's keys, which win on a clash.
 */
export function parseTowerConfigYaml(content: string): { values: Map<string, string>; error?: string } {
  let data: unknown
  try {
    data = yaml.load(content, { schema: yaml.CORE_SCHEMA })
  } catch (err) {
    return { values: new Map(), error: `YAML parse error: ${err instanceof Error ? err.message : String(err)}` }
  }
  if (data == null) return { values: new Map() }
  if (typeof data !== 'object' || Array.isArray(data)) return { values: new Map(), error: 'config is not a map' }

  const values = new Map<string, string>()
  const top = data as Record<string, unknown>
  for (const [key, value] of Object.entries(top)) {
    if (key !== 'control-tower') values.set(key, formatConfigValue(value))
  }
  const nested = top['control-tower']
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    for (const [key, value] of Object.entries(nested as Record<string, unknown>)) {
      values.set(key, formatConfigValue(value))
    }
  } else if (nested !== undefined) {
    values.set('control-tower', formatConfigValue(nested))
  }
  return { values }
}

export interface ConfigEntry {
  key: string
  /** Value of the highest layer that has the key. */
  effective: string
  source: ConfigLayer
  /** Every layer's value for the key (the overridden ones included). */
  layers: Partial<Record<ConfigLayer, string>>
  validValues?: string
  description?: string
}

/** Lowest first: a later layer overrides an earlier one. */
export const CONFIG_LAYER_ORDER: readonly ConfigLayer[] = ['default', 'global', 'project']

/**
 * Union of all keys the three layers have, default → global → project (later wins). Order:
 * the default table's order, then keys only the files have, alphabetically. A missing layer
 * (null) simply contributes nothing.
 */
export function mergeTowerConfig(input: {
  defaults: readonly ConfigDefaultRow[] | null
  global: ReadonlyMap<string, string> | null
  project: ReadonlyMap<string, string> | null
}): ConfigEntry[] {
  const entries = new Map<string, ConfigEntry>()
  const put = (key: string, layer: ConfigLayer, value: string) => {
    const entry = entries.get(key)
    if (entry) {
      entry.layers[layer] = value
      entry.effective = value
      entry.source = layer
    } else {
      entries.set(key, { key, effective: value, source: layer, layers: { [layer]: value } })
    }
  }

  for (const row of input.defaults ?? []) {
    put(row.key, 'default', row.defaultValue)
    const entry = entries.get(row.key)!
    entry.validValues = row.validValues
    entry.description = row.description
  }
  const defaultKeys = new Set(entries.keys())
  for (const [key, value] of input.global ?? []) put(key, 'global', value)
  for (const [key, value] of input.project ?? []) put(key, 'project', value)

  const all = [...entries.values()]
  const fromTable = all.filter(e => defaultKeys.has(e.key))
  const extra = all.filter(e => !defaultKeys.has(e.key)).sort((a, b) => a.key.localeCompare(b.key))
  return [...fromTable, ...extra]
}

// ─── Work order phase ───────────────────────────────────────────────────────

/**
 * - `open`: still needs someone (Worker or Tower) — listed as「進行中」in the overview.
 *   FAILED / PARTIAL / BLOCKED / INTERRUPTED stay open until the Tower re-dispatches or closes them;
 *   PAUSED (CT `*pause`) until `*resume`.
 * - `closed`: DONE / FIXED / ABANDONED — the statuses the panel already treats as completed
 *   (`diffWorkOrders` "completed" toast).
 * - `unknown`: INVALID (unrecognised frontmatter status) and UNKNOWN (no status at all). INVALID is
 *   listed with the open ones so it is not silently hidden; UNKNOWN (reports) is only counted.
 */
export type WorkOrderPhase = 'open' | 'closed' | 'unknown'

export function workOrderPhase(status: WorkOrderStatus): WorkOrderPhase {
  switch (status) {
    case 'PENDING':
    case 'URGENT':
    case 'IN_PROGRESS':
    case 'BLOCKED':
    case 'PARTIAL':
    case 'INTERRUPTED':
    case 'PAUSED':
    case 'FAILED':
      return 'open'
    case 'DONE':
    case 'FIXED':
    case 'ABANDONED':
      return 'closed'
    default:
      return 'unknown'
  }
}

/** Work orders the overview lists: open ones plus INVALID. */
export function isListedInOverview(status: WorkOrderStatus): boolean {
  return workOrderPhase(status) === 'open' || status === 'INVALID'
}

// ─── CT installed twice (T0711) ─────────────────────────────────────────────

export interface DualInstallNotice {
  agent: 'claude' | 'codex'
  manualVersion: string | null
  pluginVersion: string | null
  /** `warn` when both versions are known and differ; otherwise `info`. */
  level: 'warn' | 'info'
}

/**
 * One notice per agent that has both a zip (manual) install and the `ct` plugin, Claude first.
 * `installs` comes from another host (bat-server) and may be missing (older server) or malformed:
 * anything that is not the T0711 shape yields no notice.
 */
export function dualInstallNotices(installs: unknown): DualInstallNotice[] {
  if (!installs || typeof installs !== 'object') return []
  const notices: DualInstallNotice[] = []
  for (const agent of ['claude', 'codex'] as const) {
    const entry = (installs as Record<string, unknown>)[agent]
    if (!entry || typeof entry !== 'object') continue
    const { manual, plugin } = entry as { manual?: unknown; plugin?: unknown }
    if (!manual || typeof manual !== 'object' || !plugin || typeof plugin !== 'object') continue
    const manualVersion = versionField(manual)
    const pluginVersion = versionField(plugin)
    const level = manualVersion !== null && pluginVersion !== null && manualVersion !== pluginVersion ? 'warn' : 'info'
    notices.push({ agent, manualVersion, pluginVersion, level })
  }
  return notices
}

function versionField(value: object): string | null {
  const version = (value as { version?: unknown }).version
  return typeof version === 'string' && version.trim() ? version.trim() : null
}
