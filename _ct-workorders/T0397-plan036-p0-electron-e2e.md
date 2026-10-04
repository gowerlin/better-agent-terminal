---
schema_version: 1
schema_kind: workorder
id: T0397
title: "PLAN-036 P0 自動驗收（UI 層）：Playwright Electron e2e 覆蓋 BUG-095 / BUG-101 / T0393"
type: test
status: PENDING
repo: better-agent-terminal
project: PLAN-036
priority: P1
sizing: M
created_at: "2026-10-05T01:13:27+08:00"
target_version: next
depends_on:
  - T0392
  - T0393
  - T0394
related:
  - "PLAN-036 §「P0 實機驗收準備（2026-10-05 01:01）」"
  - "T0396（同批平行：協定層 smoke）"
  - "既有範本：e2e/smoke.spec.ts（`_electron.launch` + `--runtime=` 隔離 userData）"
affects_files:
  - e2e/plan036-p0.spec.ts
  - e2e/fixtures/
interaction:
  mode_hint: on
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **不得影響使用者正在跑的 BAT（安裝版）**：e2e 一律以 `--runtime=e2e-plan036-<timestamp>` 啟動獨立 userData。開跑前先確認 Terminal Server 的端點（pipe / port）與 RemoteServer 埠是否**依 runtime 隔離**；若會連到 / 搶佔使用者 BAT 的 Terminal Server 或 RemoteServer 9876，該測試**不得執行**，標 SKIP 並在回報區說明原因與建議。"
  - "🔴 **WSL `bat-server.service` 不得 restart / stop / 重新部署**；若 T0393 測項需要連 WSL server（`127.0.0.1:9877`），只能以 client 連線，不得建立未清除的 PTY。"
  - "🔴 **不改 `package.json`**（T0396 同時在改）。不改產品程式碼（`electron/` / `src/`）；發現產品 bug → 回報區列出，不要順手修。"
  - "🔴 不送真實 Claude API 對話（不消耗 token）。BUG-095 只驗 IPC 綁定，不驗串流中止。"
  - "🔴 **禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）。不 push。"
---

# T0397 — PLAN-036 P0 Electron e2e

## 元資料
- **工單編號**：T0397
- **任務名稱**：PLAN-036 P0 自動驗收（UI 層）
- **狀態**：PENDING
- **建立時間**：2026-10-05 01:13 (UTC+8)
- **intervention_type**：fire-and-forget
- **affects_files**：`e2e/plan036-p0.spec.ts`、`e2e/fixtures/`（如需）

## 背景

使用者裁決 PLAN-036 P0 實機驗收「兩層都做」。T0396 做協定層；本單用既有 Playwright `_electron` 基礎（`npm run test:e2e`，`playwright.config.ts`，`e2e/smoke.spec.ts` 為範本）覆蓋需要 Electron 本體的三項。證據屬 **source build 層**（從 `dist-electron/` 啟動），不是安裝版；這點在回報區明寫。

## 範圍：`e2e/plan036-p0.spec.ts`

| # | 測項 | 對應 | 做法提示（以實作為準） |
|---|------|------|------|
| E1 | `claude:abort-session` 有 IPC 綁定 | T0392 / BUG-095 | renderer 以 `window.electronAPI` 對應的 abort API 傳不存在的 session id → 回應不得是 `No handler registered for 'claude:abort-session'`（回傳 false / 錯誤物件皆可，只要不是「沒 handler」）。同法順帶確認 `PROXIED_CHANNELS` 內其他 `claude:*` 在本機模式都有 handler（可選，若成本低） |
| E2 | Terminal Server 模式下 restart 終端不失聯 | T0394 / BUG-101 | 隔離 runtime 開啟 Terminal Server 模式 → 建終端 → 觸發 restart（`pty:restart` 或 UI 動作）→ 等待超過舊 PTY exit 事件抵達的時間 → 寫入 `echo <marker>`，output 出現 marker 且終端未被標記為 exited。**先做 memory_overrides 第 1 條的隔離確認** |
| E3 | 遠端 profile 的 shell 清單依 targetOS 過濾 | T0393 | 以 fixture 寫入 targetOS=linux 的遠端 profile（或連 WSL server），開 Settings → shell 選項只含 Linux shell，不含 `pwsh` / `cmd` / Windows 路徑 |
| E4 | WSL 工作區挑資料夾預設 WSL home + `/mnt/c` 提示 | T0393 | 以 `electronApp.evaluate` 在 main process stub `dialog.showOpenDialog`，記錄傳入的 `defaultPath`；斷言為 WSL home（`\\wsl.localhost\<distro>\home\<user>` 或 T0393 實作的形式），並斷言 renderer 顯示 `/mnt/c` 提示文字 |

每項都要能單獨 skip（前置條件不足時 `test.skip` 並寫明原因），不得因單項環境不足讓整支 spec 失敗。

## 驗收條件

- [ ] `npx vite build` 後 `npx playwright test e2e/plan036-p0.spec.ts` 實跑，E1-E4 結果（PASS / FAIL / SKIP + 原因）與輸出摘要附在回報區
- [ ] 既有 `e2e/smoke.spec.ts` 仍通過（`npm run test:e2e` 或單跑）
- [ ] `npm run test:unit` 全綠（基線 1085）；`npx tsc --noEmit` ≤ 40
- [ ] 跑完確認使用者的 BAT（安裝版）未受影響：沒有被關閉、沒有多出終端分頁（以 `--runtime` 隔離為證據即可）

## 不在範圍

- 不改產品程式碼、不改 `package.json`
- 不測遠端 PTY 協定（T0396）
- 不做視覺比對；「還原遠端終端畫面為空」屬已知 P1，不驗

## Sub-session 執行指示

1. 讀本工單 + `e2e/smoke.spec.ts`、`playwright.config.ts`、T0392 / T0393 / T0394 工單回報區（找實際 API / channel / UI 元素）
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 先做隔離確認 → 實作 → 實跑 → 驗收
4. 填回報區；完成寫 **`DONE`**；測項 FAIL 但測試本身正確 → 仍寫 `DONE`，FAIL 列入「遭遇問題」交塔台開 BUG
5. `git commit --only` 實際改動檔 + 本工單；不 push（不要 commit `e2e-results/`）
6. 依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

### 產出摘要

### 隔離確認

### E1-E4 實跑結果

### 互動紀錄
無

### Renew 歷程
無

### 遭遇問題

### 回報時間
