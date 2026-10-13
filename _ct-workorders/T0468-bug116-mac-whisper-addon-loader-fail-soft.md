---
schema_version: 1
schema_kind: workorder
id: T0468
title: "BUG-116 修復：macOS whisper 原生模組載入（上游 dist 目錄 mac-* vs loader darwin-*）+ 延遲載入失敗不拖垮 main + verify-native-modules 檢查 host 平台 .node"
type: implementation
status: DONE
repo: better-agent-terminal
project: BUG-116
priority: P0
sizing: M
created_at: "2026-10-13T16:05:05+08:00"
started_at: "2026-10-13T16:07:01+08:00"
updated_at: "2026-10-13T16:15:12+08:00"
completed_at: "2026-10-13T16:15:12+08:00"
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

**DONE** — 7 項任務全數完成；驗收條件 5 項全 PASS（mac 實機驗收依工單定義列為剩餘步驟，非本單可驗）。

**Landing Zone Check：PASS**
- C-0：frontmatter `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal` → PASS（REPO_ROOT `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）
- C-1：工單位於 REPO_ROOT 下 → PASS
- C-3：`electron/voice-handler.ts`、`electron/main.ts`、`scripts/verify-native-modules.js` 存在；`electron/whisper-addon-loader.ts` 祖先 `electron/` 存在 → present（informational）
- C-2：無 `branch` 欄位，未比對（HEAD = `main`）
- `BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅紀錄）；`CT_MODE=yolo`、`CT_INTERACTIVE=0`

### 產出摘要

**1. 自有 loader — `electron/whisper-addon-loader.ts`（新檔，沿用工單建議命名）**
- `whisperAddonDirCandidates(platform, arch)`：`win32` → `win32-<arch>`；`linux` → `linux-<arch>`；`darwin` → `mac-<arch>`、`darwin-<arch>`（後者容許上游日後修正命名）；其他平台 → `[]`
- `toAsarUnpackedPath(p)`：只改寫 `<sep>app.asar<sep>` 段（POSIX / Windows 分隔字元皆可；已是 `app.asar.unpacked` 或 `app.asarx` 不動）。採**手動換成 `app.asar.unpacked`**（與 `codex-agent-manager.ts` `findBundledCodex` 同模式），理由：`existsSync` 檢查的就是實際要 dlopen 的實體檔；Electron 對 asarUnpack 檔案的 require 雖會自動導向，顯式路徑可避免依賴該行為
- `resolveWhisperAddonPath(packageRoot, platform, arch, exists)`：依序回傳第一個存在的 `dist/<dir>/whisper.node` + 全部嘗試過的路徑
- `buildWhisperParams(options)`：**逐字複製上游 1.1.0 `transcribe()`** 的預設值合併（`language:'en'`、`use_gpu:true`、`flash_attn:false`、`no_prints:true`、`comma_in_time:false`、`translate:true`、`no_timestamps:false`、`detect_language:false`、`audio_ctx:0`、`max_len:0`，caller 覆寫全部）與驗證（`Model path is required` / `Input file path is required`）
- `createWhisperAddonLoader(deps)`（依賴注入，供測試）：`load()` 首次呼叫才 `require.resolve('@kutalia/whisper-node-addon/package.json')` → 解析路徑 → `require(<.node>)` 取 `whisper` → `promisify`；**成功或失敗都快取**，失敗時 `logger.error` **只記一次**完整錯誤。`transcribe()` 載入失敗丟 `WhisperAddonUnavailableError`（`code = 'WHISPER_ADDON_UNAVAILABLE'`，訊息 `Voice recognition module (whisper) is unavailable: <原因>`）
- 匯出 process-wide 單例 `loadWhisperAddon()` / `transcribe()`（`createRequire(import.meta.url ?? __filename)`，與 `claude-runtime-router.ts` / `codex-agent-manager.ts` 相同寫法）
- 型別：`import type { WhisperOptions } from '@kutalia/whisper-node-addon'`（type-only，編譯後抹除，不產生 runtime require）
- 上游原始碼來源：工單派發後本機 `node_modules/@kutalia/whisper-node-addon/` 已於 **16:06 被還原**（非本單所為，見「遭遇問題」），直接閱讀 `dist/js/index.js` / `index.d.ts`（v1.1.0），內容與 BUG-116 根因段一致，未另行 `npm pack`

**2. fail-soft — `electron/voice-handler.ts`**
- 移除頂層 `import { transcribe } from '@kutalia/whisper-node-addon'`，改 import `./whisper-addon-loader`
- `voice:transcribe` handler 開頭（模型檢查與寫暫存 WAV 之前）先 `loadWhisperAddon()`；不可用 → `logger.warn` 一行 + 丟 `WhisperAddonUnavailableError`（完整錯誤已由 loader 記過一次）。理由：addon 不可用時先回報「模組不可用」，避免使用者被引導去下載 466 MB 模型後才發現
- 其餘參數完全不變：`model` / `fname_inp` / `use_gpu: resolveUseGpu(prefs.gpuMode)` / `no_prints: true` / `translate: false`（BUG-057）/ `language` 僅非 `auto` 時傳
- **renderer 不改**：`useVoiceRecording.ts` 既有 catch 會顯示 `辨識失敗: ${err.message}`，`PromptBox.tsx:400-403` 以 `⚠ {voice.error}` 呈現 ⇒ 錯誤訊息已能顯示「Voice recognition module (whisper) is unavailable: …」。工單條件「若 renderer 目前無法顯示」不成立，故未加 i18n（該 hook 現有字串本就是硬編中文、未走 i18n）

**3. 同類風險掃描（只回報，未修）**

| 模組 | 載入位置 | 結論 |
|---|---|---|
| `@lydell/node-pty` | `pty-manager.ts:14-25`、`terminal-server/server.ts:12` 頂層 `require` | ✅ 已包 try/catch，失敗 fallback child_process |
| `better-sqlite3` | `electron/` 內**無任何 import**（`snippet-db.ts` 實為 JSON 檔） | ✅ 無啟動風險（僅存在於 deps / verify 清單） |
| `@img/sharp-*` | `electron/` 內無 import（隨 claude-agent-sdk 打包） | ✅ 無啟動風險 |
| `opencc-js`（純 JS，非原生） | `voice-opencc.ts:13` 頂層 `require('opencc-js')`，**未包 try/catch**；經 `voice-handler` → `main.ts` 頂層鏈載入 | ⚠️ 同型風險（低）：套件缺失時同樣會讓 main 啟動崩潰；檔頭註解宣稱「never throw」但頂層 require 不在保護內。建議另開小單改為延遲 require（`ensureConverter()` 內） |

**4. `scripts/verify-native-modules.js` 加深**
- 原 `package.json` 存在檢查不變；新增 host 平台 `whisper.node` 檢查，規則 `whisperAddonDirCandidates` 為 loader 的 JS 複本（加註同步），並由 `electron/__tests__/whisper-addon-loader.test.ts` 以 5 平台 × 3 arch 矩陣**斷言兩份規則相同**
- `WHISPER_ADDON_REQUIRED_HOSTS = win32-x64 / linux-x64 / darwin-x64 / darwin-arm64`（桌面包 host）：缺 binary → exit 1 + actionable 訊息（列出找過的路徑、成因、`npm install` / `npm ci` 修法）。**其他 host 只 warn 不擋**——原因：`build-server-bundle.yml` 在 `ubuntu-22.04-arm`（linux-arm64）跑此腳本，上游無 `linux-arm64` binary，硬擋會打壞 server bundle CI；runtime 端該平台由 loader fail-soft
- 為了讓 parity 測試能 import 規則：邏輯包進 `main()`，`module.exports = { whisperAddonDirCandidates, WHISPER_ADDON_REQUIRED_HOSTS }`，`process.env.VITEST` 存在時不執行 `main()`；CLI 執行與 `build-version.js` 的 side-effect `require('./verify-native-modules')` 行為不變

**5. 「前兩天還能開」查證（git 歷史）**
- `main.ts` 自 `882be11`（2026-04-11）起頂層 `import { registerVoiceHandlers } from './voice-handler'`
- `voice-handler.ts` 自 `cb65614`（2026-04-23，EXP-GPUWHIS-001）起頂層 `import … from '@kutalia/whisper-node-addon'`（之前是 `whisper-node-addon`）；vite 將其列為 external → bundle 頂層 `require`
- `package-lock.json` 在 `v0.2.5-pre.1`、`v0.3.0`、`v0.5.9-pre.4`、`v0.6.0-pre.1`、`v0.6.0-pre.2` 皆鎖 `1.1.0`；第一個含 `cb65614` 的 tag 為 `v0.2.5-pre.1`
- **結論**：依程式碼，**自 `v0.2.5-pre.1` 起所有 macOS 版本（arm64 與 x64）啟動必崩**，非 pre.2 引入。回報者「前兩天還能開」無法以程式碼變更解釋；最可能是舊 process 持續執行至近日才重啟（`app.asar` mtime 10-05 13:01 = pre.2 安裝時間，pre.1 亦同樣會崩）。此為靜態推論，未有 mac runtime 佐證

**6. 單元測試**（27 項，2 檔）
- `electron/__tests__/whisper-addon-loader.test.ts`（24）：目錄候選（darwin mac-* 優先 / darwin-* fallback、win32、linux、不支援平台）；與 verify 腳本規則 parity；asar → asar.unpacked（POSIX / Windows / 不誤改）；**win32-x64 與 linux-x64 解析結果 = 上游 `join(resolve(__dirname),'..','<p>-<a>','whisper.node')` 的路徑**；app.asar 根目錄解析到 unpacked；上游預設參數逐欄比對、caller 覆寫、驗證錯誤；延遲載入 + 只 require 一次 + 原生 callback 參數；原生錯誤傳遞；**失敗快取：3 次 transcribe 只 require 1 次、logError 1 次、每次皆丟 `WhisperAddonUnavailableError`**；套件未安裝 / 無 binary（列出 tried 路徑）/ 不支援平台 / 無 `whisper` export
- `electron/__tests__/voice-handler-whisper-fail-soft.test.ts`（3）：`@kutalia/whisper-node-addon` 被 mock 成 import 即 throw → 證明 voice-handler 不再 import 上游；`registerVoiceHandlers` 在 addon 不可用時照常註冊、不觸發載入；`voice:transcribe` 回 `WhisperAddonUnavailableError` 且不呼叫原生 transcribe；addon 可用時流程照舊進入模型檢查

**7. BUG-116**：狀態改 ✅ FIXED、`links.fix_workorder: T0468`（原已填），新增「修復（T0468）」段；`_bug-tracker.md` 未動（塔台 sync）

**變更檔案**
- 新增：`electron/whisper-addon-loader.ts`、`electron/__tests__/whisper-addon-loader.test.ts`、`electron/__tests__/voice-handler-whisper-fail-soft.test.ts`
- 修改：`electron/voice-handler.ts`、`scripts/verify-native-modules.js`、`_ct-workorders/BUG-116-mac-arm64-whisper-addon-load-failure-crashes-main.md`、本工單
- 未動：`electron/main.ts`（掃描用）、`src/`（renderer 無需改）、`package.json` / `package-lock.json` / `node_modules/`

### 驗證結果

| Lane | Gate | 結果 | 證據 |
|---|---|---|---|
| build & tests | `npx vitest run` 本單 2 檔 | ✅ PASS | 2 files / 27 passed |
| build & tests | `npm run test:unit` 全套 | ✅ PASS | **170 files / 2888 passed / 1 skipped / 0 failed**（基線 2861 → +27 = 本單新增）；輸出中的 `AttachConsole failed`（node-pty conpty agent）為既有雜訊，不影響結果 |
| build & tests | `npx vite build` | ✅ PASS | exit 0（首次即成功，未與 T0467 衝突）；新 main chunk `dist-electron/main-BPDqQX02.js` 中 `require("@kutalia/whisper-node-addon")` 出現 **0** 次，套件名只出現在 loader 的 `createRequire(...).resolve(\`${pkg}/package.json\`)` |
| source | `npx tsc --noEmit`（root，僅 `src/`） | ✅ PASS | **36** error（= 基線 36，未增加） |
| source | scratchpad tsconfig（extends root，strict + noUnused；含 loader / voice-handler / 2 測試） | ✅ PASS | exit 0，**0 error** |
| runtime smoke（Windows） | 以 esbuild 把 loader 打包到 scratchpad，用 repo `node_modules` 的真 `win32-x64/whisper.node` + 使用者既有 `ggml-small.bin` 轉寫 1 s 靜音 WAV（`use_gpu:false`、`translate:false`） | ✅ PASS | `transcribe ok 1881 ms {"transcription":[["00:00:00.000","00:00:10.000"," [BLANK_AUDIO]"]]}`；同一 smoke 先以錯誤 package root 執行，證明 fail-soft 路徑：`logger.error` 一次 + `ok=false`，process 不崩 |
| Windows 行為不變 | win32-x64 路徑 = 上游 | ✅ PASS | 單元測試斷言 + 上述真實載入 |
| verify script | `node scripts/verify-native-modules.js`（本機） | ✅ PASS | exit 0，`whisper binary: node_modules\@kutalia\whisper-node-addon\dist\win32-x64\whisper.node`（node_modules 已被還原，故非工單預期的 fail） |
| verify script | scratchpad 假 node_modules 樹 | ✅ PASS | 只有 `mac-arm64` 時：win32-x64 host → exit 1 + actionable 訊息；補 `win32-x64` → exit 0；模擬 darwin-arm64 → exit 0（解析到 `mac-arm64`）；模擬 darwin-x64（缺 `mac-x64`）→ exit 1 並列出 `mac-x64` / `darwin-x64` 兩路徑；模擬 win32-arm64（非桌面 host）→ warn + exit 0 |
| runtime（macOS） | 實機啟動 + 語音 | ⏸️ NOT RUN | 無 mac 環境，需 mac 使用者驗收（見剩餘步驟） |

### 遭遇問題 / 剩餘步驟

**遭遇問題**
1. **本機 `node_modules/@kutalia/whisper-node-addon/` 已在開工時被還原**：工單記載「只剩 `node_modules/node-addon-api/`」，但本 Worker 16:06:47 首次檢查時套件已完整（`package.json` + `dist/{js,linux-x64,mac-arm64,mac-x64,win32-x64}`，mtime 皆 16:06）。本單未執行任何 install / rebuild，推測為塔台或 T0467 Worker 所為，請塔台確認來源。影響：verify 腳本本機為 PASS 而非工單預期的 fail；可直接閱讀上游原始碼與做真實 Windows smoke（加分驗證）
2. `_local-rules.md` 內找不到 `L138` / `L146` 編號錨點（應在其他 learnings 檔）；依工單 `memory_overrides` 文字照辦（未用 stash/reset/checkout/restore；tsc 基線 36）
3. 工作樹 `electron/voice-handler.ts` 為 CRLF（`core.autocrlf=true`，index 為 LF）；編輯時保留工作樹原行尾，commit 由 git 正規化為 LF；新檔皆為 LF

**剩餘步驟（非本單範圍）**
1. 🔴 **mac 實機驗收**（需 mac 使用者，如回報者 Gary）：新版 dmg 安裝後（不需 symlink workaround）app 可啟動；Voice 錄音轉寫可用（應載入 `mac-arm64/whisper.node`，log 出現 `[voice] whisper addon loaded: …app.asar.unpacked…/dist/mac-arm64/whisper.node`）；若先前手動建立過 `darwin-arm64` symlink 也不影響（mac-* 優先）
2. 本機 node_modules 還原：工單原列為塔台剩餘步驟；目前觀察到已還原，請塔台確認後勾銷
3. 建議另開小單：`electron/voice-opencc.ts` 頂層 `require('opencc-js')` 改延遲載入（任務 3 掃描發現的唯一同型風險）
4. 建議（BUG-116 修復方向 4 的 CI 部分，非本單範圍）：mac CI job 在打包後對**兩個 arch** 產物檢查 `app.asar.unpacked/.../dist/mac-<arch>/whisper.node`；本單的 verify 只檢查 host arch（`macos-latest` = arm64）
5. 可考慮於 CLAUDE.md「Packaging / Release 前置檢查」補一句 verify-native-modules 已含 whisper host binary 檢查（本單 affects_files 未含 CLAUDE.md，未改）

### 回報時間

2026-10-13T16:14:53+08:00
