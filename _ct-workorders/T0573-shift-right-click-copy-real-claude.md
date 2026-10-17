---
schema_version: 1
schema_kind: workorder
id: T0573
title: "BUG-144 重修：真實 claude CLI 分頁 Shift + 拖曳後 Shift + 右鍵仍只有「貼上」（T0571 實機無效）"
type: bugfix
status: FIXED
repo: better-agent-terminal
project: BUG-144
priority: P2
sizing: S-M
created_at: "2026-10-17T10:05:10+0800"
updated_at: "2026-10-17T10:35:17+0800"
completed_at: "2026-10-17T10:35:17+0800"
started_at: "2026-10-17T10:06:26+0800"
target_version: "0.6.1-pre.9（未排發版）"
depends_on: []
related:
  - "BUG-144（「實機驗收失敗（pre.8）」一節：反白仍在、選單只有「貼上」）"
  - "T0571 `35eaf125`（`MouseReportSelectionKeeper`；回報區有 xterm 5.5.0 根因證據與修正前實測表）"
  - "BUG-142 / T0568（追蹤中不按 Shift 不開選單）、BUG-143 / T0569（選單 Esc）"
affects_files:
  - src/components/TerminalPanel.tsx
  - src/lib/terminal-context-menu.ts
  - "src/__tests__/terminal-context-menu.test.tsx"
  - "e2e/t0571-shift-right-click-copy.spec.ts（或新的 e2e/t0573-*.spec.ts）"
  - "CLAUDE.md（「終端分頁右鍵選單與滑鼠追蹤」一節，修正 / 補充 T0571 那條）"
  - _ct-workorders/T0573-shift-right-click-copy-real-claude.md
  - _ct-workorders/BUG-144-shift-right-click-menu-missing-copy-in-claude-tab.md
renew_count: 0
workdir: main repo
interaction:
  mode_hint: on
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 不 push、不觸發 workflow、不建 tag、不改版號；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF；含反斜線的內容用 Write 工具（L129）。commit 用 `git commit --only <你改的檔>`（`src/styles/settings.css` 的 M 不是你的變更）。"
  - "🔴 不碰使用者正在用的 BAT（port 9876）與它的 Terminal Server；實測一律用隔離實例（需先 `npx vite build`）。可讀使用者的 `%APPDATA%\\BetterAgentTerminal\\Logs\\debug-*.log` 找線索（只讀）。"
  - "🔴 不改 xterm 寫進 PTY 的滑鼠回報與其他輸入；不改 T0568「追蹤中不按 Shift 的右鍵不開選單」與 T0569 的 Esc 行為。"
  - "🔴 在隔離實例跑真實 claude CLI 時**不得送出任何 prompt**（不耗額度）；只用 REPL 啟動後畫面上已有的文字（歡迎框、提示列等）做選取。"
---

# T0573 — BUG-144 重修：真實 claude CLI 的 Shift + 右鍵「複製」

## 背景

T0571（`35eaf125`，隨 `0.6.1-pre.8` 發佈）的根因是：xterm 5.5.0 把滑鼠回報當成使用者輸入，送出回報時就清掉選取；claude CLI 開了 1003，滑鼠每移動一格都會送回報。修正方式是 `MouseReportSelectionKeeper`：選取剛被 SGR 滑鼠回報清掉時，在同一個 task 內把它放回原範圍。T0571 的 e2e 用 node 腳本模擬（alt screen + 1000 / 1002 / 1003 / 1006），測試通過。

**pre.8 實機結果無效**（2026-10-17，本機 Windows，BAT `0.6.1-pre.8`，塔台分頁跑真實 claude CLI 2.1.300）：依「按住 Shift 拖曳選取 → 移動滑鼠 → Shift + 右鍵」操作後，**畫面上的藍底反白還在**，但 BAT 選單**只有「貼上」**。

可見 node 腳本模擬和真實 claude 有落差。這張單先找出落差在哪裡，再修。

## 任務

1. **用真實 claude CLI 重現**（隔離實例，例如內嵌 `node_modules/@anthropic-ai/claude-code/bin/claude.exe` 或系統 claude；**不送 prompt**）：
   - 在 Shift + 拖曳結束、移動滑鼠、Shift + 右鍵 mousedown、`contextmenu` 這幾個時間點，記錄 `terminal.getSelection()` / `hasSelection()`、keeper 的內部狀態，以及 `onData` 實際送出的序列（可沿用 T0571 從 React fiber 取 `terminal` 的診斷寫法，用完刪掉）
   - 先確認**反白是誰畫的**：是 xterm 的選取（`hasSelection()` 為真），還是 claude 自己畫的。若是 xterm 選取但選單還是沒有「複製」，要查 `selectionText` 在哪一步變成空字串
   - 以下候選都要逐一確認或排除，結論寫在回報區：
     - (a) 有 SGR 以外的 `onData` 也觸發清除，keeper 不會放回：例如 focus report `ESC [ I` / `ESC [ O`（claude 會開 DECSET 1004；T0571 的腳本沒開）、游標位置回報等自動回應。xterm 對這些序列的 `triggerDataEvent` 是否帶 `wasUserInput = true`，要看原始碼確認
     - (b) claude 的輸出（重繪、捲動、清畫面、切換 buffer）清掉選取，或讓 keeper 的 microtask 時間窗對不上
     - (c) Shift 拖曳在 Windows 上其實有送回報給 claude，反白是 claude 畫的
     - (d) `selectionText` 的取值時機或 React state 更新順序（例如右鍵當下讀到的是放回之前的空值）
     - (e) 其他你實際觀察到的原因
2. **修正**：真實 claude CLI 分頁做到 Shift + 拖曳 → 移動滑鼠 → Shift + 右鍵時，選單有「複製」，點下後剪貼簿內容 = 反白文字。做法依根因決定。下列行為不得破壞：一般 shell 的右鍵選單與「複製」、追蹤中不按 Shift 的右鍵（T0568）、選單開著時的 Esc（T0569）、打字後不放回選取、保存的選取不會被後續的右鍵沿用（T0571 已有的保護）。
3. **診斷日誌**：Shift + 右鍵開選單時，用 `window.electronAPI.debug.log` 記一行 `[terminal-context-menu]`，內容包含 `mouseTrackingMode`、`hasSelection`、`selectionText` 長度、keeper 最近一次動作（例如 restored / dropped 及原因）。只在開選單時記，不要每次移動滑鼠都記。這樣下次實機若再失敗，可以直接從使用者的日誌判讀。
4. **測試**：
   - 元件 / 單元測試補上根因對應的案例
   - e2e 腳本要更接近 claude：至少加上你找到的根因條件（例如開 1004 並由 BAT 送出 focus report、週期重繪）
   - 隔離實例用真實 claude CLI 實測一次，修正前後各一次，結果寫在回報區。真實 claude 實測不必寫成常駐 e2e
5. BUG-144 → FIXED，填上 commit；CLAUDE.md「終端分頁右鍵選單與滑鼠追蹤」修正 T0571 那條（寫清楚實際根因）。

## 驗收條件

- [ ] 根因有證據，回報區有 (a)–(d) 每一項的結論，並寫明實機反白是誰畫的
- [ ] 隔離實例跑真實 claude CLI：Shift + 拖曳 → 移動 → Shift + 右鍵 → 有「複製」且剪貼簿內容正確（修正前後對照）
- [ ] 一般 shell、追蹤中不按 Shift、Esc、打字後不放回，行為都不變
- [ ] 開選單時有 `[terminal-context-menu]` 診斷日誌
- [ ] `npm run test:unit` 全綠（基線 4633 passed / 266 files，加上新測試）、`npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npx vite build` 成功
- [ ] e2e `t0568` / `t0571`（或新的 `t0573`）通過
- [ ] BUG-144 → FIXED

---

## 回報區

> 以下由 sub-session 填寫

### 結果摘要

**FIXED**（待使用者實機驗收）。T0571 在真實 claude CLI 無效有兩個原因，node 腳本模擬都沒踩到：

1. **聚焦時 claude 重送追蹤模式**：claude CLI 2.1.300 開 DECSET 1004；分頁失焦約 5 秒以上、再收到 `ESC [ I` 時，claude 重送 `?2004h ?1000h ?1002h ?1003h ?1006h`。xterm 每個追蹤 DECSET 都重設滑鼠協定（模式沒變也一樣）→ `SelectionService.disable()` → 清選取，**不經 `onData`**，T0571 keeper 不會放回。讓分頁重新聚焦的那一下若就是 Shift + 拖曳，DECSET 約 20–30 ms 後在拖曳中途到達，xterm 的拖曳也一起結束。
2. **重選同一範圍沒有事件**：xterm `clearSelection()` / `select()` 直接 fire `onSelectionChange`、不更新 `_oldSelectionStart/_oldSelectionEnd`；之後拖出**完全相同**的範圍時 `_fireEventIfSelectionChanged` 判定沒變、不發事件，keeper 不知道有選取，下一個移動回報清掉後就不放回。重試同一段文字必中。

使用者截圖的**藍底反白是 claude 自己的選取**（xterm 選取色是 `#5c5142` 棕色；隔離實例截圖對照）。Shift + 拖曳不會把按鍵送給 claude，所以 claude 先前一般拖曳留下的藍底反白還在，但 xterm 選取已經沒了 → 選單只有「貼上」。

### Landing check

- C-0：`repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal` → **PASS**
- C-1：工單在 `REPO_ROOT/_ct-workorders/` 下 → PASS
- C-3：`src/components/TerminalPanel.tsx` / `src/lib/terminal-context-menu.ts` / `src/__tests__/terminal-context-menu.test.tsx` / `e2e/t0571-shift-right-click-copy.spec.ts` / `CLAUDE.md` 都存在 → PASS（C-0 已 PASS，僅記錄）
- C-2：工單無 `branch` 欄位，目前 `main`
- 結論：**PASS**。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）。`CT_MODE=yolo`、`CT_INTERACTIVE=0`。
- 工單原狀態為 `TODO`（不是 `PENDING`），已照開始流程改成 `IN_PROGRESS`。

### 根因證據

**claude CLI 對焦點回報的反應**（node-pty 直接起內嵌 `claude.exe` 2.1.300，不送 prompt，只送 focus report / 移動回報並記錄輸出；`CLAUDE*` env 清掉、`CLAUDE_CODE_NO_FLICKER=1`）：

| 送出 | claude 輸出 |
|---|---|
| 啟動後第一次 `ESC[I` | `ESC[?2004h ESC[?1000h ESC[?1002h ESC[?1003h ESC[?1006h` |
| `ESC[O` 後 50 ms / 500 ms / 2 s 再 `ESC[I` | 無 |
| 連續兩次 `ESC[I`、移動回報後 `ESC[I` | 無 |
| `ESC[O` 後 6 s 再 `ESC[I` | `ESC[?2004h ESC[?1000h ESC[?1002h ESC[?1003h ESC[?1006h` |

**xterm 5.5.0 原始碼**（`node_modules/@xterm/xterm/src`）：
- `common/InputHandler.ts:1903–1913`：DECSET 1000 / 1002 / 1003 一律 `coreMouseService.activeProtocol = …`
- `common/services/CoreMouseService.ts:208–213`：setter 每次都 `_onProtocolChange.fire`（不比對舊值）
- `browser/Terminal.ts:721–728`：`onProtocolChange(events)` 有 events → `_selectionService.disable()`
- `browser/services/SelectionService.ts:165–168`：`disable()` 呼叫 `clearSelection()`；`clearSelection()`（:259–264）再 `_removeMouseDownListeners()`（拖曳中即結束拖曳）
- `browser/services/SelectionService.ts:719–749`：`_fireEventIfSelectionChanged` 只在範圍與 `_oldSelection*` 不同時發事件；`clearSelection()`（:263）與 `setSelection` / `selectAll`（:361 / :371）直接 `_onSelectionChange.fire()`，不更新 `_old*`
- focus report：`browser/Terminal.ts:271 / :295` 的 `triggerDataEvent(ESC[I / ESC[O)` **沒有** `wasUserInput`，本身不清選取

**隔離實例 + 真實 claude CLI**（暫時的診斷 spec：以 React fiber 取 `terminal`、註冊 `?h` CSI handler 記 DECSET、記 `onSelectionChange` / `onData` / 滑鼠事件；用完已刪）。修正前 = HEAD `02eb9e66` 在暫時 git worktree 建置（已移除）；修正後 = 本單。選取 REPL 歡迎框的 `Claude Code`，不送任何 prompt，結束時 Ctrl+C 兩次離開：

| 情境 | 修正前 選單 / 剪貼簿 | 修正後 選單 / 剪貼簿 | 修正後日誌 `keeper=` |
|---|---|---|---|
| plain：Shift + 拖曳 → 移動 → Shift + 右鍵（焦點一直在） | 複製 / `Claude Cod` | 複製 / `Claude Cod` | `restored (mouse report)` |
| blur6：失焦 6.5 s → Shift + 拖曳（DECSET 在拖曳中途到達）→ 移動 → Shift + 右鍵 | **只有貼上** | 複製 / `Claude Cod` | 拖曳時 `drag resumed (mouse tracking set again)`，右鍵時 `restored (mouse report)` |
| reselect：同一範圍 Shift + 拖曳兩次（中間一次左鍵點擊給 claude）→ 移動 → Shift + 右鍵 | **只有貼上** | 複製 / `Claude Cod` | `restored (mouse report)` |
| blur-before-rightclick：選好 → 失焦 6.5 s → Shift + 右鍵（按下 150 ms 後放開，DECSET 在按下與放開之間到達） | **只有貼上** | 複製 / `Claude Cod` | `restored (mouse tracking set again)` |
| claude-sel-first：先一般拖曳（claude 藍底反白、copy on select）→ 同處 Shift + 拖曳 → 移動 → Shift + 右鍵 | 複製 / `Claude Cod` | 複製 / `Claude Cod` | `restored (mouse report)` |

blur6 修正前的事件序（節錄）：`mousedown(Shift)` → `data ESC[I` → +18 ms `DECSET 2004` / `DECSET 1000`（此時選取 `Cl`）→ `selchange`（清空）→ `DECSET 1002 / 1003 / 1006` → `mouseup`（選取空）→ 之後全空。修正後同一處多一個補按的 `mousedown`，`mouseup` 時選取 = `Claude Cod`，期間沒有按鍵回報送給 claude。

### (a)–(e) 結論

- **(a) SGR 以外的 `onData` 觸發清除**：**排除**。focus report `ESC[I` / `ESC[O`、游標位置回報、DA 等自動回應在 xterm 都是 `triggerDataEvent(data)`（`wasUserInput = false`），不 fire `onUserInput`、不清選取。但 focus report 是**間接**原因：claude 收到 `ESC[I` 後重送追蹤 DECSET（見 (e)）。
- **(b) claude 的輸出清掉選取**：**部分成立**。不是重繪 / 捲動，而是輸出中的追蹤 DECSET（`?1000h ?1002h ?1003h`）經 `onProtocolChange` → `disable()` 清除；只在失焦約 5 秒以上再聚焦時發生。一般重繪（狀態列計時等）實測不清選取。buffer 切換（`?1049h`）本來就清除，維持不放回。
- **(c) Shift 拖曳其實送回報給 claude、反白是 claude 畫的**：**前半排除、後半成立**。Shift + 拖曳在 Windows 不送按鍵回報（`onData` 只有移動回報 `ESC[<39;…M`，沒有 `<0` / `<32`），xterm 的選取確實建立；但使用者看到的**藍底**反白是 claude 自己的選取（xterm 選取色 `#5c5142`），應來自先前的一般拖曳，Shift + 拖曳不會清掉它。
- **(d) `selectionText` 取值時機 / React state 順序**：**排除**。失敗情境中 `contextmenu` 當下 `terminal.getSelection()` 本來就是空字串（事件序中 `contextmenu` 時 `has=false`），選單內容與右鍵當下的 xterm 選取一致。
- **(e) 實際原因**：① claude 聚焦時重送追蹤 DECSET（失焦 ≥ 約 5 s）清選取，拖曳中途則中斷拖曳；② xterm 重選同一範圍不發 `onSelectionChange`，keeper 不知道選取存在。兩者都以真實 claude 重現，修正後消失（上表）。

### 修正

- `src/lib/terminal-context-menu.ts`：
  - `isMouseTrackingDecset(params)`（9 / 1000 / 1002 / 1003）、`forcesTerminalSelection(event, platform, macOptionClickForcesSelection)`（同 xterm `shouldForceSelection`）、`SelectionDrag` 介面
  - `MouseReportSelectionKeeper`：第三個建構參數 `drag?: SelectionDrag`；`handleMouseTrackingSet()`（追蹤已開時又收到追蹤 DECSET，在 xterm 處理前呼叫）記下目前選取，該次寫入解析完（microtask）若被清掉：拖曳中 → `drag.resume()`，否則放回原範圍（讀回文字不同則不放回）；`handleSelectionDragEnd()` 拖曳放開時主動同步；`forget(reason)`；`lastAction` 供診斷日誌
- `src/components/TerminalPanel.tsx`：
  - `terminal.parser.registerCsiHandler({ prefix: '?', final: 'h' })`：`isMouseTrackingDecset && isMouseTrackingOn(目前模式)` → `handleMouseTrackingSet()`，回 `false`（不攔，xterm 照常處理）；從關閉打開追蹤不放回（T0571 規則）
  - container capture `mousedown`：追蹤中、左鍵、強制選取修飾鍵 → 記下拖曳起點；`document` capture `mouseup` → 結束並 `handleSelectionDragEnd()`；`document` capture `mousemove` 無左鍵 → 丟棄殘留的拖曳狀態
  - `resume()`：在 `.xterm-screen` 以原按下位置、原修飾鍵補一個 `mousedown`（xterm 視為強制選取：不送回報、重新開始選取並掛上自己的拖曳 listener）；補按期間 `forgetKeptSelection` 不動作
  - buffer 切換 → `forget('buffer switch')`
  - 選單開啟時 `dlog` 一行 `[terminal-context-menu] terminal=… shown: mouseTrackingMode=… shift=… hasSelection=… selectionText=<n> chars keeper=<lastAction>`（只在開選單時記）
- **不變的行為**：xterm 寫進 PTY 的滑鼠回報與其他輸入（補按帶強制選取修飾鍵，xterm 不送回報；e2e 與真實 claude 都確認沒有多出按鍵回報）；T0568 追蹤中不按 Shift 不開選單（也不記 `shown` 行）；T0569 選單 Esc；打字後不放回；保存的選取不被後續右鍵沿用（左鍵 / 右鍵 / 滾輪 `forget`，同 T0571）。
- 已知限制：補按依賴 Chromium 對 `document` 送出 `mouseup`（在視窗外放開也會送）；放開事件真的遺失時，下一個無左鍵的移動會丟掉拖曳狀態，不會補按。Alt 欄選取在追蹤模式下仍不放回（同 T0571）。

### 驗證

| 項目 | 結果 |
|---|---|
| 根因 | **PASS**：claude CLI PTY 擷取 + xterm 原始碼 + 隔離實例真實 claude 修正前後對照；(a)–(e) 皆有結論 |
| 隔離實例真實 claude CLI | **PASS**：5 種情境修正後皆「複製 / 貼上」且剪貼簿 = `Claude Cod`；修正前 3 種（blur6 / reselect / blur-before-rightclick）只有「貼上」。註：修正後那輪真實 claude 是在加入「無左鍵移動丟棄殘留拖曳」防護之前的 build；該防護只影響 `buttons & 1 === 0` 的移動，最終 build 以 e2e 步驟 6（拖曳中途補按）再驗證通過 |
| 元件 / 單元測試（`src/__tests__/terminal-context-menu.test.tsx`，29 → 41） | **PASS**：keeper（DECSET 判斷、修飾鍵、寫入後放回、無清除 / 無選取 / forget / 文字變了不放回、打字後不放回、拖曳中補按 / 放開後改放回 / 補按失敗改放回、同範圍重選經 drag end 同步）；TerminalPanel（claude 重送 DECSET 後選單有複製且日誌行內容、拖曳中補按的事件屬性且不寫 PTY、殘留拖曳不補按、一般拖曳不補按、從關閉打開追蹤 / buffer 切換 / 打字後不放回、同範圍重選、不按 Shift 無選單也無 `shown` 行）。mutation：拿掉 `handleMouseTrackingSet` 呼叫 → 2 個失敗；拿掉 `handleSelectionDragEnd` 呼叫 → 1 個失敗 |
| `npm run test:unit` | **PASS**：266 files，4645 passed / 3 skipped（基線 4633 + 12） |
| `npm run typecheck` | **PASS**：0 |
| `npm run typecheck:electron` | **PASS**：0 |
| `npx vite build` | **PASS** |
| e2e `e2e/t0571-shift-right-click-copy.spec.ts`（擴充） | **PASS**（最終 build）：腳本另開 1004，失焦 ≥ 1 s 後收到 `ESC[I` 即重送追蹤 DECSET；新步驟 6（失焦 → Shift + 拖曳回到分頁，DECSET 在拖曳中途、且與步驟 1 同一範圍）、步驟 7（選好 → 失焦 → Shift + 右鍵回到分頁，DECSET 在按下與放開之間）都要有「複製」且剪貼簿正確；原步驟 1–5、8 照舊。修正前 build 跑同一 spec → 步驟 6 失敗（能抓回歸） |
| e2e `e2e/t0568-context-menu-mouse-tracking.spec.ts` | **PASS** |
| 使用者實機（claude CLI 分頁） | 未做（需新版安裝檔；交塔台 / 使用者驗收）。若再失敗，看日誌 `[terminal-context-menu] … shown: … keeper=…` 那一行 |

### 變更檔案

- `src/lib/terminal-context-menu.ts`
- `src/components/TerminalPanel.tsx`
- `src/__tests__/terminal-context-menu.test.tsx`
- `e2e/t0571-shift-right-click-copy.spec.ts`（擴充，未新增 t0573 spec）
- `CLAUDE.md`（「終端分頁右鍵選單與滑鼠追蹤」：補藍底反白來源；新增 T0573 兩個原因、修正、診斷日誌；驗證列補 e2e 新步驟）
- `_ct-workorders/T0573-shift-right-click-copy-real-claude.md`、`_ct-workorders/BUG-144-shift-right-click-menu-missing-copy-in-claude-tab.md`

### Commit

- `6e4f3764` fix(terminal): keep the Shift + drag selection when the claude CLI re-sets mouse tracking on focus (T0573, BUG-144)
- 工單 / BUG 記帳另一個 `(ct)` commit。`src/styles/settings.css` 的 M 不是本單變更，未納入。未 push、未觸發 workflow、未建 tag、未改版號。

### 偏差 / 後續

- 無範圍偏差。真實 claude 實測以暫時診斷 spec 執行（已刪）；修正前 build 以暫時 git worktree 建置（已移除，node_modules junction 先解除）。
- 給塔台：使用者日誌（`debug-20261017-085134.log`）只有不按 Shift 的「not shown」紀錄；T0573 前 Shift + 右鍵開選單不記日誌，無法從實機日誌直接判讀。本單起每次開選單都有一行 `shown`。
- 建議實機驗收時順帶試：① 從別的視窗回來（≥ 5 秒）後直接 Shift + 拖曳；② 同一段文字選兩次。
