---
schema_version: 1
schema_kind: bug
id: BUG-155
title: "helper 派工建立的 Worker PTY 沒有記錄 `agentPreset`：`bat_whoami` 缺 `agent`，claude Worker 少了 BUG-084 的 `DISABLE_UPDATES` 防護"
status: CLOSED
closed_at: "2026-10-18T18:01:40+0800"
closed_by: "使用者（T0645 實機驗收）"
fixed_at: "2026-10-18T15:49:52+0800"
fixed_by: T0639
fix_commit: "149f6f8d"
severity: low
reproducibility: always
created_at: "2026-10-18T15:36:22+0800"
impact:
  - helper-query-whoami
  - claude-update-guard
links:
  discovered_in: "T0637（CT-T020 實機驗收，codex Worker 的 `bat_whoami` 回傳沒有 `agent`，2026-10-18 15:35）"
  related: [T0637, T0582, T0525, T0372, BUG-084, BUG-131]
---

# BUG-155 — helper 派工的 Worker 沒有 `agentPreset`

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟢 low（`whoami.agent` 依契約是選填，CT 不依賴它；update guard 只差 `DISABLE_UPDATES`，背景自動更新仍由全域 `DISABLE_AUTOUPDATER` 擋住） |
| 可重現 | 必現（所有經 `bat-terminal.mjs --skill … --workorder …` 派出的 Worker，claude 與 codex 皆是） |
| **狀態** | 🚫 CLOSED（T0639 `149f6f8d` 修正；2026-10-18 T0645 實機驗收 PASS，使用者同意結案） |

## 現象（T0637，`v0.7.0-pre.9` 安裝版）

- codex Worker（`--agent codex`）在分頁內呼叫 `bat_whoami`：回傳只有 `terminalId` / `workspaceId` / `role` / `towerTerminalId` / `workorder` / `yolo` / `cwd`，**沒有 `agent`**。
- 預期：`agent` = 該分頁的 agent preset（例 `codex-cli`、`claude-cli`），與 BAT UI 開的 Agent 分頁一致（`docs/agent-guide/helper-query-channels.md` 契約表：`agent?`（agentPreset））。

## 根因（塔台初查，待 Worker 確認）

- `electron/terminal-command-handlers.ts` 的 `createWithCommand` 呼叫 `ptyManager.create({ id, cwd, type, shell, customEnv, workspaceId, workorder?, worktree? })`，**沒有傳 `agentPreset`**；resolved agent（`resolved.agentId`）只放進送 renderer 的 payload（分頁標題用）。
- 連帶影響：`PtyManager` 的 `claudeCliUpdateGuardEnv(agentPreset)`（T0525 / BUG-131、BUG-084 / T0372）只在 `agentPreset` 為 `claude-cli` / `claude-cli-worktree` 時注入 `claudeUpdateGuardEnv`（embedded runtime 時含 `DISABLE_UPDATES=1`）→ helper 派出的 claude Worker 沒有這個防護，Worker 內手動 `claude update` 可能改到 `app.asar.unpacked` 內的內嵌 binary。
- 其他讀 `PtyManager.getAgentPreset` / `getTerminalInfo().agentPreset` 的地方（`whoami`、Terminal Server recovery 重建時的 env 等）同樣拿不到值；Worker 需逐一確認。

## 修正方向（T0639）

- helper 派工（本機與 headless 共用路徑）把 resolved agent 的 preset id 傳給 `ptyManager.create({ agentPreset })`；raw command 模式維持不傳。
- 測試：helper 派工後 `whoami.agent` = preset；claude-cli Worker 的 PTY env 含 `claudeUpdateGuardEnv`（embedded）；codex Worker 不含；headless 同步。

## 實機驗收（T0645，2026-10-18）

- 安裝版 `0.7.1-pre.1`：helper 派出的 claude Worker（`--agent default`）在分頁內 `bat_whoami` 回 `agent: claude-cli`；塔台 `bat_whoami` 同樣有 `agent: claude-cli`。
- 未另驗 codex Worker 的 `agent`（與 claude 走同一段派工程式碼）。
- 使用者 18:01 同意 CLOSED。
