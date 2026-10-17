---
schema_version: 1
schema_kind: bug
id: BUG-150
title: "claude-cli 分頁的 AskUserQuestion 一律回報 `blocked` / `permission`（應為 `question`），T0594 的回答後清除因此永遠不生效"
status: OPEN
severity: medium
reproducibility: always
created_at: "2026-10-18T02:31:23+0800"
impact:
  - blocked-state
  - ct-breakpoint-d
links:
  discovered_in: "第七十六 session `0.7.0-pre.4` 實機驗收；根因 T0596（`270d415e`）"
  related: [T0590, T0594, T0596, CT-T017, PLAN-047]
---

# BUG-150 — AskUserQuestion 的 `blockedReason` 被蓋成 `permission`

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟡 medium（塔台會誤判「在等權限確認」；滑鼠回答後 `blocked` 一路留到回合結束，Worker 回答後若還要工作很久，CT 斷點 D 整段誤報） |
| 可重現 | 必現（claude 2.1.300 / 2.1.302，任何權限模式含 `--dangerously-skip-permissions`） |
| **狀態** | 📂 OPEN |

## 現象

- 預期：AskUserQuestion 對話框出現時 `blocked` / `question`；以滑鼠回答後由 `PostToolUse(AskUserQuestion)`（T0594）立即清除。
- 實際：`blocked` / `permission`；滑鼠回答時 `ask-user-question-done` → `unchanged`，要等 `Stop` 才清除（實機兩題各 +1.45 s / +1.88 s，因為模型馬上結束回合）。

## 根因（T0596）

- claude 的 AskUserQuestion `requiresUserInteraction()` 為 true、`checkPermissions` 一律 `behavior: "ask"`，所以一定走權限提示路徑並執行 `PermissionRequest` hook（`tool_name: AskUserQuestion`）。順序固定 `PreToolUse` → 約 90 ms 後 `PermissionRequest`。
- `TerminalBlockedTracker.report`（`electron/terminal-blocked-state.ts`）「已 blocked、不同 reason → 換成新的」→ `permission`；`HOOK_EVENT_CLEARS_ONLY['ask-user-question-done'] = 'question'` → 不清。
- T0594 / T0590 的測試只模擬 `ask-user-question` → `ask-user-question-done`，沒有中間的 `permission-request`，所以測試全綠但未涵蓋真實順序。

## 修正方向（T0596 方案 A，推薦）

`permission-request` 帶 `toolName === 'AskUserQuestion'` 時 reason 記為 `question`；契約欄位不變。補真實事件順序的單元 / headless / e2e 測試，並修正 `docs/agent-guide/blocked-state.md`（事件表例外、已知限制的 bypass 條目）。
