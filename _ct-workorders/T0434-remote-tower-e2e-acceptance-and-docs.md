---
schema_version: 1
schema_kind: workorder
id: T0434
title: "PLAN-036 P3 / K 工單 4：遠端 Tower 端到端驗收（vitest headless harness 跑真 helper）+ smoke 項 + 文件"
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
  - T0431
  - T0432
  - T0433
related:
  - "T0420 研究回報區「各單內容」工單 4、§3 端到端流程"
  - "T0396 `npm run smoke:remote:headless`（S1-S12）；T0391 `deploy:headless:dev`"
  - "D134 追加（K 實作）"
affects_files:
  - electron/remote/__tests__/
  - scripts/smoke-remote-headless.mjs
  - scripts/__tests__/
  - CLAUDE.md
  - docs/remote-dev-overview.md
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **不部署 WSL、不 restart 服務**：WSL 部署與真 BAT 遠端視窗實機由塔台 / 使用者執行。本單產出 (a) vitest harness 端到端測試、(b) smoke 新增項目（對已部署 server 才會跑，本單只需對**目前 WSL server 跑時能正確 SKIP 或標示版本不足**，不得因舊 server 而紅）、(c) 文件、(d) 回報區的實機步驟。"
  - "🔴 `_ct-workorders/_local-rules.md` 為塔台私有檔，**不改**；需要更新的「Auto-Session 路由規則」遠端分支內容寫在回報區，由塔台套用。`CLAUDE.md` 可改（新增遠端 Tower 通知小節：權杖範圍、env key、限制）。"
  - "🔴 harness 測試跑真 node helper 子行程：Tower PTY → `bat-terminal.mjs` → `created-externally` → `bat-notify.mjs` → `notified` + `keypress`；以及負向：權杖越權呼叫被拒。測試需在 Windows 本機可跑（helper 子行程以 `process.execPath` + array args spawn）。"
  - "🔴 依賴 T0431 / T0432 / T0433。開工前 `git log --oneline -10` 確認。"
  - "🔴 **只跑 `npm run test:unit` + `npx tsc --noEmit`；不跑 `npx vite build` / `npm run test:e2e`**（L141）。**禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）；`git commit --only`；不 push。"
---

# T0434 — 遠端 Tower 端到端驗收 + 文件（K 工單 4）

## 範圍

依 T0420「各單內容」工單 4：
1. vitest headless harness 端到端（memory_overrides 第 3 條）
2. `smoke:remote:headless` 新增 S13（遠端 PTY 內 `BAT_*` key 清單正確、無 server token；helper 可對 headless 開分頁）——對舊 server 正確 SKIP
3. `CLAUDE.md` 新增「遠端 Tower 通知（PLAN-036 K）」小節；`docs/remote-dev-overview.md` 補對應段
4. 回報區：`_local-rules.md` 建議修訂文字 + 使用者實機步驟（WSL 部署後在真 BAT 遠端視窗從遠端 Tower 派一張測試單；前提：遠端 `~/.claude/skills` 已裝 control-tower 系列 skill）

## 驗收條件

- [ ] `npm run test:unit` 全綠；`npx tsc --noEmit` ≤ 40
- [ ] smoke 對目前 WSL server 執行結果附回報區（新項 SKIP 而非 FAIL）——若無法連 WSL，註明未執行
- [ ] PLAN-036 檔 P3 段補 K 完成註記（T0431-T0434 + commit）

## Sub-session 執行指示
1. 讀本工單 + T0420 / T0431 / T0432 / T0433 回報區
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 實作 → 驗收
4. 填回報區；完成寫 **`DONE`**
5. `git commit --only` 實際改動檔 + 本工單 + PLAN-036；不 push
6. 依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

### 產出摘要

### 遭遇問題

### 回報時間
