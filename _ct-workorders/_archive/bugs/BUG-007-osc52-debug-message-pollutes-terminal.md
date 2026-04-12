# 🐛 BUG-007：右鍵標記時終端顯示 OSC 52 調試訊息（上游行為）

## 元資料

| 欄位 | 內容 |
|------|------|
| **報修編號** | BUG-007 |
| **狀態** | 🚫 CLOSED（上游行為）|
| **嚴重度** | 🟢 Low |
| **報修時間** | 2026-04-11 17:xx (UTC+8) |
| **報修人** | 使用者（dogfood 回報） |
| **影響範圍** | 使用 Claude Code CLI 的所有終端（非本 app 特有） |

---

## 現象描述

- **預期行為**：右鍵標記（選取文字）時終端輸出保持乾淨
- **實際行為**：終端出現調試訊息 `sent 87 chars via OSC 52 · check terminal clipboard settings if paste fails`

## 調查結果

此訊息來自 **Claude Code CLI 本身**，不是本 app 的程式碼。

- OSC 52 是 ANSI Escape Sequence，用於透過終端向作業系統剪貼簿寫入內容
- 此調試提示訊息由 Claude Code CLI 輸出，**所有終端模擬器**（iTerm2、Windows Terminal、VS Code terminal）都會顯示
- 無法在 better-agent-terminal 層面修復

## 關閉原因

D022：上游行為，Claude Code CLI 輸出，非本 app 的 bug。所有終端都有此行為，修復需提 upstream issue 到 Claude Code repo。

## 時間線

| 時間 | 狀態 | 備註 |
|------|------|------|
| 2026-04-11 17:xx | 📋 REPORTED | 使用者 dogfood 回報 |
| 2026-04-12 | 🚫 CLOSED | 確認為上游行為（D022），關閉 |
