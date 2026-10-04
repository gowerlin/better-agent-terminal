---
schema_version: 1
schema_kind: workorder
id: T0426
title: "BUG-099 + BUG-100：精靈取消時 rollback 失敗中的步驟；實作 ssh.stopServer / ssh.uninstallBundle IPC（preload + main）"
type: fix
status: PENDING
repo: better-agent-terminal
project: BUG-099
priority: P2
sizing: M
created_at: "2026-10-05T05:35:22+08:00"
started_at: null
updated_at: "2026-10-05T05:35:22+08:00"
completed_at: null
target_version: next
depends_on:
  - T0425
related:
  - "BUG-099（runner cancel 不 rollback 失敗中的步驟）；BUG-100（`ssh.stopServer` / `ssh.uninstallBundle` 只有型別）"
  - "T0387（SSH fetch-fingerprint 失敗時自行關 tunnel 的繞道）；PLAN-032"
  - "D134（本 session 排程表第 10 列；兩 BUG 合一張）"
affects_files:
  - src/components/setup-wizard/wizard-runner.ts
  - src/components/setup-wizard/steps/ssh/
  - src/components/setup-wizard/steps/wsl/
  - src/components/setup-wizard/steps/docker/
  - src/components/setup-wizard/__tests__/
  - electron/preload.ts
  - electron/main.ts
  - electron/remote/ssh-start-server.ts
  - src/types/electron.d.ts
  - electron/__tests__/
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **決策已定（D134）：實作兩個 IPC**（不是刪型別）。child_process 一律 `execFile` / `spawn` + array args；sshHost / profileId / path 等外部輸入必過 `/^[a-zA-Z0-9._-]+$/` 白名單（ssh host 若含 `@` / `:` 需另訂嚴格白名單並在回報區說明）；timeout 必設（IO 30s）。遠端執行的指令只能是 hardcoded 字串組合（systemctl --user stop / disable、移除 `~/.local/bat-server` 等），不得拼接未驗證輸入。參考現有 `ssh.startServer` / `ssh.installBundle` 的實作方式，沿用其連線與 quoting 慣例。"
  - "🔴 **rollback 冪等性**：runner 改成取消時 rollback 失敗中的步驟之前，逐一檢查 WSL / Docker / SSH 所有有 `rollback()` 的步驟——對「只執行一半」的狀態呼叫 rollback 是否安全（重複刪除、服務不存在時不報錯）。不安全的步驟修成冪等；回報區附步驟 × 冪等性表格。"
  - "🔴 移除 T0387 的「SSH fetch-fingerprint 失敗時自行關 tunnel」繞道前，確認 runner 新行為已涵蓋，否則保留。"
  - "🔴 依賴 T0425（同改 `steps/ssh/`）。開工前 `git log --oneline -3` 確認。"
  - "🔴 同工作樹有其他 Worker 平行。**只跑 `npm run test:unit` + `npx tsc --noEmit`；不跑 `npx vite build` / `npm run test:e2e`**（L141）。"
  - "🔴 **禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）；`git commit --only`；不 push；不對任何實際 SSH 主機執行。"
---

# T0426 — 精靈取消 rollback + SSH stop / uninstall IPC（BUG-099 + BUG-100）

## 背景

- BUG-099：`src/components/setup-wizard/wizard-runner.ts` `cancel()` 以 `retry` 結果解除等待，迴圈頂端只 rollback **已完成**步驟，失敗中的步驟 `rollback()` 不被呼叫
- BUG-100：`src/types/electron.d.ts` 宣告 `ssh.stopServer` / `ssh.uninstallBundle`（註解「real IPC handlers land in a follow-up workorder」），`electron/preload.ts` / `electron/main.ts` 無實作 → SSH `start-server` 步驟 rollback 拋錯，runner 只記 warn ⇒ SSH 精靈失敗後遠端殘留已啟動的服務 / bundle

## 範圍

1. 實作 `ssh:stop-server` / `ssh:uninstall-bundle` IPC（main + preload，型別對齊既有宣告）
2. runner：取消時對當前失敗步驟呼叫 `rollback()`，再依序 rollback 已完成步驟
3. 冪等性盤點與修正（memory_overrides 第 2 條）
4. 測試：runner cancel 呼叫失敗步驟 rollback；IPC handler 以 mock `execFile` 驗證 args 陣列、白名單拒絕、timeout；SSH start-server rollback 不再拋錯

## 驗收條件

- [ ] 回報區附冪等性表格
- [ ] `npm run test:unit` 全綠；`npx tsc --noEmit` ≤ 40
- [ ] BUG-099 / BUG-100 改 `FIXED` 並填 `links.fix_workorder: T0426`
- [ ] 回報區附實機步驟（SSH 精靈在 start-server 後的步驟故意失敗 → 取消 → 遠端服務與 bundle 已清除）；實機由使用者執行

## Sub-session 執行指示
1. 讀本工單 + BUG-099 + BUG-100 + T0387 回報區 + 現有 `ssh.startServer` / `ssh.installBundle` 實作
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 實作 → 驗收
4. 填回報區；完成寫 **`DONE`**
5. `git commit --only` 實際改動檔 + 本工單 + BUG-099 + BUG-100；不 push
6. 依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

### 產出摘要

### 遭遇問題

### 回報時間
