# T0343 — Impl PLAN-034 Sprint 2 — CT 模板 + skill 文件 + sync 邏輯（draft 雙軌：spec patch + upstream PR draft）

## Metadata

| 欄位 | 內容 |
|------|------|
| 工單編號 | T0343 |
| 類型 | impl + docs（雙軌：本專案 spec patch + 上游 CT skill draft） |
| 所屬 | PLAN-034 — Sprint 2 |
| 狀態 | 🚧 IN_PROGRESS |
| 建立時間 | 2026-04-28 19:30 (UTC+8) |
| Sizing | M-L（estimate 60-120 min wall：spec P1/P2 patch + 4-5 個 skill draft） |
| 依賴 | T0342 ✅（spec + 5 範例已落地） |
| 後續 | T0344（Sprint 3：BAT UI parser frontmatter-first 改造） |
| 互動旗標 | `--mode yolo --no-interactive`（YOLO 自主執行，依 spec + 本工單拍板） |
| Renew 次數 | 0 |
| 工作目錄 | main repo（不需 worktree，純文件產出） |
| `affects_files` | `_ct-workorders/_spec-yaml-frontmatter-schema.md`（in-place patch P1/P2）+ `_ct-workorders/_draft-ct-frontmatter-sprint2-*.md`（多份 draft，人類手動上游 PR）+ 本工單回報區 |
| 開始時間 | 2026-04-28 19:31:54 +08:00 |

---

## ⚠️ 關鍵 scope 限制

**Layer 1 唯讀**：禁止寫入 `~/.claude/skills/` 路徑下任何檔案。違反即 abort。

**Worker 必須遵守**：
- ✅ 修本專案 `_ct-workorders/_spec-yaml-frontmatter-schema.md`（spec P1/P2 patch）
- ✅ 在 `_ct-workorders/_draft-*.md` 產出 upstream CT skill 變更草稿（沿 T0350 慣例）
- ❌ 不可直接 Edit/Write `~/.claude/skills/control-tower/**` 任何檔案
- ❌ 不可直接 Edit/Write `~/.claude/skills/ct-*/**` 任何檔案

**理由**：CT skill 升級走人工 upstream PR 流程，Worker 只產出 draft 給使用者手動套用。

---

## 背景

T0342 完成 PLAN-034 schema 設計（spec + 5 範例檔），9 項拍板全部落地。塔台覆核時發現 2 個 minor 漂移需在 Sprint 2 一併處理：

**P1. EXP status enum 不一致**
- Spec L121-124 寫 `PROPOSED / RUNNING / CONCLUDED / ABANDONED`
- 現行 CT skill（`bug-plan-system.md`）+ 熱區 EXP-HEADLESS-001：`EXPLORING / CONCLUDED / ABANDONED`
- 拍板：**沿用現行 `EXPLORING / CONCLUDED / ABANDONED`**（避免遷移期 enum 漂移）

**P2. Workorder status `URGENT` 語義**
- Spec L100 列 URGENT 為 status
- 語義疑慮：URGENT 較像 priority signal 的 special status
- 拍板：保留 URGENT 為 status（符合中斷協議現狀），spec 加註明

## 任務目標

雙軌交付：

### 軌道 A：本專案 spec patch（in-place edit）

修 `_ct-workorders/_spec-yaml-frontmatter-schema.md`：

- **P1 patch**：將 EXP status enum 從 `PROPOSED / RUNNING / CONCLUDED / ABANDONED` 改為 `EXPLORING / CONCLUDED / ABANDONED`，含 reasoning 註明「對齊現行 CT skill `bug-plan-system.md` 與熱區 EXP-HEADLESS-001 慣例，避免遷移期 enum 漂移」
- **P2 patch**：在 Workorder status enum 旁加 note 說明 `URGENT` 是 priority signal-as-status special case（中斷協議產生），不與 `DONE/FAILED/PARTIAL` 等生命週期 status 互斥；frontmatter 同時可有 `priority: critical` + `status: URGENT`

### 軌道 B：上游 CT skill 變更 draft（output to `_draft-*` files）

Worker 產出以下 draft 檔（每個獨立檔），格式為「目標路徑 + diff/patch + 套用說明」：

1. **`_draft-ct-frontmatter-sprint2-work-order-template.md`**
   - 目標：`~/.claude/skills/control-tower/references/work-order-template.md`
   - 內容：在工單模板頂部加入 v1 frontmatter block（schema_version: 1, schema_kind: workorder, id, type, status, project, created_at, sizing, depends_on, affects_files, interaction）
   - 保留現有 markdown body metadata 表（人類速查鏡像）
   - 新增模板註解：「frontmatter = SoT，body table 為人類鏡像，drift 時 sync 告警不覆寫」

2. **`_draft-ct-frontmatter-sprint2-bug-plan-system.md`**
   - 目標：`~/.claude/skills/control-tower/references/bug-plan-system.md`
   - 內容：BUG/PLAN/EXP 三類模板加 v1 frontmatter
   - **EXP enum 必須是 `EXPLORING / CONCLUDED / ABANDONED`**（非 spec 預設）
   - 對齊 spec §Bug Extension / §Plan Extension / §Experiment Extension 欄位

3. **`_draft-ct-frontmatter-sprint2-archive-system.md`**
   - 目標：`~/.claude/skills/control-tower/references/archive-system.md`
   - 內容：歸檔資格判定改用 frontmatter `status` + `completed_at` / `closed_at` 解析（取代現行 grep `\| 狀態 \|`）
   - 過渡期說明：legacy markdown table fallback parser 保留 ≥1 個月

4. **`_draft-ct-frontmatter-sprint2-sync-logic.md`**
   - 目標：`~/.claude/skills/control-tower/SKILL.md`（`*sync` 子命令章節）
   - 內容：`*sync` 行為更新
     - frontmatter parser 為主，markdown body table fallback 為輔
     - drift detection（依 spec §Frontmatter / Body Drift 偽碼）
     - drift 處理策略：warn 不覆寫人類 body
     - generated index 整檔重寫（含 frontmatter `breakdown`）
     - 統計欄位 inclusion 規則
   - **對齊 spec §Error Handling Contract**：unknown status 不可 fallback PENDING

5. **`_draft-ct-frontmatter-sprint2-helper-skills.md`**
   - 目標：`~/.claude/skills/ct-exec/SKILL.md` / `~/.claude/skills/ct-done/SKILL.md` / `~/.claude/skills/ct-status/SKILL.md`
   - 內容：Worker 收尾流程更新
     - ct-exec：開工填 `started_at`、status `PENDING → IN_PROGRESS`
     - ct-done：收尾填 `completed_at`、status `IN_PROGRESS → DONE/FIXED/PARTIAL`、`renew_count`、`commit`
     - ct-status：讀取 frontmatter status 為主
   - 強調 frontmatter SoT 寫入方式（YAML block list、ISO 8601 quoted timestamp、uppercase enum）

### 套用說明（每份 draft 必含）

每個 `_draft-*.md` 檔頂部包含：

```markdown
# Draft: [target path]

> ⚠️ 此 draft 由 T0343 產出，需使用者手動套用到上游 CT skill repo（沿 T0350 PR 慣例）。
> 套用步驟：
> 1. 開上游 CT skill repo
> 2. 對照本 draft diff 套用到目標路徑
> 3. PR + review + merge
> 4. 套用後請告知塔台 → 塔台更新本工單 affects_files 並關單
```

## YOLO 拍板原則

由於 `--mode yolo --no-interactive`，Worker 無法問使用者。拍板時依以下：

1. **遵循 spec SoT**：spec 已是 PLAN-034 SoT，draft 內容必須對齊（除 P1 EXP enum 強制 override）
2. **保守過渡**：所有 CT skill draft 必須保留 legacy markdown table fallback（≥1 個月）
3. **清楚分軌**：spec patch（軌道 A）走 in-place edit；CT skill 變更（軌道 B）只能寫 `_draft-*` 檔
4. **不過度設計**：不寫 migration script（屬 Sprint 4）、不寫 BAT parser code（屬 Sprint 3）、不啟用 strict mode（屬 Sprint 6）
5. **Worker 自評難度**：若 draft 任一份超過合理規模（如 SKILL.md sync section > 200 行 patch），記入回報區「待人工審視」

> 偏離以上任一原則須在回報區明確記錄理由。

## 自檢清單

- [x] 軌道 A：spec P1 patch（EXP enum 改 EXPLORING/CONCLUDED/ABANDONED + reasoning 註明）
- [x] 軌道 A：spec P2 patch（URGENT special case 註明）
- [x] 軌道 B：5 份 draft 全產出（work-order-template / bug-plan-system / archive-system / sync-logic / helper-skills）
- [x] 每份 draft 頂部含「套用說明」段落
- [x] EXP enum 在所有 draft 引用處皆為 `EXPLORING / CONCLUDED / ABANDONED`
- [x] 所有 draft 強調 frontmatter = SoT、body table = 鏡像、drift warn 不覆寫
- [x] legacy markdown table fallback parser 在 draft 中明確保留
- [x] 不修改任何 `~/.claude/skills/` 路徑下檔案（Layer 1 readonly）
- [x] 不寫 migration script / BAT parser / strict mode 相關 code（屬後續 sprint）
- [x] 回報區包含：兩軌交付清單、套用 next step、超規模 patch 標記（如有）

## 重要約束

1. **Layer 1 readonly 硬限制**：違反即工單 FAILED
2. **不啟動 strict mode**：spec 起步策略是 lax，draft 中明確說明過渡期 strict 啟用條件
3. **不動現行熱區單據**：~140 張單據遷移屬 Sprint 4，本 sprint 不執行
4. **不動 BAT source code**：BAT parser 改造屬 Sprint 3
5. **`_archive/` 排除**：所有 draft 中的 sync/migration 邏輯都明確排除 `_archive/**`

---

## 回報區（Worker 完成後填寫）

### 軌道 A 交付

- [x] `_spec-yaml-frontmatter-schema.md` P1 patch（line 120-127）：Experiment status enum 改為 `EXPLORING / CONCLUDED / ABANDONED`，並補 reasoning：對齊現行 CT skill `bug-plan-system.md` 與 EXP-HEADLESS-001，避免遷移期 enum 漂移。
- [x] `_spec-yaml-frontmatter-schema.md` P2 patch（line 90-102）：保留 `URGENT` 為 workorder status，補充其為 interruption protocol 產生的 priority signal-as-status special case，可與 `priority: critical` 同時存在，且不與 terminal lifecycle status 互斥。

### 軌道 B 交付

| Draft 檔 | 目標路徑 | 規模（行數） | 套用難度評估 |
|----------|----------|-------------|-------------|
| _draft-ct-frontmatter-sprint2-work-order-template.md | ~/.claude/skills/control-tower/references/work-order-template.md | 173 | 中：模板頂部新增 frontmatter block，保留 body metadata mirror |
| _draft-ct-frontmatter-sprint2-bug-plan-system.md | ~/.claude/skills/control-tower/references/bug-plan-system.md | 167 | 中：BUG/PLAN/EXP 三類模板都要補 frontmatter；EXP enum 已固定為 EXPLORING/CONCLUDED/ABANDONED |
| _draft-ct-frontmatter-sprint2-archive-system.md | ~/.claude/skills/control-tower/references/archive-system.md | 106 | 小-中：歸檔判定改 frontmatter-first，legacy fallback 保留 ≥1 個月 |
| _draft-ct-frontmatter-sprint2-sync-logic.md | ~/.claude/skills/control-tower/SKILL.md（*sync 章節） | 182 | 中-高：涉及 parser order、drift warning、generated index frontmatter、unknown status error contract |
| _draft-ct-frontmatter-sprint2-helper-skills.md | ~/.claude/skills/ct-{exec,done,status}/SKILL.md | 151 | 中：ct-exec/ct-done/ct-status 三個 helper skill guidance 同步 |

### 偏離塔台原則的決策

無。未修改 `~/.claude/skills/**`；僅讀取目標檔案以確認 draft context。

### 後續動作建議

建議人工套用順序：

1. `work-order-template.md`：先讓新工單開始產生 frontmatter。
2. `bug-plan-system.md`：同步 BUG / PLAN / EXP 新單據模板，確認 EXP enum 只用 `EXPLORING / CONCLUDED / ABANDONED`。
3. `SKILL.md` `*sync` 章節：落地 frontmatter-first parser、drift warning、generated index frontmatter、unknown status error contract。
4. `archive-system.md`：讓 archive 判定共用 frontmatter-first metadata reader。
5. `ct-exec` / `ct-done` / `ct-status` helper skills：最後同步 Worker 開工、收尾、查詢 guidance。

超規模 patch 標記：無。5 份 draft 均低於 200 行；`sync-logic` 182 行，建議 review 時優先看 error contract 與 generated index frontmatter。

### 遭遇問題

無。工作樹原本已有 T0342、`_backlog.md`、`_bug-tracker.md`、BUG-077、PLAN-034 等非本工單變更；本工單未修改這些既有變更。

### 互動紀錄

無。

### Renew 歷程

無。

### 回報時間 / commit

- 回報時間：2026-04-28 19:37:08 +08:00
- 驗證：
  - `rg -n "PROPOSED|RUNNING" _ct-workorders --glob "_draft-ct-frontmatter-sprint2-*.md"`：無結果（exit 1）。
  - `git diff --check -- ...`：通過；僅顯示 `_spec-yaml-frontmatter-schema.md` LF/CRLF warning。
  - Draft consistency table：5 份 draft 均含套用步驟、SoT/body mirror、legacy fallback、drift warning。
- commit：待 commit 後回填。
