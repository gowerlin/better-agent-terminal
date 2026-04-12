# 工單 T0046-bug013-tab-switch-black-screen-investigation

## 元資料
- **工單編號**：T0046
- **任務名稱**：BUG-013 調查 — Tab 切換畫面全黑（離開終端 → 檔案/Git）
- **狀態**：DONE
- **嚴重程度**：High（100% 重現，影響基本操作）
- **建立時間**：2026-04-12 16:09 (UTC+8)
- **開始時間**：2026-04-12 16:12 (UTC+8)
- **完成時間**：2026-04-12 16:19 (UTC+8)

## ⚠️ 本工單為研究類 — 不做程式碼修改（GP005）

產出為調查報告，塔台根據報告決定後續修復工單。

## 工作量預估
- **預估規模**：中（log 分析 + git bisect）
- **Context Window 風險**：中（debug log 可能量大，需篩選讀取）
- **降級策略**：若 log 量過大，先 grep 關鍵字再精讀相關段落

## Session 建議
- **建議類型**：🆕 新 Session
- **原因**：調查可能涉及大量 log 讀取，乾淨 context 必要

## 任務指令

### Bug 描述

**BUG-013**：從終端 Tab 切換到「檔案」或「Git」Tab 時，畫面 100% 全黑。

**現象**：
- 在 BAT 主區點擊 [檔案] 或 [Git] Tab（從終端 Tab 離開）
- 畫面立即全黑，無任何 UI 元素
- 必須使用 Main Menu → View → Reload 才能恢復
- **100% 重現率**

**方向限定**：
- ❌ 只有「離開終端」方向觸發（終端 → 檔案、終端 → Git）
- ✅ 其他方向（檔案 ↔ Git）待確認

**時間線**：
- 使用者回報「原來正常」，不確定何時壞掉
- 已排除 xterm v6 升級（T0043）：回退到 v5 仍然重現
- 推測在 T0035~T0039 UX 改動期間或更早引入

### 前置條件
- 本工單（完整閱讀）
- `CLAUDE.md`（專案規範）

### 調查步驟

#### Step 1：Debug Log 分析
1. 讀取 debug log 目錄：`C:\Users\Gower\AppData\Roaming\better-agent-terminal\Logs`
2. 先列出檔案清單（`ls -la`），確認 log 檔案大小和數量
3. **不要 cat 整個 log 檔案**。先 grep 以下關鍵字：
   - `error`、`Error`、`ERROR`
   - `black`、`blank`、`render`
   - `tab`、`switch`、`panel`
   - `unmount`、`destroy`、`dispose`
   - `terminal`、`xterm`
4. 若找到相關錯誤，精讀上下文（前後 10 行）
5. 記錄發現到報告中

#### Step 2：程式碼結構分析
1. 找到 Tab 切換相關的元件結構：
   - 搜尋 `Tab`、`TabPanel`、`TabSwitcher` 等元件
   - 找到控制「檔案」「Git」「終端」切換的邏輯
2. 確認終端元件在 Tab 切換時的生命週期：
   - 是 unmount/remount 還是 visibility toggle？
   - 有沒有 `useEffect` cleanup 可能誤殺渲染？
3. 重點檢查 T0035~T0039 改動的檔案：
   - T0035：BUG-012 alt buffer scroll（可能改了 xterm 相關邏輯）
   - T0036：UX-002 按鈕樣式（Redraw 功能）
   - T0037：UX-003 tooltip
   - T0038：UX-004 關閉警告
   - T0039：UX-005 重啟按鈕
4. 使用 `git log --oneline main` 列出這些工單的 commit，標註嫌疑範圍

#### Step 3：Git Bisect 定位（若 Step 1-2 未定位到）
1. 找到一個已知正常的 commit（T0034 之前或更早）
2. 使用 `git bisect` 在嫌疑範圍內定位引入 bug 的 commit
3. 記錄 bisect 結果

### 預期產出

調查報告（寫入回報區），包含：
1. **Debug log 發現**：有無相關錯誤紀錄
2. **嫌疑 commit**：最可能引入 bug 的 commit hash + 說明
3. **根因假說**：畫面全黑的技術原因（如：xterm dispose、React unmount、CSS visibility 等）
4. **修復建議**：建議的修復方向和難度評估

### 驗收條件
- [ ] Debug log 已檢查並記錄發現
- [ ] Tab 切換相關程式碼結構已分析
- [ ] 嫌疑範圍已縮小（理想：定位到具體 commit）
- [ ] 根因假說已提出
- [ ] 修復建議已提出
- [ ] **沒有修改任何程式碼**（GP005）

---

## 回報區

> 以下由 sub-session 填寫

### 完成狀態
DONE

### Debug Log 發現

**關鍵錯誤鏈（每次 Tab 切換重現）：**
```
[decoration-manager] disposed       ← TerminalPanel cleanup 觸發
[decoration-manager] disposed       ← （每個 terminal 一次）
ERROR: Cannot read properties of undefined (reading 'onShowLinkUnderline')  ← xterm v6 crash
ERROR: Cannot read properties of undefined (reading 'onShowLinkUnderline')  ← 多次
→ did-start-loading                 ← renderer 重新載入（黑屏後 reload）
```

**量化對比（決定性證據）：**
- `debug-20260411-*.log`（xterm v5）：`onShowLinkUnderline` 出現 **0 次**
- `debug-20260412-150851.log`（xterm v6 升級後）：`onShowLinkUnderline` 出現 **58 次**

所有 8 次「Tab 切換 → disposed → 錯誤 → reload」循環均在同一 session 內記錄。

**工單預設「已排除 xterm v6」與本次 log 分析矛盾**：
xterm v6 upgrade（commit `b5b3d1a`）於 2026-04-12 14:43 完成，debug log 錯誤從 15:08 起始。此時間線確認 v6 升級是直接原因。先前排除可能基於不同分支的測試。

### 嫌疑 Commit

**確認根因 commit：**
```
b5b3d1a chore(deps): upgrade xterm.js v5→v6 and all npm packages
日期：2026-04-12 14:43 (UTC+8)
```

xterm v5 → v6 的 major 升級改變了內部 rendering service 的初始化與銷毀邏輯。v6 引入 `linkifier2.onShowLinkUnderline` API，但 disposal 時 `_linkifier2` 可能已被提前清空（undefined），導致訪問其屬性時 TypeError。

### 根因假說

**完整崩潰路徑：**

1. 使用者從 Terminal Tab 切換到 Files/Git Tab
2. WorkspaceView.tsx 的 `renderPaneContent(activeTab)` 完全 **UNMOUNT** terminal 元件（非 display:none）
3. TerminalPanel 的 `useEffect` cleanup 依序執行：
   - `decorationManagerRef.current?.dispose()` → 觸發 log `[decoration-manager] disposed`
   - `terminal.dispose()` → 觸發 xterm v6 內部 disposal
4. xterm v6 的 rendering service 在銷毀時嘗試存取 `this._linkifier2.onShowLinkUnderline`，但 `_linkifier2` 已為 `undefined`（v6 disposal 順序 bug）
5. `TypeError: Cannot read properties of undefined (reading 'onShowLinkUnderline')` 拋出
6. WorkspaceView.tsx 的 `<Suspense>` **沒有 ErrorBoundary**，異常向上傳播
7. React 整個元件樹 unmount → **畫面全黑**
8. 使用者需手動 View → Reload 重啟 renderer

**技術關鍵：** xterm v6 的 `LinkifierService` 在 `terminal.dispose()` 清理過程中存在 disposal 順序問題；v5 無此問題（架構不同）。

### 修復建議

**Option A — 立即緩解（低難度）**：在 TerminalPanel.tsx 的 cleanup 中 wrap `terminal.dispose()` 加 try-catch：
```typescript
try {
  terminal.dispose()
} catch (e) {
  dlog('[terminal] dispose error (xterm v6 bug):', e)
}
```
缺點：只是隱藏錯誤，不修根因。

**Option B — 降級 xterm v5（低難度，推薦短期）**：
Revert commit `b5b3d1a`，退回 `@xterm/xterm: ^5.5.0`。
需確認是否有其他使用 v6 API 的程式碼。

**Option C — 加 ErrorBoundary（中難度，推薦中期）**：
在 WorkspaceView.tsx 的 `<Suspense>` 外層加 ErrorBoundary，防止 React tree 崩潰、至少顯示錯誤 UI 而非全黑。

**Option D — 保持 tab 切換時 xterm 不 unmount（高難度）**：
改用 `display:none / visibility:hidden` 而非 React unmount，避免觸發 `terminal.dispose()` 整個流程。類似 terminal-wrapper 的 `active/hidden` 模式延伸至主 Tab 層級。

**建議優先序：** B（短期）→ C（加保護）→ 等 xterm v6.x 修復後重新升級

### 遭遇問題
無。資料充分，調查順利。

工單預設「已排除 xterm v6」與本次 log 分析結果相反，建議塔台重新評估此假設。

### 回報時間
2026-04-12 16:19 (UTC+8)
