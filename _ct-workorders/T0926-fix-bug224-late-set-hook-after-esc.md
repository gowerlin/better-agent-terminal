---
schema_version: 1
schema_kind: workorder
id: T0926
title: "BUG-224：AskUserQuestion 選單出現後極快 Esc，晚到的設定類 hook（`permission-request` tool=AskUserQuestion）把已被使用者輸入清除的 `blocked: question` 設回，塔台卡住到下次打字 —— 讓晚到的設定不覆蓋較新的使用者輸入清除"
type: bugfix
status: DONE
repo: better-agent-terminal
project: BUG-224
priority: P1
sizing: M
created_at: "2026-11-25T23:04:18+08:00"
updated_at: "2026-11-25T23:14:27+08:00"
started_at: "2026-11-25T23:05:42+08:00"
completed_at: "2026-11-25T23:14:27+08:00"
session_ids:
  - "920f795c-92e9-4416-a921-2edbc71643bb"
target_version: "0.8.0-pre.4"
depends_on: []
related:
  - "BUG-224；T0923〈建議開 BUG〉1（`ct620-accept/results/M-9.md`，本機）；T0790 / BUG-197（晚到的清除以 `at` 判斷）、T0791 / BUG-198、T0918 / BUG-222（排隊的權限詢問 `keptForQueuedPrompts`）、T0757 / BUG-188（滑鼠回答）、T0788 / BUG-196（通知保護）、T0590（hook 規則）"
affects_files:
  - _ct-workorders/T0926-fix-bug224-late-set-hook-after-esc.md
  - electron/terminal-blocked-state.ts
  - electron/pty-manager.ts
  - electron/__tests__/
  - docs/agent-guide/blocked-state.md
  - CLAUDE.md
renew_count: 0
isolation: worktree
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 分支：只在 `ct/T0926` 寫檔（base = 派工當下的 `main`）。不 merge / rebase / push、不動 `main`。主 checkout 只寫本工單檔（`git -C \"$CT_HOME\" commit --only _ct-workorders/<本檔>`）。與 T0925（只合併 `e2e/manual/`）平行，不碰 `e2e/`。"
  - "🔴 不得改變的既有規則（CLAUDE.md「blocked 狀態偵測」節與 `docs/agent-guide/blocked-state.md`）：T0590 hook 腳本規則（`scripts/bat-hook.mjs` 一律 exit 0、stdout 不輸出、總時限 1.8 s；本單**不改** `bat-hook.mjs`）；T0790 / T0791 晚到清除與回合判斷（`at` 是 hook 程序啟動時間 `process.hrtime` ns，🔴 不得改用牆鐘或拿主行程 `Date.now()` 與 `at` 比）；T0918 排隊權限詢問（未結束 ≥ 2 個時使用者輸入 / 滑鼠不清除）；T0757 滑鼠回答（不算使用者輸入）；codex OSC `input` 不受使用者輸入清除；沒有 / 不合法 `at` 的回報行為不變；查詢回傳形狀與 `blockedReason` 值域不變（契約 T0590 / T0600）。"
  - "🔴 方向（Worker 依讀碼決定，回報理由）：讓「使用者輸入造成的清除」之後才到、但**屬於同一個提示**（例：同一 `tool_use` 或同一回合、在使用者輸入之前就已啟動）的設定類 hook 不再把 reason 設回。可行做法例：(a) 記下清除當下已記錄的最新 hook `at`，之後到達的設定類 hook 若 `at` ≤ 該值或屬於已清除的同一提示就不設；(b) 使用者輸入清除 `question` 後，同 reason 的 `permission-request tool=AskUserQuestion` 在短時間內視為同一提示而忽略（需說明時間窗如何避免誤擋真正的新提示，且時間窗只能用單調時鐘）。🔴 不得用「Esc 一律清除且不再接受任何設定」這種會漏掉真正新提示的做法；真正的下一個 AskUserQuestion / 權限詢問必須照常 `blocked`。"
  - "🔴 測試：單元測試重現 BUG-224 時序（`ask-user-question` 設定 → 使用者輸入清除 → 晚到 `permission-request tool=AskUserQuestion` → 預期維持清除），以及反例：使用者輸入之後真正的新提示（新的 `ask-user-question` / `permission-request`）仍會 `blocked`；T0790 / T0791 / T0918 / T0757 既有測試全部不改、全過。"
  - "🔴 驗證：worktree `npm ci`；每次產品 commit 前完整跑 `npm run test:unit`，最後在 head 第一次完整執行全綠（附數字）；`npm run test:legacy` 全綠；`npx vite build` exit 0；`npm run typecheck` = 0、`npm run typecheck:electron` = 0。e2e 只用隔離實例（`launchIsolated`），不碰安裝版 BAT；不開會耗 token 的 claude 回合（真實時序的實機驗證寫「待實機」，塔台另排）。"
  - "🔴 文件：`docs/agent-guide/blocked-state.md` 補〈晚到的設定（BUG-224）〉：規則、時序、反例、日誌；CLAUDE.md「blocked 狀態偵測」節加一兩句＋唯一實作位置＋🔴 不變式（小節標題不改名，T0595；CLAUDE.md < 100k 字元）。"
  - "🔴 Git：worktree 用 `git add <明確路徑>`；不 push、不觸發 workflow、不建 tag。禁止 `git stash`（含 list）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF；含反斜線的內容用 Write／Edit 寫（L129）。收單前 worktree `status --porcelain` 為空。"
  - "🔴 公開 repo（D176）：程式、註解、回報區不寫真名、家目錄路徑；日誌不記輸入內容、權杖。yolo：不得問使用者，判讀問題依 ct-exec § Questions For Tower 問塔台。"
---

# T0926 — BUG-224：極快 Esc 後晚到的設定類 hook

## 背景

T0923（PLAN-069 實機驗收）時，契約 2 塔台開 AskUserQuestion 選單、約 0.1 s 內按 Esc，debug log（UTC）：

- `14:31:05.872` `blocked reason=question (hook ask-user-question)`
- `14:31:05.972` `cleared (user input)`（Esc）
- `14:31:05.983` `blocked reason=question (hook permission-request tool=AskUserQuestion)`（晚到，又設回）

Esc 中斷回合後 claude 不再送 `stop` 等 hook，分頁停在 `blocked: question`（縮圖 ⚠️），Worker `--submit` 通知與待辦分頁回答都被通知保護（T0788）保留，直到 3 分鐘後使用者在分頁打字才清除。CT 6.2.0（R6）起塔台暫停一律開原生選單、要從待辦分頁回答時要先按 Esc，曝露增加。使用者裁示發版前修（U-10：A，D355）。

唯一實作：`TerminalBlockedTracker`（`electron/terminal-blocked-state.ts`；`parseHookAt` 約第 258 行、`report` 的 `at` 判斷約第 443 行、`keptForQueuedPrompts` 約第 583 行、使用者輸入清除約第 676–693 行）、`PtyManager.noteUserInput`（`electron/pty-manager.ts`）。

## 驗收

- [ ] 根因與做法說明（為何能擋住晚到的設定、又不漏掉真正的新提示）
- [ ] BUG-224 時序的單元測試（修正前失敗、修正後通過）與反例測試
- [ ] T0790 / T0791 / T0918 / T0757 既有測試不改且全過
- [ ] `npm run test:unit` head 第一次全綠；`npm run test:legacy` 全綠；`npx vite build` exit 0；兩個 typecheck = 0
- [ ] 文件兩處；〈待實機〉列出要以真 claude 驗證的步驟

---

## 回報區

### 完成狀態

- **狀態**：DONE（BUG-224 → 建議 FIXED，真實時序待實機，見〈待實機〉）
- **落點檢查**：PASS。C-0：工單 `repo` = `better-agent-terminal`，`basename "$CT_HOME"` = `better-agent-terminal`；C-1：工單在 `$CT_HOME/_ct-workorders/`；C-3：`affects_files` 皆存在（`electron/__tests__/` 等）；C-2：無 `branch` 欄位。`CT_HOME` 已設定、`CT_WORKTREE_BRANCH` = `ct/T0926`、`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）。
- **產品 commit**：`2781c81e`（`fix(blocked): …`，ct/T0926）
- **session_id**：920f795c-92e9-4416-a921-2edbc71643bb

### 根因與做法

**根因**：一個 AskUserQuestion 提示回報兩次 hook：先 `ask-user-question`（`PreToolUse`，同步，claude 等它結束才顯示選單），再 `permission-request` tool=AskUserQuestion（`PermissionRequest`，T0597；選單**已經顯示**時才在跑）。選單出現約 0.1 s 內按 Esc，使用者輸入清除 `question` 時第二個 hook 還沒到；它到達後走一般的設定路徑把 `question` 設回。Esc 中斷回合後 claude 不再送 `stop` 等 hook，分頁停在 `question` 直到下一次打字。docs 原本「進入類回報一定早於之後的任何事件，不需要反向判斷」只對 `PreToolUse` 成立，`PermissionRequest` 與選單並行，這是漏洞所在。

**做法**（工單方向 (a)／(b) 的組合，以「同一提示的兩個 hook」辨識，時間窗只當上限）：
1. tracker 在 `question` 期間記下該提示已回報哪一個 hook（`questionHooks`）。
2. 使用者輸入 / 滑鼠按下（T0757）清除 `question` 時，若只回報了一個，記下「已回答的提示」（`answeredQuestions`：已回報哪一個、當時 `blockedAt`、清除當下的單調時鐘毫秒）。這筆紀錄刻意活過 `clear()`。
3. 之後第一個 `question` 設定類回報（`lateHookOfAnsweredQuestion`）：
   - 已回報 `ask-user-question`、這次是 `permission-request` tool=AskUserQuestion → 同一提示晚到的第二個 hook，不設回（BUG-224 的方向；不看 `at`：它本來就晚於 `PreToolUse` 啟動，所以方向 (a)「`at` ≤ 清除時已知最新 `at`」擋不住這個情況）。
   - 已回報 `permission-request`、這次是 `ask-user-question` → 只有兩邊都有 `at` 且這次**較早**才算同一提示（T0790 的比法：只比 hook 與 hook 的 `at`）。
   - 其他情況或超過 `ANSWERED_QUESTION_LATE_HOOK_MS` = 5 s → 照 T0926 前 `blocked`。
4. 紀錄只看一次：被吸收或任何下一個設定類回報即丟；PTY 結束（`clearStarted`）、recovery（`clearAll`）、`dispose` 也丟。

**為何不漏掉真正的新提示**：claude 對同一提示一定先跑 `PreToolUse`（同步 hook，回報在 hook 結束前送達）再跑 `PermissionRequest`，所以下一個 AskUserQuestion 第一個到的一定是 `ask-user-question` —— 它不是規則 3 第一列要找的 hook，會丟掉紀錄並照常 `blocked`，它自己的 `permission-request` 隨後是 `unchanged`。反序列新提示的 `at` 較晚 → 照常 `blocked`；沒有 `at` → 照常 `blocked`（寧可回到舊行為）。權限詢問完全不適用（一個權限提示只有一個 hook，晚到的 `PermissionRequest` 是真的排隊提示，T0918）。時間窗只用單調時鐘（`AgentTurnOptions.monotonicNow`，預設 `performance.now()`），沒有拿主行程時間與 `at` 比；5 s 依據 hook 腳本總時限 1.8 s ＋ node 啟動。

### 產出摘要

| 檔案 | 內容 |
|---|---|
| `electron/terminal-blocked-state.ts` | `ANSWERED_QUESTION_LATE_HOOK_MS`、`QuestionHooks` / `AnsweredQuestion`、`AgentTurnOptions.monotonicNow`；`TerminalBlockedTracker` 新增 `questionHooks` / `answeredQuestions`、`noteQuestionHook`、`questionAnsweredEarly`、`clearAnswered`（`clearForUserInput` / `clearForMousePress` 改呼叫它）、`lateHookOfAnsweredQuestion`（`report` 呼叫）；清理點（`clear`、`observeCodexState`、`clearStarted`、`clearAll`、`dispose`）；檔頭說明段 |
| `electron/__tests__/blocked-late-question-hook.test.ts`（新） | 14 個測試（13 tracker＋1 PtyManager），見〈驗證〉 |
| `docs/agent-guide/blocked-state.md` | 〈晚到的設定（T0926 / BUG-224）〉：原因（T0923 時序）、規則、紀錄生命週期、為何不漏新提示（反例）、時間窗、日誌、不變、殘留、實作；另加「驗證（T0926 / BUG-224）」一行 |
| `CLAUDE.md` | 「blocked 狀態偵測」節加一點（規則、🔴 單調時鐘、🔴 只適用 `question`、唯一實作）；小節標題未改；94,849 字元（< 100k） |

`electron/pty-manager.ts` 不需要改（`noteUserInput` / `noteMousePress` / `reportHookEvent` 介面不變，tracker 建構時不帶 `monotonicNow` → 預設 `performance.now()`）。`scripts/bat-hook.mjs` 未改。

日誌新增一行：`[blocked] terminal=<id> kept cleared: hook <event>[ tool=<name>] is of the question the user answered <n>ms ago (reported late)`（不記 `at`、不記輸入內容）。

### 驗證

證據分道：

- **單元測試（新）**：`blocked-late-question-hook.test.ts` 14/14 過。涵蓋 BUG-224 時序（`ask-user-question` → 使用者輸入清除 → 晚到 `permission-request` tool=AskUserQuestion → 維持清除、`onChange` 只有兩次、日誌 `kept cleared`）、滑鼠按下、沒有 `at`、反序（較早 `at` 吸收；較晚 / 相等 / 任一方沒有 `at` → `blocked`）；反例：吸收後下一個 AskUserQuestion 照常 `blocked`、晚到 hook 沒來時下一個提示照常、回答後的權限詢問 / elicitation 照常、超過 5 s 照舊設回（剛好 5 s 仍吸收）、紀錄只用一次、兩個 hook 都在回答前到則不記、未 blocked 時再打字不丟紀錄、PTY 結束 / recovery 丟紀錄、中間清除類回報不丟紀錄、權限詢問（T0918）不受影響、codex `input` 不變；PtyManager `noteUserInput` → `reportHookEvent`。
- **修正前失敗**：把判斷暫時改成永遠 `false`（突變，已還原）→ 14 個裡 9 個失敗（含 BUG-224 時序與 PtyManager 案例），其餘 5 個是反例（修正前後都該 `blocked`）。
- **既有測試不改且全過**：`terminal-blocked-state.test.ts`（T0590 / T0790）、`agent-turn-attention.test.ts`（T0791）、`queued-permission-prompts.test.ts`（T0918）、`blocked-mouse-press.test.ts`（T0757）、`blocked-hooks-launch.test.ts`、`scripts/__tests__/bat-hook.test.mjs`：未修改，全過（165 ＋ 32）。
- **閘門**（worktree `npm ci` 後）：
  - commit 前完整 `npm run test:unit`：498 檔過、3 略過；9,046 過、47 略過、0 失敗。
  - **head `2781c81e` 第一次完整** `npm run test:unit`：Test Files 498 passed | 3 skipped (501)；Tests 9046 passed | 47 skipped (9093)，0 失敗。
  - `npm run test:legacy`：exit 0，files 33 passed / 0 failed，tests 472 passed / 0 failed（11 個依腳本 `EXCLUDED` 不跑）。
  - `npx vite build`：exit 0。
  - `npm run typecheck` = 0、`npm run typecheck:electron` = 0（exit 0、無錯誤輸出）。
  - `git diff --check`：無空白錯誤；檔案維持 LF。
- **runtime / e2e**：未跑（工單排除：不開會耗 token 的 claude 回合；真實時序列〈待實機〉）。

### 待實機

以真 claude 驗證（塔台另排；不在本單執行）：
1. 開契約 2 塔台（claude-cli，BAT hooks `ok`），讓它呼叫 AskUserQuestion，選單出現後**盡快**（< 0.2 s，可用自動化在偵測到選單畫面時立即送 `\x1b`）按 Esc。
2. 預期 debug log：`blocked reason=question (hook ask-user-question)` → `cleared (user input)` →（若 `PermissionRequest` 晚到）`kept cleared: hook permission-request tool=AskUserQuestion is of the question the user answered <n>ms ago (reported late)`；**不應**再出現 `blocked reason=question (hook permission-request …)`。
3. 縮圖不顯示 ⚠️；MCP `bat_get_state` 該分頁非 `blocked`；此時 Worker `bat-notify --submit` 與待辦分頁回答立即送出（不被通知保護保留）。
4. 反例：Esc 後在同一分頁送新 prompt 讓 claude 再問一次 AskUserQuestion → 照常 `blocked reason=question`、⚠️ 出現；兩個 hook 都到後才 Esc（正常速度）→ 行為與 T0926 前相同。
5. 重複步驟 1 數次（T0923 驅動自動化：6 次觸發 1 次），確認沒有一次停在 `question`。

### 互動紀錄

- [23:05] 開工（yolo、`CT_INTERACTIVE=0`）；讀工單、BUG-224、`_local-rules.md`、CLAUDE.md；沒有向塔台提問。
- [23:09] 依讀碼決定做法：方向 (a)（只比 `at`）擋不住 BUG-224，因為晚到的 `PermissionRequest` 本來就比 `PreToolUse` 晚啟動；改以「同一提示的兩個 hook」辨識＋單調時鐘時間窗上限，反序才用 `at`。

### 遭遇問題

- 無阻塞。docs 既有「進入類回報一定早於之後的任何事件」一句只對 `PreToolUse` 成立，新段落已說明例外（未改原句，避免動到 T0790 段落的其他敘述）。

### 隔離分支證據
- branch：`ct/T0926`
- base_sha：`4e5625196b11c9c308f1ccf87c595b9138262432`
- validated_sha：`2781c81ebdfa30796f0448f9a77dce3c7f79fcf6`
- head_sha：`2781c81ebdfa30796f0448f9a77dce3c7f79fcf6`
- validated_sha ≠ head_sha 的說明：相同，不適用
- 收單時 `git -C "$CT_WORKTREE" status --porcelain`：空

### 回報時間

2026-11-25T23:14:27+08:00
