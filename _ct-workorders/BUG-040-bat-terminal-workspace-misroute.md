# BUG-040-bat-terminal-workspace-misroute

## 元資料
- **編號**：BUG-040
- **標題**：`bat-terminal.mjs` 開新終端時 workspace 錯派（疑似 BUG-031 regression 或新 first-match 邊界）
- **狀態**：FIXED
- **狀態變更**：
  - 2026-04-18 17:52 — OPEN → FIXING（Phase 1.1 AC 全過，CT-T004 派發）
  - 2026-04-18 18:11 — FIXING → FIXED（CT-T004 DONE `367b30d`，Phase 1.2 完結）
- **嚴重度**：🟡 Medium
- **建立時間**：2026-04-18 14:46 (UTC+8)
- **回報者**：使用者（T0171 派發後觀察）
- **影響版本**：當前 main（含 BUG-031 修復 `f325d1d`）

## 現象

**可重現**：條件式（可能 100%，觸發條件：前一張 Worker 結尾 cwd 與預期目標 workspace 不同）

**對照觀察表**（2026-04-18 T0171 / CT-T002 流程）：

| 次序 | 事件 | 前一 Worker 結尾 cwd | 派發目標 workspace | 實際派到 | 結果 |
|------|------|---------------------|-------------------|---------|------|
| 1 | 首派 CT-T002 | BAT（塔台本身） | BAT（起手） | 推測 BAT | 正常 |
| 2 | Worker 執行 CT-T002 | **CT**（Worker 手動 cd 過去做實作） | — | — | — |
| 3 | **派 T0171**（應在 BAT） | CT（繼承上次 Worker 結尾） | BAT | **CT** ❌ | BUG-040 顯現 |
| 4 | Worker 執行 T0171 | **BAT**（Worker 手動 cd 回來做 commit） | — | — | — |
| 5 | **重派 CT-T002**（應在 BAT） | BAT（繼承 T0171 結尾） | BAT | **BAT** ✅ | 正確 |

**結論**：`bat-terminal.mjs` 建新終端時，terminal-server 似乎用**「最近活躍終端的 cwd」**而非「呼叫方 cwd」作為新終端 workspace。前一張 Worker 結尾 cwd 黏著到下一張。

**Worker 實際行為**：雖然 terminal cwd 錯了，Worker 透過絕對路徑讀工單、手動 `cd` 回預期 workspace，commits 仍落在正確 repo（`2abcd0f` / `b00012d` / `604e154`）。**無資料損失**，但 workspace 錯派本身是問題。

## 根因推測（對照觀察後收斂）

**強烈指向方向 2 + 3 合流**：

### 方向 2 + 3：最近活躍終端 cwd 黏著（主要嫌疑）
- `bat-terminal.mjs` 呼叫 terminal-server 建新終端時**未傳 explicit cwd**
- terminal-server 用「最近 active 終端的 cwd」為預設
- 前一張 Worker 結尾 cwd 決定下一張 Worker 初始 cwd
- **符合對照表觀察**：T0171 踩雷時前一張 Worker 結尾在 CT；CT-T002 重派成功時前一張在 BAT

### 方向 1：BUG-031 regression（優先級降低）
BUG-031（T0137 commit `f325d1d`）的 cwd first-match 是另一機制（workspace 選擇而非終端 cwd 繼承），本 bug 看起來是不同層級的問題。研究時可順便驗證 BUG-031 仍穩定。

### T0173 研究重點（收斂）
1. 讀 `scripts/bat-terminal.mjs`：確認有無傳 cwd 給 terminal-server
2. 讀 `electron/terminal-server.ts`：有無「最近 active cwd」預設邏輯
3. 讀 `electron/pty-manager.ts`：workspace 分配演算法
4. 設計修復：`bat-terminal.mjs` 加 `--cwd <path>` flag + 預設值為呼叫方 cwd（`process.cwd()`）

## 風險分析

| 風險 | 影響 |
|------|------|
| 本次無損失 | Worker 用絕對路徑 + 手動 cd 補救 |
| 未來誤操作 | 若 Worker 沒意識到 cwd 錯，commit 會落錯 repo |
| PLAN-020 T0172 dogfood 踩雷 | yolo 自動派發時，Worker 可能被開到錯 workspace |
| 跨專案工單混淆 | DELEGATE 工單後派的本地工單受影響 |

## Workaround

Worker 收到工單後**務必**：
1. 檢查 `pwd` 是否在預期 workspace
2. 若不是，手動 `cd` 到工單預期的 workspace
3. 用絕對路徑讀工單檔案（避免 relative path 踩雷）

## 建議處理

不阻塞當前任務（CT-T002 + PLAN-020 dogfood 可繼續）。等 PLAN-020 全案完成後優先處理：
1. 派研究工單 **T0173** 調查根因（三個方向 static 分析 + log trace）
2. 根因明確後派修復工單
3. 優先級在 PLAN-020 閉環後立刻處理（避免夜長夢多）

## 相關檔案

- `scripts/bat-terminal.mjs`（主呼叫點）
- `electron/terminal-server.ts` / `electron/pty-manager.ts`（workspace 分配邏輯）
- T0137 修復 `f325d1d`（BUG-031，參考對照）

## 相關單據

- **BUG-031** 🚫 CLOSED（T0137 `f325d1d`）— 前次 workspace 誤派修復，本 bug 可能是相同問題不同路徑或 regression
- **T0138** ✅ DONE — 研究 BAT Helper Scripts 打包（相關 context）
- **CT-T002** PARTIAL — 本 bug 的觸發條件（DELEGATE 後派 T0171）
- **T0171** ✅ DONE — 觸發 session（BUG-039 修復過程中發現）
- **PLAN-020** — 本 bug 未修前，yolo dogfood 需要 workaround

## 備註

- **非阻塞 PLAN-020**：T0172 dogfood 時 Worker 若踩到此 bug，手動 `cd` 即可
- **觸發條件看起來是「DELEGATE 工單後立刻派本地工單」**，但需 T0173 研究確認
- **BUG-031 先例寶貴**：T0137 commit `f325d1d` 的 first-match 邏輯修正是關鍵參考

---

## 回報區

> 以下由 sub-session 填寫（修復時），請勿在指揮塔 session 中編輯

### 修復 commit

### 修復範圍

### 驗證方式

### VERIFY / CLOSED 時間
