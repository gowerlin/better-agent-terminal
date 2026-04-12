# BUG-011b 分析：右鍵點 menu 外重開新 menu

**工單**：T0033-C Phase 5  
**日期**：2026-04-12  
**狀態**：DONE（<50 行）

---

## 問題描述

Context menu 開著時，在 menu **外**右鍵點一下：
- **預期**：舊 menu 關閉，不開新 menu
- **實際**：舊 menu 消失，新 menu 在新位置開啟

---

## 程式碼關鍵點

| 位置 | 程式碼 | 說明 |
|------|--------|------|
| `TerminalPanel.tsx:147` | `document.addEventListener('click', handleClickOutside)` | 關閉 menu 的觸發條件：`click` 事件 |
| `TerminalPanel.tsx:460` | `containerRef.current.addEventListener('contextmenu', ...)` | 右鍵開 menu，無論是否已有 menu |

---

## 根因假設

### 假設 1（主因）：`handleClickOutside` 只監聽 `click`，不監聽右鍵

**瀏覽器事件序列**（右鍵）：`mousedown` → `mouseup` → `contextmenu`  
右鍵**不會觸發 `click` 事件**。  

所以：使用者右鍵點 terminal → `contextmenu` 觸發 → `setContextMenu(新位置)` → menu 移到新位置。
`handleClickOutside` 從未被呼叫，沒有機會關閉舊 menu。

### 假設 2（次要）：`contextmenu` handler 無保護機制

`contextmenu` handler（line 460）永遠直接 `setContextMenu({...})`，沒有檢查「目前是否已有 menu」。即使有保護，因為 DOM listener 是 closure，捕捉的是初始化時的 `contextMenu` state（總是 `null`），仍無法防止。需用 `useRef` 同步 state 才能在 DOM listener 中讀到最新值。

---

## 修法建議

### 方案 A（最簡單）：用 `mousedown` 取代 `click` 監聽關閉

```ts
// 現在
document.addEventListener('click', handleClickOutside)

// 改成
document.addEventListener('mousedown', handleClickOutside)
```

**問題**：`mousedown` 在 `contextmenu` 之前觸發，但 React state 更新是 async，
`contextmenu` 觸發時 state 還沒清除，`setContextMenu(新位置)` 仍會執行 → **依然會開新 menu**。

### 方案 B（推薦）：用 `contextMenuRef` 在 DOM listener 讀取最新 state

```ts
const contextMenuRef = useRef(contextMenu)
useEffect(() => { contextMenuRef.current = contextMenu }, [contextMenu])

// 在 contextmenu handler 中：
containerRef.current.addEventListener('contextmenu', (e) => {
  e.preventDefault()
  if (contextMenuRef.current) {
    // 已有 menu：關閉，不開新 menu
    setContextMenu(null)
    return
  }
  const selection = terminal.getSelection()
  setContextMenu({ x: e.clientX, y: e.clientY, hasSelection: !!selection })
})
```

**行為**：右鍵點 terminal（menu 已開）→ 關閉 menu，不重開。再右鍵才開新 menu。

---

## 推薦下一步

**建議派 T0035**，採用方案 B 修法。  
本工單（T0033-C）範圍只到 BUG-011 調查，不動手修。

複雜度：Small（改 2 處，`useRef` + handler guard）。  
風險：Low（不影響 xterm 鍵盤路徑，只改 contextmenu 開啟邏輯）。
