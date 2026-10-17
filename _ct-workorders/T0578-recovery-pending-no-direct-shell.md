---
schema_version: 1
schema_kind: workorder
id: T0578
title: "BUG-146：Recovery 提示回答前不得以 direct node-pty 另起同 id 的 shell"
type: bugfix
status: DONE
repo: better-agent-terminal
project: BUG-146
priority: P2
sizing: M
created_at: "2026-10-17T19:57:39+0800"
started_at: "2026-10-17T19:59:10+0800"
updated_at: "2026-10-17T20:15:11+0800"
completed_at: "2026-10-17T20:15:11+0800"
target_version: "0.7.0-pre.1（與 T0575 / T0576 / T0579 同版，D151）"
depends_on: []
related:
  - "BUG-146（現象與 T0576 隔離實例日誌）"
  - "T0576 回報區「塔台補充 1」（pending 權杖 + settle）、「後續建議 1」"
  - "T0108 / T0110（Terminal Server replay / Recovery）、T0572（`requestPtySizeSync`、`created` 回傳語意）"
affects_files:
  - electron/main.ts
  - electron/pty-manager.ts
  - "electron/handlers/pty.ts（若需要）"
  - "src/lib/pty-replay.ts（若需要）"
  - "electron/__tests__/**（新增 / 修改）"
  - "e2e/t0578-recovery-no-direct-shell.spec.ts（新增）"
  - "CLAUDE.md（「關閉分頁時的程序樹」或 Terminal Server 相關節，補 BUG-146 規則）"
  - _ct-workorders/T0578-recovery-pending-no-direct-shell.md
  - _ct-workorders/BUG-146-recovery-prompt-pending-spawns-direct-shell.md
renew_count: 0
workdir: main repo
interaction:
  mode_hint: on
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 不 push、不觸發 workflow、不建 tag、不改版號；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF；含反斜線的內容用 Write 工具（L129）。commit 用 `git commit --only <你改的檔>`（`src/styles/settings.css` 的 M 不是你的變更）。"
  - "🔴 不碰使用者正在用的 BAT（port 9876）與它的 Terminal Server；實測一律用隔離實例（需先 `npx vite build`）。隔離實例「不停 Terminal Server」時 `app.close()` 可能不返回（T0575 / T0576 實測），teardown 必須以 pid 檔 + 命令列比對停掉隔離 Terminal Server、刪 runtime userData。"
  - "🔴 本單與 T0579 並行：T0579 改 `electron/remote/headless-entry.ts`、`electron/remote/helper-capability.ts` 與 CLAUDE.md「遠端 Tower 通知」節；本單不得改這兩個檔，CLAUDE.md 只改自己的節（Edit 前重新 Read）。"
  - "🔴 不得破壞 T0576 的 pending 權杖 + `settleRestored` 行為與其測試（`helper-capability-persist.test.ts`、`e2e/t0576-*`）；修好後若 pending 機制有部分變得不必要，**不要移除**，在回報區說明交塔台決定。"
---

# T0578 — BUG-146：Recovery 提示期間不另起 direct shell

## 背景

見 BUG-146。Windows Terminal Server 模式，退出時不停止 Terminal Server，重開 BAT：使用者回答 Recovery 提示（`electron/main.ts` 約 3744–3751 `[terminal-server] user chose recovery`）之前，renderer 還原分頁送出 `pty:create`；PtyManager 尚未連上 Terminal Server，走 direct node-pty 在同 id 另起本機 shell。選「保留」後輸入改送 server PTY，但 direct shell 程序仍在，輸出也進同 id。

## 任務

1. 先以隔離實例重現並記錄（程序清單 / 日誌）：Recovery 待決時有幾個 shell 程序、選「保留」後是否殘留、輸出是否重複。
2. 修正，兩條候選（自行評估後擇一或組合，回報區說明理由）：
   - (a) Recovery 待決時 `pty:create` 不立即 spawn：排隊到使用者回答後，「保留」→ 對 replay 清單中已存在的 id 直接接回（不 spawn），其餘再建；「重新開始」/ 失敗 → 照常建立。
   - (b) 照舊 spawn，但選「保留」後對 replay 清單中已存在的 id 收掉 direct 實例（含程序樹，比照 T0540 kill 規則），且其輸出不得已進入分頁。
   - 必須保持：`pty:create` 回傳 `created` 的語意（T0572 `requestPtySizeSync`、是否重送 agent 啟動命令）在「保留」時對已存在的 PTY 為 `created: false`、新建者為 `true`；direct 模式、非 Windows、沒有存活 Terminal Server 的啟動路徑行為不變。
3. 與 T0576 的 settle 對照：修正後「保留」路徑還會不會替存活 id 新簽權杖；把結果寫進回報區（不移除 pending 機制，見 memory_overrides）。
4. CLAUDE.md 補一條規則（Terminal Server / Recovery 相關節）與驗證檔案清單。

## 驗收條件

1. `npx vite build` 成功；`npm run typecheck` = 0、`npm run typecheck:electron` = 0；`npm run test:unit` 全綠。
2. 單元測試：Recovery 待決時的 `pty:create` 不 spawn direct（或保留後已收掉）；保留 / 重新開始兩條路徑的 `created` 值；direct 模式不變。
3. e2e `e2e/t0578-recovery-no-direct-shell.spec.ts`（隔離實例）：退出不停 Terminal Server → 重開 → Recovery 待決期間該 id 無 direct shell 程序（或選保留後 ≤ N 秒內已結束，依所選方案）→ 選保留 → 分頁輸入 / 輸出只來自 server PTY（不重複）；另一 test 選「重新開始」→ 分頁得到新 shell。
4. 回歸：`e2e/t0576-capability-persist-restart.spec.ts`、`e2e/t0572-new-pty-initial-size.spec.ts`、`e2e/t0537-worker-ownership-persistence.spec.ts` 通過。
5. BUG-146 狀態改 FIXED（frontmatter `status` / `fixed_at` / `fixed_by` / `fix_commit` 與表格），回報區附修正前 / 後對照。

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 結果摘要

**DONE**。採方案 **(a)**：Recovery 提示待決時 `pty:create` 排隊不 spawn，回答後放行。

- `PtyManager`（`electron/pty-manager.ts`）新增 create hold：`holdCreates` / `isCreateHeld` / `whenCreatesReleased` / `releaseCreates` / `releaseCreatesOnReplayList`（`CREATE_HOLD_LIST_TIMEOUT_MS` = 5 s）；`handleReplayList` 在註冊存活 id 並通知 `onSurvivingPtys`（T0576 settle）**之後**放行。
- `pty:create` handler（`electron/handlers/pty.ts`）：hold 中回 Promise，等放行後才 `createWithResult`；沒有 hold 時同步回傳，與修正前完全相同（headless 從不 hold）。
- `electron/main.ts`：`startTerminalServer` 設 `pendingRecovery` 時 `holdCreates`；「保留」在送出 `pty:list` 後 `releaseCreatesOnReplayList()`（IPC 仍在的 reload 分支同）；「保留」失敗與「重新開始」在 `startTerminalServer()` 之後以 `try/finally` 放行。
- **選 (a) 而非 (b) 的理由**：(b) 的 direct shell 在選「保留」前已收到 renderer 的 agent 啟動命令（`created: true` → `createPtyThenLaunch` 會在 direct shell 打一次 agent 命令）與 resize，輸出也已進分頁，事後收掉無法撤回這些副作用；且需要額外 kill 程序樹與過濾輸出。(a) 從源頭不 spawn，`created` 語意自然成立：存活 id 走既有冪等 skip → `created: false`（不重送啟動命令、要 replay、不 `requestPtySizeSync`），新 id → `created: true`。

### 修正前 / 後對照（隔離實例 e2e，Windows）

| 項目 | 修正前 | 修正後 |
|---|---|---|
| Recovery 待決 5 s 時 Electron 主程序下（Terminal Server 樹以外）的 shell | recover：`pwsh.exe` pid 47000；fresh：`pwsh.exe` pid 39464 | `[]`（兩情境、3 輪） |
| 選「保留」後 2 s | 同一個 `pwsh.exe` 47000 仍存活 | `[]` |
| 日誌 | `[helper-cap] issued: terminal=e2e-t0578-tab` + `Created terminal using node-pty`，早於 `user chose recovery` | `[BUG-146] pty:create held` → `held until the Recovery prompt is answered` → `user chose recovery` → `replay: 1 active PTY(s)` → `released (Terminal Server PTY list): 1 held create(s)` → `pty:create SKIP (idempotent)` |
| 分頁內指令的父程序 | `[44160]` = server PTY pid（輸入只到 server；direct shell 自己的 banner / prompt 於提示期間已併入同 id） | `[46336]` / `[33928]` / `[40752]` = 各輪 server PTY pid，只出現一次 |
| 「重新開始」 | 30 s 內新 Terminal Server 的 pid 檔一直不存在（見「偏差 1」），分頁仍是 direct shell | 新 server pid（例 39888 / 36804）、分頁新 PTY 在新 server 上（`PPID` = 新 PTY pid）、舊 server 結束、`released (fresh start)` |

### T0576 settle 對照

- 修正後「保留」路徑**不再**替存活 id 新簽權杖：hold 中沒有 create，`helperEnv` 不被呼叫；放行後存活 id 走冪等 skip，也不簽（單元測試 `helperEnv` 只被新 id 呼叫；t0576 e2e 日誌 `released … 2 held create(s)` 後無 `issued` 給存活 id）。
- 因此 T0576 的「`issue()` 不撤銷 pending 紀錄、settle 撤銷期間新簽者」在本機 Electron 的 Recovery 路徑上已不會觸發，但**未移除**（依 memory_overrides）；它仍涵蓋 hold 未涵蓋的同步 create 路徑（見「殘留風險 1」）。是否簡化交塔台決定。

### 偏差 / 範圍外發現

1. **「重新開始」的 pid 檔競態（一併修正，同 handler）**：舊 server 收到 `server:shutdown` 立即關 TCP（`sendShutdownToServer` 隨即返回），pid / port / registry 檔卻在全部 PTY 程序樹結束後才刪（T0540，`server.ts` `shutdown()` 的 `ended.then`）；main 已 fork 的新 server 寫好的檔案會被舊 server 刪掉。修正前 e2e 實測：重新開始後 30 s 內 pid 檔不存在。驗收條件 3 的「重新開始 → 分頁得到新 shell」需要它，故在 fresh-start handler 加 `waitForTerminalServerExit`（`isServerRunning` 為否，最多 5 s，逾時 warn 後照舊）再刪檔、fork。修正前 pid 檔消失的原因為依程式碼推得（未單獨隔離量測刪檔時序），修正後 3 輪皆取得新 pid。後果（修正前）：下次啟動找不到這個 server → 再 fork 一個，前一個成為孤兒（idle timeout 才結束）。建議塔台視需要補開 BUG 記錄。
2. 工單寫「非 Windows 行為不變」：hold 不分平台（Recovery 提示在 macOS / Linux 同樣存在、bug 同樣成立），所以非 Windows 的 Recovery 路徑也改為 hold；非 Recovery 路徑不變。非 Windows 只看程式碼，e2e 只在 Windows。

### 殘留風險 / 後續建議

1. **同步 `create()` 呼叫者未涵蓋**：`terminal:create-with-command`（helper 派工，含 agent 模式）與 `restart` 直接呼叫同步 `ptyManager.create`，hold 中仍 direct spawn（新增 `[BUG-146] … spawns directly while creates are held (synchronous caller)` warn）。Recovery 提示期間，存活分頁的塔台以 T0576 pending 權杖派工即會遇到：新 Worker 為 direct shell，放行後寫入卻送 server（server 不認得該 id）。修法：在 `terminal-command-handlers.ts` 建立前 `await ptyManager.whenCreatesReleased()`（該檔不在本單 affects_files，建議另開工單）。
2. 「保留」時存活 PTY 的尺寸：提示期間 renderer 的 `pty:resize` 因 id 尚未註冊被丟棄，放行後 `created: false` 依 T0572 不重送尺寸，存活 PTY 維持舊尺寸直到下一次 resize。修正前同樣不會 resize 到 server PTY（當時送進 direct shell），非本單引入。
3. CLAUDE.md「遠端 Tower 通知」節的 T0576「時序（T0575 實測）」段落仍描述「Recovery 提示回答前 … 走 direct node-pty，同 id 另起一個 shell」，已過時；該節屬 T0579 範圍，本單依 memory_overrides 未改，請塔台更新（可改為指向新節「Recovery 提示期間的 `pty:create`」）。

### 變更檔案

- `electron/pty-manager.ts`、`electron/handlers/pty.ts`、`electron/main.ts`
- `electron/__tests__/recovery-create-hold.test.ts`（新增，12 tests）
- `e2e/t0578-recovery-no-direct-shell.spec.ts`（新增，2 tests）
- `CLAUDE.md`：新增「Recovery 提示期間的 `pty:create`（T0578 / BUG-146）」節（只動該節）
- `_ct-workorders/T0578-…`、`_ct-workorders/BUG-146-…`

### 驗證

| Gate | 結果 | 證據 |
|---|---|---|
| `npx vite build` | PASS | exit 0（最終程式碼） |
| `npm run typecheck` | PASS | 0 error |
| `npm run typecheck:electron` | PASS | exit 0 |
| `npm run test:unit` | PASS | 269 files / 4757 passed / 3 skipped（`try/finally` 前一版）；之後改動只在 main.ts 放行包 `try/finally`，`recovery-create-hold.test.ts` 12/12 PASS、typecheck 0 |
| 單元測試（驗收 2） | PASS | hold 中不 create / 不 spawn / 不簽權杖；保留：存活 id `created: false` 且不送 server、新 id `created: true`；依序放行；`pty:list` 逾時放行；重新開始 `created: true`；無 hold 同步回傳；main.ts source guard |
| e2e `t0578-recovery-no-direct-shell`（驗收 3） | PASS ×3 輪 | 2 passed（1.1 m）×3，末輪為最終 build |
| 回歸 `t0576` ×2、`t0572`、`t0537`（驗收 4） | PASS | 4 passed（1.7 m） |

### Landing check

PASS — C-0：`repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal`；C-1 PASS；C-3 PASS（`electron/main.ts` 等存在）；C-2 無 `branch` 欄位。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）。

### Commit

- `f833e3b0` fix(T0578): hold pty:create until the Recovery prompt is answered (BUG-146)
- 未 push；`src/styles/settings.css` 的 M 非本單變更，未納入。
