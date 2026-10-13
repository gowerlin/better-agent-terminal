---
schema_version: 1
schema_kind: bug
id: BUG-126
title: "claude:scan-skills / scan-star-commands：frontmatter 沒有 description 時 fallback 永遠拿到空字串（結束行 `---` 被當成開頭行）"
status: FIXING
severity: low
reproducibility: always
created_at: "2026-10-14T04:09:11+0800"
updated_at: "2026-10-14T04:09:11+0800"
impact:
  - claude-panel
  - skills-list
links:
  discovered_in: "T0518 回報區「已知未處理」"
  fix_workorder: T0519
  related: [BUG-125, T0518]
---

# BUG-126 — skills fallback 永遠離不開 frontmatter

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟢 low（frontmatter 無 description 的 skill 描述空白） |
| 可重現 | 必現 |
| **狀態** | 🔧 FIXING（T0519） |
| 回報者 | T0518 Worker（塔台確認程式碼） |

## 現象

- `electron/handlers/claude.ts:371`、`:427`（@ `b66b525`）：`if (trimmed === '---' && line !== lines[0]) inFrontmatter = false`。結束行 `---` 與 `lines[0]`（`---`）字串相同 → 永遠不會離開 frontmatter → description = `''`
- T0518 測試 `keeps skill descriptions unchanged` 的 `nodesc` 案例目前把 `''` 固定為現狀

## 預期

- frontmatter 無 `description` 時取 frontmatter 結束後第一個非空行（去 `#`），與 T0518 的 `parseCommandDescription` 一致
