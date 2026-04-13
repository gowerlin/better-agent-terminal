# 工單 T0085-commit-all-and-pre-release

## 元資料
- **工單編號**：T0085
- **任務名稱**：Commit all + 出內部測試 Pre-release tag
- **狀態**：IN_PROGRESS
- **建立時間**：2026-04-13 13:05 (UTC+8)
- **開始時間**：2026-04-13 13:05 (UTC+8)
- **完成時間**：（待填）
- **相關單據**：T0084（前置，需先完成）

---

## 工作量預估
- **預估規模**：小
- **Context Window 風險**：極低

## Session 建議
- **建議類型**：🆕 新 Session（T0084 完成後執行）

---

## 任務指令

### 前置確認

**必須先確認 T0084 已完成**（BUG-012 fix 已 cherry-pick 到 main）。

執行前先 `git status` 確認所有預期變更都在，`git log --oneline -5` 確認 T0084 的 commit 已在 main。

---

### Commit 1 — BUG-012 fix（若 T0084 未獨立 commit）

若 T0084 的 cherry-pick 已包含 commit，此步驟略過。
若尚未 commit：

```
fix(terminal): BUG-012 — 移除 convertEol 修復 alt buffer 殘影

- 移除 convertEol: true（pty 環境已處理 EOL，重複轉換干擾 alt buffer 渲染）
- 移除 scrollOnOutput: true（對齊 VS Code 預設行為）
- 根因由 EXP-BUG012-001 實驗驗證（5 輪排除法確認）

Fixes BUG-012
```

### Commit 2 — 工單 & 追蹤文件

包含本 session 所有工單文件變更：
- `_ct-workorders/` 下所有新增 / 修改的 .md 文件
- `_bug-tracker.md`、`_workorder-index.md`、`_local-rules.md`

```
chore(tower): T0076~T0085 工單文件 + BUG-012 根因更新

- BUG-012 根因確認（convertEol），EXP-BUG012-001 實驗記錄
- _local-rules.md 新增工單前綴規範（EXP-/跨專案前綴）
- T0076~T0085 工單檔案
- bug tracker：BUG-012 → FIXING，BUG-017~022 → FIXED
```

---

### Pre-release Tag

Commit 完成後，依 CLAUDE.md 規則出 pre-release：

```bash
# 查詢目前最新 tag
git tag --sort=-v:refname | head -5

# 出 pre-release（依當前最新 tag 遞增 patch + -pre.1 後綴）
# 例：目前 v1.0.0 → 建立 v1.0.1-pre.1
git tag v1.0.1-pre.1   # 依實際版號調整
git push origin v1.0.1-pre.1
```

Tag 含 `-pre` → GitHub Release 自動標為 **Pre-release**，不更新 Homebrew tap。

---

### 驗收
1. `git log --oneline -5` 確認兩筆 commit 正確
2. `git tag --sort=-v:refname | head -3` 確認 pre-release tag 已建立
3. `git push origin v1.0.x-pre.1` 成功（本工單允許 push tag）

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態
（待填）

### Tag 版號
（待填：vX.X.X-pre.X）

### 產出摘要
（待填）
