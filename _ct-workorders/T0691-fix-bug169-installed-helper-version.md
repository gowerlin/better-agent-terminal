---
schema_version: 1
schema_kind: workorder
id: T0691
title: "BUG-169 修正：安裝版 helper 的 `--version` 與 BAT MCP `serverInfo.version` 回報實際版號（打包時在 resources 放只含 name / version 的 package.json）"
type: bugfix
status: FIXED
repo: better-agent-terminal
project: BUG-169
priority: P3
sizing: S
created_at: "2026-10-21T23:29:38+0800"
started_at: "2026-10-21T23:31:22+08:00"
updated_at: "2026-10-21T23:42:16+0800"
completed_at: "2026-10-21T23:42:16+0800"
depends_on: []
related:
  - "BUG-169（OPEN low）：helper 以 `join(<helper 目錄>, '..', 'package.json')` 讀版號，安裝版 `resources/` 沒有這個檔 → fallback `0.0.0`（`scripts/bat-terminal.mjs:72`、`scripts/bat-notify.mjs:85`、`scripts/bat-mcp.mjs:83`）"
  - "T0689 / D179：`build.extraResources` 的 scripts filter 只收 6 個執行期 helper；`verify-packaged-native.js` 的 `helper-scripts` 檢查擋 `resources/scripts` 底下多出的任何檔案 → 版號檔不能放進 `resources/scripts`"
  - "server bundle 的先例：`scripts/build-server-bundle.mjs` 在 bundle 根目錄寫只含 `name` / `version` 的 `package.json`（約第 412 行），helper 走同一條 `../package.json` 讀得到"
  - "版號來源：`scripts/build-version.js`（VERSION env > package.json，T0451 規則）；CI（`pre-release.yml:222` 起）先跑 `node scripts/build-version.js` 再分別 `npx electron-builder --win|--mac|--linux`"
affects_files:
  - package.json
  - scripts/build-version.js
  - scripts/verify-packaged-native.js
  - scripts/__tests__/verify-packaged-native.test.mjs
  - scripts/build-server-bundle.mjs
  - scripts/__tests__/**
  - scripts/<新增的 electron-builder hook 或產生器，若採用>
  - .gitignore
  - docs/agent-guide/packaging-release-checks.md
  - CLAUDE.md
  - _ct-workorders/BUG-169-installed-helpers-report-version-0.0.0.md
  - _ct-workorders/T0691-fix-bug169-installed-helper-version.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 方向（塔台決定，BUG-169 修正方向 ①）：打包時在 `<resources>/package.json` 放一個**只含 `name` 與 `version`** 的檔（與 server bundle 根目錄的 `package.json` 同格式），helper 現有的 `../package.json` 讀法不改就能讀到。不採方向 ②（PTY env 帶版號）：helper 在 BAT 外手動執行時也要報對版號，且不必動 `buildPtyEnv()` 與 codex `env_vars` 白名單。若你查到 ① 有實際障礙（例如 Electron 會把 `resources/package.json` 當成 app 載入、某平台的 resources 目錄寫不進去），**先停，用 BAT 通道問塔台**，不要自行改走 ②。"
  - "🔴 版號必須是**實際打包的版號**，不是 repo `package.json` 的字面值：CI 以 `VERSION` env 經 `scripts/build-version.js` 決定版號後才跑 `electron-builder`；本機 `build` / `build:dir` 也經同一套規則。實作方式由你選（electron-builder `afterPack` hook 取 packager 的 app 版號寫進 `appOutDir` 的 resources、或建置前產生檔案再以 `extraResources` 複製），選擇與理由寫進回報。產生的中間檔若落在 repo 內須加進 `.gitignore`。三個平台的 resources 位置都要對：win / linux `resources/`、mac `<App>.app/Contents/Resources/`。🔴 不得使用 `build.<platform>.files` / `build.<platform>.extraResources`（CLAUDE.md 🔴，T0546）；`resources/scripts` 仍只放 6 個執行期 helper（T0689），不得放版號檔。"
  - "🔴 先查證再改：Electron 41 的 app 搜尋路徑（`resources/app.asar`、`resources/app`、`default_app.asar`）是否會讀 `resources/package.json`，附證據（Electron 原始碼或官方文件的出處）。不要為了驗證而啟動打包版 app；真的要啟動只能用 e2e 的隔離實例方式，且不得碰已安裝的 BAT（`C:\\Program Files\\BetterAgentTerminal`）與使用者的 userData。"
  - "🔴 若 server bundle 已有寫 `{ name, version }` 的邏輯，能共用就抽一個小函式給兩邊用（不要複製一份格式）；不能共用就說明原因。helper 的版號讀法（`bat-terminal.mjs` / `bat-notify.mjs` / `bat-mcp.mjs`）原則上不改；若必須改，三個一起改且行為一致，並更新它們的測試。"
  - "🔴 守門：`scripts/verify-packaged-native.js` 新增一項打包產物檢查（問題 id 建議 `helper-version`）：`<resources>/package.json` 存在、可解析、只有 `name` / `version`、`version` 非空且不是 `0.0.0`；可取得預期版號時（例如由呼叫端或 app 的 `package.json` 取得）必須相等。三平台 fixture 在 `scripts/__tests__/verify-packaged-native.test.mjs` 測綠與紅（缺檔、`0.0.0`、多出欄位、版號不符）。既有 `helper-scripts` 等檢查不得改壞。"
  - "🔴 實測：`npm run verify:helpers` 綠；`npm run build:dir`（會清掉並重建 `dist-electron`）；`release/win-unpacked/resources/package.json` 內容；以 CI 的方式跑 `node scripts/verify-packaged-native.js --platform win --out release --arch x64` 綠；清掉 `BAT_*` 連線 env、cwd = `release/win-unpacked/resources/scripts`，執行 `bat-terminal.mjs --version`、`bat-notify.mjs --version`、`bat-mcp.mjs --version`，三者都印實際版號（不是 `v0.0.0`）；BAT MCP `initialize` 的 `serverInfo.version`：能不連線取得 initialize 回應就實測，不能就以單元測試證明它與 `--version` 同一來源。CI 的 VERSION env 路徑以單元測試或可還原的本機演練證明；演練後 `git diff -- package.json package-lock.json` 必須為空。只碰 `release/` 的產物。"
  - "🔴 測試：相關檔案的 vitest（`scripts/__tests__/verify-packaged-native.test.mjs`、`server-bundle-helpers.test.mjs`、`asar-runtime-deps.test.mjs`、server bundle 相關測試，以及你新增的測試）全綠；最後跑一次整包 `npm run test:unit`（基線 5779 passed / 326 files / 3 skipped，只能增加）。本單不改 `src/` / `electron/`，typecheck 不必跑；若意外改到，對應的 typecheck 要 = 0。"
  - "🔴 文件：`docs/agent-guide/packaging-release-checks.md`（打包產物檢查項目、Helper bundle 段說明版號來源）；CLAUDE.md「Packaging / Release 前置檢查」節只在必守規則有變時加一句（遵守 CLAUDE.md 開頭的撰寫規則，`##` 標題不改名）。BUG-169：狀態改 `FIXED`、`updated_at`（取系統時間）、補「修復紀錄」（commit、方式、實測）。"
  - "🔴 Git：`git commit --only <檔案>`；不 push；不觸發任何 workflow。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF；含反斜線的內容用 Write／Edit 工具寫（L129）。`gh` 一律帶 `-R gowerlin/better-agent-terminal`（L122），本單原則上不需要 gh。"
  - "🔴 公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」：回報裡的路徑用 repo 相對路徑或 `<使用者資料夾>`。yolo：不得問使用者，判讀問題問塔台。"
---

# T0691 — BUG-169 修正：安裝版 helper 回報實際版號

## 元資料

- **工單編號**：T0691
- **類型**：bugfix（BUG-169，low）
- **優先級**：P3
- **建立時間**：2026-10-21T23:29:38+0800
- **預估規模**：S

## 目標

安裝版的 `bat-terminal.mjs` / `bat-notify.mjs` / `bat-mcp.mjs --version` 與 BAT MCP `initialize` 的 `serverInfo.version` 目前都是 `0.0.0`，因為 helper 讀 `<resources>/package.json`，而安裝目錄沒有這個檔。打包時補上一個只含 `name` / `version` 的 `package.json`（與 server bundle 同格式），版號 = 實際打包的版號，並由打包產物檢查守住。只影響顯示，塔台判讀 helper 一律看 exit code。

## 要做的事

1. 查證 Electron 41 不會把 `resources/package.json` 當 app 載入（附出處）。
2. 選定產生方式（afterPack hook 或建置前產生 + extraResources），版號取實際打包版號，三平台位置正確。
3. 能共用就與 server bundle 共用 `{ name, version }` 的寫法。
4. `verify-packaged-native.js` 加 `helper-version` 檢查與三平台 fixture 測試。
5. `verify:helpers`、`build:dir`、打包產物檢查、三個 helper `--version`、MCP `serverInfo.version`。
6. 文件、BUG-169 狀態與修復紀錄。

## 驗收

- `release/win-unpacked/resources/package.json` 只有 `name` / `version`，版號 = 本次打包版號；`resources/scripts` 仍正好 6 個 helper。
- 三個 helper 的 `--version` 在打包目錄印實際版號；MCP `serverInfo.version` 同一來源（實測或測試證明）。
- `verify-packaged-native.js` 對 `release/` 綠；缺檔、`0.0.0`、多出欄位、版號不符都有紅燈測試（三平台 fixture）。
- VERSION env 路徑有測試或可還原演練，演練後 `package.json` / lock 無 diff。
- 整包 `test:unit` ≥ 5779 passed、0 failed。
- 只改 `affects_files`；未 push、未觸發 workflow。

---

## 回報區

### 待塔台決策（僅 yolo Worker 有問題時）

無（未向塔台提問；方向 ① 沒有遇到需停下的障礙）。

### 完成狀態

**FIXED**：Worker 步驟全部完成；BUG-169 改 `FIXED`，等下一個預覽版的安裝版驗收。

- 落點檢查：**PASS**。C-0 `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`；C-1 工單在 REPO_ROOT 下；C-3 抽查 `package.json`、`scripts/build-version.js`、`scripts/verify-packaged-native.js`、`scripts/__tests__/verify-packaged-native.test.mjs`、`scripts/build-server-bundle.mjs` 皆存在；C-2 工單無 `branch` 欄位（目前 `main`）。`CT_HOME` 未設定（非 worktree）。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）。`CT_MODE=yolo`、`CT_INTERACTIVE=0`。
- 開工時 `status` 為 `TODO`（非 `PENDING`），照常改為 `IN_PROGRESS`。

### 產出摘要

**Commit**：`b0ff5673` `fix: installed helpers report the packaged version (T0691, BUG-169)`（產品 + 文件，7 檔）；工單 / BUG 單另一個 commit。未 push、未觸發 workflow。

**1. 查證：Electron 41 不會把 `resources/package.json` 當 app 載入**

- Electron 41.2.1（`node_modules/electron/dist/electron.exe` 內嵌的 browser init，即上游 `lib/browser/init.ts`）的載入迴圈原文：`for(c of p)try{if(c=s.join(process.resourcesPath,c),u&&!h?.(c))continue;d=i._load(s.join(c,"package.json"));break}catch{continue}`，`p` = hidden value `appSearchPaths`；同一執行檔 `shell/common/node_bindings.cc` 段落的字串為 `app` / `app.asar` / `default_app.asar` / `appSearchPaths` / `appSearchPathsOnlyLoadASAR`，失敗訊息 `Failed to locate a valid package to load (app, app.asar or default_app.asar)`。⇒ 只讀 `<resources>/<app|app.asar|default_app.asar>/package.json`，不讀 `<resources>/package.json`。官方文件對應：Electron「Application Packaging / Application Distribution」說明 app 放在 `resources/app` 或 `resources/app.asar`。
- 未啟動打包版 app。
- 附帶確認：`app.asar.unpacked/` 根目錄沒有 `package.json`，所以 unpacked 的 `dist-electron/terminal-server.js` 往上找 package scope 會找到這個新檔；它沒有 `type` / `exports` / `imports`，Node 的判定與找不到 package.json 相同（CommonJS），行為不變。server bundle 根目錄的同格式檔案早已如此。已寫進 docs，並以 `helper-version` 擋多出欄位。

**2. 產生方式：electron-builder `afterPack` hook（不採建置前產生 + extraResources）**

- `package.json` `build.afterPack` = `./scripts/version-manifest.cjs`（新檔），寫 `packager.getResourcesDir(appOutDir)/package.json`：win / linux `resources/`、mac `<productFilename>.app/Contents/Resources/`（app-builder-lib 26.8.1 `getResourcesDir` / `getMacOsResourcesDir`）。版號 = `packager.appInfo.version`，即 electron-builder 寫進 `app.asar` 的 app `package.json`（含 `extraMetadata`）。
- 理由：① 版號直接取 electron-builder 正在打包的值，CI（`build-version.js` 以 `VERSION` 改寫 `package.json` 且不還原，之後才 `npx electron-builder`）與本機 `build` / `build:dir` 都不用改；② CI 直接呼叫 `npx electron-builder --win|--mac|--linux`，「建置前產生」需要改 workflow 多一步（不在 `affects_files`），漏跑就打出舊檔；③ 不產生 repo 內中間檔，所以 `.gitignore` 不必改；④ 不需要 `build.<platform>.*`。
- 時機：app-builder-lib `doPack` 在 extraResources 複製之後、`sanityCheckPackage` / fuses / 簽章之前呼叫 afterPack，mac 的 `.app` 簽章會涵蓋此檔。拿不到 name / version 時 throw，打包失敗。
- hook 由 electron-builder 先 `require` 載入（`helpers/dynamic-import.js` `dynamicImportMaybe`），具名 export `afterPack`。

**3. 與 server bundle 共用格式**：`scripts/version-manifest.cjs` `versionManifestContent(name, version)`；`scripts/build-server-bundle.mjs` 改用 `import versionManifest from './version-manifest.cjs'` 寫 bundle 根目錄的 `package.json`（輸出與原本 `JSON.stringify({ name, version }, null, 2) + '\n'` 位元組相同）。以 `--target=bogus-target` 確認 import 可解析（到 parseTargetArg 才報錯，未進入建置）。helper（`bat-terminal.mjs` / `bat-notify.mjs` / `bat-mcp.mjs`）的版號讀法**未改**。

**4. 守門 `helper-version`**（`scripts/verify-packaged-native.js`）：`verifyHelperVersion(resourcesPath, expectedVersion)` 由 `verifyPackagedLayout` 三平台共用呼叫；`<resources>/package.json` 必須存在、可解析、只有 `name` / `version`、`name` 非空、`version` 非空且不是 `0.0.0`、等於 `app.asar` 內 `package.json` 的 `version`（`asarAppVersion`；讀不到時只查檔案本身；也可由 option `expectedVersion` 指定）。成功時輸出加 `, helper version <v>`；失敗提示 `T0691 helper-version: package.json build.afterPack must stay ./scripts/version-manifest.cjs …`。CLI 參數不變（workflow 不必改）。

**5. 測試**（`scripts/__tests__/verify-packaged-native.test.mjs`，58 → 84 個 test case（+26）；`makeLinux` / `makeWin` 搬到模組層，三平台 fixture 都寫 `resources/package.json`，`HEALTHY_PACKED` 的 app package.json 帶版號）：

- `describe.each` mac / linux / win × 綠燈（含 CLI exit 0、輸出版號）、缺檔（exit 1、提示）、`0.0.0`、多出欄位、版號不符（exit 1）、app.asar 無版號時只查檔案。
- `version-manifest.cjs`：格式、各種問題、server bundle 使用同一函式的 source guard、`build.afterPack` 設定與三平台無 `build.<platform>.files` / `extraResources`、afterPack 寫入 win / linux / mac resources、無版號時 reject。

**6. 文件**：`docs/agent-guide/packaging-release-checks.md`（打包產物檢查的 `helper-version`；Helper bundle 段後新增「helper 的版號來源」：來源、afterPack、時機、Electron 查證、package scope 說明、🔴 規則）；CLAUDE.md「Packaging / Release 前置檢查」的 Helper bundle 那一點加一句必守規則（不放 `resources/scripts`、不加其他欄位），`##` 標題未改。

**驗證證據**

| 項目 | 結果 |
|---|---|
| `npm run verify:helpers` | ✅ `OK — the installer ships 6 runtime helper(s) …` |
| `npm run build:dir`（HEAD `9c305164` + 本單未提交變更；產品程式與 `b0ff5673` 相同，文件之後才改） | ✅ exit 0；log `afterPack (T0691): wrote …\release\win-unpacked\resources\package.json (better-agent-terminal 0.7.1-pre.5)` |
| `release/win-unpacked/resources/package.json` | `{ "name": "better-agent-terminal", "version": "0.7.1-pre.5" }`（LF、結尾換行）；`resources/scripts` 正好 6 個 helper |
| `node scripts/verify-packaged-native.js --platform win --out release --arch x64` | ✅ exit 0，`… 6 runtime helper(s) in resources/scripts, helper version 0.7.1-pre.5` |
| 三個 helper `--version`（cwd = `release/win-unpacked/resources/scripts`，`env -u` 清掉 `BAT_REMOTE_PORT` / `BAT_REMOTE_TOKEN` / `BAT_TERMINAL_ID` / `BAT_TOWER_TERMINAL_ID` / `BAT_HELPER_DIR` / `BAT_SESSION` / `BAT_WORKSPACE_ID`，`BAT_USER_DATA` / `BAT_HELPER_LOG_DIR` 指到 scratch） | ✅ `bat-terminal.mjs v0.7.1-pre.5` / `bat-notify.mjs v0.7.1-pre.5` / `bat-mcp.mjs v0.7.1-pre.5`，exit 0 |
| BAT MCP `initialize`（同上 env，stdin 送 initialize，不連 BAT） | ✅ 實測 `"serverInfo":{"name":"bat","title":"Better Agent Terminal","version":"0.7.1-pre.5"}` |
| 對照：暫時移走 `resources/package.json` | `bat-terminal.mjs v0.0.0`、`serverInfo.version: "0.0.0"`（重現 BUG-169），之後放回原檔 |
| CI `VERSION` 路徑演練：`CI=true VERSION=v0.7.1-t0691.1 node scripts/build-version.js` → `CI=true npx electron-builder --win --dir --publish never -c.directories.output=release/t0691-ci-rehearsal` | ✅ `Using version from env: 0.7.1-t0691.1`；afterPack 寫 `0.7.1-t0691.1`；`app.asar` 版號 `0.7.1-t0691.1`；verifier 綠；`bat-terminal.mjs v0.7.1-t0691.1`。演練前備份、演練後以備份覆寫 `package.json` / `package-lock.json`，`git diff -- package.json package-lock.json` = 0 行；演練輸出目錄 `release/t0691-ci-rehearsal` 已刪除 |
| 相關 vitest：`verify-packaged-native.test.mjs` | ✅ 84 passed |
| 相關 vitest：`server-bundle-helpers` / `asar-runtime-deps` / `dev-deploy-headless` / `bat-mcp` / `fetch-baseline-version` | ✅ 5 檔 146 passed |
| 整包 `npm run test:unit`（`BAT_HELPER_LOG_DIR` / `BAT_USER_DATA` 指到 scratch） | ✅ 326 files passed，**5805 passed / 3 skipped / 0 failed**（基線 5779 → +26） |
| typecheck | 未跑：本單未改 `src/` / `electron/` |

**改動檔案**：`package.json`（`build.afterPack`）、`scripts/version-manifest.cjs`（新）、`scripts/build-server-bundle.mjs`、`scripts/verify-packaged-native.js`、`scripts/__tests__/verify-packaged-native.test.mjs`、`docs/agent-guide/packaging-release-checks.md`、`CLAUDE.md`、`_ct-workorders/BUG-169-installed-helpers-report-version-0.0.0.md`、本工單。未改 `scripts/build-version.js`、`.gitignore`（沒有 repo 內中間檔）、helper 三支。

### 互動紀錄

無（yolo，未向使用者或塔台提問）。

### 遭遇問題

1. 未實測 mac / Linux 的實際產物：本機只能打 Windows。三平台位置由 `getResourcesDir` 決定（單元測試以 mac `BetterAgentTerminal.app/Contents/Resources` 斷言 hook 寫入點），實際產物由 CI 的 `verify-packaged-native.js`（三平台都會跑 `helper-version`）把關；mac 簽章後的檔案位置建議在下一個預覽版的 CI log 看 `afterPack (T0691)` 與 verifier 輸出確認。
2. 未做 NSIS 安裝後的實機驗收（安裝目錄的 `--version`）：`--dir` 與 NSIS 用同一個 `win-unpacked` 內容，留給下一個預覽版。
3. CI 演練用 `--dir`，未打 NSIS / zip（hook 對 dir 與安裝檔 target 是同一次 pack）。
4. 演練中的 `npm run compile` 重建了 `dist-electron`（gitignored，內容與 `b0ff5673` 相同）；`release/` 根目錄既有的舊 0.6.0-pre.1 產物未動。

### 回報時間

2026-10-21T23:42:16+0800
