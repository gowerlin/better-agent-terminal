---
schema_version: 1
schema_kind: workorder
id: T0431
title: "PLAN-036 P3 / K 工單 1：headless terminal:* 上線（共用 electron/handlers/terminal.ts）+ terminal:created-externally / keypress 事件補齊"
type: implementation
status: PENDING
repo: better-agent-terminal
project: PLAN-036
priority: P2
sizing: M
created_at: "2026-10-05T05:49:04+08:00"
started_at: null
updated_at: "2026-10-05T05:49:04+08:00"
completed_at: null
target_version: next
depends_on:
  - T0429
  - T0430
related:
  - "T0420 研究（`7bb4692`）回報區「拆單建議摘要」第 1 列與「各單內容」工單 1；方案 A'（使用者裁決）"
  - "T0420 拆單第 2-4 列 → T0432 / T0433 / T0434"
  - "D134 追加（K 實作，研究結論）"
affects_files:
  - electron/handlers/terminal.ts
  - electron/terminal-command-handlers.ts
  - electron/main.ts
  - electron/remote/protocol.ts
  - electron/remote/path-aware-channels.ts
  - electron/remote/headless-entry.ts
  - electron/remote/headless-channel-status.ts
  - src/stores/workspace-store.ts
  - electron/__tests__/
  - electron/remote/__tests__/
  - src/__tests__/
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **規格來源**：T0420 回報區「各單內容」工單 1 段落 + §1 現況盤點 + §3 端到端流程。本單**不含**權杖（T0432）與 helper 出貨 / env 注入（T0433）——headless 的 `terminal:*` 在本單只需在「已通過既有 server token 認證的 client」下可用。"
  - "🔴 **本機行為不得改變**：`buildAgentPromptCommand` 抽成 electron-free 模組後，Electron 端由 deps 注入原本的 settings reader / workspace default agent / elevation；以既有測試 + 新增對照測試鎖住本機輸出逐字不變。"
  - "🔴 遠端來源的 `terminal:created-externally` 在 renderer 查不到 workspace 時**忽略、不 fallback 到目前 active workspace**（BUG-031 / T0137 的行為只適用本機）。`cwd` 列入 path-aware 事件轉換；T0416 / T0406 的全分類守門（含 `PROXIED_EVENTS`）必須維持綠。"
  - "🔴 依賴 T0429（`headless-entry.ts`）與 T0430（`main.ts`）。開工前 `git log --oneline -8` 確認。共用檔 commit 前 `git diff <file>` 確認只含本單 hunk。"
  - "🔴 **只跑 `npm run test:unit` + `npx tsc --noEmit`；不跑 `npx vite build` / `npm run test:e2e`**（L141）。**禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）；`git commit --only`；不 push；不部署 WSL。"
---

# T0431 — headless terminal:* + 事件（K 工單 1）

## 背景

T0420 研究結論：遠端 Tower 通知採 A'（每 PTY 範圍權杖）。第一步是讓 headless server 具備 `terminal:create-with-command` / `terminal:create-agent-command` / `terminal:notify` / `terminal:keypress`（目前在 `HEADLESS_UNSUPPORTED` P3），並讓 `terminal:created-externally` / `notified` / `keypress` 事件經 broadcastHub 送到 client。

## 範圍

依 T0420「各單內容」工單 1：
1. `buildAgentPromptCommand` 抽成 electron-free 模組（deps 注入；headless 用 `<dataDir>/settings.json`，workspace default agent 回 null）
2. 新增 `electron/handlers/terminal.ts`，兩端共用 `terminal:create-*` / `notify` / `keypress`；事件經 host `emit`（Electron = windows + broadcastHub；headless = broadcastHub）
3. `PROXIED_EVENTS` 加 `terminal:created-externally`（`cwd` 列入 `PATH_EVENT_CHANNELS`）與 `terminal:keypress`（path-free）；`headless-channel-status.ts` 這 4 個 channel 改為已支援
4. renderer：遠端來源 `created-externally` 查不到 workspace 時忽略；headless keypress 在沒有 client 時回 `no-client`
5. 測試：parity / 全分類守門、headless harness invoke `terminal:create-agent-command` → 收到 `created-externally` 事件、本機輸出不變

## 驗收條件

- [ ] `HEADLESS_UNSUPPORTED` 只剩 codex 控制 2 個（回報區附前後計數）
- [ ] `npm run test:unit` 全綠；`npx tsc --noEmit` ≤ 40

## Sub-session 執行指示
1. 讀本工單 + T0420 回報區全文 + T0416 回報區（path-aware 分類）
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
