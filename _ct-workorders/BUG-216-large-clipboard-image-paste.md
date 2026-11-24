---
schema_version: 1
schema_kind: bug
id: BUG-216
title: "終端 Ctrl+V 遇到大型剪貼簿圖片（數十 MB PNG）：主行程先讀出整張圖才比 10 MiB 上限，事件迴圈卡約 3 s；退回路徑兩步都失敗時 Ctrl+V 無聲失效；錯誤記成 `{}`"
status: OPEN
severity: low
reproducibility: "observed（`v0.8.0-pre.1` 實機 3 次：2026-11-24 16:43:15、17:49:40、17:49:44 (UTC+8)；剪貼簿 PNG 50.9 MB / 36.5 MB）"
created_at: "2026-11-25T00:38:23+08:00"
updated_at: "2026-11-25T00:38:23+08:00"
impact:
  - terminal
  - clipboard
  - main-process
links:
  discovered_in: "T0892 調查結論 §1、建議方向 A"
  related: [T0892, D317]
---
# BUG-216 — 大型剪貼簿圖片的終端 Ctrl+V

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟢 low（只在剪貼簿有數十 MB 的圖時發生；不會當掉，記憶體會回落） |
| 可重現 | 觀察到 3 次（T0892），未刻意重現 |
| **狀態** | 📂 OPEN |
| 回報者 | 塔台（T0892 日誌檢查） |
| 影響版本 | 既有程式（`v0.8.x` 沒改相關檔案），不是 `v0.8.x` 回歸 |

## 現象（預期 vs 實際）

- **預期**：剪貼簿圖片超過 10 MiB 時，Ctrl+V 很快被拒絕並有提示（或照文字貼上），主行程不卡。
- **實際**：
  1. 主行程先 `readClipboardPng` 讀出整張 PNG 才檢查 10 MiB 上限（`electron/image-attachments.ts` 約 82 行）：50 MB 級的圖讓主行程 Peak WS 到 671 MB，事件迴圈卡約 3 s；同一時段 2 筆 `bat-hook report-hook` `CONNECT_FAILED`（hook 狀態回報遺失）。
  2. 退回路徑（`src/lib/terminal-paste.ts`）：`navigator.clipboard.read()` 與 `readText()` 都丟例外時，這次 Ctrl+V 沒有任何效果、畫面沒提示（1 次）。
  3. 錯誤物件記成 `{}`（DOMException 序列化後沒有訊息），日誌看不出原因。

## 證據

- `debug-20261124-101607.log`：`[RENDERER] [terminal-paste] clipboard:read-image-data-url failed … Image too large (48563050 > 10485760 bytes)` 3 次，另有 `clipboard image check failed, pasting text {}`、`Ctrl+V paste failed {}` 各 1 行。
- `bat-scripts.log`：09:49:40Z `report-hook` `CONNECT_FAILED` 2 筆，與主行程讀 36.5 MB PNG（09:49:37.5–40.5Z）重疊。

## 修法方向（T0892 建議，未定案）

- 判斷「有沒有圖」只看 MIME 類型、不解碼；或先取大小再決定要不要編碼。
- 兩步都失敗時給使用者提示。
- 日誌改記 `err.name` / `err.message`。
- 🔴 不改 IPC channel 名稱、參數、回傳形狀（CLAUDE.md「Electron Runtime」main 行程 clipboard 節）。
