---
schema_version: 1
schema_kind: workorder
id: T0395
title: "dev-deploy-headless：restart 後的 LISTEN 檢查改以 bat-server 服務的 PID 過濾（不再以程序名稱過濾）"
type: fix
status: DONE
repo: better-agent-terminal
project: PLAN-036
priority: P3
sizing: S
created_at: "2026-10-05T01:06:22+08:00"
started_at: "2026-10-05T01:07:34+08:00"
updated_at: "2026-10-05T01:09:12+08:00"
completed_at: "2026-10-05T01:09:12+08:00"
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
- **狀態**：DONE
- **建立時間**：2026-10-05 01:06 (UTC+8)
- **開始時間**：2026-10-05 01:07 (UTC+8)
- **完成時間**：2026-10-05 01:09 (UTC+8)
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
DONE

### Landing Zone Check
- **PASS**：C-0 `repo: better-agent-terminal` == `basename(REPO_ROOT)` `better-agent-terminal`（REPO_ROOT=`D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）；C-1 工單位於 REPO_ROOT 下；C-3 三個 `affects_files` 皆存在（informational）；C-2 工單無 `branch` 欄位，HEAD=`main`
- `BAT_WORKSPACE_ID`=`cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）；`CT_MODE=on`、`CT_INTERACTIVE=0`

### 產出摘要
- `scripts/dev-deploy-headless.mjs`
  - 新增 export `renderListenCheck()`：回傳 LISTEN 檢查的 bash 行，`renderBashScript()` 的 restart 段改用 `...renderListenCheck()` 取代原本的 `grep -E 'node|bat-server'` 兩行；前後的 restart / is-active / journal 行未動
  - 邏輯：`systemctl --user show -p MainPID --value ${SERVICE_NAME}` → 空或 `0` 印 `LISTEN (service has no running PID)`；否則 `systemctl --user show -p ControlGroup --value ${SERVICE_NAME}`，若 `/sys/fs/cgroup<cg>/cgroup.procs` 可讀就改用其中**所有** PID，讀不到則退回 MainPID；`ss -ltnp` 經 awk 逐一取出 `pid=<n>,` token，與 PID 集合**整個 token 精確比對**（尾逗號為界，`pid=12` 不會配到 `pid=123`），配到即整行印出並加上 `LISTEN ` 前綴；無配對時印 `LISTEN (none found for pid <pids>)`
  - `SERVICE_NAME` 一律沿用常數；`restart: false` 時不產生 LISTEN 段（行為不變）
- `scripts/__tests__/dev-deploy-headless.test.mjs`（+2 tests）
  - 結構測試：腳本不含 `grep -E 'node|bat-server'`、含 MainPID / ControlGroup 查詢與 `renderListenCheck()` 全部行；`restart: false` 的 deploy / rollback 不含 `LISTEN` / `ss -ltnp`
  - fixture 實跑（Git Bash，`systemctl` / `ss` 以 bash function stub，假 ControlGroup 路徑走 MainPID 退回路徑）：`ss` 樣本含 `users:(("MainThread",pid=1234,fd=21))`、干擾行 `pid=12345`、同行多持有者 `pid=123` + `pid=1234`。MainPID `1234` 只配到 2 行（9877 與同行多持有者）；`12` → `LISTEN (none found for pid 12)`；`0` / 空 → `LISTEN (service has no running PID)`
- `docs/remote-dev-overview.md`：**未改**。現有描述只寫「print is-active, LISTEN sockets and the journal tail」，沒有寫比對方式，仍然正確

**MainPID vs cgroup 的選擇：取 cgroup.procs，MainPID 作為退回與「是否在跑」的判定。** 理由：
1. 服務是否在跑以 MainPID 判定，`0` / 空時不必讀 cgroup
2. `ExecStart` 是 `~/.local/bat-server/bin/bat-server`。若它日後變成沒有 `exec` 的 wrapper，socket 會落在子行程，只看 MainPID 會再次誤報 `(none found)`；cgroup 內所有 PID 都涵蓋得到
3. cgroup v1 或 `cgroup.procs` 不可讀時，退回 MainPID 仍然正確（目前實測 cgroup 只有 MainPID 293，兩者結果相同）

### WSL 唯讀實測輸出
唯讀探查（`systemctl --user show`、`cat cgroup.procs`、`ss -ltnp`；未 restart / 未寫入）：
```
MainPID=293
CG=/user.slice/user-1000.slice/user@1000.service/app.slice/bat-server.service
procs:
293
ExecStart:
{ path=/home/gower/.local/bat-server/bin/bat-server ; argv[]=/home/gower/.local/bat-server/bin/bat-server ; ... pid=293 ; ... }
ss:
LISTEN 0      511         127.0.0.1:9877      0.0.0.0:*    users:(("MainThread",pid=293,fd=21))
（其餘為 systemd-resolved :53，無 users 欄）
```
以 `renderListenCheck()` 抽出的獨立片段（`#!/usr/bin/env bash` + `set -u` + 該函式輸出），用 `wsl.exe -d Ubuntu-24.04 --exec bash <file>` 執行：
```
LISTEN LISTEN 0      511         127.0.0.1:9877      0.0.0.0:*    users:(("MainThread",pid=293,fd=21))
exit=0
```
補充：WSL 的 `awk` 為 `/usr/bin/gawk`。另以同一段 awk 在 WSL 驗證多 PID（以換行分隔的 `5` / `293`）：配到 `pid=293`、`pid=5`，沒有誤配 `pid=2930`；無配對訊息會把換行收斂成 `none found for pid 5 293`。

### 驗收結果
| 項目 | 結果 | 證據 |
|------|------|------|
| unit：不含 `grep -E 'node\|bat-server'`、改以 PID 比對；`restart: false` 不產生 LISTEN 段 | PASS | `checks LISTEN sockets by the service PID, not by process name` |
| fixture 過濾（`MainThread,pid=1234`、`pid=12345` 干擾行） | PASS | `LISTEN check matches pid=<n>, exactly against an ss sample`（Git Bash 實跑，未 skip） |
| WSL 唯讀實測列出 `127.0.0.1:9877` | PASS | 見上 |
| `npm run test:unit` | PASS | 78 files / **1085** passed（基線 1083 + 本單 2） |
| `npx vite build` | PASS | exit 0 |
| `npx tsc --noEmit` ≤ 40 | PASS | **40** 個 `error TS`（與門檻相同，本單只改 `.mjs`） |

### Commit
`git commit --only` 本單三檔（`scripts/dev-deploy-headless.mjs`、`scripts/__tests__/dev-deploy-headless.test.mjs`、本工單）；不 push。hash 見 git log（本工單收在同一個 commit，無法自我引用 hash）。

### 互動紀錄
無

### Renew 歷程
無

### 遭遇問題
無。未對 WSL `~/.local/bat-server` 寫入，未 restart / stop `bat-server.service`；WSL 端只跑過唯讀指令。

### 回報時間
2026-10-05 01:09 (UTC+8)
