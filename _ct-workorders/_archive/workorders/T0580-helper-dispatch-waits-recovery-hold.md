---
schema_version: 1
schema_kind: workorder
id: T0580
title: "BUG-146 補完：Recovery 提示待決時，helper 派工（create-with-command / create-agent-command）與 pty:restart 也要等 create hold 放行"
type: bugfix
status: DONE
started_at: "2026-10-17T20:18:17+0800"
updated_at: "2026-10-17T20:31:18+0800"
completed_at: "2026-10-17T20:31:18+0800"
repo: better-agent-terminal
project: BUG-146
priority: P2
sizing: S
created_at: "2026-10-17T20:16:57+0800"
target_version: "0.7.0-pre.1（與 T0575–T0579 同版，D151）"
depends_on: [T0578]
related:
  - "T0578 回報區「殘留風險 / 後續建議」1（同步 `create()` 呼叫者未涵蓋）與 3（CLAUDE.md 過時段落）"
  - "BUG-146、T0576（pending 權杖：Recovery 期間存活分頁的塔台仍可認證並派工）"
affects_files:
  - electron/terminal-command-handlers.ts
  - "electron/handlers/pty.ts（`pty:restart`）"
  - "electron/__tests__/**（新增 / 修改）"
  - "e2e/t0578-recovery-no-direct-shell.spec.ts（擴充一個 test，或新檔 e2e/t0580-*.spec.ts）"
  - "CLAUDE.md（「遠端 Tower 通知」節 T0576 的「時序（T0575 實測）」段落，以及「Recovery 提示期間的 `pty:create`」節）"
  - _ct-workorders/T0580-helper-dispatch-waits-recovery-hold.md
renew_count: 0
workdir: main repo
interaction:
  mode_hint: on
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 不 push、不觸發 workflow、不建 tag、不改版號；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF；含反斜線的內容用 Write 工具（L129）。commit 用 `git commit --only <你改的檔>`（`src/styles/settings.css` 的 M 不是你的變更）。"
  - "🔴 不碰使用者正在用的 BAT（port 9876）與它的 Terminal Server；實測一律用隔離實例（需先 `npx vite build`）；teardown 以 pid 檔 + 命令列比對停掉隔離 Terminal Server、刪 runtime userData（T0575 / T0576 / T0578 皆遇過 `app.close()` 不返回）。"
  - "🔴 headless 不 hold（`whenCreatesReleased` 須立即 resolve），headless 行為與測試不得改變；沒有 hold 時兩條路徑的行為與回傳值須與修正前完全相同。"
---

# T0580 — helper 派工與 restart 等 create hold 放行

## 背景

T0578 讓 Recovery 提示待決時 `pty:create` 排隊（`PtyManager.holdCreates` / `whenCreatesReleased`），但同步呼叫 `ptyManager.create` 的路徑沒有涵蓋：`terminal:create-with-command`（`electron/terminal-command-handlers.ts` `createWithCommand`，約 423 行；agent 模式 `create-agent-command` 也經這裡）與 `pty:restart`（`electron/handlers/pty.ts` 約 119 行）。T0576 後，Recovery 期間存活分頁的塔台以還原的 pending 權杖就能認證派工 → 新 Worker 在 hold 中走 direct shell，放行後寫入卻送 server（server 不認得該 id）。目前只有 `[BUG-146] … spawns directly while creates are held (synchronous caller)` warn。

## 任務

1. `createWithCommand` 建立 PTY 前 `await ptyManager.whenCreatesReleased()`（在 cwd 檢核之後、`create` 之前；位置自行判斷，日誌記一行等待）；`pty:restart` 同理（handler 可回 Promise）。
2. 放行後：派工的新 id 應建在 Terminal Server 上（「保留」）或新 server 上（「重新開始」）；`reusedExisting` 判斷要在放行後重新計算。
3. 確認 T0578 的 synchronous-caller warn 在這兩條路徑不再出現；其他仍同步呼叫 `create` 的地方（若有）列在回報區。
4. CLAUDE.md：把「遠端 Tower 通知」節 T0576「時序（T0575 實測）」段落改為現況（T0578 後 Recovery 期間不再 direct spawn；pending 機制保留，涵蓋同步路徑），並在「Recovery 提示期間的 `pty:create`」節補上 helper 派工與 restart 也等放行。

## 驗收條件

1. `npx vite build` 成功；`npm run typecheck` = 0、`npm run typecheck:electron` = 0；`npm run test:unit` 全綠。
2. 單元測試：hold 中 `createWithCommand` / `pty:restart` 不 spawn，放行後建立；「保留」/「重新開始」兩種放行；沒有 hold 時行為不變；headless 不受影響。
3. e2e（隔離實例）：退出不停 Terminal Server → 重開 → Recovery 待決期間，在存活的塔台分頁內執行 `bat-terminal.mjs` 派工（raw command 即可）→ helper 在使用者回答前不完成（或完成但 Electron 主程序下無 direct shell）→ 選「保留」→ Worker 分頁的程序在 Terminal Server 樹下、輸入輸出正常。回歸 `t0578`、`t0576`。
4. 回報區附修正前 / 後對照。

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 結果摘要

**DONE**。Recovery 提示待決期間，`terminal:create-with-command`（含經它的 `terminal:create-agent-command`）與 `pty:restart` 不再 direct spawn：

- `createWithCommand` 在參數 / cwd / shell 檢核之後、`create` 之前等 `whenCreatesReleased`，**最多 `HELPER_CREATE_HOLD_WAIT_MS` = 2 s**。期間放行 → 照常建立（「保留」建在存活的 Terminal Server、「重新開始」建在新 server），`reusedExisting` 放行後重算；仍未放行 → 回 `{ ok:false, code:'RECOVERY_PENDING', error }`（helper 既有的結構化拒絕處理 → exit 1 `Failed to create terminal (RECOVERY_PENDING): …`），該等待移出 hold，**之後也不會建立**。
- `pty:restart` 在 hold 中回 Promise，放行後才 `restart`（renderer invoke 無逾時，不設上限）。
- `PtyManager.whenCreatesReleased(id?, { timeoutMs?, channel? })` 改回 `Promise<boolean>`（逾時 → `false`、移出 waiters / heldIds）；無 hold 立即 `true`。既有 `pty:create` 呼叫（`.then(create)`）不受影響。

### 與工單的偏離（YOLO，Worker 自行決策）

工單任務 1 寫「`await ptyManager.whenCreatesReleased()`」（未限時）。**改為限時 2 s**，原因：`bat-terminal.mjs` 的 invoke 等待是 3 s（`waitForMessage` 預設，`scripts/bat-terminal.mjs` 約 984 行）。無限等待時 helper 會先 exit 1 `Invoke response timeout`，而 Worker 在使用者回答後仍被建立 → 塔台（只信 exit code）以為派工失敗、可能重派 → 同一工單兩個 Worker。限時 2 s 讓 helper 一定拿到明確答案：2 s 內回答 → exit 0；否則 exit 1 `RECOVERY_PENDING` 且確定沒有建立。實務上 Recovery 提示通常數秒內就回答，若塔台在提示開著時派工會收到 exit 1，需在回答後重派。helper 腳本不需修改（`affects_files` 外）。

### 修正前 / 後對照（同一個 e2e，隔離實例；修正前 = 暫時把 3 個原始檔換回 `f03e5e27~1` 後 build，跑完已從 HEAD 換回並重新 build）

| 項目 | 修正前 | 修正後 |
|---|---|---|
| 提示未回答時派工 | helper 98 ms exit 0 `✓ Terminal created` | 2080 ms exit 1 `RECOVERY_PENDING` |
| 日誌 | `[WARN] [BUG-146] pty:create id=1740… spawns directly while creates are held (synchronous caller)` → `Created terminal using node-pty` | `terminal:create-with-command id=ee5e… held … (at most 2000 ms)` → `[WARN] … not created: the Recovery prompt is still unanswered after 2000 ms`；無 `Created terminal using node-pty` |
| Electron 主程序下（Terminal Server 樹外）的 shell | `pwsh.exe` pid 46320（= Worker 命令的父程序） | `[]` |
| 「保留」後 | Worker 不在 server registry（只有 Tower）；renderer 寫入 → `[ERROR] server error: … pty:write … PTY 1740… not found` | 被拒的那次之後也沒建立（released 清單只有 `[tower, 8a10…]`，registry 只有 Tower + 新 Worker） |
| 等待中回答「保留」 | （不適用：不等待） | helper 141 ms exit 0；`released: reused=false` → `pty:create 8a10… → Terminal Server` → `server spawned PTY 8a10… (pid 46832)`；Worker 命令 `ppid` = 46832 = server PTY pid；分頁內 `PPID=` 指令輸出一次（`[46832]`） |

### 修改檔案

- `electron/pty-manager.ts`：`whenCreatesReleased` 加 `timeoutMs` / `channel`、回 `Promise<boolean>`；`create()` 的 synchronous-caller warn 註解更新（warn 保留為防線）。
- `electron/terminal-command-handlers.ts`：`RECOVERY_PENDING`、`HELPER_CREATE_HOLD_WAIT_MS`、`DispatchRefusal.code` 擴充、`TerminalPtyManager` 加選用的 `isCreateHeld` / `whenCreatesReleased`、`createWithCommand` 等待與重算 `reusedExisting`。
- `electron/handlers/pty.ts`：`pty:restart` 在 hold 中等放行。
- `electron/__tests__/recovery-dispatch-hold.test.ts`（新，14 tests）。
- `e2e/t0580-recovery-helper-dispatch.spec.ts`（新）。
- `CLAUDE.md`：「Recovery 提示期間的 `pty:create`」節：「未涵蓋」改為新條目「helper 派工與 `pty:restart` 也等放行（T0580）」、日誌與驗證補 T0580；「遠端 Tower 通知」節 T0576「時序（T0575 實測）」改為「時序」，寫明 T0578 / T0580 後 Recovery 期間不再 direct spawn、pending 機制保留。

### 驗證

| 閘門 | 結果 |
|---|---|
| `npx vite build` | PASS（修正後最終狀態已重新 build） |
| `npm run typecheck` | PASS（0） |
| `npm run typecheck:electron` | PASS（0） |
| `npm run test:unit` | PASS：270 files、4771 passed / 3 skipped（stderr 的 `AttachConsole failed` 為既有雜訊，T0540 已記錄；新測試檔另以 3 次重跑確認本身不產生） |
| 單元：hold 中派工 / restart 不 spawn、保留 / 重新開始放行、`reusedExisting` 重算、2 s 逾時拒絕且之後不建立、不影響其他排隊 create、無 hold 不變、headless 不 hold | PASS（`recovery-dispatch-hold.test.ts` 14/14；T0578 `recovery-create-hold.test.ts` 12/12） |
| e2e `t0580-recovery-helper-dispatch.spec.ts` | PASS（35.1 s） |
| e2e 回歸 `t0578-recovery-no-direct-shell.spec.ts`（2）+ `t0576-capability-persist-restart.spec.ts`（2，含 control） | PASS（4 passed，2.0 m） |

e2e 方法：塔台分頁內先啟動 node watcher（在 server PTY 內，跨 BAT 重開存活），測試在 temp 目錄放 `go-<n>.json` 觸發，helper 以**塔台分頁自己的 env** 執行（只把 `BAT_REMOTE_PORT` 指到新實例，同 t0576）。提示開著時分頁輸入送不到（PtyManager 尚未認得該 id），所以不能用「打字進分頁」的方式。

### 其他仍同步呼叫 `create` 的地方

- `electron/` 內對 `PtyManager.create` 的呼叫只剩 `PtyManager.createWithResult`（`pty:create` handler 已等）與 `PtyManager.restart`（`pty:restart` handler 已等）；外部只有 `createWithCommand`（本單已等）。目前沒有呼叫者會觸發 synchronous-caller warn。
- `handleServerDeath` 的 recovery 重建直接送 server `pty:create`（不 direct spawn，且只在已連線時發生），不受 hold 影響。

### 殘留風險 / 後續建議

1. 提示開著時塔台派工會 exit 1 `RECOVERY_PENDING`（不再是靜默壞掉的 Worker）。CT 的 auto-session 對 exit 1 的處理（重試 / 改手動）不在本單範圍；若希望 CT 對 `RECOVERY_PENDING` 等候後自動重派，需 CT 側調整（`bat-terminal.mjs` stderr 已有固定字樣 `(RECOVERY_PENDING)`）。
2. agent 模式（`create-agent-command`）在進到 `createWithCommand` 前的步驟（registry、`checkAgentAvailable`）若本身耗時，加上 2 s 等待可能超過 helper 的 3 s；一般情形這些步驟為毫秒級。
3. RemoteServer 的權杖檢查「只能建新 id」用 `isTerminalAlive`；Recovery 待決時 PtyManager 尚未認得存活 id，理論上可指定存活 id。helper 一律產生隨機 id，未處理（記錄供參考）。

### Commit

- `f03e5e27` fix(T0580): helper dispatch and pty:restart wait for the Recovery create hold (BUG-146)（`git commit --only`；`src/styles/settings.css` 的 M 未動）
- 工單回報另以 `(ct)` commit。未 push。

### Landing Zone

- PASS。C-0：`repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`。C-1 PASS。C-3 PASS（`electron/terminal-command-handlers.ts` 等存在）。C-2：無 `branch` 欄位。
- `BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）。
- 環境：`CT_MODE=yolo`、`CT_INTERACTIVE=0`；未碰使用者的 BAT（9876）與其 Terminal Server，所有實測皆隔離實例，teardown 確認 Terminal Server 已停、runtime userData 已刪。

## 塔台結案（2026-10-17T20:33:57+0800）

**DONE**（source / test 層；實機隨 `v0.7.0-pre.1`）。塔台完整複驗 @ `079b5e35`：`npx vite build` 0、`npm run typecheck` 0、`npm run typecheck:electron` 0、`npm run test:unit` 270 檔 / 4771 passed / 3 skipped。`f03e5e27` 範圍與 affects_files 一致；工作樹乾淨（修正前對照用的暫時換檔已還原）。

塔台裁決：
- 偏離「等待限時 2 s，逾時回 `RECOVERY_PENDING` 且之後不建立」：**接受**（helper invoke 逾時 3 s，無限等待會讓 helper exit 1 但 Worker 仍被建立 → 重派造成同一工單兩個 Worker）。
- 殘留 1（CT 對 `RECOVERY_PENDING` 的處理）：補充給 CT-T014（對方 T0149）作提示文字；不要求自動重派。
- 殘留 2 / 3：記錄，不處理。

