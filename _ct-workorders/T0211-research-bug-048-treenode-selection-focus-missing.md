# T0211 — BUG-048 VERIFY 新發現研究:TreeNode 未 focus/highlight 根因

## 元資料
- **類型**:research(研究型,**不互動** — 純 code walk 避免與 T0210 並發提問)
- **狀態**:DONE
- **關聯**:BUG-048(VERIFY 部分通過)· T0207(Option B)· T0209(MEDIUM CONCERN 修復)
- **派發時間**:2026-04-19 12:45 (UTC+8)
- **開始時間**:2026-04-19 12:29 (UTC+8)
- **完成時間**:2026-04-19 12:31 (UTC+8)
- **預估工時**:20-40 min
- **實耗時**:~7 min
- **Renew 次數**:0
- **互動**:**不允許**(T0210 正在 interactive 研究 BUG-050,避免並發提問;本工單純 code walk)

## 塔台決策背景

BUG-048 人類 VERIFY 結果:
- ✅ 現象 1 解決(預覽顯示)
- ✅ 現象 2a 解決(目錄樹展開)
- ❌ 現象 2b **新發現** — TreeNode 未 focus / 未 highlight 選中樣式

**關鍵線索**:預覽顯示成功 = `setSelectedFile` state 設定成功。但 TreeNode 視覺選中樣式未生效 → 視覺比對路徑失敗。

## 目標

定位 **「selectedFile state 已設定 → 但 TreeNode selected 視覺樣式未套用」** 的根因,產出 Option A/B/C 修復建議。

## 已知事實(不要重查)

### 本地 VERIFY 環境
- Windows(D:\ForgejoGit\...)
- Electron app 內執行,readdir 為 Node 原生
- 使用者操作:CT Panel「瀏覽檔案」→ 目錄展開 ✅ + 預覽顯示 ✅ + TreeNode 未 highlight ❌

### T0207 方案(`40207a3`)
- `expandToPath` 用 `setSelectedFile({ path: filePath, name, isDirectory: false })`
- 其中 `filePath` 來自 `file-tree-reveal` event detail(CT Panel dispatch 的 raw path)

### T0209 方案(`39c55a3`)
- 引入 `toPathKey(p)` helper(`\\→/`, lowercase, 去尾斜線)
- `expandedPaths: Set<string>` 統一 normalize
- **未改動** `selectedFile` 比對邏輯(需確認)

### 疑問起點
- FileTreeNode 視覺 selected 比對寫哪?
- 比對用 raw string 還是 normalized key?
- 與 `expandedPaths.has(toPathKey(entry.path))` 是否一致?

## 調查步驟

### Step 1 — 定位 TreeNode selected 比對位置

```bash
grep -nE "selected.*\.path|selectedFile.*entry\.path|isSelected|selected.*class" src/components/FileTree.tsx
```

產出:selected 比對的**檔案:行號** + 比對邏輯(`===` 還是 `toPathKey` 比對?)

### Step 2 — 追 `selectedFile` 設定點 vs 讀取點格式

1. `expandToPath` setSelectedFile 用 `filePath`(raw reveal path)
2. `handleSelect`(使用者點 node 時)setSelectedFile 用 `entry`(readdir 回傳的 entry)
3. localStorage restore setSelectedFile 用 `{ path: saved, ... }`(localStorage 字串)
4. FileTreeNode isSelected 比對用 `entry.path`(readdir)

**關鍵**:4 個來源的 path 格式是否可能不一致?

### Step 3 — 形式化比對矩陣

| 情境 | selectedFile.path 來源 | entry.path 來源 | 格式可能差異 |
|------|---------------------|---------------|------------|
| CT Panel reveal | event detail(CT Panel 字串拼接) | readdir 原生 | Windows: `\` vs `/`,case |
| 使用者點 node | readdir | readdir | 一致 ✅ |
| localStorage restore | localStorage 字串(上次儲存的格式) | readdir | 儲存時是否 normalize? |

**交付**:矩陣 + 假設(「reveal 路徑格式 = 哪個?」「readdir 路徑格式 = 哪個?」)

### Step 4 — Windows 實務格式假設驗證

- CT Panel 5 處 dispatcher 中任選一處(例如 `BugTrackerView.tsx:189-190`),讀 code 確認傳入 event.detail.path 的**字串來源**
  - 是從後端 API 來(Node path.join?)
  - 還是 frontend 拼接(`${rootPath}/${relative}` 硬編 `/`)?
- readdir 返回的 `entry.path` 格式(讀 `src/types/*.ts` 或 IPC handler)

### Step 5 — 驗證 toPathKey 是否漏掉 selected 比對

讀 `FileTree.tsx` T0209 後版本:
- `expandedPaths.has(toPathKey(entry.path))` ✅ 用 normalize
- `selectedFile?.path === entry.path` ❓ **疑似直接字串比對未 normalize**

若確認如上 → **根因**:T0209 漏修 selected 比對。

### Step 6 — 產出 Option A/B/C

```markdown
## 假設(三重證據)
1. selectedFile 來源 / entry.path 來源 / 比對邏輯 各定位
2. Windows 環境下格式差異定位

## 真根因
- 檔案:行號
- 證據鏈

## Option A / B / C
- A: 最小修 — selected 比對改 toPathKey
- B: 統一 — selectedFile 儲存時 normalize path 欄位
- C: 其他(Worker 提案)
```

## 禁止事項

- ❌ **不得修改任何程式碼**(純研究)
- ❌ 不得跑 `vite build`
- ❌ 不得做 git commit
- ❌ 不得擴大到 BUG-048 範圍外(例如 BUG-050 YOLO pipeline)
- ❌ 不得問使用者(T0210 並發,避免雙重互動)

## 交付物

寫入本檔「回報區」:
- [ ] Step 1 selected 比對位置 + 邏輯
- [ ] Step 2 三個 setSelectedFile 設定點格式
- [ ] Step 3 比對矩陣
- [ ] Step 4 Windows 路徑格式假設
- [ ] Step 5 T0209 漏修驗證
- [ ] Step 6 真根因 + Option A/B/C

## 收尾步驟

1. 回報區填寫完整(含證據 file:line)
2. **無需 commit**
3. 回報格式:**`T0211 完成`**

## 回報區

### 完成狀態
DONE — 研究結論:**T0209 漏修 selected 比對邏輯**,根因與 Option A/B/C 如下。

### Step 1 — selected 比對位置

**兩處,均直接字串 `===` 比對,未套 `toPathKey` normalize**:

1. `src/components/FileTree.tsx:105`(tree 模式主要路徑)
   ```ts
   const isSelected = !entry.isDirectory && entry.path === selectedPath
   ```
   - `entry.path` = readdir 回傳(Windows `\`,原樣 case)
   - `selectedPath` = `selectedFile?.path` 經 line 669 傳下來

2. `src/components/FileTree.tsx:652`(search 結果模式)
   ```tsx
   className={`... ${entry.path === selectedFile?.path ? 'selected' : ''}`}
   ```

**對照組**:line 70 `expandedPaths.has(toPathKey(entry.path))` — T0209 只在 expanded 邏輯套了 normalize,**selected 比對整整沒動**。

### Step 2 — setSelectedFile 設定點格式

| # | 設定點 | file:line | `selectedFile.path` 來源字串格式 |
|---|-------|-----------|------------------------------|
| 1 | `expandToPath`(bus reveal) | FileTree.tsx:562-563 | **原 `filePath`**(CT dispatcher 字串,forward `/`,case 依 `ctDirPath` 當初儲存) |
| 2 | `handleSelect`(使用者點 node) | FileTree.tsx:521-522 | `entry`(readdir,Windows `\`,case 原樣) |
| 3 | localStorage restore | FileTree.tsx:514 | `{ path, name }`(上次儲存的格式 — 來自 #1 或 #2) |
| 4 | search view click | FileTree.tsx:655 → handleSelect | 同 #2 |

**關鍵差異**:#1 的 path 用 forward slash(JS template literal `${ctDirPath}/${linkPath}`),其他三個來自 readdir(Windows 用 backslash)。

### Step 3 — 比對矩陣

| 情境 | `selectedFile.path` 格式 | `entry.path` 格式 | `===` 比對結果 |
|------|------------------------|------------------|-------------|
| CT Panel 瀏覽檔案(reveal) | `D:/.../foo.md`(forward slash) | `D:\...\foo.md`(backslash) | **❌ FAIL** |
| 使用者點 node | `D:\...\foo.md` | `D:\...\foo.md` | ✅ PASS |
| localStorage restore 後點另一個 node | 上次儲存 path | readdir path | 視儲存來源而定 |
| search view 點選 | readdir(backslash) | readdir(backslash) | ✅ PASS |

### Step 4 — Windows 路徑格式假設

**reveal 路徑來源**:5 處 dispatcher 全部使用 JS template literal 硬編 forward `/`:
- `BugTrackerView.tsx:188` — `${ctDirPath}/${bug.linkPath}`
- `ControlTowerPanel.tsx:692-694` — `${ctDirPath}/${order.filename}` / `${ctDirPath}/_archive/workorders/${order.filename}`
- `BacklogView.tsx:181`、`BmadWorkflowView.tsx:140`、`DecisionsView.tsx:83` — 同模式

**readdir 路徑來源**:`electron/main.ts:2421` `path.join(dirPath, e.name)` — Windows 下使用反斜線。

**假設驗證**:CT 瀏覽檔案時,`expandToPath` 收到 `D:/.../foo.md`,把它原封不動塞進 `selectedFile`(line 562)。FileTreeNode 被 readdir 灌出的 `entry` 則是 `D:\...\foo.md`。兩者 `===` 永不相等。

**附加風險**:即使沒有分隔符差異,`toPathKey` 還處理大小寫;若 `ctDirPath`(例如 `D:/ForgejoGit/...`)和 Windows 回傳(例如 `D:\forgejogit\...` — 雖罕見但理論可能)大小寫不同,一樣會 FAIL。

### Step 5 — T0209 漏修驗證

**PASS — 確認 T0209 漏修**。

- T0209 commit `39c55a3` 只做了兩件事:
  1. 引入 `toPathKey` helper(line 52)
  2. 把 `expandedPaths` 的 store/lookup 全部套 `toPathKey`(line 70、395、534、538、544、547)
- **未處理**:
  - `FileTreeNode` 內 `entry.path === selectedPath`(line 105)
  - FileTree 本體 search view `entry.path === selectedFile?.path`(line 652)
  - `expandToPath` setSelectedFile 未 normalize `filePath` 欄位(line 562 直接傳原 `filePath`)
- 這解釋了 VERIFY 結果為何「目錄展開(expandedPaths 比對 ✅)+ 預覽顯示(selectedFile state 有設 ✅)+ TreeNode 未 highlight(selected 比對 ❌)」— 問題落在 T0209 沒碰的 selected 比對上。

### Step 6 — 真根因 + Option A/B/C

#### 真根因

**`FileTree.tsx:105` 和 `:652` 的 selected 比對使用 raw 字串 `===`,未經 `toPathKey` normalize**。bus reveal 設入的 `selectedFile.path` 為 forward-slash 格式(CT dispatcher 硬編 `/`),而 `entry.path` 來自 readdir 為 backslash 格式,兩者永不相等,故 TreeNode `isSelected=false`,CSS `selected` class 不套用。

**證據鏈**:
1. CT dispatcher 寫 forward slash:`BugTrackerView.tsx:188` `${ctDirPath}/${bug.linkPath}`
2. readdir 回 backslash:`electron/main.ts:2421` `path.join(dirPath, e.name)`
3. `expandToPath` 原封塞入:`FileTree.tsx:562` `const entry: FileEntry = { path: filePath, name, ... }`
4. selected 比對未 normalize:`FileTree.tsx:105` `entry.path === selectedPath`
5. expandedPaths 比對有 normalize(對照組):`FileTree.tsx:70` `expandedPaths.has(toPathKey(entry.path))`

#### Option A — 最小修(比對面 normalize)

**改動**:`FileTree.tsx:105` 和 `:652` 改用 `toPathKey` 比對。

```ts
// Line 105
const isSelected = !entry.isDirectory
  && selectedPath !== null
  && toPathKey(entry.path) === toPathKey(selectedPath)

// Line 652
className={`... ${
  selectedFile && toPathKey(entry.path) === toPathKey(selectedFile.path)
    ? 'selected'
    : ''
} ...`}
```

- **優點**:改動最小(2 處),不動 state shape、不動 localStorage 格式、不影響其他 consumer
- **缺點**:每個 render 對每個 FileTreeNode 都要算一次 normalize(雖然成本極低);`selectedFile.path` 仍保留原 raw 格式,未來若有其他比對點容易再漏
- **風險**:極低

#### Option B — 統一(儲存面 normalize)

**改動**:`setSelectedFile` 寫入時 normalize `path` 欄位,確保 state 永遠是 canonical form。

```ts
// expandToPath(line 562)
const entry: FileEntry = {
  path: toPathKey(filePath),  // or preserve display path separately
  name,
  isDirectory: false
}
// handleSelect(line 522)
setSelectedFile({ ...entry, path: toPathKey(entry.path) })
// localStorage restore(line 514)
setSelectedFile({ path: toPathKey(path), name, isDirectory: false })
```

Line 105、652 則維持 `===` 但對 `entry.path` 也套 `toPathKey`(或同時改 FileTreeNode 拿到的 `entry.path` 也 normalize 後存 state)。

- **優點**:canonical state,全域一致;未來新增比對點不會再漏
- **缺點**:
  - `selectedFile.path` 變成 lowercase/forward-slash — `FilePreview` 可能需要 raw path 讀檔(line 691 `filePath={selectedFile.path}`),要檢查 `fs.readFile` 是否接受 lowercased path(Windows NTFS 大小寫不敏感通常 OK,但 Linux case-sensitive)
  - localStorage 格式變動,需考慮舊 cache 相容(舊 raw path 讀回來仍可以 normalize 後比對,但儲存時若已 normalize 則 OK)
  - 顯示用的 `name` 仍由 `filePath.split(/[\\/]/)` 算出原 case,需確保這支邏輯繼續保留原 case
- **風險**:中(動到 state 與 localStorage,要驗 FilePreview、搜尋 view、其他 consumer)

#### Option C — 分離顯示 path 與比對 key(推薦長期方案)

**改動**:`FileEntry` 新增 `pathKey` 欄位,`path` 保留原字串給 UI/IPC 用,`pathKey` 只給比對用。

```ts
interface FileEntry {
  name: string
  path: string        // raw, for IPC/display/read
  pathKey: string     // normalized, for equality checks
  isDirectory: boolean
}
```

- readdir IPC handler 產出時同時填兩個欄位
- `expandToPath` / `handleSelect` / localStorage restore 統一補 pathKey
- Line 105、652、expandedPaths 全部用 `pathKey` 比對
- FilePreview 仍用 `path`

- **優點**:語意清晰(顯示 vs 比對分離),未來開發者不易再搞錯
- **缺點**:動到 `FileEntry` 型別 + main.ts `fs:readdir` handler + 多處 consumer;改動面積最大
- **風險**:高(型別廣泛使用,需跑全專案 type check)

#### 推薦

**Option A(最小修)**,理由:
1. 精準對焦根因(selected 比對漏 normalize),不觸發額外範圍
2. 不改 state / localStorage / IPC 型別,回歸測試面最窄
3. 與 T0209 同風格(對比較面 normalize 而非 store 面),一致性佳
4. 若未來再出現類似漏洞,再考慮 Option C 長期重構;目前 scope 僅 2 處比對,Option A 足夠

**備援**:若使用者發現 Option A 之後還有其他比對點露出,再升級到 Option B 或 C。

### 實耗時 vs 估時
~7 min / 估 20-40 min(快於下限 — 證據鏈很快定位,T0209 commit 本身就很聚焦,漏修點一眼可見)

### 互動紀錄
無(CT_INTERACTIVE=0 且本工單禁止互動)

### Renew 歷程
無
