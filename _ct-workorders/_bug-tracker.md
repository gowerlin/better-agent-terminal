---
schema_version: 1
schema_kind: index
id: _bug-tracker
index_kind: bugs
generated_at: "2026-05-15T13:10:00+08:00"
generator: control-tower-sync
source_globs:
  - _ct-workorders/BUG-*.md
exclude_globs:
  - _ct-workorders/_archive/**
total: 8
breakdown:
  OPEN: 2
  FIXING: 0
  FIXED: 1
  VERIFY: 3
  CLOSED: 2
  WONTFIX: 0
---
# Bug Tracker

> ⚠️ 此文件由 `*sync` 自動生成，請勿手動編輯。
> 最後同步：2026-05-15 13:10 (UTC+8) — Session 43 收工：歸檔 15 張 CLOSED BUG → `_archive/bugs/`

## 統計
- 🔴 Open: 2 | ⏳ Fixing: 0 | ✅ Fixed: 1 | 🧪 Verify: 3 | 🚫 Closed: 2 | ⛔ Won't Fix: 0 | **Total: 8**

> 已歸檔 BUG（`_archive/bugs/`）：72 張（含本 session 新增 15 張）

## 🔴 Open / 處理中

| ID | 標題 | 嚴重度 | 建立時間 | 連結 |
|----|------|--------|---------|------|
| BUG-071 | Setup Wizard install-server-bundle 步驟硬性失敗：server bundle tarball 自動取得流程未實作 | 🔴 high | 2026-04-26 | [BUG-071](BUG-071-server-bundle-download-flow-missing.md) |
| BUG-061 | `src/components/CodexAgentPanel.tsx` baseline tsc errors（dev-only，pre-existing） | 🟢 low | 2026-04-26 | [BUG-061](BUG-061-codex-agent-panel-tsc-baseline-errors.md) |

## ⏳ 修復中 (FIXING)

| ID | 標題 | 嚴重度 | 建立時間 | 連結 |
|----|------|--------|---------|------|

（無）

## ✅ 已修復 (FIXED)

| ID | 標題 | 嚴重度 | 修復時間 | 連結 |
|----|------|--------|---------|------|
| BUG-078 | ct-drift-telemetry.ts 引用 node:fs/path/os 觸發 D090 guard，CI verify-renderer-imports fail 阻塞 v0.5.0-pre.1 release | 🔴 high | 2026-04-28 | [BUG-078](BUG-078-ct-drift-telemetry-renderer-node-imports-d090-violation.md) |

## 🧪 驗收中 (VERIFY)

| ID | 標題 | 嚴重度 | 驗證時間 | 連結 |
|----|------|--------|---------|------|
| BUG-072 | WSL setup wizard：systemd linger 啟用失敗時錯誤訊息不友善 + 連帶 bat-server.service timeout | 🟡 medium | 2026-04-27 | [BUG-072](BUG-072-wsl-systemd-linger-error-handling.md) |
| BUG-073 | Docker setup wizard：Docker daemon 未運作時錯誤訊息純技術，無 actionable 引導 | 🟡 medium | 2026-04-27 | [BUG-073](BUG-073-docker-wizard-daemon-not-running-error-handling.md) |
| BUG-074 | SSH setup wizard：configure-host input step 在使用者還沒輸入前就顯示為 failed 狀態 | 🟡 medium | 2026-04-27 | [BUG-074](BUG-074-ssh-wizard-input-step-shows-failed-on-init.md) |

## 🚫 已關閉 (CLOSED)

| ID | 標題 | 嚴重度 | 關閉時間 | 連結 |
|----|------|--------|---------|------|
| BUG-080 | resolveClaudeBaseCommand 雙引號包路徑無法防止 shell variable expansion（$、backtick） | 🟢 low | 2026-05-15 | [BUG-080](BUG-080-claude-cli-resolve-shell-quoting-hardening.md) |
| BUG-079 | BAT GitHub 功能找不到 gh CLI，但 gh 已安裝於 C:\Program Files\GitHub CLI\gh.exe (v2.92.0) | 🟡 medium | 2026-05-15 | [BUG-079](BUG-079-bat-github-feature-cannot-find-gh-cli.md) |

## ⛔ 不修復 (WONTFIX)

| ID | 標題 | 嚴重度 | 標記時間 | 連結 |
|----|------|--------|---------|------|

（無）
