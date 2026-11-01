---
schema_version: 1
schema_kind: bug
id: BUG-107
title: "Electron 41 拖放檔案取不到路徑：DOM File.path 已移除（Electron 32+），Claude 面板 / Sidebar 拖放失效；Codex 面板呼叫不存在的 shell.getPathForFile"
status: CLOSED
severity: medium
reproducibility: always
created_at: "2026-10-05T05:51:45+08:00"
updated_at: "2026-11-01T19:39:30+0800"
impact:
  - attachments
  - drag-drop
links:
  fix_workorder: T0435
  related: [T0421, BUG-105, BUG-061]
---

# BUG-107 — Electron 41 拖放取不到檔案路徑

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟡 medium（本機與遠端視窗皆受影響；拖放附件 / 拖放加入工作區失效） |
| 可重現 | 推定 100%（程式碼證據；T0421 研究） |
| **狀態** | 🚫 CLOSED（2026-11-01 塔台依 R-G003 結案）；原 ✅ FIXED |
| 回報者 | T0421 Worker（研究回報區「調查結論 §0」） |

## 現象（程式碼證據，T0421）

- Electron 32 起移除 DOM `File` 的非標準 `path` 屬性，改用 `webUtils.getPathForFile(file)`；本專案 Electron `41.2.1`
- `ClaudeAgentPanel.tsx`（約 :2156）、`Sidebar.tsx`（約 :373）仍讀 `file.path` → `undefined`
- `CodexAgentPanel.tsx`（約 :2392）呼叫 `window.electronAPI.shell.getPathForFile(file)`，preload `shell` 無此方法 → 執行期 `TypeError`（亦為 tsc 基線 40 錯之一，BUG-061）
- `addFileByPath` 檔名以 `/` 切，Windows 路徑取不到檔名

## 修復方向

preload 暴露 `webUtils.getPathForFile`（對齊 Codex 既有呼叫名 `shell.getPathForFile`），三處呼叫端改用；檔名以 `/[\\/]/` 切。注意：修好後遠端視窗附件會開始送出 client 路徑 → 須與 T0437（遠端附件路徑轉換 / 不可達擋板）同版發佈。

## 修復紀錄（T0435）

- preload `shell.getPathForFile` → `webUtils.getPathForFile`；Claude 面板 / Sidebar 拖放改用此 API；Claude / Codex `addFileByPath` 檔名改 `/[\\/]/` 切
- 測試：`src/__tests__/drag-drop-get-path-for-file.test.tsx`、`electron/__tests__/preload-get-path-for-file.test.ts`；`npm run test:unit` 全綠；`tsc --noEmit` 40 → 39
- 待使用者實機驗收（步驟見 T0435 回報區）；遠端視窗附件路徑由 T0437 處理

## 結案（2026-11-01T19:39:30+0800，BAT 第一百零三 session 塔台）

- 依全域 R-G003（測試環境實測）：本機：T0742 `e2e/t0742-terminal-drop-path.spec.ts` PASS ×2（驗紅）；遠端：T0743（`60419cc2`；source build 0.7.2-pre.8 + `server-bundle-v0.7.2-pre.8` + WSL Docker 29.1.3，隔離實例，各連跑 2 次全綠） U7 remote ×2。真實檔案總管拖放未自動化（不擋結案）。
- closed_reason: verified
