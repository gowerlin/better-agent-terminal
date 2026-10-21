---
schema_version: 1
schema_kind: workorder
id: T0515
title: "pre.6 已安裝版自動化實機驗收（設定精靈線）：SSH 精靈 BUG-120 / 121 / 088 / 093 / 098 / 100、取消與 rollback BUG-099 / 111、Docker BUG-097"
type: implementation
status: DONE
repo: better-agent-terminal
project: BUG-verify-pre6
priority: P1
sizing: L
created_at: "2026-10-14T03:42:23+0800"
started_at: "2026-10-14T03:44:04+0800"
updated_at: "2026-10-14T04:00:18+0800"
completed_at: "2026-10-14T04:00:18+0800"
target_version: "0.6.0-pre.6（驗收，不發版）"
related:
  - "T0510 A6（SSH 精靈真流程，`e2e/pre5-ssh-alias.spec.ts`、`e2e/real-remote/t0510-ssh-alias-env.mjs`、`t0510-sshd.Dockerfile`；SSH config 標記區塊 + 備份 / 雜湊還原做法）"
  - "T0511（BUG-120 / 121 修正，回報區含 `e2e/pre5-ssh-alias.spec.ts` 實機驗證方式）"
  - "並行：T0514（UI 線）、T0516（建置產物線）"
affects_files:
  - e2e/pre6-wizard-acceptance.spec.ts
  - e2e/real-remote/
  - e2e/fixtures/
  - _ct-workorders/T0515-pre6-setup-wizard-acceptance.md
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **只寫驗收工具 / opt-in spec，不改產品程式碼**（`electron/**`、`src/**`、`scripts/**`、`package.json` 不動）。發現產品缺陷 → 回報區記證據，該項 FAIL、整單 PARTIAL，**不自行修**。BUG 檔與 `_bug-tracker.md` 不動。"
  - "🔴 **受測 build = 已安裝的 pre.6**：`C:/Program Files/BetterAgentTerminal/BetterAgentTerminal.exe`（FileVersion `0.6.0-pre.6`），Playwright 隔離實例（獨立 `--runtime` / userData）。精靈的 server bundle 來源用 pre.6 安裝檔內建 baseline 或 `server-bundle-v0.6.0-pre.6` release（回報區註明實際來源）。"
  - "🔴 **不碰使用者正在用的 BAT**（port 9876、真實 userData 只讀）；不得連線、停止或改動 WSL 內使用者的 bat-server（port 9877、`~/.local/bat-server`）。不得對 Ubuntu-24.04 發行版跑 WSL 精靈的安裝步驟。"
  - "🔴 **不得消耗 Claude token**。"
  - "🔴 **Docker / WSL**：只建立、操作、刪除名稱前綴 `bat-t0515-` 且帶 label `bat.t0515=1` 的容器 / network / volume；不得 `docker system prune`、不得動其他容器（含 `bat-t0467-*` / `bat-t0510-*` / `bat-t0514-*`）；不得 `wsl --shutdown` / `--terminate`；收尾刪除本單容器 / network（image 可保留並列出）。"
  - "🔴 **`~/.ssh/config`**：沿用 T0510 做法（Windows OpenSSH 不吃隔離 HOME → 加標記區塊，事前備份 + 雜湊，收尾還原並以雜湊證明一致）。真實 `known_hosts` / `authorized_keys` / 金鑰不動（測試金鑰放 scratch）。"
  - "🔴 與 T0514 / T0516 並行：本單只新增上列 affects_files；共用 fixture 若要改，改成**新增**函式，不改既有簽章。"
  - "🔴 **禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）；寫檔 LF；不 push；不跑全套 `npm run test:e2e`（L141）。commit 用精準 `git add` 或 `git commit --only`。"
---

# T0515 — pre.6 已安裝版自動化實機驗收（設定精靈線）

## 背景

使用者要求把「已修復待實機驗收」的 BUG 盡量自動化（2026-10-14 第六十 session）。本單是三條並行線之一：**WSL 以外的設定精靈真流程**。SSH 目標用容器化 sshd（沿用 T0510 / T0511），在已安裝 pre.6 exe 的隔離實例上把精靈從頭跑到底，再驗產物（遠端安裝目錄、systemd unit、監聽埠、pin 的指紋）。

每項請先讀對應 BUG 檔與修正工單回報區的「需實機驗收」段，依那裡寫的情境設計步驟。

## 驗收項目

| # | BUG | 驗收重點（以 BUG 檔為準） |
|---|---|---|
| W1 | BUG-120 | 精靈上傳 bundle 後落在 `<installPath>/bin/bat-server`（無 `staging/` 子目錄） |
| W2 | BUG-121 | 服務以 `--port <serverPort> --bind-interface localhost` 啟動、在該埠 LISTEN；verify 步驟通過 |
| W3 | BUG-088 | systemd unit 不含字面 `~`，服務可啟動 |
| W4 | BUG-093 | 驗證階段經 SSH tunnel 取得指紋：pin 進 profile 的指紋 = 容器內 bat-server 的指紋（不是本機 9876 的） |
| W5 | BUG-098 | 精靈不再提供 direct 模式（或 direct 路徑已移除）；tunnel 模式完整可用 |
| W6 | BUG-100 | `ssh.stopServer` / `ssh.uninstallBundle` 實際生效（服務停止、安裝目錄移除） |
| W7 | BUG-099 | 精靈在某步驟失敗後按取消 → 該失敗步驟也被 rollback |
| W8 | BUG-111 | rollback 不刪 / 不停使用者自己的資源（先建一個 `bat-t0515-user-owned` 容器或目錄當「使用者既有資源」，rollback 後仍在） |
| W9 | BUG-097 | Docker 精靈：遠端埠只綁 localhost（非全介面）、容器內 bind 可達、HEALTHCHECK 有效。若本機 Docker 環境無法讓精靈跑完（Windows `docker.exe` 指向哪個 daemon 請先確認），標 NEEDS-HUMAN 並說明卡點 |
| W10 | （連帶）SSH alias | 無 `User`、含 `ProxyJump` 的 alias 走完精靈（T0505 / T0506 實機 6 項，T0510 A6 未完成的部分） |

每項標 PASS / FAIL / NEEDS-HUMAN，附證據（遠端指令輸出、unit 檔內容、`ss` / `/proc/net/tcp` 監聽、指紋比對、截圖）。

## 驗證

- 新增 opt-in spec `e2e/pre6-wizard-acceptance.spec.ts`（環境變數 gate，例如 `BAT_E2E_PRE6_WIZARD=1`，預設 skip）；可重用 / 擴充 `e2e/real-remote/` 下的環境腳本（新增檔案，不改 T0510 既有腳本行為）
- 回報區附執行指令與結果
- 收尾：本單容器 / network 已刪、`~/.ssh/config` 雜湊與事前一致、隔離 userData 已刪

## 驗收條件

- [ ] W1-W10 各有 PASS / FAIL / NEEDS-HUMAN 與證據
- [ ] 未改產品程式碼；未碰使用者 BAT / WSL bat-server
- [ ] `~/.ssh/config` 還原（雜湊證明）、環境清理完成

## Sub-session 執行指示

1. 讀本工單、T0510 / T0511 回報區、W1-W10 對應 BUG 檔
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 實作 → 執行 → 填回報區（DONE：全項有結論；PARTIAL：有 FAIL 或做不完）
4. commit 本單檔案；不 push；依派發 mode 通知塔台

---

## 回報區

**DONE**：W1–W8、W10 全 PASS；W9 依工單指示標 **NEEDS-HUMAN**（本機 Windows `docker` CLI 無 engine，Docker 精靈跑不起來），另以映像層補充證據 W9.image PASS。未發現產品缺陷。

- 開工：`2026-10-14T03:44:04+0800`（系統時間）；派發 `CT_MODE=yolo`、`CT_INTERACTIVE=0`；無使用者中途指示
- 受測 build：`C:\Program Files\BetterAgentTerminal\BetterAgentTerminal.exe`，FileVersion `0.6.0-pre.6`，Playwright 隔離實例（`--runtime=e2e-t0515-*`、各自 userData、`BAT_REMOTE_PORT` 為空閒埠）
- 精靈 server bundle 來源：安裝檔內建 baseline `resources\bat-server-baseline\bat-server-linux-x64-v0.6.0-pre.6.tar.gz`（manifest version `0.6.0-pre.6`）；隔離實例未設 `BAT_SERVER_BUNDLE_BASE_URL`

### 落點檢查（Landing Zone）— 整體 **PASS**

| 檢查 | 結果 | 說明 |
|------|------|------|
| C-0 repo identity | ✅ PASS | frontmatter `repo: better-agent-terminal`；`basename(REPO_ROOT)` = `better-agent-terminal` |
| C-1 工單路徑 | ✅ PASS | `REPO_ROOT` = `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal` |
| C-3 affects_files | ✅ PASS（informational） | `e2e/`、`e2e/real-remote/`、`e2e/fixtures/` 皆存在（spec 為新檔） |
| C-2 branch | ℹ️ N/A | 無 `branch` 欄位；實際 `main` |
| `BAT_WORKSPACE_ID` | 證據 | `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b` |

### 判定總表

| # | BUG | 判定 | 關鍵證據 |
|---|-----|------|---------|
| W1 | BUG-120 | ✅ PASS | 乾淨目標精靈完成（13.9 s）；`ls ~/.local/bat-server` → `README.md bin electron node_modules package.json scripts`（無 `staging`）；`bin/bat-server` 可執行 |
| W2 | BUG-121 | ✅ PASS | `ExecStart=/home/bat/.local/bat-server/bin/bat-server --port 9876 --bind-interface localhost`；`MainPID 153`，`ss`：`LISTEN 127.0.0.1:9876 users:(("MainThread",pid=153,…))`（無 `0.0.0.0` / `*`）；精靈 log `✓ verification: bat-server active (pid 153), listening on port 9876` |
| W3 | BUG-088 | ✅ PASS | unit 全文無 `~`（全文存 `w1-install-evidence.txt`）；`is-active` = `active` |
| W4 | BUG-093 | ✅ PASS | profile 指紋 `AB:B1:9C:EF:…:97:6C` = 容器 `~/.local/share/bat-server/server-cert.json`；≠ 使用者 BAT（9876）`61:E3:BA:4E:…:D6:6F`、≠ 隔離實例自身 `73:22:78:BA:…:53:9D`；log `SSH tunnel ready: 127.0.0.1:61951 → bat-t0515-direct:9876`、`✓ TLS fingerprint matches the remote server-cert.json` |
| W5 | BUG-098 | ✅ PASS | 精靈全程唯一 prompt 為「Select SSH host」alias 清單 + 手動輸入，無 direct / tunnel 選項；profile `useSshTunnel: true`；開 profile 視窗 7 ms 連上，遠端 shell 回 `T0515-bat@bat-t0515-jump-25`；ssh 行程 `…\OpenSSH\ssh.exe … -N -L 61966:localhost:9876 … -- bat-t0515-direct` |
| W6 | BUG-100 | ✅ PASS | **直接呼叫**：renderer `ssh.stopServer` / `ssh.uninstallBundle` 皆 `{"ok":true}`，遠端 `is-active inactive`、unit 與 `~/.local/bat-server` 皆 `No such file`、9876 無 listener。**經 rollback**：見 W7(a)，取消後同樣清空，精靈 log 無 `Failed to stop bat-server` / `is not a function` |
| W7 | BUG-099 | ✅ PASS | (a) start-server 之後失敗：sshd `AllowTcpForwarding no` → `fetch-fingerprint` failed（`TLS handshake with 127.0.0.1:<local> failed: read ECONNRESET`），取消前服務 `active`、bundle 在；取消後 stepper `fetch-fingerprint` / `start-server` / `install-server-bundle` 皆 `rolled-back`，遠端全清、未建 profile。(b) **start-server 自身失敗**：使用者行程占用 127.0.0.1:9876 → `verify-failed: bat-server.service is activating (MainPID 0); no socket of that process listens on port 9876`；取消前 unit 已寫入（`ExecStart=… --port 9876 --bind-interface localhost`），取消後 `start-server` = `rolled-back`、unit 與 bundle 皆刪 |
| W8 | BUG-111 | ✅ PASS（SSH） | 「使用者既有資源」：`/home/bat/bat-t0515-user-owned/keep.txt` + 使用者自己的 `nc -lk 127.0.0.1 9876`（pid 537）+ linger。W7(b) rollback 後：`nc=537` 仍在且仍 `LISTEN 127.0.0.1:9876 users:(("nc",pid=537…))`、`owned=keep-me`、`linger=bat`。Docker 側所有權（pick-container / existing 模式 stop）同 W9 卡點，記 `W8.docker` NEEDS-HUMAN |
| W9 | BUG-097 | ⚠️ NEEDS-HUMAN（精靈）／✅ 映像層 PASS | 見下方「W9」節 |
| W10 | SSH alias | ✅ PASS | alias `bat-t0515-nouser-pj`（無 `User`、`ProxyJump bat-t0515-direct`，`ssh -G` → user `<使用者>`）精靈完成；profile `sshHost=bat-t0515-nouser-pj`、`sshUser=""`、`sshPort=null`；target `ExecStart=/home/<使用者>/.local/bat-server/bin/bat-server --port 9876 --bind-interface localhost`、`active`、linger `<使用者>`；指紋 = target 的 cert；target sshd 10 次登入全為 `Accepted publickey for <使用者> from 172.18.0.3`（jump）；SshDetails 顯示 `bat-t0515-nouser-pj (使用者與連接埠由 ~/.ssh/config 決定)`（T0506，截圖 `w10-sshdetails.png`）；**重啟同 runtime 後**重連 7 ms，遠端 shell `T0515-<使用者>@bat-t0515-target-25`，ssh 為 `C:\Windows\System32\OpenSSH\ssh.exe` |

### W9（BUG-097）

- **卡點**：Docker 精靈經 `electron/docker-lifecycle.ts` 呼叫 Windows 的 `docker` CLI（本機 `C:\ProgramData\chocolatey\bin\docker.exe` 29.9.0）。`docker context ls`：`default` → `npipe:////./pipe/docker_engine`（current）、`desktop-linux` → `npipe:////./pipe/dockerDesktopLinuxEngine`；`docker version` → `failed to connect to the docker API at npipe:////./pipe/docker_engine … The system cannot find the file specified.`。本機 engine 只在 WSL `Ubuntu-24.04` 內（29.1.3）。
- 未硬繞的理由：(1) 讓 Windows CLI 連到 WSL engine 需另開未認證的 Docker API（TCP / socat），等同對本機所有行程開放 root 等級 API；(2) 精靈 new 模式容器名固定為 `bat-server-<profile slug>`、資料 volume `bat-server-<容器>-data`，無法符合 `bat-t0515-` 前綴；existing 模式不給選單、直接取 `docker ps` 第一個容器，會碰到非本單容器（如並行 T0514）。兩者都違反本單 Docker 規則。
- **需真人**：啟動 Docker Desktop（或讓 Windows `docker` 有 engine）後跑 Docker 精靈 new 模式 → `docker port <容器>` 為 `127.0.0.1:<port>`、`docker inspect` health `healthy`、BAT 連線成功；existing 模式對「精靈前就在跑」的容器在後續步驟失敗後取消 → 容器仍在跑、`/opt/bat-server` 未刪（BUG-111）。
- **映像層補充（W9.image，PASS）**：`node e2e/real-remote/t0515-wizard-env.mjs docker-check`（spec 第 5 個 test 亦執行）以 repo `docker/Dockerfile` + pre.6 baseline tarball 建 `bat-t0515-docker-server:local`，用與 `docker-lifecycle.ts` 相同參數起 `bat-t0515-dockersrv`：
  - 已安裝 pre.6 `app.asar` 的 `dist-electron/main-CRDUhLQK.js`：`-p` 參數為 `${RL}:<port>:9876`，`RL="127.0.0.1"`
  - health `healthy`（6.7 s，HEALTHCHECK 為 bundle node TLS 握手，exit 0）；`docker port` → `9876/tcp -> 127.0.0.1:56607`；`PortBindings` `HostIp 127.0.0.1`
  - 容器內 LISTEN `00000000:2694`（0.0.0.0:9876，即 `--bind-interface all`）；ENTRYPOINT `["/usr/bin/tini","--","/opt/bat-server/bin/bat-server","--bind-interface","all"]`
  - Windows 端 TLS 握手成功，指紋 = 容器 `server-cert.json`；從 WSL eth0 位址連該埠 `refused`、WSL loopback `open`
  - 檢查完即刪容器與 volume

### 執行方式

```powershell
node e2e/real-remote/t0515-wizard-env.mjs up        # key、image、network、bat-t0515-jump / -target、connection.json（約 17 s）
$env:BAT_E2E_PRE6_WIZARD='1'
$env:BAT_E2E_EXECUTABLE='C:\Program Files\BetterAgentTerminal\BetterAgentTerminal.exe'
npx playwright test e2e/pre6-wizard-acceptance.spec.ts
node e2e/real-remote/t0515-wizard-env.mjs down      # 預設保留 image；--rmi 一併刪
```

- 最終執行（環境重建後第 2 次）：`5 passed (1.8m)`，exit 0；第 1 次（W9 test 尚未加入）`4 passed (1.6m)`
- 每項判定寫入 `%TEMP%\bat-t0515\evidence\results.json`；截圖與遠端證據檔同目錄（`w1-*`、`w5-profile-connected.png`、`w7a-*`、`w7b-*`、`w10-*`、`w9-docker-check.json`、`run2.log`）
- 未設 `BAT_E2E_PRE6_WIZARD=1` 時整檔 skip；另需 `BAT_E2E_EXECUTABLE` 與 `connection.json`，缺一即 skip
- 第 2 次執行後補一處：prompt 記錄的 alias 遮蔽改為長字串優先（第 2 次 log 有 `<user alias>-ssh` 這類殘片）；僅影響證據字串，未重跑

### 產出

- `e2e/pre6-wizard-acceptance.spec.ts`（新）：opt-in spec，5 個 serial test（W1–W6 / W6+W7(a) / W7(b)+W8 / W10 / W9）；失敗情境由測試側製造（sshd `AllowTcpForwarding no`、使用者 `nc` 占埠），取消後以 stepper class（`bat-stepper-status-rolled-back`）與遠端狀態雙重判定；prompt 記錄會把使用者自己的 `~/.ssh/config` alias 遮成 `<user alias>`
- `e2e/real-remote/t0515-wizard-env.mjs`（新）：`up` / `status` / `apply-ssh-config` / `restore-ssh-config` / `docker-check` / `down`；全部資源 `bat-t0515-*` + label `bat.t0515=1`，刪除前再核對 label；`~/.ssh/config` 標記區塊 + 備份 / SHA-256 還原沿用 T0510 做法
- `e2e/real-remote/t0515-sshd.Dockerfile`（新）：沿用 T0510 形狀（systemd PID 1 + sshd），label `bat.t0515`、不設 `AllowUsers`（W10 需第二個帳號）、加 `netcat-openbsd`
- commit：`9917445 test(e2e): T0515 pre.6 setup-wizard acceptance lane (opt-in)`（`git commit --only` 4 個檔案；未 push）
- 未改 T0510 既有腳本、`e2e/fixtures/electron-isolation.ts` 與任何產品程式碼（`electron/**`、`src/**`、`scripts/**`、`package.json` 皆未動）

### 驗收條件

- [x] W1–W10 各有 PASS / FAIL / NEEDS-HUMAN 與證據（W9 NEEDS-HUMAN，理由與真人步驟見 W9 節）
- [x] 未改產品程式碼；未碰使用者 BAT / WSL bat-server：隔離實例 `BAT_REMOTE_PORT` 為空閒埠，從未連線 9876；使用者 userData 只**讀** `server-cert.json` 的 `fingerprint` 欄位（W4 比對用）；未連線、未停止 WSL 9877 / `~/.local/bat-server`；未對 Ubuntu-24.04 跑 WSL 精靈；未消耗 Claude token
- [x] `~/.ssh/config` 還原：apply 前 sha256 `00aab1cda8667c85db60b35f406a785bd9a909b87df7cf49aa78450ca03c58a2` → 還原後相同（`match=true`，兩次執行皆是）；收尾 `sha256sum ~/.ssh/config` 再確認一致
- [x] 環境清理：`down` 後 `bat.t0515=1` 的容器 / network / volume 皆 `none`；WSL `docker ps -a` 為空（未動其他容器）；隔離 userData 全刪（`%APPDATA%` 下無 `runtime-e2e-t0515*`），各次 Terminal Server `alive after teardown: false`；state dir 已刪
- 保留的 image（供重跑，`down --rmi` 可刪）：`bat-t0515-sshd:local`（e777432bbeff，184MB）、`bat-t0515-docker-server:local`（9164ce52dfbc，1.48GB）

### 觀察（非缺陷，僅記錄）

- W7(a) 的失敗出現在 TLS 握手（`read ECONNRESET`）而非開 tunnel：`ssh -L … ExitOnForwardFailure=yes` 只在本機 listen 失敗時退出，伺服器端拒絕 forwarding 要等連線進來才發生。映射後的錯誤文字為「伺服器埠上的程式沒有提供 TLS 憑證」，對「sshd 禁止 port forwarding」這個實際原因略有誤導；屬錯誤訊息精準度，不影響本單判定，交塔台評估是否開單
- W7 / W8 的 rollback 保留 linger（T0426 設計）與 `~/.local/share/bat-server`（bat-server 執行時產生的 cert / token）；本單未把後者列為缺陷

### 遭遇問題

- 並行的 T0514 在工作樹中有未提交檔案（`e2e/pre6-ui-remote-acceptance.spec.ts`、`e2e/real-remote/t0514-*`、其工單）與 `src/styles/settings.css` 的修改；本單 commit 只提交自己的 4 個檔案，未動它們
- repo 無 `eslint.config.*`（`npx eslint` 報找不到設定），`e2e/` 不在 `tsconfig` include；新檔以實際執行驗證

