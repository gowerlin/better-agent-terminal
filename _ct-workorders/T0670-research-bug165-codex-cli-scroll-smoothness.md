---
schema_version: 1
schema_kind: workorder
id: T0670
title: "研究：BUG-165 — macOS Codex CLI 分頁內捲動不夠順，BAT 端可改善的因素（唯讀）"
type: research
status: DONE
repo: better-agent-terminal
project: BUG-165
priority: P3
sizing: S
created_at: "2026-10-19T15:42:53+0800"
started_at: "2026-10-19T15:44:00+08:00"
updated_at: "2026-10-19T16:04:14+0800"
completed_at: "2026-10-19T16:04:14+0800"
depends_on: []
related:
  - "BUG-165（OPEN；Gary 回報）"
  - "BUG-136（CLOSED；T0666 研究：Codex alt screen 輸出特性、WSL 原生 PTY 擷取方法）"
  - "BUG-164 / T0669（macOS 預設 `--disable-skia-graphite`）"
affects_files:
  - _ct-workorders/T0670-research-bug165-codex-cli-scroll-smoothness.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
research_max_questions: 3
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 研究單、**唯讀**：不改任何產品檔、不改 BUG-165 / 其他工單 / 塔台狀態檔；只 commit 本工單檔（`git commit --only`）。不 push。"
  - "🔴 yolo Worker：不得問使用者。要不要修、怎麼修是**使用者決定**，你只提推薦；判讀問題依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。需要 Gary 做的事寫成「給 Gary 的問題 / 測試」清單。"
  - "🔴 不得在任何地方寫出權杖值。"
---

# T0670 — 研究：BUG-165 Codex CLI 分頁內捲動順暢度

## 研究目標

Gary（macOS，`v0.7.1-pre.3`）回報：在 Codex CLI 分頁內捲動「可以滾，但希望更絲滑」。找出從「滾輪 / 觸控板事件」到「畫面更新」整條路徑上，**BAT 端**影響順暢度的因素，區分哪些 BAT 能改、哪些取決於 codex 本身，給出可決策的建議。

## 已知資訊

- 先讀 `BUG-165-macos-codex-cli-scroll-not-smooth.md`、`BUG-136-…`（`## 第三輪` 與結案段）、`BUG-164-…`（Graphite 停用）。
- Gary 的 Codex 分頁在 alt screen（T0666 日誌 `buffer changed: alt`）。alt screen 沒有 xterm scrollback：捲動要嘛是 xterm 把滾輪轉成按鍵 / 滑鼠回報送給 codex、由 codex 重繪整個畫面，要嘛 codex 開了滑鼠追蹤自己處理。
- 尚未知道：觸控板或滑鼠、在 Terminal.app / iTerm2 是否一樣（已另請 Gary 回答）。

## 調查範圍

1. **路徑盤點**（原始碼，唯讀）：`src/components/TerminalPanel.tsx` 的 xterm 選項（`smoothScrollDuration`、`scrollSensitivity`、`fastScrollSensitivity`、`fastScrollModifier`、`scrollback`、`altClickMovesCursor` 等）、CanvasAddon、BAT 自己掛的 wheel / scroll handler、`attachCustomWheelEventHandler`、`src/lib/terminal-context-menu.ts` 的滑鼠追蹤相關邏輯；renderer 對每筆 PTY 輸出的處理（T0667 後是否還有隨輸出量成長的成本）。
2. **codex 行為**：目前 codex 版本在 alt screen 下如何接收捲動（滑鼠追蹤模式？`?1007` alternate scroll？方向鍵？）、每次捲動送出多少輸出（可沿用 T0666 的 WSL 原生 PTY 擷取方法量測位元組數 / 每次捲動的重繪量）。
3. **觸控板高頻 wheel 事件**：macOS 觸控板的 pixel-delta 事件在 xterm 如何被轉成行數 / 回報次數；是否會一次送出大量回報導致 codex 連續重繪、跳動。
4. **與其他終端比較**（文件 / 原始碼層級即可）：iTerm2 / Terminal.app 對 alt screen 捲動的處理差異（例如是否合併事件）。
5. **建議**：BAT 端可做的改善（S / M、風險、不得退化的既有行為：BUG-142 右鍵選單與滑鼠追蹤、T0571 Shift 拖曳選取、Win11 `clearTextureAtlas`），以及給 Gary 的最小確認測試（≤ 3 項）。

6. **平台範圍**（塔台 2026-10-19 15:44 追加，使用者指示）：判斷「Codex CLI 捲動不順」**是否只在 macOS 發生**。在本機 Windows（ConPTY）與 WSL（原生 PTY）實際開 Codex CLI 分頁捲動比較，並從原始碼找出有平台分支的捲動 / 滾輪 / 繪圖路徑（例如 macOS 觸控板 pixel-delta、`--disable-skia-graphite` 只在 darwin）。結論寫成「macOS 專屬 / 跨平台 / 無法判定」並附依據；macOS 本機無法驗證的部分列進「給 Gary 的問題 / 測試」。

## 研究指引

- 結論每條標「原始碼 / 實測 / 推論」，不轉述未證實的根因。
- Windows 的 ConPTY 行為與 macOS 不同（T0666 經驗），macOS 專屬現象改用 WSL 原生 PTY 擷取。

## 互動規則

- yolo、`--no-interactive`：不問使用者；判讀問題問塔台（每輪 ≤ 3 題）。
- 需要 Gary 回答的事寫進回報區「給 Gary 的問題 / 測試」。

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

**DONE**（研究單，唯讀；只改本工單檔）。

落點檢查：**PASS**。C-0 `repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal`；C-1 工單在 REPO_ROOT 下；C-3 不適用（`affects_files` 只有本工單）；C-2 無 `branch` 欄位。`CT_HOME` 未設（非 worktree）。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）。

一句話結論：codex 0.163 在 alt screen 下**自己接管滑鼠**（`?1000h ?1002h ?1003h ?1006h`、`?1007l`），每收到一個滾輪回報就固定捲 `tui.mouse_scroll_speed` 行（預設 1.0），並重繪整個畫面。BAT 用的 xterm.js 5.5 在滑鼠追蹤模式下**每個 wheel 事件最多只送 1 個回報**，不管這個事件代表幾行。所以觸控板快速滑動時，手指移動 173 行的距離只送出 60 個回報（實測）：捲動速度被事件頻率卡住、和手指速度不成比例，慣性尾段也被截短。iTerm2 預設依累積行數送多個回報（每事件最多 32 個，原始碼）。這是 BAT 端能改、證據最完整的一項。平台判定：**跨平台**（機制在 xterm.js 與 codex，兩者都沒有平台分支）；預期在 macOS 觸控板上最明顯（推論，待 Gary 確認）。

### 互動紀錄

- 沒有問塔台（判讀問題都能用原始碼與實測回答）。沒有問使用者。
- [15:56] 塔台追加範圍：工單「調查範圍」第 6 項（平台範圍）→ Action：重讀工單，已併入本單（見 §6）。

### 調查結論

標記：【原始碼】= 本 repo `main`（`2326ee1a`）、`node_modules` 內的 xterm 5.5.0、codex `rust-v0.163.0`、iTerm2 `master`（`ec4517e6b0`）；【實測】= 本次在 Windows 機器上（Windows ConPTY、WSL Ubuntu 24.04 原生 PTY、repo 內的 Electron 41.2.1）的量測；【推論】= 尚未證實。

#### 1. BAT 端路徑盤點

| 項目 | 位置 | 和 Codex 捲動的關係 |
|---|---|---|
| xterm 選項 | `src/components/TerminalPanel.tsx` `new Terminal({...})` | 【原始碼】只設 `scrollback: 10000`、`allowProposedApi`、`allowTransparency`、字型與顏色。`smoothScrollDuration` / `scrollSensitivity` / `fastScrollSensitivity` / `fastScrollModifier` / `altClickMovesCursor` 都是預設值。 |
| `smoothScrollDuration` | xterm `Viewport.handleWheel` | 【原始碼】只作用在 normal buffer 的 viewport 捲動。Codex 在 alt screen 且開了滑鼠追蹤，**這個選項對它沒有效果**。 |
| `scrollSensitivity` | xterm `Viewport.getLinesScrolled` | 【原始碼】會乘在 delta 上，但滑鼠追蹤模式仍是每事件最多 1 個回報（見 §3）。調高只會讓慢速滑動更快跨過一行，也會讓一般 shell 的捲動變快，不建議。 |
| BAT 自己的 wheel listener | `TerminalPanel.tsx` `handleWheel`（Ctrl+滾輪縮放，capture、非 passive）、`forgetKeptSelection`（T0571，capture、passive） | 【原始碼】沒按 Ctrl 時 `handleWheel` 直接返回；`forgetKeptSelection` 只清幾個欄位（`SelectionKeeper.forget`）。成本可忽略。 |
| `attachCustomWheelEventHandler` | — | 【原始碼】BAT 沒有使用。 |
| `terminal-context-menu.ts` 的滑鼠追蹤邏輯 | `shouldShowTerminalContextMenu`、`MouseReportSelectionKeeper` | 【原始碼】只處理右鍵選單、Esc、Shift 拖曳選取，不碰 wheel。 |
| 輸入路徑 | xterm `onData` → `pty.write`（IPC）→ main `pty:write` →（Terminal Server socket）→ PTY | 【原始碼】每個回報一次 IPC，成本小。滑鼠回報被 `isTerminalAutoReply` 排除，不算使用者輸入。 |
| 輸出路徑 | PTY →（Terminal Server `broadcastToAll`，不批次）→ main `enqueuePtyOutput` → **`setTimeout(16)` 批次**（`PtyManager.BATCH_INTERVAL_MS`）→ IPC `pty:output` → renderer `PtyOutputReplayer` → `filterTerminalOutputNoise` → `terminal.write` → 下一個 rAF 由 CanvasAddon 繪製 | 【原始碼】main 的 16 ms 計時器從第一筆輸出開始算，不和畫面更新（vsync）對齊。 |
| renderer 對每筆輸出的其他處理 | `App.tsx` `updateTerminalActivity`（每 2 s 最多一次 `notify()` → App 整樹 re-render）、`TerminalThumbnail` 預覽（150 ms 批次，T0667 後上限 2055 字元）、prompt marker（只在 normal buffer） | 【原始碼】T0667 後沒有隨輸出總量成長的成本。【推論】捲動時一直有輸出，App 每 2 s 會整樹 re-render 一次，可能造成週期性的小卡頓；沒有量測，權重低。 |

#### 2. codex 的行為（實測 + 原始碼）

- 【實測】codex-cli 0.163.0 Linux 版（WSL 原生 PTY，官方 release 二進位）啟動時送出 `?1049h ?1000h ?1002h ?1003h ?1006h`，並送 `?1007l`（關閉 alternate scroll）。0.160.0 相同。Windows 版透過 ConPTY，ConPTY 對終端送出 `?1003;1006h`。⇒ **三個環境的 codex 都自己處理滑鼠**，xterm 收到滾輪時送的是 SGR 滑鼠回報（`CSI < 64/65 ; x ; y M`），不是方向鍵。
- 【原始碼】codex `rust-v0.163.0` `codex-rs/tui/src/transcript_view/input.rs`：每個 `ScrollUp` / `ScrollDown` 事件把 `pending_mouse_scroll` 加上 `mouse_scroll_speed`（來自 `tui.mouse_scroll_speed`，`codex-rs/tui/src/app/owned_transcript.rs`，預設 `1.0`，可以是小數），整數部分就是這次捲的行數；方向反轉時丟掉餘數。沒有任何平台分支，也沒有依事件密度正規化。
- 【實測】WSL 原生 PTY，120×24、用 12 段 `!echo` 產生對話紀錄：

  | 輸入 | 位元組 / 回報 | 第一個位元組延遲 | 捲動量 |
  |---|---|---|---|
  | 單一回報 | 約 1.5 KB | 0.5–1 ms | 1 行 |
  | 30 個回報、每 16 ms 一個（模擬觸控板） | 1.46 KB | ≤ 1 ms | 30 行（5 段 × 6 行） |
  | 6 個回報放在同一次寫入 | 8.7 KB（= 6 次重繪，**codex 不合併**） | — | 6 行 |
  | 20 個滑鼠移動（any-motion）回報 | 0 B | — | 不重繪 |

  249×69（接近 Gary 的分頁大小）：每個回報約 **6.2 KB**。每一幀分成 3–5.5 次 read，中位數 1.4–2.5 ms 內送完（最長 21 ms），而且每一幀都包在 `?2026h … ?2026l` 裡。
- 【實測】Windows ConPTY（codex 0.163.0，同樣步驟）：每回報 1 行、1.5–2 KB。ConPTY 會把同一次寫入的 6 個回報合併成約 4.4 KB；每一幀約 30 ms 才送完（ConPTY 自己的繪製節奏）。

#### 3. 觸控板高頻 wheel 事件在 xterm 5.5 的轉換（原始碼 + 實測）

- 【原始碼】`node_modules/@xterm/xterm/src/browser/Terminal.ts` 的滑鼠回報路徑（`case 'wheel'`）：`amount = viewport.getLinesScrolled(ev)`，只檢查 `amount === 0`，然後**送 1 個回報**。`Viewport.getLinesScrolled` 用 `_wheelPartialScroll` 累積像素換算的行數，取整數部分後 `%= 1`，**超過 1 行的部分直接丟掉**。
- 【原始碼】同一檔案裡「沒開滑鼠追蹤、alt buffer」的路徑會照 `amount` 送出等量的方向鍵。所以 xterm 自己的兩條路徑行為不一致。
- 【原始碼】xterm 6.0.0（`CoreBrowserTerminal.ts`，`consumeWheelEvent`）一樣是每事件 1 個回報；升級 xterm 不會改善這一點。
- 【實測】Electron 41.2.1 + xterm 5.5.0 + CanvasAddon（`fontSize: 14`，列高 17.33 px），開 `?1049h ?1000h ?1002h ?1003h ?1006h` 後送合成 WheelEvent（`deltaMode` = pixel）：

  | 事件 | 依像素應捲行數 | xterm 送出的回報數 |
  |---|---|---|
  | 1 個 100 px（Windows 滑鼠一格的典型值） | 5.8 | **1** |
  | 60 個 × 4 px（慢速觸控板） | 13.8 | 14 |
  | 60 個 × 17 px（約一行一個） | 58.8 | 59 |
  | 60 個 × 50 px（快速滑動） | 173.1 | **60** |
  | 慣性尾段（50 px，每次 ×0.92） | 35.7 | **25** |
  | 關閉追蹤後 60 個 × 50 px（方向鍵路徑） | 173.1 | 173 個方向鍵 |

- 【推論】合起來看：Codex 分頁裡，慢速滑動時捲動跟手；手指一快，捲動速度就被事件頻率卡住（60–120 Hz，也就是每秒 60–120 行），慣性的前段被截掉，停得比預期早。這和「可以滾，但不夠絲滑」相符。macOS 觸控板會產生大量 pixel delta 事件與慣性事件，所以預期在 macOS 觸控板上最明顯。Windows 滑鼠一格只捲 1 行，感覺比較像「慢」而不是「不順」。
- 「一次送出大量回報導致 codex 連續重繪、跳動」不成立：【實測】codex 每個回報都整頁重繪而且不合併，但它在 1 ms 內開始回應，跟得上每 16 ms 一個回報；xterm 也沒有一次送大量回報（它的問題是送太少）。

#### 4. 與其他終端比較

- 【原始碼】iTerm2 `sources/PTYSession/PTYSession.m`（`case NSEventTypeScrollWheel`，滑鼠回報模式）：預設 `proportionalScrollWheelReporting = YES`（`iTermAdvancedSettingsModel.m`，`SECTION_EXPERIMENTAL`），每個事件送 `MIN(32, |累積行數|)` 個回報。累積由 `iTermScrollAccumulator` 處理（觸控板的 precise delta ÷ 行高，保留小數）。⇒ 在 iTerm2 裡，快速滑動時 codex 收到的回報數和手指移動的距離成比例。
- 【原始碼】iTerm2 另外處理了慣性：如果捲動開始時沒有在回報，就一直不回報到慣性結束（`_disableScrollReportingUntilMomentumEnds`，`PTYMouseHandler.m`）。xterm 沒有對應的處理。
- 【原始碼】xterm.js 6.0.0 才支援同步輸出（DEC 2026，release notes #5453）；5.5.0 的 `InputHandler` 沒有 2026 的分支（grep 確認）。iTerm2 支援 2026。
- Terminal.app：閉源，沒有查證。它是否合併事件、每事件送幾個回報，**無法判定**；請 Gary 實際比較（給 Gary 的測試 2）。

#### 5. 其他可能影響順暢度的 BAT 因素（權重較低）

- 【原始碼 + 推論】**沒有同步輸出（DEC 2026）**：codex 每一幀分 3–5 次 read 送出（實測）。main 的 16 ms 批次邊界如果落在一幀中間，renderer 會先拿到半幀；xterm 5.5 不認 `?2026h`，下一個 rAF 就可能畫出半幀，看起來像撕裂或閃爍。以幀長 1.4–2.5 ms ÷ 16 ms 粗估，約一成多的捲動步可能受影響（推論，沒有在畫面上觀察到）。要修需要升級 xterm 6.0，但 6.0 移除了 canvas renderer（#5105），必須改用 WebGL 或 DOM renderer，會碰到 Win11 `clearTextureAtlas` 修正與 BUG-164 的 GPU 路徑。風險高、工作量 L，不建議為這個 bug 做。
- 【原始碼 + 推論】**16 ms 批次不對齊 vsync**：輸出到畫面多了 0–16 ms 延遲，捲動步之間的間隔也會不均勻（某一幀兩步、下一幀零步）。Native 終端沒有這一層。改法（例如閒置後的第一筆立即送出）會影響所有分頁的輸出路徑，屬於 M 而且要量測，建議等 Gary 的測試結果再決定。
- 【原始碼】Codex 在 alt buffer 捲動：xterm 的繪製成本受畫面大小限制，不隨對話長度成長（BUG-136 / T0666 已確認，T0667 已修正縮圖預覽）。

#### 6. 平台範圍（塔台追加）：**跨平台**

依據：

- 【原始碼】BAT 的 wheel / 捲動路徑沒有平台分支：`TerminalPanel.tsx` 的 `handleWheel`、`forgetKeptSelection` 各平台相同。唯一的平台分支 `forcesTerminalSelection`（macOS 用 Option、其他平台用 Shift）只用在 mousedown 的選取，不碰 wheel。
- 【原始碼】xterm 5.5 把 wheel 轉成回報 / 方向鍵的程式沒有平台分支（`Terminal.ts`、`Viewport.ts`）。
- 【原始碼】codex 0.163 的 transcript 捲動（`input.rs`）沒有平台分支；`mouse_scroll_speed` 預設 1.0，各平台相同。
- 【實測】Windows ConPTY 與 WSL 原生 PTY 上的 codex 0.163：都開滑鼠追蹤、每回報 1 行、每回報整頁重繪、滑鼠移動不重繪。差別只在 ConPTY 會合併幀，並多約 30 ms 延遲。
- 【實測】xterm「每事件最多 1 個回報」在 Electron 41（Windows）上重現；這段程式碼在 macOS 上相同。
- 有平台差異、但只能推論的部分：
  - 輸入裝置的事件流：Chromium 在 macOS 觸控板上送高頻的 pixel delta 與慣性事件；Windows 滑鼠一格通常是一個約 100 px 的事件（Windows 精確式觸控板也會送高頻小 delta）。所以同一個機制，在 macOS 觸控板上表現成「不順」，在 Windows 滑鼠上表現成「一格只捲 1 行、慢」（推論）。
  - `--disable-skia-graphite` 只在 darwin 加（`electron/main.ts` `decideSkiaGraphite`），改用 Ganesh 繪製。它是否影響捲動時的幀率**無法在本機驗證**，列給 Gary（測試 3）。
- 本機限制：這台 Windows 沒有觸控板手勢可以測，也沒有在 BAT 分頁裡用實體滑鼠或觸控板操作。BAT 端的行為用相同版本的 Electron + xterm + CanvasAddon 重現（§3），codex 端用 PTY 擷取（§2）。

### 建議方向

**要不要修、怎麼修由使用者決定；以下只是建議。**

- **S（推薦，等 Gary 測試 1 確認後再做）**：Codex 分頁「依比例送滾輪回報」。
  1. 在 `TerminalPanel.tsx` 用 `terminal.attachCustomWheelEventHandler`（xterm 5.5 公開 API）。只有同時滿足「alt buffer、`terminal.modes.mouseTrackingMode` 不是 `none`、編碼是 SGR（用既有的 `registerCsiHandler` 記錄 `?1006h/l`）」時才接手；其他情況回 `true`，交給 xterm。
  2. 自己用「像素 ÷ 列高」累積行數（保留小數，方向反轉時清掉），每個事件送 `min(上限, 整數行數)` 個 SGR 回報（建議上限 8；iTerm2 用 32）。用 `terminal.input(reports, true)` 送出，讓它照常經過 `onData`（`SelectionKeeper.handleData`、`pty.write`）。座標用 `.xterm-screen` 的位置與 `cols` / `rows` 換算（codex 依座標分辨對話紀錄和輸入框）。
  3. 計算與編碼放進 `src/lib/` 的純函式並寫單元測試；另外做一個 Electron + xterm 的整合測試（用本單 §3 的方法）。
  4. 範圍：建議先只套用在 codex 分頁。Claude CLI 也會開滑鼠追蹤（T0573），而且有自己的捲動速度設定（`CLAUDE_CODE_SCROLL_SPEED`）；要套用到 Claude 前需另外確認，避免捲太快。
  - 不得退化：
    - Ctrl+滾輪縮放：`handleWheel` 在 capture 階段先 `stopPropagation`，xterm 收不到，不受影響。
    - Shift+滾輪：維持 xterm 原行為（`getLinesScrolled` 對 Shift 回 0）。
    - BUG-142 右鍵選單、T0571 / T0573 Shift 拖曳選取：不碰 mousedown 與右鍵，`forgetKeptSelection` 的 wheel listener 照舊。
    - Win11 `clearTextureAtlas`：不碰繪圖。
    - 一般 shell 與 normal buffer 的捲動：不接手。
    - 滑鼠回報已被 `isTerminalAutoReply` 排除，多個回報合在一次寫入也不會被算成使用者輸入。
  - 風險：低到中。Windows 上滑鼠一格會從捲 1 行變成約 5 行（行為改變，但比較接近一般捲動）。
- **使用者現在就能做的（codex 端，不用改 BAT）**：在 `~/.codex/config.toml` 的 `[tui]` 段加 `mouse_scroll_speed = 3`（可以是小數）。每個回報捲 3 行，快速滑動會快很多，但慢速時一次跳 3 行。🔴 BAT 不能替使用者注入這個設定：`CLAUDE.md`「blocked 狀態偵測」節規定不得注入 codex `-c tui.*`。
- **不建議**：
  - 調 xterm `smoothScrollDuration`：對 alt screen 無效。
  - 調 `scrollSensitivity`：追蹤模式仍是每事件 1 個回報，而且會讓一般 shell 捲動變快。
  - 為這個 bug 升級 xterm 6.0：會移除 canvas renderer，工作量 L、風險高。
- **M（之後可選，需要量測）**：main 的輸出批次改成「閒置後的第一筆立即送出、連續輸出才批次」，縮短延遲並減少半幀。這會影響所有分頁，要另外量測 CPU 與 IPC 次數。

### 給 Gary 的問題 / 測試

最多 3 項，都不耗 token：

1. **（最關鍵，約 2 分鐘）codex 端加速測試**：在 `~/.codex/config.toml` 加上下面兩行（已經有 `[tui]` 段就只加第二行），然後在 BAT 開一個新的 Codex 分頁，用平常的方式捲動。
   ```toml
   [tui]
   mouse_scroll_speed = 3
   ```
   - 明顯變順（快速滑動跟得上手指）→ 確認原因是「每事件只送 1 個回報」，可以派 S 修正（修完後可以把這行拿掉）。
   - 沒有差別 → 問題在別處，請做測試 3。

   另外請回答：用的是觸控板還是滑鼠？「不順」比較像 (a) 滑不快、停得早，(b) 畫面閃爍或撕裂，還是 (c) 有延遲？
2. **同一個 codex 在 iTerm2 / Terminal.app 比較**：先把 `mouse_scroll_speed` 拿掉，在 iTerm2 和 Terminal.app 各開 codex，捲同一段對話。iTerm2 預設依比例送回報；如果 iTerm2 順、BAT 不順，就符合本單結論。Terminal.app 的行為本單無法從原始碼確認，也請說明它順不順。
3. **選做：畫面幀率**：Settings 開 DevTools（需重開 BAT）→ DevTools 的 Rendering 面板勾選「Frame Rendering Stats」→ 在 Codex 分頁快速捲動並截圖。如果幀率明顯低於 60，或常出現紅色的長幀，表示 renderer / GPU 也有成本（例如 macOS 改用的 Ganesh 繪製），需要另外研究。

### 建議下一步

1. 塔台把「給 Gary 的測試 1」轉給 Gary（最便宜、結果最明確），可以同時附上測試 2。
2. 測試 1 確認 → 派 S 修正工單（`TerminalPanel.tsx` 自訂 wheel handler、`src/lib/` 純函式與單元測試、Electron/xterm 整合測試；驗收 `npm run test:unit`、`npm run typecheck`、`npx vite build`）。是否先做由使用者決定。
3. 測試 1 沒差別、測試 3 顯示掉幀 → 另開研究單查 renderer / GPU（Ganesh、CanvasAddon、16 ms 批次）。
4. 本單沒有修改 BUG-165，狀態由塔台更新。

### Renew 歷程

無。

### 遭遇問題

- WSL 的 codex 沒有登入，版本也只有 0.160.0。為了在 Linux 原生 PTY 上測 0.163 的對話畫面：
  - 下載官方 `rust-v0.163.0` 的 `codex-x86_64-unknown-linux-musl` 到 WSL `/tmp/t0670`。
  - 用暫時的 `CODEX_HOME`，其中 `auth.json` 是指向 Windows `~/.codex/auth.json` 的符號連結（沒有複製檔案）。
  - 測試只用 `!echo` 這類本機 shell 命令，**沒有呼叫模型**。
  - 測完已刪除整個 `/tmp/t0670`。Windows `auth.json` 的修改時間仍是 2026-10-17，沒有被改寫。
- Windows 的 codex 測試（ConPTY）用使用者自己的 codex 0.163.0，cwd 是本 repo（已信任），參數 `--no-daemon -c check_for_update_on_startup=false`。副作用：
  - 使用者的 `~/.codex/sessions/2026/10/19/` 多了兩個 session 檔（15:48、15:54）。沒有刪除，留給使用者決定。
  - 使用者設定的 codex `session_start` hooks 可能各執行了一次。
  - 測試中按 ↑ 時，codex 把歷史 prompt 帶進輸入框；**沒有按 Enter 送出**。
  - repo 的 `git status` 沒有因為測試多出檔案。
- 這台機器沒有 macOS 觸控板，觸控板事件是用合成 WheelEvent 模擬的；實際 macOS 的事件 delta 數值沒有量到。
- 第一次 Electron 量測用了隱藏視窗，xterm 的列高還沒算出來（等於除以 0），結果無效。改用顯示中的視窗重跑；本報告只採用第二次的數字。
- 暫存檔（擷取紀錄、量測腳本、下載的 codex / iTerm2 原始碼片段、pyte）都在 scratchpad。日誌與報告沒有出現任何權杖。

### 回報時間

2026-10-19T16:03:02+0800
