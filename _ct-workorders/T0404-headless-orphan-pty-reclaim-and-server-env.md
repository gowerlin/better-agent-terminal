---
schema_version: 1
schema_kind: workorder
id: T0404
title: "PLAN-036 遠端終端收尾 B：headless 孤兒 PTY 回收（無 client 閒置上限 + 每台 PTY 上限）+ BUG-103 auth metadata serverEnv 偵測 WSL"
type: impl
status: PENDING
repo: better-agent-terminal
project: PLAN-036
priority: P2
sizing: M
created_at: "2026-10-05T02:35:05+08:00"
target_version: next
depends_on:
  - T0401
  - T0403
related:
  - "PLAN-036「P1 候選（T0390 回報）」第 2 點；D130 波次 ④（與 T0402 平行）"
  - "BUG-103（`remote-server.ts:154` `serverEnv: 'native'` 寫死）"
affects_files:
  - electron/remote/remote-server.ts
  - electron/remote/headless-entry.ts
  - electron/pty-manager.ts
  - electron/remote/__tests__/
  - electron/__tests__/
  - scripts/smoke-remote-headless.mjs
  - scripts/__tests__/smoke-remote-headless.test.mjs
interaction:
  mode_hint: on
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **回收只在 headless server 啟用**：本機 Electron（Terminal Server / direct 模式）行為不得改變——本機 PTY 生命週期由視窗管理。"
  - "🔴 T0402 平行中：不得碰 `electron/handlers/claude.ts`、`src/`。"
  - "🔴 不得部署到 WSL、不得 restart `bat-server.service`；完成後由塔台部署並跑 smoke。"
  - "🔴 **禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）。不 push。"
---

# T0404 — headless 孤兒 PTY 回收 + BUG-103（PLAN-036 遠端終端收尾 B）

## 元資料
- **工單編號**：T0404
- **任務名稱**：孤兒 PTY 回收 + serverEnv
- **狀態**：PENDING
- **建立時間**：2026-10-05 02:35 (UTC+8)
- **intervention_type**：fire-and-forget

## 背景

- T0390 起 headless 的 PTY 在 client 斷線時**刻意不 kill**（BAT 重開能接回，T0403 再加回放）。代價是：使用者關掉遠端終端以外的情況（例如換電腦、BAT 當掉、永不再連）會讓 PTY 永久留在遠端，數量無上限
- BUG-103：`electron/remote/remote-server.ts:150` `buildAuthMetadata()` 寫死 `serverEnv: 'native'`；WSL 上的 server 回 native，且缺 `wslDistro` / `serverHome`（`AuthServerEnv` 型別已定義 `'wsl'`）
- `RemoteServer` 有 `clients` Map（:169）與 connection / close 事件（:303 / :387）

## 範圍

### A. 孤兒 PTY 回收（headless only）
- `RemoteServer` 提供已認證 client 數變化的事件或 getter（例如 `onClientCountChange` / `getClientCount()`）
- headless 端：**沒有任何已認證 client 連線**持續超過閒置上限 ⇒ kill 所有 PTY。預設 **24 小時**，可由 headless settings / 啟動參數 / env 覆寫（Worker 選一種並說明）；有 client 重新連上即取消計時
- **每台 server PTY 上限**預設 **64**：超過時 `pty:create` 拒絕並回明確錯誤（不 kill 既有 PTY）
- 回收與拒絕都要寫 log（journal 可見）

### B. BUG-103
- WSL 偵測：`WSL_DISTRO_NAME` env 或 `/proc/version` 含 `microsoft`（大小寫不拘）⇒ `serverEnv: 'wsl'`、`wslDistro`；`serverHome = os.homedir()`
- 偵測失敗一律退回 `'native'`，不得讓 auth 失敗
- 確認 client 端（`remote-client.ts` / renderer）收到 `'wsl'` 時沒有走到未預期分支（只讀現有使用點，必要時補測試）

### C. smoke
- S1 evidence 顯示 `env=` 值；對 WSL 目標若不是 `wsl` 則標 WARN（不 FAIL，避免舊 server 誤判）

## 驗收條件

- [ ] unit：閒置計時（以 fake timers）——無 client 達上限 ⇒ kill all；期間重連 ⇒ 取消；有 client 時不計時
- [ ] unit：PTY 上限——第 65 個 `pty:create` 回明確錯誤，既有 64 個不受影響；kill 後可再建
- [ ] unit：本機 Electron 路徑不啟用回收（PtyManager 預設無上限、無計時）
- [ ] unit：serverEnv 偵測（`WSL_DISTRO_NAME` / `/proc/version` / 都沒有 / 讀取失敗）
- [ ] headless harness：auth-result metadata 在模擬 WSL env 下為 `wsl` + `wslDistro`
- [ ] `npm run test:unit` 全綠（基線 1258，T0402 合入後會變）；`npx tsc --noEmit` ≤ 40；`npx vite build` exit 0；`npm run test:e2e` 0 failed

## 不在範圍
- 單一 PTY 的閒置回收（只做「整台沒有 client」）
- 任何 UI

## Sub-session 執行指示
1. 讀本工單 + BUG-103 + `electron/remote/remote-server.ts`、`headless-entry.ts`、`pty-manager.ts`（create / kill / instances）+ `src/types` 中的 `AuthServerEnv` / `AuthResultMetadata` 使用點
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

### 互動紀錄
無

### Renew 歷程
無

### 遭遇問題

### 回報時間
