---
schema_version: 1
schema_kind: workorder
id: T0704
title: "BUG-171 修正（A + B）：heartbeat 不因系統時鐘跳變誤判 Terminal Server 死亡；recovery 時切斷並關掉舊 server、丟棄舊 server 的訊息、孤兒清理先殺程序樹"
type: implementation
status: PENDING
repo: better-agent-terminal
project: BUG-171
priority: P1
sizing: M
created_at: "2026-10-25T21:16:40+0800"
started_at: ""
updated_at: "2026-10-25T21:16:40+0800"
completed_at: ""
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

- [ ] 時鐘前跳不 recovery；單次遲到不 recovery；程序 + IPC 還在不 recovery；IPC exit 立即 recovery
- [ ] recovery 後同 id 新 instance 不被舊 server 的 exit / data 影響
- [ ] 孤兒清理順序先樹後 shell；recovery 後舊 server 不再存活（測試以 mock 驗證呼叫）
- [ ] `npm run test:unit` 全綠；`npm run test:legacy` 不新增失敗；`npm run typecheck` = 0；`npm run typecheck:electron` = 0；`npx vite build` 成功
- [ ] CLAUDE.md 一節 + docs/agent-guide 細節
- [ ] headless 不受影響（寫明依據）

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 待塔台決策（僅 yolo Worker 有問題時）

### 完成狀態

### 實作摘要

### 驗證證據

### 需實機驗證

### 遭遇問題

### 後續候選

### Commit

### 回報時間
