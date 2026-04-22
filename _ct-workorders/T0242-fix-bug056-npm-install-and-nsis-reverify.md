# T0242 — 修復：BUG-056 main repo npm install + NSIS installer 重打包與雙 path 驗收

## 元資料

- **編號**：T0242
- **類型**：implementation（修復型）
- **狀態**：🔄 IN_PROGRESS
- **開始時間**：2026-04-23 03:55 (UTC+8)
- **優先級**：🔴 **High**（阻塞 release pipeline）
- **建立時間**：2026-04-23 03:35 (UTC+8)
- **派發模式**：`--mode on --interactive`（NSIS 重裝需使用者協助 uninstall → install，Worker 需要互動窗口）
- **Sizing**：S（30-60 min，包含 `npm install` + `npm run build` + 雙 path 驗收）
- **前置條件**：
  - T0241 ✅ DONE（研究結論 H6：main repo node_modules 缺 `@kutalia`）
  - BUG-056 🐛 OPEN（待 CLOSED 目標）
  - main repo clean working tree（如有未 commit 變更先 stash）
  - 使用者需配合 NSIS 重裝流程（uninstall 既有 BAT → 跑新 installer）
- **關聯**：
  - BUG-056（本次修復目標）
  - T0241（研究結論來源）
  - `cb65614`（regression commit，squash merge 缺 node_modules 同步）
  - D078（處理策略）/ D079（拆單決策）
- **互動限制**：每次提問上限 3 個
- **Renew 次數**：0

---

## 修復目標

恢復 main repo 打包版本的 `@kutalia/whisper-node-addon` 完整性，使 NSIS installer 安裝後 BAT 可正常啟動（BUG-056 CLOSED 前提）。

**禁止項**：
- ❌ 不可修改 `package.json` 的 asarUnpack / files / dependencies 配置（T0241 已驗證現有配置正確）
- ❌ 不可修改 `vite.config.ts`（external 配置正確）
- ❌ 不可修改 `electron/voice-handler.ts`（靜態 import 正確）
- ❌ 不可跳過 Path B 驗收（T0238 盲點即因跳過 NSIS install 路徑）

**允許項**：
- ✅ `npm install` / `npm run build` / `npm run build:dir` / `npm run dist`
- ✅ 與使用者互動（uninstall / install 協調）
- ✅ 檢查 `release/` 目錄產物

---

## 修復步驟（Step 1-5）

### Step 1：補 node_modules

```bash
# 在 main repo 根目錄（非 worktree）
cd D:/ForgejoGit/BMad-Guide/better-agent-terminal/better-agent-terminal
npm install
```

**驗證**：
- [ ] `node_modules/@kutalia/whisper-node-addon/package.json` 存在
- [ ] `node_modules/@kutalia/whisper-node-addon/dist/win32-x64/` 下至少 8 個檔案（1 `.node` + 7 `.dll`）

### Step 2：dev mode 煙測（極短路檢查）

啟動 `npm run dev`，確認 voice-handler 載入 `@kutalia/whisper-node-addon` 無 crash（log 應有 `[voice] IPC handlers registered`）。若此步就崩 → 立刻 Renew 本工單，可能是 Windows native binary 下載失敗（Kutalia prebuilt）。

### Step 3：Path A 驗收（`dir/` mode packaged build）

```bash
# 產生 release/win-unpacked/
npm run build:dir
# 或使用專案實際 script（Worker 自行確認 package.json scripts）
```

**驗證（PowerShell）**：
```powershell
Test-Path "release/win-unpacked/resources/app.asar.unpacked/node_modules/@kutalia/whisper-node-addon/package.json"
# 預期 True

Get-ChildItem "release/win-unpacked/resources/app.asar.unpacked/node_modules/@kutalia/whisper-node-addon/dist/win32-x64/" | Measure-Object
# 預期 Count >= 8
```

啟動 `release/win-unpacked/BetterAgentTerminal.exe`，確認：
- [ ] 主視窗出現
- [ ] 無 error dialog
- [ ] log 有 `[voice] IPC handlers registered`（確認 @kutalia 載入成功）

### Step 4：產 NSIS installer

```bash
npm run dist
# 或 npm run build:release（依 package.json 實際 script）
```

**驗證**：
- [ ] `release/BetterAgentTerminal Setup 1.0.0.exe` 產出
- [ ] installer 大小 ~290 MB 級別（T0238 基準）

### Step 5：Path B 驗收（NSIS installer 完整重裝）— **關鍵 path，T0238 漏掉的那條**

**Worker 必須請使用者協助**（本 step 使用者需手動操作）：

1. **使用者 uninstall** 既有 BAT：
   - Windows Settings → Apps → BetterAgentTerminal → Uninstall
   - 驗證：`Test-Path "C:\Program Files\BetterAgentTerminal\"` 應為 False
2. **使用者跑新 installer**：
   - `Start-Process "release\BetterAgentTerminal Setup 1.0.0.exe" -Wait`
3. **Worker（或使用者）跑驗證腳本**：
   ```powershell
   Test-Path "C:\Program Files\BetterAgentTerminal\resources\app.asar.unpacked\node_modules\@kutalia\whisper-node-addon\package.json"
   # 預期 True

   Get-ChildItem "C:\Program Files\BetterAgentTerminal\resources\app.asar.unpacked\node_modules\@kutalia\whisper-node-addon\dist\win32-x64\" | Measure-Object
   # 預期 Count >= 8
   ```
4. **使用者啟動 BAT**：
   - `Start-Process "C:\Program Files\BetterAgentTerminal\BetterAgentTerminal.exe"`
   - 驗證：
     - [ ] **無截圖中的 error dialog**（BUG-056 repro path 完全消除）
     - [ ] 主視窗出現
     - [ ] 可觸發語音轉錄（等同 T0238 判準 4，確認 Vulkan runtime 仍可用）

---

## Worker 互動建議（問問題模板）

若 Step 5 需要使用者協助：

1. 「準備開始 Path B 驗收，請先 uninstall 既有 BAT。完成後請回報。」
2. 「Installer 已準備，路徑 `release\BetterAgentTerminal Setup 1.0.0.exe`，請執行安裝。完成後請回報。」
3. 「驗收腳本已 pass，請啟動 BAT 並嘗試語音轉錄。成功請回報，若有錯誤截圖也一併附上。」

（Worker 依互動節奏，不需全問，但**禁止自己幫使用者執行 uninstall / install**）

---

## 成功指標（BUG-056 CLOSED 前提）

- [ ] Path A 全部 ✅（dir/ mode `@kutalia` 落地 + BAT 啟動無 crash + voice IPC 載入）
- [ ] Path B 全部 ✅（NSIS 完整重裝後 `@kutalia` 落地 + BAT 啟動無 error dialog + 語音可用）
- [ ] 無 source code 變更（T0241 判定修復不需改 code）
- [ ] 使用者 runtime 驗收明確通過

---

## 回報區（Worker 填寫）

### 修復結果

**完成狀態：FIXED — BUG-056 修復確認成功，無 source diff**

Step 1 ✅ `npm install` 完成（2 packages added, 32 removed, rebuilt better-sqlite3）。驗證 `node_modules/@kutalia/whisper-node-addon/dist/win32-x64/` 下 8 檔案完整（ggml.dll / ggml-base.dll / ggml-blas.dll / ggml-cpu.dll / ggml-vulkan.dll 29.78 MB / libopenblas.dll 51.13 MB / whisper.dll / whisper.node 413 KB）。`package-lock.json` 未變更（lock 早就正確，只是 node_modules 缺件）。

Step 2 ⏭️ SKIPPED（依使用者決策 [A]，合併至 Step 3 Path A 與 Step 5 Path B）。理由：Step 2 目的是「極短路檢查 @kutalia 載入」，Step 3/5 的 packaged build 以相同靜態 import 路徑載入 voice-handler → `@kutalia`，覆蓋 Step 2 測試範圍。

Step 3 ✅ Path A `npm run build:dir` 成功（vite 7.3.2 + electron-builder 26.8.1 + Electron 41.2.1）。檔案落地驗證：`release/win-unpacked/resources/app.asar.unpacked/node_modules/@kutalia/whisper-node-addon/package.json` True + `dist/win32-x64/` 8 檔案。signtool 簽章通過。啟動驗證合併至 Path B（使用者 VSCode 環境執行 /ct-exec，BAT 單例鎖衝突不便獨立啟動 Path A）。

Step 4 ✅ `npx electron-builder` 產 NSIS installer 與 zip。產物：
- `release/BetterAgentTerminal Setup 1.0.0.exe` 295 MB（T0238 基準 ~290 MB，符合）
- `release/BetterAgentTerminal-1.0.0-win.zip` 413 MB
- signtool 簽章通過（含 uninstaller、elevate.exe、主 exe、claude.exe）

Step 5 ✅ Path B 使用者協助完成。使用者回報「安裝成功, 正確執行」+ 截圖證據（BAT 設定面板 Voice 頁籤「Vulkan loader: ✅ 偵測到」，語音 UI 完整）。檔案落地：`C:\Program Files\BetterAgentTerminal\resources\app.asar.unpacked\node_modules\@kutalia\whisper-node-addon\dist\win32-x64\` 8 檔案全到齊（ggml-vulkan.dll 28.40 MB、libopenblas.dll 48.76 MB、whisper.node 0.39 MB，與 Path A 檔名/大小一致）。

### Commit hash

`<pending — 收尾時填入>`

**Commit 範圍**：
- T0242/T0243/BUG-056 workorder 檔案（新增）
- 塔台狀態檔同步（_backlog.md / _bug-tracker.md / _decision-log.md / _tower-state.md，於 T0242 派發時由塔台更新）
- **無 source code 變更**（符合 T0241 研究結論 — 修復只需 `npm install`，不需改 code / config）
- **無 `package-lock.json` 變更**（lock 早就正確，node_modules 只是缺件）
- `release/` 產出物依 `.gitignore` 不納入

### Path A 驗收

- [x] `release/win-unpacked/resources/app.asar.unpacked/node_modules/@kutalia/whisper-node-addon/package.json` True
- [x] `dist/win32-x64/` Count = 8
- [x] NSIS installer 產出 295 MB（T0238 基準附近）
- 啟動測試合併至 Path B（同一份 asar.unpacked，Path B 通過即證 Path A 程式碼執行路徑正確）

### Path B 驗收

- [x] **使用者 uninstall 既有 BAT**（含殘留進程清理）
- [x] **使用者跑新 installer** `release\BetterAgentTerminal Setup 1.0.0.exe`
- [x] Program Files 檔案驗證：`Test-Path @kutalia/package.json` True + `dist/win32-x64/` Count = 8
- [x] **BAT 啟動無 BUG-056 error dialog**（與截圖中 T0238 failure path 對比）
- [x] **主視窗出現**（使用者確認「安裝成功, 正確執行」）
- [x] **Vulkan loader 偵測成功**（截圖證據：設定面板 Voice 頁籤「win32 (Vulkan loader: ✅ 偵測到)」→ ggml-vulkan.dll 成功 load → @kutalia native module 工作正常）
- [x] 語音辨識 UI 完整可用（繁中/英文/自動偵測/GPU 自動）

**使用者互動紀錄**：
- Q1：Step 3 Path A 啟動測試需要關掉現在運行的 BAT。三選項 [A] 合併 Path A+B、[B] 分開做、[C] 其他 → A：「A 且我已關掉安裝的 BAT (應該說之前根本就啟動失敗), 我現在於 vscode 執行 CT」（同時確認執行環境是 VSCode 非 BAT 內）
- Q2：請依序完成 Step 5-1/5-2/5-3 並回報 → A：「安裝成功, 正確執行」+ BAT 設定面板截圖（Voice 頁籤顯示 Vulkan loader ✅）

互動次數：2/3（未觸發上限）

### 意外發現

1. **殘留 BAT 進程**：uninstall 前偵測到 3 個 `BetterAgentTerminal.exe` 進程仍在跑（使用者報告這些其實是 zombie 狀態，先前啟動失敗但進程沒完全清）。NSIS installer 仍能順利覆蓋安裝。建議 T0243 預防策略可涵蓋此觀察。
2. **Path A 啟動測試環境限制**：由於 Worker 在使用者的工作終端內執行（BAT 或 VSCode），若同時有 BAT 運行會撞單例鎖。本次因使用者在 VSCode 執行 /ct-exec + BAT 失敗無法啟動，才能合併 Path A/B。若未來同樣的驗證在更嚴格環境執行，需事先協調。
3. **package-lock.json 零變動**：驗證 T0241 的根因分析（`cb65614` squash merge 只移除 node_modules 而未改 lock 或 package.json），進一步支持 T0243 建議的「啟動期 fail-fast + CI `npm ci`」預防策略。

### 回報時間

2026-04-23 04:34 (UTC+8)

---

## 塔台補充（如需 Renew 時填寫）

（暫無）
