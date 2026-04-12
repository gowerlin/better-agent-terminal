# 工單 T0048-merge-t0044-branch-to-main

## 元資料
- **工單編號**：T0048
- **任務名稱**：Merge T0044 分支到 main（收尾工單 GP006）
- **狀態**：IN_PROGRESS
- **建立時間**：2026-04-12 16:56 (UTC+8)
- **開始時間**：2026-04-12 16:57 (UTC+8)
- **完成時間**：（完成時填入）

## 工作量預估
- **預估規模**：極小（git merge）
- **Context Window 風險**：極低

## Session 建議
- **建議類型**：🆕 新 Session
- **原因**：極簡操作

## 任務指令

### 背景

`T0044-terminal-interaction-polish` 分支包含以下已驗收 commit：

| Commit | 來源工單 | 內容 |
|--------|---------|------|
| `c78ab22` | T0044 | BUG-009 focus 修復 |
| `f327d78` | T0045 | Revert BUG-007 regex 改動 |
| `d8ee82a` | T0047 | Revert xterm v6 → v5 |
| `ac78436` | T0047 | ErrorBoundary 保護 |
| `9cc66d3` | T0047 | BUG-015 CJK 字體 fallback |
| `45e6435` | T0047 | BUG-014 wheel capture phase |

全部驗收通過。

### 執行步驟

1. 確認 T0044 分支乾淨（`git status` 無未提交變更）
2. 切到 main：
   ```bash
   git checkout main
   ```
3. Merge（保留分支歷史）：
   ```bash
   git merge --no-ff T0044-terminal-interaction-polish -m "merge(T0044): terminal interaction polish — BUG-009/013/014/015 fixes + ErrorBoundary"
   ```
4. 確認 `git log --oneline -8` 顯示所有 commit
5. `npx vite build` 確認通過
6. **不要 push** — 由使用者決定

### 驗收條件
- [ ] merge commit 在 main 上
- [ ] `git log` 包含上述 6 個 commit
- [ ] `npx vite build` 通過
- [ ] 未執行 `git push`

---

## 回報區

> 以下由 sub-session 填寫

### 完成狀態
（DONE / FAILED / BLOCKED）

### 產出摘要
（merge commit hash）

### 遭遇問題
（若有）

### 回報時間
（填入當前時間）
