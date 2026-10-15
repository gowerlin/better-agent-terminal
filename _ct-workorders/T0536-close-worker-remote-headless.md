---
schema_version: 1
schema_kind: workorder
id: T0536
title: "PLAN-041 B'-2：遠端 headless 支援 `--close-worker`（tower 權杖只能關自己派出的 Worker）"
type: implementation
status: DONE
repo: better-agent-terminal
project: PLAN-041
priority: P2
sizing: S
created_at: "2026-10-15T15:44:39+0800"
started_at: "2026-10-15T16:33:15+0800"
updated_at: "2026-10-15T16:43:45+0800"
completed_at: "2026-10-15T16:43:45+0800"
target_version: "0.6.1-pre.3"
depends_on: [T0535]
related:
  - PLAN-041
  - T0534（研究回報 §1.4、§1.7）
  - T0432 / T0447–T0450（headless 範圍權杖）
  - D144
affects_files:
  - electron/remote/helper-capability.ts
  - electron/remote/remote-server.ts
  - electron/remote/headless-entry.ts
  - electron/remote/protocol.ts
  - electron/terminal-command-handlers.ts
  - src/App.tsx
  - electron/remote/__tests__/
  - CLAUDE.md
  - _ct-workorders/T0536-close-worker-remote-headless.md
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 不碰使用者正在用的 BAT 與已部署的遠端 server；測試用 `headless-remote-tower-e2e.test.ts` 的真 headless + 真 node-pty 模式。不耗 token。"
  - "🔴 **禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）；寫檔 LF；不 push；不跑全套 e2e（L141）。`src/styles/settings.css` 的 M 狀態不是你的變更，不要 commit 它；commit 用 `--only`。"
  - "🔴 改 `electron/**` 驗收 `npm run typecheck:electron` = 0；改 `src/**` 驗收 `npm run typecheck` = 0。"
  - "🔴 權杖範圍**預設拒絕**不變：只新增這一個 channel 給 tower，worker 角色不得取得；server token 仍不得進 PTY env。"
---

# T0536 — 遠端 headless `--close-worker`

## 背景

T0535 完成本機版本後，遠端視窗（WSL / SSH / Docker）的 Tower 呼叫 `--close-worker` 仍會得到 `Forbidden: channel-not-allowed`（tower 權杖只允許 `terminal:create-agent-command`，`helper-capability.ts` `HELPER_CHANNEL_ROLES`）。介面契約與 exit code 同 PLAN-041，遠端不得另訂。

## 任務

1. **權杖**（`electron/remote/helper-capability.ts`）
   - `HELPER_CHANNEL_ROLES` 加 `'terminal:close-worker': ['tower']`。
   - `HelperCapabilityRegistry` 新增 `isWorkerOf(childId, towerId)`（掃 `role === 'worker' && towerId === …`，資料已在 registry 內）。
   - `authorizeHelperInvoke`：`towerId` 參數必須等於 `capability.terminalId`（不能冒用別的塔台）；目標不得是自己。目標歸屬在 handler 查到候選後以 `isWorkerOf` 驗證（不屬於 → `NOT_OWNER`，與本機一致）。
   - `HelperInvokeContext` 與 `remote-server.ts` 呼叫點補上所需資訊。
2. **headless handler**：重用 T0535 的 handler 邏輯（查詢 / 唯一命中 / 閒置 / 延遲計時與取消），不要複製一份。headless PTY 的 `workorder` 記錄方式比照本機。延遲期間的「使用者輸入」= 來自 **client 連線**（非 helper 連線）的 `pty:write`。
3. **事件**：`terminal:close-requested` 加進 `PROXIED_EVENTS`（`electron/remote/protocol.ts`），由 `RemoteConnectionRegistry` 送到該 profile 的視窗；client renderer 沿用 T0535 的處理（分頁屬於本視窗才關）。沒有任何 client 連著時：計時照走，到期事件無人接收 → 分頁在下次連線時仍存在。這是已知限制，回報區記錄，不在本單處理。
4. **文件**：CLAUDE.md「遠端 Tower 通知（PLAN-036 K）」權杖表 tower 列加上這個 channel 與限制；「Worker 分頁回收（PLAN-041）」小節補遠端說明。

## 驗收條件

- [x] 擴充 `electron/remote/__tests__/headless-remote-tower-e2e.test.ts`（或新檔）：tower 關自己派出的 Worker → 成功並收到 `terminal:close-requested`；關別的 tower 的 Worker → `NOT_OWNER`；`towerId` 冒用 → `Forbidden`；目標為自己 → 拒絕；worker 權杖呼叫 → `channel-not-allowed`；撤銷後的權杖 → 拒絕
- [x] `helper-capability.test.ts` 補 `isWorkerOf` 與角色表
- [x] `npm run typecheck:electron` = 0、`npm run typecheck` = 0（若改 `src/**`）、`npx vite build` 成功、相關單元測試全綠

## 回報區

### 落點檢查

- **PASS**。C-0：frontmatter `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`（REPO_ROOT `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）；C-1 工單在 REPO_ROOT 下；C-3 前 5 個 `affects_files` 皆存在（informational）；C-2 無 `branch` 欄位，HEAD = `main`。
- 觀察到 `BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）。`CT_MODE=yolo`、`CT_INTERACTIVE=0`。

### 結果摘要

遠端 headless 的 Tower 現在可以 `bat-terminal.mjs --close-worker`，契約與 exit code 與本機（T0535）相同，handler 重用同一個 `WorkerCloseScheduler`。

1. **權杖**（`electron/remote/helper-capability.ts`）
   - `HELPER_CHANNEL_ROLES` 加 `'terminal:close-worker': ['tower']`；其他 channel 仍預設拒絕，worker 角色拿不到。
   - `HelperCapabilityRegistry.isWorkerOf(childId, towerId)`：掃 live entries，`role === 'worker' && terminalId === childId && towerId === towerId`；`childId === towerId` 一律 false。
   - `authorizeHelperInvoke` `terminal:close-worker`：payload 須為物件（否則 `invalid-payload`），`towerId` 必須**完全等於** `capability.terminalId`（否則 `tower-not-bound`）。
2. **headless handler**（`electron/remote/headless-entry.ts` `createHeadlessTerminalModule`）：建立 `WorkerCloseScheduler`（T0535 的同一個類別），以 `workerCloser` 傳給 `registerTerminalHandlers`，module disposer 清計時器。`isWorkerOf` 經新的 scheduler dep `isOwnedBy` 接到 registry（`createHeadlessServer` → `createHeadlessHandlerModules({ terminal: { isWorkerOf } })`）。scheduler 判斷擁有權：`id !== towerId && BAT_TOWER_TERMINAL_ID === towerId && isOwnedBy(id, towerId)`，不成立 → `NOT_OWNER`。工單記錄：headless 的 `terminal:create-agent-command`（skill 模式）本來就走 T0535 的同一條 `createWithCommand` → `PtyManager.create({ workorder })`，不需改動（e2e 驗證 skill 派工的 Worker 能被找到）。
3. **使用者輸入**：`registerPtyHandlers` 新增 `isUserInput?(ctx)` dep（預設 `!ctx.connectionId`，Electron 行為不變）；headless 傳 `ctx => remoteServer.isClientConnection(ctx.connectionId)`（新的 `RemoteServer.isClientConnection`），所以只有 client 連線的 `pty:write` 會取消延遲關閉，helper 寫入不算。
4. **事件**：`terminal:close-requested` 加入 `PROXIED_EVENTS`（`protocol.ts`），並列入 `PATH_FREE_EVENTS`（`path-aware-channels.ts`，coverage test 要求）。`RemoteClient` 把 PROXIED_EVENTS 只送給該 profile 的視窗；renderer 沿用 T0535 `App.tsx` 的 `onCloseRequested` + `ownsTerminalForCloseRequest` → `closeTerminalNow`，**`src/App.tsx` 不需修改**。
5. **文件**：CLAUDE.md「遠端 Tower 通知（PLAN-036 K）」權杖表 tower 列加上 `terminal:close-worker` 與限制；「Worker 分頁回收（PLAN-041）」小節的已知限制改寫，新增「遠端 headless（T0536）」條目，驗證清單補新測試。

### 修改檔案

- `electron/remote/helper-capability.ts`：角色表、`isWorkerOf`、`authorizeHelperInvoke` close-worker 分支
- `electron/remote/remote-server.ts`：`isClientConnection()`
- `electron/remote/headless-entry.ts`：terminal module 建 scheduler、pty module `isUserInput`、server 接線
- `electron/remote/protocol.ts`：`PROXIED_EVENTS` + `terminal:close-requested`
- `electron/remote/path-aware-channels.ts`：`PATH_FREE_EVENTS` 分類（不在 affects_files，coverage test 強制）
- `electron/close-worker.ts`：`isOwnedBy` dep、塔台不能是自己的 Worker（不在 affects_files，見偏差）
- `electron/handlers/pty.ts`：`isUserInput` dep（不在 affects_files，見偏差）
- 測試：`electron/remote/__tests__/headless-close-worker-e2e.test.ts`（新）、`helper-capability.test.ts`、`headless-parity.test.ts`、`electron/__tests__/close-worker.test.ts`（後者不在 affects_files）
- `CLAUDE.md`

### 驗收

| 項目 | 結果 | 證據 |
|---|---|---|
| e2e：tower 關自己派出的 Worker → 成功 + `terminal:close-requested` | PASS | `headless-close-worker-e2e.test.ts`「own Worker, delay 0」：exit 0、stdout `✓ Worker close scheduled: <id> (in 0 ms)`、client 收到 `{ id }`；client `pty:kill` 後 `isWorkerOf` = false |
| 關別的 tower 的 Worker → `NOT_OWNER` | PASS | exit 4、stderr `close-worker: NOT_OWNER`、無事件 |
| `towerId` 冒用 → `Forbidden` | PASS | `--notify-id <tower B>` → exit 1、stderr `Forbidden: tower-not-bound` |
| 目標為自己 → 拒絕 | PASS | client 以 skill 模式開的分頁（PTY 帶工單、權杖為 tower）對自己的工單 `--close-worker` → exit 4 `NOT_OWNER`、無事件 |
| worker 權杖呼叫 → 拒絕 | PASS（訊息見偏差 1） | exit 1、stderr `Forbidden: role-not-allowed` |
| 撤銷後的權杖 → 拒絕 | PASS | tower B PTY kill 後以其 env 執行 helper → exit 1、`Capability revoked`、`close-worker: AUTH_FAILED`；Worker B 未被關 |
| 延遲 + client 輸入取消（額外） | PASS | `--delay-ms 1500` 後 client `pty:write` → log `→ cancelled (user input during the delay)`、無事件；不打字再排一次 → ≥1500 ms 後收到事件 |
| `helper-capability.test.ts` 補 `isWorkerOf` 與角色表 | PASS | 角色表改為 5 個 channel；`isWorkerOf` 3 案例；close-worker 授權 7 案例；worker 呼叫 close-worker → `role-not-allowed` |
| `npm run typecheck:electron` = 0 | PASS | `tsc … tsconfig.node.json` error TS 計數 0、exit 0 |
| `npm run typecheck` = 0 | PASS（未改 `src/**`，仍補跑） | `tsc --noEmit -p .` error TS 計數 0 |
| `npx vite build` | PASS | exit 0 |
| 相關單元測試 | PASS | `npm run test:unit`：230 files、3862 passed / 1 skipped / 0 failed |

e2e（headless 真 server + 真 node-pty）沒有碰使用者的 BAT 與已部署的遠端 server，不耗 token（agent 以 `echo` custom CLI 代替）；未跑 playwright e2e 全套（L141）。

### 偏差與決策

1. **worker 權杖的錯誤字樣**：驗收條件寫 `channel-not-allowed`，實際為 `Forbidden: role-not-allowed`。原因：channel 已列入白名單（僅 tower），`authorizeHelperInvoke` 對「白名單內、角色不符」一律回 `role-not-allowed`（與 worker 呼叫 `create-agent-command` 的既有行為一致）。若要 worker 看到 `channel-not-allowed` 需為這個 channel 特判，未做。拒絕效果相同（Forbidden，handler 不執行）。
2. **「目標不得是自己」的位置**：`terminal:close-worker` 的 payload 只有 `towerId` / `workorder` / `delayMs`，沒有目標 id，`authorizeHelperInvoke` 在授權時無從得知目標，所以在 handler 端檢查：scheduler 排除 `id === towerId`（本機與遠端共用），`isWorkerOf` 對同 id 也回 false。結果碼為 `NOT_OWNER`（契約沒有另外的代碼）。本機行為只差在「PTY 的 `BAT_TOWER_TERMINAL_ID` 等於自己」這種正常流程不會出現的情況。
3. **`HelperInvokeContext` 未改**：close-worker 授權只需要 `capability.terminalId`，已在 `authorizeHelperInvoke` 參數中；擁有權由 handler（scheduler `isOwnedBy`）查 registry，所以 context 與 `remote-server.ts` 的呼叫點不需要新增欄位。`remote-server.ts` 只新增 `isClientConnection()`。
4. **超出 affects_files 的修改**：`electron/close-worker.ts`（`isOwnedBy` dep + self 排除，為了「重用 T0535 handler 邏輯，不複製」）、`electron/handlers/pty.ts`（`isUserInput` dep，為了「client 連線的 `pty:write` 才算使用者輸入」；Electron 預設不變）、`electron/remote/path-aware-channels.ts`（新 event 必須分類，coverage test 強制）、`electron/__tests__/close-worker.test.ts`。皆為最小必要改動。
5. **`headless-parity.test.ts`**：headless 現在註冊不在 `PROXIED_CHANNELS` 的 `terminal:close-worker`（刻意不加入：加入會讓 renderer 可經 ipcMain 呼叫，與 T0535 `REGISTRY_ONLY_CHANNELS` 的決定相反）。測試加 `HELPER_ONLY_CHANNELS` 例外清單（附理由，且斷言該 channel 確實有註冊）。
6. **事件也會送給本機 BAT 的遠端 client**：`terminal:close-requested` 進 `PROXIED_EVENTS` 後，本機 Electron 的 scheduler（emit 含 `broadcastHub`）觸發時，連到這台 BAT 的遠端 client 也會收到；該 client 只關自己持有同 id 的分頁（`ownsTerminalForCloseRequest`），即同一個 PTY 的分頁，屬正確行為。

### 已知限制（不在本單處理）

- 計時到期時沒有任何 client 連著：事件無人接收（`fire` log `windows=0`），分頁在下次連線時仍存在，不補送。
- server 重啟後權杖與 PTY 工單記錄全失 → `NOT_FOUND`（同本機 T0537 的情況）。
- `src/styles/settings.css` 的 M 狀態不是本單變更，未 commit。

### Commit

- `26f6996e` feat: T0536 remote headless --close-worker (tower closes only its own Worker, PLAN-041)（未 push）
