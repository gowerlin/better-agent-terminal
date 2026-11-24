---
schema_version: 1
schema_kind: workorder
id: T0909
title: "PLAN-068 W6（在 `v0.8.x`）：塔台回合訊息卡 UI —— 待辦分頁「💬 塔台訊息」區（未讀 / 已讀 / 釘選 / 全部已讀 / 清除）、`⏸ 待你決定：` 行加亮、codex 說明行、縮圖 `💬N`、`createTowerCardsSync().start()` 接 `App.tsx`、Claude 面板塔台 `setPanelTower` 接線、claude 太舊提示"
type: implementation
status: PENDING
repo: better-agent-terminal
project: PLAN-068
priority: P1
sizing: M
created_at: "2026-11-25T05:58:05+08:00"
updated_at: "2026-11-25T05:58:05+08:00"
target_version: "0.8.x（與 CT 6.1.0 同日發佈）"
depends_on: [T0905, T0906]
related:
  - "PLAN-068；T0902（規格：§1 版面與「💬 塔台訊息」區、§2.3、§3 卡片列、§4 codex 說明、第二版拆單 W6 列、§7.1 G7）；T0905（W3 資料層：`electron/tower-cards.ts`、`tower-cards:*`、`src/stores/tower-cards-store.ts`、`stopsWithoutMessage`、`setPanelTower`）；T0906（W4：`InboxSection`、`stateFileContractStatus`）"
affects_files:
  - _ct-workorders/T0909-w6-tower-cards-ui.md
  - src/components/InboxPanel.tsx
  - src/components/inbox/
  - src/components/TerminalThumbnail.tsx
  - src/components/__tests__/
  - src/stores/tower-cards-store.ts
  - src/stores/
  - src/lib/
  - src/lib/__tests__/
  - src/types/
  - src/locales/
  - src/styles/
  - src/App.tsx
  - electron/tower-cards.ts
  - electron/claude-agent-manager.ts
  - electron/main.ts
  - electron/remote/
  - electron/preload.ts
  - electron/__tests__/
  - e2e/
  - CLAUDE.md
  - docs/agent-guide/
renew_count: 0
isolation: worktree
workdir: "worktree ct/T0909（塔台已預先從 `v0.8.x` `677860a4` 建立分支 `ct/T0909`）"
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 分支與 worktree：只在 worktree 分支 `ct/T0909` 寫檔。開工時確認 `git -C \"$CT_WORKTREE\" merge-base HEAD v0.8.x` = `677860a4816f17d4bf743c9329f8992ee031abe9`（含 W0–W4：T0903 / T0904 / T0905 / T0906），不符就停下問塔台（BAT 印的 `base` / `CT_WORKTREE_BASE` 可能是與 main 的共同祖先，屬預期）。不 merge / rebase、不切分支、不 push、不動 `main` 與 `v0.8.x`。主 checkout 只能寫本工單檔（`git -C \"$CT_HOME\" commit --only _ct-workorders/<本檔>`）。"
  - "🔴 規格來源：T0902 回報區（第一版＋〈第二版（Renew #1，D328）〉）是唯一規格；W0–W4 已在 `v0.8.x`（W0 T0903：`src/lib/tower-contract.ts`、`PtyManager.getTowerContract(id)`、`tower-contract-store`；W1＋W2 T0904：`NotifyHoldController` 的 `draft` / `reading` / 原子送出 / `enqueueAnswer`；W3 T0905：`electron/tower-cards.ts`、`tower-cards:*`、`src/stores/tower-cards-store.ts`；W4 T0906：`InboxPanel`、`src/lib/inbox-model.ts`（`inboxVerdict`、`stateFileContractStatus`）、`InboxSection`；文件 `docs/agent-guide/tower-inbox.md`），**新功能只對 `towerContract == 2` 的塔台分頁生效**（R9′ 全部綁版本），既有 T0788 保留與所有現有行為不綁版本、不得改變（🔴 不回歸）。只做本單列的範圍；其他 W 單的範圍不做。與本單平行的還有 T0908（W5）、T0909（W6）、T0910（W9），各自分支，由塔台的合併工單整合；改到共用檔（例 `electron/preload.ts`、`src/types/electron.d.ts`、proxied channel 清單、locales）時只做本單需要的增量。"
  - "🔴 驗證：worktree `npm ci`；**每次產品 commit 前先完整跑一次 `npm run test:unit`**（T0903 教訓：改回應形狀會打到既有 `toEqual` 斷言），最後在 head 上完整執行要第一次就全綠（附 passed / files 數）；`npm run test:legacy` 全綠；`npx vite build` exit 0；`npm run typecheck` = 0、`npm run typecheck:electron` = 0；動到 helper 時 `npm run verify:helpers` exit 0。e2e 只用隔離實例（`launchIsolated`），不得以預設實例啟動；不碰使用者正在用的 BAT（安裝版）與其 userData / Terminal Server / `bat-pty-holder`；不跑 `t0859-pty-holder.spec.ts`；不開會耗 token 的 claude / codex turn（需要真實回合的項目寫「待實機」並對應 T0902 待實機清單編號）。`TMP` 用系統預設（T0716）。程序清理照 D308。"
  - "🔴 文件：CLAUDE.md 只加一兩句＋唯一實作位置＋🔴 不變式，細節寫進 `docs/agent-guide/tower-inbox.md`（W0 已寫在 `tower-tab-title.md`；本單若需要新檔就建立並更新 `docs/agent-guide/README.md` 索引）。CLAUDE.md < 100k 字元、小節標題不改名（T0595）。"
  - "🔴 Git：worktree 用 `git add <明確路徑>`；不 push、不觸發 workflow、不建 tag。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF；含反斜線的內容用 Write／Edit 工具寫（L129）。收單前 `git -C \"$CT_WORKTREE\" status --porcelain` 必須為空。`gh` 一律帶 `-R gowerlin/better-agent-terminal`（L122）。"
  - "🔴 公開 repo（D176）：程式、註解、回報區不寫真名、客戶名、家目錄路徑（寫 `<使用者資料夾>`）；日誌不記訊息內容、權杖、env。yolo：不得問使用者，判讀問題依 ct-exec § Questions For Tower 問塔台。"
  - "🔴 本單範圍（W6）：① `App.tsx` 呼叫一次 `createTowerCardsSync().start()`（W3 留的接點；本機與遠端視窗、detached 各自的視窗都要正確）。② 待辦分頁「💬 塔台訊息」區（W4 已留 `InboxSection`）：選中塔台的卡片（新 → 舊），未讀 ●、展開 = 已讀、📌 釘選（置頂、上限照 host 的 `PIN_LIMIT`，超過時提示）、「全部已讀」、清除；卡片內容以純文字呈現（🔴 不以 HTML 解譯，避免注入），長內容摺疊；截斷過的顯示標記。區塊未讀數只顯示在區塊標題與縮圖 `💬N`，🔴 不算進分頁標題數字（僅告知不催人，T0902 §1）。③ 以 `⏸ 待你決定：` 或 `🙋 待你執行：` 開頭的行加亮，只是提示、不解析成資料（資料只來自 W5 的 frontmatter）。④ codex 塔台：卡片區固定一行說明（T0902 §4 文字，三語系），不嘗試其他來源。⑤ Claude 面板塔台：以 W4 的 `stateFileContractStatus`（面板沒有 `--set-role`，以狀態檔 `bat_contract` 判定）決定後呼叫 W3 的 `setPanelTower(id, bool)`（經 IPC，本機與 headless），判定改變時更新；面板 session dispose 照 W3 清空。⑥ G7：契約 v2 塔台的 `stopsWithoutMessage > 0` 且沒有任何卡片時，卡片區顯示「claude 版本太舊（需要 2.1.47 以上）」提示（三語系）。⑦ 全部只在 §6′ 判定相符時運作。"
  - "🔴 不得改變：W3 的保存規則（只收 v2 塔台、遮罩、上限、生命週期、不寫檔）與 `tower-cards:*` 不在 helper 權杖範圍；W4 的分頁判定與 R6；日誌不記卡片內容。"
---

# T0909 — PLAN-068 W6：塔台回合訊息卡 UI

## 背景

W3（T0905）已把契約 v2 塔台每回合的最後訊息存在 host 記憶體並提供 `tower-cards:*` 讀取；W4（T0906）已有待辦分頁骨架。本單把卡片顯示在待辦分頁「💬 塔台訊息」區並接上 App 與 Claude 面板塔台。

## 驗收

- [ ] `createTowerCardsSync().start()` 接上；遠端 / detached 正確
- [ ] 卡片區：未讀 / 已讀 / 釘選 / 全部已讀 / 清除、純文字呈現、摺疊、截斷標記；未讀不進分頁標題數字；縮圖 `💬N`
- [ ] `⏸ 待你決定：` / `🙋 待你執行：` 行加亮
- [ ] codex 說明行；claude 太舊提示（G7）
- [ ] Claude 面板塔台 `setPanelTower` 接線
- [ ] 版本不符時不運作；驗證關卡、文件、隔離分支證據

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
- branch：`ct/T0909`
- base_sha：
- validated_sha：
- head_sha：
- validated_sha ≠ head_sha 的說明：

### 回報時間
