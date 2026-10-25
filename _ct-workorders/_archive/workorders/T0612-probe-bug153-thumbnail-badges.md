---
schema_version: 1
schema_kind: workorder
id: T0612
title: "探針：BUG-153 安裝版 Worker 縮圖 ⚠️ / ? / ✓（使用者目視）"
type: verification
status: DONE
repo: better-agent-terminal
project: PLAN-048
priority: P2
sizing: S
created_at: "2026-10-18T09:38:11+0800"
started_at: "2026-10-18T09:39:10+0800"
updated_at: "2026-10-18T09:46:51+0800"
completed_at: "2026-10-18T09:46:51+0800"
depends_on: [T0609]
related:
  - "BUG-153（FIXED by T0609 `fbf641dc`，等安裝版 0.7.0-pre.7 目視）"
  - "PLAN-048（Worker 問塔台，結構化 `--ask` 首次在安裝版實跑）"
affects_files:
  - _ct-workorders/T0612-probe-bug153-thumbnail-badges.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: guided-probe
memory_overrides:
  - "🔴 探針單：不讀產品程式碼、不改任何其他檔案、不跑 build / test。只依序做下方 Step 1–4，每步把結果寫進回報區 `### 互動紀錄`。`src/styles/settings.css` 的 M 不是你的變更。不 push。commit 只用 `git commit --only <本檔>`。"
  - "🔴 Step 1 的 AskUserQuestion 是**本單的受測對象**（製造 hook `blocked` / `question` 讓使用者看縮圖 ⚠️），使用者已於 2026-10-18 在塔台同意。只在 Step 1 用這一次，其他地方仍照 yolo 規則不得問使用者。"
  - "🔴 問題 JSON 一律用 Write 工具寫到系統暫存目錄（例 `$TEMP` / scratchpad，**不得**寫進 repo），不要用 heredoc（L129）。"
---

# T0612 — 探針：BUG-153 Worker 縮圖標示

使用者在 BAT 畫面上看本 Worker 分頁的縮圖標示，以及塔台分頁右鍵選單「關閉已回報的 Worker 分頁（N）」的 N。
Worker 只負責依序製造四種狀態，每一步等使用者 / 塔台回應後再進下一步。

| Step | 狀態 | 使用者預期看到 | N（批次關閉） |
|---|---|---|---|
| 1 | hook `blocked`（AskUserQuestion） | ⚠️ | 0 |
| 2 | 結構化提問（`bat-notify --ask`，訊息**不**以 `提問` 結尾） | `?` | 0 |
| 3 | 舊 CT 提問（工單檔 + `T0612 提問`） | `?` | 0 |
| 4 | 完成回報（`T0612 完成`） | `✓` | 1 |

以下指令在 Bash 工具（Git Bash）執行；`N="${BAT_HELPER_NODE:-node}"`，helper 在 `$BAT_HELPER_DIR`。

## Step 1 — ⚠️（hook blocked）

呼叫 AskUserQuestion 一次，題目：「BUG-153 探針 Step 1：請看本 Worker 縮圖是否顯示 ⚠️，並在塔台分頁右鍵看『關閉已回報的 Worker 分頁（N）』的 N」，選項：
- `看到 ⚠️，N = 0（或選單沒有這項）`
- `沒看到 ⚠️`
- `有 ⚠️ 但 N ≠ 0`

使用者回答後記入互動紀錄，進 Step 2（不論答案）。

## Step 2 — `?`（結構化提問）

1. 用 Write 工具在暫存目錄寫 `t0612-q.json`：
   `{"question":"BUG-153 探針 Step 2：請看縮圖是否為 ?、N 是否為 0","options":["已確認"],"blocking":true}`
2. 送出（記下 stdout 的 `question:` id 與 exit code）：
   `"$N" "$BAT_HELPER_DIR/bat-notify.mjs" --ask --source T0612 --target "$BAT_TOWER_TERMINAL_ID" --submit "T0612 結構化提問（探針 Step 2）" < "<t0612-q.json 路徑>"`
   - exit 非 0 → 記錄 stderr，跳到 Step 3（不重試）。
3. 等答覆：重複 `"$N" "$BAT_HELPER_DIR/bat-notify.mjs" --wait-answer <id> --timeout-ms 45000`，直到 stdout JSON 的 `status` 不是 `pending`（每次呼叫都會延長租約，兩次呼叫間不要停超過 60 s）；總上限 30 分鐘。記下 `status` / `answer.choice` / `waitedMs`。
4. 收到答覆後**停 60 秒**再進 Step 3（讓使用者看答覆後、下一步之前的縮圖），記入互動紀錄。

## Step 3 — `?`（舊 CT 提問，工單檔往返）

依 control-tower `references/yolo-mode.md` § Worker 向塔台提問 › Worker 端：
1. 在本檔 `## 回報區` 最上方新增 `### 待塔台決策` / `#### Q-1：BUG-153 探針 Step 3：請看縮圖是否為 ?、N 是否為 0`（提問時間取自系統；選項 `[A] 已確認`；阻塞：是），frontmatter 加 `tower_question: open`。
2. 送 `"$N" "$BAT_HELPER_DIR/bat-notify.mjs" --source T0612 --target "$BAT_TOWER_TERMINAL_ID" --submit "T0612 提問"`。
3. 每 30 秒重讀本檔，直到出現 `塔台答覆 Q-1` 行（上限 30 分鐘；逾時照該節備援以 BLOCKED 收尾）。讀到後刪 `tower_question`，記入互動紀錄。

## Step 4 — ✓（完成回報）

照 ct-exec 收尾：完成狀態 DONE、回報區寫各步結果（只記 exit code / 狀態 / id / 時間，不記權杖）→ `git commit --only <本檔>` → 照常送 `T0612 完成`（yolo `--submit`）。

---

## 回報區

### 待塔台決策

#### Q-1：BUG-153 探針 Step 3：請看縮圖是否為 ?、N 是否為 0

- 提問時間：2026-10-18T09:45:21+0800
- 選項：
  - [A] 已確認
  - [其他] 其他觀察（請描述）
- Worker 建議：[A]（探針確認用，無實質決策）
- 影響：只用來製造舊 CT 提問狀態，供使用者目視縮圖 `?` 與批次關閉 N
- 阻塞：是（Step 4 等答覆後才進行）
- **塔台答覆 Q-1**：[A] 已確認——使用者目視縮圖為 `?`、「關閉已回報的 Worker 分頁（0）」灰色停用（2026-10-18T09:46:16+0800；使用者決定）

### 互動紀錄

- [09:42] Step 1（hook blocked，AskUserQuestion）：使用者選「看到 ⚠，N = 0（或選單沒有這項）」，並附截圖：Worker 縮圖標題列有 ⚠️ 徽章；塔台分頁右鍵選單「關閉已回報的 Worker 分頁（0）」為停用（灰色）。→ 符合預期（⚠️ / N=0）。
- [09:42] Step 2（結構化提問）：`bat-notify --ask` exit 0，question id `q-f17ecd01-8870f256f02a4cd8`，`notified: yes`，expires `2026-10-18T02:12:43.373Z`。
- [09:44] Step 2 答覆：`--wait-answer` 第 1 次 `pending`（waitedMs 45003），第 2 次 `status: answered`、`answer.choice: 1`、waitedMs 32408（皆 exit 0）。之後停 60 秒再進 Step 3（供使用者看答覆後的縮圖）。
- [09:45] 停頓實際 67 秒（答覆 09:44:05 → 09:45:12）後進 Step 3。
- [09:45] Step 3（舊 CT 提問）：回報區寫 `### 待塔台決策` / `#### Q-1`，frontmatter 加 `tower_question: open`，`bat-notify --submit "T0612 提問"` exit 0。
- [09:46] Q-1: BUG-153 探針 Step 3：請看縮圖是否為 ?、N 是否為 0 → A（塔台）: [A] 已確認——使用者目視縮圖為 `?`、「關閉已回報的 Worker 分頁（0）」灰色停用 → Action: 刪除 `tower_question`，進 Step 4。（輪詢註記：第一次輪詢 grep 全檔，誤中本文 Step 3 的步驟說明文字，改為只搜 `## 回報區` 之後重跑，09:46:31 讀到答覆。）
- [09:46] Step 4：寫報告、狀態 DONE、`git commit --only` 本檔、送 `T0612 完成`（yolo `--submit`）。

### 結果摘要

| Step | 狀態 | 預期 | 結果 | 證據 |
|---|---|---|---|---|
| 1 | hook `blocked`（AskUserQuestion） | ⚠️ / N=0 | ✅ PASS | 使用者答覆 + 截圖（縮圖 ⚠️ 徽章；右鍵「關閉已回報的 Worker 分頁（0）」停用） |
| 2 | 結構化提問 `--ask`（訊息不以 `提問` 結尾） | `?` / N=0 | ✅ PASS（使用者經塔台答 choice 1「已確認」） | `--ask` exit 0、id `q-f17ecd01-8870f256f02a4cd8`；`--wait-answer` → `answered`、choice 1 |
| 3 | 舊 CT 提問（工單檔 + `T0612 提問`） | `?` / N=0 | ✅ PASS | 塔台答覆 Q-1：使用者目視 `?`、N=0 停用 |
| 4 | 完成回報 `T0612 完成` | `✓` / N=1 | ⏳ 由使用者在本 Worker 送出完成通知後目視（Worker 無法觀察通知後的畫面） | — |

- 驗證 lane：installed-bundle（安裝版 0.7.0-pre.7）使用者目視；未跑 build / test、未讀產品程式碼（探針單規則）。
- 變更檔案：只有本工單檔。問題 JSON 寫在 session scratchpad（不在 repo）。
- Landing check：PASS。C-0 `repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal`；C-1 PASS；C-3 not applicable（`affects_files` 只有 `_ct-workorders/`）；C-2 無 `branch` 欄位。`CT_HOME` 未設定（非 worktree）。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）。
- 偏差：Step 1 回答後使用者中斷一次並補送截圖，內容與答覆一致，未改變流程。
- Commit：`git commit --only` 本檔（hash 見塔台 git log）；未 push。`src/styles/settings.css` 的 M 非本單變更，未觸碰。
- 後續：Step 4 的 `✓` / N=1 待使用者目視確認後，塔台可結 BUG-153。
