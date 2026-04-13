# 工單 T0083-commit-t0076-t0082-batch

## 元資料
- **工單編號**：T0083
- **任務名稱**：Commit — T0076~T0082 批次
- **狀態**：IN_PROGRESS
- **建立時間**：2026-04-13 11:55 (UTC+8)
- **開始時間**：2026-04-13 12:02 (UTC+8)
- **完成時間**：（待填）
- **相關單據**：T0076, T0077, T0078, T0079, T0081, T0082

---

## 工作量預估
- **預估規模**：極小
- **Context Window 風險**：極低

## Session 建議
- **建議類型**：🆕 新 Session

---

## 任務指令

### 前置確認

執行前先 `git status` 確認變更清單，預期應包含以下 component：

**src/ 程式碼**：
- `src/components/ControlTowerPanel.tsx`（T0076 workspace refresh）
- `src/components/BmadWorkflowView.tsx`（T0076 空狀態）
- `src/components/BmadEpicsView.tsx`（T0076 BUG-019 修復）
- `src/components/BugTrackerView.tsx`（T0076 空狀態 + T0077 勾選框）
- `src/components/BacklogView.tsx`（T0077 勾選框）
- `src/components/SettingsPanel.tsx`（T0079 路徑欄位 + T0082 引號清理）
- `src/components/Sidebar.tsx`（T0078 VS Code 選單 + T0079 ENOENT + T0082）
- `src/stores/settings-store.ts`（T0079 路徑 setter）
- `src/types/index.ts`（T0078/T0079 AppSettings）
- `src/types/electron.d.ts`（T0078/T0079/T0081 型別補齊）
- `src/styles/control-tower.css`（T0077 margin-left: auto）
- `src/locales/en.json` / `zh-TW.json` / `zh-CN.json`

**electron/**：
- `electron/main.ts`（T0078 IPC handler + T0082 引號防呆）
- `electron/preload.ts`（T0078/T0079 IPC bridge）

**_ct-workorders/**：
- T0076~T0083 工單檔案
- BUG-016~022 檔案
- `_bug-tracker.md`、`_workorder-index.md`

---

### Commit 分組（建議 3 筆）

#### Commit 1 — BMad UI + BUG 修復
```
feat(tower): T0076 — BMad workspace refresh + BUG-017~020 修復

- 切換工作區時所有頁籤重新載入（BUG-018）
- BMad _bmad-output 路徑偵測修正（BUG-017）
- Epics tab 改為 BmadEpicsView，移除舊 KanbanView fallback（BUG-019）
- Workflow tab 移除殘留 SprintProgress 渲染（BUG-020）
- 所有頁籤無資料時顯示空狀態訊息，不隱藏頁籤
```

#### Commit 2 — UI 調整 + VS Code 開啟功能
```
feat(tower): T0077/T0078/T0079/T0081/T0082 — UI 調整 + VS Code 開啟功能

- 包含封存勾選框移至統計列右側（T0077）
- 工作區右鍵選單「在 VS Code 中開啟」（T0078）
  - execFile + --new-window 強制新視窗
  - Settings 可指定 VS Code / Insiders 執行檔及完整路徑
  - ENOENT 時顯示友善錯誤提示（BUG-021）
  - 修復路徑含引號導致 ENOENT（BUG-022）
- electron.d.ts 補齊 claude 區段型別（T0081）
```

#### Commit 3 — 工單 & 追蹤文件
```
chore(tower): T0076~T0083 工單文件 + bug tracker 更新

- BUG-017~022 全數 FIXED
- 工單索引同步
```

> **若無法拆分**：合成一筆亦可，訊息用：
> ```
> feat(tower): T0076~T0082 — BMad workspace refresh, VS Code 開啟, UI 調整
> ```

---

### 執行步驟
1. `git status` 確認變更清單
2. `git diff --stat` 快速確認改動規模
3. 依三個 commit 分批 `git add` + `git commit`
4. `git log --oneline -4` 確認 commit 正確
5. **不要** `git push`

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態
（待填）

### 產出摘要
（待填）
