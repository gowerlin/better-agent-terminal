---
schema_version: 1
schema_kind: workorder
id: T0471
title: "本機開發環境 npm 12 預設擋 install scripts：補跑 claude-code 安裝腳本、確認 postinstall（npm rebuild better-sqlite3）行為，並在 CLAUDE.md 記錄本機安裝步驟"
type: implementation
status: DONE
repo: better-agent-terminal
project: dev-env
priority: P2
sizing: S
created_at: "2026-10-13T16:17:57+08:00"
started_at: "2026-10-13T16:23:06+08:00"
updated_at: "2026-10-13T16:26:57+08:00"
completed_at: "2026-10-13T16:26:57+08:00"
target_version: next
depends_on:
  - T0470
related:
  - "T0467 回報區「repo node_modules 修復」：本機 npm 12.2.0（Node v24.21.0）`npm ci` 後 electron / esbuild / sharp / better-sqlite3 / claude-code / electron-winstaller 的 install scripts 被擋；已手補前四者，`@anthropic-ai/claude-code` 的 `install.cjs` 未補；未執行 `npm install-scripts approve`（會改 package.json）"
  - "CI 用 actions/setup-node node-version '24'（隨附 npm，非 12）→ 本單只處理本機"
affects_files:
  - node_modules/
  - CLAUDE.md
  - scripts/
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **不改 `package.json` / `package-lock.json`**（不執行 `npm install-scripts approve`、不加 allow-scripts 設定到 tracked 檔）；不執行 `npm ci` / `npm install`（node_modules 已由 T0467 還原，只補跑被擋的腳本）。若結論是「必須改 package.json 才合理」，回報區給方案與利弊，由塔台裁決"
  - "🔴 不升降級使用者的全域 node / npm；可唯讀查詢 `npm config`、npm 12 的 install-scripts 相關文件"
  - "🔴 禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`；寫檔維持 LF；不 push"
---

# T0471 — 本機 npm 12 install scripts

## 任務

1. 確認現況：npm 12 擋了哪些套件的哪些 lifecycle script（含本 repo 自己的 `postinstall`：`npm rebuild better-sqlite3` 是否也被擋）；以 `npm query` / `npm ls` / npm 12 文件為依據
2. 補跑 `@anthropic-ai/claude-code` 的安裝腳本，確認內嵌 claude 可用：`node_modules` 內 claude 執行檔 `--version` 輸出 `2.1.289`（以 `electron/claude-resolver.ts` 的 embedded 解析邏輯找到的路徑為準）
3. 其他被擋但未補的腳本（如 `electron-winstaller`）逐一判斷是否影響本機 dev / 本機打包（`release.ps1`），需要就補跑
4. `CLAUDE.md` 新增短節「本機開發：npm 12 install scripts」：症狀、被擋清單、補跑指令（或一支 `scripts/` 下的輔助腳本，若做了）、CI 不受影響的原因
5. 驗證：`npx vite build` exit 0；`npm run test:unit` 0 failed；`node scripts/verify-native-modules.js` exit 0

## 驗收條件

- [x] 內嵌 claude `--version` = `2.1.289`（證據）
- [x] 被擋腳本清單與處置表（補跑 / 不需要 + 理由）
- [x] CLAUDE.md 新節；上述三項驗證綠

## Sub-session 執行指示

1. 讀本工單 + T0467 回報區「repo node_modules 修復」段
2. 填 `started_at`、`status: IN_PROGRESS`（取系統時間，R-G001）
3. 實作 → 驗收 → 填回報區 → `DONE`；commit 本單檔案（node_modules 不進 git）；不 push；依派發 mode 通知塔台

---

## 回報區

### 完成狀態

DONE。三項驗收條件全數達成。

Landing Zone Check：**PASS**
- C-0：frontmatter `repo: better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`，REPO_ROOT = `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal` → PASS
- C-1：工單位於 REPO_ROOT 下 → PASS
- C-3：`node_modules/`、`CLAUDE.md`、`scripts/` 皆存在 → PASS（C-0 已 PASS，此項僅供參考）
- C-2：無 `branch` 欄位；HEAD = `main`
- `BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）
- 環境：Node v24.21.0 / npm 12.2.0；`CT_MODE=yolo`、`CT_INTERACTIVE=0`

### 產出摘要

**1. 現況確認**（`npm install-scripts ls`，唯讀；npm 12 文件 `docs/content/commands/npm-install-scripts.md`、`using-npm/config.md`；npm 原始碼 `@npmcli/arborist/lib/arborist/rebuild.js` 的 allowScripts gate、`lib/commands/ci.js` / `install.js` 的 root lifecycle）

- 本 repo `package.json` 無 `allowScripts`，`npm config`：`allow-scripts=`、`dangerously-allow-all-scripts=false`、`strict-allow-scripts=false`、`ignore-scripts=false`；repo 無 `.npmrc`
- 6 個相依套件被擋：`better-sqlite3@12.9.0`（install）、`electron@41.2.1`（postinstall）、`electron-winstaller@5.4.0`（install）、`esbuild@0.27.7`（postinstall）、`sharp@0.34.5`（install）、`@anthropic-ai/claude-code@2.1.289`（postinstall）
- **根專案自己的 `postinstall` 會跑**（`ci.js` / `install.js` 的 `runRootScript` 不經 allowScripts），**但其中的 `npm rebuild better-sqlite3` 被擋成 no-op**：rebuild 走 arborist 同一個 gate。實測：先把 `better_sqlite3.node` 備份到 scratchpad，跑 `npm rebuild better-sqlite3` → `npm warn rebuild 6 packages had install scripts blocked ...`、`rebuilt dependencies successfully`、exit 0，binary sha256 前後皆 `4f6500f1…2e79e71`、mtime 不變 → 確認被擋（T0467 的「未驗證」已驗證）

**2. 補跑 claude-code**：`node node_modules/@anthropic-ai/claude-code/install.cjs` exit 0。`bin/claude.exe` 由 500 bytes stub（內容為 `Error: claude native binary not installed.` 腳本）變成 249,522,848 bytes 的 hardlink（link count 2，來源 `@anthropic-ai/claude-code-win32-x64`）

**3. 被擋腳本處置表**

| 套件 | 狀態 | 處置 | 理由 / 證據 |
|---|---|---|---|
| `electron` | T0467 已補 | 不需再跑 | `path.txt` = `electron.exe`，`dist/electron.exe` 存在，`electron --version` = `v41.2.1` |
| `esbuild` | T0467 已補 | 不需再跑 | `require('esbuild').version` 與 `.bin/esbuild --version` 皆為 `0.27.7` |
| `sharp` | T0467 已補 | 不需再跑 | `require('sharp').versions.sharp` = `0.34.5`（`@img/sharp-win32-x64`） |
| `better-sqlite3` | T0467 已補（electron-rebuild） | 不需再跑 | Electron（`ELECTRON_RUN_AS_NODE=1`）下 `new Database(':memory:')` OK，`process.versions.modules` = `145`；Node 下 `require` 失敗屬正常（ABI 145 binary） |
| `@anthropic-ai/claude-code` | 未補 | **本單補跑** | 見第 2 點；驗收證據見下 |
| `electron-winstaller` | 未補 | **不需要** | 只供 Squirrel.Windows：相依鏈 `electron-builder → app-builder-lib → electron-builder-squirrel-windows → electron-winstaller`；`build.win.target` = `nsis` + `zip`，`.vscode/scripts/release.ps1` 走 `npm run build:release` → `build-version.js` → `npm run build`，無 squirrel |

另一個發現：`build.npmRebuild` = `false`，electron-builder 直接打包 `node_modules` 現況（`asarUnpack` 含 claude-code）。T0471 前若在本機跑 `release.ps1`，產出的安裝檔內嵌 claude 會是 stub；`verify-native-modules.js` 只檢查套件 `package.json` 存在與 whisper `.node`，抓不到 stub / 缺 `.node`。

**4. CLAUDE.md**：在「Electron Runtime」之後新增「本機開發：npm 12 install scripts（T0471）」節，內容：症狀、根 `postinstall` 為何無效、被擋清單 + 補跑指令表、本機打包的影響（`npmRebuild: false`）、不要執行 `npm install-scripts approve`、CI 不受影響的原因。同時在「Electron Runtime」既有那條「先執行 `npm rebuild better-sqlite3`」後補一句「npm 12 下此步被擋成 no-op，改用下節的 `electron-rebuild`」。未新增 `scripts/` 輔助腳本：只有 5 行固定指令，寫在文件裡已夠用，也免得 `scripts/*.mjs` 受 `verify-helper-bundle.js` 掃描。

**CI 前提核實**：nodejs.org `dist/index.json`：Node v24.21.0（2026-09-07）隨附 npm **11.19.0**（v24.17–24.21 皆為 npm 11.x）；所有 workflow 的 `setup-node` 都是 `node-version: '24'`，grep 不到 `npm install -g npm` / `npm@`。本機的 npm 12.2.0 是另外全域升級的（nvm4w）。⇒ CI 不受影響，工單前提成立。

**未改 tracked 檔**：`package.json` / `package-lock.json` 未動；未執行 `npm install-scripts approve` / `npm ci` / `npm install`；未升降級全域 node / npm。

### 驗證結果

| 閘門 | 結果 | 證據 |
|---|---|---|
| 內嵌 claude `--version` | **PASS** | 用 tsx 載入真實的 `electron/claude-runtime-router.ts`，`resolveEmbeddedClaudePath({ kind: 'node-modules' })` → `...\node_modules\@anthropic-ai\claude-code\bin\claude.exe`；`execFileSync(p, ['--version'])` → `2.1.289 (Claude Code)` |
| `node scripts/verify-native-modules.js` | **PASS** | exit 0，`✅ All 3 required native modules present, whisper binary: node_modules\@kutalia\whisper-node-addon\dist\win32-x64\whisper.node` |
| `npx vite build` | **PASS** | exit 0 |
| `npm run test:unit` | **PASS** | exit 0，`Test Files 172 passed (172)`、`Tests 2900 passed \| 1 skipped (2901)`（輸出夾有 `Error: AttachConsole failed` 的 node-pty conpty 雜訊，不影響結果） |
| better-sqlite3 未被動到 | PASS | 全部操作後 sha256 仍為 `4f6500f1…2e79e71` |

Runtime smoke（`npm run dev` 開 Claude 面板）與本機打包：本單未做，範圍外。

### 偏差 / 給塔台的備註

- 無範圍偏差。
- 待塔台決策（本單不處理）：
  1. 是否在 `package.json` 加 `allowScripts`（approve 上述 5 個，`electron-winstaller` deny）。好處：本機 npm 12 的 `npm ci` 能自動完成，根 `postinstall` 也恢復作用。代價：改 tracked 政策檔；npm ≤ 11（CI）會忽略這個欄位；pinned entry 在每次升版都要重新 approve。
  2. `verify-native-modules.js` 可加檢查：claude-code `bin/claude.exe` 大小 > 4 KB（不是 stub）、`better-sqlite3/build/Release/better_sqlite3.node` 存在。這樣本機打包前就會失敗，不會產出壞的安裝檔。
  3. 「Electron Runtime」那條建議用 `npm rebuild better-sqlite3` 解 `NODE_MODULE_VERSION mismatch`。在 npm ≤ 11 下它可能裝的是 Node ABI 的 prebuilt，而非 Electron ABI 145（本單未驗證，CI 是靠 `@electron/rebuild` 修正）。建議另案查證。
- Commit：只 commit 本工單檔 + `CLAUDE.md`（`node_modules` 不進 git），不 push。

### 回報時間

2026-10-13T16:26:20+08:00
