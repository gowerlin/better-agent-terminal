---
schema_version: 1
schema_kind: bug
id: BUG-125
title: "claude:scan-skills：`.claude/commands/*.md` 以檔案第一行當 description，帶 YAML frontmatter 的 command 顯示成 \"---\""
status: FIXED
severity: low
reproducibility: always
created_at: "2026-10-14T04:03:26+0800"
updated_at: "2026-10-14T04:08:17+0800"
fixed_at: "2026-10-14T04:08:17+0800"
impact:
  - claude-panel
  - skills-list
links:
  discovered_in: "T0514 U4 觀察（pre.6 自動化驗收）"
  fix_workorder: T0518
  related: [T0514]
---

# BUG-125 — commands 描述未解析 frontmatter

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟢 low（清單描述錯誤；功能正常） |
| 可重現 | 必現（任一帶 frontmatter 的 `.claude/commands/*.md`） |
| **狀態** | ✅ FIXED（T0518，2026-10-14T04:08:17+0800） |
| 回報者 | T0514 Worker（塔台開單、程式碼確認） |

## 現象

- `electron/handlers/claude.ts` 約 :297 commands 分支：`firstLine = content.split('\n').find(l => l.trim())` → `description = firstLine.replace(/^#\s*/, '')`；檔案以 `---` 開頭時 description = `"---"`
- 同檔 skills 分支（約 :328-347）已解析 frontmatter `description:`

## 預期

- commands 與 skills 一致：有 frontmatter `description` 用它；無 frontmatter 才退回第一個非空行（去 `#`）

## 根因與修正

- **根因**：commands 分支只取檔案第一個非空行當 description，沒有像 skills 分支那樣先讀 YAML frontmatter，所以以 `---` 開頭的 command 描述變成 `"---"`。
- **修正（T0518）**：`electron/handlers/claude.ts` 新增兩個匯出函式：
  - `frontmatterDescription(lines)`：從開頭的 frontmatter 取 `description:`（去掉一組雙引號），skills 與 star commands 分支原本重複的解析迴圈改呼叫它，邏輯逐行相同。
  - `parseCommandDescription(content)`：commands 用。先取 frontmatter `description`；沒有 description 時取 frontmatter 結束後第一個非空行；沒有 frontmatter 時取檔案第一個非空行；都去掉開頭的 `#`。frontmatter 沒有結束行時回 `''`。
- **驗證**：`electron/__tests__/claude-scan-skills-description.test.ts`（有 / 無 frontmatter、frontmatter 無 description、雙引號、CRLF、未結束的 frontmatter；skills 與 star commands 的結果維持修正前的值）。
