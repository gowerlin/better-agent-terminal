# 工單 T0063-workorder-active-index

## 元資料
- **工單編號**：T0063
- **任務名稱**：建立工單索引檔（Active Only）
- **狀態**：DONE
- **建立時間**：2026-04-12 21:21 (UTC+8)
- **開始時間**：2026-04-12 21:24 (UTC+8)
- **完成時間**：2026-04-12 21:27 (UTC+8)

## 工作量預估
- **預估規模**：極小
- **Context Window 風險**：極低

## Session 建議
- **建議類型**：🆕 新 Session

## 任務指令

### 背景

T0062 遷移後，BUG 有 `_bug-tracker.md`、PLAN 有 `_backlog.md`，但工單（T####）缺少索引。建立 `_workorder-index.md`，只追蹤 active 工單（非 DONE），已完成的不列入。

### 前置條件
- 本工單（完整閱讀）
- `_local-rules.md`（了解單據系統）

### 執行步驟

1. 掃描 `_ct-workorders/T*.md`，找出所有非 DONE 狀態的工單
2. 建立 `_ct-workorders/_workorder-index.md`：

```markdown
# 工單索引（Active Only）

> 已完成工單不列入本索引。查詢歷史：Glob `_ct-workorders/T*.md`
> 最後更新：YYYY-MM-DD HH:MM (UTC+8)
>
> 統計：🔄 Active: X | ✅ Done: Y | 總計: Z

## 🔄 進行中 / 待處理

| ID | 標題 | 狀態 | 連結 |
|----|------|------|------|
| T####  | <標題> | 🔄 IN_PROGRESS | [詳細](T####-xxx.md) |

## 🗂️ 說明

- 本索引僅列 active 工單（IN_PROGRESS / TODO / BLOCKED / PAUSED）
- 工單完成（DONE）後從本索引移除
- 完整歷史可透過 Glob 或 BAT UI 的工單列表查看
```

3. 更新 `_tower-state.md` 的快速連結區，加入工單索引連結
4. 更新 `_local-rules.md`，在單據類型表加入工單索引說明

### Commit 規範
```
chore(tower): add active-only work order index
```

### 驗收條件
- [ ] `_workorder-index.md` 已建立
- [ ] 索引只包含 active 工單（目前應該為空或極少）
- [ ] `_tower-state.md` 快速連結已更新
- [ ] `_local-rules.md` 已更新

---

## 回報區

> 以下由 sub-session 填寫

### 完成狀態
DONE

### 產出摘要
- 新建：`_ct-workorders/_workorder-index.md`（Active only 工單索引）
- 修改：`_ct-workorders/_tower-state.md`（快速連結 + 工單最大編號 T0062→T0063）
- 修改：`_ct-workorders/_local-rules.md`（*sync 掃描範圍 + 索引同步原則）
- 修改：`_ct-workorders/T0063-workorder-active-index.md`（工單本身）

### 遭遇問題
- `_local-rules.md` 路徑初始搜尋不到（位於 `_ct-workorders/` 內），改用 Glob 找到
- `_tower-state.md` 因 Read hook token 節省機制只讀到第 1 行，改用 bash sed 讀取

### 回報時間
2026-04-12 21:27 (UTC+8)
