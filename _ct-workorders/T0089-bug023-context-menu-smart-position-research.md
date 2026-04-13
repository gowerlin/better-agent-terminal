# 工單 T0089 — BUG-023 右鍵選單智慧定位：調查 + 提案

## 元資料
- **工單編號**：T0089
- **任務名稱**：BUG-023 右鍵選單智慧定位：調查 + 提案
- **狀態**：DONE
- **建立時間**：2026-04-13 14:25 UTC+8
- **開始時間**：2026-04-13 14:26 UTC+8
- **相關票號**：BUG-023

---

## 🎯 目標

**本工單只做調查 + 提案，不實作修改。**

調查 BAT 目前右鍵選單的定位機制，研究業界標準作法，提出具體的解決方案選項，回報塔台由使用者決定實作方向。

---

## 📋 問題背景

**BUG-023**：右鍵選單（context menu）靠近螢幕邊界時不自動調整方向，導致：
- 子選單超出右側邊界 → 文字被截斷（截圖：2026-04-13_140002.png）
- 選單底部超出工作列 → 選項不可見（截圖：2026-04-13_140017.png）

**使用者期望**：選單自動偵測邊界，反向展開（上/左）。

---

## ✅ 任務清單

### 1. 調查現有實作

```bash
# 找 context menu 元件
grep -r "ContextMenu\|contextMenu\|context-menu\|right.click\|onContextMenu" \
  src/ --include="*.tsx" --include="*.ts" -l

# 找選單定位相關程式碼（position, top, left, transform）
grep -r "position.*absolute\|menuPosition\|menuStyle\|getBoundingClientRect\|innerWidth\|innerHeight" \
  src/ --include="*.tsx" --include="*.ts" -l
```

調查項目：
- [ ] 目前選單定位邏輯在哪個元件？（檔案名稱 + 行號）
- [ ] 定位方式為何？（固定偏移、滑鼠座標、CSS transform？）
- [ ] 是否已有任何 viewport 邊界偵測？
- [ ] 子選單（submenu）定位邏輯是否獨立？
- [ ] 目前是否使用任何第三方 dropdown/menu 函式庫？

### 2. 研究業界作法

調查以下三種主流方案，各評估優缺點：

#### 方案 A：手刻 viewport 偵測

原理：計算選單的 `getBoundingClientRect()`，比對 `window.innerWidth/Height`，動態切換 CSS class。

```typescript
// 偽代碼示意
function adjustMenuPosition(menuEl: HTMLElement, anchorRect: DOMRect) {
  const menuRect = menuEl.getBoundingClientRect()
  const vw = window.innerWidth
  const vh = window.innerHeight

  // 右側溢出 → 左移
  if (anchorRect.left + menuRect.width > vw) {
    menuEl.style.left = `${anchorRect.left - menuRect.width}px`
  }
  // 底部溢出 → 上移
  if (anchorRect.bottom + menuRect.height > vh) {
    menuEl.style.top = `${anchorRect.top - menuRect.height}px`
  }
}
```

優點：零依賴、完全控制
缺點：需要手動處理 edge case（角落、子選單遞迴、resize）

#### 方案 B：Floating UI（@floating-ui/react）

業界主流。已被 Radix UI、Headless UI 底層採用。

```bash
npm list @floating-ui  # 確認是否已安裝
```

核心 API：
```typescript
import { computePosition, flip, shift, offset } from '@floating-ui/dom'

computePosition(referenceEl, floatingEl, {
  placement: 'right-start',  // 預設向右展開
  middleware: [
    flip(),   // 若右側不夠 → 自動翻轉到左側
    shift(),  // 若仍超出 → 平移至可見範圍
    offset(4) // 間距
  ]
})
```

優點：功能完整（flip/shift/arrow/virtual anchor）、有 React hooks（`useFloating`）、維護活躍
缺點：增加依賴（但 bundle size 小，gzip ~3KB core）

#### 方案 C：CSS Anchor Positioning（純 CSS，實驗性）

Chrome 125+ 原生支援，無需 JS。

```css
.menu {
  position: absolute;
  position-anchor: --trigger;
  inset-area: right span-all;
  position-try-fallbacks: flip-inline, flip-block, flip-inline flip-block;
}
```

優點：零 JS、零依賴
缺點：瀏覽器支援率約 75%（2026），Electron 需確認版本支援

### 3. 評估表

請填寫以下評估（基於現有程式碼結構）：

| 方案 | 改動範圍 | 依賴變動 | 子選單支援 | 推薦度 |
|------|---------|---------|-----------|--------|
| A. 手刻偵測 | 中（只改 menu 元件） | 無 | 需額外處理 | ? |
| B. Floating UI | 中-大（重構 menu） | 新增 @floating-ui | ✅ 原生支援 | ? |
| C. CSS Anchor | 小（純 CSS） | 無 | 需測試 | ? |

### 4. 回報格式

在回報區提供：
1. **現有實作摘要**（定位邏輯所在檔案 + 方式）
2. **三方案評估**（各方案可行性 + 改動量評估）
3. **你的推薦方案**（說明理由）
4. **預估工作量**（行數、影響元件數）
5. **需要使用者決定的問題**（如：可否引入 Floating UI？接受 CSS 實驗性 API？）

---

## ⚠️ 重要約束

- **本工單禁止修改任何程式碼**
- **只讀取、分析、提案**
- 實作由後續工單執行（等使用者確認方向後）

---

## 🔍 驗收標準

- [ ] 現有 context menu 元件位置已確認
- [ ] 三個方案均有具體評估（含程式碼現況的適配性）
- [ ] 有明確推薦方案 + 理由
- [ ] 有工作量預估
- [ ] 列出需要使用者決策的問題

---

## 📝 回報區（Sub-session 填寫）

**完成時間**：2026-04-13 14:30 UTC+8

**是否已有 @floating-ui**：❌ 未安裝

**Electron 版本**：28.3.3（Chromium 120）→ CSS Anchor Positioning 需要 Chrome 125+，**不可行**

---

### 現有 Context Menu 盤點（7 處 + 1 submenu）

| # | 元件 | 檔案:行號 | CSS class | 有 viewport 偵測？ |
|---|------|-----------|-----------|-------------------|
| 1 | Workspace 右鍵選單 | `Sidebar.tsx:68,124-135` | `workspace-context-menu` | ✅ `useLayoutEffect` + `getBoundingClientRect` |
| 2 | Terminal 複製/貼上 | `TerminalPanel.tsx:57,639` | `context-menu` | ❌ 直接 `left/top` |
| 3 | Sidebar Tab 移動 | `App.tsx:120,1007-1010` | `context-menu` (inline fixed) | ❌ 直接 `left/top` |
| 4 | Workspace Tab Pin | `WorkspaceView.tsx:166,1088-1091` | `context-menu` (inline fixed) | ❌ 直接 `left/top` |
| 5 | Terminal Thumbnail | `TerminalThumbnail.tsx:176,211-214` | `context-menu` (inline fixed) | ❌ 直接 `left/top` |
| 6 | FileTree 檔案操作 | `FileTree.tsx:344,596-600` | `workspace-context-menu` | ❌ 直接 `left/top` |
| 7 | GitHub PR/Issue | `GitHubPanel.tsx:101,272-277` | `workspace-context-menu` (inline fixed) | ❌ 直接 `left/top` |
| sub | ThumbnailBar + 選單 | `ThumbnailBar.tsx:72,222-228` | `thumbnail-add-menu` | ⚠️ 主選單有上下偵測，submenu 無左右偵測 |

**定位方式**：
- 所有選單均使用 `createPortal` 到 `document.body`（BUG-002 修復的 portal 模式）
- 兩種 CSS class：`.context-menu` 和 `.workspace-context-menu`，皆 `position: fixed`
- **只有 Sidebar.tsx** 使用 `useLayoutEffect` 做 viewport 邊界偵測（第 124-135 行）
- 其餘 6 處直接將滑鼠座標 `e.clientX/Y` 設為 `left/top`，無任何溢出保護
- ThumbnailBar 主選單有上下偵測（`spaceBelow < menuHeight`），但 submenu 用 CSS `left: 100%` 固定向右展開

**Sidebar.tsx 現有偵測邏輯**（唯一有效範本）：
```typescript
// Sidebar.tsx:124-135
useLayoutEffect(() => {
  if (!contextMenu || !contextMenuRef.current) { setMenuPos(null); return }
  const rect = contextMenuRef.current.getBoundingClientRect()
  const vw = window.innerWidth
  const vh = window.innerHeight
  let { x, y } = contextMenu
  if (y + rect.height > vh) y = Math.max(0, vh - rect.height - 4)
  if (x + rect.width > vw) x = Math.max(0, vw - rect.width - 4)
  setMenuPos({ x, y })
}, [contextMenu])
```

---

### 三方案評估

| 方案 | 可行性 | 改動量 | 子選單支援 | 新依賴 | 推薦 |
|------|--------|--------|-----------|--------|------|
| **A. 手刻共用 Hook** | ✅ 高（已有範本） | 小-中（~120 行） | 需額外處理 ThumbnailBar | 無 | ⭐ **推薦** |
| **B. Floating UI** | ✅ 可行 | 中-大（重構 7 處） | ✅ 原生支援 flip/shift | `@floating-ui/react` ~3KB gzip | 備選 |
| **C. CSS Anchor** | ❌ 不可行 | — | — | — | 排除 |

#### 方案 A 詳細評估：手刻共用 `useMenuPosition` Hook

**做法**：
1. 從 Sidebar.tsx 提取現有邏輯為 `src/hooks/useMenuPosition.ts`（~30 行）
2. 套用到其他 6 處 context menu（每處 2-5 行改動）
3. ThumbnailBar submenu 加 JS 偵測（若超出右側 → `right: 100%` 取代 `left: 100%`）

**優點**：
- 零依賴變動，完全符合專案輕量風格
- Sidebar.tsx 已驗證此模式可行
- 最小 diff，降低回歸風險
- 統一所有 context menu 的定位行為

**缺點**：
- 需手動處理 resize/scroll 時重新計算（目前 Sidebar 也沒處理）
- submenu 遞迴偵測需額外邏輯（但目前只有 ThumbnailBar 一處 submenu）

**預估工作量**：
- `useMenuPosition` hook：~30 行新檔案
- 6 處套用（TerminalPanel, App, WorkspaceView, TerminalThumbnail, FileTree, GitHubPanel）：每處 ~5-10 行改動
- ThumbnailBar submenu 偵測：~15 行
- **合計**：~100-120 行，影響 8 個元件

#### 方案 B 詳細評估：Floating UI

**做法**：
1. `npm install @floating-ui/react`
2. 每處 context menu 改用 `useFloating({ middleware: [flip(), shift(), offset(4)] })`
3. submenu 使用巢狀 `useFloating` 自動處理

**優點**：
- 功能最完整（flip/shift/arrow/virtual element）
- 社群維護、edge case 覆蓋率高
- submenu 遞迴定位原生支援

**缺點**：
- 新增依賴（雖然 bundle 很小）
- 需重構所有 context menu 的 state 管理模式
- 過度設計（目前 submenu 只有 ThumbnailBar 一處）

---

### 推薦方案：**A — 手刻共用 `useMenuPosition` Hook**

### 推薦理由：
1. **已有驗證範本**：Sidebar.tsx 的 `useLayoutEffect` 已在生產環境運行
2. **最小改動原則**：只需提取 hook + 套用，不改變任何元件的 state 結構
3. **零依賴**：符合專案一貫的輕量風格
4. **風險低**：每個元件的改動只有 2-5 行，容易 review 和回歸測試
5. **未來可擴展**：如果日後需要更複雜的定位（tooltip、dropdown combo），再引入 Floating UI 也不衝突

---

### 需使用者決定的問題：
1. **確認方案 A？** 或偏好 Floating UI（方案 B）以獲得更完整的 submenu 支援？
2. **ThumbnailBar submenu 是否納入本次修復？** 還是只修 BUG-023 回報的 7 處主選單溢出？
3. **是否一併統一 CSS class？** 目前有 `.context-menu` 和 `.workspace-context-menu` 兩套，行為相同但樣式略異——是否趁機統一？

---

### 互動紀錄

無（本工單為純調查，無互動決策）

### 遭遇問題

無
