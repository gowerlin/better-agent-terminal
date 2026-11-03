---
schema_version: 1
schema_kind: workorder
id: T0808
title: "BUG-208：呼叫 helper 的測試一律把 `BAT_USER_DATA` / `BAT_HELPER_LOG_DIR` 指到暫存目錄，不再寫進真實的 `bat-scripts.log`"
type: implementation
status: DONE
repo: better-agent-terminal
project: maintenance
priority: P3
sizing: S
created_at: "2026-11-03T17:59:11+0800"
started_at: "2026-11-03T18:00:57+0800"
updated_at: "2026-11-03T18:11:55+0800"
completed_at: "2026-11-03T18:11:55+0800"
session_ids:
  - "e309de02-c321-4946-83aa-5ccdb56a22f7"
depends_on: []
related:
  - "BUG-208；D253；T0806 回報區〈環境還原〉〈後續〉第 4 點；CLAUDE.md「遠端 Tower 通知（PLAN-036 K）」（helper 測試須設 `BAT_HELPER_LOG_DIR` / `BAT_USER_DATA` 到 temp）、「Frontend unit tests」節"
affects_files:
  - "scripts/__tests__/**（呼叫 helper 的測試）"
  - "tests/bat-*.test.mjs（vitest 收的 5 個，若有同樣問題）"
  - "scripts/__tests__/helpers/** 或既有共用測試 helper（若新增共用 env 函式）"
  - "electron/__tests__/bat-terminal-wait-started.test.ts（Q-1 塔台答 A：只改 `--help` 那一處）"
  - _ct-workorders/T0808-helper-tests-temp-log-dir.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 只改測試，不改 helper 腳本與產品程式。`electron/__tests__/**` 若也有同樣問題：先列出、問塔台（T0807 在 worktree 並行，可能動到 `electron/__tests__/` 的其他檔），塔台同意才改。"
  - "🔴 找法要有證據：以暫存的 `BAT_USER_DATA` 外的真實 log 位置（Windows `%APPDATA%\\BetterAgentTerminal\\Logs\\bat-scripts.log`、Linux `~/.config/BetterAgentTerminal/Logs/bat-scripts.log`）為準，**只讀**記錄跑測試前後的行數，不得修改或清除這兩個檔（本機 BAT 與其他分頁正在寫）。修正後再跑一次，確認測試期間真實 log 沒有新增本測試的紀錄（以 argv 與時間判斷；其他分頁的 helper 正常寫入不算）。"
  - "🔴 可加 source guard（例如掃 `scripts/__tests__` / `tests` 中 spawn helper 的測試都有設定暫存 env），放 vitest 收得到的位置（🔴 不放進 `tests/`，D177）。"
  - "🔴 驗證：`npm run test:unit`、`npm run test:legacy` 綠；不需要 typecheck（不改 src / electron，若有改則跑對應 typecheck）。"
  - "🔴 yolo：不得問使用者；問題依 ct-exec § Questions For Tower 問塔台。不發版、不 push。Git：只 commit 本單範圍（`git commit --only` 或明列路徑）。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
---

# T0808 — helper 測試改用暫存 log 目錄（BUG-208）

## 元資料

- **工單編號**：T0808
- **類型**：implementation（測試衛生）
- **互動模式**：yolo（問題問塔台）
- **優先級**：P3
- **建立時間**：2026-11-03T17:59:11+0800
- **預估規模**：S

## 背景

T0806 發現 `scripts/__tests__/server-bundle-helpers.test.mjs` 等測試對 `bat-terminal.mjs` / `bat-notify.mjs` 執行 `--version` / `--help` 時，env 只去掉 `BAT_*`、`HOME` 是真的，helper 退回舊推測位置，寫進使用者真實的 `bat-scripts.log`（Windows 與 Linux 各實測 10 行）。違反 CLAUDE.md 規則。與 T0807 同批修完再發版（D253）。

## 範圍

1. 找出所有呼叫 helper 但沒設暫存 `BAT_USER_DATA` / `BAT_HELPER_LOG_DIR` 的測試並補上（可抽共用函式）。
2. 視情況加 source guard。
3. 以真實 log 行數前後比對證明修好。

## 不做

- 不改 helper 與產品程式；不清使用者真實 log；不 push、不發版。

## 驗收

- [x] 受影響測試清單與修法
- [x] 修正前後真實 log 行數比對（只讀）
- [x] source guard（若加）
- [x] `npm run test:unit`、`npm run test:legacy` 綠

---

## 回報區

### 待塔台決策

#### Q-1：`electron/__tests__/bat-terminal-wait-started.test.ts` 也有同樣問題（`--help` 用 `run(['--help'], {})`，沒給暫存 log 目錄），要不要在本單一併修？
- 提問時間：2026-11-03T18:04:21+0800
- 選項：[A] 同意，本單一併修（只改該檔第 338 行：`--help` 也帶暫存 `BAT_HELPER_LOG_DIR` / `BAT_USER_DATA`，一行測試改動）/ [B] 不改，列為後續（另開單）/ [C] 其他：________
- Worker 建議：[A]。證據：把 `APPDATA` / `BAT_USER_DATA` 指到偵測目錄跑完整 `npm run test:unit`，偵測目錄收到 5 筆 helper 紀錄，其中 1 筆（`bat-terminal --help`，env 為空）來自這支測試；其餘 4 筆在 `scripts/__tests__`（本單範圍內）。`test:legacy` 0 筆。`electron/__tests__` 其他呼叫 helper 的測試都已帶 `BAT_HELPER_LOG_DIR`。改動只有一行、只動測試，與 T0807 的衝突風險低（T0807 若沒動這支檔就無衝突）。
- 影響範圍：`electron/__tests__/bat-terminal-wait-started.test.ts`（目前不在 `affects_files`）；本單 source guard 的掃描範圍是否含 `electron/__tests__`
- 阻塞：否（先修 `scripts/__tests__` 三處；收尾前等答覆）

### 完成狀態

- **狀態**：DONE
- **完成時間**：2026-11-03T18:11:55+0800
- **session_id**：e309de02-c321-4946-83aa-5ccdb56a22f7
- **產品 commit**：`e585c762a581a0e9ec0ba8d0b2779ab082fa7b7d`（`test: helper tests log to a temp dir, not the real bat-scripts.log (T0808, BUG-208)`）
- **驗證時的 HEAD**：驗證在 commit 前的工作樹上跑（內容即 `e585c762` 的內容；期間 main 被其他 session 前進到 `05f3a263`，與本單檔案無交集）

### 落點檢查

- **結果**：PASS
- C-0：frontmatter `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal` → PASS
- C-1：工單在 REPO_ROOT 下 → PASS；C-3：`scripts/__tests__`、`tests`、`electron/__tests__` 皆存在 → PASS；C-2：工單無 `branch` 欄位（在 `main`）
- `CT_HOME` 未設定（非 worktree）；`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）

### 找法與證據（修正前）

不靠猜，用「偵測目錄」實測：把 `APPDATA` / `BAT_USER_DATA` / `XDG_CONFIG_HOME` 指到 scratchpad 的空目錄再跑完整測試。修好的測試會把 log 寫到自己的暫存目錄，**只有**漏設的測試會落進偵測目錄；也不受其他分頁同時寫真實 log 的干擾。

- `npm run test:unit`（修正前）：偵測目錄 `…/BetterAgentTerminal/Logs/bat-scripts.log` 收到 **5 筆**：

  | # | 紀錄 | 來源測試 | 原因 |
  |---|---|---|---|
  | 1 | `bat-notify invoke argv=["--help"] env={}` | `scripts/__tests__/bat-notify-questions.test.mjs`（`--help documents the modes…`） | `run(['--help'], {})` → 共用 `runHelper()` 去掉 `BAT_*` 後沒補 log 目錄 |
  | 2 | `bat-terminal invoke argv=["--help"] env={}` | `scripts/__tests__/bat-terminal-answer.test.mjs`（`--help documents --answer…`） | 同上（`runHelper()`） |
  | 3、4 | `bat-terminal` / `bat-notify invoke argv=["--version"]`（env 帶 `CT_*`） | `scripts/__tests__/server-bundle-helpers.test.mjs`（`the listed set runs on its own…`） | `runNode()` 的預設 env = `cleanEnv()`（只去 `BAT_*`）；`bat-mcp --version` 不記 log、負向對照在 import 階段就失敗 |
  | 5 | `bat-terminal invoke argv=["--help"] env={}` | `electron/__tests__/bat-terminal-wait-started.test.ts`（`--help documents it…`） | 自己的 `run(['--help'], {})`（Q-1） |

- `npm run test:legacy`（修正前）：偵測目錄 **0 筆**（33 檔全綠）。
- 同時段真實 log（只讀）：`test:unit` 期間 22877 → 22883（+6），逐行檢查都是本分頁自己的 `bat-hook` / `remote-server report-hook`（terminal `864ae04e`），沒有 argv、不是測試寫的。
- T0806 量到 10 行、本機修正前 5 筆：推測 T0806 跑了兩次（或含個別檔重跑），本單以偵測目錄的 5 筆 / 4 處為準。
- 其他呼叫 helper 的測試：`tests/bat-*.test.mjs` 5 支、`bat-mcp.test.mjs`、`electron/__tests__` 其餘 helper 測試都已自帶 `BAT_HELPER_LOG_DIR`；`electron/remote/__tests__/headless-{blocked-state,close-worker,set-role}-e2e` 的 helper 跑在 headless server 的 PTY 裡，env 帶 server 的 `BAT_HELPER_LOG_DIR`（測試的暫存 dataDir）—— 偵測目錄 0 筆佐證。

### 修法

- 新增 `scripts/__tests__/_helper-test-env.mjs`（非測試檔）：`helperLogEnv()` 回傳指向同一個 per-process 暫存目錄（`mkdtemp`）的 `{ BAT_HELPER_LOG_DIR, BAT_USER_DATA }`；`helperLogDir()`、`cleanupHelperLogDir()`。
- `scripts/__tests__/_question-mock-remote.mjs` `runHelper()`：`env: { ...childEnv, ...helperLogEnv(), ...env }`（呼叫者的 env 仍優先）；`cleanupTempDirs()` 一併清掉暫存 log 目錄。修好 #1、#2，也讓之後任何 `runHelper(…, {})` 都安全。
- `scripts/__tests__/server-bundle-helpers.test.mjs` `runNode()`：預設 env 改為 `{ ...cleanEnv(), ...helperLogEnv() }`；`afterAll` 清目錄。🔴 `_bat-logger` / userData 解析那幾個測試自己傳 `opts.env`（`cleanEnv()` + 暫存 home），仍看到兩個變數未設，行為不變。修好 #3、#4。
- `electron/__tests__/bat-terminal-wait-started.test.ts`：只改 `--help` 那一個測試，帶自己的暫存 `BAT_HELPER_LOG_DIR` / `BAT_USER_DATA`（放進檔內既有的 `tempDirs`，`afterAll` 清）。修好 #5。
- 沒改 helper 腳本、產品程式、`tests/`、其他 `electron/__tests__` 檔。

### source guard

`scripts/__tests__/helper-test-log-dir.test.mjs`（vitest 收得到；不在 `tests/`，D177），5 項：

1. **runtime**：把 `APPDATA` / `HOME` / `USERPROFILE` / `XDG_CONFIG_HOME` 暫時指到假 home，`runHelper()` 以空 env 跑 `bat-terminal --help`、`bat-notify --help` → 假 home 底下沒有任何 `bat-scripts.log`，兩筆 `invoke` 都在 `helperLogDir()`（結束後還原 env）。
2. **掃描有效性**：掃描必須找到已知的 helper 測試（`bat-mcp.test.mjs`、`tests/bat-terminal-msys` / `bat-notify-submit`、`terminal-blocked-state`、`bat-terminal-wait-started`、三支 headless e2e），避免掃描規則壞掉時全部放行。
3. **每個 spawn helper 的測試檔都設了暫存 log 目錄**（`BAT_HELPER_LOG_DIR` 或 `helperLogEnv(`）；唯一例外 `PTY_ENV_RUNS`（三支 headless e2e，原因寫在檔內）。
4. **自己定義 `run(args, env)` 的測試檔不得出現 `run([…], {})`**（這次 `--help` 洩漏的寫法）。
5. **共用 runner 有把暫存目錄墊在呼叫者 env 底下**（`runHelper` / `runNode` 的 env 組法）。

掃描範圍：`scripts/__tests__`、`electron/__tests__`、`electron/remote/__tests__`、`electron/remote-tools/__tests__`、`tests/*.test.mjs`（頂層；`tests/e2e` 是 Playwright）。判定「跑 helper」= `spawn/spawnSync/execFile/execFileSync/fork(process.execPath, [<第一個元素>` 的第一個元素直接是 helper 路徑（或 `BAT_HELPER_DIR` / `REPO_SCRIPTS`），或是宣告為 helper 路徑的變數；引號開頭（`-e`、`--input-type`）視為 inline probe。第一版用「檔案提到 helper 檔名＋有 spawn」太粗，誤判 9 檔（`bat-hook.test`、`report-artifact-sizes`、`blocked-hooks-launch`、`codex-osc-state`、`helper-capability` 等其實沒跑 helper），已改成上述精準規則；改後 `electron/__tests__` **沒有其他命中**（不需再問塔台）。

**負向對照**（暫時拿掉修正後跑 guard，跑完以 `cp` 從 scratchpad 備份還原，`git diff` 確認回到修正後內容）：把 `runHelper` 的 `...helperLogEnv()` 拿掉、把 wait-started 改回 `run(['--help'], {})` → guard 5 項中 3 項失敗（runtime、`run(['--help'], {})` 命中 `electron/__tests__/bat-terminal-wait-started.test.ts`、共用 runner 組法），還原後 5/5 綠。負向對照時 helper 寫到的是 guard 的假 home，不是真實 log。

### 驗證

| 關卡 | 結果 | 證據 |
|---|---|---|
| `npm run test:unit`（偵測目錄 env，修正後） | PASS | 396 檔通過 / 1 skipped、6920 tests；偵測目錄 **0 個** `bat-scripts.log`（修正前 5 筆） |
| `npm run test:unit`（真實 env，修正後） | PASS | 396 檔 / 6920 tests；真實 log（只讀）23007 → **23007（+0）**，10:09:18–10:10:16 UTC |
| `npm run test:legacy`（真實 env，修正後） | PASS | 33 檔、472 tests 全綠；真實 log 23011 → 23014（+3），3 行都是另一個分頁（terminal `c6b2dcdc`）的 `bat-hook` / `remote-server report-hook`，沒有 argv、不是測試 |
| `npm run typecheck:electron` | PASS（0） | 有改 `electron/__tests__/bat-terminal-wait-started.test.ts` 所以補跑 |
| `npm run typecheck` | 未跑 | 沒改 `src/**` |

- 真實 log 位置：`%APPDATA%\BetterAgentTerminal\Logs\bat-scripts.log`（本分頁的 `BAT_USER_DATA` 指向同一份，已以 `-ef` 確認）；全程只用 `wc -l` / `sed -n` 讀，沒修改。
- 注意：本 session 在 BAT 分頁裡、`BAT_USER_DATA` 指向真實 userData，所以修正前即使測試只去掉 `BAT_*` 也會落到 `%APPDATA%`；修正後測試一律帶自己的暫存目錄，與跑在哪裡無關。

### 變更檔案

- `scripts/__tests__/_helper-test-env.mjs`（新增）
- `scripts/__tests__/helper-test-log-dir.test.mjs`（新增，source guard）
- `scripts/__tests__/_question-mock-remote.mjs`
- `scripts/__tests__/server-bundle-helpers.test.mjs`
- `electron/__tests__/bat-terminal-wait-started.test.ts`（Q-1 塔台同意，只改 `--help` 那個測試）
- 本工單

### 遭遇問題

- 無阻擋。source guard 第一版規則太粗（上述 9 檔誤判），改成以 `process.execPath` spawn 的第一個參數判定。

### 後續（給塔台）

1. Linux 沒有在本單重測（本機 Windows）。修法是平台無關的明確 env（`BAT_HELPER_LOG_DIR` 優先於任何 home 推測），guard 的 runtime 項目在 Linux 上也會把 `HOME` / `XDG_CONFIG_HOME` 指到假 home；若要正式驗收 BUG-208 的 Linux 那 10 行，可在下次 Linux CI / 實機順手比對 `~/.config/BetterAgentTerminal/Logs/bat-scripts.log`。
2. BUG-208 可依塔台判斷改 `FIXED`／`CLOSED`（修正 commit `e585c762`）。

### 互動紀錄

- [18:04] Q-1：`electron/__tests__/bat-terminal-wait-started.test.ts` 的 `--help` 也漏設暫存 log 目錄，要不要一併修？ → A（塔台，BAT 通道，等 7 s）：同意，只改這一處；guard 可掃 `electron/__tests__` 但只檢查，另有命中先停 → Action：只改該測試的 `--help`；guard 改精準規則後 `electron/__tests__` 無其他命中。
