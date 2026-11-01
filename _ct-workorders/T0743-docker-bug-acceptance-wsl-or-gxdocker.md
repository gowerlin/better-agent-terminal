---
schema_version: 1
schema_kind: workorder
id: T0743
title: "Docker 類待驗收 BUG（097 / 105 / 111，及 107 / 108 / 156 的 Docker / 遠端部分）：以 WSL 內的 Docker（優先）或 gxdocker 遠端 Docker 跑驗收，不改使用者環境設定、只動自己建立的資源"
type: implementation
status: DONE
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: M
created_at: "2026-11-01T18:36:08+0800"
started_at: "2026-11-01T19:11:09+0800"
updated_at: "2026-11-01T19:37:27+0800"
completed_at: "2026-11-01T19:37:27+0800"
depends_on: [T0742, T0744]
related:
  - "T0738 回報區〈C 類需要的環境〉（BUG-105 / 111）；BUG-097（T0738 對象漏列，塔台補上）"
  - "BUG-097 / T0418 / T0427 / T0428、BUG-105 / T0434 一帶、BUG-111 / T0444；`e2e/pre6-ui-remote-acceptance.spec.ts`（U4 BUG-105，需 `node e2e/real-remote/t0514-env.mjs up`）、`e2e/pre6-wizard-acceptance.spec.ts`（W8 BUG-111）、`e2e/real-remote/t0514-env.mjs`"
  - "`electron/docker-detect.ts`、Docker 設定精靈相關程式（以實際檔案為準）；CLAUDE.md「Remote 資安（PLAN-018 T0182）」「多 remote profile 同時連線（PLAN-039）」"
affects_files:
  - "e2e/（只在既有 spec 需要可設定的 Docker 端點時新增 opt-in 參數或新 spec；🔴 不改既有斷言的意圖，預設行為不變）"
  - "e2e/real-remote/（同上，只加 opt-in 參數）"
  - _ct-workorders/T0743-docker-bug-acceptance-wsl-or-gxdocker.md
renew_count: 0
session_ids:
  - "b5a69d08-73b4-4217-9771-30d1c1aa9dfe"
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 使用者指定（2026-11-01 第一百零三 session）：Docker 用 WSL 內的 Docker 或 gxdocker remote，不用 Docker Desktop。塔台 18:3x 唯讀探測：Windows `docker context ls` 只有 `default`（npipe docker_engine，未執行）/ `desktop-linux`（未執行）；WSL `Ubuntu-24.04` 有 `/usr/bin/docker`、server 29.1.3、已有 1 個使用者自己的容器在跑；`~/.ssh/config` 有 `Host gxdocker`。"
  - "🔴 第一階段（先查證，不動手）：讀 BAT 連 Docker 的方式（docker CLI？是否尊重 `DOCKER_HOST` / `DOCKER_CONTEXT`？精靈與 docker-linux 遠端 profile 各自怎麼呼叫）與 `t0514-env.mjs` / 兩支 pre6 spec 的前提（mount 路徑、port、映像來源），判斷在**不改使用者環境設定**下可行的端點：(a) WSL Docker：例如測試程序與隔離實例經 `wsl -d Ubuntu-24.04 -- docker …`、或 BAT 本身支援的 WSL 路徑；(b) gxdocker：只在測試程序 / 隔離實例的 env 設 `DOCKER_HOST=ssh://gxdocker`（用使用者既有 ssh 設定與金鑰）。優先 (a)；(a) 不可行才考慮 (b)，🔴 改用 (b) 前先以提問通道問塔台（附理由與會在 gxdocker 上建立的資源清單），塔台答覆後才可動 gxdocker。兩者都需要改環境設定才可行 → 停下回報 BLOCKED，寫明需要什麼。"
  - "🔴 不得改使用者環境：不改 WSL / gxdocker 的 daemon 設定（`daemon.json`、systemd）、不讓 dockerd 新增監聽（tcp 2375 等）、不新增 / 切換 `docker context`（會寫 `~/.docker`）、不改 `~/.ssh/config` 或金鑰、不啟動 Docker Desktop、不在使用者 WSL 安裝 / 移除 server bundle（使用者已有 `WSL Ubuntu-24.04` 遠端 profile 與其 bat-server，絕不碰）、不改 Windows 防火牆。"
  - "🔴 只動自己建立的資源：容器、映像、volume、網路、暫存目錄一律以 `bat-e2e-t0743-` 開頭（既有 spec 寫死的名稱如 `bat-t0514-srv` 若無法改，以 opt-in 參數加前綴，或先確認該名稱在目標 Docker 上不存在）。開始前與結束後各記一次 `docker ps -a` / `images` / `volume ls` / `network ls` 的清單（只記名稱與 id），回報區附比對：使用者原有的資源一個都沒變（含那個正在跑的容器）。🔴 不得 `prune`、不得 stop / rm 非自己建立的任何資源；port 只綁 127.0.0.1（BUG-097 驗的就是不全介面暴露），先確認 port 未被佔用。跑完清掉自己建立的全部資源；清不掉就列出並說明。"
  - "🔴 情境：① BUG-097：bat-server 容器的埠只綁 127.0.0.1（不全介面暴露）、container 內 bind 可達、HEALTHCHECK 有路由（以 T0418 / T0427 / T0428 的實際修正為準）。② BUG-105：docker-linux 遠端視窗的 proxied channel 路徑轉換（`pre6-ui-remote-acceptance` U4：claude:* cwd、github:*、git-scaffold:*、worktree:create 轉成容器路徑）；🔴 需要真實 Claude 登入的那一步（`claude:start-session` 後 `pwd`）不做，沿用 spec 的 recorder 取代，回報標明。③ BUG-111：精靈 rollback / 取消時不刪、不停使用者事先建立的容器與資料（`pre6-wizard-acceptance` W8 Docker 側）—— 「使用者事先建立的容器」一律由本單自己建立並命名 `bat-e2e-t0743-user-*` 來扮演，🔴 不得拿使用者真正的容器當受測對象。"
  - "🔴 範圍追加（塔台 2026-11-01T19:07:33+0800，T0742 結案後）：④ BUG-156 的 Docker 側：精靈實際 `docker run -p` 的 publish port 不是 BAT RemoteServer 的 port、只綁 127.0.0.1；「使用既有容器」時的 port 檢查（本機選 port 的邏輯已由 `e2e/t0742-docker-port-pick.spec.ts` 驗過，不必重做）。⑤ BUG-107 / BUG-108 的遠端視窗部分：`pre6-ui-remote-acceptance` 的 U7（`webUtils` 路徑、合成 drop）與 U8（遠端視窗的圖片附件讀 client 檔案）在 docker-linux 遠端視窗跑（本機視窗部分已由 T0742 `t0742-terminal-drop-path` / `t0742-panel-image-attachments` 驗過）。④⑤ 與 ①–③ 共用同一個 Docker 環境與資源規則。"
  - "🔴 不改產品程式碼（`src/` / `electron/` / `scripts/` 都不動）；發現產品缺陷記在〈發現的問題〉，由塔台開 BUG。不改 BUG 單狀態與 `_bug-tracker.md`；回報區列〈BUG 結案建議〉。隔離：BAT 一律用 `e2e/fixtures/electron-isolation.ts` 的隔離實例（不碰使用者正在用的 BAT 與 userData、不執行安裝檔）。T0742 與 T0744 都完成後才派本單（避免同時 build）；先 `npx vite build`。不使用真實模型。既有 spec 若預設對安裝版（`BAT_E2E_EXECUTABLE`），本單以 source build 跑並說明；需要 server bundle tarball 時用 repo 的建置腳本產生到暫存目錄或已發佈的 `server-bundle-v0.7.2-pre.8`（`gh release download -R gowerlin/better-agent-terminal`）。"
  - "🔴 驗證：跑到的 spec 連跑 2 次綠（Docker 環境準備時間長時可說明只跑 1 次的原因）；改了 e2e 檔則 `npm run typecheck` = 0、`npm run typecheck:electron` = 0（e2e 另以單檔 tsc 檢查）。不發版、不改 CHANGELOG、不 push。公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」，🔴 回報、spec、log 摘錄不得寫 gxdocker 的 HostName / IP、使用者帳號或家目錄路徑（主機只寫 `gxdocker`）。"
  - "🔴 yolo：不得問使用者；判讀問題依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。Git：只用 `git commit --only` commit 自己改的檔案。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
---

# T0743 — Docker 類待驗收 BUG（WSL Docker / gxdocker）

## 元資料

- **工單編號**：T0743
- **類型**：implementation（驗收）
- **優先級**：P2
- **建立時間**：2026-11-01T18:36:08+0800
- **預估規模**：M

## 背景

T0738 盤點後，BUG-097 / 105 / 111 需要執行中的 Docker 才能驗（BUG-097 為 T0738 對象漏列）。本機 Docker Desktop 未執行；使用者指定改用 WSL 內的 Docker 或 gxdocker 遠端 Docker。本單先查證可行端點，在不改使用者環境、只動自己建立的資源的前提下跑既有 spec（`pre6-ui-remote-acceptance` U4、`pre6-wizard-acceptance` W8）與 BUG-097 的檢查。

## 範圍

1. 第一階段查證與端點選擇（WSL 優先；gxdocker 須先問塔台）。
2. 情境 ①–③。
3. 資源清單前後比對與清理。
4. 〈BUG 結案建議〉。

## 不做

- 不改產品程式碼、不改 BUG 狀態。
- 不改任何環境設定、不碰使用者既有容器與 WSL bat-server、不啟動 Docker Desktop、不用真實模型。

## 驗收

- [ ] 端點查證結論（選哪個、為什麼、另一個為何不用）
- [ ] ①–⑤ 逐項 PASS / 未涵蓋與原因
- [ ] 資源清單前後比對：使用者原有資源不變、自建資源已清除
- [ ] 〈BUG 結案建議〉

---

## 回報區

### 完成狀態

- **狀態**：DONE —— ①–⑤ 都在 WSL Docker 上實測 PASS，兩條線各連跑 2 次全綠。未涵蓋的只有兩項，原因見〈情境結果〉：工單本來就排除的「`claude:start-session` 後跑 `pwd`」，以及 T0427 的「容器發佈在所有介面」那一半（要測就得真的綁 0.0.0.0，本單規則禁止）。
- **端點**：(a) WSL `Ubuntu-24.04` 內的 Docker（server 29.1.3）。沒有動到 gxdocker，也沒有向塔台提問。
- **產品程式碼**：沒有改（`src/` / `electron/` / `scripts/` 都沒動）。
- **commit**：`60419cc20b026dbfbd2476a77c8653f20190ebf1`（只含 e2e 三個檔）＋本工單 commit。沒有 push。
- **變更檔案**：
  - `e2e/t0743-docker-wizard.spec.ts`（新增，opt-in `BAT_E2E_T0743_DOCKER=1`）：D1–D5。
  - `e2e/real-remote/t0743-docker-shim.go`（新增）：測試專用的 `docker.exe`，由 spec 編譯到暫存目錄，只放在隔離實例的 PATH 上。
  - `e2e/real-remote/t0514-env.mjs`：新增 opt-in `--name-prefix <p>`，容器 / 映像改名為 `<p>t0514-srv` / `<p>t0514-srv:local`。不帶這個參數時名稱與行為完全不變；既有斷言一條都沒改。
- **驗證**：
  - `npm run typecheck`：exit 0。
  - `npm run typecheck:electron`：exit 0。
  - e2e 單檔：`npx tsc --noEmit --strict --module esnext --moduleResolution bundler --target es2022 --skipLibCheck --types node --allowJs e2e/t0743-docker-wizard.spec.ts`，exit 0。
  - `node --check e2e/real-remote/t0514-env.mjs`：OK。
  - shim：`go vet` OK、`gofmt -l` 為空。最後一次 spec 跑完後才做 gofmt，它只在檔頭註解補了兩個 `//` 空行，之後重新編譯成功，行為沒變。
- **BAT 環境**：`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`；`BAT_REMOTE_TOKEN` 已設定；`CT_MODE` = yolo；`CT_INTERACTIVE` = 0。
- **落點檢查**：PASS。
  - C-0：`repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`。
  - C-1：工單在 REPO_ROOT 底下。
  - C-3：`e2e/`、`e2e/real-remote/` 都存在。
  - C-2：工單沒有 `branch` 欄位（目前在 `main`）。
  - 沒有 `CT_HOME`，不是 worktree。
- **session_id**：b5a69d08-73b4-4217-9771-30d1c1aa9dfe

### 端點查證

**BAT 怎麼連 Docker**

- `electron/docker-detect.ts` / `electron/docker-lifecycle.ts` 都是 `execFile('docker', args)`，env 直接繼承主行程，所以會尊重 `DOCKER_HOST` / `DOCKER_CONTEXT`，執行檔則依 PATH 找。
- 精靈的「建立新容器」固定用 `bat-server:latest`（`docker-flow.ts` `DEFAULT_IMAGE`）。
- 「沿用既有容器」預設取 `docker ps -a` 第一個容器（`pick-container.ts`）。
- docker-linux 遠端 profile 連線時只連 `host:port` 的 bat-server，不呼叫 docker。

**選 (a) WSL Docker 的原因**

- U 線（`pre6-ui-remote-acceptance`）：`t0514-env.mjs` 和 spec 本來就用 `wsl.exe -d Ubuntu-24.04 --exec docker`，容器只發佈在 127.0.0.1，Windows 經 WSL localhost 轉送連得到。這條線不需要改任何設定。
- 精靈線：Windows 的 `docker` CLI 沒有引擎，這正是 pre6 W8 / W9 當年列 NEEDS-HUMAN 的原因。本單的做法如下，沒有新增 docker context、沒有新增 TCP 監聽、沒有改 daemon 或 `~/.ssh/config`：
  - 只在隔離實例 env 的 `Path` 最前面放一個測試專用的 `docker.exe`（Go 寫的，編譯到暫存目錄），轉送到 `wsl.exe -d Ubuntu-24.04 --exec docker …`。
  - 防護 1：`ps` 輸出只留本單容器。使用者那個正在跑的容器在精靈眼中不存在，「沿用既有容器」不可能選到它。
  - 防護 2：`inspect` / `start` / `stop` / `rm` / `exec` / `logs` / `port` / `run --name` 只要點名到不是本單的容器，一律拒絕（exit 1），不會送到 docker。BAT 用不到的子指令也拒絕。
  - 改寫（每次都記錄在 shim 日誌）：
    - `bat-server:latest` 換成本單映像 `bat-e2e-t0743-server:local`（`docker/Dockerfile`＋bundle 建成），這樣不會用到使用者的 `bat-server:latest`。
    - 加上 `--label bat.t0743=1`。
    - `-v C:\…` 轉成 `/mnt/c/…`。
  - `-p` 和其他參數原樣送出。精靈實際送出的 `docker run` 與轉送後的指令都附在 D1 證據。
  - 兩次跑下來，防護拒絕的次數都是 0。

**(b) gxdocker 不用的原因**

(a) 已經可行。而且精靈發佈的埠在 gxdocker 的 127.0.0.1 上，Windows 端要連必須另開 SSH 轉送，比 (a) 繞。

**server bundle**

- `gh release download server-bundle-v0.7.2-pre.8 -R gowerlin/better-agent-terminal` 的 `bat-server-linux-x64-v0.7.2-pre.8.tar.gz`，sha256 `47fee437391148ae97d5e3078e02a94704419c8284d4daf53d3d38da15566d85`（`sha256sum -c` OK），下載到暫存目錄。
- 沒有用 `dist-baseline/`：裡面是 0.6.1-pre.3，太舊。
- 受測桌面端：`npx vite build` 之後的 source build（app version 0.7.2-pre.8），一律在 `e2e/fixtures/electron-isolation.ts` 的隔離實例裡跑。沒有用安裝版（`BAT_E2E_EXECUTABLE` 未設）。

### 情境結果

**① BUG-097：PASS（D1、D5 各 ×2）**

D1（「建立新容器」完整跑完）：
- 精靈送出的指令（BAT 原文，`<使用者資料夾>` 為去識別化）：`docker run -d --name bat-server-profile --restart unless-stopped -p 127.0.0.1:9878:9876 -v <使用者資料夾>\AppData\Local\Temp\…\bat-e2e-t0743-mount:/workspace/bat-e2e-t0743-mount -v bat-server-bat-server-profile-data:/root/.local/share/bat-server bat-server:latest --port 9876 --token <token>`。第 2 次跑的埠是 9879。
- 埠綁定：`HostConfig.PortBindings` = `{"9876/tcp":[{"HostIp":"127.0.0.1","HostPort":"9878"}]}`，`docker port` = `9876/tcp -> 127.0.0.1:9878`。
- 健康檢查：health `healthy`，probe exit code 全為 0。HEALTHCHECK 是 TLS 探測（`require("tls").connect…`），不是舊的 `/health`。
- container 內 bind：entrypoint 是 `tini -- bat-server --bind-interface all`，container 內 listener 是 `00000000:2694`（0.0.0.0:9876），所以 docker 轉送連得到。
- 是否暴露：從 WSL 非 loopback 位址連這個埠 → `refused`；從 WSL 127.0.0.1 → `open`。
- 從 Windows 對 127.0.0.1:9878 做 TLS，指紋等於 profile 記下的 pin。精靈的 9 步全部 completed，寫出 profile `Docker bat-server-profile`（docker-linux，remotePort 9878）。

D5（T0427 舊映像那一半）：
- 「沿用既有容器」選到 entrypoint 是 `/opt/bat-server/bin/bat-server --port 9876`（沒有 `--bind-interface`）的容器時，精靈顯示 `containerLegacyImage` 警告。
- container 內只聽 `0100007F:2694`（127.0.0.1），透過發佈的埠做 TLS 得到 `ECONNRESET`，重現了 BUG-097 原本「連不上」的症狀。
- Cancel 後容器 id 不變，沒有 `rm` / `run`。

未涵蓋：
- T0427 的另一半「容器發佈在所有介面 → 警告」沒有實測，因為要測就得真的綁 0.0.0.0（這台機器的 WSL 走 mirrored 網路，非 loopback 位址就是 LAN 位址），本單規則禁止。這部分由 `detectContainerExposure` 的單元測試涵蓋。
- T0428 是純文件變更，不在本單實測範圍。

**② BUG-105：PASS（U4 ×2）**

在 docker-linux 遠端視窗（profile → 容器 `bat-e2e-t0743-t0514-srv`，mount `C:\bat-t0514-virt\work` ↔ `/work`）：
- `claude.scanSkills` / `claude.listSessions`（找到只有容器裡才有的 seeded session `5140d514-…`）。
- `github.listPRs` / `listIssues`：假 gh 回 `pwd=/work`。
- `gitScaffold.healthCheck` / `getRepoInfo` / `listCommits`：拿到 `T0514-REMOTE-MARKER`，gitRoot 回 client 形式 `C:\bat-t0514-virt\work`。
- `git.getLog`、`fs.readdir`：看到容器才有的標記檔。
- `worktree.create`：`worktreePath` = `/work/.bat-worktrees/t0514-wt`、`gitRoot` = `/work`；`worktree.remove` 成功。
- remote 終端回 `T0514-U4-bat-t0514-srv-/work-514`。
- 對照組：同樣路徑在本機視窗 `git.getLog` 回 `[]`。

依工單排除：`claude:start-session` 只經 spec 的 recorder 記錄參數，沒有實際啟動 Claude 再跑 `pwd`（spec 自己也標 `not exercised end to end — recorder only`）。全程沒有用真實模型，`claude:*` 都由 recorder 回應。

**③ BUG-111：PASS（D3、D4 各 ×2，D2 / D5 也有佐證）**

「使用者事先建立的容器」全部由本單建立，命名 `bat-e2e-t0743-user-*`，帶 volume `bat-e2e-t0743-user-*-data` 和檔案。容器裡跑 `sleep`、不跑 bat-server，讓 fetch-fingerprint 失敗，然後按 Cancel。

D3（原本在執行）：
- start-server 是 completed，fetch-fingerprint failed（`TLS handshake … ECONNRESET`）。
- Cancel 後 start-server rolled-back，精靈日誌：`Leaving Docker container bat-e2e-t0743-user-running running: it was running before setup.`
- 容器 id 相同、仍在執行、`StartedAt` 不變（沒有被重啟）；`/root/keep-root.txt`、`/data/keep.txt`、volume 都在。
- shim 記錄裡指名這個容器的只有 `inspect` / `start`（對執行中容器是 no-op）/ `exec`，沒有 `stop` / `rm`。

D4（原本已停止）：
- 精靈把它啟動（`start→0`），Cancel 後只把自己啟動的停回去（`stop→0`）。
- 容器 id 相同、狀態 `exited`，檔案和 volume 都在，沒有 `rm`。

**④ BUG-156（Docker 側）：PASS（D1、D2 各 ×2）**

- D1：實際送出的 `docker run -p` 是 `127.0.0.1:9878:9876`（第 2 次 9879），不是這個 BAT 的 RemoteServer 埠（隔離實例每次隨機取，例如 61135 / 57966），而且只綁 127.0.0.1。
- D2「沿用既有容器」的埠檢查：
  - 容器發佈的正是 RemoteServer 埠 → start-server failed，訊息含 `this BAT's own remote server is listening on`。
  - 容器沒有發佈埠 → `does not publish the BAT server port`。
  - 兩種情況 Cancel 後容器都維持 `created`、id 與 StartedAt 不變，shim 記錄裡沒有任何 `start` / `stop` / `rm` / `run` 點名它們。
- 本機選埠的邏輯依工單沒有重做（T0742 已驗）。

**⑤ BUG-107 / BUG-108（遠端視窗）：PASS（U7 / U8 remote ×2）**

在 docker-linux 遠端視窗：
- `webUtils.getPathForFile` 回兩個真實 client 路徑；合成 drop 之後出現圖片縮圖（`data:image/png;base64,…`）和文字檔 chip。
- `dialog.selectAttachments` 回 client 路徑加 dataUrl。
- 對照組：同一路徑經 proxied `image:read-as-data-url` 被容器拒絕（`Path access denied`），容器裡也沒有那個目錄。也就是附件是在 client 端讀的。

**其他（spec 一起跑到，全 PASS ×2）**：U1（BUG-113）、U6（BUG-106）、U9（BUG-109）、U5（BUG-096）、U2（BUG-112）、U3（BUG-110）。

**跑的次數**

- U 線：`npx playwright test e2e/pre6-ui-remote-acceptance.spec.ts`（`BAT_E2E_PRE6_UI=1`，source build）正式跑 2 次，都是 9 passed。
  - 第 2 次之前曾有一次作廢：`t0514-env.mjs up` 等 127.0.0.1:29514 釋放超過 15 s 而失敗，spec 用上一輪已停掉的容器設定跑，U6 得到 `ECONNREFUSED`（1 failed）。原因是 U3 停掉容器之後，WSL localhost 轉送釋放埠比較慢。之後重新 `up` 再跑就全綠。
- 精靈線：`npx playwright test e2e/t0743-docker-wizard.spec.ts`。
  - 最終版連跑 2 次 5 passed（約 1.1 分鐘）。
  - 開發過程的失敗：一開始選單 regex 沒考慮 🐳 圖示。D1–D4 版本跑過 2 次 4 passed。加上 D5 的第一版跑 2 次都失敗，原因是測試預期寫錯：從未啟動的容器被精靈啟動又停止後是 `exited`，Docker 無法回到 `created`。修正為比對「執行中與否」加上 `start→0`、`stop→0` 之後才是上面的最終 2 次。

### 資源比對

**比對方式**：開始前（2026-11-01T19:13:10+0800）與結束後各跑一次，在 WSL `docker` 列出 `ps -a`（id / 名稱 / 狀態）、`images`（id / tag）、`volume ls`、`network ls`，只記名稱與 id。

**比對結果**：`diff` 完全相同（各 1 個容器 / 35 個映像 tag / 9 個 volume / 4 個網路）。

**使用者正在跑的容器**：使用者容器（id `0479f0dd1b04`，名稱不寫：可能含專案名）從頭到尾都是 running，`StartedAt` 2026-11-01T09:10:46.8Z，RestartCount 0 不變。精靈 spec 每個情境結束都會比對一次「非本單容器的 id / 狀態 / StartedAt / RestartCount」，每次都相同。

**其他沒碰到的使用者資源**
- `bat-server:latest` / `bat-server:0.7.1-pre.6`：shim 改寫成本單映像，精靈完全沒用到。
- 先前其他測試留下的 `bat-t0514-srv:local` 等映像：本單改用 `--name-prefix`，沒有重新 tag 它們。
- 使用者的 WSL bat-server（9877）與 `WSL Ubuntu-24.04` profile。

**本單建立的資源（全部已清除）**

| 資源 | 名稱 | 清除 |
|---|---|---|
| 映像 | `bat-e2e-t0743-t0514-srv:local`、`bat-e2e-t0743-server:local`（每次跑重建、跑完 `rmi`） | 已清除 |
| 容器 | `bat-e2e-t0743-t0514-srv`、`bat-e2e-t0743-user-{port,nopub,running,stopped,legacy}`，以及產品自己命名的 `bat-server-profile` | 已清除 |
| volume | `bat-e2e-t0743-user-{running,stopped}-data`，以及產品自己命名的 `bat-server-bat-server-profile-data` | 已清除 |
| 網路 | 無 | — |

- 產品自己命名的兩個（`bat-server-profile`、`bat-server-bat-server-profile-data`）是精靈以空 profile 名稱寫死的，無法加前綴。spec 開始前先確認它們不存在（存在就拒跑），跑完刪除。
- 沒有用 `prune`。沒有 stop / rm 任何非本單資源。所有 `-p` 都只綁 127.0.0.1，用的埠事先確認沒被佔用。
- 今天沒有產生 dangling 映像（`images -a --filter dangling=true` 中 CreatedAt 是 2026-11-01 的有 0 筆）。`docker build` 留下的 build cache 不會出現在上面的清單裡；要清它只能 `builder prune`，本單規則禁止，所以保留。

**暫存與本機狀態**
- 暫存全部放在 `%TEMP%\bat-e2e-t0743-tmp`（bundle、shim、log、evidence、spec 的暫存目錄；執行時 `TEMP` / `TMP` 指向這裡），結束時整個刪除，確認不存在。
- 隔離實例的 runtime userData 每次都由 fixture 刪除（`runtime userData removed: true`），`%APPDATA%` 沒有 `runtime-e2e-t0743*` / `runtime-e2e-t0514*` 殘留。
- 有一次 Go 把 `/tmp/…` 解讀成 `D:\tmp\…`，建立了 `D:\tmp\bat-e2e-t0743-tmp`。`D:\tmp` 原本就存在（裡面有別的資料夾），只刪了我建立的那個子目錄。

### 發現的問題

沒有發現產品缺陷。以下是測試環境的觀察，不需要開 BUG：

- WSL localhost 轉送在容器停止 / 刪除之後，Windows 端的 127.0.0.1:<port> 會被佔住一段時間（超過 15 s）。`t0514-env.mjs up` 只等 15 s，緊接在 U3（會停掉容器）之後重跑時會失敗；隔一下再跑就好。要改的話可以加長等待時間，或改用 `--port`。本單沒有改。
- `pre6-wizard-acceptance.spec.ts` 會在真實的 `~/.ssh/config` 加區塊（跑完還原）。這違反本單「不改 `~/.ssh/config`」，所以本單沒有跑那支 spec，W8 的 Docker 側改由新 spec 的 D3 / D4 涵蓋。如果要把那支 spec 的 W9 / W8.docker 從 NEEDS-HUMAN 改成自動化，可以引用本單的 shim。是否要做，由塔台決定。
- 去識別化：工單 frontmatter `memory_overrides` 第 1 條（塔台撰寫、派工時已 commit）寫了 gxdocker 的 SSH 帳號名。依 D176，帳號名不應出現在公開的追蹤檔，請塔台處理。這不是本單寫入的內容，Worker 沒有改。

### BUG 結案建議

依 R-G003，驗證依據都是「測試環境實測」：source build 0.7.2-pre.8 + server-bundle-v0.7.2-pre.8 + WSL Docker 29.1.3，T0743 spec 各連跑 2 次全綠。

| BUG | 目前狀態 | 建議 | 依據 |
|---|---|---|---|
| BUG-097 | FIXED | **CLOSED** | D1：-p 127.0.0.1、container 內 bind all、TLS HEALTHCHECK healthy、非 loopback 位址連不到。D5：舊映像警告。T0427「發佈在所有介面」的警告沒有實測（原因見 ①），單元測試涵蓋；要把這一點也實機驗過，只能請使用者在隔離網路自行驗。 |
| BUG-105 | FIXED | **CLOSED** | U4 ×2：claude:*（scan-skills / list-sessions）、github:*、git-scaffold:*、worktree:create 都轉成 `/work`。`claude:start-session` 之後的 `pwd` 依工單排除，只驗到 recorder 收到的 cwd 參數（client 形式），沒有端到端驗證。 |
| BUG-107 | FIXED | **CLOSED**（遠端部分本單驗過；本機部分 T0742 驗過） | U7 remote ×2 |
| BUG-108 | FIXED | **CLOSED**（同上） | U8 remote ×2：附件在 client 讀；容器端 proxied 讀取被拒，作為對照 |
| BUG-111 | FIXED | **CLOSED** | D3 / D4 ×2（另有 D2 / D5 佐證）：rollback 不刪、不停原本在跑的容器；只停自己啟動的；資料與 volume 完整 |
| BUG-156 | FIXED | **CLOSED**（Docker 側本單驗過；本機選埠 T0742 驗過） | D1 ×2：publish 埠 ≠ RemoteServer 埠、只綁 127.0.0.1。D2 ×2：「沿用既有容器」遇到 RemoteServer 埠 / 未發佈埠時拒絕，而且不動容器 |

### 互動紀錄

- 沒有與使用者互動（yolo）。沒有向塔台提問：(a) WSL 端點可行，用不到 gxdocker；判讀上也沒有遇到需要塔台決定的點。
- 沒有使用子代理或 Workflow。
- 沒有發生 compact / resume。
- 沒有看到方法論注入（SessionStart 沒有注入方法論標記），也沒有呼叫方法論 skill。

### 回報時間

- 2026-11-01T19:35:50+0800
