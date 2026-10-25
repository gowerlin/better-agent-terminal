---
schema_version: 1
schema_kind: workorder
id: T0562
title: "塔台分頁標題：helper `bat-terminal.mjs --set-role tower` → BAT 把該分頁標題改為 `<Agent 顯示名> · Tower`（使用者命名優先；本機 + 遠端 headless；D147）"
type: implementation
status: DONE
repo: better-agent-terminal
project: D147
priority: P2
sizing: M
created_at: "2026-10-16T14:34:53+0800"
updated_at: "2026-10-16T15:01:16+0800"
started_at: "2026-10-16T14:37:16+0800"
completed_at: "2026-10-16T14:57:22+0800"
commit: "4faa93ab"
target_version: "0.6.1-pre.6"
depends_on: []
related:
  - "D147（本功能的決策）"
  - "CT-T013（CT 端：Tower 啟動時呼叫本指令；依本單「介面契約」撰寫）"
  - "T0553（`externalTerminalTitle`、`titleShowsWorkorder`、使用者命名優先、舊標題重算）"
  - "T0535 / T0536（`--close-worker`：helper 參數互斥、exit code、`close-worker: <CODE>`、headless 權杖授權與 `PROXIED_EVENTS` 範本）"
affects_files:
  - scripts/bat-terminal.mjs
  - electron/**
  - src/**
  - e2e/**
  - CLAUDE.md
  - _ct-workorders/T0562-tower-tab-title-set-role.md
renew_count: 0
workdir: main repo
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 「介面契約」一節是 CT-T013 的依據，不得單方更改；確有必要偏離時，先完成其餘部分，在回報區寫明理由與建議的新契約，狀態回 PARTIAL 由塔台裁決。"
  - "🔴 No Regressions（CLAUDE.md）：改 helper / IPC / store / 權杖表時追所有 consumer；`--close-worker` 與建立分頁的既有行為、exit code、輸出一律不變；Worker 標題（T0553）不變。"
  - "🔴 驗收前必跑：`npm run test:unit` 全綠（基線 4372 passed / 253 files 加上新測試）、`npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npx vite build` 成功。e2e 只用隔離實例，不動使用者自己的 BAT（9876）、其 profile 與 WSL `Ubuntu-24.04`；不啟動模型（自訂 CLI 跑 node 腳本，比照 `e2e/t0553-worker-tab-title.spec.ts`）。"
  - "🔴 commit：`git add` 本單實際改動的檔後 `git commit --only <那些檔>`（`src/styles/settings.css` 的 M 不是你的變更）。不 push、不觸發 workflow、不建 tag；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF。"
  - "🔴 不要呼叫 `bat-terminal.mjs --close-worker`；通知塔台之後不要再執行任何指令。"
---

# T0562 — 塔台分頁標題（`--set-role tower`）

## 背景

使用者要求：`/control-tower` 啟動後，該 BAT 分頁標題改為 `<Agent 顯示名> · Tower`（例 `Claude CLI · Tower`），與 Worker 分頁（T0553 `Claude CLI · Worker · T####`）一致。BAT 目前沒有讓分頁內程式改自己標題的管道。決策 D147：BAT 提供 helper 指令，CT 在 Tower 啟動時呼叫（CT-T013）。

## 介面契約（CT-T013 依此撰寫）

```
"${BAT_HELPER_NODE:-node}" "$BAT_HELPER_DIR/bat-terminal.mjs" --set-role tower [--terminal-id <id>] [--agent <id>]
```

- `--set-role`：目前只接受 `tower`（去前後空白、不分大小寫）；其他值 → 用法錯誤。
- `--terminal-id`：要設定的分頁，預設取 env `BAT_TERMINAL_ID`；兩者皆無 → 用法錯誤。
- `--agent`：選填，agent 顯示名的提示（例 `claude` / `codex`，經 `normalizeAgentAlias` 正規化）；分頁本身有 `agentPreset` 時以分頁為準。
- 與建立分頁專用的參數（`--cwd` / `--workspace` / `--prompt` / `--skill` / `--workorder` / `--mode` / `--interactive` / `--no-interactive` / `--notify-id` / 位置參數）及 `--close-worker` / `--delay-ms` 互斥；`--agent` 在此模式下只是顯示名提示。
- **exit code**：`0` 已處理（標題已套用，或因使用者命名而保留）/ `3` NOT_FOUND（沒有這個分頁）/ `1` 用法錯誤、連線失敗、權杖不允許、BAT 太舊（主行程 `No handler for channel` → stderr `set-role: UNSUPPORTED`；舊 helper 對 `--set-role` 印 `Unknown option` 並 exit 1，不得建立分頁）。stderr 另印 `set-role: <CODE>`（診斷用）。成功 stdout 一行 `✓ Tower role set: <id>`（若同步得知結果，可再印套用或保留的標題）。
- **呼叫端責任**（CT）：任何非 0 一律視為「不支援 / 未設定」，不重試、不影響 Tower 啟動。
- `bat-scripts.log` 事件 `set-role`。

## 行為

1. **標題**：`<Agent 顯示名> · Tower`。Agent 顯示名的取法與 T0553 `externalTerminalTitle` 相同來源（renderer preset 名稱 `getAgentPreset` → registry 名稱 → 已知 CLI），依序取：分頁 `agentPreset` → `--agent` 提示 → 都沒有時用 `Terminal`（`Terminal · Tower`）。抽成唯一實作（例 `src/lib/` 內的純函式），不要在 consumer 內聯。
2. **使用者命名優先**（D147）：只有在分頁標題仍是 **BAT 為它產生的預設值**（UI 建立的 agent / shell 分頁的預設標題、`externalTerminalTitle` 的結果、T0553 前的舊外部預設格式）或**已經是 Tower 標題**（可重算，例如 agent 不同）時才套用；使用者改過名（`renameTerminal`）一律保留。請找出 BAT 所有產生預設標題的地方，定義一個判斷函式並有單元測試覆蓋每一種預設。
3. **持久化**：套用後 `save()`，標題隨 `workspace:save` 存進 window registry；BAT 重開後仍是 Tower 標題。detached 視窗的分頁照 `saveDetachedWorkspaceTerminals` 存進父 entry（語意不變）。是否另存 `role: 'tower'` 由你決定，若存需有序列化往返測試與舊資料相容。
4. **路由**：主行程 channel（例 `terminal:set-role`，只由 helper 經 RemoteServer 呼叫，列入 `proxied-channels-binding.test.ts` 的 REGISTRY_ONLY）→ 確認分頁存在 → 事件（例 `terminal:role-changed { id, role, agent? }`）送所有視窗，由持有該分頁的視窗套用（比照 T0535 `ownsTerminalForCloseRequest`）。
5. **結束後**：維持 Tower 標題，不偵測 agent 結束、不還原。
6. **遠端 headless**：同一 helper 指令。headless 的 channel 同實作；權杖：**tower 角色**可呼叫，且 `--terminal-id` 必須是自己（否則 `Forbidden`）；worker 角色 → `Forbidden: role-not-allowed`。事件列入 `PROXIED_EVENTS`，經 `RemoteConnectionRegistry` 送到該 profile 的視窗，renderer 沿用同一處理。更新 `helper-capability.ts` 角色表與其測試。

## 驗收條件

- [x] helper：`--set-role tower` 各 exit code、互斥參數、`--help` 說明、舊 BAT 的 `UNSUPPORTED`（單元測試，比照 `electron/__tests__/bat-terminal-close-worker.test.ts`）
- [x] 標題函式與「是否為預設標題」判斷的單元測試（每一種預設、使用者改名、已是 Tower 標題、無 agent）
- [x] store / 持久化測試（套用後 save、重開後仍在、detached）
- [x] headless：tower 權杖設定自己 PASS、設定別人 Forbidden、worker 權杖 Forbidden（比照 `headless-close-worker-e2e.test.ts`）
- [x] e2e（隔離實例，自訂 CLI 跑 node 腳本）：在分頁內執行 `--set-role tower` → 標題變 `<名稱> · Tower`；使用者改名後再執行 → 保留；重開後仍在
- [x] Worker 標題（T0553）、`--close-worker`、建立分頁行為不變（既有測試全綠）
- [x] `npm run test:unit` / `npm run typecheck` / `npm run typecheck:electron` / `npx vite build` 全過
- [x] CLAUDE.md 新增一節（契約、行為、遠端權杖、驗證檔），並更新「遠端 Tower 通知」權杖表

---

## 回報區

> 以下由 sub-session 填寫

### 完成狀態

**DONE** — 介面契約照原文實作，未偏離。

Landing Zone Check：**PASS**。C-0 `repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal`（REPO_ROOT `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）；C-1 工單在 REPO_ROOT 底下；C-3 `affects_files` 皆萬用字元或既有檔（`scripts/bat-terminal.mjs`、`CLAUDE.md` 存在）；C-2 無 `branch` 欄位。`BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）。`CT_MODE=yolo`、`CT_INTERACTIVE=0`。

### 產出摘要

**helper（`scripts/bat-terminal.mjs`）**
- 新增 `--set-role <role>`（只收 `tower`，trim + 不分大小寫）、`--terminal-id <id>`（預設 `BAT_TERMINAL_ID`）；`--agent` 在此模式為顯示名提示。
- 互斥：建立分頁參數（`--cwd` / `--workspace` / `--prompt` / `--skill` / `--workorder` / `--mode` / `--interactive` / `--no-interactive` / 位置參數）、`--notify-id`、`--close-worker`、`--delay-ms`；`--terminal-id` 無 `--set-role` 亦為用法錯誤。
- exit：0 / 3 NOT_FOUND / 1（USAGE、NOT_IN_BAT、CONNECT_FAILED、AUTH_FAILED、TIMEOUT、UNSUPPORTED、FORBIDDEN、INVALID_ARGS、ERROR）；stderr `set-role: <CODE>`；成功 stdout `✓ Tower role set: <id>`；`bat-scripts.log` 事件 `set-role`。`--help` 新增一節。
- `--close-worker` 行為與輸出不變（`<mode>: <CODE>` 改由共用 `modeTag` 印，字串相同；既有 21 個 close-worker helper 測試全綠）。

**主行程（本機 + headless 共用）**
- `electron/terminal-role.ts`（新）：`setTerminalRole` — 參數驗證 → `PtyManager.isAlive` → 送 `terminal:role-changed { id, role, ptyAgent?, ptyAgentName?, agent?, agentName? }`；`--agent` 經 `normalizeAgentAlias`，registry 不認得則丟棄（不拒絕）。主行程不判斷標題。
- `electron/handlers/terminal.ts`：`registerTerminalHandlers` 註冊 `terminal:set-role`（Electron 與 headless 同一處）。
- `electron/pty-manager.ts`：`getAgentPreset(id)`。
- `electron/remote/helper-capability.ts`：`terminal:set-role: ['tower']`，`terminalId` 必須是自己（`target-not-bound`），worker → `role-not-allowed`。
- `electron/remote/protocol.ts` `PROXIED_EVENTS` + `path-aware-channels.ts` PATH_FREE 分類加 `terminal:role-changed`；`preload.ts` / `electron.d.ts` `pty.onRoleChanged`。
- `proxied-channels-binding.test.ts` REGISTRY_ONLY、`headless-parity.test.ts` HELPER_ONLY 登記 `terminal:set-role`。

**renderer**
- `src/lib/tower-terminal-title.ts`（新，唯一實作）：`towerTerminalTitle` / `towerAgentLabel`（分頁 `agentPreset` → PTY agent → `--agent` 提示，各取 preset 名稱再取 registry 名稱，無則 `Terminal · Tower`）、`isTowerTitle`、`isDefaultTerminalTitle`。檔頭列出 BAT 所有產生預設標題的地方：`addTerminal`（preset 名 / `New Terminal`）、`switchTerminalApiVersion`、`WorkspaceView.handleAddAgent`（自訂 CLI registry 名）、`useRemoteToolInstall`（安裝分頁標題）、`externalTerminalTitle`（T0553，含 Worker 格式、命令檔名、`Terminal`）、T0553 前 `Remote: …` / `Remote Terminal`、還原的 `Terminal`、既有 Tower 標題。
- 規則認不出的 BAT 標題（命令檔名如 `node`、自訂 CLI 名、遠端工具安裝分頁）記在新欄位 `TerminalInstance.autoTitle`（save / load / detached adopt 往返；舊資料無此欄位 → 視為使用者命名、保留——安全方向）。只在規則認不出時才寫，既有資料形狀不變。
- `workspaceStore.setAutoTitle`（BAT 命名用；`WorkspaceView.handleAddAgent` 與 `useRemoteToolInstall` 由 `renameTerminal` 改用它）；`renameTerminal` = 使用者改名，清 `autoTitle`；`applyTerminalRole` → `applied` / `unchanged` / `kept` / `not-found`，套用後 `save()`。
- `App.tsx`：`onRoleChanged` 以 `ownsTerminalForCloseRequest`（與 close-requested 同一判斷，detached 視窗只管自己工作區）路由到持有分頁的視窗。
- 不另存 `role` 欄位：既有 `TerminalInstance.role` 是 supervisor 功能，未沿用；Tower 標題本身可由 `isTowerTitle` 辨識並重算。

**文件**：CLAUDE.md 新增「塔台分頁標題（T0562，D147）」一節，並更新「遠端 Tower 通知」權杖表 tower 列。

**新增測試檔**：`electron/__tests__/bat-terminal-set-role.test.ts`、`electron/__tests__/terminal-role.test.ts`、`electron/remote/__tests__/headless-set-role-e2e.test.ts`、`src/lib/__tests__/tower-terminal-title.test.ts`、`src/stores/__tests__/workspace-store.towerRole.test.ts`、`e2e/t0562-tower-tab-title.spec.ts`；修改 `helper-capability.test.ts`（角色表 + set-role 區塊）、`terminal-handlers.test.ts`（channel 數 4 → 5）。

**驗證**
| 項目 | 結果 |
|---|---|
| `npm run test:unit` | PASS：258 files / 4452 passed / 3 skipped（基線 253 / 4372） |
| `npm run typecheck` | PASS：exit 0 |
| `npm run typecheck:electron` | PASS：exit 0 |
| `npx vite build` | PASS |
| helper 單元（set-role 25 + close-worker 21） | PASS 46/46 |
| headless 真 node-pty（helper 在 PTY 內）：自己 PASS、`--terminal-id` 別人 `Forbidden: target-not-bound`、worker `Forbidden: role-not-allowed`、未知 `--agent` 丟棄 | PASS 5/5 |
| e2e `t0562-tower-tab-title.spec.ts`（隔離實例；分頁內執行 → `Claude CLI · Tower`；自訂 CLI 分頁 → `T0562 agent · Tower`；使用者命名保留；NOT_FOUND exit 3；reload 後仍在；改名後分頁內再執行 → 保留） | PASS（截圖人工檢視：三個縮圖標題正確，分頁內印出 `✓ Tower role set`） |
| e2e `t0553-worker-tab-title.spec.ts`（Worker 標題回歸） | PASS |

未跑：`e2e/t0535-close-worker.spec.ts` 等 close-worker e2e（helper 僅改診斷行的印法，字串不變，由 helper 單元測試覆蓋）；macOS / Linux 實機；遠端 WSL / SSH 實機（headless 以 in-process harness + 真 node-pty 驗證）。

### 互動紀錄

無（`CT_INTERACTIVE=0`，yolo）。

### Renew 歷程

無。

### 遭遇問題

1. 第一次全套 unit 有 2 個既有測試失敗，皆為本單刻意的行為變化：`terminal-handlers.test.ts` 斷言「恰好 4 個 terminal channel」（現加 `terminal:set-role`，已更新斷言）；`workspace-store.workerOwnership.test.ts` 的「T0537 前資料無新欄位」——原實作對所有重算的舊標題都寫 `autoTitle`，改為只在 `isDefaultTerminalTitle` 認不出時才寫，該測試不改即通過。
2. e2e 中 reload 後會出現 Terminal Server 的「恢復 session」對話框擋住點擊，spec 內點「恢復 session」後繼續（Tower 分頁 PTY 需存活以在分頁內再次執行）。
3. 已知限制：使用者把分頁改名成與預設相同的字串（例 `Claude CLI`）仍被視為預設而可能被取代；T0562 前就以 raw command 建立、標題為命令檔名（例 `node`）的分頁沒有 `autoTitle`，會被視為使用者命名而保留。
4. 工作樹另有非本單變更：`src/styles/settings.css`、`_ct-workorders/T0564-research-usage-limit-auto-continue.md`，未納入 commit。

### 回報時間

2026-10-16T14:57:22+0800

---

## 塔台收單（第六十七 session，2026-10-16T15:01:16+0800）

- ✅ **T0562 已確認 DONE**：commit `4faa93ab`（27 檔，皆在 affects_files 內）；介面契約照原文實作，未偏離 → CT-T013 可依原契約撰寫。
- 塔台聯合複驗 @ `4faa93ab`：`npm run test:unit` **258 files / 4452 passed / 3 skipped**；`npm run typecheck` = 0；`npm run typecheck:electron` = 0。
- 接受 Worker 記錄的已知限制：使用者把分頁改名成與預設相同的字串仍視為預設；T0562 前以 raw command 建立、標題為命令檔名的分頁沒有 `autoTitle`，視為使用者命名而保留（安全方向）。
- 未實機：遠端 WSL / SSH（headless in-process harness + 真 node-pty 已驗）、macOS / Linux；本機實機待 `0.6.1-pre.6` + CT-T013。
- PLAN-045 維持 IN_PROGRESS（待 CT-T013 與發版後實機）。
