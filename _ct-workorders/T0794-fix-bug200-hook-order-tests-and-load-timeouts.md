---
schema_version: 1
schema_kind: workorder
id: T0794
title: "BUG-200：真 hook 程序順序測試改由測試控制到達順序（不靠 300 ms 時間差）；5 檔真子程序測試在重負載下逾時 —— 量測後讓它們在兩個 `test:unit` 同時跑時也穩定通過"
type: implementation
status: DONE
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: M
created_at: "2026-11-02T23:05:00+0800"
started_at: "2026-11-02T23:06:21+0800"
updated_at: "2026-11-03T00:00:59+0800"
completed_at: "2026-11-03T00:00:59+0800"
session_ids:
  - "c0aa14e3-53bf-4de0-9d16-1599fbf67f24"
depends_on: []
related:
  - "BUG-200（low，OPEN → FIXING）；T0793 回報區〈修完後出現第六支以上逾時〉〈共用 helper / 標記評估〉；BUG-195 / T0786、BUG-199 / T0793（同類前例：先量再改、per-describe timeout 附量測依據）；T0790 / T0791（兩支順序測試的來源）；D236"
  - "`electron/__tests__/terminal-blocked-state.test.ts` 第 1337 行（T0790 / BUG-197）、第 1365 行（T0791 / BUG-198），以及同檔 `T0657: PostToolBatch clears a permission prompt …`；`scripts/bat-hook.mjs`（`STDIN_TIMEOUT_MS` 300 ms、`hookStartedAt`）；CLAUDE.md「Frontend unit tests」「blocked 狀態偵測」節"
affects_files:
  - electron/__tests__/terminal-blocked-state.test.ts
  - electron/__tests__/server-bundle-install-script.test.ts
  - src/lib/remote-tools/__tests__/node-libatomic-shell.test.ts
  - electron/remote/__tests__/headless-git.test.ts
  - electron/__tests__/git-scaffold-env.test.ts
  - electron/__tests__/worktree-status-after-close.test.ts
  - _ct-workorders/BUG-200-real-hook-order-tests-flaky-under-heavy-load.md
  - _ct-workorders/_bug-tracker.md
  - _ct-workorders/T0794-fix-bug200-hook-order-tests-and-load-timeouts.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 A（主項）—— 順序測試改由測試控制到達順序：T0790 / T0791 兩支「two real hook processes」測試目前靠「第一個程序 stdin 不關、等 300 ms 才回報，30 ms 後第二個程序立即回報」製造亂序，重負載下第二個 node 程序啟動＋回報超過約 270 ms，順序就不顛倒。改寫成**不依賴牆鐘時間差**也能確定到達順序，例：測試用的 RemoteServer / handler 攔截層把先啟動程序的回報暫存，等第二個回報處理完才放行；或以檔案 / 事件同步讓第一個程序在第二個回報被主行程處理之後才關 stdin。仍須是兩個**真實** `bat-hook.mjs` 程序（保留「跨程序 `at` 單調」與 exit 0 / stdout 空的驗證），斷言內容不得放寬（`at` 先後、blocked 維持 / 回合維持、`kept:` 日誌）。🔴 不得改 `scripts/bat-hook.mjs` 或任何產品程式碼；若不改產品就做不到確定順序，停下問塔台。"
  - "🔴 A 的驗證：修改前在重負載下重現失敗（兩個 `npm run test:unit` 同時跑，或只跑 `terminal-blocked-state.test.ts` 時並行造 CPU 負載，寫明方式與次數）；修改後同樣負載下這兩支連跑通過（至少 5 次）；突變檢查：把產品的 `at` 比較拿掉（暫時修改、收尾還原，或以既有的突變方式）→ 這兩支要失敗，證明改寫後仍測得到 BUG-197 / 198。"
  - "🔴 B —— 重負載逾時（比照 T0786 / T0793，先量再改）：`server-bundle-install-script`（`install script under a real sh`）、`node-libatomic-shell`、`headless-git`、`git-scaffold-env`、`terminal-blocked-state` 的 `T0657: PostToolBatch …`。量測單檔 / 整套 / 兩個 `test:unit` 同時跑的耗時，先找可省的工作，再替真子程序的 `describe`（或該 it）設明確 timeout（30 s，與 T0786 / T0793 一致），註解寫量到的最大值與 BUG-200。`worktree-status-after-close` 在兩個 `test:unit` 同時跑時超過 T0786 的 30 s：先量它在該負載下的實際耗時與慢在哪裡；若能縮短就縮短，否則提高到量測最大值約 2 倍並註明（上限 60 s，超過就停下回報）。"
  - "🔴 範圍控制：🔴 不改 `vite.config.ts`（含全域 `testTimeout`、`test.projects`、`maxWorkers`，屬政策）、不改產品程式碼與常數、不 skip / retry、不實作共用 helper / 常數模組（T0793 評估的 A / B 案不做）。修完後若出現第七支以上逾時或其他失敗，不擴大範圍、回報（附檔名與耗時）。"
  - "🔴 驗證（全部）：整套 `npm run test:unit` 連跑 3 次 exit 0；兩個 `npm run test:unit` 同時跑 2 次，兩邊都 exit 0（若仍有範圍外失敗，列表並說明，不算本單失敗，但本單範圍內的檔案必須都過）；`npm run typecheck` = 0、`npm run typecheck:electron` = 0；`npm run test:legacy` 綠。不回歸：本單只改測試檔，回報區列出被改的每個測試原本驗什麼、改後是否仍驗同一件事。"
  - "🔴 BUG-200：修好後 `status: FIXED`、加 `fixed_at` / `fix_commit`，表格狀態列同步，處理紀錄加一筆，文末補〈T0794 結果〉；`_bug-tracker.md` 只把 BUG-200 那一列從「⏳ 修復中 (FIXING)」移到「✅ 已修復」（區段標題照 `_local-rules.md` parser 規則），FIXING 區段放回 `_（無）_` 佔位列，更新 frontmatter `breakdown` / `generated_at`、〈統計〉行、〈最後同步〉加一筆。🔴 逐一 Edit，不用全檔 `sed`，改完跑 `src/types/__tests__/bug-tracker.test.ts`（L179）。"
  - "🔴 不發版、不改 CHANGELOG、不 push。公開 repo 去識別化（D176）。yolo：不得問使用者；判讀 / 範圍問題依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。Git：只 commit 本單範圍（`git commit --only` 或明列路徑）。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。暫存量測腳本放系統暫存目錄、用 Write 寫檔（含反斜線的內容不用 heredoc，L129），收尾刪除。完成狀態寫 `DONE`（BUG 的 FIXED 寫在 BUG 單，L177）。"
---

# T0794 — BUG-200：真 hook 程序順序測試與重負載逾時

## 元資料

- **工單編號**：T0794
- **類型**：implementation（測試穩定性）
- **互動模式**：yolo（問題問塔台）
- **優先級**：P2
- **建立時間**：2026-11-02T23:05:00+0800
- **預估規模**：M

## 背景

T0793 在「兩個 `test:unit` 同時跑」的重負載下發現兩類範圍外失敗（BUG-200）：

- **A**：`terminal-blocked-state.test.ts` 的 T0790 / T0791 兩支「兩個真實 hook 程序」測試靠 300 ms 時間差製造亂序，負載一高順序就不顛倒，斷言失敗。這是測試設計問題，拉長 timeout 解決不了。
- **B**：5 檔真子程序測試逾時（含 T0786 已設 30 s 的 `worktree-status-after-close`）。

CI 與正常整套目前都沒出現，但 CI runner 負載一高就可能擋發版。使用者決定在下一版（`0.7.4-pre.1`）前修掉（D236）。

## 範圍

1. A：改寫兩支順序測試，由測試控制到達順序；負載下重現 → 修後穩定 → 突變檢查。
2. B：5 檔＋`worktree-status-after-close` 先量再改。
3. 全部驗證（整套 3 次、兩套並行 2 次、typecheck、legacy）。
4. BUG-200 → FIXED、tracker 同步。

## 不做

- 不改產品程式碼與 `bat-hook.mjs`、不改 `vite.config.ts`、不 skip / retry、不實作共用 helper。

## 驗收

- [ ] A：修改前負載下重現、修改後負載下 ≥ 5 次通過、突變檢查
- [ ] B：各檔量測、修法與理由
- [ ] 整套 3 次 exit 0、兩套並行 2 次範圍內全過
- [ ] `typecheck` = 0、`typecheck:electron` = 0、`test:legacy` 綠
- [ ] 被改測試的驗證內容對照（不回歸）
- [ ] BUG-200 FIXED、tracker 只動該列、parser 測試綠

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

- **狀態**：DONE（BUG-200 → FIXED，寫在 BUG 單）
- **產品 commit**：`2b3f0b1b`（只改 6 個測試檔）、`216973bb`（只改註解：T0657 的 hook 程序數 16 → 14；改後單檔 53 / 53 通過）
- **session_id**：c0aa14e3-53bf-4de0-9d16-1599fbf67f24
- **落點檢查**：PASS。C-0：`repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`；C-1 工單在 REPO_ROOT 下；C-3 `affects_files` 全部存在；C-2 無 `branch` 欄位。非 worktree（`CT_HOME` 未設）。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）。`CT_MODE` = yolo、`CT_INTERACTIVE` = 0。
- **methodology_ambient**：none

### 結果摘要

- **A**：兩支「兩個真實 hook 程序」測試不再靠 300 ms 時間差。測試的 handler 包裝層新增 `holdReport(event, terminalId)`：攔住先啟動程序的回報，回報**到達後**才 spawn 第二個程序，第二個回報處理完才放行。因此到達順序與 `at` 先後都由測試決定，與負載無關。仍是兩個真實 `bat-hook.mjs` 程序，斷言沒有放寬。
- **A 的新發現**：修改前除了「順序沒顛倒」，還有一種失敗：重負載下先 spawn 的程序反而較晚啟動，`at` 較晚（`expected 140874659709600 to be less than 140874613040600`）。改寫後一併排除，因為第二個程序要等第一個的回報到達才 spawn，它的程序啟動時間一定較晚。
- **B**：先量再改。5 檔的真子程序 describe 設 30 s；`worktree-status-after-close` 設 40 s（量測最大值 19.2 s 的約 2 倍），並把測試自己的 git 關掉自動 maintenance（`-c maintenance.auto=false`）。註解寫量測值與 BUG-200。

### A：重現、修正、突變檢查

造負載的方式：`burn.mjs`（暫存腳本，N 個 `worker_threads` CPU 忙迴圈），只跑 `terminal-blocked-state.test.ts -t "two real hook processes"`，24 核機器。

| 階段 | 負載 | 結果 |
|---|---|---|
| 修改前 | 兩個 `test:unit` 同時跑 3 次（6 套） | 這兩支 6 / 6 通過（沒重現） |
| 修改前 | 48 執行緒，5 次 | 1 次失敗（T0790 `at` 顛倒） |
| 修改前 | 96 執行緒，10 次 | **7 次失敗**：T0790 順序顛倒 2、`at` 顛倒 1、5 s 逾時 2；T0791 `at` 顛倒 1、5 s 逾時 4（有的一次兩支都失敗） |
| 改寫後，仍是預設 5 s | 96 執行緒，10 次 | 順序與 `at` 斷言 0 次失敗；8 次 5 s 逾時（T0791 跑 4 個 hook 程序，負載下每個 1–2 s） |
| ＋describe 30 s | 96 執行緒，10 次 | 9 次通過；1 次是 `beforeAll`（RemoteServer 產生自簽憑證）超過預設 10 s hookTimeout，兩支測試都沒有跑 |
| ＋`beforeAll` 30 s | 96 執行緒，10 次 | **10 / 10 通過**，T0790 最慢 7.6 s、T0791 最慢 12.5 s |
| 突變檢查 | 無負載 | 暫時把 `electron/terminal-blocked-state.ts` 的 `at < enteredAt`、`at < startedAt` 兩處改成永遠不成立 → **兩支都失敗**（T0790 `expected null to match object { reason: 'permission' }`；T0791 `expected false to be true`）。之後用 `sed` 還原，`git diff --stat -- electron/terminal-blocked-state.ts` 為空 |

### B：量測與修法

量測方式：vitest JSON reporter（暫存的 `summ.mjs` 統計）；`worktree-status-after-close` 另用 `GIT_TRACE2_EVENT` 記下每個 git 程序。

| 檔案（測試） | 單檔最慢 | 整套最慢（修改後 3 次） | 兩套並行最慢（修改前 6 套 / 修改後 4 套） | 修法 |
|---|---|---|---|---|
| `server-bundle-install-script`（real sh describe） | 0.8 s | 3.3 s | 5.9 s（修改前 4 / 6 套逾時）／6.0 s | describe 30 s。每個測試是打包（sh＋tar＋gzip）＋執行安裝腳本本身，沒有可省的 |
| `node-libatomic-shell`（real sh describe） | 0.6 s | 3.2 s | 5.4 s（修改前 2 / 6 套逾時）／5.2 s | describe 30 s。第一支跑 install＋update 兩次，假 ldconfig / sudo / apt-get / node 各是一個程序，都是驗證對象 |
| `headless-git`（T0405、T0429 兩個 describe） | 1.0 s | 2.8 s | 4.8 s／5.4 s | 兩個 describe 各 30 s。真 headless server＋真 git／simple-git。純函式的 `createHeadlessGitBinaryResolver` 不動 |
| `git-scaffold-env`（`git-scaffold:* child env`） | 0.4 s | 1.1 s | 3.6 s／3.3 s | describe 30 s |
| `terminal-blocked-state`（`scripts/bat-hook.mjs ↔ RemoteServer` describe，含 T0657） | 0.9 s | 2.4 s | 4.6 s／5.3 s | describe 30 s（A 的兩支也在這個 describe）、`beforeAll` 30 s |
| `worktree-status-after-close`（長測試） | 2.5–3.2 s | 12.8 s | 14.1–18.5 s／17.4–19.2 s | 30 → 40 s；測試自己的 git 關掉自動 maintenance |

修改後兩套並行時，範圍內已有多支超過舊的 5 s（5.2–6.0 s），都在新的上限內。

**`worktree-status-after-close` 慢在哪裡**（git trace2，這個檔的兩個測試共 75 個 git 程序；長測試 57 個，handler 約 40、測試自己約 17）：

| | 單檔 | 兩套並行 |
|---|---|---|
| git 程序本身的時間合計 | 2.7 s | 8.2 s |
| 一個 git 結束到下一個 git 開始的空檔合計（建立程序、忙碌的 worker） | 3.6 s | 14.2 s |
| 單一程序最慢 | — | 0.55 s（`worktree add`） |

每次建立程序都變慢，沒有特別慢的一步。handler 的 git 呼叫就是要驗的東西，不能省。測試自己的 commit 會觸發 `git maintenance run --auto`，關掉後程序數 75 → 72。T0793 量到超過 30 s 時，同一台機器還有 T0792 的 e2e 在跑，負載比本單的「兩套並行」更重。

### 驗證

| 項目 | 結果 |
|---|---|
| 整套 `npm run test:unit` 3 次 | **3 / 3 exit 0**（每次 6782 passed / 10 skipped，62–63 s） |
| 兩個 `test:unit` 同時跑，第 1 次 | 兩邊都 exit 1，失敗只有範圍外的 `scripts/__tests__/dev-deploy-headless.test.mjs`（下節）；範圍內 6 檔兩邊都通過 |
| 兩個 `test:unit` 同時跑，第 2 次 | **兩邊都 exit 0**（6782 passed） |
| `npm run typecheck` | 0 |
| `npm run typecheck:electron` | 0 |
| `npm run test:legacy` | 綠（33 / 33 檔、472 tests） |
| `src/types/__tests__/bug-tracker.test.ts`（L179） | 12 / 12 通過 |

### 範圍外的失敗（不擴大範圍，只回報）

- `scripts/__tests__/dev-deploy-headless.test.mjs`（`main() dry-run never writes` 的 `deploy dry-run builds into staging …` 或 `T0434: --yes deploys JS + helpers …`）：只在兩套 `test:unit` 同時跑時失敗，錯誤是 `EPERM, Permission denied` / `ENOENT` / `Build failed`，路徑在 `dist-server/dev-deploy-headless`。兩套 vitest 同時 build 到同一個輸出目錄、互相覆蓋。這是共用輸出目錄的衝突，不是逾時，與負載高低無關。修改前（`pre-b2`）與修改中的量測（`trc-b`）也都出現過。單一 `test:unit`（CI 的情況）3 次都沒出現。建議塔台另外登記（例：每次執行用不同的 staging 目錄），本單不處理。
- 沒有出現第七支以上的逾時。

### 不回歸：被改的測試原本驗什麼、改後是否仍驗同一件事

| 測試 | 原本驗什麼 | 改後 |
|---|---|---|
| T0790 / BUG-197 two real hook processes | 兩個真實 hook 程序：先啟動的 UserPromptSubmit 比後啟動的 PermissionRequest 晚到 → blocked 維持 `permission`；跨程序 `at` 單調（晚到的 `at` 較早）；兩個程序 exit 0、stdout 空；晚到的回報仍開始回合；回報不含 SECRET；之後的 Stop 清除 | 同樣的斷言全部保留。到達順序改由 handler 攔住晚到的回報來保證，並多一個斷言：攔住的回報要在程序結束前到達（`arrived`）。突變檢查證明仍測得到 BUG-197 |
| T0791 / BUG-198 two real hook processes | 上一回合的 Stop 比下一回合的 UserPromptSubmit 晚到 → 回合繼續；`at` 單調；exit 0、stdout 空；`[turn] … kept: … (reported late)` 日誌；之後的 Stop 結束回合 | 同樣的斷言全部保留，另多兩個斷言：放行前回合為進行中、`arrived`。突變檢查證明仍測得到 BUG-198 |
| `scripts/bat-hook.mjs ↔ RemoteServer` describe 的其他測試 | 各自的 hook 行為 | 斷言不變。handler 包裝層只在 `holdReport` 設定、而且 event 與 terminalId 都相符時才攔；其他回報走原本的同步路徑（`received.push` 的時機不變），只加了 timeout |
| 其餘 5 檔被加 timeout 的 describe | 各自的真子程序行為 | 只加 timeout（＋註解），斷言與程序都不變 |
| `worktree-status-after-close` 的 `git()` | 測試自己建 repo / commit / 取快照 | 多 `-c maintenance.auto=false`，只少了 commit 後的自動維護；快照比對的對象（handler 不改 repo）不受影響 |

### 修改的檔案

- `electron/__tests__/terminal-blocked-state.test.ts`：`holdReport` / handler 包裝層改寫、T0790 / T0791 兩支改寫、describe 30 s、`beforeAll` 30 s
- `electron/__tests__/server-bundle-install-script.test.ts`、`src/lib/remote-tools/__tests__/node-libatomic-shell.test.ts`、`electron/remote/__tests__/headless-git.test.ts`、`electron/__tests__/git-scaffold-env.test.ts`：describe timeout＋註解
- `electron/__tests__/worktree-status-after-close.test.ts`：40 s＋註解、`maintenance.auto=false`
- `_ct-workorders/BUG-200-…md`、`_ct-workorders/_bug-tracker.md`、本工單

### 偏離與說明

- **`beforeAll` 30 s**：工單 B 只寫 describe / it 的 timeout。A 的驗收要求「同樣負載下連跑通過」，96 執行緒下 `beforeAll` 產生自簽憑證有 1 / 10 次超過預設 10 s hookTimeout，所以同一個 describe 的 `beforeAll` 也設 30 s（在 affects_files 內、只改測試）。塔台若不要，拿掉後在兩套並行的負載下也沒有觀察到這個逾時。
- **重現 A 用的負載**：兩套 `test:unit` 同時跑 3 次（6 套）都沒重現 A，所以改用「單檔＋CPU 忙迴圈」重現。修改後的「≥ 5 次」也是在同一個 96 執行緒負載下量的（比兩套並行重）。
- 我執行過一次唯讀的 `git stash list`（誤打在指令裡），不會改動任何狀態；沒有執行任何 stash / reset / checkout -- / restore。
- 暫存的量測腳本與輸出（`burn.mjs`、`summ.mjs`、JSON、trace2 目錄）放在 session 暫存目錄，收尾已刪除。

### 互動紀錄

- 無（沒有向塔台提問）。

### 後續建議

- 範圍外：`dev-deploy-headless.test.mjs` 在兩套並行時的輸出目錄衝突（上節）。
- BUG-200 待 CI Test gate 驗收（下一次 pre-release 的 `tests` job 綠）→ CLOSED。
