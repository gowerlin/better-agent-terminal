---
schema_version: 1
schema_kind: workorder
id: T0618
title: "探針：CT v5.7.0 `worker_question_timeout: 0`（不用 BAT 通道、直接 BLOCKED）+ ct-done 補結"
type: verification
status: DONE
repo: better-agent-terminal
project: PLAN-048
priority: P2
sizing: S
created_at: "2026-10-18T11:02:10+0800"
started_at: "2026-10-18T11:16:18+0800"
updated_at: "2026-10-18T11:17:43+0800"
completed_at: "2026-10-18T11:17:43+0800"
depends_on: [T0617]
related:
  - "PLAN-048 / CT-T019：CT v5.7.0 × BAT 0.7.0-pre.8 統一實機驗收第 5 張（T0614–T0618）"
affects_files:
  - _ct-workorders/T0618-probe-ct570-timeout-zero-ct-done.md
renew_count: 1
workdir: main repo
worker_question_timeout: 0
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: guided-probe
memory_overrides:
  - "🔴 本單的受測對象是你自己的 ct-exec v5.7.0 提問流程（`ct-exec` § Questions For Tower ＋ control-tower `references/yolo-mode.md` § Worker 向塔台提問）。`worker_question_timeout: 0` 是刻意設定，照 skill 對 `0` 的規則做。"
  - "🔴 Q-1 是刻意安排的受測提問：一定要向塔台提問（不得問使用者）。"
  - "🔴 不讀產品程式碼、不改任何其他檔案、不跑 build / test。`src/styles/settings.css` 的 M 不是你的變更。不 push。commit 用 `git commit --only <本檔>`。回報區不得出現權杖值。"
---

# T0618 — 探針：`worker_question_timeout: 0` + ct-done 補結

## 目標

1. `worker_question_timeout: 0` 時 Worker 不用 BAT 通道：送一般 `T0618 提問` 後直接走 § 備援（`BLOCKED` + commit + `需要協助`）。
2. 塔台不在題目下答覆，只在 Renew 區段答覆。
3. 塔台以 **ct-done** 補結本單（驗 ct-done 在 notify 前的 commit 只含工單檔）。

## Step 1 — 受測提問 Q-1（ct-exec）

依 skill 規則向塔台提問（Q-1，阻塞：是）：探針 Q-1（timeout 0），選項 [A] 收到 / [B] 沒收到。之後照 skill 對 `0` 的規則收尾。

回報區另寫 `### 驗收證據`：有沒有呼叫 `--ask`（預期沒有）；一般 `提問` 的送出時間；`BLOCKED` 工單 commit hash；`需要協助` 送出時間；先後順序。

## Step 2 — 塔台補結（ct-done，由塔台另行派工）

塔台在 `## 塔台補充（Renew #1）` 寫 `塔台答覆 Q-1`，然後派 **ct-done**。ct-done Worker 依 ct-done 規則補結，並在回報區記：
讀到 Renew 答覆與否、最終狀態、notify 前那次 commit 的 hash 與 `git show --stat` 檔案清單（預期只有本工單檔）、notify 前 `git status --short`。

## 塔台補充（Renew #1）

**時間**：2026-10-18T11:17:04+0800 (UTC+8)
**補充內容**：
> 收到 `T0618 提問` 時依 § 塔台端 第 0 點（`worker_question_timeout: 0`）不在題目下答覆；收到 `T0618 需要協助`（工單 `BLOCKED`、`tower_question: open`）後在本區段答覆。

- **塔台答覆 Q-1**：[A] 收到——timeout 0 路徑已驗，本題在 Renew 區段答覆（2026-10-18T11:17:04+0800；塔台代決）

**新指示**：
> 本單由 **ct-done** 補結（Step 2）：讀上方 `塔台答覆 Q-1` → 記入互動紀錄、刪 `tower_question` → 最終狀態 **DONE** → 依 ct-done 規則 commit（只含本工單檔）→ 送 `T0618 完成`。回報區照 Step 2 記錄證據。

---

## 回報區

### 待塔台決策

#### Q-1：探針 Q-1（timeout 0）
- 提問時間：2026-10-18T11:16:18+0800
- 選項：[A] 收到 / [B] 沒收到 / [C] 其他：________
- Worker 建議：[A]，因為本單為受測探針，任一答覆皆可；`worker_question_timeout: 0`，Worker 不等答覆、直接走 § 備援
- 影響範圍：Step 1 收尾（BLOCKED）/ Step 2（塔台 Renew + ct-done 補結）
- 阻塞：是（Step 1 收尾後由塔台 Renew 答覆）

### 完成狀態

**DONE**（Step 2，ct-done 補結，2026-10-18T11:17:43+0800）。依據：塔台已在 `## 塔台補充（Renew #1）` 答覆 Q-1 = [A] 收到，並指示最終狀態 DONE；Step 1 的 timeout 0 路徑證據已齊（見 `### 驗收證據` 與 `### 補結證據（ct-done，Step 2）`）。frontmatter `tower_question` 已刪除，`### 待塔台決策` Q-1 保留作紀錄（已答覆）。

以下為 Step 1 原狀態紀錄（保留）：

**BLOCKED**（Step 1，ct-exec）。依 `yolo-mode.md` § Worker 向塔台提問 › § 備援：`worker_question_timeout = 0` → 不用 BAT 通道、不等答覆。
`### 待塔台決策` 原樣保留、frontmatter `tower_question: open` 保留；等塔台在 `## 塔台補充（Renew #1）` 答覆後由 ct-done 補結（Step 2）。

### Landing Zone Check

- 結果：**PASS**
- C-0：frontmatter `repo` = `better-agent-terminal`；`basename(REPO_ROOT)` = `better-agent-terminal` → PASS（`REPO_ROOT` = `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）
- C-1：工單位於 `REPO_ROOT/_ct-workorders/` → PASS
- C-3：`affects_files` 只有 `_ct-workorders/` 下的本檔 → `C-3 not applicable`
- C-2：工單無 `branch` 欄位 → 略過（目前分支 `main`）
- `CT_HOME` 未設定（非 worktree 隔離）；`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）
- 環境：`CT_MODE=yolo`、`CT_INTERACTIVE=0`；`BAT_TOWER_TERMINAL_ID` / `BAT_REMOTE_PORT` / `BAT_REMOTE_TOKEN` 皆存在（權杖值不記錄）

### 執行摘要

1. 11:16:18 工單改 `IN_PROGRESS`、寫入 `### 待塔台決策` Q-1（阻塞：是）、加 `tower_question: open` → commit `9ad5ee24`（11:16:25，先 commit 後 notify）。
2. `worker_question_timeout` 取工單 frontmatter = `0`（合法整數，未讀 config）→ 依 § Worker 端 第 3 點「先選通道」：**不用 BAT 通道**。
3. 11:16:29 依 § BAT Notify And Fallback 送一般 `T0618 提問`（`bat-notify.mjs --submit`，exit `0`，`✓ Notified 5f679fbf…: T0618 提問`）。
4. 未原地等待（3-B 不適用）、未呼叫 `bat_wait_question` / `--wait-answer`，直接走 § 備援：填回報區 → `BLOCKED` → commit 工單 → 無 BAT 題目在等，**不需** `--cancel-question` → 送 `T0618 需要協助`（`--submit`）。

### 驗收證據

- 有沒有呼叫 `--ask`：**沒有**（符合預期）。也未呼叫 `--wait-answer`、`--cancel-question`、MCP `bat_wait_question`。
- 一般 `提問` 送出：2026-10-18T11:16:29+0800（命令 `"${BAT_HELPER_NODE:-node}" "$BAT_HELPER_DIR/bat-notify.mjs" --source "T0618" --target "$BAT_TOWER_TERMINAL_ID" --submit "T0618 提問"`，exit `0`）
- 提問前的工單 commit：`9ad5ee24`（含 Q-1 與 `tower_question: open`，11:16:25，早於提問 notify）
- `BLOCKED` 工單 commit hash：本次收尾 commit（訊息 `ct: block T0618 timeout-zero question probe (Q-1, timeout 0)`；hash 於 commit 後才產生，無法寫入同一 commit，見 `git log -- _ct-workorders/T0618-probe-ct570-timeout-zero-ct-done.md`）
- `需要協助` 送出時間：於上述 commit **之後**送出（時間記錄於 Worker 回覆畫面與 `bat-scripts.log`；ct-done 可補記）
- 先後順序：Q-1 commit `9ad5ee24` → `T0618 提問` notify → 回報區 + `BLOCKED` → `BLOCKED` 工單 commit → `T0618 需要協助` notify
- ct-done 補記（取自 `git log` 與 `<userData>/Logs/bat-scripts.log`）：
  - `BLOCKED` 工單 commit = `fc414c45`（2026-10-18T11:16:47+0800）
  - `T0618 提問` notify：`terminal:notify` 11:16:28.910、submit keypress 11:16:29.169（+0800）
  - `T0618 需要協助` notify：`terminal:notify` 11:16:51.223、submit keypress 11:16:51.479（+0800）→ 晚於 `fc414c45`，順序符合預期
  - 該時段 bat-scripts.log 內 T0618 無 `--ask` / `--wait-answer` / `--cancel-question` 呼叫

### 補結證據（ct-done，Step 2）

- 讀到 Renew 答覆：**是**（`塔台答覆 Q-1`：[A] 收到，2026-10-18T11:17:04+0800，Renew commit `ab76757d`）
- 最終狀態：**DONE**；frontmatter `tower_question: open` 已刪、`status: DONE`、`completed_at` 已填
- Landing Zone Check（ct-done 重跑）：C-0 PASS（`repo` = `basename(REPO_ROOT)` = `better-agent-terminal`）、C-1 PASS、C-3 not applicable、C-2 略過（分支 `main`）；`CT_HOME` 未設定；`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`
- notify 前 `git status --short`（commit 前取得）：` M src/styles/settings.css`（非本單變更，未動）＋本工單檔（待 commit）
- notify 前那次 commit：訊息 `ct: complete T0618 timeout-zero probe via ct-done (Renew #1)`，`git commit --only` 本檔；hash 與 `git show --stat` 於 commit 後才產生，無法寫入同一 commit，見 `git log -1 -- _ct-workorders/T0618-probe-ct570-timeout-zero-ct-done.md`（ct-done Worker 回覆畫面另列）
- notify：`T0618 完成`（`CT_MODE=yolo` → `--submit`），於上述 commit 之後送出

### 互動紀錄

- [11:16] Q-1: 探針 Q-1（timeout 0）[A] 收到 / [B] 沒收到 → 未等答覆（`worker_question_timeout: 0`）→ Action: § 備援，`BLOCKED` + `T0618 需要協助`
- [11:17] Q-1 塔台答覆（Renew #1）：[A] 收到 → Action: ct-done 補結，`tower_question` 刪除，狀態 DONE，送 `T0618 完成`

### 變更檔案

- `_ct-workorders/T0618-probe-ct570-timeout-zero-ct-done.md`（僅本檔）

### 遭遇問題

- 無。依設計不等答覆。

### 偏離與備註

- 未讀產品程式碼、未跑 build / test、未 push；`src/styles/settings.css` 的既有 M 未動。commit 皆用 `git commit --only <本檔>`。
- 回報區未出現任何權杖值。
