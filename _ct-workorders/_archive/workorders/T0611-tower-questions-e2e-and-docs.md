---
schema_version: 1
schema_kind: workorder
id: T0611
title: "PLAN-048 C：Worker 問塔台 — 完整流程 e2e、文件收尾（併入 T0608 草稿）、`--cancel-question` 對 `lost` 對齊主行程"
type: feature
status: DONE
repo: better-agent-terminal
project: PLAN-048
priority: P2
sizing: S-M
created_at: "2026-10-18T07:04:54+0800"
started_at: "2026-10-18T07:05:15+0800"
updated_at: "2026-10-18T07:15:57+0800"
completed_at: "2026-10-18T07:15:57+0800"
depends_on: [T0607, T0608, T0609, T0610]
related:
  - "T0606 契約 C-1–C-11、「實作切分」C 節；T0607（主行程）、T0608（helper / MCP，回報區「文件草稿」(1)(2)(3)）、T0609（縮圖 `?` / ⚠️、`terminal:attention-changed`）、T0610（合併；回報區「語意檢查」helper 往返實測表與「已知不一致的實際行為」）"
affects_files:
  - "e2e/t0611-tower-question.spec.ts（新）"
  - scripts/bat-notify.mjs
  - "scripts/__tests__/bat-notify-questions.test.mjs、scripts/__tests__/_question-mock-remote.mjs"
  - CLAUDE.md
  - "docs/agent-guide/tower-questions.md、docs/agent-guide/bat-mcp-shim.md"
  - _ct-workorders/T0611-tower-questions-e2e-and-docs.md
renew_count: 0
workdir: main repo
interaction:
  mode_hint: on
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 不改主行程契約與 `electron/**`；`scripts/bat-notify.mjs` 只改 `--cancel-question` 的 `lost` 處理與 `--help`。發現其他契約問題 → `T0611 提問`，不得自行改。"
  - "🔴 CLAUDE.md `##` 標題不改名（T0595 規則；「Worker 問塔台（PLAN-048 / T0607）」維持原標題），只改節內文字，每節 3–12 行原則；細節寫進 docs。"
  - "🔴 不 push、不觸發 workflow、不建 tag、不改版號；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；含反斜線的內容用 Write / Edit 工具（L129）；寫檔保持 LF；commit 一律 `git commit --only <檔案…>`。`src/styles/settings.css` 的 M 不是你的變更。"
  - "🔴 不碰使用者正在用的 BAT（port 9876）；e2e 用隔離實例（先 `npx vite build`）。不得對 claude / codex 送出任何 prompt；分頁內以 node 腳本扮演 Worker / 塔台。"
---

# T0611 — PLAN-048 C：e2e 與文件收尾

## 背景

PLAN-048 的 A（T0607）、B（T0608，T0610 合併）、BUG-153（T0609）都已在 `main`（`4e5f5e7f`）。T0610 用真 headless 跑過 helper 往返，全部符合契約；只有一點不一致：`--cancel-question` 對 `lost` 的處理。

**塔台裁定（契約 C-3 為準）**：`question:cancel` 遇到已結束的問題（含 `lost`）回現狀、不是錯誤，主行程現行行為正確。helper `--cancel-question` 對 `lost` 一律 **exit 0**，stdout `✓ Question already ended: <id>` + `  status: lost`（現況即如此）；刪除 `NOT_FOUND` + `lost` → exit 3 / `cancel-question: LOST` 這條在真主行程下不會走到的分支，`--help` 與文件寫明「exit 0 不代表本次取消成功，看 `status:` 行，`cancelled worker` 才是本次取消」。假 RemoteServer 與測試同步改成真主行程的回傳形狀。

## 任務

1. `--cancel-question` 依上面的裁定修正（helper、`--help`、測試、假 server）。
2. e2e `e2e/t0611-tower-question.spec.ts`（隔離實例；比照 T0606「實作切分」C 節與 `e2e/t0609-worker-attention-badge.spec.ts` 的做法；分頁以 helper env 執行 node 腳本扮演塔台 / Worker，不啟動 claude / codex）：
   - Worker `bat-notify --ask`（stdin JSON）→ 塔台以 shim stdio 呼叫 `bat_list_questions` 看到題目 → `terminal:get-state`（或 MCP `bat_get_state`）對 Worker 回 `blocked` / `tower` / `pendingQuestions: 1` → Worker 縮圖為結構化的 `?`（`data-attention="question"`），不計入「關閉已回報的 Worker 分頁（N）」
   - 塔台 `bat-terminal --answer`（stdin）→ Worker `bat_wait_question`（或 `--wait-answer`）收到答覆 → 狀態離開 `blocked`、`pendingQuestions: 0`
   - 第二題後關閉 Worker 分頁 → 塔台 `bat_list_questions status=all` 看到 `cancelled` / `worker-exited`
   - 可選：BAT 重開（Terminal Server 存活）後舊 id → `lost`（做不到就寫原因）
   - 斷言 bat-scripts.log 與 debug 日誌不含問題 / 答案文字
3. 文件：
   - CLAUDE.md「Worker 問塔台（PLAN-048 / T0607）」節併入 T0608 草稿 (1)（helper / MCP 要點；維持 3–12 行，超出的細節進 docs）；「BAT MCP shim」節「6 個唯讀 tool」改為 8 個並補 T0608 草稿 (3) 一句。
   - `docs/agent-guide/tower-questions.md`：以 T0608 草稿 (2) 取代「見 T0608，收尾單補入」那段，套用第 1 項裁定；補 e2e 驗證清單。`docs/agent-guide/bat-mcp-shim.md` 如需同步就改。

## 驗收條件

1. `npx vite build` 成功；`npm run typecheck` = 0、`npm run typecheck:electron` = 0；`npm run test:unit` 全綠（回報 passed / files 數）；`npm run verify:helpers` OK。
2. e2e：新 spec + 回歸 `e2e/t0609-worker-attention-badge.spec.ts`、`e2e/t0584-bat-mcp-shim.spec.ts` 全部通過。
3. 回報區附：e2e 各步驟的實際回傳 / DOM 斷言摘錄、`--cancel-question` 修正前後對照、CLAUDE.md 兩節的最終文字、變更檔案清單。

---

## 回報區

### 待塔台決策（僅 yolo Worker 有問題時）

無。

### 完成狀態

**DONE**。三項任務完成，驗收 1–3 全部通過（驗收跑在 `bf93dd88` + 本單工作樹變更，即 commit `c271e852` 的內容；commit 後沒有再改產品檔）。

- 落點檢查：PASS。C-0：`repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`；`CT_HOME` 未設定（非隔離派工）。C-1：工單在 `REPO_ROOT/_ct-workorders/`。C-3：`affects_files` 為描述文字（`e2e/`、`scripts/`、`docs/agent-guide/` 皆存在），informational PASS。C-2：無 `branch` 欄位，在 `main`。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）。
- 開工 HEAD `bf93dd88`；既有髒檔 `src/styles/settings.css` 未碰、未 stage。

| 驗收 | 結果 |
|---|---|
| `npx vite build` | PASS，exit 0 |
| `npm run typecheck` | PASS，exit 0 |
| `npm run typecheck:electron` | PASS，exit 0 |
| `npm run test:unit` | PASS：**301 files / 5226 passed / 3 skipped**（與 T0610 相同；`lost` 案例從迴圈移到同一個 `it` 內的獨立斷言，案例數不變） |
| `npm run verify:helpers` | PASS：`OK — all 18 helper .mjs files in extraResources are reachable via filter; server bundle ships 6 helper(s) with a closed import set` |
| e2e 新 spec 單跑 | PASS：1 passed（33.0 s） |
| e2e 新 spec + 回歸 t0609 + t0584 | PASS：**3 passed（50.6 s）** |

### 產出摘要

**commit**：`c271e852` `feat(ct): tower question e2e, docs wrap-up, --cancel-question lost exits 0 (T0611)`（`git commit --only` 6 個檔案；未 push）。

**變更檔案**

| 檔案 | 內容 |
|---|---|
| `scripts/bat-notify.mjs` | `runCancelQuestion` 刪除 `NOT_FOUND` + `status: lost` → `LOST` 分支（`lost` 一律走 `outcome.ok` 的「已結束」分支）；`--help` 的 `--cancel-question` 補 stdout 兩行格式與「Exit 0 does not mean this call cancelled it: only "status: cancelled worker" does」 |
| `scripts/__tests__/bat-notify-questions.test.mjs` | `lost` 改用真主行程的回傳形狀 `{ ok: true, questionId, status: 'lost' }`：exit 0、stdout 兩行逐字、stderr 空、bat-scripts.log `result: 'ok', status: 'lost'`；刪除 `NOT_FOUND` + `lost` → 3 / `LOST` 案例；`--help` 斷言補兩句；檔頭說明同步 |
| `scripts/__tests__/_question-mock-remote.mjs` | **未改**：假 server 是通用的，回傳形狀由各測試傳入（`lost` 形狀在測試檔改），沒有內建 `question:cancel` 回應 |
| `e2e/t0611-tower-question.spec.ts` | 新 e2e（見下） |
| `CLAUDE.md` | 「Worker 問塔台（PLAN-048 / T0607）」併入 T0608 草稿 (1)；「BAT MCP shim」6 → 8 個 tool + 草稿 (3)（標題未改） |
| `docs/agent-guide/tower-questions.md` | 檔頭來源說明；`question:cancel` 的 `lost` 改寫為 T0611 裁定；「見 T0608，收尾單補入」換成草稿 (2)（helper 四節 + 唯讀 MCP tool 節），`--cancel-question` 套用裁定並附修正前後對照表；驗證清單補 helper / MCP 測試與 e2e 五步 |
| `docs/agent-guide/bat-mcp-shim.md` | 驗證段補 e2e `t0611-tower-question.spec.ts` 一句（tool 表、八個 tool 已在 T0608 改好） |

**`--cancel-question` 修正前後（`lost` 的 id）**

| | exit | stdout | stderr |
|---|---|---|---|
| 修正前：T0608 helper 對 `NOT_FOUND` + `lost`（只有假 server 會回） | 3 | — | `Error: Question not cancelled (LOST): … belonged to a BAT that has restarted since (it is gone)` / `cancel-question: LOST` |
| 修正前：真主行程（T0610 實測） | 0 | `✓ Question already ended: <id>` / `  status: lost` | 空 |
| 修正後：真主行程（本單 e2e 步驟 4 實測，BAT 真的重開） | **0** | `✓ Question already ended: q-a260fceb-35dfc54972768185` / `  status: lost` | 空 |
| 修正後：單元測試（假 server 回 `{ ok: true, status: 'lost' }`） | 0 | 同上兩行逐字 | `''` |

`--help` 新增文字：

```text
  --cancel-question <id>
                     Withdraw a question this Worker asked (an ended one keeps its status).
                     stdout: "✓ Question cancelled: <id>" or "✓ Question already ended: <id>",
                     then "  status: <status> [<endReason>]". Exit 0 does not mean this call
                     cancelled it: only "status: cancelled worker" does (answered / expired /
                     lost etc. had ended before; lost = BAT restarted since, it is gone).
```

**e2e `e2e/t0611-tower-question.spec.ts` 實際回傳 / DOM 斷言摘錄**（第一次單跑；id 為該次實測值）

做法：隔離實例；塔台 = shell 分頁（`pty.write` 打 `node runner.cjs <spec>`），Worker = 自訂 CLI `node runner.cjs serve <jobs>`（常駐、依序執行 job 檔），兩者在分頁內以自己的權杖跑 helper 與 `bat-mcp.mjs` stdio；結果寫檔，不印到分頁。不啟動 claude / codex、不碰 port 9876。

1. Worker `--ask`（stdin JSON，`detail` 含假 `batcap.` 權杖；通知訊息 `T0611 等塔台答覆`，刻意不以 `提問` 結尾）→ exit 0，`  question: q-a260fceb-c7d821fa93794a51` / `  notified: yes`。
   - 塔台 MCP `bat_list_questions`：`content` = `1 pending question: q-a260fceb-c7d821fa93794a51 (T0611, T0611-QTEXT-4b1e 要部署到哪個環境？)`；`structuredContent.questions[0]` 含 `workorder: T0611`、`options`（兩個）、`detail: "T0611-DETAILTEXT-2f6a BAT_REMOTE_TOKEN=[REDACTED:batcap]"`、`blocking: true`、`status: pending`。
   - 塔台 MCP `bat_get_state {terminalId: Worker}`：`{"state":"blocked","blockedReason":"tower","source":"question","blockedDetection":"none","pendingQuestions":1,…}`。
   - DOM：`.thumbnail[data-workorder="T0611"] .worker-badge` 文字 `?`、`data-attention="question"`、class 含 `question`；塔台右鍵「關閉已回報的 Worker 分頁（0）」且 disabled（通知本身會記 `workerReport`，所以 `?` 與 N = 0 只可能來自結構化問題）。
2. Worker MCP `bat_wait_question {timeoutMs: 40000}` 先開（2 s 後仍無結果）→ 塔台 `bat-terminal --answer <id> --notify-id $BAT_TERMINAL_ID --choice 1`（stdin 答覆文字）→ exit 0，`✓ Question answered: <id>` / `  answered: <id>`。
   - Worker 收到：`status=answered after 2055 ms` / `choice: 1` / 答覆全文；`structuredContent` `{changed: true, status: answered, answer: {choice: 1, text: …}, waitedMs: 2055}`。
   - Worker `bat_get_state`（自己）：`{"state":"working","source":"output","pendingQuestions":0,…}`（無 `blockedReason`）；塔台看 Worker 同樣 `pendingQuestions: 0`、`bat_list_questions` = `0 pending questions`。
   - DOM：`.worker-badge.reported` = `✓`；N = 1。
3. 第二題（通知 `T0611 提問`）→ 徽章 `data-attention="question"`、N = 0 → 塔台 `--close-worker T0611` → exit 0、分頁剩 1 → 塔台 `bat_list_questions {status: all}`：`2 questions: q-…c7d821fa93794a51 (T0611, answered, …); q-…5a76135b0ddd8f3f (T0611, cancelled, …)`，第二題 `endReason: worker-exited`；`status: pending` = 0。
4. 第二個 Worker（T0612）提問 `q-a260fceb-35dfc54972768185` → BAT 結束保留 Terminal Server → 同 runtime 重開、Recovery 選「保留」、`[helper-cap] kept restored`、Terminal Server pid 不變 → Worker（新 port）：`--cancel-question` exit 0 / `✓ Question already ended: …` / `  status: lost` / stderr 空；`--wait-answer` exit 0 `{"changed":true,"status":"lost","waitedMs":0}`；MCP `bat_get_state` `pendingQuestions: 0`、`bat_wait_question` `status=lost after 0 ms`；塔台 `--answer` exit 3、stderr `answer: LOST`；`bat_list_questions {status: all}` = `[]`。（可選項目已做到。）
5. 日誌：debug 日誌有 `[attention] terminal=<w1> → blocked reason=tower pendingQuestions=1 windows=1`、`→ none windows=1`、`[tower-question] answer q=q-a260fceb-c7d821fa93794a51 by=e2e-t0611-tower len=31 choice=1 → ok`、`[tower-question] end q=… → cancelled (worker-exited)`、`[tower-question] cancel q=q-a260fceb-35dfc54972768185 by=… → ok status=lost`；兩次啟動的 debug 日誌與 `bat-scripts.log` 都**不含**問題、選項、detail、答案文字、假權杖（11 個標記逐一斷言）。

**CLAUDE.md 兩節最終文字**

「## Worker 問塔台（PLAN-048 / T0607）」（9 行，標題未改）：

```markdown
- 用途：yolo Worker 以結構化通道問塔台、等答覆，取代 CT 的工單檔往返（D155 / D156）。
- **契約**（T0606 回報區「介面契約草案」C-1–C-11，CT-T019 依此撰寫，不得單方更改）：channel `question:ask` / `question:cancel`（worker）、`question:answer`（tower，`towerId` 綁定自己）、`question:list` / `question:wait`（唯讀，≤ 45 s）；id `q-<boot>-<rand>`，BAT 重開後回 `lost`；Worker 有 blocking 待答問題時 state = `blocked` / `blockedReason: tower` / `source: 'question'`，每個 state 回傳帶 `pendingQuestions`。
- 唯一實作 `electron/tower-questions.ts`（store + `registerTowerQuestionHandlers`，本機與 headless 共用、不 import electron）；狀態合成在 `terminal-query-handlers.ts` `stateOf`（`getQuestionSummary`）；PTY 結束經 `onPtyExit`、Terminal Server recovery 經 `PtyManagerDeps.onServerRecovery` 取消問題。
- helper（T0608，契約 C-5，唯一實作 `scripts/bat-notify.mjs` / `scripts/bat-terminal.mjs`）：Worker `bat-notify.mjs --ask --source T#### --target "$BAT_TOWER_TERMINAL_ID" [--submit] "T#### 提問" < question.json`（exit `0` / `3` / `10` TOO_MANY_QUESTIONS / `1`；notify 任一步失敗 → 先 `question:cancel` 再 exit 1）、`--wait-answer <id>`（stdout 一行 JSON，任何狀態含 `lost` 都 exit 0）、`--cancel-question <id>`（已結束與 `lost` 也 exit 0：🔴 看 `status:` 行，`cancelled worker` 才是取消了，T0611）；塔台 `bat-terminal.mjs --answer <id> --notify-id "$BAT_TERMINAL_ID" [--choice <n>] < answer.txt`（`0` / `3`（含 `answer: LOST`）/ `4` / `9` CLOSED / `1`）。
- 🔴 BAT MCP 維持全唯讀：只有 `bat_list_questions` / `bat_wait_question`（invoke 逾時 55 s），不得新增問答寫入 tool（D155 / D156），所有 tool `readOnlyHint: true`（`bat-mcp.test.mjs` 斷言）。
- 🔴 問題 / 選項 / detail / 答案只存在主行程記憶體、收件即 `redactTerminalSecrets`，**不寫入任何檔案**；`[tower-question]` 日誌與 bat-scripts.log 只記 id / 長度 / 數量 / 結果，永遠不記內容與權杖。
- 🔴 helper 的問題 / 答案內容只從 stdin 讀（UTF-8、≤ 64 KiB），不得放 argv（helper 把完整 argv 寫進 bat-scripts.log）；helper 日誌只記 id / 長度 / 選項數 / choice / 結果。
- 🔴 使用者在 Worker 分頁輸入**不清除** `tower`、不取消問題（中斷後由 120 s 租約到期 `expired` / `not-polled`）。
- 完整契約、helper / MCP 細節、限制常數、結束原因、日誌、已知限制、驗證清單（含 e2e `e2e/t0611-tower-question.spec.ts`）：[docs/agent-guide/tower-questions.md](docs/agent-guide/tower-questions.md)
```

「## BAT MCP shim（PLAN-047 M1 / T0584）」第一行（其餘不變）：

```markdown
- `scripts/bat-mcp.mjs` 是 stdio MCP server（零依賴），8 個唯讀 tool 轉接 helper channel，以分頁自己的範圍權杖認證；T0608 起含 `bat_list_questions` / `bat_wait_question`，全部唯讀，問答寫入只走 helper。Settings「BAT MCP」`batMcpEnabled` 預設開（D152）。
```

CLAUDE.md 大小 51 992 bytes（目標 ≤ 100k）。

### 互動紀錄

無（`CT_MODE=yolo`、`CT_INTERACTIVE=0`；沒有向塔台或使用者提問）。

### 遭遇問題

- 無阻擋。觀察（未改，供參考）：
  - 答覆後 Worker 的 state 是 `working`（不是 `idle`），因為 `idleMs` 尚未超過 idle 門檻；工單要求的「離開 `blocked`、`pendingQuestions: 0`」成立，e2e 斷言寫成 `state !== 'blocked'` 與無 `blockedReason`。
  - 結構化問題答完後，如果 Worker 的通知訊息是 CT 的 `T#### 提問`，renderer 的舊 CT 後備 `workerQuestion` 仍會讓徽章保持 `?`，直到下一個 notify（T0609 設計，`markWorkerReported`「the next notify replaces it」）。CT 照慣例在答覆後會再 notify（完成 / 提問），實務上不影響；e2e 步驟 1–2 因此用不以 `提問` 結尾的訊息隔離出結構化路徑。若希望答覆後立即清掉舊 CT 的 `?`，需另開單（動 renderer，不在本單範圍）。
  - 重開時 `app.close()` 20 s 內沒回（T0575 / T0576 已知），測試照 t0576 做法結束 Electron 程序；之後 Terminal Server 與 userData 均已清理（`alive after teardown: false`、`runtime userData removed: true`）。
- 合規：未改 `electron/**` 與主行程契約；未 push / 未建 tag / 未改版號 / 未觸發 workflow；未使用 `git stash` / `reset` / `checkout -- <path>` / `restore`；寫檔皆 LF（`git ls-files --eol` 確認）；e2e 只用隔離實例；`src/styles/settings.css` 未碰。過程中一次以 heredoc 寫入 `\r?\n` 被 shell 轉壞（L129 情境），已改以檔案內容重寫修正，未進 commit。

### 回報時間

2026-10-18T07:15:01+0800
