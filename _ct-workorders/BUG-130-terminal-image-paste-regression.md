---
schema_version: 1
schema_kind: bug
id: BUG-130
title: "終端分頁貼圖失效（Windows 回歸）：剪貼簿有圖片時 Ctrl+V 原本會轉成 claude CLI 的貼圖鍵，現在貼不出圖；mac 終端的 Ctrl+V 被 BAT 拿去當文字貼上，claude CLI 也無法貼圖"
status: FIXED
severity: medium
reproducibility: always
created_at: "2026-10-14T13:36:40+0800"
updated_at: "2026-10-14T14:07:18+0800"
fixed_at: "2026-10-14T13:56:08+0800"
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
| **狀態** | ✅ FIXED（T0524；Windows 隔離實例自動化驗證，mac 實機交 外部測試者A） |
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

（T0524 回填，詳見 T0524 回報區）

**根因複核**
- `TerminalPanel.tsx` 的 Ctrl+V 分支自 `24780ec`（2025-12-18）到 T0522 前都沒有改過（`git log -L` / `-S`）
- claude CLI 貼圖鍵沒有改：內嵌 2.1.296 原始碼為 `Me = windows||wsl ? "alt+v" : "ctrl+v"`，WSL 另綁 `ctrl+v`；比對 binding 時 `alt` 與 `meta` 視為相同，所以 `ESC v` 會對到 `alt+v`。Windows 端 CLI 收鍵後用 `powershell -Sta` 的 `[System.Windows.Forms.Clipboard]::ContainsImage()` / `GetImage()` 自己讀剪貼簿
- **本機無法重現**：隔離實例（source build 與**安裝版 pre.7 執行檔**都測過）在剪貼簿放 Electron 寫入的圖、以及 .NET `Clipboard.SetImage` 寫入的 2560×1440 圖（截圖工具常見的寫法）時，按 Ctrl+V，PTY 都收到 `1b76`；renderer 的 `navigator.clipboard.read()` 也回 `image/png`，`hasFocus=true`。CLI 自己的 `ContainsImage()` 檢查也回 exit 0
- 推定根因（未證實）：舊程式碼用 renderer 的 Async Clipboard API 判斷圖片，`read()` 一旦丟錯（文件沒取得焦點、某些來源格式解碼失敗、權限）就**靜靜**退回 `readText()`。圖片剪貼簿沒有文字，所以什麼都沒貼，也沒有任何 log。本機複現不出來的那個條件，就落在這條沒 log 的路徑上
- mac：Ctrl+V / Command+V 一律被 BAT 當成文字貼上（T0522 之前就是這樣），claude CLI 的 Ctrl+V 貼圖鍵收不到

**修正**（`src/lib/terminal-paste.ts`、`src/components/TerminalPanel.tsx`）
- 三平台共用同一套決策：Ctrl+V、mac Command+V、右鍵選單 Paste。優先序：複製的檔案 → 路徑（T0522；Finder 拷貝圖片檔時剪貼簿也會帶檔案圖示，所以路徑優先）→ 圖片 → 送 CLI 貼圖鍵（Windows `v`、mac / Linux ``）→ 文字（保留 >10 KB 確認與分段）
- 圖片判斷改由 main 處理（沿用 T0436 的 `clipboard.readImageDataUrl()`，main 端 `readImage().isEmpty()`）。失敗時退回 renderer 的 `navigator.clipboard.read()`；每個失敗與每次的決策都寫進 `window.electronAPI.debug.log`（`[terminal-paste] Ctrl+V → image|paths|text`）
- 不再用 `navigator.platform`，改用 `window.electronAPI.platform`。沒有改到 electron 檔案（main / preload / types）

**驗證**：單元測試（3 平台 × {圖片, 檔案, 檔案+圖示, 文字, 讀取失敗} × {Ctrl+V, Command+V}，加上 Ctrl+C / Ctrl+Shift+C / V / 右鍵選單），共 54 tests；Windows 隔離實例 e2e `e2e/t0524-terminal-image-paste.spec.ts` PASS（PTY 收到 `1b76`、文字原樣）；typecheck 0 / typecheck:electron 0 / vite build 0；`test:unit` 216 files 全過。mac 實機驗收交 外部測試者A

## 使用者後續（2026-10-14 14:07）

- 使用者回報 pre.7 上 Ctrl+V 貼圖「現在又好了，可能不明原因會暫時失效」⇒ **間歇性**，與 T0524 推定根因（舊程式讀剪貼簿失敗時靜默退回文字）一致。pre.8 起每次判斷寫 `[terminal-paste]` log，再發生時以 log 判定
