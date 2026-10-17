---
schema_version: 1
schema_kind: workorder
id: CT-T019
title: "【受派】CT 接 BAT「Worker 問塔台」結構化通道：`bat-notify --ask` / `bat_wait_question` / `bat_list_questions` / `bat-terminal --answer`、`blockedReason: tower`（PLAN-048 / D155 / D156）"
type: implementation
status: TODO
repo: BMad-Guide
project: PLAN-048
priority: P2
sizing: M
created_at: "2026-10-18T07:16:57+0800"
depends_on:
  - "T0607（主行程 store / channel，`00bdcaeb`）、T0608（helper / MCP，經 T0610 合入 `4e5f5e7f`）、T0611（e2e / 文件收尾，`c271e852`）"
  - "BAT 含上述的版本（下一個預覽版，預計 `0.7.0-pre.7`，尚未發佈；發佈後告知確切版號）"
related:
  - PLAN-048
  - D155
  - D156
  - BUG-153
  - CT-T017
interaction:
  mode_hint: ask
  interactive: true
  intervention_type: delegate
renew_count: 0
---

# CT-T019 — Worker 問塔台（結構化通道）

## 跨專案協調

- **協調類型**：DELEGATE
- **來源專案**：better-agent-terminal（PLAN-048，需求來自 BMad-Guide D036）
- **目標專案**：BMad-Control-Tower（由 **BMad-Guide 塔台**派發執行，本檔為需求規格）
- **BAT 介面權威**：BAT repo `CLAUDE.md`「Worker 問塔台（PLAN-048 / T0607）」節、`docs/agent-guide/tower-questions.md`（完整契約、helper / MCP、限制常數、結束原因、版本判定）、`docs/agent-guide/blocked-state.md`（`tower` reason 與 `none` 新定義）。本檔與權威不一致時以權威為準，差異請在完成回覆列出。
- **BAT 最低版本**：含 T0607 / T0608 / T0611 的版本（下一個預覽版，發佈後告知確切版號）。

## 背景

CT v5.5.0 的 yolo Worker 提問走工單檔往返（寫 `### 待塔台決策` → notify `T#### 提問` → 原地等；塔台寫回答覆）。BAT 新增有範圍限制的問答通道：問題只存在 BAT 主行程記憶體（不落地、日誌不記內容），Worker 以唯讀 MCP 長輪詢等答覆，塔台以唯讀 MCP 讀題、以 helper 答覆。**工單的問答紀錄仍由 CT 照常寫**（ct-exec 回報區「互動紀錄」），BAT 不負責保存（D155 澄清）。

## BAT 介面摘要

### Worker 提問（helper；內容只走 stdin）

```
"${BAT_HELPER_NODE:-node}" "$BAT_HELPER_DIR/bat-notify.mjs" --ask --source T#### --target "$BAT_TOWER_TERMINAL_ID" [--submit] [--expires-min <1-120>] "T#### 提問" < question.json
```

- stdin JSON：`{ "question": "…", "options"?: ["…"], "allowFreeText"?: true, "detail"?: "…", "blocking"?: true }`（UTF-8、≤ 64 KiB）。🔴 內容不得放 argv（helper 把 argv 寫進 bat-scripts.log）。Windows PowerShell 5.1 管線不是 UTF-8 會弄壞中文 → 用 pwsh 7 或 Git Bash heredoc。
- 一個指令完成「登記問題 + notify 塔台」；位置參數訊息照 CT 現行格式（`T#### 提問`，BAT 不解析、不加問題 id）。`--submit` 規則不變（只在 yolo）。
- stdout：`  question: <id>`、`  expires: <ISO>`、`  notified: yes`。exit `0` / `3` NOT_FOUND（塔台分頁不在）/ `10` TOO_MANY_QUESTIONS / `1` 其他（含 `UNSUPPORTED`、notify 失敗——此時 helper 已自動取消問題，不會留下塔台不知道的題目）。stderr 一行 `ask: <CODE>`。
- 建議 `--expires-min` = CT `worker_question_timeout`（預設 30、上限 120）。

### Worker 等答覆

- 主路徑：MCP `bat_wait_question { questionId, timeoutMs? }`（單次 ≤ 45 s；`changed: false` + `status: pending` = 逾時，再呼叫）。回傳 `status` ∈ `answered`（帶 `answer: { choice?, text }`）/ `pending` / `cancelled` / `expired` / `lost`，結束時帶 `endReason`。
- 備援：`bat-notify.mjs --wait-answer <id> [--timeout-ms ≤45000]`，stdout 一行 JSON，任何狀態都 exit 0（`3` / `4` / `1` 為錯誤）。
- 🔴 `blocking` 問題 120 s 沒有 poll（wait / ask）→ `expired` / `not-polled`：Worker 要持續呼叫 wait。
- `lost` = BAT 重開過（問題已消失）→ 走 CT 現行工單檔往返或 BLOCKED 備援。

### Worker 取消

- `bat-notify.mjs --cancel-question <id>` → 🔴 **已結束（含 `lost`）也 exit 0**；看 stdout `  status:` 行，`cancelled worker` 才是本次取消（T0611 裁定）。

### 塔台讀題與答覆

- MCP `bat_list_questions { terminalId?, status?: pending|all }`：列出自己 Worker 的待答問題（含全文、`workorder`、`options`、`allowFreeText`、`detail`、`expiresAt`）。
- 答覆：`"${BAT_HELPER_NODE:-node}" "$BAT_HELPER_DIR/bat-terminal.mjs" --answer <id> --notify-id "$BAT_TERMINAL_ID" [--choice <n>] < answer.txt`（stdin 文字可空，但 `--choice` 與文字至少一個）。exit `0` / `3`（含 `answer: LOST`）/ `4` NOT_OWNER / `9` CLOSED（已答 / 取消 / 過期，第一個答覆生效）/ `1`。BAT 不對 Worker 分頁寫任何東西。
- BAT MCP 全部唯讀；問答寫入沒有 MCP tool。

### 狀態

- Worker 有 blocking 待答問題 → `bat_get_state` / `bat_wait` / `bat_list_terminals`：`state: blocked`、`blockedReason: tower`、`source: 'question'`；每個 state 回傳多 `pendingQuestions`（數字）。優先序：`exited` > hook 的 `permission` / `question` / `elicitation` > `tower` > `working` / `idle`。
- 🔴 **`blockedDetection: none` 的新定義**：「永遠不會回 hook 的三種 reason」（原為「永遠不會 `blocked`」）。codex Worker 也會回 `blocked` / `tower`。
- 使用者在 Worker 分頁輸入**不清除** `tower`。清除：答覆 / 取消 / 過期 / Worker 或塔台分頁結束 / Terminal Server recovery。
- 縮圖（BUG-153 / T0609）：等使用者 ⚠️、等塔台 `?`、已回報 `✓`；只有 `✓` 計入批次關閉。舊 CT 的 `T#### 提問`（結尾 `提問`）也會顯示 `?`。CT 不需改。

### 版本判定（CT 降級到工單檔往返）

| 端 | 判定 | 降級 |
|---|---|---|
| Worker 提問 | `--ask` exit ≠ 0：`Unknown option '--ask'`（舊 helper）或 `ask: UNSUPPORTED`（新 helper、舊 host） | 現行工單檔往返；helper 保證此時沒有留下問題 |
| Worker 等待 | `bat_wait_question` 不存在 / `UNSUPPORTED` → `--wait-answer`；`lost` / `cancelled` / `expired` → 現行備援 | 同左 |
| 塔台讀取 | `bat_list_questions` 不存在 / `UNSUPPORTED`，或 state 沒有 `pendingQuestions` 欄位 | 讀工單 `### 待塔台決策` |
| 塔台答覆 | `--answer` → `Unknown option` / `answer: UNSUPPORTED` | 寫工單答覆行 |

## 修改清單（建議，最終由 BMad-Guide 塔台 / 使用者決定）

1. `yolo-mode.md` § Worker 向塔台提問 › Worker 端：BAT 支援時改走 `--ask`（`--expires-min` = `worker_question_timeout`）→ `bat_wait_question` 迴圈（備援 `--wait-answer`）→ 答覆寫進回報區「互動紀錄」；`lost` / `cancelled` / `expired` / helper 失敗 → 現行工單檔往返或 BLOCKED；`worker_question_timeout = 0` 時不用 BAT 通道。是否保留 `### 待塔台決策` 作紀錄由 CT 決定。
2. § 塔台端：收到 `T#### 提問` → `bat_list_questions` → 代決邊界照舊 → `--answer`；決策日誌與 YOLO 歷程照舊；升級給使用者時問題仍 pending（注意 `expiresAt`）。
3. § 斷點 D：`blockedReason: tower` **不是**斷點 D（不告知「在等你回答」），而是「Worker 在等塔台答覆」→ 塔台查 `bat_list_questions` 並答覆；`none` 的判斷改為只排除 hook reason。
4. `auto-session.md` § BAT MCP 唯讀 tool：補 `bat_list_questions` / `bat_wait_question`；ct-exec `SKILL.md` § Questions For Tower 摘要同步。
5. 版本對照表：加 BAT 版號（發佈後告知）。

## 驗收

- 文件：helper 參數 / exit code、MCP tool、狀態值、版本判定與降級各在權威位置一份。
- 實機（BAT 含本功能的版本，會耗額度）：claude-cli Worker 與 codex Worker 各跑一次 yolo 提問 → 塔台以 `bat_list_questions` + `--answer` 代答 → Worker 收到後繼續；確認 codex 分頁 `blocked` / `tower` 可見、`bat_wait_question` 在 codex 60 s 內返回；舊 BAT 降級到工單檔往返。

---

## 轉交紀錄

- 2026-10-18T07:16:57+0800：BAT 塔台建立（第七十七 session），待轉交 BMad-Guide 塔台。
