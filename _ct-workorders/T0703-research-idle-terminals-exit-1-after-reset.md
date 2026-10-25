---
schema_version: 1
schema_kind: workorder
id: T0703
title: "研究：BAT「終端重置」toast 後多個閒置分頁 `[Process exited with code 1]`（BUG-171）— 找出觸發事件、為何只影響閒置分頁、為何 exit 1，並提出修正方向（只查不修）"
type: research
status: PENDING
repo: better-agent-terminal
project: ""
priority: P1
sizing: M
created_at: "2026-10-25T21:05:27+0800"
started_at: ""
updated_at: "2026-10-25T21:05:27+0800"
completed_at: ""
depends_on: []
related:
  - "BUG-171（使用者回報，2026-10-25 第九十四 session，附截圖）"
  - "CLAUDE.md「新 PTY 的初始尺寸」（Terminal Server recovery `handleServerDeath` 以 120x30 重建）、「Recovery 提示期間的 `pty:create`」（T0578）、「關閉分頁時的程序樹」（T0540）、「Logging」的 `[gpu]` 與 GPU 崩潰後可見終端重建（T0669 / BUG-164）"
  - "CLAUDE.md「Worker 問塔台」：PTY 結束經 `onPtyExit`、Terminal Server recovery 經 `PtyManagerDeps.onServerRecovery`"
affects_files:
  - _ct-workorders/T0703-research-idle-terminals-exit-1-after-reset.md
  - _ct-workorders/BUG-171-idle-terminals-exit-1-after-terminal-reset.md
  - "_ct-workorders/_report-T0703-idle-terminals-exit-1.md（回報太長時另寫，選用）"
renew_count: 0
workdir: main repo
worker_question_timeout: 30
research_max_questions: 3
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 只查不修：不改任何產品程式、測試檔、`package.json`、CI 設定、CLAUDE.md、docs。暫存檔與除錯輸出一律放 Worker 的 scratchpad。BUG-171 只填「根因」「修正方向」兩節與 frontmatter `updated_at` / `reproducibility`，不改 `status`。"
  - "🔴 使用者正在用的 BAT 只能讀：可以讀日誌（`<appData>/BetterAgentTerminal/Logs/` 的 debug log 與 `bat-scripts.log`）、可以用 BAT MCP 唯讀 tool；**不得**重啟 BAT、重啟或關閉任何分頁（含那些 exit 1 的分頁）、對任何分頁送輸入、改 userData 內任何檔案。需要實測時用隔離實例（沿用 e2e 的隔離 userData，需先 `npx vite build`）。"
  - "🔴 結論要有證據：每個「現況是 X」都附日誌行（時間 + 標籤，內容可節錄）、檔案:行號或測試名稱；推論與事實分開標示（【推論】）。"
  - "🔴 可以自己開唯讀子代理平行讀程式碼與日誌；回報區要有「子代理使用」紀錄：幾個、做什麼、約多少 tokens（讀不到就寫怎麼估的）。不使用 Workflow 工具（本單沒有授權）。"
  - "🔴 跑 helper 相關測試時，`BAT_HELPER_LOG_DIR`、`BAT_USER_DATA` 指到 scratchpad（CLAUDE.md 規則）。"
  - "🔴 公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」，回報只用代稱與 `<使用者資料夾>`，不寫真名、主機名稱、家目錄路徑或權杖；日誌節錄先遮掉這些。"
  - "🔴 yolo：不得問使用者；判讀問題與需要使用者提供的事實（例如 toast 原文）依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題），塔台會轉問使用者。Git：只用 `git commit --only` commit `affects_files`；不 push。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
---

# T0703 — 研究：終端重置後閒置分頁 exit 1

## 元資料

- **工單編號**：T0703
- **類型**：research（只查不修）
- **優先級**：P1
- **建立時間**：2026-10-25T21:05:27+0800
- **預估規模**：M
- **相關 BUG**：BUG-171

## 研究目標

使用者在 2026-10-25 21:05（UTC+8）前不久看到 BAT 忽然「終端重置」並出現 toast，之後好幾個**未忙碌**的分頁顯示 `[Process exited with code 1]`。要回答：

1. 觸發事件是什麼（Terminal Server 死掉 / recovery、GPU 崩潰後重建、閒置逾時、其他），什麼時間、哪個模組、toast 是哪一個？
2. 為什麼只影響閒置分頁、忙碌中的分頁（例如本塔台）沒事？
3. 那些分頁為什麼最後是一個新的 shell 提示字元加 exit 1，而不是原本的 claude 程序？exit 1 是誰給的（shell 自己、BAT 合成、Terminal Server）？
4. 這是新回歸還是既有行為（比對相關功能的引入版本與目前安裝版版號）？
5. 修正方向（至少兩個方案，含推薦）。

## 已知資訊

- 截圖：工作區 `BMad-Guide` 的分頁 `Claude CLI · Tower`（原本執行 claude 的塔台）只剩 Git Bash（UCRT64）提示字元 `$`，下一行 `[Process exited with code 1]`。
- 同一視窗工作區 `better-agent-terminal` 的塔台分頁（派這張單的塔台）沒有結束。
- 本次 BAT 啟動日誌：`<appData>/BetterAgentTerminal/Logs/debug-20261024-141441.log`（2026-10-24 14:14 啟動）；另有同目錄 `bat-scripts.log`。
- 塔台分頁環境有 `BAT_IDLE_TIMEOUT_MS=1800000`（30 分鐘）。【推論】可能與「只有閒置分頁受影響」有關。
- 安裝版版號：塔台沒有查；`v0.7.1-pre.7` 2026-10-25 20:00 前後才發佈，BAT 是 10-24 啟動，【推論】執行中的是 `v0.7.1-pre.6` 或更早。請以 exe 版號 / 日誌確認。
- toast 原文：未記錄；需要時問塔台。

## 調查範圍

1. **日誌時間線**：在 debug log 找 21:05 前（先抓 20:30–21:06）的事件：Terminal Server 斷線 / 死亡 / recovery、`[gpu]`、pty exit、idle timeout、toast 對應的事件；整理成時間線（哪些 terminal id 在何時 exit、exit code）。
2. **`BAT_IDLE_TIMEOUT_MS` 的語意**：誰設、誰讀、逾時做什麼，與 exit 1 有沒有關係。
3. **recovery 路徑**：`handleServerDeath` 重建時對每個 PTY 做什麼（重開 shell？重跑原指令？），怎麼決定哪些分頁重建，為何新 shell 會 exit 1；忙碌與閒置分頁的差別在哪。
4. **toast 來源**：BAT 有哪些「終端重置 / 重建」類 toast，各由什麼事件觸發（i18n key → 呼叫點）。
5. **影響**：分頁上的 claude session 能否 `--resume` 回來（`claudeSessionId` 持久化，T0642）、Worker 歸屬、問答（`onServerRecovery` 取消問題）、`--close-worker` 狀態。
6. **方案比較**：每個方案寫可靠度、改動範圍（唯一實作位置）、是否影響遠端 headless、是否需要改 BAT ↔ CT 契約、測試方式。

## 研究指引

- 先讀 CLAUDE.md 上列各節與對應 `docs/agent-guide/`（`recovery-create-hold.md`、`pty-process-tree.md`、`logging.md`），再看日誌與程式。
- 判斷對錯以使用者體驗為準：執行中的 agent 分頁不應無聲消失。

## 互動規則

- yolo、`--no-interactive`：不得問使用者。判讀問題與需要使用者提供的事實問塔台，每輪最多 3 題（`research_max_questions: 3`）。

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 待塔台決策（僅 yolo Worker 有問題時）

### 完成狀態

### 互動紀錄

### 調查結論

### 建議方向

### 建議下一步

### 子代理與 Workflow 使用

### Renew 歷程

### 遭遇問題

### Commit

### 回報時間
