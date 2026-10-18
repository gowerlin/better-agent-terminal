---
schema_version: 1
schema_kind: workorder
id: T0639
title: "BUG-155：helper 派工建立的 Worker PTY 記錄 `agentPreset`（`whoami.agent`、claude Worker 的 update guard env）"
type: bugfix
status: TODO
repo: better-agent-terminal
project: BUG-155
priority: P2
sizing: S
created_at: "2026-10-18T15:40:56+0800"
depends_on: [T0637]
related:
  - "BUG-155（T0637 發現：codex Worker 的 `bat_whoami` 沒有 `agent`）；T0582（`terminal:whoami` 契約 `agent?` = agentPreset）；T0525 / BUG-131（`buildPtyEnv` 唯一組裝點、`claudeCliUpdateGuardEnv`）；T0372 / BUG-084（embedded 的 `DISABLE_UPDATES`）；T0621（codex 版本判定 / `osc`）"
affects_files:
  - electron/terminal-command-handlers.ts
  - "electron/pty-manager.ts（只在需要時）"
  - "electron/remote/headless-entry.ts、electron/remote/**（只在 headless 派工路徑需要同步時）"
  - "electron/__tests__/**、electron/remote/__tests__/**"
  - "docs/agent-guide/helper-query-channels.md、docs/agent-guide/claude-agent-sdk-cli.md（只補一句行為說明；CLAUDE.md 只在必守規則改變時動一句）"
  - _ct-workorders/T0639-fix-helper-dispatch-agent-preset.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 不改既有契約的語意：helper 的參數、exit code、stdout（含 `started:` 行）、`terminal:whoami` / `get-state` / `list` 的欄位名與值域都不變；本單只讓原本就定義的 `agent?` 有值（T0582 契約）。"
  - "🔴 raw command 模式（`terminal:create-with-command` 不經 agent 解析）維持不傳 `agentPreset`；`codex` 不得因此多注入任何 env（`claudeCliUpdateGuardEnv` 只對 `claude-cli` / `claude-cli-worktree`）。BUG-059 規則不變：`DISABLE_UPDATES` 只給 embedded，system runtime 絕不注入（`claudeUpdateGuardEnv(source)`）。"
  - "🔴 新增 env 一律經 `PtyManager.buildPtyEnv()`（CLAUDE.md「Logging」節 T0525），不要在 `createWithCommand` 分支內聯。"
  - "🔴 非隔離工單。另一張工單 T0638（網站）同時在改 `site/**`，不碰；`src/styles/settings.css` 的 M 不是你的變更，不碰。commit 用 `git commit --only <檔案>`。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF。不 push。"
---

# T0639 — helper 派工的 Worker 記錄 `agentPreset`

## 背景

T0637 實機（`v0.7.0-pre.9`）：codex Worker 的 `bat_whoami` 沒有 `agent`。塔台初查：`createWithCommand`（`electron/terminal-command-handlers.ts`）呼叫 `ptyManager.create(...)` 時沒有傳 `agentPreset`，resolved agent 只進了送 renderer 的 payload（分頁標題）。連帶 `claudeCliUpdateGuardEnv(agentPreset)` 對 helper 派出的 claude Worker 不生效，embedded runtime 下少了 `DISABLE_UPDATES=1`。詳見 BUG-155。

## 要做的事

1. 先確認根因（讀程式碼即可，不需實機）：helper agent 模式（`--skill` / `--workorder` / `--agent`）從解析出 agent 到 `ptyManager.create` 的路徑；本機與 headless 是否共用；還有哪些地方讀 `agentPreset`（`getAgentPreset`、`getTerminalInfo`、Terminal Server recovery / restart 重建 env、`isYoloTerminal` 等），列在回報區。
2. 修正：helper agent 模式建立 PTY 時傳入 resolved agent 的 preset id（與 BAT UI 開的同一 agent 分頁相同的值）。raw command 模式不傳。
3. 確認修正後的連帶行為都正確，並寫進回報區：
   - `whoami.agent`：claude Worker = `claude-cli`（或實際 preset）、codex Worker = `codex-cli`
   - claude-cli Worker 的 PTY env：embedded runtime 含 `claudeUpdateGuardEnv('embedded')` 的鍵；system runtime 不含 `DISABLE_UPDATES`
   - codex Worker 的 PTY env 不因本單多任何鍵
   - `pty:restart` / Terminal Server recovery 重建時沿用（若既有邏輯已沿用 `instance.agentPreset`，寫明即可）
4. 測試（vitest，不耗 token）：上述每一點至少一個斷言；若有 source guard 計數受影響，同步更新並說明。
5. 文件：`docs/agent-guide/helper-query-channels.md` 的 `whoami` 說明補一句「helper 派工的 Worker 也有 `agent`（BUG-155 前沒有）」；update guard 若在 `docs/agent-guide/claude-agent-sdk-cli.md` 有「已知缺口」敘述，同步更新。

## 驗證

- `npm run typecheck` = 0、`npm run typecheck:electron` = 0
- `npm run test:unit` 全綠（回報 passed / files 數；基線 5298 / 303）
- `npx vite build` 成功

## 驗收

- helper 派出的 Worker `whoami.agent` 有值；claude Worker（embedded）有 update guard；codex Worker 與 raw command 行為不變
- 契約欄位、helper 輸出、exit code 皆不變
- 三項驗證通過；回報區附根因確認、讀 `agentPreset` 的地方清單、測試清單與 commit
- 只改 `affects_files`；未 push

---

## 回報區

（Worker 填寫）
