# 工單 T0033-A-bug008-marker-overlay-refactor

## 元資料
- **工單編號**：T0033-A
- **任務名稱**：BUG-008 修法 + marker-based decoration 基礎建設 + alt buffer 事件層
- **狀態**：DONE
- **建立時間**：2026-04-12 11:10 (UTC+8)
- **開始時間**：2026-04-12 11:11 (UTC+8)
- **完成時間**：2026-04-12 11:19 (UTC+8)
- **目標子專案**：（單一專案，留空）
- **工單類型**：🔧 **Fix + Infrastructure**（含 code 修改 + 新檔案 + git commit）
- **關聯工單**：T0032（investigation）、T0032.5（VS Code reference）、T0033-Obs（fan-out analysis）
- **關聯 Bug**：BUG-008（overlay scroll ghost）

## 工作量預估
- **預估規模**：**中**（1.5-2.5 小時）
  - Phase 1（BUG-008 fix）：~10 min
  - Phase 2（alt buffer detection）：~20 min
  - Phase 3（DecorationManager 新檔案）：~40 min
  - Phase 4（整合進 TerminalPanel）：~30 min
  - Phase 5（驗證）：~15 min
- **Context Window 風險**：中（新檔案 + 改 TerminalPanel 589 行檔案）
- **降級策略**：Phase 1-2 獨立可 commit、Phase 3-4 獨立可 commit，任一階段卡關可 PARTIAL

## Session 建議
- **建議類型**：🆕 新 Session
- **原因**：中等規模工單，需要完整 context window
- **Context 監控**：跑到 60% 就 checkpoint，Phase 3 完成後建議 checkpoint

---

## 任務指令

### 前置條件

**必讀**：
1. `src/components/TerminalPanel.tsx`：整檔讀取（589 行，是本工單主要修改目標）
2. `node_modules/@xterm/xterm/typings/xterm.d.ts:470-530,1115-1130`（IMarker, IDecoration, IDecorationOptions, registerMarker, registerDecoration API）

**選讀**（有疑問再讀）：
- `_ct-workorders/reports/T0032.5-vscode-terminal-reference-analysis.md` Section 4.2（VS Code decoration 定位策略）
- `_ct-workorders/reports/T0032-bug008-bug010-investigation.md` Section 2（BAT 事件盤點）

**不要讀**：
- `_tower-state.md`、其他 T0033 工單

### ⚠️ 重要 API 約束

xterm.js 5.5.0 decoration API 限制：
1. **`registerMarker()`** — 只加到 **normal buffer**（alt buffer 時不可用）
2. **`registerDecoration()`** — 若 **alt buffer active 返回 `undefined`**
3. **`IDecoration.onRender`** — 當 decoration 的 DOM 元素被渲染時觸發

→ Decoration 基礎建設只適用於 normal buffer 場景（command markers、error highlights）
→ Alt buffer 場景（Claude Code / vim / less 執行中）的 overlay 管理仍需 DOM 層處理
→ Phase 1 的 scroll dismiss 在兩種 buffer 都有效

### 背景總結

**BUG-008 根因**：context menu 用 `createPortal` + `position: fixed` 定位在 `document.body`。terminal 捲動時 overlay 不跟隨 → ghost。

**修法策略（2 層）**：
1. **即時修**：terminal scroll 時 dismiss context menu（Phase 1）
2. **基礎建設**：建立 marker-based decoration 管線，未來持久性 overlay（command markers、error highlights）自動跟隨 scroll（Phase 3-4）

**VS Code 參考**（from T0032.5）：
- `registerDecoration({ marker })` + `onRender` lifecycle
- `buffer.active === buffer.alternate` 判定 alt buffer
- 不用 `onScroll`；overlay 同步靠 marker + render lifecycle

---

### Phase 1：BUG-008 修法 — scroll dismiss（~10 min，零風險）

**檔案**：`src/components/TerminalPanel.tsx`

在現有的 ESC dismiss `useEffect`（line ~154-160）下方，新增 scroll dismiss：

```tsx
// Close context menu on terminal scroll (BUG-008)
useEffect(() => {
  if (!contextMenu) return
  const viewport = containerRef.current?.querySelector('.xterm-viewport')
  if (!viewport) return
  const handleScroll = () => setContextMenu(null)
  viewport.addEventListener('scroll', handleScroll, { passive: true })
  return () => viewport.removeEventListener('scroll', handleScroll)
}, [contextMenu])
```

**原理**：
- `.xterm-viewport` 是 xterm 的 scrollable container（有 `overflow-y: scroll`）
- mouse wheel 捲動時 `scroll` 事件觸發 → context menu 關閉
- `passive: true` 避免 scroll 效能影響
- 與 ESC dismiss 和 click-outside dismiss 並存，互不干擾

**驗收**：
- [ ] Context menu 在 scroll 時消失
- [ ] 不影響 Ctrl+Wheel zoom（zoom handler 在 wheel 事件，不是 scroll 事件）
- [ ] `npx vite build` 通過

### Phase 2：Alt buffer 事件偵測（~20 min，低風險）

**檔案**：`src/components/TerminalPanel.tsx`

**Step 2.1 — 新增 state**：

在 component 頂部（line ~54 附近）新增：

```tsx
const [altBufferActive, setAltBufferActive] = useState(false)
```

**Step 2.2 — 訂閱 buffer change**：

在 useEffect（line ~195 的 terminal 初始化 block）中，terminal 建立後新增：

```tsx
// Track alt buffer state (BUG-008 infrastructure)
const bufferChangeDisposable = terminal.buffer.onBufferChange((activeBuffer) => {
  const isAlt = activeBuffer === terminal.buffer.alternate
  setAltBufferActive(isAlt)
  dlog(`[terminal] buffer changed: ${isAlt ? 'alt' : 'normal'}`, terminalId)
})
```

**Step 2.3 — cleanup**：

在 useEffect return cleanup（line ~553 附近）中新增：

```tsx
bufferChangeDisposable.dispose()
```

**Step 2.4 — 暴露給 store（選做）**：

考慮是否要把 `altBufferActive` 同步到 `workspaceStore`。目前**不需要**，因為沒有外部消費者。未來若有需求（例如 statusline 顯示 alt buffer 指示器），再加。

**暫時不做的**：把 altBufferActive 寫入 workspaceStore → 過度設計，等有消費者再加。

**驗收**：
- [ ] 進入 `vim` 時 console 出現 `[terminal] buffer changed: alt`
- [ ] 退出 `vim` 時 console 出現 `[terminal] buffer changed: normal`
- [ ] `npx vite build` 通過

### Phase 3：TerminalDecorationManager 新檔案（~40 min，中風險）

**新檔案**：`src/utils/terminal-decoration-manager.ts`

建立一個 class，封裝 xterm marker/decoration lifecycle。這個 class **不依賴 React**，是純 TypeScript utility。

```typescript
import type { Terminal, IMarker, IDecoration, IDecorationOptions } from '@xterm/xterm'

const dlog = (...args: unknown[]) =>
  (window as any).electronAPI?.debug?.log(...args)

interface ManagedDecoration {
  marker: IMarker
  decoration: IDecoration | undefined
  onRenderCallback?: (element: HTMLElement) => void
  disposed: boolean
}

export class TerminalDecorationManager {
  private terminal: Terminal | null = null
  private decorations: Map<string, ManagedDecoration> = new Map()
  private disposables: Array<{ dispose(): void }> = []

  /**
   * Attach to a terminal instance. Call once after terminal is created.
   */
  attach(terminal: Terminal): void {
    this.terminal = terminal
    dlog('[decoration-manager] attached')
  }

  /**
   * Create a marker at the current cursor position (normal buffer only).
   * Returns the marker ID for later reference, or null if in alt buffer.
   */
  addMarker(id: string, cursorYOffset = 0): IMarker | null {
    if (!this.terminal) return null
    const marker = this.terminal.registerMarker(cursorYOffset)
    if (!marker) return null

    this.decorations.set(id, {
      marker,
      decoration: undefined,
      disposed: false
    })

    marker.onDispose(() => {
      const entry = this.decorations.get(id)
      if (entry) entry.disposed = true
    })

    return marker
  }

  /**
   * Register a decoration anchored to an existing marker.
   * Returns the decoration or undefined if alt buffer is active.
   *
   * @param id - Unique ID matching a previously added marker
   * @param options - Partial decoration options (marker is auto-filled)
   * @param onRender - Callback when the decoration's DOM element is created/updated
   */
  addDecoration(
    id: string,
    options?: Partial<Omit<IDecorationOptions, 'marker'>>,
    onRender?: (element: HTMLElement) => void
  ): IDecoration | undefined {
    if (!this.terminal) return undefined
    const entry = this.decorations.get(id)
    if (!entry || entry.disposed) return undefined

    const decoration = this.terminal.registerDecoration({
      marker: entry.marker,
      ...options
    })

    if (decoration) {
      entry.decoration = decoration
      entry.onRenderCallback = onRender

      if (onRender) {
        const renderDisposable = decoration.onRender((element) => {
          onRender(element)
        })
        this.disposables.push(renderDisposable)
      }

      decoration.onDispose(() => {
        entry.decoration = undefined
      })
    } else {
      dlog('[decoration-manager] registerDecoration returned undefined (alt buffer active?)', id)
    }

    return decoration
  }

  /**
   * Remove a specific marker and its decoration by ID.
   */
  remove(id: string): void {
    const entry = this.decorations.get(id)
    if (!entry) return
    entry.decoration?.dispose()
    entry.marker.dispose()
    this.decorations.delete(id)
  }

  /**
   * Remove all managed decorations and markers.
   */
  removeAll(): void {
    for (const [id] of this.decorations) {
      this.remove(id)
    }
  }

  /**
   * Get a managed decoration entry by ID.
   */
  get(id: string): ManagedDecoration | undefined {
    return this.decorations.get(id)
  }

  /**
   * Check if any decorations are currently registered.
   */
  get count(): number {
    return this.decorations.size
  }

  /**
   * Full cleanup — call when terminal is disposed.
   */
  dispose(): void {
    this.removeAll()
    for (const d of this.disposables) d.dispose()
    this.disposables = []
    this.terminal = null
    dlog('[decoration-manager] disposed')
  }
}
```

**設計決策**：
- **不依賴 React** — 純 class，可在 useEffect 中透過 ref 使用
- **ID-based 管理** — 方便查找、移除特定 decoration
- **onRender callback** — 讓調用方在 DOM element 產生後自訂樣式/位置
- **Alt buffer 安全** — `addDecoration` 在 alt buffer 時 graceful 返回 undefined + 日誌
- **完整 lifecycle** — dispose 清理所有 marker/decoration/event subscription

**驗收**：
- [ ] `npx vite build` 通過
- [ ] 沒有 React import（純 TypeScript utility）
- [ ] Export class 和必要 types
- [ ] 程式碼 <150 行

### Phase 4：整合 DecorationManager 進 TerminalPanel（~30 min，中風險）

**檔案**：`src/components/TerminalPanel.tsx`

**Step 4.1 — import + ref**：

```tsx
import { TerminalDecorationManager } from '../utils/terminal-decoration-manager'

// 在 component 內（和 terminalRef 並列）
const decorationManagerRef = useRef<TerminalDecorationManager | null>(null)
```

**Step 4.2 — 初始化**：

在 terminal 初始化 useEffect 中（terminal 建立 + addon 載入後）：

```tsx
// Initialize decoration manager
const decorationManager = new TerminalDecorationManager()
decorationManager.attach(terminal)
decorationManagerRef.current = decorationManager
```

**Step 4.3 — cleanup**：

在 useEffect return cleanup 中：

```tsx
decorationManagerRef.current?.dispose()
decorationManagerRef.current = null
```

**Step 4.4 — 示範用法（command boundary marker）**：

在 onOutput listener 中，偵測 prompt 特徵（`$`、`>`、`#` 行尾）並註冊 marker。
**這是 opt-in 的示範**，用來證明 decoration pipeline 正常運作。

```tsx
// Optional: register marker on prompt detection (decoration infrastructure demo)
// Only in normal buffer — alt buffer returns null gracefully
if (!altBufferActive && filteredData) {
  const lines = filteredData.split('\n')
  const lastLine = lines[lines.length - 1]?.trim()
  if (lastLine && /[$>#]\s*$/.test(lastLine)) {
    const markerId = `prompt-${Date.now()}`
    const marker = decorationManager.addMarker(markerId)
    if (marker) {
      decorationManager.addDecoration(markerId, {
        anchor: 'left',
        width: 1,
        height: 1
      }, (element) => {
        element.style.background = 'rgba(255, 255, 255, 0.08)'
        element.style.width = '3px'
        element.style.borderRadius = '1px'
      })
    }
  }
}
```

**⚠️ 注意**：
- 這段是 **demo 用途**，證明 pipeline 正確。如果 prompt detection 太粗糙或產生太多 markers，可以直接刪掉這段只保留 manager 接線
- 設定 marker 上限（例如最多 100 個，超過時 dispose 最舊的）
- `altBufferActive` guard 防止 alt buffer 時嘗試 register

**Step 4.5 — 導出 decorationManagerRef（選做）**：

如果未來其他元件需要存取 decoration manager（例如 status line 顯示 marker 數量），可以透過 `forwardRef` 或 store 暴露。**目前不做**，過度設計。

**驗收**：
- [ ] `npx vite build` 通過
- [ ] 開 terminal 跑 `ls` 後，normal buffer 有 prompt marker（DevTools Elements 面板可看到 `.xterm-decoration` 元素）
- [ ] 進 `vim` 時 decoration 不報錯（alt buffer guard 正常）
- [ ] 退出 `vim` 後新的 prompt 仍能 register marker
- [ ] terminal 銷毀時 decoration manager 正確 dispose（看 debug log）

### Phase 5：綜合驗證（~15 min）

**BUG-008 驗證（Phase 1 效果）**：

| # | 場景 | 操作 | 預期 |
|---|------|------|------|
| 1 | Context menu + scroll | 右鍵 → mouse wheel 捲 | Context menu 消失 ✅ |
| 2 | Context menu + Ctrl+Wheel | 右鍵 → Ctrl+Wheel zoom | Context menu 消失（scroll 事件也觸發）|
| 3 | 無 context menu + scroll | 正常捲動 | 無 error、無 ghost |

**Alt buffer 驗證（Phase 2 效果）**：

| # | 場景 | 操作 | 預期（debug log）|
|---|------|------|------|
| 4 | 進 vim | `vim test.txt` | `[terminal] buffer changed: alt` |
| 5 | 退 vim | `:q!` | `[terminal] buffer changed: normal` |
| 6 | 進 less | `less README.md` | `[terminal] buffer changed: alt` |

**Decoration 驗證（Phase 3-4 效果）**：

| # | 場景 | 操作 | 預期 |
|---|------|------|------|
| 7 | 正常使用 | `ls` → 看 prompt | DevTools 可見 `.xterm-decoration` 元素 |
| 8 | Alt buffer | vim 中 | 無 decoration 報錯 |
| 9 | 回 normal | 退出 vim → `ls` | 新 prompt decoration 正常產生 |
| 10 | 大量 output | `seq 1 1000` | 無效能問題（marker 只在 prompt 時建立）|

### Git Commit 策略（4 commits，atomic）

**Phase 1**：
```
fix(terminal): dismiss context menu on terminal scroll (BUG-008)

Context menu used createPortal with position:fixed, staying at its
original coordinates when terminal content scrolled. Add scroll
listener on .xterm-viewport to dismiss the menu on scroll.

Closes: BUG-008
```

**Phase 2**：
```
feat(terminal): add alt buffer detection via onBufferChange

Subscribe to xterm buffer.onBufferChange to track whether the alt
screen buffer is active. Foundation for buffer-aware overlay and
decoration behavior.

Refs: T0032.5 VS Code reference (terminalInstance.ts:1264-1266)
```

**Phase 3**：
```
feat(terminal): add TerminalDecorationManager utility

New utility class wrapping xterm's marker/decoration API with
lifecycle management. Provides ID-based marker/decoration tracking,
onRender callbacks, alt buffer safety, and full cleanup on dispose.

Refs: T0032.5 VS Code decorationAddon.ts pattern
```

**Phase 4**：
```
feat(terminal): integrate decoration manager into TerminalPanel

Wire TerminalDecorationManager into terminal initialization lifecycle.
Add optional prompt detection markers as decoration pipeline demo.
Manager initializes on terminal create, disposes on terminal destroy.
```

**最後**：工單 commit
```
chore(workorder): T0033-A BUG-008 + decoration infrastructure closure
```

### 執行注意事項

- **Phase 1 最重要**：做完就 commit，確保 BUG-008 修法入庫
- **Phase 3 是新檔案**：放在 `src/utils/`，不是 `src/components/`
- **不要改 App.tsx**：本工單只改 TerminalPanel.tsx + 新增 utility
- **不要改 context menu 的 createPortal**：BUG-008 靠 scroll dismiss 解決，不需要改 portal 架構
- **Phase 4 的 prompt detection 是 demo**：若太粗糙造成問題，可以刪掉只保留 manager 接線，回報時說明
- **Alt buffer 限制記住**：`registerDecoration` 在 alt buffer 返回 `undefined`，不要 try-catch，用 if guard
- **Context Window**：Phase 3 結束後建議 checkpoint（可能已用 50-60%）
- **不要碰其他 bug**：BUG-010、BUG-011、UX-001 都已修好，不要回歸破壞

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態
DONE

### Phase 執行結果

| Phase | 狀態 | 說明 |
|-------|------|------|
| Phase 1（scroll dismiss）| ✅ DONE | `.xterm-viewport` scroll listener → setContextMenu(null)，passive:true |
| Phase 2（alt buffer detection）| ✅ DONE | `terminal.buffer.onBufferChange` 訂閱，同步更新 state + ref |
| Phase 3（DecorationManager）| ✅ DONE | 新建 `src/utils/terminal-decoration-manager.ts`，136 行 |
| Phase 4（TerminalPanel integration）| ✅ DONE | import + ref + 初始化 + prompt demo + cleanup |
| Phase 5（驗證）| ✅ DONE | 靜態驗證全通過，build 全程無 error |

### 修法 diff 摘要

**TerminalPanel.tsx 主要改動**：
- +1 import（TerminalDecorationManager）
- +1 ref（decorationManagerRef）
- +1 state（altBufferActive）+ 1 ref（altBufferRef）
- +10 行：scroll dismiss useEffect（Phase 1）
- +9 行：bufferChangeDisposable + altBufferRef 同步（Phase 2）
- +5 行：decorationManager 初始化（Phase 4）
- +21 行：prompt detection demo in onOutput（Phase 4）
- +3 行：cleanup（Phase 2 + Phase 4）

**總淨增加**：~50 行（從 589 → ~642 行）

### 新檔案清單
- `src/utils/terminal-decoration-manager.ts`（136 行）

### 驗證結果

| # | 場景 | 靜態分析結果 |
|---|------|------|
| 1 | Context menu + scroll | ✅ scroll listener 正確設置，passive:true |
| 2 | Context menu + Ctrl+Wheel | ✅ wheel handler 在 containerRef，scroll 事件也會觸發 dismiss |
| 3 | 無 context menu + scroll | ✅ useEffect 依賴 contextMenu，null 時 early return |
| 4 | 進 vim | ✅ onBufferChange 訂閱，log `buffer changed: alt` |
| 5 | 退 vim | ✅ 同上，log `buffer changed: normal` |
| 6 | 進 less | ✅ 同場景 4 邏輯 |
| 7 | 正常使用 ls → prompt | ✅ prompt regex `/[$>#]\s*$/` 偵測，addMarker + addDecoration |
| 8 | Alt buffer 中 | ✅ `altBufferRef.current` guard，不嘗試 register |
| 9 | 退出 vim 後 | ✅ altBufferRef 回到 false，新 prompt 可 register |
| 10 | 大量 output | ✅ PROMPT_MARKER_LIMIT=100 上限，避免無限堆積 |

**build 驗證**：每個 Phase 後均執行 `npx vite build`，全程通過。

### Decoration pipeline 狀態
**保留 prompt detection demo**。使用 `/[$>#]\s*$/` regex 在 output 中偵測 prompt 行尾字符，marker 上限 100 個。效果：在 normal buffer 下運行的每個新 prompt 附近會有 3px 半透明白色側邊標記。實際 DOM 元素（`.xterm-decoration`）須在 runtime 用 DevTools Elements 面板確認。

### Git 摘要
- Phase 1 commit SHA：`9d5deaa`
- Phase 2 commit SHA：`7a351ef`
- Phase 3 commit SHA：`abf4640`
- Phase 4 commit SHA：`115c2df`
- 工單 commit SHA：（本次 commit）
- `git status --short`：工單檔案未追蹤（本次 commit 前）

### 遭遇問題
1. **smart_outline 工具不支援 TSX** — 改用 bash sed 分段讀檔，無影響。
2. **altBufferActive state 閉包 stale** — 在 useEffect 閉包中 state 值不更新，改用額外的 `altBufferRef` 同步追蹤，正確解決。
3. **src/utils/ 目錄不存在** — 直接用 Write 工具建立新檔案時 Vite 自動處理路徑，無問題。

### sprint-status.yaml 已更新
不適用（專案未使用 sprint-status.yaml）

### 回報時間
2026-04-12 11:19 (UTC+8)
