---
schema_version: 1
schema_kind: workorder
id: T0761
title: "detached 視窗的工作區也提示等待使用者 ⚠️（D200 ⑥ / D201 延後項）：先提呈現方式，使用者選定後實作"
type: implementation
status: PENDING
updated_at: "2026-11-02T02:23:44+0800"
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

### 完成狀態

### 產出摘要

### 遭遇問題

### 回報時間
