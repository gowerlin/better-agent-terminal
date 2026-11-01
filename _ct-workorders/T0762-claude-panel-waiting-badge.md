---
schema_version: 1
schema_kind: workorder
id: T0762
title: "Claude Agent 面板等待權限 / 提問時也顯示 ⚠️（縮圖與工作區列，規則比照終端分頁）"
type: implementation
status: PENDING
updated_at: "2026-11-02T02:23:44+0800"
session_ids: []
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

- [ ] e2e（假 API）＋突變檢查；既有 ⚠️ e2e 綠
- [ ] typecheck 0 / 0、`test:unit`、`vite build`
- [ ] 文件（已知限制移除「Claude 面板」）

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯（唯一例外：`### 待塔台決策` 的 `塔台答覆 Q-n` 行由塔台新增）

### 完成狀態

### 產出摘要

### 遭遇問題

### 回報時間
