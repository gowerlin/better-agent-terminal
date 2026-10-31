---
schema_version: 1
schema_kind: workorder
id: T0716
title: "`bat-notify.mjs --ask --no-pty-write` 列為正式契約（文件＋守門測試），並修 `--ask` 的兩個小缺口（`terminal:notify` 回 false 被當成功、keypress 失敗時 stderr 誤導）"
type: implementation
status: PENDING
repo: better-agent-terminal
project: ""
priority: P2
sizing: S
created_at: "2026-11-01T01:41:52+0800"
depends_on: [T0715]
related:
  - "T0715 研究（`97a64056`）回報區：〈建議方向〉B1 第 1–4 點、〈調查結論〉Q-B3「BAT 端可選的小改進」、驗證紀錄 A1–A7（本單的需求來源，先讀）"
  - "D190（使用者 2026-11-01 決定：B1＋兩個小修；Q-B2 / Q-B4 不做）"
  - "BMad-Guide 塔台 HANDOVER `_handover-2026-11-01-bat-ask-no-pty-write-contract.md`（CT v5.15.0 依賴此契約）"
  - "CLAUDE.md「Worker 問塔台（PLAN-048 / T0607）」節（契約 C-5）、`docs/agent-guide/tower-questions.md`、`docs/agent-guide/remote-tower-notify.md`"
affects_files:
  - scripts/bat-notify.mjs
  - scripts/__tests__/bat-notify-questions.test.mjs
  - electron/__tests__/terminal-handlers.test.ts
  - "tests/bat-notify-submit.test.mjs（只在既有斷言因 stderr 改字需要同步時）"
  - "electron/remote/__tests__/headless-remote-tower-e2e.test.ts（選用：塔台 PTY 不含通知字串的整合斷言）"
  - CLAUDE.md
  - docs/agent-guide/tower-questions.md
  - docs/agent-guide/remote-tower-notify.md
  - _ct-workorders/T0716-ask-no-pty-write-contract-guard.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 1 契約文件（T0715 B1 第 1、2 點）：`docs/agent-guide/tower-questions.md` 的 `--ask` 語法改成 `[--submit | --no-pty-write]`，流程補「`--no-pty-write` 時只有 `question:ask` → `terminal:notify`」，並寫明保證：`terminal:notify` 只發 `terminal:notified`（toast、徽章、Worker 分頁標記），不寫任何 PTY、不切換分頁或焦點、不觸發 agent 回合；`notified: yes` 表示 BAT 已接受通知，不表示有視窗顯示（headless 無 client 也回 yes）。CLAUDE.md「Worker 問塔台」節 helper 那一行語法補 `[--no-pty-write]`，加一條 🔴「`terminal:notify` 不得寫 PTY（CT v5.15.0 的批次提問依賴）」；`docs/agent-guide/remote-tower-notify.md` worker 列補同一句。CLAUDE.md 只改該節、維持節長原則（CLAUDE.md 撰寫規則），`##` 標題不改名。"
  - "🔴 2 守門測試（T0715 B1 第 3 點）：`bat-notify-questions.test.mjs` 斷言 `--ask --no-pty-write` 的 channel 恰好是 `['question:ask', 'terminal:notify']`、stdout 與 `--submit` 同格式（含 `notified: yes`）、exit 0，且旗標順序對調結果相同；`terminal:notify` 回 error → `question:cancel`、exit 1。`terminal-handlers.test.ts` 斷言 `terminal:notify` 不呼叫 PtyManager（`getPtyManager` / `write` / `writeWithResult` 等 spy 次數 0）。`--help` 的 `--ask` 段補「可搭 `--no-pty-write`」並在既有 help 測試斷言。"
  - "🔴 3 小修 A（T0715 A5）：`--ask` 下 `terminal:notify` 回 `false`（handler 拒絕 payload）也當失敗 → `question:cancel`、exit 1、`ask: NOTIFY_FAILED`；加測試。一般 notify（非 `--ask`）對 `false` 的處理：維持現況或一併修，由 Worker 依既有測試與 C-5 判斷，回報區寫明理由；改變一般 notify 的 exit code 屬契約變更 → 不改，回報 PARTIAL 交塔台。"
  - "🔴 4 小修 B（T0715 Q-B3）：`--ask` 的 `failAfterAsk` 依失敗步驟改 stderr：keypress 階段失敗時說明「預填已寫入塔台輸入框、Enter 沒送出，題目已取消」，不再說 Tower 沒收到通知；notify / pty:write 階段失敗維持原意。另在既有 `ask: NOTIFY_FAILED` 行之外**新增**一行可機讀的 `ask: NOTIFY_STEP <notify|pty-write|keypress>`（不改、不刪既有任何一行，exit code 不變），寫進 docs 與 CLAUDE.md（C-5 的向後相容擴充）。stdout 不變。"
  - "🔴 5 行為不變：除上述 3、4 外，`bat-notify.mjs` 其他模式（一般 notify、`--wait-answer`、`--cancel-question`）、exit code、stdout 格式、channel 順序、`SUBMIT_KEYPRESS_DELAY_MS`、權杖範圍（`HELPER_CHANNEL_ROLES` / `HELPER_PTY_WRITE_FORBIDDEN`）、主行程 `terminal:notify` / `pty:write` / `terminal:keypress` handler 都不改。不新增 MCP tool。"
  - "🔴 6 helper 規則：問題 / 答案內容只從 stdin 讀、日誌不記內容與權杖（CLAUDE.md「Worker 問塔台」）；跑 helper 測試時 `BAT_HELPER_LOG_DIR`、`BAT_USER_DATA` 指到 scratchpad。不得對本塔台或其他分頁呼叫 `bat-notify.mjs --ask` 做實測（用 `scripts/__tests__/_question-mock-remote.mjs` 等 mock）。"
  - "🔴 驗證：`npm run test:unit` 全綠、`npm run test:legacy` 全綠（`tests/bat-notify-*.test.mjs` 有改時必跑）、`npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npx vite build` 成功、`npm run verify:helpers` 通過。README / CHANGELOG 不改（發版時塔台處理）。"
  - "🔴 公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」。yolo：不得問使用者；判讀問題依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。Git：只用 `git commit --only` commit `affects_files`；不 push。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
---

# T0716 — `--ask --no-pty-write` 列為正式契約＋兩個小修

## 元資料

- **工單編號**：T0716
- **類型**：implementation
- **優先級**：P2
- **建立時間**：2026-11-01T01:41:52+0800
- **預估規模**：S

## 目標

CT v5.15.0 會把「一批 N 題時前 N-1 題用 `bat-notify.mjs --ask --no-pty-write`、最後一題 `--submit`」寫進規格。T0715 確認 BAT 現況就是這樣運作，但沒寫進契約、沒有守門測試。本單把它變成 BAT 的正式契約，並修 T0715 找到的兩個小缺口。詳細需求見 frontmatter `memory_overrides` 1–6，證據與檔案:行號見 T0715 回報區。

## 驗收條件

1. docs / CLAUDE.md / `--help` 寫明 `--ask --no-pty-write` 的語法、呼叫順序與「`terminal:notify` 不寫 PTY」保證。
2. 守門測試：`--ask --no-pty-write` 的 channel 序列；`terminal:notify` handler 不碰 PtyManager。
3. `--ask` 下 `terminal:notify` 回 `false` → 取消題目、exit 1。
4. keypress 階段失敗時 stderr 不再誤導，並多一行 `ask: NOTIFY_STEP keypress`；既有輸出行與 exit code 不變。
5. 驗證項目全綠（見 memory_overrides「驗證」）。

## 不做

- 不加 `pty:write` / keypress 佇列或去抖動（D190 Q-B2）。
- 不做一次 `--ask` 帶多題（D190 Q-B4）。
- 不由 BAT 清除塔台輸入框的預填（D190 Q-B3）。

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

### 修改檔案

### 驗證紀錄

### 遭遇問題

### 回報時間
