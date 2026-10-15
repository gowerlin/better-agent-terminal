---
schema_version: 1
schema_kind: workorder
id: T0540
title: "PLAN-042：Windows Terminal Server 模式關閉分頁時，shell 底下的子程序（claude / codex / node）是否一併結束；未結束則修正"
type: implementation
status: IN_PROGRESS
repo: better-agent-terminal
project: PLAN-042
priority: P2
sizing: S
created_at: "2026-10-15T16:13:05+0800"
started_at: "2026-10-15T17:05:11+0800"
updated_at: "2026-10-15T17:05:11+0800"
target_version: "0.6.1-pre.3"
depends_on: [T0535]
related:
  - PLAN-042
  - T0534（研究回報 §1.2：server 模式 `killPty` 只呼叫 `entry.pty.kill()`，沒有 `taskkill /T`）
  - PLAN-041（自動回收依賴「關閉 = 程序真的結束」）
affects_files:
  - electron/terminal-server/server.ts
  - electron/pty-manager.ts
  - electron/__tests__/
  - e2e/
  - CLAUDE.md
  - _ct-workorders/T0540-terminal-server-kill-process-tree-windows.md
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 不碰使用者正在用的 BAT（port 9876、真實 userData）與它的 Terminal Server。實測一律隔離實例；子程序用 node 腳本模擬 agent CLI，不耗 token。"
  - "🔴 **禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）；寫檔 LF；不 push；不跑全套 e2e（L141）。`src/styles/settings.css` 的 M 狀態不是你的變更，不要 commit 它；commit 用 `--only`。"
  - "🔴 child_process 只用 `execFile` / `spawn` + array args，必設 timeout；pid 必須是數字（CLAUDE.md「Child Process Spawning」）。"
  - "🔴 改 `electron/**` 驗收 `npm run typecheck:electron` = 0；`npx vite build` 成功。"
---

# T0540 — Windows Terminal Server 關閉分頁的子程序樹

## 背景

direct 模式的 `PtyManager.kill` 在 Windows 另外跑 `taskkill /F /T`；Terminal Server 模式（預設）的 `killPty` 只呼叫 `entry.pty.kill()`。shell 底下的 agent CLI 會不會殘留，T0534 未實測。PLAN-041 的自動回收會讓這條路徑被頻繁使用，殘留程序會持續累積。

## 任務

1. **實測**（隔離實例，Windows）：在分頁內以 shell 啟動長駐 node 腳本（模擬 claude / codex，可再 spawn 一層子程序），分別以 ✕ 關閉、`pty:kill`、`pty:restart`、app quit（`stopTerminalServer=true` / `false`）結束，記錄 shell、子程序、孫程序是否還在（`tasklist` / `Get-CimInstance Win32_Process` 查父子關係）。pwsh 與 cmd 各測一次。
2. **結論**：殘留則修正。方向：server 端 kill 前以 `taskkill /F /T /PID <pid>`（`execFile`、timeout、pid 數字驗證）結束整棵樹，或其他更合適的方式；與 direct 模式行為一致。`pty:restart` 同樣適用。不得影響 quit 時 `stopTerminalServer=false` 保留終端的行為。
3. macOS / Linux：以程式碼確認 node-pty `kill()` 對程序群組的處理，必要時說明，不要求本單實測。
4. **文件**：CLAUDE.md 記錄關閉時的程序樹處理方式。

## 驗收條件

- [x] 實測表（情境 × shell × 是否殘留，修正前 / 後）
- [x] 修正有單元測試（以注入的 execFile 驗證參數與 timeout、pid 驗證）
- [x] `npm run typecheck:electron` = 0、`npx vite build` 成功、相關單元測試全綠

## 回報區

### 結果摘要

**有殘留，已修正。** Windows Terminal Server 模式關閉分頁時，node-pty 的 `kill()` 會結束 shell、agent，以及共用 console 或 `windowsHide` 啟動的孫程序；但 agent 以 `detached`（DETACHED_PROCESS，沒有 console）啟動的孫程序，在 ✕ / `pty:kill` / `pty:restart` / quit（stopTerminalServer=true）後**全部殘留**。direct 模式有 `taskkill /T`，會一起收掉，所以兩種模式行為不一致。修正後 Terminal Server 模式與 direct 模式一致，所有情境 0 殘留；quit 不停止 server（`stopTerminalServer=false`）照舊保留全部程序。

另一個發現：quit Step A 在 Windows 送的 `child.kill('SIGTERM')` 實際上是 TerminateProcess，server 的 SIGTERM handler 和 `shutdown()` 都不會執行，所以光修 server 端不夠，Step A 也改了（見「偏差」）。

### 實測（隔離實例）

- 方法：scratchpad harness 依 `electron/main.ts` `startTerminalServer` 的參數（Electron as node、`detached`、ipc）fork `dist-electron/terminal-server.js`，`BAT_USER_DATA` 用 temp 目錄（自己的 pid / port 檔與 TCP port），完全不碰使用者 9876 的 BAT。PTY 內以 shell 執行 `node agent-sim.js`（模擬 agent CLI），它再 spawn 3 個長駐孫程序：`gcConsole`（預設 spawn，共用 console）、`gcHidden`（`windowsHide`）、`gcDetached`（`detached` + `windowsHide`）。執行動作後等 7 s，用 `Get-CimInstance Win32_Process` 查 pid 存活（比對 image name 防 pid 重用）。不耗 token。
- 修正前 bundle = HEAD `2eecac42` 的 build；修正後 = 本單 build。
- 情境對應：✕ → `closeTerminalNow` → `pty.kill` → `PtyManager.kill` → server `pty:kill`（與 `pty:kill` 情境相同，以程式碼追蹤確認，未另開 UI 實測）；`pty:restart` = `pty:kill` + 同 id `pty:create`；quit stop=true 修正前 Step A = `kill('SIGTERM')`，修正後 Windows Step A = IPC `server:shutdown`；Step B / recovery「重新開始」= TCP `server:shutdown`；quit stop=false = BAT 斷開 IPC。

| 情境 | shell | 修正前殘留 | 修正後殘留 |
|---|---|---|---|
| ✕ / `pty:kill` | pwsh | `gcDetached` | 無 |
| ✕ / `pty:kill` | cmd | `gcDetached` | 無 |
| `pty:restart` | pwsh | `gcDetached` | 無（新 shell 正常建立） |
| `pty:restart` | cmd | `gcDetached` | 無（新 shell 正常建立） |
| quit stop=true（Step A） | pwsh | `gcDetached`（SIGTERM = TerminateProcess） | 無（IPC `server:shutdown`） |
| quit stop=true（Step A） | cmd | `gcDetached` | 無 |
| quit stop=true（Step B TCP shutdown / 重新開始） | pwsh | `gcDetached` | 無 |
| quit stop=true（Step B TCP shutdown / 重新開始） | cmd | `gcDetached` | 無 |
| quit stop=false | pwsh | 全部保留（預期） | 全部保留（預期，不變） |
| quit stop=false | cmd | 全部保留（預期） | 全部保留（預期，不變） |
| （參考）對 server `kill('SIGTERM')` | pwsh / cmd | `gcDetached` | `gcDetached`（server 被強制終止，server 端修正無從執行；Windows Step A 已不再用這條） |

- shell、agent、`gcConsole`、`gcHidden` 在修正前就會在 kill / restart / quit 時結束（node-pty 會結束 attach 在 pseudo console 的程序）；修正前後唯一的差別是 `gcDetached`。
- pseudo console：kill 後 7 s 時 server 底下已沒有 conhost（修正前後都一樣）；restart 只剩新 PTY 的 conhost + shell。
- 原始資料：scratchpad `t0540/results-before.json`、`results-before2.json`、`results-after.json`（session 暫存，不進 repo）。

### 修正內容

- `electron/terminal-server/process-tree.ts`（新增）：`killProcessTree(pid, deps)`，`execFile('taskkill', ['/F','/T','/PID', String(pid)], { timeout: 3000, windowsHide: true })`。pid 須為正安全整數，否則回 `invalid-pid` 不執行；非 win32 回 `not-windows`；永不 reject（失敗 / 逾時 / spawn 例外回 `failed`）。`execFile` / `platform` 可注入。
- `electron/terminal-server/server.ts`：`killPty` 改走 `endPty`：Windows **先** taskkill 整棵樹，**完成後**才 `pty.kill()`（釋放 pseudo console）；順序不可對調，否則 shell 先死，`taskkill /T` 找不到孫程序。entry / registry 仍同步移除（restart 與 BUG-101 stale-exit 邏輯不變）；非 Windows 照舊同步 `pty.kill()`。`shutdown()` 等全部 `endPty` 結束才清 pid / port / registry 並 `exit(0)`；加 `shuttingDown` 防重入，shutdown 期間的訊息忽略。constructor 加第 3 個參數 `deps`（測試注入 execFile / platform / exit），既有呼叫端不用改。
- `electron/main.ts` `stopTerminalServerGracefully` Step A：Windows 改 `child.send({ type: 'server:shutdown' })`，macOS / Linux 仍 `kill('SIGTERM')`；日誌改成實際使用的方式（`via IPC server:shutdown` / `via SIGTERM`）。Step B–D 不變。
- `CLAUDE.md`：新增「關閉分頁時的程序樹（T0540 / PLAN-042）」一節，並更新 Worker 分頁回收「已知限制」裡指向 T0540 的那一句。
- `electron/pty-manager.ts`：**沒有改**。server 模式的 kill 只送 `pty:kill`，direct 模式本來就有 taskkill。

### macOS / Linux（只看程式碼，未實測）

node-pty `UnixTerminal.kill(signal)` = `process.kill(this.pid, signal || 'SIGHUP')`，只送給 shell pid，不送給程序群組。互動 shell 收到 SIGHUP 會轉送給自己的 job；shell 是 session leader，它結束時 kernel 會對 controlling tty 的前景程序群組送 SIGHUP，所以一般 agent CLI 會一起結束。`setsid` / `nohup` / detached daemon 在兩種模式下都會殘留（direct 模式在 Unix 也只呼叫 `kill()`），兩種模式一致，本單不改。quit 在 Unix 仍是 SIGTERM → server handler → `shutdown()` → 每個 PTY `pty.kill()`。

### 驗證

| 項目 | 結果 |
|---|---|
| `npm run typecheck:electron` | ✅ exit 0 |
| `npm run typecheck` | ✅ exit 0 |
| `npx vite build` | ✅ exit 0（`dist-electron/terminal-server.js` 7.80 kB，內含 taskkill） |
| `electron/__tests__/terminal-server-kill-tree.test.ts`（新增，25 個測試：taskkill 參數 / timeout / windowsHide、10 種不合法 pid 不執行、非 Windows 不執行、失敗不 reject、taskkill → pty.kill 順序、失敗仍 pty.kill、restart 只殺舊 pid、shutdown 等全部 taskkill 才 exit / 刪 pid 檔、重入與 shutdown 期間訊息忽略、Unix 行為不變、main.ts Step A source guard、Windows 真 node-pty + detached 孫程序 kill 後消失） | ✅ |
| `terminal-server-stale-exit.test.ts`、`pty-manager-server-exit.test.ts` | ✅ |
| `npx vitest run electron/` | ✅ 119 files / 2156 passed / 1 skipped |
| `npm run test:unit`（全套 unit） | ✅ 235 files / 3925 passed / 1 skipped |
| 隔離實測（上表，修正前 / 後） | ✅ |
| e2e | 未跑（L141 不跑全套；本單未新增 e2e spec，見下方說明） |

### 偏差 / 說明

1. **`electron/main.ts` 不在 `affects_files`**：quit stop=true 是任務第 1 步列出的情境，修正前在 Windows 會殘留，而且光改 server 端修不到（SIGTERM = TerminateProcess，server 程式碼根本沒有執行的機會）。依「殘留則修正」在 Step A 做了最小改動，並以 source guard 測試保護。
2. **新增 `electron/terminal-server/process-tree.ts`**：讓 taskkill 能注入測試，放在 `terminal-server/` 底下，`affects_files` 沒有列。
3. **沒有新增 e2e**：驗收條件只要求單元測試。✕ 的路徑經程式碼追蹤，最後同樣是送 server `pty:kill`，已由隔離 harness 實測，並由 Windows 真 node-pty 單元測試涵蓋。
4. **測試輸出雜訊**：shell 被 taskkill 之後，`pty.kill()` 觸發的 node-pty console list agent 會印 `Error: AttachConsole failed`（測試 stderr；正式環境 server 的 stdio 是 ignore）。node-pty 等約 5 s 後走自己的 fallback 關閉 pseudo console，direct 模式本來就是這樣。測試結果不受影響。

### 殘餘風險

- node-pty 的 5 s fallback 會 `process.kill(innerPid)` 已結束的 shell pid，理論上有 pid 重用的風險。這是 node-pty 既有行為，direct 模式也一樣，本單沒有處理。
- `taskkill` 3 s 逾時而 shutdown 的 PTY 很多時，Step A 的 1.5 s 等待可能先逾時，改走 Step B / C / D；Step D 會對 server 做 `taskkill /F /T`，整棵樹仍會被結束。
- macOS / Linux 未實測（工單不要求）。

### Landing Zone Check

- 結果：**PASS**
- C-0：frontmatter `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal` → PASS
- C-1：工單位於 `REPO_ROOT/_ct-workorders/` → PASS
- C-3：`electron/terminal-server/server.ts`、`electron/pty-manager.ts`、`electron/__tests__/`、`e2e/`、`CLAUDE.md` 都存在 → PASS
- C-2：無 `branch` 欄位；HEAD = `main`
- `BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）
- 模式：`CT_MODE=yolo`、`CT_INTERACTIVE=0`

### Commit

（commit 後補上 hash）
