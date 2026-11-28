---
schema_version: 1
schema_kind: workorder
id: T0964
title: "BUG-235：查出待辦分頁的回答在塔台閒置時仍被排進「待送」、要等使用者自己送出下一則訊息才送達的原因並修正"
type: bugfix
status: IN_PROGRESS
repo: better-agent-terminal
priority: P1
sizing: M
created_at: "2026-11-28T12:02:15+0800"
updated_at: "2026-11-28T12:12:28+0800"
started_at: "2026-11-28T12:04:05+0800"
target_version: "下一個預覽版（`0.8.1-pre.4`，發版前與使用者確認）"
depends_on: []
related:
  - "BUG-235；T0904（PLAN-068 W1+W2 通知保護 draft / reading）；T0908（待辦分頁回答 `tower-inbox:answer`）；T0940（BUG-227 不進輸入框的按鍵）；T0942（已送出標記，D412）；T0963（BUG-234 launch 保留）"
affects_files:
  - _ct-workorders/T0964-inbox-answer-held-until-next-enter.md
  - electron/notify-hold.ts
  - electron/handlers/
  - electron/pty-manager.ts
  - electron/__tests__/
  - src/lib/
  - src/components/inbox/
  - src/components/
  - src/stores/
  - src/__tests__/
  - e2e/manual/
  - docs/agent-guide/
  - CLAUDE.md
renew_count: 0
isolation: worktree
worker_question_timeout: 30
tower_question: open
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 分支：只在 `ct/T0964` 寫檔（base = 派工當下的 `main`）。不 merge / rebase / push、不動 `main`。主 checkout 只寫本工單檔（`git -C \"$CT_HOME\" commit --only _ct-workorders/<本檔>`）。"
  - "🔴 現象（使用者實機，`0.8.1-pre.3`，2026-11-28 12:00）：塔台（契約 v2 的 Claude CLI 塔台分頁，回合已結束、沒有權限框或 AskUserQuestion）閒置時，在右側欄「待辦」分頁按 A-25 的「完成」→ 該筆顯示「✓ 已排入待送：A-25：完成（12:00）」，「👷 Worker 等你」區出現「Claude CLI · Tower：待送 2 則通知」。回答沒有送到塔台；使用者在塔台分頁自己打字送出下一則訊息後，兩則 `A-25：完成` 才在塔台回合進行中一起送到。使用者原話：「無法送出」。"
  - "🔴 先查證、再改：① 讀本機 `%APPDATA%\\BetterAgentTerminal\\Logs` 中 2026-11-28 11:57 之後的 `debug-*.log`（例 `debug-20261128-115756.log`；只讀、不刪、不改），找塔台分頁 `f32bfa46…` 在 11:59–12:02 的 `[notify-hold] held … source=answer reason=…`、`[tower-inbox] answer … → held`、`sent` 與 draft 相關紀錄，確認保留的 reason 與它何時被設；回報區只摘要、不貼權杖或家目錄路徑。② 依 reason 追 `trackDraft`（`src/lib/tower-input-draft.ts`）/ `NotifyHoldController`（`electron/notify-hold.ts`）/ `pty.ts` 的使用者輸入判斷：哪一筆「使用者輸入」讓塔台被判成有草稿（候選，皆未查證：claude 開焦點回報 DECSET 1004 時 xterm 失焦 / 取得焦點送的 `ESC[I` / `ESC[O`——點待辦分頁就會讓塔台 xterm 失焦；滾輪 / 滑鼠回報；括號貼上；launch 保留期間的輸入；BAT 開塔台時 `/control-tower` 啟動參數之後沒有使用者 Enter）。③ 以單元測試或隔離實例重現（契約 2 塔台分頁＋回答送出）。重現不了 → 寫明試過的條件並問塔台，不要猜著改。"
  - "🔴 修正：找到原因後修在唯一實作處（`trackDraft` / `NotifyHoldController` 等，依 CLAUDE.md）。原則：終端自動回應（焦點回報、滑鼠 / 滾輪回報等 `isTerminalAutoReply` 一類）不得改變草稿狀態；真的打了字（含貼上、多字元）照舊保留——不得為了讓回答送出而放寬「輸入框有字就保留」的保護（BUG-196 / T0904 的目的）。修法需要改 `enqueueAnswer` 的保留規則（例：回答不受 draft 擋）或改契約 → 停下問塔台。"
  - "🔴 去重（同單處理）：同一個塔台的待送佇列裡已有**完全相同**的回答行時，再按一次不再排入第二筆（回傳仍為 `held`，畫面照舊「已排入待送」），日誌記一行（只記 id / 長度，不記內容）。已送出之後的「重新送出」維持 T0942 / D412（不攔）。若這會改到既有測試斷言 → 停下問塔台。"
  - "🔴 只回報、不改：「👷 Worker 等你」區把塔台自己的分頁（待送 N 則通知）列進去——判斷這是設計還是誤列，回報區寫結論與建議，不在本單改。"
  - "🔴 不回歸（R-G003）：T0904 / T0908 / T0940 / T0942 的通過案例（draft 保留、reading 不擋回答、單鍵調查列、已送出標記、立即送出）逐一核對改動後預期仍成立，回報區列〈相關通過案例〉判定；既有測試不改斷言（只能新增）。新增回歸測試：修正前失敗、修正後通過。"
  - "🔴 驗證：worktree `npm ci`；`npm run test:unit` 在 head 第一次完整執行全綠（附數字）；`npx vite build` exit 0；`npm run typecheck` = 0、`npm run typecheck:electron` = 0。🔴 不碰使用者正在用的安裝版 BAT（不安裝、不關閉、不改它的 userData）；隔離實例一律用自己的 userData 與 runtime。"
  - "🔴 文件：`docs/agent-guide/tower-inbox.md`（S1 草稿判斷 / 回答）與 `notify-hold.md` 補原因與修正；CLAUDE.md 只在需要時補一句，小節標題不改名（T0595）。"
  - "🔴 Git：worktree 用 `git add <明確路徑>`；不 push、不觸發 workflow、不建 tag。禁止 `git stash`（含 list）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF。收單前 worktree `status --porcelain` 為空。"
  - "🔴 公開 repo（D176）：程式、註解、測試資料、回報區不寫真名、客戶名、外部專案名、家目錄路徑（例路徑用 `C:\\Users\\demo`）。yolo：不得問使用者，判讀問題依 ct-exec § Questions For Tower 問塔台。工單狀態寫 `DONE`（L177）。"
---

# T0964 — 待辦分頁的回答卡在「待送」（BUG-235）

## 背景

使用者在 `0.8.1-pre.3` 從待辦分頁回答 A-25（「完成」），塔台閒置，回答卻被排進「📨 待送」，直到使用者自己在塔台分頁送出下一則訊息才送到（而且送了兩次）。回答路徑 `tower-inbox:answer` → `enqueueAnswer` 只受 prompt reason 與 `draft` 擋，所以最可疑的是塔台被誤判成「輸入框有草稿」。

## 範圍

- 讀本機日誌確認保留的 reason 與觸發來源；以單元測試或隔離實例重現。
- 修正誤判（不放寬真正的草稿保護）；相同回答在待送佇列去重；加回歸測試。
- 「Worker 等你」列出塔台自己的分頁：只判斷、回報建議。

## 不做

- 不碰安裝版 BAT；不發版；不改 `enqueueAnswer` 的保留規則與 `tower-inbox:answer` 契約（需要時問塔台）。

## 驗收

- [ ] 回報區有原因查證（日誌摘要：reason 與觸發輸入）
- [ ] 修正＋回歸測試（修正前失敗、修正後通過）；真的打了字仍保留
- [ ] 相同回答不重複排入待送（測試）
- [ ] 〈相關通過案例〉判定（T0904 / T0908 / T0940 / T0942）
- [ ] 「Worker 等你」列出塔台分頁的判斷與建議
- [ ] `npm run test:unit` head 第一次全綠；`npx vite build` exit 0；兩個 typecheck = 0
- [ ] 〈待實機〉步驟；docs 更新

---

## 回報區

### 待塔台決策

#### Q-1：重現不了「draft」的觸發來源，要怎麼處理 BUG-235 的修正部分？
- **提問時間**：2026-11-28T12:12:28+0800
- **已查證**：
  - 本機日誌（`debug-20261128-115756.log`）：塔台 `f32bfa46` 在 03:59:15Z（12:00 前約 1 分鐘）被關掉重開（新 PTY，`draft` 隨 `onPtyExit` 清空）；03:59:16Z claude 以 `/control-tower` 啟動參數開回合、03:59:37Z `--set-role` 契約 2 `match`、04:00:14Z `stop`；04:00:17Z 回答 `held … reason=draft`。這段期間沒有任何貼上 / 拖放 / 語音 / 右鍵選單 / reading 紀錄；04:01:08Z 使用者送出訊息（`\r` 清掉 draft）後兩筆依序送出。
  - claude transcript（只看形狀、不看內容）：03:59:17Z 之後到 04:01:08Z 沒有任何使用者訊息或排隊訊息，`permission-mode` 一直沒變（排除 Shift+Tab）。
  - 實驗：以 node-pty（ConPTY）擷取內嵌 claude 的啟動輸出，加上 fullscreen 的模式（1049 / 1000 / 1002 / 1003 / 1006 / 2004 / 1004 / 2031）餵給真的 xterm 5.5：焦點、DA1 / DA2、DSR、CPR、DECRQM、OSC 10 / 11、DECRQSS、滾輪 / 移動 / 點擊回報全部被 `isTerminalAutoReply` 濾掉，不會進 `trackDraft`。工單列的候選（焦點回報、滑鼠 / 滾輪回報、launch 保留、`/control-tower` 啟動參數）都排除。
  - 剩下會讓 `trackDraft` 判成 draft、又不會在日誌留下痕跡的只有使用者真的按的鍵：↑ / ↓（claude 叫出歷史，T0904 設計上算 draft）、Tab、Alt + 鍵、F5–F12（`CSI 15~` 以上）、輸入法在失焦時送出組字、或任何字元。日誌無法分辨是哪一個。
- **選項**：
  - A（推薦）：不改 `trackDraft` 規則；在 `NotifyHoldController.onUserInput` 於 draft 由無變有時記一行診斷日誌（只記類別，例 `printable` / `csi:A` / `ss3:B` / `alt-key` / `csi~:15` / `paste` / `tab` 與位元組數，不記內容），去重照做，BUG-235 留在 OPEN（或 FIXED 待實機）等下次發生時以日誌定位；本單狀態依規則會是 `PARTIAL`（「修正＋回歸測試」未達成）。
  - B：A ＋ claude 塔台收到 `user-prompt-submit` hook 時清掉 draft（輸入框剛被送出，清掉是正確的）。只涵蓋「draft 在送出前就設了」的情況，本次若是回合中按的鍵就修不到。
  - C：把 ↑ / ↓ 改成不影響 draft（不再保留）。會放寬「叫出歷史後回答被併進去」的保護，沒證據前不建議。
  - 其他：塔台請使用者回想 12:00 前在塔台分頁按過哪些鍵，再決定。
- **影響**：決定修正部分怎麼做與本單結案狀態；去重、「Worker 等你」判斷、文件不受影響（先做）。
- **是否擋住後續步驟**：擋住修正與回歸測試；其他步驟先做。
- **塔台答覆 Q-1**：（BAT 通道 `q-f8c5ac62-dc1c9ed0ff79aabc`，12:13 收到）選 B，附 5 點補充（見〈互動紀錄〉）。

#### Q-2：B 的接線要動 `electron/main.ts` 與 `electron/remote/headless-entry.ts`（不在 `affects_files`），可以嗎？
- **提問時間**：2026-11-28T12:16:48+0800
- **說明**：`user-prompt-submit` 由 `PtyManager.reportHookEvent` 處理；我在 `PtyManager` 加了選用 dep `onUserPromptSubmit`（`electron/pty-manager.ts`，範圍內），要把它接到 `notifyHold.onPromptSubmitted`，只能在建立 `PtyManager` 的兩處各加一行（與既有 `onPtyOutput` → `notifyHold.onPtyOutput` 同位置、同寫法）。不加的話 headless / 本機都不會生效。
- **選項**：
  - A（推薦）：允許這兩檔各加一行接線，其他不動。
  - B：不允許 → 改在 `electron/handlers/pty.ts` 以 setter 掛上（`PtyManager` 多一個 `setUserPromptSubmitListener`），較繞、不建議。
  - 其他
- **影響**：修正能否在本機與 headless 生效。
- **是否擋住後續步驟**：擋住接線；其他（單元測試、去重、文件）先做。
