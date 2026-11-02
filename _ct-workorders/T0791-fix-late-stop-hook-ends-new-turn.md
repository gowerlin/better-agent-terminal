---
schema_version: 1
schema_kind: workorder
id: T0791
title: "修正 BUG-198：上一回合晚到的 `stop` hook 回報不得結束時間比它晚開始的新回合（Worker 分頁 `↻` 不得提早變回 `✓`）"
type: implementation
status: TODO
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: S
created_at: "2026-11-02T21:45:51+0800"
updated_at: "2026-11-02T21:45:51+0800"
session_ids: []
depends_on: []
related:
  - "BUG-198（low，FIXING）；T0790 回報區〈遭遇問題〉第 2 點；BUG-197 / T0790（hook 程序啟動時間 `at`、`parseHookAt`、`blockedAt`）；T0694 / D180（回合信號 `↻`）；D232"
  - "`electron/terminal-blocked-state.ts`（`TerminalBlockedTracker.report`：`user-prompt-submit` → `startTurn`、`stop` → `endTurn`；T0790 的 `blockedAt` 比較只用在 blocked 清除，回合處理在比較之前照舊執行）、`scripts/bat-hook.mjs`（`hookStartedAt`，T0790 已送 `at`，本單預期不改）"
  - "CLAUDE.md「blocked 狀態偵測」（T0790「晚到的清除回報」一行）「Worker 分頁回收」（T0694：🔴 renderer 端不得拿主行程 / 遠端主機時間與 `reportedAt` 比）「Terminal Server 存活判定」（BUG-171：🔴 判斷只用單調時鐘）節；`docs/agent-guide/blocked-state.md`「晚到的清除回報」、`docs/agent-guide/worker-tab-recycle.md`"
affects_files:
  - _ct-workorders/T0791-fix-late-stop-hook-ends-new-turn.md
  - _ct-workorders/BUG-198-late-stop-hook-ends-new-turn.md
  - electron/terminal-blocked-state.ts
  - electron/__tests__/terminal-blocked-state.test.ts
  - electron/__tests__/agent-turn-attention.test.ts
  - electron/__tests__/**
  - e2e/t0694-worker-resumed-badge.spec.ts
  - docs/agent-guide/blocked-state.md
  - docs/agent-guide/worker-tab-recycle.md
  - CLAUDE.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: decision-requiring
memory_overrides:
  - "🔴 先查證再修：① 用單元測試（直接餵 tracker）重現：回合 1 `user-prompt-submit`（at=t1）→ 回合 2 `user-prompt-submit`（at=t3）先到 → 回合 1 的 `stop`（at=t2，t1 < t2 < t3）後到 → 修正前回合 2 被結束（`busy` / 回合信號錯誤），修正後回合 2 維持進行中。② 查其他回合信號來源有沒有同類亂序：claude 以外的 `stop` 路徑、`session-start`、codex OSC（`working` / `idle`，同一條 PTY 輸出串流，理論上不會亂序，寫明結論）、60 s 無輸出備援。回報區列表說明每個信號的結論。"
  - "🔴 設計方向（可調，偏離時先問塔台）：沿用 T0790 已送出的 hook 程序啟動時間 `at`（`parseHookAt`，跨程序單調時鐘，不得改用牆鐘，BUG-171）。tracker 記下目前回合開始那筆 `user-prompt-submit` 的 `at`（例：`turnStartedAt`）；`stop` 的 `at` 早於它 → 不結束回合，記一行 `[turn] terminal=<id> kept: hook stop happened <n>ms before the current turn (reported late)`（格式比照 T0790 的 `[blocked] … kept:`）。blocked 的清除仍照 T0790 規則各自判斷，兩者互不影響。`bat-hook.mjs` 預期不需要改；若必須改，先問塔台。"
  - "🔴 相容：舊的 hook 腳本（沒有 `at`）、遠端舊 bat-server、`at` 不合法、回合開始那筆沒有 `at`、`stop` 沒有 `at` → 行為與現在完全相同（照舊結束回合）。`at` 不得出現在任何查詢回傳或 IPC 推送（`terminal:get-state`、attention `busy` 推送等契約不變）。"
  - "🔴 不變的行為（不回歸）：T0694 回合信號（`↻` / `✓`、`isWorkerResumedAfterReport` 以 renderer 收到事件的順序判斷，不改 renderer）、T0790 blocked 清除規則（`kept: … reported late`）、blocked 契約、滑鼠回答（T0757）、使用者輸入規則、codex OSC（T0621）、`agentStarted`（T0600）、notify-hold（T0788）、`--close-worker` 等安靜。動工前列出相關的已驗收測試並在回報區逐項判定（至少：單元 `terminal-blocked-state` / `agent-turn-attention` / `terminal-attention` / `notify-hold*`；e2e `t0694-worker-resumed-badge`、`t0609-worker-attention-badge`、`t0735-workspace-waiting-badge`、`t0590-blocked-state`、`t0787-notify-into-blocked-tower`）。"
  - "🔴 驗收：① 單元測試：亂序（晚到的 `stop` 不結束較晚開始的回合）、正常順序照常結束、沒有 `at`（任一方）行為不變、`at` 不合法時忽略；＋突變檢查（拿掉比較 → 失敗）。② e2e：`t0694-worker-resumed-badge` 實跑綠；能在隔離實例重現亂序就加一個情境（做不到就在回報區寫明原因，以單元測試為準）。③ 不回歸 e2e 實跑。④ `npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npm run test:unit`、`npm run test:legacy`、`npx vite build`。實測一律隔離實例＋假模型，真實模型花費 0，不碰使用者的 BAT 與塔台分頁。"
  - "🔴 文件：`docs/agent-guide/blocked-state.md`「晚到的清除回報」補回合結束的規則；`worker-tab-recycle.md` 回合信號段補一句；CLAUDE.md 最多改既有「晚到的清除回報（T0790 / BUG-197）」那一行或「回報後又在執行（T0694）」那一行，不新增段落、不改 `##` 標題。BUG-198 改 FIXED（附 commit）並補〈處理紀錄〉；`_bug-tracker.md` 由塔台更新。"
  - "🔴 yolo：不得問使用者；判讀 / 範圍問題依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。超出 affects_files 先問塔台。Git：只 commit 本單範圍的檔案（`git commit --only` 或明列路徑）。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。e2e 一律帶自己的 `--output` 暫存目錄，不清共用的 `e2e-results/`；`cd` 失敗就中止，不得在 repo 根目錄跑整套 e2e（L180）。不 push、不發版。公開 repo 去識別化（D176）。完成狀態寫 `DONE`（BUG 的 FIXED 寫在 BUG 單，L177）。"
---

# T0791 — 修正 BUG-198：晚到的 `stop` 提早結束新回合

## 元資料

- **工單編號**：T0791
- **類型**：implementation（BUG 修正）
- **互動模式**：yolo（問題問塔台）
- **優先級**：P2
- **建立時間**：2026-11-02T21:45:51+0800
- **預估規模**：S

## 目標

claude 的每個 hook 都是一個獨立的 `bat-hook.mjs` 程序，回報到主行程的順序不一定等於事件發生的順序。T0790 已經讓 blocked 的清除依事件發生的先後判斷，但回合信號（T0694）照舊依到達順序處理：上一回合的 `stop` 如果晚於下一回合的 `user-prompt-submit` 到達，新回合會被提早結束，Worker 分頁的 `↻` 提早變回 `✓`，批次關閉可能把還在執行的 Worker 算進去。修正後，結束回合也要依事件發生的先後判斷。

## 已知資訊

- T0790 查證時從程式路徑推論出來，沒有實際觀察到（BUG-198 `reproducibility: rare`）。
- T0790 的 `at` = hook node 程序啟動時間（`process.hrtime.bigint() − process.uptime()`，ns），Windows 實測跨程序顛倒 0 / 90。
- 不擋任何發版；修好後隨下一個預覽版發佈，與 BUG-196 / BUG-197 的驗收互不影響。

## 範圍與規則

見 frontmatter `memory_overrides`。

## 互動規則

- yolo：不問使用者，判讀與範圍問題問塔台（每輪最多 3 題）。

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯
