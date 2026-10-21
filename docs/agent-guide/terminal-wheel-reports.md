# Codex 分頁的滾輪回報（T0698 / BUG-165）

> CLAUDE.md「Codex 分頁的滾輪回報（T0698 / BUG-165）」節的完整說明。CLAUDE.md 該節保留用途、必守規則、唯一實作位置與本檔連結。

## 用途與原因

- 外部測試者A（macOS）回報：Claude CLI 分頁捲動順，Codex 分頁比較頓（BUG-165）。
- T0670 研究：codex 0.163 在 alt screen 開 `?1000h ?1002h ?1003h ?1006h` 自己接管滑鼠，每收到一個滾輪回報捲 `tui.mouse_scroll_speed` 行（預設 1）。xterm.js 5.5.0 在滑鼠追蹤模式下每個 `wheel` 事件**最多送 1 個**回報（`Terminal.bindMouse` 的 `sendEvent`：不論 `Viewport.getLinesScrolled` 算出幾行，只呼叫一次 `triggerMouseEvent`），觸控板高頻的 pixel delta 與慣性事件多出來的行數全部丟掉（實測 60 個 × 50 px 的快速滑動應捲 173 行，只送 60 個回報）。iTerm2 依累積行數送多個回報（每事件 ≤ 32）。
- 修正：條件成立時由 BAT 依累積行數送多個回報，xterm 不再送。

## 規則

- 🔴 **只在四個條件全部成立時接管**，其餘一律交回 xterm（handler 回 `true`），行為與 T0698 前**完全相同**：
  1. 分頁是 codex：`TerminalInstance.agentPreset === 'codex-cli'`（`isCodexTerminal`）。
  2. 目前在 alt buffer：`terminal.buffer.active.type === 'alternate'`。
  3. 程式開了會回報滾輪的滑鼠追蹤：`terminal.modes.mouseTrackingMode` 為 `vt200` / `drag` / `any`（`x10` 只回報按下，不算）。
  4. SGR 編碼（`?1006h`）：`mouseReportEncoding(terminal) === 'SGR'`（`SGR_PIXELS` / `DEFAULT` 不算）。
  另外 Shift 按住或 `deltaY === 0`（xterm 此時不捲、不送）、`.xterm-screen` 還沒有尺寸時，也交回 xterm。
- 🔴 回報與 xterm 5.5.0 產生的 SGR 滾輪回報**逐位元相同**，送出路徑也相同（`terminal.input(report, true)` = xterm 自己用的 `CoreService.triggerDataEvent(report, true)` → `onData` → `pty.write`），T0672 的 `MouseReportEchoDetector` 與 `MouseReportSelectionKeeper` 照樣看得到。每個回報各送一次 `input`（與 xterm 相同，`isSgrMouseReport` 一次只認一個回報）。
- 🔴 不改：xterm 版本、`smoothScrollDuration` / `scrollSensitivity`（T0670 不建議）、PTY 寫入的其他路徑；BAT 不注入 codex 的 `-c tui.*`。
- 不加 Settings 開關。

## 唯一實作

- 純函式 `src/lib/terminal-wheel-reports.ts`（不 import DOM / xterm / electron）：
  - `isCodexTerminal` / `shouldSendWheelReports`：條件判斷。
  - `mouseReportEncoding`：讀 xterm 目前的滑鼠編碼。公開 API 沒有這個欄位（`terminal.modes` 只有 protocol），所以讀 xterm 5.5.0 的 `_core.coreMouseService.activeEncoding`；結構不同（xterm 升版改了內部）時回 `undefined` → 條件 4 不成立 → 交回 xterm（功能關閉、不會亂送）。
  - `wheelLines`：delta → 行數（有正負、含小數）。
  - `WheelLineAccumulator`：累積小數餘量、上限。
  - `wheelReportCell`：游標所在的 cell（1 起算）。
  - `sgrWheelReport`：編碼。
  - `planWheelReports`：串起上面幾個，回傳這個事件要送的回報（`null` = 交回 xterm）。
- 接線：`TerminalPanel.tsx` 的 `terminal.attachCustomWheelEventHandler`（每個分頁一個 `WheelLineAccumulator`）。分頁的 `agentPreset` 每次事件從 `workspaceStore.getState()` 讀。

## 換算（對照 xterm 5.5.0 原始碼）

| 項目 | BAT | xterm 出處 |
|---|---|---|
| 靈敏度 | `deltaY × scrollSensitivity`；`fastScrollModifier`（預設 Alt）按住時再 × `fastScrollSensitivity` | `Viewport._applyScrollModifier` |
| `DOM_DELTA_PIXEL` | ÷ 列高（`.xterm-screen` 高 ÷ rows） | `Viewport.getLinesScrolled`（÷ `_currentRowHeight`） |
| `DOM_DELTA_LINE` | 行數照用 | 同上 |
| `DOM_DELTA_PAGE` | × rows | 同上 |
| Shift / 無垂直 delta | 0 行 → 交回 xterm | `getLinesScrolled` 回 0 → `sendEvent` 不送 |
| 方向 | `deltaY < 0` = 上（action 0），否則下（action 1） | `sendEvent` 的 `wheel` 分支 |
| 座標 | `.xterm-screen` 內的偏移（扣 padding），夾在 `[0, 寬 − 1]` / `[0, 高 − 1]`，÷ cell 寬高取整，+ 1 | `MouseService.getMouseReportCoords`、`CoreMouseService.triggerMouseEvent`（`e.col++` / `e.row++`） |
| 編碼 | `ESC [ < Pb ; col ; row M`，Pb = 64 \| 方向 \| Ctrl 16 \| Alt 8 | `CoreMouseService` 的 `eventCode` 與 `DEFAULT_ENCODINGS.SGR` |

- cell 寬高 = `.xterm-screen` 的 `getBoundingClientRect()` ÷ cols / rows；xterm 的 `css.cell` = `css.canvas` ÷ cols / rows，`.xterm-screen` 的尺寸就是 `css.canvas`（`CanvasRenderer` / `DomRenderer`），所以相同。
- 列高的小差異：xterm 換算 pixel 用 `device.cell.height / dpr`，BAT 用 `css.cell.height`（`css.canvas.height` 經 `Math.round`），差在小數以下，只影響何時累積滿一行。
- Shift 位元（4）不會出現：Shift 按住時 xterm 不捲、不送，BAT 交回 xterm。

## 累積與上限

- 每個事件把行數加進餘量，送 `trunc(累積)` 個回報，小數留到下一個事件。
- 方向改變時丟掉原本的餘量（反向立即反應；xterm 自己的 `_wheelPartialScroll` 是直接相加）。
- 單一事件超過 `MAX_WHEEL_REPORTS_PER_EVENT` = 8 行 → 只送 8 個，超過的行數與餘量都丟掉，避免慣性事件堆積。
- 條件由成立變不成立（或反過來）時清掉餘量，並記一次日誌。

## 日誌

- 只在接管狀態改變時記：`[wheel-reports] on|off terminal=<id> buffer=<normal|alternate> mode=<mouseTrackingMode> encoding=<DEFAULT|SGR|SGR_PIXELS|unknown>`。每個滾輪事件不記。

## 行為變化（使用者看得到的）

- macOS 觸控板：捲動行數接近 claude 分頁 / iTerm2（T0670 的 60 × 50 px 例：60 → 173 行）。
- Windows / Linux 滑鼠滾輪（推估，未實測）：Chromium 在 Windows 一格常見是 `DOM_DELTA_PIXEL` 約 100 px，列高約 17 px 時一格約 5 行（T0698 前 codex 一格 1 行），接近同一分頁 normal buffer 的捲動量。實際值隨平台與系統的捲動設定而不同，列在需實機驗證。使用者若嫌太快，可調 codex 的 `tui.mouse_scroll_speed`（BAT 不注入）。
- 先前建議的使用者端暫解 `mouse_scroll_speed = 3`，在 T0698 後會變成「每行 3 行」，可能過快，更版重點要提醒可以改回預設。

## 已知限制

- 只認使用者自己開的 Codex CLI 分頁（`agentPreset === 'codex-cli'`）。helper 派工的 codex Worker 分頁（`addExternalTerminal`）沒有存 `agentPreset`（`terminal:created-externally` 的 `agent` 沒進 store，BAT 重開後也沒有），維持 xterm 預設（T0698 Q-1，塔台決定）。不能直接把 `agent` 寫進 `agentPreset`：還原與 ⏻ 重啟會依 `agentPreset` 重打啟動命令。要涵蓋 Worker 需另開工單，在 `TerminalInstance` 加只供判斷用的欄位。
- 其他開了滑鼠追蹤的 TUI（claude fullscreen、vim、tmux）不受影響，仍是每事件 1 個回報。
- 依賴 xterm 5.5.0 的內部欄位 `_core.coreMouseService.activeEncoding`；升級 xterm 時要跑 `src/lib/__tests__/terminal-wheel-reports.test.ts`（以真的 xterm 實例檢查讀值與編碼），讀不到時功能自動關閉。
- 每事件上限 8（iTerm2 為 32）：極快的單一事件會少捲，T0670 實測觸控板單一事件很少超過數行。

## 驗證

- `src/lib/__tests__/terminal-wheel-reports.test.ts`：條件（每個不成立都交回）、pixel / line / page 換算、靈敏度與 fast-scroll、餘量累積、反向、上限 8、座標（含夾邊、padding）、修飾鍵、方向；以 jsdom 內真的 xterm 5.5.0 實例（寫入 codex 的 DECSET 後呼叫 `coreMouseService.triggerMouseEvent`）逐位元比對 BAT 的回報；T0670 的 60 × 50 px 例送 173 個。
- `src/__tests__/terminal-wheel-reports.test.tsx`：TerminalPanel 的 handler 回傳值、回報經 `terminal.input(…, true)` → `onData` → `pty.write`、各條件不成立時不送、離開 alt screen 時清餘量、日誌。
- e2e：T0698 未做（工單選做）。
- 需實機驗證：macOS 觸控板手感（外部測試者A）、Windows / Linux 滑鼠滾輪一格的行數、慣性尾段是否仍會過捲。
