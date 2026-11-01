---
schema_version: 1
schema_kind: workorder
id: T0767
title: "PLAN-055 B2：被中斷的 codex 分頁提供恢復（`codex resume` 選單，依 cwd 篩選）"
type: implementation
status: DONE
started_at: "2026-11-02T03:49:49+08:00"
updated_at: "2026-11-02T04:04:52+08:00"
completed_at: "2026-11-02T04:04:52+08:00"
session_ids:
  - "a7215762-7b6e-40e4-80f6-5b20abfbde74"
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

- **狀態**：DONE
- **session_id**：a7215762-7b6e-40e4-80f6-5b20abfbde74
- **產品 commit**：`5d104926`（`feat: resume codex tabs interrupted by a Terminal Server recovery with codex's resume picker (T0767, PLAN-055 B2)`）；未 push、未發版
- **落點檢查**：PASS。C-0 `repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal`；C-1 工單在 REPO_ROOT 下；C-3 PASS（`affects_files` 前幾項皆存在）；C-2 無 `branch` 欄位。未設 `CT_HOME`（主 checkout）。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）。`CT_MODE=yolo`、`CT_INTERACTIVE=0`。

### 產出摘要

**codex `resume` 參數查證**（內嵌 `node_modules/@openai/codex-win32-x64/.../codex.exe`，`codex-cli 0.166.0`，實際執行）：

- `codex resume --help`：`Usage: codex resume [OPTIONS] [SESSION_ID] [PROMPT]`；不帶 SESSION_ID = 選單（「picker by default; use --last」），`--all` 才關掉 cwd 篩選。
- `resume` 與 `codex` 本身的選項逐項比對相同（`-c`、`--no-daemon`、`-m`、`-s`、`--remote` …），`resume` 另多 `--last` / `--all` / `--include-non-interactive`。
- 子命令前的選項會傳給 `resume`（以暫存 `CODEX_HOME`、非 TTY 實測）：`codex -c sandbox_mode=bogus resume` 與 `codex resume -c sandbox_mode=bogus` 都回 ``Error loading config.toml: unknown variant `bogus` ``；`codex --no-daemon resume --remote ws://127.0.0.1:1` 回 `--no-daemon cannot be used with --remote`（root 的 `--no-daemon` 有併入）。
- 結論：BAT 參數照原位置（`codex` 之後），`resume` 接在 BAT 參數之後、自訂參數之前（與 claude 的 `--resume=` 同位置；`agent-registry.ts` T0377 註解本來就預期 `resume` 子命令出現在 BAT 的 `-c` 之後）。

**實作**

- `src/lib/codex-resume-args.ts`（新，Q-1 塔台核准）：`codexResumeArgs` / `userArgsSetCodexResume` / `codexResumeCommand`。預設 `resume`（`picker`）；自訂參數已含 `resume` / `fork` 子命令 → 不加（`none`、`user-args`）。不帶 session id、不帶 prompt、不用 `--last`。main 與 renderer 共用、不 import electron / DOM。
- `electron/terminal-command-handlers.ts`：builder 的 `resume` 允許 `codex-cli`；codex 用 `codexResumeArgs`，其餘（BAT MCP `-c`、派工的 `-c check_for_update_on_startup=false`、OSC detection、自訂參數）走原路徑。
- `electron/interrupted-agents.ts`：`isCodexCliAgent` / `isResumableInterruptedAgent`；`resumeInterruptedDispatchAgent` 接受 codex（拒絕碼 `NOT_CLAUDE` → `NOT_RESUMABLE`，只剩 unknown 等）。`electron/main.ts` 不需改（handler 原樣把 agent 與 `resume` 交給 builder）。
- `src/stores/interrupted-agents-store.ts`（Q-1 塔台核准）：`isResumableAgent` 含 codex-cli；renderer `agentPreset` 為 codex-cli 的分頁走工作區 handler，其他 codex 分頁（派工 Worker、shell 手打）走 main。
- `src/components/WorkspaceView.tsx`：`resumeCodexCliTab` = ⏻ 的 `restartOrCreatePty`（cwd 用快照的）→ 同 ⏻ 的 `buildLaunchCommand` + `withBatMcpLaunchArgs`（BAT MCP `-c`，或依 T0758 後的版本探測加 `--no-daemon`）→ `codexResumeCommand` → 寫入新 shell。不另寫組裝。
- `src/components/InterruptedAgentsDialog.tsx` + 三個 locale：codex 列顯示「codex：開啟 codex 的 resume 選單（這個資料夾的 session）」與「開啟 resume 選單」按鈕；「全部恢復（N）」改含 codex（原「全部恢復 claude」）；結果訊息 `resumedCodexPicker` / `resumedCodexUserArgs`；移除 `codexLater`。
- 文件：`docs/agent-guide/terminal-server-recovery.md`（必守規則、唯一實作、流程、查證紀錄、日誌、已知限制、驗證清單）、`CLAUDE.md`「Terminal Server 存活判定與 recovery」節那一行。

**驗證**（product HEAD = `5d104926`，驗證時的程式碼與 commit 內容相同）

| 項目 | 結果 |
|---|---|
| `npm run typecheck`（主 checkout） | 0 |
| `npm run typecheck:electron`（主 checkout） | 0 |
| `npm run test:unit`（主 checkout） | 378 files / 6662 passed / 10 skipped，exit 0 |
| e2e 型別 `npx tsc --noEmit --strict … e2e/t0767-interrupted-codex-resume.spec.ts` | 0 |
| `npx vite build`（`%TEMP%\bat-T0767-build`：`git archive HEAD` + 本單變更檔，`node_modules` junction） | exit 0 |
| e2e `e2e/t0767-interrupted-codex-resume.spec.ts`（隔離實例，同匯出目錄） | 2 passed（BAT MCP 開 / 關） |
| e2e 驗紅：匯出目錄把 `codexResumeArgs` 改成不加 `resume`、重 build | 2 failed（`expect(resumed).toEqual(...)`），之後檔案以主 checkout 覆回、hash 相同 |

- 新增單元：`electron/__tests__/interrupted-agents-codex.test.ts`（8）、`src/lib/__tests__/codex-resume-args.test.ts`、`src/components/__tests__/interrupted-agents-codex.test.tsx`（store 分流、對話框、Controller 訊息、source guard）。更新：`interrupted-agents.test.ts` / `interrupted-agents-dialog.test.tsx`（原「codex 拒絕」改為 unknown 拒絕；按鈕文字）、`bat-mcp-launch.test.ts` / `blocked-hooks-launch.test.ts`（renderer 啟動 source guard 計數 4→5 / 5→6，並新增 codex 恢復呼叫格式的檢查）。
- 突變檢查（各自拿掉修正後跑相關 5 檔，皆有失敗，之後從備份還原）：M1 builder codex 改回 claude 參數 4 failed；M2 builder 拒絕 codex 4 failed；M3 main 拒絕 codex 2 failed；M4 store 不認 codex 7 failed；M5 codex 分頁改走 main 3 failed；M6 忽略 `resume` 自訂參數 3 failed；M7 WorkspaceView 拿掉 codex 分支 1 failed；M8 對話框 codex 狀態 3 failed。
- e2e 實測 argv（stub `codex.exe` 記錄；本機 BAT 為提權執行，所以兩次都有 `-c features.daemon_auto_start=false`）：
  - MCP 開，使用者分頁：第一次 `[-c features.daemon_auto_start=false, -c mcp_servers.bat.command=…, …, -c mcp_servers.bat.tool_timeout_sec=60, --model, e2e-t0767]` → 恢復 `[…同上…, resume, --model, e2e-t0767]`。
  - MCP 開，Worker：第一次 `[…, -c check_for_update_on_startup=false, --model, e2e-t0767, $ct-exec T0767]` → 恢復 `[…, -c check_for_update_on_startup=false, resume, --model, e2e-t0767]`。
  - MCP 關：使用者分頁 `[-c features.daemon_auto_start=false, --no-daemon, --model, e2e-t0767]` → `[…, --no-daemon, resume, --model, e2e-t0767]`；Worker 不加 `--no-daemon`（派工原本就不加）。
  - 沒有 `--last`；日誌 `[interrupted-agents] interrupted: … agent=codex-cli launchedBy=tab|dispatch … session=unknown`、`resumed dispatch: … mode=picker`。
- 清理：匯出目錄（先刪 junction 本身，主 checkout `node_modules\electron` 仍在）、`%TEMP%\bat-t0767-*`、隔離 userData `BetterAgentTerminal-runtime-e2e-t0767*` 都是 0 個殘留。

### 相關通過案例判定

本單不涉客戶驗收案例（BAT 無 UAT 案例表）。既有行為：claude 恢復路徑未改（T0766 測試與 `test:unit` 全過）；⏻ 重啟與一般 codex 啟動指令未改（`bat-mcp-launch` / `blocked-hooks-launch` source guard 仍逐一檢查原 4 / 5 處）。

### 遭遇問題

1. `src/stores/interrupted-agents-store.ts` 與新檔 `src/lib/codex-resume-args.ts` 不在 `affects_files` → Q-1 問塔台，答覆 A（擴大），已照做。
2. 既有 source guard（`bat-mcp-launch.test.ts`、`blocked-hooks-launch.test.ts`）數 WorkspaceView 的 `buildLaunchCommand(` / `withBatMcpLaunchArgs(` 次數，新增的 codex 恢復路徑使第一次 `test:unit` 2 檔失敗；把呼叫拆成獨立一行（tab id 仍是最後一個參數，符合原 guard 規則）並更新計數與新增格式檢查後全過。
3. 以 bash heredoc 跑 Python 改檔時，反斜線跳脫被吃掉兩次（一次寫出真的 CR、一次在測試 regex 寫出換行、一次在文件寫出 `` \` ``），皆當下發現並以 Edit / 檔案腳本修正；commit 前以 Python 檢查變更檔皆為 LF、無 CR。

### 互動紀錄

- [03:52] Q-1: codex 恢復需要改兩個不在 `affects_files` 的檔，是否擴大範圍？ → A（塔台代決，BAT 通道 `q-de56ce81-fc1d8f936ae5de03`，answered）：擴大，加入 `src/stores/interrupted-agents-store.ts` 與新檔 `src/lib/codex-resume-args.ts` 及其單元測試；動工與 commit 前 `git diff` 確認無他人修改；回報區記錄這兩檔 → Action: 照做；commit 前確認兩檔與 locales 只有本單修改。

### 後續建議

- 無必做項。可選：helper 派工的 codex Worker 在 codex `< 0.163.0`（沒有 OSC 7501）時不會被列出（沒有 `agentPreset`），若要涵蓋需另開單讓派工記錄 agent 種類。

### 回報時間

2026-11-02T04:04:52+08:00
