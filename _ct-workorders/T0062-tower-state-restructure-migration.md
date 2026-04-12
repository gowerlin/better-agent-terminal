# 工單 T0062-tower-state-restructure-migration

## 元資料
- **工單編號**：T0062
- **任務名稱**：_tower-state.md 瘦身 + 單據系統遷移（BUG/PLAN/Decision/Archive）
- **狀態**：IN_PROGRESS
- **建立時間**：2026-04-12 20:59 (UTC+8)
- **開始時間**：2026-04-12 21:02 (UTC+8)
- **完成時間**：（完成時填入）

## 工作量預估
- **預估規模**：中-大（檔案多，但是搬移+格式化，不寫程式碼）
- **Context Window 風險**：高（_tower-state.md 2514 行需完整讀取後搬移）
- **降級策略**：若 context 不夠，分批處理：先建骨架 → 再搬 Bug → 再搬 PLAN → 再搬 checkpoint

## Session 建議
- **建議類型**：🆕 新 Session
- **原因**：大量檔案操作，乾淨 context 必要

## 任務指令

### 背景

T0061 已完成單據結構設計。本工單執行實際遷移：
1. 瘦身 `_tower-state.md`（2514 → <200 行）
2. 建立獨立 Bug 單（BUG-003~015，BUG-001/002 已有獨立檔）
3. 建立獨立 PLAN 單
4. 建立 `_decision-log.md`
5. 建立 `_bug-tracker.md` 索引
6. 建立 `_backlog.md` 索引
7. 建立 `_local-rules.md`
8. 歷史 checkpoint 歸檔到 `_archive/`

### 前置條件
- 本工單（完整閱讀）
- `CLAUDE.md`（專案規範）
- **T0061 回報區**（所有模板定義，**必讀**，作為建檔依據）
- `_ct-workorders/_tower-state.md`（資料來源）

### ⚠️ 重要原則

1. **不丟失任何資料** — 所有內容必須搬到某個目標檔案，不可截斷或刪除
2. **歸檔不刪除** — 歷史 checkpoint 搬到 `_archive/`，完整保留
3. **格式對齊 T0061 模板** — Bug/PLAN/Decision 格式嚴格遵循 T0061 定義
4. **不改程式碼** — 本工單只操作 `_ct-workorders/` 下的 markdown 檔案

---

### Step 1：建立目錄和骨架檔案

```
_ct-workorders/
├── _archive/                    ← 新建
│   └── checkpoint-2026-04.md    ← 歷史 checkpoint 歸檔
├── _tower-state.md              ← 瘦身後
├── _decision-log.md             ← 新建
├── _bug-tracker.md              ← 新建
├── _backlog.md                  ← 新建
├── _local-rules.md              ← 新建
```

### Step 2：建立 `_local-rules.md`

使用 T0061 回報區的 `_local-rules.md 草稿` 完整內容。

### Step 3：建立 `_decision-log.md`

1. 從 `_tower-state.md` 提取所有 `D###` 決策紀錄
2. 使用 T0061 定義的決策日誌格式
3. 包含本 session 新增的 D001-D010

### Step 4：建立獨立 BUG 單

從 `_tower-state.md` 的 Bug Tracker 表格提取，為每個尚無獨立檔的 BUG 建立單據：

| BUG | 現狀 | 動作 |
|-----|------|------|
| BUG-001 | 已有獨立檔 | 更新格式對齊模板（若差異大就保持原樣） |
| BUG-002 | 已有獨立檔 | 同上 |
| BUG-003~015 | 無獨立檔 | **新建**，從 tower state 摘要 + 工單回報區提取資訊 |

**格式**：嚴格使用 T0061 的 BUG 單模板。
**狀態映射**：根據 tower state 的最新狀態設定（✅ 已修復 → ✅ FIXED，📋 上游追蹤 → 🔍 INVESTIGATING 等）。

### Step 5：建立 `_bug-tracker.md` 索引

使用 T0061 的索引表模板，列出所有 BUG 單的摘要和連結。

### Step 6：建立獨立 PLAN 單

從 `_tower-state.md` 的 Backlog 區段提取，建立 PLAN 單：

| 現有 Backlog 項目 | PLAN 編號 |
|------------------|-----------|
| Vite v5→v6 升級 | PLAN-001 |
| Dynamic import 衝突修正 | PLAN-002 |
| npm audit 殘餘漏洞（electron 28→41） | PLAN-003 |
| GPU/MLX Whisper 加速（Win/Linux） | PLAN-004 |
| electron-builder 24→26 升級 | PLAN-005 |

**格式**：嚴格使用 T0061 的 PLAN 單模板。

### Step 7：建立 `_backlog.md` 索引

使用 T0061 的索引表模板，列出所有 PLAN 單。

### Step 8：歷史 Checkpoint 歸檔

1. 建立 `_archive/checkpoint-2026-04.md`
2. 從 `_tower-state.md` 提取所有歷史 checkpoint 段落（日期標記的大段落）
3. **完整搬移**，不截斷不刪除
4. 在歸檔檔案頂部加標題和說明

### Step 9：瘦身 `_tower-state.md`

使用 T0061 的瘦身版結構重寫 `_tower-state.md`：
- 明日起手式（從最新 checkpoint 提取）
- 快速連結（指向各獨立檔案）
- 基本資訊（編號管理）
- 進度快照（2-5 行）
- 管理筆記（空白，新 session 使用）
- 歸檔索引（指向 `_archive/`）

**目標行數**：< 200 行

---

### 預期產出

新建檔案：
- `_archive/checkpoint-2026-04.md`（歷史歸檔）
- `_decision-log.md`
- `_bug-tracker.md`
- `_backlog.md`
- `_local-rules.md`
- `BUG-003-xxx.md` ~ `BUG-015-xxx.md`（約 13 個新 BUG 單）
- `PLAN-001-xxx.md` ~ `PLAN-005-xxx.md`（約 5 個新 PLAN 單）

修改檔案：
- `_tower-state.md`（瘦身重寫）

1 個 commit：
```
refactor(tower): restructure tower state into independent document system

Extract bugs, backlog, decisions, and historical checkpoints from
monolithic _tower-state.md into independent documents with index files.
```

### 驗收條件
- [ ] `_tower-state.md` < 200 行
- [ ] 所有決策（D001-D010）在 `_decision-log.md` 中
- [ ] 所有 BUG（001-015）有獨立檔案 + `_bug-tracker.md` 索引
- [ ] 所有 Backlog 項目有 PLAN 單 + `_backlog.md` 索引
- [ ] 歷史 checkpoint 完整保留在 `_archive/checkpoint-2026-04.md`
- [ ] `_local-rules.md` 已建立
- [ ] 連結索引全部可導航（相對路徑正確）
- [ ] **沒有遺失任何資料**（與原 _tower-state.md 對比）
- [ ] `npx vite build` 通過（確認無副作用）

---

## 回報區

> 以下由 sub-session 填寫

### 完成狀態
（DONE / FAILED / BLOCKED / PARTIAL）

### 產出摘要
（新建/修改檔案列表、commit hash）

### 資料完整性確認
| 資料類型 | 原始位置 | 目標位置 | 完整？ |
|---------|---------|---------|--------|
| 決策日誌 | _tower-state.md | _decision-log.md | |
| Bug Tracker | _tower-state.md | BUG-*.md + _bug-tracker.md | |
| Backlog | _tower-state.md | PLAN-*.md + _backlog.md | |
| Checkpoint | _tower-state.md | _archive/checkpoint-2026-04.md | |

### _tower-state.md 最終行數
（目標 < 200）

### 遭遇問題
（若有）

### 回報時間
（填入當前時間）
