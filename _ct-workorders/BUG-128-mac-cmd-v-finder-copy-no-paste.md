---
schema_version: 1
schema_kind: bug
id: BUG-128
title: "macOS 終端：在 Finder 裡 Command+C 拷貝檔案後，到 BAT 終端按 Command+V 貼不上，只有 Ctrl+V 可以（從 LINE 或 BAT 內部複製的文字 Command+V 正常）"
status: FIXED
severity: medium
reproducibility: always
created_at: "2026-10-14T13:19:21+0800"
updated_at: "2026-10-14T13:29:48+0800"
fixed_at: "2026-10-14T13:29:48+0800"
impact:
  - terminal
  - clipboard
  - macos
links:
  discovered_in: "Gary 回報（mac，LINE 2026-10-14 13:16-13:17，版本未確認）"
  fix_workorder: T0522
  related: [BUG-107]
---

# BUG-128 — mac：Finder 拷貝的項目 Command+V 貼不進終端

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟡 medium（mac 標準快捷鍵失效；有 Ctrl+V 繞道） |
| 可重現 | 必現（Gary 回報） |
| **狀態** | ✅ FIXED（T0522，待 Gary mac 實機驗收） |
| 回報者 | Gary（mac） |

## 現象（Gary 原話）

> 我在 Finder 裡按拷貝，command+c，到 bat 裡命令列要用 ctrl+v 才能貼上，不能用 command+v
> 只有 finder 會這樣喔，我從 line 裡貼進 bat，或 bat 裡互相貼都可以正常用 command+c, v

- Finder 拷貝的是檔案 / 資料夾項目：剪貼簿上主要是 file URL，純文字只有檔名或路徑，視 macOS 版本而定
- 「命令列」推定是終端分頁（xterm）；Claude / Codex 面板輸入框是否也有此問題，Worker 一併確認

## 預期

- mac 上 Command+V 跟 Ctrl+V 的結果至少一樣
- 理想做法是貼上 Finder 項目的完整路徑（有空白時加引號或跳脫），跟拖放檔案進終端的結果一致

## 塔台初步定位（Worker 須複核）

- `src/components/TerminalPanel.tsx:482` `attachCustomKeyEventHandler`：`:517-551` 只攔 `event.ctrlKey && key === 'v'`。mac 分支直接 `navigator.clipboard.readText()` 再 `handlePasteText` ⇒ Ctrl+V 能貼
- Command+V（`metaKey`）沒有被攔，交給 xterm 原生 / 瀏覽器的 `paste` 事件，或 Electron 選單的 `paste` role。Finder 拷貝時 `clipboardData` 的 `text/plain` 可能是空的（只有檔案項目），xterm 就什麼都不貼 ⇒ 推定根因
- 相關：BUG-107（拖放檔案路徑，`webUtils.getPathForFile`），可共用取路徑邏輯

## 根因與修正

### 根因（推論；Windows 上無法重現 Finder 剪貼簿，依據見 T0522 回報區）

- `TerminalPanel.tsx` 的 `attachCustomKeyEventHandler` 只攔 `ctrlKey + v`。mac 上 Command+V 沒被攔，xterm 對 metaKey 組合不處理也不 `preventDefault`，鍵盤事件交給 Chromium → 應用程式選單 Edit › Paste（`role: 'paste'`）→ DOM `paste` 事件 → xterm `handlePasteEvent` 只讀 `clipboardData.getData('text/plain')`
- Finder 拷貝放上剪貼簿的是 file URL（`public.file-url` / `NSFilenamesPboardType`）。Chromium 把它們以 Files（`text/uri-list` → `ReadFiles`）放進 paste 事件，`text/plain` 為空 ⇒ xterm 什麼都不貼
- Ctrl+V 走 BAT 自己的 `navigator.clipboard.readText()`（Async Clipboard API 直接讀 `NSPasteboardTypeString`），Finder 在那裡放的是**檔名**（不是完整路徑）⇒「Ctrl+V 可以」貼出的推定只是檔名

### 修正（T0522）

- main：`electron/clipboard-file-paths.ts` `readClipboardFilePaths()`，只在 darwin 讀 `NSFilenamesPboardType`（XML plist，多檔）→ 退回 `public.file-url`（單檔；file reference URL 略過），其他平台回 `[]`。新 local-only IPC `clipboard:read-file-paths`（無參數、只回路徑陣列；不在 PROXIED_CHANNELS / handler registry）
- 終端（mac）：Command+V、Ctrl+V、右鍵選單 Paste 統一走 `pasteClipboardMac()`：剪貼簿有檔案項目 → 與拖放相同的 `insertFilePaths()`（`remote:resolve-client-paths` + `quoteArgForShell`，空白分隔、不送 Enter）；否則 `readText()` → `handlePasteText()`。Command+V 在 keydown `preventDefault`，另在容器 capture 階段吞掉 1 秒內隨後的原生 paste，純文字不會貼兩次
- Claude / Codex 面板（mac）：paste 事件裡有實體路徑的 Files（`getPathForFile` 非空）時，比照拖放附加（圖片讀 File 成 data URL、其他檔案以路徑附加）；截圖 / 網頁圖片（無路徑）仍走 T0436 的 `clipboard.readImageDataUrl()`
- Windows / Linux：Ctrl+V（含 Windows 圖片 → `\x1bv`）、Ctrl+Shift+V、右鍵 Paste、面板 paste 行為不變（單元測試守住）
