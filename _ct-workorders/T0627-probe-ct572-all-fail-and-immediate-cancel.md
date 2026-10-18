---
schema_version: 1
schema_kind: workorder
id: T0627
title: "探針：CT v5.7.2 全部 `--ask` 失敗（F-1 ③）＋單題 `--ask` 後立刻取消（F-1 ④ a）"
type: verification
status: DONE
started_at: "2026-10-18T12:48:36+08:00"
updated_at: "2026-10-18T12:51:34+08:00"
completed_at: "2026-10-18T12:51:34+08:00"
repo: better-agent-terminal
project: CT-v5.7.1/v5.7.2 驗收（BMad-Guide 請求）
priority: P2
sizing: S
created_at: "2026-10-18T12:39:02+0800"
depends_on: [T0626]
related:
  - "CT v5.7.1 / v5.7.2 × BAT 0.7.0-pre.8 實機驗收第 3 張（T0625–T0629）"
affects_files:
  - _ct-workorders/T0627-probe-ct572-all-fail-and-immediate-cancel.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: guided-probe
memory_overrides:
  - "🔴 本單的受測對象是你自己的 ct-exec v5.7.2 提問流程（`ct-exec` § Questions For Tower ＋ control-tower `references/yolo-mode.md` § Worker 向塔台提問）。除了下方明寫的**刻意安排**，其餘一律照 skill 規則做。"
  - "🔴 所有題目都是刻意安排的受測提問：即使你判斷可以自行決定，也一定要向塔台提問（不得問使用者）。"
  - "🔴 不讀產品程式碼、不改任何其他檔案、不跑 build / test。`src/styles/settings.css` 的 M 不是你的變更。不 push。commit 用 `git commit --only <本檔>`。"
  - "🔴 題目內容只走 stdin；暫存檔放系統暫存目錄，**不得**寫進 repo。回報區不得出現任何權杖值。"
---

# T0627 — 探針：全部失敗＋立刻取消

## 目標

分兩階段，第一階段的題目都答完才開始第二階段：

| 階段 | 題 | 刻意安排 | 預期 |
|---|---|---|---|
| A | Q-1、Q-2 | 兩題的 `--ask` 都用 `--expires-min 999`（helper 用法錯誤 exit `1`） | 3-A 第 2 步：兩題各加 `- **通道**：工單`、**commit 一次**、**只送一次**一般 `T0627 提問`，等工單答覆行 |
| B | Q-3（單題） | `--ask` 成功後**立刻**（不呼叫任何 wait）對該 id 執行 `--cancel-question` | `status: cancelled worker` → 3-A 第 6 步：加標記、commit、送一次一般 `T0627 提問`，等工單答覆行 |

## Step 1 — 階段 A

1. 依 skill 規則把 Q-1、Q-2 寫進 `### 待塔台決策`（阻塞皆為是），加 `tower_question: open`，commit。
   - Q-1：探針 Q-1（全部失敗 1），選項 [A] 收到 / [B] 沒收到
   - Q-2：探針 Q-2（全部失敗 2），選項 [A] 收到 / [B] 沒收到
2. 依序送 Q-1、Q-2 的 `--ask`（`--expires-min 999`）→ 記 exit code 與 stderr 第一行。
3. 依 skill 第 2 步處理（標記、commit、一般 `提問`），記下 commit hash 與送出次數。
4. 用區段限定的 awk 等兩題的工單答覆行（間隔 ≥ 30 s），收到後寫互動紀錄。

## Step 2 — 階段 B

1. 依 skill 規則在 `### 待塔台決策` 接著寫 Q-3（阻塞：是），commit（`tower_question` 若已刪就重新加 `open`）。
   - Q-3：探針 Q-3（`--ask` 後立刻取消），選項 [A] 收到 / [B] 沒收到
2. Q-3：`--ask`（正常參數）→ 記 id → **立刻** `--cancel-question <id>` → 記 exit code 與 stdout 全部 `status:` 行。
3. 依 skill 處理（`cancelled worker` → 第 6 步），記下標記寫入時間、commit hash、一般 `提問` 送出時間。
4. 等 Q-3 的工單答覆行。三題都答完 → 刪 `tower_question`，寫互動紀錄。

## Step 3 — 收尾

照 ct-exec 收尾（含 notify 前自檢）。回報區另寫 `### 驗收證據`：每題的路徑、指令參數（不含題目內容）、exit code、id、`status:` 行、答覆來源、收到時間；每階段一般 `提問` 送出的次數；每個標記行與對應 commit；notify 前自檢結果。完成後送 `T0627 完成`（yolo `--submit`）。

## 驗收條件

- 階段 A：兩題各一行標記、標記 commit 一次、一般 `提問` 只送一次；兩題從工單答覆行收到
- 階段 B：Q-3 `cancelled worker` → 標記 → commit → 一般 `提問`；從工單答覆行收到；Q-3 只有一行塔台答覆
- 回報區 `### 驗收證據` 完整；回報區沒有範本佔位文字

---

## 回報區

### 待塔台決策

#### Q-1：探針 Q-1（全部失敗 1）
- 提問時間：2026-10-18T12:48:36+08:00
- 選項：[A] 收到 / [B] 沒收到 / [C] 其他：________
- Worker 建議：[A]，因為這是刻意安排的受測提問，收到即代表工單通道可用
- 影響範圍：本工單 Step 1（階段 A）與驗收證據
- 阻塞：是（Step 2 起要等答覆）
- **通道**：工單
- **塔台答覆 Q-1**：[A] 收到——該題有 `通道` 標記，依規則改在工單答覆（2026-10-18T12:49:09+0800；塔台代決）

#### Q-2：探針 Q-2（全部失敗 2）
- 提問時間：2026-10-18T12:48:36+08:00
- 選項：[A] 收到 / [B] 沒收到 / [C] 其他：________
- Worker 建議：[A]，因為這是刻意安排的受測提問，收到即代表工單通道可用
- 影響範圍：本工單 Step 1（階段 A）與驗收證據
- 阻塞：是（Step 2 起要等答覆）
- **通道**：工單
- **塔台答覆 Q-2**：[A] 收到——該題有 `通道` 標記，依規則改在工單答覆（2026-10-18T12:49:09+0800；塔台代決）

#### Q-3：探針 Q-3（`--ask` 後立刻取消）
- 提問時間：2026-10-18T12:49:26+08:00
- 選項：[A] 收到 / [B] 沒收到 / [C] 其他：________
- Worker 建議：[A]，因為這是刻意安排的受測提問，收到即代表晚退回後的工單通道可用
- 影響範圍：本工單 Step 2（階段 B）與驗收證據
- 阻塞：是（Step 3 起要等答覆）
- **通道**：工單
- **塔台答覆 Q-3**：[A] 收到——該題有晚退回 `通道` 標記（列表 `cancelled worker`），依規則改在工單答覆（2026-10-18T12:50:23+0800；塔台代決）

### 完成狀態

DONE — 兩階段都照 ct-exec v5.7.2 規則完成。階段 A：Q-1、Q-2 的 `--ask` 都失敗（exit `1`）→ 3-A 第 2 步，兩題各一行標記、commit 一次、一般 `T0627 提問` 只送一次，兩題從工單答覆行收到。階段 B：Q-3 `--ask` 成功後立刻 `--cancel-question` → `status: cancelled worker` → 3-A 第 6 步（標記 → commit → 一般 `提問`），從工單答覆行收到，Q-3 只有一行塔台答覆。

### 落點檢查

- 結果：PASS
- C-0：frontmatter `repo` = `better-agent-terminal`；`basename(REPO_ROOT)` = `better-agent-terminal` → PASS（`REPO_ROOT` = `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）
- C-1：工單在 `REPO_ROOT/_ct-workorders/` 下 → PASS
- C-3：`affects_files` 只有本工單（`_ct-workorders/` 下）→ 不適用
- C-2：工單無 `branch` 欄位 → 不適用（實際分支 `main`）
- `CT_HOME` 未設（非 worktree 隔離）；`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）
- 環境：`CT_MODE=yolo`、`CT_INTERACTIVE=0`、`BAT_TOWER_TERMINAL_ID` / `BAT_REMOTE_PORT` / `BAT_REMOTE_TOKEN` 皆可見；helper = `$BAT_HELPER_DIR/bat-notify.mjs`（`C:\Program Files\BetterAgentTerminal
esources\scripts`）；`worker_question_timeout` = 30（frontmatter）

### 互動紀錄

- [12:49] Q-1: 探針 Q-1（全部失敗 1） → A（塔台）: [A] 收到——該題有 `通道` 標記，依規則改在工單答覆 → Action: 記錄為工單答覆收到，繼續階段 A 收尾
- [12:49] Q-2: 探針 Q-2（全部失敗 2） → A（塔台）: [A] 收到——該題有 `通道` 標記，依規則改在工單答覆 → Action: 記錄為工單答覆收到；階段 A 兩題答完，開始階段 B
- [12:50] Q-3: 探針 Q-3（`--ask` 後立刻取消） → A（塔台）: [A] 收到——該題有晚退回 `通道` 標記（列表 `cancelled worker`），依規則改在工單答覆 → Action: 記錄為工單答覆收到；三題答完，刪除 `tower_question`，收尾

### 驗收證據

時間皆取自系統（`date`，+0800）。題目內容只經 stdin（Git Bash heredoc）傳給 helper；helper 輸出暫存在 Claude scratchpad（系統暫存目錄），未寫進 repo。

| 題 | 路徑 | 指令參數（不含題目內容） | exit | id | `status:` 行 | 答覆來源 | 收到時間 |
|---|---|---|---|---|---|---|---|
| Q-1 | `--ask` 失敗 → 工單（3-A 第 2 步） | `--ask --source T0627 --target $BAT_TOWER_TERMINAL_ID --submit --expires-min 999 "T0627 提問"` | `1`（12:48:47）；stderr 第一行 `Error: Invalid --expires-min value: '999' (expected minutes, 1-120)`；stdout 空 | 無 | — | 工單答覆行（`### 待塔台決策`） | 答覆行標記 12:49:09；區段限定 awk 確認 12:49:39（見偏差） |
| Q-2 | `--ask` 失敗 → 工單（3-A 第 2 步） | 同 Q-1 | `1`（12:48:47）；stderr 第一行同 Q-1；stdout 空 | 無 | — | 工單答覆行（`### 待塔台決策`） | 同 Q-1 |
| Q-3 | BAT 通道 → 立刻由 Worker 取消 → 工單（3-A 第 6 步） | `--ask --source T0627 --target $BAT_TOWER_TERMINAL_ID --submit --expires-min 30 "T0627 提問"`；`--cancel-question q-4b13b4f7-22f6b53e055f47e6` | `--ask` `0`（12:49:58，`notified: yes`）；`--cancel-question` `0`（12:49:58，同一指令內緊接，中間未呼叫任何 wait） | `q-4b13b4f7-22f6b53e055f47e6` | `status: cancelled worker`（stdout 唯一一行 `status:`；另一行 `✓ Question cancelled: q-4b13b4f7-22f6b53e055f47e6`） | 工單答覆行（區段限定 awk，間隔 30 s 背景輪詢） | 答覆行標記 12:50:23；awk 確認 12:50:43 |

- 一般 `T0627 提問` 送出（`--submit`，皆 exit `0`）：
  - 階段 A：**1 次**，12:48:56 — 觸發題 Q-1、Q-2（兩題 `--ask` 都送完、標記 commit 後只送一次）
  - 階段 B：**1 次**，12:50:04 — 觸發題 Q-3（3-A 第 6 步晚退回）
  - 另有 Q-3 的 `--ask` 自己送出的通知 1 則（12:49:58，`notified: yes`）
- 標記行與 commit（皆在對應的一般 `提問` 送出前 commit）：
  - Q-1、Q-2 各一行 `- **通道**：工單` → commit `005109bb`（12:48:55；diff 只有這兩行）→ 一般 `提問` 12:48:56
  - Q-3 `- **通道**：工單` → 寫入 12:50:04 → commit `c09c3a88`（12:50:04；diff 只有這一行）→ 一般 `提問` 12:50:04（commit 之後）
- 答覆行計數：`塔台答覆 Q-3` 在工單中只出現 1 行；Q-1、Q-2 各 1 行。
- notify 前自檢：(a) Q-1–Q-3 三個 `#### Q-n：` 標題都有題目文字，下一行是「提問時間」→ PASS；(b) 回報區無範本佔位文字（範本佔位行已在 `7ccb8b29` 移除）→ PASS；(c) `### 互動紀錄` 只有一個 → PASS。

### 遭遇問題 / 偏差

- 階段 A 等待：背景 awk 輪詢（30 s 間隔）在 12:49:39 才以 exit 0 確認 Q-1、Q-2 已答，但 Worker 在輪詢回報前就直接讀檔（`sed`）看到兩行答覆，並於 12:49:26 寫入 Q-3 與互動紀錄（commit `c4ff6c5f`）。當時兩行答覆確實已存在（塔台 12:49:09 寫入），區段限定 awk 隨後也確認，結果無誤；但「以區段限定 awk 判斷已答」的步驟在該 commit 之前沒有完成，屬 Worker 流程偏差。階段 B 已改為等輪詢確認後才繼續。
- commit `c4ff6c5f` 除了 Q-3 與互動紀錄，還一併帶進了塔台寫在工作樹、尚未 commit 的 `- **塔台答覆 Q-1**` / `- **塔台答覆 Q-2**` 行（`git commit --only <本檔>` 以整個檔案為單位）；塔台的 `- **塔台答覆 Q-3**` 行同樣由本單收尾 commit 進版。內容未改動。
- 未讀產品程式碼、未改其他檔案、未跑 build / test、未 push；`src/styles/settings.css` 等其他 M 檔未動。回報區不含任何權杖值。

### 檔案異動

- `_ct-workorders/T0627-probe-ct572-all-fail-and-immediate-cancel.md`（僅本檔）

### Commit

- `7ccb8b29` chore: T0627 start, write Q-1/Q-2 for tower (ct)
- `005109bb` chore: T0627 Q-1/Q-2 channel marker (ask failed) (ct)
- `c4ff6c5f` chore: T0627 phase A answered, write Q-3 for tower (ct)
- `c09c3a88` chore: T0627 Q-3 late-drop channel marker (cancelled worker) (ct)
- 收尾 commit：本回報與最終狀態（以 `git log` 為準）
