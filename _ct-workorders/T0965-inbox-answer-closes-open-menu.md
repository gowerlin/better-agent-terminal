---
schema_version: 1
schema_kind: workorder
id: T0965
title: "BUG-236：塔台開著原生選單時，待辦分頁的回答不得打進選單；改成 BAT 先按 Esc 關掉選單、等塔台回到輸入框再送文字（U-59：A，兩邊都能答）"
type: bugfix
status: DONE
repo: better-agent-terminal
priority: P1
sizing: M
created_at: "2026-11-28T12:31:57+0800"
started_at: "2026-11-28T12:34:03+0800"
updated_at: "2026-11-28T12:47:34+0800"
completed_at: "2026-11-28T12:47:34+0800"
session_ids:
  - "3e6c5d69-fd9b-4eb7-a3ea-cf8120a44c54"
target_version: "下一個預覽版（`0.8.1-pre.4`，發版前與使用者確認）"
depends_on: []
related:
  - "BUG-236；BUG-235 / T0964（`main` `ee5d364f`，回答被 draft 擋）；BUG-196 / T0788（對話框保留）；T0904 / T0908（契約 2 回答路徑）；BUG-224 / T0926（AskUserQuestion 晚到的 hook）；T0966（同批，`Worker 等你` 用語）"
affects_files:
  - _ct-workorders/T0965-inbox-answer-closes-open-menu.md
  - electron/notify-hold.ts
  - electron/terminal-blocked-state.ts
  - electron/pty-manager.ts
  - electron/handlers/
  - electron/main.ts
  - electron/remote/headless-entry.ts
  - electron/__tests__/
  - src/lib/tower-input-draft.ts
  - src/lib/tower-submit-enter.ts
  - src/components/TerminalThumbnail.tsx
  - src/locales/
  - src/lib/__tests__/
  - e2e/manual/
  - docs/agent-guide/tower-inbox.md
  - docs/agent-guide/notify-hold.md
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
  - "🔴 分支：只在 `ct/T0965` 寫檔（base = 派工當下的 `main`，已含 T0964）。不 merge / rebase / push、不動 `main`。主 checkout 只寫本工單檔（`git -C \"$CT_HOME\" commit --only _ct-workorders/<本檔>`）。"
  - "🔴 現象（使用者實機，`0.8.1-pre.3`，2026-11-28 12:23–12:25）：契約 2 的 Claude CLI 塔台以 AskUserQuestion 開了兩題選單（U-57、U-58），同時列在待辦分頁。使用者 12:24 在待辦分頁送出 `U-57：A`，該筆顯示「✓ 已送出」（`sent`，不是 `held`）；終端選單 U-57 被打勾、游標到 U-58；塔台最後收到的選單結果是兩題都「放棄」，與使用者選的 A 不同。使用者原話：「兩邊都呈現選單時，似乎只能由終端輸入，能否能任由哪邊輸入都可」。"
  - "🔴 第一步查證（先做、回報區摘要）：讀本機 `%APPDATA%\\BetterAgentTerminal\\Logs` 同日最新 `debug-*.log`（只讀），塔台分頁 `f32bfa46…` 在 04:23–04:26Z 的 `ask-user-question` / `permission-request` hook、`TerminalBlockedTracker` 狀態、`[notify-hold]`、`[tower-inbox] answer … → sent|held`：為什麼選單開著時回答沒有被保留（hook 沒來 / 晚到、AskUserQuestion 在 hook 狀態裡被清掉、使用者輸入或滑鼠清掉了 `question`（T0757 / T0926）、或 `enqueueAnswer` 判斷漏了）。以單元測試重現（修正前失敗）。"
  - "🔴 新行為（使用者裁示 U-59：A）：契約 2 塔台分頁（`towerContractStatus` match）是 `blocked` 且 reason = `question`（claude AskUserQuestion）時，待辦分頁送來的回答（`enqueueAnswer`，只限回答、不含 Worker 通知）→ BAT 以 `{ auto: true }` 送一個 Esc 關掉選單 → 等 `question` 清除＋安靜（沿用 `NOTIFY_HOLD_QUIET_MS`），再照既有路徑送出 `U-n：…` 文字與 Enter。Esc 後在上限時間內（例 3 s，常數集中在 `notify-hold.ts`）沒有離開 `question` → 不送文字、保留在待送並記日誌，絕不把文字打進仍開著的選單。CT 端不用改：Esc 後塔台本來就接受文字回答，同一選單的其他題留在待辦分頁。"
  - "🔴 不得改變：`permission` / `elicitation` / codex `input` reason 一律照舊保留（Esc 在權限框等於拒絕工具，不可代按）；Worker 通知（helper `pty:write` / `terminal:keypress`）照舊保留、不觸發 Esc；非契約 2 或非塔台分頁行為逐字不變；`draft` 規則（含 T0964 的 `user-prompt-submit` 清除）不變——使用者正在選單的「Type something」輸入框打字（判成 draft 或最近 N 秒內有使用者輸入）時不送 Esc、照舊保留；面板塔台（Claude Agent 面板）路徑不改，只在回報區寫現況與建議。BAT 送的 Esc 不算使用者輸入（不更新 `lastUserInputAt`、不清 ⚠️、不取消用量限制等待）。"
  - "🔴 去重與已送出標記沿用 T0964 / T0942；回答因 Esc 流程等待時仍回 `held`（畫面「已排入待送」），送出後照舊。"
  - "🔴 不回歸（R-G003）：T0788 / BUG-196（Worker 通知不替塔台作答）、T0904 / T0908 / T0926 / T0940 / T0942 / T0964 的通過案例逐一核對，回報區列〈相關通過案例〉判定；既有測試不改斷言（只能新增）。新增回歸測試：修正前失敗、修正後通過；涵蓋 `question` → Esc → 送出、Esc 後仍 blocked 不送文字、`permission` 不送 Esc、Worker 通知不送 Esc、有 draft 不送 Esc、非契約 2 不變。能以隔離實例＋假 claude（T0955 / T0963 的做法）實測 AskUserQuestion 就做；做不到寫明並列〈待實機〉。"
  - "🔴 驗證：worktree `npm ci`；`npm run test:unit` 在 head 第一次完整執行全綠（附數字）；`npx vite build` exit 0；`npm run typecheck` = 0、`npm run typecheck:electron` = 0。🔴 不碰使用者正在用的安裝版 BAT（不安裝、不關閉、不改它的 userData）。"
  - "🔴 文件：`docs/agent-guide/tower-inbox.md`（回答 / `enqueueAnswer`）、`notify-hold.md`、`blocked-state.md` 補新規則；CLAUDE.md「塔台等使用者回答時保留 Worker 通知」節只補一句（標題不改，T0595）。T0966 同批也會改 `tower-inbox.md` 的〈Worker 等你〉相關段落：只改自己的段落，避免動到不相關的段落。"
  - "🔴 Git：worktree 用 `git add <明確路徑>`；不 push、不觸發 workflow、不建 tag。禁止 `git stash`（含 list）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF；長內容用 Write / Edit，不用 heredoc（R-G005）。收單前 worktree `status --porcelain` 為空。"
  - "🔴 公開 repo（D176）：程式、註解、測試資料、回報區不寫真名、客戶名、外部專案名、家目錄路徑。yolo：不得問使用者，判讀問題依 ct-exec § Questions For Tower 問塔台；修法需要超出上列範圍（例：改 `tower-inbox:answer` 契約、改 CT）→ 問塔台。工單狀態寫 `DONE`（L177）。"
---

# T0965 — 選單開著時待辦分頁也能作答（BUG-236，U-59：A）

## 背景

塔台用原生選單提問時，同一題也列在待辦分頁。使用者在待辦分頁回答，回答卻被當按鍵打進選單，選單結果變成「放棄」。使用者希望兩邊都能答。裁示 U-59：A：選單開著時，BAT 先按 Esc 關掉選單，等塔台回到輸入框再把 `U-n：…` 當文字送出。

## 範圍

- 查證這次為什麼沒有保留（日誌＋單元測試重現）並修正。
- `question` reason 時的 Esc → 等清除 → 送文字流程；其他 reason 與 Worker 通知照舊保留。
- 回歸測試、文件、〈待實機〉。

## 不做

- 不改 CT；不改 `tower-inbox:answer` 契約；不改面板塔台路徑；不發版。

## 驗收

- [x] 回報區有原因查證（日誌摘要＋修正前失敗的測試）
- [x] `question` → Esc → 送文字；Esc 後仍開著不送文字；`permission` / Worker 通知 / 有 draft / 非契約 2 不送 Esc（測試）
- [x] 〈相關通過案例〉判定
- [x] `npm run test:unit` head 第一次全綠；`npx vite build` exit 0；兩個 typecheck = 0
- [x] 〈待實機〉步驟；docs 更新

## 塔台補充（執行中 #1）

> 2026-11-28 12:43 (UTC+8)，T0966 收單後補充。範圍與驗收不變，只多一個允許改的檔。

- T0966（`ct/T0966` `737a378c`，即將合併進 `main`）讓待辦分頁「✓ 已排入待送」標記旁顯示保留原因，原因文字取自 `notifyHoldReasonKey`（`src/components/TerminalThumbnail.tsx`，縮圖與待辦分頁共用）；不認得的原因值會顯示成「等你回答對話框」。
- 若本單在 `NotifyHoldReason` 新增原因值（例：正在關閉選單），**允許**在 `notifyHoldReasonKey` 補對應與三語系字串（`src/components/TerminalThumbnail.tsx`、`src/locales/`），已補進 frontmatter `affects_files`；沒有新增原因值就不用動。
- 合併說明（不用你處理）：T0966 先合併，本單收單後塔台會派合併工單或依 `--worktree-status` 判斷；兩單只在 `docs/agent-guide/tower-inbox.md` 不同段落重疊。

---

## 回報區

### 完成狀態

- **狀態**：DONE
- **完成時間**：2026-11-28T12:46:41+0800
- **session_id**：3e6c5d69-fd9b-4eb7-a3ea-cf8120a44c54
- **branch**：`ct/T0965`
- **base_sha**：`b389f16cd388c23d01f70de20085db2f5caa16c2`
- **validated_sha**：`e5a0ad16ba3601b2fc27e15fac831198c0d311e4`
- **head_sha**：`e5a0ad16ba3601b2fc27e15fac831198c0d311e4`（與 validated_sha 相同）

### 落點檢查

- PASS。C-0：`repo` = `better-agent-terminal`，`basename "$CT_HOME"` = `better-agent-terminal`。C-1：工單在 `$CT_HOME/_ct-workorders/` 下。C-3：資訊性，`affects_files` 都存在。C-2：工單沒有 `branch` 欄位，目前分支 `ct/T0965`。
- `CT_HOME` = 主 checkout，`CT_WORKTREE_BRANCH` = `ct/T0965`，`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）。`CT_MODE` = yolo、`CT_INTERACTIVE` = 0。

### 原因查證（只讀本機 `debug-20261128-115756.log`，塔台分頁 `f32bfa46…`）

| 時間（Z） | 日誌 |
|---|---|
| 04:24:16.454 | `[blocked] → blocked reason=question (hook ask-user-question)` |
| 04:24:16.558 | 第二個 hook（`permission-request` tool=AskUserQuestion）到達，`unchanged`（沒有轉換行） |
| 04:24:20.808 | `[blocked] → cleared (mouse press)`：分頁內一次滑鼠左鍵按下（同一刻有 `focus regain … → looked at`，判斷是點回視窗或點了選單）清掉 `question`（T0757 規則）；**選單仍開著**，此後沒有任何 `ask-user-question-done` |
| 04:24:25.978 | `[notify-hold] answer … (sending)` → `sent … reason=none part=text len=6` → 04:24:26.242 `part=enter` |
| 04:25:59.514 | `stop`（回合結束） |

- 結論：不是 hook 沒到或晚到，也不是 `enqueueAnswer` 漏判；是**滑鼠按下清除 `question` 後選單還開著**，BAT 沒有任何紀錄能知道選單還在，回答的 `holdReason` 為 null 而直接寫入。鍵盤輸入（方向鍵、多題選單的第一題）也會造成同樣的狀況。
- 修正前失敗的測試：把 4 個原始碼檔暫時換回 base 版本（先備份到 scratchpad，跑完放回；沒有用 git stash / restore）後跑 `electron/__tests__/notify-hold-question-menu.test.ts`：**17 failed / 11 passed**。失敗的包含實際時序的端到端重現〈AskUserQuestion, a click 5 s before, the answer from the inbox …〉，修正前回答是直接寫入。修正後 28/28 通過。

### 修正內容

1. **Tracker 另記「選單可能還開著」**（`electron/terminal-blocked-state.ts`，`questionMenus`、`hasOpenQuestionMenu` / `closeQuestionMenu`）：這個紀錄與 `blocked` 分開。
   - 開啟：設定或維持 `question` 的 hook。
   - 關閉：`ask-user-question-done` / `stop` / `user-prompt-submit` / 主執行緒的 `post-tool-batch`（`at` 較早的不算）、使用者單獨按 Esc 或 Ctrl+C、BAT 的 Esc、PTY 結束、recovery。
   - 🔴 `blocked`、⚠️、所有查詢回傳不變。
2. **PtyManager**：`noteUserInput(id, data)`（`pty.ts` 傳入按鍵，讓 Esc / Ctrl+C 能關閉紀錄）、`hasOpenQuestionMenu`、`closeQuestionMenu`。
3. **NotifyHoldController**（`electron/notify-hold.ts`）：
   - 契約 2 塔台的回答在 `question`，或只剩選單紀錄時保留，回 `held`，保留原因 `question`。
   - `considerMenuEsc`：沒有 draft、2 s 內沒有使用者輸入或點擊、1 s 內沒有輸出時，寫一個 Esc（`writeWithResult`，不算使用者輸入）。
   - Esc 之後有輸出 → `menuEscAnswered` → `closeQuestionMenu`，等 `NOTIFY_HOLD_QUIET_MS` 後照既有路徑送文字與 Enter。
   - 3 s 內沒有輸出 → 不送文字、留在待送、記 `menu esc no effect`。同一筆回答只送一次 Esc。
   - 常數集中在同檔：`NOTIFY_HOLD_MENU_ESC_MAX_MS` 3 s、`NOTIFY_HOLD_MENU_INPUT_QUIET_MS` 2 s、`NOTIFY_HOLD_MENU_OUTPUT_QUIET_MS` 1 s。
   - 選單紀錄還在時，契約 2 塔台的單鍵比照 T0940 案 A（`isPromptShown`），方向鍵不算草稿。測試抓到：修正初版時方向鍵被當成 draft，Esc 永遠不送。
   - 「立即送出」：仍是 `question` 時不放行（同 T0788）；只剩選單紀錄（可能已過期）時放行。
   - 沒有新增 `NotifyHoldReason` 值，所以塔台補充 #1 允許的 `notifyHoldReasonKey` / locales 不需要改。
4. 不需要改 `main.ts` / `headless-entry.ts`：controller 經 `getPtyManager()` 取得新方法，兩個 host 原本就把 `onPtyOutput` / `onBlockedChange` 接到 controller。

### 檔案

- `electron/notify-hold.ts`、`electron/terminal-blocked-state.ts`、`electron/pty-manager.ts`、`electron/handlers/pty.ts`
- 新增 `electron/__tests__/notify-hold-question-menu.test.ts`（28 項）
- `docs/agent-guide/tower-inbox.md`：新增〈選單開著時的回答（T0965 / BUG-236，U-59：A）〉一節，插在〈回答路徑〉之後，沒有動 T0966 的段落。
- `docs/agent-guide/notify-hold.md`：一段。
- `docs/agent-guide/blocked-state.md`：〈AskUserQuestion 選單紀錄〉一項。
- `CLAUDE.md`：在「塔台等使用者回答時保留 Worker 通知」節補一句（標題不改）。

### 驗證（head `e5a0ad16`）

- worktree `npm ci`：exit 0。
- `npm run test:unit`：在 head 第一次完整執行就全綠，**524 files passed / 3 skipped，9479 tests passed / 47 skipped**，exit 0。
- `npx vite build`：exit 0。
- `npm run typecheck` = 0；`npm run typecheck:electron` = 0（以 `tsc` 的 exit code 確認）。
- 既有測試沒有改任何斷言。
- 新測試涵蓋：
  - `question` → Esc → 輸出 → 送出；Esc 後沒有輸出 → 不送文字、不送第二個 Esc，之後使用者作答再送。
  - 點擊後只剩選單紀錄（回報的情境）。
  - 2 s 內有輸入或點擊、1 s 內有輸出時，Esc 會等。
  - 有 draft 不送 Esc；`permission` / `elicitation` / `input` 不送 Esc。
  - Worker 通知：在 `question` 時照舊保留、不送 Esc；只剩紀錄時照舊直接送。
  - 非契約 2 不變；沒有新方法的 host 照舊保留。
  - 「立即送出」；日誌不含回答文字。
  - tracker 紀錄的開啟與關閉各規則；真 PtyManager 端到端：BAT 的 Esc 不更新 `lastUserInputAt`；使用者在選單作答或自己按 Esc 時照舊直接送出、BAT 不送 Esc。
- 不碰安裝版 BAT：只讀它的日誌，沒有安裝、關閉或改 userData。

### 相關通過案例判定

| 案例 | 判定 |
|---|---|
| T0788 / BUG-196：Worker 通知不替塔台作答 | 成立。Worker 通知的保留與送出路徑沒改，`notify-hold.test.ts` 全過（含「使用者在 AskUserQuestion 打字後，通知於 1 s 安靜後送出」）；Esc 只對回答。 |
| T0904：draft / reading / 原子送出 | 成立。`draft` 判斷不變；選單紀錄只影響契約 2 塔台在紀錄期間的單鍵（比照案 A）。`notify-hold-contract-tower.test.ts` 全過。 |
| T0908：回答路徑、`tower-inbox:answer` 契約 | 成立。IPC 與回傳形狀不變（`held` 照舊），`tower-inbox-answer.test.ts` 全過。 |
| T0926 / BUG-224：晚到的 AskUserQuestion hook | 成立。`blocked-late-question-hook.test.ts` 全過；BAT 的 Esc 關閉時走同一個 `clearAnswered` 紀錄，晚到的第二個 hook 不設回（有新測試）。 |
| T0940 / BUG-227：不進輸入框的按鍵 | 成立，並擴充：`notify-hold-single-key.test.ts` 全過。選單紀錄還在時的單鍵也不算草稿（只對契約 2 塔台）。 |
| T0942：已送出標記 | 成立。renderer 沒改，`held` → 「已排入待送」照舊。 |
| T0964 / BUG-235：`user-prompt-submit` 清草稿、去重 | 成立。`notify-hold-prompt-submit.test.ts` 全過；`lastInputAt` 沒改（點擊另記在 `lastTouchAt`）。 |
| T0757：滑鼠回答清除 ⚠️ | 成立。`blocked-mouse-press.test.ts` 全過；`blocked` 照舊被清除，只是選單紀錄留著。 |

### 待實機（使用者，需裝有本修正的版本）

1. 契約 2 的 Claude CLI 塔台開 AskUserQuestion（兩題）。待辦分頁出現同一題時，先在終端點一下（或按方向鍵），等 3 s 以上再到待辦分頁送 `U-n：A`。預期：先顯示「已排入待送」，約 2–3 s 內選單關閉，塔台收到文字 `U-n：A`，另一題留在待辦分頁。debug log 依序有：
   - `[notify-hold] menu esc terminal=… (menu still open)`
   - `menu esc answered`
   - `[blocked] … question menu closed (BAT Esc)`
   - `sent … part=text`
2. 同上，但選單剛出現、沒有碰終端就從待辦分頁回答 → `menu esc … (question)`，結果同上。
3. 在選單的「Type something」打字途中從待辦分頁回答 → 打字期間不送 Esc（日誌 `menu esc waits … (input|draft)`）。
4. 確認 Esc 中斷 AskUserQuestion 後，claude 的輸入框是空的（若把上一則提示放回輸入框，回答會接在後面 → 回報）。
5. 確認選單開著時 PTY 沒有定時輸出（若有，日誌會一直停在 `menu esc waits … (output)`，回答要等使用者在終端作答）。
- 沒有做隔離實例＋假 claude 的實測：本機沒有能重現 claude AskUserQuestion 選單畫面與 Esc 行為的假 CLI，Esc 後 claude 的反應只能以真 claude 確認。

### 遭遇問題

- 第一版實作中，選單紀錄期間的方向鍵被 `trackDraft` 當成 draft，Esc 永遠不送（新測試抓到）。改成選單紀錄也算 `isPromptShown`（T0940 案 A）後解決。

### 互動紀錄

- [12:43] 📥 塔台補充（執行中 #1）於〈驗證前〉讀到（塔台跨 session 訊息提示）→ 沒有新增 `NotifyHoldReason` 值，`TerminalThumbnail.tsx` / `src/locales/` 不需要改；frontmatter `affects_files` 已含這兩個路徑，沒有使用。

### 後續建議（給塔台）

- 只剩選單紀錄、`question` 已被清除時，Worker 通知仍照 T0965 前直接寫入，所以可能打進仍開著的選單（與 BUG-236 同一個成因，但不在本單範圍：本單規定 Worker 通知照舊）。如果要處理，需要另外決定：保留它（風險是紀錄過期時通知會卡住）還是比照回答送 Esc。
- 面板塔台（Claude Agent 面板）：現況是回答放進面板輸入框、走面板自己的 `handleSend`，面板的權限卡或提問卡不會被當成按鍵回答，所以沒有這個問題；本單沒有改。

### Commit

- 產品：`e5a0ad16`（`ct/T0965`）。工單：在主 checkout 以 `git commit --only` 提交本檔。

## 塔台收單補記

- 2026-11-28 12:48 (UTC+8) 收單：DONE 確認（`validated_sha` = `head` = `e5a0ad16`；`outOfScopeFiles` 空、`conflicts` 空、`dirty` 空）。`--close-worker --delay-ms 10000 --worktree keep` exit 0。`main` 自 base 起已併入 T0966 產品改動 → 判準 1 不成立 → 派合併工單 T0967（模式 ①，`git merge-tree` 試合併無衝突）（D486）。
- 後續建議兩項記入塔台待辦：只剩選單紀錄時 Worker 通知仍可能打進選單；面板塔台不受影響（只記錄）。
