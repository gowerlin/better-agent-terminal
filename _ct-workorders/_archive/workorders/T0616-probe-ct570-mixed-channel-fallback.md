---
schema_version: 1
schema_kind: workorder
id: T0616
title: "探針：CT v5.7.0 多題混合通道（BAT / `--ask` 失敗降級 / `--cancel-question`）"
type: verification
status: DONE
repo: better-agent-terminal
project: PLAN-048
priority: P2
sizing: S
created_at: "2026-10-18T11:02:10+0800"
started_at: "2026-10-18T11:08:47+0800"
updated_at: "2026-10-18T11:10:59+0800"
completed_at: "2026-10-18T11:10:59+0800"
depends_on: [T0615]
related:
  - "PLAN-048 / CT-T019：CT v5.7.0 × BAT 0.7.0-pre.8 統一實機驗收第 3 張（T0614–T0618）"
affects_files:
  - _ct-workorders/T0616-probe-ct570-mixed-channel-fallback.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: guided-probe
memory_overrides:
  - "🔴 本單的受測對象是你自己的 ct-exec v5.7.0 提問流程（`ct-exec` § Questions For Tower ＋ control-tower `references/yolo-mode.md` § Worker 向塔台提問）。除了下方明寫的兩處**刻意製造的錯誤**（Q-2、Q-3），其餘一律照 skill 規則做。"
  - "🔴 三題都是刻意安排的受測提問：即使你判斷可以自行決定，也一定要向塔台提問（不得問使用者）。"
  - "🔴 不讀產品程式碼、不改任何其他檔案、不跑 build / test。`src/styles/settings.css` 的 M 不是你的變更。不 push。commit 用 `git commit --only <本檔>`。"
  - "🔴 題目內容只走 stdin；暫存檔放系統暫存目錄，**不得**寫進 repo。回報區不得出現任何權杖值。"
---

# T0616 — 探針：多題混合通道

## 目標

一次問三題，三題各走不同路徑，驗證 Worker 的降級與塔台以 `Q-n：` 對應：

| 題 | 路徑 | 刻意製造的錯誤 | 預期 |
|---|---|---|---|
| Q-1 | BAT 通道 | 無 | 塔台 `--answer`，Worker 從 BAT 收到 |
| Q-2 | `--ask` 失敗 → 工單往返 | 送 `--ask` 時把 `--expires-min` 設成 **`999`**（超出 1–120，helper 以用法錯誤 exit `1`） | Worker 依 skill 降級：送一般 `T0616 提問`，等工單 `塔台答覆 Q-2` 行 |
| Q-3 | BAT 通道 → Worker 自行取消 → 工單往返 | `--ask` 成功後**立刻**（不等任何答覆）對該 id 執行 `--cancel-question`，模擬「中途放棄 BAT 等待」 | 依 stdout 的 `status:` 行判斷（skill § 3-A 第 5 步）；`cancelled worker` → 剩餘時間等工單 `塔台答覆 Q-3` 行 |

## Step 1 — 寫題目

依 skill 規則把三題一起寫進 `### 待塔台決策`（Q-1 / Q-2 / Q-3，阻塞皆為是），加 `tower_question: open`，commit。題目：

- Q-1：探針 Q-1（BAT 通道），選項 [A] 收到 / [B] 沒收到
- Q-2：探針 Q-2（`--ask` 失敗降級），選項 [A] 收到 / [B] 沒收到
- Q-3：探針 Q-3（取消後降級），選項 [A] 收到 / [B] 沒收到

## Step 2 — 送出（照這個順序）

1. Q-3：`--ask`（正常參數）→ 記 id → 立刻 `--cancel-question <id>` → 記 exit code 與 stdout 全部的 `status:` 行。
2. Q-2：`--ask`，`--expires-min 999` → 記 exit code 與 stderr 第一行。
3. Q-1：`--ask`（正常參數）→ 記 id。
4. 依 skill 判斷要不要、以及送幾次一般 `T0616 提問`（Q-2 / Q-3 都改走工單往返時，規則是只送一次）。記下實際送了幾次、在哪一步送的。

## Step 3 — 等三題的答覆

依 skill 規則同時等：Q-1 走 BAT 等待（兩次呼叫間隔不得超過 120 s），Q-2 / Q-3 讀工單答覆行（只在 `### 待塔台決策` 區段內比對，間隔 ≥ 30 s）。
三題都答完 → 刪 `tower_question`，逐題寫互動紀錄。

## Step 4 — 收尾

照 ct-exec 收尾。回報區另寫 `### 驗收證據`：每題的路徑、指令參數（不含題目內容）、exit code、id、`status:` 行、答覆來源（BAT / 工單）、
收到時間；一般 `提問` 通知送出的次數；三題的互動紀錄寫法。完成後送 `T0616 完成`（yolo `--submit`）。

## 驗收條件

- Q-1 從 BAT 收到；Q-2 / Q-3 從工單答覆行收到；三題都收到
- `--ask` 失敗後沒有留下塔台看不到的 BAT 題目；一般 `提問` 只送一次
- 回報區 `### 驗收證據` 完整

---

## 回報區

### 待塔台決策

#### Q-1：探針 Q-1（BAT 通道）
- 提問時間：2026-10-18T11:08:47+0800
- 選項：[A] 收到 / [B] 沒收到 / [C] 其他：________
- Worker 建議：[A]，因為本題是刻意安排的受測提問，答 [A] 即可確認此路徑送達
- 影響範圍：Step 3 等待答覆、Step 4 驗收證據
- 阻塞：是（Step 3 起要等答覆）

#### Q-2：探針 Q-2（`--ask` 失敗降級）
- 提問時間：2026-10-18T11:08:47+0800
- 選項：[A] 收到 / [B] 沒收到 / [C] 其他：________
- Worker 建議：[A]，因為本題是刻意安排的受測提問，答 [A] 即可確認此路徑送達
- 影響範圍：Step 3 等待答覆、Step 4 驗收證據
- 阻塞：是（Step 3 起要等答覆）
- **塔台答覆 Q-2**：[A] 收到——`bat_list_questions` 查無此題，依規則改在工單答覆（2026-10-18T11:09:50+0800；塔台代決）

#### Q-3：探針 Q-3（取消後降級）
- 提問時間：2026-10-18T11:08:47+0800
- 選項：[A] 收到 / [B] 沒收到 / [C] 其他：________
- Worker 建議：[A]，因為本題是刻意安排的受測提問，答 [A] 即可確認此路徑送達
- 影響範圍：Step 3 等待答覆、Step 4 驗收證據
- 阻塞：是（Step 3 起要等答覆）
- **塔台答覆 Q-3**：[A] 收到——BAT 題目已 `cancelled worker`（`--answer` exit 9），依規則改在工單答覆（2026-10-18T11:09:50+0800；塔台代決）

### 互動紀錄

- [11:08] Landing check PASS：C-0 expected repo `better-agent-terminal` = actual `basename(REPO_ROOT)` `better-agent-terminal`（`REPO_ROOT=D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）；C-1 工單在 repo 下；C-3 not applicable（`affects_files` 只有 `_ct-workorders/` 下的本工單）；C-2 無 `branch` 欄位（`main`）。`CT_HOME` 未設。`BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`。`CT_MODE=yolo`、`CT_INTERACTIVE=0`。既存 ` M src/styles/settings.css` 不是本單變更，保留不動。
- [11:09] Q-1: 探針 Q-1（BAT 通道） → A（塔台，BAT 通道，choice 1）: [A] 收到——Q-1 經 BAT 通道送達 → Action: 記錄 Q-1 路徑驗收通過。
- [11:10] Q-2: 探針 Q-2（`--ask` 失敗降級） → A（塔台）: [A] 收到——`bat_list_questions` 查無此題，依規則改在工單答覆 → Action: 記錄 Q-2 降級路徑驗收通過。
- [11:10] Q-3: 探針 Q-3（取消後降級） → A（塔台）: [A] 收到——BAT 題目已 `cancelled worker`（`--answer` exit 9），依規則改在工單答覆 → Action: 記錄 Q-3 取消後降級路徑驗收通過。

### 完成狀態

DONE — 三題都收到：Q-1 經 BAT 通道（`bat_wait_question` answered），Q-2 / Q-3 經工單 `### 待塔台決策` 區段內的 `塔台答覆 Q-n` 行。一般 `T0616 提問` 只送一次；`--ask` 失敗的 Q-2 沒有在 BAT 留下題目。三題答完後已刪除 frontmatter `tower_question`。

### 驗收證據

共通：helper `node` + `$BAT_HELPER_DIR\bat-notify.mjs`（`C:\Program Files\BetterAgentTerminal\resources\scripts`）；題目 JSON 放在系統暫存目錄（Claude Code session scratchpad，`%LOCALAPPDATA%\Temp\claude\…\scratchpad\q{1,2,3}.json`），以 stdin 重導入，未放 argv、未寫進 repo。每題 JSON：`question` 以 `Q-n：` 開頭、2 個選項（不含「其他」）、`detail` 放建議 / 影響 / 阻塞、`blocking: true`。`worker_question_timeout` 取工單 frontmatter `30`。題目（含 `tower_question: open`）先 commit `e9cb557f7b7cf6093e871ef5c8149f557ef9844f`（11:08:47 寫入）之後才送第一個 `--ask`（11:09:15）。

| 題 | 路徑 | 指令參數（不含題目內容） | exit | id | `status:` 行 / stderr | 答覆來源 | 收到時間 |
|---|---|---|---|---|---|---|---|
| Q-3 | BAT `--ask` → 立刻 `--cancel-question` → 3-B 工單往返 | ① `--ask --source T0616 --target "$BAT_TOWER_TERMINAL_ID" --submit --expires-min 30 "T0616 提問"`（11:09:15）② `--cancel-question <id>`（11:09:16） | ① `0`（`notified: yes`）② `0` | `q-4b13b4f7-dd06d1bf0a9539e2` | ② stdout 唯一的 `status:` 行：`status: cancelled worker`（stderr 空） | 工單（`- **塔台答覆 Q-3**`，塔台時間戳 11:09:50） | Worker 偵測 11:09:57（背景 grep）/ 11:10:11（區段限定 awk Monitor） |
| Q-2 | `--ask` 失敗 → 3-B 工單往返 | `--ask --source T0616 --target "$BAT_TOWER_TERMINAL_ID" --submit --expires-min 999 "T0616 提問"`（11:09:29） | `1` | 無（未取得） | stderr 第一行：`Error: Invalid --expires-min value: '999' (expected minutes, 1-120)`；最後一行 `ask: USAGE` | 工單（`- **塔台答覆 Q-2**`，塔台時間戳 11:09:50） | 同 Q-3：11:09:57 / 11:10:11 |
| Q-1 | BAT 通道 3-A | `--ask --source T0616 --target "$BAT_TOWER_TERMINAL_ID" --submit --expires-min 30 "T0616 提問"`（11:09:29） | `0`（`notified: yes`） | `q-4b13b4f7-b9bb0f7506aa0fa4` | MCP `bat_wait_question`（`timeoutMs` 45000）第 1 次呼叫：`changed: true`、`status: answered`、`answer.choice: 1`、`waitedMs: 5481` | BAT（`answeredAt` 1792292987485 = 11:09:47 +0800） | 11:09:51（等待開始到收到只呼叫一次，故「兩次間隔 ≤ 120 s」未觸發，等待在 `--ask` 後約 20 s 內開始） |

- 一般 `T0616 提問` 通知：**送 1 次**，在 Step 2.4（Q-1 `--ask` 之後）11:09:35 送出，`--source T0616 --target "$BAT_TOWER_TERMINAL_ID" --submit "T0616 提問"`，exit `0`。依據：3-A 第 2 步「exit ≠ 0 → 送一次一般 `T#### 提問`（同時有多題改 3-B 也只送一次）」——觸發者是 Q-2；Q-3 的降級出自第 4 / 5 步（`cancelled` → 剩餘時間改 3-B），規則沒有要求另送通知，且 Q-3 的 `--ask` 已通知過塔台，因此 Q-2 / Q-3 合計只送這一次。塔台另外收到的 2 次 `T0616 提問` 來自 Q-3、Q-1 的 `--ask` 本身（`--ask` 自己會通知，成功後不另送）。
- `--ask` 失敗後未留下塔台看不到的 BAT 題目：11:10 以 MCP `bat_list_questions`（`status: all`）查本分頁的題目，只有 Q-3（`cancelled` / `endReason: worker`）與 Q-1（`answered`, choice 1）兩題，沒有 Q-2。Q-2 在 helper 端參數檢查即失敗（`ask: USAGE`），沒有送到 BAT。塔台答覆 Q-2 時也記「`bat_list_questions` 查無此題」。
- 3-B 等待：Claude Code `Monitor` 以 § Worker 端 3-B 的區段限定 `awk` 比對 `### 待塔台決策` / `## 塔台補充（Renew #N）` 內的 `^- [*][*]塔台答覆 Q-n[*][*]`，間隔 30 s，上限 30 分鐘；第 2 輪（11:10:11）偵測到 Q-2、Q-3。另有一個背景 `grep -E '^- \*\*塔台答覆 Q-n\*\*'`（不限區段，只當輔助）在 11:09:57 先完成；判定以區段限定比對為準，收尾前再跑一次：Q-2 / Q-3 exit 0、Q-1 exit 1（Q-1 走 BAT，塔台未寫工單答覆行，符合規則）。
- 等待期間對工單只讀不寫；塔台只新增兩行答覆，`git diff` 收尾前為 `+2` 行。
- 互動紀錄寫法：Q-1 寫 `A（塔台，BAT 通道，choice 1）`；Q-2 / Q-3 寫 `A（塔台）`（3-B 格式）。三題皆 `[HH:MM] Q-n: … → A…: … → Action: …`。
- 未讀產品程式碼、未改其他檔案、未跑 build / test；回報區不含任何權杖值。

### 變更檔案

- `_ct-workorders/T0616-probe-ct570-mixed-channel-fallback.md`：提問、互動紀錄、驗收證據、完成狀態（唯一變更）。

### Commit 狀態

- 無產品變更，無產品 commit。
- 工單：`e9cb557f7b7cf6093e871ef5c8149f557ef9844f` — `ct: start T0616 mixed-channel question probe`（IN_PROGRESS＋三題＋`tower_question: open`）；收尾 commit 為本次 `ct: complete T0616 mixed-channel question probe`（`git commit --only` 本檔）。
- 未 push。既存 ` M src/styles/settings.css` 不是本單變更，未動。

### 偏差 / 後續

- 無偏差。觀察：Q-3 的 `--ask` 在 11:09:15 已通知塔台，取消後 Worker 依規則沒有再為 Q-3 補送通知；塔台這次能接到，是因為讀到 Q-3 的 `--answer` exit `9` `cancelled …` 後依 § 塔台端 第 3 點改工單答覆，加上 Q-2 觸發的那一次一般通知。若某次只有「取消後降級」而沒有其他題觸發一般通知，塔台得靠 `--answer` exit 9 或第一次 `提問` 通知時讀工單才能發現要改工單答覆——本次實測此路徑可行（塔台時間戳 11:09:50 已在 Q-3 取消之後）。供塔台判斷是否需要在 skill 寫明，不在本單範圍。
