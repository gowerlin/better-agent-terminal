# Draft: ~/.claude/skills/ct-exec/SKILL.md / ~/.claude/skills/ct-done/SKILL.md / ~/.claude/skills/ct-status/SKILL.md

> ⚠️ 此 draft 由 T0343 產出，需使用者手動套用到上游 CT skill repo（沿 T0350 PR 慣例）。
> 套用步驟：
> 1. 開上游 CT skill repo
> 2. 對照本 draft diff 套用到目標路徑
> 3. PR + review + merge
> 4. 套用後請告知塔台 → 塔台更新本工單 affects_files 並關單

## 目標

更新 helper skills 的 Worker guidance，使其在 PLAN-034 frontmatter transition 中維持 frontmatter SoT：

- `ct-exec` 開工填 `started_at`，status `PENDING → IN_PROGRESS`
- `ct-done` 收尾填 `completed_at`、status `IN_PROGRESS → DONE/FIXED/PARTIAL/FAILED/BLOCKED`、`renew_count`、`commit`
- `ct-status` 讀 frontmatter status first，legacy body table fallback second
- YAML list 欄位使用 block list
- 時間使用 quoted ISO 8601 with offset
- runtime mode 仍由 `CT_MODE` env 決定，frontmatter `interaction.mode_hint` 不可作為 runtime mode source

## Shared patch：frontmatter SoT rules

在三個 helper skill 的「定位並讀取工單」或「元資料讀取」附近加入：

```markdown
### PLAN-034 frontmatter transition

若工單檔案含 v1 YAML frontmatter：

1. Frontmatter 是機器 SoT；body metadata table 是人類鏡像。
2. Worker 修改狀態、開始/完成時間、commit、renew_count 時，必須先更新 frontmatter。
3. Body table 可同步更新作為人類鏡像；若同步會造成大範圍重寫，至少在回報區記錄 drift。
4. `affects_files`、`depends_on`、`followups` 等 list 欄位使用 YAML block list。
5. 時間欄位使用 quoted ISO 8601 with offset，例如 `"2026-04-28T19:16:49+08:00"`。
6. `interaction.mode_hint` 只記錄派發意圖；Worker runtime mode 仍只能讀 `CT_MODE` env。

若缺 frontmatter：

- 沿用現行 body metadata table 流程。
- 不在本 helper skill 中主動大規模遷移舊工單；migration 屬 PLAN-034 Sprint 4。
```

## ct-exec patch

在 Step 3「填寫開始時間」補強：

```markdown
### Step 3：填寫開始時間（frontmatter-first）

取得當前時間，Edit 工單：

若有 v1 frontmatter：

```yaml
status: IN_PROGRESS
started_at: "<ISO 8601 datetime with offset>"
updated_at: "<ISO 8601 datetime with offset>"
```

若 body metadata table 存在，同步人類鏡像：

- 狀態：PENDING → IN_PROGRESS
- 開始時間：填入實際時間

反序/一致性原則：

- 開工階段允許先改 status，因工單需要立即顯示 IN_PROGRESS。
- 若 frontmatter 與 body metadata table drift，後續 `*sync` 使用 frontmatter 並 warn。
```

在 Step 8 收尾 checklist 補：

```markdown
- [ ] 若有 frontmatter，回報區完成後先填 `completed_at` / `updated_at` / `commit`
- [ ] 最後才修改 frontmatter `status`
- [ ] body metadata table 作為人類鏡像同步更新
```

## ct-done patch

在 Step 6「更新工單檔案」補：

```markdown
### Step 6：更新工單檔案（frontmatter-first + 反序寫入）

若工單有 v1 frontmatter，先填回報區，再更新以下欄位：

```yaml
completed_at: "<ISO 8601 datetime with offset>"
updated_at: "<ISO 8601 datetime with offset>"
renew_count: <N>
commit: <short hash or full hash>
status: DONE
```

狀態依使用者或回報內容決定：

- 一般完成：`DONE`
- BUG 修復工單：`FIXED`
- 部分完成：`PARTIAL`
- 失敗：`FAILED`
- 卡住：`BLOCKED`

最後才修改 frontmatter `status` 與 body metadata table 狀態，避免 watcher 在回報區尚未完成時讀到終態。
```

在 commit 檢查段補：

```markdown
若有 commit hash，frontmatter `commit` 使用短 hash 即可；body 回報區可寫完整 commit summary。
若未 commit，`commit` 欄位可省略，不寫空字串。
```

## ct-status patch

將情境 A/B 的 metadata 讀取規則改為：

```markdown
### Metadata reader

1. 若檔案有 v1 YAML frontmatter：讀取 frontmatter `id/title/status/created_at/started_at/completed_at`。
2. 若缺 frontmatter：fallback 既有 body metadata table。
3. 若 frontmatter/body drift：顯示 frontmatter 狀態，並在詳細模式提示 `metadata_drift`。
4. Unknown status：顯示 `UNKNOWN` / `invalid`，不可推測為 PENDING。
```

狀態符號表補：

```markdown
| UNKNOWN / invalid | ❓ |
```

並保留既有：

```markdown
| URGENT | 🔥 |
```

`URGENT` 註解：

```markdown
`URGENT` 是 interruption protocol 的 priority signal-as-status special case；ct-status 顯示為 urgent bucket，不與 terminal lifecycle statuses 合併。
```

## 驗收

- `ct-exec` 開工 guidance 明示 frontmatter `started_at` + `status: IN_PROGRESS`。
- `ct-done` 收尾 guidance 明示 `completed_at`、`renew_count`、`commit`、最後更新 status。
- `ct-status` frontmatter status first，legacy fallback second。
- 三者都保留 body metadata table 作為人類鏡像。
- 三者都沒有把 frontmatter `interaction.mode_hint` 當作 runtime `CT_MODE`。
