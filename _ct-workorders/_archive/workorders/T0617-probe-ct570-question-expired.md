---
schema_version: 1
schema_kind: workorder
id: T0617
title: "探針：CT v5.7.0 BAT 題目逾時 `expired` → BLOCKED → Renew"
type: verification
status: DONE
repo: better-agent-terminal
project: PLAN-048
priority: P2
sizing: S
created_at: "2026-10-18T11:02:10+0800"
started_at: "2026-10-18T11:12:00+08:00"
completed_at: "2026-10-18T11:15:36+08:00"
updated_at: "2026-10-18T11:15:36+08:00"
depends_on: [T0616]
related:
  - "PLAN-048 / CT-T019：CT v5.7.0 × BAT 0.7.0-pre.8 統一實機驗收第 4 張（T0614–T0618）"
affects_files:
  - _ct-workorders/T0617-probe-ct570-question-expired.md
renew_count: 1
workdir: main repo
worker_question_timeout: 1
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: guided-probe
memory_overrides:
  - "🔴 本單的受測對象是你自己的 ct-exec v5.7.0 提問流程（`ct-exec` § Questions For Tower ＋ control-tower `references/yolo-mode.md` § Worker 向塔台提問 › § 備援）。照 skill 規則做，不要自己發明替代流程。"
  - "🔴 本單 `worker_question_timeout: 1` 是刻意設定；塔台**刻意不答** Q-1，讓題目逾時。照 skill 的 `expired` 規則收尾，不要延長等待、不要重送題目。"
  - "🔴 Q-1 是刻意安排的受測提問：一定要向塔台提問（不得問使用者）。"
  - "🔴 不讀產品程式碼、不改任何其他檔案、不跑 build / test。`src/styles/settings.css` 的 M 不是你的變更。不 push。commit 用 `git commit --only <本檔>`。題目內容只走 stdin，暫存檔不得寫進 repo；回報區不得出現權杖值。"
---

# T0617 — 探針：BAT 題目逾時

## 目標

驗證 BAT 題目 `expired` 時 Worker 走 § 備援（`BLOCKED` + commit + `需要協助`），以及塔台在 Renew 區段答覆、重派後 Worker 讀到 Renew 答覆完成。

## Step 1 — 受測提問 Q-1

依 skill 規則向塔台提問（Q-1，阻塞：是）：探針 Q-1（逾時），選項 [A] 收到 / [B] 沒收到。
`--expires-min` 依 skill 取生效的 `worker_question_timeout`（本單 frontmatter = 1）。

## Step 2 — 等待與逾時

依 skill 等待。預期約 1 分鐘後 BAT 回 `expired`（或你的總等待上限先到）。記下每次等待呼叫的時間、最後的 `status` / `endReason`，然後照 § 備援收尾：
回報區照常填、`### 待塔台決策` 原樣保留、`tower_question: open` 保留 → `BLOCKED` → commit 工單 → （還有在等的 BAT 題目才取消）→ 送 `T0617 需要協助`。

## Step 3 — 重派後（Renew #1）

塔台會在 `## 塔台補充（Renew #1）` 寫 `塔台答覆 Q-1` 並重新派工。重派的 Worker 讀到 Renew 答覆 → 記入互動紀錄、刪 `tower_question` → 完成狀態 DONE → commit → 送 `T0617 完成`。

## 回報區另寫 `### 驗收證據`

- 第一輪：`--ask` 參數（不含題目內容）、exit code、id、`--expires-min` 值；每次等待呼叫時間；最終 `status` / `endReason`；`BLOCKED` 工單 commit hash；`需要協助` 送出時間；兩者先後
- 第二輪：讀到 Renew 答覆的時間與比對方式（是否只在 Renew 區段內比對）；互動紀錄寫法；最終 commit hash

## 驗收條件

- 第一輪以 `BLOCKED` + `需要協助` 收尾，工單 commit 在 notify 之前
- 第二輪讀到 Renew 答覆並 DONE

## 塔台補充（Renew #1）

**時間**：2026-10-18T11:14:00+0800 (UTC+8)
**補充內容**：
> 第一輪依設計逾時：BAT 題目 `expired` / `timeout`，Worker 以 `BLOCKED` + `需要協助` 收尾（工單 commit `60e3d92c` 在 notify 之前）。塔台對該題 `--answer` → exit 9 `status: expired timeout`，依規則改在本區段答覆。

- **塔台答覆 Q-1**：[A] 收到——第一輪逾時路徑已驗，本題在 Renew 區段答覆（2026-10-18T11:14:00+0800；塔台代決）

**新指示**：
> 依工單 Step 3：讀到上方 `塔台答覆 Q-1` → 記入互動紀錄、刪 `tower_question` → 填回報區「第二輪」證據 → DONE → commit → 送 `T0617 完成`。不要再提問。

---

## 回報區

### 待塔台決策

#### Q-1：探針 Q-1（逾時）
- 提問時間：2026-10-18T11:12:00+08:00
- 選項：[A] 收到 / [B] 沒收到 / [C] 其他：________
- Worker 建議：[A]，因為本單為受測探針，任一答覆皆可，此題預期逾時
- 影響範圍：Step 2 / Step 3（第一輪逾時收尾、第二輪 Renew）
- 阻塞：是（Step 2 起要等答覆）

### 完成狀態

**DONE**（第二輪，Renew #1）。兩項驗收條件皆達成：

- 第一輪以 `BLOCKED` + `需要協助` 收尾，工單 commit `60e3d92c`（11:13:34）在 notify（11:13:38）之前 ✅
- 第二輪在 `## 塔台補充（Renew #1）` 區段內讀到 `塔台答覆 Q-1` = [A]，記入互動紀錄、刪 `tower_question` → DONE ✅

（第一輪原狀態：**BLOCKED**，依 `yolo-mode.md` § Worker 向塔台提問 › § 備援：3-A 回傳 `expired` / `timeout`。）

### Landing Zone Check

- 結果：**PASS**
- C-0：frontmatter `repo` = `better-agent-terminal`；`basename(REPO_ROOT)` = `better-agent-terminal` → PASS（`REPO_ROOT` = `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）
- C-1：工單位於 `REPO_ROOT/_ct-workorders/` → PASS
- C-3：`affects_files` 只有 `_ct-workorders/` 下的本檔 → `C-3 not applicable`
- C-2：工單無 `branch` 欄位 → 略過（目前分支 `main`）
- `CT_HOME` 未設定（非 worktree 隔離）；`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）
- 環境：`CT_MODE=yolo`、`CT_INTERACTIVE=0`；`BAT_TOWER_TERMINAL_ID` / `BAT_REMOTE_PORT` / `BAT_REMOTE_TOKEN` 皆存在（權杖值不記錄）

### 執行摘要

1. 11:12:00 工單改 `IN_PROGRESS`、寫入 `### 待塔台決策` Q-1、加 `tower_question: open` → commit `93ea480c`（先 commit 後 notify）。
2. `worker_question_timeout` 取工單 frontmatter = `1`（合法整數，未讀 config）→ 走 3-A BAT 通道，`--expires-min 1`。
3. 11:12:07 `bat-notify.mjs --ask` 送出（題目只走 Git Bash heredoc stdin，無暫存檔），exit `0`，`--ask` 自己通知塔台 `T0617 提問`，未另送一般通知。
4. MCP `bat_wait_question` 迴圈等待：第 1 次 `pending`（逾時），第 2 次 `expired` / `timeout`。
5. 依 § 備援：不延長等待、不重送題目、未改走 3-B；填回報區 → `BLOCKED` → commit 工單 → 題目已有結束狀態（`expired`），**不需** `--cancel-question` → 送 `T0617 需要協助`（`--submit`）。
6. （第二輪，11:14:55）重派 Worker 以區段限定比對讀到 Renew #1 的 `塔台答覆 Q-1` → 記互動紀錄、刪 `tower_question` → 填第二輪證據 → DONE → commit → 送 `T0617 完成`（`--submit`）。未再提問、未讀產品程式碼。

### 驗收證據

**第一輪**

- `--ask` 參數（不含題目內容）：`"${BAT_HELPER_NODE:-node}" "$BAT_HELPER_DIR/bat-notify.mjs" --ask --source T0617 --target "$BAT_TOWER_TERMINAL_ID" --submit --expires-min 1 "T0617 提問"`，stdin = JSON（`question` 以 `Q-1：` 開頭、`options` 2 個、`detail`、`blocking: true`）
- exit code：`0`；stdout：`question: q-4b13b4f7-5d245786fa58509e`、`expires: 2026-10-18T03:13:07.422Z`、`notified: yes`
- `--expires-min` 值：`1`（= 生效的 `worker_question_timeout`）
- 等待呼叫（MCP `bat_wait_question`，`timeoutMs: 45000`）：
  - #1 起 ≈ 11:12:08，回 11:12:57：`{"changed":false,"status":"pending","waitedMs":45000}`
  - #2 起 ≈ 11:12:59，回 ≈ 11:13:07（11:13:10 取時）：`{"changed":true,"status":"expired","endReason":"timeout","waitedMs":7400}`
  - 兩次呼叫間隔 < 120 s
- 最終 `status` / `endReason`：`expired` / `timeout`（與 `expires` 2026-10-18T11:13:07+08:00 一致）
- `BLOCKED` 工單 commit hash：本次收尾 commit（訊息 `ct: block T0617 question-expired probe (Q-1 expired)`；hash 於 commit 後才產生，無法寫入同一 commit，見 `git log -- _ct-workorders/T0617-probe-ct570-question-expired.md`）
- `需要協助` 送出時間：於上述 commit **之後**送出（時間由 Worker 回覆畫面與 `bat-scripts.log` 記錄；第二輪可補記）
- 先後：工單 `BLOCKED` commit → `T0617 需要協助` notify（commit 在 notify 之前）

- 第一輪補記（第二輪 Worker 依 `bat-scripts.log` 補）：`BLOCKED` 工單 commit = `60e3d92c`（commit 時間 2026-10-18T11:13:34+08:00）；`T0617 需要協助` 由 `bat-notify` 送出於 2026-10-18T03:13:38.636Z（= 11:13:38+08:00），`terminal:notify` / `pty:write` / `terminal:keypress`（submit）皆 ok → commit 早於 notify 約 4 s ✅

**第二輪**

- 重派：塔台 2026-10-18T03:14:35Z `--close-worker T0617`（舊分頁）後以 `--skill ct-exec --workorder T0617 --mode yolo --no-interactive --wait-started 30000` 重派，新 Worker 分頁 `99f64984c7a2ce086dcd8c957a29a98c`
- 讀到 Renew 答覆時間：2026-10-18T11:14:55+08:00
- 比對方式：**只在區段內比對**——以 `awk` 依 `^## ` / `^### ` 標題追蹤目前區段，只在 `## 塔台補充（Renew #N）` 或 `### 待塔台決策` 內、且行首為 `- **塔台答覆 Q-1**` 時才算答覆；未對全檔 grep。命中第 71 行（`## 塔台補充（Renew #1）` 區段內）；`### 待塔台決策` 內無答覆行
- 互動紀錄寫法：見下方 `### 互動紀錄`（`[HH:MM] Q-n: … → A（塔台）: … → Action: …`）
- frontmatter：刪除 `tower_question`（唯一題目 Q-1 已答覆）；`status` → `DONE`；`### 待塔台決策` 原文保留作紀錄
- 最終 commit hash：本次收尾 commit（訊息 `ct: complete T0617 question-expired probe (Renew #1)`；hash 於 commit 後產生，無法寫入同一 commit，見 `git log -- _ct-workorders/T0617-probe-ct570-question-expired.md`）
- 先後：工單 DONE commit → `T0617 完成` notify（`--submit`）

### 互動紀錄

- [11:12] Q-1: 探針 Q-1（逾時）[A] 收到 / [B] 沒收到 → BAT 題目 `q-4b13b4f7-5d245786fa58509e` 於 11:13:07 `expired` / `timeout`，未獲答覆 → Action: § 備援，`BLOCKED` + `T0617 需要協助`
- [11:14] Q-1（Renew #1）: 探針 Q-1（逾時）→ A（塔台）: [A] 收到——第一輪逾時路徑已驗，本題在 Renew 區段答覆 → Action: 刪 `tower_question`、填第二輪證據、DONE、commit、送 `T0617 完成`

### Renew 紀錄

- Renew #1（2026-10-18T11:14:00+0800）：塔台於 `## 塔台補充（Renew #1）` 答覆 Q-1 = [A]；重派 Worker 依新指示完成 Step 3，未再提問

### 變更檔案

- `_ct-workorders/T0617-probe-ct570-question-expired.md`（僅本檔）

### 遭遇問題

- 無。題目依設計逾時。

### 偏離與備註

- 未讀產品程式碼、未跑 build / test、未 push；`src/styles/settings.css` 的既有 M 未動。
- 回報區未出現任何權杖值；題目未寫入暫存檔。
