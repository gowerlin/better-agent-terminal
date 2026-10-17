---
schema_version: 1
schema_kind: workorder
id: T0575
title: "PLAN-047 A1：本機 PTY 改用範圍權杖（batcap.），不再注入全權 server token"
type: feature
status: PENDING
repo: better-agent-terminal
project: PLAN-047
priority: P1
sizing: M
created_at: "2026-10-17T19:04:59+0800"
target_version: "與 T0576（A2）同版發佈；未完成 A2 前不得發版（D149）"
depends_on: []
related:
  - "PLAN-047（研究結論、D149）"
  - "T0574 回報區 R3（呼叫者盤點、本機缺口 1–5、相容性表、遷移步驟）"
  - "PLAN-036 K / T0432 / T0447–T0450（headless 每 PTY 權杖；`helper-capability.ts`、`buildHeadlessHelperEnv`、`authorizeHelperInvoke`）"
  - "T0576（A2：權杖跨 BAT 重開持久化，接在本單之後）"
affects_files:
  - electron/main.ts
  - electron/pty-manager.ts
  - electron/remote/remote-server.ts
  - electron/remote/helper-capability.ts
  - electron/close-worker.ts
  - "electron/__tests__/**（新增 / 修改本機權杖相關測試）"
  - "electron/remote/__tests__/helper-capability.test.ts"
  - "e2e/t0575-local-scoped-token.spec.ts（新增）"
  - "CLAUDE.md（「遠端 Tower 通知（PLAN-036 K）」權杖表與「本機 Electron 的 PTY 仍注入全權 server token」一句、Logging 節的 helper env 說明）"
  - _ct-workorders/T0575-local-pty-scoped-capability-token.md
renew_count: 0
workdir: main repo
interaction:
  mode_hint: on
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 不 push、不觸發 workflow、不建 tag、不改版號；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF；含反斜線的內容用 Write 工具（L129）。commit 用 `git commit --only <你改的檔>`（`src/styles/settings.css` 的 M 不是你的變更）。"
  - "🔴 不碰使用者正在用的 BAT（port 9876）與它的 Terminal Server；實測一律用隔離實例（需先 `npx vite build`）。塔台與其他 Worker 正透過已安裝的 BAT 使用 helper，本單的變更只在 build 產物，不影響它們。"
  - "🔴 遠端 headless 的行為不得改變（`headless-*` 測試全綠）；`BAT_REMOTE_TOKEN` 變數名不變（helper 讀它）；RemoteServer 仍須接受全權 server token（遠端 client / QR / 行動端使用），只是**本機 PTY env 不再拿到它**。"
  - "🔴 No Regressions：本機現有每一種 helper 用法（見任務 3）在本單後都要能用，或在回報區明列「行為改變 + 理由」交塔台決定；不得默默變成 Forbidden。"
---

# T0575 — PLAN-047 A1：本機 PTY 範圍權杖

## 背景

T0574 R3 實測 / 盤點：本機 PTY env 的 `BAT_REMOTE_TOKEN` 是 RemoteServer 的全權 server token（持久化在 `server-token.json`，與 QR / 行動 client 共用），server-token client 直接 `invokeHandler(frame.channel)`（`electron/remote/remote-server.ts:742`），可呼叫**所有** `registerHandler` channel（`fs:*`、`settings:save`、`claude:*`、對任意 id 的 `pty:write` / `pty:get-buffer`），並收到所有廣播（含每個 PTY 的 `pty:output`）。任何本機分頁裡的程式都能做這些事。

範圍權杖的程式碼已在共用的 `RemoteServer`（`acceptHelper` / `handleHelperFrame` / `authorizeHelperInvoke`，`remote-server.ts:1005-1137`，只在傳入 `helperCapabilities` 選項時啟用）；headless 在 `electron/remote/headless-entry.ts:892-907` 已完整接線；本機 `electron/main.ts:438` 是 `new RemoteServer()`，沒有接。

## 塔台決策（D149）

- raw command 模式（`bat-terminal.mjs claude "/ct-exec T####"` → `terminal:create-with-command`）：**tower 角色允許**，套用與 `terminal:create-agent-command` 相同的限制（不得指定 `shell`、`customEnv` 白名單、`BAT_TOWER_TERMINAL_ID` 只能是自己、存活子 PTY 上限、建立間隔）。headless 是否同步開放：**本單不動 headless**（headless 角色表的 raw command 仍拒絕），在回報區評估是否該同步，交塔台決定。
- 每個 tower 存活子 PTY 上限：本機沿用 `HELPER_TOWER_MAX_LIVE_CHILDREN` = 8，不加 Settings。
- 升級當下仍存活的舊分頁（Terminal Server 跨版本存活）：維持全權 token 直到重開，不輪替 server token；在 CLAUDE.md 寫明。
- 本單與 T0576（A2）同版發佈；本單完成後 BAT 重開而 Terminal Server 存活的分頁 helper 會失效，這是已知、由 A2 修正，**回報區要寫出實測現象**供 A2 對照。

## 任務

1. **本機接線**（依 T0574 R3「本機需要補的」①–④）：
   - `main.ts` 建 `RemoteServer` 時傳 `helperCapabilities`（`HelperCapabilityRegistry`）、`isTerminalAlive`、`isKnownAgent`（經 `normalizeAgentAlias` / registry，與 headless 同語意）、`getPtyCapacity`。
   - `PtyManager.buildPtyEnv()`（唯一組裝點，T0525）：本機 helper env 的 `BAT_REMOTE_TOKEN` 改為簽發的 `batcap.` 權杖；有 `customEnv.BAT_TOWER_TERMINAL_ID` → worker（綁該 tower），否則 → tower。三條 spawn 分支、`pty:restart`、Terminal Server recovery 都經這裡（restart 保留角色，比照 T0448）。
   - `onPtyExit` / kill → `revokeTerminal`。
   - `WorkerCloseScheduler` 加 `isOwnedBy: isWorkerOf`（`main.ts` 接線處，比照 headless T0536）。
2. **raw command 政策**（D149）：本機 tower 角色可呼叫 `terminal:create-with-command`，限制同 create-agent-command。實作方式（角色表 per-server 設定或本機專用表）自行判斷，**headless 角色表不變**。
3. **盤點並逐一驗證本機 helper 用法**（T0574 R3 呼叫者表為起點，再 grep 一次）：`bat-terminal.mjs` agent 模式（`--skill` / `--prompt`）、raw command 模式、`--close-worker`、`--set-role`；`bat-notify.mjs`（Worker → 塔台：notify、預填 `pty:write`、`--submit` keypress；以及**非 Worker 分頁手動執行 bat-notify** 的情況）。每一種在回報區列「修正前 / 修正後」結果。
4. **巢狀 BAT**（T0574 缺口 4）：`buildPtyEnv` 在 `remoteInfo` 為 null（本機 RemoteServer 未啟動）時刪除繼承來的 `BAT_REMOTE_*`，不把外層 token 傳下去。
5. **日誌**：主行程記一行權杖簽發 / 撤銷（不記 token 本身，只記 terminalId 與角色），沿用既有 `[helper-cap]` 或同類前綴。
6. **CLAUDE.md**：更新「遠端 Tower 通知（PLAN-036 K）」節（權杖改為本機與 headless 共用、本機 raw command 規則、舊分頁相容說明；刪除「本機 Electron 的 PTY 仍注入全權 server token」），以及 Logging 節 helper env 相關描述。

## 驗收條件

1. `npx vite build` 成功；`npm run typecheck` = 0、`npm run typecheck:electron` = 0；`npm run test:unit` 全綠（含 `headless-*`、`helper-capability`、`close-worker`、`proxied-channels-binding`、`headless-parity`）。
2. 新增單元測試：本機 env 為 `batcap.`、角色判定、restart 保留角色、exit 撤銷、`isOwnedBy`、raw command 限制、巢狀 env 清除。
3. 新增 e2e `e2e/t0575-local-scoped-token.spec.ts`（隔離實例，自訂 CLI 跑 node 腳本，不耗 token）：分頁 env token 以 `batcap.` 開頭；tower 分頁可派工（agent 與 raw command）/ `--close-worker` / `--set-role`；Worker 分頁 `bat-notify --submit` 成功；**Worker 分頁呼叫 `pty:create`（或 `fs:*` 任一）→ Forbidden**；server token 經 RemoteServer 仍可用。
4. 回報區有任務 3 的修正前 / 後表、任務 2 的 headless 評估、以及「BAT 重開 + Terminal Server 存活」的實測現象（供 T0576）。

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯
