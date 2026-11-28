---
schema_version: 1
schema_kind: workorder
id: T0966
title: "待辦分頁「👷 Worker 等你」不再把使用者自己的回答算成「待送 N 則通知」：回答與 Worker 通知分開計數與措辭，回答不計入分頁標題數字（U-58：A）"
type: feature
status: IN_PROGRESS
repo: better-agent-terminal
priority: P2
sizing: S
created_at: "2026-11-28T12:31:57+0800"
updated_at: "2026-11-28T12:34:05+0800"
started_at: "2026-11-28T12:34:05+0800"
tower_question: open
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

（Worker 填寫）
