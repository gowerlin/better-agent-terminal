---
schema_version: 1
schema_kind: workorder
id: T0859
title: "PLAN-065 W3：Windows 打包版從安裝目錄外的 PTY holder 啟動 Terminal Server（`electron/pty-holder.ts`、`forkTerminalServer`）"
type: implementation
status: DONE
started_at: "2026-11-04T18:55:13+0800"
updated_at: "2026-11-04T19:14:24+0800"
completed_at: "2026-11-04T19:14:24+0800"
session_ids:
  - "88fad22f-59cc-4865-b1cf-72a3056563d8"
repo: better-agent-terminal
project: PLAN-065
priority: P2
sizing: M
created_at: "2026-11-04T18:28:20+0800"
depends_on: [T0857, T0858]
related:
  - "PLAN-065；D286；T0856 回報區〈調查結論〉Q2 / Q3「其他細節」與〈建議下一步〉W3；T0857（hello 回報 runtime / holderDir）；T0858（holder 目錄配置、manifest）；T0816（`forkTerminalServer` 是唯一 fork 點，Linux 的 crashpad / keepalive 規則）"
affects_files:
  - _ct-workorders/T0859-fork-terminal-server-from-pty-holder.md
  - electron/pty-holder.ts
  - electron/main.ts
  - electron/pty-manager.ts
  - electron/__tests__/pty-holder.test.ts
  - electron/__tests__/
  - e2e/
  - docs/agent-guide/terminal-server-recovery.md
  - scripts/pty-holder.cjs
  - scripts/__tests__/pty-holder.test.mjs
  - scripts/__tests__/verify-packaged-native.test.mjs
  - scripts/verify-packaged-native.js
  - docs/agent-guide/packaging-release-checks.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 只有 win32 打包版且 holder 有效（目錄存在、manifest 雜湊相符、路徑不以安裝目錄開頭）才改從 holder 啟動；其他情況（macOS / Linux、開發模式、zip 版、holder 缺少或不符）`forkTerminalServer` 的參數與行為逐字不變。🔴 `forkTerminalServer` 仍是唯一 fork 點（首次與 T0704 re-fork 共用）；Linux 的 `runWithoutCrashpadClient` / `planTerminalServerFork`（T0816）不動。"
  - "🔴 從 holder fork：`execPath` = holder exe、`cwd` = holder 目錄（不得繼承主行程 cwd，否則安裝目錄刪不掉）、不設 `ELECTRON_RUN_AS_NODE`、node-pty 從 holder 目錄載入（不得從安裝目錄載入 `conpty.node`）。PTY env 照舊經 `buildServerPtyEnv` / `buildPtyEnv`。"
  - "🔴 不改 quit / 安裝程式（W4 T0860）與升級後的接回、UI（W5 T0861）。日誌 `[pty-holder]` 只記 holder key 與結果，不記完整路徑以外的環境內容、不記權杖。"
  - "🔴 yolo：不得問使用者；問題問塔台。不發版、不 push。Git：只 commit 本單範圍（`git add <明確路徑>`）。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。不碰本機 BAT 安裝版與它的 Terminal Server；e2e 用隔離 runtime。"
  - "公開 repo（D176）：回報區不寫真名、客戶名、家目錄路徑（寫 `<使用者資料夾>`）。"
---

# T0859 — PLAN-065 W3：從 PTY holder 啟動 Terminal Server

## 元資料
- **工單編號**：T0859｜**類型**：implementation｜**狀態**：DONE｜**建立**：2026-11-04 18:28 (UTC+8)
- **規模**：S～M｜**決策**：D286｜**依賴**：T0857（`main.ts` 會衝突；hello 回報 runtime）、T0858（holder 目錄配置）

## 背景
T0858 把 holder 放到安裝目錄外；本單讓 Windows 打包版的 Terminal Server 從那裡啟動，NSIS 的程序比對（路徑前綴、映像名稱）就不會比到它。細節見 T0856 回報區 Q3「其他細節」與〈建議下一步〉W3。

## 任務
1. 新模組 `electron/pty-holder.ts`（純函式、不 import electron）：holder 根目錄（依安裝範圍，與 T0858 的規則一致）、key、安裝目錄前綴檢查、manifest 驗證、fork 參數組裝。
2. `forkTerminalServer`：win32 打包版且 holder 有效 → 以 holder fork；否則照舊。驗證失敗記一行 `[pty-holder]` 並照舊啟動。
3. hello-ok 的 `runtime` / `holderDir` 帶出 holder 資訊（T0857 的欄位），主行程記一行。
4. 測試：路徑與 key 計算、前綴檢查（含「安裝目錄名稱加字尾」的陷阱）、manifest 不符 → 退回、fork 參數（execPath / cwd / env 沒有 `ELECTRON_RUN_AS_NODE`）、非 win32 與開發模式的參數與 T0859 前完全相同（快照或逐欄斷言）。
5. e2e（隔離 runtime、Windows）：以 T0858 打包出來的 holder（或測試用 holder 目錄）啟動 BAT，確認 Terminal Server 的 `ExecutablePath` 在 holder 根目錄、可建分頁並執行命令；做不到就寫明原因並列〈待 W6 驗收〉。
6. 文件：`docs/agent-guide/terminal-server-recovery.md` 補「從 holder 啟動」的條件與退回規則。

## 塔台補充（開工前，T0858 收單後 2026-11-04 18:53）

T0858 已 DONE（`aa59902e`）。先讀 T0858 回報區與 `docs/agent-guide/packaging-release-checks.md`「Windows PTY holder 打包」，再開始。要點與塔台裁決：

1. **holder 規則以 T0858 為準**：根目錄 `BAT-PtyHolder`（per-user `%LOCALAPPDATA%`、per-machine `%ProgramFiles%`）、key = `<Node 版本>-<12 hex>`、manifest 格式、前綴衝突規則 `holderRootConflictsWithInstallDir`（任一方是另一方的字串前綴、不分大小寫 → 不用 holder）。`electron/pty-holder.ts` 與 `scripts/pty-holder.cjs` 的規則必須一致：移植常數或抽共用模組擇一，並加一個測試確保兩邊不會走樣。
2. **驗證要重算雜湊**：安裝程式只比對 manifest、不重算檔案雜湊，所以 BAT 決定用 holder 前要以 `ptyHolderProblems` 等效的檢查逐檔驗大小與 SHA-256，並確認 holder 目錄的 key 與安裝目錄內 `resources\pty-holder\holder-manifest.json` 的 key 相同（安裝目錄那份是預期值的來源）。驗證耗時記一行 debug log。
3. **磁碟（塔台裁決）**：安裝目錄內的 `resources\pty-holder\` **保留**（它是預期 key 與 manifest 的來源，per-user 模式下 holder 目錄是使用者可寫的）；docs 寫明約多 90 MiB 的原因。
4. **Node 授權（塔台裁決）**：holder 目錄要附 Node 的 `LICENSE`。在 `scripts/pty-holder.cjs` 以固定版本 tag 下載 Node repo 的 `LICENSE`（與 `node.exe` 同一個版本 tag），SHA-256 與大小固定寫在 repo、不符就建置失敗；列進 manifest；`verify-packaged-native.js` 的 `pty-holder` 檢查要求它存在。
5. **T0857 已 DONE（`db562330`）**：`hello-ok` 的 `runtime: { name: 'electron' | 'node', version }` 與 `holderDir?` 已在型別裡，server 端從 `identity` 帶入即可（任務 3）；fork env 新增 `BAT_TERMINAL_SERVER_BAT_VERSION`（已在 `TERMINAL_SERVER_OWN_ENV_KEYS`），從 holder fork 時同樣要帶；TCP 權杖由 server 自己寫 `<userData>/bat-pty-server.token`，holder 版的 server 要拿得到同一個 userData（`BAT_USER_DATA`）。先讀 T0857 回報區〈實作摘要〉。
6. 任務 5 的 `AttachConsole failed` stderr 是既有行為（today 的 runtime 也一樣，T0858 對照），不在本單處理。

### 驗收條件
- [x] 上述測試通過；T0704 / T0816 / T0540 相關測試不回歸
- [x] 補充 1–4 完成（`pty-holder.test.mjs` / `verify-packaged-native.test.mjs` 涵蓋 LICENSE 與兩邊規則一致）
- [x] `npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npm run test:unit` 全過、`npm run test:legacy` 全過、`npx vite build` 成功
- [x] commit 只含本單範圍

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

- **DONE**：Windows NSIS 安裝的打包版在 holder 驗證通過時，改從安裝目錄外的 `bat-pty-holder.exe` 啟動 Terminal Server。其他情況（macOS / Linux、開發模式、zip、holder 缺少或不符）`forkTerminalServer` 的 fork 參數與 T0859 前相同。塔台補充 1–4 都完成。
- **落點檢查**：PASS。C-0：`repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`。C-1 PASS。C-3：`affects_files` 都在，或祖先目錄存在（新檔），資訊性 PASS。C-2：工單沒有 `branch`。`CT_HOME` 未設。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）。`CT_MODE=yolo`、`CT_INTERACTIVE=0`。
- **產品 commit**：`517541b5`（15 個檔，見〈偏離〉第 1 點）
- **session_id**：88fad22f-59cc-4865-b1cf-72a3056563d8

### 互動紀錄

- [18:55] 開工。沒有提問（yolo）。三個塔台補充檢查節點都沒有讀到新段落。
- [18:58] 實測：Electron 45.2.1 主行程的 `child_process.fork` 一定會在子程序 env 加 `ELECTRON_RUN_AS_NODE=1`，即使指定其他 `execPath` 也一樣（測試子程序回報 `"eran":"1"`，`exec` 是 node.exe）。改用 `spawn` 並在 stdio 帶 `ipc`：同一條 IPC 通道、`connected: true`、子程序沒有 `ELECTRON_RUN_AS_NODE`。這是本單訂的作法，見〈決定事項〉。

### 實作摘要

| 檔案 | 內容 |
|---|---|
| `electron/pty-holder.ts`（新，不 import electron） | 常數與 `scripts/pty-holder.cjs` 相同；`holderKey` / `holderRootFor` / `holderRootConflictsWithInstallDir`；`holderScopeOrder`；`manifestProblems`；`holderDirProblems`（manifest 複本位元組相同、逐檔重算大小與 SHA-256、沒有未列檔案）；`resolvePtyHolder`（決策，不丟例外）；`ptyHolderLogLine`；`terminalServerForkOptions`（退回時的 fork 參數）；`holderSpawnSpec`；`holderKeyOfDir` |
| `electron/main.ts` | `forkTerminalServer` 改成 async：env 先組好；只有 `win32 && app.isPackaged` 才呼叫 `resolvePtyHolder` 並記一行 `[pty-holder]`；holder 有效 → `spawn(holderSpawnSpec(...))`；否則 `runWithoutCrashpadClient(() => fork(serverScript, [], terminalServerForkOptions(plan.stdio, env)))`。兩個呼叫端改成 `await` |
| `electron/terminal-server.ts` | 不是 Electron、而且腳本旁有 `holder-manifest.json` 時，`identity.holderDir = __dirname`（不經 env） |
| `electron/pty-manager.ts` | TCP 接回時，`hello-ok` 有 `holderDir` 就在既有那行日誌加 `, holder <key>`（`holderKeyOfDir`，不記路徑） |
| `scripts/pty-holder.cjs` | 加入 `PTY_HOLDER_NODE.license`（157,609 bytes、SHA-256 `5888dbb9…2ace`）、`ensureHolderNodeLicense`（覆寫 → 快取 → 下載，與 node.exe 共用 `ensurePinnedFile`）。holder 多一個 `node-LICENSE`（列進 manifest），`ptyHolderProblems` 要求它存在且符合釘選值 |
| `scripts/verify-packaged-native.js` | 只改說明註解（檢查本身沿用 `ptyHolderProblems`，所以自動要求 LICENSE） |
| 測試 | 新 `electron/__tests__/pty-holder.test.ts`（21 項）。`scripts/__tests__/pty-holder.test.mjs` 新增 LICENSE 與兩邊一致的測試（26 → 37 項）。`verify-packaged-native.test.mjs` 新增 LICENSE 測試（共 91 項）。`_pty-holder-fixture.cjs` 一併假造 LICENSE 釘選值。`child-process-fd-guard.test.ts` / `local-helper-capability.test.ts` 的 fork source guard 改成新寫法 |
| e2e | 新 `e2e/t0859-pty-holder.spec.ts`（Windows，需要 `BAT_E2E_EXECUTABLE`，沒有就 skip） |
| 文件 | `terminal-server-recovery.md` 新增「從 PTY holder 啟動」一節（規則、判斷順序表、範圍順序、hello-ok 與日誌、已知限制、驗證），並更新 v1 日誌表。`packaging-release-checks.md` 補 LICENSE（內容、供應鏈、升版步驟 3a、打包檢查）、安裝目錄那份保留的原因、zip 行為、e2e 指令，刪掉「T0858 後執行期行為不變」 |

### 決定事項（本單範圍內自行決定）

1. **用 `spawn` ＋ `ipc`，不用 `fork`**：原因是上面的實測。stdio 沿用 `planTerminalServerFork` 的結果（Windows 為 `['ignore','ignore','ignore','ipc']`），另外加 `detached: true`、`windowsHide: true`、`cwd` = holder 目錄、env 去掉 `ELECTRON_RUN_AS_NODE`。不帶 `execArgv`（`spawn` 本來就沒有）。
2. **zip 判斷用 T0823 的標記** `resources\installer-quit-request.supported`：NSIS 的 `customInstall` 會先寫這個標記，再複製 holder；zip 與 `build:dir` 都沒有。沒有標記就不去讀 holder 根目錄。
3. **安裝範圍**：BAT 讀不到 `$installMode`（不讀登錄檔）。安裝目錄在 `ProgramW6432` / `ProgramFiles` / `ProgramFiles(x86)` 底下就先試 per-machine，否則先試 per-user；第一個不通過就試另一個。兩份都用安裝目錄內的 manifest 驗證，所以順序只決定兩份內容相同時用哪一份。
4. **驗證範圍**（塔台補充 2）：安裝目錄內的 manifest 本身先檢查格式，並確認 key 由它列的檔案算得出來、arch 與 `process.arch` 相同。holder 目錄必須是 `<根目錄>\<key>`，裡面的 `holder-manifest.json` 與安裝目錄那份位元組相同，每個檔案重算大小與 SHA-256，而且不能有 manifest 沒列的檔案（exe 旁邊被放 DLL 會被載入）。耗時寫在 `[pty-holder]` 日誌（不另外寫 debug 等級，因為每次啟動只有一行）。
5. **hello**：fork IPC 本來就不送 hello（T0857），本單也沒有加（加了會改變所有平台的 IPC 行為）。剛 fork 時由主行程自己記 `[pty-holder]`；TCP 接回時從 `hello-ok` 記 holder key。
6. **Node LICENSE**（塔台補充 4）：下載來源是 `raw.githubusercontent.com/nodejs/node/v24.22.2/LICENSE`，與 `github.com/nodejs/node/raw/v24.22.2/LICENSE` 的位元組相同（SHA-256 一致）。holder 內的檔名是 `node-LICENSE`。離線打包可用 `BAT_PTY_HOLDER_NODE_LICENSE`。holder 因此變成 22 個檔、94,581,593 bytes，key 改變（本機 `24.22.2-ec44482acf96`）。

### 驗證

| 項目 | 結果 |
|---|---|
| `npm run typecheck` | ✅ 0 |
| `npm run typecheck:electron` | ✅ 0 |
| `npm run test:unit` | ✅ 445 檔通過、3 skipped；8138 passed / 0 failed / 40 skipped |
| `npm run test:legacy` | ✅ 33 檔；472 passed / 0 failed |
| `npx vite build` | ✅ exit 0（`dist-electron/terminal-server.js` 14,143 bytes） |
| 新測試 `electron/__tests__/pty-holder.test.ts` | ✅ 21 / 21 |
| `scripts/__tests__/pty-holder.test.mjs` | ✅ 37 / 37（含 LICENSE 釘選、下載、覆寫；兩邊常數、key、根目錄、前綴衝突一致；打包程式組出的 holder 被 BAT 接受，四種竄改兩邊都拒絕；Windows 上的 `resolvePtyHolder` 端到端） |
| `verify-packaged-native.test.mjs` | ✅ 91 / 91（LICENSE 缺少、沒列、內容不是釘選值 → 都失敗） |
| T0704 / T0816 / T0540 不回歸 | ✅ 都包含在全套 unit 內：`pty-manager-heartbeat-recovery`、`child-process-fd-guard`（T0816 fork guard 改新寫法）、`appimage-keepalive`、`terminal-server-kill-tree`、`terminal-server-protocol-v1`、`local-helper-capability`、`helper-capability-persist` |
| `npm run build:dir` | ✅ afterPack：`node.exe … from cache, SHA-256 verified` → `downloading https://raw.githubusercontent.com/nodejs/node/v24.22.2/LICENSE` → `Node v24.22.2 LICENSE downloaded, SHA-256 verified` → `PTY holder 24.22.2-ec44482acf96 in resources\pty-holder (22 files, 94581593 bytes)` |
| `verify-packaged-native.js --platform win --arch x64` | ✅ `PTY holder matches its manifest` / `every windows package passed (x64)` |
| **e2e** `e2e/t0859-pty-holder.spec.ts`（`BAT_E2E_EXECUTABLE=release\win-unpacked\BetterAgentTerminal.exe`） | ✅ 1 passed（6.7 s），詳見下方 |

**e2e 實測**（隔離 runtime；`LOCALAPPDATA` 指到暫存目錄；模擬安裝程式把 holder 複製到 `<暫存>\Local\BAT-PtyHolder\<key>`，並暫時建立標記，結束後刪除）：

- 第一次啟動：
  - Terminal Server 的 `ExecutablePath` = `<暫存>\Local\BAT-PtyHolder\24.22.2-ec44482acf96\bat-pty-holder.exe`，命令列跑的是 holder 的 `terminal-server.js`，不含 `app.asar`。
  - `cmd.exe` 分頁執行 `echo` 後看到 `HOLDER_E2E_AMD64`。
  - TCP hello 回 `runtime {"name":"node","version":"v24.22.2"}`，`holderDir` = holder 目錄。
  - 日誌：`[pty-holder] Terminal Server from holder 24.22.2-ec44482acf96 (per-user), verified in 114 ms`。
  - quit（停止 server）後，holder 版 server 經 IPC 正常結束（teardown 後存活 = false）。
- 第二次啟動（改了 holder 的 `terminal-server.js`）：
  - 日誌：`[pty-holder] not used (holder-invalid) 24.22.2-ec44482acf96 after 113 ms: per-user: terminal-server.js: size 14164, manifest 14143 — forking the Terminal Server as before`。
  - server 的 `ExecutablePath` 回到 `BetterAgentTerminal.exe`，分頁照常執行命令。
- 暫存目錄已刪除。沒有碰本機 BAT 安裝版、它的 Terminal Server，也沒有碰真正的 `%LOCALAPPDATA%\BAT-PtyHolder`。

**證據分道**：原始碼 / 文件 ✅；build / tests ✅；runtime（打包版＋真 holder＋真 ConPTY）✅。安裝程式實際執行（per-user / per-machine 複製後由 BAT 使用，以及升級時 holder 不被結束）**〈待 W6 驗收〉**：本單不執行安裝檔，W4 也還沒做。

### 偏離

1. **`affects_files` 以外的兩個檔**（任務直接需要）：
   - `electron/terminal-server.ts`：任務 3 與塔台補充 5 要求「server 端從 `identity` 帶入 `holderDir`」，而 `identity` 是在這個 entry 檔建立的，只加了偵測 holder 的幾行。
   - `scripts/__tests__/_pty-holder-fixture.cjs`：`pty-holder.test.mjs` / `verify-packaged-native.test.mjs` 共用的 fixture。加入 LICENSE 後，它要一起假造 LICENSE 釘選值，否則這兩個測試檔都會失敗。
   - `electron/terminal-server/server.ts` 沒有改（`identity.holderDir` 型別 T0857 已經有）。
2. 驗證耗時記在 `[pty-holder]` 那一行（info 等級），沒有另外寫 debug 等級（見〈決定事項〉4）。

### 遭遇問題

- 這個環境的 bash heredoc 會改壞反斜線（regex 與 Windows 路徑），兩次編輯腳本失敗；改用 Write 寫腳本檔或 Edit 後正常。沒有留下錯誤內容（測試全過）。
- 無阻斷。

### 已知限制（也寫進 docs）

- 驗證與 `spawn` 之間有時間差（TOCTOU）。
- 每次啟動 server 都重算約 90 MiB 的雜湊，本機約 0.1 s，沒有快取驗證結果。
- 兩個範圍都有同一個 key 時，用範圍順序第一個通過的那份。
- server 的 stderr 照舊是 `ignore`。

### 後續建議（給塔台）

1. **CLAUDE.md**：「Terminal Server 存活判定與 recovery」或「升級結束終端」節可以補一行「從 PTY holder 啟動」的必守規則與連結。本單 `affects_files` 不含 CLAUDE.md，所以沒有改；docs 已經寫了。
2. **W4（T0860）**：
   - quit 時保留 server，與安裝程式的程序比對：holder 的路徑是 `<根目錄>\<key>\bat-pty-holder.exe`，映像名稱不是 `BetterAgentTerminal.exe`。
   - 解除安裝時，清理 holder 根目錄前要確認沒有程序在跑（T0858 的 `batPtyHolderInUse`）。
3. **W5（T0861）**：TCP 接回後的日誌已帶 holder key；`hello-ok.runtime.name === 'node'` 可以用來判斷「這是 holder 版 server」。
4. **W6**：
   - per-user / per-machine 安裝後，第一次啟動應看到 `[pty-holder] Terminal Server from holder <key> (<scope>)`，用工作管理員或 `Get-CimInstance` 確認 server 的 `ExecutablePath`。
   - 升級時 holder 版 server 不被結束（需要 W4）。
   - 自訂安裝目錄 `C:\Program Files\BAT`（前綴衝突）時，應看到 `not used (not-installed)` 或 `no-holder-root`。

### 方法論狀態回寫

- 不適用（工單沒有 `methodology`）。

### 回報時間

- 2026-11-04T19:13:04+0800
