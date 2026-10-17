---
schema_version: 1
schema_kind: workorder
id: T0503
title: "盤點 sharp / @img 是否仍在 runtime 使用：未使用則從 server bundle nativePackages、build.asarUnpack、optionalDependencies 移除（devDependency 保留給 generate-icons.js）"
type: implementation
status: DONE
repo: better-agent-terminal
project: D139
priority: P3
sizing: S
created_at: "2026-10-13T23:55:30+08:00"
started_at: "2026-10-13T23:55:31+08:00"
updated_at: "2026-10-14T00:06:20+08:00"
completed_at: "2026-10-14T00:06:20+08:00"
target_version: v0.6.0-pre.5
depends_on:
  - "T0492"
related:
  - "T0492 回報區「建議 / 範圍外發現」5：`sharp` 是 devDependency，卻被 server bundle `nativePackages` 複製，`build.asarUnpack` 也列 `node_modules/@img/**/*`"
  - "塔台 23:55 初查：`electron/` / `src/` 無任何 `sharp` import；`scripts/generate-icons.js` 使用 sharp；`optionalDependencies` 含 `@img/sharp-darwin-{arm64,x64}`、`@img/sharp-libvips-darwin-{arm64,x64}`（commit `24a3304`「add @img/sharp-darwin-arm64 native binaries for Apple Silicon image resize support」）"
  - "T0475 / BUG-117：mac `.app` 內 Mach-O 全掃（`verify-packaged-native.js`），`@img` 為其中一部分"
affects_files:
  - "package.json"
  - "package-lock.json"
  - "scripts/build-server-bundle.mjs"
  - "scripts/verify-server-bundle.js"
  - "scripts/verify-packaged-native.js"
  - "scripts/__tests__/"
renew_count: 0
workdir: main repo
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "✅ 本單授權改 `package.json`（`optionalDependencies` 的 `@img/*`、`build.asarUnpack` 的 `@img` 規則）與 `package-lock.json`（只能移除 / 改 dev 旗標於 sharp / @img 系列；其他套件版本不得變動，比照 T0483 / T0492 移植法，回報區附清單）"
  - "🔴 先證明 runtime 未使用（桌面 app、headless server bundle、動態 require、`24a3304` 當初的 image resize 呼叫點現況）；任一處仍使用即停止移除並回報 PARTIAL"
  - "🔴 `sharp` devDependency 與 `allowScripts.sharp` 保留（`scripts/generate-icons.js` 使用）"
  - "🔴 不改 workflows（T0496 會改）、不改 `electron/`（T0491 / T0496 範圍）；若移除需要改這些檔，回報區寫明"
  - "🔴 批次並行（D139）：`git commit --only` 本單檔案；不改 CLAUDE.md（建議文字寫回報區由 T0493 套用）"
  - "🔴 `npm ci` 不得在主工作樹執行（其他 Worker 共用 node_modules）：比照 T0492 在 scratchpad 乾淨副本驗證"
  - "🔴 不 push、不觸發 workflow；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`；換行維持各檔現況"
---

# T0503 — sharp / @img runtime 盤點

## 實作

1. 證據：`git grep` sharp / `@img` 於 `electron/`、`src/`、server bundle 入口、e2e；`git show 24a3304` 找當初的 image resize 呼叫點，確認現況（已改用 `nativeImage` 或其他？）；`npx vite build` 後 `dist-electron/*.js` 搜尋 sharp
2. 若未使用：
   - `scripts/build-server-bundle.mjs` `nativePackages` 移除 sharp / @img；`verify-server-bundle.js` 相應檢查
   - `package.json` `optionalDependencies` 移除 `@img/sharp-*`（它們仍會作為 sharp 的 optional 相依在開發機安裝，供 generate-icons 使用）；`build.asarUnpack` 移除 `node_modules/@img/**/*`；確認 electron-builder 不再打包 sharp / @img（devDependency 本來就不打包——核對）
   - `verify-packaged-native.js` 若對 @img 有特定預期，同步調整
   - lock 只保留必要變動
3. 驗證：scratchpad 乾淨副本 `npm ci` + `node scripts/verify-native-modules.js`；`npx vite build`；`npm run test:unit`；WSL 建 linux-x64 server bundle + `verify-server-bundle`（比照 T0492）；可行時 `npm run build:dir` 檢查 `win-unpacked` 不含 `@img` / sharp（產物不安裝，結束清除）

## 驗收條件

- [x] 未使用證據表（或 PARTIAL 與使用處）
- [x] lock 變動清單；`npm ci` 乾淨；server bundle 建置 / 驗證；打包產物不含 sharp / @img
- [x] `npm run test:unit`、`npm run typecheck`、`npx vite build`
- [x] CLAUDE.md 建議文字（allowScripts / asarUnpack / server bundle 相關段）；`git diff --stat`

## Sub-session 執行指示

1. 讀本工單 + D139 + T0492 回報區 + 相關檔案
2. 填 `started_at`、`status: IN_PROGRESS`（取系統時間，R-G001）
3. 實作 → 驗收 → 填回報區 → `DONE`；`git commit --only` 本單檔案與改動；不 push；依派發 mode 通知塔台

---

## 回報區

### 結果摘要

**DONE**。sharp / `@img` 在 runtime 完全沒有使用：桌面 app 與 headless server bundle 都沒有程式碼載入 sharp。`24a3304` 當初要的「image resize」是 **SDK 自帶的 claude binary**（`@anthropic-ai/claude-agent-sdk-<platform>/claude`）裡打包的 sharp，但 BAT 每個 spawn 點都傳 `pathToClaudeCodeExecutable`，指向 `@anthropic-ai/claude-code` 的 binary（2.1.296，不含 sharp），所以那顆 binary 不會被執行。已經做的移除：

- `package.json`：`optionalDependencies` 拿掉 4 個 `@img/sharp-*darwin*`，`build.asarUnpack` 拿掉 `node_modules/@img/**/*`。`sharp` devDependency 和 `allowScripts.sharp` 保留。
- `scripts/build-server-bundle.mjs`：3 個 target 的 `nativePackages` 拿掉 `sharp` 與 `@img/*`（各 3 項），`externalPackages` 拿掉 7 項。
- `scripts/verify-server-bundle.js`：原本各 target 只禁止「別的平台」的 `sharp-*`，改成所有 target 都禁止 `sharp` / `@img/`。
- lock：只動 8 行（root `optionalDependencies` 少 4 項，4 個 `@img/*darwin*` 條目加上 `"dev": true`）。沒有任何套件被移除、新增或改版本。

### Landing Zone Check

- **PASS**。C-0：frontmatter `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`，`REPO_ROOT` = `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`。C-1：工單位於 `REPO_ROOT/_ct-workorders/`，PASS。C-3：`package.json`、`package-lock.json`、`scripts/*` 都存在，資訊性 PASS。C-2：工單沒有 `branch` 欄位，不適用。
- `BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄，不比對）。`CT_MODE=yolo`，`CT_INTERACTIVE=0`。

### 1. 未使用證據表

| 範圍 | 檢查方式 | 結果 |
|---|---|---|
| 桌面 app 原始碼 | `git grep -i sharp` / `@img`，範圍 `electron/`、`src/`、`e2e/` | 0 次載入。唯一命中是 `src/components/PathLinker.tsx` 的 highlight.js `csharp` |
| 歷史呼叫點 | `git show 24a3304`；`git log -S"require('sharp')"` / `-S"from 'sharp'"`（`--all`） | `24a3304` 只改 `package.json` 4 行，沒有呼叫點。`electron/` / `src/` 從來沒有 import 過 sharp，`-S` 只命中 `2dda9de`（加入 `scripts/generate-icons.js`）以及文件 / allowScripts commit |
| 現在 BAT 自己的圖片縮放 | `electron/image-utils.ts` `prepareImageForApi` | 用 Electron `nativeImage.createFromBuffer(...).resize(...)`，不需要 sharp |
| 動態 require（相依套件） | lock 裡依賴 `sharp` / `@img/*` 的套件 | 只有 root（`sharp` devDependency + 4 個 darwin optional）。沒有任何 prod 套件依賴 sharp |
| `@anthropic-ai/claude-agent-sdk` 0.2.113 JS | 在 `sdk.mjs` / `assistant.mjs` / `bridge.mjs` 找 `"sharp"` | 0 次 |
| SDK 自帶 binary `claude-agent-sdk-win32-x64/claude.exe`（2.1.113） | `grep -a` | **有** sharp：內含 sharp JS，執行時會 `` require(`@img/sharp-${platform}/sharp.node`) ``。這就是 `24a3304`「image resize」的來源 |
| 內嵌 CLI `claude-code/bin/claude.exe`（2.1.296） | `grep -a` 找 `"sharp"`、`@img/sharp`、`sharp.node` | 0 次（只命中 HTML entity `&sharp;` 和提示文字 "sharp colleague"） |
| BAT 會不會跑到 SDK 自帶 binary | `electron/claude-agent-manager.ts` 4 個 spawn 點（:847 / :1537 / :1850 / :2460）都是 `pathToClaudeCodeExecutable: claudeCodePath`；`claude-runtime-router.ts` `embeddedClaudeCandidates` | 打包版（`electron-packaged`）和 server bundle（`server-bundle`）一定會解出路徑，找不到就丟 `EmbeddedClaudeMissingError`，不會留空。system 模式用系統 claude。只有開發環境（`node-modules` 版面）在找不到 `@anthropic-ai/claude-code` 套件時會傳 `''`，讓 SDK 退回自帶 binary；那種情況下 dev 的 `node_modules` 仍有 sharp devDependency 與 host 的 `@img`，不受影響。`listSessions` / `getSessionMessages` 只讀檔，不 spawn |
| headless server bundle | 入口 `electron/remote/{server,headless}-entry.ts` + `git grep` | 0 次載入。sharp 只出現在 `externalPackages`（esbuild external）和 `nativePackages`（照抄複製）。移除後實際建置並啟動 server：沒有 `Cannot find module`（見下方驗證） |
| 建置產物 | `npx vite build` 後在 `dist-electron/*.js`、`dist/assets/*.js` 找 `require('sharp'` / `from 'sharp'` / `import('sharp'` / `@img/` | 0 次 |
| workflows | `git grep -i "sharp\|@img" -- .github` | 0 次，不需要改 workflow |

### 2. 改動清單（`git diff --stat`）

```
 package-lock.json                                 |  8 ++++----
 package.json                                      |  5 -----
 scripts/__tests__/dev-deploy-headless.test.mjs    |  2 +-
 scripts/__tests__/verify-packaged-native.test.mjs |  2 +-
 scripts/build-server-bundle.mjs                   | 19 ++-----------------
 scripts/verify-server-bundle.js                   | 11 ++---------
 6 files changed, 10 insertions(+), 37 deletions(-)
```

（另有本工單檔。`electron/` 與 workflows 沒有改。）

- `scripts/__tests__/dev-deploy-headless.test.mjs`：原本斷言 `externals` 含 `@img/sharp-linux-x64`，改成斷言含 `@anthropic-ai/claude-agent-sdk-linux-x64`。這個 case 想守的是「平台子套件要從 build script 讀進來」，換一個仍然存在的平台子套件，用意不變。
- `scripts/__tests__/verify-packaged-native.test.mjs`：混入 x86_64 Mach-O 的測試，fixture 路徑從 `@img/sharp-darwin-x64/lib/sharp.node` 改成 `@lydell/node-pty-darwin-x64/prebuilds/darwin-x64/pty.node`。只是換一個仍會打包的套件名，`verify-packaged-native.js` 本身沒有針對 `@img` 的邏輯，不需要改。
- `scripts/build-server-bundle.mjs`：`pruneBinDirs` 的註解範例 `sharp/node_modules/.bin/semver` 保留（那是 T0494 的事故紀錄），補一句「(sharp was bundled until T0503)」。
- 換行：各檔維持原狀（`verify-server-bundle.js` 仍是 CRLF，其他仍是 LF）。

### 3. lock 變動清單（移植法，比照 T0483 / T0492）

1. 在 scratchpad 用改好的 `package.json` 和 HEAD lock 執行 `npm install --package-lock-only --ignore-scripts`（npm 12.2.0，exit 0），產生參考 lock。
2. 把參考 lock 和 HEAD 逐條目比對：REMOVED 0、ADDED 0、CHANGED（version / resolved / integrity）0。META 差異如下：
   - root `optionalDependencies`：移除 `@img/sharp-darwin-arm64`、`@img/sharp-darwin-x64`、`@img/sharp-libvips-darwin-arm64`、`@img/sharp-libvips-darwin-x64`（只剩 `@lydell/node-pty`）→ **採用**
   - `node_modules/@img/sharp-darwin-arm64`、`sharp-darwin-x64`、`sharp-libvips-darwin-arm64`、`sharp-libvips-darwin-x64`：加上 `"dev": true`（插在 `license` 前，和 npm 產出的順序一樣）→ **採用**
   - 其餘 43 筆是 `peer` 旗標雜訊 → **不採用**（和 T0492 一樣）
3. 用文字移植到 HEAD lock（`+4 / -4` 共 8 行）。重新比對：移植後的 lock 和 npm 原生產出，扣掉 `peer` 欄位後逐條目完全相同。

### 4. 驗證

驗證都在 scratchpad 的乾淨副本執行，內容是 `git -c core.autocrlf=false archive HEAD`（`cc93280`）加上本單 6 個檔，所以不含主工作樹裡 T0491 尚未提交的改動，也沒有在主工作樹跑 `npm ci`。

| 項目 | 結果 | 證據 |
|---|---|---|
| `npm ci`（npm 12.2.0 / Node 24.21.0，Windows） | ✅ PASS | exit 0。結尾警告只有預期的 `electron-winstaller@5.4.0`。`node_modules/@img` 只有 `colour`、`sharp-win32-x64`（dev） |
| `node scripts/verify-native-modules.js` | ✅ PASS | exit 0：`All 2 required native modules present … embedded claude: native`；內嵌 `claude.exe --version` = `2.1.296 (Claude Code)` |
| sharp 仍可給 generate-icons 用 | ✅ PASS | `require('sharp')` 載入成功（sharp 0.34.5 / vips 8.17.3）；`node scripts/generate-icons.js` → `All icons generated successfully!`（只在副本裡產生，不影響 repo） |
| `npm run build:dir`（含 fetch:baseline、verify-native-modules、verify-helper-bundle、verify-renderer-imports、`vite build`、`electron-builder --dir`） | ✅ PASS | exit 0。electron-builder 的 `missing optional dependencies` 清單已經沒有 `@img/*`（prod 樹不再收它們） |
| 打包產物不含 sharp / @img（win-unpacked） | ✅ PASS | `app.asar` 12976 個條目，比對 `sharp`/`@img` 字串只命中 8 個 highlight.js `csharp.js`/`fsharp.js`，沒有 sharp 套件或 `@img`。`app.asar.unpacked/node_modules` 只有 `@anthropic-ai`、`@kutalia`、`@lydell`、`@openai`；`resources/` 下 `*sharp*`/`*libvips*` 共 0 個。產物沒有安裝，驗證完已刪除 |
| `npx vite build` | ✅ PASS | 包在 `build:dir` 裡，exit 0；`dist-electron/*.js`（11 檔）載入 sharp 0 次 |
| `npm run typecheck` | ✅ PASS | exit 0 |
| `npm run test:unit` | ✅ PASS | **188 files / 3184 passed / 1 skipped**。其中 `scripts/__tests__/`：10 files / 247 passed |
| server bundle 建置（WSL Ubuntu-24.04，官方 Node 24.21.0 / npm 11.19.0，`CI=true`，等同 CI 的 server-bundle job） | ✅ PASS | `npm ci` → `build-server-bundle.mjs --target=linux-x64` → `[4] No node_modules .bin dirs to remove`（原本要刪的 `sharp/node_modules/.bin` 已經不存在）→ `✅ Bundle created` |
| `verify-server-bundle.js --target=linux-x64` | ✅ PASS | exit 0。tarball 內 `sharp`/`@img`/`libvips` 條目：(none)；symlink：(none)；`staging/node_modules` 只有 `@anthropic-ai/{claude-code,claude-code-linux-x64,claude-agent-sdk,claude-agent-sdk-linux-x64}`、`@lydell/{node-pty,node-pty-linux-x64}` |
| verify 負向檢查（新的禁止規則） | ✅ PASS | 在 bundle 植入 `staging/node_modules/@img/sharp-linux-x64/lib/sharp-linux-x64.node` → `❌ Forbidden patterns found … - staging/node_modules/@img/` exit 1；植入 `staging/node_modules/sharp/package.json` → exit 1 |
| headless server 執行 | ✅ PASS | 解壓後 `staging/bin/bat-server --data-dir … --port 19503`：`node-pty loaded successfully` → `[RemoteServer] Started on 127.0.0.1:19503` → `[bat-server] listening`，沒有 `Cannot find module` |
| bundle 大小 | — | linux-x64 tarball 由 242,929,350 bytes（T0492 時建置，含 sharp）降到 235,231,168 bytes（約 −7.7 MB） |
| mac 打包產物 | ⚠️ 未實測 | Windows 無法打 mac 包。推論：4 個 `@img/*darwin*` 在 lock 已經是 `dev: true`，electron-builder 只收 prod 相依，`asarUnpack` 也拿掉了 `@img`，所以 mac `.app` 應該不再帶這些 binary。CI 的 mac `verify-packaged-native` 會掃全部 Mach-O，下次 pre-release run 時 Mach-O 數量應該會比 pre.4 的 55 個少（少掉 `@img` 那幾個），可以用來確認 |

清理：scratchpad 的乾淨副本（含 `release/`、`node_modules`）、lockgen 目錄、WSL `/tmp/t0503-sb` 都已刪除，只留下 log 和腳本。

### 5. CLAUDE.md 建議文字（交給 T0493 套用，本單沒有改 CLAUDE.md）

1. 「Electron Runtime」第 2 點：
   - 原文：「`@lydell/node-pty`、`@kutalia/whisper-node-addon`、`sharp` / `@img/*` 都直接使用上游 prebuilt binary。」
   - 改成：「`@lydell/node-pty`、`@kutalia/whisper-node-addon` 都直接使用上游 prebuilt binary。`sharp`（含 `@img/*`）只是 devDependency，給 `scripts/generate-icons.js` 用，桌面 app 與 server bundle 都不打包（T0503）。」
2. 「本機開發：npm 12 install scripts」的 `allowScripts` 段：在「放行 `electron`、`esbuild`、`sharp`、`@anthropic-ai/claude-code`」後面補一句：「`sharp` 只給 `scripts/generate-icons.js`（devDependency，不打包，T0503）。」手動補跑表格的 `sharp` 列保留。
3. 「electron-builder 26 migration notes」的「不要改成 `"universal"`」段：「本專案 `@anthropic-ai/claude-code`、`@anthropic-ai/claude-agent-sdk`、`@img/**`、`@lydell/node-pty-*` 都 ship 全平台 binary」改成去掉 `@img/**`（T0503 起已不打包，`asarUnpack` 也沒有 `@img`）。
4. 「Server bundle baseline（PLAN-031）」段落新增一點：「**server bundle 不含 sharp / `@img`**（T0503）：`build-server-bundle.mjs` 的 `nativePackages` / `externalPackages` 不列它們，`verify-server-bundle.js` 對所有 target 禁止 `sharp` / `@img/`。執行時的 claude 一律是 `@anthropic-ai/claude-code-<platform>`，SDK 自帶的 `claude-agent-sdk-<platform>/claude`（內含 sharp，會 `require('@img/sharp-<platform>/sharp.node')`）不會被 BAT 執行，因為每個 spawn 點都傳 `pathToClaudeCodeExecutable`。」

### 6. 偏差 / 阻礙 / 後續

- **偏差**：`electron/` 和 workflows 都不需要改，沒有超出範圍。
- **驗證環境的一個坑（不是產品問題）**：第一次解出乾淨副本時用的是 `git archive`，因為 `core.autocrlf=true`，檔案被轉成 CRLF，`electron/__tests__/remote-connect-plan.test.ts` 有 2 個 source-guard 測試的 regex 因此失敗。改用 `git -c core.autocrlf=false archive` 重新解出後，全部通過（就是上面的 188 / 3184）。以後在 Windows 上用 `git archive` 做乾淨副本，記得加 `-c core.autocrlf=false`。
- **殘餘風險（低）**：開發環境（`node-modules` 版面）在 `@anthropic-ai/claude-code` 解析失敗時，SDK 會改用自帶的 2.1.113 binary，這顆會 require `@img`。dev 環境仍然有 sharp devDependency 和 host 平台的 `@img`，所以不影響。打包版不會走到這條路（找不到內嵌 binary 就直接丟 `EmbeddedClaudeMissingError`）。
- **建議**：下次 pre-release CI run 時，確認 mac job 的 `verify-packaged-native` Mach-O 數量少於 pre.4 的 55 個，而且沒有出現 `@img` 路徑。這樣就能實際證明 mac `.app` 已經不帶 `@img`。
- **commit**：見本單 commit（`git log --grep T0503`）。用 `git commit --only` 只提交本單的 7 個檔，T0491 的 dirty files 沒有動。沒有 push，沒有觸發 workflow。
