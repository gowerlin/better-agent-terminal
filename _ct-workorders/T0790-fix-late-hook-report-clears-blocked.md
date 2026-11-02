---
schema_version: 1
schema_kind: workorder
id: T0790
title: "修正 BUG-197：晚到的 hook 回報（`user-prompt-submit` / `stop`）不得清掉同一回合、時間比它晚發生的 `permission` / `question` blocked"
type: implementation
status: PENDING
repo: better-agent-terminal
project: maintenance
priority: P1
sizing: M
created_at: "2026-11-02T19:25:46+0800"
started_at: ""
updated_at: "2026-11-02T19:25:46+0800"
completed_at: ""
session_ids: []
depends_on: []
related:
  - "BUG-197（medium，OPEN）；T0788 回報區〈遭遇問題〉第 1 點；BUG-196 / T0788（`electron/notify-hold.ts` 依 hook reason 判斷要不要保留）；D230"
  - "`electron/terminal-blocked-state.ts`（`TerminalBlockedTracker`；約 347–360 行 `user-prompt-submit` → `startTurn` + `clear`）、`scripts/bat-hook.mjs`（每個 hook 一個程序，`terminal:report-hook`）、`electron/bat-mcp-launch.ts`（`BAT_CLAUDE_HOOKS`）"
  - "CLAUDE.md「blocked 狀態偵測」（T0590 契約、🔴 hook 腳本規則）「Worker 啟動確認」（T0600）「Worker 分頁回收」（T0694 回合信號 `TerminalBlockedTracker`；🔴 renderer 端不得拿主行程時間與 `reportedAt` 比）「Terminal Server 存活判定」（BUG-171：🔴 判斷只用單調時鐘）節；`docs/agent-guide/blocked-state.md`"
affects_files:
  - _ct-workorders/T0790-fix-late-hook-report-clears-blocked.md
  - _ct-workorders/BUG-197-late-user-prompt-submit-hook-clears-blocked.md
  - electron/terminal-blocked-state.ts
  - scripts/bat-hook.mjs
  - electron/__tests__/terminal-blocked-state.test.ts
  - electron/__tests__/**
  - scripts/__tests__/**
  - e2e/t0787-notify-into-blocked-tower.spec.ts
  - docs/agent-guide/blocked-state.md
  - docs/agent-guide/notify-hold.md
  - CLAUDE.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: decision-requiring
memory_overrides:
  - "🔴 先查證再修：① 用單元測試（直接餵 tracker）重現 T0788 看到的順序：`permission-request` 先到 → `user-prompt-submit` 後到 → blocked 被清。② 查 `stop` 有沒有同類問題（上一回合的 `stop` 晚到、清掉新回合的 blocked），以及其他會清除的事件（`post-tool-batch`、`PostToolUse AskUserQuestion` 等）是否也會受到「到達順序 ≠ 發生順序」的影響。回報區列表說明每個事件的結論。"
  - "🔴 設計方向（可調，偏離時先問塔台）：以「事件發生的先後」判斷，不以「到達主行程的先後」判斷。建議做法是 `bat-hook.mjs` 在腳本一開始取一個時間（`at`），隨 `terminal:report-hook` 送出；tracker 遇到可以清除的事件，如果它的 `at` 早於目前 blocked 那筆的 `at`，就不清除（但照樣做 `startTurn` 等其他處理，回合信號（T0694）不能因此漏掉）。🔴 時鐘：不得用牆鐘（`Date.now()`，BUG-171：NTP 校時會跳）；要用同一台主機上跨程序可比較的單調時鐘（例：`process.hrtime.bigint()`，Windows 是 QueryPerformanceCounter、Linux 是 CLOCK_MONOTONIC），回報區寫明為什麼跨程序可比，並在 Windows 實測。如果找不到可靠的跨程序單調時鐘，改用其他方式（例：同一回合以 hook payload 裡的欄位判斷），先問塔台。"
  - "🔴 相容：舊的 hook 腳本（沒有 `at`）、遠端舊 bat-server、`at` 不合法的回報 → 行為與現在完全相同。`terminal:report-hook` 的目標永遠是呼叫者自己（T0590）不變。`at` 不得出現在任何查詢回傳（`terminal:get-state` 等契約不變）。"
  - "🔴 hook 腳本規則（T0590 / T0600，不得違反）：一律 exit 0、stdout 不輸出任何東西、任何失敗靜默、總時限 `HOOK_DEADLINE_MS` = 1.8 s；`SessionStart` 不送 `source` 等 payload；日誌只記前 8 碼 session id。新增欄位只能是時間值，不得帶 hook payload 內容。"
  - "🔴 不變的行為（不回歸）：blocked 契約（state / blockedReason / blockedDetection / 優先序）、滑鼠回答（T0757）、使用者輸入清除規則、codex OSC（T0621；`input` 不受影響）、`agentStarted`（T0600）、回合信號（T0694 `↻`）、notify-hold（T0788）。動工前列出相關的已驗收測試並在回報區逐項判定（至少：`e2e/t0590-blocked-state.spec.ts`、`t0600-launch-confirmation`、`t0621-codex-osc-state`、`t0757-mouse-answer-clears-waiting`、`t0787-notify-into-blocked-tower`，單元 `terminal-blocked-state` / `blocked-hooks-launch` / `blocked-mouse-press` / `notify-hold*`）。"
  - "🔴 驗收：① 單元測試：亂序（晚到的 `user-prompt-submit` / `stop` 不清除較晚發生的 blocked；正常順序照常清除；沒有 `at` 時行為不變；`at` 不合法時忽略該欄位）＋突變檢查（拿掉比較 → 失敗）。② `e2e/t0787-notify-into-blocked-tower.spec.ts`：拿掉 T0788 加的「偵測到 RACE 就重跑」容錯，改成直接斷言；10 情境 × 至少 3 輪，races 0、全部通過。③ 不回歸 e2e 實跑。④ `npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npm run test:unit`、`npm run test:legacy`、`npx vite build`、`npm run verify:helpers`（改了 helper）。實測一律隔離實例＋假模型，真實模型花費 0，不碰使用者的 BAT 與塔台分頁。"
  - "🔴 文件：`docs/agent-guide/blocked-state.md` 補清除規則與時鐘說明；`notify-hold.md` 已知限制更新；CLAUDE.md「blocked 狀態偵測」節最多加一行（不改 `##` 標題）。BUG-197 改 FIXED（附 commit）並補〈處理紀錄〉；`_bug-tracker.md` 由塔台更新。"
  - "🔴 yolo：不得問使用者；判讀 / 範圍問題依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。超出 affects_files 先問塔台。Git：只 commit 本單範圍的檔案（`git commit --only` 或明列路徑）。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。e2e 一律帶自己的 `--output` 暫存目錄，不清共用的 `e2e-results/`。不 push、不發版。公開 repo 去識別化（D176）。"
---

# T0790 — 修正 BUG-197：晚到的 hook 回報清掉 blocked

## 元資料

- **工單編號**：T0790
- **類型**：implementation（BUG 修正）
- **互動模式**：yolo（問題問塔台）
- **優先級**：P1
- **建立時間**：2026-11-02T19:25:46+0800
- **預估規模**：M

## 目標

claude 的每個 hook 都是一個獨立的 `bat-hook.mjs` 程序，回報到主行程的順序不一定等於事件發生的順序。T0788 的 e2e 跑 60 次，有 1 次是同一回合較早的 `user-prompt-submit` 比 `permission-request` 晚到，把 blocked 清掉了，但對話框其實還在。BUG-196 的修正（notify-hold）靠 blocked 判斷要不要保留通知，所以這時 Worker 的 `--submit` 仍會替使用者作答。修正後，清除 blocked 要依事件發生的先後判斷，不依到達的先後。

## 已知資訊

- T0788 實錄：`→ blocked reason=permission (hook permission-request)` → `[turn] started (hook user-prompt-submit)` → `→ cleared (hook user-prompt-submit)`，當時對話框仍在。
- 發生條件推定：假模型回得極快（幾十毫秒內就送出權限請求）；真實模型應該更少見，但沒有量測。
- 修好後要和 BUG-196 一起整體驗證，再發 `0.7.3-pre.8`（D230）。

## 範圍與規則

見 frontmatter `memory_overrides`。

## 互動規則

- yolo：不問使用者，判讀與範圍問題問塔台（每輪最多 3 題）。

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
