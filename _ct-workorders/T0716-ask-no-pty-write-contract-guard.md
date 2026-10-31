---
schema_version: 1
schema_kind: workorder
id: T0716
title: "`bat-notify.mjs --ask --no-pty-write` 列為正式契約（文件＋守門測試），並修 `--ask` 的兩個小缺口（`terminal:notify` 回 false 被當成功、keypress 失敗時 stderr 誤導）"
type: implementation
status: DONE
started_at: "2026-11-01T01:43:10+0800"
updated_at: "2026-11-01T01:50:49+0800"
completed_at: "2026-11-01T01:50:49+0800"
repo: better-agent-terminal
project: ""
priority: P2
sizing: S
created_at: "2026-11-01T01:41:52+0800"
depends_on: [T0715]
related:
  - "T0715 研究（`97a64056`）回報區：〈建議方向〉B1 第 1–4 點、〈調查結論〉Q-B3「BAT 端可選的小改進」、驗證紀錄 A1–A7（本單的需求來源，先讀）"
  - "D190（使用者 2026-11-01 決定：B1＋兩個小修；Q-B2 / Q-B4 不做）"
  - "BMad-Guide 塔台 HANDOVER `_handover-2026-11-01-bat-ask-no-pty-write-contract.md`（CT v5.15.0 依賴此契約）"
  - "CLAUDE.md「Worker 問塔台（PLAN-048 / T0607）」節（契約 C-5）、`docs/agent-guide/tower-questions.md`、`docs/agent-guide/remote-tower-notify.md`"
affects_files:
  - scripts/bat-notify.mjs
  - scripts/__tests__/bat-notify-questions.test.mjs
  - electron/__tests__/terminal-handlers.test.ts
  - "tests/bat-notify-submit.test.mjs（只在既有斷言因 stderr 改字需要同步時）"
  - "electron/remote/__tests__/headless-remote-tower-e2e.test.ts（選用：塔台 PTY 不含通知字串的整合斷言）"
  - CLAUDE.md
  - docs/agent-guide/tower-questions.md
  - docs/agent-guide/remote-tower-notify.md
  - _ct-workorders/T0716-ask-no-pty-write-contract-guard.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 1 契約文件（T0715 B1 第 1、2 點）：`docs/agent-guide/tower-questions.md` 的 `--ask` 語法改成 `[--submit | --no-pty-write]`，流程補「`--no-pty-write` 時只有 `question:ask` → `terminal:notify`」，並寫明保證：`terminal:notify` 只發 `terminal:notified`（toast、徽章、Worker 分頁標記），不寫任何 PTY、不切換分頁或焦點、不觸發 agent 回合；`notified: yes` 表示 BAT 已接受通知，不表示有視窗顯示（headless 無 client 也回 yes）。CLAUDE.md「Worker 問塔台」節 helper 那一行語法補 `[--no-pty-write]`，加一條 🔴「`terminal:notify` 不得寫 PTY（CT v5.15.0 的批次提問依賴）」；`docs/agent-guide/remote-tower-notify.md` worker 列補同一句。CLAUDE.md 只改該節、維持節長原則（CLAUDE.md 撰寫規則），`##` 標題不改名。"
  - "🔴 2 守門測試（T0715 B1 第 3 點）：`bat-notify-questions.test.mjs` 斷言 `--ask --no-pty-write` 的 channel 恰好是 `['question:ask', 'terminal:notify']`、stdout 與 `--submit` 同格式（含 `notified: yes`）、exit 0，且旗標順序對調結果相同；`terminal:notify` 回 error → `question:cancel`、exit 1。`terminal-handlers.test.ts` 斷言 `terminal:notify` 不呼叫 PtyManager（`getPtyManager` / `write` / `writeWithResult` 等 spy 次數 0）。`--help` 的 `--ask` 段補「可搭 `--no-pty-write`」並在既有 help 測試斷言。"
  - "🔴 3 小修 A（T0715 A5）：`--ask` 下 `terminal:notify` 回 `false`（handler 拒絕 payload）也當失敗 → `question:cancel`、exit 1、`ask: NOTIFY_FAILED`；加測試。一般 notify（非 `--ask`）對 `false` 的處理：維持現況或一併修，由 Worker 依既有測試與 C-5 判斷，回報區寫明理由；改變一般 notify 的 exit code 屬契約變更 → 不改，回報 PARTIAL 交塔台。"
  - "🔴 4 小修 B（T0715 Q-B3）：`--ask` 的 `failAfterAsk` 依失敗步驟改 stderr：keypress 階段失敗時說明「預填已寫入塔台輸入框、Enter 沒送出，題目已取消」，不再說 Tower 沒收到通知；notify / pty:write 階段失敗維持原意。另在既有 `ask: NOTIFY_FAILED` 行之外**新增**一行可機讀的 `ask: NOTIFY_STEP <notify|pty-write|keypress>`（不改、不刪既有任何一行，exit code 不變），寫進 docs 與 CLAUDE.md（C-5 的向後相容擴充）。stdout 不變。"
  - "🔴 5 行為不變：除上述 3、4 外，`bat-notify.mjs` 其他模式（一般 notify、`--wait-answer`、`--cancel-question`）、exit code、stdout 格式、channel 順序、`SUBMIT_KEYPRESS_DELAY_MS`、權杖範圍（`HELPER_CHANNEL_ROLES` / `HELPER_PTY_WRITE_FORBIDDEN`）、主行程 `terminal:notify` / `pty:write` / `terminal:keypress` handler 都不改。不新增 MCP tool。"
  - "🔴 6 helper 規則：問題 / 答案內容只從 stdin 讀、日誌不記內容與權杖（CLAUDE.md「Worker 問塔台」）；跑 helper 測試時 `BAT_HELPER_LOG_DIR`、`BAT_USER_DATA` 指到 scratchpad。不得對本塔台或其他分頁呼叫 `bat-notify.mjs --ask` 做實測（用 `scripts/__tests__/_question-mock-remote.mjs` 等 mock）。"
  - "🔴 驗證：`npm run test:unit` 全綠、`npm run test:legacy` 全綠（`tests/bat-notify-*.test.mjs` 有改時必跑）、`npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npx vite build` 成功、`npm run verify:helpers` 通過。README / CHANGELOG 不改（發版時塔台處理）。"
  - "🔴 公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」。yolo：不得問使用者；判讀問題依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。Git：只用 `git commit --only` commit `affects_files`；不 push。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
---

# T0716 — `--ask --no-pty-write` 列為正式契約＋兩個小修

## 元資料

- **工單編號**：T0716
- **類型**：implementation
- **優先級**：P2
- **建立時間**：2026-11-01T01:41:52+0800
- **預估規模**：S

## 目標

CT v5.15.0 會把「一批 N 題時前 N-1 題用 `bat-notify.mjs --ask --no-pty-write`、最後一題 `--submit`」寫進規格。T0715 確認 BAT 現況就是這樣運作，但沒寫進契約、沒有守門測試。本單把它變成 BAT 的正式契約，並修 T0715 找到的兩個小缺口。詳細需求見 frontmatter `memory_overrides` 1–6，證據與檔案:行號見 T0715 回報區。

## 驗收條件

1. docs / CLAUDE.md / `--help` 寫明 `--ask --no-pty-write` 的語法、呼叫順序與「`terminal:notify` 不寫 PTY」保證。
2. 守門測試：`--ask --no-pty-write` 的 channel 序列；`terminal:notify` handler 不碰 PtyManager。
3. `--ask` 下 `terminal:notify` 回 `false` → 取消題目、exit 1。
4. keypress 階段失敗時 stderr 不再誤導，並多一行 `ask: NOTIFY_STEP keypress`；既有輸出行與 exit code 不變。
5. 驗證項目全綠（見 memory_overrides「驗證」）。

## 不做

- 不加 `pty:write` / keypress 佇列或去抖動（D190 Q-B2）。
- 不做一次 `--ask` 帶多題（D190 Q-B4）。
- 不由 BAT 清除塔台輸入框的預填（D190 Q-B3）。

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

**DONE**（驗收條件 1–5 全部達成；產品 commit `7b060aa4`）

### 落點檢查

- **PASS**。C-0：frontmatter `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal` → PASS。C-1：工單在 `REPO_ROOT/_ct-workorders/` 下 → PASS。C-3：前 5 個可測項目（`scripts/bat-notify.mjs`、`scripts/__tests__/bat-notify-questions.test.mjs`、`electron/__tests__/terminal-handlers.test.ts`、`CLAUDE.md`、`docs/agent-guide/tower-questions.md`）都存在 → PASS（資訊性）。C-2：沒有 `branch` 欄位（實際在 `main`）。
- `CT_HOME` 未設（不是 worktree）。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）。`CT_MODE=yolo`、`CT_INTERACTIVE=0`。

### 互動紀錄

- 無。沒有問塔台，也沒有問使用者。

### 實作摘要

1. **契約文件**（memory_overrides 1）
   - `docs/agent-guide/tower-questions.md`：語法改成 `[--submit | --no-pty-write]`。流程補上「`--no-pty-write` 時只有 `question:ask` → `terminal:notify`」，並寫明與 `--submit` 互斥、旗標位置不影響。
   - 同檔新增 🔴 保證條：`terminal:notify` 只發 `terminal:notified`，不寫 PTY、不切換分頁或焦點、不觸發 agent 回合；`notified: yes` 不代表有視窗顯示（headless 沒有 client 也回 yes）。同時寫明守門測試的位置，並新增 `ask: NOTIFY_STEP` 的說明。
   - CLAUDE.md「Worker 問塔台」節：helper 那一行補上 `[--submit | --no-pty-write]`、`false` 也算失敗、`ask: NOTIFY_STEP`。另加一條 🔴「`terminal:notify` 不得寫 PTY（CT v5.15.0 的批次提問依賴）」。這一節現在 11 行，`##` 標題沒改。
   - `docs/agent-guide/remote-tower-notify.md`：worker 列補上同一句保證。
2. **守門測試**（memory_overrides 2）
   - `bat-notify-questions.test.mjs`：
     - `--ask --no-pty-write` 的 channel 恰好是 `['question:ask', 'terminal:notify']`，exit 0，stdout 四行與 `--submit` 同格式（含 `notified: yes`），stderr 為空。旗標順序對調後結果相同。
     - `--no-pty-write` 下 `terminal:notify` 回 error → `question:cancel`、exit 1。
     - `--help` 斷言 `Can be combined with … --no-pty-write` 與 `ask: NOTIFY_STEP notify|pty-write|keypress`。
   - `terminal-handlers.test.ts`：`terminal:notify` 走過三種情況（遠端帶 questionId、本機視窗、payload 不合法），每一種都斷言 `getPtyManager` 呼叫 0 次、PtyManager Proxy 沒有任何屬性被讀到、`writes` 為空。
3. **小修 A**（memory_overrides 3）
   - `--ask` 下 `terminal:notify` 回 `false`（`result === false`，且沒有 error）時當成失敗：`question:cancel`、exit 1、`ask: NOTIFY_FAILED`、`ask: NOTIFY_STEP notify`。log 記 `send result: 'refused'`。
   - 測試涵蓋兩種組合：`--submit`，以及 `--no-pty-write`。
   - **一般 notify（不帶 `--ask`）維持現況**：照樣不看回傳值，exit 0。理由：
     - C-5 與既有設計把一般 notify 的 UI 通知失敗當成「警告後繼續預填」，改成失敗會改變一般 notify 的 exit code，屬於契約變更（memory_overrides 3 不允許）。
     - 實務上走不到：helper 送出前已經檢查 target 與非空訊息（T0715 A5）。
   - 另加測試 `a plain notify (no --ask) still ignores a false notify reply` 把現況固定下來。
4. **小修 B**（memory_overrides 4）
   - `failAfterAsk` 改為接收步驟代碼 `notify` / `pty-write` / `keypress`（`ASK_NOTIFY_STEPS` 對照到原本的標籤）。第一行 `Error: <UI notify|PTY write|terminal keypress> failed: <reason>` 不變，bat-scripts.log 的 `step` 欄位值也不變。
   - keypress 階段失敗時，stderr 改說 `The Tower got the notification and the pre-fill was written to its input box, but Enter was not sent (the text is left there); question <id> was cancelled.`（取消也失敗時接 `, and question … could not be cancelled (…); it expires at …`）。notify / pty-write 階段維持原本的 `The Tower was not notified…`。
   - 新增一行 `ask: NOTIFY_STEP <step>`，放在 `ask: NOTIFY_FAILED` **之前**，讓 `ask: NOTIFY_FAILED` 仍是 stderr 最後一行；只讀最後一行的既有呼叫者不受影響。既有每一行都沒改、沒刪，exit code 與 stdout 不變。
   - 既有的三個 notify 失敗案例加上 `NOTIFY_STEP` 與最後兩行順序的斷言，並新增「keypress 失敗＋取消也失敗」的案例。
5. **行為不變**（memory_overrides 5）
   - 一般 notify、`--wait-answer`、`--cancel-question` 都沒動。
   - 沒動：channel 順序、`SUBMIT_KEYPRESS_DELAY_MS`、`HELPER_CHANNEL_ROLES` / `HELPER_PTY_WRITE_FORBIDDEN`。
   - 主行程的 `terminal:notify` / `pty:write` / `terminal:keypress` handler 都沒改，也沒有新增 MCP tool。
   - `tests/bat-notify-submit.test.mjs` 沒有引用被改的 stderr，所以不必改。
   - 選用的 `headless-remote-tower-e2e.test.ts` 整合斷言沒做：handler 層守門加上 helper channel 序列已經涵蓋這個保證，見後續建議。

### 修改檔案

- `scripts/bat-notify.mjs`（help 文字、`ASK_NOTIFY_STEPS`、`failAfterAsk`、`--ask` 下 notify `false` 判斷）
- `scripts/__tests__/bat-notify-questions.test.mjs`
- `electron/__tests__/terminal-handlers.test.ts`
- `CLAUDE.md`（只改「Worker 問塔台（PLAN-048 / T0607）」節）
- `docs/agent-guide/tower-questions.md`
- `docs/agent-guide/remote-tower-notify.md`
- `_ct-workorders/T0716-ask-no-pty-write-contract-guard.md`（本檔）

### 驗證紀錄

驗證跑在工作樹上：HEAD `203bd8d7` 加上未 commit 的本單變更，內容與產品 commit `7b060aa4` 完全相同（commit 之後沒有再改產品檔）。

| 項目 | 結果 |
|---|---|
| `npx vitest run scripts/__tests__/bat-notify-questions.test.mjs` | PASS 26/26 |
| `npx vitest run electron/__tests__/terminal-handlers.test.ts` | PASS 34/34 |
| `npm run test:unit` | PASS：344 files、6174 passed / 3 skipped（第二次執行，見〈遭遇問題〉） |
| `npm run test:legacy` | PASS：33 files、472 tests、0 failed |
| `npm run typecheck` | exit 0（0 errors） |
| `npm run typecheck:electron` | exit 0（0 errors） |
| `npx vite build` | 成功（`✓ built`） |
| `npm run verify:helpers` | OK（6 個執行期 helper，與 server bundle 同一組） |

- 只用 repo 的 mock（`scripts/__tests__/_question-mock-remote.mjs`），沒有從本分頁對塔台或其他分頁呼叫 `bat-notify.mjs --ask`。helper 測試的 `BAT_HELPER_LOG_DIR` / `BAT_USER_DATA` 由 mock 指到各自的暫存目錄，`runHelper` 不繼承本分頁的 `BAT_*` / `CT_*`。
- 第一次單獨跑 helper 測試時，`TMP` 指到 scratchpad。
- README / CHANGELOG 沒改。

### 遭遇問題

- 第一次跑 `npm run test:unit` 時把 `TMP` / `TEMP` 指到 scratchpad（路徑很長），結果 6 個 git worktree 測試檔共 32 個測試失敗：`ct-worktree*`、`worktree-manager-env`、`worktree-status-after-close`、`headless-git`，錯誤都是 git `fatal: '$GIT_DIR' too big`。這是暫存路徑太長造成的，與本單無關。
- 改用系統預設 TMP 重跑後全綠（344/344 files）。`test:legacy` 第一次就是全綠。
- 執行期間塔台在 `main` 上 commit 了 `203bd8d7`（T0715 收尾），本單的 commit 疊在它上面，沒有衝突。

### 後續建議（給塔台）

- 回覆 CT：自 BAT 下一個預覽版起，`--ask --no-pty-write` 列為正式契約（守門測試已就位），並說明 `ask: NOTIFY_STEP` 這一行是新增的。
- 選用：日後若要在整合層再守一次，可以在 `electron/remote/__tests__/headless-remote-tower-e2e.test.ts` 加「`--ask --no-pty-write` 後塔台 PTY 輸出不含通知字串」。本單判斷 handler 單元守門已足夠，所以沒做。

### commit

- 產品：`7b060aa4`（`git commit --only` 上列 6 個產品 / 文件檔）。
- 工單：本檔另外 commit（`git commit --only`）。沒有 push。

### 回報時間

2026-11-01T01:50:08+0800
