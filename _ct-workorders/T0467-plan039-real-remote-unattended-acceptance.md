---
schema_version: 1
schema_kind: workorder
id: T0467
title: "PLAN-039 實機驗收自動化（無人值守）：source build + 真 WSL bat-server + WSL 內 Docker 容器（sshd + 獨立 bat-server）當 SSH profile，跑 docs 實機 6 步（不含 Claude Agent）"
type: implementation
status: DONE
repo: better-agent-terminal
project: PLAN-039
priority: P2
sizing: M
created_at: "2026-10-13T15:53:34+08:00"
started_at: "2026-10-13T15:59:39+08:00"
updated_at: "2026-10-13T16:14:41+08:00"
completed_at: "2026-10-13T16:14:41+08:00"
target_version: next
depends_on:
  - T0466
related:
  - "docs/remote-dev-overview.md「Several remote profiles at once (PLAN-039)」→ Manual acceptance 1-6"
  - "e2e/plan039-multi-remote.spec.ts（T0466，兩 isolated 實例互為 server 的 fixture，可沿用）"
  - "electron/remote/__tests__/headless-remote-tower-e2e.test.ts（T0434，遠端 PTY 內跑 helper 的派單 → notify 路徑，可參考如何不經 LLM 驗 notify）"
  - "scripts/dev-deploy-headless.mjs（只支援 wsl:<distro> / dir:<path>）"
  - "BUG-111（精靈 rollback 刪使用者容器的教訓：只動本單建立的容器）"
affects_files:
  - e2e/
  - scripts/
  - docs/remote-dev-overview.md
  - _ct-workorders/PLAN-039-multi-remote-profile-concurrent-clients.md
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
renew_count: 1
workdir: main repo
memory_overrides:
  - "🔴 **只寫測試 / 驗收工具，不改產品程式碼**（`electron/**`、`src/**` 不動）。驗收中發現產品缺陷 → 回報區記錄證據（log 片段、步驟、預期 vs 實際），狀態 PARTIAL，**不自行修**（由塔台開 BUG）。"
  - "🔴 **不得消耗 Claude token**：不開 Claude Agent session、不送 prompt（使用者裁決跳過 docs 步驟 3 後半）。步驟 4 的 Tower → Worker 往返若必然啟動 claude 才能完成，改走不經 LLM 的等價路徑（例：在帶 `BAT_TOWER_TERMINAL_ID` 的 worker 角色 PTY shell 內直接執行 `bat-notify.mjs --submit`），並在回報區說明與原步驟的差異。"
  - "🔴 **不動使用者既有遠端環境**：WSL 預設 server `~/.local/bat-server`（dev-deploy tag `t0456`）只可**連線使用**，不得重新部署 / 停止 / 改設定；Docker 只可建立、操作、刪除**本單自己建立且帶本單標記**（name 前綴 `bat-t0467-` 或 label `bat.t0467=1`）的容器 / network / volume，不得 `docker system prune`、不得動其他容器。收尾必須清除本單容器（image 可保留，回報區列出）。"
  - "🔴 **禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）；寫檔維持 LF；不 push；不跑全套 `npm run test:e2e`（L141），只跑本單 spec；需要時做最小 `npx vite build`。"
---

# T0467 — PLAN-039 實機驗收自動化（無人值守）

## 背景

PLAN-039（多 remote profile 同時連線，T0462-T0466）程式已完成、e2e 以兩個本機 isolated 實例互為 server 驗過（`e2e/plan039-multi-remote.spec.ts`）。剩下「真 WSL + 真 SSH 同開」的實機驗收（docs 的 Manual acceptance 1-6）原定由人工做；使用者要求**改為自動化、無人值守**。

使用者裁決（2026-10-13 第五十八 session）：

| 項目 | 裁決 |
|---|---|
| 第二個 server（SSH 端） | **WSL 內的 Docker**（Windows 無 Docker Desktop，`docker` CLI 只在 WSL `Ubuntu-24.04` 內）。必須是**與 WSL 主機 server 不同的 bat-server**——兩 profile 指同一 server 會走「同 target」路徑（雙 Enter 已知限制），證明不了路由 |
| Claude Agent 對話 | **跳過** |
| 受測 build | **source build**（`npx vite build` 後以 Playwright 啟動，沿用 e2e 基礎設施） |

## 拓撲（建議；Worker 可在不違反 memory_overrides 下調整）

```
Windows host
 └─ Playwright → BAT（source build，isolated userData）
     ├─ profile W：WSL（Ubuntu-24.04）→ 既有 ~/.local/bat-server（不重部署）
     └─ profile S：SSH → localhost:<映射埠> → WSL 內 Docker 容器 bat-t0467-sshd
                         （sshd + 金鑰登入 + 容器內獨立 bat-server；BAT 以 ssh -L 連其 port）
```

- 容器內 bat-server 的部署方式由 Worker 決定（例：`dev-deploy-headless.mjs --target wsl:Ubuntu-24.04 --install-root <WSL 內本單專用目錄>` 產出後 bind-mount / `docker cp` 進容器，再在容器內啟動；注意 `--yes` 會在 WSL 主機端 restart——不得因此在 WSL 主機多起一個 server 或影響 `~/.local/bat-server`）。需要的話可自建一個最小 Dockerfile（放 `scripts/` 或 `e2e/` 下本單子目錄）
- 從 Windows 連容器 sshd：WSL2 localhost forwarding 或其他可行方式；SSH 金鑰為本單臨時產生（放 isolated 目錄，不寫入使用者 `~/.ssh` 的 `authorized_keys` / `config` / `known_hosts`；若 BAT SSH profile 必須讀 known_hosts，用 isolated HOME 或 profile 設定，回報區說明）
- 兩 server 必須可區分：例如 `hostname` 不同、或在各自 server 端放不同 marker 檔

## 任務

1. 建立 opt-in 的實機驗收 spec（例 `e2e/plan039-real-remote.spec.ts`）：
   - **預設 skip**；僅在 env（例 `BAT_E2E_REAL_REMOTE=1` + 必要的連線參數 env）齊全時執行，CI 與一般 `npm run test:e2e` 不受影響
   - 附環境準備 / 清理腳本（建容器、部署容器內 server、產生金鑰、收尾刪容器），一行指令可重跑
2. spec 覆蓋 docs Manual acceptance：
   | docs 步驟 | 自動化判定 |
   |---|---|
   | 1-2 兩 profile 各自連上、同時開窗 | 兩視窗皆 connected，DOM 無「not connected」提示；截圖存 test-results |
   | 3 各視窗開終端跑指令（**不含 Agent**） | `pty:create` + 寫入 `hostname` / marker 指令，輸出分別來自 W / S 的 server，且不出現在另一視窗 |
   | 4 Tower → Worker 往返，`bat-notify --submit` | toast / badge / 預填 / Enter 只落在派單 profile 的視窗；不經 LLM（見 memory_overrides） |
   | 5 關 S 視窗 | 該實例 debug log 依序出現 `profile <id> has no window left — releasing its connection in 15s`（~10 s 內）與 `released the connection of profile <id> (idle: no window left)`（~15 s 後）；期間 W 視窗終端與 notify 持續正常 |
   | 6 角色互換 | 關 W、保留 S，同 5 判定 |
3. 實跑至綠（或明確定位失敗點），把**實跑結果**寫入回報區（每步 PASS / FAIL + 證據：log 行、截圖路徑、耗時）
4. `docs/remote-dev-overview.md` 該節補「Automated real-remote acceptance」一小段：如何跑、前置條件、會建立 / 清除什麼
5. PLAN-039 檔補一行本單結果（**狀態不改**，DONE 由塔台裁決）

## 驗收條件

- [ ] 新 spec 預設 skip，`npx playwright test e2e/plan039-real-remote.spec.ts` 在 env 未設時 0 failed
- [ ] 準備 / 清理腳本可一鍵重跑；收尾後 `docker ps -a` 無本單容器殘留
- [ ] 實跑：步驟 1-6（3 不含 Agent）全 PASS；若有 FAIL，回報區有可重現證據且判定為產品缺陷或環境問題
- [ ] 未改 `electron/**` / `src/**`；未動 `~/.local/bat-server`；未動非本單容器
- [ ] 既有 `e2e/plan039-multi-remote.spec.ts` 仍綠（只跑這一支做回歸）

## Sub-session 執行指示

1. 讀本工單 + `docs/remote-dev-overview.md` 該節 + `e2e/plan039-multi-remote.spec.ts` + T0466 回報區
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 先做環境可行性探測（WSL docker 可用、容器內 sshd 可從 Windows 連到、容器內 server 可起）；不可行 → 回報區說明阻塞點，狀態 BLOCKED，不硬改方案違反 memory_overrides
4. 實作 → 實跑 → 填回報區；全 PASS 寫 **`DONE`**，否則 `PARTIAL` / `BLOCKED`
5. commit 實際改動檔 + 本工單 + PLAN-039；不 push；依派發 mode 通知塔台

## 塔台補充（Renew #1，2026-10-13 15:59，第五十八 session）

前一輪 BLOCKED（WSL 無 Docker engine，見回報區）。**使用者裁決 B：授權 Worker 在 WSL `Ubuntu-24.04` 安裝 Docker 後繼續原工單**。本補充覆寫 memory_overrides 第 3 條「不動使用者既有遠端環境」中關於 WSL 系統的部分，僅限下列範圍：

**授權的系統變更（只限這些）**
1. `sudo apt-get update && sudo apt-get install -y docker.io`（不加裝 docker-compose / buildx 以外非必要套件；若 build 需要 buildx 才裝 `docker-buildx`）
2. `sudo usermod -aG docker gower`
3. `sudo systemctl enable --now docker`
4. 回報區列出實際安裝的套件與版本（`dpkg -l | grep -E 'docker|containerd|runc'`）

**仍禁止**
- 🔴 **不得 `wsl --shutdown` / `wsl --terminate`**（會中斷使用者 WSL 上既有 bat-server 與其他 session）。docker group 尚未生效時改用 `sudo docker …` 或 `sg docker -c "…"`
- 不得在 WSL **主機**裝 `openssh-server` / 起 sshd（sshd 只裝在本單容器內）
- 不得改 `/etc/wsl.conf`、iptables 手動規則、`~/.local/bat-server`、使用者 `~/.ssh`
- 其餘 memory_overrides（不改產品碼、不耗 Claude token、只動本單標記容器、git 禁令、不 push）不變

**塔台採納 Worker 前輪發現**
- known_hosts 隔離：S 實例改用 Git for Windows `usr\bin\ssh.exe` + isolated `HOME`（PATH 前插），**同意**；回報區註明與實際 BAT（System32 ssh）的差異
- `sshKeyPath` 放無空白的 isolated 目錄
- W profile 連 `localhost:9877`；token / fingerprint 可從 WSL server data dir 讀取（只讀，不得改）
- 容器內 bat-server 用目前 source 的 headless bundle；WSL 主機 server 為 `0.5.9-pre.4` 版號的 dev deploy（tag `t0456`）——PLAN-039 主要是 client 端改動，可接受；若因 server 版本差異導致失敗，回報區說明，不得重部署主機 server

**收尾**：本單容器 / network / volume 刪除；Docker engine 本身**保留安裝**（使用者已同意，日後重跑 spec 用）。

---

## 回報區

> 以下由 sub-session 填寫

### 完成狀態（Renew #1）

✅ **DONE** — 依 Renew #1 授權在 WSL 安裝 Docker 後，opt-in 實機驗收 spec + 一鍵環境腳本完成，docs 實機步驟 1-6（3 不含 Agent）**全 PASS**，且 `down` → `up` 重建後再跑仍 5/5。回歸 `e2e/plan039-multi-remote.spec.ts` 4/4。驗收中**未發現產品缺陷**。未改 `electron/**` / `src/**`。

**Landing Zone Check：PASS**（C-0 `repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal`；C-1 ✅；C-3 informational ✅；C-2 無 `branch` 欄位，實際 `main`）。`CT_MODE=yolo`、`CT_INTERACTIVE=0`、`BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）。

### 產出摘要（Renew #1）

| 檔案 | 內容 |
|---|---|
| `e2e/plan039-real-remote.spec.ts`（新） | R1-R5 對應 docs 步驟 1-6；預設 skip（需 `BAT_E2E_REAL_REMOTE=1` + `%TEMP%\bat-t0467\connection.json`，可用 `BAT_E2E_REAL_REMOTE_CONFIG` 指定） |
| `e2e/real-remote/plan039-real-remote-env.mjs`（新） | `up` / `status` / `down [--rmi]`：前置檢查 → 臨時 ed25519 金鑰 → build context（`dist-baseline` 最新 linux-x64 tarball + `dev-deploy-headless` dry-run staging 的 headless JS 與 helpers）→ `docker build` → `docker run` → 等容器 server 憑證 / token / LISTEN → Git ssh 登入探測 → 唯讀讀取 WSL server 連線資訊（重用 `smoke-remote-headless.mjs` 的 `resolveWslTarget`）→ 寫 `connection.json`。只動帶 `bat.t0467=1` 標籤且名為 `bat-t0467-sshd` 的容器；同名但無標籤的容器 → 拒絕動作 |
| `e2e/real-remote/Dockerfile`、`entrypoint.sh`（新） | `debian:bookworm-slim` + `openssh-server`（僅金鑰、`AllowUsers bat`、`AllowTcpForwarding local`）+ bundle 在 `/home/bat/.local/bat-server`；entrypoint 以 `bat` 身分起 `bat-server --port 9876 --bind-interface localhost`，再前景跑 sshd；`/etc/bat-t0467-marker` 當 S 端標記。entrypoint 由 env 腳本轉 LF（repo `core.autocrlf=true`、無 `.gitattributes`） |
| `e2e/fixtures/electron-isolation.ts` | `launchIsolated(name, log, { env })` 與 `isolatedEnv(port, extra)` 可加額外 env，同名不分大小寫的既有 key（Windows `Path`）會被取代。預設行為不變，既有 spec 不受影響（回歸 4/4） |
| `docs/remote-dev-overview.md` | PLAN-039 節新增「Automated real-remote acceptance」：指令、前置條件、會建立 / 清除什麼、與人工步驟的差異 |
| `_ct-workorders/PLAN-039-…md` | 補一行 T0467 結果（狀態未改） |

**拓撲（實際）**：isolated BAT（source build）→ profile W `wsl-linux`（`localhost:9877`，WSL 既有 server，hostname `GXDEVPC02`）＋ profile S `ssh-linux`（`bat@127.0.0.1:22467` → 容器 `bat-t0467-sshd` sshd → `ssh -N -L <動態埠>:localhost:9876` → 容器內 bat-server，hostname `bat-t0467-s`）。WSL 是 `networkingMode=Mirrored`，所以 docker 的 `-p 127.0.0.1:22467:22` 從 Windows 直接可達。

### 實跑結果（Renew #1，每步 PASS / FAIL + 證據）

第 1 輪 2026-10-13 16:10（5 passed，39.0 s），第 2 輪 `down` → `up` 重建後 16:11-16:12（5 passed，38.9 s）。以下證據取自第 2 輪；截圖在 `e2e-results/<test>/`（Playwright `outputDir`，下一次跑 Playwright 時會被清掉）。

| docs 步驟 | 結果 | 證據 |
|---|---|---|
| 1-2 兩 profile 各自連上、同時開窗 | ✅ PASS | W `clientStatus` = `localhost:9877` fp `22:3A:E4:C7…`，S = `127.0.0.1:62537`（tunnel 動態埠）fp `44:8E:DD:88…`，兩者都 connected。開 S 後 W 仍 connected；本機視窗 `connected:false`；兩視窗 body 都沒有 `app.remoteNotConnected`（en / zh-TW / zh-CN）文字；S tunnel 只有 1 個 ssh，`C:\Program Files\Git\usr\bin\ssh.exe`；兩窗開啟各約 0.4 s。截圖 `r1-connected-{W,S}.png` |
| 3 各視窗終端跑指令（不含 Agent） | ✅ PASS | W PTY 印出 `T0467-R2-W-GXDEVPC02-1234`，S PTY 印出 `T0467-R2-S-bat-t0467-s-4321`（主機名與算式結果都由各自 server 的 shell 算出）。兩邊 server 對另一視窗 PTY 的 `pty:get-cwd` 都回 null；兩視窗都收不到對方 PTY 的輸出 |
| 4 Tower → Worker `bat-notify --submit` | ✅ PASS | 每個視窗都有一個 seed 的 Tower 分頁（真 TerminalPanel / xterm）。Worker PTY 帶 `customEnv.BAT_TOWER_TERMINAL_ID`，在 shell 內執行 `"${BAT_HELPER_NODE:-node}" "$BAT_HELPER_DIR/bat-notify.mjs" --submit 'echo T0467-SUBMIT-<tag>-$((40+2))'`，exit 0。W1 與 S2 各自：`terminal:notified` ×1、`terminal:keypress` ×1、toast `📨 T0467-W1: …` / `📨 T0467-S2: …`、`.notification-badge` ×1，Tower 印出 `T0467-SUBMIT-W1-42` / `-S2-42`（證明預填 + Enter，約 0.4 s）。另一視窗沒有 notify、keypress、toast，也沒有 Tower / Worker 輸出。截圖 `r3-notified-{W,S}.png`（W 圖可見 toast、縮圖紅點、`T0467-SUBMIT-W1-42`） |
| 5 關 S 視窗 | ✅ PASS | 關窗後 119 ms：`[remote] profile t0467-s-ssh has no window left — releasing its connection in 15s unless a window returns`。648 ms 時 W 終端與 W3 notify round trip 都正常，且 S 尚未釋放。grace 期間每 500 ms 取樣 W，28 次都 connected。15054 ms：`released the connection of profile t0467-s-ssh (idle: no window left)`（兩行順序正確）；釋放後 W 終端仍正常；S tunnel ssh 已結束 |
| 6 角色互換 | ✅ PASS | 重開 S（新視窗 0.4 s 連上，W 不受影響），S4 round trip 不外漏到 W。關 W 後 110 ms 出現 `profile t0467-w-wsl has no window left …`；634 ms 時 S 終端與 S5 notify 正常；S 28 次取樣都 connected；15028 ms 出現 `released the connection of profile t0467-w-wsl …`；之後 S 仍正常。截圖 `r5-after-w-released-S.png` |
| 回歸 `e2e/plan039-multi-remote.spec.ts` | ✅ PASS | 4 passed（23.6 s），未設 `BAT_E2E_REAL_REMOTE` |
| 預設 skip | ✅ PASS | env 未設：`npx playwright test e2e/plan039-real-remote.spec.ts` → 5 skipped、0 failed |
| 一鍵重跑 / 收尾 | ✅ PASS | `down` → `up` 5 s（image 已有快取；首次 build 約 45 s）。最終 `down` 後 `docker ps -a` 空、沒有 `bat.t0467=1` network / volume、`%TEMP%\bat-t0467` 已刪 |

驗收條件：5 項全達成。

**與 docs 原步驟的差異（memory_overrides 要求說明）**
- 步驟 3 沒有 Agent session（使用者裁決）。
- 步驟 4 不經 `bat-terminal.mjs`：它走 `terminal:create-agent-command`，一定會啟動 agent（在 W 會耗 Claude token）。改由視窗以 `pty:create` 加 `customEnv.BAT_TOWER_TERMINAL_ID=<Tower 分頁 id>` 建立 Worker PTY，server 會照 `buildHeadlessHelperEnv` 發 worker capability，等同被派發的 Worker。驗到的是 notify → toast / badge / 預填 / `terminal:keypress` → renderer 合成 Enter 這段；server 端 `create-agent-command` → `terminal:created-externally` 開新分頁那段沒驗到（`headless-remote-tower-e2e.test.ts` 已涵蓋）。
- S 的 ssh 是 Git for Windows `usr\bin\ssh.exe`，`PATH` 前插，`HOME`=`%TEMP%\bat-t0467\home`。known_hosts 寫在隔離目錄（`[127.0.0.1]:22467` 三筆），使用者 `~/.ssh/known_hosts` 沒有 22467 的條目。實際安裝的 BAT 用 System32 OpenSSH，這條沒驗到。
- W server 是 `0.5.9-pre.4` dev deploy（tag `t0456`），容器 server 是 `0.6.0-pre.1` baseline 疊上目前 source 的 headless JS。兩者版本不同，但沒有造成任何失敗。

**環境變更紀錄**
- WSL 系統（Renew #1 授權範圍內）：`apt-get install -y docker.io`、`usermod -aG docker gower`、`systemctl enable --now docker`。沒有 `wsl --shutdown`；新開的 `wsl -d` 行程已帶 docker 群組（`groups=…,108(docker)`），不需要 sudo。`dpkg -l`：`docker.io 29.1.3-0ubuntu3~24.04.2`、`containerd 2.2.1-0ubuntu1~24.04.3`、`runc 1.3.4-0ubuntu1~24.04.1`（相依：`iptables` 改用 nft alternatives、`dnsmasq-base`、`ubuntu-fan`，皆由 apt 自動帶入）。Docker engine 保留安裝。
- 保留的 image：`bat-t0467-sshd:local`（2.44 GB）、`debian:bookworm-slim`（116 MB，本單 pull）。`sonarsource/sonarqube-mcp:latest` 不是本單建立的，未動。刪除：`node e2e/real-remote/plan039-real-remote-env.mjs down --rmi` 及 `docker rmi debian:bookworm-slim`。
- `~/.local/bat-server`：只讀取 token、cert、unit env 並連線使用。pid 318 從 14:43:22 起持續運行，`electron/remote/*.js` 的 mtime 仍是 2026-10-05，沒有重部署、重啟或改設定。W 上本單建立的 PTY 在關 W 視窗前全部 kill（R5：6 個），收尾後 pid 318 下沒有任何 `BAT_TERMINAL_ID=e2e-t0467*` 子行程。
- 🟡 **repo `node_modules` 修復**：開工時 `node_modules` 只剩 52 個套件（mtime 2026-10-09，沒有 vite / ws / esbuild / playwright），`npx vite build` 跑不起來。處理方式：`npm ci`（依 lock，`package-lock.json` 未改）。npm 12.2.0 預設擋 install scripts（electron、esbuild、sharp、better-sqlite3、claude-code、electron-winstaller），所以手動補跑 `node_modules/electron/install.js`、`node_modules/esbuild/install.js`、`node_modules/sharp/install/check.js`、`npx electron-rebuild -f -w better-sqlite3`。沒有執行 `npm install-scripts approve`（會改 `package.json`）。`@anthropic-ai/claude-code` 的 `install.cjs` 沒有補跑，若本機 dev 需要 embedded claude 要另外處理。這是給塔台的獨立發現：本機 dev 環境在 npm 12 下 `npm ci` 不會自動完成 native 準備，`postinstall` 的 `npm rebuild better-sqlite3` 也可能被擋（未驗證）。

### 遭遇問題（Renew #1）

- `node_modules` 殘缺與 npm 12 擋 install scripts（見上）：已就地修復，未改任何 tracked 檔。
- `down` 後立刻 `up` 時，`127.0.0.1:22467` 短暫仍被占用（mirrored 網路下 docker-proxy 延遲釋放）。已讓 `up` 等最多 15 s。
- 同一 repo 有另一個 Worker 正在做 T0468（`electron/voice-handler.ts`、`scripts/verify-native-modules.js`、T0468 工單有未 commit 的改動）。本單 commit 只精準 staging 本單檔案，未碰那些改動。
- 容器內 R2 / R3 的 S PTY 在關 S 視窗時刻意不 kill（模擬使用者直接關窗），會隨容器刪除，不影響使用者環境。

### Commit

見下方 commit 紀錄（本單檔案精準 staging；不 push）。

### 回報時間（Renew #1）

2026-10-13T16:13:45+08:00（取自 `date`）

---

## 前輪回報（Renew #1 前，BLOCKED，保留作歷史）

### 完成狀態

⛔ **BLOCKED** — 執行指示第 3 步的環境可行性探測不通過：**本機沒有任何 Docker engine**（WSL `Ubuntu-24.04` 內沒有 docker，Windows 端的 `docker.exe` 只是 client，沒有 daemon）。工單裁決的拓撲（SSH profile → WSL 內 Docker 容器）前提不成立。各替代路線都得在使用者的 WSL 安裝系統套件，超出 memory_overrides 授權，依工單指示**不硬改方案**，停在探測階段。未寫 spec / 腳本，未改任何產品或文件檔。

**Landing Zone Check：PASS**
- C-0：frontmatter `repo: better-agent-terminal` 與 `basename(REPO_ROOT)` `better-agent-terminal` 一致 ✅（REPO_ROOT `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）
- C-1：工單在 REPO_ROOT 下 ✅；C-3：`e2e/`、`scripts/`、`docs/remote-dev-overview.md` 都存在（informational）；C-2：工單無 `branch` 欄位，實際分支為 `main`
- 派發 mode：`CT_MODE=yolo`、`CT_INTERACTIVE=0`；`BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）

### 產出摘要

本單只產出環境探測結果（下表），沒有程式 / 文件改動；commit 只含本工單檔，以及 PLAN-039 補的一行 T0467 結果（PLAN 狀態未改）。

**環境探測（2026-10-13，Worker 實測）**

| 項目 | 結果 | 證據 |
|---|---|---|
| WSL distro | 只有 `Ubuntu-24.04`（Running，WSL2）| `wsl -l -v` |
| WSL 內 docker | ❌ **未安裝** | `/usr/bin/docker*`、`/usr/local/bin/docker*`、`/snap/bin/docker*` 都不存在；`systemctl is-active docker` → `inactive`；沒有 `/var/run/docker.sock`；`dpkg -l` 查無 docker / containerd / podman；沒有 `~/.docker` |
| Windows docker | ❌ 只有 client | `C:\ProgramData\chocolatey\bin\docker.exe`（Client 29.9.0）；`docker version` → `failed to connect to the docker API at npipe:////./pipe/docker_engine ... The system cannot find the file specified.`；context `desktop-linux` 也指向不存在的 Docker Desktop pipe |
| apt 可裝 docker | 可（未裝）| `apt-cache policy docker.io` → Candidate `29.1.3-0ubuntu3~24.04.2`；`sudo -n true` 成功（passwordless sudo）|
| WSL 內 sshd | ❌ 未安裝 | 沒有 `/usr/sbin/sshd`；`systemctl is-active ssh` → `inactive` |
| WSL 既有 server | ✅ 可連（只讀探測，未動）| pid 318 `/home/gower/.local/bat-server/bin/node .../bat-server.mjs` 監聽 `127.0.0.1:9877`；`package.json` version `0.5.9-pre.4`；Windows `Test-NetConnection localhost -Port 9877` → True（IPv4，`::1` 失敗）；使用者已安裝的 BAT profile `wsl-ubuntu-24-04` 為 `remoteHost: localhost` / `remotePort: 9877` / `targetOS: wsl-linux` |
| 免安裝隔離 | ✅ 可用 | `unshare -Ur --uts sh -c "hostname bat-probe && hostname"` → `bat-probe`（user + UTS namespace 可給第二個 server 獨立 hostname）|

**對下一輪實作有用的發現（Docker 就緒後仍適用）**

1. **known_hosts 隔離**：BAT 的 ssh 呼叫一律帶 `-o StrictHostKeyChecking=accept-new`（`electron/remote/ssh-args.ts` `buildBaseSshArgs`），首次連線會寫 known_hosts。Windows 內建 `C:\Windows\System32\OpenSSH\ssh.exe`（`OpenSSH_for_Windows_9.5p2`）**不吃 `HOME` / `USERPROFILE`**：兩者都改成暫存目錄後 `ssh -G localhost` 仍是 `userknownhostsfile <使用者資料夾>/.ssh/known_hosts`。Git for Windows 的 `C:\Program Files\Git\usr\bin\ssh.exe` 會吃 `HOME`（`nsswitch.conf` `db_home: env windows ...`），`HOME` 指到暫存目錄後是 `/tmp/.../.ssh/known_hosts`。⇒ spec 要給 S 實例的 env 在 `PATH` 前面插入 Git `usr\bin`，並把 `HOME` 設成 isolated 目錄，才不會寫到使用者的 `~/.ssh/known_hosts`。這和實際 BAT（從 Explorer 啟動時用 System32 ssh）不一樣，回報時要註明。
2. **金鑰路徑不可含空白**：`validateSshIdentifier` 拒絕空白與控制字元，所以 `sshKeyPath` 要放在沒有空白的 isolated 目錄（scratchpad / `%TEMP%` 路徑可以）。
3. **S profile 形狀**：`targetOS: 'ssh-linux'` 一律走 tunnel（T0425），`ssh -N -L <動態埠>:localhost:<remotePort>`，wss 改連 `127.0.0.1:<動態埠>`；`remoteToken` / `remoteFingerprint` 要用容器內 server 的值。
4. **W profile**：連 `localhost:9877`；token / fingerprint 可從 WSL server 的 data dir 讀取（`~/.local/share/bat-server`，本次未讀取內容）。

### 實跑結果（每步 PASS / FAIL + 證據）

| docs 步驟 | 結果 | 說明 |
|---|---|---|
| 1-2 兩 profile 各自連上、同時開窗 | ⛔ BLOCKED | 沒有 Docker engine，S 端 server 起不來 |
| 3 終端指令（不含 Agent）| ⛔ BLOCKED | 同上 |
| 4 Tower → Worker `bat-notify --submit` | ⛔ BLOCKED | 同上 |
| 5 關 S 視窗 | ⛔ BLOCKED | 同上 |
| 6 角色互換 | ⛔ BLOCKED | 同上 |
| 回歸 `e2e/plan039-multi-remote.spec.ts` | — 未跑 | 本單沒有改動任何檔案，沒有回歸面 |

驗收條件：全部未達成（spec / 腳本未建立）。`electron/**` / `src/**` 未改；`~/.local/bat-server` 只做唯讀探測（`ls`、`ss`、`ps`、讀 `package.json`），未重部署、未停止、未改設定；沒有建立或刪除任何容器（也無法建立）。

### 遭遇問題

**阻塞點**：工單假設「`docker` CLI 只在 WSL `Ubuntu-24.04` 內」，實測 WSL 內沒有 docker。所有可行路線都要安裝系統套件，超出本單授權（memory_overrides 只授權操作「本單建立的容器」，不含改動 WSL 系統）。

**給塔台的選項**（推薦 A）

| 選項 | 做法 | 代價 / 風險 |
|---|---|---|
| **A（推薦）** | 使用者在 WSL 自行裝 Docker Engine，例如 `sudo apt install -y docker.io && sudo usermod -aG docker gower`，然後 `wsl --shutdown` 重開（或 `sudo systemctl enable --now docker`，`/etc/wsl.conf` 已有 `systemd=true`）。裝好後**原工單不改**重派 | 使用者動手一次；拓撲與裁決完全照原樣 |
| B | 塔台明確授權 Worker 執行選項 A 的安裝（sudo 是 passwordless，技術上可以無人值守完成）| 會改使用者的 WSL 系統：新增 daemon、iptables 規則、docker group。不容易完整還原，所以需要使用者明確同意 |
| C | 不用 Docker：在 WSL 內以 `unshare -Ur --uts` 起「獨立 hostname + 本單專用 install root / data dir / port」的第二個 bat-server，加上非 root 的 user-level `sshd`（高埠、本單專用 host key 與 `AuthorizedKeysFile`）| 一樣要裝 `openssh-server`（WSL 內沒有 `sshd`）；而且違反工單拓撲「不得在 WSL 主機多起一個 server」，要先改裁決 |

**殘留風險**：選項 A / B 完成後，下一輪仍有 known_hosts 隔離的偏差要處理（見產出摘要第 1 點，改用 Git msys ssh），回報區需註明。

**其他**：未使用 stash / reset / checkout / restore；未 push；探測用的暫存目錄 `%TEMP%\t0467probe` 已刪除。

### 回報時間

2026-10-13T15:57:09+08:00（取自 `Get-Date`）
