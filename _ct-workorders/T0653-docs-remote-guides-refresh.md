---
schema_version: 1
schema_kind: workorder
id: T0653
title: "`docs/` 遠端部署指南更新：依 T0646「底稿落後清單」與 BUG-156 / 157 / 159 修正後的行為，改寫 remote-dev-overview / wsl / ssh / docker 四份英文指南與 server-bundle-distribution"
type: docs
status: DONE
repo: better-agent-terminal
project: PLAN-049
priority: P3
sizing: M
created_at: "2026-10-18T18:52:03+0800"
started_at: "2026-10-18T18:53:29+08:00"
updated_at: "2026-10-18T19:09:09+08:00"
completed_at: "2026-10-18T19:09:09+08:00"
depends_on: [T0646, T0649, T0650, T0651]
related:
  - "T0646 回報區「底稿落後清單」（四份指南逐段的底稿 vs 實際 vs 出處）與「主張 → 出處」表；網站 `site/remote/*.md`（繁中、已依程式碼改寫，可當事實對照，但本單是英文開發者 / 進階使用者文件，不是翻譯網站）"
  - "BUG-156（T0649 `99abe9a1`：Docker 挑埠 9877–9976、Use existing 沿用公開埠）；BUG-157（T0650 `5594ec57`：釘選後儲存保留新指紋、釘選失敗顯示錯誤；TOFU 說明）；BUG-159（T0651 `5b1be0f5`：codex `--no-daemon`）；BUG-158（T0652 進行中：UI 字樣改中文 / i18n）"
affects_files:
  - docs/remote-dev-overview.md
  - docs/wsl-deployment.md
  - docs/ssh-deployment.md
  - docs/docker-deployment.md
  - "docs/server-bundle-distribution.md（只修 T0646 指出的不存在按鈕等落後處）"
  - _ct-workorders/T0653-docs-remote-guides-refresh.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 只改文件，不改任何程式碼、測試、`site/**`、`CLAUDE.md`、`docs/agent-guide/**`。文件維持英文。"
  - "🔴 事實以**目前 main 的程式碼**為準（含 `99abe9a1` / `5594ec57` / `5b1be0f5`）：T0646 的落後清單是起點，每一項改寫前再對一次程式碼；清單沒列但你發現的落後也一併修，列在回報區。不寫未實作或未驗證的承諾；未實機的行為（例如 Docker Create new 的實際錯誤訊息、非系統管理員的 codex daemon）照實標註。"
  - "🔴 UI 標籤：BUG-158（T0652）正在把遠端畫面的英文字樣改走 i18n。文件引用 UI 時寫 en 語系的字樣（以 `src/locales/en.json` 為準；T0652 尚未 commit 的新 key 不要引用，改用描述性寫法，例如「the pin button in the Edit connection dialog」），避免與 T0652 衝突。"
  - "🔴 內部編號：這幾份是 repo 內的開發文件，可以保留必要的 T / BUG / PLAN 參照，但刪掉只對內部歷史有意義、對讀者無用的引用（例如過時的分支名 `feature/plan-007-remote-dev`）。不放權杖、真實主機、使用者路徑；範例用 `dev-server`、`192.0.2.10` 這類明顯虛構值。"
  - "🔴 非隔離工單。T0652（改 `src/locales/**`、`src/components/**`、`site/remote/**`）同時進行，不碰它的檔。`src/styles/settings.css` 的 M 不是你的變更，不碰。commit 用 `git commit --only <檔案>`。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF。不 push。"
---

# T0653 — `docs/` 遠端部署指南更新

## 背景

T0646 把 `docs/` 的四份遠端指南改寫成網站 `/remote/` 時，發現四份都大幅落後於程式碼（例如 SSH 只剩 tunnel 模式、不能用密碼；WSL 沒有 systemd 無法完成；Docker 需要自己建置映像；精靈步驟 id 與 rollback 行為已變），列成「底稿落後清單」但依規定沒有改 `docs/`。之後 T0649 / T0650 / T0651 又改了 Docker 埠、指紋釘選、codex daemon 的行為。本單把這些文件更新到目前的實況。

## 要做的事

1. 依 T0646 落後清單逐項修正四份指南與 `server-bundle-distribution.md`，每項對一次程式碼。
2. 反映修正後的行為：Docker 挑埠（不再需要先改 BAT 的伺服器埠）、Use existing 沿用容器公開的埠；編輯連線裡的指紋釘選（TOFU、用已儲存的連線資料、儲存不再回退）；遠端 codex 分頁的 `--no-daemon` 條件（簡述，連到 `docs/agent-guide/bat-mcp-shim.md`）。
3. 補上底稿缺的：WSL keepalive、伺服器套件匯入本機 tarball、`BAT_SERVER_BUNDLE_BASE_URL`、升級時的 `.bat-new` / `.bat-old` / `.bat-prev`、各平台移除步驟的完整清單、同時最多 8 個遠端連線。
4. `remote-dev-overview.md` 的「Remote Tower」權限描述改成與 `HELPER_CHANNEL_ROLES` 一致（或改為連到 `docs/agent-guide/remote-tower-notify.md`，不在這裡複述整張表）。

## 驗證

- 每份文件內的相對連結都存在（`grep` 連結目標逐一確認）
- 回報區附：修正清單（文件 / 段落 / 改了什麼 / 程式碼出處）、新發現的落後項、仍未驗證的敘述清單

## 驗收

- 五份文件與目前 main 的行為一致；T0646 落後清單每一項都已處理或說明不處理的理由
- 只改 `affects_files`；未 push

## 回報區

### 結果摘要

**DONE**。五份文件（`docs/remote-dev-overview.md`、`wsl-deployment.md`、`ssh-deployment.md`、`docker-deployment.md`、`server-bundle-distribution.md`）已依目前 main（含 `99abe9a1` / `5594ec57` / `5b1be0f5`）改寫。T0646 落後清單 45 項全部處理；另修 13 項清單沒列的落後。三個唯讀子代理分別對照 WSL / SSH / Docker + overview 的程式碼，關鍵點我再抽查（Docker 權杖讀取、Docker 啟動時機、`legacyTargetOsPrompt`、S13、`buildBaseURL`、arch 偵測、path translator）。文件維持原語言（四份英文；`server-bundle-distribution.md` 原本就是中文，維持中文）。

### Landing Zone Check

- PASS。C-0：`repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal`（REPO_ROOT = `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）；C-1：工單在 REPO_ROOT 下；C-3：`docs/` 下五個檔都存在（informational）；C-2：工單無 `branch` 欄位，實際 `main`。
- 非隔離（`CT_HOME` 未設）；`CT_MODE=yolo`、`CT_INTERACTIVE=0`；`BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）。
- 開工時 `status` 是 `TODO`（不是 `PENDING`），照 `PENDING` 處理改為 `IN_PROGRESS`。

### 修正清單（T0646 落後清單逐項）

**`docs/wsl-deployment.md`**（整份重寫）

| 段落 | 改了什麼 | 程式碼出處 |
|---|---|---|
| Prerequisites | 刪 Windows 22H2 / 23H2 要求（不檢查版本；22621 只決定 Mirrored 警告） | `wsl-detect.ts` `windowsSupportsMirrored`、`steps/wsl/detect-env.ts` |
| Prerequisites | 不限 Ubuntu / Debian，名稱白名單 `^[A-Za-z0-9._-]+$` | `electron/wsl-validate.ts` |
| Prerequisites | 刪「套件要先放在 userData」，改為 cache → baseline → 下載，失敗可匯入 | `server-bundle-distributor.ts` |
| Installation | 入口改 **Profiles** → **+ More ▾** → Container → **Add WSL Profile**（HEAD 版 en.json） | `ProfilePanel.tsx`、`AddProfileMenu.tsx` |
| Step 表 | 改用實際 step id + en 標籤（9 步） | `wsl-flow.ts` `buildWslWizardSteps` |
| Step 2 | 只有一個 WSL2 時自動選，多個要選；WSL1 濾掉 | `steps/wsl/pick-wsl-distro.ts` |
| Step 3 | 另接受 `/etc/wsl.conf` 的 `systemd=true` | `wsl-detect.ts` `systemdEnabled` |
| Step 4 / Networking | 模式加 `virtioproxy` / `none`；`wslinfo` + `.wslconfig` 判斷；各模式警告 | `wsl-detect.ts` `detectNetworkMode`、`install-server-bundle.ts` |
| Step 5 / Port | linger 失敗會擋下並給「I've run the command, retry」；埠 9877–9976、避開 BAT 伺服器埠、升級沿用 | `write-systemd-unit.ts`、`error-mapper.ts`、`wsl-systemd.ts` `pickServerPort` / `pickServerPortForUnit` |
| Step 6 | 改為讀 TLS 握手憑證（沒有 HTTPS endpoint） | `electron/tls-fingerprint.ts`、`steps/wsl/fetch-fingerprint.ts` |
| Troubleshooting systemd | 改為「沒有 systemd 無法完成」：fallback 在 write-profile（Remote token missing）失敗並復原 | `write-profile.ts`、`wizard-runner.ts` |
| Troubleshooting「Profile created but connect-test failed」 | 刪除（connect-test 在寫設定前） | `wsl-flow.ts` 步驟順序 |
| Rollback | step id 改 `connect-test` / `write-profile` / `done`；設定在 write-profile 寫入、取消時刪除或還原；`.bat-old` 由 install-server-bundle 的 finalize 刪除 | `wsl-flow.ts`、`write-profile.ts`、`install-server-bundle.ts` |
| Editing | 刪 Re-run wizard 按鈕；釘選按鈕改寫為「Edit connection 對話框裡的 pin button」；卡片欄位依實際 | `ProfileCard.tsx`、`EditRemoteProfileModal.tsx`、`WslDetails.tsx` |
| Uninstall | 補 `.bat-old` / `.bat-new`、`loginctl disable-linger`、Windows 端 `bat-server-bundles` 快取 | `server-bundle-install-script.ts` |
| 全文 | 補 keepalive、匯入本機 tarball、`BAT_SERVER_BUNDLE_BASE_URL` | `wsl-keepalive.ts`、`server-bundle-import.ts` |

**`docs/ssh-deployment.md`**（整份重寫）

| 段落 | 改了什麼 | 程式碼出處 |
|---|---|---|
| Prerequisites | 刪 BAT v0.0.16+ / OpenSSH 8.0+；不檢查版本（`accept-new` 需 7.6+） | `ssh-args.ts`、`ssh-auth-probe.ts` |
| Prerequisites | 刪密碼登入：`BatchMode=yes` | `ssh-args.ts` `buildBaseSshArgs` |
| Prerequisites | `bash` 改為 `sh` + `loginctl` / `awk` / `/proc`（Linux）/ `lsof`（macOS）；加 port forwarding 要求 | `ssh-start-server.ts` `buildVerifyCommand` |
| Installation | 入口改 Remote → **Add SSH Profile** | `ProfilePanel.tsx` |
| SSH-config alias | 直接讀 `Host` 行（不含 `Include`、萬用字元、`Match`）；只問主機，安裝路徑固定 | `ssh-config-parser.ts` `listSshHosts`、`configure-host.ts` |
| Installation 表 | 刪上傳速度 / ETA 進度條（有算、沒顯示）；step id + en 標籤 | `ssh-bundle-uploader.ts`、`install-server-bundle.ts`、`ssh-flow.ts` |
| Tunnel vs Direct | 改為 Tunnel only；本機端埠由系統挑、失敗重試一次；`tunnelLocalPort` 欄位存在但精靈不設 | `configure-host.ts` `normalizeSshTunnelMode`、`ssh-tunnel.ts`、`remote-client.ts` |
| systemd vs launchd | `enable` + `restart` + 每次 linger；plist 沒設 log 路徑；macOS 登入後才啟動；資料目錄 | `ssh-start-server.ts`、`ssh-wizard-verify.ts` |
| Troubleshooting permission-denied | 改為 Edit SSH settings / Retry / Cancel，無金鑰檔選擇器、BAT 不產生金鑰 | `error-mapper.ts`、`verify-auth.ts` |
| Troubleshooting 埠 | 51820 → 9876 | `ssh-flow.ts` `DEFAULT_SERVER_PORT` |
| Troubleshooting 斷線 | 改 `min(30 s, 1 s × 2^n)` + 抖動；5 次只限通道重建、沒有對話框 | `remote-client.ts` `computeReconnectDelay` / `TUNNEL_MAX_RESTART_FAILURES` |
| Rollback | 升級還原 `.bat-old` / `.bat-prev`；設定在第 7 步寫入 | `server-bundle-install-script.ts`、`start-server.ts`、`write-profile.ts` |
| Editing | 刪 Re-run wizard 與傳輸模式切換 | `ProfileCard.tsx` |
| Uninstall | 補 `~/.local/share/bat-server`、macOS `~/Library/Application Support/bat-server`、`.bat-old` / `.bat-new` / `.bat-prev`、linger | `ssh-wizard-verify.ts`、`ssh-start-server.ts` |

**`docs/docker-deployment.md`**（整份重寫）

| 段落 | 改了什麼 | 程式碼出處 |
|---|---|---|
| Prerequisites | 刪 `feature/plan-007-remote-dev` 分支；改為建議切到 BAT 版本的 tag、需原始碼建映像；開頭加「映像要自己建置」 | `scripts/build-docker-image.mjs` |
| Notes | 刪「wizard integration tracked separately」，補完整精靈 9 步 | `docker-flow.ts` |
| Usage Modes | mode A / B 改為 Create new / Use existing；Use existing 取 `docker ps -a` 第一個 | `pick-container.ts`、`docker-detect.ts` |
| Dev Container | 改寫：Use existing 不套用掛載（只存在設定、供路徑轉換）、須是最新容器、主機埠避開 9876。**T0646 的「Use existing 讀不到權杖」經查不成立**（見新發現與後續建議 1），文件寫「讀 `server-token.json`，程式碼追蹤、未實機」 | `docker-lifecycle.ts` `startContainer`、`remote-server.ts` `persistToken`、`headless-entry.ts` |
| Rollback | 刪 `build-image` / `start-container` 步驟；`start-server` 只 `rm -f` 這次建立的容器；Use existing 這次才啟動的會停回去；volume 保留 | `steps/docker/start-server.ts`、`ownership.ts` |
| Editing | 卡片欄位 Container / Host / Target / Mounts；無重跑按鈕；釘選在 Edit connection；精靈每次新增設定 | `details/DockerDetails.tsx`、`write-profile.ts` |
| Health check | 精靈最多等 45 秒（`none` 視為就緒） | `start-server.ts` `HEALTH_WAIT_MS` |
| Mounts | 只能一個資料夾、`/workspace/<資料夾名稱>` | `configure-mounts.ts` |
| 全文（9876 衝突） | 依 BUG-156 修正後行為改寫：Create new 挑 9877–9976、避開 BAT 伺服器埠；Use existing 沿用容器公開的 9876/tcp 主機埠，只有 BAT 正在聽該埠才拒絕；埠衝突移除這次建立的容器、重試換埠；不必先改 BAT 伺服器埠 | `docker-lifecycle.ts` `pickDockerServerPort`、`main.ts` `docker:pick-server-port`、`start-server.ts` |

**`docs/remote-dev-overview.md`**

| 段落 | 改了什麼 | 程式碼出處 |
|---|---|---|
| Troubleshooting › Connection lost | 刪「約 30 秒後 Retry now / Open profile 對話框」，改狀態「Reconnecting…」+ 一次性提示 + SSH 5 次後「Connection lost」 | `remote-client.ts`、`App.tsx`、HEAD en.json |
| Troubleshooting › Fingerprint mismatch | 依 BUG-157 修正後行為改寫：Edit connection 的 pin button（描述性寫法）、儲存保留新指紋、失敗顯示原因；TOFU、用已儲存的連線資料；或重跑精靈（WSL / SSH 更新指紋與權杖，Docker 新增設定） | `ProfilePanel.tsx` `handlePinFingerprint` / `handleSaveRemote`、`EditRemoteProfileModal.tsx`、T0650 回報 |
| Choosing your deployment | 刪「可依指南乾淨移除」，改為沒有一鍵移除、各指南列指令；刪 direct 模式 | `profile-manager.ts`、`configure-host.ts` |
| Profile schema migration | 刪「提示重跑精靈」，改為卡片上的警告 banner + targetOS 下拉（描述性；`profiles.legacyTargetOsPrompt` 是 T0652 未 commit 的 key，不引用） | `ProfilePanel.tsx` |
| Remote Tower › Capability scope | 改為與 `HELPER_CHANNEL_ROLES` 一致的三列表（tower / worker / 兩者），細節連到 `docs/agent-guide/remote-tower-notify.md` | `helper-capability.ts` |
| Remote Tower › Limits | raw command 改為 T0579 起允許（附差異），不再寫「一律 Forbidden」 | `helper-capability.ts`、`remote-tower-notify.md` |
| PathTranslator | 改為 SSH 視窗拒絕本機檔案；測試路徑改為實際存在的檔 | `path-translator.ts` `resolveClientPaths` |
| TLS | 連結改 `docs/agent-guide/remote-security.md`；fetch-fingerprint 改為 TLS 握手 | `tls-fingerprint.ts` |
| 相關文件（server-bundle-distribution 的「Upgrade server bundle」按鈕） | 已在該檔改寫（見下） | — |

**`docs/server-bundle-distribution.md`**（只修落後處，維持中文）

| 段落 | 改了什麼 | 程式碼出處 |
|---|---|---|
| 升級既有 server bundle | 刪「Upgrade server bundle」按鈕預告（不存在），改為重跑精靈的實際升級流程（`.bat-new` / `.bat-old` / `.bat-prev`、沿用埠、更新同一筆設定） | `server-bundle-install-script.ts`、`write-profile.ts`、`ssh-start-server.ts` |

### 工單「要做的事」第 2–4 點對照

- 2（修正後行為）：Docker 挑埠與 Use existing 沿用公開埠 → `docker-deployment.md` § Ports；指紋釘選（TOFU、已儲存資料、儲存不回退）→ overview § Fingerprint mismatch；遠端 codex `--no-daemon` 條件 → overview § Remote Tower › Limits（連 `bat-mcp-shim.md`）。
- 3（補缺）：WSL keepalive → `wsl-deployment.md` § After setup；匯入本機 tarball / `BAT_SERVER_BUNDLE_BASE_URL` → WSL / SSH § Server bundle source、overview § Server bundle；`.bat-new` / `.bat-old` / `.bat-prev` → WSL / SSH § Upgrade、Rollback；各平台完整移除清單 → 三份 § Uninstallation；同時最多 8 個 → overview § Several remote profiles（原有，補「已開的設定再開會切過去」）。
- 4（權限描述）：overview § Capability scope 改為 `HELPER_CHANNEL_ROLES` 摘要表 + 連 `remote-tower-notify.md`。

### 新發現的落後項（清單沒列，已修）

| 文件 | 原寫法 | 實際 | 出處 |
|---|---|---|---|
| server-bundle-distribution | `normalizeArch()` 在 `electron/remote/arch-normalize.ts` | `src/lib/arch-normalize.ts` | — |
| server-bundle-distribution | manifest 在 `electron/remote/server-bundle-manifest.ts` + `scripts/_bat-build-manifest.mjs` | `src/lib/server-bundle-manifest.ts` + `scripts/generate-server-bundle-manifest.mjs` | — |
| server-bundle-distribution | `resolveBaseUrl()` | `buildBaseURL()`（`src/lib/server-bundle-download-helpers.ts`）；補註：env 整串取代 base URL、不自動加版號路徑，mirror 必須對應目前版號 | `server-bundle-download-helpers.ts` |
| server-bundle-distribution | Docker 以 `docker inspect` 讀 image `Architecture` | 精靈不偵測 arch（`arch-detect.ts` 有 `docker exec uname -m` 分支但不被呼叫） | `steps/docker/install-server-bundle.ts`、`arch-detect.ts` |
| server-bundle-distribution | 開頭說 bundle 用於 WSL / SSH / Docker；step 名 `install-bundle` | 只用於 WSL / SSH；step id `install-server-bundle` | 同上 |
| docker | 「reconnect path 會 `docker start`」 | 只有精靈會啟動容器，開啟設定 / 重連都不會 | `src/**` 只有 `start-server.ts` 呼叫 `startContainer` |
| docker | Dev container 範例與 smoke 用 `-p 127.0.0.1:9876:9876` | 會撞 BAT 自己的 9876，改用 9880 並註明 | `main.ts` `REMOTE_PORT_DEFAULT` |
| docker | Dockerfile 有 platform | Dockerfile 沒有，`--platform linux/amd64` 在建置腳本 | `scripts/build-docker-image.mjs` |
| ssh | 卡片可驗證 SSH 連線（舊稿暗示） | SSH 卡片的 Test connection 不開通道，探的是本機 `localhost:9876`；details 的 Connection 列顯示 `localhost:9876` 而非實際本機端埠（寫成已知落差，見後續建議 3） | `ProfilePanel.tsx`、`main.ts`、`SshDetails.tsx` |
| ssh | Host key failed 有對應對話框（隱含） | 沒有 registry entry，走「Step failed」fallback | `error-mapper.ts` |
| overview | 比較表「NAT-friendly / Cross-OS path translation / Setup time」等 | 改為需要什麼、伺服器來源、架構、網路、升級、本機附件 | 各 flow |
| overview | `SetupWizard.tsx`；「profile 只在 `done` 後寫入」；`tests/path-translator-*.test.ts` | `SetupWizardShell.tsx`；在 `write-profile` 寫入、rollback 刪除 / 還原；實際存在的測試檔 | `setup-wizard/*`、`tests/` |
| overview | `smoke:remote:headless` S13 預期 raw command `Forbidden: channel-not-allowed` | T0579 起塔台權杖可呼叫 `terminal:create-with-command`；文件加註「這半段已過時、未重跑」（腳本未改，見後續建議 2） | `scripts/smoke-remote-headless.mjs` `checkHelperProbeAnswers`、`helper-capability.ts` |

### 仍未驗證的敘述

全部以程式碼追蹤為準，本單未實機跑任何精靈。文件內已標註的有：
- Docker **Use existing** 接上 Create new 建立的容器時讀得到權杖（`docker exec … cat server-token.json`；伺服器每次啟動都寫此檔）：程式碼追蹤，未在 Docker 主機實測。
- Docker 實際錯誤訊息（埠衝突、找不到映像時 `docker run` 嘗試 pull 的錯誤）未在 Docker 主機重現。
- Docker 在 macOS 主機：程式碼沒有限制，未測。
- 遠端 codex `--no-daemon`：未對真實遠端 codex daemon 測試。
- S13 raw command 那半段對 T0579 後的伺服器應該失敗：依程式碼推論，未重跑 smoke。

未特別標註、但同樣只有程式碼依據的：WSL keepalive 行為、SSH 斷線後 5 次停止、macOS LaunchAgent 登入後才啟動、各 rollback 細節（皆有單元測試涵蓋，引用在各文件）。

### 驗證

| Lane | 結果 | 證據 |
|---|---|---|
| source / docs：相對連結 | PASS | 自寫 node 腳本檢查五份文件的相對連結與錨點（GitHub slug、略過 code fence）：57 個連結、0 錯；commit 後重跑同結果 |
| source / docs：UI 字樣 | PASS | 引用的 en 字樣（約 50 個，如 `+ More ▾`、`Add WSL Profile`、各 step 標籤、`Reconnecting…`、`Import local tarball…`）逐一在 `git show HEAD:src/locales/en.json` 中 grep 到；T0652 未 commit 的 key（`legacyTargetOsPrompt` 等）與它要改的硬寫字串（systemd 警告、Docker 模式提示、密碼字樣、`Pin expected fingerprint`）改用描述性寫法 |
| source / docs：殘留字樣 | PASS | grep `Pin expected fingerprint`、`Re-run wizard`、`51820`、`feature/plan-007`、`Retry now`、`SetupWizard.tsx`、`tests/path-translator-` = 0；唯一的 `gowerlin` 是既有的官方下載端點 URL |
| 隱私 | PASS | 範例只用 `dev-server`、`you@dev-server`、`jump-host`、`192.0.2.10`、`/path/to/project`；無權杖、使用者路徑、真實主機 |
| 換行 | PASS | 五份 `\r` 計數 = 0（LF） |
| build / tests | N/A | 只改 `docs/*.md`，不在 vite / vitest / typecheck 範圍 |

### Commit

- 文件：`9dd30ef0` `docs(remote): refresh WSL / SSH / Docker guides and overview to current behavior (T0653)`（5 檔，+978 / −860，`git commit --only`）
- 工單檔：本次收尾 commit
- 未 push。T0652 的檔（`src/**`、`site/remote/**`、其工單）與 `src/styles/settings.css` 未碰。

### 遭遇問題 / 偏差

- `src/locales/*.json` 工作樹有 T0652 未 commit 的變更（例如新增 `profiles.legacyTargetOsPrompt`），一開始讀到的是工作樹版本；後來改以 `git show HEAD:src/locales/en.json` 為準重新核對所有引用。
- 子代理對 T0646 的一項結論提出相反結果（Docker Use existing 讀得到權杖），我抽查 `docker-lifecycle.ts` 與 `RemoteServer.start` 確認後採用程式碼結論；網站 `site/remote/docker.md` 仍寫「可能讀不到權杖」（不在本單範圍，見後續建議 1）。
- `server-bundle-distribution.md` 是中文文件，工單「文件維持英文」理解為維持各檔原語言，未翻譯。

### 給塔台的後續建議（範圍外，未處理）

1. **網站 `/remote/docker` 的「Use existing 可能讀不到權杖」不成立**：`startContainer` 對既有容器會 `docker exec <name> cat /root/.local/share/bat-server/server-token.json`，headless 的 `RemoteServer.start` 每次都 `persistToken`（無 safeStorage → 明文）。T0652 正在改 `site/remote/docker.md`，可一併修。
2. **`smoke:remote:headless` S13 過時**：`checkHelperProbeAnswers` 仍要求 raw command 回 `Forbidden: channel-not-allowed`；T0579 後塔台權杖可用 `terminal:create-with-command`，對新伺服器 S13 應該失敗，且探測命令（`echo …-s13-denied`）可能真的建出一個分頁。建議開小單更新 S13。
3. **SSH 卡片兩個落差**（產品）：`SshDetails.tsx` 的 Connection 列顯示 `localhost:${tunnelLocalPort || 9876}`，動態埠時顯示的是遠端埠；SSH 卡片的「Test connection」不開通道，探測本機 `localhost:9876`（可能碰到 BAT 自己的伺服器）。
4. **SSH `verify-auth.ts` 的 `serverMetadata.serverArch`** 把非 `arm64`（含 `aarch64`）記成 `x64`；安裝用的是原始值，不影響功能，只影響 metadata。
5. **SSH configure-host 的 en 說明**（`wizard.ssh.step.configureHost.description`）寫「Pick host, user, port, identity, and install path」，實際只問主機；可併入 BUG-158 的字樣調整。
6. **WSL 沒有 systemd 時的 fallback 警告**（`wsl-systemd-check.ts` / `done.ts`）承諾手動 `wsl exec`，但流程一定在 write-profile 失敗；建議在第 3 步直接擋下並說明，或刪掉 fallback 字樣（字樣改了仍有流程面問題）。

### 互動紀錄

無（yolo，未向塔台提問）。
