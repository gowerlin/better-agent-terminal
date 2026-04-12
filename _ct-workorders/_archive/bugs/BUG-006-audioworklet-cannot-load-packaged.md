# 🐛 BUG-006：AudioWorklet 在 packaged Electron build 無法載入

## 元資料

| 欄位 | 內容 |
|------|------|
| **報修編號** | BUG-006 |
| **狀態** | ✅ FIXED |
| **嚴重度** | 🔴 High |
| **報修時間** | 2026-04-11 15:15 (UTC+8) |
| **報修人** | 使用者 |
| **影響範圍** | packaged build 所有使用者，AudioWorklet 語音錄音完全失效 |
| **重現率** | 100%（packaged build） |

---

## 現象描述

- **預期行為**：packaged build 中語音錄音（AudioWorklet）正常運作
- **實際行為**：AudioWorklet processor 在 packaged build 中無法載入（路徑解析錯誤）

## 根因分析

AudioWorklet 的 processor 腳本在 dev 模式透過 Vite dev server 提供，但 packaged build 中需要作為靜態資源存在。原本的實作在 packaged build 時找不到 processor 腳本。

**修復**（T0020）：改為使用 static worklet asset，確保 packaged build 正確打包並引用 AudioWorklet processor。

## 修復記錄

- **修復工單**：T0020（改 static worklet asset）
- **runtime 驗收**：✅ 通過

## 時間線

| 時間 | 狀態 | 備註 |
|------|------|------|
| 2026-04-11 15:15 | 📋 REPORTED | BUG-005 修復後繼續測試 packaged build 發現 |
| 2026-04-11 15:xx | 🔧 FIXING | T0020 派發 |
| 2026-04-11 15:47 | ✅ FIXED | runtime 驗收通過 |
