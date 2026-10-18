---
schema_version: 1
schema_kind: workorder
id: T0616
title: "探針：CT v5.7.0 多題混合通道（BAT / `--ask` 失敗降級 / `--cancel-question`）"
type: verification
status: PENDING
repo: better-agent-terminal
project: PLAN-048
priority: P2
sizing: S
created_at: "2026-10-18T11:02:10+0800"
depends_on: [T0615]
related:
  - "PLAN-048 / CT-T019：CT v5.7.0 × BAT 0.7.0-pre.8 統一實機驗收第 3 張（T0614–T0618）"
affects_files:
  - _ct-workorders/T0616-probe-ct570-mixed-channel-fallback.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: guided-probe
memory_overrides:
  - "🔴 本單的受測對象是你自己的 ct-exec v5.7.0 提問流程（`ct-exec` § Questions For Tower ＋ control-tower `references/yolo-mode.md` § Worker 向塔台提問）。除了下方明寫的兩處**刻意製造的錯誤**（Q-2、Q-3），其餘一律照 skill 規則做。"
  - "🔴 三題都是刻意安排的受測提問：即使你判斷可以自行決定，也一定要向塔台提問（不得問使用者）。"
  - "🔴 不讀產品程式碼、不改任何其他檔案、不跑 build / test。`src/styles/settings.css` 的 M 不是你的變更。不 push。commit 用 `git commit --only <本檔>`。"
  - "🔴 題目內容只走 stdin；暫存檔放系統暫存目錄，**不得**寫進 repo。回報區不得出現任何權杖值。"
---

# T0616 — 探針：多題混合通道

## 目標

一次問三題，三題各走不同路徑，驗證 Worker 的降級與塔台以 `Q-n：` 對應：

| 題 | 路徑 | 刻意製造的錯誤 | 預期 |
|---|---|---|---|
| Q-1 | BAT 通道 | 無 | 塔台 `--answer`，Worker 從 BAT 收到 |
| Q-2 | `--ask` 失敗 → 工單往返 | 送 `--ask` 時把 `--expires-min` 設成 **`999`**（超出 1–120，helper 以用法錯誤 exit `1`） | Worker 依 skill 降級：送一般 `T0616 提問`，等工單 `塔台答覆 Q-2` 行 |
| Q-3 | BAT 通道 → Worker 自行取消 → 工單往返 | `--ask` 成功後**立刻**（不等任何答覆）對該 id 執行 `--cancel-question`，模擬「中途放棄 BAT 等待」 | 依 stdout 的 `status:` 行判斷（skill § 3-A 第 5 步）；`cancelled worker` → 剩餘時間等工單 `塔台答覆 Q-3` 行 |

## Step 1 — 寫題目

依 skill 規則把三題一起寫進 `### 待塔台決策`（Q-1 / Q-2 / Q-3，阻塞皆為是），加 `tower_question: open`，commit。題目：

- Q-1：探針 Q-1（BAT 通道），選項 [A] 收到 / [B] 沒收到
- Q-2：探針 Q-2（`--ask` 失敗降級），選項 [A] 收到 / [B] 沒收到
- Q-3：探針 Q-3（取消後降級），選項 [A] 收到 / [B] 沒收到

## Step 2 — 送出（照這個順序）

1. Q-3：`--ask`（正常參數）→ 記 id → 立刻 `--cancel-question <id>` → 記 exit code 與 stdout 全部的 `status:` 行。
2. Q-2：`--ask`，`--expires-min 999` → 記 exit code 與 stderr 第一行。
3. Q-1：`--ask`（正常參數）→ 記 id。
4. 依 skill 判斷要不要、以及送幾次一般 `T0616 提問`（Q-2 / Q-3 都改走工單往返時，規則是只送一次）。記下實際送了幾次、在哪一步送的。

## Step 3 — 等三題的答覆

依 skill 規則同時等：Q-1 走 BAT 等待（兩次呼叫間隔不得超過 120 s），Q-2 / Q-3 讀工單答覆行（只在 `### 待塔台決策` 區段內比對，間隔 ≥ 30 s）。
三題都答完 → 刪 `tower_question`，逐題寫互動紀錄。

## Step 4 — 收尾

照 ct-exec 收尾。回報區另寫 `### 驗收證據`：每題的路徑、指令參數（不含題目內容）、exit code、id、`status:` 行、答覆來源（BAT / 工單）、
收到時間；一般 `提問` 通知送出的次數；三題的互動紀錄寫法。完成後送 `T0616 完成`（yolo `--submit`）。

## 驗收條件

- Q-1 從 BAT 收到；Q-2 / Q-3 從工單答覆行收到；三題都收到
- `--ask` 失敗後沒有留下塔台看不到的 BAT 題目；一般 `提問` 只送一次
- 回報區 `### 驗收證據` 完整

---

## 回報區

（Worker 填寫）
