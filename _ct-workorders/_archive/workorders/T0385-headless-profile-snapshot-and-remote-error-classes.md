---
schema_version: 1
schema_kind: workorder
id: T0385
title: "BUG-094 修復：headless bat-server 補遠端 profile 所需 channel（含 `profile:load-snapshot`），並把「連不上」錯誤分類"
type: implementation
status: DONE
priority: P1
sizing: M
created_at: "2026-10-04T23:21:01+08:00"
updated_at: "2026-10-04T23:30:26+08:00"
started_at: "2026-10-04T23:22:03+08:00"
completed_at: "2026-10-04T23:30:26+08:00"
target_version: next
depends_on: []
related:
  - "BUG-094（修復對象）"
  - "PLAN-035 Phase 1 實機驗收"
  - "BUG-093（下一張，串行；本單不做）"
affects_files:
  - electron/remote/headless-entry.ts
  - electron/remote/
  - scripts/bat-server.mjs
  - scripts/_bat-server-helpers.mjs
  - electron/main.ts
  - electron/__tests__/
  - tests/headless-server.test.ts
interaction:
  mode_hint: on
  interactive: false
  intervention_type: none
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 不得停止、重裝或改寫使用者 WSL 內現有的 `bat-server.service` / `~/.local/bat-server`；不得 `wsl --shutdown` / `--terminate`。本機 runtime 驗證以 scratchpad 或另一個埠（非 9876 / 9877）啟動 headless 執行。"
  - "🔴 child_process 一律 `execFile` / `spawn` + array args，timeout 必設（CLAUDE.md Child Process Spawning）。禁用 shell-spawning exec API。"
  - "🔴 Renderer 不得 import Node builtin（D090）；main 端 log 用 `logger`。"
  - "⚠️ 本單之後串行 BUG-093（SSH 精靈 tunnel），本單不碰 `src/components/setup-wizard/`。不 push。"
---

# T0385 — headless 補 channel + 遠端錯誤分類

## 背景（BUG-094）

PLAN-035 Phase 1 實機驗收（安裝版 = 本機 build `0.5.9-pre.4`，含 T0384）：WSL 精靈全程通過，`bat-server.service` 在 `127.0.0.1:9877` 正常執行、keep-alive 生效、主機可連線、認證與指紋都通過；但開啟 profile 時跳 `Remote profile unreachable … not running or did not respond within 6 seconds.`

BAT log：

```
[RemoteClient] Connected to localhost:9877 (fingerprint=22:3A:E4:C7:4F:4F:7C:D1...)
[ERROR] [profile] remote profile wsl-ubuntu-24-04 snapshot fetch failed: No handler for channel: profile:load-snapshot
```

塔台初判（詳見 BUG-094）：

1. `profile:load-snapshot` 只在 Electron 主程式註冊（`electron/main.ts:3024`），headless server 沒有
2. `electron/main.ts:1236-1238` 把任何 invoke 錯誤都映射成 `remote-unreachable`，對話框文案誤導

## 範圍

### A. 盤點（先做，寫進回報區）

- 列出 **client 端在遠端 profile 流程中會對遠端 invoke 的 channel**（開啟 profile、還原視窗 / workspace、開終端、Agent 等主要路徑），對照 headless server 實際註冊的 handler，產出差異表：channel / client 呼叫點 / headless 是否有 / 缺少的影響
- 釐清 headless 的 profile 模型：headless 有沒有 profile store；`remoteProfileId || 'default'` 在 headless 的語意；`load-snapshot` 應回什麼（`null` → client 走什麼路？空視窗？預設 workspace？）

### B. 修復

1. headless 註冊 `profile:load-snapshot`（以及盤點出的**開啟 profile 主路徑上**必定會撞到的其他缺口）。回傳語意以 client 端現有處理為準，讓 WSL profile 能開出可用視窗
2. 盤點出的其他缺口若超出主路徑（例如次要功能），**不在本單補**，列在回報區由塔台拆單
3. `electron/main.ts` 錯誤分類：至少區分
   - 連線失敗（refused / timeout）→ 維持現有「未執行或未回應」
   - 指紋不符 / 認證失敗 → 指出是信任 / token 問題
   - 已連線但遠端呼叫失敗（如 `No handler for channel`）→ 指出伺服器版本與 BAT 不相容或功能未支援，附原始錯誤
   - 對話框文案沿用現有英文風格（`dialog.showMessageBox`，非 i18n）；若 Worker 認為應走 i18n，回報區提出，不在本單改

### C. 交付到 WSL 的路徑（只調查、寫進回報區）

WSL 內的 bat-server 來自 server bundle（baseline tarball 由 `prebuild` 從 GitHub Release 抓，本機打包不會帶本地 headless 改動）。回報：使用者要在本機驗證本修復，需跑哪些指令（例如 `npm run build:server-bundle:linux-x64` → 如何讓精靈 / 打包使用本地 tarball → 重新部署到 WSL）。若現有流程做不到，說明缺口，不在本單加工具。

## 驗收

- unit：headless 端 `profile:load-snapshot` handler（有 / 無 snapshot）；main 端錯誤分類（三類各一例以上）
- `npm run test:unit` 全綠（基線 **905**；回報新數字）
- `npx vite build` exit 0
- `npx tsc --noEmit` error 數不得高於 baseline **40**
- **本機 runtime**：在 scratchpad / 非 9876、9877 的埠啟動 headless server，以 RemoteClient（或等價腳本）invoke `profile:load-snapshot` 得到非錯誤回應；驗完停掉、清乾淨
- **runtime 驗收（交使用者）**：依 C 的步驟部署後，WSL profile 能開出視窗

## Sub-session 執行指示

1. 讀取本工單 + BUG-094
2. 填 `started_at`、`status: IN_PROGRESS`（**`date "+%Y-%m-%dT%H:%M:%S%z"` 取系統時間，禁止手打**，R-G001）
3. A 盤點 → B 實作 → 驗收 → C 調查
4. 填回報區；完成寫 **`DONE`**（不是 `FIXED`）；B-2 有未補缺口時仍可 DONE，但須列清單。BUG 狀態由塔台更新，不要改 BUG 檔
5. commit 僅實際改動檔 + 新測試檔 + 本工單檔（`git commit --only ...`）；`AGENTS.md` 若 dirty 不要碰
6. 依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 執行摘要

- **開始**：2026-10-04T23:22:03+08:00（Worker，CT_MODE=on、CT_INTERACTIVE=0）
- **落點檢查**：WARN —— C-0 無法判定（工單 frontmatter **無 `repo` 欄位**；`basename(REPO_ROOT)` = `better-agent-terminal`）；C-1 PASS（工單在 REPO_ROOT 下）；C-3 PASS（`electron/remote/headless-entry.ts` / `scripts/bat-server.mjs` / `scripts/_bat-server-helpers.mjs` / `electron/main.ts` / `tests/headless-server.test.ts` 皆存在）；C-2 不適用（無 `branch` 欄位，HEAD=`main`）。`BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）
- **結果**：DONE。headless 補上開 profile 主路徑必撞的 channel（profile 子集 6 個 + `settings:load` / `settings:save`），main 端錯誤分三類。**但 headless 仍沒有 pty / claude / git / fs 等任何功能 handler**——WSL profile 能開出視窗、初始化走完，**開終端 / Agent 仍不可用**（見「B-2 未補缺口」，需塔台拆 PLAN 級工單）

### A. 盤點

#### A-1 根因確認（比塔台初判更大）

headless bat-server **註冊的 handler 數量為 0**，不只是缺 `profile:load-snapshot`：

- `createHeadlessServer` 只註冊 `opts.handlers`（`electron/remote/headless-entry.ts`），`scripts/bat-server.mjs` 呼叫時**不傳 `handlers`**
- `scripts/build-server-bundle.mjs` 的 `copyServerSources()` 會複製 `electron/handlers/` → `staging/handlers/`，但該目錄**不存在**（`_spec-remote-dev-support-2026-04.md` §2.3 規劃的「`handlers/` IPC handler 純 JS（renderer-agnostic）」從未落地）
- 結論：遠端 profile 視窗把 `PROXIED_CHANNELS`（除 `workspace:save` / `workspace:load` 為 `ALWAYS_LOCAL_CHANNELS`）全部轉發到 headless，**每一個都會 `No handler for channel`**。BUG-094 只是第一個撞到的

#### A-2 遠端 profile 流程 channel 差異表（headless 修前 = 全部「無」）

| channel | client 呼叫點 | 修前 | 修後 | 缺少的影響 |
|---|---|---|---|---|
| `profile:load-snapshot` | `electron/main.ts` `loadProfileSnapshotDetailed`（main 直接 `client.invoke`，全檔唯一一處） | 無 | ✅ 回 `null` | 失敗 → 視窗根本不開（BUG-094） |
| `profile:list` | `src/App.tsx:500` `initProfile` 第一個 proxied call | 無 | ✅ `{profiles:[],activeProfileIds:[]}` | reject → `initProfile` catch 內 `settingsStore.load()` 再 reject → unhandled rejection，`workspaceStore.load()`、autosave、`setWindowId` 全不跑 |
| `settings:load` | `src/App.tsx:587/600` → `src/stores/settings-store.ts:448` | 無 | ✅ 讀 `<dataDir>/settings.json`，無檔回 `null` | 同上（無 try，連 catch 分支一起炸） |
| `settings:save` | settings 變更時 | 無 | ✅ 寫 `<dataDir>/settings.json`（非 JSON 字串拒收） | 遠端視窗改設定即報錯 |
| `profile:load` / `profile:get-active-ids` / `profile:activate` / `profile:deactivate` | `src/App.tsx:544/562/570`（fallback 路徑）等 | 無 | ✅ `null` / `[]` / no-op | profile 子集一次補齊，避免 fallback 路徑再撞 |
| `settings:get-shell-path` | `src/components/WorkspaceView.tsx:137/439/580` | 無 | ❌ 未補 | 加 workspace 時 `initTerminals()` 未 await → unhandled，且 workspace 已標記 initialized → 不重試、無預設終端 |
| `pty:create` / `pty:write` / `pty:resize` / `pty:kill` / `pty:restart` / `pty:get-cwd` | `WorkspaceView.tsx:507/549/583/601/813/852`、`TerminalPanel.tsx:113/323/395/460/494`、`PromptBox.tsx:106` | 無 | ❌ 未補 | 終端分頁存在但為死分頁（未 catch） |
| `claude:start-session` / `claude:resume-session` / `claude:send-message` / `claude:get-cli-path` 等 `claude:*` | `ClaudeAgentPanel.tsx:950/954/1459/885`、`WorkspaceView.tsx:679-717` | 無 | ❌ 未補 | Agent 面板無事件、送訊息 unhandled |
| `git:*` / `snippet:*` / `claude:scan-*` / `claude:get-statusline-extras` / `claude:get-session-meta` / `fs:*` / `github:*` / `worktree:*` / `terminal:*` | 各面板 | 無 | ❌ 未補 | 多數已有 `.catch`，安靜降級 |

（盤點由 Explore sub-agent 逐一追 `electron/preload.ts` 映射與 `src/` 呼叫點；主 session 抽查 `App.tsx` initProfile 與 `main.ts` 路由後採信。）

#### A-3 headless profile 模型

- headless **沒有 profile store**（`electron/profile-manager.ts` 綁 `electron.app.getPath('userData')`，plain node 不可用）
- 視窗 / workspace 版面由 **client** 持有：`workspace:save` / `workspace:load` 是 `ALWAYS_LOCAL_CHANNELS`，`applySnapshot` 寫進本機 `windowRegistry`
- 因此 `remoteProfileId || 'default'` 在 headless **無語意**：接受、忽略。`profile:load-snapshot` 一律回 `null`
- client 對 `null` 的既有處理（`main.ts` 三入口：startup `restoreFromSnapshot` / `second-instance` / `app:open-new-instance`）= **開一個該 profile 的空視窗**；之後 `App.tsx` initProfile：`profile:list` 回空 → 以 `profile:list-local` 找到本機 remote profile → `remote.connect` → `settings:load`（`null` → 預設設定）→ `workspaceStore.load()`（本機）→ 初始化完成

### B. 修復

1. **新增 `electron/remote/headless-handlers.ts`**：`createHeadlessDefaultHandlers({ dataDir })` 回傳內建 handler（profile 子集 6 個 + `settings:load` / `settings:save`），無 `electron` import。`HeadlessHandlerRegistration` 型別移到此檔，`headless-entry.ts` re-export（`server-entry.ts` 對外 API 不變）
2. **`electron/remote/headless-entry.ts`**：`createHeadlessServer` 先註冊內建、再註冊 `opts.handlers`（呼叫端可覆寫）。`scripts/bat-server.mjs` **不需改**（內建於 factory；esbuild 打包 `server-entry.ts` / `headless-entry.ts` 時新檔一併 bundle，已實測 bundle 內含 `profile:load-snapshot`）
3. **新增 `electron/remote/remote-profile-error.ts`**（純函式）：
   - `classifyConnectFailure(ConnectResult)`：`fingerprint-mismatch` / `auth-failed` → `trust`；其餘（`timeout` / `network` / tunnel / `unknown`）→ `unreachable`
   - `classifyInvokeFailure(err)`：`RemoteClient.invoke` 自身的傳輸錯誤（`Not connected to remote server` / `Connection closed` / `Disconnected` / `Remote invoke timeout: …`）→ `unreachable`；其餘（如 `No handler for channel: …`）→ `protocol`
   - `describeRemoteProfileFailure()`：三類英文對話框文案。`unreachable` 保留原句「is not running or did not respond within 6 seconds.」；`trust` 指向 fingerprint / token、請重新配對；`protocol` 標題 `Remote server incompatible`，說明伺服器版本可能與 BAT 不相容或功能未支援、請更新 server bundle；三類皆附 `Error: <原始訊息>`
4. **`electron/main.ts`**：`SnapshotLoadResult` 的 `remote-unreachable` 分支改帶 `RemoteProfileFailure`（`reason` + `error`）；connect 失敗與 snapshot invoke 失敗**拆成兩個 catch**（後者才走 `classifyInvokeFailure`）；缺 `remoteFingerprint` 的 legacy profile 歸 `trust`；`showRemoteUnreachableDialog(host,port,label)` → `showRemoteProfileFailureDialog(failure)`，4 個呼叫點同步。`kind: 'remote-unreachable'` 字面值與 `app:open-new-instance` 回傳的 `error: 'remote-unreachable'` 保留不變（renderer 契約不動）。log 加 `[reason/errorCode]` 前綴
5. 對話框沿用 `dialog.showMessageBox` 英文、非 i18n（依工單）。**建議**：這是使用者第一線排錯資訊，未來可考慮 i18n，但 main 端目前無 i18n 基礎設施，不在本單動

#### B-2 未補缺口（交塔台拆單）

🔴 **headless 功能 handler 層整體缺席**——補齊需把 main.ts 內與 Electron 綁死的 manager 抽成 plain-node 可用版本，屬 PLAN 級：

| 優先 | 缺口 | 難點 |
|---|---|---|
| P0（「可用」的定義） | `settings:get-shell-path` + `pty:*`（6 個） | `electron/pty-manager.ts` import `electron` 的 `app` / `BrowserWindow`；輸出走 `broadcastHub` 可共用，需拆出無 electron 版 PtyManager；server bundle 已含 `@lydell/node-pty-<target>` |
| P1 | `claude:*`（含 `claude:get-cli-path`、`claude:start-session` 等約 40 個） | `claude-agent-manager.ts` 依賴 runtime router / settings；server bundle 已含 claude-code / agent-sdk |
| P2 | `git:*` / `git-scaffold:*` / `fs:*` / `image:read-as-data-url` / `github:*` / `worktree:*` | 多為 child_process / fs，較易移植；path sandbox（`isPathAllowed`）在 headless 要重新定義 |
| P3 | `snippet:*`（better-sqlite3）、`terminal:*`（Tower 通知） | 次要 |

另記（非本單範圍，觀察到的既有行為）：
- `App.tsx` initProfile 的 `remote.connect(host, port, token)` **不帶 fingerprint**（`main.ts` `remote:connect` 支援第 5 參數），會以新 client 取代 `loadProfileSnapshotDetailed` 已做 pin 驗證的 client
- `settings:load` 失敗時 `App.tsx` catch 分支再呼叫 `settingsStore.load()` 會二次 reject → unhandled（本修復後 headless 不再觸發，但對其他遠端錯誤仍脆弱）
- protocol 失敗時已連上的 `remoteClient` 不會被 disconnect（與修前行為相同）

### C. 交付到 WSL 的路徑（調查）

現況：WSL 精靈安裝的 tarball 來源 = distributor 三層（`electron/remote/server-bundle-distributor.ts`）：**cache**（`%APPDATA%\BetterAgentTerminal\bat-server-bundles\`，以 baseline manifest SHA 驗證）→ **baseline**（`<resources>\bat-server-baseline\` + `manifest.json`，由 `prebuild` 的 `fetch:baseline` 從 GitHub Release 抓）→ **download**（`server-bundle-v<版號>` Release）。本機 `dist-baseline/` 目前是 GitHub 上 `0.5.9-pre.4` 的 tarball，**不含本修復**。WSL 安裝路徑 `~/.local/bat-server`，systemd `ExecStart=<installPath>/bin/bat-server` → `bin/bat-server.mjs` 載入 `<installPath>/electron/remote/server-entry.js`。

**最短驗證路徑（建議：只換 JS，不重建 tarball）**——本修復只動 JS，native 模組不變：

```bash
# 1) Windows 主機，repo 根目錄：以 build-server-bundle 相同 esbuild 設定產出 JS
node -e "require('esbuild').build({entryPoints:['electron/remote/server-entry.ts','electron/remote/headless-entry.ts'],outdir:'dist-server/t0385',bundle:true,platform:'node',target:'node24',format:'cjs',external:['electron','better-sqlite3','sharp','@lydell/node-pty','@anthropic-ai/claude-code','@anthropic-ai/claude-agent-sdk']})"
# 2) WSL（Ubuntu-24.04）內：先備份再覆蓋，重啟 service
cp ~/.local/bat-server/electron/remote/server-entry.js ~/.local/bat-server/electron/remote/server-entry.js.bak-t0385
cp ~/.local/bat-server/electron/remote/headless-entry.js ~/.local/bat-server/electron/remote/headless-entry.js.bak-t0385
cp /mnt/d/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal/dist-server/t0385/*.js ~/.local/bat-server/electron/remote/
systemctl --user restart bat-server
# 3) BAT 端需為含本修復 main.ts 的 build（npm run build:dir 或安裝新版）→ 開 WSL profile
```

（步驟 2 改動使用者 WSL 內 `~/.local/bat-server` 並重啟 service——依 memory_overrides，Worker **未執行**，交使用者決定。）

**完整 tarball 路徑（現有流程有缺口）**：

1. `npm run build:server-bundle:linux-x64` → `dist-server/bat-server-linux-x64-v<版號>.tar.gz`。⚠️ **Windows 主機缺 `@lydell/node-pty-linux-x64` 等 linux native 套件會 abort**，只能 `BAT_SERVER_ALLOW_MISSING_NATIVE=1`（schema-only；bundle 缺 node-pty——目前 headless 沒用到 pty 所以可跑，但非 production 等價）；正規做法是 linux-x64 host / CI
2. `build-server-bundle.mjs` **不產 `manifest.json` / `.sha256`**；需另跑 `scripts/generate-server-bundle-manifest.mjs --input-dir … --version … --build-date … --output …`，且它要求 **3 個 target 的 tarball + sidecar 齊全**（CI 才有）→ 本機單 target 做不出合法 manifest
3. 讓精靈吃本地 tarball：tarball + manifest 放進安裝版 `C:\Program Files\BetterAgentTerminal\resources\bat-server-baseline\`（需管理員）並清 cache 目錄；或重打包 BAT（但 `prebuild` 的 `fetch:baseline` 會依 Release 重抓/驗 SHA，蓋掉本地 tarball）
4. 重跑 WSL 精靈（覆蓋 `~/.local/bat-server`）

⇒ **缺口**：現有工具沒有「用本地單 target tarball 驅動精靈」的路徑（無 local-tarball override、manifest 產生器要求三 target、`fetch:baseline` 無 skip 旗標）。不在本單加工具；若要常態化本機驗證，建議另開工單加 local-tarball override 或 `fetch:baseline --skip`。最實際的正式路徑仍是 `gh workflow run pre-release.yml -R gowerlin/better-agent-terminal -f version=X.Y.Z-pre.N`（CI 同 run 產 3 target + manifest 並發 `server-bundle-v<版號>`）。

### 驗收

| 閘門 | 結果 | 證據 |
|---|---|---|
| unit：headless `profile:load-snapshot`（有 / 無 snapshot） | ✅ PASS | `electron/remote/__tests__/headless-handlers.test.ts` 7 tests：無 snapshot → `null`（任意 profile id）；呼叫端覆寫 handler → 回傳 snapshot；`createHeadlessServer` 後 `hasHandler('profile:load-snapshot')`；profile 子集；settings load/save/拒收非 JSON |
| unit：main 端錯誤分類（三類各一例以上） | ✅ PASS | `electron/remote/__tests__/remote-profile-error.test.ts` 8 tests：unreachable（refused / timeout / tunnel / 無 code；invoke timeout / closed / disconnected / not connected）、trust（fingerprint-mismatch / auth-failed）、protocol（`No handler for channel: profile:load-snapshot`）；trust / protocol 文案不得含「not running」 |
| `npm run test:unit` | ✅ PASS | 65 files / **920 passed**（基線 905，+15） |
| `npx vite build` | ✅ PASS | exit 0 |
| `npx tsc --noEmit` | ✅ PASS | **40**（= baseline 40）。註：此設定只涵蓋 `src/`；另跑 `tsc --noEmit -p tsconfig.node.json`（涵蓋 `electron/`）改前改後皆 **190**，無新增 |
| 既有 `tests/headless-server.test.ts`（tsx 腳本） | ✅ PASS | `npx tsx tests/headless-server.test.ts` → 6 passed, 0 failed |
| 本機 runtime | ✅ PASS | esbuild 打包 `server-entry.ts` 到 scratchpad；`BAT_SERVER_ENTRY=… node scripts/bat-server.mjs --data-dir <scratch> --port 19885 --token …` 啟動；wss 腳本 auth OK 後 invoke：`profile:load-snapshot → invoke-result: null`、`profile:list → {"profiles":[],"activeProfileIds":[]}`、`settings:load → null`；對照組 `pty:create → invoke-error: No handler for channel: pty:create`（預期，B-2）。驗完 kill、`Get-NetTCPConnection -LocalPort 19885` = 0、scratch 目錄已刪。未碰 9876 / 9877 與 WSL |
| runtime 驗收（交使用者） | ⏳ 待使用者 | 依 C「最短驗證路徑」部署後預期：WSL profile **開出空視窗、不再跳對話框**；開終端仍不可用（B-2）。若只更新 BAT、未更新 server，預期對話框改為 `Remote server incompatible` + `Error: No handler for channel: profile:load-snapshot` |

### 變更檔案

- `electron/remote/headless-handlers.ts`（新）
- `electron/remote/remote-profile-error.ts`（新）
- `electron/remote/headless-entry.ts`
- `electron/main.ts`
- `electron/remote/__tests__/headless-handlers.test.ts`（新）
- `electron/remote/__tests__/remote-profile-error.test.ts`（新）
- 本工單檔

未改：`scripts/bat-server.mjs`、`scripts/_bat-server-helpers.mjs`、`tests/headless-server.test.ts`（不需要）；BUG-094 檔（依指示由塔台更新）；`src/components/setup-wizard/`（BUG-093 範圍）。

### 偏差 / 風險

- 「讓 WSL profile 能開出可用視窗」只達成到「開出視窗、初始化完成」。「可用」若包含開終端，本單做不到——需 B-2 P0（headless PtyManager），屬 L 級以上，已列清單
- 新測試放 `electron/remote/__tests__/`（vitest include 範圍）而非 frontmatter 列的 `electron/__tests__/`；`tests/headless-server.test.ts` 不在 vitest include，未擴充
- headless `settings:save` 會在 `<dataDir>/settings.json` 落地遠端視窗設定（與 Electron host 作為遠端時的行為一致：遠端視窗的設定讀寫遠端）

### Commit

- 單一 commit，`git commit --only` 僅含上列 7 個檔案；未 push。hash 見 commit 後 `git log`（回報區寫入在 commit 之前，故不自我引用）
