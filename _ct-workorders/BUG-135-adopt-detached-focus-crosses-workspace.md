---
schema_version: 1
schema_kind: bug
id: BUG-135
title: "detached 視窗關閉、父視窗取回終端清單時，focus fallback 取全域 terminals[0]，可能指向其他工作區的終端"
status: FIXED
severity: low
reproducibility: unknown
created_at: "2026-10-15T01:32:28+0800"
updated_at: "2026-10-15T01:43:47+0800"
fixed_at: "2026-10-15T01:43:47+0800"
impact:
  - detached-window
  - terminal-focus
links:
  discovered_in: "T0531 回報區「偏差 / 備註」後續建議"
  fix_workorder: T0532
  related: [BUG-134, T0531]
---

# BUG-135 — adoptDetached focus 跨工作區

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟢 low（focus 指錯對象：snippet 貼上、Skills / Agents 面板等讀 `focusedTerminalId` 的功能會作用到別的工作區終端） |
| 可重現 | 未確認（程式碼證據，T0531） |
| **狀態** | ✅ FIXED（T0532，待驗收） |
| 回報者 | T0531 Worker |

## 現象

`src/stores/workspace-store.ts` 的 detached 終端清單取回路徑（`adoptDetached` / `adoptDetachedWorkspaceTerminals` 一帶，T0531 回報約 L908）在需要重設 focus 時 fallback 到**全域** `terminals[0]`，與 BUG-134 修正前的 `removeTerminal()` 同類。

## 預期

focus fallback 限定在 active 工作區（或被取回的工作區，依語意判斷）內；沒有則 `null`。

## 修正（T0532）

`src/stores/workspace-store.ts`：

- `replaceWorkspaceTerminals()`（adopt 路徑）：focus 終端已不在 → active 工作區的第一個終端，沒有則 `null`（原為全域 `terminals[0]`）
- 同類一併修正：`removeWorkspace()` / `archiveWorkspace()` 改變 active 工作區時 focus 設 `null`（同 `setActiveWorkspace()`）；`addExternalTerminal()` 落在非 active 工作區時不搶 focus；`applySerializedData()`（reload）只保留 active 工作區內的 focus
- 驗證：`src/stores/__tests__/workspace-store.focusFallback.test.ts`（修正前 6 紅、修正後 12 綠）；adopt 流程、所有權釋放、save 佇列順序未動（detached 系列 e2e 綠）
