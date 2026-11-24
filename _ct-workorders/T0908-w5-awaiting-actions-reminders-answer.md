---
schema_version: 1
schema_kind: workorder
id: T0908
title: "PLAN-068 W5（在 `v0.8.x`）：契約 v2 清單與回答 —— `awaiting_user` / `user_actions` / `reminders` / 工單 `waiting_user` 解析與待辦分頁三區、縮圖 / 工作區列表 `⏸N`、回答 IPC `tower-inbox:answer`（本機 / proxied）、Claude 面板塔台回答路徑、`terminal:notify-hold-*` 遠端 proxied"
type: implementation
status: PENDING
repo: better-agent-terminal
project: PLAN-068
priority: P1
sizing: L
created_at: "2026-11-25T05:58:05+08:00"
updated_at: "2026-11-25T05:58:05+08:00"
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

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯（唯一例外：`### 待塔台決策` 的 `塔台答覆 Q-n` 行由塔台新增）

### 完成狀態
- **session_id**：

### 產出摘要

### 互動紀錄

### Renew 歷程
無

### 遭遇問題

### 隔離分支證據
- branch：`ct/T0908`
- base_sha：
- validated_sha：
- head_sha：
- validated_sha ≠ head_sha 的說明：

### 回報時間
