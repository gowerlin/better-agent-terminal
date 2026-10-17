---
schema_version: 1
schema_kind: workorder
id: T0574
title: "研究：PLAN-047 BAT MCP Server 與 Worktree 合併 — 外部查證、本機範圍權杖影響面、stdio shim 原型、worktree / 合併工單實測"
type: research
status: PENDING
repo: better-agent-terminal
project: PLAN-047
priority: P2
sizing: M-L
created_at: "2026-10-17T18:42:52+0800"
depends_on: []
related:
  - "PLAN-047（塔台初評：§一 現況對照、§二 可行性、§三 修正建議、§三之一 合併改由合併工單）"
  - "外部提案原檔：D:\\ForgejoGit\\@Gower_Labs\\BMad-Guide\\BAT MCP Server 規格提案.md"
  - "PLAN-036 K / T0420 / T0432 / T0447–T0450（headless 每 PTY 範圍權杖、`electron/remote/helper-capability.ts`）"
  - "T0535 / T0545 / T0551（close-worker）、T0562 / T0565（set-role）、T0523 / T0527（派工落點 / cwd 檢核）、T0566（`src/lib/usage-limit.ts` 畫面辨識）"
  - "`electron/worktree-manager.ts`（現有 worktree，Agent 面板 / `claude-cli-worktree` 用）"
affects_files:
  - _ct-workorders/T0574-research-bat-mcp-and-worktree-merge.md
renew_count: 0
workdir: main repo
interaction:
  mode_hint: on
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 研究單：**不改任何產品程式碼、測試、CLAUDE.md、package.json**；唯一可寫入並 commit 的檔案是本工單（`git commit --only _ct-workorders/T0574-research-bat-mcp-and-worktree-merge.md`）。原型與實驗檔一律放在 repo 外的暫存目錄，結束後刪除，只把關鍵片段貼進回報區。"
  - "🔴 不 push、不觸發 workflow、不建 tag、不改版號；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF；含反斜線的內容用 Write 工具（L129）。`src/styles/settings.css` 的 M 不是你的變更。"
  - "🔴 不碰使用者正在用的 BAT（port 9876）與它的 Terminal Server；需要 BAT 時用隔離實例（需先 `npx vite build`）。可讀使用者的 `%APPDATA%\\BetterAgentTerminal\\Logs\\` 日誌（只讀）。"
  - "🔴 worktree 實驗**不得在本 repo 上 `git worktree add` 或建分支**：先 `git clone --local` 到 repo 外暫存目錄，在 clone 上做；結束後整個刪除。"
  - "🔴 不得對 claude / codex 送出任何 prompt（不耗額度）。驗證 MCP 連線只用不消耗額度的方式（例如 `claude mcp list` / `claude mcp get` 的健康檢查、自寫的 JSON-RPC 測試 client、讀 CLI 二進位字串）。"
  - "🔴 外部查證以官方文件為準，每一項附 URL 與取用日期；查不到官方原文的寫「未證實」，不得以推測代替。"
---

# T0574 — 研究：BAT MCP Server 與 Worktree 合併

## 元資料

- **工單編號**：T0574
- **任務名稱**：研究：PLAN-047 的可行性缺口查證與原型實測
- **狀態**：PENDING
- **類型**：research
- **互動模式**：disabled（`--no-interactive`；需要使用者決定的事項寫進回報區「待塔台 / 使用者決定」，不要停下來問）
- **Renew 次數**：0
- **建立時間**：2026-10-17 18:42 (UTC+8)

## 背景

使用者收到外部提案「BAT MCP Server 與 Worktree 合併規格提案」，提案方不了解 BAT / CT 實作細節。塔台已在 **PLAN-047** 完成初評（請先完整讀 PLAN-047，它是本單的起點，不要重做已確認的對照）。初評結論：

- 全部技術上可做；約一半有現成零件（headless 每 PTY 權杖、`create-agent-command`、`close-worker`、`lastOutputAt` / `getLastOutput`、`worktree-manager.ts`、`bat-scripts.log`）。
- **本機 PTY 持有全權 server token**（塔台 2026-10-17 實測本機分頁 `BAT_REMOTE_TOKEN` 不是 `batcap.` 前綴）→ 塔台建議前置條件改為「本機範圍權杖」，取代提案的 bat-daemon 分離。
- 塔台建議 MCP 傳輸首選 **stdio shim（`bat-mcp.mjs`）連既有 RemoteServer WSS**，不開新 HTTP 埠。
- 使用者方向（塔台同意）：**合併不由 BAT 執行，改由塔台派「合併工單」**；BAT 只提供唯讀信號；合併工單在整合 worktree 做、main 只 `--ff-only`。
- 塔台無法確認的：MCP 規格「2026-07-28 版」內容、Claude Code / Codex 當前 MCP 設定能力、blocked 偵測的 hook 能力。

## 研究目標

產出**可決策**的結論，讓塔台定案 PLAN-047 的範圍、階段與第一批實作工單。

## 調查範圍與研究指引

### R1 外部查證（官方文件，附 URL + 取用日期）

1. MCP 規格目前的最新版本與日期；提案引用的「2026-07-28 版」是否存在；若存在，確認：移除協定層 session / `Mcp-Session-Id`、HTTP+SSE 棄用、Sampling / Logging 棄用、`_meta` 的 OpenTelemetry 慣例。不存在則寫出實際最新版本對應的事實。
2. Claude Code 的 MCP 設定：`.mcp.json` 的 stdio / http 類型、`${VAR}` 展開是否適用於 `command` / `args` / `env` / `url` / `headers`；專案層 MCP server 的使用者核准流程；tool 呼叫逾時（長輪詢 `bat_wait` 30–60 s 是否會被截斷）；內嵌 CLI 2.1.300 是否支援上述（可讀 `node_modules/@anthropic-ai/claude-code` 內容）。
3. Codex CLI（目前常用的 0.16x）的 MCP 設定：`config.toml` 的 stdio / streamable HTTP、bearer token 環境變數、專案層設定是否存在。
4. 結論：stdio shim 是否兩邊都能用、Streamable HTTP 是否兩邊都能用、各自限制。

### R2 blocked 偵測（Worker 停在權限確認 / 等回答）

1. Claude Code hooks：有哪些事件可判斷「等待權限 / 等待使用者輸入 / 回合結束」（例如 Notification、Stop 等事件與 matcher）；內嵌 2.1.300 是否支援。
2. BAT 如何注入 hook **而不覆寫使用者 / 專案設定**：`--settings` 旗標、設定合併規則、env；與 PLAN-044 遇到的「專案層設定影響 CLI 行為」是否有同類陷阱。
3. Codex：有沒有對應的 hook / notify 事件可表示等待核准；沒有的話，畫面啟發式需要的句型（只從 CLI 二進位字串或官方文件取，不實際觸發），參考 `src/lib/usage-limit.ts` 的行首句型做法評估誤判風險。
4. 結論：各 agent 的 `source: hook | heuristic` 可達成度、預估延遲（提案驗收「5 秒內回 blocked」是否合理）。

### R3 本機範圍權杖（A' 回移本機）影響面

1. 列出本機 PTY 內所有使用 `BAT_REMOTE_TOKEN` 的呼叫者與其用到的 channel：`scripts/bat-terminal.mjs` 各模式（建立 agent / raw command / `--close-worker` / `--set-role`）、`scripts/bat-notify.mjs`、其他 `scripts/*.mjs`、BAT 內建 skill / preset 會呼叫的路徑。以 grep 為主，附檔案:行號。
2. headless 的 `helper-capability.ts` / `buildHeadlessHelperEnv` 能否直接給本機用；本機特有差異（Terminal Server 模式、T0108 replay 的 PTY 沒有 env 記錄、`pty:restart`、Terminal Server recovery、detached 視窗、本機的 raw command 模式 `terminal:create-with-command` 目前會被範圍權杖拒絕）。
3. 相容性：舊 helper / 舊 CT skill 搭配新 BAT、反之；BAT 重開但 Terminal Server 存活時已存在分頁的 env 仍是舊 token 的處理。
4. 結論：遷移步驟、風險、工單切分與估計。

### R4 `bat-mcp` stdio shim 原型（repo 外暫存目錄）

1. 寫最小原型：stdio JSON-RPC MCP server，讀 `BAT_REMOTE_PORT` / `BAT_REMOTE_TOKEN` / 憑證（參考 `scripts/_bat-cert.mjs`、helper 的 `MinimalWS` 與 frame id 比對規則 BUG-114），連**隔離實例**的 RemoteServer；提供 `initialize`、`tools/list`、至少一個唯讀 tool（例如 `bat_whoami` 由 env + 一個既有 channel 組成）。
2. 評估「零依賴手寫」vs「官方 MCP SDK」：helper 以 `extraResources` 散檔部署（`verify-helper-bundle.js` 只掃相對 `.mjs` import），SDK 依賴要怎麼進安裝檔與 server bundle、大小影響（安裝檔瘦身規則見 `CLAUDE.md`）。
3. 驗證：自寫測試 client 完成 handshake + `tools/list` + `tools/call`；內嵌 claude 以 `--mcp-config` 或 `claude mcp` 健康檢查確認能連上（**不送 prompt**）。
4. 遠端 headless：以靜態分析評估 shim 在遠端 PTY（`BAT_HELPER_NODE`、`batcap.` 權杖、角色表需新增哪些 channel）的可行性。
5. 結論：shim 方案是否成立、需要 BAT 新增哪些唯讀 channel（例如列終端、終端狀態、讀輸出），附建議 channel 清單與權限角色。

### R5 worktree 與合併工單實測（`git clone --local` 到 repo 外）

1. 在 clone 上建立 repo 外 worktree，量測（Windows）：`npm ci` 時間與磁碟用量、`npm run test:unit` 能否通過、`npx vite build` 時間。
2. 本專案特有：`_ct-workorders/` 在 repo 內且產品測試讀真實檔案（L133）。評估 `CT_HOME` 方案，至少比較：(a) env `CT_HOME` 指向主 checkout、worktree 內副本唯讀不提交；(b) worktree 以 sparse-checkout 排除 `_ct-workorders/`（測試是否因此失敗）；(c) 其他你發現更好的做法。附各自對 ct-exec（CT 端）的改動需求。
3. 合併工單流程演練（臨時 git repo 夾具即可）：整合 worktree 併入工單分支 → 驗收 → `git merge --ff-only` 到 main；涵蓋無衝突、文字衝突、驗收失敗、合併期間 main 被別人前進四種情況，記錄每種情況 main SHA 是否保持不變、塔台收單需要比對哪些 SHA。
4. BAT 唯讀信號可行性：`git merge-tree --write-tree` 試算衝突（本機 git 版本是否支援）、ahead / behind、實際變更 vs `affects_files` 的計算成本。
5. 小型無衝突合併是否允許塔台直接做：提出判準建議（例如 ff 可行 + 無範圍外檔案 + 驗收已在 Worker 跑過）。

### R6 綜合

1. 修正後的階段表（PLAN-047 §四），每階段工單估計與依賴。
2. PLAN-047 §五 與提案 §16 Q1–Q14 的建議答案（每題一行，附依據；Q9–Q11 依合併工單方向）。
3. 需要 CT 端（CT-T014 起）配合的變更清單與介面契約草案要點（只列要點，不寫 skill）。

## 互動規則

- `--no-interactive`：不向使用者提問。需要決策的事項列在回報區「待塔台 / 使用者決定」，附建議。
- 某項查不到或無法實測時，寫明原因與替代證據，繼續其他項；不要因單項卡住而停下。

## 驗收條件

1. R1–R6 每項都有結論，且標明證據等級：[官方文件 URL] / [碼 檔:行] / [實測] / [推論]。
2. R4 原型有實測輸出（handshake / tools/list / tools/call 的實際 JSON 片段）。
3. R5 有 `npm ci` / test / build 的實測數字與四種合併情況的 main SHA 表。
4. 「調查結論」是可決策的；「建議方向」至少兩個方案並給推薦。
5. 只 commit 本工單檔；暫存目錄（clone、原型、夾具）已刪除並在回報區寫明。

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態
（DONE / PARTIAL / BLOCKED）

### 互動紀錄
（`--no-interactive`，預期為「無」）

### 調查結論
（R1–R6，每項附證據等級）

### 建議方向
- [A] …
- [B] …
- **推薦**：…

### 待塔台 / 使用者決定

### 建議下一步
- [ ] 開實作工單（…）
- [ ] 繼續研究（Renew，新方向：…）

### Renew 歷程
無

### 遭遇問題

### 暫存清理

### Commit

### 回報時間
