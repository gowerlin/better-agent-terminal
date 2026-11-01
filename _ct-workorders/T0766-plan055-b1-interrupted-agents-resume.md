---
schema_version: 1
schema_kind: workorder
id: T0766
title: "PLAN-055 B1：Terminal Server recovery 後列出被中斷的 agent 分頁，claude 分頁一鍵 `--resume`"
type: implementation
status: PENDING
updated_at: "2026-11-02T02:32:46+0800"
session_ids: []
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: M
created_at: "2026-11-02T02:32:46+0800"
depends_on: [T0760]
related:
  - "PLAN-055；D211（P-1–P-8 全採建議）；T0765 回報區（現況、D-1–D-6、④ 實作單草案為本單規格來源）；BUG-171 / T0703 / T0704；T0642（`claudeSessionId`、`ClaudeSessionPersistence`）；T0525（`buildPtyEnv`）"
  - "`electron/pty-manager.ts` `handleServerDeath`、`electron/terminal-blocked-state.ts` `clearAll`、`electron/claude-session-name-record.ts`、`electron/terminal-command-handlers.ts` `createAgentPromptCommandBuilder` / `writeDispatchCommand`、`src/components/WorkspaceView.tsx` `startClaudeCliPty`、`e2e/t0704-heartbeat-recovery.spec.ts`"
affects_files:
  - electron/pty-manager.ts
  - electron/interrupted-agents.ts
  - electron/claude-session-name-record.ts
  - electron/main.ts
  - electron/terminal-command-handlers.ts
  - electron/preload.ts
  - src/types/electron.d.ts
  - src/App.tsx
  - src/components/InterruptedAgentsDialog.tsx
  - src/components/WorkspaceView.tsx
  - src/components/TerminalThumbnail.tsx
  - src/components/ServerStatusToast.tsx
  - src/stores/
  - src/locales/en.json
  - src/locales/zh-TW.json
  - src/locales/zh-CN.json
  - electron/__tests__/
  - src/**/__tests__/
  - e2e/
  - docs/agent-guide/terminal-server-recovery.md
  - docs/agent-guide/claude-session-name.md
  - CLAUDE.md
  - _ct-workorders/T0766-plan055-b1-interrupted-agents-resume.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 規格來源：T0765 回報區〈② 設計〉D-1–D-3、D-5、D-6 與〈④ 實作單草案〉（B1 範圍），待決點依 D211 全採建議：P-1 不自動 resume（不加 Settings 開關）、P-2 Worker resume 不附 prompt、P-3 不通知塔台（不改 CT 契約、不加 state 欄位）、P-5 清單只存到 BAT 關閉、P-6 Recovery 提示「重新開始」不做、P-7 不加 SessionEnd hook。codex 分頁本單只列出（顯示「codex：B2 提供恢復」或不顯示按鈕），恢復按鈕由 T0767 做。"
  - "🔴 必守：快照在 `blockedTracker.clearAll` 之前取；`Terminal Server died — attempting recovery` 日誌字串不改；不改 recovery 五步順序（T0704）；resume 指令一律經既有組裝點（renderer `startClaudeCliPty` / main `createAgentPromptCommandBuilder`），`--resume=<id>` 用 `=` 形式、不加 `--fork-session`；`bat-mcp-launch.test.ts` 的 `buildLaunchCommand(` 計數不變；`terminal:resume-interrupted-agent` 只給 renderer、不開放 helper；session id 只存 main 記憶體與 `claude-sessions.json`，日誌只記前 8 碼；自訂參數已含 resume 類旗標（`--resume` / `-r` / `--continue` / `-c` / `--session-id` 等）時不加並顯示原因；session id 未知時提供「開啟 resume 選單」（`--resume` 不帶值）。新 Dialog 用 `ModalOverlay`、有 [X]、給 `onEscape`（= 關閉、不 resume），並更新 `dialog-escape.test.tsx`。worktree 分頁 resume 不得再 `worktree.create`。"
  - "🔴 先查證（T0765 未驗證的推論）：claude session 檔的 cwd 編碼規則（以內嵌 CLI 2.1.316 實測，查不穩就退回只檢查 id 格式）、`-n` 在 `--resume` 時的行為。"
  - "🔴 驗收：T0765 ④ 的單元測試清單、e2e（stub claude ＋只 `taskkill` Terminal Server 造 recovery，T0704 作法；使用者分頁與派工分頁各一）、不回歸（一般 ⏻ 重啟 claude-cli 仍開新 claude、沒有 recovery 時行為完全不變、T0704 既有測試全過）。突變檢查：快照改在 `clearAll` 之後取 → 測試要失敗。"
  - "🔴 驗證：新增 / 修改的單元測試＋突變檢查（拿掉修正，測試要失敗）；`npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npm run test:unit`、`npx vite build`（依上方 build 規則的位置）。 另跑 `npm run test:legacy`。"
  - "🔴 build（Lane B：T0758 → T0759 → T0760 → T0766 → T0767，與 Lane A 並行）：主 checkout 的 `dist` / `dist-electron` 可能正被 Lane A 的 e2e 使用。`npx vite build` 與 e2e 一律在 `git archive` 匯出目錄做（`%TEMP%/bat-<工單>-build`，`node_modules` 以 junction 共用主 checkout，T0742 作法）；主 checkout 只跑 `npm run typecheck` / `npm run typecheck:electron` / `npm run test:unit`。跑完刪匯出目錄（先刪 junction 本身，確認主 checkout `node_modules/electron` 仍在）。e2e 一律用隔離實例。"
  - "🔴 與 Lane A 重疊：`electron/main.ts`、`electron/preload.ts`、`src/types/electron.d.ts`、`src/App.tsx`、縮圖元件、`src/stores/terminal-attention-store.ts`、locales 也在 T0761 / T0762 範圍內。動工前與 commit 前各 `git diff <檔>`：有別人的未提交修改就等對方 commit 後再改，不得一起 commit。"
  - "🔴 文件：`terminal-server-recovery.md` 已知限制改寫＋新節、`claude-session-name.md`（recovery 不再丟 session id）、CLAUDE.md「Terminal Server 存活判定與 recovery」節加 3–5 行。PLAN-055 檔不改（塔台收單時更新）。"
  - "🔴 yolo：不得問使用者；判讀問題依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。Git：只用 `git commit --only` commit 本單範圍；同一 checkout 有其他 Worker 並行，不得 commit 或改動別人的未提交變更；`CLAUDE.md`、`docs/agent-guide/*.md` 等共用檔若已有別人的未提交修改，等對方 commit 後再改（`git diff <檔>` 確認）。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。用 Python 改檔一律 `newline=''`。公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」。不 push、不發版。"
---
# T0766 — PLAN-055 B1：Terminal Server recovery 後列出被中斷的 agent 分頁，claude 分頁一鍵 `--resume`

## 元資料

- **工單編號**：T0766
- **類型**：implementation
- **優先級**：P2
- **建立時間**：2026-11-02T02:32:46+0800
- **預估規模**：M

## 背景

PLAN-055：Terminal Server recovery 後 agent 分頁無聲變成 shell，`claudeSessionId` 也在 recovery 時被清掉。T0765 研究建議方案 B（一鍵恢復），使用者全採建議並排進本批（D211）。本單是 B1；codex 恢復是 B2（T0767）。

## 範圍

1. 快照（`clearAll` 前）、session id 在 recovery 後保留。
2. 事件＋pull 查詢、對話框、分頁標示、toast 補數量。
3. claude 分頁（使用者開的、派工的）一鍵 `--resume`。
4. 單元測試、e2e、文件。

## 不做

- 不自動 resume；不改 CT 契約；不做 codex 恢復（T0767）；不做 BAT 重開的「重新開始」路徑；不發版。

## 驗收

- [ ] 查證（cwd 編碼、`-n`）有證據
- [ ] T0765 ④ 單元清單＋e2e（兩種分頁）＋突變檢查＋不回歸
- [ ] typecheck 0 / 0、`test:unit`、`test:legacy`、`vite build`（匯出目錄）
- [ ] 文件更新

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯（唯一例外：`### 待塔台決策` 的 `塔台答覆 Q-n` 行由塔台新增）

### 完成狀態

### 產出摘要

### 遭遇問題

### 回報時間
