---
schema_version: 1
schema_kind: workorder
id: T0715
title: "研究：`bat-notify.mjs --ask --no-pty-write` 能否當成支援的契約，以及 `--ask --submit` 半途失敗時的預填殘留（回覆 BMad-Guide 塔台 HANDOVER Q-B1–Q-B4，只查不修）"
type: research
status: DONE
repo: better-agent-terminal
project: ""
priority: P1
sizing: S
created_at: "2026-11-01T01:31:56+0800"
started_at: "2026-11-01T01:33:09+08:00"
updated_at: "2026-11-01T01:40:04+08:00"
completed_at: "2026-11-01T01:40:04+08:00"
depends_on: []
related:
  - "BMad-Guide 塔台 HANDOVER（CT 維護方）：`D:\\ForgejoGit\\@Gower_Labs\\BMad-Guide\\_ct-workorders\\_handover-2026-11-01-bat-ask-no-pty-write-contract.md`（BMad-Guide commit `647e9a9`）；CT D492–D494、CT T0383（研究，`ea92dd2`）、CT T0384（CT v5.15.0 實作）"
  - "PLAN-048 / T0607 / T0608 / T0611：Worker 問塔台（`question:ask` / `cancel`、`bat-notify.mjs --ask`、`--cancel-question`）；CLAUDE.md「Worker 問塔台」節、`docs/agent-guide/tower-questions.md`"
  - "PLAN-036 K / T0420 / T0575：helper 範圍權杖（`HELPER_CHANNEL_ROLES`、`authorizeHelperInvoke`，`electron/remote/helper-capability.ts`）；CLAUDE.md「遠端 Tower 通知」節"
  - "T0609 / BUG-153：Worker 標籤 `?`（舊 CT 通知結尾 `提問` → `workerQuestion`）、`terminal:attention-changed`"
affects_files:
  - _ct-workorders/T0715-research-ask-no-pty-write-contract.md
  - "_ct-workorders/_report-T0715-ask-no-pty-write-contract.md（回報太長時另寫，選用）"
renew_count: 0
workdir: main repo
worker_question_timeout: 30
research_max_questions: 3
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 只查不修：不改任何產品程式、測試檔、`package.json`、CI 設定、CLAUDE.md、docs。暫存檔與除錯輸出一律放 Worker 的 scratchpad。"
  - "🔴 結論要有證據：每個「現況是 X」都附檔案:行號、測試名稱或實測紀錄；推論與事實分開標示（【推論】）。結論以 `main` 目前的原始碼為準，並註明與已安裝 `0.7.2-pre.3` 是否相同（`scripts/` 對照可用 diff / 雜湊，L127，不用 grep 判版）。"
  - "🔴 可以用隔離實例實測（沿用 e2e 的隔離 userData 做法，需先 `npx vite build`），但不得碰使用者正在用的 BAT、已安裝的 BAT 與使用者的 userData；不得對其他分頁（含本塔台與其他 Worker）送任何輸入，也不得從本 Worker 分頁呼叫 `bat-notify.mjs --ask` 打到本塔台。若某項只能在使用者的 BAT 上才看得到，寫進回報的「待實機確認」，不執行。"
  - "🔴 可以自己開唯讀子代理平行讀程式碼；回報區要有「子代理使用」紀錄：幾個、做什麼、約多少 tokens（讀不到就寫怎麼估的）。不使用 Workflow 工具（本單沒有授權）。"
  - "🔴 跑 helper 相關測試時，`BAT_HELPER_LOG_DIR`、`BAT_USER_DATA` 指到 scratchpad（CLAUDE.md 規則）。"
  - "🔴 不寫回覆稿、不通知 BMad-Guide 塔台：`_reply-2026-11-01-bat-ask-no-pty-write-contract.md` 與跨 session 通知由本塔台依本單結論處理。"
  - "🔴 公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」，回報只用代稱，不寫真名、家目錄路徑或權杖。"
  - "🔴 yolo：不得問使用者；判讀問題依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。Git：只用 `git commit --only` commit `affects_files`；不 push。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
---

# T0715 — 研究：`--ask --no-pty-write` 契約與 `--ask --submit` 半途失敗的預填殘留

## 元資料

- **工單編號**：T0715
- **類型**：research（只查不修）
- **優先級**：P1（Q-B1 阻塞 CT v5.15.0 發布）
- **建立時間**：2026-11-01T01:31:56+0800
- **預估規模**：S

## 研究目標

CT 維護方（BMad-Guide 塔台）要在 CT v5.15.0 讓 yolo Worker 一批問 N 題時，前 N-1 題用 `bat-notify.mjs --ask --no-pty-write`（只登記題目、顯示 toast，不預填、不按 Enter），只有第 N 題 `--ask --submit` 叫醒塔台。CT 要把這個組合寫進規格當契約，請 BAT 確認。本單要提供塔台回覆所需的證據與建議：

1. **Q-B1（阻塞）**：`--ask --no-pty-write` 是不是 BAT 支援、可承諾的組合？`terminal:notify` 是否只做 UI 通知（toast、徽章、`?` 標籤等），保證不寫目標 PTY？
2. **Q-B2**：`pty:write` / `terminal:keypress` 目前有沒有佇列、合併或去抖動？若日後要加，對 CT 的做法有什麼影響（只描述現況與風險，是否要加由使用者決定）。
3. **Q-B3**：`--ask --submit` 在 `pty:write` 成功、`keypress` 失敗時，預填文字留在塔台輸入框，之後的一般 `T#### 提問 --submit` 疊在後面。現況確認 + BAT 端可行的修法（例如 `failAfterAsk` 時清掉預填）與風險，或建議改由 CT 處理。
4. **Q-B4**：一次 `--ask` 帶多題的批次介面：可行性、要動的契約與檔案、粗估規模（只評估，是否要做由使用者決定）。

## 已知資訊

- CT T0383 在 BAT `0.7.2-pre.3` 的驗證（HANDOVER § 2）：已安裝的 `bat-notify.mjs` 只在 `ptyWrite` 為真時才 `pty:write`；`terminal:notify` handler 只 emit `terminal:notified` 給 renderer；實驗 `--ask --no-pty-write` exit 0、`notified: yes`，取消後 `cancelled worker`，塔台分頁的 `lastOutputAt` 沒變。【待本單以原始碼與測試確認】
- 問答契約：CLAUDE.md「Worker 問塔台（PLAN-048 / T0607）」節（C-5：`--ask` 的 exit `0` / `3` / `10` / `1`；notify 任一步失敗 → 先 `question:cancel` 再 exit 1）。
- `--no-pty-write` 是否寫在 CLAUDE.md / `docs/agent-guide/tower-questions.md` / `remote-tower-notify.md` / helper `--help` 的契約裡，目前塔台不確定。

## 調查範圍

1. **`bat-notify.mjs` 的旗標組合**：`--ask` 與 `--no-pty-write` / `--submit` / 預設（預填不送出）的每種組合，實際依序呼叫哪些 channel（`question:ask` → `terminal:notify` → `pty:write` → `terminal:keypress` …）、失敗時的處理（`failAfterAsk` 等）、exit code、stdout / log。有沒有互斥檢查或未定義的組合。
2. **`terminal:notify` 的主行程與 renderer 路徑**：handler（本機與 headless）做了什麼；renderer 收到 `terminal:notified` 後做了什麼（toast、`workerQuestion` / `?` 標籤、焦點切換、聲音……），有沒有任何路徑會寫 PTY、切換 active 分頁或觸發塔台 agent 的新回合。遠端（headless bat-server）行為是否相同。
3. **文件與測試現況**：`--no-pty-write` 在 CLAUDE.md、docs、helper 說明、測試（`scripts/__tests__`、`tests/bat-*.test.mjs`、e2e t0611 等）中的涵蓋度。若要列為正式契約，需要補哪些文件 / 測試（列清單，不實作）。
4. **`pty:write` / `terminal:keypress` 的排程現況**（Q-B2）：本機與 headless 是否直接寫、有無佇列、`holdInputForDispatch` / `writeDispatchCommand`（BUG-151）等既有機制對這兩個 channel 的影響。
5. **Q-B3 的失敗路徑**：`pty:write` 成功、`keypress` 失敗時的實際狀態；BAT 能否可靠地「清掉預填」（例如送 Ctrl+U / Esc / 退格？對 claude CLI 與 codex 輸入框各自的效果與風險，特別是會不會誤刪使用者正在輸入的內容），或建議 CT 端怎麼處理。
6. **Q-B4 批次介面**：`question:ask` 改成接多題（或新 channel）的契約影響：權杖範圍、`pendingQuestions`、`TOO_MANY_QUESTIONS`（exit 10）上限、`bat_list_questions`、helper stdin 格式、MCP 唯讀政策。

## 研究指引

- 先讀 `scripts/bat-notify.mjs`、`electron/tower-questions.ts`、`terminal:notify` 的 handler 與 renderer 消費端、`electron/remote/helper-capability.ts`。
- 每題的結論寫成塔台可直接採用的一句話（例：「Q-B1：支援；保證範圍是 …；條件是 …」），再附證據。
- Q-B1 若結論是「現況如此但未列為契約」，請寫出要列為契約時 BAT 端最少要補的東西（文件段落位置、守門測試）。

## 互動規則

- yolo：不問使用者；判讀問題依 ct-exec § Questions For Tower 問塔台，每輪最多 3 題。
- 互動紀錄寫入回報區。

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

**DONE**（研究單，只查不修；Q-B1–Q-B4 均有結論與證據）

### 落點檢查

- **PASS**。C-0：frontmatter `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal` → PASS。C-1：工單在 `REPO_ROOT/_ct-workorders/` 下 → PASS。C-3：`affects_files` 只有 `_ct-workorders/` 項目 → not applicable。C-2：無 `branch` 欄位（實際 `main`）。
- `CT_HOME` 未設（非 worktree）。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）。`CT_MODE=yolo`、`CT_INTERACTIVE=0`。
- 結論依據：`main`（研究開始 `2e1f97c9`，收尾時 `6f2c16b9`；兩者之間沒有動到下列任何程式檔）。

### 互動紀錄

- 無。沒有需要塔台裁示的判讀問題，未提問；也未問使用者。

### 調查結論

#### 一句話結論（塔台可直接採用）

- **Q-B1**：**支援，且可以承諾**。`--ask --no-pty-write` 的實際呼叫只有 `question:ask` → `terminal:notify` 兩個 channel；`terminal:notify`（本機與 headless 同一個 handler）只 emit `terminal:notified` 事件，renderer 只做 toast、縮圖徽章、工作區徽章與 Worker 分頁標記，**沒有任何路徑寫 PTY、切換 active 分頁、搶焦點或觸發 agent 回合**。條件：`--no-pty-write` 不可與 `--submit` 並用（exit 1 `ask: USAGE`）；`notified: yes` 只代表 BAT 接受了通知事件，**不代表有視窗顯示了 toast**（沒有視窗 / headless 沒有 client 時一樣回 `notified: yes`）。**現況：行為如此、e2e 也在用，但沒寫進 `--ask` 的文件契約，也沒有守門測試**（要列為契約時 BAT 最少要補的東西見〈建議方向〉B1）。
- **Q-B2**：**現況沒有任何佇列、合併或去抖動**。`pty:write` 直接寫進 PTY（Terminal Server 模式是立即送 IPC / TCP），`terminal:keypress` 直接廣播、renderer 同步合成一個 Enter keydown。唯一例外是剛由 helper 派工、派工指令還沒寫入的新分頁（BUG-151 的 dispatch hold），塔台分頁實務上不受影響。`--no-pty-write` 不寫 PTY，日後就算加佇列也不影響它；會受影響的是 `--submit`（日後的佇列必須維持同一目標的 `pty:write` → `keypress` 先後順序）。
- **Q-B3**：**現況屬實**，而且 BAT **無法可靠地清掉預填**（BAT 看不到 agent 輸入框的內容；可用的按鍵各有誤刪或中斷塔台回合的風險；本機最常見的 keypress「失敗」是 3 s 逾時，Enter 可能其實已送達）。**建議由 CT 處理**：塔台判讀通知時以工單 ID 樣式比對字串**結尾**的最後一個 `<ID> <關鍵字>`，不比對整行。BAT 端可以做的低風險改進：失敗時的 stderr 講清楚「預填已寫入、Enter 沒送出」（目前會誤說 Tower 沒收到通知）。
- **Q-B4**：**可行，建議現在不做**。最小做法只改 helper（stdin 接 JSON 陣列、逐題 `question:ask` 後通知一次），規模 S；做成主行程原子性的新 channel 規模 M。CT v5.15.0 已經用現有參數做到「叫醒一次」，批次介面的增益只剩少幾次 helper 呼叫。

#### Q-B1 證據：`--ask` 的旗標組合與呼叫順序

| 組合 | 呼叫的 channel（依序） | 失敗處理 | 證據 |
|---|---|---|---|
| `--ask --no-pty-write` | `question:ask` → `terminal:notify` | `terminal:notify` 回 error → `question:cancel` → exit 1 `ask: NOTIFY_FAILED` | 實測 A1 / A4 / A7；`scripts/bat-notify.mjs:944-968`、`:981`（`if (ptyWrite)` 包住 Step 2/3） |
| `--ask`（預設：預填不送出） | `question:ask` → `terminal:notify` → `pty:write` | 任一步失敗 → cancel → exit 1 | 實測 A2；既有測試 `bat-notify-questions.test.mjs`「asks, then notifies …」 |
| `--ask --submit` | `question:ask` → `terminal:notify` → `pty:write` → （等 250 ms）→ `terminal:keypress` | 任一步失敗 → cancel → exit 1 | 實測 A3 / A6；`scripts/bat-notify.mjs:1037-1090`、`SUBMIT_KEYPRESS_DELAY_MS = 250`（`:46`） |
| `--ask --submit --no-pty-write` | 不連線 | exit 1、stderr `--submit and --no-pty-write are mutually exclusive` + `ask: USAGE` | `scripts/bat-notify.mjs:354-359`；既有測試 `bat-notify-questions.test.mjs:346` |

- 旗標位置不影響（`--no-pty-write` 放在 `--ask` 前後都一樣，實測 A7）；第一個非旗標參數之後全部視為訊息（`:248-254`）。
- stdout（A1 實測）：`✓ Notified tower-1…: T0715 提問` / `  question: <id>` / `  expires: <ISO>` / `  notified: yes`，與 `--submit` 完全相同。
- `--ask` 下 `terminal:notify` 的失敗**只看 frame 的 `error`**（`:961`）；handler 回 `false`（payload 不合法）會被當成成功（實測 A5：exit 0、`notified: yes`）。【推論】實務上走不到：helper 送出前已檢查 target 與非空訊息（`:361-374`），handler 回 `false` 只在 `targetId` / `message` 為空時（`electron/handlers/terminal.ts:153-161`）。列為守門時可順手補上（見 B1 第 4 點）。
- **`terminal:notify` handler**（`electron/handlers/terminal.ts:138-178`，Electron `electron/main.ts:2408` 與 headless `electron/remote/headless-entry.ts:530` 都經 `registerTerminalHandlers` 註冊同一份）：檢查 payload → `deps.emit('terminal:notified', { targetId, message, source, questionId? })` → 寫日誌 → `return true`。**沒有使用 `getPtyManager`**。Electron 的 emit 送給每個視窗 + broadcastHub（`:97-112`）；headless 的 emit 只送 broadcastHub、固定回 0（`headless-entry.ts:533-536`），**沒有「無 client」檢查**（這點與 keypress 的 `no-client` 不同）。
- **renderer 消費端**：`terminal:notified` 只有一個 listener，`src/App.tsx:510-537`：`markNotified`（縮圖徽章，`src/stores/terminal-notifications.ts:27-31`，只改 Set 並通知訂閱者）、`workspaceStore.markWorkerReported`（`src/stores/workspace-store.ts:681-702`，只改 Worker 分頁的 `workerReport` / `workerQuestion` 並 `save()`；`--ask` 帶 `questionId` → kind `ask`，只清除兩者）、目標不在 active 工作區時 `markWorkspaceNotified`、加一則 6 s 的 toast（點 toast 只會關閉它，`src/App.tsx:1396`）。徽章的訂閱者 `Sidebar.tsx:775-778`、`TerminalThumbnail.tsx:171-215` 只更新顯示狀態（切到該分頁時才清除徽章）。**沒有 `pty.write`、`setActiveTerminal`、`focus` 或任何會讓塔台 agent 開新回合的呼叫**。
- **遠端（headless）**：`terminal:notified` 在 `PROXIED_EVENTS`（`electron/remote/protocol.ts:118`），client 的 `remote-client.ts:519-529` 原樣轉給本機視窗 → 同一個 `App.tsx` handler，行為相同。
- **權杖**：`terminal:notify` 只給 `worker` 角色，target 必須是綁定的塔台（`electron/remote/helper-capability.ts:402`、`:667-672`）；被拒時回 frame `error` → `--ask` 會取消題目並 exit 1。
- `question:ask` 本身也不寫 PTY：`electron/tower-questions.ts` 只維護記憶體 store，變更經 `onChange` → `terminal:attention-changed`（Worker 分頁的 `?`，`electron/main.ts` `onChange: (workerId) => terminalAttention?.refresh(workerId)`）。
- **與已安裝 `0.7.2-pre.3` 相同**：`<安裝目錄>/resources/package.json` version = `0.7.2-pre.3`；`bat-notify.mjs`、`_bat-logger.mjs`、`_bat-cert.mjs` 與 `main` 的 SHA-256 完全相同（`8d3bce80…e90b`、`7e136c72…e739`、`e69e9552…bb8`）；`git log v0.7.2-pre.3..HEAD` 對下列檔案沒有任何 commit：`scripts/bat-notify.mjs`、`electron/handlers/terminal.ts`、`electron/handlers/pty.ts`、`electron/remote/helper-capability.ts`、`electron/tower-questions.ts`、`electron/pty-manager.ts`、`electron/remote/protocol.ts`、`electron/remote/remote-client.ts`、`electron/terminal-server/server.ts`、`src/App.tsx`、`src/components/TerminalPanel.tsx`、`src/stores/terminal-notifications.ts`、`src/stores/workspace-store.ts`、`src/lib/terminal-attention.ts`。所以 CT T0383 在已安裝版上的觀察與本單的原始碼結論一致。

#### Q-B1 證據：文件與測試涵蓋度

| 位置 | `--no-pty-write` 的現況 |
|---|---|
| `bat-notify.mjs --help`（`:118-120`、`:129-131`） | 有列 `--no-pty-write`（UI only、與 `--submit` 互斥）；`--ask` 段說 `<message>` 以一般 notify 送出（toast、pre-fill、`--submit`），**沒有明講 `--ask` 可搭 `--no-pty-write`** |
| CLAUDE.md「Worker 問塔台」節（`CLAUDE.md:330`） | 語法只寫 `[--submit]`，沒有 `--no-pty-write` |
| `docs/agent-guide/tower-questions.md:114`、`:118` | 語法只寫 `[--submit]`；流程寫成 `question:ask` → `terminal:notify` → `pty:write` → `--submit` 時 `terminal:keypress`，沒有寫 `--no-pty-write` 時省略 `pty:write` |
| `docs/agent-guide/remote-tower-notify.md:5`、`:12` | 只寫 worker 可用的三個 channel，沒寫 `terminal:notify` 不寫 PTY |
| 單元測試 | `tests/bat-notify-auth-reject.test.mjs:303-319` 斷言**一般 notify** `--no-pty-write` 只呼叫 `terminal:notify`；`bat-notify-questions.test.mjs:62` 一般 notify；`:346` `--ask --submit --no-pty-write` 互斥。**沒有 `--ask --no-pty-write` 的 channel 順序斷言** |
| handler 測試 | `electron/__tests__/terminal-handlers.test.ts:453-468` 斷言 `terminal:notify` 只 emit `terminal:notified`（emit 清單完全相等），但沒有斷言「不呼叫 PtyManager」 |
| e2e / 整合 | `e2e/t0611-tower-question.spec.ts:273-277` 每次 `--ask` 都用 `--no-pty-write`（使用中、但沒斷言塔台 PTY 沒變）；`e2e/t0609-…:178`、`headless-remote-tower-e2e.test.ts:267` 是一般 notify |

#### Q-B2 證據：`pty:write` / `terminal:keypress` 的排程

- `pty:write` handler（`electron/handlers/pty.ts:103-113`，本機與 headless 共用）→ `PtyManager.writeWithResult`（`electron/pty-manager.ts:1525-1559`）：不存在 → `pty-not-found`；dispatch hold 中 → 暫存、回 `{ ok: true, reason: 'held-until-dispatch' }`；Terminal Server 模式 → `sendToServer` 立即送出、樂觀回 `{ ok: true, reason: 'queued' }`；direct → `process.write` 立即寫。Terminal Server 端 `writePty`（`electron/terminal-server/server.ts:306-314`）也是立即 `pty.write`。**沒有合併、去抖動或延遲**。
- **dispatch hold**（BUG-151 / T0598，`pty-manager.ts:1503-1516`、`:1531-1535`）：只套用在 helper 剛派工、派工指令還沒寫入的**新分頁**；派工指令一寫入就放行。【推論】塔台分頁是使用者開的（或很久以前派的），helper 對塔台的 `pty:write` 不會碰到它。
- **已知的寫入遺失**：Terminal Server 模式下若當下沒有 server 連線（recovery 中），`sendToServer` 只記 warn、資料丟掉（`pty-manager.ts:659-667`），但 `writeWithResult` 仍回 `ok: true, reason: 'queued'`（T0215 註明的技術債）。
- `terminal:keypress`（`electron/handlers/terminal.ts:182-250`）：驗 Enter → headless 時 `countRemoteReceivers` 為 0 回 `no-client` → 否則立即 emit。renderer（`src/components/TerminalPanel.tsx:625-632` → `dispatchEnter` `:590-623`）同步聚焦 xterm textarea 並合成一個 Enter keydown；找不到 textarea 只記日誌 `missing-xterm-helper-textarea`。**主行程回 `ok` 只代表事件已廣播，不代表 Enter 已送進 PTY**。
- 順序靠 helper 保證：每一步等回覆後才送下一步，`pty:write` 與 `keypress` 之間固定睡 250 ms（`bat-notify.mjs:1043`）。**不同 helper 程序之間沒有任何串行化**：【推論】兩個 Worker 同時 `--submit` 時，可能變成「W1 預填、W2 預填、W1 Enter」→ 塔台收到兩段相連的文字，W2 的 Enter 送出空行。這是既有風險；CT v5.15.0 的「前 N-1 題不預填」讓同一個 Worker 不會自己撞上這種情況。
- **日後若加佇列 / 合併對 CT 的影響**：`--no-pty-write` 不寫 PTY，不受任何佇列影響（CT v5.15.0 的做法不受影響）。會受影響的是 `--submit`：如果 `pty:write` 延遲超過 250 ms 而 keypress 沒有跟著排隊，Enter 可能比文字先到，變成 Q-B3 的殘留狀態。⇒ 若要加，必須維持「同一目標的 `pty:write` 與 `keypress` 先進先出」，而且 `pty:write` 回 ok 的意義（已排入且順序保證）要寫進契約。是否要加由使用者決定；本單沒有看到需要加的理由。

#### Q-B3 證據：`pty:write` 成功、`keypress` 失敗

- 現況屬實（實測 A6）：呼叫順序 `question:ask` → `terminal:notify` → `pty:write`（成功）→ `terminal:keypress`（`no-client`）→ `question:cancel` → exit 1、`ask: NOTIFY_FAILED`。預填的文字沒有被收回。**stderr 會印 `The Tower was not notified; question … was cancelled.`（`bat-notify.mjs:801`），但 toast 已顯示、預填已寫入**，這行字在 keypress 階段失敗時是誤導的。可分辨的訊號只有 stderr 第一行 `Error: terminal keypress failed: <reason>`（vs `Error: PTY write failed: …`）與 bat-scripts.log 的 `send` 事件，兩者都不是契約。
- 預填會疊在後面：`pty:write` 的內容是 `toPtyPrefill(message)`（控制字元壓成空白後 `trim()`，`:51-55`），**前後都不加分隔**。殘留 `T0715 提問` 之後再預填 `T0715 提問` → 輸入框變成 `T0715 提問T0715 提問`（【推論】依 agent 的游標位置，通常接在後面）。
- **什麼情況會發生**（keypress handler 對合法 payload 只有 headless 會主動回失敗）：
  - headless（遠端）：沒有任何 BAT client 連線 → `no-client`（最常見、確定 Enter 沒送）。此時 `terminal:notify` 與 `pty:write` 都成功，文字留在遠端塔台 PTY，client 重連後才看得到。
  - 本機 / headless：3 s 沒回覆（`waitForMessageById` 預設 3000 ms，`bat-notify.mjs:622-624`）、連線中斷、權杖在兩步之間被撤銷。【推論】**逾時時 Enter 可能其實已送達**，只是回覆遲到；這時塔台已被叫醒、題目卻已被取消。
- **BAT 能不能可靠地清掉預填：不能**。
  1. BAT 不知道輸入框的內容與游標位置。預填之後使用者可能已經開始打字，或塔台 agent 正在跑一個回合（輸入可能進 agent 的佇列）；主行程只看得到 PTY 輸出（畫面），不知道哪些字是預填。
  2. 可用的按鍵各有風險（【推論】未在 claude CLI / codex 上實測，見〈待實機確認〉）：Esc 在 claude CLI 會中斷正在跑的回合（連按兩下還會進入 rewind / 清除），codex 的 Esc 也有中斷語意；Ctrl+U 在 readline 類輸入是刪到行首，但多行輸入只刪目前這一行，**會連使用者打的字一起刪**；按 N 次 Backspace 只有在游標剛好在預填之後、且沒有人動過時才正確，否則刪到使用者的字。
  3. 逾時（Enter 可能已送達）時清除，會刪到之後才打的內容。
  4. 安全設計：worker 權杖的 `pty:write` 只收可列印文字（`HELPER_PTY_WRITE_FORBIDDEN`，`helper-capability.ts:532-538`、`:673-677`，T0450），正是為了讓 Worker「只能預填、不能送出 / 中斷 / 操控」塔台終端。要讓 helper 送 Ctrl+U / Esc 就得放寬這條，屬於安全退步；改成主行程代送也解決不了 1–3。
- **建議 CT 處理**（不需要 BAT 改程式）：
  1. 塔台判讀 Worker 通知時，以工單 ID 樣式比對字串**結尾**的最後一個 `<工單 ID> <關鍵字>`，例如 `((?:[A-Z][A-Z0-9]*-)?T\d{4,})\s*(完成|部分完成|需要協助|提問)\s*$`，不要求整行相符，也不要用 `\S+` 抓 ID（`\S+` 會抓到 `提問T0715`）。這樣殘留預填加上新的預填仍能判讀出最後一則。
  2. Worker 端看到 `ask: NOTIFY_FAILED` 時，把「預填可能已留在塔台輸入框」當成已知狀態（照 CT 現行規則改送一般 `提問 --submit` 即可；第 1 點讓塔台讀得懂）。
  3. 塔台被叫醒後一律以 `bat_list_questions` / 工單標記為準，不以通知字串判斷有幾題（逾時案例：塔台醒了、題目已取消）。
- **BAT 端可選的小改進**（是否做由使用者決定）：`failAfterAsk` 在 keypress 階段失敗時，stderr 改說「預填已寫入，Enter 沒送出」，並在 `ask: NOTIFY_FAILED` 之外加一行可機讀的 `ask: NOTIFY_STEP <notify|pty-write|keypress>`（新增一行、不改既有行，屬 C-5 的向後相容擴充）。規模 XS–S（helper + 測試 + docs）。

#### Q-B4 評估：一次 `--ask` 帶多題

| 方案 | 要動的地方 | 契約影響 | 規模 |
|---|---|---|---|
| **A：只改 helper**（stdin 接 JSON 陣列，逐題呼叫 `question:ask`，全部登記成功後通知一次） | `scripts/bat-notify.mjs`、`scripts/__tests__/bat-notify-questions.test.mjs`、`docs/agent-guide/tower-questions.md`、CLAUDE.md「Worker 問塔台」節、`--help` | C-5：stdin 格式（物件或陣列）、stdout 改成多行 `question:`（順序對應陣列）、中途被拒（例如第 k 題 `TOO_MANY_QUESTIONS`）時要定義「取消前面已登記的、exit 10」；64 KiB stdin 上限改成整批共用（或放寬）。舊 helper 收到陣列 → `ask: INVALID_INPUT`（`stdin JSON must be an object`，`:746`），CT 可以據此退回逐題 | S |
| **B：新 channel `question:ask-batch`**（主行程一次檢查上限、全有或全無） | A 的全部 + `electron/tower-questions.ts`、`HELPER_CHANNEL_ROLES`（`worker`）、`electron/remote/path-aware-channels.ts`（channel 覆蓋測試）、headless 同模組自動帶到；舊 BAT → `UNSUPPORTED` 退回逐題 | 新 channel 契約；`question:ask` 不變 | M |

- 不受影響：`pendingQuestions`（逐題計數）、`bat_list_questions`（逐題列出）、塔台 `--answer <id>`（逐題回答）、MCP 唯讀政策（批次是寫入，只走 helper，不新增 MCP tool，D155 / D156 不變）、權杖範圍（`question:ask` / 新 channel 都只給 `worker`，目標固定為綁定的塔台）。
- 上限：每個 Worker 同時最多 8 題待答、每個塔台 64 題（`electron/tower-questions.ts:52-53`、`:415-420`），批次最多 8 題（扣掉已待答的）。
- 建議：**現在不做**。CT v5.15.0 已用現有參數做到「只叫醒一次」；批次介面的增益只剩少幾次 helper 呼叫，以及「全部登記才通知」的原子性（方案 B 才有）。等 CT 回報 N-1 次 `--no-pty-write` 呼叫本身造成實際問題再開單。

#### 給 CT 的附帶提醒（與批次做法直接相關）

- **blocking 題目的 120 s 租約是逐題的**（`QUESTION_POLL_LEASE_MS = 120_000`，`electron/tower-questions.ts:56`）：登記時起算（`:444`），只有**該題**的 Worker `question:wait` 會續約（`:602-604`、`:631`），等 A 題不會替 B 題續約。一批 N 題時 Worker 要在 120 s 內對每一題都開始等待（同時最多 8 個 wait，`QUESTION_WAIT_MAX_PER_CALLER`；`--timeout-ms 0` 的 wait 也算一次輪詢），否則沒被等的題目會以 `expired` / `not-polled` 結束。CT v5.7.1「先送完所有 `--ask`，再在第一次成功 `--ask` 後 120 s 內開始等」的規則要確定是「每一題都在等」。
- 第 N 題 `--ask --submit` 失敗時，`failAfterAsk` 只取消第 N 題；前 N-1 題仍待答，而且塔台還沒被叫醒。CT 規格的「改送一般 `T#### 提問 --submit`」必須在這之後立刻做（否則前 N-1 題會因租約或到期結束）。

### 建議方向

**B1（Q-B1 列為正式契約，BAT 最少要補的東西；只補文件與測試，不改產品行為）**

1. `docs/agent-guide/tower-questions.md`「Worker 提問 `bat-notify.mjs --ask`」：語法改成 `[--submit | --no-pty-write]`；流程補「`--no-pty-write` 時只有 `question:ask` → `terminal:notify`」；加一條保證：「`terminal:notify` 只發 `terminal:notified`（toast、徽章、Worker 分頁標記），不寫任何 PTY、不切換分頁或焦點；`notified: yes` 表示 BAT 已接受通知，不表示有視窗顯示」。
2. CLAUDE.md「Worker 問塔台（PLAN-048 / T0607）」節 helper 那一行：語法補 `[--no-pty-write]`，並加一條 🔴「`terminal:notify` 不得寫 PTY（CT v5.15.0 的批次提問依賴）」；`docs/agent-guide/remote-tower-notify.md` worker 列補同一句。
3. 守門測試：
   - `scripts/__tests__/bat-notify-questions.test.mjs`：`--ask --no-pty-write` → channel 恰好是 `['question:ask', 'terminal:notify']`、stdout 四行、exit 0；`terminal:notify` 錯誤 → `question:cancel`、exit 1。
   - `electron/__tests__/terminal-handlers.test.ts`：`terminal:notify` 不呼叫 PtyManager（`getPtyManager` / `write` / `writeWithResult` 的 spy 次數 0）。
   - （選用）`electron/remote/__tests__/headless-remote-tower-e2e.test.ts` 或 `e2e/t0611-tower-question.spec.ts`：`--ask --no-pty-write` 之後塔台 PTY 的輸出 / buffer 不含通知字串。
   - `bat-notify.mjs --help` 的 `--ask` 段補一句「可搭 `--no-pty-write`」，並在 `--help documents the modes` 測試斷言它。
4. （選用、同單可做）`--ask` 下 `terminal:notify` 回 `false` 也當成失敗（實測 A5 的缺口）。
- 規模 S；建議開一張實作單（只動 docs / CLAUDE.md / 測試 / help 文字，行為不變），完成後 BAT 回覆 CT「Q-B1 已列為契約，自 BAT `<版號>` 起」。在那之前，回覆 CT「現況支援、行為與 `0.7.2-pre.3` 相同，可以寫進 CT 規格」不會有風險：程式行為從 T0608 / T0613 以來沒變過。

**B2**：不加佇列。若日後要加，契約加上「同一目標的 `pty:write` 與 `terminal:keypress` 先進先出」。

**B3**：BAT 不做清除預填；回覆 CT 建議塔台端以結尾 ID 樣式判讀（〈調查結論〉Q-B3 的「建議 CT 處理」）。BAT 端是否做 stderr / `ask: NOTIFY_STEP` 的小改進交使用者決定。

**B4**：現在不做；若要做，先做方案 A（只改 helper）。

### 建議下一步

1. 塔台依本單寫 `_reply-2026-11-01-bat-ask-no-pty-write-contract.md`，回覆 Q-B1「支援、可承諾」，並附上兩點條件（與 `--submit` 互斥；`notified: yes` 不代表有人看到）、Q-B3 的 CT 端建議、租約逐題的提醒。
2. 開實作單 B1（docs / CLAUDE.md / 守門測試 / help 文字，P2、S）。可合併 A5 修正與 Q-B3 的 stderr 改進（若使用者同意）。
3. Q-B2、Q-B4 不開單；記在回覆裡當作「目前不做」。

### 待實機確認（本單未執行）

- claude CLI 與 codex 輸入框對 Esc / Ctrl+U / Backspace 的實際效果（Q-B3 的風險描述是推論）：需要在使用者的 BAT 上、對塔台以外的測試分頁操作，本單不得對其他分頁送輸入。
- 隔離實例（e2e）實測「`--ask --no-pty-write` 後塔台 PTY 不變」：未跑。原因：原始碼路徑（handler 不碰 PtyManager）、handler 單元測試、mock 實測與 CT T0383 在已安裝版上的觀察（`lastOutputAt` 不變）已足夠回答 Q-B1；建議改由 B1 的守門測試長期保證。

### 驗證紀錄

- 原始碼 / 文件：如上各條檔案:行號（`main`）。
- mock 實測（scratchpad 腳本，用 repo 的 `scripts/__tests__/_question-mock-remote.mjs`，`TMP` / `TEMP` / `BAT_HELPER_LOG_DIR` / `BAT_USER_DATA` 指到 scratchpad，清掉本分頁的 `BAT_*`）：
  - A1 `--ask --no-pty-write` → exit 0，channel `question:ask`、`terminal:notify`，stdout 四行含 `notified: yes`
  - A2 `--ask` → `question:ask`、`terminal:notify`、`pty:write`，exit 0
  - A3 `--ask --submit` → 再加 `terminal:keypress`，exit 0
  - A4 `--no-pty-write` + `terminal:notify` error → `question:cancel`，exit 1，`ask: NOTIFY_FAILED`
  - A5 `--no-pty-write` + `terminal:notify` 回 `false` → exit 0、`notified: yes`（缺口）
  - A6 `--submit` + keypress `no-client` → `… pty:write、terminal:keypress、question:cancel`，exit 1，stderr `The Tower was not notified; …`
  - A7 旗標順序對調 → 與 A1 相同
- 既有測試：`npx vitest run scripts/__tests__/bat-notify-questions.test.mjs tests/bat-notify-auth-reject.test.mjs tests/bat-notify-submit.test.mjs electron/__tests__/terminal-handlers.test.ts electron/__tests__/local-helper-capability.test.ts electron/remote/__tests__/headless-helper-capability.test.ts electron/remote/__tests__/headless-helper-narrowing.test.ts` → **7 files / 156 tests passed**（輸出中的 `AttachConsole failed` 是 headless 測試 spawn PTY 時 node-pty conpty agent 的 stderr，不是失敗）。
- 已安裝版比對：SHA-256 與 `git log v0.7.2-pre.3..HEAD`（見 Q-B1 證據最後一條）。
- 沒有建 build、沒有跑 e2e、沒有碰使用者的 BAT / userData / 其他分頁、沒有從本分頁呼叫 `bat-notify.mjs --ask`。

### 子代理使用

- 未使用子代理，也未使用 Workflow 工具。所有讀檔與實測由主 Worker 自己做。

### Renew 歷程

- 無。

### 遭遇問題

- 無阻塞。第一次跑 mock 腳本時 Git Bash 的 `pwd` 給了 `/d/...` 形式，Node 解析成 `D:\d\...`，改用 `pwd -W` 後正常（只影響 scratchpad 腳本）。

### commit

- 只 commit 本工單檔（`git commit --only`），沒有產品變更，沒有 push。

### sprint-status.yaml 已更新

- 不適用（本單沒有 sprint 綁定）。

### 回報時間

2026-11-01T01:37:57+0800（回報撰寫）
