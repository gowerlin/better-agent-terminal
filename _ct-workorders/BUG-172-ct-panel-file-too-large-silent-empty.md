---
schema_version: 1
schema_kind: bug
id: BUG-172
title: "指揮塔面板讀到超過 512 KiB 的檔案時，臭蟲／待辦／決策三頁靜默變空、工單從清單消失，只有總覽會顯示 File too large"
status: CLOSED
severity: medium
reproducibility: always（任一 CT 檔案 > 524,288 bytes）
created_at: "2026-10-29T09:38:19+0800"
updated_at: "2026-10-30T13:20:37+0800"
impact:
  - control-tower-panel
links:
  discovered_in: "BMad-Guide 塔台 ADVISORY（2026-10-29，CT D408；專案A 回報指揮塔多頁顯示錯誤，CT 對照 BAT 0.7.1-pre.8 `17036a88` 原始碼）"
  related: [T0701, BUG-173]
---

# BUG-172 — 指揮塔面板：檔案過大時靜默變空

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟡 medium（資料沒有遺失，但面板顯示「沒有東西」，使用者會誤判專案狀態） |
| 可重現 | 必定（檔案大小 > 524,288 bytes） |
| **狀態** | 🚫 CLOSED：T0708 `50fe08d3`（讀取失敗與檔案不存在分開；臭蟲／待辦／決策／epics／sprint 顯示「無法讀取 <檔名>」，讀取失敗的工單以 No status 列出；歸檔 BUG／PLAN 讀取失敗列在錯誤訊息，不做佔位項目）；使用者以 `v0.7.1-pre.9` 實機驗收通過（2026-10-30） |
| 回報者 | BMad-Guide 塔台（CT 規範 D408 附帶建議第 1 點） |

## 現象

- 預期：`_bug-tracker.md`、`_backlog.md`、`_decision-log.md` 或某張工單超過讀取上限時，面板要明確告知「檔案太大，無法顯示」，和總覽一樣。
- 實際：
  - **總覽**：顯示 `File too large`（`electron/handlers/ct-config.ts:50`，經 T0701 的讀取路徑）。
  - **臭蟲／待辦／決策**三頁：顯示為空清單，沒有任何錯誤（`src/components/ControlTowerPanel.tsx:264`、`:277`、`:312`）。
  - **工單清單**：該張工單直接從清單消失（`ControlTowerPanel.tsx:491` 只在 `result.content != null` 時加入）。
- CT 端已訂熱檔預算 400 KB（CT `memory-protocol.md` § BAT 塔台面板讀取契約），但長期專案的決策日誌仍可能超過。

## 根因

- `fs:readFile`（`electron/handlers/fs.ts:137`）對 > 512 KiB 的檔案回 `{ error: 'File too large', size }`、沒有 `content`。
- 面板各 loader 只看 `result.content != null`，把 `error` 當成「沒有檔案」處理。
- 同樣的寫法另見：epics（`:201`）、sprint yaml（`:228`）、歸檔工單／BUG／PLAN（`:332`、`:355`、`:379`）、待辦補優先級讀 PLAN 檔（`:287`）。

## 修正方向（建議，塔台決定）

- 區分「檔案不存在」與「讀取失敗」：`error === 'File too large'`（以及其他讀取錯誤）時，該頁顯示錯誤訊息（含檔名與大小），比照 `FileTree.tsx:39` 的 `File too large (<n>KB)` 寫法，i18n。
- 工單清單：讀取失敗的工單仍列出（狀態 `UNKNOWN`、標示讀取失敗），不要消失。
- 不改 512 KiB 上限本身（`fs:readFile` 是共用 handler）；若要放寬只針對 CT 檔另議。
- 補 renderer 測試：模擬 `readFile` 回 `File too large`，斷言三頁與工單清單顯示錯誤。
