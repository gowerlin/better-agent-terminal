# 🐛 BUG-004：AudioContext 崩潰（語音錄音啟動時整個 BAT 閃退）

## 元資料

| 欄位 | 內容 |
|------|------|
| **報修編號** | BUG-004 |
| **狀態** | ✅ FIXED |
| **嚴重度** | 🔴 High |
| **報修時間** | 2026-04-11 10:15 (UTC+8) |
| **報修人** | 使用者 |
| **影響範圍** | 所有語音錄音使用者 |
| **重現率** | 100%（PromptBox 麥克風按鈕按下即崩潰） |

---

## 現象描述

- **預期行為**：按下麥克風按鈕開始錄音
- **實際行為**：按下後主視窗全黑 → 整個 BAT 閃退（main process 崩潰，DevTools 斷線）
- **附帶觀察**：debug.log 最後一筆為 `[startup] system tray created`，麥克風按下後所有事件空白

## 根因分析

AudioContext 在 Electron renderer process 中建立，但在特定狀況下（可能是 process 環境或初始化時機）導致 main process 崩潰。

**治本修復**：改用 AudioWorklet 架構取代原本的 AudioContext 方案（T0017-β）。AudioWorklet 更穩定，符合 Electron + Web Audio API 最佳實踐。

## 修復記錄

- **修復工單**：T0017-β（AudioWorklet 遷移）
- **runtime 驗收**：✅ 通過

## 時間線

| 時間 | 狀態 | 備註 |
|------|------|------|
| 2026-04-11 10:15 | 📋 REPORTED | Phase 1 收尾驗收中發現，100% 重現 |
| 2026-04-11 11:15 | 🔍 INVESTIGATING | T0017-α（治標）失敗 |
| 2026-04-11 xx:xx | 🔧 FIXING | T0017-β AudioWorklet 治本 |
| 2026-04-11 13:xx | ✅ FIXED | AudioWorklet runtime 驗收通過 |
