---
schema_version: 1
schema_kind: workorder
id: T0761
title: "detached 視窗的工作區也提示等待使用者 ⚠️（D200 ⑥ / D201 延後項）：先提呈現方式，使用者選定後實作"
type: implementation
status: IN_PROGRESS
started_at: "2026-11-02T02:54:11+0800"
updated_at: "2026-11-02T02:54:11+0800"
session_ids: []
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: M
created_at: "2026-11-02T02:23:44+0800"
depends_on: [T0757]
related:
  - "D200 ⑥、D201（T0735 Q-1 延後原因）、D202 / D203；T0735（`WorkspaceWaitingBadge`）；`docs/agent-guide/detached-workspace.md`、`docs/agent-guide/worker-tab-recycle.md`（等待使用者提示）"
  - "`src/App.tsx`（`nonDetachedWorkspaces`）、`src/components/WorkspaceWaitingBadge.tsx`、`src/lib/terminal-attention.ts`（`waitingForUser` / `waitingSummary`）、`src/stores/terminal-attention-store.ts`、`electron/main.ts`、`electron/preload.ts`、`electron/window-registry.ts`"
affects_files:
  - src/App.tsx
  - src/components/WorkspaceWaitingBadge.tsx
  - src/components/
  - src/lib/terminal-attention.ts
  - src/stores/terminal-attention-store.ts
  - src/stores/workspace-store.ts
  - electron/main.ts
  - electron/preload.ts
  - electron/window-registry.ts
  - electron/__tests__/
  - src/**/__tests__/
  - src/locales/en.json
  - src/locales/zh-TW.json
  - src/locales/zh-CN.json
  - e2e/
  - docs/agent-guide/worker-tab-recycle.md
  - docs/agent-guide/detached-workspace.md
  - CLAUDE.md
  - _ct-workorders/T0761-detached-window-workspace-waiting.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
tower_question: open
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: decision-requiring
memory_overrides:
  - "🔴 第一步只讀不改：讀 D200 ⑥ / D201 與現行程式，整理 2–3 個呈現方式（例：A. 主視窗列表為已分離且有等待的工作區加一列精簡提示，點擊把 detached 視窗帶到前面並切到等最久的分頁；B. 只在主視窗「工作區」頁籤標題 / 收合窄列的 ⚠️ 總數計入，滑過列出、點擊帶出 detached 視窗；C. 其他），每個寫明畫面變化、要動的 main / preload / renderer / headless、風險與規模。以 `--ask` 問塔台（這是使用者偏好，塔台會轉問使用者），🔴 拿到答覆前不得改程式。"
  - "🔴 實作約束：不改「主視窗列表隱藏已分離工作區」的既有行為，除非使用者選的方案就是要改；detached 視窗自己的縮圖 ⚠️ 照舊；settings 不得在 detached 視窗開（CLAUDE.md「Detached workspace 視窗的持久化」）；新 IPC 走既有 preload 模式；遠端 profile 視窗同理（或照實寫限制）。T0757 已改的清除規則照用，不重做。"
  - "🔴 驗收：e2e（隔離實例）：工作區 B detach、B 的分頁進入等待 → 主視窗依選定方式顯示 ⚠️；點擊 → detached 視窗在前、切到該分頁；回答後清除 / 沒在看時淡化（D203）。突變檢查。"
  - "🔴 驗證：新增 / 修改的單元測試＋突變檢查（拿掉修正，測試要失敗）；`npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npm run test:unit`、`npx vite build`（依上方 build 規則的位置）。"
  - "🔴 build（Lane A：T0757 → T0761 → T0762 → T0763 → T0764，依序執行）：本單在主 checkout 跑 `npx vite build` 與 e2e；Lane B（T0758 → T0759 → T0760）只在匯出目錄 build，不影響本單。e2e 一律用 `e2e/fixtures/electron-isolation.ts` 隔離實例，不碰使用者正在用的 BAT、userData 與 WSL bat-server。"
  - "🔴 yolo：不得問使用者；判讀問題依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。Git：只用 `git commit --only` commit 本單範圍；同一 checkout 有其他 Worker 並行，不得 commit 或改動別人的未提交變更；`CLAUDE.md`、`docs/agent-guide/*.md` 等共用檔若已有別人的未提交修改，等對方 commit 後再改（`git diff <檔>` 確認）。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。用 Python 改檔一律 `newline=''`。公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」。不 push、不發版。"
---
# T0761 — detached 視窗的工作區也提示等待使用者 ⚠️（D200 ⑥ / D201 延後項）：先提呈現方式，使用者選定後實作

## 元資料

- **工單編號**：T0761
- **類型**：implementation
- **優先級**：P2
- **建立時間**：2026-11-02T02:23:44+0800
- **預估規模**：M

## 背景

D200 ⑥ 要求 detached 視窗的工作區也計入等待提示；T0735 時改主視窗列表與 IPC 超過範圍，D201 延後。D210 排入本批。呈現方式屬使用者偏好，先提選項。

## 範圍

1. 提 2–3 個呈現方式 → 塔台轉問使用者。
2. 依選定方式實作、e2e、文件。

## 不做

- 不改 detached 視窗的設定 / 持久化規則；不改 Claude 面板（T0762）；不發版。

## 驗收

- [ ] 選項已提、答覆已記錄
- [ ] e2e＋突變檢查；typecheck 0 / 0、`test:unit`、`vite build`
- [ ] 文件更新（`worker-tab-recycle.md` 已知限制移除 detached 一項）

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯（唯一例外：`### 待塔台決策` 的 `塔台答覆 Q-n` 行由塔台新增）

### 待塔台決策

#### Q-1：detached 視窗的工作區有分頁在等待使用者時，主視窗要用哪種方式提示 ⚠️？
- 提問時間：2026-11-02T02:55:40+0800
- 現況（只讀查證）：主視窗列表把已分離的工作區整列隱藏（`App.tsx` `nonDetachedWorkspaces`）；attention 事件每個視窗都收得到，但 detach 後在 detached 視窗新開的分頁主視窗 store 裡沒有（不知所屬工作區、沒有標題）；「看過」（D203）只發生在 detached 視窗；main 沒有「讓 detached 視窗切到某分頁」的 IPC（`workspace:detach` 對已分離的工作區只會 `focus()` 那個視窗）。三個選項共通的作法：**由 detached 視窗自己算它那個工作區的等待彙總**（沿用 `waitingSummary`＋D203 的看過 / 淡化，看過與否在 detached 視窗判斷），經新的本機 IPC（detached → main → 父視窗，`ipcMain` 直接處理、不經 proxied，所以遠端 profile 視窗的 detached 視窗也適用；headless / bat-server 不用改）送給父視窗，父視窗只顯示、不重算。
- 選項：
  - [A] **主視窗列表多一列精簡提示列**：只在已分離的工作區「有等待或淡化」時出現（平常列表不變，仍隱藏已分離的工作區），樣式「↗ <工作區名>（已分離） ⚠️ / ⚠️ N」，放在一般工作區列下方；② 工作區頁籤標題、③ 收合窄列的總數也計入；滑過列出分頁標題與原因（不含問題內容）；點擊 → detached 視窗還原 / 帶到前面並切到等最久的分頁（終端頁籤）。要動：detached renderer 送彙總、新 IPC 兩組（彙總轉送、`focus-detached-terminal`：main 對 detached 視窗 restore / show / focus 並送「切到分頁」給它）、preload、App.tsx 新列元件、`WaitingTotalBadge` 計入、三語 i18n、e2e、docs。規模 M。風險：父視窗已關、detached 視窗還在 → 沒地方顯示（寫成已知限制）。
  - [B] **不加列，只計入總數**：② 頁籤標題、③ 收合窄列的 ⚠️ N 計入已分離工作區，tooltip 多一行「<工作區名>（已分離）：N」；點擊行為不變（② 只切頁籤、③ 只展開），不提供跳到 detached 視窗分頁。要動：彙總轉送 IPC 一組、`WaitingTotalBadge`、i18n、e2e、docs。規模 S–M。缺點：使用者看得到數字，但列表裡找不到是哪一列，要自己切到 detached 視窗。
  - [C] **不改主視窗，改 detached 視窗本身**：detached 視窗有分頁在等待時，視窗標題加「⚠️ N」前綴，視窗不在前景時閃工作列（`BrowserWindow.flashFrame`，Windows / Linux；macOS 無此效果），看過或等待結束停止。只動 detached renderer＋main 一個 IPC。規模 S。不符合 D200 ⑥「主視窗工作區列表也算」的字面，但不改主視窗任何行為。
  - [其他] 例：A＋C 一起做（規模 M+）。
- Worker 建議：[A]，因為它直接補上 D200 ⑥（主視窗看得到、點了就到），平常列表行為不變（只在有等待 / 淡化時出現一列，符合 D201「不改隱藏已分離工作區」的精神），且點擊行為與 D200 ⑤ 一致（跳到等最久的分頁）。
- 影響範圍：`src/App.tsx`、`src/components/WorkspaceWaitingBadge.tsx`、`src/stores/terminal-attention-store.ts`（或新 store）、`electron/main.ts`、`electron/preload.ts`、i18n 三語、`e2e/`、`docs/agent-guide/worker-tab-recycle.md` / `detached-workspace.md`、CLAUDE.md 一行。
- 阻塞：是（Step 2 實作起要等答覆）

### 完成狀態

### 產出摘要

### 遭遇問題

### 回報時間
