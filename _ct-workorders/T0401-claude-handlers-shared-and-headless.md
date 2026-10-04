---
schema_version: 1
schema_kind: workorder
id: T0401
title: "PLAN-036 P1-F：claude:* 搬入共用模組 electron/handlers/claude.ts 並上線 headless；archive 改 always-local；codex / stub 類 unsupported + UI 降級；PROXIED_EVENTS 補齊"
type: impl
status: PENDING
repo: better-agent-terminal
project: PLAN-036
priority: P1
sizing: L
created_at: "2026-10-05T02:12:37+08:00"
target_version: next
depends_on:
  - T0400
  - T0403
related:
  - "PLAN-036 P1 佇列（D130）：T0400 E ✅ → **T0401 F** → T0402 G"
  - "T0386 回報區 §1（claude:* 三分類 A / B / C）、§4（claude runtime / auth）、建議清單 F"
  - "T0400 回報區「後續建議」：`new ClaudeAgentManager(hostDeps)` 可直接用；`broadcastRuntimeEvent` 與 `createElectronClaudeEmit` 重複"
affects_files:
  - electron/handlers/claude.ts
  - electron/handlers/types.ts
  - electron/main.ts
  - electron/remote/protocol.ts
  - electron/remote/headless-entry.ts
  - electron/remote/headless-handlers.ts
  - electron/remote/headless-channel-status.ts
  - electron/claude-agent-manager.ts
  - src/components/ClaudeAgentPanel.tsx
  - src/components/
  - src/locales/
  - scripts/smoke-remote-headless.mjs
  - scripts/__tests__/smoke-remote-headless.test.mjs
  - electron/__tests__/
  - electron/remote/__tests__/
  - src/components/__tests__/
interaction:
  mode_hint: on
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **本機 Claude / Codex 面板行為不得改變**：搬移是逐字搬，handler 內部邏輯不重寫。e2e E1（43 個 `claude:*` 皆有 IPC 綁定）必須仍 PASS。"
  - "🔴 **不送真實 Claude API 對話**（不消耗 token）。headless 端以 harness 驗證註冊、`get-cli-path` / `detectRuntime` / `auth-status` / `get-supported-models` 等不需登入的 channel。"
  - "🔴 **不得部署到 WSL、不得 restart `bat-server.service`**：完成後由塔台部署並跑 smoke。"
  - "🔴 system runtime 絕不注入 `DISABLE_UPDATES`（CLAUDE.md T0372 規則）；headless embedded（bundle `bin/claude`）必須注入。"
  - "🔴 **禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）。不 push。"
---

# T0401 — claude:* 共用註冊 + headless 上線（PLAN-036 P1-F）

## 元資料
- **工單編號**：T0401
- **任務名稱**：claude:* 上遠端
- **狀態**：PENDING
- **建立時間**：2026-10-05 02:12 (UTC+8)
- **intervention_type**：fire-and-forget
- **預估規模**：L
- **降級策略**：若 context 不足，先完成「1. 搬移（Electron 端行為不變）」並 commit，回報 **PARTIAL**，headless 上線與 UI 降級由塔台 Renew / 續單

## 背景

- P0 後遠端視窗有終端，但 Claude Agent 面板的 `claude:*` 在 headless 一律 `No handler for channel`（T0396 S8 實測）
- T0400 已讓 `ClaudeAgentManager` 不 import electron，建構子吃 `Pick<HostDeps, 'emit' | 'getSettings' | 'notifier'>`；headless 直接傳 `HostDeps`（無 notifier ⇒ 不發通知）
- T0389 已讓 `claude-runtime-router` 可在 headless 注入設定與 bundle `bin/claude` embedded 路徑
- `electron/main.ts:2226-2674`：43 個 `registerHandler('claude:...')`；`electron/remote/headless-channel-status.ts` 目前把 43 個 `claude:*` 列在 `HEADLESS_UNSUPPORTED`（P1）

## 範圍

### 1. 搬移（Electron 端行為不變）
- 新增 `electron/handlers/claude.ts` 的 `registerClaudeHandlers(register, deps)`，把 `main.ts` 的 `claude:*` 註冊逐字搬入；main.ts 改呼叫它並以 Electron deps 組裝
- 需要的 host 能力以 `HostDeps` 欄位注入（例如 `homeDir`、`dataDir`、取得 claude / codex manager 的 getter）；`electron/handlers/` 底下不得 import electron（`headless-electron-free.test.ts` 守門）
- 順手把 `main.ts` 的 `broadcastRuntimeEvent` 改用 deps.emit（T0400 建議），前提是行為不變

### 2. 分類（依 T0386 §1，與實作不符時照實作並在回報區列差異）
- **always-local**（加入 `ALWAYS_LOCAL_CHANNELS`）：`claude:archive-messages` / `claude:load-archived` / `claude:clear-archive`（renderer 訊息溢出的本機快取）
- **headless 不支援**（留在 `HEADLESS_UNSUPPORTED`，回明確錯誤）：codex 相關（`claude:set-codex-sandbox-mode` / `claude:set-codex-approval-policy` 等，server bundle 不含 codex）；本機也是 stub 的 `claude:auth-login` / `account-list` / `account-import-current` / `account-switch` / `rewind-to-prompt` 可在 headless 回同樣 stub（擇一，回報說明）
- **headless 支援**：其餘（session / 模型 / 權限 / 列表 / resume / fork / stop-task / rest / wake / context / meta / worktree-status / cleanup-worktree / scan-skills / scan-star-commands / get-statusline-extras / get-cli-path / detectRuntime / auth-status / auth-logout / abort-session 等）

### 3. headless 上線
- `headless-entry.ts` 組 headless `HostDeps`（dataDir 為 userData、`homeDir = os.homedir()`、無 notifier），建立 `ClaudeAgentManager` 並呼叫 `registerClaudeHandlers`
- 確認 headless embedded runtime 走 bundle `node_modules/@anthropic-ai/claude-code/bin/claude`，spawn env 注入 `DISABLE_AUTOUPDATER=1` + `DISABLE_UPDATES=1`；system runtime 不注入 `DISABLE_UPDATES`
- `PROXIED_EVENTS` 補 `claude:turn-end`、`claude:runtime-degraded`、`claude:runtime-warning`

### 4. UI 降級
- 遠端視窗（profile `type === 'remote'`）中：codex preset / codex 專屬控制隱藏或停用並顯示原因（i18n：`src/locales/` 各語系）
- 遠端 Claude 面板呼叫到 unsupported channel 時顯示可理解的訊息，不是原始 `No handler for channel`

### 5. smoke 跟進
- `scripts/smoke-remote-headless.mjs` S8 目前用 `claude:get-supported-models` 當「unsupported」探針，本單後會變成支援 ⇒ 改為從 `HEADLESS_UNSUPPORTED` 動態挑一個仍不支援的 channel（或固定用 `git:*` 系列，T0405 時再調整）；另新增 S9：`claude:get-cli-path` / `claude:detectRuntime` / `claude:auth-status` 經 headless 回傳合理值（不需登入）

## 驗收條件

- [ ] `main.ts` 不再有 `registerHandler('claude:`（grep 證據）；`electron/handlers/claude.ts` 不 import electron
- [ ] parity / electron-free / proxied-binding 守門測試綠；`HEADLESS_UNSUPPORTED` 的 claude 項目只剩第 2 點列的不支援類
- [ ] headless 整合測試（harness）：`get-cli-path` 回 bundle 路徑形狀、`detectRuntime`、`auth-status`（未登入狀態）、`get-supported-models`；unsupported channel 回明確錯誤；archive 三個不經 headless
- [ ] 單元測試：headless embedded spawn env 含 `DISABLE_UPDATES`，system 不含
- [ ] UI 降級測試（`src/components/__tests__/`）
- [ ] `npm run test:unit` 全綠（基線 1224）；`npx tsc --noEmit` ≤ 40；`npx vite build` exit 0；`npm run test:e2e` 0 failed（E1 必 PASS）
- [ ] 回報區附「塔台部署後 smoke 預期輸出」與「使用者實機步驟」（WSL 遠端視窗開 Claude 面板 → 未登入時看到什麼）

## 不在範圍

- 遠端登入引導 UX（T0402）
- 孤兒 PTY / BUG-103（T0404）；git / fs（T0405 / T0406）

## Sub-session 執行指示

1. 讀本工單 + T0386 回報區 §1 / §4 + T0400 回報區 + `electron/handlers/types.ts` / `pty.ts`（既有共用模組範本）+ `main.ts:2226-2674`
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 依 1 → 5 順序實作；第 1 步完成即可先 commit（降級策略）
4. 填回報區；完成寫 **`DONE`**（只完成第 1 步寫 `PARTIAL`）
5. `git commit --only` 實際改動檔 + 本工單；不 push
6. 依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

### 產出摘要

### channel 分類最終表

### 塔台部署後 smoke 預期輸出

### 使用者實機步驟

### 互動紀錄
無

### Renew 歷程
無

### 遭遇問題

### 回報時間
