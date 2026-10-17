---
schema_version: 1
schema_kind: bug
id: BUG-122
title: "配置（Profile）對話框：remote 卡片展開後「遠端 AI 工具」面板只佔右半，左半一整欄空白；對話框太窄"
status: CLOSED
severity: low
reproducibility: always
created_at: "2026-10-14T02:41:26+0800"
updated_at: "2026-10-14T03:31:50+0800"
fixed_at: "2026-10-14T02:50:44+0800"
closed_at: "2026-10-14T03:31:50+0800"
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
| **狀態** | 🚫 CLOSED（使用者 pre.6 實機確認，2026-10-14T03:31:50+0800；修復 T0512） |
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

## 根因與修正（T0512）

- **根因**：T0288 的 `ProfileCard` 用了 `profile-card*` class 卻從未定義 CSS；卡片根元素同時帶 `.profile-item`（`display: flex` row + `align-items: center`），header 與展開 body 因此左右並排，header 被垂直置中到可視範圍外 → 左欄看起來空白。對話框實際寬度為 `.settings-panel` 的 450px。
- **修正**：`.profile-card` 改 column（body 橫跨全寬）、header 成一列並補 toggle / badge / meta / 狀態點樣式；對話框 `min(1040px, 90vw)`；profile host 的遠端 AI 工具改卡片 grid（wizard 不變）；details 補 label / value 樣式。
- **驗證**：見 T0512 回報區（e2e 前後量測與截圖，wizard 完成頁前後截圖 sha256 相同）。

## 結案

- 2026-10-14T03:31:50+0800 使用者 pre.6 實機確認（截圖：對話框加寬、遠端 AI 工具卡片 grid、無左側空白欄）→ CLOSED
