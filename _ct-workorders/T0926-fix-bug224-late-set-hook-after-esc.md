---
schema_version: 1
schema_kind: workorder
id: T0926
title: "BUG-224：AskUserQuestion 選單出現後極快 Esc，晚到的設定類 hook（`permission-request` tool=AskUserQuestion）把已被使用者輸入清除的 `blocked: question` 設回，塔台卡住到下次打字 —— 讓晚到的設定不覆蓋較新的使用者輸入清除"
type: bugfix
status: PENDING
repo: better-agent-terminal
project: BUG-224
priority: P1
sizing: M
created_at: "2026-11-25T23:04:18+08:00"
updated_at: "2026-11-25T23:04:18+08:00"
target_version: "0.8.0-pre.4"
depends_on: []
related:
  - "BUG-224；T0923〈建議開 BUG〉1（`ct620-accept/results/M-9.md`，本機）；T0790 / BUG-197（晚到的清除以 `at` 判斷）、T0791 / BUG-198、T0918 / BUG-222（排隊的權限詢問 `keptForQueuedPrompts`）、T0757 / BUG-188（滑鼠回答）、T0788 / BUG-196（通知保護）、T0590（hook 規則）"
affects_files:
  - _ct-workorders/T0926-fix-bug224-late-set-hook-after-esc.md
  - electron/terminal-blocked-state.ts
  - electron/pty-manager.ts
  - electron/__tests__/
  - docs/agent-guide/blocked-state.md
  - CLAUDE.md
renew_count: 0
isolation: worktree
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 分支：只在 `ct/T0926` 寫檔（base = 派工當下的 `main`）。不 merge / rebase / push、不動 `main`。主 checkout 只寫本工單檔（`git -C \"$CT_HOME\" commit --only _ct-workorders/<本檔>`）。與 T0925（只合併 `e2e/manual/`）平行，不碰 `e2e/`。"
  - "🔴 不得改變的既有規則（CLAUDE.md「blocked 狀態偵測」節與 `docs/agent-guide/blocked-state.md`）：T0590 hook 腳本規則（`scripts/bat-hook.mjs` 一律 exit 0、stdout 不輸出、總時限 1.8 s；本單**不改** `bat-hook.mjs`）；T0790 / T0791 晚到清除與回合判斷（`at` 是 hook 程序啟動時間 `process.hrtime` ns，🔴 不得改用牆鐘或拿主行程 `Date.now()` 與 `at` 比）；T0918 排隊權限詢問（未結束 ≥ 2 個時使用者輸入 / 滑鼠不清除）；T0757 滑鼠回答（不算使用者輸入）；codex OSC `input` 不受使用者輸入清除；沒有 / 不合法 `at` 的回報行為不變；查詢回傳形狀與 `blockedReason` 值域不變（契約 T0590 / T0600）。"
  - "🔴 方向（Worker 依讀碼決定，回報理由）：讓「使用者輸入造成的清除」之後才到、但**屬於同一個提示**（例：同一 `tool_use` 或同一回合、在使用者輸入之前就已啟動）的設定類 hook 不再把 reason 設回。可行做法例：(a) 記下清除當下已記錄的最新 hook `at`，之後到達的設定類 hook 若 `at` ≤ 該值或屬於已清除的同一提示就不設；(b) 使用者輸入清除 `question` 後，同 reason 的 `permission-request tool=AskUserQuestion` 在短時間內視為同一提示而忽略（需說明時間窗如何避免誤擋真正的新提示，且時間窗只能用單調時鐘）。🔴 不得用「Esc 一律清除且不再接受任何設定」這種會漏掉真正新提示的做法；真正的下一個 AskUserQuestion / 權限詢問必須照常 `blocked`。"
  - "🔴 測試：單元測試重現 BUG-224 時序（`ask-user-question` 設定 → 使用者輸入清除 → 晚到 `permission-request tool=AskUserQuestion` → 預期維持清除），以及反例：使用者輸入之後真正的新提示（新的 `ask-user-question` / `permission-request`）仍會 `blocked`；T0790 / T0791 / T0918 / T0757 既有測試全部不改、全過。"
  - "🔴 驗證：worktree `npm ci`；每次產品 commit 前完整跑 `npm run test:unit`，最後在 head 第一次完整執行全綠（附數字）；`npm run test:legacy` 全綠；`npx vite build` exit 0；`npm run typecheck` = 0、`npm run typecheck:electron` = 0。e2e 只用隔離實例（`launchIsolated`），不碰安裝版 BAT；不開會耗 token 的 claude 回合（真實時序的實機驗證寫「待實機」，塔台另排）。"
  - "🔴 文件：`docs/agent-guide/blocked-state.md` 補〈晚到的設定（BUG-224）〉：規則、時序、反例、日誌；CLAUDE.md「blocked 狀態偵測」節加一兩句＋唯一實作位置＋🔴 不變式（小節標題不改名，T0595；CLAUDE.md < 100k 字元）。"
  - "🔴 Git：worktree 用 `git add <明確路徑>`；不 push、不觸發 workflow、不建 tag。禁止 `git stash`（含 list）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF；含反斜線的內容用 Write／Edit 寫（L129）。收單前 worktree `status --porcelain` 為空。"
  - "🔴 公開 repo（D176）：程式、註解、回報區不寫真名、家目錄路徑；日誌不記輸入內容、權杖。yolo：不得問使用者，判讀問題依 ct-exec § Questions For Tower 問塔台。"
---

# T0926 — BUG-224：極快 Esc 後晚到的設定類 hook

## 背景

T0923（PLAN-069 實機驗收）時，契約 2 塔台開 AskUserQuestion 選單、約 0.1 s 內按 Esc，debug log（UTC）：

- `14:31:05.872` `blocked reason=question (hook ask-user-question)`
- `14:31:05.972` `cleared (user input)`（Esc）
- `14:31:05.983` `blocked reason=question (hook permission-request tool=AskUserQuestion)`（晚到，又設回）

Esc 中斷回合後 claude 不再送 `stop` 等 hook，分頁停在 `blocked: question`（縮圖 ⚠️），Worker `--submit` 通知與待辦分頁回答都被通知保護（T0788）保留，直到 3 分鐘後使用者在分頁打字才清除。CT 6.2.0（R6）起塔台暫停一律開原生選單、要從待辦分頁回答時要先按 Esc，曝露增加。使用者裁示發版前修（U-10：A，D355）。

唯一實作：`TerminalBlockedTracker`（`electron/terminal-blocked-state.ts`；`parseHookAt` 約第 258 行、`report` 的 `at` 判斷約第 443 行、`keptForQueuedPrompts` 約第 583 行、使用者輸入清除約第 676–693 行）、`PtyManager.noteUserInput`（`electron/pty-manager.ts`）。

## 驗收

- [ ] 根因與做法說明（為何能擋住晚到的設定、又不漏掉真正的新提示）
- [ ] BUG-224 時序的單元測試（修正前失敗、修正後通過）與反例測試
- [ ] T0790 / T0791 / T0918 / T0757 既有測試不改且全過
- [ ] `npm run test:unit` head 第一次全綠；`npm run test:legacy` 全綠；`npx vite build` exit 0；兩個 typecheck = 0
- [ ] 文件兩處；〈待實機〉列出要以真 claude 驗證的步驟

---

## 回報區

### 完成狀態

### 根因與做法

### 產出摘要

### 驗證

### 待實機

### 互動紀錄

### 遭遇問題

### 隔離分支證據
- branch：`ct/T0926`
- base_sha：
- validated_sha：
- head_sha：
- validated_sha ≠ head_sha 的說明：

### 回報時間
