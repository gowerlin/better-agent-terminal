---
schema_version: 1
schema_kind: workorder
id: T0481
title: "BUG-119 修復 B：本機 PTY 注入 userData 相關 env，helper（_bat-cert / _bat-logger）改以 env 解析路徑，不再靠 app 名稱猜 runtime 目錄"
type: implementation
status: TODO
repo: better-agent-terminal
project: BUG-119
priority: P2
sizing: S
created_at: "2026-10-13T22:32:56+08:00"
started_at: null
updated_at: "2026-10-13T22:32:56+08:00"
completed_at: null
target_version: v0.6.0-pre.4
depends_on:
  - T0479
related:
  - "D138；T0479 回報區第 5 節表格 B 列、第 6 節（R5 helper 消費者表）"
  - "CLAUDE.md「遠端 Tower 通知（PLAN-036 K）」：headless 的 BAT_HELPER_LOG_DIR / BAT_SERVER_CERT_PATH 行為不得改變"
affects_files:
  - electron/pty-manager.ts
  - scripts/_bat-cert.mjs
  - scripts/_bat-logger.mjs
  - electron/__tests__/pty-manager-helper-env.test.ts
  - scripts/__tests__/server-bundle-helpers.test.mjs
renew_count: 0
workdir: main repo
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 不改 `electron/main.ts`、`electron/snippet-db.ts`、新增的 bootstrap / migration 模組（T0480 並行處理）"
  - "🔴 headless（`electron/remote/headless-entry.ts`）注入的 `BAT_HELPER_LOG_DIR` / `BAT_SERVER_CERT_PATH` 語意與優先序不變；本機 PTY 新增的 env 不得把 server token 以外的權限擴大"
  - "🔴 helper 改動須同時相容 T0480 之前（userData 為 `better-agent-terminal-runtime-N` 等）與之後的目錄 —— 以 env 為準即可兩者皆對"
  - "🔴 不 push、不觸發 workflow；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`"
---

# T0481 — helper 路徑改以 env 為準

## 背景（T0479 R5）

- `scripts/_bat-cert.mjs:20-38`、`scripts/_bat-logger.mjs:28-63` 以 `BetterAgentTerminal` + `BAT_RUNTIME` 猜目錄；以 `--runtime=N` 啟動時 PTY 沒有 `BAT_RUNTIME`，helper 讀到預設實例 cert → fail-close
- `BAT_USER_DATA` 只經 terminal-server 路徑的 PTY 繼承，main 的 fallback spawn 路徑（`electron/pty-manager.ts:668-683`、`:734-753`）沒有

## 實作

1. `electron/pty-manager.ts` 兩條 spawn 路徑都注入 userData 資訊：`BAT_USER_DATA`，或直接 `BAT_SERVER_CERT_PATH` + `BAT_HELPER_LOG_DIR`（擇一並說明；注意 headless 已用後兩者，語意須一致：cert 檔完整路徑 / log 目錄）
2. `scripts/_bat-cert.mjs`、`scripts/_bat-logger.mjs` 解析順序：明確 override（`BAT_SERVER_CERT_PATH` / `BAT_HELPER_LOG_DIR`）→ `BAT_USER_DATA` → `APP_NAME` + `BAT_RUNTIME`（舊行為 fallback）。順手修 `_bat-logger.mjs:12` Linux `logs` 小寫註解與 `:28` 過期的 `main.ts:121` 行號
3. 測試：`electron/__tests__/pty-manager-helper-env.test.ts`（`:146` 目前斷言本機 `BAT_HELPER_LOG_DIR` 為 undefined，依新設計修改）；helper 解析順序測試（`--runtime=N` 無 `BAT_RUNTIME` 但有 `BAT_USER_DATA` → 正確 cert；只有 `BAT_RUNTIME` → 舊行為；headless env → 不變）
4. 若 `verify-helper-bundle` / `extraResources` 受影響，`npm run verify:helpers` 須通過

## 驗收條件

- [ ] 本機 PTY env（兩條 spawn 路徑）帶正確 userData 資訊（單元測試）
- [ ] helper 在 `--runtime=N`（無 `BAT_RUNTIME`）與 `BAT_RUNTIME=N` 兩情境都解析到正確 `server-cert.json` / log 目錄（單元測試）
- [ ] headless env 行為不變（既有測試全綠）
- [ ] `npm run test:unit` 全綠（回報數字）；`npx vite build` exit 0；`npm run verify:helpers` ✅
- [ ] 回報區附 `git diff --stat`

## Sub-session 執行指示

1. 讀本工單 + D138 + T0479 回報區第 5、6 節 + 上列 affects_files + `electron/remote/headless-entry.ts:280-300`
2. 填 `started_at`、`status: IN_PROGRESS`（取系統時間，R-G001）
3. 實作 → 驗收 → 填回報區 → `DONE`；commit 本單檔案與改動；不 push；依派發 mode 通知塔台

---

## 回報區

（Worker 填寫）
