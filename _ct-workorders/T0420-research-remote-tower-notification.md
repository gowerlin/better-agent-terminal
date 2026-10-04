---
schema_version: 1
schema_kind: workorder
id: T0420
title: "研究：遠端 Tower 通知（PLAN-036 P3 / K）—— 遠端 shell 內的 ct 塔台 / Worker 如何派發與回報；helper 與 token 注入的安全設計；拆單"
type: research
status: PENDING
repo: better-agent-terminal
project: PLAN-036
priority: P2
sizing: M
created_at: "2026-10-05T05:35:22+08:00"
started_at: null
updated_at: "2026-10-05T05:35:22+08:00"
completed_at: null
target_version: next
depends_on: []
related:
  - "PLAN-036 P3 / T0386 建議清單 K（回報區約 :206、:263）"
  - "PLAN-036「P1 候選」：遠端 `BAT_SESSION=1` 但無 `BAT_HELPER_DIR`"
  - "D134（本 session 排程表第 4 列）"
affects_files:
  - _ct-workorders/T0420-research-remote-tower-notification.md
interaction:
  mode_hint: yolo
  interactive: true
  intervention_type: decision-requiring
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **研究單不改產品程式碼**。只寫本工單回報區。"
  - "🔴 遠端實測只做唯讀偵測（`env | grep ^BAT_` 之類以 smoke / 既有工具在遠端 PTY 內執行亦可）；不得 restart `bat-server.service`、不得對 `~/.local/bat-server` 寫入、不得部署。"
  - "🔴 不得把任何 token 內容寫進回報區（只記「存在 / 不存在 / 長度」）。"
  - "🔴 同工作樹有其他 Worker 平行在改 `electron/` / `src/`：本單只讀。**禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）。不 push。"
---

# T0420 — 研究：遠端 Tower 通知（K）

## 背景

本機 BAT 終端會注入 `BAT_SESSION` / `BAT_REMOTE_PORT` / `BAT_REMOTE_TOKEN` / `BAT_TERMINAL_ID` / `BAT_WORKSPACE_ID` / `BAT_HELPER_DIR`，讓終端內的 claude（塔台）以 `bat-terminal.mjs` 開 Worker 分頁、Worker 以 `bat-notify.mjs` 回報塔台（`terminal:create-with-command` / `terminal:create-agent-command` / `terminal:notify` + `terminal:notified` 事件）。

遠端（WSL / SSH / Docker headless）視窗的終端：T0386 決定 P0 不注入 `BAT_HELPER_DIR`、**不要**把 headless 自己的 token 注入遠端 shell（遠端任意程序可讀 env）；helper `.mjs` 不在 server bundle。⇒ 在遠端終端裡跑 `/control-tower` 時 auto-session 會 fallback 到剪貼簿 / 文字提示。

## 研究目標

1. **現況盤點**：遠端 PTY 目前實際注入哪些 `BAT_*`（程式碼 + 唯讀實測）；`terminal:*` channel 在 headless 的分類現況（T0416 已分類）；helper 對 RemoteServer 的連線方式（WSS + token + fingerprint？）在遠端 shell 內是否可行（遠端 shell 連的應是遠端 headless server 還是本機 BAT？）
2. **方案比較**（至少 3 個，含「不做，維持 fallback」）：例如 (a) headless server 簽發**範圍受限的短期 token**（只允許 `terminal:create-*` / `terminal:notify`）並注入遠端 PTY，helper 隨 bundle 出貨；(b) 透過既有 client ↔ server 連線由本機 BAT 代為建立分頁（遠端 helper 打 headless，headless 以事件轉給 client）；(c) 不做
3. **安全分析**：token 外洩面（同機其他使用者、`/proc/<pid>/environ`、子行程繼承）、權限範圍、撤銷 / 輪替、與 `isHeadlessScrubbedEnvKey` 的關係
4. **端到端流程**：遠端塔台派發 → 新分頁出現在**哪個視窗 / workspace** → Worker 完成通知回到哪個終端
5. **拆單建議**（D 區段表格，格式見下）

## 互動規則

- 允許向使用者提問（`CT_INTERACTIVE=1` 時），最多 3 題，選項式；方案選擇屬 decision-requiring，可在研究結尾以選項請使用者裁決
- 不互動時：給推薦方案 + 理由，由塔台裁決

## 回報要求

回報區須含：
- 現況結論（附程式碼證據 `檔案:行`）
- 方案比較表（工時 / 安全風險 / 使用者價值）
- 推薦方案
- `### 拆單建議摘要` 段落，第一個表格欄位必須為 `| # | 標題 | 專案 | 依賴 | 工時 | 🚦 |`（供塔台 YOLO 機械 parse；標題欄先用「工單 1」等占位，塔台會補 T####）

## Sub-session 執行指示
1. 讀本工單 + T0386 回報區（K 列、helper / env 列）+ `electron/pty-manager.ts` / `electron/handlers/pty.ts` env 注入段 + `electron/terminal-command-handlers.ts` + `scripts/bat-terminal.mjs` / `scripts/bat-notify.mjs`
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 調查 → 填回報區；完成寫 **`DONE`**
4. `git commit --only` 本工單；不 push
5. 依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

### 互動紀錄

### 調查結論

### 建議方向

### 拆單建議摘要

### 遭遇問題

### 回報時間
