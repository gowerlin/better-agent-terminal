# 工單 T0090 — 更新 BUG 狀態流定義

## 元資料
- **工單編號**：T0090
- **任務名稱**：更新 BUG 狀態流定義
- **狀態**：IN_PROGRESS
- **開始時間**：2026-04-13 14:44 UTC+8
- **建立時間**：2026-04-13 14:50 UTC+8
- **相關票號**：BUG-023

---

## 🎯 目標

將 `_local-rules.md` 的 BUG 狀態流從舊定義更新為新定義，並同步所有參照此流程的文件。

---

## 📋 舊流程 vs 新流程

**舊（語意倒置，容易混淆）**：
```
REPORTED → INVESTIGATING → FIXING → VERIFY → FIXED → CLOSED / WONTFIX
```

**新（語意直覺）**：
```
OPEN → FIXING → FIXED → VERIFY → CLOSED / WONTFIX
```

**各狀態語意**：
| 狀態 | 觸發者 | 語意 |
|------|--------|------|
| OPEN | Tower | Bug 確認存在，開始追蹤（含報告與調查階段） |
| FIXING | Tower 派工單 | Worker 正在實作修復 |
| FIXED | Worker 回報完成 | Commit 完成，等待人工驗收 |
| VERIFY | （可選）Tower 標記 | 人工驗收進行中 |
| CLOSED | 使用者回報驗收通過 → Tower | 正式結案 |
| WONTFIX | Tower 決策 | 確認不修復，銷單 |

> VERIFY 為選用狀態：若使用者直接回報「驗收通過」，可直接 FIXED → CLOSED。

---

## ✅ 任務清單

### 1. 更新 `_local-rules.md`

找到 BUG 狀態流定義段落，更新為新流程：

```markdown
## BUG 狀態流

OPEN → FIXING → FIXED → VERIFY → CLOSED
                               ↘ WONTFIX

| 狀態 | 觸發者 | 說明 |
|------|--------|------|
| OPEN | Tower | Bug 確認，開始追蹤 |
| FIXING | Tower 開工單 | Worker 實作修復中 |
| FIXED | Worker 回報 | 修復 commit 完成，等人工驗收 |
| VERIFY | Tower（選用）| 驗收進行中 |
| CLOSED | 使用者 → Tower | 驗收通過，正式結案 |
| WONTFIX | Tower 決策 | 確認不修復，銷單 |
```

### 2. 更新 `_bug-tracker.md`

- 確認 tracker 表頭或說明區是否有舊狀態流說明
- 若有，更新為新流程
- 現有 BUG 狀態值：
  - 仍在追蹤中的 OPEN BUG（BUG-023）：確認狀態欄使用 `OPEN`
  - 已結案的 BUG（CLOSED/WONTFIX）：**不需回補**，舊值保留

### 3. 更新 `BUG-023` 狀態欄

`_ct-workorders/BUG-023-context-menu-viewport-overflow.md`
- 若目前狀態為 `REPORTED`，改為 `OPEN`

### 4. 確認 `_tower-state.md`

若有 BUG 狀態流說明，一併更新。

### 5. 提交

```bash
git add _ct-workorders/_local-rules.md \
        _ct-workorders/_bug-tracker.md \
        _ct-workorders/BUG-023-context-menu-viewport-overflow.md \
        _ct-workorders/T0090-update-bug-status-flow.md

git commit -m "chore(tower): 更新 BUG 狀態流為 OPEN→FIXING→FIXED→VERIFY→CLOSED

- 舊流程語意倒置（VERIFY 在 FIXED 前），新流程更直覺
- OPEN 合併原 REPORTED + INVESTIGATING
- VERIFY 為選用狀態，可直接 FIXED → CLOSED
- 現有已結案 BUG 不回補，僅新 BUG 適用新定義"
```

---

## 🔍 驗收標準

- [ ] `_local-rules.md` BUG 狀態流已更新為新定義
- [ ] `_bug-tracker.md` 說明與新流程一致
- [ ] `BUG-023` 狀態為 `OPEN`
- [ ] commit 成功

---

## 📝 回報區（Sub-session 填寫）

**完成時間**：___

**修改檔案清單**：___

**BUG-023 目前狀態確認**：___

**Commit hash**：___

**異常或決策**：___
