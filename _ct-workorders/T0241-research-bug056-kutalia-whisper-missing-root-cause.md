# T0241 — 研究：BUG-056 NSIS 打包版找不到 `@kutalia/whisper-node-addon` 根因定位

## 元資料

- **編號**：T0241
- **類型**：research（允許 Worker 與使用者互動）
- **狀態**：✅ DONE
- **優先級**：🔴 **High**（打包版完全無法啟動，阻塞所有 release pipeline）
- **建立時間**：2026-04-23 03:08 (UTC+8)
- **開始時間**：2026-04-23 03:17 (UTC+8)
- **完成時間**：2026-04-23 03:30 (UTC+8)
- **派發模式**：**建議 `--mode on --interactive`**（允許 Worker 問問題，研究型工單標準配置）
- **前置條件**：
  - BUG-056（本研究目標）
  - `cb65614` main commit（Vulkan feature squash merge）
  - T0238 工單（packaging，驗收 log 可參考但不可當真理）
  - `package.json`（檢查 `@kutalia/whisper-node-addon` 位置和 electron-builder 配置）
  - `C:\Program Files\BetterAgentTerminal\resources\app.asar` 實際內容（必要時 `asar list`）
- **互動限制**：每次提問上限 3 個（per `research_max_questions: 3`）
- **預估時間**：30-60 分鐘（靜態分析 + 實際 asar 解壓驗證）
- **Renew 次數**：0

---

## 研究目標

**定位 BUG-056 根因**，產出可以直接派實作工單的結論（「應該改哪個檔案的哪一行、改成什麼」）。

**禁止**：直接修 code、直接重新打包、猜測性提交。本工單是**研究**，不是修復。

---

## 背景

Session 21（2026-04-23 00:12-02:45）完成 EXP-GPUWHIS-001 Phase 1，squash merge 到 main（commit `cb65614`）。T0238 T-B packaging 驗收當時報 4/4 全綠（NSIS 291 MB + asarUnpack + `ELECTRON_RUN_AS_NODE=1 probe.js` 驗證 Vulkan runtime）。

然而使用者 2026-04-23 03:05 實機安裝 NSIS installer 後啟動，即遇到：

```
Error: Cannot find module '@kutalia/whisper-node-addon'
Require stack:
- C:\Program Files\BetterAgentTerminal\resources\app.asar\dist-electron\main.js
```

**T0238 驗收盲點假設**：當時 `probe.js` 走 `ELECTRON_RUN_AS_NODE=1` 直跑，是 Node 模式的 resolve，**繞過了 Electron main process 的 asar 整合 resolver**。NSIS installer → 啟動 `.exe` → main process `require('@kutalia/whisper-node-addon')` 才是 production 真正走的 path，這條 path 可能當時沒測。

---

## 研究範圍（4 項）

### 1. 靜態分析：`package.json` 與 electron-builder 配置（必做）

- [ ] `@kutalia/whisper-node-addon` 在 `dependencies` 還是 `devDependencies`？
- [ ] `package.json > build`（或 `electron-builder.yml`）中：
  - `files` pattern 是否可能排除 `node_modules/@kutalia/`？
  - `asarUnpack` pattern 是否涵蓋 `@kutalia/*`？
  - `extraResources` / `extraFiles` 是否有相關設定？
  - `asar` 本身是否為 `true`（預設 true）？
- [ ] 對比 session 21 合入前（main commit `cb65614^`）的 build config：
  - Diff 出 T-B 改了哪些 packaging 相關欄位
  - 確認 T-B 的 asarUnpack 新增項（若有）
- [ ] **檢查 electron-builder 版本**：v26 對 asarUnpack 的 glob 行為是否與舊版不同？

### 2. 靜態分析：main.js require path（必做）

- [ ] `dist-electron/main.js` 是 vite 產物。確認 vite bundle 時：
  - `@kutalia/whisper-node-addon` 是被 bundle 進 main.js 還是保持 external？
  - 若是 external，require 的字串是 `@kutalia/whisper-node-addon` 還是 absolute path？
  - 檢查 `vite.config.ts` 的 `build.rollupOptions.external` 是否正確處理 native modules
- [ ] 確認 `electron/gpu-detector.ts` 或相關檔案中 require `@kutalia/whisper-node-addon` 的寫法：
  - 是靜態 `import` 還是 `require()`？
  - 有沒有條件式 require（`try/catch`）？

### 3. Runtime 驗證：asar 實際內容（必做）

- [ ] 實機操作（Worker 可請使用者協助）：
  - 確認 `C:\Program Files\BetterAgentTerminal\resources\app.asar` 存在
  - `npx @electron/asar list C:\Program Files\BetterAgentTerminal\resources\app.asar | findstr kutalia`
  - 確認 `C:\Program Files\BetterAgentTerminal\resources\app.asar.unpacked\node_modules\@kutalia\` 是否存在
  - 若 unpacked 存在 → 是 require resolution 問題；若不存在 → 是打包配置問題
- [ ] 對比 `node_modules/@kutalia/whisper-node-addon/` 在開發環境（dev mode 啟動正常）和打包後（installed 環境）的檔案差異

### 4. 根因假設驗證（收斂）

針對 BUG-056 列出的 5 個假設（H1-H5），Worker 必須逐條：
- 給出判定（✅ 成立 / ❌ 排除 / ⚠️ 需進一步確認）
- 附上靜態或 runtime 證據
- 最終收斂到**單一或最多兩個**最可能的根因

---

## 交付標準（Worker 回報必備）

### 結論結構
1. **根因判定**：單一或兩個最可能的根因（明確指出檔案/行號/配置欄位）
2. **修復提案**（為後續實作工單鋪路）：
   - 需要修改哪些檔案的哪些欄位
   - 預期修改行數（S/M/L sizing）
   - 是否需要同步調整 macOS / Linux 的 packaging 配置
3. **驗收情境建議**（for T0243 修復工單 + 驗收）：
   - `dir/` 模式 packaged build 測試 steps
   - **NSIS installer 完整重裝路徑測試 steps**（Uninstall → Download installer → Install → 啟動）
   - 跨平台擴展（mac dmg / Linux AppImage 是否需要同類驗收）
4. **T0238 盲點學習候選**：建議記錄一條 L### 候選，說明「packaging 驗收必須涵蓋 NSIS 安裝路徑，不能只跑 probe.js」

### 禁止項
- ❌ 不可直接修 `package.json` / electron-builder config
- ❌ 不可重新跑 `npm run dist` / `npm run build`（研究階段禁止）
- ❌ 不可憑直覺給結論而無 static / runtime 證據

### 允許項
- ✅ 讀任何檔案（package.json、config、source code、log）
- ✅ 透過 `npx @electron/asar list` 等唯讀指令檢查 asar 內容
- ✅ 請使用者在本機跑 diagnostic 指令（如 `ls` / `asar list`）並回報
- ✅ 與使用者互動（上限 3 題）

---

## 互動建議（Worker 可問使用者的問題模板）

若 Worker 需要使用者協助 runtime 驗證，可問：

1. 能否在 PowerShell 執行 `npx @electron/asar list "C:\Program Files\BetterAgentTerminal\resources\app.asar" | findstr kutalia` 並回報輸出？
2. 能否檢查 `C:\Program Files\BetterAgentTerminal\resources\app.asar.unpacked\` 目錄是否存在？若存在，裡面有哪些 `node_modules/` 子目錄？
3. 能否回報上次打包 build 的 log 最後 50 行（特別是 electron-builder 的 asar 階段）？

（Worker 依研究進度判斷是否需要問 + 問哪幾題，不必全問）

---

## 成功指標

- [ ] 根因收斂到單一或兩個最可能假設
- [ ] 給出可執行的修復提案（具體到檔案 / 欄位 / 預期 diff 量）
- [ ] 驗收情境涵蓋 **NSIS 完整重裝路徑**（Q3.C 要求）
- [ ] 塔台可據此產出修復工單（預計 T0242）

---

## 回報區（Worker 填寫）

### 研究結論

**單一根因（100% 確認）**：**main repo 的 `node_modules/@kutalia/` 目錄不存在**。cb65614 squash merge 後 main repo 從未跑過 `npm install`，導致 `@kutalia/whisper-node-addon` 套件檔案從未落地。使用者安裝的 installer (`D:\ForgejoGit\BMad-Guide\better-agent-terminal\better-agent-terminal\release\BetterAgentTerminal Setup 1.0.0.exe`) 是從 main repo 打出的 NSIS，**本質上不含 `@kutalia/whisper-node-addon` 任何檔案**（既不在 `app.asar` 也不在 `app.asar.unpacked/`）。

**對 H1-H5 假設的判定**：
- **H1**（asarUnpack pattern 沒涵蓋）：❌ **排除** — `package.json:162` 明確含 `node_modules/@kutalia/whisper-node-addon/**/*`
- **H2**（誤分類為 devDependencies）：❌ **排除** — `package.json:30` 在 `dependencies` 下
- **H3**（files 排除 node_modules/@kutalia）：❌ **排除** — `files` 只含 `node_modules/**/*`，無排除 glob
- **H4**（main.js bundle 後 require path 錯亂）：❌ **排除** — `vite.config.ts:22` 正確把 `@kutalia/whisper-node-addon` 列為 external，require 字串保持 bare specifier
- **H5**（postinstall 跳過導致 native binary 未下載）：⚠️ **間接成立** — 更根本的是連 package 本身都沒安裝，所以 postinstall 的 prebuilt 下載也不可能發生

**真正根因（H6，塔台 BUG-056 H1-H5 未列）**：**squash merge 只更新 `package.json` / `package-lock.json`，未同步 `node_modules/`，main repo 打包時實體來源缺失**。

### 證據鏈

**證據 1：本地 main repo node_modules 確認**
```bash
$ ls node_modules/@kutalia/
ls: cannot access 'node_modules/@kutalia/': No such file or directory
```

**證據 2：使用者實機 installer 內容確認**（PowerShell 輸出）
```
C:\Program Files\BetterAgentTerminal\resources\app.asar.unpacked\node_modules\
├── better-sqlite3         ✅（.node auto-unpack）
├── @anthropic-ai          ✅（asarUnpack 有效）
├── @lydell                ✅（asarUnpack 有效）
└── （無 @kutalia）        ❌
└── （無 @img）            ❌（Windows 下 @img/* 本來就無，不相關）
```

**證據 3：installer 來源確認**
- 使用者安裝路徑：`C:\Program Files\BetterAgentTerminal\`
- installer 檔案：`D:\ForgejoGit\BMad-Guide\better-agent-terminal\better-agent-terminal\release\BetterAgentTerminal Setup 1.0.0.exe`
- **不是** T0238 worktree (`../bat-gpu-vulkan-poc/release/`) 的 installer
- 是 cb65614 合入 main 後從 main repo 重新打的 NSIS

**證據 4：static import 位置**
- `electron/voice-handler.ts:33`：`import { transcribe as whisperTranscribe } from '@kutalia/whisper-node-addon'`
- Vite bundle 後寫入 `dist-electron/main.js` 頂層，main.js:1:810 即爆炸
- 對比 T0238 時 voice-handler.ts 也是此寫法，但 T0238 的 zip smoke test 能印 `[voice] IPC handlers registered`——代表該 worktree 的 node_modules 完整，require 成功

**證據 5：T0238 盲點**
- T0238 驗收判準 3 用 **zip smoke test**，zip 是 worktree 的 `BetterAgentTerminal-1.0.0-win.zip`，內容 = `win-unpacked/`
- T0238 判準 2 檢查的 `release/win-unpacked/...@kutalia/...` 路徑**真實存在**，但前提是該 worktree 的 node_modules 完整
- **T0238 未做** NSIS installer 完整安裝路徑測試（意外發現 #5 明說跳過）
- **T0238 未涵蓋** squash merge 後 main repo 的 packaging driver case

### 修復提案（給後續實作工單）

**修復工單建議編號：T0242**（實作型，優先級 High，預估 30-60 分鐘）

**修復步驟（極簡路徑，S sizing）**：

| Step | 動作 | 預期 diff 量 |
|------|------|------------|
| 1 | 在 main repo 根目錄跑 `npm install` | 僅 `node_modules/` 變動，無 source diff |
| 2 | 驗證 `node_modules/@kutalia/whisper-node-addon/package.json` 存在 | 驗證 step |
| 3 | 確認 `node_modules/@kutalia/whisper-node-addon/dist/win32-x64/` 下 `.node` + `.dll` 完整 | 驗證 step |
| 4 | 跑 `npm run build`（vite build + electron-builder NSIS + zip） | `release/` 重建 |
| 5 | **實機 NSIS installer 完整安裝路徑測試**（見驗收情境） | 驗證 step |

**預防對策（可選，另開工單 T0243 建議）**：
- CI pipeline（`.github/workflows/pre-release.yml`）在 build job 明確加 `npm ci` 前置步驟（目前若漏此步驟會重演 BUG-056）
- 考慮在 `scripts/build-version.js`（`npm run build:release` 入口）加入 `node_modules/@kutalia/whisper-node-addon/package.json` 存在性檢查，缺失即 fail fast
- macOS / Linux 跨平台：同理，squash merge 後各平台 builder 環境都要確認 `node_modules/` 完整

**無需修改 code / config**：
- `package.json` asarUnpack 配置**正確無需改**
- `vite.config.ts` external 配置**正確無需改**
- `electron/voice-handler.ts` 靜態 import **正確無需改**

### 驗收情境建議

**兩條驗收 path 全綠才算 CLOSED（符合 BUG-056 Q3.C）**：

**Path A：`dir/` mode packaged build（快速迭代）**
```powershell
npm run build:dir
# 檢查 release/win-unpacked/resources/app.asar.unpacked/node_modules/@kutalia/whisper-node-addon/ 存在
Get-ChildItem "release/win-unpacked/resources/app.asar.unpacked/node_modules/@kutalia/whisper-node-addon/dist/win32-x64/" | Measure-Object
# 預期：至少 8 個檔案（1 個 .node + 7 個 .dll）
# 啟動 release/win-unpacked/BetterAgentTerminal.exe，確認無 crash
```

**Path B：NSIS installer 完整重裝路徑（production 驗收）** ← **T0238 漏掉的關鍵**
```powershell
# 1. 先卸載既有 BAT（Settings → Apps → BetterAgentTerminal → Uninstall）
# 2. 確認 C:\Program Files\BetterAgentTerminal\ 不存在
Test-Path "C:\Program Files\BetterAgentTerminal\"  # 預期 False

# 3. 執行新打的 installer
Start-Process "release\BetterAgentTerminal Setup 1.0.0.exe" -Wait

# 4. 驗證安裝後 @kutalia/ 落地
Test-Path "C:\Program Files\BetterAgentTerminal\resources\app.asar.unpacked\node_modules\@kutalia\whisper-node-addon\package.json"
# 預期 True

Get-ChildItem "C:\Program Files\BetterAgentTerminal\resources\app.asar.unpacked\node_modules\@kutalia\whisper-node-addon\dist\win32-x64\" | Measure-Object
# 預期：至少 8 個檔案

# 5. 啟動 BAT，確認主視窗出現、無 error dialog
Start-Process "C:\Program Files\BetterAgentTerminal\BetterAgentTerminal.exe"

# 6. 觸發語音轉錄（確認 Vulkan runtime 仍可用，等同 T0238 判準 4）
```

**跨平台擴展（建議但非阻塞 BUG-056 CLOSED）**：
- **macOS**：同理檢查 `BetterAgentTerminal.app/Contents/Resources/app.asar.unpacked/node_modules/@kutalia/whisper-node-addon/` 存在。dmg 雙 arch 產出後 x64 和 arm64 各裝一次。
- **Linux AppImage**：spec §7 原本 defer 到 Linux 分期，但若 squash merge 流程對 Linux 同樣有 npm install 盲點，可能同病。優先級：低，但 release pipeline 重啟前建議 dry-run 一次。

### 學習候選

**L### 候選 1（T0241 明確要求的學習點）**：
> **packaging 驗收必須涵蓋 NSIS installer 完整重裝路徑**。`dir/` mode、`zip` smoke test、`ELECTRON_RUN_AS_NODE=1 probe.js` 三種驗收都**不是 production 等價**。只有「完整卸載舊版 → 跑 .exe installer → 檢查 resources/ 落地 → 啟動 UI」整條 path 綠才能視為 installer 可 release。T0238 的 4/4 判準綠是 dir/zip + Node 模式 probe，漏掉 NSIS install + Electron main process 頂層 require 這條真正的 production 入口。

**L### 候選 2（新增，從 BUG-056 本身學到）**：
> **squash merge 只更新 `package.json` / `package-lock.json`，不同步 `node_modules/`**。合入後 main repo 打包前必須驗證 `node_modules/` 與 lock file 一致（`npm ci` 或至少 `npm install`）。建議在 `npm run build:release`（`scripts/build-version.js`）前置 `node_modules` 完整性檢查，至少針對 native modules（`@kutalia/whisper-node-addon`、`@lydell/node-pty`、`better-sqlite3`）明確 assert。CI pipeline 亦需同步調整（加 `npm ci` step）。

### 回報時間
2026-04-23 03:30 (UTC+8)

---

## 塔台補充（如需 Renew 時填寫）

（暫無）
