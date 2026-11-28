---
schema_version: 1
schema_kind: workorder
id: T0965
title: "BUG-236：塔台開著原生選單時，待辦分頁的回答不得打進選單；改成 BAT 先按 Esc 關掉選單、等塔台回到輸入框再送文字（U-59：A，兩邊都能答）"
type: bugfix
status: PENDING
repo: better-agent-terminal
priority: P1
sizing: M
created_at: "2026-11-28T12:31:57+0800"
updated_at: "2026-11-28T12:31:57+0800"
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

- [ ] 回報區有原因查證（日誌摘要＋修正前失敗的測試）
- [ ] `question` → Esc → 送文字；Esc 後仍開著不送文字；`permission` / Worker 通知 / 有 draft / 非契約 2 不送 Esc（測試）
- [ ] 〈相關通過案例〉判定
- [ ] `npm run test:unit` head 第一次全綠；`npx vite build` exit 0；兩個 typecheck = 0
- [ ] 〈待實機〉步驟；docs 更新

---

## 回報區

（Worker 填寫）
