---
schema_version: 1
schema_kind: workorder
id: T0788
title: "修正 BUG-196：塔台在等使用者回答（權限對話框 / AskUserQuestion / codex 審批）時，主行程先保留 helper 送來的通知（文字＋Enter），使用者答完、安靜 1 s 後再送；submit Enter 不算使用者輸入"
type: implementation
status: FIXED
repo: better-agent-terminal
project: maintenance
priority: P0
sizing: L
created_at: "2026-11-02T18:24:49+0800"
started_at: "2026-11-02T18:28:18+0800"
updated_at: "2026-11-02T19:22:01+0800"
completed_at: "2026-11-02T19:22:01+0800"
session_ids:
  - "43958d6a-0dd5-4742-8ca8-89410424d0b3"
depends_on: []
related:
  - "BUG-196（high，OPEN）；T0787 回報區〈調查結論 Q1〉〈建議方向 ②〉契約草案 v0（本單依此實作，第 5 / 9 / 10 點的塔台裁示見下方）〈建議下一步 ④ (1)〉；D227；PLAN-059 子項 A"
  - "`electron/handlers/pty.ts:104`（`pty:write`）、`electron/handlers/terminal.ts:182`（`terminal:keypress`）、`src/components/TerminalPanel.tsx:599`（`dispatchEnter`，`auto` 參數已存在，T0566 用量限制續行用）、`electron/terminal-blocked-state.ts`（`TerminalBlockedTracker`）、`scripts/bat-notify.mjs`（`SUBMIT_KEYPRESS_DELAY_MS`）、`electron/remote/headless-entry.ts`"
  - "排隊原則前例：T0769（Claude 面板背景子代理執行中送出訊息：提示待送、可取消、有上限）；CLAUDE.md「Sub-agent / Active Tasks Tracking」節"
  - "CLAUDE.md「Worker 問塔台」（🔴 `terminal:notify` 不得寫 PTY）、「blocked 狀態偵測」、「Worker 分頁回收」（使用者輸入取消 `--close-worker`）、「用量限制自動繼續」（`{ auto: true }` 不算使用者輸入）、「Dialog 不因點擊外部關閉」、「遠端 Tower 通知」節"
affects_files:
  - _ct-workorders/T0788-fix-notify-hold-while-tower-blocked.md
  - _ct-workorders/BUG-196-worker-notify-answers-blocked-tower-dialog.md
  - electron/notify-hold.ts
  - electron/handlers/pty.ts
  - electron/handlers/terminal.ts
  - electron/terminal-blocked-state.ts
  - electron/pty-manager.ts
  - electron/main.ts
  - electron/preload.ts
  - electron/remote/headless-entry.ts
  - src/components/TerminalPanel.tsx
  - src/components/TerminalThumbnail.tsx
  - src/stores/**
  - src/types/**
  - src/locales/**
  - electron/__tests__/**
  - src/**/__tests__/**
  - e2e/t0787-notify-into-blocked-tower.spec.ts
  - docs/agent-guide/notify-hold.md
  - docs/agent-guide/README.md
  - CLAUDE.md
renew_count: 1
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: decision-requiring
memory_overrides:
  - "🔴 契約（依 T0787 契約草案 v0，塔台裁示 D227）：① 觸發 = helper 經 RemoteServer 呼叫（有 `ctx.helper`）的 `pty:write` / `terminal:keypress`，目標分頁 `TerminalBlockedTracker` 有 hook / osc reason（`permission` / `question` / `elicitation` / codex `input`）；`tower` reason 不觸發；`blockedDetection: none` 維持現行行為並記 `[notify-hold] skipped (detection none)`。② 保留單位：同一 helper 連線、同一目標，`pty:write` 後 2 s 內的 `terminal:keypress` 合成一筆；單獨的 `pty:write` 自成一筆。③ 保留時回 `{ ok: true, held: true }`（🔴 bat-notify / bat-terminal 的 exit code 與 stdout 完全不變）。④ 送出：離開 hook / osc blocked 後連續安靜 1 s（沒有使用者輸入、沒有新的 blocked）依序寫入（文字 → 250 ms → Enter，Enter 照舊經 renderer xterm），送出前再檢查一次 blocked。⑤ 上限（塔台暫定，CT 確認中）：每個目標最多 8 筆，第 9 筆回 `{ ok: false, reason: 'held-full' }`；每筆最長 30 分鐘，逾時丟棄並記日誌。數值集中成常數（例 `NOTIFY_HOLD_MAX_PER_TARGET` / `NOTIFY_HOLD_MAX_AGE_MS` / `NOTIFY_HOLD_QUIET_MS` / `NOTIFY_HOLD_PAIR_WINDOW_MS`），CT 回覆若不同只改常數。⑥ 提示與取消（同 T0769）：塔台分頁縮圖顯示「待送通知 N」，可展開列出來源工單與時間，逐筆取消 / 全部取消；取消只丟 PTY 寫入，toast 與 Worker ✓ 照舊。⑦ 生命週期：PTY 結束、⏻ 重啟、Terminal Server recovery 全部丟棄（記數量）；不持久化。⑧ 日誌 `[notify-hold] held|sent|cancelled|expired|dropped terminal=<id> source=<id> reason=<r> len=<n>`，🔴 不記文字內容。⑨ submit Enter 不算使用者輸入（塔台暫定，CT 確認中）：helper 觸發的 `dispatchEnter`（`reason: 'submit'` 等 helper 來源）帶 `{ auto: true }`，不清 blocked、不更新 `lastUserInputAt`、不取消 `--close-worker` 與用量限制等待。⑩ 不加 `--report-hold`（塔台暫定，CT 確認中）：本單不改 `scripts/bat-notify.mjs` 的參數與輸出。"
  - "🔴 唯一實作放 `electron/notify-hold.ts`（保留佇列、合併、上限、逾時、送出排程；不 import electron，本機與 headless 共用，比照 `electron/close-worker.ts` / `electron/usage-limit-continue.ts` 的 deps 注入）。`pty.ts` / `terminal.ts` 只接線。不改 `TerminalBlockedTracker` 的判斷規則（T0590 / T0757 / T0621），只訂閱 / 讀取。"
  - "🔴 不變的行為（不回歸）：本機視窗的使用者輸入、T0566 `{ auto: true }` 續行、`terminal:notify`（不寫 PTY，T0716）、`--ask --no-pty-write`、塔台不 blocked 時的 `--submit`（立即送出）、`blockedDetection: none` 的分頁、遠端 / headless 的 notify 流程、helper `--answer` 與問答通道、Claude 面板（T0769，不經 PTY）。動工前列出相關的已驗收 e2e / 單元測試並在回報區逐項寫判定（至少：`e2e/t0757-mouse-answer-clears-waiting.spec.ts`、`t0609-worker-attention-badge`、`t0611-tower-question`、`t0735-workspace-waiting-badge`、`t0762-claude-panel-waiting`，bat-notify / terminal-handlers / close-worker / usage-limit 的單元測試）。"
  - "🔴 UI：「待送通知 N」與取消用既有元件風格與 i18n 三語系；若用 Dialog 必須用 `ModalOverlay`＋`onEscape`＋[X]（CLAUDE.md「Dialog 不因點擊外部關閉」）；選單 / popover 照舊點外部關閉。渲染端記錄用 `window.electronAPI.debug.log`。"
  - "🔴 驗收：① `e2e/t0787-notify-into-blocked-tower.spec.ts` 由探針改為斷言（保留 `T0787_PROBE` 以外的預設可跑性：預設跑斷言版，探針模式可保留），10 情境 × 2 輪：①②①d②d⑥p⑥a → 對話框維持、假模型沒有收到 `tool_result` / 答案；使用者自己回答後通知在安靜 1 s 後送進輸入框、模型收到「T#### 完成」；③ 立即送出；④ 保留後送出預填；⑤ 不變。② 「待送通知 N」顯示與逐筆 / 全部取消。③ 單元測試：合併、上限（第 9 筆 `held-full`）、逾時、PTY 結束 / 重啟 / recovery 丟棄、送出前再檢查、`blockedDetection: none` 跳過、`tower` reason 不觸發；突變檢查（拿掉保留 → 測試失敗）。④ 實測確認 submit Enter 改 `auto` 後，塔台的 `--close-worker` 延遲與用量限制等待不再被 Worker 通知取消（BUG-196 附帶發現）。⑤ codex 塔台審批提示補測（T0787 未做；codex 分頁的 `input` reason）。⑥ `npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npm run test:unit`、`npm run test:legacy`、`npx vite build`。實測一律隔離實例（`e2e/fixtures/electron-isolation.ts`）＋假模型（`e2e/fixtures/fake-anthropic-api.ts`），真實模型花費 0，不碰使用者的 BAT 與塔台分頁。"
  - "🔴 文件：新增 `docs/agent-guide/notify-hold.md`（契約、常數、日誌、已知限制、驗證清單）、`docs/agent-guide/README.md` 索引；CLAUDE.md 新增一節（3–12 行，依 CLAUDE.md 撰寫規則 T0595：用途、必守規則、唯一實作位置、不變式、連到 docs），不改既有 `##` 標題。BUG-196 單改 FIXED（附 commit）並補〈處理紀錄〉；`_bug-tracker.md` 由塔台更新，Worker 不動。"
  - "🔴 yolo：不得問使用者；判讀 / 範圍問題依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。超出 affects_files 先問塔台。Git：只 commit 本單範圍的檔案（`git commit --only` 或明列路徑）；同一 checkout 有 T0789 並行（研究單，只會新增 `e2e/t0789-*` 與它自己的工單檔），不得碰它的檔案。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。不 push、不發版。公開 repo 去識別化（D176）。child_process 規則見 CLAUDE.md「Child Process Spawning」。"
---

# T0788 — 修正 BUG-196：塔台 blocked 時保留 Worker 通知

## 元資料

- **工單編號**：T0788
- **類型**：implementation（BUG 修正）
- **互動模式**：yolo（問題問塔台）
- **優先級**：P0
- **建立時間**：2026-11-02T18:24:49+0800
- **預估規模**：L

## 目標

BUG-196：塔台（claude-cli）停在權限對話框或 AskUserQuestion 時，Worker 的 `bat-notify --submit`（含 CT 批次提問最後一題的 `--ask --submit`）送出的 Enter 會替使用者選中預設選項，T0787 實測 30 / 30。修正後，塔台在等使用者回答時，BAT 主行程把 helper 送來的「文字＋Enter」整組保留，等使用者答完、畫面安靜 1 s 再依序送出。CT 照舊用 exit code 與 stdout 判讀，兩者不變。

## 已知資訊

- 根因：`pty:write` / `terminal:keypress` 不看目標是否 blocked。submit 的 Enter 由塔台分頁的 xterm 產生（`dispatchEnter` → xterm `onData` → renderer `pty.write`），沒有帶 `{ auto: true }`，所以主行程把它記成使用者輸入。
- 只保留 Enter、讓文字照樣送出是不夠的：T0787 情境 ④ 證實文字會被對話框吞掉，所以文字和 Enter 要整組保留。
- 防護放在主行程，不靠 helper 先查再送：先查再送有競態窗口，而且舊 helper、手動腳本、遠端 headless 也要一起受保護。
- 契約草案第 5、9、10 點目前是塔台暫定值，CT 塔台還在確認（`_handover-2026-11-02-bat-notify-hold-contract.md`）；CT 回覆若不同，由塔台 Renew 或另開小單調整常數。

## 範圍與規則

見 frontmatter `memory_overrides`。

## 互動規則

- yolo：不問使用者；判讀與範圍問題問塔台（每輪最多 3 題）。

## 塔台補充（Renew #1）

**時間**：2026-11-02T19:01:25+0800 (UTC+8)
**補充內容**：
> CT 塔台已回覆（BMad-Guide `_ct-workorders/_reply-2026-11-02-bat-notify-hold-contract.md`，CT D543）：同意「預設就保留」、第 ⑨（submit Enter 算 `auto`）與第 ⑩（不加 `--report-hold`）點，第 ⑤ 點的上限 8 筆、第 9 筆 exit 1 也同意。**逾時的兩個方案都不採用**：逾時丟棄會讓通知無聲遺失（保留時 helper 回 ok，Worker 不會走備援）；逾時照送會讓 BUG-196 重現。塔台採納 CT 建議（D228）。

**新指示**（覆蓋 frontmatter `memory_overrides` 契約第 ⑤ / ⑦ / ⑧ 點與驗收 ③ 中跟逾時有關的部分；其餘不變）：
> 1. **保留期間不設逾時**：拿掉 `NOTIFY_HOLD_MAX_AGE_MS` 與「逾時丟棄」。通知只會在以下情況離開佇列：塔台離開 hook / osc blocked 並連續安靜 1 s 後送出（第 ④ 點原樣）；使用者在「待送通知 N」取消；PTY 結束、⏻ 重啟、Terminal Server recovery 時丟棄（第 ⑦ 點原樣，記數量）。日誌事件拿掉 `expired`。
> 2. 第 9 筆照舊回 `{ ok: false, reason: 'held-full' }`。🔴 確認這條路徑：`--ask --submit` 的 PTY 寫入遇 `held-full` 時，`scripts/bat-notify.mjs` 現行的 `--ask` 失敗路徑（約 1028 行 `writeResult.ok === false` → `failAfterAsk`）會**先 `question:cancel` 已登記的題目，再 exit 1**（stderr `ask: NOTIFY_STEP pty-write`）。CT Worker 把 exit ≠ 0 當成「題目未登記」並改走工單；題目若還留在待答列表，塔台可能答兩次。請**新增測試守住**：held-full 時題目狀態為 `cancelled`、exit 1、stderr 含 `NOTIFY_STEP pty-write`。不改 bat-notify 的參數與輸出（第 ⑩ 點）；如果發現現行路徑做不到「先取消再 exit 1」，先問塔台，不要自行改 helper。
> 3. 配對（第 ② 點）的 keypress 併入已保留的那筆，不另佔名額；pty:write 已被接受時，配對的 keypress 不得回 `held-full`。補一個單元測試。

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

- **狀態**：FIXED（BUG 修正；本單範圍的驗收 ①–⑥ 都有證據，見〈驗證〉；BUG-196 待使用者實機驗收）
- **落點檢查**：PASS。C-0：`repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`，相符；C-1：工單在 `REPO_ROOT/_ct-workorders/` 下；C-3：資訊性，`affects_files` 前 5 項中可測的皆 present（`electron/notify-hold.ts` 由本單新增，上層 `electron/` 存在）；C-2：無 `branch` 欄位。`CT_HOME` 未設（不在 worktree）。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）。`CT_MODE=yolo`。
- **Commit**：產品 `94ad2b83`（主修正）、`610f592b`（Renew #1）；工單＋BUG-196 另一個 commit（hash 見 git log）。只 commit 本單範圍檔案（`git commit --only` 明列路徑）；T0789 的檔案、`_decision-log.md`、`_handover-*` 都沒碰。不 push、不發版。
- **session_id**：43958d6a-0dd5-4742-8ca8-89410424d0b3

### 互動紀錄

- [18:28] 開工（yolo）。沒有需要問塔台的判讀問題，未發 `提問`。
- [19:01] 塔台 Renew #1（D228）在執行中寫入：拿掉逾時、補 `--ask --submit` 遇 `held-full` 的守門測試、配對 keypress 不佔名額。照做（見〈產出摘要〉Renew 段）。
- （Renew #1 寫入之後）使用者要求「重讀工單」：已重讀全文（frontmatter、memory_overrides、Renew #1），對照後確認 Renew 三點的進度，接著完成第 2 點測試。
- 方法論：本單沒有 frontmatter `methodology`、沒有 `### 方法論邊界`；本 session 沒有看到方法論注入，也沒有呼叫任何方法論 skill。

### 產出摘要

**主修正（`94ad2b83`）**

- 新增 `electron/notify-hold.ts`（`NotifyHoldController`，唯一實作；不 import electron）：保留條件（`ctx.helper` 的 `pty:write` / `terminal:keypress`、目標 reason `permission` / `question` / `elicitation` / `input`；`tower` 不觸發；`none` 記 `skipped (detection none)`；已有保留項目時後到的 helper 寫入排在後面 `reason=queued`）、配對（同連線 2 s 內的 keypress 併入）、上限 8（`held-full`）、送出排程（離開 blocked 後安靜 1 s；使用者輸入重新計時；新的 blocked 停止；文字 → 250 ms → Enter，每步前再檢查 blocked；兩筆之間 250 ms）、PTY 結束 / recovery 丟棄、取消一筆 / 全部、日誌不含文字。常數 `NOTIFY_HOLD_MAX_PER_TARGET` / `NOTIFY_HOLD_QUIET_MS` / `NOTIFY_HOLD_PAIR_WINDOW_MS` / `NOTIFY_HOLD_ENTER_DELAY_MS`。
- 接線：`electron/handlers/pty.ts`（`interceptWrite`、使用者輸入 → `onUserInput`）、`electron/handlers/terminal.ts`（`interceptKeypress`，保留時記 `ipc-result … result=held`）；`electron/main.ts`（建立、`onBlockedChange` / `onPtyExit` / `onServerRecovery` 轉給它、`dispose`；保留的 Enter 經 `terminalEmit('terminal:keypress')` 與原路徑相同；本機 IPC `terminal:notify-hold-list` / `-cancel`、事件 `terminal:notify-hold-changed` 只送本機視窗）；`electron/remote/headless-entry.ts`（pty module 建立並交給 terminal module；沒有 client 時 Enter 記 `dropped (no-receiver)`）。
- 第 ⑨ 點：`src/components/TerminalPanel.tsx` 的 helper keypress `dispatchEnter` 帶 `{ auto: true }`；原本「auto 就還原焦點」拆成 `restoreFocus`，只給 T0566 用量限制續行（helper submit 的焦點行為不變）。
- UI：`src/stores/notify-hold-store.ts`、`src/components/TerminalThumbnail.tsx`（「📨 待送 N」徽章 → popover 列出工單 / 時間 / 內容種類，逐筆取消、全部取消；點外部關閉；沒有新 Dialog）、`src/types/notify-hold.ts`、`src/types/electron.d.ts`、`electron/preload.ts`、i18n `notifyHold.*` 三語系。渲染端日誌用 `window.electronAPI.debug.log`。
- 文件：新增 `docs/agent-guide/notify-hold.md`、`docs/agent-guide/README.md` 索引、CLAUDE.md 新節「塔台等使用者回答時保留 Worker 通知（T0788 / BUG-196，D227）」（7 行；未改既有 `##` 標題）。
- `scripts/bat-notify.mjs` 未改（第 ⑩ 點）；`TerminalBlockedTracker` 判斷規則未改（只讀）。

**Renew #1（`610f592b`）**

1. 拿掉 `NOTIFY_HOLD_MAX_AGE_MS` 與 `expired`：只在送出、使用者取消、PTY 結束 / ⏻ / recovery 時離開佇列。文件、CLAUDE.md 同步。
2. 新增 `electron/__tests__/notify-hold-ask-held-full.test.ts`：真的 `bat-notify.mjs --ask --submit` 跑在 mock RemoteServer 上，回覆全部來自真的 handler（`registerTowerQuestionHandlers` 的 `question:ask` / `cancel` / `list`、`registerPtyHandlers`＋已保留 8 筆的 controller 的 `pty:write`）→ 呼叫順序 `ask → notify → pty:write(held-full) → cancel`、exit 1、stderr 最後兩行 `ask: NOTIFY_STEP pty-write` / `ask: NOTIFY_FAILED`、真的 store 裡題目狀態 `cancelled`、沒有 `pending`。結論：現行 `failAfterAsk` 路徑做得到「先取消再 exit 1」，不需改 helper。
3. 配對：keypress 的配對檢查在名額檢查之前，所以永遠不回 `held-full`；新增單元測試（8 筆 write 各自的 Enter 全部併入、第 9 筆 write 才 `held-full`）。
- 另修：「待送 N」清單的工單編號改為以通知的 `--source` 優先（e2e 發現：原本顯示 Worker 分頁自己的工單）；e2e 加 hook 亂序偵測與重跑（見〈遭遇問題〉）；修一個讓 `typecheck:electron` 失敗的測試型別錯誤（`94ad2b83` 那版的測試檔有此錯誤，`610f592b` 已修）。

### 相關通過案例（不回歸判定）

| 已驗收案例 | 與改動的關係 | 判定 | 證據 |
|---|---|---|---|
| `e2e/t0757-mouse-answer-clears-waiting.spec.ts` | 滑鼠回答清 blocked；本單只讀 tracker，不改 `pty:write` 的使用者輸入判斷（本機視窗不經保留） | 成立 | 本 session 實跑 passed（PROBE test 為 opt-in skip） |
| `e2e/t0609-worker-attention-badge.spec.ts` | Worker ⚠️ / ? / ✓；`onBlockedChange` 多接一個 listener、notify 不變 | 成立 | 實跑 passed |
| `e2e/t0611-tower-question.spec.ts` | 問答通道（`question:*`、`--answer`）不經保留 | 成立 | 實跑 passed |
| `e2e/t0735-workspace-waiting-badge.spec.ts` | 縮圖新增徽章，既有 ⚠️ / 淡化不動 | 成立 | 實跑 passed |
| `e2e/t0762-claude-panel-waiting.spec.ts` | Claude 面板不經 PTY | 成立 | 實跑 passed |
| `e2e/t0566-usage-limit-continue.spec.ts` | `dispatchEnter` 的 `auto` 與焦點還原拆開，續行仍 `auto: true, restoreFocus: true` | 成立 | 實跑 passed |
| 單元：`scripts/__tests__/bat-notify-questions.test.mjs`、`tests/bat-notify-submit.test.mjs`、`electron/__tests__/terminal-handlers.test.ts`、`close-worker.test.ts`、`usage-limit-continue.test.ts`、`blocked-mouse-press.test.ts`、`terminal-blocked-state.test.ts` | bat-notify 未改；handler 只在有 `notifyHold` dep 且 `ctx.helper` 時改走保留 | 成立 | `npm run test:unit` 385 檔全過 |
| `electron/__tests__/terminal-attention.test.ts` source guard | `onBlockedChange` 由單行改成兩個呼叫 | 守門更新（意圖不變：仍守住 notifier refresh，另加 notify-hold） | 同上 |
| 塔台不 blocked 時的 `--submit`、`blockedDetection: none`、`--ask --no-pty-write`、`terminal:notify` | 不觸發保留 | 成立 | e2e ③ / ⑤ 斷言；單元「not blocked → null」「none → skipped」 |
| shell 塔台的 `--submit`（`t0575` / `t0576` / `t0592`） | shell 分頁 `blockedDetection: none` → 不保留；Enter 改 `auto` 只影響是否記為使用者輸入 | 成立（判讀，本 session 未實跑） | 程式路徑 |

沒有任何已通過案例的預期結果改變。

### 驗證

| 證據分道 | 項目 | 結果 |
|---|---|---|
| build / tests | `npm run typecheck` | 0 |
| | `npm run typecheck:electron` | 0（`610f592b`；`94ad2b83` 那版測試檔有 1 個型別錯誤，已修） |
| | `npm run test:unit` | 385 檔 / 6758 passed、10 skipped |
| | `npm run test:legacy` | 33 檔 / 472 passed |
| | `npx vite build` | exit 0 |
| | 突變檢查 | 拿掉 `pty.ts` 的 `if (held) return held` → 2 項失敗；拿掉 `terminal.ts` 的 `if (held) {…}` → 2 項失敗；還原後全過 |
| runtime smoke（隔離實例＋假模型，真實模型花費 0） | ① e2e 斷言版 10 情境 × 2 輪 | 4 次執行：第 1 次 20 / 20 情境過（UI 段發現工單編號顯示問題，已修）；第 2 次 2 passed；第 3 次 1 個情境碰到 hook 亂序（見〈遭遇問題〉）；第 4 次（最終程式碼＋亂序偵測）2 passed、races 0 |
| | ①②①d②d⑥p⑥a | 通知 exit 0、對話框維持、`claudeTurnWentOn: false`、`toolResult: null`、沒有 `cleared (user input)`；使用者自己按 Enter 作答後記 `[notify-hold] sent … part=text` / `part=enter`，模型收到「T#### 完成」/「T0787 提問」 |
| | ③ | 立即送出（模型收到），沒有 `held`，沒有 `cleared (user input)`（第 ⑨ 點） |
| | ④p ④a | 保留；作答後預填出現在輸入框，模型沒有收到 |
| | ⑤ | 不寫 PTY、沒有任何 `[notify-hold]` |
| | ② 「待送 N」 | 2 筆 → 列出 T0901 / T0902 → 取消一筆剩 1 → 全部取消徽章消失（2 行 `cancelled`）；之後作答，沒有任何 `sent`、模型沒收到 |
| | ⑤ codex 審批提示 | codex 0.166.0（官方安裝位置 `<使用者資料夾>\AppData\Local\Programs\OpenAI\Codex\bin`）＋假 Responses API：塔台 = codex 分頁停在審批（`blocked reason=input (osc)`）→ Worker `--submit` exit 0、`held … reason=input`、審批維持、codex 沒送出請求 → 視窗送 `y` 核准 → `cleared (osc …)` → `sent … part=enter` → 假模型收到「T0788 完成」。passed |
| | ④ 第 ⑨ 點 | 用量限制等待：單元（handler 層）`{ auto: true }` 的 `\r` 不呼叫 `onUserInput`（= `usageLimitScheduler.onUserInput`，唯一的取消入口）、`lastUserInputAt` 為 null、blocked 不清；e2e ③ 驗證 helper submit 後沒有 `cleared (user input)`。`--close-worker`：程式路徑查證取消條件是**被關閉的 Worker 分頁**自己的使用者輸入（`close-worker.ts` `fire` 讀 `getLastUserInputAt(<worker id>)`），塔台分頁的 submit Enter 原本就不影響它 —— BUG-196 附帶發現中這一項推論不成立（已寫進 BUG-196 與 docs）。未另做「排程 close-worker / 用量限制後送通知」的整合 e2e。 |
| | 既有 e2e 不回歸 | 見〈相關通過案例〉 |
| deployment / release / 客戶確認 | — | 未做（不發版）；BUG-196 待使用者實機驗收 |

### 遭遇問題

- **hook 回報亂序（新發現，本單不修，建議塔台另開 BUG）**：e2e 第 3 次執行的 ④p（第 2 輪）中，`[blocked]` 順序是 `→ blocked reason=permission (hook permission-request)` → `[turn] started (hook user-prompt-submit)` → `→ cleared (hook user-prompt-submit)`，對話框其實還在。claude 兩個 hook 各自是一個 `bat-hook.mjs` 程序，假模型回得極快時 `user-prompt-submit` 的回報可能晚到，把 `blocked` 清掉 → 該次通知不會被保留（若是 `--submit`，Enter 仍會作答）。量到 60 次情境中 1 次。屬 `TerminalBlockedTracker` 的既有競態（T0590 範圍，本單規定不改判斷規則）。可能方向：`user-prompt-submit` 不清除比它晚進入、同一回合的 `permission`／`question`（例：以回合或時間序判斷），需另案設計與驗收。e2e 改為偵測到就記 `RACE`、計入 `races` 並重跑該情境（最多 2 次），讓測試聚焦在保留邏輯；docs 已列為已知限制。
- 遠端 profile 視窗看不到「待送 N」：`terminal:notify-hold-*` 是 Electron 本機 IPC（加進 `PROXIED_CHANNELS` / `PROXIED_EVENTS` 需要改 `electron/remote/protocol.ts`、`path-aware-channels.ts`，不在 `affects_files`）。保留在 bat-server 上照樣生效。列為後續。
- e2e 第 1 次執行發現「待送 N」清單顯示 Worker 分頁自己的工單（T0787）而不是通知的 `--source`（T0901）→ 已改為 `--source` 優先，並補單元測試。
- 工具：一次 python 編輯把 `\n` 轉成真正換行寫進 regex 字面值（`terminal-attention.test.ts`），隨即用 Edit 改正。
- 暫存檔都在 Worker scratchpad（編輯腳本、測試日誌），不在 repo。

### 方法論狀態回寫

（本單沒有方法論；不適用）

### 回報時間

- 2026-11-02T19:22:01+0800
