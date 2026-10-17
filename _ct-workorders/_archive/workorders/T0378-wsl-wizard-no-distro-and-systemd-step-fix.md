---
schema_version: 1
schema_kind: workorder
id: T0378
title: "BUG-086 + BUG-087 修復：WSL 精靈無發行版誤報、linger 未帶使用者、unit 檔 `~`、失敗後 bundle 被回滾"
type: implementation
status: DONE
priority: P1
sizing: M
created_at: "2026-10-04T21:15:17+08:00"
updated_at: "2026-10-04T21:27:09+08:00"
started_at: "2026-10-04T21:16:09+08:00"
completed_at: "2026-10-04T21:27:09+08:00"
target_version: next
depends_on: []
related:
  - "BUG-087（主修復對象，high；三個缺陷 A/B/C 與全部證據）"
  - "BUG-086（low；無發行版誤報為找不到 WSL2）"
  - "D126（本工單決策）"
  - "BUG-071（已 CLOSED；第 4 步下載流程已實機通過，勿回歸）"
  - "BUG-072（已 CLOSED；linger 文案 / bat-server.service timeout，可能與缺陷 B 同根因）"
affects_files:
  - electron/wsl-detect.ts
  - electron/wsl-systemd.ts
  - electron/main.ts
  - electron/preload.ts
  - src/types/electron.d.ts
  - src/components/setup-wizard/error-mapper.ts
  - src/components/setup-wizard/wizard-runner.ts
  - src/components/setup-wizard/steps/wsl/detect-env.ts
  - src/components/setup-wizard/steps/wsl/pick-wsl-distro.ts
  - src/components/setup-wizard/steps/wsl/install-server-bundle.ts
  - src/components/setup-wizard/steps/wsl/write-systemd-unit.ts
  - src/locales/en.json
  - src/locales/zh-TW.json
  - src/locales/zh-CN.json
  - src/components/setup-wizard/__tests__/
  - electron/__tests__/
interaction:
  mode_hint: on
  interactive: false
  intervention_type: none
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 child_process 一律 `execFile` / `spawn` + array args，timeout 必設；distro / username 等外部輸入過 `/^[a-zA-Z0-9._-]+$/` 白名單（CLAUDE.md Child Process Spawning）。禁用 shell-spawning exec API。"
  - "🔴 判斷 WSL 狀態以 **exit code** 為主，不依賴 `wsl.exe` 的本地化輸出字串（輸出為 UTF-16LE，且隨 Windows 語系變動）。"
  - "🔴 不得刪除 / 重建 / unregister 本機 WSL 發行版 `Ubuntu-24.04`（使用者測試環境，塔台已設定好 `gower` 使用者）。可在其中讀取狀態、`loginctl disable-linger gower` 重現、刪除精靈寫出的 `~/.config/systemd/user/bat-server.service`。"
  - "🔴 SSH / Docker 精靈不在範圍；共用模組（`error-mapper.ts`、`wizard-runner.ts`）若改動，SSH / Docker 既有測試必須全綠。"
  - "⚠️ 不 push。"
---

# T0378 — WSL 精靈：無發行版誤報 + systemd 步驟三缺陷

## 背景

BUG-071 修好後（第 4 步能下載並安裝 server bundle），使用者在乾淨的 `Ubuntu-24.04` 上跑 WSL 精靈，**第 5 步「寫入 systemd 使用者服務」必失敗**。塔台環境檢查找出三個缺陷（BUG-087 A/B/C）。另外一開始沒有發行版時，第 1 步誤報「找不到 WSL2」（BUG-086）。

**實作前完整讀 BUG-087 與 BUG-086**，所有指令輸出與程式位置都在那裡。

## 決策（D126）

### 1. 缺陷 A — linger 帶明確使用者名稱
- `electron/wsl-systemd.ts` `enableLinger()`：先取得發行版預設使用者（例如 `runWsl(distro, ['id', '-un'])`），過白名單 regex 後執行 `loginctl enable-linger <user>`
- 成功判定：以 `loginctl show-user <user> -p Linger` 回 `Linger=yes` 為準（ENXIO 時 `loginctl` 的 exit code 不可靠：塔台實測錯誤訊息印出但 `$?` 為 0）
- 已是 `Linger=yes` 時直接視為成功
- `error-mapper.ts` 的手動指令文案（`sudo loginctl enable-linger $USER`）保留，它本身正確

### 2. 缺陷 B — systemd unit 不得出現 `~`
- 改成**解析發行版使用者的絕對 `$HOME`**（例如 `/home/gower`），install path 與 data dir 都用絕對路徑，`ctx.serverInstallPath` 存絕對路徑；`ExecStart` / `Environment` 寫出絕對路徑
- **不用 `%h` specifier**：`escapeSystemdValue` 可能會跳脫 `%`，行為不透明。若 Worker 讀碼後確認 `%h` 更乾淨且不被跳脫，可以改用，但須在回報區說明理由
- `validateInstallPath()` 須接受絕對路徑（請確認現有 `assertValidUnixPath` 行為）
- 取得 `$HOME` 的方式：`execFile` array args，例如 `['-d', distro, '--', 'sh', '-c', 'printf %s "$HOME"']`（固定字串，無外部輸入插值），結果須為 `/` 開頭且通過路徑驗證

### 3. 缺陷 C — 失敗後回滾與重試的一致性
- **先查明**：第 5 步失敗時是誰、在什麼時機呼叫了 `install-server-bundle` 的 `rollback()`（`wizard-runner.ts` 的失敗 / 重試 / 取消流程）
- 目標行為：**可重試（retryable）的失敗不得回滾前面已成功的步驟**；回滾只在使用者「取消」整個精靈時執行。若查證後發現架構上有其他正當理由，改為「重試時從被回滾的最早步驟重跑」也可，但 UI 不得顯示已被回滾的步驟為 ✓
- 回報區須寫清楚查到的 rollback 觸發點與改法

### 4. BUG-086 — 區分「沒裝 WSL」與「有 WSL 沒發行版」
- `wsl -l -v` 非零 exit 時，以另一個 exit-code 訊號判斷 WSL 本身是否已安裝（例如 `wsl --status` 或 `wsl --version`；本機：WSL 2.7.13 已裝、無發行版時兩者皆 exit 0，`wsl -l -v` exit -1）
- 「有 WSL、沒發行版」回傳空清單或專屬錯誤類型，`error-mapper.ts` 新增對應分類，三語 i18n 文案引導：`wsl --install -d Ubuntu-24.04`（並提到可用 `wsl --list --online` 查看其他發行版）
- 「沒裝 WSL」的既有文案與行為不變
- ⚠️ 本機無法重現「完全沒裝 WSL」，以 mock 的 unit test 覆蓋；回報區註明未實機驗證

## 驗收

- unit（新增）：
  - linger：帶使用者名稱、`Linger=yes` 判定、已啟用直接成功、username 不合白名單 → 失敗
  - unit 檔內容：`ExecStart` / `Environment` 為絕對路徑，**不含 `~`**
  - 安裝路徑解析：`$HOME` 解析成功 / 失敗 / 非絕對路徑
  - rollback：可重試的失敗不觸發前步 rollback；取消時才 rollback（或依查證後的改法寫對應測試）
  - WSL 偵測三態與 `error-mapper` 新分類（含 i18n key 三語存在）
  - 測試檔位置須被 `vite.config.ts` `test.include` 涵蓋
- `npm run test:unit` 全綠（基線 **709**；回報新數字）
- `npx vite build` exit 0
- `npx tsc --noEmit` error 數不得高於 baseline **40**
- **本機 runtime（Worker 可做）**：在 `Ubuntu-24.04` 內以 node 直接呼叫（或 esbuild 打包到 scratchpad 呼叫）修改後的 `enableLinger` / `$HOME` 解析 / unit 內容產生函式；先 `loginctl disable-linger gower` 再驗證能自動啟用。若能以修好的 unit 內容在發行版內 `systemctl --user daemon-reload` 後看到 `Loaded: loaded`（不是 `bad-setting`）更好（bundle 不在時 `start` 失敗屬預期）。scratchpad 產物用完刪除
- **runtime 驗收（交使用者）**：新 build 從頭跑 WSL 精靈 9/9

## 範圍外

- NAT networking 警告（資訊性，connect-test 步驟才相關）
- SSH / Docker 精靈的同類問題（若讀碼時發現，記在回報區「殘餘風險」，不修）
- 本機 WSL 發行版的建立 / 移除

## Sub-session 執行指示

1. 讀取本工單 + `BUG-087` + `BUG-086`
2. 填 `started_at`、`status: IN_PROGRESS`（**`date "+%Y-%m-%dT%H:%M:%S%z"` 取系統時間，禁止手打**，R-G001）
3. 實作 → 驗收
4. 填回報區；完成寫 **`DONE`**（不是 `FIXED`）；BUG-086 / BUG-087 狀態由塔台更新，不要改 BUG 檔
5. commit 僅實際改動檔 + 新測試檔 + 本工單檔（`git commit --only ...`）；`AGENTS.md` 若 dirty 不要碰
6. 依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 結果摘要

**DONE** — BUG-087 A/B/C 與 BUG-086 全部修復；unit 749/749、vite build exit 0、tsc 40（= baseline）；本機 `Ubuntu-24.04` runtime 驗證 linger 自動啟用 + unit `Loaded: loaded`。精靈完整 9/9 runtime 驗收交使用者（新 build）。

### Landing Zone

| 檢查 | 結果 |
|------|------|
| C-0 repo identity | ⚠️ WARN — frontmatter 無 `repo` 欄位（`absent`）；`basename(REPO_ROOT)` = `better-agent-terminal` |
| C-1 work order path | ✅ PASS（在 REPO_ROOT 下） |
| C-3 affects_files | ✅ PASS（前 5 個可測項全部存在） |
| C-2 branch | ℹ️ 無 `branch` 欄位；HEAD = `main` |
| `BAT_WORKSPACE_ID`（僅證據） | `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b` |
| 派發 mode | `CT_MODE=on`、`CT_INTERACTIVE=0` |

### 缺陷 C — rollback 觸發點（查證結果）

- `WizardRunner` 本身**沒有**對 retryable 失敗回滾：retryable 失敗走 `waitForRetryOrSkip()` 等待；`rollbackCompletedSteps()` 只在 (1) 迴圈頂端 `cancelRequested`、(2) 非 retryable 失敗 / 等待結果為 cancel 時執行。第 5 步 `retryable: true` ⇒ 回滾只可能來自 `runner.cancel()`。
- `cancel()` 只有兩個呼叫點：錯誤面板的「取消」按鈕，以及 `SetupWizardShell` runner effect 的 **cleanup**。使用者沒按取消、UI 也還在 ⇒ 是 effect 因 deps 變動重跑。
- **根因**：`useSetupWizardController()` 回傳 `steps: resolveWizardSteps(targetOS)`，**每次 render 都是新陣列**。`SetupWizardShell` 的 `useEffect(..., [ctx, steps])` 因此在 ProfilePanel（宿主）任何一次 re-render 時：cleanup → 舊 runner `cancel()`（若卡在 Failed，`cancel()` 會 resolve 等待 → 迴圈頂端看到 `cancelRequested` → `rollbackCompletedSteps()` → `install-server-bundle.rollback()` → `wsl.uninstallBundle()` = `rm -rf`），同時新 runner 從第 1 步重跑並覆寫 UI。多個 runner 交錯時，舊 runner 的 `rm -rf` 可能晚於新 runner 的安裝 ⇒ UI 顯示第 4 步 ✓ 但 bundle 已不在（與塔台觀察一致：`~/.local/` 空、mtime 為安裝時間）。
- **改法**：
  1. `useSetupWizardController` 以 `useMemo(() => resolveWizardSteps(targetOS), [targetOS])` 固定 `steps` 身分 ⇒ effect 只在真正 unmount（關閉精靈 = 取消）時 cleanup。
  2. `SetupWizardShell` effect 加 `disposed` 旗標：cleanup 後舊 runner 的 progress / 完成 / 錯誤不再寫入 UI（避免被回滾的 runner 狀態與新 runner 交錯顯示）。
  3. runner 回滾策略維持「retryable 失敗不回滾、取消才回滾」（已符合 D126 目標），補測試鎖住。
- 反證：暫時移除 `useMemo` 後 `wizard-rollback.test.tsx` 的「steps 身分穩定」測試即 FAIL，還原後 PASS。

### 實作內容

| 缺陷 | 檔案 | 改動 |
|------|------|------|
| A linger | `electron/wsl-systemd.ts` | 新增 `resolveDistroUser()`（`id -un`，過 `/^[a-zA-Z0-9._-]+$/`）；`enableLinger()`：已 `Linger=yes` 直接成功 → 否則 `loginctl enable-linger <user>` → 以 `loginctl show-user <user> -p Linger` 是否 `Linger=yes` 判定（不看 exit code / stderr）；username 不合白名單即失敗、不執行 loginctl |
| B `~` | `electron/wsl-detect.ts` | 新增 `resolveHome(distro)`：`wsl -d <distro> -- printenv HOME`（固定指令、無插值），須 `/` 開頭、符合 `/^\/[A-Za-z0-9._/-]*$/`、無 `..`，並過 `assertValidUnixPath(home, false)` |
| B `~` | `electron/main.ts` / `electron/preload.ts` / `src/types/electron.d.ts` | 新 IPC `wsl:resolve-home` → `window.electronAPI.wsl.resolveHome(distro)` |
| B `~` | `electron/wsl-systemd.ts` | `renderSystemdUnit()`：`ExecStart` 改 `assertValidUnixPath(..., false)`（拒 `~`），Environment 值以 `~` 開頭即拋錯；`writeUnit()` 的 `mkdir -p` 改為 unit path 所在目錄 |
| B `~` | `steps/wsl/install-server-bundle.ts` | 新增 `resolveWslHome(ctx, distro)`（快取於 `ctx.wslHome`）；**下載前**先解析，安裝到 `<home>/.local/bat-server`，`ctx.serverInstallPath` 存絕對路徑 |
| B `~` | `steps/wsl/write-systemd-unit.ts` | 新增 `buildWslServicePaths(home)`；unit path / `ExecStart` / `BAT_DATA_DIR` / `BAT_SERVER_DATA_DIR` / `startService.dataDir` 全為絕對路徑；install path 非絕對時明確報錯（不寫出 systemd 會拒絕的 unit）；rollback 的 unit path 同步 |
| B `~` | `wizard-runner.ts` | `WizardContext` 新增 `wslHome?: string` |
| B `~` | `steps/wsl/pick-wsl-distro.ts` | 選定 / 回滾發行版時清除 `ctx.wslHome`（避免沿用前一個發行版的 $HOME） |
| C rollback | `SetupWizardShell.tsx` ⚠️ | 見上節（`useMemo` + `disposed` 旗標） |
| BUG-086 | `electron/wsl-detect.ts` | `list()` 三態：`wsl -l -v` 成功 → 解析；失敗且非 `ENOENT` → 探 `wsl --status`，不行再 `wsl --version`（**只看 exit code**，15s timeout）→ 任一 exit 0 回 `{ distros: [], default: null }`；否則 rethrow 原錯誤（「沒裝 WSL」行為不變） |
| BUG-086 | `steps/wsl/pick-wsl-distro.ts` | 空清單拋 `code = 'wsl-no-distro'`，訊息改引導 `wsl --install -d Ubuntu-24.04` / `wsl --list --online` |
| BUG-086 | `steps/wsl/detect-env.ts` | 空清單時 log「WSL detected, but no distro is registered yet.」（不失敗；交第 2 步引導） |
| BUG-086 | `error-mapper.ts` | 新分類 `wsl-no-distro`（stage 1 errorCode + stage 2 regex `No WSL distros found`）；`lookupMessage()` 對不在 `MESSAGE_DICT` 但 i18n 有 `<key>.title` 的 messageKey 走 i18next（新分類用 `wizard.wsl.error.noDistro`）；既有分類仍走 zh-TW `MESSAGE_DICT`，行為不變。actions：`fixed-and-retry` / `cancel`（無 label → Shell 以 i18n 預設文字顯示） |
| BUG-086 | `src/locales/{en,zh-TW,zh-CN}.json` | 新增 `wizard.wsl.error.noDistro.{title,body}` |

其他：新的 `wsl.exe` 探測 / `id` / `printenv` / `loginctl` 呼叫皆 `execFile` + array args + 15s timeout；既有 `tar` / `mkdir` 等呼叫不加 timeout（避免大 bundle 解壓被截斷，維持原行為）。`%h` 未採用，依決策用絕對路徑。

### 驗收

| 證據線 | 結果 | 證據 |
|--------|------|------|
| unit（新增 40） | ✅ PASS | `electron/__tests__/wsl-detect.test.ts`（11：三態、ENOENT 不探測、`--version` 後備、`$HOME` 成功 / 尾斜線 / 非絕對 / 空值與 metachar / wsl 失敗 / 非法 distro）；`electron/__tests__/wsl-systemd.test.ts`（9：linger 帶使用者、`Linger=yes` 判定、已啟用直接成功、ENXIO 不信 exit code、白名單不合 → 失敗且不執行 loginctl、unit 絕對路徑不含 `~`、拒 `~` ExecStart / Environment）；`__tests__/wsl-service-paths.test.ts`（8）；`__tests__/wsl-no-distro.test.ts`（7：三語 i18n key、三態、新分類、zh-TW 文案、regex 後備）；`__tests__/wizard-rollback.test.tsx`（5：retryable 失敗不回滾 + 重試從失敗步驟續跑、取消才回滾、controller `steps` 身分穩定、宿主 re-render 不重啟 runner、unmount = 取消會回滾）。全部在 `vite.config.ts` `test.include` 範圍內 |
| 既有測試調整 | ✅ | `__tests__/write-systemd-unit.test.ts` mock 補 `wsl.resolveHome`（步驟現在解析 `$HOME`），斷言未改 |
| `npm run test:unit` | ✅ PASS | **55 files / 749 tests** 全綠（基線 709 + 40）；SSH / Docker 精靈測試全綠 |
| `npx vite build` | ✅ PASS | exit 0 |
| `npx tsc --noEmit` | ✅ PASS | **40** errors（= baseline 40）；本次改動檔案零新增（唯一相關命中為未改動的 `integration.transitions.test.ts` TS6133，既有） |
| 本機 runtime（`Ubuntu-24.04`） | ✅ PASS | esbuild 打包修改後 `electron/wsl-detect.ts` / `wsl-systemd.ts` 到 scratchpad，以 node 直接呼叫：① `loginctl disable-linger gower` → `show-user` 回 `not logged in or lingering`；② 舊行為重現：裸 `loginctl enable-linger` → `Could not enable linger: No such device or address`（本次 exit 1），`Linger=no`；③ `list()` → `Ubuntu-24.04 / Running / 2`；`isWslInstalled()` → `true`；`resolveHome()` → `/home/gower`；`resolveDistroUser()` → `gower`；`enableLinger()` → `{"ok":true}`，再呼叫（已啟用）→ `{"ok":true}`；`show-user` → `Linger=yes`；④ `writeUnit()` 寫出 `ExecStart="/home/gower/.local/bat-server/bin/bat-server"`、`Environment="BAT_DATA_DIR=/home/gower/.local/share/bat-server"`，`systemctl --user daemon-reload` 後 `status` → **`Loaded: loaded (/home/gower/.config/systemd/user/bat-server.service; disabled; preset: enabled)`**（修正前為 `bad-setting`）。bundle 不在，未 `start`（屬預期） |
| runtime 清理 | ✅ | 已刪 `/home/gower/.config/systemd/user/bat-server.service` + `daemon-reload`（`Unit bat-server.service could not be found.`）；linger 維持 `Linger=yes`（塔台原設定）；scratchpad 產物已刪；未動發行版本身 |
| BUG-086「無發行版 / 沒裝 WSL」實機 | ⚠️ 未實機驗證 | 本機已有 `Ubuntu-24.04` 且不得 unregister；兩種狀態以 mock unit test 覆蓋 |
| 精靈完整 9/9 | ⏳ 交使用者 | 需新 build 從頭跑 WSL 精靈 |

### 偏離 / 範圍說明

- ⚠️ **改動 `src/components/setup-wizard/SetupWizardShell.tsx`（不在 `affects_files`）**：缺陷 C 根因在同檔的 `useSetupWizardController`，`wizard-runner.ts` 本身已符合目標行為。`CT_INTERACTIVE=0` 無法詢問，判斷為 D126 第 3 點「查明並修正 rollback 觸發點」的必要範圍。此 hook 由 WSL / Docker / SSH 精靈共用，改動只讓 `steps` 身分穩定（各精靈步驟清單本來就只依 `targetOS` 決定），三種精靈既有測試全綠。
- `wsl-flow.ts`（不在 affects_files）的 `DEFAULT_INSTALL_PATH = '~/.local/bat-server'` 未改：只是 ctx 預設，第 4 步會覆寫成絕對路徑；若使用者略過第 4 步，第 5 步現在會明確報錯而非寫出壞 unit。

### 殘餘風險 / 後續建議

1. 🔴 **SSH 精靈有同類缺陷 B**（範圍外，未修）：`electron/remote/ssh-start-server.ts:154` `ExecStart=${safeInstallPath}/bin/bat-server`，而 `steps/ssh/configure-host.ts:4` 預設 install path 為 `~/.local/bat-server`；`:143` 註解宣稱靠 `%h`，實際寫出的是字面 `~`，systemd 會同樣 `bad-setting`。建議塔台開單（`ssh-start-server` 已有 `serverHome` 參數可組絕對路徑）。SSH 的 linger 已帶使用者名稱（`:346`），無缺陷 A。
2. `wsl-systemd.ts` 的 `DEFAULT_DATA_DIR` / `DEFAULT_UNIT_PATH` 仍是 `~` 預設，僅在呼叫端省略參數時使用，且只用於經 shell 展開的 `cat` / `tee` / `rm`，不會寫入 unit 內容；精靈呼叫端已全數傳絕對路徑。
3. `jumpToStep()` 仍不走中間步驟的 rollback（既有 T0309 限制，非本單範圍）。
4. BUG-072（`bat-server.service` timeout）很可能就是缺陷 B 的 `bad-setting`；新 build 的 9/9 驗收可一併確認。

### Commit

`git commit --only`：實際改動檔 + 5 個新測試檔 + 本工單檔（commit message 含 `T0378`，hash 以 `git log` 為準）。未 push。
