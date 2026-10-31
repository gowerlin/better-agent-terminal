---
schema_version: 1
schema_kind: workorder
id: T0715
title: "研究：`bat-notify.mjs --ask --no-pty-write` 能否當成支援的契約，以及 `--ask --submit` 半途失敗時的預填殘留（回覆 BMad-Guide 塔台 HANDOVER Q-B1–Q-B4，只查不修）"
type: research
status: PENDING
repo: better-agent-terminal
project: ""
priority: P1
sizing: S
created_at: "2026-11-01T01:31:56+0800"
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
（DONE / PARTIAL / BLOCKED）

### 互動紀錄

### 調查結論

### 建議方向

### 建議下一步

### 子代理使用

### Renew 歷程

### 遭遇問題

### sprint-status.yaml 已更新

### 回報時間
