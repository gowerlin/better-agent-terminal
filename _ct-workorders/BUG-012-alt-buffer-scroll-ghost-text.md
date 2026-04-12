# 🐛 BUG-012：Alt buffer 捲動殘影（ghost text）

## 元資料

| 欄位 | 內容 |
|------|------|
| **報修編號** | BUG-012 |
| **狀態** | 🔍 INVESTIGATING（上游追蹤中） |
| **嚴重度** | 🟡 Medium |
| **報修時間** | 2026-04-11 (UTC+8) |
| **報修人** | 使用者 |
| **影響範圍** | 使用 alt buffer（vim、less 等）並捲動後離開的使用者 |
| **上游 Issue** | anthropics/claude-code#46898 |

---

## 現象描述

- **預期行為**：離開 alt buffer（vim、less 等）後，終端恢復正常顯示
- **實際行為**：離開後仍有 ghost text（殘影）顯示在終端中，影響閱讀

## 根因分析（已調查，D020）

**根因**：ghost 文字在 **xterm.js buffer** 中，TUI 用 cursor positioning 跳過行首未清除。

這是 **上游 TUI 層問題**（Claude Code CLI 的 Ink TUI），不是 terminal emulator（xterm.js）的問題：
- TUI 在切換回 normal buffer 時，沒有清除 alt buffer 中殘留的行
- 這在所有 terminal emulator 下都會發生，不是 BAT 特有

**工作區（Workaround）**：Redraw 按鈕（T0036/T0040）可手動清除殘影。

## 調查工單

- T0035：初次修復嘗試（禁用 viewport scroll）— 驗收否決，殘影未改善
- T0041：深度調查，確認上游根因，提交 upstream issue

## 相關連結

- **upstream issue**：https://github.com/anthropics/claude-code/issues/46898
- **修復工單**：無（上游問題，等 upstream 修復）

## 時間線

| 時間 | 狀態 | 備註 |
|------|------|------|
| 2026-04-11 | 📋 REPORTED | 發現 alt buffer 殘影 |
| 2026-04-12 | 🔍 INVESTIGATING | T0041 深度調查 |
| 2026-04-12 | 📋 上游追蹤 | anthropics/claude-code#46898 已提交，等 upstream 修復 |

## 塔台處理區

- [x] 已確認症狀
- [x] 根因分析完成（上游 TUI 問題）
- [x] upstream issue 已提交（#46898）
- [ ] 等待 upstream 修復
- **備註**：Redraw 按鈕作為 workaround，使用者可手動清除
