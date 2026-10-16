---
schema_version: 1
schema_kind: workorder
id: T0571
title: "BUG-144：滑鼠追蹤開啟的分頁（claude CLI）選取文字後 Shift + 右鍵，BAT 選單要有「複製」"
type: bugfix
status: DONE
repo: better-agent-terminal
project: BUG-144
priority: P2
sizing: S
created_at: "2026-10-16T21:48:35+0800"
started_at: "2026-10-16T21:49:47+0800"
updated_at: "2026-10-16T22:06:48+0800"
completed_at: "2026-10-16T22:06:48+0800"
commit: 35eaf125
target_version: "0.6.1-pre.8（未排發版）"
depends_on: []
related:
  - "BUG-144（現象：直接拖曳與 Shift + 拖曳兩種選法，Shift + 右鍵都只有「貼上」）"
  - "BUG-142 / T0568（Shift + 右鍵照開選單的設計，`src/lib/terminal-context-menu.ts`）；BUG-143 / T0569（同一個選單的 Esc）"
affects_files:
  - src/components/TerminalPanel.tsx
  - src/lib/terminal-context-menu.ts
  - "src/__tests__/terminal-context-menu.test.tsx"
  - "e2e/t0568-context-menu-mouse-tracking.spec.ts 或新的 e2e/t0571-*.spec.ts"
  - "CLAUDE.md（「終端分頁右鍵選單與滑鼠追蹤」一節，簡短補充）"
  - _ct-workorders/T0571-shift-right-click-copy-in-mouse-tracking-tab.md
  - _ct-workorders/BUG-144-shift-right-click-menu-missing-copy-in-claude-tab.md
renew_count: 0
workdir: main repo
interaction:
  mode_hint: on
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 不 push、不觸發 workflow、不建 tag、不改版號；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF；含反斜線的內容用 Write 工具（L129）。commit 用 `git commit --only <你改的檔>`（`src/styles/settings.css` 的 M 不是你的變更）。"
  - "🔴 不碰使用者正在用的 BAT（port 9876）與它的 Terminal Server；e2e 只用隔離實例（需先 `npx vite build`）。"
  - "🔴 不改 xterm 寫進 PTY 的滑鼠回報；不改 T0568 的「不按 Shift 的右鍵在追蹤模式下不開選單」與 T0569 的 Esc 行為。"
---

# T0571 — BUG-144：Shift + 右鍵選單沒有「複製」

## 背景

T0568 讓滑鼠追蹤開啟的分頁（claude CLI 2.1.300 開 1000 / 1002 / 1003 / 1006）右鍵不開 BAT 選單，Shift + 右鍵照開，回報區寫「追蹤模式下 xterm 要用 Shift + 拖曳才能選取，接著 Shift + 右鍵就會出現「複製 / 貼上」」。但這條路徑沒有測試覆蓋（元件測試只測追蹤關閉時的「複製」，e2e 的 Shift 案例沒有選取）。

pre.7 實機（本機 Windows，claude CLI 分頁）：反白文字後 Shift + 右鍵，選單只有「貼上」。使用者**直接拖曳**與**Shift + 拖曳**兩種選法都試過，結果相同。

## 任務

1. **先重現並找根因**（隔離實例；node 腳本開 1000 / 1002 / 1003 / 1006 模擬 TUI，必要時再加週期重繪或 alt screen，接近 claude 的行為；不耗額度的話也可用內嵌 claude 實測）：
   - Shift + 拖曳後，`terminal.getSelection()` / `hasSelection()` 在拖曳結束、Shift + 右鍵 mousedown、`contextmenu` 三個時間點各是什麼
   - 選取是否被 Shift + 右鍵的 mousedown、程式重繪、focus report 或其他事件清掉；或 Shift + 拖曳在追蹤模式下其實沒建立 xterm 選取
   - 直接拖曳（不按 Shift）時的反白是誰畫的：若是 claude 自己的選取（xterm 沒有選取），BAT 讀不到內容，請在回報區寫明，並確認 claude 自己怎麼複製這段選取（例如放開滑鼠即複製、或不按 Shift 的右鍵複製，T0568 回報區有二進位證據）
2. **修正**：Shift + 拖曳選取後 Shift + 右鍵 → 選單有「複製」，點下後剪貼簿 = 反白文字。做法由你依根因決定，例如在選取被清掉之前保存選取，或在 Shift + 右鍵時不讓 xterm 清掉選取。不得破壞：
   - 追蹤關閉的一般 shell：右鍵選單與「複製」照舊
   - 追蹤開啟、不按 Shift 的右鍵：不開選單，程式照常收到右鍵（T0568）
   - 選單開著時的 Esc（T0569）
   - 選單關閉、點外部、點「複製」後的選取狀態不留下過期內容（例如保存的選取不能在之後別的右鍵沿用）
3. **直接拖曳的情況**：若確認反白是 claude 自己的選取、BAT 拿不到，**不要**為了顯示「複製」去讀 claude 的畫面猜內容；在回報區給塔台一句結論與建議（例如 claude 自己已複製 / 右鍵即複製），塔台再決定要不要另外處理。
4. **測試**：元件測試補「追蹤開啟 + Shift + 有選取 → 選單有複製，點了寫入剪貼簿」，以及你找到的根因對應案例；e2e（隔離實例）：腳本開追蹤 → Shift + 拖曳選取 → Shift + 右鍵 → 選單有「複製」→ 點下後剪貼簿內容正確（macOS skip，同 T0568）。
5. BUG-144 狀態改 FIXED、填修正 commit；CLAUDE.md「終端分頁右鍵選單與滑鼠追蹤」補一兩句。

## 驗收條件

- [ ] 根因有證據（含直接拖曳時反白來源的結論）
- [ ] 追蹤開啟的分頁 Shift + 拖曳後 Shift + 右鍵 → 選單有「複製」且複製內容正確；一般 shell、追蹤中不按 Shift、Esc 行為不變
- [ ] `npm run test:unit` 全綠（基線 4614 passed / 265 files，加上新測試）、`npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npx vite build` 成功
- [ ] e2e（`t0568` 與新案例）通過，或說明做不到的原因
- [ ] BUG-144 → FIXED

---

## 回報區

> 以下由 sub-session 填寫

### 結果摘要

**DONE**。根因：xterm 5.5.0 把滑鼠回報當使用者輸入（`CoreMouseService` → `triggerDataEvent(report, true)` → `onUserInput`），`SelectionService` 收到 `onUserInput` 就清掉選取。claude CLI 開 1003（任意移動追蹤），每移動一格都是回報，**按住 Shift 也照送**（`ESC [ < 39 ; … M` = 移動 + Shift），所以 Shift + 拖曳的選取在 Shift + 右鍵之前就被清掉，選單只剩「貼上」。只開 1000 / 1002（沒有移動回報）時選取會留著、選單有「複製」。

修正：`MouseReportSelectionKeeper`（`src/lib/terminal-context-menu.ts`）在「選取被清除後、同一個 task 內的 `onData` 是 SGR 滑鼠回報」時，以 `terminal.select` 放回同一範圍；回報本身照常寫進 PTY。選單的「複製」改寫入右鍵當下的選取文字（`ContextMenu.selectionText`），不再於點擊時重讀 xterm。

### Landing check

- C-0：`repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal` → **PASS**
- C-1：工單在 `REPO_ROOT/_ct-workorders/` 下 → PASS
- C-3：`src/components/TerminalPanel.tsx` / `src/lib/terminal-context-menu.ts` / `src/__tests__/terminal-context-menu.test.tsx` 都存在 → PASS
- C-2：工單無 `branch` 欄位，目前 `main`
- 結論：**PASS**。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）
- 工單原狀態為 `TODO`（不是 `PENDING`），已照開始流程改成 `IN_PROGRESS`。

### 根因證據

1. **xterm 原始碼**（`node_modules/@xterm/xterm/src`，5.5.0）：
   - `browser/services/SelectionService.ts:139`：`this._coreService.onUserInput(() => { if (this.hasSelection) this.clearSelection() })`
   - `common/services/CoreMouseService.ts:284`：SGR 編碼的回報走 `this._coreService.triggerDataEvent(report, true)`（`wasUserInput = true`）
   - `common/services/CoreService.ts`：`triggerDataEvent` 先 fire `onUserInput`（→ 清選取、`onSelectionChange`）再 fire `onData`，同步
   - `browser/Terminal.ts` `bindMouse`：`mousemove`（無按鍵）在 1003 時一律 `sendEvent`，**不看** `shouldForceSelection`（只有 `mousedown` 看 Shift）
2. **隔離實例實測（修正前；暫時的診斷 spec 以 React fiber 取得 `terminal` 讀 `getSelection()`，已刪除）**，腳本在一般 buffer 印一行後開追蹤：

   | 模式 / 操作 | 放開滑鼠後 | 移動後 | Shift + 右鍵 mousedown / `contextmenu` 時 | 選單 |
   |---|---|---|---|---|
   | 1000 + 1006，Shift 拖曳，不動 | `alpha beta` | `alpha beta` | `alpha beta` | 複製 / 貼上 |
   | 1000 + 1006，Shift 拖曳，移動 3 格 | `alpha beta` | `alpha beta` | `alpha beta` | 複製 / 貼上 |
   | 1003，Shift 拖曳，不動（只有 click 前的 move） | `alpha beta` | — | 空（`ESC[<39;21;2M` 之後清掉） | 貼上 |
   | 1003，Shift 拖曳，移動 3 格 | `alpha beta` | 空（`ESC[<35;22;2M` 之後清掉） | 空 | 貼上 |
   | 1000 / 1003，一般拖曳 | 空 | 空 | 空 | 貼上 |

   1003 的事件序：`mouseup`（sel = `alpha beta`）→ `selchange`（空）→ `data` `ESC[<35;22;2M` → … → `mousedown b=2 shift`（sel 空）→ `contextmenu`（sel 空）。Shift + 右鍵的 mousedown 本身不清選取（`SelectionService.handleMouseDown`：`button === 2 && hasSelection` 直接返回；`Terminal` 的 mousedown 在 Shift 時不送回報）。
3. **直接拖曳（不按 Shift）的反白來源**：xterm 沒有選取（上表為空），拖曳以 `ESC[<0;…M` / `ESC[<32;…M` / `ESC[<0;…m` 送給程式，反白是 **claude 自己畫的選取**，BAT 讀不到。claude CLI 2.1.300 二進位：`copyOnSelect` 設定（`label:"Copy on select"`，預設 `ce().copyOnSelect??!0` = 開），放開滑鼠時 `copySelectionNoClear()` 後寫剪貼簿（`clipboard_write`）；T0568 回報區另有證據：不按 Shift 的右鍵在 windows / wsl / linux 有選取就複製選取。
   - **給塔台的結論**：直接拖曳的反白，claude 放開滑鼠時已經複製到剪貼簿（`/config` 的 Copy on select 預設開），不按 Shift 的右鍵也會複製；BAT 不需處理，也沒有依畫面猜內容。若要在 BAT 選單顯示「複製」只能讀 claude 的畫面推測，不建議。

### 修正與取捨

- `src/lib/terminal-context-menu.ts`：新增 `isSgrMouseReport(data)`、`SelectionKeeperTerminal`、`MouseReportSelectionKeeper`：
  - `handleSelectionChange()`：有選取 → 記下文字與 `getSelectionPosition()`；被清除 → 暫存為「剛被清掉」並排一個 microtask，同一 task 內沒有後續就丟棄（buffer 切換、trim、開追蹤時的 `disable()` 等不是輸入造成的清除，不放回）
  - `handleData(data)`：剛被清掉且 `data` 是 SGR 回報 → `select(start.x, start.y, (end.y - start.y) * cols + end.x - start.x)`；讀回文字與原本不同（Alt 欄選取、resize）→ `clearSelection()`、不放回；其他 `data`（打字、貼上）→ 不放回
  - `forget()`：Shift + 右鍵以外的滑鼠按下、滾輪（程式收到，或開始新選取）
  - 放回時 `select` 觸發的 `onSelectionChange` 以 `restoring` 旗標略過
  - 預設排程器寫成 `fn => queueMicrotask(fn)`：把 `queueMicrotask` 當方法呼叫在 Chromium 會丟 `Illegal invocation`（e2e 第一次執行就踩到，jsdom 不會；單元測試以模擬 Chromium 行為的 stub 守住，mutation 確認舊寫法會失敗）
- `src/components/TerminalPanel.tsx`：建立 keeper、`terminal.onSelectionChange` 接線；既有 `terminal.onData` 開頭呼叫 `handleData`（沒有加第二個 onData 訂閱；寫 PTY 的內容不變）；container 加 capture 的 `mousedown` / `wheel` listener 呼叫 `forget()`（Shift + 右鍵除外），cleanup 一併移除；`ContextMenu.hasSelection` 改為 `selectionText`，`handleCopy` 寫入它。
- **不變的行為**：xterm 寫進 PTY 的滑鼠回報（回報照送，之後才把選取放回）；T0568 的「追蹤中不按 Shift 的右鍵不開選單」；T0569 的 Esc。
- 取捨：放回後下一個移動回報又會清除再放回，每移動一格多一次 selection refresh（xterm 合併到下一個 animation frame）。只有曾經有選取、且被回報清掉時才會發生。
- 已知限制：Alt + Shift 拖曳的欄選取在追蹤模式下仍會被移動回報清掉（`terminal.select` 只有一般模式，讀回不符就不放回）；macOS 依 T0568 走 Option，不在本單範圍。

### 驗證

| 項目 | 結果 |
|---|---|
| 根因 | **PASS**：xterm 原始碼 + 修正前隔離實例實測（上表）；直接拖曳的反白來源有結論 |
| 元件 / 單元測試（`src/__tests__/terminal-context-menu.test.tsx`，17 → 29） | **PASS**：keeper（SGR 判斷、跨行放回與連續放回、打字 / 無後續的清除不放回、`forget`、欄選取讀回不符不放回、`queueMicrotask` 綁定）；TerminalPanel：追蹤 + Shift + 有選取 → 複製且寫入剪貼簿、移動回報後仍有複製（回報照常寫 PTY）、打字 / 左鍵 / 不按 Shift 右鍵 / 滾輪後不放回、Shift + 右鍵 mousedown 保留、複製寫入右鍵當下的文字且下一次右鍵不沿用、追蹤中不按 Shift 仍無選單、一般 shell 照舊 |
| `npm run test:unit` | **PASS**：265 files，4626 passed / 3 skipped（基線 4614 + 12） |
| `npm run typecheck` | **PASS**：0 |
| `npm run typecheck:electron` | **PASS**：0 |
| `npx vite build` | **PASS** |
| e2e `e2e/t0571-shift-right-click-copy.spec.ts`（新，隔離實例） | **PASS**（5.7 s）：腳本 alt screen + 1000 / 1002 / 1003 / 1006；① Shift + 拖曳 → 移動 3 格（腳本收到 `ESC[<35;…M`）→ Shift + 右鍵 → 「複製 / 貼上」→ 點複製 → 剪貼簿 = `alpha beta`，期間沒有按鍵回報送進腳本；② 再移動後 Shift + 右鍵仍有複製，Esc 關選單、腳本沒收到 ESC；③ 打字後 → 只有「貼上」；④ 一般拖曳送給腳本（press / drag / release）→ 只有「貼上」；⑤ 不按 Shift 右鍵 → 無選單、腳本收到 `ESC[<2;…M`；⑥ 追蹤關閉 → 一般選單。測試前先存使用者剪貼簿、結束後寫回；macOS skip |
| e2e `e2e/t0568-context-menu-mouse-tracking.spec.ts` | **PASS**（4.3 s） |
| 使用者實機（claude CLI 分頁） | 未做（需新版安裝檔；交塔台 / 使用者驗收） |

e2e 附註：隔離實例的 PTY 有時停在 spawn 尺寸 120x30，xterm 已 fit 成 137 欄（啟動時的 resize 競態，與本單無關，未處理）；spec 先觸發工具列的 `terminal-redraw` 讓 PTY 同步尺寸再算格子座標。alt screen 上的文字不在頁面 DOM 文字裡，spec 改用腳本寫檔當就緒 / 結束訊號。

### 變更檔案

- `src/lib/terminal-context-menu.ts`
- `src/components/TerminalPanel.tsx`
- `src/__tests__/terminal-context-menu.test.tsx`
- `e2e/t0571-shift-right-click-copy.spec.ts`（新）
- `CLAUDE.md`（「終端分頁右鍵選單與滑鼠追蹤」補一條 T0571，驗證列加新 e2e）
- `_ct-workorders/T0571-shift-right-click-copy-in-mouse-tracking-tab.md`、`_ct-workorders/BUG-144-shift-right-click-menu-missing-copy-in-claude-tab.md`

### Commit

- `35eaf125` fix(terminal): keep the Shift + drag selection across mouse reports so Shift + right-click offers Copy (T0571, BUG-144)
- 工單 / BUG 記帳另一個 `(ct)` commit。`src/styles/settings.css` 的 M 不是本單變更，未納入。未 push、未觸發 workflow、未建 tag、未改版號。

### 偏差 / 後續

- 無範圍偏差。e2e 選用新檔 `e2e/t0571-*.spec.ts`（工單允許）。
- 建議（給塔台）：直接拖曳的情況不需 BAT 處理（claude 自己 copy on select）；若之後要支援追蹤模式下的欄選取，需另案。
