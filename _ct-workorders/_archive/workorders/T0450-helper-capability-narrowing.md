---
schema_version: 1
schema_kind: workorder
id: T0450
title: "T0445 #6/#7：helper 能力收斂——pty:write 內容過濾（拒控制字元，送出只走 keypress）、tower 子 PTY 數量 / 頻率上限與 client 配額保留、agent 限 registry"
type: fix
status: DONE
repo: better-agent-terminal
project: PLAN-036
priority: P1
sizing: M
created_at: "2026-10-05T06:32:48+08:00"
started_at: "2026-10-05T06:47:40+08:00"
updated_at: "2026-10-05T06:58:10+08:00"
completed_at: "2026-10-05T06:58:10+08:00"
target_version: next
depends_on:
  - T0449
related:
  - "T0445 findings #6 / #7、拆單 4（設計裁決）；T0432 殘餘風險 3-2"
  - "D134 追加（塔台 06:32 依授權裁決：收緊方向，不擴大暴露面）"
affects_files:
  - electron/remote/helper-capability.ts
  - electron/remote/remote-server.ts
  - electron/remote/headless-entry.ts
  - electron/pty-manager.ts
  - scripts/bat-notify.mjs
  - electron/remote/__tests__/
  - scripts/__tests__/
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **塔台裁決（收緊）**：(a) helper 的 `pty:write` 拒絕所有 C0 控制字元（`\\x00-\\x1f`，含 `\\r` / `\\n` / `\\x03` / ESC）與 DEL `\\x7f`，只允許可列印文字；多行內容的需求先查 `scripts/bat-notify.mjs` 實際送什麼——若 bat-notify 需要換行，改由 helper 端把換行轉成空白或拆多次 pre-fill，並在回報區說明；送出一律走 `terminal:keypress`。(b) 每個 tower 權杖存活中的子 PTY ≤ 8、建立間隔 ≥ 1 秒；helper 建立的 PTY 不得吃掉最後 8 格（`maxPtys` 為 0 = 無上限時不保留）。(c) `create-agent-command` 的 `agent` 只接受 agent registry 內已知 id（builtin + 使用者設定的自訂 agent），未知 id 拒絕。"
  - "🔴 先確認 bat-notify / bat-terminal 的實際 payload，確保收緊後既有正常流程（T0420 §3 端到端、T0432 正向測試）仍綠。"
  - "🔴 依賴 T0449（同改 `remote-server.ts` / `helper-capability.ts`）。T0433 / T0448 若同時碰 `headless-entry.ts` / `pty-manager.ts`，以 `git diff` + `git apply --cached` 精準 stage。"
  - "🔴 **只跑 `npm run test:unit` + `npx tsc --noEmit`；不跑 `npx vite build` / `npm run test:e2e`**（L141）。**禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）；不 push；不部署 WSL。"
---

# T0450 — helper 能力收斂（T0445 #6/#7）

## 驗收條件

- [ ] 負向測試：worker `pty:write` 含 `\\r` / `\\x03` / ESC / `\\n` 被拒；tower 第 9 個存活子 PTY 被拒、1 秒內第二次建立被拒、配額保留生效；未知 agent id 被拒
- [ ] 正向：bat-notify pre-fill + keypress 送出流程仍通
- [ ] `npm run test:unit` 全綠；`npx tsc --noEmit` ≤ 39

## Sub-session 執行指示
1. 讀本工單 + T0445 #6 / #7 + T0432 / T0449 回報區 + `scripts/bat-notify.mjs` / `bat-terminal.mjs`
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 實作 → 驗收；填回報區；完成寫 **`DONE`**
4. commit 實際改動檔 + 本工單；不 push；依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

**DONE**

- **落點檢查**：PASS —— C-0 `repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal`；C-1 PASS；C-3 PASS（`affects_files` 前 5 項皆存在，資訊性）；C-2 不適用（無 `branch` 欄位，HEAD=`main`）。`BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）
- 派發環境：`CT_MODE=yolo`、`CT_INTERACTIVE=0`；依賴 T0449 已在 `c186c81`
- 驗收：
  - [x] 負向（真 wss + 真 node-pty，`headless-helper-narrowing.test.ts`）：worker `pty:write` 含 `\r` / `\n` / `\x03…\r` / ESC 序列 / `\t` / DEL → `Forbidden: control-character-not-allowed`，tower PTY 輸出與 buffer 皆無標記；tower 第 9 個存活子 PTY → `too-many-children`（殺掉一個後第 9 個可建）；1 秒內第二次建立 → `create-rate-limited`；`maxPtys: 10` 時 helper 只能建到 2 → `pty-quota-reserved`，client 仍可開到 10；未知 agent / `constructor` → `agent-not-allowed`，皆未建出 PTY
  - [x] 正向：worker notify → 可列印 pre-fill → `terminal:keypress` Enter 仍通；**真 `bat-notify.mjs --submit`** 以 worker 權杖送多行訊息 → exit 0、toast 保留原訊息、Tower PTY 收到單行 pre-fill、keypress 事件到達；T0434 的 `headless-remote-tower-e2e.test.ts`（真 bat-terminal / bat-notify 端到端）全綠
  - [x] `npm run test:unit`：**151 files / 2427 passed / 1 skipped，0 failed**；`npx tsc --noEmit`：**39**（≤ 39）
  - 未跑 `npx vite build` / `npm run test:e2e`（依 memory_overrides L141）

### 產出摘要

**(a) `pty:write` 內容過濾（#6）** —— `electron/remote/helper-capability.ts`
- `HELPER_PTY_WRITE_FORBIDDEN = /[\u0000-\u001f\u007f-\u009f]/`：worker 的 `pty:write` 綁定 target 後，`data` 須為字串（否則 `invalid-payload`）且不含 C0 / DEL / **C1**（否則 `control-character-not-allowed`）。C1（`\x80-\x9f`，如 8-bit CSI `\x9b`）超出裁決字面的「C0 + DEL」，依「只允許可列印文字」一併拒絕
- **bat-notify 多行需求**：查 `scripts/bat-notify.mjs`，message = argv `join(' ')`，原本刻意保留換行（「Payload line breaks remain text」），`tests/bat-notify-submit.test.mjs` 也有 LF 結尾案例 ⇒ 確實可能送換行。依裁決改為 helper 端處理：新增 `toPtyPrefill()`，把每段連續控制字元換成**一個空白**再 `trim()`，只套用在 `pty:write` payload；`terminal:notify` 的 toast 保留原訊息；送出仍一律走 `terminal:keypress`。`submit-boundary` log 新增 `controlCharsFlattened`。此轉換不分 server token / 權杖模式一律套用（行為一致；塔台訊息本為單行短字串）

**(b) tower 子 PTY 數量 / 頻率上限 + client 配額保留（#7）** —— `HelperTowerSpawnQuota`（`helper-capability.ts`，無 electron import）
- 常數：`HELPER_TOWER_MAX_LIVE_CHILDREN = 8`、`HELPER_TOWER_CREATE_INTERVAL_MS = 1000`、`HELPER_CLIENT_RESERVED_PTYS = 8`
- `reserve(towerId, childId, ctx)` 在 `authorizeHelperInvoke` 通過**之後**才跑（被拒的請求不消耗頻率）；同步記錄（pipelined 請求看得到）；建立中（in-flight）的子 PTY 也計入存活數與 server 用量；`settle()` 後若 PTY 不存在即釋放名額；子 PTY 結束後自動剪除；無子 PTY 且超過間隔的 tower 條目會被遺忘（記憶體有界）
- client 保留：`max > 0` 時 helper 建立需 `count + inFlight < max - 8`；`max = 0`（無上限）不保留；`max ≤ 8` ⇒ helper 不能建立任何終端
- 以 tower 的 terminalId 為 key（一 PTY 一活權杖 ⇒ 等同每權杖；tower restart 後其存活子 PTY 仍計入，較嚴）
- fail-closed：缺 `getPtyCapacity` / 回 null → `pty-capacity-unknown`
- `remote-server.ts`：新增選項 `isKnownAgent` / `getPtyCapacity` / `helperSpawnQuota`（預設每 server 一個新的）；`handleHelperFrame` 對 `terminal:create-agent-command` 先授權再 `reserve`，拒絕走既有 `Helper invoke denied … reason=` log 與 `Forbidden: <reason>` 回應；handler 以 `try/finally` 包 `settle()`
- `pty-manager.ts`：新增 `getCapacity(): { count, max }`（max 0 = 無上限）
- `headless-entry.ts`：接 `getPtyCapacity: () => ptyManager?.getCapacity() ?? null`、`HeadlessServerOptions.helperSpawnQuota`（測試注入時鐘）

**(c) `agent` 限 registry（#7）**
- `authorizeHelperInvoke`：`agent` 為 `undefined` / `null` / `''` / `'default'` 時放行（= host 設定的預設 agent）；否則須為字串（`invalid-agent`）且 `ctx.isKnownAgent(agent)` 為真（`agent-not-allowed`）；缺 `isKnownAgent` → `agent-registry-unknown`（fail closed）
- headless 接 `agentRegistry.getDefinition(agent) !== undefined`（builtin + 已 `registerCustomCli` 的自訂 CLI；`Map` 查表，`constructor` 等原型鍵不會命中）

**測試**
- 新增 `electron/remote/__tests__/headless-helper-narrowing.test.ts`（12 案，真 wss + 真 node-pty + 真 bat-notify）
- `electron/remote/__tests__/helper-capability.test.ts`：ctx 補 `isKnownAgent`；新增 agent registry、`pty:write` 內容（11 種控制字元）、`HelperTowerSpawnQuota`（9 案，注入時鐘）單元測試
- `electron/remote/__tests__/headless-helper-env.test.ts`：同一 tower 連續派兩次（T0433 案例），harness 注入 `createIntervalMs: 0` 並註明頻率限制另有覆蓋
- `tests/bat-notify-submit.test.mjs`：LF 結尾案例改為斷言 pre-fill 被攤平為 `'T9999 完成'`、toast 保留 `'T9999 完成\n'`、keypress 仍為獨立動作

**Commit**：本單 commit（訊息含 `T0450`，`git commit --only` 精準提交實際改動檔 + 本工單；未 push）

### 遭遇問題

- **偏離 `affects_files`（必要連動）**：`tests/bat-notify-submit.test.mjs`（舊測試斷言 LF 原樣保留，與裁決 (a) 直接衝突）與 `electron/remote/__tests__/headless-helper-env.test.ts`（同一 tower 1 秒內連續建立被新頻率限制擋下）不在清單內，已依新行為更新並註明
- **C1 控制字元**：超出裁決字面（C0 + DEL），依「只允許可列印文字」納入，若塔台要放寬只需改 `HELPER_PTY_WRITE_FORBIDDEN` 與 bat-notify 的 `PTY_PREFILL_CONTROL_CHARS`
- **已部署的舊 bat-notify**：BAT 安裝目錄 / 既有 server bundle 內的舊版 `bat-notify.mjs` 對含換行訊息會原樣送 `\n` → 在新 server 上被拒（exit 1，`pty-write-Forbidden: control-character-not-allowed`）；單行訊息不受影響。helper 隨 bundle 一起發佈，同版即一致
- 測試踩到：pwsh PSReadLine 會以 ANSI 分詞上色回顯，比對 Tower PTY 輸出需先去 escape 序列（已處理）
- 未處理（範圍外）：`terminal:keypress` 的 `key` 內容、`cwd` / `workspaceId` 未限制；T0445 #9（log 跳脫 / 連線數）另單
- 工作樹中他人未提交改動（`scripts/smoke-remote-headless.mjs`、`scripts/dev-deploy-headless.mjs`、`scripts/__tests__/smoke-remote-headless.test.mjs`、T0434 的 `headless-remote-tower-e2e.test.ts`、其他工單）未碰、未提交；未用 `git stash` / `reset` / `checkout --` / `restore`

### 回報時間

2026-10-05T06:57:28+08:00
