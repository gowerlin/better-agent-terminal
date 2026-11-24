---
schema_version: 1
schema_kind: workorder
id: T0908
title: "PLAN-068 W5（在 `v0.8.x`）：契約 v2 清單與回答 —— `awaiting_user` / `user_actions` / `reminders` / 工單 `waiting_user` 解析與待辦分頁三區、縮圖 / 工作區列表 `⏸N`、回答 IPC `tower-inbox:answer`（本機 / proxied）、Claude 面板塔台回答路徑、`terminal:notify-hold-*` 遠端 proxied"
type: implementation
status: DONE
repo: better-agent-terminal
project: PLAN-068
priority: P1
sizing: L
created_at: "2026-11-25T05:58:05+08:00"
started_at: "2026-11-25T05:59:55+08:00"
completed_at: "2026-11-25T06:24:22+08:00"
updated_at: "2026-11-25T06:24:22+08:00"
session_ids:
  - "2992dc78-5c20-4bdb-a42e-cd3c46765ebf"
target_version: "0.8.x（與 CT 6.1.0 同日發佈）"
depends_on: [T0904, T0906]
related:
  - "PLAN-068；T0902（規格：§1 回答、§2.1 / §2.2 / §2.4 回答路徑、§3、§3.2 / §3.3 型別表、§4 面板塔台、§5 回答與 detached、第二版拆單 W5 列）；PLAN-068〈契約細節補充〉（`source` 全名與短標籤、時區 `+0800` / `+08:00`、選項代號）；HANDOVER〈BAT 回覆 CT 的 v2 確認〉（選項代號不分大小寫、唯一命中才算）"
  - "T0904〈建議後續〉1：遠端視窗看不到「📨 待送」/ 原因 / 立即送出 / 5 分鐘提醒（`terminal:notify-hold-*` 未 proxied，T0788 既有限制）→ 併入本單；T0815（Claude 面板排隊送出 `claude:send-message`）；T0761 / T0735（`DetachedWaitingReporter`、工作區列表徽章）"
affects_files:
  - _ct-workorders/T0908-w5-awaiting-actions-reminders-answer.md
  - src/lib/ct-tower-overview.ts
  - src/lib/inbox-model.ts
  - src/lib/
  - src/lib/__tests__/
  - src/components/InboxPanel.tsx
  - src/components/inbox/
  - src/components/TerminalThumbnail.tsx
  - src/components/ControlTowerPanel.tsx
  - src/components/WorkspaceWaitingBadge.tsx
  - src/components/
  - src/components/__tests__/
  - src/stores/
  - src/types/
  - src/locales/
  - src/styles/
  - src/App.tsx
  - electron/notify-hold.ts
  - electron/handlers/pty.ts
  - electron/handlers/terminal.ts
  - electron/remote/
  - electron/preload.ts
  - electron/main.ts
  - electron/__tests__/
  - e2e/
  - CLAUDE.md
  - docs/agent-guide/
renew_count: 0
isolation: worktree
workdir: "worktree ct/T0908（塔台已預先從 `v0.8.x` `677860a4` 建立分支 `ct/T0908`）"
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 分支與 worktree：只在 worktree 分支 `ct/T0908` 寫檔。開工時確認 `git -C \"$CT_WORKTREE\" merge-base HEAD v0.8.x` = `677860a4816f17d4bf743c9329f8992ee031abe9`（含 W0–W4：T0903 / T0904 / T0905 / T0906），不符就停下問塔台（BAT 印的 `base` / `CT_WORKTREE_BASE` 可能是與 main 的共同祖先，屬預期）。不 merge / rebase、不切分支、不 push、不動 `main` 與 `v0.8.x`。主 checkout 只能寫本工單檔（`git -C \"$CT_HOME\" commit --only _ct-workorders/<本檔>`）。"
  - "🔴 規格來源：T0902 回報區（第一版＋〈第二版（Renew #1，D328）〉）是唯一規格；W0–W4 已在 `v0.8.x`（W0 T0903：`src/lib/tower-contract.ts`、`PtyManager.getTowerContract(id)`、`tower-contract-store`；W1＋W2 T0904：`NotifyHoldController` 的 `draft` / `reading` / 原子送出 / `enqueueAnswer`；W3 T0905：`electron/tower-cards.ts`、`tower-cards:*`、`src/stores/tower-cards-store.ts`；W4 T0906：`InboxPanel`、`src/lib/inbox-model.ts`（`inboxVerdict`、`stateFileContractStatus`）、`InboxSection`；文件 `docs/agent-guide/tower-inbox.md`），**新功能只對 `towerContract == 2` 的塔台分頁生效**（R9′ 全部綁版本），既有 T0788 保留與所有現有行為不綁版本、不得改變（🔴 不回歸）。只做本單列的範圍；其他 W 單的範圍不做。與本單平行的還有 T0908（W5）、T0909（W6）、T0910（W9），各自分支，由塔台的合併工單整合；改到共用檔（例 `electron/preload.ts`、`src/types/electron.d.ts`、proxied channel 清單、locales）時只做本單需要的增量。"
  - "🔴 驗證：worktree `npm ci`；**每次產品 commit 前先完整跑一次 `npm run test:unit`**（T0903 教訓：改回應形狀會打到既有 `toEqual` 斷言），最後在 head 上完整執行要第一次就全綠（附 passed / files 數）；`npm run test:legacy` 全綠；`npx vite build` exit 0；`npm run typecheck` = 0、`npm run typecheck:electron` = 0；動到 helper 時 `npm run verify:helpers` exit 0。e2e 只用隔離實例（`launchIsolated`），不得以預設實例啟動；不碰使用者正在用的 BAT（安裝版）與其 userData / Terminal Server / `bat-pty-holder`；不跑 `t0859-pty-holder.spec.ts`；不開會耗 token 的 claude / codex turn（需要真實回合的項目寫「待實機」並對應 T0902 待實機清單編號）。`TMP` 用系統預設（T0716）。程序清理照 D308。"
  - "🔴 文件：CLAUDE.md 只加一兩句＋唯一實作位置＋🔴 不變式，細節寫進 `docs/agent-guide/tower-inbox.md`（W0 已寫在 `tower-tab-title.md`；本單若需要新檔就建立並更新 `docs/agent-guide/README.md` 索引）。CLAUDE.md < 100k 字元、小節標題不改名（T0595）。"
  - "🔴 Git：worktree 用 `git add <明確路徑>`；不 push、不觸發 workflow、不建 tag。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF；含反斜線的內容用 Write／Edit 工具寫（L129）。收單前 `git -C \"$CT_WORKTREE\" status --porcelain` 必須為空。`gh` 一律帶 `-R gowerlin/better-agent-terminal`（L122）。"
  - "🔴 公開 repo（D176）：程式、註解、回報區不寫真名、客戶名、家目錄路徑（寫 `<使用者資料夾>`）；日誌不記訊息內容、權杖、env。yolo：不得問使用者，判讀問題依 ct-exec § Questions For Tower 問塔台。"
  - "🔴 本單範圍（W5）：① 解析：`_tower-state.md` frontmatter `awaiting_user[]`、`user_actions[]`、`reminders[]`、`next_ids.user` / `action`，工單 frontmatter `waiting_user`，型別 / 必填 / 錯誤隔離照 T0902 §3.3 表（單筆錯誤只略過並計數；未知鍵忽略）；`created_at` / `due_at` 同時接受 `+0800` 與 `+08:00`，解析不了照原字串顯示；`source` 全名（`breakpoint-A` / `breakpoint-B-1` / `breakpoint-B-2` / `breakpoint-C` / `breakpoint-E` / `worker-question` / `tower-question`）顯示短標籤（三語系），未知值照原字串。② 待辦分頁三區（W4 已留 `InboxSection` 介面與空狀態）：⏸ 待你決定（選項按鈕；選項 `<代號> <說明>`，代號 `^[A-Za-z0-9]{1,3}$`、同筆不重複；任一項不符 → 該筆改自由回答欄；工單 `waiting_user` 對應時顯示 ⏸ 與「暫停中」）、🙋 待你執行（CT `user_actions` 與 W4 已有的待驗收 BUG 合併顯示；`command` 只有「複製」，🔴 BAT 永遠不執行；「完成」/「失敗…」）、⏰ 到期提醒（只顯示 `due_at` 已到或 7 天內到期）；最近已結 10 筆（記憶體）。③ 分頁標題數字加入待你決定 / 待你執行 / 到期件數；塔台縮圖 `⏸N` 與工作區列表 `⏸N`（detached 經既有 `DetachedWaitingReporter` 多帶一個數字）。④ 回答：renderer → 新 IPC `tower-inbox:answer { terminalId, text }`（本機 `ipcMain.handle`；遠端視窗為 proxied channel 送到該 host），🔴 不加進 `HELPER_CHANNEL_ROLES`、handler 以 `ctx.helper` 拒絕；文字單行、≤ 1,000 字、只收 `^[UA]-\\d+[：:]` 開頭；送 `U-n：<代號或自由文字>` / `A-n：完成` / `A-n：失敗 <說明>`（全形冒號）；host 交給 `NotifyHoldController.enqueueAnswer`（W2 已做：受 prompt / `draft` 保護、不受 `reading` 擋，Enter 算使用者輸入）；目標 = 該工作區已宣告且契約相符的塔台，剛好一個直接送，零個或多個讓使用者選。⑤ Claude 面板塔台：回答送進面板（T0815 的 `claude:send-message` 排隊路徑），草稿保護改看面板輸入框（renderer 直接知道）。⑥ T0904 建議後續 1：`terminal:notify-hold-list` / `-cancel` / `-send-now` 與事件 `terminal:notify-hold-changed` / `-reminder` 加進 proxied（`PROXIED_CHANNELS` / `PROXIED_EVENTS`），讓遠端視窗看得到「📨 待送」、原因、立即送出與 5 分鐘提醒；🔴 仍不進 `HELPER_CHANNEL_ROLES`。⑦ 全部只在 §6′ 判定相符時運作（W4 的 `inboxVerdict`）；`user_inbox: off`（欄位缺）顯示 W4 已有的說明。"
  - "🔴 不得改變：W4 的版本判定與 R6 規則、T0788 既有保留、`bat-notify` / `bat-terminal` exit code 與 stdout、指揮塔總覽唯讀；日誌不記 `summary` / `options` / 回答內容（只記 id、長度、筆數）。"
---

# T0908 — PLAN-068 W5：契約 v2 清單與回答

## 背景

PLAN-068 的待辦分頁（W4，T0906）已有骨架與版本判定；送通知的保護與回答佇列介面（W1＋W2，T0904）已完成。CT 6.1.0 依契約 v2（CT D868）寫 `awaiting_user` / `user_actions` / `reminders` / 工單 `waiting_user`，並解析使用者的一行回答 `U-n：…` / `A-n：完成 / 失敗 …`。本單把 CT 寫的清單顯示出來、讓使用者從待辦分頁回答，並補上遠端視窗看不到「📨 待送」的既有缺口。

## 驗收

- [ ] 三種欄位與 `waiting_user` 解析（型別表逐項、錯誤隔離、時區兩種格式、`source` 短標籤）
- [ ] 三區畫面（選項按鈕 / 自由回答、複製指令、完成 / 失敗、到期過濾、最近已結）
- [ ] 分頁標題數字、縮圖與工作區列表 `⏸N`（含 detached）
- [ ] 回答 IPC（本機 / proxied、權杖拒絕、格式檢查、目標塔台選擇）＋ 進保留佇列的行為
- [ ] Claude 面板塔台回答路徑
- [ ] `terminal:notify-hold-*` 遠端 proxied
- [ ] 版本不符時全部不運作；驗證關卡、文件、隔離分支證據

## 塔台補充（執行中 #1）

**時間**：2026-11-25T06:02:54+08:00

「面板塔台」的定義（塔台答覆 T0909 Q-1，W5 的 Claude 面板回答路徑與 W6 共用，不得各寫一套）：

- 工作區的狀態檔 `bat_contract == 2`、**而且**該工作區沒有任何已宣告（`--set-role`）的塔台分頁 → 該工作區所有 Claude Agent 面板（`claude-code`）都算面板塔台；有已宣告塔台分頁、狀態檔不是 2、或讀不到狀態檔 → 都不算。判定改變時即時更新。
- 回答目標：有已宣告塔台分頁時只送塔台分頁（不送面板）；沒有時才在面板塔台之間選（剛好一個直接送，多個讓使用者選）。
- 判定由 T0909（W6）做成純函式（`src/lib/inbox-model.ts` 或同等位置）。兩張平行，本單**先在同一位置以同名、同語意的純函式實作**（若合併時兩邊都有，合併工單保留一份）；函式名稱建議 `isPanelTowerWorkspace(stateBatContract, declaredTowerCount)` 或照 W4 `stateFileContractStatus` 的命名慣例，回報區寫出最後名稱與位置。

## 塔台補充（執行中 #2）

**時間**：2026-11-25T06:14:35+08:00

T0909（W6）已完成，面板塔台判定的最終名稱與位置（`ct/T0909` `efd6b3da`，`src/lib/inbox-model.ts`）：`workspaceHasPanelTowers(stateContract, declaredTowerCount)`、`panelTowerTerminalIds(terminals, stateContract, declaredTowerCount)`、常數 `CLAUDE_PANEL_PRESETS = ['claude-code', 'claude-code-worktree']`。本單若已用別的名稱實作同語意函式，請改用**這三個名稱與簽章**（同檔、同語意），讓合併時兩邊收斂成一份；尚未實作就直接照這個簽章寫。回報區註明。

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯（唯一例外：`### 待塔台決策` 的 `塔台答覆 Q-n` 行由塔台新增）

### 完成狀態
- **狀態**：DONE（驗收 7 項的 Worker 部分全部完成；需要真實回合 / 遠端環境的項目列在〈待實機〉）
- **session_id**：2992dc78-5c20-4bdb-a42e-cd3c46765ebf
- **產品 commit**：`ba4fe096`（`ct/T0908`，單一 commit）

### 落點檢查
- C-0：`repo` = `better-agent-terminal`，`basename "$CT_HOME"` = `better-agent-terminal` → PASS
- C-1：工單在 `$CT_HOME/_ct-workorders/` → PASS；C-3：`affects_files` 都在 → PASS；C-2：無 `branch` 欄位
- `CT_HOME` / `CT_WORKTREE_BRANCH` = `ct/T0908` 已設定；`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）
- memory_overrides 的 merge-base 檢查：`git merge-base HEAD v0.8.x` = `677860a4816f17d4bf743c9329f8992ee031abe9` ✅

### 產出摘要

**① 解析**（`src/lib/tower-inbox.ts`，純函式，main / headless / renderer 共用）
- `parseTowerInboxLists`：`awaiting_user` / `user_actions` / `reminders` / `next_ids.user` / `next_ids.action`，照 T0902 §3.3 表：必填欄位錯 / 重複 id → 該筆略過並計數；選填欄位錯 → 只丟該欄位；未知鍵忽略；清單不是陣列 → 忽略。`options` 每項 `<代號> <說明>`（`^[A-Za-z0-9]{1,3}$`，同筆不分大小寫不重複，配合 CT「不分大小寫、唯一命中」）→ 任一項不符改自由回答。`user_actions.title` > 120 字略過、`command` > 300 字只丟指令。
- `parseCtTime` / `formatCtTime`：`+08:00`、`+0800`、`Z`、無時區、只有日期都收，解析不了照原字串顯示。
- `source` 七個全名 → 短標籤（`inbox.source.*`，三語系），未知照原字串；`kind` 同理。
- 工單 `waiting_user`：`parseWorkOrder` 多 `waitingUser`（只在格式正確時出現，既有輸出逐字不變）。
- 檔案層 `parseTowerStateInbox`、`effectiveUserInbox`（`src/lib/ct-tower-overview.ts`）。`user_inbox` 讀專案 `_tower-config.yaml`，其次全域層（既有 proxied `ct:read-config-sources`，掛載與 ↻ 時讀，不新增 channel）。

**② 待辦分頁三區**（`src/components/inbox/InboxLists.tsx`，接到 W4 的 `InboxSection`）
- ⏸ 待你決定：選項 radio＋送出、自由回答欄（Enter 送出）、`source` 短標籤、⏸「T#### 暫停中」（未結工單的 `waiting_user`）、時間；> 50 筆只畫前 50＋「另有 N 筆」；略過筆數一行。
- 🙋 待你執行：CT `user_actions`（在前）＋W4 待驗收 BUG；「複製指令」只寫剪貼簿（🔴 不執行）、「完成」、「失敗…」＋說明。
- ⏰ 到期提醒：`due_at` 已到或 7 天內（逾期 N 天 / 今天 / N 天後）。
- 最近已結 10 筆（`nextRecentlyClosed`，`inbox-store` 記憶體，兩次讀檔都成功時才判定消失）。
- `user_inbox: off` → 一行說明、不列 CT 項目，BAT 的 BUG / Worker / 卡片區照常。

**③ 數字與 `⏸N`**
- 分頁標題 = Worker 等你＋待驗收 BUG＋待你決定＋待你執行＋到期提醒（`inboxActionCount` 加選填參數，W4 呼叫不變）。
- `InboxAwaitingBadge`：契約 2 塔台縮圖、工作區列表每列；點擊開啟待辦分頁。非作用中工作區由新的 `InboxStateSources`（只讀 `_tower-state.md`，只對有契約 2 塔台分頁的工作區）供資料。
- detached：`DetachedWaitingReporter` 的回報多 `awaiting`（`sanitizeDetachedWaitingReport` 只收 1…9999 整數；空報告的形狀與 T0761 逐字相同），主視窗 `DetachedWorkspaceWaitingRows` 顯示 `⏸N`（只有 `⏸N` 的 detached 工作區也有一列）；`awaiting` 不算進 ⚠️ 總數。

**④ 回答 IPC**（`electron/notify-hold.ts` `registerTowerInboxAnswerHandler`，main 與 headless 都註冊）
- `tower-inbox:answer { terminalId, text }`，proxied（`PROXIED_CHANNELS`、`path-aware-channels` 分類）；🔴 不在 `HELPER_CHANNEL_ROLES`，handler 另拒 `ctx.helper`（`FORBIDDEN`）。
- `checkInboxAnswer`：單行、≤ 1,000 字、`^[UA]-\d+[：:]` 開頭且後面有字；交 `enqueueAnswer`（W2：prompt / `draft` 擋、`reading` 不擋、Enter 算使用者輸入）。
- renderer 送出：`U-n：<代號>`（代號照 CT 原樣）/ `U-n：<自由文字>`（換行改空白）/ `A-n：完成` / `A-n：失敗 <說明>`（全形冒號）。
- 目標選擇 `inboxAnswerTargets`：有已宣告塔台分頁 → 只送其中契約 2 的（一個直送、多個讓使用者在該筆下方選）；沒有 → 面板塔台；零個 → 提示。

**⑤ Claude 面板塔台**：`src/lib/inbox-answer.ts` 發視窗事件 `bat:panel-tower-answer`，`ClaudeAgentPanel`（`sessionId` = 分頁 id）把這一行放進輸入框後走自己的 `handleSend`（回合中 → T0815 排隊）；輸入框有字 / 附件 / 上傳中 → 回 `draft`，什麼都不動。

**⑥ `terminal:notify-hold-*` 遠端 proxied**：`list` / `cancel` / `send-now` 改由共用 `registerNotifyHoldHandlers` 在兩邊註冊（main 的 `ipcMain.handle` 移除，改由 `bindProxiedHandlersToIpc` 綁定；回應形狀不變）；事件 `-changed` / `-reminder` 加進 `PROXIED_EVENTS`，headless controller 以 `host.emit` 送出，main 改送所有視窗＋broadcastHub。helper 權杖呼叫回 `[]` / `0`。

**⑦ 版本**：全部只在 W4 `inboxVerdict` 相符時顯示 / 運作（不符時 W4 的選擇器＋提示不變，`⏸N` 不顯示）；host 端 `enqueueAnswer` 本來就只收契約 2 塔台。

**面板塔台判定（塔台補充 #1 / #2）**：最後名稱與位置 = T0909 的 `CLAUDE_PANEL_PRESETS`、`workspaceHasPanelTowers(stateContract, declaredTowerCount)`、`panelTowerTerminalIds(terminals, stateContract, declaredTowerCount)`，`src/lib/inbox-model.ts`，**從 `ct/T0909` `efd6b3da` 逐字複製**（同位置：緊接 `stateFileContractStatus` 之後），合併時兩邊內容相同；本單原本的 `isPanelTowerWorkspace` 已刪除。本單自己的 `inboxAnswerTargets` 經 `workspaceHasPanelTowers`、`useInboxModel` 經 `panelTowerTerminalIds`。

**不得改變（核對）**：W4 版本判定與 R6 未動；T0788 保留邏輯未動（`notify-hold.ts` 只在檔尾新增 handler 註冊；`notify-hold.test.ts` / `notify-hold-ask-held-full.test.ts` 未改、全綠）；`bat-notify` / `bat-terminal` 未動；指揮塔總覽唯讀未動；日誌只記 id / 長度 / 筆數 / 原因代碼。

**檔案**：新增 `src/lib/tower-inbox.ts`、`src/lib/inbox-answer.ts`、`src/components/inbox/InboxLists.tsx`、`src/components/inbox/InboxAwaitingBadge.tsx`；修改 `electron/notify-hold.ts`、`electron/main.ts`、`electron/remote/headless-entry.ts`、`electron/remote/protocol.ts`、`electron/remote/path-aware-channels.ts`、`electron/preload.ts`、`src/types/{electron.d.ts,notify-hold.ts,control-tower.ts}`、`src/lib/{ct-tower-overview,inbox-model,terminal-attention}.ts`、`src/stores/{inbox-store,notify-hold-store,terminal-attention-store}.ts`、`src/components/{InboxPanel,ClaudeAgentPanel,TerminalThumbnail,Sidebar,WorkspaceWaitingBadge}.tsx`、`src/components/inbox/{InboxDataSource.tsx,useInboxModel.ts}`、`src/App.tsx`、三個 locale、`src/styles/inbox.css`、`CLAUDE.md`、`docs/agent-guide/{tower-inbox,notify-hold}.md`；測試 3 檔新增。

### 驗證
| 關卡 | 結果 |
|---|---|
| `npm ci`（worktree） | exit 0 |
| `npm run typecheck` | 0（head `ba4fe096` 上再跑一次：0） |
| `npm run typecheck:electron` | 0（head 上再跑一次：0） |
| `npm run test:unit`（commit 前完整一次） | 484 files passed / 3 skipped；8821 tests passed / 47 skipped；exit 0 |
| `npm run test:unit`（head `ba4fe096`，第一次即全綠） | **484 files passed / 3 skipped；8826 passed / 42 skipped**；exit 0（skipped 少 5 = `vite build` 後 dist 相依測試不再略過） |
| `npm run test:legacy` | 33 files passed / 0 failed；472 tests passed；exit 0 |
| `npx vite build` | exit 0；之後 `asar-runtime-deps` / `no-elkjs-in-dist` 35 passed |
| `npm run verify:helpers` | 未跑：沒有動到 helper（`scripts/` 未改） |
| e2e | 未跑：本單沒有新增 e2e；整合 e2e 屬 W8（隔離實例）。未啟動任何 BAT 實例、未碰安裝版 |

新測試：`src/lib/__tests__/tower-inbox.test.ts`（22）、`electron/__tests__/tower-inbox-answer.test.ts`（12）、`src/components/__tests__/inbox-w5.test.tsx`（17）。開發中第一次完整 `test:unit` 只打到一個 source guard（`detached-workspace-waiting.test.tsx` 檢查 App 的 `<DetachedWaitingReporter workspace={ws} />` 字串）→ 改成在 reporter 內查 folder、App 那行不動，既有測試未修改。

### 待實機（對應 T0902 待實機清單）
- 真 CT 6.1.0 塔台收到 `U-n：…` / `A-n：…` 後的解析、移除與決策日誌（W8 整合驗收）。
- 遠端（WSL）塔台：回答經 proxied 送達、遠端視窗的「📨 待送」/ 立即送出 / 5 分鐘提醒（T-7）。
- 面板塔台實際送出（需登入的 Claude 面板回合）。

### 互動紀錄
（時間取自塔台補充的時間戳，讀到的時刻在其後幾分鐘內，未另取系統時間）
- [06:02 後] 📥 塔台補充（執行中 #1）於〈實作中（跨 session 訊息提示）〉讀到 → 面板塔台定義與回答目標規則照做：有已宣告塔台分頁只送分頁、沒有才送面板塔台；判定做成純函式。
- [06:14 後] 📥 塔台補充（執行中 #2）於〈實作中（跨 session 訊息提示）〉讀到 → 改用 T0909 的 `CLAUDE_PANEL_PRESETS` / `workspaceHasPanelTowers` / `panelTowerTerminalIds`（從 `efd6b3da` 逐字複製到同檔同位置），刪除本單的 `isPanelTowerWorkspace`。

### Renew 歷程
無

### 遭遇問題
- 規格說「`user_inbox: off`（欄位缺）顯示 W4 已有的說明」，但 W4 沒有這段說明文字；依 T0902 §6′ 實作：讀 CT 設定的 `user_inbox`（專案層 → 全域層），`off` 時待你決定 / 待你執行顯示「已關閉」一行（新 locale `inbox.userInboxOff`）。
- 面板塔台的草稿保護採「拒絕並提示」（面板輸入框有字 / 附件時不送，請使用者送出或清除後再按），不是排隊；理由：面板沒有 host 端佇列，renderer 排隊會在使用者看不到的地方送出。
- 只有 `⏸N` 的 detached 工作區列點擊不帶出視窗（沒有可切的分頁 id）；寫在 docs 已知限制。
- 沒有已宣告塔台、只靠狀態檔的**非作用中**工作區不顯示 `⏸N`（避免為徽章讀所有工作區）；寫在 docs 已知限制。
- CLAUDE.md 原本已 130,021 字元（超過 100k 目標，未超過 150k 上限），本單新增一節 4 行＋改 1 句，現為 131,771 字元；細節都放 `docs/agent-guide/tower-inbox.md`。
- 開發中曾用 heredoc 寫一段含 `↗` 的 Python 修改腳本，比對失敗（沒有寫入任何檔案），改用 Edit 工具完成。

### 建議後續
- W8：以隔離實例驗 `tower-inbox:answer`（本機＋headless）與遠端「📨 待送」；面板塔台回答。
- W7：README 版本對照表與說明頁可引用 `docs/agent-guide/tower-inbox.md`「契約 v2 清單與回答（W5）」。
- 合併工單：`src/lib/inbox-model.ts` 的 T0909 面板塔台區塊與 `ct/T0909` 逐字相同，可直接取一份；`src/components/inbox/useInboxModel.ts`、`InboxPanel.tsx`、locales `inbox.*` 兩邊都有增量，需手動合併（本單只加自己的鍵）。

### 隔離分支證據
- branch：`ct/T0908`
- base_sha：`06c3b8843caf4f34bbec6117b0de443b7a3fdbf9`（`CT_WORKTREE_BASE`；分支實際起點 `677860a4`，merge-base 與 `v0.8.x` 已核對）
- validated_sha：`ba4fe096d3af5221d077fd4d2e7ea2c5ef13c34a`
- head_sha：`ba4fe096d3af5221d077fd4d2e7ea2c5ef13c34a`
- validated_sha ≠ head_sha 的說明：相同（commit 後在 head 上重跑 `test:unit` 與兩個 typecheck；`test:legacy` / `vite build` 在 commit 前同一份工作樹內容上執行，commit 只是把那份內容提交）

### 回報時間
2026-11-25T06:23:23+08:00
