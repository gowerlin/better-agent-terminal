---
schema_version: 1
schema_kind: workorder
id: T0892
title: "研究：檢查 `v0.8.0-pre.1` 安裝後的日誌與程序記憶體，找非預期問題（唯讀）"
type: research
status: PENDING
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: S
created_at: "2026-11-25T00:31:29+08:00"
updated_at: "2026-11-25T00:31:29+08:00"
depends_on: []
related:
  - "D317（使用者 2026-11-25：pre.1 實際使用觀察多分頁大量輸出與記憶體，也檢查 0.8.x 的 log 有沒有非預期問題）"
  - "PLAN-066；D307 / D309–D315；T0886–T0890（共用 conout Worker、`--max-semi-space-size=1`）；BUG-214（延後，已知限制：反覆開關分頁的 V8 高水位）、BUG-215（CLOSED）"
  - "CLAUDE.md「Logging」「Terminal Server 存活判定與 recovery」「Windows PTY holder」「Linux …」各節；`docs/agent-guide/logging.md`、`docs/agent-guide/pty-holder.md`、`docs/agent-guide/terminal-server-recovery.md`"
affects_files:
  - _ct-workorders/T0892-research-v080-pre1-log-review.md
renew_count: 0
互動模式: disabled
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 唯讀：只能寫本工單檔（`git commit --only _ct-workorders/T0892-research-v080-pre1-log-review.md`）。不改產品程式、不開 BUG / PLAN 檔、不改任何 `_ct-workorders/_*` 檔（BUG 由塔台依本單結論開）。不切分支、不 push。"
  - "🔴 不干擾使用者正在用的 BAT（安裝版 `0.8.0-pre.1`）：不結束、不重啟、不附加 debugger 到任何 BAT / Terminal Server / `bat-pty-holder` / shell 程序；不安裝 / 解除安裝；不改 Settings（含 Debug Logging 等級）；不呼叫會改變狀態的 helper（只允許 `bat-terminal.mjs --version` 與 BAT MCP 唯讀 tool）。程序資訊只用唯讀查詢（例 PowerShell `Get-Process` / `Get-CimInstance Win32_Process` 讀 WorkingSet / PrivateMemorySize / 命令列的執行檔路徑）。"
  - "🔴 讀日誌：`%APPDATA%\\BetterAgentTerminal\\Logs\\` 下 2026-11-24 03:35（`v0.8.0-pre.1` NSIS 重裝驗收）之後的檔：`debug-20261124-033627.log`、`debug-20261124-033706.log`、`debug-20261124-101607.log`（目前這次啟動，仍在寫入，約 2.9 MB）、`bat-scripts.log`（約 5.8 MB，只看 2026-11-24 03:35 之後的紀錄）；同目錄若有 Terminal Server / holder 相關日誌一併看。大檔用 `Select-String` / 分段讀，不要整檔載入。比對基準可看一份 pre.1 之前的日誌（例 `debug-20261123-203319.log`，`0.0.0-exp.18`）判斷某訊息是否新出現。"
  - "🔴 隱私（公開 repo，D176）：回報區不得貼權杖（`batcap.`、server token）、env 值、PTY 輸出內容、claude / codex 對話內容、完整 session id（只寫前 8 碼）、使用者家目錄（寫 `<使用者資料夾>`）、客戶 / 專案真名（工作區名稱一律寫「工作區A / B …」）。引用日誌只摘訊息類別與必要欄位（時間、模組 tag、錯誤碼、數量），每類最多 3 行樣本並去識別。"
  - "🔴 yolo：不得問使用者；判讀問題依 ct-exec § Questions For Tower 問塔台。不開會耗 token 的 claude / codex turn。"
---

# T0892 — 研究：`v0.8.0-pre.1` 安裝後的日誌與記憶體檢查

## 研究目標

使用者正在實際使用 `v0.8.0-pre.1`（2026-11-24 03:35 安裝；目前這次 BAT 啟動於 2026-11-24 10:16，已執行約 14 小時），要求在決定把 `v0.8.x` 併回 main 之前，檢查日誌有沒有非預期問題，並觀察多分頁大量輸出與記憶體。

要回答：

1. 日誌中有沒有 **錯誤 / 例外 / 非預期警告**（依類別彙總：次數、第一次與最後一次時間、模組 tag），哪些是 pre.1 之前就有的、哪些是新出現的。
2. **`v0.8.x` 新功能相關**的紀錄是否正常：Windows Terminal Server 共用 conout Worker（T0886–T0890）、PTY holder（PLAN-065，本機為 per-machine holder）、`--max-semi-space-size=1`、`[gpu]`、heartbeat / recovery（`[heartbeat] late pong`、`handleServerDeath`）、`[pty-fd-guard]` 等。有沒有 Worker 重啟、conout 斷線、recovery、孤兒清理、hello 協商失敗。
3. **記憶體**：目前 BAT 主行程、renderer、GPU、Terminal Server / holder、共用 conout Worker 等程序的 WorkingSet / Private（唯讀查詢），以及分頁數（BAT MCP `bat_list_terminals` 可見範圍或日誌）；與 T0889 / T0890 的量測（10 分頁 38.8 MB 等）比較是否合理，有沒有持續成長的跡象（日誌若有記憶體紀錄就看趨勢）。
4. `bat-scripts.log`：helper 派工 / notify / close-worker 的失敗紀錄（exit 非 0、`RECOVERY_PENDING`、`held-full`、逾時）。

## 已知資訊

- 已知限制：BUG-214（反覆開關分頁後 V8 高水位不回落，已延後）不要當成新問題，但若幅度明顯超過 T0890 量測要寫出來。
- pre.1 NSIS 重裝驗收 PASS（2026-11-24 03:35，`bat-nsis-acceptance-20261124-033551`）。
- 日誌位置與格式見 CLAUDE.md「Logging」與 `docs/agent-guide/logging.md`。

## 調查範圍

- 日誌檔（見 `memory_overrides` 第 3 條）。
- 程序唯讀查詢。
- 必要時讀 `v0.8.x` 分支的原始碼判斷某條日誌是否預期（`git show v0.8.x:<path>` 或 `git grep <pattern> v0.8.x`，不 checkout）。

## 研究指引

- 先用 `Select-String` 抓 `error|exception|fail|warn|uncaught|unhandled|crash|ENOENT|EPIPE|ECONNRESET|timeout|recovery|restart|exit code` 等關鍵字，依模組 tag 分組計數，再逐類判讀。
- 每一類給判定：**預期**（附依據：原始碼位置或 docs）／**既有問題**（pre.1 之前就有）／**新問題**（需塔台決定是否開 BUG）。
- 新問題要寫：現象、出現次數與時間、可能影響、建議的下一步（開 BUG / 再觀察 / 補日誌）。

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯（唯一例外：`### 待塔台決策` 的 `塔台答覆 Q-n` 行由塔台新增）

### 完成狀態
（DONE / PARTIAL / BLOCKED）
- **session_id**：

### 互動紀錄

### 調查結論

### 建議方向

### 建議下一步

### Renew 歷程
無

### 遭遇問題

### 回報時間
