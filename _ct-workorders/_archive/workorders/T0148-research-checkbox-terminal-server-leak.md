# T0148 — 研究：Quit Dialog checkbox 勾選後 Terminal Server 未結束（BUG-034 根因調查）

## 元資料
- **工單編號**：T0148
- **任務名稱**：研究：為何 Dialog 勾選「一併結束 Terminal Server」checkbox 後，terminal-server.js 子進程 + 主進程仍殘留在背景
- **類型**：**research**（研究工單，允許 Worker 與使用者互動）
- **互動模式**：enabled
- **Renew 次數**：0
- **狀態**：✅ DONE
- **建立時間**：2026-04-17 15:38 (UTC+8)
- **開始時間**：2026-04-17 15:44 (UTC+8)
- **完成時間**：2026-04-17 15:58 (UTC+8)
- **Commit**：`98be02d`（僅工單文件；research 工單不改 code）
- **優先級**：🟡 Medium（不阻擋 release，但 PLAN-012 第二目標失效 + UX 損壞）
- **關聯 BUG**：BUG-034（Checkbox 勾選後 Terminal Server 未結束）
- **關聯 PLAN**：PLAN-012（Quit Dialog + Terminal Server CheckBox 第二目標）
- **前置工單**：T0144（PLAN-012 實作 commit `412d52c`）、T0147（BUG-033 修復 commit `ef867a2`）
- **預估難度**：⭐⭐⭐（跨進程生命週期 + Windows signal 行為 + 可能需 trace log 重測）
- **預估耗時**：45-90 分鐘（視是否需加 trace log 重測）

---

## 研究目標

T0144 實作了 PLAN-012，包含 Electron 原生 Dialog + CheckBox + SIGTERM fallback 的 kill-terminal-server 邏輯。T0147 修好了 Dialog 不出現的 regression（BUG-033）。但使用者實測打包版（Q1.A）後發現：

1. ✅ Dialog 正常跳出
2. ✅ 勾選「一併結束 Terminal Server」checkbox
3. ✅ 點 OK 後主視窗關閉
4. ❌ 工作管理員仍有兩個殘留進程：
   - `terminal-server.js` 子進程（應被 SIGTERM kill）
   - `crashpad-handler`（主進程殘留的副作用）

**要回答的核心問題**：

1. **Q1**：checkbox 勾選後，code path 是否真的有執行到 kill logic？（邏輯分支 vs 沒執行）
2. **Q2**：SIGTERM 的對象是否正確？Windows 上 Electron `child_process.fork()` 的 kill 行為如何？
3. **Q3**：為何主進程（electron main）也跟著卡住？是 `app.exit()` 沒被呼叫，還是被 child 卡住？（crashpad-handler 殘留暗示 main 還活著）
4. **Q4**：fallback timeout 是否有觸發？如果有，為什麼 SIGKILL 也失效？
5. **Q5**：修復方案推薦（帶優缺點）

---

## 已知資訊

### 使用者測試環境
- **BAT 版本**：打包版（Q1.A，`npm run build:win` 後重裝，含 T0147 commit `ef867a2`）
- **Quit 路徑**：托盤 + File 選單皆中（Q2.A + Q2.B）→ **非路徑特定問題**
- **Dialog 行為**：✅ 跳出、✅ checkbox 可勾、✅ 點 OK 主視窗關閉
- **殘留進程截圖**：`D:\Downloads\2026-04-17_153330.png`
  - `BetterAgentTerminal.exe "...resources\app.asar\dist-electron\terminal-server.js"`
  - `BetterAgentTerminal.exe --type=crashpad-handler --user-data-dir=...`
- **Log 目錄**：`C:\Users\Gower\AppData\Roaming\better-agent-terminal\Logs`

### T0144 實作範圍（參考）
基於 T0143 研究結論（D035/D037）採方案 B：
- Electron 原生 `dialog.showMessageBox` + `checkboxLabel`
- `before-quit` event 攔截 + `event.preventDefault()`
- Dialog 回傳後決定是否 `app.exit()` + SIGTERM Terminal Server（帶 timeout fallback）
- i18n 訊息文案（zh-TW / en）
- Commit：`412d52c`

### T0147 修復範圍（參考）
- 刪除 Tray handler 的 `isAppQuitting = true`（1 行）
- Commit：`ef867a2`
- 效果：Dialog 重新出現 ✅

### 使用者授權（Q3.C）
「Worker 自行判斷 static 分析 vs 加 trace log」→ **Worker 可在本工單提出方案並請使用者重測**。

---

## 調查範圍

### 必讀檔案
1. **Electron main process**（`electron/main.ts` 或 `src/main/index.ts` 等）
   - `before-quit` handler 中 Dialog 回傳後的分支邏輯
   - `dialog.showMessageBox` 的 `checkboxChecked` 值處理
   - SIGTERM / kill 邏輯（child process handle、PID、timeout）
   - `app.exit()` / `app.quit()` 呼叫點
2. **Terminal Server fork 處**（搜尋 `child_process.fork` / `terminal-server.js` 引用）
   - child process handle 是否被保留（用於後續 kill）
   - 是否有 `.on('exit')` / `.on('close')` handler
3. **terminal-server.js 本身**（被 fork 的子進程）
   - 是否註冊 `process.on('SIGTERM')` handler
   - 是否做任何會阻止退出的事（unclosed handle、active timer、listening socket）
4. **T0144 commit 412d52c 的完整 diff**（`git show 412d52c`）
   - 確認 kill 邏輯的實作細節
   - 是否有遺漏的分支或 timeout
5. **Log 檔**（`%APPDATA%/better-agent-terminal/Logs`）
   - 使用者最後一次 Quit 前後 30 行
   - 搜尋 `SIGTERM` / `kill` / `terminal-server` / `app.exit` / `before-quit` 關鍵字

### 調查維度

| 維度 | 問題 |
|------|------|
| Code path | checkbox=true 時的 branch 是否真的跑到 kill logic？有無 early return / guard clause 擋路？ |
| Child handle | fork 回傳的 `ChildProcess` 物件是否保存在可存取的 scope？還是 handle 遺失？ |
| Signal 有效性 | Windows 上 `child.kill('SIGTERM')` 實際行為？是否需要 `tree-kill` 或 `taskkill /F /T /PID` 等平台特化方案？ |
| Timeout fallback | 有設 `setTimeout` 做 SIGKILL fallback 嗎？timeout 值多少？是否在 `app.exit()` 之前執行？ |
| 生命週期 race | `app.exit()` 是否在 kill 完成前就執行？main 退出會不會連帶砍掉 kill 的 timer？ |
| 主進程殘留 | crashpad-handler 殘留代表 main 還活著。是 `app.exit()` 根本沒被呼叫，還是 main 被 child 卡住？ |
| 非 checkbox 路徑 | checkbox 不勾時，BAT 是否能正常退出（只留 server）？若也殘留 → main 退出邏輯本身有問題 |

---

## 研究方法建議

Worker 可自由選擇以下策略（或組合）：

### 方案 A：Static 分析優先
1. Read `main.ts` 的 `before-quit` handler + Dialog 回傳處理
2. Read T0144 commit 412d52c 的完整 diff
3. Grep `child_process.fork` / `SIGTERM` / `kill(` 找相關邏輯
4. 分析 code path，推導根因
5. 若證據明確 → 直接給方案；若不明 → 轉方案 B

### 方案 B：Trace Log 配合重測
1. Static 分析找出關鍵節點
2. 在關鍵節點加 `logger.log('[quit-debug] ...')`（統一 prefix 方便 grep）
3. 建議加 log 的點（Worker 自行判斷）：
   - `before-quit` 進入點
   - Dialog return 值（checkboxChecked 的值）
   - kill 分支進入點
   - SIGTERM 送出前後（含 child.pid）
   - Timeout callback 進入點
   - SIGKILL 送出前後
   - `app.exit()` 呼叫前
4. Request 使用者 rebuild + 重測 + 送回 log
5. 依 log 確診根因 + 給方案

### 方案 C：現有 log 搜尋
1. 直接搜 `%APPDATA%/better-agent-terminal/Logs` 最新檔案
2. 搜尋現有的 quit 相關 log
3. 若已有足夠資訊 → 直接結論；若不夠 → 轉方案 B

---

## 預期產出

工單回報區至少包含：

1. **根因判定**：明確指出 code bug / Electron 行為 / Windows 平台特性 / packaging 問題（可能多個）
2. **證據鏈**：對應的檔案路徑:行號、log 片段、git commit 引用
3. **修復方案**（≥1 個，建議 2-3 個候選）：
   - 每個方案標註：修改範圍、優缺點、風險、預估難度
   - 推薦方案 + 理由
4. **驗收建議**：修復後如何驗證（6 情境 + checkbox 勾/不勾組合）
5. **是否引發其他 bug**：靜態分析中若發現其他隱患一併記錄（選用）

---

## 塔台限制（Worker 必讀）

### 可以做
- ✅ Read code / 分析邏輯
- ✅ Read log
- ✅ Grep 搜尋
- ✅ 提議加 trace log + 請使用者重測（Q3.C 授權）
- ✅ 執行 `git show` / `git diff`
- ✅ 在工單回報區完整陳述發現

### 不可以做
- ❌ 直接修 code（即使看到明顯 bug）
- ❌ 改任何非 log 目的的檔案
- ❌ 加 trace log 後未告知使用者就結束工單
- ❌ 擅自派生新工單（發現新 bug 請在回報區記錄，由塔台決定）

---

## 與 T0146 的差異（類似模式，避免混淆）

| 面向 | T0146（已完成） | T0148（本工單） |
|------|----------------|----------------|
| 對應 BUG | BUG-033 | BUG-034 |
| 現象 | Dialog **不出現** | Dialog **出現且 checkbox 勾選** |
| 根因方向 | Tray handler bypass before-quit | checkbox → kill-server 邏輯失效 |
| 範圍 | 單一路徑（托盤） | 跨路徑（托盤 + File 皆中）→ 邏輯本身問題 |
| 結論 | 方案 A（刪 1 行） | 待研究 |

---

## 相關檔案
- `main.ts` 或 `electron/main.ts`（主 quit flow）
- `terminal-server.js`（`dist-electron/terminal-server.js`）
- T0144 commit 412d52c（Dialog 實作）
- T0147 commit ef867a2（Tray handler 修復）
- T0146（前次研究工單，可參考格式）

---

## 回報區

### 完成狀態
✅ DONE — 研究完成，根因確定（Static 分析 + Log 證據一致），已與使用者確認修復方案。

### 互動紀錄
- [15:54] Q: 修復方案選擇（A 純 PID kill / B 純 TCP shutdown / C A+B 合併 / D 加 trace log 重測）；是否一併修 tcpSocket leak
  → A: **C / Y**
  → Action: 推薦方案定案為 C；次要 bug（`ptyManager.dispose` 漏 destroy tcpSocket）一併併入新實作工單

### 研究方法
採方案 A（Static 分析優先）+ 方案 C（現有 log 搜尋），證據鏈完整後未啟用方案 B（加 trace log）——使用者已授權 Q3.C 但不必要。

### 調查結論（根因）

**T0144 實作的 `stopTerminalServerGracefully()` 只處理 fork 路徑，漏掉 reconnect 路徑**：

- Fork 路徑：`startTerminalServer()` line 322 `fork()` → line 340 `_terminalServerProcess = child` → kill logic 有 handle 可用
- Reconnect 路徑（本 bug 觸發路徑）：line 279-295 `isServerRunning` → `ptyManager.connectToServer(port)`（只建 TCP socket） → `return`，**`_terminalServerProcess` 保持 `null`**

於是 `stopTerminalServerGracefully()`（main.ts:1293-1331）：
```ts
const child = _terminalServerProcess  // null（reconnect 路徑）
if (!child) return                    // 立刻返回，SIGTERM 從未發出
```

但外層無條件印出 `[quit] terminal server stopped`（main.ts:1424），造成 log 誤報「已停止」。

### 證據鏈

1. **Code**：
   - `electron/main.ts:170` 宣告 `_terminalServerProcess`
   - `electron/main.ts:279-307` reconnect 路徑沒有設定 `_terminalServerProcess`（只有 `ptyManager.setServerProcess` 在 fork 路徑 line 344 才會呼叫）
   - `electron/main.ts:340` 僅 fork 路徑設 `_terminalServerProcess = child`
   - `electron/main.ts:1294-1295` `stopTerminalServerGracefully` early return `if (!child) return`
   - `electron/main.ts:1419-1428` 無條件印出 `[quit] terminal server stopped`
   - `electron/pty-manager.ts:106-148` `connectToServer` 只建 TCP socket，沒有 ChildProcess handle
2. **Log**（`%APPDATA%/better-agent-terminal/Logs/debug-20260417-153206.log`）：
   - L8 `[terminal-server] 4 live PTYs detected — deferring to user recovery decision` → BAT 啟動時 server 已在
   - L96 `[terminal-server] user chose recovery — connected to port 65450` → **走 reconnect 路徑**
   - L120 `[quit] user confirmed quit (stopTerminalServer=true)` → Dialog 勾選確認
   - L122 `saved 1 profile snapshot(s)` (07:32:20.026) → L123 `terminal server stopped` (07:32:20.027) → L124 `[RemoteServer] Stopped` (07:32:20.028)
   - L123→L124 **只差 1ms**，遠低於 SIGTERM → `child.once('exit', finish)` 的必要延遲（Windows IPC 至少數 ms，timeout 1500ms），證實 early-return 成立

### 次要發現（Bonus）

1. **`ptyManager.dispose()` 漏 destroy tcpSocket**（`electron/pty-manager.ts:751-771`）：
   - `useServer=true` 時只 `this.serverProcess = null`，tcpSocket 保持開啟
   - TCP socket 是 refed by default → 可能阻止 main 的 event loop 結束
   - 推測為 crashpad-handler 主進程殘留的原因之一（未完全證實，但高度相關）
2. **Log 誤報**：`[quit] terminal server stopped` 應改為條件性 log（僅在真的送出 kill 訊號時印出，或印出「skipped (no handle)」）

### 修復方案（已與使用者確認）

**方案 C：TCP shutdown 優先 → PID-based SIGTERM fallback → Windows taskkill 兜底**（使用者選定）

修改範圍建議（供下一張實作工單參考）：

1. **`electron/main.ts:1293-1331` `stopTerminalServerGracefully` 重寫**：
   - 嘗試順序 A → B → C → D：
     - A. 若 `_terminalServerProcess` 存在且 `.connected`：`child.kill('SIGTERM')` + `once('exit')`（原邏輯）
     - B. 否則嘗試 TCP shutdown：讀取 `readPortFile(userDataPath)` → 複用 `sendShutdownToServer(port)`（main.ts:223-235 已實作）
     - C. 等待 pidfile 消失（server shutdown 時會 `removePidFile`）或 timeout 1500ms
     - D. Timeout 後：讀取 `readPidFile` → `process.kill(pid, 'SIGKILL')` + Windows `taskkill /F /T /PID <pid>`
   - 成功 kill 時 log `[quit] terminal server stopped (via <method>)`，失敗時 log `[quit] terminal server stop failed`
2. **`electron/pty-manager.ts:751-771` `dispose` 補 destroy tcpSocket**：
   - 在 `useServer` 分支加：`try { this.tcpSocket?.destroy(); this.tcpSocket = null } catch {}`
3. **`electron/main.ts:1424` 修正誤報 log**：改為在 `stopTerminalServerGracefully` 內部印確切狀態

### 驗收建議（6 情境 × checkbox 勾/不勾）

| # | 啟動路徑 | Quit 路徑 | Checkbox | 期待結果 |
|---|----------|-----------|----------|----------|
| 1 | Fork（首次） | File→Quit | ✓ | Dialog 出 + server kill + main 退 |
| 2 | Fork（首次） | Tray→Quit | ✓ | Dialog 出 + server kill + main 退 |
| 3 | Fork（首次） | Quit | ✗ | Dialog 出 + server 保留 + main 退 |
| 4 | **Reconnect**（server 已在） | Quit | ✓ | **Dialog 出 + server kill + main 退**（**本 bug 關鍵**） |
| 5 | Reconnect | Quit | ✗ | Dialog 出 + server 保留 + main 退 |
| 6 | 任意 | Cancel Dialog | - | 不退出 |

特別確認：
- 情境 4 修復後必須正常（核心驗收）
- 情境 1、2 不得回歸（T0144 + T0147 已修的範圍）
- 情境 6 不得回歸（BUG-033 已修）
- 主進程殘留（crashpad-handler）在修 tcpSocket leak 後應消失，若仍殘留需進一步調查（獨立工單）

### 建議後續工單

1. **T0149（建議派）**：實作方案 C + 修 tcpSocket leak + 修誤報 log（⭐⭐⭐ 難度，預估 2-3 小時）
2. **BUG-034 更新**：加註「根因已確認 → T0148 完成 → 待 T0149 修復」

### 遭遇問題
無

### Renew 歷程
無

### 產出摘要
- 研究工單，未修改 code
- 填寫本回報區，產出根因、證據鏈、修復方案、驗收矩陣
- 本工單為研究型不產生 commit（僅工單更新）

### 完成時間
2026-04-17 15:58 (UTC+8)
