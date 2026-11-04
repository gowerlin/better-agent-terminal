---
schema_version: 1
schema_kind: workorder
id: T0853
title: "Docker 精靈 W4b：(c′) 精靈步驟（基底映像欄位、server bundle 裝進 volume、以基底映像建立容器、重跑即升級）"
type: implementation
status: DONE
repo: better-agent-terminal
project: PLAN-052
priority: P2
sizing: M
created_at: "2026-11-04T15:18:27+0800"
started_at: "2026-11-04T16:11:24+08:00"
updated_at: "2026-11-04T16:48:36+08:00"
completed_at: "2026-11-04T16:48:36+08:00"
session_ids:
  - "5053b5b8-3a97-4b0b-ab2b-4f84a01590ae"
depends_on: [T0850, T0851, T0852]
related:
  - "PLAN-052；D283（U1 (c′)、U2 預設含 git 的官方映像、U3 保留 `bat-server:latest` 當進階路徑）；T0848 回報區〈建議方向〉1 與〈建議下一步〉W4b；PLAN-031 distributor / `server-bundle-import`（T0547）"
affects_files:
  - _ct-workorders/T0853-docker-wizard-base-image-flow.md
  - src/components/setup-wizard/docker-flow.ts
  - src/components/setup-wizard/steps/docker/
  - src/components/setup-wizard/SetupWizardShell.tsx
  - src/components/setup-wizard/server-bundle-import.ts
  - src/components/setup-wizard/error-mapper.ts
  - src/locales/en.json
  - src/locales/zh-TW.json
  - src/locales/zh-CN.json
  - src/components/setup-wizard/__tests__/
  # Q-1 / Q-2 塔台裁決擴大（2026-11-04 16:15）
  - electron/main.ts
  - electron/remote/arch-detect.ts
  - src/types/electron.d.ts
  - electron/remote/__tests__/arch-detect-docker-draft.test.ts
  - electron/docker-bundle-volume.ts
  - electron/__tests__/docker-bundle-volume.test.ts
  - electron/preload.ts
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 U3：`bat-server:latest` 等已內建 bundle 的映像仍可在「映像」欄位手動填入，偵測到內建 bundle 就略過安裝、照現行方式建立（行為與 T0849 後相同）。沿用既有容器的路徑不受本單影響（W2 的選單與掛載照舊）。"
  - "🔴 U2：預設基底映像選一個含 git / curl / ssh 的官方映像（候選 `buildpack-deps:bookworm-scm`）：先確認實際大小、架構（amd64 / arm64）與 glibc ≥ 2.35；不符時問塔台，不自行改用其他映像系列。"
  - "🔴 server bundle 一律經既有 distributor（cache、`.sha256` sidecar、下載、「匯入本機 tarball…」），不另寫下載邏輯；版號用去後綴的基底版號（`stripSnapshotSuffix`）。"
  - "🔴 取消 / 失敗的 rollback 涵蓋本次建立的容器與 volume（ownership）；重跑升級失敗時還原舊 bundle（T0552 / T0554 規則），容器、掛載、權杖、憑證不變。"
  - "🔴 yolo：不得問使用者；問題問塔台。不發版、不 push。Git：只 commit 本單範圍（`git add <明確路徑>`）。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。本機 Docker 沒有 engine：真 Docker 驗收列〈待實機驗收〉或在 WSL Docker 上以 `bat-t0853-` 前綴的拋棄式資源做（做完刪除）。"
---

# T0853 — Docker 精靈 W4b：(c′) 精靈步驟

## 元資料
- **工單編號**：T0853｜**類型**：implementation｜**狀態**：DONE｜**建立**：2026-11-04 15:18 (UTC+8)
- **規模**：M｜**決策**：D283｜**依賴**：T0850、T0851、T0852

## 背景
T0852 提供 main 端原語後，精靈改成 (c′)：使用者不必自己建 `bat-server:latest`。設計見 T0848 回報區〈建議方向〉1。

## 任務

> 先讀 T0852 回報區〈實作內容〉的 IPC 清單與〈後續建議（給 T0853 / T0854）〉的接線順序（第 4 步 / 第 5 步 / 取消 / 完成 / rollback、`docker:pull-progress` 依 `operationId` 過濾、`createBatContainer` 不帶 `--pull never` 要先 pull）。可選：第 5 步以 `docker:read-server-cert-fingerprint` 與 handshake 指紋比對（T0852 8a 已做原語，實測兩者相同）；做了就在不一致時中止並給明確錯誤，不做就在回報區寫明。

1. **基底映像欄位**：建立新容器時顯示，預設 U2 的映像，可改填自訂映像（含內部 registry）；欄位說明寫需求（glibc ≥ 2.35、`/bin/sh`、`tar`、`gzip`；Alpine 不行）。
2. **第 4 步改成真正安裝**：distributor 取得 bundle（依 `docker:server-arch` 選架構）→ pull 基底映像（顯示進度、可取消）→ 相容性探測 → 裝進 bundle volume。探測失敗給明確錯誤（三語），不建立容器。
3. **第 5 步以基底映像建立**：經 `buildBatContainerRunArgs`；之後 healthy → 讀權杖（T0849 的路徑）→ 指紋 → 連線測試 → 寫設定（T0850 的更新邏輯）。
4. **重跑＝升級**：既有 BAT 建立（bundle volume 存在）的容器重跑精靈時，換 bundle → `docker restart`；取消或失敗還原舊 bundle。
5. **U3 進階路徑**：映像欄位填已內建 bundle 的映像（例 `bat-server:latest`）→ 略過安裝。
6. **測試**：精靈流程（建立、離線匯入、升級、取消 rollback、探測失敗、內建 bundle 略過）以 mock 原語測；既有 Docker 精靈測試依新流程更新，WSL / SSH 精靈不回歸。

### 驗收條件
- [ ] 上述測試通過；既有精靈測試不回歸
- [ ] `npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npm run test:unit` 全過、`npm run test:legacy` 全過（發版 Test gate；T0850 漏跑造成 `tests/docker-flow-journeys.test.ts` 回歸，由 T0855 修）、`npx vite build` 成功
- [ ] 真 Docker 上走一次「建立 → 重跑升級」：WSL Docker 可用就實測（拋棄式資源），否則列〈待實機驗收〉
- [ ] commit 只含本單範圍

---

## 回報區

### 待塔台決策

#### Q-1：distributor 對「還沒建立的容器」取不到架構，要不要擴大範圍改 main 端？
- **提問時間**：2026-11-04T16:13:43+0800
- **問題**：`server-bundle:distribute` 的 docker-linux draftProfile 只認 `dockerContainer`，架構由 `electron/remote/arch-detect.ts` 以 `docker exec <container> uname -m` 取得。(c′) 第 4 步在建立容器**之前**就要 bundle，容器不存在，distributor 一定回 `arch-detection-failed`。工單要求「一律經既有 distributor」＋「依 `docker:server-arch` 選架構」，但兩者無法在本單的 `affects_files`（只有 renderer）內同時做到。
- **選項**：
  - A（建議）：比照 SSH 的 `sshServerArch`，docker-linux draftProfile 多收 `dockerServerArch`（`docker:server-arch` 的正規化結果，例 `linux-x64`），有值時 arch-detect 直接用、不 `docker exec`；沒值時行為不變。範圍擴大：`electron/main.ts`（draft 驗證＋帶欄位）、`electron/remote/arch-detect.ts`、`src/types/electron.d.ts`、arch-detect 的單元測試（新檔 `electron/remote/__tests__/arch-detect-docker-draft.test.ts`）。約 30 行。
  - B：不改 main，renderer 改呼叫 `remote.serverBundle.download({ arch, version })`（cache＋下載；「匯入本機 tarball…」寫入的就是同一個 cache），自己把 download 的錯誤碼對應到 import 動作。缺點：跳過 distributor（baseline 層，D146 後實際上已無 baseline）、多一份錯誤對應。
  - 其他。
- **建議與理由**：A。改動小、與 SSH 同一模式，第 4 步的錯誤（含 `server-bundle-unavailable` → 匯入）完全沿用 `distributeFailureError`，不另寫下載或錯誤對應。
- **影響**：決定第 4 步的接線與 `affects_files`。
- **是否阻擋後續步驟**：是（第 4 步）。

#### Q-2：U3「映像已內建 bundle」沒有偵測原語，要不要在 main 端補？
- **提問時間**：2026-11-04T16:13:43+0800
- **問題**：T0852 沒有判斷「映像本身已內建 bundle」的原語，renderer 無法得知（`docker/Dockerfile` 沒有 label；判斷依據只有映像的 ENTRYPOINT 是 `/opt/bat-server/bin/bat-server`，舊路徑 `startContainer(createIfMissing)` 就是靠它啟動）。
- **選項**：
  - A（建議）：`electron/docker-bundle-volume.ts` 加 `inspectImageBakedBundle(image)`：`docker image inspect --format {{json .Config.Entrypoint}}`（execFile＋timeout＋映像白名單），Entrypoint 含 `/opt/bat-server/bin/bat-server` → `baked: true`；IPC `docker:image-baked-bundle`。範圍擴大：`electron/docker-bundle-volume.ts`、`electron/__tests__/docker-bundle-volume.test.ts`、`electron/main.ts`、`electron/preload.ts`、`src/types/electron.d.ts`（Q-1 選 A 時有三個檔重疊）。pull 之後才查，所以本機一定有映像。
  - B：不改 main，renderer 以映像名稱判斷（repository 名稱是 `bat-server` 就當內建）。缺點：使用者自己改名的內建映像會被當成基底映像，去裝 bundle（結果仍能用，只是多裝一份、啟動方式改成 (c′)）。
  - 其他。
- **建議與理由**：A。判斷依據與舊路徑實際啟動方式一致，不靠名稱猜。
- **影響**：U3 略過安裝的判斷方式。
- **是否阻擋後續步驟**：是（第 4 步的分支）。

#### Q-3：「重跑＝升級」的辨識方式確認
- **提問時間**：2026-11-04T16:13:43+0800
- **問題**：memory_overrides 寫「沿用既有容器的路徑不受本單影響（W2 的選單與掛載照舊）」，但任務 4 的升級對象（BAT 以 (c′) 建立的容器）在精靈裡只能經「沿用既有容器」選到（「建立新容器」遇到同名容器會改用 `-2`，T0444）。
- **選項**：
  - A（建議）：選單與掛載完全照舊；只有在第 4 步發現所選的既有容器是 (c′) 容器（label `bat.server=1`，且有 type=volume、destination `/opt/bat`、Source 路徑含 `bat-server-<name>-bundle` 的掛載）時，才走升級：distributor（架構用 `docker exec` 的既有路徑即可）→ `installBundleIntoVolume(keepPrevious)` → 探測 → 第 5 步 `docker restart`；取消／失敗 `restoreBundleInVolume`＋再 restart，完成 `discardPreviousBundleInVolume`。其他既有容器（含 `bat-server:latest` 建的）行為與現在完全相同。
  - B：另加一個「升級既有 BAT 容器」模式選項。
  - 其他。
- **建議與理由**：A。不動 W2 的選單，升級判斷只看容器實際的掛載，不靠名稱。
- **影響**：第 4 / 5 步的升級分支。
- **是否阻擋後續步驟**：是（升級分支）；建立新容器的部分可以先做。

### 完成狀態
- **狀態**：DONE
- **一句話結論**：Docker 精靈改成 (c′)：「建立新容器」可填基底映像（預設 `buildpack-deps:bookworm-scm`），第 4 步依序 pull、判斷是否內建、相容性探測、經 distributor 取得 bundle、裝進 volume，第 5 步以基底映像建立容器。重跑在 BAT 建立的容器上就是升級：同版不動，不同版先問，取消或失敗會還原舊 bundle。WSL Docker 29.1.3 實測 18／18 PASS，拋棄式資源已刪除。
- **session_id**：5053b5b8-3a97-4b0b-ab2b-4f84a01590ae
- **產品 commit**：`f8af303c`（feat(docker-wizard): T0853 base image + bundle volume flow, re-run upgrades (W4b)）
- **落點檢查**：PASS。C-0：`repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`。C-1：PASS。C-3：條目都存在。C-2：工單沒有 `branch`，目前在 `main`。`CT_HOME` 未設定（不是 worktree）。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`。`CT_MODE` = `yolo`，`CT_INTERACTIVE` = `0`。
- **開工時狀態**：`TODO`（不是 `PENDING`），照常改成 `IN_PROGRESS`。

### 實作內容
| 任務 | 實作 | 位置 |
|---|---|---|
| 1 基底映像欄位 | 「建立新容器」在模式選單出現時（第一次、或跳回）以 `requestText` 詢問，預填目前值（預設 U2）。驗證規則與 main 的 `validateDockerImageRef` 相同，main 端會再驗一次。說明寫出需求（glibc ≥ 2.35、`/bin/sh`、`tar`、`gzip`，Alpine 不行）。取消就保留原值。「沿用既有容器」不會問 | `steps/docker/base-image.ts`（新）、`pick-container.ts`、`docker-flow.ts`（預設值） |
| U2 預設映像 | `buildpack-deps:bookworm-scm`。Docker Hub 2026-11-04 查詢：amd64 136,830,388 B、arm64 136,373,550 B（壓縮後約 130 MiB）。Debian 12，glibc 2.36。實測探測結果為 `glibc 2.36`，bundled node 可執行 | 同上 |
| 2 第 4 步真正安裝 | 依序：`pullImage`（進度、可中止）→ `imageBakedBundle`（U3）→ `probeBundleCompat({ image })` → `serverArch` → distributor（draft 帶 `dockerServerArch`）→ 建兩個 volume（記 ownership）→ `installBundleIntoVolume(keepPrevious)` → `probeBundleCompat({ image, bundleVolume })`。探測失敗會在建立任何東西之前停止，錯誤三語，並提供「修改基底映像」（跳回 pick-container）。下載失敗沿用「匯入本機 tarball…」 | `steps/docker/install-server-bundle.ts`（改寫） |
| 3 第 5 步以基底映像建立 | `createBatContainer`（`buildBatContainerRunArgs`）→ healthy → `readServerToken`（T0849）→ fetch-fingerprint → connect-test → write-profile（T0850 的更新邏輯）。後段步驟沒有改 | `steps/docker/start-server.ts` |
| 4 重跑＝升級（Q-3） | 「沿用既有容器」選到 (c′) 容器（label `bat.server=1`，且 `/opt/bat` 掛的是 `bat-server-<name>-bundle` volume）時：<br>• volume 內版本等於 `stripSnapshotSuffix(app 版號)`：不動<br>• 版本不同或讀不到：以 `requestChoice` 確認（說明會重啟容器、終端與 agent 會結束）<br>• 確認升級：distributor → `installBundleIntoVolume(keepPrevious)` → node 探測 → 第 5 步：執行中的容器 `docker restart`，停止中的容器 `docker start`<br>• 完成：`discardPreviousBundleInVolume`<br>• 取消或失敗：`restoreBundleInVolume`；若第 5 步已 restart，就再 restart 一次<br>• 選「先不升級」：照原本的沿用流程<br>容器、掛載、權杖、憑證都不變（實測 B3） | `install-server-bundle.ts`、`start-server.ts` |
| 5 U3 | pull 之後由 `imageBakedBundle` 判斷：`.Config.Entrypoint` 或 `.Config.Cmd` 含 `/opt/bat-server/bin/bat-server` 就是內建。內建時略過安裝，照 T0849 後的方式建立（`startContainer(createIfMissing)`＋data volume）。其他既有容器的行為完全不變 | 同上 |
| rollback | 只處理本次做過的事：<br>• 先移除本次建立的容器（volume 在使用中刪不掉）<br>• 再還原 `kept` 的舊 bundle<br>• 最後只刪 `created: true` 的 volume<br>重試時，若本次較早的嘗試已經安裝過，先 restore 再重裝，避免 `server.bat-old` 裡原本的 bundle 被覆蓋 | `install-server-bundle.ts`、`ownership.ts`（3 個新 key） |
| main（Q-1） | `server-bundle:distribute` 的 docker-linux draft 可帶 `dockerServerArch`（只接受 `linux-x64` / `linux-arm64`）。arch-detect 有值就直接用、不 `docker exec`；沒值時行為不變。WSL / SSH 不讀這個欄位 | `electron/main.ts`、`electron/remote/arch-detect.ts`、`src/types/electron.d.ts` |
| main（Q-2 / Q-3） | `inspectImageBakedBundle`（`docker image inspect`，只回傳布林與原因碼）、`readBundleVersionInVolume`（一次性 job，volume 唯讀掛載、`--network none`，讀 `server/package.json` 的 `version`）。IPC：`docker:image-baked-bundle`、`docker:read-bundle-version-in-volume`。日誌只記結果碼與版本 | `electron/docker-bundle-volume.ts`、`main.ts`、`preload.ts`、`electron.d.ts` |
| 錯誤對應 | 新增 9 筆 docker 項目（映像找不到、rate limit、pull 失敗、musl、glibc 太舊、缺工具、node 跑不起來、架構、volume），三語都有。`server-bundle-unavailable` / `-install-failed` / `-distribute-failed` 的 platforms 加上 `docker` | `error-mapper.ts`、`src/locales/*.json` |
| 進度顯示 | Shell 在 Docker 第 4 步執行中顯示「正在拉取 <image>：n / m 層」。只顯示本次 pull 的 `operationId`（step 把它放在 `ctx.state`），其他 pull 的事件忽略 | `SetupWizardShell.tsx`（`DockerPullProgress`） |

可選項（第 5 步比對憑證指紋與 handshake 指紋）：**沒做**。
- 原因：handshake 指紋是在 `steps/wsl/fetch-fingerprint.ts`（三個平台共用的步驟，不在本單範圍）取得，start-server 沒有這個值。
- 實測：兩者相同（A6、B3）。
- 若要做：在 fetch-fingerprint 的 Docker 分支呼叫 `readServerCertFingerprint` 比對，可交給 T0854 或另開單。

### 驗證
| 關卡 | 結果 |
|---|---|
| `npm run typecheck` | 0 |
| `npm run typecheck:electron` | 0 |
| `npm run test:unit` | 442 files passed / 3 skipped；8038 passed / 40 skipped，0 failed |
| `npm run test:legacy` | 33 / 33 檔、472 tests passed |
| `npx vite build` | 成功 |

三個關卡都在最後的程式碼（`f8af303c` 的內容）上重跑過；修正 pull 退回本機映像之後，也重跑了一次全部關卡。

新測試：
- `src/components/setup-wizard/steps/docker/__tests__/base-image-flow.test.ts`（25 例，用有狀態的 docker fake）：
  - 基底映像欄位：預設值、自訂值、驗證、取消、「沿用」不問
  - 建立：完整呼叫順序、draft 帶架構、`createBatContainer` 的參數
  - pull 進度只認本次的 id
  - 離線匯入後重試成功
  - musl 擋下、什麼都不建立
  - 每個錯誤碼都有對應，三語都有 title / body
  - 取消時刪容器＋兩個 volume；volume 不是本次建立的就不刪，裡面的舊 bundle 會還原
  - 重試會先還原
  - U3：內建映像、只在本機的映像改用本機那份、沒有本機那份就報錯、映像名稱不合法時不查本機
  - 升級：辨識、確認後升級、停止中的容器用 start、同版、snapshot 版號、拒絕、版本未知、restart 後失敗、restart 前失敗
  - 其他既有容器行為不變
- `src/components/setup-wizard/__tests__/docker-pull-progress.test.tsx`（2 例）
- `electron/remote/__tests__/arch-detect-docker-draft.test.ts`（6 例）：draft 的架構直接用、不 exec；不合法的值；沒值時照舊 exec；名稱先驗；WSL / SSH 不變；main 的驗證（source）
- `electron/__tests__/docker-bundle-volume.test.ts` 加 9 例：
  - 讀 `docker/Dockerfile` 的 ENTRYPOINT 判斷為內建；Cmd 也算
  - 只回傳布林與原因碼、名稱不參與判斷、不合法的映像不呼叫 docker
  - 版本解析、job 參數（`:ro`、`--network none`）
  - 在真 sh 下跑版本讀取腳本

既有測試照新流程更新：
- 預設映像斷言改成 `buildpack-deps:bookworm-scm`（3 檔）
- `server-bundle-import.test.tsx`：Docker 現在也有「匯入」動作
- `wizard-rollback-ownership` / `wizard-jump-rollback` 的 mock 回報「映像已內建」，所以這兩檔的「建立新容器」案例現在守的是 U3 路徑不回歸

WSL / SSH 精靈測試都沒改，全部通過。

### 真 Docker 實測（WSL Ubuntu-24.04，Docker 29.1.3 amd64）
做法：`npx tsx <scratchpad>/t0853-real-docker.mts <repo> <bundle cache>`。
- 精靈的第 4、5 步（`WizardRunner`）接上真的 main 端函式（`docker-bundle-volume` / `docker-lifecycle` / `docker-detect` / `arch-detect`），`docker` 轉成 `wsl.exe -d Ubuntu-24.04 --exec docker …`。
- distributor 是假的（它需要 Electron 的 `app`）：回傳本機 cache 中對應「app 版號」的 tarball（`0.7.3-pre.1` / `0.7.3-pre.3`），並對 draft 呼叫真的 `detectRemoteArch`。
- 埠 19853。

| 步驟 | 結果 |
|---|---|
| A1 建立（基底映像，bundle 0.7.3-pre.1） | PASS，17.6 s（含 pull 約 130 MiB），`kind=bundle-volume`，權杖讀到（長度 43，值未記錄） |
| A2 distributor draft | PASS：`{"targetOS":"docker-linux","dockerContainer":"bat-t0853-c1","dockerServerArch":"linux-x64"}` |
| A3 容器形狀 | PASS：User `0:0`、Image `buildpack-deps:bookworm-scm`、Entrypoint `/opt/bat/server/bin/bat-server`、Cmd 沒有 token、`127.0.0.1:19853`、Init `true`、label `bat.server=1` |
| A4 / A5 / A6 | volume 內版本 `0.7.3-pre.1`、healthy、`server-cert.json` 指紋＝openssl handshake 指紋 |
| B1–B5 重跑＝升級到 0.7.3-pre.3 | PASS：問了 1 次 → 版本 `0.7.3-pre.3`；restart 1 次、容器 Id 不變；權杖 hash 與 handshake 指紋都和 A 相同；finalize 後 volume 只剩 `server`；healthy |
| C1 同版重跑 | PASS：`current`，沒有問、沒有 restart（StartedAt 不變） |
| D1 / D2 升級後失敗 → 取消 | PASS：restart 後回報 unhealthy（測試注入）→ 取消 → restore → 再 restart（共 2 次）。版本回到 `0.7.3-pre.3`，容器保留且再次 healthy，權杖不變 |
| E1 建立後失敗 → 取消 | PASS：容器與兩個 volume 都已刪除 |
| F1 `alpine:3.20` | PASS：`docker-compat-musl`，沒有建立任何容器或 volume |
| G1 U3 本機映像 `bat-server:0.7.1-pre.6` | PASS：pull 失敗（`docker-image-not-found`）→ 改用本機那份 → `kind=baked`，沒有建 volume（只跑第 4 步） |
| Z 清理 | PASS：容器 / volume 清單與開工前相同；本次 pull 的 `buildpack-deps:bookworm-scm`、`alpine:3.20` 已刪除（開工前都沒有）。使用者原有的另一個 bat-server 容器、它的 volume 與映像都沒動 |

實測找到並修正一個問題（G1）：只在本機建置、沒推到 registry 的映像（例如 `npm run build:docker-image` 產生的 `bat-server:latest`，也就是 U3 的典型情況）`docker pull` 一定失敗，原本的流程會停在 pull。改成：pull 失敗、但本機有這個映像時，改用本機那份並記一行 warn。映像名稱不合法或使用者中止時不查本機。已補 3 個單元測試。

### 偏離與已知限制
- **`tests/__mocks__/electron-api.ts`（不在 affects_files）**：legacy 的 Docker journey（`tests/docker-flow-journeys.test.ts`、`docker-wizard-runner.test.ts` 等）共用這個 mock，缺新原語就會失敗（6 例）。依任務 6「既有 Docker 精靈測試依新流程更新」與 `test:legacy` 關卡，只在這個 mock 加 3 個函式（映像已內建 → 走 U3 路徑），測試檔本身沒動。
- **升級時的架構**：Q-3 的提案寫「沿用 `docker exec` 的既有路徑」。實作改成同樣帶 `dockerServerArch`，因為容器停止時 `docker exec` 會失敗；daemon 架構就是容器的架構。
- **volume 名稱**：由 `batVolumeNames` 固定為 `bat-server-<容器名>-bundle` / `-data`，所以實測的 volume 是 `bat-server-bat-t0853-c1-bundle` 這種形式，不是以 `bat-t0853-` 開頭。名稱都含 `bat-t0853-`，已全部刪除。
- **憑證指紋比對**：見上方〈可選項〉，沒做。
- **進度條**：pull 進度只有層數（T0852 原語本來就只回報層數）。distributor 的下載進度照舊只寫進日誌。
- **未實機驗證**：Electron UI 裡的完整精靈（含基底映像輸入框與升級確認卡）沒有在真 Docker 上走過，只跑了 runner＋main 函式；UI 部分有單元測試。arm64 daemon 沒有實測。

### 遭遇問題
- bash heredoc 內容含 `'` 時 Bash 工具解析失敗（`unexpected EOF`）。改用 Write 寫檔再執行，沒有影響產品。
- `electron/docker-bundle-volume.ts` 第一版版本讀取腳本的 sed 反向參照，在 TS 模板字串中變成八進位跳脫（TS1487）。改用 `grep | cut`，並在真 sh 下測過。
- 新測試的 `runToFailure` 第一版從 async 函式回傳 promise，被攤平造成死結（5 s 逾時）。改成回傳物件。

### 後續建議
- T0854（文件）：
  - CLAUDE.md / `docs/agent-guide` 的 Docker 精靈一節補上：(c′) 流程、預設映像、U3 用 Entrypoint / Cmd 判斷與本機映像退回、升級判斷（label＋`/opt/bat` volume＋版本比對＋確認）、rollback 順序（先容器、再還原、最後 volume）、Shell 進度以 `operationId` 過濾
  - `site/remote/docker.md`：拿掉「需要自己建置映像」、補基底映像需求與升級說明
  - T0743 shim 要放行：`image inspect`、`restart`
- 可選：在 fetch-fingerprint 的 Docker 分支比對 `readServerCertFingerprint`。
- `docker-acceptance.yml`：可把這次的 harness 改寫成雛形；distributor 要換成真的，或用 `BAT_SERVER_BUNDLE_BASE_URL`。

### 互動紀錄
- [16:13] Q-1～Q-3 經 BAT 通道送出（`q-9b669f0f-2f1fa077caca87b9` / `-c98a8926f0fc7330` / `-923824c2c44c35df`；前兩題 `--no-pty-write`，第三題 `--submit`）。
- [16:15] Q-1: draftProfile 收 `dockerServerArch`？ → A（塔台）: 採 A，4 個檔補進 affects_files，SSH / WSL 架構判斷不變 → Action: 改 main 驗證＋arch-detect，加測試。
- [16:15] Q-2: U3 偵測原語？ → A（塔台）: 採 A，`.Config.Entrypoint` 或 `.Config.Cmd` 任一含 `/opt/bat-server/bin/bat-server` 即內建；測試讀 Dockerfile 比對；名稱不參與判斷、只回布林與原因碼 → Action: 加 `inspectImageBakedBundle` ＋ IPC `docker:image-baked-bundle`。
- [16:15] Q-3: 升級辨識？ → A（塔台）: 採 A，另加：同版（讀得到 volume 內版本）不重裝不 restart；升級前 `requestChoice` 確認（會重啟容器、終端與 agent 結束），「先不升級」照沿用流程 → Action: 加讀 volume 內 `server/package.json` 版本的原語、升級確認選項（三語）、測試同版略過 / 拒絕 / 成功 / 失敗還原。
- [16:45] 真 Docker 實測 G1 發現：只在本機的映像 pull 一定失敗，U3 會卡在 pull → 在範圍內修正（改用本機那份），補測試；沒有另外提問。
