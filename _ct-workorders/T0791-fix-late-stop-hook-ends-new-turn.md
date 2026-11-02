---
schema_version: 1
schema_kind: workorder
id: T0791
title: "修正 BUG-198：上一回合晚到的 `stop` hook 回報不得結束時間比它晚開始的新回合（Worker 分頁 `↻` 不得提早變回 `✓`）"
type: implementation
status: DONE
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: S
created_at: "2026-11-02T21:45:51+0800"
started_at: "2026-11-02T21:48:33+0800"
updated_at: "2026-11-02T22:05:25+0800"
completed_at: "2026-11-02T22:05:25+0800"
session_ids:
  - "76d2d583-f2c0-4bd3-a83a-b7ab4c1ed3b1"
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

### 完成狀態

- **狀態**：DONE（BUG-198 → FIXED，寫在 BUG 單）
- **完成時間**：2026-11-02T22:05:25+0800
- **產品 commit**：`20bc7a88` fix: a late Stop hook no longer ends a turn that started after it (T0791, BUG-198)
- **session_id**：76d2d583-f2c0-4bd3-a83a-b7ab4c1ed3b1

### 落點檢查

- 結果：PASS
- C-0：`repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal` → PASS（`REPO_ROOT` = 主 checkout，非 worktree；`CT_HOME` 未設）
- C-1：工單在 `REPO_ROOT/_ct-workorders/` 下 → PASS
- C-3：`electron/terminal-blocked-state.ts` 等皆存在 → PASS（資訊性）
- C-2：工單無 `branch` 欄位，目前 `main`
- `BAT_WORKSPACE_ID`：`cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）；`CT_MODE=yolo`、`CT_INTERACTIVE=0`、`BAT_REMOTE_TOKEN` 已設定
- 工單 `status` 原為 `TODO`（非 `PENDING`），視同未開始，直接改 `IN_PROGRESS`

### 查證結果

**① 重現（修正前）**：在 `electron/__tests__/agent-turn-attention.test.ts` 先寫好新測試、修正前執行 → 4 個情境失敗（回合 1 `user-prompt-submit` at=t1 → 回合 2 `user-prompt-submit` at=t3 先到 → 回合 1 `stop` at=t2 晚到 → 回合 2 被結束，`isTurnActive` = false）。另以兩個真實 `bat-hook.mjs` 程序重現（`stop` 程序先啟動、stdin 不關，讀到 300 ms 逾時才回報；30 ms 後啟動的 `user-prompt-submit` 立即回報 → `at` 順序 stop < prompt、到達順序相反），隔離實例 e2e 同法重現（突變版在 `[turn] … kept:` 日誌斷言失敗）。

**② 其他回合信號有沒有同類亂序**：

| 信號 | 來源 | 會不會亂序 | 結論 |
|---|---|---|---|
| claude `user-prompt-submit` → 開始 | 各自的 hook 程序（`async`） | 會（與其他 hook 程序間） | 開始的方向：晚到的 prompt 仍開始回合（T0790 既有行為）；本單只讓它更新回合開始時間（取最晚） |
| claude `stop` → 結束 | 各自的 hook 程序（`async`） | **會**（本 BUG） | 已修：`at` 早於目前回合開始時間 → 不結束 |
| claude 其他結束路徑 | 無 —— BAT 不注入 `StopFailure`；Esc 中斷不跑 `Stop` | — | 由逾時備援涵蓋，不受影響 |
| `session-start` | hook 程序 | 會，但不碰回合 | 無影響 |
| codex OSC 7501 `working` / `idle` / `clear` | 同一個 PTY 的輸出串流，`enqueuePtyOutput` 依序解析 | 不會 | 不需處理（無 `at`，行為不變；單元測試斷言） |
| 60 s 無輸出備援 | 主行程自己的計時器，讀 PTY 最後輸出時間 | 不會 | 不需處理；被保留的 `stop` 不動計時器，新回合的備援照常（單元測試斷言） |
| PTY 結束 / ⏻ / recovery | 主行程事件 | 不會 | 照舊結束並忘掉回合開始時間 |
| 反方向：同一回合的 `user-prompt-submit` 晚於它**自己的** `stop` | hook 程序 | 理論上會（極短回合 + async prompt hook） | **未處理**：回合多留到逾時備援 60 s，方向安全（顯示 `↻`、不計入批次關閉），已寫進 docs；若要處理需另開單 |

### 修改內容

- `electron/terminal-blocked-state.ts`：回合物件加 `startedAt?: bigint`（目前回合 `user-prompt-submit` 中最晚的 `at`）；`startTurn(id, cause, at?)` 新開回合時記下、回合進行中收到較晚的 `at` 時更新（較早的、沒有 `at` 的不改）；新 `endTurnByStop(id, at?)`：`at < startedAt` → 不結束，記 `[turn] terminal=<id> kept: hook stop happened <n>ms before the current turn (reported late)`（格式比照 T0790 `[blocked] … kept:`，用同一個 `formatHookAtGap`），否則 `endTurn(id, 'hook stop')`（日誌與 T0694 相同）。被保留的 `stop` 不呼叫 `onChange`。`report` 回傳、`blocked` 判斷（T0790）不變，`at` 不進任何查詢 / 推送。檔頭補 T0791 段。
- `bat-hook.mjs`：未改（T0790 已送 `at`）。
- `electron/__tests__/agent-turn-attention.test.ts`：新增「T0791 / BUG-198」段 8 個測試（亂序重現、回合 1 已被逾時備援結束、正常順序與相等時間、回合中較晚 / 沒有 / 較早的 prompt、任一方沒有 `at`、回合結束後忘掉開始時間（含 PTY 結束）、與 T0790 `blocked` 規則並存、codex 不受影響）。
- `electron/__tests__/terminal-blocked-state.test.ts`：T0790 段原本斷言「上一回合的 `stop` 晚到 → 回合結束」（`isTurnActive` = false，即本 BUG 的行為）改寫為兩個情境：`stop` 晚於回合 prompt → 結束（不變）、上一回合的 `stop` 晚於下一回合 prompt → 回合維持；新增 `terminal:report-hook` channel 測試（`at` 經 channel、不合法照舊結束、`hookLogs` 空）與真實 hook 程序測試（exit 0、stdout 空、`at` 順序、`kept:` 日誌）。
- `e2e/t0694-worker-resumed-badge.spec.ts`：Worker 腳本新增 `race` 工作（依 `delayMs` 啟動多個 helper，`hold` = 寫 stdin 不關）；新增步驟 6：`↻` 中跑上一回合 `stop`（hold）+ 30 ms 後下一回合 `user-prompt-submit` → `kept:` 日誌、1 s 後仍 `↻` / `resumed`、N = 1；下一個 `stop` → `✓`、N = 2。
- `docs/agent-guide/blocked-state.md`：「晚到的清除回報」新增「回合結束（T0791 / BUG-198）」一點（規則、其他信號結論、反方向未處理）、改寫回合信號與殘留兩句、日誌一行、驗證一段。
- `docs/agent-guide/worker-tab-recycle.md`：回合信號段 `stop` 後補一句。
- `CLAUDE.md`：只改既有「晚到的清除回報（T0790 / BUG-197）」那一行（把「回合信號照舊」換成 T0791 規則），未新增段落、未改 `##` 標題。
- `_ct-workorders/BUG-198-…md`：FIXED（`20bc7a88`）＋〈處理紀錄〉。`_bug-tracker.md` 未動（塔台更新）。

### 驗收結果

| 項目 | 結果 | 證據 |
|---|---|---|
| ① 單元：亂序 / 正常順序 / 沒有 `at`（任一方）/ `at` 不合法 | PASS | `agent-turn-attention` 32 → 全綠；`terminal-blocked-state` 53 全綠 |
| ① 突變：拿掉比較 | PASS（測試抓得到） | 7 個測試失敗；另一突變「回合進行中不更新開始時間」→ 4 個失敗；均已還原（`git diff` 確認） |
| ② e2e `t0694-worker-resumed-badge`（含新步驟 6） | PASS | 1 passed（15.0 s）；突變版 1 failed（`spec.ts:284`），還原後重建 |
| ③ 不回歸 e2e | PASS | `t0609` 1 passed、`t0735` 1 passed、`t0590` 1 passed、`t0787` 2 passed（6.8 m） |
| ④ `npm run typecheck` | PASS | 0 |
| ④ `npm run typecheck:electron` | PASS | 0 |
| ④ `npm run test:unit` | PASS | 385 files、6782 passed / 10 skipped |
| ④ `npm run test:legacy` | PASS | files 33 passed、tests 472 passed |
| ④ `npx vite build` | PASS | exit 0 |

- 實測一律隔離實例（`launchIsolated`）＋自訂 CLI / 真實 `bat-hook.mjs`，無 LLM，真實模型花費 0；未碰使用者的 BAT 與塔台分頁。e2e 各帶自己的 `--output`（scratchpad），未清共用 `e2e-results/`。

### 相關通過案例判定（不回歸）

| 已驗收項目 | 判定 |
|---|---|
| T0694 回合信號 `↻` / `✓`（`agent-turn-attention` 既有 24 個、e2e `t0694` 步驟 1–5） | 不變：既有測試全綠；正常順序與沒有 `at` 的路徑照舊結束；renderer（`isWorkerResumedAfterReport`）未改 |
| T0790 blocked 清除（`kept: … reported late`） | 不變：T0790 段除改寫的那一則（原斷言即本 BUG 行為，回合部分）外全綠；`blocked` 的部分在改寫後仍斷言相同結果；真實 hook 程序測試綠 |
| blocked 契約 / `report-hook` 回傳 | 不變：`report` 回傳仍只講 `blocked`（新測試斷言 `{ result: 'unchanged', state: null }`）；`at` 不進查詢 |
| 滑鼠回答（T0757）、使用者輸入規則 | 未觸及；`blocked-mouse-press` 單元綠 |
| codex OSC（T0621） | 未觸及（`startTurn` 不帶 `at`）；新測試斷言 |
| `agentStarted`（T0600） | 未觸及；`terminal-blocked-state` 的 T0600 段綠 |
| notify-hold（T0788） | `notify-hold` / `notify-hold-ask-held-full` 單元綠、e2e `t0787` 2 passed |
| `--close-worker` 等安靜 | 未觸及（不讀回合狀態）；`test:unit` 全綠 |
| attention 推送（`busy`） | `terminal-attention` 單元綠、e2e `t0609` / `t0735` 綠；被保留的 `stop` 不送 `onChange` |

### 遭遇問題

1. 工單 frontmatter `status: TODO`（ct-exec 預期 `PENDING`），視同未開始處理。
2. e2e 新增的 RegExp 一開始寫在 template literal 內，`\[` 會被當成 `[`；改用 `String.raw` 後才正確（未 commit 錯誤版本）。

### 互動紀錄

- 無（yolo；沒有需要問塔台的問題，設計照工單建議方向，未偏離）。

### 後續建議

- 反方向亂序（同一回合的 `user-prompt-submit` 晚於它自己的 `stop` 到達 → 回合多留 60 s 顯示 `↻`）方向安全，未處理；若塔台認為需要，可另開單用同一個 `at` 比較（`stop` 的 `at` 晚於晚到的 prompt → 不開新回合）。
