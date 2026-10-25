---
schema_version: 1
schema_kind: workorder
id: T0703
title: "研究：BAT「終端重置」toast 後多個閒置分頁 `[Process exited with code 1]`（BUG-171）— 找出觸發事件、為何只影響閒置分頁、為何 exit 1，並提出修正方向（只查不修）"
type: research
status: DONE
repo: better-agent-terminal
project: ""
priority: P1
sizing: M
created_at: "2026-10-25T21:05:27+0800"
started_at: "2026-10-25T21:07:21+0800"
updated_at: "2026-10-25T21:14:36+0800"
completed_at: "2026-10-25T21:14:36+0800"
depends_on: []
related:
  - "BUG-171（使用者回報，2026-10-25 第九十四 session，附截圖）"
  - "CLAUDE.md「新 PTY 的初始尺寸」（Terminal Server recovery `handleServerDeath` 以 120x30 重建）、「Recovery 提示期間的 `pty:create`」（T0578）、「關閉分頁時的程序樹」（T0540）、「Logging」的 `[gpu]` 與 GPU 崩潰後可見終端重建（T0669 / BUG-164）"
  - "CLAUDE.md「Worker 問塔台」：PTY 結束經 `onPtyExit`、Terminal Server recovery 經 `PtyManagerDeps.onServerRecovery`"
affects_files:
  - _ct-workorders/T0703-research-idle-terminals-exit-1-after-reset.md
  - _ct-workorders/BUG-171-idle-terminals-exit-1-after-terminal-reset.md
  - "_ct-workorders/_report-T0703-idle-terminals-exit-1.md（回報太長時另寫，選用）"
renew_count: 0
workdir: main repo
worker_question_timeout: 30
research_max_questions: 3
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 只查不修：不改任何產品程式、測試檔、`package.json`、CI 設定、CLAUDE.md、docs。暫存檔與除錯輸出一律放 Worker 的 scratchpad。BUG-171 只填「根因」「修正方向」兩節與 frontmatter `updated_at` / `reproducibility`，不改 `status`。"
  - "🔴 使用者正在用的 BAT 只能讀：可以讀日誌（`<appData>/BetterAgentTerminal/Logs/` 的 debug log 與 `bat-scripts.log`）、可以用 BAT MCP 唯讀 tool；**不得**重啟 BAT、重啟或關閉任何分頁（含那些 exit 1 的分頁）、對任何分頁送輸入、改 userData 內任何檔案。需要實測時用隔離實例（沿用 e2e 的隔離 userData，需先 `npx vite build`）。"
  - "🔴 結論要有證據：每個「現況是 X」都附日誌行（時間 + 標籤，內容可節錄）、檔案:行號或測試名稱；推論與事實分開標示（【推論】）。"
  - "🔴 可以自己開唯讀子代理平行讀程式碼與日誌；回報區要有「子代理使用」紀錄：幾個、做什麼、約多少 tokens（讀不到就寫怎麼估的）。不使用 Workflow 工具（本單沒有授權）。"
  - "🔴 跑 helper 相關測試時，`BAT_HELPER_LOG_DIR`、`BAT_USER_DATA` 指到 scratchpad（CLAUDE.md 規則）。"
  - "🔴 公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」，回報只用代稱與 `<使用者資料夾>`，不寫真名、主機名稱、家目錄路徑或權杖；日誌節錄先遮掉這些。"
  - "🔴 yolo：不得問使用者；判讀問題與需要使用者提供的事實（例如 toast 原文）依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題），塔台會轉問使用者。Git：只用 `git commit --only` commit `affects_files`；不 push。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
---

# T0703 — 研究：終端重置後閒置分頁 exit 1

## 元資料

- **工單編號**：T0703
- **類型**：research（只查不修）
- **優先級**：P1
- **建立時間**：2026-10-25T21:05:27+0800
- **預估規模**：M
- **相關 BUG**：BUG-171

## 研究目標

使用者在 2026-10-25 21:05（UTC+8）前不久看到 BAT 忽然「終端重置」並出現 toast，之後好幾個**未忙碌**的分頁顯示 `[Process exited with code 1]`。要回答：

1. 觸發事件是什麼（Terminal Server 死掉 / recovery、GPU 崩潰後重建、閒置逾時、其他），什麼時間、哪個模組、toast 是哪一個？
2. 為什麼只影響閒置分頁、忙碌中的分頁（例如本塔台）沒事？
3. 那些分頁為什麼最後是一個新的 shell 提示字元加 exit 1，而不是原本的 claude 程序？exit 1 是誰給的（shell 自己、BAT 合成、Terminal Server）？
4. 這是新回歸還是既有行為（比對相關功能的引入版本與目前安裝版版號）？
5. 修正方向（至少兩個方案，含推薦）。

## 已知資訊

- 截圖：工作區 `BMad-Guide` 的分頁 `Claude CLI · Tower`（原本執行 claude 的塔台）只剩 Git Bash（UCRT64）提示字元 `$`，下一行 `[Process exited with code 1]`。
- 同一視窗工作區 `better-agent-terminal` 的塔台分頁（派這張單的塔台）沒有結束。
- 本次 BAT 啟動日誌：`<appData>/BetterAgentTerminal/Logs/debug-20261024-141441.log`（2026-10-24 14:14 啟動）；另有同目錄 `bat-scripts.log`。
- 塔台分頁環境有 `BAT_IDLE_TIMEOUT_MS=1800000`（30 分鐘）。【推論】可能與「只有閒置分頁受影響」有關。
- 安裝版版號：塔台沒有查；`v0.7.1-pre.7` 2026-10-25 20:00 前後才發佈，BAT 是 10-24 啟動，【推論】執行中的是 `v0.7.1-pre.6` 或更早。請以 exe 版號 / 日誌確認。
- toast 原文：未記錄；需要時問塔台。

## 調查範圍

1. **日誌時間線**：在 debug log 找 21:05 前（先抓 20:30–21:06）的事件：Terminal Server 斷線 / 死亡 / recovery、`[gpu]`、pty exit、idle timeout、toast 對應的事件；整理成時間線（哪些 terminal id 在何時 exit、exit code）。
2. **`BAT_IDLE_TIMEOUT_MS` 的語意**：誰設、誰讀、逾時做什麼，與 exit 1 有沒有關係。
3. **recovery 路徑**：`handleServerDeath` 重建時對每個 PTY 做什麼（重開 shell？重跑原指令？），怎麼決定哪些分頁重建，為何新 shell 會 exit 1；忙碌與閒置分頁的差別在哪。
4. **toast 來源**：BAT 有哪些「終端重置 / 重建」類 toast，各由什麼事件觸發（i18n key → 呼叫點）。
5. **影響**：分頁上的 claude session 能否 `--resume` 回來（`claudeSessionId` 持久化，T0642）、Worker 歸屬、問答（`onServerRecovery` 取消問題）、`--close-worker` 狀態。
6. **方案比較**：每個方案寫可靠度、改動範圍（唯一實作位置）、是否影響遠端 headless、是否需要改 BAT ↔ CT 契約、測試方式。

## 研究指引

- 先讀 CLAUDE.md 上列各節與對應 `docs/agent-guide/`（`recovery-create-hold.md`、`pty-process-tree.md`、`logging.md`），再看日誌與程式。
- 判斷對錯以使用者體驗為準：執行中的 agent 分頁不應無聲消失。

## 互動規則

- yolo、`--no-interactive`：不得問使用者。判讀問題與需要使用者提供的事實問塔台，每輪最多 3 題（`research_max_questions: 3`）。

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 待塔台決策（僅 yolo Worker 有問題時）

無。toast 原文已從程式碼找到，不必問使用者。

### 完成狀態

**DONE**：研究目標 1–5 都有結論，證據附在下面。只查不修：沒有改任何產品程式、測試、設定或 docs。

落點檢查 **PASS**
- C-0：`repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal`
- C-1：工單在 REPO_ROOT 下
- C-3：只有 `_ct-workorders/` 項目，不適用
- C-2：工單沒有 `branch` 欄位
- 沒有設定 `CT_HOME`（不是 worktree）
- `BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄，不比對）

### 互動紀錄

沒有提問。全程沒有對使用者的 BAT 做寫入：沒有重啟、沒有送輸入、沒有關分頁、沒有改 userData，也沒有結束任何程序（包括下面列出的殘留程序）。用到的唯讀操作只有這些：
- 讀 debug log 與 userData 裡的 JSON（`windows.json`、`bat-pty-registry.json`、`claude-sessions.json`）
- 用 `Get-CimInstance Win32_Process` 列程序
- 用 `Get-WinEvent` 讀 Windows 系統事件記錄
- 讀 exe 版號

### 調查結論

> 日誌時間都是 UTC（`Z`）；括號內是 UTC+8。debug log 指 `<appData>/BetterAgentTerminal/Logs/debug-20261024-141441.log`。家目錄寫成 `<使用者資料夾>`；本 repo 以外的工作區用代稱。

#### 一句話根因

**Windows 時間服務做 NTP 校正，系統時鐘往前跳了 3.03 秒。** heartbeat 用牆鐘（`Date.now()`）計算經過時間，門檻只有 13 秒，於是把一個**還活著的** Terminal Server 判定為死亡。recovery 接著殺掉所有分頁的程序（claude 一起被殺），再 fork 第二個 server 重建 shell。舊 server 沒被關掉，IPC 監聽也沒拆，它把「被殺的舊 PTY 以 exit code 1 結束」的事件送回主行程。主行程把這些事件套到同 id 的**新** shell 上，所以畫面上是新的 `$` 提示字元，後面接 `[Process exited with code 1]`。

#### 1. 觸發事件與時間線（事實）

| 時間 | 來源 | 事件 |
|---|---|---|
| 12:59:01.87Z（20:59:01） | Windows 系統事件記錄 `Microsoft-Windows-Time-Service` 37 / 35 | NtpClient 收到 `time.windows.com` 的時間，開始同步 |
| 12:59:04Z（20:59:04） | `Microsoft-Windows-Kernel-General` 事件 1 | 「系統時間已從 2026-10-25T12:59:01.8725745Z 變更為 2026-10-25T12:59:04.9031261Z」，往前跳 **+3.0306 秒** |
| 12:59:40.778Z | debug log `[RemoteServer]` | 跳變前最後一筆正常活動，沒有任何錯誤 |
| 12:59:50.403Z（20:59:50） | debug log `[ERROR] [PtyManager] heartbeat timeout (13032ms since last pong) — server dead` | 13032 ms ≈ 一個心跳間隔 10000 ms + 時鐘跳變 3031 ms |
| 12:59:50.404Z | `[ERROR] [PtyManager] Terminal Server died — attempting recovery...` | `handleServerDeath` 開始；`[turn] terminal=40262ccd… → ended (Terminal Server recovery)` |
| 12:59:50.430Z | `[PtyManager] Killed 6 orphan PTY(s) from registry` | 依 registry 對 6 個 shell pid 先送 SIGTERM，再 `taskkill /F /T` |
| 12:59:50.439Z | `[terminal-server] re-forked with pid 38124` | 第二個 Terminal Server 啟動 |
| 12:59:50.446Z | `[PtyManager] Terminal Server recovery complete` | renderer 收到 `recovered`，顯示 toast |
| 12:59:50.683–.842Z | `[PtyManager] server spawned PTY <id> (pid …)` ×6 | 新 server 以同 id 重建 6 個 `bash --login -i` |
| 12:59:51.419–.440Z | `[helper-cap] revoked: terminal=` d1d074d2 / 0d357566 / fd23260c / 3c230f17 / a197f860 | 5 個塔台分頁收到 `pty:exit`，權杖撤銷（撤銷由 exit 觸發） |
| 13:00:20.757Z | `[mouse-tracking] reset: reports echoed as text terminal=40262ccd…` | 忙碌中的 Worker 分頁此時也只剩 shell：claude 已不在，滑鼠回報被 shell 回顯 |
| 13:03:03Z | `pty:create d50dd259… → Terminal Server`、`[bat-mcp] tab … --name=better-agent-terminal · Tower` | 使用者在 better-agent-terminal 工作區**另開**一個塔台分頁（就是派本單的塔台） |
| 13:04:16.186Z | `[helper-cap] revoked: terminal=40262ccd…` | 忙碌的 Worker 分頁也收到 exit，比其他分頁晚 4.5 分鐘 |

已排除的方向：12:30–13:08 之間沒有任何 `[gpu]`、`[CRASH]`、idle-timeout、`stale exit` 日誌，所以不是 GPU 重建（T0669），也不是閒置逾時。

受影響的 6 個分頁（`windows.json` 與日誌對照；`<ws>` 是 `--name` 裡的工作區名稱）：

| terminal id | 分頁 | 工作區 | 重置前狀態 | exit 送到 renderer |
|---|---|---|---|---|
| 3c230f17 | Claude CLI · Tower | BMad-Guide（截圖那個分頁） | 閒置（最後 `[turn] … ended` 在 12:55:37） | 12:59:51 |
| 0d357566 | Claude CLI · Tower | **better-agent-terminal**（`--name=better-agent-termin…`，08:36:08Z 日誌） | 閒置（12:30:58 結束回合） | 12:59:51 |
| a197f860 | Claude CLI · Tower | 其他工作區 1 | 閒置（12:44:28） | 12:59:51 |
| d1d074d2 | Claude CLI · Tower | 其他工作區 2 | 閒置（01:18:17） | 12:59:51 |
| fd23260c | Claude CLI · Tower | 其他工作區 3 | 閒置 | 12:59:51 |
| 40262ccd | Claude CLI · Worker · T0071 | 其他工作區 1 | **忙碌**（回合中，被 recovery 結束） | 13:04:16 |

🔴 **工單前提要更正：** 「better-agent-terminal 的塔台沒有結束」不成立。那個工作區原本的塔台 0d357566 同樣在 12:59:51 結束。派本單的塔台 d50dd259 是 13:03:03 才開的新分頁，`claude-sessions.json` 記錄的 session 是 13:03:05 新建的 `df98dd54…`。【推論】0d357566 是使用者在 13:03:11 關掉的分頁（同一秒有 `[decoration-manager] disposed`，它也已經不在 `windows.json`）。

#### 2. 為什麼看起來「只影響閒置分頁」

**實際上 6 個分頁的 claude 全部被殺，忙碌分頁也一樣。** 差別只在 exit 事件什麼時候送到 renderer：5 個閒置分頁在 1 秒內收到；忙碌的 Worker 40262ccd 晚了 4.5 分鐘（13:04:16）才收到，所以使用者回報時它看起來還活著。不過 13:00:20 就已經是 claude 不在、只剩 shell 的狀態（見 mouse-tracking 那一行）。
- 【推論】晚到的原因：舊 server 那邊 node-pty（ConPTY）的 exit 要等 pseudoconsole 的輸出管線關閉才會送出。忙碌中的 claude 子程序樹拖住了管線關閉。沒有實測，不影響根因與修法。

#### 3. 為什麼是「新的 `$` + exit 1」，exit 1 是誰給的

1. **新的 `$`**：`handleServerDeath` 只重建 shell（`pty:create`，帶原本的 `shell` / `args` / `cwd` / env，`electron/pty-manager.ts:1700-1720`），**不重跑 agent 指令**。所以重建後的分頁本來就只有一個 Git Bash 提示字元。這是 T0112 以來的設計，正常的 recovery 也會這樣。
2. **exit 1 來自舊的 Terminal Server，不是新 shell，也不是 BAT 合成：**
   - **舊 server 沒死。** 程序列表裡兩個 `terminal-server.js` 同時存在：pid 33404（2026-10-24 14:14:41 建立，原本那個）與 pid 38124（20:59:50 re-fork），父程序都是 BAT 主程序 11580。
   - `handleServerDeath` 只做了 `this.serverProcess = null`（`pty-manager.ts:1645`），沒有關掉舊 server，也沒有移除 `setupServerListener` 掛在舊 ChildProcess 上的 `'message'` 監聽（`pty-manager.ts:616-620`）。re-fork（`electron/main.ts:438` `reforkTerminalServer`）同樣沒碰舊 server。
   - 舊 server 的 PTY 被 `process.kill(pid, 'SIGTERM')` 殺掉（`pty-manager.ts:1668`）。【推論】在 Windows 上，libuv 對 SIGTERM 的實作是 `TerminateProcess(handle, 1)`，所以 exit code 是 **1**。
   - 舊 server 的 `handlePtyExit`（`electron/terminal-server/server.ts:272-283`）於是做兩件事：從**共用的** registry 檔刪掉這個 id（`:280`），再 `broadcastToAll({ type: 'pty:exit', id, exitCode })`（`:282`）。訊息經舊 IPC 進到主行程的 `handlePtyExit`（`pty-manager.ts:693`）。
   - 重建時，新 instance 是用 `this.instances.set(id, { ...inst, process: null })`（`:1720`）登記的，沒有 `awaitingCreated`，所以 BUG-101 的 stale-exit 防護擋不到。結果是新 instance 被刪掉，renderer 收到 `pty:exit(id, 1)`，`TerminalPanel.tsx:1007` 印出 `[Process exited with code 1]`。
   - 佐證一：**新 shell 其實都還活著。** 新 server 38124 底下 6 個 `bash.exe --login -i` 都在，建立時間都是 20:59:50（pid 88740 / 59404 / 64424 / 61164 / 7732 / 38236），和 `server spawned PTY` 日誌的 pid 一致。它們已經沒有對應的分頁，屬於洩漏的程序。
   - 佐證二：`bat-pty-registry.json` 現在只有 d50dd259 與 454715b3（本 Worker），**沒有這 6 個重建 shell**。它們的 registry 項目被舊 server 的 `removePtyEntry` 以同 id 刪掉了。
3. **還有其他殘留程序：**
   - 舊 server 33404 仍在執行，底下留著 6 個 `conhost.exe`。
   - 舊分頁的內層 `usr\bin\bash.exe` 共 6 個（例如 pid 25588 / 34900 / 3944 / 11252 / 12412 / 32520），各帶一個子 bash，父程序已不存在（孤兒），合計 12 個 bash。
   - 原因：SIGTERM 先把外層 `Git\bin\bash.exe` 殺了，之後的 `taskkill /T /PID <外層 pid>` 找不到程序樹，殺不到內層。這是 T0540「先殺樹、再殺 shell」的同一個教訓，T0113 的孤兒清理沒有照做。
   - 那些分頁裡的 claude 程序已經不在。

#### 4. heartbeat 為什麼會誤判（事實＋推論）

- 門檻：`HEARTBEAT_INTERVAL_MS = 10_000`、`HEARTBEAT_TIMEOUT_MS = 3_000`（`pty-manager.ts:357-358`），條件是 `elapsed > 13000`，`elapsed = Date.now() - this.lastPong`（`:1592`）。只要一次取樣超過門檻就判定死亡：不重試，也不確認 server 程序或 IPC 是否還在。
- 用的是牆鐘，所以系統時鐘往前跳 ≥ 3 秒時，健康的 server 也會被判死。這次的數字：13032 ms ≈ 正常間隔 10001 ms + 跳變 3031 ms，吻合到毫秒等級。
- 【推論】為什麼跳變在 12:59:04，判死卻在 46 秒後的 12:59:50：V8 在 Windows 上的 `Date.now()` 會用自己的高精度計時推算時間，每隔一段時間（上限約 1 分鐘）才和系統時間重新校準。所以主行程大約 12:59:4x 才看到這 +3 秒。另一個可能是另有一次較小的延遲疊加，但 13032 與 3031 的吻合程度很高，前者可信度較高。

#### 5. 是不是新回歸

- 不是新回歸，是 **T0112（`8ecd3f1e`，2026-04-13，`v0.0.11-pre.1` 起）以來就有的潛在缺陷**。heartbeat、`handleServerDeath`、T0113 的孤兒清理（`a1d13519`）一直是同樣的寫法。後續修改（T0525 env、T0576、T0590 / T0600 / T0607 / T0621）都只是在 recovery 裡加清除步驟，沒有碰判死邏輯，也沒有碰舊 server 的處理。
- 安裝版：`BetterAgentTerminal.exe` FileVersion **`0.7.1-pre.6`**。`v0.7.1-pre.6..HEAD` 之間 `pty-manager.ts` / `terminal-server/` 沒有任何差異，`main.ts` 只多了 T0701 的 5 行，所以目前的 main 也有同樣問題。
- 這份 log 目錄（10-20 起）只有另一次 recovery，在 2026-10-20 12:08:35Z。那次是 `Terminal Server IPC process exited`，exit code 1073807364（0x40010004，系統結束程序），是 server **真的死了**，走 IPC exit 路徑，不會有舊 server 回報 exit 的問題。這次是第一次從 heartbeat 誤判路徑觸發。
- 相關常識：Windows 預設會定期 NTP 校時，時鐘飄移累積到幾秒時就會一次跳過去。睡眠喚醒、手動改時間、VM 時間同步也會造成跳變。【推論】所以這不是罕見事件，只是要剛好跳 ≥ 3 秒。

#### 6. toast 來源

- `src/App.tsx:712-720`（T0112）訂閱 `terminalServer.onStatusChange`，只有三種：
  - `recovering` →「Terminal Server 異常，正在自動恢復...」
  - `recovered` →「**終端已恢復（歷史輸出已重置）**」，3 秒後自動消失
  - `failed` →「Terminal Server 恢復失敗，請重新啟動應用程式」
- 這次 recovery 在 42 ms 內完成，【推論】使用者看到的「終端重置」就是 `recovered` 那句。
- 這三句是寫死的中文，沒有走 i18n。

#### 7. `BAT_IDLE_TIMEOUT_MS` 的語意

- 它是 **Terminal Server 自己的**設定：父行程斷線後閒置多久就自動關閉，預設 30 分鐘。由 `electron/main.ts:408` / `:465` 在 fork server 時帶入，`electron/terminal-server.ts:30` 讀取，`server.ts` 的 `startIdleTimer` 只在沒有任何連線時啟動。
- 分頁 env 裡看得到它，是因為 server 建 PTY 時把 `...process.env` 全部帶進去（`server.ts:210-212`）。
- **和本事件無關**。附帶一提：舊 server 33404 的 IPC 還連著，所以它不會因閒置而自己關掉，會一直留到 BAT 結束。

#### 8. 影響

- **claude session**：
  - 那 6 個分頁的 claude 程序都被殺。`claude-sessions.json` 已不含這些 id，因為 recovery 與 exit 會清掉記錄。
  - 【推論】session 檔本身還在 claude 的專案目錄，在原 cwd 執行 `claude --resume` 就能從清單挑回來。
  - debug log 的 `[agent-start] … session=` 有前 8 碼可以對照：3c230f17 → `78f4808b`、0d357566 → `846892d4`、a197f860 → `b0686449`、d1d074d2 → `0b4dd357`、fd23260c → `0512f0bb`、40262ccd → `7a966937`。
- **Worker 歸屬 / 權杖**：recovery 先為 6 個分頁重發權杖（12:59:50.440–.445），隨後被錯誤的 exit 撤銷。被標成 exited 的分頁失去 helper 能力；Worker T0071 的回報管道也斷了。
- **問答**：`onServerRecovery` 會取消待答問題。當時沒有待答問題（最後一題 12:40:26 已回答），這次沒有實際損失。
- **`--close-worker`**：當時沒有排程中的回收，沒有影響。
- **程序洩漏**：
  - 舊 server 1 個（含 6 個 conhost）
  - 孤兒 bash 12 個
  - 新 server 底下沒有分頁的 shell 6 個
  - 【推論】BAT 正常結束時，新 server 的 shutdown 會清掉它自己的 6 個 shell；舊 server 會因 IPC 斷線，30 分鐘後自行關閉；那 12 個孤兒 bash 不會有人清。

### 建議方向

修法可以分層疊加。每個方案都只動主行程，不改 BAT ↔ CT 契約。

| 方案 | 內容 | 唯一實作位置 | 可靠度 | 遠端 headless | 測試 |
|---|---|---|---|---|---|
| **A. heartbeat 不再誤判** | 改用單調時鐘（`performance.now()` / `process.hrtime.bigint()`）計算 `elapsed`；改成連續 N 次（例如 3 次，約 30 秒）沒收到 pong 才算死；判死前先確認 `serverProcess.connected` 與 `process.kill(serverPid, 0)`，還活著就只記 `[heartbeat] late pong` 不 recovery | `PtyManager.startHeartbeat`（`electron/pty-manager.ts:1585-1601`） | 高：直接消除這次的觸發條件，連帶消除 3 秒 GC 或磁碟卡頓造成的誤判 | 不影響（headless 不用 Terminal Server watchdog） | vitest：注入 clock / 用 fake timers，模擬牆鐘 +3 s、單次 pong 遲到、真的斷線三種情況 |
| **B. recovery 本身要安全**（縱深防禦，真的死掉時也需要） | ① 進入 recovery 時先切斷舊 server：`removeAllListeners('message')`、`disconnect()`；舊 server 程序還活著就連它的程序樹一起 `taskkill /T`。② 從舊 server 來的訊息一律丟棄：加 server generation，或讓重建的 instance 帶 `awaitingCreated: true`，沿用 BUG-101 的防護。③ 孤兒清理改成先 `taskkill /T` 再 SIGTERM（同 T0540 順序），或直接只用 `taskkill /F /T` | `PtyManager.handleServerDeath` / `setServerProcess` / `setupServerListener`；`main.ts` `reforkTerminalServer` | 高：就算再有誤判，或舊 server 只是卡住，也不會出現錯誤的 exit 和程序洩漏 | 不影響 | vitest：用 EventEmitter 假的 ChildProcess，recovery 後從舊 server 發 `pty:exit`，斷言新 instance 不被刪、renderer 不收到 exit；registry 用 temp 目錄 |
| **C. agent 分頁不再無聲變成 shell**（使用者體驗） | recovery 後 renderer 明確列出哪些 agent 分頁被重建；claude 分頁保留 `claudeSessionId`，提供「重新啟動並 `--resume <id>`」；或把被中斷的 claude 分頁直接標成「agent 已中斷」，而不是只顯示新 shell | renderer（`App.tsx` toast 與 TerminalPanel）＋ `ClaudeSessionPersistence` 在 recovery 時不清除 | 中：真的崩潰時 claude 仍會被殺，C 只是讓損失看得見、救得回來 | headless 有自己的 PTY 生命週期，要另外評估 | RTL：模擬 `recovered` 加 agent 分頁；e2e 需要可注入的 server 死亡 |

**推薦：A + B 合成一張修正工單（P1），C 另開 PLAN。**
- A 消除這次的觸發條件；B 確保將來就算判斷錯誤，也不會把活著的分頁標成 exit、不會洩漏程序。兩者都只在 `pty-manager.ts` 與 `main.ts`，範圍小。
- C 牽涉 renderer 與 session 持久化（T0642），範圍較大，而且只有 server 真的崩潰時才有價值，可以排在後面。

### 建議下一步

1. **修正工單（A + B）**
   - affects_files：`electron/pty-manager.ts`、`electron/main.ts`、新測試 `electron/__tests__/pty-manager-heartbeat-recovery.test.ts`，以及 CLAUDE.md「新 PTY 的初始尺寸」那段 recovery 敘述與對應 docs。
   - 驗收：`npm run test:unit`、`npm run typecheck:electron` = 0、`npx vite build`。
   - 實機（隔離實例）：用測試掛勾讓主行程的 clock 前跳 5 秒，確認不 recovery；用掛勾讓舊 server 停止回 pong，但程序與 IPC 都還活著，確認不 recovery；真的 kill server，確認 recovery 後沒有 exit 1、沒有殘留程序、registry 有新 shell。
2. **給使用者的處置**（塔台轉達，本 Worker 沒有動手）：
   - 被結束的塔台與 Worker 分頁，可以在原專案目錄用 `claude --resume` 接回（session 前 8 碼見上面「影響」）。
   - 方便時正常結束一次 BAT，清掉舊 server。之後可以在工作管理員檢查，有沒有父程序已不存在的 `usr\bin\bash.exe` 殘留。
   - Worker T0071（其他工作區 1）回合中被中斷，要由該工作區的塔台重新評估。
3. 可以順手處理（和本 BUG 無直接關係，塔台決定要不要開單）：
   - `App.tsx:714-719` 的三句 toast 沒有走 i18n。
   - Terminal Server 把自己的 `BAT_IDLE_TIMEOUT_MS` / `BAT_SCROLL_BUFFER_LINES` 洩漏進每個 PTY 的 env（`server.ts:210-212`）。

### 子代理與 Workflow 使用

未使用子代理，也未使用 Workflow；全部由主 Worker 直接讀日誌、程式碼與程序列表。

### Renew 歷程

無。

### 遭遇問題

- 「忙碌分頁為什麼晚 4.5 分鐘才收到 exit」與「V8 `Date.now()` 延遲校準」兩點只有推論、沒有實測，已標【推論】。兩者都不影響根因與修法。
- 沒有在隔離實例重現，因為重現需要改系統時間，或在 server 注入停頓掛勾。日誌、程序列表與系統事件記錄三方的證據已足以下結論，重現測試建議放在修正工單裡用測試掛勾做。

### Commit

只 commit 工單與 BUG-171（`git commit --only`），不 push。commit hash 見塔台收單時的 `git log`（本回報寫在 commit 之前）。

### 回報時間

2026-10-25T21:14:36+0800
