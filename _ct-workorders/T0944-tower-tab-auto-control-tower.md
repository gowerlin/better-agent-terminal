---
schema_version: 1
schema_kind: workorder
id: T0944
title: "「以塔台開啟 Claude」啟動時自動帶入 `/control-tower`（新開分頁、⏻ 重啟、還原；resume 不帶）"
type: feature
status: DONE
repo: better-agent-terminal
priority: P2
sizing: S
created_at: "2026-11-27T19:15:29+08:00"
started_at: "2026-11-27T19:16:42+08:00"
updated_at: "2026-11-27T19:21:08+08:00"
completed_at: "2026-11-27T19:21:08+08:00"
session_ids:
  - "5b8491f6-f878-4689-9d32-bbd77be6f6a4"
target_version: "未定（`0.8.0-pre.9` 之後；版號線待使用者確認）"
depends_on: []
related:
  - "D421；使用者 2026-11-27：「以塔台開啟 Claude Code 可以自動帶入 /control-tower 嗎?」→ 帶入時機選「新開＋⏻ 重啟」、不加 Settings 開關；T0644（PLAN-050，只命名、不輸入指令）、T0766（resume 不帶 prompt）、T0403（PTY 仍在跑不重送啟動指令）"
affects_files:
  - _ct-workorders/T0944-tower-tab-auto-control-tower.md
  - src/components/WorkspaceView.tsx
  - src/lib/
  - src/lib/__tests__/
  - src/stores/__tests__/workspace-store.launchRole.test.ts
  - src/__tests__/
  - src/components/__tests__/
  - src/locales/en.json
  - src/locales/zh-TW.json
  - src/locales/zh-CN.json
  - docs/agent-guide/claude-session-name.md
  - CLAUDE.md
  - site/features.md
renew_count: 0
isolation: worktree
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 分支：只在 `ct/T0944` 寫檔（base = 派工當下的 `main`）。不 merge / rebase / push、不動 `main`。主 checkout 只寫本工單檔（`git -C \"$CT_HOME\" commit --only _ct-workorders/<本檔>`）。"
  - "🔴 現況：`handleAddClaudeCliAsTower`（`src/components/WorkspaceView.tsx`）開 claude-cli 分頁並記 `launchRole: 'tower'`，`startClaudeCliPty` 依此取名 `<ws> · Tower`；T0644 規定「只命名，不做 `--set-role`、啟動指令之後不輸入任何東西」。使用者要求改成啟動時自動進入塔台。"
  - "🔴 規格（使用者裁示 D421）：`launchRole === 'tower'` 的分頁，每次「啟動一個新的 claude session」時，把 `/control-tower` 當成 claude 的**啟動參數（位置參數 prompt）**帶入，🔴 不得在 claude 啟動後再模擬打字（不寫 PTY 第二次、不 setTimeout 送字）。帶入的情況：① 「以塔台開啟 Claude」新開分頁；② ⏻ 重啟塔台分頁；③ BAT 重開後還原、PTY 已不在而重新啟動 claude 的塔台分頁（與 ⏻ 同為新 session）。不帶的情況：④ 中斷後一鍵 resume（`startClaudeCliPty` 帶 `resume`，T0766 規則：resume 不附 prompt）；⑤ PTY 仍在跑、不重送啟動指令（T0403，本來就不送）；⑥ 工作區 / 全域自訂參數已含 resume 類旗標（`--continue` / `-c` / `--resume` / `-r` 等，判斷沿用 `claudeResumeArgs` 已有的偵測，`src/lib/claude-resume-args.ts`，不另寫）；⑦ 非塔台分頁（一般 Claude CLI、worktree、Worker 派工）一律不變。不加 Settings 開關（使用者裁示）。"
  - "🔴 參數位置與引號：比照 helper 派工把 `/ct-exec T####` 放進 claude 命令的做法（`electron/terminal-command-handlers.ts` 的 `createAgentPromptCommandBuilder`：prompt 的位置與 `quoteArgForShell` 引號），讓 prompt 不會被自訂參數裡的 variadic 旗標（例 `--allowedTools a b`）吃掉；若 helper 派工本身對此另有處理就照它，沒有就照它的位置（不另發明規則），並在回報區寫明結論。renderer 若沒有現成的引號函式，用既有共用實作（不在 consumer 內聯）。字串固定 `/control-tower`（Claude 端 skill 名稱與 T0710 一樣不改，plugin 安裝也用同一字串）。"
  - "🔴 唯一實作：決定「這次啟動要不要帶、帶什麼」寫成 `src/lib/` 的純函式（例 `towerLaunchPrompt({ launchRole, resume, customArgs })`），`startClaudeCliPty` 只接線；🔴 不改 `--name=`（T0641 / T0644）、BAT MCP / hooks 參數（`withBatMcpLaunchArgs`）、`--resume=` 規則、`setAutoTitle` 標題；BAT 仍不呼叫 `terminal:set-role`（CT 自己宣告）。"
  - "🔴 測試：純函式（新開 / ⏻ / 還原帶；resume 不帶；自訂參數含 resume 類旗標不帶；非塔台不帶；pwsh / cmd / posix 的引號）；`startClaudeCliPty` 組出的命令（塔台分頁含 `/control-tower`、一般 Claude CLI 逐字不變）；`src/stores/__tests__/workspace-store.launchRole.test.ts` 的 source guard 若斷言「不輸入任何東西」→ 依本規格更新並加 T0944 註解（只改那一處意圖，其他斷言不動）。其他既有測試若必然衝突 → 問塔台，不自行改。"
  - "🔴 驗證：worktree `npm ci`；`npm run test:unit` 在 head 第一次完整執行全綠（附數字）；`npx vite build` exit 0；`npm run typecheck` = 0。實機（開分頁看 claude 是否進入塔台）寫〈待實機〉（不碰安裝版 BAT、不開 claude 回合）。"
  - "🔴 文件：CLAUDE.md「Claude 分頁的 session 名稱」節的 T0644 那一點改寫（「只命名…不輸入指令」→ 啟動時帶 `/control-tower`，列出帶 / 不帶的情況，唯一實作函式名；小節標題不改名，T0595）；`docs/agent-guide/claude-session-name.md` 的 T0644 入口段同步（含：沒裝 CT 時 claude 會顯示找不到 skill，這是預期，要不帶就用一般 Claude CLI）；網站 `site/features.md` 提到「以塔台開啟 Claude」處補一句（下一版起自動進入塔台）。選單文字若有說明 / tooltip 需要改才改 i18n。"
  - "🔴 Git：worktree 用 `git add <明確路徑>`；不 push、不觸發 workflow、不建 tag。禁止 `git stash`（含 list）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF。收單前 worktree `status --porcelain` 為空。"
  - "🔴 公開 repo（D176）：程式、註解、測試資料、回報區不寫真名、客戶名、外部專案名、家目錄路徑。yolo：不得問使用者，判讀問題依 ct-exec § Questions For Tower 問塔台。工單狀態寫 `DONE`（L177）。"
---

# T0944 — 「以塔台開啟 Claude」自動帶入 `/control-tower`

## 背景

使用者 2026-11-27 問「以塔台開啟 Claude Code 可以自動帶入 /control-tower 嗎?」。T0644 當初只替 session 命名（`<ws> · Tower`），啟動後不輸入任何東西，使用者還要自己打 `/control-tower`。使用者裁示（D421）：新開分頁與 ⏻ 重啟都帶入，resume 不帶，不加 Settings 開關。

## 範圍

- 塔台分頁啟動新的 claude session 時，以啟動參數帶 `/control-tower`（不是啟動後打字）。
- 帶：新開、⏻ 重啟、BAT 重開後重新啟動；不帶：resume、PTY 仍在跑、自訂參數含 resume 類旗標、非塔台分頁。
- 判斷寫成純函式；命令其餘部分不變。

## 不做

- 不加 Settings 開關；不呼叫 `--set-role`；不改 Worker 派工、一般 Claude CLI、Claude Agent 面板、Codex。

## 驗收

- [ ] 塔台分頁新開 / ⏻ / 還原的啟動命令含 `/control-tower`（位置與引號同 helper 派工）
- [ ] resume、自訂參數含 resume 類旗標、非塔台分頁的命令逐字不變
- [ ] 純函式與命令組裝測試；launchRole source guard 依規格更新
- [ ] `npm run test:unit` head 第一次全綠；`npx vite build` exit 0；`npm run typecheck` = 0
- [ ] 〈待實機〉步驟；文件三處

---

## 回報區

### 完成狀態

- **狀態**：DONE
- **完成時間**：2026-11-27T19:21:08+08:00
- **session_id**：5b8491f6-f878-4689-9d32-bbd77be6f6a4
- **branch**：`ct/T0944`
- **base_sha**：`53c912cefc73076d5ec4eedf5d4a35b187b0a8be`
- **validated_sha**：`81afe164031973e3466b8a667b027439bf706c17`
- **head_sha**：`81afe164031973e3466b8a667b027439bf706c17`（與 validated_sha 相同：先提交產品變更，再在 head 上跑三個驗證關卡）

### 落點檢查

- **結果**：PASS
- C-0：工單 `repo` = `better-agent-terminal`；`basename "$CT_HOME"` = `better-agent-terminal` → PASS
- C-1：工單在 `$CT_HOME/_ct-workorders/` 之下 → PASS
- C-3：資訊性（C-0 已 PASS）；`src/components/WorkspaceView.tsx`、`src/locales/*.json`、`CLAUDE.md` 等皆存在
- C-2：工單無 `branch` 欄位，略過
- 證據：`CT_HOME` 已設定、`CT_WORKTREE_BRANCH` = `ct/T0944`、`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`、`CT_MODE` = `yolo`、`CT_INTERACTIVE` = `0`、`BAT_REMOTE_TOKEN` 已設定

### 結果摘要

「以塔台開啟 Claude」的分頁（`launchRole: 'tower'`）每次啟動新的 claude session 時，把 `/control-tower` 當成 claude 的啟動參數（位置參數 prompt）放在命令最後。仍只寫一次 PTY（啟動指令），沒有啟動後打字。

| 情況 | 結果 | 依據 |
|---|---|---|
| ① 新開「以塔台開啟 Claude」 | 帶 | `handleAddClaudeCliAsTower` → `startClaudeCliPty`（無 `resume`） |
| ② ⏻ 重啟塔台分頁 | 帶 | `handleRestart` → `startClaudeCliPty`（無 `resume`） |
| ③ BAT 重開還原、PTY 已不在 | 帶 | 還原 effect → `startClaudeCliPty` → `createPtyThenLaunch` 新建 PTY 才送 |
| ④ 中斷後一鍵 resume | 不帶（`resume`） | `startClaudeCliPty(…, { sessionId })` |
| ⑤ 還原時 PTY 仍在跑 | 不送任何啟動指令（T0403，原行為） | `createPtyThenLaunch` 的 `created: false` |
| ⑥ 自訂參數含 resume 類旗標 | 不帶（`user-args`） | 沿用 `userArgsSetClaudeResume`（`claudeResumeArgs` 用的同一個偵測） |
| ⑦ 非塔台分頁 | 不帶（`not-tower`），命令逐字不變 | `launchRole !== 'tower'` |

**參數位置與引號的結論**：helper 派工（`createAgentPromptCommandBuilder`，`electron/terminal-command-handlers.ts:1229`）把 prompt 放在 `commandWithArgs`（BAT 參數 → `--resume` → 自訂參數）**之後**、以 `quoteArgForShell(prompt, shellFamily)` 加引號；對自訂參數中的 variadic 旗標**沒有另外處理**。依工單「沒有就照它的位置（不另發明規則）」，這裡照同一位置與引號函式：自訂參數之後的最後一個參數。`/control-tower` 符合 `quoteArgForShell` 的免引號字元集，pwsh / cmd / posix 輸出都是原字串。已知限制（與 Worker 派工的 `/ct-exec T####` 相同）：自訂參數以會吃後續值的旗標結尾（例 `--allowedTools a b`）時，claude 會把 `/control-tower` 當該旗標的值；已寫進 docs。

唯一實作：`towerLaunchPrompt({ launchRole, resume, customArgs, shellFamily })`（`src/lib/tower-launch-prompt.ts`，純函式，回傳 `{ arg, reason }`）；`startClaudeCliPty` 只在 `cmdParts.push(customArgs)` 之後、`join` 之前 push，並對塔台分頁記一行 debug log `[T0944] tower tab terminal=<id>: launch prompt added|skipped (<reason>)`。`--name=`、`withBatMcpLaunchArgs`、`--resume=`、`setAutoTitle` 都沒動；BAT 仍不呼叫 `terminal:set-role`。沒有 Settings 開關。

### 修改檔案

- `src/lib/tower-launch-prompt.ts`（新增）：`TOWER_LAUNCH_PROMPT`、`towerLaunchPrompt`
- `src/components/WorkspaceView.tsx`：`startClaudeCliPty` 接線＋ import；`handleAddClaudeCliAsTower` 上方註解改寫（handler 程式碼未變）
- `src/lib/__tests__/tower-launch-prompt.test.ts`（新增）：純函式（帶 / resume / user-args / not-tower、三種 shell）、命令組裝（塔台含 `/control-tower`、一般 Claude CLI 逐字不變、塔台 resume 只有 `--resume`）、三語系提示含 `/control-tower`、`startClaudeCliPty` 接線 source guard（位置在自訂參數之後、整段只有一次 `pty.write`）
- `src/stores/__tests__/workspace-store.launchRole.test.ts`：只改「不輸入任何東西」那一處的測試名稱與註解（加 T0944 說明：`/control-tower` 是啟動參數、handler 仍不打字），斷言本身不變；其他斷言未動
- `src/locales/en.json` / `zh-TW.json` / `zh-CN.json`：`terminal.openClaudeAsTowerHint` 原寫「只負責命名」，改為「啟動時自動帶入 /control-tower；接續中斷的 session 時不帶」
- `CLAUDE.md`「Claude 分頁的 session 名稱」節 T0644 那一點改寫（小節標題未改）
- `docs/agent-guide/claude-session-name.md`「以塔台開啟 Claude」節：帶 / 不帶情況、位置與引號、variadic 限制、沒裝 CT 時 claude 會顯示找不到 skill（預期，要不帶改開一般 Claude CLI）、唯一實作與日誌、驗證清單
- `site/features.md`：AI Agent 整合清單補「以塔台開啟 Claude」一項（下一版起自動進入塔台；為避免 VitePress 把 `<工作區>` 當 HTML 標籤，寫成「工作區名稱 · Tower」）

### 驗證

worktree 先 `npm ci`（exit 0；結尾列出 `electron-winstaller` 的 install-scripts 警告，屬 CLAUDE.md 所述預期）。以下三項都在 `validated_sha` `81afe164` 上、第一次完整執行：

| 關卡 | 結果 |
|---|---|
| `npm run test:unit` | PASS — Test Files 512 passed / 3 skipped（515）；Tests 9260 passed / 47 skipped（9307）；exit 0 |
| `npm run typecheck` | PASS — 0 錯誤，exit 0 |
| `npx vite build` | PASS — exit 0 |

收單前 `git -C "$CT_WORKTREE" status --porcelain` 為空。

### 待實機

（未碰安裝版 BAT、未開 claude 回合）
1. 「+」選單 →「以塔台開啟 Claude」：分頁內的啟動命令最後是 `/control-tower`，claude 啟動後直接進入塔台（不需要再手打）；滑過選單項目的提示文字是新版。
2. 對塔台分頁按 ⏻：新的 claude 同樣以 `/control-tower` 啟動。
3. 關掉 BAT、選「重新開始」（或 Terminal Server 不在）再開：塔台分頁重新啟動並帶 `/control-tower`；選「保留」（PTY 仍在）時不重送任何東西。
4. Terminal Server recovery 中斷後，在「被中斷的 agent 分頁」對塔台分頁按恢復：命令只有 `--resume=<id>`，沒有 `/control-tower`。
5. 一般「Claude CLI」分頁：命令與先前相同、不帶 `/control-tower`。
6. 工作區 claude-cli 自訂參數設 `--continue`：塔台分頁不帶 `/control-tower`。
7. debug log 有 `[T0944] tower tab terminal=… launch prompt added (tower)` / `skipped (resume|user-args)`。

### 遭遇問題

無。

### 偏離

無。i18n 提示文字原本寫「只負責命名」，與新行為矛盾，依工單「選單文字若有說明 / tooltip 需要改才改 i18n」一併更新。

### 後續建議

無。

### 互動紀錄

- [19:16] 開工；CT_MODE=yolo、worktree 隔離；無需向塔台提問。
- [19:18] helper 派工 prompt 位置查證：放在自訂參數之後、`quoteArgForShell`，對 variadic 旗標無特別處理 → 照同一位置實作。
- [19:20] 先提交產品變更（`81afe164`），再於 head 跑驗證，三關全綠。

### Commit

- 產品（worktree `ct/T0944`）：`81afe164031973e3466b8a667b027439bf706c17` feat: tower tab starts claude with /control-tower (T0944)
- 工單（主 checkout）：本檔，`git -C "$CT_HOME" commit --only`
