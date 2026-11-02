---
schema_version: 1
schema_kind: workorder
id: T0793
title: "BUG-199：`nvm-login-profile.test.ts` 的真 bash 測試在整套 `test:unit` 下逾時 —— 量測後讓它在全套負載下穩定通過"
type: implementation
status: DONE
repo: better-agent-terminal
project: maintenance
priority: P3
sizing: S
created_at: "2026-11-02T22:40:55+0800"
started_at: "2026-11-02T22:43:03+0800"
updated_at: "2026-11-02T23:00:49+0800"
completed_at: "2026-11-02T23:00:49+0800"
session_ids:
  - "61cc7373-8c82-4dd0-8801-38266091f4a1"
depends_on: []
related:
  - "BUG-199（low，OPEN → FIXING）；BUG-195 / T0786（同類前例：先量再改、per-describe timeout 附量測依據，4 檔）；T0556（這支測試的來源）；T0686（CI Test gate）；D234"
  - "`src/lib/remote-tools/__tests__/nvm-login-profile.test.ts`（第 193 行 `~/.profile layout: bash -lc finds it; bash -lic loads nvm once …`）；`vite.config.ts` 的 `test` 區塊；CLAUDE.md「Frontend unit tests」節"
affects_files:
  - src/lib/remote-tools/__tests__/nvm-login-profile.test.ts
  - _ct-workorders/BUG-199-nvm-login-profile-test-timeout-under-load.md
  - _ct-workorders/_bug-tracker.md
  - _ct-workorders/T0793-fix-bug199-nvm-login-profile-test-timeout.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 先量再改（比照 T0786）：單檔與整套各跑數次，記錄 `nvm login profile block under real shells (T0556)` 內每個測試的耗時（`vitest run --reporter=verbose` 或暫時計時），找出每個測試開了幾個 `bash` 程序、哪一步在負載下變慢。量測用的暫時程式碼收尾移除。"
  - "🔴 修法優先序：① 縮短不必要的工作（重複的 shell 呼叫、可共用的暫存 HOME 準備）；② 若慢是真 bash 在負載下的固有成本，替這個真 shell 的 `describe` 設明確且合理的 timeout（例 `{ timeout: 30_000 }`，與 T0786 一致），註解寫量到的最大值與 BUG-199。🔴 不得改產品程式碼（`src/lib/remote-tools/**` 非測試檔）或產品常數；不得改全域 `testTimeout`（`vite.config.ts`）；不得 skip / retry 掩蓋。根因若在產品程式碼，停下回報 PARTIAL。"
  - "🔴 範圍控制：BUG-199〈修正方向〉提到「把真子程序測試集中到共用 helper / 標記」—— 本單**不做**，只在回報區評估（目前有幾支真子程序測試設了 per-describe timeout、共用 helper 的可行性與成本），供塔台日後決定。修完後整套若出現第六支以上逾時，不擴大範圍、回報（附檔名與耗時）。"
  - "🔴 驗證：修改前整套 `npm run test:unit` 連跑 3 次記錄失敗率（對照）；修改後整套連跑 3 次 exit 0（記錄這支測試耗時）＋負載下 1 次 exit 0（例：兩個 `npm run test:unit` 同時跑，寫明造負載的方式）。`npm run typecheck` = 0。同一 checkout 有 T0792 並行跑 e2e（隔離實例），可能造成額外負載，回報區註明；不得碰 T0792 的工單檔。"
  - "🔴 BUG-199：修好後 `status: FIXED`、加 `fixed_at` / `fix_commit`，表格狀態列同步，文末補〈T0793 結果〉（根因、修法、量測）；`_bug-tracker.md` 只把 BUG-199 那一列從「⏳ 修復中 (FIXING)」移到「✅ 已修復」（區段標題照 `_local-rules.md` parser 規則），FIXING 區段放回 `_（無）_` 佔位列，更新 frontmatter `breakdown` / `generated_at` 與〈統計〉行、〈最後同步〉加一筆。🔴 不用全檔 `sed` 或一次換掉多個佔位列的替換，改完跑 parser 測試（`src/types/__tests__/` 中 bug-tracker 相關測試，L179）。"
  - "🔴 不發版、不改 CHANGELOG、不 push。公開 repo 去識別化（D176）。yolo：不得問使用者；判讀問題依 ct-exec § Questions For Tower 問塔台。Git：只用 `git commit --only` commit 本單範圍。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。完成狀態寫 `DONE`（BUG 的 FIXED 寫在 BUG 單，L177）。"
---

# T0793 — BUG-199：nvm-login-profile 測試逾時

## 元資料

- **工單編號**：T0793
- **類型**：implementation（測試穩定性）
- **互動模式**：yolo（問題問塔台）
- **優先級**：P3
- **建立時間**：2026-11-02T22:40:55+0800
- **預估規模**：S

## 背景

`0.7.3-pre.9` 聯合驗證時，`src/lib/remote-tools/__tests__/nvm-login-profile.test.ts` 的真 bash 測試在整套 `test:unit` 下超過 vitest 預設 5 s（單檔 3 / 3 通過，整檔 7.2–8.7 s）。與 BUG-195（T0786 修了 4 檔）同類，是第五支。CI Test gate（T0686）撞到會擋發版。

## 範圍

1. 量測每個測試的耗時與 bash 程序數，找出負載下變慢的地方。
2. 依優先序修（先縮短，必要時才設這個 `describe` 的 timeout）。
3. 驗證：修改前後連跑對照、負載下 1 次。
4. 評估共用 helper / 標記（只寫評估，不實作）。
5. BUG-199 → FIXED、tracker 同步。

## 不做

- 不改產品程式碼與常數、不改全域 timeout、不 skip / retry；不實作共用 helper。

## 驗收

- [ ] 量測結果（單檔 vs 整套、各測試耗時）
- [ ] 修法與理由
- [ ] 修改前後的連跑結果、負載下結果
- [ ] `typecheck` = 0
- [ ] 共用 helper 評估
- [ ] BUG-199 FIXED、tracker 只動該列、parser 測試綠

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

- **狀態**：DONE（BUG-199 → FIXED）
- **落點檢查**：PASS。C-0：`repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`；C-1 工單在 `REPO_ROOT` 下；C-3 `affects_files` 都存在；C-2 工單沒有 `branch` 欄位（目前 `main`）。不是 worktree（`CT_HOME` 未設）。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）。`CT_MODE` = `yolo`、`CT_INTERACTIVE` = `0`、`BAT_REMOTE_TOKEN` 已設定。
- **session_id**：61cc7373-8c82-4dd0-8801-38266091f4a1

### 產出摘要

**量測（先量再改）**：在 `login()` / `append()` 的 `spawnSync` 前後暫時加計時（寫 JSONL 到系統暫存目錄，標記 `T0793-TMP`；量完以備份還原整檔，`f03adbd6` 不含）。

- 每個測試開的程序：append 指令 = `sh` + subshell + `grep`；每次登入 = `sh -c 'exec "$@"'` → `bash` / `sh` / `dash` 加它的登入 profile（Git Bash 的 `/etc/profile` 本身會再開子程序；區塊裡的 `$(command -v nvm)` 也是一次 fork）。整檔 58 次 spawn：append 32、`bash -lc` 9、`sh -lc` 8、`dash -lc` 7、`bash -lic` 2。第 193 行那支 = append 1 + `bash -lc` 1 + `bash -lic` 1。
- 單檔 3 次：24 passed，整檔 7.8–8.6 s；每次 spawn 平均 append 117 ms、`bash -lc` 180、`sh -lc` 218、`dash -lc` 92、`bash -lic` 245 ms；最慢的測試 1.0 s（`bash -lc: nvm.sh with a syntax error`），第 193 行 0.41 s。
- 整套（修改前 3 次）：每次 spawn 平均變成 append 256–320 ms、`bash -lc` 356–570、`sh -lc` 457–524、`bash -lic` 325–742 ms（2–4 倍），單次尖峰 1.2–1.6 s（append 最長 1285 ms、`bash -lc` 1586 ms），出現在不同測試、不同步驟 → **沒有單一慢步驟，是均勻變慢**。本檔最慢的測試 2.6 / 2.7 / 2.3 s。
- `sh -c exec` 包裝的成本（獨立腳本，各 15 次中位數）：經 `sh` 的 `bash -lc` 201 ms vs 直接 spawn `bash.exe -lc` 123 ms；`bash -c` 34 vs 23 ms、`dash -lc` 42 vs 32 ms；`sh -lc` 反而 119 vs 201 ms（雜訊大）。包裝每次約 10–20 ms，主要成本是登入 profile 本身。

**修法與理由**：
1. ① 縮短：沒有可省的工作。每個 spawn 都是斷言需要的（append 本身是被測的產品指令；登入 shell 是被測的情境）；拿掉 `sh -c exec` 包裝只省約 10%，還要改成先解析 Git Bash 的 Windows 路徑，弱化「走 POSIX PATH、不撞到 WSL `bash.exe`」的原意；`only ~/.profile` 那支的 3 次重跑屬冪等性斷言，不是第 193 行那支的成本。
2. ② 替 `nvm login profile block under real shells (T0556)` 這個 `describe`（整檔唯一的最外層，底下每個測試都開真 shell）設 `{ timeout: 30_000 }`，與 T0786 一致；註解寫量到的最大值與 BUG-199。先以暫時測試檔確認 `describe.skipIf(cond)(name, { timeout }, fn)` 的 timeout 會套到巢狀 `describe` 與 `it.skipIf` 的測試（有設的 6 s 測試通過、對照組 5 s 逾時；暫時檔已刪）。
3. 沒改產品程式碼與常數、`vite.config.ts` 全域 `testTimeout`，沒有 skip / retry。

**BUG-199**：`status: FIXED`、`fixed_at` / `fix_commit: f03adbd6`，表格狀態列同步，處理紀錄加一筆，文末補〈T0793 結果〉。`_bug-tracker.md`：BUG-199 那一列從「⏳ 修復中 (FIXING)」移到「## ✅ 已修復」，FIXING 區段放回 `_（無）_` 佔位列，frontmatter `breakdown` FIXING 1→0、FIXED 4→5、`generated_at`、〈統計〉行、〈最後同步〉加一筆；其他列與佔位列都沒動（逐一 Edit，未用 `sed`）。

### 驗證

| 項目 | 結果 |
|---|---|
| 修改前：單檔 3 次 | 3/3 過（24 passed，整檔 8.6 / 7.8 / 8.0 s） |
| 修改前：整套 `vitest run --reporter=verbose` 3 次（= `test:unit` + verbose） | **3/3 exit 0**（385 files / 6782 passed / 10 skipped），失敗率 0/3；本檔最慢 2.6 / 2.7 / 2.3 s，第 193 行 1.7 / 0.8 / 2.1 s。本次沒有重現原事故（原事故 > 5 s） |
| 修改後：整套 3 次 | **3/3 exit 0**（385 / 6782 passed / 10 skipped）；本檔最慢 3.8 / 3.7 / 1.7 s，第 193 行 **1.0 / 3.7 / 0.9 s** |
| 負載 1：兩個 `test:unit` 同時跑（第 1 次） | 本檔兩邊都過：最慢 3.8 / **5.2 s**（`~/.bash_profile layout …`，舊的 5 s 上限下會逾時），第 193 行 3.4 / 3.2 s。整套兩邊都 **exit 1**，失敗在範圍外（下表） |
| 負載 1：兩個 `test:unit` 同時跑（第 2 次） | 本檔兩邊都過：最慢 4.7 / **5.4 s**，第 193 行 4.1 / 4.2 s。整套兩邊都 **exit 1**（6 個檔、13 / 11 個測試，全在範圍外，下表） |
| 負載 2：`test:unit` ＋ 8 個 node worker CPU 忙迴圈 90 s（`worker_threads`，暫存腳本） | **exit 0**（385 / 6782 passed）；本檔最慢 2.1 s，第 193 行 1.0 s |
| `npm run typecheck` | 0（exit 0） |
| parser 測試 `src/types/__tests__/bug-tracker.test.ts` | 12/12 passed；另以 `parseBugTracker` / `parseBugTrackerStats` / `parseBugFile` 直接解析實際檔案：63 筆、BUG-199 = `FIXED`、breakdown `FIXING 0 / FIXED 5`、`warnings: []` |

註：沒有用 `vite build` 造負載，因為同一 checkout 的 T0792 在跑 e2e（隔離實例），避免覆寫它可能使用的 `dist-electron`。所有量測期間 T0792 可能造成額外負載；機器 24 核。

**驗證後只改了註解**：`f03adbd6` 的測試檔在修改後 3 次整套與負載量測之後，只把註解的量測值更新為上述數字（程式碼不變），之後重跑單檔 24 passed、typecheck 0。

**修完後出現第六支以上逾時（範圍外，依工單不擴大、只回報）**：只在「兩個 `test:unit` 同時跑」時出現；正常整套 3 次與負載 2 都沒有。

| 檔案 | 測試 | 耗時 | 類型 |
|---|---|---|---|
| `electron/__tests__/server-bundle-install-script.test.ts` | `install script under a real sh (T0552 / BUG-139)` 多個 it（`T0554 without keep …`、`upgrade: the root ends up equal …` 等） | 5.04–6.93 s（3 次負載出現，第 2 次每邊 4 個） | 真 `sh`，預設 5 s 逾時 |
| `src/lib/remote-tools/__tests__/node-libatomic-shell.test.ts` | `the library is there: no package manager runs …` | 5.5 / 5.6 s | 真 `sh`，逾時 |
| `electron/remote/__tests__/headless-git.test.ts` | `git-scaffold:healthCheck / getRepoInfo / listCommits …` 等 3 個 | 5.0–5.2 s | 真 git，逾時 |
| `electron/__tests__/git-scaffold-env.test.ts` | 1 個 | 5.0 / 5.4 s | 真 git，逾時 |
| `electron/__tests__/terminal-blocked-state.test.ts` | `T0657: PostToolBatch clears a permission prompt …` | 5.0 / 5.3 s | 真 hook 程序，逾時 |
| `electron/__tests__/terminal-blocked-state.test.ts` | `T0790 / BUG-197: two real hook processes …`、`T0791 / BUG-198: two real hook processes …` | 0.67–1.4 s | **不是逾時**：兩個真 hook 程序的回報順序在重負載下顛倒，斷言失敗（例：`expected [ 'stop', 'user-prompt-submit' ] to deeply equal [ 'user-prompt-submit', 'stop' ]`）。3 次負載出現 |
| `electron/__tests__/worktree-status-after-close.test.ts` | `live → exited → git (registered) → …` | 30.0 s | T0786 已設的 30 s 也被超過（第 2 次負載，兩邊都是） |

### 共用 helper / 標記評估（只評估，未實作）

- **現況**：目前有 14 個測試檔替真子程序設了 per-describe / per-it timeout（不含本單）：`ct-worktree`（2 個 describe）、`ct-worktree-status`（2）、`worktree-status-after-close`、`dev-deploy-headless.test.mjs`、`headless-server`（2）、`headless-bat-scripts-log-rotation`（describe）；per-it：`headless-pty`（6）、`headless-orphan-pty`（4）、`pty-manager-deps`（3）、`headless-electron-free`（2）、`server-env-detect`（2）、`claude-agent-manager-deps`、`probe-script`。值有 15 / 20 / 30 / 40 s 幾種，`REAL_GIT_TIMEOUT_MS` 只在兩個檔各自定義。加上本單 15 檔；重負載下還有上表 5 檔會逾時。
- **選項**：
  - A. 共用常數模組（例：測試共用的 `REAL_SUBPROCESS_TIMEOUT_MS = 30_000` ＋ 理由註解），各檔 import。成本低（改 ~15 檔的 import，S）；統一數值與說明，但**擋不住新檔忘記設**，也不減少負載。
  - B. vitest 4 `test.projects` 分出「真子程序」專案（以檔名慣例如 `*.real.test.ts` 或明確清單），該專案設 `testTimeout: 30_000` 並降低平行度（`maxWorkers`）或排在其他測試之後。**唯一處理根因（同時開太多真子程序互搶 CPU）**：上表連 30 s 都被超過，表示光拉長 timeout 在重負載下仍會撞到。成本 M：改 `vite.config.ts`（屬政策，需塔台決策）、改名 / 拆分 ~20 檔（`terminal-blocked-state` 這種混合檔要拆）、CLAUDE.md「Frontend unit tests」的 include 清單同步、引用測試檔路徑的 source guard 要核對；CI `tests.yml` 呼叫 `test:unit` 不用改。
  - C. 維持逐檔處理：每出現一支開一張單（本單 S，約 20 分鐘）。
- **建議**：短期 C ＋ 把上表 5 支逾時與 T0790 / T0791 的順序斷言開成 BUG（順序斷言是測試設計問題，拉長 timeout 解決不了，應改成由測試控制兩個 hook 程序的先後）；中期若同類再出現，以 B 開 PLAN。A 的效益低於成本（改 import 不改行為）。

### 遭遇問題

- 第一次用 bash heredoc 寫暫存量測腳本時，正規式裡的 `\` 被吃成 `\`，`SyntaxError`；改用 Write 寫檔解決。只影響暫存腳本。
- 修改前 3 次整套沒有重現原事故（失敗率 0/3）；修法的必要性由負載下本檔測試 5.2 / 5.4 s（超過舊的 5 s 上限）佐證。

### 互動紀錄

- 無（沒有問塔台、沒有使用者輸入）。

### commit 狀態

- `f03adbd6` test(nvm-login-profile)：real-shell describe 30 s timeout（T0793 / BUG-199）
- `1b46a400` test(nvm-login-profile)：只改註解 —— 單檔最慢的測試是 1.0 s（原寫 0.6 s，寫回報時核對發現）；重跑單檔 24 passed。BUG-199〈T0793 結果〉同步更正
- 收尾 commit：本工單、BUG-199、`_bug-tracker.md`（`git commit --only`，見 git log）
- 沒有 push；沒碰 T0792 的工單檔（`git status` 中的 `T0792-*.md` 修改不是本單的）。暫存的量測紀錄、腳本與備份在系統暫存目錄 / scratchpad，收尾已刪除。

### 回報時間

2026-11-02T22:59:35+0800
