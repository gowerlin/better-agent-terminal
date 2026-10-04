---
schema_version: 1
schema_kind: workorder
id: T0411
title: "PLAN-037 B：remote-tools 接線——共用模組 electron/handlers/remote-tools.ts + proxied remote-tools:detect + 本機 remote:detect-tools(profileId) 短連線 + preload / 型別 + parity + smoke S10"
type: impl
status: PENDING
repo: better-agent-terminal
project: PLAN-037
priority: P2
sizing: M
created_at: "2026-10-05T03:10:44+08:00"
target_version: next
depends_on:
  - T0408
related:
  - "T0407 回報區 §4 執行模型（偵測段）；T0408 回報區「給後續工單的備註」"
  - "D133 波次；T0410（同批平行，只動 `src/components/remote-tools/*`、locales、styles）"
affects_files:
  - electron/handlers/remote-tools.ts
  - electron/main.ts
  - electron/remote/protocol.ts
  - electron/remote/headless-entry.ts
  - electron/remote/headless-channel-status.ts
  - electron/preload.ts
  - src/types/electron.d.ts
  - electron/remote/__tests__/
  - electron/__tests__/
  - scripts/smoke-remote-headless.mjs
  - scripts/__tests__/smoke-remote-headless.test.mjs
  - docs/remote-dev-overview.md
interaction:
  mode_hint: on
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 T0410 平行中：不得碰 `src/components/`、`src/locales/`、`src/styles/`。"
  - "🔴 不得部署到 WSL、不得 restart `bat-server.service`；完成後由塔台部署並跑 smoke。"
  - "🔴 probe 子行程 env 以 headless PTY 同一套 scrub 規則清理（`isHeadlessScrubbedEnvKey`），不得把 `BAT_*` / server token 帶進 probe。"
  - "🔴 child_process 一律 `execFile` + array args + timeout（沿用 T0408 `detectRemoteTools`）；`profileId` 驗證比照 `remote:detect-arch`（`main.ts:2919`）。"
  - "🔴 **禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）。不 push。"
---

# T0411 — remote-tools 接線（PLAN-037 B）

## 元資料
- **工單編號**：T0411
- **任務名稱**：remote-tools headless / main 接線
- **狀態**：PENDING
- **建立時間**：2026-10-05 03:10 (UTC+8)
- **intervention_type**：fire-and-forget

## 背景

T0408（`ab30fff` / `6d7daab`）完成偵測核心：`detectRemoteTools(execFileImpl, { shell })` → `RemoteToolsDetectResult`（`src/types/remote-tools.ts`）。本單把它接上：遠端 headless server 提供 proxied channel，本機視窗（精靈、設定頁）用短連線呼叫。**規格以 T0407 §4（偵測段）為準。**

## 範圍

1. `electron/handlers/remote-tools.ts`：`registerRemoteToolsHandlers(register, deps)`，註冊 `remote-tools:detect` → `detectRemoteTools(execFile, { shell })`；不 import electron
   - `shell` 來源與遠端 PTY 解析 shell 一致（`$SHELL` / `os.userInfo().shell`），交 `selectLoginShell` 驗證
   - probe env：`process.env` 經 headless scrub 規則清理後傳入
   - Windows 主機回 `{ ok: false, errorCode: 'host-platform' }`（型別已定義）
2. headless：在 `createHeadlessHandlerModules`（`headless-entry.ts:262`）加入；`remote-tools:detect` 加入 `PROXIED_CHANNELS`，parity 不需列 unsupported
3. Electron 端：`main.ts` 同樣註冊（macOS / Linux 本機可得本機結果；Windows 回 host-platform）
4. 本機短連線：local-only `ipcMain.handle('remote:detect-tools', profileId)`——`new RemoteClient()` → connect（帶 profile 的 fingerprint）→ `invoke('remote-tools:detect')` → disconnect，範式同 `remote:test-connection` / `remote:list-profiles`；舊 server 回 `No handler for channel` 時回傳可辨識的結果（例如 `{ ok: false, errorCode: 'server-too-old' }`，必要時擴充型別的 errorCode）
5. `preload.ts` / `src/types/electron.d.ts`：暴露 `remoteTools.detect(profileId)`（本機短連線）與遠端視窗內直接呼叫 `remote-tools:detect` 的 API（命名由 Worker 決定，回報區寫明，T0410 會依此接上）
6. smoke：新增 **S10** `remote-tools:detect` 回 `schemaVersion: 1`、`env.osFamily = linux`、`git` 為 `ok`；舊 server 回 `No handler` 時 FAIL 並註明「server predates T0411」；`docs/remote-dev-overview.md` 的 smoke 表補 S10

## 驗收條件

- [ ] headless harness：`remote-tools:detect` 經 WS 回傳合法 report（可注入 fake execFile）；probe env 不含 `BAT_*`
- [ ] parity / electron-free / proxied-binding 守門綠
- [ ] `remote:detect-tools`：profileId 驗證、連線失敗 / 舊 server / 成功三種結果的單元測試（mock RemoteClient）
- [ ] smoke 單元測試含 S10（新 / 舊 server）
- [ ] `npm run test:unit` 全綠（基線 1442）；`npx tsc --noEmit` ≤ 40；`npx vite build` exit 0；`npm run test:e2e` 0 failed
- [ ] 回報區寫明 preload API 名稱與回傳形狀（給 T0410 / T0412）

## Sub-session 執行指示
1. 讀本工單 + T0407 §4 + T0408 回報區 + `electron/handlers/claude.ts`（共用模組範本）+ `main.ts` `remote:detect-arch` / `remote:test-connection` 段
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

### preload API（給 T0410 / T0412）

### 互動紀錄
無

### Renew 歷程
無

### 遭遇問題

### 回報時間
