---
schema_version: 1
schema_kind: workorder
id: T0432
title: "PLAN-036 P3 / K 工單 2：RemoteServer 每 PTY 範圍權杖（簽發 / 撤銷 / channel 白名單 / 目標綁定）+ token 比對 timingSafeEqual + log 不印 token 前綴"
type: implementation
status: PENDING
repo: better-agent-terminal
project: PLAN-036
priority: P1
sizing: M
created_at: "2026-10-05T05:49:04+08:00"
started_at: null
updated_at: "2026-10-05T05:49:04+08:00"
completed_at: null
target_version: next
depends_on:
  - T0431
  - T0424
related:
  - "T0420 研究回報區「各單內容」工單 2、§2 安全分析；方案 A'（使用者裁決）"
  - "T0420「遭遇問題」範圍外 ②：`remote-server.ts:551` log 印出 token 前 8 碼（塔台併入本單）"
  - "D134 追加（K 實作）"
affects_files:
  - electron/remote/remote-server.ts
  - electron/remote/helper-capability.ts
  - electron/pty-manager.ts
  - electron/handlers/pty.ts
  - electron/remote/headless-entry.ts
  - electron/remote/__tests__/
  - electron/__tests__/
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **安全單**（T0420 標 🟡）：預設拒絕。權杖只能呼叫白名單 channel（T0420 定義：`terminal:create-with-command` / `create-agent-command` / `notify` / `keypress` 的子集，依角色），且只能作用於綁定的 target；**不得**呼叫 `pty:create` / `pty:write`（Tower 權杖）/ `fs:*` / `claude:*` / `git:*` / `profile:*` / `settings:*`。每條負向測試都要有。"
  - "🔴 權杖：`crypto.randomBytes(32)`，只存記憶體（不落地、不寫 log、不進 snapshot），PTY exit 即撤銷，server restart 後全部失效。server token 與權杖的比對一律 `crypto.timingSafeEqual`（長度不同先回 false）。"
  - "🔴 log：移除 / 遮蔽 `remote-server.ts` 印出 token 前綴的 log（T0420 範圍外 ②，併入本單）；新 log 只記 terminalId / role，不記權杖任何部分。"
  - "🔴 helper 連線不計入 idle reclaim / 孤兒 PTY 回收的 client 數（T0404 機制），否則遠端 helper 一直連著會讓孤兒 PTY 永不回收。"
  - "🔴 本單只提供簽發 / 驗證機制與 PTY exit hook；**不**把權杖注入 PTY env（T0433）。本機 Electron 的 RemoteServer 行為：權杖機制可共用，但本機 PTY 注入方式不變（回移 A' 不在範圍，T0420 範圍外 ③）。"
  - "🔴 依賴 T0431（handler 路由）與 T0424（同改 `pty-manager.ts` / `handlers/pty.ts`）。開工前 `git log --oneline -8` 確認；共用檔 commit 前 `git diff <file>` 確認只含本單 hunk。"
  - "🔴 **只跑 `npm run test:unit` + `npx tsc --noEmit`；不跑 `npx vite build` / `npm run test:e2e`**（L141）。**禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）；`git commit --only`；不 push；不部署 WSL。"
---

# T0432 — 每 PTY 範圍權杖（K 工單 2）

## 背景

T0420 方案 A'：headless 為每個 PTY 簽發範圍權杖，讓遠端 shell 內的 helper（`bat-terminal.mjs` / `bat-notify.mjs`）只能做少數 Tower 操作，外洩影響限於單一 PTY。本單實作 server 端機制。

## 範圍

依 T0420「各單內容」工單 2：
1. `electron/remote/helper-capability.ts`（新）：`HelperCapabilityRegistry`（簽發 / 查詢 / 撤銷；`token → { terminalId, towerId?, role }`）
2. RemoteServer auth：接受權杖 → 連線標 helper 角色；invoke 時檢查 channel 白名單與 target 綁定
3. PTY exit hook 撤銷；helper 連線不計入 client 數
4. `timingSafeEqual`；log 遮蔽
5. 負向測試全套（memory_overrides 第 1 條）+ 正向：合法權杖可呼叫白名單 channel

## 驗收條件

- [ ] 回報區附白名單表（角色 × channel × target 規則）與負向測試清單
- [ ] `npm run test:unit` 全綠；`npx tsc --noEmit` ≤ 40
- [ ] 完成後塔台會安排安全 review（T0420 🟡）

## Sub-session 執行指示
1. 讀本工單 + T0420 回報區全文（尤其 §2 安全分析）+ T0431 回報區 + T0404 回報區（client 計數 / 回收）
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 實作 → 驗收
4. 填回報區；完成寫 **`DONE`**
5. `git commit --only` 實際改動檔 + 本工單；不 push
6. 依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

### 產出摘要

### 遭遇問題

### 回報時間
