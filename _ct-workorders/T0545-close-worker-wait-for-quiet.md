---
schema_version: 1
schema_kind: workorder
id: T0545
title: "`--close-worker` 等分頁安靜再關：請求時最近有輸出不再回 BUSY，延遲期間輸出不取消（只有使用者輸入取消），到期仍有輸出最多再等 60 秒（D145）"
type: implementation
status: IN_PROGRESS
repo: better-agent-terminal
project: PLAN-041
priority: P1
sizing: S
created_at: "2026-10-15T20:12:07+0800"
updated_at: "2026-10-15T20:13:04+0800"
started_at: "2026-10-15T20:13:04+0800"
completed_at: ""
commit: ""
target_version: "0.6.1-pre.4"
depends_on: []
related:
  - "D145（本單決策）；D144 / PLAN-041「介面契約」與「實機驗收」節"
  - "T0535（`WorkerCloseScheduler`，`electron/close-worker.ts`）；T0536（headless 共用同一 scheduler）；T0537（已存歸屬）"
  - "T0542（實機驗收：claude 通知後約 6 秒仍輸出 → BUSY）；T0543（codex 閒置無週期輸出）"
affects_files:
  - electron/close-worker.ts
  - electron/__tests__/close-worker.test.ts
  - electron/__tests__/bat-terminal-close-worker.test.ts
  - electron/remote/__tests__/headless-close-worker-e2e.test.ts
  - scripts/bat-terminal.mjs
  - e2e/t0535-close-worker.spec.ts
  - e2e/t0537-worker-ownership-persistence.spec.ts
  - CLAUDE.md
  - _ct-workorders/PLAN-041-auto-close-worker-terminal.md
  - _ct-workorders/T0545-close-worker-wait-for-quiet.md
renew_count: 0
workdir: main repo
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 **exit code 契約不改**（`0` / `1` / `3` / `4` / `5` / `6`，CT v5.1.0 已依此實作）：`6 BUSY` 保留在契約與 helper 中供相容，只是新 BAT 不再因「最近有輸出」而回 6。參數（`--close-worker` / `--notify-id` / `--delay-ms` 0–300000）不變。"
  - "🔴 不 push、不觸發 workflow、不建 tag；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF。`src/styles/settings.css` 的 M 狀態不是你的變更；commit 用 `--only`。另有一張研究單 T0544 同時在跑（只寫它自己的工單檔），不要碰它。"
  - "🔴 不得以預設實例（無 `--runtime`）啟動 source build；e2e 用 isolated runtime。不碰使用者正在用的 BAT（port 9876）。"
  - "🔴 等待常數（5 s 安靜、60 s 上限）不得為了縮短測試時間而改產品值；測試用 fake timers 或注入點（若新增注入點，預設值即產品值）。"
  - "🔴 `package.json` 的 `version` 欄位不要動。"
---

# T0545 — `--close-worker` 等分頁安靜再關（D145）

## 背景

PLAN-041 實機驗收（2026-10-15，BAT `0.6.1-pre.3` + CT v5.1.0，詳見 PLAN-041「實機驗收」節）：

- claude Worker 通知塔台後約 6 秒仍在輸出收尾內容；塔台收單後 9 秒呼叫 `--close-worker` → `[close-worker] … → BUSY (output 2767 ms ago)`、exit 6。CT 對 6「回報、不重試」，所以實務上 claude Worker 分頁不會被自動回收。
- 30 / 90 秒後再呼叫皆 exit 0；排程 10 秒後正常關閉。codex 分頁閒置時也沒有週期輸出。

使用者決定（D145）：修在 BAT，「等分頁安靜再關」；並指示等待可放寬——不是所有電腦都很快，晚 30–60 秒才回收沒關係。

## 規格（D145）

| 時點 | 現行（T0535） | 改為 |
|---|---|---|
| 請求當下，最近 `CLOSE_WORKER_IDLE_MS`（5 s）內有輸出 | 拒絕，exit 6 `BUSY` | **照常排程**，exit 0 |
| 延遲期間有新輸出 | 取消 | **不取消** |
| 延遲期間有使用者輸入（本機視窗 `pty:write`；遠端 client 連線的 `pty:write`） | 取消 | 取消（不變） |
| 到期時最近 5 s 有輸出 | （已在上一列取消） | **等到連續安靜 5 s 再關**，從到期起最多再等 `CLOSE_WORKER_MAX_QUIET_WAIT_MS` = **60 s**；等待中有使用者輸入 → 取消；60 s 後仍未安靜 → 放棄回收、分頁保留，日誌 `[close-worker] … → cancelled (still printing 60 s after the delay)` 之類 |
| 到期時已安靜 | 關閉 | 關閉（不變） |
| 同一分頁再次請求 | 以最新一次為準 | 不變（等待中的也一併以最新為準） |
| 分頁已不存在 | 靜默結束 | 不變 |

- 歸屬 / `NOT_FOUND` / `NOT_OWNER` / `AMBIGUOUS` 檢查不變；遠端 headless 共用同一 scheduler，行為一起改。
- 日誌要能分辨：排程時是否「仍在輸出」（例：`scheduled delayMs=10000 (output 812 ms ago; will wait for quiet)`）、到期後等了多久才關（例：`close requested after waiting 7.3 s for quiet`）。
- helper 成功訊息格式 `✓ Worker close scheduled: <id> (in <n> ms)` 保留（CT 只看 exit code），可在同一行或下一行補一句「若分頁仍在輸出，會等安靜後再關（最多再等 60 s）」；`--help` 同步更新 BUSY 的說明（新 BAT 不再因最近輸出回 6）。

## 驗收條件

- [x] `electron/__tests__/close-worker.test.ts`：最近有輸出時排程成功（非 BUSY）；延遲期間輸出不取消；使用者輸入仍取消（延遲中與到期後等待中各一）；到期時仍輸出 → 安靜後關閉；60 s 仍輸出 → 放棄且未發 `terminal:close-requested`；同分頁重新請求取代等待中的排程；分頁消失時靜默結束
- [x] 既有 BUSY 相關測試依新語意改寫（不是刪掉）：`bat-terminal-close-worker.test.ts`、`headless-close-worker-e2e.test.ts`（真 headless：Worker 仍輸出時請求 → exit 0 → 安靜後關閉；client 輸入仍取消）
- [x] e2e `t0535-close-worker.spec.ts` / `t0537-…spec.ts` 若有依賴 BUSY 的步驟，改為新語意並實跑通過（需先 `npx vite build`，isolated runtime）
- [x] `CLAUDE.md`「Worker 分頁回收（PLAN-041 / T0535，D144）」的 BAT 檢查 / 延遲與取消 / 已知限制段落改寫為新語意（標 T0545 / D145）；PLAN-041「介面契約」exit 6 列補一句「BAT ≥ 0.6.1-pre.4 不再因最近輸出回 6」
- [x] `npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npm run test:unit` 全綠（回報區附數字）、`npx vite build` 成功

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

DONE — 驗收條件 5 項全部通過（含 e2e 實跑）。

**Landing check**：PASS。C-0 `repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal`（REPO_ROOT `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）；C-1 PASS；C-3 PASS（affects_files 皆存在）；C-2 無 `branch` 欄位（main）。`BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）。`CT_MODE=yolo`、`CT_INTERACTIVE=0`。

### 產出摘要

**產品（`electron/close-worker.ts`，本機與 headless 共用同一 scheduler）**
- 請求時最近 `CLOSE_WORKER_IDLE_MS`（5 s）內有輸出 → **不再回 BUSY**，照常排程 exit 0；日誌 `→ scheduled delayMs=<n> (output <m> ms ago; will wait for quiet)`。
- 延遲期間的輸出**不取消**；使用者輸入（本機視窗 / 遠端 client 的 `pty:write`）仍取消：`→ cancelled (user input during the delay)`。
- 到期（delay 0 = 請求當下）時仍在輸出 → `→ still printing (output <m> ms ago): waiting for quiet (at most 60 s)`，計時器排在「最後輸出 + 5 s」（或期限）再檢查；安靜後 `→ close requested after waiting <x> s for quiet (windows=N)`；新常數 `CLOSE_WORKER_MAX_QUIET_WAIT_MS = 60_000`，從到期起算，期限到仍在輸出 → `→ cancelled (still printing 60 s after the delay; tab kept)`，不發 `terminal:close-requested`；等待中有使用者輸入 → `→ cancelled (user input while waiting for quiet)`。
- 等待中的排程也在 `pending` 內：同分頁再次成功請求一樣以最新一次為準、`dispose()` 一併清掉、分頁消失 → 靜默結束。歸屬 / NOT_FOUND / NOT_OWNER / AMBIGUOUS 不變。常數無注入點，測試用 fake timers。
- `BUSY` 保留在 `CloseWorkerErrorCode` 型別與 helper 的 exit 6 對照（契約相容），註明 T0545 起不再回。

**helper（`scripts/bat-terminal.mjs`）**：成功訊息第一行格式不變，下一行補 `  If the tab is still printing then, BAT waits until it is quiet (at most 60 s more).`；`--help` 改寫（不再寫「最近 5 s 沒輸出」與「延遲期間輸出會取消」；註明 6 BUSY 只會來自 0.6.1-pre.4 之前的 BAT）；BUSY 的 stderr 說明補「this BAT is older than 0.6.1-pre.4」。exit code 與參數不變。

**測試**
- `electron/__tests__/close-worker.test.ts`：原 BUSY 測試改寫為「最近輸出 → 排程成功、安靜後關閉」；原「延遲期間輸出取消」改寫為「不取消、到期已安靜照常關」；新增：剛好 5 s 視為安靜、delay 0 仍輸出時等待、到期仍輸出 → 安靜後關（等 15.0 s）、60 s 仍輸出 → 放棄且無事件、期限當下剛好安靜仍關閉、等待中使用者輸入取消、新請求取代等待中排程、等待中分頁消失靜默結束（34 tests）。
- `electron/__tests__/bat-terminal-close-worker.test.ts`：成功輸出兩行、BUSY（舊 BAT）exit 6 + 新說明、`--help` 新文字（21 tests）。
- `electron/remote/__tests__/headless-close-worker-e2e.test.ts`（真 headless + node-pty）：Worker 跑輸出腳本時 delay 0 請求 → exit 0、日誌 will wait / still printing、輸出期間無事件、輸出結束 ≥ 4 s 後才收到 `terminal:close-requested`；client 輸入在延遲中與等安靜中各取消一次（8 tests，56 s）。
- e2e `t0535-close-worker.spec.ts`：移除 BUSY 重試迴圈；步驟 3 改為 Worker 跑輸出腳本時 delay 0 回收 → exit 0、日誌、輸出中分頁仍在、結束後關閉且日誌 `close requested after waiting x.x s for quiet`。`t0537-…spec.ts`：重試只剩 NOT_FOUND（PTY 尚未還原），關閉等待 timeout 15 s → 30 s。

**文件**：`CLAUDE.md`「Worker 分頁回收」節標題、契約（exit 6 註記、成功第二行）、BAT 檢查、延遲 / 等安靜 / 取消（改寫）、已知限制、遠端 headless、驗證清單；PLAN-041「介面契約」exit 6 列補「BAT ≥ 0.6.1-pre.4 不再因最近輸出回 6」。

**驗證**
| lane | 結果 |
|---|---|
| `npm run typecheck` | PASS，exit 0 |
| `npm run typecheck:electron` | PASS，exit 0 |
| `npm run test:unit` | PASS：Test Files 237 passed (237)；Tests 3947 passed / 1 skipped (3948) |
| `npx vite build` | PASS |
| e2e `npx playwright test e2e/t0535-close-worker.spec.ts e2e/t0537-worker-ownership-persistence.spec.ts --workers=1`（isolated runtime `e2e-t0535-*` / `e2e-t0537-*`，未碰 9876 的 BAT） | PASS：2 passed (47.5 s) |

**未驗證**：真 claude Worker 的實機回收（T0542 情境）需含本修正的 BAT 版本（0.6.1-pre.4）後由塔台再驗。

### 互動紀錄
無（`CT_INTERACTIVE=0`，fire-and-forget）。

### Renew 歷程
無

### 遭遇問題
- 無產品面阻礙。過程中以 shell heredoc 經 Python 改測試檔時，`\r?\n` 被轉成真實 CR/LF 字元導致轉譯失敗，已以位元組層級修正，最終檔案全為 LF。
- 未動：`src/styles/settings.css`（既有 M，非本單）、`_ct-workorders/T0544-*.md`（另一張研究單）、`package.json` version；未 push、未建 tag、未觸發 workflow。
- PLAN-041「實機驗收」節的「**待決**：修在 CT 或 BAT」一行未改（工單只要求改介面契約 exit 6 列），留給塔台依 D145 更新。

### 回報時間
2026-10-15T20:24:52+0800
