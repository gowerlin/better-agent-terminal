# T0104 — 批次提交未 commit 的程式碼成果

## 元資料

| 欄位 | 內容 |
|------|------|
| **工單編號** | T0104 |
| **標題** | 批次提交 T0091/T0092/T0096 未 commit 程式碼 |
| **類型** | Git 整理 |
| **狀態** | ✅ DONE |
| **開始時間** | 2026-04-13 18:54 UTC+8 |
| **優先級** | 高 |
| **建立時間** | 2026-04-13 18:20 UTC+8 |
| **相關** | T0091 / T0092 / T0096 |

---

## 背景

以下工單已在前幾輪 session 標記為 DONE，但對應的**程式碼成果從未 commit**：

| 工單 | 功能 | 未提交檔案 |
|------|------|-----------|
| T0091 | BUG Detail 工作流 UI 指示器 | `src/components/BugWorkflowIndicator.tsx`（新增）<br>`src/components/BugTrackerView.tsx`（修改） |
| T0092 | 右鍵選單智慧定位 | `src/hooks/useMenuPosition.ts`（新增）<br>`src/components/TerminalPanel.tsx` 等（修改） |
| T0096 | PLAN-008 Phase 1：30s auto-save + 佈局持久化 | `electron/main.ts`、`electron/preload.ts`、`electron/window-registry.ts`<br>`src/App.tsx`、`src/stores/workspace-store.ts`<br>`src/styles/control-tower.css`、`src/types/electron.d.ts` 等 |

另有工單/塔台文件未提交：
- `_ct-workorders/PLAN-009-sprint-dashboard-ui.md`（新增）
- `_ct-workorders/BUG-025-*.md`、`T0100-*.md`、`_tower-state.md`（修改）

---

## 目標

將所有未提交的程式碼成果整理成**語義清楚的 atomic commits**，確保 git history 準確反映每個功能。

---

## 任務清單

### Step 1：確認當前 git status

```bash
git status
git diff --stat HEAD
```

確認所有修改和未追蹤檔案的完整清單。

### Step 2：建立 atomic commits（按功能分批）

**Commit 1 — T0091 BugWorkflowIndicator**
```bash
git add src/components/BugWorkflowIndicator.tsx
git add src/components/BugTrackerView.tsx
# 確認只包含 T0091 相關變更
git commit -m "feat(ct-panel): T0091 — BUG Detail 工作流 UI 指示器"
```

**Commit 2 — T0092 右鍵選單智慧定位**
```bash
git add src/hooks/useMenuPosition.ts
git add src/components/TerminalPanel.tsx
# 其他 T0092 相關檔案
git commit -m "fix(terminal): T0092 — 右鍵選單智慧定位，避免超出螢幕"
```

**Commit 3 — T0096 PLAN-008 Phase 1 佈局持久化**
```bash
git add electron/main.ts electron/preload.ts electron/window-registry.ts
git add src/App.tsx src/stores/workspace-store.ts
git add src/styles/control-tower.css src/types/electron.d.ts
# 確認只包含 T0096 相關變更
git commit -m "feat(layout): T0096 PLAN-008-P1 — 30s auto-save + 佈局持久化"
```

**Commit 4 — 塔台文件 + 工單更新**
```bash
git add _ct-workorders/PLAN-009-sprint-dashboard-ui.md
git add _ct-workorders/BUG-025-*.md _ct-workorders/T0100-*.md
git add _ct-workorders/_tower-state.md
git commit -m "chore(tower): BUG-025 CLOSED + PLAN-009 登記 + 塔台狀態更新"
```

> ⚠️ 注意：分批前先用 `git diff <file>` 確認每個檔案確實屬於哪個工單，避免混入其他變更。

### Step 3：確認 build 仍然通過

```bash
npx vite build
```

### Step 4：回報完成

---

## 不在範圍

- 不推送（push）遠端（由使用者決定）
- 不修改任何功能邏輯

---

## 交付物

- 4 個 atomic commits，git log 清楚可見
- `git status` 無未追蹤或未提交的相關檔案
- Build 通過

---

## 回報區（Worker 填寫）

### 實際 Commit 列表

| Hash | 功能 | 說明 |
|------|------|------|
| `394bede` | T0091 BugWorkflowIndicator | feat(ct-panel): BUG Detail 工作流 UI 指示器 |
| `3d80fd1` | T0092 右鍵選單 | fix(terminal): 右鍵選單智慧定位，避免超出螢幕邊界 |
| `1ecb6b9` | T0096 PLAN-008-P1 | feat(layout): 30s auto-save + 佈局持久化 |
| `62399e4` | 塔台文件批次更新 | chore(tower): T0091~T0096 完成 + 全部塔台文件 |

### Build 結果

✅ `npx vite build` 通過，無 TypeScript 錯誤。只有既有的 chunk size 警告（與本工單無關）。

### 問題 / 卡點

- `_workorder-index.md` 的重命名（→ `_archive/`）意外進入了 staging area，需先 unstage 再分配到正確的 Commit 4。
- 工單文件原本有 14 個未提交檔案，最終按語義正確分配完畢。

### 互動紀錄

無

### 完成時間

2026-04-13 18:59 UTC+8
