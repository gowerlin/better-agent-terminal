# Draft: ~/.claude/skills/control-tower/references/archive-system.md

> ⚠️ 此 draft 由 T0343 產出，需使用者手動套用到上游 CT skill repo（沿 T0350 PR 慣例）。
> 套用步驟：
> 1. 開上游 CT skill repo
> 2. 對照本 draft diff 套用到目標路徑
> 3. PR + review + merge
> 4. 套用後請告知塔台 → 塔台更新本工單 affects_files 並關單

## 目標

將歸檔資格判定從 grep body table 狀態，升級為 frontmatter-first parser：

- 有 frontmatter：用 frontmatter `status` + `completed_at` / `closed_at` / conclusion time 判定
- 無 frontmatter：legacy markdown table fallback 至少保留 1 個月
- `_archive/**` 永遠排除在 hot-zone sync/migration 掃描之外
- drift 時 warn，不覆寫人類 body table

## Patch 1：歸檔資格判定

在 `## 歸檔資格判定（決策樹）` 後加入：

```markdown
### PLAN-034 frontmatter-first 判定

`*archive` 判定單據狀態與日期時使用與 `*sync` 相同的 metadata reader：

1. 若檔案有 YAML frontmatter，frontmatter 是 SoT。
2. 若無 frontmatter，fallback 既有 markdown body metadata table，並輸出 `missing_frontmatter` warning。
3. 若 frontmatter 與 body table drift，使用 frontmatter，輸出 `metadata_drift` warning，不覆寫 body。
4. Unknown status 標為 invalid/unknown，不能 fallback 到 PENDING 或非最終態。

過渡期 legacy markdown table fallback 至少保留 1 個月，直到 PLAN-034 Sprint 5 dogfood criteria 通過。
```

## Patch 2：最終態與日期欄位

將 `### 最終態定義` 後的日期說明補強為：

```markdown
### 最終態與日期欄位來源

| 單據類型 | 最終態 | frontmatter 日期欄位 | legacy fallback |
|---------|--------|----------------------|-----------------|
| Work Order (T####) | DONE, FIXED, FAILED, PARTIAL | `completed_at` | `完成時間` |
| Bug Report (BUG-###) | CLOSED, WONTFIX | `closed_at` 或 `updated_at` | `關閉時間` / `更新時間` / `建立時間` |
| Plan (PLAN-###) | DONE, DROPPED | `completed_at` 或 `updated_at` | `完成時間` / `更新時間` / `建立時間` |
| Experiment (EXP-*) | CONCLUDED, ABANDONED | `concluded_at` 或 `updated_at` | `結論時間` / `建立時間` |

日期欄位優先使用 quoted ISO 8601 with offset，例如 `"2026-04-28T19:16:49+08:00"`。
若日期缺失，保留既有降級行為：以建立時間為候選天數基準，但摘要中標示 `date_fallback=created_at`。
```

保留現行最終態表，但建議把 Work Order 的 final state 從 `DONE, FAILED` 擴充為：

```markdown
DONE, FIXED, FAILED, PARTIAL
```

理由：BUG 修復工單收尾使用 `FIXED`；`PARTIAL` 是可歸檔的非進行中結果，但需由塔台覆核 archive_days 與引用豁免。

## Patch 3：掃描排除

在執行流程 Step 1：

```markdown
1. 掃描 _ct-workorders/*.md（排除 _archive/ 和 _ 開頭系統文件）
```

補成：

```markdown
1. 掃描 `_ct-workorders/*.md` hot-zone 檔案。
   - 永遠排除 `_ct-workorders/_archive/**`。
   - 永遠排除 `_ct-workorders/_spec-*.md`、`_report-*.md`、`_spike-*.md`、`_question-*.md`、`_roadmap-*.md`。
   - frontmatter migration 也不得掃描 `_archive/**`。
```

## Patch 4：warning 格式

新增：

```markdown
### Frontmatter transition warnings

```text
[PLAN-034 missing_frontmatter] T0045-user-auth.md
action=legacy_archive_parser_used; fallback_retained_until=2026-05-28

[PLAN-034 metadata_drift] BUG-003-login-crash.md
field=status frontmatter=CLOSED body=VERIFY
action=frontmatter_used; body_not_modified

[PLAN-034 invalid_status] PLAN-002-refactor.md
field=status value=COMPLETE
action=archive_candidate_skipped; reason=unknown_status
```
```

## 驗收

- 歸檔判定使用 frontmatter status first。
- `completed_at` / `closed_at` / `concluded_at` 等欄位優先於 body table。
- legacy markdown table fallback 明確保留至少 1 個月。
- Unknown status 不會被當成 PENDING 或安全非最終態靜默略過。
- `_archive/**` 在 sync、migration、archive candidate scan 中都明確排除。
