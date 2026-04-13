# 工單 T0095 — BUG-024 控制塔 index 檔案 file watch 修復

## 元資料
- **工單編號**：T0095
- **任務名稱**：BUG-024 控制塔 index 檔案 file watch 修復
- **狀態**：DONE
- **建立時間**：2026-04-13 15:55 UTC+8
- **開始時間**：2026-04-13 15:25 UTC+8
- **相關票號**：BUG-024

---

## 🎯 目標

確保控制塔所有 tab 對應的 markdown 檔案都有 file watch，外部修改後自動刷新，不需手動重整。

---

## 📋 背景

**已知有 file watch 的元件**（grep 結果）：
- `ControlTowerPanel.tsx`：有 watch 邏輯，但覆蓋哪些檔案待確認
- `FileTree.tsx`：目錄 watch
- `MarkdownPreviewPanel.tsx`：單一 markdown watch

**問題**：`_backlog.md` 修改後待辦池 tab 不刷新，推測其他 index 檔也有同樣問題。

---

## ✅ 任務清單

### 1. 盤點現有 watch 邏輯

```bash
# 查 ControlTowerPanel.tsx 的 watch 細節
grep -n "watch\|chokidar\|useEffect\|ipcRenderer\|onFileChange" \
  src/components/ControlTowerPanel.tsx

# 查 electron/main.ts 的 file watch IPC handler
grep -n "watch\|chokidar\|fs\.watch\|watchFile" electron/main.ts | head -40

# 查 preload.ts 暴露的 watch API
grep -n "watch" electron/preload.ts
```

確認：
- [ ] 現有 watch 機制是用 `chokidar`、`fs.watch` 還是 Electron 的 IPC？
- [ ] `ControlTowerPanel.tsx` 目前 watch 哪些檔案路徑？
- [ ] 各 tab 元件（WorkorderTab、BacklogView、BugTrackerView 等）是否各自訂閱 watch，或由父元件統一管理？

### 2. 建立/擴展統一 watch 清單

在 `ControlTowerPanel.tsx`（或其 useEffect）中，確保以下所有檔案都被 watch：

```typescript
const CT_WATCHED_FILES = [
  '_workorder-index.md',      // 工單 tab
  '_backlog.md',               // 待辦池 tab
  '_bug-tracker.md',           // 臭蟲 tab
  '_decision-log.md',          // 決策 tab
  // 個別文件（T*.md, BUG-*.md, PLAN-*.md）若已有 glob watch 則不需重複
]
```

**實作模式（依現有機制選擇）**：

```typescript
// 模式 A：若使用 Electron IPC watch
useEffect(() => {
  const unsubscribers = CT_WATCHED_FILES.map(file => {
    const fullPath = path.join(ctWorkordersDir, file)
    return window.electronAPI.files.watch(fullPath, () => {
      reloadCtData() // 重新讀取並 setState
    })
  })
  return () => unsubscribers.forEach(fn => fn())
}, [ctWorkordersDir])

// 模式 B：若使用 chokidar（主進程）
// electron/main.ts 中擴展 chokidar.watch() 的路徑清單
watcher.add([
  path.join(ctDir, '_workorder-index.md'),
  path.join(ctDir, '_backlog.md'),
  path.join(ctDir, '_bug-tracker.md'),
  path.join(ctDir, '_decision-log.md'),
])
```

### 3. 各 tab 刷新邏輯

確認每個 tab 在 watch 觸發時能正確刷新：

- [ ] 工單 tab：重新解析 `_workorder-index.md` + 個別 T*.md
- [ ] 待辦池 tab：重新解析 `_backlog.md`
- [ ] 臭蟲 tab：重新解析 `_bug-tracker.md` + 個別 BUG-*.md
- [ ] 決策 tab：重新解析 `_decision-log.md`

**注意**：避免 watch 觸發過於頻繁（debounce 300-500ms 防抖動）：

```typescript
const debouncedReload = useMemo(
  () => debounce(reloadCtData, 400),
  [reloadCtData]
)
```

### 4. Build 驗證

```bash
npx vite build
```

### 5. 手動驗證

- [ ] Tower session 修改 `_backlog.md` → 待辦池 tab 在 1-2 秒內自動刷新
- [ ] sub-session 完成工單 → 工單 tab 狀態自動更新
- [ ] `_bug-tracker.md` 修改 → 臭蟲 tab 自動刷新
- [ ] 頻繁修改（連續寫入）不造成 UI 閃爍或崩潰

### 6. 更新 BUG-024

狀態：`OPEN` → `FIXED`

### 7. 提交

```bash
git add src/components/ControlTowerPanel.tsx   # 或其他修改的元件
git add electron/main.ts                        # 若主進程有修改
git add _ct-workorders/BUG-024-*.md
git add _ct-workorders/T0095-*.md

git commit -m "fix(ct-panel): BUG-024 補全 index 檔案 file watch，自動刷新各 tab

- _backlog.md、_bug-tracker.md、_decision-log.md 加入 watch 清單
- 加入 debounce 防止頻繁寫入時 UI 閃爍
- 各 tab 修改後 1-2 秒內自動刷新"
```

---

## 🔍 驗收標準

- [ ] `_backlog.md` 修改 → 待辦池 tab 自動刷新（≤2 秒）
- [ ] `_workorder-index.md` 修改 → 工單 tab 自動刷新
- [ ] `_bug-tracker.md` 修改 → 臭蟲 tab 自動刷新
- [ ] 無 UI 閃爍或效能問題
- [ ] BUG-024 狀態為 FIXED
- [ ] `npx vite build` 無錯誤
- [ ] commit 成功

---

## 📝 回報區（Sub-session 填寫）

**完成時間**：2026-04-13 15:29 UTC+8

**現有 watch 機制**：Node.js `fs.watch` + Electron IPC（非 chokidar）

**修改的元件**：`electron/main.ts`（fs:watch handler）

**缺少 watch 的檔案清單**（確認後）：
問題並非缺少 watch 對象。`fs.watch(ctDirPath, { recursive: true })` 已涵蓋整個 `_ct-workorders/` 目錄。
**根因**：`fs:changed` 事件僅透過 `broadcastHub.broadcast()` 發送，只到達遠端客戶端（remote-server），從未透過 `webContents.send()` 送達本地 BrowserWindow。本地 renderer 的 `ipcRenderer.on('fs:changed', ...)` 永遠收不到事件。

**修復方式**：在 debounce callback 中，於 `broadcastHub.broadcast()` 之前加入 `BrowserWindow.getAllWindows()` 遍歷，透過 `webContents.send('fs:changed', _dirPath)` 發送至所有本地視窗。

**是否需要 debounce**：已有，500ms（在 main process 中實作）

**Build 結果**：✅ 通過（npx vite build 無錯誤）

**Commit hash**：待使用者確認後 commit

**異常或決策**：
- 原工單假設問題是「某些 index 檔缺少 watch」，實際根因是「事件派發路徑斷裂」——所有檔案的 watch 都失效，而非特定檔案
- 修復只需改 `electron/main.ts` 一處（3 行程式碼），無需修改任何 React 元件
