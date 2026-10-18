---
schema_version: 1
schema_kind: workorder
id: T0625
title: "探針：CT v5.7.2 多題 `--ask` 刻意延遲（F-1 ①：第一則通知早於後面題目登記）"
type: verification
status: PENDING
repo: better-agent-terminal
project: CT-v5.7.1/v5.7.2 驗收（BMad-Guide 請求）
priority: P2
sizing: S
created_at: "2026-10-18T12:39:02+0800"
depends_on: []
related:
  - "CT v5.7.1 / v5.7.2 × BAT 0.7.0-pre.8 實機驗收第 1 張（T0625–T0629）；規格 BMad-Guide T0170 / T0171、CT `references/yolo-mode.md` § Worker 向塔台提問"
affects_files:
  - _ct-workorders/T0625-probe-ct572-delayed-multi-ask.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: guided-probe
memory_overrides:
  - "🔴 本單的受測對象是你自己的 ct-exec v5.7.2 提問流程（`ct-exec` § Questions For Tower ＋ control-tower `references/yolo-mode.md` § Worker 向塔台提問）。除了下方明寫的**刻意延遲**，其餘一律照 skill 規則做。"
  - "🔴 三題都是刻意安排的受測提問：即使你判斷可以自行決定，也一定要向塔台提問（不得問使用者）。"
  - "🔴 不讀產品程式碼、不改任何其他檔案、不跑 build / test。`src/styles/settings.css` 的 M 不是你的變更。不 push。commit 用 `git commit --only <本檔>`。"
  - "🔴 題目內容只走 stdin；暫存檔放系統暫存目錄，**不得**寫進 repo。回報區不得出現任何權杖值。"
---

# T0625 — 探針：多題 `--ask` 刻意延遲

## 目標

驗證 v5.7.1 F-1「塔台等齊」：三題都走 BAT 通道，但 Q-1 送出後刻意停 60 秒才送 Q-2、Q-3，讓塔台在 Q-2 / Q-3 還沒登記到 BAT 時就處理到第一則通知。預期塔台只答 Q-1，不在工單替 Q-2 / Q-3 寫答覆行，之後收到 Q-2 / Q-3 自己的通知時才以 BAT 答覆。

## Step 1 — 寫題目

依 skill 規則把三題一起寫進 `### 待塔台決策`（阻塞皆為是），加 `tower_question: open`，commit。題目：

- Q-1：探針 Q-1（先送），選項 [A] 收到 / [B] 沒收到
- Q-2：探針 Q-2（延遲後送），選項 [A] 收到 / [B] 沒收到
- Q-3：探針 Q-3（延遲後送），選項 [A] 收到 / [B] 沒收到

## Step 2 — 送出（照這個順序）

1. Q-1：`--ask`（正常參數）→ 記 id 與時間。
2. **刻意延遲**：用平台的等待工具等 **60 秒**（這段期間不呼叫任何 wait；skill 規定第一題 `--ask` 成功到開始等待不得超過 120 s，60 s 在範圍內）。
3. Q-2、Q-3：依序 `--ask`（正常參數）→ 記 id 與時間。
4. 三題都成功 → 依 skill 不加標記、不送一般 `提問`。記下實際送了幾則通知。

## Step 3 — 等三題的答覆

依 skill 3-A 同時等三題。🔴 三題輪流呼叫 `bat_wait_question` 時，每次 `timeoutMs` ≤ 30000，確保同一題兩次呼叫的間隔不超過 120 s。三題都答完 → 刪 `tower_question`，逐題寫互動紀錄。

## Step 4 — 收尾

照 ct-exec 收尾（含 v5.7.1 notify 前自檢）。回報區另寫 `### 驗收證據`：每題的 `--ask` 時間、id、exit code、答覆來源（BAT / 工單）、`answeredAt`、收到時間；送出的通知則數；工單內是否出現任何塔台答覆行（預期 0）；notify 前自檢 (a)(b)(c) 的結果。完成後送 `T0625 完成`（yolo `--submit`）。

## 驗收條件

- 三題都從 BAT 收到；工單內沒有任何 `塔台答覆 Q-n` 行
- Q-1 與 Q-2 的 `--ask` 間隔 ≥ 60 s；三題都沒有 `expired`
- 回報區 `### 驗收證據` 完整；回報區沒有範本佔位文字

---

## 回報區

（Worker 填寫）
