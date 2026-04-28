# PLAN-034 YAML Frontmatter Metadata Schema Spec

Status: draft for Sprint 2-6 implementation
Schema version: 1
Owner: Control Tower + BAT
Created: 2026-04-28
Source work order: T0342

## Decision Summary

| Topic | Decision |
|-------|----------|
| List fields | Use native YAML block lists. JSON-style arrays are allowed only for generated machine output, not hand-written work orders. |
| Source of truth | YAML frontmatter is the metadata SoT. Body metadata tables stay for human scanning only. |
| Drift handling | Warn on frontmatter/body drift; do not silently overwrite human text. |
| Schema versioning | Use top-level `schema_version: 1`; future versions are lazy-read compatible plus explicit migration scripts. |
| Migration timing | Dual-write transition: new docs get frontmatter first, existing hot docs migrate by script, legacy parser remains for at least one month. |
| Strictness | Start lax with warnings; promote to strict after dogfood criteria are met. |
| Index statistics | Index frontmatter stores `generated_at`, `total`, and compact `breakdown`; detailed tables stay in body. |
| Namespace | Shared base schema with type-specific extensions for `workorder`, `bug`, `plan`, `experiment`, and `index`. |
| Error contract | Parser surfaces warnings; sync may abort only when frontmatter is present but invalid in strict mode. |

## YAML Frontmatter Contract

Every hot Control Tower document in `_ct-workorders/` that participates in BAT panels or CT sync should start with YAML frontmatter:

```yaml
---
schema_version: 1
schema_kind: workorder
id: T0342
status: IN_PROGRESS
created_at: "2026-04-28T18:25:00+08:00"
---
```

Rules:

- Frontmatter must be the first bytes of the file, before the H1.
- Parser order: frontmatter first, markdown fallback second during transition.
- Status values are uppercase enums without emoji.
- Display emoji belongs in body tables and UI rendering, not schema fields.
- Time values use quoted ISO 8601 with offset: `"2026-04-28T19:16:49+08:00"`.
- Missing optional values use omission, not empty strings.
- Paths are repo-relative and use forward slashes.
- `_archive/` documents are frozen and not migrated by PLAN-034.

## Base Schema

Required fields for all frontmatter-enabled documents:

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `schema_version` | integer | yes | Starts at `1`. |
| `schema_kind` | enum | yes | `workorder`, `bug`, `plan`, `experiment`, `index`. |
| `id` | string | yes | Stable ID, e.g. `T0342`, `BUG-077`, `_bug-tracker`. |
| `title` | string | yes | Human-readable title without status emoji. |
| `status` | enum | yes except generated indexes | Type-specific enum. |
| `created_at` | ISO 8601 string | yes except generated indexes | Original creation time. |
| `updated_at` | ISO 8601 string | no | Last metadata mutation. |
| `owners` | YAML list of strings | no | Human/team ownership, not execution routing. |
| `tags` | YAML list of strings | no | Lowercase slugs. |
| `links` | object | no | IDs or repo-relative paths to related docs. |

Common optional operational fields:

| Field | Type | Notes |
|-------|------|-------|
| `priority` | enum | `low`, `medium`, `high`, `critical`. |
| `sizing` | enum/string | Prefer `XS`, `S`, `M`, `L`, `XL`; body may keep richer text. |
| `affects_files` | YAML list | Repo-relative files, globs, or directories. |
| `depends_on` | YAML list | Work order, bug, plan IDs, or file paths. |
| `followups` | YAML list | IDs planned after this document. |
| `release_target` | string | Version or release train. |
| `interaction` | object | Worker dispatch hints; not runtime CT mode source. |

`interaction` fields:

```yaml
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
```

`mode_hint` is documentation only. Worker runtime mode continues to come from `CT_MODE` env.

## Status Enums

Work order statuses:

- `PENDING`
- `IN_PROGRESS`
- `DONE`
- `FIXED`
- `FAILED`
- `BLOCKED`
- `PARTIAL`
- `INTERRUPTED`
- `URGENT`

Bug statuses:

- `OPEN`
- `FIXING`
- `FIXED`
- `VERIFY`
- `CLOSED`
- `WONTFIX`

Plan statuses:

- `IDEA`
- `PLANNED`
- `IN_PROGRESS`
- `DONE`
- `DROPPED`

Experiment statuses:

- `PROPOSED`
- `RUNNING`
- `CONCLUDED`
- `ABANDONED`

Index statuses are not required; generated indexes use `index_kind` and statistics fields instead.

## List Field Format

Decision: use native YAML block lists.

Preferred:

```yaml
affects_files:
  - _ct-workorders/T0342-*.md
  - _ct-workorders/examples/
  - "docs/含中文路徑/*.md"
```

Not preferred for hand-written files:

```yaml
affects_files: ["_ct-workorders/T0342-*.md", "_ct-workorders/examples/"]
```

Reasoning:

- Block lists are easier for humans and LLM workers to append without quote/escape mistakes.
- YAML parsers handle glob characters safely when values are quoted only when needed.
- Diffs are smaller when adding/removing one item.

Boundary rules:

- Quote values containing `: `, leading `*`, leading `{`, leading `[`, or `#`.
- Use forward slashes even on Windows.
- Keep display text out of path lists; explanations belong in body.

## Workorder Extension

Required fields:

```yaml
schema_kind: workorder
id: T0342
type: research
status: IN_PROGRESS
project: PLAN-034
created_at: "2026-04-28T18:25:00+08:00"
```

Allowed `type` values:

- `research`
- `impl`
- `fix`
- `test`
- `docs`
- `refactor`
- `audit`
- `spike`
- `chore`

Recommended fields:

```yaml
started_at: "2026-04-28T19:16:49+08:00"
completed_at: "2026-04-28T20:12:00+08:00"
sizing: L
depends_on:
  - PLAN-034
followups:
  - T0343
affects_files:
  - _ct-workorders/T0342-*.md
  - _ct-workorders/_spec-yaml-frontmatter-schema.md
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
```

## Bug Extension

Required fields:

```yaml
schema_kind: bug
id: BUG-077
status: OPEN
severity: medium
reproducibility: always
created_at: "2026-04-28T18:15:00+08:00"
```

Recommended fields:

```yaml
workaround: "Open workorder file and read the metadata status table."
impact:
  - control-tower-ui
  - status-statistics
links:
  trigger_plan: PLAN-034
  related_workorders:
    - T0313
    - T0314
```

`severity` enum: `low`, `medium`, `high`, `critical`.

## Plan Extension

Required fields:

```yaml
schema_kind: plan
id: PLAN-034
status: PLANNED
priority: high
created_at: "2026-04-28T18:20:00+08:00"
```

Recommended fields:

```yaml
plan_type:
  - architecture
  - technical-improvement
trigger_bugs:
  - BUG-077
scope:
  - BAT parser
  - CT sync
  - CT templates
estimated_workorders: 6
```

## Experiment Extension

Required fields:

```yaml
schema_kind: experiment
id: EXP-HEADLESS-001
status: CONCLUDED
topic: HEADLESS
created_at: "2026-04-25T21:45:00+08:00"
```

Recommended fields:

```yaml
driving_decision: T0260
related_plan: PLAN-007
success_criteria:
  - AC1
  - AC2
  - AC3
outcome_commit: 17ac525
```

## Index Schema

Generated index files use `schema_kind: index`.

Example:

```yaml
---
schema_version: 1
schema_kind: index
id: _bug-tracker
index_kind: bugs
generated_at: "2026-04-28T18:15:00+08:00"
generator: control-tower-sync
source_globs:
  - _ct-workorders/BUG-*.md
exclude_globs:
  - _ct-workorders/_archive/**
total: 20
breakdown:
  OPEN: 3
  FIXING: 0
  FIXED: 0
  VERIFY: 3
  CLOSED: 14
  WONTFIX: 0
---
```

Decision: include compact `breakdown` in frontmatter.

Reasoning:

- BAT statistics panels can read summary counts without reparsing body tables.
- The body remains the detailed, human-readable report.
- The generated index still has one SoT because `*sync` writes frontmatter and body in one pass.

Index-specific fields:

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `index_kind` | enum | yes | `bugs`, `plans`, `decisions`, `tower_state`, `workorders`. |
| `generated_at` | ISO 8601 string | yes | Sync time. |
| `generator` | string | yes | Usually `control-tower-sync`. |
| `source_globs` | list | yes | Hot-zone source files. |
| `exclude_globs` | list | no | `_archive/**` by default. |
| `total` | integer | yes | Count of source records in the index. |
| `breakdown` | object integer map | yes where useful | Status/category counts. |

## Frontmatter / Body Drift

Decision: warn, do not auto-overwrite by default.

Drift detection compares normalized fields:

- `id`
- `title`
- `status`
- `created_at`
- `started_at`
- `completed_at`
- `sizing`
- type-specific priority/severity fields

Normalization rules:

- Strip emoji from body table values.
- Convert localized labels to schema keys where mapping is deterministic.
- Normalize status case to uppercase.
- Parse common legacy date strings, then compare as timestamps when possible.
- Compare path lists after slash normalization and whitespace trim.

Pseudocode:

```text
doc = parseMarkdownDocument(file)
frontmatter = parseYaml(doc.frontmatter)
bodyMeta = parseLegacyMetadataTables(doc.body)

if no frontmatter:
  return legacyParseWithWarning("missing_frontmatter")

schemaResult = validate(frontmatter)
if schemaResult.invalid:
  if strictMode: abortSync(file, schemaResult.errors)
  else: warn(file, "invalid_frontmatter", schemaResult.errors)

drift = compare(normalize(frontmatter), normalize(bodyMeta))
if drift.nonEmpty:
  warn(file, "metadata_drift", drift)

return frontmatter
```

Warning format:

```text
[PLAN-034 metadata_drift] T0342-research-plan034-yaml-frontmatter-schema-design.md
field=status frontmatter=IN_PROGRESS body=PENDING
action=frontmatter_used; body_not_modified
```

Auto-fix policy:

- Safe auto-fix may add missing frontmatter during migration.
- Safe auto-fix may re-render generated index files because they are machine-owned.
- Safe auto-fix must not rewrite human workorder body tables unless explicitly requested.

## Versioning

Decision: lazy compatibility plus explicit migration.

Fields:

- `schema_version: 1` is required.
- Future v2 readers must load v1 through a compatibility adapter.
- Migration scripts should be idempotent and leave a body change note or commit message.

Compatibility matrix:

| Reader | v0 legacy markdown | v1 frontmatter | v2 future |
|--------|--------------------|----------------|-----------|
| Transition parser | read with warning | read | reject unless adapter exists |
| Strict v1 parser | reject except allowlist | read | reject unless adapter exists |
| Future v2 parser | read via v0 migration adapter if enabled | read via v1 adapter | read |

Recommended adapter shape:

```ts
type CtDocumentMetaV1 = { schema_version: 1; schema_kind: string; id: string; status?: string }
type CtDocumentMetaCurrent = CtDocumentMetaV1

function normalizeMeta(raw: unknown): CtDocumentMetaCurrent {
  if (isLegacyMarkdown(raw)) return migrateLegacyToV1(raw)
  if (isV1(raw)) return raw
  throw new Error('unsupported schema_version')
}
```

## Migration Strategy

Decision: dual-write transition.

Timeline:

| Phase | Owner | Criteria |
|-------|-------|----------|
| Sprint 2 | CT | Templates and sync emit v1 frontmatter for new/updated docs. |
| Sprint 3 | BAT | Parser reads v1 first and falls back to legacy markdown with warnings. |
| Sprint 4 | CT/BAT | Migration script adds frontmatter to hot-zone docs. `_archive/` skipped. |
| Sprint 5 | CT/BAT | Dogfood parser parity; BUG-077 T0313/T0314 confirmed resolved. |
| Sprint 6 optional | CT/BAT | Strict mode enabled after stability criteria. |

Legacy parser removal criteria:

- At least one week of BAT dogfood with no frontmatter/body drift that changes UI status buckets.
- At least 50 hot-zone work orders parsed through frontmatter in normal use.
- T0313/T0314 display as Done through frontmatter parser.
- `_bug-tracker.md` and `_backlog.md` totals equal their breakdown sums.
- Migration script can be re-run with zero diff.

Migration pseudocode:

```text
for file in _ct-workorders/*.md:
  if file under _archive: continue
  if file has frontmatter: validate and continue
  kind = inferKindFromFilename(file)
  legacy = parseLegacyMetadataTables(file)
  meta = mapLegacyToV1(kind, legacy, filename)
  writeFrontmatterBeforeH1(file, meta)
```

## Strictness Stages

Decision: start lax, promote later.

| Stage | Behavior |
|-------|----------|
| `lax` | Prefer frontmatter, warn on missing/invalid/drift, keep UI working. |
| `guarded` | New CT templates and worker-created docs must be valid; old docs may warn. |
| `strict` | Sync/parser fail invalid frontmatter outside explicit legacy allowlist. |

Promote to strict only after Sprint 5 dogfood criteria pass.

## Error Handling Contract

BAT parser:

- Frontmatter valid: use it.
- Frontmatter missing: fallback to legacy parser and attach `missing_frontmatter` warning.
- Frontmatter invalid in lax/guarded mode: fallback only if body can be parsed; show warning.
- Frontmatter invalid in strict mode: mark record invalid and surface error, not Pending.
- Unknown status: mark invalid/unknown, not Pending.

CT sync:

- Generated indexes: may rewrite frontmatter/body from source records.
- Human documents: warn on drift and use frontmatter as SoT.
- Strict mode: abort sync when invalid frontmatter would corrupt indexes.

Worker guidance:

- Write uppercase enum values.
- Do not rely on emoji in schema.
- Preserve `CT_MODE` env as runtime mode source; frontmatter only documents intended dispatch behavior.

## Sprint 2-6 Work Breakdown

| Sprint | Goal | Sizing | Dependencies | Affects files |
|--------|------|--------|--------------|---------------|
| 2 | CT templates + skill docs emit v1 frontmatter; `*sync` understands frontmatter SoT and drift warnings. | M-L | T0342 | `~/.codex/skills/control-tower/**`, `~/.codex/skills/ct-*/SKILL.md`, CT templates, sync/archive scripts |
| 3 | BAT parser reads v1 frontmatter first for workorders, bugs, plans, decisions, backlog panels. | L | Sprint 2 spec stable | `src/types/control-tower.ts`, bug/backlog/decision parsers, `ControlTowerPanel.tsx`, panel tests |
| 4 | Migration script adds v1 frontmatter to ~140 hot-zone docs, idempotently. | M | Sprint 2-3 parser compatibility | `scripts/migrate-ct-frontmatter.*`, `_ct-workorders/*.md`, excluding `_archive/**` |
| 5 | Dogfood transition, BUG-077 validation, parser parity tests, drift telemetry. | M | Sprint 4 migrated docs | Parser fixtures for T0313/T0314, `_bug-tracker.md`, `_backlog.md`, sync logs |
| 6 optional | Strict mode and lint enforcement once dogfood criteria pass. | S-M | Sprint 5 stability criteria | sync lint rules, CI/test scripts, worker-facing error docs |

## BUG-077 Closure Path

BUG-077 should not be closed by editing T0313/T0314 body metadata alone. Closure requires:

1. BAT parser uses frontmatter before markdown tables.
2. T0313/T0314 have valid `schema_version: 1` frontmatter with `status: DONE`.
3. Workorder panel shows both as Done after refresh.
4. Workorder statistics totals reconcile: visible status buckets sum to total or explicitly include hidden/other buckets.
5. Regression fixtures cover markdown table drift and assert frontmatter remains SoT.

