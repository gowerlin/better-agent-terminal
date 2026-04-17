# EXP-BUILDER26-001 — electron-builder 24→26 升級可行性驗證

## 元資料
- **實驗編號**：EXP-BUILDER26-001
- **類型**：experiment（EXP worktree 隔離實作）
- **互動模式**：✅ 允許（config 格式、yml 遷移、打包異常可問使用者）
- **狀態**：📊 CONCLUDED
- **優先級**：🟢 Low（技術債清除，無阻塞）
- **派發時間**：2026-04-18 04:25 (UTC+8)
- **開始時間**：2026-04-18 04:36 (UTC+8)
- **Worker 完成時間**：2026-04-18 04:59 (UTC+8)
- **使用者驗收時間**：2026-04-18 05:25 (UTC+8)（Step 5.4 installer 安裝 + app smoke test 通過）
- **CONCLUDED 時間**：2026-04-18 05:25 (UTC+8)
- **Merge commit**：`75bb77f`（merge --no-ff `exp/builder26` → main）
- **Worker 結論**：✅ 所有 Worker 可做項目通過（Step 1–8、5.5）；Step 5.4（使用者手動安裝 smoke test）✅ 使用者驗收通過 → 正式 CONCLUDED
- **TOPIC**：BUILDER26（electron-builder 升級）
- **關聯 PLAN**：PLAN-005（Electron Builder 升級）、PLAN-003（Group A — 9 個 electron-builder 鏈漏洞）
- **關聯決策**：D054（PLAN-005 採 EXP worktree 模式，Windows 完整驗收 + 跨平台 YAML dry-run）
- **前序工單**：T0163（vite 5→7 升級 DONE，commit `83ae7cf`）
- **預計 Worker time**：4-6 小時

---

## 目標

在 EXP worktree 中驗證 `electron-builder 24.x → 26.8.1` 升級可行性，**成功則 PR/merge 回主線，失敗則丟棄 worktree 主線零污染**。

### 實驗假設

1. electron-builder 24→26 屬 semVerMajor，可能有 `electron-builder.yml` / package.json `build` 欄位的 breaking changes，但**不至於重寫整個打包流程**
2. 升級後漏洞清除：`@tootallnate/once` / `app-builder-lib` / `builder-util` / `dmg-builder` / `electron-builder` / `electron-builder-squirrel-windows` / `electron-publish` / `http-proxy-agent` / `tar`（部分）共 **9 個 CVE**
3. Windows NSIS installer 打包路徑不需要大改（主要是 macOS notarization + Apple Silicon universal binary 的新特性，但我們暫不驗收）
4. 當前主線（commit `83ae7cf`）已升 vite 7，Electron 41，builder 26 在此基礎上疊加驗收風險可控

### 實驗範圍

- **直接依賴**：`electron-builder: ^24.0.0 → ^26.8.1`
- **間接依賴**：npm 自動升級 `dmg-builder` / `electron-builder-squirrel-windows` / `electron-publish` / `app-builder-lib` / `builder-util` / `http-proxy-agent` / `@tootallnate/once` / `tar`（electron-builder 子鏈）
- **Config migration**：`electron-builder.yml` 或 package.json `build` 欄位（視專案當前組態）
- **驗收平台**：Windows 完整打包；macOS/Linux YAML dry-run

---

## 前置條件（Worker 必讀）

### Step 0：建立 worktree（使用者執行，Worker 不做）

```bash
# 在主線根目錄執行
git worktree add ../better-agent-terminal-builder26 -b exp/builder26
cd ../better-agent-terminal-builder26
# 本工單檔案 EXP-BUILDER26-001-*.md 已在 worktree 的 _ct-workorders/ 內（git worktree 會繼承所有 tracked files）
```

之後 Worker 在 worktree 目錄（`../better-agent-terminal-builder26`）開新 sub-session 執行此工單。

### 當前環境狀態（前序工單結果）

- **主線 commit**：`83ae7cf`（T0163 DONE：vite 7.3.2 + plugin 連動）
- **Electron**：41.2.1（PLAN-016 Phase 2 DONE，D051）
- **electron-builder**：24.x（**本工單目標升級**）
- **剩餘漏洞（升 builder 26 前）**：11 個
  - Group A：9 個 electron-builder 鏈（本 EXP 目標）
  - Group C：2 個 whisper-node-addon → cmake-js → tar 鏈（WONTFIX）

### electron-builder 24→26 已知重點 breaking changes（Worker 升級前自查）

> Worker 執行 Step 1 時請 WebFetch / `npm view` 確認以下項目當前文件最新版（清單僅為研究線索）：

1. **Node 版本要求**：electron-builder 26 要求 Node 20+（本專案 Electron 41 自帶 Node 24，CI 若有需確認）
2. **config 格式變更**：
   - `afterSign` / `afterAllArtifactBuild` hook 簽章可能變化
   - `publish` 欄位（GitHub releases / S3 等）的 API 變動
   - Windows `signtoolOptions` 取代 `signingHashAlgorithms`（可能）
3. **`electron-notarize` 整合**：electron-builder 26 內建 notarization，若有用 `electron-notarize` 獨立套件可能可移除
4. **`appx` / `msix` / `snap` / `appimage`**：新打包目標格式的 config 可能有小改動（本專案以 NSIS 為主，影響小）
5. **peer dependency**：electron-builder 26 對 `electron` 版本的 peer 範圍（應相容 Electron 41）

---

## 執行步驟

### Step 1：前置盤點（在 worktree 中）

1. 讀取當前 `package.json` `scripts` / `build` 欄位 / `devDependencies.electron-builder`
2. 讀取 `electron-builder.yml`（若存在）完整內容並備份到工單「執行紀錄」
3. 讀取 `build/`、`installer/` 等打包資源目錄結構（若有）
4. `grep -rn "afterSign\|afterAllArtifactBuild\|afterPack\|signingHashAlgorithms\|electron-notarize" .` 盤點自訂 hook / 簽章設定
5. 執行 `npx electron-builder --version` 確認當前實裝版本（應為 24.x）
6. WebFetch electron-builder 官方 release notes（25.0、26.0 changelog）摘要寫入工單

**盤點產出**（必填表格）：

| 項目 | 命中 | 影響評估 |
|------|------|---------|
| `electron-builder.yml` 存在 | ? | ? |
| `build` 在 package.json | ? | ? |
| 自訂 `afterSign` / `afterPack` | ? | ? |
| `electron-notarize` 套件使用 | ? | ? |
| `signingHashAlgorithms` 用法 | ? | ? |

### Step 2：升級 package.json

**目標**（以 npm registry 當下為準）：

```json
{
  "devDependencies": {
    "electron-builder": "^26.8.1"
  }
}
```

> Worker 先執行 `npm view electron-builder version` 確認 26.8.1 為當前 stable；若有更新的 26.x patch（如 26.8.2），可採用最新 26.x。不要升至 27.x（若已有 GA）。

### Step 3：執行 `npm install`

⚠️ **警示（L040）**：Windows + VSCode 環境 `npm install` 前需關閉 VSCode 或使用外部終端（PowerShell / Windows Terminal）。

1. 若 VSCode 正開啟此 worktree 目錄 → 停工單，告知使用者
2. 外部終端執行 `npm install`
3. 觀察 postinstall（`npm rebuild better-sqlite3`）無異常
4. 記錄 install 耗時 + 升級的套件清單（`npm list electron-builder app-builder-lib builder-util`）

### Step 4：Config migration（依 Step 1 盤點結果）

逐項處理 Step 1 發現的自訂 hook / 設定：

- 若有 `signingHashAlgorithms` → 依 electron-builder 26 文件改為 `signtoolOptions`（若有 deprecation）
- 若有 `afterSign` + `electron-notarize` → 評估是否改用 electron-builder 26 內建 notarization
- YAML / build 欄位其他 breaking changes 處理

**修改後附 diff 到工單「執行紀錄」**。

### Step 5：Windows 完整打包驗收

**Step 5.1：Compile 驗收**
```bash
npm run compile
```
確認 `dist/` + `dist-electron/` 產出無誤（這部分 vite 已在 T0163 驗收，本工單只確認未受 builder 升級影響）。

**Step 5.2：Dry-run 驗收（跨平台 config parse）**
```bash
npm run build:dir
# 或等效
npx electron-builder --dir
```
- 觀察 electron-builder 能否 parse config 無錯誤
- `--dir` 模式只產出 unpacked 目錄，速度快，作為 smoke gate

**Step 5.3：NSIS installer 打包驗收**
```bash
npm run build
# 或等效
npx electron-builder --win
```
- 觀察完整 NSIS installer 產出：`dist/*.exe`
- 記錄打包耗時、產物 size、任何警告訊息
- 確認 installer 簽章流程（若有 code signing 設定）

**Step 5.4：安裝驗收（使用者執行）**
- 由使用者手動雙擊 installer 安裝
- 啟動 app 確認：
  - 主視窗正常開啟
  - CT panel / 終端機 / Sidebar / IPC 通道（T0163 smoke test 項目）仍正常
  - Electron 41 runtime 無異常 log
- 使用者回報結果到工單互動紀錄

**Step 5.5：macOS / Linux YAML dry-run**（Q3-C 範圍）
```bash
# macOS config parse（不實際打包）
npx electron-builder --mac --dir --config.mac.identity=null
# Linux config parse
npx electron-builder --linux --dir
```
- 若 config 無法 parse → 記錄錯誤但不中斷工單（本機無 macOS，預期 signing 會失敗）
- 目標是確認 YAML 結構在各平台 config schema 下合法

**驗收 Checklist**（每項勾選並記錄）：
- [ ] `npm run compile` 通過
- [ ] `npm run build:dir`（dry-run）通過
- [ ] `npm run build` NSIS installer 產出
- [ ] installer 安裝後 app 啟動正常
- [ ] CT panel / 終端機 / Sidebar / IPC 功能性正常
- [ ] macOS YAML config parse 通過（signing 失敗可接受）
- [ ] Linux YAML config parse 通過
- [ ] npm audit Group A 9 個漏洞清除

### Step 6：`npm audit` 驗證漏洞清除

```bash
npm audit
```

確認以下 9 個 GHSA 消失：
| 套件 | GHSA / 嚴重度 |
|------|--------------|
| @tootallnate/once | GHSA-vpq2-c234-7xj6 (low) |
| app-builder-lib | (high, via tar + http-proxy-agent) |
| builder-util | (low, via http-proxy-agent) |
| dmg-builder | (high) |
| electron-builder | (high) |
| electron-builder-squirrel-windows | (high) |
| electron-publish | (high) |
| http-proxy-agent | (low) |
| tar（electron-builder 子鏈） | (high) |

**預期**：11 → 2（剩 Group C whisper-node-addon → cmake-js → tar，WONTFIX）。
記錄完整 `npm audit` 輸出到「執行紀錄」。

### Step 7：更新 CLAUDE.md

在「## Build Toolchain」段之後**新增** electron-builder 版本筆記（或合併進原段落，Worker 視結構決定）：

```markdown
- electron-builder 26.x（2026-04-18 PLAN-005 升級，原 24.x → 26.8.1，清除 9 個 CVE — Group A of PLAN-003）
- 升級 breaking changes 處理：<依 Step 4 結果填寫>
```

如有 config migration，附簡短備註（如「signingHashAlgorithms → signtoolOptions」）。

### Step 8：Commit（EXP 分支內）

在 `exp/builder26` 分支獨立 commit：

```
chore(deps): upgrade electron-builder 24→26 (EXP-BUILDER26-001, PLAN-005)

electron-builder 24.x → 26.8.1 with connected sub-chain upgrades.

Clears 9 CVEs (Group A of PLAN-003):
- @tootallnate/once (GHSA-vpq2-c234-7xj6, low)
- app-builder-lib / builder-util / dmg-builder / electron-builder
- electron-builder-squirrel-windows / electron-publish / http-proxy-agent
- tar (electron-builder sub-chain)

npm audit: 11 → 2 remaining (Group C WONTFIX per D052).

Config migration: <依 Step 4 結果>

Verified (Windows):
- npm run compile: OK
- npm run build:dir (dry-run): OK
- npm run build (NSIS installer): OK
- Installer manual install + app smoke test: OK

Cross-platform YAML dry-run:
- macOS config parse: OK (signing skipped, no machine)
- Linux config parse: OK

Refs: PLAN-005 (DONE), PLAN-003 Group A (closed), D054 (EXP worktree strategy)
```

### Step 9：回報塔台決定結論

Worker 完成 Step 1-8 後，回塔台說 "EXP-BUILDER26-001 CONCLUDED"：

- **成功路徑**（所有 checklist 通過）→ 塔台執行：
  1. `git worktree` 內的 commit merge/PR 回主線
  2. PLAN-005 狀態：🔄 IN_PROGRESS → ✅ DONE
  3. PLAN-003 Group A 關閉、PLAN-003 整體狀態：🔄 → ✅ DONE
  4. EXP 狀態：EXPLORING → CONCLUDED
  5. Worktree 清理：`git worktree remove ../better-agent-terminal-builder26 && git branch -d exp/builder26`
- **失敗路徑**（任一關鍵 checklist 失敗且無法解決）→ 塔台執行：
  1. EXP 狀態：EXPLORING → ABANDONED
  2. PLAN-005 狀態退回 💡 IDEA 並註記失敗原因
  3. Worktree 丟棄：`git worktree remove ../better-agent-terminal-builder26 && git branch -D exp/builder26`
  4. 主線零污染

---

## 執行紀錄

### 前置盤點結果（Step 1）

**環境狀態**
- Worktree 位置：`D:\ForgejoGit\BMad-Guide\better-agent-terminal\better-agent-terminal-builder26`
- 分支：`exp/builder26`
- `node_modules/` 尚未存在（worktree 首次設定，需在 Step 3 一併 install）

**`package.json` 關鍵欄位**
- `devDependencies.electron-builder`：`^24.0.0`（基線 lockfile 鎖 `24.13.3`）
- `build.appId`：`org.tonyq.better-agent-terminal`
- `build.productName`：`BetterAgentTerminal`
- `build.win.target`：`nsis` + `zip`（無 signing 欄位，`forceCodeSigning: false`）
- `build.nsis`：oneClick=false、allowToChangeInstallationDirectory=true、三張 icon
- `build.mac`：dmg universal、identity `TonyQ CO., LTD. (8JVDJGLLYR)`、hardenedRuntime、entitlements `build/entitlements.mac.plist`、`notarize: { teamId: "8JVDJGLLYR" }`
- `build.linux.target`：`AppImage`
- `build.npmRebuild`：false
- `build.asarUnpack`：Claude Code/SDK、`@img/**`、terminal-server.js
- `build.extraResources`：`scripts/{bat-terminal.mjs, bat-notify.mjs}`
- 無獨立 `electron-builder.yml` / `electron-builder.json`

**package.json `scripts` 相關**
- `compile` → `vite build`
- `build` → `vite build && electron-builder`
- `build:dir` → `vite build && electron-builder --dir`
- `postinstall` → mac Info.plist 處理 + `npm rebuild better-sqlite3`

**打包資源盤點**
- `build/entitlements.mac.plist` 存在
- 無 `installer/` 目錄
- 無 `afterSignHook.js` / `afterPackHook.js`

**grep 自訂 hook / 簽章設定**（`afterSign|afterAllArtifactBuild|afterPack|signingHashAlgorithms|electron-notarize|@electron/notarize`）
- 專案原始碼：0 命中
- `node_modules`（transitive）：`@electron/notarize@2.2.1`（electron-builder 24 的間接依賴，本專案未直接 require）
- 本工單檔案：18 命中（屬工單文字，非程式碼）

**盤點表**
| 項目 | 命中 | 影響評估 |
|------|------|---------|
| `electron-builder.yml` 存在 | ❌ | 無影響（config 全在 package.json `build`） |
| `build` 在 package.json | ✅ | **主要 migration 目標** |
| 自訂 `afterSign` / `afterPack` | ❌ | 無 hook 需要遷移 |
| `electron-notarize` 套件使用 | ❌（僅 transitive） | v26 內建 notarization，無需本專案變更 |
| `signingHashAlgorithms` 用法 | ❌ | 無需 migrate 到 `signtoolOptions` |

**electron-builder 版本確認**
- 當前 lockfile：`24.13.3`
- npm registry 最新：`26.8.1`（dist-tag `latest`）+ `26.9.0`（`next` tag，為 beta 不採用）
- 決策：目標 **26.8.1**（符合工單規格）

**v25 / v26 breaking changes 摘要（WebFetch `github.com/electron-userland/electron-builder/releases/tag/v26.0.0`）**
| 變更 | 對本專案影響 |
|------|------------|
| Windows signing → `win.signtoolOptions` 結構 | ✅ 無影響（本專案無 signing，`forceCodeSigning: false`） |
| macOS notarize 鼓勵用環境變數 | ⚠️ 本專案有 `notarize: { teamId }`，需驗證 v26 仍支援此格式；Windows 本機不跑 mac 打包，先 dry-run |
| `.desktop` 欄位改物件結構 | ✅ 無影響（未使用） |
| HFS+ DMG 在非 arm64 Mac 下架 | ⚠️ 本專案 mac 用 universal dmg（含 arm64），dry-run 若失敗屬預期 |
| 支援 subdirectory node_modules / NPM workspaces | ✅ 非本專案需求 |
| ASAR 改用 `electron/asar` | 透明 |
| 新增 `@electron/fuses` 整合 | 選用功能，不啟用 |
| Node.js 要求 ≥ 20 | ✅ Electron 41 自帶 Node 24 |

**結論**：本專案組態簡單，預期 migration 工作量極低；Step 4 預期僅驗證 `mac.notarize` 在 v26 parse 是否仍通過，若 parse 失敗再看 schema 變更。

### package.json diff（Step 2）

```diff
-    "electron-builder": "^24.0.0",
+    "electron-builder": "^26.8.1",
```

（僅此一行，`build` 欄位與 scripts 皆未變動）

### npm install 結果（Step 3）

- 執行時間：約 29 秒
- 新增套件：789 個；audit 基數：790 個
- postinstall：
  - mac Info.plist 處理（非 darwin 略過）
  - `npm rebuild better-sqlite3` → `rebuilt dependencies successfully`
  - `postinstall done`
- 警告（皆為 deprecated transitive，無 blocker）：
  - `inflight@1.0.6`、`npmlog@6.0.2`、`rimraf@2.6.3`、`glob@7.2.3`、`are-we-there-yet@3.0.1`、`prebuild-install@7.1.3`、`boolean@3.2.0`、`gauge@4.0.4`、`tar@6.2.1`、`glob@10.5.0`
  - 其中 `tar@6.2.1` 即 Group C（whisper-node-addon 鏈）的已知殘留
- 升級後 electron-builder 鏈版本：
  - `electron-builder@26.8.1`
  - `app-builder-lib@26.8.1`
  - `builder-util@26.8.1`
  - `dmg-builder@26.8.1`
  - `electron-builder-squirrel-windows@26.8.1`
  - `electron-publish@26.8.1`
  - `http-proxy-agent@7.0.2`（從 4.x/5.x 升到 7.x，**已不再透過 `@tootallnate/once`**，原漏洞鏈斷開）
  - `@tootallnate/once` 已從 dep tree 完全消失

### Config migration diff（Step 4）

**唯一 breaking**：v26 將 `mac.notarize` 從物件格式 `{ teamId }` 改為 boolean，認證資訊統一從環境變數讀取。

```diff
       "hardenedRuntime": true,
       "gatekeeperAssess": false,
       "entitlements": "build/entitlements.mac.plist",
       "entitlementsInherit": "build/entitlements.mac.plist",
-      "notarize": {
-        "teamId": "8JVDJGLLYR"
-      },
+      "notarize": true,
```

**後續影響**：日後 CI/本地執行 mac 打包時須改以環境變數提供認證（三種任一組合）：
1. `APPLE_API_KEY` + `APPLE_API_KEY_ID` + `APPLE_API_ISSUER`（官方推薦）
2. `APPLE_ID` + `APPLE_APP_SPECIFIC_PASSWORD` + `APPLE_TEAM_ID=8JVDJGLLYR`
3. `APPLE_KEYCHAIN` + `APPLE_KEYCHAIN_PROFILE`

此變更不影響 Windows 本機打包（本工單驗收範圍）；`notarize: true` 在 Windows 上僅用於 schema 通過，實際不觸發 notarization 流程。

其他可能變更（均無需調整）：
- `win.signtoolOptions`：本專案無 signing
- `.desktop` 改物件：本專案未使用
- HFS+ DMG 下架：本專案用 universal DMG（含 arm64），理論上不受影響

### Windows 打包驗收（Step 5）

**Step 5.1 `npm run compile`** ✅
- Vite 7.3.2 四階段 build 全綠：dist/（9.2s、52 modules）、main.js+sdk（1.3s）、preload.js（25ms）、terminal-server.js（24ms）
- 無 error，僅 chunk size >500KB 的預期警告（mermaid.core、index）

**Step 5.2 `npm run build:dir`（dry-run）** ✅（首次因 `mac.notarize` 格式失敗，Step 4 修正後通過）
- `electron-builder 26.8.1` 啟動
- `loaded configuration file=package.json ("build" field)` → schema parse 通過
- `platform=win32 arch=x64 electron=41.2.1 appOutDir=release\win-unpacked`
- 產出：`release/win-unpacked/BetterAgentTerminal.exe` + Electron 41 runtime
- 警告（非 blocker）：
  - Node DEP0190（child_process shell=true，electron-builder 內部實作）
  - `duplicate dependency references`（package tree 內 transitive 重複，升級前後一致）

**Step 5.3 `npm run build`（NSIS installer + zip）** ✅
- 完整打包成功，產出：
  - `release/BetterAgentTerminal Setup 1.0.0.exe`（171.98 MB NSIS installer）
  - `release/BetterAgentTerminal Setup 1.0.0.exe.blockmap`（168 KB block map，用於增量更新）
  - `release/BetterAgentTerminal-1.0.0-win.zip`（230.10 MB portable zip）
- `signing with signtool.exe` 訊息出現但屬 best-effort（`forceCodeSigning: false`），執行完成無 fatal error

**Step 5.4 installer 安裝 smoke test**：⏳ **待使用者手動驗收**
- Installer 已產出：`release/BetterAgentTerminal Setup 1.0.0.exe`
- 驗收項目（待使用者執行）：
  - [ ] 雙擊 installer → UI 顯示 NSIS 安裝精靈（oneClick=false）
  - [ ] 選安裝目錄 → 安裝完成
  - [ ] 啟動 app → 主視窗開啟
  - [ ] CT panel / 終端機 / Sidebar 功能正常
  - [ ] IPC 通道（T0163 smoke test 項目）無 regression

**Step 5.5 跨平台 YAML dry-run**
- **macOS（`npx electron-builder --mac --dir --config.mac.identity=null`）**：✅ config schema parse 通過後，被 v26 以 `Build for macOS is supported only on macOS` 擋下；這是 v26 新加的 host-platform 限制（v24 在 Windows 下可跑 mac `--dir`）。Schema 無錯誤，達成工單驗收目標。
- **Linux（`npx electron-builder --linux --dir`）**：✅ 完整跑完，超出預期。自動下載 `electron-v41.2.1-linux-x64.zip`（117 MB）後產出 `release/linux-unpacked/`（含 BetterAgentTerminal binary、chrome_crashpad_handler、libvk_swiftshader.so 等完整 Linux runtime）。

**驗收 Checklist**
- [x] `npm run compile` 通過
- [x] `npm run build:dir`（dry-run）通過
- [x] `npm run build` NSIS installer 產出
- [ ] installer 安裝後 app 啟動正常（待 Step 5.4 使用者驗收）
- [ ] CT panel / 終端機 / Sidebar / IPC 功能性正常（待 Step 5.4 使用者驗收）
- [x] macOS YAML config parse 通過
- [x] Linux YAML config parse 通過（實際連打包都成功）
- [x] npm audit Group A 9 個漏洞清除（見 Step 6）

### npm audit 結果（Step 6）

**升級前基線（主線 commit `83ae7cf`）**：11 個 vulnerabilities
- Group A（electron-builder 鏈，本工單目標）：9 條
- Group C（whisper-node-addon → cmake-js → tar，WONTFIX 見 D052）：2 條（tar 鏈在基線計為 2）

**升級後**：3 個 high severity
```
# npm audit report
tar  <=7.5.10 (high, 6 GHSAs merged)
├── cmake-js  <=7.4.0 (high)
└── whisper-node-addon  >=0.0.4 (high)

3 high severity vulnerabilities
```

**Group A 清除驗證**（逐項）：
| 套件 | 清除狀態 | 說明 |
|------|---------|------|
| @tootallnate/once | ✅ 從 dep tree 完全消失 | `http-proxy-agent` 升 7.x 後斷鏈 |
| app-builder-lib | ✅ → 26.8.1 | |
| builder-util | ✅ → 26.8.1 | |
| dmg-builder | ✅ → 26.8.1 | |
| electron-builder | ✅ → 26.8.1 | 直接依賴升級 |
| electron-builder-squirrel-windows | ✅ → 26.8.1 | |
| electron-publish | ✅ → 26.8.1 | |
| http-proxy-agent | ✅ → 7.0.2 | 從 4.x/5.x 升到 7.x |
| tar（electron-builder 子鏈） | ✅ 26.x 內部已換用新 tar | 剩餘 tar@6.2.1 僅在 whisper-node-addon → cmake-js 鏈內 |

**結果解讀**：
- 工單預期「11 → 2」；實際「11 → 3」，差異僅在 `tar/cmake-js/whisper-node-addon` 是否合併為 1 條計數
- 實質效果：剩餘 3 個高危全部屬同一個 Group C 鏈，符合 D052 WONTFIX 決策；**Group A 100% 清除**

### CLAUDE.md 更新 diff（Step 7）

```diff
-- electron-builder 目前仍為 24.x（PLAN-016 Phase 3 延後處理，不影響本地 `npm run dev`）。
+- electron-builder 26.x（2026-04-18 PLAN-005 / EXP-BUILDER26-001 CONCLUDED，原 24.13.3 → 26.8.1，清除 9 個 Group A CVE，見 PLAN-003 Group A）。
```

新增 `### electron-builder 26 migration notes` 小節（在 `## Build Toolchain` 之內），涵蓋：
- `mac.notarize` 格式變更（物件 → boolean）
- 啟用 mac notarization 需設的環境變數（3 種組合）
- `.github/workflows/pre-release.yml` 目前無 `APPLE_*` secrets 的 soft warning
- Windows 打包產物 size 參考、v26 禁止 host-cross-platform mac build

### Commit hash（Step 8）

Primary commit：`f79f735`
- 訊息：`chore(deps): upgrade electron-builder 24->26 (EXP-BUILDER26-001, PLAN-005)`
- 變更：4 files，+1984 / -622
  - `package.json`（electron-builder ^24 → ^26.8.1，mac.notarize 物件 → boolean）
  - `package-lock.json`（electron-builder 鏈全升 26.8.1 + http-proxy-agent 7.0.2）
  - `CLAUDE.md`（Build Toolchain 段加 migration notes）
  - `_ct-workorders/EXP-BUILDER26-001-*.md`（本工單回報區）

Backfill commit：`d146c9a`
- 訊息：`chore(ct): EXP-BUILDER26-001 backfill primary commit hash (f79f735)`
- 變更：1 file（工單 Commit hash 欄位回填）

分支：`exp/builder26`（本地 2 commits，未 push；依工單 Step 9 走 CONCLUDED 路徑由塔台決定 PR/merge）

---

## 互動紀錄

- `[04:39]` Q: Worker 詢問 `npm install` 執行環境（A/B/C/D 選項）→ A: 使用者回「繼續」→ Action: Worker 判定為「D: 授權在本 session 執行」，直接跑 `npm install`，結果 29 秒成功、postinstall OK。
- `[04:55]` Q: 使用者追問「`.github/workflows/*.yml` 需不需要配合修改」→ A: Worker 檢查 `pre-release.yml` 後回報「無需修改」，並識別出 soft warning（若未來啟用 mac notarization 需補 `APPLE_*` env vars）→ Action: 將 soft warning 寫入 CLAUDE.md 的 migration notes，不納入本工單變更範圍。

---

## 遭遇問題

**P1（已解決）**：Step 5.2 首次 `npm run build:dir` 時 electron-builder 26 schema 驗證失敗
- 錯誤：`configuration.mac.notarize should be a boolean.`
- 根因：v26 breaking change — `mac.notarize` 從物件 `{ teamId }` 改為 boolean
- 解法：`notarize: { teamId: "8JVDJGLLYR" }` → `notarize: true`，TeamID 改走環境變數
- 後續：在 CLAUDE.md migration notes 記錄環境變數需求供未來 CI 啟用 mac notarization 參考

**P2（預期內，非 blocker）**：Step 5.5 macOS dry-run 在 Windows 被 v26 阻擋
- 錯誤：`Build for macOS is supported only on macOS`
- 根因：v26 新加的 host-platform 限制（v24 允許 Windows 下跑 mac `--dir`）
- 處理：schema parse 已在 error 前通過，達成工單驗收目標（「YAML 結構在各平台 config schema 下合法」），不影響結論

**P3（非本工單範圍）**：npm audit 剩 3 個 high 全部是 Group C 鏈（tar / cmake-js / whisper-node-addon）
- 狀態：WONTFIX 依 D052
- 工單預期「11 → 2」vs 實際「11 → 3」：純計數差（同一鏈每個 package 獨立計數 vs 合併計數），實質效果一致

---

## Renew 歷程

無。

---

## 如何繼續

**完成條件**（CONCLUDED）：
1. Step 5 Windows 完整打包 + 安裝 smoke test 全綠
2. Step 5.5 macOS / Linux YAML config parse 通過
3. Step 6 npm audit Group A 9 個漏洞全部清除
4. Step 7 CLAUDE.md 已更新
5. Step 8 commit 已在 `exp/builder26` 分支產出（本地 commit，不 push）

**失敗/阻擋情境**（ABANDONED）：
- Step 1 發現 config migration 成本過高（例：完全改寫 yml 結構）→ 回塔台評估是否改走研究模式
- Step 3 `npm install` 失敗且非 VSCode 鎖檔 → 回塔台
- Step 4 signing / notarization 等 breaking change 無乾淨遷移路徑 → 回塔台共同決策
- Step 5 NSIS installer 打包失敗 + 排除 VSCode / 環境因素仍無解 → 回塔台
- Step 5.4 installer 安裝後 app 啟動異常（regression）→ 回塔台，可能 rollback
- Step 6 漏洞未清除 → 檢查 overrides / lockfile，回塔台

**回報格式**：回塔台說 "EXP-BUILDER26-001 CONCLUDED" / "ABANDONED" / "卡關：<原因>"，塔台會讀此工單「執行紀錄」區域做決策。

---

## 上游資訊

- electron-builder 26 release notes: https://github.com/electron-userland/electron-builder/releases
- electron-builder 文件: https://www.electron.build/
- npm registry: `electron-builder@26.8.1`

> Worker 執行前若 26.x 已有更新 patch，以 `npm view electron-builder version` 的結果為準（同 major 內，優先最新 stable）。
