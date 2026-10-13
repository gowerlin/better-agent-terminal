---
schema_version: 1
schema_kind: workorder
id: T0492
title: "移除未使用的 better-sqlite3：dependencies / @types / allowScripts / postinstall rebuild / verify-native-modules / server bundle nativePackages / CI rebuild / 文件"
type: implementation
status: IN_PROGRESS
repo: better-agent-terminal
project: D139
priority: P2
sizing: M
created_at: "2026-10-13T23:13:05+08:00"
started_at: "2026-10-13T23:37:00+08:00"
updated_at: "2026-10-13T23:37:00+08:00"
completed_at: null
target_version: v0.6.0-pre.5
depends_on:
  - "T0486"
  - "T0487"
  - "T0488"
  - "T0494"
  - "T0495"
related:
  - "T0473（app 無任何 import）、T0477（`git grep -l -F better-sqlite3 -- electron src` = 0 筆）、T0472（verify-native-modules 的 `.node` 檢查）"
  - "CLAUDE.md「本機開發：npm 12 install scripts」「Electron Runtime」「Packaging / Release 前置檢查」「Server bundle baseline」"
affects_files:
  - "package.json"
  - "package-lock.json"
  - "scripts/verify-native-modules.js"
  - "scripts/__tests__/"
  - "scripts/build-server-bundle.mjs"
  - "scripts/verify-server-bundle.js"
  - "electron/remote/"
  - "electron/terminal-server/"
  - ".github/workflows/"
  - "CLAUDE.md"
  - "README.md"
  - "docs/"
  - "scripts/fetch-baseline-tarball.mjs"
  - "scripts/verify-helper-bundle.js"
renew_count: 0
workdir: main repo
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "✅ 本單授權改 `package.json`（移除 better-sqlite3 / @types/better-sqlite3、allowScripts 條目、postinstall 相關段、build 設定中相關項）與 `package-lock.json`（只移除 better-sqlite3 與其**專屬**相依，其他套件版本不得變動；回報區附移除清單與證據）"
  - "✅ 本單授權改 `CLAUDE.md` 中與 better-sqlite3 相關的段落（其他段落不動；T0493 再統一套用其他工單建議）"
  - "🔴 先證明**桌面 app 與 headless server bundle 皆未使用**（含動態 require、server bundle runtime、terminal-server）；任一處有用到即停止移除並回報 PARTIAL"
  - "🔴 `@electron/rebuild` CI step：移除後若仍有其他需 Electron ABI 重建的原生模組（node-pty 等）則保留；只在證明無需時才移除並說明"
  - "🔴 **批次並行（D139）**：同一工作樹有其他 Worker 同時進行。commit 一律 `git commit --only <本單檔案…>`，不得 stage / commit 他人檔案；全套測試或 build 若因他人未提交的 WIP 失敗，於回報區列出失敗檔與歸屬，並以本單檔案相關測試為準（不得為此修改他人範圍的檔案）"
  - "🔴 tsc：本單改動的檔案不得新增 `tsc` 錯誤（總數會因 T0486 並行變動，以檔案為單位比較）"
  - "🔴 不得以預設實例（無 `--runtime`）啟動 source build（BUG-119 migration 會作用在使用者真實資料目錄）；需要啟動時用 `--runtime=<高號碼>` 或 e2e isolated runtime，結束只刪自己建立的目錄"
  - "🔴 不 push、不觸發 workflow、不建 tag；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`；`gh` 一律帶 `-R gowerlin/better-agent-terminal`（唯讀）；換行維持各檔現況"
---

# T0492 — 移除未使用的 better-sqlite3：dependencies / @types / allowScripts / postinstall rebuild / verify-native-modules / server bundle nativePackages / CI rebuild / 文件

## 實作

1. 全 repo 證明無使用（`electron/`、`src/`、`scripts/`、server bundle 入口、e2e、測試）；列出所有引用處與處置
2. 移除：dependencies / devDependencies、`allowScripts`、postinstall 的 electron-rebuild（若只為 better-sqlite3；mac `plutil` 段保留）、`REQUIRED_NATIVE_MODULES` 與 T0472 `.node` 檢查（含測試）、`build-server-bundle.mjs` nativePackages、`verify-server-bundle.js`、`build.asarUnpack` / files 規則（若有）
3. 更新 lock（比照 T0483：只保留必要變動）；本機 `npm ci` 後 `node scripts/verify-native-modules.js` exit 0
4. server bundle：本機建置一次（依 repo 既有 script）並跑 `verify-server-bundle`（不可行則說明）
5. 文件：CLAUDE.md 相關段落、README 技術堆疊（若仍提及）、docs

## 追加範圍（T0494 範圍外發現，同檔 `scripts/build-server-bundle.mjs`）

6. server bundle tarball 內有指向 CI runner 絕對路徑的 symlink（例：`staging/node_modules/sharp/node_modules/.bin/semver` → `/Users/runner/work/...`）：`copyRecursive` 排除 `node_modules/**/.bin/`（runtime 不使用；先確認 bundle 內無任何程式經 `.bin` 呼叫），或改寫為相對 symlink（擇一並說明）；linux / darwin 都要涵蓋，`verify-server-bundle.js` 加檢查「bundle 內無絕對路徑 symlink」
7. `build-server-bundle.mjs:91` darwin `readmeRuntimeLine` 改為 `- macOS lower bound: 13.5 (arm64)`（T0494 查證：由 Node 24 `bin/node` minos 13.5 決定）

## 追加範圍（T0488 範圍外發現）

8. `dist-baseline/` 累積舊版 tarball 且全部被打進本機安裝檔（Windows `extraResources.filter` = `bat-server-linux-x64-v*.tar.gz`；主工作樹現有 `v0.5.9-pre.4`、`v0.6.0-pre.1` 各約 240 MB）：`scripts/fetch-baseline-tarball.mjs` 在 fetch 成功後清掉 `dist-baseline/` 內非目前 baseline 版號的 `bat-server-*` / `.sha256`（只刪符合命名規則的檔，留 log），或 `verify-helper-bundle.js` 對多版本 fail / warn（擇一並說明）；CI 乾淨目錄不受影響
9. runtime 下載 fallback 用 snapshot 版號：`electron/remote/server-bundle-distributor.ts` `version = app.getVersion()`，baseline / cache 皆缺時會下載 `server-bundle-v<snapshot>`（必 404）→ 套用 `build-version.js` `stripSnapshotSuffix` 同規則取基底版號（renderer / main 可用的共用實作，避免兩份 regex；附測試）

## 驗收條件

- [x] 無使用證據表；lock 移除清單（只含 better-sqlite3 專屬相依）
- [x] `npm ci` 乾淨（npm 12 結尾警告只剩預期項目）；verify-native-modules ✅；`npm run verify:helpers` ✅
- [x] `npm run test:unit`、`npx vite build`、`npx tsc --noEmit -p .`；server bundle 建置 / 驗證結果
- [x] 追加 8 / 9：dist-baseline 只留目前版號（或 verify 擋多版本）；distributor snapshot fallback 取基底版號
- [x] 追加 6 / 7：bundle 無絕對路徑 symlink（檢查已加入 verify）、darwin README 下限行
- [x] CI 影響說明（pre.5 CI 由塔台觀察）

## Sub-session 執行指示

1. 讀本工單 + D139 + 「related」列出的來源 + affects_files
2. 填 `started_at`、`status: IN_PROGRESS`（取系統時間，R-G001）
3. 實作 → 驗收 → 填回報區 → `DONE`；`git commit --only` 本單檔案與改動；不 push；依派發 mode 通知塔台

---

## 回報區

### 結果摘要

**DONE**。`better-sqlite3` 與 `@types/better-sqlite3` 已從 `dependencies` / `devDependencies` / `allowScripts` / postinstall / `verify-native-modules.js`（含測試）/ server bundle（`nativePackages`、esbuild `external`、`verify-server-bundle.js`）/ CLAUDE.md 全部移除。桌面 app、headless server bundle、terminal-server、e2e、測試都沒有任何地方用到它（證據見下表）。lock 只移除 better-sqlite3 的 20 個專屬條目，另有 14 個條目補上必要的 `dev: true`，沒有任何套件版本變動。追加 6 / 7 / 8 / 9 都已完成，並附測試與實機證據：

- linux-x64 server bundle 在 WSL 實際建置一次。tarball 內 0 個 symlink，`verify-server-bundle` 通過，新加的絕對路徑 symlink 負向檢查確認會擋下，headless server 能正常起來並 listen。
- dist-baseline 舊版清理在主工作樹只跑了 `--dry-run`，用意是不刪除使用者的檔案。
- CI 的 `@electron/rebuild` step **保留**，理由見「CI 影響說明」。

### Landing Zone Check

| 檢查 | 結果 | 說明 |
|---|---|---|
| C-0 repo identity | ✅ PASS | frontmatter `repo` = `better-agent-terminal`；`basename(git rev-parse --show-toplevel)` = `better-agent-terminal`（REPO_ROOT `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`） |
| C-1 工單路徑 | ✅ PASS | 工單位於 REPO_ROOT 的 `_ct-workorders/` 底下 |
| C-3 affects_files | ✅ PASS（資訊性） | 前 5 筆可測項目（`package.json` / `package-lock.json` / `scripts/verify-native-modules.js` / `scripts/__tests__/` / `scripts/build-server-bundle.mjs`）都存在 |
| C-2 branch | ℹ️ N/A | 工單沒有 `branch` 欄位；HEAD = `main` |

`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）。`CT_MODE=yolo`、`CT_INTERACTIVE=0`。

### 1. 無使用證據

| 範圍 | 查法 | 結果 |
|---|---|---|
| 全 repo 原始碼（`electron/`、`src/`、`scripts/`、`e2e/`、`tests/`、server bundle 入口 `electron/remote/{server-entry,headless-entry,lockfile,dataDir}.ts`、`electron/terminal-server/`） | `git grep -n -i sqlite -- . ':(exclude)_ct-workorders' ':(exclude)package-lock.json'` | 只命中**設定 / 檢查 / 文件**（下表），沒有任何 `import` / `require` / 動態 `require(name)` |
| 第三方相依（含動態 require） | `grep -rIl -e better-sqlite3 node_modules --include=*.{js,mjs,cjs}`（排除套件本身與 @types） | 0 筆。`npm ls better-sqlite3`：只有 root 直接相依 |
| 桌面 app 產物 | `npx vite build` 後對 `dist-electron/*.js` 執行 `grep -c -i sqlite` | 全部 0 |
| headless server bundle runtime | WSL 建出移除後的 bundle，解壓後執行 `staging/bin/bat-server --data-dir … --port 19492` | 正常啟動（`node-pty loaded` → `[RemoteServer] Started on 127.0.0.1:19492` → `listening`），沒有 `Cannot find module` |
| 旁證 | 原本的 `copyPackage` 只複製套件目錄，不帶它的相依 | 舊 bundle 裡的 better-sqlite3 沒有 `bindings`，真的被 `require` 就會失敗，所以它在 bundle 裡本來就不可能被用到 |

所有引用處與處置：

| 引用處 | 處置 |
|---|---|
| `package.json` `dependencies."better-sqlite3"`、`devDependencies."@types/better-sqlite3"`、`allowScripts."better-sqlite3"` | 移除 |
| `package.json` `postinstall` 的第二段 `node -e "if(process.env.CI){…}else{…@electron/rebuild…'-w','better-sqlite3'…}"` | 移除（它只重建 better-sqlite3），mac `plutil` 段與 `echo 'postinstall done'` 保留 |
| `build.asarUnpack` / `build.files` | 原本就沒有 better-sqlite3 規則，不需更動 |
| `scripts/verify-native-modules.js`：`REQUIRED_NATIVE_MODULES`、`BETTER_SQLITE3_NODE_SEGMENTS` 與 `.node` 檢查、成功訊息 | 移除，註解同步更新 |
| `scripts/__tests__/verify-native-modules.test.mjs` | 移除 sqlite 案例，改為「better-sqlite3 目錄已不再檢查」與「缺 claude.exe 會擋 desktop host」；CLI 成功案例斷言 `All 2 required native modules present` 且輸出不含 sqlite |
| `scripts/build-server-bundle.mjs`：3 個 target 的 `nativePackages`、esbuild `externalPackages` | 移除 |
| `scripts/verify-server-bundle.js`：`requirePath(... 'better-sqlite3', 'package.json')` | 移除 |
| CLAUDE.md「Electron Runtime」「本機開發：npm 12 install scripts」（背景 / allowScripts / 根 postinstall / 手動補跑表 / 本機打包 / CI）「Packaging / Release 前置檢查」（Build fail-fast / NSIS 驗收） | 改寫（見第 5 節） |
| `CHANGELOG.md:289` | 歷史紀錄，不改 |
| `project-context.md:42,84`（「資料庫 better-sqlite3 … 本地持久化」） | **未改**：不在 affects_files 內，也不在授權範圍；建議由 T0493 處理（見「建議 / 範圍外發現」） |
| `README.md`、`docs/` | 沒有任何提及，不需更動 |

### 2. lock 移除清單（只含 better-sqlite3 專屬相依）

做法比照 T0483 的移植法：

1. 在 scratchpad 用改好的 `package.json` 跑 `npm install --package-lock-only --ignore-scripts`（exit 0），產生參考 lock。
2. 從 HEAD lock 只移植「消失的條目」「root 相依表」「`dev` 旗標」三樣。npm 自己產生的 43 個 `peer` 旗標雜訊（`@babel/core`、`vite`、`react`、`typescript` 等，`version` / `resolved` / `integrity` 都沒變）**不採用**。

- `git diff --stat package-lock.json`：`14 insertions(+), 231 deletions(-)`
- 移除的 20 個條目：`@types/better-sqlite3` 7.6.13、`better-sqlite3` 12.9.0、`bindings` 1.5.0、`deep-extend` 0.6.0、`expand-template` 2.0.3、`file-uri-to-path` 1.0.0、`fs-constants` 1.0.0、`github-from-package` 0.0.0、`ini` 1.3.8、`mkdirp-classic` 0.5.3、`napi-build-utils` 2.0.0、`prebuild-install` 7.1.3、`rc` 1.2.8、`simple-concat` 1.0.1、`simple-get` 4.0.1、`strip-json-comments` 2.0.1、`tar-fs` 2.1.4、`tar-fs/node_modules/chownr` 1.1.4、`tar-stream` 2.2.0、`tunnel-agent` 0.6.0
- 新增 `dev: true` 的 14 個條目：`base64-js`、`bl`、`buffer`、`decompress-response`、`decompress-response/node_modules/mimic-response`、`detect-libc`、`end-of-stream`、`ieee754`、`minimist`、`pump`、`readable-stream`、`safe-buffer`、`string_decoder`、`util-deprecate`
  - 這是必要變動：這些套件原本經由 better-sqlite3 → prebuild-install 被 prod 相依引用，現在只剩 devDependency（`sharp`、`electron-builder` / `@electron/rebuild` 等）會用到。
  - app 原始碼沒有直接 import 其中任何一個（`git grep` 0 筆）。
- 新增 / 版本變動：**0 / 0**
- 重產比對：拿移植後的 lock 與 npm 原生產出的 lock 逐套件比較，REMOVED 0、ADDED 0、CHANGED 0，只剩 META-ONLY 43 筆，全部是 `peer` 雜訊。

### 3. 驗收

| 項目 | 結果 | 證據 |
|---|---|---|
| `npm ci` 乾淨（npm 12） | ✅ PASS | npm 12.2.0、Node 24.21.0，在 scratchpad 的乾淨副本（只有 `package.json` + lock + `scripts/verify-native-modules.js`，沒有設 `CI`）執行：exit 0、`added 853 packages`；postinstall 只跑 `plutil` 段並印 `postinstall done`；結尾警告只剩預期的 `electron-winstaller@5.4.0`；`node_modules` 內沒有 better-sqlite3 / bindings / prebuild-install / rc / tar-fs / @types/better-sqlite3 |
| verify-native-modules | ✅ PASS | 乾淨副本與主工作樹都是 exit 0，輸出 `✅ All 2 required native modules present, whisper binary: …win32-x64\whisper.node, embedded claude: native`；內嵌 claude `--version` = `2.1.296 (Claude Code)` |
| `npm run verify:helpers` | ✅ PASS | `OK — all 15 helper .mjs files … server bundle ships 4 helper(s) with a closed import set` |
| `npm run test:unit` | ✅ PASS | `Test Files 188 passed (188)`、`Tests 3198 passed \| 1 skipped`；跑的時候含並行 Worker 未提交的 WIP，仍全綠。輸出中的 `AttachConsole failed` 是 conpty 測試既有的 stderr 雜訊 |
| `npx vite build` | ✅ PASS | 4 段都 `✓ built`；`dist-electron/*.js` 的 sqlite 出現次數全部為 0 |
| `npx tsc --noEmit -p .` | ✅ PASS | 0 錯（含新檔 `src/lib/snapshot-version.ts` 與其測試） |
| `typecheck:electron`（`tsc -p tsconfig.node.json`） | ✅ 無新增 | 總數 77，等於 D139 記載的 T0496 前基線。本單檔案內的 3 筆都是既有程式碼：`server-bundle-distributor.ts:342` 為 `shouldFallbackToDownload(baselineLookup.state)`；integration test `:140` 為 `mockResolvedValue({ ok: true, arch })`，`:155` 為 `delete process.resourcesPath`。行號是因為本單插入行而位移 |
| server bundle 建置 / 驗證（追加 6） | ✅ PASS | WSL Ubuntu-24.04 + 官方 Node 24.21.0（npm 11.19.0，`CI=true`，等同 CI 的 server-bundle job），在 `/tmp` 的副本執行 `npm ci` → `build-server-bundle.mjs --target=linux-x64` → `[4] Removed 1 node_modules .bin dir(s): node_modules/sharp/node_modules/.bin` → `✅ Bundle created` → `verify-server-bundle.js --target=linux-x64` exit 0。`tar -tv` 中 symlink 數為 `(none)`；`.bin` / sqlite / bindings / prebuild-install 項目為 `(none)`。從 Windows（GNU tar）驗證同一個 tarball 也通過，代表 T0494 看到的 Windows 解壓 tar exit 2 已經不會發生 |
| 絕對路徑 symlink 檢查（追加 6） | ✅ PASS | 負向：在 bundle 植入 `.bin/semver -> /Users/runner/work/…`，verify 回報 `❌ Absolute-path symlinks found … - lrwxrwxrwx … staging/node_modules/sharp/node_modules/.bin/semver -> /Users/runner/work/…`，exit 1（WSL 與 Windows 各測一次）。正向：只放相對 symlink 時 exit 0。bsdtar 3.8.8（macOS CI 用的實作）的 `-tv` 格式同樣是 `l… path -> target`，已確認可以解析 |
| darwin README 下限行（追加 7） | ✅ PASS | `build-server-bundle.mjs` darwin `readmeRuntimeLine: '- macOS lower bound: 13.5 (arm64)'`（附 T0494 minos 來源註解）。darwin bundle 本機無法建置，留待 pre.5 CI |
| dist-baseline 只留目前版號（追加 8） | ✅ PASS | 單元與 CLI 測試 `scripts/__tests__/fetch-baseline-prune.test.mjs` 5/5，涵蓋：只挑其他版號、同版號的其他 arch 一律保留、`0.6.0-pre.5` 不會被當成 `0.6.0`、cache hit 後實際刪除、`--dry-run` 只報告。主工作樹 `node scripts/fetch-baseline-tarball.mjs --dry-run` 列出 `would remove stale baseline` 共 4 檔（`v0.5.9-pre.4` 與 `v0.6.0-pre.1` 的 tarball + sidecar）。`server-bundle-v0.6.0-pre.4` 在 release 上存在（`gh release view -R gowerlin/better-agent-terminal`，唯讀），下一次真正的 build 會先下載再清理 |
| distributor snapshot fallback（追加 9） | ✅ PASS | `src/lib/__tests__/snapshot-version.test.ts` 4/4；`server-bundle-distributor.integration.test.ts` 新增 3 案例：wizard 明確傳入 snapshot → download 用基底版號；`app.getVersion()` 是 snapshot → `0.6.0-pre.4`；snapshot + 基底版號 baseline → baseline hit，cache 檔名用基底版號。`fetch-baseline-version.test.mjs`（經 build-version.js 的 re-export）通過 |

### 4. 追加範圍的做法與取捨

- **6（symlink）採「排除 `node_modules/**/.bin/`」**
  - 根因：`copyRecursive` 是 `fs.cp`，預設 `verbatimSymlinks: false`，會把相對 symlink 改寫成指向來源的絕對路徑。
  - 做法：在 `build-server-bundle.mjs` 的 `copyNativeModules()` 複製完後，以 `pruneBinDirs()` 刪掉所有 `.bin` 目錄並寫 log。這樣不必動 `_bat-server-helpers.mjs`，因為它不在 affects_files 內。
  - 確認沒有東西經 `.bin` 呼叫：bat-server 與 helper 都直接執行 `bin/node` 或明確的套件路徑；claude-code 另有自己寫的 `bin/claude` wrapper（在 `bin/`，不在 `.bin/`）；`git grep` 在 `electron/` 非測試程式與 4 個 helper 中沒有 `.bin` 用法。
  - 三個 target 共用同一段程式，linux / darwin 都涵蓋。
  - `verify-server-bundle.js` 新增 `findAbsoluteSymlinks()`：解析 `tar -tvzf` 列表，`/` 或 `X:\` 開頭的 symlink 目標即 fail。這項檢查排在解壓之前，所以 Windows 上不會先因建立 symlink 失敗而中斷。
- **8 採「fetch 成功後清理」，不在 verify 擋多版本**：開發者執行 `npm run build` 時不需要手動處理。
  - 只刪符合 `bat-server-(linux-x64|linux-arm64|darwin-arm64)-v<ver>.tar.gz[.sha256]` 且版號不同的檔案，每刪一個檔留一行 log。
  - 同版號的其他 arch 不碰，因為 Linux 打包的 filter 也包含 linux-arm64。
  - 必須等目前版號的 tarball 與 manifest 都到位才清理；`--dry-run` 只報告。刪除失敗只 warn，不中斷。
  - CI 的 dist-baseline 是乾淨的（artifact 只有當版），不受影響。
  - `verify-helper-bundle.js` 未改。
- **9（共用實作）**
  - `src/lib/snapshot-version.ts` 為唯一 SoT，renderer 與 main 都能 import。
  - `scripts/build-version.js` 透過 Node 24 內建的 type stripping 直接 `require('../src/lib/snapshot-version.ts')`，原本那份 regex 刪除，`module.exports` 介面不變。實測 Node 24.21.0 不會印 ExperimentalWarning，`fetch-baseline-tarball.mjs --help` / `--dry-run` 也正常。
  - 檔頭註明此檔只能用可抹除的 TS 語法。
  - distributor 改為 `stripSnapshotSuffix(options.version ?? app.getVersion())`。setup wizard 的 ssh / wsl 兩處都會明確傳入 `window.electronAPI.update.getVersion()`，所以只處理預設值不夠，兩種來源都要處理，renderer 檔不需要改。

### 5. CI 影響說明（pre.5 由塔台觀察）

- **workflows 未改**。`@electron/rebuild` step（`pre-release.yml:202-203`、`release.yml:161-167`）**保留**：
  - 在乾淨的 `npm ci` 上以 `DEBUG=electron-rebuild` 實測，win32-x64 與 linux-x64（WSL）都是 `✔ Rebuild Complete`，**沒有任何模組被重建**。原因是 prod 樹裡已經沒有任何套件在根目錄放 `binding.gyp`；`sharp/src/binding.gyp` 不在根目錄，不會被掃到。
  - darwin-arm64 host 無法實測（optional 平台子套件只會裝在 mac 上），依工單規則不移除，現在等同 no-op 的保險。
- postinstall 已經沒有 `CI` 分支，CI log 不會再出現 `postinstall: CI is set, skipping electron-rebuild of better-sqlite3`。
- server-bundle job：bundle 不再含 `better-sqlite3`，也不再含任何 `.bin/`（log 會出現 `[4] Removed N node_modules .bin dir(s)`）；verify 多了絕對路徑 symlink 檢查。若 darwin 或 linux-arm64 還有其他絕對路徑 symlink，這一步會 fail，而且會列出來，這就是預期的防線。
- installer 會稍微變小：better-sqlite3（含 `.node`）與 19 個專屬相依不再被打包。
- CI 用 npm 11.19.0：`allowScripts` 少一個條目，行為不變（已在 WSL 用 npm 11.19.0 + `CI=true` 跑 `npm ci` 驗證，結尾只有 `electron-winstaller` 的警告）。

### 異動檔案

`package.json`、`package-lock.json`、`scripts/verify-native-modules.js`、`scripts/__tests__/verify-native-modules.test.mjs`、`scripts/build-server-bundle.mjs`、`scripts/verify-server-bundle.js`（維持 CRLF）、`scripts/fetch-baseline-tarball.mjs`、`scripts/__tests__/fetch-baseline-prune.test.mjs`（新）、`scripts/build-version.js`、`src/lib/snapshot-version.ts`（新）、`src/lib/__tests__/snapshot-version.test.ts`（新）、`electron/remote/server-bundle-distributor.ts`、`electron/remote/__tests__/server-bundle-distributor.integration.test.ts`、`CLAUDE.md`、本工單。換行維持各檔原狀（`git ls-files --eol` 核對）。

### 偏離與說明

1. **超出 affects_files 的 3 個檔**：`scripts/build-version.js`、`src/lib/snapshot-version.ts`、`src/lib/__tests__/snapshot-version.test.ts`。追加 9 明確要求「共用實作、避免兩份 regex、附測試」，原本那份 regex 就在 build-version.js，不動它無法只留一份。build-version.js 只改 snapshot 那一段，對外介面不變。
2. **`npm ci` 在 scratchpad 副本執行，不是主工作樹**：主工作樹的 `node_modules` 同時有其他 Worker（T0491 等）在使用，`npm ci` 會先刪掉整個 `node_modules`，會打斷他們的測試或 build。乾淨副本結果等同。因此主工作樹的 `node_modules` 仍留著 extraneous 的 better-sqlite3 及其相依，不會被打包（electron-builder 依 package.json 收集 prod 相依），下次 `npm ci` 會自然清掉。
3. **dist-baseline 只做 `--dry-run`**：舊 tarball 是使用者的本機檔案（約 480 MB），不主動刪除；下一次 `npm run build` / `build:release` 的 `fetch:baseline` 會自動清理。
4. **CI rebuild step 保留**：理由見第 5 節。

### 建議 / 範圍外發現（給 T0493 / 塔台）

1. **CLAUDE.md「Server bundle baseline（PLAN-031）」建議由 T0493 補上**（本單只授權改 better-sqlite3 相關段落）：
   - 「`fetch:baseline` 在目前版號就緒後，會刪除 `dist-baseline/` 內其他版號的 `bat-server-*` tarball / sidecar（T0492）」
   - 「server bundle 不含 `node_modules/**/.bin/`；`verify-server-bundle.js` 擋絕對路徑 symlink（T0492）」
   - 「runtime 下載 fallback 以 `src/lib/snapshot-version.ts` 取基底版號（T0492）」
2. `project-context.md:42`、`:84` 仍寫著「資料庫 better-sqlite3 ^12.5.0 本地持久化」「本地 SQLite 儲存」，與事實不符，建議 T0493 刪除或改寫。
3. `release.yml:161,165` 的 step 名稱是「Rebuild @lydell/node-pty for Electron」，但實際上執行的是全量 `@electron/rebuild`，而 node-pty 是 prebuilt，名稱有誤導。建議日後統一改名為「Rebuild native modules for Electron」，與 pre-release.yml 一致（本單未改 workflow）。
4. `verify-native-modules.js` 的 `INSTALL_SCRIPTS_DOC` 指向 `本機開發：npm 12 install scripts（T0471）`，但 CLAUDE.md 實際標題是「（T0471 / T0473）」。這是既有問題，測試也斷言舊字串，本單未動。
5. `sharp` 是 devDependency，卻被 server bundle 的 `nativePackages` 複製，`build.asarUnpack` 也列了 `@img/**`。這是既有狀況，與本單無關，只記錄。

### Commit

見下方 commit（`git commit --only` 本單檔案）；不 push。

