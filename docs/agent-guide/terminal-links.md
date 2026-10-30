# 終端連結：`file:///` 範圍與 OSC 8（T0713 / BUG-174）

> CLAUDE.md「終端連結：`file:///` 範圍與 OSC 8（T0713 / BUG-174）」節的完整說明。CLAUDE.md 該節保留用途、必守規則、唯一實作位置與本檔連結。

## 用途與原因

GitHub issue #20（BAT 0.7.1-pre.9，macOS；Claude Code 在 BAT 分頁印出 `file:///` 連結）回報三件事：

1. **全形字**：路徑含全形字時，底線比網址短，少的格數 = 網址裡的全形字數，尾端點不到；網址前面有全形字時起點也偏移。原因：舊的 link provider 用 `line.translateToString()` 的**字串索引**當**格子欄位**（全形字佔 2 格、字串只佔 1 個字元）。
2. **跨行**：被換行的長路徑不再是連結。原因：只讀單一列，沒有串接 `isWrapped` 的續行。
3. **OSC 8**：Claude Code 把 Markdown 連結 `[text](file:///...)` 輸出成 OSC 8 超連結，點了沒反應。原因：`new Terminal({...})` 沒有 `linkHandler`，xterm 5.5 的 `OscLinkProvider` 在沒有 `linkHandler.allowNonHttpProtocols` 時直接丟掉非 http(s) 的 OSC 8 連結（http(s) 的則走 xterm 預設的 `confirm()` + `window.open`）。

## 規則

- 🔴 範圍一律以**格子欄位**計算：逐格讀 `line.getCell(x)` 的 `getChars()` / `getWidth()`，建「字串的每個 code unit → (列, 格, 寬度)」對照；寬度 0 的格子是寬字的後半，跳過；空格子當成空白。終點是含括的 1-based 欄位，寬字取它的第二格。
- 🔴 跨行：從被查詢的列往上（本列 `isWrapped` 時）、往下（下一列 `isWrapped` 時）串接，各最多 `MAX_WRAPPED_ROWS` = 20 列；整段文字跑一次比對，range 的 start / end 可在不同列。只回傳**碰到被查詢那一列**的連結（xterm 的 `_removeIntersectingLinks` 以被查詢的列計算佔用格，回傳別列的連結會誤刪）。從連結經過的任一列查詢都得到同一個 range。
- 寬字提早換行：寬字放不進一列最後一格時，xterm 讓那一格空著（`chars = ''`、寬度 1），寬字放到下一列第一格。這一格不算進文字，否則網址會在這裡斷掉（作法與 `@xterm/addon-web-links` 的 `_mapStrIdx` 修正相同）。
- 🔴 行為不變：純文字比對 regex 仍是 `/file:\/\/\/[^\s'"\])}>,;`]+/g`（`FILE_URL_REGEX`）、點擊即開（不需修飾鍵）、經 `window.electronAPI.shell.openExternal`；純 ASCII 單列的結果與修正前相同（測試逐案比對舊演算法）。`WebLinksAddon` 的 http(s) 連結不改。
- 🔴 OSC 8：`linkHandler`（`createOsc8LinkHandler`）設 `allowNonHttpProtocols: true` 讓 `file:` 通過 xterm 的過濾，真正的判斷在 `activate`：只開 `http:` / `https:` / `file:`（`OSC8_ALLOWED_PROTOCOLS`，原始字串也必須以該 scheme 開頭，同主行程 `isAllowedExternalUrl`）；其他 scheme（`javascript:`、`vbscript:`、`mailto:`、`data:`、自訂協定、解析失敗）不開，記 debug log `[terminal-links] refused OSC 8 link scheme=<scheme> length=<n>`，🔴 不記完整 URI。
- 🔴 OSC 8 的顯示文字可以和實際目標不同：滑過時以 tooltip 顯示實際目標（超過 `LINK_HOVER_MAX_CHARS` = 200 字元時保留頭尾、中間 `…`），以 `textContent` 寫入（不解析 HTML）。不加確認對話框。
- 主行程 `shell:open-external`（`electron/open-external-guard.ts` `handleOpenExternal`）照舊：`file:` 走 `openPath`（不存在 → 通知、可執行檔 → 先確認），其他只放行 `http:` / `https:` / `mailto:`。renderer 的 OSC 8 檢查比它嚴（不放 `mailto:`），沒有放寬主行程。
- 🔴 不改 xterm 版本、不加依賴、不碰 PTY 輸出與 `onData` 路徑（T0672 `MouseReportEchoDetector` / T0698 滾輪回報不受影響）。

## 唯一實作

- `src/lib/terminal-file-links.ts`（只用 xterm 的公開型別，不 import electron）：
  - `findFileLinks(buffer, bufferLineNumber)`：純文字 `file:///` 連結的 range（內部 `wrappedRunText` 串接續行、建對照）。
  - `createOsc8LinkHandler(deps)`：`ILinkHandler`；`isAllowedOsc8Uri` / `uriScheme` / `truncateLinkTarget`。
  - `createLinkHoverTooltip(host)`：tooltip DOM，放在 `terminal.element` 內、class `xterm-hover terminal-link-hover`（`xterm-hover` 讓滑鼠事件不落到終端，xterm `ILinkHandler.hover` 的約定），超出終端時往上 / 往左移。樣式在 `src/styles/panels.css` `.terminal-panel .terminal-link-hover`。
- 接線：`src/components/TerminalPanel.tsx` 的 `new Terminal({ ..., linkHandler })` 與 `terminal.registerLinkProvider`（只把 `findFileLinks` 的結果加上 `activate`）；分頁卸載時 `linkHover.dispose()`。

## WebLinksAddon（http / https）的檢查結果

`@xterm/addon-web-links` 0.11.0 的 `LinkComputer` 本來就串接 `isWrapped` 續行（上限 2048 字元、遇到含空白的列停），並以 `_mapStrIdx` 逐格換算欄位、處理寬字提早換行。T0713 以真 xterm 實例確認：網址前與網址內有全形字時 range 正確；跨 3 列的網址從每一列查詢都得到同一個 range。不需修改（`src/lib/__tests__/terminal-file-links.test.ts` 的 `WebLinksAddon http(s)` 區塊留作回歸）。

## 已知限制

- 往上 / 往下各只串 20 列：從距離網址開頭超過 20 列的位置查詢時，串到的文字裡沒有 `file:///`，那幾列不是連結；從前 20 列查詢時 range 的終點最多到「被查詢列 + 20」。一般路徑遠低於這個長度。
- 純文字比對沿用舊 regex：路徑含空白、`'`、`"`、`]`、`)`、`}`、`>`、`,`、`;`、`` ` `` 時在該字元結束（舊行為）。
- OSC 8 跨行：xterm 5.5 的 `OscLinkProvider` 逐列產生連結（同一個 OSC 8 連結在每一列各是一個 range），每一列都可點、滑過都顯示同一個目標；底線只畫滑鼠所在那一列（xterm 原始碼的 TODO）。
- 遠端工作區（WSL / SSH / Docker）：`file://` 指向遠端主機的路徑，`shell:open-external` 在本機以 `openPath` 開，檔案不存在時顯示找不到（既有限制，T0713 不處理）。

## 驗證清單

- `npx vitest run src/lib/__tests__/terminal-file-links.test.ts`：真 xterm 5.5.0 + Unicode 11 寬度（同 TerminalPanel）。
  - issue 範例路徑（10 個全形字）整段 range、尾端格子正確；舊演算法少 10 格的對照。
  - 網址前有全形字、網址以全形字結尾、同一行兩個連結、emoji / 組合字元。
  - 純 ASCII 多個案例與舊演算法逐一相同。
  - 跨 3 列的長路徑（從每一列查得到同一 range）、寬字提早換行、只回傳碰到該列的連結、20 列上限。
  - OSC 8：http / https / file 呼叫 `openExternal`；`javascript:` 等不呼叫、log 只含 scheme 與長度；hover / leave；經 xterm 真的 `OscLinkProvider`（顯示文字 `README`、目標 `file:///…`）；沒有 `linkHandler` 時 file 連結被丟掉的對照；tooltip DOM。
  - `WebLinksAddon` http(s)：全形字、跨行。
- 實機：在 BAT 分頁 `printf` 含全形字的 `file:///` 路徑（窄視窗讓它換行）、Claude Code 輸出 Markdown 檔案連結（OSC 8），滑過看底線 / tooltip、點擊開檔。
