---
schema_version: 1
schema_kind: plan
id: PLAN-041
title: 塔台收單後自動回收 Worker 分頁（BAT `--close-worker` 能力 + CT `*config` 開關與延遲）
status: PLANNED
priority: medium
created_at: "2026-10-15T15:44:39+0800"
updated_at: "2026-10-15T15:44:39+0800"
target_batch: "0.6.1-pre.3"
workorders: [T0535, T0536, T0537, CT-T011]
links:
  related: [T0534, D144, T0523, T0525, T0432, T0450]
---

# PLAN-041 — 收單後自動回收 Worker 分頁

## Metadata

| 欄位 | 內容 |
|------|------|
| PLAN 編號 | PLAN-041 |
| 優先級 | 🟡 Medium |
| 狀態 | 📋 PLANNED（2026-10-15 15:44 開立，四張工單已建立、未派發） |
| 來源 | 使用者提問「塔台收單完成後能否自動關掉 Worker 工單終端」；T0534 研究（推薦方案 B'）；D144 |
| 說明網頁 | https://claude.ai/artifact/E9ZBy1JRwibBXrwnMdB4LS （私人） |

## 背景

- BAT 只有使用者按 ✕ 時，renderer 會 `removeTerminal` + `save()`。主行程與 helper 沒有入口（T0534 §1.1、§1.3）。
- `pty:kill` 只殺程序，分頁留著顯示 `[Process exited]`，autosave 寫回 registry，重開後變成同 id 的空 shell（T0534 §1.2）。
- 遠端 tower 權杖只允許 `terminal:create-agent-command`（T0534 §1.7）。
- ⇒ 只改 CT 做不到，需要 BAT 提供能力。

## 分工（D144）

| 層 | 負責 | 不負責 |
|---|---|---|
| **CT**（`*config`） | 要不要回收（`worker_auto_close: off \| done`，預設 `off`）、延遲幾秒（`worker_close_delay: 0–300`，預設 `10`）、何時呼叫（DONE 且不 Renew、收單確認後） | 判斷分頁歸屬 |
| **BAT** | 提供 `bat-terminal.mjs --close-worker`；驗證歸屬、唯一命中、閒置；計時延遲；延遲期間有新輸出或使用者輸入就取消；走與 ✕ 相同的關閉路徑 | **不設 Settings 開關**、不判斷工單狀態 |

## 介面契約（BAT ↔ CT，T0535 實作、CT-T011 依此撰寫）

```bash
node "$BAT_HELPER_DIR/bat-terminal.mjs" --close-worker T#### --notify-id "$BAT_TERMINAL_ID" [--delay-ms <0-300000>]
```

- `--close-worker <工單編號>`：格式同 `--workorder`（`[A-Z]{2,4}-` 前綴可選）。查詢「由 `--notify-id` 塔台派出、`workorder` 相符」的 Worker 分頁。
- `--notify-id`：必填（呼叫者自己的 `BAT_TERMINAL_ID`）。
- `--delay-ms`：預設 `0`，BAT 夾在 `0–300000`。
- 不得與建立分頁的參數（`--prompt` / `--skill` / 位置參數等）同時使用。

| exit code | 意義 | CT 處理 |
|---|---|---|
| `0` | 已排程（或 delay 0 已關閉） | 靜默 |
| `3` | `NOT_FOUND`：找不到（含 BAT 重開前派出、T0537 之前的版本） | 靜默，可提示一次「請手動關閉」 |
| `4` | `NOT_OWNER`：該工單的 Worker 不是這個塔台派出的 | 回報使用者，不重試 |
| `5` | `AMBIGUOUS`：同一塔台同一工單有多個 Worker 分頁（Renew 重派等） | 回報使用者，不重試 |
| `6` | `BUSY`：分頁最近 5 秒內仍有輸出 | 回報使用者，不重試 |
| `1` | 用法錯誤、連線失敗，或 BAT 太舊（舊版對未知參數印 `Unknown option '--close-worker'` 並 exit 1，**不會建立分頁**） | 一行警告「BAT 不支援或連線失敗」，不重試 |

stderr 另印一行 `close-worker: <CODE>`（診斷用；CT 只依 exit code 判斷）。

## 工單

| 工單 | 範圍 | 依賴 | sizing |
|---|---|---|---|
| **T0535**（B'-1） | BAT 本機：PtyManager 記錄 `workorder` + 查詢、`terminal:close-worker` handler、main 端延遲計時與取消、`terminal:close-requested` 事件、renderer 共用關閉函式、helper `--close-worker` | — | M |
| **T0536**（B'-2） | 遠端 headless：tower 權杖加 channel + `isWorkerOf`、headless handler、事件加進 `PROXIED_EVENTS` | T0535 | S |
| **T0537**（B'-4） | 持久化 Worker 歸屬（`towerTerminalId` / `workorder` 存進工作區），BAT 重開後 `--close-worker` 仍有效 | T0535 | S–M |
| **CT-T011**（取代原 B'-3 local_rule） | CT 下一版：`*config` 兩個新選項、收單流程掛點、Bash 白名單、exit code 處理；Claude / Codex 兩份 skill 同步 | 介面契約（可並行撰寫；發佈需等含 T0535 的 BAT 版本） | S |

建議順序：T0535 → T0536 / T0537（可並行）→ CT-T011 發佈。BAT 三張併入 `0.6.1-pre.3` 批次（與 BUG-136 修正同批，「batch fixes before release」）。

## 範圍外（另案）

- 方案 D：分頁列標示「Worker / 已回報」與右鍵批次關閉（T0537 完成後資料已具備）
- T0534 §8 的後續項目：死分頁按 ⏻ 無反應、CT 文件 `result=true` 漂移、`~/.codex/AGENTS.md` 範例、`sourceTerminalId` 永遠為空
