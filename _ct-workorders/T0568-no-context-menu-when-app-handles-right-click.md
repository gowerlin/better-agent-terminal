---
schema_version: 1
schema_kind: workorder
id: T0568
title: "BUG-142：分頁內程式已開滑鼠追蹤並接收右鍵時（例 claude CLI 右鍵貼上），BAT 不再顯示右鍵選單；一般 shell 照舊"
type: bugfix
status: FIXED
repo: better-agent-terminal
project: BUG-142
priority: P2
sizing: S
created_at: "2026-10-16T17:31:58+0800"
updated_at: "2026-10-16T17:39:16+0800"
started_at: "2026-10-16T17:33:07+08:00"
completed_at: "2026-10-16T17:39:16+0800"
commit: "9988a117"
target_version: "0.6.1-pre.7（未排發版）"
depends_on: []
related:
  - "BUG-142（現象、使用者選定的期望、推測根因）"
affects_files:
  - src/components/TerminalPanel.tsx
  - "src/components/**（若右鍵選單元件在別的檔案；列出實際檔案）"
  - "src/**/__tests__/** 新增或擴充的測試"
  - "e2e/t0568-*.spec.ts（若可行）"
  - "CLAUDE.md（若新增行為需要記錄，簡短一節即可）"
  - _ct-workorders/T0568-no-context-menu-when-app-handles-right-click.md
  - _ct-workorders/BUG-142-right-click-pastes-and-shows-menu-in-claude-tab.md
renew_count: 0
workdir: main repo
interaction:
  mode_hint: on
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 不 push、不觸發 workflow、不建 tag、不改版號；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF；含反斜線的內容用 Write 工具（L129）。commit 用 `git commit --only <你改的檔>`（`src/styles/settings.css` 的 M 不是你的變更）。"
  - "🔴 不碰使用者正在用的 BAT（port 9876）與它的 Terminal Server；e2e 只用隔離實例（需先 `npx vite build`）。"
  - "🔴 不改 xterm 送給 PTY 的滑鼠回報本身（程式照常收到右鍵）；只改 BAT 選單要不要出現。"
---

# T0568 — BUG-142：程式自己處理右鍵時不顯示 BAT 選單

## 背景

使用者在 claude CLI 分頁（claude 2.1.300，BAT 0.6.1-pre.6）按右鍵：內容已貼上，同時出現 BAT 的右鍵選單（只有「貼上」）。BAT 的 `contextmenu` listener（`src/components/TerminalPanel.tsx`，「Right-click context menu for copy/paste」）只開選單、不貼上，推測貼上是 claude CLI 開了滑鼠追蹤後自己處理右鍵（細節見 BUG-142）。

使用者選定的期望：**分頁內程式自己處理右鍵時，BAT 不顯示選單；一般 shell 照舊顯示 複製 / 貼上 選單。**

## 任務

1. **先確認根因**：證實貼上來自分頁內程式，而不是 BAT（例如隔離實例中 node 腳本開滑鼠追蹤 DECSET 1000 / 1006，記錄 stdin 收到的右鍵滑鼠回報；必要時確認真 claude CLI 是否開滑鼠追蹤、右鍵是否貼上，不耗額度的方式即可）。若根因不同，照實際根因修並在回報區說明。
2. **修正**：程式開了滑鼠追蹤（xterm `terminal.modes.mouseTrackingMode !== 'none'`，或你找到的等價判斷）時，右鍵不開 BAT 選單。由你決定細節並在回報區說明取捨，至少考慮：
   - 只看「滑鼠追蹤是否開啟」，還是要更精確（例如只在追蹤模式會回報右鍵按鍵時）
   - **Shift + 右鍵** 強制顯示 BAT 選單（xterm 慣例：Shift 繞過滑鼠追蹤）——建議做，讓使用者在 TUI 內仍能用 BAT 的複製（有選取時）
   - 有選取文字時的行為（滑鼠追蹤開啟時 xterm 一般需 Shift 才能選取）
   - 不影響一般 shell 分頁、Claude / Codex 面板（非 xterm）及其他既有右鍵選單（縮圖、檔案樹等）
3. **測試**：單元 / 元件測試：滑鼠追蹤關閉 → 顯示選單；開啟 → 不顯示；開啟 + Shift → 顯示。若可行，e2e（隔離實例，node 腳本開滑鼠追蹤並記錄 stdin）：右鍵 → 腳本收到滑鼠回報、畫面沒有 BAT 選單；一般 shell 分頁右鍵 → 選單出現。做不到就在回報區說明原因。
4. BUG-142 狀態改 FIXED、填修正 commit；必要時在 CLAUDE.md 加一小段說明。

## 驗收條件

- [ ] 根因有證據
- [ ] 滑鼠追蹤開啟的分頁右鍵不再出現 BAT 選單；一般 shell 照舊；Shift + 右鍵行為依你的取捨並有測試
- [ ] `npm run test:unit` 全綠（基線 4597 passed / 264 files，加上新測試）、`npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npx vite build` 成功
- [ ] BUG-142 → FIXED

---

## 回報區

> 以下由 sub-session 填寫

### 結果摘要

**FIXED**（commit `9988a117`）。根因與推測一致：貼上是 claude CLI 自己做的。xterm 分頁的右鍵現在會先看滑鼠追蹤模式，程式開著追蹤就不開 BAT 選單；Shift + 右鍵照開。

### Landing check

- C-0：`repo: better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal` → PASS
- C-1：工單在 `REPO_ROOT/_ct-workorders/` 底下 → PASS
- C-3：`src/components/TerminalPanel.tsx` 存在 → PASS（只供參考）
- C-2：工單沒有 `branch` 欄位 → 不適用（實際在 `main`）
- `BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）
- 結論：PASS
- 工單原狀態為 `TODO`（不是 `PENDING`），已照開始流程改成 `IN_PROGRESS`。

### 根因證據

1. **實機探測**（不耗額度）：用 `@lydell/node-pty` 在 repo 根目錄（已信任的資料夾）啟動內嵌的 `claude.exe` 2.1.300，12 秒內不送任何輸入。程式送出的 DEC 模式依序為：`?9001h ?1004h ?25l ?25h ?2004h ?2031h ?2031l ?2004l ?1049h ?1000h ?1002h ?1003h ?1006h`。REPL 進入 alt screen 後開了全部滑鼠追蹤，xterm 的 `mouseTrackingMode` 因此為 `any`。另外，在還沒信任的資料夾裡，信任對話框階段**沒有**開滑鼠追蹤。
2. **二進位內的程式碼**（`claude.exe` 2.1.300 的字串）：
   - `Lh = { MOUSE_NORMAL:1000, MOUSE_BUTTON:1002, MOUSE_ANY:1003, MOUSE_SGR:1006, … }`
   - `obn(mode)` 決定開哪些模式：`full` = 1000 + 1002 + 1003 + 1006，`scroll` = 1000 + 1006，`off` = 不開。預設為 `full`；設 `CLAUDE_CODE_DISABLE_MOUSE_CLICKS` 改成 `scroll`，設 `CLAUDE_CODE_DISABLE_MOUSE` 改成 `off`。
   - 右鍵處理（`z1`）：按下記錄 `pendingPastePress`，放開時若在同一格附近且 `p.button===2&&(C==="windows"||C==="wsl"||C==="linux")`，有選取就複製選取，沒有選取就 `yPt("clipboard").then(T => dispatchPasteEvent(T))`。
3. **e2e**：xterm 把右鍵寫進 PTY 的回報為 `["\u001b[<2;69;18M","\u001b[<2;69;18m"]`，也就是 SGR 格式的 button 2 按下與放開，claude 收到的就是這個。
4. BAT 的 `contextmenu` listener 只呼叫 `setContextMenu`，本身不會貼上。

### 修正與取捨

- `src/lib/terminal-context-menu.ts`（新檔）提供 `isMouseTrackingOn(mode)` 與 `shouldShowTerminalContextMenu(mode, shiftKey)`，判斷規則為 `shiftKey || !isMouseTrackingOn(mode)`。
- `src/components/TerminalPanel.tsx` 的 `contextmenu` 一樣先 `preventDefault`，再讀 `terminal.modes.mouseTrackingMode`；不開選單時記一行 `dlog` `[terminal-context-menu] terminal=… not shown: …`。
- **只看追蹤模式是否開啟，不做更細的判斷**：xterm 的 4 種追蹤模式（`x10` / `vt200` / `drag` / `any`）都會回報右鍵按下，模式本身就等於「程式收得到右鍵」，沒有更細的訊號可用。不認得的值（包括測試替身）一律視為沒開，維持舊行為。
- **Shift + 右鍵照開選單**：xterm 5.5.0 的 `shouldForceSelection` 在 Windows / Linux 上就是 `shiftKey`，所以按住 Shift 時 xterm 不送回報，程式收不到右鍵，BAT 選單成為唯一的動作（e2e 實測 stdin 沒有收到任何東西）。macOS 上 xterm 改用 Option 繞過（`macOptionClickForcesSelection`），Shift + 右鍵時程式也會收到回報；不過 claude 在 macOS 不對右鍵貼上，所以不會重複動作。
- **有選取文字時**：追蹤模式下 xterm 要用 Shift + 拖曳才能選取，接著 Shift + 右鍵就會出現「複製 / 貼上」。不按 Shift 的右鍵照樣交給程式；就算 xterm 有選取也一樣，因為 claude 這時還是會貼上，再開選單又會變成兩個動作。
- **影響範圍**：只動 xterm 分頁的 listener。Claude / Codex 面板（不是 xterm）、縮圖、檔案樹等其他右鍵選單，以及寫進 PTY 的滑鼠回報都不變。一般 shell 沒開追蹤，行為照舊。
- **已知邊界**：claude 設了 `CLAUDE_CODE_DISABLE_MOUSE_CLICKS` 時是 `scroll` 模式（1000 仍會回報右鍵），BAT 不開選單，但 claude 也不見得會貼上；這種情況使用者可以用 Shift + 右鍵。
- CLAUDE.md 新增一節「終端分頁右鍵選單與滑鼠追蹤（T0568 / BUG-142）」。

### 變更檔案

- `src/lib/terminal-context-menu.ts`（新）
- `src/components/TerminalPanel.tsx`
- `src/__tests__/terminal-context-menu.test.tsx`（新，9 個測試）
- `e2e/t0568-context-menu-mouse-tracking.spec.ts`（新）
- `CLAUDE.md`
- `_ct-workorders/BUG-142-right-click-pastes-and-shows-menu-in-claude-tab.md`、本工單

### 驗證

| 項目 | 結果 |
|---|---|
| `npm run test:unit` | PASS：265 個檔案、4606 passed、3 skipped（基線 264 / 4597，新增 1 個檔案、9 個測試） |
| `npm run typecheck` | PASS（exit 0） |
| `npm run typecheck:electron` | PASS（exit 0） |
| `npx vite build` | PASS（exit 0） |
| 元件測試 | 追蹤關閉時顯示選單（有選取時多「複製」）；4 種追蹤模式都不顯示，原生選單仍被 `preventDefault`，並記錄 dlog；追蹤開啟 + Shift 時顯示；模式在點擊當下才讀，關掉追蹤後選單恢復 |
| e2e `e2e/t0568-context-menu-mouse-tracking.spec.ts` | PASS（4.7 s，隔離實例）：一般 shell 有選單；腳本開 1000 + 1006 後右鍵，腳本收到 `ESC[<2;69;18M` / `m` 且沒有選單；Shift + 右鍵有選單、腳本沒收到回報；關掉追蹤後選單恢復。macOS 上 skip（Shift 不會繞過追蹤） |
| 實機 BAT（使用者的 9876） | 沒碰。要等下一版 pre 安裝後由使用者在 claude CLI 分頁確認 |

### 觀察（不在範圍內，沒有修）

- 終端有焦點時，按 Esc 關不掉 BAT 的右鍵選單：Esc 會先進 xterm 的 textarea，xterm 處理按鍵時會 `stopPropagation`，`document` 上的 BUG-011a listener 收不到。e2e 因此改用點外部來關選單。這是既有行為，要修的話請另開工單。

### Commit

- `9988a117` fix(terminal): no BAT context menu while the program tracks the mouse (T0568, BUG-142)
- 收尾 commit：BUG-142 與本工單（ct）
- 沒有 push、tag、workflow，也沒改版號。`src/styles/settings.css` 的 M 不是本工單的變更，沒有動。
