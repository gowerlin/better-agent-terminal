---
schema_version: 1
schema_kind: workorder
id: T0614
title: "探針：CT v5.7.0 × 0.7.0-pre.8 claude Worker 經 BAT 通道問塔台（主流程 + BUG-154 目視）"
type: verification
status: DONE
repo: better-agent-terminal
project: PLAN-048
priority: P2
sizing: S
created_at: "2026-10-18T11:00:19+0800"
started_at: "2026-10-18T11:01:37+0800"
updated_at: "2026-10-18T11:04:35+0800"
completed_at: "2026-10-18T11:04:35+0800"
depends_on: [T0613]
related:
  - "PLAN-048（Worker 問塔台）；CT-T019（BMad-Guide CT v5.7.0）—— 本單是 CT v5.7.0 × BAT 0.7.0-pre.8 統一實機驗收的第 1 張（T0614–T0618，2026-10-18 與 BMad-Guide 塔台協商）"
  - "BUG-154（FIXED by T0613 `7bfe225c`）：答覆後 Worker 縮圖不得殘留 `✓` / `?`，使用者目視"
affects_files:
  - _ct-workorders/T0614-probe-ct570-claude-bat-question.md
  - docs/agent-guide/tower-questions.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: guided-probe
memory_overrides:
  - "🔴 本單的受測對象是**你自己的 ct-exec v5.7.0 提問流程**（`ct-exec` § Questions For Tower ＋ control-tower `references/yolo-mode.md` § Worker 向塔台提問）。照你 skill 的規則做，不要照舊工單（T0612）的寫法，也不要自己發明替代流程。"
  - "🔴 Step 2 的 Q-1 是刻意安排的受測提問：即使你判斷可以自行決定，也**一定要**依上述規則向塔台提問（不得問使用者、不得用 AskUserQuestion）。"
  - "🔴 不讀產品程式碼、不跑 build / test（只改一份文件）。`src/styles/settings.css` 的 M 不是你的變更，不碰。不 push。commit 用 `git commit --only <檔案>`。"
  - "🔴 題目 / 答覆內容只走 stdin（照 skill 規則）；需要暫存檔時用 Write 工具寫到系統暫存目錄或 scratchpad，**不得**寫進 repo，不要用含反斜線的 heredoc（L129）。回報區不得出現任何權杖值。"
---

# T0614 — 探針：claude Worker 經 BAT 通道問塔台

## 目標

在安裝版 BAT 0.7.0-pre.8 上，由真的 claude ct-exec Worker 跑一次 CT v5.7.0「Worker 向塔台提問」的 BAT 通道主流程，
並產生一個真的產品 commit，用來驗收收尾順序。使用者同時目視 Worker 縮圖（BUG-154）。

## Step 1 — 讀文件

讀 `docs/agent-guide/tower-questions.md` 的 `## 驗證清單` 節（只讀這份文件）。

## Step 2 — 受測提問 Q-1

要在該文件記下本次實機驗收，但位置有兩種做法，請依 skill 規則向塔台提問（Q-1，阻塞：是）：

- [A] 在 `## 驗證清單` 節末尾新增一條 `- 實機（CT v5.7.0 × 安裝版 0.7.0-pre.8，2026-10-18）：…` 項目
- [B] 在 `## 驗證清單` 之後新增 `## 實機驗收紀錄` 節，以表格記錄

Worker 建議由你自己寫。收到答覆後：

1. 記下等答覆用的是哪個工具（MCP `bat_wait_question` 或 `--wait-answer`）、呼叫次數、最後的 `status` / `choice`。
2. **停 60 秒**再進 Step 3（讓使用者看答覆後的縮圖），停頓的開始 / 結束時間記入互動紀錄。

## Step 3 — 產品變更

依答覆在文件寫入**一條** claude 的實機紀錄（只寫你這張工單親眼看到的事實：`--ask` exit 0、使用的等待工具、收到 `answered`；
縮圖由使用者目視、結果由塔台另行記錄，這裡不寫縮圖結論）。T0615（codex）稍後會在同一處補 codex 那一條，所以內容只寫 claude。

## Step 4 — 收尾

照 ct-exec 收尾（非隔離工單的 Phase 4 順序）。回報區除了一般欄位，另外寫 `### 驗收證據`，逐項列：

| 項目 | 要記的證據 |
|---|---|
| 雙寫 | 寫題目並 commit 的 commit hash（`tower_question: open` 已在其中）、`--ask` 的送出時間；兩者先後 |
| `--ask` | 實際執行的指令列（**只寫參數**，題目內容不在命令列；寫出 stdin 從哪裡來）、exit code、`question:` id、`--expires-min` 值與你取得 `worker_question_timeout` 的來源 |
| `--ask` 的 JSON | `question` 是否以 `Q-1：` 開頭、`options` 數、`blocking` 值（不必貼全文） |
| 等待 | 工具、呼叫次數、最長兩次呼叫的間隔、最終 `status` / `choice` |
| 互動紀錄 | 是否寫了 `A（塔台，BAT 通道，choice <n>）`；`tower_question` 何時刪除 |
| 收尾順序 | 產品 commit hash → 回報區 → 最終 metadata → 工單 commit hash → notify；notify 前 `git status --short` 只剩 `src/styles/settings.css` |

完成後照常送 `T0614 完成`（yolo `--submit`）。

## 驗收條件

- Q-1 經 BAT 通道問、經 BAT 通道收到答覆，工單內沒有塔台寫的 `塔台答覆 Q-1` 行
- 文件有一條 claude 實機紀錄，產品 commit 與工單 commit 分開
- 回報區 `### 驗收證據` 完整

---

## 回報區

### 待塔台決策

#### Q-1：本次實機驗收紀錄要寫在 `docs/agent-guide/tower-questions.md` 的哪個位置？
- 提問時間：2026-10-18T11:01:46+0800
- 選項：[A] 在 `## 驗證清單` 節末尾新增一條 `- 實機（CT v5.7.0 × 安裝版 0.7.0-pre.8，2026-10-18）：…` 項目 / [B] 在 `## 驗證清單` 之後新增 `## 實機驗收紀錄` 節，以表格記錄 / [C] 其他：________
- Worker 建議：[A]，因為 `## 驗證清單` 現有內容全是條列項目（單元測試、e2e、回歸），實機驗收也是驗證證據的一種，接在同節最後最一致；T0615 只需在同一條下補 codex 一句或再加一條，不必另開新節與表頭；[B] 的表格在只有 claude / codex 兩列時效益有限，且多一個 `##` 標題要維護。
- 影響範圍：`docs/agent-guide/tower-questions.md`（Step 3 寫入位置與格式）；T0615 的補寫位置
- 阻塞：是（Step 3 起要等答覆）

### 完成狀態

DONE — Q-1 經 BAT 通道（3-A）提問並收到 `answered`（choice 1 = [A]）；文件新增一條 claude 實機紀錄；產品 commit 與工單 commit 分開。

### 登陸檢查

- 結果：PASS
- C-0：frontmatter `repo` = `better-agent-terminal`；`basename(REPO_ROOT)` = `better-agent-terminal` → PASS（`REPO_ROOT` = `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）
- C-1：工單位於 `REPO_ROOT/_ct-workorders/` → PASS
- C-3：可測項 `docs/agent-guide/tower-questions.md` 存在 → PASS（`_ct-workorders/` 項目排除）
- C-2：工單無 `branch` 欄位，不適用（目前 `main`）
- `CT_HOME` 未設定（非隔離工單）；`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）
- 環境：`CT_MODE=yolo`、`CT_INTERACTIVE=0`、`BAT_TOWER_TERMINAL_ID` / `BAT_REMOTE_PORT` / `BAT_REMOTE_TOKEN` 皆在 Git Bash 可見

### 互動紀錄

- [11:02] Q-1: 實機驗收紀錄寫在 `tower-questions.md` 的哪個位置（[A] 驗證清單節末新增條目 / [B] 新增 `## 實機驗收紀錄` 表格節） → A（塔台，BAT 通道，choice 1）: [A] 在 `## 驗證清單` 節末尾新增一條實機項目——與該節現有條列格式一致，T0615 接著補 codex 一條即可（塔台代決） → Action: 在 `## 驗證清單` 末尾新增 `- 實機（CT v5.7.0 × 安裝版 0.7.0-pre.8，2026-10-18）：` 項目，其下一條 claude 子項（留給 T0615 補 codex 子項）
- 停頓（Step 2-2）：開始 `2026-10-18T11:02:38+08:00`，結束 `2026-10-18T11:03:38+08:00`（PowerShell `Start-Sleep -Seconds 60`）

### 執行摘要

1. Step 1：只讀 `docs/agent-guide/tower-questions.md` `## 驗證清單` 節。
2. Step 2：依 ct-exec v5.7.0 § Questions For Tower 與 `yolo-mode.md` § Worker 向塔台提問 3-A：寫 Q-1 → frontmatter `tower_question: open` → commit 工單 → `--ask` → MCP `bat_wait_question` → `answered`；停 60 秒。
3. Step 3：依答覆 [A] 在文件寫入一條 claude 實機紀錄（只含本單親眼看到的事實，無縮圖結論）。
4. Step 4：照 Phase 4 收尾順序。

### 修改檔案

- `docs/agent-guide/tower-questions.md`：`## 驗證清單` 節末新增「實機（CT v5.7.0 × 安裝版 0.7.0-pre.8，2026-10-18）」項目及 claude（T0614）子項（+2 行）
- `_ct-workorders/T0614-probe-ct570-claude-bat-question.md`：metadata 與回報區

### 驗證

- source / docs：PASS（文件新增內容已目視確認位於 `## 驗證清單` 節末，與既有條列格式一致）
- build / tests：不適用（工單明令不跑 build / test，只改一份文件）
- runtime smoke：PASS（BAT 通道實機：`--ask` exit 0 → `bat_wait_question` `answered`）

### 驗收證據

| 項目 | 證據 |
|---|---|
| 雙寫 | 題目與 `tower_question: open` 寫入工單後 commit `b30c17787ed9567991e663b6cb2f1d993cf5cbca`（commit 時間 `2026-10-18T11:02:01+08:00`）；`--ask` 送出時間 `2026-10-18T11:02:13+0800`（執行前取時）～ `11:02:14`（執行後取時）→ **commit 在前、`--ask` 在後**（相差約 12 s） |
| `--ask` | 指令（Git Bash）：`"${BAT_HELPER_NODE:-node}" "$BAT_HELPER_DIR/bat-notify.mjs" --ask --source T0614 --target "$BAT_TOWER_TERMINAL_ID" --submit --expires-min 30 "T0614 提問" < "$Q"`；stdin = 以 Write 工具寫在 scratchpad 的 JSON 檔（`…/scratchpad/t0614-q1.json`，不在 repo），以 `<` 重導入；題目內容不在命令列。exit **0**；stdout `✓ Notified 5f679fbf…: T0614 提問` / `question: q-4b13b4f7-6856d878ff817f8a` / `expires: 2026-10-18T03:32:13.846Z` / `notified: yes`。`--expires-min 30`，來源 = 工單 frontmatter `worker_question_timeout: 30`（取值順序第一個存在的值） |
| `--ask` 的 JSON | `question` 以 `Q-1：` 開頭：是；`options` 數：**2**（[A] / [B]，不列「其他」）；`detail` 含 Worker 建議 / 影響範圍 / 阻塞；`blocking: true` |
| 等待 | 工具：MCP `bat_wait_question`（`questionId` = `q-4b13b4f7-6856d878ff817f8a`、`timeoutMs` 45000）；呼叫次數 **1**；最長兩次呼叫間隔：不適用（只呼叫一次；`--ask` 結束到第一次呼叫 < 30 s，遠小於 120 s）；回傳 `changed: true`、`status: answered`、`answer.choice: 1`、`waitedMs: 12986`、`answeredAt` = `2026-10-18T03:02:32.746Z`（= 11:02:32 +0800）。未用 `--wait-answer`、未用 `--cancel-question` |
| 互動紀錄 | 已寫 `A（塔台，BAT 通道，choice 1）`；`tower_question` 於收尾時刪除（約 `2026-10-18T11:04+0800`，答覆後、寫回報區時一併刪除；等待與停頓期間未改工單）。工單內**沒有**塔台寫的 `塔台答覆 Q-1` 行 |
| 收尾順序 | 產品 commit `75256750183f0e8c670814107fdaff5934b38974`（`11:03:58`）→ 回報區（本節）→ 最終 metadata（`status: DONE`、`completed_at`）→ 工單 commit（hash 見下方「Commit」，因 commit 自身無法寫入自己的 hash）→ notify `T0614 完成`（`--submit`）；notify 前 `git status --short` 由收尾指令再確認，只剩 ` M src/styles/settings.css` |

### Commit

- 工單提問 commit：`b30c1778`（`chore: T0614 start, Q-1 for tower (tower_question: open)`）
- 產品 commit：`75256750`（`docs(tower-questions): record claude real-machine check for CT v5.7.0 BAT channel (T0614)`）
- 工單收尾 commit：本報告之後的下一個 commit（`git log -1 -- _ct-workorders/T0614-probe-ct570-claude-bat-question.md`）
- 皆以 `git commit --only <檔案>`；未 push；`src/styles/settings.css` 未碰

### 偏差 / 遭遇問題

- 無。Q-1 依 memory_overrides 必問（即使 Worker 可自行判斷 [A]）。
- 時間格式：`date` 輸出 `+0800`，PowerShell 輸出 `+08:00`，皆為系統取時，原樣記錄。

### 後續建議

- T0615（codex）在同一「實機」項目下補 codex 子項即可。
