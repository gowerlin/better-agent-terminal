---
schema_version: 1
schema_kind: bug
id: BUG-183
title: "關掉（最小化到匣）的遠端 profile 視窗，在「配置」按「開啟」叫不回來，只跳「此配置已在另一個視窗中開啟」"
status: OPEN
severity: medium
reproducibility: unknown
created_at: "2026-11-01T22:04:49+0800"
updated_at: "2026-11-01T22:04:49+0800"
impact:
  - profile-window
  - system-tray
links:
  discovered_in: "BUG-182 實機驗收（2026-11-01，第一百零四 session，使用者回報附截圖）"
  related: [BUG-182, BUG-184]
---

# BUG-183 — 隱藏的 profile 視窗按「開啟」不顯示

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟡 medium（遠端視窗關掉後，從「配置」叫不回來，只能經系統匣「Show」） |
| 可重現 | 未確認（使用者遇到一次） |
| **狀態** | 📂 OPEN |
| 回報者 | 使用者（BUG-182 實機驗收時，`v0.7.3-pre.1` 安裝版，Windows） |

## 現象

- 操作：關掉 WSL 遠端 profile 視窗（`WSL Ubuntu-24.04`），再到「配置」對該 profile 按「開啟」（↗）。
- 預期：直接顯示並啟用（focus）原本的視窗，不跳提示。
- 實際：跳出 app 通知「此配置已在另一個視窗中開啟。」，視窗**沒有出現**；只能從系統匣圖示 → 該視窗 → 「Show」打開。

## 塔台初步定位（唯讀，未驗證）

- 「開啟」走 `openProfileWindows`（`electron/main.ts` 約 3624 行）：找到同 profile 仍存活（未 destroyed）的視窗時只做 `restore()`（僅在最小化時）與 `focus()`，**沒有 `show()`**，並回 `{ alreadyOpen: true }`；`src/App.tsx` 約 1026 行收到 `alreadyOpen` 就顯示 `profiles.alreadyOpen` 通知。
- 關窗 handler（`electron/main.ts` 約 1292 行起）在 `minimizeToTray` 開啟時對 profile 的最後一個視窗（或多視窗時選「Minimize to tray」）做 `win.hide()`，視窗仍在 `windowMap`。推論：隱藏的視窗被當成「已開啟」，`focus()` 不會讓它重新顯示。使用者的 `minimizeToTray` 設定值未查。
- 修正方向（待修正單評估）：已存活但隱藏的視窗要 `show()` + `focus()`；成功叫回時是否還要顯示通知由修正單提案（使用者期望：直接啟用原視窗、不跳提示）。

## 待查

- 本機 profile（Default）視窗是否同樣受影響。
- `minimizeToTray` 關閉時是否有其他路徑讓視窗留在 `windowMap` 而不可見。
