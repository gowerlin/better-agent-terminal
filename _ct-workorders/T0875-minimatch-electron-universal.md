---
schema_version: 1
schema_kind: workorder
id: T0875
title: "npm audit：electron-builder 工具鏈的 minimatch@9（moderate ×6）評估修正或列為例外"
type: implementation
status: DONE
created_at: "2026-11-17T10:27:04+0800"
started_at: "2026-11-17T10:35:16+0800"
updated_at: "2026-11-17T10:45:16+0800"
completed_at: "2026-11-17T10:45:16+0800"
session_ids:
  - "2ae0df73-e36c-4513-940c-793d2a3b53dd"
repo: better-agent-terminal
priority: P3
sizing: M
depends_on: [T0874]
related:
  - "D298（T0873〈建議後續〉3）；D297；T0873〈npm audit 剩餘項目〉；D057／D136（mac 只打 arm64）"
affects_files:
  - _ct-workorders/T0875-minimatch-electron-universal.md
  - package.json（只限 `overrides`）
  - package-lock.json
  - docs/agent-guide/packaging-release-checks.md（只限記錄 audit 例外或 overrides 理由）
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 不升 `electron-builder`（維持 26.18.0，T0873 已過 W6）、不降版。只允許在 `package.json` `overrides` 加**範圍限定**的項目（例 `\"@electron/universal\": { \"minimatch\": \"…\" }`），不得加會影響其他套件的全域 `minimatch` override；既有 `overrides`（`minimatch@3`、`minimatch@5` 等）不動。"
  - "🔴 判準：修正後 `@electron/universal` 用到的 minimatch API 在新版仍然存在且語意相同（讀 `@electron/universal@2.0.3` 原始碼的每個呼叫點，對照新版 minimatch 的 changelog／匯出），而且本機能驗的關卡全過。任何一點無法確認 → 不修，改把這 6 項記為已接受的 audit 例外（寫明：只在 mac universal 打包時執行、本專案 mac 只打 arm64、上游狀態），寫進 docs。"
  - "🔴 不得觸發 workflow；mac 打包只能由塔台之後派 `desktop-build.yml` 驗證，回報區寫明需要驗什麼。"
  - "🔴 yolo：不得問使用者；問題問塔台。不 push、不發版。Git：只 commit 本單範圍（`git add <明確路徑>`）。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。公開 repo（D176）：回報區不寫真名、客戶名、家目錄路徑（寫 `<使用者資料夾>`）。"
  - "ℹ️ T0873 的驗證方式可沿用（回報區〈環境與驗證方式〉），但若為 server bundle 臨時放入 linux 平台套件，`build:dir` 前一定要刪掉（T0873 發現會污染 Windows 包）。"
---

# T0875 — electron-builder 工具鏈的 minimatch@9：修正或列為例外

## 元資料
- **工單編號**：T0875｜**類型**：implementation｜**狀態**：DONE｜**建立**：2026-11-17 10:27 (UTC+8)
- **規模**：M｜**依賴**：T0874（同一個 checkout，依序執行）｜**決策**：D298

## 背景
T0873 後 `npm audit` 剩 8 項，其中 6 項（moderate）是同一則 GHSA-g3hv-75wg-m249：`electron-builder@26.18.0` → `app-builder-lib`／`dmg-builder` → `@electron/universal@2.0.3` → `minimatch@9.0.9`（受影響範圍 `>=7 <11.0.1`）。npm 給的 fix 是降到 electron-builder 25（不可行）。`@electron/universal` 只在 mac universal 打包時執行，本專案 mac 只打 arm64（D057／D136）。npm 上 `@electron/universal` 最新為 3.0.6（未確認其 minimatch 版本）。

## 任務
1. 確認依賴路徑與 `@electron/universal@2.0.3` 中所有 minimatch 呼叫點（檔案:行、用法）。
2. 查 minimatch 10／11 的破壞性變更（匯出方式、選項、Node 版本要求），判斷能否以 `overrides` 讓 `@electron/universal` 改用已修版。也評估 `@electron/universal` 3.x 是否可經 `overrides` 替換（API 是否與 app-builder-lib 26.18.0 的呼叫相容）；兩者擇風險低的，或都不做。
3. 若修：加範圍限定的 `overrides`、`npm install`（只更新 lock）、跑關卡；確認 `npm audit` 那 6 項消失、沒有新增項目。
4. 若不修：在 `docs/agent-guide/packaging-release-checks.md` 記錄這 6 項為已接受的例外（理由、上游狀態、何時重新檢查，例如 electron-builder 升級時）。

## 關卡
- `npm run typecheck` = 0、`npm run typecheck:electron` = 0
- `npm run test:unit`、`npm run test:legacy`（與 T0873 最終比較）
- `npx vite build`
- `npm run build:dir` ＋ `verify-packaged-native --platform win --arch x64`
- `npm ci` 在最終 lock 上 exit 0，install-scripts 警告與 T0874 後相同

## 驗收條件
- [ ] 呼叫點清單與 API 相容性判斷（附依據）
- [ ] 結論：修（overrides 內容、audit 前後）或列為例外（docs 段落）
- [ ] 關卡不比 T0873 最終差
- [ ] 回報區寫明需要塔台派 `desktop-build.yml` 驗證的項目（若有修）
- [ ] commit 只含本單範圍，不 push

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態
- **結果**：DONE。結論是**不修**：6 項列為已接受的 audit 例外，寫進 `docs/agent-guide/packaging-release-checks.md`。`package.json`／`package-lock.json` 沒有改。關卡都不比 T0873 最終差。
- **session_id**：2ae0df73-e36c-4513-940c-793d2a3b53dd
- **開始／完成**：2026-11-17 10:35 → 10:45（UTC+8）

### 落點檢查
- **PASS**。C-0：frontmatter `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`。C-1：工單在 REPO_ROOT 下。C-3：`package.json`、`package-lock.json`、`docs/agent-guide/packaging-release-checks.md` 都存在。C-2：工單沒有 `branch` 欄位，目前在 `main`。
- `CT_HOME` 未設（不在 worktree）。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只作紀錄）。`CT_MODE=yolo`、`CT_INTERACTIVE=0`。

### 與工單背景不同的發現
- 🔴 這 6 項**不是只**來自 `@electron/universal`。`app-builder-lib@26.18.0` 本身直接依賴 `minimatch` `^10.2.5`（lock 為頂層 `node_modules/minimatch` 10.2.6），也在受影響範圍（`>=7.0.0 <11.0.1`；10.x 沒有修正版，修正版只有 11.0.1 起）。`npm audit` 的 `minimatch` 項目 nodes 同時列了 `node_modules/@electron/universal/node_modules/minimatch` 與 `node_modules/minimatch`；`app-builder-lib` 項目的 via 也直接含 `minimatch`。
- 在暫存目錄複製 `package.json`＋lock，`npm install --package-lock-only` 實測（repo 沒有動）：
  | overrides | audit 結果 |
  |---|---|
  | 現狀 | moderate 6、low 2（共 8） |
  | 只加 `"@electron/universal": { "minimatch@9": "11.0.9" }` | moderate 5、low 2：只少了 `@electron/universal`，`minimatch`／`app-builder-lib`／`dmg-builder`／`electron-builder`／`electron-builder-squirrel-windows` 仍在 |
  | 再加 `"app-builder-lib": { "minimatch@10": "11.0.9" }` | moderate 0、low 2；其他 minimatch 副本（`@electron/asar`、`glob`、`dir-compare` 的 3.1.5，`filelist` 的 5.1.9）不變 |
- 所以要清掉 6 項，必須換掉 **app-builder-lib 在每個平台打包都會用的** minimatch，不只是 mac universal 才用的那份。

### 呼叫點清單
| 套件 | 檔案:行 | 用法 | 何時執行 |
|---|---|---|---|
| `@electron/universal@2.0.3`（`minimatch` `^9.0.3` → 9.0.9） | `dist/cjs/asar-utils.js:60` | `minimatch(file, allowList, { matchBase: true })`（`singleArchFiles` 白名單） | 只在 mac universal 打包：`app-builder-lib/out/macPackager.js:188` `dynamicImport("@electron/universal")` → `makeUniversalApp({ …, singleArchFiles, x64ArchFiles })`。本專案 mac 只打 arm64（D057／D136），不會執行 |
| 同上 | `dist/cjs/index.js:131` | `minimatch(machOFile.relativePath, opts.x64ArchFiles, { matchBase: true })` | 同上 |
| 同上 | `dist/cjs/index.js:241` | `minimatch(plistFile.relativePath, opts.infoPlistsToIgnore, { matchBase: true })` | 同上（app-builder-lib 沒傳 `infoPlistsToIgnore`） |
| （ESM 版 `dist/esm/asar-utils.js:52`、`index.js:105`、`:215` 同上三處） | | | app-builder-lib 用 `dynamicImport`，實際載入依 `exports` 決定 |
| `app-builder-lib@26.18.0`（`minimatch` `^10.2.5` → 10.2.6） | `out/fileMatcher.js:14` | `const minimatchOptions = { dot: true }` | **每個平台**的打包 |
| 同上 | `out/fileMatcher.js:69`、`:76`、`:82` | `new Minimatch(pattern, { dot: true })`（`build.files`／`asarUnpack` 等；無 magic 且不含 `.` 的 pattern 另加 `${pattern}/**/*`） | 同上 |
| 同上 | `out/util/filter.js:7-17` `hasMagic` | 讀 `pattern.set`，以「項目不是字串」判斷有 magic | 同上 |
| 同上 | `out/util/filter.js:54-67` `minimatchAll` | 讀 `pattern.negate`、`pattern.match(path, partial)`（目錄用 partial；巢狀 `…/node_modules` 會補 `/` 再比對，`:46-48`） | 同上 |
- `dmg-builder`、`electron-builder`、`electron-builder-squirrel-windows`、`builder-util` 沒有直接 `require("minimatch")`（grep 確認），audit 是由 `app-builder-lib` 傳遞上去。
- 兩處都沒有設 `optimizationLevel`（grep `app-builder-lib/out`、`@electron/universal/dist/cjs` 皆無）。

### 漏洞觸發條件（GHSA-g3hv-75wg-m249）
- `gh api /advisories/GHSA-g3hv-75wg-m249`：moderate，`>= 7.0.0, < 11.0.1`，修正版 11.0.1。問題在 `firstPhasePreProcess()` 的 `**/..` 展開加上 `secondPhasePreProcess()` 的兩兩比較，「when optimizationLevel >= 2」，且要「attacker who can supply a glob pattern」。
- minimatch 10.2.6 `dist/commonjs/index.js:341-354`、9.0.9 `:338-351`：`optimizationLevel` 預設 `1`；只有 `>= 2` 才呼叫 `firstPhasePreProcess`，`1` 走 `levelOneOptimize`。兩個呼叫端都用預設值 → 有漏洞的路徑走不到。
- pattern 來源是本專案 `package.json` 的 `build` 設定，只在建置主機執行，不會進安裝檔或執行期。

### API 相容性判斷
- **minimatch 11（`@electron/universal` 或 `app-builder-lib` 改用）**：依據 = 上游 `changelog.md`（`gh api repos/isaacs/minimatch/contents/changelog.md`）與 11.0.9 tarball。
  - 仍存在：具名 export `minimatch`、`Minimatch`、`matchBase`、`dot`、`.set`、`.negate`、`.match(path, partial)`；11.0.9 也有 CommonJS `require` 出口。移除的 `makeRe`／`AST`／`debug`／`matchOne`／`slashSplit` 兩個呼叫端都沒用。
  - **語意有變**，而且正好是 app-builder-lib 用到的部分：
    1. `Minimatch.set` 的項目改成「字串、`Matcher` 物件或 `GLOBSTAR`」（原本是字串或 `RegExp`）。app-builder-lib 的 `hasMagic` 依賴「不是字串 = 有 magic」；11 另外把 100 個以上值的數字 brace 當成一個 portion。
    2. 含 `**` 的 `partial` 比對修正（10.2.3 起在 dot portion 底下與以最後一段結尾的路徑判斷錯誤）。app-builder-lib 對目錄一律用 partial。
    3. 空的路徑段（`a/b/`）只符合空的 pattern 段，`a/b/` 不再符合 `a/b/?(x)`／`a/b/*(x)`。app-builder-lib 會在巢狀 `node_modules` 後補 `/`；`build.files` 用了 `!(…)` extglob 與 `{,/**}`。
    4. Windows 上 `..`、UNC 路徑的比對規則變更。
    5. engines 從 `18 || 20 || >=22` 變成 `20 || >=22`（CI 是 Node 24，本機 Node 26，這點沒問題）。
  - `@electron/universal` 的三處 `minimatch(…, { matchBase: true })`：API 在 9/10/11 都存在。抽測 `*.node`、`Info.plist`、`a/**/*.node`、非符合路徑：10.2.6 與 11.0.9 結果相同（9.0.9 在暫存目錄缺 `brace-expansion` 沒測到）。但同樣受上面 2、4 的語意變更影響，而且 mac universal 在本機無法驗。
  - 輔助實測（不能當證明）：寫一個腳本照 app-builder-lib 的 `computeParsedPatterns`／`hasMagic`／`minimatchAll` 邏輯，用本專案 `build.files`（`${os}`／`${arch}` 展開）走真實的 `dist`／`dist-electron`／`assets`／`node_modules`，比較 10.2.6 與 11.0.9：win-x64 910 檔、linux-x64 911、linux-arm64 902、mac-arm64 911，四個目標兩版結果**完全相同**（only10 = only11 = 0）；每個 pattern 的 `hasMagic`／`negate`／`set.length` 也相同。不過這只模擬了本專案的 pattern，沒有包含 electron-builder 的預設排除與 node module collector，也不能證明一般情況下語意相同。
- **`@electron/universal` 3.x 經 overrides 替換**：3.0.6 改用 Node `path.matchesGlob`（`dist/file-utils.js:37`，自己做 matchBase；Node glob 與 minimatch 的語意不同），沒有 minimatch 依賴；ESM-only（`type: module`、`exports: ./dist/index.js`）、engines `node >=22.12.0`、依賴 `@electron/asar` `^4.0.0`（另一個 major）。`makeUniversalApp` 的選項名稱（`x64AppPath`／`arm64AppPath`／`outAppPath`／`force`／`mergeASARs`／`singleArchFiles`／`x64ArchFiles`／`infoPlistsToIgnore`）與 app-builder-lib 26.18.0 的呼叫相容，`dynamicImport` 也能載 ESM。但 app-builder-lib 26.x 釘 `2.0.3`（不是範圍），換成 3.x 只能在 mac universal 實機驗，而本專案根本不打 universal；而且只換它只少 1 項（見上表）。
- **判定**：依本單判準「語意相同」無法確認（changelog 明列語意變更），所以兩個做法都不做。

### 結論：列為已接受的例外（不修）
- 不加任何 `overrides`、不升降 electron-builder。`package.json`／`package-lock.json` 未改，`npm audit` 仍為 moderate 6、low 2（與 T0873 最終相同、沒有新增）。
- docs 段落：`docs/agent-guide/packaging-release-checks.md`〈Packaging / Release 前置檢查〉清單最後新增「**npm audit 已接受的例外：electron-builder 工具鏈的 minimatch**（T0875 / D298）」，內容：6 項名稱、兩處來源與呼叫點（含只蓋 ② 只少 1 項的實測）、為什麼接受（`optimizationLevel` 預設 1、pattern 來自本專案設定、只在建置主機）、為什麼不用 overrides（11 的語意變更、universal 3.x 的差異）、上游狀態、何時重新檢查（升 electron-builder、mac 改 universal、新增 `optimizationLevel` 或讓外部輸入成為打包 pattern）。
- 上游狀態（`npm view`）：`electron-builder` dist-tags：latest 26.18.0、v26 26.18.1、next 27.0.0-alpha.14。app-builder-lib 26.18.1 與 27.0.0-alpha.14 的 `minimatch` 都還是 `^10.2.5`；27 alpha 的 `@electron/universal` 改成 `^3.0.6`。也就是說上游任何一條線目前都沒有修掉 ①。

### 環境與驗證方式
- Node v26.13.1、npm 12.2.2、Windows x64。`BAT_HELPER_LOG_DIR`／`BAT_USER_DATA` 指到暫存目錄。
- 沒有放入 linux 平台套件（沒有打 server bundle，本單不需要）；`build:dir` 前確認 `node_modules/@lydell`、`node_modules/@anthropic-ai` 只有 win32 平台套件，打包沒有被污染。
- 第一次啟動關卡時發現沒設 `BAT_USER_DATA`，在 `npm ci` 階段就停掉重跑；確認舊的 `npm ci` 程序已結束後才重新開始。
- minimatch 9.0.9／10.2.6／11.0.9、`@electron/universal` 3.0.6 都是 `npm pack` 到暫存目錄讀，比對腳本也放暫存目錄，repo 沒有因此改變。

### 關卡結果
| 關卡 | 結果 | 與 T0873 最終比較 |
|---|---|---|
| `npm ci`（最終 lock，與 T0874 後同一份） | exit 0，added 745 packages；install-scripts 警告只有 `electron-winstaller@5.4.0 (install: node ./script/select-7z-arch.js)` | 與 T0873／T0874 相同 |
| `npx vite build` | exit 0 | 相同 |
| `npm run typecheck` | exit 0 | 相同 |
| `npm run typecheck:electron` | exit 0 | 相同 |
| `test:unit`（vitest json reporter） | 第一次：8396 個，8252 passed / 1 failed / 143 skipped，10 個檔案標 failed，全是並行負載下的逾時（`headless-*` 6 檔的 `Hook timed out in 10000ms`、`local-helper-capability`、`terminal-query-handlers`、`tower-questions`、`helper-connection-hygiene` #9），與 T0873 基準／T0874 第一次記錄的 flaky 同一組。這 10 檔單獨重跑：218/218 passed。第二次全量：**8354 passed / 0 failed / 42 skipped** | 與 T0873 最終完全相同 |
| `npm run test:legacy` | 33 檔／472 tests 全過 | 相同 |
| `npm run build:dir` | exit 0 | 相同 |
| `verify-packaged-native --platform win --out release --arch x64` | exit 0，`✅ every windows package passed (x64)`（embedded claude PE 0x8664、no server bundle baseline、8 runtime packages / 15 with dependencies、6 runtime helpers、helper version 0.7.5-pre.1、PTY holder matches manifest、stdio-inheritance addon loads） | 相同 |
| `npm audit` | moderate 6、low 2（共 8） | 相同、沒有新增 |

### 需要塔台派 `desktop-build.yml` 驗證的項目
- **無**。本單沒有改依賴或打包設定，mac／linux 打包行為不變。T0873〈建議後續〉1 原本要驗的項目（electron-builder 26.18.0 三平台打包、`windows-upgrade-acceptance.yml`）照舊，與本單無關。

### 變更檔案
- `docs/agent-guide/packaging-release-checks.md`：新增 audit 例外段落（6 行）
- `_ct-workorders/T0875-minimatch-electron-universal.md`：本回報

### Commit
- `83325f9b` docs: record minimatch audit exception for electron-builder toolchain (T0875)
- 工單本身另外一個 commit。都**沒有 push**，沒有觸發任何 workflow。

### 遭遇問題
- 本機 Bash 工具的 heredoc 與 `node -e` 會吃掉反斜線，比對腳本改用檔案寫入；與本單結論無關。
- 第一次啟動關卡漏設 `BAT_USER_DATA`，已停掉重跑（見〈環境與驗證方式〉）。

### 建議後續（給塔台）
1. 升 electron-builder 時，看 `app-builder-lib` 的 `minimatch` 範圍是否到 `>=11.0.1`，到了就重跑 `npm audit` 並更新 docs 那段（docs 已寫明）。
2. 若日後仍想清掉這 6 項而不等上游：可行的 overrides 是 `"@electron/universal": { "minimatch@9": "11.0.9" }`＋`"app-builder-lib": { "minimatch@10": "11.0.9" }`（暫存 lock 實測 6 → 0），但會改變每個平台的 `build.files` 過濾語意，需另開工單：至少三平台 `desktop-build.yml` 打包，並比對各平台 `app.asar`／`app.asar.unpacked` 的檔案清單與現況完全相同。本單判準不允許，所以沒做。

### 互動紀錄
- 無（yolo；沒有向塔台提問）。
