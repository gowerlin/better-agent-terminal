---
schema_version: 1
schema_kind: workorder
id: T0628
title: "探針：CT v5.7.2 塔台 `--answer` 時才發現已取消（F-1 ④ b）＋對已答題 `--cancel-question` 回 `answered`"
type: verification
status: DONE
repo: better-agent-terminal
project: CT-v5.7.1/v5.7.2 驗收（BMad-Guide 請求）
priority: P2
sizing: S
created_at: "2026-10-18T12:39:02+0800"
started_at: "2026-10-18T13:17:24+08:00"
updated_at: "2026-10-18T13:21:14+08:00"
completed_at: "2026-10-18T13:21:14+08:00"
depends_on: [T0627]
related:
  - "CT v5.7.1 / v5.7.2 × BAT 0.7.0-pre.8 實機驗收第 4 張（T0625–T0629）"
affects_files:
  - _ct-workorders/T0628-probe-ct572-cancel-race-and-answered.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: guided-probe
memory_overrides:
  - "🔴 本單的受測對象是你自己的 ct-exec v5.7.2 提問流程（`ct-exec` § Questions For Tower ＋ control-tower `references/yolo-mode.md` § Worker 向塔台提問，特別是 3-A 第 5、6 步）。除了下方明寫的**刻意安排**，其餘一律照 skill 規則做。"
  - "🔴 所有題目都是刻意安排的受測提問：即使你判斷可以自行決定，也一定要向塔台提問（不得問使用者）。"
  - "🔴 不讀產品程式碼、不改任何其他檔案、不跑 build / test。`src/styles/settings.css` 的 M 不是你的變更。不 push。commit 用 `git commit --only <本檔>`。"
  - "🔴 題目內容只走 stdin；暫存檔放系統暫存目錄，**不得**寫進 repo。回報區不得出現任何權杖值。"
---

# T0628 — 探針：取消競態＋已答題取消

## 目標

分兩階段，Q-1 答完才開始 Q-2：

| 階段 | 題 | 刻意安排 | 預期 |
|---|---|---|---|
| A | Q-1（單題） | `--ask` 成功後，照常以 `bat_wait_question` 等 **60 秒**（塔台刻意不答，會看到 `pending`），然後對 Q-1 執行 `--cancel-question` | `cancelled worker` → 3-A 第 6 步：加標記、commit、送一次一般 `T0628 提問`；塔台的 `--answer` 會回 exit `9` `cancelled worker` 並改寫工單答覆行；你從工單答覆行收到 |
| B | Q-2（單題） | `--ask` 成功後**不呼叫 `bat_wait_question` / `--wait-answer`**；改用唯讀 MCP `bat_list_questions`（`status: all`）每 15 s 查一次 Q-2，看到 `answered` 後才對 Q-2 執行 `--cancel-question`（最多查 100 s；100 s 內沒看到 `answered` 就照 skill 正常等待並在回報區記下） | stdout `status: answered` → 3-A 第 5 步：再呼叫一次 wait 取得答覆，**不加標記、不送一般 `提問`** |

## Step 1 — 階段 A

1. 依 skill 規則把 Q-1 寫進 `### 待塔台決策`（阻塞：是），加 `tower_question: open`，commit。
   - Q-1：探針 Q-1（塔台答覆時已取消），選項 [A] 收到 / [B] 沒收到
2. `--ask`（正常參數）→ 記 id 與時間。
3. 以 `bat_wait_question` 等（每次 `timeoutMs` ≤ 30000），從 `--ask` 成功起算滿 60 秒後停止等待 → `--cancel-question <id>` → 記 exit code 與 stdout 全部 `status:` 行。
   - 若 60 秒內已收到 `answered`（塔台沒照探針安排）：照 skill 繼續，回報區記下，跳到階段 B。
4. 依 skill 處理（`cancelled worker` → 第 6 步），記下標記寫入時間、commit hash、一般 `提問` 送出時間。
5. 等 Q-1 的工單答覆行，收到後寫互動紀錄。

## Step 2 — 階段 B

1. 依 skill 規則接著寫 Q-2（阻塞：是），commit（`tower_question` 若已刪就重新加 `open`）。
   - Q-2：探針 Q-2（已答題再取消），選項 [A] 收到 / [B] 沒收到
2. `--ask`（正常參數）→ 記 id。
3. 照上表用 `bat_list_questions` 查 Q-2 狀態；看到 `answered` → `--cancel-question <id>` → 記 exit code 與 stdout 全部 `status:` 行。
4. 依 skill 處理（`answered` → 再呼叫一次 wait 取得答覆），記下 wait 回傳的 `status` / `choice`。
5. 兩題都答完 → 刪 `tower_question`，寫互動紀錄。

## Step 3 — 收尾

照 ct-exec 收尾（含 notify 前自檢）。回報區另寫 `### 驗收證據`：每題的路徑、指令參數（不含題目內容）、exit code、id、`status:` 行、答覆來源、收到時間；一般 `提問` 送出的次數；Q-1 標記行與 commit；Q-2 沒有標記的確認；notify 前自檢結果。完成後送 `T0628 完成`（yolo `--submit`）。

## 驗收條件

- Q-1：`cancelled worker` → 標記 → commit → 一般 `提問`；從工單答覆行收到；工單只有一行 Q-1 塔台答覆
- Q-2：`--cancel-question` 的 `status:` 行是 `answered`；從 BAT 取得答覆；沒有標記、沒有額外一般 `提問`、工單沒有 Q-2 塔台答覆行
- 回報區 `### 驗收證據` 完整；回報區沒有範本佔位文字

---

## 回報區

### 待塔台決策

#### Q-1：探針 Q-1（塔台答覆時已取消）
- 提問時間：2026-10-18T13:17:24+08:00
- 選項：[A] 收到 / [B] 沒收到 / [C] 其他：________
- Worker 建議：[A]，因為這是刻意安排的受測提問，選項本身不影響產品
- 影響範圍：僅本工單 Step 1（階段 A）
- 阻塞：是（Step 2 起要等答覆）
- **通道**：工單
- **塔台答覆 Q-1**：[A] 收到——該題有晚退回 `通道` 標記（列表 `cancelled worker`；塔台 `--answer` exit 9 `status: cancelled worker`），依規則改在工單答覆（2026-10-18T13:19:21+0800；塔台代決）

#### Q-2：探針 Q-2（已答題再取消）
- 提問時間：2026-10-18T13:20:08+08:00
- 選項：[A] 收到 / [B] 沒收到 / [C] 其他：________
- Worker 建議：[A]，因為這是刻意安排的受測提問，選項本身不影響產品
- 影響範圍：僅本工單 Step 2（階段 B）
- 阻塞：是（Step 3 起要等答覆）

### 互動紀錄

- [13:19] Q-1: 探針 Q-1（塔台答覆時已取消） → A（塔台）: [A] 收到（工單答覆行，塔台 `--answer` exit 9 `cancelled worker` 後改寫） → Action: 結束階段 A，進入階段 B
- [13:20] Q-2: 探針 Q-2（已答題再取消） → A（塔台，BAT 通道，choice 1）: [A] 收到——Q-2 經 BAT 通道送達（塔台代決） → Action: 兩題都已答，刪除 `tower_question`，進入收尾

### 完成狀態

DONE — 兩個階段都照 ct-exec v5.7.2 / yolo-mode § Worker 向塔台提問 3-A 第 5、6 步走完，驗收條件三項全部符合。

### 結果摘要

- 階段 A（Q-1）：`--ask` 成功 → `bat_wait_question` 兩次共 58 s 皆 `pending` → 從 `--ask` 起滿 60 s 執行 `--cancel-question` → `status: cancelled worker` → 3-A 第 6 步：加 `- **通道**：工單` 標記、commit、送一次一般 `T0628 提問` → 3-B 等工單答覆行 → 13:19:51 偵測到塔台的 Q-1 工單答覆行（塔台記錄 `--answer` exit 9 `status: cancelled worker`）。
- 階段 B（Q-2）：`--ask` 成功後不呼叫 wait，改以 `bat_list_questions`（`status: all`）查詢；第 2 次查詢看到 `answered` → `--cancel-question` → `status: answered` → 3-A 第 5 步：再呼叫一次 `bat_wait_question` 取得答覆（`choice: 1`），不加標記、不送一般 `提問`。

### 驗收證據

Landing check：C-0 PASS（frontmatter `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`，`REPO_ROOT` = `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）；C-1 PASS；C-3 not applicable（`affects_files` 只有本工單）；C-2 無 `branch` 欄位（實際 `main`）。`CT_HOME` 未設定（非 worktree）。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）。環境：`CT_MODE=yolo`、`CT_INTERACTIVE=0`、`worker_question_timeout` = 30（工單 frontmatter）。

**Q-1（階段 A）**

| 項目 | 內容 |
|---|---|
| 題目 commit | `f96bb5f5`（含 `tower_question: open`） |
| `--ask` 參數 | `--ask --source T0628 --target "$BAT_TOWER_TERMINAL_ID" --submit --expires-min 30 "T0628 提問"`，題目 JSON 走 Git Bash heredoc stdin |
| `--ask` 結果 | exit `0`，id `q-4b13b4f7-10eb636ec5d51470`，13:17:33（BAT `createdAt` 13:17:33.281），`notified: yes` |
| 等待 | `bat_wait_question` `timeoutMs` 30000 → `changed: false` / `pending`（`waitedMs` 30002）；`timeoutMs` 28000 → `changed: false` / `pending`（`waitedMs` 28000） |
| `--cancel-question` | 13:18:39（`--ask` 後 66 s），exit `0`，stdout `✓ Question cancelled: …`、`status: cancelled worker`（唯一一行 `status:`） |
| 標記 | `- **通道**：工單` 加在 Q-1 最後（13:18:44），commit `4ff1b53d`（只含標記行） |
| 一般 `提問` | 13:18:45 送出 `T0628 提問`（`--submit`），exit `0` |
| BAT 列表 | 13:20 查詢 Q-1 為 `status: cancelled` / `endReason: worker` |
| 答覆來源 | 工單答覆行（`### 待塔台決策` 區段內，3-B 區段限定 awk 比對，間隔 30 s），13:19:51 偵測到；塔台行內時間 13:19:21 |
| 答覆行數 | 工單只有一行 `- **塔台答覆 Q-1**` |

**Q-2（階段 B）**

| 項目 | 內容 |
|---|---|
| 題目 commit | `b13fba01`（`tower_question` 保持 `open`；此 commit 一併納入了塔台寫在工作樹、尚未 commit 的 Q-1 答覆行） |
| `--ask` 參數 | 同 Q-1（`--expires-min 30`，stdin JSON） |
| `--ask` 結果 | exit `0`，id `q-4b13b4f7-d9e7089cc36942ff`，13:20:08（BAT `createdAt` 13:20:08.602） |
| `bat_list_questions` 查詢 | 第 1 次約 13:20:10 → `pending`；第 2 次約 13:20:30（間隔約 15 s）→ `answered`（`answeredAt` 13:20:17.323，`choice: 1`）。期間未呼叫 `bat_wait_question` / `--wait-answer` |
| `--cancel-question` | 13:20:31，exit `0`，stdout `✓ Question already ended: …`、`status: answered`（唯一一行 `status:`） |
| 取得答覆 | 再呼叫一次 `bat_wait_question`（`timeoutMs` 30000）→ `changed: true`、`status: answered`、`choice: 1`、`waitedMs: 0` |
| 答覆來源 | BAT 通道 |
| 標記 | 無（Q-2 下沒有 `通道` 行） |
| 一般 `提問` | 無額外送出 |
| 工單答覆行 | 無 `塔台答覆 Q-2` 行 |

**通知次數**：`--ask` 自帶通知 2 則（Q-1、Q-2）；一般 `T0628 提問` 1 則（Q-1 晚退回）；收尾 `T0628 完成` 1 則。

**notify 前自檢**（ct-exec § Phase 4 step 4）：(a) `#### Q-1：`、`#### Q-2：` 皆帶題目文字且下一行為「提問時間」— PASS；(b) 回報區無範本佔位文字 — PASS；(c) `### 互動紀錄` 恰一個 — PASS。

### 變更檔案

- `_ct-workorders/T0628-probe-ct572-cancel-race-and-answered.md`（僅本檔；`src/styles/settings.css`、`_ct-workorders/T0632-site-v2-design-directions.md` 的 M 不是本單變更，未動）

### Commit

`f96bb5f5`（開工＋Q-1）、`4ff1b53d`（Q-1 標記）、`b13fba01`（Q-1 互動紀錄＋Q-2）、收尾 commit（本回報）。全部 `git commit --only <本檔>`，未 push。無產品變更。

### 偏差與備註

- 階段 A 的 `--cancel-question` 在 `--ask` 後 66 s 執行（兩次 wait 共 58 s，加上工具往返），略晚於 60 s，不影響探針結果。
- Q-2 輪詢間隔：第 1 次查詢緊接 `--ask`，第 2 次約 20 s 後（背景 sleep 13 s 加工具往返）；工單要求每 15 s，實際間隔略長，100 s 上限內已看到 `answered`。
- 未讀產品程式碼、未跑 build / test（工單排除）。題目內容只走 stdin，未寫暫存檔；回報區無權杖值。

### 遭遇問題

無。
