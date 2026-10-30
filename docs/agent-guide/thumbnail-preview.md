# 終端縮圖預覽（T0667 / T0714，BUG-136 / BUG-175）

> CLAUDE.md「終端縮圖預覽（T0667 / T0714，BUG-175）」節的完整說明。CLAUDE.md 該節保留用途、必守規則、唯一實作位置與本檔連結。

## 用途

縮圖列每個分頁的 `.thumbnail-preview` 顯示該分頁輸出的最後幾行。PTY 輸出在 `src/components/TerminalThumbnail.tsx` 以 150 ms 批次 flush：`appendPreviewInput` 累積，flush 時 `outputPreview(上一次的預覽 + 新的原始輸出)`。Claude 面板的訊息 / 串流走 `textPreview`（沒有 ANSI）。

## 歷史原因

- **T0667（BUG-136）**：codex 在 Linux / macOS PTY 以 `CSI row;col H` 重繪、幾乎不送 `\n`（T0666，WSL：145 KB 輸出、0 個 `\n`），預覽保留分頁全部輸出，每次 flush 對全部內容跑 stripAnsi、React 寫進一個 `white-space: pre` 文字節點。加上三個上限：`PREVIEW_INPUT_TAIL_CHARS` 16 Ki（stripAnsi 前的原始輸入）、`PREVIEW_LINES` 8、`PREVIEW_LINE_MAX_CHARS` 256。
- **T0714（BUG-175）**：有了上限，沒有 `\n` 的輸出仍然只是一條無限長的行，`capLine` 留的是開頭 256 字，所以預覽停在啟動畫面（外部測試者A macOS 截圖：shell 提示列、`>0q>4m`、`Claude Codev2.1.306`，之後不再更新）。另外 stripAnsi 的 CSI regex 只認 `[0-9;?]` 參數與英文字母結尾，`CSI > 0 q`（XTVERSION）、`CSI > 4 m`（modifyOtherKeys）被 `\x1b.` 只去掉 `\x1b[`，留下 `>0q>4m`。
  - T0714 實錄（WSL Ubuntu 24.04 的 `script`，claude 2.1.287，Linux PTY）：REPL 進 alt screen（`?1049h`）後**0 個 `\n`**，以 `\x1b[H` + `\r\x1b[nB`（相對下移）+ `\x1b[row;colH` 重繪，計時器 / 重試倒數只改寫一兩個字（`\x1b[H\r\x1b[81C\x1b[24B2`）。啟動送 `\x1b[>0q`。

## 規則

- 🔴 T0667 三個上限與 150 ms 批次 flush 不改；新增處理對輸入長度線性（regex 無巢狀量詞，一次掃描）。
- 🔴 不是終端模擬：不追蹤欄寬、不改寫已輸出的字、flush 之間不保留游標狀態；不用 headless xterm、不讀分頁的 xterm buffer、不碰 PTY 輸出與 `onData` 路徑。
- stripAnsi 以 ECMA-48 完整語法移除 CSI：`\x1b[`、參數位元組 0x30–0x3F（`0-9 : ; < = > ?`）、中間位元組 0x20–0x2F、結束位元組 0x40–0x7E。
- `markScreenMoves`（stripAnsi 之前）掃一次原始輸入，追蹤列與欄（每次 flush 都從未知開始），留下三種標記（Unicode noncharacter U+FDD0–U+FDD2，輸出本身不會有）：

| 標記 | 何時 | flush 時的處理（`applyScreenMoves`） |
|---|---|---|
| `SOFT_BREAK` | 游標換到另一列（`CUP` / `HVP` / `VPA` / `CUU` / `CUD` / `CNL` / `CPL` / `ESC D` / `ESC E` / `ESC M`）之後第一段**看得到**的文字前 | 開新的一行（目前這行已是空的則不加） |
| `UPDATE_IN_PLACE` | 同上，但那段文字從第 2 欄以後開始、看得到的字少於 `IN_PLACE_UPDATE_MAX_CHARS`（8） | 丟掉到下一個標記或 `\n` 為止的文字（原地更新的計時器、計數、spinner，否則每跳一下就多一行） |
| `SCREEN_RESET` | `CSI 2 J`、`CSI ? 1049 / 1047 / 47 h` 或 `l` | 預覽從最後一個之後重新開始 |

- 換列後沒有寫字、只寫空白 / 框線（會被濾掉的字）、或接著就是 `\n`：不加行。所以只用 `\n` 換列的輸出（一般 shell）結果與修正前相同。
- 同一列（已知列號）的 `CUP` 不換行。**列號未知時**（每次 flush 的開頭）`CSI row;col H` 且欄 > 1：視為同一列內跳欄、不換行（ConPTY 重畫 PSReadLine 提示列就是這樣：`PS C:\Users\demo>\x1b[1C\x1b[30;19H> for …`），與修正前相同；欄 = 1 則換行。
- `ESC 8`（DECRC）只把列、欄設成未知，不換行。
- `textPreview`（Claude 面板）不受影響：只有 PTY 輸出走 `markScreenMoves`。

## 唯一實作

- `src/lib/thumbnail-preview.ts`：`stripAnsi`、`markScreenMoves`、`applyScreenMoves`、`outputPreview`、`IN_PLACE_UPDATE_MAX_CHARS`。不 import electron / DOM。
- 呼叫端 `src/components/TerminalThumbnail.tsx`（T0714 未改）。

## 行為變化（Windows ConPTY）

ConPTY 以 `CSI row;1 H` 跳過空白列時（cmd 啟動訊息後、`dir` 的「目錄:」與表頭之間），修正前兩列被黏成一行（`… 權利。C:\Users\demo>`），修正後分成兩行，與實際畫面相同。其餘 ConPTY 輸出結果不變。

T0714 以 node-pty（ConPTY）實錄 pwsh / cmd，逐 chunk flush，與修正前比較，並以 xterm 實例算出的實際畫面為基準（預覽每行出現在畫面某列的比例 / 畫面最後一列有沒有出現在預覽）：

| 錄製 | flush 數 | 結果與修正前不同 | 修正前 | 修正後 |
|---|---|---|---|---|
| pwsh：指令一次寫入（`dir`、40 行輸出、`Write-Progress`、`cls`） | 3638 | 0 | 67.9% / 68.1% | 67.9% / 68.1% |
| pwsh：逐字輸入（PSReadLine 預測） | 373 | 172（全是被黏住的列分開） | 54.1% / 21.4% | 56.8% / 21.4% |
| cmd：逐字輸入 | 194 | 192（同上，啟動訊息後的提示列） | 38.2% / 100% | 100% / 100% |
| claude 2.1.287 REPL（Linux PTY，依畫面更新切塊） | 56 | — | 0% / 3.6% | 51.2% / 87.5% |

ConPTY 錄製的 chunk 沒有一個停在跳脫序列中間（pwsh 3638 / 373、cmd 194 個 chunk 都是 0）。

## 已知限制

- 原地更新的判斷只看第一段文字的起始欄與長度：從第 2 欄以後寫入、少於 8 個字的新內容（例如很短的縮排行）會被丟掉；8 個字以上的原地更新（例如 `… · Retrying in 10`）會變成一行。
- 跨 flush 不保留游標：flush 開頭的第一個絕對移動列號未知；列號未知、欄 > 1 的 `CUP` 不換行，所以 codex 這類 diff 輸出在 flush 開頭的那一段可能接在上一行後面（上一行仍以前 256 字為準）。
- 不量欄寬：全形字、組合字只影響原地更新的判斷，不影響文字內容。
- 跳脫序列被切在兩次 flush 之間時（Linux PTY 讀取恰好切在序列中間，且 flush 恰好在那時），後半段會變成文字（T0714 之前就是如此，未改）。
- 預覽是「最近寫出的列」，不是畫面最下面幾列：全螢幕 TUI 的最後幾行通常是輸入框、狀態列等固定區域。

## 驗證清單

- `src/lib/__tests__/thumbnail-preview.test.ts`：BUG-175 兩個原因（以修正前的實作重現：停在啟動畫面、`>0q>4m`）、各標記規則、claude 形態的 session（transcript 行、原地計時器）、codex 形態畫面的每個切點、1 MiB 無 `\n` 輸入的耗時上限、ConPTY 樣本與修正前相同、ConPTY 跳列的行為變化。
- `src/components/__tests__/terminal-thumbnail-preview.test.tsx`：經 TerminalThumbnail 的 150 ms flush，claude 形態輸出跟著最新行更新、沒有 `>0q`。
- 實機：macOS / Linux 上開 claude / codex Worker，縮圖跟著對話更新、沒有 `>0q>4m`；Windows 上 pwsh / cmd 分頁的縮圖與修正前相同（除了上表的跳列）。
