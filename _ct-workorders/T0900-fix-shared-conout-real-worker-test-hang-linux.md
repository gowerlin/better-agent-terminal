---
schema_version: 1
schema_kind: workorder
id: T0900
title: "查修 BUG-219（在 `v0.8.x`）：Linux CI 上 `shared-conout.test.ts`「the real Worker script relays a pipe」逾時 20 s —— 找根因並修正，不靠拉長 timeout"
type: implementation
status: DONE
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: M
created_at: "2026-11-25T02:48:36+08:00"
updated_at: "2026-11-25T02:58:34+08:00"
completed_at: "2026-11-25T02:58:34+08:00"
started_at: "2026-11-25T02:49:32+08:00"
target_version: "0.8.0-pre.3"
depends_on: []
related:
  - "BUG-219；pre-release run `45460440287`（第一次嘗試 tests / unit-tests failure）；D325（使用者 2026-11-25：「依建議」）；T0887 / T0889 / T0890（共用 conout Worker 與其測試）；PLAN-066"
  - "CLAUDE.md「Windows PTY holder」「Terminal Server 存活判定與 recovery」「Frontend unit tests」各節；`docs/agent-guide/terminal-server-recovery.md`、`docs/agent-guide/pty-holder.md`"
affects_files:
  - _ct-workorders/T0900-fix-shared-conout-real-worker-test-hang-linux.md
  - electron/__tests__/shared-conout.test.ts
  - electron/__tests__/shared-conout*.test.ts
  - electron/terminal-server/shared-conout.ts
  - electron/terminal-server/shared-conout-worker.cjs
renew_count: 0
session_ids:
  - "08b54acc-17be-4f4a-925c-833a3b1ba723"
isolation: worktree
workdir: "worktree ct/T0900（塔台 2026-11-25 從 `v0.8.x` `7063e45e` 建立分支）"
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 分支與 worktree：只在 worktree 分支 `ct/T0900` 寫檔。開工時確認 `git -C \"$CT_WORKTREE\" merge-base HEAD v0.8.x` = `7063e45ee4eb201c27b39454c440f0c9bed99f20`，不符就停下問塔台（BAT 印的 `base` / `CT_WORKTREE_BASE` 可能是與 main 的共同祖先，屬預期）。不 merge / rebase、不切分支、不 push、不動 `main` 與 `v0.8.x`。主 checkout 只能寫本工單檔（`git -C \"$CT_HOME\" commit --only _ct-workorders/<本檔>`）。"
  - "🔴 先查根因：失敗只在 GitHub Actions ubuntu-24.04 出現一次（`electron/__tests__/shared-conout.test.ts:233` describe，`open → ready, data reaches the <pipe>-worker client, close → closed; an unreachable pipe → closed only for that id`，20 s 逾時）；pre.1 CI 同檔 1.0 s 通過；Windows 本機多次通過。可用 `gh run view 45460440287 -R gowerlin/better-agent-terminal --log-failed`（唯讀；只取該測試相關段落，回報區不貼大段 log）看失敗前後的輸出，並用 `--attempt` 比對重跑結果。本機有 WSL `Ubuntu-24.04`：可以在 WSL 裡（repo 複製到 WSL 檔案系統的暫存目錄、`npm ci`）反覆單獨跑這個檔與整套平行跑來重現（例：`npx vitest run electron/__tests__/shared-conout.test.ts --repeat`／迴圈 50 次，記錄失敗率與耗時）；量測完刪除 WSL 內的暫存複本。找出掛在哪一步（unix socket 的 open / ready / data / close 事件、不可達 pipe 的 closed、Worker 結束時序、等待條件）。"
  - "🔴 修正原則：根因在測試（等待條件太窄、事件順序假設、資源沒清）→ 修測試；根因在產品程式（`shared-conout.ts` / `shared-conout-worker.cjs` 在非 win32 的 unix socket 路徑）→ 先問塔台並附證據，因為 CLAUDE.md 規定共用 conout 在非 win32 的行為不得改變。🔴 不得只拉長 timeout、不得 `skip` 這個測試；任何 timeout 調整都要附量測依據。若無法重現，回報 `PARTIAL`：附重現嘗試紀錄、程式碼分析與加強診斷的建議（例：失敗時印出已收到的事件序列），不要猜修。"
  - "🔴 驗證：worktree（Windows）`npm ci`；`npm run test:unit` 全綠（第一次完整執行，附 passed / files 數）；`npm run typecheck` = 0、`npm run typecheck:electron` = 0；`npx vite build` exit 0。WSL Ubuntu-24.04 上修正後的檔案連續跑 ≥ 50 次 0 失敗（附修正前的失敗率對照）。不碰使用者正在用的 BAT（安裝版 `0.8.0-pre.1`）與其 userData / Terminal Server / `bat-pty-holder`；不跑 `t0859-pty-holder.spec.ts`；不觸發 GitHub workflow（要在 CI 上驗證先問塔台）。`TMP` 用系統預設（T0716）。程序清理照 D308（只結束本單啟動且可追溯的、一次一個、不 `taskkill /T`，WSL 內同理）。"
  - "🔴 Git：worktree 用 `git add <明確路徑>`；不 push、不建 tag。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF；含反斜線的內容用 Write／Edit 工具寫（L129）。收單前 `git -C \"$CT_WORKTREE\" status --porcelain` 必須為空。CLAUDE.md 與 docs 不改（建議文字寫在回報區）。"
  - "🔴 公開 repo（D176）：回報區路徑用 repo 相對路徑或 `<使用者資料夾>`（WSL 家目錄寫 `/home/<使用者>`）。yolo：不得問使用者，判讀問題依 ct-exec § Questions For Tower 問塔台。"
---

# T0900 — 查修 BUG-219：Linux CI 上 `shared-conout` 真 Worker 測試掛住

## 背景

`0.8.0-pre.2` 的 pre-release run `45460440287` 第一次嘗試在 `tests / unit-tests`（ubuntu-24.04）失敗：只有 `electron/__tests__/shared-conout.test.ts`「the real Worker script relays a pipe」逾時 20 s，其餘 464 檔全過；Test gate 擋下 build / release。pre.1 CI 同檔 1.0 s 全過，本批（T0891 / T0893–T0898）沒有改這個檔或 `shared-conout*`。共用 conout Worker 只在 win32 生效，所以這是 Linux 上的測試掛住，不影響 Linux 使用者；但它會讓 CI Test gate 偶發擋發版。詳見 `_ct-workorders/BUG-219-shared-conout-real-worker-test-hang-linux-ci.md`。

使用者 2026-11-25 指示「依建議」（D325）：重跑過了照常發 pre.2，BUG-219 另開工單查根因；重跑仍失敗則停發版、先修。

## 驗收

- [x] 根因說明（重現紀錄、失敗率、卡在哪一步）
- [x] 修正（測試或經塔台同意的產品程式）；WSL 連續 ≥ 50 次 0 失敗
- [x] Windows `test:unit` 全綠、兩個 typecheck = 0、`vite build` exit 0
- [x] 隔離分支證據

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯（唯一例外：`### 待塔台決策` 的 `塔台答覆 Q-n` 行由塔台新增）

### 完成狀態
- **狀態**：DONE（驗收四項全過；BUG-219 建議由塔台改 `FIXED`，下一次 Linux CI `tests / unit-tests` 綠燈後 `CLOSED`）
- **session_id**：08b54acc-17be-4f4a-925c-833a3b1ba723
- **落點檢查**：PASS。C-0 `repo` = `better-agent-terminal`，`basename "$CT_HOME"` = `better-agent-terminal`；C-1 工單在 `$CT_HOME/_ct-workorders/` 下；C-3 `affects_files` 皆存在（萬用字元與 `_ct-workorders/` 項除外）；C-2 工單沒有 `branch` 欄位，不適用。`CT_HOME` 已設定，`CT_WORKTREE_BRANCH` = `ct/T0900`，`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）。開工時 `git merge-base HEAD v0.8.x` = `7063e45ee4eb201c27b39454c440f0c9bed99f20`，與工單要求相符。

### 產出摘要

**根因（測試的競態，產品程式沒有問題）**

`electron/__tests__/shared-conout.test.ts` 的「open → ready, data reaches the <pipe>-worker client, close → closed…」在 `await closed` 之後才對 client 掛 `'close'` listener：

```ts
await closed
await new Promise<void>((resolve) => client.on('close', () => resolve()))   // 原寫法
```

Worker 的 `close(id)`（`electron/terminal-server/shared-conout-worker.cjs`）先 `client.destroy()`，之後才 `postMessage({ type: 'closed' })`。在 Linux（unix socket）上，主執行緒常常先收到 EOF，client 跑完 `'end'` → `'close'`，之後才處理 `closed` 訊息。這時才掛上的 listener 不會再觸發，測試一直等到 20 s 逾時。卡住的位置是「等 client close」，不在 open、ready、data 或不可達 pipe 的 closed。Windows 的 named pipe 偵測到關閉比較慢，訊息通常先到，所以本機一直通過。同檔 T0889 的 `close` 測試已經是正確寫法：先建立 promise，再送 `close`。

**重現（WSL Ubuntu-24.04，node v24.22.0，與 CI 的 v24.22.3 同一條線；repo 以 `git archive` 複製到 WSL 暫存目錄，照 `tests.yml` 跑 `npm ci --ignore-scripts` 與 `node node_modules/electron/install.js`）**

| 量測 | 修正前 | 修正後 |
|---|---|---|
| 單獨的 node 重現腳本（依原測試的步驟，記錄掛 listener 時 client 是否已 close），閒置 | 500 次中 475 次（95%）client 已先 close | — |
| 同上，另開 30 個忙碌 thread 模擬負載 | 300 次中 257 次（86%） | — |
| `npx vitest run electron/__tests__/shared-conout.test.ts`（整檔） | 3/3 失敗（剛建好複本時）＋ 10 次中 1 次失敗；失敗的那次 `Test timed out in 20000ms`，每次約 21.6 s | **60 次連續通過，0 失敗**，每次 1.58–4.06 s（平均 1.87 s） |
| 同上，只跑這一個測試（`-t 'relays a pipe'`） | 10 次中 1 次失敗 | — |

vitest 下修正前共 23 次失敗 5 次（約 22%）。觸發條件只是兩個事件的先後，失敗率會隨機器負載與時序變動，所以 CI 大多會過（pre.1 1.0 s 過），偶爾逾時。依 22% 估算，60 次全過只靠運氣的機率約 10⁻⁷；就算失敗率低到 10%，也只有約 0.2%。

**CI 失敗紀錄（run `45460440287` attempt 1，job `138681245849`）**：同檔其他 21 個測試都在 4–619 ms 內通過，只有這一個 20010 ms 逾時；vitest 的逾時訊息不會指出卡在哪一步，所以卡住的位置由上面的重現判定。attempt 2 的 `tests / unit-tests` 為 success。

**修正**：只改測試。在送 `close` 之前就建立 `clientClosed` promise（`once('close')`），`await closed` 之後再 `await clientClosed`。timeout 不動（仍是 20 s），沒有 `skip`。`shared-conout.ts`、`shared-conout-worker.cjs` 都沒改，共用 conout 在非 win32 的行為不變。

**改動檔案**：`electron/__tests__/shared-conout.test.ts`（+5／−1，含 3 行說明註解）

**驗證（Windows worktree）**
- `npm ci`：exit 0（結尾的 install-scripts 警告與 CLAUDE.md 說明一致，屬預期）
- `npm run test:unit`（第一次完整執行，在 `6b907f6b`）：exit 0，Test Files **464 passed** | 3 skipped (467)，Tests **8513 passed** | 42 skipped (8555)，62.91 s
- `npm run typecheck`：exit 0（0 個錯誤）
- `npm run typecheck:electron`：exit 0（0 個錯誤）
- `npx vite build`：exit 0
- 依規定沒跑 `t0859-pty-holder.spec.ts`、沒觸發 GitHub workflow、沒碰使用者的 BAT。`gh` 只做唯讀查詢（`run view`、`api …/attempts/1/jobs`）。

**清理**：WSL 內的 `/tmp/bat-t0900-*`（repo 複本、迴圈日誌、重現腳本產生的暫存 socket 目錄）已全部刪除，確認剩 0 個。本單沒有留下需要結束的程序（測試程序都自己結束；重現腳本的忙碌 thread 由腳本自己 terminate）。scratchpad 裡的 HEAD tar 也已刪除。

**後續建議（給塔台，本單未改）**
- 修正已在 `ct/T0900`；合併進 `v0.8.x` 後，下一次 pre-release 的 Linux `tests / unit-tests` 就是 BUG-219 的實際驗證。
- 可考慮在 FIELDGUIDE／測試準則補一條：「等 socket／stream 事件（`close`、`end`）時，先掛 listener 再觸發動作；不要在另一個 `await` 之後才掛」。CLAUDE.md 與 docs 依工單規定不改。

### 互動紀錄
- [02:49] 開工：讀工單、`_local-rules.md`、CLAUDE.md；落點檢查 PASS；merge-base 確認相符；status → IN_PROGRESS
- [02:50] 讀 CI log（attempt 1）：只有此測試 20010 ms 逾時，log 沒有指出卡在哪一步
- [02:51] 程式分析：懷疑 `await closed` 之後才掛 client `'close'` listener 是競態；同檔 T0889 的 close 測試用先掛後送的寫法
- [02:52] WSL 單獨重現腳本：95%／86% 的情況 client 在掛 listener 之前已 close，競態確認
- [02:53] WSL vitest 整檔 3/3 逾時；修正測試並 commit `6b907f6b`
- [02:54–02:57] Windows 驗證（兩個 typecheck、vite build、test:unit）全過；WSL 修正後 60/60 通過
- [02:57] 第一次的修正前迴圈因 `$D` 在 wsl 指令中展開成空字串，跑的是不存在的檔案，結果作廢；改用腳本檔重跑修正前量測（10 次只跑此測試 → 1 失敗；10 次整檔 → 1 失敗）

### Renew 歷程
無

### 遭遇問題
- 第一次的修正前 WSL 迴圈：變數在 Git Bash → `wsl.exe` 的跨層引號中沒有展開，修正前的檔案沒有建立，該輪 10 次「失敗」是找不到測試檔，不是逾時。結果已作廢，改用腳本檔重跑，上表只列有效的數字。
- WSL 預設 node 是 v26.13.0；改用 nvm 已安裝的 v24.22.0，比較接近 CI 的 v24.22.3。
- `gh run view --log-failed` 在 run 還沒跑完時拒絕輸出（attempt 2 進行中），改用 `gh run view … --attempt 1 --job 138681245849 --log` 取得。

### 隔離分支證據
- branch：`ct/T0900`
- base_sha：`06c3b8843caf4f34bbec6117b0de443b7a3fdbf9`（`CT_WORKTREE_BASE`，與 main 的共同祖先；與 `v0.8.x` 的 merge-base 為 `7063e45ee4eb201c27b39454c440f0c9bed99f20`）
- validated_sha：`6b907f6b51ae9aec2f6baa3e1fbfb3207d6883d1`（`test:unit` 在這個 commit 上跑。兩個 typecheck 與 vite build 是在 commit 前對同一份工作樹跑的：當時唯一的改動就是這個檔，內容與 commit 相同）
- head_sha：`6b907f6b51ae9aec2f6baa3e1fbfb3207d6883d1`
- validated_sha ≠ head_sha 的說明：兩者相同

### 回報時間
- 2026-11-25T02:57:40+08:00
