---
schema_version: 1
schema_kind: workorder
id: T0704
title: "BUG-171 修正（A + B）：heartbeat 不因系統時鐘跳變誤判 Terminal Server 死亡；recovery 時切斷並關掉舊 server、丟棄舊 server 的訊息、孤兒清理先殺程序樹"
type: implementation
status: FIXED
repo: better-agent-terminal
project: BUG-171
priority: P1
sizing: M
created_at: "2026-10-25T21:16:40+0800"
started_at: "2026-10-25T21:18:49+0800"
updated_at: "2026-10-25T21:34:49+0800"
completed_at: "2026-10-25T21:34:49+0800"
depends_on: [T0703]
related:
  - "BUG-171（FIXING）與 T0703 研究（`29957a0e`，回報區「調查結論」1–8、「建議方向」A / B、「建議下一步」1）：NTP 校時讓系統時鐘往前跳 3.03 s → `PtyManager.startHeartbeat` 以 `Date.now()` 算 13032 ms > 13000 判死 → `handleServerDeath` 殺掉 6 個分頁的 shell、re-fork 第二個 server；舊 server 沒關、`'message'` 監聽沒拆，送回 `pty:exit(id, 1)` 套到同 id 的新 instance（重建時沒設 `awaitingCreated`，BUG-101 防護擋不到）"
  - "D186（使用者 2026-10-25 21:1x：A + B 一張單現在派；C 另開 PLAN-055；兩件順手項目另開 T0705 平行）"
  - "T0703 證據位置：`electron/pty-manager.ts:357-358`（門檻）、`:1585-1601`（heartbeat）、`:616-620`（`setupServerListener`）、`:693`（`handlePtyExit`）、`:1645`（只把 `serverProcess` 設 null）、`:1668`（SIGTERM 孤兒）、`:1700-1720`（重建）；`electron/main.ts:438`（`reforkTerminalServer`）；`electron/terminal-server/server.ts:272-283`（舊 server 刪共用 registry 項目並廣播 exit）"
  - "CLAUDE.md「關閉分頁時的程序樹（T0540 / PLAN-042）」：Windows 先 `killProcessTree` 再殺 shell，順序不可對調；quit 對 server 送 IPC `server:shutdown`，🔴 不要改用 `child.kill('SIGTERM')`（Windows 上是 TerminateProcess，shutdown 不執行）"
  - "CLAUDE.md「新 PTY 的初始尺寸」已知限制（recovery 以 120x30 重建）、「Recovery 提示期間的 `pty:create`」（T0578）、「Worker 問塔台」（`onServerRecovery`）、「Claude 分頁的 session 名稱」（`ClaudeSessionPersistence`）"
affects_files:
  - electron/pty-manager.ts
  - electron/main.ts
  - "electron/__tests__/pty-manager-heartbeat-recovery.test.ts（新檔）"
  - "electron/__tests__/（既有 pty-manager / recovery 相關測試，必要時）"
  - CLAUDE.md
  - "docs/agent-guide/（recovery 相關檔；沒有合適的就新增 `docs/agent-guide/terminal-server-recovery.md` 並加進 `docs/agent-guide/README.md` 索引）"
  - "e2e/t0704-*.spec.ts（選用，新檔）"
  - _ct-workorders/T0704-fix-bug171-heartbeat-and-safe-recovery.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 A（heartbeat）：經過時間改用單調時鐘（`performance.now()` 或 `process.hrtime.bigint()`）；改成連續多次（建議 3 次，約 30 s，常數寫在原位置）沒收到 pong 才判死；判死前確認 server 程序（`process.kill(pid, 0)`）與 IPC（`connected`）是否還在，都還在就只記 `[heartbeat] late pong …` 日誌、不 recovery。IPC `exit` / `disconnect` 這類「server 真的死了」的路徑照舊立即 recovery，不得變慢。"
  - "🔴 B（recovery 安全）：① 進入 recovery 時先切斷舊 server：移除它的 `'message'` 等監聽、`disconnect()`；舊 server 程序還活著就連程序樹一起結束（Windows 先 `killProcessTree` / `taskkill /F /T`，沿用 T0540 既有實作，不另寫一份）。② 從舊 server 來的任何訊息一律丟棄（server generation 編號，或重建的 instance 帶 `awaitingCreated` 沿用 BUG-101 防護；選一種，寫清楚理由）。③ T0113 的孤兒清理改成先殺程序樹、再殺 shell（同 T0540 順序），或只用 `taskkill /F /T`。④ 舊 server 不得再改共用 registry 檔（切斷後它就收不到也送不出；若仍有競態，寫進回報）。"
  - "🔴 不改：BAT ↔ CT 契約、helper 參數 / exit code、`terminal:*` channel 回傳欄位、recovery 只重建 shell 不重跑 agent 的行為（那是 PLAN-055 的範圍）、toast 文字與 `App.tsx`、`electron/terminal-server/server.ts` 的 PTY env（T0705 正在改這兩處，避免同檔並行）。若 B 必須改 `server.ts`（例如 shutdown 處理），先問塔台。headless（`electron/remote/headless-entry.ts`）不用 Terminal Server watchdog，確認不受影響並寫進回報。"
  - "🔴 驗證：新測試至少涵蓋——牆鐘往前跳 5 s（含 13–30 s 之間的跳變）不 recovery；單次 pong 遲到不 recovery、連續 N 次才 recovery；server 程序與 IPC 都在時不 recovery；IPC exit 立即 recovery；recovery 後舊 server 送來的 `pty:exit` / `pty:data` 不影響同 id 的新 instance；孤兒清理的呼叫順序（先樹後 shell）。fake timers 規則照 CLAUDE.md「Frontend unit tests」（不要用 `vi.waitFor` 等 IPC 事件）。`npm run test:unit` 全綠、`npm run test:legacy` 不新增失敗、`npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npx vite build` 成功。"
  - "🔴 隔離實例實測（選做但建議）：用測試掛勾（環境變數或測試專用注入，產品預設關閉）讓主行程時鐘前跳、讓 server 停止回 pong、真的 kill server，各記一次結果（有沒有 recovery、分頁是否被標 exit、殘留程序數）。不得碰使用者正在用的 BAT、已安裝的 BAT 與使用者的 userData；不得對其他分頁（含本塔台）送任何輸入。測試掛勾不得改變產品預設行為。"
  - "🔴 文件：CLAUDE.md 只加 / 改一節（3–12 行，照 CLAUDE.md 撰寫規則：用途、必守規則、唯一實作位置、不變式、一行連到 docs），並更新「新 PTY 的初始尺寸」已知限制中 recovery 的敘述（若有變）；細節（判死條件、generation 規則、日誌、驗證清單、T0703 時間線摘要）寫進 docs/agent-guide。"
  - "🔴 Git：`git commit --only <檔案>`；不 push、不觸發 workflow、不建 tag。同批 T0705 同時在 repo 內工作（`src/App.tsx`、i18n、`electron/terminal-server/server.ts`）：只 commit 本單 `affects_files`。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF；含反斜線的內容用 Write 工具（L129）。"
  - "🔴 公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」：回報、docs、commit 只用代稱與 `<使用者資料夾>`，不寫主機名稱、真名、權杖。yolo：不得問使用者，判讀問題問塔台（每輪最多 3 題）。"
---

# T0704 — BUG-171 修正：heartbeat 與 recovery

## 背景

T0703 確認：2026-10-25 20:59 Windows NTP 校時讓系統時鐘往前跳 3.03 秒，heartbeat 用牆鐘、一次取樣超過 13 秒就判 Terminal Server 死亡，但 server 其實活著。recovery 殺掉 6 個分頁的 claude、re-fork 第二個 server 重建 shell，舊 server 沒關、監聽沒拆，把舊 PTY 的 `exit 1` 套到同 id 的新 shell，畫面變成 `$` + `[Process exited with code 1]`；另外洩漏舊 server、孤兒 bash、沒有分頁的新 shell。不是新回歸（T0112 起就有）。

## 實作

1. **A**：`PtyManager.startHeartbeat` 改單調時鐘 + 連續 N 次 + 判死前確認程序與 IPC（見 memory_overrides）。
2. **B**：`handleServerDeath` / `setServerProcess` / `setupServerListener` / `reforkTerminalServer`：切斷並結束舊 server、丟棄舊 server 訊息、孤兒清理先殺樹。
3. 日誌：判死原因（`heartbeat` / `ipc-exit` / …）、late pong、丟棄舊 server 訊息的次數，都寫 `logger`，不記權杖與輸出內容。
4. 測試與文件（見 memory_overrides）。

## 驗收

- [x] 時鐘前跳不 recovery；單次遲到不 recovery；程序 + IPC 還在不 recovery；IPC exit 立即 recovery
- [x] recovery 後同 id 新 instance 不被舊 server 的 exit / data 影響
- [x] 孤兒清理順序先樹後 shell；recovery 後舊 server 不再存活（測試以 mock 驗證呼叫）
- [x] `npm run test:unit` 全綠；`npm run test:legacy` 不新增失敗；`npm run typecheck` = 0；`npm run typecheck:electron` = 0；`npx vite build` 成功
- [x] CLAUDE.md 一節 + docs/agent-guide 細節
- [x] headless 不受影響（寫明依據）

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 待塔台決策（僅 yolo Worker 有問題時）

無。沒有提問。

### 完成狀態

**FIXED**：A、B 兩部分都已實作。驗收清單 6 項都有證據，另外在隔離實例做了實測（選做項目）。結果等使用者在日常使用中驗收。

落點檢查 **PASS**
- C-0：`repo: better-agent-terminal` 與 `basename(REPO_ROOT)` `better-agent-terminal` 相同
- C-1：工單在 REPO_ROOT 底下
- C-3：抽查的路徑都存在，或上層目錄存在（新檔）
- C-2：工單沒有 `branch` 欄位
- 沒有設定 `CT_HOME`（不是 worktree）
- `BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄，不比對）

### 互動紀錄

沒有提問。沒有對使用者正在用的 BAT、已安裝的 BAT、使用者的 userData 或其他分頁做任何操作。e2e 只對自己啟動的隔離實例動手：暫停、恢復、結束它的 Terminal Server，以及在它的分頁裡輸入。

### 實作摘要

**A：heartbeat**（`PtyManager.startHeartbeat` / `handlePong` / `serverLiveness`，`electron/pty-manager.ts`）
- 經過時間改用單調時鐘 `ServerWatchdogDeps.now`，預設 `performance.now()`。
- 一個 tick 距離上次 pong 超過 13 s，算一次遲到；收到 pong 就歸零。
- 連續 `HEARTBEAT_MAX_MISSES` = 3 次遲到（常數放在原位置）後檢查 server 程序與 IPC：
  - 程序看 `exitCode` / `signalCode` 與 `process.kill(pid, 0)`，IPC 看 `connected`。
  - 任一不在 → `handleServerDeath('heartbeat')`。
  - 兩者都在 → 只記 `[heartbeat] late pong: …`（每 3 次記一次），不 recovery。
- pong 恢復時記 `[heartbeat] late pong arrived after N late tick(s)`。
- IPC `exit`（`ipc-exit`）與 TCP `close`（`tcp-close`）照舊立即 recovery。

**B：recovery**（`handleServerDeath(reason)` / `detachServer` / `endReplacedServer`）
1. `serverGeneration++`：之後舊 server 的任何訊息都被 `handleServerMessage(msg, generation)` 丟棄，並記錄丟棄次數。
2. 只拆 PtyManager 自己掛的 `'message'` / `'exit'` 監聽（main.ts 掛的保留），然後 `disconnect()`。
3. 舊 server 還在執行時，結束它的程序樹：
   - Windows：T0540 的 `killProcessTree`，失敗才用 SIGKILL（= TerminateProcess）。
   - 其他平台：SIGKILL。
   - 不用 `server:shutdown` / SIGTERM，因為那兩條路徑會刪掉屬於新 server 的 pid / port / registry 檔。
   - TCP 模式沒有 ChildProcess，改用 registry 的 `serverPid`。
4. 孤兒清理：新的 `killOrphanPtyProcesses` 先殺程序樹；樹殺成功就不再送 SIGTERM，否則才 SIGTERM。
5. `clearRegistry`，然後 re-fork。

①–④ 的對應：①（切斷並結束舊 server）是步驟 2–3；②（丟棄舊 server 訊息）是步驟 1；③（孤兒先殺樹）是步驟 4；④（舊 server 不再改 registry）靠「舊 server 先結束並等它完成，才清 registry、re-fork」。

**② 選 generation 的理由**（docs 裡有完整說明）：
- `awaitingCreated` 只擋 `pty:exit`，而且新 server 回 `pty:created` 之後就失效。BUG-171 有一個 exit 晚了 4.5 分鐘才到，照樣會刪掉新 instance。
- `awaitingCreated` 也擋不到舊的 `pty:data` / `server:pong` 等訊息。
- generation 一次比較，就涵蓋所有訊息類型與任意晚到的時間。

**recovery 期間的分頁操作（跟著 B 一起補的防護）**

舊 server 要等 taskkill 跑完，所以「沒有任何 server 連著」的時間變長（e2e 實測約 120 ms，之前約 40 ms）。這段時間內：
- `write` / `resize` 遇到沒有程序的 instance 不再丟 TypeError。
- `kill`（關分頁）直接移除 entry，重建時不會變成沒有分頁的 shell。
- recovery 期間 direct spawn 的分頁保留原本的程序，不重建到新 server。
- 刻意不用 T0578 的 create hold：hold 會讓 helper 派工回 `RECOVERY_PENDING`，等於改變 helper 行為。

**main.ts**
- `startTerminalServer` 啟動時的 T0113 孤兒清理改用 `killOrphanPtyProcesses`，順序變成先殺樹，取代原本的 SIGTERM 再 `taskkill`。
- `reforkTerminalServer` 只改註解與日誌文字。

**不變**
- BAT ↔ CT 契約、helper 參數 / exit code、`terminal:*` 回傳欄位都沒動。
- recovery 仍然只重建 shell。
- toast、`App.tsx`、`electron/terminal-server/server.ts` 都沒動。
- 日誌字串 `Terminal Server died — attempting recovery` 保留（兩個 source guard 用它定位），後面加上 `(reason=…)`。

**headless 不受影響**，依據：
- `electron/remote/headless-entry.ts:362` 以 `new PtyManager({...})` 建立 manager，從來不呼叫 `setServerProcess` / `connectToServer`，也沒有設 `onRequestNewServer`（`grep` 全 repo，只有 `main.ts` 呼叫）。
- 所以 heartbeat 不會啟動、`handleServerDeath` 走不到、`useServer` 永遠是 false。新增的 `kill` / `write` / `resize` 防護只在 instance 沒有程序時生效，headless 的 direct 模式一定有程序；`killAll` 也走 direct 分支，行為不變。

**文件**
- CLAUDE.md 新增「Terminal Server 存活判定與 recovery（T0704 / BUG-171）」一節。
- 新增 `docs/agent-guide/terminal-server-recovery.md`（判死條件、步驟順序、generation 理由、日誌表、headless、殘留風險、T0703 時間線、驗證清單），並加進 `docs/agent-guide/README.md` 索引。
- 「新 PTY 的初始尺寸」的已知限制（recovery 以 120x30 重建）不受影響，沒有改。

### 驗證證據

| 關卡 | 結果 |
|---|---|
| 新單元測試 `electron/__tests__/pty-manager-heartbeat-recovery.test.ts` | **PASS** 20/20（含突變檢查：拿掉 generation 檢查後「survives the detach」那項 FAIL，已還原） |
| 既有 recovery 相關 11 檔（server-exit / helper-env / create-hold / close-worker / capability / role / tower-questions / codex-osc / blocked-state / claude-session） | **PASS** 342/342 |
| `npm run test:unit` | **PASS** 337 檔，6007 passed、3 skipped |
| `npm run test:legacy` | **PASS** 33 檔、472 passed、0 failed（沒有新增失敗） |
| `npm run typecheck` | **0** |
| `npm run typecheck:electron` | **0** |
| `npx vite build` | **成功** |
| e2e `e2e/t0704-heartbeat-recovery.spec.ts`（隔離實例、Windows，不用任何產品掛勾） | **PASS** 1/1（1.6 分鐘） |

單元測試涵蓋（對照 memory_overrides 的驗證要求）：
- 牆鐘前跳 5 / 15 / 25 s 都不 recovery；預設時鐘不受 `Date` 影響。
- 遲到 2 次後 pong 恢復會歸零；連續 3 次而且程序不在 → recovery（第 2 次時不會）。
- IPC 關閉、程序還在 → recovery，並結束該程序。
- 程序與 IPC 都在 → 兩分鐘也不 recovery。
- IPC exit 會同步進入 `recovering`。
- recovery 後舊 server 送來的 `pty:exit` / `pty:data` / `exit` 都不影響同 id 的新 instance。
- Windows 的呼叫順序：舊 server 樹 → 各 PTY 樹 → 只有失敗的才 SIGTERM → registry 已清 → re-fork。
- 非 Windows 用 SIGKILL，不用 SIGTERM。
- TCP 模式改用 `serverPid`。
- recovery 期間關分頁不會被重建。
- main.ts 有 source guard。
- fake timers 只假造 timer 與 Date；recovery 以 `recovered` 廣播等待，沒有在 fake timers 下用 `vi.waitFor`。

**隔離實例實測**（e2e 日誌原文摘錄，runtime userData 結束後已刪除）：

1. **時鐘前跳**：主行程的 `Date.now` 先前跳 5 s，再前跳 20 s，各等 25 s。結果 0 次 recovery，沒有 `late pong`，server pid 不變，shell 活著。
2. **server 不回 pong**：以 `NtSuspendProcess` 暫停 Terminal Server（NTSTATUS 0）。
   - `[heartbeat] late pong: none for 40032ms (3 late ticks), server process and IPC alive — no recovery`
   - 恢復後：`[heartbeat] late pong arrived after 3 late tick(s)`
   - 0 次 recovery，pid 不變，分頁沒有收到 exit。
3. **真的結束 server**：分頁內先跑 `ping -t`（ping 在 shell 底下），再對 server 單獨 `taskkill /F`（不帶 /T）。
   - `attempting recovery... (reason=ipc-exit)`
   - `old Terminal Server process already gone`
   - `Killed 1 orphan PTY(s) from registry`
   - re-fork 出新 pid，之後 `recovery complete`，從判死到完成 130 ms。
   - 舊 shell 與 ping 都結束；以舊 server / 舊 shell 為父程序的殘留程序：`[]`。
   - 分頁沒有收到 `pty:exit`。
   - 分頁內指令回報的 PPID 等於新 shell 的 pid，新 shell 在新 server 底下。
   - teardown 後新 server 也已結束。

### 需實機驗證

- 使用者日常的 BAT（安裝版）在下一個預覽版之後：
  - 遇到 NTP 校時或睡眠喚醒時，不再出現「終端已恢復」toast，也不再出現 `[Process exited with code 1]`。
  - 若 log 裡出現 `[heartbeat] late pong`，代表當時 server 有卡住，但沒有誤判死亡。
- macOS / Linux：只有程式碼與單元測試涵蓋（SIGKILL 路徑），沒有實機跑過。

### 遭遇問題

- 無阻塞。
- 同批 T0705 / T0706 在同一個 repo 平行工作（`server.ts`、`App.tsx`、i18n、`RecoveryPrompt.tsx`、T0706 工單）。本單沒碰那些檔案，`git commit --only` 也只包含本單 `affects_files`。
- `validated_sha` 說明：驗收是在 HEAD `7d06df49`（含 T0705 已 commit 的變更）加上本單的工作樹變更上跑的，本單產品 commit `68ab2a42` 的內容與驗收時的工作樹相同，commit 之後沒有再改產品檔。

### 後續候選

1. **TCP 模式的 `serverPid` 重用風險**：BAT 重開後是 TCP 重連，沒有 ChildProcess，舊 server 的 pid 只能從 registry 拿。從 TCP close 到結束舊 server 只有幾毫秒，但理論上這段時間內 pid 可能已被別的程序重用，那個程序會被結束。這個風險是為了避免正在 graceful shutdown 的舊 server 事後刪掉新 server 的檔案而接受的。若要再收斂，可以比對 pid 檔或程序的 command line（建議等真的出事再處理）。
2. **舊 server 結束失敗時沒有補救**：`killTree` 與 SIGKILL 都失敗時（日誌 `signal=failed`），舊 server 仍活著但已被切斷。IPC 斷線 30 分鐘後它會自己 idle shutdown，那時會刪掉屬於新 server 的 pid / port / registry 檔。目前只記日誌。
3. **server 卡住但程序與 IPC 都在時永遠不 recovery**：這是照規格。若日後要處理，需要另外定一個上限（例如 N 分鐘）並決定使用者看到什麼。
4. CLAUDE.md 目前 66 KB，在 100k 目標內。

### Commit

- `68ab2a42` fix(pty): T0704 BUG-171 heartbeat ignores wall-clock jumps; recovery ends the old Terminal Server（7 檔：`electron/pty-manager.ts`、`electron/main.ts`、新測試、新 e2e、CLAUDE.md、docs 新檔與索引）
- 工單本身另外 commit（本回報寫在那個 commit 之前，hash 見 `git log`）。
- 沒有 push、沒有觸發 workflow、沒有建 tag。

### 回報時間

2026-10-25T21:33:50+0800
