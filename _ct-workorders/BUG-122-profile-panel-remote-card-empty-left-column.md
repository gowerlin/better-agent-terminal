---
schema_version: 1
schema_kind: bug
id: BUG-122
title: "配置（Profile）對話框：remote 卡片展開後「遠端 AI 工具」面板只佔右半，左半一整欄空白；對話框太窄"
status: FIXING
severity: low
reproducibility: always
created_at: "2026-10-14T02:41:26+0800"
updated_at: "2026-10-14T02:41:26+0800"
impact:
  - ui-layout
  - profiles
links:
  discovered_in: "使用者回報（pre.5 實機，2026-10-14）"
  fix_workorder: T0512
  related: [T0413]
---

# BUG-122 — Profile 對話框 remote 卡片左欄空白

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟢 low（版面浪費，可用性差；功能正常） |
| 可重現 | 必現（使用者 pre.5，WSL remote profile 展開） |
| **狀態** | 🔧 FIXING（T0512） |
| 回報者 | 使用者 |

## 現象

- 截圖：`D:\Downloads\2026-10-14_023824.jpg`（使用者以紅色虛線框出左側空白欄與右側面板）
- 「配置」對話框 →「遠端」區段 → remote 卡片展開後，`RemoteToolsEntry`（「遠端 AI 工具」：ubuntu 24.04 · x86_64 / WSL、Claude Code、Git、建議…）只排在右側約一半寬度，左側一整欄空白無內容
- 對話框整體偏窄，面板內容（路徑、版本、按鈕）擠在一起

## 預期

- 展開內容善用卡片 / 對話框寬度（使用者提議：善用空間，或對話框寬度 ×2）

## 線索（塔台初步定位，未分析）

- `src/components/ProfilePanel.tsx:602-609` `expandedExtras`（T0413，PLAN-037 F）掛 `RemoteToolsEntry`
- 卡片元件 `src/components/profiles/ProfileCard.tsx`
