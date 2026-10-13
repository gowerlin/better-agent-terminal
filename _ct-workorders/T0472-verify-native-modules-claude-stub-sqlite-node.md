---
schema_version: 1
schema_kind: workorder
id: T0472
title: "verify-native-modules.js 加檢查：內嵌 claude-code 執行檔不是 stub、better-sqlite3 原生 .node 存在（T0471 建議 2）"
type: implementation
status: DONE
repo: better-agent-terminal
project: dev-env
priority: P1
sizing: S
created_at: "2026-10-13T16:39:22+08:00"
started_at: "2026-10-13T16:41:10+08:00"
updated_at: "2026-10-13T16:46:05+08:00"
completed_at: "2026-10-13T16:46:05+08:00"
target_version: v0.6.0-pre.3
depends_on:
  - T0471
related:
  - "T0471 回報區：npm 12 擋 install scripts 時 claude-code `bin/claude.exe` 是約 500 bytes 的 stub（內容 `Error: claude native binary not installed.`），`build.npmRebuild: false` 下會被原樣打進安裝檔；現行 verify 抓不到"
  - "T0468：verify-native-modules.js 已有 host 平台 whisper binary 檢查（WHISPER_ADDON_REQUIRED_HOSTS 只擋桌面 host、其他 host warn）"
affects_files:
  - scripts/verify-native-modules.js
  - scripts/__tests__/
  - electron/__tests__/whisper-addon-loader.test.ts
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **不得讓任何既有 CI 呼叫點失敗**：呼叫者有 `pre-release.yml`（三平台 build job，於 `npm ci` + `@electron/rebuild` 之後）、`release.yml`（經 `build-version.js` side-effect require）、`build-server-bundle.yml:46`（含 `ubuntu-22.04-arm` 等非桌面 host，可能沒有 `@electron/rebuild`）。逐一讀這些 workflow 判斷各 host 在新檢查下的結果；不確定會通過的 host → 只 warn 不擋（比照 T0468 `WHISPER_ADDON_REQUIRED_HOSTS` 作法），回報區附各呼叫點 × host 的預期結果表"
  - "🔴 不改 `CLAUDE.md`（塔台會補一句文件）、不改 `package.json` / lock、不跑 `npm ci` / `npm install`（下一張 T0473 才會動 package.json 與 node_modules）"
  - "🔴 禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`；寫檔維持 LF；不 push"
---

# T0472 — verify-native-modules：claude stub 與 better-sqlite3 .node

## 任務

1. **內嵌 claude 不是 stub**：解析 host 平台的內嵌 claude 執行檔路徑（規則與 `electron/claude-runtime-router.ts` / `electron/claude-resolver.ts` 的 embedded 解析一致，例如 `node_modules/@anthropic-ai/claude-code/bin/claude(.exe)`；若由平台子套件提供，以實際規則為準）。判定 stub 以**內容 / 型態**為主（stub 腳本特徵字串、或非原生執行檔 magic bytes），大小門檻只作輔助；stub 或不存在 → 錯誤，訊息指向 CLAUDE.md「本機開發：npm 12 install scripts」節的補跑指令
2. **better-sqlite3 原生模組存在**：`node_modules/better-sqlite3/build/Release/better_sqlite3.node` 存在（只檢查存在，不檢查 ABI——本腳本以 Node 執行，Node 與 Electron ABI 不同）
3. 單元測試：以暫存假 node_modules 樹覆蓋 stub / 真執行檔 / 缺檔 / 非桌面 host warn 路徑；既有 whisper 規則 parity 測試不得壞
4. 本機實跑 `node scripts/verify-native-modules.js` → exit 0（T0471 後本機已完整）；並在 scratchpad 假樹上證明 stub 會 exit 1

## 驗收條件

- [ ] 新測試綠；`npm run test:unit` 全套 0 failed（基線 2900）
- [ ] 本機 verify exit 0；stub 情境 exit 1 + actionable 訊息
- [ ] 回報區附「呼叫點 × host × 預期結果」表

## Sub-session 執行指示

1. 讀本工單 + T0471 回報區 + `scripts/verify-native-modules.js` + 三個 workflow 呼叫點
2. 填 `started_at`、`status: IN_PROGRESS`（取系統時間，R-G001）
3. 實作 → 驗收 → 填回報區 → `DONE`；commit 本單檔案；不 push；依派發 mode 通知塔台

---

## 回報區

### 完成狀態

DONE。三項驗收條件全數達成。

Landing Zone Check：**PASS**
- C-0：frontmatter `repo: better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`，REPO_ROOT = `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal` → PASS
- C-1：工單位於 REPO_ROOT 下 → PASS
- C-3：`scripts/verify-native-modules.js`、`scripts/__tests__/`、`electron/__tests__/whisper-addon-loader.test.ts` 皆存在 → PASS（C-0 已 PASS，僅供參考）
- C-2：無 `branch` 欄位；HEAD = `main`
- `BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）
- 環境：`CT_MODE=yolo`、`CT_INTERACTIVE=0`；Node v24.21.0

### 產出摘要

**改動檔案**
- `scripts/verify-native-modules.js`（LF）：whisper 檢查之後新增 `verifyEmbeddedRuntime(projectRoot, platform, arch)`，`main()` 在 desktop host 有問題時 exit 1，其他 host 只 warn。既有兩段檢查（套件 `package.json`、whisper binary）的行為與訊息不變；`WHISPER_ADDON_REQUIRED_HOSTS` 內容不變，改成指向新常數 `DESKTOP_PACKAGE_HOSTS`。新增匯出：`EMBEDDED_RUNTIME_REQUIRED_HOSTS`、`CLAUDE_STUB_MARKER`、`classifyEmbeddedClaude`、`executableFormat`、`verifyEmbeddedRuntime`
- `scripts/__tests__/verify-native-modules.test.mjs`（新檔，20 tests）
- `electron/__tests__/whisper-addon-loader.test.ts`：**未改**（parity 測試沿用，照常通過）

**1. 內嵌 claude 不是 stub**
- 路徑：`node_modules/@anthropic-ai/claude-code/bin/claude.exe`，所有平台都是這個檔名。依據：`resolveEmbeddedClaudePath()`（`electron/claude-runtime-router.ts:142`）在 node-modules / electron-packaged layout 一律用 `claude.exe`（BUG-052）；`install.cjs` 也是把 host 平台子套件的 binary 寫到 `bin/claude.exe`（hardlink 或複製）。`bin/claude` 只出現在 server-bundle 的輸出，不在 `node_modules` 裡
- 判定以**內容 / 型態**為主：讀檔案開頭 4 KiB
  - `native`：magic bytes 符合 host 格式（win32 → PE `MZ`、linux → ELF `\x7fELF`、darwin → Mach-O `feedface`/`feedfacf`（兩種 byte order）或 fat `cafebabe`；其他平台接受任一種）
  - `stub`：含 `claude native binary not installed`（上游 2.1.289 stub 的字串，已用 `npm pack` 取得原檔確認：500 bytes 的 shell script，sha256 `6d7abae0…830d7b`），或「不是可執行檔且 < 4096 bytes」。大小只用來補判，門檻與 `install.cjs` 判斷 stub 大小用的 4096 相同
  - `not-native`：其他情況（例如別的平台的 binary，或不是可執行檔的大檔案）
  - `missing`：檔案不存在，或該路徑是目錄
- 錯誤訊息包含：路徑、找到的內容（大小 + 判定）、可能原因、修正指令 `node node_modules/@anthropic-ai/claude-code/install.cjs` 與 `--version` 驗證方式，並指向 `CLAUDE.md section "本機開發：npm 12 install scripts（T0471）"`

**2. better-sqlite3 原生模組**：只檢查 `node_modules/better-sqlite3/build/Release/better_sqlite3.node` 存在，不載入、不檢查 ABI。缺檔時的修正指令：`npx electron-rebuild -f -w better-sqlite3`（本機）；CI 是 `npm ci` + `npx --yes @electron/rebuild`

**3. Host 範圍**：`EMBEDDED_RUNTIME_REQUIRED_HOSTS` = `DESKTOP_PACKAGE_HOSTS` = `win32-x64` / `linux-x64` / `darwin-x64` / `darwin-arm64`，與 T0468 的 whisper 規則相同。其他 host（實際上就是 server-bundle 的 `linux-arm64` runner）只印一行 `⚠️ … not a desktop package host, not fatal.`

### 呼叫點 × host × 預期結果

CI 的前提（T0471 已核實）：所有 workflow 用 `setup-node` `node-version: '24'`，npm 11.19.0，**install scripts 會執行**；repo 沒有 `.npmrc`，`npm ci` 也沒帶 `--ignore-scripts` / `--omit`。lock 檔已收錄 claude-code 的 8 個平台子套件（`package-lock.json:249-352`，含 `linux-arm64`）。better-sqlite3 的 install script 是 `prebuild-install || node-gyp rebuild --release`，兩種路徑的產物都放在 `build/Release/better_sqlite3.node`。

| 呼叫點 | runner → host | 前置步驟 | claude.exe | better_sqlite3.node | 新檢查預期 |
|---|---|---|---|---|---|
| `pre-release.yml:185` build job | `windows-latest` → win32-x64 | `npm ci` + `@electron/rebuild` | postinstall 放入 PE | prebuild / rebuild 產出 | ✅ PASS（會擋） |
| 同上 | `macos-latest` → darwin-arm64 | 同上 | Mach-O arm64 | 同上 | ✅ PASS（會擋） |
| 同上 | `ubuntu-latest` → linux-x64 | 同上 | ELF | 同上 | ✅ PASS（會擋） |
| `release.yml:161` 經 `build-version.js:123` require | windows / macos / ubuntu-latest（同上三個 host） | `npm ci` + `@electron/rebuild`（:140-146） | 同上 | 同上 | ✅ PASS（會擋） |
| `build-server-bundle.yml:46` | `ubuntu-22.04` → linux-x64 | 只有 `npm ci` | ELF | prebuild-install（Node ABI，只檢查存在）；失敗時走 node-gyp | ✅ PASS（會擋） |
| 同上 | `ubuntu-22.04-arm` → linux-arm64 | 只有 `npm ci` | 預期是 ELF（lock 有 `linux-arm64` 子套件） | 預期存在 | ⚠️ 不擋：就算出問題也只 warn（非 desktop host，無法在本機驗證） |
| 同上 | `macos-14` → darwin-arm64 | 只有 `npm ci` | Mach-O | prebuild-install | ✅ PASS（會擋） |
| `package.json` `build` / `build:dir`、本機 `release.ps1`（經 `build-version.js`） | 本機 win32-x64 | npm 12 下需先照 CLAUDE.md 補跑 | 本機已補（T0471） | 本機已補（T0467） | ✅ 本機實跑 exit 0；沒補就 exit 1（這正是本單的目的） |

`pre-release.yml` / `release.yml` 的 `server-bundle` job（:60-72 / :25-37）**不呼叫** verify-native-modules，不受影響。

### 驗證結果

| 閘門 | 結果 | 證據 |
|---|---|---|
| 新測試 | **PASS** | `npx vitest run scripts/__tests__/verify-native-modules.test.mjs scripts/__tests__/verify-packaged-native.test.mjs electron/__tests__/whisper-addon-loader.test.ts` → 3 files, 54 passed。新測試涵蓋：magic bytes 辨識；native（假 PE / ELF / Mach-O，以及實際的 `process.execPath`）；stub（照上游格式、內容補到超過 4 KiB 仍判 stub、改字但很小的腳本）；不是可執行檔的大檔案；別平台 binary；缺檔 / 目錄；desktop host 擋；`linux-arm64` 只 warn 不擋；CLI 在暫存假樹上 exit 0 / stub exit 1 / 缺 `.node` exit 1，並檢查訊息內容 |
| whisper parity 測試 | **PASS** | `whisper-addon-loader.test.ts` 的 `matches the copy in scripts/verify-native-modules.js` 與 `verify-packaged-native.test.mjs` 的 mac 規則 parity 都通過 |
| `npm run test:unit` 全套 | **PASS** | `Test Files 173 passed (173)`、`Tests 2920 passed \| 1 skipped (2921)`，0 failed（基線 2900 + 新增 20）。輸出裡的 node-pty `AttachConsole failed` 雜訊與 T0471 記錄的相同，不影響結果 |
| 本機 `node scripts/verify-native-modules.js` | **PASS** | exit 0，`✅ All 3 required native modules present, whisper binary: node_modules\@kutalia\whisper-node-addon\dist\win32-x64\whisper.node, embedded claude: native, better-sqlite3: .node present` |
| scratchpad 假樹 + **真的上游 stub** | **PASS** | 把腳本複製到 `<scratchpad>/fake-root/scripts/`，`bin/claude.exe` 放 `npm pack @anthropic-ai/claude-code@2.1.289` 取出的原始 stub → exit 1，`found: 500 bytes, the npm placeholder stub (...)` + install.cjs 修正指令 + CLAUDE.md 節名。再刪掉 `better_sqlite3.node` → 兩個 ❌ 都列出，exit 1 |
| `npx vite build` | **PASS** | exit 0 |

範圍外、未執行：CI 實跑（下次 pre-release 時才會驗證上表）、本機打包。

### 偏差 / 給塔台的備註

- 無範圍偏差。沒改 `CLAUDE.md` / `package.json` / lock；沒跑 `npm ci` / `npm install`。`npm pack` 只把 tarball 下載到 scratchpad 解開來看，沒動 `node_modules`
- 塔台補 CLAUDE.md 時可寫進：「Packaging / Release 前置檢查」那段提到「`verify-native-modules.js` … **抓不到**這兩種情況」，本單完成後已經抓得到了，該句需要更新
- **待查（本單未驗證，建議另開一張）**：mac 的 x64 dmg 可能內嵌 arm64 的 claude。macOS CI 只有 arm64 host，`install.cjs` 只把 host 平台（`darwin-arm64`）的 binary 放進 `bin/claude.exe`；`build.npmRebuild: false` 時兩個 arch 都直接打包同一份 `node_modules`，x64 dmg 很可能帶著 arm64 Mach-O，Intel Mac 會無法啟動內嵌 claude。這和 T0470 處理的 whisper 是同一類問題（host 檢查看不到 x64），本單的 host 檢查同樣看不到。可以比照 T0470 用 `verify-packaged-native.js` 檢查各 `.app` 裡 `claude.exe` 的 Mach-O cputype

### 回報時間

2026-10-13T16:45:12+08:00
