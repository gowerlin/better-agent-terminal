# 工單 T0064-archive-policy-and-cleanup

## 元資料
- **工單編號**：T0064
- **任務名稱**：制定歸檔原則 + 依原則執行首次歸檔清理
- **狀態**：DONE
- **建立時間**：2026-04-12 21:28 (UTC+8)
- **開始時間**：2026-04-12 21:30 (UTC+8)
- **完成時間**：2026-04-12 21:38 (UTC+8)

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
DONE

### 產出摘要
- `_local-rules.md` 新增「歸檔原則」章節（觸發條件、豁免條件、目錄結構、歸檔流程）
- `_archive/workorders/`：72 張工單（T0001-T0062 + 所有 sub-files）
- `_archive/bugs/`：12 張 BUG（BUG-003 ~ BUG-015，排除 BUG-012）
- `_archive/plans/`：空（所有 PLAN 均為 IDEA/PLANNED，保留根目錄）
- `_bug-tracker.md` 已歸檔 BUG 連結更新為 `_archive/bugs/` 路徑
- `_workorder-index.md` Glob hint 更新 + T0064 加入 active 列表
- Commit: `12199df`（88 files changed，全部 rename，版本歷史完整保留）

### 歸檔統計
| 類型 | 歸檔數 | 保留數 | 說明 |
|------|--------|--------|------|
| 工單 T#### | 72 | 2 | 保留 T0063（剛完成）、T0064（本工單） |
| BUG 單 | 12 | 3 | 保留 BUG-001/002（非最終態）、BUG-012（上游追蹤） |
| PLAN 單 | 0 | 6 | 全部 IDEA/PLANNED 狀態，不歸檔 |

### 歸檔後根目錄檔案清單
```
_ct-workorders/
├── _archive/
│   ├── checkpoint-2026-04.md
│   ├── workorders/（72 個）
│   └── bugs/（12 個）
├── _backlog.md
├── _bug-tracker.md
├── _decision-log.md
├── _learnings.md
├── _local-rules.md
├── _tower-config.yaml
├── _tower-state.md
├── _workorder-index.md
├── BUG-001-claude-oauth-paste-truncated.md
├── BUG-002-context-menu-offset.md
├── BUG-012-alt-buffer-scroll-ghost-text.md
├── PLAN-001 ~ PLAN-006（6 個）
├── T0063-workorder-active-index.md
└── T0064-archive-policy-and-cleanup.md（本工單）
```

### 遭遇問題
pre-commit hook 對 5 個已歸檔工單中的歷史描述字串 `password=test123` 觸發 WARN（已知 false positive，均為舊工單 T0022-T0024 記錄的測試描述，hook 不阻擋 commit，已正常完成）。

### 回報時間
2026-04-12 21:38 (UTC+8)
