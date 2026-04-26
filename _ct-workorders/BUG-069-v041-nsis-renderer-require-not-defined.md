# BUG-069 — v0.4.1 NSIS install renderer crash：`require is not defined` in bundled renderer (index-DiPLuJp3.js:127)

## Metadata

| 欄位 | 內容 |
|------|------|
| BUG 編號 | BUG-069 |
| 標題 | v0.4.1 NSIS installer 安裝後啟動，renderer bundle 第 127:6608 拋 `Uncaught ReferenceError: require is not defined`，UI 完全無法載入 |
| 嚴重度 | 🔴 High |
| 可重現 | 100%（每次安裝啟動皆炸） |
| Workaround | 無（renderer 完全死，UI 黑畫面/白畫面） |
| 狀態 | 🐛 OPEN — 派 T0303 研究工單調查根因 + spike 修復方案 + wider audit |
| 建立時間 | 2026-04-26 20:12 (UTC+8) |
| 報告者 | 使用者 v0.4.1 production install 實測 |
| 影響範圍 | renderer bundle（vite 產出 `dist/index-*.js`），可能涉及 vite 7 build config、electron-builder 26 asar 處理、CJS-in-ESM 混用 |
| Release target | v0.4.2 patch（需快速修復，v0.4.1 已對外） |

## 現象描述

### 預期行為
NSIS installer 安裝 v0.4.1 後啟動 BAT，renderer 正常載入 React UI。

### 實際行為
- Renderer console 拋 `index-DiPLuJp3.js:127 Uncaught ReferenceError: require is not defined` (位置 127:6608)
- UI 完全無法呈現
- 後端服務全部正常起來（terminal-server PID 18840、RemoteServer port 9876、profile/window restore 都成功）
- 純 renderer-side 失敗

### 環境
- BAT version: v0.4.1（NSIS installer 安裝，路徑 `C:\Program Files\BetterAgentTerminal\BetterAgentTerminal.exe`）
- OS: Windows 11 Pro for Workstations 10.0.26200
- Process PID 25604，啟動時間 2026-04-26T12:04:14
- i18next debug message 顯示 renderer JS 有開始執行（不是完全沒載入），代表是 bundle 內部某段執行到 `require()` 才炸

### Repro
1. 解除安裝舊版 BAT（如有）
2. 跑 v0.4.1 NSIS installer 完整安裝
3. 啟動 BAT → 100% 觸發

### 高嫌疑名單（root cause 候選，研究工單需調查）
1. **Vite 7 升級**（PLAN-003 Group B / T0163，vite 5.4.21 → 7.3.2，2026-04-18 落地）
   - vite 7 對 commonjs 處理或 externalize 預設行為可能變更
   - 某個依賴在 v7 下被當 ESM 處理但實際是 CJS
2. **electron-builder 26 升級**（PLAN-005 / EXP-BUILDER26-001，24.13.3 → 26.8.1，2026-04-18 落地）
   - asar 打包行為變更
   - asarUnpack 模式下某個 CJS 被當 ESM 載入
3. **某個 dep 升級** — 自 v0.4.0 → v0.4.1 之間的 npm dep bump（research 需 git log 確認）
4. **Vite plugin 組合變動** — `vite-plugin-electron` / `vite-plugin-electron-renderer` 對 renderer CJS 處理
5. **Renderer code 中遺留的 `require()` 呼叫** — TypeScript source 直接寫 `require(...)` 而非 import，dev 下 vite 可能 transform，prod build 下沒處理乾淨

### 已知非原因
- 後端服務全綠（不是 main process 問題）
- dom-ready / did-finish-load 都觸發（HTML 載入正常，是 JS 執行階段炸）

## 關聯

- 派發研究工單：T0303（research，spike 2-3 方案 + wider Vite7/builder26 audit）
- 相關 PLAN：PLAN-003（vite 7 升級）、PLAN-005（electron-builder 26 升級）
- 相關 commits：v0.4.1 release tag

## VERIFY 標準（待 T0303 修復後）

1. v0.4.2 NSIS installer 完整安裝
2. 啟動後 renderer console 無 `require is not defined`
3. UI 正常載入
4. terminal / agent / voice 三大功能 smoke 測過
