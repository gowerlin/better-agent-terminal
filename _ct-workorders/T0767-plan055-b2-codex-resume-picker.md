---
schema_version: 1
schema_kind: workorder
id: T0767
title: "PLAN-055 B2：被中斷的 codex 分頁提供恢復（`codex resume` 選單，依 cwd 篩選）"
type: implementation
status: IN_PROGRESS
started_at: "2026-11-02T03:49:49+08:00"
updated_at: "2026-11-02T03:49:49+08:00"
session_ids: []
tower_question: open
repo: better-agent-terminal
project: maintenance
priority: P3
sizing: S
created_at: "2026-11-02T02:32:46+0800"
depends_on: [T0766]
related:
  - "PLAN-055；D211（P-4 a：`codex resume` picker）；T0765 回報區 D-4；T0766（B1 的快照、對話框、分頁標示）"
  - "`electron/bat-mcp-launch.ts` `buildBatMcpLaunchArgs`（codex 分支、`--no-daemon` 判斷）、`electron/codex-osc-version.ts`（T0758 後的版本探測）、`src/components/InterruptedAgentsDialog.tsx`"
affects_files:
  - electron/interrupted-agents.ts
  - electron/main.ts
  - electron/terminal-command-handlers.ts
  - src/components/InterruptedAgentsDialog.tsx
  - src/components/WorkspaceView.tsx
  - src/locales/en.json
  - src/locales/zh-TW.json
  - src/locales/zh-CN.json
  - electron/__tests__/
  - src/**/__tests__/
  - e2e/
  - docs/agent-guide/terminal-server-recovery.md
  - CLAUDE.md
  - _ct-workorders/T0767-plan055-b2-codex-resume-picker.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 規格（D211 / T0765 D-4）：被中斷的 codex 分頁在 B1 的對話框 / 分頁標示提供「恢復」→ 在重建的 shell 送 `codex resume`（不帶 session id，codex 自己的選單、預設以 cwd 篩選）；BAT MCP `-c mcp_servers.bat.*`、`--no-daemon`（依 T0758 後的版本探測）照原路徑加，不另寫組裝。🔴 不用 `--last`（同 cwd 多個 codex 分頁會接錯）；不讀 `~/.codex/sessions` 猜 session id（P-4 c 不做）。使用者開的分頁與派工分頁都適用；派工分頁不附 prompt（P-2）。"
  - "🔴 先查證：內嵌 codex 0.166.0 `codex resume --help`、`resume` 子命令與 `-c` / `--no-daemon` 的參數位置（全域旗標放在子命令前或後），以實際執行 `--help` 為準。"
  - "🔴 驗收：單元（組出的指令含 `resume`、BAT MCP / `--no-daemon` 照舊、不含 `--last`）；e2e 沿用 T0766 的 recovery 做法，以 stub codex 記錄 argv（不登入、不啟動真 codex）。突變檢查。"
  - "🔴 驗證：新增 / 修改的單元測試＋突變檢查（拿掉修正，測試要失敗）；`npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npm run test:unit`、`npx vite build`（依上方 build 規則的位置）。"
  - "🔴 build（Lane B：T0758 → T0759 → T0760 → T0766 → T0767，與 Lane A 並行）：主 checkout 的 `dist` / `dist-electron` 可能正被 Lane A 的 e2e 使用。`npx vite build` 與 e2e 一律在 `git archive` 匯出目錄做（`%TEMP%/bat-<工單>-build`，`node_modules` 以 junction 共用主 checkout，T0742 作法）；主 checkout 只跑 `npm run typecheck` / `npm run typecheck:electron` / `npm run test:unit`。跑完刪匯出目錄（先刪 junction 本身，確認主 checkout `node_modules/electron` 仍在）。e2e 一律用隔離實例。"
  - "🔴 與 Lane A 重疊：`electron/main.ts`、`electron/preload.ts`、`src/types/electron.d.ts`、`src/App.tsx`、縮圖元件、`src/stores/terminal-attention-store.ts`、locales 也在 T0761 / T0762 範圍內。動工前與 commit 前各 `git diff <檔>`：有別人的未提交修改就等對方 commit 後再改，不得一起 commit。"
  - "🔴 yolo：不得問使用者；判讀問題依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。Git：只用 `git commit --only` commit 本單範圍；同一 checkout 有其他 Worker 並行，不得 commit 或改動別人的未提交變更；`CLAUDE.md`、`docs/agent-guide/*.md` 等共用檔若已有別人的未提交修改，等對方 commit 後再改（`git diff <檔>` 確認）。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。用 Python 改檔一律 `newline=''`。公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」。不 push、不發版。"
---
# T0767 — PLAN-055 B2：被中斷的 codex 分頁提供恢復（`codex resume` 選單，依 cwd 篩選）

## 元資料

- **工單編號**：T0767
- **類型**：implementation
- **優先級**：P3
- **建立時間**：2026-11-02T02:32:46+0800
- **預估規模**：S

## 背景

PLAN-055 B2：BAT 沒有 codex session id，恢復改用 codex 自己的 `resume` 選單（D211 / P-4 a）。依附 T0766 的快照與對話框。

## 範圍

codex 分頁的「恢復」按鈕、指令組裝、測試、文件。

## 不做

- 不猜 codex session id；不用 `--last`；不發版。

## 驗收

- [ ] 查證 codex `resume` 參數有證據
- [ ] 單元＋e2e（stub codex）＋突變檢查；typecheck 0 / 0、`test:unit`、`vite build`（匯出目錄）
- [ ] 文件更新

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯（唯一例外：`### 待塔台決策` 的 `塔台答覆 Q-n` 行由塔台新增）

### 待塔台決策

#### Q-1：codex 恢復需要改兩個不在 `affects_files` 的檔，是否擴大範圍？
- 提問時間：2026-11-02T03:51:49+0800
- 選項：[A] 擴大：加入 `src/stores/interrupted-agents-store.ts`（`isResumableAgent` 擋掉 codex、`resumeInterruptedAgent` 回 `NOT_CLAUDE`、使用者分頁 / main 的分流都在這裡）與新檔 `src/lib/codex-resume-args.ts`（`codex resume` 參數判斷，main 與 renderer 共用，比照 T0766 的 `src/lib/claude-resume-args.ts`）/ [B] 不擴大：只在 `InterruptedAgentsDialog.tsx` 另寫 codex 分流、判斷內聯在 main 與 WorkspaceView 各一份 / [C] 其他：________
- Worker 建議：[A]。B1 的恢復分流唯一實作就在 store，不改它 codex 列永遠回 `NOT_CLAUDE`；[B] 會在 dialog 繞過 store、判斷寫兩份，違反「唯一實作」慣例。兩檔都不在 Lane A 的重疊清單，目前沒有別人的未提交修改。
- 影響範圍：上述兩檔＋其單元測試；其餘照 `affects_files`
- 阻塞：否（先做 main 端 `electron/terminal-command-handlers.ts` / `electron/interrupted-agents.ts` 與查證；改 renderer 前等答覆）

### 完成狀態

### 產出摘要

### 遭遇問題

### 回報時間
