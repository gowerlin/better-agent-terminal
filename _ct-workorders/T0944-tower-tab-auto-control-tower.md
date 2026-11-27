---
schema_version: 1
schema_kind: workorder
id: T0944
title: "「以塔台開啟 Claude」啟動時自動帶入 `/control-tower`（新開分頁、⏻ 重啟、還原；resume 不帶）"
type: feature
status: PENDING
repo: better-agent-terminal
priority: P2
sizing: S
created_at: "2026-11-27T19:15:29+08:00"
updated_at: "2026-11-27T19:15:29+08:00"
target_version: "未定（`0.8.0-pre.9` 之後；版號線待使用者確認）"
depends_on: []
related:
  - "D421；使用者 2026-11-27：「以塔台開啟 Claude Code 可以自動帶入 /control-tower 嗎?」→ 帶入時機選「新開＋⏻ 重啟」、不加 Settings 開關；T0644（PLAN-050，只命名、不輸入指令）、T0766（resume 不帶 prompt）、T0403（PTY 仍在跑不重送啟動指令）"
affects_files:
  - _ct-workorders/T0944-tower-tab-auto-control-tower.md
  - src/components/WorkspaceView.tsx
  - src/lib/
  - src/lib/__tests__/
  - src/stores/__tests__/workspace-store.launchRole.test.ts
  - src/__tests__/
  - src/components/__tests__/
  - src/locales/en.json
  - src/locales/zh-TW.json
  - src/locales/zh-CN.json
  - docs/agent-guide/claude-session-name.md
  - CLAUDE.md
  - site/features.md
renew_count: 0
isolation: worktree
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 分支：只在 `ct/T0944` 寫檔（base = 派工當下的 `main`）。不 merge / rebase / push、不動 `main`。主 checkout 只寫本工單檔（`git -C \"$CT_HOME\" commit --only _ct-workorders/<本檔>`）。"
  - "🔴 現況：`handleAddClaudeCliAsTower`（`src/components/WorkspaceView.tsx`）開 claude-cli 分頁並記 `launchRole: 'tower'`，`startClaudeCliPty` 依此取名 `<ws> · Tower`；T0644 規定「只命名，不做 `--set-role`、啟動指令之後不輸入任何東西」。使用者要求改成啟動時自動進入塔台。"
  - "🔴 規格（使用者裁示 D421）：`launchRole === 'tower'` 的分頁，每次「啟動一個新的 claude session」時，把 `/control-tower` 當成 claude 的**啟動參數（位置參數 prompt）**帶入，🔴 不得在 claude 啟動後再模擬打字（不寫 PTY 第二次、不 setTimeout 送字）。帶入的情況：① 「以塔台開啟 Claude」新開分頁；② ⏻ 重啟塔台分頁；③ BAT 重開後還原、PTY 已不在而重新啟動 claude 的塔台分頁（與 ⏻ 同為新 session）。不帶的情況：④ 中斷後一鍵 resume（`startClaudeCliPty` 帶 `resume`，T0766 規則：resume 不附 prompt）；⑤ PTY 仍在跑、不重送啟動指令（T0403，本來就不送）；⑥ 工作區 / 全域自訂參數已含 resume 類旗標（`--continue` / `-c` / `--resume` / `-r` 等，判斷沿用 `claudeResumeArgs` 已有的偵測，`src/lib/claude-resume-args.ts`，不另寫）；⑦ 非塔台分頁（一般 Claude CLI、worktree、Worker 派工）一律不變。不加 Settings 開關（使用者裁示）。"
  - "🔴 參數位置與引號：比照 helper 派工把 `/ct-exec T####` 放進 claude 命令的做法（`electron/terminal-command-handlers.ts` 的 `createAgentPromptCommandBuilder`：prompt 的位置與 `quoteArgForShell` 引號），讓 prompt 不會被自訂參數裡的 variadic 旗標（例 `--allowedTools a b`）吃掉；若 helper 派工本身對此另有處理就照它，沒有就照它的位置（不另發明規則），並在回報區寫明結論。renderer 若沒有現成的引號函式，用既有共用實作（不在 consumer 內聯）。字串固定 `/control-tower`（Claude 端 skill 名稱與 T0710 一樣不改，plugin 安裝也用同一字串）。"
  - "🔴 唯一實作：決定「這次啟動要不要帶、帶什麼」寫成 `src/lib/` 的純函式（例 `towerLaunchPrompt({ launchRole, resume, customArgs })`），`startClaudeCliPty` 只接線；🔴 不改 `--name=`（T0641 / T0644）、BAT MCP / hooks 參數（`withBatMcpLaunchArgs`）、`--resume=` 規則、`setAutoTitle` 標題；BAT 仍不呼叫 `terminal:set-role`（CT 自己宣告）。"
  - "🔴 測試：純函式（新開 / ⏻ / 還原帶；resume 不帶；自訂參數含 resume 類旗標不帶；非塔台不帶；pwsh / cmd / posix 的引號）；`startClaudeCliPty` 組出的命令（塔台分頁含 `/control-tower`、一般 Claude CLI 逐字不變）；`src/stores/__tests__/workspace-store.launchRole.test.ts` 的 source guard 若斷言「不輸入任何東西」→ 依本規格更新並加 T0944 註解（只改那一處意圖，其他斷言不動）。其他既有測試若必然衝突 → 問塔台，不自行改。"
  - "🔴 驗證：worktree `npm ci`；`npm run test:unit` 在 head 第一次完整執行全綠（附數字）；`npx vite build` exit 0；`npm run typecheck` = 0。實機（開分頁看 claude 是否進入塔台）寫〈待實機〉（不碰安裝版 BAT、不開 claude 回合）。"
  - "🔴 文件：CLAUDE.md「Claude 分頁的 session 名稱」節的 T0644 那一點改寫（「只命名…不輸入指令」→ 啟動時帶 `/control-tower`，列出帶 / 不帶的情況，唯一實作函式名；小節標題不改名，T0595）；`docs/agent-guide/claude-session-name.md` 的 T0644 入口段同步（含：沒裝 CT 時 claude 會顯示找不到 skill，這是預期，要不帶就用一般 Claude CLI）；網站 `site/features.md` 提到「以塔台開啟 Claude」處補一句（下一版起自動進入塔台）。選單文字若有說明 / tooltip 需要改才改 i18n。"
  - "🔴 Git：worktree 用 `git add <明確路徑>`；不 push、不觸發 workflow、不建 tag。禁止 `git stash`（含 list）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF。收單前 worktree `status --porcelain` 為空。"
  - "🔴 公開 repo（D176）：程式、註解、測試資料、回報區不寫真名、客戶名、外部專案名、家目錄路徑。yolo：不得問使用者，判讀問題依 ct-exec § Questions For Tower 問塔台。工單狀態寫 `DONE`（L177）。"
---

# T0944 — 「以塔台開啟 Claude」自動帶入 `/control-tower`

## 背景

使用者 2026-11-27 問「以塔台開啟 Claude Code 可以自動帶入 /control-tower 嗎?」。T0644 當初只替 session 命名（`<ws> · Tower`），啟動後不輸入任何東西，使用者還要自己打 `/control-tower`。使用者裁示（D421）：新開分頁與 ⏻ 重啟都帶入，resume 不帶，不加 Settings 開關。

## 範圍

- 塔台分頁啟動新的 claude session 時，以啟動參數帶 `/control-tower`（不是啟動後打字）。
- 帶：新開、⏻ 重啟、BAT 重開後重新啟動；不帶：resume、PTY 仍在跑、自訂參數含 resume 類旗標、非塔台分頁。
- 判斷寫成純函式；命令其餘部分不變。

## 不做

- 不加 Settings 開關；不呼叫 `--set-role`；不改 Worker 派工、一般 Claude CLI、Claude Agent 面板、Codex。

## 驗收

- [ ] 塔台分頁新開 / ⏻ / 還原的啟動命令含 `/control-tower`（位置與引號同 helper 派工）
- [ ] resume、自訂參數含 resume 類旗標、非塔台分頁的命令逐字不變
- [ ] 純函式與命令組裝測試；launchRole source guard 依規格更新
- [ ] `npm run test:unit` head 第一次全綠；`npx vite build` exit 0；`npm run typecheck` = 0
- [ ] 〈待實機〉步驟；文件三處

---

## 回報區

（Worker 填寫）
