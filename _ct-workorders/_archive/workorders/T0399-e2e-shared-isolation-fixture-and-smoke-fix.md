---
schema_version: 1
schema_kind: workorder
id: T0399
title: "e2e：抽出 Electron 隔離啟動 / 關閉 fixture，修好既有 smoke.spec（結束確認對話框卡住 app.close + 未隔離 BAT env）"
type: test
status: DONE
repo: better-agent-terminal
project: PLAN-036
priority: P2
sizing: S
created_at: "2026-10-05T01:36:55+08:00"
started_at: "2026-10-05T01:37:59+08:00"
updated_at: "2026-10-05T01:42:32+08:00"
completed_at: "2026-10-05T01:42:32+08:00"
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
- **狀態**：DONE
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
**DONE** —— 四項驗收全數達成：smoke PASS（806ms／單跑 1.4s）、E1-E4 4/4 PASS、`bug075` PASS、`server-bundle-distribution` 8 skip，**0 failed**；使用者 BAT 前後一致；unit 全綠、tsc 40。

**落點檢查**：PASS —— C-0 `repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal`；C-1 工單位於 REPO_ROOT 下；C-3 `e2e/smoke.spec.ts` / `e2e/plan036-p0.spec.ts` 存在、`e2e/fixtures/electron-isolation.ts` 的祖先 `e2e/fixtures/` 存在；C-2 無 `branch` 欄位（目前 `main`）。`BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）。`CT_MODE=on`、`CT_INTERACTIVE=0`。

### 產出摘要
- **新增 `e2e/fixtures/electron-isolation.ts`**：從 T0397 `plan036-p0.spec.ts` 原樣搬出 `run` / `freePort` / `isolatedEnv` / `readPid` / `commandLineOf` / `launchIsolated` / `closeIsolated`，並匯出 `REPO_ROOT` / `MAIN_BUNDLE` / `TERMINAL_SERVER_SCRIPT` / `IsolatedInstance` / `testLogger(prefix)`
  - `launchIsolated(name, log)`：runtime id 固定為 `e2e-<name>-<timestamp>`（`name` 過 `/^[a-zA-Z0-9._-]+$/`），因此每個 userData 都落在 `*runtime-e2e*` 樣式下；隔離 env（剔除 `BAT_*` / `CT_*` / `ELECTRON_RUN_AS_NODE`，`BAT_REMOTE_PORT` = 空閒埠且排除 9876 / 9877）；userData basename 斷言含 `-runtime-<runtimeId>`
  - `closeIsolated(inst, log)`：stub `dialog.showMessageBox` → `{ response: 1, checkboxChecked: true }` → `app.close()` 20s 逾時即 kill → Terminal Server 殘留時，命令列含本 repo `dist-electron/terminal-server.js` 才 `taskkill /T /F` → 刪 runtime userData
  - 相對 T0397 原版的加固（沒有放寬任何斷言）：(1) launch 後若 userData 斷言或 `firstWindow` 失敗，先 `closeIsolated` 再丟錯，不留下啟動到一半的 instance；(2) 刪 userData 前再確認 basename 含 `-runtime-<runtimeId>`，不符就不刪（防止誤刪安裝版 userData）；(3) close 逾時的 timer 會 `clearTimeout`
- **`e2e/smoke.spec.ts`**：改用 fixture（`launchIsolated('smoke')` → 讀 `inst.win.title()` → `closeIsolated`），斷言不變（title 非空）
- **`e2e/plan036-p0.spec.ts`**：刪除本地的隔離 helper，改 import fixture；`launchIsolated(tag)` 包成 `launchFixture(`plan036-${tag}`, log)`，runtime id 與原本完全相同（`e2e-plan036-<tag>-<ts>`）。E1-E4 測試主體及 `detectWslDistro` / `wslHome` / `openLoopbackRemoteWindow` / `shellOptionValues` 逐行 diff，只有 4 處 `closeIsolated(inst)` → `closeIsolated(inst, log)`，**斷言零改動**
- 沒有改 `electron/` / `src/` / `package.json` / `playwright.config.ts`

### e2e 實跑結果

`npx vite build` exit 0（HEAD `7dfecd8`；當時工作區含 T0398 進行中的 `electron/pty-manager.ts` 修改，以及未追蹤的 `electron/pty-locale-env.ts`、`electron/__tests__/pty-*locale-env.test.ts`，build 已包含這些 WIP；本單沒有碰它們）。

| 閘門 | 結果 | 證據 |
|------|------|------|
| `npx playwright test e2e/smoke.spec.ts`（單跑） | ✅ PASS | **806ms，1 passed (1.4s)**（< 10s）；Terminal Server pid 1716 teardown 後 alive=false；userData removed=true。修前是 60s 逾時 + worker teardown 逾時 |
| `npm run test:e2e`（14 tests） | ✅ **6 passed / 8 skipped / 0 failed (10.5s)** | passed = E1 (776ms) / E2 (5.4s) / E3 (1.3s) / E4 (1.4s) / smoke (759ms) / `bug075-bat-auto-session` (185ms)；skipped = `server-bundle-distribution.spec.ts` 既有的 8 個 skeleton |
| E1 | ✅ | `abortSession(<unknown id>)` → `{"ok":true,"value":false}`；`PROXIED_CHANNELS` 43 個 `claude:*`，未綁定 none |
| E2 | ✅ | Terminal Server pid 25388，命令列 = 本 repo `node_modules\electron\dist\electron.exe …\dist-electron\terminal-server.js`；restart + 4s：`pty:exit` 0 個、`getCwd="C:\\Users\\Gower"`；之後回應 5678；kill 後收到 1 個 exit |
| E3 | ✅ | 本機 `auto,pwsh,powershell,cmd,git-bash,custom`；loopback wsl-linux 遠端視窗 `auto,zsh,bash,sh,custom` |
| E4 | ✅ | `defaultPath = \\wsl.localhost\Ubuntu-24.04\home\gower`；`/mnt/c/...` 提示有顯示 |
| 每個 instance 的 teardown | ✅ | 5 個 instance 全部 `Terminal Server … alive after teardown: false`、`runtime userData removed: true`；沒有任何一次走到「20s 逾時 kill」或「命令列比對 kill」分支（stub 對話框後都正常退出） |
| `npm run test:unit` | ✅ PASS | **81 files / 1177 tests** 全綠（見遭遇問題 1） |
| `npx tsc --noEmit` | ✅ PASS | **40**（≤ 40）。根 tsconfig 不含 `e2e/`，另以 `tsc --noEmit --strict --skipLibCheck --esModuleInterop --module esnext --moduleResolution bundler --target es2022 --types node` 檢查三個 e2e 檔 → exit 0 |

### 使用者 BAT 前後對照

PowerShell 快照（scratchpad `snap.ps1`；本 repo electron 行程以 `ExecutablePath` 前綴 = 本 repo `node_modules\electron\` 判定）：

| 項目 | 前（2026-10-05T01:38:51+08:00） | 後（2026-10-05T01:40:41+08:00） |
|------|----|----|
| `BetterAgentTerminal` 行程數 / 最早 PID | 6 / 16484 | 6 / 16484 |
| 主視窗數 | 1 | 1 |
| 安裝版 Terminal Server（`%APPDATA%\BetterAgentTerminal\bat-pty-server.pid`） | 33184，alive，建立於 01:04:18 | 33184，alive，建立於 01:04:18 |
| 9876 LISTEN | `127.0.0.1/16484` | `127.0.0.1/16484` |
| 本 repo `node_modules\electron` 行程 | 0 | 0 |
| `%APPDATA%\*runtime-e2e*` 目錄 | 0 | 0 |

- 測試期間 RemoteServer 一律在空閒埠（58102 / 58120 / 58127 / 58139 / 58149 / 58160），沒有碰 9876
- 本單沒有執行任何 `taskkill`（teardown 都正常退出，命令列比對 kill 分支沒有觸發）

### 互動紀錄
無

### Renew 歷程
無

### 遭遇問題
1. **第一次 `npm run test:unit` 有 1 個失敗，不是本單造成**：`electron/__tests__/pty-manager-locale-env.test.ts > child_process fallback: spawn env comes from resolvePtyLocaleEnv`（`expected "vi.fn()" to be called 1 times, but got 2 times`）。該檔是 T0398 平行新增、尚未追蹤的進行中測試；排除該檔時 80 files / 1174 tests 全綠。約 1 分鐘後重跑全套已是 **81 / 1177 全綠**（T0398 已修好）。本單的改動只在 `e2e/`，不在 vitest 範圍內
2. 初版快照腳本用命令列比對 `node_modules\electron`，會把命令列含該字串的 bash 包裝行程算進去（誤報 3 個）；改成比對 `ExecutablePath` 後為 0。上表數字都是修正後的版本
3. 觀察：fixture 目前是一般 helper 函式，不是 Playwright `test.extend` fixture —— E3 / E4 要在 launch 前先依 WSL distro 決定是否 skip，`test.extend` 的 fixture 會在 skip 判斷前就啟動 app。日後若有新 spec 想要自動 teardown，可在此檔另包一層 `test.extend`

### Commit
- `git commit --only` 只含 `e2e/fixtures/electron-isolation.ts`、`e2e/smoke.spec.ts`、`e2e/plan036-p0.spec.ts` 與本工單；沒有 push；沒有 commit `e2e-results/`；沒有碰 T0398 的檔案。hash 見 `git log`（回報區在 commit 前寫入，不自我引用）
- 沒有使用 stash / reset / checkout / restore

### 回報時間
2026-10-05T01:42:32+08:00
