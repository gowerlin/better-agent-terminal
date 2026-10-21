---
schema_version: 1
schema_kind: bug
id: BUG-129
title: "塔台派工落到錯的工作區：外部測試者A 在 專案D 工作區的 Codex 塔台用 bat-terminal.mjs --workspace \"$BAT_WORKSPACE_ID\" --agent default 派 T0001，Worker 分頁出現在另一個工作區（專案B），而且用 Claude Code 開（預期 Codex）"
status: FIXED
severity: medium
reproducibility: conditional
created_at: "2026-10-14T13:31:24+0800"
updated_at: "2026-10-14T17:04:00+0800"
fixed_at: "2026-10-14T13:48:23+0800"
impact:
  - control-tower
  - bat-terminal-helper
  - workspace-routing
links:
  discovered_in: "外部測試者A 回報（mac，LINE 2026-10-14 13:21-13:25；內嵌 Claude Code v2.1.296 ⇒ BAT ≥ pre.5）"
  fix_workorder: T0523
  related: ["T0176（BAT_WORKSPACE_ID 注入）", "T0137 / BUG-031（未帶 --workspace → 落在 active workspace，設計行為）", "T0361（external terminal 實際落點日誌）"]
---

# BUG-129 — 塔台派工落到錯的工作區，agent 也解析錯

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟡 medium（Worker 在錯的工作區 / 錯的 agent 執行；cwd 正確所以改的是對的專案，但使用者看不到、Tower 通知可能送錯地方） |
| 可重現 | 條件式：塔台所在的 agent CLI（Codex）沿用了別的分頁的 `BAT_*` 環境時必然重現（T0526 依 外部測試者A 日誌判定） |
| **狀態** | ✅ FIXED（T0523；外部測試者A 情境待日誌 / 實機確認，見下方殘留風險） |
| 回報者 | 外部測試者A（mac） |

## 現象（外部測試者A 原話與截圖）

> 我在 專案D 工作區裡新增一張工單，CT 把 worker session 新增到專案B 工作區去，而且用 claude code 開 XDDDD
> Session 誤開的部份他自己修正了 XDD

截圖（皆在 `D:\Downloads\`）：
- `messageImage_1791955327079_0.jpg`：專案D 工作區（只有 1 個「Codex CLI」分頁）。Codex 塔台執行 `node /Applications/BetterAgentTerminal.app/Contents/Resources/scripts/bat-terminal.mjs --notify-id "$BAT_TERMINAL_ID" --workspace "$BAT_WORKSP…` → `✓ Terminal created: bbe2011f0a4c657884595b351f2a38ab`。塔台自述「剛才派工用了 `--agent default`，BAT 將它解析成 Claude Code」。Codex 狀態列：cwd `~/Library/Mobile Documents/com~apple~CloudDocs/Documents/3Probe Project/<專案D>`，另有一段「**套用專案B 規則**」（Codex 端的顯示，來源待查）
- `messageImage_1791955358535_0.jpg`：**專案B**工作區。底部縮圖有 4 個分頁（Codex CLI、Remote: codex ×2、新的一個），新分頁是 `Remote: '/Applications/BetterAgentTerminal.app/Contents/Resources/app.asar.unpacked/node_modules/@anthropic-ai/claude-code-darwin-arm64/claude'`，跑的是 Claude Code v2.1.296 `/ct-exec T0001`，**cwd 卻是 專案D 資料**
- `messageImage_1791955533975.jpg`：外部測試者A 的 Codex 塔台事後在**它專案的** `_ct-workorders/_local-rules.md` 自行加規則：「Worker 預設使用 Codex CLI…派工明確傳 `--agent codex`」、「派工前核對 BAT 工作區名稱、專案路徑及 Tower 終端。若繼承的 `BAT_WORKSPACE_ID` / `BAT_TERMINAL_ID` 指向其他專案，先以 BAT 當前工作區資料核對」⇒ 塔台推定**它所在 PTY 的 `BAT_WORKSPACE_ID` 指向專案B 工作區**

## 預期

- 塔台在 專案D 工作區的終端派工，Worker 分頁應出現在 專案D 工作區
- `--agent default` 應解析成「塔台所在工作區」的預設 agent（專案D 的 workspace default → settings.defaultAgent）

## 塔台初步分析（Worker 須複核）

- `--agent default` 的解析：`electron/terminal-command-handlers.ts:420-426`：`resolveWorkspaceDefaultAgent(opts.workspaceId)` → `settings.defaultAgent` → `'claude-code'`。所以**兩個症狀可能是同一個根因**：塔台送出的 `workspaceId` 是專案B 的 id（或是無效 id）⇒ 分頁落到專案B，agent 也照專案B 的 workspace default（或全域預設 claude-code）解析
- `BAT_WORKSPACE_ID` 在 PTY 建立時注入（`electron/pty-manager.ts:688/756/838`，T0176），之後**不會變**。可能讓它跟分頁目前所屬工作區不一致的情境（待查）：分頁在工作區之間移動 / 拖曳、啟動時還原分頁、Terminal Server 重新接回既有 PTY、`pty:restart`、工作區複製、detach / reattach
- 也可能是 `--workspace` 帶的 id 在 renderer 找不到 → `addExternalTerminal` 退回 active workspace（`src/App.tsx:472-475` T0361 日誌會印 `workspaceId(landed)` / `workspaceId(requested)`）
- 外部測試者A 的日誌（`~/Library/Application Support/BetterAgentTerminal/Logs/debug-*.log`）由 Gower 索取中，可用 `[T0130] External terminal added` 與 `[agent-command] resolved agent=` 兩行直接判定

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

**外部測試者A 情境（推論，日誌未到）**：helper exit 0 代表 `--workspace` 不是空值；BAT 自己的路徑不會把「非空但屬於別的工作區」的 id 注入 專案D 分頁。最吻合的是 agent CLI 還原了舊 env：Codex 狀態列的 thread 名稱是「套用專案B 規則」，若此 thread 是從專案B 分頁 resume 來的，`BAT_TERMINAL_ID` / `BAT_WORKSPACE_ID` 會**都**指向專案B。🔴 若屬實，T0523 的「塔台終端優先」也會落在專案B（因為 `--notify-id` 同樣錯），只能讓塔台從 helper 輸出看到錯誤。判定方式見 T0523 回報區第 3 節，根治方案（不依賴 env 辨識呼叫者 PTY）見第 7 節。

**agent**：`default` = 落點工作區的 `defaultAgent` → `settings.defaultAgent` → `claude-code`（語意未改）。如果 專案D 工作區與全域都沒設 codex，修正後依然會開 Claude。「沿用塔台自己的 agent」這個 UX 建議留給塔台決策。

## 外部測試者A 日誌判定（T0526）

依 外部測試者A 補上的 `debug-20261014-113525.log` 與 `bat-scripts.log` 判定。兩份日誌的版本是 pre.5–pre.7（沒有 T0523 的欄位），細節見 T0526 回報區。

**判定：T0523 §1 的 #11**（agent CLI 用的環境不是自己 PTY 的），信心高。

- 事件派工發生在 05:18:17Z（13:18:17 UTC+8）：`--notify-id 77f17a65… --workspace ff79114e…`，env 的 `BAT_TERMINAL_ID` = `77f17a65`。`77f17a65` 是**專案B**的 Codex 塔台分頁，`ff79114e` 是**專案B**工作區。專案D 塔台分頁應該是 `1ba6042a`，專案D 工作區應該是 `faff6af2`
- 落點：`landed = requested = ff79114e`，沒有 `Workspace miss`；只有一個視窗。#2 / #3 / #4 / #5 / #9 / #10 都排除：這是新 userData 的第一次啟動，專案D 分頁是當場新建的，事件前沒有 restart 或復原
- 專案D Codex 後續 05:25、05:26 的呼叫，env 依舊是 `77f17a65` / `ff79114e`；塔台在 argv 自行帶入 `1ba6042a` / `faff6af2` 後，就正確落在 專案D
- 強佐證：07:56Z 因 mac 睡眠觸發 Terminal Server 復原。pre.7 重建 PTY 時不帶 env，此後**沒有任何活著的 PTY** 帶這組 env，但 08:02Z、08:13Z 的 helper 呼叫看到的仍然是 `77f17a65` / `ff79114e`（含 port）⇒ Codex 執行指令時用的是它自己保存的舊環境
- **pre.8（T0523）修不好這個情況**：`--notify-id` 也是錯的，落點一樣會在專案B，只是 helper 會印出實際落點。另一個風險：Worker 的完成通知會送到**專案B 塔台**，在 yolo 加 `--submit` 時會被直接送出

**agent 開成 Claude 是另一個獨立原因**：05:18 時全域 Settings 還沒存過（新 userData 的第一次 `settings:save` 在 05:24:02），工作區層級又沒有設定入口（PLAN-040），所以 `default` 退到內建的 `claude-code`。落點就算正確，也一樣會開 Claude。05:24 外部測試者A 存了 Settings 之後，05:26 的 `default` 解析成 `codex-cli`。這修正了上方「兩個症狀可能是同一根因」的推測。

**後續（建議，交塔台決策）**：
- [B] 先做：比對落點工作區 `folderPath` 與派工 `cwd`，不一致時警告；yolo / `--submit` 時拒派。規模 S，可以擋下這一次的情況
- [A] 之後再做：以 helper 的祖先 PID 鏈對照 PTY pid 辨識呼叫者，這是根治做法，規模 M
- [C] 在 Codex preset 關閉 shell snapshot：等 外部測試者A 確認機制後再評估
- 小缺口：`--agent codex` 不認得（要寫 `codex-cli`），helper 只印 `terminal-not-created`

**殘留缺口**：Codex 內部是哪種機制（shell snapshot 或 resume 舊 thread）還沒確認；`1ba6042a` ∈ `faff6af2` 是推得的。給 外部測試者A 的確認清單見 T0526 回報區「給 外部測試者A 的補充要求」。

`status` 維持 FIXED（結案與否由塔台決定）。

## 塔台處置（D141，2026-10-14 17:04）

- #11 另開 **BUG-132**（修正單 T0527：cwd 一致性檢查，yolo 且 cwd 明確屬於另一個工作區時拒派）
- 本 BUG 維持 FIXED（BAT 端 #4 / #5 / #10 已於 pre.8 修正），待 外部測試者A pre.8 回饋後結案
- agent 開成 Claude：當時全域 Settings 未設、工作區層級無 UI → PLAN-040
