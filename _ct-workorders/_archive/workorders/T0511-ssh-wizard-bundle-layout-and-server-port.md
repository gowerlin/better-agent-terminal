---
schema_version: 1
schema_kind: workorder
id: T0511
title: "修 SSH wizard 安裝 / 啟動：bundle 解壓去掉 staging/（BUG-120）、unit / plist 正確傳 port 與 bind 並修 verify fallback（BUG-121）、permission-denied 動作按鈕；以 T0510 的 e2e/pre5-ssh-alias.spec.ts 在不套 workaround 下全綠驗證"
type: implementation
status: DONE
repo: better-agent-terminal
project: D139
priority: P1
sizing: M
created_at: "2026-10-14T02:36:13+0800"
started_at: "2026-10-14T02:38:19+0800"
updated_at: "2026-10-14T02:55:20+0800"
completed_at: "2026-10-14T02:55:20+0800"
target_version: "0.6.0-pre.6"
depends_on:
  - T0510
related:
  - BUG-120
  - BUG-121
  - "T0510 回報區（A6、發現的產品缺陷 1 / 2、其他觀察 1）"
  - "e2e/pre5-ssh-alias.spec.ts、e2e/real-remote/t0510-ssh-alias-env.mjs、t0510-sshd.Dockerfile（T0510 產出，本單用來驗證）"
  - "T0505 / T0506（SSH alias，本單不得破壞）"
affects_files:
  - electron/remote/ssh-bundle-uploader.ts
  - electron/remote/ssh-start-server.ts
  - electron/remote/__tests__/
  - src/components/setup-wizard/__tests__/
  - src/components/setup-wizard/
  - src/locales/
  - e2e/pre5-ssh-alias.spec.ts
  - e2e/real-remote/
  - CLAUDE.md
  - _ct-workorders/T0511-ssh-wizard-bundle-layout-and-server-port.md
  - _ct-workorders/BUG-120-ssh-wizard-bundle-extracts-into-staging-subdir.md
  - _ct-workorders/BUG-121-ssh-service-unit-wrong-port-env-name.md
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **Docker / WSL**：沿用 T0510 規則——只操作 `bat-t0510-*` + label `bat.t0510=1` 的容器 / network（可重用 T0510 env 腳本與 image `bat-t0510-sshd:local`）；不得 `docker system prune`、不得動其他容器（含 `bat-t0467-*`）；不得 `wsl --shutdown` / `--terminate`；不得動 WSL `~/.local/bat-server`；收尾 `down`。"
  - "🔴 **`~/.ssh/config`**：只能經 T0510 env 腳本的 `apply-ssh-config` / `restore-ssh-config`（帶標記區塊、備份、還原後比對 SHA-256）；回報區附還原後雜湊，必須等於 T0510 記錄的原檔 `00aab1cd…c58a2`（若原檔在這期間被使用者改過，以本單開始時的備份為準並說明）。真實 known_hosts / 金鑰不動。"
  - "🔴 **不碰使用者正在用的 BAT**（port 9876、真實 userData 只讀）；不得以預設實例啟動；e2e 一律隔離實例。"
  - "🔴 **不得消耗 Claude token**（不開 Claude Agent session、不送 prompt）。"
  - "🔴 **禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）；寫檔維持 LF；不 push；不跑全套 `npm run test:e2e`（L141）。"
---

# T0511 — SSH wizard 安裝 / 啟動修正（BUG-120 / BUG-121）

## 背景

T0510 以自動化實機驗收發現：pre.5 的 SSH wizard 在乾淨 Linux 目標上 `start-server` 必定失敗，原因有兩個獨立缺陷（詳見 BUG-120 / BUG-121 與 T0510 回報區）。T0505 / T0506 的 alias 行為在測試側 workaround 下全部正確，本單只修安裝 / 啟動。

## 任務

### A. BUG-120 — bundle 解壓多一層 `staging/`

1. `electron/remote/ssh-bundle-uploader.ts:47` 的遠端解壓與 WSL（`electron/wsl-detect.ts:338`）對齊，讓 bundle 落在 `<installPath>/bin/…`。先確認 release tarball（`scripts/build-server-bundle.mjs:430`）頂層確實是 `staging/`；若要容許「頂層不是 `staging/`」的 tarball（例如手動 / 舊版 bundle），回報區說明你的判斷
2. **既有壞安裝**：pre.5 跑過 SSH wizard 的主機可能留下 `<installPath>/staging/`。確認重跑 wizard 或「重新安裝 bundle」能得到正確佈局（必要時清掉殘留的 `staging/`，**只清本工具建立的路徑**）
3. 盤點其他會解 server bundle tarball 的路徑（Docker、remote update / distributor、dev-deploy 等），列出是否有同類問題；**在本單範圍內的 SSH 路徑修掉**，其他路徑若有問題在回報區列出，不修

### B. BUG-121 — port / bind 設定名稱錯誤 + verify fallback

1. `electron/remote/ssh-start-server.ts` 的 systemd unit 與 launchd plist 改成 bat-server 真正讀得到的方式（`scripts/bat-server.mjs`：`--port` / `BAT_SERVER_PORT`、`--bind-interface`）。**必須相容已部署在遠端的舊版 bundle**（不能只改 `bat-server.mjs` 讓它多讀 `BAT_REMOTE_PORT`，因為遠端舊 bundle 不會更新）；選命令列參數或 `BAT_SERVER_PORT`，回報區說明理由
2. verify：`ss -tnlp | grep ':9876' || pgrep -x bat-server` 的 fallback 比對不到實際行程（node `MainThread`），改成可靠的判定（例如 `systemctl --user is-active` / `launchctl` 狀態 + 埠檢查），不得因 fallback 過寬而把「沒在 9876 監聽」判成成功
3. 查 git 歷史：這兩個缺陷從哪個 commit / 版本開始，SSH wizard 是否在任何已發佈版本上真的能在 Linux 目標完成（給 release notes 用）

### C. permission-denied 的動作按鈕（T0510 其他觀察 1，low）

`verify-ssh-auth` 回 `permission-denied` 時，失敗步驟顯示通用的「重試 / 跳過 / 編輯設定 / 取消」，沒有 `error-mapper.ts` `ssh-permission-denied` 條目宣告的「修改 SSH 設定」（`wizard.action.editSshSettings`）。查清楚 mapped action 為何沒有呈現，修到 mapped action 會顯示且行為等同跳回 `configure-ssh-host`；三語 i18n 齊全。若查證後判定現行行為是刻意設計，回報區說明理由，不改

### D. 驗證

1. 單元測試：A / B / C 各有測試（unit 內容、plist 內容、遠端解壓指令、verify 判定、mapped action），HEAD 上先寫的測試應失敗（red）
2. **e2e（關鍵）**：以 source build（`npx vite build`，不設 `BAT_E2E_EXECUTABLE`）跑 `node e2e/real-remote/t0510-ssh-alias-env.mjs up` → `BAT_E2E_PRE5_SSH=1 BAT_E2E_PRE5_SSH_WORKAROUND=0 npx playwright test e2e/pre5-ssh-alias.spec.ts` → **A6-0 stock install 轉綠，其餘子項全綠** → `down`。若 spec 在 source build 下需要 bundle 來源調整（例如 dev 模式從哪裡拿 tarball），只改 e2e 側並說明
3. 若 spec 的 workaround 已無必要，可移除或保留為 opt-in，回報區說明
4. `npx vite build`、`npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npm run test:unit` 全綠
5. CLAUDE.md：在 SSH 相關段落補一行 bundle 佈局（strip `staging/`）與 port / bind 傳遞方式（簡短，事實性）

## 驗收條件

- [x] BUG-120 / BUG-121 修正，有 red → green 單元測試
- [x] `e2e/pre5-ssh-alias.spec.ts`（workaround 關閉）全綠，A6-0 PASS；回報區附各子項耗時與關鍵 log 行
- [x] 舊版 bundle 相容性說明（B1）與既有壞安裝處理（A2）
- [x] C 修好或有理由不改
- [x] typecheck 雙 0、unit 全綠、vite build exit 0
- [x] 收尾：`docker ps -a --filter label=bat.t0510=1` 空；`~/.ssh/config` 還原雜湊一致
- [x] BUG-120 / BUG-121：`status: FIXED`、`fixed_at`、body 狀態列同步、修正摘要

## Sub-session 執行指示

1. 讀本工單、BUG-120 / BUG-121、T0510 回報區 A6 節與 `e2e/pre5-ssh-alias.spec.ts`、`e2e/real-remote/t0510-ssh-alias-env.mjs`
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 實作 → 驗證 → 填回報區；全部達成寫 `DONE`，否則 `PARTIAL` / `BLOCKED`
4. commit 本單改動檔（`git commit --only` 或精準 stage）；不 push；依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫

### 結果摘要

**DONE**。BUG-120 / BUG-121 / C 皆修正並有 red → green 單元測試；`e2e/pre5-ssh-alias.spec.ts` 在 source build、`BAT_E2E_PRE5_SSH_WORKAROUND=0` 下 **2 passed**（A6-0 stock install PASS，A6-1..5 全 PASS）；`npx vite build` exit 0、`npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npm run test:unit` 206 檔 / 3474 passed（1 skipped，既有）。

### Landing zone

- C-0：`repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal` → PASS（REPO_ROOT `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）
- C-1 PASS；C-3 PASS（`electron/remote/ssh-bundle-uploader.ts` 等皆存在）；C-2 無 `branch` 欄位（main）
- `BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）；`CT_MODE=yolo`、`CT_INTERACTIVE=0`
- 原狀態為 `TODO`（非 `PENDING`），視同首次開工

### A. BUG-120（bundle `staging/`）

- A1：release tarball 頂層確為 `staging/`（`scripts/build-server-bundle.mjs:430` `tar -czf <bundle> staging`，T0271 `42eab95` 起即如此）。遠端指令改為（`buildExtractCommand`）：
  `mkdir -p '<p>' && cd '<p>' && { if [ -f staging/bin/bat-server ]; then rm -rf -- staging; fi; } && tar xz --strip-components=1 && { test -x bin/bat-server || { echo 'server bundle layout unexpected: bin/bat-server missing after extract' >&2; exit 1; }; }`
  - **頂層不是 `staging/` 的 tarball**：不另做相容。所有產出路徑（build script、CI release）都是單一 `staging/` 頂層，WSL / Docker / e2e Dockerfile 的解法也都 strip；手動 / 舊版 bundle 出自同一 script。改以「解完 `test -x bin/bat-server`」把非預期佈局變成上傳步驟的明確錯誤，不會再寫出 203/EXEC 的 unit
- A2：既有壞安裝 — 只在 `<installPath>/staging/bin/bat-server` 存在時刪 `<installPath>/staging`（`cd` 成功後才執行，位於 `&&` 鏈中）。重跑 wizard 即得正確佈局；e2e A6-2 先在 jump 容器預置 `staging/bin/bat-server`，wizard 後 `ls` = `README.md bin electron node_modules package.json scripts`
- A3：其他解 tarball 的路徑盤點（皆無同類問題，未修改）：

  | 路徑 | 方式 | 結果 |
  |---|---|---|
  | WSL `electron/wsl-detect.ts` `installBundle` | `tar -xzf … -C <p> --strip-components=1` | OK |
  | Docker `docker/Dockerfile:11` | `tar xzf … --strip-components=1` | OK |
  | `e2e/real-remote/Dockerfile:33` | `--strip-components=1` | OK |
  | `scripts/dev-deploy-headless.mjs` | 複製檔案到既有 install root，不解 tarball | N/A |
  | `server-bundle-distributor.ts` / `server-bundle-download.ts` | 只下載 / 快取 / 驗 SHA，不解壓 | N/A |
  | `scripts/verify-server-bundle.js` | 解到自己的 `extract/` 做檢查，已知 `staging/` | OK |

### B. BUG-121（port / bind + verify）

- B1：選**命令列參數** `--port <serverPort> --bind-interface localhost`（systemd `ExecStart`、launchd `ProgramArguments`），移除 `BAT_REMOTE_PORT` / `BAT_REMOTE_BIND`。理由：① bind 只有 `--bind-interface`，沒有 env 對應，只能用參數；② `--port` / `--bind-interface` 自 T0272（`1fbb0bd`，第一版 `bat-server.mjs`）即存在、`git log -S` 確認從未變動 → 任何已部署舊 bundle 都吃得到（launcher `bin/bat-server` 以 `exec … "$@"` 轉傳）；③ 參數優先於 `BAT_SERVER_PORT`，不受 service manager 傳下來的 env 影響；④ 與 `docker-lifecycle.ts`（`--port 9876`）一致。**實證**：e2e 上傳的 bundle 是已安裝 pre.5 的 baseline（`bat-server-linux-x64-v0.6.0-pre.5.tar.gz`），bat-server 未改即 `listening on 127.0.0.1:9876`
  - `serverPort` 驗整數 1–65535，不合法在任何 ssh exec 前 throw
  - enable 階段（延伸，同屬「unit 正確生效」）：systemd `enable --now` → `enable` + `restart`（已在跑的服務重跑 wizard 時 `enable --now` 不重啟，會留舊 bundle / 舊參數；與 WSL `wsl-systemd.ts` 的 `restart` 一致）；launchd 先 `unload`（忽略錯誤）再 `load -w`。e2e A6-1 / A6-2 即在 A6-0 已安裝且運行中的 jump 容器上重跑，皆 PASS
- B2：verify 改為 `buildVerifyCommand()`，以 `sh -c '<script>'` 執行（迴圈不依賴 login shell），每秒一次、最多 20 次：
  - systemd：`is-active` = `active` **且** `systemctl --user show -p MainPID` 的行程擁有 `/proc/net/tcp{,6}` 中 state `0A`、本地埠 = port 的 socket（inode ↔ `/proc/<pid>/fd`）。其他行程佔用該埠不算
  - launchd：`launchctl list` 中 `com.bat-server` 的 PID 以 `lsof -nP -a -p <pid> -iTCP:<port> -sTCP:LISTEN` 監聽
  - 失敗輸出 `bat-server.service is <state> (MainPID <pid>); no socket of that process listens on port <port>`，exit 1 → `verify-failed`
  - 移除 `pgrep -x bat-server`（行程為 node，comm=`MainThread`）與不看擁有者的 `ss | grep ':<port>'`
  - macOS 路徑（plist / `lsof`）只有單元測試覆蓋，無 macOS 實機（見「仍需真人」）
- B3（release notes 用）：
  - BUG-120 起源 T0285 `0a89800`（2026-04-26，`tar xz` 無 strip）；BUG-121 起源 T0286 `70417d4`（2026-04-26，`BAT_REMOTE_PORT` + `pgrep -x` verify；`BAT_REMOTE_BIND` 為 T0425 加入）。兩者首個發佈版皆 **`v0.4.1`**
  - `bat-server.mjs` 從未讀 `BAT_REMOTE_PORT`；tarball 從第一版就以 `staging/` 為頂層 ⇒ **v0.4.1 起至 v0.6.0-pre.5 的任何發佈版，SSH wizard 都無法在 Linux 目標上完成**（203/EXEC；即使手動繞過也會因監聽 54321 + `pgrep` 比對不到而 verify-failed）。macOS 目標同樣受兩個缺陷影響（plist 同路徑、verify 同為 `pgrep -x`），推定也從未能完成（無實機佐證）

### C. permission-denied 動作按鈕

- 根因：`verify-auth.ts` 拋的是一般 `Error('permission-denied: …')`，沒有 `code` → runner 的 stage-1 errorCode 比對不到；stage-2 regex `/permission denied/i`（空白）也比對不到連字號的 `permission-denied` → 落到 fallback（通用「重試 / 跳過 / 編輯設定 / 取消」）。既有 `error-mapper.test.ts` / `integration.mapped-ux.test.tsx` 都直接帶 `errorCode` 或合成的 `Permission denied (publickey).`，沒走真的 step，所以沒抓到
- 修正：`verify-auth.ts` 拋出的 Error 帶 `code = <probe errorCode>`；`ssh-permission-denied` 的 pattern 改 `/permission[- ]denied/i`（備援）。其他 probe code（`host-key` / `connect-timeout` / `no-ssh` / `unknown`）registry 無對應 errorCode，行為不變
- 結果：失敗步驟按鈕 = `["修改 SSH 設定","重試","取消"]`（`edit-config` / `retry` / `cancel`），「修改 SSH 設定」跳回 `configure-ssh-host`（e2e A6-4 實測）。三語 `wizard.action.editSshSettings` 原已齊全（en `Edit SSH settings` / zh-TW `修改 SSH 設定` / zh-CN `修改 SSH 设置`），未改 locale
- 連帶：mapped entry 的 `detailMode: hidden-by-default` 使原始錯誤收進「顯示詳細」——e2e A6-4 改為驗 mapped 標題「SSH 認證失敗」並展開詳細確認原文含 `permission-denied`

### D. 驗證

**單元（red → green）**
- 新增 `electron/remote/__tests__/ssh-bundle-layout-and-port.test.ts`（13）與 `src/components/setup-wizard/__tests__/ssh-permission-denied-action.test.tsx`（4）。red：把 4 個產品檔暫換為 `git show HEAD:<path>` 內容跑這兩檔 → **15 failed / 2 passed**（通過的 2 個為 locale 存在、verify-failed 透傳，與修正無關），之後由 scratchpad 備份還原（未用 stash / checkout / restore）；green：17 passed
- 既有測試同步：`electron/__tests__/ssh-start-server.test.ts`（ExecStart 帶參數 ×3、launchctl unload+load）、`electron/remote/__tests__/ssh-alias-target.test.ts`（上傳指令改比對 `buildExtractCommand`）
- `npm run test:unit`：**Test Files 206 passed；Tests 3474 passed | 1 skipped**

**型別 / build**：`npx vite build` exit 0；`npm run typecheck` exit 0；`npm run typecheck:electron` exit 0

**e2e（source build，不設 `BAT_E2E_EXECUTABLE`）**
- 流程：`npx vite build` → `node e2e/real-remote/t0510-ssh-alias-env.mjs up`（7 s）→ `BAT_E2E_PRE5_SSH=1 BAT_E2E_PRE5_SSH_WORKAROUND=0 npx playwright test e2e/pre5-ssh-alias.spec.ts` → `down`
- 第 1 次（02:48:00–02:49:12）：A6-0 PASS；A6-1/2/3/5 PASS；A6-4 FAIL——spec 仍找原始字串 `permission-denied`，但 C 修好後它在「顯示詳細」內（預期行為改變，見 C）。改 spec 後 `down` / `up` 重來
- 第 2 次（02:49:45–02:51:15，**2 passed，1.5 min**）：

  | 子項 | 判定 | 耗時 / 關鍵 log |
  |---|---|---|
  | A6-0 stock install（`bat-t0510-direct`，乾淨目標） | PASS | wizard 15403 ms（test 17.4 s）；`ls ~/.local/bat-server` = `README.md bin electron node_modules package.json scripts`；`ExecStart=/home/bat/.local/bat-server/bin/bat-server --port 9876 --bind-interface localhost`；`LISTEN 0 511 127.0.0.1:9876 0.0.0.0:* users:(("MainThread",pid=178,fd=21))`；journal `[bat-server] listening on 127.0.0.1:9876` |
  | A6-1 alias 無 Port | PASS | 14435 ms（在 A6-0 已運行的服務上重裝 → restart 路徑）；SshDetails `bat-t0510-direct (使用者與連接埠由 ~/.ssh/config 決定)`；`Linger=yes` |
  | A6-2 alias 自訂 Port + 既有壞安裝清理 | PASS | 13898 ms；預置 `staging/` 後 wizard → `README.md bin electron node_modules package.json scripts` |
  | A6-3 ProxyJump | PASS | 16398 ms；target sshd 10 筆 `Accepted publickey for bat from 172.18.0.3`（jump） |
  | A6-4 無 User → permission-denied → 修改 SSH 設定 → typed | PASS | 按鈕 `["修改 SSH 設定","重試","取消"]`；typed profile `sshHost 127.0.0.1 / sshUser bat / sshPort 22510`；SshDetails `bat@127.0.0.1:22510` |
  | A6-5 重啟後重連 | PASS | direct 400 ms / port 380 ms / viaJump 368 ms / typed 370 ms，ssh 皆 `C:\Windows\System32\OpenSSH\ssh.exe` |

- 完整輸出：`%TEMP%\t0511-e2e-run1.log`、`%TEMP%\t0511-e2e-run2.log`；截圖 `%TEMP%\bat-t0510\evidence\`
- 未設 opt-in：`npx playwright test e2e/pre5-ssh-alias.spec.ts` → 2 skipped

**e2e 側調整（`e2e/pre5-ssh-alias.spec.ts`，未動 `e2e/real-remote/`）**
- bundle 來源：source build 的 `process.resourcesPath` 沒有 `bat-server-baseline`，每個隔離實例都會下載 ~235 MB release。spec 在 source build（未設 `BAT_E2E_EXECUTABLE`）時起一個 127.0.0.1 HTTP server，只提供 `manifest.json` 與其列出的 tarball（目錄：`BAT_E2E_PRE5_SSH_BUNDLE_DIR`，預設已安裝 BAT 的 `resources\bat-server-baseline`），並在隔離實例 env 設 `BAT_SERVER_BUNDLE_BASE_URL`（既有產品 override）。目錄不存在時 log 並退回下載
- workaround：改為 **opt-in**（`BAT_E2E_PRE5_SSH_WORKAROUND=1`；原為預設開、A6-0 通過才自動關）。保留理由：仍可對 pre.5 安裝版重跑以檢查 alias 行為；開啟時跳過 T0511 新增的 staging / mapped action 斷言
- A6-0：成功後不再做 60 s 的 rollback 輪詢（成功不會 rollback），改收 `installEvidence` 並斷言 BUG-120 / BUG-121 的佈局、ExecStart 與 `127.0.0.1:9876` 監聽；失敗時保留原 rollback 證據
- A6-2：預置 pre-fix `staging/` 並斷言被清除（A2）
- A6-4：只接受 mapped 的「修改 SSH 設定」，並斷言 action 種類 `edit-config / retry / cancel`

### 收尾

- `docker ps -a --filter label=bat.t0510=1` → 空；`docker network ls --filter name=bat-t0510` → 空；image `bat-t0510-sshd:local` 保留供重跑（env 腳本預設）；未動其他容器（含 `bat-t0467-*`），未 prune、未 `wsl --shutdown` / `--terminate`，未動 WSL `~/.local/bat-server`
- `~/.ssh/config`：開始時 sha256 `00aab1cda8667c85db60b35f406a785bd9a909b87df7cf49aa78450ca03c58a2`；兩次 run 皆經 spec 的 `apply-ssh-config` / `restore-ssh-config`；最後 `down` 後 **`00aab1cd…c58a2`，與 T0510 記錄一致**。真實 known_hosts / 金鑰未動
- 未連 9876、未以預設實例啟動（e2e 全為 `--runtime` 隔離實例）、未開 Claude session、未 push

### 改動檔案

```
 CLAUDE.md                                                  | SSH wizard 安裝 / 啟動一行（Remote 資安節 T0505 之後）
 electron/remote/ssh-bundle-uploader.ts                     | buildExtractCommand（strip / staging 清理 / test -x）
 electron/remote/ssh-start-server.ts                        | --port/--bind-interface、serverPort 驗證、restart / unload+load、buildVerifyCommand
 src/components/setup-wizard/steps/ssh/verify-auth.ts       | Error 帶 code（另 CRLF → LF）
 src/components/setup-wizard/error-mapper.ts                | /permission[- ]denied/i
 electron/remote/__tests__/ssh-bundle-layout-and-port.test.ts           | 新增（A / B）
 src/components/setup-wizard/__tests__/ssh-permission-denied-action.test.tsx | 新增（C）
 electron/__tests__/ssh-start-server.test.ts                | 斷言同步
 electron/remote/__tests__/ssh-alias-target.test.ts         | 斷言同步
 e2e/pre5-ssh-alias.spec.ts                                 | bundle server、workaround opt-in、A6-0/2/4 斷言
 _ct-workorders/BUG-120-…md / BUG-121-…md                   | FIXED + 修正摘要
 _ct-workorders/T0511-…md                                   | 回報區 + metadata
```

### 偏差

- `electron/__tests__/ssh-start-server.test.ts` 不在 `affects_files`（只列 `electron/remote/__tests__/`），但其 ExecStart / launchctl 斷言隨修正必須同步，否則 unit 不綠
- B 範圍延伸到 enable 指令（`restart` / `unload`+`load`）：不改的話重跑 wizard 時已在跑的舊服務不會套用新 unit 參數，B1 對既有安裝無效
- `_ct-workorders/_bug-tracker.md` 不在 `affects_files`，未改；BUG-120 / BUG-121 移到「✅ 已修復」section 由塔台同步
- `src/components/setup-wizard/steps/ssh/verify-auth.ts` 工作樹原為 CRLF（index 為 LF），改為 LF
- 工作樹另有 `_ct-workorders/T0512-profile-panel-layout-use-width.md` 的修改（非本單，未碰、未 commit）

### 仍需真人

1. macOS 目標：plist `ProgramArguments`、`launchctl unload` / `load -w`、`lsof` verify 只有單元測試，無 macOS 實機
2. 真實使用者 SSH 主機（非容器）上跑一次 wizard；pre.5 已跑過 wizard、留下 `staging/` 的真實主機，重跑後確認佈局

### Commit

- 本單改動檔精準 stage（不含 T0512），不 push；hash 見 `git log`（本回報寫於 commit 前）

## 塔台裁決（2026-10-14 02:56，第五十九 session）

- 接受 DONE：commit `3df6218` 13 檔與回報一致；偏差（`electron/__tests__/ssh-start-server.test.ts` 同步、enable 改 `restart` / launchd `unload`+`load`）合理，採納
- 塔台聯合複驗 @ `3df6218`（含 T0512）：`npx vite build` 0、`typecheck` 0、`typecheck:electron` 0、`verify-native-modules` 0、`verify:helpers` 0、unit **206 files / 3474 passed** / 1 skipped、e2e `smoke` / `t0512-profile-panel-layout` / `detached-flush-on-close` / `bug119-userdata-unification` **6 passed**
- release notes 要點：SSH wizard 自 `v0.4.1` 起在 Linux（推定含 macOS）目標從未能完成，pre.6 修正；pre.5 留下 `staging/` 的主機重跑 wizard 即自動修復
- 仍需真人：macOS SSH 目標、真實 SSH 主機一次
