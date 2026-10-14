---
schema_version: 1
schema_kind: bug
id: BUG-133
title: "detached 視窗內「開啟設定」沒有反應：onOpenSettings 只 setShowSettings(true)，但 detached 分支沒有渲染 SettingsPanel"
status: FIXED
severity: low
reproducibility: always
created_at: "2026-10-14T18:09:18+0800"
updated_at: "2026-10-14T18:16:36+0800"
fixed_at: "2026-10-14T18:16:36+0800"
impact:
  - detached-window
  - settings
links:
  discovered_in: "T0529 回報區「偏差 / 備註」第 4 點"
  fix_workorder: T0530
  related: [T0529, PLAN-040]
---

# BUG-133 — detached 視窗「開啟設定」無反應

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟢 low（detached 視窗內無法開 Settings，需回主視窗） |
| 可重現 | 必現（程式碼證據，T0529） |
| **狀態** | ✅ FIXED（T0530，待驗收） |
| 回報者 | T0529 Worker |

## 現象

detached 視窗 GitHub 面板（及其他傳入 `onOpenSettings` 的元件）的「開啟設定」只呼叫 `setShowSettings(true)`（`src/App.tsx` 多處），但 detached 分支沒有渲染 `SettingsPanel`，按了沒有任何反應。

## 預期

在 detached 視窗按「開啟設定」能開出 Settings，或至少有明確回饋（例如把焦點切回主視窗並開啟 Settings）。修正方式由 T0530 決定。

## 修復（T0530）

採方案 B：detached 視窗的「開啟設定」改呼叫 `workspace.openSettingsInParent()`（`workspace:open-settings-in-parent`），main 把父主視窗（父視窗已關則取同 profile 最近活動的主視窗）還原 / 顯示 / focus，並送 `app:open-settings` 讓它開 `SettingsPanel`。detached 視窗不渲染 `SettingsPanel`，全域設定不多出一個寫入者。找不到主視窗時 detached 視窗顯示三語提示（`app.openSettingsNoMainWindow`）。詳見 T0530 回報區。
