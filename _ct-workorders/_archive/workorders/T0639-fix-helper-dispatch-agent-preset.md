---
schema_version: 1
schema_kind: workorder
id: T0639
title: "BUG-155：helper 派工建立的 Worker PTY 記錄 `agentPreset`（`whoami.agent`、claude Worker 的 update guard env）"
type: bugfix
status: DONE
repo: better-agent-terminal
project: BUG-155
priority: P2
sizing: S
created_at: "2026-10-18T15:40:56+0800"
started_at: "2026-10-18T15:42:01+0800"
updated_at: "2026-10-18T15:49:52+0800"
completed_at: "2026-10-18T15:49:52+0800"
depends_on: [T0637]
related:
  - "BUG-155（T0637 發現：codex Worker 的 `bat_whoami` 沒有 `agent`）；T0582（`terminal:whoami` 契約 `agent?` = agentPreset）；T0525 / BUG-131（`buildPtyEnv` 唯一組裝點、`claudeCliUpdateGuardEnv`）；T0372 / BUG-084（embedded 的 `DISABLE_UPDATES`）；T0621（codex 版本判定 / `osc`）"
affects_files:
  - electron/terminal-command-handlers.ts
  - "electron/pty-manager.ts（只在需要時）"
  - "electron/remote/headless-entry.ts、electron/remote/**（只在 headless 派工路徑需要同步時）"
  - "electron/__tests__/**、electron/remote/__tests__/**"
  - "docs/agent-guide/helper-query-channels.md、docs/agent-guide/claude-agent-sdk-cli.md（只補一句行為說明；CLAUDE.md 只在必守規則改變時動一句）"
  - _ct-workorders/T0639-fix-helper-dispatch-agent-preset.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 不改既有契約的語意：helper 的參數、exit code、stdout（含 `started:` 行）、`terminal:whoami` / `get-state` / `list` 的欄位名與值域都不變；本單只讓原本就定義的 `agent?` 有值（T0582 契約）。"
  - "🔴 raw command 模式（`terminal:create-with-command` 不經 agent 解析）維持不傳 `agentPreset`；`codex` 不得因此多注入任何 env（`claudeCliUpdateGuardEnv` 只對 `claude-cli` / `claude-cli-worktree`）。BUG-059 規則不變：`DISABLE_UPDATES` 只給 embedded，system runtime 絕不注入（`claudeUpdateGuardEnv(source)`）。"
  - "🔴 新增 env 一律經 `PtyManager.buildPtyEnv()`（CLAUDE.md「Logging」節 T0525），不要在 `createWithCommand` 分支內聯。"
  - "🔴 非隔離工單。另一張工單 T0638（網站）同時在改 `site/**`，不碰；`src/styles/settings.css` 的 M 不是你的變更，不碰。commit 用 `git commit --only <檔案>`。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF。不 push。"
---

# T0639 — helper 派工的 Worker 記錄 `agentPreset`

## 背景

T0637 實機（`v0.7.0-pre.9`）：codex Worker 的 `bat_whoami` 沒有 `agent`。塔台初查：`createWithCommand`（`electron/terminal-command-handlers.ts`）呼叫 `ptyManager.create(...)` 時沒有傳 `agentPreset`，resolved agent 只進了送 renderer 的 payload（分頁標題）。連帶 `claudeCliUpdateGuardEnv(agentPreset)` 對 helper 派出的 claude Worker 不生效，embedded runtime 下少了 `DISABLE_UPDATES=1`。詳見 BUG-155。

## 要做的事

1. 先確認根因（讀程式碼即可，不需實機）：helper agent 模式（`--skill` / `--workorder` / `--agent`）從解析出 agent 到 `ptyManager.create` 的路徑；本機與 headless 是否共用；還有哪些地方讀 `agentPreset`（`getAgentPreset`、`getTerminalInfo`、Terminal Server recovery / restart 重建 env、`isYoloTerminal` 等），列在回報區。
2. 修正：helper agent 模式建立 PTY 時傳入 resolved agent 的 preset id（與 BAT UI 開的同一 agent 分頁相同的值）。raw command 模式不傳。
3. 確認修正後的連帶行為都正確，並寫進回報區：
   - `whoami.agent`：claude Worker = `claude-cli`（或實際 preset）、codex Worker = `codex-cli`
   - claude-cli Worker 的 PTY env：embedded runtime 含 `claudeUpdateGuardEnv('embedded')` 的鍵；system runtime 不含 `DISABLE_UPDATES`
   - codex Worker 的 PTY env 不因本單多任何鍵
   - `pty:restart` / Terminal Server recovery 重建時沿用（若既有邏輯已沿用 `instance.agentPreset`，寫明即可）
4. 測試（vitest，不耗 token）：上述每一點至少一個斷言；若有 source guard 計數受影響，同步更新並說明。
5. 文件：`docs/agent-guide/helper-query-channels.md` 的 `whoami` 說明補一句「helper 派工的 Worker 也有 `agent`（BUG-155 前沒有）」；update guard 若在 `docs/agent-guide/claude-agent-sdk-cli.md` 有「已知缺口」敘述，同步更新。

## 驗證

- `npm run typecheck` = 0、`npm run typecheck:electron` = 0
- `npm run test:unit` 全綠（回報 passed / files 數；基線 5298 / 303）
- `npx vite build` 成功

## 驗收

- helper 派出的 Worker `whoami.agent` 有值；claude Worker（embedded）有 update guard；codex Worker 與 raw command 行為不變
- 契約欄位、helper 輸出、exit code 皆不變
- 三項驗證通過；回報區附根因確認、讀 `agentPreset` 的地方清單、測試清單與 commit
- 只改 `affects_files`；未 push

---

## 回報區

### 結果摘要

**FIXED**。helper agent 模式（`terminal:create-agent-command`）建立 PTY 時傳入解析出的 agent preset id；raw command 模式不傳。`whoami.agent` 有值、claude-cli Worker 依 runtime 套用 update guard、codex Worker 與 raw command 行為不變。契約欄位 / helper 輸出 / exit code 皆未改。

### Landing check

- C-0 PASS：`repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`（REPO_ROOT = `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）
- C-1 PASS（工單在 REPO_ROOT 下）；C-3 資訊性 PASS（`electron/terminal-command-handlers.ts` 存在）；C-2 無 `branch` 欄位（`main`）
- `CT_HOME` 未設（非隔離）；`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅紀錄）；`CT_MODE=yolo`、`CT_INTERACTIVE=0`

### 根因確認（讀程式碼）

- 路徑：`terminal:create-agent-command` handler → `unknownAgent`（`--agent` 簡寫正規化）→ `deps.buildAgentPromptCommand`（`createAgentPromptCommandBuilder`，回傳 `agentId` = `toTerminalDrivenAgentId(...)`，即 `claude-cli` / `codex-cli` 等，與 BAT UI 開同一 agent 分頁的 preset id 相同）→ `commandOptions.agent = resolved.agentId`（T0553，只供分頁標題）→ `createWithCommand(...)` → `ptyManager.create({ id, cwd, type, shell, customEnv, workspaceId, workorder?, worktree? })` —— **沒有 `agentPreset`**。resolved agent 只進了 `terminal:created-externally` payload。
- 本機與 headless 共用：兩者都經 `registerTerminalHandlers`（`electron/handlers/terminal.ts`）→ `registerTerminalCommandHandlers`（`electron/terminal-command-handlers.ts`），且都不傳 `invokeHandler`，所以都走直接呼叫 `createWithCommand` 的分支；headless 的 PtyManager 是同一個類別。一處修正兩邊生效。
- 讀 `agentPreset` 的地方（`electron/**`，非測試）：
  - `PtyManager.buildPtyEnv` → `claudeCliUpdateGuardEnv(agentPreset)`（只對 `claude-cli` / `claude-cli-worktree`；`electron/pty-manager.ts`）
  - `PtyManager.create`：存入 `PtyInstance.agentPreset`（Terminal Server / node-pty / child_process 三條路徑）；Terminal Server idempotent re-create（T0108）在缺值時補上
  - `PtyManager.restart`：沿用 `instance.agentPreset` 重建
  - `PtyManager.handleServerDeath`（Terminal Server recovery，T0112 / T0525）：以 `inst.agentPreset` 重建 env
  - 結束紀錄 `ExitedPtyRecord.agentPreset`（PTY 結束時）
  - `PtyManager.getTerminalInfo` → `terminal-query-handlers.ts` `terminal:whoami` 的 `agent`（排除 `none`）
  - `PtyManager.getAgentPreset` → `terminal-role.ts` `setTerminalRole` 的 `ptyAgent` / `ptyAgentName`（塔台分頁標題，T0562）
  - `isYoloTerminal` **不讀** `agentPreset`（看塔台宣告與 `customEnv.CT_MODE`）
  - `electron/handlers/claude.ts` / `codex-agent-manager.ts` 的 `agentPreset` 是 Agent 面板 session 參數，與 PTY 無關

### 修正

- `electron/terminal-command-handlers.ts`：
  - `TerminalPtyManager.create` 型別加 `agentPreset?`
  - `createWithCommand` 加第 6 個內部參數 `agentPreset?`（與 `isolation` / `dispatchShell` 相同：只由 create-agent-command 直接呼叫時傳入，**不從 create-with-command payload 讀**，所以 raw command 的呼叫者在 payload 放 `agent` / `agentPreset` 也不會記錄）；`ptyManager.create` 時 `...(agentPreset ? { agentPreset } : {})`
  - create-agent-command 傳 `resolved.agentId`
  - `invokeHandler` 跳轉分支（兩個 host 都不用，只有測試用）不帶 preset，已加註解
- env 仍只經 `PtyManager.buildPtyEnv()` 組裝（未在 handler 內聯任何 env）。

### 連帶行為

- `whoami.agent`：claude Worker = `claude-cli`、codex Worker = `codex-cli`（測試以真 PtyManager + `registerTerminalQueryHandlers` 驗證）
- claude-cli Worker PTY env：embedded runtime 含 `DISABLE_UPDATES=1`（`claudeUpdateGuardEnv('embedded')`）+ `DISABLE_AUTOUPDATER=1`；system runtime 不含 `DISABLE_UPDATES`（BUG-059 規則不變）
- codex Worker PTY env：key 集合與同 customEnv 的 raw command PTY 完全相同（不多任何鍵）
- `pty:restart`：既有邏輯沿用 `instance.agentPreset`（測試確認 restart 後 preset 與 env 不變、含 `DISABLE_UPDATES`）；Terminal Server recovery：既有 `handleServerDeath` 以 `inst.agentPreset` 重建（`pty-manager-helper-env.test.ts` 既有 T0525 測試已涵蓋），無需改動
- 塔台標題（T0562）：helper 派出的 Worker 若之後被 `--set-role tower`，`ptyAgent` 現在有值；預期中的改善，未改程式

### 測試

- 新增 `electron/__tests__/helper-dispatch-agent-preset.test.ts`（5 個）：claude-cli embedded（whoami.agent + `DISABLE_UPDATES`）、claude-cli system（無 `DISABLE_UPDATES`）、codex-cli（whoami.agent + env key 與 raw 相同）、raw command（payload 帶 `agent` / `agentPreset` 仍不記錄、無 agent、無 guard）、restart 沿用。反向驗證：暫時拿掉修正那一行 → 4/5 失敗（raw 那一個本來就該過），放回後全過。
- 更新既有測試（斷言的是 BUG-155 前的行為 / 呼叫字串）：
  - `electron/__tests__/terminal-handlers.test.ts`「created-externally names the agent … (T0553)」：原 `custom.created[0]` `not.toHaveProperty('agentPreset')` → 改為 `agentPreset` = `'not-in-registry'`；另加 raw `created[0]` 無 `agentPreset`
  - `electron/__tests__/dispatch-shell-family.test.ts` source guard：`createWithCommand(...)` 呼叫字串加上 `, resolved.agentId`（計數類 guard 未受影響）

### 驗證

| 項目 | 結果 |
|---|---|
| `npm run typecheck` | ✅ exit 0 |
| `npm run typecheck:electron` | ✅ exit 0（0 個 `error TS`） |
| `npm run test:unit` | ✅ 304 files / 5303 passed / 3 skipped（基線 303 / 5298，+1 檔 +5 測試）；第一次全量跑出 2 個預期中的舊斷言失敗，更新後全綠 |
| `npx vite build` | ✅ exit 0 |

未做實機（工單不要求）；runtime 驗收（實機 codex / claude Worker `bat_whoami`）留給塔台 / 下一版預覽。

### 檔案變更

- `electron/terminal-command-handlers.ts`
- `electron/__tests__/helper-dispatch-agent-preset.test.ts`（新增）
- `electron/__tests__/terminal-handlers.test.ts`
- `electron/__tests__/dispatch-shell-family.test.ts`
- `docs/agent-guide/helper-query-channels.md`（whoami `agent?`：helper 派工的 Worker 也有，BUG-155 前沒有；raw command 沒有）
- `docs/agent-guide/claude-agent-sdk-cli.md`（「已知缺口」改寫：helper 派工分頁自 T0639 起帶 preset、依 runtime 注入；raw command 仍不帶）
- CLAUDE.md 未動（必守規則未改變）

### Commit

- 產品：`149f6f8d`（`fix(dispatch): record agentPreset on helper-dispatched Worker PTYs (T0639, BUG-155)`），`git commit --only` 6 個檔；未碰 `site/**`、`src/styles/settings.css`；未 push

### 遭遇問題

- 無。注意：本 session 的 shell 有 `DISABLE_AUTOUPDATER=1`、無 `DISABLE_UPDATES`；新測試在 beforeEach 清掉 `DISABLE_UPDATES` 以免繼承 env 干擾。

### 互動紀錄

- 無（未向塔台提問）。
