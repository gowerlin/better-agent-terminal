---
schema_version: 1
schema_kind: workorder
id: T0672
title: "修正：BUG-166 — 滑鼠回報被 shell 印成文字時自動關閉本機滑鼠追蹤（F1）+ 右鍵選單「重設滑鼠模式」（F2）"
type: implementation
status: FIXED
repo: better-agent-terminal
project: BUG-166
priority: P2
sizing: S
created_at: "2026-10-19T17:35:11+0800"
started_at: "2026-10-19T17:36:44+0800"
updated_at: "2026-10-19T17:50:26+0800"
completed_at: "2026-10-19T17:50:26+0800"
depends_on: []
related:
  - "BUG-166（OPEN；T0671 研究結論與 F1 / F2 提案）"
  - "T0671（研究單，回報區「修正方向」表 = 本單規格來源）"
  - "BUG-142 / T0568 / T0569 / T0571 / T0573（右鍵選單、Esc、Shift 拖曳選取；不得退化）"
affects_files:
  - src/components/TerminalPanel.tsx
  - src/lib/terminal-context-menu.ts
  - src/lib/mouse-tracking-reset.ts
  - src/lib/__tests__/mouse-tracking-reset.test.ts
  - src/__tests__/terminal-context-menu.test.tsx
  - src/locales/en.json
  - src/locales/zh-TW.json
  - src/locales/zh-CN.json
  - e2e/t0672-mouse-tracking-reset.spec.ts
  - e2e/t0571-shift-right-click-copy.spec.ts
  - CLAUDE.md
  - docs/agent-guide/terminal-context-menu.md
  - _ct-workorders/T0672-fix-bug166-reset-leftover-mouse-tracking.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 只改 `affects_files` 列出的檔案（新檔名可依實作調整，回報寫明）；不改 BUG-166 / 其他工單 / 塔台狀態檔。commit 後**不 push**。"
  - "🔴 不改 xterm 寫進 PTY 的滑鼠回報內容與時機（BUG-142 原則）；本單只在**本機 xterm** 用 `terminal.write(DECRST…)` 關閉追蹤，**不得寫進 PTY**。"
  - "🔴 yolo Worker：不得問使用者；範圍內判斷問題依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。"
  - "🔴 不得在任何地方寫出權杖值。"
---

# T0672 — 修正 BUG-166：滑鼠追蹤殘留的自動 / 手動重設

## 目標

codex 等 TUI 被訊號結束或崩潰時不還原滑鼠追蹤，xterm 停在追蹤模式，滑鼠移動 / 滾輪的 SGR 回報被 shell 當成文字插進命令列（BUG-166，T0671 實測）。BAT 不需要知道 TUI 怎麼結束：看到症狀就在本機 xterm 關掉追蹤（F1），並提供手動重設（F2）。

## 規格

先完整讀 `T0671-research-bug166-mouse-tracking-left-on-after-agent-exit.md` 回報區（特別是「修正方向」表、§3 結果表、zsh / bash 的回顯樣式），以及 `docs/agent-guide/terminal-context-menu.md`。

### F1：回報被回顯成文字 → 本機關閉追蹤

- 觸發：xterm 處於滑鼠追蹤（`terminal.modes.mouseTrackingMode !== 'none'`），BAT 剛經 `onData` 送出的 SGR 滑鼠回報（`ESC[<Cb;Cx;CyM/m`）的本體（去掉 `ESC[<`，例 `35;52;69M`）在短時間內（約 500 ms，常數具名）出現在 PTY 輸出中。比對前先去掉 shell 可能插入的 `\x07` / `\x08` 等控制字元（zsh 會輸出 `3^H35;…`，見 T0671）。
- 動作：`terminal.write('\x1b[?1000l\x1b[?1002l\x1b[?1003l\x1b[?1006l\x1b[?1015l\x1b[?1016l')`（只寫本機 xterm，**不寫 PTY**），`selectionKeeper.forget(...)`（或等效清除），記一行日誌 `[mouse-tracking] reset: reports echoed as text`（經 `window.electronAPI.debug.log`；不記輸出內容）。
- alt screen（1049）**不**自動離開。
- 比對與 SGR 解析放 `src/lib/` 純函式（不 import DOM / electron），單元測試覆蓋：命中、未命中、控制字元穿插、跨多次輸出 chunk、超過時間窗、非追蹤狀態不觸發、正常 agent 執行中（回報未被回顯）不觸發。
- 誤判邊界：只有「追蹤中且程式原樣回顯輸入」才會觸發；回報寫明。

### F2：右鍵選單「重設滑鼠模式」

- 終端分頁的 BAT 右鍵選單（`shouldShowTerminalContextMenu` 那套）加一項「重設滑鼠模式」，動作同 F1 的本機 DECRST + 清除 keeper + 日誌 `[mouse-tracking] reset: manual`。
- 追蹤中仍可用 Shift + 右鍵叫出選單（既有行為）。是否一併提供離開 alt screen（`?1049l`）由 Worker 判斷：做的話放成獨立選項，回報說明理由。
- i18n：`en.json` / `zh-TW.json` / `zh-CN.json` 三語系都要有（zh-TW 用「重設滑鼠模式」）。

### 文件

- `CLAUDE.md`「終端分頁右鍵選單與滑鼠追蹤（T0568 / BUG-142）」節：🔴 那句「不改 xterm 寫進 PTY 的滑鼠回報」後補例外一句（回報已被回顯成文字時於本機關閉追蹤；手動重設），並寫唯一實作位置。**不改 `##` 標題**；維持本節 ≤ 12 行原則，細節寫進 `docs/agent-guide/terminal-context-menu.md`（原因、觸發條件、時間窗常數、日誌、已知限制：第一筆殘骸仍會進命令列、alt screen 不自動離開、Windows 原生 ConPTY 不會發生）。

## 不得退化

- BUG-142 / T0568：追蹤中不開 BAT 右鍵選單、Shift + 右鍵一律開。
- T0569：選單開著時 Esc 關選單。
- T0571 / T0573：追蹤中 Shift 拖曳選取、`MouseReportSelectionKeeper`、`registerCsiHandler` 偵測重送 DECSET、`SelectionDrag.resume()`。
- codex / claude 執行中的滑鼠行為（回報照常送、捲動照常）。
- Ctrl+滾輪縮放、Win11 `clearTextureAtlas`。

## 驗收

1. `npm run test:unit` 全過（基線 5635 passed / 321 files / 3 skipped，回報新數字）。
2. `npm run typecheck` = 0、`npm run typecheck:electron` = 0。
3. `npx vite build` 成功。
4. 新 e2e `e2e/t0672-mouse-tracking-reset.spec.ts`（需先 `npx vite build`）：shell 分頁 `printf` 開 `?1003h?1006h` → 模擬滑鼠移動 → 第一筆之後 `mouseTrackingMode` = `none`、shell stdin 不再收到回報；F2 選單項目可重設。Windows 本機若 ConPTY 吃掉回報無法重現 F1，改用 WSL 分頁或記錄限制並以單元測試 + F2 e2e 補足，回報寫明。
5. 既有 `e2e/t0568-context-menu-mouse-tracking.spec.ts`、`e2e/t0571-shift-right-click-copy.spec.ts`、`src/__tests__/terminal-context-menu.test.tsx` 不退化。

## 收尾

- commit（產品 + 測試 + 文件 + 本工單），訊息含 `T0672` / `BUG-166`；不 push。
- 回報區寫：改動摘要、驗收結果數字、e2e 結果、限制、建議 BUG-166 狀態（FIXED 待 外部測試者A 實機）。

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 待塔台決策

#### Q-1：F2 新選項會讓 `e2e/t0571-shift-right-click-copy.spec.ts` 的選單清單斷言失敗，該檔不在 affects_files，要怎麼處理？
- 提問時間：2026-10-19T17:40:14+0800
- 選項：[A] 把 `e2e/t0571-shift-right-click-copy.spec.ts` 加進範圍，只改 6 處 `menuItems` 精確清單斷言，追蹤中 Shift + 右鍵的清單改為含「重設滑鼠模式」（alt screen 時另含「離開替代畫面」），複製 / 選取行為斷言不動 / [B] 不動 t0571：新選項不用 `.context-menu-item` class（另用 class + inline style 仿同樣式，因 `context-menu.css` 也不在範圍） / [C] 其他：________
- Worker 建議：[A]。t0571 在追蹤中 + alt screen 以 Shift + 右鍵開選單，`.context-menu .context-menu-item` 的 `allInnerTexts()` 斷言精確等於 `['複製', '貼上']`（6 處）；F2 的選項正好出現在這個狀態。只改清單斷言不是行為退化，[B] 會讓同一選單有兩套樣式來源、之後容易走樣。
- 影響範圍：`e2e/t0571-shift-right-click-copy.spec.ts`（新增範圍）、驗收第 5 項；`src/__tests__/terminal-context-menu.test.tsx` 同樣有精確清單斷言（已在範圍，會一併調整）
- 阻塞：否（先做 F1 / F2 實作與單元測試；t0571 e2e 的調整與執行等答覆）

### 完成狀態

`FIXED`（F1 + F2 實作完成，驗收 1–5 全過；等 外部測試者A 在 macOS 實機確認）。建議 BUG-166 → ✅ FIXED（待 外部測試者A 實機）。

### 改動摘要

- **F1**（`src/lib/mouse-tracking-reset.ts`，新檔，純函式）：`MouseReportEchoDetector` — `noteInput` 記下送出的 SGR 回報本體（`35;52;69M`，最多 64 筆），`noteOutput` 在 `MOUSE_REPORT_ECHO_WINDOW_MS` = 500 ms 內於輸出尾巴（最多 2 048 字元，跨 chunk）找到本體即回 `true`；比對前 `echoMatchText` 去掉 CSI / OSC / 其他 ESC 序列與控制字元（`\x07` / `\x08` …）。去掉 CSI 也避免 TUI 的 SGR 顏色（`ESC[38;2;35;52;69m`）誤判。另有常數 `MOUSE_TRACKING_RESET`（工單指定的 6 個 DECRST）、`ALT_SCREEN_EXIT`。
- **TerminalPanel**（`src/components/TerminalPanel.tsx`）：`onData` → `noteInput`；`writeOutput` 在 `terminal.write` 後 → `noteOutput`，命中即 `resetMouseTracking('reports echoed as text')`：`terminal.write(MOUSE_TRACKING_RESET)`（只寫本機 xterm）、`echoDetector.clear()`、清掉 Shift 拖曳紀錄、`selectionKeeper.forget('mouse tracking reset')`，日誌 `[mouse-tracking] reset: reports echoed as text terminal=<id> mode=<原模式>`（不記輸出內容）。alt screen 不自動離開。
- **F2**：右鍵選單在「貼上」後加分隔線與選項 —— 追蹤中（Shift + 右鍵）「重設滑鼠模式」（同 F1 動作，日誌 `reset: manual`）；alt screen 時「離開替代畫面（alt screen）」（本機 `?1049l`，日誌 `[mouse-tracking] alt screen left: manual`）。按鈕帶 `data-menu-action`。
  - **離開 alt screen 的判斷**：做成獨立選項，只在 alt buffer 時出現。理由：codex 被訊號結束時 1049 也殘留，shell 畫在 alt buffer 上、沒有 scrollback，離開才看得到 codex 之前的畫面（T0671 給 外部測試者A 的測試 3 也要他手打 `printf '\e[?1049l'`）；但它會讓目前的提示列消失（按 Enter 重畫），對仍在執行的 TUI 會打亂畫面，所以不併入「重設滑鼠模式」、也不自動執行。
- **i18n**：`terminal.resetMouseMode`（en `Reset mouse mode` / zh-TW `重設滑鼠模式` / zh-CN `重置鼠标模式`）、`terminal.exitAltScreen`（`Leave alternate screen` / `離開替代畫面（alt screen）` / `离开替代屏幕（alt screen）`）。「複製 / 貼上」原本就是寫死的中文，未改。
- **文件**：`CLAUDE.md`「終端分頁右鍵選單與滑鼠追蹤（T0568 / BUG-142）」節在 🔴 那句後補例外與唯一實作位置（標題未改，該節仍 5 條）；`docs/agent-guide/terminal-context-menu.md` 新增「滑鼠追蹤殘留的重設（T0672 / BUG-166）」節（原因、觸發條件、時間窗、日誌、誤判邊界、alt screen 選項理由、已知限制、驗證）。
- **測試**：新 `src/lib/__tests__/mouse-tracking-reset.test.ts`（17 個：命中 bash / zsh / 滾輪、跨 chunk、跨 chunk 的 ESC 序列、未命中、超過時間窗、時間窗邊界、回報前的輸出不算、非追蹤、agent 執行中 200 次移動 + 重繪不觸發、命中後重來、`clear`、64 筆上限）；`src/__tests__/terminal-context-menu.test.tsx` 新增 describe「mouse tracking left on (BUG-166 / T0672)」9 個（F1 命中且不寫 PTY、日誌不含內容、跨 chunk、agent 不觸發、非追蹤、超過時間窗、keeper forget、F2 重設、一般 shell 無新選項、alt screen 選項）。

### 範圍變更（塔台 Q-1 答覆 [A]）

- `e2e/t0571-shift-right-click-copy.spec.ts`（新增進範圍）：只改 6 處 `menuItems` 精確清單斷言 —— 第 1 / 2 / 6 / 7 步 `['複製', '貼上']` → `['複製', '貼上', ...MOUSE_ITEMS]`，第 3 / 4 步 `['貼上']` → `['貼上', ...MOUSE_ITEMS]`（`MOUSE_ITEMS = ['重設滑鼠模式', '離開替代畫面（alt screen）']`，該 e2e 在追蹤中 + alt screen）；複製 / 剪貼簿 / 選取 / 不送回報等行為斷言沒動。
- `src/__tests__/terminal-context-menu.test.tsx`：10 處追蹤中 Shift + 右鍵的精確清單加上 `RESET`（`'terminal.resetMouseMode'`：單元測試沒有初始化 i18n，`t` 回 key）—— 原行號 299、362、656、673、686、717、725、762、843、860（加測試前的行號）；行為斷言沒動。測試的 xterm mock 另加 `write` 擷取與 `buffer.alternate` 固定物件、`pty.onOutput` 擷取。

### 驗收結果

| # | 項目 | 結果 |
|---|---|---|
| 1 | `npm run test:unit` | ✅ PASS：**322 files / 5661 passed / 3 skipped**（基線 321 / 5635 / 3；+1 檔、+26 個） |
| 2 | `npm run typecheck` / `npm run typecheck:electron` | ✅ 0 / 0（exit code 實測） |
| 3 | `npx vite build` | ✅ 成功 |
| 4 | 新 e2e `e2e/t0672-mouse-tracking-reset.spec.ts` | ✅ PASS（單跑 11.1 s；另 `--repeat-each=2` 2/2）。第 1 步記錄：自動重設前有 **3 筆**回報到達腳本，之後再掃兩次 0 筆、不按 Shift 的右鍵開 BAT 選單且腳本沒收到按鍵回報、日誌有 `reset: reports echoed as text`；第 2 步：腳本不回顯時回報持續送達（不誤判，`reset:` 日誌仍只有 1 行）→ Shift + 右鍵 →「重設滑鼠模式」→ 之後 0 筆、日誌 `reset: manual` |
| 5 | 既有 `t0568` / `t0571` e2e、`terminal-context-menu.test.tsx` | ✅ t0568 PASS；t0571 PASS（單跑 1 次 + `--repeat-each=2` 2/2）；unit 50/50。⚠️ 第一次 t0571 與全套 unit test **同時**跑時在第 6 步（T0573：失焦後以 Shift + 拖曳回到分頁，DECSET 在拖曳中途到達）失敗一次（選單少了「複製」）；機器閒置後連續 3 次通過，判定為高負載下的時序敏感，與本單無關（本單未改 keeper / 拖曳邏輯，t0571 腳本不回顯輸入，F1 不會觸發） |

- F1 的 e2e 方法：Windows 本機 pwsh 在 ConPTY 下不會重現（T0671：conhost 把回報轉成 console mouse event），所以 e2e 用 shell 分頁內的 node 腳本模擬殘留追蹤下的 shell：開 1003 + 1006、raw mode 記錄 stdin，並照 bash readline 的樣子回顯（`ESC [ <` → BEL，其餘原樣）。真實 bash / zsh 的回顯樣式由單元測試覆蓋（T0671 實測字串）。沒有用 WSL 分頁跑真 shell。
- `validated_sha` = `head_sha` = `64209d44349d45b59075a18e8eeb5dbcb5f16d19`（驗收在 commit 前的同一份工作樹上跑，commit 後沒有再改產品檔）。

### 限制

- 命中前的第一筆（幾筆）殘骸仍會進命令列（e2e 3 筆），使用者要 Ctrl+U 清一次。
- alt screen 不自動離開（工單規格）；可用「離開替代畫面」。
- DECSET 1004（focus 回報）與 2004 也會殘留（T0671），工單指定的 DECRST 不含它們，本單未處理；focus 回報在 shell 裡是否造成可見殘骸未驗證，可另開單。
- 誤判邊界：只有「追蹤中且程式把輸入原樣回顯」才觸發（手動 `printf` 測試、`cat`、滑鼠除錯工具）；或 TUI 在 500 ms 內剛好畫出與某筆回報完全相同（含座標）的文字，機率極低。
- Windows 原生 ConPTY 分頁本來就不會發生；macOS 未實機驗證（沒有 Mac），需 外部測試者A 確認。

### 互動紀錄

- [17:40] Q-1: F2 新選項讓 `e2e/t0571-shift-right-click-copy.spec.ts`（不在 affects_files）的精確選單清單斷言失敗，怎麼處理？ → A（塔台，BAT 通道，choice 1）: 採 [A]，把 t0571 加進範圍，只改選單清單精確斷言，行為斷言不動，回報列出改了哪幾處；`terminal-context-menu.test.tsx` 同理；「離開替代畫面」若做，三語系都要有並說明理由 → Action: 依此修改（見「範圍變更」），三語系已加，理由見「改動摘要」。

### 落點檢查

- `PASS`。C-0：`repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal` → PASS。C-1：工單位於 `REPO_ROOT/_ct-workorders/` → PASS。C-3：前 5 個可測項目（`src/components/TerminalPanel.tsx`、`src/lib/terminal-context-menu.ts`、`src/lib/mouse-tracking-reset.ts`、`src/lib/__tests__/mouse-tracking-reset.test.ts`、`src/__tests__/terminal-context-menu.test.tsx`）皆有既存檔或祖先目錄 → present（資訊性）。C-2：無 `branch` 欄位。`CT_HOME` 未設定（非 worktree 派工）。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只是紀錄）。

### 範圍與規則遵守

- 改動檔案 = affects_files + 塔台 Q-1 核准的 `e2e/t0571-shift-right-click-copy.spec.ts`；`src/lib/terminal-context-menu.ts` 列在範圍內但不需要改。沒有改 BUG-166 / 其他工單 / 塔台狀態檔。
- 沒有寫 PTY：F1 / F2 的 DECRST 與 `?1049l` 只經 `terminal.write`；單元測試斷言 `pty.write` 沒有收到任何 `\x1b[?100…`。
- 沒有寫出任何權杖值。commit 後未 push。
- 暫存：patch 腳本與測試輸出留在 session scratchpad，未放進 repo。

### 遭遇問題

- 在 bash 裡用內嵌 heredoc 跑含 JS 樣板字串的 Python 時被 shell 解析失敗（`unexpected EOF while looking for matching`），改把腳本寫到 scratchpad 再執行。
- t0571 第一次與全套 unit test 同時跑時第 6 步失敗一次（見驗收 #5），閒置後重跑 3 次皆通過。

### commit

- 產品：`64209d44349d45b59075a18e8eeb5dbcb5f16d19` — `fix: T0672 BUG-166 turn off mouse tracking a program left on`（11 檔）。
- 工單：開工 + Q-1 `b9f331b2`；收尾 commit 在本回報之後（hash 不回寫，避免多一個 commit）。
