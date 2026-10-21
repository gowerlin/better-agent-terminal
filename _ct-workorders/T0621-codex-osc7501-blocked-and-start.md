---
schema_version: 1
schema_kind: workorder
id: T0621
title: "PLAN-047 M1b-2：codex 分頁以 OSC 7501 回報 `blocked` 與啟動（`blockedDetection: osc`、`blockedReason: input`、`--wait-started` 對 codex 生效）"
type: feature
status: DONE
started_at: "2026-10-18T11:54:25+0800"
updated_at: "2026-10-18T12:16:00+0800"
completed_at: "2026-10-18T12:16:00+0800"
repo: better-agent-terminal
project: PLAN-047
priority: P2
sizing: L
created_at: "2026-10-18T11:52:48+0800"
depends_on: [T0619, T0620]
related:
  - "T0619 回報區（本單規格來源：OSC 7501 實測、Q1 yolo 行為、Q2 OSC 9 不採用、Q3 啟動信號比較、Q4 契約草案 C-1–C-4 / 實作切分 / 風險；實驗腳本 `run.cjs`（假 Responses API 驅動真 codex TUI）在 T0619 回報區所列 scratchpad）"
  - "D158（本單決策：T0619 建議 6 點全採用）"
  - "T0590 / T0594 / T0597（claude hooks 的 `blocked`、`TerminalBlockedTracker`）、T0600（`agentStarted`、`--wait-started`、`claudeHooksDisabledBy`）、T0607（`tower`、優先序）、T0620（`elicitation-done`，已合入 main `f1b28724`）"
  - "T0592 / D153（`e2e/t0592-codex-tower-worker.spec.ts`：隔離 BAT + 內嵌 codex、隔離 `CODEX_HOME`；codex 升版必跑）"
  - "CT 跟進：本單 DONE 後塔台開 CT-T020 給 BMad-Guide（斷點 D 接受 `osc` / `input`；`started: unknown` 說明更新）"
affects_files:
  - "src/lib/codex-terminal-state.ts（新）"
  - electron/pty-manager.ts
  - electron/terminal-blocked-state.ts
  - electron/terminal-query-handlers.ts
  - electron/terminal-command-handlers.ts
  - electron/bat-mcp-launch.ts
  - "electron/main.ts、electron/remote/headless-entry.ts（只在接線需要時）"
  - "electron/terminal-server/**（只在 replay 補掃需要時）"
  - scripts/bat-terminal.mjs
  - scripts/bat-mcp.mjs
  - "src/lib/__tests__/**、electron/__tests__/**、electron/remote/__tests__/**、scripts/__tests__/**"
  - "e2e/t0621-codex-osc-state.spec.ts（新）"
  - docs/agent-guide/blocked-state.md
  - docs/agent-guide/worker-launch-confirmation.md
  - docs/agent-guide/bat-mcp-shim.md
  - "CLAUDE.md（「blocked 狀態偵測」「Worker 啟動確認」兩節各改必要的句子）"
  - _ct-workorders/T0621-codex-osc7501-blocked-and-start.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 非隔離工單，在主 checkout 工作（目前沒有其他工單並行）。`src/styles/settings.css` 的 M 不是你的變更，不碰。commit 用 `git commit --only <檔案>` 或精確 stage。不 push、不觸發 workflow、不建 tag、不改版號；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF；含反斜線的內容用 Write / Edit 工具（L129）。"
  - "🔴 偵測**只讀、不改寫 PTY 輸出**：OSC 7501 照原樣送到 renderer（xterm 自己會丟掉）。不得注入 codex hooks、不得注入 `-c notify`（會取代使用者的 notify，T0619 實測）、不得注入 `-c tui.*`。"
  - "🔴 子程序（`codex --version`）一律 `execFile` + array args + timeout（CLAUDE.md「Child Process Spawning」）；解析到的 codex 路徑不經 shell。"
  - "🔴 契約（下方「介面契約」）是 CT-T020 的依據，不得單方更改；實作中發現必須改，依 ct-exec § Questions For Tower 問塔台。"
  - "🔴 e2e 與實驗**不呼叫真模型**：用本機假 Responses API（`-c model_provider=…` / `model_providers.*`）驅動真 codex TUI、隔離 `CODEX_HOME`；不得讀寫使用者的 `~/.codex/`、`%APPDATA%\\BetterAgentTerminal\\settings.json`。"
---

# T0621 — codex 分頁以 OSC 7501 回報 `blocked` 與啟動

## 背景

T0619 實測：codex `>= 0.163.0` 在 PTY 送 `ESC ] 7501 ; state=<idle|working|blocked>[:app=codex] ESC \`（也可能以 BEL 結尾），
結束時 `state=clear`；不需任何設定、與焦點無關。TUI 就緒後約 0.5 s 送第一個 `state=`；卡在啟動前畫面（Trust this folder? / Hooks need review）時完全不送。
核准提示、Plan mode 提問 → `blocked`；核准 / 拒絕 / Esc → `working` 或 `idle`。0.162.1 以前沒有這個序列。
主行程所有 PTY 輸出都經 `PtyManager.enqueuePtyOutput`（本機 direct / child_process 後援 / Terminal Server 共用），可在該處只讀偵測。

完整證據與擷取片段見 T0619 回報區；實作前先讀完。

## 介面契約（本單定稿；CT-T020 依此撰寫，不得單方更改）

**C-1 `blockedDetection` 新增值 `osc`**

- 值域：`hook` / `osc` / `none`。`osc` = 這個 PTY 曾出現 OSC 7501（觀察式：BAT 派工、BAT 手動開的 codex 分頁、在 shell 裡自己打 `codex` 都涵蓋）。
- 派工的 codex Worker：版本確認 `>= 0.163.0`（C-5）時，啟動即記為 `osc`（這樣 `agentStarted` 在第一個 7501 之前能回 `false`）；確認不到 → 維持 `none`，直到真的觀察到 7501 才改 `osc`。
- 一旦是 `hook`（claude hooks 回報過），不因輸出裡出現 7501 而改成 `osc`。
- `none` 的語意不變：永遠不會回 hook / osc 的 reason（`tower` 不在此限，T0607）。

**C-2 `blockedReason` 新增值 `input`**

- `blockedDetection: osc` 的分頁：`state=blocked` → `state: blocked`、`blockedReason: input`、`blockedSince`（ms）、`source: 'osc'`。
- 清除：`state=working` / `state=idle` / `state=clear`、PTY 結束（exit / kill / `pty:restart`）、Terminal Server recovery。**使用者輸入不清除**（codex 自己會送轉換；與 hook reason 不同）。
- 優先序：`exited` > hook reason / `input` > `tower` > `working` / `idle`（`input` 與 hook reason 不會同時存在於同一分頁）。
- `terminal:wait` `until: 'state-change'` 在進入 / 離開 `input` 時成立。

**C-3 `agentStarted`（codex）**

- `blockedDetection: osc` 的分頁：第一個 OSC 7501（任何 `state=` 值）→ `agentStarted: true` + `agentStartedAt`（BAT 收到的時間，ms）；之前 → `false`。只記每個 PTY 第一次；生命週期比照 T0600（PTY 結束 / restart / recovery 清除，結束紀錄保留 `agentStartedAt`）。
- `blockedDetection: none` → `agentStarted: null`（不變）。
- `terminal:wait` `until: 'agent-started'`、helper `--wait-started <ms>` 對 codex 生效：`started: <ISO>` exit 0 / `started: unconfirmed` exit 8（卡在啟動畫面或 codex 起不來）/ `started: unknown` exit 0（版本確認不到）。helper 的輸出格式與 exit code 語意**不變**（T0600 契約）。

**C-4 狀態值**

- 不新增 `state` 值。`state=clear`（codex 結束、shell 還在）視同清除，之後依輸出照常 `working` / `idle`。
- 只認 `state=` 的值；`app=` 不是 codex 時忽略該序列。未知的 `state=` 值忽略（寬鬆解析）。

**C-5 版本判定**（D158）

- 派工 codex Worker 時，對解析到的 `codex` 執行一次 `codex --version`（`execFile`、timeout 5 s），解析 `codex-cli X.Y.Z`；結果以「解析到的路徑 + 檔案 mtime」快取。
- `>= 0.163.0` → C-1 啟動即 `osc`；更舊、失敗、逾時、解析不了 → `none`（`--wait-started` 回 `unknown`，絕不回 `unconfirmed`）。
- 只為了派工（`createWithCommand` / 派工路徑）；使用者手動開的分頁不跑版本檢查（觀察式即可）。遠端 headless 同樣適用（在遠端執行）。

**C-6 派工的 codex Worker 加 `-c check_for_update_on_startup=false`**（D158）

- 只加在 helper 派工的 codex 命令（與 BAT MCP 的 `-c` 同一組裝點）；使用者手動開的分頁不加。使用者自訂參數已含 `check_for_update_on_startup` 時不加。

**C-7 BAT 重開的 replay**

- BAT 重開、Terminal Server 存活時，`handleReplayBuffer` 的重播內容不經 `enqueuePtyOutput`：掃描重播內容中**最後一個** OSC 7501，據此恢復 `blockedDetection: osc` 與目前的 `blocked` / `input`；`agentStarted` 以「有 7501 → true（時間 = 掃描時間）」恢復。掃不到 → 照現況。

**C-8 日誌**

- `[codex-state] terminal=<id> → <state>`（只記轉換，不記重複的同一狀態）；`[blocked] … → blocked reason=input (osc)` / `→ cleared (osc <state>)`；版本判定 `[codex-version] path=<…> version=<x.y.z|unknown> (cached|probed)`。不記輸出內容。

## 要做的事

1. 解析器 `src/lib/codex-terminal-state.ts`（main / headless 共用、不 import electron / DOM，比照 `src/lib/usage-limit.ts`）：從輸出 chunk 抽出 OSC 7501，處理 chunk 邊界（序列被切開）、`ESC \` 與 BEL 兩種結尾、大量輸出時的效能（不做整段正規表示式回溯；保留的未完成尾巴有上限）。
2. 接線：`PtyManager.enqueuePtyOutput` 只讀 tap → `TerminalBlockedTracker`（或新的 codex 狀態追蹤，型別與 tracker 擴充見 C-1–C-4）；本機與 headless 對等；replay 補掃（C-7）。
3. 狀態查詢：`terminal:get-state` / `list` / `wait`（`electron/terminal-query-handlers.ts` `stateOf` / `agentStartedFields`）、MCP `bat_get_state` / `bat_wait` / `bat_list_terminals`（`scripts/bat-mcp.mjs` 的說明與列舉加 `osc` / `input`）。
4. 派工：版本判定（C-5）、`-c check_for_update_on_startup=false`（C-6）、`--wait-started` 對 codex 生效（`scripts/bat-terminal.mjs` 的說明文字；`runWaitStarted` 邏輯原則上不必改）。
5. 測試：
   - unit：解析器（完整 / 切開 / BEL / ST / 非 codex 的 7501 / 未知值 / 夾在大量輸出中）、tracker 轉換表（進入、清除、使用者輸入不清除、優先序、`hook` 不被覆寫、PTY 結束 / restart / recovery）、`agentStarted`（`osc` 的 `false → true`、只記第一次）、版本判定（各種 `--version` 輸出、逾時、快取）、`-c check_for_update_on_startup=false` 只在派工、自訂參數已有時不加、replay 補掃。
   - 既有 source guard / 清單測試（`bat-mcp-launch.test.ts` 的 `buildLaunchCommand(` 計數等）照常通過。
   - e2e `e2e/t0621-codex-osc-state.spec.ts`（隔離 BAT 實例，需先 `npx vite build`；沿用 T0592 架構，但啟動**真 codex TUI** 並以本機假 Responses API 驅動，比照 T0619 `run.cjs`）：
     1. 塔台 helper 派 codex Worker 帶 `--wait-started` → `started: <ISO>` exit 0；`bat_get_state` = `blockedDetection: osc`、`agentStarted: true`。
     2. 假 API 回需要核准的工具呼叫（Worker 以非 yolo 核准模式啟動，或用手動 codex 分頁）→ `blocked` / `input` / `source: osc`；送 `y` → 清除。
     3. 未信任的 git repo 當 cwd → `--wait-started` exit 8 `started: unconfirmed`（分頁不關閉）。
     4. 日誌不含輸出內容與權杖。
     若真 codex 無法在 CI 環境跑（沒有安裝 codex），e2e 以 skip 標示原因（比照既有需要外部 CLI 的 spec），不得假造通過。
6. 文件：`docs/agent-guide/blocked-state.md`（codex 一節：信號、轉換表、清除規則、已知限制 —— OSC 7501 未公開、只限 `>= 0.163.0`、不分 reason、啟動前畫面不送、遠端未測）、`worker-launch-confirmation.md`（codex 來源與版本判定）、`bat-mcp-shim.md`（tool 說明）；CLAUDE.md 兩節各改必要的句子（「codex 未支援 / 一律 null」改為新規則，連到 docs）。

## 不在本單

- codex hooks（信任雜湊備案）、OSC 9、細分 reason（`permission` / `question`）。
- 縮圖 UI 標示（`input` 要不要顯示 ⚠️ —— 回報中提建議即可）。
- CT 端修改（CT-T020）。

## 驗收

- `npm run test:unit` 全綠（回報 passed / files）
- `npm run typecheck` = 0、`npm run typecheck:electron` = 0
- `npx vite build` 成功
- e2e `t0621-codex-osc-state.spec.ts` 通過（附耗時；skip 要寫原因）；回歸 `e2e/t0592-codex-tower-worker.spec.ts`、`e2e/t0590-blocked-state.spec.ts` 通過
- 回報區：與契約的差異（若有）、`get-state` 的 `osc` / `input` JSON 範例、`--wait-started` 三種結果的實際輸出、版本判定日誌、縮圖 UI 建議、commit hash

---

## 回報區

### 結論摘要（給塔台）

- **DONE**。codex `>= 0.163.0` 分頁以 OSC 7501 回報 `blocked` / `input` / `source: osc` 與 `agentStarted`；`--wait-started` 對 codex 生效（實測 `started: <ISO>` exit 0 / `started: unconfirmed` exit 8）；派工版本判定（C-5）與 `-c check_for_update_on_startup=false`（C-6）、BAT 重開 replay 補掃（C-7）、日誌（C-8）完成。介面契約 C-1–C-8 **未更改**（實作上的解讀見「與契約的差異」）。
- 驗收全過：unit 303 files / 5294 passed（3 skipped，與改前相同）；`npm run typecheck` = 0、`npm run typecheck:electron` = 0；`npx vite build` 成功；e2e `t0621-codex-osc-state.spec.ts` 通過（23.8 s，真 codex 0.163.0 TUI、0 次模型呼叫）；回歸 `t0592` ×2 通過、`t0590` 通過（修一行 T0620 遺留的過期斷言，見差異 4）、另跑 `t0600` 通過。
- 產品 commit：`15559f8b`（未 push）。
- CT-T020 可依契約開工：斷點 D 接受 `blockedDetection: osc` / `blockedReason: input`；`started: unknown` 的說明改為「codex 低於 0.163.0 或版本確認不到」。

### 實作摘要

| 項目 | 位置 |
|---|---|
| 解析器（`scanCodexStates` / `lastCodexState` / `CodexStateScanner` / `codexVersionWritesOsc`；每個序列一次 `indexOf`、無正規表示式、ST 與 BEL、chunk 切開含前綴本身、未完成尾巴上限 128 字元 + 前綴、沒有 7501 的 PTY 不保留任何東西） | `src/lib/codex-terminal-state.ts`（新，不 import electron / DOM） |
| 狀態機：`BlockedDetection` 加 `osc`、`BlockedReason` 加 `input`、`observeCodexState`（轉換表）、`clearForUserInput`（不清 `input`）、`BlockedState.event` 改 optional + `source?: 'osc'` | `electron/terminal-blocked-state.ts` |
| 只讀 tap（`enqueuePtyOutput`）、replay 補掃（`handleReplayBuffer`）、PTY 結束 / recovery / dispose 清除、`noteUserInput` 改用 `clearForUserInput` | `electron/pty-manager.ts` |
| 查詢：`source` 加 `osc`、`agentStartedFields` 對 `osc` 回 `false` | `electron/terminal-query-handlers.ts` |
| 版本判定 C-5（`createCodexOscVersionCheck` / `resolveDispatchCodexBinary`；`execFile` array args、timeout 5 s、路徑 + mtime 快取） | `electron/codex-osc-version.ts`（新） |
| 派工：`codexWritesOsc` / `recordBlockedDetection` deps（MCP 決策記 `none` **之後**記 `osc`）、C-6 `-c check_for_update_on_startup=false`（MCP `-c` 之後、自訂參數之前） | `electron/terminal-command-handlers.ts`；接線 `electron/main.ts`、`electron/remote/headless-entry.ts` |
| attention push 不送 `input`（UI 不變） | `electron/terminal-attention.ts` |
| helper / MCP 說明文字 | `scripts/bat-terminal.mjs`（`--help`、檔頭、`NO_SIGNAL` 訊息）、`scripts/bat-mcp.mjs`（`bat_get_state` 說明） |
| 文件 | `docs/agent-guide/blocked-state.md`（codex 節：信號、契約、轉換表、清除、偵測點、replay、日誌、已知限制）、`worker-launch-confirmation.md`（codex 節：信號、版本判定、C-6）、`bat-mcp-shim.md`、`CLAUDE.md` 兩節 |
| 測試 | 新 `src/lib/__tests__/codex-terminal-state.test.ts`（31）、`electron/__tests__/codex-osc-state.test.ts`（26）、`e2e/t0621-codex-osc-state.spec.ts`；更新 4 個派工命令測試期望值（C-6） |

### 與契約的差異 / 實作中的決定

1. **契約本身未改**。以下是解讀與範圍外的必要改動。
2. C-5 快取：只快取「成功解析出的版本」（以路徑 + mtime 為鍵）；失敗 / 逾時 / 解析不了不快取，下次派工再試（避免一次冷啟動逾時就永久判為 unknown）。執行檔解析：啟動指令第一個字 `codex` → 主行程 PATH 上第一個含 codex 的目錄；Windows 上該目錄必須有 `codex.exe`，若第一個是 npm shim（`codex.cmd` / `.ps1` / `.bat`）→ 不經 shell 無法執行 → `none`（`unknown`）。絕對路徑的自訂 CLI 照原樣探測（Windows 須 `.exe`）。已知限制：分頁 shell 的 profile 改了 PATH、跑到另一個 codex 時判定可能不符（已寫進 docs）。
3. **新檔 `electron/codex-osc-version.ts`、改 `electron/terminal-attention.ts`**（不在 affects_files）：前者是 C-5 的唯一實作（比照 `codex-runtime-resolver.ts` 的 `execFile` 寫法，可注入 execFile 測試）；後者讓 `terminal:attention-changed` **略過 `input`**，維持縮圖 UI 不變（本單不做 UI，見下方建議）。
4. **`e2e/t0590-blocked-state.spec.ts` 一行**：回歸時失敗，原因是 T0620（`f1b28724`）在 `BAT_CLAUDE_HOOKS` 加了 `ElicitationResult`，但此 e2e 的 hook key 順序斷言沒更新（T0620 回報「e2e 未改，不適用」，未跑）。與本單無關的既有失敗；改為含 `ElicitationResult` 後通過。
5. C-6 改變了所有派工 codex 命令，4 個既有測試的期望字串跟著更新（`agent-prompt-command`（含 T0431 legacy 對照，加註 T0621）、`dispatch-shell-family`、`bat-mcp-launch`、`workspace-agent-launch-dispatch`）。`bat-mcp-launch.test.ts` 的 `buildLaunchCommand(` source guard 計數不受影響（沒有新增啟動路徑）。
6. C-8 之外多兩種日誌行（不含輸出內容）：`[agent-start] terminal=<id> → started (osc <state>)`（比照 T0600 的 `(hook session-start)`）、`[PtyManager] replay: PTY <id> last codex state=<state>`；路徑判定不到時 `[codex-version] path=- version=unknown (<原因>)`。
7. C-7：replay 恢復 `input` 時 `blockedSince` = 掃描時間（與 `agentStartedAt` 同）。
8. 對 `hook` 分頁：7501 整段忽略（detection、blocked、agentStarted 都不動），落實「`input` 與 hook reason 不會同時存在」。

### 實測輸出（e2e `t0621-codex-osc-state.spec.ts`，codex-cli 0.163.0 `<使用者資料夾>\AppData\Local\Programs\OpenAI\Codex\bin\codex.exe`）

**`--wait-started` 三種結果**

- started（信任資料夾，`--wait-started 60000`，1380 ms，exit 0）：

  ```
  ✓ Terminal created: d58b3d4712be1bfe946fcf328a5459f7
    workspace: T0621 (e2e-t0621-ws) — the Tower terminal's workspace (--notify-id)
    agent: codex-cli (--agent codex: from --agent)
    started: 2026-10-18T04:09:40.318Z
  ```

- unconfirmed（未信任 git repo「Trust this folder?」，`--wait-started 15000`，15081 ms，**exit 8**，分頁保留、之後 `agentStarted: false`）：

  ```
  ✓ Terminal created: 96c0334cf9261d5808553f5e70f24838
    ...
    started: unconfirmed
  stderr: [bat-terminal] --wait-started: the agent of 96c0334cf9261d5808553f5e70f24838 has not confirmed its start within 15000 ms; the terminal is kept.
          create: LAUNCH_UNCONFIRMED
  ```

- unknown（版本確認不到 → `none`）：helper 輸出與 T0600 相同、未改：`  started: unknown` exit 0 + stderr `wait-started: NO_SIGNAL`（訊息改為 `… no start signal for this tab (codex older than 0.163.0 or version unknown, raw command, hooks not injected or turned off)`）；本次 `e2e/t0600` 通過（同一路徑）。codex 端的 `none` 判定由 unit 驗證（舊版 / 失敗 / 逾時 / npm shim 都不記 `osc`）；`t0592` 的假 `codex.cmd` 在 PATH 第一個 → 判定不到 → `blockedDetection: none`（其既有斷言照常通過）。

**`bat_get_state` JSON**

- 核准提示中（`blocked` / `input` / `osc`）：

  ```json
  {"terminalId":"d58b3d4712be1bfe946fcf328a5459f7","state":"blocked","lastOutputAt":1792296580409,"idleMs":980,"blockedReason":"input","blockedSince":1792296580380,"source":"osc","blockedDetection":"osc","pendingQuestions":0,"agentStarted":true,"agentStartedAt":1792296580318}
  ```

  MCP 摘要：`d58b3d4712be1bfe946fcf328a5459f7: blocked (input), idle 980 ms, agent started`

- 送 `y` 核准後（清除）：

  ```json
  {"terminalId":"d58b3d4712be1bfe946fcf328a5459f7","state":"working","lastOutputAt":1792296581852,"idleMs":26,"source":"output","blockedDetection":"osc","pendingQuestions":0,"agentStarted":true,"agentStartedAt":1792296580318}
  ```

- 卡在信任畫面（派工時版本判定 → `osc`，沒有任何 7501）：

  ```json
  {"terminalId":"96c0334cf9261d5808553f5e70f24838","state":"idle","lastOutputAt":1792296582958,"idleMs":15311,"source":"output","blockedDetection":"osc","pendingQuestions":0,"agentStarted":false}
  ```

**版本判定日誌**（debug log）

```
[codex-version] path=<使用者資料夾>\AppData\Local\Programs\OpenAI\Codex\bin\codex.exe version=0.163.0 (probed)
[codex-version] path=<使用者資料夾>\AppData\Local\Programs\OpenAI\Codex\bin\codex.exe version=0.163.0 (cached)
```

其他 e2e 斷言：`[codex-state] terminal=<worker> → idle`、`[agent-start] … → started (osc …)`、`[blocked] … → blocked reason=input (osc)` / `→ cleared (osc working|idle)`；分頁 raw buffer 仍含 `ESC ]7501;state=`（只讀）；分頁輸入行含 `check_for_update_on_startup=false`（C-6）；debug log / `bat-scripts.log` 不含工具命令印在畫面上的標記字串、不含 `batcap.` 權杖；假 Responses API 只收到 2 個 `POST /v1/responses`（不呼叫真模型）。e2e 用隔離 `CODEX_HOME`（temp，`config.toml` 指向假 API、信任 `trusted` 資料夾），未讀寫使用者的 `~/.codex/`、`%APPDATA%\BetterAgentTerminal\settings.json`。找不到 codex `>= 0.163.0`（`BAT_E2E_CODEX`、官方安裝位置、PATH、內嵌）或非 Windows → `test.skip` 並寫明原因（內嵌 codex 目前是 0.160.0，沒有 7501）。

### 驗證證據

| 關卡 | 結果 |
|---|---|
| `npm run test:unit` | PASS — 303 files、5294 passed、3 skipped（改前 301 files / 5237 passed / 3 skipped） |
| `npm run typecheck` | PASS — 0 |
| `npm run typecheck:electron` | PASS — 0 |
| `npx vite build` | PASS |
| e2e `t0621-codex-osc-state.spec.ts` | PASS — 23.8 s（spec 本體 23 s） |
| e2e `t0592-codex-tower-worker.spec.ts` | PASS — 2 tests |
| e2e `t0590-blocked-state.spec.ts` | PASS — 17.5 s（修正差異 4 之後；修正前因 T0620 遺留斷言 FAIL） |
| e2e `t0600-launch-confirmation.spec.ts`（額外回歸） | PASS — 7.8 s |
| eslint | 不適用（repo 沒有 `eslint.config.*`） |

### 縮圖 UI 建議（不在本單）

- 建議 `input` 也顯示 ⚠️（與 hook reason 同義：在等使用者）：在 `src/lib/terminal-attention.ts` 的 `ATTENTION_HOOK_REASONS` / `AttentionBlockedReason` 加 `input`，並移除 `computeTerminalAttention` 的略過（`electron/terminal-attention.ts`，加註 T0621）；批次關閉同樣不計入。yolo codex Worker 回合中幾乎不會進 `input`（T0619），主要受益的是手動 / 非 yolo 的 codex 分頁。
- tooltip 可寫「codex 等待輸入（核准或提問）」，因 OSC 7501 不分 reason。

### 已知限制 / 後續

- OSC 7501 未公開：codex 升版時必跑 `e2e/t0621-codex-osc-state.spec.ts`（已寫進 CLAUDE.md / docs）。只限 `>= 0.163.0`；`input` 不分核准 / 提問 / elicitation；遠端 Linux / macOS codex 未實測（headless 走同一個 PtyManager tap 與版本判定，程式路徑對等）。
- 版本判定以主行程 PATH 推定分頁會執行的 codex；Windows 上 PATH 第一個是 npm shim 時一律 `unknown`。
- 內嵌 codex（`node_modules/@openai/codex`）仍是 0.160.0，不送 7501（BAT 的 codex 分頁執行的是 PATH 上的 codex，不受影響）。

### Landing / 執行紀錄

- Landing check：**PASS**。C-0 `repo` = `better-agent-terminal`、`basename(REPO_ROOT)` = `better-agent-terminal`（REPO_ROOT = `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）；C-1 工單在 REPO_ROOT 下；C-3 前 5 筆可測項目皆 present（新檔以最近存在的祖先目錄判定）；C-2 無 `branch` 欄位。`CT_HOME` 未設定（非 worktree）。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）。
- `CT_MODE=yolo`、`CT_INTERACTIVE=0`；沒有需要問塔台的問題。
- `src/styles/settings.css` 的 M 不是本單變更，未動、未 stage。未 push、未觸發 workflow、未建 tag、未改版號；未使用 `git stash` / `reset` / `checkout --` / `restore`。
- Commit：產品 `15559f8b`（`git commit --only`，23 個檔案）；本工單檔另一個 commit。

### 互動紀錄

（無）
