---
schema_version: 1
schema_kind: workorder
id: T0490
title: "研究 BUG-114：派工分頁 terminal-created 成功但 Worker 未執行預載 /ct-exec（或 commit 前停住）——追預載指令送達時序，提出修法與啟動心跳設計"
type: research
status: DONE
repo: better-agent-terminal
project: D139
priority: P3
sizing: M
created_at: "2026-10-13T23:13:05+08:00"
started_at: "2026-10-13T23:17:24+08:00"
updated_at: "2026-10-13T23:26:01+08:00"
completed_at: "2026-10-13T23:26:01+08:00"
target_version: v0.6.0-pre.5
depends_on: []
related:
  - "BUG-114 全文（T0452 / T0457 / T0436 證據、待查方向、L143 暫行對策）"
  - "CLAUDE.md「遠端 Tower 通知（PLAN-036 K）」（create-agent-command 路徑）；`scripts/bat-terminal.mjs`"
affects_files: []
renew_count: 0
workdir: main repo
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 研究單：不改產品程式碼，只寫本工單回報區；實驗用 isolated runtime / scratchpad，結束清除並回報"
  - "🔴 不得對使用者正在使用的 BAT（本機 RemoteServer）派發測試分頁；需要真 BAT 才能重現時，寫出重現步驟交塔台"
  - "🔴 **批次並行（D139）**：同一工作樹有其他 Worker 同時進行。commit 一律 `git commit --only <本單檔案…>`，不得 stage / commit 他人檔案；全套測試或 build 若因他人未提交的 WIP 失敗，於回報區列出失敗檔與歸屬，並以本單檔案相關測試為準（不得為此修改他人範圍的檔案）"
  - "🔴 **不改 `CLAUDE.md`**（除非本單 frontmatter 另有授權）：需更新的文件內容寫在回報區「CLAUDE.md 建議文字」，由 T0493 統一套用"
  - "🔴 tsc：本單改動的檔案不得新增 `tsc` 錯誤（總數會因 T0486 並行變動，以檔案為單位比較）"
  - "🔴 不得以預設實例（無 `--runtime`）啟動 source build（BUG-119 migration 會作用在使用者真實資料目錄）；需要啟動時用 `--runtime=<高號碼>` 或 e2e isolated runtime，結束只刪自己建立的目錄"
  - "🔴 不 push、不觸發 workflow、不建 tag；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`；`gh` 一律帶 `-R gowerlin/better-agent-terminal`（唯讀）；換行維持各檔現況"
---

# T0490 — 研究 BUG-114：派工分頁 terminal-created 成功但 Worker 未執行預載 /ct-exec（或 commit 前停住）——追預載指令送達時序，提出修法與啟動心跳設計

## 研究項目

1. 追 `bat-terminal.mjs --skill ct-exec --workorder` → `terminal:create-agent-command` → PTY 建立 → agent 啟動 → 預載指令送出 的完整路徑與時序（檔案:行）；agent（Claude CLI / Codex）尚未 ready 時送出的輸入是否會被吞
2. 現有「等待 agent ready」機制（若有）：判斷依據、timeout、失敗行為；多分頁同時建立時的佇列 / 焦點
3. 以 isolated 環境或單元層級模擬「輸入早於 ready」（可行即做）
4. T0436 型（Worker 寫完回報後停在 commit 前）是否為不同根因：從 ct-exec 流程與 agent 權限提示角度分析（只讀）
5. 修法選項比較並推薦：ready 偵測 + 重送、BAT 確認預載已被接收、Worker 啟動時 `bat-notify` 心跳（`T#### started`）、塔台自動偵測未啟動
6. 實作單拆分建議（affects_files、驗收、是否需要 e2e）

## 產出

回報區：時序表、重現結果、根因判定（確定 / 推測分開）、修法比較 + 推薦、實作單規格

## Sub-session 執行指示

1. 讀本工單 + D139 + 「related」列出的來源 + affects_files
2. 填 `started_at`、`status: IN_PROGRESS`（取系統時間，R-G001）
3. 實作 → 驗收 → 填回報區 → `DONE`；`git commit --only` 本單檔案與改動；不 push；依派發 mode 通知塔台

---

## 回報區

### 結論（一句話）

**BUG-114 的 T0452 / T0457 不是「agent 沒收到預載指令」，而是分頁根本沒建出來**：`scripts/bat-terminal.mjs` 等回應時不比對 frame `id`，本機 RemoteServer 把**所有 PTY 的 `pty:output` 廣播**也送給這條短命的 helper 連線；廣播 frame 早於 `invoke-result` 抵達時，helper 把它當成功回應、印 `✓ Terminal created` 並 exit 0，隨即 `process.exit`，伺服器多半還沒讀到 invoke 就收到 RST，終端從未建立。**確定**（日誌關聯 + 隔離重現 5/5 + 候選修法 5/5）。T0436 型（寫完回報停在 commit 前）是**不同根因**（推測：Worker 因共用檔 commit 範圍矛盾 / 權限提示停住，且 ct-exec 停住時不會通知）。

### Landing Zone Check

| 檢查 | 結果 |
|---|---|
| C-0 repo identity | ✅ PASS：frontmatter `repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal`（`REPO_ROOT = D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`） |
| C-1 work order path | ✅ PASS（`_ct-workorders/` 位於 REPO_ROOT 下） |
| C-3 affects_files | ℹ️ not applicable（`affects_files: []`） |
| C-2 branch | ℹ️ 無 `branch` 欄位；目前 `main` |
| 環境 | `CT_MODE=yolo`、`CT_INTERACTIVE=0`、`BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄） |
| 起始狀態 | frontmatter 為 `status: TODO`（非 `PENDING`），視為未開工，直接改 `IN_PROGRESS` |

### 1. 派工完整路徑與時序（檔案:行）

| # | 步驟 | 位置 | 說明 |
|---|---|---|---|
| 1 | helper 連線 + TLS 指紋釘選 + WS upgrade | `scripts/bat-terminal.mjs` `MinimalWS.connect`（:360 起） | 無 |
| 2 | 送 `auth`（`id: makeId()`，**沒保留 id**） | `scripts/bat-terminal.mjs:606-611` | 本機 PTY 的 `BAT_REMOTE_TOKEN` 是**全權 server token**（CLAUDE.md「本機 Electron 的 PTY 仍注入全權 server token」） |
| 3 | 伺服器驗證成功 → `this.clients.set(ws, …)` → 送 `auth-result` | `electron/remote/remote-server.ts:643-651` | **加入 `clients` 起，此連線就收所有廣播** |
| 4 | 廣播：`broadcastHub` → 對每個 client 送 `{type:'event', id:'0', channel, args}` | `electron/remote/remote-server.ts:783-799` | `PROXIED_EVENTS` 含 `pty:output`（`electron/remote/protocol.ts:97-114`）；本機所有 PTY 每 16 ms 批次輸出一次即廣播（`electron/pty-manager.ts:122-133`、`BATCH_INTERVAL_MS = 16` :179）。helper（capability token）連線不收廣播，所以**只有本機 BAT 受影響**，遠端 headless 不受影響 |
| 5 | helper `waitForMessage(ws)` 收**下一個任意 text frame** 當 auth 回應 | `scripts/bat-terminal.mjs:553-561`、:621 | 不比 id、不看 `type` |
| 6 | 送 `invoke`（`terminal:create-agent-command`，`{ skill, workorder }`），同樣不保留 id | `scripts/bat-terminal.mjs:680-685` | 無 |
| 7 | helper `waitForMessage(ws)` 收下一個任意 frame 當 invoke 回應 | `scripts/bat-terminal.mjs:691` | 🔴 **缺陷點**：廣播 `event` frame 無 `error`、無 `result` ⇒ 不是 `{ok:false}`（:719-736）也不是 `false`（:738-744）⇒ 走到 :746 `✓ Terminal created`、`terminal-created result=ok`、exit 0 |
| 8 | helper `ws.close()` + `process.exit(0)`，socket 內仍有未讀的廣播資料 ⇒ 以 RST 關閉 | `scripts/bat-terminal.mjs:746-750` | 隔離重現：mock server 端 30/30 次 `ECONNRESET` |
| 9 | 伺服器處理 invoke：`buildAgentPromptCommand`（約 30 ms：workspace 預設 agent、elevation、claude runtime router） | `electron/terminal-command-handlers.ts:266-330`、:418-463 | **預載指令是 CLI 參數**：`claude … '/ct-exec T0452'`（:447-461，`quoteArgForShell`），不是 agent ready 後再打字進去 |
| 10 | `ptyManager.create` → **固定 500 ms 後**把整行命令寫進 shell（`git-bash`） | `electron/terminal-command-handlers.ts:217-229` | 唯一的「早於 ready 送輸入」點：寫給 shell 的 type-ahead，不是寫給 agent |
| 11 | 送 `terminal:created-externally` → renderer 加分頁 | `electron/terminal-command-handlers.ts:230-248`；`src/App.tsx:469-479` | renderer 只加分頁，不寫 PTY |
| 12 | Claude CLI 啟動後自行送出 positional prompt → Worker `/ct-exec` Phase 1 寫 `started_at` | 無 | 正常延遲 17-39 s（BUG-114） |

**研究項目 1 的「agent 尚未 ready 時送出的輸入是否會被吞」**：對 agent 不適用，prompt 是 argv，由 CLI 自己在 ready 後送出。剩下的風險只有步驟 10「500 ms 後寫給 shell」，日誌未見此類失敗（見第 3 節 B）。

### 2. 現有「等待 agent ready」機制

- **沒有**。只有 `terminal-command-handlers.ts:226-228` 的固定 `delay(500)` 寫入 shell；沒有 ready 偵測、沒有重送、沒有 ack；`terminal:create-*` 的回傳值是 `ptyManager.create()` 的布林，**在寫入命令之前就回傳**。
- timeout：helper 只有 auth / invoke 各 3000 ms 的回應 timeout（:618、:688）；在缺陷下它根本等不到 timeout。
- 多分頁同時建立：輸入以 PTY id 寫入（`ptyManager.write(opts.id, …)`），**與焦點無關、沒有共用輸入佇列**，BUG-114「焦點 / 輸入佇列競爭」的假設不成立。但**成對派發確實會提高失敗率**：前一張新分頁的 bash + Claude CLI 啟動輸出是一波 `pty:output` 廣播。8 次遺失中有 3 次發生在上一個 `terminal-created` 之後 43 ms / 2.1 s / 51 ms（09-29 14:14:08、10-04 23:29:12 = T0457、10-05 11:23:38）。另 1 次（10-07 16:07:19）發生在 Tower 分頁 `ResizeObserver → doResize`（重繪輸出爆量）之後 68 ms。

### 3. 證據與重現

**A. 日誌關聯（確定）**：helper 端 `%APPDATA%/BetterAgentTerminal/Logs/bat-scripts.log`（helper 寫大寫目錄）× 主程序 mirror `%APPDATA%/better-agent-terminal/Logs/bat-scripts.log`（目前安裝的是 T0480 前的版本，主程序寫小寫目錄，BUG-119），2026-09-25 起、`BAT_REMOTE_PORT=9876`（真 BAT，排除單元測試的 mock port）：

| 指標 | 數值 |
|---|---|
| helper 回報 `terminal-created result=ok` 的派發 | 471 |
| 伺服器端**完全沒有** `ipc-invoke` / `terminal-created` 紀錄 | **8**（1.7%）：09-29 T0090、09-30 T2362、10-02 T2387、**10-04 22:37 T0452**、**10-04 23:29 T0457**、10-05 T2409、10-07 T0184、10-07 T0201 |
| 上述 8 次的 helper「invoke → 回應」耗時 | 全部 **1 ms**（auth 往返 0-1 ms） |
| 伺服器端有紀錄的派發，helper 回應耗時分布 | 20-50 ms：397、5-20 ms：61、>=200 ms：1、**<5 ms：4** |
| 那 4 次 <5 ms 的 | helper 1 ms 就 exit 0，伺服器 `ipc-invoke` 卻在 **31-33 ms 後**才出現 ⇒ helper 收到的「回應」比伺服器開始處理還早 ⇒ 必然不是 `invoke-result`（伺服器→client 只有 `auth-result` / `invoke-result` / `invoke-error` / `pong` / `event` 五種 text frame，helper 不送 ping，排除法 ⇒ 只能是 `event` 廣播）。這 4 次 invoke 碰巧有送達，分頁正常 |
| 合計誤判 | 12 / 471（2.5%），其中 8 次（67%）派發整個遺失 |
| 主程序 debug log 佐證（10-07 16:07:19 T0201） | `Client authenticated: bat-terminal-cli` 後 **4 ms** `Client disconnected`，中間沒有 `[agent-command] resolved`；同單 16:08:16 重派則是 authenticated → 31 ms 後 resolved → created → disconnected（`debug-20261007-105048.log`） |
| 伺服器 mirror 是否有缺口 | 無：8 個時間點前後都有連續的 `remote-server` 事件 |

**B. 「分頁建出來但 agent 沒跑預載」（研究項目 1 原假設）**：伺服器端有建立紀錄的 ct-exec 派發 462 次，之後該 PTY 從未跑過任何 helper（`bat-notify` / `bat-terminal`，以 `env.BAT_TERMINAL_ID` 比對）的只有 5 次：4 次是本批正在執行的 T0484 / T0485 / T0487 / T0490，另 1 次是 10-04 01:44 的 T0125（`CT_MODE=ask`，可能是人工收尾，未查證）。⇒ 上限 1/458，**沒有證據支持「輸入早於 ready 被吞」**。

**C. 隔離重現（確定）**：scratchpad 內 mock RemoteServer（TLS + 最小 WS，行為同真伺服器：auth 後持續送 `{type:'event', id:'0', channel:'pty:output'}`，invoke 30 ms 後才回 `invoke-result`），執行 `scripts/bat-terminal.mjs` 的**複本**（`BAT_HELPER_LOG_DIR` / `BAT_USER_DATA` 指向 scratchpad，未碰真 BAT 與真日誌）：

| 情境（各 5 次） | 原版 | 候選修法（id 比對） |
|---|---|---|
| S1 無廣播，30 ms 後 ok | exit 0，等到結果 ✅ | exit 0，等到結果 ✅ |
| S2 每 5 ms 廣播，30 ms 後 ok | **exit 0，伺服器回應前就退出** | exit 0，等到結果 ✅ |
| S3 每 5 ms 廣播，30 ms 後 **`false`** | **exit 0「created」**（T0456 的 exit 1 被吃掉） | exit 1 `server answered false` ✅ |
| S4 同一 TCP chunk 內 auth-result + 1 個 event | exit 0（第二個 frame 被已 resolve 的 handler 吞掉，碰巧無害） | exit 0 ✅ |
| S5 S4 + 每 5 ms 廣播，`false` | **exit 0「created」** | exit 1 ✅ |
| S2b 每 2 ms 廣播（30 次） | 30/30 伺服器 socket `ECONNRESET`；mock 30/30 有讀到 invoke | 未測 |

候選修法 = 照抄 `scripts/bat-notify.mjs:454-466` 的 `waitForMessageById`：保留 auth / invoke 的 id，只接受 `frame.id === expectedId`，其餘 frame 忽略（diff 約 15 行）。實驗檔案已全部刪除（scratchpad 已清空）。

### 4. 根因判定

| 判定 | 內容 |
|---|---|
| ✅ **確定** | `bat-terminal.mjs` 以「下一個任意 frame」當 auth / invoke 回應；本機全權 token 連線會收到所有 `PROXIED_EVENTS` 廣播（含每個 PTY 的 `pty:output`）；廣播早於 `invoke-result` 抵達時，helper 誤報成功（exit 0），並在伺服器處理前退出。輸出越熱鬧（多 Worker 並行、剛建的新分頁在啟動、Tower 分頁重繪），機率越高。T0452 / T0457 兩筆都是這種情況 |
| ✅ 確定（附帶） | 同一缺陷也讓 T0456（`false` ⇒ exit 1）與 T0433（`{ok:false}` refusal ⇒ exit 1）在競態下失效：伺服器拒絕時 helper 仍可能 exit 0 |
| 🟡 推測（機制） | 「invoke 遺失」的最後一步：helper 帶著未讀資料 `process.exit` ⇒ RST；Windows TCP 收到 RST 時會丟棄 socket 中應用層尚未讀取的資料。主程序 event loop 若正忙（廣播爆量時本來就忙），invoke 還沒被讀就被丟掉（8 次）；剛好先讀到的就正常建立（4 次）。mock 端已重現 RST（30/30 `ECONNRESET`），「丟棄未讀資料」未在真 BAT 重現（禁止對使用者的 BAT 派測試分頁） |
| ❌ 不成立 | 「agent 未 ready 就送出預載被吞」：prompt 是 CLI argv；伺服器端有建立的 458 次中沒有對應案例 |
| ❌ 不成立 | 「多分頁焦點 / 輸入佇列競爭」：PTY 寫入以 id 定址；成對派發只是提高廣播量 |

**為何間歇（約 1.7-2.5%，第五十五 session 3/46 偏高）**：誤判窗口約 30 ms（伺服器處理 invoke 的時間）；窗口內有沒有任一 PTY 吐出輸出決定成敗。第五十五 session 有大量平行 Worker，T0457 又緊接在 T0440 的新分頁之後。

### 5. T0436 型（寫完回報、停在 commit 前）

**不同根因**（推測；看不到該分頁畫面）：
- T0436 Worker 分頁 `b6e30364`：06:05 還在跑 `npm run test:unit`（測試內 helper 呼叫留下的 `invoke` 紀錄帶此 `BAT_TERMINAL_ID`），06:07 寫完回報區，之後沒有任何 helper 呼叫、沒有 commit、沒有通知。⇒ 派工與啟動都正常，與上述缺陷無關。
- 該單回報區「遭遇問題 4」自述：`electron/main.ts` 已被 T0431 **stage**、`preload.ts` / `electron.d.ts` 含 T0426 未提交 hunk。工單指示 `git commit --only <實際改動檔>`，但 `--only` 會把共用檔裡別人的 hunk 一起提交，**指示本身矛盾**；後續 ct-done 補救確實改用 `git diff <file> | git apply --cached` 逐 hunk stage。最可能的情況是 Worker 照 ct-exec「contradictory scope ⇒ stop and report」停下來問，或停在 `git apply --cached` 這類未放行指令的權限提示。
- **共同的流程缺口**：ct-exec 只在 closeout 最後才通知；中途因提問 / 權限提示 / 矛盾而停時**完全不通知**，塔台只能等 L143 的時間門檻。這是 skill 層（`~/.claude/skills/ct-exec`）的問題，不在本 repo。

### 6. 修法比較

| 選項 | 解決 T0452/T0457 型 | 解決 T0436 型 | 成本 / 風險 | 判斷 |
|---|---|---|---|---|
| **A. `bat-terminal.mjs` 以 frame id 比對回應**（移植 `bat-notify` 的 `waitForMessageById`） | ✅ 根治（誤判 → 0；exit 0 ⇔ 伺服器真的回 truthy `invoke-result`） | — | ~15 行 + 單元測試；回應格式不變，伺服器免改；新 helper 對舊 BAT 也相容（真伺服器一直回 `id`） | **推薦，必做** |
| B. 伺服器不對 CLI helper 連線廣播（auth 帶 `subscribe:false` 或以 label 判斷） | 間接（移除廣播來源） | — | 動 `remote-server.ts` 授權 / 廣播路徑，需相容測試；A 做完後只剩省流量的效益 | 不推薦（可列 backlog） |
| C. 「預載已被接收」ack（create 等到命令寫入 / CLI 啟動才回） | 不需要（A 後 exit 0 已代表 PTY 建立） | — | 需定義 ready 判準（輸出比對），跨 shell / agent 脆弱；日誌顯示此類失敗 ≤ 1/458 | 不推薦 |
| D. ready 偵測 + 重送預載 | 不需要 | — | 同 C，且重送有雙重執行風險 | 不推薦 |
| E. Worker 啟動心跳 `bat-notify --no-pty-write --source T#### "T#### started"` | 只偵測、不修 | 不偵測（停在中途） | 0 行產品碼（`--no-pty-write` 已存在，`bat-notify.mjs:192`）；但 `started_at` 本來就是 Phase 1 第一個寫入，心跳資訊重複；**不可用預設 / `--submit`**（會把文字預填進 Tower 輸入列或觸發 Tower 一輪對話） | 不推薦（A 後效益低） |
| F. Worker 停住時通知（ct-exec 遇提問 / 矛盾 / BLOCKED 時先 `bat-notify` 「T#### 需要協助」再停） | — | ✅ 偵測 | skill 層修改（不在本 repo） | 推薦給 skill 維護（另案） |
| G. 塔台自動偵測未啟動（派發後排程檢查 `started_at`） | 偵測殘餘案例 | 部分（偵測長時間無 `updated_at`） | skill 層 | 選配（A 後殘餘極低） |

**推薦**：A（本 repo 實作單，pre.5 一起出）＋ F（回饋 ct-exec skill）。B / C / D / E 不做；G 視 A 上線後是否還有案例再議。

**A 上線前的暫行對策（建議補進 L143）**：`bat-terminal` exit 0 後立即在主程序 mirror 日誌找 `"script":"remote-server","event":"terminal-created"` 且 `terminalId` 為剛印出的 id；找不到即可判定遺失，不必等 3 分鐘。目前安裝版（T0480 前）的主程序 mirror 在 `%APPDATA%/better-agent-terminal/Logs/bat-scripts.log`（小寫），T0480 起在 `%APPDATA%/BetterAgentTerminal/Logs/bat-scripts.log`。另一個訊號：helper 的 `terminal-created` 與 `invoke-create-with-command` 只差 ≤ 2 ms，幾乎可以確定是誤判。

### 7. 實作單規格（建議 1 張，P1，sizing S）

- **標題**：`bat-terminal.mjs` 以 frame id 比對 auth / invoke 回應，修正廣播 frame 被誤判為「分頁已建立」（BUG-114 根因）
- **affects_files**：`scripts/bat-terminal.mjs`、`tests/bat-terminal-response-correlation.test.mjs`（新）、`_ct-workorders/BUG-114-dispatched-worker-never-runs-ct-exec.md`
- **實作**：
  1. `waitForMessage(ws, expectedId, timeoutMs)`：parse 失敗或 `frame.id !== expectedId` 的 frame 忽略；auth / invoke 的 id 先存變數再送（比照 `bat-notify.mjs:454-466`）
  2. 診斷：`terminal-created` 日誌加 `responseType`（`frame.type`）與 `ignoredFrames` 計數，日後可直接看出廣播量
  3. 不改伺服器、不改回應格式、不改 exit code 語意
- **驗收（單元，不需 e2e）**：mock TLS server（沿用 `tests/bat-terminal-workorder-id.test.mjs` 的 `startMockBatRemote` 寫法），斷言：
  - auth-result 後持續送 `event` frame、invoke-result 延遲 30 ms ⇒ exit 0，且 helper 結束時間晚於 invoke-result 送出
  - 同上但 `result: false` ⇒ exit 1（T0456）；`{ ok:false, code }` ⇒ exit 1（T0433）
  - auth-result 與 event 在同一 chunk ⇒ 正常
  - 只有 event、沒有 invoke-result ⇒ 3000 ms 後 exit 1 `invoke-timeout`
  - 既有 `tests/bat-terminal-*.test.mjs` 全綠（其 mock 回應帶 `id`，相容）
- **順手修**：`tests/bat-terminal-*.test.mjs` 的 `runBatTerminal` 設 `BAT_HELPER_LOG_DIR` 到 temp。目前測試會寫進使用者真的 `bat-scripts.log`：單元測試在 Worker PTY 裡跑時，會留下帶該 Worker `BAT_TERMINAL_ID` 的 `invoke` 紀錄，污染診斷資料（本研究必須用 `BAT_REMOTE_PORT=9876` 過濾才排除得掉）
- **生效條件**：塔台派工使用的是**安裝版** helper（`BAT_HELPER_DIR` = `C:\Program Files\BetterAgentTerminal\resources\scripts`），使用者裝上 pre.5 後才生效；在那之前用第 6 節的暫行對策
- **實機驗收（使用者，可選）**：裝 pre.5 後連續派發 ≥ 20 張（含成對派發），主程序 mirror 日誌中每個 helper `terminal-created result=ok` 都有對應的 `remote-server terminal-created`

### 8. CLAUDE.md 建議文字（交 T0493 套用；本單未改 CLAUDE.md）

> 放在「遠端 Tower 通知（PLAN-036 K）」節末或另立「本機派工 helper」小節，於實作單完成後套用：

```markdown
- **helper 回應必須以 frame id 比對**（BUG-114 / T0490）：本機 PTY 的 helper 用全權 server token 連 RemoteServer，屬一般 client，會收到全部 `PROXIED_EVENTS` 廣播（含每個 PTY 的 `pty:output`）。等待 `auth-result` / `invoke-result` 時只接受 `frame.id === 送出的 id`，其餘 frame 一律忽略（範本：`scripts/bat-notify.mjs` `waitForMessageById`）。T0490 前的 `bat-terminal.mjs` 收「下一個任意 frame」，廣播搶先抵達時誤報 `✓ Terminal created`（exit 0），並在伺服器讀到 invoke 前退出（RST），派發遺失（2026-09-25 起 471 次中 8 次）。新增 helper 腳本時沿用此規則。
```

### 9. 驗收 / 證據分道

| 分道 | 結果 |
|---|---|
| source / docs 追蹤 | PASS（第 1-2 節） |
| 日誌關聯 | PASS（第 3 節 A / B；唯讀使用者日誌） |
| 隔離重現 | PASS（第 3 節 C；scratchpad，已清除） |
| build / tests | N/A：研究單未改產品程式碼，未跑 build / tsc（本單沒有改動任何 `.ts`，tsc 檔案層級不變） |
| runtime（真 BAT） | 未做：依 memory_overrides 不得對使用者的 BAT 派測試分頁；重現步驟見第 7 節「實機驗收」 |

### 10. 異動檔案 / commit

- 只改本工單檔：`_ct-workorders/T0490-research-bug114-dispatch-preload-not-executed.md`
- 未改 BUG-114（工單限定只寫回報區；BUG-114 的更新交實作單）
- commit：`git commit --only` 本單檔（SHA 見 `git log --grep T0490`）；不 push

### 11. 偏離 / 後續

- 偏離：無。研究項目 3 原本要模擬「輸入早於 ready」，實際改為模擬經證據確認的「廣播早於回應」；前者已由日誌（第 3 節 B）排除
- 後續建議：
  1. 開實作單（第 7 節），pre.5 一起出
  2. 回饋 ct-exec skill：中途停住（提問 / 矛盾 / BLOCKED / 等權限前）先 `bat-notify` 通知塔台（第 6 節 F）
  3. L143 補「exit 0 後查主程序 mirror 有無 `terminal-created`」的即時檢查（第 6 節暫行對策）
  4. （backlog，選配）B：伺服器不對 CLI helper 廣播
