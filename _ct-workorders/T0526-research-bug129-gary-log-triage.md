---
schema_version: 1
schema_kind: workorder
id: T0526
title: "研究：以 Gary 補上的日誌判定 BUG-129（塔台派工落到土銀工作區、開成 Claude）屬 T0523 §1 哪條路徑，並給出根治方案建議"
type: research
status: PENDING
repo: better-agent-terminal
project: BUG-129
priority: P1
sizing: S
created_at: "2026-10-14T16:54:51+0800"
started_at: ""
updated_at: "2026-10-14T16:54:51+0800"
completed_at: ""
related:
  - BUG-129
  - "T0523（§1 路徑表、§2 推論、§3 判定方式、§7 後續建議）"
  - PLAN-040
affects_files:
  - _ct-workorders/T0526-research-bug129-gary-log-triage.md
  - _ct-workorders/BUG-129-tower-dispatch-lands-in-wrong-workspace.md
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **只讀不改產品程式碼**：本單是判定 + 建議，不實作修正（根治單由塔台依結論另開）。可讀 `electron/**` / `scripts/**` / `src/**` 對照日誌行的出處。"
  - "🔴 **日誌是 Gary 的個人資料**：兩個日誌檔留在 `D:\\Downloads\\`，**不得複製進 repo、不得 commit**。回報區只引用判定需要的最少行；引用時把 email（例如 Google Drive 路徑裡的帳號）與使用者名稱以外的個資遮蔽為 `<redacted>`；`BAT_REMOTE_TOKEN` 或任何 token 一律不得出現。"
  - "🔴 不碰使用者正在用的 BAT（port 9876、真實 userData、真實 `bat-scripts.log`）。不消耗 Claude token。"
  - "🔴 **禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）；寫檔 LF；不 push。`src/styles/settings.css` 的 M 狀態不是你的變更，不要 commit 它；commit 用 `--only`。"
  - "🔴 時間戳一律取自系統（R-G001）。日誌時間是 UTC（`Z`），Gary 在 UTC+8，換算時寫清楚。"
---

# T0526 — 研究：以 Gary 的日誌判定 BUG-129 根因路徑

## 研究目標

BUG-129：Gary（mac）在 **SCB** 工作區的 Codex 塔台以
`bat-terminal.mjs --notify-id "$BAT_TERMINAL_ID" --workspace "$BAT_WORKSPACE_ID" --agent default …` 派 T0001，
Worker 分頁卻出現在 **2025_土銀客服中心建置案** 工作區，而且開成 Claude Code（cwd 正確，是 SCB）。

T0523 已修可修的 BAT 端路徑，但 Gary 的情境當時只有**推論**（最可能是 #11：Codex 沿用舊 thread 的 shell snapshot，`BAT_TERMINAL_ID` / `BAT_WORKSPACE_ID` 都指向土銀）。現在 Gary 補上日誌，請**依證據判定**屬於哪條路徑，並給出可決策的後續方案。

## 已知資訊

- 日誌（Gary 提供，**只讀**）：
  - `D:\Downloads\debug-20261014-113525.log`（2236 行，267 KB）：Gary mac 上 **2026-10-14 11:35（UTC+8）啟動那次**的 BAT main 日誌，第一行 `PID=48287 argv=/Applications/BetterAgentTerminal.app/...`。⚠️ pre.8 在 14:20 才發佈，所以這份日誌**多半是 pre.7 或更早的版本**（沒有 T0523 新增的 `[T0523]` / `workspaceResolved` 等日誌）。請先從日誌判定版本。
  - `D:\Downloads\bat-scripts.log`（84 行）：helper 日誌，時間範圍至少 `2026-10-14T04:35Z` ～ `08:13Z`（= UTC+8 12:35 ～ 16:13），**可能**橫跨 pre.8 換裝；若有 pre.8 helper 的紀錄，會含 T0523 新增的實際落點工作區 / agent。
- 事件時間：Gary 於 LINE 回報 13:21-13:25（UTC+8），新分頁 id 為 `bbe2011f0a4c657884595b351f2a38ab`（截圖）。派工應在 13:21 前不久，即 `~05:0xZ ～ 05:2xZ`。
- 截圖與完整背景：`BUG-129`（含三張截圖路徑，在 `D:\Downloads\`）。
- **判定方式已寫好**：`T0523` 回報區第 3 節（要看哪幾行、怎麼對應到第 1 節路徑表的 #4 / #5 / #9 / #11）。路徑表與推論見 T0523 第 1、2 節，根治方向見第 7 節。
- Gary **沒有**提供 `windows.json`。SCB 那個 Codex CLI 分頁的 terminal id 需從 debug log 推得（例如 PTY 建立 / 還原時記錄的 id 與 workspaceId）；推不出來就寫明缺口。

## 調查範圍

1. **版本**：兩份日誌各自是哪個 BAT 版本寫的（依 startup 行或其他可辨識的特徵；不要只用字串存在性判版，L127）。
2. **事件定位**：在 `bat-scripts.log` 找出產生 `bbe2011f…` 的那次派工（`invoke` / `parsed` / `exit`），列出 `env.BAT_TERMINAL_ID` / `env.BAT_WORKSPACE_ID`、`notifyId` / `workspaceId`、`agent`、exit code。
3. **在 debug log 對應同一事件**：`[remote][terminal] terminal-created … workspaceId=<R>`、`[agent-command] resolved agent=…`、`[T0130] External terminal added: … workspaceId(landed)=<L> workspaceId(requested)=<R>`、是否有 `[T0361] Workspace miss`。
4. **身分對照**：從 debug log 找出 SCB 工作區 id、土銀工作區 id、SCB 的 Codex CLI 分頁 terminal id、土銀各分頁 terminal id（PTY 建立 / 還原行、Terminal Server 重接行等）。把派工時的 `BAT_TERMINAL_ID` / `BAT_WORKSPACE_ID` 對到這些 id。
5. **判定**（依 T0523 §3 對應表）：
   - R = 土銀 id 且 `BAT_TERMINAL_ID` = 土銀分頁 → **#11**（env 來自另一個分頁，agent CLI 還原了舊環境）
   - R = 土銀 id 但 `BAT_TERMINAL_ID` = SCB 分頁 → SCB 分頁自身 env 過期（#5 或新路徑）→ T0523 已可修正
   - R 未知且 L = 土銀 → **#9**
   - 以上都不符 → 寫出新路徑與證據
6. **agent**：確認 `--agent default` 解析成 Claude 的來源（SCB / 土銀工作區的 `defaultAgent`、`settings.defaultAgent`），與 PLAN-040（工作區層級預設 Agent 沒有 UI）的關係。
7. **同一事件的其他派工**：`bat-scripts.log` 裡其他派工（例如 04:35Z 那筆 `codex … $ct-exec T0008` 的 raw command 派工）是否也有 env 與所在分頁不一致的情形；有 pre.8 helper 紀錄的話，看 T0523 的落點輸出是否正確。
8. **順帶（次要，只記錄不展開）**：debug log 裡若有與 BUG-127（切換工作區 toast 洪水）、BUG-128（mac Finder 拷貝貼上）相關的錯誤或異常，列出行號與一句說明即可。

## 研究指引

- 對照日誌行時，到程式碼找該行的出處（`electron/terminal-command-handlers.ts`、`electron/dispatch-workspace.ts`、`electron/pty-manager.ts`、`src/App.tsx`、`scripts/bat-terminal.mjs`），確認語意，避免看錯欄位。
- 若判定為 #11：評估 T0523 §7-1 的根治方案（helper 送祖先 PID 鏈、main 比對 PTY pid；mac / Linux / Windows 各自取得 ppid 的方式與成本；遠端 headless 是否適用），以及較便宜的替代（例如 `cwd` 與工作區 `folderPath` 不一致時只警告），給 [A]/[B]/[C] 與推薦。
- 若判定為其他路徑：說明 pre.8 是否已修好；未修則給修正方向。
- 證據不足以判定時，寫明還缺什麼（例如 Gary 的 `windows.json`、在 SCB Codex 內與一般分頁執行 `echo $BAT_TERMINAL_ID $BAT_WORKSPACE_ID` 的比對、`grep -l BAT_WORKSPACE_ID ~/.codex/shell_snapshots/*`），並寫成**可以直接轉給 Gary 的要求清單**。

## 互動規則

- 本單以 `--no-interactive` 派發：不向使用者提問，證據不足就在回報區列出缺口。

## Sub-session 執行指示

1. 讀本工單、`BUG-129`、`T0523`（特別是回報區第 1-3、7 節）
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 調查 → 填回報區（DONE / PARTIAL / BLOCKED）
4. 依結論更新 `BUG-129`：在「根因與修正」段後新增「**Gary 日誌判定（T0526）**」小節（判定結果、關鍵證據、是否需後續單）；`reproducibility` 依證據調整；**`status` 維持 FIXED 不動**（結案與否由塔台決定）
5. commit 本單與 BUG-129（`git commit --only`）；不 push；依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

### 版本判定

### 事件時間線（UTC 與 UTC+8 並列）

### 判定結果（對應 T0523 §1 的路徑編號）

### agent 解析

### 其他派工 / pre.8 落點輸出

### 順帶觀察（BUG-127 / 128）

### 建議方向
- [A]
- [B]
- [C]
- **推薦**：

### 建議下一步

### 給 Gary 的補充要求（若證據不足）

### 遭遇問題
