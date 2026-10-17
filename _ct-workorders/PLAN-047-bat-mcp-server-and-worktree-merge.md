---
schema_version: 1
schema_kind: plan
id: PLAN-047
title: BAT MCP Server 與 Worktree 合併（外部提案審議：可行性與現況對照）
status: IN_PROGRESS
priority: medium
created_at: "2026-10-17T18:35:37+0800"
updated_at: "2026-10-17T19:07:31+0800"
plan_type:
  - feature
  - architecture
scope:
  - MCP server（13 個 bat_* tool，三階段）
  - 每終端身分 / 權限（本機 PTY 範圍權杖）
  - 終端狀態偵測（working / blocked / idle / exited）
  - 訊息匯流排與 artifact 儲存
  - worktree 隔離、合併引擎與合併佇列
  - CT 端配合（CT_HOME、斷點 D / E、frontmatter isolation / merge）
estimated_workorders: 12
links:
  source: "D:\\ForgejoGit\\@Gower_Labs\\BMad-Guide\\BAT MCP Server 規格提案.md"
  related: [T0574, T0575, T0576, T0577, D149, D150, PLAN-036, PLAN-041, PLAN-044, PLAN-045, T0420, T0449, T0523, T0535, T0537, T0545, T0551, T0562, T0565, D134, D144, D145, D147, D148]
---

# PLAN-047 — BAT MCP Server 與 Worktree 合併

## Metadata

| 欄位 | 內容 |
|------|------|
| PLAN 編號 | PLAN-047 |
| 優先級 | 🟡 Medium |
| 狀態 | 🔄 IN_PROGRESS（D149 採路線 [A]；第一批 T0575 A1 / T0576 A2 / T0577 T） |
| 來源 | 外部規格提案「BAT MCP Server 與 Worktree 合併規格提案」（2026-10-17，@Gower）；原檔路徑見 frontmatter `links.source` |
| 提案前提 | 提案方未掌握完整 CT / BAT 實作細節；本單由塔台對照現況評估 |

## 動機（提案摘要）

1. YOLO 中 Worker 停在權限確認 / 等回答時，塔台在收到回報前看不到（無聲停滯）。
2. 跨 workspace 只能靠人或檔案中轉，沒有即時信號。
3. agent 間交換中間產物沒有管道，只能寫 repo 暫存檔。
4. agent 想查 BAT 狀態要解析 CLI 文字輸出。
5. 每張工單在獨立 worktree 執行，完成後由塔台決定合併，BAT 負責預檢 / 驗證 / 合併，合併成功前 main 不動。

## 塔台評估方法與證據等級

- **[文]**：`CLAUDE.md` 與既有工單 / 決策的記載（本專案 SoT，逐項皆有對應工單）。
- **[碼]**：塔台 2026-10-17 以 grep / 少量讀檔確認（非完整程式碼分析）。
- **[推]**：塔台推論，需研究單查證。
- 未做：MCP 規格 2026-07-28 版內容、Claude Code / Codex 當前 MCP 設定能力的外部查證（塔台知識無法確認，列入研究單）。

---

## 一、逐項對照：已做到 / 部分做到 / 未做到

### 1. 身分與認證（提案 §6）

| 提案項目 | 現況 | 判定 |
|---|---|---|
| spawn 時發放每終端 token、只存記憶體、綁 terminal / workspace / role / dispatcher / work_order | **遠端 headless 已完全做到**：PLAN-036 K（T0420 / T0432 / T0447–T0450，D134）每 PTY 簽發 `batcap.` 權杖，registry 只存 SHA-256 digest，PTY exit / kill 即撤銷，`pty:restart` 保留角色，server 重啟全失效，預設拒絕的 `helper-capability.ts` 角色表 [文] | ✅ 遠端已做到 |
| 同上（本機） | **本機未做到**：本機 PTY 注入的 `BAT_REMOTE_TOKEN` 是全權 server token（塔台 2026-10-17 實測本分頁 token 非 `batcap.` 前綴）[碼]；`CLAUDE.md` 記為「A' 回移本機為另案」[文] | ❌ 本機未做到 |
| 角色 tower / worker / shell | tower = `--set-role tower`（T0562 / T0565）；worker = 帶 `BAT_TOWER_TERMINAL_ID`（+ `CT_MODE`）的派工分頁；其餘為一般分頁 [文] | ✅ 判定依據已存在 |
| `dispatcher` / `work_order` 綁定 | `customEnv.BAT_TOWER_TERMINAL_ID`、`PtyInstance.workorder`（T0535）、BAT 重開後以已存分頁歸屬補齊（T0537）[文] | ✅ |
| 身分不接受參數宣告 | `--close-worker` / `--set-role` 已遵守（歸屬只來自 BAT 存的資料；headless `towerId` / `terminalId` 必須是自己）[文] | ✅ 原則已落地 |

> ⚠️ **塔台發現（與提案 S7 相關）**：提案把「Worker 冒充塔台執行控制動作」列為未來 MCP 的威脅，但在**本機今天就存在**——任何本機分頁裡的程式都持有全權 token，可經 RemoteServer 呼叫任意 proxied channel（`pty:write` 到別的分頁、建立終端等），沒有角色閘門。MCP 若沿用本機現行 token 模型，權限矩陣（§7）形同虛設。**本機範圍權杖是 MCP 控制類能力的真正前置條件，比 daemon 分離更優先。**

### 2. 權限模型（提案 §7）

| 提案項目 | 現況 | 判定 |
|---|---|---|
| 預設拒絕 + 角色矩陣 | headless `helper-capability.ts`（tower：create-agent-command / close-worker / set-role；worker：notify / pty:write 可列印文字 / keypress）[文] | 🟡 架構可直接擴充，tool 集不同 |
| 「只能作用於自己派出的 Worker」 | `isWorkerOf` + `BAT_TOWER_TERMINAL_ID` 雙重比對（T0536）[文] | ✅ |
| 跨 workspace 白名單 | 無；只有派工落點判斷（T0523）與 cwd 檢核（T0527）[文] | ❌ |
| `bat_send_input` 閘門（非 YOLO 跳 UI 確認） | 無 tower → worker 輸入通道；現有方向相反：`bat-notify` 是 Worker → 塔台的預填 / `--submit`（非 yolo 不自動送出）[文] | ❌ |
| yolo 判定 | `PtyManager.isYoloTerminal`（塔台宣告優先，T0566）[文] | ✅ 可直接引用 |

### 3. Tool 對照（提案 §8，13 個）

| Tool | 最接近的現有能力 | 判定 |
|---|---|---|
| `bat_whoami` | env `BAT_TERMINAL_ID` / `BAT_WORKSPACE_ID` / `BAT_TOWER_TERMINAL_ID`；headless 權杖已綁角色 [文] | 🟡 資料都在，無查詢介面 |
| `bat_list_terminals` | Terminal Server `pty:list`（main ↔ server 內部協定）[碼]；window registry 存分頁清單 [文] | 🟡 內部有，未對 agent 開放 |
| `bat_get_state` | `PtyManager.lastOutputAt` / `getLastOutputAt`（close-worker 等安靜用）[碼] → 可推 working / idle；exited 有 `onPtyExit` | 🟡 working / idle / exited 可做；**blocked 未做** |
| `bat_read_output` | `PtyManager.getLastOutput(id, lineCount)` [碼]；去 ANSI 文字尾巴 `plainTextFromOutput`（T0566 用量限制）[文] | 🟡 有零件，無 cursor 分頁、無機密遮罩 |
| `bat_worktree_status` | `WorktreeManager.getWorktreeStatus` 只回 diff / 分支 / 路徑 [碼] | 🟡 無 ahead / behind / 範圍偏移 / 預測衝突 |
| `bat_post` / `bat_wait`（message） | `terminal:notify`（Worker → 塔台：toast + badge + 預填）[文]；無 agent 收訊機制 | ❌ 只有單向通知 |
| `bat_wait`（state_change / terminal_exit） | 無 | ❌ |
| `bat_put_artifact` / `bat_get_artifact` | 無 | ❌ |
| `bat_dispatch` | `terminal:create-agent-command`（agent default 解析 D140、落點 T0523、cwd 檢核 T0527、工作區參數 T0529、`AGENT_UNKNOWN` 等錯誤碼）[文] | ✅ 語意已完整，缺 `isolation` |
| `bat_send_input` | 無 tower → worker 通道 | ❌ |
| `bat_close` | `terminal:close-worker`（`NOT_FOUND` / `NOT_OWNER` / `AMBIGUOUS`）[文] | ✅ 語意已完整，缺 `worktree` 參數 |
| `bat_merge` | Claude / Codex 面板有「Merge」按鈕，但做法是**把合併指示當 prompt 交給 agent 去做**（`dialog.confirm` 後送文字）[碼] | ❌ BAT 本身不執行合併 |

> ⚠️ **提案與現況不符**：§8.5 寫 `bat_close`「包含延遲期間有新輸出或使用者輸入即取消的規則」。這是 T0545 前的行為；**D145 起延遲期間的輸出不取消**，改為到期後等連續安靜 5 s（最多再 60 s），只有本機視窗 / client 的使用者輸入（且非終端自動回應，T0551）才取消。`bat_close` 應沿用現行語意。`TERMINAL_BUSY` 對應舊 exit 6 `BUSY`，現已不回（保留相容）。

### 4. 傳輸與架構（提案 §5）

| 提案項目 | 現況 | 判定 |
|---|---|---|
| bat-daemon 擁有全部終端 | **已部分存在兩種形態**：① Windows 預設的 Terminal Server 是 fork 出的獨立行程，持有所有 PTY、BAT 重開仍存活（T0108 replay）[碼 / 文]；② 遠端 headless bat-server 是完整無 UI daemon（PTY + RemoteServer + handler）[文]。但本機的 RemoteServer、handler、window registry、scheduler 仍在 Electron main | 🟡 |
| Streamable HTTP 127.0.0.1 + Origin 驗證 | 現有 RemoteServer 是 **WSS + 自簽憑證 + fingerprint pinning**（PLAN-018 T0182），自訂 frame 協定（helper 以 frame id 比對，BUG-114）[文] | ❌ 無 HTTP 端點 |
| `bat-mcp` stdio shim | 無；但本機 / 遠端 helper（`bat-terminal.mjs` / `bat-notify.mjs`）已是「讀 env → 連 RemoteServer → 認證 → invoke」的同一模式，且隨 server bundle 部署（T0433 / T0456）[文] | 🟡 模式現成 |
| MCP SDK | `package.json` 無 `@modelcontextprotocol/*` 依賴 [碼] | ❌ |
| 稽核 NDJSON | `bat-scripts.log`（helper 與主行程 `mirrorToBatScripts` 各一筆）[文] | 🟡 格式可沿用，無 MCP 欄位 / OTel |

### 5. 狀態偵測 blocked（提案 G2、Phase 1 驗收「5 秒內回 blocked」）

- 現況無任何 permission prompt / 等待回答偵測 [碼]。
- 可行路徑 [推]：
  - **claude**：Claude Code 有 Notification hook（權限請求 / 閒置等待），BAT 可在 claude-cli 分頁注入 hook 設定或由 CT 專案設定提供，hook 以 helper 回報 → `source: "hook"`。需研究：注入方式不能覆寫使用者設定、與 `--settings` / 專案層設定的優先序（PLAN-044 已遇過專案層設定影響 CLI 行為）。
  - **codex**：hook 能力較少，可能只能靠畫面啟發式（比照 `src/lib/usage-limit.ts` 的行首句型辨識）→ `source: "heuristic"`，句型隨 CLI 版本漂移（PLAN-044 同樣風險）。
- 判定：**claude 可做到且可信，codex 需研究**；「5 秒內」對 hook 路徑合理，對啟發式需配合安靜判斷（現有 5 s 安靜常數）。

### 6. Worktree 與合併（提案 §14）

| 提案項目 | 現況 | 判定 |
|---|---|---|
| 建立 / 清理 worktree | `electron/worktree-manager.ts`：Agent 面板 session 與 `claude-cli-worktree` preset 使用；`git worktree add` / `remove --force` / `prune`、孤兒清單 [碼] | 🟡 有，但綁 agent session id |
| 位置 | 現況在 **repo 內** `<gitRoot>/.bat-worktrees/<shortId>`（加進 `.git/info/exclude`）；分支 `bat/worktree-<id>` [碼]。提案要 repo 外 `<repo 上層>/.bat-worktrees/<repo>/<工單 ID>`、分支 `ct/<工單 ID>` | 🟡 需改命名與位置（或並存） |
| 派工 `isolation: worktree` | `terminal:create-agent-command` 無此參數 | ❌ |
| BAT 執行的合併（merge-tree 試合併、驗證設定檔、三策略、合併後驗證、佇列、閘門） | 無 | ❌（新功能，技術上單純 git 操作，可做） |
| `CT_HOME` 單一工單來源 | 無；**本專案特有風險**：`_ct-workorders/` 在 repo 內且產品測試讀真實檔案（L133），worktree checkout 必然帶一份副本 | ❌（CT 端 + BAT 端皆需改） |
| 範圍守衛 `out_of_scope_files` | CT 有 `affects_files`（派工前重疊檢查），無實際變更比對 | ❌ |

本專案自身的成本 [推]：每個 worktree 都要 `npm ci`（electron / claude-code 內嵌 binary 數百 MB，npm 12 `allowScripts`），Windows 路徑長度、e2e 隔離實例的埠，`.bat/worktree-setup` 成本高 → 提案 Q12 / Q13 對本專案不是小問題。

### 7. CT 端（提案 §13.3）

- 全部屬 CT skill 範圍（ct-exec / control-tower）。塔台不得直接改 skill 檔（Hard Boundary），沿用既有 `CT-T###` 跨專案工單（下一張 CT-T014），如 CT-T011（close-worker）/ CT-T013（set-role）的模式：**BAT 先定介面契約，CT 依契約撰寫**。

---

## 二、可行性結論

| 能力 | 可做到？ | 主要成本 / 風險 |
|---|---|---|
| Phase 1 唯讀查詢（whoami / list / get_state 不含 blocked / read_output / worktree_status） | ✅ 可做，零件大多已存在 | MCP 端點與 SDK 引入；headless 對等（CLAUDE.md 要求 headless parity 測試） |
| blocked 偵測 | 🟡 claude 可（hook）；codex 待研究 | hook 注入不得干擾使用者設定；codex 句型漂移 |
| Phase 2 訊息 / artifact / 跨 workspace | ✅ 可做，全新開發 | 提示注入傳染（S1）是設計問題不是技術問題；agent 只能以 `bat_wait` 長輪詢收訊，會佔住 agent 回合 |
| Phase 3 控制類 | ✅ 可做，`dispatch` / `close` 已有語意 | **前置：本機範圍權杖**；`send_input` 需新 UI 確認閘門 |
| 軌道 W 合併引擎 | ✅ 可做，但**不建議由 BAT 做**（改派合併工單，見 §三之一） | CT_HOME 牽動 CT 與本 repo 測試；本專案 worktree 初始化成本高 |
| 前置「bat-daemon 分離」 | ⚠️ **不建議作為前置** | Terminal Server 已在獨立行程持有 PTY；MCP 層放在 Electron main（與現有 RemoteServer 同處）即可，無需先做大型架構搬遷 |

---

## 三、塔台對提案的修正建議（供審議）

1. **前置條件改為「本機 PTY 範圍權杖」（A' 回移本機），取代 bat-daemon 分離（回應 Q2）。** 直接沿用 headless 的 `helper-capability.ts` / `buildHeadlessHelperEnv` 模式；同時順帶關掉今天就存在的本機越權面。需注意既有本機 helper 用全權 token 的所有呼叫點（`bat-terminal.mjs` 各模式、`bat-notify.mjs`、ct 系列 skill）都要能以範圍權杖運作。
2. **傳輸首選 stdio shim 連既有 WSS（回應 Q1 / Q6）**：`bat-mcp.mjs` 隨 helper 一起部署，讀 `BAT_REMOTE_PORT` / `BAT_REMOTE_TOKEN` / 憑證 fingerprint，沿用 frame id 比對規則。好處：不開新埠、沒有 HTTP 就沒有 DNS rebinding / Origin 問題、自簽 TLS 不必讓 Claude Code / Codex 信任、本機與遠端 headless 一套（`BAT_HELPER_NODE`）。Streamable HTTP 降為選配。
3. **`bat_close` 沿用 D145 / T0551 現行語意**（等安靜、只有使用者輸入取消），錯誤碼沿用 `NOT_FOUND` / `NOT_OWNER` / `AMBIGUOUS` 的現有對應。
4. **遠端不是非目標**：BAT 已有遠端 Tower / Worker（PLAN-036 K、PLAN-039）；MCP 若只做本機，遠端 Tower 的能力會落後本機。建議同一 handler 本機 / headless 共用（比照 `registerTerminalHandlers`、`WorkerCloseScheduler`）。
5. **worktree 合併軌道與 MCP 解耦、獨立排期**：它的價值（並行不互污、可追溯合併）不依賴 MCP，且 CT_HOME 牽動 CT 協定，宜先以研究單評估本專案自身（`_ct-workorders` 在 repo 內、測試讀真實檔）的落地方式。
6. **MCP 規格版本敘述待查證**：提案引用「2026-07-28 版」（移除 session / `Mcp-Session-Id`、Sampling / Logging 棄用等），塔台無法確認，列入研究單；若不成立，§5.2 無狀態設計仍可保留（本來就是較安全的設計）。

---

## 三之一、合併由誰執行：BAT 合併引擎 vs 塔台派「合併工單」（使用者方向，2026-10-17 18:40，評估中）

使用者傾向：**不由 BAT 自己執行合併，改由塔台派專職合併工單給 Worker 執行**。塔台評估如下。

| 面向 | BAT 合併引擎（提案 §14.6 / W2） | 合併工單（使用者方向） |
|---|---|---|
| 衝突處理 | 只能偵測、回報，衝突仍要另開工單（提案自己也這樣寫） | Worker 直接理解語意並解決；提案的「衝突 → 開合併工單」本來就是這條路，等於把所有合併都走同一條 |
| 驗證 | 需新增 `.bat/merge.json` 具名設定檔（防 S10 指令注入） | 沿用專案既有驗收規則（本專案 `CLAUDE.md`：build、`npm run typecheck`、`typecheck:electron`、`test:unit`），不需新設定檔 |
| 可追溯（G8） | 需另寫稽核 + 決策日誌 | 工單回報區天然記錄：合併前後 SHA、衝突檔、驗證證據、commit 訊息含工單 ID |
| 「main 在通過前不變」的保證 | 機械保證（程式控制） | 只靠工單指示 → **需補機械護欄**（見下） |
| 開發成本 | W2 約 2–3 張（試合併、三策略、佇列、閘門、UI 確認框、契約測試） | 幾乎為 0：合併工單模板 + CT 規則；BAT 不必新增寫入類 git 能力 |
| 執行成本 | 無 token 成本、秒級 | 每次合併一個 agent session（token、數分鐘） |
| 合併順序 / 佇列 | BAT 佇列 | 塔台排序、一次只派一張合併單（`affects_files` 重疊檢查即可擋並行） |
| 與提案原則一致性 | BAT 做 git 寫入 | 更符合 P1「工單是唯一權威通道」與「BAT 不做決策」 |

**塔台結論：採用使用者方向，但保留兩個不需 BAT 寫入能力的護欄。**

1. **合併在整合 worktree 內做，main 只 fast-forward**：合併工單在獨立 worktree（或整合分支）把工單分支併入 → 跑完全部驗收 → 通過才 `git merge --ff-only` 到 main；不通過 main 不動。塔台收單時比對「派工時 main SHA」與「回報的合併前 SHA」，被別人動過即 Renew 重做。不 push（沿用現行授權規則）。
2. **BAT 只提供唯讀信號**（保留提案 `bat_worktree_status` 的提前警示）：ahead / behind、未提交變更、`out_of_scope_files`（實際變更 vs `affects_files`）、以 `git merge-tree` 試算的預測衝突。這些都是查詢、不改分支，屬 Phase 1 唯讀範圍；塔台據此決定合併順序、要不要派合併單。

連帶調整：
- 提案 `bat_merge` tool、合併佇列、`MERGE_IN_PROGRESS` / `MAIN_DIRTY` 等錯誤碼、§14.9 BAT 端 UI 閘門 → **移除**；YOLO 下的「合併前人工確認」改為 CT 斷點（提案斷點 E 保留，由塔台觸發）。
- Q9 合併策略、Q10 合併位置 → 寫進合併工單模板（建議 `--no-ff` 合併 commit 訊息含工單 ID；位置 = 整合 worktree）。
- Q11 MERGE 單據 → 建議沿用一般工單 + 固定模板（frontmatter 例如 `kind: merge`、`merges: [T####]`），是否新增單據類型留給 CT 端決定。
- 軌道 W 只剩 **W1**（派工 `isolation: worktree`、`CT_HOME`、清理 keep / remove / archive）+ 唯讀 `worktree_status`。

待評估（研究單一併處理）：
- 本專案每個 worktree 需 `npm ci`；合併工單的整合 worktree 可長期保留重用，避免每次重裝。
- 合併工單本身也動到 main 的歷史，仍需 `CT_HOME` 確保它的回報寫回主 checkout 的工單檔。
- token 成本：小型、無衝突的合併是否允許塔台直接做（類比「小型非邏輯變更塔台可直接處理」），還是一律派單。

## 研究結論（T0574 DONE，2026-10-17 19:01；完整內容見 T0574 回報區）

- **R1**：MCP `2026-07-28` 版存在且為最新（移除 session 與 `initialize` 握手、改 `server/discover` + per-request `_meta`；HTTP+SSE / Sampling / Logging 棄用；OTel `_meta`）。Claude Code 2.1.300 stdio 無每請求 60 s 計時、`--mcp-config` 可注入；Codex 0.162.1 可用 `-c mcp_servers.*` 注入、`tool_timeout_sec` 預設 60 s。
- **R2**：claude 用 hook（`PermissionRequest` / `PreToolUse` AskUserQuestion / elicitation），`--settings` 附加會與使用者 hooks 合併；`disableAllHooks` 時降級。codex 建議 OSC 9 `approval-requested`（`-c tui.notifications`）+ 句型啟發式後援；codex hooks 需信任審核，不適合 yolo。
- **R3**：本機全權 token 可呼叫**所有** `registerHandler` channel（含 `fs:*`、`settings:save`、任意 `pty:write`）並收全部廣播——越權面比初評更大。capability 程式碼已在共用 `RemoteServer`，本機只差接線（A1）；但權杖只存記憶體，BAT 重開而 Terminal Server 存活時會全部失效 → 須同版做持久化（A2）。
- **R4**：零依賴手寫 dual-era stdio shim（約 200 行）在隔離實例實測通過 legacy `initialize` 與 modern `server/discover`；內嵌 claude 2.1.300 `claude mcp list` ✔ Connected（走 modern）。建議新增唯讀 channel：`terminal:whoami` / `list` / `get-state` / `read-output` / `wait` / `worktree:terminal-status` / `terminal:report-hook`。
- **R5**：worktree 每個 `npm ci` 約 16 s / 2.1 GiB，test 60 s 全綠；sparse 排除 `_ct-workorders/` 會讓 5 個 parser-parity 測試失敗 → 建議 `CT_HOME` + 樣本改 fixture。合併工單 `--ff-only` 在四種情況都機械保證 main 不變；`merge-tree` 試算約 50 ms。CT 落點檢查 C-0 在 worktree 會誤判，CT 端需修。
- **推薦方向 [A]**：A1 + A2（同版）→ M1（shim + 唯讀）→ M1b（blocked）；T（樣本 fixture）+ W1 + CT-T014 / CT-T015 並行；M2 / M3 視 M1 使用情況再決定。修正後階段表與 Q1–Q14 建議答案見 T0574。

## 三之二、合併工單的三種模式（D150）

使用者問：合併工單能否由 AI 判斷做衝突解決或等價移植，而非單純合併。**可以**，定為三種模式：

| 模式 | 適用 | Worker 做什麼 | 額外證據 | yolo 斷點 E |
|---|---|---|---|---|
| ① 機械合併 | 無衝突且符合 T0574 R5 五條判準 | （塔台可直接做）`--no-ff` 於整合 worktree → main `--ff-only` | SHA 比對五步 | 不暫停 |
| ② 衝突解決 | 有文字 / 語意衝突，但工單分支的意圖仍適用於目前 main | 在整合 worktree 解衝突、跑完整驗收 | 每個衝突檔：雙方意圖、採用的解法與理由 | 驗收全綠且無範圍外檔案 → 自動 ff；否則暫停 |
| ③ 等價移植 | 分支過舊、程式碼已被重構搬移、或 EXP / 上游（tony1223）成果要採用 | 以原工單的目標與驗收條件為規格，在目前 main 上重新實作；不使用 git merge | 「原 commit / hunk → 新位置」對照表；原驗收項逐條在新樹上重驗；原本沒有測試的行為要補測試或標「需真人驗收」 | **一律暫停**，使用者確認後才 ff |

共同護欄：只在整合 worktree 工作，main 只 `--ff-only`，不 push；完整驗收（build、兩個 typecheck、test:unit + 原工單驗收）；範圍以原工單 `affects_files` 為準，超出要列明。**模式由塔台決定**：Worker 在 ② 遇到超出衝突解決的情況，回報 PARTIAL 並建議改 ③，不自行升級。細節寫進 CT-T015 合併工單模板。

## 四、建議階段（待使用者決定）

| 階段 | 內容 | 型態 |
|---|---|---|
| R | 研究單：外部查證（MCP 規格現行版、Claude Code / Codex 的 MCP 設定與 env 展開 / bearer、Claude Code Notification hook 與注入方式、codex 可用信號）、本機範圍權杖對既有 helper 的影響面、stdio shim 原型可行性、worktree 在本 repo 的初始化成本實測 | 1 張研究單 |
| A | 本機 PTY 範圍權杖（A' 回移本機） | 1–2 張 |
| M1 | Phase 1：`bat-mcp` shim + 唯讀 tool（不含 blocked）+ 稽核；本機 / headless 對等 | 2 張 |
| M1b | blocked 偵測（claude hook 先、codex 依研究） | 1–2 張 |
| W1 | worktree 隔離派工 + CT_HOME + 清理（含 CT-T 跨專案單）；合併改由合併工單執行（§三之一），BAT 不做合併引擎 | 1–2 張 + CT-T（合併工單模板） |
| M2 / M3 | 訊息 / artifact / 跨 workspace；控制類 + UI 閘門 | 3–4 張 + CT-T |

## 五、待決議題（塔台整理，取代 / 補充提案 §16）

- [ ] 要不要做、做到哪一階段（建議先 R → A → M1）
- [ ] Q1 傳輸：stdio shim 連既有 WSS（塔台建議）vs 新開 loopback HTTP
- [ ] Q2 前置：本機範圍權杖（塔台建議）vs bat-daemon 分離
- [ ] 遠端 headless 是否同步支援（塔台建議同步）
- [ ] worktree 軌道是否與 MCP 分開立案
- [ ] 合併執行者：合併工單（使用者方向，塔台同意，§三之一）— 待研究單評估後定案為決策
- [ ] 小型無衝突合併是否允許塔台直接做
- [ ] 提案 §16 Q3–Q8、Q12–Q14 待研究單結果後再逐項決議（Q9–Q11 已併入 §三之一建議）

## 變更紀錄

- 2026-10-17 18:35 — 建立；塔台對照現況完成初評（第七十二 session）
- 2026-10-17 18:40 — 使用者方向：合併改由塔台派合併工單，不由 BAT 執行；新增 §三之一評估，軌道 W 縮為 W1
- 2026-10-17 18:42 — 開研究單 T0574（R1 外部查證 / R2 blocked 偵測 / R3 本機範圍權杖 / R4 shim 原型 / R5 worktree 與合併工單實測 / R6 綜合）
- 2026-10-17 19:01 — T0574 DONE；新增「研究結論」節，推薦方向 [A]，待使用者決定階段與第一批工單
- 2026-10-17 19:07 — D149 採路線 [A]，狀態 → IN_PROGRESS；開 T0575（A1）/ T0576（A2，依賴 T0575）/ T0577（T）；D150 合併工單三種模式（新增 §三之二）
- 2026-10-17 19:36 — T0577 DONE（`58ec1046`，L133 放寬）；T0575 DONE（`2c59edee`，本機 `batcap.` 權杖）；後續小單候選：headless 同步開放 raw command（T0575 任務 2 評估）；派 T0576
- 2026-10-17 19:55 — T0576 DONE（`7e3c1d7d`，權杖跨 BAT 重開保留）；A1 + A2 完成，待同版發佈與實機驗收；衍生 BUG-146
- 2026-10-17 20:13 — T0579 DONE（`514710a9`，headless tower 開放 raw command，本機 / headless 共用角色表）；候選：headless PTY `PATH` 加入內嵌 claude（需決策，暫不開）
- 2026-10-17 20:17 — T0578 DONE（`f833e3b0`，BUG-146 FIXED、BUG-147 FIXED）；開 T0580（helper 派工 / restart 等 hold 放行），完成後發 `v0.7.0-pre.1`
- 2026-10-17 20:27 — CT-T014（CT 文件對齊 BAT 0.7.0 範圍權杖）轉交 BMad-Guide 塔台；原規劃的 CT_HOME / C-0 單與合併工單模板單順延編號（CT-T015 / CT-T016），待 BAT W1 介面契約定稿再發
- 2026-10-17 20:33 — T0580 DONE（`f03e5e27`，helper 派工 / restart 等 hold 放行，2 s 逾時 `RECOVERY_PENDING`）；0.7.0-pre.1 範圍（T0575–T0580）全部完成，準備發版
- 2026-10-17 21:52 — `v0.7.0-pre.1` 實機驗收通過（T0581、BMad-Guide T0150）；D152 第二批：開 T0582（M1-1 唯讀 channel）/ T0583（W1-1 worktree 隔離派工）並行，T0584（M1-2 shim）/ T0585（W1-2 worktree 狀態）待前兩張完成；worktree 依賴由 Worker 自己安裝
- 2026-10-17 22:23 — T0582 DONE（`6b2ac19e`，五個唯讀 helper channel + 遮罩）、T0583 DONE（`462522ef` / `4e7da0e3`，`--isolation worktree` + `--close-worker --worktree`）；塔台複驗 @ `b39634cb` 全綠；並行派 T0584（`bat-mcp.mjs` shim + 注入，Settings 開關預設開）/ T0585（`worktree:terminal-status` + helper `--worktree-status`）
