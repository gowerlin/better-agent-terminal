---
schema_version: 1
schema_kind: workorder
id: T0532
title: "BUG-134 後續：adoptDetached focus 不跨工作區（BUG-135）＋ 新工作區預設終端建立中不閃空狀態"
type: implementation
status: TODO
repo: better-agent-terminal
project: BUG-135
priority: P3
sizing: S
created_at: "2026-10-15T01:32:28+0800"
started_at: null
updated_at: "2026-10-15T01:32:28+0800"
completed_at: null
target_version: "0.6.0-pre.12"
related:
  - BUG-135
  - "BUG-134 / T0531（空狀態 `terminals-empty-state`、`removeTerminal` focus 修正）"
affects_files:
  - src/stores/workspace-store.ts
  - src/components/WorkspaceView.tsx
  - src/styles/layout.css
  - src/stores/__tests__/
  - src/components/__tests__/
  - e2e/
  - _ct-workorders/T0532-workspace-focus-fallback-and-empty-state-flash.md
  - _ct-workorders/BUG-135-adopt-detached-focus-crosses-workspace.md
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 不碰使用者正在用的 BAT（port 9876、真實 userData）；e2e 一律隔離實例。不消耗 token：只用一般 shell 終端或自訂 CLI 跑 node 腳本。"
  - "🔴 **禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）；寫檔 LF；不 push；不跑全套 e2e（L141）。`src/styles/settings.css` 的 M 狀態不是你的變更，不要 commit 它；commit 用 `--only`。"
  - "🔴 改 `src/**` 驗收 `npm run typecheck` = 0；改 `electron/**` 驗收 `npm run typecheck:electron` = 0。"
  - "🔴 Detached 視窗持久化規則不得破壞（CLAUDE.md「Detached workspace 視窗的持久化」：adopt 流程、所有權釋放、save 佇列順序不變，只改 focus 選擇）。"
---

# T0532 — focus fallback 不跨工作區 ＋ 空狀態不閃

## 背景

T0531（`d41280ae`，BUG-134）修正後留下兩件事（見 T0531 回報區「偏差 / 備註」）：

1. **BUG-135**：`workspace-store.ts` 的 detached 終端取回路徑（`adoptDetached` 一帶，約 L908）focus fallback 仍是全域 `terminals[0]`，與 T0531 修掉的 `removeTerminal()` 同類
2. 全新工作區第一次啟用時，在預設終端建立完成前（非同步取 shell 路徑），會短暫顯示 T0531 新增的空狀態（含「新增終端」按鈕）。這一下若剛好點到按鈕，會多開一個終端

## 任務

1. **BUG-135**：盤點 `workspace-store.ts` 所有設定 `focusedTerminalId` 的 fallback（不只 adoptDetached），凡是會落到全域第一個終端的，改成限定在對應工作區（被移除 / 取回終端所屬工作區，或 active 工作區，依各處語意判斷並在回報區說明），沒有則 `null`（或保持原值，依語意）
2. **空狀態不閃**：工作區正在自動建立預設終端時，終端分頁不顯示空狀態（顯示不透明的空白底或既有 loading 樣式，不得回到透明，以免再透出其他工作區 —— BUG-134）。自動建立完成或失敗後，0 個終端才顯示空狀態。使用者主動關掉最後一個終端時仍立即顯示空狀態（T0531 行為不變）
3. 不改 T0531 的 CSS 隱藏規則

## 驗證

- 單元測試：各 focus fallback 不跨工作區（修正前紅、修正後綠）
- 單元 / source guard 或 e2e：預設終端建立中不渲染 `terminals-empty-state`；建立完成後不出現；關掉最後一個終端後出現
- `npm run typecheck` = 0、`npx vite build` exit 0、`npm run test:unit` 全套無回歸
- e2e 不回歸：`t0531-empty-workspace-view`、`detached-workspace`、`detached-terminal-persistence`（`--workers=1`）

## 驗收條件

- [ ] focus fallback 全面不跨工作區，回報區列出改動的每個位置與語意
- [ ] 新工作區首次開啟不閃空狀態，且不透出其他工作區
- [ ] BUG-134 行為（關掉最後一個終端 → 空狀態）不回歸
- [ ] BUG-135：`status: FIXED`、`fixed_at`、body 狀態列同步

## Sub-session 執行指示

1. 讀本工單、BUG-135、T0531 回報區、BUG-134 根因
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 實作 → 驗證 → 填回報區（DONE / PARTIAL / BLOCKED）
4. commit（`--only`）；不 push；依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 結果摘要

### 修改檔案

### 驗證

### 偏差 / 備註

### Commit
