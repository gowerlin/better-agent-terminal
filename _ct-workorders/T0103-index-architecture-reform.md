# T0103 — 索引架構改革（D030 實作）

## 元資料

| 欄位 | 內容 |
|------|------|
| **工單編號** | T0103 |
| **標題** | 索引架構改革：移除 _workorder-index、改 bug-tracker/backlog 為 sync 重建 |
| **類型** | 維護 / 架構 |
| **狀態** | 🔄 IN_PROGRESS |
| **開始時間** | 2026-04-13 18:55 UTC+8 |
| **優先級** | 高 |
| **建立時間** | 2026-04-13 18:20 UTC+8 |
| **相關** | D030（索引架構改革決策）/ T0102（診斷） |

---

## 背景

T0102 診斷確認（D030 決策）：

| 文件 | 決定 | 原因 |
|------|------|------|
| `_workorder-index.md` | 🗑️ 移除 | BAT UI 完全不讀取，只有 Tower 使用 |
| `_bug-tracker.md` | 🔄 改為 `*sync` 自動重建 | Bugs 頁籤依賴，但不應人工維護 |
| `_backlog.md` | 🔄 改為 `*sync` 自動重建 | Backlog 頁籤依賴，同上 |
| `_decision-log.md` | ✍️ 保留人工維護 | 無對應源文件群，維護成本低 |
| `sprint-status.yaml` | ✂️ 精簡保留 | Epics cross-reference 用 |

---

## 目標

1. 移除 `_workorder-index.md`（不再需要，Tower 直接掃源文件）
2. 重建 `_bug-tracker.md`（從 BUG-###.md 掃描，修正目前偏差）
3. 重建 `_backlog.md`（從 PLAN-###.md 掃描，修正目前偏差）
4. 更新 `_local-rules.md`：改寫索引同步原則，加入自動重建說明
5. 精簡 `sprint-status.yaml`（移除細節工單列表）

---

## 任務清單

### Step 1：移除 _workorder-index.md

```bash
git mv _ct-workorders/_workorder-index.md _ct-workorders/_archive/_workorder-index.md
```

> 用 git mv 保留版本歷史，不直接刪除

### Step 2：重建 _bug-tracker.md

從所有 `BUG-###-*.md` 掃描當前狀態，重新生成 `_bug-tracker.md`，確保：
- OPEN section：BUG-026
- CLOSED section：BUG-001 ~ BUG-025（共 24 筆）
- WONTFIX section：BUG-007
- 統計：Open: 1 / Closed: 24 / WONTFIX: 1 / 總計: 26
- 格式符合 `parseBugTracker()` 要求（## Status section + Markdown table）

**注意**：掃描時讀取每個 BUG 文件的「狀態」欄位，以源文件為準。

### Step 3：重建 _backlog.md

從所有 `PLAN-###-*.md` 掃描當前狀態，重新生成 `_backlog.md`，確保：
- PLAN-009 狀態（BACKLOG）
- PLAN-008 Phase 2 狀態（PLANNING）
- PLAN-001 ~ 007 各自狀態
- 格式符合 `parseBacklog()` 要求（## Status section + Markdown table）

### Step 4：更新 _local-rules.md 索引同步原則

將「索引同步原則」章節改寫為：

```
## 索引架構（D030 更新）

### 自動重建索引（由 *sync 負責）
- `_bug-tracker.md`：從 BUG-###.md 掃描重建，人工不直接編輯
- `_backlog.md`：從 PLAN-###.md 掃描重建，人工不直接編輯

### 人工維護索引
- `_decision-log.md`：直接 append 新決策，無對應源文件群
- `sprint-status.yaml`：里程碑摘要，由 Tower 在重要節點更新

### 已移除
- `_workorder-index.md`：已歸檔。Tower 直接掃描 T####.md 源文件。

### Tower 啟動行為
- 每次 Tower session 啟動，自動執行 *sync 確保 bug-tracker 和 backlog 準確
```

### Step 5：精簡 sprint-status.yaml

移除 `epics:` 區塊下的細節工單列表（保留里程碑摘要和統計即可）。

---

## 不在範圍

- 不修改任何 src/ 原始碼
- 不修改 electron/ 設定
- 不修改 BUG-###.md 或 PLAN-###.md 的內容

---

## 交付物

- `_workorder-index.md` 已移至 `_archive/`
- `_bug-tracker.md` 已重建（內容準確，格式符合 UI parse 要求）
- `_backlog.md` 已重建（內容準確）
- `_local-rules.md` 已更新
- `sprint-status.yaml` 已精簡
- git commit：包含所有上述變更

---

## 回報區（Worker 填寫）

### 執行摘要
（完成後填寫）

### 驗證清單
- [ ] `_workorder-index.md` 已移至 `_archive/`
- [ ] `_bug-tracker.md` 統計正確（Open: 1 / Closed: 24 / 總計: 26）
- [ ] `_backlog.md` 包含 PLAN-001 ~ PLAN-009
- [ ] `_local-rules.md` 索引章節已更新
- [ ] `sprint-status.yaml` 已精簡
- [ ] git commit 完成

### 問題 / 卡點
（如有）

### 完成時間
（完成後填寫）
