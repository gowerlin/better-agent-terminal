# 工單 T0012-terminal-panel-context-menu

## 元資料
- **工單編號**：T0012
- **任務名稱**：BUG-002 收尾 — TerminalPanel.tsx context menu 套用 createPortal 修法
- **狀態**：DONE
- **類型**：HOTFIX(極小工單,< 10 分鐘)
- **建立時間**：2026-04-11 02:10 (UTC+8)
- **開始時間**：2026-04-11 02:03 (UTC+8)
- **完成時間**：2026-04-11 02:05 (UTC+8)
- **對應 Bug**:BUG-002(`_ct-workorders/BUG-002-context-menu-offset.md`)
- **前置工單**:T0008(已確認修法 + 修好 3 個元件)、T0006(已完成,無衝突)

## 工作量預估
- **預估規模**:XS(極小)— 修法已驗證,只是套用
- **Context Window 風險**:低
- **降級策略**:無(單點修復,沒有部分完成的可能)

## Session 建議
- **建議類型**:🆕 新 Session
- **原因**:fresh context 執行單點修復 + build 驗證

## 檔案所有權

| 路徑 | 所有權 | 說明 |
|------|--------|------|
| `src/components/TerminalPanel.tsx` | **T0012 獨占** | 唯一修改對象 |
| 其他檔案 | **禁止** | 不動 |

**T0006 已完成**,無平行衝突。本工單只碰 TerminalPanel 的 context menu 區段(L530-549 附近),不動 T0006 修的 paste 區段(L47-65, L68-98, L107-117, L360-393)。

---

## 任務指令

### 任務定位

T0008 修好了 FileTree / GitHubPanel / Sidebar 的 context menu 位移,但因為檔案所有權規則,沒動 TerminalPanel.tsx。本工單**單點修復** TerminalPanel 的同樣問題,套用相同的 `createPortal` pattern。

BUG-002 完成後,**整個專案的 context menu 位置問題**全部解決。

---

### 前置條件

**必讀文件**:
- `_ct-workorders/T0008-fix-context-menu-offset.md` 的回報區(了解根因與修法)
- `_ct-workorders/BUG-002-context-menu-offset.md`(完整報修單)
- `CLAUDE.md`(No Regressions、Logging 規範)

**必讀專案檔案**:
- `src/components/TerminalPanel.tsx` 的 **context menu 區段**(L530-549 附近,sub-session 請自行確認實際行號)
- `src/components/TerminalThumbnail.tsx` 的 context menu 實作(參考 git commit `dab2b82` 的修法範本)
- T0008 修過的其中一個檔案(例:`src/components/Sidebar.tsx`)作為最新參考範本

---

### 輸入上下文

### 根因回顧(T0008 發現)

CSS `position: fixed` 的元素**預設**相對於 viewport 定位,但當任一祖先元素有 `transform` 屬性時,`position: fixed` 改為相對於該祖先定位。這導致 context menu 位移約 +250/-50 px(sidebar 寬 + titlebar 高)。

### 修法(T0008 已驗證)

```typescript
import { createPortal } from 'react-dom';

// ❌ 錯誤(目前 TerminalPanel 的做法)
{contextMenu && (
  <div
    className="terminal-context-menu"
    style={{ position: 'fixed', left: x, top: y }}
  >
    ...
  </div>
)}

// ✅ 正確(T0008 在 Sidebar/FileTree/GitHubPanel 套用的 pattern)
{contextMenu && createPortal(
  <div
    className="terminal-context-menu"
    style={{ position: 'fixed', left: x, top: y }}
  >
    ...
  </div>,
  document.body
)}
```

---

### 工作範圍

#### §1 — 定位 TerminalPanel 的 context menu 區段

1. 讀 `src/components/TerminalPanel.tsx` 找到 context menu 渲染點
   - Grep 搜尋:`contextMenu`、`onContextMenu`、`terminal-context-menu`、`context-menu`
   - 預期位置:L530-549 附近(T0008 回報)
2. 確認該區段**未使用** `createPortal`
3. 確認該區段的結構:
   - 是 conditional render(`{contextMenu && ...}`)
   - 是 inline JSX
   - 是否有 ref 用於 click-outside detection

#### §2 — 套用 createPortal 修法

1. 在檔案頂部 import(若尚未 import):
   ```typescript
   import { createPortal } from 'react-dom';
   ```

2. 將 context menu 的 JSX 包在 `createPortal(..., document.body)` 裡:
   ```typescript
   {contextMenu && createPortal(
     <div className="terminal-context-menu" style={{...}}>
       ...
     </div>,
     document.body
   )}
   ```

3. **不要**更動:
   - context menu 的邏輯(觸發條件、選單項目、action handlers)
   - ref 的使用
   - CSS class name
   - click-outside detection(portal 不影響 document 層級事件)

#### §3 — 驗證

1. `npx vite build` 三階段全通過
2. 靜態檢查:
   - Portal import 正確
   - 舊的 context menu render 結構已被 portal 包住
   - 沒有破壞其他無關的 paste / render 邏輯
3. Grep 確認:
   - `grep -n "createPortal" src/components/TerminalPanel.tsx` 應該出現 1 次
   - `grep -n "terminal-context-menu" src/components/TerminalPanel.tsx` 應該仍存在

---

### 不在本工單範圍

- ❌ 不動 `TerminalPanel.tsx` 的 paste 相關程式碼(T0006 的範圍,不要碰)
- ❌ 不動其他任何檔案
- ❌ 不新增 npm 依賴
- ❌ 不重構 context menu 的其他部分(只加 createPortal)
- ❌ 不修 256 個既有 tsc 錯誤

---

### 驗收條件

- [ ] **Build 驗證**:`npx vite build` 三階段全通過
- [ ] **修法正確**:`TerminalPanel.tsx` 的 context menu 改用 `createPortal(..., document.body)`
- [ ] **Import 正確**:檔案頂部有 `import { createPortal } from 'react-dom'`
- [ ] **No Regression**:
  - [ ] T0006 修的 paste 相關程式碼**未被動**到
  - [ ] context menu 的選單項目、action handlers、ref 邏輯均未改變
- [ ] **檔案所有權**:只修 `TerminalPanel.tsx` 一個檔案
- [ ] **日誌合規**:無 `console.log`
- [ ] **Grep 驗證**:
  - [ ] `createPortal` 出現 1 次
  - [ ] `terminal-context-menu` class name 仍存在

---

## Sub-session 執行指示

> **重要**:請在開始工作前,將「開始時間」填入當前時間。

### 執行步驟

1. 讀取本工單全部內容
2. 讀取 `_ct-workorders/T0008-fix-context-menu-offset.md` 回報區(了解修法)
3. 讀取 `src/components/TerminalPanel.tsx` 定位 context menu 區段
4. 讀取 `src/components/Sidebar.tsx`(T0008 修好的範本)參考
5. 更新「開始時間」
6. 執行 §1 → §2 → §3
7. `npx vite build` 驗證
8. 填寫回報區,更新狀態與完成時間

### 執行注意事項

- **只改 context menu 區段**:T0006 剛修的 paste 程式碼絕對不要碰
- **最小改動**:只加 createPortal,不重構
- **如果意外發現 TerminalPanel 還有其他 bug**:停下回報,不要順便修
- **headless 環境**:runtime 驗證延後到 T0011,本工單做 code-level 驗證即可

---

## 回報區

> 以下由 sub-session 填寫,請勿在指揮塔 session 中編輯

### 完成狀態
DONE

### 產出摘要

**修改檔案**:
- `src/components/TerminalPanel.tsx` — context menu 改用 createPortal

**變更內容**:
1. L2: 新增 `import { createPortal } from 'react-dom'`
2. L530-551: context menu 區段以 `createPortal(..., document.body)` 包裹

### 互動紀錄
無

### 遭遇問題
無

### §1 定位結果
- context menu 位於 L530-549（與工單預期完全一致）
- 結構：`{contextMenu && (<div className="context-menu" style={{position:'fixed',...}}>...</div>)}`
- 使用 `contextMenu.x` / `contextMenu.y` 作為座標
- 含 conditional 複製按鈕（hasSelection）與固定貼上按鈕
- 未使用 createPortal

### §2 修法內容

**修改前**:
```tsx
{contextMenu && (
  <div className="context-menu" style={{ position: 'fixed', left: contextMenu.x, top: contextMenu.y, zIndex: 1000 }}>
    ...
  </div>
)}
```

**修改後**:
```tsx
{/* Context Menu — Fix BUG-002: portal to body to avoid position:fixed offset from parent transforms */}
{contextMenu && createPortal(
  <div className="context-menu" style={{ position: 'fixed', left: contextMenu.x, top: contextMenu.y, zIndex: 1000 }}>
    ...
  </div>,
  document.body
)}
```

### Build 驗證結果
`npx vite build` 三階段全通過：
- renderer: ✓ 2127 modules transformed, built in 9.46s
- main: ✓ 28 modules transformed, built in 1.19s
- preload: ✓ 1 modules transformed, built in 20ms

### No Regression 檢查
- [x] `handlePasteText` 未動（L69, L114, L356, L380, L385, L391）
- [x] `writeChunked` 未動（L48, L93）
- [x] Ctrl+V / Ctrl+Shift+V handler 未動（L353-391）
- [x] 其他 non-context-menu 的部分未動

### Grep 驗證
- `grep -n "createPortal" src/components/TerminalPanel.tsx` 結果:
  - L2: `import { createPortal } from 'react-dom'`
  - L532: `{contextMenu && createPortal(`
- `grep -n "context-menu" src/components/TerminalPanel.tsx` 結果:
  - L534: `className="context-menu"`
  - L543: `className="context-menu-item"`
  - L547: `className="context-menu-item"`

### 給 T0011 的備註
TerminalPanel context menu 已 portal 到 document.body，與 Sidebar/FileTree/GitHubPanel 一致。Runtime 驗證時確認右鍵選單位置正確即可。

### sprint-status.yaml 已更新
不適用

### 回報時間
2026-04-11 02:05 (UTC+8)
