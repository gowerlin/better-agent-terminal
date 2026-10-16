---
schema_version: 1
schema_kind: workorder
id: T0558
title: "pre.5 驗收探針重跑（T0557 期間使用者未確認焦點切換）（claude Worker）：Worker 分頁標題 `Claude CLI · Worker · T0558`、回報 ✓（T0553），收單回收延遲期間切換焦點不取消（BUG-140 / T0551）"
type: verification
status: TODO
repo: better-agent-terminal
project: BUG-140
priority: P2
sizing: XS
created_at: "2026-10-16T14:06:46+0800"
updated_at: "2026-10-16T14:06:46+0800"
started_at: ""
completed_at: ""
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

### 產出摘要

### 互動紀錄

### Renew 歷程

### 遭遇問題

### 回報時間
