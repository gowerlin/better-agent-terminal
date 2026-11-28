---
schema_version: 1
schema_kind: workorder
id: T0978
title: "啟動參數回合（`/control-tower` 等）的 `user-prompt-submit`：信任對話框 Enter 後 2 s 內按的鍵不再被 Enter 保護窗留成草稿（T0972 Q-2 候選）"
type: bugfix
status: PENDING
repo: better-agent-terminal
priority: P3
sizing: S
created_at: "2026-11-28T18:01:29+08:00"
updated_at: "2026-11-28T18:01:29+08:00"
session_ids: []
target_version: "下一個預覽版（`0.8.1-pre.6`，發版前與使用者確認）"
depends_on: []
related:
  - "T0972（Q-2：照範圍收單、刻意保留；回報區〈後續建議〉）；T0964（`onPromptSubmitted`、300 ms / 2 s 條件）；T0970（B3 實錄：信任 Enter 距 hook 517 ms）；BUG-235（CLOSED）；D503；D516（U-72：B）"
affects_files:
  - _ct-workorders/T0978-launch-prompt-turn-enter-guard.md
  - electron/notify-hold.ts
  - electron/pty-manager.ts
  - electron/handlers/
  - electron/__tests__/
  - src/lib/launch-command.ts
  - src/lib/__tests__/
  - docs/agent-guide/tower-inbox.md
  - docs/agent-guide/notify-hold.md
  - CLAUDE.md
renew_count: 0
isolation: worktree
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 分支：只在 `ct/T0978` 寫檔（base = 派工當下的 `main`）。不 merge / rebase / push、不動 `main`。主 checkout 只寫本工單檔（`git -C \"$CT_HOME\" commit --only _ct-workorders/<本檔>`）。"
  - "🔴 現況（`electron/notify-hold.ts` `onPromptSubmitted`，約 558 行）：有草稿、不在括號貼上時，hook 前 `NOTIFY_HOLD_SUBMIT_QUIET_MS`（300 ms）內有輸入、或 `NOTIFY_HOLD_SUBMIT_ENTER_GUARD_MS`（2 s）內有 Enter → 草稿保留（`draft kept … Enter <n> ms before`）。2 s Enter 窗保護的情況：使用者自己打字＋Enter 送出，接著又打新的字，hook 比新打的字晚到——BAT 分不出先後，所以保留。T0970 B3 實錄（T0972 Q-2）：首次開未信任資料夾 → 信任對話框 Enter → 159 ms → F12 → 358 ms → 啟動參數 `/control-tower` 的 `user-prompt-submit`（Enter 距 hook 517 ms）→ 草稿保留 → 回合結束後第一筆待辦分頁回答 `held … reason=draft`。T0972 有一條刻意保留的測試（名稱含 `T0972 Q-2 (intended)`）記錄這個行為。"
  - "🔴 使用者裁示（U-72：B，D516）：處理這個情況，允許只對**啟動參數回合**放寬 2 s Enter 保護窗（推翻 T0972 Q-2 的「本單不放寬」，僅限下列範圍）。方向（T0972 Q-2 選項 B）：分頁的 PTY 是以啟動參數 prompt 啟動（例：「以塔台開啟 Claude」的 `towerLaunchPrompt`、helper 派工帶 prompt 的 agent 命令），而且這是該 PTY 生命週期內第一個 `user-prompt-submit` → 不套 2 s Enter 窗；300 ms 輸入窗、括號貼上條件照舊。理由：第一個 submit 之前的 Enter 不可能是「使用者送出的 prompt、hook 晚到」，因為那個 hook 就是這一個。"
  - "🔴 先查證再改（回報區逐條列證據）：① 主行程如何可靠地知道「這個 PTY 有啟動參數 prompt」（例：`pty:launch-command` / `writeLaunchCommand` / `writeDispatchCommand` 時記下；或 renderer `sendLaunchCommand` 帶旗標）——沒有啟動參數的分頁（使用者手打 `claude`、啟動參數不含 prompt、resume）第一個 submit 可能就是使用者自己的 Enter，🔴 這些分頁行為不得改變；② ⏻ 重啟、Recovery、Terminal Server 接回後的「第一個」怎麼算（新 PTY 重新計；接回的舊 PTY 不算第一個）；③ 第一個 submit 之前若使用者自己在輸入框打字＋Enter（claude 在啟動回合處理前就可以排入訊息嗎？以 claude CLI 實際行為或既有實錄判斷），放寬會不會把該清不該清的草稿清掉。任一項判斷不了、或需要新增 / 改變 IPC channel、`--set-role` 契約、helper 參數 → 停下問塔台。"
  - "🔴 不得改變：300 ms 輸入窗；括號貼上；非啟動參數回合（第二個以後的 submit）的 2 s Enter 窗；`draft` 判定（`trackDraft`、單鍵例外、提示期間按鍵）；`enqueueAnswer` 保留規則；T0965 / T0968 / T0971 的選單與 Esc 流程；Worker 通知保留；`tower-inbox:answer` / `tower-inbox:menu-hint` 契約；`holdInputForLaunch` / `writeLaunchCommand` 的保留與刪除規則（BUG-234 / T0963：結束 launch 保留時一律刪掉保留清單）。日誌只記類別、長度、id，不記內容。"
  - "🔴 測試：改寫 T0972 的 `T0972 Q-2 (intended)` 案例為「啟動參數回合：信任 Enter 517 ms 前 → 清除」（名稱註明 T0978 / D516，修正前失敗）；新增：同時序但分頁沒有啟動參數 prompt → 照舊保留；第二個 submit（非啟動參數回合）2 s 內有 Enter → 照舊保留；啟動參數回合但 hook 前 300 ms 內有輸入 → 照舊保留；⏻ 重啟後新 PTY 的第一個 submit 照新規則。T0964 / T0972 其他既有斷言不改。"
  - "🔴 不回歸（R-G003）：T0904 / T0940 / T0951 / T0963 / T0964 / T0965 / T0966 / T0968 / T0971 / T0972 相關案例與 T0970 R1–R5 逐一核對，回報區列〈相關通過案例〉。"
  - "🔴 驗證：worktree `npm ci`；`npm run test:unit` 在 head 第一次完整執行全綠（附數字）；`npx vite build` exit 0；`npm run typecheck` = 0、`npm run typecheck:electron` = 0。不碰使用者正在用的安裝版 BAT。可選：以 T0970 驅動（`e2e/manual/ct-accept-act.mjs`、`ct610-driver.ts`，見 `e2e/manual/README.md`）在本分支打包的隔離實例對**未信任**資料夾重跑 B3；做不到列〈待實機〉。"
  - "🔴 文件：`docs/agent-guide/tower-inbox.md`（「claude 取走輸入框時清掉草稿」一節與 T0972 已知限制改寫）、`notify-hold.md`；CLAUDE.md「塔台等使用者回答時保留 Worker 通知」節只在需要時改一句（標題不改，T0595）。"
  - "🔴 Git：worktree 用 `git add <明確路徑>`；不 push、不觸發 workflow、不建 tag。禁止 `git stash`（含 list）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF；長內容用 Write / Edit（R-G005）。收單前 worktree `status --porcelain` 為空。"
  - "🔴 公開 repo（D176）。yolo：不得問使用者，判讀問題依 ct-exec § Questions For Tower 問塔台。工單狀態寫 `DONE`（L177）。"
---

# T0978 — 啟動參數回合不套 2 s Enter 保護窗

## 背景

T0972 修好「宣告契約前送出的草稿也要清」，但依 Q-2 刻意保留一個情況：第一次開未信任的資料夾時，使用者在信任對話框按 Enter 後 2 s 內又按了鍵，啟動參數回合送出後草稿仍被 2 s Enter 保護窗留下，回合結束後第一筆待辦分頁回答進「待送」（還能手動送出）。使用者 2026-11-28 裁示處理（U-72：B，D516），允許只對啟動參數回合放寬。

## 範圍

- 主行程記下「這個 PTY 以啟動參數 prompt 啟動」，該 PTY 第一個 `user-prompt-submit` 不套 2 s Enter 窗。
- 測試（改寫 T0972 Q-2 刻意保留案例、新增不變案例）、文件。

## 不做

- 不改 300 ms 輸入窗、括號貼上、非啟動參數回合的判斷；不改契約與 IPC 形狀（需要時先問塔台）；不發版。

## 驗收

- [ ] 回報區列出查證 ①②③ 的證據與「啟動參數 prompt」的判斷來源
- [ ] B3 實錄時序（信任 Enter 517 ms 前）修正前保留、修正後清除；沒有啟動參數 / 第二個 submit / 300 ms 內輸入照舊保留
- [ ] 〈相關通過案例〉判定
- [ ] `npm run test:unit` head 第一次全綠；`npx vite build` exit 0；兩個 typecheck = 0
- [ ] 〈待實機〉步驟（或隔離實例重跑結果）；docs 更新

---

## 回報區

（Worker 填寫）
