# T0145 — PLAN-012 驗收：Quit Dialog + Terminal Server CheckBox

## 元資料
- **工單編號**：T0145
- **類型**：acceptance（驗收工單，使用者主導）
- **狀態**：✅ DONE（使用者打包驗收通過 — BUG-031/033/034/035 全綠；情境 7 installer 依 D033 劃出，另開 PLAN-013）
- **DONE 時間**：2026-04-17 17:12 (UTC+8)（D044）
- **優先級**：🔴 High
- **派發時間**：2026-04-17 14:00 (UTC+8)
- **擴增時間**：
  - 2026-04-17 15:15 (UTC+8)（新增情境 8 覆蓋 BUG-033 四路徑）
  - 2026-04-17 16:25 (UTC+8)（新增情境 9 覆蓋 BUG-034 reconnect 路徑 × checkbox）
- **關聯 PLAN**：PLAN-012
- **關聯 BUG**：BUG-033（🔍 VERIFY，需打包驗收確認 CLOSED）、BUG-034（✅ FIXED，需打包驗收確認 CLOSED）
- **前置工單**：T0144（實作，commit `412d52c`）、T0147（BUG-033 修復，commit `ef867a2`）、T0149（BUG-034 修復，commit `cd460d2`）
- **後續**：PLAN-012 → DONE + BUG-033 CLOSED + BUG-034 CLOSED；releases 納入 v2.x
- **預估難度**：⭐⭐⭐（涉及真實版本更新安裝情境，需重 build + 重裝）
- **預估耗時**：30-60 分鐘
- **執行方式**：使用者手動操作，塔台引導

---

## 驗收前置

1. T0144 DONE，code 已 commit
2. `npm run build:dir` 或 `npm run build:win` 產出打包版
3. 關閉當前所有 BAT 視窗 → 重裝 / 覆蓋 exe → 重啟 BAT

---

## 驗收情境（6 項 + 版本更新流程）

### 情境 1：Dialog 外觀與預設值
**操作**：Cmd+Q 或 File → Quit
**預期**：
- [ ] 彈出原生 Electron dialog
- [ ] 訊息顯示「離開 Better Agent Terminal？」（zh-TW）或 "Quit Better Agent Terminal?"（en）
- [ ] CheckBox 文案：「一併結束 Terminal Server（版本更新前建議勾選）」
- [ ] CheckBox **預設不勾選**
- [ ] 兩個按鈕：Cancel / Quit

### 情境 2：Cancel 取消
**操作**：觸發 Dialog → 按 Cancel
**預期**：
- [ ] Dialog 關閉，BAT **不退出**
- [ ] 所有視窗仍在
- [ ] Terminal Server 仍活（PID file 存在）
- [ ] 可以繼續正常使用

### 情境 3：不勾選 → server 留背景
**操作**：Dialog → 不勾 CheckBox → Quit
**預期**：
- [ ] BAT 正常退出
- [ ] `%APPDATA%\BetterAgentTerminal\terminal-server.pid` **仍存在**
- [ ] `Get-Process -Id <pid>`（PowerShell）或 `ps -p <pid>`（Unix）確認 server process 仍活
- [ ] 重啟 BAT → T0108 reconnect 路徑生效，既有 PTY 可復原

### 情境 4：勾選 → server 正確關閉
**操作**：Dialog → **勾選** CheckBox → Quit
**預期**：
- [ ] BAT 正常退出
- [ ] PID file **已移除**
- [ ] server process **已消失**
- [ ] Port file 已移除
- [ ] 重啟 BAT → 新 server 重新 fork，PTY 正常 serve

### 情境 5：勾選 → 重新啟動驗證
**操作**：接情境 4 → 立即重啟 BAT → 開啟 Terminal
**預期**：
- [ ] Terminal 能正常啟動
- [ ] PTY 能正常接收輸入
- [ ] 無 `terminal-server:status` recovering/failed 錯誤

### 情境 6：勾選但 server 卡住（Timeout Fallback）
**此情境可選**（較難重現）
**操作**：若能 mock server 不回應 SIGTERM，觀察是否 1500ms 後強制 kill
**預期**：
- [ ] BAT 仍能順利退出（不會卡住）
- [ ] Windows `taskkill /F /T` 是否有 log（若 Worker 有加 log）

### 情境 7（關鍵）：版本更新安裝場景 — PLAN-012 動機驗證
**操作**：
1. BAT 開啟狀態 → 下載新版 installer（或用當前版本模擬）
2. Dialog → **勾選** CheckBox → Quit
3. 立即執行 NSIS installer（等 1-2 秒讓檔案鎖釋放）
4. 覆蓋安裝

**預期**：
- [ ] Installer **不會**彈「檔案正在使用」錯誤
- [ ] 覆寫 `resources/app.asar.unpacked/dist-electron/terminal-server.js` 成功
- [ ] 覆寫 `@lydell/node-pty.node` 成功
- [ ] 安裝完成後 BAT 可正常啟動

**對照組**（驗證有效性）：
- 不勾選 CheckBox → Quit → 立即跑 installer → 預期會遇到檔案鎖錯誤（證明勾選路徑確實解決問題）

### 情境 8（BUG-033 打包覆蓋）：四條 Quit 路徑一致性

**背景**：T0147 在 dev serve 測試 4 路徑全通，本情境為**打包後**（`npm run build:win` + 重裝）的複測，確認 production asar 封裝不影響 Tray handler 行為。

**操作 / 預期**（每條路徑都應跳 Dialog，然後可正常走情境 1-5 流程）：

| # | Quit 路徑 | 預期 |
|---|----------|------|
| 8.1 | **系統托盤右鍵 → Quit** | ✅ 跳 Dialog（BUG-033 原本失效的路徑，**必通過**） |
| 8.2 | File 選單 → Quit | ✅ 跳 Dialog |
| 8.3 | Ctrl+Q（Windows） | ✅ 跳 Dialog |
| 8.4 | 視窗 X 按鈕 | ✅ 依 `minimize-to-tray` 設定：若啟用 → 最小化到托盤；若停用 → 跳 Dialog |

**通過標準**：4 條路徑都能觸發 Dialog（視窗 X 依設定行為一致），**不得有任一路徑 bypass Dialog 直接退出**。

### 情境 9（BUG-034 修復驗證）：勾選 checkbox 後 Terminal Server 真的被結束

**背景**：T0149（commit `cd460d2`）修復了 T0144 原實作只處理 fork 路徑、漏掉 BAT reconnect 路徑的問題。方案 C 嘗試順序：
- **Step A**：`_terminalServerProcess.connected` → `child.kill('SIGTERM')` → log `via SIGTERM`
- **Step B**：否則 `readPortFile` → `sendShutdownToServer(port)` TCP shutdown → log `via TCP shutdown`
- **Step C**：等待 pidfile 消失 1500ms
- **Step D**：Timeout 後 Unix `SIGKILL` / Windows `execFile('taskkill', ['/F','/T','/PID', pid])` → log `via SIGKILL` / `via taskkill /F /T`

同時修了 `pty-manager.dispose()` 漏 destroy tcpSocket（疑似 crashpad-handler 主進程殘留根因）+ 移除 `main.ts:1491` 誤報 log。

**Log 檢查點**：`%APPDATA%\BetterAgentTerminal\Logs\debug-*.log`，搜尋 `[quit]` prefix 看 kill method。

**操作 / 預期**：

| # | 場景 | 啟動路徑 | Quit 方式 | 預期 log | 預期工作管理員 |
|---|------|---------|----------|---------|----------------|
| 9.1（**核心**） | Packaged reconnect | 啟動 BAT（server 已在背景或重啟 reconnect）| 任一 Quit 路徑 + **勾 checkbox** | `[quit] terminal server stopped (via TCP shutdown)` | **無任何 BetterAgentTerminal.exe 殘留** |
| 9.2（選做） | Packaged fork | 先關閉 server（Task Mgr 殺 terminal-server）→ 重啟 BAT（首次 fork 路徑）| 任一 Quit 路徑 + **勾 checkbox** | `[quit] terminal server stopped (via SIGTERM)` | **無任何 BetterAgentTerminal.exe 殘留** |
| 9.3 | 不勾保留 | Packaged 任一 | 任一 Quit 路徑 + **不勾 checkbox** | **不應有** `[quit] terminal server stopped` log（已移除誤報） | terminal-server.js 保留（僅 main + crashpad 消失）|
| 9.4（選做） | Fallback | 人為 block TCP port（firewall / iptables）| 任一 Quit 路徑 + **勾 checkbox** | `[quit] terminal server stopped (via taskkill /F /T)`（1500ms 後）| **無任何 BetterAgentTerminal.exe 殘留** |

**通過標準**：
- **9.1 必通過**（使用者原始重現場景 — 打包版 + reconnect + checkbox 勾選）
- **9.2 通過**（T0144 原本就能處理的 fork 路徑不得 regression）
- **9.3 通過**（確認誤報 log 已移除 + 不勾選時 server 正確保留）
- **9.4 可選**（Fallback 機制驗證，若難以人為模擬可略過，以情境 9.1/9.2 為主）

**核心判定**：工作管理員只要看到 `terminal-server.js` 或 `--type=crashpad-handler` 殘留 → 9.1/9.2 失敗 → BUG-034 未修好。

---

## 驗收結果記錄

| 情境 | 結果 | 備註 |
|------|------|------|
| 1. Dialog 外觀 | ⏳ | |
| 2. Cancel | ⏳ | |
| 3. 不勾選 | ⏳ | |
| 4. 勾選關閉 | ⏳ | |
| 5. 重啟驗證 | ⏳ | |
| 6. Timeout Fallback | ⏳ | 可選 |
| 7. 版本更新 | ⏳ | **關鍵** |
| 8.1 托盤 Quit | ⏳ | **BUG-033 主要路徑** |
| 8.2 File Quit | ⏳ | |
| 8.3 Ctrl+Q | ⏳ | |
| 8.4 視窗 X | ⏳ | |
| 9.1 Packaged reconnect + 勾 | ⏳ | **BUG-034 核心場景** |
| 9.2 Packaged fork + 勾 | ⏳ | T0144 原邏輯無 regression 檢查 |
| 9.3 不勾選 + 誤報 log 移除 | ⏳ | |
| 9.4 Fallback taskkill | ⏳ | 可選 |

---

## 整體判定

- 🟢 情境 1-5 + 7 + 8 + 9.1/9.2/9.3 全綠 → PLAN-012 DONE + BUG-033 CLOSED + BUG-034 CLOSED，T0144/T0147/T0149 commit 可納入 next release
- 🟡 情境 7 失敗（檔案鎖仍在）→ 分析根因，可能 SIGTERM 沒徹底 unload `.node` 模組，需加強 shutdown 邏輯或加 delay
- 🔴 情境 1-5 / 情境 8 任一失敗 → 退回加派修復工單（情境 8 失敗 → BUG-033 重開）
- 🔴 情境 9.1 失敗（reconnect 路徑仍殘留 terminal-server）→ BUG-034 重開，加派修復工單（參考 T0148 bonus finding：檢查 pty-manager.dispose 是否被呼叫、`net.Socket` refcount、`unref()` 策略）
- 🔴 情境 9.2 失敗（fork 路徑 regression）→ T0149 實作破壞 Step A 原邏輯，rollback `cd460d2` 或加派修復工單

---

## 工單回報區

### 驗收結果
（使用者 / 塔台填）

### 發現的問題
（塔台填）

### 後續動作
（塔台填 — 例如加派修復工單、或 PLAN-012 DONE、或 BUG 另開）

### 執行時間
- 開始：____
- 結束：____
