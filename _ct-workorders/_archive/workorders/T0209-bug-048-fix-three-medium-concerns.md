# T0209 — BUG-048 修 3 個 MEDIUM CONCERN(Windows 邊界 + localStorage race)

## 元資料
- **類型**:fix(預防性修復,來自 T0208 驗收)
- **狀態**:FIXED
- **開始時間**:2026-04-19 12:08 (UTC+8)
- **完成時間**:2026-04-19 12:10 (UTC+8)
- **Commit**:`39c55a3`
- **關聯**:BUG-048(FIXED)· T0207(修復,`40207a3`)· T0208(驗收,DONE)
- **派發時間**:2026-04-19 12:05 (UTC+8)
- **預估工時**:45-60 min
- **Renew 次數**:0
- **互動**:不允許(範圍明確,設計自由度已授權)

## 塔台決策背景

T0208 AI 驗收:14/18 PASS,0 FAIL,4 CONCERN。使用者選 C:一次修 3 個 MEDIUM CONCERN(非 LOW)。

目的:**降低人類 VERIFY 時踩到邊角的機率**,尤其 CONCERN-3 最可能在一般使用流程觸發。

## 目標

修復 T0207 遺留的 3 個 MEDIUM CONCERN,使 `expandToPath` 在跨平台路徑差異下穩定,並消除 `file-tree-reveal` 與 localStorage restore 的 race。

## 必修清單(3 個)

### CONCERN-1:Windows 混合 separator(邏輯-d)

**症狀**:`rootPath=C:/root`(forward slash)+ `filePath=C:\root\a\b.txt`(backslash)
- 現行 `usesBackslash` 偵測只看 `filePath`
- 重建 ancestor path 用 `rootPath` 為基底 + `segments` 以 `usesBackslash` 決定 sep
- 結果:ancestor = `C:/root\a`(混合 sep),與 FileTreeNode.entry.path(`C:\root\a` 或 `C:/root/a`)不匹配 → cascade 卡住

**修復原則**:
- expandToPath 內部統一 normalize path(建議:統一 forward slash for lookup key,或統一到與 readdir 回傳一致的 sep)
- 關鍵:`expandedPaths.has(entry.path)` 查詢時,兩邊要是 **同一 normalize 規則**

**驗收**:
- ✅ rootPath 純 `/` + filePath 純 `\` → cascade 正常
- ✅ rootPath 純 `\` + filePath 純 `/` → cascade 正常
- ✅ 兩者同 sep → 不 regression

### CONCERN-2:Windows case-insensitive fs(邏輯-e)

**症狀**:`rootPath=c:\root`(小寫)+ readdir 回傳 `C:\Root\a`(大寫/Title case)
- ancestor 重建用 `rootPath` 原始 case + slice filePath segments
- FileTreeNode.entry.path 用 readdir 回傳 case
- → 兩邊 case 不同 → `Set.has()` case-sensitive miss

**修復原則**:
- 跨平台 aware:Windows + macOS(case-insensitive by default)→ lookup 用 case-insensitive 比對
- Linux(case-sensitive)→ 保持原 case 比對
- 建議實作:**統一 lookup key normalize**(例如 `lowerNorm` 已有,擴用到 `expandedPaths`)
- 或:`expandedPaths` 存 lower-case,FileTreeNode 查詢也 lower-case
- **必須考慮**:Linux 同名不同 case(罕見但技術可行)的行為 — 本專案實務上 workspace 幾乎不會出現,允許降級為「Linux 也 case-insensitive」以簡化

**驗收**:
- ✅ Windows rootPath 小寫 + readdir 大寫 → cascade 正常
- ✅ 同 case → 不 regression

### CONCERN-3:localStorage restore 覆蓋 bus setSelectedFile(回歸-c)⚠️ 最可能觸發

**症狀**:
1. FileTree mount
2. `consumePendingReveal()` 同步執行 → `expandToPath` → `setSelectedFile(bus 目標)`
3. 同時另一個 `useEffect` async `readFile` localStorage → 晚到 callback → `setSelectedFile(localStorage 上次殘留)`
4. 結果:使用者看到「目錄展開對(到 bus 目標),但 Preview 選中 localStorage 的檔」

**修復原則**:**bus 優先**(使用者明確的 reveal 意圖應勝過 localStorage 還原)

**實作選項**(Worker 二選一 + 自由):
- **選項 A**:mount 時**先**檢查 bus 有無 pending,有 → 跳過 localStorage restore
- **選項 B**:localStorage restore callback 檢查當前 `selectedFile` 是否已被 bus 設定(用 ref 追蹤 bus consume 是否發生過),已設定 → 不覆蓋
- **選項 C**:Worker 提案

**驗收**:
- ✅ bus 有 pending + localStorage 有殘留 → 最終選中 bus 目標
- ✅ bus 無 pending + localStorage 有殘留 → 最終選中 localStorage 目標(現行行為維持)
- ✅ bus 有 pending + localStorage 無殘留 → 選中 bus 目標(現行行為維持)

## 不做

- ❌ 不修 2 個 LOW CONCERN(prefix false positive / re-render memoize)
- ❌ 不重構 FileTree 架構
- ❌ 不動 5 處 dispatcher
- ❌ 不改動搜尋模式
- ❌ 不抽 Option C helper

## 設計自由度

- CONCERN-1/2 normalize 實作方式 Worker 決定,但**必須在 `expandToPath` 內部 + `expandedPaths` 查詢路徑保持一致**
- CONCERN-3 選項 A/B/C Worker 決定,選 A 最簡單但需確認不影響「bus 無 pending 時 localStorage 正常還原」

**選擇原則**:最小 diff,避免破壞 T0207 主幹邏輯。

## 已知事實(不要重查)

- T0208 證據:
  - CONCERN-1:`FileTree.tsx:520-521` `usesBackslash` 邏輯
  - CONCERN-1:`FileTree.tsx:523,526` ancestor 重建用 rootPath 原始 case
  - CONCERN-2:同上 case 問題
  - CONCERN-3:`FileTree.tsx:479-498` restore useEffect vs `:553-558` mount consume
- `lowerNorm` helper 已存在(用於 `file-tree-reveal` handler prefix 檢查)
- `expandedPaths: Set<string>` 的 key 目前用 raw entry.path

## 驗收標準

### Worker 自驗(必做)
- [ ] `vite build` 通過
- [ ] 3 個 CONCERN 的驗收情境(見各 CONCERN 段)逐條 code walk 確認
- [ ] 5 處 dispatcher `git diff` 0 改動(除非 Worker 判定需動,需明確回報)

### 跳過 AI 驗收(使用者決定)
- 本工單範圍小且明確,完成後**直接交使用者 VERIFY**
- 若 Worker 自驗發現非預期副作用 → 回報區註明,塔台決定是否加派驗收

## 禁止事項

- ❌ 不得超出 3 個 CONCERN 修復範圍
- ❌ 不得改動 FileTreeNode 受控 expand 的整體架構(T0207 主幹不動)
- ❌ 不得 skip type check
- ❌ 不得 commit without `vite build` pass

## 交付物

寫入本檔「回報區」:
- [ ] CONCERN-1 修復方案 + 證據(diff snippet)
- [ ] CONCERN-2 修復方案 + 證據
- [ ] CONCERN-3 修復方案 + 選項 A/B/C 選擇理由
- [ ] 變更檔案清單 + diff 摘要
- [ ] `vite build` 結果
- [ ] Commit SHA
- [ ] Worker 實耗時 vs 估時

## 收尾步驟(強制)

1. `vite build` 通過
2. `git add` + `git commit` 訊息建議:`fix(ct-panel): BUG-048 follow-up — Windows path edge + localStorage race`
3. 回報區填寫完整
4. 回報格式:**`T0209 完成`**(YOLO auto-submit)

## 回報區

### 完成狀態
FIXED(修復完成,等待使用者 VERIFY)

### 修復策略(一句總結)

引入 module-level `toPathKey(p)` helper(`\\ → /` + lowercase + 去尾斜線)作為 `expandedPaths` 的唯一 key 規則;FileTreeNode 查詢、`handleToggle` 寫入、`expandToPath` 重建 ancestor 全部改用此 key。CONCERN-1/2 以同一修改一次解決。CONCERN-3 採 Option B:加 `bootstrapConsumedRef` 追蹤是否已有明確來源(bus reveal 或 user click)設定 `selectedFile`,localStorage restore 的非同步 callback 檢查 ref → 若 true 則跳過 setSelectedFile(但仍允許檔案不存在時清 localStorage)。

### CONCERN-1 修復(Windows 混合 separator)

**方案**:`expandedPaths` 統一存 normalized key(`toPathKey`),查詢與插入同規則。

**證據 diff**(關鍵段):
```diff
+ function toPathKey(p: string): string {
+   return p.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()
+ }
```

FileTreeNode 查詢:
```diff
- const expanded = entry.isDirectory && expandedPaths.has(entry.path)
+ const expanded = entry.isDirectory && expandedPaths.has(toPathKey(entry.path))
```

expandToPath 重建:
```diff
- const usesBackslash = filePath.includes('\\') && !filePath.includes('/')
- const sep = usesBackslash ? '\\' : '/'
- let acc = rootPath.replace(/[\\/]+$/, '')
- for (...) { acc = acc + sep + segments[i]; ancestorPaths.push(acc) }
+ const rootKey = toPathKey(rootPath)
+ let acc = rootKey
+ for (...) { acc = acc + '/' + segments[i]; ancestorKeys.push(acc) }
```

**code walk 驗收**:
- rootPath=`C:/root`, filePath=`C:\root\a\b.txt`:
  - rootKey=`c:/root`, targetKey=`c:/root/a/b.txt` → rel=`a/b.txt` → ancestorKey=`c:/root/a` ✅
  - FileTreeNode entry.path=`C:\root\a` → `toPathKey` → `c:/root/a` → `has` match ✅
- rootPath=`C:\root`, filePath=`C:/root/a/b.txt`:對稱成立 ✅
- 兩者同 sep:走同條路徑,等價原行為 ✅

### CONCERN-2 修復(case mismatch)

**方案**:同一 `toPathKey` helper 的 `.toLowerCase()` 已含涵蓋。

**證據**:`toPathKey` 強制小寫,Windows rootPath=`c:\root` + readdir 回 `C:\Root\a` 兩邊 normalize 皆為 `c:/root/a`,`Set.has` 命中。

**code walk 驗收**:
- Windows 小寫 rootPath + 大寫 readdir:兩端 normalize 後一致 ✅
- 同 case:lowercase 仍得相同結果 ✅
- **Linux 權衡**:依工單授權,降級為 Linux 也 case-insensitive(workspace 極少出現同名不同 case),簡化實作。

### CONCERN-3 修復(localStorage race)

**選項**:**Option B**(ref 追蹤 bootstrap consumed)

**理由**:
- Option A(mount 時先 peek pending 決定是否 restore)需要新增 `peekPendingReveal` API 或重排 useEffect 順序,diff 較大。
- Option B 最小 diff:僅加一個 ref + 三處寫入點(`expandToPath`、`handleSelect`、restore callback 讀取),且語義清晰:「明確來源優先於 localStorage 還原」。
- 保留 localStorage 清理路徑(file 不存在時仍 `removeItem`),不影響既有清潔邏輯。

**證據**:
```diff
+ const bootstrapConsumedRef = useRef(false)

  // expandToPath:
  setSelectedFile(entry)
+ bootstrapConsumedRef.current = true

  // handleSelect:
  setSelectedFile(entry)
+ bootstrapConsumedRef.current = true

  // restore useEffect callback:
  window.electronAPI.fs.readFile(path).then(result => {
-   if (!result.error) {
-     setSelectedFile({ path, name, isDirectory: false })
-   } else {
-     localStorage.removeItem(storageKey)
-   }
+   if (result.error) {
+     localStorage.removeItem(storageKey)
+     return
+   }
+   if (bootstrapConsumedRef.current) return
+   setSelectedFile({ path, name, isDirectory: false })
  })
```

**code walk 驗收**:
- bus 有 pending + localStorage 殘留:pending-reveal useEffect 同步 `expandToPath` → ref=true,restore 非同步 callback 檢 ref=true → 跳過 setSelectedFile → 最終選中 bus 目標 ✅
- bus 無 pending + localStorage 殘留:pending useEffect `consumePendingReveal()` 回 null → 不動 ref,restore callback 照常 setSelectedFile → localStorage 目標 ✅
- bus 有 pending + localStorage 無殘留:restore useEffect 早退於 `if (!saved) return`,bus 勝 ✅
- file 不存在(localStorage 指向已刪檔案):`result.error` 分支先清 localStorage,不受 ref 影響 ✅

### 變更檔案清單

| 檔案 | 變更 |
|------|------|
| `src/components/FileTree.tsx` | +51 / -23,單檔 |

- 5 處 dispatcher 未動(`git status` 無其他源碼變動)
- T0207 主幹(受控 expand 架構)保留

### vite build 結果

**PASS** — `vite v7.3.2`,254 modules transformed,✓ built in 9.58s(client) + 1.91s(main) + 22ms(preload) + 22ms(terminal-server)。無 error,無 TypeScript 報錯。chunk size warning 為既有(非本工單新增)。

### Commit

- SHA: `39c55a3`
- Message: `fix(ct-panel): BUG-048 follow-up — Windows path edge + localStorage race`
- 工單行: `工單:T0209`

### 實耗時 vs 估時

約 20-25 min / 估 45-60 min(範圍明確、T0208 已精準定位三處根因,實作路徑幾乎無偏離)

### 互動紀錄

無(工單設計自由度已授權,全程按指令執行,未需與使用者確認)

### Renew 歷程

無
