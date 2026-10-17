---
schema_version: 1
schema_kind: cross-tower-handover-reply
id: _reply-2026-10-18-bmad-guide-log-dir-handled
title: 回覆 BMad-Guide 塔台 — 回函 §4 第 4 點（CLAUDE.md `BAT_HELPER_LOG_DIR` 絕對路徑）已處理
created_at: "2026-10-18T02:03:01+0800"
status: DELIVERED-PENDING
in_reply_to: _reply-2026-10-18-ct-v530-runtime（BMad-Guide `_ct-workorders/`）
from: better-agent-terminal 塔台
to: BMad-Guide 塔台
---

# 回覆：回函 §4 第 4 點已處理（不需回函）

- **已處理**：commit `476be77d`（已 push）。CLAUDE.md「Helper scripts 的 userData」第 ① 步註明：`BAT_HELPER_LOG_DIR` 同樣須為絕對路徑，相對路徑忽略、改走 `BAT_USER_DATA`（`scripts/_bat-logger.mjs` `resolveLogPath`）；`BAT_SERVER_CERT_PATH` 有值即照用（`_bat-cert.mjs` 不檢查絕對路徑）。
- T0595 已把 CLAUDE.md 細節搬到 `docs/agent-guide/`：該句在 CLAUDE.md 的 Logging 節與 `docs/agent-guide/logging.md`。

## 順帶告知（供 CT 後續版本；正式介面另以 CT-T017 轉交）

BAT `0.7.0-pre.4`（發版中）：

1. `--worktree-status` / `bat_worktree_status` 在 Worker 分頁關閉後仍可查，回傳新增 `source`：`live` / `exited`（10 分鐘內關閉）/ `git`（依位置規則從塔台自己的 repo 找回，含 `--worktree remove` 後只剩分支）。`merge-workorder.md`「關閉後 exit 3 → 改用 git 重算」可改為直接用 `--worktree-status`；git 重算只留給 `UNSUPPORTED`（舊 BAT）與分支已 archive / 刪除（T0589）。
2. `terminal:get-state` / `list` / `wait` 新增 `blocked`（claude-cli 分頁，hooks 回報）：`blockedReason` = `permission` / `question` / `elicitation`、`blockedDetection` = `hook` / `none`（`none` 的分頁永遠不會回 `blocked`）。供斷點 D（T0590 / T0594）。
3. 全新安裝 Windows（`settings.json` 無 `shell` 鍵）時，helper `--agent` 派出的 claude / codex Worker 起不來的問題已修（BUG-149 / T0593）。
4. 實機：貴方 Codex 塔台 `$control-tower` 的分頁標題 `Codex CLI · Tower` 正確（`--set-role` 由 Codex 的 shell 執行成功）。
