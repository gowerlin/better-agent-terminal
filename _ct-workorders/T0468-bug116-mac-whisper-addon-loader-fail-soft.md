---
schema_version: 1
schema_kind: workorder
id: T0468
title: "BUG-116 修復：macOS whisper 原生模組載入（上游 dist 目錄 mac-* vs loader darwin-*）+ 延遲載入失敗不拖垮 main + verify-native-modules 檢查 host 平台 .node"
type: implementation
status: PENDING
repo: better-agent-terminal
project: BUG-116
priority: P0
sizing: M
created_at: "2026-10-13T16:05:05+08:00"
started_at: null
updated_at: "2026-10-13T16:05:05+08:00"
completed_at: null
target_version: next
depends_on: []
related:
  - "BUG-116（根因段：回報者資料 + 上游 @kutalia/whisper-node-addon@1.1.0 loader 與目錄命名不一致）"
  - "BUG-056（whisper addon 缺失 → 語音壞；verify-native-modules.js 由此而來）"
  - "BUG-057 / cb65614 / b2124b5（改用 @kutalia + translate=false 覆寫）"
  - "T0467（並行中：PLAN-039 實機驗收，會跑 vite build + Playwright；見 memory_overrides 的 node_modules 禁令）"
affects_files:
  - electron/voice-handler.ts
  - electron/whisper-addon-loader.ts
  - electron/__tests__/
  - electron/main.ts
  - scripts/verify-native-modules.js
  - src/
  - _ct-workorders/BUG-116-mac-arm64-whisper-addon-load-failure-crashes-main.md
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **不新增依賴、不跑 `npm install` / `npm ci` / `npm rebuild`、不改 `package.json` / `package-lock.json` 的依賴**：T0467 Worker 正在同一工作樹跑 vite build + Playwright，動 `node_modules/` 會干擾它。因此**不採 patch-package**，改以 BAT 自有 loader 繞過上游 `dist/js/index.js`。本機 `node_modules/@kutalia/whisper-node-addon/` 目前殘缺（只剩 `node_modules/node-addon-api/`），測試一律 mock，不依賴真 `.node`；本機還原留給塔台在 T0468 / T0467 都結束後做，回報區列為剩餘步驟。"
  - "🔴 `npx vite build` 可以跑，但 T0467 也會 build：若 `dist-electron/` 被另一方同時寫入導致失敗，等 1 分鐘重試一次並在回報區註明，不要刪 `dist-electron/`。"
  - "🔴 **禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）；`git add` 只加本單改動檔（T0467 會同時有未 commit 檔案，不得順手加入）；寫檔維持 LF；不 push；不發版。"
---

# T0468 — BUG-116 修復：macOS whisper 載入 + fail-soft

## 背景（必讀 BUG-116「根因」段）

- 上游 `@kutalia/whisper-node-addon@1.1.0`（lock 鎖定，也是 npm 最新版）`dist/js/index.js`：`PLATFORM_MAPPING = { darwin: 'darwin', … }`，以 `` `${platform}-${arch}` `` 找 `dist/<dir>/whisper.node`；但套件實際出貨目錄是 `mac-arm64` / `mac-x64`（另有 `win32-x64`、`linux-x64`）⇒ **macOS 永遠找不到**
- 上游在模組頂層執行 `loadAddon()`；BAT `electron/voice-handler.ts:33` 頂層 `import { transcribe as whisperTranscribe } from '@kutalia/whisper-node-addon'`，`main.ts` 頂層 import `registerVoiceHandlers` ⇒ **macOS 啟動即 Uncaught Exception，app 打不開**
- 回報者實測：M2 Pro、arm64 dmg、codesign 通過、bundle 自 10-05 未被改動；`app.asar.unpacked/.../dist/` 只有 `js linux-x64 mac-arm64 mac-x64 win32-x64`

## 任務

1. **自有 loader**（新檔 `electron/whisper-addon-loader.ts`，命名可調整並在回報區說明）：
   - **延遲載入**：第一次需要轉寫時才載入，結果快取（成功或失敗都快取，失敗時保留錯誤訊息）
   - **直接 `require` `.node`**，不 require 上游 `dist/js/index.js`（它頂層就會 throw）。目錄解析：`win32` → `win32-<arch>`；`linux` → `linux-<arch>`；`darwin` → 依序嘗試 `mac-<arch>`、`darwin-<arch>`（容許上游日後修正命名）。套件根目錄以 `require.resolve('@kutalia/whisper-node-addon/package.json')` 或等價方式取得，並處理 asar：`.node` 實際在 `app.asar.unpacked`（Electron 的 asar require 會自動導向 unpacked；請確認 `require.resolve` 回傳 `app.asar` 路徑時 `require(<.node>)` 仍可行，若需要手動把 `app.asar` 換成 `app.asar.unpacked` 就換，並寫單元測試）
   - **完全複製上游 `transcribe()` 的語意**：讀上游 `dist/js/index.js` 的 `transcribe`（預設參數合併、`promisify(whisper)` 呼叫、回傳格式），在 loader 內等價實作；`voice-handler.ts` 既有的參數（含 BUG-057 的 `translate: false` 覆寫、`use_gpu` 由 `resolveUseGpu` 決定）行為**不得改變**。上游原始碼可用 `npm pack @kutalia/whisper-node-addon@1.1.0` 下載到 scratchpad 的**獨立新目錄**閱讀（不得解到 repo 內、不得執行其中任何腳本）
2. **fail-soft**：`voice-handler.ts` 改用 loader；載入失敗時 → `logger.error` 記錄一次完整錯誤；語音轉寫 IPC 回傳明確錯誤（沿用既有錯誤回傳管道與 renderer 既有錯誤顯示；若 renderer 目前無法顯示「語音模組不可用」，加最小提示文字並補三語 i18n）；**app 正常啟動、其他功能不受影響**
3. **掃描同類風險**：檢查 `electron/main.ts` 啟動路徑上其他 optional 原生模組是否也是頂層 eager import（`node-pty` / `better-sqlite3` 屬核心可不改）；**只回報**，不在本單修
4. **`scripts/verify-native-modules.js` 加深**：對 whisper addon 以**與 runtime loader 相同的解析規則**檢查 host 平台（`process.platform` / `process.arch`）的 `whisper.node` 是否存在；缺則 fail-fast 並給出 actionable 訊息。解析規則最好由 loader 匯出的純函式共用（`.js` 腳本無法 import `.ts` 時，在腳本內複製規則並加註「與 `electron/whisper-addon-loader.ts` 同步」）。注意本機 node_modules 目前殘缺 → 本機跑此腳本會 fail，這是預期；**不要**為了讓它通過而去還原 node_modules
5. **「前兩天還能開」查證（best-effort，不阻塞）**：從 git 歷史判斷 macOS 啟動路徑何時開始 eager import whisper（`cb65614` 2026-04-23 起？`main.ts` 何時頂層 import `voice-handler`？），回報區給結論：是否自某版起所有 mac 使用者都必現
6. 單元測試：loader 路徑解析（darwin → mac-* 優先、darwin-* fallback；win32 / linux；asar → asar.unpacked）、載入失敗快取與 fail-soft、transcribe 參數合併與上游一致（mock 原生 `whisper`）
7. BUG-116：回報區完成後把 BUG 檔狀態改 ✅ FIXED、填 `links.fix_workorder: T0468`（只改 BUG 檔本身；`_bug-tracker.md` 由塔台 sync）

## 驗收條件

- [ ] `npx vitest run <本單新增 / 相關測試>` 綠；`npm run test:unit` 全套 0 failed（與基線 2861 比較，列出數字）
- [ ] `npx vite build` exit 0
- [ ] `npx tsc --noEmit` error 數不增加（基線 36，僅 `src/`，L146）；electron 改動另以 scratchpad tsconfig 檢查 0 新錯
- [ ] Windows 行為不變：`win32-x64` 解析路徑與上游一致（測試證明）
- [ ] 回報區明列：mac 實機無法由本單驗證（無 mac 環境）→ 需 mac 使用者驗收；本機 node_modules 還原為塔台剩餘步驟

## Sub-session 執行指示

1. 讀本工單 + BUG-116 全文 + `electron/voice-handler.ts` + `scripts/verify-native-modules.js`
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 實作 → 驗收；填回報區；完成寫 **`DONE`**
4. commit 本單改動檔 + 本工單 + BUG-116；不 push；依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫

### 完成狀態

### 產出摘要

### 驗證結果

### 遭遇問題 / 剩餘步驟

### 回報時間
