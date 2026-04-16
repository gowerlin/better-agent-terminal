# T0118 — T0117 Regression 修復：終端全黑 + 捲動失效

## 元資料

| 欄位 | 內容 |
|------|------|
| **工單編號** | T0118 |
| **標題** | 緊急修復：T0117 CSS hidden 造成終端全黑、捲動失效、filter 遺漏 |
| **類型** | Bug Fix（Regression） |
| **狀態** | ✅ DONE |
| **開始時間** | 2026-04-14 00:01 UTC+8 |
| **優先級** | 🔴 High |
| **建立時間** | 2026-04-13 23:50 UTC+8 |
| **相關** | T0117 / BUG-027 |

---

## 回報的問題（3 類）

### 問題 1（🔴 Critical）：終端全黑
- 終端面板（Terminal / Claude Agent V1 / V2）切換回來後全黑
- **根因**：xterm.js 的 canvas 在 `display: none` 時尺寸為 0，重新顯示後不自動 resize/refresh
- **修復**：面板從 hidden 變 visible 時，呼叫 `terminal.fit()` 或 `xterm.refresh(0, rows)` 觸發重繪

### 問題 2（🔴 High）：Files / Git 捲動失效
- 檔案面板、Git 面板的 scroll（含 mouse wheel）失效
- **根因**：`display: none` 時 scroll container 的 scrollHeight 計算為 0，visible 後未重新計算
- **修復**：面板變 visible 時觸發 scroll container 重新佈局（可能需要 `requestAnimationFrame` + force reflow）

### 問題 3（🟡 Medium）：側邊欄收合→展開後狀態重設
- 側邊欄收合（collapse）再展開後，面板內容狀態重設
- **根因**：收合時 Sidebar 內的元件被 unmount（conditional render 或 width=0 觸發），展開後重建
- **修復**：側邊欄收合時保持元件 mounted（CSS hidden 或 `visibility: hidden` + `width: 0`），或把 state 提升到不被 unmount 的層級

### 問題 4（🟡 Medium）：Snippets / Skills / Agents filter 狀態未保留
- 這三個面板的 filter 在 tab 切換後仍然重置
- **根因**：T0117 可能遺漏了這些面板的 CSS hidden 處理，或 filter state 在子元件 local state
- **修復**：確認這些面板也改為 CSS hidden，或提升 filter state

---

## 修復策略

### 終端全黑 + 捲動修復

**核心**：WorkspaceView 需要在 tab 變 visible 時通知子元件刷新。

```typescript
// WorkspaceView.tsx
// 監聽 activeTab 變化，當 tab 從 hidden → visible 時
useEffect(() => {
  if (activeTab === 'terminal') {
    // 觸發 xterm fit/refresh
    // 可能需要 requestAnimationFrame 等一幀讓 display 生效
    requestAnimationFrame(() => {
      window.dispatchEvent(new Event('resize'))  // xterm 通常監聽 window resize
      // 或直接呼叫 fit addon
    })
  }
}, [activeTab])
```

**更好的方式**：用 `ResizeObserver` 或 `IntersectionObserver` 偵測面板變 visible。

**或退回終端面板的 CSS hidden**：
- 終端是最敏感的元件（canvas + PTY 輸出流）
- 可能只對終端面板保留 conditional render，其他面板用 CSS hidden
- 終端的 state 本來就在 store（workspace-store），切換不會遺失

### Filter 遺漏修復

檢查 Snippets / Skills / Agents 元件：
- 是否已改為 CSS hidden
- 若已改但 filter 仍重置 → filter state 在子元件內部，需提升

---

## 驗收條件

1. 終端切換後正常顯示（不全黑）
2. Claude Agent V1/V2 切換後正常顯示
3. Files / Git 面板捲動正常（mouse wheel + scrollbar）
4. 側邊欄收合→展開後狀態保留
5. Snippets / Skills / Agents filter 切換後保留
6. 其他 T0117 已修復的面板仍然正常
6. Build 通過

---

## 回報區（Worker 填寫）

### 修復方式

**問題 1 & 2（終端全黑 + 捲動失效）**：
- **根因**：T0117 使用 `display: none` 隱藏非活躍 tab 面板，但 xterm.js canvas 在 `display: none` 時尺寸歸零、WebGL context 失效；scroll container 的 scrollHeight 也失效
- **修法**：改用 `visibility: hidden` + `position: absolute` 模式（與現有 `.workspace-container` 一致）
  - 新增 `.workspace-tab-panels` 容器（`position: relative`）
  - 新增 `.workspace-tab-panel` / `.workspace-tab-panel.active` CSS classes
  - `visibility: hidden` 保留元素尺寸，xterm canvas 和 scroll container 維持正確計算
- **檔案**：`src/styles/layout.css`、`src/components/WorkspaceView.tsx`

**問題 3（側邊欄收合→展開後狀態重設）**：
- **根因**：App.tsx 使用 conditional rendering（三元運算子），collapse 時完全 unmount 側邊欄內容
- **修法**：改為 always-render + `display: none` 切換
  - 左側邊欄 collapsed bar 和 expanded wrapper 同時存在，互斥顯示
  - 右側邊欄同樣處理
  - React 元件不再 unmount/remount，所有 local state 保留
- **檔案**：`src/App.tsx`

**問題 4（Snippets / Skills / Agents filter 狀態未保留）**：
- **根因**：預設 docking 設定中這些面板位於右側邊欄（`'right'` zone），側邊欄的 `renderDockablePanel` 使用 conditional rendering — 切 tab 即 unmount
- **修法**：左右側邊欄均改為 lazy-mount + `display: none` toggle
  - 新增 `mountedLeftPanels` / `mountedRightPanels` state 追蹤已訪問的面板
  - 所有已訪問面板保持 mounted，切 tab 時用 display toggle 而非 conditional render
  - 工作區主區域（main zone）的面板則由問題 1&2 的 `visibility: hidden` 修復同步解決
- **檔案**：`src/App.tsx`

### 產出檔案

| 檔案 | 修改內容 |
|------|---------|
| `src/styles/layout.css` | 新增 `.workspace-tab-panels` / `.workspace-tab-panel` CSS（`visibility: hidden` 模式） |
| `src/components/WorkspaceView.tsx` | 主區域 tab 面板改用 visibility CSS class（取代 `display: none`） |
| `src/App.tsx` | 左右側邊欄 collapse 改 always-render；sidebar tab 切換改 lazy-mount + display toggle |

### 互動紀錄

[00:16] Q: 使用者回報 Snippets/Skills/Agents 切換 tab 狀態仍未保留，塔台/工作區切換也 reset → A: 確認根因為右側邊欄 `renderDockablePanel` 仍用 conditional render → Action: 追加 `mountedLeftPanels`/`mountedRightPanels` lazy-mount 機制

### Commit Hash
（待 commit）

### 完成時間
2026-04-14 00:24 UTC+8
