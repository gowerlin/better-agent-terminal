---
schema_version: 1
schema_kind: workorder
id: T0626
title: "探針：CT v5.7.2 多題混合通道＋等待中取消的晚退回標記（F-1 ② ／ 第 6 步）"
type: verification
status: DONE
repo: better-agent-terminal
project: CT-v5.7.1/v5.7.2 驗收（BMad-Guide 請求）
priority: P2
sizing: S
created_at: "2026-10-18T12:39:02+0800"
started_at: "2026-10-18T12:44:08+0800"
updated_at: "2026-10-18T12:47:00+0800"
completed_at: "2026-10-18T12:47:00+0800"
depends_on: [T0625]
related:
  - "CT v5.7.1 / v5.7.2 × BAT 0.7.0-pre.8 實機驗收第 2 張（T0625–T0629）；對照 v5.7.0 的 T0616"
affects_files:
  - _ct-workorders/T0626-probe-ct572-mixed-late-fallback.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: guided-probe
memory_overrides:
  - "🔴 本單的受測對象是你自己的 ct-exec v5.7.2 提問流程（`ct-exec` § Questions For Tower ＋ control-tower `references/yolo-mode.md` § Worker 向塔台提問，特別是 3-A 第 2 步與第 6 步）。除了下方明寫的兩處**刻意安排**（Q-2 參數錯誤、Q-3 由你取消），其餘一律照 skill 規則做。"
  - "🔴 三題都是刻意安排的受測提問：即使你判斷可以自行決定，也一定要向塔台提問（不得問使用者）。"
  - "🔴 不讀產品程式碼、不改任何其他檔案、不跑 build / test。`src/styles/settings.css` 的 M 不是你的變更。不 push。commit 用 `git commit --only <本檔>`。"
  - "🔴 題目內容只走 stdin；暫存檔放系統暫存目錄，**不得**寫進 repo。回報區不得出現任何權杖值。"
---

# T0626 — 探針：多題混合通道＋晚退回標記

## 目標

| 題 | 路徑 | 刻意安排 | 預期 |
|---|---|---|---|
| Q-1 | BAT 通道 | 無 | 塔台 `--answer`，Worker 從 BAT 收到 |
| Q-2 | `--ask` 失敗 → 工單 | `--expires-min 999`（helper 用法錯誤 exit `1`） | 3-A 第 2 步：加 `- **通道**：工單`、commit、送一次一般 `T0626 提問`，等工單答覆行 |
| Q-3 | BAT 通道 → 等待中由你取消 → 工單 | **塔台刻意不答 Q-3**（會一直是 `pending`）。你在 Q-1、Q-2 都收到答覆後，對 Q-3 執行 `--cancel-question` | 依 `status:` 行判斷；`cancelled worker` → 3-A **第 6 步**：加標記、commit、再送一次一般 `T0626 提問`，剩餘時間等工單答覆行 |

## Step 1 — 寫題目

依 skill 規則把三題一起寫進 `### 待塔台決策`（阻塞皆為是），加 `tower_question: open`，commit。題目：

- Q-1：探針 Q-1（BAT 通道），選項 [A] 收到 / [B] 沒收到
- Q-2：探針 Q-2（`--ask` 失敗降級），選項 [A] 收到 / [B] 沒收到
- Q-3：探針 Q-3（等待中取消、晚退回），選項 [A] 收到 / [B] 沒收到

## Step 2 — 送出（照這個順序）

1. Q-1：`--ask`（正常參數）→ 記 id。
2. Q-2：`--ask`，`--expires-min 999` → 記 exit code 與 stderr 第一行。
3. Q-3：`--ask`（正常參數）→ 記 id。
4. 依 skill 3-A 第 2 步處理退回的 Q-2（標記、commit、送幾則一般 `提問`），記下實際做法與時間。

## Step 3 — 等答覆、取消 Q-3

1. 依 skill 同時等：Q-1、Q-3 走 BAT 等待（每次 `timeoutMs` ≤ 30000，同一題兩次呼叫間隔不得超過 120 s），Q-2 用區段限定的 awk 讀工單答覆行（間隔 ≥ 30 s）。
2. Q-1、Q-2 都收到答覆後 → 對 Q-3 執行 `--cancel-question <id>` → 記 exit code 與 stdout 全部 `status:` 行。
3. 依 skill 處理 Q-3（`cancelled worker` → 第 6 步）。記下標記寫入時間、commit hash、一般 `提問` 送出時間。
4. 等 Q-3 的工單答覆行。三題都答完 → 刪 `tower_question`，逐題寫互動紀錄。

## Step 4 — 收尾

照 ct-exec 收尾（含 notify 前自檢）。回報區另寫 `### 驗收證據`：每題的路徑、指令參數（不含題目內容）、exit code、id、`status:` 行、答覆來源、收到時間；一般 `提問` 送出的次數與各自觸發的題；Q-2 / Q-3 標記行與對應 commit；notify 前自檢結果。完成後送 `T0626 完成`（yolo `--submit`）。

## 驗收條件

- Q-1 從 BAT 收到；Q-2 / Q-3 從工單答覆行收到；每題只有一個通道答覆
- Q-2、Q-3 各有一行 `- **通道**：工單`，且各在對應的一般 `提問` 送出前已 commit
- 回報區 `### 驗收證據` 完整；回報區沒有範本佔位文字

---

## 回報區

### 待塔台決策

#### Q-1：探針 Q-1（BAT 通道）
- 提問時間：2026-10-18T12:44:08+0800
- 選項：[A] 收到 / [B] 沒收到 / [C] 其他：________
- Worker 建議：[A]，因為這是刻意安排的受測提問，收到即代表通道可用
- 影響範圍：本工單 Step 3–4 與驗收證據
- 阻塞：是（Step 3 起要等答覆）

#### Q-2：探針 Q-2（`--ask` 失敗降級）
- 提問時間：2026-10-18T12:44:08+0800
- 選項：[A] 收到 / [B] 沒收到 / [C] 其他：________
- Worker 建議：[A]，因為這是刻意安排的受測提問，收到即代表通道可用
- 影響範圍：本工單 Step 3–4 與驗收證據
- 阻塞：是（Step 3 起要等答覆）
- **通道**：工單
- **塔台答覆 Q-2**：[A] 收到——該題有 `通道` 標記，依規則改在工單答覆（2026-10-18T12:44:58+0800；塔台代決）

#### Q-3：探針 Q-3（等待中取消、晚退回）
- 提問時間：2026-10-18T12:44:08+0800
- 選項：[A] 收到 / [B] 沒收到 / [C] 其他：________
- Worker 建議：[A]，因為這是刻意安排的受測提問，收到即代表通道可用
- 影響範圍：本工單 Step 3–4 與驗收證據
- 阻塞：是（Step 3 起要等答覆）
- **通道**：工單
- **塔台答覆 Q-3**：[A] 收到——該題有晚退回 `通道` 標記（列表 `cancelled worker`），依規則改在工單答覆（2026-10-18T12:45:46+0800；塔台代決）

### 完成狀態

DONE — 三題依 ct-exec v5.7.2 規則完成：Q-1 經 BAT 通道收到答覆；Q-2（`--ask` 失敗）走 3-A 第 2 步、Q-3（等待中由 Worker 取消，`cancelled worker`）走 3-A 第 6 步，兩題都從工單答覆行收到。每題只有一個通道答覆。

### 落點檢查

- 結果：PASS
- C-0：frontmatter `repo` = `better-agent-terminal`；`basename(REPO_ROOT)` = `better-agent-terminal` → PASS（`REPO_ROOT` = `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）
- C-1：工單在 `REPO_ROOT/_ct-workorders/` 下 → PASS
- C-3：`affects_files` 只有本工單（`_ct-workorders/` 下）→ 不適用
- C-2：工單無 `branch` 欄位 → 不適用（實際分支 `main`）
- `CT_HOME` 未設（非 worktree 隔離）；`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）
- 環境：`CT_MODE=yolo`、`CT_INTERACTIVE=0`、`BAT_TOWER_TERMINAL_ID` / `BAT_REMOTE_PORT` / `BAT_REMOTE_TOKEN` 皆可見；helper = `$BAT_HELPER_DIR/bat-notify.mjs`（`C:\Program Files\BetterAgentTerminal\resources\scripts`）

### 互動紀錄

- [12:44] Q-1: 探針 Q-1（BAT 通道） → A（塔台，BAT 通道，choice 1）: [A] 收到——Q-1 經 BAT 通道送達（塔台代決） → Action: 記錄為 BAT 通道收到，繼續
- [12:45] Q-2: 探針 Q-2（`--ask` 失敗降級） → A（塔台）: [A] 收到——該題有 `通道` 標記，依規則改在工單答覆 → Action: 記錄為工單答覆收到；Q-1、Q-2 皆答完後對 Q-3 執行 `--cancel-question`
- [12:46] Q-3: 探針 Q-3（等待中取消、晚退回） → A（塔台）: [A] 收到——該題有晚退回 `通道` 標記（列表 `cancelled worker`），依規則改在工單答覆 → Action: 記錄為工單答覆收到；三題答完，刪除 `tower_question`，收尾

### 驗收證據

時間皆取自系統（`date`，+0800）。題目內容只經 stdin（Git Bash heredoc）傳給 helper；輸出暫存在 Claude scratchpad（系統暫存目錄），未寫進 repo。

| 題 | 路徑 | 指令參數（不含題目內容） | exit | id | `status:` 行 | 答覆來源 | 收到時間 |
|---|---|---|---|---|---|---|---|
| Q-1 | BAT 通道 | `--ask --source T0626 --target $BAT_TOWER_TERMINAL_ID --submit --expires-min 30 "T0626 提問"` | `0`（`notified: yes`，送出 12:44:35） | `q-4b13b4f7-faf8da49c7327ce9` | —（MCP `bat_wait_question` 回 `changed: true`、`status: answered`、`choice: 1`） | BAT（`bat_wait_question`，`timeoutMs` 30000） | `answeredAt` 2026-10-18T12:44:45+0800；Worker 第一次 wait 即取得（`waitedMs: 1`） |
| Q-2 | `--ask` 失敗 → 工單（3-A 第 2 步） | `--ask --source T0626 --target $BAT_TOWER_TERMINAL_ID --submit --expires-min 999 "T0626 提問"` | `1`；stderr 第一行 `Error: Invalid --expires-min value: '999' (expected minutes, 1-120)` | 無 | — | 工單答覆行（`### 待塔台決策`，區段限定 awk exit 0） | 答覆行標記 12:44:58；Worker 讀到 12:45:27 |
| Q-3 | BAT 通道 → Worker 取消 → 工單（3-A 第 6 步） | `--ask` 參數同 Q-1；`--cancel-question q-4b13b4f7-94c69d7742827f77` | `--ask` `0`（12:44:35）；`--cancel-question` `0`（12:45:31） | `q-4b13b4f7-94c69d7742827f77` | `status: cancelled worker`（stdout 只有這一行 `status:`；另一行 `✓ Question cancelled: q-4b13b4f7-94c69d7742827f77`） | 工單答覆行（區段限定 awk，間隔 30 s 輪詢） | 答覆行標記 12:45:46；Worker 讀到 12:46:22 |

- Q-3 在取消前的 BAT 等待：與 Q-1 的 wait 同時發出一次 `bat_wait_question`（`timeoutMs` 30000）→ `changed: false`、`status: pending`、`waitedMs: 30002`；之後 12:45:31 取消，兩次呼叫間隔 < 120 s。等待開始時間未另以 `date` 記錄：Q-1 的 wait 回 `waitedMs: 1` 且 `answeredAt` 為 12:44:45，Q-3 的 wait 等滿 30 s 後、12:45:27（Q-2 awk 檢查）前結束，所以開始時間落在 12:44:45–12:44:57。
- 一般 `T0626 提問` 送出 **2 次**（`--submit`，皆 exit `0`）：
  1. 12:44:43 — 觸發題：Q-2（3-A 第 2 步，三題 `--ask` 全部送完後只送一次）
  2. 12:45:41 — 觸發題：Q-3（3-A 第 6 步晚退回）
- 從第一題 `--ask` 成功（12:44:35）到開始等待（12:44:45–12:44:57，見上）< 120 s。
- 標記行與 commit（皆在對應的一般 `提問` 送出前 commit）：
  - Q-2 `- **通道**：工單` → commit `b93f728c`（12:44:43 前；只多了標記行）
  - Q-3 `- **通道**：工單` → commit `149349c8`（12:45:41，notify 同秒之前）
- notify 前自檢：(a) Q-1–Q-3 三個 `#### Q-n：` 標題都有題目文字，下一行是「提問時間」→ PASS；(b) 回報區無範本佔位文字 → PASS；(c) `### 互動紀錄` 只有一個 → PASS。

### 遭遇問題 / 偏差

- commit `149349c8`（Q-3 晚退回標記）除了標記行，還一併帶進了塔台寫在工作樹、尚未 commit 的 `- **塔台答覆 Q-2**` 行（`git commit --only <本檔>` 以整個檔案為單位）。內容沒有變動，只是那一行由 Worker 的 commit 進版；3-A 第 6 步的「只多了標記行」在這次 commit 因此不完全成立。給塔台參考：塔台寫完工單答覆行後若不 commit，下一次 Worker commit 就會帶進去。同理，塔台寫的 `- **塔台答覆 Q-3**` 行也未 commit，由本單的收尾 commit 一併進版。
- 未讀產品程式碼、未改其他檔案、未跑 build / test、未 push；`src/styles/settings.css` 等其他 M 檔未動。回報區不含任何權杖值。

### 檔案異動

- `_ct-workorders/T0626-probe-ct572-mixed-late-fallback.md`（僅本檔）

### Commit

- `689c0093` chore: T0626 start, write Q-1..Q-3 for tower (ct)
- `b93f728c` chore: T0626 Q-2 channel marker (ask failed) (ct)
- `149349c8` chore: T0626 Q-3 late-drop channel marker (cancelled worker) (ct)
- 收尾 commit：本回報與最終狀態（以 `git log` 為準）
