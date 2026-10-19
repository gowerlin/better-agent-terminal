---
schema_version: 1
schema_kind: workorder
id: T0671
title: "研究：BUG-166 — Agent 結束後滑鼠回報被當成文字送進 shell（滑鼠追蹤殘留）的根因與修正方向（唯讀）"
type: research
status: DONE
repo: better-agent-terminal
project: BUG-166
priority: P2
sizing: S
created_at: "2026-10-19T15:52:11+0800"
started_at: "2026-10-19T15:53:21+0800"
updated_at: "2026-10-19T16:34:26+0800"
completed_at: "2026-10-19T16:34:26+0800"
depends_on: []
related:
  - "BUG-166（OPEN；Gary 截圖、塔台初判）"
  - "BUG-165 / T0670（同時進行：Codex CLI 捲動順暢度研究，也會碰滑鼠追蹤；兩邊只讀、不互改檔案）"
  - "BUG-142 / T0568 / T0569 / T0571 / T0573（右鍵選單與滑鼠追蹤、Shift 拖曳選取；`src/lib/terminal-context-menu.ts`、TerminalPanel `registerCsiHandler`）"
affects_files:
  - _ct-workorders/T0671-research-bug166-mouse-tracking-left-on-after-agent-exit.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
research_max_questions: 3
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 研究單、**唯讀**：不改任何產品檔、不改 BUG-166 / T0670 / 其他工單 / 塔台狀態檔；只 commit 本工單檔（`git commit --only`）。不 push。"
  - "🔴 Gary 截圖含客戶專案路徑：不得複製進 repo；引用時去識別化。"
  - "🔴 yolo Worker：不得問使用者。要不要修、怎麼修是**使用者決定**，你只提推薦；判讀問題依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。需要 Gary 做的事寫成「給 Gary 的問題 / 測試」清單。"
  - "🔴 不得在任何地方寫出權杖值。"
---

# T0671 — 研究：BUG-166 滑鼠追蹤殘留

## 研究目標

Gary（macOS，`v0.7.1-pre.3`）回報：點到「已完成工單」的 Worker 分頁時，有時 shell 命令列不斷冒出 `35;52;69M35;55;66M…64M39;3;64M` 這類字串。塔台初判是 SGR 滑鼠回報殘留（見 BUG-166「塔台初判」）。請**證實或推翻**初判，找出是誰讓追蹤模式留著，並給出可決策的修正方向。

## 已知資訊

- 先讀 `BUG-166-mouse-reports-leak-as-text-after-agent-exit.md`。
- 截圖：提示列是 zsh + powerlevel10k，codex 已結束（回到 shell）；字串持續增長，含 `35;…M`（移動）與 `64;…M`（滾輪）。
- BAT 既有滑鼠追蹤相關邏輯：`shouldShowTerminalContextMenu` / `MouseReportSelectionKeeper`（`src/lib/terminal-context-menu.ts`），TerminalPanel 的 `registerCsiHandler`（偵測重送的追蹤 DECSET）、`SelectionDrag.resume()`；完整說明 `docs/agent-guide/terminal-context-menu.md`。

## 調查範圍

1. **重現**：在 WSL（原生 PTY，bash / zsh 皆可）與本機 Windows（ConPTY）各試：
   - codex 正常結束（`/quit` 或 Worker 完成後結束）→ 回到 shell 後移動滑鼠 / 滾輪，是否出現殘骸。
   - codex 被中斷（Ctrl+C、kill、PTY 中途 SIGHUP 等）→ 同上。
   - 對照：手動 `printf '\e[?1003h\e[?1006h'` 後回到 shell，確認現象相同（證實是追蹤模式殘留）。
   - 記錄 xterm `terminal.modes.mouseTrackingMode` 在各步驟的值（可用 e2e / 測試 harness 或隔離實例的 DevTools）。
2. **誰留下追蹤模式**：codex 結束時是否送出 `?1003l` / `?1006l`（WSL 擷取 PTY 位元組流，沿用 T0666 方法）；BAT 的 `registerCsiHandler` / `MouseReportSelectionKeeper` / `SelectionDrag.resume()` 是否會在 codex 結束後重新開啟或保留追蹤。
3. **平台範圍**：是否只在 macOS 發生（ConPTY 對 DECSET 1003 / 1006 的轉送與 reset 行為和原生 PTY 不同）。結論寫「macOS 專屬 / 跨平台 / 無法判定」並附依據。
4. **修正方向**（只提案）：例如 PTY 前景程序結束 / shell 提示列返回時重設滑鼠模式、或偵測到「追蹤中但送出的回報被 shell 當文字」時自動關閉；各方案的觸發時機、風險、與 BUG-142 / T0571 既有行為的互動（不得退化），切分 S / M。
5. **與 BUG-165 的關聯**：codex 使用哪種追蹤模式（1000 / 1002 / 1003），any-event 追蹤是否讓每次滑鼠移動都送回報給 codex、影響捲動順暢度（只記觀察，BUG-165 由 T0670 負責）。

6. **Claude CLI 對照**（塔台 2026-10-19 16:01 追加，使用者指示）：Claude CLI 是否有同樣問題。對 **claude 與 codex 兩者**都測以下退出方式，回到 shell 後移動滑鼠 / 滾輪看是否冒出殘骸，並記錄 `mouseTrackingMode`：
   - 正常結束（claude `/exit`、codex `/quit` 或 Worker 完成後結束）
   - **Ctrl+C** 強制中斷（含連按兩次）
   - **Ctrl+Z** 暫停回 shell（SIGTSTP；之後 `fg` 回去再離開也測一次）
   - claude 有沒有開滑鼠追蹤、開哪一種（1000 / 1002 / 1003 / 1006），在 alt screen 或 inline 模式下是否不同
   結果整理成「agent × 退出方式 × 平台」表格。

## 研究指引

- 結論每條標「原始碼 / 實測 / 推論」，不轉述未證實的根因。
- 給 Gary 的確認測試 ≤ 3 項（BUG-166「待確認」可沿用或修改）。

## 互動規則

- yolo、`--no-interactive`：不問使用者；判讀問題問塔台（每輪 ≤ 3 題）。
- 需要 Gary 回答的事寫進回報區「給 Gary 的問題 / 測試」。

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 結論摘要

一句話：**初判成立，但要補一個條件：codex 只有在「被訊號結束」時才會把滑鼠追蹤留著。** codex-cli 0.163.0 用 `/quit`、Ctrl+C、Ctrl+D、Ctrl+Z 離開時都會送出 `?1006l ?1015l ?1003l ?1002l ?1000l` 和 `?1049l`，終端狀態是乾淨的。它收到 SIGINT / SIGTERM / SIGHUP（不管送給原生 binary 還是 npm 的 node 包裝程序），或被 SIGKILL 時，什麼都不送就結束。xterm 因此停在 `mouseTrackingMode=any`，也還在 alt screen。之後每次滑鼠移動，xterm 都把 `ESC[<35;x;yM` 寫進 shell。zsh 5.9 和 bash 吃掉 `ESC [ <`，其餘當文字插入，字串跟 Gary 截圖的 `35;52;69M35;55;66M…64;39;3M` 一模一樣（實測）。

- **BAT 本身不會開啟或保留追蹤**（原始碼）：產品程式只「讀」`terminal.modes.mouseTrackingMode`，從來不寫任何滑鼠 DECSET / DECRST。`registerCsiHandler` 回 `false`，不攔截也不重送。`SelectionDrag.resume()` 補的 `mousedown` 帶的是強制選取的修飾鍵，xterm 不會送回報。BAT 在 agent 結束時也不會重設滑鼠模式：shell 還活著，BAT 收不到任何事件；`pty.onExit` 只寫一行 `[Process exited …]`。
- **Claude CLI**（2.1.303）：預設（inline）renderer **不開滑鼠追蹤**，任何退出方式都不會殘留。fullscreen renderer（`CLAUDE_CODE_NO_FLICKER=1` / `/tui fullscreen`）會開 `?1000h ?1002h ?1003h ?1006h`，但 `/exit`、Ctrl+C ×2、Ctrl+Z、SIGTERM、SIGHUP 都會還原。**只有 SIGKILL 會殘留**，這是任何程式都無法處理的情況。差別在於 claude 有處理訊號、codex 沒有。
- **平台**：**跨平台，只要 agent 跑在 Unix PTY 上就會發生**：macOS、Linux、WSL / SSH / Docker 分頁。Windows 上用 BAT 開的 WSL 分頁也會重現（實測：wsl.exe 經 ConPTY 原樣轉送 VT，bash 照樣印出殘骸）。**Windows 原生 ConPTY 分頁（pwsh 裡跑 codex.exe / claude.exe）不會出現殘骸**（實測）。原因：conhost 自己管滑鼠模式，codex 被 `taskkill /F` 後 conhost 會送 `?1003;1006l`；而且 conhost 把輸入的 SGR 回報轉成 console mouse event，不會當成文字交給 pwsh。
- **建議修正方向**：F1「回報被 shell 回顯成文字 → 在本機關掉 xterm 的追蹤」（S）＋ F2「右鍵選單加『重設滑鼠模式』」（S），並向 codex 上游回報「收到訊號不還原終端」。詳見下方「修正方向」。

### 證據

#### 1. 原始碼（BAT）

- 【原始碼】`src/` / `electron/` / `scripts/` 中出現 `?100x` / `mouseTracking` 的只有 `src/components/TerminalPanel.tsx`、`src/lib/terminal-context-menu.ts` 和它們的測試，全部都是讀取或判斷，沒有任何一處寫滑鼠模式（Grep `\?100[0-6]|mouseTracking|1003l|DECRST`）。
- 【原始碼】`TerminalPanel.tsx` 的 `terminal.parser.registerCsiHandler({ prefix: '?', final: 'h' }, …)` 只在「追蹤已開又收到 9 / 1000 / 1002 / 1003」時呼叫 `selectionKeeper.handleMouseTrackingSet()`，然後 `return false`，讓 xterm 照常處理。它不會在 codex 結束後開啟追蹤（codex 結束時沒有送 `h`）。
- 【原始碼】`SelectionDrag.resume()` 只在 Shift / Option 拖曳進行中補一個帶相同修飾鍵的 `mousedown`（xterm 的 `shouldForceSelection` → 只做選取、不送回報）。`MouseReportSelectionKeeper` 只放回選取範圍，不碰 PTY，也不碰模式。
- 【原始碼】`pty.onExit` 只寫 `[Process exited with code N]`。`PtyOutputReplayer` 的 `terminal.reset()` 只在 `pty:create` 回 `created: false` 的重播時執行（BAT 重開），不是切換分頁時。主行程的 OSC 7501 解析（`src/lib/codex-terminal-state.ts`）只讀、不改輸出。
- 【原始碼】prompt marker（`writeOutput`）只靠「行尾是 `$ > #`」的啟發式判斷，BAT 沒有 OSC 133 shell integration。所以「提示列出現時重設」這條路目前沒有可靠的訊號（p10k 的提示字元是 `❯`，也不會命中）。

#### 2. 實測方法

- WSL Ubuntu 24.04（Linux 原生 PTY，代替 macOS）：codex-cli **0.163.0**、claude **2.1.303** 都用 `npm i --prefix /tmp/t0671/...` 裝在暫存目錄，沒有動到使用者的全域安裝。codex 用暫存 `CODEX_HOME` + `codex login --with-api-key` 寫入的假金鑰；claude 用暫存 `CLAUDE_CONFIG_DIR` + 假 `ANTHROPIC_API_KEY`，兩者都只開到主畫面、不送 prompt、沒有呼叫 API。用 Python `pty.fork()` 開 120×30 的 PTY，依時間表送按鍵或訊號，擷取全部輸出位元組。Ctrl+Z 用互動式 bash（有 job control）來測。
- Windows 原生：`@lydell/node-pty`（repo 內）開 ConPTY + `pwsh -NoProfile`，跑 codex.exe 0.163.0 和 repo 內嵌的 claude.exe 2.1.303（暫存 config）。「kill」用 `taskkill /F /T`，只針對自己 pwsh 的子程序。
- `mouseTrackingMode`：把擷取到的位元組流原樣餵給 repo 內的 **@xterm/xterm 5.5.0**（jsdom），讀 `terminal.modes.mouseTrackingMode` 和 `buffer.active.type`，再用 `coreMouseService.triggerMouseEvent` 模擬一次無按鍵移動和一次滾輪，看 xterm 會送出什麼（只用於量測的 harness，不是產品程式）。
- shell 對照：把 `ESC[<35;52;69M ESC[<35;55;66M ESC[<35;57;64M ESC[<64;39;3M ESC[<64;39;3M` 寫進 bash 5.2 和 zsh 5.9 的 PTY 輸入（zsh 用 `apt-get download` + `dpkg -x` 解壓到暫存目錄，沒有安裝），以及寫進 ConPTY + wsl.exe 的 bash 和 ConPTY 原生的 pwsh。
- 沒有 Mac 可測，macOS 的判定是推論（同為 Unix PTY，codex / claude 的處理和 xterm.js 都沒有平台分支）。

#### 3. 結果：agent × 退出方式 × 平台

「殘留」= 回到 shell 後 xterm `mouseTrackingMode=any`（且仍在 alt screen），移動 / 滾輪會送出 `ESC[<35;…M` / `ESC[<64;…M`；「乾淨」= `mouseTrackingMode=none`、normal buffer、不送任何東西。

| agent | 退出方式 | WSL / Linux PTY（≈ macOS） | Windows 原生 ConPTY |
|---|---|---|---|
| codex 0.163.0 | `/quit` | ✅ 乾淨（送 `?1006l ?1015l ?1003l ?1002l ?1000l ?1007l ?1049l`，還有 OSC 7501 `state=clear`） | ✅ 乾淨（ConPTY 轉成 `?1003;1006l`） |
| codex | Ctrl+C ×2 | ✅ 乾淨 | ✅ 乾淨 |
| codex | Ctrl+D ×2 | ✅ 乾淨 | 未測 |
| codex | Ctrl+Z → `fg` → `/quit` | ✅ 暫停時全部還原（`mouseTrackingMode=none`），`fg` 後重開 1000/1002/1003/1006，最後 `/quit` 乾淨 | Ctrl+Z 無作用（沒有 job control），`/quit` 乾淨 |
| codex | SIGINT（外部送訊號，不是按鍵） | 🔴 **殘留**（any + alt screen；1004 focus 回報與 2004 也一起殘留） | — |
| codex | SIGTERM | 🔴 **殘留**（送給原生 binary 或送給 node 包裝程序，結果都一樣） | — |
| codex | SIGHUP | 🔴 **殘留**（同上） | — |
| codex | SIGKILL / `taskkill /F` | 🔴 **殘留** | ⚪ 終端端的模式由 conhost 管：kill 後 conhost 送 `?1003;1006l`，pwsh 提示列時又被 PSReadLine 開回 `?1003;1006h`，但回報都被 conhost 吃掉，**沒有殘骸** |
| codex | app-server daemon 被 TERM / KILL | TUI 不會結束（不是退出路徑） | — |
| claude 2.1.303 inline（WSL 的預設） | `/exit`、Ctrl+C ×2、Ctrl+Z → `fg` → `/exit` | ✅ **完全不開滑鼠追蹤**（沒有 1000/1002/1003/1006，也沒有 1049） | 用 `CLAUDE_CODE_NO_FLICKER=0` 強制 inline：同樣不開 |
| claude fullscreen（`CLAUDE_CODE_NO_FLICKER=1`；Windows 全新 config 的預設） | `/exit` | ✅ 乾淨 | ✅ 乾淨 |
| claude fullscreen | Ctrl+C ×2（0.4 s 內） | ✅ 乾淨 | ✅ 乾淨 |
| claude fullscreen | Ctrl+Z → `fg` → `/exit` | ✅ 暫停時全部還原，`fg` 後重開，最後乾淨 | Ctrl+Z 無作用，`/exit` 乾淨 |
| claude fullscreen | SIGTERM / SIGHUP | ✅ 乾淨（exit 143 / 129，有處理訊號並還原） | — |
| claude fullscreen | SIGKILL / `taskkill /F` | 🔴 殘留（無法避免） | ⚪ 同 codex：ConPTY 吃掉回報，沒有殘骸 |
| 對照：手動 `printf '\e[?1003h\e[?1006h'` | 之後移動 / 滾輪 | 🔴 bash：`^G35;52;69M^G35;55;66M…64;39;3M` 插進命令列；**zsh 5.9：同樣插入 `35;52;69M35;55;66M35;57;64M64;39;3M64;39;3M`**（和 Gary 截圖相同） | pwsh 原生：沒有殘骸；**ConPTY + wsl.exe 的 bash：🔴 會重現**（`35;52;20M35;55;21M64;39;3M`） |

補充（實測）：
- claude 第一次測 Ctrl+C 兩下間隔 1 s 時沒有退出（第二下太慢），改成 0.4 s 才退出。這和殘留無關。
- claude 2.1.303 在 Windows 用全新 config、沒有任何 env 時，預設就是 fullscreen（alt screen + 滑鼠追蹤）；WSL 預設是 inline。原因沒有追查（binary 內有 `CLAUDE_CODE_TUI_TRIAL` 等字串，推論是預設值有分流）。這台機器使用者的 `~/.claude/settings.json` 也有 `"tui": "fullscreen"`，本 Worker 的 PTY env 裡也有 `CLAUDE_CODE_NO_FLICKER=1` ⇒ 使用者的 claude 分頁本來就開著滑鼠追蹤，只是 claude 會正確還原。
- codex 被訊號結束後，除了 1000/1002/1003/1006，**alt screen（1049）和 focus 回報（1004）也一起殘留**。所以那個分頁回到的 shell 是畫在 alt buffer 上，沒有 scrollback（往上捲看不到 codex 對話）。這可以當成「是被訊號 / 崩潰結束」的辨識特徵（見給 Gary 的測試 3）。
- codex 的 kitty keyboard（`ESC[>…u` / `ESC[<1u`）和 modifyOtherKeys（`ESC[>4;…m`）也只在正常退出時才還原，但 xterm.js 5.5 不支援這兩者，對 BAT 沒有影響（推論）。

#### 4. 為什麼 Gary 的分頁會是「被訊號結束」（推論，待確認）

- 正常的 Worker 收尾（`/quit` 或 Ctrl+C）不會殘留，所以 Gary 那個分頁的 codex 應該不是正常退出。在 BAT 裡會讓 codex 被訊號結束、但 shell 還活著的情況，可能有：其他程序 `kill` codex、macOS 記憶體壓力把程序殺掉、codex 崩潰（panic 時的終端還原沒有驗證）、codex 還沒進 raw mode 時按到 Ctrl+C（變成 SIGINT）。BAT 自己沒有任何會對 codex 單獨送訊號的路徑：✕ / `--close-worker` 是整個分頁一起關（原始碼：`closeTerminalNow` → `PtyManager.kill`）。
- 「點到已完成工單的分頁」才看到：滑鼠只有移到那個分頁上，xterm 才會送回報；Gary 的描述和「移動就產生」一致（推論）。

#### 5. 與 BUG-165 的關聯（只記觀察）

- 【實測】codex 0.163.0 在 Linux 開的是 **1000 + 1002 + 1003 + 1006**（any-event + SGR），並 `?1007l`；Windows 經 ConPTY 是 `?1003;1006h`。和 T0670 的結果一致。
- 【實測】在 codex 主畫面（空對話、idle）送 30 個無按鍵移動回報（每 50 ms 一個）：codex **輸出 0 bytes**（不會因為滑鼠移動重繪）；idle 3 s 也是 0 bytes。送 10 個滾輪回報：輸出 860 bytes。⇒ 推論：any-event 追蹤讓每次移動都多送約 12 bytes 的輸入給 codex，但 codex 不會因此重繪，**應該不是捲動不順的主因**。捲動的機制由 T0670 負責。

### 修正方向（只提案；要不要修、怎麼修由使用者決定）

| 方案 | 觸發時機 | 內容 | 風險 / 與 BUG-142 / T0571 的互動 | 規模 |
|---|---|---|---|---|
| **F1（推薦）偵測回報被回顯成文字 → 在本機關掉追蹤** | xterm 處於追蹤模式，剛送出的 SGR 回報（去掉 `ESC[<` 的本體，例如 `35;52;69M`）在約 500 ms 內出現在 PTY 輸出中 | renderer：`onData` 遇到 `isSgrMouseReport` 時記住最近幾筆本體；`writeOutput` 時拿短暫的輸出尾巴（先去掉 `\x07` / `\x08` 再比對，zsh 會輸出 `3^H35;…`）做比對；命中就 `terminal.write('\x1b[?1000l\x1b[?1002l\x1b[?1003l\x1b[?1006l\x1b[?1015l\x1b[?1016l')`（**只改本機 xterm，不寫 PTY**）並記日誌 `[mouse-tracking] reset: reports echoed as text`。適用於本機、WSL、SSH、遠端，不需要知道前景程序 | 命中前的第一筆仍會進命令列（使用者要 Ctrl+U 清一次）。誤判只會發生在「追蹤中、而且程式把原始輸入原樣回顯」的情況（例如手動 `printf` 測試、滑鼠除錯工具）；codex / claude 執行中不會回顯，所以 agent 執行中行為不變。T0571 / T0573：`registerCsiHandler` 只攔 `h`，本機送 `l` 不會觸發 keeper；追蹤關閉後右鍵選單恢復正常顯示（正確行為），建議同時 `selectionKeeper.forget('tracking reset')`。CLAUDE.md「🔴 不改 xterm 寫進 PTY 的滑鼠回報」要補一句例外：「回報已被回顯成文字時關閉追蹤」。驗收：單元測試（比對函式）+ e2e（比照 `t0568`：shell 分頁 `printf` 開追蹤 → 移動 → 第一筆之後 stdin 不再收到回報、`mouseTrackingMode=none`）+ 既有 `t0568` / `t0571` e2e 與 `terminal-context-menu.test.tsx` 不退化 | **S** |
| **F2（推薦，與 F1 一起）右鍵選單加「重設滑鼠模式」** | 使用者手動（追蹤中也能用 Shift + 右鍵叫出選單；macOS 上 Shift + 右鍵時程式也會收到點擊，但殘留情況下 shell 只會多一段殘骸） | 同 F1 的本機 DECRST；可選擇一併送 `?1049l`（離開殘留的 alt screen） | 不會自動觸發，沒有誤判。要加 i18n 字串。`?1049l` 會把畫面切回 normal buffer，殘留在 alt buffer 上的 shell 提示列會消失（按 Enter 就會重畫），所以建議做成另一個選項或不做 | **S** |
| F3 前景程序偵測 | node-pty 的 `pty.process`（macOS / Linux 可取得前景程序名）從 TUI 變回 shell 時，xterm 還在追蹤就重設 | 主行程輪詢 + IPC 事件，Terminal Server 也要做 | 對 WSL / SSH / Docker 分頁無效（前景是 `wsl.exe` / `ssh`），Windows 原生無效；要輪詢，成本較高，涵蓋範圍比 F1 小 | M |
| F4 codex 上游回報 | — | 向 openai/codex 回報：0.163.0 收到 SIGINT / SIGTERM / SIGHUP 時不還原終端（mouse capture、alt screen、focus、bracketed paste、keyboard enhancement），claude 有還原 | 不在 BAT 的控制範圍；修好後 F1 仍然需要（SIGKILL / 崩潰還是會殘留） | — |
| ✗ 不推薦：OSC 7501 `state=clear` 時重設 | codex 正常退出時才會送 | — | 會殘留的情況（訊號 / 崩潰）**正好不會送 `clear`**（實測），沒有用 | — |
| ✗ 不推薦：shell 提示列返回時重設 | — | — | BAT 沒有 OSC 133，提示列判斷只是 `$ > #` 啟發式，p10k 不會命中 | — |

推薦：**F1 + F2 開一張實作單（S）**；F4 要不要回報上游由使用者決定。

### 給 Gary 的問題 / 測試（≤ 3）

1. 出現亂碼的那個分頁，codex 是怎麼結束的？是你自己按了什麼（Ctrl+C / `/quit` / 關掉什麼），還是你回來時就已經是 shell 了？當時 Mac 記憶體吃緊嗎？
2. 出現亂碼時，在那個分頁執行 `printf '\e[?1000l\e[?1002l\e[?1003l\e[?1006l'`，再移動滑鼠，是否就停止了？（確認是追蹤模式殘留；命令列裡已經有的殘骸先按 Ctrl+U 清掉）
3. 同一個分頁能不能往上捲，看到 codex 的對話紀錄？如果只剩提示列、完全捲不上去，代表 codex 也沒有還原 alt screen，是被訊號或崩潰結束的（正常退出會回到原本的畫面）。可以順便執行 `printf '\e[?1049l'`，看看是否回到原本的畫面。

### 待塔台決策

（無；本單判讀沒有需要問塔台的問題）

### 互動紀錄

- [16:03] 塔台在執行中追加「調查範圍」第 6 項（Claude CLI 對照，含 Ctrl+C / Ctrl+Z）→ Action：重讀工單，納入第 3 節表格與結論摘要。塔台追加的文字原本是工作樹裡未 commit 的修改，隨本單一起 commit。

### 落點檢查

- `PASS`。C-0：`repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal` → PASS。C-1：工單位於 `REPO_ROOT/_ct-workorders/` → PASS。C-3：`affects_files` 只有本工單檔（`_ct-workorders/` 排除）→ not applicable。C-2：工單沒有 `branch` 欄位。`CT_HOME` 未設定（不是 worktree 派工）。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只是紀錄）。

### 範圍與限制遵守

- 唯讀：沒有修改任何產品檔、BUG-166、T0670 或塔台狀態檔，只 commit 本工單檔（`git commit --only`），沒有 push。
- 沒有使用 Gary 的截圖或檔案；回報中只引用 BUG-166 已去識別化的字串。
- 權杖：沒有在任何地方寫出權杖值。測試用的假金鑰只存在暫存 home 裡，已刪除。
- 清理：WSL `/tmp/t0671`（含暫存 codex / claude 安裝、zsh 解壓、2 個 codex app-server daemon 程序）已停止並刪除；Windows scratchpad 的暫存 `CODEX_HOME` / `CLAUDE_CONFIG_DIR` / 擷取檔已刪除，2 個孤兒 `pwsh -NoProfile -NoLogo` 測試程序已結束。擷取 / 分析腳本留在 scratchpad（`cap.py`、`modes.py`、`at.py`、`xt.cjs`、`wincap.cjs` 等），沒有放進 repo。
- 未做：macOS 實機（沒有 Mac）；codex panic 時的終端還原（無法觸發）；codex Windows 版 Ctrl+D。

### 遭遇問題

- Windows 第一次測 claude 時，子程序繼承了本 Worker 的 `CLAUDE_CODE_NO_FLICKER=1`，導致「預設模式」其實是 fullscreen。已改成清掉所有 `CLAUDE*` env 後重測，表格是重測後的結果。
- 用 Bash 傳 JSON 步驟時反斜線被吃掉（`\u0003` 變成字面 `u0003`），有幾輪 Windows Ctrl+C / Ctrl+Z 的結果無效，已改用 `read -r` / 步驟檔重測，表格只列有效的結果。

### commit

- 研究單沒有產品變更，只有本工單檔的 commit（message 含 `T0671`）。hash 在 commit 之後才會產生，不再寫回工單，以免多一個 commit。
