---
schema_version: 1
schema_kind: workorder
id: T0420
title: "研究：遠端 Tower 通知（PLAN-036 P3 / K）—— 遠端 shell 內的 ct 塔台 / Worker 如何派發與回報；helper 與 token 注入的安全設計；拆單"
type: research
status: DONE
repo: better-agent-terminal
project: PLAN-036
priority: P2
sizing: M
created_at: "2026-10-05T05:35:22+08:00"
started_at: "2026-10-05T05:39:22+08:00"
updated_at: "2026-10-05T05:47:58+08:00"
completed_at: "2026-10-05T05:47:58+08:00"
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

**DONE**（研究單；未改產品程式碼）。使用者已裁決方案 **A'（每 PTY 範圍權杖）**。

- **落點檢查**：PASS —— C-0 `repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal`；C-1 PASS；C-3 只有本工單（排除後無可測項目 → 不適用）；C-2 不適用（無 `branch` 欄位，HEAD=`main`）。`BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）
- 派發環境：`CT_MODE=yolo`、`CT_INTERACTIVE=1`
- 證據分道：source 盤點 ✅；WSL 唯讀實測 ✅（部分：當下無存活的遠端 PTY，env 改由程式碼推導，見 §1.1）；build / test / runtime：研究單不適用

### 互動紀錄

| # | 時間 | 問題 | 使用者回答 |
|---|---|---|---|
| Q1 | 2026-10-05 約 05:45 | K 採哪個方案：A' 每 PTY 範圍權杖（推薦）／A 注入全權 server token／D Unix socket + 範圍權杖／C 不做 | **A' 每 PTY 範圍權杖** |

### 調查結論

#### 1. 現況盤點

**1.1 遠端 PTY 實際注入的 `BAT_*`**（程式碼推導；WSL 實測時 `bat-server.service` MainPID 306 底下沒有存活的 PTY 子行程，讀不到 `/proc/<pid>/environ`）

| 變數 | 本機 BAT PTY | 遠端（headless）PTY | 證據 |
|---|---|---|---|
| `BAT_SESSION` | `1` | `1` | `electron/pty-manager.ts:612`（另兩條路徑 :674、:754） |
| `BAT_TERMINAL_ID` | PTY id | PTY id | `pty-manager.ts:618` |
| `BAT_WORKSPACE_ID` | renderer 傳的 workspaceId | **client 端的** workspaceId（遠端視窗的 renderer 送 `pty:create` 時帶的） | `pty-manager.ts:620` |
| `BAT_HELPER_DIR` | dev `<repo>/scripts`、安裝版 `resources/scripts` | **無**（headless 沒有 `helperDir`） | `pty-manager.ts:199-202`；`main.ts:804-806`；`headless-entry.ts:195` |
| `BAT_REMOTE_PORT` / `BAT_REMOTE_TOKEN` | 本機 RemoteServer port + **全權 token** | **無**（headless 沒有接 `getRemoteServerInfo`） | `pty-manager.ts:182`、`:627`；`main.ts:1553-1558`；`headless-entry.ts:56` 註解 |
| 繼承來的 `BAT_*`（例如 bat-server 從 BAT 終端手動啟動時） | 原樣繼承 | 全部丟掉（`isHeadlessScrubbedEnvKey` = 任何 `BAT_` 前綴） | `headless-entry.ts:58-60`、`:196`；`pty-manager.ts:61-66` |

⇒ 與 PLAN-036「P1 候選」一致：遠端 `BAT_SESSION=1`，但沒有 `BAT_HELPER_DIR`、`BAT_REMOTE_*`。ct-exec 的 notify 需要 `BAT_TOWER_TERMINAL_ID` + `BAT_REMOTE_PORT` + `BAT_REMOTE_TOKEN` 三者 ⇒ 正確降級為手動訊息。塔台 auto-session 依 `_local-rules.md`「路由決策樹」看到 `BAT_SESSION=1` 會先嘗試 `node "$BAT_HELPER_DIR/bat-terminal.mjs"`（路徑展開成 `/bat-terminal.mjs`）→ 失敗後才降級，這是一次多餘的失敗。

**WSL 唯讀實測（2026-10-05 約 05:42）**：`bat-server.service` active，`127.0.0.1:9877` LISTEN（pid 306）；`~/.local/share/bat-server/` 內有 `server-cert.json`、`server-token.json`（`600 gower`，91 bytes，開頭為 `{ "v": 1,` 的 secret record）、`lockfile.pid`；`~/.config/BetterAgentTerminal/` 不存在；`~/.local/bat-server/` 內無 `scripts/`（helper 確實不在 bundle）。token 內容未讀出、未記錄。

**1.2 `terminal:*` 在 headless 的分類**（T0416 / T0388 已分類）

- `electron/remote/headless-channel-status.ts:70-73`：`terminal:create-with-command` / `create-agent-command` / `notify` = `P3`（未上線）；`terminal:keypress` = `P3`，註解為「renderer-DOM only → remote-unsupported」
- `electron/remote/path-aware-channels.ts:74-75`：兩個 create 的 `cwd` 已標為 path-aware（`object-fields`）；`:160-161` notify / keypress 不含路徑
- `electron/remote/protocol.ts:94-107` `PROXIED_EVENTS`：有 `terminal:notified`；**沒有** `terminal:created-externally`，也**沒有** `terminal:keypress`（事件）
- Electron 端三個 handler 只走 `BrowserWindow.getAllWindows()` / `webContents.send`，不經 `broadcastHub`：`terminal-command-handlers.ts:176-187`（created-externally）、`main.ts:2054-2063`（notified）、`main.ts:2114-2119`（keypress）
- `terminal-command-handlers.ts` 已 DI（`TerminalCommandHandlerDeps`，:57-74），但 `buildAgentPromptCommand`（`main.ts:615-660`）有本機耦合：`readPersistedSettingsSync` 讀 `app.getPath('userData')`（:525-534）、`resolveWorkspaceDefaultAgent` 讀本機 `windowRegistry`（:586-603）、`ensureElevationApplied`（Windows 專用）。`agent-runtime/agent-registry` 與 `resolve-claude-base-command.ts` 無 `electron` import，可共用

**1.3 helper 的連線方式，以及在遠端 shell 內是否可行**

- `bat-notify.mjs` / `bat-terminal.mjs`：寫死 `wss://127.0.0.1:$BAT_REMOTE_PORT`（`bat-notify.mjs:473`、`bat-terminal.mjs:574`），TLS `rejectUnauthorized: false` 加上指紋釘選（`bat-notify.mjs:283-316`）；auth frame 帶 `BAT_REMOTE_TOKEN`
- 指紋來源 `_bat-cert.mjs`：預設讀 Electron userData 的 `server-cert.json`（Linux = `~/.config/BetterAgentTerminal/server-cert.json`，`_bat-cert.mjs:23-40`），可用 **`BAT_SERVER_CERT_PATH`** 覆寫（`:43-45`）。headless 的 cert 在 `<dataDir>/server-cert.json`（`dataDir.ts` 預設為 `~/.local/share/bat-server`）⇒ 遠端只要注入 `BAT_SERVER_CERT_PATH=<dataDir>/server-cert.json`，**現有 TLS 與指紋釘選就能直接沿用**
- `_bat-logger.mjs:12`：Linux 會寫到 `~/.config/BetterAgentTerminal/logs/bat-scripts.log`（遠端會多建一個目錄；工單 3 應確認或新增 log 目錄覆寫）
- **遠端 helper 應該連遠端 headless，而不是本機 BAT**：①SSH 時本機 BAT 根本連不到（除非另開 reverse tunnel）；②就算連得到（WSL mirrored networking），本機 BAT 的 `terminal:create-with-command` 會用**本機** ptyManager 開出 **Windows** shell（`terminal-command-handlers.ts:163-170`），開錯邊。⇒ 遠端 helper → `127.0.0.1:<headless port>`（WSL 實測 9877）是唯一正確的路徑
- RemoteServer 認證後**沒有分角色**：任何通過 `isTokenAccepted`（`remote-server.ts:356-365`，`===` 比對）的連線都能 invoke 所有已註冊的 channel（`:483-495` 附近的 invoke 分派）

#### 2. 安全分析

| 外洩面 | 說明 | A（全權 token 進 env） | A'（每 PTY 範圍權杖） |
|---|---|---|---|
| 同機其他使用者 | `/proc/<pid>/environ` 只有同 uid 或 root 讀得到（ptrace 存取檢查）；Docker 時 container root 讀得到 | 同 uid／root 才看得到 | 同左 |
| 同 uid 程序 | **headless token 本來就在磁碟上**：`server-token.json`（600）。headless 無 Electron safeStorage ⇒ 推測為 plaintext strategy（依 `secrets.ts:139-166` 的格式判斷；實測只確認是 `v:1` record、未解碼內容） | 增量小（本來就讀得到檔案） | 增量更小 |
| 子行程繼承／被印出來 | **這才是主要的增量風險**：agent 執行 `env` / `printenv`，或 debug 輸出把 env 印進 LLM transcript（`~/.claude/projects/*.jsonl`，且會送到 API）、CI log、`docker run -e`、`sudo -E` | 長效全權 token 外洩 ⇒ 拿得到 port 的人就有完整 shell + fs + git + claude | 外洩的是**單一 PTY** 的權杖：只能用少數 channel、目標綁死，PTY 結束即失效 |
| 網路可達性 | headless 綁 `127.0.0.1`（WSL 經 localhost forwarding 到 Windows；SSH 經 tunnel）；Docker `-p` 未綁 host 127.0.0.1 是既有缺口（T0386 §5） | Docker 情境 = LAN 上的 root shell | 只能做受限的操作 |
| 撤銷／輪替 | 已有 `rotateToken`（`remote-server.ts:563-574`，舊 token 有寬限期） | rotate 後，所有既有分頁 env 裡的 token 一起失效 | 權杖只存在記憶體；PTY exit 或 server restart 即失效；與 client token 輪替互不影響 |

**只限 channel 擋不住多少**：`terminal:create-with-command` 會執行任意指令，`pty:write` 可以對任何 PTY 打字 ⇒ 兩者都等於能執行程式碼。範圍權杖因此必須做到兩件事：(1) **channel 白名單**：只允許 `terminal:create-agent-command`、`terminal:notify`、`pty:write`、`terminal:keypress`；**不允許** `create-with-command`、`pty:create`、`fs:*`、`git:*`、`claude:*` 等；(2) **目標綁定**：`pty:write` / `terminal:keypress` / `terminal:notify` 的 target 只能是簽發時記錄的 `BAT_TOWER_TERMINAL_ID`（Worker 權杖），Tower 權杖不能寫任何 PTY。
**殘餘風險**：`create-agent-command` 會帶上 `agentCustomArgs`（例如 `--dangerously-skip-permissions`），持有者仍可用任意 prompt 開一個無人看管的 agent ⇒ 實質上仍可執行程式碼，但持有者本身就是同 uid、跑在該 PTY 裡的程序，沒有越權。

**與 `isHeadlessScrubbedEnvKey` 的關係**：規則不變（繼承來的 `BAT_*` 一律丟掉）。新的 `BAT_REMOTE_PORT` / `BAT_REMOTE_TOKEN`（權杖）/ `BAT_HELPER_DIR` / `BAT_SERVER_CERT_PATH` 跟 `BAT_TERMINAL_ID` 一樣，由 PtyManager 在 scrub **之後**為每個 PTY 產生。注入點必須是 headless 專用的 deps（例如 `deps.helperEnv(id, customEnv)`），**不可**沿用 `getRemoteServerInfo`（那是 Electron 注入全權 token 的路徑）。

**順帶紀錄（不在 K 範圍）**：`remote-server.ts:551` 會把 token 前 8 碼寫進 log；`:358-360` 的 token 比對仍是 `===`（T0386 建議改 `timingSafeEqual`，可併入工單 2）。本機 BAT 自己的 PTY 仍注入全權 token（`pty-manager.ts:627`），A' 機制日後可回移到本機（另案）。

#### 3. 端到端流程（A' 落地後）

1. 遠端 Tower = headless PTY `T`，env：`BAT_TERMINAL_ID=T`、`BAT_WORKSPACE_ID=W`（client workspace）、`BAT_REMOTE_PORT=<headless port>`、`BAT_REMOTE_TOKEN=cap(T)`、`BAT_HELPER_DIR=<installRoot>/scripts`、`BAT_SERVER_CERT_PATH=<dataDir>/server-cert.json`
2. Tower 執行 `node "$BAT_HELPER_DIR/bat-terminal.mjs" claude "/ct-exec T####" --notify "$BAT_TERMINAL_ID" --workspace "$BAT_WORKSPACE_ID"` → `wss://127.0.0.1:<port>`（指紋釘 headless cert）→ 以 `cap(T)` 認證 → `terminal:create-agent-command { id: Wk, cwd: <server path>, customEnv: { BAT_TOWER_TERMINAL_ID: T }, workspaceId: W }`
3. headless 組 agent 指令（headless `settings.json` 的 `agentCustomArgs`；router 解析到 bundle 的 `bin/claude`）→ `PtyManager.create(Wk)`，並簽發 `cap(Wk)`（綁定 tower = `T`）→ 經 broadcastHub 發出 `terminal:created-externally`
4. client 的 `remote-client.ts:426-436` 把 server 路徑轉成 client 形式，送給**綁定該 profile 的視窗** → `App.tsx:468` `addExternalTerminal` 依 `W` 落點 ⇒ **新分頁出現在 Tower 所在的同一個遠端視窗、同一個 workspace**；xterm 以 id 綁定，`pty:output` 原本就由 headless 廣播
5. Worker 完成 → `bat-notify` 以 `cap(Wk)` 連線 → `terminal:notify { targetId: T }` → headless 廣播 `terminal:notified` → client 顯示 toast，Tower 分頁出現 badge（`App.tsx:482-500`，以 terminalId 比對）；`pty:write(T, msg)` 預填到 Tower PTY；`--submit`（yolo）→ headless 廣播 `terminal:keypress` 事件 → renderer 在 `T` 的 xterm 合成 Enter → `pty:write` 經 proxy 回 headless

**邊界情境**（應納入驗收）：
- 沒有 client 連線時：notify 事件沒人收（不排隊），但預填文字仍會寫進 Tower PTY（在 replay buffer 裡）；submit 應回 `{ ok: false, reason: 'no-client' }`，helper 以 exit 1 結束 ⇒ yolo 不會假裝已送出
- 兩台 BAT 連到同一個 headless 時：兩邊都會收到 `created-externally`。目前 `addExternalTerminal` 查不到 workspace 時會 **fallback 到 active workspace**（`workspace-store.ts:340-343`），會在另一台機器開出錯的分頁 ⇒ 遠端來源的事件查不到 workspace 時必須**忽略**，不能 fallback
- 全域只有一個 `remoteClient`（T0386 §1）：非當前綁定的遠端 profile 視窗收不到事件（既有限制）
- helper 連線也算一個已認證 client，會影響 T0404 的 idle reclaim 計數 ⇒ 權杖連線不應計入

### 建議方向

**方案比較**

| 方案 | 內容 | 工時 | 安全風險 | 使用者價值 |
|---|---|---|---|---|
| **A' 每 PTY 範圍權杖（採用）** | headless 在記憶體中為每個 PTY 簽發權杖（不落地、PTY exit 即撤銷），channel 白名單 + 目標綁定；沿用 WSS + 指紋（`BAT_SERVER_CERT_PATH`）；helper 隨 bundle 出貨 | L（4 張，約 M+M+M+M） | 低：外洩只影響單一 PTY 的少數操作 | 高：遠端塔台與本機體驗一致（開分頁、toast、badge、yolo 自動送出） |
| A 注入全權 server token | 直接把 headless token + port 注入遠端 PTY | M（約 2 張） | 中高：長效全權 token 進 env，被 agent 印出就等於完整遠端 shell；rotate 時所有分頁一起斷 | 高 |
| D Unix socket + 範圍權杖 | env 只放 socket 路徑（`$XDG_RUNTIME_DIR`，0700），以檔案權限認證，tunnel 轉不出去 | L+（helper 要新增一套非 WSS transport 並維護兩套） | 最低 | 高 |
| C 不做 | 維持剪貼簿／文字提示 | 0 | 無 | 低：遠端塔台每張單都要手動貼 |

**推薦（使用者已裁決）：A'**。理由：在 A 的使用者價值之上，把外洩影響從「完整 shell」縮到「單一 PTY 的少數操作」；同時沿用既有 WSS、指紋與 helper，不必維護第二套 transport（D 的成本）。

### 拆單建議摘要

| # | 標題 | 專案 | 依賴 | 工時 | 🚦 |
|---|---|---|---|---|---|
| 1 | 工單 1：headless `terminal:*` 上線 + 事件補齊 | PLAN-036 | — | M | 🟢 |
| 2 | 工單 2：RemoteServer 每 PTY 範圍權杖（簽發／撤銷／白名單／目標綁定） | PLAN-036 | 工單 1 | M | 🟡 |
| 3 | 工單 3：helper 隨 server bundle 出貨 + headless PTY env 注入 | PLAN-036 | 工單 2 | M | 🟢 |
| 4 | 工單 4：遠端 Tower 端到端驗收（vitest harness + WSL 實機）+ 文件 | PLAN-036 | 工單 1、2、3 | M | 🟡 |

各單內容：

- **工單 1**：把 `buildAgentPromptCommand` 抽成 electron-free 模組（settings reader / workspace default agent / elevation 改由 deps 注入；headless 用 `<dataDir>/settings.json`，workspace default agent 回 null）；新增 `electron/handlers/terminal.ts`，兩端共用 `terminal:create-*` / `terminal:notify` / `terminal:keypress`，`created-externally` / `notified` / `keypress` 改經 host `emit`（Electron = windows + broadcastHub，headless = broadcastHub）；`PROXIED_EVENTS` 加入 `terminal:created-externally`（`cwd` 列入 `PATH_EVENT_CHANNELS`）與 `terminal:keypress`（path-free）；`headless-channel-status.ts` P3 → 已支援；renderer：遠端來源的 `created-externally` 查不到 workspace 時忽略、不 fallback；headless keypress 在沒有 client 時回 `no-client`。主要檔案：`electron/handlers/terminal.ts`（新）、`electron/terminal-command-handlers.ts`、`electron/main.ts`（:525-660、:2016-2125）、`electron/remote/protocol.ts`、`electron/remote/path-aware-channels.ts`、`electron/remote/headless-entry.ts`、`electron/remote/headless-channel-status.ts`、`src/stores/workspace-store.ts`
- **工單 2**：新增 `HelperCapabilityRegistry`（`randomBytes(32)`、記憶體 map `token → { terminalId, towerId?, role }`、PTY exit 時撤銷）；RemoteServer auth 接受權杖 → 該連線標成 helper 角色，invoke 時檢查 channel 白名單與 target 綁定（Tower 權杖不能 `pty:write`）；helper 連線不計入 idle reclaim 的 client 數；token 比對改 `timingSafeEqual`；負向測試：權杖不能呼叫 `pty:create` / `fs:*` / `claude:*` / `create-with-command`、不能寫非綁定 target、PTY exit 後被拒、server restart 後失效。🟡 原因：安全設計，建議完成後做一次 review。主要檔案：`electron/remote/remote-server.ts`、`electron/remote/helper-capability.ts`（新）、`electron/pty-manager.ts`（exit hook）、`electron/remote/__tests__/`
- **工單 3**：`build-server-bundle.mjs` 把 `bat-terminal.mjs`、`bat-notify.mjs`、`_bat-cert.mjs`、`_bat-logger.mjs` 複製到 `<installRoot>/scripts/`，並擴充 `verify-helper-bundle.js`；`createHeadlessPtyModule` 傳入 `helperDir` 與 headless 專用的 `helperEnv(id, customEnv)`（`BAT_REMOTE_PORT`、`BAT_REMOTE_TOKEN=cap`、`BAT_SERVER_CERT_PATH`、`BAT_HELPER_DIR`、log 目錄覆寫）；`isHeadlessScrubbedEnvKey` 不變；新增 unit test，確認 env 裡沒有 server token。主要檔案：`scripts/build-server-bundle.mjs`、`scripts/verify-helper-bundle.js`、`scripts/_bat-logger.mjs`、`electron/remote/headless-entry.ts`、`electron/pty-manager.ts`
- **工單 4**：vitest headless harness 跑真 node helper 子行程：Tower PTY → `bat-terminal` → `created-externally` → `bat-notify` → `notified` + `keypress` 事件；WSL 以 `deploy:headless:dev` 部署後，在真 BAT 遠端視窗從遠端 Tower 派一張測試單；更新 `CLAUDE.md` 與 `_local-rules.md`「Auto-Session 路由規則」的遠端分支。🟡 原因：需要使用者在 WSL 實機操作（遠端 `~/.claude/skills` 也必須裝有 control-tower 系列 skill）

### 遭遇問題

- WSL 實測時沒有存活的遠端 PTY（MainPID 306 無子行程），無法實際讀出遠端 shell 的 env；§1.1 改以程式碼推導。工單 1／3 落地後，可在遠端分頁內執行 `env | grep ^BAT_ | cut -d= -f1` 補驗
- 依工單禁令：未 restart service、未寫入 `~/.local/bat-server`、未部署；token 只記錄「存在、600、91 bytes」
- 範圍外的後續建議（不在上表，避免塔台誤派）：①control-tower / ct-exec skill（非本 repo）：`BAT_SESSION=1` 但缺少 `BAT_HELPER_DIR` 或 `BAT_REMOTE_PORT` 時，直接走降級鏈，不要先嘗試 `node "/bat-terminal.mjs"`；②`remote-server.ts:551` log 會印出 token 前 8 碼；③本機 BAT PTY 也改用範圍權杖（回移 A'）

### 回報時間

2026-10-05T05:46:04+08:00
