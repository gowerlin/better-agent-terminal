# 工單 T0075-commit-t0072-t0074-batch

## 元資料
- **工單編號**：T0075
- **任務名稱**：Commit — T0072/T0073 BMad UI + T0074 BUG-016 修復
- **狀態**：DONE
- **建立時間**：2026-04-13 10:05 (UTC+8)
- **開始時間**：2026-04-13 10:12 (UTC+8)
- **完成時間**：2026-04-13 10:15 (UTC+8)
- **相關單據**：T0072, T0073, T0074, BUG-016

---

## 工作量預估
- **預估規模**：極小
- **Context Window 風險**：極低

## Session 建議
- **建議類型**：🆕 新 Session（或現有 session 亦可）

---

## 任務指令

### 任務說明

將以下變更分兩筆 commit 送出：

---

### Commit 1 — BMad Workflow/Epics 頁籤

**包含檔案**：
```
src/types/bmad-workflow.ts          （新增）
src/types/bmad-epic.ts              （新增）
src/components/BmadWorkflowView.tsx （新增）
src/components/BmadEpicsView.tsx    （新增）
src/components/ControlTowerPanel.tsx（修改）
src/styles/control-tower.css        （修改）
src/locales/en.json                 （修改）
src/locales/zh-TW.json              （修改）
src/locales/zh-CN.json              （修改）
_ct-workorders/T0070-bmad-integration-analysis.md
_ct-workorders/T0071-bug012-bat-vs-vscode-xterm-diff.md
_ct-workorders/T0072-bmad-workflow-view.md
_ct-workorders/T0073-bmad-epics-view.md
```

**Commit 訊息**：
```
feat(tower): T0072/T0073 — BMad Workflow + Epics 頁籤

- Sprint 頁籤改為 Workflow：顯示 BMad Phase 步進流程
- Kanban 頁籤改為 Epics：顯示 BMad Epic/Story 看板
- 新增 BmadWorkflowView / BmadEpicsView components
- 新增 bmad-workflow / bmad-epic types
- 無 _bmad-output 時自動 fallback 至提示訊息
- T0070 BMad 整合分析、T0071 BUG-012 調查報告
```

---

### Commit 2 — BUG-016 修復

**包含檔案**：
```
src/components/ControlTowerPanel.tsx（修改，T0074 修復部分）
_ct-workorders/T0074-bug016-fix-infinite-loop-and-duplicate-key.md
_ct-workorders/BUG-016-control-tower-panel-infinite-loop-and-duplicate-key.md
_ct-workorders/_bug-tracker.md
_ct-workorders/_workorder-index.md
```

**Commit 訊息**：
```
fix(tower): T0074 — BUG-016 ControlTowerPanel 無限循環 + 重複 key

- 修復 loadEpics useCallback 的 dependency 導致無限循環
  （sprintStatus state 改用 useRef 穩定化）
- 修復工單列表重複 key（Set-based 去重）
- BUG-016 → FIXED
```

---

### 執行步驟

1. `git status` 確認變更清單符合預期
2. `git add` Commit 1 的檔案 → `git commit` Commit 1 訊息
3. `git add` Commit 2 的檔案 → `git commit` Commit 2 訊息
4. `git log --oneline -3` 確認兩筆 commit 正確

### 注意事項
- **不要** `git push`（使用者決定何時 push）
- **不要**把 BUG-017、BUG-018 的新文件加入本次 commit（那些是下一輪的工作）
- Commit 1 的 `ControlTowerPanel.tsx` 和 Commit 2 的修改在同一個檔案，先 `git add -p` 選擇性暫存，或直接用 `git add` 合併成一筆 commit（若無法拆分）

> **若無法拆分 ControlTowerPanel.tsx**：合成一筆 commit 亦可，訊息用：
> ```
> feat(tower): T0072-T0074 — BMad Workflow/Epics 頁籤 + BUG-016 修復
> ```

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態
DONE

### 產出摘要
- 合併為一筆 commit（ControlTowerPanel.tsx 的 BMad UI 與 BUG-016 修復高度交織，無法用 git add -p 拆分）
- Commit: `b26c7ea feat(tower): T0072-T0074 — BMad Workflow/Epics 頁籤 + BUG-016 修復`
- 17 files changed, 2697 insertions(+), 28 deletions(-)
- BUG-017、BUG-018、T0076 正確排除
- 未 push（依工單指示）

### 遭遇問題
無

### 互動紀錄
無
