---
schema_version: 1
schema_kind: workorder
id: T0814
title: "PLAN-058 W1：Claude 面板前置修正——ELECTRON_RUN_AS_NODE 不寫全域 env、關分頁時關閉 session、query 結束清 queryInstance、command_lifecycle 日誌降噪"
type: implementation
status: DONE
repo: better-agent-terminal
project: maintenance
priority: P3
sizing: S
created_at: "2026-11-03T21:31:40+0800"
started_at: "2026-11-03T21:33:37+0800"
updated_at: "2026-11-03T21:45:52+0800"
completed_at: "2026-11-03T21:45:52+0800"
session_ids:
  - "6181aa61-794d-4f97-9024-86752be97778"
depends_on: []
related:
  - "PLAN-058；D259；T0813 回報區〈1〉現況盤點（A7 / A8）、〈6〉W1 草案；BUG-038 / T0161（ELECTRON_RUN_AS_NODE）；PLAN-041 / T0535（`closeTerminalNow`、`--close-worker`）；CLAUDE.md「Worker 分頁回收」「Electron Runtime」「Sub-agent / Active Tasks Tracking」節"
affects_files:
  - electron/claude-agent-manager.ts
  - electron/handlers/claude.ts
  - electron/preload.ts
  - src/types/electron.d.ts
  - electron/remote/protocol.ts
  - electron/remote/path-aware-channels.ts
  - src/stores/workspace-store.ts
  - src/stores/__tests__/workspace-store.closeTerminalNow.test.ts
  - "electron/__tests__/**（本單新增 / 修改的測試）"
  - "docs/agent-guide/claude-agent-sdk-cli.md（只在需要記錄新 IPC / 行為時）"
  - _ct-workorders/T0814-claude-panel-prereq-fixes.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 範圍只有四項（T0813〈6〉W1）：① `ELECTRON_RUN_AS_NODE=1` 改經 SDK spawn 的 `options.env` 傳入，不再在 query 期間寫進全域 `process.env`（現行 `claude-agent-manager.ts` 約 `:973` 設、`:1219` 刪）；② 新增 `claude:dispose-session`（關閉 query、`close()`、移出 session map），`closeTerminalNow`（`src/stores/workspace-store.ts`）改呼叫它；⏻ 重啟維持 `stopSession`＋`startSession`；③ query 結束時清 `queryInstance`（之後的 `setModel` / `accountInfo` 不再打到已結束的 query）；④ `command_lifecycle` 的 `[claude:msg]` 日誌降噪（不刪資訊，改成摘要或 debug 等級）。不改主回合中送出的行為（那是 T0815 / W0）。"
  - "🔴 不回歸：PTY env 仍剔除 `ELECTRON_RUN_AS_NODE`（BUG-038，`pty-manager.ts`）；`--close-worker` 的關閉路徑與 exit code 不變（只換 IPC），✕ 也走 `closeTerminalNow`；`workspace-store.closeTerminalNow.test.ts` 的 T0535 對照與 source guard 照規則更新、不刪；遠端：新 channel 經 `PROXIED_CHANNELS` / path-aware 設定，headless 同一個 `ClaudeAgentManager`；Agent SDK 找不到 node 時的 Electron-as-node fallback 仍可用（spawn env 有該變數、全域沒有）；T0759 / T0769 的背景子代理與排隊行為不變。"
  - "🔴 不改 `electron/pty-manager.ts`、`CLAUDE.md`（T0811 進行中、同一 checkout；需要改 CLAUDE.md 時寫在回報區〈後續〉由塔台處理）。"
  - "🔴 驗證：單元（fallback 時全域 env 前後不變、spawn env 有該變數；關分頁後 session 不在 map、`close()` 被呼叫；query 結束後 `queryInstance` 為空、`setModel` 不呼叫已結束的 query）＋突變檢查；`npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npm run test:unit`、`npm run test:legacy`、`npx vite build`；e2e 依影響挑跑（至少 `e2e/v072-pre7-claude-panel-ui.spec.ts`、`e2e/v072-pre6-claude-panel.spec.ts`，需先 `npx vite build`；跑不了寫原因）。"
  - "🔴 yolo：不得問使用者；問題依 ct-exec § Questions For Tower 問塔台。不發版、不 push。Git：只 commit 本單範圍（`git commit --only` 或明列路徑）。🔴 同一 checkout 有 T0811 的未提交修改（`electron/pty-manager.ts`、`CLAUDE.md`、docs 等），不得 commit、修改或還原它們。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。公開 repo（D176）。"
---

# T0814 — Claude 面板前置修正（PLAN-058 W1）

## 元資料

- **工單編號**：T0814
- **類型**：implementation
- **互動模式**：yolo（問題問塔台）
- **優先級**：P3
- **建立時間**：2026-11-03T21:31:40+0800
- **預估規模**：S

## 背景

T0813 盤點 Claude 面板現況時找到兩個現行就有的小風險：`ELECTRON_RUN_AS_NODE=1` 在 query 期間寫進主行程全域 `process.env`（這段期間主行程起的其他子程序都會拿到），以及關分頁只 `stopSession`、session 留在 map 不 `close()`。另外 query 結束後 `queryInstance` 沒有清，之後的 `setModel` / `accountInfo` 打到已結束的 query。D259：PLAN-058 範圍改為方案 D（T0815）＋本單 W1，本單先做。

## 範圍

見 memory_overrides 第 1 條四項。

## 不做

- 主回合中送出的行為（T0815）、常駐程序（方案 B，延後）、改 `pty-manager.ts` / `CLAUDE.md`、發版、push。

## 驗收

- [ ] 四項的實作說明（函式、IPC、遠端接線）
- [ ] 單元測試與突變檢查結果
- [ ] typecheck 0 / 0、unit、legacy、vite build
- [ ] e2e 結果（或跑不了的原因）
- [ ] 需要塔台補的 CLAUDE.md 內容（若有）

---

## 回報區

<!-- Worker 由此往下寫 -->

### 完成狀態

- **狀態**：DONE
- **完成時間**：2026-11-03T21:45:52+0800
- **產品 commit**：`fc22e04a`（fix: Claude panel prereqs … T0814, PLAN-058 W1）
- **session_id**：6181aa61-794d-4f97-9024-86752be97778

### 落點檢查

- **結果**：PASS
- C-0：frontmatter `repo` = `better-agent-terminal`、`basename(REPO_ROOT)` = `better-agent-terminal` → PASS（REPO_ROOT `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）
- C-1：工單在 REPO_ROOT 下 → PASS；C-3：抽查 `electron/claude-agent-manager.ts` 等皆存在（C-0 已 PASS，僅記錄）；C-2：工單無 `branch` 欄位，目前 `main`
- `CT_HOME` 未設定（非 worktree）；`CT_MODE=yolo`、`CT_INTERACTIVE=0`；`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）

### 四項實作說明

**① `ELECTRON_RUN_AS_NODE` 不寫全域 env**
- `sdkSpawnEnv(runtime, { electronRunAsNode })`（`electron/claude-agent-manager.ts`）：旗標為真時只把 `ELECTRON_RUN_AS_NODE=1` 加進 SDK spawn 的 `options.env`（SDK 文件：`options.env` 取代而非合併 `process.env`；函式本來就 spread `process.env`）。
- `runQuery`：移除 `process.env.ELECTRON_RUN_AS_NODE = '1'`（原 `:973`）與 finally 的 `delete`（原 `:1219`），改傳 `sdkSpawnEnv(resolvedRuntime, { electronRunAsNode: electronFallback })`；`executable` 的判斷不變。
- `forkSession`：同樣帶 `electronRunAsNode: isElectronFallback()`。原本 fallback 時它傳 Electron 為 `executable` 卻不帶該變數（只在剛好有 `runQuery` 執行中、全域 env 有值時才拿得到）；現在一致。`getSupportedModels` probe 不傳 `executable`，不變。
- 附帶效果：使用者原本就有的全域 `ELECTRON_RUN_AS_NODE` 值，T0814 前會在 fallback query 結束時被 `delete`；現在不碰（有測試）。
- PTY env 仍剔除（`pty-manager.ts` 未改）。

**② `claude:dispose-session`**
- `ClaudeAgentManager.disposeSession(id)`：清排隊（`clearMessageQueue`）→ abort → `queryInstance` 置空並 `close()` → `sessions.delete`、`sdkSessionIds.delete`、`clearRuntimeEventHistory`；記一行 `[Claude] session disposed …`。不碰 worktree（`cleanupWorktree` 另外呼叫，本來就不需要 session 在 map）。執行中的 `runQuery` 被 abort 後，finally 不再啟動排隊訊息（已清）、不動 `queryInstance`。
- handler（`electron/handlers/claude.ts`）：`sessionKinds` 為 `codex` → `codex()?.stopSession`（codex manager 沒有 dispose，維持原行為）；其餘 → `getClaudeManager()?.disposeSession`。
- preload `claude.disposeSession`、`src/types/electron.d.ts` 型別；遠端：`PROXIED_CHANNELS`（`electron/remote/protocol.ts`）、`PATH_FREE_CHANNELS`（`electron/remote/path-aware-channels.ts`，只帶 sessionId）。headless 經同一個 `registerClaudeHandlers` / `ClaudeAgentManager`，不需另接。
- `closeTerminalNow`（`src/stores/workspace-store.ts`）：整合 agent 分頁改 `disposeSession(id)`；reject（舊 bat-server：`No handler for channel: claude:dispose-session`）→ `stopSession(id)`（T0814 前行為）。✕ 與 `--close-worker` 都經這裡；`--close-worker` 的主行程路徑與 exit code 未改。⏻ 重啟（`WorkspaceView` `handleRestart`）仍是 `stopSession` + `startSession`，未改。

**③ query 結束清 `queryInstance`**
- `runQuery` finally：`session.queryInstance === generator`（本次的 query）時才清，避免「停止後立刻送新訊息、新 query 先設好、舊 finally 晚到」把新的清掉。
- 之後 `setModel` / `setPermissionMode` 只存值（下一個 query 生效，有測試）；`getContextUsage` → null；`stopTask` → false（query 結束時 `activeTasks` 本來就清空、執行中的工具已標 error）。
- ⚠️ 與工單字面的差異（不回歸考量）：SDK 0.3.316 的 `accountInfo()` / `supportedCommands()` / `supportedAgents()` 是 `await this.initialization` 的快取讀取，不對 CLI 送 request（`sdk.mjs` 原始碼）；T0813 說的「accountInfo 打到已結束的 query」實際上是讀快取。若 query 結束就回 null / []，AgentsPanel（每 3 s 重試直到有值）與 query 結束後才開的面板拿不到 agents / 指令清單 → 回歸。所以 query 結束時（且收過 `system/init`）以 `readQueryInit` 讀一次存進 `session.lastQueryInit`，到下一個 query 前照舊回這份資料；不保留 Query 物件本身。`restSession` / `disposeSession` 清掉它（`restSession` 原本就讓這三個回 null / []）。init 前就失敗的 query 不存（回 null / []）。

**④ `command_lifecycle` 日誌降噪**
- `commandLifecycleSummary`：`{ type: 'command_lifecycle', uuid, state }`（CLI 2.1.316 二進位內的形狀）與 `{ type: 'system', subtype: 'command_lifecycle', command_uuid, state }` 都認得 → `logger.debug('[claude:lifecycle] state=<state> uuid=<前 8 碼>')`，不再記 `[claude:msg]` 行；其他訊息的 `[claude:msg]` 不變。state 與 uuid 前 8 碼保留，只降成 debug 等級的一行摘要。

### 變更檔案

- `electron/claude-agent-manager.ts`、`electron/handlers/claude.ts`、`electron/preload.ts`、`src/types/electron.d.ts`、`electron/remote/protocol.ts`、`electron/remote/path-aware-channels.ts`、`src/stores/workspace-store.ts`
- 測試：`electron/__tests__/claude-panel-prereq-t0814.test.ts`（新增，22 項）、`src/stores/__tests__/workspace-store.closeTerminalNow.test.ts`（T0535 對照 `preT0535ConfirmClose` 保留；新增 `t0814Close` 對照，只把 `stopSession` 換成 `disposeSession`；新增 dispose / fallback 兩案；source guard 新增「⏻ 重啟仍 stop + start、WorkspaceView 不含 disposeSession」；原 guard 全保留）
- 文件：`docs/agent-guide/claude-agent-sdk-cli.md` 新增一節「Claude 面板：spawn env、關分頁、query 結束（T0814，PLAN-058 W1）」
- 未動：`electron/pty-manager.ts`、`CLAUDE.md`、T0811 的任何檔案

### 驗證

| 關卡 | 結果 |
|---|---|
| 新單元測試 `claude-panel-prereq-t0814.test.ts` + `workspace-store.closeTerminalNow.test.ts` | PASS（22 + 68 項） |
| 突變檢查（11 個，逐一改回原狀後跑上面兩檔） | 全部被抓到：M1 spawn env 不帶變數（2 fail）、M1b 寫全域 env（2）、M2 dispose 不 `close()`（1）、M2b dispose 不移出 map（2）、M3 finally 不清 `queryInstance`（4）、M3b 拿掉 generator 守衛（1；第一輪存活，補測後被抓到）、M3c 不存 init 快取（1）、M4 lifecycle 照記 `[claude:msg]`（1）、M5 store 仍 stopSession（18）、M5b store 不 fallback（1）、M6 handler codex 也 dispose（1）。每次跑完還原原檔，已以 grep 確認 |
| `npm run typecheck` | 0 |
| `npm run typecheck:electron` | 0 |
| `npm run test:unit` | PASS：399 files passed / 2 skipped；6999 tests passed / 37 skipped |
| `npm run test:legacy` | PASS：files 33 passed, 0 failed；tests 472 passed, 0 failed |
| `npx vite build` | PASS（exit 0） |
| e2e `e2e/v072-pre6-claude-panel.spec.ts` + `e2e/v072-pre7-claude-panel-ui.spec.ts`（build 後） | PASS：4 passed（50.7 s） |

- 驗證時 HEAD = `c926b3fb`＋工作樹修改；產品 commit `fc22e04a` 只比驗證內容多 docs 一節（純文件，不需重跑）。
- 未跑：`e2e/plan036-p0.spec.ts`（E1 列舉 claude channel 綁定；新 channel 的 `PROXIED_CHANNELS` / path-aware 覆蓋已由 unit 驗過）；Electron-as-node fallback 的實機（本機有 node，只能以 mock `node-resolver` 驗證 spawn env）。

### 不回歸核對

- PTY env 剔除 `ELECTRON_RUN_AS_NODE`（BUG-038）：`pty-manager.ts` 未改。
- `--close-worker`：主行程 `WorkerCloseScheduler` / exit code 未改，renderer 仍經 `closeTerminalNow`（只換 IPC）；✕ 同。
- T0535 對照與 source guard：保留，照規則加 T0814 對照。
- T0759 / T0769：`claude-background-agent.test.ts`、`claude-send-during-background-agent.test.ts` 在 full unit 內全過（注入條件 `isStreaming && mainTurnDone && queryInstance` 只在 query 執行中成立，query 結束才清，不受影響）。
- codex 整合分頁：關分頁仍 `stopSession`（handler 依 `sessionKinds` 分流）。

### 遭遇問題

- 第一輪突變檢查 M3b（拿掉 generator 守衛）存活：既有「排隊訊息」情境的 finally 先清再啟動下一個 query，碰不到守衛。補測「停止後、舊 query 結束前送出新訊息」後被抓到。
- `workspace-store.closeTerminalNow.test.ts` 的 fallback 案例中，`stopSession` 與 `workspace.save` 都是非同步、順序不固定；改為檢查「dispose 第一、三者都有」。

### 後續

- **CLAUDE.md**（塔台處理；本單不改）：建議在「Claude Agent SDK / CLI」節加一行：
  「Claude 面板（T0814 / PLAN-058 W1）：Electron-as-node 時 `ELECTRON_RUN_AS_NODE` 只經 `sdkSpawnEnv(runtime, { electronRunAsNode })` 進 spawn env，🔴 不得寫全域 `process.env`；關分頁 `closeTerminalNow` → `claude:dispose-session`（`disposeSession`：abort、`close()`、移出 map；舊 host reject → `stopSession`），⏻ 重啟維持 stop + start；`runQuery` 結束清 `queryInstance`（generator 守衛），account / 指令 / agents 讀 `lastQueryInit`；見 [docs](docs/agent-guide/claude-agent-sdk-cli.md)「Claude 面板：spawn env、關分頁、query 結束」。」
  「Electron Runtime」節的 BUG-038 行可補「T0814 起面板 query 不再寫全域 env」。
- T0815（方案 D）會用到 `command_lifecycle`：本單只做日誌摘要，未解析狀態。

### 互動紀錄

- 無（yolo，未向塔台提問；三個節點的塔台補充檢查都沒有新段落）。
