# Draft: ~/.claude/skills/control-tower/references/bug-plan-system.md

> ⚠️ 此 draft 由 T0343 產出，需使用者手動套用到上游 CT skill repo（沿 T0350 PR 慣例）。
> 套用步驟：
> 1. 開上游 CT skill repo
> 2. 對照本 draft diff 套用到目標路徑
> 3. PR + review + merge
> 4. 套用後請告知塔台 → 塔台更新本工單 affects_files 並關單

## 目標

讓 BUG / PLAN / EXP 新單據模板輸出 v1 YAML frontmatter，並保留原 body metadata table 作為人類鏡像。

核心契約：

- frontmatter = SoT
- body table = 人類鏡像
- drift 時 `*sync` warn，不覆寫 body table
- EXP status enum 必須是 `EXPLORING / CONCLUDED / ABANDONED`

## 共通 patch

在 `BUG 單據`、`PLAN 單據`、`EXP 實驗單據` 的模板段落前加入共通規則：

```markdown
### YAML frontmatter 規則

新建 BUG / PLAN / EXP 單據時，檔案第一個 bytes 必須是 v1 YAML frontmatter。
Frontmatter 是機器 SoT；body metadata table 僅為人類速查鏡像。
若兩者 drift，`*sync` 使用 frontmatter、輸出 warning，不自動覆寫 body table。

時間欄位使用 quoted ISO 8601 with offset，例如 `"2026-04-28T19:16:49+08:00"`。
list 欄位使用 YAML block list。`_archive/**` 不參與 hot-zone sync migration。
```

## BUG template patch

在 BUG 建立流程與模板說明中加入：

```markdown
### BUG frontmatter template

```yaml
---
schema_version: 1
schema_kind: bug
id: BUG-###
title: <bug 標題>
status: OPEN
severity: medium
reproducibility: always
created_at: "<ISO 8601 datetime with offset>"
links:
  related_workorders:
    - T####
affects_files:
  - <repo-relative path>
---
```

狀態 enum：`OPEN / FIXING / FIXED / VERIFY / CLOSED / WONTFIX`。
`severity` 建議用 `low / medium / high / critical`；body table 可繼續顯示 emoji。
```

在 BUG 元資料解析規則後補：

```markdown
> PLAN-034 transition：`*sync` 先讀 frontmatter；無 frontmatter 才 fallback legacy body metadata table 並警告 `missing_frontmatter`。
> Unknown status 必須標為 invalid/unknown，不可 fallback 成 OPEN 或 PENDING。
```

## PLAN template patch

在 PLAN 建立流程與模板說明中加入：

```markdown
### PLAN frontmatter template

```yaml
---
schema_version: 1
schema_kind: plan
id: PLAN-###
title: <plan 標題>
status: IDEA
priority: medium
created_at: "<ISO 8601 datetime with offset>"
plan_type:
  - technical-improvement
trigger_bugs:
  - BUG-###
scope:
  - <scope item>
estimated_workorders: 3
---
```

狀態 enum：`IDEA / PLANNED / IN_PROGRESS / DONE / DROPPED`。
`priority` 建議用 `low / medium / high / critical`；body table 可繼續顯示 emoji。
```

在 PLAN 元資料解析規則後補：

```markdown
> PLAN-034 transition：`*sync` 先讀 frontmatter；無 frontmatter 才 fallback legacy body metadata table 並警告 `missing_frontmatter`。
> Generated `_backlog.md` 可整檔重寫，但 human PLAN body table 不因 drift 自動覆寫。
```

## EXP template patch

將現有 `## EXP 模板` 的 fenced markdown 開頭：

```markdown
# EXP-[TOPIC]-###-description

## 元資料
```

改為：

```markdown
---
schema_version: 1
schema_kind: experiment
id: EXP-[TOPIC]-###
title: <實驗主題簡述>
status: EXPLORING
topic: <TOPIC 名稱>
created_at: "<ISO 8601 datetime with offset>"
driving_decision: <D### 或工單 ID>
related_plan: PLAN-###
success_criteria:
  - <criteria 1>
  - <criteria 2>
---
# EXP-[TOPIC]-###-description

<!-- frontmatter = SoT；body metadata table = 人類鏡像；drift 時 *sync warn 不覆寫。 -->

## 元資料
```

在 EXP 狀態機段落下補充：

```markdown
EXP frontmatter status enum 固定為 `EXPLORING / CONCLUDED / ABANDONED`。
此三值是 PLAN-034 Sprint 2 對齊現行 CT skill 與 EXP-HEADLESS-001 熱區慣例的唯一 EXP enum。
```

## Sync integration note

將 BUG / PLAN / EXP 三處 `元資料解析規則` 的語意調整為：

```markdown
解析順序：
1. 若檔案有 YAML frontmatter：validate schema_version/schema_kind/id/status，使用 frontmatter 作為 SoT。
2. 若缺 frontmatter：fallback 既有 markdown body metadata table，並在 sync summary 輸出 `missing_frontmatter` warning。
3. 若 frontmatter 與 body table drift：使用 frontmatter，輸出 `metadata_drift` warning，不覆寫 body。
4. Unknown status：標 invalid/unknown，不可 fallback 到 PENDING 或其他預設狀態。
```

## 驗收

- BUG / PLAN / EXP templates 均有 v1 frontmatter block。
- EXP enum 全文使用 `EXPLORING / CONCLUDED / ABANDONED`。
- 三類都保留 legacy body metadata table fallback。
- 三類都明示 frontmatter SoT、body mirror、drift warn 不覆寫。
