---
schema_version: 1
schema_kind: bug
id: BUG-116
title: "macOS（0.6.0-pre.2）啟動即崩潰：main process 載入 @kutalia/whisper-node-addon 找不到 darwin-arm64/whisper.node → Uncaught Exception，整個 app 無法開啟"
status: FIXED
severity: high
reproducibility: always
created_at: "2026-10-13T15:43:35+08:00"
updated_at: "2026-10-13T16:15:06+08:00"
impact:
  - app-launch
  - voice-input
  - macos-arm64
  - local-packaging
links:
  fix_workorder: T0468
  related: [BUG-056]
---

# BUG-116 — macOS 啟動即崩潰：whisper 原生模組載入失敗拖垮 main process

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🔴 high（使用者端 app 完全無法開啟） |
| 可重現 | 必現（macOS 任一 arch；根因見下） |
| **狀態** | ✅ FIXED（T0468，待 mac 實機驗收） |
| 回報者 | 外部使用者 Gary（2026-10-13 15:38 轉述，附截圖） |
| 版本 | `0.6.0-pre.2`（macOS；回報者稱「前兩天還能開」） |

## 現象

啟動即跳 Electron 原生對話框 `A JavaScript error occurred in the main process`：

```
Uncaught Exception:
Error: Failed to load native addon: Error: Cannot find module
'/Applications/BetterAgentTerminal.app/Contents/Resources/app.asar/node_modules/@kutalia/whisper-node-addon/dist/darwin-arm64/whisper.node'
Require stack:
- .../app.asar/node_modules/@kutalia/whisper-node-addon/dist/js/index.js
- .../app.asar/dist-electron/main-AaUDLbiA.js
- .../app.asar/dist-electron/main.js
at loadAddon (.../whisper-node-addon/dist/js/index.js:33:15)
at Object.<anonymous> (.../whisper-node-addon/dist/js/index.js:36:22)
```

- 預期：app 正常啟動；即使語音辨識原生模組不可用，也只停用語音功能
- 實際：whisper addon 在 main bundle 載入時即被 require（模組頂層 `loadAddon()`），失敗直接成為 main process uncaught exception → app 無法開啟

## 塔台初判（2026-10-13，輕量檢查）

- `v0.6.0-pre.1` → `v0.6.0-pre.2` 間 `package.json` 僅版號變動，`asarUnpack`（含 `node_modules/@kutalia/whisper-node-addon/**/*`）與依賴未變
- release 資產：pre.2 `-arm64.dmg` 920,380,868 B vs pre.1 919,833,267 B，無明顯缺檔跡象

根因假說（待回報者資料判別）：

| | 假說 | 判別 |
|---|---|---|
| A | 誤裝 x64 dmg（無後綴 `BetterAgentTerminal-0.6.0-pre.2.dmg`）於 Apple Silicon，且 addon 以硬體架構而非 `process.arch` 選 binary | `uname -m` + `file .../MacOS/BetterAgentTerminal` |
| B | 安裝後 bundle 被改動 / 損毀（覆蓋安裝中斷、清理工具） | `app.asar.unpacked/.../dist/` 列表 + `codesign --verify --deep --strict` |
| C | arm64 dmg 打包漏檔（`verify-native-modules.js` 只檢查 `node_modules/` 存在，不檢查各平台 `.node`） | B 排除且重裝仍重現 |

已請回報者提供：機器架構、app 執行檔架構、`app.asar.unpacked` 下 whisper `dist/` 列表、codesign 結果、`CFBundleShortVersionString` / `app.asar` mtime、`~/Library/Application Support/better-agent-terminal/Logs/` 最新 log；以及下載的 dmg 檔名、近兩天是否重裝 / 用清理工具。

## 根因（2026-10-13 16:05，回報者資料 + 上游套件確認）

回報者（Gary）資料：`uname -m` = `arm64`（Apple M2 Pro）；app 執行檔 `Mach-O 64-bit executable arm64`（確為 arm64 dmg）；`codesign --verify --deep --strict` 無輸出（通過）；`CFBundleShortVersionString` = `0.6.0-pre.2`；`app.asar` mtime `Oct 5 13:01:35 2026`（10-05 安裝後未被改動）；`~/Library/Application Support/better-agent-terminal/Logs/` 不存在。

`app.asar.unpacked/node_modules/@kutalia/whisper-node-addon/dist/` 內容：`js/`、`linux-x64/`、**`mac-arm64/`**、**`mac-x64/`**、`win32-x64/` —— **沒有 `darwin-arm64/`**。

塔台以 `npm pack @kutalia/whisper-node-addon@1.1.0`（lock 鎖定版本，2025-07-18 發佈，至今最新）確認上游套件本身即如此：

- `dist/js/index.js` 的 `PLATFORM_MAPPING = { darwin: 'darwin', win32: 'win32', linux: 'linux' }`，以 `${platform}-${arch}` 組路徑 → macOS 找 `darwin-arm64` / `darwin-x64`
- 但套件實際出貨目錄為 `mac-arm64` / `mac-x64` ⇒ **上游套件在 macOS 永遠載入失敗**（win32 / linux 命名一致不受影響）
- `loadAddon()` 在**模組頂層**執行（`const whisperAsync = loadAddon()`），只要 import 就 throw
- BAT `electron/voice-handler.ts:33` 頂層 `import { transcribe } from '@kutalia/whisper-node-addon'`，`main.ts` 頂層 import `registerVoiceHandlers` ⇒ **macOS（arm64 與 x64）啟動即崩潰**

⇒ 假說 A（裝錯 dmg）與 B（bundle 損毀）**排除**；根因為 C 的變形：**不是漏打包，而是上游套件的平台目錄命名與自身 loader 不一致**，加上 BAT 頂層 eager import 放大為整個 app 無法啟動。影響面：**所有 macOS 使用者**（自 `cb65614` 2026-04-23 改用 `@kutalia/whisper-node-addon` 起的程式碼路徑；回報者稱「前兩天還能開」與此不符，可能是 10-05 安裝時舊版 process 仍在執行、直到近日重啟才載入新版——待修復工單順帶查證，不阻塞修復）。

嚴重度維持 🔴 high（實際影響全部 mac 使用者，若確認自 pre.2 起必現則等同 critical）。

**回報者臨時解法**（不需重裝；app 目錄屬回報者自己，無需 sudo）：

```bash
cd "/Applications/BetterAgentTerminal.app/Contents/Resources/app.asar.unpacked/node_modules/@kutalia/whisper-node-addon/dist" && ln -s mac-arm64 darwin-arm64
```

## 修復方向（不論根因皆需）

1. **韌性（主修）**：whisper addon 改為延遲 / 隔離載入（try/catch 或動態 `require` 於首次使用語音時），失敗僅停用語音 + logger 記錄 + UI 提示，app 照常啟動；同步檢查其他 optional 原生模組是否有同樣頂層載入風險
2. **依根因追加**：A → 安裝說明 / dmg 命名標示 Intel vs Apple Silicon，或 addon 架構選擇修正；C → CI 加 mac 產物內 `.node` 存在性驗證

## 併入範圍：本機開發環境 whisper addon 殘缺 + 原生模組驗證過淺（2026-10-13 塔台觀察，使用者指示併入修復工單）

- 本機 Windows 開發環境 `node_modules/@kutalia/whisper-node-addon/` 只剩 `node_modules/node-addon-api/`（套件目錄 mtime 2026-10-09 18:10），**無 `package.json`、無 `dist/`**；`package-lock.json` 仍列 `^1.1.0`。成因未知（10-09 某次 install / 清理中斷？）
- `scripts/verify-native-modules.js` 檢查 `node_modules/<mod>/package.json` 存在 → 目前狀態**會被擋下**（本機打包 fail-fast 正常）；但它**不檢查當前 host 平台的 `.node` binary**（如 `dist/<platform>-<arch>/whisper.node`），「package.json 在、binary 缺」的情境（假說 C 的打包端形態）會漏網

修復工單需含：

3. **本機環境**：Worker 開工前 `npm install` 還原 whisper addon，確認 `dist/win32-x64/` 有 `.node`；記錄是否能重現 10-09 的殘缺成因（不強求）
4. **驗證加深**：`verify-native-modules.js` 對 `REQUIRED_NATIVE_MODULES` 加 host 平台原生 binary 存在性檢查（至少 whisper addon 的 `dist/<process.platform>-<process.arch>/*.node`）；CI mac job 對兩個 arch 產物檢查 `app.asar.unpacked` 內對應 `.node`（若根因為 C 則必做）

## 處置

塔台決策（2026-10-13 15:43，使用者指示）：**先開單，等 Gary 回報環境資料後再派修復工單**。

2026-10-13 16:05：Gary 回報到齊、根因確認 → 派 **T0468**（自有 loader 繞過上游 index.js + 延遲載入 fail-soft + verify-native-modules 加深）；狀態 → FIXING。本機 node_modules 還原待 T0467 / T0468 結束後由塔台執行。

## 修復（T0468，2026-10-13）

- **自有 loader** `electron/whisper-addon-loader.ts`：不 require 上游 `dist/js/index.js`，直接 require `dist/<dir>/whisper.node`；目錄規則 `win32-<arch>` / `linux-<arch>` / macOS 依序 `mac-<arch>`、`darwin-<arch>`；`app.asar` 路徑改寫為 `app.asar.unpacked`；**首次轉寫才載入**、成功或失敗皆快取；`transcribe()` 參數合併與驗證逐字複製上游 1.1.0
- **fail-soft**：`voice-handler.ts` 不再頂層 import 上游套件；載入失敗只 `logger.error` 一次，`voice:transcribe` 回 `Voice recognition module (whisper) is unavailable: …`（renderer 既有 `⚠ 辨識失敗: …` 顯示），**app 照常啟動**
- **驗證加深**：`scripts/verify-native-modules.js` 以同一規則檢查 host 平台 `whisper.node`（桌面包 host win32-x64 / linux-x64 / darwin-x64 / darwin-arm64 缺即 fail-fast；其他 host 如 linux-arm64 server-bundle runner 只 warn）
- **影響面查證**：`main.ts` 自 `882be11`（04-11）頂層 import voice-handler、voice-handler 自 `cb65614`（04-23）頂層 import 上游，lock 一直是 1.1.0 ⇒ **自 `v0.2.5-pre.1` 起所有 macOS 版本啟動必崩**（靜態推論）
- 待辦：mac 實機驗收（新版不需 symlink workaround 即可啟動 + 語音可用）；CI mac job 對兩個 arch 產物檢查 `.node`（未做）；`voice-opencc.ts` 頂層 `require('opencc-js')` 同型風險（建議另案）。詳見 T0468 回報區
