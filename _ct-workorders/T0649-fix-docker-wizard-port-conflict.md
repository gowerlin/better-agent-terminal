---
schema_version: 1
schema_kind: workorder
id: T0649
title: "BUG-156：Docker 設定精靈的容器埠不再固定 9876，避開 BAT 自己的 RemoteServer 埠與已佔用埠"
type: bugfix
status: FIXED
repo: better-agent-terminal
project: BUG-156
priority: P2
sizing: S
created_at: "2026-10-18T18:33:43+0800"
started_at: "2026-10-18T18:35:52+0800"
updated_at: "2026-10-18T18:49:54+0800"
completed_at: "2026-10-18T18:49:54+0800"
depends_on: [T0646]
related:
  - "BUG-156（T0646 程式碼追蹤）；T0129（RemoteServer 自動啟動、`REMOTE_PORT_DEFAULT`）；WSL 挑埠 `electron/wsl-systemd.ts` `pickServerPort` / `pickServerPortForUnit`；CLAUDE.md「Child Process Spawning」「Remote 資安」節"
  - "網站 `site/remote/docker.md` 有「埠衝突」警告（T0646），修正後由塔台另案更新網站，本單不改 `site/**`"
affects_files:
  - "src/components/setup-wizard/docker-flow.ts"
  - "src/components/setup-wizard/steps/docker/**"
  - "electron/docker-lifecycle.ts"
  - "electron/** 中 Docker 精靈直接相關的 IPC handler（只在需要新增 / 改挑埠 IPC 時）"
  - "src/**/__tests__/**、electron/__tests__/**（新增 / 更新測試）"
  - "docs/agent-guide/** 中提到 Docker 埠的段落（只在有時補一句；CLAUDE.md 只在必守規則改變時動一句）"
  - _ct-workorders/T0649-fix-docker-wizard-port-conflict.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 先確認根因再修：讀程式碼確認 Docker 精靈的埠與 BAT RemoteServer 的實際 bind（host / port、設定可改值）；能實機就實機（本機有 Docker 時以隔離方式跑一次 `docker run -p 127.0.0.1:9876:…`，用完刪掉自己建立的容器，不碰使用者既有容器 / 映像 / volume）。確認不是 bug（例如兩者其實不衝突）→ 不改程式碼，回報 `FAILED` 並附證據，塔台改 BUG 狀態。"
  - "🔴 不改 BAT RemoteServer 的預設埠或 bind 行為（會影響所有分頁 env、helper、遠端連線）；只改 Docker 精靈這一側。挑埠須避開：BAT 目前實際使用的伺服器埠（讀設定，不寫死 9876）、已被佔用的埠；重跑 / 升級若有既有設定，沿用原埠。"
  - "🔴 child_process 一律 `execFile` / `spawn` + array args + timeout；外部輸入（容器名等）過白名單 regex（CLAUDE.md「Child Process Spawning」）。"
  - "🔴 非隔離工單。T0650（BUG-157，改 `ProfilePanel.tsx` / `EditRemoteProfileModal.tsx`）與 T0648（唯讀探針）可能同時進行，不碰它們的檔。不改 i18n 字串（英文按鈕由 BUG-158 處理，避免衝突）；必要的新訊息先用既有 key 或在回報列出需要的 key。`src/styles/settings.css` 的 M 不是你的變更，不碰。commit 用 `git commit --only <檔案>`。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF。不 push。"
---

# T0649 — Docker 精靈避開 9876 埠衝突

## 背景

T0646 依程式碼改寫 `/remote/docker` 時發現：Docker 精靈的容器埠固定 `127.0.0.1:9876`（`docker-flow.ts` `DEFAULT_SERVER_PORT`、`docker-lifecycle.ts` `DOCKER_PUBLISH_HOST`），而 BAT 啟動時自動開的 RemoteServer 預設也在 `127.0.0.1:9876`（`main.ts` `REMOTE_PORT_DEFAULT`）。推論預設設定下「Create new」必定失敗。詳見 BUG-156。

## 要做的事

1. 確認根因（程式碼 + 可行時實機），列出精靈從挑埠到 `docker run`、寫入設定檔、之後連線的完整路徑。
2. 修正：容器公開埠改為挑選可用埠（參考 WSL `pickServerPort` 的範圍與避讓規則；可共用就共用，不要複製一份）；設定檔記錄實際埠，之後連線用它。「Use existing」若容器已有公開埠，沿用。
3. 錯誤處理：埠真的用完或 `docker run` 因埠失敗時，精靈顯示可理解的錯誤（沿用既有 error-mapper 形式）。
4. 測試：挑埠避開 BAT 伺服器埠、避開已佔用埠、沿用既有設定的埠、設定檔寫入實際埠。

## 驗證

- `npm run typecheck` = 0、`npm run typecheck:electron` = 0
- `npm run test:unit` 全綠（回報 passed / files 數；基線 5384 / 311）
- `npx vite build` 成功
- 實機（可行時）：本機 Docker 以預設設定跑「Create new」成功；無 Docker 時寫明未實機

## 驗收

- Docker 精靈在 BAT RemoteServer 使用 9876 時仍可完成；設定檔與連線使用實際埠
- RemoteServer 行為不變；WSL / SSH 精靈不受影響
- 三項驗證通過；回報區附根因確認、修正說明、測試清單、實機結果（或未實機原因）、commit，以及網站 `/remote/docker`「埠衝突」段落需要怎麼改（給塔台）
- 只改 `affects_files`；未 push

## 回報區

### 結果摘要

**FIXED**。根因確認屬實（程式碼 + 本機 socket 實測），已修正。Docker 精靈不再固定用主機 `127.0.0.1:9876`：
- 「Create new」由主行程挑埠，避開 BAT RemoteServer 的埠與已佔用的埠；
- 「Use existing」沿用容器已公開的埠；
- 實際埠寫進 `ctx.serverPort`，fetch-fingerprint、connect-test、write-profile 都用它。

本機 Docker daemon 沒在跑（只有 chocolatey 裝的 CLI），所以**沒有實機跑「Create new」**。

### Landing check

- C-0：`repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal` → PASS
- C-1：工單在 `REPO_ROOT/_ct-workorders/` 下 → PASS
- C-3：`affects_files` 的 `src/components/setup-wizard/docker-flow.ts`、`electron/docker-lifecycle.ts` 存在 → PASS（資訊性）
- C-2：工單沒有 `branch` 欄位，跳過；實際分支 `main`
- 非 worktree（`CT_HOME` 未設）。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）
- 結果：PASS

### 1. 根因確認

**程式碼（修正前）**，從挑埠到連線的完整路徑：
1. `createDockerWizardContext`（`docker-flow.ts`）：`state.serverPort = ctx.serverPort = DEFAULT_SERVER_PORT = 9876`。
2. `startDockerServerStep.run`（`steps/docker/start-server.ts`）：`port = state.serverPort ?? ctx.serverPort ?? 9876`，接著 `docker:start-container`。
   - 「Create new」→ `startContainer`（`electron/docker-lifecycle.ts`），執行 `docker run … -p 127.0.0.1:9876:9876`（`DOCKER_PUBLISH_HOST` = `127.0.0.1`）。
   - 「Use existing」→ `docker start`，埠一樣當成 9876，**不管容器實際公開在哪個埠**。
3. fetch-fingerprint、connect-test 連 `localhost:ctx.serverPort`，write-profile 把 `remotePort: ctx.serverPort` 寫進設定檔，之後連線就用這個值。

**BAT RemoteServer**：
- 埠：`readRemotePortSync()`（`electron/main.ts`）依序取 `BAT_REMOTE_PORT` env → `settings.remotePort` → `REMOTE_PORT_DEFAULT` = 9876。
- bind：`resolveBindHost('localhost')`（`electron/remote/remote-server.ts`）= `127.0.0.1`。
- ⇒ 預設設定下，兩邊都要在 `127.0.0.1:9876` 上 listen。

**本機實測**（2026-10-18）：
- `netstat -ano`：`TCP 127.0.0.1:9876 LISTENING 48948`；PID 48948 = `C:\Program Files\BetterAgentTerminal\BetterAgentTerminal.exe`。
- 用 node 在 `127.0.0.1:9876` bind（`exclusive: true`）→ `EADDRINUSE`。Docker Desktop 要公開 `127.0.0.1:9876`，也得在主機同一個位址 bind，所以會失敗（Docker 的錯誤原文通常是 `Bind for 127.0.0.1:9876 failed: port is already allocated`，或 Windows 的 `ports are not available … Only one usage of each socket address`）。
- `docker version`：`failed to connect to the docker API at npipe:////./pipe/docker_engine`（`desktop-linux` context 也一樣），本機沒有 Docker daemon 或 Docker Desktop service，所以 `docker run` 沒實際跑。

**附帶發現的第二個問題**（同一個根因）：「Use existing」把精靈的連線目標當成 9876。容器若公開在別的埠，fetch-fingerprint 會連到 BAT 自己的 RemoteServer（拿到 BAT 自己的憑證指紋），之後 connect-test 用容器的 token 認證失敗。這次一併修正。

### 2. 修正說明

| 位置 | 變更 |
|---|---|
| `electron/docker-lifecycle.ts` | 新增 `pickDockerServerPort`、`publishedServerPort` 與型別 `DockerPickServerPortResult`。<br>**要建立的容器**：交給 `pickServerPort`（`electron/wsl-systemd.ts`，與 WSL 共用，沒有另寫一份）。範圍 9877–9976，排除 RemoteServer 的埠，在 `127.0.0.1` 探測，跳過被佔用的埠；`previousPort`（同一次精靈先前嘗試用的埠）還空著就沿用；`preferredPort` 是使用者指定的埠（目前沒有 UI 會設）。<br>**既有容器**：`docker inspect --type container`（5 s timeout），讀 `9876/tcp` 的主機埠，`NetworkSettings.Ports` 優先、再看 `HostConfig.PortBindings`，不猜其他容器埠。只有 RemoteServer **正在 listen** 的那個埠才拒絕（連 127.0.0.1 會連到 BAT 自己）；沒公開 → `docker-port-unpublished`。<br>錯誤碼：`docker-port-in-use` / `docker-port-invalid` / `docker-port-unpublished` / `docker-inspect-failed`。容器名先經 `validateContainerName` 白名單；docker 一律 `execFile` + array args。 |
| `electron/wsl-systemd.ts` | `pickServerPort` 多兩個選填參數 `serverLabel`、`hostLabel`，只影響錯誤訊息用詞。預設值就是原本的 `WSL server` / `Windows`，WSL 的訊息與行為不變（有測試守住）。 |
| `electron/main.ts` | 新增 IPC `docker:pick-server-port`。排除的埠與 `wsl:pick-server-port` 相同：`readRemotePortSync()` 加上 `remoteServer.port`。結果記 `[wizard] docker pick-server-port …` 日誌。RemoteServer 本身沒改。 |
| `electron/preload.ts`、`src/types/electron.d.ts` | `docker.pickServerPort(options?)` 與它的型別。 |
| `steps/docker/start-server.ts` | `resolveServerPort` 在 claim 或啟動容器**之前**取得埠：要建立 → 挑埠；既有容器（包含這次精靈自己建立的容器重跑）→ 讀它公開的埠。結果寫進 `ctx.serverPort` 與 `state.dockerServerPort`（重試時沿用）。<br>`docker run` / `docker start` 因埠失敗時（`isPortConflictError`）：只移除**這次精靈建立的**容器，丟出可理解的錯誤（`code: 'docker-port-in-use'`），重試會用新挑的埠重新 `docker run`。修正前會對同一個被佔用的埠反覆 `docker start`。 |
| `steps/docker/ownership.ts` | 新增 `isPortConflictError`（`port is already allocated` / `ports are not available` / `address already in use` / `Only one usage of each socket address` / `forbidden by its access permissions`，最後一個是 Windows 排除埠範圍的訊息）。 |
| `docker-flow.ts` | 不再預設埠（拿掉 `DEFAULT_SERVER_PORT`），寫法比照 `wsl-flow.ts`。 |

**錯誤顯示**：
- 沿用 error-mapper 的 fallback（標題 `wizard.shared.error.stepFailed`，內文是上面那段英文原始訊息，動作 retry / skip / cancel）。
- 依工單規定不改 i18n，所以**沒有新增 registry entry**：`error-mapper.test.ts` 規定每個 entry 都要有三語 title 與 body。
- 需要的 key 列給塔台：`wizard.docker.error.portInUse.{title,body}`（en / zh-TW / zh-CN），補上後再加 registry entry：`{ id: 'docker-port-in-use', platforms: ['docker'], stepIds: ['start-server'], errorCodes: ['docker-port-in-use'], actions: [retry, cancel] }`。`docker-port-unpublished` 可以另給一個 key，或併入同一個 key。

**沒變的部分**：
- RemoteServer 的預設埠與 bind。
- WSL 精靈：`wsl:pick-server-port` 行為與訊息相同。
- SSH 精靈（`ssh-flow.ts` 沒動）。
- `startContainer` 的 `port ?? 9876` 預設值保留：精靈現在一律傳入埠，既有測試也依賴這個預設值。

### 3. 測試清單

- 新增 `electron/__tests__/docker-server-port.test.ts`（18 項）：
  - 不會給出 RemoteServer 的埠（探測顯示空著也一樣）
  - 跳過被佔用的埠
  - 先前嘗試的埠空著就沿用，被佔用就換
  - 使用者指定的埠是 RemoteServer 的埠、被佔用、或不合法時拒絕，訊息用 Docker 的用詞
  - 沒有空埠
  - 真 socket：`127.0.0.1` 上真的被佔用的埠會跳過
  - 要建立的容器不執行 docker
  - 既有容器沿用公開的埠，而且不探測
  - RemoteServer 沒在 listen 時，可以沿用 9876
  - RemoteServer 正在 listen 的埠 → 拒絕
  - 沒公開伺服器埠 → `docker-port-unpublished`
  - 不合法的容器名不執行 docker
  - inspect 失敗
  - `publishedServerPort` 三項
  - WSL 預設訊息不變
- `steps/docker/__tests__/start-server.test.ts` 新增 6 項：
  - context 不預設埠
  - Create new 用挑到的埠 `docker run`
  - 重試帶 `previousPort`，使用者指定的埠當 `preferredPort`
  - Use existing 沿用公開的埠
  - 挑埠失敗時，不 claim 也不啟動容器
  - **connect-test 與寫進設定檔的 `remotePort` 都是挑到的埠**
- `__tests__/wizard-rollback-ownership.test.ts`：
  - 新增：`docker run` 因埠失敗 → 立刻移除自己的容器，重試用新挑的埠重建
  - 原「port in use → still removed」另斷言移除只發生一次
  - T0452 的「建立後失敗 → 重試 `docker start`」改成非埠錯誤（`OCI runtime create failed`）。埠衝突改走上面的新路徑：這是行為變更，依 BUG-156 刻意調整
- `__tests__/wizard-jump-rollback.test.ts`：fake 補上 `pickServerPort`

### 4. 驗證

驗證跑了兩次：
- **第一次**在 main checkout 跑：
  - `npm run typecheck` exit 0
  - `npm run typecheck:electron` exit 0
  - `npm run test:unit`：313 檔 / 5415 passed / 3 skipped
  - `npx vite build` exit 0
  - 但這時 working tree 混著其他 Worker（T0651）還沒 commit 的變更。
- **第二次**對 commit 本身在乾淨的暫時 worktree（`git worktree add --detach … 99abe9a1`，node_modules 用 junction）重跑：
  - `npm run typecheck` = 0
  - `npm run typecheck:electron` = 0
  - `npm run test:unit`：**313 檔 / 5412 passed / 6 skipped**，exit 0（基線 5384 / 311，多出的檔包含本單新增的 1 檔；skipped 多 3 項是乾淨 worktree 在 build 前沒有 `dist-electron`）
  - `npx vite build` exit 0
  - 驗完已移除 junction 與 worktree，main checkout 的 node_modules 沒受影響。
- **實機**：未做。本機沒有 Docker daemon（見上）。真 socket 的部分由「`127.0.0.1` 被佔用 → 跳過」這項測試涵蓋。實機驗收（RemoteServer 在 9876 時「Create new」完成、設定檔 `remotePort` = 挑到的埠、之後能連線）留給有 Docker Desktop 的環境。

證據分類：
- 原始碼 / 測試：PASS
- build：PASS
- 實機 smoke：BLOCKED（沒有 Docker daemon）

### 5. Commit

- 產品：`99abe9a1` fix(wizard): pick the Docker container host port instead of fixed 9876 (T0649, BUG-156)（12 檔，+542 / −14）。
- validated_sha = head_sha = `99abe9a15848cd981eff70eedfe92b7d94d87042`（乾淨 worktree 的那次驗證）。
- 未 push。

### 6. 偏離與遭遇問題

- **amend 自己的 commit**：第一次 `git commit --only` 產出 `0bbd7104`，因為 `--only` 會收整個 `electron/main.ts`，把 T0651 Worker 同時加的兩處 hunk（`createCodexNoDaemonSupportCheck` import 與 `codexNoDaemonSupport` dep）一起帶進去了，HEAD 會引用還沒 commit 的函式。已用 `git update-index --cacheinfo` 把 index 裡的 main.ts 換成「HEAD~1 + 本單 hunk」，再 `git commit --amend`，得到 `99abe9a1`。working tree 沒動，T0651 的 main.ts 變更仍以未 commit 狀態留給該 Worker。amend 前確認過 HEAD 還是自己的 commit、index 沒有其他東西；沒有用 stash / reset / checkout / restore。
- **`src/types/electron.d.ts` 不在 `affects_files`**：新增 IPC 一定要補 renderer 型別（只加 `docker.pickServerPort` 與型別 `DockerPickServerPortResult`），所以改了。
- `electron/wsl-systemd.ts` 屬於「可共用就共用」：只多了訊息用詞參數，WSL 預設值不變。
- 沒有改 i18n、`site/**`、`ProfilePanel.tsx` / `EditRemoteProfileModal.tsx`、`src/styles/settings.css`。

### 7. 給塔台：網站 `/remote/docker` 要改的地方（`site/remote/docker.md`）

- 第 66 行「容器的伺服器埠固定是 9876…」→ 改成：精靈會在本機挑一個沒被占用的埠（從 9877 起），避開 BAT 自己的伺服器埠，只對 `127.0.0.1` 公開；設定檔記的就是這個埠。「Use existing」沿用容器已經公開的埠（容器必須以 `-p 127.0.0.1:<port>:9876` 公開伺服器埠）。
- 第 69–72 行 `::: warning 先把 BAT 自己的伺服器埠改掉`：整段刪除。修正後不必先改 BAT 的伺服器埠，也就不會有「已開分頁還記著舊埠」的副作用。
- 第 109–111 行「埠已經被占用」：改成兩種情況。
  - 精靈回報挑不到空埠，或 Docker 公開埠失敗：精靈會移除它剛建立的容器，按「重試」換一個埠。
  - 「Use existing」的容器公開在 BAT 伺服器正在用的埠：到設定改 BAT 的伺服器埠，或改用「Create new」。
- 網站改版需要等含 `99abe9a1` 的版本發佈後再上（舊版本仍是固定 9876）。

### 8. 後續建議

- i18n：`wizard.docker.error.portInUse`（與 / 或 `portUnpublished`）三語 key + error-mapper entry（見第 2 節），可以併進 BUG-158 的 i18n 批次。
- 實機驗收：有 Docker Desktop 的機器在 RemoteServer 使用 9876 的情況下跑一次「Create new」，以及「Use existing」（容器公開在非 9876 的埠）。

### 互動紀錄

無（yolo，沒有向塔台提問）。
