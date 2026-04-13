# T0117 — BUG-027：全系統 UI 狀態保持

## 元資料

| 欄位 | 內容 |
|------|------|
| **工單編號** | T0117 |
| **標題** | BUG-027 修復：切換頁籤/面板時保留篩選與展開狀態 |
| **類型** | Bug Fix / UX |
| **狀態** | ✅ DONE |
| **開始時間** | 2026-04-13 23:27 UTC+8 |
| **優先級** | 🟡 Medium |
| **建立時間** | 2026-04-13 23:18 UTC+8 |
| **相關** | BUG-027 |

---

## 需求

**全系統 UX 一致**：任何頁籤/面板/dock 切換後，回來時 UI 狀態完整保留。

不能只修 CT 面板——側邊欄和主區的所有面板都要一致。

---

## 任務清單

### Step 1：盤點所有受影響的面板

掃描以下元件，列出哪些有「切換後狀態遺失」問題：

**CT 面板**（ControlTowerPanel.tsx）：
- [ ] Sprint — 新增，確認有無 filter state
- [ ] Orders — ✅ 已保持（作為參考實作）
- [ ] Bugs — ❌ 狀態遺失
- [ ] Backlog — ❌ 狀態遺失
- [ ] Decisions — ❌ 狀態遺失
- [ ] Workflow — 確認
- [ ] Epics — 確認

**側邊欄**（Sidebar.tsx 或對應元件）：
- [ ] 終端列表
- [ ] 檔案樹（FileTree.tsx）
- [ ] Git 面板
- [ ] GitHub 面板
- [ ] 程式碼片段

**主區**：
- [ ] Docking 左右面板切換

### Step 2：分析 Orders 頁籤為什麼能保持

找出 Orders 的 filter/expansion state 存在哪裡（parent state? store? ref?），作為其他 tab 的參考模式。

### Step 3：選擇修復策略

**推薦方案 B+C 混合**：

**B（CSS 隱藏）— 解決 tab 切換**：
```tsx
// 改前（conditional render → unmount）
{activeTab === 'bugs' && <BugsView ... />}

// 改後（CSS 隱藏 → 保持 mounted）
<div style={{ display: activeTab === 'bugs' ? 'block' : 'none' }}>
  <BugsView ... />
</div>
```
改動最小，所有 local state 自動保留。

**C（Store 持久化）— 解決 Reload / 重啟**：
各面板的 filter + expansion state 存入 workspace-store → windows.json，
跟 T0096 佈局持久化同一套機制（event-driven save + 30s auto-save）。

Reload / 重啟時從 store 恢復。

**兩者互補**：
- 方案 B 保證 tab 切換零延遲（不用讀 store）
- 方案 C 保證 Reload / 重啟也能恢復

**需要持久化的 UI state**（範例）：
```typescript
// workspace-store 擴充
panelStates: {
  ctPanel: {
    activeTab: 'sprint',
    bugs: { filterStatus: 'all', expandedIds: ['BUG-026'] },
    backlog: { filterStatus: 'active', expandedIds: [] },
    decisions: { expandedIds: ['D031'] },
    orders: { filterStatus: 'all', showArchived: false },
  },
  sidebar: {
    activePanel: 'terminals',
    fileTree: { expandedPaths: ['/src', '/electron'] },
  }
}
```

### Step 4：CT 面板修復

修改 `ControlTowerPanel.tsx`：所有 tab 內容改用 `display: none` 隱藏。

### Step 5：側邊欄修復

檢查 Sidebar.tsx 的面板切換機制，套用相同策略。

### Step 6：主區 Dock 修復

檢查 WorkspaceView 或對應的 dock 切換邏輯。

### Step 7：Build + 驗證

```bash
npx vite build
```

Runtime 驗證：
- CT 面板：每個 tab 設 filter → 切走 → 切回 → filter 還在
- 側邊欄：展開檔案樹節點 → 切到 Git → 切回 → 展開狀態還在
- 主區：dock 左右切換後狀態保留

---

## 驗收條件

1. CT 面板所有 7 個 tab 切換後狀態保留
2. 側邊欄所有面板切換後狀態保留
3. Dock 切換後狀態保留
4. 全系統 UX 一致（無「這個 tab 記得，那個不記得」）
5. Build 通過
6. 無效能退化（DOM 同時存在不影響渲染速度）

---

## 回報區（Worker 填寫）

### 盤點結果

**CT 面板（7 tabs）**：
- Sprint — ❌ 條件渲染 → ✅ CSS hidden
- Orders — ❌ 條件渲染 → ✅ CSS hidden（filter/expanded state 保留）
- Kanban (Epics) — ❌ 條件渲染 → ✅ CSS hidden
- Workflow — ❌ 條件渲染 → ✅ CSS hidden
- Bugs — ❌ 條件渲染 → ✅ CSS hidden
- Backlog — ❌ 條件渲染 → ✅ CSS hidden
- Decisions — ❌ 條件渲染 → ✅ CSS hidden

**主區面板（WorkspaceView 8 tabs）**：
- Terminal — ✅ 已有 active/hidden CSS class
- Files — ❌ switch/case 重建 → ✅ lazy mount + CSS hidden
- Git — ❌ → ✅ lazy mount + CSS hidden
- GitHub — ❌ → ✅ lazy mount + CSS hidden
- Snippets — ❌ → ✅ lazy mount + CSS hidden
- Skills — ❌ → ✅ lazy mount + CSS hidden
- Agents — ❌ → ✅ lazy mount + CSS hidden
- Control Tower — ❌ → ✅ lazy mount + CSS hidden

**側邊欄 (Sidebar.tsx)**：無 tab 切換機制，不受影響。

### 採用策略

**方案 B（CSS hidden）— 兩層級**：

1. **ControlTowerPanel sub-tabs**：`{activeTab === 'xxx' && <C/>}` → `<div style={{display:...}}><C/></div>`
2. **WorkspaceView main tabs**：lazy mount (`mountedTabs` Set) + CSS `display:none`
   - 首次訪問才 mount，之後永久保持
   - 避免一次性 mount 所有面板的效能問題
   - split mode (pinned pane) 一併支援

### 修改檔案
- `src/components/ControlTowerPanel.tsx` — 7 個 tab 內容改 CSS hidden
- `src/components/WorkspaceView.tsx` — mountedTabs state + lazy mount + CSS hidden

### Commit Hash
（待 commit）

### 完成時間
2026-04-13 23:47 UTC+8
