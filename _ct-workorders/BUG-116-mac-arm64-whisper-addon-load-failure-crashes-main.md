---
schema_version: 1
schema_kind: bug
id: BUG-116
title: "macOS（0.6.0-pre.2）啟動即崩潰：main process 載入 @kutalia/whisper-node-addon 找不到 darwin-arm64/whisper.node → Uncaught Exception，整個 app 無法開啟"
status: OPEN
severity: high
reproducibility: unknown
created_at: "2026-10-13T15:43:35+08:00"
updated_at: "2026-10-13T15:43:35+08:00"
impact:
  - app-launch
  - voice-input
  - macos-arm64
links:
  fix_workorder: null
  related: [BUG-056]
---

# BUG-116 — macOS 啟動即崩潰：whisper 原生模組載入失敗拖垮 main process

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🔴 high（使用者端 app 完全無法開啟） |
| 可重現 | 未知（目前單一回報；等回報者環境資料） |
| **狀態** | 📂 OPEN |
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

## 修復方向（不論根因皆需）

1. **韌性（主修）**：whisper addon 改為延遲 / 隔離載入（try/catch 或動態 `require` 於首次使用語音時），失敗僅停用語音 + logger 記錄 + UI 提示，app 照常啟動；同步檢查其他 optional 原生模組是否有同樣頂層載入風險
2. **依根因追加**：A → 安裝說明 / dmg 命名標示 Intel vs Apple Silicon，或 addon 架構選擇修正；C → CI 加 mac 產物內 `.node` 存在性驗證

## 處置

塔台決策（2026-10-13 15:43，使用者指示）：**先開單，等 Gary 回報環境資料後再派修復工單**。
