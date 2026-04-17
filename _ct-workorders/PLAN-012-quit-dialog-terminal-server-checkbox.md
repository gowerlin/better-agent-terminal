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

Terminal Server 目前在 Quit 後仍於背景執行，導致：
1. **版本更新安裝時檔案鎖定**：electron-builder NSIS installer 無法覆寫正在執行的 server 檔案
2. **使用者意圖不明確**：目前 Quit 行為固定，使用者無法選擇「完整關閉」或「保留 server」

## 解決方案（本 PLAN 範圍）

Quit Dialog 新增 CheckBox：

```
[ ] 一併結束 Terminal Server
```

### 關鍵設計
- **預設值**：**不勾選**（Terminal Server 留在背景）
  - 理由：避免使用者誤按關掉背景 server，導致重啟後 session 狀態遺失
  - 需要更新版本時，使用者應**主動勾選**，或由**安裝程式**詢問強制 kill
- **位置**：現有 Quit Dialog 新增一列（不新增獨立按鈕）
- **記憶**：不記憶上次選擇（每次都預設不勾）
- **勾選後行為**：Electron main 關閉流程中，先關 Terminal Server process 再 `app.quit()`

## 範圍

### In-Scope（本 PLAN）
- [ ] Quit Dialog UI 新增 CheckBox（renderer 層）
- [ ] CheckBox 狀態傳遞到 Electron main（IPC）
- [ ] main 層根據 CheckBox 決定是否結束 Terminal Server process
- [ ] Terminal Server 正確關閉（graceful shutdown，避免殭屍 process）

### Out-of-Scope（另開 PLAN）
- ❌ **Installer 強制 kill 執行中程式**：另開 PLAN-###（安裝時詢問是否 kill BAT + Terminal Server）
- ❌ Terminal Server 獨立生命週期管理（systemd / launchd 之類）
- ❌ Quit Dialog 整體重構

## 拆單初步規劃（待對齊）

| 工單 | 預估範圍 |
|------|---------|
| T####-A | Quit Dialog UI 加 CheckBox + IPC 訊息型別 |
| T####-B | Electron main 關閉流程處理 Terminal Server shutdown |
| T####-C | 測試 + 驗收（Quit 兩種模式、安裝更新場景） |

（實際拆幾張 T 工單，對齊階段再決定。也可能併成一張。）

## 前置條件

- BUG-032 修復鏈完成（T0138-T0141 ✅ DONE，T0142 END-TO-END 驗收 📋 TODO）
- T0142 全綠後才派第一張 T 工單

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
