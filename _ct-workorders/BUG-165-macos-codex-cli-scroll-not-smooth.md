---
schema_version: 1
schema_kind: bug
id: BUG-165
title: "macOS：Codex CLI 分頁內捲動可用但不夠順"
status: OPEN
severity: low
reproducibility: unknown
created_at: "2026-10-19T15:42:53+0800"
updated_at: "2026-10-19T15:42:53+0800"
impact:
  - terminal-rendering
  - codex
  - macos
links:
  discovered_in: "Gary 回報（2026-10-19 15:40，v0.7.1-pre.3）"
  related: [BUG-136, BUG-164, T0667, T0669, T0670]
---

# BUG-165 — macOS：Codex CLI 分頁內捲動不夠順

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟢 low（捲動可用；體驗改善） |
| 可重現 | 未確認 |
| **狀態** | 📂 OPEN（T0670 研究中） |
| 回報者 | Gary（使用者轉達） |

## 現象

- 15:40 Gary：「終端機畫面可以滾，可以的話看能不能再絲滑一點」；15:41「但至少打字卡頓的問題解決了」（BUG-136 已 CLOSED）。
- 使用者補充：指的是**在 Codex CLI 內**捲動。
- 預期：與一般終端（Terminal.app / iTerm2）中的 Codex 一樣順。實際：不夠順（程度未量化）。

## 已知背景

- 版本 `v0.7.1-pre.3`：macOS 預設 `--disable-skia-graphite`（T0669 / BUG-164），縮圖預覽上限（T0667 / BUG-136）。
- Gary 的 Codex 分頁使用 alt screen（BUG-136 T0666 日誌：`buffer changed: alt`）。

## 待確認（給 Gary）

1. 用觸控板還是滑鼠滾輪？
2. 同一個 Codex 版本在 Terminal.app / iTerm2 裡捲動是否一樣不順？（區分 BAT 端與 codex 端）
3. 只在對話很長的分頁不順，還是新開的分頁也一樣？
