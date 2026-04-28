# Draft: ~/.claude/skills/control-tower/SKILL.md（*sync 章節）

> ⚠️ 此 draft 由 T0343 產出，需使用者手動套用到上游 CT skill repo（沿 T0350 PR 慣例）。
> 套用步驟：
> 1. 開上游 CT skill repo
> 2. 對照本 draft diff 套用到目標路徑
> 3. PR + review + merge
> 4. 套用後請告知塔台 → 塔台更新本工單 affects_files 並關單

## 目標

更新 `*sync` 為 PLAN-034 Sprint 2 transition behavior：

- frontmatter parser 為主
- markdown body metadata fallback 為輔
- frontmatter = SoT，body table = 人類鏡像
- drift detection warn 不覆寫 body
- generated index 整檔重寫，含 frontmatter `breakdown`
- unknown status 不可 fallback PENDING
- `_archive/**` 排除 hot-zone sync

## Patch 1：掃描流程

在 `### *sync — 多類型掃描 + 自動重建索引` 的流程中，將 metadata parse 語意替換為：

```markdown
### PLAN-034 metadata reader

`*sync` 讀取 `_ct-workorders/` hot-zone 文件時，統一使用 frontmatter-first metadata reader：

1. 若檔案第一個 bytes 是 `---`，解析 YAML frontmatter。
2. 驗證 `schema_version: 1`、`schema_kind`、`id`、`status` 與 type-specific enum。
3. 若 frontmatter valid：使用 frontmatter 作為 SoT。
4. 若缺 frontmatter：fallback legacy markdown metadata table，輸出 `missing_frontmatter` warning。
5. 若 frontmatter invalid：
   - lax / guarded：若 body 可解析，fallback legacy parser 並輸出 `invalid_frontmatter` warning。
   - strict：abort sync for that file，標 invalid，不寫入正常統計 bucket。
6. 若 frontmatter/body drift：使用 frontmatter，輸出 `metadata_drift` warning，不覆寫 body。
7. Unknown status：標 invalid/unknown，不可 fallback 到 PENDING。

`_ct-workorders/_archive/**` 永遠排除；`_spec-*`、`_report-*`、`_spike-*`、`_question-*`、`_roadmap-*` 等參考文件不進入 T/BUG/PLAN/EXP 統計。
```

## Patch 2：drift detection

新增或替換 `*sync` drift 段落：

```markdown
### Frontmatter / Body Drift

Drift detection 比對 normalized metadata：

- `id`
- `title`
- `status`
- `created_at`
- `started_at`
- `completed_at`
- `closed_at`
- `sizing`
- `priority` / `severity`
- `affects_files`
- `depends_on`

Normalization:

- Strip status emoji from body table values.
- Convert localized labels to schema keys where deterministic.
- Normalize status to uppercase.
- Parse common legacy dates before timestamp comparison.
- Normalize paths to forward slashes.

Warning format:

```text
[PLAN-034 metadata_drift] T0342-research-plan034-yaml-frontmatter-schema-design.md
field=status frontmatter=IN_PROGRESS body=PENDING
action=frontmatter_used; body_not_modified
```

`*sync` 不自動覆寫 human body metadata table。只有 generated index files 可整檔重寫。
```

## Patch 3：generated index frontmatter

更新 `_bug-tracker.md` 與 `_backlog.md` 自動重建格式，在 body 前加 frontmatter：

```yaml
---
schema_version: 1
schema_kind: index
id: _bug-tracker
index_kind: bugs
generated_at: "<ISO 8601 datetime with offset>"
generator: control-tower-sync
source_globs:
  - _ct-workorders/BUG-*.md
exclude_globs:
  - _ct-workorders/_archive/**
total: <N>
breakdown:
  OPEN: <N>
  FIXING: <N>
  FIXED: <N>
  VERIFY: <N>
  CLOSED: <N>
  WONTFIX: <N>
---
```

```yaml
---
schema_version: 1
schema_kind: index
id: _backlog
index_kind: plans
generated_at: "<ISO 8601 datetime with offset>"
generator: control-tower-sync
source_globs:
  - _ct-workorders/PLAN-*.md
exclude_globs:
  - _ct-workorders/_archive/**
total: <N>
breakdown:
  IDEA: <N>
  PLANNED: <N>
  IN_PROGRESS: <N>
  DONE: <N>
  DROPPED: <N>
---
```

Rules:

- Generated index frontmatter and body are machine-owned and may be rewritten together.
- Index `total` counts only valid source records included in visible or hidden status buckets.
- Invalid/unknown records appear in warning summary and optional invalid section, not in normal status buckets.
- `breakdown` values must sum to `total` unless the body explicitly documents excluded invalid records.

## Patch 4：EXP enum and statistics

Update EXP stats to use only:

```text
EXPLORING / CONCLUDED / ABANDONED
```

Keep this as the only EXP status set during the PLAN-034 transition.

EXP inclusion rules:

- `EXPLORING` appears in active experiment stats.
- `CONCLUDED` and `ABANDONED` appear in completed/closed experiment stats or summary.
- EXP records do not affect sprint progress unless explicitly linked by a work order.

## Patch 5：error contract

Add to `*sync` error handling:

```markdown
### Error Handling Contract

| Condition | Behavior |
|-----------|----------|
| Missing frontmatter | Fallback legacy parser + `missing_frontmatter` warning |
| Invalid frontmatter in lax/guarded | Fallback legacy parser if parseable + warning |
| Invalid frontmatter in strict | Mark invalid; abort index inclusion for that record |
| Frontmatter/body drift | Use frontmatter; warn; do not overwrite body |
| Unknown status | Mark invalid/unknown; never fallback to PENDING |
| Generated index drift | Rewrite generated index frontmatter and body together |
```

Strict mode remains future Sprint 6 behavior; Sprint 2 starts lax with warnings.

## 驗收

- `*sync` docs state frontmatter-first parsing.
- Legacy markdown fallback remains for transition.
- Drift warn not overwrite is explicit.
- Generated `_bug-tracker.md` / `_backlog.md` include `schema_kind: index` and `breakdown`.
- Unknown status cannot fallback PENDING.
- `_archive/**` is excluded.
