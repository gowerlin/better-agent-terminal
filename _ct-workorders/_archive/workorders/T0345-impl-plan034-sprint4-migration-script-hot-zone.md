---
schema_version: 1
schema_kind: workorder
id: T0345
title: Impl PLAN-034 Sprint 4 — Migration script + 熱區 ~140 張單據遷移
type: impl
status: DONE
sizing: M
created_at: "2026-04-28T19:58:00+08:00"
started_at: "2026-04-28T19:59:00+08:00"
completed_at: "2026-04-28T20:04:00+08:00"
renew_count: 0
workdir: main repo
---
# T0345 — Impl PLAN-034 Sprint 4 — Migration script + 熱區 ~140 張單據遷移

## Metadata

| 欄位 | 內容 |
|------|------|
| 工單編號 | T0345 |
| 類型 | impl + migration |
| 所屬 | PLAN-034 — Sprint 4 |
| 狀態 | ✅ DONE |
| 建立時間 | 2026-04-28 19:58 (UTC+8) |
| 開始時間 | 2026-04-28 19:59 (UTC+8) |
| 完成時間 | 2026-04-28 20:04 (UTC+8) |
| Sizing | M（estimate 45-90 min wall：script + 熱區遷移 + idempotent 驗證） |
| 依賴 | T0342 spec ✅ / T0343 drafts ✅ / T0344 parser ✅ |
| 後續 | T0346（Sprint 5：dogfood + BUG-077 收斂 + parser parity tests） |
| 互動旗標 | `--mode yolo --no-interactive` |
| Renew 次數 | 0 |
| 工作目錄 | main repo |
| `affects_files` | `scripts/migrate-ct-frontmatter.mjs`（新檔）+ `_ct-workorders/*.md`（熱區 ~140 張）+ 本工單回報區 |

---

## ⚠️ scope 限制

- ✅ 新建 `scripts/migrate-ct-frontmatter.mjs`（Node.js，沿 BAT helper script 慣例）
- ✅ 修改 `_ct-workorders/` 熱區所有 `.md` 單據（加 frontmatter）
- ❌ 不動 `_ct-workorders/_archive/**`（spec 明定凍結）
- ❌ 不動 `~/.claude/skills/**`（Layer 1 readonly）
- ❌ 不動 BAT source code（屬 Sprint 3，已完成）
- ❌ 不動現有 spec/example 檔（_spec-*.md / _draft-*.md / examples/）
- ❌ 不動非單據檔案（`_tower-state.md` / `_local-rules.md` / `_learnings.md` / `_cross-references.md` / `_decision-log.md` / `_bug-tracker.md` / `_backlog.md` 等系統文件）

---

## 背景

T0344 落地 BAT parser（frontmatter-first + legacy fallback），現可解析含 frontmatter 的單據。
熱區 ~140 張單據（106 T + 19 BUG + 13 PLAN + 1 EXP + 1 CT-T）目前都還是 markdown table only，需 script 自動遷移。

Sprint 4 任務：寫一支 idempotent migration script，把熱區所有單據加上 v1 frontmatter（推斷 status / id / type 等欄位從現有 metadata 表抽出來），不動 archive、不動系統文件、不動 spec/draft/example。

## 任務目標

### 1. Migration script: `scripts/migrate-ct-frontmatter.mjs`

**功能**：
- Glob `_ct-workorders/*.md`，排除：
  - `_archive/**`
  - `_spec-*.md`、`_draft-*.md`、`_report-*.md`、`_spike-*.md`、`_question-*.md`、`_roadmap-*.md`
  - `_tower-state.md`、`_local-rules.md`、`_learnings.md`、`_cross-references.md`、`_tower-config.yaml`
  - 索引檔（`_decision-log.md`、`_bug-tracker.md`、`_backlog.md`）— 屬 generated index，未來由 `*sync` 自寫 frontmatter，本 script 不動
  - `examples/**`（已是範例）
- 對每個檔案：
  1. 偵測檔名前綴 → 推斷 `schema_kind`（T → workorder, BUG → bug, PLAN → plan, EXP → experiment, CT-T → workorder）
  2. 從現有 markdown table 抽 metadata（status / type / 嚴重度 / 優先級 / 建立時間 / 完成時間 / sizing / Renew 次數）
  3. Status 正規化：strip emoji → uppercase → enum check
  4. 缺失欄位處理：跳過該欄（不寫空值，遵循 spec §`Frontmatter Contract` rule "Missing optional values use omission, not empty strings"）
  5. 已有 frontmatter → idempotent skip（不覆蓋）
  6. 寫入 frontmatter block 到 H1 之前

**CLI 介面**：
```
node scripts/migrate-ct-frontmatter.mjs [--dry-run] [--verbose] [--file PATH]
```

- `--dry-run`：只列出會改的檔，不寫
- `--verbose`：詳細輸出每個檔案的推斷結果
- `--file PATH`：只處理指定檔（測試用）

**輸出**：
- 統計：總掃描 / 已有 frontmatter（skip）/ 新增 frontmatter / 失敗（無法推斷 schema_kind 或 status）
- 失敗清單：明確列出檔名 + 原因，使用者可手動補

### 2. Status 正規化規則

| Body table 寫法 | frontmatter status |
|---------------|---------------------|
| `✅ DONE` / `DONE` | `DONE` |
| `🔄 IN PROGRESS` / `IN_PROGRESS` | `IN_PROGRESS` |
| `📋 TODO` / `📋 PENDING` / `PENDING` | `PENDING` |
| `❌ FAILED` / `FAILED` | `FAILED` |
| `⚡ INTERRUPTED` | `INTERRUPTED` |
| `🔥 URGENT` | `URGENT` |
| `🚫 CLOSED` | `CLOSED` |
| `🔍 VERIFY` / `VERIFY` | `VERIFY` |
| `🔨 FIXED` / `✅ FIXED` / `FIXED` | `FIXED` |
| `🐛 OPEN` / `OPEN` | `OPEN` |
| `🔧 FIXING` / `FIXING` | `FIXING` |
| `⛔ WONTFIX` | `WONTFIX` |
| `💡 IDEA` | `IDEA` |
| `📐 PLANNED` | `PLANNED` |
| `🚫 DROPPED` | `DROPPED` |
| `🧪 EXPLORING` | `EXPLORING` |
| `📊 CONCLUDED` / `CONCLUDED` | `CONCLUDED` |
| `🚫 ABANDONED` | `ABANDONED` |
| `⚠️ PARTIAL` / `PARTIAL` | `PARTIAL` |
| 解析失敗 | 不寫 status，failed list 中標記 |

### 3. 推斷規則優先序

1. `id`：檔名前綴（`T0313-*.md` → `T0313`，`BUG-077-*.md` → `BUG-077`，`EXP-HEADLESS-001-*.md` → `EXP-HEADLESS-001`）
2. `schema_kind`：檔名前綴 → `T*` workorder, `BUG-*` bug, `PLAN-*` plan, `EXP-*` experiment, `CT-T*` workorder
3. `status`：抓第一個 `| 狀態 | <value> |` 或 `- **狀態**：<value>` 或 `**狀態**：<value>`，正規化
4. `title`：H1 行（`# T0313 — xxx`）取 `—`/`-` 之後內容
5. `created_at`：抓 `建立時間` 欄
6. `started_at` / `completed_at` / `closed_at` / `fixed_at`：類似抓
7. `type`（workorder）：抓 `類型` 欄，正規化為 enum（research/impl/fix/test/docs/refactor/audit/spike/chore）
8. `severity`（bug）：`🔴 High` → `high`, `🟡 Medium` → `medium`, `🟢 Low` → `low`
9. `priority`（plan）：同 severity 規則
10. `sizing`：抓 `Sizing` 欄，取 `XS/S/M/L/XL` 第一個

### 4. Idempotency

- 已有 `---\n` frontmatter 開頭 → 完全 skip（即使欄位不全也不修，避免覆蓋人工編輯）
- 重跑 script 應產生 0 diff（驗證標準）

### 5. 失敗處理

- 推斷失敗 → log 到 stderr + 失敗清單，**不阻塞其他檔案**
- 所有失敗檔在 script 結束時統一列出，使用者可單獨處理

## 拍板原則（YOLO non-interactive）

1. **保守優先**：能 skip 就 skip，遇模糊狀態（多種解讀）→ 列入失敗清單，不亂猜
2. **不動非工單檔**：嚴格遵循 scope 限制，特別是 generated index（屬 Sprint 5 sync 重建範圍）
3. **idempotent 必須**：重跑 0 diff 是硬指標
4. **dry-run 先驗證**：實際寫入前先跑 `--dry-run`，看統計是否合理
5. **批次 commit**：實際遷移後一次性 commit（避免逐張 commit 噪音）
6. **不寫 strict 驗證**：本 sprint 加 frontmatter 即可，schema 完整性驗證屬 Sprint 5/6
7. **edge case 列入回報**：若有 ≥10% 檔案推斷失敗，回報區明確列出 root cause 分析

## 執行步驟

1. 寫 script
2. `node scripts/migrate-ct-frontmatter.mjs --dry-run --verbose` → 看統計
3. 視 dry-run 結果調整 script（如發現某類 status 解析失敗）
4. `node scripts/migrate-ct-frontmatter.mjs` → 實際遷移
5. `node scripts/migrate-ct-frontmatter.mjs` 二次跑 → 驗證 idempotent（應 0 diff）
6. `git diff --stat` 確認影響檔數合理（~140 張左右）
7. `npm run test:unit` 確認 BAT parser tests 仍綠（含現有 365 + 新增 frontmatter 後解析）
8. commit：`feat(ct): migrate hot-zone workorders to v1 frontmatter (PLAN-034 Sprint 4)`

## 自檢清單

- [ ] `scripts/migrate-ct-frontmatter.mjs` 建立
- [ ] CLI 三 flag 支援（`--dry-run` / `--verbose` / `--file`）
- [ ] Glob exclude 規則正確（_archive / _spec / _draft / 系統檔 / 索引檔 / examples）
- [ ] Status 正規化全 enum 覆蓋（含 emoji + 中英混雜）
- [ ] Idempotent（重跑 0 diff）
- [ ] 推斷失敗有失敗清單輸出
- [ ] 熱區 ~140 張單據實際遷移完成
- [ ] `git diff --stat` 顯示影響檔數合理
- [ ] BAT parser tests 全綠（驗證新加 frontmatter 不破現有 parser）
- [ ] 不動 `~/.claude/skills/**`、`_archive/**`、系統文件、索引檔
- [ ] 失敗清單 ≥10% 觸發 root cause 分析

## 重要約束

1. **絕不覆蓋已有 frontmatter**（idempotent 硬限制）
2. **失敗檔列清單，不阻塞**：一張失敗不能讓 script abort
3. **不動 archive**：spec 凍結
4. **不動 generated index**（_decision-log / _bug-tracker / _backlog）：屬 Sprint 5 sync 重建範圍

---

## 回報區（Worker 完成後填寫）

### Migration script 摘要

- 檔案：`scripts/migrate-ct-frontmatter.mjs`
- 行數：483
- 關鍵函式：
  - `inferIdAndKind(filename)` — 檔名前綴 → `{ id, kind }`，支援 T/BUG/PLAN/EXP/CT-T 五種
  - `normalizeStatus(raw)` — strip emoji + 中英 token + uppercase + enum lookup（含 IN PROGRESS 復原）
  - `validateStatusForKind(status, kind)` — schema_kind → 允許 status enum 對應（拒絕 BUG 寫 IN_PROGRESS 等錯位）
  - `normalizeLevel(raw)` — 嚴重度/優先級（critical/high/medium/low）
  - `normalizeSizing(raw)` — XS/S/M/L/XL 第一個
  - `normalizeType(raw)` — workorder type enum + 中文 hint（架構調整→refactor 等）
  - `normalizeDateTime(raw)` — `2026-04-28 18:15 (UTC+8)` → `2026-04-28T18:15:00+08:00`
  - `extractField(body, aliases)` — 三 style 支援：`| 欄 | 值 |` / `- **欄**:值` / `**欄**：值`
  - `extractTitle(body)` — H1 + 工單前綴 strip + dash 之後內容
  - `shouldProcess(filename)` — 排除 _archive / _spec / _draft / 索引檔 / 系統檔 / examples
  - `emitYaml(meta)` — 手寫 YAML emitter（無 js-yaml 依賴；安全 quote 處理）
- CLI flags：`--dry-run`、`--verbose`、`--file PATH`（三 flag 全支援）

### 遷移統計

| 類型 | 總計 | 已有 frontmatter (skip) | 新增 frontmatter | 失敗 |
|------|------|----------------------|----------------|------|
| T 工單 | 111 | 0 | 107 | 4 |
| BUG | 20 | 1（BUG-077，dry-run 後手動測試遷移） | 19 | 0 |
| PLAN | 14 | 0 | 14 | 0 |
| EXP | 1 | 0 | 1 | 0 |
| CT-T | 1（含於 T 統計） | — | — | — |
| 總計 | 146 | 1 | 141 | 4 |

> 註：CT-T001 屬於 schema_kind=workorder（D094 規範），統計時計入 T 工單欄。
> 全 run 失敗率：4/146 = **2.7%**，遠低於 10% 觸發 root cause 分析的閾值。

### 失敗清單（如有）

| 檔名 | 原因 | 建議手動處理方式 |
|------|------|----------------|
| `T0292-review-report.md` | 無 metadata table（review 報告附件，非工單本身） | 不需 frontmatter；可加入 script EXCLUDES（識別 `*-review-report.md` / `*-verification-report.md` 副檔名 pattern）或保持現狀（這 4 張屬「工單產出物」，本質不是工單） |
| `T0293-review-report.md` | 同上 | 同上 |
| `T0298-verification-report.md` | 同上 | 同上 |
| `T0302-verification-report.md` | 同上 | 同上 |

> Root cause：這 4 張是 T0292/T0293/T0298/T0302 工單的**產出文件**（非工單本身），檔名共用 `T####-` 前綴只是命名慣例，不代表它們是 workorder schema_kind。本工單範圍內不對 script 加 special-case exclude（保留 fail 訊息提示使用者人工判斷），Sprint 5 / 6 可考慮：
> - 選項 A：加 `*-(review|verification)-report.md` exclude pattern
> - 選項 B：給這 4 張一個獨立的 `schema_kind=report` 並補 frontmatter
> - 選項 C：歸檔到子目錄 `_ct-workorders/_artifacts/`

### Idempotency 驗證

- 第一次執行（write）：141 migrated / 1 skipped (BUG-077 已先測過) / 4 failed
- 第二次執行（write）：**0 migrated** / 142 skipped / 4 failed（已遷移檔全部 `already has frontmatter` skip）✅

### BAT parser tests

- 遷移前：30 files / 365 tests passed
- 遷移後：30 files / **365 tests passed**（vitest run，9.74s）✅

### 偏離塔台原則

無。完全遵循 scope 限制：
- ✅ 只動 `_ct-workorders/` 熱區單據檔（T/BUG/PLAN/EXP/CT-T）
- ✅ 沒動 `_archive/**`、`~/.claude/skills/**`、BAT source、spec/draft/example 檔
- ✅ 沒動索引檔（`_decision-log.md` / `_bug-tracker.md` / `_backlog.md`）
- ✅ 沒動系統檔（`_tower-state.md` / `_local-rules.md` / `_learnings.md` / `_cross-references.md` / `_tower-config.yaml`）

### 後續動作建議

1. **T0346（Sprint 5）已 backlog**：dogfood + BUG-077 收斂 + parser parity tests
2. **4 張 review/verification report 處理**：列入 Sprint 5 / 6 決策（建議選項 A：加 exclude pattern，最低成本）
3. **未來 Worker 寫工單時**：直接用 `_draft-ct-frontmatter-sprint2-work-order-template.md` 為樣板（已含 frontmatter），新單一律含 v1 frontmatter
4. **索引檔（_decision-log / _bug-tracker / _backlog）的 frontmatter**：屬 Sprint 5 `*sync` 重建範圍，本工單不動（與工單目標一致）
5. **Drift 檢測**：T0344 BAT parser 已實作 `detectStatusDrift`，未來若使用者手改 body table status 而忘改 frontmatter，UI 應顯示 warning badge（屬 Sprint 5 task）

### 遭遇問題 / 互動紀錄 / Renew

- 遭遇問題：無
- 互動紀錄：無（YOLO non-interactive 模式，全程自動）
- Renew：無

### 回報時間 / commit

- 回報時間：2026-04-28 20:04 (UTC+8)
- commit：`e24428b` — feat(ct): migrate hot-zone workorders to v1 frontmatter (PLAN-034 Sprint 4)
