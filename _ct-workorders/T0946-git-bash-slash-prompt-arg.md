---
schema_version: 1
schema_kind: workorder
id: T0946
title: "BUG-228：Windows Git Bash 分頁把 claude 的 `/control-tower`（與派工的 `/ct-exec`）改寫成路徑 → 讓以 `/` 開頭的 prompt 參數原樣送到 claude"
type: bugfix
status: DONE
repo: better-agent-terminal
priority: P2
sizing: S
created_at: "2026-11-27T20:42:33+08:00"
updated_at: "2026-11-27T20:51:52+08:00"
started_at: "2026-11-27T20:44:22+08:00"
completed_at: "2026-11-27T20:51:52+08:00"
session_ids:
  - "ce2aaace-a557-4273-a3bf-5af0871e601b"
target_version: "下一個預覽版（`0.8.1-pre.N`，發版前與使用者確認）"
depends_on: []
related:
  - "BUG-228；D427 / D428（U-36：A）；T0944（`towerLaunchPrompt`，D421）；helper 派工 `createAgentPromptCommandBuilder`"
affects_files:
  - _ct-workorders/T0946-git-bash-slash-prompt-arg.md
  - src/lib/tower-launch-prompt.ts
  - src/lib/__tests__/tower-launch-prompt.test.ts
  - src/utils/shell-quote.ts
  - src/utils/__tests__/
  - src/components/WorkspaceView.tsx
  - electron/terminal-command-handlers.ts
  - electron/__tests__/
  - docs/agent-guide/claude-session-name.md
  - CLAUDE.md
renew_count: 0
isolation: worktree
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 分支：只在 `ct/T0946` 寫檔（base = 派工當下的 `main`）。不 merge / rebase / push、不動 `main`。主 checkout 只寫本工單檔（`git -C \"$CT_HOME\" commit --only _ct-workorders/<本檔>`）。"
  - "🔴 現象（BUG-228）：BAT `0.8.0`、Windows，「以塔台開啟 Claude」開的分頁，claude 收到的第一則訊息是 `C:/Program Files/Git/control-tower`。塔台推測：分頁 shell 是 Git Bash，MSYS 在 bash 執行原生程式（`claude.exe`）時把以 `/` 開頭的參數當 POSIX 路徑轉成 Windows 路徑；與引號無關。先查證（例：在 Git Bash 以原生程式印出 argv，比對 `/control-tower` 帶與不帶各種處理的結果），確認根因後再改；推測不成立 → 問塔台。"
  - "🔴 範圍：① `towerLaunchPrompt`（`src/lib/tower-launch-prompt.ts`）在 Windows 的 Git Bash / MSYS shell 讓 `/control-tower` 原樣送到 claude；② 查證 helper 派工 `createAgentPromptCommandBuilder`（`electron/terminal-command-handlers.ts`）的 `/ct-exec <工單 ID>`（及 `ct-done`）落在 Git Bash 分頁時是否同樣被改寫，是就用同一個共用實作修；回報區寫明兩者的查證結果與過去 Worker 正常的原因（例：派工分頁的 shell 不是 Git Bash）。"
  - "🔴 做法限制：🔴 不得改 PTY 的 env（不在 `buildPtyEnv` / `customEnv` 加 `MSYS_NO_PATHCONV`、`MSYS2_ARG_CONV_EXCL` 之類的全域變數：會改變使用者在分頁裡執行的所有指令）。只作用在這一次 claude 啟動命令（例：只對該命令生效的前置變數，或 MSYS 認得的不轉換寫法），由 Worker 查證後選一個、回報區寫明理由與實測。判斷「是不是 MSYS bash」用分頁實際的 shell（沿用既有的 shell 解析，例 `resolveDispatchShell` / renderer 端既有判斷），不另寫一套；🔴 pwsh、cmd、macOS / Linux 的 bash、WSL 的命令逐字不變（測試斷言）。"
  - "🔴 唯一實作：處理寫在共用位置（例 `src/utils/shell-quote.ts` 新增一個函式，或 `ShellFamily` 之外另一個參數），`towerLaunchPrompt` 與 helper 派工都經它；不在 consumer 內聯。不改 `--name=`、BAT MCP / hooks 參數、`--resume=`、T0944 的帶 / 不帶規則。"
  - "🔴 測試：Git Bash 情況下命令的形狀（含塔台分頁與 helper 派工，若 ② 成立）；pwsh / cmd / posix 非 Windows 逐字不變；若可在 Windows 本機以真的 Git Bash 執行一個印 argv 的原生程式驗證，寫成測試（無 Git Bash 時 skip）或至少在回報區附實測輸出。既有測試若必然衝突 → 問塔台，不自行改。"
  - "🔴 驗證：worktree `npm ci`；`npm run test:unit` 在 head 第一次完整執行全綠（附數字）；`npx vite build` exit 0；`npm run typecheck` = 0；改到 `electron/**` 時 `npm run typecheck:electron` = 0。實機（安裝版開塔台分頁）寫〈待實機〉，不碰安裝版 BAT、不開 claude 回合。"
  - "🔴 文件：`docs/agent-guide/claude-session-name.md`「以塔台開啟 Claude」節補 Git Bash 的處理（已知限制段若有提到就改）；CLAUDE.md「Claude 分頁的 session 名稱」節 T0944 那句只在需要時補一句（唯一實作函式名），小節標題不改名（T0595）。"
  - "🔴 Git：worktree 用 `git add <明確路徑>`；不 push、不觸發 workflow、不建 tag。禁止 `git stash`（含 list）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF。收單前 worktree `status --porcelain` 為空。"
  - "🔴 公開 repo（D176）：程式、註解、測試資料、回報區不寫真名、客戶名、外部專案名、家目錄路徑（例路徑用 `C:\\Users\\demo`）。yolo：不得問使用者，判讀問題依 ct-exec § Questions For Tower 問塔台。工單狀態寫 `DONE`（L177）。"
---

# T0946 — Git Bash 分頁讓 `/control-tower` 原樣送到 claude（BUG-228）

## 背景

`v0.8.0` 實機驗收 A-15：「以塔台開啟 Claude」開的分頁，claude 收到 `C:/Program Files/Git/control-tower` 而不是 `/control-tower`，slash command 沒有執行（BUG-228）。塔台推測是 Git Bash（MSYS）啟動原生程式時的路徑轉換。使用者裁示 U-36：A（開 BUG 修正，修好後重驗）。

## 範圍

- 查證根因（MSYS 參數轉換）。
- 塔台分頁在 Windows Git Bash 讓 `/control-tower` 原樣送到 claude；helper 派工的 `/ct-exec` 查證，受影響就一起修。
- 共用實作、只作用於該次啟動命令，其他 shell 逐字不變。

## 不做

- 不改 PTY env、不改 T0944 的帶 / 不帶規則、不改 Claude Agent 面板與 Codex 的命令（codex 的 `$ct-exec` 不以 `/` 開頭）。

## 驗收

- [ ] 回報區有根因查證（含實測 argv）與 helper 派工的結論
- [ ] Windows Git Bash 的塔台分頁（與受影響的派工）命令讓 claude 收到 `/control-tower`
- [ ] pwsh / cmd / 非 Windows posix 的命令逐字不變（測試）
- [ ] `npm run test:unit` head 第一次全綠；`npx vite build` exit 0；`npm run typecheck` = 0（改 electron 時 `typecheck:electron` = 0）
- [ ] 〈待實機〉步驟；docs 更新

---

## 回報區

### 完成狀態

- **結果**：DONE（Worker 範圍全部通過；實機重驗 A-15 屬〈待實機〉）
- **branch**：`ct/T0946`
- **base_sha**：`ef1cb828beda68141063e88c0f40776870573fa1`
- **validated_sha**：`75525d6a0ccbf517470fe366065cb617beaca725`
- **head_sha**：`75525d6a0ccbf517470fe366065cb617beaca725`（= validated_sha，驗證後沒有新的產品 commit）
- **產品 commit**：`75525d6a` fix(tower): keep /control-tower intact in Windows Git Bash tower tabs (T0946, BUG-228)
- **session_id**：ce2aaace-a557-4273-a3bf-5af0871e601b

### 落點檢查

- **結果**：PASS
- C-0：`repo` = `better-agent-terminal`；`basename "$CT_HOME"` = `better-agent-terminal` → PASS
- C-1：工單在 `$CT_HOME/_ct-workorders/` 下 → PASS
- C-3：`affects_files` 前 5 筆（排除 `_ct-workorders/`）皆存在 → PASS
- C-2：工單沒有 `branch` 欄位；目前分支 `ct/T0946`（= `CT_WORKTREE_BRANCH`）
- 證據：`CT_HOME` 已設定（主 checkout）、`CT_WORKTREE_BRANCH` = `ct/T0946`、`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`、`BAT_REMOTE_TOKEN` 已設定、`CT_MODE` = `yolo`

### 根因查證（實測 argv）

在 Windows 以 Git for Windows 的 `bash.exe`（GNU bash 5.3.15，MSYS runtime 3.6.10），去掉 `MSYS_NO_PATHCONV` / `MSYS2_ARG_CONV_EXCL` 後，以原生程式 `node`（印 `process.argv.slice(2)`）實測：

| 寫法 | 程式收到 |
|---|---|
| `node argv.js /control-tower` | `["C:/Program Files/Git/control-tower"]` |
| `node argv.js '/control-tower'`（單引號） | `["C:/Program Files/Git/control-tower"]` |
| `node argv.js '/ct-exec T0946'` | `["C:/Program Files/Git/ct-exec T0946"]` |
| `node argv.js '/ct:ct-exec T0946'` | `["/ct:ct-exec T0946"]`（含 `:`，不轉換） |
| `node argv.js '//control-tower'` | `["/control-tower"]` |
| `MSYS_NO_PATHCONV=1 node argv.js /control-tower` | `["/control-tower"]` |
| `MSYS2_ARG_CONV_EXCL=/control-tower node argv.js /control-tower /tmp --add-dir=/c/x` | `["/control-tower","C:/Users/…/Temp","--add-dir=C:/x"]`（只排除該參數，其他照舊轉換） |
| 使用者原有 `MSYS2_ARG_CONV_EXCL='--foo='`，前置 `MSYS2_ARG_CONV_EXCL="/control-tower${MSYS2_ARG_CONV_EXCL:+;$MSYS2_ARG_CONV_EXCL}"` | argv `["/control-tower","--foo=/tmp",…]`，程式的 env 值 `/control-tower;--foo=`（原值保留） |
| 已設 `MSYS_NO_PATHCONV=1` 時 `node argv.js //control-tower` | `["//control-tower"]`（`//` 寫法在這種環境會壞） |
| 前置變數執行後 shell 自己的 `MSYS_NO_PATHCONV` | `unset`（不外洩到分頁） |

結論：塔台推測成立。Git Bash（MSYS）執行原生程式時把以 `/` 開頭的參數改寫成 Windows 路徑，與引號無關。

### 做法與理由

- 選「只對該次命令生效的前置變數」`MSYS2_ARG_CONV_EXCL="/control-tower${MSYS2_ARG_CONV_EXCL:+;$MSYS2_ARG_CONV_EXCL}" <原命令>`：
  - 只排除以 `/control-tower` 開頭的參數；自訂參數裡的 POSIX 路徑（例 `--add-dir /c/proj`）照舊轉換，行為與修正前相同。
  - Git for Windows 與 MSYS2 都認得（`MSYS_NO_PATHCONV` 只有 Git for Windows 認得，且會關掉所有參數的轉換）。
  - shell 原有的 `MSYS2_ARG_CONV_EXCL` 接在 `;` 後保留。
  - 誤判（Cygwin、已設 `MSYS_NO_PATHCONV=1` 的環境）時無害；`//control-tower` 在那種環境會讓 claude 收到 `//control-tower`，所以不用。
  - 不改 PTY env，分頁裡使用者執行的其他指令不受影響。
- 判斷「是不是 MSYS shell」用分頁實際 spawn 的 shell 路徑（`startClaudeCliPty` 既有的 `shell`，同一個值傳給 `createPtyThenLaunch`），只看路徑：Windows 路徑（磁碟代號或 UNC）且檔名是 `bash` / `sh` / `zsh` / `dash` / `ash` / `git-bash`；排除 WSL（`System32` / `Sysnative` / `WindowsApps`、`wsl.exe`）。只看路徑而不看本機平台，是因為遠端視窗的 `shell` 是 server 端路徑（例 `/bin/bash`），本機平台判斷會誤判。
- 唯一實作：`isWindowsMsysShell` / `msysArgConvExclusionPrefix`（`src/utils/shell-quote.ts`）；塔台分頁經 `towerLaunchCommandPrefix`（`src/lib/tower-launch-prompt.ts`）；`startClaudeCliPty` 只在 push prompt 之後、join 之前 `unshift` 前置變數，並多記一行 `[T0946] …` debug log。`towerLaunchPrompt` 的呼叫、`--name=`、BAT MCP / hooks、`--resume=`、T0944 帶 / 不帶規則都不變（既有 source guard 一字未改且通過）。
- 已知限制（寫進 docs）：claude 與其子程序繼承這個變數（MSYS 傳給原生程式時改寫成 `C:/Program Files/Git/control-tower`，或有原值時 `/control-tower;<原值>`），效果只是以該字串開頭的參數不轉換；設定裡的 shell 是沒有目錄的 `bash` / `bash.exe` 時判斷不出來。

### ② helper 派工查證

- **結論：不受影響，`createAgentPromptCommandBuilder` 不改。**
- 原因：`scripts/bat-terminal.mjs` 以 prompt 或 `--skill` / `--workorder` 派工（`terminal:create-agent-command`）時一律在 `customEnv` 帶 `MSYS_NO_PATHCONV: '1'`（BUG-075 / T0341，commit `c317832a`），Worker 分頁整個 PTY 都不做路徑轉換，所以 `/ct-exec T####` / `/ct-done T####` 原樣到 claude。這就是過去 Worker 正常的原因（與分頁 shell 是不是 Git Bash 無關）。本 Worker 分頁的環境也實際帶 `MSYS_NO_PATHCONV=1`。
- 既有守護：`tests/bat-terminal-msys.test.mjs`（Git Bash argv fixture＋payload 帶 `MSYS_NO_PATHCONV`）、`tests/e2e/bug075-bat-auto-session.test.ts`；本單新增的真 Git Bash 測試也驗證「已設 `MSYS_NO_PATHCONV=1` 時，不加前置變數 `/ct-exec T0946` 原樣送達」。
- 塔台分頁受影響的原因：它由 renderer 的 `startClaudeCliPty` 建立，`customEnv` 只有全域 / 工作區 env 與 `CLAUDE_CODE_NO_FLICKER`，沒有 `MSYS_NO_PATHCONV`。
- 觀察（不在範圍、未改）：raw command 模式 `bat-terminal.mjs claude "/ct-exec T####"`（`terminal:create-with-command`）不帶 `MSYS_NO_PATHCONV`；命令由呼叫者自己寫、BAT 不組，落在 Git Bash 分頁時同樣會被改寫。CT 目前以 `--skill` 派工，不走這條路。

### 變更檔案

- `src/utils/shell-quote.ts`：新增 `isWindowsMsysShell`、`msysArgConvExclusionPrefix`
- `src/lib/tower-launch-prompt.ts`：新增 `towerLaunchCommandPrefix`
- `src/components/WorkspaceView.tsx`：`startClaudeCliPty` 接線（`unshift` 前置變數＋debug log）
- `src/utils/__tests__/shell-quote-msys.test.ts`（新）：判斷 29 例、前置變數形狀／跳脫／`;`、真 Git Bash 4 例（非 Windows 或沒有 Git Bash 時 skip）
- `src/lib/__tests__/tower-launch-prompt.test.ts`：新增 T0946 describe（Git Bash 命令形狀、不帶 prompt 時不加、pwsh / powershell / cmd / zsh / bash / WSL / 未知 shell 逐字不變、接線 source guard）；既有測試未改
- `docs/agent-guide/claude-session-name.md`：「以塔台開啟 Claude」節補 Git Bash 處理、helper 派工結論、已知限制、驗證清單
- `CLAUDE.md`：「Claude 分頁的 session 名稱」節 T0944 那句後補一句（唯一實作函式名）；標題未改

### 驗證

| 閘門 | 結果 |
|---|---|
| `npm ci`（worktree） | exit 0（`electron-winstaller` install script 被 `allowScripts` 擋，屬預期） |
| `npm run test:unit`（head `75525d6a`，第一次完整執行） | exit 0：Test Files 514 passed / 3 skipped（517）；Tests 9308 passed / 47 skipped（9355） |
| 本單新測試（真 Git Bash 未 skip） | `shell-quote-msys.test.ts` 36 passed；`tower-launch-prompt.test.ts` 含 T0946 全過 |
| `npx vite build` | exit 0 |
| `npm run typecheck` | 0 |
| `npm run typecheck:electron` | 0（未改 `electron/**`，但 `src/utils/shell-quote.ts` 被 electron import，一併跑） |

### 相關通過案例判定

工單沒有〈相關通過案例〉段。A-15（BUG-228 原案例）本身是待重驗的失敗案例，本單修正它。

### 待實機

1. 安裝含本修正的版本，Settings → Shell 選 Git Bash（Windows）。
2. 縮圖列「+」→「以塔台開啟 Claude」：分頁內打出的啟動指令最前面有 `MSYS2_ARG_CONV_EXCL="/control-tower${MSYS2_ARG_CONV_EXCL:+;$MSYS2_ARG_CONV_EXCL}"`，claude 第一則訊息是 `/control-tower`，塔台 skill 啟動。debug log 有 `[T0946] tower tab terminal=<id>: Git Bash (MSYS) argument conversion excluded for the launch prompt`。
3. ⏻ 重啟該塔台分頁：同上。
4. Shell 改回 pwsh（或 cmd）再開「以塔台開啟 Claude」：啟動指令沒有前置變數、與 v0.8.0 相同，claude 收到 `/control-tower`。
5. Git Bash 下開一般「Claude CLI」分頁：啟動指令沒有前置變數。

### 遭遇問題

- 以 heredoc 寫測試資料時反斜線被收掉（R-G005 已知），改以 Edit 工具修正後通過；不影響產品程式。
- 收單通知失敗：`bat-notify.mjs --source T0946 --target "$BAT_TOWER_TERMINAL_ID" --submit "T0946 完成"` → `Error: PTY write failed: pty-not-found`，exit 1（派工時的塔台分頁已不在）。沒有自動送出；手動訊息：`T0946 完成`。

### 互動紀錄

- [20:44] 開工；CT_MODE=yolo，無提問塔台。

### 子代理與 Workflow 使用

未使用。
