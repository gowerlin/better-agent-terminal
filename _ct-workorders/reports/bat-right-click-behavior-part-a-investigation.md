# BAT Right-Click Behavior — Part A Investigation

## 研究問題
本調研聚焦以下三題：
1. BAT 如何決定「右鍵直接 paste」vs「顯示 React context menu」？
2. 這個決策是刻意設計，還是副作用？
3. 是否已有文件或註解解釋這個決策？

## 執行摘要（TL;DR）
- BAT 專案層（`src/` + `electron/`）沒有任何 `1049` / `100x` / `2004` escape sequence 判斷邏輯，**H1/H2/H3 在 BAT 層皆不成立**。
- `TerminalPanel` 的右鍵選單為固定事件路徑：`contextmenu` 一律 `setContextMenu(...)`，不依賴 alt buffer、mouse tracking、bracketed paste。
- xterm.js 內部確實會根據 `DECSET 1000/1002/1003/1006` 切換 mouse protocol，且會啟用/停用 selection；右鍵行為差異較可能在 **xterm + 第三方 CLI 模式切換**層發生。
- bracketed paste（`2004`）在 xterm.js 只影響 paste 內容是否包 `\x1b[200~...\x1b[201~`，不是右鍵選單切換器。
- Part B 建議優先追「第三方 CLI 輸出之 terminal mode 切換」與「xterm 事件流」交互，不要再假設 BAT 自己解析這些序列。

## 使用者原始觀察
使用者回報：在 BAT 內執行 Copilot CLI 時，右鍵會直接貼上；執行 Claude Code CLI 時，右鍵不會（出現不同互動）。  
本次只做 code reading + grep，不做 runtime 驗證。

## 4 假設驗證結果

### H1: Alt Screen Buffer
- 驗證方法：
  - `git grep -n '1049' -- src/`
  - `git grep -n 'altBuffer\|alternate.*screen\|screenBuffer' -- src/`
  - 補充掃描：`git grep -n '\?1049\|altBuffer\|alternate.*screen\|screenBuffer' -- src electron`
- 證據：
  - 上述 BAT 層查詢皆為 **no matches**。
  - xterm.js 內部有 `1049` 處理（非 BAT）：
    - `node_modules/@xterm/xterm/src/common/InputHandler.ts:1939-1945`
    - `node_modules/@xterm/xterm/src/common/InputHandler.ts:2164-2171`
- 結論：**不成立（BAT 層）**。BAT 沒有主動偵測 alt buffer 來切換右鍵路徑；`1049` 切 buffer 是 xterm 內部行為。

### H2: Mouse Tracking
- 驗證方法：
  - `git grep -n '1000\|1002\|1003\|1006\|1015' -- src/`（僅命中一般數字常數）
  - `git grep -n 'mouseEvents\|mouse.*tracking\|mouse.*mode' -- src/`
  - 補充精準掃描：`git grep -n '\?1000\|\?1002\|\?1003\|\?1006\|\?1015' -- src electron`
- 證據：
  - BAT 層沒有 mouse tracking mode 判斷邏輯（精準掃描為 **no matches**）。
  - xterm.js 內部會依 DECSET 切換協議：
    - `InputHandler.ts:1903-1913`（1000/1002/1003）
    - `InputHandler.ts:1924-1928`（1006/1015）
    - `Terminal.ts:721-733`（`onProtocolChange` 切 `enable-mouse-events` + disable/enable selection）
    - `Terminal.ts:773-784`（mouse events active 時送 mouse event）
- 結論：**不成立（BAT 自家邏輯）**；但**xterm 層存在強相關機制**，是更可能的差異來源。

### H3: Bracketed Paste
- 驗證方法：
  - `git grep -n '2004\|bracketedPaste\|bracketed.*paste' -- src/`
  - 補充精準掃描：`git grep -n '\?2004\|\x1b\[200~\|\x1b\[201~' -- src electron`
- 證據：
  - BAT 層查詢為 **no matches**。
  - xterm.js 內部：
    - `InputHandler.ts:1949-1950` / `2177-2178`（開關 `bracketedPasteMode`）
    - `Clipboard.ts:21-24`（包 `\x1b[200~...\x1b[201~`）
    - `Clipboard.ts:51-54`（paste 時套用 bracketed 邏輯）
- 結論：**不成立（針對「右鍵路徑切換」這個命題）**。2004 影響的是 paste payload 格式，不是右鍵要不要顯示 React 選單。

### H4: React Component State
- 驗證方法：
  - 直接讀 `src/components/TerminalPanel.tsx` 右鍵處理與 render。
- 證據：
  - `TerminalPanel.tsx:450-458`：`contextmenu` 事件一律 `setContextMenu(...)`。
  - `TerminalPanel.tsx:558-578`：`contextMenu` state 有值即 render React menu（portal）。
  - 全檔未出現 `altBuffer` / `mouse mode` / `2004` 等條件 gating。
- 結論：**不成立**。React 選單不是依 screen state 條件 mount，而是固定事件觸發模型。

## 綜合判讀
四個原假設若限定在「BAT 專案層是否主動做這些判斷」，目前證據指向 **H1/H2/H3/H4 全部不成立**。  
也就是：BAT 沒有自行解析 `1049` / `100x` / `2004` 來決定右鍵路徑，`TerminalPanel` 也沒有基於 terminal state 的條件渲染。

最有力的新方向是：差異出在 **xterm 內部 mouse protocol/selection 流程** + **第三方 CLI 在不同時機切換 terminal mode** 的組合副作用。  
這也對應到「同一 BAT 外殼，不同 CLI 呈現不同行為」的現象。

## 新發現（副產出）
- xterm 自己也註冊右鍵處理：
  - `node_modules/@xterm/xterm/src/browser/Terminal.ts:355-357`
  - `node_modules/@xterm/xterm/src/browser/Clipboard.ts:83-93`
- BAT 另外在 `TerminalPanel` 外層容器再掛一次 `contextmenu`（`TerminalPanel.tsx:450-458`），形成「xterm handler + BAT handler」雙層路徑，具備互動競態可能性。

## 對 Part B（第三方 CLI filter 策略）的輸入
Part B 應優先納入：
1. 第三方 CLI 是否輸出 `DECSET/DECRST 1000/1002/1003/1006`（以及切換頻率/時機）。
2. 模式切換時，xterm `onProtocolChange` 對 selection/contextmenu 體驗的實際影響。
3. 針對 BAT 自家右鍵處理與 xterm 原生右鍵處理的衝突面，評估是否需要單一路徑化（策略層，不在 Part A 執行）。

## 建議下一步
- 若 H1 成立：不適用（本次結論為不成立）。
- 若 H1 不成立：改以「xterm mode state + 第三方 CLI 輸出模式」為調研主軸，先做可重現矩陣（CLI × 畫面狀態 × mouse mode）。
- 無論結論如何，建議：Part B 增加最小侵入式事件/序列觀測方案（先觀測、後決策），避免在證據不足下直接改 BAT paste/contextmenu 邏輯。

## 引用的程式碼位置
| 檔案 | 行號 | 片段摘要 |
|------|------|---------|
| `src/components/TerminalPanel.tsx` | 450-458 | BAT 右鍵 `contextmenu` 一律 `setContextMenu(...)` |
| `src/components/TerminalPanel.tsx` | 558-578 | React context menu portal render 條件只依 `contextMenu` state |
| `node_modules/@xterm/xterm/src/common/InputHandler.ts` | 1939-1945 | `1049` 切換 alternate buffer（xterm 內部） |
| `node_modules/@xterm/xterm/src/common/InputHandler.ts` | 1903-1913 | `1000/1002/1003` 切換 mouse protocol |
| `node_modules/@xterm/xterm/src/browser/Terminal.ts` | 721-733 | `onProtocolChange` 切 class/selection enable 狀態 |
| `node_modules/@xterm/xterm/src/browser/Terminal.ts` | 773-784 | mouse events active 時把 mousedown 送進 mouse report |
| `node_modules/@xterm/xterm/src/common/InputHandler.ts` | 1949-1950, 2177-2178 | `2004` bracketed paste mode 開關 |
| `node_modules/@xterm/xterm/src/browser/Clipboard.ts` | 21-24, 51-54 | bracketed paste 只影響 paste payload 包裝 |
