---
schema_version: 1
schema_kind: workorder
id: T0689
title: "安裝檔的 resources/scripts 只收執行期 helper：extraResources 改成明列白名單（與 serverBundleHelperScripts 同一組），verify 腳本守住，build:dir 實測"
type: chore
status: DONE
repo: better-agent-terminal
project: D179
priority: P2
sizing: S
created_at: "2026-10-21T22:00:10+0800"
started_at: "2026-10-21T22:05:08+0800"
updated_at: "2026-10-21T22:11:45+0800"
completed_at: "2026-10-21T22:11:45+0800"
depends_on: []
related:
  - "D179（v0.7.1-pre.5 發版前的小批：T0687／T0688／T0689；使用者選「併入這批」）"
  - "現況：`package.json` `build.extraResources` = `[{ from: 'scripts', to: 'scripts', filter: ['*.mjs'] }]`，所有 `scripts/*.mjs`（含 T0685 新增的 `run-legacy-tests.mjs` 與 build / smoke / migrate 等開發腳本）都進安裝檔"
  - "BUG-058 / T0247：舊的明列白名單漏了 `_bat-logger.mjs`、`_bat-cert.mjs`（helper 的相對 import），安裝版 helper 起不來，才改成 `*.mjs`；之後 `scripts/verify-helper-bundle.js` 加了 import 封閉性檢查"
  - "T0433：`scripts/build-server-bundle.mjs` 的 `serverBundleHelperScripts`（bat-terminal、bat-notify、bat-mcp、bat-hook、_bat-cert、_bat-logger）是 headless PTY 的執行期 helper 清單，`verify-helper-bundle.js` 已檢查它的封閉性"
  - "本機 PTY 的 `BAT_HELPER_DIR`：`localHelperDir()`（`electron/main.ts`，打包版 = `process.resourcesPath/scripts`）；CT skill 的後備路徑 `C:\\Program Files\\BetterAgentTerminal\\resources\\scripts\\bat-terminal.mjs` / `bat-notify.mjs`"
affects_files:
  - package.json
  - scripts/verify-helper-bundle.js
  - scripts/verify-packaged-native.js
  - scripts/__tests__/server-bundle-helpers.test.mjs
  - scripts/__tests__/verify-packaged-native.test.mjs
  - CLAUDE.md
  - docs/agent-guide/packaging-release-checks.md
  - docs/plan-007-release-checklist.md
  - _ct-workorders/T0689-installer-runtime-helpers-only.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 先盤點再改：列出 `scripts/*.mjs` 逐檔分「執行期」／「開發用」，每檔附證據（打包版誰從 `<resources>/scripts/` 讀它：`localHelperDir()` → `BAT_HELPER_DIR`、`electron/bat-mcp-launch.ts` 的 shim / hook 路徑、Docker／WSL／SSH 流程是否從安裝目錄複製或掛載 helper、其他 `process.resourcesPath` 消費者、CT 的後備路徑）。塔台初判（待你證實）：執行期 = `serverBundleHelperScripts` 那 6 個；`bat-server.mjs` 與 `_bat-server-helpers.mjs` 只在建置 server bundle 時從 repo 讀，其餘是開發腳本。若有證據顯示某個「開發用」檔案在打包版執行期會被讀到，保留它並在回報說明。"
  - "🔴 `package.json` 只改 `build.extraResources[0].filter`：由 `['*.mjs']` 改成明列執行期 helper 的檔名（不用萬用字元）。其他 build 設定不動；不得使用 `build.<platform>.extraResources` / `files`（CLAUDE.md 🔴）。"
  - "🔴 `scripts/verify-helper-bundle.js`：保留既有 import 封閉性與 D146 baseline 檢查；新增：① filter 的每一項必須是字面檔名（出現萬用字元即失敗，避免改回 `*.mjs` 又把開發腳本打進去）；② filter 的集合必須等於 `serverBundleHelperScripts`（本機與 headless 用同一組執行期 helper；任一邊多或少都失敗，訊息寫清楚兩處都要加）；③ 錯誤訊息裡「改回 `*.mjs`」的建議改成「把檔名加進白名單與 `serverBundleHelperScripts`」。若你認為兩組不該強制相等，先問塔台。"
  - "🔴 `scripts/verify-packaged-native.js`（CI 打包後跑）：新增打包產物檢查，`resources/scripts` 必須正好是執行期那組（缺任何一個或多出任何 `.mjs` 都失敗並列出檔名）。沿用腳本現有的各平台 resources 目錄解析（win / linux 的 `resources/`、mac 的 `.app/Contents/Resources/`），並在 `scripts/__tests__/verify-packaged-native.test.mjs` 以三個平台的 fixture 測綠與紅。mac 無法本機實測，fixture 必須涵蓋。"
  - "🔴 實測：`npm run verify:helpers` 綠；`npm run build:dir`（本單會清掉並重建 `dist-electron`，同批 T0688 已被告知不要同時建置）；列出 `release/win-unpacked/resources/scripts` 的檔案（應正好 6 個）；以 CI 的方式跑 `verify-packaged-native.js` 對 `release/` 綠；在打包目錄裡實際執行 `bat-terminal.mjs` 與 `bat-notify.mjs`（用不需要連線的參數，例如 `--help` 或缺參數的用法錯誤），證明沒有 `ERR_MODULE_NOT_FOUND`。只碰 `release/` 的產物，不得動已安裝的 BAT（`C:\\Program Files\\BetterAgentTerminal`）。"
  - "🔴 相關測試：`npx vitest run scripts/__tests__/server-bundle-helpers.test.mjs scripts/__tests__/verify-packaged-native.test.mjs scripts/__tests__/asar-runtime-deps.test.mjs`（fixture 若寫 `*.mjs` 要跟著改，並補紅燈案例：萬用字元、少一個 helper、與 `serverBundleHelperScripts` 不一致、打包產物多出開發腳本）。`scripts/build-version.js` 會 `require('./verify-helper-bundle')`，確認它仍可用。整包 `test:unit` 由塔台在這批收齊後一起跑。"
  - "🔴 文件：CLAUDE.md「Packaging / Release 前置檢查」節的 **Helper bundle fail-fast** 那條改寫（安裝檔只收執行期 helper、白名單與 `serverBundleHelperScripts` 同一組、新增 helper 兩處都加並跑 `npm run verify:helpers`），一兩句，細節放 `docs/agent-guide/packaging-release-checks.md`（Helper bundle fail-fast 段、打包產物檢查項目）；`docs/plan-007-release-checklist.md` 第 30–33 行若仍寫「每個 `scripts/*.mjs`」一併改。遵守 CLAUDE.md 開頭的撰寫規則。"
  - "🔴 CLAUDE.md 與同批 T0687 重疊（T0687 改「BAT MCP shim」節）。commit 前先跑 `git diff -- CLAUDE.md`：只能有本單的 hunk。若出現別的 hunk，不要 commit CLAUDE.md，用 BAT 通道問塔台。"
  - "🔴 Git：`git commit --only <檔案>`；不 push；不觸發任何 workflow。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF；含反斜線的內容用 Write／Edit 工具寫（L129）。`gh` 一律帶 `-R gowerlin/better-agent-terminal`（L122），本單原則上不需要 gh。"
  - "🔴 公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」：回報裡的路徑用 repo 相對路徑或 `<使用者資料夾>`。yolo：不得問使用者，判讀問題問塔台。"
---

# T0689 — 安裝檔只收執行期 helper

## 目標

安裝檔目前把 `scripts/` 底下所有 `.mjs` 都放進 `resources/scripts`，其中大多是開發與建置用的腳本（T0685 新增的 `run-legacy-tests.mjs` 也在內）。改成只收執行期 helper，並讓 verify 腳本在打包前、打包後都守住，避免 BUG-058（漏掉 helper 的相對 import）重演。併入 `v0.7.1-pre.5` 發版批次（D179）。

## 要做的事

1. 盤點 `scripts/*.mjs`：逐檔分執行期／開發用，附證據。
2. `package.json` `build.extraResources[0].filter` 改成明列執行期 helper。
3. `scripts/verify-helper-bundle.js`：字面檔名、與 `serverBundleHelperScripts` 相等、錯誤訊息。
4. `scripts/verify-packaged-native.js`：打包產物的 `resources/scripts` 正好是執行期那組（三平台 fixture 測試）。
5. `verify:helpers`、`build:dir`、打包產物檢查、打包目錄裡實際執行 helper。
6. CLAUDE.md 與 docs。

## 驗收

- 盤點表（檔名、分類、證據）；`release/win-unpacked/resources/scripts` 正好是執行期那組。
- `npm run verify:helpers` 綠；萬用字元、少一個、兩組不一致、打包產物多出開發腳本都有紅燈測試。
- 打包目錄裡 `bat-terminal.mjs`、`bat-notify.mjs` 可執行、沒有 `ERR_MODULE_NOT_FOUND`。
- 文件已更新；只改 `affects_files`；未 push、未觸發 workflow。

---

## 回報區

### 完成狀態

DONE。安裝檔 `resources/scripts` 只剩 6 個執行期 helper；打包前（`verify-helper-bundle.js`）與打包後（`verify-packaged-native.js` `helper-scripts`）都守住；`build:dir` 實測正好 6 個，打包目錄裡的 helper 可執行。

落點檢查：PASS。C-0 `repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal`；C-1 工單在 repo 內；C-3 `package.json` 等存在（C-0 已 PASS，僅記錄）；C-2 無 `branch` 欄位。`CT_HOME` 未設定（非 worktree）。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）。工單開工時 `status: TODO`（非 PENDING），照開工流程改 `IN_PROGRESS`。

#### 盤點表（`scripts/*.mjs`，19 檔）

打包版唯一從 `<resources>/scripts/` 讀檔的地方是 `localHelperDir()`（`electron/main.ts`，`app.isPackaged` → `process.resourcesPath/scripts`），它餵給 PTY 的 `BAT_HELPER_DIR`（`PtyManager.localHelperEnv()`）與 `batMcpHost.helperDir`（`electron/bat-mcp-launch.ts` 找 `bat-mcp.mjs` / `bat-hook.mjs`）。`electron/` 與 `src/` 其他 `process.resourcesPath` 消費者只有 claude 路徑（`app.asar.unpacked`）與 `bat-server-baseline`，都不讀 `scripts/`。Docker / WSL / SSH 流程用的是 server bundle（`<installRoot>/scripts`，由 `build-server-bundle.mjs` 從 repo 複製 `serverBundleHelperScripts`），不從安裝目錄複製或掛載 helper（`docker/Dockerfile` 只解 bundle tarball）。

| 檔名 | 分類 | 證據 |
|---|---|---|
| `bat-terminal.mjs` | 執行期 | CT 派工 / 回收 / 問答 helper，`BAT_HELPER_DIR`；CT 後備路徑 `<安裝目錄>\resources\scripts\bat-terminal.mjs` |
| `bat-notify.mjs` | 執行期 | Worker 通知 / `--ask`，`BAT_HELPER_DIR`；CT 後備路徑 |
| `bat-mcp.mjs` | 執行期 | `buildBatMcpLaunchArgs` 以 `helperDir` 找 shim（`electron/bat-mcp-launch.ts:421`） |
| `bat-hook.mjs` | 執行期 | 同檔 `:441` 找 hook 腳本；import `./bat-mcp.mjs` |
| `_bat-cert.mjs` | 執行期 | bat-terminal / bat-notify / bat-mcp 的 static import |
| `_bat-logger.mjs` | 執行期 | 上述四個 helper 的 static import |
| `bat-server.mjs` | 開發 / 建置 | 只在 `build-server-bundle.mjs` 以 `resolveProjectPath('scripts','bat-server.mjs')` 從 repo 複製到 bundle 的 `bin/`；`electron/remote/ssh-start-server.ts` 只在註解提到 |
| `_bat-server-helpers.mjs` | 開發 / 建置 | 只被 `build-server-bundle.mjs` import |
| `build-server-bundle.mjs` | 開發 / 建置 | npm script `build:server-bundle*`、`build-server-bundle.yml`；electron 端只在註解提到 |
| `build-docker-image.mjs` | 開發 / 建置 | npm script `build:docker-image` |
| `dev-deploy-headless.mjs` | 開發 | npm script `deploy:headless:dev` |
| `fetch-baseline-tarball.mjs` | 開發 / 建置 | npm script `fetch:baseline`；`src/lib/snapshot-version.ts` 只在註解提到 |
| `generate-server-bundle-manifest.mjs` | CI | `pre-release.yml` / `release.yml` / `build-server-bundle.yml` 從 checkout 執行 |
| `migrate-ct-frontmatter.mjs` | 開發 | 一次性遷移工具，無任何引用 |
| `remote-tools-install-check.mjs` | 開發 | 驗收工具，只有自己的測試引用 |
| `report-artifact-sizes.mjs` | CI | `pre-release.yml` / `release.yml` 從 checkout 執行 |
| `run-legacy-tests.mjs` | 開發 / CI | npm script `test:legacy`、`tests.yml` |
| `smoke-remote-headless.mjs` | 開發 | npm script `smoke:remote:headless` |
| `verify-docker-image.mjs` | 開發 / 建置 | npm script `verify:docker-image` |

結論：塔台初判成立，執行期 = `serverBundleHelperScripts` 那 6 個；沒有「開發用」檔案在打包版執行期被讀到。helper 的動態 `import()` 檢查過：6 個 helper 都沒有。

### 修改內容

- `package.json`：只改 `build.extraResources[0].filter`，`["*.mjs"]` → `bat-terminal.mjs`、`bat-notify.mjs`、`bat-mcp.mjs`、`bat-hook.mjs`、`_bat-cert.mjs`、`_bat-logger.mjs`（與 `serverBundleHelperScripts` 同序）。其他 build 設定未動，未用 `build.<platform>.*`。
- `scripts/verify-helper-bundle.js`：D146 baseline 檢查與 T0433 server bundle 檢查原樣保留（後者改為回傳清單）。舊的「每個 `scripts/*.mjs` 都要被 filter 涵蓋」檢查與「(A) Restore the inclusive glob `*.mjs`」建議移除，改成 T0689 檢查：`from: 'scripts'` 項目恰一個、`to: 'scripts'`、filter 非空；每項是字面檔名（含 `* ? [ ] { } !` 或路徑分隔符即失敗）；檔案存在；對 relative `.mjs` static import 封閉；集合等於 `serverBundleHelperScripts`（兩邊各自多出的檔名分開列）。失敗訊息：「list each runtime helper by file name in BOTH package.json … AND serverBundleHelperScripts … Do not go back to "*.mjs"」。`scripts/build-version.js` 的 `require('./verify-helper-bundle')` 仍可用（實測 exit 0）。
- `scripts/verify-packaged-native.js`：新增 `runtimeHelperScripts()`（從 `scripts/build-server-bundle.mjs` 解析 `serverBundleHelperScripts`，排序）與 `verifyHelperScripts()`；`verifyPackagedLayout(resourcesPath, platform, arch, { helperScripts })` 多一項問題 id `helper-scripts`：`<resources>/scripts` 遞迴列檔，缺的列 `missing: <檔名>`、多的（任何檔案，含子目錄）列 `extra: <檔名>`。沿用既有三平台 resources 解析（win / linux `resources/`、mac `.app/Contents/Resources/`）。成功訊息多「N runtime helper(s) in resources/scripts」，失敗提示多一行 T0689。匯出兩個新函式。
- `scripts/__tests__/server-bundle-helpers.test.mjs`：fixture 的 filter 改為 6 個檔名（可覆寫），新增 `installer helper whitelist (T0689)`：repo 的 filter = `serverBundleHelperScripts` 且皆字面檔名；紅燈 `*.mjs`、字面 + `bat-*.mjs`、少 `bat-mcp.mjs`（與 server bundle 不一致）、少 `_bat-cert.mjs`（import 未封閉）、多 `_bat-server-helpers.mjs`（兩組不一致）、列出不存在的檔、沒有 scripts 項目 / filter 空；每個紅燈都斷言訊息指向「兩處都加」且不再建議 `*.mjs`。
- `scripts/__tests__/verify-packaged-native.test.mjs`：三平台健康 fixture 都寫入 `resources/scripts` 的 6 個 helper 並斷言 `layout.helperScripts`；新增紅燈：mac（多 `run-legacy-tests.mjs`、整組缺）、linux（缺 `_bat-logger.mjs` + 多 `build-server-bundle.mjs`）、win（舊 `*.mjs` 情境：多 `bat-server.mjs` / `run-legacy-tests.mjs` / `hooks/pre-commit`；沒有 `resources/scripts`），含 CLI exit 1 與 stderr；`runtimeHelperScripts()` = 6 個 = package.json filter；`verifyPackagedLayout` 的 `helperScripts` 選項。
- `CLAUDE.md`「Packaging / Release 前置檢查」節 **Helper bundle fail-fast** 一條改寫（只此一個 hunk，commit 前 `git diff -- CLAUDE.md` 確認）。
- `docs/agent-guide/packaging-release-checks.md`：打包產物檢查的三平台共同檢查加 `helper-scripts`；Helper bundle fail-fast 段改寫（白名單規則、檢查項目、新增 helper 的步驟、`bat-server.mjs` / `_bat-server-helpers.mjs` 的建置期用途）。
- `docs/plan-007-release-checklist.md` 第 30–33 行：原寫「Confirms every `scripts/*.mjs` helper …」，改成新規則。

### 驗證結果

| 項目 | 結果 | 證據 |
|---|---|---|
| `npm run verify:helpers` | PASS | `the installer ships 6 runtime helper(s) listed by name, the same set as the server bundle, with a closed import set`；改 package.json 前（filter 仍是 `*.mjs`）同一腳本 exit 1，指出 `"*.mjs" is not a literal file name` |
| `npm run build:dir` | PASS | exit 0（`clean:dist-electron` → verify ×3 → vite build → `electron-builder --dir`，win32 x64） |
| `release/win-unpacked/resources/scripts` | PASS | 正好 6 個：`_bat-cert.mjs`、`_bat-logger.mjs`、`bat-hook.mjs`、`bat-mcp.mjs`、`bat-notify.mjs`、`bat-terminal.mjs` |
| `node scripts/verify-packaged-native.js --platform win --out release --arch x64`（同 `pre-release.yml:234`） | PASS | `✅ win x64: … 8 runtime package(s) / 15 with dependencies, 6 runtime helper(s) in resources/scripts`、`every windows package passed (x64)` |
| 反向樣本（build 前的舊產物） | 如預期 FAIL | build 前 `release/win-unpacked` 是 0.6.0-pre.1 的舊產物，同一指令 exit 1：`missing: bat-hook.mjs`、`missing: bat-mcp.mjs`、`extra:` 12 個開發腳本 |
| 打包目錄裡執行 helper（清掉 `BAT_*` 連線 env，cwd = `release/win-unpacked/resources/scripts`） | PASS | `bat-terminal.mjs --version` / `bat-notify.mjs --version` / `bat-mcp.mjs --version` exit 0；`bat-terminal.mjs --help` exit 0；`bat-notify.mjs`（無參數）exit 1 `No target terminal ID`（用法錯誤）；`bat-hook.mjs stop` exit 0、無輸出。全程無 `ERR_MODULE_NOT_FOUND` |
| `npx vitest run scripts/__tests__/server-bundle-helpers.test.mjs scripts/__tests__/verify-packaged-native.test.mjs scripts/__tests__/asar-runtime-deps.test.mjs` | PASS | build 後重跑：3 files / 115 tests passed（dist-electron 已重建，asar-runtime-deps 的 dist-electron 項目有跑）；另加跑 `dev-deploy-headless.test.mjs`（也解析 `serverBundleHelperScripts`）：4 files / 151 passed |
| `build-version.js` 的 require | PASS | `node -e "require('./scripts/verify-helper-bundle')"` exit 0 |
| 整包 `test:unit` | 未跑 | 依工單由塔台在批次收齊後跑 |

只碰了 `release/` 的產物，沒有動已安裝的 BAT。

### Commit

- 產品：`b9afa02e` build: installer ships runtime helpers only, whitelist guarded before and after packaging (T0689)（`git commit --only` 8 個檔案）
- 工單：本回報的 commit（`git commit --only` 本檔）
- 未 push、未觸發 workflow、未用 gh。

### 遭遇問題

- 無阻擋。觀察（不在本單範圍，未改）：
  1. 打包目錄裡 `--version` 印 `v0.0.0`：helper 讀 `<scripts>/../package.json` 取版號，安裝版 `resources/` 下沒有 `package.json`，fallback 為 `0.0.0`。這是既有行為（改 filter 前同樣如此），不影響功能。若要讓安裝版 helper 報正確版號，可另開單評估（例如 extraResources 另放一份只含 version 的檔案）。
  2. `scripts/build-version.js:132` 的註解仍寫「abort if extraResources.filter drifts away from the helper import graph」，語意仍大致正確但不完整；不在 `affects_files`，未改。
  3. `release/` 根目錄仍有 0.6.0-pre.1 的舊安裝檔（`build:dir` 只覆寫 `win-unpacked`），未清理。
  4. 開工時 working tree 有 T0688 的未提交變更（`electron/remote/ssh-start-server.ts`），`build:dir` 期間該單已自行 commit（`79412e61`）；本單 build 用的是當時的工作目錄，與本單驗證的內容（`resources/scripts`、打包產物檢查）無關。

### 互動紀錄

無（yolo，未向塔台提問）。

### 回報時間

2026-10-21T22:10:54+0800
