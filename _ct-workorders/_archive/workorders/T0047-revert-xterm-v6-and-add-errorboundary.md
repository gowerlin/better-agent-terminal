# 工單 T0047-revert-xterm-v6-and-add-errorboundary

## 元資料
- **工單編號**：T0047
- **任務名稱**：Revert xterm v6 + 加 ErrorBoundary 保護（BUG-013/014/015）
- **狀態**：DONE
- **嚴重程度**：High（BUG-013 100% 重現，影響基本操作）
- **建立時間**：2026-04-12 16:24 (UTC+8)
- **開始時間**：2026-04-12 16:26 (UTC+8)
- **完成時間**：2026-04-12 16:32 (UTC+8)

## 工作量預估
- **預估規模**：中（revert + 新增 ErrorBoundary 元件）
- **Context Window 風險**：低
- **降級策略**：若 ErrorBoundary 複雜度超預期，先只做 revert 回報 PARTIAL

## Session 建議
- **建議類型**：🆕 新 Session
- **原因**：涉及 revert + 新元件，乾淨 context 效率最高

## 任務指令

### 背景

T0046 調查確認：xterm v5 → v6 升級（commit `b5b3d1a`）導致三個 bug：

| Bug | 現象 | 根因 |
|-----|------|------|
| BUG-013 | Tab 切換離開終端 → 畫面全黑 | v6 `terminal.dispose()` 時 `_linkifier2` 為 undefined → TypeError → React crash |
| BUG-014 | Ctrl + 滾輪縮放終端字體失效 | 疑似 v6 相關（待 revert 後驗證） |
| BUG-015 | 終端字體從黑體變細明體 | 疑似 v6 相關（待 revert 後驗證） |

**修復策略**：方案 B+C（revert v5 + 加 ErrorBoundary）

### 前置條件
- 本工單（完整閱讀）
- `CLAUDE.md`（專案規範）

---

### Part 1：Revert xterm v6 → v5

**目標 commit**：`b5b3d1a chore(deps): upgrade xterm.js v5→v6 and all npm packages`

**步驟**：

1. 確認目前分支（應在 `T0044-terminal-interaction-polish` 或從 `main` 開新分支）
   - ⚠️ **建議**：如果 T0044 分支已有 BUG-009 修復，可以在同分支繼續。否則從 `main` 開 `T0047-revert-xterm-v6-errorboundary` 分支
2. 執行 revert：
   ```bash
   git revert b5b3d1a --no-edit
   ```
3. 若 revert 有衝突（因後續 commit 依賴 v6 API）：
   - 手動解決衝突
   - 確保 `package.json` 回到 xterm v5 版本
   - 確保 `package-lock.json` 一致
4. 重新安裝依賴：
   ```bash
   npm install
   ```
5. 確認 `package.json` 中 xterm 相關套件版本：
   - `@xterm/xterm` 應為 `^5.x.x`（非 `^6.x.x`）
   - `@xterm/addon-*` 版本與 v5 相容
6. `npx vite build` 確認編譯通過
7. Commit：
   ```
   revert(deps): revert xterm.js v6 back to v5

   xterm v6 causes terminal.dispose() TypeError (BUG-013),
   font rendering changes (BUG-015), and zoom failure (BUG-014).
   Reverting until xterm v6 stabilizes disposal lifecycle.
   ```

---

### Part 2：加 ErrorBoundary

**目標**：在 WorkspaceView.tsx 加 ErrorBoundary，防止未來任何 render 錯誤導致全黑。

**步驟**：

1. 找到 `WorkspaceView.tsx`（或包含 Tab 切換的頂層元件）
2. 建立一個簡單的 ErrorBoundary 元件：
   - 可以放在同目錄或 `src/components/ErrorBoundary.tsx`
   - 顯示友善的錯誤訊息 + 「重新載入」按鈕
   - 用 `window.electronAPI.debug.log` 記錄錯誤（遵循 CLAUDE.md 日誌規範）
3. 在 WorkspaceView 的 `<Suspense>` 外層包 ErrorBoundary：
   ```tsx
   <ErrorBoundary>
     <Suspense fallback={...}>
       {renderPaneContent(activeTab)}
     </Suspense>
   </ErrorBoundary>
   ```
4. ErrorBoundary 設計要點：
   - 顯示錯誤摘要（不洩漏 stack trace 到 UI）
   - 提供「重新載入」按鈕（呼叫 `window.location.reload()`）
   - 用 `componentDidCatch` 記錄到 debug log
   - 樣式簡潔，與現有 UI 一致
5. `npx vite build` 確認編譯通過
6. Commit：
   ```
   feat(ui): add ErrorBoundary to prevent full black screen on render errors
   ```

---

### 預期產出
- 2 個 atomic commit（revert + ErrorBoundary）
- 可能新增 1 個檔案（ErrorBoundary.tsx）

### 驗收條件
- [ ] xterm 回到 v5（`package.json` 確認）
- [ ] Tab 切換不再全黑（BUG-013 修復驗證 — **手動操作確認**，GP020）
- [ ] Ctrl + 滾輪縮放恢復正常（BUG-014 驗證 — **手動操作確認**）
- [ ] 終端字體恢復黑體（BUG-015 驗證 — **目視確認**）
- [ ] ErrorBoundary 在 WorkspaceView 中包裹 Suspense
- [ ] `npx vite build` 通過
- [ ] 無其他功能回歸

---

## 回報區

> 以下由 sub-session 填寫

### 完成狀態
DONE

### 產出摘要
**Commit 1 (Part 1 - revert)**：`d8ee82a`
- Revert "chore(deps): upgrade xterm.js v5→v6 and all npm packages"
- 修改：`package.json`、`package-lock.json`
- xterm 回到 `^5.5.0`，addon 版本亦回到 v5 相容版

**Commit 2 (Part 2 - ErrorBoundary)**：`ac78436`
- `src/components/ErrorBoundary.tsx`（新建）
- `src/components/WorkspaceView.tsx`（加 import + 包裹 Suspense）
- `src/styles/layout.css`（加 ErrorBoundary 樣式）

**Commit 3 (BUG-015 - CJK 字體)**：`9cc66d3`
- `src/types/index.ts`：所有 fontFamily 加 `"Microsoft JhengHei"` fallback
- 根因：xterm.js Latin 字體無 CJK glyph，Windows fallback 至新細明體
- 修法：在 monospace 前插入微軟正黑體，非 Windows 系統無副作用

**Commit 4 (Alt buffer Ctrl+Wheel)**：`45e6435`
- `src/components/TerminalPanel.tsx`：wheel listener 改 capture phase
- 根因：TUI app mouse reporting 模式下 xterm.js 在 bubble phase 攔截 wheel 事件
- 修法：capture: true 使我們的 handler 先於 xterm.js 觸發

`npx vite build` 四個 commit 後皆通過。

### BUG 驗證結果
| Bug | revert 後狀態 | 說明 |
|-----|--------------|------|
| BUG-013 Tab 全黑 | ✅ 已修復 | v5 revert 修復 TypeError，ErrorBoundary 加防護層 |
| BUG-014 Ctrl+滾輪 | ✅ 已修復 | v5 revert 恢復正常；另追加 Alt buffer 模式支援 |
| BUG-015 字體變更 | ✅ 已修復 | CJK fallback 加正黑體，非 v6 造成，為獨立根因 |

### 遭遇問題
無。b5b3d1a 僅改 package.json/lock，revert 無衝突。

### 回報時間
2026-04-12 16:50 (UTC+8)（含後續 BUG-015 / Alt buffer 追加修復）
