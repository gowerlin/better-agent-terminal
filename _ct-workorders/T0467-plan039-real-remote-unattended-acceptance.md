---
schema_version: 1
schema_kind: workorder
id: T0467
title: "PLAN-039 實機驗收自動化（無人值守）：source build + 真 WSL bat-server + WSL 內 Docker 容器（sshd + 獨立 bat-server）當 SSH profile，跑 docs 實機 6 步（不含 Claude Agent）"
type: implementation
status: BLOCKED
repo: better-agent-terminal
project: PLAN-039
priority: P2
sizing: M
created_at: "2026-10-13T15:53:34+08:00"
started_at: "2026-10-13T15:54:39+08:00"
updated_at: "2026-10-13T15:58:00+08:00"
completed_at: null
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
renew_count: 0
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

---

## 回報區

> 以下由 sub-session 填寫

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

1. **known_hosts 隔離**：BAT 的 ssh 呼叫一律帶 `-o StrictHostKeyChecking=accept-new`（`electron/remote/ssh-args.ts` `buildBaseSshArgs`），首次連線會寫 known_hosts。Windows 內建 `C:\Windows\System32\OpenSSH\ssh.exe`（`OpenSSH_for_Windows_9.5p2`）**不吃 `HOME` / `USERPROFILE`**：兩者都改成暫存目錄後 `ssh -G localhost` 仍是 `userknownhostsfile C:\Users\Gower/.ssh/known_hosts`。Git for Windows 的 `C:\Program Files\Git\usr\bin\ssh.exe` 會吃 `HOME`（`nsswitch.conf` `db_home: env windows ...`），`HOME` 指到暫存目錄後是 `/tmp/.../.ssh/known_hosts`。⇒ spec 要給 S 實例的 env 在 `PATH` 前面插入 Git `usr\bin`，並把 `HOME` 設成 isolated 目錄，才不會寫到使用者的 `~/.ssh/known_hosts`。這和實際 BAT（從 Explorer 啟動時用 System32 ssh）不一樣，回報時要註明。
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
