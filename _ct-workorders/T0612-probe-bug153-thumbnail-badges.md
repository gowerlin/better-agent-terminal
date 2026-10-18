---
schema_version: 1
schema_kind: workorder
id: T0612
title: "探針：BUG-153 安裝版 Worker 縮圖 ⚠️ / ? / ✓（使用者目視）"
type: verification
status: TODO
repo: better-agent-terminal
project: PLAN-048
priority: P2
sizing: S
created_at: "2026-10-18T09:38:11+0800"
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

（Worker 填寫）
