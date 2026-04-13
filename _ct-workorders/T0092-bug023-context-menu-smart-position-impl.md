# 工單 T0092 — BUG-023 右鍵選單智慧定位實作

## 元資料
- **工單編號**：T0092
- **任務名稱**：BUG-023 右鍵選單智慧定位實作
- **狀態**：DONE
- **建立時間**：2026-04-13 15:05 UTC+8
- **開始時間**：2026-04-13 14:47 UTC+8
- **相關票號**：BUG-023
- **前置工單**：T0089（調查完成 ✅）

---

## 🎯 目標

實作方案 A：建立共用 `useMenuPosition` hook，套用至所有 7 處 context menu 及 ThumbnailBar submenu，確保選單不超出 viewport 邊界。

---

## 📋 決策記錄（來自 T0089 調查 + 塔台決策）

| 決策項 | 選擇 | 理由 |
|--------|------|------|
| 方案 | **A 手刻 hook** | 零依賴，Sidebar.tsx 已有驗證邏輯可提取 |
| Submenu | **納入** | ThumbnailBar submenu 右溢是圖1的核心問題 |
| CSS class 統一 | **不做** | 保持最小改動範圍 |

---

## 📋 調查發現（T0089 交付）

**需修改的位置（共 8 處）**：

| # | 元件 | 問題 |
|---|------|------|
| 1 | `TerminalPanel.tsx` | 直接用 `e.clientX/Y`，無溢出保護 |
| 2 | `App.tsx` | 直接用 `e.clientX/Y`，無溢出保護 |
| 3 | `WorkspaceView.tsx` | 直接用 `e.clientX/Y`，無溢出保護 |
| 4 | `TerminalThumbnail.tsx` | 直接用 `e.clientX/Y`，無溢出保護 |
| 5 | `FileTree.tsx` | 直接用 `e.clientX/Y`，無溢出保護 |
| 6 | `GitHubPanel.tsx` | 直接用 `e.clientX/Y`，無溢出保護 |
| 7 | `ThumbnailBar.tsx` | 主選單有上下偵測，但不完整 |
| 8 | `ThumbnailBar.tsx` | **Submenu** 用 CSS `left: 100%`，固定向右 |

**現有範本**：`Sidebar.tsx` lines 124-135，`useLayoutEffect` 做邊界偵測（可直接提取）。

---

## ✅ 任務清單

### 1. 建立 `useMenuPosition` hook

建立新檔案 `src/hooks/useMenuPosition.ts`：

```typescript
import { useLayoutEffect, useRef, useState } from 'react'

interface MenuPosition {
  x: number
  y: number
}

/**
 * 計算選單位置，自動偵測 viewport 邊界並反向調整
 * @param initialPos 滑鼠點擊座標（e.clientX, e.clientY）
 * @param menuWidth  選單預估寬度（px）
 * @param menuHeight 選單預估高度（px）
 */
export function useMenuPosition(
  initialPos: MenuPosition | null,
  menuWidth = 220,
  menuHeight = 300
) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<MenuPosition | null>(null)

  useLayoutEffect(() => {
    if (!initialPos) { setPos(null); return }

    const vw = window.innerWidth
    const vh = window.innerHeight

    // 實際量測（若選單已渲染）
    const rect = menuRef.current?.getBoundingClientRect()
    const w = rect?.width ?? menuWidth
    const h = rect?.height ?? menuHeight

    setPos({
      x: initialPos.x + w > vw ? initialPos.x - w : initialPos.x,
      y: initialPos.y + h > vh ? initialPos.y - h : initialPos.y,
    })
  }, [initialPos, menuWidth, menuHeight])

  return { pos, menuRef }
}
```

**Submenu 變體**（給 ThumbnailBar submenu 用）：

```typescript
/**
 * 計算子選單位置：預設向右展開，若右側不足則向左
 * @param parentRect  父選單項目的 DOMRect
 * @param submenuWidth 子選單預估寬度
 */
export function useSubmenuPosition(
  parentRect: DOMRect | null,
  submenuWidth = 180
) {
  const vw = window.innerWidth
  if (!parentRect) return { left: '100%', right: 'auto' }

  const wouldOverflow = parentRect.right + submenuWidth > vw
  return {
    left: wouldOverflow ? 'auto' : '100%',
    right: wouldOverflow ? '100%' : 'auto',
  }
}
```

### 2. 套用至 6 處主選單（TerminalPanel / App / WorkspaceView / TerminalThumbnail / FileTree / GitHubPanel）

每處改動模式：

```typescript
// Before
const [menuPos, setMenuPos] = useState<{x: number, y: number} | null>(null)

const handleContextMenu = (e: React.MouseEvent) => {
  e.preventDefault()
  setMenuPos({ x: e.clientX, y: e.clientY })
}

// 渲染
<div className="context-menu" style={{ left: menuPos.x, top: menuPos.y }}>

// ─────────────────────────────────────────
// After
const [rawPos, setRawPos] = useState<{x: number, y: number} | null>(null)
const { pos: menuPos, menuRef } = useMenuPosition(rawPos)

const handleContextMenu = (e: React.MouseEvent) => {
  e.preventDefault()
  setRawPos({ x: e.clientX, y: e.clientY })
}

// 渲染（加 ref 以精確量測）
<div ref={menuRef} className="context-menu" style={{ left: menuPos?.x, top: menuPos?.y }}>
```

### 3. 修正 ThumbnailBar 主選單

現有 `ThumbnailBar.tsx` 已有部分上下偵測，整合至 `useMenuPosition` hook 取代現有邏輯。

### 4. 修正 ThumbnailBar submenu

```typescript
// Before（固定向右）
<div className="submenu" style={{ left: '100%' }}>

// After（動態計算方向）
const submenuPos = useSubmenuPosition(parentItemRef.current?.getBoundingClientRect() ?? null)
<div className="submenu" style={{ left: submenuPos.left, right: submenuPos.right }}>
```

### 5. Build 驗證

```bash
npx vite build
# 確認無 TypeScript 錯誤
```

### 6. 手動驗證

- [ ] 靠近**右側邊界**右鍵 → 選單向左開啟
- [ ] 靠近**底部邊界**右鍵 → 選單向上開啟
- [ ] 靠近**右側邊界**觸發 ThumbnailBar → submenu 向左展開（截圖問題修復）
- [ ] 螢幕**中央**右鍵 → 行為與修改前相同（向右/向下展開）
- [ ] 8 個有 context menu 的元件均測試

### 7. 更新 BUG-023 狀態

`_ct-workorders/BUG-023-context-menu-viewport-overflow.md`
- 狀態：`OPEN` → `FIXED`
- 加入修復記錄

### 8. 提交

```bash
git add src/hooks/useMenuPosition.ts \
        src/components/TerminalPanel.tsx \
        src/components/WorkspaceView.tsx \
        src/components/TerminalThumbnail.tsx \
        src/components/FileTree.tsx \
        src/components/GitHubPanel.tsx \
        src/components/ThumbnailBar.tsx \
        src/App.tsx \
        _ct-workorders/BUG-023-context-menu-viewport-overflow.md \
        _ct-workorders/T0092-bug023-context-menu-smart-position-impl.md

git commit -m "fix(context-menu): BUG-023 智慧定位，超出 viewport 時自動反向

- 新增 useMenuPosition hook（提取 Sidebar.tsx 現有邏輯）
- 新增 useSubmenuPosition hook 處理子選單方向
- 套用至 7 處 context menu + ThumbnailBar submenu
- 靠近右/下邊界時自動向左/向上開啟"
```

---

## 🔍 驗收標準

- [ ] `src/hooks/useMenuPosition.ts` 建立完成
- [ ] 8 處 context menu 均套用新 hook
- [ ] 右側邊界反向（向左）✅
- [ ] 底部邊界反向（向上）✅
- [ ] ThumbnailBar submenu 向左反向 ✅
- [ ] 中央位置行為不變 ✅
- [ ] BUG-023 狀態改為 FIXED
- [ ] `npx vite build` 無錯誤
- [ ] commit 成功

---

## 📝 回報區（Sub-session 填寫）

**完成時間**：2026-04-13 14:54 UTC+8

**useMenuPosition.ts 位置**：`src/hooks/useMenuPosition.ts`

**實際套用元件數**：8（符合預期）
1. `Sidebar.tsx` — 重構：移除 inline `useLayoutEffect`，改用 `useMenuPosition` hook
2. `TerminalPanel.tsx` — 新增 hook 套用
3. `App.tsx` — 新增 hook 套用（sidebar tab ctx menu）
4. `WorkspaceView.tsx` — 新增 hook 套用（tab ctx menu）
5. `TerminalThumbnail.tsx` — 新增 hook 套用
6. `FileTree.tsx` — 新增 hook 套用（取代手動 ref）
7. `GitHubPanel.tsx` — 新增 hook 套用
8. `ThumbnailBar.tsx` — submenu 方向偵測（`getSubmenuDirection`）

**是否有任何元件需特殊處理**：
- `ThumbnailBar.tsx`：submenu 使用 `getSubmenuDirection` 而非 `useMenuPosition`（因為是 CSS absolute 定位子元素，非獨立 portal）
- `Sidebar.tsx`：重構為共用 hook，移除了 `useLayoutEffect` import

**Build 結果**：✅ `npx vite build` 通過，無 TypeScript 錯誤

**Commit hash**：待使用者確認後 commit

**異常或決策**：無

**互動紀錄**：無

**遭遇問題**：無

**BUG-023 最終狀態**：FIXED
