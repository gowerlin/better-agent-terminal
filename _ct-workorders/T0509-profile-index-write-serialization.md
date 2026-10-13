---
schema_version: 1
schema_kind: workorder
id: T0509
title: "profile-manager：index.json 讀改寫未序列化 → 並行 profile:create 在 Windows rename EPERM（plan039 M3 重現）、共用 .tmp 互相覆蓋、可能遺失更新"
type: implementation
status: TODO
repo: better-agent-terminal
project: D139
priority: P2
sizing: S
created_at: "2026-10-14T01:00:02+08:00"
started_at: null
updated_at: "2026-10-14T01:00:02+08:00"
completed_at: null
target_version: v0.6.0-pre.5
depends_on:
  - "T0508"
related:
  - "T0508 回報區「偏差 / 殘餘風險」1：`electron/profile-manager.ts` `writeIndex()`（:310 起）先 `readIndexFile` + `copyFile(→ .bak)`、寫 `index.json.tmp`、再 `rename`；並行 `profile:create` → `EPERM: operation not permitted, rename '…\\profiles\\index.json.tmp' -> '…\\profiles\\index.json'`；e2e `plan039-multi-remote` M3 在「新 spec + 完整回歸集」組合 2/2 重現"
  - "呼叫點：`profile-manager.ts:418 / 468 / 503 / 537 / 552`（create / update / delete 等的讀改寫）；T0491 `WindowRegistry` 序列化佇列（`updateEntry` / `withEntry` / `whenIdle`）為範本"
affects_files:
  - "electron/profile-manager.ts"
  - "electron/__tests__/"
renew_count: 0
workdir: main repo
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 不只 `writeIndex` 加鎖：整個「讀 index → 改 → 寫」要在同一序列化單元內（否則並行 create 仍會遺失更新），比照 T0491 `WindowRegistry.updateEntry`；所有呼叫點 trace 並遷移"
  - "🔴 `.bak` 輪替與 corruption fallback 語意不變；`.tmp` 檔名在序列化下可維持，若改唯一檔名須清理殘留"
  - "🔴 EPERM / EBUSY（Windows 防毒 / 索引器鎖檔）可做有限重試（次數與退避寫明），不得無限重試；不得吞掉錯誤"
  - "🔴 批次並行（D139）：`git commit --only` 本單檔案；不改 CLAUDE.md（建議文字寫回報區由 T0493 套用）；`npm run typecheck` / `npm run typecheck:electron` 維持 0"
  - "🔴 不得以預設實例（無 `--runtime`）啟動 source build；e2e 一律 isolated runtime"
  - "🔴 不 push、不觸發 workflow；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`；換行維持各檔現況"
---

# T0509 — profile index 序列化

## 實作

1. 盤點 `profile-manager.ts` 所有讀改寫 index 的路徑（含 IPC handler 與 remote 路徑）
2. 以單一序列化佇列（或 mutex）包住讀改寫；`writeIndex` 的 rename 對 EPERM / EBUSY 有限重試
3. 單元測試：並行 N 個 create / update / delete → 結果包含全部變更、無 EPERM、`.bak` 正確；對照組（移除序列化）會遺失更新或報錯
4. e2e：`plan039-multi-remote` 與 T0508 回報的完整回歸組合（含 `detached-close-edges`）連跑 ≥ 2 次皆綠

## 驗收條件

- [ ] 呼叫點遷移清單；單元（含對照組）；e2e 組合連跑證據
- [ ] `npm run test:unit`、`npx vite build`、`npm run typecheck`、`npm run typecheck:electron`
- [ ] 回報區：CLAUDE.md 建議文字、`git diff --stat`

## Sub-session 執行指示

1. 讀本工單 + D139 + T0508 回報區 + `electron/profile-manager.ts` + `electron/window-registry.ts`（佇列範本）
2. 填 `started_at`、`status: IN_PROGRESS`（取系統時間，R-G001）
3. 實作 → 驗收 → 填回報區 → `DONE`；`git commit --only` 本單檔案與改動；不 push；依派發 mode 通知塔台

---

## 回報區

（Worker 填寫）
