---
schema_version: 1
schema_kind: workorder
id: T0615
title: "探針：CT v5.7.0 × 0.7.0-pre.8 codex Worker 經 BAT 通道問塔台（主流程 + BUG-154 目視）"
type: verification
status: IN_PROGRESS
started_at: "2026-10-18T11:06:00+08:00"
updated_at: "2026-10-18T11:06:00+08:00"
tower_question: open
repo: better-agent-terminal
project: PLAN-048
priority: P2
sizing: S
created_at: "2026-10-18T11:02:10+0800"
depends_on: [T0614]
related:
  - "PLAN-048 / CT-T019：CT v5.7.0 × BAT 0.7.0-pre.8 統一實機驗收第 2 張（T0614–T0618）"
  - "BUG-154：答覆後 Worker 縮圖不得殘留 `✓` / `?`，使用者目視"
  - "T0614：claude 版同一流程；本單在 T0614 寫的同一處補 codex 那一條"
affects_files:
  - _ct-workorders/T0615-probe-ct570-codex-bat-question.md
  - docs/agent-guide/tower-questions.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: guided-probe
memory_overrides:
  - "🔴 本單由 **codex** Worker 執行。受測對象是你自己的 ct-exec v5.7.0 提問流程（`ct-exec` § Questions For Tower ＋ control-tower `references/yolo-mode.md` § Worker 向塔台提問）。照 skill 規則做，不要自己發明替代流程。"
  - "🔴 Step 2 的 Q-1 是刻意安排的受測提問：即使你判斷可以自行決定，也**一定要**依上述規則向塔台提問（不得問使用者）。"
  - "🔴 不讀產品程式碼、不跑 build / test（只改一份文件）。`src/styles/settings.css` 的 M 不是你的變更，不碰。不 push。commit 用 `git commit --only <檔案>`；commit 訊息含 `T0615`。"
  - "🔴 題目 / 答覆內容只走 stdin（照 skill 規則，Windows 用 pwsh 7 或 Git Bash，不用 Windows PowerShell 5.1）；暫存檔放系統暫存目錄，**不得**寫進 repo。回報區不得出現任何權杖值。"
---

# T0615 — 探針：codex Worker 經 BAT 通道問塔台

## 目標

與 T0614 相同的流程，改由 codex ct-exec Worker 執行（codex 分頁沒有 claude hooks，`blockedDetection: none`，
等塔台答覆的狀態只來自 BAT 問答紀錄）。使用者目視 Worker 縮圖（BUG-154）。

## Step 1 — 讀文件

讀 `docs/agent-guide/tower-questions.md` 的 `## 驗證清單` 節，找到 T0614 寫的 claude 實機紀錄（只讀這份文件）。

## Step 2 — 受測提問 Q-1

依 skill 規則向塔台提問（Q-1，阻塞：是）：codex 那一條要怎麼寫？

- [A] 與 claude 那條並列，另起一條 codex 項目
- [B] 併進 claude 那一條，改寫成「claude / codex」共用一條

Worker 建議由你自己寫。收到答覆後：

1. 記下等答覆用的工具（MCP `bat_wait_question` 或 `--wait-answer`）、呼叫次數、最後的 `status` / `choice`。
2. **停 60 秒**再進 Step 3（讓使用者看答覆後的縮圖），停頓的開始 / 結束時間記入互動紀錄。

## Step 3 — 產品變更

依答覆在文件寫入 codex 的實機紀錄（只寫你親眼看到的事實，不寫縮圖結論）。

## Step 4 — 收尾

照 ct-exec 收尾（非隔離工單的 Phase 4 順序）。回報區另寫 `### 驗收證據`，欄位同 T0614：

| 項目 | 要記的證據 |
|---|---|
| 雙寫 | 寫題目並 commit 的 commit hash（`tower_question: open` 已在其中）、`--ask` 的送出時間；兩者先後 |
| `--ask` | 實際執行的指令列（只寫參數；寫出 stdin 從哪裡來）、exit code、`question:` id、`--expires-min` 值與 `worker_question_timeout` 的來源 |
| `--ask` 的 JSON | `question` 是否以 `Q-1：` 開頭、`options` 數、`blocking` 值 |
| 等待 | 工具、呼叫次數、最長兩次呼叫的間隔、最終 `status` / `choice` |
| 互動紀錄 | 是否寫了 `A（塔台，BAT 通道，choice <n>）`；`tower_question` 何時刪除 |
| 收尾順序 | 產品 commit hash → 回報區 → 最終 metadata → 工單 commit hash → notify；notify 前 `git status --short` 只剩 `src/styles/settings.css` |
| 平台 | codex 版本（`codex --version`）、BAT MCP `bat_whoami` 的 `agent` / `role` |

完成後照常送 `T0615 完成`（yolo `--submit`）。

## 驗收條件

- Q-1 經 BAT 通道問、經 BAT 通道收到答覆，工單內沒有塔台寫的 `塔台答覆 Q-1` 行
- 文件有 codex 實機紀錄，產品 commit 與工單 commit 分開
- 回報區 `### 驗收證據` 完整

---

## 回報區

（Worker 填寫）

### 待塔台決策

#### Q-1

codex 那一條要怎麼寫？

- [A] 與 claude 那條並列，另起一條 codex 項目
- [B] 併進 claude 那一條，改寫成「claude / codex」共用一條

Worker 建議：[A] 另起 codex 項目，能清楚保留本次 codex 實機紀錄與既有 claude 紀錄的區別。
影響：決定 Step 3 文件新增項目的編排方式。阻塞後續步驟：是。

### 互動紀錄

- [11:06] Landing check PASS：repo expected `better-agent-terminal` = actual `better-agent-terminal`（`REPO_ROOT=D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）；C-1 工單在 repo 下；C-3 `docs/agent-guide/tower-questions.md` 存在；C-2 branch `main` 符合工單 `workdir: main repo`。BAT_WORKSPACE_ID=`cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`。保留既存 `src/styles/settings.css` 修改。
