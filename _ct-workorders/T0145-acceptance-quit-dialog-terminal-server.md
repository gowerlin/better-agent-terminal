# T0145 — PLAN-012 驗收：Quit Dialog + Terminal Server CheckBox

## 元資料
- **工單編號**：T0145
- **類型**：acceptance（驗收工單，使用者主導）
- **狀態**：📋 TODO（等 T0144 DONE 後派發）
- **優先級**：🔴 High
- **派發時間**：2026-04-17 14:00 (UTC+8)
- **關聯 PLAN**：PLAN-012
- **前置工單**：T0144（實作）
- **後續**：PLAN-012 → DONE；releases 即可納入 v2.x
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

---

## 整體判定

- 🟢 情境 1-5 + 7 全綠 → PLAN-012 DONE，T0144 commit 可納入 next release
- 🟡 情境 7 失敗（檔案鎖仍在）→ 分析根因，可能 SIGTERM 沒徹底 unload `.node` 模組，需加強 shutdown 邏輯或加 delay
- 🔴 情境 1-5 任一失敗 → 退回 T0144，加派修復工單

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
