---
schema_version: 1
schema_kind: workorder
id: T0858
title: "PLAN-065 W2：Windows 打包 PTY holder（官方 node.exe 改名 bat-pty-holder.exe＋terminal-server.js＋node-pty win32＋manifest）與安裝程式複製到安裝目錄外"
type: implementation
status: DONE
repo: better-agent-terminal
project: PLAN-065
priority: P2
sizing: M
created_at: "2026-11-04T18:28:20+0800"
started_at: "2026-11-04T18:31:33+08:00"
updated_at: "2026-11-04T18:52:39+08:00"
completed_at: "2026-11-04T18:52:39+08:00"
session_ids:
  - "f2ae5f6e-027e-419e-a651-d626d41a04f0"
depends_on: []
related:
  - "PLAN-065；D286（D1 官方 node.exe、D2 依安裝範圍決定位置、D9 只保留在用的加目前版本）；T0856 回報區〈調查結論〉Q1 / Q2 / Q5 與〈建議下一步〉W2；T0823（`build/installer.nsh` `customCheckAppRunning` / `customInstall`）；T0546（安裝檔瘦身、不得用 `build.<platform>.files`）；`scripts/build-server-bundle.mjs`（下載 node 的前例）"
affects_files:
  - _ct-workorders/T0858-windows-pty-holder-packaging.md
  - package.json
  - scripts/
  - build/installer.nsh
  - scripts/verify-packaged-native.js
  - scripts/__tests__/
  - .github/workflows/pre-release.yml
  - .github/workflows/release.yml
  - .github/workflows/desktop-build.yml
  - docs/agent-guide/packaging-release-checks.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 只打包與複製檔案：不改 `forkTerminalServer`（W3 T0859）、不改 quit / 解除安裝流程（W4 T0860）。本單完成後 BAT 執行期行為完全不變（holder 檔案在，但沒人用）。不改 `CLAUDE.md`（W1 / W6 負責，避免並行衝突）。"
  - "🔴 只有 Windows：macOS / Linux 的安裝檔內容、打包步驟、`afterPack` 行為逐位元不變。平台差異用頂層 `files` / `extraResources` 的 `${os}` 巨集或 win 專屬 extraResources；🔴 不得使用 `build.<platform>.files`（T0546：會把整個 repo 打進 asar）。"
  - "🔴 供應鏈：Node 版本與 `node.exe` 的 SHA-256 **固定寫在 repo**（不在建置時抓 SHASUMS 當信任來源），下載後驗雜湊、不符就建置失敗；只從 nodejs.org 官方位址下載。新增建置腳本若需要 install script 或新的 npm 依賴 → 先問塔台（`allowScripts` 是政策）。"
  - "🔴 holder 位置與命名（T0856 Q1 / Q2）：執行檔不得叫 `BetterAgentTerminal.exe`；holder 根目錄的路徑**不得以安裝目錄路徑字串開頭**（NSIS 以 `StartsWith('$INSTDIR')` 前綴比對，結尾不帶 `\\`，`C:\\Program Files\\BetterAgentTerminal PTY Holder` 也會被比中）。per-user → `%LOCALAPPDATA%` 下、per-machine → `%ProgramFiles%` 下（D2，名稱可微調並寫明）。🔴 安裝程式不得刪除有程序在執行的版本目錄（mapped 的檔案會鎖住，刪一半會讓 holder 之後 fork 失敗）。"
  - "🔴 `build/installer.nsh`：T0823 的 `customCheckAppRunning` 與標記檔邏輯不變；新增的複製 / 清理放在 `customInstall`。child_process 規則照 CLAUDE.md。yolo：不得問使用者；問題問塔台。不發版、不 push、不觸發 workflow。Git：只 commit 本單範圍（`git add <明確路徑>`）。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。不碰本機 BAT 安裝版，不執行任何安裝檔。"
  - "公開 repo（D176）：回報區不寫真名、客戶名、家目錄路徑（寫 `<使用者資料夾>`）。"
---

# T0858 — PLAN-065 W2：Windows 打包 PTY holder

## 元資料
- **工單編號**：T0858｜**類型**：implementation｜**狀態**：DONE｜**建立**：2026-11-04 18:28 (UTC+8)
- **規模**：M｜**決策**：D286｜**依賴**：無（可與 T0857 並行）

## 背景
D286 D1：holder 用官方 `node.exe`（改名 `bat-pty-holder.exe`，OpenJS 簽章，約 90–100 MB），跑今天的 `terminal-server.js`。node-pty 是 N-API，不綁 Node ABI（T0856 E1 實測）。D2：依安裝範圍放在安裝目錄外、由安裝程式複製。D9：holder 根目錄只保留正在執行的版本加目前版本。細節見 T0856 回報區 Q1 / Q2 / Q5 與〈建議下一步〉W2。

## 任務
1. Windows 建置時取得固定版本的 Node（建議與 Electron 內建 Node 同一主版本 24.x 的最新 LTS 修補版，寫明理由），驗 SHA-256，改名 `bat-pty-holder.exe`。
2. 安裝檔內放 `resources\pty-holder\`：`bat-pty-holder.exe`、`terminal-server.js`（與 `dist-electron` 產物同一份）、node-pty win32 執行期需要的 JS 與 `.node`（`conpty.node`、`conpty_console_list.node` 及其 fork 的 agent 腳本）、`holder-manifest.json`（holder key、Node 版本、每個檔案的大小與 SHA-256）。holder key 的規則由你訂（建議 Node 版本＋holder 內容雜湊），寫進 docs。
3. `build/installer.nsh` `customInstall`：依安裝範圍把 `resources\pty-holder\` 複製到 holder 根目錄下的 key 目錄（已存在且 manifest 相符就略過）；清掉沒有程序在執行、也不是目前 key 的版本目錄（判斷方式比照範本的 `FIND_PROCESS` 以路徑前綴查程序）。
4. `scripts/verify-packaged-native.js` 加 `pty-holder` 檢查（檔案齊全、manifest 雜湊一致、exe 不叫 `BetterAgentTerminal.exe`）；需要的話 workflow 的 Windows step 跟著改。
5. 先用 `node.exe` 實際載入打包出來的 `resources\pty-holder\` 跑一次 `terminal-server.js`（scratchpad 或 `release\win-unpacked`，不碰安裝版）：能起 server、建一個 `cmd.exe` PTY、結束；回報列出指令與結果。
6. 測試：取得 Node 的腳本（雜湊不符失敗、版本固定）、manifest 產生、holder 路徑前綴檢查（含「安裝目錄名稱加字尾」的陷阱）、`installer.nsh` 的 source guard（比照 T0823 的寫法）。
7. 文件：`docs/agent-guide/packaging-release-checks.md` 新增「Windows PTY holder 打包」一節（Node 版本與升版步驟、雜湊、安裝檔大小變化）。

### 驗收條件
- [x] `npm run build:dir`（或等效的 Windows 打包）產出 `resources\pty-holder\` 且 `verify-packaged-native.js` 通過；macOS / Linux 打包設定與產物不變（以設定 diff 與測試說明）
- [x] 任務 5 的手動載入 PASS
- [x] `npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npm run test:unit` 全過、`npm run test:legacy` 全過、`npx vite build` 成功；`scripts/__tests__/asar-runtime-deps.test.mjs` 不回歸
- [x] 回報區列出：安裝檔大小變化、holder 根目錄的實際路徑規則、`customInstall` 的複製與清理流程；安裝程式的實際執行（複製、清理）列〈待 W6 驗收〉
- [x] commit 只含本單範圍

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

- **DONE**：Windows 安裝檔帶 `resources\pty-holder\`，安裝程式 `customInstall` 會把它複製到安裝目錄外並清理舊版本目錄，`verify-packaged-native.js` 會檢查 holder。BAT 執行期行為不變：holder 檔案在，但沒有任何程式使用它（W3 / T0859 才會用）。macOS / Linux 的打包設定與產物不變。
- **落點檢查**：PASS。C-0：`repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`；C-1 PASS；C-3：`affects_files` 的路徑都在（PASS）；C-2：工單沒有 `branch`。未設 `CT_HOME`。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）。`CT_MODE=yolo`、`CT_INTERACTIVE=0`。
- **產品 commit**：`aa59902e9c04fbf53e47c9f9bbb47c119eb28c4c`（9 個檔，只含本單路徑）
- **session_id**：f2ae5f6e-027e-419e-a651-d626d41a04f0

### 互動紀錄

- 沒有提問（yolo；不需要塔台決策）。三個檢查節點（驗證前、產品 commit 前、填回報前）都沒有讀到塔台補充段落。

### 實作摘要

| 檔案 | 內容 |
|---|---|
| `scripts/pty-holder.cjs`（新） | 釘選的 Node（`PTY_HOLDER_NODE`）、下載與驗證（`ensureHolderNodeExe`）、組 holder 目錄與 manifest（`assemblePtyHolder` / `buildHolderManifest` / `holderKey`）、檢查（`ptyHolderProblems`）、holder 根目錄規則（`holderRootFor` / `holderRootConflictsWithInstallDir`）、afterPack 步驟（`afterPackPtyHolder`，只有 `win32`） |
| `scripts/version-manifest.cjs` | afterPack 最後呼叫 `afterPackPtyHolder`（`deps.afterPackPtyHolder` 只供測試替換） |
| `build/installer.nsh` | 新增 `batInstallPtyHolder` / `batPtyHolderInUse` 巨集；`customInstall` 先寫 T0823 標記（不變），再複製 holder。`customCheckAppRunning` 不變 |
| `scripts/verify-packaged-native.js` | win：`pty-holder` 檢查（`verifyPtyHolder`）；mac / linux：有 `resources/pty-holder` 就失敗 |
| `scripts/__tests__/pty-holder.test.mjs`（新）、`_pty-holder-fixture.cjs`（新） | 26 個測試（見〈驗證〉） |
| `scripts/__tests__/verify-packaged-native.test.mjs` | Windows 假產物帶假 holder（fixture 在測試行程內換掉 x64 的釘選值；CLI 測試以 `--require` 預載同一個 fixture）；新增 4 個 `pty-holder` 測試 |
| `scripts/__tests__/appimage-sandbox-launcher.test.mjs` | 呼叫 `afterPack` 時以假的 `afterPackPtyHolder` 代替（否則 win32 情境會真的下載 node.exe） |
| `docs/agent-guide/packaging-release-checks.md` | 新增「Windows PTY holder 打包」一節（內容、key、Node 版本與升版步驟、供應鏈、組裝時機、打包檢查、安裝程式流程、手動載入、大小）；NSIS 升級檢查清單補第 6 點 |

`package.json`、三個 workflow 都**沒有改**：組裝放在既有的 afterPack，三個 workflow 原本就跑 `verify-packaged-native.js --platform win`。

### 決定事項（本單訂的規則）

- **Node 版本 `24.22.2`**：理由是與 Electron 45 內建的 Node 同主版本（Electron 45.2.1 = Node 24.22.1），而且是釘選時 24.x 最新的 LTS 修補版（2026-10-27）；node-pty 是 N-API，不綁 Node ABI。x64 `node.exe` 93,922,624 bytes，SHA-256 `1c331340…aac9`；arm64 82,156,872 bytes，SHA-256 `e2d6e75a…b7ea`。兩個值都先取自 `SHASUMS256.txt`，再實際下載核對雜湊與大小，Authenticode 皆 `Valid`（`CN=OpenJS Foundation`）。建置時不讀 SHASUMS。
- **holder key** = `<Node 版本>-<12 hex>`：12 hex 取自「依 path 排序的 `path\tsize\tsha256\n`」的 SHA-256 前 12 碼。key 只由內容決定，不含 BAT 版本。本機的產物是 `24.22.2-57c3b8bd7d7a`。
- **manifest 第 3 行固定是 `  "key": "<key>",`**：安裝程式從這行讀 key。manifest 不含時間與 BAT 版本，所以內容相同的 manifest 位元組也相同，安裝程式靠這點判斷「已是最新」。
- **根目錄名稱 `BAT-PtyHolder`**（D2 允許微調名稱）：per-user 與 per-machine 用同一個名稱。理由見下一節。
- **組裝來源**：`terminal-server.js` 與 node-pty 的檔案都取自打包內 `app.asar.unpacked`，也就是 BAT 實際執行的那一份。node-pty 只帶 `package.json`、`LICENSE` 與 `.js`；win32 原生套件只帶 `package.json`、`conpty.node`、`conpty_console_list.node`，不帶約 10 MB 的 `.pdb`。`terminal-server.js` 若 require 了 `@lydell/node-pty` 以外的非內建套件，打包就失敗。

### holder 根目錄的路徑規則

- per-user（`$installMode` ≠ `all`）：`$LOCALAPPDATA\BAT-PtyHolder\<key>\`，例如 `<使用者資料夾>\AppData\Local\BAT-PtyHolder\24.22.2-57c3b8bd7d7a\`。
- per-machine（`$installMode == "all"`）：`$PROGRAMFILES64\BAT-PtyHolder\<key>\`，例如 `C:\Program Files\BAT-PtyHolder\…`，由提權的安裝程式寫入。
- 為什麼不叫 `BetterAgentTerminal…`：預設安裝目錄是 `…\Programs\BetterAgentTerminal` 與 `C:\Program Files\BetterAgentTerminal`，而 NSIS 用 `StartsWith('$INSTDIR')` 比對、結尾不帶 `\`，`C:\Program Files\BetterAgentTerminal-PtyHolder` 也會被比中。`BAT-PtyHolder` 不會以這兩個預設安裝目錄開頭。
- 🔴 根目錄與 `$INSTDIR` 只要任一方是另一方的字串前綴（不分大小寫，例如自訂安裝目錄 `C:\Program Files\BAT`），就不複製也不清理。JS 端是同一條規則（`holderRootConflictsWithInstallDir`），W3 決定要不要用 holder 時要照做。

### `customInstall` 的複製與清理流程

1. 套件沒有 `resources\pty-holder\holder-manifest.json` → 什麼都不做。
2. 依安裝範圍決定根目錄，並做前綴檢查（見上一節）。
3. 從 manifest 第 3 行讀 key。長度 < 18 或含 `\` / `/` 就不複製。
4. `<根>\<key>\holder-manifest.json` 與套件內的逐行完全相同（大小寫敏感）→ 略過複製。
5. 否則：
   - `<key>` 已存在但內容不同 → 確認沒有程序在用才刪掉；有程序在用或無法判斷 → 保留它並跳過複製。
   - 複製到 `<key>.partial`，再 `Rename` 成 `<key>`。複製或改名失敗 → 刪掉 `.partial`，不會留下不完整的 `<key>`。
6. 清理：根目錄下其他每個目錄，PowerShell 回答「沒有程序的路徑以 `<目錄>\` 開頭」（exit 11）才 `RMDir /r`。回答「有」（exit 10）或無法判斷（PowerShell 不存在、失敗、路徑含 `'`）→ 保留。

其他：沒有新增 `Var`（用 `$R0`–`$R9` 並 Push / Pop 還原）；不結束任何程序；沒有 `Stop-Process` / `taskkill` / `KILL_PROCESS`（T0823 的 source guard 照樣通過）。

**〈待 W6 驗收〉安裝程式的實際執行**（本單規定不執行安裝檔）：per-user 與 per-machine 的複製、同版重裝略過、key 改變時舊目錄被清掉、執行中的版本目錄被保留、前綴衝突時不複製、`CopyFiles` 對 `node_modules\` 子目錄的遞迴複製。本單只確認 NSIS 編得過：electron-builder 帶 `-WX`，安裝程式與解除安裝程式都編譯成功。

### 驗證

| 項目 | 結果 |
|---|---|
| `npm run build:dir`（本機 Windows） | ✅ exit 0。afterPack 輸出：`downloading https://nodejs.org/dist/v24.22.2/win-x64/node.exe` → `downloaded, SHA-256 verified` → `PTY holder 24.22.2-57c3b8bd7d7a in resources\pty-holder (21 files, 94423796 bytes)` |
| `node scripts/verify-packaged-native.js --platform win --out release --arch x64` | ✅ exit 0，`…, PTY holder matches its manifest` / `every windows package passed (x64)` |
| NSIS 實際編譯（`npx electron-builder --win nsis --prepackaged release/win-unpacked --publish never`，只編譯、不執行） | ✅ exit 0（`-WX`） |
| 任務 5 手動載入（見下） | ✅ PASS |
| `npm run typecheck` | ✅ 0 |
| `npm run typecheck:electron` | ✅ 0（乾淨的 HEAD `aa59902e`，見下方說明） |
| `npm run test:unit` | ✅ 乾淨的 HEAD：443 檔通過、3 檔 skipped；8068 passed / 0 failed / 40 skipped |
| `npm run test:legacy` | ✅ 33 檔通過；472 passed / 0 failed |
| `npx vite build` | ✅（`build:dir` 內與乾淨 worktree 各一次） |
| `asar-runtime-deps.test.mjs` | ✅ 不回歸（相關 6 檔：202 passed / 0 failed / 14 skipped，skipped 是 POSIX-only 的既有測試） |
| 新測試 `pty-holder.test.mjs` | ✅ 26 / 26 |

**主 checkout 的結果與 T0857 的關係**：T0857（W1）的 Worker 同時在同一個 checkout 修改 `electron/terminal-server/*`、`electron/main.ts` 等檔案，這些變更都還沒 commit。在主 checkout 跑時：
- `typecheck:electron` 有 3 個錯誤，都在 T0857 未追蹤的 `electron/__tests__/terminal-server-protocol-v1.test.ts`。
- `test:unit` 有 1 個失敗：`app-paths-bootstrap-order.test.ts` › `userdata-migration stays electron-free`，原因是 T0857 在 `pid-manager.ts` 新增了 `crypto` import。

本單沒有修改任何 `electron/**`。為了排除 T0857 未 commit 的變更，在 scratchpad 以 `git worktree add --detach … HEAD` 開乾淨的 worktree（node_modules 用 junction 共用）重跑上表的 typecheck 與 test:unit，結果全部通過。跑完先拆 junction，再 `git worktree remove`，主 checkout 的 node_modules 已確認完好。這些交給塔台在合併 W1 時注意。

**macOS / Linux 不變的依據**：
- `package.json` 沒有變更，`build.<platform>` 沒有 `files` / `extraResources` / `extraFiles`，頂層 `extraResources` 仍只有 `scripts`（source guard 斷言）。
- `afterPackPtyHolder` 對 `darwin` / `linux` 直接 return null，不呼叫 fetch、不寫檔（`pty-holder.test.mjs`）。
- `afterPack` 對三個平台都呼叫同一個步驟，Linux 的 AppImage / patchelf 行為不變（`appimage-sandbox-launcher.test.mjs`）。
- `verify-packaged-native.js` 在 mac / linux 看到 `resources/pty-holder` 會失敗。

#### 任務 5：手動載入（scratchpad，不碰安裝版）

做法：把 `release\win-unpacked\resources\pty-holder\` 複製到 `<scratchpad>\holder-smoke\BAT-PtyHolder\24.22.2-57c3b8bd7d7a\`（模擬安裝程式複製到安裝目錄外），複製後 `ptyHolderProblems` = `[]`。用 driver 腳本啟動：`child_process.fork('<dir>\terminal-server.js', [], { execPath: '<dir>\bat-pty-holder.exe', cwd: '<dir>', env: { …process.env 去掉 ELECTRON_RUN_AS_NODE, BAT_USER_DATA: '<scratchpad>\userdata' }, stdio: [ignore, pipe, pipe, ipc] })`。

| 情境 | 結果 |
|---|---|
| A：`server:getConfig` → `pty:create`（`cmd.exe`）→ `pty:write` `echo HOLDER_OK_%PROCESSOR_ARCHITECTURE% & exit` → `server:shutdown` | ✅ `server:config` +78 ms；`pty:created` +110 ms。holder 的子程序是 `conhost.exe`（`\\?\C:\WINDOWS\system32\conhost.exe`）與 `cmd.exe`。holder 的 ExecutablePath 是複製出來的 `…\BAT-PtyHolder\24.22.2-57c3b8bd7d7a\bat-pty-holder.exe`。看到 `HOLDER_OK_AMD64`，`pty:exit 0`，port / pid 檔都有寫，holder exit 0，stderr 沒有輸出 |
| B：`pty:create`（`cmd.exe /k ping -n 30 127.0.0.1`）→ 500 ms 後 `pty:kill` → `server:shutdown` | ✅ `pty:exit 1`（+1.1 s），holder exit 0，之後沒有任何殘留程序（路徑含 scratchpad 的程序 = 0）。stderr 有 `conpty_console_list_agent.js` 的 `Error: AttachConsole failed`：這表示 node-pty 用 holder 的 exe fork 那支 agent 成功了，agent 是在附加 console 時失敗 |
| B 的對照：同一情境改用 `release\win-unpacked\BetterAgentTerminal.exe`（`ELECTRON_RUN_AS_NODE=1`）＋ `app.asar.unpacked\dist-electron\terminal-server.js`，也就是今天的 runtime | 同樣 `pty:exit 1`、同樣 `AttachConsole failed`，所以**不是 holder 造成的**。推論：`endPty` 在 Windows 先 `taskkill /T` 再 `pty.kill()`（T0540），agent 附加不到已經結束的 shell。乾淨 HEAD 的 `test:unit` 輸出也有同樣的 stderr |

實驗結束後已刪除 scratchpad 裡的 holder 副本、driver 腳本與下載的 node.exe。

### 安裝檔大小變化

| 項目 | 不含 holder | 含 holder | 差異 |
|---|---|---|---|
| `resources\pty-holder\`（未壓縮） | — | 94,423,796 bytes（manifest 列的 21 個檔）＋ manifest 3,923 bytes | +90.0 MiB |
| NSIS 安裝檔（x64，`compression: normal`） | 320,251,608 bytes | 341,738,302 bytes | **+21,486,694 bytes（+20.5 MiB，+6.7%）** |
| 安裝後的磁碟 | — | `$INSTDIR\resources\pty-holder\` 約 90 MiB ＋ holder 根目錄約 90 MiB（通常只有 1 份 key） | 約 +180 MiB |

量法：同一份 `release\win-unpacked` 編兩次 NSIS，對照組先拿掉 `resources\pty-holder`。對照用的目錄放在 repo 根目錄的 `release-t0858-baseline*`，量完已刪除。zip target 也會帶 `resources\pty-holder\`（同一個 `appOutDir`），本單沒有量 zip 的大小。

### 遭遇問題

- 無阻斷。
- T0857 在同一個 checkout 並行修改（見〈驗證〉的說明）。本單的 `build:dir` 產物裡，`terminal-server.js`（13,955 bytes）含 T0857 未 commit 的程式。任務 5 的手動載入跑的就是這一份，IPC 路徑正常；乾淨 HEAD 的 `terminal-server.js` 是 9.27 kB。holder 的 key 會隨 `terminal-server.js` 改變，這是預期的行為。
- `build:dir` 會先清掉 `dist-electron`。如果 T0857 剛好在跑讀 `dist-electron` 的測試，可能短暫受到影響，`vite build` 跑完後就恢復。

### 後續建議（給塔台）

1. **W3（T0859）**：
   - 決定使用 holder 前，先以 `ptyHolderProblems` 等效的檢查驗證 manifest 與雜湊，並照 `holderRootConflictsWithInstallDir` 的規則檢查路徑。理由：安裝程式只比對 manifest，不重算 `<key>` 目錄裡每個檔案的雜湊。
   - 根目錄名稱、manifest 欄位、key 規則見 `docs/agent-guide/packaging-release-checks.md`「Windows PTY holder 打包」。W3 可以從 `scripts/pty-holder.cjs` 移植常數，或改成共用模組。
2. **磁碟**：`$INSTDIR\resources\pty-holder\` 複製出去之後仍留在安裝目錄，所以 holder 在磁碟上佔兩份，約 180 MiB。若要省下 90 MiB，可以讓安裝程式複製成功後刪掉安裝目錄裡那份，但 W3 若要用它來比對就不能刪，請在 W3 / W4 一起決定。
3. **Node 授權檔**：`https://nodejs.org/dist/v<版本>/win-x64/` 只有 `node.exe`，Node 的 `LICENSE` 只在 zip 裡，所以本單沒有附上。若要在 holder 目錄附 Node 授權，需要改成下載並解開 zip，或另外決定授權檔的來源，請塔台決定。
4. **W4 / W6**：
   - 解除安裝時刪除 holder 根目錄（兩種範圍都要）。
   - per-user 與 per-machine 範圍切換時，另一個範圍留下的根目錄。
   - 〈待 W6 驗收〉列出的安裝程式實測項目。

### 方法論狀態回寫

- 不適用（工單沒有 `methodology`）。

### 回報時間

- 2026-11-04T18:50:35+08:00
