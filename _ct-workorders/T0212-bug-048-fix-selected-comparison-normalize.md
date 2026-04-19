# T0212 — BUG-048 Option A 修復:selected 比對套 toPathKey

## 元資料
- **類型**:fix(最小修,T0211 推薦)
- **狀態**:FIXED
- **關聯**:BUG-048(VERIFY 部分通過)· T0211(研究,DONE)· T0209(`39c55a3`,漏修點)
- **派發時間**:2026-04-19 13:05 (UTC+8)
- **開始時間**:2026-04-19 12:35 (UTC+8)
- **完成時間**:2026-04-19 12:37 (UTC+8)
- **預估工時**:10-20 min
- **Renew 次數**:0
- **互動**:不允許

## 塔台決策背景

T0211 三重證據定位根因:
- `FileTree.tsx:105`:`entry.path === selectedPath` 直接字串比對
- `FileTree.tsx:652`:`entry.path === selectedFile?.path` 同樣直接比對
- CT dispatcher 寫 `/`(template literal 硬編),readdir 回 `\`(Windows)→ 永不相等

T0209 修 `expandedPaths` 套 `toPathKey` 但漏改 selected 比對。本工單補 2 處比對。

## 目標

修復 BUG-048 VERIFY 新發現(TreeNode 未 highlight),最小 diff 2 處。

## 必修

### 1. `FileTree.tsx:105`(tree 模式主路徑)

```ts
// 現行
const isSelected = !entry.isDirectory && entry.path === selectedPath

// 改為(含 null guard,避免 toPathKey(null))
const isSelected = !entry.isDirectory
  && selectedPath !== null
  && toPathKey(entry.path) === toPathKey(selectedPath)
```

### 2. `FileTree.tsx:652`(search view 結果)

```ts
// 現行
className={`... ${entry.path === selectedFile?.path ? 'selected' : ''}`}

// 改為
className={`... ${
  selectedFile && toPathKey(entry.path) === toPathKey(selectedFile.path)
    ? 'selected'
    : ''
}`}
```

## 不做

- ❌ 不改 Option B / C(儲存面 normalize / FileEntry 型別)
- ❌ 不動 `expandToPath` / `handleSelect` / localStorage restore 的 path 欄位
- ❌ 不動其他 consumer(FilePreview 等)
- ❌ 不抽 helper(範圍太小)

## 已知事實(不要重查)

- `toPathKey` helper 位置:T0209 引入(`39c55a3`),`FileTree.tsx` 上方 module-level
- 比對面共 2 處(Step 1 已列出),無遺漏
- 根因證據鏈見 T0211 Step 6

## 驗收標準

### Worker 自驗(必做)
- [ ] `vite build` 通過(無型別錯、無 warning regression)
- [ ] 讀 code 確認只改 2 處比對,未擴大範圍

### 跳過 AI 驗收(範圍太小)
- 本工單 2 行 diff,完成後**直接交使用者 VERIFY**

## 禁止事項

- ❌ 不得超出 2 處比對修改範圍
- ❌ 不得 skip type check
- ❌ 不得 commit without `vite build` pass

## 交付物

寫入本檔「回報區」:
- [ ] 變更 2 處 diff snippet
- [ ] `vite build` 結果
- [ ] Commit SHA
- [ ] Worker 實耗時 vs 估時

## 收尾步驟(強制)

1. `vite build` 通過
2. `git add` + `git commit`:`fix(ct-panel): BUG-048 follow-up 2 — selected comparison normalize`
3. 回報區填寫完整
4. 回報格式:**`T0212 完成`**

## 回報區

### 完成狀態
FIXED(BUG 修復工單,修復已完成,等待使用者 VERIFY)

### 變更 diff

**#1 `FileTree.tsx:105`(tree 模式主路徑)**

```diff
- const isSelected = !entry.isDirectory && entry.path === selectedPath
+ const isSelected = !entry.isDirectory
+   && selectedPath !== null
+   && toPathKey(entry.path) === toPathKey(selectedPath)
```

**#2 `FileTree.tsx:652`(search view 結果)**

```diff
- className={`file-tree-item file-tree-file ${entry.path === selectedFile?.path ? 'selected' : ''}`}
+ className={`file-tree-item file-tree-file ${
+   selectedFile && toPathKey(entry.path) === toPathKey(selectedFile.path)
+     ? 'selected'
+     : ''
+ }`}
```

### vite build 結果
pass(`vite v7.3.2` · 254 modules · 9.65s · 無 type error / warning regression;既有 chunk size warning 無關本次修改)

### Commit
`5d8812b` — `fix(ct-panel): BUG-048 follow-up 2 — selected comparison normalize`

### 實耗時 vs 估時
~2 min / 估 10-20 min(範圍極小,僅 2 處比對)

### 互動紀錄
無

### Renew 歷程
無
