---
schema_version: 1
schema_kind: bug
id: BUG-125
title: "claude:scan-skills：`.claude/commands/*.md` 以檔案第一行當 description，帶 YAML frontmatter 的 command 顯示成 \"---\""
status: FIXING
severity: low
reproducibility: always
created_at: "2026-10-14T04:03:26+0800"
updated_at: "2026-10-14T04:03:26+0800"
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
| **狀態** | 🔧 FIXING（T0518） |
| 回報者 | T0514 Worker（塔台開單、程式碼確認） |

## 現象

- `electron/handlers/claude.ts` 約 :297 commands 分支：`firstLine = content.split('\n').find(l => l.trim())` → `description = firstLine.replace(/^#\s*/, '')`；檔案以 `---` 開頭時 description = `"---"`
- 同檔 skills 分支（約 :328-347）已解析 frontmatter `description:`

## 預期

- commands 與 skills 一致：有 frontmatter `description` 用它；無 frontmatter 才退回第一個非空行（去 `#`）
