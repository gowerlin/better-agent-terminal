---
schema_version: 1
schema_kind: workorder
id: T0735
title: "工作區列表顯示「等待使用者」提示：任何 agent 分頁在等權限 / 回答時，所屬工作區出現 ⚠️，滑過列出分頁、點擊跳過去；縮圖 ⚠️ 擴及非 Worker 分頁"
type: implementation
status: IN_PROGRESS
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: M
created_at: "2026-11-01T13:00:33+0800"
started_at: "2026-11-01T13:01:58+0800"
updated_at: "2026-11-01T13:01:58+0800"
completed_at: ""
depends_on: []
related:
  - "D200（使用者 2026-11-01 第一百零二 session 提出並選定範圍）"
  - "CLAUDE.md「Worker 分頁回收」節 T0609 / BUG-153 段（⚠️ / `?` / `✓`；`workerAttention`、`TerminalAttentionNotifier`、`terminal:attention-changed`）、「blocked 狀態偵測」節（hook reason、codex `input`）、「Detached workspace 視窗的持久化」"
  - "`src/lib/terminal-attention.ts`、`src/stores/terminal-attention-store.ts`、`src/components/TerminalThumbnail.tsx`、`src/components/Sidebar.tsx`；`docs/agent-guide/worker-tab-recycle.md`、`docs/agent-guide/blocked-state.md`"
affects_files:
  - src/lib/terminal-attention.ts
  - src/stores/terminal-attention-store.ts
  - src/components/Sidebar.tsx
  - src/components/TerminalThumbnail.tsx
  - "src/ 下工作區列表相關 CSS"
  - src/locales/en.json
  - src/locales/zh-CN.json
  - src/locales/zh-TW.json
  - "electron/terminal-attention.ts（只在非 Worker 分頁目前沒有推送 attention 時）"
  - "src/**/__tests__/（純函式、store、元件測試）"
  - "e2e/（新 spec，選做，見下）"
  - CLAUDE.md
  - docs/agent-guide/worker-tab-recycle.md
  - docs/agent-guide/blocked-state.md
  - _ct-workorders/T0735-workspace-list-waiting-for-user-badge.md
renew_count: 0
tower_question: open
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 規格（D200，不得自行更改）：① 觸發只看「等待使用者」= 縮圖 ⚠️ 的同一組條件（hook `blockedReason` permission / question / elicitation，codex OSC `input`）；`?`（Worker 等塔台、`tower` reason、`pendingQuestions`）、`✓`、`↻` 都**不**觸發。② 計入的分頁：所有 agent 分頁（Claude CLI、Codex CLI、helper 派工的 Worker、一般手動開的分頁），不只 Worker；縮圖的 ⚠️ 也擴及非 Worker 分頁（Worker 分頁的 `?` / `✓` / `↻` 與批次關閉規則不變）。③ 每個工作區都顯示（含目前所在的工作區）；工作區內有 ≥ 1 個等待中的分頁就顯示 ⚠️（多個時可附數字，由你依版面決定並說明）。④ 滑過顯示等待中的分頁標題與原因（沿用既有 `workerTabs.blockedTooltip.*` 或新增 i18n），**不顯示問題內容**。⑤ 點擊 ⚠️：切到該工作區並選到等待中的分頁；有多個時選等最久的（`blockedSince` 最早，缺值排最後）；點工作區其他位置照舊只切工作區。⑥ 屬於 detached 視窗的工作區也要算：主視窗列表顯示它的 ⚠️，點擊時聚焦該 detached 視窗並選到分頁（若現有 IPC 做不到，回報說明並問塔台，不得改成在主視窗開該工作區）。"
  - "🔴 判斷唯一實作：在 `src/lib/terminal-attention.ts` 新增純函式（例如 `isWaitingForUser(attention)` 與工作區彙總），縮圖與工作區列表共用；🔴 不得在元件內聯判斷條件。先查清楚非 Worker 分頁目前是否已收到 `terminal:attention-changed`（`TerminalAttentionNotifier`），沒有的話只在主行程放寬推送範圍（只含狀態欄位、不含問題內容，比照現有規則）；本機與 headless / 遠端工作區（proxied）都要涵蓋，做不到的寫進已知限制。"
  - "🔴 行為不變：Worker 分頁的 `workerAttention` 結果、批次關閉計數（`findReportingWorkers`）、`↻` 判斷、通知 toast、`terminal:notify` 不寫 PTY 等既有規則不變；`src/stores/__tests__/workspace-store.workerAttention.test.ts` / `workspace-store.workerResumed.test.ts` 照樣通過。🔴 依全域 R-G003 第 3 點：動工前列出與改動相關、已驗收通過的案例（例如 T0609 / T0694 的 e2e `t0609-worker-attention-badge` / `t0694-worker-resumed-badge`、`t0538-worker-tab-batch-close`），改動後逐案確認仍成立，回報區列〈相關通過案例〉判定；會改變任何通過案例 ⇒ 停下問塔台。"
  - "🔴 驗證：純函式與 store / 元件測試涵蓋：只有 ⚠️ 條件觸發、`?` / `✓` / `↻` 不觸發、非 Worker 分頁也觸發、多工作區彙總、等最久的分頁排序、狀態清除後圖示消失。e2e：以隔離實例跑上列三支既有 spec 綠；新功能 e2e 以自訂 CLI 在 PTY 內呼叫 `bat-hook.mjs`（t0609 / t0694 的做法）製造 blocked，驗證另一個工作區的列表出現 ⚠️、點擊後切到該分頁（建議做；做不到寫原因）。`npm run test:unit` 全過；`npm run typecheck` = 0；`npm run typecheck:electron` = 0；`npx vite build` 成功。只用隔離實例，不得以預設實例啟動 source build；不耗 token。"
  - "🔴 UI 慣例：新增 i18n 三個語系都要有；圖示與既有縮圖 ⚠️ 視覺一致；不新增 Dialog（若有，遵守 CLAUDE.md「Dialog 不因點擊外部關閉、Esc 統一」）。CLAUDE.md 只在「Worker 分頁回收」節 T0609 段補一句（工作區列表 ⚠️、唯一實作函式），細節寫 docs，遵守檔頭撰寫規則。不發版、不改 CHANGELOG、不 push。公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」。"
  - "🔴 yolo：不得問使用者；判讀問題依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。會改變使用者可見行為而本單沒寫到的，先問塔台。Git：只用 `git commit --only` commit 自己改的檔案。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
---

# T0735 — 工作區列表顯示「等待使用者」提示

## 元資料

- **工單編號**：T0735
- **類型**：implementation
- **優先級**：P2
- **建立時間**：2026-11-01T13:00:33+0800
- **預估規模**：M

## 背景

使用者回報：分頁等待使用者回答時，縮圖會出現 ⚠️，但切到其他工作區就看不到，建議工作區列表也顯示提示。使用者選定（D200）：只看「等待使用者」狀態；所有 agent 分頁都算（縮圖 ⚠️ 也擴及非 Worker 分頁）；每個工作區都顯示（含目前所在），滑過列出分頁，點擊跳到等最久的那個分頁；detached 視窗的工作區也算。

## 範圍

1. `terminal-attention.ts` 共用判斷與工作區彙總。
2. 非 Worker 分頁的 attention 推送（若目前沒有）。
3. 工作區列表 ⚠️（tooltip、點擊跳轉、detached 視窗）；縮圖 ⚠️ 擴及非 Worker 分頁。
4. 測試、e2e、CLAUDE.md 一句、docs。

## 不做

- 不改 `?` / `✓` / `↻` 的判斷與批次關閉。
- 不加系統通知、音效、Settings 開關。

## 驗收

- [ ] D200 ①–⑥ 逐項 PASS / 未涵蓋與原因
- [ ] 〈相關通過案例〉判定（t0609 / t0694 / t0538 等仍綠）
- [ ] `test:unit` 全過、兩個 typecheck = 0、`vite build` 成功

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 待塔台決策

#### Q-1：D200 ⑥（detached 視窗的工作區）以現有程式做不到，要怎麼處理？
- 提問時間：2026-11-01T13:04:12+0800
- 現況（查證）：(1) 主視窗工作區列表把已分離的工作區整列隱藏（`src/App.tsx` `nonDetachedWorkspaces`），沒有地方放 ⚠️；(2) 主視窗 store 只有分離前的分頁，分離後在 detached 視窗新開的分頁，主視窗不知道它屬於哪個工作區、也沒有標題（`terminal:attention-changed` 只帶 tab id）；(3) 聚焦 detached 視窗可沿用 `workspace:detach`（已分離時只 `focus()`），但「在該視窗選到某個分頁」沒有 IPC。
- 選項：[A] 本單做：主視窗列表為已分離的工作區保留一列（淡化＋「已分離」標示；點列 = 聚焦該 detached 視窗，取代目前的隱藏）；attention 事件加 `workspaceId`（主行程 / headless 從 PtyInstance 帶，只是 id）；新增 IPC（main focus 該 detached 視窗並通知它選到分頁）。會超出 affects_files：`electron/main.ts`、`electron/preload.ts`、`src/types/electron.d.ts`、`src/App.tsx`、`electron/remote/headless-entry.ts`。主視窗不認得的分頁，tooltip 顯示短 ID。 / [B] 本單只做 ①–⑤，⑥ 寫進已知限制、另開後續單 / [C] 其他：________
- Worker 建議：[B]，因為 [A] 會改變主視窗列表的既有行為（已分離工作區由隱藏改為顯示），D200 沒寫到列表本身要改，且要動 main / preload / headless 與 attention 事件契約，規模超過本單 M；①–⑤ 不受影響，可先交付。若使用者確定要 ⑥，選 [A] 我在本單做完。
- 影響範圍：D200 ⑥、上列檔案、`path-aware-channels.ts` 的事件說明
- 阻塞：否（先做 ①–⑤；⑥ 等答覆）

### 完成狀態

### 互動紀錄

### 回報時間
