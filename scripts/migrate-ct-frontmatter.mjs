#!/usr/bin/env node
/**
 * PLAN-034 Sprint 4 — Migration script: hot-zone CT 單據加 v1 frontmatter
 *
 * 從現有 markdown body metadata 抽欄位，prepend YAML frontmatter block。
 * Idempotent：已有 `---\n...` 開頭的檔案完全 skip。
 *
 * Usage:
 *   node scripts/migrate-ct-frontmatter.mjs            # 實際遷移
 *   node scripts/migrate-ct-frontmatter.mjs --dry-run  # 只列出會改的檔
 *   node scripts/migrate-ct-frontmatter.mjs --verbose  # 詳細輸出
 *   node scripts/migrate-ct-frontmatter.mjs --file PATH  # 只處理指定檔
 *
 * Spec: _ct-workorders/_spec-yaml-frontmatter-schema.md
 */

import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs'
import { join, basename, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

// ─── CLI parsing ───────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')
const VERBOSE = args.includes('--verbose')
const fileFlagIdx = args.indexOf('--file')
const SINGLE_FILE = fileFlagIdx >= 0 ? args[fileFlagIdx + 1] : null

const ROOT = process.cwd()
const CT_DIR = join(ROOT, '_ct-workorders')

// ─── Work order ID grammar ──────────────────────────────────────────────────
// T0360/BUG-082: 工單 ID 的選用前綴 —— CT 規範的「2–4 字元大寫英文前綴」
// （跨專案 `CP-`、委派 `CT-`、專案代號 `KEEN-` 等）+ `T` + 數字。
// ⚠️ 以下三處為同一份文法的複本（helper / main / renderer 之間無共用模組路徑），
// 本檔（一次性 migration script）為第四份，任一處放寬都必須同步其餘三處：
//   - scripts/bat-terminal.mjs           WORKORDER_ID_PATTERN
//   - electron/main.ts                   WORKORDER_ID_PATTERN
//   - src/types/control-tower.ts         WORKORDER_ID_PREFIX
// 注意：BUG / PLAN / EXP 的 ID 規則與此無關，維持各自文法（T0361 範圍外）。
const WORKORDER_ID_PREFIX = '(?:[A-Z]{2,4}-)?'

/** 檔名開頭的工單 ID（前綴匹配，不錨定尾端）：T0001- / CP-T1148- / CT-T001- */
const WORKORDER_ID_HEAD = new RegExp(String.raw`^(${WORKORDER_ID_PREFIX}T\d+)`)

// ─── Filename → schema_kind / id ────────────────────────────────────────────
function inferIdAndKind(filename) {
  const base = basename(filename, '.md')

  // T0001-... / CT-T001-... / CP-T1148-... → workorder
  let m = base.match(WORKORDER_ID_HEAD)
  if (m) return { id: m[1], kind: 'workorder' }

  // BUG-077-... → bug
  m = base.match(/^(BUG-\d+)/)
  if (m) return { id: m[1], kind: 'bug' }

  // PLAN-034-... → plan
  m = base.match(/^(PLAN-\d+)/)
  if (m) return { id: m[1], kind: 'plan' }

  // EXP-HEADLESS-001-... → experiment
  m = base.match(/^(EXP-[A-Z0-9]+-\d+)/)
  if (m) return { id: m[1], kind: 'experiment' }

  return null
}

// ─── Status normalization ───────────────────────────────────────────────────
// Strip leading non-alnum (emoji + spaces), uppercase, take first token.
function normalizeStatus(raw) {
  if (!raw) return null
  const cleaned = raw
    .trim()
    .replace(/^[^A-Za-z0-9_]+/, '')
    .toUpperCase()
    .split(/[\s/(（,，]/)[0]
    .replace(/[^A-Z_]/g, '')

  if (!cleaned) return null

  // Map IN PROGRESS / IN-PROGRESS variants
  // (already collapsed by split — but if body wrote `IN PROGRESS` w/ space,
  //  we'd have lost the suffix. Try common variants.)
  const KNOWN = new Set([
    // workorder
    'PENDING', 'IN_PROGRESS', 'DONE', 'FIXED', 'FAILED',
    'BLOCKED', 'PARTIAL', 'INTERRUPTED', 'URGENT', 'TODO',
    // bug
    'OPEN', 'FIXING', 'VERIFY', 'CLOSED', 'WONTFIX',
    // plan
    'IDEA', 'PLANNED', 'DROPPED',
    // experiment
    'EXPLORING', 'CONCLUDED', 'ABANDONED',
  ])

  // TODO → PENDING (legacy)
  if (cleaned === 'TODO') return 'PENDING'
  if (KNOWN.has(cleaned)) return cleaned

  // Try to recover IN with trailing PROGRESS in raw
  if (/IN[\s_-]*PROGRESS/i.test(raw)) return 'IN_PROGRESS'

  return null
}

// Validate normalized status against schema_kind enum.
function validateStatusForKind(status, kind) {
  const ENUMS = {
    workorder: ['PENDING', 'IN_PROGRESS', 'DONE', 'FIXED', 'FAILED', 'BLOCKED', 'PARTIAL', 'INTERRUPTED', 'URGENT'],
    bug: ['OPEN', 'FIXING', 'FIXED', 'VERIFY', 'CLOSED', 'WONTFIX'],
    plan: ['IDEA', 'PLANNED', 'IN_PROGRESS', 'DONE', 'DROPPED'],
    experiment: ['EXPLORING', 'CONCLUDED', 'ABANDONED'],
  }
  const allowed = ENUMS[kind]
  if (!allowed) return false
  return allowed.includes(status)
}

// ─── Severity / priority ────────────────────────────────────────────────────
function normalizeLevel(raw) {
  if (!raw) return null
  const lower = raw.toLowerCase()
  if (/critical|🔥/.test(lower)) return 'critical'
  if (/high|🔴/.test(lower)) return 'high'
  if (/medium|🟡/.test(lower)) return 'medium'
  if (/low|🟢/.test(lower)) return 'low'
  return null
}

// ─── Sizing ─────────────────────────────────────────────────────────────────
function normalizeSizing(raw) {
  if (!raw) return null
  const m = raw.match(/\b(XS|S|M|L|XL)\b/)
  return m ? m[1] : null
}

// ─── Type (workorder) ───────────────────────────────────────────────────────
const TYPE_ENUM = ['research', 'impl', 'fix', 'test', 'docs', 'refactor', 'audit', 'spike', 'chore']
function normalizeType(raw) {
  if (!raw) return null
  const lower = raw.toLowerCase()
  for (const t of TYPE_ENUM) {
    // word-boundary match: e.g. "impl + migration" → impl
    const re = new RegExp(`\\b${t}\\b`)
    if (re.test(lower)) return t
  }
  // Chinese hints
  if (/重構|架構調整/.test(raw)) return 'refactor'
  if (/文件|文檔/.test(raw)) return 'docs'
  if (/修復|錯誤|缺陷/.test(raw)) return 'fix'
  if (/測試/.test(raw)) return 'test'
  if (/實作|實裝/.test(raw)) return 'impl'
  if (/研究|調查/.test(raw)) return 'research'
  return null
}

// ─── Datetime ───────────────────────────────────────────────────────────────
// Parse `2026-04-28 18:15 (UTC+8)` or `2026-04-28` → ISO 8601 with +08:00.
function normalizeDateTime(raw) {
  if (!raw) return null
  const trimmed = raw.trim()

  // Already ISO?
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(trimmed)) {
    return trimmed.replace(/\s+.*$/, '')
  }

  // `2026-04-28 18:15 (UTC+8)` or `2026-04-28 18:15:30 (UTC+8)`
  let m = trimmed.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?/)
  if (m) {
    const date = m[1]
    const hh = m[2].padStart(2, '0')
    const mm = m[3]
    const ss = m[4] || '00'
    return `${date}T${hh}:${mm}:${ss}+08:00`
  }

  // Date only `2026-04-28`
  m = trimmed.match(/^(\d{4}-\d{2}-\d{2})$/)
  if (m) return `${m[1]}T00:00:00+08:00`

  return null
}

// ─── Body metadata extraction ───────────────────────────────────────────────
// Body uses TWO styles:
//   1. Markdown table: `| 狀態 | ✅ DONE |` or `| **狀態** | DONE |`
//   2. Bullet/bold:   `- **狀態**:DONE` or `- **狀態**：DONE` or `**狀態**：DONE`

const FIELD_ALIASES = {
  status: ['狀態'],
  type: ['類型'],
  severity: ['嚴重度'],
  priority: ['優先級', '優先度'],
  sizing: ['Sizing', '預估規模', '規模'],
  created_at: ['建立時間'],
  started_at: ['開始時間'],
  completed_at: ['完成時間'],
  closed_at: ['關閉時間'],
  fixed_at: ['修復時間'],
  renew_count: ['Renew 次數', 'Renew次數'],
  title: ['標題', '任務名稱'],
  workdir: ['工作目錄'],
}

function extractField(body, aliases) {
  for (const alias of aliases) {
    const aliasEsc = alias.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')

    // Style 1: `| <alias> | <value> |` or `| **<alias>** | <value> |`
    const tableRe = new RegExp(`^\\|\\s*\\*{0,2}${aliasEsc}\\*{0,2}\\s*\\|\\s*([^|\\n]+?)\\s*\\|`, 'm')
    let m = body.match(tableRe)
    if (m) return m[1].trim()

    // Style 2: `- **<alias>**:value` or `- **<alias>**：value`
    const bulletRe = new RegExp(`^[-*]\\s*\\*\\*${aliasEsc}\\*\\*\\s*[:：]\\s*(.+?)\\s*$`, 'm')
    m = body.match(bulletRe)
    if (m) return m[1].trim()

    // Style 3: `**<alias>**：value` (no bullet)
    const boldRe = new RegExp(`^\\*\\*${aliasEsc}\\*\\*\\s*[:：]\\s*(.+?)\\s*$`, 'm')
    m = body.match(boldRe)
    if (m) return m[1].trim()
  }
  return null
}

function extractTitle(body) {
  // H1: `# T0001 — task title` or `# T0001-task-slug` or `# 工單 T0001-...`
  const m = body.match(/^#\s+(.+?)\s*$/m)
  if (!m) return null
  let h1 = m[1].trim()
  // Strip leading "工單 " / "工單" prefix
  h1 = h1.replace(/^工單\s*/, '')
  // After em-dash or hyphen: prefer the descriptive part
  const dash = h1.match(/^[A-Z0-9-]+(?:\s*[—－–-]\s*|\s+)(.+)$/)
  if (dash) return dash[1].trim()
  return h1
}

// ─── Excludes ───────────────────────────────────────────────────────────────
function shouldProcess(filename) {
  const base = basename(filename)
  if (!base.endsWith('.md')) return false

  // Excludes — system / spec / draft / report / index files
  // Note: workorder review/verification reports (e.g. T0292-review-report.md,
  // T0298-verification-report.md) are *artifacts produced by* a workorder,
  // not workorders themselves. They have the same T#### prefix but no status
  // field, so we exclude by suffix pattern. (PLAN-034 Sprint 5 / T0346)
  const EXCLUDES = [
    /^_archive/,
    /^_spec-/, /^_draft-/, /^_report-/, /^_spike-/,
    /^_question-/, /^_roadmap-/, /^_guide-/,
    /^_tower-state\.md$/, /^_local-rules\.md$/,
    /^_learnings\.md$/, /^_cross-references\.md$/,
    /^_tower-config\.yaml$/,
    /^_decision-log\.md$/, /^_bug-tracker\.md$/, /^_backlog\.md$/,
    /^examples?\//,
    // Workorder artifacts (not workorders themselves):
    /-(review|verification)-report\.md$/,
  ]
  if (EXCLUDES.some((re) => re.test(base))) return false

  // Hot-zone prefixes only — workorder 部分沿用 WORKORDER_ID_HEAD（見檔頭），
  // BUG / PLAN / EXP 文法不變。
  return WORKORDER_ID_HEAD.test(base) || /^(BUG-\d+|PLAN-\d+|EXP-[A-Z0-9]+-\d+)/.test(base)
}

// ─── YAML emission ──────────────────────────────────────────────────────────
// Keep it minimal — handwrite YAML for known field types to avoid pulling in
// js-yaml. All values are plain strings/numbers (no nested objects required).
function emitYaml(meta) {
  const lines = ['---']
  // Required first
  lines.push('schema_version: 1')
  lines.push(`schema_kind: ${meta.schema_kind}`)
  lines.push(`id: ${meta.id}`)

  // Optional, in stable order
  const order = [
    'title', 'type', 'status', 'severity', 'priority', 'sizing',
    'created_at', 'started_at', 'completed_at', 'closed_at', 'fixed_at',
    'renew_count', 'workdir',
  ]
  for (const key of order) {
    if (meta[key] == null) continue
    const val = meta[key]
    if (typeof val === 'number') {
      lines.push(`${key}: ${val}`)
    } else {
      // Quote strings that need it: contain `:`, `#`, `[`, `]`, `{`, `}`,
      // start with `-`, or could be parsed as bool/null.
      const needsQuote =
        /[:#[\]{}]|^[-*&!|>%@`]/.test(val) ||
        /^(true|false|null|yes|no|on|off)$/i.test(val) ||
        /^\d/.test(val) // datetimes start with digits — must quote
      lines.push(needsQuote ? `${key}: "${val.replace(/"/g, '\\"')}"` : `${key}: ${val}`)
    }
  }

  lines.push('---')
  return lines.join('\n') + '\n'
}

// ─── Main per-file processing ───────────────────────────────────────────────
function processFile(filepath) {
  const content = readFileSync(filepath, 'utf8')

  // Idempotent skip: file already starts with `---\n`
  if (/^---\r?\n/.test(content)) {
    return { kind: 'skip', reason: 'already has frontmatter' }
  }

  const idKind = inferIdAndKind(basename(filepath))
  if (!idKind) {
    return { kind: 'fail', reason: 'cannot infer id/schema_kind from filename' }
  }

  const meta = {
    schema_kind: idKind.kind,
    id: idKind.id,
  }

  // Title
  const title = extractTitle(content)
  if (title) meta.title = title

  // Status
  const rawStatus = extractField(content, FIELD_ALIASES.status)
  if (rawStatus) {
    const norm = normalizeStatus(rawStatus)
    if (norm && validateStatusForKind(norm, idKind.kind)) {
      meta.status = norm
    } else {
      return { kind: 'fail', reason: `unrecognized status "${rawStatus}" for ${idKind.kind}` }
    }
  } else {
    return { kind: 'fail', reason: 'no status field found in body' }
  }

  // Type (workorder only)
  if (idKind.kind === 'workorder') {
    const rawType = extractField(content, FIELD_ALIASES.type)
    if (rawType) {
      const t = normalizeType(rawType)
      if (t) meta.type = t
    }
  }

  // Severity (bug only)
  if (idKind.kind === 'bug') {
    const raw = extractField(content, FIELD_ALIASES.severity)
    if (raw) {
      const sev = normalizeLevel(raw)
      if (sev) meta.severity = sev
    }
  }

  // Priority (plan only)
  if (idKind.kind === 'plan') {
    const raw = extractField(content, FIELD_ALIASES.priority)
    if (raw) {
      const p = normalizeLevel(raw)
      if (p) meta.priority = p
    }
  }

  // Sizing (workorder only)
  if (idKind.kind === 'workorder') {
    const raw = extractField(content, FIELD_ALIASES.sizing)
    if (raw) {
      const s = normalizeSizing(raw)
      if (s) meta.sizing = s
    }
  }

  // Datetimes
  for (const [key, aliases] of [
    ['created_at', FIELD_ALIASES.created_at],
    ['started_at', FIELD_ALIASES.started_at],
    ['completed_at', FIELD_ALIASES.completed_at],
    ['closed_at', FIELD_ALIASES.closed_at],
    ['fixed_at', FIELD_ALIASES.fixed_at],
  ]) {
    const raw = extractField(content, aliases)
    if (raw) {
      const iso = normalizeDateTime(raw)
      if (iso) meta[key] = iso
    }
  }

  // Renew count (workorder only)
  if (idKind.kind === 'workorder') {
    const raw = extractField(content, FIELD_ALIASES.renew_count)
    if (raw) {
      const n = parseInt(raw, 10)
      if (Number.isFinite(n)) meta.renew_count = n
    }
  }

  // Workdir (workorder only)
  if (idKind.kind === 'workorder') {
    const raw = extractField(content, FIELD_ALIASES.workdir)
    if (raw) meta.workdir = raw
  }

  const yaml = emitYaml(meta)
  const newContent = yaml + content

  if (!DRY_RUN) {
    writeFileSync(filepath, newContent, 'utf8')
  }

  return { kind: 'migrated', meta }
}

// ─── Main loop ──────────────────────────────────────────────────────────────
function main() {
  let files
  if (SINGLE_FILE) {
    files = [SINGLE_FILE]
  } else {
    files = readdirSync(CT_DIR)
      .filter(shouldProcess)
      .map((f) => join(CT_DIR, f))
      .filter((p) => statSync(p).isFile())
      .sort()
  }

  const stats = {
    workorder: { total: 0, skip: 0, migrated: 0, failed: 0 },
    bug: { total: 0, skip: 0, migrated: 0, failed: 0 },
    plan: { total: 0, skip: 0, migrated: 0, failed: 0 },
    experiment: { total: 0, skip: 0, migrated: 0, failed: 0 },
  }
  const failures = []

  for (const filepath of files) {
    const idKind = inferIdAndKind(basename(filepath))
    const kindKey = idKind?.kind || 'workorder'
    if (stats[kindKey]) stats[kindKey].total++

    const result = processFile(filepath)
    const rel = relative(ROOT, filepath)

    if (result.kind === 'skip') {
      if (stats[kindKey]) stats[kindKey].skip++
      if (VERBOSE) console.log(`SKIP ${rel} — ${result.reason}`)
    } else if (result.kind === 'migrated') {
      if (stats[kindKey]) stats[kindKey].migrated++
      if (VERBOSE) {
        console.log(`MIGRATE ${rel} — ${result.meta.schema_kind} status=${result.meta.status || 'N/A'}`)
      }
    } else {
      if (stats[kindKey]) stats[kindKey].failed++
      failures.push({ file: rel, reason: result.reason })
      console.error(`FAIL ${rel} — ${result.reason}`)
    }
  }

  // Summary
  console.log('\n=== Migration summary ===')
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'WRITE'}`)
  console.log(`\n類型        | 總計 | skip | migrate | fail`)
  console.log(`-----------|-----|------|---------|-----`)
  for (const [k, s] of Object.entries(stats)) {
    if (s.total === 0) continue
    console.log(
      `${k.padEnd(10)} | ${String(s.total).padStart(3)} | ${String(s.skip).padStart(4)} | ${String(s.migrated).padStart(7)} | ${String(s.failed).padStart(4)}`,
    )
  }
  const grand = Object.values(stats).reduce(
    (acc, s) => ({
      total: acc.total + s.total,
      skip: acc.skip + s.skip,
      migrated: acc.migrated + s.migrated,
      failed: acc.failed + s.failed,
    }),
    { total: 0, skip: 0, migrated: 0, failed: 0 },
  )
  console.log(
    `${'總計'.padEnd(10)} | ${String(grand.total).padStart(3)} | ${String(grand.skip).padStart(4)} | ${String(grand.migrated).padStart(7)} | ${String(grand.failed).padStart(4)}`,
  )

  if (failures.length > 0) {
    console.log('\n=== Failed files (require manual handling) ===')
    for (const f of failures) {
      console.log(`  ${f.file}: ${f.reason}`)
    }
    const failPct = (failures.length / grand.total) * 100
    if (failPct >= 10) {
      console.log(`\n⚠️  Failure rate ${failPct.toFixed(1)}% ≥ 10% — root cause analysis required`)
    }
  }

  process.exit(failures.length > 0 && grand.migrated === 0 ? 1 : 0)
}

main()
