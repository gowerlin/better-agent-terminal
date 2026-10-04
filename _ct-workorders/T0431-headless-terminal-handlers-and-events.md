---
schema_version: 1
schema_kind: workorder
id: T0431
title: "PLAN-036 P3 / K 工單 1：headless terminal:* 上線（共用 electron/handlers/terminal.ts）+ terminal:created-externally / keypress 事件補齊"
type: implementation
status: DONE
repo: better-agent-terminal
project: PLAN-036
priority: P2
sizing: M
created_at: "2026-10-05T05:49:04+08:00"
started_at: "2026-10-05T05:55:20+08:00"
updated_at: "2026-10-05T06:06:06+08:00"
completed_at: "2026-10-05T06:06:06+08:00"
target_version: next
depends_on:
  - T0429
  - T0430
related:
  - "T0420 研究（`7bb4692`）回報區「拆單建議摘要」第 1 列與「各單內容」工單 1；方案 A'（使用者裁決）"
  - "T0420 拆單第 2-4 列 → T0432 / T0433 / T0434"
  - "D134 追加（K 實作，研究結論）"
affects_files:
  - electron/handlers/terminal.ts
  - electron/terminal-command-handlers.ts
  - electron/main.ts
  - electron/remote/protocol.ts
  - electron/remote/path-aware-channels.ts
  - electron/remote/headless-entry.ts
  - electron/remote/headless-channel-status.ts
  - src/stores/workspace-store.ts
  - electron/__tests__/
  - electron/remote/__tests__/
  - src/__tests__/
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **規格來源**：T0420 回報區「各單內容」工單 1 段落 + §1 現況盤點 + §3 端到端流程。本單**不含**權杖（T0432）與 helper 出貨 / env 注入（T0433）——headless 的 `terminal:*` 在本單只需在「已通過既有 server token 認證的 client」下可用。"
  - "🔴 **本機行為不得改變**：`buildAgentPromptCommand` 抽成 electron-free 模組後，Electron 端由 deps 注入原本的 settings reader / workspace default agent / elevation；以既有測試 + 新增對照測試鎖住本機輸出逐字不變。"
  - "🔴 遠端來源的 `terminal:created-externally` 在 renderer 查不到 workspace 時**忽略、不 fallback 到目前 active workspace**（BUG-031 / T0137 的行為只適用本機）。`cwd` 列入 path-aware 事件轉換；T0416 / T0406 的全分類守門（含 `PROXIED_EVENTS`）必須維持綠。"
  - "🔴 依賴 T0429（`headless-entry.ts`）與 T0430（`main.ts`）。開工前 `git log --oneline -8` 確認。共用檔 commit 前 `git diff <file>` 確認只含本單 hunk。"
  - "🔴 **只跑 `npm run test:unit` + `npx tsc --noEmit`；不跑 `npx vite build` / `npm run test:e2e`**（L141）。**禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）；`git commit --only`；不 push；不部署 WSL。"
---

# T0431 — headless terminal:* + 事件（K 工單 1）

## 背景

T0420 研究結論：遠端 Tower 通知採 A'（每 PTY 範圍權杖）。第一步是讓 headless server 具備 `terminal:create-with-command` / `terminal:create-agent-command` / `terminal:notify` / `terminal:keypress`（目前在 `HEADLESS_UNSUPPORTED` P3），並讓 `terminal:created-externally` / `notified` / `keypress` 事件經 broadcastHub 送到 client。

## 範圍

依 T0420「各單內容」工單 1：
1. `buildAgentPromptCommand` 抽成 electron-free 模組（deps 注入；headless 用 `<dataDir>/settings.json`，workspace default agent 回 null）
2. 新增 `electron/handlers/terminal.ts`，兩端共用 `terminal:create-*` / `notify` / `keypress`；事件經 host `emit`（Electron = windows + broadcastHub；headless = broadcastHub）
3. `PROXIED_EVENTS` 加 `terminal:created-externally`（`cwd` 列入 `PATH_EVENT_CHANNELS`）與 `terminal:keypress`（path-free）；`headless-channel-status.ts` 這 4 個 channel 改為已支援
4. renderer：遠端來源 `created-externally` 查不到 workspace 時忽略；headless keypress 在沒有 client 時回 `no-client`
5. 測試：parity / 全分類守門、headless harness invoke `terminal:create-agent-command` → 收到 `created-externally` 事件、本機輸出不變

## 驗收條件

- [ ] `HEADLESS_UNSUPPORTED` 只剩 codex 控制 2 個（回報區附前後計數）
- [ ] `npm run test:unit` 全綠；`npx tsc --noEmit` ≤ 40

## Sub-session 執行指示
1. 讀本工單 + T0420 回報區全文 + T0416 回報區（path-aware 分類）
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 實作 → 驗收
4. 填回報區；完成寫 **`DONE`**
5. `git commit --only` 實際改動檔 + 本工單；不 push
6. 依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

**DONE**

- **落點檢查**：PASS —— C-0 `repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal`；C-1 PASS；C-3 `electron/handlers/terminal.ts` 等皆有既存祖先（present）；C-2 不適用（無 `branch` 欄位，HEAD=`main`）。`BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）
- 依賴確認：開工時 `git log --oneline -8` 含 `b968b9f`（T0429）、`a878b83`（T0430）
- 驗收條件：
  - [x] `HEADLESS_UNSUPPORTED` 只剩 codex 控制 2 個：**前 6**（P1 ×2 codex + P3 ×4 `terminal:*`）→ **後 2**（`claude:set-codex-sandbox-mode` / `claude:set-codex-approval-policy`）；`headless-terminal.test.ts` 以 `Object.keys(...).sort()` 鎖定
  - [x] `npm run test:unit` 全綠；`npx tsc --noEmit` = **39**（≤ 40；開工前 baseline 同為 39，0 新增）

### 產出摘要

**1. `buildAgentPromptCommand` 抽成 electron-free 模組**（`electron/terminal-command-handlers.ts`）
- 新增 `createAgentPromptCommandBuilder(deps)`；`toTerminalDrivenAgentId` / `isCodexAgentId` / `WORKORDER_ID_PATTERN` / `buildControlTowerSkillPrompt` / `normalizeControlTowerPromptForAgent` 從 `main.ts` 原樣搬入，邏輯逐行不變
- deps：`readSettings` / `resolveWorkspaceDefaultAgent` / `ensureElevationApplied` / `logger`；`buildLaunchCommand`（預設 `agentRegistry`）、`resolveClaudeBaseCommand`（預設動態 import，同原本）可覆寫
- Electron（`main.ts`）：注入原本的 `readPersistedSettingsSync`、`resolveWorkspaceDefaultAgent`（window registry）、`ensureElevationApplied`
- headless（`headless-entry.ts`）：`readHeadlessTerminalSettings(host.getSettings())`（`<dataDir>/settings.json`，型別不符的值丟棄）、workspace default agent 回 `null`、elevation no-op；claude 走 claude module 已設定的 runtime router（bundle `bin/claude`）

**2. 新增 `electron/handlers/terminal.ts`（兩端共用）**
- `registerTerminalHandlers(register, deps)`：`terminal:create-with-command` / `create-agent-command`（委派 `registerTerminalCommandHandlers`）+ `terminal:notify` / `terminal:keypress`（自 `main.ts` 搬入，log / mirror 欄位不變）
- 事件全經 host `emit`：Electron = `createTerminalWindowEmit`（所有視窗 + broadcastHub，回傳成功送達視窗數 → `broadcastWindows`）；headless = broadcastHub（回 0）
- headless 專屬：`validateShell`（client 傳的 `shell` 必須是存在的絕對路徑，沿用 `shellPathRejection`）；`countRemoteReceivers`（= 已認證 client 數 − 呼叫者本身），為 0 時 keypress 回 `{ ok: false, reason: 'no-client' }`、不發事件（bat-notify `--submit` 既有邏輯即 exit 1）
- `terminal-command-handlers.ts` 向下相容：`invokeHandler` / `getAllWindows` 改為選用；未給 `emit` 時仍走舊的 `getAllWindows()` 迴圈（`tests/terminal-create-agent-command.integration.test.ts` 未改仍綠）；未給 `invokeHandler` 時 create-agent-command 直接呼叫 create-with-command（同一 ctx）
- `headless-entry.ts`：`createHeadlessTerminalModule` 加入 `createHeadlessHandlerModules`，與 pty module 共用 PtyManager（以 `onManager` 交接）；`createHeadlessServer` 傳入 `countRemoteReceivers`

**3. 事件 / 分類**
- `protocol.ts` `PROXIED_EVENTS` + `terminal:created-externally`、`terminal:keypress`
- `path-aware-channels.ts`：`PATH_EVENT_CHANNELS` + `terminal:created-externally`（`cwd` 轉回 client 形式，`PATH_EVENT_FIELDS`）；`PATH_FREE_EVENTS` + `terminal:keypress`；新增 `REMOTE_ORIGIN_EVENTS` —— RemoteClient 收到時（`translateRemoteEventArgs`）在 payload 加 `remote: true`
- `headless-channel-status.ts`：4 個 `terminal:*` 自 `HEADLESS_UNSUPPORTED` 刪除

**4. renderer**（`src/stores/workspace-store.ts`）
- `addExternalTerminal` 收 `remote?: boolean`：`remote` 且查不到 workspace（含未帶 workspaceId）→ 忽略並 debug log `[T0431] Remote external terminal ignored ...`，**不** fallback；本機來源（無 `remote`）維持 BUG-031 / T0137 fallback
- `App.tsx` / `preload.ts` 未改：preload 原樣轉交 payload 物件，`remote` 欄位隨之送達 store

**5. 測試**（新增 4 檔 + 擴充 1 檔）

| 檔案 | 內容 | 結果 |
|---|---|---|
| `electron/__tests__/agent-prompt-command.test.ts` | 本機輸出不變：新 builder vs `main.ts` 舊實作逐字複本，3 種 settings × 11 種 opts 矩陣 `toEqual`；4 條 golden 指令字串（posix / pwsh / cmd / workspace default agent）；elevation 先於 launch；headless settings 形狀 | 11/11 |
| `electron/__tests__/terminal-handlers.test.ts` | 共用模組：4 channel 註冊、created-externally 經 emit（僅非本機視窗呼叫時）、validateShell、notify / keypress 事件、headless `no-client` / `broadcastClients`、Electron emit（視窗計數 + 單次 broadcast、關閉中視窗不中斷） | 10/10 |
| `electron/remote/__tests__/headless-terminal.test.ts` | harness 真 wss + 真 node-pty：helper client invoke `terminal:create-agent-command` → 另一 BAT client 收到 `created-externally`（`{ id, cwd, command: 'echo T0431MARK', workspaceId }`）且 PTY 輸出含 marker；相對路徑 shell 被拒；notify → `notified`；keypress → `keypress` 事件，關掉 BAT client 後 → `no-client`；ledger 只剩 2 個 codex。agent 以 `echo` custom CLI 代替，不會啟動真 agent | 5/5 |
| `src/__tests__/workspace-store-remote-external-terminal.test.ts` | remote 命中 / remote miss 忽略（不 fallback）/ remote 無 workspaceId 忽略 / 本機 miss 仍 fallback | 4/4 |
| `electron/remote/__tests__/path-aware-channels-coverage.test.ts`（+2） | created-externally `cwd` WSL 兩種形式轉回 + `remote: true`、Identity translator 仍標記、輸入不被 mutate；keypress 為 proxied + path-free；`REMOTE_ORIGIN_EVENTS ⊆ PATH_EVENT_CHANNELS` | 綠 |

| 證據道 | 結果 | 內容 |
|---|---|---|
| `npm run test:unit` | PASS | **129 files / 2004 passed / 1 skipped**（含既有 parity / electron-free / T0416 / T0406 全分類守門、T0361 store 測試） |
| `npx tsc --noEmit` | PASS | **39**（baseline 39，0 新增；全為既有 `CodexAgentPanel.tsx` 等） |
| legacy node:test | PASS | `npx tsx --test tests/terminal-create-agent-command.integration.test.ts` 1/1（舊 deps 形狀相容） |
| `tsc -p tsconfig.node.json` | 參考 | 本單檔案無新增錯誤類別（`terminal-command-handlers.ts` 的 TS6307 / Handler 參數型別為既有同類雜訊） |
| `npx vite build` / `npm run test:e2e` | 未跑 | 依工單 L141 禁止 |
| WSL 部署 / 實機 | 未做 | 依工單不部署；遠端塔台端到端實機屬 T0434 |

**變更檔案**：`electron/handlers/terminal.ts`（新）、`electron/terminal-command-handlers.ts`、`electron/main.ts`（僅本單 6 個 hunk）、`electron/remote/headless-entry.ts`、`electron/remote/protocol.ts`、`electron/remote/path-aware-channels.ts`、`electron/remote/headless-channel-status.ts`、`src/stores/workspace-store.ts`、上表 5 個測試檔、本工單。

### 遭遇問題

1. **`main.ts` 與 T0436 並行修改**：工作樹的 `electron/main.ts` 同時含 T0436（image-attachments，3 個 hunk）。以 `git diff` 切 hunk → `git apply --cached` 只 stage 本單 6 個 hunk（staged diff grep `T0436|image-attachments` = 0），T0436 hunk 留在工作樹未動。未用 stash / reset / checkout / restore
2. **行為變更（依規格，非回歸）**：Electron 端 `terminal:created-externally` / `notified` / `keypress` 現在也經 broadcastHub 送給連到本機 BAT 的遠端 client。效果：B 機遠端視窗中的 Tower（PTY 在 A 機）派單時，新分頁現在會出現在 B（原本只在 A 的 active workspace 冒出幽靈分頁）。副作用：B 也會看到 A 本機 Tower 的 notify toast（`App.tsx` toast 不比對 terminal 是否存在，既有行為；A 的視窗原本就會看到所有 notify）
3. **既有限制未改（記錄）**：①本機 Electron 的 `created-externally` 仍送到所有視窗（含遠端 profile 視窗），本機來源 miss 仍 fallback（BUG-031 語意，規格明定只改遠端）；②兩台 BAT 同時掛同一個 terminal id 時，keypress 會被兩邊各合成一次 Enter（與 `pty:output` 雙送同屬多 client 既有性質）；③headless 的 `countRemoteReceivers` 目前把其他 helper 連線（例如並行的 bat-notify）也算成接收者 —— T0432 權杖連線不計入 client 數後即精確
4. **headless 的 codex agent**：`create-agent-command` 指定 codex 時仍會組出 `codex ...`，但 server bundle 無 codex（T0386 §1 C），shell 內會 command not found。本單未攔（規格未要求），建議 T0432 / T0434 評估是否回明確錯誤
5. **範圍外的過時註解（未改）**：`src/types/control-tower.ts:194` 與 `scripts/bat-terminal.mjs:101` 的「sibling copy」清單仍指 `electron/main.ts`，實際位置已改為 `electron/terminal-command-handlers.ts`。不在 `affects_files`，建議塔台併入後續小單
6. **`src/types/electron.d.ts`**：`onCreatedExternally` 的 info 型別未加 `remote?`（該檔正由其他 Worker 修改中，且不在 `affects_files`）；runtime 不受影響（preload 原樣轉交），型別補齊可併入後續
7. **測試檔位置**：store 測試放 `src/__tests__/`（符合 `affects_files`），未放既有的 `src/stores/__tests__/`

**Commit**：單一 commit（`git commit`，index 只含本單 hunk + 本工單），hash 見 `git log`（回報區在 commit 前寫入，不自我引用）。未 push、未部署 WSL。

### 回報時間

2026-10-05T06:06:06+08:00
