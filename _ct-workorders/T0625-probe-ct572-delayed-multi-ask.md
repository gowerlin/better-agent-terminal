---
schema_version: 1
schema_kind: workorder
id: T0625
title: "探針：CT v5.7.2 多題 `--ask` 刻意延遲（F-1 ①：第一則通知早於後面題目登記）"
type: verification
status: DONE
repo: better-agent-terminal
project: CT-v5.7.1/v5.7.2 驗收（BMad-Guide 請求）
priority: P2
sizing: S
created_at: "2026-10-18T12:39:02+0800"
started_at: "2026-10-18T12:41:11+08:00"
updated_at: "2026-10-18T12:43:16+08:00"
completed_at: "2026-10-18T12:43:16+08:00"
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

### 待塔台決策

#### Q-1：探針 Q-1（先送）
- 提問時間：2026-10-18T12:41:11+08:00
- 選項：[A] 收到 / [B] 沒收到 / [C] 其他：________
- Worker 建議：[A]，因為這是受測探針題，收到即可
- 影響範圍：T0625 Step 3 驗收證據
- 阻塞：是（Step 3 起要等答覆）

#### Q-2：探針 Q-2（延遲後送）
- 提問時間：2026-10-18T12:41:11+08:00
- 選項：[A] 收到 / [B] 沒收到 / [C] 其他：________
- Worker 建議：[A]，因為這是受測探針題，收到即可
- 影響範圍：T0625 Step 3 驗收證據
- 阻塞：是（Step 3 起要等答覆）

#### Q-3：探針 Q-3（延遲後送）
- 提問時間：2026-10-18T12:41:11+08:00
- 選項：[A] 收到 / [B] 沒收到 / [C] 其他：________
- Worker 建議：[A]，因為這是受測探針題，收到即可
- 影響範圍：T0625 Step 3 驗收證據
- 阻塞：是（Step 3 起要等答覆）

### 完成狀態

DONE — 三題全部經 BAT 通道 `answered`；工單內 0 條塔台答覆行；Q-1 → Q-2 `--ask` 間隔 70 s；無 `expired`。

### 落點檢查

- 結果：PASS
- C-0：frontmatter `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal` → PASS（`REPO_ROOT` = `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）
- C-1：工單位於 `REPO_ROOT/_ct-workorders/` 下 → PASS
- C-3：`affects_files` 只有 `_ct-workorders/` 下的本檔 → not applicable
- C-2：工單無 `branch` 欄位（目前分支 `main`）
- `CT_HOME` 未設（非 worktree 派工）；`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）
- 環境：`CT_MODE=yolo`、`CT_INTERACTIVE=0`、`worker_question_timeout` = 30（工單 frontmatter）

### 執行摘要

1. Step 1：三題寫入 `### 待塔台決策`、加 `tower_question: open`、`started_at`、`status: IN_PROGRESS`，commit `726d0556`（12:41:11）後才送 `--ask`。
2. Step 2：Q-1 `--ask`（12:41:16 發出）→ PowerShell `Start-Sleep -Seconds 61`（12:41:21 → 12:42:22，期間未呼叫任何 wait）→ Q-2、Q-3 依序 `--ask`（12:42:26）。題目 JSON 以 Git Bash heredoc 走 stdin，未落地任何暫存檔，未放 argv。
3. Step 3：三題 `--ask` 都成功 → 不加 `通道` 標記、不送一般 `提問`。三題同時各呼叫一次 MCP `bat_wait_question`（`timeoutMs` = 25000），三次都直接回 `answered`，無需再輪詢。Q-1 `--ask` 成功（12:41:17）到第一次 wait（約 12:42:32）約 75 s，在 120 s 內。
4. 三題答完 → 刪 frontmatter `tower_question`，寫互動紀錄。
5. 未讀產品程式碼、未改其他檔、未跑 build / test、未 push。

### 驗收證據

| 題 | `--ask` 發出 → 結束 | 問題 id | exit | 答覆來源 | `answeredAt`（ms → +08:00） | Worker 收到 |
|---|---|---|---|---|---|---|
| Q-1 | 12:41:16 → 12:41:17 | `q-4b13b4f7-8683064f99f12a78` | 0 | BAT（choice 1） | `1792298485774` → 2026-10-18T12:41:25.774+08:00 | 約 12:42:32（第一次 wait，`waitedMs: 0`） |
| Q-2 | 12:42:26 → 12:42:26 | `q-4b13b4f7-d4f562f1a1328fd2` | 0 | BAT（choice 1） | `1792298555588` → 2026-10-18T12:42:35.588+08:00 | 12:42:35（第一次 wait，`waitedMs: 3165`） |
| Q-3 | 12:42:26 → 12:42:26 | `q-4b13b4f7-02ffdab6d232cd2f` | 0 | BAT（choice 1） | `1792298555664` → 2026-10-18T12:42:35.664+08:00 | 12:42:35（第一次 wait，`waitedMs: 2760`） |

- 時間取自系統（`date`）；`answeredAt` 由 node 換算；「收到」= wait 呼叫開始時間 + `waitedMs`，wait 呼叫開始時間未單獨取時鐘，由 Q-2 的 `answeredAt − waitedMs` 推得約 12:42:32，之後 12:42:38 取系統時間確認。
- Q-1 → Q-2 `--ask` 間隔：12:41:16 → 12:42:26 = 70 s（≥ 60 s）。
- 塔台在 12:41:25 已答 Q-1（Q-2 / Q-3 此時尚未登記到 BAT），Q-2 / Q-3 在登記後約 9 s 才答 → 符合 F-1「只答已登記的題、其餘等各自通知」的預期。
- 三題 `status` 皆 `answered`，沒有 `expired` / `cancelled` / `lost`。
- 送出的通知：3 則（每題 `--ask` 各 1 則 `T0625 提問`，`notified: yes`）；一般 `T0625 提問` 0 則。收尾另送 1 則 `T0625 完成`。
- 工單內塔台答覆行：0（等答覆後 `git status` 顯示本檔無塔台修改；限定區段的 awk 比對 Q-1 / Q-2 / Q-3 皆 exit 1；全檔 `^- \*\*塔台答覆 Q-[0-9]+\*\*` 計數 0）。
- notify 前自檢：(a) 三個 `#### Q-n：` 標題都帶題目文字且下一行為「提問時間」→ PASS；(b) 回報區無範本佔位文字 → PASS；(c) `### 互動紀錄` 恰一個 → PASS（commit 前以 grep 確認，見下方 commit 紀錄）。

### 互動紀錄

- [12:41] Q-1: 探針 Q-1（先送） → A（塔台，BAT 通道，choice 1）: [A] 收到——Q-1 經 BAT 通道送達（塔台代決） → Action: 記入驗收證據
- [12:42] Q-2: 探針 Q-2（延遲後送） → A（塔台，BAT 通道，choice 1）: [A] 收到——Q-2 經 BAT 通道送達（塔台代決） → Action: 記入驗收證據
- [12:42] Q-3: 探針 Q-3（延遲後送） → A（塔台，BAT 通道，choice 1）: [A] 收到——Q-3 經 BAT 通道送達（塔台代決） → Action: 記入驗收證據

### 變更檔案

- `_ct-workorders/T0625-probe-ct572-delayed-multi-ask.md`（只有本檔）

### Commit

- `726d0556` — 開工、寫入 Q-1..Q-3、`tower_question: open`
- 收尾 commit — 回報區與最終 metadata（`git commit --only` 本檔；hash 見 `git log`）
- 未 push；`README.md`、`T0624`、`src/styles/settings.css`、`site/` 的既有變更未觸碰

### 遭遇問題

無。

### 偏差

- Step 3 原規劃「三題輪流呼叫」；實際三題各一次 wait 即全部 `answered`，沒有第二輪。
