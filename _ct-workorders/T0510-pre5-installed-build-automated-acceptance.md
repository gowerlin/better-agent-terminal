---
schema_version: 1
schema_kind: workorder
id: T0510
title: "pre.5 實機驗收自動化：以已安裝的 v0.6.0-pre.5 exe 起隔離實例，驗 Custom CLI 持久化、detached 關窗 flush、BUG-119 搬移、BUG-114 派發、SSH alias（無 User / ProxyJump）；真環境只做唯讀檢查"
type: implementation
status: PARTIAL
repo: better-agent-terminal
project: D139
priority: P1
sizing: L
created_at: "2026-10-14T01:59:36+0800"
started_at: "2026-10-14T02:01:09+08:00"
updated_at: "2026-10-14T02:35:34+08:00"
completed_at: "2026-10-14T02:35:34+08:00"
target_version: "0.6.0-pre.5（驗收，不發版）"
depends_on:
  - T0509
  - T0493
related:
  - "T0467（PLAN-039 實機驗收自動化：`e2e/real-remote/plan039-real-remote-env.mjs`、Dockerfile、`e2e/fixtures/electron-isolation.ts` 的 `launchIsolated` / `isolatedEnv`，可沿用）"
  - "T0496 回報區 L176（Custom CLI 持久化，`<userData>/custom-clis.json`）"
  - "T0504 / T0508（detached 關窗 flush；e2e `detached-flush-on-close` / `detached-close-edges` / `detached-terminal-persistence` / `detached-workspace`）"
  - "T0480 回報區「需使用者實機驗收」第 1 點（BUG-119 Windows）"
  - "BUG-114「生效條件」（≥ 20 次派發、成對派發、`responseType: invoke-result`）"
  - "T0505 回報區第 7 節（SSH alias 實機 6 項）、T0506（SshDetails 空 user 顯示）"
affects_files:
  - e2e/
  - _ct-workorders/T0510-pre5-installed-build-automated-acceptance.md
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **只寫驗收工具 / opt-in spec，不改產品程式碼**（`electron/**`、`src/**`、`scripts/**`、`package.json` 不動）。發現產品缺陷 → 回報區記證據（步驟、預期 vs 實際、log 片段、截圖路徑），該項 FAIL、整單 PARTIAL，**不自行修**（由塔台開 BUG）。"
  - "🔴 **不碰使用者正在用的 BAT**：不得關閉 / 重啟 / 對它的 RemoteServer（port 9876）發 helper 連線；不得以預設實例（無 runtime / 無隔離 userData）啟動任何 BAT。真實 `%APPDATA%\\BetterAgentTerminal\\` 與 `%APPDATA%\\better-agent-terminal\\` **只讀**（雜湊 / mtime / 讀 log），不得寫入、搬移、刪除。"
  - "🔴 **不得消耗 Claude token**：不開 Claude Agent session、不送 prompt；BUG-114 派發測試用 raw command 或 shell 分頁，不用 `--skill`。"
  - "🔴 **Docker / WSL**：只建立、操作、刪除名稱前綴 `bat-t0510-` 且帶 label `bat.t0510=1` 的容器 / network / volume；不得 `docker system prune`、不得動其他容器（含 T0467 的 `bat-t0467-*`）；不得 `wsl --shutdown` / `--terminate`；不得動 WSL `~/.local/bat-server`；收尾刪除本單容器 / network（image 可保留並列出）。"
  - "🔴 **`~/.ssh/config`（使用者裁決：先隔離、失敗再暫改）**：見「SSH alias 規則」節。真實 `~/.ssh/known_hosts` / `authorized_keys` / 金鑰一律不動。"
  - "🔴 **禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）；寫檔維持 LF；不 push；不跑全套 `npm run test:e2e`（L141），只跑本單 spec 與下列指定的既有 spec。"
---

# T0510 — pre.5 實機驗收自動化（已安裝版）

## 背景

`v0.6.0-pre.5`（@ `7a6fb9c`）已發佈並安裝在本機（`C:\Program Files\BetterAgentTerminal\`，FileVersion `0.6.0-pre.5`）。D139 批次各單的「需實機驗收」項目原定人工做，使用者要求**盡量自動化**。

使用者裁決（2026-10-14 第五十九 session）：

| 項目 | 裁決 |
|---|---|
| 受測 build | **已安裝的 pre.5 exe**（`C:\Program Files\BetterAgentTerminal\BetterAgentTerminal.exe`），以 Playwright `_electron.launch({ executablePath })` 起**隔離實例**。repo 未設定 electron fuses，應可行；若打包版無法被 Playwright 驅動，退回以 `v0.6.0-pre.5` tag 的 source build（`git worktree add` 到 scratch 目錄 + `npx vite build`），回報區註明 |
| SSH config | **先隔離，失敗再暫改**（見下節） |
| 派發模式 | yolo + no-interactive |

## 驗收項目

| # | 項目 | 來源 | 自動化判定 |
|---|---|---|---|
| A1 | Custom CLI 持久化 | T0496 | 隔離實例 Settings → Custom CLI Agents 新增一筆（UI 操作，不直接寫檔）→ 關閉 → 以同 userData 重啟 → 清單仍在；`<隔離 userData>/custom-clis.json` 存在且內容對應 |
| A2 | detached 關窗 flush | T0504 / T0508 | 以**安裝版 exe** 跑既有 `e2e/detached-flush-on-close.spec.ts`、`e2e/detached-close-edges.spec.ts`、`e2e/detached-terminal-persistence.spec.ts`、`e2e/detached-workspace.spec.ts` 全綠。若 fixture 不支援指定 executable，在 `e2e/fixtures/` 加 opt-in env（例 `BAT_E2E_EXECUTABLE`），**未設時行為不變** |
| A3 | BUG-119 搬移（隔離模擬） | T0480 | 以安裝版 exe 跑 `e2e/bug119-userdata-unification.spec.ts`（同 A2 的 executable 切換）；另在隔離環境預置「舊小寫目錄」佈局（Local State / snippets.json / message-archives）後首次啟動，檢查 marker、Local State 複製、snippets 合併、舊目錄保留；Settings 調日誌等級 → 重啟後仍有效 |
| A4 | BUG-119 真環境（唯讀） | T0480 第 1 點 | 真實 `%APPDATA%\BetterAgentTerminal\server-token.json` 與舊目錄同名檔（若存在）SHA-256 比對、mtime 早於 pre.5 首次啟動；`Logs\` 內首次升版日誌有 `[userdata-migration]` 行（貼原文）；舊 `%APPDATA%\better-agent-terminal\` 除 `message-archives/*.jsonl` 外未變（列目錄 + mtime）。**只讀** |
| A5 | BUG-114 派發 | BUG-114 生效條件 | 對**隔離實例**的 RemoteServer（它自己的 port / token，從隔離 userData 讀），用**安裝版** helper `C:\Program Files\BetterAgentTerminal\resources\scripts\bat-terminal.mjs` 派發 ≥ 20 次 raw command 分頁（含 ≥ 5 組兩支同時派發；期間讓另一分頁持續大量輸出以製造 `pty:output` 廣播）。判定：每次 helper exit 0、helper 記錄 `responseType: invoke-result`、隔離實例日誌有對應 `remote-server terminal-created`、分頁實際出現；0 遺失。helper 日誌 env 指向 temp（`BAT_HELPER_LOG_DIR` / `BAT_USER_DATA`），不寫入使用者真實 `bat-scripts.log` |
| A6 | SSH alias 精靈 | T0505 第 7 節 1-3、5、6；T0506 | 在 WSL 內 Docker 起 `bat-t0510-target`（sshd + 金鑰登入；可沿用 T0467 Dockerfile 模式）與 `bat-t0510-jump`（跳板），target 只能經 jump 到達（或以其他方式證明真的走了 ProxyJump，例 target 只接受來自 jump 的連線）。ssh config alias：(1) `HostName` + `User` + `IdentityFile`，無 `Port` 與自訂 `Port` 各一；(2) 經 `ProxyJump`；(3) **無 `User`** 且本機登入名 ≠ 遠端帳號 → `verify-ssh-auth` 以 `permission-denied` 失敗，且可跳回 configure 改手動 `user@host:port` 後成功。每個 alias：隔離實例中以 wizard 完整跑完 → profile 建立 → SshDetails 空 user / 無 port 顯示正確（T0506，截圖）→ 關閉重開後連線成功。(5) 只驗 **Windows 內建 OpenSSH**（`C:\Windows\System32\OpenSSH\ssh.exe`），mac / Linux 標 N/A。(6) 既有手動 `user@host:port` profile 連線不受影響（可用 T0467 的 `plan039-real-remote` 環境回歸，或本單容器手動 profile）。T0505 第 4 項（`loginctl enable-linger`）容器無 systemd 時標 N/A 並說明 |

## SSH alias 規則（使用者裁決：先隔離、失敗再暫改）

1. **先試隔離**：隔離實例啟動時把 `USERPROFILE` / `HOME` 指向本單 temp 目錄，在其 `.ssh\config` 放 alias。確認兩件事：BAT 的 `listSshHosts` 列得出 alias，且 **Windows 內建 `ssh.exe` 實際讀的是該 config**（例：`ssh -G <alias>` 在同 env 下輸出的 hostname / port / proxyjump 符合）。兩者都成立才算隔離成功。
2. **隔離不成立才暫改真實 `~/.ssh/config`**：
   - 先把原檔複製到本單 temp 目錄並記錄 SHA-256（原檔不存在則記錄「不存在」）
   - 只在檔尾附加一段，前後以 `# >>> bat-t0510 temporary (remove) >>>` / `# <<< bat-t0510 temporary <<<` 標記；alias 名稱前綴 `bat-t0510-`
   - alias 區塊內一律指定 `IdentityFile`、`UserKnownHostsFile`（皆指向本單 temp 目錄）與 `StrictHostKeyChecking accept-new`，**不寫入真實 known_hosts**
   - 收尾（含失敗 / 中斷路徑，用 try/finally）還原原檔，驗證 SHA-256 與備份相同（原本不存在則刪除）；回報區附還原前後雜湊
   - 回報區寫出手動還原指令，以防工具中斷
3. 不論哪條路徑，BAT 隔離實例的 SSH profile 只指向本單容器。

## 產出

- `e2e/` 下 opt-in spec 與環境腳本（例 `e2e/pre5-acceptance.spec.ts`、`e2e/real-remote/t0510-ssh-alias-env.mjs`）：**預設 skip**，僅在 env（例 `BAT_E2E_PRE5_ACCEPTANCE=1` + 必要連線參數）齊全時執行；一般 `npm run test:e2e` / CI 不受影響
- 環境腳本 `up` / `down`，一行可重跑
- 回報區：每項 PASS / FAIL / N/A + 證據（log 原文行、截圖路徑、雜湊、耗時）

## 驗收條件

- [ ] A1-A6 全部有判定與證據；全 PASS（N/A 有理由）寫 `DONE`，否則 `PARTIAL`
- [ ] 新 spec env 未設時 0 failed（skip）；fixture 改動未設 env 時行為不變（跑一次 `e2e/smoke.spec.ts` 回歸）
- [ ] 收尾：`docker ps -a --filter label=bat.t0510=1` 為空；若曾暫改 `~/.ssh/config`，還原後雜湊與備份一致
- [ ] 未改 `electron/**` / `src/**` / `scripts/**`；未碰使用者 BAT 實例與真實 userData（只讀）
- [ ] 回報區列出**仍需真人**的項目：真實 OS 拖放 / 圖片附件（BUG-107 / 108）、視覺 / UX，以及任何本單判定為無法自動化者

## Sub-session 執行指示

1. 讀本工單、T0467 回報區與 `e2e/real-remote/`、`e2e/fixtures/electron-isolation.ts`、上表各來源段落
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 先做可行性探測：Playwright 能否啟動安裝版 exe（隔離 userData / `--runtime=<N>` 不撞使用者實例的 single-instance lock 與 port 9876）、WSL docker 可用、SSH 隔離是否成立。阻塞 → 回報區說明，`BLOCKED`，不違反 memory_overrides 硬改
4. 實作 → 實跑 → 填回報區
5. commit 本單改動檔 + 本工單；不 push；依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫

### 結果摘要

**PARTIAL**。A1-A5 全 PASS；A6 的 alias 行為（T0505 §7 1-3、5、6、T0506）在測試側 workaround 下全 PASS，但 **A6-0「stock SSH wizard 在乾淨 Linux 目標上跑完」FAIL**：pre.5 的 SSH wizard 在 `start-server` 步驟一定失敗，背後是**兩個產品缺陷**（見「發現的產品缺陷」）。依 memory_overrides 不修，只記證據，請塔台開 BUG。

| # | 項目 | 判定 | 主要證據 |
|---|---|---|---|
| A1 | Custom CLI 持久化 | **PASS** | Settings UI 新增 → `custom-clis.json` = `[{"id":"t0510-echo-57447-cli","name":"T0510 Echo 57447","icon":"▸","color":"#888888","command":"echo"}]` → 同 userData 重啟後 `listCustomClis()` 與 Settings 清單都有 |
| A2 | detached 關窗 flush | **PASS** | 安裝版 exe 跑 4 支既有 spec：5 passed（`detached-close-edges` ×2、`detached-flush-on-close`、`detached-terminal-persistence`、`detached-workspace`） |
| A3 | BUG-119 搬移（隔離） | **PASS**（預設實例路徑見下） | `bug119-userdata-unification.spec.ts` 安裝版 2 passed；A3x：舊 runtime 目錄（Local State / settings / snippets / message-archives）首次啟動改名、marker `runtime-dir: renamed`、Settings UI 調 `log → error` 重啟後仍為 `error`，且新日誌 0 行低於 error |
| A4 | BUG-119 真環境（唯讀） | **PASS**（token 判定方式偏離，見下） | `[userdata-migration] Local State: copied` 等 7 行原文；兩目錄 `Local State` SHA-256 相同；舊目錄 24 個 entry 無一晚於 marker |
| A5 | BUG-114 派發 | **PASS** | 22 次（10 單發 + 6 組成對），全部 exit 0、`responseType: invoke-result`、helper 等待期間略過 26 個廣播 frame；實例 22 筆 `remote-server terminal-created result:true`、renderer 22 筆 `[T0130] External terminal added`、workspace entry 22/22；0 遺失 |
| A6 | SSH alias 精靈 | **FAIL**（A6-0）／alias 行為 PASS（workaround 下） | 見 A6 節 |

### Landing zone

- **PASS**。C-0：frontmatter `repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal`（REPO_ROOT `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）。C-1 PASS。C-3：`e2e/` 存在（informational）。C-2：無 `branch` 欄位，HEAD `main`。
- `BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）；`CT_MODE=yolo`、`CT_INTERACTIVE=0`。
- frontmatter 原為 `status: TODO`，視為未開工，改 `IN_PROGRESS`。

### 可行性探測（Sub-session 指示第 3 步）

| 探測 | 結果 |
|---|---|
| Playwright 驅動安裝版 exe | **可行**。fuses：`RunAsNode` / `EnableNodeCliInspectArguments` / `EnableNodeOptionsEnvironmentVariable` 皆 Enabled。陷阱：Playwright 在 Windows 透過 shell 啟動，`executablePath` 用反斜線會被吃掉（`'"C:Program FilesBetterAgentTerminalBetterAgentTerminal.exe"' 不是內部或外部命令`），改正斜線即可。未退回 source build |
| 隔離（single-instance lock / port） | `--runtime=e2e-…` → userData `BetterAgentTerminal-runtime-e2e-…`，RemoteServer 用 `BAT_REMOTE_PORT`=空閒埠；從未連 9876。Terminal Server 的命令列與使用者實例相同（`…\resources\app.asar\dist-electron\terminal-server.js`），teardown 只殺隔離 userData pid 檔裡的 pid |
| `APPDATA` 重導 appData | **不可行**：`app.getPath('appData')` 不讀 `APPDATA` 環境變數（實測仍為真實 Roaming）。因此 BUG-119 **預設實例**路徑（複製 Local State、合併 snippets、移動 message-archives、保留舊目錄）無法在隔離下以安裝版重現——需不帶 runtime 啟動，違反 memory_overrides。改以 A4 真環境唯讀證據 + runtime 路徑（A3x）涵蓋 |
| WSL Docker | `Ubuntu-24.04` Docker 29.1.3；systemd 容器（`--privileged --cgroupns=private --tmpfs /run`）可跑 logind / linger / `systemctl --user` |
| SSH 隔離 | **不成立**：Windows OpenSSH 9.5p2 的 `ssh -G` 在 `USERPROFILE` / `HOME` 指向 temp 時仍輸出 `user gower`、未套用 temp config（以帳號 profile 解析 `~`）。依裁決改走「暫改真實 `~/.ssh/config`」（見下） |

探測期間曾有一次 15 s timeout 直接殺掉探測用 exe，留下孤兒 Terminal Server pid 46000（父 pid 32832 已死、pid 出自探測 runtime 的 pid 檔，非使用者實例 12424 的子程序），已 `taskkill /T /F` 並刪除探測 userData。

### 改動檔案

```
 _ct-workorders/T0510-…md                   | 回報區 + metadata
 e2e/fixtures/electron-isolation.ts          | 22 ++++++++++++++++------   （opt-in BAT_E2E_EXECUTABLE）
 e2e/pre5-acceptance.spec.ts                 | 425 新增（A1 / A3x / A4 / A5，BAT_E2E_PRE5_ACCEPTANCE=1）
 e2e/pre5-ssh-alias.spec.ts                  | 480 新增（A6，BAT_E2E_PRE5_SSH=1 + env up）
 e2e/real-remote/t0510-ssh-alias-env.mjs     | 373 新增（up / status / apply-ssh-config / restore-ssh-config / down [--rmi]）
 e2e/real-remote/t0510-sshd.Dockerfile       |  43 新增（debian bookworm + systemd + sshd + polkitd）
```

未改 `electron/**` / `src/**` / `scripts/**` / `package.json`。fixture：`BAT_E2E_EXECUTABLE` 未設時 `electron.launch({ args: [REPO_ROOT, --runtime] })` 與 `TERMINAL_SERVER_SCRIPT` 與原本相同；設了才改用 `executablePath`（正斜線）與 `resources/app.asar/dist-electron/terminal-server.js`。

### 執行方式

```powershell
# A1-A5（約 11 s）
$env:BAT_E2E_PRE5_ACCEPTANCE='1'; $env:BAT_E2E_EXECUTABLE='C:\Program Files\BetterAgentTerminal\BetterAgentTerminal.exe'
npx playwright test e2e/pre5-acceptance.spec.ts
# A2 / A3（25 s）
npx playwright test e2e/detached-flush-on-close.spec.ts e2e/detached-close-edges.spec.ts e2e/detached-terminal-persistence.spec.ts e2e/detached-workspace.spec.ts e2e/bug119-userdata-unification.spec.ts
# A6（up 約 16 s、spec 約 1.5 min）
node e2e/real-remote/t0510-ssh-alias-env.mjs up
$env:BAT_E2E_PRE5_SSH='1'; npx playwright test e2e/pre5-ssh-alias.spec.ts
node e2e/real-remote/t0510-ssh-alias-env.mjs down      # --rmi 連 image 一起刪
```

證據檔（截圖、A5 兩份 bat-scripts.log）：`%TEMP%\bat-t0510\evidence\`（可用 `BAT_E2E_PRE5_EVIDENCE_DIR` 改）；完整執行輸出：`%TEMP%\bat-t0510\{a2-a3-installed,pre5-final,a6-run2,regression}.log`。

### A1 Custom CLI（PASS，2.5 s）

- UI：側欄「設定」→ General → Custom CLI Agents →「+ Add Custom CLI」→ Name / Command → Add（未直接寫檔）
- Add 後 `custom-clis.json`：`[{"id":"t0510-echo-57447-cli","name":"T0510 Echo 57447","icon":"▸","color":"#888888","command":"echo"}]`
- 關閉（`keepUserData`）→ 同 runtime 重啟 → `listCustomClis()` 同上；Settings 清單可見
- 截圖：`a1-after-add.png`、`a1-after-restart.png`

### A2 detached 關窗 flush（PASS）

安裝版 exe（每行 log 皆帶 `executable=C:\Program Files\BetterAgentTerminal\BetterAgentTerminal.exe`）：

```
ok 3 detached-close-edges.spec.ts:99   › a detached window closed while the quit dialog is open keeps its rename when the quit is cancelled (1.6s)
ok 4 detached-close-edges.spec.ts:151  › detaching the workspace again while its window still flushes opens a new window after the old one closed (2.7s)
ok 5 detached-flush-on-close.spec.ts:46 › a rename in a detached window reaches the parent entry when the window is closed right away (2.5s)
ok 6 detached-terminal-persistence.spec.ts:50 › terminals opened / closed in a detached window reach the parent entry and survive reattach + restart (2.6s)
ok 7 detached-workspace.spec.ts:41     › detached workspace window loads the parent entry, writes back only its terminals, and reattaches (3.5s)
```

所有 runtime userData 已刪、Terminal Server 皆 `alive after teardown: false`。

### A3 BUG-119 搬移（隔離）（PASS）

- `bug119-userdata-unification.spec.ts`（安裝版）：`fresh runtime …`（10.8 s）、`legacy runtime directory is renamed; settings and snippets survive`（0.8 s）皆 ok
- A3x（`pre5-acceptance.spec.ts`，2.6 s）：預置 `better-agent-terminal-runtime-<id>`（`Local State` / `settings.json` logLevel=log / `snippets.json` / `message-archives/t0510-session.jsonl`）→ 首次啟動：
  - marker `{"v":1,"from":"…\\better-agent-terminal-runtime-e2e-t0510-a3-1791916359912","at":"2026-10-13T18:32:40.068Z","items":{"runtime-dir":"renamed"}}`
  - 日誌原文：`[LOG] [userdata-migration] runtime-dir: renamed — …\better-agent-terminal-runtime-e2e-t0510-a3-1791916359912 -> …\BetterAgentTerminal-runtime-e2e-t0510-a3-1791916359912`
  - 舊目錄消失；新目錄 Local State 帶 seed key、archive 原文相同、`snippet.getAll()` 含 `[5,'t0510-seeded-snippet']`、`getLoggingInfo().logLevel = 'log'`
  - Settings → Advanced → Debug Logging 以 UI 改 `error` → `settings.json` 即寫入 → 重啟後 `logLevel: 'error'`、下拉值 `error`；重啟後 0 行低於 error（level=error 時日誌檔延遲建立，沒有 error 級內容時檔案不存在：`currentLogFilePath … exists=false`，屬設計）
- **未涵蓋**：預設實例路徑（Local State 複製、snippets 合併、archives 移動、舊目錄保留）無法隔離（見可行性探測）；由單元測試 + A4 真環境證據涵蓋，且本機真環境 snippets / message-archives 皆 `no-legacy`，合併與移動在真環境也沒有被執行到

### A4 BUG-119 真環境（唯讀）（PASS；token 判定方式偏離）

- marker：`{"v":1,"from":"C:\\Users\\Gower\\AppData\\Roaming\\better-agent-terminal","at":"2026-10-13T17:54:44.547Z","items":{"Local State":"copied","snippets.json":"no-legacy","message-archives":"no-legacy","Logs":"not-moved","Crashes":"not-moved"}}`
- `Logs\debug-20261014-015444.log`（pre.5 首次啟動）原文：
  ```
  [2026-10-13T17:54:45.078Z] [LOG] [userdata-migration] userData=C:\Users\Gower\AppData\Roaming\BetterAgentTerminal (legacy C:\Users\Gower\AppData\Roaming\better-agent-terminal)
  [2026-10-13T17:54:45.078Z] [LOG] [userdata-migration] Local State: copied
  [2026-10-13T17:54:45.078Z] [LOG] [userdata-migration] snippets.json: no-legacy
  [2026-10-13T17:54:45.078Z] [LOG] [userdata-migration] message-archives: no-legacy
  [2026-10-13T17:54:45.078Z] [LOG] [userdata-migration] Logs: not-moved — legacy logs remain at C:\Users\Gower\AppData\Roaming\better-agent-terminal\Logs
  [2026-10-13T17:54:45.078Z] [LOG] [userdata-migration] Crashes: not-moved — legacy crashes remain at C:\Users\Gower\AppData\Roaming\better-agent-terminal\Crashes
  [2026-10-13T17:54:45.079Z] [LOG] [userdata-migration] marker: written
  ```
- 雜湊 / mtime：

  | 檔案 | `BetterAgentTerminal\` | `better-agent-terminal\` |
  |---|---|---|
  | `server-token.json` | sha256 `1b713c27…bf551`，mtime 2026-10-13T17:54:45.458Z | 不存在 |
  | `server-cert.json` | sha256 `1c5499b9…57111`，mtime 2026-05-26T12:57:55Z | 不存在 |
  | `Local State` | sha256 `2e35419e…d7dbc`，mtime 2026-05-26T12:58:04Z | **相同** sha256 / mtime |

- **偏離**：工單要求「`server-token.json` mtime 早於 pre.5 首次啟動」不成立且**不能作為判準**：RemoteServer 每次啟動都重新寫入 token（`electron/remote/remote-server.ts:849` `persistToken(this.token)`），safeStorage（DPAPI）密文每次不同，雜湊與 mtime 都必然改變；舊目錄也沒有同名檔可比。改用的證據鏈：safeStorage 金鑰在 `Local State`，兩目錄 `Local State` 位元相同（且 mtime 仍為 05-26，未被改寫）⇒ pre.5 用與舊版相同的金鑰解密舊 token；`server-cert.json` 早於升版（遠端 client 釘的指紋 `61:E3:BA:4E:55:F3:12:F0…` 升版前後相同，pre.4 日誌 `debug-20261013-144906.log:16` 與 pre.5 日誌 `:26`）；pre.5 日誌 0 筆 auth 失敗。**直接證明 token 明文未變做不到**（舊密文已被覆寫、解密失敗時 `readSecretFile` 靜默回 null 再產新 token，不留日誌）→ 列入「仍需真人」
- 舊目錄：`Crashes/`（05-26）、`Local State`（05-26）、`Logs/`（2026-10-13T06:49:06Z，pre.4 最後一個日誌）；遞迴 24 個 entry，**0 個晚於 marker**；無 `message-archives/`
- 全程只讀（`readFileSync` / `statSync` / sha256），未寫入、搬移、刪除

### A5 BUG-114 派發（PASS，5.5 s）

- 對象：隔離實例 RemoteServer（`port=58154`，token 以 `app.evaluate` 的 `safeStorage.decryptString` 從隔離 userData 解出；cert 以 `BAT_SERVER_CERT_PATH` 指向隔離 userData）
- helper：**安裝版** `C:\Program Files\BetterAgentTerminal\resources\scripts\bat-terminal.mjs`，raw command（`echo t0510-a5-<n>`，channel `terminal:create-with-command`，無 `--skill`、無 Claude）；`BAT_HELPER_LOG_DIR` / `BAT_USER_DATA` → temp；未讀寫使用者 `bat-scripts.log`
- 負載：另一個 PowerShell PTY 每 15 ms 輸出 40 行 × 120 字；派發結束時已收到 363,512 字的 `pty:output`
- 結果：22 次（10 單發 + 6 組成對同時派發）全部 exit 0（61–89 ms）、id 全相異
  - helper 日誌：`terminal-created 22, results ["ok"], responseTypes ["invoke-result"], broadcast frames ignored while waiting 26`（廣播確實插在回應之前，helper 正確以 frame id 略過）
  - 實例 `Logs\bat-scripts.log`：22 筆，例 `{"ts":"2026-10-13T18:32:46.393Z","script":"remote-server","event":"terminal-created","pid":1840,"channel":"terminal:create-with-command","terminalId":"1ee24d6bbf465c3f2e4da960862ce581","reusedExisting":false,"result":true,"customEnv":{},"windowId":null}`
  - renderer：22 筆 `External terminal added: id=<id>`；workspace entry 22/22 落在 `e2e-t0510-a5-ws`
- 證據：`a5-helper-bat-scripts.log`、`a5-instance-bat-scripts.log`、`a5-after-dispatch.png`

### A6 SSH alias 精靈

**拓撲**（WSL Docker，全部 `bat-t0510-*` + label `bat.t0510=1`）：`bat-t0510-jump`（published `127.0.0.1:22` 與 `127.0.0.1:22510`，同時當 ProxyJump 跳板）、`bat-t0510-target`（只在 `bat-t0510-net`，Windows 無路由也無法解析名稱）。ssh：隔離實例 `Path` 前置 `C:\Windows\System32\OpenSSH`（使用者環境 PATH 中 Git 的 ssh 排在前面）。

**`~/.ssh/config`（暫改，依裁決）**：
- 原檔 sha256 `00aab1cda8667c85db60b35f406a785bd9a909b87df7cf49aa78450ca03c58a2`；附加區塊後 `aaa6d901424e27ce81e46caf0fb7527c699a0bd039f2b6d34480ba14d4a76c54`；**每次還原後皆 `00aab1cd…c58a2`，match=true**（最後一次 down 後再驗一次相同）
- 區塊以 `# >>> bat-t0510 temporary (remove) >>>` / `# <<< bat-t0510 temporary <<<` 包住；alias `bat-t0510-direct` / `-port` / `-jumphost` / `-viajump` / `-nouser`，每個都指定本單 temp 的 `IdentityFile`、`UserKnownHostsFile`、`StrictHostKeyChecking accept-new`；另加 `Match originalhost 127.0.0.1 user bat`（只給手動 `bat@127.0.0.1:<port>` 用同一把 key 與 known_hosts）
- 由 spec 的 `beforeAll` / `afterAll` 呼叫 `apply-ssh-config` / `restore-ssh-config`；`down` 也會先還原（安全網）；若期間檔案被他人修改，只剪掉標記區塊
- 手動還原：`Copy-Item "$env:TEMP\bat-t0510\ssh-config-backup\config" "$env:USERPROFILE\.ssh\config" -Force`（或刪除兩個標記之間的行）
- 真實 `known_hosts`（sha256 `e043aac8…059063`，mtime 2026-09-03 03:54:59）、金鑰皆未動
- `ssh -G`（無 `-F`，真實 config）：`bat-t0510-direct: user bat, hostname 127.0.0.1, port 22`；`-port: … port 22510`；`-viajump: user bat, hostname bat-t0510-target, port 22, proxyjump bat-t0510-jumphost`；`-nouser: user gower, hostname 127.0.0.1, port 22510`

| 子項 | 判定 | 證據 |
|---|---|---|
| A6-0 stock install（乾淨目標，`bat-t0510-direct`） | **FAIL** | `start-server`：`verify-failed: Service appears to have started but verification did not see a listening socket … Server reported: verify-failed: activating`；容器內 `ls ~/.local/bat-server` → `staging`；unit `ExecStart=/home/bat/.local/bat-server/bin/bat-server`；`Active: activating (auto-restart) … status=203/EXEC`。截圖 `a6-0-stock-failed.png` |
| T0505 §7 #1（無 Port） | PASS（workaround） | wizard 14.0 s 完成；profile `ssh-bat-t0510-direct`：`sshHost: "bat-t0510-direct"`、`sshUser: ""`、無 `sshPort`；SshDetails Host = `bat-t0510-direct (使用者與連接埠由 ~/.ssh/config 決定)` |
| T0505 §7 #1（自訂 Port） | PASS（workaround） | 14.3 s；`sshHost: "bat-t0510-port"`、`sshUser: ""`、無 `sshPort`（port 來自 config 22510）；SshDetails 同上格式 |
| T0505 §7 #2（ProxyJump） | PASS（workaround） | 16.4 s；target sshd 10 筆 `Accepted publickey for bat from 172.18.0.3`（= jump 的 IP），全部來自 jump；重啟後 remote shell 回 `T0510-bat@bat-t0510-target-25` |
| T0505 §7 #3（無 User） | PASS | Windows 登入名 `Gower` ≠ `bat`；`verify-ssh-auth` 失敗訊息 `permission-denied: SSH server rejected our key. …`（`a6-4-permission-denied.png`）→ 失敗步驟的「編輯設定」跳回 `configure-ssh-host` →「手動輸入主機…」→ `bat@127.0.0.1:22510` → 完成；profile `ssh-127-0-0-1`：`sshHost "127.0.0.1"`、`sshUser "bat"`、`sshPort 22510`；SshDetails = `bat@127.0.0.1:22510`（無提示）|
| T0505 §7 #4（linger / teardown） | PASS（加做；systemd 為真） | `loginctl show-user bat` → `Linger=yes`；重啟、ssh session 斷開後 jump / target 的 `bat-server` 仍 `active`；A6-0 關閉失敗的 wizard 後 rollback：`bundle: ls: cannot access '/home/bat/.local/bat-server'`、`unit: … No such file`，linger 保留（設計如此） |
| T0505 §7 #5（Windows 內建 OpenSSH） | PASS；mac / Linux **N/A** | 重啟後四個 tunnel 的 ssh 皆 `C:\Windows\System32\OpenSSH\ssh.exe`，例 `ssh -o BatchMode=yes … -N -L 59625:localhost:9876 … -- bat-t0510-direct`、手動者 `… -p 22510 … -- bat@127.0.0.1` |
| T0505 §7 #6（手動 user@host:port profile 不受影響） | PASS | 上述手動 profile 重啟後 326 ms 連上，remote shell `T0510-bat@bat-t0510-jump-25` |
| T0506 SshDetails 顯示 | PASS | 見 #1 / #3；截圖 `a6-{1,2,3,4}-sshdetails.png` |
| 重啟後連線（A6-5） | PASS | direct 314 ms / port 345 ms / viaJump 316 ms / typed 326 ms 連上，各自 remote shell 回應正確主機；截圖 `a6-5-*-connected.png` |

**workaround（測試側，僅容器內，非產品修改）**：A6-0 失敗時（`a6-0-stock-result.json`），A6-1..4 每次 wizard 前在目標容器做：`~/.local/bat-server/{bin,electron,node_modules,scripts,package.json,README.md} → staging/*` symlink，以及 `~/.config/systemd/user/bat-server.service.d/t0510-port.conf`（`Environment=BAT_SERVER_PORT=9876`）。A6-0 一旦通過自動停用；`BAT_E2E_PRE5_SSH_WORKAROUND=0` 可強制停用。

### 發現的產品缺陷（請塔台開 BUG，未修）

1. **SSH wizard 上傳的 bundle 多一層 `staging/`** — `electron/remote/ssh-bundle-uploader.ts:47` 遠端指令為 `mkdir -p '<installPath>' && cd '<installPath>' && tar xz`（無 `--strip-components=1`）；tarball 由 `scripts/build-server-bundle.mjs:430` `tar -czf <bundle> staging` 產生，頂層為 `staging/`。結果 `~/.local/bat-server/staging/bin/bat-server`，而 unit `ExecStart=<installPath>/bin/bat-server` → `status=203/EXEC`。WSL 路徑（`electron/wsl-detect.ts:338`）有 `--strip-components=1`。影響 ssh-linux 與 ssh-darwin（plist 同樣是 `<installPath>/bin/bat-server`）。
2. **SSH systemd unit / launchd plist 傳錯環境變數名** — `electron/remote/ssh-start-server.ts:190-191`（unit）與 plist 段落寫 `BAT_REMOTE_BIND` / `BAT_REMOTE_PORT`，但 `scripts/bat-server.mjs:67` 只讀 `--port` / `BAT_SERVER_PORT`（預設 `54321`）、bind 只讀 `--bind-interface`。實測（缺陷 1 繞過後）：`[bat-server] listening on 127.0.0.1:54321`，wizard verify `ss -tnlp | grep ':9876' || pgrep -x bat-server` 失敗（`verify-failed: active`）；`pgrep -x bat-server` 這個 fallback 也比對不到（行程名為 node 的 `MainThread`）。
   - 合併影響：**pre.5 的 SSH wizard 在 Linux 目標上無法完成**（D139 的 T0505 / T0506 改動本身運作正確，但前置的安裝 / 啟動步驟擋住整條流程）。

### 其他觀察（非缺陷判定，供塔台參考）

- A6-4 的 permission-denied：mapped error 面板有顯示，但失敗步驟的按鈕是通用的「重試 / 跳過 / 編輯設定 / 取消」，不是 `error-mapper.ts` `ssh-permission-denied` 條目宣告的「修改 SSH 設定」（`wizard.action.editSshSettings`）。功能上「編輯設定」一樣跳回 configure-ssh-host。
- 完成頁「遠端 AI 工具」面板把 WSL Docker 內的 SSH 容器標成 `debian 12 · x86_64 WSL`（容器跑在 WSL2 kernel 上，環境偵測依 kernel 判斷）。真實 SSH 主機不會遇到，僅記錄。
- 日誌等級 `error` 且無 error 事件時，`Logs\` 不會產生新的 `debug-*.log`（延遲建檔）。

### 驗收條件對照

- [x] A1-A6 皆有判定與證據；A6 有 FAIL → **PARTIAL**
- [x] 未設 env：`npx playwright test e2e/smoke.spec.ts e2e/pre5-acceptance.spec.ts e2e/pre5-ssh-alias.spec.ts` → `1 passed, 6 skipped`，0 failed；smoke 走 source build（log 無 `executable=`；先 `npx vite build` exit 0）
- [x] 收尾：`docker ps -a --filter label=bat.t0510=1` 空；network / volume 空；image `bat-t0510-sshd:local`（9c6ca6ea7933，184MB）保留供重跑；`~/.ssh/config` 還原後 sha256 與備份一致（`00aab1cd…c58a2`）；未動 `bat-t0467-*` 與其他容器 / image
- [x] 未改 `electron/**` / `src/**` / `scripts/**` / `package.json`；未關閉 / 重啟使用者 BAT（pid 12424，StartTime 01:54:44 不變）、未連 9876、未以預設實例啟動；真實 userData 只讀；未開 Claude session
- [x] 仍需真人項目列於下節

### 仍需真人

1. 真實 OS 拖放 / 圖片附件（BUG-107 / BUG-108）；視覺 / UX 感受
2. A4：`server-token` **明文**升版前後相同無法自動證明（只有間接證據）——可由既有遠端 client（手機 / 其他機器）不重新配對即可連線來確認
3. BUG-119 預設實例的 snippets 合併 / message-archives 移動：本機真環境兩者皆 `no-legacy`，安裝版也無法隔離重現；mac safeStorage / Linux libsecret（T0480 #2 / #3）
4. T0505 §7 #5 的 macOS / Linux OpenSSH（本單 N/A）；真實使用者 SSH 主機（非容器）上的 alias wizard
5. 缺陷 1 / 2 修好後重跑 `e2e/pre5-ssh-alias.spec.ts`（A6-0 應轉綠、workaround 自動停用）

### 偏差

- A4 token 判定改用 Local State 等價 + cert 不變 + 0 auth 失敗（理由見 A4）
- A3「預置舊小寫目錄」改在 runtime 實例上做（預設實例需不帶 runtime 啟動，違反 memory_overrides）
- A6 在產品缺陷下以測試側 workaround 驗證其餘項目；A6-0 保留為 FAIL
- 加做 T0505 §7 #4（容器有真 systemd，不需標 N/A）

### Commit

- `git commit --only` 本單 6 個檔案；不 push。hash 見 `git log`（本回報寫於 commit 前）。
