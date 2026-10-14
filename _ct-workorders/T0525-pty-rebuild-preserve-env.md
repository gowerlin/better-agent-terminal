---
schema_version: 1
schema_kind: workorder
id: T0525
title: "本機 PTY 重建 / 重啟保留完整 env：Terminal Server heartbeat 復原 + Electron pty:restart 的 customEnv（BUG-131）"
type: implementation
status: DONE
repo: better-agent-terminal
project: BUG-131
priority: P2
sizing: S
created_at: "2026-10-14T13:48:52+0800"
started_at: "2026-10-14T13:50:10+0800"
updated_at: "2026-10-14T13:55:57+0800"
completed_at: "2026-10-14T13:55:57+0800"
target_version: "0.6.0-pre.8"
related:
  - BUG-131
  - "T0523（`dcdfffe`：PTY instance 記 `workspaceId`、restart 沿用）"
  - "T0448（headless restart 保留 customEnv / 角色）"
  - "T0112 / T0108（Terminal Server recovery / 重接）"
  - "T0481（`localHelperEnv()` / `BAT_USER_DATA`）"
affects_files:
  - electron/pty-manager.ts
  - electron/terminal-server/
  - electron/__tests__/
  - _ct-workorders/T0525-pty-rebuild-preserve-env.md
  - _ct-workorders/BUG-131-pty-rebuild-drops-env.md
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 不碰使用者正在用的 BAT（port 9876、真實 userData、真實 Terminal Server）；測試一律 mock / 隔離。不消耗 Claude token。"
  - "🔴 **禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）；寫檔 LF；不 push；不跑全套 e2e（L141）。`src/styles/settings.css` 的 M 狀態不是你的變更；commit 用 `--only`。T0524 並行中（改 `src/components/TerminalPanel.tsx` / `src/lib/terminal-paste.ts`），不要碰那兩個檔案。"
  - "🔴 改 `electron/**` 驗收 `npm run typecheck:electron` = 0。"
  - "🔴 remote headless 的權杖語意（PLAN-036 K、T0448）不得改變；server token 不得寫進日誌。"
---

# T0525 — 本機 PTY 重建 / 重啟保留完整 env（BUG-131）

## 背景

T0523 調查塔台派工落點時，發現本機 PTY 有兩條重建路徑會掉 env，詳見 **BUG-131**（請先讀），以及 T0523 回報區 §1 #5、§7-2 / §7-3。

## 任務

1. **Electron `pty:restart`**：比照 T0448（headless）在 PTY instance 保留建立時的 `customEnv`，restart 時沿用，讓工作區 / 全域環境變數、Worker 的 `BAT_TOWER_TERMINAL_ID` / `CT_MODE` / `CT_INTERACTIVE` 都留下來。helper env（`BAT_REMOTE_TOKEN` / port / `BAT_USER_DATA` 等）用**當下**的值重新產生，不要沿用舊值。T0448 為何當初只做 headless：讀 T0448 回報區，確認 Electron 端沒有刻意不保留的理由；有的話寫進回報區並停在 PARTIAL
2. **Terminal Server heartbeat 復原**（T0112）：重建每個 PTY 時重送完整 env（與第一次 `pty:create` 相同的組法：`envWithUtf8`、`DISABLE_AUTOUPDATER`、`claudeCliUpdateGuardEnv()`（claude-cli preset）、`localHelperEnv()`、`BAT_*`、`customEnv`、`workspaceId`）。若現有架構重建時拿不到這些資訊，就在 instance 上記錄足夠的資料
3. 盡量讓「第一次建立」「restart」「recovery」共用同一個 env 組裝函式，避免三處再次分歧
4. T0108 的 Terminal Server 重接（PTY 活著、不重建）不在本單範圍，只要確認不受影響

## 驗證

- 單元測試：restart 後 env 含原 `customEnv` + 當下的 helper env + `BAT_WORKSPACE_ID`；recovery 重建時送出的 `pty:create` 帶完整 env（mock Terminal Server）；token 改變後 restart / recovery 用新 token
- 既有 `pty-manager-helper-env.test.ts`、T0448 相關 headless 測試全綠
- `npm run typecheck:electron` = 0、`npx vite build` exit 0、`npm run test:unit` 全套無回歸

## 驗收條件

- [x] restart / recovery 後的 PTY env 與第一次建立時一致（helper 值為當下有效值）
- [x] 遠端權杖語意不變
- [x] BUG-131：`status: FIXED`、`fixed_at`、body 狀態列與「根因與修正」段同步

## Sub-session 執行指示

1. 讀本工單、BUG-131、T0523 回報區 §1 / §7、T0448 回報區
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 實作 → 驗證 → 填回報區（DONE / PARTIAL / BLOCKED）
4. commit 本單檔案（`--only`）；不 push；依派發 mode 通知塔台

---

## 回報區

### 結果摘要

**DONE**，驗收條件全部達成。重點如下：
- 新增 `PtyManager.buildPtyEnv()`，第一次建立（Terminal Server / node-pty / child_process 三條分支）、`restart`、Terminal Server recovery 都用它組 env，三處不會再各改各的
- Electron 的 `pty:restart` 現在會沿用 `customEnv`（工作區 / 全域環境變數，以及 Worker 的 `BAT_TOWER_TERMINAL_ID` / `CT_MODE` / `CT_INTERACTIVE`），也沿用 `workspaceId` 與 `agentPreset`
- Terminal Server heartbeat recovery（T0112）重建 PTY 時，送出的 `pty:create` 帶完整 env
- helper 值一律在重建當下取得：`BAT_REMOTE_PORT` / `BAT_REMOTE_TOKEN` 來自 `getRemoteServerInfo()`，`BAT_HELPER_DIR` / `BAT_USER_DATA` 來自 `localHelperEnv()`，headless 則是 `helperEnv`。舊值不會被沿用，測試以「token 改變後重建」鎖住
- 遠端權杖語意不變，T0448 的 3 個 headless 案例全綠

### 1. T0448 為何只做 headless

T0448 回報區與工單的 `memory_overrides` 寫的是「本機 Electron restart 行為不得改變（測試鎖住）」。這是**範圍限制**：T0448 是 PLAN-036 的權杖修正，只處理 headless 角色升級的問題。回報區「遭遇問題」把 Terminal Server 分支未記 `customEnv`、`workspaceId` / `agentPreset` 不保留都列為「已知範圍外」。整份紀錄沒有提到任何「Electron 不該保留 customEnv」的技術理由。因此本單照任務 1 改掉，**不停在 PARTIAL**。T0448 當時鎖住舊行為的測試（`without helperEnv (Electron) restart still rebuilds the env without the old customEnv`）已改成本單的正向測試。

### 2. 修改內容（`electron/pty-manager.ts`）

| 項目 | 修改前 | 修改後 |
|---|---|---|
| env 組裝 | 三條 spawn 分支各自內聯一份（約 35 行 × 3） | `buildPtyEnv(id, { customEnv, workspaceId, agentPreset }, helperEnv, { noFlicker })`。child_process fallback 原本就沒有 `CLAUDE_CODE_NO_FLICKER`，以 `noFlicker: false` 保留這個差異。`ELECTRON_RUN_AS_NODE` 仍只在兩條直接 spawn 分支刪除（與原行為相同） |
| `PtyInstance` | 只有直接 spawn 分支記 `customEnv`；沒有任何分支記 `agentPreset` | 三條分支都記 `customEnv` / `workspaceId` / `agentPreset` |
| T0108 重接後 renderer 的 idempotent `pty:create` | 只補 `workspaceId`（T0523） | 也補 `customEnv` / `agentPreset`，只補缺的欄位。執行中的 PTY 不動、不送任何訊息 |
| `restart()` | `customEnv` 只在有 `deps.helperEnv`（headless）時帶 | 一律帶 `customEnv` / `workspaceId` / `agentPreset`；其餘 env 由 `create` → `buildPtyEnv` 重新產生 |
| recovery（`handleServerDeath`） | `pty:create` 不帶 `env` | 每個 PTY 以 `buildPtyEnv(..., this.helperEnvFor(id, customEnv))` 產生完整 env |

- `electron/terminal-server/` **未改**：`server.ts` 本來就以 `{ ...process.env, ...(req.env ?? {}) }` spawn，main 送完整 env 即可
- **T0108 重接（PTY 存活、不重建）不受影響**：idempotent 分支仍然 `return true` 且不送 `pty:create`，有測試斷言 `server.sent` 中沒有 `pty:create`
- **遠端權杖語意**：`helperEnv` 的呼叫時機不變，仍是「每個實際 spawn 的 PTY 呼叫一次，idempotent 不呼叫」。headless 不使用 Terminal Server，recovery 呼叫 `helperEnvFor` 只是為了與 create 保持一致。restart 仍是 kill（`onPtyExit` 撤銷舊權杖）→ create（簽發新權杖）。沒有新增任何日誌，token 不會進日誌
- 附帶效果：CLAUDE.md「Embedded claude auto-update 停用」節提到的已知缺口「`pty:restart` 重建的分頁不帶 `agentPreset`，同樣不注入」已補上。現在 restart 的 claude-cli 分頁會依當下 runtime mode 注入 `DISABLE_UPDATES`。CLAUDE.md 不在本單 `affects_files`，所以沒改（見第 5 節）

### 3. 測試（`electron/__tests__/pty-manager-helper-env.test.ts`）

新增 describe「rebuilds keep the full env (T0525 / BUG-131)」，共 7 案。每案都用 `fs.mkdtempSync` 建自己的 `dataDir`，因為 recovery 會 `clearRegistry(dataDir)`，不能碰真實 userData 或共用的 tmp。Terminal Server 一律用 FakeServer mock。

1. node-pty（Electron）restart：保留 `customEnv` 與 `BAT_WORKSPACE_ID`，且整份 env `toEqual` 第一次建立的 env
2. node-pty restart 時 port / token 已改變：env 是新的 `9877` / `token-2`，不含 `token-1`；`BAT_HELPER_DIR` / `BAT_USER_DATA` 為當下的值
3. Terminal Server restart：第二個 `pty:create` 帶 `customEnv`、workspace 與新 token，除 token 外與第一次相同
4. T0108 重接：idempotent re-create 不送訊息；之後 restart 送出的 env 與「全新 manager 以相同 options 建立」完全相同（含 `claude-cli` 的 `DISABLE_UPDATES`）
5. recovery：兩個 PTY 的重建 env 都 `toEqual` 各自第一次的 env；`BAT_SESSION` / `BAT_TERMINAL_ID` / `BAT_WORKSPACE_ID` / `BAT_HELPER_DIR` / `BAT_USER_DATA` / `BAT_REMOTE_*` / `DISABLE_AUTOUPDATER` 都在；claude-cli preset 為 `DISABLE_UPDATES=1`，非 claude-cli 則沒有這個變數
6. recovery 時 token 已改變：使用新 port / token，不含舊 token
7. recovery 重建「從 server 清單重新登記（T0108）的 PTY」：使用 renderer 重送的 `customEnv` / workspace

**反向驗證**：先把產品碼備份到 scratchpad，暫時改回「restart 只在 headless 帶 `customEnv`」並移除 recovery 的 `env`，結果 7 failed / 14 passed（新增的 7 案全部失敗）。之後從備份還原，回到 21/21。過程沒有使用 git stash / checkout / restore。

### 4. 驗證

| 閘門 | 結果 | 證據 |
|---|---|---|
| `npx vitest run electron/__tests__/pty-manager-helper-env.test.ts` | PASS | 21/21（含 T0448 headless 3 案、T0481、T0523） |
| `npm run typecheck:electron` | PASS | exit 0（0 errors） |
| `npm run typecheck` | PASS | exit 0 |
| `npx vite build` | PASS | exit 0 |
| `npm run test:unit` | PASS | Test Files 216 passed；Tests 3642 passed / 1 skipped。stderr 有 `@lydell/node-pty/conpty_console_list_agent.js` 的 `AttachConsole failed`，來自使用真 node-pty 的測試在 Windows 上的 conpty agent，屬既有雜訊，不影響結果；本單測試檔 mock node-pty |
| e2e | 未跑 | 依 memory_overrides（L141） |
| 實機 recovery（殺掉 Terminal Server） | 未做 | 依 memory_overrides，不碰使用者正在用的 BAT；以 mock 單元測試涵蓋 |

### 5. 後續建議（交塔台決策）

1. CLAUDE.md「Embedded claude auto-update 停用」節的已知缺口描述需要更新：`pty:restart` 重建的分頁現在會帶 `agentPreset`（remote `terminal:create-agent-command` 的部分維持原狀）。另可在 Logging 或 PTY 相關段落補一句「PTY env 唯一組裝點是 `buildPtyEnv`」
2. recovery 重建時 `shellArgs` 對「T0108 從清單重新登記的 PTY」仍是 `[]`，shell 用預設值（既有行為，本單未動）。這類 PTY 若在 recovery 後重建，PowerShell 會少 `-ExecutionPolicy Bypass -NoLogo`。如有需要可另開單，改成依 shell 重新推導 args

### 6. 偏差 / 備註

- 工作樹中 T0524 的檔案（`TerminalPanel.tsx` / `terminal-paste.ts` / 測試 / e2e / 工單）與 `src/styles/settings.css` 都不屬本單，未觸碰，commit 用 `--only`
- `affects_files` 的 `electron/terminal-server/` 經確認不需修改

### Landing Zone Check

- **PASS**。C-0：`repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal`（`REPO_ROOT` = `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）。C-1：工單在 repo 內。C-3：`electron/pty-manager.ts`、`electron/terminal-server/`、`electron/__tests__/` 都存在。C-2：工單沒有 `branch` 欄位（目前在 `main`）
- `BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）；派發參數 `CT_MODE=yolo` / `CT_INTERACTIVE=0`

### Commit

- `d4ee455` fix(pty): keep the full env on restart and Terminal Server recovery (T0525, BUG-131)（`git commit --only`，4 files；不 push）
- closeout metadata commit 接在其後
