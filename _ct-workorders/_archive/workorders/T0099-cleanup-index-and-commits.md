# 工單 T0099 — 清理技術債：工單索引 + 批次 commit

## 元資料
- **工單編號**：T0099
- **任務名稱**：清理技術債：工單索引重複 + 批次 commit 未提交工單
- **優先級**：高（清理類，阻塞後續工作）
- **估時**：10~15 分鐘
- **狀態**：✅ DONE

---

## 任務描述

清理兩個已知問題：
1. `_workorder-index.md` 中 T0096 列出現兩次（重複行）
2. 以下工單有變更但尚未 commit：T0088 / T0091 / T0092 / T0095 / T0096

完成後可選擇性發正式版 v0.0.9（BUG-001 已通過 runtime 驗收）。

---

## 執行步驟

### Step 1：修正 _workorder-index.md 重複行

```bash
# 確認重複行
grep -n "T0096" _ct-workorders/_workorder-index.md
```

找到 T0096 的兩筆記錄，刪除其中一筆（保留正確的那筆）。

**注意**：
- 保留 `✅ DONE` 的那筆（若兩筆狀態不同）
- 若兩筆相同，刪除任一筆即可

### Step 2：確認未 commit 的工單

```bash
git status
git diff --stat
```

確認以下工單的修改是否在 uncommitted 狀態：
- T0088（原始工單）
- T0091（BUG Detail 工作流 UI）
- T0092（右鍵選單智慧定位）
- T0095（BUG-024 file watch 修復）
- T0096（PLAN-008 Phase 1 auto-save）

同時確認 T0097 / T0098 / sprint-status.yaml / project-context.md 也尚未 commit。

### Step 3：批次 commit

按邏輯分組 commit（不要全部塞在一個 commit）：

**Commit 1：工單文件 + 配置**
```
chore(tower): 補齊 T0097~T0098 工單文件 + project-context + sprint-status
```

**Commit 2：工單索引修復**
```
fix(tower): 修復 _workorder-index.md 中 T0096 重複行
```

**Commit 3：其他未提交的工單文件**（視 git status 結果決定）
```
chore(tower): 補齊 T0088/T0091/T0092/T0095/T0096 工單文件
```

> 若 T0088~T0096 的程式碼修改尚未提交，先確認這些工單的功能是否已在之前的 commit 中提交。只 commit 工單 .md 文件，不要意外提交程式碼。

### Step 4（可選）：發正式版 v0.0.9

若使用者決定發行：

```bash
# 確認當前最新 tag
git tag --sort=-creatordate | head -5

# 建立正式版 tag
git tag v0.0.9
git push origin v0.0.9
```

> ⚠️ **Push 前**：記得回塔台確認，push 是不可逆操作。

---

## 驗證清單

- [ ] _workorder-index.md 中無 T0096 重複行
- [ ] `git status` 顯示 clean（或只剩有意保留的未提交修改）
- [ ] Commit history 邏輯清晰，不混雜不相關的修改
- [ ] sprint-status.yaml 中 T0097 狀態已更新為 DONE（T0098 執行時可能尚未更新）

---

## 工單回報區

**執行人**：Claude  
**開始時間**：2026-04-13 17:24  
**完成時間**：2026-04-13 17:27  

### 完成成果
- [x] _workorder-index.md 重複行已清除（檢查後發現已不存在重複行，前次 session 已修復）
- [x] 批次 commit 完成（共 3 個 commit）
  - Commit 1：T0088~T0096 + BUG-024/025 + PLAN-008（11 files）
  - Commit 2：塔台狀態 + BUG-016~023 + T0086/T0087/T0090 + 歸檔（27 files）
  - Commit 3：T0097/T0098/T0100 + project-context + sprint-status（5 files）
- [x] sprint-status.yaml 已納入 commit（狀態視工單內容而定）
- [ ] （可選）v0.0.9 tag — 跳過（留待使用者決定）

### 遇到的問題
- T0096 重複行在索引中已不存在（前次 session 已修復），Step 1 為 no-op
- 程式碼修改（electron/src/**）未在 T0099 範圍內提交，需獨立 feature commit

### 學習記錄
- 工單範圍界定重要：T0099 僅負責文件 commit，程式碼需獨立處理
- 批次 commit 按功能分組（工單文件 / 塔台狀態 / 新工單）可保持清晰 git history

---

## 下一步

完成後回塔台報告。塔台將：
1. 同步進度
2. 安排 PLAN-008 Phase 2 架構討論（下個 session）
