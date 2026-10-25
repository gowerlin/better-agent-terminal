---
schema_version: 1
schema_kind: workorder
id: T0615
title: "探針：CT v5.7.0 × 0.7.0-pre.8 codex Worker 經 BAT 通道問塔台（主流程 + BUG-154 目視）"
type: verification
status: DONE
started_at: "2026-10-18T11:06:00+08:00"
updated_at: "2026-10-18T11:09:00+08:00"
repo: better-agent-terminal
project: PLAN-048
priority: P2
sizing: S
created_at: "2026-10-18T11:02:10+0800"
completed_at: "2026-10-18T11:09:00+08:00"
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
### 驗收摘要

完成 T0615 codex Worker 的 BAT 問塔台實機流程。Q-1 由 BAT 通道送出並收到塔台選項 [A]；依答覆在 `docs/agent-guide/tower-questions.md` 新增獨立 codex 實機紀錄。題目先寫入工單並提交，產品文件與工單分開提交。沒有修改產品程式碼，也沒有執行 build / test（依工單要求）。

### 變更檔案

- `docs/agent-guide/tower-questions.md`：新增 T0615 codex 實機紀錄。
- `_ct-workorders/T0615-probe-ct570-codex-bat-question.md`：記錄提問、答覆、驗收證據與完成狀態。

### 驗收證據

- PASS — Landing check：C-0 expected repo `better-agent-terminal` = actual repo basename `better-agent-terminal`；`REPO_ROOT=D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`。C-1 工單位於 repo 下；C-3 `docs/agent-guide/tower-questions.md` 存在；C-2 branch `main` 符合 `workdir: main repo`。BAT workspace：`cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`。
- PASS — 問題雙寫：Q-1 和 `tower_question: open` 先提交於工單 commit `4bdf08125d50c81811f88444cb6fa53bcbe54ff2`，之後 `--ask` 約於 2026-10-18 11:05:58 +08:00 成功送出（`expires` 時間回推；兩者先後符合規則）。
- PASS — `--ask`：使用 `node` 與 `$BAT_HELPER_DIR\bat-notify.mjs`，參數為 `--ask --source T0615 --target "$BAT_TOWER_TERMINAL_ID" --submit --expires-min 30 "T0615 提問"`；JSON 從系統暫存檔 stdin 重導入，未放入 argv 或 repo。exit code `0`；question id `q-4b13b4f7-2cbec99d3b312d8d`；`--expires-min 30` 取工單 frontmatter `worker_question_timeout: 30`。
- PASS — `--ask` JSON：`question` 以 `Q-1：` 開頭；2 個選項；`blocking: true`。
- PASS — 等待答覆：MCP `bat_wait_question`，第 1 次呼叫即收到結果（timeout 45000 ms）；status `answered`、choice `1`、`waitedMs: 3307`。僅一次呼叫，故兩次呼叫間隔不適用；結果早於 timeout 回覆。工單沒有塔台寫入的 `塔台答覆 Q-1` 行。
- PASS — 依工單停留約 60 秒：開始約 11:06:14、結束 11:07:14（+08:00），其後才進行文件變更。
- PASS — 平台：`codex-cli 0.163.0`。BAT MCP `bat_whoami` 回報 `role=worker`、`workorder=T0615`、`yolo=true`；工具回應未提供 `agent` 欄位。
- PASS — 關閉順序：產品 commit `5b58c7486c6a8b7796920c5eb8738f870b011893` → 完成回報 → 最終 metadata → 本工單 commit（hash 見下方）→ notify。移除 `tower_question` 時已取得 BAT 答覆並寫入 `A（塔台，BAT 通道，choice 1）` 互動紀錄。Notify 前 `git status --short` 僅剩既存 ` M src/styles/settings.css`。

### 互動紀錄

- [11:05] Q-1：codex 那一條要怎麼寫？ → A（塔台，BAT 通道，choice 1）：與 claude 那條並列，另起一條 codex 項目；各自記錄親眼看到的事實，較好對照 → Action：在驗證清單新增獨立 codex 項目。
- [11:06–11:07] 依工單要求於答覆後停留 60 秒，再開始文件變更。

### Commit 狀態

- 產品文件：`5b58c7486c6a8b7796920c5eb8738f870b011893` — `docs: record T0615 codex tower question probe`
- 工單：本次 closeout commit（包含最終狀態與報告）。
- 未 push。

### 偏差 / 後續

無偏差，無阻塞；未修改 `src/styles/settings.css`。

