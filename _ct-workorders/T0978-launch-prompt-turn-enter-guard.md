---
schema_version: 1
schema_kind: workorder
id: T0978
title: "啟動參數回合（`/control-tower` 等）的 `user-prompt-submit`：信任對話框 Enter 後 2 s 內按的鍵不再被 Enter 保護窗留成草稿（T0972 Q-2 候選）"
type: bugfix
status: DONE
repo: better-agent-terminal
priority: P3
sizing: S
created_at: "2026-11-28T18:01:29+08:00"
updated_at: "2026-11-28T18:14:18+08:00"
started_at: "2026-11-28T18:04:08+08:00"
completed_at: "2026-11-28T18:14:18+08:00"
session_ids:
  - "f72bacfd-eb9a-4aab-8be9-8d062498ba85"
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

- [x] 回報區列出查證 ①②③ 的證據與「啟動參數 prompt」的判斷來源
- [x] B3 實錄時序（信任 Enter 517 ms 前）修正前保留、修正後清除；沒有啟動參數 / 第二個 submit / 300 ms 內輸入照舊保留
- [x] 〈相關通過案例〉判定
- [x] `npm run test:unit` head 第一次全綠；`npx vite build` exit 0；兩個 typecheck = 0
- [x] 〈待實機〉步驟（或隔離實例重跑結果）；docs 更新

---

## 回報區

### 完成狀態

- **狀態**：DONE（範圍內驗收全部通過；隔離實例重跑 B3 未做，列〈待實機〉）
- **session_id**：f72bacfd-eb9a-4aab-8be9-8d062498ba85
- **branch**：`ct/T0978`
- **base_sha**：`80d96e25ee407768f204cd6d3efda7172106e5bc`
- **validated_sha**：`f97383606dc7140d844ad524f46ee14ad0c1af9f`
- **head_sha**：`f97383606dc7140d844ad524f46ee14ad0c1af9f`（= validated_sha）
- **產品 commit**：`f9738360` fix: launch-prompt turn skips the 2 s Enter guard (T0978)

### 落點檢查

- **結果**：PASS
- C-0：`repo` = `better-agent-terminal`，`basename "$CT_HOME"` = `better-agent-terminal` → PASS
- C-1：工單在 `$CT_HOME/_ct-workorders/` 之下 → PASS
- C-3：抽查 `electron/notify-hold.ts`、`electron/pty-manager.ts`、`electron/handlers/`、`electron/__tests__/`、`src/lib/launch-command.ts` 都存在 → PASS
- C-2：工單沒有 `branch` 欄位，不比對
- 證據：`CT_HOME` = `D:\ForgejoGit\@Gower_Labs\BMad-Guide\better-agent-terminal\better-agent-terminal`、`CT_WORKTREE_BRANCH` = `ct/T0978`、`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`、`CT_MODE` = `yolo`、`CT_INTERACTIVE` = `0`、`BAT_REMOTE_TOKEN`：已設定

### 查證（①②③）

**① 主行程怎麼知道「這個 PTY 以啟動參數 prompt 啟動」**

- 「以塔台開啟 Claude」的啟動命令由 renderer `startClaudeCliPty`（`src/components/WorkspaceView.tsx:772-801`）組好：`towerLaunchPrompt` 只在 `launchRole === 'tower'`、非 resume、自訂參數不含 resume 類旗標時把 `TOWER_LAUNCH_PROMPT`（`/control-tower`）放在**最後一個參數**；`quoteArgForShell` 對 `/control-tower` 不加引號（`src/utils/shell-quote.ts:54`，字元全在安全集合內）；Git Bash 的 `MSYS2_ARG_CONV_EXCL` 前綴放在命令**前面**，不影響結尾。命令經 `sendLaunchCommand` → `pty:launch-command` → `PtyManager.writeLaunchCommand`（`electron/handlers/pty.ts:202-210`）。
- 判斷方式：主行程在 `writeLaunchCommand` 以 `launchCommandEndsWithPrompt(command, TOWER_LAUNCH_PROMPT)`（新函式，`src/lib/launch-command.ts`，無 import）檢查命令最後一個參數是不是 `/control-tower`（也接受單 / 雙引號形式），是 → 記 `pending`。**不新增、不改 IPC**：`pty:launch-command` 的參數與回傳不變，`onUserPromptSubmit` 的簽章與 `main.ts` / `headless-entry.ts` 接線不變（`NotifyHoldController` 經既有的 `getPtyManager()` 讀新的選用方法 `isLaunchPromptTurn`）。遠端 headless 用同一個 `PtyManager`，舊 / 新 renderer 傳來的命令字串一樣，判斷不受版本影響。
- 失敗方向是保守的：命令格式將來改了、辨識不到 → 回到舊規則（套 2 s 窗、草稿保留），不會多清。
- 沒有啟動參數的分頁（手打 `claude`、一般 Claude CLI 分頁、resume、自訂參數含 resume 類旗標）命令不以 `/control-tower` 結尾 → 不記、行為不變（測試「no launch prompt…」與純函式測試）。
- helper 派工（`writeDispatchCommand`，`electron/terminal-command-handlers.ts:682-690`）**不納入**：要讓主行程知道 agent 模式帶 prompt，得在 `TerminalCommandOptions`（也是 `terminal:create-with-command` 的 payload，agent 模式經 `invokeHandler` 重入）加欄位，屬改 IPC payload；而且 Worker 分頁不是契約 2 塔台，T0972 已說明草稿只有契約 2 塔台讀，放寬在那些分頁沒有可見差異。派工分頁照舊套 2 s 窗。

**② ⏻ 重啟、Recovery、Terminal Server 接回後的「第一個」**

- 狀態存在 `PtyManager.launchPromptTurns`（以 id 為 key，`pending` / `current`），不跟著 `PtyInstance` 複製：
  - ⏻ 重啟：`restart` → `kill` → `recordExit` 清掉舊紀錄；新 PTY 只有在 renderer 再寫一次以 `/control-tower` 結尾的啟動命令時才重新 `pending`（塔台分頁的 ⏻ 會，T0944）。測試「⏻ restart…」：舊的 `pending` 沒帶到新 PTY；新 PTY 寫入啟動命令後第一個 submit 照新規則清除。
  - PTY 結束 / kill：`recordExit` 清除。
  - Terminal Server recovery 重建：`handleServerDeath` 的重建迴圈對每個重建的 id 刪除（新 shell、沒有啟動命令）。
  - BAT 重開後接回存活的 PTY：新的 `PtyManager` 沒有紀錄、接回時也不寫啟動命令（T0403 `created: false` 不打命令）→ 不算第一個（測試「…no launch command at all (a reattached PTY)」）。
- 第一個 `user-prompt-submit`（`reportHookEvent`）把 `pending` 改成 `current`；第二個起刪掉 → `isLaunchPromptTurn` 只在第一個 submit 回報期間為真。

**③ 第一個 submit 之前使用者自己打字＋Enter，會不會多清**

- 實錄（T0970 回報區）：信任 Enter 之後 claude 0.4～0.9 s 就送出啟動參數（B3：Enter → 517 ms → hook）；R3 的對話紀錄中使用者訊息依序是 `/control-tower`、`U-1：A`、`U-2：A`，啟動參數是第一則。信任對話框開著時沒有輸入框可打訊息。
- 程式推論（沒有 claude 原始碼查證）：claude 互動模式在 REPL 掛載時就送出 argv 的 prompt；使用者在那之前打的「文字＋Enter」若被 claude 收下，也只能排在啟動參數回合之後（第二個 submit，照舊套 2 s 窗）。所以第一個 submit 之前的 Enter 不會是「使用者送出、hook 晚到」的那種 Enter。
- 已有的保護不變：hook 前 300 ms 內的任何輸入照舊保留（測試「launch-prompt turn with input within the quiet window → kept」）；括號貼上照舊。
- 殘留風險（寫進 docs 已知限制）：啟動命令沒能啟動 claude（例：找不到執行檔），使用者在同一個 shell 自己打 `claude` 送出第一則訊息時，那則仍被當成啟動參數回合；BAT 分不出這種情況。發生時最多是把「Enter 後 300 ms 以外、hook 前打的字」當成已送出而清掉。
- 判斷結論：三項都判斷得了，不需要新增 / 改 IPC、`--set-role` 契約或 helper 參數，因此沒有停下問塔台。

### 修改檔案

- `src/lib/launch-command.ts`：新增 `launchCommandEndsWithPrompt`（純函式）
- `electron/pty-manager.ts`：`launchPromptTurns`、`writeLaunchCommand` 記錄、`reportHookEvent` 標記第一個 submit、`isLaunchPromptTurn`、`recordExit` / recovery 重建清除；日誌 `[agent-command] id=<id> launch command ends with the launch prompt (launch-prompt turn pending)`
- `electron/notify-hold.ts`：`NotifyHoldPtyManager.isLaunchPromptTurn?`；`onPromptSubmitted` 在啟動參數回合不套 Enter 窗；日誌多註 `; launch-prompt turn` / `; launch-prompt turn, Enter <ms> ms before not guarded`（只記類別與毫秒，不記內容）
- `electron/__tests__/notify-hold-prompt-submit.test.ts`：改寫 T0972 Q-2 案例、新增案例、新增真 `PtyManager` 整合測試
- `src/lib/__tests__/launch-command-prompt.test.ts`（新檔）：辨識函式（以 `towerLaunchPrompt` / `towerLaunchCommandPrefix` 的實際輸出比對 pwsh / cmd / posix / Git Bash）
- `docs/agent-guide/tower-inbox.md`：「宣告契約前送出的回合」的 T0972 已知限制改寫，新增「啟動參數回合不套 2 s Enter 保護窗」一點（判斷來源、不放寬的情況、日誌、已知限制）
- `docs/agent-guide/notify-hold.md`：T0978 一句、日誌格式三行
- `CLAUDE.md`：「塔台等使用者回答時保留 Worker 通知」節在 T0964 條件的括號內補一句（標題不改）

### 測試

- 改寫：`T0972 Q-2 (intended)` → `T0978 / D516: T0970 B3 as recorded, launch-prompt turn — trust-dialog Enter 517 ms before the hook, F12 after it → cleared (kept before T0978)`
- 新增（控制器）：同時序但沒有啟動參數回合 → 保留；啟動參數回合但 hook 前 300 ms 內有輸入 → 保留；啟動參數回合但括號貼上未結束 → 保留；第二個 submit 2 s 內有 Enter → 保留
- 新增（真 `PtyManager`）：以 `/control-tower` 結尾的啟動命令 → 第一個 submit 清除、第二個 submit 照舊保留；一般啟動命令 / 沒有啟動命令（接回）→ 保留；啟動參數回合 300 ms 內有輸入 → 保留；⏻ 重啟後新 PTY 依自己的啟動命令判斷；不在執行的 PTY → false
- 修正前失敗：把 `electron/notify-hold.ts`、`electron/pty-manager.ts` 暫時換成 base 版本跑本測試檔 → `8 failed | 30 passed (38)`，失敗的是改寫的 B3 案例與依賴新方法 / 新日誌的案例；不依賴新程式的「沒有啟動參數回合 → 保留」「括號貼上 → 保留」在修正前後都通過（行為不變）。換回後全綠。
- T0964 / T0972 其他既有斷言未改。

### 驗證（head `f9738360`）

- `npm ci`：exit 0（worktree 原本沒有 `node_modules`）
- `npm run test:unit`（head 第一次完整執行）：exit 0，`Test Files 534 passed | 3 skipped (537)`、`Tests 9651 passed | 47 skipped (9698)`
- `npx vite build`：exit 0
- `npm run typecheck`：exit 0，0 個錯誤
- `npm run typecheck:electron`：exit 0，0 個錯誤
- 沒有碰使用者正在用的安裝版 BAT

### 相關通過案例

| 案例 | 判定 | 依據 |
|---|---|---|
| T0904 draft / reading / 原子送出 | 不變 | `trackDraft`、`holdReason`、`reading` 未改；只有 `onPromptSubmitted` 在啟動參數回合少一個條件 |
| T0940 單鍵例外、提示期間按鍵 | 不變 | `onUserInput` 未改 |
| T0951 launch 保留 | 不變 | `writeLaunchCommand` 的保留 / 寫入順序未改，只多一次辨識與一行日誌；`launch-input-hold.test.ts` 通過 |
| T0963 結束 launch 保留時刪清單 | 不變 | `endLaunchHold` / `dispatchInputHolds.delete` 未改 |
| T0964 300 ms / 2 s 條件、去重、診斷 | 不變（非啟動參數回合） | 既有斷言全過；只在 `isLaunchPromptTurn` 為真時不看 Enter |
| T0965 / T0966 / T0968 / T0971 選單與 Esc、Worker 區、`menu_open`、`menu-hint` | 不變 | `considerMenuEsc`、`menuEscDecision`、IPC 未改；相關測試通過 |
| T0972 所有分頁都清、只排程契約 2 塔台 | 不變；Q-2 刻意保留的案例依 D516 改為清除 | 日誌格式在非啟動參數回合逐字相同（既有 `toContain` / `toEqual` 斷言通過） |
| T0970 R1 閒置時回答立即送出 | 不變 | 沒有草稿時 `onPromptSubmitted` 直接 return |
| T0970 R2 啟動參數回合前按鍵 | 改善 | 已信任：照 T0972 清除；未信任（B3）：T0978 起清除 |
| T0970 R3 真草稿保留＋去重 | 不變 | 回合結束後打的 `abc` 不是在第一個 submit 前；第二個以後的 submit 照舊 |
| T0970 R4 保留期間不列 Worker 區 | 不變 | 未改 |
| T0970 R5 日誌不含內容 | 不變 | 新日誌只有 id、類別、毫秒 |

### 待實機

- 以本分支打包的隔離實例對**未信任**資料夾重跑 T0970 B3（`e2e/manual/ct-accept-act.mjs`、`ct610-driver.ts`，見 `e2e/manual/README.md`）：「以塔台開啟 Claude」→ 信任對話框 ↓ / Enter → 約 150 ms 後 F12 → 等 `/control-tower` 回合結束並宣告契約 2 → 待辦分頁回答 `U-1：A`。預期日誌依序有 `[agent-command] id=<分頁> launch command ends with the launch prompt (launch-prompt turn pending)`、`[notify-hold] draft cleared terminal=<分頁> (user-prompt-submit; not a contract-2 Tower yet; launch-prompt turn, Enter <ms> ms before not guarded)`，回答 `sent … reason=none`、沒有 `held … reason=draft`。本單未做（需要打包與桌面隔離實例）。

### 遭遇問題

- 無。

### 後續建議

- helper 派工帶 prompt 的分頁（例：以 `prompt` 派出 `/control-tower`）目前不放寬；若之後有契約 2 塔台由派工產生的情境，再評估在派工路徑加一個主行程內部旗標（需確認不經 `terminal:create-with-command` payload）。

### 互動紀錄

- [18:04] 開工；`CT_MODE=yolo`、`CT_INTERACTIVE=0`，未問使用者，也沒有需要問塔台的問題（①②③ 都判斷得了，未觸及 IPC / 契約 / helper 參數）。
