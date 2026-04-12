# 🐛 BUG-005：whisper native addon `require` 回傳 undefined（packaged build）

## 元資料

| 欄位 | 內容 |
|------|------|
| **報修編號** | BUG-005 |
| **狀態** | ✅ FIXED |
| **嚴重度** | 🔴 High |
| **報修時間** | 2026-04-11 13:49 (UTC+8) |
| **報修人** | 使用者（T0017-β 收尾後測試 packaged build 發現） |
| **影響範圍** | packaged build（.dmg/.exe）的所有使用者，dev 模式不受影響 |
| **重現率** | 100%（packaged build） |

---

## 現象描述

- **預期行為**：packaged Electron build 中 whisper native addon 正常載入
- **實際行為**：`require('whisper-node-addon')` 在 packaged build 中回傳 `undefined`，語音辨識功能完全失效

## 根因分析

1. **Vite external 未設定**：whisper-node-addon 是 native addon，Vite 打包時應設為 external，但未設定，導致 bundle 出錯
2. **asar 包含 .node 二進位**：Electron builder 預設將所有檔案打包進 asar，但 native `.node` 二進位不能在 asar 中執行，必須 unpack

**修復**（T0018）：
1. 在 Vite config 設定 `external: ['whisper-node-addon']`
2. 在 electron-builder 設定 `asarUnpack: ['**/*.node']`

## 修復記錄

- **修復工單**：T0018（Vite external + asar unpack）
- **runtime 驗收**：✅ 通過

## 時間線

| 時間 | 狀態 | 備註 |
|------|------|------|
| 2026-04-11 13:49 | 📋 REPORTED | BUG-004 修復後測試 packaged build 發現 |
| 2026-04-11 13:xx | 🔧 FIXING | T0018 派發 |
| 2026-04-11 14:xx | ✅ FIXED | runtime 驗收通過 |
