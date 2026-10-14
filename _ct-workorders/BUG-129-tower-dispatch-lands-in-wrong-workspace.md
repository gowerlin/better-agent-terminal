---
schema_version: 1
schema_kind: bug
id: BUG-129
title: "塔台派工落到錯的工作區：Gary 在 SCB 工作區的 Codex 塔台用 bat-terminal.mjs --workspace \"$BAT_WORKSPACE_ID\" --agent default 派 T0001，Worker 分頁出現在另一個工作區（土銀），而且用 Claude Code 開（預期 Codex）"
status: FIXED
severity: medium
reproducibility: unknown
created_at: "2026-10-14T13:31:24+0800"
updated_at: "2026-10-14T13:48:23+0800"
fixed_at: "2026-10-14T13:48:23+0800"
impact:
  - control-tower
  - bat-terminal-helper
  - workspace-routing
links:
  discovered_in: "Gary 回報（mac，LINE 2026-10-14 13:21-13:25；內嵌 Claude Code v2.1.296 ⇒ BAT ≥ pre.5）"
  fix_workorder: T0523
  related: ["T0176（BAT_WORKSPACE_ID 注入）", "T0137 / BUG-031（未帶 --workspace → 落在 active workspace，設計行為）", "T0361（external terminal 實際落點日誌）"]
---

# BUG-129 — 塔台派工落到錯的工作區，agent 也解析錯

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟡 medium（Worker 在錯的工作區 / 錯的 agent 執行；cwd 正確所以改的是對的專案，但使用者看不到、Tower 通知可能送錯地方） |
| 可重現 | 待確認（Gary 日誌待補） |
| **狀態** | ✅ FIXED（T0523；Gary 情境待日誌 / 實機確認，見下方殘留風險） |
| 回報者 | Gary（mac） |

## 現象（Gary 原話與截圖）

> 我在 SCB 工作區裡新增一張工單，CT 把 worker session 新增到土銀工作區去，而且用 claude code 開 XDDDD
> Session 誤開的部份他自己修正了 XDD

截圖（皆在 `D:\Downloads\`）：
- `messageImage_1791955327079_0.jpg`：SCB 工作區（只有 1 個「Codex CLI」分頁）。Codex 塔台執行 `node /Applications/BetterAgentTerminal.app/Contents/Resources/scripts/bat-terminal.mjs --notify-id "$BAT_TERMINAL_ID" --workspace "$BAT_WORKSP…` → `✓ Terminal created: bbe2011f0a4c657884595b351f2a38ab`。塔台自述「剛才派工用了 `--agent default`，BAT 將它解析成 Claude Code」。Codex 狀態列：cwd `~/Library/Mobile Documents/com~apple~CloudDocs/Documents/3Probe Project/SCB專案資料`，另有一段「**套用2025_土銀客服中心建置案規則**」（Codex 端的顯示，來源待查）
- `messageImage_1791955358535_0.jpg`：**2025_土銀客服中心建置案**工作區。底部縮圖有 4 個分頁（Codex CLI、Remote: codex ×2、新的一個），新分頁是 `Remote: '/Applications/BetterAgentTerminal.app/Contents/Resources/app.asar.unpacked/node_modules/@anthropic-ai/claude-code-darwin-arm64/claude'`，跑的是 Claude Code v2.1.296 `/ct-exec T0001`，**cwd 卻是 SCB專案資料**
- `messageImage_1791955533975.jpg`：Gary 的 Codex 塔台事後在**它專案的** `_ct-workorders/_local-rules.md` 自行加規則：「Worker 預設使用 Codex CLI…派工明確傳 `--agent codex`」、「派工前核對 BAT 工作區名稱、專案路徑及 Tower 終端。若繼承的 `BAT_WORKSPACE_ID` / `BAT_TERMINAL_ID` 指向其他專案，先以 BAT 當前工作區資料核對」⇒ 塔台推定**它所在 PTY 的 `BAT_WORKSPACE_ID` 指向土銀工作區**

## 預期

- 塔台在 SCB 工作區的終端派工，Worker 分頁應出現在 SCB 工作區
- `--agent default` 應解析成「塔台所在工作區」的預設 agent（SCB 的 workspace default → settings.defaultAgent）

## 塔台初步分析（Worker 須複核）

- `--agent default` 的解析：`electron/terminal-command-handlers.ts:420-426`：`resolveWorkspaceDefaultAgent(opts.workspaceId)` → `settings.defaultAgent` → `'claude-code'`。所以**兩個症狀可能是同一個根因**：塔台送出的 `workspaceId` 是土銀的 id（或是無效 id）⇒ 分頁落到土銀，agent 也照土銀的 workspace default（或全域預設 claude-code）解析
- `BAT_WORKSPACE_ID` 在 PTY 建立時注入（`electron/pty-manager.ts:688/756/838`，T0176），之後**不會變**。可能讓它跟分頁目前所屬工作區不一致的情境（待查）：分頁在工作區之間移動 / 拖曳、啟動時還原分頁、Terminal Server 重新接回既有 PTY、`pty:restart`、工作區複製、detach / reattach
- 也可能是 `--workspace` 帶的 id 在 renderer 找不到 → `addExternalTerminal` 退回 active workspace（`src/App.tsx:472-475` T0361 日誌會印 `workspaceId(landed)` / `workspaceId(requested)`）
- Gary 的日誌（`~/Library/Application Support/BetterAgentTerminal/Logs/debug-*.log`）由 Gower 索取中，可用 `[T0130] External terminal added` 與 `[agent-command] resolved agent=` 兩行直接判定

## 根因與修正

（T0523 回填，詳見 T0523 回報區第 1–3、7 節）

**BAT 端的根因**：派工的落點與 `--agent default` 的解析，完全取決於塔台 shell 送來的 `--workspace "$BAT_WORKSPACE_ID"`。這個值在 PTY 建立時注入，之後不會再核對，而且有幾條路徑會讓它過期或錯置：
- `pty:restart`：Electron 重啟後 `BAT_WORKSPACE_ID=''`
- Terminal Server 重接後再重啟：同樣是空值
- Terminal Server heartbeat 復原：重建時不帶 env（未修）
- 同一程序內有多個視窗時：本機 `created-externally` 會送到所有視窗，沒有該工作區的視窗會把分頁加進自己的 active 工作區
- agent CLI 自己還原舊 env（例如 Codex 的 `shell_snapshot` 或 resume 別的分頁開的 thread）：BAT 外部因素

**修正（T0523）**：
- 本機：落點與 `default` agent 改以「`--notify-id` 塔台終端在 window registry 中所屬的工作區」為準（`electron/dispatch-workspace.ts`）。`--workspace` 退為 fallback，不一致時記 `[T0523] dispatch workspace mismatch`
- 遠端：client renderer 的 `addExternalTerminal` 在這個視窗有該塔台終端時，用塔台的工作區（headless 權杖範圍沒動）
- `pty:restart` 保留 `workspaceId`
- 多視窗：registry 認得該工作區時，payload 標 `workspaceResolved`，沒有它的視窗略過
- `bat-terminal.mjs` 成功時印出實際落點工作區與 agent（含來源），並寫進 `bat-scripts.log`

**Gary 情境（推論，日誌未到）**：helper exit 0 代表 `--workspace` 不是空值；BAT 自己的路徑不會把「非空但屬於別的工作區」的 id 注入 SCB 分頁。最吻合的是 agent CLI 還原了舊 env：Codex 狀態列的 thread 名稱是「套用2025_土銀客服中心建置案規則」，若此 thread 是從土銀分頁 resume 來的，`BAT_TERMINAL_ID` / `BAT_WORKSPACE_ID` 會**都**指向土銀。🔴 若屬實，T0523 的「塔台終端優先」也會落在土銀（因為 `--notify-id` 同樣錯），只能讓塔台從 helper 輸出看到錯誤。判定方式見 T0523 回報區第 3 節，根治方案（不依賴 env 辨識呼叫者 PTY）見第 7 節。

**agent**：`default` = 落點工作區的 `defaultAgent` → `settings.defaultAgent` → `claude-code`（語意未改）。如果 SCB 工作區與全域都沒設 codex，修正後依然會開 Claude。「沿用塔台自己的 agent」這個 UX 建議留給塔台決策。
