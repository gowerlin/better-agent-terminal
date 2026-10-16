---
schema_version: 1
schema_kind: workorder
id: T0559
title: "WSL 實機 e2e（安裝版 pre.5）：精靈 pre.4 → pre.5 升級沿用 port / profile、乾淨覆蓋（BUG-138 / 139）、升級後取消還原（BUG-141），並回歸 PLAN-036 / 037"
type: verification
status: DONE
repo: better-agent-terminal
project: BUG-138
priority: P2
sizing: S
created_at: "2026-10-16T14:12:46+0800"
updated_at: "2026-10-16T14:20:40+0800"
started_at: "2026-10-16T14:13:46+08:00"
completed_at: "2026-10-16T14:20:00+08:00"
commit: ""
target_version: "0.6.1-pre.5（已安裝；不改產品程式碼）"
depends_on: []
related:
  - "T0550（WSL 實機驗收 spec `e2e/t0550-wsl-acceptance.spec.ts`、以安裝版 exe 起隔離實例）"
  - "T0552（BUG-138 / 139，`BAT_E2E_T0550_UPGRADE_RUNNING=1`）"
  - "T0554（BUG-141，`BAT_E2E_T0554_CANCEL_AFTER_INSTALL=1`；當時 A3.clean-install 因同版重裝記 FAIL，跨版才適用）"
affects_files:
  - _ct-workorders/T0559-wsl-e2e-pre5-upgrade-bug138-139-141.md
  - e2e/t0550-wsl-acceptance.spec.ts
renew_count: 0
workdir: main repo
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 不改任何產品程式碼（`src/**`、`electron/**`、`scripts/**`、`package.json`）。只有 spec 本身阻擋本單（例如判定寫死 pre.4、安裝版 exe 無法注入失敗）時，才可以最小幅度修改 `e2e/t0550-wsl-acceptance.spec.ts`，並在回報區逐項說明；預設行為（未設 opt-in 變數時全 skip）不得改變。"
  - "🔴 WSL：只動 `Ubuntu-24.04` 的 `~/.local/bat-server`、`~/.local/share/bat-server` 與 `~/.config/systemd/user/bat-server.service`。動之前先備份：`cp -a ~/.local/bat-server ~/.local/bat-server.bak-0.6.1-pre.4-t0559`、unit 檔 `.bak-0.6.1-pre.4-t0559`、資料目錄 `~/.local/share/bat-server.bak-t0559`；備份**保留不刪**，路徑寫進回報區（由使用者決定何時刪）。"
  - "🔴 結束狀態必須是：`version: 0.6.1-pre.5`、service active / enabled、unit `BAT_SERVER_PORT=9877`（或命令列 `--port 9877`）且由 MainPID 在 `127.0.0.1:9877` LISTEN、憑證指紋與開始時相同（開始時先記錄 `server-cert.json` / `server-token.json` 的 sha256 與指紋）。無法達成時用備份還原到開始狀態（pre.4、9877、同指紋）再回報 FAILED。"
  - "🔴 使用者自己的 BAT（9876）與其 profile 一律不動；只用隔離實例（`--runtime=e2e-…`）。不按工具安裝按鈕、不啟動任何模型（spec 的遠端派工用不存在的 `gemini-cli`）。"
  - "🔴 commit 用 `git add` 後 `git commit --only <本單檔> [e2e/t0550-wsl-acceptance.spec.ts]`（`src/styles/settings.css` 的 M 狀態不是你的變更）。不 push、不觸發 workflow、不建 tag；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF。"
  - "🔴 不要呼叫 `bat-terminal.mjs --close-worker`；通知塔台之後不要再執行任何指令。"
---

# T0559 — WSL 實機 e2e（安裝版 pre.5）：BUG-138 / 139 / 141 + 回歸

## 背景

`0.6.1-pre.5` 已安裝於本機（`C:\Program Files\BetterAgentTerminal\BetterAgentTerminal.exe`）。WSL `Ubuntu-24.04` 的 bat-server 目前是 **0.6.1-pre.4**，systemd user service 在 9877 執行中（塔台 14:12 確認，無舊備份）。使用者自己的 BAT 有一個 WSL profile 依賴 9877 與該憑證。

BUG-138 / 139 / 141 的修正（T0552 / T0554）已隨 pre.5 發佈，但當時的實機驗證都用本機 source build，而且是同版重裝。本單用**安裝版 pre.5 exe** 做一次真正的跨版升級（pre.4 → pre.5），把可自動化的部分跑完。

## 任務

1. 照 ct-exec 開工。記錄開始狀態：bundle 版號、service 狀態、unit 內容中的 port、`127.0.0.1:9877` 的 LISTEN 與 MainPID、`server-cert.json` / `server-token.json` sha256、憑證指紋、`~/.local/bat-server` 頂層目錄與 `node_modules` 頂層套件清單；完成備份（見 memory_overrides）。
2. **BUG-141（取消還原）**，先跑：
   ```powershell
   $env:BAT_E2E_T0550='1'
   $env:BAT_E2E_T0554_CANCEL_AFTER_INSTALL='1'
   $env:BAT_E2E_EXECUTABLE='C:\Program Files\BetterAgentTerminal\BetterAgentTerminal.exe'
   $env:BAT_E2E_T0550_VERSION='0.6.1-pre.5'
   npx playwright test e2e/t0550-wsl-acceptance.spec.ts -g "T0554"
   ```
   期望：精靈換入 pre.5 → 注入 fetch-fingerprint 失敗 → 取消 → install tree、unit、執行中的 service 都回到 **pre.4**、9877、同指紋，`.bat-new` / `.bat-old` 無殘留。
   若安裝版 exe 無法注入失敗（spec 依賴 source build 的機制），改用本機 source build（HEAD 與 pre.5 的產品程式碼相同，`git diff 6ad3c089 HEAD -- src electron scripts` 應為空；先 `npx vite build`，不設 `BAT_E2E_EXECUTABLE`），並在回報區寫明是哪一種。
3. **BUG-138 / 139（升級，舊 server 執行中）+ 回歸**，接著跑完整 spec（清掉 `BAT_E2E_T0554_CANCEL_AFTER_INSTALL`）：
   ```powershell
   Remove-Item Env:BAT_E2E_T0554_CANCEL_AFTER_INSTALL
   $env:BAT_E2E_T0550_UPGRADE_RUNNING='1'
   npx playwright test e2e/t0550-wsl-acceptance.spec.ts
   ```
   期望：A1–A3（含 `A2.upgrade-running`：同 port、既有 profile 被更新而不是新建；`A3.clean-install`：舊 bundle 已不提供的套件不再殘留，跨版升級本項應 PASS）、B4 smoke S1–S13、B5 遠端視窗、C6 工具偵測、A4 離線匯入。
4. 檢查結束狀態（memory_overrides 第 3 條），並把 `<evidence>/results.json` 的每一項 verdict 列進回報區（PASS / FAIL / NEEDS-HUMAN / INFO 與一行證據）。
5. 填 `DONE`（全部可自動化項目 PASS）/ `PARTIAL`（有 FAIL，寫明哪一項與證據）/ `FAILED`；commit；通知塔台（yolo：`bat-notify.mjs --submit`，`--source "T0559"`）。通知後保持閒置。

## 驗收條件

- [ ] 開始狀態與備份路徑已記錄
- [ ] T0554 cancel 結果（含使用哪種 build）與還原後狀態
- [ ] 完整 spec 結果逐項列出；`A2.upgrade-running`、`A3.clean-install` 明確寫 PASS / FAIL
- [ ] 結束狀態符合：pre.5、active / enabled、9877、指紋不變
- [ ] 若有修改 spec：逐項說明原因，且未設 opt-in 變數時仍全 skip（實測）
- [ ] commit 只含本單檔（與必要時的 spec）

## 注意

- 使用者 BAT 若開著 WSL 遠端視窗，升級期間 service 重啟會讓它暫時斷線，之後應自動重連；這不是失敗。
- 時間戳一律以指令取得（R-G001）。

---

## 回報區

> 以下由 sub-session 填寫

### 完成狀態

**PARTIAL**：產品行為全部達成（BUG-141 取消還原、BUG-138 同 port / 更新既有 profile、BUG-139 乾淨覆蓋、PLAN-036 / 037 回歸、A4 離線匯入），結束狀態符合 memory_overrides 第 3 條。results.json 有 **2 項 FAIL**，兩項經查都是 spec 判定條件本身的誤判，不是產品缺陷（證據見下）；依本單規則「有 FAIL → PARTIAL」，由塔台決定是否改判。spec 未修改。

### 產出摘要

**Landing check**：PASS。C-0 `repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal`；C-1 工單在 repo 內；C-3 `e2e/t0550-wsl-acceptance.spec.ts` 存在；C-2 無 `branch` 欄位（HEAD `main`）。`BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）。

**Build**：兩次執行都用**安裝版** `C:\Program Files\BetterAgentTerminal\BetterAgentTerminal.exe`（FileVersion `0.6.1-pre.5`，無內建 baseline）。T0554 的 `app.evaluate` 注入在安裝版可用，不需要改用 source build。`git diff 6ad3c089 HEAD -- src electron scripts` 為空。

#### 1. 開始狀態（2026-10-16T14:13 起，WSL `Ubuntu-24.04`）

| 項目 | 值 |
|---|---|
| bundle | `0.6.1-pre.4`（`~/.local/bat-server`，390 MiB） |
| service | `active` / `enabled`，MainPID 391 |
| unit port | `Environment="BAT_PORT=9877"` + `Environment="BAT_SERVER_PORT=9877"`（ExecStart 不帶 `--port`），unit sha256 `937940b4e1e37fa0…` |
| LISTEN | `127.0.0.1:9877` pid=391 |
| `server-cert.json` sha256 | `dd0bc13fe5061b1b467d9f54169416e460e9fb2fc8aa0c554d9142564686ba1c` |
| `server-token.json` sha256 | `bfc48f5c3a8c75224b77014ff088f0565297fe0064f042785f7de46eeb110d4f` |
| 指紋 | `22:3A:E4:C7:4F:4F:7C:D1:23:09:11:A1:DB:62:CD:82:A9:31:66:95:48:D0:34:CD:6C:42:9C:B7:0A:D1:79:97` |
| 頂層 | `README.md bin electron node_modules package.json scripts` |
| `node_modules` | `@anthropic-ai`（`claude-agent-sdk claude-code claude-code-linux-x64`）、`@lydell`（pre.4 已無 stale 套件） |
| 既有備份 / `.bat-*` | 無 |

**備份（保留不刪，由使用者決定何時刪）**：
- `/home/gower/.local/bat-server.bak-0.6.1-pre.4-t0559`（`diff -rq` 與原樹相同）
- `/home/gower/.config/systemd/user/bat-server.service.bak-0.6.1-pre.4-t0559`（`cmp` 相同）
- `/home/gower/.local/share/bat-server.bak-t0559`（cert / token sha256 同上）

#### 2. BUG-141（T0554 cancel，安裝版）— 1 passed（38.5 s），證據 `%TEMP%\bat-t0559\evidence-t0554\`、log `%TEMP%\bat-t0559\run-t0554.log`

| key | verdict | 證據 |
|---|---|---|
| T0554.failed-after-install | PASS | 精靈在「取得 TLS 指紋」失敗（注入）；當下 server 為 `0.6.1-pre.5` active MainPID 7662，marker absent，`.bat-old` 保留 |
| T0554.restored | PASS | marker present、inode 48075 → 48075、unit sha256 `937940b4…` 不變、`.bat-new` / `.bat-old` 無殘留；`0.6.1-pre.4` → `0.6.1-pre.4`、9877 → 9877、指紋 `22:3A:E4:C7…` 不變 |
| T0554.service-running | PASS | MainPID 391 → 7662（新 bundle）→ 8354（舊 bundle 重新啟動），`127.0.0.1:9877` pid=8354 |
| T0554.profiles-untouched | **FAIL（spec 誤判）** | profiles 1 → 1（只有隔離實例的 local `Default`），見「遭遇問題 1」 |
| T0554.rollback-log | INFO | `Keeping port 9877 of the existing BAT server` / `Restored the previous bat-server.service unit` / `Restored the previous BAT server bundle at /home/gower/.local/bat-server` / `Started the previous bat-server.service again` |

還原後實測：`0.6.1-pre.4`、active、9877、同指紋（之後進入步驟 3）。

#### 3. BUG-138 / 139 + 回歸（`BAT_E2E_T0550_UPGRADE_RUNNING=1`，安裝版）— 5 passed / 1 skipped（T0554，未設開關），1.4 min，證據 `%TEMP%\bat-t0559\evidence-full\`、log `%TEMP%\bat-t0559\run-full.log`

執行前在 pre.4 樹內放了 canary：`~/.local/bat-server/.t0559-canary` 與 `~/.local/bat-server/node_modules/t0559-stale-canary/`（模擬「舊 bundle 有、新 bundle 沒有」的檔案；不改 spec，只是額外證據）。

| key | verdict | 證據 |
|---|---|---|
| A0.port-while-running | INFO | 舊 server 佔 9877 時 `pickServerPort()`（無 existing）→ 9878；精靈本身走 existing 分支沿用 9877（見 A2.upgrade-running） |
| A1 | INFO（upgrade-running 模式不判） | 從 `server-bundle-v0.6.1-pre.5` release 下載 `bat-server-linux-x64-v0.6.1-pre.5.tar.gz`，cache 有 tarball + sidecar |
| A2.server | PASS | `0.6.1-pre.5` active MainPID 10123；unit port 9877；`127.0.0.1:9877` pid=10123；profile `remotePort` 9877 |
| A2.identity-kept | PASS | port 9877 → 9877；指紋 `22:3A:E4:C7…` 不變，精靈 pin 同一指紋 |
| **A2.upgrade-running** | **PASS** | 舊 server 執行中；unit port 9877 → 9877；`Ubuntu-24.04` profile 只有 1 個 = 預先放的 `t0552-seed-ubuntu-24-04`（被更新、token 已換、未新建） |
| A2.profile-opens | PASS | 遠端視窗開啟，remote shell → `T0550-gower@GXDEVPC02-25` |
| A3 | PASS | helper（`bat-terminal.mjs` / `bat-notify.mjs` / `_bat-cert.mjs` / `_bat-logger.mjs`）、`bin/node`（v24.22.0）、`bin/bat-server` 都在 |
| A3.leftovers | INFO | （說明文字是 T0552 前的舊敘述）`node_modules` 只剩 `@anthropic-ai @lydell` |
| **A3.clean-install** | **FAIL（spec 誤判）** | 三個條件中，stale 套件 none ✅、`.bat-new` / `.bat-old` none ✅、data dir 有 cert / token ✅；唯一不成立的是 `du` 390 → 390 MiB（要求變小）。**canary 兩個都已消失** → 乾淨覆蓋實際成立，見「遭遇問題 2」 |
| B4.S1–S13 | 13 × PASS | `[smoke] RESULT: 13/13 PASS`（S1 bundle=0.6.1-pre.5、同指紋；S13 helper env 無 server token、`Forbidden: channel-not-allowed` / `agent-not-allowed`），cleanup 無殘留 PTY |
| B4 | PASS | exit 0 |
| B5.1 | PASS | `B51-30x100-0.6.1-pre.5-OK` |
| B5.2 | PASS | 斷線 10 s 後重連，`pty:get-buffer` 有 `B52-REPLAY-42`，同一 shell（`B52-PID-13293`） |
| B5.3 | PASS | git root / branch `t0550` / log / status（linux 與 UNC 路徑） |
| B5.4 | PASS | sync 前 `Path access denied`；workspace save 後讀得到；`/etc/hostname` 仍 denied |
| B5.5 | PASS | 遠端 Tower 派工 `B55-EXIT=0`，落點 `t0550-ws-…`（from --workspace）、agent `gemini-cli`，Worker `bat-notify` → `terminal:notified` source `T0550`（未啟動任何模型） |
| C6.versions | PASS | claude 2.1.287 / codex 0.160.0 / git 2.43.0 / gh 2.102.0 / node 24.22.0（nvm）與 distro 一致 |
| C6.login | PASS | gh / claude / codex 皆未登入，偵測一致 |
| C6.both-paths | PASS | `remoteTools.detect(profile)` 與 `detectHere()` 皆 ok |
| C6.ui | INFO | profile card tools entry：`(entry not visible)`（INFO 項，T0550 同樣狀況，未判定） |
| A4.offer | PASS | `BAT_SERVER_BUNDLE_BASE_URL=http://127.0.0.1:9/` → 安裝步驟失敗，動作含 `import-server-bundle:匯入本機 tarball…`，訊息三語提示正確；WSL server 未動 |
| A4.import | PASS | `importLocal` ok（sha256 `88573c20cc48c556…`，166,362,972 bytes），cache 有 tarball + `.sha256`，`distribute` → `source: cache` |
| A4.untouched | PASS | MainPID 10123 → 10123，`0.6.1-pre.5` |

#### 4. 結束狀態（14:18，符合 memory_overrides 第 3 條）

| 項目 | 值 |
|---|---|
| bundle | `0.6.1-pre.5` |
| service | `active` / `enabled`，MainPID 10123 |
| unit | `BAT_SERVER_PORT=9877`；內容與備份逐位元相同（sha256 `937940b4…`，精靈 14:17:28 重寫，WSL writer 為 env 形式） |
| LISTEN | `127.0.0.1:9877` pid=10123（= MainPID） |
| cert / token sha256、指紋 | 與開始時完全相同（`dd0bc13f…` / `bfc48f5c…` / `22:3A:E4:C7…79:97`） |
| `.bat-new` / `.bat-old` | 無 |
| canary | 已不存在（`.t0559-canary`、`node_modules/t0559-stale-canary`） |
| 使用者 BAT | 9876 仍由原行程（pid 29492）LISTEN，未操作；隔離實例 userData 皆已移除、Terminal Server 無殘留 |

#### Spec 修改

無。`e2e/t0550-wsl-acceptance.spec.ts` 未修改，所以「未設 opt-in 變數仍全 skip」不受影響。

#### Commit

只含本工單檔（`git commit --only`）。

### 互動紀錄

無（`CT_MODE=yolo`、`CT_INTERACTIVE=0`）。

### Renew 歷程

無。

### 遭遇問題

1. **`T0554.profiles-untouched` FAIL = spec 時間差誤判**。判定是整份 profile JSON（只遮 token）前後相等，但 `workspace:save`（renderer 30 s autosave）會 fire-and-forget 呼叫 `profileManager.save()`（`electron/main.ts:2188`），更新 local profile 的 `updatedAt`（`electron/profile-manager.ts:566`）。探針（scratchpad 的獨立 playwright spec，安裝版 exe、隔離實例，**完全不開精靈**）：t0 / t+10 s / t+20 s `updatedAt=1792131382783`，t+30 s 變成 `1792131413036`，其他欄位不變。本次 T0554 測試從取 before 到取 after 跨過 30 s；T0554 原始執行（source build）PASS 是因為沒跨過。count 1 → 1，且沒有任何 wsl-linux profile 被建立。**建議後續**：spec 比對時排除 `updatedAt`（或只比 remote / wsl 相關欄位）。
2. **`A3.clean-install` FAIL = 判定條件不適用於 pre.4 → pre.5**。條件要求 `du` 變小，前提是舊樹有新 bundle 已移除的套件；pre.4 本身已是 T0546 之後的瘦身 bundle（無 `claude-agent-sdk-linux-x64` / `@img` / `sharp` / `better-sqlite3`），pre.4 與 pre.5 皆 390 MiB。其餘三個條件都成立，另以 canary 直接驗證：升級前放進 pre.4 樹的 `.t0559-canary` 與 `node_modules/t0559-stale-canary/` 升級後都不存在 → BUG-139 乾淨覆蓋實際成立。**建議後續**：spec 改為植入 canary 判定（不依賴 `du`）。
3. `A3.leftovers` 的說明文字（「extracts over the existing directory … files of the old bundle stay」）是 T0552 前的舊敘述，與目前行為不符（INFO 項，不影響判定）。

### 回報時間

2026-10-16T14:19:03+08:00

---

## 塔台收單（第六十七 session，2026-10-16T14:20:40+0800）

- **改判 DONE**（Worker 回報 PARTIAL）：commit `109ffd7e`（只含本單）。產品行為全部達成；results.json 的 2 項 FAIL 經塔台審閱為 spec 判定條件問題，非產品缺陷：
  - `T0554.profiles-untouched`：整份 profile JSON 比對跨過 renderer 30 s autosave，local profile `updatedAt` 改變（Worker 獨立探針重現：t+30 s 變動，其他欄位不變）；profile 數 1 → 1、無 wsl profile 建立。
  - `A3.clean-install`：「`du` 變小」前提不適用（pre.4 已是瘦身 bundle，390 → 390 MiB）；canary 證明舊樹檔案已清除。
- **塔台複驗 WSL**（14:20）：`version: 0.6.1-pre.5`、active / enabled、MainPID 10123 在 `127.0.0.1:9877` LISTEN、unit `BAT_SERVER_PORT=9877`、cert `dd0bc13f…` / token `bfc48f5c…` 與開始時相同、`.bat-*` 與 canary 無殘留；備份 3 份仍在（`~/.local/bat-server.bak-0.6.1-pre.4-t0559`、`~/.config/systemd/user/bat-server.service.bak-0.6.1-pre.4-t0559`、`~/.local/share/bat-server.bak-t0559`）。
- → BUG-138 / 139 / 141 **CLOSED**；spec 修正（排除 `updatedAt`、canary 判定、`A3.leftovers` 舊說明）→ **T0560**。
- 仍未實機：SSH 主機升級 / 取消還原（只有單元測試）、WSL 工具面板 Node（nvm）目視。
