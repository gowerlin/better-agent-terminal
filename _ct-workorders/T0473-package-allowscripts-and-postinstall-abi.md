---
schema_version: 1
schema_kind: workorder
id: T0473
title: "package.json 加 npm 12 allowScripts（approve 5 個、處理 electron-winstaller）+ 查證並修正 postinstall / CLAUDE.md 的 npm rebuild better-sqlite3 是否產出 Electron ABI（T0471 建議 1、3）"
type: implementation
status: IN_PROGRESS
repo: better-agent-terminal
project: dev-env
priority: P1
sizing: M
created_at: "2026-10-13T16:39:22+08:00"
started_at: "2026-10-13T16:46:49+08:00"
updated_at: "2026-10-13T16:46:49+08:00"
completed_at: null
target_version: v0.6.0-pre.3
depends_on:
  - T0472
related:
  - "T0471 回報區：npm 12.2.0 擋 better-sqlite3 / electron / electron-winstaller / esbuild / sharp / @anthropic-ai/claude-code 的 install scripts；根 postinstall 的 `npm rebuild better-sqlite3` 走同一 gate 成 no-op；CI 用 Node 24 隨附 npm 11.19.0"
  - "CLAUDE.md「Electron Runtime」：『postinstall 已自動跑 npm rebuild better-sqlite3』『NODE_MODULE_VERSION mismatch 先執行 npm rebuild better-sqlite3』；「本機開發：npm 12 install scripts（T0471）」節"
  - "pre-release.yml：npm ci → @electron/rebuild → verify-native-modules"
affects_files:
  - package.json
  - package-lock.json
  - CLAUDE.md
  - node_modules/
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "✅ **本單授權修改 `package.json`**（覆寫 T0471 的禁令）：新增 npm 12 的 install scripts 允許設定；必要時修改 `postinstall`。`package-lock.json` 只允許因上述變更產生的必要差異（理想為零；有差異需逐處解釋）"
  - "✅ 允許在本機跑 `npm ci` 驗證新設定（T0472 已結束，無並行 Worker）；跑完後本機必須恢復完整可用：`node scripts/verify-native-modules.js` exit 0（含 T0472 新增的 claude stub / better-sqlite3 .node 檢查）、內嵌 claude `--version` = `2.1.289`、better-sqlite3 在 Electron 下可開 `:memory:`"
  - "🔴 **CI 相容是硬條件**：npm 11（CI）遇到新欄位必須無錯誤、行為不變；以 npm 11 實測（例：`npx -y npm@11` 在 scratchpad 複製 package.json + lock 做最小驗證），不得全域降級 npm；寫法優先採不綁版本號的 entry（若 npm 12 支援），避免每次升版都要重新 approve"
  - "🔴 不升降級全域 node / npm；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`；寫檔維持 LF；不 push"
---

# T0473 — allowScripts + postinstall ABI

## 任務

1. **allowScripts**：依 npm 12 官方格式在 `package.json` 允許 `better-sqlite3`、`electron`、`esbuild`、`sharp`、`@anthropic-ai/claude-code` 的 install scripts；`electron-winstaller` 明確 deny 或不列入（依格式語意擇一並說明）。驗證：本機 npm 12 `npm install-scripts ls` 不再列出被擋項（electron-winstaller 除外）；`npm ci` 後不需任何手動補跑即通過 memory_overrides 第 2 條三項檢查
2. **postinstall ABI 查證**：npm 11 情境下（CI 與一般開發者），根 `postinstall` 的 `npm rebuild better-sqlite3` 產出的是 Node ABI 還是 Electron ABI 145？以證據回答（`process.versions.modules`、prebuild-install / node-gyp 的 runtime 判定、實測 binary 在 Node 與 Electron 下能否載入）。若產出 Node ABI → 改 postinstall 為產出 Electron ABI 的指令（例：repo 既有的 `@electron/rebuild`，不新增套件；若需新增依賴，回報區給理由），並確認不破壞 CI 的 `npm ci` → `@electron/rebuild` 順序（重複 rebuild 可接受但要說明耗時）；mac 分支的 plutil 段保持不變
3. **CLAUDE.md**：「Electron Runtime」相關兩句與「本機開發：npm 12 install scripts（T0471）」節依結論改寫（allowScripts 生效後哪些手動步驟不再需要、仍需要的保留）；另在「Packaging / Release 前置檢查」的 Build fail-fast 條補一句 T0472 新增的 claude stub / better-sqlite3 `.node` 檢查
4. 驗證：`npx vite build` exit 0；`npm run test:unit` 0 failed；`node scripts/verify-native-modules.js` exit 0；`node scripts/verify-helper-bundle.js` exit 0

## 驗收條件

- [ ] npm 12：`npm ci` 後零手動步驟，三項本機檢查通過（證據）
- [ ] npm 11：同一 `package.json` / lock 的 `npm ci`（或等價最小驗證）無錯誤、行為不變（證據）
- [ ] postinstall ABI 結論 + 修正（或「無需修正」的證據）
- [ ] CLAUDE.md 更新；build / unit / verify 全綠

## Sub-session 執行指示

1. 讀本工單 + T0471、T0472 回報區 + CLAUDE.md 相關節 + `package.json` scripts
2. 填 `started_at`、`status: IN_PROGRESS`（取系統時間，R-G001）
3. 實作 → 驗收 → 填回報區 → `DONE`；commit 本單檔案（node_modules 不進 git）；不 push；依派發 mode 通知塔台

---

## 回報區

### 完成狀態

DONE。四項驗收條件全數達成。

Landing Zone Check：**PASS**
- C-0：frontmatter `repo: better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`，REPO_ROOT = `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal` → PASS
- C-1：工單位於 REPO_ROOT 下 → PASS
- C-3：`package.json`、`package-lock.json`、`CLAUDE.md`、`node_modules/` 皆存在 → PASS（C-0 已 PASS，僅供參考）
- C-2：無 `branch` 欄位；HEAD = `main`
- `BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）
- 環境：Node v24.21.0 / npm 12.2.0；`CT_MODE=yolo`、`CT_INTERACTIVE=0`；本機 shell 無 `CI` 變數

### 產出摘要

**改動檔案**：`package.json`（LF）、`CLAUDE.md`（LF）。`package-lock.json` **零差異**（`git diff --stat` 無輸出）。

**1. `allowScripts`**（npm 12 文件：`docs/content/commands/npm-install-scripts.md`、`using-npm/config.md`）

```json
"allowScripts": {
  "better-sqlite3": true,
  "electron": true,
  "esbuild": true,
  "sharp": true,
  "@anthropic-ai/claude-code": true
}
```

- 用 `npm install-scripts approve --no-allow-scripts-pin <5 個套件>` 寫入：name-only entry，不綁版本，升版不必重新 approve（預設的 pinned `pkg@x.y.z` 每次升版都要重來）。
- **`electron-winstaller` 選「不列入」，不寫 `false`**。原本先寫了 `npm install-scripts deny electron-winstaller`（`false`），以 npm 11.19.0 實測後撤回：npm 11.19.0 也認得 `allowScripts`，未列入的套件只警告、照跑；**`false` 則會跳過**。對照組（HEAD 的 `package.json`）與 deny 版本的 `node_modules` 差在 `electron-winstaller/vendor/7z.dll`、`7z.exe` 兩檔（deny 版本沒跑 `select-7z-arch.js`）。工單把「CI 行為不變」列為硬條件，所以不寫 `false`。代價：本機 npm 12 的 `npm ci` 結尾和 `npm install-scripts ls` 會列出 electron-winstaller 一行。用不到它的理由同 T0471（只供 Squirrel.Windows，`build.win.target` = `nsis` + `zip`）。
- 寫入後 `package.json` 工作副本變成 CRLF（HEAD blob 為 LF）。已轉回 LF，diff 只剩實際改動（8 insertions, 1 deletion）。

**2. postinstall ABI 查證**

結論：**npm 11 下 `npm rebuild better-sqlite3` 產出 Node ABI 137，不是 Electron ABI 145。** 更糟的是，已經是 Electron ABI 的 binary 跑完這一步會被覆蓋成 Node ABI。

證據：
- runtime 判定：`node_modules/prebuild-install/rc.js`（7.1.3）的預設值是 `runtime: pkgConf.runtime || env.npm_config_runtime || 'node'`、`target: ... || process.versions.node`。repo 無 `.npmrc`，`package.json` 無 `config.runtime`，workflow 也沒設 `npm_config_runtime` / `npm_config_target` → 一律取 Node。`npm rebuild better-sqlite3` 就是重跑 better-sqlite3 的 `install`（`prebuild-install || node-gyp rebuild --release`），結果相同。
- 實測（scratchpad，`better-sqlite3@12.9.0`）：
  1. `npx -y npm@11 install`（11.21.0）→ binary sha256 `d6d1f318…3799cb`；Node 24.21.0（`process.versions.modules` = 137）載入並開 `:memory:` OK；Electron 41.2.1（`ELECTRON_RUN_AS_NODE=1`，modules = 145）載入失敗 `was compiled against a different Node.js version`。
  2. 把 repo 的 Electron ABI binary（sha256 `4f6500f1…2e79e71`）複製進去 → Node 載入失敗、Electron OK。再跑 `npx -y npm@11.19.0 rebuild better-sqlite3`（CI 的 npm 版本）→ sha256 變回 `d6d1f318…`，Node OK、**Electron 失敗**。
- 對照：`_decision-log.md:1087`（T0160）寫「`postinstall` 的 `npm rebuild better-sqlite3` 自動為 ABI 145 重 build」，與上面的實測結果不符。決策日誌由塔台維護，本單未改。

修正（`package.json` `postinstall`，mac 的 `plutil` 段一字不動）：

```
... plutil 段 ... && node -e "if(process.env.CI){console.log('postinstall: CI is set, skipping electron-rebuild of better-sqlite3 (the workflow runs @electron/rebuild itself)')}else{require('child_process').execFileSync(process.execPath,[require('path').join('node_modules','@electron','rebuild','lib','cli.js'),'-f','-w','better-sqlite3'],{stdio:'inherit',timeout:600000})}" && echo 'postinstall done'
```

- 用 repo 既有的 `@electron/rebuild@4.0.3`（`electron-builder@26.8.1 → app-builder-lib@26.8.1` 間接安裝，hoisted 在 `node_modules/@electron/rebuild`），**沒有新增套件**。它的 `exports` 只有 `./lib/main.js`，`require.resolve('@electron/rebuild/lib/cli.js')` 會 `ERR_PACKAGE_PATH_NOT_EXPORTED`，所以用 `path.join` 組路徑，以 `execFileSync(process.execPath, [...])` 執行。照 CLAUDE.md「Child Process Spawning」：array args、不經 shell，timeout 600 s。找不到 cli.js 或 rebuild 失敗時 postinstall 非零退出，`npm ci` 跟著失敗（fail-fast，與舊 `npm rebuild` 失敗時相同）。
- 直接跑 cli.js，不走 `npm rebuild`，所以也不經 npm 12 的 allowScripts gate。
- **為什麼 `CI` 有值時跳過**（工單沒提到，是我查 CI 時發現的）：
  1. `build-server-bundle.yml` 與 `pre-release.yml` / `release.yml` 的 `server-bundle` job 都**只跑 `npm ci`**，沒有 `@electron/rebuild`。`scripts/build-server-bundle.mjs` 把 `node_modules/better-sqlite3` 原樣複製進 bundle（`nativePackages`），bundle 以下載的 Node 24 執行（`selectNodeVersion()`）。postinstall 若在 CI 也改成 Electron ABI，server bundle 就會帶著 Electron ABI 的 better-sqlite3。
  2. 桌面 build job 在 `npm ci` 之後本來就跑 `npx --yes @electron/rebuild`，postinstall 在 CI 再 rebuild 一次是白工。
  3. 跳過後 CI 的結果與改動前完全相同：舊 postinstall 的 `npm rebuild better-sqlite3` 只是把 install script 再跑一次，產物同為 Node ABI（下方 npm 11 比對證明 `node_modules` 無差異）。
  - GitHub Actions 固定設 `CI=true`。副作用：開發者 shell 裡若殘留 `CI`，本機會拿到 Node ABI，CLAUDE.md 已寫明此時改跑 `npx electron-rebuild -f -w better-sqlite3`。
- **重複 rebuild 耗時**：CI 不重複（見上）。本機 postinstall 的 electron-rebuild 從 GitHub 下載 prebuilt（`gh api repos/WiseLibs/better-sqlite3/releases/tags/v12.9.0` 有 `electron-v145` 的 win32-x64 / linux-x64 / linux-arm64 / darwin-x64 / darwin-arm64 等 prebuilt），不需編譯；npm cache 已熱時整個 `npm ci` 約 15–16 s。單獨跑 `npx --yes @electron/rebuild` 約 1 s。

**另一個發現（建議另案，本單未處理）**：整個 repo（`node_modules` 除外）**沒有任何程式 import better-sqlite3**，`scripts/` 裡只有 `build-server-bundle.mjs` 複製它、`verify-native-modules.js` / `verify-server-bundle.js` 檢查它存在，`dist-electron/` 的建置產物也找不到它。`git log -S` 顯示它在 `1fe2f43`（2025-12-20 snippet sidebar）加進 `dependencies`，但同一個 commit 的 `electron/snippet-db.ts` 一開始就是 JSON 檔實作，之後也從未 import 過。也就是說 better-sqlite3 目前不在任何執行路徑上，ABI 對錯都不影響功能。這也是改 postinstall 不會造成功能回歸的原因。是否移除這個相依（連帶 `REQUIRED_NATIVE_MODULES`、server bundle `nativePackages`、T0472 檢查、postinstall），請塔台決定。

**3. CLAUDE.md**
- 「Electron Runtime」第 2 條：改寫成 postinstall 現在的行為（非 CI 時跑 electron-rebuild，CI 時跳過）。`NODE_MODULE_VERSION mismatch` 的處置改為 `npx electron-rebuild -f -w better-sqlite3`，並明寫**不要**用 `npm rebuild better-sqlite3`（附 T0473 實測原因）。
- 「本機開發：npm 12 install scripts」節（標題加上 T0473）：
  - 新增：`allowScripts` 內容、npm 12 `npm ci` 零手動步驟、electron-winstaller 不列入的理由、npm 11 對 `allowScripts` 的行為、`allowScripts` 屬政策（變更需塔台決策）、根 postinstall 的新做法、CI 段（`CI=true` 跳過的理由與 server bundle ABI）。
  - 補跑表保留，改成「只在 `--ignore-scripts` 安裝、`allowScripts` 被改掉、或單一套件損壞時才需要」，並移除 electron-winstaller 那一列。
  - 移除已過時的兩句：「不要執行 `npm install-scripts approve`」，以及「`verify-native-modules.js` **抓不到**」。
- 「Packaging / Release 前置檢查」的 Build fail-fast：補 T0472 新增的內嵌 claude（PE / ELF / Mach-O，不能是 500 bytes stub）與 `better_sqlite3.node` 存在檢查（不載入、不驗 ABI），並寫明 desktop host 缺失 exit 1、其他 host 只 warn。

### 驗證結果

| 閘門 | 結果 | 證據 |
|---|---|---|
| npm 12：`npm ci` 零手動步驟 | **PASS** | repo 根目錄 `npm ci`（npm 12.2.0，最終版 `package.json`）exit 0，16 s。輸出有 `✔ Rebuild Complete` 與 `'postinstall done'`，被擋清單只剩 `electron-winstaller@5.4.0` |
| ↳ `npm install-scripts ls` | **PASS** | 只列出 `electron-winstaller@5.4.0`（預期中的例外） |
| ↳ `node scripts/verify-native-modules.js` | **PASS** | exit 0：`✅ All 3 required native modules present, whisper binary: ...\win32-x64\whisper.node, embedded claude: native, better-sqlite3: .node present` |
| ↳ 內嵌 claude `--version` | **PASS** | `node_modules/@anthropic-ai/claude-code/bin/claude.exe` 249,522,848 bytes，輸出 `2.1.289 (Claude Code)` |
| ↳ better-sqlite3 在 Electron 下可開 `:memory:` | **PASS** | `ELECTRON_RUN_AS_NODE=1 electron.exe probe.js` 輸出 `LOAD OK electron 41.2.1 modules=145`（`new Database(':memory:').prepare('select 1').get()`），sha256 `4f6500f1…2e79e71`；Node 下載入失敗屬預期 |
| ↳ 其他被放行的套件 | PASS | `electron --version` = `v41.2.1`；`esbuild` `0.27.7`；`sharp` `0.34.5` |
| npm 11（CI 版本 11.19.0）：無錯誤、行為不變 | **PASS** | scratchpad 複製 `package.json` + lock，`CI=true npx -y npm@11.19.0 ci`：新版 exit 0（15 s），印 `postinstall: CI is set, skipping ...`，`allowScripts` 相關警告只有 electron-winstaller 一行（舊版有 6 個套件的警告）。舊版（HEAD `package.json`）對照組 exit 0。兩邊 `diff -rq node_modules` 排除 `.package-lock.json` 後 **0 差異**（`.package-lock.json` 內容相同，只差在對照組佈置造成的換行），better-sqlite3 兩邊都是 `d6d1f318…`（Node ABI，與改動前相同） |
| ↳ 接著跑桌面 CI 的 `npx --yes @electron/rebuild` | PASS | exit 0，1 s，better-sqlite3 變成 `4f6500f1…`，Electron 下載入 OK（`npm ci` → `@electron/rebuild` 的順序與結果不變） |
| npm 11 非 CI（一般開發者） | **PASS** | `npx -y npm@11.19.0 ci`（不設 `CI`）exit 0，15 s，postinstall 印 `✔ Rebuild Complete`。better-sqlite3 為 `4f6500f1…`：Electron OK、Node 失敗（預期） |
| postinstall ABI 結論 | **完成** | 見產出摘要第 2 點（Node ABI → 已修正） |
| `npx vite build` | **PASS** | exit 0 |
| `npm run test:unit` | **PASS** | exit 0，`Test Files 173 passed (173)`、`Tests 2920 passed \| 1 skipped (2921)`，0 failed。node-pty 的 `AttachConsole failed` 雜訊同 T0471 / T0472 |
| `node scripts/verify-native-modules.js` | **PASS** | exit 0（同上） |
| `node scripts/verify-helper-bundle.js` | **PASS** | exit 0：`OK — all 15 helper .mjs files in extraResources are reachable via filter; server bundle ships 4 helper(s) with a closed import set` |

範圍外、未執行：CI 實跑（下次 pre-release 時才會驗證）；mac 的 `plutil` 段沒動，也沒有 mac 環境可以實測；Linux / mac 的本機 npm 12。

清理：scratchpad 的 `abi11/`、`ci11-old/`、`ci11-new/`、`dev11/` 測試目錄已刪除，只留 log 與 `probe.js`。

### 偏差 / 給塔台的備註

- **偏差 1**：electron-winstaller 先寫了 deny，實測後改成不列入（理由見產出摘要第 1 點）。最終版 `package.json` 沒有 electron-winstaller 這一項。
- **偏差 2**：postinstall 多加了 `CI` 判斷，工單只要求「改成產出 Electron ABI」。不加的話 server-bundle job 會打包 Electron ABI 的 better-sqlite3，CI 也會多 rebuild 一次（見產出摘要第 2 點）。
- **並行注意**：執行期間 T0474（研究單，不動 `node_modules`）同時在跑，它的工單檔在工作樹上有改動。本單 commit 用 `--only`，不含 T0474。
- **待塔台決策**：
  1. better-sqlite3 是沒有任何程式使用的相依，是否移除（見產出摘要第 2 點末段）。
  2. `_decision-log.md:1087`（T0160）對 postinstall 的描述與實測不符，是否補註。
- Commit：只 commit 本工單檔、`package.json`、`CLAUDE.md`（`node_modules` 不進 git）；不 push。

### 回報時間

2026-10-13T16:56:49+08:00
