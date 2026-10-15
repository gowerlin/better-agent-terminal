---
schema_version: 1
schema_kind: workorder
id: T0549
title: "PLAN-041 重驗探針（pre.4，claude Worker）：真實 claude Worker 回報後，塔台收單即 `--close-worker` 應 exit 0 並等安靜後關閉（D145 / T0545）"
type: verification
status: DONE
repo: better-agent-terminal
project: PLAN-041
priority: P2
sizing: XS
created_at: "2026-10-16T02:14:11+0800"
updated_at: "2026-10-16T02:15:19+08:00"
started_at: "2026-10-16T02:14:52+08:00"
completed_at: "2026-10-16T02:15:19+08:00"
commit: ""
target_version: "0.6.1-pre.4（已安裝，不改程式碼）"
depends_on: []
related:
  - "PLAN-041 介面契約（`--close-worker` exit code）；D144 / D145"
  - "T0542（pre.3 上同一驗收：收單後 9 s 呼叫得 exit 6 BUSY）"
  - "T0545（BAT 等安靜再關，0.6.1-pre.4 發佈）"
affects_files:
  - _ct-workorders/T0549-plan041-recheck-probe-pre4.md
renew_count: 0
workdir: main repo
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 本單只改本工單檔；不改任何產品程式碼、不跑 build / test。commit 用 `git commit --only _ct-workorders/T0549-plan041-recheck-probe-pre4.md`（`src/styles/settings.css` 的 M 狀態不是你的變更）。"
  - "🔴 不 push、不觸發 workflow、不建 tag；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF。"
  - "🔴 不要自己呼叫 `bat-terminal.mjs --close-worker`、不要關閉或重啟任何分頁。"
  - "🔴 通知塔台（ct-exec 收尾的 bat-notify）之後**不要再執行任何指令**，保持閒置等塔台回收本分頁；claude 自身收尾輸出屬正常，不需壓抑。"
---

# T0549 — PLAN-041 重驗探針（pre.4，claude Worker）

## 背景

pre.3 上，塔台收單後立即呼叫 `--close-worker` 6 次全部得到 exit 6（BUSY）。原因是 claude 回報後還會再輸出幾秒收尾。D145 / T0545 把處理方式改在 BAT 端：不再回 BUSY，改為照常排程（exit 0），到期時若分頁仍在輸出，就等連續安靜 5 s 再關，最多等 60 s。這個修正已隨 `0.6.1-pre.4` 發佈，本機也已安裝並重啟（2026-10-16 02:12）。

本單就是 pre.4 上那個 Worker。你的工作很小，真正的驗收由塔台在你回報後執行（`--close-worker`，延遲 10 秒）。

## 任務

1. 照 ct-exec 流程開工（填 `started_at`、`status: IN_PROGRESS`）。
2. 在回報區記錄以下事實（用指令取值，不要推測）：
   - 目前 agent 與版本（例：`claude --version`；取不到就寫「取不到」與原因）
   - BAT 版本：`C:\Program Files\BetterAgentTerminal\BetterAgentTerminal.exe` 的 FileVersion（PowerShell `(Get-Item <path>).VersionInfo.FileVersion`）
   - 環境變數：`BAT_SESSION`、`BAT_TERMINAL_ID`、`BAT_TOWER_TERMINAL_ID`、`BAT_WORKSPACE_ID`、`CT_MODE`、`CT_INTERACTIVE`（**不要**印 `BAT_REMOTE_TOKEN` 的值，只寫有沒有設定）
   - 系統時間（`date "+%Y-%m-%dT%H:%M:%S%z"`）
3. 填完成狀態 `DONE`、`completed_at`，`git commit --only` 本工單檔。
4. 照 ct-exec 收尾通知塔台（yolo：`bat-notify.mjs --submit`，`--source "T0549"`）。
5. **通知之後保持閒置**，不再執行指令。分頁會在塔台收單後被 BAT 自動關閉，這是預期行為。

## 驗收條件（Worker 部分）

- [ ] 回報區含 agent / 版本、BAT FileVersion、上述 env（token 只寫有無）、系統時間
- [ ] commit 只含本工單檔
- [ ] 已通知塔台，之後無額外動作

## 塔台驗收（塔台在收單後執行，Worker 不需處理）

- 收單後**立即**執行 `node "$BAT_HELPER_DIR\bat-terminal.mjs" --close-worker T0549 --notify-id "$BAT_TERMINAL_ID" --delay-ms 10000`，期望 exit `0`，stdout 有「等安靜（最多再 60 s）」提示行
- 主行程 `debug-*.log` 的 `[close-worker]` 行：`scheduled delayMs=10000`（可能附 `output <m> ms ago; will wait for quiet`），之後為 `close requested` 或 `close requested after waiting <x> s for quiet`，不得出現 `cancelled`
- `bat-scripts.log` 的 `close-worker` 事件
- 分頁實際消失；window registry（`windows.json`）內已無此分頁
- 全部通過 → PLAN-041 DONE

---

## 回報區

> 以下由 sub-session 填寫

### 完成狀態

DONE（Worker 部分）。塔台驗收（`--close-worker` 延遲 10 s、等安靜、分頁消失）由塔台在收單後執行。

### 產出摘要

Landing check：PASS。C-0 `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`（REPO_ROOT `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）；C-1 PASS；C-3 不適用（`affects_files` 只有本工單檔）；C-2 無 `branch` 欄位。開工時 `status` 為 `TODO`（非 `PENDING`），直接轉 `IN_PROGRESS`。

以下都是指令取得的值：

| 項目 | 值 | 取得方式 |
|---|---|---|
| agent | Claude Code，模型 `claude-opus-5-5`（Opus 5.5） | 模型由 session 系統資訊得知 |
| agent 版本 | `2.1.300 (Claude Code)` | `claude --version` |
| 實際執行的 agent binary | `C:\Users\Gower\.local\bin\claude.exe`（system installer 版，不是 BAT 內嵌版） | 本 shell 的父行程鏈：pwsh ← cmd ← `claude.exe`（PID 23936）；PATH 上的 `claude` 也是同一路徑 |
| BAT FileVersion | `0.6.1-pre.4`（ProductVersion `0.6.1.0`） | `(Get-Item 'C:\Program Files\BetterAgentTerminal\BetterAgentTerminal.exe').VersionInfo.FileVersion` |
| `BAT_SESSION` | `1` | env |
| `BAT_TERMINAL_ID` | `2f3d863cdffa40733e11283e39a0ae39` | env |
| `BAT_TOWER_TERMINAL_ID` | `66447ea9-66e1-431a-8303-0f4ced7ec6a7` | env |
| `BAT_WORKSPACE_ID` | `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b` | env |
| `CT_MODE` | `yolo` | env |
| `CT_INTERACTIVE` | `0` | env |
| `BAT_REMOTE_PORT` | `9876` | env |
| `BAT_REMOTE_TOKEN` | 有設定（值不記錄） | env |
| `BAT_HELPER_DIR` | `C:\Program Files\BetterAgentTerminal\resources\scripts` | env |
| 系統時間 | `2026-10-16T02:15:04+0800` | `date "+%Y-%m-%dT%H:%M:%S%z"` |

Git Bash 與 PowerShell 看到的 `BAT_*` / `CT_*` 相同，沒有 shell env visibility mismatch。

變更檔案：只有本工單檔。沒有改產品程式碼，沒有跑 build / test（依 memory_overrides）。

### 互動紀錄

無（`CT_INTERACTIVE=0`，fire-and-forget）。

### Renew 歷程

無。

### 遭遇問題

無。

### 回報時間

2026-10-16T02:15:04+0800
