---
schema_version: 1
schema_kind: workorder
id: T0946
title: "BUG-228：Windows Git Bash 分頁把 claude 的 `/control-tower`（與派工的 `/ct-exec`）改寫成路徑 → 讓以 `/` 開頭的 prompt 參數原樣送到 claude"
type: bugfix
status: TODO
repo: better-agent-terminal
priority: P2
sizing: S
created_at: "2026-11-27T20:42:33+08:00"
updated_at: "2026-11-27T20:42:33+08:00"
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

（Worker 填寫）
