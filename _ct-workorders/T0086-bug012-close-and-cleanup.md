# 工單 T0086 — BUG-012 結案 + Worktree 清理

| 欄位 | 值 |
|------|-----|
| **狀態** | DONE |
| **開始時間** | 2026-04-13 13:43 UTC+8 |
| **優先** | 高 |
| **類型** | chore |
| **開單時間** | 2026-04-13 13:35 UTC+8 |
| **完成時限** | 本 session |
| **相關票號** | BUG-002, BUG-012 |

---

## 🎯 目標

BUG-002、BUG-012 人工驗收通過。執行結案文件更新、未提交修改提交、worktree 清理。

---

## 📋 背景

- **BUG-012 修復 commit**：`96cec8a` — 移除 `convertEol: true` + `scrollOnOutput: true`
- **BUG-012 驗證**：v0.0.9-pre.1 安裝後人工確認殘影消失（2026-04-13）
- **BUG-012 GitHub**：upstream issue #46898 已回覆說明根因在 BAT 端，非 upstream 問題
- **BUG-002 驗證**：人工驗收通過（2026-04-13），原為「已修復待運行時驗證」狀態
- **_tower-state.md**：git status 顯示 `M`（上次 session 更新但未提交）
- **bug012 worktree**：可能存在實驗用 worktree，需確認並清理

---

## ✅ 任務清單

### 1. 更新 BUG-002 狀態文件

**`_ct-workorders/BUG-002-*.md`**（先用 Glob 找到正確檔名）
- 狀態列：`VERIFY` → `CLOSED`
- 加入結案記錄：
  ```
  **結案日期**：2026-04-13
  **結案說明**：人工驗收通過（運行時驗證確認）
  ```

### 2. 更新 BUG-012 狀態文件

**`_ct-workorders/BUG-012-alt-buffer-scroll-ghost-text.md`**
- 狀態列：`VERIFY` → `CLOSED`
- 加入結案記錄：
  ```
  **結案日期**：2026-04-13
  **結案說明**：人工驗收通過，v0.0.9-pre.1 確認修復
  **GitHub**：已回覆 anthropics/claude-code#46898
  ```

### 3. 更新 Bug Tracker

**`_ct-workorders/_bug-tracker.md`**
- BUG-002 列：狀態 `VERIFY` → `CLOSED`
- BUG-012 列：狀態 `VERIFY` → `CLOSED`
- 統計列更新：VERIFY 數 -2，CLOSED 數 +2
- 備註欄加入結案日期

### 4. 更新工單索引

**`_ct-workorders/_workorder-index.md`**
- 移除「塔台待辦」區塊中的 T0071 審查項目（T0071 已於 2026-04-13 00:42 標記 DONE，BUG-012 已修復，審查需求消除）
- 加入 T0086 為 IN_PROGRESS，完成後移除

### 5. Worktree 清理

```bash
# 列出所有 worktree
git worktree list

# 若存在 bug012 相關 worktree，執行清理
# （觀察名稱，常見如 worktrees/bug012 或類似路徑）
git worktree remove <bug012-worktree-path>

# 若 worktree 有未提交修改，先確認是否可捨棄
# 不強制刪除，回報塔台決策
```

> ⚠️ 若 worktree 路徑不確定，`git worktree list` 輸出全部回報給塔台

### 6. 提交所有修改

```bash
git add _ct-workorders/_tower-state.md \
        _ct-workorders/_bug-tracker.md \
        _ct-workorders/BUG-002-*.md \
        _ct-workorders/BUG-012-alt-buffer-scroll-ghost-text.md \
        _ct-workorders/_workorder-index.md \
        _ct-workorders/T0086-bug012-close-and-cleanup.md

git commit -m "chore(tower): BUG-002 + BUG-012 CLOSED + T0086 結案清理"
```

### 7. 更新 Tower State

**`_ct-workorders/_tower-state.md`**
- 記錄：BUG-002 CLOSED（2026-04-13，人工驗收）
- 記錄：BUG-012 CLOSED（2026-04-13，人工驗收）
- 記錄：T0086 完成
- 記錄：bug012 worktree 清理結果
- 更新下一步待辦（移除 BUG-012 驗證項目）

---

## 🔍 驗證標準

- [ ] `_bug-tracker.md` 中 BUG-002 狀態為 CLOSED
- [ ] `_bug-tracker.md` 中 BUG-012 狀態為 CLOSED
- [ ] `BUG-002-*.md` 有結案記錄
- [ ] `BUG-012-alt-buffer-scroll-ghost-text.md` 有結案記錄
- [ ] `_workorder-index.md` T0071 待辦項已移除
- [ ] `git worktree list` 無 bug012 相關 worktree（或已回報狀況）
- [ ] `git status` 乾淨（無 untracked / modified 工單文件）
- [ ] commit 成功，訊息格式正確

---

## 📝 回報區（Sub-session 填寫）

**完成時間**：2026-04-13 13:46 UTC+8

**Worktree 狀況**：
```
git worktree list 輸出：
D:/ForgejoGit/better-agent-terminal-main/better-agent-terminal 2b5c80d [main]
```
> 無 bug012 相關 worktree，已自行清理或從未建立。

**Commit hash**：`8c19af7`

**異常或決策**：
無

**統計更新後**：
- BUG-002：CLOSED ✅
- BUG-012：CLOSED ✅
- Open bugs：0（預期 0）✅
- VERIFY bugs：1（預期 1，剩 BUG-001）✅
- Fixed bugs：18（預期 18）✅
- CLOSED bugs：3（預期 3）✅
