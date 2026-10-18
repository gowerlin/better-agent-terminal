---
schema_version: 1
schema_kind: workorder
id: T0619
title: "研究：PLAN-047 M1b-2 codex 分頁的 `blocked` 與啟動信號（codex 0.163.0 實測 OSC 9、yolo 核准模式、啟動信號候選）"
type: research
status: PENDING
repo: better-agent-terminal
project: PLAN-047
priority: P2
sizing: M
created_at: "2026-10-18T11:25:51+0800"
depends_on: []
related:
  - "T0574 回報區 R2（codex 建議 OSC 9 `approval-requested`（`-c tui.notifications`）＋句型後援；**未實際觸發**，只有文件 / 二進位字串證據，當時 codex 0.162.1）"
  - "T0590 / T0594 / T0597（claude hooks 的 `blocked`）、T0600（claude `SessionStart` 啟動確認；codex 一律 `agentStarted: null`）、T0607（codex 也回 `blocked` / `tower`，來自問答 store）"
  - "T0592（`e2e/t0592-codex-tower-worker.spec.ts`：隔離 BAT + 內嵌 codex `app-server`、隔離 `CODEX_HOME`，不呼叫模型；M1b-2 測試沿用此架構，D153）"
  - "並行：T0620（claude `ElicitationResult` 清除，改 `electron/terminal-blocked-state.ts` / `electron/bat-mcp-launch.ts` / `scripts/bat-hook.mjs`）—— 本單不改任何產品檔，無重疊"
affects_files:
  - _ct-workorders/T0619-research-codex-blocked-and-start-signals.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
research_max_questions: 3
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 研究單：**不改任何產品檔、不 commit 產品檔**；實驗用的腳本、設定、擷取檔一律放系統暫存目錄或 scratchpad（不得寫進 repo）。只 commit 本工單檔（`git commit --only`）。不 push。`src/styles/settings.css` 的 M 不是你的變更。"
  - "🔴 不得修改使用者的 `%APPDATA%\\BetterAgentTerminal\\settings.json`、`~/.codex/`（含 `config.toml`）、`~/.claude/`；codex 實驗一律用隔離的 `CODEX_HOME`（暫存目錄）。要讀使用者設定（例如 codex preset 的自訂參數）可以讀，回報只寫參數名，不寫任何權杖 / API key / 帳號資訊。"
  - "🔴 需要呼叫模型時用最便宜的設定、最短的 prompt，總共只為了觸發信號；回報記下大約用了幾次模型呼叫。codex 登入狀態不得複製到 repo。"
  - "🔴 yolo Worker：不得問使用者；範圍內無法決定且猜錯會返工的選擇，依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。"
---

# T0619 — 研究：codex 分頁的 `blocked` 與啟動信號

## 背景

claude 分頁靠 hooks 回報 `blocked`（T0590）與啟動（T0600），codex 分頁目前一律 `blockedDetection: none`、`agentStarted: null`。
T0574 建議 codex 走 OSC 9 `approval-requested`，但沒有實際觸發過，codex 也已從 0.162.1 升到 0.163.0。
另外，CT 的 yolo codex Worker 若以略過核准的模式執行，可能根本不會停下來等核准，`blocked` 偵測的價值要先確認。
**啟動信號**對 yolo 派工最直接（helper `--wait-started` 對 codex 目前只能回 `started: unknown`）。

## 要回答的問題

### Q1 — yolo codex Worker 會不會停下來等使用者？

1. BAT 派 codex Worker 時實際的啟動命令與參數：讀使用者 `settings.json` 的 codex preset 自訂參數（只寫參數名）、`electron/terminal-command-handlers.ts` / `buildLaunchCommand` 產生的命令。核准模式與 sandbox 模式是什麼？
2. 在這個模式下，codex 0.163.0 還有哪些情況會停下來等使用者（例如有沒有 `request_user_input` 之類的工具、plan mode、MCP elicitation、登入過期、信任目錄提示）？以二進位字串 / 文件 / 實測為證據，標證據等級。
3. 非 yolo（使用者手動開的 codex 分頁、預設核准模式）會停下來的情況。

### Q2 — OSC 9 在 codex 0.163.0 的實際行為（實測）

在隔離的 `CODEX_HOME` 下，以 `-c tui.notifications=…`、`-c tui.notification_method="osc9"`、`-c tui.notification_condition="always"`（鍵名以 0.163.0 實際為準）啟動 codex TUI（在 BAT 分頁或 node-pty 裡，終端寬高正常），用非 yolo 核准模式要它執行一個需要核准的指令：

1. 擷取 PTY 原始輸出，確認 OSC 9 序列的實際位元組（`ESC ] 9 ; … BEL/ST`）、內容、送出時機（距離畫面出現核准提示多久）。
2. 有哪些通知類型會送（`approval-requested`、`agent-turn-complete`、其他）？核准後、拒絕後、Esc 取消後各送什麼？有沒有能當「清除」的信號？
3. 視窗沒有焦點時 / `notification_condition` 各值的差異；codex 在 BAT 分頁內是否判斷為「沒焦點」。
4. 這些 `-c` 參數會不會改變 codex 其他行為（例如桌面通知、聲音）、會不會與使用者自己的 `config.toml` 衝突。
5. xterm.js 對 OSC 9 的處理：BAT renderer 目前收到 OSC 9 會怎樣（顯示亂碼、忽略、或觸發什麼）？主行程（PtyManager / Terminal Server）能否在不改寫輸出的情況下偵測它（只讀程式碼，不改）。

### Q3 — codex 的啟動信號候選

比較至少以下候選，各給出：何時出現、可靠度、在 BAT 哪一層能取得、成本：

- BAT MCP shim（`scripts/bat-mcp.mjs`）在 codex 啟動時被 codex 啟動並向 BAT 認證 —— 主行程能否據此記「已啟動」（看 shim 認證的時機是 codex 啟動時還是第一次用 tool 時）。
- OSC 9 / 其他 OSC（例如視窗標題 OSC 0 / 2）在啟動時是否會送。
- codex 的 `notify` 設定（`agent-turn-complete`）—— 只在回合結束時，能否當啟動後的第一個信號。
- `CODEX_HOME/sessions/` 檔案建立、輸出句型等。

### Q4 — 建議與介面草案

1. 值不值得做：分 yolo / 非 yolo 說明 `blocked` 偵測的實際價值；啟動信號的價值。
2. 推薦方案：`blockedDetection` 對 codex 要不要新增值（例如 `osc`）、`agentStarted` 的來源、清除規則；沿用 T0590 / T0600 契約的哪些欄位、哪裡要擴充（列出契約變更草案，並標明 CT 端是否需要跟著改）。
3. 實作切分與估計（幾張工單、要動的檔案、測試方式 —— 能否沿用 T0592 的「真 codex、不呼叫模型」e2e 架構）。
4. 風險與已知限制。

## 交付

- 回報區：Q1–Q4 逐題作答，每個結論標證據等級（`實測` / `二進位字串` / `官方文件` / `推論`），附實測步驟、codex / BAT 版本、擷取片段（去掉任何權杖）。
- 模型呼叫次數概估。
- 不改產品檔；完成後送 `T0619 完成`。

---

## 回報區

（Worker 填寫）
