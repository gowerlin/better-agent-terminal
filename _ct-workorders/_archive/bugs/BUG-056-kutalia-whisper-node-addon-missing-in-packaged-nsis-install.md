# BUG-056 — NSIS 打包版啟動即崩潰：`Cannot find module '@kutalia/whisper-node-addon'`

## 元資料

- **編號**：BUG-056
- **類型**：bug
- **狀態**：🚫 CLOSED（2026-04-23 04:34 — T0242 Path A + Path B 雙驗收全綠，使用者 runtime 確認「安裝成功, 正確執行」+ Vulkan loader ✅ 偵測到截圖證據；commit `e46932e`，零 source diff）
- **嚴重度**：🔴 High（打包版完全無法啟動，阻塞 release）
- **建立時間**：2026-04-23 03:08 (UTC+8)
- **回報者**：使用者（runtime 截圖證據）
- **可重現**：100%
- **可 workaround**：無（啟動即崩潰，連主視窗都開不了）
- **回歸性質**：🔙 **Regression**，由 commit `cb65614` `feat(voice): GPU acceleration via Vulkan (EXP-GPUWHIS-001 Phase 1)` 引入
- **關聯單據**：
  - `cb65614`（main，squash merge 自 `exp/gpu-vulkan-poc`）
  - EXP-GPUWHIS-001（📊 CONCLUDED，Phase 1）
  - T0238 T-B（electron-builder packaging，當時驗收 4/4 全綠 — 可能驗收情境有缺口）
  - T0239 T-C（runtime GPU detection，使用動態 import `@kutalia/whisper-node-addon`）
  - T0240 T-D（squash merge，ship PoC 到 main）
  - PLAN-004 Phase 1（語音 GPU 加速）
- **環境**：
  - 平台：Windows 11 Pro for Workstations（10.0.26200）
  - 安裝路徑：`C:\Program Files\BetterAgentTerminal\`
  - 觸發方式：NSIS installer 安裝後啟動 `.exe`
- **首發版本**：未知（session 21 後首次 NSIS 打包驗收）

---

## 現象描述

### 預期行為
BAT 打包版正常啟動，顯示主視窗。

### 實際行為
啟動瞬間跳出 Electron 錯誤對話框：

```
A JavaScript error occurred in the main process

Uncaught Exception:
Error: Cannot find module '@kutalia/whisper-node-addon'
Require stack:
- C:\Program Files\BetterAgentTerminal\resources\app.asar\dist-electron\main.js

    at Module._resolveFilename (node:internal/modules/cjs/loader:1463:15)
    at s._resolveFilename (node:electron/js2c/browser_init:2:140120)
    at defaultResolveImpl (node:internal/modules/cjs/loader:1073:19)
    at resolveForCJSWithHooks (node:internal/modules/cjs/loader:1078:22)
    at Module._load (node:internal/modules/cjs/loader:1249:25)
    at c._load (node:electron/js2c/node_init:2:18060)
    at wrapModuleLoad (node:internal/modules/cjs/loader:262:19)
    at Module.require (node:internal/modules/cjs/loader:1563:12)
    at require (node:internal/modules/helpers:152:16)
    at Object.<anonymous> (C:\Program Files\BetterAgentTerminal\resources\app.asar\dist-electron\main.js:1:810)
```

使用者按確定後程式結束，**無法使用任何功能**。

---

## 初步靜態分析（塔台不讀 code，僅根據截圖歸納）

### 關鍵線索
1. Require 失敗發生在 **main process 入口 `dist-electron/main.js:1:810`**（極早期，還沒進到 ready event）
2. Require path 是 **`app.asar` 內**，但 `@kutalia/whisper-node-addon` 是 **native module**，按 electron-builder 慣例應該透過 `asarUnpack` 解到 `app.asar.unpacked/node_modules/@kutalia/`
3. 錯誤訊息未顯示 unpacked 路徑 → 可能根本沒被 unpack，或整個 package 沒被打包

### 塔台假設清單（待 Worker 驗證，**不是結論**）

| # | 假設 | 佐證 |
|---|------|------|
| H1 | `electron-builder` 的 `asarUnpack` pattern 沒涵蓋 `@kutalia/*` | T0238 當時驗收用 `ELECTRON_RUN_AS_NODE=1 probe.js`，可能只測了 Vulkan loader 而沒測 main process 的 `require('@kutalia/whisper-node-addon')` |
| H2 | `@kutalia/whisper-node-addon` 誤分類為 `devDependencies` | electron-builder 預設只打包 `dependencies`；若 session 21 安裝時用了 `--save-dev` 就會中 |
| H3 | `package.json` 的 `files` 或 `extraResources` 排除了 `node_modules/@kutalia/` | 較罕見，但可能在 T0238 調整時無意中加了 glob 排除 |
| H4 | asar 有打包但 `resolveFilename` 被 main.js 的 bundler/minifier 改寫，resolve path 錯亂 | vite bundle `main.js` 到 `dist-electron/` 時若把 require path 改成 relative，可能解錯 |
| H5 | 打包流程跳過了 `postinstall`，`@kutalia` 的 native binary 未下載 | 有 prebuilt binary 的 native module 常見 |

### T0238 驗收盲點（假設）
T0238 當時報「NSIS 291 MB + asarUnpack + `ELECTRON_RUN_AS_NODE=1 probe.js` 驗證 packaged Vulkan runtime」→ **驗收了 Vulkan binary 可以被 load，但沒驗收 main process 的 `require('@kutalia/whisper-node-addon')` resolve**。兩者是不同 resolution path。

---

## 影響範圍

- **所有使用 NSIS installer 安裝的 Windows 使用者**：啟動即死，100% 阻塞
- **release pipeline 阻塞**：T0241 版號 bump + Homebrew tap pending 全部卡住
- **macOS / Linux 是否同病**：未知（使用者只跑了 Windows，但 T-B 驗收範圍僅 Windows NSIS）

---

## 建議處理

派發 **T0241 研究工單**（取代原本版號 bump 用的 T0241 編號）先定位根因，禁止盲修。研究完成後再決定：
- 若根因為 `asarUnpack` 配置缺口 → 補 config + 重新打包驗收
- 若根因為 dependency 分類 → 調整 `package.json` + 重新打包驗收
- 若根因為其他 → 依研究結論派修復工單

驗收要求採 **Q3.C**：`dir/` 模式快速迭代 **+** NSIS installer 完整重裝路徑 **雙路徑都要綠**。

---

## 歷程

- **2026-04-23 03:05**：使用者截圖回報打包版啟動即崩潰
- **2026-04-23 03:08**：BUG-056 OPEN，D078 記錄處理策略
- **2026-04-23 03:17-03:30**：T0241 研究 13 min DONE，結論 H6 反轉塔台假設（root cause = squash merge 未跑 `npm install`）
- **2026-04-23 03:35**：D079 拆單 T0242（fix）+ T0243（prevention）
- **2026-04-23 03:55-04:34**：T0242 39 min ✅ FIXED，commit `e46932e`，零 source diff，雙 path 驗收全綠
- **2026-04-23 04:34**：BUG-056 🚫 CLOSED（D080）— 使用者 runtime 驗收通過 + Vulkan loader 證據截圖
- **Post-close**：T0243（預防對策）排隊待派，確保類型重演防護（build fail-fast + CI `npm ci`）

---

## 回報區（Worker / 塔台補充）

（暫無）
