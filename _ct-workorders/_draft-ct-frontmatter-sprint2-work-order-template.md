# Draft: ~/.claude/skills/control-tower/references/work-order-template.md

> ⚠️ 此 draft 由 T0343 產出，需使用者手動套用到上游 CT skill repo（沿 T0350 PR 慣例）。
> 套用步驟：
> 1. 開上游 CT skill repo
> 2. 對照本 draft diff 套用到目標路徑
> 3. PR + review + merge
> 4. 套用後請告知塔台 → 塔台更新本工單 affects_files 並關單

## 目標

讓新工單模板從建立時就雙寫 v1 YAML frontmatter 與既有 body metadata table。

核心契約：

- frontmatter = SoT
- body table = 人類鏡像
- drift 時 `*sync` 告警，不覆寫人類 body
- legacy markdown table fallback parser 至少保留到 PLAN-034 transition 完成
- `interaction.mode_hint` 只記錄派發意圖，runtime mode 仍以 `CT_MODE` env 為準

## Patch

在檔案開頭的 fenced `markdown` 範本中，將原本直接從 H1 開始的內容：

```markdown
# 工單 T<編號>-<描述>

## 元資料
- **工單編號**：T<編號>
```

改為：

```markdown
---
schema_version: 1
schema_kind: workorder
id: T<編號>
title: <任務描述>
type: impl
status: PENDING
project: <目標子專案或 PLAN/BUG 編號>
created_at: "<ISO 8601 datetime with offset>"
sizing: M
depends_on:
  - <前置工單或文件 ID>
followups:
  - <後續工單或文件 ID>
affects_files:
  - <相對路徑 1>
  - <相對路徑 2>
interaction:
  mode_hint: ask
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
---
# 工單 T<編號>-<描述>

<!--
frontmatter = SoT；body metadata table = 人類鏡像。
若 frontmatter 與 body table drift，*sync 必須 warn 並使用 frontmatter，
不得自動覆寫人類維護的 body table。
-->

## 元資料
- **工單編號**：T<編號>
```

## 欄位填寫規則

### `schema_version` / `schema_kind`

固定值：

```yaml
schema_version: 1
schema_kind: workorder
```

### `id` / `title`

- `id` 使用 `T####`，不含檔名描述。
- `title` 使用不含狀態 emoji 的人類標題。
- body H1 可保留既有格式，供人類掃描。

### `type`

使用 PLAN-034 spec 的 uppercase-insensitive 工作類型，建議模板列出常用值：

```yaml
type: impl # research / impl / fix / test / docs / refactor / audit / spike / chore
```

### `status`

新工單預設：

```yaml
status: PENDING
```

允許值：

```text
PENDING / IN_PROGRESS / DONE / FIXED / FAILED / BLOCKED / PARTIAL / INTERRUPTED / URGENT
```

`URGENT` 是 interruption protocol 產生的 priority signal-as-status special case；可與 `priority: critical` 同時存在。

### `affects_files`

使用 YAML block list，不使用 JSON array：

```yaml
affects_files:
  - _ct-workorders/T0342-*.md
  - src/types/control-tower.ts
```

路徑使用 repo-relative forward slashes。

### `interaction`

```yaml
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
```

注意：

- `mode_hint` 是文件化意圖，不是 Worker runtime mode source。
- Worker runtime mode 仍只能由塔台注入的 `CT_MODE` env 決定。
- `intervention_type` 保留既有三值：`fire-and-forget` / `context-dependent` / `decision-requiring`。

## Body metadata mirror

既有 body metadata table 不刪除，改成 frontmatter 的人類鏡像：

```markdown
## 元資料
- **工單編號**：T<編號>
- **任務名稱**：<任務描述>
- **狀態**：PENDING
- **建立時間**：<當前時間> (UTC+8)
- **開始時間**：（sub-session 開始時填入）
- **完成時間**：（完成時填入）
- **目標子專案**：（mono-repo 時填寫，單一專案可留空）
- **intervention_type**：fire-and-forget / context-dependent / decision-requiring
- **affects_files**：
  - `<相對路徑 1>`
  - `<相對路徑 2>`
```

補充說明插在 `## 元資料` 前後皆可：

```markdown
> Frontmatter 是機器 SoT；本段元資料只供人類速查。
> 若兩者不一致，`*sync` 使用 frontmatter 並輸出 drift warning，不自動覆寫本段。
> 過渡期 legacy markdown table fallback parser 仍保留；缺 frontmatter 的舊工單只警告不立即失效。
```

## 驗收

- 新模板產出的工單第一個 bytes 是 `---`。
- 新模板保留原 body metadata table。
- 模板明示 frontmatter SoT / body mirror / drift warn not overwrite。
- `affects_files`、`depends_on`、`followups` 均使用 YAML block list。
- `interaction.mode_hint` 不被描述為 runtime mode source。
