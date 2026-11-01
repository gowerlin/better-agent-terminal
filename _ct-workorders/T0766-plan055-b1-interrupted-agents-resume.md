---
schema_version: 1
schema_kind: workorder
id: T0766
title: "PLAN-055 B1：Terminal Server recovery 後列出被中斷的 agent 分頁，claude 分頁一鍵 `--resume`"
type: implementation
status: DONE
started_at: "2026-11-02T03:17:37+0800"
updated_at: "2026-11-02T03:47:15+0800"
completed_at: "2026-11-02T03:47:15+0800"
session_ids:
  - "87ba3594-c2a3-4216-868b-f43a2ff7b008"
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

- **狀態**：DONE（驗收四項全部完成；product commit `cb263cc1`）
- **落點檢查**：PASS。C-0 `repo` = `better-agent-terminal`、`basename(REPO_ROOT)` = `better-agent-terminal`；C-1 工單在 REPO_ROOT 下；C-3 `electron/pty-manager.ts` 等皆存在（資訊性）；C-2 無 `branch` 欄位。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）。
- **環境**：`CT_MODE=yolo`、`CT_INTERACTIVE=0`；未設 `CT_HOME`（非 worktree）；`BAT_REMOTE_TOKEN` 已設定。
- **session_id**：87ba3594-c2a3-4216-868b-f43a2ff7b008

### 產出摘要

#### 查證（T0765 未驗證的推論）

- **cwd 編碼**（內嵌 claude `2.1.316`，從二進位內的 JS 取得）：session 目錄 = `<設定目錄>/projects/<SN(cwd)>`，`SN` = `cwd.replace(/[^a-zA-Z0-9]/g, "-")`，超過 200 字元時 `slice(0, 200)` + `-` + Java 式字串雜湊的 base36；目錄名可被 `CLAUDE_CODE_PROJECT_DIR_NAME` 覆寫（有 `CLAUDE_CONFIG_DIR` 時），另有 Windows 不分大小寫的比對。⇒ 規則不夠穩定，**依工單退回只檢查 id 格式**（UUID）。實測 `claude -p --resume=00000000-0000-4000-8000-000000000000 --name=probe-t0766 "x"`（暫存目錄）→ `No conversation found with session ID: 00000000-…`、exit 1、不送 API：`--resume=<id>` 的 `=` 形式可解析、可與 `--name=` 並用，id 不存在時由 claude 自己報錯。
- **`-n` 在 `--resume` 時**：help 為「Set a display name for this session (shown in the prompt box, /resume picker, and terminal title)」，`-n` 與 `--resume` 並用可解析（上列實測）；resume 後顯示名稱是否更新**未實機驗證**（需真 session、會耗 token）。BAT 的 `claudeSessionName` 取自自己的紀錄，不受影響；resume 一律沿用啟動時注入的名稱（e2e 驗證 argv 帶原 `--name=`）。

#### 實作（D211 全採建議）

- main：`PtyManager.collectInterruptedAgentSources` + `PtyManagerDeps.onAgentsInterrupted`，在 `handleServerDeath` 的 `notifySurvivingPtys([])` 之後、`blockedTracker.clearAll` 之前呼叫（日誌字串、五步順序不變）。`electron/interrupted-agents.ts`（新，不 import electron）：`buildInterruptedAgentSnapshot`（判定、`launchedBy`、agent 推定）、`InterruptedAgentsStore`（第二次 recovery 沿用 session id、移除、變動事件）、`resumeInterruptedDispatchAgent`。main 接線：清單變動 → `claude-sessions.json` + `terminal-server:agents-interrupted` 送本 BAT 視窗；移除條件 `onPtyExit`（關分頁 / ⏻ / resume 前 kill）、`onClaudeSessionChange`、略過、resume；`ipcMain.handle` 三個 channel（query / dismiss / resume），不進 `PROXIED_CHANNELS`、不經 `registerHandler`、不是 helper channel。
- `ClaudeSessionPersistence`：`interrupted: [{ terminalId, sessionId, at }]`，只在有項目時寫這個鍵（沒有 recovery 時檔案格式不變）；重開不還原（P-5），`load` 記一行並立即重寫丟掉。
- `createAgentPromptCommandBuilder` 新選項 `resume: { sessionId, sessionName? }`：claude-cli only、沒有 prompt（P-2）、沿用啟動名稱、`--resume=<id>` 放在 BAT 參數之後、自訂參數之前；不帶 `resume` 時指令不變。
- `src/lib/claude-resume-args.ts`（新，main / renderer 共用）：`claudeResumeArgs`（`session` / `picker`（`--resume` 不帶值）/ `none` + `user-args`）、`userArgsSetClaudeResume`（`--resume` / `-r` / `--continue` / `-c` / `--session-id` / `--from-pr` / `--teleport`、短旗標群組含 `r` / `c`）。
- renderer：`src/stores/interrupted-agents-store.ts`（只留本視窗分頁；claude-cli 分頁 → 工作區註冊的 handler（未掛載的工作區先切過去、5 s 上限），其他 claude 分頁 → main）；`InterruptedAgentsDialog`（`ModalOverlay`、[X]、`onEscape` = 關閉不 resume；依工作區分組、塔台 → 分頁 → Worker、先恢復塔台提示；「恢復」/「開啟 resume 選單」/「略過」/「全部恢復 claude」/「關閉」；codex / unknown 無恢復按鈕）＋ `InterruptedAgentsController`（事件 + pull、`reason: 'recovery'` 自動開、主視窗排除 detached 工作區）；縮圖 ⏸（點擊開對話框）；`ServerStatusToast` 的 `recovered` 補「N 個 agent 分頁已中斷」（N = 0 時與以前相同）；`WorkspaceView.startClaudeCliPty(…, resume)`（不再 `worktree.create`、`--resume` 在 BAT 參數之後）與 `registerTabResumeHandler`（先 `pty.kill` 再啟動，同 ⏻）。locales 三語新增 `interruptedAgents.*` 與 `app.terminalServerRecoveredInterrupted_one/_other`。
- 文件：`terminal-server-recovery.md`（步驟 3、新節「被中斷的 agent 分頁」含查證結果、已知限制改寫、驗證清單）、`claude-session-name.md`（recovery 不再丟 session id、`interrupted` 持久化）、CLAUDE.md「Terminal Server 存活判定與 recovery」節加 1 條（≈5 行份量）。

#### 驗證

| 項目 | 結果 |
|---|---|
| `npm run typecheck`（主 checkout） | 0 |
| `npm run typecheck:electron`（主 checkout） | 0 |
| `npm run test:unit`（主 checkout，最終一次） | 375 檔 passed；6641 passed / 10 skipped |
| `npm run test:legacy`（匯出目錄） | 33 檔 passed；472 passed / 0 failed |
| `npx vite build`（匯出目錄 `%TEMP%/bat-T0766-build`，`git archive HEAD` ＋覆蓋本單工作樹檔案，`node_modules` junction） | exit 0（最終程式碼再 build 一次） |
| e2e `e2e/t0766-interrupted-agents-recovery.spec.ts`（隔離實例、匯出目錄） | 1 passed（最終程式碼再跑一次也 passed） |
| e2e `e2e/t0704-heartbeat-recovery.spec.ts`（不回歸、匯出目錄） | 1 passed（1.6 m） |
| 匯出目錄清理 | 先刪 junction，主 checkout `node_modules/electron` 仍在，匯出目錄已刪 |

- **T0765 ④ 單元清單**：快照只列 agent 分頁、純 shell 不列；`clearAll` 後 session id 仍可從快照取得（`pty-manager-interrupted-agents.test.ts`）；`claude-sessions.json` recovery 後有 `interrupted`，離開清單後移除、重開不還原（`interrupted-agents.test.ts`）；builder `resumeSessionId` → `--resume=<id>`、BAT MCP / `--name=` 照舊、自訂參數含 `-c` / `--resume` 等不加；對話框依工作區分組、Esc 關閉不 resume、全部恢復只算 claude 列（`interrupted-agents-dialog.test.tsx`）；`dialog-escape.test.tsx` 涵蓋清單加入新 Dialog。另加 channel 只在 `ipcMain.handle` 的 guard、id 樣式與 hook handler 一致。
- **e2e 兩種分頁**：stub `claude.exe`（.NET Framework `csc` 現場編譯，system runtime customPath；記錄 argv、經 `bat-hook.mjs session-start` 回報假 session id），claude-cli 分頁 + shell 分頁（塔台）+ `bat-terminal.mjs --skill ct-exec --agent claude-cli` 派的 Worker；只 `taskkill /F` server → `reason=ipc-exit`。斷言：對話框只列 claude 分頁與 Worker（shell 不列）、兩個 ⏸、日誌只有 session 前 8 碼、`claude-sessions.json` 有兩筆 `interrupted`；恢復後 stub argv：分頁 `--mcp-config=… --settings=… --name=T0766 · e2et07 --resume=<id>`，Worker `… --name=T0766 · Worker · T0766 --resume=<id>`（沒有 `/ct-exec`），兩者 `SessionStart` 再次回報，對話框與 ⏸ 消失、`interrupted` 鍵移除。
- **突變檢查**（改完執行、再還原）：① 快照移到 `clearAll` 之後 → `pty-manager-interrupted-agents.test.ts` 2 失敗（行為 + source guard）；② persistence 的 `interruptedEntries` 回 `[]` → 1 失敗；③ builder 不加 `resume.arg` → 2 失敗。還原後全過。
- **不回歸**：⏻ 重啟 claude-cli 仍呼叫 3 參數的 `startClaudeCliPty`（無 `--resume`，source guard）；沒有 recovery 時 dep 不被呼叫、toast 與 `claude-sessions.json` 格式不變（單元）；不帶 `resume` 的派工指令不變（單元）；T0704 單元與 e2e 全過；`bat-mcp-launch.test.ts` 的 `buildLaunchCommand(` 計數不變（未新增呼叫，完整 test:unit 通過）。

#### 相關檔案

新增：`electron/interrupted-agents.ts`、`src/lib/claude-resume-args.ts`、`src/stores/interrupted-agents-store.ts`、`src/components/InterruptedAgentsDialog.tsx`、`electron/__tests__/interrupted-agents.test.ts`、`electron/__tests__/pty-manager-interrupted-agents.test.ts`、`src/lib/__tests__/claude-resume-args.test.ts`、`src/components/__tests__/interrupted-agents-dialog.test.tsx`、`e2e/t0766-interrupted-agents-recovery.spec.ts`。
修改：`electron/pty-manager.ts`、`electron/claude-session-name-record.ts`、`electron/main.ts`、`electron/terminal-command-handlers.ts`、`electron/preload.ts`、`src/types/electron.d.ts`、`src/App.tsx`、`src/components/{WorkspaceView,TerminalThumbnail,ServerStatusToast}.tsx`、`src/locales/{en,zh-TW,zh-CN}.json`、`src/components/__tests__/dialog-escape.test.tsx`、`electron/__tests__/claude-session-query.test.ts`（T0642 source guard 跟著 `onClaudeSessionChange` 新形式更新）、`docs/agent-guide/{terminal-server-recovery,claude-session-name}.md`、`CLAUDE.md`。

### 遭遇問題

- **範圍偏差（已記錄）**：`src/lib/claude-resume-args.ts` 與其測試不在 `affects_files`（清單只有 `src/stores/`、`src/**/__tests__/`）。`--resume` 參數判斷必須 main（派工 builder）與 renderer（`startClaudeCliPty`）共用同一份，依 CLAUDE.md「唯一實作」慣例放在 `src/lib/`（同 `claude-session-name.ts`）；未改其他範圍外檔案。另 `electron/__tests__/claude-session-query.test.ts` 的 T0642 source guard 斷言舊的 `onClaudeSessionChange: () => …` 字串，依本單行為變更更新（在 `electron/__tests__/` 範圍內）。
- 完整 test:unit 第一次跑出 2 個 guard 失敗（上列 T0642 guard；`proxied-channels-binding.test.ts` 要求 preload invoke 的 channel 以字面字串 `ipcMain.handle`），改為字面 channel 後全過。renderer typecheck 一度因 src 測試 import `electron/` 檔（tsconfig references，TS6305）失敗，改把 id 樣式一致性的斷言移到 electron 測試。
- 本機 Python 經 Bash heredoc 會把 `\\` 變成 `\`（含反斜線的替換字串失準），之後含反斜線的修改一律改用 Edit；沒有寫壞已提交的檔案（每次都以 grep / 測試確認）。
- 與 Lane A 重疊檔：動工前與 commit 前 `git diff` 皆無他人未提交修改；commit 以 `git commit --only` 指定 27 個本單檔案，未含 `_ct-workorders/T0763-…`（他人變更）。
- 未自動化：codex 分頁的恢復按鈕（T0767 範圍，本單只列出並顯示「codex：之後的版本提供恢復」）；`-n` 在 resume 時的顯示名稱更新（見查證）。

### 互動紀錄

- 無（yolo，未提問）。

### 回報時間

- 2026-11-02T03:47:15+0800
