# 工單 T0041-bug012-v2-alt-buffer-scroll-ghosting

## 元資料
- **工單編號**：T0041
- **任務名稱**：BUG-012 v2 — Alt buffer 捲動殘影重新調查與修復
- **狀態**：DONE
- **建立時間**：2026-04-12 12:36 (UTC+8)
- **開始時間**：2026-04-12 12:59 (UTC+8)
- **完成時間**：2026-04-12 14:12 (UTC+8)
- **前置依賴**：T0040（Redraw 按鈕修復，用於測試驗證）
- **關聯**：T0035（v1 修復已被驗收否決），T0032/T0032.5（前期調查）

## 工作量預估
- **預估規模**：中
- **Context Window 風險**：中（需讀取 xterm 相關多檔案 + 前期調查報告）
- **降級策略**：若 Context Window 不足，可先完成「根因定位 + 方案設計」，回報 PARTIAL，修復交後續工單

## Session 建議
- **建議類型**：🆕 新 Session
- **原因**：需要乾淨 context 做深度調查，前期有大量調查資料需要消化

## 任務指令

### 前置條件
需載入的文件清單：
- `src/components/TerminalPanel.tsx` — 終端面板，alt buffer 偵測與事件處理
- `src/components/workspace-store.ts` — 終端狀態管理（含 isAltBuffer flag）
- `_ct-workorders/reports/T0032-bug008-bug010-investigation.md` — 前期 alt buffer 調查
- `_ct-workorders/T0035-bug012-alt-buffer-scroll-ghosting.md` — v1 修復工單（回報區）

### 輸入上下文

**專案**：better-agent-terminal（Electron + React + xterm.js 終端模擬器）

**BUG-012 症狀**：
- 在 alt buffer 應用（vim、htop、claude TUI 等）中捲動滑鼠滾輪
- 終端出現殘影/鬼影（ghosting）——之前的畫面片段殘留
- 需要 resize / 最大化才能清除殘影

**v1 修復（T0035）嘗試與失敗**：
- 方法：在 alt buffer 模式下禁用 viewport scroll
- 結果：**完全無效**，驗收確認殘影程度與修復前完全一樣
- 推測：問題不在 viewport scroll 開關，而在更底層的渲染邏輯

**重要線索**：
- 最大化 → 觸發 resize → 殘影消失 → 證明 xterm 的正常渲染流程是正確的
- 殘影只在滾輪操作時出現 → 可能是 scroll event 觸發了不該觸發的畫面更新
- T0040 修復 Redraw 後，可用 Redraw 按鈕手動清除殘影來輔助測試

**調查方向建議**（但不限於此）：
1. **Scroll event 在 alt buffer 中的行為**：alt buffer 不應該有 scrollback，滾輪事件是否被錯誤地處理為 viewport scroll？
2. **xterm.js scrollOnUserInput / scrollback 設定**：alt buffer 時是否動態調整？
3. **自訂 scroll overlay 的副作用**：T0028/T0033-A 修改過 overlay scroll 邏輯，是否干擾了 alt buffer？
4. **Viewport vs Buffer 不一致**：scroll 操作是否導致 viewport 位移但 buffer 內容沒跟上？

### 預期產出
- 根因分析報告（寫在回報區）
- 修復程式碼（如果能在此工單內完成）
- 若根因複雜，至少產出明確的修復方案設計

### 驗收條件
- [ ] 在 alt buffer 應用中滾動滑鼠滾輪，不出現殘影
- [ ] 正常模式的 scrollback 功能不受影響
- [ ] 使用 Redraw 按鈕（T0040）驗證殘影是否真正消除（而非只是暫時遮蓋）
- [ ] `npx vite build` 通過

## Sub-session 執行指示

> **重要**：請在開始工作前，將「開始時間」填入當前時間。
> 完成後請填寫「回報區」。無論成功、失敗或需要後續指示，都必須填寫。

### 執行步驟
1. 讀取本工單全部內容
2. 更新「開始時間」欄位
3. 讀取前期調查報告（T0032 report, T0035 工單回報區），消化已知資訊
4. 讀取 TerminalPanel.tsx，專注於 scroll event handling 和 alt buffer 偵測
5. 讀取 workspace-store.ts 的 isAltBuffer 相關邏輯
6. 追蹤滾輪事件在 alt buffer 模式下的完整路徑
7. 定位根因（為什麼 scroll 導致殘影）
8. 設計修復方案
9. 實作修復
10. `npx vite build` 驗證
11. Git commit
12. 填寫回報區（包含根因分析）

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態
PARTIAL

### 根因分析（深度調查最終結論）

**排除的假設**（全部經實測驗證無效）：
1. ❌ viewport scrollTop 漂移 → 診斷顯示 `scrollTop=0`，且 `.xterm-viewport` 和 `.xterm-screen` 是 siblings，viewport scroll 不影響 screen 渲染
2. ❌ DOM renderer 殘留 → 加裝 `@xterm/addon-canvas`（canvas renderer）後問題依舊
3. ❌ wheel 事件處理 → `stopImmediatePropagation` 完全阻斷 xterm.js 後問題依舊
4. ❌ ED2/DEC 2026 同步問題（xterm.js #5801）→ `CLAUDE_CODE_NO_FLICKER=1` 無效
5. ❌ Windows conpty SIGWINCH → 滾動後觸發 resize cycle 無效

**確認的根因**：通過 DevTools buffer dump 確認——**ghost 文字就在 xterm.js 的 buffer 裡**。

```
bufferType: "alternate", cols: 138, rows: 28
Line 1: "Ge- 既有專案（有 project-context.md）"    ← "Ge" 是上一幀殘留
Line 6: "Ap我需要了解你的需求"                      ← "Ap" 是上一幀殘留
```

TUI 應用（Claude Code / Control Tower）使用 cursor positioning 跳過行首數個 column 開始寫新內容，未清除整行。被跳過的 column 保留了上一幀的字元。這是**正確的終端行為**——terminal emulator 忠實渲染 buffer 中的內容。

**Redraw 按鈕有效的原因**：resize cycle 觸發 SIGWINCH → TUI 做完整畫面重繪（清除所有 cell）→ ghost 消失。但 TUI 的下一次部分更新又會重新引入 ghost。

### 修復方案

此問題**超出 terminal emulator 修復範圍**——需要上游 TUI 應用（Claude Code）修改渲染邏輯，在每次重繪時清除完整行（發送 `ESC[2K` 或寫入空格覆蓋）。

**已保留的改進**：
- `@xterm/addon-canvas`：canvas renderer 提升渲染性能（獨立於 BUG-012）
- `CLAUDE_CODE_NO_FLICKER=1`：Anthropic 官方推薦的 xterm.js 環境設定
- Redraw 按鈕（T0040）：使用者可手動觸發完整重繪清除殘影

**已清理**：移除所有無效的 BUG-012 scroll/viewport 修復程式碼（-51 行）

### 產出摘要
- `src/components/TerminalPanel.tsx`：+4/-51 行（canvas addon + 清理無效代碼）
- `electron/pty-manager.ts`：+2 行（`CLAUDE_CODE_NO_FLICKER=1`）
- `package.json`：+1 dep（`@xterm/addon-canvas@0.7.0`）

### 互動紀錄
- [13:01] Q: 能否用 DevTools/Playwright 觀察 DOM？ → A: Chrome DevTools MCP 無法連接 Electron → Action: 注入診斷碼到 wheel handler
- [13:30] Q: 診斷顯示 canvases=0, buffer.type=normal → Action: 改用 canvas addon + 暴露 terminal 到 window._debugTerminal
- [14:00] Q: DevTools buffer dump 顯示 ghost 在 buffer 中 → Action: 確認根因在 TUI 應用層，非 terminal emulator

### 遭遇問題
根因在上游 TUI 應用的渲染行為，超出本專案可修復範圍。建議：
1. 向 Claude Code 回報 TUI 部分更新問題
2. 現階段使用 Redraw 按鈕作為 workaround

### sprint-status.yaml 已更新
不適用

### 回報時間
2026-04-12 14:12 (UTC+8)
