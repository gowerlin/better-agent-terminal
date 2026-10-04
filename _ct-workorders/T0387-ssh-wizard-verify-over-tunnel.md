---
schema_version: 1
schema_kind: workorder
id: T0387
title: "BUG-093 修復：SSH 精靈的「取得指紋 / 連線測試」改連遠端主機（tunnel 模式經 SSH tunnel，direct 模式直連），不再驗到本機 BAT"
type: implementation
status: DONE
priority: P1
sizing: M
created_at: "2026-10-04T23:34:17+08:00"
updated_at: "2026-10-05T00:03:23+08:00"
started_at: "2026-10-04T23:36:44+08:00"
completed_at: "2026-10-05T00:03:23+08:00"
target_version: next
depends_on: []
related:
  - "BUG-093（修復對象）"
  - "T0381（fetch-fingerprint TLS 握手）/ T0382（主機可用埠探測）"
  - "BUG-088 / T0379（SSH 精靈絕對路徑）"
  - "PLAN-036 / T0386（平行研究，唯讀）"
affects_files:
  - src/components/setup-wizard/ssh-flow.ts
  - src/components/setup-wizard/steps/ssh/
  - src/components/setup-wizard/steps/wsl/fetch-fingerprint.ts
  - src/components/setup-wizard/steps/wsl/connect-test.ts
  - src/components/setup-wizard/wizard-runner.ts
  - src/components/setup-wizard/__tests__/
  - electron/remote/ssh-tunnel.ts
  - electron/main.ts
  - electron/preload.ts
  - src/types/electron.d.ts
  - electron/__tests__/
interaction:
  mode_hint: on
  interactive: false
  intervention_type: none
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 不得連線、修改或安裝任何真實遠端主機；SSH 相關一律以 mock / 注入的 deps 測試。若本機有可用的 SSH 測試目標也**不要**自行使用，回報區列出建議的實機驗收步驟交使用者。"
  - "🔴 不得碰使用者 WSL 內的 `bat-server.service` / `~/.local/bat-server`（塔台 23:34 部署 T0385 JS 供使用者驗收中）。"
  - "🔴 child_process 一律 `execFile` / `spawn` + array args，timeout 必設；host / user / port / path 等外部輸入沿用既有白名單驗證（CLAUDE.md Child Process Spawning）。禁用 shell-spawning exec API。"
  - "🔴 Renderer 不得 import Node builtin（D090）。"
  - "⚠️ WSL / Docker 精靈共用 `fetch-fingerprint` / `connect-test` 步驟：修改時 WSL / Docker 行為**不得改變**（以既有測試 + 新測試保證）。不 push。"
---

# T0387 — SSH 精靈驗證改連遠端

## 背景（BUG-093）

SSH 精靈直接共用 WSL 的 `fetchFingerprintStep` / `connectTestStep`，兩步都對 `127.0.0.1` / `localhost:<serverPort>` 操作，精靈期間又沒有建 SSH tunnel：

- `ssh-flow.ts:11` `DEFAULT_SERVER_PORT = 9876`，遠端 bat-server 起在 `ctx.serverPort`
- `connect-test.ts:33` `remote.testConnection('localhost', port, ...)`；fetch-fingerprint 經 `wsl:fetch-fingerprint` 對 `127.0.0.1:<serverPort>` 握手（T0381）
- `SshTunnel`（`electron/remote/ssh-tunnel.ts`）只在 `RemoteClient.doConnect()` 依 profile `useSshTunnel` 建立

⇒ 驗到的是**主機 BAT 自己**（9876 = 主機 RemoteServer），pin 進 profile 的指紋是本機的；之後經 tunnel 連遠端指紋不符被拒。

## 決策（塔台）

1. **tunnel 模式**（`sshTunnelMode: 'tunnel'`，預設）：在驗證步驟前以 `SshTunnel` 建 `-L <localPort>:127.0.0.1:<remotePort>`，fetch-fingerprint / connect-test 對 **tunnel 的 local 端**操作；精靈結束（完成 / 取消 / 失敗 / rollback）一律關閉 tunnel，不留孤兒 `ssh` 行程。local 埠由 `SshTunnel` 或 T0382 的可用埠探測決定，**不得**是 9876 或其他主機已占用埠
2. **direct 模式**：驗證對**遠端 host**（profile 的 remoteHost）的 `<remotePort>` 操作，不是 localhost
3. **指紋交叉核對**（建議做）：另經 ssh 讀遠端 `<dataDir>/server-cert.json`（或 bat-server 等價來源）算出的 fingerprint，與握手取得者比對；不符 → 步驟失敗並明確說明（可能連到了錯的伺服器）。若遠端讀不到該檔，降級為只用握手值 + `ctx.logger.warn`，不讓步驟失敗。Worker 若評估此項成本過高可略，回報區說明
4. 共用步驟的改法由 Worker 決定（參數化 target host/port、或 SSH 專用步驟包一層），但 **WSL / Docker 行為不變**
5. 寫入 profile 的 `remotePort` / `useSshTunnel` 等欄位語意不變（profile 存的是**遠端**埠；tunnel local 埠只在精靈期間使用）

## 驗收

- unit：tunnel 模式下 fetch-fingerprint / connect-test 打到 tunnel local 埠（非 9876、非 `ctx.serverPort` 的本機直連）；direct 模式打到遠端 host；精靈各結束路徑都關 tunnel；tunnel 建立失敗 → 步驟失敗並有可讀訊息；指紋交叉核對（若做）一致 / 不一致 / 讀不到三例；WSL / Docker 共用步驟回歸測試
- `npm run test:unit` 全綠（基線 **920**；回報新數字）
- `npx vite build` exit 0
- `npx tsc --noEmit` error 數不得高於 baseline **40**
- **runtime 驗收（交使用者）**：回報區列出實機步驟（需一台可 SSH 的 Linux 主機）

## Sub-session 執行指示

1. 讀取本工單 + BUG-093 + T0381 / T0382 回報區（埠探測與指紋握手實作）
2. 填 `started_at`、`status: IN_PROGRESS`（**`date "+%Y-%m-%dT%H:%M:%S%z"` 取系統時間，禁止手打**，R-G001）
3. 實作 → 驗收
4. 填回報區；完成寫 **`DONE`**（不是 `FIXED`）；BUG 狀態由塔台更新，不要改 BUG 檔
5. commit 僅實際改動檔 + 新測試檔 + 本工單檔（`git commit --only ...`）；`AGENTS.md` 若 dirty 不要碰
6. 依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 執行摘要

- 開工：`2026-10-04T23:36:44+08:00`（系統時間）；原始 `status: TODO` 視為未開始，直接轉 `IN_PROGRESS`
- 派發：`CT_MODE=on`、`CT_INTERACTIVE=0`；無使用者中途指示
- 結果：**DONE**。SSH 精靈的 fetch-fingerprint / connect-test 改連遠端 bat-server（tunnel 模式經 `ssh -L`、direct 模式直連 `sshHost`），並與遠端 `server-cert.json` 交叉核對指紋；WSL / Docker 路徑不變

### 落點檢查（Landing Zone）— 整體 **WARN**

| 檢查 | 結果 | 說明 |
|------|------|------|
| C-0 repo identity | ⚠️ WARN | frontmatter **無 `repo` 欄位**（`absent`）；`basename(REPO_ROOT)` = `better-agent-terminal`。依規則退回 C-3 + C-1 |
| C-1 工單路徑 | ✅ PASS | `REPO_ROOT` = `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`，工單在其 `_ct-workorders/` 下 |
| C-3 affects_files | ✅ PASS | 前 5 個可測項目（`ssh-flow.ts`、`steps/ssh/`、`steps/wsl/fetch-fingerprint.ts`、`steps/wsl/connect-test.ts`、`wizard-runner.ts`）全部存在 |
| C-2 branch | ℹ️ N/A | 工單無 `branch` 欄位；實際 `main` |
| `BAT_WORKSPACE_ID` | 證據 | `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b` |

### 實作

**Main（`electron/remote/ssh-wizard-verify.ts`，新）**

1. `WizardTunnelRegistry`：以精靈 session id 管理短期 tunnel，底層直接重用既有 `SshTunnel`（`-N -L <local>:localhost:<remotePort>`，frozen spec 不動；沿用 `buildBaseSshArgs` 的白名單 / BatchMode / ConnectTimeout + `spawn` array args，ready timeout 10s）
   - local 埠：不指定 → `SshTunnel.pickFreePort()` 取 OS 指派的空閒 loopback 埠；另加 guard：若等於主機 RemoteServer 埠（`readRemotePortSync()` + `remoteServer.port`，與 T0382 埠探測排除同一組值）→ 停掉 tunnel 並失敗。**不會是 9876**
   - 同 session、同目標且仍存活 → 重用；目標改變（例如跳回 configure-host 改 host）→ 先停舊的再開新的；`tunnel-down` 時移出 registry
   - 輸入驗證（session id regex、`validateSshIdentifier` 檢查 host / user / key、port 1–65535）失敗 → `ssh-tunnel-invalid-input`，不建立 tunnel
   - 建立失敗 → `ssh-tunnel-failed`，訊息帶 `user@host`、遠端埠與原因（stderr 分類：Permission denied / host key / connection refused；否則用原始錯誤，例如 readiness timeout）
   - 清理：`close(session)`、`closeOwnedBy(webContents.id)`（renderer `destroyed` 時）、`closeAll()`（`cleanupAllProcesses()` 與 `will-quit` 都會呼叫）
2. `readRemoteServerIdentity()`：一次 ssh exec（`spawn` array args、15s timeout、逾時以 `shutdownSshProcess` 收掉、輸出上限 64KB），讀遠端 bat-server 預設 dataDir（linux `$HOME/.local/share/bat-server`、darwin `$HOME/Library/Application Support/bat-server`；SSH 精靈寫的 unit / plist 沒有設 `BAT_SERVER_DATA_DIR`，所以與 `electron/remote/dataDir.ts` 的預設一致）：
   - `server-cert.json` **只用 sed 取出 `fingerprint` 欄位**，私鑰不會經 ssh 傳回
   - `server-token.json`（`{v,encrypted:false,data}` 或舊格式 `{token}`；`encrypted:true` → null）
   - 檔案不存在 → 該欄為 null（遠端指令一律 exit 0）
3. IPC（`ssh-setup-handlers.ts`）：`ssh:verify-tunnel-open` / `ssh:verify-tunnel-close` / `ssh:read-server-identity`；`registerSshSetupHandlers(ipcMain, { reservedPorts })`，由 main 傳入主機埠
4. `wsl:fetch-fingerprint` 增加可選的 `host` 參數（不帶 → 維持 `127.0.0.1`）；`fetchTlsFingerprint` 新增 host 白名單 `^[a-zA-Z0-9._:-]{1,253}$` 且不得以 `-` 開頭，否則回 `fingerprint-invalid-host`（不連線）

**Renderer**

5. `WizardContext.verifyEndpoint?: { host; port }`（只有 SSH flow 會設）。共用的 `fetchFingerprintStep` / `connectTestStep`：有 `verifyEndpoint` 就用它，沒有就維持原本的 `127.0.0.1` / `localhost` + `ctx.serverPort`（**WSL / Docker 的呼叫參數逐字不變**：`fetchFingerprint(port)` 仍是單一參數，有測試鎖定）。`fingerprint-invalid-host` 列入不重試的錯誤碼
6. `steps/ssh/verify-remote.ts`（新）：`sshFetchFingerprintStep` / `sshConnectTestStep` 以 spread 繼承共用步驟（id / labelKey / `appliesTo: 'all'` 不變，`tests/ssh-flow.test.ts` 鎖定的 step id 順序仍成立），`ssh-flow.ts` 改用這兩個步驟
   - **tunnel 模式**：開 tunnel → `verifyEndpoint = 127.0.0.1:<local>` → 握手與連線測試都打 tunnel 的 local 端
   - **direct 模式**：`verifyEndpoint = <sshHost>:<serverPort>`，不開 tunnel
   - **指紋交叉核對（決策 3，已實作）**：握手後經 ssh 讀遠端 fingerprint。一致 → ✓；不一致 → 以 `fingerprint-mismatch` 失敗，並把 `ctx.fingerprint` 清成 null（避免使用者按「略過」後把錯的指紋寫進 profile）；讀不到（ssh 失敗 / 檔案沒有指紋 / IPC throw）→ `ctx.logger.warn` 後沿用握手值
   - **tunnel 關閉路徑**：connect-test 的 `finally`（成功 / 失敗 / 無指紋 skip）、fetch-fingerprint 失敗時、兩步驟的 `rollback`（取消、或後續步驟失敗時 rollback 已完成步驟）；main 端另有 renderer destroyed 與 app quit 兜底
7. `write-profile` 未改：profile 仍存 `remotePort = ctx.serverPort`（遠端埠）與 `useSshTunnel = sshTunnelMode !== 'direct'`；tunnel 的 local 埠只在精靈期間存在（決策 5）

### 驗收結果（證據分道）

| 分道 | 結果 | 證據 |
|------|------|------|
| unit：tunnel 模式打 tunnel local 埠 | ✅ PASS | `ssh-verify-remote.test.ts`：`fetchFingerprint(53111, '127.0.0.1')`、`testConnection('127.0.0.1', 53111, …)`；明確斷言**沒有**呼叫 `fetchFingerprint(9876)` / `testConnection('localhost', 9876, …)`；`openVerifyTunnel` 的 `remotePort` = `ctx.serverPort`；`ctx.serverPort` 仍是遠端埠 |
| unit：direct 模式打遠端 host | ✅ PASS | `fetchFingerprint(9876, 'devbox.example')`、`testConnection('devbox.example', 9876, …)`，不開 tunnel |
| unit：各結束路徑都關 tunnel | ✅ PASS | 完整成功 run（`WizardRunner`）、connect-test 失敗、skip（無指紋）、fetch rollback、後續步驟失敗 rollback、fetch 失敗後取消（runner 回 `Wizard cancelled`）——fake IPC 的開啟中 session 數全部歸 0；main registry：`close` 冪等、`closeOwnedBy`、`closeAll`、`tunnel-down` 移出 |
| unit：tunnel 建立失敗 | ✅ PASS | renderer：步驟以 `code = ssh-tunnel-failed` 失敗、訊息含原因、沒有進行握手；main：Permission denied 的分類訊息、raw readiness-timeout fallback、撞到主機埠的 guard、5 種非法輸入不建立 tunnel |
| unit：指紋交叉核對 | ✅ PASS | 一致（並取得 token）/ 不一致（`fingerprint-mismatch`，訊息含兩個指紋，`ctx.fingerprint = null`）/ 讀不到（ssh 失敗、沒有指紋欄位、IPC throw → warn 但不失敗）；失敗後重試會重新開 tunnel |
| unit：遠端讀取指令 | ✅ PASS | `electron/__tests__/ssh-wizard-verify.test.ts`：dataDir（linux / darwin，拒絕 `~` 與 `..`）、指令不會 `cat` server-cert.json、darwin 含空白路徑有單引號、mock spawn 的解析與 argv（`--` 之後是 `alice@devbox.example`、含 `BatchMode=yes`）、ssh 失敗、timeout、非法輸入不 spawn、三種 token 格式 |
| unit：WSL / Docker 回歸 | ✅ PASS | 新測試鎖定：共用步驟沒有 `verifyEndpoint` 時，`fetchFingerprint` 的呼叫參數恰為 `[9877]`、`testConnection('localhost', 9900, …)`；WSL / Docker flow 仍使用原本的共用步驟物件；既有 `write-systemd-unit` / `wsl-network-mode` / `fetch-fingerprint` 測試全綠 |
| `npm run test:unit` | ✅ PASS | **67 files / 965 tests 全綠**（基線 920 → +45：electron 26、renderer 19；既有 `fetch-fingerprint.test.ts` 的「三個 flow 同一步驟」案例改為「WSL / Docker 同一步驟 + SSH 以相同 id 包裝」） |
| `npx vite build` | ✅ PASS | exit 0 |
| `npx tsc --noEmit` | ✅ PASS | **40** errors（= baseline 40）；本單觸及的檔案 0 筆 |
| 本機 runtime：遠端讀取指令 | ✅ PASS | 用 `npx tsx` 以 `generateSelfSignedCert()` 產生真實憑證，依 `persistCertificate()` 的格式（`JSON.stringify(…, null, 2)`）寫入暫存 dataDir，再用本機 Git Bash 實跑 `buildIdentityCommand()`：linux 路徑與含空白的 darwin 路徑，`fingerprint` 都與 `bundle.fingerprint` 相符、token 解析正確、stdout **不含 `PRIVATE KEY`**、缺檔時 exit 0 並回 null。另外驗證在 Windows 上 Node → 子行程的 argv 傳遞會讓該指令逐字不變（ssh.exe 同樣以 CRT 規則解析）。暫存檔已刪除 |
| runtime 驗收（交使用者） | ⏳ 待使用者 | 見下方實機步驟；Worker 依 memory_overrides **沒有連線任何真實遠端主機** |

### 實機驗收步驟（交使用者；需要一台可 SSH 的 Linux 主機）

1. 以含本修正的版本啟動 BAT（主機 RemoteServer 照常跑在 9876）。準備一台可用 key 登入的 Linux 主機（`~/.ssh/config` alias 或 `user@host`）
2. **tunnel 模式**：跑 SSH 精靈到第 5 步。預期 log 出現 `SSH tunnel ready: 127.0.0.1:<非 9876 的埠> → user@host:9876`，以及 `✓ TLS fingerprint matches the remote server-cert.json`
3. 精靈進行中（第 5–6 步）在 PowerShell 執行 `Get-CimInstance Win32_Process -Filter "Name='ssh.exe'" | Select ProcessId,CommandLine`：應該有一個帶 `-N -L <port>:localhost:9876` 的 ssh；**精靈完成後該行程應消失**
4. 比對：profile 的 `remoteFingerprint` 應等於遠端 `~/.local/share/bat-server/server-cert.json` 的 `fingerprint` 欄位，且**不等於**主機 `%APPDATA%\BetterAgentTerminal\server-cert.json` 的 fingerprint
5. 用新建的 profile 連線：應成功（不再出現指紋不符）
6. 取消 / 失敗路徑：再跑一次精靈，在第 5 或第 6 步失敗畫面按取消（或關閉精靈視窗），確認步驟 3 的 ssh 行程消失
7. （選）tunnel 建立失敗：在 configure-host 改用沒有權限的帳號 → 第 5 步應出現 `Could not open the SSH tunnel to …: SSH authentication was rejected (Permission denied)`
8. direct 模式：見下方「已知限制 1」，目前預期會失敗

### 已知限制 / 新發現（交塔台）

1. 🔴 **direct 模式整條路徑本來就不通（既有問題，範圍外）**：`ssh-start-server.ts` 的 systemd unit / launchd plist 固定 `BAT_REMOTE_BIND=localhost`，遠端 bat-server 只聽遠端 loopback；`write-profile.ts` 的 SSH 分支也固定寫 `remoteHost: 'localhost'`。本單依決策 2 讓精靈驗證打 `<sshHost>:<serverPort>`，但在 bind 改掉之前，驗證會以 `fingerprint-unreachable` 失敗。此外 `sshHost` 若是 `~/.ssh/config` alias（不是 DNS 名稱），direct 直連也解析不到。建議另開 BUG：direct 模式的 bind 設定 + profile `remoteHost` + alias → HostName 解析
2. 🔴 **SSH 精靈原本從未取得 token（新發現，已順帶處理）**：SSH 的 start-server 結果不含 token，`ctx.remoteToken` 永遠沒有被設定 → connect-test 一定拋出 `Remote server token was not available…`，write-profile 也會拋出 `Remote token missing…`。本單在交叉核對的同一次 ssh 讀取中順帶讀 `server-token.json`（只有明文格式可用；遠端 headless 沒有 keychain 時就是明文，見 `secrets.ts`），讓 connect-test 能真正執行。若讀不到 token，行為與修改前相同（connect-test 以原本的訊息失敗）
3. ⚠️ **runner 的取消路徑不會 rollback 正在失敗的步驟（既有問題，未改）**：在失敗畫面按取消時，`cancel()` 會以 `retry` 結果解除等待，迴圈頂端只 rollback **已完成**的步驟，失敗步驟自己的 `rollback()` 不會被呼叫。本單不動 runner（避免影響 WSL / Docker），改由 SSH fetch-fingerprint 失敗時自行關閉 tunnel（重試時會重開）。其他有 `rollback()` 的步驟（例如 `start-server`）在這條路徑同樣不會被 rollback，建議塔台評估
4. ⚠️ **`ssh.stopServer` / `ssh.uninstallBundle` 只有型別宣告**：`electron.d.ts` 註解寫「real IPC handlers land in a follow-up workorder」，preload / main 都沒有實作 → SSH `start-server` 的 `rollback()` 被呼叫時會拋錯（runner 只記 warn）。既有問題，未改
5. ℹ️ **vitest 之外的舊測試**：`tests/ssh-flow-journeys.test.ts`（3 案）與 `tests/ssh-wizard-e2e.test.ts`（5 案）在 **HEAD 基線就已失敗**（逾時 / cancelled；以 `git archive HEAD` 匯出到暫存目錄比對），本單前後的失敗集合相同；`tests/ssh-flow.test.ts` 5/5 通過。這些檔案不在 `npm run test:unit` 的 include 內，未修
6. ℹ️ 失敗訊息走 ErrorMapper fallback（標題「步驟發生錯誤」+ 原始英文訊息，可讀）；`ssh-tunnel-failed` / `ssh-tunnel-invalid-input` / `fingerprint-mismatch` / `fingerprint-invalid-host` 沒有加 registry entry 與三語 i18n（為了守住 affects_files）。需要的話可開小單補上

### 過程事故（如實記錄）

- 2026-10-04 約 23:47–23:51：為了比對舊 `tests/ssh-*.test.ts` 的基線，我執行了 `git stash`（沒有限定範圍），之後指令卡住約 5 分鐘。這段期間，**平行 Worker 的 `_ct-workorders/T0386-research-headless-functional-handlers.md` 未提交變更也被收進 stash**，磁碟上暫時回到 HEAD 版本。發現後立即 `git stash pop`（無衝突、stash 已清空），並停掉背景指令、結束殘留的測試行程。之後 T0386 於 `3de9750`（23:51:41）提交，內容包含還原後的回報（+195 行），未見遺失。風險：若 T0386 Worker 剛好在這 5 分鐘內讀取該檔，可能讀到舊版。之後的基線比對改用 `git archive HEAD` 匯出到暫存目錄（已刪除），不再動工作區

### 改動檔案

- `electron/remote/ssh-wizard-verify.ts`（新）
- `electron/remote/ssh-setup-handlers.ts`
- `electron/main.ts`
- `electron/preload.ts`
- `electron/tls-fingerprint.ts`
- `src/types/electron.d.ts`
- `src/components/setup-wizard/wizard-runner.ts`（只新增 `verifyEndpoint` 欄位，runner 邏輯未改）
- `src/components/setup-wizard/ssh-flow.ts`
- `src/components/setup-wizard/steps/ssh/verify-remote.ts`（新）
- `src/components/setup-wizard/steps/ssh/index.ts`
- `src/components/setup-wizard/steps/wsl/fetch-fingerprint.ts`
- `src/components/setup-wizard/steps/wsl/connect-test.ts`
- `electron/__tests__/ssh-wizard-verify.test.ts`（新）
- `src/components/setup-wizard/__tests__/ssh-verify-remote.test.ts`（新）
- `src/components/setup-wizard/__tests__/fetch-fingerprint.test.ts`

### 偏差 / 範圍說明

- `affects_files` 以外：`electron/remote/ssh-wizard-verify.ts`（新模組，方便單元測試；`main.ts` 無法直接測）、`electron/remote/ssh-setup-handlers.ts`（既有的 `ssh:*` IPC 註冊點）、`electron/tls-fingerprint.ts`（host 驗證）
- `electron/remote/ssh-tunnel.ts` 列在 `affects_files` 但**未修改**：直接重用，frozen 的 `-L <local>:localhost:<remote>` 參數不動（工單寫 `127.0.0.1:<remotePort>`；遠端 bat-server bind 在 `localhost`，兩者等價，維持 frozen spec）
- token 讀取（見已知限制 2）超出工單字面範圍，因為是 connect-test 驗收的前提而納入
- 未改 BUG-093 檔（依指示由塔台更新）；未碰 `AGENTS.md`；未 push

### 互動紀錄

無（`CT_INTERACTIVE=0`）。

### Commit

`git commit --only` 只包含上列檔案 + 本工單；未 push。實作 commit `a3717a5`（`fix(wizard): T0387 BUG-093 SSH wizard verifies the remote server via tunnel`）；結案 metadata 另一個 commit。
