---
schema_version: 1
schema_kind: workorder
id: T0540
title: "PLAN-042：Windows Terminal Server 模式關閉分頁時，shell 底下的子程序（claude / codex / node）是否一併結束；未結束則修正"
type: implementation
status: PENDING
repo: better-agent-terminal
project: PLAN-042
priority: P2
sizing: S
created_at: "2026-10-15T16:13:05+0800"
updated_at: "2026-10-15T16:13:05+0800"
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

- [ ] 實測表（情境 × shell × 是否殘留，修正前 / 後）
- [ ] 修正有單元測試（以注入的 execFile 驗證參數與 timeout、pid 驗證）
- [ ] `npm run typecheck:electron` = 0、`npx vite build` 成功、相關單元測試全綠

## 回報區

（Worker 填寫）
