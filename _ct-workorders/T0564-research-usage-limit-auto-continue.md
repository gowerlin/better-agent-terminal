---
schema_version: 1
schema_kind: workorder
id: T0564
title: "研究：claude / codex 終端分頁的 5 小時用量限制，能否可靠辨識（含解鎖時間、與週限制區分），以及 BAT 在 yolo 分頁解鎖後自動輸入「繼續」的設計（PLAN-044）"
type: research
status: TODO
repo: better-agent-terminal
project: PLAN-044
priority: P2
sizing: S
created_at: "2026-10-16T14:55:14+0800"
updated_at: "2026-10-16T14:55:14+0800"
started_at: ""
completed_at: ""
commit: ""
target_version: "研究，不改產品程式碼"
depends_on: []
related:
  - "PLAN-044（使用者選定的規格）"
  - "T0551 / BUG-140（`isTerminalAutoReply`：什麼算使用者輸入）"
  - "PLAN-041 / T0545（`--close-worker` 在 main 端計時、等安靜、使用者輸入取消：可參考的排程範本）"
  - "T0562（塔台分頁 `--set-role tower`：可能用來辨識塔台分頁）"
affects_files:
  - _ct-workorders/T0564-research-usage-limit-auto-continue.md
renew_count: 0
workdir: main repo
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 研究單：不改任何產品程式碼、設定或測試；只寫本工單檔。可以讀原始碼、跑唯讀指令、寫一次性探針到你的 scratchpad（不放進 repo）。"
  - "🔴 不為了觸發限制而消耗額度：不得刻意大量呼叫 claude / codex。訊息樣本來源：CLI 安裝包內的字串 / 錯誤型別（本機 `node_modules/@anthropic-ai/claude-code*`、系統 claude `C:\\Users\\Gower\\.local\\bin\\claude.exe`、codex 安裝位置）、官方文件 / changelog、BAT 日誌（`%APPDATA%\\BetterAgentTerminal\\Logs`）、CLI 自己的 session 紀錄（`~/.claude/projects/**/*.jsonl`、`~/.codex/sessions/**`）。"
  - "🔴 隱私：讀 session 紀錄時只擷取限制訊息 / rate limit 欄位本身，不得把對話內容（prompt、程式碼、回覆）抄進工單；路徑可寫，內容只寫與限制相關的欄位。"
  - "🔴 commit：`git add` 後 `git commit --only _ct-workorders/T0564-research-usage-limit-auto-continue.md`（其他 M / ?? 檔案是別張單進行中的變更，不是你的）。不 push、不觸發 workflow、不建 tag；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF。"
  - "🔴 不要呼叫 `bat-terminal.mjs --close-worker`；通知塔台之後不要再執行任何指令。"
---

# T0564 — 研究：用量限制辨識與自動繼續

## 背景

塔台 auto-session yolo 時，Tower / Worker 的終端分頁（PTY 內跑 `claude` / `codex` CLI）會撞到 5 小時用量限制，整條流程停住。使用者希望 BAT 認出限制與解鎖時間，時間到自動輸入「繼續」。規格（PLAN-044，使用者已選定）：

- 只套用在 yolo 分頁（`CT_MODE=yolo` 的 Worker，以及以 yolo 運作的塔台分頁）
- 輸入內容可設定，預設「繼續」，送出後 Enter
- 解鎖時間後再加可設定的延遲（例 2 分鐘）
- 取消：等待期間使用者在該分頁打字（終端自動回應不算，T0551）；解鎖時畫面已不是限制訊息；週（7 天）限制不自動繼續（只提示）

BAT 現況（塔台初步搜尋，請核對）：Agent 面板（SDK）已收到結構化 rate limit 事件（`electron/claude-agent-manager.ts:1024` `rateLimitType` / `resetsAt`；`src/components/CodexAgentPanel.tsx` `onRateLimit`，status line 顯示 5h / 7d 重置倒數）；`electron/handlers/claude.ts:425` 有 `rateLimits.five_hour.resets_at` 結構（來源待查）。**終端分頁目前沒有任何限制偵測**。

## 研究問題

1. **Claude CLI（`2.1.300`，內嵌與系統版）**：
   - 5 小時 / 週 / 模型專屬（例 Opus）限制在 TUI 上的訊息原文（含不同版本的變體）、重置時間的格式（相對 / 絕對、時區、12 / 24 小時制、跨日）。
   - 有沒有**結構化來源**可給終端分頁用：status line 指令收到的 JSON（`rate_limits`？`handlers/claude.ts:425` 是否就是它）、hooks（例 `Notification` / `Stop` 類事件是否帶限制資訊）、`~/.claude/projects/**/*.jsonl` 的錯誤紀錄、`--output-format` 等。BAT 能否在不改使用者全域設定的前提下取得（例如只對 BAT 啟動的分頁注入）。
2. **Codex CLI（目前安裝版本，WSL 為 `0.160.0`；本機請查）**：同上——訊息原文、重置時間格式、週限制區分、結構化來源（例 `~/.codex/sessions/**` 的 rate limit 欄位、app-server 事件）。
3. **偵測位置與方式**：main 端 PTY 輸出串流 vs renderer xterm buffer；文字比對的誤判風險（**同一分頁的對話內容本身可能出現限制訊息字樣**，例如塔台正在討論這個功能）——怎麼降低（優先結構化來源、比對 TUI 特有呈現、限定出現位置 / 時機、agent 閒置狀態等）。
4. **辨識 yolo 分頁**：Worker 有 `customEnv.CT_MODE`；塔台分頁沒有（塔台跑在使用者自己的分頁）——可行做法（T0562 的 tower role 加上 mode、helper 宣告、或其他）。
5. **送出**：PTY 寫入文字 + Enter 在 claude / codex TUI 上的可靠做法（參考 `bat-notify --submit` 的 renderer 合成 Enter、`[terminal-submit]` 日誌）；送出前的再確認（畫面仍是限制訊息、agent 仍在等待）。
6. **排程與取消**：放 main 端（比照 `WorkerCloseScheduler`）；BAT 重開 / 分頁重建 / detached / 遠端 headless 的行為；多個分頁同時撞限制；解鎖後立刻又撞（再次排程或停止）；時鐘與時區。
7. **Settings**：開關（預設？）、輸入文字、延遲分鐘；三語。
8. **風險與不做的事**：誤送的後果、與使用者自己手動繼續的競態、週限制提示的呈現方式。

## 產出（寫在回報區）

- 每個 CLI：訊息樣本（原文、來源、版本）、時間格式、結構化來源可行性，附證據（檔案路徑 / 行號 / 指令輸出）。區分「實測確認」與「依程式碼 / 文件推斷」。
- 推薦設計（偵測、辨識 yolo 分頁、排程、送出、取消、Settings、遠端），列出替代方案與不採用理由。
- 實作工單建議：範圍、`affects_files`、驗證方式（單元測試 / 以假 CLI 腳本輸出限制訊息的隔離 e2e，不耗額度）、需要塔台或使用者決定的事項（≤ 3 項，選項式）。
- 填 `DONE`（或 `PARTIAL` 並寫明缺口）、commit、通知塔台（yolo：`bat-notify.mjs --submit`，`--source "T0564"`），之後保持閒置。

---

## 回報區

> 以下由 sub-session 填寫

### 完成狀態

### 產出摘要

### 互動紀錄

### Renew 歷程

### 遭遇問題

### 回報時間
