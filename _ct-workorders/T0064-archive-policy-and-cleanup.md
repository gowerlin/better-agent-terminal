# 工單 T0064-archive-policy-and-cleanup

## 元資料
- **工單編號**：T0064
- **任務名稱**：制定歸檔原則 + 依原則執行首次歸檔清理
- **狀態**：IN_PROGRESS
- **建立時間**：2026-04-12 21:28 (UTC+8)
- **開始時間**：2026-04-12 21:30 (UTC+8)
- **完成時間**：（完成時填入）

## 工作量預估
- **預估規模**：中（制定原則 + 大量檔案搬移）
- **Context Window 風險**：中（需掃描所有單據判斷歸檔資格）

## Session 建議
- **建議類型**：🆕 新 Session

## 任務指令

### 背景

`_ct-workorders/` 目錄累積了 60+ 張工單、15 張 BUG 單、6 張 PLAN 單。大部分已結案（DONE / CLOSED / WONTFIX / DROPPED），但全部平放在同一目錄。需要制定通用歸檔原則，然後依原則執行首次歸檔。

### 前置條件
- 本工單（完整閱讀）
- `_local-rules.md`（現有規則，需追加歸檔原則）
- `_bug-tracker.md`、`_backlog.md`、`_workorder-index.md`（索引檔需同步更新）

---

### Part 1：制定歸檔原則

在 `_local-rules.md` 新增「歸檔原則」章節：

#### 歸檔資格（所有單據類型通用）

**觸發條件**（同時滿足）：
1. **狀態為最終態**：DONE / CLOSED / WONTFIX / DROPPED / FIXED
2. **超過 N 天未變更**：建議 N=7（一週），可在 `_tower-config.yaml` 調整
3. **不再需要即時回顧或參考**：
   - 無 active 工單依賴此單
   - 非當前 sprint 的關鍵決策依據

**豁免條件**（不歸檔）：
- 被 active 工單的「相關單據」引用
- 塔台明確標記「保留」的單據
- `_tower-state.md` 明日起手式提及的單據

#### 歸檔目錄結構

```
_ct-workorders/
├── _archive/
│   ├── checkpoint-2026-04.md     ← 歷史 checkpoint（已有）
│   ├── workorders/               ← 已結案工單
│   │   ├── T0001-xxx.md
│   │   └── T0002-xxx.md
│   ├── bugs/                     ← 已結案 BUG 單
│   │   ├── BUG-001-xxx.md
│   │   └── BUG-002-xxx.md
│   └── plans/                    ← 已結案 PLAN 單
│       └── PLAN-001-xxx.md
```

#### 歸檔流程
1. 塔台（或 `*sync`）掃描所有單據
2. 篩選符合歸檔資格的
3. 搬移到 `_archive/<type>/` 對應子目錄
4. 更新索引（`_bug-tracker.md`、`_backlog.md`、`_workorder-index.md`）：
   - 從 active 區移到「已歸檔」區（或移除，保留連結到 `_archive/` 路徑）
5. 不刪除任何檔案，只搬移

#### 回溯查詢
- 歸檔單據仍可透過 Glob 搜尋：`_archive/**/*.md`
- BAT UI 可選擇是否顯示歸檔單據（未來功能）

---

### Part 2：執行首次歸檔

依 Part 1 制定的原則，掃描所有單據並執行歸檔。

**預期歸檔範圍**：
- 工單：T0001~T0062 中所有 DONE 狀態的（大約 55-60 張）
  - **保留不歸檔**：T0063（剛完成）、T0064（本工單）
- BUG 單：所有 FIXED / CLOSED / WONTFIX 的
  - **保留不歸檔**：BUG-012（上游追蹤中，非最終態）
- PLAN 單：所有 DONE / DROPPED 的
  - **保留不歸檔**：所有 IDEA / PLANNED 狀態的
- reports/ 目錄：**不動**（有自己的 README 定義用途）

**步驟**：
1. 建立 `_archive/workorders/`、`_archive/bugs/`、`_archive/plans/` 子目錄
2. 用 `git mv` 搬移符合資格的檔案（保留 git history）
3. 更新 `_bug-tracker.md`：已歸檔的 BUG 連結路徑改為 `_archive/bugs/BUG-xxx.md`
4. 更新 `_backlog.md`：已歸檔的 PLAN 連結路徑改為 `_archive/plans/PLAN-xxx.md`
5. 更新 `_workorder-index.md`：確認 active 列表正確
6. 確認 `_archive/` 目錄結構清晰

### Commit 規範
```
chore(tower): establish archive policy and perform initial cleanup

Archive 55+ completed work orders, 14 fixed bugs, and completed plans
into _archive/ subdirectories. Add archive policy to _local-rules.md.
```

### 驗收條件
- [ ] `_local-rules.md` 包含完整歸檔原則
- [ ] `_archive/workorders/` 包含已結案工單
- [ ] `_archive/bugs/` 包含已結案 BUG 單
- [ ] `_archive/plans/` 包含已結案 PLAN 單
- [ ] BUG-012（上游追蹤）仍在根目錄
- [ ] 所有 active 單據（IDEA/PLANNED/IN_PROGRESS）仍在根目錄
- [ ] 索引檔（`_bug-tracker.md`、`_backlog.md`）連結路徑已更新
- [ ] 使用 `git mv` 保留版本歷史
- [ ] `_ct-workorders/` 根目錄變乾淨（只剩 active 單據 + 系統檔 + _archive/）
- [ ] **不丟失任何檔案**

---

## 回報區

> 以下由 sub-session 填寫

### 完成狀態
（DONE / FAILED / BLOCKED / PARTIAL）

### 產出摘要
（歸檔數量、目錄結構、commit hash）

### 歸檔統計
| 類型 | 歸檔數 | 保留數 | 說明 |
|------|--------|--------|------|
| 工單 T#### | | | |
| BUG 單 | | | |
| PLAN 單 | | | |

### 歸檔後根目錄檔案清單
（列出 _ct-workorders/ 根目錄剩餘檔案）

### 遭遇問題
（若有）

### 回報時間
（填入當前時間）
