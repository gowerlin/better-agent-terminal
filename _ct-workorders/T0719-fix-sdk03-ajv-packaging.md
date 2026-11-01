---
schema_version: 1
schema_kind: workorder
id: T0719
title: "BUG-176：Agent SDK 0.3 後 ajv / ajv-formats 不在安裝檔（mac 打包驗證失敗）—— 修正並補本機守門，讓 0.7.2-pre.5 可重發"
type: implementation
status: DONE
repo: better-agent-terminal
project: maintenance
priority: P1
sizing: S
created_at: "2026-11-01T09:12:39+0800"
started_at: "2026-11-01T09:14:23+0800"
updated_at: "2026-11-01T09:23:01+0800"
completed_at: "2026-11-01T09:23:01+0800"
target_version: "0.7.2-pre.5"
depends_on: []
related:
  - "BUG-176（塔台初判寫在單內：SDK 0.3.316 沒有 `dependencies`，`@modelcontextprotocol/sdk` 等改為 peer，ajv 掉出 production 相依樹）"
  - "CI：pre-release.yml run 41259467662（0.7.2-pre.5，target a3a74762）`build (macos-latest, mac)` → `Verify packaged native binaries (macOS arm64)`：`ajv`、`ajv-formats (required by dist-electron/sdk-CzVYtfWT.js)` missing from app.asar / app.asar.unpacked；linux / win build 被取消，release skipped，未建 tag"
  - "T0718（SDK 0.3 升版；回報區「打包與 server bundle」認為 chunk 裡的 ajv require 是 codegen 字串、`asar-runtime-deps.test.mjs` 通過）"
  - "CLAUDE.md「Packaging / Release 前置檢查」：安裝檔瘦身白名單（T0546）、`asar-runtime-deps.test.mjs`、`DYNAMIC_REQUIRE_SITES`、`verify-packaged-native.js` 的 `runtime-require`；🔴 不得使用 `build.<platform>.files`"
affects_files:
  - package.json
  - package-lock.json
  - scripts/verify-packaged-native.js
  - scripts/__tests__/
  - CLAUDE.md
  - docs/agent-guide/packaging-release-checks.md
  - _ct-workorders/T0719-fix-sdk03-ajv-packaging.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 先查清楚再改（附證據）：① electron-builder 實際收進安裝檔的 node_modules 範圍是怎麼決定的（production 相依樹 + `build.files` 白名單），為什麼 v0.7.2-pre.4 有 ajv、T0718 後沒有；② `dist-electron` 的 SDK chunk 對 `ajv` / `ajv-formats` 的 require 在執行期會不會真的被呼叫（只是 codegen 字串，還是真的 require）；③ SDK 0.3 改成 peer 後，除了 ajv / ajv-formats，還有沒有其他原本靠 SDK 0.2 `dependencies` 進入 production 樹、而 main / headless 執行期會用到的套件（`@anthropic-ai/sdk`、`@modelcontextprotocol/sdk`、`zod` 與其閉包都要看）。"
  - "✅ 授權的修法（塔台推薦，D193）：把執行期需要、或打包檢查要求的套件**明確加進 `package.json` `dependencies`**（版本沿用 lock 現有的，例如 `ajv` 8.18.0、`ajv-formats` 3.0.1，寫 `^`），讓它們回到 production 相依樹；lock diff 只能是 root `dependencies` 增列與相關旗標，不得升任何套件版本。若 ② 證明完全不會 require，仍以加進 dependencies 為主（保守、與 pre.4 的安裝檔內容一致），不要改成在檢查腳本裡豁免；若你認為豁免才對，先用 BAT 通道問塔台。"
  - "🔴 補本機守門：T0718 的 `asar-runtime-deps.test.mjs` 只驗白名單 matcher，沒驗 production 相依樹，所以本機過、CI 打包才失敗。補一個本機就能跑的檢查（測試或擴充既有測試）：`dist-electron` 需要的每個外部套件都要在 production 相依樹內（以 lock 的 root `dependencies` 閉包計算，排除 dev / peer-only），並在本單修正前先確認它會失敗、修正後通過（反向測試）。新測試放 vitest 收得到的位置（`scripts/__tests__/`）。"
  - "🔴 實際打包驗證（必做）：`npx vite build` 後 `npx electron-builder --win --dir`（或專案既有的 `build:dir` 腳本），再跑 `node scripts/verify-packaged-native.js --platform win --out release --arch x64`，修正前失敗、修正後 exit 0（附輸出）。打包不簽章、不上傳；不得改動 `release/` 以外的產物位置；不碰使用者正在用的 BAT。VS Code Insiders 可能鎖 `release\\win-unpacked\\resources\\app.asar`（L136），遇到就換輸出目錄或回報。"
  - "🔴 驗證：`npm run test:unit` 全綠；`npm run test:legacy` 全綠；`npx vite build` exit 0；`npm run typecheck` = 0、`npm run typecheck:electron` = 0；`node scripts/verify-native-modules.js` exit 0；`npm run verify:helpers` exit 0；`asar-runtime-deps.test.mjs` 在 vite build 後實際執行。`TMP` 用系統預設（T0716）。"
  - "🔴 工作區有塔台未 commit 的發版文件（`CHANGELOG.md`、`README.md`、`release-note.md`、`_ct-workorders/_bug-tracker.md`、`_ct-workorders/BUG-176-*.md`），**不得修改或 commit 它們**；只用 `git commit --only <本單檔案>`。`package.json` 的 `version` 欄位不動（塔台發版時處理）。"
  - "🔴 文件：CLAUDE.md「Packaging / Release 前置檢查」安裝檔瘦身那一條補一句：新增執行期依賴時除了白名單，還要確認它在 production 相依樹內（peer-only 不會被打包），並指向新守門；`docs/agent-guide/packaging-release-checks.md` 同步細節。CLAUDE.md 不得超過 100k 字元目標。"
  - "🔴 Git：`git commit --only <檔案>`；不 push、不觸發 workflow、不建 tag。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF；含反斜線的內容用 Write／Edit 工具寫（L129）。`gh` 一律帶 `-R gowerlin/better-agent-terminal`（L122），可唯讀查 run 41259467662 的 log。"
  - "🔴 公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」：回報裡的路徑用 repo 相對路徑或 `<使用者資料夾>`。yolo：不得問使用者，判讀問題問塔台。"
---

# T0719 — BUG-176：SDK 0.3 後 ajv 不在安裝檔

## 背景

- 使用者 2026-11-01 指示發 `0.7.2-pre.5`；塔台聯合驗證（unit 6203 / legacy 472 / build）全綠後觸發 `pre-release.yml`（run 41259467662）。
- `build (macos-latest, mac)` 的 `verify-packaged-native` 失敗：`ajv`、`ajv-formats`（required by `dist-electron/sdk-CzVYtfWT.js`）不在 app.asar / app.asar.unpacked；其他平台 build 被取消，release skipped，**沒有建 tag**，修好後以同一版號重發。
- 塔台初判（見 BUG-176）：SDK 0.3.316 沒有 `dependencies`，原本經 `@modelcontextprotocol/sdk` 帶進 production 樹的 ajv 只剩 peer 路徑；本機 `node_modules/ajv` 還在、白名單也有，所以 T0718 的本機測試沒抓到。

## 實作

1. 查清楚 `memory_overrides` 第 1 條三點並附證據。
2. 先寫守門（第 3 條），確認修正前失敗。
3. 修正：缺的執行期套件加進 `dependencies`（第 2 條）。
4. 本機 Windows 打包 + `verify-packaged-native`（第 4 條），修正前後各一次。
5. 文件（第 7 條）；全套驗證（第 5 條）。

## 驗收

- [x] 原因與三點查證有證據；列出所有補進 `dependencies` 的套件與理由
- [x] 新守門：修正前失敗、修正後通過
- [x] 本機 `electron-builder --win --dir` 後 `verify-packaged-native.js --platform win` exit 0（附修正前失敗輸出）
- [x] lock diff 只有 root `dependencies` 增列與旗標，沒有任何版本變動
- [x] `npm run test:unit`、`npm run test:legacy` 全綠；`npx vite build` exit 0；兩個 typecheck = 0；`verify-native-modules` / `verify:helpers` ✅
- [x] CLAUDE.md / docs 已補；回報區列出 mac / Linux 需由重發的 CI 確認

---

## 回報區

### 待塔台決策（僅 yolo Worker 有問題時）

無（沒有提問）。

### 完成狀態

**DONE** —— 驗收 6 項 Worker 範圍全部通過。mac / Linux 的安裝檔要等重發 `0.7.2-pre.5` 的 CI（`build (macos-latest, mac)` / `build (ubuntu-24.04, linux)` 的 `verify-packaged-native`）確認；本機只能打 Windows。

落點檢查：**PASS**。C-0 `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`（REPO_ROOT = repo 根目錄，主 checkout，`CT_HOME` 未設 → 不在 worktree）；C-1 工單在 REPO_ROOT 內；C-3 `affects_files` 全部存在（資訊性）；C-2 無 `branch` 欄位。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）。`CT_MODE=yolo`、`CT_INTERACTIVE=0`。

### 原因查證

**① electron-builder 收哪些 node_modules，為什麼 pre.4 有 ajv、T0718 後沒有**

- electron-builder 26.8.1 的 `NpmNodeModulesCollector`（`node_modules/app-builder-lib/out/node-module-collector/npmNodeModulesCollector.js`）執行 `npm list -a --include prod --include optional --omit dev --json --long`，建 production graph 時只走 `isProdDependency(packageName, tree)` = `tree._dependencies[packageName] != null`。`_dependencies` 是 package.json 的 `dependencies` / `optionalDependencies`，**不含 `peerDependencies`**。`build.files` 白名單是在這個集合上**過濾**，本身不會把套件加進來。
- 本機實測（修正前）`npm list` 輸出：`@anthropic-ai/claude-agent-sdk` 的 `_dependencies` 只有 8 個 `claude-agent-sdk-<platform>` 套件；`dependencies`（子節點）有 `@anthropic-ai/sdk` / `@modelcontextprotocol/sdk` / `zod`，但它們只在 `peerDependencies` 裡，collector 會跳過。root 的 `_dependencies` 沒有 `ajv`。
- lock 比對（`git show v0.7.2-pre.4:package-lock.json`）：pre.4 的 SDK `0.2.113` 有 `dependencies: { "@anthropic-ai/sdk": "^0.81.0", "@modelcontextprotocol/sdk": "^1.29.0" }`；現行 `0.3.316` 沒有 `dependencies`，三者都只在 `peerDependencies`。`@modelcontextprotocol/sdk` 1.29.0 的 `dependencies` 才有 `ajv` / `ajv-formats`，所以 ajv 以前經 SDK → MCP SDK 進入 production 樹，現在掉出去。
- 以 lock 計算 production 閉包（root `dependencies` + `optionalDependencies`，只走 `dependencies` / `optionalDependencies`）：pre.4 342 個 → 修正前 250 個，少了 92 個（`@anthropic-ai/sdk`、`@modelcontextprotocol/sdk`、`zod`、express / hono 一系列、ajv 一系列等），沒有新增的。
- 本機 Windows 重現：修正前打包，`verify-packaged-native` 報同樣的 `ajv` / `ajv-formats` 缺失（見〈打包驗證〉）。CI run 41259467662：`build (macos-latest, mac)` failure、linux / win cancelled、release skipped；三個 `server-bundle` job 都 success。

**② `dist-electron` SDK chunk 對 ajv 的 require 在執行期會不會真的呼叫**

- 不會，它們是 ajv codegen 用的字串。`dist-electron/sdk-CzVYtfWT.js` 的 bare `require("ajv…")` 共 5 個，全部是字串或 codegen template：`t.code='require("ajv/dist/runtime/equal").default'`、`…/ucs2length`、`…/uri`，`scopeValue("Error",{ref:…,code:t._\`require("ajv/dist/runtime/validation_error").default\`})`，以及 ajv-formats 的 `opts.code.formats = n._\`require("ajv-formats/dist/formats")…\``。ajv 本體（CodeGen、規則、formats）已被 rollup 打包進這個 chunk；正常 compile 時，scope 值是用 `ref` 傳給產生的函式，`code` 字串只有在 standalone 輸出（`opts.code.source` / `standaloneCode`）才用到，MCP SDK 的 `ajv-provider.js` 沒有開。
- 不過 `scanExternalRequires` 分不出字串與呼叫，`verify-packaged-native` 一律要求它們在安裝檔內。依 D193 仍加進 `dependencies`（保守，與 pre.4 安裝檔內容一致），沒有在檢查腳本豁免，所以不需要問塔台。

**③ 還有沒有其他靠 SDK 0.2 `dependencies` 進來、而執行期會用到的套件**

- 沒有，只有 `ajv` / `ajv-formats`（連同閉包 `fast-deep-equal` / `fast-uri` / `json-schema-traverse` / `require-from-string`）。
- main：建置後掃描 `dist-electron` 的外部 require，只有 `@lydell/node-pty`、`ws`、`opencc-js`、`@anthropic-ai/claude-code`、`ajv`、`ajv-formats`；`dynamicRuntimePackages()`（claude-code、`@openai/codex-<platform>-<arch>`、whisper）與 vite externals 也都在 production 樹內。修正前只缺 ajv / ajv-formats。`@anthropic-ai/sdk`、`@modelcontextprotocol/sdk`、`zod` 已被 rollup 打包進 `dist-electron`，原本就不進 asar（既有測試 `drops what the main process never loads` 守住）。少掉的 92 個裡，白名單有保留的只有 ajv 這 6 個，其他在 pre.4 也沒打包。
- electron/ 原始碼只 import `@anthropic-ai/claude-agent-sdk`（主入口，`claude-agent-manager.ts`），沒有直接 import `@modelcontextprotocol/sdk` / `zod` / `@anthropic-ai/sdk`。
- headless（server bundle）：`build-server-bundle.mjs` 依 `nativePackages` 逐目錄複製，不看 production 樹，不受影響。SDK 0.3 主入口 `sdk.mjs` 的 import 只有 Node 內建模組；peer 的 import 只出現在 `core.mjs`（`@modelcontextprotocol/sdk/server/*`、`zod/v4`），BAT 沒有用 `/core`。CI run 41259467662 的三個 server-bundle job 都 success。

### 修正

- `package.json` `dependencies` 新增 `"ajv": "^8.18.0"`、`"ajv-formats": "^3.0.1"`（版本沿用 lock：ajv 8.18.0、ajv-formats 3.0.1）。只加這兩個：`fast-deep-equal` / `fast-uri` / `json-schema-traverse` / `require-from-string` 是 ajv 自己的 `dependencies`，會跟著回到 production 樹。
- `package-lock.json`：diff 只有 root `packages[""].dependencies` 增加這兩行，沒有任何版本、`resolved`、`integrity` 或旗標變動。`npm install --package-lock-only --ignore-scripts --dry-run` 回 `up to date`；`npm ls ajv ajv-formats --omit dev` 顯示兩者已直接掛在 root 底下。
  - 說明：先試過 `npm install --package-lock-only`（npm 12.2.1），它除了 root 增列，還重算了全檔與本單無關的 `peer` / `optional` / `license` 旗標（例如 babel、`@anthropic-ai/sdk`），約 98 行，沒有版本變動。為了符合「只有 root 增列」，改用備份的 lock 只手動加兩行。下一次有人跑 `npm install` 時，lock 仍可能出現同樣的旗標重算，那不是本單造成的。
- `scripts/verify-packaged-native.js`：`runtime-require` 的訊息與提示多一句 production 相依樹的說明（peer-only 不打包、要加進 `dependencies`、本機用 `asar-runtime-deps.test.mjs` 檢查），檔頭 C4 說明同步。檢查邏輯不變。
- `CLAUDE.md`「Packaging / Release 前置檢查」的安裝檔瘦身那一條補一句：要確認套件在 production 相依樹內，peer-only 不打包，並指向守門。`docs/agent-guide/packaging-release-checks.md` 新增「production 相依樹」小節（collector 機制、BUG-176 實例、ajv 字串的判讀、守門內容、`npm ls` 檢查方法）。CLAUDE.md 51,971 → 52,151 字元（目標 ≤ 100k）。

### 守門

`scripts/__tests__/asar-runtime-deps.test.mjs` 新增 describe「runtime packages are in the production dependency tree (T0719 / BUG-176)」，以及 `productionTree(lockfile)` / `missingFromProductionTree()`。它從 lock 的 root `dependencies` + `optionalDependencies` 出發，只走 `dependencies` / `optionalDependencies`，巢狀副本優先，與 electron-builder collector 走的邊相同。共 8 個測試：

1. 合成 lock 單元測試：釘住「peer / dev 邊不走、巢狀副本優先」，讓守門本身有反向案例。
2. 三平台：vite externals、`dynamicRuntimePackages()`、claude-code / node-pty 平台 binary 套件都在 production 樹內。
3. 三平台：白名單保留、lock 沒標 `dev` 的每個頂層套件都在 production 樹內。這項**不需要 build**，所以 CI `tests.yml`（沒有 vite build）也抓得到 BUG-176。
4. build 後：`dist-electron` 掃到的每個套件都在 production 樹內。

反向測試：

- 修正前：`Tests 4 failed | 27 passed (31)`。白名單那項 ×3 報 `whitelisted but not in the production dependency tree (add to package.json dependencies): ajv, ajv-formats, fast-deep-equal, fast-uri, json-schema-traverse, require-from-string`；dist-electron 那項報 `ajv, ajv-formats`。
- 修正後：`Tests 31 passed (31)`。vite build 之後以 verbose 執行，8 個 T0719 測試都 ✓，沒有 skip。

### 打包驗證

指令：`npm run build:dir -- --win`（= clean dist-electron → verify-native-modules → verify-helper-bundle → verify-renderer-imports → vite build → `electron-builder --dir --win`，`CSC_IDENTITY_AUTO_DISCOVERY=false`）。接著跑 `node scripts/verify-packaged-native.js --platform win --out release --arch x64`。輸出在 `release/win-unpacked`；`Get-AuthenticodeSignature release\win-unpacked\BetterAgentTerminal.exe` = `NotSigned`（日誌的 `signing with signtool.exe` 只是字樣），沒有上傳。這次沒有遇到 app.asar 被鎖。

- **修正前**：build exit 0，verify **exit 1**：
  ```
  [verify-packaged-native] ❌ win x64: 2 runtime package(s) missing from app.asar / app.asar.unpacked (node_modules whitelist in package.json build.files, T0546 C4)
        ajv (required by dist-electron/sdk-CzVYtfWT.js)
        ajv-formats (required by dist-electron/sdk-CzVYtfWT.js)
  ```
- **修正後**：build exit 0，verify **exit 0**：
  ```
  [verify-packaged-native] ✅ win x64: embedded claude <repo>\release\win-unpacked\resources\app.asar.unpacked\node_modules\@anthropic-ai\claude-code\bin\claude.exe (PE machine 0x8664), no server bundle baseline, 8 runtime package(s) / 15 with dependencies, 6 runtime helper(s) in resources/scripts, helper version 0.7.2-pre.4
  [verify-packaged-native] ✅ every windows package passed (x64)
  ```
- mac（arm64 dmg）與 Linux（AppImage）沒有在本機打包，**需由重發 `0.7.2-pre.5` 的 CI 確認**。lock 的 production 閉包與平台無關，守門的 mac / linux 項目已通過。

### 驗證證據

| 項目 | 結果 |
|---|---|
| `npm run test:unit` | ✅ 347 files passed；6211 passed / 3 skipped（6214）；exit 0。比塔台基線 6203 多的 8 個 = 本單新測試 |
| `npm run test:legacy` | ✅ files 33 passed / 0 failed；tests 472 passed / 0 failed；exit 0 |
| `npx vite build` | ✅ exit 0（單獨執行一次；`build:dir` 內含的 vite build 也是 exit 0） |
| `npm run typecheck` | ✅ exit 0（0 errors） |
| `npm run typecheck:electron` | ✅ exit 0（0 errors） |
| `node scripts/verify-native-modules.js` | ✅ exit 0（All 2 required native modules present … embedded claude: native） |
| `npm run verify:helpers` | ✅ exit 0（6 runtime helpers, same set as the server bundle） |
| `asar-runtime-deps.test.mjs`（vite build 後） | ✅ 31/31，dist-electron 項目實際執行（沒有 skip） |
| `electron-builder --win --dir` + `verify-packaged-native --platform win` | ✅ 修正後 exit 0（修正前 exit 1） |
| lock diff | ✅ 只有 root `dependencies` +2 行 |
| 行尾 | ✅ `git ls-files --eol`：6 個檔案都是 `i/lf w/lf` |

`TMP` 用系統預設。

### 遭遇問題

- `docs/agent-guide/packaging-release-checks.md` 第一次插入時，把原句的「動態 require 盲點」擠到新子項目後面，commit 前已移回原位置（原行內容不變，diff 只有 +4 行）。這是在 unit / legacy 背景測試期間修的，只動 docs，不影響測試結果。
- validation 是在 HEAD `50d9e3e7` 加上未 commit 的變更上執行。產品 commit `59ef7f37` 的內容與驗證時相同，差別只有上面那處 docs 位置調整，所以沒有重跑。

### 互動紀錄

無（yolo，沒有提問；沒有使用者介入）。

### Commit

- 產品：`59ef7f37` `fix: pack ajv / ajv-formats again after Agent SDK 0.3 (T0719 / BUG-176)`（以 `git commit --only` 提交 6 個檔案：`package.json`、`package-lock.json`、`scripts/__tests__/asar-runtime-deps.test.mjs`、`scripts/verify-packaged-native.js`、`CLAUDE.md`、`docs/agent-guide/packaging-release-checks.md`）
- 工單：本檔另以 `git commit --only` 提交
- 塔台未 commit 的 `CHANGELOG.md` / `README.md` / `release-note.md`（以及 `_bug-tracker.md` / `BUG-176-*.md`）沒有動，也沒有 commit；`package.json` 的 `version` 沒有改。沒有 push、沒有觸發 workflow、沒有建 tag。

### 後續建議（給塔台）

- 重發 `0.7.2-pre.5` 時看 mac / linux / win 三個 build job 的 `Verify packaged native binaries`。
- 日後若有人跑 `npm install`，lock 可能出現 npm 12 的 `peer` 旗標重算（約 98 行、沒有版本變動）。要不要另開工單一次收掉，由塔台決定。

### 回報時間

"2026-11-01T09:23:01+0800"
