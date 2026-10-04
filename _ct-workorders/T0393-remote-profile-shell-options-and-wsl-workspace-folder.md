---
schema_version: 1
schema_kind: workorder
id: T0393
title: "PLAN-036 P0-E：遠端視窗 shell 清單依遠端 OS 過濾 + 工作區資料夾挑選預設 WSL 內部目錄（`/mnt/c` 提示）"
type: implementation
status: DONE
priority: P1
sizing: S
created_at: "2026-10-05T00:02:55+08:00"
updated_at: "2026-10-05T00:50:41+08:00"
started_at: "2026-10-05T00:42:24+08:00"
completed_at: "2026-10-05T00:50:41+08:00"
target_version: next
depends_on: [T0390]
related:
  - "PLAN-036 / D129（使用者 2026-10-05 00:02 裁決納入 P0）"
  - "使用者實機回報：WSL profile 視窗的終端設定只有 Windows shell；新增工作區開的是 Windows 目錄"
affects_files:
  - src/components/SettingsPanel.tsx
  - src/types/index.ts
  - src/App.tsx
  - electron/main.ts
  - electron/preload.ts
  - src/types/electron.d.ts
  - src/locales/
  - src/components/__tests__/
  - electron/__tests__/
interaction:
  mode_hint: on
  interactive: false
  intervention_type: none
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）。"
  - "🔴 不得碰使用者 WSL 內的 `bat-server.service` / `~/.local/bat-server`（部署交使用者以 T0391 工具執行）。"
  - "🔴 Renderer 不得 import Node builtin（D090）；renderer log 用 `window.electronAPI.debug.log`。child_process 一律 `execFile` / `spawn` + array args，timeout 必設，distro 過白名單。"
  - "⚠️ 本機 profile 行為不得改變（shell 清單、資料夾對話框）。使用者可見文案走 i18n。不 push。"
---

# T0393 — 遠端視窗 shell 選項與 WSL 工作區目錄

## 背景（使用者實機回報，塔台 2026-10-05 00:02 複核）

1. **shell 清單**：`src/components/SettingsPanel.tsx:109` `SHELL_OPTIONS.filter(opt => opt.platforms.includes(platform))` 以**本機平台**過濾 ⇒ WSL profile 視窗只看到 pwsh / powershell / cmd，沒有 bash / zsh / sh。遠端視窗的設定是遠端的（`settings:load/save` 代理到 headless，T0385），shell 會在遠端 Linux 執行
2. **工作區目錄**：新增工作區走 `src/App.tsx:683` `dialog.selectFolder()` → `electron/main.ts:3107` 本機 `dialog.showOpenDialog`（不代理），預設停在 Windows 目錄。路徑轉換已存在（`electron/remote/path-translator.ts`：`C:\…` ↔ `/mnt/c/…`、`\\wsl$` / `\\wsl.localhost\<distro>\…` ↔ `/…`），所以技術上能選 WSL 內部目錄，但沒有任何引導；選 `/mnt/c` 下的目錄在 WSL 內 I/O 慢、git / npm 易遇權限與換行問題

## 範圍

1. **shell 清單依遠端 OS**：遠端 profile 視窗以 profile `targetOS`（`wsl-linux` / `ssh-linux` / docker 等 → `linux`；mac 目標 → `darwin`）決定過濾平台，本機視窗維持 `process.platform`。決定方式（renderer 如何得知自己是遠端視窗及其 OS）由 Worker 選，沿用既有 API 優先
2. **WSL 工作區資料夾挑選**：WSL profile 視窗新增工作區時，對話框 `defaultPath` 設為 `\\wsl.localhost\<distro>\home\<user>`（`<user>` 取得方式由 Worker 決定，例如 profile 已存資訊或 `wsl.exe -d <distro> -- whoami`，distro 過白名單、timeout 必設）；取不到時退回原行為
3. **`/mnt/c` 提示**：WSL profile 視窗選到 Windows 磁碟路徑（轉換後落在 `/mnt/<drive>/`）時，提示效能與相容性風險並建議放在 WSL 內部目錄；**不阻擋**（使用者可繼續）
4. SSH / Docker：本單只做第 1 項（shell 清單）；資料夾挑選維持原行為，回報區記錄 SSH 需要遠端資料夾瀏覽器（屬 P2 fs）

## 驗收

- unit：遠端 `wsl-linux` / `ssh-linux` 視窗 shell 清單含 bash / zsh、不含 pwsh / cmd；本機 win32 視窗不變；`defaultPath` 組裝與 distro 白名單；`/mnt/c` 判定
- `npm run test:unit` 全綠；`npx vite build` exit 0；`npx tsc --noEmit` ≤ baseline（以派發時 HEAD 為準，回報數字）
- **P0 實機驗收（交使用者，與 T0390 合併）**：WSL profile 視窗設定可選 bash → 新增工作區對話框開在 WSL home → 選 `/home/<user>/<dir>` 開終端 `pwd` 正確；另選一個 `C:\…` 目錄出現提示、終端 `pwd` 為 `/mnt/c/…`

## Sub-session 執行指示

1. 讀取本工單 + PLAN-036 + T0390 回報區
2. 填 `started_at`、`status: IN_PROGRESS`（**`date "+%Y-%m-%dT%H:%M:%S%z"` 取系統時間**，R-G001）
3. 實作 → 驗收
4. 填回報區；完成寫 **`DONE`**
5. commit 僅實際改動檔 + 新測試檔 + 本工單檔（`git commit --only ...`）
6. 依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 執行摘要

- **開始**：2026-10-05T00:42:24+08:00（Worker，`CT_MODE=on`、`CT_INTERACTIVE=0`）
- **落點檢查**：WARN —— C-0 無法判定（frontmatter **無 `repo` 欄位**；`basename(REPO_ROOT)` = `better-agent-terminal`）；C-1 PASS（工單在 REPO_ROOT 下）；C-3 PASS（`SettingsPanel.tsx` / `main.ts` / `App.tsx` 等皆存在）；C-2 不適用（無 `branch` 欄位，HEAD=`main`）。`BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）
- **結果**：DONE。範圍 1-4 全部落地；自動化閘門（unit / vite build / tsc / 實環境 resolver smoke）皆 PASS。**P0 實機驗收（WSL UI）交使用者**，步驟見下方

### 實作內容

1. **shell 清單依遠端 OS（範圍 1）**
   - `src/types/index.ts`：新增 `shellPlatformForTargetOS(targetOS, localPlatform)`（`wsl-linux` / `ssh-linux` / `docker-linux` → `linux`；`ssh-darwin` → `darwin`；`local` / 未設定 / 未知 → 本機平台）與 `getShellOptionsForPlatform(platform)`
   - **renderer 得知遠端 OS 的方式（沿用既有 API）**：`App.tsx` `initProfile` 已經解出本視窗的 profile（`getWindowProfile()` → `profile.list()` / `listLocal()`），只在「遠端連線成功」分支 `setWindowRemoteTarget({ targetOS, wslDistro })`；連線失敗退回本機 profile 的分支不設（視窗實際走本機，清單維持本機）。沒有新增 IPC
   - `SettingsPanel` 新增 optional prop `targetOS`，以 `shellPlatformForTargetOS(targetOS, platform)` 過濾；custom shell 路徑的 placeholder 也跟著遠端平台（`/path/to/shell`）。VS Code 路徑 placeholder 仍用本機平台（編輯器在本機開）
2. **WSL 工作區資料夾預設 WSL home（範圍 2）**
   - 新檔 `electron/wsl-workspace-folder.ts`：`wslDistroForFolderDialog(profile)`（只認 `type: 'remote'` + `targetOS: 'wsl-linux'`，distro 過 `/^[a-zA-Z0-9._-]+$/`）、`wslHomeUncCandidates(distro, home)`（`\\wsl.localhost\<distro>\home\<user>`，`\\wsl$\…` 為 legacy 備援）、`createWslFolderDefaultResolver()`（成功結果依 distro cache，失敗下次重試）
   - `<user>` 取得方式：**沿用既有 `wslDetect.resolveHome(distro)`**（T0378：`execFile('wsl', ['-d', distro, '--', 'printenv', 'HOME'])`，distro 白名單 + HOME 格式驗證）。取 `$HOME` 而非 `whoami`，root 使用者會正確落在 `/root`。外加 **5s** 上限（resolveHome 本身是 15s timeout，對開對話框太長）與 UNC stat **3s** 上限
   - `main.ts` `dialog:select-folder`：`wslFolderDefaultForSender(event.sender)` —— 僅 win32、且 sender 視窗的 registry profile **正由遠端連線服務中**（與 `bindProxiedHandlersToIpc` 相同條件：`entry.profileId === remoteClientProfileId && remoteClient.isConnected`）才套 WSL home；其他情況（本機視窗、SSH / Docker、取不到 home、UNC 不存在、例外）回 `null` → `app.getPath('home')`（原行為）
3. **`/mnt/c` 提示（範圍 3）**：`src/utils/wsl-path.ts` 新增 `isWslWindowsDrivePath(clientPath, distro)`（`winToWsl` 後落在 `/mnt/<drive>(/|$)`；`\\wsl.localhost\<distro>\mnt\c\…` 也算，`\mnt\wslg` 不算）。`App.tsx` `handleAddWorkspace` 在**工作區已加入並 save 之後**，若為 WSL 視窗且任一路徑命中，`setAppNotification(t('app.wslWindowsDriveWorkspaceHint', { path, wslPath }))` —— 純提示、不阻擋。i18n key 三語（en / zh-TW / zh-CN）皆補，`i18n-completeness` 測試通過
4. **SSH / Docker（範圍 4）**：只套第 1 項（shell 清單 linux / darwin）；資料夾挑選維持原行為（`wslDistroForFolderDialog` 對非 WSL 回 null）

### 驗收證據

| 證據道 | 結果 | 內容 |
|---|---|---|
| unit（新） | PASS | `src/components/__tests__/settings-shell-options.test.ts`：`wsl-linux` / `ssh-linux` 視窗含 `bash` / `zsh` / `sh`、不含 `pwsh` / `powershell` / `cmd` / `git-bash`；本機 win32 清單 = 原 `SHELL_OPTIONS.filter(win32)`（`auto,pwsh,powershell,cmd,git-bash,custom`）；darwin / linux 本機不變；`ssh-darwin` → darwin、`docker-linux` → linux。`electron/__tests__/wsl-workspace-folder.test.ts`：defaultPath 組裝（`\\wsl.localhost` 優先、`\\wsl$` 備援、`/root`）、distro 白名單（空白 / `;` / `..\` / `/` / `$(...)` / 引號皆拒且**不 spawn**）、home probe 失敗 / 逾時 / 不安全 home / UNC 皆不可用 → null、cache 與失敗重試、`/mnt/<drive>` 判定（含 long path、UNC 進 `mnt\c`、他 distro / 網路分享 / `mnt\wslg` 不命中） |
| 負向驗證 | 紅燈正確 | 暫時讓 `wsl-linux` 不映射到 linux、拿掉 resolver 的 distro 白名單 → 3 個案例失敗；已從 scratchpad 備份覆回並 grep 確認還原 |
| `npm run test:unit` | PASS | **76 files / 1074 tests 全綠**（T0390 回報 74 / 1051） |
| `npx vite build` | PASS | exit 0 |
| `npx tsc --noEmit` | PASS | **40**（派發時 HEAD `55b0340` baseline 40，分布相同：CodexAgentPanel 33 / terminal-keyboard-event.test 5 / agent-profiles 1 / integration.transitions.test 1）。註：根 tsconfig 只含 `src`；另跑 `tsc -p tsconfig.node.json`（electron）有 198 個既有設定類錯誤（main.ts 97 等，`downlevelIteration` 等），**本單觸及行與新檔 0 錯** |
| 實環境 smoke（resolver） | PASS | esbuild 打包 `electron/wsl-workspace-folder.ts` 以 plain node 對本機真 WSL 執行：`Ubuntu-24.04` → `\\wsl.localhost\Ubuntu-24.04\home\gower`（94ms），第二次 cache 0ms；`NoSuchDistro` → null（log `home probe failed`）；`a b` → null（不 spawn）。PowerShell `Test-Path` 確認該 UNC 目錄存在 |
| Electron UI smoke | 未執行 | 本機視窗兩條路徑的變更為「targetOS 未設定 → 原平台」與「非 WSL 遠端 → null → `app.getPath('home')`」，由 unit 鎖定；UI 層實測併入下方 P0 實機驗收 |
| P0 實機驗收（WSL） | 交使用者 | 見下節 |

### P0 實機驗收步驟（交使用者，與 T0390 合併）

> 前提：本單為 **client（BAT 本體）端**改動，需用本 working tree 的 BAT（`npm run dev` 或打包）執行；headless 端不需重新部署（T0390 已部署者沿用）。

1. 開 BAT → 開 WSL profile（Ubuntu-24.04）視窗 → 設定 → 一般 → Shell：下拉應為 **Auto Detect / Zsh / Bash / sh / Custom**，沒有 pwsh / cmd；選 Bash（遠端 settings 會存到 headless）
2. 本機 profile 視窗開設定：下拉仍為 Auto / PowerShell 7 / Windows PowerShell / cmd / Git Bash / Custom（不變）
3. WSL 視窗 → 新增工作區：資料夾對話框應開在 `\\wsl.localhost\Ubuntu-24.04\home\gower`（debug log 會有 `[wsl-folder] select-folder default for Ubuntu-24.04: \\wsl.localhost\...`）
4. 選 `/home/gower/<dir>`（或在對話框內建一個）→ 開終端 → `pwd` 應為 `/home/gower/<dir>`，**不應**出現提示
5. 再新增一個工作區，選 `C:\…` 目錄 → 出現提示（含 `/mnt/c/…`），按確定後工作區仍在 → 開終端 `pwd` 為 `/mnt/c/…`
6. 本機視窗新增工作區：對話框仍開在 Windows 使用者目錄，選 `C:\…` 不出現提示

### 偏差 / 風險 / 後續

1. **affects_files 外的檔案**：新增 `electron/wsl-workspace-folder.ts`（main 端邏輯抽出以便單元測試；`main.ts` 本身無法單元測試）；修改 `src/utils/wsl-path.ts`（新增 `isWslWindowsDrivePath`，放在既有 `winToWsl` 旁，renderer / electron 共用）。`electron/preload.ts` / `src/types/electron.d.ts` 未改（沒有新增或改簽章的 IPC）
2. **SSH 遠端資料夾挑選**：SSH profile 視窗的資料夾對話框仍是本機 Windows 檔案系統，選到的路徑只能靠 `SshPathTranslator`（client home ↔ server home）對應；要真正挑遠端目錄需要**遠端資料夾瀏覽器**（走 headless `fs:*`，屬 PLAN-036 **P2 fs**）。Docker 同理（只能挑已 mount 的 host 路徑）
3. **Docker 精靈的 mount 挑選**（`setup-wizard/steps/docker/configure-mounts.ts`）也呼叫 `dialog.selectFolder()`：若使用者在「已連線的 WSL 視窗」裡開 Docker 精靈，對話框會預設 WSL home（仍可自由切換）。一般從本機視窗開精靈不受影響。低風險，記錄不改
4. **遠端視窗的 shell 設定值**：headless 的 settings 預設 `auto`；若遠端 settings 內殘留 Windows shell 值（例如舊版曾把本機設定推上去），下拉會顯示清單第一項但實際值不變 —— 與本機既有行為一致（未改）。headless `pty:create` 會以 T0390 的 shell 驗證 / resolver fallback 處理
5. `targetOS` 取自 renderer 的 `initProfile` 解析結果，只在遠端連線成功時設定；連線中途斷線（`isRemoteConnected` 輪詢變 false）不會改回本機清單（設定仍屬遠端）。main 端資料夾預設則以當下連線狀態判斷，斷線時退回原行為

### 變更檔案

- 新增：`electron/wsl-workspace-folder.ts`、`electron/__tests__/wsl-workspace-folder.test.ts`、`src/components/__tests__/settings-shell-options.test.ts`
- 修改：`electron/main.ts`、`src/App.tsx`、`src/components/SettingsPanel.tsx`、`src/types/index.ts`、`src/utils/wsl-path.ts`、`src/locales/{en,zh-TW,zh-CN}.json`、本工單
- 沒動：`electron/preload.ts`、`src/types/electron.d.ts`、`electron/wsl-detect.ts`；沒用 stash / reset / checkout / restore；沒碰 WSL `bat-server.service` / `~/.local/bat-server`；沒 push

### Commit

- 單一 commit，`git commit --only` 只含上列檔案；沒 push。hash 見 `git log`（回報區在 commit 前寫入，不自我引用）
