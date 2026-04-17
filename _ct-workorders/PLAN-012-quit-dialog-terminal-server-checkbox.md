# PLAN-012-quit-dialog-terminal-server-checkbox

## 元資料
- **編號**：PLAN-012
- **標題**：Quit Dialog 新增「一併結束 Terminal Server」CheckBox
- **狀態**：📋 PLANNED
- **優先級**：🔴 High
- **類型**：功能改善（現有 Quit Dialog 擴充）
- **建立時間**：2026-04-17 13:15 (UTC+8)
- **建立 Session 決策**：D033

## 動機

Terminal Server 目前在 Quit 後仍於背景執行（設計如此：fork + detached + unref，idle 30 分鐘後才自關），導致：
1. **版本更新安裝時檔案鎖定**：electron-builder NSIS installer 無法覆寫正在執行的 server 檔案（`@lydell/node-pty.node` 句柄持有）
2. **使用者意圖不明確**：目前 Quit 行為固定、零互動（Cmd+Q → `before-quit` → cleanup → exit）

## T0143 研究結論修正（2026-04-17 13:56）

**翻盤發現**：BAT **沒有** Quit Confirmation Dialog，Quit 流程直接進 `before-quit`，零使用者互動。本 PLAN 從「擴充現有 Dialog」調整為「**新增 Quit Dialog 含 CheckBox**」。

**好消息**：Electron 原生 `dialog.showMessageBox` 內建 `checkboxLabel` + `checkboxChecked`，規模仍極小（main.ts +~50 行 + i18n 6 行，零 React 改動）。

## 解決方案（本 PLAN 範圍）

在 Electron main 端 `before-quit` hook 內新增原生確認 Dialog：

```
[Message Box]
  Title: Better Agent Terminal
  Message: 離開 Better Agent Terminal？
  [ ] 一併結束 Terminal Server（版本更新前建議勾選）
  [ Cancel ]  [ OK ]
```

### 關鍵設計（D035 定調）
- **UI 路線**：**Electron 原生 `dialog.showMessageBox`**（內建 `checkboxLabel` / `checkboxChecked`）
  - 放棄 Custom React Modal（改動大、邊際效益低）
- **CheckBox 預設值**：**不勾選**（Terminal Server 留背景）
  - 避免誤按關掉背景 server 導致 session 狀態遺失
- **記憶**：不記憶上次選擇（每次預設不勾）
- **勾選後關閉路徑**：
  1. 優先 IPC：`_terminalServerProcess?.kill('SIGTERM')`（server 端 SIGTERM handler 已有 graceful shutdown）
  2. 等待 `exit` event 或 1500ms timeout
  3. timeout → `kill('SIGKILL')` + Windows `taskkill /F /T /PID`（orphan path 已 production-tested）
- **Cancel 機制**：Dialog 提供 Cancel 按鈕，按下 `e.preventDefault()` 取消 quit

## 範圍

### In-Scope（本 PLAN）
- [ ] Electron main `before-quit` hook 內加 `dialog.showMessageBox` + CheckBox
- [ ] 依 CheckBox 勾選狀態決定是否 `_terminalServerProcess.kill('SIGTERM')`
- [ ] 勾選路徑的 graceful shutdown + timeout fallback（1500ms → SIGKILL + taskkill）
- [ ] i18n 文案（en / zh-TW）
- [ ] 手動驗收 6 情境 + 版本更新流程

### Out-of-Scope（另開 PLAN）
- ❌ **Installer 強制 kill 執行中程式**：另開 PLAN-###（安裝時詢問是否 kill BAT + Terminal Server）
- ❌ Terminal Server 獨立生命週期管理（systemd / launchd 之類）
- ❌ Quit Dialog 整體重構

## 拆單規劃（D037 定調，2 張工單）

| 工單 | 範圍 | 預估 |
|------|------|------|
| **T0144** | 實作 — `before-quit` 原生 Dialog + CheckBox + 勾選關閉邏輯（SIGTERM + 1500ms timeout fallback）+ i18n | ~60-80 行 |
| **T0145** | 手動驗收 — 6 情境 + 版本更新安裝整體驗證 | 驗收工單 |

## 前置條件

- ✅ BUG-032 CLOSED（T0143 Task B 驗收通過，2026-04-17 13:58）
- ✅ T0143 研究完成（Worker 推薦原生 dialog 方案）
- ➡️ 可派 T0144 實作

## 時程

- **緊急**：T0142 驗收通過後**立刻**排入
- 原因：Terminal Server 背景殘留會影響版本更新安裝，阻塞後續 release 流程

## 風險與待確認

1. Terminal Server graceful shutdown 機制是否已存在？（研究工單可能需要先摸清）
2. 勾選 CheckBox 後若 server 關閉失敗，是否要強制 kill？還是顯示錯誤？
3. CheckBox 文案繁中措辭（「一併結束 Terminal Server」vs 「完整關閉背景服務」）

## 相關單據

- **後續 PLAN**：Installer 強制中止執行中程式（待建，Q3.D 決議另開）
- **關聯 BUG**：（無直接關聯，但動機之一是檔案鎖更新問題）

## 備註

使用者於 2026-04-17 13:10 提出此改善建議。本 PLAN 為下一批開發主軸（T0142 後銜接）。
