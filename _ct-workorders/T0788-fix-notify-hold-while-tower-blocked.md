---
schema_version: 1
schema_kind: workorder
id: T0788
title: "修正 BUG-196：塔台在等使用者回答（權限對話框 / AskUserQuestion / codex 審批）時，主行程先保留 helper 送來的通知（文字＋Enter），使用者答完、安靜 1 s 後再送；submit Enter 不算使用者輸入"
type: implementation
status: PENDING
repo: better-agent-terminal
project: maintenance
priority: P0
sizing: L
created_at: "2026-11-02T18:24:49+0800"
started_at: ""
updated_at: "2026-11-02T18:24:49+0800"
completed_at: ""
session_ids: []
depends_on: []
related:
  - "BUG-196（high，OPEN）；T0787 回報區〈調查結論 Q1〉〈建議方向 ②〉契約草案 v0（本單依此實作，第 5 / 9 / 10 點的塔台裁示見下方）〈建議下一步 ④ (1)〉；D227；PLAN-059 子項 A"
  - "`electron/handlers/pty.ts:104`（`pty:write`）、`electron/handlers/terminal.ts:182`（`terminal:keypress`）、`src/components/TerminalPanel.tsx:599`（`dispatchEnter`，`auto` 參數已存在，T0566 用量限制續行用）、`electron/terminal-blocked-state.ts`（`TerminalBlockedTracker`）、`scripts/bat-notify.mjs`（`SUBMIT_KEYPRESS_DELAY_MS`）、`electron/remote/headless-entry.ts`"
  - "排隊原則前例：T0769（Claude 面板背景子代理執行中送出訊息：提示待送、可取消、有上限）；CLAUDE.md「Sub-agent / Active Tasks Tracking」節"
  - "CLAUDE.md「Worker 問塔台」（🔴 `terminal:notify` 不得寫 PTY）、「blocked 狀態偵測」、「Worker 分頁回收」（使用者輸入取消 `--close-worker`）、「用量限制自動繼續」（`{ auto: true }` 不算使用者輸入）、「Dialog 不因點擊外部關閉」、「遠端 Tower 通知」節"
affects_files:
  - _ct-workorders/T0788-fix-notify-hold-while-tower-blocked.md
  - _ct-workorders/BUG-196-worker-notify-answers-blocked-tower-dialog.md
  - electron/notify-hold.ts
  - electron/handlers/pty.ts
  - electron/handlers/terminal.ts
  - electron/terminal-blocked-state.ts
  - electron/pty-manager.ts
  - electron/main.ts
  - electron/preload.ts
  - electron/remote/headless-entry.ts
  - src/components/TerminalPanel.tsx
  - src/components/TerminalThumbnail.tsx
  - src/stores/**
  - src/types/**
  - src/locales/**
  - electron/__tests__/**
  - src/**/__tests__/**
  - e2e/t0787-notify-into-blocked-tower.spec.ts
  - docs/agent-guide/notify-hold.md
  - docs/agent-guide/README.md
  - CLAUDE.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: decision-requiring
memory_overrides:
  - "🔴 契約（依 T0787 契約草案 v0，塔台裁示 D227）：① 觸發 = helper 經 RemoteServer 呼叫（有 `ctx.helper`）的 `pty:write` / `terminal:keypress`，目標分頁 `TerminalBlockedTracker` 有 hook / osc reason（`permission` / `question` / `elicitation` / codex `input`）；`tower` reason 不觸發；`blockedDetection: none` 維持現行行為並記 `[notify-hold] skipped (detection none)`。② 保留單位：同一 helper 連線、同一目標，`pty:write` 後 2 s 內的 `terminal:keypress` 合成一筆；單獨的 `pty:write` 自成一筆。③ 保留時回 `{ ok: true, held: true }`（🔴 bat-notify / bat-terminal 的 exit code 與 stdout 完全不變）。④ 送出：離開 hook / osc blocked 後連續安靜 1 s（沒有使用者輸入、沒有新的 blocked）依序寫入（文字 → 250 ms → Enter，Enter 照舊經 renderer xterm），送出前再檢查一次 blocked。⑤ 上限（塔台暫定，CT 確認中）：每個目標最多 8 筆，第 9 筆回 `{ ok: false, reason: 'held-full' }`；每筆最長 30 分鐘，逾時丟棄並記日誌。數值集中成常數（例 `NOTIFY_HOLD_MAX_PER_TARGET` / `NOTIFY_HOLD_MAX_AGE_MS` / `NOTIFY_HOLD_QUIET_MS` / `NOTIFY_HOLD_PAIR_WINDOW_MS`），CT 回覆若不同只改常數。⑥ 提示與取消（同 T0769）：塔台分頁縮圖顯示「待送通知 N」，可展開列出來源工單與時間，逐筆取消 / 全部取消；取消只丟 PTY 寫入，toast 與 Worker ✓ 照舊。⑦ 生命週期：PTY 結束、⏻ 重啟、Terminal Server recovery 全部丟棄（記數量）；不持久化。⑧ 日誌 `[notify-hold] held|sent|cancelled|expired|dropped terminal=<id> source=<id> reason=<r> len=<n>`，🔴 不記文字內容。⑨ submit Enter 不算使用者輸入（塔台暫定，CT 確認中）：helper 觸發的 `dispatchEnter`（`reason: 'submit'` 等 helper 來源）帶 `{ auto: true }`，不清 blocked、不更新 `lastUserInputAt`、不取消 `--close-worker` 與用量限制等待。⑩ 不加 `--report-hold`（塔台暫定，CT 確認中）：本單不改 `scripts/bat-notify.mjs` 的參數與輸出。"
  - "🔴 唯一實作放 `electron/notify-hold.ts`（保留佇列、合併、上限、逾時、送出排程；不 import electron，本機與 headless 共用，比照 `electron/close-worker.ts` / `electron/usage-limit-continue.ts` 的 deps 注入）。`pty.ts` / `terminal.ts` 只接線。不改 `TerminalBlockedTracker` 的判斷規則（T0590 / T0757 / T0621），只訂閱 / 讀取。"
  - "🔴 不變的行為（不回歸）：本機視窗的使用者輸入、T0566 `{ auto: true }` 續行、`terminal:notify`（不寫 PTY，T0716）、`--ask --no-pty-write`、塔台不 blocked 時的 `--submit`（立即送出）、`blockedDetection: none` 的分頁、遠端 / headless 的 notify 流程、helper `--answer` 與問答通道、Claude 面板（T0769，不經 PTY）。動工前列出相關的已驗收 e2e / 單元測試並在回報區逐項寫判定（至少：`e2e/t0757-mouse-answer-clears-waiting.spec.ts`、`t0609-worker-attention-badge`、`t0611-tower-question`、`t0735-workspace-waiting-badge`、`t0762-claude-panel-waiting`，bat-notify / terminal-handlers / close-worker / usage-limit 的單元測試）。"
  - "🔴 UI：「待送通知 N」與取消用既有元件風格與 i18n 三語系；若用 Dialog 必須用 `ModalOverlay`＋`onEscape`＋[X]（CLAUDE.md「Dialog 不因點擊外部關閉」）；選單 / popover 照舊點外部關閉。渲染端記錄用 `window.electronAPI.debug.log`。"
  - "🔴 驗收：① `e2e/t0787-notify-into-blocked-tower.spec.ts` 由探針改為斷言（保留 `T0787_PROBE` 以外的預設可跑性：預設跑斷言版，探針模式可保留），10 情境 × 2 輪：①②①d②d⑥p⑥a → 對話框維持、假模型沒有收到 `tool_result` / 答案；使用者自己回答後通知在安靜 1 s 後送進輸入框、模型收到「T#### 完成」；③ 立即送出；④ 保留後送出預填；⑤ 不變。② 「待送通知 N」顯示與逐筆 / 全部取消。③ 單元測試：合併、上限（第 9 筆 `held-full`）、逾時、PTY 結束 / 重啟 / recovery 丟棄、送出前再檢查、`blockedDetection: none` 跳過、`tower` reason 不觸發；突變檢查（拿掉保留 → 測試失敗）。④ 實測確認 submit Enter 改 `auto` 後，塔台的 `--close-worker` 延遲與用量限制等待不再被 Worker 通知取消（BUG-196 附帶發現）。⑤ codex 塔台審批提示補測（T0787 未做；codex 分頁的 `input` reason）。⑥ `npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npm run test:unit`、`npm run test:legacy`、`npx vite build`。實測一律隔離實例（`e2e/fixtures/electron-isolation.ts`）＋假模型（`e2e/fixtures/fake-anthropic-api.ts`），真實模型花費 0，不碰使用者的 BAT 與塔台分頁。"
  - "🔴 文件：新增 `docs/agent-guide/notify-hold.md`（契約、常數、日誌、已知限制、驗證清單）、`docs/agent-guide/README.md` 索引；CLAUDE.md 新增一節（3–12 行，依 CLAUDE.md 撰寫規則 T0595：用途、必守規則、唯一實作位置、不變式、連到 docs），不改既有 `##` 標題。BUG-196 單改 FIXED（附 commit）並補〈處理紀錄〉；`_bug-tracker.md` 由塔台更新，Worker 不動。"
  - "🔴 yolo：不得問使用者；判讀 / 範圍問題依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。超出 affects_files 先問塔台。Git：只 commit 本單範圍的檔案（`git commit --only` 或明列路徑）；同一 checkout 有 T0789 並行（研究單，只會新增 `e2e/t0789-*` 與它自己的工單檔），不得碰它的檔案。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。不 push、不發版。公開 repo 去識別化（D176）。child_process 規則見 CLAUDE.md「Child Process Spawning」。"
---

# T0788 — 修正 BUG-196：塔台 blocked 時保留 Worker 通知

## 元資料

- **工單編號**：T0788
- **類型**：implementation（BUG 修正）
- **互動模式**：yolo（問題問塔台）
- **優先級**：P0
- **建立時間**：2026-11-02T18:24:49+0800
- **預估規模**：L

## 目標

BUG-196：塔台（claude-cli）停在權限對話框或 AskUserQuestion 時，Worker 的 `bat-notify --submit`（含 CT 批次提問最後一題的 `--ask --submit`）送出的 Enter 會替使用者選中預設選項，T0787 實測 30 / 30。修正後，塔台在等使用者回答時，BAT 主行程把 helper 送來的「文字＋Enter」整組保留，等使用者答完、畫面安靜 1 s 再依序送出。CT 照舊用 exit code 與 stdout 判讀，兩者不變。

## 已知資訊

- 根因：`pty:write` / `terminal:keypress` 不看目標是否 blocked。submit 的 Enter 由塔台分頁的 xterm 產生（`dispatchEnter` → xterm `onData` → renderer `pty.write`），沒有帶 `{ auto: true }`，所以主行程把它記成使用者輸入。
- 只保留 Enter、讓文字照樣送出是不夠的：T0787 情境 ④ 證實文字會被對話框吞掉，所以文字和 Enter 要整組保留。
- 防護放在主行程，不靠 helper 先查再送：先查再送有競態窗口，而且舊 helper、手動腳本、遠端 headless 也要一起受保護。
- 契約草案第 5、9、10 點目前是塔台暫定值，CT 塔台還在確認（`_handover-2026-11-02-bat-notify-hold-contract.md`）；CT 回覆若不同，由塔台 Renew 或另開小單調整常數。

## 範圍與規則

見 frontmatter `memory_overrides`。

## 互動規則

- yolo：不問使用者；判讀與範圍問題問塔台（每輪最多 3 題）。

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

### 產出摘要

### 相關通過案例（不回歸判定）

### 驗證

### 遭遇問題

### 方法論狀態回寫

### 回報時間
