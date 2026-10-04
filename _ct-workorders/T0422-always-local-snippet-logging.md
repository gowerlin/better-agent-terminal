---
schema_version: 1
schema_kind: workorder
id: T0422
title: "PLAN-036 P3 / J：snippet:*、settings:get-logging-info、settings:cleanup-logs 改列 always-local（ALWAYS_LOCAL_CHANNELS + parity / 分類表同步）"
type: implementation
status: DONE
repo: better-agent-terminal
project: PLAN-036
priority: P2
sizing: S
created_at: "2026-10-05T05:35:22+08:00"
started_at: "2026-10-05T05:45:03+08:00"
updated_at: "2026-10-05T05:48:03+08:00"
completed_at: "2026-10-05T05:48:03+08:00"
target_version: next
depends_on:
  - T0417
  - T0419
related:
  - "T0386 建議清單 J（回報區約 :262）；PLAN-036 P3"
  - "T0416（全分類守門）/ T0406（PROXIED_EVENTS 分類守門）"
  - "D134（本 session 排程表第 6 列）"
affects_files:
  - electron/main.ts
  - electron/remote/headless-channel-status.ts
  - electron/remote/path-aware-channels.ts
  - electron/remote/protocol.ts
  - electron/remote/headless-entry.ts
  - electron/handlers/claude.ts
  - electron/remote/__tests__/
  - electron/__tests__/
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **先確認語意**：以程式碼證據說明 always-local 對遠端 profile 視窗的實際效果（呼叫在本機 Electron 執行、不代理到 headless）。snippet 是**本機 DB 的使用者片段**、logging info / cleanup 是**本機 BAT 的 log**——確認這正是使用者在遠端視窗應該看到的行為（遠端視窗的設定頁「日誌」顯示本機 log 路徑）。若發現某個 channel 改 always-local 會讓遠端視窗功能變差，該 channel 不改並在回報區說明。"
  - "🔴 依賴 T0417（同改分類表，✅ `7609229`）與 T0419（同改 `electron/main.ts`，塔台 05:41 補）。開工前 `git log --oneline -5` 確認兩者皆已 commit。"
  - "🔴 **共用檔 hunk 隔離**：T0423 可能平行碰 `electron/main.ts` / `headless-entry.ts`。commit 前 `git diff <file>` 確認只含本單 hunk；混有他人未 commit 改動時不要 commit 該檔（`git commit --only <file>` 會提交整個檔案），等對方 commit 或回報塔台。"
  - "🔴 同工作樹有其他 Worker 平行。`electron/main.ts` 只改相關註冊段。**只跑 `npm run test:unit` + `npx tsc --noEmit`；不跑 `npx vite build` / `npm run test:e2e`**（L141）。"
  - "🔴 **禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）；`git commit --only`；不 push；不部署 WSL。"
---

# T0422 — J：always-local 改分類

## 背景

T0386 建議清單 J：`snippet:*`（better-sqlite3，本機 DB）、`settings:get-logging-info`、`settings:cleanup-logs` 目前列在 `PROXIED_CHANNELS` / `HEADLESS_UNSUPPORTED`（遠端視窗呼叫會打到 headless，回 unsupported），語意上應在本機執行 → 改進 `ALWAYS_LOCAL_CHANNELS`，parity 清單同步。T0401 已有前例（`claude:archive-*` 三個改 always-local）。

## 範圍

1. 語意確認（memory_overrides 第 1 條）
2. 移到 `ALWAYS_LOCAL_CHANNELS`（找出 SoT：`headless-channel-status.ts` / `main.ts` 綁定處），從 `HEADLESS_UNSUPPORTED` / `PROXIED_CHANNELS` / `PATH_FREE_CHANNELS` 等清單移除；比照 T0401 的 archive 三個 channel 做法
3. parity / 全分類守門測試更新；新增測試：遠端 profile 視窗呼叫這些 channel 時走本機 handler（比照既有 always-local 測試）
4. 回報區附 `HEADLESS_UNSUPPORTED` 計數前後

## 驗收條件

- [ ] 回報區附語意確認結論
- [ ] `npm run test:unit` 全綠（基線以 T0417 完成後為準）；`npx tsc --noEmit` ≤ 40
- [ ] PLAN-036 檔 P3 段補一行 J 完成註記（工單編號 + commit）

## Sub-session 執行指示
1. 讀本工單 + T0386 回報區 J 列 + T0401 回報區（archive always-local 做法）
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 實作 → 驗收
4. 填回報區；完成寫 **`DONE`**
5. `git commit --only` 實際改動檔 + 本工單 + PLAN-036；不 push
6. 依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

**DONE**（product commit `d800dea`）

Landing Zone：PASS —— C-0 `repo: better-agent-terminal` == `basename(REPO_ROOT)` `better-agent-terminal`；C-1 PASS；C-3 present（`electron/main.ts` 等皆存在）；無 `branch` 欄（C-2 N/A）。`BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）。`CT_MODE=yolo` / `CT_INTERACTIVE=0`。
依賴確認：`git log` 有 T0417 `7609229`、T0419 `038c98e`。開工時 T0423 已 commit（`22bc3d0` / `2457161`），`electron/main.ts` / `headless-entry.ts` 無他人未提交改動；本單最終也**未改**這兩檔。

### 語意確認結論（memory_overrides 第 1 條）

12 個 channel 全數改 always-local，無一保留。程式證據：

- **路由**：`electron/main.ts` `bindProxiedHandlersToIpc()` 對每個 `PROXIED_CHANNELS` 先判 `if (ALWAYS_LOCAL_CHANNELS.has(channel)) return invokeHandler(channel, args, windowId)`，在 remote 分支（`remoteClient.invoke`）之前 ⇒ 遠端 profile 視窗的呼叫在本機 Electron 執行，不送 headless。本機 handler 仍由 `registerHandler('snippet:*' / 'settings:get-logging-info' / 'settings:cleanup-logs', …)`（`main.ts` 約 :2205-2261）提供，不需改 `main.ts`。
- **snippet:\***：`electron/snippet-db.ts:45-46` 存於 `app.getPath('userData')/snippets.json`（工單寫 better-sqlite3，實為 JSON 檔；結論相同）——本機使用者片段。`getByWorkspace(workspaceId)` 用的 workspace id 來自 `workspace:load`（本就 ALWAYS_LOCAL，由本機 window registry 回）⇒ 與本機 snippet 庫一致。
- **settings:get-logging-info / cleanup-logs**：`SettingsPanel.tsx:328-334`「開啟日誌資料夾」以 `shell.openPath(loggingInfo.logsDir)` 開路徑，而 `shell:open-path` 是 `main.ts:2420` 的純 `ipcMain.handle`（從不代理）⇒ 代理時拿到的 server 路徑本來就無法在本機開啟。改 always-local 後「顯示的路徑 / 開資料夾 / 清理」三者都指向同一份本機 BAT log，語意一致；headless 端原本也只回 unsupported，遠端視窗功能只會變好。
- **對 Electron-host 遠端（非 headless）的行為差異**：以前遠端視窗會讀寫 host 那台的 snippets / logs，現在改讀本機。之前在遠端視窗建立、存在 host 端的 snippet 不會出現在遠端視窗（未搬遷資料）。判斷：snippet 是使用者個人文字片段，與 T0386 §1 B 的 always-local 建議一致，且 headless 本來就沒有，不視為功能變差；列為殘留風險。

### 產出摘要

`d800dea` 改動檔：
- `electron/remote/headless-channel-status.ts`：12 個 channel 從 `HEADLESS_UNSUPPORTED`（P3）移入 `ALWAYS_LOCAL_CHANNELS`（比照 T0401 archive 三個的寫法，附來源註解）
- `electron/remote/path-aware-channels.ts`：`PATH_FREE_CHANNELS` 理由加 `ALWAYS_LOCAL (never proxied)` 前綴（比照 archive / workspace）；`settings:get-logging-info` 移出 `SERVER_PATH_RESULT_CHANNELS`（不再回 server 路徑）
- `electron/remote/__tests__/path-aware-channels-coverage.test.ts`：同步移除 server-path 樣本
- `electron/remote/__tests__/headless-always-local.test.ts`（新）：12 個 channel 為 ALWAYS_LOCAL + 仍在 `PROXIED_CHANNELS`（IPC 綁定）+ 不在 `HEADLESS_UNSUPPORTED`；`main.ts` 有本機 `registerHandler`；`bindProxiedHandlersToIpc` 的 ALWAYS_LOCAL 短路在 `remoteClient.invoke` 之前；path 表理由與非 server-path；headless harness 實際 invoke 皆回 `No handler for channel: <channel>`

未改：`protocol.ts`（channel 仍需在 `PROXIED_CHANNELS` 才會被 `bindProxiedHandlersToIpc` 綁到 IPC，比照 T0401）、`main.ts`、`headless-entry.ts`、`handlers/claude.ts`（無需改動）。

**`HEADLESS_UNSUPPORTED` 計數**：前 18（P1 2 / P3 16）→ 後 **6**（P1 2 / P3 4：`terminal:create-with-command` / `create-agent-command` / `notify` / `keypress`）。`ALWAYS_LOCAL_CHANNELS` 5 → 17。

PLAN-036 新增「P3 進度」段，記 J DONE（T0422 / `d800dea`）。

### 驗收

| 閘門 | 結果 | 證據 |
|---|---|---|
| 語意確認 | PASS | 見上節 |
| 目標測試 | PASS | parity / path-aware coverage / proxied-binding / headless-claude / 新測試：5 files、197 tests 全綠 |
| `npm run test:unit` | PASS | 116 files；1899 passed / 1 skipped（stderr 的 `No such remote 'origin'` 為既有測試雜訊，不影響結果） |
| `npx tsc --noEmit` | PASS | 40 errors（≤ 40）；本單 3 個改動檔 + 新測試 0 個 |
| vite build / e2e | 未跑 | 依 memory_overrides 第 4 條刻意不跑 |
| 實機（遠端 profile 視窗開設定頁「日誌」/ Snippet 面板） | 未做 | 需新 build，交使用者實機 |

### 遭遇問題

- 第一次寫 `PATH_FREE_CHANNELS` 理由時，字串內的撇號跳脫錯誤造成語法錯誤，已改寫措辭修正，未進 commit。
- 工作樹有其他 Worker 的未提交改動（`electron/handlers/pty.ts`、`electron/pty-manager.ts`、`src/types/index.ts`、其他工單、`_tower-state.md`），皆未觸碰；以 `git commit --only` 精準提交。

### 殘留風險 / 後續

- Electron-host 遠端模式下，過去存在 host 端的 snippet 不再出現在遠端視窗（無資料搬遷）。若使用者在意，可另開單評估搬遷或唯讀合併。
- `HEADLESS_UNSUPPORTED` 剩 P3 / K 的 `terminal:*` 4 個 + codex 控制 2 個。

### 回報時間

2026-10-05T05:48:03+08:00
