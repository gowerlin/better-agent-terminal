# 工單 T0018-fix-whisper-addon-load

## 元資料
- **工單編號**：T0018
- **任務名稱**：BUG-005 治本修復 — whisper native addon 動態 require 失敗
- **狀態**：DONE
- **類型**：Hotfix + Build-system fix
- **前置條件**：T0004 DONE（whisper integration）、T0017-β DONE（BUG-004 修復證實錄音鏈路 OK）
- **嚴重度**：🔴 HIGH（Phase 1 驗收最後阻斷）
- **預估工時**：30 - 60 分鐘（硬性上限 60 分鐘）
- **建立時間**：2026-04-11 13:52 (UTC+8)
- **建立者**:Control Tower
- **開始時間**：2026-04-11 13:56 (UTC+8)
- **完成時間**：2026-04-11 14:00 (UTC+8)
- **目標子專案**：better-agent-terminal（單一專案）

## 工作量預估
- **預估規模**：小
- **Context Window 風險**：低（聚焦在 electron/ main process build 設定 + 1-2 個 loader 檔案）
- **降級策略**：若 60 分鐘仍未能 runtime 驗證，回報 PARTIAL 附帶：
  1. 已確認的根因
  2. 已套用的部分修復
  3. 剩餘工作清單
  4. 建議的下一張工單切分

## Session 建議
- **建議類型**：🆕 新 Session
- **原因**：避免污染塔台 context；build 系統問題需要讀大量設定檔和原始碼

## 任務指令

### BMad 工作流程
無（build system hotfix，不走標準 story 流程）

### 前置條件
需載入的文件清單：
- 本工單全文
- 錯誤訊息（見下方「已知事實」）
- 必要時讀 `_ct-workorders/T0004-whisper-integration.md` 的回報區了解原始設計

### 輸入上下文

#### 專案背景
Electron + Vite + React + TypeScript 的 voice-enabled terminal。whisper.cpp 本地 native addon 做語音轉文字。剛剛 T0017-β（AudioWorklet migration）修復 BUG-004（錄音閃退），現在錄音鏈路 OK，但按下轉寫按鈕立刻暴露 **BUG-005**：whisper native addon 載入失敗。

#### 已知事實

**使用者回報的錯誤訊息（原文）**：
```
⚠️ 辨識失敗: Error invoking remote method 'voice:transcribe':
Error: Failed to load native addon:
Error: Could not dynamically require "D:\ForgejoGit\better-agent-terminal-main\better-agent-terminal\platform\win32-x64\whisper.node".
Please configure the dynamicRequireTargets or/and ignoreDynamicRequires option of @rollup/plugin-commonjs appropriately for this require call to work.
```

**關鍵線索**：
1. 錯誤來源：main process 的 IPC handler `voice:transcribe`
2. 載入路徑：`platform/win32-x64/whisper.node`
3. 錯誤類型：`@rollup/plugin-commonjs` 無法在 build 階段解析動態 require 字串
4. 錯誤訊息**明確指名**：`dynamicRequireTargets` 或 `ignoreDynamicRequires` 設定

**塔台判定（基於行業知識 L013）**：
- 這是 **Vite + Electron + native `.node` 的經典 bundling 問題**
- **業界標準做法**：把 `.node` 檔案標為 external，讓 Electron runtime 用 Node 原生 `require` 載入，**不走 Vite bundler**
- 補強做法：使用 `createRequire(import.meta.url)` 或 `__non_webpack_require__` 避免被 bundler 轉換
- GitHub 上同錯誤訊息案例上百筆，修法高度一致

#### 使用者選擇
- 這是**從未正常過**的狀態（T0004 當時未做完整 runtime 測試，只驗了 addon loader 單元）
- **優先級最高**（Phase 1 驗收就差這一哩路）
- **直衝治本**（L013 模式，不做漸進診斷，直接依業界最佳做法修）
- 使用者**不記得** T0004 當時的具體整合方式，需要 sub-session 自行探勘

### 技術藍圖（執行方針）

本工單分三階段，緊扣 60 分鐘預算：

#### Phase A：探勘（預算 5 - 15 分鐘）

**目標**：定位根因和現況，不做修改。

1. **確認 `.node` 檔案存在**：
   ```bash
   ls -la platform/win32-x64/whisper.node
   ls -la platform/ 2>/dev/null
   ```

2. **找出 require 呼叫點**（grep 全專案）：
   ```
   require.*whisper\.node
   whisper\.node
   platform.*whisper
   addon.*whisper
   ```
   預期在 `electron/` 某個 voice-related loader 或 service 檔案。

3. **找出 Vite 設定檔**（可能的位置）：
   - `vite.config.ts`（renderer）
   - `electron.vite.config.ts`（electron-vite 風格）
   - `vite.main.config.ts` / `vite.preload.config.ts`（拆分風格）
   - `package.json` 裡的 build scripts
   - 檢查 `package.json` dependencies 判斷用的是 `vite` / `electron-vite` / `electron-forge` / `electron-builder` 哪個工具鏈

4. **讀現有 Vite 設定**（只讀，不改）：
   - 看 `build.rollupOptions.external` 現況
   - 看 `optimizeDeps` / `commonjsOptions` 現況
   - 看 main process 的 entry 和 output 設定
   - 看有沒有已經針對 `.node` 做特殊處理的痕跡

5. **讀 require 呼叫點附近 10 - 30 行**，理解：
   - `.node` 路徑是寫死還是字串拼接（`platform/${process.platform}-${process.arch}/whisper.node`）？
   - 是用 `require()`、`createRequire()`、還是其他方式載入？
   - 是否有 try/catch 做 fallback？

6. **Phase A 產出**：決定走哪條修復路徑（見 Phase B 的三個 Case）。

#### Phase B：治本修復（預算 15 - 30 分鐘）

依 Phase A 的發現選擇對應 Case：

##### Case 1（最可能 80%）：Vite 沒把 `.node` 標為 external
**症狀**：Vite 設定檔裡完全沒看到 `.node` 的特殊處理。

**修法**：
1. 在 main process 的 Vite 設定加入：
   ```ts
   build: {
     rollupOptions: {
       external: [
         // ... 其他 external
         /\.node$/,  // 所有 .node 檔案都不要打包
       ],
     },
   },
   ```
2. 在 require 呼叫點改用 runtime 安全的方式：
   ```ts
   import { createRequire } from 'node:module'
   const require = createRequire(import.meta.url)
   // 然後 require(absolutePath) 會在 runtime 呼叫 Node 原生 require
   ```
3. 若 `.node` 路徑是拼接而成，確保拼接後是**絕對路徑**（用 `app.getAppPath()` 或 `path.join(__dirname, ...)`）。

##### Case 2（次可能 15%）：有設定但壞了
**症狀**：Vite 設定檔裡已有 `.node` 相關處理，但失效（可能 regex 錯、順序錯、或 plugin 順序錯）。

**修法**：
1. 比對現有設定和業界標準範例
2. 修正 regex / 順序 / plugin 組合
3. 確認 `@rollup/plugin-commonjs` 若存在，它的 `ignoreDynamicRequires: true` 或 `dynamicRequireTargets: [...]` 至少要設其一

##### Case 3（邊緣 5%）：Electron asar 打包問題
**症狀**：`.node` 在 dev 環境能用，但 prod build 路徑解析到 asar 內部失敗。

**修法**：
- 加入 `electron-builder` 或 `@electron-forge/plugin-vite` 的 `asarUnpack` 規則
- 或改用 `process.resourcesPath` 建立絕對路徑

#### Phase C：驗證（預算 5 - 15 分鐘）

1. **Build 驗證**：
   ```bash
   npx vite build  # 或專案實際用的 build command
   ```
   - 必須無 "Could not dynamically require" 警告
   - 必須無其他新錯誤
   - 若專案有 `npm run build:main` / `npm run build:electron` 類似命令，一併跑

2. **Grep 殘留檢查**：
   ```
   grep -r "Could not dynamically require" dist/ out/ build/  # 看 bundled 輸出是否還有錯誤字串
   grep -r "\.node" electron/  # 確認沒有漏網的動態 require
   ```

3. **回傳使用者 runtime 測試步驟**（工單回報區寫清楚）：

   ```
   ## 👤 使用者測試步驟（T0018 BUG-005 修復驗證）

   1. 若 Dev Server 正在跑，VS Code Task「開發: 終止所有 Dev 進程」
   2. VS Code Task「開發: 啟動 Dev Server (Runtime)」
   3. 等 BAT 啟動（看 Logs/ 產生新 debug-*.log）
   4. 打開 %APPDATA%\better-agent-terminal-runtime-1\Logs\ 的最新 debug-*.log
   5. 在 PromptBox 按麥克風按鈕開始錄音
   6. 講 1-3 秒話
   7. 按停止錄音
   8. 觀察結果

   ### 預期成功
   - 不出現「辨識失敗」紅色提示
   - 看到轉寫結果插入 prompt box
   - log 裡 `[voice] transcribe` 類訊息成功

   ### 預期失敗（要回塔台）
   - 仍看到 "Could not dynamically require" → Case 選錯，重新探勘
   - 看到 "whisper.node not found" → 路徑拼接問題
   - 看到 "invalid ELF/Mach-O" 類訊息 → 平台/架構不匹配（edge case）
   - 看到 addon load 成功但 transcribe 回空字串 → 不是本工單範圍，另開工單
   ```

### 預期產出
1. **修改的檔案**：
   - Vite 設定檔（1-2 個）
   - require whisper.node 的 loader 檔案（1 個）
2. **Commit**：1 個 atomic commit，訊息格式 `fix(voice): resolve whisper native addon dynamic require (BUG-005)`
3. **工單回報區**：完整填寫

### 驗收條件
- [ ] Phase A 探勘結果記錄在回報區（Case 判定、根因、現況摘要）
- [ ] 決定採用的修法寫在回報區（引用的 Case 和變動點）
- [ ] `vite build`（或專案實際 build command）通過，無 "Could not dynamically require" 錯誤
- [ ] 全 codebase grep 「Could not dynamically require」無殘留
- [ ] 使用者測試步驟完整寫入回報區（§9）
- [ ] Git commit 已完成（單一 atomic commit）
- [ ] 回報區「遭遇問題」列出任何非預期發現
- [ ] 若 60 分鐘逼近上限，**立即停手**回報 PARTIAL，**不**繼續延長

### 執行注意事項

**L013 原則**（來自 T0017-β 的實戰教訓）：
- 業界已知最佳方案 + 低成本 → **直接採用**，不做漸進驗證
- 不要因為「想多看一下再決定」就把工時拉長
- 若 Phase A 發現根因和預期一致（Case 1），**直接跳 Phase B**，不要回塔台問確認

**嚴格禁止**：
- ❌ 順便清理 T0017-β 回報的 233 個 TypeScript baseline 錯誤（**不是本工單範圍**）
- ❌ 順便重構 voice 模組其他部分
- ❌ 加任何與 whisper addon 載入無關的檔案
- ❌ 超過 60 分鐘還不收尾（改用 PARTIAL 回報）
- ❌ 做任何破壞性 git 操作（force push、reset --hard）

**允許的範圍延伸**：
- ✅ 若發現 whisper addon 載入時有明顯的 error handling 缺漏（例如完全沒 try/catch），可順手補上（最多 5 行程式碼）
- ✅ 若 require 呼叫點有明顯的路徑拼接 bug（例如寫錯 arch），順手修正
- ✅ 若發現 `platform/` 目錄下還有其他 `.node` 檔（如 darwin-arm64、linux-x64），**同一個 Vite external 規則**順便涵蓋

## Sub-session 執行指示

> **重要**：請在開始工作前，將「開始時間」填入當前時間。
> 完成後請填寫「回報區」。無論成功、失敗或需要後續指示，都必須填寫。

### 執行步驟
1. 讀取本工單全部內容
2. 更新「開始時間」欄位
3. 執行 Phase A 探勘，記錄發現
4. 決定 Case，執行 Phase B 修復
5. 執行 Phase C 驗證
6. 在回報區 §9 寫下使用者測試步驟
7. Git atomic commit
8. 填寫回報區（§1 - §10）
9. 更新「狀態」（DONE / FAILED / BLOCKED / PARTIAL）
10. 更新「完成時間」

### 回報區分節要求
請在回報區內依以下分節填寫，便於塔台快速判讀：

- **§1 完成狀態**：DONE / FAILED / BLOCKED / PARTIAL + 一句話總結
- **§2 Phase A 探勘結果**：發現的 Case、根因、現況摘要
- **§3 採用修法**：引用的 Case + 實際變動點條列
- **§4 修改檔案清單**：檔名 + 行數變動 + 關鍵變動摘要
- **§5 Build 驗證**：build command 輸出摘要
- **§6 Grep 殘留**：殘留檢查結果
- **§7 Git**：commit SHA + git diff --stat
- **§8 遭遇問題**：任何非預期發現或需塔台介入事項
- **§9 使用者測試步驟**：完整可複製的測試流程
- **§10 L013 執行紀錄**：這次是否符合 L013 原則？有無偏離？（塔台下次萃取學習用）

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態
DONE — 已治本修復 BUG-005：`whisper-node-addon` 不再被 Vite 內嵌，改由 Node runtime 載入。

### 產出摘要
**§1 完成狀態**
- DONE：根因為 main process build 未將 `whisper-node-addon` external，導致 bundled 產物把套件內的動態 require 轉成 `commonjsRequire` stub。

**§2 Phase A 探勘結果**
- Case 判定：**Case 1**（Vite 沒把 native addon 載入路徑 external 化）。
- 現況摘要：
  - `vite.config.ts`（main build）原本 `external` 只含 `@lydell/node-pty`、`ws`、`bufferutil`、`utf-8-validate`。
  - `dist-electron/main.js` 出現 `commonjsRequire(addonPath)`，拋出 `"Could not dynamically require"`。
  - `node_modules/whisper-node-addon/platform/win32-x64/whisper.node` 實體存在，排除「檔案不存在」假設。

**§3 採用修法**
- 採用 Case 1：
  - 在 main process 的 Rollup external 新增 `whisper-node-addon`。
  - 同步新增 `/\\.node$/` 規則，避免任何 `.node` 檔被打包器誤處理。
- 結果：main bundle 保留 runtime 的 `require('whisper-node-addon')`，不再內嵌套件內部動態 require 邏輯。

**§4 修改檔案清單**
- `vite.config.ts`（+8/-1）：`rollupOptions.external` 新增 `whisper-node-addon` 與 `/\\.node$/`。

**§5 Build 驗證**
- 執行 `npx vite build`：成功（renderer / electron main / preload 全部完成建置）。

**§6 Grep 殘留**
- `dist-electron` grep `"Could not dynamically require"`：無殘留。
- `dist` grep `"Could not dynamically require"`：無殘留。
- `dist-electron/main.js` grep `whisper\\.node`：無（表示未再把 addon 內部 loader 內嵌進 bundle）。

**§7 Git**
- Commit SHA：`9003f29`
- `git show --stat`：
  - `vite.config.ts | 9 ++++++++-`
  - `1 file changed, 8 insertions(+), 1 deletion(-)`

**§8 遭遇問題**
- 無。
- 補充：repository 目前有其他既存未提交變更；本工單 commit 僅納入 `vite.config.ts`，未混入其他檔案。

**§9 使用者測試步驟**
1. 若 Dev Server 正在跑，先執行「開發: 終止所有 Dev 進程」。
2. 執行「開發: 啟動 Dev Server (Runtime)」。
3. 等 BAT 啟動，確認 `%APPDATA%\\better-agent-terminal-runtime-1\\Logs\\` 產生新的 `debug-*.log`。
4. 在 PromptBox 按麥克風開始錄音，講 1-3 秒後停止。
5. 觀察結果：不應出現「辨識失敗」，應有轉寫文字回填。
6. 若仍失敗，檢查 log 是否仍有 `"Could not dynamically require"`。

**§10 L013 執行紀錄**
- 符合 L013：Phase A 確認根因即命中 Case 1，直接套用業界標準修法，未做無效迂迴嘗試。
- 無偏離。

### 互動紀錄
無

### 遭遇問題
無

### sprint-status.yaml 已更新
不適用（根目錄、`_bmad-output/`、`docs/` 均未找到 `sprint-status.yaml`）

### 回報時間
2026-04-11 14:00 (UTC+8)
