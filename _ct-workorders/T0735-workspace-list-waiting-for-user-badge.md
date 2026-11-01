---
schema_version: 1
schema_kind: workorder
id: T0735
title: "工作區列表顯示「等待使用者」提示：任何 agent 分頁在等權限 / 回答時，所屬工作區出現 ⚠️，滑過列出分頁、點擊跳過去；縮圖 ⚠️ 擴及非 Worker 分頁"
type: implementation
status: DONE
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: M
created_at: "2026-11-01T13:00:33+0800"
started_at: "2026-11-01T13:01:58+0800"
updated_at: "2026-11-01T13:25:52+0800"
completed_at: "2026-11-01T13:25:52+0800"
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

**DONE**（D200 ①–⑤、D202 ①–③、D203 ①–⑥ 與塔台補充的「塔台分頁 AskUserQuestion」案例都完成並驗證；D200 ⑥ 依塔台 Q-1 答覆 [B] 不做，寫進已知限制）

- 產品 commit：`b4daaf1f` feat(attention): waiting-for-user ⚠️ on every tab and in the workspace list (T0735)
- 驗證時的工作樹 = `b4daaf1f` 的內容，只差 commit 前補的一處：`src/components/Sidebar.tsx` 檔尾多一行空白，已刪掉（`git diff --check` 抓到，不影響行為）

#### 落點檢查

- C-0：PASS（frontmatter `repo` = `better-agent-terminal`；`basename(REPO_ROOT)` = `better-agent-terminal`）
- C-1：PASS（工單在 `REPO_ROOT/_ct-workorders/` 底下）
- C-3：PASS，只做紀錄（`affects_files` 前幾項都存在）
- C-2：工單沒有 `branch` 欄位，所以沒比對（目前在 `main`）
- `CT_HOME` 未設定，不是 worktree 隔離；`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只是紀錄）

#### 查證結論：主行程不用改

- `TerminalAttentionNotifier`（`electron/terminal-attention.ts`）本來就對**每個** PTY 推送，沒有 Worker 過濾。
- 非 Worker 分頁的範圍權杖是 `tower` 角色（`electron/remote/helper-capability.ts:192`），`terminal:report-hook` 允許 `tower` / `worker` 兩種角色（`:419`）。
- 手動開的 claude-cli 分頁會注入 hooks，「以塔台開啟 Claude」的塔台分頁也一樣（renderer `withBatMcpLaunchArgs`，需 `batMcpEnabled`，預設開）。
- 所以塔台分頁的 `PreToolUse(AskUserQuestion)` → `blocked` / `question` 原本就會推到 renderer。`electron/terminal-attention.ts` 不用動，e2e 也實測確認（見下）。

#### D200 / D202 / D203 逐項

| 項目 | 結果 | 依據 |
|---|---|---|
| D200 ① 只有「等待使用者」會觸發（hook permission / question / elicitation，codex `input`）；`?` / `✓` / `↻` 不觸發 | PASS | `waitingForUser`，`workerAttention` 第一個分支改呼叫它，結果不變；單元測試 `terminal-attention-waiting.test.ts` |
| D200 ② 所有分頁都算；非 Worker 縮圖也顯示 ⚠️ | PASS | 縮圖 `.attention-badge.blocked`；Worker 標籤（`?` / `✓` / `↻`、批次關閉）不變；`worker-tab-attention.test.tsx`、e2e |
| D200 ③ 每個工作區都顯示（含目前所在）；多個分頁在等時附數字 | PASS | 列 badge `⚠️` / `⚠️ N`（≥ 2 才附數字）；元件測試 |
| D200 ④ 滑過列出分頁標題與原因，不顯示問題內容 | PASS | tooltip 用 `workerTabs.blockedTooltip.*`；元件測試核對全文 |
| D200 ⑤ 點 ⚠️ 切工作區並選到等最久的分頁；點列的其他位置只切工作區 | PASS | `focusWaitingTab`、`waitingClickTarget`；元件測試、e2e |
| D200 ⑥ detached 視窗的工作區 | **未涵蓋（塔台 Q-1 答 [B]）** | 見下方已知限制 (a) |
| 塔台補充：塔台分頁（非 Worker）在 AskUserQuestion 時，另一個工作區的列表看得到 ⚠️，`-done` 後消失 | PASS | 單元：`sidebar-waiting-badge.test.tsx` 第一案、`worker-tab-attention.test.tsx`（`Claude CLI · Tower` 分頁，`question`）。e2e：非 Worker 分頁在自己的 PTY 內跑 `bat-hook.mjs ask-user-question` → 另一個工作區的列出現 ⚠️ → `ask-user-question-done`。依 D203，沒人看時變淡化，分頁被看（active＋視窗有焦點）時才消失，兩段都有驗。註：e2e 的分頁是 raw command 開的非 Worker 分頁（權杖同為 `tower` 角色），不是真的 `launchRole: 'tower'` claude-cli（e2e 不啟動 LLM）；hook → 推送 → renderer 這條路徑相同 |
| D202 ① 列右側、狀態點左邊，同一行；藍底的 active 列也看得清楚 | PASS | `.workspace-item-actions` 第一個子元素（e2e 斷言 DOM 順序）；active 列改深色底（截圖 `active-row-badge.png` 目視確認） |
| D202 ② 「工作區」頁籤標題旁顯示總數；點擊只切回頁籤；滑過列出工作區名稱與數量 | PASS | `WaitingTotalBadge`；元件測試、e2e（Control Tower 停駐左側時） |
| D202 ③ 側欄收合時窄列顯示，點擊展開 | PASS | 📂 下方 `WaitingTotalBadge`（只在收合時顯示）；元件測試、e2e。不需要問塔台：收合窄列一直都在 |
| D202 三處共用同一個彙總函式 | PASS | `waitingSummary`（元件經 `useWaitingSummary`） |
| D203 ① 等待中 = 實心 | PASS | — |
| D203 ② 結束時沒看過 → 淡化，四處都顯示；tooltip「hh:mm 曾等待你回應，已結束」，時間用 renderer 收到開始事件的時間 | PASS | `.missed`；`workerTabs.missedTooltip`；`nextWaitMemory` 用 renderer `Date.now()` |
| D203 ③ 「看過」= active 分頁＋視窗有焦點；結束當下正在看 → 清除；失焦時結束 → 淡化，回到視窗並 active 後清除；分頁關閉 → 清除 | PASS | `isViewedTerminal`、`setViewingState`（App：`focusedTerminalId` + `document.hasFocus()`，focus / blur 時重算）、`retainTerminals`；store 測試六種情境；e2e 有取得視窗焦點（`document.hasFocus() = true`），「正在看時結束不留淡化」有實測 |
| D203 ④ 彙總時實心優先，數字只算等待中的；淡化不附數字；點淡化 → 跳到開始等待最早的分頁 | PASS | `waitingMarkKind`、`waitingClickTarget`；測試 |
| D203 ⑤ 狀態只在 renderer 記憶體；判斷寫成純函式 | PASS | `terminal-attention.ts` 純函式；狀態在 `terminal-attention-store.ts` |
| D203 ⑥ 測試涵蓋六種情境 | PASS | `terminal-attention-store.missed.test.ts` |

#### 我自己決定的設計（D202 / D203 允許）

- **淡化的 ⚠️ 不附數字**：讓它不搶眼，只表示「有錯過的」；實心才帶數字。
- **點淡化的提示時，跳到開始等待最早的分頁**：和實心「等最久的」同一個方向；看過之後下一個再浮上來。
- **頁籤標題的 ⚠️ 不論停在哪個頁籤都顯示**（D202 ② 的字面「任一工作區有分頁在等就出現」）。停在工作區頁籤時，它和列上的 ⚠️ 會同時看到。
- **Worker 分頁的淡化 ⚠️ 加在它自己的標籤旁邊**，Worker 標籤本身（`?` / `✓` / `↻`）不變。
- **點列上的 ⚠️ 也會切回終端頁籤**（送 `workspace-switch-tab`，和點縮圖一樣），不然分頁停在檔案等頁籤時看不到選到的分頁。

#### 異動檔案

- 產品：`src/lib/terminal-attention.ts`、`src/stores/terminal-attention-store.ts`、`src/components/TerminalThumbnail.tsx`、`src/components/Sidebar.tsx`、`src/components/WorkspaceWaitingBadge.tsx`（新）、`src/App.tsx`、`src/styles/panels.css`、`src/locales/{en,zh-TW,zh-CN}.json`（新 key：`sidebar.waitingForUser*` 8 個、`workerTabs.missedTooltip`）
- 測試：`src/lib/__tests__/terminal-attention-waiting.test.ts`（新）、`src/stores/__tests__/terminal-attention-store.missed.test.ts`（新）、`src/components/__tests__/sidebar-waiting-badge.test.tsx`（新）、`src/components/__tests__/worker-tab-attention.test.tsx`（改）、`e2e/t0735-workspace-waiting-badge.spec.ts`（新）
- 文件：`CLAUDE.md`（「Worker 分頁回收」節加一行）、`docs/agent-guide/worker-tab-recycle.md`（新增 T0735 條，並更正原本「非 Worker 不顯示」那句）、`docs/agent-guide/blocked-state.md`（一行）
- 主行程沒有改（`electron/**` 0 個檔）

#### 驗證

| 關卡 | 結果 |
|---|---|
| `npm run test:unit` | PASS — 357 個檔、6326 passed / 3 skipped |
| `npm run typecheck` | 0 |
| `npm run typecheck:electron` | 0 |
| `npx vite build` | 成功 |
| e2e（隔離實例，跑之前先 `npx vite build`） | PASS 4/4：`t0735-workspace-waiting-badge`（新）、`t0609-worker-attention-badge`、`t0694-worker-resumed-badge`、`t0538-worker-tab-batch-close`，共 24.0 s |
| 截圖（`e2e-results/`，不 commit） | `row-badge.png`、`row-badge-missed.png`、`active-row-badge.png` 都目視確認過：位置、灰色淡化、藍底可讀 |

只用隔離實例（`launchIsolated`），沒有用預設實例啟動 source build，也沒有啟動 LLM。e2e 的工作區名稱都是 `e2e-t0735-*`，沒有真實工作區名稱。

### 相關通過案例判定

| 案例 | 判定 |
|---|---|
| e2e `t0609-worker-attention-badge`（Worker ⚠️ / ? / ✓、N 只算 ✓） | 仍成立，重跑綠 |
| e2e `t0694-worker-resumed-badge`（↻） | 仍成立，重跑綠 |
| e2e `t0538-worker-tab-batch-close`（批次關閉） | 仍成立，重跑綠 |
| `workspace-store.workerAttention.test.ts` / `workspace-store.workerResumed.test.ts` | 仍成立（全套單元測試綠，沒有修改） |
| `worker-tab-attention.test.tsx`「a non-Worker tab never shows a badge, even when blocked」 | 原本的斷言（沒有 `.worker-badge`）仍然通過；但這個案例的**意圖**被 D200 ② 刻意改掉（非 Worker 現在會顯示 ⚠️）。依規格改名並擴充：「沒有 Worker 標籤，等待使用者時只顯示 ⚠️」。這是使用者決定的行為改變，不是回歸 |

### 已知限制

- (a) **detached 視窗的工作區（D200 ⑥，Q-1 [B]）**：主視窗列表本來就隱藏已分離的工作區；分離後新開的分頁主視窗不知道屬於哪個工作區；也沒有「在 detached 視窗選分頁」的 IPC。detached 視窗自己的縮圖 ⚠️ 照常。請塔台另開後續候選。
- (b) Claude 面板（Agent SDK）分頁沒有 PTY attention，所以不顯示。
- (c) `blockedDetection: none` 的分頁不會顯示：BAT MCP 關閉、claude 設定把 hooks 關掉、舊 codex、raw command 跑的 agent 沒有注入 hooks。
- (d) attention 與淡化都只存在各視窗的記憶體：視窗重新載入後，要等下一次狀態變更才會顯示；等待中途重新載入的視窗，沒看到開始事件，結束時不會留淡化。
- (e) 封存的工作區列不顯示 ⚠️，也不計入頁籤標題 / 收合窄列的總數（只算主視窗列表上的工作區）。

### 遭遇問題

- 本單沒列進 `affects_files`、但實際改到的檔：`src/App.tsx` 與新檔 `src/components/WorkspaceWaitingBadge.tsx`。原因是塔台補充二、三要求的「工作區」頁籤標題、收合窄列、「看過」狀態的接線都在 `App.tsx`，三處共用的元件放在新檔。範圍是塔台補充指定的，不算擴大範圍。
- 依 ct-exec，塔台的三則跨 session 補充（tower 分頁案例、D202、D203）都視為塔台指示照做，沒有回覆。

### 後續建議

- 為 D200 ⑥（detached 視窗的工作區）另開後續候選：Q-1 選項 [A] 的作法可以直接當起點。

### 互動紀錄

- [13:04] Q-1: D200 ⑥ detached 視窗的工作區用現有程式做不到，要怎麼處理？（BAT 通道 `--ask`，id `q-0927f7dd-…`） → A（塔台，13:08）: [B] 使用者決定：本單只做 ①–⑤，⑥ 寫進已知限制，塔台另開後續候選；detached 視窗自己的縮圖 ⚠️ 照常，主視窗列表隱藏已分離工作區的行為不改 → Action: 只做 ①–⑤，⑥ 寫進已知限制 (a)
- [時間未記錄] 塔台補充（跨 session 訊息）：驗收多一個「塔台分頁 AskUserQuestion」案例 → Action: 查證主行程不用改，加了單元測試與 e2e，見逐項表
- [時間未記錄] 塔台補充二（D202）：三處顯示位置 → Action: 做列右側、頁籤標題、收合窄列，三處共用 `waitingSummary`
- [時間未記錄] 塔台補充三（D203）：淡化保留規則 → Action: 在 store 記錄等待開始 / 錯過，加 `nextWaitMemory` 等純函式，四處都顯示淡化

### 回報時間

2026-11-01T13:25:52+0800
