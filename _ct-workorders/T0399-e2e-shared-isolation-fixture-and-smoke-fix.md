---
schema_version: 1
schema_kind: workorder
id: T0399
title: "e2e：抽出 Electron 隔離啟動 / 關閉 fixture，修好既有 smoke.spec（結束確認對話框卡住 app.close + 未隔離 BAT env）"
type: test
status: PENDING
repo: better-agent-terminal
project: PLAN-036
priority: P2
sizing: S
created_at: "2026-10-05T01:36:55+08:00"
target_version: next
depends_on:
  - T0397
related:
  - "T0397 回報區「遭遇問題 1」（根因與建議修法）"
  - "T0398（同批平行；會改 electron/pty-manager.ts）"
affects_files:
  - e2e/fixtures/electron-isolation.ts
  - e2e/smoke.spec.ts
  - e2e/plan036-p0.spec.ts
interaction:
  mode_hint: on
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 不改產品程式碼（`electron/` / `src/`）、`package.json`、`playwright.config.ts`。"
  - "🔴 不得影響使用者正在跑的 BAT：沿用 T0397 的隔離做法（`--runtime`、剔除 `BAT_*` / `CT_*` / `ELECTRON_RUN_AS_NODE`、`BAT_REMOTE_PORT` 用空閒埠、殘留行程只在命令列吻合本 repo `dist-electron` / `node_modules\\electron` 時才 kill、跑完刪 runtime userData）。"
  - "⚠️ T0398 平行在改 `electron/pty-manager.ts`：若 `npx vite build` 因該檔未完成的修改而失敗，等幾分鐘重試，**不要動該檔**；回報區註明 build 時 HEAD 與工作區狀態。"
  - "🔴 **禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）。不 push；不 commit `e2e-results/`。"
---

# T0399 — e2e 共用隔離 fixture + 修 smoke.spec

## 元資料
- **工單編號**：T0399
- **任務名稱**：e2e 隔離 fixture 抽取與 smoke.spec 修復
- **狀態**：PENDING
- **建立時間**：2026-10-05 01:36 (UTC+8)
- **intervention_type**：fire-and-forget
- **affects_files**：`e2e/fixtures/electron-isolation.ts`（新增）、`e2e/smoke.spec.ts`、`e2e/plan036-p0.spec.ts`

## 背景（T0397 診斷）

- `e2e/smoke.spec.ts` 主體 708ms 就成功，但 `finally` 的 `app.close()` 觸發 `before-quit` 結束確認對話框（T0144，`electron/main.ts:1863-1895`）→ 無人回應 → 60s 逾時 + worker teardown 逾時
- 每跑一次遺留 Terminal Server、crashpad 行程與 runtime userData
- smoke 沒剔除繼承的 `BAT_*` env、沒覆寫 `BAT_REMOTE_PORT` → 在 BAT 內執行會去 listen 9876（`EADDRINUSE`，目前非阻塞，屬隔離缺口）
- `e2e/plan036-p0.spec.ts`（T0397）已有完整的 `isolatedEnv()` / `launchIsolated` / `closeIsolated`

## 範圍

1. 把 T0397 的隔離邏輯抽成 `e2e/fixtures/electron-isolation.ts`（launch：runtime id + 隔離 env + 空閒 `BAT_REMOTE_PORT` + userData basename 斷言；close：stub `dialog.showMessageBox` → `{ response: 1, checkboxChecked: true }` → 逾時 kill → 依命令列比對清殘留 Terminal Server → 刪 runtime userData）
2. `e2e/smoke.spec.ts` 改用 fixture
3. `e2e/plan036-p0.spec.ts` 改用 fixture，行為不變（E1-E4 斷言不得放寬）

## 驗收條件

- [ ] `npx vite build` 後 `npm run test:e2e`：smoke **PASS**、E1-E4 **4/4 PASS**、`bug075` 照舊 PASS、`server-bundle-distribution` 照舊 skip；**0 failed**
- [ ] 單跑 `e2e/smoke.spec.ts` 在 10s 內完成
- [ ] 跑完：本 repo `node_modules\electron` 行程 0、`%APPDATA%\*runtime-e2e*` 目錄 0；使用者 BAT 行程數 / 主視窗 / 9876 LISTEN / 安裝版 Terminal Server PID 前後一致（附對照表）
- [ ] `npm run test:unit` 全綠；`npx tsc --noEmit` ≤ 40

## Sub-session 執行指示

1. 讀本工單 + T0397 回報區 + `e2e/plan036-p0.spec.ts` + `e2e/smoke.spec.ts`
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

### e2e 實跑結果

### 使用者 BAT 前後對照

### 互動紀錄
無

### Renew 歷程
無

### 遭遇問題

### 回報時間
