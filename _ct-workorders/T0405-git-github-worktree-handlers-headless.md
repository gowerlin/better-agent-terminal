---
schema_version: 1
schema_kind: workorder
id: T0405
title: "PLAN-036 P2-H：git / github / worktree / git-scaffold 搬入共用模組並上線 headless；github:check-cli 改用 gh auth status（不取 token）"
type: impl
status: PENDING
repo: better-agent-terminal
project: PLAN-036
priority: P1
sizing: L
created_at: "2026-10-05T04:17:20+08:00"
target_version: next
depends_on:
  - T0401
  - T0404
  - T0411
related:
  - "PLAN-036 排程（D130 / D133）：PLAN-037 完成後的 T0405 → T0406"
  - "T0386 回報區 §1（A 類 git / github / worktree / git-scaffold）、§3、建議清單 H"
  - "D133 附帶：`github:check-cli` 以 `gh auth token` 判斷登入（`main.ts:2358-2359`）→ 改 `gh auth status` exit code"
  - "T0407 剩餘風險 5 / T0414：server（systemd）PATH 不含 `~/.local/bin`；本機 WSL 的 gh 在 `/usr/bin`"
affects_files:
  - electron/handlers/git.ts
  - electron/handlers/types.ts
  - electron/git/git-ipc.ts
  - electron/main.ts
  - electron/remote/headless-entry.ts
  - electron/remote/headless-channel-status.ts
  - electron/gh-resolver.ts
  - electron/worktree-manager.ts
  - electron/__tests__/
  - electron/remote/__tests__/
  - electron/git/__tests__/
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
  - "🔴 **本機 Git / GitHub / worktree 面板行為不得改變**：搬移逐字搬，handler 內部邏輯不重寫（`github:check-cli` 的登入判斷除外，見範圍 3）。e2e 0 failed。"
  - "🔴 不得部署到 WSL、不得 restart `bat-server.service`；完成後由塔台部署並跑 smoke。不得在 WSL 執行會改變 repo 狀態的 git 指令（commit / push / worktree add 等）——整合測試用 `mkdtemp` 的暫存 repo。"
  - "🔴 不登入 gh、不讀 gh 的 token / hosts.yml 內容。"
  - "🔴 child_process 一律 `execFile` / `spawn` + array args + timeout（既有 git-ipc / gh-resolver 慣例）。"
  - "🔴 **禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）。不 push。"
---

# T0405 — git / github / worktree 上遠端（PLAN-036 P2-H）

## 元資料
- **工單編號**：T0405
- **任務名稱**：git / github / worktree / git-scaffold 共用註冊 + headless 上線
- **狀態**：PENDING
- **建立時間**：2026-10-05 04:17 (UTC+8)
- **intervention_type**：fire-and-forget
- **預估規模**：L；**降級策略**：先完成「1. 搬移（Electron 行為不變）」並 commit，headless 上線未完成時回報 PARTIAL

## 背景

- PLAN-036：遠端（WSL / SSH / Docker）視窗已有終端（P0）、Claude 面板（T0401）、工具檢查與安裝（PLAN-037）。Git / GitHub / worktree 面板在遠端仍是 `No handler for channel`
- 現況：`main.ts` 有 19 個 `registerHandler('git:|github:|worktree:|git-scaffold:` 註冊（約 :2214-2451）；`electron/git/git-ipc.ts` 已用 `registerHandler` 外置（git-scaffold）；`headless-channel-status.ts` 有 22 個這四類 channel 列為 unsupported
- 這些 handler **不使用** `isPathAllowed`（path guard 只在 fs 類，T0406），所以本單不依賴 `workspace:sync-roots`
- WSL 上 git 2.43.0、gh 2.102.0（`/usr/bin`，T0414 安裝）皆存在；未登入 gh

## 範圍

1. **搬移**：新增 `electron/handlers/git.ts` 的 `registerGitHandlers(register, deps)`（git / github / worktree；git-scaffold 若 `git-ipc.ts` 已可共用則改由它註冊到兩端，做法 Worker 決定並說明），逐字搬入；`electron/handlers/` 不得 import electron
2. **headless 上線**：`createHeadlessHandlerModules` 加入；四類 channel 自 `HEADLESS_UNSUPPORTED` 移除（若有確實無法在遠端支援的，留下並寫明原因）
3. **`github:check-cli` 安全修正（D133）**：改用 `gh auth status` 的 exit code 判斷登入（stdout / stderr 丟棄，`timeout` 必設，逾時視為未知）；確認多帳號時的語意（`--active` 是否可用、gh 最低版本），與原本「只看 active account」一致或說明差異
4. **gh / git 解析**：headless 端的 gh / git 路徑解析要能找到 `~/.local/bin` 與 `/usr/local/bin` 等常見位置（server PATH 不含 `~/.local/bin`，T0414）；沿用 `gh-resolver.ts` 的掃描慣例
5. **smoke**：新增 **S11**：在暫存目錄 `git init` 一個 repo（server 端執行，結束刪除）或改用唯讀 channel（例如對 `$HOME` 做 `git-scaffold:healthCheck` / repo 偵測），確認 headless 回合理結果、`github:check-cli` 回 `installed: true` 且未登入；舊 server 回 `No handler` 時 FAIL 並註明「server predates T0405」。做法由 Worker 決定，但 smoke 不得在使用者既有 repo 上寫入；`docs/remote-dev-overview.md` 補 S11

## 驗收條件

- [ ] `main.ts` 不再有這四類 `registerHandler(`（grep 證據），`electron/handlers/git.ts` 不 import electron
- [ ] parity / electron-free / proxied-binding 守門綠
- [ ] headless harness（`mkdtemp` 暫存 repo）：至少 status / log / branch 類 git channel、worktree list、`github:check-cli` 經 WS 回傳正確
- [ ] 單元測試：`github:check-cli` 不再呼叫 `auth token`（spy 斷言 args），exit 0 / 1 / 逾時三種結果
- [ ] `npm run test:unit` 全綠（基線 1641）；`npx tsc --noEmit` ≤ 40；`npx vite build` exit 0；`npm run test:e2e` 0 failed
- [ ] 回報區附「塔台部署後 smoke 預期」與使用者實機步驟（WSL 遠端視窗開 Git / GitHub 面板）

## 不在範圍
- `fs:*` / `image:*` / `workspace:sync-roots`（T0406）
- gh 登入引導

## Sub-session 執行指示
1. 讀本工單 + T0386 回報區 §1 / §3 + `electron/handlers/claude.ts`（共用模組範本，T0401）+ `main.ts` 這四類註冊段 + `electron/git/git-ipc.ts` + `electron/gh-resolver.ts`
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 依 1 → 5 實作；第 1 步完成即可先 commit（降級策略）
4. 填回報區；完成寫 **`DONE`**（只完成第 1 步寫 `PARTIAL`）
5. `git commit --only` 實際改動檔 + 本工單；不 push
6. 依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

### 產出摘要

### 塔台部署後 smoke 預期

### 使用者實機步驟

### 互動紀錄
無

### Renew 歷程
無

### 遭遇問題

### 回報時間
