---
schema_version: 1
schema_kind: workorder
id: T0395
title: "dev-deploy-headless：restart 後的 LISTEN 檢查改以 bat-server 服務的 PID 過濾（不再以程序名稱過濾）"
type: fix
status: PENDING
repo: better-agent-terminal
project: PLAN-036
priority: P3
sizing: S
created_at: "2026-10-05T01:06:22+08:00"
target_version: next
depends_on:
  - T0391
related:
  - "PLAN-036 §「P0 實機驗收準備（2026-10-05 01:01）」工具小瑕疵"
affects_files:
  - scripts/dev-deploy-headless.mjs
  - scripts/__tests__/dev-deploy-headless.test.mjs
  - docs/remote-dev-overview.md
interaction:
  mode_hint: on
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **不得對使用者 WSL 的 `~/.local/bat-server` 執行 `--yes` 寫入、不得重啟 / 停止 `bat-server.service`**：使用者正以該服務（塔台 01:01 部署的 `ea52b03` headless JS）做 PLAN-036 P0 實機驗收。對 WSL 只允許**唯讀**指令（`ss -ltnp`、`systemctl --user show ...`、`cat /sys/fs/cgroup/...`）驗證新過濾邏輯。"
  - "🔴 **禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）。"
  - "🔴 child_process 一律 `execFile` / `spawn` + array args（`wsl.exe` 亦同），timeout 必設。禁用 shell-spawning exec API。"
  - "⚠️ 不 push。"
---

# T0395 — dev-deploy-headless LISTEN 檢查改以服務 PID 過濾

## 元資料
- **工單編號**：T0395
- **任務名稱**：dev-deploy-headless restart 後 LISTEN 檢查誤報 `(none found)`
- **狀態**：PENDING
- **建立時間**：2026-10-05 01:06 (UTC+8)
- **開始時間**：（sub-session 開始時填入）
- **完成時間**：（完成時填入）
- **intervention_type**：fire-and-forget
- **affects_files**：
  - `scripts/dev-deploy-headless.mjs`
  - `scripts/__tests__/dev-deploy-headless.test.mjs`
  - `docs/remote-dev-overview.md`（僅在現有描述需更新時）

## 背景

塔台 2026-10-05 01:01 以 `npm run deploy:headless:dev -- --target wsl:Ubuntu-24.04 --expect-string registerHeadlessPtyHandlers --yes` 部署 `ea52b03`。restart 後 `IS_ACTIVE active`、journal 顯示 `listening on 127.0.0.1:9877`，但工具輸出 **`LISTEN (none found)`**。

根因（塔台已定位）：`scripts/dev-deploy-headless.mjs` `renderBashScript()` restart 段（約 :409）：

```
L=$(ss -ltnp 2>/dev/null | grep -E 'node|bat-server')
```

`ss -p` 顯示的是 **thread / comm 名稱**，bat-server 監聽 socket 的持有者顯示為 `MainThread`，既不含 `node` 也不含 `bat-server` → 永遠過濾不到。以程序名稱過濾本質上不可靠。

## 範圍

1. 改為**以服務身分過濾**，不以程序名稱：
   - 取 `systemctl --user show -p MainPID --value bat-server`（或服務 cgroup 內所有 PID：`systemctl --user show -p ControlGroup --value` → `/sys/fs/cgroup<cg>/cgroup.procs`，Worker 擇一，回報區說明理由）
   - 以 `ss -ltnp` 輸出中的 `pid=<PID>,` 精確比對（注意避免 `pid=12` 誤配 `pid=123`）
2. 邊界輸出（維持 `LISTEN ` 行首前綴，與現有輸出格式相容）：
   - 找到 → 每行 `LISTEN <ss 行>`
   - 服務 MainPID 為 `0` / 空（未在跑）→ 明確訊息，例如 `LISTEN (service has no running PID)`
   - PID 存在但無 LISTEN socket → `LISTEN (none found for pid …)`
3. `SERVICE_NAME` 沿用既有常數，不硬寫字串。
4. 若 `docs/remote-dev-overview.md` 有描述 LISTEN 檢查的方式，同步修正；沒有就不動。

## 不在範圍

- 不改部署 / 備份 / rollback 邏輯，不改 `parseScriptOutput` 的 FILE / EXPECT 解析
- 不改 `dir:` 目標行為
- 不處理 PLAN-036 P1 任何項目

## 驗收條件

- [ ] unit：`renderBashScript('deploy', { restart: true, ... })` 產出的腳本**不再**含 `grep -E 'node|bat-server'`，改含以服務 PID 比對的邏輯；`restart: false` 時不產生 LISTEN 段（既有行為不變）
- [ ] 若可行，以 fixture 字串（含 `users:(("MainThread",pid=1234,fd=21))` 的 `ss` 樣本，及 `pid=12345` 的干擾行）測試過濾正確
- [ ] **WSL 唯讀實測**：把新的 LISTEN 段抽出成獨立 bash 片段，對 `Ubuntu-24.04` 以唯讀方式執行（不 restart），輸出應列出 `127.0.0.1:9877`；回報區附實際輸出
- [ ] `npm run test:unit` 全綠（基線 1083）；`npx vite build` exit 0；`npx tsc --noEmit` ≤ **40**

## Sub-session 執行指示

1. 讀取本工單 + `scripts/dev-deploy-headless.mjs` `renderBashScript()` + 既有測試檔
2. 填 `started_at`、`status: IN_PROGRESS`（**`date "+%Y-%m-%dT%H:%M:%S%z"` 取系統時間**，R-G001）
3. 實作 → 驗收（WSL 只唯讀，見 memory_overrides）
4. 填回報區；完成寫 **`DONE`**（不要寫 `FIXED`）
5. commit 僅實際改動檔 + 本工單檔（`git commit --only ...`），不 push
6. 依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態
（DONE / FAILED / BLOCKED / PARTIAL）

### 產出摘要
（修改的檔案、關鍵變更、MainPID vs cgroup 的選擇理由）

### WSL 唯讀實測輸出
（貼實際輸出）

### 互動紀錄
無

### Renew 歷程
無

### 遭遇問題

### 回報時間
