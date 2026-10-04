---
schema_version: 1
schema_kind: workorder
id: T0437
title: "BUG-105 後續：ALWAYS_LOCAL remote:resolve-client-paths（可達性規則）+ Claude 面板 @ 附件改送 server 形式路徑，不可達者拒絕 + toast"
type: fix
status: PENDING
repo: better-agent-terminal
project: BUG-105
priority: P1
sizing: M
created_at: "2026-10-05T05:51:45+08:00"
started_at: null
updated_at: "2026-10-05T05:51:45+08:00"
completed_at: null
target_version: next
depends_on:
  - T0441
  - T0431
related:
  - "T0421 研究回報區「建議的機制」+ 拆單第 3 列；Q1 裁決：SSH 本機檔案一律拒絕並提示"
  - "BUG-107 / T0435（拖放修好後遠端附件會送 client 路徑，本單是同版擋板）"
  - "D134 追加（T0421 拆單）"
affects_files:
  - electron/main.ts
  - electron/preload.ts
  - src/types/electron.d.ts
  - electron/remote/path-translator.ts
  - electron/remote/path-aware-channels.ts
  - electron/remote/protocol.ts
  - electron/remote/headless-channel-status.ts
  - src/components/ClaudeAgentPanel.tsx
  - src/components/CodexAgentPanel.tsx
  - src/locales/en.json
  - src/locales/zh-TW.json
  - src/locales/zh-CN.json
  - electron/remote/__tests__/
  - src/__tests__/
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **規格來源**：T0421 回報區「建議的機制」。可達性：Identity 恆可達；WSL `owns()` 為 true 才可達（其他 distro UNC / 網路分享 → 不可達）；Docker 在 mount 內才可達；SSH 本機檔案一律不可達（Q1）。API 需區分用途（`purpose: 'local-file' | 'workspace-entry'`，後者供 T0438 用：輸入是 server 檔案的 client 形式，可直接 `toServer`）。"
  - "🔴 只做規則判斷，**不做遠端存在探測**。本機視窗行為不變（Identity 原樣）。**不改** `claude:send-message` 簽章（舊 headless server 會靜默丟附件，見 T0421）。"
  - "🔴 不對使用者手打 / 貼上文字做自動改寫（T0421 明確建議）。只轉 BAT 自己產生的附件路徑。"
  - "🔴 新 channel 列 ALWAYS_LOCAL，通過全分類守門（T0416 / T0422）。依賴 T0441（同改 `ClaudeAgentPanel.tsx`）與 T0431（同改 `main.ts` / remote 分類表）。開工前 `git log --oneline -10` 確認；共用檔 commit 前 `git diff <file>` 確認只含本單 hunk。"
  - "🔴 **只跑 `npm run test:unit` + `npx tsc --noEmit`；不跑 `npx vite build` / `npm run test:e2e`**（L141）。**禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）；`git commit --only`；不 push；不部署 WSL。"
---

# T0437 — 遠端附件路徑解析

## 範圍

1. main：`remote:resolve-client-paths(paths, purpose)` → `{ input, serverPath | null, reachable, reason? }[]`，用該視窗 `RemoteClient` 目前的 translator
2. Claude 面板（Codex 面板若同機制一併）送出前批次查詢：可達者 `@` 前綴改 server 形式；不可達者移除並 i18n toast（「此檔案不在遠端主機上」）
3. 守門測試：每種 translator（Identity / WSL / Docker / SSH）× 可達 / 不可達 fixture；`purpose` 兩種
4. 回報區附實機步驟（WSL：拖 `\\wsl.localhost\…` 檔與 `C:\…` 檔；SSH：拖本機檔 → toast）

## 驗收條件

- [ ] `npm run test:unit` 全綠；`npx tsc --noEmit` ≤ 39
- [ ] BUG-105 檔補一行「自由文字 / 附件路徑：T0437」註記

## Sub-session 執行指示
1. 讀本工單 + T0421 回報區全文 + T0416 回報區 + `electron/remote/path-translator.ts`
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 實作 → 驗收
4. 填回報區；完成寫 **`DONE`**
5. `git commit --only` 實際改動檔 + 本工單 + BUG-105；不 push
6. 依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

### 產出摘要

### 遭遇問題

### 回報時間
