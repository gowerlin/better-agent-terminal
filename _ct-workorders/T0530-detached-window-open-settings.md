---
schema_version: 1
schema_kind: workorder
id: T0530
title: "detached 視窗「開啟設定」無反應（BUG-133）：讓 detached 視窗能開啟 Settings"
type: implementation
status: PENDING
repo: better-agent-terminal
project: BUG-133
priority: P3
sizing: S
created_at: "2026-10-14T18:09:18+0800"
started_at: ""
updated_at: "2026-10-14T18:09:18+0800"
completed_at: ""
target_version: "0.6.0-pre.10"
related:
  - BUG-133
  - "T0529（detached 分支的唯讀工作區設定、分頁列齒輪按鈕）"
affects_files:
  - src/App.tsx
  - src/components/SettingsPanel.tsx
  - src/components/WorkspaceView.tsx
  - electron/main.ts
  - electron/preload.ts
  - src/types/electron.d.ts
  - src/__tests__/
  - src/components/__tests__/
  - electron/__tests__/
  - e2e/
  - _ct-workorders/T0530-detached-window-open-settings.md
  - _ct-workorders/BUG-133-detached-window-open-settings-noop.md
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 不碰使用者正在用的 BAT（port 9876、真實 userData）；e2e 一律隔離實例。不消耗 token。"
  - "🔴 **禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）；寫檔 LF；不 push；不跑全套 e2e（L141）。`src/styles/settings.css` 的 M 狀態不是你的變更，不要 commit 它；commit 用 `--only`。"
  - "🔴 改 `src/**` 驗收 `npm run typecheck` = 0；改 `electron/**` 驗收 `npm run typecheck:electron` = 0。"
  - "🔴 Detached 視窗持久化規則不得破壞（CLAUDE.md「Detached workspace 視窗的持久化」）。Settings 是全域設定（`settings.json`，非 workspace entry），要確認 detached 視窗改 Settings 後主視窗與其他視窗的同步行為正確（例如既有的 settings 廣播 / 重新讀取機制），不得造成兩邊互相覆寫。"
---

# T0530 — detached 視窗「開啟設定」（BUG-133）

## 背景

T0529 發現：detached 視窗中的 `onOpenSettings`（GitHub 面板等）只做 `setShowSettings(true)`，但 `src/App.tsx` 的 detached 分支沒有渲染 `SettingsPanel`，按了沒反應。詳見 **BUG-133**、T0529 回報區「偏差 / 備註」第 4 點。

## 任務

1. 盤點 detached 分支內所有會觸發 `onOpenSettings` / `setShowSettings` 的入口
2. 擇一修正（Worker 依架構判斷並說明取捨）：
   - [A] detached 分支也渲染 `SettingsPanel`：需確認 Settings 在多視窗同時開啟 / 修改時不互相覆寫（全域設定的寫入與廣播路徑）
   - [B] 在 detached 視窗按下時，改為把主視窗帶到前景並在主視窗開啟 Settings（經 main IPC）
   - 不建議：隱藏按鈕（功能退化）
3. 不改 T0529 的工作區設定唯讀行為

## 驗證

- 單元 / source guard：detached 分支的開啟設定入口有實際效果
- 可行的話，隔離實例 e2e：detach 一個工作區 → 觸發開啟設定 → Settings 出現（A）或主視窗出現 Settings（B）
- `npm run typecheck` = 0、`npm run typecheck:electron` = 0（若改 electron）、`npx vite build` exit 0、`npm run test:unit` 全套無回歸；detached 相關既有 e2e（`detached-flush-on-close`、`detached-close-edges`）不回歸

## 驗收條件

- [ ] detached 視窗按「開啟設定」有效
- [ ] 全域設定不因多視窗而互相覆寫
- [ ] BUG-133：`status: FIXED`、`fixed_at`、body 狀態列同步

## Sub-session 執行指示

1. 讀本工單、BUG-133、T0529 回報區
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
