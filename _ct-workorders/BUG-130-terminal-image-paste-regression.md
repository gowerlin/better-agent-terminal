---
schema_version: 1
schema_kind: bug
id: BUG-130
title: "終端分頁貼圖失效（Windows 回歸）：剪貼簿有圖片時 Ctrl+V 原本會轉成 claude CLI 的貼圖鍵，現在貼不出圖；mac 終端的 Ctrl+V 被 BAT 拿去當文字貼上，claude CLI 也無法貼圖"
status: FIXING
severity: medium
reproducibility: always
created_at: "2026-10-14T13:36:40+0800"
updated_at: "2026-10-14T13:36:40+0800"
impact:
  - terminal
  - clipboard
  - image-paste
links:
  discovered_in: "使用者回報（Windows，安裝版 pre.7 推定，2026-10-14 13:36）+ T0522 回報區「已知、未處理」"
  fix_workorder: T0524
  related: [BUG-128, T0522, "commit 24780ec（feat: detect clipboard image and send Alt+V for image paste）"]
---

# BUG-130 — 終端分頁貼圖失效（Windows 回歸）+ mac 終端無法貼圖

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟡 medium（終端裡跑 claude CLI 時不能貼截圖；文字貼上正常） |
| 可重現 | 必現（使用者回報） |
| **狀態** | 🔧 FIXING（T0524） |
| 回報者 | 使用者（Windows）；mac 部分來自 T0522 回報區 |

## 現象

- 使用者原話：「之前版本在 BAT Windows 版也可以貼圖，這版發現也壞了，可以同時保留貼圖與標準複製貼上嗎」
- Windows：剪貼簿有圖片（截圖）時，在終端分頁（跑 claude CLI）按 Ctrl+V，舊版會貼出圖片，現在沒有。哪一版開始壞的未確認；使用者目前安裝的是 pre.7，T0522 的修改還沒進安裝版，所以不是 T0522 造成
- mac：`TerminalPanel` 一直把 Ctrl+V 攔下來當文字貼上，claude CLI 在 mac 上的貼圖鍵（Ctrl+V）因此收不到（T0522 回報區「已知、未處理」）

## 預期（使用者要求：貼圖與標準複製貼上同時保留）

- 剪貼簿是圖片 → 送 claude CLI 的貼圖鍵，讓 CLI 自己從系統剪貼簿讀圖（Windows：Alt+V `\x1bv`；mac / Linux：Ctrl+V `\x16`，以實際 CLI 版本為準）
- 剪貼簿是檔案（Finder / 檔案總管拷貝）→ 貼路徑（T0522 的行為）
- 剪貼簿是文字 → 一般貼上
- Ctrl+C / Ctrl+Shift+C / Ctrl+Shift+V / mac Command+C / Command+V 的標準複製貼上不得退化

## 塔台初步線索（Worker 須複核）

- Windows 貼圖邏輯：`src/components/TerminalPanel.tsx` Ctrl+V 分支（commit `24780ec` 引入）：`navigator.clipboard.read()` 看 `image/*` → `pty.write('\x1bv')`；`read()` 失敗時 `.catch` 退回 `readText()`，**失敗不會有任何提示** ⇒ 若 Electron 41（PLAN-016 自 28 升級）下 `navigator.clipboard.read()` 被權限擋下或拿不到圖片型別，就會靜靜退成文字貼上（圖片沒有文字 ⇒ 什麼都沒貼）。推定根因候選之一
- 其他候選：`navigator.platform` 判斷、claude CLI 新版在 Windows 的貼圖鍵改變、T0436 / T0437 之後的 paste 改動
- 判斷方式建議：直接用 Electron `clipboard.availableFormats()` / `readImage()`（main 端，已有 `clipboard.readImageDataUrl` IPC，T0436）判斷剪貼簿有沒有圖片，不依賴 renderer 的 Async Clipboard 權限

## 根因與修正

（T0524 回填）
