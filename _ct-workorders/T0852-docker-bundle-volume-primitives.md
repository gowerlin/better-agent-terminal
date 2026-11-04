---
schema_version: 1
schema_kind: workorder
id: T0852
title: "Docker 精靈 W4a：(c′) 主行程端 docker 原語（pull、架構、bundle volume 安裝、相容性探測、建立容器參數）"
type: implementation
status: DONE
repo: better-agent-terminal
project: PLAN-052
priority: P2
sizing: M
created_at: "2026-11-04T15:18:27+0800"
started_at: "2026-11-04T15:51:29+0800"
updated_at: "2026-11-04T16:10:13+0800"
completed_at: "2026-11-04T16:10:13+0800"
session_ids:
  - "d4a37b54-1625-4ed2-9e53-8359704325c8"
depends_on: [T0849, T0851]
related:
  - "PLAN-052；D283（U1 (c′)、U4 root＋`--data-dir /var/lib/bat-server`、U5 無 `--token`）；T0848 回報區〈調查結論〉2 與〈建議下一步〉W4a；PLAN-031（server bundle distributor）；T0552 / T0554（`server-bundle-install-script.ts`）"
affects_files:
  - _ct-workorders/T0852-docker-bundle-volume-primitives.md
  - electron/docker-bundle-volume.ts
  - electron/docker-lifecycle.ts
  - electron/docker-detect.ts
  - electron/main.ts
  - electron/preload.ts
  - src/types/electron.d.ts
  - electron/server-bundle-install-script.ts
  - electron/__tests__/docker-bundle-volume.test.ts
  - electron/__tests__/docker-lifecycle.test.ts
  - electron/__tests__/server-bundle-install-script.test.ts
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 只加 main 端原語與 IPC，精靈步驟不改（W4b / T0853）；現行建立 / 沿用容器的流程行為不變。"
  - "🔴 `server-bundle-install-script.ts` 若要把 root 參數化：WSL / SSH 產出的腳本逐字不變（既有測試斷言照舊通過）。BAT 不跑依賴安裝（D152），只裝 BAT 自己的 bundle、不碰基底映像套件。"
  - "🔴 建立容器的參數由純函式組出：只綁 `-p 127.0.0.1:<P>:9876`、沒有 `--token`、server 以 root 執行並 `--data-dir /var/lib/bat-server`（U4）。tarball 經 stdin 串流，不寫暫存檔進容器以外的地方。權杖 / 憑證不記日誌。"
  - "🔴 child_process 一律 `execFile` / `spawn` + 陣列參數 + timeout（pull 可長、要可中止）；映像名稱、容器名稱、volume 名稱都要過白名單（映像名稱允許 `/`、`:`、`@` 的 registry 形式，另訂嚴格 regex 並測試）。"
  - "🔴 yolo：不得問使用者；問題問塔台。不發版、不 push。Git：只 commit 本單範圍（`git add <明確路徑>`）。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。本機 Docker 沒有 engine：不建立 / 啟動 / 刪除容器或映像；真 Docker 驗收列〈待實機驗收〉或在 WSL Docker 上做（只能用 `bat-t0852-` 前綴的拋棄式容器 / volume，做完刪除）。"
---

# T0852 — Docker 精靈 W4a：(c′) 主行程端 docker 原語

## 元資料
- **工單編號**：T0852｜**類型**：implementation｜**狀態**：DONE｜**建立**：2026-11-04 15:18 (UTC+8)
- **規模**：M｜**決策**：D283｜**依賴**：T0849、T0851（同改 `docker-detect.ts` / `docker-lifecycle.ts` / `electron.d.ts`，循序）

## 背景
D283：映像來源採 (c′)：精靈 pull 使用者選的基底映像（預設含 git 的官方映像，W4b 決定），把 server bundle 裝進 volume，再以基底映像建立容器。完整設計（指令形狀、限制）見 T0848 回報區〈調查結論〉2 的比較表 (c′) 欄。

## 任務
1. `docker:pull-image`：帶進度、可中止、有逾時。
2. `docker:server-arch`：`docker version --format {{.Server.Arch}}` → `normalizeArch`（`src/lib/arch-normalize.ts`）。
3. volume 建立 / 刪除（含 ownership 紀錄，比照既有精靈清理規則）：`bat-server-<name>-bundle`、`bat-server-<name>-data`。
4. `docker:install-bundle-into-volume`：`docker run --rm -i -v <vol>:/opt/bat <基底> sh -c '<buildSshBundleInstallCommand("/opt/bat/server")>'`，tarball 經 stdin 串流；沿用 T0552 / T0554 的 `.bat-new` / `.bat-old` 換版與 restore / discard。
5. 相容性探測：`bin/node -e 1`，辨識 glibc 太舊 / musl（Alpine）並回明確原因代碼；需要 `/bin/sh`、`tar`、`gzip`。
6. `buildBatContainerRunArgs`：`--init`、`--entrypoint /opt/bat/server/bin/bat-server`、`--health-cmd`（同 `docker/Dockerfile` 的 TLS 探測）、`--restart unless-stopped`、`-p 127.0.0.1:P:9876`、兩個 volume、label `bat.server=1`、`--bind-interface all --port 9876 --data-dir /var/lib/bat-server`，沒有 `--token`。
7. `docker.execCommand`：目前只在型別宣告、沒有實作（T0848 發現的死碼）→ 補實作或移除並改寫唯一呼叫點。
8. 確認 `server-cert.json`（含私鑰）與 dataDir 的權限；dataDir 建成 0700。
8a. （可選，T0851 回報區〈可選項 6〉移來；成本低才做，不做就在回報區寫明）憑證指紋交叉比對：main 端以 `docker exec cat <dataDir>/server-cert.json`（dataDir 推算沿用 T0849 的 `resolveServerTokenPath` 規則）算 SHA-256，回傳指紋（不回傳憑證或私鑰內容）；先確認 `server-cert.json` 的格式。精靈端的比對接線留給 T0853。
9. 測試：參數組裝（斷言 127.0.0.1、無 `--token`、白名單）、install 指令與 stdin 串流（mock）、探測結果分類、pull 中止。

### 驗收條件
- [x] 上述測試通過；`server-bundle-install-script` 既有 WSL / SSH 斷言不回歸
- [x] `npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npm run test:unit` 全過、`npm run test:legacy` 全過（發版 Test gate；T0850 漏跑造成 `tests/docker-flow-journeys.test.ts` 回歸，由 T0855 修）、`npx vite build` 成功
- [x] 真 Docker 上的建立 / 安裝 / 探測：WSL Docker 可用就實測（拋棄式資源、做完刪除，回報區列指令與結果），否則列〈待實機驗收〉
- [x] commit 只含本單範圍

---

## 回報區

### 完成狀態
- **狀態**：DONE
- **一句話結論**：(c′) 的 main 端原語都做好了，也接上了 IPC（`docker:*`），精靈步驟沒動：pull（進度／中止／逾時）、daemon 架構、BAT volume 建立／刪除、bundle 裝進 volume（stdin 串流＋T0552／T0554 換版／還原／丟棄）、相容性探測、`buildBatContainerRunArgs`＋`createBatContainer`、`docker.execCommand` 實作、憑證指紋（8a 有做）。WSL Docker 29.1.3 實測全部符合預期，拋棄式資源都已刪除。
- **session_id**：d4a37b54-1625-4ed2-9e53-8359704325c8
- **產品 commit**：`2f0abf4b`（feat(docker): T0852 main-side primitives for base image + bundle volume (W4a)）
- **落點檢查**：PASS。C-0：`repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`。C-1：PASS。C-3：`electron/docker-bundle-volume.ts` 與它的測試檔是新建的，祖先目錄 `electron/` 存在；其餘條目都存在。C-2：工單沒有 `branch`，目前在 `main`。`CT_HOME` 未設定（不是 worktree）。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`。`CT_MODE` = `yolo`，`CT_INTERACTIVE` = `0`。
- **開工時狀態**：`TODO`（不是 `PENDING`），照常改成 `IN_PROGRESS`。

### 實作內容（`electron/docker-bundle-volume.ts`，新檔，不 import electron、不寫日誌）
| 任務 | 實作 | 備註 |
|---|---|---|
| 1 pull | `pullImage(image, { signal, timeoutMs, onProgress })`：`spawn('docker', ['pull', image])`。`DockerPullProgressTracker` 只回報層數 `{ layers, completed }`。錯誤碼：`docker-image-invalid` / `-not-found` / `docker-pull-rate-limited` / `-failed` / `-timeout` / `-aborted` | 預設逾時 30 min（`DOCKER_PULL_TIMEOUT_MS`）。中止或逾時就 kill docker CLI（實測：中止後映像沒有留下）。containerd 映像庫的 config / index blob 只會印 `Download complete`，所以這行也算完成（實測 Docker 29） |
| 2 架構 | `dockerServerArch()`：`docker version --format {{.Server.Os}}/{{.Server.Arch}}` → `normalizeArch(…, 'docker-linux')` | 比工單多讀 `Os`：Docker Desktop 切到 Windows containers 時回 `docker-server-not-linux`，不會誤判成 `linux-x64`。另有 `docker-arch-unsupported` / `-failed` |
| 3 volume | `batVolumeNames(name)` → `bat-server-<name>-bundle` / `-data`。`createBatVolume(name, role)`：已存在就不建，回 `created: false`；新建時加 label `bat.server=1` 與 `bat.server.volume=<role>`。`removeBatVolume(name)`：沒有 `bat.server=1` 一律拒絕（`docker-volume-not-owned`）；不存在回 `removed: false`；不加 `-f`，使用中的 volume 會失敗 | ownership：精靈記下 `created`，rollback 只刪自己建的（比照 T0444）；main 端以 label 再擋一層 |
| 4 安裝 | `installBundleIntoVolume({ image, bundleVolume, dataVolume?, tarballPath, keepPrevious, signal })`：`docker run --rm -i --name bat-bundle-job-<hex> --network none --user 0:0 -v <bundle>:/opt/bat [-v <data>:/var/lib/bat-server] --entrypoint /bin/sh <image> -c <script> sh`，主機上的 tarball 用 `fs.createReadStream` 直接 pipe 進 stdin。script 就是 `buildSshBundleInstallCommand('/opt/bat/server', { keepPrevious })`，有 data volume 時前面多一行 `mkdir -p … && chmod 700 …`。`restoreBundleInVolume` / `discardPreviousBundleInVolume` 沿用 T0554 的 SSH 版指令 | `--entrypoint /bin/sh`：不讓基底映像自己的 ENTRYPOINT 吃掉 `sh -c`。中止或逾時的處理：只關 stdin（tar 讀到截斷的檔案而失敗，舊安裝不動，與 T0830 WSL 的承諾相同），超過 15 s 寬限才 kill 並 `docker rm -f` job。swap 完成後才中止時，回傳帶 `previous`，讓 rollback 能還原 |
| 5 探測 | `probeBundleCompat({ image, bundleVolume? })`：一次性 `docker run --rm --network none`，bundle volume 以 `:ro` 掛載。腳本輸出 `BAT_PROBE_*`。`classifyCompatProbe`（純函式）判斷順序：沒有 `/bin/sh`（docker exit 126/127）→ 缺 `tar`/`gzip` → musl → glibc < 2.35 → bundle 缺 node / node 失敗 | 不帶 `bundleVolume` 時只查工具與 libc，可以在下載 bundle 前先擋。帶 `bundleVolume` 時再跑 `bin/node -e 1`。node 輸出 `GLIBC_x not found` 也判成 `docker-compat-glibc-too-old` |
| 6 容器參數 | `buildBatContainerRunArgs`（純函式，輸入不合法就 throw）＋`createBatContainer`（逾時 120 s）：`--init --user 0:0 --restart unless-stopped --label bat.server=1 --entrypoint /opt/bat/server/bin/bat-server --health-cmd <TLS 探測> … -e NODE_ENV=production -p 127.0.0.1:P:9876 -v bundle:/opt/bat -v data:/var/lib/bat-server [bind mounts] <image> --bind-interface all --port 9876 --data-dir /var/lib/bat-server` | 沒有 `--token`。health-cmd 與 `docker/Dockerfile` 相同，只換成 bundle 內的 node、port 寫死 9876（測試會讀 Dockerfile 比對） |
| 7 execCommand | 已實作（不是移除）：`docker:exec-command` → `execContainerCommand`，只允許唯一呼叫點的形狀 `['rm','-rf',<root>]`。`<root>` 要通過 `assertBundleInstallRoot`，而且只能有 `[A-Za-z0-9._/-]`。實際執行 `docker exec <name> rm -rf -- <root>`；其他指令一律拒絕，不會呼叫 docker | 唯一呼叫點 `steps/docker/install-server-bundle.ts` 的 rollback 與它的測試都不用改（不在本單範圍）。選擇不做通用 exec，是為了不開放 renderer 對任意容器執行任意指令 |
| 8 權限 | 程式碼：`server-cert.json` 由 `persistCertificate` 以 `mode: 0o600` 寫入（`electron/remote/certificate.ts`）；`server-token.json` 也是 0600（`secrets.ts`）。dataDir 由安裝 job 建成 0700 root | 實測：`700 root /var/lib/bat-server`、`600 root …/server-cert.json`、`600 root …/server-token.json` |
| 8a 指紋 | 有做：`readServerCertFingerprint(name)`。dataDir 的推算沿用 `resolveServerTokenPath` 的規則，用 `docker exec cat <dataDir>/server-cert.json` 讀檔，從 `cert` 欄位算 SHA-256（不信任檔案裡存的 `fingerprint`），只回傳指紋 | 格式確認：`{ cert, key, fingerprint, expiresAt }`。測試以 `computeFingerprint` 比對格式；實測與 openssl handshake 指紋相同。比對的接線留給 T0853 |

IPC（`electron/main.ts`；`electron/preload.ts`；`src/types/electron.d.ts` 的型別照抄一份）：
- `docker:pull-image`，進度事件 `docker:pull-progress`
- `docker:server-arch`、`docker:bat-volume-names`
- `docker:create-volume`、`docker:remove-volume`
- `docker:install-bundle-into-volume`、`docker:restore-bundle-in-volume`、`docker:discard-previous-bundle-in-volume`
- `docker:probe-bundle-compat`、`docker:create-bat-container`
- `docker:exec-command`、`docker:read-server-cert-fingerprint`

pull 與 install 帶 `operationId` 時，可以經 `wizard:abortOperation` 中止（T0830 registry）。日誌只記結果碼與數量，不記 docker 參數、權杖、憑證或錯誤全文。

`server-bundle-install-script.ts`：**沒改**。`buildSshBundleInstallCommand` 本來就以 root 為參數，直接傳 `/opt/bat/server`，WSL / SSH 產出的腳本逐字不變。測試檔多一條 T0852 斷言（root 合法、指令形狀），既有斷言全部照舊。

`docker-lifecycle.ts` / `docker-detect.ts` / `docker-lifecycle.test.ts`：沒改。新模組只 import `BAT_SERVER_LABEL` / `DOCKER_PUBLISH_HOST` / `resolveServerTokenPath`，現行建立 / 沿用容器的流程不變。

### 驗證
| 關卡 | 結果 |
|---|---|
| `npm run typecheck` | 0 |
| `npm run typecheck:electron` | 0 |
| `npm run test:unit` | 439 files passed / 3 skipped；7978 passed / 40 skipped，0 failed |
| `npm run test:legacy` | 33 / 33 檔、472 tests passed |
| `npx vite build` | 成功 |
| 新測試 `electron/__tests__/docker-bundle-volume.test.ts` | 154 passed |

新測試涵蓋：
- 映像名稱白名單：接受 14 種形式、拒絕 29 種（含 `-v`、`--privileged`、大寫 path、shell 字元、壞 digest、port 超出範圍）。volume 名稱白名單。
- 容器參數：只有一個 `-p` 且是 `127.0.0.1:19876:9876`、沒有任何含 token 的參數、root / init / entrypoint / label / 兩個 volume / server 旗標、health-cmd 與 Dockerfile 比對、各種不合法輸入 throw。
- pull：參數、進度、up-to-date、containerd 格式、中止會 kill、已中止就不 spawn、逾時、三種錯誤分類。
- arch：解析與指令。
- volume：建立 / 已存在 / 不建、只刪有 label 的、使用中失敗。
- install：參數、stdin 收到的位元組與 tarball 完全相同、tarball 路徑不出現在參數裡、marker 解析、失敗、沒有 marker、中止只關 stdin（寬限期內不 kill）、swap 後才中止帶 `previous`、逾時後 kill＋`rm -f` job、不合法輸入不 spawn、restore / discard。
- 探測：14 種分類，以及在真 sh 下跑探測腳本。
- execCommand：允許的形狀與 11 種拒絕。
- 指紋：與 `computeFingerprint` 一致、只回傳指紋、舊映像用預設 dataDir、讀不到時錯誤訊息不含檔案內容。
- source guard：不 import electron / logger、不用 shell 型 exec、沒有 `'--token'`。

### 真 Docker 實測（WSL Ubuntu-24.04，Docker 29.1.3，containerd snapshotter）
做法：`npx tsx <scratchpad>/t0852-real-docker.cts <repo> <tarball>`，以 `setExecFileImplForTests` / `setSpawnImplForTests` 把 `docker` 轉成 `wsl.exe -d Ubuntu-24.04 --exec docker …`。實際呼叫的是本模組的函式，tarball 從 Windows 主機經 docker CLI 的 stdin 串流進去，與正式路徑相同。

測試資源：
- 容器 `bat-t0852-c1`、volume `bat-t0852-bundle` / `bat-t0852-data` / `bat-t0852-plain`。
- 用 harness 把 job 容器名稱改成 `bat-t0852-job-*`，讓所有資源都是 `bat-t0852-` 前綴。
- bundle：本機 cache 的 `bat-server-linux-x64-v0.7.3-pre.3.tar.gz`。
- port 19852。

| 步驟 | 結果 |
|---|---|
| A1 server-arch | `linux-x64`（`amd64`） |
| A2 pull `debian:bookworm-slim` | ok `downloaded`（3.2 s；registry 有較新的 digest，見〈遭遇問題〉） |
| A3 pull 不存在的映像 | `docker-image-not-found` |
| A4 pull `alpine:3.19`，300 ms 後中止 | `docker-pull-aborted`，映像沒有留下 |
| B1–B3 建 volume | bundle `created: true` → 再建 `created: false` → data `created: true`；label `{"bat.server":"1","bat.server.volume":"bundle"/"data"}` |
| B4 刪沒有 label 的 volume | `docker-volume-not-owned`，volume 保留 |
| C1 探測 debian（安裝前） | ok，glibc 2.36 |
| C2 安裝 #1（keep＋data dir） | ok `previous: none`（2.5 s）；volume 內為 `server`；data dir `700 root` |
| C3 探測（node） | ok，`nodeChecked: true` |
| C4 安裝 #2（keep） | `previous: kept`，volume 內有 `server server.bat-old` |
| C5 restore / C6 再 restore | `restored`（只剩 `server`）/ `missing` |
| C7 安裝 #3 → C8 discard | `kept` → ok，只剩 `server` |
| C9 安裝 1.5 s 後中止 | `docker-install-aborted`；volume 仍只有完整的 `server`，沒有 `.bat-new`；沒有殘留的 job 容器 |
| D1–D2 `createBatContainer` | ok（0.6 s），health 變成 `healthy` |
| D3 `docker inspect` | User `0:0`、Entrypoint `/opt/bat/server/bin/bat-server`、Cmd `--bind-interface all --port 9876 --data-dir /var/lib/bat-server`、PortBindings `127.0.0.1:19852`、Init `true`、Label `bat.server=1`；Cmd / Entrypoint / Env 都沒有 token |
| D4 權限 / 程序 | `700 root /var/lib/bat-server`、cert 與 token 都是 `600 root`；PID 1 是 `/sbin/docker-init -- /opt/bat/server/bin/bat-server …` |
| D5 `readServerToken`（T0849） | ok，`source: file`，長度 43（值未記錄） |
| D6–D7 指紋 | `68:AF:BE:…:D1:2B`，與 WSL 內 `openssl s_client` 的 handshake 指紋**相同** |
| D8 / D9 execCommand | 允許的 `rm -rf /opt/bat-t0852-scratch` → ok；`sh -c id` → 拒絕，沒有呼叫 docker |
| D10 刪使用中的 volume | `docker-volume-failed`（volume is in use） |
| E1–E3 alpine:3.20 | pull ok；安裝前與帶 node 的探測都回 `docker-compat-musl` |
| 清理 | 容器刪除、兩個 volume `removed: true`、`bat-t0852-plain` 刪除、本次 pull 的 alpine:3.19 / 3.20 刪除；最後列出：containers=""、volumes=""、alpine="" |

另外單獨跑了一次 pull 原始輸出除錯（`t0852-pull-debug.cts`，pull 後刪除 alpine:3.19）：進度事件確實觸發，containerd 格式見 `Download complete` 那一點。主實測的 log 裡沒有 progress 行，是 harness 輸出過濾的問題，不是產品問題。修正 `Download complete` 計數的那個 commit 在主實測之後，只影響進度計數，已有單元測試涵蓋。

### 遭遇問題
- A2：WSL 上的 `debian:bookworm-slim` 被 pull 成 registry 上較新的 digest `sha256:99c0b25c…`。舊的那份映像如果沒有容器在用，會變成 `<none>`。這是 pull 原語的正常效果，沒有刪除任何東西，但 WSL Docker 的狀態因此跟開工前不同（工單只限制容器 / volume 要用前綴，這裡照實記錄）。
- 測試 fake 的競態：tarball 很快就 pipe 完，stdin 在測試掛 listener 之前就結束了，有 4 例因此逾時。改用 `onStdinEnded` 先檢查已結束旗標，已修。
- `execCommand` 的拒絕測試一開始沒過：`/opt/x;id` 通過了 `assertBundleInstallRoot`。雖然沒有 shell 會執行它，還是加了字元白名單 `[A-Za-z0-9._/-]`。

### 互動紀錄
- 無（yolo，沒有向塔台提問）。

### 後續建議（給 T0853 / T0854）
- T0853 接線：
  - 第 4 步：`createVolume` 兩個（記 `created`）→ `probeBundleCompat({ image })` → distributor 取得 tarball → `installBundleIntoVolume({ dataVolume, keepPrevious })` → `probeBundleCompat({ bundleVolume })`。
  - 第 5 步：`createBatContainer` → health → `readServerToken` → 可選 `readServerCertFingerprint` 與 handshake 指紋比對。
  - 取消：`restoreBundleInVolume`；完成：`discardPreviousBundleInVolume`。
  - rollback：只刪 `created: true` 的 volume。
- `docker:pull-progress` 帶 `operationId`，精靈依 id 過濾。進度只有層數，沒有位元組；containerd 會先列出所有 blob，`completed / layers` 可以當進度條用。
- `createBatContainer` 沒有加 `--pull never`（舊 Docker 不認得這個旗標），要依賴前一步先 pull。
- T0854：
  - CLAUDE.md / `docs/agent-guide` 補一節 (c′) 原語（唯一實作 `electron/docker-bundle-volume.ts`、127.0.0.1 / 無 token / root / 0700 的不變式、execCommand 只允許 rm 根目錄）。
  - T0743 shim 要放行：`pull`、`volume inspect/create/rm`、`run --rm [-i]`、`version --format`。
  - 這份 scratchpad harness 可以改寫成 `docker-acceptance.yml` 的腳本雛形。

### 回報時間
- 2026-11-04T16:08:58+0800
