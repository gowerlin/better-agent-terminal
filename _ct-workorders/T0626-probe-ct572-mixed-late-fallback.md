---
schema_version: 1
schema_kind: workorder
id: T0626
title: "探針：CT v5.7.2 多題混合通道＋等待中取消的晚退回標記（F-1 ② ／ 第 6 步）"
type: verification
status: PENDING
repo: better-agent-terminal
project: CT-v5.7.1/v5.7.2 驗收（BMad-Guide 請求）
priority: P2
sizing: S
created_at: "2026-10-18T12:39:02+0800"
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

（Worker 填寫）
