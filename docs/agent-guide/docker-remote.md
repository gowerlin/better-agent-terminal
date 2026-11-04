# Docker 遠端：基底映像＋bundle volume（PLAN-052 / D283）

> CLAUDE.md「Docker 遠端：基底映像＋bundle volume（PLAN-052 / D283）」節的完整說明（T0854）。CLAUDE.md 該節保留用途、必守規則、唯一實作位置與本檔連結；改功能時兩邊一起更新。使用者說明：網站 `site/remote/docker.md`、英文部署指南 [docs/docker-deployment.md](../docker-deployment.md)。

## 用途與決策

PLAN-052 之前，Docker 精靈只會用本機的 `bat-server:latest`（`docker/Dockerfile` 內建 `/opt/bat-server`）建立容器；這個映像沒有發佈，使用者得自己從原始碼建置。D283（T0848 研究，使用者四題皆選建議）改成 **(c′)**：

1. U1：精靈 pull 一個**基底映像**，server bundle 經既有 distributor（PLAN-031）取得，裝進 BAT 的 **bundle volume**，再以基底映像建立容器。不發佈 GHCR 映像、不發佈 release tar。
2. U2：預設基底映像 `buildpack-deps:bookworm-scm`（Debian 12、glibc 2.36、含 git / curl / ssh；Docker Hub 2026-11-04 查詢壓縮後約 130 MiB，amd64 + arm64）；可改填自訂映像（內部 registry 也可以）。
3. U3：`docker/Dockerfile` / `bat-server:latest` 保留為進階路徑：映像本身會啟動內建 server 時，精靈略過安裝。
4. U4 / U5：容器內 server 以 root 執行、`--data-dir /var/lib/bat-server`；新容器不帶 `--token`，權杖只在 data volume；既有容器不動。

拆單：T0849（權杖與安全）、T0850（重跑更新設定）、T0851（選容器＋掛載）、T0852（main 端原語）、T0853（精靈步驟）、T0854（文件、e2e、`docker-acceptance.yml`）。

## 唯一實作位置

| 範圍 | 位置 |
|---|---|
| (c′) 原語：pull、daemon 架構、BAT volume、裝 bundle 進 volume、相容性探測、建立容器、`execCommand`、憑證指紋、U3 判斷、volume 內版本 | `electron/docker-bundle-volume.ts`（不 import electron、不寫日誌；IPC 在 `electron/main.ts`） |
| 既有容器的啟動 / 停止 / 健康 / 權杖讀取、建立容器（U3 路徑）、埠挑選 | `electron/docker-lifecycle.ts`（`readServerToken`、`resolveServerTokenPath`、`buildCreateContainerArgs`、`pickDockerServerPort`） |
| 容器清單（含 `publishedPort` / `batCreated`）、`inspectContainer` | `electron/docker-detect.ts` |
| distributor 的 docker 架構（`dockerServerArch` 直接用、不 `docker exec`） | `electron/remote/arch-detect.ts`、`electron/main.ts`（`server-bundle:distribute` 的 draft 驗證） |
| 精靈步驟 | `src/components/setup-wizard/steps/docker/`：`pick-container.ts`（模式、選容器、基底映像欄位）、`base-image.ts`（預設映像、名稱驗證）、`configure-mounts.ts`（掛載、從容器帶出 bind mount）、`install-server-bundle.ts`（第 4 步：pull → U3 → 探測 → distributor → volume → 安裝 → 探測；升級）、`start-server.ts`（第 5 步：建立 / 啟動 / restart → healthy → 權杖）、`ownership.ts`（rollback 依據） |
| 重跑時更新既有設定 | `src/components/setup-wizard/steps/wsl/write-profile.ts`（Docker 分支，T0850） |
| Shell 的 pull 進度 | `src/components/setup-wizard/SetupWizardShell.tsx`（`DockerPullProgress`） |
| 錯誤對應（三語） | `src/components/setup-wizard/error-mapper.ts`、`src/locales/*.json` 的 `wizard.docker.*` |

## 精靈流程（9 步）

| # | step id | 做什麼 |
|---|---|---|
| 1 | `detect-env` | `docker` CLI 與 daemon |
| 2 | `pick-container` | 「建立新容器」：問**基底映像**（`requestText`，預填目前值，預設 U2；規則同 main 的 `validateDockerImageRef`）。「沿用既有容器」：容器選單（T0851，見下） |
| 3 | `configure-mounts` | 選一個本機資料夾 → `/workspace/<資料夾名稱>`；沿用既有容器時先從容器的 bind mount 帶出對照並確認（T0851） |
| 4 | `install-server-bundle` | 建立新容器：`pullImage` → `imageBakedBundle`（U3）→ `probeBundleCompat({ image })` → `serverArch` → distributor（draft 帶 `dockerServerArch`）→ 建兩個 volume（記 ownership）→ `installBundleIntoVolume(keepPrevious)` → `probeBundleCompat({ image, bundleVolume })`。沿用既有容器：(c′) 容器走升級判斷（見下），其他容器只記警告（映像要自己有 `/opt/bat-server`） |
| 5 | `start-server` | (c′)：`createBatContainer`；U3：`startContainer(createIfMissing)`＋data volume；升級：執行中的容器 `docker restart`、停止中的 `docker start`；之後等 `healthy`（最多 45 s）→ `readServerToken` |
| 6 | `fetch-fingerprint` | `127.0.0.1:<host port>` 的 TLS handshake 指紋（與 WSL 共用步驟） |
| 7 | `connect-test` | 權杖＋指紋連線 |
| 8 | `write-profile` | 同容器（`docker-linux` + `dockerContainer` + loopback host）有既有設定 → 更新，不新增（T0850） |
| 9 | `done` | 警告清單 |

- 探測失敗在建立任何東西之前停止，錯誤附「修改基底映像」（跳回 `pick-container`）。
- pull 失敗、但本機已有該映像（例：只在本機建置的 `bat-server:latest`，或離線時的基底映像）→ 改用本機那份並記一行 warn；映像名稱不合法或使用者中止時不查本機（T0853 G1）。
- 下載失敗（`download-failed` / `no-source-available`）→ `server-bundle-unavailable`，失敗畫面有「匯入本機 tarball…」（T0547，與 WSL / SSH 同一個 cache）。
- Shell 在第 4 步顯示「正在拉取 <image>：n / m 層」：只顯示本次 pull 的 `operationId`（step 放在 `ctx.state.dockerPullOperationId`），其他 pull 的 `docker:pull-progress` 事件忽略。進度只有層數，沒有位元組。

## 不變式

### 容器（`buildBatContainerRunArgs`，純函式，輸入不合法就 throw）

```text
docker run -d --name <name> --init --user 0:0 --restart unless-stopped --label bat.server=1
  --entrypoint /opt/bat/server/bin/bat-server
  --health-cmd <bundled node TLS handshake on 9876> --health-interval 30s --health-timeout 5s
  --health-start-period 10s --health-retries 3
  -e NODE_ENV=production
  -p 127.0.0.1:<host port>:9876
  -v bat-server-<name>-bundle:/opt/bat -v bat-server-<name>-data:/var/lib/bat-server
  [-v <host folder>:/workspace/<folder>]
  <base image> --bind-interface all --port 9876 --data-dir /var/lib/bat-server
```

- 🔴 只有一個 `-p`，而且是 `127.0.0.1:<P>:9876`。容器內 `--bind-interface all` 是為了讓 Docker 的轉送進得來；安全靠主機端只綁 loopback（server 會給出容器內的 root shell）。
- 🔴 沒有 `--token`、沒有任何含權杖的參數或 env；權杖由 server 第一次啟動時自己產生，寫在 data volume（`server-token.json`，0600）。
- root（`0:0`）、`--init`（PID 1 是 docker-init）、label `bat.server=1`。
- health-cmd 與 `docker/Dockerfile` 的 `HEALTHCHECK` 相同，只換成 bundle 內的 node、port 寫死 9876（測試讀 Dockerfile 比對）。
- dataDir `/var/lib/bat-server` 由安裝 job 建成 0700 root；`server-cert.json` / `server-token.json` 0600。
- 不加 `--pull never`（舊 Docker 不認得），依賴第 4 步先 pull。

### 一次性 job（`buildBundleJobArgs`）

`docker run --rm [-i] [--name bat-bundle-job-<hex>] --network none --user 0:0 -v <volume>:<target>[:ro] --entrypoint /bin/sh <image> -c <script> sh …`

- `--entrypoint /bin/sh`：不讓基底映像自己的 ENTRYPOINT 吃掉 `sh -c`。
- 安裝：tarball 以 `fs.createReadStream` pipe 進 stdin，主機路徑不出現在參數裡；腳本就是 SSH 的 `buildSshBundleInstallCommand('/opt/bat/server', { keepPrevious })`（T0552 換版 / T0554 `.bat-old`，`BAT_BUNDLE_PREVIOUS=kept|none|unmanaged`）。WSL / SSH 產出的腳本逐字不變。
- 中止或逾時：只關 stdin（tar 讀到截斷的資料而失敗，舊安裝不動），超過 15 s 寬限才 kill 並 `docker rm -f` job。swap 完成後才中止時回傳帶 `previous`，讓 rollback 能還原。逾時：pull 30 min、安裝 10 min。
- 探測（`probeBundleCompat`）：bundle volume 以 `:ro` 掛載；判斷順序：沒有 `/bin/sh`（exit 126/127）→ 缺 `tar` / `gzip` → musl → glibc < 2.35 → bundle 缺 node / node 跑不起來（`GLIBC_x not found` 也判成 glibc 太舊）。
- volume 內版本（`readBundleVersionInVolume`）：`:ro`＋`--network none`，讀 `server/package.json` 的 `version`。

### volume 與 ownership

- 名稱固定 `bat-server-<容器名>-bundle` / `-data`（`batVolumeNames`；renderer 端 `dockerBatVolumeNames` 要同步）。
- 新建時加 label `bat.server=1` 與 `bat.server.volume=bundle|data`；已存在就不建（`created: false`）。
- `removeBatVolume`：沒有 `bat.server=1` 一律拒絕（`docker-volume-not-owned`）；不加 `-f`，使用中的 volume 刪不掉。
- 精靈只刪本次 `created: true` 的 volume（比照 T0444）。

### rollback 順序（`install-server-bundle` 的 rollback）

1. 先移除本次建立的容器（容器存在時 volume 在使用中）。
2. 再還原 `kept` 的舊 bundle（`restoreBundleInVolume`）；升級時若第 5 步已 restart，再 restart 一次。
3. 最後只刪 `created: true` 的 volume。

重試時，若本次較早的嘗試已經安裝過，先 restore 再重裝，避免 `server.bat-old` 裡原本的 bundle 被覆蓋。精靈完成時 `finalize` 呼叫 `discardPreviousBundleInVolume` 刪 `.bat-old`。

### `docker.execCommand`

- 🔴 只允許唯一呼叫點的形狀 `['rm', '-rf', <bundle root>]`：`<root>` 要通過 `assertBundleInstallRoot`，且只含 `[A-Za-z0-9._/-]`；實際執行 `docker exec <name> rm -rf -- <root>`。其他指令一律拒絕、不呼叫 docker。不開放通用 exec（renderer 不能對任意容器執行任意指令）。
- (c′) 從不寫進使用者的容器（bundle 在 BAT 的 volume），所以這條 rollback 實際上不會執行。

### U3（映像已內建 server）

- `inspectImageBakedBundle`：`docker image inspect`，`.Config.Entrypoint` 或 `.Config.Cmd` 任一含 `/opt/bat-server/bin/bat-server` → 內建；只回布林與原因碼，名稱不參與判斷。
- 內建時略過安裝，照 T0849 後的方式建立（`startContainer(createIfMissing)`＋data volume `bat-server-<name>-data` 掛在 `/root/.local/share/bat-server`，沒有 `--token`）。

### 重跑＝升級（T0853 Q-3）

- 只在「沿用既有容器」選到 (c′) 容器時：label `bat.server=1`，而且 `/opt/bat` 掛的是 `bat-server-<name>-bundle` volume（判斷看實際掛載，不看名稱）。
- volume 內版本等於 `stripSnapshotSuffix(app 版號)` → 不動、不 restart。
- 版本不同或讀不到 → `requestChoice` 確認（說明會重啟容器、終端與 agent 會結束）。「先不升級」照一般沿用流程連線；沒有提示 UI 時不升級。
- 確認後：distributor → `installBundleIntoVolume(keepPrevious)` → node 探測 → 第 5 步 restart / start。容器、掛載、權杖、憑證都不變。
- 升級時的架構同樣帶 `dockerServerArch`（容器停止時 `docker exec uname -m` 會失敗）。
- 其他既有容器（含 `bat-server:latest` 建的）行為與 T0853 前相同。

## 權杖取得順序（T0849）

`readServerToken(name)`（`electron/docker-lifecycle.ts`），容器 **healthy 之後**才讀，兩條路徑（建立 / 沿用）相同：

1. `docker exec <name> cat <dataDir>/server-token.json`；dataDir 由 `resolveServerTokenPath` 推算：容器命令的 `--data-dir` → env `BAT_SERVER_DATA_DIR` → `XDG_DATA_HOME/bat-server` → `HOME/.local/share/bat-server` → `/root/.local/share/bat-server`（相對路徑以 `Config.WorkingDir` 為基準；順序與 `scripts/bat-server.mjs` `resolveDataDir` 一致）。
2. 以 `--token <t>` 建立的舊容器（D283 前）→ `<t>`。
3. 都沒有 → `docker-token-unavailable`。

不重新簽發、不改容器（BUG-111）。IPC `docker:read-server-token` 只回 `{ ok, token }`（丟掉 `source`）；`docker:inspect-container` 不回傳 env。docker 呼叫都有 timeout（偵測 5 s、IO 30 s、`createBatContainer` 120 s）；只有 U3 路徑的 `docker run`（`startContainer(createIfMissing)`）不限時，因為可能要先拉映像。

## 選容器（T0851）

- 「沿用既有容器」列出所有容器：說明 = 映像 · 狀態 · 發佈埠 · BAT 建立。
- 不能用的容器顯示但不能選、附原因：沒有發佈 `9876/tcp`，或發佈在這個 BAT 的 RemoteServer 埠上。可用性未知（inspect 失敗）不判為不可用，交給第 5 步檢查。
- 排序：可用 → BAT 建立 → 執行中 → `docker ps` 原順序（新的在前）。純函式 `buildDockerContainerChoices` / `dockerContainerUnusableReason`（`pick-container.ts`）。
- 沒有可用容器 → 說明（空清單 / 全部不可用）＋「改用建立新容器」；這個提示沒有關閉鈕，`docker-no-containers` 只在沒有提示 UI 時丟出。
- 停止中的容器可選：精靈啟動它，取消時只停回自己啟動的（BUG-111）。

## 日誌

- main 端只記結果碼、數量與版本：例 `[wizard] docker pull-image: <status>`、`[wizard] docker install-bundle-into-volume: previous=<kept|none|unmanaged>`、失敗時 `… <errorCode>`。
- 🔴 不記 docker 參數全文、權杖、憑證內容、容器 env 或錯誤全文；權杖讀取只記來源（`server-token.json` / `container --token (legacy)`）或錯誤碼。
- renderer 的精靈日誌前綴 `[docker-wizard]`（`docker-flow.ts` 的 logger 寫 console，只在 DevTools 看得到）。

## 已知限制

- 憑證指紋比對（`readServerCertFingerprint` 與 handshake 指紋）沒有接進精靈：handshake 指紋在共用的 `steps/wsl/fetch-fingerprint.ts` 取得。實測兩者相同（T0852 D6–D7、T0853 A6 / B3）。是否做由塔台另行評估。
- pull 進度只有層數；distributor 的下載進度只寫日誌。
- arm64 daemon 沒有實測；macOS 主機上的 Docker Desktop 沒有實測。
- 升級時容器內所有終端與 agent 會結束（restart）。
- Docker Hub 匿名拉取有次數上限（`docker-pull-rate-limited`）：先 `docker login`、稍候，或改用其他 registry 的映像。
- 舊容器（D283 前以 `--token` 建立、或 BUG-097 前的映像）照舊可沿用，精靈只警告、不改容器。

## 驗證清單

- 單元（`npm run test:unit`）：
  - `electron/__tests__/docker-bundle-volume.test.ts`（映像 / volume 名稱白名單、容器參數、pull、volume、install、探測、execCommand、指紋、U3、版本讀取、source guard：不 import electron / logger、沒有 `'--token'`）
  - `electron/__tests__/docker-lifecycle.test.ts`、`electron/__tests__/docker-server-port.test.ts`（權杖路徑推算、舊 `--token` 解析、建立參數）
  - `electron/remote/__tests__/arch-detect-docker-draft.test.ts`
  - `src/components/setup-wizard/steps/docker/__tests__/base-image-flow.test.ts`（建立、離線匯入重試、musl、rollback、U3、升級）、`src/components/setup-wizard/__tests__/docker-pull-progress.test.tsx`、`write-profile-existing.test.ts`（重跑更新）
- legacy（`npm run test:legacy`）：`tests/docker-flow-journeys.test.ts` 等（mock 在 `tests/__mocks__/electron-api.ts`）。
- e2e（opt-in，Windows＋WSL Docker）：`e2e/t0743-docker-wizard.spec.ts`（`BAT_E2E_T0743_DOCKER=1`，shim `e2e/real-remote/t0743-docker-shim.go`）。shim 只放行 BAT 用到的子指令，且只允許測試前綴的容器與 volume（`bat-server-<測試容器>-bundle|-data`）；`bat-bundle-job-<hex>` 改名成 `T0743_SHIM_JOB_PREFIX<hex>`；`inspect <容器 id…>` 的輸出只留測試容器。
- 真 Docker（不跑 UI）：`scripts/docker-acceptance.mjs`（A 建立 / B 升級 / C 回復與中止 / D musl / Z 清理），CI `.github/workflows/docker-acceptance.yml`（`workflow_dispatch` only、ubuntu-24.04、唯讀權杖、不傳 secret、不建 tag / release、不在發版關卡）：

  ```bash
  gh workflow run docker-acceptance.yml -R gowerlin/better-agent-terminal -f from_version=0.7.4-pre.7 -f to_version=0.7.4-pre.8
  ```

  本機（Windows、Docker 在 WSL）：把 shim 放在 PATH 最前面，`T0743_SHIM_DISTRO=<distro>`、`T0743_SHIM_ALLOW='^bat-acc-[a-z0-9-]+$'`、`T0743_SHIM_JOB_PREFIX=bat-acc-job-`，再 `npx tsx scripts/docker-acceptance.mjs --from <版號或 tarball> --to <版號或 tarball>`。
