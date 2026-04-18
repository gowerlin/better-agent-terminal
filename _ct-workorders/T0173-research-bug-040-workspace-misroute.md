# T0173-research-bug-040-workspace-misroute

## 元資料
- **工單編號**：T0173
- **任務名稱**：研究：`bat-terminal.mjs` workspace 錯派根因（BUG-040）
- **狀態**：TODO
- **類型**：research（純讀碼 + 靜態分析，不改任何檔案）
- **互動模式**：enabled（研究型工單，Worker 可在對齊方向時發問，上限 3 題）
- **建立時間**：2026-04-18 (UTC+8)
- **預估工時**：1-1.5 小時
- **關聯 BUG**：BUG-040（OPEN，主要調查對象）
- **關聯 BUG（參考）**：BUG-031 CLOSED — T0137 `f325d1d` first-match 修復可作對照
- **關聯 PLAN**：PLAN-020（yolo dogfood 首張場景，T0174 使用）
- **依賴**：無（純靜態分析，可隨時執行）
- **風險**：🟢（純讀碼，不觸碰任何執行檔案）

---

## 目標

釐清 `bat-terminal.mjs` 開新終端時，為何 workspace 會「黏著」前一張 Worker 的結尾 cwd（對照觀察已收斂為方向 2+3 合流：terminal-server 用最近活躍終端 cwd 作預設）。產出：

1. 根因確認（用程式碼佐證 BUG-040 方向 2+3 推論）
2. 修復設計（`bat-terminal.mjs --cwd` flag + terminal-server 預設邏輯調整）
3. 風險評估（BUG-031 regression 可能性、修復對既有流程的影響）
4. 拆單建議（研究完直接可派實作工單）

---

## 範圍

**納入**：
1. 讀 `scripts/bat-terminal.mjs` — 確認有無傳 cwd 給 terminal-server
2. 讀 `electron/terminal-server.ts` — workspace 分配演算法、有無「最近 active cwd」預設
3. 讀 `electron/pty-manager.ts` — PTY 建立時 cwd 來源
4. 讀 T0137 修復 `f325d1d` — BUG-031 first-match 機制，確認是不同層級
5. 對照 BUG-040 觀察表（次序 3 vs 次序 5）驗證根因假設

**排除**：
- 不修改任何檔案（修復另開工單）
- 不測試 runtime 行為（純靜態分析）
- 不調查 `pty-manager` 的其他功能

---

## 研究步驟

### R1. `bat-terminal.mjs` 分析
- 定位呼叫 terminal-server 的 IPC 點
- 檢查是否傳 cwd 參數
- 命令：`grep -n "cwd\|workspace\|terminal-server" scripts/bat-terminal.mjs`

### R2. `terminal-server.ts` / `pty-manager.ts` 分析
- 搜尋「建立新 PTY / 新終端」的 handler
- 找 cwd 預設值的來源（`process.cwd()`? 最近 active? 參數？）
- 命令：`grep -rn "createTerminal\|createPty\|cwd:" electron/terminal-server.ts electron/pty-manager.ts`

### R3. BUG-031 先例對照（T0137 `f325d1d`）
- `git show f325d1d --stat` 看改了哪些檔
- 確認 BUG-031 first-match 是「workspace 選擇」而非「cwd 繼承」
- 若發現 BUG-040 其實是 BUG-031 regression → 紅字警告

### R4. 根因收斂
- 依證據寫明確結論：「根因是 X 在 Y 位置 Z 邏輯」
- 提供行號級別引用

### R5. 修復設計
- 方案 A：`bat-terminal.mjs` 加 `--cwd` flag，預設 `process.cwd()`
- 方案 B：terminal-server 改為要求 explicit cwd（可能 breaking）
- 比較兩案的風險與相容性

### R6. 拆單建議
- 研究完直接給出實作工單的規格草稿（類似 T0166 對 PLAN-018 的拆單建議）

---

## 產出

`_report-bug-040-workspace-misroute.md` 含：

1. **根因段**：程式碼引用 + 對照 BUG-040 觀察表佐證
2. **BUG-031 對照**：確認是獨立問題或 regression
3. **修復設計**：方案 A/B 對照表
4. **風險分析**：修復對 Worker 手動 cd workaround 的相容性
5. **拆單建議**：1-2 張實作工單的規格草稿（標題、變更檔、驗收條件、預估工時）

---

## 互動規則

若遇以下情況，可回塔台發問（上限 3 題）：
- 程式碼邏輯與觀察表衝突
- 修復方案涉及架構決策（方案 A vs B 該哪個？）
- 發現非預期的 regression 風險

---

## 回報區

> 由 Worker 在 research 結束時填寫。

### 根因結論
- ...

### 修復方案推薦
- ...

### 衍生問題 / 風險
- ...

### 建議實作工單列表
- ...

---
