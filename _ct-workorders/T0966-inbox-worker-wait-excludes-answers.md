---
schema_version: 1
schema_kind: workorder
id: T0966
title: "待辦分頁「👷 Worker 等你」不再把使用者自己的回答算成「待送 N 則通知」：回答與 Worker 通知分開計數與措辭，回答不計入分頁標題數字（U-58：A）"
type: feature
status: DONE
repo: better-agent-terminal
priority: P2
sizing: S
created_at: "2026-11-28T12:31:57+0800"
updated_at: "2026-11-28T12:41:46+0800"
started_at: "2026-11-28T12:34:05+0800"
completed_at: "2026-11-28T12:41:46+0800"
session_ids:
  - "678fb869-bd09-47a0-a886-6ad108e0871e"
target_version: "下一個預覽版（`0.8.1-pre.4`，發版前與使用者確認）"
depends_on: []
related:
  - "T0964 回報區〈「👷 Worker 等你」列出塔台分頁：判斷與建議〉；T0906（待辦分頁）；T0908 / T0942（回答與已送出標記）；T0965（同批，BUG-236）"
affects_files:
  - _ct-workorders/T0966-inbox-worker-wait-excludes-answers.md
  - src/lib/inbox-model.ts
  - src/lib/__tests__/
  - src/components/inbox/
  - src/components/InboxPanel.tsx
  - src/components/__tests__/
  - src/stores/notify-hold-store.ts
  - src/lib/inbox-answer.ts
  - src/stores/inbox-sent-store.ts
  - src/types/notify-hold.ts
  - src/locales/
  - docs/agent-guide/tower-inbox.md
renew_count: 0
isolation: worktree
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 分支：只在 `ct/T0966` 寫檔（base = 派工當下的 `main`）。不 merge / rebase / push、不動 `main`。主 checkout 只寫本工單檔（`git -C \"$CT_HOME\" commit --only _ct-workorders/<本檔>`）。"
  - "🔴 背景（T0964 判斷）：`workerWaitItems`（`src/lib/inbox-model.ts`）逐一列工作區分頁的 ⚠️ / 📨 / ⏸；📨 來自 `notify-hold-store`，保留佇列掛在目標＝塔台分頁上，所以使用者從待辦分頁送出、被保留的**回答**（`NotifyHoldItem.kind: 'answer'`）會顯示成「Claude CLI · Tower：待送 N 則通知」列在「👷 Worker 等你」，而且算進分頁標題數字（`inboxActionCount` 的 `workerItems`）。使用者裁示 U-58：A：分開計數與措辭。"
  - "🔴 要做：① 「👷 Worker 等你」只算 Worker 通知（非 `answer` 的保留項目），用語改成明確指 Worker 通知（三語系）；只有回答、沒有 Worker 通知的分頁不列在此區。② 被保留的回答只在原筆的「✓ 已排入待送」標記處呈現（T0942），標記旁補一行保留原因（沿用縮圖選單的原因文字：你在輸入 / 你在閱讀 / 等你回答對話框 / 排隊；若 T0965 新增「正在關閉選單」類原因，本單不必涵蓋，回報區註明）；原因取不到就照舊只顯示標記。③ 回答不計入待辦分頁標題數字與工作區列表的數字；Worker 通知照舊計入。④ 縮圖「📨 待送 N」與「立即送出 / 取消」行為不變。"
  - "🔴 不得改變：notify-hold 的保留 / 送出規則、`tower-inbox:answer`、`NotifyHoldController`（主行程）一律不動——本單只改 renderer 的分類、計數與文字；IPC 形狀不變。若需要主行程多送欄位才能分辨 → 停下問塔台。"
  - "🔴 不回歸（R-G003）：T0906 / T0908 / T0942 / T0761（detached 視窗等待彙總）相關案例逐一核對，回報區列〈相關通過案例〉判定；既有測試不改斷言（只能新增；若既有測試斷言的正是被改的用語或計數，先問塔台）。新增測試：只有回答 → 不列、不計數；Worker 通知＋回答 → 只算 Worker 通知；三語系字串存在。"
  - "🔴 驗證：worktree `npm ci`；`npm run test:unit` 在 head 第一次完整執行全綠（附數字）；`npx vite build` exit 0；`npm run typecheck` = 0、`npm run typecheck:electron` = 0。不碰使用者正在用的安裝版 BAT。"
  - "🔴 文件：`docs/agent-guide/tower-inbox.md` 只改〈Worker 等你〉與標題數字相關段落（T0965 同批改同檔的回答段落，不要動它們）。"
  - "🔴 Git：worktree 用 `git add <明確路徑>`；不 push、不觸發 workflow、不建 tag。禁止 `git stash`（含 list）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF；長內容用 Write / Edit（R-G005）。收單前 worktree `status --porcelain` 為空。"
  - "🔴 公開 repo（D176）。yolo：不得問使用者，判讀問題依 ct-exec § Questions For Tower 問塔台。工單狀態寫 `DONE`（L177）。"
---

# T0966 — 「Worker 等你」不再把回答算成通知（U-58：A）

## 背景

T0964 回報：使用者自己從待辦分頁送出、被保留的回答，會在「👷 Worker 等你」顯示成「Claude CLI · Tower：待送 N 則通知」，還算進分頁標題數字，容易誤會。

## 範圍

- 分類、計數、三語系用語（renderer）；回答的保留原因顯示在原筆標記旁。

## 不做

- 不改主行程保留規則與 IPC；不改縮圖待送行為；不發版。

## 驗收

- [ ] 只有回答 → 不列在「Worker 等你」、不計入標題數字（測試）
- [ ] Worker 通知照舊列出與計數；用語明確（三語系）
- [ ] 回答的「已排入待送」標記旁顯示保留原因（取得到時）
- [ ] 〈相關通過案例〉判定
- [ ] `npm run test:unit` head 第一次全綠；`npx vite build` exit 0；兩個 typecheck = 0
- [ ] 〈待實機〉步驟；docs 更新

---

## 回報區

### 待塔台決策

#### Q-1：保留原因要知道「哪一筆回答還在佇列」，需改兩個不在 `affects_files` 的 renderer 檔，可以嗎？
- **提問時間**：2026-11-28T12:38:11+0800
- **背景**：要做 ②（「已排入待送」標記旁顯示保留原因、項目離開佇列就不顯示），標記必須知道這筆回答在塔台分頁佇列中的 `holdId`。主行程 `tower-inbox:answer` 本來就回傳 `holdId`（IPC 形狀不變），但 renderer 的 `sendInboxAnswer`（`src/lib/inbox-answer.ts`）把它丟掉，已送出紀錄（`src/stores/inbox-sent-store.ts`）也沒有欄位存它。這兩個檔不在 `affects_files`。
- **選項**：
  - A：允許改這兩個檔 —— `InboxAnswerOutcome` 的 `held` 多一個選用 `holdId`、`InboxSentRecord` 多一個選用 `hold: { terminalId, holdId }`（只相加，既有呼叫與測試不變；已實作、相關測試全綠）。
  - B：不改這兩個檔 —— 只記塔台分頁 id（放在 `src/components/inbox/` 內），塔台佇列裡**有任何**回答就顯示原因；同一塔台有兩筆以上回答時，已送出的那筆也可能顯示原因（不精確）。
  - 其他。
- **建議**：A。理由：只多選用欄位、不改 IPC 與主行程；B 在多筆回答時會顯示錯誤的「仍在保留」。
- **影響**：A → `affects_files` 多 2 檔；B → ② 的顯示在多筆回答時不精確。
- **是否阻擋後續步驟**：只阻擋收單（驗證可先跑）。
- **通道**：BAT（`q-f8c5ac62-53560291875676c2`，12:38 送出、8 s 後 `answered` choice 1 = A）

### 完成狀態

- **狀態**：DONE
- **session_id**：678fb869-bd09-47a0-a886-6ad108e0871e
- **branch**：`ct/T0966`
- **base_sha**：`b389f16cd388c23d01f70de20085db2f5caa16c2`
- **validated_sha**：`737a378c09c79e97262a71938a0ff27cddbc6270`
- **head_sha**：`737a378c09c79e97262a71938a0ff27cddbc6270`（= validated_sha）
- **產品 commit**：`737a378c feat(inbox): T0966 Worker waits exclude the user's held answers (U-58: A)`（worktree `ct/T0966`，11 檔，+322 / −17）

### 落點檢查

- **結果**：PASS
- C-0：frontmatter `repo` = `better-agent-terminal`；`basename "$CT_HOME"` = `better-agent-terminal` → PASS
- C-1：工單在 `$CT_HOME/_ct-workorders/` 之下 → PASS
- C-3：抽查 `src/lib/inbox-model.ts`、`src/components/inbox`、`src/components/InboxPanel.tsx`、`src/stores/notify-hold-store.ts`、`src/types/notify-hold.ts` 在 worktree 全部存在 → PASS
- C-2：工單沒有 `branch` 欄位，不適用（目前分支 `ct/T0966`）
- 證據：`CT_HOME` = `D:\ForgejoGit\@Gower_Labs\BMad-Guide\better-agent-terminal\better-agent-terminal`、`CT_WORKTREE_BRANCH` = `ct/T0966`、`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`、`BAT_REMOTE_TOKEN` 已設定

### 結果摘要

1. **① 只算 Worker 通知**：新增純函式 `heldWorkerNotifications`（`src/lib/inbox-model.ts`），只數保留佇列中 `kind !== 'answer'` 的項目、`since` 取最舊的 Worker 通知；`useInboxModel` 的 `getHeld` 改用它。只有回答的塔台分頁 → `count: 0` → `workerWaitItems` 不產生 📨 列。沒有 `kind` 的項目（helper 通知、T0904 之前的 main）照舊算 Worker 通知。
2. **用語**：`inbox.worker.held` 改成 en `📨 {{title}}: {{count}} Worker notification(s) held`、zh-TW `📨 {{title}}：待送 {{count}} 則 Worker 通知`、zh-CN `📨 {{title}}：待发送 {{count}} 条 Worker 通知`（鍵名不變）。
3. **② 保留原因**：`tower-inbox:answer` 本來就回 `holdId`；`sendInboxAnswer` 的 `held` 結果多選用 `holdId`，已送出紀錄 `InboxSentRecord` 多選用 `hold: { terminalId, holdId }`（Q-1 塔台答 A）。「✓ 已排入待送」標記下方新元件 `HeldAnswerReason`（`src/components/inbox/InboxLists.tsx`）：該 `holdId` 仍在塔台分頁佇列、且 `useNotifyHoldReason` 有原因時顯示「保留原因：<原因>」（新鍵 `inbox.answer.heldReason`，原因文字直接用縮圖的 `notifyHoldReasonKey`，從 `src/components/TerminalThumbnail.tsx` import、未改該檔）；否則只有標記。元素在標記之外，標記文字不變（T0942 測試照舊）。批次行的工具列與每列紀錄都帶 `hold`。
4. **③ 計數**：標題數字經 `inboxActionCount({ workerItems })`，① 讓回答不再進 `workerItems`；回答的那一筆在 ⏸ / 🙋 清單照常計數。工作區列表的數字是 `⏸N`（`useInboxAwaitingCount`，只算 `awaiting_user`），本來就不含待送項目，不需改；`WorkspaceWaitingBadge`（`waitingSummary`）不讀 notify-hold。
5. **④ 不變**：縮圖 `TerminalThumbnail.tsx` 的「📨 待送 N」（`useNotifyHold` 全部項目）、「立即送出 / 取消」、主行程 `NotifyHoldController`、`tower-inbox:answer` / `terminal:notify-hold-*` 形狀都沒改。
6. **T0965 新原因**：本單沒有涵蓋 T0965 可能新增的「正在關閉選單」類原因。若 T0965 在 `NotifyHoldReason` 加新值，`notifyHoldReasonKey` 對未知值回 `notifyHold.reasonPrompt`（等你回答對話框），標記旁會顯示這段文字；要精確顯示需在 `notifyHoldReasonKey` 補對應（與縮圖同一處）。

### 變更檔案

| 檔案 | 變更 |
|---|---|
| `src/lib/inbox-model.ts` | 新增 `heldWorkerNotifications`；`inboxActionCount` 註解 |
| `src/components/inbox/useInboxModel.ts` | `getHeld` 改用 `heldWorkerNotifications` |
| `src/components/inbox/InboxLists.tsx` | 送出時記 `hold`；新增 `HeldAnswerReason` |
| `src/lib/inbox-answer.ts` | `held` 結果帶選用 `holdId`（Q-1：A） |
| `src/stores/inbox-sent-store.ts` | `InboxSentRecord.hold?`（Q-1：A；仍只在記憶體） |
| `src/locales/{en,zh-TW,zh-CN}.json` | `inbox.worker.held` 改字、新增 `inbox.answer.heldReason` |
| `src/lib/__tests__/inbox-model-t0966.test.ts` | 新增（5 項） |
| `src/components/__tests__/inbox-worker-wait-t0966.test.tsx` | 新增（10 項：只有回答、混合、沒有 `kind`、4 種原因、無原因 / 離開佇列、舊 host、三語系） |
| `docs/agent-guide/tower-inbox.md` | 區塊表〈Worker 等你〉列、標題數字一行、新小節〈Worker 等你不含你的回答（T0966，U-58：A）〉 |

### 驗證證據（在 `validated_sha` = head 執行）

| 項目 | 結果 |
|---|---|
| `npm ci`（worktree） | exit 0 |
| `npm run test:unit`（head 第一次完整執行） | exit 0：Test Files 525 passed / 3 skipped（528）；Tests 9471 passed / 42 skipped（9513） |
| `npx vite build` | exit 0 |
| `npm run typecheck` | exit 0（0 錯誤） |
| `npm run typecheck:electron` | exit 0（0 錯誤） |

- commit 前另在同一份工作樹內容上跑過一次完整 `test:unit`（525 passed / 3 skipped；9466 passed / 47 skipped）與兩個 typecheck、build，全部通過；skipped 數不同是環境相關的略過（第二次 Electron binary 已就緒）。上表以 head 那次為準。
- 既有測試沒有改任何斷言；`inbox-panel.test.tsx` 的 Worker 等你案例（項目沒有 `kind`，標題 `5`）照舊通過。

### 相關通過案例判定

| 案例 | 判定 |
|---|---|
| T0906 待辦分頁區塊順序、Worker 等你 ⚠️ / 📨 / ⏸、標題數字 | 成立：沒有 `kind` 的保留項目照舊列出與計數（`inbox-panel.test.tsx` 未改、通過）；只有 `kind: 'answer'` 不再算 |
| T0908 回答送出路徑（`tower-inbox:answer`、`held` / `sent` 結果、`⏸N`） | 成立：IPC 與主行程不變；`held` 只多選用 `holdId`；`inbox-w5.test.tsx` 通過 |
| T0942 已送出 / 已排入待送標記、重新送出、remount、清除 | 成立：標記文字與屬性不變，原因是標記外的另一元素；`inbox-sent-t0942.test.tsx`、`inbox-sent-store.test.ts` 未改、通過 |
| T0761 detached 視窗等待彙總 | 不受影響：彙總走 `waitingSummary` / `DetachedWaitingReporter`，不讀 notify-hold；相關測試通過 |
| T0904 縮圖「📨 待送」原因與「立即送出」 | 不受影響：`TerminalThumbnail.tsx` 未改；`notify-hold-reason-menu.test.tsx` 通過 |

### 待實機

1. 契約 2 塔台分頁，在塔台輸入框打字不送出（`draft`）→ 從待辦分頁回答一筆 ⏸：該筆顯示「✓ 已排入待送：…」＋下一行「保留原因：你在輸入：…」；「👷 Worker 等你」**沒有**塔台那一列；側欄「待辦」標題數字不因這筆回答增加。
2. 清掉塔台輸入框（Ctrl+C）→ 回答送出後，保留原因那一行消失、標記仍在，直到塔台處理掉該筆。
3. 讓一個 Worker 在塔台 `draft` 時 `bat-notify --submit` → 「👷 Worker 等你」出現「📨 Tower：待送 1 則 Worker 通知」且計入標題；同時有回答保留時數字只算 Worker 通知。
4. 塔台縮圖「📨 待送 N」= 佇列全部項目（含回答），「立即送出 / 取消」照舊。

### 遭遇問題

- `bat-notify.mjs --ask` 的 stdin 第一次送純文字，回 `ask: INVALID_INPUT`（exit 1、未登記），改送 JSON 後成功；工單〈待塔台決策〉沒有標「通道：工單」，因為第二次已在 BAT 通道成功。

### 後續建議

- T0965 若新增保留原因值，同步在 `notifyHoldReasonKey`（`src/components/TerminalThumbnail.tsx`）補對應，縮圖與待辦標記會一起正確。
- CLAUDE.md「右側欄「待辦」分頁」節未提 T0966（本單 `affects_files` 不含 CLAUDE.md）；塔台若要，可在該節補一句「📨 只算 Worker 通知（`heldWorkerNotifications`）」。

### 互動紀錄

- [12:34] 開工；落點 PASS；worktree `npm ci` exit 0
- [12:38] Q-1：保留原因需改不在 `affects_files` 的 `src/lib/inbox-answer.ts`、`src/stores/inbox-sent-store.ts` → A（塔台）：選 A，只加選用欄位、IPC 與主行程不變，兩檔已補進 `affects_files`，已送出紀錄仍只在記憶體 → Action：保留已實作的 A，刪除 `tower_question`
- [12:40] 產品 commit `737a378c`；為讓 `validated_sha` = `head_sha`，在 head 重跑 `test:unit`、兩個 typecheck、build，全部通過

## 塔台收單補記

- 2026-11-28 12:43 (UTC+8) 收單：DONE 確認（`validated_sha` = `head` = `737a378c`；`--worktree-status` 五條全成立：`main` 自 base 只多 `_ct-workorders/**`、`outOfScopeFiles` 空（含 Q-1 補的兩檔）、`conflicts` 空、`dirty` 空）。`--close-worker --delay-ms 10000 --worktree keep` exit 0。
- 模式 ①：整合 worktree `ct-merge/T0966` = `d76ec16e`（parent1 `6031a363` = 當下 `main`、parent2 `737a378c`；產品樹與 `737a378c` 相同）。斷點 E → U-60（D483）。後續建議「T0965 新原因值補 `notifyHoldReasonKey`」已寫進 T0965〈塔台補充（執行中 #1）〉；CLAUDE.md 補一句留到發版前一併處理。
- 2026-11-28 12:46 (UTC+8) U-60：A → `ct-merge/T0966` 再合併 `main` 後 ff：`main` = `64b39176`，產品樹 = `737a378c`；整合 worktree detach；worktree 手動移除；分支 `ct/T0966`、`ct-merge/T0966` 保留（D485）。
