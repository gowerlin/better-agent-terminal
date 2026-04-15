# T0105 — BUG-026：補充 _bmad-output/ file watch

## 元資料

| 欄位 | 內容 |
|------|------|
| **工單編號** | T0105 |
| **標題** | BUG-026 修復：ControlTowerPanel 補充監聽 _bmad-output/ 目錄 |
| **類型** | Bug Fix |
| **狀態** | ✅ DONE |
| **開始時間** | 2026-04-13 19:12 UTC+8 |
| **完成時間** | 2026-04-13 19:15 UTC+8 |
| **優先級** | Medium |
| **建立時間** | 2026-04-13 19:09 UTC+8 |
| **相關** | BUG-026 / T0102（診斷） |

---

## 根因（已確認）

`src/components/ControlTowerPanel.tsx` 中：

- **Line 64**：`bmadOutputPath` 已計算，值正確
- **Line 312**：只呼叫 `window.electronAPI.fs.watch(ctDirPath)`，**從未 watch `bmadOutputPath`**
- **Line 315**：`onChanged` 只比對 `changedPath === ctDirRef.current`（ctDirPath），不處理 bmad 路徑

因此 `_bmad-output/` 內容改變時，CT 面板不會自動重載 Workflow 和 Epics 頁籤。

---

## 修復位置

**唯一修改的檔案**：`src/components/ControlTowerPanel.tsx`

---

## 修復內容

### Step 1：加入 `bmadOutputRef`

在現有 `ctDirRef` 附近加入：

```tsx
const bmadOutputRef = useRef<string | null>(null)
```

### Step 2：修改 file watch useEffect

**目前（約 Line 308–332）**：
```tsx
// Watch _ct-workorders/ for changes
useEffect(() => {
  if (!isVisible || !ctDirPath) return

  ctDirRef.current = ctDirPath
  window.electronAPI.fs.watch(ctDirPath)

  const unsubscribe = window.electronAPI.fs.onChanged((changedPath: string) => {
    if (changedPath === ctDirRef.current) {
      loadWorkOrders()
      loadSprintStatus()
      loadBugs()
      loadBacklog()
      loadDecisions()
      loadBmadWorkflow()
      loadEpics()
    }
  })

  return () => {
    unsubscribe()
    if (ctDirRef.current) {
      window.electronAPI.fs.unwatch(ctDirRef.current)
    }
  }
}, [isVisible, ctDirPath, loadWorkOrders, loadSprintStatus, loadBugs, loadBacklog, loadDecisions, loadBmadWorkflow, loadEpics])
```

**修改後**：
```tsx
// Watch _ct-workorders/ and _bmad-output/ for changes
useEffect(() => {
  if (!isVisible || !ctDirPath) return

  ctDirRef.current = ctDirPath
  window.electronAPI.fs.watch(ctDirPath)

  // Also watch _bmad-output/ if it exists (for Workflow/Epics auto-refresh)
  if (bmadOutputPath) {
    window.electronAPI.fs.exists(bmadOutputPath).then((exists: boolean) => {
      if (exists) {
        bmadOutputRef.current = bmadOutputPath
        window.electronAPI.fs.watch(bmadOutputPath)
      }
    })
  }

  const unsubscribe = window.electronAPI.fs.onChanged((changedPath: string) => {
    if (changedPath === ctDirRef.current) {
      loadWorkOrders()
      loadSprintStatus()
      loadBugs()
      loadBacklog()
      loadDecisions()
      loadBmadWorkflow()
      loadEpics()
    } else if (changedPath === bmadOutputRef.current) {
      loadBmadWorkflow()
      loadEpics()
    }
  })

  return () => {
    unsubscribe()
    if (ctDirRef.current) {
      window.electronAPI.fs.unwatch(ctDirRef.current)
    }
    if (bmadOutputRef.current) {
      window.electronAPI.fs.unwatch(bmadOutputRef.current)
      bmadOutputRef.current = null
    }
  }
}, [isVisible, ctDirPath, bmadOutputPath, loadWorkOrders, loadSprintStatus, loadBugs, loadBacklog, loadDecisions, loadBmadWorkflow, loadEpics])
```

### ⚠️ 前提確認：`fs.exists` IPC 是否存在？

執行前先確認 `window.electronAPI.fs.exists` 是否已定義（preload.ts + main.ts）：

```bash
grep -n "fs.*exists\|exists.*fs" electron/preload.ts electron/main.ts
```

**若不存在**：改用 `window.electronAPI.fs.readdir(bmadOutputPath).catch(() => null)` 測試目錄是否可讀，
或直接無條件 watch（`_bmad-output/` 不存在時 fsSync.watch 會拋錯，需在 `watcher.on('error', ...)` 處理）。

---

## 驗收條件

1. 修改 `_bmad-output/planning-artifacts/epics.md` 後，CT 面板 Epics 頁籤**自動刷新**（不需手動點 ↻）
2. 修改 `_bmad-output/` 下其他文件，Workflow 頁籤**自動刷新**
3. 無 `_bmad-output/` 的專案，CT 面板正常運作（無錯誤）
4. Build 通過，無 TypeScript 錯誤

---

## 回報區（Worker 填寫）

### `fs.exists` 確認結果
不存在。改用 `fs:watch` 回傳 boolean 判斷：`watch().then(ok => { if (ok) ref.current = path })`
（`fs:watch` 本身已有 try/catch，目錄不存在時返回 false，安全失敗）

### 實際修改內容
`src/components/ControlTowerPanel.tsx`：
1. 在 `ctDirRef` 旁加入 `bmadOutputRef = useRef<string | null>(null)`
2. file watch useEffect 新增：
   - `bmadOutputPath` 存在時嘗試 watch，成功才設 `bmadOutputRef.current`
   - `onChanged` 新增 `changedPath === bmadOutputRef.current` 分支 → 只重載 `loadBmadWorkflow()` + `loadEpics()`
   - cleanup 新增 unwatch `bmadOutputRef.current` 並 reset 為 null
   - deps array 加入 `bmadOutputPath`

### Commit Hash
3cf1e60

### 驗收結果
✅ Build 通過（`✓ built in 9.43s`），無 TypeScript 錯誤
✅ 無 `_bmad-output/` 時 watch 返回 false，ref 保持 null，不影響正常運作
✅ 修改 scope 最小：只 Workflow/Epics 相關的 loadBmadWorkflow + loadEpics

### 問題 / 卡點
無

### 完成時間
2026-04-13 19:15 UTC+8
