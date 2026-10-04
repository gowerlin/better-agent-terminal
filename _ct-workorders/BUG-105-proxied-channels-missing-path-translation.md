---
schema_version: 1
schema_kind: bug
id: BUG-105
title: "遠端視窗的路徑轉換只涵蓋 fs / git(7) / pty / image：claude:*（cwd）、github:*、git-scaffold:*、worktree:create 等新上線 headless 的 channel 不做 client→server 路徑轉換"
status: FIXED
severity: high
reproducibility: likely
created_at: "2026-10-05T04:37:14+08:00"
updated_at: "2026-10-05T04:51:06+08:00"
impact:
  - remote-claude
  - remote-git
links:
  fix_workorder: T0416
  related: [T0405, T0401, T0393, PLAN-036, BUG-065]
---

# BUG-105 — 新上線 headless 的 channel 缺路徑轉換

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🔴 high（遠端視窗的工作區若存 client 形式路徑，Claude 面板、GitHub 面板、Git Graph、worktree 會在錯誤 / 不存在的目錄執行） |
| 可重現 | likely（程式碼推論，未實機；T0397 E4 顯示 WSL 視窗資料夾對話框預設 `\\wsl.localhost\Ubuntu-24.04\home\gower`） |
| **狀態** | ✅ FIXED（T0416 `e2daec1`；轉換在 main 端，需新 BAT build 實機驗證） |
| 回報者 | T0405 Worker（回報區「遭遇問題」2）；塔台 04:35 擴大判斷到 `claude:*` |

## 現象（程式碼證據）

- `electron/remote/path-aware-channels.ts` 的 `PATH_AWARE_CHANNELS` 只有 `fs:*`（7）、`git:*`（7）、`pty:create` / `pty:restart`、`image:read-as-data-url`
- PLAN-036 P1 / P2 新上線 headless 的 channel 中，帶路徑參數者未登錄：`claude:start-session` 等帶 cwd 的 `claude:*`（T0401）、`github:*`、`git-scaffold:*`、`worktree:create`（cwd 在第 2 參數）（T0405）
- 結果：client 形式路徑（`\\wsl.localhost\…`、`C:\…`）原樣送到 Linux server

## 修復方向
- T0416：盤點所有 `PROXIED_CHANNELS` 的路徑參數 / 回傳值並補 schema；加守門測試要求每個 proxied channel 都有明確分類，防止日後漏接

## 修復紀錄

- T0416（`e2daec1`）：現況確認 bug 存在（WSL / SSH 視窗工作區存 client 形式，經本機對話框選取）；`PROXIED_CHANNELS` 108 個全分類（`PATH_ARG_SCHEMA` 34 + `PATH_FREE_CHANNELS` 74）；新增 `arg-indices` / `object-fields` schema；補 claude:start-session / resume-session / list-sessions / scan-skills、worktree:create / rehydrate、github:*（6）、git-scaffold:*（3）、terminal:create-with-command / create-agent-command；`git-scaffold` 回傳 gitRoot 轉回 client；`claude:get-cli-path` 等明確不轉；守門 + 150 轉換測試
- 2026-10-05 04:51 塔台複驗：1825 tests / vite / e2e 0 failed / tsc 40 / legacy node:test 11/11
- 待實機：使用者以新 build 在 WSL 視窗用 `\\wsl.localhost\…` 與 `C:\…` 兩種工作區開 Claude 面板（`pwd`）與 Git Graph
- 自由文字 / 附件路徑：T0437（ALWAYS_LOCAL `remote:resolve-client-paths`；Claude / Codex 面板 `@` 附件改送 server 形式，不可達者移除 + toast；使用者手打 / 貼上文字不改寫，見 T0421）
