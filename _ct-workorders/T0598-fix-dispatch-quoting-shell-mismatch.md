---
schema_version: 1
schema_kind: workorder
id: T0598
title: "BUG-151：helper 派工在 Git Bash 分頁送出 PowerShell 形式指令 —— 查根因並修正，讓引號一律依分頁實際啟動的 shell"
type: bugfix
status: DONE
repo: better-agent-terminal
project: PLAN-047
priority: P1
sizing: M
created_at: "2026-10-18T02:43:24+0800"
started_at: "2026-10-18T02:45:28+0800"
updated_at: "2026-10-18T04:19:32+0800"
completed_at: "2026-10-18T03:02:58+0800"
depends_on: [T0593]
related:
  - BUG-151
  - BUG-149
  - "T0593 回報區（`quotingShell`、`getDefaultShell`）"
  - "CLAUDE.md「BAT MCP shim（PLAN-047 M1 / T0584）」小節最後一段（BUG-149 / T0593）；docs/agent-guide/bat-mcp-shim.md"
  - "並行工單 T0597（BUG-150：`electron/terminal-blocked-state.ts`、blocked 測試與 `docs/agent-guide/blocked-state.md`）"
affects_files:
  - electron/terminal-command-handlers.ts
  - "electron/shell-path-resolver.ts（只在根因需要時）"
  - "electron/pty-manager.ts（只在根因需要時）"
  - "electron/main.ts（只在根因需要時：派工 deps 組裝）"
  - "electron/claude-runtime-router.ts / electron/claude-resolver.ts（只在根因在 claude 路徑分支時）"
  - "electron/__tests__/ 下對應的測試檔（新增或修改）"
  - "e2e/（新增一支 git-bash 預設 shell 的派工 spec，或擴充 e2e/t0592-codex-tower-worker.spec.ts 以外的既有派工 spec）"
  - "docs/agent-guide/bat-mcp-shim.md（只改 BUG-149 / quotingShell 相關段落）"
  - "CLAUDE.md（只改「BAT MCP shim」小節最後一段，且只在規則改變時）"
  - _ct-workorders/T0598-fix-dispatch-quoting-shell-mismatch.md
renew_count: 0
workdir: main repo
interaction:
  mode_hint: on
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 不 push、不觸發 workflow、不建 tag、不改版號；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF；含反斜線的內容用 Write / Edit 工具（L129）。`src/styles/settings.css` 的 M 不是你的變更。"
  - "🔴 並行：T0597 同時在主 checkout 改 `electron/terminal-blocked-state.ts`、blocked 相關測試、`e2e/t0590-blocked-state.spec.ts`、`docs/agent-guide/blocked-state.md`。你不碰這些檔；commit 一律 `git commit --only <你的檔>`，commit 前 `git diff --cached` 只能有你的變更。"
  - "🔴 不得在使用者或其他塔台的分頁送任何輸入（含 BMad-Guide 的 T0161 Worker 分頁 `7b14ff899afa15d3e920fc0999726362`）；不得替 BMad-Guide 重派 T0161。日誌只引用 `[agent-command]` / `[bat-mcp]` / `[pty]` 等派工相關行，不貼權杖。"
  - "🔴 實機重現用隔離實例或 e2e，不動使用者正在跑的 BAT；不呼叫模型（假 claude 即可）。"
---

# T0598 — BUG-151：派工引號的 shell 與分頁實際 shell 不一致

## 背景

見 BUG-151。要點：

- BAT `0.7.0-pre.4`；`settings.json` `shell = "git-bash"`、`customShellPath = ""`。
- BMad-Guide 塔台 02:29 派 T0161（`--workspace bc439ad7-…`、`--cwd "D:\ForgejoGit\@Gower_Labs\BMad-Guide"`、`--agent default`）→ exit 0，分頁 `7b14ff899afa15d3e920fc0999726362` 為 Git Bash，卻收到 `, '<使用者資料夾>\.local\bin\claude.exe' '--mcp-config=…' '--settings=…' --dangerously-skip-permissions --effort high '/ct-exec T0161'` → `bash: ,: command not found`。
- 本工作區（better-agent-terminal，`cc0afc4a-…`）02:26 派 T0596 正常，設定檔相同。
- `settings.json` 的 `claudeRuntime` = `{"mode":"system","fallbackToEmbedded":true}`（T0596 查證），系統 claude 為 `<使用者資料夾>\.local\bin\claude.exe`。

## 要做的事

1. **根因**：從本次啟動的 debug log（`%APPDATA%\BetterAgentTerminal\Logs\debug-20261018-020939.log`）找 T0161 分頁與 T0596 分頁（`12245ee949b53ebbf6d63af24d9fe5fe`）各自的 `[agent-command] id=… shell family=… from=…` 與組出的指令、`pty:create` 實際 shell，對照兩者差在哪裡（工作區層級設定 / 環境變數、落點視窗、claude 路徑解析分支 `resolveClaudeBase(opts.shellFamily)`、`quotingShell` 的 `resolution.shell` 來源…）。說明開頭 `, ` 是怎麼來的。
2. **修正**：派工的引號 shell family 必須與 PTY 實際啟動的 shell **同一個來源決定**（不要兩處各自推導）。修正後補測試：至少涵蓋 `shell = git-bash`（本單情境）、缺 `shell` 鍵（BUG-149 情境，不得回歸）、`pwsh` / `cmd` 明確設定，以及根因指出的那個條件。
3. **helper exit code**：評估「指令已送出但分頁內的 shell 報錯」是否能讓 helper 得知（例如送出後短時間內 PTY 輸出含 `command not found` / 程序未啟動）。**只評估、寫建議，不實作**（契約變更需塔台決定）。
4. **繞道**：在回報區寫給 BMad-Guide 塔台的暫時繞道（修正版發佈前怎麼派工能起得來；例如 helper 是否有參數可指定 shell，或工作區設定可調）。若沒有可行繞道，明說。

## 驗收

- 回報區：根因（附日誌行，標「實測 / 推論」）、修正摘要、新增測試、繞道、第 3 點建議。
- `npm run test:unit` 全綠（回報 passed / files 數）；`npm run typecheck` = 0；`npm run typecheck:electron` = 0；`npx vite build` 成功；新增 / 修改的 e2e 通過。
- 若改到 codex 派工路徑，跑 `e2e/t0592-codex-tower-worker.spec.ts`（CLAUDE.md 規定 codex 相關變更必跑）。
- commit 只含 `affects_files`；訊息 `fix(dispatch): …（BUG-151, T0598）`。

---

## 回報區

### 落點檢查

- **PASS**。C-0：`repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`（`REPO_ROOT` = `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）。C-1 PASS。C-3：`electron/terminal-command-handlers.ts` 等存在（informational）。C-2：無 `branch` 欄位。`CT_HOME` 未設（非 worktree）。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）。
- 狀態欄原值是 `TODO`（非 `PENDING`），照常改為 `IN_PROGRESS`。

### 結論（一句話）

**引號沒有錯，根因是「派工指令寫入前，打進新分頁的輸入被接在指令前面」**。開頭的 `, ` 是一次鍵盤輸入，不是 PowerShell 前綴。已修正：該段輸入改為等指令寫完再送出；另把派工 shell 改為只解析一次（spawn 與引號同值），滿足第 2 點。

### 1. 根因

**兩次派工的日誌對照**（`debug-20261018-020939.log`，實測）：

| | T0596（正常） | T0161（壞） |
|---|---|---|
| `[agent-command]` | L546 `id=12245ee9… shell family=posix from=persisted` | L635 `id=7b14ff89… shell family=posix from=persisted` |
| `shell-resolution` | L550 `basename=bash.exe persistedShell=git-bash source=persisted fallback=no` | L639 同左 |
| BAT MCP 注入 | L547 `'--mcp-config=…' '--settings=…'`（posix） | L636 同左 |
| pty:create | L552 → Terminal Server | L641 → Terminal Server |
| 分頁焦點 | L561 `isActive effect → doResize terminal=12245ee9…` | L650 `isActive effect → doResize terminal=7b14ff89…`（18:29:57.284） |

- 兩者 shell family、實際 shell、claude 路徑解析分支（system claude、posix `quoteCommandPath` → `'C:\…\claude.exe'`）完全相同（實測）。PowerShell 形式會以 `& '…'` 開頭（`src/utils/shell-quote.ts` `quoteCommandPath`），不會是 `,`（程式分析）。回報中的「PowerShell 形式」實際是 posix 單引號字串，bash 也接受；壞掉的只有開頭多出的 `, `。
- **`, ` 的來源**（機制實測，誰打的屬推論）：
  - 派工分頁落在使用中的工作區時會取得鍵盤焦點：`addExternalTerminal`（`src/stores/workspace-store.ts`，BUG-135 / T0532）設 `focusedTerminalId`，TerminalPanel 的 `isActive` effect 呼叫 `terminal.focus()`（即上表 L650 那一行）。
  - 主行程在 PTY 建立 **500 ms 後**才寫入啟動指令（`createWithCommand` 的 `delay(…, 500)`）。這段時間打進來的字經 xterm → `pty:write` 先進新 shell 的輸入緩衝，指令接在後面，成為同一行。
  - 實測 1（node-pty 直接起 `C:\Program Files\Git\bin\bash.exe --login -i`，cwd = BMad-Guide，500 ms 寫指令）：先寫 `, ` → `$ , 'C:\nonexistent\claude.exe' …` / `bash: ,: command not found`，與回報逐字相同。先寫 xterm 的自動回應則是別的垃圾：CPR `\x1b[1;1R` → `RC:\…`、DA1 `\x1b[?1;2c` → `bash: 1: command not found`；focus report `\x1b[I` / `\x1b[O` 無影響。⇒ `,` 不是終端自動回應，是一般輸入。
  - 實測 2（e2e，隔離實例，修正前的 build）：`shell = "git-bash"`、分頁加入 150 ms 後由 renderer `pty.write` 寫 `, ` → 分頁輸出 `$ , echo T0598-MARKER '/ct-exec T0598'` / `bash: ,: command not found`。
  - 推論：使用者當時正在 BMad-Guide 視窗打字給塔台（塔台 15ac6815 在 18:29:48–55 有輸出；18:27:29 有 `[blocked] … cleared (user input)`）。18:29:57.27 焦點跳到 T0161 分頁，18:30:00.50 又切回塔台（L672–673：15ac6815 active=true、7b14ff89 active=false），約 3 秒，符合「打字時焦點被搶走、發現後切回」。日誌不記錄按鍵內容，無法直接證明是誰打的 `, `。
  - T0596 正常的原因（推論）：那 500 ms 內沒有人打字。與工作區設定、落點視窗、claude 路徑無關。

### 2. 修正（commit `45943d16`）

- **輸入保留到指令之後**（處理根因）：`PtyManager.holdInputForDispatch(id)` / `writeDispatchCommand(id, command)`（`electron/pty-manager.ts`）。`createWithCommand` 在建立成功、排程寫入前呼叫 hold；到期時先寫指令，再依序寫出期間收到的輸入。`writeWithResult`（`pty:write` 的路徑）在 hold 期間回 `{ ok: true, reason: 'held-until-dispatch' }`。終端自動回應（`isTerminalAutoReply`）不擋；PTY 結束（`recordExit`）時清掉。輸入不丟棄，只是移到指令之後。日誌只記筆數與位元組數：`[agent-command] id=<id> input before the dispatch command: <n> write(s), <bytes> bytes → sent after it`。本機與 headless 共用（headless 也用 `PtyManager`）；沒有這兩個方法的 pty manager 照舊 `write`。
- **派工 shell 只解析一次**（第 2 點的要求）：`quotingShell` 改為 `resolveDispatchShell`（`electron/terminal-command-handlers.ts`），讀一次 `settings.json`，回傳 `spawn`（交給 `PtyManager.create`）與 `quoting`（`detectShellFamily` 的輸入），兩者同值。`create-agent-command` 把結果傳給 `createWithCommand`，後者不再自己讀設定、自己推導。沒有持久化 shell 時 `create` 直接帶 `getDefaultShell()` 的路徑（T0593 時是不帶 `shell`、由 `create` 再呼叫一次 `getDefaultShell()`，結果相同）。`shell-resolution` 日誌與 `bat-scripts.log` 多一個 `spawn=<檔名>`。經 `invokeHandler` 轉送時（目前只在測試）以同一個函式重新解析。
- 文件：`docs/agent-guide/bat-mcp-shim.md`（BUG-149 段改寫，新增 BUG-151 段）；`CLAUDE.md`「BAT MCP shim」小節最後一段（`quotingShell` 改名，加上 🔴 不得另行推導與輸入保留的規則）。

### 新增 / 修改的測試

- `electron/__tests__/dispatch-input-before-command.test.ts`（新，8 tests）：Terminal Server 模式的真 PtyManager（fake fork channel）：`, ` 接在指令後、多筆順序與 UTF-8 位元組數、自動回應（`\x1b[I`、CPR）不擋、沒有輸入不記錄、kill 結束 hold、未知 id 不 hold；`terminal:create-agent-command`（git-bash）端到端：create 收到 `bash.exe`、create 與 500 ms 指令之間的輸入接在指令後；舊介面 fallback `write`。
- `electron/__tests__/dispatch-shell-family.test.ts`（改，15 → 21 tests）：新 describe「BUG-151 / T0598」：git-bash（本單情境：posix、claude 路徑 `'C:\…'` 開頭、不以 `&` / `,` 開頭、日誌含 `spawn=bash.exe`）；git-bash / 缺 `shell` 鍵（BUG-149）/ pwsh / cmd 各自「每次派工只讀一次設定、create 收到的 shell 與引號 family 一致」；讀取期間設定被改（第一次 git-bash、第二次 pwsh）也不會分家。缺鍵三案與「真 PtyManager Windows」改為斷言 `create` 收到預設 shell 路徑（原為 `undefined`，T0598 的刻意變更）。source guard 改守 `resolveDispatchShell` 的單一來源。
- `e2e/t0598-dispatch-input-before-command.spec.ts`（新）：見上「實測 2」。**修正前紅、修正後綠**：修正後輸出 `$ echo T0598-MARKER '/ct-exec T0598'` / `T0598-MARKER /ct-exec T0598`，`, ` 落在下一個提示字元；debug log 有 `shell family=posix from=persisted`、`spawn=bash.exe`、`input before the dispatch command: 1 write(s), 2 bytes → sent after it`。非 Windows 或沒有 Git for Windows 時 skip。

### 驗收

| 項目 | 結果 |
|---|---|
| `npm run test:unit` | ✅ PASS：292 files passed，5089 passed / 3 skipped |
| `npm run typecheck` | ✅ 0 |
| `npm run typecheck:electron` | ✅ 0 |
| `npx vite build` | ✅ 成功 |
| e2e `t0598-dispatch-input-before-command` | ✅ 1 passed（修正前 build：failed，`bash: ,: command not found`） |
| e2e 回歸：`t0523-dispatch-workspace`、`t0583-worktree-isolated-dispatch`、`t0580-recovery-helper-dispatch`、`t0592-codex-tower-worker`（2 tests） | ✅ 5 passed（1.3 m）。這次改的寫入路徑 codex 派工也會經過，所以 t0592 也跑了 |

- 實機（使用者正在跑的 BAT `0.7.0-pre.4`）沒有動；修正要等下一個版本才會生效。

### 3. 建議：helper 能否得知「指令已送出，但 shell 報錯」（只評估，未實作）

- 現況（程式分析）：`terminal:create-agent-command` 在 `ptyManager.create` 回來後立即回應 helper，指令 500 ms 後才寫入，所以 helper exit 0 的時候指令還沒送出。helper 不可能知道結果。
- 方案：
  - A. **claude 的 `SessionStart` hook 當作「已啟動」信號**（建議）。`scripts/bat-hook.mjs` 已經經 `terminal:report-hook` 回報 hook（T0590）。主行程記下「agent 已啟動」，`terminal:get-state` / `wait` 回 `agentStarted`。helper 加一個 opt-in 的 `--wait-started <ms>`，逾時就用新的 exit code（例如 `8 LAUNCH_UNCONFIRMED`）。好處：不靠猜測輸出；opt-in 不影響舊塔台。限制：只適用 claude-cli，而且 `disableAllHooks: true` 時沒有信號（應回「無法判定」，不能當成失敗）。
  - B. **輸出比對**：寫入指令後 N 秒內，PTY 輸出比對 `command not found` / `is not recognized as` / `CommandNotFoundException` / `No such file or directory`，比到就記 `[agent-command] launch-suspect`，並透過 get-state 揭露。適用所有 agent 與 shell，但屬啟發式：使用者 profile 的輸出可能誤判，也會漏掉 shell 不報錯的失敗。只建議當成 A 的補充，或給 codex 用。
  - C. 塔台側（不改 BAT）：派工後用既有的 `bat_get_state` / `bat_read_output` 看 Worker 是否進入 `working`。現在就能做，但每個塔台都要自己寫判斷。
- 建議：A（claude）+ B 只記日誌與 state、不改 exit code。exit code 與 helper 參數屬契約變更，需塔台決定。

### 4. 給 BMad-Guide 塔台的暫時繞道（修正版發佈前）

- 根因不是 shell 設定，所以**不需要、也不應該改 `shell`**。helper 沒有 `--shell` 參數（`scripts/bat-terminal.mjs` 無此選項），工作區也沒有可調的 shell 設定。
- 繞道：
  1. 塔台派工後約 1 秒內，不要在 BAT 視窗打字（新分頁會搶走焦點）。
  2. 已經壞掉的 Worker 分頁（`bash: ,: command not found`）：在該分頁按 ↑ 叫回指令，Home、刪掉開頭的 `, ` 後 Enter。或者請塔台 `--close-worker T#### --notify-id …` 回收後重派。
  3. 塔台派工後可以用 `bat_get_state` / `bat_read_output` 確認 Worker 有沒有起來（方案 C），不要只看 helper exit 0。

### 偏離 / 範圍

- 工單假設「引號 shell 與分頁 shell 不一致」，實測不成立（兩者都是 posix / bash.exe）。仍照第 2 點做了單一來源的改動（原本就是同一個函式推導兩次，有兩次讀檔的競態，實務上沒有出事）。根因修正放在 `electron/pty-manager.ts` 與 `electron/terminal-command-handlers.ts`（`affects_files` 內，「只在根因需要時」）。
- **未處理（建議塔台另開單）**：派工分頁仍會搶鍵盤焦點（`src/stores/workspace-store.ts` `addExternalTerminal`，BUG-135 / T0532）。使用者接著打的字仍會跑進 Worker 分頁，只是不再破壞啟動指令（例如會落在 claude 的輸入框）。要不要讓 helper 派工的 Worker 分頁不搶焦點，是 UX 決策，而且不在 `affects_files`，這次沒改。
- 沒有改 `BUG-151` 單據（不在 `affects_files`，留給塔台）。`src/styles/settings.css` 的 M 不是本單的變更，沒有動。T0597 的檔案沒有碰。commit 用 `--only`，只含本單檔案。
- 隔離重現用的暫存腳本放在 scratchpad（`…\scratchpad\repro.cjs`、`repro2.cjs`），沒有進 repo。

### Commit

- 產品：`45943d16` `fix(dispatch): keep input typed before the dispatch command after it; resolve the dispatch shell once（BUG-151, T0598）`（7 files：`electron/terminal-command-handlers.ts`、`electron/pty-manager.ts`、`electron/__tests__/dispatch-shell-family.test.ts`、`electron/__tests__/dispatch-input-before-command.test.ts`、`e2e/t0598-dispatch-input-before-command.spec.ts`、`docs/agent-guide/bat-mcp-shim.md`、`CLAUDE.md`）。
- 工單：另一個 commit（只含本檔）。未 push。
