# EXP-BUILDER26-001 — electron-builder 24→26 升級可行性驗證

## 元資料
- **實驗編號**：EXP-BUILDER26-001
- **類型**：experiment（EXP worktree 隔離實作）
- **互動模式**：✅ 允許（config 格式、yml 遷移、打包異常可問使用者）
- **狀態**：🧪 EXPLORING
- **優先級**：🟢 Low（技術債清除，無阻塞）
- **派發時間**：2026-04-18 04:25 (UTC+8)
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

（Worker 填寫）

### package.json diff（Step 2）

（Worker 填寫）

### npm install 結果（Step 3）

（Worker 填寫）

### Config migration diff（Step 4）

（Worker 填寫）

### Windows 打包驗收（Step 5）

（Worker 填寫）

### npm audit 結果（Step 6）

（Worker 填寫）

### CLAUDE.md 更新 diff（Step 7）

（Worker 填寫）

### Commit hash（Step 8）

（Worker 填寫）

---

## 互動紀錄

（Worker 遇到 config 格式、yml 遷移、打包異常時填寫，塔台對齊後回填）

---

## 遭遇問題

（Worker 填寫）

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
