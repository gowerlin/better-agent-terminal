---
schema_version: 1
schema_kind: bug
id: BUG-126
title: "claude:scan-skills / scan-star-commands：frontmatter 沒有 description 時 fallback 永遠拿到空字串（結束行 `---` 被當成開頭行）"
status: FIXED
severity: low
reproducibility: always
created_at: "2026-10-14T04:09:11+0800"
updated_at: "2026-10-14T04:12:07+0800"
fixed_at: "2026-10-14T04:12:07+0800"
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
| **狀態** | ✅ FIXED（T0519，待驗收） |
| 回報者 | T0518 Worker（塔台確認程式碼） |

## 現象

- `electron/handlers/claude.ts:371`、`:427`（@ `b66b525`）：`if (trimmed === '---' && line !== lines[0]) inFrontmatter = false`。結束行 `---` 與 `lines[0]`（`---`）字串相同 → 永遠不會離開 frontmatter → description = `''`
- T0518 測試 `keeps skill descriptions unchanged` 的 `nodesc` 案例目前把 `''` 固定為現狀

## 預期

- frontmatter 無 `description` 時取 frontmatter 結束後第一個非空行（去 `#`），與 T0518 的 `parseCommandDescription` 一致

## 根因與修正

- **根因**：skills（`claude:scan-skills` 第 2 段）與 `claude:scan-star-commands` 的 fallback 以 `line !== lines[0]` 判斷 frontmatter 結束行。結束行 `---` 與開頭行 `lines[0]`（同為 `---`，CRLF 檔則同為 `---\r`）字串相等，`inFrontmatter` 永遠不會變 `false`，description 恆為 `''`
- **修正（T0519）**：兩個分支刪除各自的 fallback 迴圈，改為直接呼叫 T0518 的 `parseCommandDescription(content)`（`electron/handlers/claude.ts`）。規則：frontmatter `description:` 優先；否則取 frontmatter 結束後（無 frontmatter 時為檔案開頭）第一個非空行、去開頭 `#`；frontmatter 未關閉回 `''`
- **行為差異**：只有「有 frontmatter、無 `description:`、frontmatter 已關閉」的 SKILL.md 改變（`''` → 結束後第一行）。有 description、無 frontmatter、未關閉 frontmatter 三種情境結果不變
- **測試**：`electron/__tests__/claude-scan-skills-description.test.ts` 的 `nodesc` 改為新預期，另補 CRLF 無 description、未關閉 frontmatter（skills）與 `ct-help` 無 description（star commands）案例
