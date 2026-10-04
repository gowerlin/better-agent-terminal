---
schema_version: 1
schema_kind: workorder
id: T0433
title: "PLAN-036 P3 / K 工單 3：helper（bat-terminal / bat-notify / _bat-cert / _bat-logger）隨 server bundle 出貨 + headless PTY 注入範圍權杖 env"
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
  - T0432
related:
  - "T0420 研究回報區「各單內容」工單 3；方案 A'"
  - "CLAUDE.md「Packaging / Release 前置檢查」：`verify-helper-bundle.js`（BUG-058 / T0247 / T0248）、server bundle（PLAN-031）"
  - "D134 追加（K 實作）"
affects_files:
  - scripts/build-server-bundle.mjs
  - scripts/verify-helper-bundle.js
  - scripts/_bat-logger.mjs
  - electron/remote/headless-entry.ts
  - electron/pty-manager.ts
  - electron/handlers/pty.ts
  - scripts/__tests__/
  - electron/remote/__tests__/
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 遠端 PTY env **只**注入範圍權杖（`BAT_REMOTE_TOKEN=<capability>`）與 `BAT_REMOTE_PORT` / `BAT_SERVER_CERT_PATH` / `BAT_HELPER_DIR` / log 目錄覆寫；**server token 絕不進 env**——加 unit test 斷言 env 中不含 server token 值。`isHeadlessScrubbedEnvKey` 的規則不變（scrub 繼承的 `BAT_*`，再由 helperEnv 顯式注入）。"
  - "🔴 helper `.mjs` 修改需相容本機（本機 BAT 同一份 helper）：本機行為不變，以既有 helper 測試鎖住。`_bat-logger.mjs` 的 log 目錄在遠端改由 env 覆寫，不得寫到不存在或無權限的路徑。"
  - "🔴 bundle：`verify-helper-bundle.js` 擴充後，`npm run verify:helpers` 必須綠；只能用 Windows 可跑的方式驗證 build 腳本（T0391 備註：Windows 上 schema-only `build-server-bundle` 停在 `pruneAnthropicPackages` 是既有狀況，不要修，回報區註明你如何驗證複製步驟）。"
  - "🔴 依賴 T0432。開工前 `git log --oneline -8` 確認；共用檔 commit 前 `git diff <file>` 確認只含本單 hunk。"
  - "🔴 **只跑 `npm run test:unit` + `npx tsc --noEmit` + `npm run verify:helpers`；不跑 `npx vite build` / `npm run test:e2e`**（L141）。**禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）；`git commit --only`；不 push；不部署 WSL。"
---

# T0433 — helper 出貨 + PTY env 注入（K 工單 3）

## 範圍

依 T0420「各單內容」工單 3：
1. `build-server-bundle.mjs` 把 `bat-terminal.mjs`、`bat-notify.mjs`、`_bat-cert.mjs`、`_bat-logger.mjs` 複製到 `<installRoot>/scripts/`；`verify-helper-bundle.js` 擴充檢查
2. `createHeadlessPtyModule` 傳 `helperDir` 與 headless 專用 `helperEnv(id, customEnv)`：向 T0432 registry 簽發該 PTY 的權杖並注入
3. 測試：env 不含 server token；PTY exit 後權杖撤銷（與 T0432 hook 串接）；bundle 檢查涵蓋新檔

## 驗收條件

- [ ] `npm run test:unit` 全綠；`npx tsc --noEmit` ≤ 40；`npm run verify:helpers` 綠
- [ ] 回報區附遠端分頁內補驗指令：`env | grep ^BAT_ | cut -d= -f1`（只列 key）

## Sub-session 執行指示
1. 讀本工單 + T0420 回報區 + T0432 回報區 + CLAUDE.md「Packaging / Release 前置檢查」
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
