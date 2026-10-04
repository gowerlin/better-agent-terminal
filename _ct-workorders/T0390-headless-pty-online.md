---
schema_version: 1
schema_kind: workorder
id: T0390
title: "PLAN-036 P0-C：`pty:*` + `settings:get-shell-path` 共用註冊並上線 headless（冪等 create、斷線不 kill、env 隔離、shell 驗證）"
type: implementation
status: DONE
priority: P1
sizing: M
created_at: "2026-10-04T23:58:00+08:00"
updated_at: "2026-10-05T00:38:52+08:00"
started_at: "2026-10-05T00:20:34+08:00"
completed_at: "2026-10-05T00:38:52+08:00"
target_version: next
depends_on: [T0388, T0389]
related:
  - "PLAN-036 / D129"
  - "T0386 回報區 §4（PTY 重連語意 / helper env / shell 路徑）、§5（安全限制）、§7（P0 可用定義）、建議工單清單 C"
affects_files:
  - electron/handlers/pty.ts
  - electron/main.ts
  - electron/pty-manager.ts
  - electron/shell-path-resolver.ts
  - electron/remote/headless-entry.ts
  - electron/remote/headless-channel-status.ts
  - electron/remote/__tests__/headless-pty.test.ts
  - electron/remote/__tests__/
interaction:
  mode_hint: on
  interactive: false
  intervention_type: none
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）。"
  - "🔴 不得碰使用者 WSL 內的 `bat-server.service` / `~/.local/bat-server`；WSL 部署交使用者以 T0391 工具執行。"
  - "🔴 headless 遠端 shell env **不得**注入 server token / `BAT_REMOTE_*`；`pty:create` 的 `shell` 參數於 headless 端驗證為絕對路徑且存在。"
  - "🔴 No Regressions：本機終端行為不變（smoke 必做）。不 push。"
---

# T0390 — headless 終端上線

## 範圍（依 T0386 §4 / §5 / §7）

1. `electron/handlers/pty.ts`（新）：`registerPtyHandlers(register, deps)` 註冊 `pty:*`（create / write / resize / kill / restart / get-cwd，以 `PROXIED_CHANNELS` 實際清單為準）+ `settings:get-shell-path`；Electron main 改呼叫它（取代 `main.ts:1964-1976` / `:2172-2183` 內聯註冊），headless 也呼叫它
2. direct 模式 `pty:create` **冪等**：同 id 已存在即回 `true` 不重開；修正舊行程 exit 時 `instances.delete(id)` 誤刪新 entry
3. client 斷線不 kill PTY；斷線期間輸出回放（50 行 ring buffer）是否實作由 Worker 決定並寫理由；孤兒 PTY 回收策略寫進回報區（實作可留 P1）
4. headless env：不注入 helper dir、不注入 server token；`shell` 參數驗證
5. `shell-path-resolver.ts` `auto` 在 Linux 無 `$SHELL` 時的 fallback 與 PtyManager（`/bin/bash`）對齊
6. parity 清單（T0388）移除已上線 channel
7. **T0388 交接**（`694771c`）：
   - 共用 module 掛到 `electron/remote/headless-entry.ts` 的 `HEADLESS_HANDLER_MODULES`；HostDeps 由 `createHeadlessHostDeps(dataDir)` 組（型別見 `electron/handlers/types.ts`）
   - 從 `electron/remote/headless-channel-status.ts` `HEADLESS_UNSUPPORTED` 移除 P0 的 7 個（`pty:*` 6 + `settings:get-shell-path`），parity test 會檢查
   - `ALWAYS_LOCAL_CHANNELS` 目前兩份（`main.ts` 與 `headless-channel-status.ts`，parity test 讀 main.ts 原始碼比對）：本單會改 `main.ts`，順手改為 `main.ts` import `headless-channel-status.ts` 的那份，刪除重複
   - 整合測試用 `electron/remote/__tests__/helpers/headless-harness.ts`（測試檔頭需 `// @vitest-environment node`）
8. **T0389 交接**（`566c6da`）：
   - `new PtyManager({ emit, dataDir, helperDir? })`；headless 用 `createHeadlessHostDeps(dataDir)` 的 `emit` / `dataDir`，不給 `helperDir`
   - ⚠️ `helperDir` 空值只是「不注入」，**不會清除**從 server 行程 env 繼承來的 `BAT_HELPER_DIR`（例如 bat-server 從 BAT 終端內手動啟動）。範圍 4 env 隔離一併處理：headless spawn 的 PTY env 需刪除 `BAT_HELPER_DIR` / `BAT_REMOTE_*` / `BAT_TERMINAL_ID` / `BAT_TOWER_TERMINAL_ID` 等繼承值，並以測試鎖定
   - runtime router 已可 `configureRuntimeRouter({ getDataDir, getEmbeddedLayout })`（headless layout = `server-bundle`）；本單不需接 Agent，但若 `settings:get-shell-path` 需要設定來源，沿用 `createHeadlessHostDeps().getSettings`

## 驗收

- vitest headless 整合（T0388 harness，真 node-pty）：`pty:create → write → 收到 output → resize → kill → exit`；重送同 id `pty:create` 不重 spawn；env 不含 token；非法 shell 被拒
- `npm run test:unit` 全綠；`npx vite build` exit 0；`npx tsc --noEmit` ≤ **40**
- 本機 smoke：本機終端開啟 / 輸入 / resize / 關閉正常
- **P0 實機驗收（交使用者）**：用 T0391 工具部署到 WSL → WSL profile 開出視窗 → 預設終端出現 bash prompt → 輸入 / resize / kill / restart / cwd 正確 → 關閉 BAT 重開後同 id 終端不重複 spawn。回報區寫出完整步驟

## Sub-session 執行指示

1. 讀取本工單 + PLAN-036 + T0386 回報區 + T0388 / T0389 回報區
2. 填 `started_at`、`status: IN_PROGRESS`（**`date "+%Y-%m-%dT%H:%M:%S%z"` 取系統時間**，R-G001）
3. 實作 → 驗收
4. 填回報區；完成寫 **`DONE`**
5. commit 僅實際改動檔 + 新測試檔 + 本工單檔（`git commit --only ...`）
6. 依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 執行摘要

- **開始**：2026-10-05T00:20:34+08:00（Worker，`CT_MODE=on`、`CT_INTERACTIVE=0`）
- **落點檢查**：WARN —— C-0 無法判定（frontmatter **無 `repo` 欄位**；`basename(REPO_ROOT)` = `better-agent-terminal`）；C-1 PASS（工單在 REPO_ROOT 下）；C-3 PASS（`electron/handlers/pty.ts`、`headless-pty.test.ts` 為本單新建，祖先目錄存在；其餘存在）；C-2 不適用（無 `branch` 欄位，HEAD=`main`）。`BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）
- **結果**：DONE。範圍 1-8 全部落地；自動化閘門（vitest 整合 / unit 全套 / vite build / tsc / 本機 smoke / bundle smoke）皆 PASS。**P0 實機驗收（WSL）交使用者**，步驟見下方「P0 實機驗收步驟」
- **發現既有 bug（非本單引入，未修）**：本機 Terminal Server 模式的 `pty:restart` 會讓終端失聯，HEAD 基準版實測同樣重現，見「偏差 / 風險 / 後續」第 1 點

### 實作內容

1. **`electron/handlers/pty.ts`（新）**：`registerPtyHandlers(register, { getPtyManager, validateShell? })` 註冊 `pty:create` / `write` / `resize` / `kill` / `restart` / `get-cwd`（= `PROXIED_CHANNELS` 的 6 個 `pty:*`）+ `settings:get-shell-path`（沿用原本的 cache + `resolveShellPath`）。另匯出純函式 `shellPathRejection(shell)`。不 import `electron`
2. **Electron main**（`main.ts`）：刪除原本的內聯註冊（`pty:*` 6 個 + `settings:get-shell-path` 與它的 cache），改成呼叫 `registerPtyHandlers(registerHandler, { getPtyManager: () => ptyManager })`，行為不變（Electron 不驗 shell，信任本機 renderer）；移除不再使用的 `resolveShellPath` import
3. **headless 上線**（`headless-entry.ts`）：`registerHeadlessPtyHandlers`（`HandlerModule`）掛到 `HEADLESS_HANDLER_MODULES`。每台 server 一個 `PtyManager({ emit: host.emit, dataDir: host.dataDir, helperDir: host.helperDir /* undefined */, dropInheritedEnv: isHeadlessScrubbedEnvKey })`，`validateShell: true`。`stop()` 會呼叫 module disposer（`manager.dispose()` 結束 PTY）
4. **direct 模式冪等 + 舊行程 exit 誤刪**（`pty-manager.ts`）：
   - `create()` 在 direct 分支開頭：同 id 已存在即 log `SKIP (idempotent, direct)` 並回 `true`（Terminal Server 分支原本就有，T0111）
   - node-pty / child_process 的 exit 改走 `handleDirectExit(id, proc, code)`：該 id 已屬於**較新的行程**（restart = kill + 同 id create）時，舊行程的遲到 exit **不刪 entry、也不廣播 `pty:exit`**（否則 renderer 會在新終端印 `[Process exited]`）；其餘情況與原本相同（刪 entry + 廣播）
5. **env 隔離**（範圍 4 + T0389 交接）：`PtyManagerDeps.dropInheritedEnv?(key)`，三個 env 區塊的 `...process.env` 改為 `...this.inheritedEnv()`（未設定 = 原本行為）。headless 用 `isHeadlessScrubbedEnvKey` = **丟掉所有繼承的 `BAT_*`**（不分大小寫），涵蓋工單點名的 `BAT_HELPER_DIR` / `BAT_REMOTE_*` / `BAT_TERMINAL_ID` / `BAT_TOWER_TERMINAL_ID`，以及 `BAT_USER_DATA`、`BAT_WORKSPACE_ID` 等其他 session / server 設定值。之後 PtyManager 仍會設定本 PTY 自己的 `BAT_SESSION=1` / `BAT_TERMINAL_ID=<id>` / `BAT_WORKSPACE_ID`；headless 不設 `getRemoteServerInfo`（⇒ 不注入 `BAT_REMOTE_PORT/TOKEN`），也沒有 `helperDir`（⇒ 不注入 `BAT_HELPER_DIR`）
6. **shell 驗證**（範圍 4）：headless 的 `pty:create` 的 `options.shell` 與 `pty:restart` 的 `shellPath`，非空時必須是字串、`path.isAbsolute`、`statSync().isFile()`；不合格時 log warn 並回 `false`（沿用 `create()` 既有的失敗契約）。`pty:restart` **在 kill 之前**驗證，所以不合格的 shell 不會把執行中的終端殺掉。空值 / undefined 照舊走 host 預設 shell
7. **`shell-path-resolver.ts` 對齊**（範圍 5）：`auto`（以及 linux 上的 `pwsh` / `powershell` / `cmd` fallback）在沒有 `$SHELL` 時：darwin → `/bin/zsh`（不變）；**linux → `/bin/bash`，沒有 bash 時用 `/bin/sh`**（原本是 `/bin/zsh`），與 `PtyManager.getDefaultShell` 一致
8. **parity / 單一來源**（範圍 6、7）：`HEADLESS_UNSUPPORTED` 刪除 P0 的 7 行（剩 **89**：P0 0 / P1 43 / P2 30 / P3 16）。`ALWAYS_LOCAL_CHANNELS` 改由 `main.ts` import `remote/headless-channel-status.ts`，刪除 main.ts 的那份；parity test 原本「讀 main.ts 原始碼比對兩份」改成「main.ts 不得再定義自己的那份，且必須從 headless-channel-status import」，並新增「headless shared module 只註冊 `PROXIED_CHANNELS` 內的 channel」
9. **handler 契約**（`electron/handlers/types.ts`）：`HandlerModule` 可回傳 `HandlerModuleDisposer`（headless `stop()` 會呼叫），供擁有行程的 module 釋放資源

### 斷線 / 回放 / 孤兒 PTY（範圍 3）

- **client 斷線不 kill PTY**：`RemoteServer` 的 `ws.on('close')` 只移除 client（`remote-server.ts:387-393`），PtyManager 不知道有沒有 client 連線；PTY 只會因 `pty:kill`、shell 自行結束或 server `stop()` 而結束。整合測試「關閉 client → 新 client 重送 `pty:create` → shell 變數還在」鎖定這點
- **斷線期間輸出回放：本單不實作**。理由：
  1. headless 的 `emit` 只能廣播（`broadcastHub` → 所有已連線 client），`invokeHandler` 不帶連線 id（`remote-server.ts:371-377`）。若在冪等 `pty:create` 時回放 ring buffer，同樣的 50 行會推給**所有** client，包括畫面上已經有這些內容的 client（renderer reload 以外，同一 client 重送 create 也會重複）
  2. ring buffer 是以 `\n` 切開的原始輸出（`appendToRingBuffer`），在任意位置截斷可能切到 VT escape 序列中間
  3. P0 驗收只要求「不重複 spawn」；目前代價是重開 BAT 後畫面是空的，按 Enter 就會出現 prompt
  - **建議（P1）**：新增「拉取式」channel（例如 `pty:get-buffer(id)`，比照 Terminal Server 的 `pty:getBuffer`），renderer 對還原的終端在 create 回 `true` 之後主動拉取，結果只回給呼叫者，不廣播
- **孤兒 PTY 回收策略（建議，實作留 P1）**：
  1. **閒置回收**：headless 追蹤「已驗證 client 數為 0」的時間點；連續 N 小時（建議預設 24h，可由 `<dataDir>/settings.json` 調整）沒有 client 時，`dispose()` 全部 PTY。需要 `RemoteServer` 對外提供 client 數 / 連線事件（目前沒有）
  2. **client 對帳**：client 載入 workspace 後送出它擁有的終端 id 清單，server 回報不在清單內的 id，由使用者決定是否結束（多視窗 / 多 client 共用同一台 server 時，不可自動 kill）
  3. **上限**：每台 server 的 PTY 數上限（例如 64），超過時 `pty:create` 回 `false` 並 log，避免失控的 client 耗盡資源
  - systemd 的 `bat-server.service` 停止時，cgroup 內的 PTY 會一起結束；另外 `stop()` 也已經 dispose

### 驗收證據

| 證據道 | 結果 | 內容 |
|---|---|---|
| vitest headless 整合（真 node-pty，T0388 harness） | PASS | `electron/remote/__tests__/headless-pty.test.ts` 的 wire-level 案例：① `settings:get-shell-path` 有回應；② `create → write → output → resize → get-cwd → kill → pty:exit`；③ 同 id 重送 `pty:create`（同一 client，以及**關閉 client 後另一個新 client**）都回 `true`，shell 變數 `T0390_STATE=alive` 仍在 ⇒ 沒有重新 spawn，斷線也沒有 kill；④ restart 後舊行程的 exit 被忽略（log `stale exit ignored`）、`get-cwd` 仍有值、沒有 `pty:exit`、新 shell 可輸入；⑤ env dump：有 `BAT_TERMINAL_ID=<id>` / `BAT_SESSION=1`，**沒有** harness token、`BAT_REMOTE_*`、`BAT_HELPER_DIR=`、`BAT_TOWER_TERMINAL_ID=`，也沒有任何預先塞進 `process.env` 的繼承值；⑥ 非法 shell（相對路徑、不存在、目錄、非字串）`pty:create` 回 `false`，`pty:restart` 帶非法 shell 回 `false` 且原終端仍存活。另有純單元：`shellPathRejection`、`isHeadlessScrubbedEnvKey`、resolver linux/darwin fallback（全檔 11 tests） |
| 負向驗證 | 紅燈正確 | 暫時關掉 direct 冪等與 stale-exit 防護、拿掉 `dropInheritedEnv` → 3 個案例失敗（冪等 / restart / env）；已用 scratchpad 備份覆回並 grep 確認還原 |
| parity test | PASS | `headless-parity.test.ts` 9/9（含新增 2 案例）。`HEADLESS_UNSUPPORTED` 89 |
| `npm run test:unit` | PASS | **74 files / 1051 tests 全綠**（T0389 回報為 73 / 1039）。T0388 的 `headless-server.test.ts`「未註冊 channel」案例原本用 `pty:create` 當例子，本單讓它上線後改成動態取 `HEADLESS_UNSUPPORTED` 的第一個 channel |
| `npx vite build` | PASS | exit 0 |
| `npx tsc --noEmit` | PASS | **40**（≤ 40），本單觸及檔案 0 錯 |
| electron-free guard | PASS | `headless-electron-free.test.ts` 在全套內通過（bundle 圖現在包含 `handlers/pty.ts` + `pty-manager.ts`） |
| bundle smoke（plain node） | PASS | `node scripts/dev-deploy-headless.mjs --target dir:<scratch> --expect-string registerHeadlessPtyHandlers`（dry-run，只 build 到 `dist-server/dev-deploy-headless/`，FOUND server-entry.js×2）→ plain node `require` 產出的 `server-entry.js`（`electron` 不可 resolve）→ wss：`settings:get-shell-path` / `pty:create` true / 重送 true（log `SKIP (idempotent, direct)`）/ `cmd.exe` 被拒（`shell must be an absolute path`）/ 輸出 marker / resize / get-cwd / kill / `pty:exit` 全部正常 |
| 本機 smoke | PASS（範圍內） | Playwright `_electron` 啟動 build 後 app（獨立 `--runtime=t0390-smoke-*`，剝除 `BAT_*` env），經 preload `window.electronAPI`（與 UI 同一 IPC 路徑，走 `bindProxiedHandlersToIpc` + 新的 `ALWAYS_LOCAL_CHANNELS` import）：`settings.getShellPath('auto')` = pwsh 7 路徑；本機終端（Terminal Server 模式）`create` true、重送 true（log 只有一次 `server spawned`）、`write` → 輸出 marker、`resize`、`getCwd` = `C:\`、`kill` → 收到 `pty:exit`、kill 後 `getCwd` = null |
| 本機 smoke：restart | ⚠️ 既有問題 | 本機 Terminal Server 模式 `pty.restart` 之後 `getCwd` = null、後續輸入無輸出。**用 `git worktree` 建 HEAD `090ca2a`（未含本單）跑同一支 smoke，結果完全相同** ⇒ 非本單引入，見下方第 1 點 |
| P0 實機驗收（WSL） | 交使用者 | 見下節 |

smoke 收尾：worktree 已移除（先拆 `node_modules` junction，主 repo `node_modules` 確認完好）、3 個 smoke runtime userData 目錄已刪、smoke runtime 留下的 Terminal Server（BAT quit 選擇保留 server 的既有設計）已以 `taskkill /T` 結束（只針對 repo / worktree 的 `dist-electron\terminal-server.js`，沒動安裝版 BAT）。

### P0 實機驗收步驟（交使用者，WSL Ubuntu-24.04）

> 前提：本單 commit 已在本機 working tree。部署工具為 T0391 的 `scripts/dev-deploy-headless.mjs`（會覆寫 `~/.local/bat-server/electron/remote/*.js`，覆寫前自動備份 `.bak-dev`）。

1. 預覽：`npm run deploy:headless:dev -- --target wsl:Ubuntu-24.04 --expect-string registerHeadlessPtyHandlers`（dry-run，確認 4 個 JS 與 FOUND）
2. 部署：同一指令加 `--yes`（備份 + 覆寫 + `systemctl --user restart bat-server`）；確認：`wsl -d Ubuntu-24.04 -- systemctl --user is-active bat-server` = `active`
3. 開 BAT → 開 WSL profile 視窗 → **預設終端出現 bash prompt**（systemd service 的 `SHELL=/bin/bash`，login shell 會載入 `~/.profile`）
4. 輸入：`echo hello`、`pwd`（應為 workspace 資料夾經 PathTranslator 轉換後的 Linux 路徑）
5. resize：拖動視窗或分割窗格後，執行 `stty size`，數字應該跟著改變
6. env：`env | grep '^BAT_'` 應只有 `BAT_SESSION=1`、`BAT_TERMINAL_ID=<id>`、`BAT_WORKSPACE_ID=...`；**不應**出現 `BAT_REMOTE_*` / `BAT_HELPER_DIR`
7. restart：用終端的 restart 功能 → 出現新的 prompt，畫面**不應**出現 `[Process exited ...]`（遠端是 direct 模式，本單已修；本機 Terminal Server 模式的同類問題見下方第 1 點）
8. kill：關閉該終端分頁 → 另開 WSL shell 執行 `pgrep -af 'bash -l -i'`，確認對應的 bash 已消失
9. **重開不重複 spawn**：在終端執行 `export T0390=alive`，記下 `pgrep -c -f 'bash -l -i'` 的數量 → 關閉 BAT → 重開並開同一個 WSL profile → 在同一個終端按 Enter（本單不回放輸出，畫面一開始是空的）→ `echo $T0390` 應印出 `alive`，`pgrep -c` 的數量不變
10. 回滾（需要時）：`npm run deploy:headless:dev -- --target wsl:Ubuntu-24.04 --rollback --yes`

### 偏差 / 風險 / 後續

1. **既有 bug（建議另開 BUG，不在本單範圍）**：本機 **Terminal Server 模式**的 `pty:restart` 會讓終端失聯。機制：`restart()` = kill + 同 id create；Terminal Server 端舊 PTY 的 `onExit`（`electron/terminal-server/server.ts:219-224`）無條件 `this.ptys.delete(req.id)` 並廣播 `pty:exit` ⇒ 刪掉 server 上新 PTY 的 entry；main 端 `PtyManager.handlePtyExit` 也再刪掉新 instance ⇒ 之後 write 回 `pty-not-found`，renderer 印 `[Process exited]`。這和範圍 2 修的 direct 模式 bug 同一類，但需要改 `terminal-server/server.ts`（比照 `handleDirectExit` 的「entry 是否已被新行程取代」判斷），而且 Terminal Server 會跨 BAT 重啟存活（舊版 server 行程要重啟後才會換新）。已用 HEAD 基準版實測確認為既有問題。影響範圍：本機一般終端的「重新啟動」按鈕（`WorkspaceView.tsx` `pty.restart`）；claude-cli preset 走 kill + `startClaudeCliPty`，不受影響
2. **`electron/handlers/types.ts` 不在 `affects_files`**：為了讓 headless `stop()` 能結束本單建立的 PtyManager，`HandlerModule` 的回傳型別從 `void` 擴充為 `void | HandlerModuleDisposer`（向下相容，既有 module 不需修改）
3. **`electron/remote/__tests__/headless-server.test.ts`**（T0388 檔案，位於 `affects_files` 的 `__tests__/` 目錄內）：「未註冊 channel」案例原本用 `pty:create` 當例子，本單上線後該呼叫會真的 spawn，所以改成動態取 `HEADLESS_UNSUPPORTED` 的第一個
4. **Electron direct 模式語意變化**（No Regressions 評估）：本機通常走 Terminal Server，direct 只是 fallback。direct 模式下 renderer reload 重送 create，原本會再 spawn 一個 shell（舊的變成孤兒且同 id 輸出交錯），現在保留原 shell；restart 原本會刪掉新 entry 並印出假的 exit，現在正常。兩者都只是修正錯誤行為
5. **renderer 既有行為（記錄，沒改）**：`WorkspaceView` 還原終端時，對 terminal-driven agent preset 會在 `pty.create` 後自動寫入 agent 啟動指令。create 冪等後，重開 BAT 會把這個指令再打進仍在執行 agent 的 shell（Terminal Server 模式自 T0111 起就是這樣）。遠端 P0 驗收只用一般終端，不受影響；建議在 P1 / 回放工單一併讓 create 回傳「是否為新 spawn」
6. **`BAT_SESSION=1` 保留**：遠端 shell 仍標示為 BAT 終端，但沒有 `BAT_HELPER_DIR`。Control Tower 的 auto-session 路由（`_local-rules.md`，`BAT_SESSION=1` → `node "$BAT_HELPER_DIR/bat-terminal.mjs"`）在遠端會因找不到 helper 而失敗，再走 fallback。遠端 Tower 通知屬 P3（T0386 建議 K），屆時再決定是否保留
7. **`settings:get-shell-path` 在 headless 讀 server 行程的 `process.env.SHELL`**：systemd user service 有 `SHELL=/bin/bash`（T0386 §4 實測）；docker / 沒有 `$SHELL` 的環境走本單對齊後的 bash → sh fallback
8. Windows 跑 node-pty kill 時，stderr 會出現 `AttachConsole failed`（node-pty `conpty_console_list_agent.js`，子行程雜訊），不影響測試結果
9. `dist-server/dev-deploy-headless/`（gitignored，T0391 工具的 build 輸出）被本單 bundle smoke 重新產生，未清除（下次部署會覆蓋）

### 變更檔案

- 新增：`electron/handlers/pty.ts`、`electron/remote/__tests__/headless-pty.test.ts`
- 修改：`electron/main.ts`、`electron/pty-manager.ts`、`electron/shell-path-resolver.ts`、`electron/handlers/types.ts`、`electron/remote/headless-entry.ts`、`electron/remote/headless-channel-status.ts`、`electron/remote/__tests__/headless-parity.test.ts`、`electron/remote/__tests__/headless-server.test.ts`、本工單
- 沒動：`electron/terminal-server/server.ts`（既有 bug 只記錄）、`electron/remote/protocol.ts`；沒用 stash / reset / checkout / restore；沒碰 WSL `bat-server.service` / `~/.local/bat-server`；沒 push

### Commit

- 單一 commit，`git commit --only` 只含上列檔案；沒 push。hash 見 `git log`（回報區在 commit 前寫入，不自我引用）
