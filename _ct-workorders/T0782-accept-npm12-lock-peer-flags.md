---
schema_version: 1
schema_kind: workorder
id: T0782
title: "接受 npm 12 重算 lock 帶出的 `peer` 旗標變更（約 100 項，版本不變），先確認打包閉包與 CI `npm ci` 不受影響"
type: implementation
status: DONE
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: S
created_at: "2026-11-02T14:28:11+0800"
started_at: "2026-11-02T14:29:52+0800"
updated_at: "2026-11-02T14:34:51+0800"
completed_at: "2026-11-02T14:34:51+0800"
session_ids:
  - "1af9b89a-187e-485b-b5cd-531e2750ad4a"
depends_on: []
related:
  - "T0779〈遭遇問題〉與〈後續建議〉（在 HEAD 重現：npm 12.2.1 對 HEAD 的 `package.json` ＋ lock 跑 `npm install --package-lock-only --ignore-scripts` 產生 100 項只有 `peer` 旗標翻轉、0 項版本變更）；D222"
  - "CLAUDE.md「Packaging / Release 前置檢查」節的安裝檔瘦身（T0546）與 T0719 / BUG-176（electron-builder 只沿 `dependencies` / `optionalDependencies` 收集，peer-only 不打包；`scripts/__tests__/asar-runtime-deps.test.mjs` 讀 lock 的 production 閉包）；「本機開發：npm 12 install scripts」節（npm 12 本機 / CI 版本差異）；`docs/agent-guide/npm12-install-scripts.md`"
affects_files:
  - package-lock.json
  - _ct-workorders/T0782-accept-npm12-lock-peer-flags.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 做法：在 HEAD（T0779 之後）跑 `npm install --package-lock-only --ignore-scripts`（npm 12），`git diff package-lock.json` 只允許 `\"peer\": true` 行的新增 / 刪除；任何 `version` / `resolved` / `integrity` / 新增或移除套件 → 停下回報 PARTIAL（列出 diff），不 commit。記錄筆數與受影響套件清單（分成「加上 peer」「去掉 peer」兩組）。"
  - "🔴 先查影響再 commit：① 加上 `peer: true` 的套件裡，有沒有安裝檔白名單（`build.files`）或 `asar-runtime-deps.test.mjs` 的執行期依賴（特別是 `@anthropic-ai/sdk`、`@modelcontextprotocol/sdk`、`zod` 等 T0719 相關套件）；② 讀 `asar-runtime-deps.test.mjs` 怎麼從 lock 算 production 閉包，判斷 `peer` 旗標會不會改變結果；③ `npx vite build` 後跑 `npx vitest run scripts/__tests__/asar-runtime-deps.test.mjs`（新 lock）全綠；④ `npm run build:dir` ＋ `node scripts/verify-packaged-native.js --platform win --out release --arch x64` 綠（`runtime-require` 檢查）；⑤ CI 用 `actions/setup-node` node 24 附的 npm（不是 npm 12）跑 `npm ci`：在 scratch 副本用該版 npm（例 `npx npm@<CI 版本> ci --ignore-scripts --dry-run`，版本以 node 24 附帶的 npm 為準並寫明怎麼查到）確認接受新 lock，且 npm 11 不會因此重寫或報錯。任一項失敗或結果改變 → 停下回報 PARTIAL，不 commit。"
  - "🔴 驗證：`npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npm run test:unit` 全綠（`electron/__tests__/worktree-status-after-close.test.ts` 若在全套負載下逾時，單檔重跑並記錄；這是已知觀察，不算本單失敗）。不跑 e2e（lock 中繼資料變更、不改版本）。"
  - "🔴 不改：`package.json`、任何套件版本、`allowScripts`。不跑 `npm install` 的完整安裝以外的 dedupe / audit fix / update。"
  - "🔴 文件：若查證結果值得留給下一個人（例：「npm 12 會把 X 類套件標 peer，對打包沒有影響，原因是…」），在回報區寫清楚，並建議塔台是否補一行到 `docs/agent-guide/npm12-install-scripts.md`；本單不直接改 docs。"
  - "🔴 不發版、不改 CHANGELOG、不 push。公開 repo 去識別化（D176）。yolo：不得問使用者；判讀問題依 ct-exec § Questions For Tower 問塔台。Git：只用 `git commit --only` commit 本單範圍；同一 checkout 有 T0781 並行（只研究、不改 lock），不得碰它的檔案。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
---

# T0782 — 接受 npm 12 的 lock `peer` 旗標變更

## 元資料

- **工單編號**：T0782
- **類型**：implementation（lock 中繼資料）
- **優先級**：P2
- **建立時間**：2026-11-02T14:28:11+0800
- **預估規模**：S

## 背景

T0779 升 Electron 時發現：npm 12 重算 `package-lock.json` 會另外翻轉約 100 項套件的 `peer` 旗標，版本、下載位置、雜湊都不變；在 HEAD 不改任何東西也會重現，與 electron 無關。T0779 依工單規定沒有寫入，但之後每張改相依的工單都會碰到。塔台建議先查證對打包與 CI 沒有影響，再一次接受（D222）。

## 範圍

1. 重算 lock，確認只有 `peer` 旗標變更。
2. 查證打包閉包（白名單、`asar-runtime-deps.test.mjs`、`verify-packaged-native`）與 CI `npm ci` 不受影響。
3. 驗證後 commit lock。

## 不做

- 不改任何套件版本或 `package.json`；不改 docs（只在回報區建議）。

## 驗收

- [x] diff 只有 `peer` 旗標（筆數、兩組清單）
- [x] 打包閉包影響分析與 `asar-runtime-deps.test.mjs` 綠
- [x] `build:dir` ＋ `verify-packaged-native` 綠
- [x] CI 版本 npm 的 `npm ci` 接受新 lock（怎麼查到 CI 的 npm 版本）
- [x] typecheck 0 / 0、`test:unit` 全綠

---

## 回報區

> 以下由 sub-session 填寫

### 完成狀態

- **狀態**：DONE（五項驗收全過，lock 已 commit `7f9d4eeb`）
- **session_id**：1af9b89a-187e-485b-b5cd-531e2750ad4a
- **落點檢查**：PASS。C-0 `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`；C-1 PASS；C-3 PASS（`package-lock.json` 存在）；C-2 不適用（工單無 `branch`，目前在 `main`）。`CT_HOME` 未設定（不是 worktree）。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）。
- **模式**：`CT_MODE` = `yolo`、`CT_INTERACTIVE` = `0`；`BAT_REMOTE_TOKEN` 已設定。

### 產出摘要

在 HEAD（`ab87547b`）跑 `npm install --package-lock-only --ignore-scripts`（npm 12.2.1 / node v26.13.0），以 JSON 語意比對新舊 lock（逐套件去掉 `peer` 欄位後比較其餘所有欄位）：

| 項目 | 結果 |
|---|---|
| 套件數 | 996 → 996（新增 0、移除 0） |
| 頂層欄位（`name` / `version` / `lockfileVersion` / `requires`） | 不變 |
| `version` / `resolved` / `integrity` / `dependencies` / `dev` / `optional` 等非 peer 欄位 | **0 項變更** |
| `peer` 旗標 | **100 項**：加上 78、去掉 22 |
| `git diff --numstat` | +90 / −34（其中非 `"peer": true` 的行只有前一行行尾逗號的增減） |

**加上 `peer: true`（78）**：
- prod（非 dev，60）：`@anthropic-ai/sdk`、`@modelcontextprotocol/sdk`、`@hono/node-server`、`zod-to-json-schema`、`json-schema-to-ts`、`ts-algebra`、`jose`、`pkce-challenge`、`eventsource`、`eventsource-parser`、`express-rate-limit`、`cors`、`object-assign`、`vary`，以及 express 5 依賴鏈：`accepts`、`body-parser`、`body-parser/node_modules/iconv-lite`、`bytes`、`call-bound`、`content-disposition`、`content-type`、`cookie`、`cookie-signature`、`depd`、`ee-first`、`encodeurl`、`escape-html`、`etag`、`finalhandler`、`forwarded`、`fresh`、`http-errors`、`ipaddr.js`、`is-promise`、`json-schema-typed`、`media-typer`、`merge-descriptors`、`mime-db`、`mime-types`、`object-inspect`、`on-finished`、`parseurl`、`path-to-regexp`、`proxy-addr`、`qs`、`range-parser`、`raw-body`、`raw-body/node_modules/iconv-lite`、`router`、`send`、`serve-static`、`setprototypeof`、`side-channel`、`side-channel-list`、`side-channel-map`、`side-channel-weakmap`、`statuses`、`toidentifier`、`type-is`、`unpipe`
- dev（含 dev+optional，18）：`@electron/windows-sign`（及其 `fs-extra` / `jsonfile` / `universalify`）、`@types/aria-query`、`cross-dirname`、`dom-accessibility-api`、`electron-winstaller`、`electron-winstaller/node_modules/fs-extra`、`lz-string`、`postject`、`postject/node_modules/commander`、`pretty-format`、`pretty-format/node_modules/ansi-styles`、`react-is`、`rimraf`、`temp`、`temp/node_modules/mkdirp`

（prod 60 ＋ dev 18 = 78；去掉 peer 的 22 項為非 dev 8 ＋ dev 14。清單由 scratchpad `cmp.cjs` 比對輸出。）

**去掉 `peer`（22）**：`@types/node`、`@xterm/xterm`、`chevrotain`、`cytoscape`、`d3-selection`、`i18next`、`react`、`react-dom`（以上非 dev）；`typescript`（devOptional）；`@babel/core`、`@csstools/css-parser-algorithms`、`@csstools/css-tokenizer`、`@develar/schema-utils/node_modules/ajv`、`@types/react`、`@types/react-dom`、`@vitest/ui`、`browserslist`、`dmg-builder`、`jsdom`、`vite`、`vite-plugin-electron-renderer`、`vitest`（dev）。

**判讀**：
- 加上 peer 的 prod 項目都是 `@anthropic-ai/claude-agent-sdk` 0.3 的 peer（`@anthropic-ai/sdk`、`@modelcontextprotocol/sdk`）及其依賴閉包（MCP SDK → express 5、hono、jose、cors…）。這與 T0719 / BUG-176 的結論一致：它們本來就只經 peer 邊可達、不在 production 樹內、不打包；新旗標只是把 lock 標成與事實相符。
- 去掉 peer 的項目都是 `package.json` 直接相依（`react`、`react-dom`、`i18next`、`@xterm/xterm`、`typescript`、`vite`、`vitest`、`jsdom`…）或經一般 `dependencies` 邊可達（`cytoscape`、`chevrotain`、`d3-selection` 經 mermaid），標 peer 本來就是錯的。
- **這不是 npm 12 特有行為**：在 scratch 副本以 npm 11.19.1 對 HEAD lock 跑同一指令，產出與 npm 12.2.1 **逐位元相同**（`cmp` 無差異）。也就是 HEAD lock 的 peer 旗標早就是舊的（之前的部分更新沒重算旗標），任何 npm ≥ 11.19 的完整重算都會得到這份結果。

### 驗證

| # | 項目 | 指令 / 方法 | 結果 |
|---|---|---|---|
| 1 | diff 只有 peer | scratchpad `cmp.cjs`：逐套件去掉 `peer` 後 `JSON.stringify`（鍵排序）比較，另比頂層欄位與套件鍵集合 | PASS：996/996、新增 0、移除 0、非 peer 變更 0；peer +78 / −22 |
| 2a | 白名單交集 | `package.json` `build.files` 字串搜尋 `@anthropic-ai/sdk`、`@modelcontextprotocol`、`zod`、`express`、`@hono`、`jose`、`cors` | 全部不在白名單（false） |
| 2b | `asar-runtime-deps.test.mjs` 怎麼算閉包 | 讀原始碼：`productionTree` 只沿 `dependencies` / `optionalDependencies` 邊走、`dependencyClosure` 只沿 `dependencies`、白名單測試只用 `entry.dev` 篩選；**全檔不讀 `peer` 欄位** | 結果與 peer 旗標無關（邊與 `dev` 旗標都沒變） |
| 2c | electron-builder 收集器 | `node_modules/app-builder-lib/out/node-module-collector/npmNodeModulesCollector.js:16`：`npm list -a --include prod --include optional --omit dev …`，只排除 dev，不用 `--omit peer`；之後的 `isProdDependency` 不跟 peerDependencies | peer 旗標不影響打包集合 |
| 2d | 其他讀 lock 的程式 | `grep -rln package-lock scripts electron .github vite.config.ts`：只有 `verify-native-modules.js`（只在錯誤訊息提到）、`asar-runtime-deps.test.mjs`、`pages.yml`（`site/package-lock.json`，另一個 lock） | 無其他 consumer |
| 3 | asar 測試 | `npx vite build`（exit 0）後 `npx vitest run scripts/__tests__/asar-runtime-deps.test.mjs` | PASS：1 檔 31 tests 全過（dist-electron 已建，需 build 的那項有跑） |
| 4 | 打包 | `npm run build:dir`（exit 0）＋ `node scripts/verify-packaged-native.js --platform win --out release --arch x64`（exit 0） | PASS：`✅ win x64: embedded claude … (PE machine 0x8664), no server bundle baseline, 8 runtime package(s) / 15 with dependencies, 6 runtime helper(s) in resources/scripts, helper version 0.7.3-pre.5`、`✅ every windows package passed (x64)` |
| 4b | 本機安裝狀態是否等同新 lock | `node_modules/.package-lock.json`（上次實際安裝寫入的隱藏 lockfile）與新 lock 比 peer 旗標 | 共有 856 項：相同 856、不同 0 → 本機 `build:dir` 就是在新旗標狀態下跑的 |
| 5a | CI 的 npm 版本怎麼查到 | `.github/workflows/*.yml` 全部 `actions/setup-node` `node-version: '24'`，`grep "npm@\|install -g npm\|corepack"` 無結果（CI 不另升 npm）→ 用 node 24 附帶的 npm。`https://nodejs.org/dist/index.json`：v24.22.2（2026-10-27）/ v24.22.1 / v24.22.0 附 **npm 11.19.1**，v24.21.0 附 **npm 11.19.0** | CI 目前是 npm 11.19.1（setup-node 若落後一版則 11.19.0） |
| 5b | CI npm 接受新 lock | scratch 副本（`package.json` ＋ 新 lock）分別跑 `npx -y npm@11.19.1 ci --ignore-scripts --dry-run`、`npx -y npm@11.19.0 ci --ignore-scripts --dry-run` | 兩版 exit 0，無 lock 不同步 / invalid 錯誤；`cmp` 確認 lock 未被改寫 |
| 5c | npm 11 會不會重寫 lock | scratch 副本以 npm 11.19.1 對新 lock 跑 `install --package-lock-only --ignore-scripts` | 結果與新 lock 逐位元相同 → npm 11 不會翻回去（不會來回改） |
| 6 | typecheck | `npm run typecheck` / `npm run typecheck:electron` | 0 / 0（兩者 exit 0） |
| 7 | 單元測試 | `npm run test:unit` | PASS：382 檔、6705 passed / 10 skipped（共 6715），57.73 s；`worktree-status-after-close.test.ts` 本次沒有逾時 |

未跑 e2e（工單規定：lock 中繼資料變更、不改版本）。

### 遭遇問題

- `npm ci --dry-run` 的輸出有兩則與本單無關的既有警告：`Unknown env config "global-ignore-file"`（本機環境變數）、`.npmrc allow-scripts setting is being ignored because package.json declares its own allowScripts field`。
- `npm install --package-lock-only` 結尾照例提示 `npm audit fix --force`；依工單未執行。
- 同一 checkout 的 `_ct-workorders/T0781-research-electron-major-upgrade-target.md` 有 T0781 的未提交變更，未碰（commit 一律 `--only`）。

### 互動紀錄

無（未向塔台提問）。

### 後續建議

- **建議補一行到 `docs/agent-guide/npm12-install-scripts.md`**（本單未改 docs）。建議文字：「`package-lock.json` 的 `peer` 旗標（T0782）：lock 裡標 `peer: true` 的套件（例：Agent SDK 的 peer `@anthropic-ai/sdk`、`@modelcontextprotocol/sdk` 與其 express / hono 閉包）不打包；打包集合由 electron-builder `npm list --omit dev` ＋ `dependencies` 邊決定、`asar-runtime-deps.test.mjs` 也只走 `dependencies` / `optionalDependencies` 邊，都不讀 `peer` 旗標。完整重算（npm 11.19 與 12 結果相同）若只翻轉 `peer`，可直接接受；有 `version` / `resolved` / `integrity` 變更則照一般改相依處理。」
- 之後改相依的工單若 `npm install` 後 lock 只多出 `peer` 翻轉，現在應該不會再出現（本次已完整重算並 commit）；若再出現，代表 lock 又被部分更新過，可比照本單的語意比對腳本判讀。
- 未發版、未改 CHANGELOG、未 push。

### commit 狀態

- 產品 commit：`7f9d4eeb`（`7f9d4eebc3b708efd49d39e981dc8c3bc71d32f3`）`chore(deps): T0782 accept recomputed package-lock peer flags (no version changes)`，只含 `package-lock.json`（`git commit --only`）。
- 工單 commit：本檔另行 `git commit --only`。
- 未 push。

### 回報時間

2026-11-02T14:33:53+0800
