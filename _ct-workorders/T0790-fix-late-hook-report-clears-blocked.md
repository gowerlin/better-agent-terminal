---
schema_version: 1
schema_kind: workorder
id: T0790
title: "修正 BUG-197：晚到的 hook 回報（`user-prompt-submit` / `stop`）不得清掉同一回合、時間比它晚發生的 `permission` / `question` blocked"
type: implementation
status: DONE
repo: better-agent-terminal
project: maintenance
priority: P1
sizing: M
created_at: "2026-11-02T19:25:46+0800"
started_at: "2026-11-02T19:26:58+0800"
updated_at: "2026-11-02T19:50:52+0800"
completed_at: "2026-11-02T19:50:52+0800"
session_ids:
  - "a4db822a-1566-4d5b-b582-1459ccceb1fe"
depends_on: []
related:
  - "BUG-197（medium，OPEN）；T0788 回報區〈遭遇問題〉第 1 點；BUG-196 / T0788（`electron/notify-hold.ts` 依 hook reason 判斷要不要保留）；D230"
  - "`electron/terminal-blocked-state.ts`（`TerminalBlockedTracker`；約 347–360 行 `user-prompt-submit` → `startTurn` + `clear`）、`scripts/bat-hook.mjs`（每個 hook 一個程序，`terminal:report-hook`）、`electron/bat-mcp-launch.ts`（`BAT_CLAUDE_HOOKS`）"
  - "CLAUDE.md「blocked 狀態偵測」（T0590 契約、🔴 hook 腳本規則）「Worker 啟動確認」（T0600）「Worker 分頁回收」（T0694 回合信號 `TerminalBlockedTracker`；🔴 renderer 端不得拿主行程時間與 `reportedAt` 比）「Terminal Server 存活判定」（BUG-171：🔴 判斷只用單調時鐘）節；`docs/agent-guide/blocked-state.md`"
affects_files:
  - _ct-workorders/T0790-fix-late-hook-report-clears-blocked.md
  - _ct-workorders/BUG-197-late-user-prompt-submit-hook-clears-blocked.md
  - electron/terminal-blocked-state.ts
  - electron/pty-manager.ts
  - scripts/bat-hook.mjs
  - electron/__tests__/terminal-blocked-state.test.ts
  - electron/__tests__/**
  - scripts/__tests__/**
  - e2e/t0787-notify-into-blocked-tower.spec.ts
  - docs/agent-guide/blocked-state.md
  - docs/agent-guide/notify-hold.md
  - CLAUDE.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: decision-requiring
memory_overrides:
  - "🔴 先查證再修：① 用單元測試（直接餵 tracker）重現 T0788 看到的順序：`permission-request` 先到 → `user-prompt-submit` 後到 → blocked 被清。② 查 `stop` 有沒有同類問題（上一回合的 `stop` 晚到、清掉新回合的 blocked），以及其他會清除的事件（`post-tool-batch`、`PostToolUse AskUserQuestion` 等）是否也會受到「到達順序 ≠ 發生順序」的影響。回報區列表說明每個事件的結論。"
  - "🔴 設計方向（可調，偏離時先問塔台）：以「事件發生的先後」判斷，不以「到達主行程的先後」判斷。建議做法是 `bat-hook.mjs` 在腳本一開始取一個時間（`at`），隨 `terminal:report-hook` 送出；tracker 遇到可以清除的事件，如果它的 `at` 早於目前 blocked 那筆的 `at`，就不清除（但照樣做 `startTurn` 等其他處理，回合信號（T0694）不能因此漏掉）。🔴 時鐘：不得用牆鐘（`Date.now()`，BUG-171：NTP 校時會跳）；要用同一台主機上跨程序可比較的單調時鐘（例：`process.hrtime.bigint()`，Windows 是 QueryPerformanceCounter、Linux 是 CLOCK_MONOTONIC），回報區寫明為什麼跨程序可比，並在 Windows 實測。如果找不到可靠的跨程序單調時鐘，改用其他方式（例：同一回合以 hook payload 裡的欄位判斷），先問塔台。"
  - "🔴 相容：舊的 hook 腳本（沒有 `at`）、遠端舊 bat-server、`at` 不合法的回報 → 行為與現在完全相同。`terminal:report-hook` 的目標永遠是呼叫者自己（T0590）不變。`at` 不得出現在任何查詢回傳（`terminal:get-state` 等契約不變）。"
  - "🔴 hook 腳本規則（T0590 / T0600，不得違反）：一律 exit 0、stdout 不輸出任何東西、任何失敗靜默、總時限 `HOOK_DEADLINE_MS` = 1.8 s；`SessionStart` 不送 `source` 等 payload；日誌只記前 8 碼 session id。新增欄位只能是時間值，不得帶 hook payload 內容。"
  - "🔴 不變的行為（不回歸）：blocked 契約（state / blockedReason / blockedDetection / 優先序）、滑鼠回答（T0757）、使用者輸入清除規則、codex OSC（T0621；`input` 不受影響）、`agentStarted`（T0600）、回合信號（T0694 `↻`）、notify-hold（T0788）。動工前列出相關的已驗收測試並在回報區逐項判定（至少：`e2e/t0590-blocked-state.spec.ts`、`t0600-launch-confirmation`、`t0621-codex-osc-state`、`t0757-mouse-answer-clears-waiting`、`t0787-notify-into-blocked-tower`，單元 `terminal-blocked-state` / `blocked-hooks-launch` / `blocked-mouse-press` / `notify-hold*`）。"
  - "🔴 驗收：① 單元測試：亂序（晚到的 `user-prompt-submit` / `stop` 不清除較晚發生的 blocked；正常順序照常清除；沒有 `at` 時行為不變；`at` 不合法時忽略該欄位）＋突變檢查（拿掉比較 → 失敗）。② `e2e/t0787-notify-into-blocked-tower.spec.ts`：拿掉 T0788 加的「偵測到 RACE 就重跑」容錯，改成直接斷言；10 情境 × 至少 3 輪，races 0、全部通過。③ 不回歸 e2e 實跑。④ `npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npm run test:unit`、`npm run test:legacy`、`npx vite build`、`npm run verify:helpers`（改了 helper）。實測一律隔離實例＋假模型，真實模型花費 0，不碰使用者的 BAT 與塔台分頁。"
  - "🔴 文件：`docs/agent-guide/blocked-state.md` 補清除規則與時鐘說明；`notify-hold.md` 已知限制更新；CLAUDE.md「blocked 狀態偵測」節最多加一行（不改 `##` 標題）。BUG-197 改 FIXED（附 commit）並補〈處理紀錄〉；`_bug-tracker.md` 由塔台更新。"
  - "🔴 yolo：不得問使用者；判讀 / 範圍問題依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。超出 affects_files 先問塔台。Git：只 commit 本單範圍的檔案（`git commit --only` 或明列路徑）。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。e2e 一律帶自己的 `--output` 暫存目錄，不清共用的 `e2e-results/`。不 push、不發版。公開 repo 去識別化（D176）。"
---

# T0790 — 修正 BUG-197：晚到的 hook 回報清掉 blocked

## 元資料

- **工單編號**：T0790
- **類型**：implementation（BUG 修正）
- **互動模式**：yolo（問題問塔台）
- **優先級**：P1
- **建立時間**：2026-11-02T19:25:46+0800
- **預估規模**：M

## 目標

claude 的每個 hook 都是一個獨立的 `bat-hook.mjs` 程序，回報到主行程的順序不一定等於事件發生的順序。T0788 的 e2e 跑 60 次，有 1 次是同一回合較早的 `user-prompt-submit` 比 `permission-request` 晚到，把 blocked 清掉了，但對話框其實還在。BUG-196 的修正（notify-hold）靠 blocked 判斷要不要保留通知，所以這時 Worker 的 `--submit` 仍會替使用者作答。修正後，清除 blocked 要依事件發生的先後判斷，不依到達的先後。

## 已知資訊

- T0788 實錄：`→ blocked reason=permission (hook permission-request)` → `[turn] started (hook user-prompt-submit)` → `→ cleared (hook user-prompt-submit)`，當時對話框仍在。
- 發生條件推定：假模型回得極快（幾十毫秒內就送出權限請求）；真實模型應該更少見，但沒有量測。
- 修好後要和 BUG-196 一起整體驗證，再發 `0.7.3-pre.8`（D230）。

## 範圍與規則

見 frontmatter `memory_overrides`。

## 互動規則

- yolo：不問使用者，判讀與範圍問題問塔台（每輪最多 3 題）。

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 待塔台決策

#### Q-1：`at` 要從 handler 傳進 tracker，必須改 `electron/pty-manager.ts`（不在 affects_files），可以改嗎？
- **提問時間**：2026-11-02T19:31:05+0800
- **說明**：`terminal:report-hook` handler 只能呼叫 `PtyManager.reportHookEvent(id, event, toolName, sessionId, agentId)`，它原樣轉給 `TerminalBlockedTracker.report`。要把新欄位 `at` 傳進去，只能在這個方法多加一個參數並轉發（簽章＋轉發共 2 行，加 1 行 JSDoc；其他行為不變）。
- **選項**：
  - A. 允許改 `electron/pty-manager.ts`，只限 `reportHookEvent` 的簽章、轉發與註解（加進 affects_files）
  - B. 不改 pty-manager.ts，改用別的方式把 `at` 傳到 tracker（例：handler 直接拿 tracker，需改 `ReportHookPtyManager` 介面與 main / headless 的接線，改動更大）
  - 其他
- **建議**：A。理由：改動最小、與 T0642 / T0657 加 `sessionId` / `agentId` 的做法相同；B 要改更多接線檔。
- **影響**：不能改 → 修正無法生效（tracker 收不到 `at`）。
- **是否阻擋後續步驟**：是（單元測試的 PtyManager 層與 e2e 都要經過這裡）；hook 端與 tracker 的修改可先做。
- **通道**：BAT（`q-148a455d-b6a5ade87063775d`）
- **塔台答覆 Q-1**：A：允許。把 electron/pty-manager.ts 加進 affects_files，範圍只限 reportHookEvent 的簽章、轉發 at 給 TerminalBlockedTracker.report，以及註解（比照 T0642 / T0657 加 sessionId / agentId 的做法）。不得改 PtyManager 的其他行為。回報區寫明改了哪幾行。（BAT 通道答覆，抄錄）

### 互動紀錄

- [19:31] Q-1: `at` 要經 `PtyManager.reportHookEvent` 傳進 tracker，可否改 `electron/pty-manager.ts`？ → A（塔台）: A，允許，只限 `reportHookEvent` 的簽章、轉發與註解 → Action: 改 `electron/pty-manager.ts` 1135–1144 行（JSDoc 加 2 行說明 `at`、簽章加 `at?: bigint`、`report(...)` 呼叫多傳 `at`），affects_files 已加入該檔；PtyManager 其他行為未動。

### 完成狀態

- **狀態**：FIXED（BUG 修正完成，等 `0.7.3-pre.8` 與 BUG-196 一起驗收）
- **落點檢查**：PASS。C-0 `repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal`；C-1 工單在 REPO_ROOT 下；C-3 抽查 `electron/terminal-blocked-state.ts`、`scripts/bat-hook.mjs` 等皆存在；C-2 無 `branch` 欄位（目前 `main`）。`CT_HOME` 未設（非 worktree）。`BAT_WORKSPACE_ID`：`cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）。
- **模式**：`CT_MODE=yolo`、`CT_INTERACTIVE=0`
- **session_id**：a4db822a-1566-4d5b-b582-1459ccceb1fe
- **commit**：產品 `77ad79ea`（`fix(blocked): a late clearing hook report keeps a newer blocked state (T0790, BUG-197)`）；工單提問 `19208c8b`；工單收單 commit 見本檔所在 commit。未 push。

### 產出摘要

**① 查證（先查再修）**

- 重現：單元測試直接餵 tracker，`permission-request` 先到 → 同回合較早的 `user-prompt-submit` 後到 → 修正前 blocked 被清（突變對照：拿掉比較後「T0788’s order」測試失敗）；另以兩個**真實** `bat-hook.mjs` 程序重現：`user-prompt-submit` 程序先啟動但 stdin 未關（讀到 300 ms 逾時才回報），`permission-request` 程序後啟動、立即回報 → 回報順序反過來，修正後維持 `permission`。
- 各清除事件的結論（hook 設定見 `BAT_CLAUDE_HOOKS`：清除類全部 `async`，進入類全部同步）：

  | 事件 | 會不會「晚到」清掉較新的 blocked | 處理 |
  |---|---|---|
  | `user-prompt-submit` | 會（T0788 實錄：同回合的權限請求在它之前到） | 套用規則；回合照舊開始 |
  | `stop` | 會：上一回合的 `stop` 晚於下一回合的權限請求（塔台回合結束後被 Worker 通知立刻送出新 prompt、模型很快要權限） | 套用規則；回合照舊結束（見遭遇問題 2） |
  | `post-tool-batch` | 會：上一批的回報晚於同一 agent 下一批的權限請求（假模型幾毫秒內就要下一個工具） | 套用規則，比**同一 agent** 的權限請求時間；另一個 agent 的較早批次照樣把那個 agent 移出 |
  | `ask-user-question-done`（PostToolUse AskUserQuestion） | 理論上同類；實際要等使用者回答，晚於進入事件數百 ms 以上，不會被判晚到 | 套用規則 |
  | `elicitation-done` | 同上 | 套用規則 |
  | 進入類 `permission-request` / `ask-user-question` / `elicitation` | 不會：同步 hook，claude 等回報結束才顯示對話框，之後的事件一定晚於它被處理 | 不需要反向判斷 |
  | 使用者輸入 / 滑鼠 / PTY 結束 / recovery | 非 hook、沒有 `at` | 照舊清除 |

**② 修正**（設計照工單方向，未偏離）

- `scripts/bat-hook.mjs`：`hookStartedAt()` = `process.hrtime.bigint() − process.uptime()`（hook 的 node **程序啟動**時間，ns、十進位字串），`main()` 經 `reportHook(event, input, { at })` 放進 `terminal:report-hook` 的參數。只是時間值，不帶任何 hook payload；exit 0 / stdout 空 / 失敗靜默 / 1.8 s 時限不變（`hookStartedAt` 任何例外回 `undefined` → 不送）。
- `electron/terminal-blocked-state.ts`：`HOOK_AT_PATTERN` / `parseHookAt`（`^[0-9]{1,20}$`、1 … 2^64−1，其餘忽略、不報錯）；tracker 私有 `blockedAt`（進入或維持同一 reason 的事件中最晚的 `at`）、T0657 的 agent 表由 `Set` 改為 `Map<agent, at|null>`；清除事件的 `at` < 目前的 `at`（`post-tool-batch`：同一 agent 的）→ 回 `unchanged`、記 `[blocked] terminal=<id> kept: hook <event>[ agent=…] happened <n>ms before the blocked state (reported late)`；`startTurn` / `endTurn` 在判斷之前照舊執行。使用者輸入、滑鼠、換 reason、codex `input`、PTY 結束、recovery 都重設 `blockedAt`。`at` 不在 `BlockedState`，不出現在任何查詢、`report-hook` 回應或 bat-scripts.log。
- `electron/pty-manager.ts`（Q-1 A）：只改 `reportHookEvent`（1135–1144 行：JSDoc +2 行、簽章 `at?: bigint`、轉發 `at`）。
- **時鐘為何跨程序可比**：`process.hrtime` = libuv `uv_hrtime`，Windows QueryPerformanceCounter、Linux `CLOCK_MONOTONIC`、macOS `mach_absolute_time`，都是同一主機所有程序共用的單調計數器；比較的兩個 `at` 都來自同一個 PTY 的 hook 程序（PTY 與 hook 必在同一台主機：本機、WSL、SSH、容器各自的 bat-server 那台），主行程時鐘不參與。不用牆鐘（BUG-171）。
- **Windows 實測**（node v26.13.0，腳本在 scratchpad）：子程序算出的啟動時間 **40 / 40** 落在父程序 spawn 前後兩次 `process.hrtime` 讀數之間；兩個程序先後 0 / 2 / 5 ms spawn（先啟動的多忙 40 ms 模擬模組載入）各 30 對：取**程序啟動時間**顛倒 **0 / 90**，取**執行到那一行的時間**顛倒 **83 / 90** → 採程序啟動時間。單元測試另含「子程序 `hookStartedAt()` 落在父程序讀數之間」（3 次）。
- 相容：舊 hook（無 `at`）、舊 / 遠端 bat-server（忽略未知欄位）、不合法 `at` → 行為與現在完全相同；`terminal:report-hook` 目標仍是呼叫者自己。

**③ 測試 / 文件**

- `electron/__tests__/terminal-blocked-state.test.ts`：新增「T0790 / BUG-197」describe 9 個測試、channel 測試 1 個、真實 hook 程序反序測試 1 個；原 13 處 `received` 的精確比對加上 `at: AT`（真實 hook 現在每次都送 `at`）。
- `scripts/__tests__/bat-hook.test.mjs`：`hookStartedAt`、跨程序時鐘、`reportHook` 送 / 不送 `at`（3 個）。
- `e2e/t0787-notify-into-blocked-tower.spec.ts`：拿掉 T0788 的「偵測到 RACE 就重跑（最多 2 次）」，改成直接斷言通知前最後一行 `[blocked]` 不是 `→ cleared`；另記 `lateReports`（被保留的晚到回報）與 `races`，輸出 JSON 多 `lateReports`。
- 文件：`docs/agent-guide/blocked-state.md` 新增「晚到的清除回報」小節（原因、規則、各事件結論、時鐘、殘留、相容）、hook 腳本與日誌條目、驗證清單；`notify-hold.md` 已知限制改為「T0790 已修」＋殘留；CLAUDE.md「blocked 狀態偵測」節加 1 行（`##` 標題未改）。
- `_ct-workorders/BUG-197-…md`：FIXED（`77ad79ea`）＋〈處理紀錄〉。`_bug-tracker.md` 未動（由塔台更新）。

### 相關通過案例（不回歸判定）

| 案例 | 與本單的關係 | 判定 / 證據 |
|---|---|---|
| `e2e/t0590-blocked-state.spec.ts` | hook → blocked、打字清除 | 不變，實跑 PASS |
| `e2e/t0600-launch-confirmation.spec.ts` | `session-start` / `agentStarted`（`session-start` 也帶 `at`，tracker 不用它） | 不變，實跑 PASS |
| `e2e/t0621-codex-osc-state.spec.ts` | codex `input`（無 hook、無 `at`） | 不變，實跑 PASS |
| `e2e/t0757-mouse-answer-clears-waiting.spec.ts` | 滑鼠按下清除（無 `at`，照舊清除並重設 `blockedAt`） | 不變，實跑 PASS（PROBE 測試預設 skip） |
| `e2e/t0787-notify-into-blocked-tower.spec.ts` | notify-hold（T0788）＋本單 | 3 輪 × 10 情境＋UI＋codex ⑤ 全 PASS，races 0 |
| 單元 `terminal-blocked-state` / `blocked-hooks-launch` / `blocked-mouse-press` / `notify-hold*` / `agent-turn-attention`（T0694 回合） | 狀態機、注入、滑鼠、保留、回合 | 全部在 `test:unit` 內 PASS；回合信號在晚到情境照舊開始 / 結束（新測試斷言） |
| 契約：state / blockedReason / blockedDetection / 優先序、`report-hook` 回應形狀、使用者輸入清除規則 | 不改 | channel 測試斷言回應與 get-state / list 不含 `at` |

### 驗證

| 閘門 | 結果 |
|---|---|
| ① 單元：亂序（晚到的 `user-prompt-submit` / `stop` 不清較晚的 blocked）、正常順序清除、無 `at` 不變、不合法 `at` 忽略 | PASS（`terminal-blocked-state.test.ts` 51 tests、`bat-hook.test.mjs` 17 tests） |
| ① 突變檢查 | 拿掉比較（條件前加 `false &&`）→ **7 個失敗**；hook 不送 `at` → **10 個失敗**（含 9 個 payload 比對與反序真實程序測試）；兩者以檔案備份還原（未用 git） |
| ② e2e t0787，拿掉 RACE 重跑，`T0787_RUNS=3` | **2 passed（9.9 min）**：30 情境＋UI＋codex ⑤；`races: 0`。`lateReports: 0`：這 3 輪沒有出現亂序（T0788 量到的是 60 次 1 次），晚到路徑由單元與真實程序測試涵蓋 |
| ③ 不回歸 e2e t0590 / t0600 / t0621 / t0757 | 4 passed、1 skipped（t0757 PROBE，需 opt-in），2.0 min |
| ④ `npm run typecheck` | 0 錯誤 |
| ④ `npm run typecheck:electron` | 0 錯誤 |
| ④ `npm run test:unit` | 385 files / 6772 passed、10 skipped |
| ④ `npm run test:legacy` | 33 files / 472 passed、0 failed |
| ④ `npx vite build` | 成功 |
| ④ `npm run verify:helpers` | OK |
| 實測條件 | 全部隔離實例＋假模型（`fake-anthropic-api`），真實模型花費 0；e2e 各自 `--output` 暫存目錄，未碰共用 `e2e-results/`、使用者的 BAT 與塔台分頁 |

### 遭遇問題

1. `electron/pty-manager.ts` 不在原 affects_files → Q-1 問塔台，答 A，已照辦（只改 `reportHookEvent`）。
2. （本單不改，建議另案）回合信號（T0694）也受到亂序影響：上一回合的 `stop` 若晚於下一回合的 `user-prompt-submit` 到達，會把新回合結束（`↻` 提早變回 `✓`，60 s 備援不會再開始）。同一個 `at` 可以用來修（`stop` 的 `at` 早於回合開始的 `at` 就不結束），但工單要求晚到事件的回合處理照舊，所以沒做。
3. 殘留：`at` 是 hook 的 node 程序啟動時間，不是 claude 觸發 hook 的時間；claude 經 shell（Windows Git Bash）啟動 hook，兩個事件間隔小於 shell + node 啟動差異時仍可能顛倒，發生率量不到。判斷錯的方向若是「真的清除被當成晚到」，blocked 會留到下一個清除事件 / 使用者輸入 / 滑鼠按下。已寫進 docs。
4. vitest 會把 `new URL(..., import.meta.url)` 改寫成 asset URL（http:），測試改用 `pathToFileURL(path.resolve(...))`。

### 方法論狀態回寫

不適用（本單無 `methodology`）。

### 回報時間

2026-11-02T19:49:43+0800
