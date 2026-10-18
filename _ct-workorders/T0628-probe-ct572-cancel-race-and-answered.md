---
schema_version: 1
schema_kind: workorder
id: T0628
title: "探針：CT v5.7.2 塔台 `--answer` 時才發現已取消（F-1 ④ b）＋對已答題 `--cancel-question` 回 `answered`"
type: verification
status: IN_PROGRESS
repo: better-agent-terminal
project: CT-v5.7.1/v5.7.2 驗收（BMad-Guide 請求）
priority: P2
sizing: S
created_at: "2026-10-18T12:39:02+0800"
started_at: "2026-10-18T13:17:24+08:00"
updated_at: "2026-10-18T13:20:08+08:00"
tower_question: open
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
