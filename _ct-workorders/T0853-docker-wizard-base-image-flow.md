---
schema_version: 1
schema_kind: workorder
id: T0853
title: "Docker 精靈 W4b：(c′) 精靈步驟（基底映像欄位、server bundle 裝進 volume、以基底映像建立容器、重跑即升級）"
type: implementation
status: IN_PROGRESS
repo: better-agent-terminal
project: PLAN-052
priority: P2
sizing: M
created_at: "2026-11-04T15:18:27+0800"
started_at: "2026-11-04T16:11:24+08:00"
updated_at: "2026-11-04T16:11:24+08:00"
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
renew_count: 0
workdir: main repo
worker_question_timeout: 30
tower_question: open
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
- **工單編號**：T0853｜**類型**：implementation｜**狀態**：IN_PROGRESS｜**建立**：2026-11-04 15:18 (UTC+8)
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

（Worker 填寫）
