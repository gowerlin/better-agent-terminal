---
schema_version: 1
schema_kind: workorder
id: T0759
title: "修正 BUG-190：背景 Agent 執行中留在 active task bar，結束時移除並標示結果"
type: implementation
status: PENDING
updated_at: "2026-11-02T02:23:44+0800"
session_ids: []
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: M
created_at: "2026-11-02T02:23:44+0800"
depends_on: [T0758]
related:
  - "BUG-190；T0739 回報區 F2（真實模型觀察）；T0727（假 Anthropic API e2e）；CLAUDE.md「Sub-agent / Active Tasks Tracking」"
  - "`electron/claude-agent-manager.ts`（`session.activeTasks`、`stopTask`）、`src/components/ClaudeAgentPanel.tsx`（active task bar）、`docs/agent-guide/claude-agent-sdk-cli.md`"
affects_files:
  - electron/claude-agent-manager.ts
  - electron/__tests__/
  - src/components/ClaudeAgentPanel.tsx
  - src/components/__tests__/
  - src/lib/
  - e2e/v072-pre6-claude-panel.spec.ts
  - e2e/fixtures/fake-anthropic-api.ts
  - docs/agent-guide/claude-agent-sdk-cli.md
  - CLAUDE.md
  - _ct-workorders/T0759-fix-bug190-background-agent-task-bar.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 先查證：SDK 0.3.316 / CLI 2.1.316 對背景 Agent（`run_in_background: true`）送出哪些訊息：tool_use、立即回來的 tool_result 內容（是否帶 task id / 背景標記）、子代理完成時的訊息（`task_notification` / system message / 多出的回合內容）、`stopTask` 能否停背景子代理。依據：SDK 型別定義、CLI 二進位字串、假 API e2e 實錄（不用真實模型）。"
  - "🔴 修正方向：背景 Agent 在 tool_result 時不從 `activeTasks` 移除，改在完成 / 失敗 / 被停止的信號到達時移除；卡片描述標示結果（沿用既有 `[completed]` 等寫法）。前景 Agent / Task 行為不變（CLAUDE.md 規則：tool_result 清除、`flushSync` 只用於 Agent / Task）。收不到結束信號時要有上限（例：session 結束 / 回合結束時清除），不得永遠殘留。"
  - "🔴 驗收：假 API e2e 新增背景 Agent 情境：執行中 task bar 1 項、結束後 0 項、卡片標示完成；前景 Agent 情境照舊；`stopTask` 可停就驗，不能就照實寫。"
  - "🔴 驗證：新增 / 修改的單元測試＋突變檢查（拿掉修正，測試要失敗）；`npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npm run test:unit`、`npx vite build`（依上方 build 規則的位置）。"
  - "🔴 build（Lane B：T0758 → T0759 → T0760，與 Lane A 並行）：主 checkout 的 `dist` / `dist-electron` 可能正被 Lane A 的 e2e 使用。`npx vite build` 與 e2e 一律在 `git archive` 匯出目錄做（`%TEMP%/bat-<工單>-build`，`node_modules` 以 junction 共用主 checkout，T0742 作法）；主 checkout 只跑 `npm run typecheck` / `npm run typecheck:electron` / `npm run test:unit`。跑完刪匯出目錄（先刪 junction 本身，確認主 checkout `node_modules/electron` 仍在）。e2e 一律用隔離實例。"
  - "🔴 文件：CLAUDE.md「Sub-agent / Active Tasks Tracking」節補一句背景 Agent 規則；細節寫進 `claude-agent-sdk-cli.md`。"
  - "🔴 yolo：不得問使用者；判讀問題依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。Git：只用 `git commit --only` commit 本單範圍；同一 checkout 有其他 Worker 並行，不得 commit 或改動別人的未提交變更；`CLAUDE.md`、`docs/agent-guide/*.md` 等共用檔若已有別人的未提交修改，等對方 commit 後再改（`git diff <檔>` 確認）。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。用 Python 改檔一律 `newline=''`。公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」。不 push、不發版。"
---
# T0759 — 修正 BUG-190：背景 Agent 執行中留在 active task bar，結束時移除並標示結果

## 元資料

- **工單編號**：T0759
- **類型**：implementation
- **優先級**：P2
- **建立時間**：2026-11-02T02:23:44+0800
- **預估規模**：M

## 背景

T0739 以真實模型觀察到背景 Agent 執行中不在 active task bar、結束沒有完成標示。D210 排入本批。

## 範圍

1. 查證背景 Agent 的訊息序列。
2. 修正 `activeTasks` 生命週期與卡片標示。
3. 假 API e2e、單元測試、文件。

## 不做

- 不用真實模型；不改前景 Agent；不做 Claude 面板 ⚠️（T0762）；不發版。

## 驗收

- [ ] 查證有證據
- [ ] 單元＋e2e（假 API）＋突變檢查；typecheck 0 / 0、`test:unit`、`vite build`（匯出目錄）
- [ ] 文件更新

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯（唯一例外：`### 待塔台決策` 的 `塔台答覆 Q-n` 行由塔台新增）

### 完成狀態

### 產出摘要

### 遭遇問題

### 回報時間
