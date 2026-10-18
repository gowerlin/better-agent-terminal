---
schema_version: 1
schema_kind: workorder
id: T0627
title: "探針：CT v5.7.2 全部 `--ask` 失敗（F-1 ③）＋單題 `--ask` 後立刻取消（F-1 ④ a）"
type: verification
status: IN_PROGRESS
started_at: "2026-10-18T12:48:36+08:00"
updated_at: "2026-10-18T12:48:36+08:00"
tower_question: open
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

#### Q-2：探針 Q-2（全部失敗 2）
- 提問時間：2026-10-18T12:48:36+08:00
- 選項：[A] 收到 / [B] 沒收到 / [C] 其他：________
- Worker 建議：[A]，因為這是刻意安排的受測提問，收到即代表工單通道可用
- 影響範圍：本工單 Step 1（階段 A）與驗收證據
- 阻塞：是（Step 2 起要等答覆）
