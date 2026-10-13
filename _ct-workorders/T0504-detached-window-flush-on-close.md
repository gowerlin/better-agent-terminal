---
schema_version: 1
schema_kind: workorder
id: T0504
title: "detached 視窗關閉前 flush-save：rename / sdkSessionId 等非增刪變更不再因 30 秒 autosave 間隔遺失"
type: implementation
status: TODO
repo: better-agent-terminal
project: D139
priority: P3
sizing: S
created_at: "2026-10-14T00:01:28+08:00"
started_at: null
updated_at: "2026-10-14T00:01:28+08:00"
completed_at: null
target_version: v0.6.0-pre.5
depends_on:
  - "T0491"
  - "T0496"
  - "T0498"
related:
  - "T0491 回報區「偏差 / 殘餘風險」：detached 視窗的非增刪變更（rename、sdkSessionId 等）靠 30 秒 autosave / quit flush；detached 視窗直接關閉時最後 30 秒內的這類變更可能遺失"
  - "T0491 設計：`saveDetachedWorkspaceTerminals`、`DetachedTerminalOwners`、closed → `whenIdle` → `workspace:reattached` → `workspace:adopt-detached`（save 佇列內）"
affects_files:
  - "electron/main.ts"
  - "electron/window-registry.ts"
  - "src/stores/workspace-store.ts"
  - "src/App.tsx"
  - "electron/__tests__/"
  - "src/stores/__tests__/"
  - "e2e/"
renew_count: 0
workdir: main repo
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 不得破壞 T0491 的順序保證：detached 最後一次 save 必須在 `whenIdle()` → `workspace:reattached` 之前進入 registry 佇列；flush 失敗或逾時不得阻擋視窗關閉（設上限並記 log）"
  - "🔴 排在 T0498 之後：兩者都可能改 `electron/preload.ts` / `src/types/electron.d.ts`"
  - "🔴 不得回到「detached store 覆寫父 entry」：flush 仍走 `saveDetachedWorkspaceTerminals`"
  - "🔴 批次並行（D139）：`git commit --only` 本單檔案；不改 CLAUDE.md（建議文字寫回報區由 T0493 套用）；`npm run typecheck` / `npm run typecheck:electron` 維持 0（T0496 後）"
  - "🔴 不得以預設實例（無 `--runtime`）啟動 source build；e2e 一律 isolated runtime"
  - "🔴 不 push、不觸發 workflow；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`；換行維持各檔現況"
---

# T0504 — detached 視窗關閉前 flush

## 實作

- detached 視窗關閉時（使用者關窗 / reattach），在視窗銷毀前觸發一次 save（例如 main 端 `close` 事件 `preventDefault` → 要求 renderer flush → 收到 ack 或逾時後再關閉；或 renderer `beforeunload` 同步送出——擇一並說明可靠性）
- 確認 quit 路徑（既有 flush-save 含 detached）不重複、不死鎖
- 測試：單元（順序：flush save 先於 reattached；逾時仍關閉）；e2e（isolated）：detached 視窗內 rename 終端 → 立即關閉 → 父視窗 / registry entry 顯示新名稱；重啟後仍正確

## 驗收條件

- [ ] 單元 + e2e；既有 `detached-terminal-persistence` / `detached-workspace` / `smoke` 回歸
- [ ] `npm run test:unit`、`npx vite build`、`npm run typecheck`、`npm run typecheck:electron`
- [ ] 回報區：設計選擇、逾時值、CLAUDE.md 建議文字、`git diff --stat`

## Sub-session 執行指示

1. 讀本工單 + D139 + T0491 回報區 + 相關檔案
2. 填 `started_at`、`status: IN_PROGRESS`（取系統時間，R-G001）
3. 實作 → 驗收 → 填回報區 → `DONE`；`git commit --only` 本單檔案與改動；不 push；依派發 mode 通知塔台

---

## 回報區

（Worker 填寫）
