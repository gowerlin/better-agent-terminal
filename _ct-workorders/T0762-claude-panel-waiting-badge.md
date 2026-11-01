---
schema_version: 1
schema_kind: workorder
id: T0762
title: "Claude Agent 面板等待權限 / 提問時也顯示 ⚠️（縮圖與工作區列，規則比照終端分頁）"
type: implementation
status: DONE
updated_at: "2026-11-02T03:25:54+0800"
started_at: "2026-11-02T03:13:03+0800"
completed_at: "2026-11-02T03:25:54+0800"
session_ids:
  - "5c7e837a-4461-4e75-87a6-eee61d8bfebb"
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: M
created_at: "2026-11-02T02:23:44+0800"
depends_on: [T0761, T0759]
related:
  - "D200（⚠️ 規則）、D203（淡化）；T0735 已知限制「Claude 面板」；T0747（面板權限卡）"
  - "`src/components/ClaudeAgentPanel.tsx`（權限卡、AskUserQuestion 卡）、`src/lib/terminal-attention.ts`（`waitingForUser`、`waitingSummary`、`nextWaitMemory`）、`src/stores/terminal-attention-store.ts`、`src/components/TerminalThumbnail.tsx`、`src/components/WorkspaceWaitingBadge.tsx`"
affects_files:
  - src/components/ClaudeAgentPanel.tsx
  - src/components/TerminalThumbnail.tsx
  - src/components/WorkspaceWaitingBadge.tsx
  - src/lib/terminal-attention.ts
  - src/stores/terminal-attention-store.ts
  - src/**/__tests__/
  - e2e/
  - docs/agent-guide/worker-tab-recycle.md
  - CLAUDE.md
  - _ct-workorders/T0762-claude-panel-waiting-badge.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 規則比照終端分頁（D200 / D203）：面板有待回答的權限請求、AskUserQuestion 或其他需要使用者回應的卡片 → 該面板分頁縮圖 ⚠️、工作區列 ⚠️ 計入（含滑過列表、點擊切到等最久）；回答（不論方式）、拒絕、取消、session 結束 / 中止 → 清除；沒在看時結束 → 淡化，看過後清除。判斷進 `src/lib/terminal-attention.ts` 既有的唯一實作，不另寫一套。"
  - "🔴 不改面板權限流程本身（核准 / 拒絕的行為、IPC 簽章）；不改終端分頁的 ⚠️ 規則；遠端（headless）的面板同樣適用或照實寫限制；detached 視窗依 T0761 選定的方式（若 T0761 未涵蓋面板，照實寫）。"
  - "🔴 驗收：假 API e2e（T0727 基礎）：面板請求 Bash 權限 → 縮圖 / 工作區 ⚠️；核准後清除；拒絕後清除；在別的工作區時結束 → 淡化。突變檢查。重跑 `t0735`、`v072-pre6-claude-panel` 綠。"
  - "🔴 驗證：新增 / 修改的單元測試＋突變檢查（拿掉修正，測試要失敗）；`npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npm run test:unit`、`npx vite build`（依上方 build 規則的位置）。"
  - "🔴 build（Lane A：T0757 → T0761 → T0762 → T0763 → T0764，依序執行）：本單在主 checkout 跑 `npx vite build` 與 e2e；Lane B（T0758 → T0759 → T0760）只在匯出目錄 build，不影響本單。e2e 一律用 `e2e/fixtures/electron-isolation.ts` 隔離實例，不碰使用者正在用的 BAT、userData 與 WSL bat-server。"
  - "🔴 yolo：不得問使用者；判讀問題依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。Git：只用 `git commit --only` commit 本單範圍；同一 checkout 有其他 Worker 並行，不得 commit 或改動別人的未提交變更；`CLAUDE.md`、`docs/agent-guide/*.md` 等共用檔若已有別人的未提交修改，等對方 commit 後再改（`git diff <檔>` 確認）。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。用 Python 改檔一律 `newline=''`。公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」。不 push、不發版。"
---
# T0762 — Claude Agent 面板等待權限 / 提問時也顯示 ⚠️（縮圖與工作區列，規則比照終端分頁）

## 元資料

- **工單編號**：T0762
- **類型**：implementation
- **優先級**：P2
- **建立時間**：2026-11-02T02:23:44+0800
- **預估規模**：M

## 背景

T0735 的工作區 ⚠️ 只涵蓋終端分頁，Claude Agent 面板等待權限時沒有提示（已知限制）。D210 排入本批。

## 範圍

1. 面板等待狀態接進 attention 判斷。
2. 縮圖 / 工作區列 ⚠️、清除、淡化。
3. e2e、單元測試、文件。

## 不做

- 不改權限流程；不用真實模型；不發版。

## 驗收

- [x] e2e（假 API）＋突變檢查；既有 ⚠️ e2e 綠
- [x] typecheck 0 / 0、`test:unit`、`vite build`
- [x] 文件（已知限制移除「Claude 面板」）

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯（唯一例外：`### 待塔台決策` 的 `塔台答覆 Q-n` 行由塔台新增）

### 完成狀態

- **DONE** — 面板等待接進 attention 判斷；縮圖 / 工作區列 ⚠️、清除、淡化；單元測試、e2e、突變檢查、文件全部完成。
- **session_id**：5c7e837a-4461-4e75-87a6-eee61d8bfebb
- **落點檢查**：PASS。C-0 `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`；C-1 工單在 REPO_ROOT 下；C-3 抽查 `src/components/ClaudeAgentPanel.tsx` 等皆存在；C-2 無 `branch` 欄位（目前 `main`）。未設 `CT_HOME`（非 worktree）。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`。`BAT_REMOTE_TOKEN` 已設定。`CT_MODE=yolo`、`CT_INTERACTIVE=0`。
- **commit**：`c479a595`（產品：8 檔，`git commit --only`）；本工單另一個 commit。

### 產出摘要

**做法**（主行程沒改；權限流程、IPC 簽章、卡片顯示都沒改）

- `src/lib/terminal-attention.ts`（判斷仍是唯一實作）：
  - `claudePanelWaitingReason({ permission, question, turnEnded })`：權限卡 → `permission`（含 ExitPlanMode），AskUserQuestion 卡 → `question`，權限優先；查詢失敗 / 停止後殘留的卡 → 不算。
  - `combinePanelWaitingReasons`（同一分頁多個面板：釘選窗格會再畫一個）、`panelAttentionEvent`（換成同一個 `TerminalAttentionEvent` 形狀）、`pickTerminalAttention`（主行程的 hook 等待優先 → 面板的等待 → 主行程推送；回傳既有物件，`useSyncExternalStore` 穩定）。
- `src/stores/terminal-attention-store.ts`：面板等待與主行程推送**分開存**（`panelOwners` / `panelWaits`），`setPanelWaiting(id, owner, reason)` / `forgetPanelWaiting(id, owner)`；`getTerminalAttention` 改回傳合併後的事件，D203 的 wait memory 依合併後的事件前後更新 → 縮圖、`waitingSummary`、`nextWaitMemory`、detached 的 `DetachedWaitingReporter`、Worker 批次關閉都不用改。同 id 的 `pty:exit` 與 T0749 重連對帳不清除面板等待；面板卸載（分頁關閉、工作區分離到 detached 視窗）不留淡化。PTY 分頁的行為與之前相同（`applyAttention` / `applyExit` 只把 prev / next 換成合併事件，非面板分頁兩者相等）。
- `src/components/ClaudeAgentPanel.tsx`：既有 `pendingPermission` / `pendingQuestion` 旁加一個 effect 呼叫 `setPanelWaiting`，卸載呼叫 `forgetPanelWaiting`；`waitTurnEnded` 在新請求時設 false，在 `onError`、`handleStop`、`handleInterrupt`、`/abort` 設 true。🔴 `onResult` 不算結束：背景子代理（T0759）在主回合 `result` 之後仍可能請求權限。
- 遠端（headless）：面板在遠端視窗的 renderer 執行、IPC 經 proxied，行為相同；detached：detached 視窗的面板由它自己的 store 算，經 T0761 回報父視窗（不需改）。

**清除條件對照（memory_overrides 第 1 條）**：回答（本視窗、或其他視窗 → `claude:permission-resolved` / `claude:ask-user-resolved`）、拒絕、自訂拒絕、session reset、查詢失敗、停止 / 中斷 / `/abort`、面板卸載 → 清除；沒在看時結束 → 淡化；看過（active 分頁 + 視窗焦點）、再次等待、分頁關閉 → 淡化清除（沿用 T0735）。

**檔案**

| 檔案 | 變更 |
|---|---|
| `src/lib/terminal-attention.ts` | +4 個函式與 `ClaudePanelCards` 型別 |
| `src/stores/terminal-attention-store.ts` | 面板等待來源、合併、`setPanelWaiting` / `forgetPanelWaiting` |
| `src/components/ClaudeAgentPanel.tsx` | 接線（+26 行） |
| `src/stores/__tests__/terminal-attention-store.panel.test.ts` | 新增 13 個測試 |
| `src/__tests__/claude-panel-waiting.test.tsx` | 新增 4 個元件測試 |
| `e2e/t0762-claude-panel-waiting.spec.ts` | 新增 e2e（假 API） |
| `docs/agent-guide/worker-tab-recycle.md` | 已知限制 (b) 改為已做（Codex 面板仍未涵蓋）；新增 T0762 條 |
| `CLAUDE.md` | 「Worker 分頁回收」節 T0735 條加一句 T0762 |

`src/components/TerminalThumbnail.tsx`、`src/components/WorkspaceWaitingBadge.tsx` 不需修改（都經 `getTerminalAttention` / `useTerminalAttention`）。

**驗證**

| 項目 | 結果 |
|---|---|
| `npm run typecheck` | 0 |
| `npm run typecheck:electron` | 0 |
| `npm run test:unit` | PASS — 371 檔、6605 passed / 10 skipped |
| `npx vite build`（主 checkout） | PASS |
| 新單元測試 | 17 / 17 PASS |
| 單元突變 M1 拿掉面板的 `setPanelWaiting` | 4 失敗 |
| 單元突變 M2 `getTerminalAttention` 只回主行程推送 | 9 失敗 |
| 單元突變 M3 `onError` 不設 `waitTurnEnded` | 1 失敗 |
| 單元突變 M4 卸載時留淡化 | 2 失敗 |
| 單元突變 M5 PTY 結束連面板等待一起清 | 1 失敗 |
| e2e `t0762-claude-panel-waiting`（隔離實例＋假 Anthropic API） | PASS：Bash 權限卡 → 縮圖 ⚠️（`data-blocked-reason=permission`）＋ 工作區列 ⚠️（target = 面板分頁）；是 → 清除、資料夾建立；否 → 清除、資料夾不存在；在工作區 B 時由面板外 `resolvePermission` 回答 → A 列淡化 → 點列 → A active、面板分頁選中、淡化清除（視窗有焦點，`focused=true`） |
| e2e 突變（拿掉 `setPanelWaiting`，重 build） | FAIL：找不到縮圖 ⚠️ → 已還原並重 build |
| 回歸 e2e `t0735`、`t0761`、`v072-pre6-claude-panel`（2 項）＋ `t0762` | 5 passed（46.7 s） |

突變以 scratchpad 備份還原（`cmp` 確認一致），未用 git restore / stash。

### 遭遇問題

- 同一 checkout 有其他 Worker 的未提交變更（開始時 `electron/claude-agent-manager.ts` 等 T0768 相關檔；收尾時 `electron/pty-manager.ts`、`electron/claude-session-name-record.ts`、`electron/interrupted-agents.ts`、`src/lib/claude-resume-args.ts`、T0766 工單）。本單沒有碰它們；`vite build`、`test:unit`、e2e 是在含這些未提交變更的工作樹上跑的。
- 用 Python heredoc 改 store 時 bash 解析失敗（檔案未被改動），改用 Edit 工具完成。

**已知限制（已寫進 docs）**：從未切過去的工作區（延遲掛載）裡的面板沒有掛載，不顯示（面板本身那時也不顯示卡片）；只在記憶體，重新載入後到下一張卡前不顯示；查詢失敗 / 停止後殘留的 AskUserQuestion 卡不再算等待（卡片照舊留著）；Codex 面板（`CodexAgentPanel`）未涵蓋。

**後續建議（給塔台）**：Codex 面板（`CodexAgentPanel.tsx`，同樣有 `setTerminalPendingAction`）可用同一組函式接入，需另開工單。

### 互動紀錄

- 無（yolo，未向塔台提問）。

### 回報時間

- 2026-11-02T03:25:54+0800
