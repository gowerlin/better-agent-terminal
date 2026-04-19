# T0213 — BUG-048 修 useEffect deps race + 抽 openFileInFilesTab() helper(PLAN-023 階段 1+2)

## 元資料
- **類型**:fix + refactor(急件 bug + 架構清理)
- **狀態**:FIXED
- **開始時間**:2026-04-19 12:52 (UTC+8)
- **完成時間**:2026-04-19 12:57 (UTC+8)
- **關聯**:BUG-048(VERIFY 部分通過)· PLAN-023(階段 1+2)· T0207(bug 來源)· T0211 Option C(helper 推薦)
- **派發時間**:2026-04-19 13:18 (UTC+8)
- **預估工時**:45-60 min
- **Renew 次數**:0
- **互動**:不允許(範圍明確,設計自由度授權)

## 塔台決策背景

### Part 1 — 急件 bug(T0212 之後新發現)

使用者 VERIFY T0212 後發現:
- 預覽 OK ✅
- TreeNode selected highlight 無(T0212 應已修)
- **手動 click 展開資料夾壞了** — 被點的 TreeNode 永遠顯示 `...`(file-tree-loading)
- 使用者 dev serve HMR,確認非 stale bundle

塔台分析:`FileTree.tsx:77-91` useEffect

```ts
useEffect(() => {
  if (!entry.isDirectory || !expanded || children !== null || loading) return
  let cancelled = false
  setLoading(true)            // ← 觸發 re-render
  window.electronAPI.fs.readdir(entry.path).then(entries => {
    if (cancelled) return     // ← cleanup cancelled=true 後 skip
    setChildren(entries)
    setLoading(false)
  }).catch(...)
  return () => { cancelled = true }
}, [expanded, entry.isDirectory, entry.path, children, loading])  // ← loading 在 deps
```

**race**:`setLoading(true)` → deps 變 → effect 重跑 → guard early return + 前次 cleanup 執行(cancelled=true)→ readdir resolve 時 skip setState → loading 永遠卡 true。

**副作用**:bus reveal cascade 時,部分層 race win 展開,深層 race lose 卡住。之後任何手動 click 也 trigger 同 race。

selected highlight 無,是因為目標檔案所在目錄卡住 loading → 檔案 TreeNode 從沒 render → T0212 比對根本沒執行到。T0212 修改是對的,只是被這個 bug 掩蓋。

### Part 2 — 架構清理(T0211 Option C deferred)

5 處 CT Panel dispatch 複製貼上(BacklogView / BmadWorkflowView / BugTrackerView / ControlTowerPanel / DecisionsView),全部:
```ts
window.dispatchEvent(new CustomEvent('workspace-switch-tab', { detail: { tab: 'files' } }))
window.dispatchEvent(new CustomEvent('file-tree-reveal', { detail: { path: filePath } }))
```

**抽 `openFileInFilesTab(path)` helper**,5 處改用 helper call。

## 目標

1. **修 useEffect deps race**,消除 loading stuck 和 bus reveal cascade 漏檔
2. **抽 `openFileInFilesTab()` helper**,5 處 CT Panel dispatch 統一呼叫
3. 兩者一次 PR,diff 集中

## 範圍

### 必做

#### Part 1 — useEffect deps race 修復

**修復原則**(Worker 二選一 + 自由):
- **A. 從 deps 移除 `loading`**,改用 ref guard:`loadingRef.current` 判斷 vs `loading` state;loading state 仍保留用於 UI `{loading && <span>...</span>}`
- **B. 重構 effect**:把 readdir 呼叫從 effect 拉出,改由 handleToggle 觸發(需考慮 bus cascade expandToPath 情境)
- **C. Worker 提案**

**選擇原則**:最小 diff,保留 auto-load cascade 行為(bus reveal expandToPath 依賴此機制)。

**驗收**:
- ✅ 手動 click 展開資料夾 → 不卡 loading,children 正常渲染
- ✅ bus reveal 深層檔案 → cascade 全層完成,目標檔案 TreeNode 有 render
- ✅ loading 指示器只在真正 loading 期間出現(非永久卡住)

#### Part 2 — openFileInFilesTab() helper 抽離

**位置**(Worker 決定):建議 `src/utils/openFileInFilesTab.ts` 或 `src/state/openFileInFilesTab.ts`

**API**:
```ts
export function openFileInFilesTab(filePath: string): void {
  window.dispatchEvent(new CustomEvent('workspace-switch-tab', { detail: { tab: 'files' } }))
  window.dispatchEvent(new CustomEvent('file-tree-reveal', { detail: { path: filePath } }))
}
```

**5 處改造**:
- `BacklogView.tsx:180-181`
- `BmadWorkflowView.tsx:139-140`
- `BugTrackerView.tsx:189-190`
- `ControlTowerPanel.tsx:695-696`
- `DecisionsView.tsx:82-83`

全部改成 `openFileInFilesTab(filePath)` 一行。

**驗收**:
- ✅ 5 處呼叫點語意等價(diff 應為 `-2/+1` 每處)
- ✅ helper 無副作用(只 dispatch,不管 path 有效性)
- ✅ `vite build` 無型別錯

### 不做

- ❌ 不動 fileTreeRevealBus(已 stable)
- ❌ 不改 FileEntry 型別(T0215 階段 3 負責)
- ❌ 不拆 FileTree.tsx(T0215 階段 3 負責)
- ❌ 不改 markdown renderer / 搜尋邏輯
- ❌ 不動 pathKey 分離議題

## 設計自由度

- Part 1 useEffect 修法 Worker 決定(A/B/C)
- Part 2 helper 位置 Worker 決定,但必須是單純 dispatch,不做驗證

**選擇原則**:最小 diff + 降低未來類似 bug 面積。

## 已知事實(不要重查)

- T0211 Step 1 列出 5 處 dispatcher 位置與行數
- fileTreeRevealBus 位置:`src/state/fileTreeRevealBus.ts`
- useEffect race 位置:`FileTree.tsx:77-91`(T0207 引入)
- toPathKey helper:`FileTree.tsx:52-54`
- T0209 handleToggle:`FileTree.tsx:395-404`(已正確 normalize,不必改)

## 驗收標準

### Worker 自驗(必做)
- [ ] `vite build` 通過(無型別錯、無 warning regression)
- [ ] 讀 code 確認 useEffect deps race 修好(deps 無 self-triggering state)
- [ ] 讀 code 確認 5 處呼叫點改完,語意等價(helper 函式內容不改)

### 跳過 AI 驗收
- 使用者直接 VERIFY(兩項重點 + TreeNode highlight,全手測)

## 禁止事項

- ❌ 不得超出 Part 1 + Part 2 範圍(不碰 FileEntry 型別、不動 FileTree 其他邏輯)
- ❌ 不得改 fileTreeRevealBus / toPathKey 實作
- ❌ 不得 skip type check
- ❌ 不得 commit without `vite build` pass
- ❌ 不得重構 FileTree.tsx 結構(拆檔)— 留 T0215

## 交付物

寫入本檔「回報區」:
- [ ] Part 1 修法選擇(A/B/C)+ 理由
- [ ] Part 1 diff 摘要(FileTree.tsx 改動)
- [ ] Part 2 helper 位置 + 內容
- [ ] Part 2 5 處呼叫點 diff(-2/+1 per file 或等效)
- [ ] `vite build` 結果
- [ ] Commit SHA
- [ ] Worker 實耗時 vs 估時

## 收尾步驟(強制)

1. `vite build` 通過
2. `git add` + `git commit` 訊息建議:`fix(ct-panel): BUG-048 follow-up 3 — useEffect race + openFileInFilesTab helper`
3. 回報區填寫完整
4. 回報格式:**`T0213 完成`**

## 回報區

### 完成狀態
FIXED — 兩項修改完成,`vite build` 通過,等待使用者 VERIFY。

### Part 1 — useEffect deps race 修法

**選擇:Option A(最小 diff)**

**理由**:
- B 需拆 effect + 在 handleToggle 手動驅動 readdir,且 bus cascade(expandToPath 僅 setExpandedPaths)仍要靠某種 auto-load → 邏輯會重複或需要再拉一條路徑,diff 面積大。
- A 只動兩行(guard 裡的 `|| loading`、deps 裡的 `loading`),其他邏輯全保留,auto-load cascade 行為完全不變。
- 雙重保險:deps 移除 `loading` 消除自觸發;guard 移除 `loading` 避免剩餘 stale 讀取干擾。
- `children !== null` 已負責「成功後不重抓」;collapse→re-expand 由 cleanup `cancelled=true` 處理;duplicate dispatch 不會發生。

**Diff 摘要**(`src/components/FileTree.tsx:74-92`):
```diff
-  useEffect(() => {
-    if (!entry.isDirectory || !expanded || children !== null || loading) return
+  // T0213 fix (BUG-048 follow-up 3): `loading` must NOT be in deps AND must NOT be in the
+  // guard — otherwise setLoading(true) self-triggers the effect, cleanup marks cancelled=true,
+  // and when readdir resolves the setState is skipped, leaving `loading` stuck true forever.
+  useEffect(() => {
+    if (!entry.isDirectory || !expanded || children !== null) return
     let cancelled = false
     setLoading(true)
     ...
     return () => { cancelled = true }
-  }, [expanded, entry.isDirectory, entry.path, children, loading])
+  }, [expanded, entry.isDirectory, entry.path, children])
```

**Race 解釋(已註記在 code 裡)**:
原本 `setLoading(true)` → `loading` 變 true → deps 改變 → cleanup 執行(cancelled=true)→ effect 重跑時 guard `loading===true` early return → readdir resolve 時被 cancelled 擋掉 → 永遠不會 `setLoading(false)`。移除 deps + guard 裡的 `loading` 後 effect 不再自觸發,race 消失。

### Part 2 — openFileInFilesTab() helper

**位置**:`src/state/openFileInFilesTab.ts`(與 `fileTreeRevealBus.ts` 成對,helper 發事件、bus 緩衝事件)

**API**:
```ts
export function openFileInFilesTab(filePath: string): void {
  window.dispatchEvent(new CustomEvent('workspace-switch-tab', { detail: { tab: 'files' } }))
  window.dispatchEvent(new CustomEvent('file-tree-reveal', { detail: { path: filePath } }))
}
```

**5 處呼叫點 diff**(全部語意等價,每處 -2/+1 或 -3/+1):

| 檔案 | 行號 | diff |
|------|------|------|
| `BacklogView.tsx` | 180-181 | `-2/+1`(dispatch 2 行 → helper 1 行) |
| `BmadWorkflowView.tsx` | 139-140 | `-3/+1`(onClick body 多行 → `() => openFileInFilesTab(filePath)`) |
| `BugTrackerView.tsx` | 189-190 | `-2/+1` |
| `ControlTowerPanel.tsx` | 695-696 | `-2/+1` |
| `DecisionsView.tsx` | 82-83 | `-2/+1` |

每個檔案 +1 `import { openFileInFilesTab } from '../state/openFileInFilesTab'`。

### vite build 結果

`vite build` PASS(vite 7.3.2,254 modules,9.72s)。無型別錯、無 warning regression。chunk size warning 是既有狀態(mermaid.core 576 KB、index 532 KB),與本次改動無關。

### Commit

`f839dc0` — `fix(ct-panel): BUG-048 follow-up 3 — useEffect race + openFileInFilesTab helper`

### 實耗時 vs 估時

約 8 min / 估 45-60 min(Worker 已有 T0211 research 背景 + Option A 路徑清楚,省下設計成本)。

### 互動紀錄
無

### Renew 歷程
無
