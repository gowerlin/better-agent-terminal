---
schema_version: 1
schema_kind: workorder
id: T0867
title: "修 `terminal-server-protocol-v1.test.ts` E 組在 Linux runner（`tests.yml`，ubuntu-24.04）必定失敗的計時競爭——`0.7.5-pre.1` 的 Test gate 前置"
type: implementation
status: DONE
started_at: "2026-11-05T10:26:24+0800"
updated_at: "2026-11-05T10:39:36+0800"
completed_at: "2026-11-05T10:39:36+0800"
session_ids:
  - "4e988704-8005-45b3-9359-977e0e8ac399"
repo: better-agent-terminal
project: PLAN-065
priority: P1
sizing: S
created_at: "2026-11-05T10:25:21+0800"
depends_on: [T0866]
related:
  - "T0866 回報區〈驗證〉⚠️、〈後續建議〉1；desktop-build `41952687778` / `41952701482` 的 `tests` job；T0857（加入該測試）；CLAUDE.md「Frontend unit tests」fake timers 規則（T0508：fake timers 下不要用 `vi.waitFor` 等 socket 事件，改事件驅動的 `until()`）；「Packaging / Release 前置檢查」Test gate"
affects_files:
  - _ct-workorders/T0867-protocol-v1-test-linux-timing.md
  - electron/__tests__/terminal-server-protocol-v1.test.ts
  - electron/__tests__/
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 只改測試：讓 E 組（`3 late ticks with the server process (pid file) alive …`、`a pong ends the late run …`）在 Linux runner 上穩定，斷言的意義不變（不得降低期望值、拉長到失去意義、或 skip）。若查證發現是產品程式在 Linux 上真的錯（不是測試等待不足）→ 停下回報 PARTIAL，不改產品。"
  - "🔴 驗證要在 Linux 上：可 push `origin main`（push 前掃金鑰樣式、家目錄路徑、`.private/` 去識別化樣式，結果寫回報區；不 force-push），可手動觸發 `tests.yml`（`gh workflow run tests.yml -R gowerlin/better-agent-terminal --ref main`），上限 5 次；要求最後一次 `tests.yml` 整個 job 綠（`test:unit` 與 `test:legacy`）。可用 WSL 先在本機 Linux 跑該檔（有的話），不是必要。不跑 `pre-release.yml` / `release.yml` / `desktop-build.yml`，不建 tag / Release。`gh` 一律帶 `-R gowerlin/better-agent-terminal`（L122）。"
  - "🔴 yolo：不得問使用者；問題問塔台。不發版。Git：只 commit 本單範圍（`git add <明確路徑>`）。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。公開 repo（D176）：回報區不寫真名、客戶名、家目錄路徑。"
---

# T0867 — protocol v1 測試 E 組的 Linux 計時競爭

## 元資料
- **工單編號**：T0867｜**類型**：implementation｜**狀態**：DONE｜**建立**：2026-11-05 10:25 (UTC+8)
- **規模**：S｜**依賴**：T0866

## 背景
T0866 的兩次 desktop-build（`41952687778`、`41952701482`）`tests` job 都失敗在 `electron/__tests__/terminal-server-protocol-v1.test.ts` E 組兩項（收到的 ping 2 < 12 等）；本機 Windows 通過。這是 T0857 加的真 socket＋fake timer 測試，之前的 desktop-build 用 `checks=false`，CI 沒跑到。`pre-release.yml` / `release.yml` 的 Test gate 用同一個 `tests.yml`（ubuntu-24.04），不修就擋 `0.7.5-pre.1`。

## 任務
1. 查證失敗原因（看 run 的 log；可能是 `advance` 後只 `flush(20)`，真實 socket 的資料在 Linux 上來不及到）。
2. 改測試的等待方式（照 CLAUDE.md T0508 規則：事件驅動等待、`setInterval` 逐拍推進），斷言不變。
3. 本機 `npm run test:unit` 全過；push 後觸發 `tests.yml`，最後一次整個 job 綠。

## 驗收條件
- [x] 失敗原因（一兩句）
- [x] `tests.yml` 綠（附 run id）；本機 `npm run test:unit` 全過、`npm run typecheck:electron` = 0
- [x] commit 只含本單範圍

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 待塔台決策

#### Q-1：push 範圍內塔台的未推 commit `2a16acde` 命中去識別化樣式，要怎麼處理才能 push？
- **提問時間**：2026-11-05 10:33 (UTC+8)
- **狀況**：本單要 push `origin/main`（`origin/main..HEAD` = `2a16acde`、`e7c802c0`、`74251312`、`c0dfaa27`）才能在 Linux 跑 `tests.yml`。push 前掃描（`.private/` 對照表樣式＋金鑰樣式，對象是這 4 個 commit 的新增行與 commit 訊息）命中 1 行：`2a16acde`（T0866 回報區「push 前掃描」那一行）把兩個去識別化檢查詞原文寫出來（`.private/` 對照表第六節的工作區代號＝專案D、與帳號小寫單字）；同一行另外兩個樣式（客戶名的一個樣式、外掛殘留標籤）也是原文寫出，金鑰前綴則是樣式本身。origin 上目前沒有這兩個詞。其他樣式（客戶名、家目錄路徑、真的權杖）0 筆。Worker 的 commit `c0dfaa27`（只改測試檔）沒有命中。
- **選項**：
  - A. 塔台自己改寫未 push 的 `2a16acde`（把那一行改成「依 `.private/` 的檢查樣式」），完成後在本單答覆，Worker 再掃一次並 push。
  - B. 授權 Worker 改寫 `origin/main..HEAD` 的歷史：把 T0866 那一行改成「依 `.private/` 的檢查樣式」，以 fixup commit＋非互動 `GIT_SEQUENCE_EDITOR=: git rebase -i --autosquash origin/main` 併進 `2a16acde`（4 個未推 commit 的 hash 都會變；不 force-push，因為都還沒推）。
  - C. 判定可接受（只是樣式名稱、沒寫出對應對象），照原樣 push。
  - 其他。
- **建議**：B（或 A）。公開 repo 一旦 push 就無法收回（D176：「有命中先處理再 push」）；這 4 個 commit 都還沒推，現在改寫歷史沒有成本。B 由 Worker 一次做完，比 A 少一次往返；但這動到 T0866 工單檔與塔台的 commit，超出本單 `affects_files` 與 L138（禁止 `git reset` 等），所以需要塔台明確授權。
- **影響**：不 push 就無法完成驗收（`tests.yml` 綠）。
- **是否阻擋後續步驟**：是（push 與 `tests.yml` 都卡在這裡；本機修正與 `npm run test:unit` 已完成）。
- **通道**：BAT（`q-d6f39273-f1f7cd848e936e4c`，10:35 答覆 choice 1 = A）

### 完成狀態
- **狀態**：DONE（Worker 步驟全部完成；`tests.yml` 一次就綠）
- **session_id**：4e988704-8005-45b3-9359-977e0e8ac399

### 失敗原因
E 組的 `advance()` 把 12 個 heartbeat tick 一口氣推完後只 `flush(20)`；ping 送到 fake server、pong 回到 manager 都是真的 loopback socket I/O，CI（ubuntu-24.04，整套 vitest 平行跑、負載高）20 ms 內還沒到（12 個 ping 只收到 2 個；回 pong 那拍的 pong 還沒被處理 → 沒有 `late pong arrived` 日誌）。產品程式沒問題：同測試裡 heartbeat 判斷本身的斷言（`no recovery` 日誌、不 refork、沒有 status）在 CI 都過了，失敗的只是「等 socket 資料」的部分。

### 修改內容
`electron/__tests__/terminal-server-protocol-v1.test.ts`（只改測試，斷言一字未改）：
- `advance()` 仍以 1 s 為一步同時推 `setInterval` 與 fake 單調時鐘，但每一步後 `settle()`：以 `until()`（真的 `setTimeout` 輪詢；`setTimeout` 沒被假造）等到「heartbeat 經 `sendToServer` 送出的 ping 數＋hello 開頭那個 ping（`helloOpeningLines`）＝fake server 收到的 ping 數」且「fake server 寫出的 pong 數（新增 `FakeTcpServer.pongsWritten`）＝manager `handlePong` 被呼叫次數」。兩個計數都是 call-through spy（`vi.spyOn(manager, 'sendToServer')`、`handlePong`），不改行為。效果：每個 ping（與它的 pong）在下一拍之前落地，和實際 10 s 一拍的順序相同。拿掉原本的 `flush(20)`。
- E 組的 4 個 `vi.waitUntil(…, { timeout: 2000 })` 改成 `until(…, 2000)`（逾時不變）：vitest 的 `waitUntil` 在 fake timers 下每次輪詢都會 `advanceTimersByTime`（`node_modules/vitest/dist/chunks/test.*.js` 實查），會偷推被假造的 heartbeat interval（CLAUDE.md T0508 規則）。B 組 line 214 那個在假造 `setTimeout` 的測試裡、沒有失敗，不在本單範圍，沒動。

### 驗證
- 本機（Windows）：該檔連跑 3 次 37/37 PASS；`npm run test:unit` exit 0（454 files passed / 3 skipped，8324 tests passed / 41 skipped）；`npm run typecheck:electron` = 0。
- Linux CI：`tests.yml` run **`41956226940`**（第 1 / 5 次，`--ref main`，headSha `3f2de5bc`）：conclusion **success**；`Unit tests (vitest)` success（455 files passed / 2 skipped，`terminal-server-protocol-v1.test.ts` 37 tests ✓）、`Legacy tests` success（files 33/33、tests 472 passed / 0 failed）。
- 沒跑 `pre-release.yml` / `release.yml` / `desktop-build.yml`，沒建 tag / Release。

### Commit 與 push
- 產品（測試）commit：`f685ff21` `test(T0867): …`（原 `c0dfaa27`，塔台改寫 T0866 那一行時重算 hash，內容不變；只含 `electron/__tests__/terminal-server-protocol-v1.test.ts`）。
- 工單 commit：`05104f8b`（Q-1，原 `e3131c70`）、本結單 commit。
- push：`git push origin main`（一般 push、未 force）`ccbad4c9..3f2de5bc`。push 前掃描兩次，對象 `origin/main..HEAD` 新增行與 commit 訊息：第一次命中 1 行（T0866 回報區，塔台的未推 commit）→ Q-1；塔台改寫後第二次，`.private/` 對照表第五、六節的去識別化檢查樣式、家目錄路徑樣式、金鑰樣式皆 0 筆；push 時多出的塔台 commit `3f2de5bc`（`_tower-state.md`）另掃 0 筆。

### 落點檢查
- PASS。C-0：`repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`；C-1 PASS；C-3 PASS（`electron/__tests__/terminal-server-protocol-v1.test.ts` 存在）；C-2 無 `branch` 欄位。`CT_HOME` 未設定（非 worktree）。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`；`BAT_REMOTE_TOKEN` 已設定；`CT_MODE` = `yolo`。

### 互動紀錄
- [10:33] Q-1: push 範圍內塔台未推的 `2a16acde` 有一行把去識別化檢查詞原文寫出，怎麼處理？ → A（塔台）: A，塔台已以 plumbing（沒有 rebase / reset / stash）改寫 5 個未推 commit 的那一行，其他不變；新 hash `9bbd18fe` / `8aca4f5b` / `230ae3bf` / `f685ff21` / `05104f8b`；請確認 HEAD、自己再掃一次再一般 push → Action: `git log` 確認 HEAD = `05104f8b`、測試 commit 內容不變，重掃 0 筆後 push，觸發 `tests.yml`。

### 遭遇問題
- push 被塔台未推 commit 的去識別化命中擋住一次（Q-1，已由塔台處理）。本回報與 Q-1 都沒有寫出檢查詞原文。

### 後續建議
1. B 組 `a connection that never says hello …`（line 214）也在 fake timers 下用 `vi.waitUntil`；目前在 Linux 通過，但同屬 T0508 規則的寫法，可另開小單一起改成 `until()`。
