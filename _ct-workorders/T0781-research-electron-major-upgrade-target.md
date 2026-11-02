---
schema_version: 1
schema_kind: workorder
id: T0781
title: "研究：PLAN-053 Electron 主升級要升到哪一版（42–45），BAT 會受哪些破壞性變更影響，附 EXP 驗證計畫與工單草案"
type: research
status: DONE
repo: better-agent-terminal
project: maintenance
priority: P1
sizing: M
created_at: "2026-11-02T14:28:11+0800"
started_at: "2026-11-02T14:29:57+0800"
updated_at: "2026-11-02T14:43:42+0800"
completed_at: "2026-11-02T14:43:42+0800"
session_ids:
  - "72337671-6c19-49c6-ac60-d6672c2a73b9"
depends_on: []
related:
  - "PLAN-053（high）；D222；T0779（41.2.1 → 41.10.7，`a09887fb`：Chromium 146.0.7680.216 / Node 24.18.0 / ABI 145）；T0668（Electron 41 停更、BUG-164 Graphite CHECK 在 Chromium 147 起改為 GPU 程序重啟）；T0669（macOS `disable-skia-graphite`）"
  - "前例：`_archive/plans/PLAN-016-electron-runtime-upgrade-28-to-41.md`、`_archive/workorders/EXP-ELECTRON41-001-electron-runtime-upgrade-feasibility.md`（28 → 41 的做法與踩雷）"
  - "CLAUDE.md「Electron Runtime」「Build Toolchain」「electron-builder 26 migration notes」「本機開發：npm 12 install scripts」「Packaging / Release 前置檢查」「Terminal Server 存活判定與 recovery」節；`docs/agent-guide/build-toolchain.md`、`packaging-release-checks.md`、`logging.md`（`[gpu]`）"
affects_files:
  - _ct-workorders/T0781-research-electron-major-upgrade-target.md
  - _ct-workorders/PLAN-053-electron-42-upgrade.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: decision-requiring
memory_overrides:
  - "🔴 只研究：不改產品程式碼、不改 `package.json` / `package-lock.json`、不在 repo 內 `npm install`、不跑 `vite build` / `build:dir` / e2e（與 T0782 並行，T0782 會動 lock 與跑 build）。要實際試的東西（例：在 scratch 目錄 `npm install electron@<候選>` 看 `process.versions`、試裝原生模組 prebuilt）一律放 Worker scratchpad 或系統暫存目錄的 `ct-T0781/`，收尾刪除；不碰使用者的 BAT（`%APPDATA%\\BetterAgentTerminal`）。"
  - "🔴 要回答的問題：① 候選 42 / 43 / 44 / 45 各自的 Chromium、Node、V8、ABI（`NODE_MODULE_VERSION`）、支援期（依 Electron 官方支援政策，哪幾條線還在維護、45 之後多久停）；② 41 → 候選之間的破壞性變更（官方 breaking-changes 文件），逐項對照 BAT 程式碼是否用到（grep `electron/**`、`src/**`、`vite.config.ts`、electron-builder 設定；例：被移除或改名的 API、`webPreferences` 預設值、`session` / `protocol` / `webContents` 變更、`contextBridge`、`utilityProcess`、`BrowserView` 等），列出命中的檔案與行號；③ 相依套件的相容性：electron-builder 26.x 支援到哪一版、`vite-plugin-electron` / `vite-plugin-electron-renderer`、`@lydell/node-pty`、`@kutalia/whisper-node-addon`（是 N-API 還是綁 ABI；有沒有新 ABI 的 prebuilt）、Playwright 的 `_electron`、內嵌 claude CLI / codex 無關但列出確認；④ Node 主版本變動對主行程與 helper 的影響（例：Node 24 → 更新版的行為變更）；⑤ BUG-164：候選版是否已含 Chromium 147+ 的 Graphite 修正、升級後 macOS 的 `disable-skia-graphite`（T0669，`decideSkiaGraphite`）建議保留或移除、GPU 程序 graceful restart 是否計入 crash limit（PLAN-053 待決 3）；⑥ 三平台打包 / 簽章 / 公證、macOS arm64 only（D136）有無影響。"
  - "🔴 來源：只用官方來源（electronjs.org releases / breaking-changes / 支援政策、各套件 GitHub release notes 與 issues、npm 的 `npm view <pkg> versions` / `engines` / `peerDependencies`），每個結論附連結與查核日；查不到的寫「未確認」，不得寫成肯定句。"
  - "🔴 產出（寫在回報區）：候選比較表（版本、Chromium / Node / ABI、支援期、破壞性變更命中數、相依阻擋項）；推薦目標版本與理由（含「一次跳到 X」vs「分段 42 → 44」的取捨）；BAT 會受影響的清單（檔案:行號、要怎麼改、規模）；EXP 驗證計畫（比照 PLAN-016 / EXP-ELECTRON41-001：分支命名、驗證關卡、三平台怎麼驗，含 `macos-acceptance.yml`）；實作 / EXP 工單草案（affects_files、必守規則、驗收）。PLAN-053 文末補〈T0781 結論摘要〉（只摘要、指向本單），狀態維持 IDEA。"
  - "🔴 yolo：不得問使用者；判讀問題依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。Git：只用 `git commit --only` commit 本單與 PLAN-053；同一 checkout 有 T0782 並行，不得碰它的檔案。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。不 push、不發版。公開 repo 去識別化（D176）。"
---

# T0781 — 研究：Electron 主升級的目標版本

## 元資料

- **工單編號**：T0781
- **類型**：research
- **互動模式**：yolo（問題問塔台）
- **優先級**：P1
- **建立時間**：2026-11-02T14:28:11+0800
- **預估規模**：M

## 研究目標

PLAN-053 已調為 high。T0779 先在 41 線內升到最後一版 41.10.7，但 41 線已停止更新，BAT 需要升到仍在維護的大版本。T0668（2026-10-19）查證時維護中的是 42 / 43 / 44，現在 npm `latest` 已是 45.2.1。本單要決定升到哪一版、BAT 要改哪些地方、怎麼驗，產出可以直接開 EXP / 實作工單的計畫。

## 已知資訊

- 目前：Electron 41.10.7、Chromium 146.0.7680.216、Node 24.18.0、ABI 145（T0779）。
- 原生模組：`@lydell/node-pty`、`@kutalia/whisper-node-addon` 直接用上游 prebuilt，目前不需要針對 Electron 重建（CLAUDE.md「Electron Runtime」）。
- BUG-164：Chromium 146 遇 Graphite `kOutOfOrderRecording` 直接 CHECK 崩潰；Chromium 147 起改成 GPU 程序重啟；macOS 目前預設 `--disable-skia-graphite`（T0669）。
- 前例：PLAN-016 以 EXP-ELECTRON41-001 驗證後才升 28 → 41。

## 調查範圍

見 frontmatter `memory_overrides` 的問題 ①–⑥。

## 互動規則

- yolo：不問使用者；判讀問題問塔台（每輪最多 3 題）。

---

## 回報區

> 以下由 sub-session 填寫

### 完成狀態

- **狀態**：DONE（研究單；六個問題都有結論，查不到的標「未確認」）
- **一句話結論**：建議**一次升到 Electron 45**（45.2.x，Chromium 156 / Node 24.22.1 / ABI 150，官方暫定支援到 2027-04-27）。42 已在 2026-10-20 停止支援，不列入；分段 43 → 45 沒有省到工。BAT 需要改的只有一件中型工作：**Electron 44 改寫了 main 行程的 `clipboard` 模組**，`readImage` / `writeImage` 已移除，`read(format)` 改成回傳 Promise（45.2.1 實測），影響圖片貼上、複製圖片、macOS Finder 檔案貼上。原生模組（`@lydell/node-pty`、`@kutalia/whisper-node-addon`）都是 N-API，已在 45.2.1 實際載入成功。
- **落點檢查**：PASS。C-0 `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`；C-1 工單在 REPO_ROOT 下；C-3 `affects_files` 兩個檔都在（僅 `_ct-workorders/`，不適用）；C-2 無 `branch` 欄位。`CT_HOME` 未設定（非 worktree）。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）。
- **環境**：`CT_MODE=yolo`；BAT 變數 `BAT_HELPER_DIR` / `BAT_REMOTE_PORT` / `BAT_REMOTE_TOKEN`（已設定）/ `BAT_TOWER_TERMINAL_ID` 等齊全。
- **範圍遵守**：沒改產品程式碼、`package.json`、`package-lock.json`；沒在 repo 內 `npm install` / build / e2e。實測只在 Worker scratchpad 的 `ct-T0781/`（收尾已刪除）；沒碰 `%APPDATA%\BetterAgentTerminal`。只讀了 repo 內既有的 `node_modules` 與 `dist-electron/preload.js`。
- **commit**：本單與 PLAN-053 以 `git commit --only` 提交（hash 見塔台 `git log`；本單是研究單，沒有產品 commit）。
- **session_id**：72337671-6c19-49c6-ac60-d6672c2a73b9

### 互動紀錄

- 無（yolo；沒有需要塔台裁示的判讀問題，未發 `提問`）。

### 調查結論

查核日一律 **2026-11-02**。來源標記：【官方】官方文件 / npm / 套件 release notes；【原始碼】Chromium 或套件原始碼；【實測】在 scratchpad 實際執行；【推論】由前兩者推得、未實測。

#### ① 候選版本比較

| 版本線 | 最新版（日期） | Chromium | Node | V8 | ABI | 支援期（EOL） | BAT 命中的破壞性變更 | 相依阻擋項 |
|---|---|---|---|---|---|---|---|---|
| 41（現況） | 41.10.7（2026-08-24） | 146.0.7680.216 | 24.18.0 | 14.6 | 145 | 已停止支援（2026-08-24） | — | — |
| 42 | 42.11.18（2026-10-21） | 148.0.7778.280 | 24.19.0 | 14.8 | 146 | **2026-10-20 已停止支援** | 2（輕） | 無 |
| 43 | 43.8.6（2026-10-30） | 150.0.7871.250 | 24.22.1 | 15.0 | 148 | 2027-01-05†（剩約 2 個月） | 42 的 2 項 + 43 的 0 項 | 無 |
| 44 | 44.10.1（2026-10-30） | 152.0.7977.169 | 24.22.1 | 15.2 | 149 | 2027-03-02†（剩約 4 個月） | 上列 + **clipboard（中）**、macOS 13 起、Linux badge | 無 |
| **45** | **45.2.1（2026-10-30）** | **156.0.8078.75** | **24.22.1** | 15.6 | **150** | **2027-04-27†（剩約 6 個月）** | 上列 + safeStorage 同步 API 棄用（46 移除） | 無（electron-builder 未明載支援範圍，見 ③） |
| 46 | 46.0.0-alpha.4 | 158 | 24.22.1 | — | — | stable 預定 2027-01-05† | — | 預覽版，不列入 |

† 官方標示為暫定日期。

- 【官方】官方支援政策是「最新 3 個 stable 主版本」，8 週一個主版本（[electron-timelines.md](https://github.com/electron/electron/blob/main/docs/tutorial/electron-timelines.md)）。現在維護中的是 **43 / 44 / 45**。日期以 [releases.electronjs.org/schedule](https://releases.electronjs.org/schedule) 為準。
- 【官方】各版本的 Chromium / Node / V8 / `modules`（ABI）取自官方 [releases.json](https://releases.electronjs.org/releases.json)；npm `dist-tags`：`latest` = 45.2.1、`42-x-y` = 42.11.18、`43-x-y` = 43.8.6、`44-x-y` = 44.10.1（`npm view electron dist-tags`）。
- 【實測】scratchpad 裝 `electron@45.2.1`，`process.versions` = electron 45.2.1、chrome 156.0.8078.75、node 24.22.1、modules 150、napi 10，與 releases.json 一致。
- 45 之後：46 預定 2027-01-05 stable，屆時 43 停止支援；45 會在 2027-04-27（48 stable 時）停止支援。⇒ 升到 45 後，大約半年內還要再升一次（Electron 的節奏本來就是如此）。

#### ② 破壞性變更 × BAT 程式碼（41 → 45）

來源：【官方】[breaking-changes.md](https://github.com/electron/electron/blob/main/docs/breaking-changes.md)（42.0–45.0 各節）。grep 範圍：`electron/**`、`src/**`、`vite.config.ts`、`scripts/**`、`e2e/**`、`package.json`、`.github/workflows/**`（排除測試檔另列）。

| 版 | 變更 | BAT 命中（檔案:行） | 影響與要怎麼改 | 規模 |
|---|---|---|---|---|
| 42 | `electron` 套件**不再在 postinstall 下載 binary**，改成第一次 `require('electron')` / 執行 bin 時下載；`ELECTRON_SKIP_BINARY_DOWNLOAD` 失效；新增 `install-electron` bin | `package.json` `allowScripts.electron`；`.github/workflows/tests.yml:25-31`（`npm ci --ignore-scripts` 後 `node node_modules/electron/install.js`）；`pre-release.yml` / `release.yml` 桌面 build 的 `npm ci` | 【實測】45.2.1 的 `index.js` 在找不到 `path.txt` 時同步執行 `install.js` 下載，下載時以 `console.log` 印出 `Downloading Electron binary...`（**會混進用 stdout 取路徑的指令輸出**，第一次 `node -e "process.stdout.write(require('electron'))"` 就拿到兩行）。`install.js` 在 45 仍存在，`tests.yml` 的作法照常可用（【推論】，由 `index.js` 原始碼得知它以無參數呼叫同一支 `install.js`）。`allowScripts.electron` 變成無作用，可保留或移除（政策項，需塔台決定）。electron-builder 用自己的 `@electron/get` 下載打包用的 zip，不依賴 postinstall（【推論】，release notes #8827 已改用 `@electron/get`）。Playwright `workers: 1`（`playwright.config.ts:11`），沒有平行下載互相破壞的問題（他案回報見 [terminator #321](https://github.com/andytavares/terminator/pull/321)）。 | S（改 workflow 註解、可選擇在 CI 加明確的 `npx install-electron --no` 步驟） |
| 42 | macOS 通知改用 `UNNotification`，**app 沒簽章就不顯示**，`Notification` 發 `failed` 事件 | `electron/claude-agent-manager.ts:456`（`new NotificationApi(...)`，沒有接 `failed`） | 正式版有簽章 + 公證（`package.json` `mac.identity` / `notarize: true` / `hardenedRuntime: true`），不受影響。未簽章的本機 dev / `build:dir` 在 macOS 上通知不會出現。建議加一行 `failed` 事件的 logger（S）。macOS 通知權限第一次會跳系統詢問（【推論】UNNotification 的行為，未實測）。 | S |
| 42 | `clearStorageData` 的 `quotas`、OSR 預設 scale factor、`createFromNamedImage` 陣列參數 | 無 | — | — |
| 43 | `dialog.showOpenDialog` / `showSaveDialog` 沒給 `defaultPath` 時改成 Downloads | `electron/main.ts:2882/2891/2901/2913` 都有給 `defaultPath`；`main.ts:3380`（`downloads`）；`main.ts:3389` 給的是只有檔名的 `${tarballFilename}.sha256` | 前五處不受影響。`3389` 只有檔名、沒有目錄，起始目錄會怎麼決定**未確認**（文件只講沒給 `defaultPath` 的情況），EXP 驗「匯入本機 tarball」流程時順便看。 | 0–S |
| 43 | Linux 無邊框視窗圓角、WCO 版面、`NativeImage.toBitmap()` 色彩空間、`showHiddenFiles` Linux 移除、`chrome.scripting` | 無（視窗都是 `frame: true`，`main.ts:1259` / `3866`） | — | — |
| **44** | **`clipboard` 模組改寫成 W3C 形式**：`readImage` / `writeImage` / `readHTML` / `readBuffer` / `availableFormats` 等移除，`read` / `write` / `readText` / `writeText` / `has` 改回傳 Promise，`read()` 回 `ClipboardItem[]` | `electron/main.ts:2997`（`clipboard:saveImage` 的 `readImage()`）、`:3007`（`clipboard:read-image-data-url`）、`:3009` → `electron/clipboard-file-paths.ts:24-25`（介面 `read(format): string`）、`:70`（`read('NSFilenamesPboardType')`）、`:72`（`read('public.file-url')`）、`main.ts:3013`（`clipboard:writeImage` 的 `writeImage()`）；`electron/image-attachments.ts:41-55`（吃 `NativeImage`）；測試：`electron/__tests__/clipboard-file-paths.test.ts`、`e2e/t0524-terminal-image-paste.spec.ts:34/35/41/46/56/57/64/65/91`（`readImage` / `readHTML` / `writeImage`）、`e2e/macos/t0778-macos-paste-acceptance.spec.ts:222-224/420`、`e2e/t0571-shift-right-click-copy.spec.ts:105/107/245/273`（`readText` / `writeText`） | 【實測】45.2.1 main 行程：`readImage` / `writeImage` / `readHTML` / `readBuffer` / `availableFormats` 為 `undefined`，`readText()` / `read()` 回 Promise，`read()` 回 `[["text/plain","electron application/osclipboard;format=\"DataObject\"",…]]`，`ClipboardItem` 存在。⇒ 不改的話：**Claude / Codex 面板貼圖、終端貼圖（PromptBox）、複製圖片都會丟 TypeError**；macOS Finder 檔案貼上（T0522 / BUG-128）會拿到 Promise 而解析失敗。改法：三個 handler 改 `async`，圖片用 `clipboard.read()` 找 `image/png` → `Blob` → `nativeImage.createFromBuffer`（或直接拿 PNG bytes 給 `clipboardImageToDataUrl`），寫入用 `clipboard.write([new ClipboardItem({ 'image/png': new Blob([png]) })])`；Finder 路徑改讀 `electron application/osclipboard;format="NSFilenamesPboardType"`（或官方對照表說的 `text/uri-list`，它在 macOS 對應 `NSFilenamesPboardType`）。IPC channel 名稱與 renderer 端不變（renderer 本來就經 IPC，preload 沒有用 `clipboard`）。t0524 / t0778 的 `app.evaluate` 要改寫；t0571 的 `readText` / `writeText` 回 Promise，`app.evaluate` 會等 Promise，【推論】不必改，EXP 實跑確認。renderer 的 `navigator.clipboard.writeText`（約 20 處）不受影響。 | **M**（3 個 handler + 1 個模組 + 3 支 e2e + 單元測試；macOS 的 Finder 貼上只能在 Mac 實機或 `macos-acceptance.yml` 驗） |
| 44 | 不再支援 macOS 12 | `README.md:376`（「要求 macOS 12 (Monterey) 以上」） | 改成 macOS 13 (Ventura) 以上；release note 要寫。D136 arm64 only 不變。 | S（文件） |
| 44 | Linux Unity 支援移除：`app.setBadgeCount` 改為只在 macOS 有作用 | `electron/main.ts:3642`（Linux 分支呼叫 `app.setBadgeCount(count)`） | Linux 的 dock 數字徽章失效（不會丟錯，【推論】）。可保留呼叫或移除 Linux 分支。 | S |
| 44 | ANGLE 靜態連結（不再附 `libEGL` / `libGLESv2`）、移除 ia32 / armv7l、`net.request` frame destination、`select-client-certificate` 的 `webContents` 可能為 `null`、移除 macOS 12 以下 login item 欄位 | 無（`scripts/verify-packaged-native.js` 沒檢查 `libEGL` 等檔；Windows 只打 x64，`pre-release.yml:234` `--arch x64`；沒有用 `net.request` / login item） | ANGLE 改成每個程序都載入，官方提醒「少見設定可能出現回歸」，屬 GPU 面，EXP 三平台冒煙時一起看。 | — |
| 45 | sandbox preload 拿不到 `events` / `timers` / `url` shim 與 `Buffer` / `setImmediate` | 無：主視窗與 detached 視窗沒有 `sandbox: false`（`main.ts:1254-1258` / `3865`，預設 sandbox），但 preload bundle 只 `require("electron")`、沒有 `Buffer` / `setImmediate`（讀既有 `dist-electron/preload.js` 與 `electron/preload.ts` import 清單） | 不需改。EXP 時用新 build 的 preload 再 grep 一次。 | — |
| 45 | `safeStorage.isEncryptionAvailable` / `encryptString` / `decryptString` **棄用，46 移除** | `electron/remote/secrets.ts:54/64/74`（`SecretStrategy` 介面是同步的）；`e2e/pre5-acceptance.spec.ts:340` | 45 只會出棄用警告、功能照常。**升 46 前必須改成 `isAsyncEncryptionAvailable` / `encryptStringAsync` / `decryptStringAsync`**；同步介面要一路改成 async（`server-token.json` 讀寫的呼叫端），既有密文官方保證可用 `decryptStringAsync` 解。 | M（建議另開單，在 46 之前做） |
| 45 | `window.open()` 子視窗 sandbox、`display-capture` 權限、`getUserMedia` desktop source、`contentTracing`、ASAR 內檔案的 fd、`requestStorageAccessFor` | 無：`electron/navigation-guard.ts:90` 一律 `deny`；`electron/voice-handler.ts:155` 全部 `callback(true)`；BAT 的 `fs.open` 都在 asar 外（`server-bundle-distributor.ts:156`、`server-bundle-download.ts:371`）；`dist-electron/terminal-server.js` 本來就 `asarUnpack` | 不需改。打包版的 Terminal Server `fork` 路徑在 EXP 冒煙時確認。 | — |

- 命中數（需要改的）：42 = 2、43 = 0（1 項待確認）、44 = 3（其中 clipboard 為 M）、45 = 1（棄用，46 才必改）。
- `npm run typecheck:electron` 會在 `main.ts` 的 clipboard 呼叫上報型別錯誤（【推論】，`electron.d.ts` 已改），可當作改完的檢查點。

#### ③ 相依套件相容性

| 套件 | BAT 現況 | 結論 | 證據 |
|---|---|---|---|
| `@lydell/node-pty` | 1.1.0（prebuilt，`node-pty-win32-x64` 等平台子套件） | ✅ **N-API，不綁 ABI** | 【原始碼】`conpty.node` / `conpty_console_list.node` 匯出 `napi_register_module_v1`、沒有 `node_register_module_v<N>`；【實測】在 Electron 45.2.1（ABI 150）main 行程載入並 `spawn('cmd.exe', ['/c','echo','pty-ok'])`，exit 0、收到輸出（Windows x64）。macOS / Linux 子套件未實測。最新 1.2.0-beta.18，不需跟升。 |
| `@kutalia/whisper-node-addon` | 1.1.0（`dist/<platform>/whisper.node`） | ✅ **N-API（node-addon-api），不綁 ABI** | 【原始碼】win32-x64 / linux-x64 / mac-arm64 的 `whisper.node` 都匯出 `napi_register_module_v1`；【實測】45.2.1 main 行程 `require` 成功（只載入、沒有實際轉寫）。npm 最新仍是 1.1.0（2025-07-18）。`node-abi` 依賴在 `dist/js` 沒有使用。 |
| electron-builder | 26.8.1（最新 26.18.1） | ⚠️ **未確認**：release notes 沒有寫支援到哪個 Electron 版本，也沒看到 42+ 專屬的問題 | 【官方】[electron-builder releases](https://github.com/electron-userland/electron-builder/releases) 26.9–26.18.1 掃過：下載已改用 `@electron/get`（#8827）、`@electron/rebuild` 升 4.2.1（#10315）、macOS 保留 license 檔（#10177）等，沒有 Electron 版本上限。建議 EXP 先維持 26.8.1（一次只換一個變數），打包失敗才升 26.18.x。 |
| `vite-plugin-electron` / `-renderer` | 0.29.1 / 0.14.6（最新 1.2.0 / 1.0.0） | ⚠️ 未確認，【推論】低風險 | 它以 `require('electron')` 取路徑啟動 Electron（lazy 下載可用，見 ②），`peerDependencies` 只要求 `vite >=6`。CLAUDE.md「Build Toolchain」原本說等 `vite-plugin-electron@1.0.0` GA 再升 vite 8，現在 1.2.0 已出，這是另一件事，不併入本次升級。 |
| Playwright `_electron` | `@playwright/test` 1.59.1（最新 1.64.1） | ⚠️ 未確認，有一個相關回歸 | 沒有 45 的官方相容性說明。[microsoft/playwright#43247](https://github.com/microsoft/playwright/issues/43247)：Playwright **1.64.0** + Electron 44.5.1 打包版偶爾抓不到第一個視窗（1.63.0 正常，issue 未關）。⇒ **升 Electron 時不要同時升 Playwright**，維持 1.59.1。 |
| `@electron/rebuild` | CI `npx --yes @electron/rebuild`（lock 內 4.0.3） | ✅ 現在是 no-op（沒有需要重建的模組），新 ABI 不影響 | CLAUDE.md「Electron Runtime」T0492 的結論不變。 |
| 內嵌 claude CLI / Agent SDK、codex | 與 Electron 無關 | ✅ 確認無關：它們是獨立的原生執行檔 / Node 程序，不載入 Electron ABI | 只要確認打包後仍能啟動（`verify-packaged-native.js` 既有檢查）。 |
| `electron` 安裝本身 | — | ✅ | [electron#51619](https://github.com/electron/electron/issues/51619)：Node 24.16+ / 26.1+ 下 `extract-zip` 只解出第一個檔（已關閉，改用 `@electron-internal/extract-zip`）。43.8.6 / 44.10.1 / 45.2.1 都已依賴 `@electron-internal/extract-zip`（`npm view`），本機 Node 26.13.0 實測 45.2.1 下載解壓正常。42.0.0 仍是舊 `extract-zip`，又一個不選 42 的理由。 |

#### ④ Node 版本變動

- 【官方】42–45 全部仍是 **Node 24**（24.15.0 → 24.22.1），主版本不變。Node 25 / 26 沒有進入任何候選版（46 alpha 也是 24.22.1）。
- 影響：主行程與 Terminal Server（`fork` 用 Electron 內建 Node）是 24.18.0 → 24.22.1 的 minor / patch 升級，【推論】風險低；CLAUDE.md 的 Node 25+ `localStorage` 問題（T0712）、`--no-webstorage` 限制都不受影響。
- helper（`bat-*.mjs`）由使用者系統的 node 或遠端的 `BAT_HELPER_NODE` 執行，與 Electron 版本無關；server bundle 自帶的 node 是另一條線，不在本次範圍。
- 未逐條核對 Node 24.19–24.22 的 changelog（未確認），EXP 的 `test:unit` / `test:legacy` 可當回歸網。

#### ⑤ BUG-164 / Graphite

- 【原始碼】`gpu/command_buffer/service/graphite_shared_context.cc` 在 Chromium **150.0.7871.250（43）/ 152.0.7977.169（44）/ 156.0.8078.75（45）**：`kOutOfOrderRecording` → `delegate_->MarkContextLost(error::kOutOfMemory)`，不再 CHECK（148 已由 T0668 查證）。⇒ 候選版都含修正，BUG-164 那個 CHECK 崩潰不會再發生。
- 但 **`kAsyncShaderCompilesFailed` 在 156 仍是 `CHECK(simulating_insert_failure)`**（同檔 375–387 行），Graphite 還有另一條會崩潰的路。
- **graceful restart 是否計入 crash limit（PLAN-053 待決 3）：會。**【原始碼】156 的 `components/viz/service/gl/exit_code.cc`：`RestartGpuProcessForContextLoss` 以 exit code **34**（`RESULT_CODE_GPU_EXIT_ON_CONTEXT_LOST`）結束 GPU 程序；`content/browser/browser_child_process_host_impl.cc` 對 `TERMINATION_STATUS_ABNORMAL_TERMINATION` 呼叫 `OnProcessCrashed`；`content/browser/gpu/gpu_process_host.cc` `OnProcessCrashed` → `RecordProcessCrash` → `IncrementCrashCount`，全檔沒有針對 exit code 34 的例外（148 / 156 都是）。`kForgiveGpuCrashMinutes = 5`、`GetFallbackCrashLimit()` 非 Android / ChromeOS = 3 ⇒ **5 分鐘內 3 次 context-lost 重啟一樣會退回軟體繪圖**。「非零 exit code 在 macOS 判為 `ABNORMAL_TERMINATION`」是 `base::GetTerminationStatus` 的一般行為，本單沒有抓那個檔（【推論】，未實測）。
- 建議：**升級時保留 macOS 的 `disable-skia-graphite`（`decideSkiaGraphite`，T0669）**。理由：觸發原因沒變、重啟仍計入 3 次上限、還有 `kAsyncShaderCompilesFailed` 這條 CHECK；把「換 Electron」和「打開 Graphite」綁在一起，出問題時分不出是哪一個。升級穩定後若要拿掉，另開一張單，先用 `BAT_SKIA_GRAPHITE=1` 請 Mac 使用者試用並看 `[gpu]` 日誌與 `child-process-gone` 次數。`--disable-skia-graphite` 在 156 是否仍有效：**未確認**（未在 Mac 實測），EXP 在 `macos-acceptance.yml` 看 `[gpu]` 日誌的 `skia_graphite` 狀態。

#### ⑥ 三平台打包 / 簽章 / 公證

- macOS：44 起最低 macOS 13（README 要改）；42 起通知需要簽章（正式版已簽，見 ②）；arm64 only（D136）、`mac.notarize: true`、`hardenedRuntime` 都不受影響（官方 breaking changes 沒有簽章 / 公證相關項目）。CI runner `macos-15`（`pre-release.yml:101`、`macos-acceptance.yml:23`）> macOS 13，可以跑。
- Windows：44 移除 ia32，BAT 只打 x64，不受影響。NSIS 完整重裝驗收照舊（CLAUDE.md「Packaging / Release 前置檢查」）。
- Linux：AppImage x64、build runner `ubuntu-22.04` / `ubuntu-22.04-arm`（server bundle）。Electron 45 對 glibc / Ubuntu 22.04 的最低需求**未確認**（breaking changes 沒有列；EXP 由 CI 的 linux build 與 AppImage 冒煙確認）。Unity badge 見 ②。
- 打包檢查腳本：`verify-native-modules.js`、`verify-packaged-native.js` 沒有引用會被 44 拿掉的 `libEGL` / `libGLESv2` / ia32 檔（grep 確認），【推論】不必改；`verify-packaged-native.js` 會比對打包產物的 Electron 版本，EXP 需確認它讀的是新版號。

### 建議方向

**推薦：一次升到 Electron 45（`^45.2.1`，以 EXP 開工當時 45 線的最新 patch 為準）。**

| 方案 | 優點 | 缺點 | 判斷 |
|---|---|---|---|
| **A. 一次跳到 45** | 支援期最長（到 2027-04-27†）；44 的 clipboard 改寫不論選 44 或 45 都要做，45 只多一項棄用、BAT 對 45 的移除項 0 命中；原生模組已實測可載入；Node 主版本不變 | 45 是最新主版本（stable 2026-10-20，目前只有 2 個 patch），早期 patch 的回歸風險較高 | **推薦** |
| B. 升到 44 | 已有 10 個 patch，較成熟 | 只多支援到 2027-03-02，比 45 少約 2 個月，工作量和 A 幾乎相同（clipboard 都要改） | 備案：EXP 在 45 遇到 Electron 本身的回歸、短期修不了時退到 44.x |
| C. 分段 42 → 44（或 43 → 45） | 每段破壞性變更少 | 42 已停止支援；43 只剩約 2 個月；三平台驗收（含 `macos-acceptance.yml` 與 NSIS 重裝）要做兩次，總工作量約為 A 的兩倍；中間版本很快又停更 | 不建議 |

理由補充：PLAN-016 從 28 一次跳到 41（13 個主版本）就是用 EXP 一次完成；這次只跨 4 個主版本，命中的 API 集中在 clipboard 一處，分段沒有降低風險的效果。

**BAT 會受影響的清單（實作工作）**

| # | 項目 | 位置 | 改法 | 規模 |
|---|---|---|---|---|
| 1 | 升 electron | `package.json` `electron` → `^45.2.x`；`package-lock.json` | `npm install electron@45`（只動 electron 與它的相依） | S |
| 2 | main 行程 clipboard 改寫 | `electron/main.ts:2996-3015`、`electron/clipboard-file-paths.ts`（介面與 `:70`/`:72`）、`electron/image-attachments.ts`（輸入型別） | handler 改 async、用 `clipboard.read()` / `write()` + `ClipboardItem`；IPC channel 與 renderer 不變 | M |
| 3 | 相關測試 | `electron/__tests__/clipboard-file-paths.test.ts`、`e2e/t0524-terminal-image-paste.spec.ts`、`e2e/macos/t0778-macos-paste-acceptance.spec.ts`（`t0571` 實跑確認） | 改用新 API | S–M |
| 4 | macOS 通知失敗記錄 | `electron/claude-agent-manager.ts:456` | 接 `failed` 事件寫 logger | S |
| 5 | Linux badge | `electron/main.ts:3642` | 移除 Linux 分支或保留（no-op） | S |
| 6 | 文件 | `README.md:376`（macOS 13）、CLAUDE.md「Electron Runtime」節（版號 / ABI 150 / Chromium 156）、`docs/agent-guide/build-toolchain.md`、`.github/workflows/tests.yml:25-31` 的註解（electron 已沒有 postinstall） | 更新 | S |
| 7 | （另單，46 前）safeStorage async | `electron/remote/secrets.ts`、呼叫端、`e2e/pre5-acceptance.spec.ts:340` | 改 async API | M |
| 8 | 不改 | `decideSkiaGraphite`（macOS 停用 Graphite 保留）、`@lydell/node-pty`、`@kutalia/whisper-node-addon`、electron-builder 26.8.1、Playwright 1.59.1、vite-plugin-electron 0.29.1 | 一次只換 Electron | — |

### 建議下一步

#### EXP 驗證計畫（比照 PLAN-016 / EXP-ELECTRON41-001）

- **工單**：`EXP-ELECTRON45-001`（`_local-rules.md`「工單前綴規範」；TOPIC 11 字元以內）。
- **分支 / worktree**：`exp/electron45`，`git worktree add ../better-agent-terminal-electron45 -b exp/electron45`（使用者執行，比照 EXP-ELECTRON41-001 Step 0）。BAT 的 `--isolation worktree` 只接受 `T####`（分支 `ct/<T####>`），EXP 前綴要手動建 worktree；若塔台偏好用 BAT 隔離派工，改開 `T####` 工單即可（分支變 `ct/T####`）。
- **關卡（依序，任一失敗即停並回報）**：
  1. `npm install electron@45`（worktree 內）；第一次 `npx electron --version` 觸發下載；記錄 `process.versions`。
  2. `node scripts/verify-native-modules.js`；Electron 內載入 node-pty spawn 與 whisper `require`（可沿用本單 scratch 腳本的作法）。
  3. `npm run typecheck` = 0、`npm run typecheck:electron` = 0（clipboard 改完前預期有錯，記錄錯誤數當基線）。
  4. clipboard 改寫（清單 #2–#3）＋ #4 / #5。
  5. `npm run test:unit`、`npm run test:legacy` 全綠。
  6. `npx vite build`、`npm run build:dir` ＋ `node scripts/verify-packaged-native.js --platform win --out release --arch x64`；確認打包產物 Electron = 45.x、`dist-electron/preload.js` 仍只 `require("electron")`。
  7. Windows e2e：T0779 那 5 支（t0572 / t0776 / t0735 / t0744 / t0762）＋ clipboard 相關的 t0524 / t0571 ＋ t0742（面板附件）＋ pre5-acceptance（safeStorage 棄用警告不影響）。
  8. 手動冒煙（Windows）：開多分頁、Terminal Server recovery、Claude / Codex 面板貼圖、PromptBox 貼圖、複製圖片、語音輸入、匯入本機 tarball 對話框起始目錄（② 43 的待確認項）、通知。
  9. **三平台**：以 `exp/electron45` 跑 CI 桌面 build（`pre-release.yml` 是 `workflow_dispatch`，可用 `--ref exp/electron45`，但它會建 tag 與 GitHub prerelease，**屬對外動作，需使用者同意**；或另寫只 build 不發布的 dispatch，需塔台決定）。macOS：`macos-acceptance.yml`（含 t0778 Finder 檔案 / 圖片貼上、`[gpu]` 日誌確認 Graphite 仍停用、通知在簽章版會顯示）；Linux：AppImage 啟動冒煙 + Ubuntu 22.04 相容性。
  10. NSIS 完整重裝驗收（release 前）。
- **結論格式**：CONCLUDED（PR 回主線）/ ABANDONED（丟棄 worktree）；若 45 本身有回歸，記錄後改試 44.x（方案 B）。

#### 工單草案

**草案 1：EXP-ELECTRON45-001 — Electron 41.10.7 → 45 升級試做**

- `affects_files`：`package.json`、`package-lock.json`、`electron/main.ts`、`electron/clipboard-file-paths.ts`、`electron/image-attachments.ts`、`electron/claude-agent-manager.ts`、`electron/__tests__/clipboard-file-paths.test.ts`、`e2e/t0524-terminal-image-paste.spec.ts`、`e2e/macos/t0778-macos-paste-acceptance.spec.ts`、`e2e/t0571-shift-right-click-copy.spec.ts`（如需）、`README.md`、`CLAUDE.md`（「Electron Runtime」節）、`docs/agent-guide/build-toolchain.md`、`.github/workflows/tests.yml`（只改註解 / 可選的 `install-electron` 步驟）、工單本身。
- 必守規則：只在 `exp/electron45`；一次只換 Electron（electron-builder、Playwright、vite-plugin-electron、原生模組不動）；macOS `disable-skia-graphite` 保留；clipboard 的 IPC channel 名稱、renderer API、T0436 / BUG-108「圖片在 client 端讀」與 T0522 的行為不變；`npm rebuild` 禁用（CLAUDE.md「Electron Runtime」）；`allowScripts` 若要移除 `electron` 需塔台決定；不 push、不發版（三平台 CI 另經塔台 / 使用者同意）。
- 驗收：上面關卡 1–8 全過（Windows）；三平台結果另列；回報區附 `process.versions`、typecheck 前後錯誤數、e2e 清單與結果。

**草案 2：T#### — safeStorage 改用 async API（Electron 46 前）**

- `affects_files`：`electron/remote/secrets.ts`、呼叫端（`server-token.json` 讀寫）、對應單元測試、`e2e/pre5-acceptance.spec.ts`。
- 必守規則：既有密文不重新產生（官方：`encryptString` 的密文可用 `decryptStringAsync` 解）；Linux 無 keychain 時的 fallback 行為（`warnFallbackOnce`）不變；token 不寫日誌。
- 驗收：`typecheck:electron` = 0、單元測試、pre5-acceptance（舊 token 仍能解）。時程：45 升級完成後、Electron 46 stable（2027-01-05†）之前。

**塔台待決（請在開 EXP 前決定）**

1. 三平台 CI 怎麼跑：用 `pre-release.yml --ref exp/electron45` 發一個預覽版（對外）還是先加一個只 build 不發布的 workflow。
2. `allowScripts.electron` 在 42+ 已無作用：保留或移除（CLAUDE.md 寫明 `allowScripts` 是政策）。
3. 是否把 safeStorage async 併入 EXP（多一個變數）或照草案 2 分開（建議分開）。

### Renew 歷程

- 無。

### 遭遇問題

- 第一次在 scratch 用 `$(node -e "process.stdout.write(require('electron'))")` 取路徑時拿到兩行（`Downloading Electron binary...` + 路徑），因為 42+ 的 `index.js` 在下載時用 `console.log` 印訊息。第二次（已下載）正常。這本身就是 ② 第一列的發現。
- 查 graceful restart 是否計入 crash limit 時，`RestartGpuProcessForContextLoss` 不在 `gpu_service_impl.cc`，最後在 `components/viz/service/gl/exit_code.cc` 找到。`base::GetTerminationStatus` 對非零 exit code 的分類沒有抓原始碼，標為推論。
- 未實測：macOS / Linux 的原生模組載入、`--disable-skia-graphite` 在 Chromium 156 是否有效、Ubuntu 22.04 相容性、electron-builder 26.8.1 打包 45、Playwright 1.59.1 驅動 45。都列進 EXP 關卡。
- 收尾已刪除 scratchpad `ct-T0781/`（含 releases.json、breaking-changes.md、Chromium 原始碼片段、electron@45.2.1 測試安裝）。

### 方法論狀態回寫

- 不適用（本單沒有 frontmatter `methodology`，沒有呼叫任何方法論 skill，也沒有看到方法論注入）。

### 回報時間

- 2026-11-02T14:43:42+0800
