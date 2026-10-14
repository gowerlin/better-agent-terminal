---
schema_version: 1
schema_kind: bug
id: BUG-128
title: "macOS 終端：在 Finder 裡 Command+C 拷貝檔案後，到 BAT 終端按 Command+V 貼不上，只有 Ctrl+V 可以（從 LINE 或 BAT 內部複製的文字 Command+V 正常）"
status: FIXING
severity: medium
reproducibility: always
created_at: "2026-10-14T13:19:21+0800"
updated_at: "2026-10-14T13:19:21+0800"
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
| **狀態** | 🔧 FIXING（T0522） |
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

（T0522 回填）
