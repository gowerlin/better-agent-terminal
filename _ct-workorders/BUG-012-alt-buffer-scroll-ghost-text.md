# 🐛 BUG-012：Alt buffer 捲動殘影（ghost text）

## 元資料

| 欄位 | 內容 |
|------|------|
| **報修編號** | BUG-012 |
| **狀態** | 🔧 FIXING (T0084) |
| **嚴重度** | 🟡 Medium |
| **報修時間** | 2026-04-11 (UTC+8) |
| **報修人** | 使用者 |
| **影響範圍** | 使用 alt buffer（vim、less 等）並捲動後離開的使用者 |
| **上游 Issue** | anthropics/claude-code#46898 |

---

## 現象描述

- **預期行為**：離開 alt buffer（vim、less 等）後，終端恢復正常顯示
- **實際行為**：離開後仍有 ghost text（殘影）顯示在終端中，影響閱讀

## 根因分析（最終確認，EXP-BUG012-001）

> **2026-04-13 更新**：EXP-BUG012-001 實驗（5 輪排除法）確認真正根因。

**根因（修正）**：BAT 的 `convertEol: true` 設定。
- pty 環境已處理 EOL 轉換，xterm.js 重複轉換干擾 alt buffer 渲染 → 殘影
- VS Code terminal 不設此選項，因此不出現

**非根因（已排除）**：
- scrollOnOutput（可移除以對齊 VS Code，但非殘影根因）
- xterm.js 版本（v5/v6 皆受影響）
- Claude Code CLI 上游 TUI buffer 行為（原先假設，已推翻）

**修復**：移除 `convertEol: true` + 移除 `scrollOnOutput: true`（共 2 行）

**結案路徑**：T0084（cherry-pick 到主線）→ 🧪 VERIFY → 🚫 CLOSED
**上游 issue #46898**：BAT 端自行修復，與上游無關，可留言關閉

這是 **上游 TUI 層問題**（Claude Code CLI 的 Ink TUI），不是 terminal emulator（xterm.js）的問題：
- TUI 在切換回 normal buffer 時，沒有清除 alt buffer 中殘留的行
- 這在所有 terminal emulator 下都會發生，不是 BAT 特有

**工作區（Workaround）**：Redraw 按鈕（T0036/T0040）可手動清除殘影。

## 調查工單

- T0035：初次修復嘗試（禁用 viewport scroll）— 驗收否決，殘影未改善
- T0041：深度調查，確認上游根因，提交 upstream issue

## 相關連結

- **upstream issue**：https://github.com/anthropics/claude-code/issues/46898
- **修復工單**：T0084（cherry-pick convertEol fix 到主線）

## 時間線

| 時間 | 狀態 | 備註 |
|------|------|------|
| 2026-04-11 | 📋 REPORTED | 發現 alt buffer 殘影 |
| 2026-04-12 | 🔍 INVESTIGATING | T0041 深度調查 |
| 2026-04-12 | 📋 上游追蹤 | anthropics/claude-code#46898 已提交，等 upstream 修復 |

## 塔台處理區

- [x] 已確認症狀
- [x] 根因分析完成（BAT 端 convertEol: true，非上游問題）
- [x] EXP-BUG012-001 實驗驗證根因
- [x] upstream issue 已提交（#46898，將留言說明 BAT 端已修復）
- [ ] T0084 cherry-pick 到主線
- [ ] 主線 runtime 驗收 → CLOSED
- **備註**：Redraw 按鈕作為 workaround，使用者可手動清除
