---
schema_version: 1
schema_kind: workorder
id: T0558
title: "pre.5 驗收探針重跑（T0557 期間使用者未確認焦點切換）（claude Worker）：Worker 分頁標題 `Claude CLI · Worker · T0558`、回報 ✓（T0553），收單回收延遲期間切換焦點不取消（BUG-140 / T0551）"
type: verification
status: DONE
repo: better-agent-terminal
project: BUG-140
priority: P2
sizing: XS
created_at: "2026-10-16T14:06:46+0800"
updated_at: "2026-10-16T14:07:41+0800"
started_at: "2026-10-16T14:07:03+0800"
completed_at: "2026-10-16T14:07:41+0800"
commit: ""
target_version: "0.6.1-pre.5（已安裝，不改程式碼）"
depends_on: []
related:
  - "T0553（外部建立分頁標題、`✓` 標籤）"
  - "T0551 / BUG-140（focus report 不算使用者輸入）"
  - "T0557（同一探針第一次；焦點切換與 ✓ 未經使用者確認）"
affects_files:
  - _ct-workorders/T0558-pre5-acceptance-probe-rerun.md
renew_count: 0
workdir: main repo
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 本單只改本工單檔；不改任何產品程式碼、不跑 build / test。commit 用 `git add` 後 `git commit --only _ct-workorders/T0558-pre5-acceptance-probe-rerun.md`（`src/styles/settings.css` 的 M 狀態不是你的變更）。"
  - "🔴 不 push、不觸發 workflow、不建 tag；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF。"
  - "🔴 不要自己呼叫 `bat-terminal.mjs --close-worker`、不要關閉或重啟任何分頁、不要改分頁名稱。"
  - "🔴 通知塔台（ct-exec 收尾的 bat-notify）之後**不要再執行任何指令**，保持閒置等塔台回收本分頁；claude 自身收尾輸出屬正常，不需壓抑。"
---

# T0558 — pre.5 驗收探針（claude Worker）

## 背景

`0.6.1-pre.5` 已安裝於本機（FileVersion 2026-10-16 13:47 確認）。這一版有兩項需要在真的 BAT 上確認：

1. **T0553**：外部建立的 Worker 分頁，預設標題應為 `<Agent 顯示名> · Worker · <工單號>`（例 `Claude CLI · Worker · T0558`）；回報後工單小標籤顯示 `✓`。
2. **BUG-140 / T0551**：收單回收延遲期間，切換分頁 / 工作區時 xterm 送出的 focus report（`ESC [ I` / `ESC [ O`）不再算使用者輸入，不會取消回收。

本單就是那個 Worker。你的工作很小，真正的驗收由塔台在你回報後執行（`--close-worker`，延遲 60 秒，期間由使用者切換焦點）。

## 任務

1. 照 ct-exec 流程開工（填 `started_at`、`status: IN_PROGRESS`）。
2. 在回報區記錄以下事實（用指令取值，不要推測）：
   - 目前 agent 與版本（例：`claude --version`；取不到就寫「取不到」與原因）
   - BAT 版本：`C:\Program Files\BetterAgentTerminal\BetterAgentTerminal.exe` 的 FileVersion
   - 環境變數：`BAT_SESSION`、`BAT_TERMINAL_ID`、`BAT_TOWER_TERMINAL_ID`、`BAT_WORKSPACE_ID`、`CT_MODE`、`CT_INTERACTIVE`（**不要**印 `BAT_REMOTE_TOKEN` 的值，只寫有沒有設定）
   - 系統時間（`date "+%Y-%m-%dT%H:%M:%S%z"`）
3. 填完成狀態 `DONE`、`completed_at`，`git add` + `git commit --only` 本工單檔。
4. 照 ct-exec 收尾通知塔台（yolo：`bat-notify.mjs --submit`，`--source "T0558"`，source 必須正好是 `T0558`，這是 ✓ 標籤的比對依據）。
5. **通知之後保持閒置**，不再執行指令。分頁會在塔台收單後被 BAT 自動關閉，這是預期行為。

## 驗收條件（Worker 部分）

- [ ] 回報區含 agent / 版本、BAT FileVersion、上述 env（token 只寫有無）、系統時間
- [ ] commit 只含本工單檔
- [ ] 已以 `--source "T0558"` 通知塔台，之後無額外動作

## 塔台驗收（塔台在收單後執行，Worker 不需處理）

- **標題（T0553）**：`windows.json` 內本 Worker 分頁 `title` = `Claude CLI · Worker · T0558`（或對應 agent 顯示名），帶 `towerTerminalId` / `workorder`；無 `Remote:` 前綴
- **✓（T0553 / T0538）**：通知後分頁存有 `workerReport`（使用者目視縮圖標題後為 `✓`）
- **焦點切換不取消（BUG-140）**：`--close-worker T0558 --delay-ms 60000` → exit 0；延遲期間使用者切換分頁 / 工作區（不打字）；主行程 `[close-worker]` 行為 `scheduled delayMs=60000` → `close requested`（或等安靜後 `close requested after waiting …`），**不得出現 `cancelled`**
- 分頁實際消失；`windows.json` 已無此分頁
- 全部通過 → BUG-140 驗收 PASS；T0553 實機 PASS

---

## 回報區

> 以下由 sub-session 填寫

### 完成狀態

DONE（Worker 部分；塔台驗收另行執行）

### 產出摘要

Landing check：**PASS**
- C-0：frontmatter `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal` → PASS
- C-1：工單位於 `REPO_ROOT/_ct-workorders/` → PASS
- C-3：`affects_files` 只有 `_ct-workorders/` 下的本工單 → not applicable
- C-2：工單無 `branch` 欄位；目前分支 `main`
- 觀察到的 `BAT_WORKSPACE_ID`：`cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）

事實（全部以指令取值，2026-10-16T14:07:16+08:00 前後）：

| 項目 | 值 | 取值方式 |
|---|---|---|
| agent | Claude Code（`CLAUDECODE=1`、`CLAUDE_CODE_ENTRYPOINT=cli`） | env |
| agent 版本 | `2.1.300 (Claude Code)` | `claude --version` |
| 執行中的 claude 執行檔 | `<使用者資料夾>\.local\bin\claude.exe`（system claude，非 BAT 內嵌；PATH 上的 `claude` 同一檔） | `Get-CimInstance Win32_Process` 父行程鏈：pwsh ← cmd ← claude.exe |
| BAT FileVersion | `0.6.1-pre.5`（ProductVersion `0.6.1.0`，LastWriteTime `2026-10-16T05:20:52+08:00`） | `(Get-Item "C:\Program Files\BetterAgentTerminal\BetterAgentTerminal.exe").VersionInfo` |
| `BAT_SESSION` | `1` | env |
| `BAT_TERMINAL_ID` | `120046e8c82ff921e430493f2aa5af8a` | env |
| `BAT_TOWER_TERMINAL_ID` | `66447ea9-66e1-431a-8303-0f4ced7ec6a7` | env |
| `BAT_WORKSPACE_ID` | `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b` | env |
| `CT_MODE` | `yolo` | env |
| `CT_INTERACTIVE` | `0` | env |
| `BAT_REMOTE_TOKEN` | 已設定（值不記錄） | env |
| `BAT_REMOTE_PORT` / `BAT_HELPER_DIR` | `9876` / `C:\Program Files\BetterAgentTerminal\resources\scripts` | env |
| 系統時間 | `2026-10-16T14:07:28+0800` | `date "+%Y-%m-%dT%H:%M:%S%z"` |

備註：BAT FileVersion 的 LastWriteTime 為 05:20（檔案時間戳），與工單背景寫的「13:47 確認」是不同的量（後者為確認時間），不衝突。

變更檔案：只有本工單檔。未改產品程式碼、未跑 build / test、未呼叫 `--close-worker`、未動任何分頁。

### 互動紀錄

無（`CT_INTERACTIVE=0`，fire-and-forget）。

### Renew 歷程

無。

### 遭遇問題

無。

### 回報時間

2026-10-16T14:07:28+0800

---

## 塔台收單（第六十七 session，2026-10-16T14:09:53+0800）

- ✅ **T0558 已確認完成**：Worker commit `b181a5c4`（只含本工單檔）。
- **標題（T0553）PASS**：`windows.json` `title` = `Claude CLI · Worker · T0558`，帶 `towerTerminalId` / `workorder`，無 `Remote:` / `remoteOrigin`。
- **✓（T0553 / T0538）PASS**：`workerReport { message: "T0558 完成" }` 已存；使用者目視縮圖確認 `✓`。
- **焦點切換不取消（BUG-140）PASS**：14:08:40 `--close-worker T0558 --delay-ms 60000` → exit 0（stdout 含等安靜提示行）；延遲期間使用者切換分頁 / 工作區、不打字（renderer 日誌：Worker 分頁 06:08:47Z / 06:09:05Z / 06:09:15Z 三度 `active=true`，其他工作區縮圖 render）；`[close-worker] → scheduled delayMs=60000` → 60.010 s 後 `→ close requested (windows=1)`、renderer `closing tab`；無 `cancelled`；`windows.json` / `bat-pty-registry.json` 皆無此分頁。
- → BUG-140 **CLOSED**；T0553 實機 PASS。
