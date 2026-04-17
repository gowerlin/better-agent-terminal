# BUG-034 — Quit Dialog 勾選 checkbox 後 Terminal Server 未被結束

## 元資料
- **BUG 編號**：BUG-034
- **標題**：Dialog 出現且使用者勾選「一併結束 Terminal Server」後，terminal-server.js 子進程仍殘留，且主進程（crashpad-handler）一併卡住
- **狀態**：✅ FIXED（等 T0145 情境 8 打包驗收）
- **嚴重度**：🟡 Medium（Dialog 會問 ✅、使用者選擇有生效感知 ✅，但 server kill 邏輯未生效，主進程也跟著退不乾淨；workaround：工作管理員手動結束）
- **建立時間**：2026-04-17 15:38 (UTC+8)
- **FIXING 時間**：2026-04-17 16:04 (UTC+8)
- **FIXED 時間**：2026-04-17 16:20 (UTC+8)
- **修復 commit**：`cd460d2`（T0149）
- **發現於**：T0147 修復 BUG-033 後，使用者重測打包版確認 Dialog 出現正常，但勾選 checkbox 退出後殘留兩個進程
- **關聯 PLAN**：PLAN-012（Quit Dialog + Terminal Server CheckBox 第二目標失效）
- **關聯 BUG**：BUG-033（已 VERIFY，Dialog 本身 OK，非同一範圍）
- **研究工單**：T0148（根因確認，✅ DONE commit `98be02d`）— 方案 C 定案
- **修復工單**：T0149（📋 READY，實作方案 C + tcpSocket leak + log 修正）
- **根因**：T0144 實作的 `stopTerminalServerGracefully()` 只處理 fork 路徑，reconnect 路徑 `_terminalServerProcess=null` → `if (!child) return` 立刻返回，SIGTERM 從未發出
- **可重現**：100%（Q2.A + Q2.B 兩條路徑皆可重現）

---

## 現象描述

### 預期行為（PLAN-012 設計）
1. 使用者從系統托盤 / File 選單選 Quit
2. 跳出 Dialog，使用者勾選「一併結束 Terminal Server」checkbox 後按 OK
3. BAT 主進程退出 + SIGTERM 送給 terminal-server 子進程
4. Fallback timeout 內（例：3 秒）若 terminal-server 未退則 SIGKILL
5. 工作管理員內 **無任何 BetterAgentTerminal.exe 殘留**

### 實際行為
1. ✅ Dialog 正常跳出（BUG-033 修復驗證）
2. ✅ 使用者勾選 checkbox + 點 OK
3. ❌ BAT 主視窗關閉，但工作管理員仍有 **兩個 BetterAgentTerminal.exe 進程**：
   - `BetterAgentTerminal.exe "...resources\app.asar\dist-electron\terminal-server.js"` — terminal-server 子進程
   - `BetterAgentTerminal.exe --type=crashpad-handler --user-data-dir=...` — Electron crashpad handler（通常主進程結束會自動消失；殘留代表主進程還活著）

### Quit 路徑（使用者回報 Q2.A + Q2.B）
- ✅ 系統托盤 Quit → 重現
- ✅ File 選單 Quit → 重現
- ⚠️ 兩條路徑皆中 → **不是路徑特定問題**，是 checkbox → kill-server 邏輯本身失效

### 影響範圍
- **PLAN-012 第二目標失效**：checkbox 的功能實際沒作用
- **主進程殘留**：crashpad-handler 殘留暗示 Electron main 沒完全退出（可能被 terminal-server child 卡住 app quit，或 SIGTERM 後未等待）
- **UX 損壞**：使用者以為勾選就會結束 server，實際沒動作 → 信任感下滑
- **不阻擋 release**（Dialog 本身 OK 即可 merge，checkbox 為延伸功能），但建議同 release 一併修好

### 可能假設（未驗證，交給 T0148 確認）
1. **SIGTERM 對象錯誤**：SIGTERM 送給 Electron 主進程而非 terminal-server 子進程（PID 拿錯）
2. **Child process reference 遺失**：`child_process.fork()` 後的 handle 未保留，quit 時找不到 PID 可殺
3. **Fallback timeout 未觸發**：SIGTERM 後沒設 timer，或 timer 在 main 退出前就被 GC
4. **非同步 race**：`app.quit()` 已執行 → main 準備退 → kill child 的 code 還沒跑完
5. **Windows platform 特性**：Windows 的 signal 行為不同於 Unix（Electron child_process on Windows 可能不認 SIGTERM）
6. **Checkbox 值未讀取**：Dialog 的 checkbox 回傳值沒傳到 kill logic（邏輯分支走錯）
7. **terminal-server 忽略 SIGTERM**：server 端沒註冊 `process.on('SIGTERM')` handler

---

## 使用者測試資訊
- **BAT 版本**：打包版（Q1.A，`npm run build:win` 後重裝，含 T0147 commit `ef867a2`）
- **Quit 方式**：托盤 + File 選單皆中（Q2.A + Q2.B）
- **Dialog 行為**：✅ 正常跳出、✅ checkbox 可勾、✅ 點 OK 後視窗關閉
- **殘留證據**：工作管理員截圖（D:\Downloads\2026-04-17_153330.png）
- **Log 目錄**：`C:\Users\Gower\AppData\Roaming\better-agent-terminal\Logs`
- **研究授權**：Q3.C — Worker 自行決定 static 分析 vs trace log（可在研究工單內提議方案並請使用者重測）

---

## 塔台行動
1. ✅ 建立 BUG-034（本檔）
2. ✅ 派 T0148 研究工單
3. ⏸ 待 T0148 結論 → 決策修復方案
4. ⏸ 修復工單 → 本 BUG FIXING → FIXED
5. ⏸ 並入 T0145 驗收（情境 4 / 5：checkbox 勾選場景）或新增情境 9

---

## 相關單據
- BUG-033（🔍 VERIFY）：托盤 Quit 無 Dialog 直接退出 — 已修（T0147）
- PLAN-012（🔄 IN_PROGRESS）：Quit Dialog + Terminal Server CheckBox — 第二目標受阻
- T0144（⚠️ DONE）：PLAN-012 實作（SIGTERM + timeout fallback）— 本 BUG 根因可能在此
- T0145（📋 READY）：PLAN-012 驗收 — 需補情境 9 或併入現有 4/5
- T0147（✅ DONE）：BUG-033 修復（`ef867a2`）— 與本 BUG 獨立
- T0148（📋 READY）：BUG-034 根因研究
