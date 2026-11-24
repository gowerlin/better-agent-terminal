---
schema_version: 1
schema_kind: bug
id: BUG-217
title: "指揮塔總覽：`_tower-state.md` frontmatter YAML 解析失敗時每次重載都記一次，且附多行原文摘錄（把該工作區塔台狀態內容寫進 debug log）"
status: OPEN
severity: low
reproducibility: "observed（`v0.8.0-pre.1` 實機 2026-11-24 16:11–20:25 (UTC+8) 347 次，合計 2,776 行 / 222 KB）"
created_at: "2026-11-25T00:38:23+08:00"
updated_at: "2026-11-25T00:38:23+08:00"
impact:
  - control-tower-panel
  - logging
  - privacy
links:
  discovered_in: "T0892 調查結論 §1、建議方向 B"
  related: [T0892, T0701, D317]
---
# BUG-217 — 指揮塔總覽的 YAML 錯誤日誌重複且含原文

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟢 low（只是日誌；但會把其他工作區的塔台狀態內容寫進 debug log） |
| 可重現 | 觀察到（T0892）；frontmatter 雙引號字串含未跳脫的反斜線（Windows 路徑）即可觸發 |
| **狀態** | 📂 OPEN |
| 回報者 | 塔台（T0892 日誌檢查） |
| 影響版本 | 既有程式（T0701 起，`ControlTowerPanel.tsx` 約 506 行），不是 `v0.8.x` 回歸 |

## 現象（預期 vs 實際）

- **預期**：frontmatter 解析失敗時記一行原因（錯誤類別＋行列），同一檔同一錯誤在內容改變前只記一次；總覽照 T0701 顯示無法讀取摘要。
- **實際**：每次 `fs.watch` → `reloadAll` 都記 `[RENDERER] [ct-overview] _tower-state.md summary ignored: YAML parse error: unknown escape sequence`，而且 js-yaml 的錯誤訊息自帶約 8 行原文摘錄（含該工作區塔台狀態內容）。4 小時 347 次、222 KB（佔該檔 7.5%）。

## 證據

- `debug-20261124-101607.log` 08:11Z → 12:25Z（T0892 回報區表格第 1 列）；觸發的是另一個工作區（工作區A）的 `_tower-state.md`，12:25Z 後不再出現（推測該檔已修正）。

## 修法方向（T0892 建議，未定案）

- 只記錯誤第一行（`reason` 與行列），不記 js-yaml 的原文摘錄。
- 同一檔同一錯誤只記一次，直到檔案內容改變。
- 🔴 總覽維持唯讀、不改契約 v1（CLAUDE.md「指揮塔總覽」節）。
- 另一面：寫出這種 frontmatter 的是 CT 塔台（Windows 路徑放在雙引號字串）。是否另行告知 CT，由使用者決定。
