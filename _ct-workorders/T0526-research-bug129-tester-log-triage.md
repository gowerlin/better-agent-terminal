---
schema_version: 1
schema_kind: workorder
id: T0526
title: "研究：以 外部測試者A 補上的日誌判定 BUG-129（塔台派工落到專案B 工作區、開成 Claude）屬 T0523 §1 哪條路徑，並給出根治方案建議"
type: research
status: DONE
repo: better-agent-terminal
project: BUG-129
priority: P1
sizing: S
created_at: "2026-10-14T16:54:51+0800"
started_at: "2026-10-14T16:55:51+0800"
updated_at: "2026-10-14T17:02:59+0800"
completed_at: "2026-10-14T17:02:59+0800"
related:
  - BUG-129
  - "T0523（§1 路徑表、§2 推論、§3 判定方式、§7 後續建議）"
  - PLAN-040
affects_files:
  - _ct-workorders/T0526-research-bug129-tester-log-triage.md
  - _ct-workorders/BUG-129-tower-dispatch-lands-in-wrong-workspace.md
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **只讀不改產品程式碼**：本單是判定 + 建議，不實作修正（根治單由塔台依結論另開）。可讀 `electron/**` / `scripts/**` / `src/**` 對照日誌行的出處。"
  - "🔴 **日誌是 外部測試者A 的個人資料**：兩個日誌檔留在 `D:\\Downloads\\`，**不得複製進 repo、不得 commit**。回報區只引用判定需要的最少行；引用時把 email（例如 Google Drive 路徑裡的帳號）與使用者名稱以外的個資遮蔽為 `<redacted>`；`BAT_REMOTE_TOKEN` 或任何 token 一律不得出現。"
  - "🔴 不碰使用者正在用的 BAT（port 9876、真實 userData、真實 `bat-scripts.log`）。不消耗 Claude token。"
  - "🔴 **禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）；寫檔 LF；不 push。`src/styles/settings.css` 的 M 狀態不是你的變更，不要 commit 它；commit 用 `--only`。"
  - "🔴 時間戳一律取自系統（R-G001）。日誌時間是 UTC（`Z`），外部測試者A 在 UTC+8，換算時寫清楚。"
---

# T0526 — 研究：以 外部測試者A 的日誌判定 BUG-129 根因路徑

## 研究目標

BUG-129：外部測試者A（mac）在 **SCB** 工作區的 Codex 塔台以
`bat-terminal.mjs --notify-id "$BAT_TERMINAL_ID" --workspace "$BAT_WORKSPACE_ID" --agent default …` 派 T0001，
Worker 分頁卻出現在 **專案B** 工作區，而且開成 Claude Code（cwd 正確，是 SCB）。

T0523 已修可修的 BAT 端路徑，但 外部測試者A 的情境當時只有**推論**（最可能是 #11：Codex 沿用舊 thread 的 shell snapshot，`BAT_TERMINAL_ID` / `BAT_WORKSPACE_ID` 都指向專案B）。現在 外部測試者A 補上日誌，請**依證據判定**屬於哪條路徑，並給出可決策的後續方案。

## 已知資訊

- 日誌（外部測試者A 提供，**只讀**）：
  - `D:\Downloads\debug-20261014-113525.log`（2236 行，267 KB）：外部測試者A mac 上 **2026-10-14 11:35（UTC+8）啟動那次**的 BAT main 日誌，第一行 `PID=48287 argv=/Applications/BetterAgentTerminal.app/...`。⚠️ pre.8 在 14:20 才發佈，所以這份日誌**多半是 pre.7 或更早的版本**（沒有 T0523 新增的 `[T0523]` / `workspaceResolved` 等日誌）。請先從日誌判定版本。
  - `D:\Downloads\bat-scripts.log`（84 行）：helper 日誌，時間範圍至少 `2026-10-14T04:35Z` ～ `08:13Z`（= UTC+8 12:35 ～ 16:13），**可能**橫跨 pre.8 換裝；若有 pre.8 helper 的紀錄，會含 T0523 新增的實際落點工作區 / agent。
- 事件時間：外部測試者A 於 LINE 回報 13:21-13:25（UTC+8），新分頁 id 為 `bbe2011f0a4c657884595b351f2a38ab`（截圖）。派工應在 13:21 前不久，即 `~05:0xZ ～ 05:2xZ`。
- 截圖與完整背景：`BUG-129`（含三張截圖路徑，在 `D:\Downloads\`）。
- **判定方式已寫好**：`T0523` 回報區第 3 節（要看哪幾行、怎麼對應到第 1 節路徑表的 #4 / #5 / #9 / #11）。路徑表與推論見 T0523 第 1、2 節，根治方向見第 7 節。
- 外部測試者A **沒有**提供 `windows.json`。SCB 那個 Codex CLI 分頁的 terminal id 需從 debug log 推得（例如 PTY 建立 / 還原時記錄的 id 與 workspaceId）；推不出來就寫明缺口。

## 調查範圍

1. **版本**：兩份日誌各自是哪個 BAT 版本寫的（依 startup 行或其他可辨識的特徵；不要只用字串存在性判版，L127）。
2. **事件定位**：在 `bat-scripts.log` 找出產生 `bbe2011f…` 的那次派工（`invoke` / `parsed` / `exit`），列出 `env.BAT_TERMINAL_ID` / `env.BAT_WORKSPACE_ID`、`notifyId` / `workspaceId`、`agent`、exit code。
3. **在 debug log 對應同一事件**：`[remote][terminal] terminal-created … workspaceId=<R>`、`[agent-command] resolved agent=…`、`[T0130] External terminal added: … workspaceId(landed)=<L> workspaceId(requested)=<R>`、是否有 `[T0361] Workspace miss`。
4. **身分對照**：從 debug log 找出 SCB 工作區 id、專案B 工作區 id、SCB 的 Codex CLI 分頁 terminal id、專案B 各分頁 terminal id（PTY 建立 / 還原行、Terminal Server 重接行等）。把派工時的 `BAT_TERMINAL_ID` / `BAT_WORKSPACE_ID` 對到這些 id。
5. **判定**（依 T0523 §3 對應表）：
   - R = 專案B id 且 `BAT_TERMINAL_ID` = 專案B 分頁 → **#11**（env 來自另一個分頁，agent CLI 還原了舊環境）
   - R = 專案B id 但 `BAT_TERMINAL_ID` = SCB 分頁 → SCB 分頁自身 env 過期（#5 或新路徑）→ T0523 已可修正
   - R 未知且 L = 專案B → **#9**
   - 以上都不符 → 寫出新路徑與證據
6. **agent**：確認 `--agent default` 解析成 Claude 的來源（SCB / 專案B 工作區的 `defaultAgent`、`settings.defaultAgent`），與 PLAN-040（工作區層級預設 Agent 沒有 UI）的關係。
7. **同一事件的其他派工**：`bat-scripts.log` 裡其他派工（例如 04:35Z 那筆 `codex … $ct-exec T0008` 的 raw command 派工）是否也有 env 與所在分頁不一致的情形；有 pre.8 helper 紀錄的話，看 T0523 的落點輸出是否正確。
8. **順帶（次要，只記錄不展開）**：debug log 裡若有與 BUG-127（切換工作區 toast 洪水）、BUG-128（mac Finder 拷貝貼上）相關的錯誤或異常，列出行號與一句說明即可。

## 研究指引

- 對照日誌行時，到程式碼找該行的出處（`electron/terminal-command-handlers.ts`、`electron/dispatch-workspace.ts`、`electron/pty-manager.ts`、`src/App.tsx`、`scripts/bat-terminal.mjs`），確認語意，避免看錯欄位。
- 若判定為 #11：評估 T0523 §7-1 的根治方案（helper 送祖先 PID 鏈、main 比對 PTY pid；mac / Linux / Windows 各自取得 ppid 的方式與成本；遠端 headless 是否適用），以及較便宜的替代（例如 `cwd` 與工作區 `folderPath` 不一致時只警告），給 [A]/[B]/[C] 與推薦。
- 若判定為其他路徑：說明 pre.8 是否已修好；未修則給修正方向。
- 證據不足以判定時，寫明還缺什麼（例如 外部測試者A 的 `windows.json`、在 SCB Codex 內與一般分頁執行 `echo $BAT_TERMINAL_ID $BAT_WORKSPACE_ID` 的比對、`grep -l BAT_WORKSPACE_ID ~/.codex/shell_snapshots/*`），並寫成**可以直接轉給 外部測試者A 的要求清單**。

## 互動規則

- 本單以 `--no-interactive` 派發：不向使用者提問，證據不足就在回報區列出缺口。

## Sub-session 執行指示

1. 讀本工單、`BUG-129`、`T0523`（特別是回報區第 1-3、7 節）
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 調查 → 填回報區（DONE / PARTIAL / BLOCKED）
4. 依結論更新 `BUG-129`：在「根因與修正」段後新增「**外部測試者A 日誌判定（T0526）**」小節（判定結果、關鍵證據、是否需後續單）；`reproducibility` 依證據調整；**`status` 維持 FIXED 不動**（結案與否由塔台決定）
5. commit 本單與 BUG-129（`git commit --only`）；不 push；依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

**DONE**。判定為 **T0523 §1 的 #11**（agent CLI 用了不是自己 PTY 的環境），信心高。另外發現 **agent 開成 Claude 是另一個獨立原因**（全域 Settings 當時沒設預設 Agent），和落點無關；這點修正了 BUG-129 初步分析中「兩個症狀可能同一根因」的推測。

還沒確認的只有 Codex 內部用的是哪一種機制（shell snapshot，或 resume 舊 thread），這不影響 BAT 端的判定。另外 SCB Codex 分頁 `1ba6042a` 屬於 `faff6af2` 是推得的，沒有直接日誌，可以靠 外部測試者A 的 `windows.json` 補實（見最後一節）。

日誌只在 `D:\Downloads\` 原地讀取，沒有複製進 repo。以下引用已把 email 遮成 `<redacted>`，沒有引用任何 token：`bat-scripts.log` 的 `env` 快照本來就不含 token（`snapshotBatEnv`）。

### 版本判定

兩份日誌都是 **v0.6.0-pre.5 ～ pre.7** 寫的。用的是程式碼對照，沒有只看字串有沒有出現（L127）。依當天的發佈時序，最可能是 pre.7。

| 證據 | 推論 |
|---|---|
| `debug` 第 2 行 `[startup] PATH fixed for GUI launch (source=login-shell)`，出現在 `node-pty loaded` 之前 | 這行在 `v0.6.0-pre.5:electron/app-paths-bootstrap.ts:65`（T0485）；`v0.6.0-pre.4:electron/main.ts` 沒有 → **≥ pre.5** |
| `debug` 第 929 行 `[agent-command] resolved agent=default to claude-cli`，行尾沒有 `source=` / `workspace=` / `workspaceSource=` | `v0.6.0-pre.7:terminal-command-handlers.ts:318` 正是這個格式；`v0.6.0-pre.8:…:419` 會多出這三個欄位（T0523）→ **< pre.8** |
| `bat-scripts.log` 的 `terminal-created` 事件有 `ignoredFrames`，但沒有 `landing` / `agent` 欄位 | `ignoredFrames` 是 T0497（pre.5）加的；`landing` 是 `v0.6.0-pre.8:scripts/bat-terminal.mjs:826` 加的 → helper 也是 **pre.5–pre.7**，而且**直到 08:13Z（16:13 UTC+8）最後一筆都不是 pre.8 helper** |
| pre.5→pre.6→pre.7 之間只改了 SSH wizard 與 profile UI 的日誌字串（`git diff v0.6.0-pre.5 v0.6.0-pre.7`），這份日誌沒有 SSH 事件 | 日誌無法區分 pre.5 / 6 / 7 |
| 11:35 這次啟動有 `[userdata-migration] … Local State: copied`、`marker: written`、`[window-registry] First launch — … Migrated 0 workspaces` | 這是 外部測試者A **第一次啟動 T0480 之後的版本**（新的 userData 目錄，0 個工作區）。兩個工作區都是這次啟動之後才建立的，所以 #2「啟動還原」、#3「Terminal Server 重接」在事件之前都**不可能**發生 |

⇒ 這兩份日誌**沒有** T0523 的落點輸出，也沒有 T0525 的修正（Terminal Server 復原時不帶 env）。

### 事件時間線（UTC 與 UTC+8 並列）

| UTC | UTC+8 | 事件（日誌行） |
|---|---|---|
| 03:35:25 | 11:35:25 | BAT 啟動，PID 48287（debug:1），第一次啟動新 userData（debug:4-23） |
| 03:35:50 | 11:35:50 | 第一個工作區的 `initTerminals … terminals=0`（debug:47-51，新建工作區） |
| 03:44:09 | 11:44:09 | `pty:create 77f17a65-…`（debug:228），2 秒內進入 alt buffer（TUI 啟動）⇒ **專案B**的 Codex CLI 分頁 |
| 03:53:36 | 11:53:36 | 第二次 `initTerminals … terminals=0`（debug:~287-291）⇒ 新建第二個工作區（**SCB**） |
| 03:53:50 | 11:53:50 | `pty:create 1ba6042a-…`（debug:342），2 秒內進入 alt buffer ⇒ **SCB** 的 Codex CLI 分頁 |
| 04:35:33 | 12:35:33 | 專案B 塔台以 raw command 派 T0008 → `85699c9b…`，落在 `ff79114e`（debug:599-601） |
| 04:54:12 | 12:54:12 | 專案B 塔台派 T0009 → `f046a185…`，落在 `ff79114e`（debug:730-734） |
| 05:18:05 | 13:18:05 | T0009 Worker `bat-notify` → target `77f17a65`（scripts log） |
| **05:18:17** | **13:18:17** | **事件**：`--agent default --skill ct-exec --workorder T0001`，cwd = SCB，`--notify-id 77f17a65… --workspace ff79114e…` → `resolved agent=default to claude-cli`（debug:929）→ `terminal-created id=bbe2011f… workspaceId=ff79114e…`（debug:933）→ `[T0130] … workspaceId(landed)=ff79114e… workspaceId(requested)=ff79114e…`（debug:934，沒有 `[T0361] Workspace miss`）；helper exit 0 |
| 05:24:02 | 13:24:02 | `[logging] config updated`（debug:1048）＝**這次啟動後第一次 `settings:save`** |
| 05:25:17 | 13:25:17 | SCB 塔台改帶 `--notify-id 1ba6042a… --workspace faff6af2… --agent codex` → `[WARN] cannot build launch command for agent=codex resolved=codex`（debug:1057），helper exit 1 `terminal-not-created` |
| 05:26:00 | 13:26:00 | 同上但 `--agent default` → `resolved agent=default to codex-cli`（debug:1062）→ `0883ded8…` 落在 `faff6af2`（debug:1066-1067）。這就是 外部測試者A 說的「他自己修正了」 |
| 06:37:18 | 14:37:18 | 專案B 塔台再派 T0008 → `15dca04b…`，落在 `ff79114e` |
| 07:56:27 | 15:56:27 | `heartbeat timeout (1008781ms since last pong)` → `Killed 4 orphan PTY(s)` → re-fork → 重建 `77f17a65` / `1ba6042a` / `0883ded8` / `15dca04b`（debug:1704-1714）；07:56:55 `System resumed from sleep`。這是 mac 睡眠觸發的 **#5**（pre.7 重建時不帶 env） |
| 08:02:57 | 16:02:57 | `bat-terminal --help`（scripts log），env 仍是 `77f17a65` / `ff79114e` |
| 08:07:46 | 16:07:46 | renderer 重新 `pty:create 1ba6042a`（debug:1850） |
| 08:13:13 | 16:13:13 | 專案B 塔台派 T0010 → `176d6018…`，落在 `ff79114e`（debug:1874-1876）；派工前 4 秒剛切到 `77f17a65` 分頁（debug `isActive … 77f17a65` 08:13:09） |
| 08:47:27 | 16:47:27 | debug log 最後一行 |

### 判定結果（對應 T0523 §1 的路徑編號）

**判定：#11**（agent CLI 用的環境不是自己 PTY 的；env 來自另一個分頁）。

身分對照：

| 對象 | id | 依據 |
|---|---|---|
| 專案B 工作區 | `ff79114e-c69a-4d76-be35-a0b0e18446a1` | 專案B 塔台 4 次派工（cwd = 專案B）都用它，也都落在它；外部測試者A 的截圖中，專案B 工作區有 4 個分頁（Codex CLI、Remote: codex ×2、新的 Claude），對應 `77f17a65`、`85699c9b`/`f046a185`、`bbe2011f` |
| 專案B Codex CLI 分頁（專案B 塔台） | `77f17a65-8ab2-4463-922c-fb4a25334652` | 專案B 派工的 `--notify-id`；T0008 / T0009 Worker 的 `BAT_TOWER_TERMINAL_ID`；`[T0133] Notified target=77f17a65`（debug:1404） |
| SCB 工作區 | `faff6af2-a569-4927-a879-5e89af3af825` | SCB 塔台自我修正後的派工帶它，並以 `landed = requested` 落地（debug:1067，renderer 認得這個 id） |
| SCB Codex CLI 分頁（SCB 塔台） | `1ba6042a-8ab4-4d89-890e-3cfe97ac8ed1` | 第二個工作區建立後 14 秒建立的 TUI 分頁；SCB 塔台自我修正時拿它當 `--notify-id`。⚠️ pre.7 的 `pty:create` 日誌不記 workspaceId，所以「`1ba6042a` ∈ `faff6af2`」是推得的，`windows.json` 可以補實 |

對應 T0523 §3：`R = ff79114e`（專案B），而且派工時的 `BAT_TERMINAL_ID = 77f17a65`（**專案B**塔台分頁，不是 SCB 的 `1ba6042a`）⇒ **#11**。

其他路徑都排除：
- **#2 / #3**（還原、重接）：這次是新 userData 的第一次啟動，`1ba6042a` 是 03:53:50 當場新建的，事件之前沒有任何還原或重接
- **#4**（`pty:restart`）：事件前日誌沒有任何 `1ba6042a` 的重建；只有 03:53:50 建立一次，下一次是 08:07:46
- **#5**（heartbeat 復原）：07:56 才發生，比事件晚
- **#9**（未知 id 退回 active）：R 是有效 id，沒有 `[T0361] Workspace miss`，`landed = requested`
- **#10**（多視窗）：`broadcastWindows=1`，只有一個視窗

因此依 renderer 注入規則（T0523 §1 前提），`1ba6042a` 的 PTY env 應是 `BAT_TERMINAL_ID=1ba6042a…` / `BAT_WORKSPACE_ID=faff6af2…`。

但 SCB Codex 執行的指令看到的卻是專案B 的值，而且是**持續性的**：05:18、05:25、05:26 三次 SCB 派工的 `env` **都是** `77f17a65` / `ff79114e`。05:25 起塔台已經改在 argv 自行帶入正確的 `1ba6042a` / `faff6af2`，但 env 沒有變（scripts log `invoke` 的 `env` 欄位）。

**另一條獨立的強佐證**：07:56 的復原（pre.7）重建 PTY 時**不帶 env**。新 shell 只有 terminal-server 行程的 env：main 的 `process.env`，加上 `BAT_USER_DATA` / `BAT_SCROLL_BUFFER_LINES` / `BAT_IDLE_TIMEOUT_MS` / `BAT_SESSION`。這裡面沒有 `BAT_TERMINAL_ID`、`BAT_WORKSPACE_ID`、`BAT_REMOTE_PORT` 或 token：`v0.6.0-pre.7:electron/pty-manager.ts` 復原段的 `pty:create` 沒有 `env`，`v0.6.0-pre.7:electron/main.ts` 的 fork env 也沒有，main 也從不把這些變數寫進自己的 `process.env`。

然而 08:02:57 與 08:13:13 兩次 helper 呼叫的 env 仍然是 `77f17a65` / `ff79114e` / `9876`，而且通過了認證。08:02:57 那一刻，**沒有任何活著的 BAT PTY 帶著這組 env**（4 個都是不帶 env 的復原 PTY，`1ba6042a` 到 08:07:46 才重建）。

⇒ Codex 執行指令時用的 `BAT_*` 來自 Codex 自己保存的舊環境，而不是當下的 PTY env。只有一種情況會推翻這個推論：睡眠前的 codex 行程撐過了 PTY 被殺（`Killed 4 orphan PTY(s)`），而且還繼續跟使用者互動。這種可能性很低。

兩個 Codex（專案B、SCB）整天看到的都是同一組 `77f17a65` 環境。這和以下兩種機制都吻合：(a) shell snapshot 跨 session 共用，或以 thread 為鍵、SCB 分頁 resume / 切到了在專案B 分頁建立的 thread（Codex 狀態列的 thread 名稱「套用專案B 規則」）；(b) 其他 Codex 端的環境保存機制。日誌無法區分；對 BAT 而言結論相同：**helper 送來的 `--notify-id` / `--workspace` 都不可信**。

**pre.8（T0523）能不能修好**：不能。`--notify-id 77f17a65` 在 registry 中屬於專案B，所以「塔台終端優先」同樣會落在專案B。pre.8 的效果只有讓錯誤看得見：helper 會印 `workspace: <專案B>… — the Tower terminal's workspace (--notify-id)`。

另外有一個 T0523 沒強調的**副作用風險**：Worker 的 `BAT_TOWER_TERMINAL_ID` 也會是 `77f17a65`，完成通知會預填到**專案B 塔台**。這次是 `CT_MODE=ask`，所以只是預填；如果是 `yolo` 加 `--submit`，就會把 SCB 的「T0001 完成」**送進**專案B 塔台並觸發它的流程。

### agent 解析

- 05:18:17 `default` → `claude-cli`（debug:929）。pre.7 的解析順序是工作區 `defaultAgent` → `settings.defaultAgent` → `claude-code`，每次派工都用 `readPersistedSettingsSync` 從磁碟讀（`v0.6.0-pre.7:electron/main.ts:514/570`）
  - 工作區層級：`Workspace.defaultAgent` **沒有 UI 可以設定**（PLAN-040），專案B 和 SCB 都不可能有值
  - 全域：這次啟動是新 userData 的第一次啟動，第一次 `settings:save` 發生在 05:24:02（debug:1048；`settings:save` 每次都會印 `[logging] config updated`，`electron/main.ts` settings:save handler）。佐證：05:18 的 `shell-resolution … persistedShell=unset`（debug），到 05:26 變成 `persistedShell=auto source=persisted` ⇒ 05:18 時 `settings.json` 沒有 `defaultAgent` ⇒ 退到內建 `claude-code`
- 05:26:00 `default` → `codex-cli`（debug:1062）。中間唯一的變化就是 05:24:02 那次 Settings 存檔 ⇒ 外部測試者A 在 Settings 把全域預設 Agent 改成 Codex（推論，但只有這個解釋說得通：工作區層級沒有入口，而且 05:18 時全域是空的）
- ⇒ **就算當時落在 SCB，也一樣會開 Claude**。agent 錯誤的原因是「全域與工作區都沒設預設 Agent」，**和落點錯誤是兩個獨立原因**，跟 `--workspace` 帶哪個 id 無關。PLAN-040（工作區層級預設 Agent 的 UI）正好補這個缺口；D140 不改 `default` 查找順序的決定不受影響
- 順帶：05:25:17 的 `--agent codex` 失敗（debug:1057，helper exit 1）是因為 agent id 應該是 `codex-cli`，`toTerminalDrivenAgentId('codex')` 不會轉換。現行程式（pre.8）一樣會失敗，而 helper 只回 `terminal-not-created`，沒有說是 agent id 不認得。這是小的 UX 缺口，見建議下一步

### 其他派工 / pre.8 落點輸出

| 時間（UTC / UTC+8） | 發起者 | env `BAT_TERMINAL_ID` / `BAT_WORKSPACE_ID` | argv `--notify-id` / `--workspace` | 落點 | 一致？ |
|---|---|---|---|---|---|
| 04:35:33 / 12:35:33 | 專案B 塔台（T0008，raw `codex …`） | `77f17a65` / `ff79114e` | 同 | `ff79114e` | ✅ |
| 04:54:12 / 12:54:12 | 專案B 塔台（T0009） | 同 | 同 | `ff79114e` | ✅ |
| **05:18:17 / 13:18:17** | **SCB 塔台（T0001）** | `77f17a65` / `ff79114e` | 同（取自 env） | `ff79114e` | ❌ 落到專案B |
| 05:25:17 / 13:25:17 | SCB 塔台（自我修正，`--agent codex`） | `77f17a65` / `ff79114e` | `1ba6042a` / `faff6af2` | 未建立（agent id 錯） | env ❌ / argv ✅ |
| 05:26:00 / 13:26:00 | SCB 塔台（自我修正，`--agent default`） | `77f17a65` / `ff79114e` | `1ba6042a` / `faff6af2` | `faff6af2` | env ❌ / argv ✅ |
| 06:37:18 / 14:37:18 | 專案B 塔台（T0008） | `77f17a65` / `ff79114e` | 同 | `ff79114e` | ✅ |
| 08:02:57 / 16:02:57 | 不明（`--help`） | `77f17a65` / `ff79114e` | — | — | 此時沒有任何活著的 PTY 帶這組 env（見判定） |
| 08:13:13 / 16:13:13 | 專案B 塔台（T0010） | `77f17a65` / `ff79114e` | 同 | `ff79114e` | 值正確，但同樣不是來自 PTY 的 env |

Worker 端（BAT 自己用 `create-with-command` 建立的 `f046a185` / `85699c9b`）`bat-notify` 的 env 都正確（`BAT_TERMINAL_ID` = 自己、`BAT_TOWER_TERMINAL_ID` = `77f17a65`）。Worker 的 codex 是由 BAT 以新 command 啟動的。

**pre.8 落點輸出**：`bat-scripts.log` 到 08:13Z（16:13 UTC+8）為止都沒有 pre.8 helper 的紀錄（沒有 `landing` / `agent` 欄位），無法驗證 T0523 的輸出。

### 順帶觀察（BUG-127 / 128）

- BUG-127（切換工作區 toast 洪水）：debug log 沒有 toast 或工作區切換相關的日誌行（pre.7 不記這類事件），**無相關證據**
- BUG-128（mac Finder 拷貝貼上）：沒有 paste / clipboard 相關行，**無相關證據**
- 其他異常（只記錄）：
  - debug:1099 / 1147 / 1170：`[CRASH] child-process-gone type=GPU reason=crashed exitCode=5`，13:26:48–13:30:14 UTC+8 內 3 次。GPU 行程崩潰，與 BUG-129 無關
  - debug:1704-1714：mac 睡眠約 16.8 分鐘後 heartbeat 判定 Terminal Server 死亡並復原，正是 T0523 §1 的 #5（pre.7 復原時不帶 env），T0525（pre.8）已修
  - debug:2121-2153：08:29:56–08:30:49Z 之間 Settings 連續存檔 16 次（每次都印 `config updated`）。看起來是使用者在 Settings 逐項調整，沒有錯誤

### 建議方向

- [A] **以 PID 祖先鏈辨識呼叫者 PTY（根治）**：helper 送出自己的祖先 PID 鏈（`callerPids`），main 對照 PtyManager 已知的 PTY shell pid（Terminal Server 模式也會回報 pid，例如 `server spawned PTY … (pid N)`；復原或重建後 pid 會更新），找到所屬 PTY 後，落點、`--notify-id` 與 Worker 的 `BAT_TOWER_TERMINAL_ID` 一律以它為準，env 值只用來比對並記錄 mismatch
  - **mac / Linux**：一次 `ps -A -o pid=,ppid=` 就能建出整棵樹（約 10–30 ms）；Linux 也可以直接讀 `/proc/<pid>/stat`，成本更低
  - **Windows**：Node 只有 `process.ppid` 一層。要完整的鏈只能用 PowerShell `Get-CimInstance Win32_Process`（每次約 0.5–1 s）或已淘汰的 `wmic`。可以只取到 Windows 上的 best-effort，或者不做（目前也沒有 Windows 上的 #11 回報）
  - **遠端 headless**：helper 在遠端主機執行，server 端也有 PTY pid，同樣適用。但權杖本身也在 env 裡，舊快照也會帶舊權杖，所以權杖不能取代 PID 比對
  - **限制**：如果 agent 把指令交給**不在 PTY 子樹內的常駐行程**執行（例如 Codex daemon，T0377 的 `features.daemon_auto_start`），祖先鏈會斷在 launchd 或 init。這時只能退回 env，並在 helper 輸出中警告
  - 規模約 M：helper、main handler、protocol 欄位、headless，加上測試
- [B] **cwd 與落點工作區 `folderPath` 的一致性檢查（便宜，直接抓到 外部測試者A 這次）**：main 解析出落點後，比對派工的 `cwd`（helper `--cwd` 或 `process.cwd()`）是否在落點工作區的 `folderPath` 底下
  - 不一致時：helper 在 stderr 印出警告，列出 cwd 實際所屬的工作區（如果剛好只有一個工作區包含它），main 記 `[BUG-129] cwd outside landing workspace`
  - `CT_MODE=yolo` 或 `--submit` 時可以**拒絕派工**（exit 1），避免完成通知送進別的專案塔台
  - 不改 T0137「不以 cwd 為主規則」的決定，只做檢核與提示
  - 外部測試者A 這次：cwd = SCB，落點 = 專案B（`folderPath` = 專案B 資料夾）⇒ 會被抓到
  - 規模約 S
- [C] **在 BAT 的 codex-cli preset 關閉 Codex shell snapshot**（啟動參數加 `-c features.shell_snapshot=false`，比照 T0377 的 daemon 旗標）：如果確認機制是 snapshot，可以從源頭讓 Codex 用 live PTY env
  - 缺點：還沒證實機制；可能拖慢 Codex 執行指令；只涵蓋 BAT preset 啟動的 Codex，使用者自己在一般分頁打 `codex` 時不適用；旗標名稱和行為會隨 Codex 版本改變
- **推薦**：**先做 [B]**（下一批，規模 S，直接擋下 外部測試者A 這種情況，yolo 下的錯塔台送出也一併擋掉），同時把下方清單轉給 外部測試者A 確認 Codex 內部機制。**[A] 另開實作單**，排在 [B] 之後；如果 外部測試者A 回報 #11 反覆發生，或有其他 agent CLI（Claude 的 resume）出現同類情況，就提高優先。[C] 等 外部測試者A 的 snapshot 證據出來後再評估，**不當主修**

### 建議下一步

1. 開實作單 [B]：落點與 cwd 一致性檢查。範圍包含本機 `create-agent-command` / `create-with-command`、helper 輸出、yolo 拒派；e2e 可沿用 `e2e/t0523-dispatch-workspace.spec.ts` 的隔離實例與 echo agent
2. 將「給 外部測試者A 的補充要求」轉給 外部測試者A；拿到結果後決定 [A] / [C]
3. BUG-129 狀態：BAT 端的 #4 / #5 / #10 已在 pre.8 修好；外部測試者A 這次屬於 #11，pre.8 只能讓它被看見。建議 BUG-129 在 [B] 完成並由 外部測試者A 驗收後再結案，或者把 #11 另開 BUG（由塔台決定）
4. 小缺口（可併入 [B] 或 PLAN-040）：`--agent codex` / `--agent claude` 這類常見簡寫要嘛轉成 `codex-cli` / `claude-cli`，要嘛讓 helper 在 agent id 不認得時印出可用的 id 清單（目前只有 `terminal-not-created`）
5. control-tower skill 文件（`references/auto-session.md`）可以補一句：「塔台派工前，核對 `$BAT_WORKSPACE_ID` 對應的工作區 `folderPath` 是否涵蓋當前 cwd」。外部測試者A 的塔台已經自己寫進它專案的 `_local-rules.md` 了

### 給 外部測試者A 的補充要求（若證據不足）

判定本身證據足夠。以下用來確認 Codex 內部機制與 `1ba6042a` 的歸屬，可以直接轉給 外部測試者A：

1. **在 SCB 的 Codex CLI 分頁內**，請 Codex 執行：`echo "$BAT_TERMINAL_ID $BAT_WORKSPACE_ID"`。再**在 SCB 工作區開一個一般終端分頁**（不要開 Codex），執行同一行，把兩邊的輸出貼回來（這兩個值不是機密）
2. 在一般終端執行：`ls -lt ~/.codex/shell_snapshots/ | head -20`，以及 `grep -l 77f17a65 ~/.codex/shell_snapshots/* 2>/dev/null`。⚠️ **只回傳檔名清單，不要傳檔案內容**：快照內含 `BAT_REMOTE_TOKEN`
3. `codex --version`；另外說明 SCB 那個 Codex 是怎麼開始的：直接開新對話，還是用過 `codex resume` / `/resume`，或者選過「套用專案B 規則」這個 thread
4. 工作區與分頁對照（只取 id / 名稱 / 路徑，不含其他內容）：`jq '.[] | {ws: [.workspaces[] | {id, name, folderPath, defaultAgent}], terms: [.terminals[] | {id, workspaceId, agentPreset, title}]}' ~/Library/Application\ Support/BetterAgentTerminal/windows.json`（macOS 15 內建 `jq`；沒有的話直接傳 `windows.json` 也可以）
5. 升級 pre.8 之後，在 SCB 塔台再派一次工，把 helper 輸出的 `workspace:` / `agent:` 兩行貼回來

### 遭遇問題

- 無阻礙。工單「已知資訊」提到的三張截圖，`D:\Downloads\` 一張都不在（`messageImage_17919*` 不存在），截圖內容以 BUG-129 的文字描述為準
- 為了確認 `windows.json` 的結構，讀了本機真實 userData 的 `windows.json` 頂層型別（只印出「是陣列」，沒有讀內容、沒有修改）。欄位後來改由 `electron/window-registry.ts` 的 `WindowEntry` 與 `src/types/index.ts` 確認。沒有碰 port 9876 與 `bat-scripts.log`

### Landing Zone Check

- **PASS**
- C-0 PASS：`repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`（REPO_ROOT = `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）
- C-1 PASS：工單位於 REPO_ROOT 之下
- C-3 not applicable：`affects_files` 都在 `_ct-workorders/` 底下
- C-2：沒有 `branch` 欄位（目前在 `main`）
- `BAT_WORKSPACE_ID`（evidence only）= `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`；`CT_MODE=yolo`、`CT_INTERACTIVE=0`

### 互動紀錄

- 依 `--no-interactive` 派發，沒有向使用者提問

### Commit

- 見 commit `T0526`（本單 + BUG-129，`git commit --only`，不 push）
