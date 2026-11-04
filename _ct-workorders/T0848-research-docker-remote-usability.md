---
schema_version: 1
schema_kind: workorder
id: T0848
title: "研究：PLAN-052 Docker 遠端路線可用性（映像來源、Use existing 選容器與權杖、重跑精靈更新既有設定）的設計與拆單"
type: research
status: DONE
started_at: "2026-11-04T15:07:58+0800"
updated_at: "2026-11-04T15:15:57+0800"
completed_at: "2026-11-04T15:15:57+0800"
session_ids:
  - "95f1f108-5875-4b42-b872-3d4554faa366"
repo: better-agent-terminal
project: maintenance
priority: P3
sizing: M
created_at: "2026-11-04T15:06:25+0800"
depends_on: []
related:
  - "PLAN-052；D282；T0646（`/remote/docker` 改寫，後續建議 4、5）；T0743（WSL 內 Docker＋shim 驗收）；BUG-156 / T0649（挑埠，CLOSED）；PLAN-031（server bundle 發佈）；T0552 / T0554（`server-bundle-install-script.ts`）；PLAN-059 子項 E（不納入）"
affects_files:
  - _ct-workorders/T0848-research-docker-remote-usability.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 唯讀研究：只寫本工單檔，不改程式、不建檔、不開分支。可讀程式、跑唯讀指令與既有測試；可以查詢本機 `docker version` / `docker ps -a` / `docker images`（唯讀），不得建立、啟動、停止、刪除任何容器或映像，不得 `docker build` / `push` / `pull`；不連任何實際遠端主機、不碰本機 BAT 安裝版與它的 Terminal Server。"
  - "🔴 yolo：不得問使用者；問題依 ct-exec § Questions For Tower 問塔台（研究型提問上限依 `research_max_questions`）。不 push。Git：只 commit 本工單檔（`git add <明確路徑>`，不用 `-A` / `.`）。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
  - "公開 repo（D176）：回報區不寫真名、客戶名、家目錄路徑（寫 `<使用者資料夾>`）。"
---

# T0848 — 研究：Docker 遠端路線可用性（PLAN-052）

## 元資料

- **工單編號**：T0848
- **任務名稱**：研究：PLAN-052 Docker 遠端路線的設計與拆單
- **狀態**：DONE
- **類型**：research
- **互動模式**：enabled（yolo：問塔台）
- **intervention_type**：context-dependent
- **Renew 次數**：0
- **建立時間**：2026-11-04 15:06 (UTC+8)

## 研究目標

使用者決定 PLAN-052 先研究再拆單（D282）。目標是產出可以直接拆成實作工單的設計，讓一般使用者走得通 Docker 遠端精靈：

1. 精靈不必自己從原始碼建映像就能用。
2. 「Use existing」可以選容器，並且拿得到權杖。
3. 重跑精靈時更新既有設定，不再新增一筆。

## 已知資訊（2026-11-02 第一百零五 session 核對，見 PLAN-052〈狀態核對〉）

- 精靈預設映像是 `bat-server:latest`（`src/components/setup-wizard/docker-flow.ts:12`），只能用 `npm run build:docker-image`（`docker/Dockerfile`、`scripts/build-docker-image.mjs`）自己建。沒有 workflow 推送映像。
- 「Use existing」取 `containers[0]`（`src/components/setup-wizard/steps/docker/pick-container.ts:75`）。精靈建立的容器以 `--token` 帶權杖、沒寫 `server-token.json`（程式碼推論），之後以 Use existing 接回時可能讀不到權杖。
- Docker 分支寫設定一律 `profile.create`（`src/components/setup-wizard/steps/wsl/write-profile.ts`）；WSL / SSH 有 `findExistingProfiles`，Docker 沒有。
- `src/components/setup-wizard/steps/docker/` 已有 `install-server-bundle.ts`：先查清楚它現在做什麼，和「把伺服器套件裝進任意容器」差多少。
- BUG-156（挑埠）已 CLOSED（T0649）。T0743 用 WSL 內的 Docker＋測試用 `docker.exe` shim 驗收，繞過了上面三點。目前沒有使用者卡住的回報。
- **不納入**：PLAN-059 子項 E（SSH stdio、遠端不開埠、暫時沙箱），使用者決定維持只記錄。

## 調查範圍與要回答的問題

1. **現況盤點**：寫出 Docker 精靈每一步的實際流程（`steps/docker/*`、`docker-flow.ts`、對應的 IPC / main 端 handler）：建新容器與 Use existing 兩條路徑各自怎麼取得映像、怎麼啟動 bat-server、權杖與憑證放哪、怎麼寫設定。標出 PLAN-052 的三個問題在程式碼的實際位置，並確認「讀不到權杖」這個推論是否成立。
2. **映像 / 伺服器來源（主要比較項）**：比較三種做法，每種列出工作量（S / M / L）、維護成本（每次發版要做什麼）、使用者步驟、離線 / 企業網路下能不能用、與現有 `server-bundle-v<版號>` 發佈線（D120 / D146）和 distributor（`electron/remote/server-bundle-distributor.ts`）的關係：
   - (a) release workflow 推 GHCR 映像（`ghcr.io/gowerlin/...`）：權限、多架構（amd64 / arm64）、版號 tag、`latest` 規則、預覽版要不要推。
   - (b) release asset 放 `docker save` 的 tar，精靈下載後 `docker load`：大小、驗證（sha256 sidecar）。
   - (c) 不發佈映像，精靈把已下載的 server bundle 裝進使用者指定的容器（共用 `electron/server-bundle-install-script.ts`）：容器要有什麼（glibc / musl、架構、`tar`、可寫目錄、bundle 內 node 能不能跑）、bat-server 在容器裡怎麼常駐（沒有 systemd）、容器重啟後怎麼回來。
   最後給一個推薦，並說明理由。
3. **Use existing 選容器**：UI（清單欄位：名稱、映像、狀態、埠；空清單與停止中的容器怎麼處理）、選完後權杖 / 憑證指紋怎麼取得（讀容器內檔案、`docker exec`、重新簽發），以及與 TOFU 指紋（PLAN-018）的關係。
4. **重跑精靈更新設定**：怎麼辨識「同一個」Docker 設定（容器 id / 名稱 / 埠 / 映像），比照 WSL `findExistingProfiles`；容器被刪掉重建時怎麼處理；與多 profile 同時連線（PLAN-039）是否衝突。
5. **安全**：權杖不進命令列與日誌（`--token` 目前出現在 `docker run` 參數，會出現在 `docker inspect` 與程序列表，要評估）、容器內權杖檔權限、bind 介面（只綁 localhost 的埠映射）。
6. **測試策略**：哪些可以單元測試；哪些需要 e2e（既有 Docker / WSL e2e 基礎設施與 T0743 的 shim）；CI 上有沒有 Docker 可以用。

## 研究指引

- 先讀 T0646 與 T0743 的回報區（`_ct-workorders/_archive/workorders/`）、`docs/agent-guide/multi-remote-profiles.md`、`docs/agent-guide/remote-security.md`、`docs/agent-guide/packaging-release-checks.md`（server bundle 一節）、`docs/server-bundle-distribution.md`，以及網站 `/remote/docker` 頁的原始檔。
- 結論要能拿來做決定：每題給建議值與理由，並列出需要使用者決定的事項（例如映像來源、預覽版要不要推映像）。

## 預期產出（寫在回報區）

- 〈調查結論〉：逐題回答（附 `檔案:行`）。
- 〈建議方向〉：映像來源三選一的比較表與推薦；Use existing 與重跑精靈的設計。
- 〈建議下一步〉：拆成實作工單，每張寫範圍、`affects_files` 預估、規模 S / M / L、依賴、能否並行、驗收方式。另列需要使用者裁決的問題。

---

## 回報區

### 完成狀態

- **狀態**：DONE（研究結論已可拆單；需要使用者裁決的事項列在〈需要使用者裁決〉）。
- **一句話結論**：三個問題中，「Use existing 讀不到權杖」**這個推論不成立**：精靈建立的容器會把 `--token` 寫進 `server-token.json`，本單已實測。真正的問題是：不能選容器、權杖讀取時機與錯誤訊息、`--token` 外露、重跑精靈只新增設定，以及**映像沒有發佈**。映像來源推薦 **(c′) 不發佈映像**：由精靈用「基底映像＋server bundle volume」建立容器，server bundle 沿用 PLAN-031 distributor 下載、cache 或匯入，與 WSL / SSH 共用 `server-bundle-install-script.ts`。
- **產品程式碼**：沒有改。只改了本工單檔。
- **落點檢查**：PASS。
  - C-0：`repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`。
  - C-1：工單在 REPO_ROOT 底下。
  - C-3：只有本工單檔，屬於 `_ct-workorders/`，不適用。
  - C-2：工單沒有 `branch` 欄位（目前在 `main`）。
  - 沒有 `CT_HOME`，不是 worktree。
- **BAT 環境**：`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`；`BAT_REMOTE_TOKEN` 已設定；`CT_MODE` = yolo；`CT_INTERACTIVE` = 0。
- **session_id**：95f1f108-5875-4b42-b872-3d4554faa366
- **commit**：只 commit 本工單檔（hash 見塔台收單時的 git log；本單沒有產品 commit）。沒有 push。

### 執行過的指令與實測（唯讀證據）

- **本機 Docker（唯讀）**：`docker version` 只有 client 29.9.2，沒有 engine（`npipe:////./pipe/docker_engine` 不存在），與 T0743 記錄的情況相同。所以 `docker ps -a` / `docker images` 都無法查詢。沒有建立、啟動、刪除任何容器或映像。
- **server bundle 大小**：`gh release view server-bundle-v0.7.4-pre.8 -R gowerlin/better-agent-terminal`（唯讀）。
  - `linux-x64` 199,968,888 bytes（約 191 MiB）
  - `linux-arm64` 198,863,738 bytes
  - `darwin-arm64` 182,818,606 bytes
- **權杖寫檔實測**：在 scratchpad 暫存目錄（repo 外，跑完已刪除）寫了一支 `tsx` 腳本。腳本以 `createHeadlessServer({ dataDir: <暫存目錄>, port: 0, bindInterface: 'localhost', token: 'probe-token-…' })` 啟動 server，讀出 `server-token.json` 後停止：
  - 結果：`file exists; keys= v,encrypted,data encrypted= false dataMatchesFlag= true`
  - 也就是帶 `--token` 啟動時，檔案照樣寫入，內容是 `{v:1, encrypted:false, data:<旗標值>}`。
  - 範圍：只在本機起了一個綁 localhost、隨機埠的測試 server，幾秒後停止。沒有碰 BAT 安裝版或它的 Terminal Server。
  - 這是 repo 外的暫存檔，工單「不建檔」指的是 repo 內，特此說明。

### 調查結論

#### 1. 現況盤點（`docker-flow.ts:14-25` 的 9 步）

| # | 步驟 | 建立新容器 | 沿用既有容器 |
|---|---|---|---|
| 1 | `detect-env`（`steps/wsl/detect-env.ts:23-37`） | `docker:status` = `docker --version` + `docker info` | 同左 |
| 2 | `pick-container`（`steps/docker/pick-container.ts:88-154`） | 名稱 `bat-server-<profile slug>`，同名已存在時加 `-2`…`-99`（`resolveNewContainerName` `:183`）；映像沿用 `state.dockerImage`，預設 `bat-server:latest`（`docker-flow.ts:12`、`:151`） | **`containers[0].name`（`:136`）**：`docker ps -a` 第一列，沒有選擇 UI |
| 3 | `configure-mounts`（`configure-mounts.ts:16-55`） | 資料夾挑選 → `/workspace/<basename>`，只能選一個 | 同左，但**不會套用到容器**，只存進 profile 給路徑轉換用；與容器實際的 mount 不比對 |
| 4 | `install-server-bundle`（`steps/docker/install-server-bundle.ts:27-60`） | 只記 `/opt/bat-server`、`bundleSource = 'image-baked'`，不寫入任何檔案 | `docker inspect` 有 image 就通過，另加 `existingNeedsBundle` 警告；**不檢查容器裡是否真的有 bundle** |
| 5 | `start-server`（`start-server.ts:63-138`；main `docker-lifecycle.ts:233-293`） | `pickDockerServerPort`（挑一個空埠並排除 RemoteServer 的埠，`:181-231`）→ `docker run -d --name … --restart unless-stopped -p 127.0.0.1:<P>:9876 -v <mount> -v bat-server-<name>-data:/root/.local/share/bat-server <image> --port 9876 --token <token>`（`:258-268`）；token = `randomBytes(16)`（`:253`）→ 等 healthy，最多 45 s（`start-server.ts:16-29`） | 沿用容器已發佈的 `9876/tcp` 埠（`publishedServerPort` `:156`）→ `detectContainerExposure` → `docker start` → **緊接著** `docker exec <name> cat /root/.local/share/bat-server/server-token.json`（`:284`，`allowFailure`）→ `parsePersistedToken`（`:68`）→ 等 healthy |
| 6 | `fetch-fingerprint`（`steps/wsl/fetch-fingerprint.ts:56-89`） | main 對 `127.0.0.1:<P>` 做 TLS handshake 取指紋，也就是 TOFU，重試 5×1 s | 同左 |
| 7 | `connect-test`（`connect-test.ts:153-190`） | `remote:test-connection(localhost, P, token, fingerprint)` | 同左；token 是空的就丟 `PRECONDITION_MISSING`（`:159`） |
| 8 | `write-profile`（`write-profile.ts:202-237`） | **一律 `profile.create`** → `profile.update(targetOS / dockerContainer / dockerMounts / token / fingerprint)` | 同左 |
| 9 | `done` | — | — |

- **映像從哪來**：建立新容器時由 `docker run` 隱含 pull。`bat-server:latest` 沒有任何 registry 發佈（`.github/workflows/*` 沒有一支用到 docker），只能 `npm run build:docker-image` 自己建（`scripts/build-docker-image.mjs:12-17`，只有 linux/amd64）。
  - 映像內容（`docker/Dockerfile`）：`debian:bookworm-slim` + `ca-certificates curl tini` + 解開的 bundle，以 root 執行。
  - 🔴 **映像裡沒有 git**：Agent 在容器裡連 `git` 都沒有。這是 Docker 路線另一個可用性問題，T0646 / PLAN-052 都沒提到。
- **權杖與憑證放哪**：data volume `bat-server-<container>-data` 掛在 `/root/.local/share/bat-server`，也就是 headless 的預設 dataDir（`electron/remote/dataDir.ts:28-31`，root 的 HOME）。
  - `server-token.json` 由 `RemoteServer.start` → `persistToken`（`electron/remote/remote-server.ts:600`、`:881`、`:553-560`）在**每次啟動**寫入，帶 `--token` 時也一樣；headless 有設 `remoteServer.configDir = opts.dataDir`。
  - plaintext 策略寫成 `{v:1,encrypted:false,data}`、mode 0600（`electron/remote/secrets.ts:42-45`、`:190-193`）。
  - 憑證 `server-cert.json` 放在同一個目錄。
- **「讀不到權杖」推論 → 不成立**（實測見上；`docs/docker-deployment.md:135-139` 原本也寫「traced from the code, not tested」，現在有實測佐證）。仍然會讀不到權杖的情況：
  1. 容器第一次啟動（從未跑過）時，`docker start` 後立刻 `exec cat`，server 可能還沒寫檔（`docker-lifecycle.ts:283-284` 在等 healthy **之前**讀）。
  2. 容器不是以 root 跑 server、帶了 `--data-dir`、或設了 `XDG_DATA_HOME`：路徑寫死在 `/root/.local/share/bat-server`。
  3. 容器裡沒有 bat-server。不過這種情況在第 5 步的埠檢查或第 6 步就會先失敗。
  4. 讀不到時 `allowFailure` 不報錯，最後在 connect-test 顯示「Remote server token was not available after starting the BAT service」，**看不出原因**。
- **死碼**：`window.electronAPI.docker.execCommand` 只在型別中宣告（`src/types/electron.d.ts:517`），preload / main 都沒有實作。`install-server-bundle.ts:76` 的 rollback 呼叫它，但因為 `bundleInstalled` 永遠是 `false`，實際上走不到。改成 (c′) 時要補實作或改寫。

#### 2. 映像 / 伺服器來源比較

(c) 有一個前提限制：**任意既有容器裝不了**。原因：

- BAT 只經 `127.0.0.1:<P>` → 容器 `9876` 的埠映射連線（`DOCKER_PUBLISH_HOST`，BUG-097）。
- 既有容器建立後**不能再加埠映射**。
- Docker Desktop 上，主機也連不到容器 IP。

所以把 bundle 裝進「使用者自己的既有容器」，只有在那個容器剛好發佈了 `9876/tcp` 時才可行。否則就得改走 stdio 通道，那是 PLAN-059 E，不納入。

因此 (c) 的可行形式是 **(c′)**：建立新容器時，由 BAT 用「使用者選的基底映像」建立容器，bundle 放在 volume 裡。

| | (a) GHCR 映像 | (b) release asset `docker save` tar | (c′) 基底映像＋bundle volume（推薦） |
|---|---|---|---|
| 做法 | release / pre-release 加一個 job：`docker buildx` 分架構建置（amd64 `ubuntu-22.04`、arm64 `ubuntu-22.04-arm`，兩種 runner 已在 server-bundle matrix 裡，`release.yml:64-68`）→ push `ghcr.io/gowerlin/bat-server:<版號>` + manifest list；精靈預設映像改成 `ghcr.io/…:<去後綴版號>` | 同樣建映像，`docker save \| gzip` 兩個架構 + `.sha256` 放進 release；精靈下載 → 驗 sha256 → `docker load` | 精靈：`docker pull <基底映像>`（預設見 U2）→ 建 volume `bat-server-<name>-bundle` → `docker run --rm -i -v <vol>:/opt/bat <基底> sh -c '<buildSshBundleInstallCommand("/opt/bat/server")>'`，tarball 走 stdin → 相容性探測 `bin/node -e 1` → `docker run -d --init --entrypoint /opt/bat/server/bin/bat-server --health-cmd <同 Dockerfile 的 TLS 探測> -p 127.0.0.1:P:9876 -v <bundle vol>:/opt/bat -v <data vol>:/var/lib/bat-server <基底> --bind-interface all --port 9876 --data-dir /var/lib/bat-server` |
| 工作量 | M（workflow + 精靈改預設映像 + 拉映像步驟 + 文件；要發一次版才驗得到） | M–L（workflow + 下載 / 驗證 / 串流 `docker load` 的 IPC + 匯入按鈕） | L（拆兩張 M：main 端 docker 原語、精靈步驟；見〈建議下一步〉） |
| 每次發版的維護 | 多一個 job（約 5–10 min，估計）；GHCR 每版各架構約 200 MiB 起（以 bundle 191 MiB + bookworm-slim 推估），pre-release 很頻繁，需要保留 / 清理策略；第一次 push 後要手動把 package 設成 public 並連結 repo；基底映像的安全更新被凍結在發版當時 | 多一個 job；release 每版多約 400+ MiB（兩架構，推估），而且與 server bundle 內容重複 | **零**：不新增 release 產物，CI 不變，沿用既有 `server-bundle-v<版號>` 三架構（D120 / D146） |
| 使用者步驟 | 精靈自動 pull（約 200 MiB，目前 `docker run` 隱含 pull，沒有進度也沒有 timeout，要改成明確的 pull 步驟） | 精靈自動下載並 load | 精靈自動：基底映像 pull（bookworm-slim 約 30 MiB，推估）＋bundle 下載（191 MiB，有 cache） |
| 離線 / 企業網路 | 要能連 ghcr.io；不行就手動 `docker save` / `load` | 可以做「匯入本機 tar」（比照 T0547） | **最好**：bundle 沿用既有的「匯入本機 tarball…」與 `BAT_SERVER_BUNDLE_BASE_URL`（`docs/server-bundle-distribution.md`）；基底映像可以填內部 registry 的任何映像 |
| 版號對齊 | 精靈要算出對應的 tag；pre-release 不推就對不上（沒有版本相容檢查，`bundleVersion` 只回報，`remote-server.ts:353`） | 同左 | 自動與 app 版號一致（distributor 本來就用去後綴版號，`stripSnapshotSuffix`） |
| 升級 | 換新映像 → 必須重建容器（data volume 保留就沿用權杖與憑證） | 同左 | **重跑精靈**：在 bundle volume 內以 `.bat-new` / `.bat-old` 換版，與 WSL / SSH 同一套 T0552 / T0554 規則，再 `docker restart`；容器、掛載、權杖、憑證都不變 |
| 多架構 | 要建 manifest list | 兩個 tar | 依 daemon 架構選 bundle（`docker version --format {{.Server.Arch}}` → `normalizeArch`，`src/lib/arch-normalize.ts`） |
| Agent 的工具 | 映像要另外加 git 等工具，每加一個都是維護成本 | 同左 | **使用者可以選自己的開發映像**（有 git / 語言工具鏈），解掉「容器裡沒有 git」 |
| 限制 | — | — | 基底映像要 glibc ≥ 2.35（bundle README 標示的下限，`scripts/build-server-bundle.mjs:58`）、`/bin/sh`、`tar` + `gzip`；musl / Alpine 不行，要靠探測擋下並給明確訊息；Docker Hub 匿名 pull 有次數限制 |

**推薦 (c′)，理由**：

1. 完全沿用 PLAN-031 的發佈線與 distributor（cache、sha256 sidecar、離線匯入、私有 base URL），不另開第二條發佈線，也沒有 GHCR 保留策略要管。
2. 每次發版零維護；版號一定與 app 一致。
3. 升級改成「重跑精靈」，與 WSL / SSH 一致，順便解掉第 4 題。
4. 使用者能選有工具鏈的映像，這是 Docker 路線的主要價值（每個專案獨立環境）。

既有 `docker/Dockerfile` / `bat-server:latest` 保留，當作進階或開發路徑：用它建的容器照樣可以「沿用既有容器」。

(a) 是次選：工作量較小、首次設定最快，但每版都有維護與儲存成本，離線也最差。

#### 3. 「Use existing」選容器

- **清單資料**：`listContainers`（`electron/docker-detect.ts:58-71`）多取 `Ports`、`Labels`、`CreatedAt`（`docker ps -a --format '{{json .}}'` 本來就有這些欄位），並補上 timeout。🔴 目前沒有 timeout，違反 CLAUDE.md「Child Process Spawning」。
- **UI**：沿用 `ctx.requestChoice`（`wizard-runner.ts:37-51`），每個容器一個選項：
  - label = 名稱
  - description = 映像 · 狀態（running / exited）· 發佈埠（`127.0.0.1:P→9876` / 「未發佈 9876」）· 「BAT 建立」（label `bat.server=1`，由建立新容器時加上）
  - 排序：BAT 建立、可用、執行中的排前面。
- **不可用的容器**：沒有發佈 `9876/tcp`，或發佈埠等於 RemoteServer 埠。這兩個判斷就是現在 `pickDockerServerPort` 在第 5 步才報的兩種錯（`docker-lifecycle.ts:201-214`），改成在選單階段就判斷。
  - 建議 `WizardChoiceOption` 加 `disabled?: boolean` + `reasonKey?`，顯示但不能選。不加的話，就只列可用的，並在說明裡列出被略過的數量。
- **空清單或全部不可用**：不顯示「沿用既有容器」，或顯示說明＋「改用建立新容器」，取代現在的 `docker-no-containers` 錯誤（`pick-container.ts:133`）。
- **停止中的容器**：可以選；沿用現有行為：精靈啟動它，取消時只停回自己啟動的（BUG-111 / T0444，T0743 D4 已驗）。
- **掛載**：「沿用既有容器」改成從 `docker inspect` 的 `Mounts`（type=bind）帶出 host ↔ container 對照，預設不開資料夾挑選、讓使用者確認。這樣解掉現在「選的資料夾和容器實際 mount 對不上，路徑轉換就錯」的問題（`docs/docker-deployment.md:128`）。
- **權杖取得**（建議順序，全部在 main 端，只回傳 token 本身）：
  1. 等 healthy **之後**才讀（解掉第一次啟動的時序問題）。
  2. 路徑：`docker inspect` 的 `Config.Cmd` / `Entrypoint` 有 `--data-dir <d>` 就用 `<d>/server-token.json`；否則依 `Config.Env` 的 `XDG_DATA_HOME` / `HOME` 推算；最後用 `/root/.local/share/bat-server`。
  3. 舊容器 fallback：檔案讀不到、但 `Config.Cmd` 有 `--token <t>` → 用 `<t>`（只在 main 解析）。
  4. 都沒有 → 新錯誤碼 `docker-token-unavailable`，附可做的事（確認容器跑的是 bat-server、`docker logs`），取代現在的 `PRECONDITION_MISSING`。
  - **不重新簽發**：改權杖要重啟容器內的 server 或改容器設定，違反「不動使用者容器」（BUG-111）。
- **與 TOFU（PLAN-018）的關係**：維持現在的 handshake 取指紋。可選的強化：另外以 `docker exec cat <dataDir>/server-cert.json`、在 main 算 SHA-256，與 handshake 指紋比對，可以擋下「127.0.0.1:P 上其實是別的程序」。成本低，列為 W2 的可選項；`server-cert.json` 的格式要在實作時確認。

#### 4. 重跑精靈更新設定

- **辨識鍵**：`targetOS === 'docker-linux'` && `dockerContainer === <容器名稱>` && `isLoopbackHost(remoteHost)`。
  - **不含埠**：同一個 daemon 上容器名稱唯一，一個容器只有一個 server。重建容器時埠可能重挑（每次執行都從 9877 起挑空埠，`pickServerPort`），把埠當鍵會在重建後誤判成新設定。
  - 寫法比照 `findExistingProfiles` / `updateExistingProfiles`（`write-profile.ts:51-91`），直接共用（docker 分支在 `:202`）。
  - 更新欄位：`remotePort`、`remoteToken`、`remoteFingerprint`、`dockerMounts`、`targetOS`；名稱保留（T0552 慣例）。
- **容器刪掉再重建**：建立新容器時名稱已空出來，會用回同一個 `bat-server-<slug>` → 對到同一筆設定 → 更新。
  - data volume `bat-server-<name>-data` 在 `docker rm` 後還在，所以權杖和憑證不變，實際只更新埠與掛載。
  - 舊容器還在時，新容器名稱會變成 `-2`，那是另一個容器 → 新增設定，這樣是對的。
- **與 PLAN-039 多 profile 同時連線**：不衝突。`profile:update` 指紋改變時只斷開該 profile 的連線（T0463，`electron/main.ts:3756-3763`），視窗再以新 pin 重連；其他 profile 不受影響。
- **已知限制**：profile 沒有記 docker context / `DOCKER_HOST`（`dockerHost` 欄位存在，但精靈從不寫入，`electron/main.ts:3631`）。切換 context 後同名容器會被誤認為同一個。目前精靈不支援多 context，只記錄、不處理。

#### 5. 安全

- **`--token` 外露**（`docker-lifecycle.ts:268`）：權杖會出現在：
  - `docker inspect`（`Config.Cmd` / `Args`）
  - Docker Desktop 的容器詳情
  - 容器內 `ps`（node argv）
  - `docker run` 執行那一刻的主機程序列表
  - 能 `docker inspect` 的人本來就能 `docker exec`，所以**不是提權**。但權杖會流進診斷資料、截圖、`docker inspect` 輸出的分享。
  - **建議：建立新容器不再帶 `--token`**。server 第一次啟動自己產生並寫檔（`loadOrGenerateToken`，`headless-entry.ts:1248-1256`，32 bytes base64url，比現在的 16 bytes hex 強），精靈在 healthy 後經 `docker exec cat` 讀取，與「沿用既有容器」同一條路徑。
  - 既有以 `--token` 建立的容器不動，靠第 3 題的 fallback 接回。
- **權杖檔權限**：`server-token.json` 是 0600（`secrets.ts:192`）。dataDir 由 `fs.mkdirSync(..., { recursive: true })` 建立（`headless-entry.ts:1259`），權限隨 umask。(c′) 改用明確的 `--data-dir /var/lib/bat-server`，建議實作時一併確認 `server-cert.json`（含私鑰）的 mode，並把目錄設成 0700。
- **bind**：維持 `-p 127.0.0.1:P:9876`（`DOCKER_PUBLISH_HOST`，不得放寬），容器內 `--bind-interface all`（BUG-097，T0743 D1 已驗）。(c′) 的 `docker run` 參數由 main 的純函式組出，單元測試要斷言：只綁 127.0.0.1、沒有 `--token`。
- **IPC 外露**：`docker:inspect-container` 把容器的 `Config.Env` 整串回傳給 renderer（`docker-detect.ts:103`）。使用者容器的 env 可能有密鑰，而 renderer 沒有任何地方用到它（只用 `image` / `state`）→ 建議從回傳中移除。
- **日誌**：`execDocker` 不記參數（`docker-lifecycle.ts:46-66`），維持；新增的權杖讀取與舊容器 `--token` 解析都不得記值。

#### 6. 測試策略

- **單元（vitest，CI 會跑）**：
  - 純函式：容器選單 `buildDockerContainerChoices(containers, activeServerPort)`、權杖路徑推算與舊容器 `--token` 解析、docker 分支辨識鍵、(c′) 的 `docker run` / `docker run --rm -i` 參數組裝。
  - main 端以既有的 `setExecFileImplForTests` 模式 mock `docker`（`electron/__tests__/docker-lifecycle.test.ts`、`docker-server-port.test.ts`）。
  - 精靈流程沿用 `src/components/setup-wizard/__tests__/docker-flow.test.ts`。
  - 安裝腳本沿用 `electron/__tests__/server-bundle-install-script.test.ts`（(c′) 只換 root `/opt/bat/server`）。
  - headless 權杖寫檔建議補一條「帶 `opts.token` 時 `server-token.json` 寫入且內容相同」到 `electron/remote/__tests__/headless-server.test.ts`。本單的探測腳本就是它的雛形。
- **e2e**：延伸 `e2e/t0743-docker-wizard.spec.ts`（opt-in `BAT_E2E_T0743_DOCKER=1`，WSL Docker ＋ `e2e/real-remote/t0743-docker-shim.go`）。
  - shim 要放行新的子指令（`pull`、`volume create/rm`、`run --rm -i`、`exec -i`、`version --format`）並維持兩道防護。
  - 情境：
    - 以基底映像建立新容器（含離線匯入 bundle）
    - 選單選第二個容器
    - 沒有 `--token` 的權杖讀取
    - 重跑精靈後 profile 數不變
    - 重跑升級後 bundle 換版、data 不變
    - musl 映像被探測擋下
- **CI 上的 Docker**：GitHub `ubuntu-24.04` runner 預裝 Docker Engine。`tests.yml` 跑在 `ubuntu-24.04`（`tests.yml:14`），但目前沒有任何 job 用 docker。
  - 建議另開 `docker-acceptance.yml`（`workflow_dispatch`，比照 `linux-acceptance.yml`），用 node 層腳本直接呼叫 main 端 docker 函式，對真 docker 跑 (c′) 的建立 / 升級 / 回復。不跑 Electron UI。
  - 不放進發版關卡（bundle 建置約數分鐘，flaky 風險在 docker pull）。

### 建議方向

1. **映像來源**：(c′)（比較表見上）。精靈第 4 步從「確認」改成真正安裝（distributor → volume），第 5 步改成以基底映像建立容器。`bat-server:latest` 不再是預設，但仍可在「映像」欄位手動填入；填的若是內建 bundle 的映像，就略過安裝。
2. **Use existing**：容器選單＋可用性判斷＋從 inspect 帶出掛載＋健康後讀權杖＋三段式權杖取得＋明確錯誤碼。
3. **重跑精靈**：以容器名稱辨識並更新；(c′) 下重跑等於升級。
4. **安全**：不再帶 `--token`、移除 inspect 的 env 外露、docker 指令補 timeout。

### 建議下一步（拆單）

| 單 | 範圍 | `affects_files`（預估） | 規模 | 依賴 | 並行 | 驗收 |
|---|---|---|---|---|---|---|
| **W1** 權杖與安全修正（不動映像來源） | 建立新容器不帶 `--token`，healthy 後 `exec cat` 讀；權杖讀取移到等 healthy 之後；data-dir 推算＋舊容器 `--token` fallback＋`docker-token-unavailable`；`docker:inspect-container` 移除 env；`listContainers` / `execDocker` 補 timeout（pull / run 例外另訂）；headless 權杖寫檔單元測試 | `electron/docker-lifecycle.ts`、`electron/docker-detect.ts`、`src/components/setup-wizard/steps/docker/start-server.ts`、`src/components/setup-wizard/error-mapper.ts`、`src/types/electron.d.ts`、`electron/preload.ts`、i18n、對應 `__tests__`、`electron/remote/__tests__/headless-server.test.ts` | S–M | — | 可與 W3 並行 | `test:unit`、兩個 typecheck = 0、`npx vite build`；T0743 spec D1 / D2 / D5 重跑 |
| **W2** Use existing 選單＋掛載帶出 | `listContainers` 多 Ports / Labels / CreatedAt；`buildDockerContainerChoices`；`WizardChoiceOption.disabled` / reason（Shell 顯示）；建立新容器加 label `bat.server=1`；沿用既有容器時從 inspect 帶出 bind mounts；可選：cert 指紋交叉比對 | `electron/docker-detect.ts`、`pick-container.ts`、`configure-mounts.ts`、`wizard-runner.ts`、`SetupWizardShell.tsx`、`electron/docker-lifecycle.ts`（label）、i18n、tests | M | W1（同改 `docker-detect.ts` / `docker-lifecycle.ts`，循序） | 與 W3 並行 | 單元＋T0743 spec 新增「選第二個容器」 |
| **W3** 重跑精靈更新設定 | docker 分支改用 `findExistingProfiles`（鍵：容器名稱＋loopback）＋`updateExistingProfiles`；rollback 沿用 | `src/components/setup-wizard/steps/wsl/write-profile.ts`、其 `__tests__` | S | — | 可與 W1 / W2 並行 | 單元：同名更新、`-2` 新增、rollback 還原；e2e 重跑後 profile 數不變 |
| **W4a** (c′) main 端 docker 原語 | `docker:pull-image`（帶進度、可中止）、`docker:server-arch`、volume 建立 / 刪除（含 ownership）、`docker:install-bundle-into-volume`（`docker run --rm -i`、stdin 串流 tarball、重用 `buildSshBundleInstallCommand` 與 restore / discard，root `/opt/bat/server`）、相容性探測（`bin/node -e 1`，辨識 glibc / musl）、`buildBatContainerRunArgs`（`--init`、`--entrypoint`、`--health-cmd`、`--data-dir`、`-p 127.0.0.1`、label、無 `--token`）；補實作或移除 `docker.execCommand` | `electron/docker-lifecycle.ts`（或新 `electron/docker-bundle-volume.ts`）、`electron/main.ts`、`electron/preload.ts`、`src/types/electron.d.ts`、`electron/server-bundle-install-script.ts`（如需 root 參數化）、tests | M | W1 | 與 W2 / W3 並行（W2 的 label 改動要協調） | 單元（mock execFile）；`docker-acceptance.yml` 或手動 WSL Docker 實測 |
| **W4b** (c′) 精靈步驟 | 基底映像欄位（預設見 U2，可填自訂）；第 4 步改成 distributor → volume 安裝（沿用「匯入本機 tarball…」）；第 5 步以基底映像建立；重跑＝升級（換 bundle → `docker restart`，取消還原）；rollback 涵蓋 bundle volume；`bat-server:latest` 等內建 bundle 映像略過安裝 | `docker-flow.ts`、`steps/docker/*`、`SetupWizardShell.tsx`、`server-bundle-import.ts`（renderer）、i18n、tests | M | W4a、W2、W3 | — | 單元＋T0743 spec 延伸（建立 / 升級 / musl 擋下 / 離線匯入） |
| **W5** 文件與網站、驗收基礎設施 | `site/remote/docker.md`（拿掉「需要自己建置映像」警告、選單、更新設定、升級）、`docs/docker-deployment.md`、`docs/server-bundle-distribution.md`（Docker 改走 distributor，修正 D096 敘述）、CLAUDE.md 一節；T0743 shim 放行新子指令；可選 `docker-acceptance.yml` | 上列文件、`e2e/real-remote/t0743-docker-shim.go`、`e2e/t0743-docker-wizard.spec.ts`、`.github/workflows/docker-acceptance.yml` | M | W1–W4b | 文件可在 W4b 後；workflow 可與 W4a 並行 | 文件審閱；e2e 兩次全綠 |

- W1 / W3 規模小、可以先做，不用等映像來源裁決。W1 修的是現有流程（權杖外露、等待時序、錯誤訊息），不管選哪個來源都需要。
- 若使用者改選 (a)：W4a / W4b 換成「W4′ release / pre-release 推 GHCR（M）＋精靈預設映像改 ghcr＋明確 pull 步驟（S–M）」；W1–W3、W5 不變。
- 依 D152，BAT 不跑依賴安裝；(c′) 只裝 BAT 自己的 bundle，不碰基底映像的套件。

### 需要使用者裁決

- **U1 映像來源**：(c′) 基底映像＋bundle volume（**推薦**）／(a) GHCR／(b) release tar。
- **U2 (c′) 的預設基底映像**：
  - `debian:bookworm-slim`：最小，但與現在一樣沒有 git。
  - 有 git / curl / ssh 的官方映像，例如 `buildpack-deps:bookworm-scm`。**推薦這個**，因為 Agent 需要 git；實際大小與內容在 W4b 確認。
  - 兩種都可以讓使用者改填自己的映像。
- **U3**：`docker/Dockerfile` / `npm run build:docker-image` 保留當進階路徑（推薦），或移除。
- **U4**：容器內 server 預設以 root 執行，並明確 `--data-dir /var/lib/bat-server`（推薦，與現在的映像相同、不受映像 `USER` 影響），或跟隨映像的 `USER`。
- **U5**：W1 拿掉 `--token`，權杖只存在 data volume 的檔案裡（推薦）。既有容器不受影響。
- （只有 U1 選 (a) 時）**U6**：pre-release 要不要推映像；`latest` 只給正式版。

### 遭遇問題

- 本機 Docker 沒有 engine，無法實際查詢容器或映像（工單本來就不准建立 / 啟動）。容器行為的結論來自程式碼、T0743 的實機證據與 headless server 的本機探測。(c′) 的 `docker run --rm -i` 串流安裝、基底映像相容性探測都還沒有在真 Docker 上驗證，列為 W4a 的驗收項目。
- GHCR 映像大小、CI 耗時、bookworm-slim 大小是推估，標示「推估」的數字沒有實測。

### 互動紀錄

- [15:08] 開工：讀工單、落點檢查 PASS、標 IN_PROGRESS。沒有向塔台提問（所有選擇都能依程式碼與既有決策給出建議；需要裁決的事項列在 U1–U6，不阻擋本研究結案）。
- [15:11] 發現 `RemoteServer.start` 會把 `--token` 寫進檔案，以 scratchpad 探測腳本實測確認，推翻工單「已知資訊」第 2 點的推論。

### 回報時間

- 2026-11-04T15:13:31+0800
