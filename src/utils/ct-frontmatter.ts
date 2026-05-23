/**
 * Control Tower Frontmatter Parser (PLAN-034 Sprint 3)
 *
 * Shared YAML frontmatter extraction + validation for CT documents.
 * See _ct-workorders/_spec-yaml-frontmatter-schema.md for the full spec.
 *
 * Contract:
 *   - frontmatter must be the first bytes of the file (`---\n...\n---\n`)
 *   - schema_version: 1 + schema_kind required
 *   - status enums uppercase, no emoji
 *   - missing/invalid frontmatter → caller falls back to legacy parser
 *   - unknown / invalid status → caller marks INVALID, never PENDING
 */

import yaml from 'js-yaml'

// ─── Public types ───────────────────────────────────────────────────────────

export type ParseSource = 'frontmatter' | 'legacy_markdown'

export type ParseWarningKind =
  | 'missing_frontmatter'
  | 'invalid_frontmatter'
  | 'metadata_drift'
  | 'unknown_status'

export interface ParseWarning {
  kind: ParseWarningKind
  field?: string
  frontmatter_value?: string
  body_value?: string
  detail?: string
}

export type SchemaKind = 'workorder' | 'bug' | 'plan' | 'experiment' | 'index'

export interface CtFrontmatterV1Base {
  schema_version: 1
  schema_kind: SchemaKind
  id: string
  title?: string
  status?: string
  created_at?: string
  updated_at?: string
  owners?: string[]
  tags?: string[]
  links?: Record<string, unknown>
  priority?: string
  sizing?: string
  affects_files?: string[]
  depends_on?: string[]
  followups?: string[]
  release_target?: string
  interaction?: {
    mode_hint?: string
    interactive?: boolean
    intervention_type?: string
  }
}

export interface CtWorkorderFrontmatterV1 extends CtFrontmatterV1Base {
  schema_kind: 'workorder'
  type?: string
  project?: string
  status:
    | 'PENDING' | 'IN_PROGRESS' | 'DONE' | 'FIXED' | 'FAILED'
    | 'BLOCKED' | 'PARTIAL' | 'INTERRUPTED' | 'URGENT' | 'ABANDONED'
  started_at?: string
  completed_at?: string
  renew_count?: number
  workdir?: string
}

export interface CtBugFrontmatterV1 extends CtFrontmatterV1Base {
  schema_kind: 'bug'
  status: 'OPEN' | 'FIXING' | 'FIXED' | 'VERIFY' | 'CLOSED' | 'WONTFIX'
  severity?: 'low' | 'medium' | 'high' | 'critical'
  reproducibility?: string
  workaround?: string
  impact?: string[]
}

export interface CtPlanFrontmatterV1 extends CtFrontmatterV1Base {
  schema_kind: 'plan'
  status: 'IDEA' | 'PLANNED' | 'IN_PROGRESS' | 'DONE' | 'DROPPED'
  priority?: 'low' | 'medium' | 'high' | 'critical'
  plan_type?: string[]
  trigger_bugs?: string[]
  scope?: string[]
  estimated_workorders?: number
}

export interface CtExperimentFrontmatterV1 extends CtFrontmatterV1Base {
  schema_kind: 'experiment'
  status: 'EXPLORING' | 'CONCLUDED' | 'ABANDONED'
  topic?: string
  driving_decision?: string
  related_plan?: string
  success_criteria?: string[]
  outcome_commit?: string
}

export interface CtIndexFrontmatterV1 extends CtFrontmatterV1Base {
  schema_kind: 'index'
  index_kind: 'bugs' | 'plans' | 'decisions' | 'tower_state' | 'workorders'
  generated_at: string
  generator: string
  source_globs?: string[]
  exclude_globs?: string[]
  total: number
  breakdown?: Record<string, number>
}

export type CtFrontmatterV1 =
  | CtWorkorderFrontmatterV1
  | CtBugFrontmatterV1
  | CtPlanFrontmatterV1
  | CtExperimentFrontmatterV1
  | CtIndexFrontmatterV1

// ─── Frontmatter extraction ─────────────────────────────────────────────────

/**
 * Split a markdown document into YAML frontmatter + body.
 *
 * Returns `{ raw: null, body: content }` when no frontmatter block is present.
 * Frontmatter must be the first bytes — leading whitespace before `---` does
 * not count (matches Jekyll / mkdocs / VS Code conventions).
 */
export function extractFrontmatterBlock(content: string): { raw: string | null; body: string } {
  if (!content.startsWith('---')) return { raw: null, body: content }

  // Match `---\n...\n---\n?` at the very start. Use [\s\S] to span newlines.
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/)
  if (!match) return { raw: null, body: content }

  const raw = match[1]
  const body = content.slice(match[0].length)
  return { raw, body }
}

/**
 * Parse YAML frontmatter and validate base required fields.
 *
 * Validation rules:
 *   - schema_version must be exactly 1 (number, not string)
 *   - schema_kind must match expectedKind (when supplied) and be a known value
 *   - id must be a non-empty string
 *
 * Returns `{ data: null, warning }` on any failure; caller falls back to legacy.
 * Returns `{ data: T, warning: null }` on success.
 */
export function parseFrontmatterYaml<T extends CtFrontmatterV1Base>(
  raw: string,
  expectedKind?: SchemaKind,
): { data: T | null; warning: ParseWarning | null } {
  let parsed: unknown
  try {
    parsed = yaml.load(raw)
  } catch (err) {
    return {
      data: null,
      warning: {
        kind: 'invalid_frontmatter',
        detail: `YAML parse error: ${err instanceof Error ? err.message : String(err)}`,
      },
    }
  }

  if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {
      data: null,
      warning: { kind: 'invalid_frontmatter', detail: 'frontmatter is not an object' },
    }
  }

  const obj = parsed as Record<string, unknown>

  if (obj.schema_version !== 1) {
    return {
      data: null,
      warning: {
        kind: 'invalid_frontmatter',
        field: 'schema_version',
        detail: `expected 1, got ${JSON.stringify(obj.schema_version)}`,
      },
    }
  }

  const kind = obj.schema_kind
  const KNOWN_KINDS: SchemaKind[] = ['workorder', 'bug', 'plan', 'experiment', 'index']
  if (typeof kind !== 'string' || !KNOWN_KINDS.includes(kind as SchemaKind)) {
    return {
      data: null,
      warning: {
        kind: 'invalid_frontmatter',
        field: 'schema_kind',
        detail: `unknown schema_kind ${JSON.stringify(kind)}`,
      },
    }
  }

  if (expectedKind && kind !== expectedKind) {
    return {
      data: null,
      warning: {
        kind: 'invalid_frontmatter',
        field: 'schema_kind',
        detail: `expected ${expectedKind}, got ${kind}`,
      },
    }
  }

  if (typeof obj.id !== 'string' || obj.id.trim() === '') {
    return {
      data: null,
      warning: {
        kind: 'invalid_frontmatter',
        field: 'id',
        detail: 'id is required and must be a non-empty string',
      },
    }
  }

  return { data: obj as T, warning: null }
}

// ─── Drift detection ────────────────────────────────────────────────────────

/**
 * Normalize a status-like string for drift comparison.
 * Strips common emoji prefixes, trims, uppercases.
 */
export function normalizeStatusForCompare(value: string | undefined | null): string {
  if (!value) return ''
  // Strip leading non-letter/digit chars (emoji + whitespace) then uppercase.
  return value.trim().replace(/^[^A-Za-z0-9_]+/, '').toUpperCase().split(/[\s/(]/)[0]
}

/**
 * Compare normalized frontmatter status vs body table status.
 * Returns drift warning when both present and different.
 */
export function detectStatusDrift(
  fmStatus: string | undefined,
  bodyStatus: string | undefined,
): ParseWarning | null {
  const fmNorm = normalizeStatusForCompare(fmStatus)
  const bodyNorm = normalizeStatusForCompare(bodyStatus)
  if (!fmNorm || !bodyNorm) return null
  if (fmNorm === bodyNorm) return null
  return {
    kind: 'metadata_drift',
    field: 'status',
    frontmatter_value: fmStatus,
    body_value: bodyStatus,
    detail: `status drift: frontmatter=${fmNorm} body=${bodyNorm}; frontmatter wins`,
  }
}
