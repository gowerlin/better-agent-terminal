---
schema_version: 1
schema_kind: workorder
id: T0600
title: "Worker 啟動確認：claude `SessionStart` hook 回報「已啟動」、狀態查詢加欄位、helper 加 opt-in 等待參數（D154）"
type: feature
status: DONE
repo: better-agent-terminal
project: PLAN-047
priority: P2
sizing: M
created_at: "2026-10-18T03:13:30+0800"
started_at: "2026-10-18T03:15:19+08:00"
updated_at: "2026-10-18T03:40:54+08:00"
completed_at: "2026-10-18T03:40:54+08:00"
depends_on: [T0590, T0597, T0598]
related:
  - D154
  - "T0598 回報區第 3 點（方案 A：`SessionStart` hook + `--wait-started`；方案 B 輸出比對只記日誌）"
  - "CLAUDE.md「blocked 狀態偵測」「helper 唯讀查詢 channel」「BAT MCP shim」小節；docs/agent-guide/blocked-state.md、helper-query-channels.md、bat-mcp-shim.md"
  - "並行工單 T0599（BUG-152：renderer 焦點，`src/stores/workspace-store.ts` 等）"
affects_files:
  - electron/terminal-blocked-state.ts
  - electron/bat-mcp-launch.ts
  - electron/terminal-query-handlers.ts
  - "electron/pty-manager.ts（只在狀態需要記在 PtyManager 時）"
  - "electron/terminal-command-handlers.ts（只在派工時需要初始化狀態時）"
  - scripts/bat-hook.mjs
  - scripts/bat-terminal.mjs
  - "scripts/bat-mcp.mjs（tool 說明 / 回傳欄位）"
  - "electron/remote/headless-entry.ts（只在 headless 需要同步時）"
  - "electron/__tests__/、electron/remote/__tests__/、scripts/__tests__/ 下對應的測試檔"
  - "e2e/（新增一支，或擴充 e2e/t0590-blocked-state.spec.ts）"
  - "scripts/verify-helper-bundle.js（只在新增 helper 腳本時）"
  - docs/agent-guide/blocked-state.md
  - docs/agent-guide/helper-query-channels.md
  - "docs/agent-guide/README.md（只在新增主題檔時）"
  - "CLAUDE.md（新增或修改相關小節：只寫契約摘要與唯一實作位置，細節進 docs，依 T0595 撰寫規則）"
  - _ct-workorders/T0600-worker-launch-confirmation.md
renew_count: 0
workdir: main repo
interaction:
  mode_hint: on
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 不 push、不觸發 workflow、不建 tag、不改版號；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF；含反斜線的內容用 Write / Edit 工具（L129）。`src/styles/settings.css` 的 M 不是你的變更。"
  - "🔴 並行：T0599 同時在主 checkout 改 renderer 焦點相關檔（`src/stores/workspace-store.ts`、可能 `src/App.tsx` / `src/components/*`）。你不碰 `src/` 的 renderer 檔；commit 一律 `git commit --only <你的檔>`，`CLAUDE.md` 只納入自己的 hunk。"
  - "🔴 hook 腳本規則沿用 T0590：一律 exit 0、**stdout 不輸出任何東西**（`SessionStart` 的 stdout 會被 claude 加進對話上下文）、任何失敗靜默、時限不得加長、不送 prompt / 內容 / 權杖。`SessionStart` 掛 `async: true`，不得延遲 claude 啟動。"
  - "🔴 相容（D154）：helper 不帶新參數時，輸出與 exit code 完全不變；既有 exit code（0 / 1 / 3 / 4 / 5 / 6 / 7）語意不變。沒有信號的 agent（codex、hooks 未注入、`disableAllHooks`）回「無法判定」，**不得**當成啟動失敗。既有 channel 的既有欄位不改名、不移除。"
  - "🔴 實機查證最多 1 次、`--model claude-haiku-5-5`、提示詞極短，可略過；確認 claude 2.1.300 / 2.1.302 的 `SessionStart` 在互動模式啟動時會執行（以二進位字串或日誌佐證）。"
---

# T0600 — Worker 啟動確認

## 背景（D154）

helper 派工在建立 PTY 後就回 exit 0，啟動指令 500 ms 後才寫入，塔台無從得知 Worker 是否真的啟動（BUG-151 就是 exit 0 但 claude 沒起來）。T0598 建議：claude 的 `SessionStart` hook 經既有的 `terminal:report-hook` 回報「已啟動」，狀態查詢揭露，helper 加 opt-in 等待。

## 要做的事

1. **hook**：`BAT_CLAUDE_HOOKS` 加 `SessionStart`（`async: true`）→ `bat-hook.mjs session-start` → `terminal:report-hook`。注入條件與現有 hooks 相同（只對 claude-cli）。只記「已啟動」與時間，不送 payload 內容（`source` 等欄位若要用，只取列舉值並說明）。
2. **狀態**：`terminal:get-state` / `terminal:list` / `terminal:wait` 的回傳加啟動確認欄位（名稱與值域由你定，例：`agentStarted: true | false | null` + `agentStartedAt`；`null` = 這個分頁無法判定，對應 `blockedDetection: none` 的情況）。PTY 結束 / restart / Terminal Server recovery 的行為比照 `blocked` 的既有規則並寫明。MCP shim 的回傳與 tool 說明同步。
3. **helper**：`bat-terminal.mjs` 派工加 opt-in 參數（例：`--wait-started <ms>`，上限自訂並寫明）。行為：
   - 確認啟動 → exit 0，stdout 多一行可解析的確認（例 `started: <ISO 時間>`）
   - 逾時仍未啟動 → **新的 exit code**（例 `8` / `LAUNCH_UNCONFIRMED`），分頁**不關閉**
   - 無法判定（codex、未注入 hooks…）→ exit 0，stdout 註明 `started: unknown`
   - 舊 BAT（不認得參數或查不到欄位）→ 依既有 helper「BAT 太舊」規則處理，寫明 CT 怎麼判定
   - 等待以既有的 `terminal:wait` 或新 channel 實作皆可；權杖範圍沿用 `authorizeHelperQueryTarget`（塔台查自己的 Worker）。
4. **方案 B（只記日誌）**：可選。寫入指令後短時間內 PTY 輸出比對 `command not found` / `is not recognized as` / `CommandNotFoundException` 時記 `[agent-command] launch-suspect`，不改 exit code、不進 state。範圍或成本過大可略過，回報區說明。
5. **介面契約**：回報區寫一節「介面契約」（參數、欄位、exit code、相容規則、版本判定方式），塔台以此寫 CT 規格轉交（比照 T0562 / T0585 / T0590）。

## 驗收

- `npm run test:unit` 全綠（回報 passed / files 數）；`npm run typecheck` = 0；`npm run typecheck:electron` = 0；`npx vite build` 成功；`npm run verify:helpers` 通過（若改了 helper 打包清單）；新增 / 擴充的 e2e 與 `e2e/t0590-blocked-state.spec.ts`、`e2e/t0598-dispatch-input-before-command.spec.ts` 通過。
- 測試至少涵蓋：hook 回報後狀態為已啟動；不帶參數的 helper 行為不變；`--wait-started` 成功 / 逾時 / 無法判定三種 exit；headless 同步；hook 無 stdout、exit 0。
- 回報區：改動摘要、介面契約、測試、實機驗收步驟、已知限制。
- commit 只含 `affects_files`；訊息 `feat(dispatch): …（T0600）`。

---

## 回報區

### 結果

**DONE** — 五項全做（含選做的方案 B）。產品 commit `75a867b1`（`feat(dispatch): Worker launch confirmation …（T0600）`），只含 `affects_files`（另加一個新主題檔 `docs/agent-guide/worker-launch-confirmation.md`，見「偏差」）。未 push、未建 tag、未改版號。

### 落點檢查

- `PASS`。C-0：frontmatter `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`（`REPO_ROOT` = `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）→ PASS。C-1：工單在 `REPO_ROOT/_ct-workorders/` 下 → PASS。C-3：前 5 個可測項目皆存在 → PASS（資訊性）。C-2：無 `branch` 欄位。`CT_HOME` 未設定（非 worktree）。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）。
- 環境：`CT_MODE=yolo`、`CT_INTERACTIVE=0`；執行中沒有需要向塔台提問的事項。

### 改動摘要

1. **hook**：`BAT_CLAUDE_HOOKS`（`electron/bat-mcp-launch.ts`）加 `SessionStart`（`async: true`、無 matcher，所有 `source`）→ `bat-hook.mjs session-start` → `terminal:report-hook`。`bat-hook.mjs` 只送 `{ event: 'session-start' }`（`hook_event_name` 不是 `SessionStart` 不送），**不送** `source` / `model` / `transcript_path` / `session_id`；一律 exit 0、stdout 無輸出（T0590 規則不變，時限不變）。
2. **狀態**：`TerminalBlockedTracker`（`electron/terminal-blocked-state.ts`）記每個 PTY 第一次 `session-start` 的時間（`report` 回 `started` / 之後 `unchanged`），**不影響 `blocked`**（`isStartReportEvent`；`HOOK_EVENT_REASON` 改為 `BlockedReportEvent` 鍵）。`terminal:get-state` / `terminal:wait` 回傳多 `agentStarted` + `agentStartedAt`、`terminal:list` 每列多 `agentStarted`；`terminal:wait` 多 `until: 'agent-started'`（`electron/terminal-query-handlers.ts` `agentStartedFields`）。PtyManager：`getAgentStartedAt`、`recordExit` 把時間寫進 `ExitedPtyRecord.agentStartedAt`、`clearActivity` 清除、recovery 沿用 `clearAll`。MCP shim（`scripts/bat-mcp.mjs`）：`bat_get_state` / `bat_wait` 說明、`until` enum、摘要文字。
3. **helper**：`bat-terminal.mjs --wait-started <ms>`（`runWaitStarted`），以 `terminal:wait until=agent-started` 分段（≤ 45 s）等待，三種結果見介面契約。
4. **方案 B**：`LaunchSuspectWatcher`（`electron/terminal-blocked-state.ts`），`PtyManager.writeDispatchCommand` 之後 10 s 內輸出命中 `command not found` / `is not recognized as` / `CommandNotFoundException` → `[agent-command] launch-suspect terminal=<id> pattern="<label>" after=<ms>ms`（只記標籤，不記輸出；不改 exit code、不進 state）。
5. **claude 設定關閉 hooks**（為了符合 memory_overrides「`disableAllHooks` 回無法判定、不得當成啟動失敗」）：`claudeHooksDisabledBy` / `defaultClaudeSettingsFiles`（`electron/bat-mcp-launch.ts`）在啟動決策時讀 managed 與使用者設定檔；`disableAllHooks: true`（依優先序第一個設定者）或 managed `allowManagedHooksOnly: true` → 參數照注入、分頁記 `blockedDetection: none`、日誌 `hooks=yes (turned off: …)`。headless host 用 `HostDeps.homeDir`（`electron/remote/headless-entry.ts` 一行）。
6. **文件**：新主題檔 `docs/agent-guide/worker-launch-confirmation.md`（完整契約、CT 判斷、版本判定、生命週期、日誌、實機查證、已知限制、驗證清單）；`docs/agent-guide/README.md` 索引；`blocked-state.md`（事件表 `SessionStart` 列、`disableAllHooks` 限制更新、PtyManager 接點）；`helper-query-channels.md`（list / get-state / wait 欄位）；CLAUDE.md 新增「Worker 啟動確認（T0600，D154）」節（7 條，依 T0595 規則）。

### 介面契約（T0600，CT 依此撰寫規格）

**helper**

```
"${BAT_HELPER_NODE:-node}" "$BAT_HELPER_DIR/bat-terminal.mjs" --notify-id "$BAT_TERMINAL_ID" --workspace "$BAT_WORKSPACE_ID" \
  --skill ct-exec --workorder T#### [--mode yolo] [--isolation worktree] --wait-started <ms>
```

- `<ms>`：非負整數，上限 `120000`（超過以 120000 計，stderr 提示）；`0` = 只查一次。**必須帶 `--notify-id`**（= 呼叫者自己的 `BAT_TERMINAL_ID`），沒帶 → 用法錯誤 exit 1、不建立分頁。只用於建立分頁的模式；與 `--close-worker` / `--set-role` / `--worktree-status` 併用 → exit 1。
- 建立成功後（`✓ Terminal created: <id>` 等既有行照舊），stdout **最後一行**：

  | stdout 最後一行 | exit | stderr |
  |---|---|---|
  | `  started: <ISO 8601 UTC>`（例 `2026-10-18T03:30:00.250Z`） | `0` | — |
  | `  started: unknown` | `0` | `wait-started: NO_SIGNAL \| UNSUPPORTED \| NOT_OWNER \| NOT_FOUND \| TOO_MANY_WAITS \| FORBIDDEN \| ERROR \| TIMEOUT` |
  | `  started: unconfirmed` | **`8`** | `create: LAUNCH_UNCONFIRMED`（`<ms>` 內未確認，或分頁先結束）；**分頁不關閉** |

  解析建議：`/^\s*started: (\S+)\s*$/m`（取最後一個符合者）。
- **CT 判斷**：`0` + 時間 → 已啟動；`0` + `unknown` → 無法判定（codex、自訂 CLI、raw command、hooks 未注入或被 claude 設定關閉、BAT 無法回答），照舊以 Worker 回報判斷，**不是失敗**；`8` → 分頁在但未確認啟動，看分頁輸出（`bat_read_output`）或提醒使用者，**不要重派**；`1` → 既有規則（派工失敗 / 用法錯誤）。分頁已建立後的任何查詢問題一律 `unknown` + exit 0，不回 1（避免重派造成兩個 Worker）。
- **相容**：不帶 `--wait-started` → 輸出與 exit code 完全不變（不等待、沒有 `started:` 行）。既有 exit code `0` / `1` / `3` / `4` / `5` / `6` / `7` 語意不變；`8` 只在帶 `--wait-started` 時出現。
- **版本判定**：T0600 前的 helper 不認得參數 → exit `1`、stderr `Error: Unknown option '--wait-started'`、**不建立分頁** → CT 去掉參數重派（= BAT 太舊）。新 helper 遇到不支援的 BAT（`until` 回 `INVALID_ARGS`、沒有 `terminal:wait`、回傳沒有 `agentStarted`）→ `started: unknown` + `wait-started: UNSUPPORTED`、exit 0。`--help` 含 `--wait-started` = 支援。

**狀態欄位**

- `terminal:get-state` / `terminal:wait` / `terminal:list` 每列：`agentStarted: true | false | null`；get-state / wait 在 `true` 時另回 `agentStartedAt`（ms epoch）。`true` = 該 PTY 的 claude 執行過 `SessionStart`；`false` = `blockedDetection: hook`、尚未收到；`null` = `blockedDetection: none`（無法判定，不得當成失敗）。
- `terminal:wait` `until: 'agent-started'`：`agentStarted !== false` 或 `state: 'exited'` 時成立；逾時 `changed: false`。範圍 `authorizeHelperQueryTarget`（output：自己，或 tower 查自己的 Worker）。舊 BAT → `INVALID_ARGS`（`until`）。
- 生命週期：只記每個 PTY 第一次 `SessionStart`；PTY 結束 / `pty:restart` / Terminal Server recovery 清除（結束紀錄保留 `agentStartedAt`，`exited` 回傳仍有）；使用者輸入不清除。既有欄位不改名、不移除。
- `terminal:report-hook` 多事件 `session-start`，回 `result: 'started' | 'unchanged'`。MCP：`bat_wait` 的 `until` enum 多 `agent-started`；`bat_get_state` / `bat_wait` 摘要附 `, agent started` / `, agent not started yet`。

### 測試

| 閘門 | 結果 |
|---|---|
| `npm run test:unit` | ✅ PASS：**293 files passed / 5118 tests passed / 3 skipped**（最終 commit 前再跑一次，同結果） |
| `npm run typecheck` | ✅ 0 |
| `npm run typecheck:electron` | ✅ 0 |
| `npx vite build` | ✅ 成功 |
| `npm run verify:helpers` | ✅ 通過（未新增 helper 腳本；18 個 `.mjs`、server bundle 6 個不變） |
| e2e `e2e/t0600-launch-confirmation.spec.ts`（新增） | ✅ 1 passed（7.3 s） |
| e2e `e2e/t0590-blocked-state.spec.ts` | ✅ passed（17.0 s；hooks 鍵期望加 `SessionStart`） |
| e2e `e2e/t0598-dispatch-input-before-command.spec.ts` | ✅ passed |

新增 / 擴充的測試涵蓋工單要求：
- hook 回報後已啟動：`terminal-blocked-state.test.ts`（真 RemoteServer + 範圍權杖 + 真 `bat-hook.mjs` 程序：SessionStart → `agentStarted: true`、塔台 `wait until=agent-started` 返回）、headless e2e、Electron e2e（MCP）。
- 不帶參數的 helper 行為不變：`bat-terminal-wait-started.test.ts`（只有一個 invoke、沒有 `started:` 行）、Electron e2e（第二次派工）。
- `--wait-started` 成功 / 逾時 / 無法判定三種 exit：`bat-terminal-wait-started.test.ts`（另有分頁先結束 exit 8、`UNSUPPORTED` ×3、`NOT_OWNER`、`FORBIDDEN`、上限 120000、raw command、建立失敗不等待、用法錯誤不連線、`--help`）；Electron e2e 的 `unknown` 為真實路徑。
- headless 同步：`headless-blocked-state-e2e.test.ts`（真 headless + 真 node-pty，PTY 內 SessionStart → `true`、client wait 返回、codex `null`、restart → `false`、kill 後結束紀錄保留）。
- hook 無 stdout、exit 0：真程序測試、headless e2e、Electron e2e、舊 BAT（`INVALID_ARGS`）仍 exit 0。
- 另：tracker / PtyManager 生命週期、`claudeHooksDisabledBy` 優先序、`defaultClaudeSettingsFiles`、方案 B watcher 與 PtyManager 接點、MCP 摘要。

### 實機查證（1 次，未耗 token）

- 內嵌 claude **2.1.300**（`node_modules/@anthropic-ai/claude-code-win32-x64/claude.exe`）以 `@lydell/node-pty` **互動模式**啟動，`--settings=<暫存檔>`（只含 async `SessionStart` hook，寫 marker 檔）、`--model claude-haiku-5-5`、cwd = 本 repo，**不輸入任何 prompt**：啟動後 **1249 ms** hook 執行，stdin `hook_event_name: SessionStart`、`source: startup`；隨後 kill。
- 系統 claude **2.1.302**（`~/.local/bin/claude.exe`）：二進位含 `hook_event_name:"SessionStart",source:n` 與 `Fixed an async SessionStart hook's unchanged context …`（async SessionStart 受支援）。2.1.300 二進位另有 `source` 列舉 `startup` / `resume` / `clear` / `compact` / `fork`、`--init-only`「Run Setup and SessionStart:startup hooks」。

### 實機驗收步驟（給使用者）

1. 安裝含本 commit 的 BAT，開一個塔台分頁（`--set-role tower`）。
2. 派一張小工單：`node "$BAT_HELPER_DIR/bat-terminal.mjs" --notify-id "$BAT_TERMINAL_ID" --workspace "$BAT_WORKSPACE_ID" --skill ct-exec --workorder T#### --wait-started 30000`（預設 agent = claude-cli）→ 預期 exit 0，最後一行 `  started: <時間>`（約 1–5 s 內）。
3. 把預設 agent 改成 codex 再派 → 預期 exit 0、`  started: unknown`、stderr `wait-started: NO_SIGNAL`，且幾乎立即返回。
4. 模擬啟動失敗：工作區設定把 claude-cli 自訂參數改成會讓 claude 無法啟動的值（或暫時把 Claude Runtime 指向不存在的 system 路徑並關閉 fallback）再派，`--wait-started 15000` → 預期約 15 s 後 exit 8、`  started: unconfirmed`、stderr `create: LAUNCH_UNCONFIRMED`，分頁仍在；debug log 有 `[agent-command] launch-suspect …`（若 shell 印出 command not found）。
5. 塔台 MCP `bat_get_state`（Worker id）→ `agentStarted: true`、`agentStartedAt`；debug log 有 `[agent-start] terminal=<id> → started (hook session-start)`。
6. 不帶 `--wait-started` 再派一次 → 輸出與先前版本相同（沒有 `started:` 行）。

### 已知限制

- 只有 claude-cli 有信號；codex（M1b-2）、自訂 CLI、raw command、Claude Agent SDK 面板一律 `null` / `unknown`。
- 偵測不到的 hooks 關閉：專案層 `<cwd>/.claude/settings[.local].json`（啟動決策時沒有 cwd，`createAgentPromptCommandBuilder` 的 request 不帶 cwd；要補需改 `electron/terminal-command-handlers.ts`）、MDM / registry / server-managed policy。這些情況記為 `hook`、`agentStarted` 永遠 `false`，`--wait-started` 期限到時 exit 8（依契約 CT 不重派，只是多一次提醒）。
- 時間是 BAT 收到回報的時間；`SessionStart` 不代表第一個 prompt 已送出或開始處理。
- BAT 重開、Terminal Server 存活（T0108 replay）：重開前的 `agentStarted` 遺失，存活 claude 回 `false`（不影響派工當下的 `--wait-started`）。headless 重啟同理。
- 以 PTY 為單位、只記第一次：同一 shell 內 claude 結束再啟動不更新。
- 方案 B 只看 helper 派工（`writeDispatchCommand`）之後 10 s；`--prompt` 文字本身若含這些字串會誤記（只影響日誌）。
- Electron e2e 無法在不啟動真 claude 的前提下讓派工分頁成為 `hook`（自訂 CLI 一律 `none`），所以 `started` / `unconfirmed` 的真實路徑由 headless e2e（真 PTY + 真 hook 程序）與 helper 測試（mock RemoteServer）涵蓋，Electron e2e 驗 `unknown` 路徑與 MCP 讀取。

### 偏差 / 決策

- **`disableAllHooks` 偵測**（改動摘要第 5 點）：工單未明列，但 memory_overrides 要求「`disableAllHooks` 回無法判定，不得當成啟動失敗」，BAT 不讀設定就無從區分。做法是讀得到的 managed / 使用者設定檔 → 記 `blockedDetection: none`。這同時改變了 T0590 的已知限制（該情況原為 `hook`），`blocked-state.md` 已同步；`claude-settings.json` 仍不寫 `disableAllHooks`。
- **新增主題檔** `docs/agent-guide/worker-launch-confirmation.md`：新契約（helper 參數 + exit 8）細節多，依 T0595 規則放獨立主題檔，README 索引已加（工單 affects_files 的「README.md（只在新增主題檔時）」即此情況）。
- `pty-manager.ts`：狀態需要跟 PTY 結束紀錄走，以及方案 B 的觀察點，所以有改（接點各一行）。`electron/terminal-command-handlers.ts` 未改。`main.ts` 未改（main 的 BatMcpHost 用預設的 `defaultClaudeSettingsFiles()`）。
- e2e 第二次派工加 `waitMs: 1_200`：同一塔台每秒一次建立（`HELPER_TOWER_CREATE_INTERVAL_MS`），首跑撞到 `create-rate-limited`，非產品問題。

### Commit

- `75a867b1` `feat(dispatch): Worker launch confirmation — claude SessionStart hook, agentStarted in state queries, opt-in --wait-started（T0600）`（`git commit --only`，23 個檔案；`src/styles/settings.css` 的 M 未納入）。
- 工單本身另一個 commit（`chore: T0600 DONE … (ct)`）。

### 互動紀錄

- 無（yolo，未向塔台提問）。
