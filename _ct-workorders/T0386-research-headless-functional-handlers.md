---
schema_version: 1
schema_kind: workorder
id: T0386
title: "研究：headless bat-server 功能 handler 層（PLAN-036）—— Electron 解耦、共用 handler 架構、分階段拆單"
type: research
status: DONE
priority: P1
sizing: M
created_at: "2026-10-04T23:34:17+08:00"
updated_at: "2026-10-04T23:51:36+08:00"
started_at: "2026-10-04T23:36:44+08:00"
completed_at: "2026-10-04T23:51:36+08:00"
target_version: next
depends_on: []
related:
  - "PLAN-036（本研究服務的計劃）"
  - "T0385 回報區 A-2 差異表 / B-2 缺口 / C 交付路徑"
  - "BUG-094"
  - "_spec-remote-dev-support-2026-04.md §2.3（未落地的 handlers/ 設計）"
  - "PLAN-015（雙 render path 共用 helper，同類『雙實作漂移』問題）"
affects_files: []
interaction:
  mode_hint: on
  interactive: true
  intervention_type: context-dependent
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **研究工單，不改產品程式碼、不 commit 本工單檔以外任何檔案**。PoC / 實驗腳本放 scratchpad，結束前清乾淨。"
  - "🔴 不得停止、重啟或改寫使用者 WSL 內的 `bat-server.service` / `~/.local/bat-server`（塔台 23:34 剛部署 T0385 JS 供使用者驗收）；不得 `wsl --shutdown` / `--terminate`。本機 headless 實驗用 scratchpad + 非 9876 / 9877 埠。"
  - "🔴 child_process 一律 `execFile` / `spawn` + array args，timeout 必設。禁用 shell-spawning exec API。"
  - "⚠️ T0387（BUG-093 SSH 精靈 tunnel）平行執行中，會改 `src/components/setup-wizard/` 與 SSH tunnel 相關檔；本研究唯讀，不受影響。"
---

# T0386 — 研究：headless 功能 handler 層

## 元資料

- **類型**：research
- **互動**：允許（每次最多 3 題，選項式）

## 背景

見 PLAN-036。一句話：遠端 profile 的伺服器端（headless bat-server）沒有任何功能 handler，WSL profile 只能開空視窗。要補齊，需讓 pty / claude / git / fs 等 manager 能在**沒有 Electron 的 plain node** 中執行，且最好與 Electron 主程式**共用同一份 handler 實作**。

## 已知資訊（T0385，請自行複核）

- `createHeadlessServer({ handlers })` 支援注入；T0385 新增 `electron/remote/headless-handlers.ts` 內建 handler
- Electron 端多數 proxied handler 以 `registerHandler(channel, fn)` 註冊於 `electron/main.ts`（例：`:3017-3027`），與 RemoteServer 共用 registry
- `ALWAYS_LOCAL_CHANNELS`：`workspace:save` / `workspace:load`；版面由 client 持有
- 輸出事件走 `broadcastHub`（headless 可共用）
- server bundle 已含 `@lydell/node-pty-<target>`、claude-code、agent-sdk、better-sqlite3（見 `scripts/build-server-bundle.mjs` externals）

## 研究目標

1. **channel 清單定案**：以 T0385 A-2 為底，完整列出遠端 profile 會 proxy 的 channel（`electron/preload.ts` / `PROXIED_CHANNELS` / renderer 呼叫點），分為「headless 必須提供」/「應改為 always-local」/「遠端不支援、UI 應隱藏或降級」三類
2. **Electron 耦合分析**：逐一列出 P0-P3 涉及的 manager / handler 使用了哪些 Electron API（`app.getPath`、`BrowserWindow`、`webContents.send`、`dialog`、`shell`、`safeStorage`…），以及各自的抽象方式（注入路徑 / broadcast / no-op）
3. **架構提案**：如何讓 Electron main 與 headless **共用 handler 註冊模組**（例如 `registerXxxHandlers(registry, deps)`），避免兩份實作漂移；與 `_spec-remote-dev-support` §2.3 原設計的異同；對既有 `electron/main.ts` 的改動面與回歸風險
4. **headless 環境語意**：設定來源（`settings:load` 已落 `<dataDir>/settings.json`）、shell 路徑（Linux 預設 shell 偵測）、`isPathAllowed` path sandbox 在遠端的定義、claude runtime（embedded vs 遠端系統 claude；`DISABLE_UPDATES` 等 env，見 CLAUDE.md）、auth 狀態（遠端 claude 登入）
5. **安全**：headless 一旦提供 `pty:create` 即等於遠端 shell —— 確認 token + TLS pinning + bind 介面（`127.0.0.1`）的現有防線足夠；列出需新增的限制（如有）
6. **驗證策略**：本機 headless harness（T0385 用的 esbuild + `BAT_SERVER_ENTRY` + wss 腳本）可否常態化為 test；T0385 C 節的本機部署工具缺口是否應在 Phase 1 一併補（local-tarball override / `fetch:baseline --skip` / dev deploy script）
7. **分階段拆單**：P0（終端：開分頁、輸入、resize、kill、restart、cwd）→ P1 → P2 → P3，每張估 sizing、affects_files、依賴；標出可平行與必須串行者
8. **與其他 PLAN 的關係**：PLAN-035 Phase 2/3 是否應等 PLAN-036 P0；PLAN-015；以及 T0385 觀察到的 `App.tsx` `remote.connect` 不帶 fingerprint 問題應歸哪裡

## 調查範圍

- `electron/main.ts`、`electron/pty-manager.ts`、`electron/claude-agent-manager.ts`、`electron/claude-runtime-router.ts`、`electron/remote/**`、`electron/preload.ts`、`scripts/bat-server.mjs`、`scripts/build-server-bundle.mjs`、`src/` 呼叫點
- `_ct-workorders/_spec-remote-dev-support-2026-04.md`、`_spec-server-bundle-distribution.md`、`docs/remote-dev-overview.md`
- 允許 scratchpad PoC：例如以 plain node 載入去 Electron 化的 PtyManager 雛形，在非 9876 / 9877 埠 headless 上 invoke `pty:create` 驗證可行性（驗完清乾淨）

## 互動規則

- 架構取捨（例如共用模組 vs headless 專用實作、P1 是否用遠端系統 claude）需使用者裁決時，以選項式提問，每次 ≤ 3 題
- 不確定處標「推測」並說明驗證方式

## 回報要求

- 每個研究目標一節，附證據（檔案:行號 / 指令輸出）
- 最後一節「建議工單清單」：表格（暫定標題 / 階段 / sizing / affects_files / 依賴 / 可否平行）
- 完成寫 **`DONE`**

## Sub-session 執行指示

1. 讀取本工單 + PLAN-036 + T0385 回報區
2. 填 `started_at`、`status: IN_PROGRESS`（**`date "+%Y-%m-%dT%H:%M:%S%z"` 取系統時間，禁止手打**，R-G001）
3. 研究 → 填回報區
4. commit 僅本工單檔（`git commit --only ...`）；`AGENTS.md` 若 dirty 不要碰
5. 依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 執行摘要

- **開始**：2026-10-04T23:36:44+08:00（Worker，`CT_MODE=on`、`CT_INTERACTIVE=1`）
- **落點檢查**：WARN —— C-0 無法判定（frontmatter **無 `repo` 欄位**；`basename(REPO_ROOT)` = `better-agent-terminal`）；C-1 PASS（工單在 REPO_ROOT 下）；C-3 不適用（`affects_files: []`）；C-2 不適用（無 `branch` 欄位，HEAD=`main`）。`BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）
- **結果**：DONE。8 個研究目標皆有結論；架構三項取捨經使用者裁決（見「互動紀錄」）；含 Windows + WSL 雙平台 PoC 證實「既有 `PtyManager` 可在 plain node headless 上運作」；最後一節為建議工單清單（11 張 + 3 個獨立 BUG 候選）
- **方法**：主 session 讀 `electron/remote/**`、`scripts/bat-server.mjs`、`scripts/build-server-bundle.mjs`、`electron/main.ts` 路由段、`pty-manager.ts`、`path-guard.ts`、`claude-runtime-router.ts`、spec §2/§3/§5.4/C-4；兩個 Explore sub-agent 平行做「channel 全盤點」與「Electron 耦合逐模組盤點」，主 session 抽查關鍵結論（`claude:abort-session`、`getWindowsForProfile`、`snippet-db.ts:45`、embedded binary 檔名）後採信

### 互動紀錄（Q/A，選項式，一輪 3 題）

| # | 問題 | 使用者選擇 |
|---|---|---|
| Q1 | headless 與 Electron main 如何共用 handler | **共用註冊模組 + DI（建議）**（否決：過渡期 electron shim；headless 專用實作） |
| Q2 | headless `fs:*` path sandbox 白名單來源 | **client 推送 workspace roots（建議）**（否決：固定遠端 `$HOME`；headless 停用 sandbox） |
| Q3 | P1 Agent 在遠端用哪個 claude | **沿用遠端 settings 的 runtime router（建議）**（否決：只用 bundle embedded；P1 一併做登入 UX） |

### 1. channel 清單定案

**路由機制（複核 T0385）**：

- 代理是**明確白名單** `PROXIED_CHANNELS`（`electron/remote/protocol.ts:33-74`，**105 個**），不是「registry 內有就代理」。`bindProxiedHandlersToIpc()`（`electron/main.ts:3059-3089`）只為白名單 channel 綁 `ipcMain.handle`；`ALWAYS_LOCAL_CHANNELS = {workspace:save, workspace:load}`（`main.ts:3055-3057`）短路本機 ⇒ **實際代理 103 個**
- 判定條件：sender window 的 profile `type === 'remote'` **且** 等於 `remoteClientProfileId` **且** `remoteClient.isConnected`（`main.ts:3069-3086`），否則**靜默走本機 handler**
- headless 端 `RemoteServer` 對任何已註冊 channel 都放行，`invokeHandler(frame.channel, args)` **不帶 windowId**（`electron/remote/remote-server.ts:371-377`）；事件經 `broadcastHub` → `PROXIED_EVENTS` 過濾（`remote-server.ts:402-418`、`protocol.ts:77-88`）→ client 端再過濾、翻譯路徑、只送該 profile 的視窗（`remote-client.ts:350-362`、`main.ts:804`）
- 現況 headless 只實作 8 / 105（`headless-handlers.ts`：`profile:*` 6 + `settings:load/save`）

**三分類**（共 105；群組計數：pty 6、terminal 4、claude 40、codex 2、worktree 5、workspace 2、settings 5、github 7、git 7、git-scaffold 3、fs 7、image 1、snippet 10、profile 6）：

| 類別 | channel | 理由 / 階段 |
|---|---|---|
| **A. headless 必須提供** | `pty:*`（6）、`settings:get-shell-path` | P0 |
| | `claude:*` 中 session / 模型 / 權限 / 列表 / resume / fork / stop-task / rest / wake / context / meta / worktree-status / cleanup-worktree / scan-skills / scan-star-commands / get-statusline-extras / get-cli-path / detectRuntime / auth-status / auth-logout（約 33） | P1（遠端 `~/.claude`、遠端 claude CLI） |
| | `worktree:*`（5）、`git:*`（7）、`git-scaffold:*`（3）、`github:*`（7） | P2（全是遠端 repo 上的 child_process） |
| | `fs:*`（7）、`image:read-as-data-url` | P2（+ headless path-guard） |
| | `profile:*`（6）、`settings:load` / `settings:save` | ✅ T0385 已補（profile 為 stub 語意） |
| | `terminal:create-with-command` / `terminal:create-agent-command` / `terminal:notify` | P3（遠端終端內的 `bat-notify` / `bat-terminal` 會連回 headless，見 §4） |
| **B. 應改為 always-local**（建議，需塔台確認） | `workspace:save` / `workspace:load` | 已是 |
| | `settings:get-logging-info` / `settings:cleanup-logs` | 指的是使用者面前這台 BAT 的 log；代理到遠端拿到的是 server 的 log 目錄，語意錯 |
| | `snippet:*`（10） | 個人 snippet 庫跟著使用者走，不跟著 server；`snippet-db.ts:45-46` 存 `userData/snippets.json`（**是 JSON，不是 better-sqlite3**——PLAN-036 P3 列的難點不成立）。改 local 後 P3 snippet 工作歸零 |
| | `claude:archive-messages` / `claude:load-archived` / `claude:clear-archive` | 是 renderer 訊息溢出的本機快取（`main.ts:1962` `userData/message-archives`），與 server 無關；改 local 縮小 P1 面 |
| **C. 遠端不支援，UI 隱藏 / 降級** | `claude:set-codex-sandbox-mode` / `claude:set-codex-approval-policy` 與 codex preset | server bundle 不含 codex（`build-server-bundle.mjs:99-122` externals / 套件清單無 codex） |
| | `claude:auth-login` / `claude:account-list` / `claude:account-import-current` / `claude:account-switch` / `claude:rewind-to-prompt` | 本機也是 stub（`main.ts:2404-2407`、`2628`）；headless 回同樣 stub 即可 |
| | `terminal:keypress` | 依賴 renderer DOM keydown 廣播（`main.ts:2041-2096`），遠端無意義 |

**事件面缺口**：`claude:turn-end`（Codex，`codex-agent-manager.ts:1317` 等）、`claude:runtime-degraded` / `claude:runtime-warning`（`claude-agent-manager.ts:297/308`）**不在** `PROXIED_EVENTS` ⇒ 遠端收不到；`terminal:notified` 在白名單但 Electron 端只走 `webContents.send`、不經 `broadcastHub`（`main.ts:2019`）。P1 / P3 各自補。

**順帶發現的本機既有 bug（非 PLAN-036 範圍，建議另開 BUG）**：`claude:abort-session` 已 `registerHandler`（`main.ts:2300`）但**不在 `PROXIED_CHANNELS`** ⇒ 沒有任何 `ipcMain.handle` 綁定；renderer 仍呼叫（`preload.ts:148`；`ClaudeAgentPanel.tsx:1302/1475`、`CodexAgentPanel.tsx:1560/1848`）⇒ **本機與遠端的 abort 都會 `No handler registered`**。

其他路由觀察（記錄，不在本 PLAN 修）：全域只有一個 `remoteClient`（`main.ts:449-456`），兩個不同遠端 profile 視窗同時開時，非當前綁定者**靜默走本機**（例如 `pty:create` 開出本機 shell）；detached workspace 視窗 `windowId = null`（`main.ts:819-824`）同樣靜默走本機；`supervisor:*`（`main.ts:3902-3916`）用本機 ptyManager，對遠端終端無效。

### 2. Electron 耦合分析（P0-P3）

| 模組 | 耦合 | Electron API（file:line） | 抽象方式 |
|---|---|---|---|
| `pty-manager.ts` | 重（但量小） | `import { app, BrowserWindow }`（:3）；`app.isPackaged` + `process.resourcesPath`（:42-44 `resolveHelperDir`）；`app.getPath('userData')`（:814，terminal-server 孤兒清理）；`getWindows` + `webContents.send`（:60/:94/:286-294）；**經 `claude-runtime-router` 間接**（:10/:55） | ctor 改 `{ emit, dataDir, helperDir }`；`emit` 預設 = webContents + broadcastHub，headless = broadcastHub only |
| `claude-runtime-router.ts` | 輕（2 處，但被 pty / claude / main 傳遞依賴） | `import { app }`（:19）；embedded 路徑（:82-107）；`getRuntimeSettingsSnapshot` 讀 `userData/settings.json`（:121-137） | `configureRuntimeRouter({ dataDir, resolveEmbeddedClaudePath })`；既有 DI seam `ResolveClaudeRuntimeDeps`（:160-170）可沿用。**先做它**——解開 pty-manager 與 `resolve-claude-base-command.ts` |
| `claude-agent-manager.ts` | 重 | `import { BrowserWindow, Notification, app }`（:1）；embedded 路徑第二份副本（:107-134）；`webContents.send`（:264-271）；`Notification`（:321/:344-361）；讀 settings 通知欄位（:324-328）；`win.isFocused/show/focus`（:335/:352-356） | 注入 `{ emit, notifier, getSettings, resolveEmbeddedClaudePath }`；headless notifier = no-op |
| `snippet-db.ts` | 輕但**import 即執行** | `export const snippetDb = new SnippetDatabase()`（:189）在 import 時呼叫 `app.getPath`（:45） | 若採 §1 B 類改 always-local，**不需動** |
| `image-utils.ts` | 輕 | lazy `require('electron').nativeImage`（:24-49，無 try/catch） | 只被 codex 用（`codex-agent-manager.ts:204`）；codex 遠端不支援 ⇒ 不需動 |
| `codex-agent-manager.ts` | 輕 | type-only BrowserWindow；經 image-utils 間接 | 遠端不支援，不需動 |
| `terminal-command-handlers.ts` | 無（已 DI，`:57-74`） | `terminal:created-externally` 只走 `getAllWindows`（:176-187） | headless 傳 `getAllWindows: () => []` + dataDir settings reader |
| `main.ts` 內 inline handler | — | `fs:watch` 直接 `BrowserWindow.getAllWindows()`（:2897-2902/:2927-2932）；`settings:save` 呼叫 `buildMenu()`、`logger.setConfig`（:2137-2157）；`claude:scan-*` / `get-statusline-extras` 用 `app.getPath('home')`；`claude:detectRuntime` 第三份 embedded 路徑副本（:2259-2266） | 搬進共用模組時以 deps 取代（`emit`、`homeDir`、`onSettingsSaved` hook） |
| 無耦合可直接用 | — | `logger.ts`（`init` 不呼叫即 console-only）、`claude-resolver.ts`、`shell-path-resolver.ts`、`worktree-manager.ts`、`git/git-ipc.ts`、`gh-resolver.ts`、`node-resolver.ts`、`path-guard.ts`、`agent-runtime/*`、`remote/*`（`remote-server.ts:128-148`、`secrets.ts:90-97` 的 electron 為 lazy + try/catch） | — |

**關鍵陷阱**：在 repo 內 `require('electron')` 回傳的是 electron binary 路徑字串（`app` 為 `undefined`），import 不會炸、**呼叫才炸**；但在 server bundle 裡 `electron` 為 external 且 `node_modules` 無此套件（`build-server-bundle.mjs:99-100`），**import 當下就 `MODULE_NOT_FOUND`**。⇒ 任何新進 headless 的模組只要頂層 import 了 electron（含傳遞），bat-server 直接啟動失敗。必須有 bundle 層守門（見 §6）。

**PoC 證據（scratchpad，已清除）**：以 esbuild 把 `electron` alias 成 shim（`app.isPackaged=false`、`app.getPath('userData')=dataDir`），bundle `headless-entry.ts` + 既有 `PtyManager`，於 `createHeadlessServer({ handlers })` 註冊 `pty:create/write/resize/get-cwd/kill`，wss 客戶端實測：

| 平台 | 環境 | 結果 |
|---|---|---|
| Windows | node v24.21.0、repo `@lydell/node-pty-win32-x64`、埠 19886 | `auth OK platform=win32`；`pty:create → true`；`pty:write → {"ok":true}`；`pty:output` 含 marker；`pty:get-cwd` 回 cwd；`pty:kill → true`；收到 `pty:exit ["poc-term-1",0]` |
| Linux（WSL Ubuntu-24.04） | **WSL 內既有 bundle 的** `~/.local/bat-server/bin/node`（v24.21.0）+ `node_modules/@lydell/node-pty-linux-x64`（`NODE_PATH` 唯讀引用）、`/tmp/t0386-poc`、埠 19887 | `auth OK platform=linux`；`pty:create → true`；`pty:get-cwd → "/tmp"`；輸出含 marker；`pty:kill` + `pty:exit` 正常 |

兩次對照 `settings:get-shell-path → No handler for channel`（預期）。驗完：PoC 行程結束、19886/19887 無 LISTEN、`/tmp/t0386-poc` 與 scratchpad 已刪；`systemctl --user is-active bat-server` = `active`（**未停止 / 重啟 / 改寫** `bat-server.service` 與 `~/.local/bat-server`，未 `wsl --shutdown`）。

⇒ 結論：**PtyManager 的 Electron 依賴只有 4 個接點，搬到 headless 的技術風險低**；node-pty 在 bundle 的 node 24 下可直接載入。shim 法雖可行，依使用者裁決 Q1 **不採用**為正式方案（只作為可行性證據）。

### 3. 架構提案（使用者裁決：共用註冊模組 + DI）

**形態**：

```
electron/handlers/                       # spec §2.3 規劃但從未落地的目錄，名稱沿用
  types.ts        # HandlerRegistrar = (channel, fn) => void；HostDeps 介面
  pty.ts          # registerPtyHandlers(register, deps)      ← pty:* + settings:get-shell-path
  claude.ts       # registerClaudeHandlers(register, deps)   ← claude:*（含 worktree:*?見工單）
  git.ts          # registerGitHandlers(register, deps)      ← git:* / github:* / worktree:*（git-scaffold 已是 git/git-ipc.ts）
  fs.ts           # registerFsHandlers(register, deps)       ← fs:* / image:read-as-data-url
  terminal.ts     # registerTerminalHandlers(...)            ← terminal:*（包既有 terminal-command-handlers.ts）
```

`HostDeps`（兩端各自組裝）：`emit(channel, ...args)`、`dataDir`、`homeDir`、`helperDir?`、`getSettings()`、`notifier`、`onSettingsSaved?`（Electron = `buildMenu` + `logger.setConfig`；headless = 無）、`pathGuard`（roots 來源不同，見 §4）。

- Electron main：`registerProxiedHandlers()`（`main.ts:1961-3046`，約 1,080 行、106 個 registration）**依領域逐步**改為呼叫 `registerXxxHandlers(registerHandler, electronDeps)`；`bindProxiedHandlersToIpc()` 不動
- headless：`createHeadlessServer` 內建清單由 `createHeadlessDefaultHandlers`（T0385）擴充為呼叫同一批 `registerXxxHandlers(registerHandler, headlessDeps)`
- **防漂移守門**（P0 第一張就建）：
  1. **channel parity test**：對 `PROXIED_CHANNELS` 每個 channel，斷言 headless registry `hasHandler` **或**列在明確的 `HEADLESS_UNSUPPORTED` / `ALWAYS_LOCAL_CHANNELS` 清單 ⇒ 日後在 `PROXIED_CHANNELS` 加 channel 卻沒補 headless，CI 紅
  2. **electron-free guard**：以 esbuild 打包 `server-entry.ts`（同 `build-server-bundle.mjs` 設定），onResolve 攔 `electron` → 只允許 `remote-server.ts` / `secrets.ts` 兩個 lazy try/catch 點，其他來源即 fail；或在 vitest node 環境將 `electron` mock 成「任何屬性存取即 throw 的 Proxy」後跑 headless 整合測試
- **與 spec §2.3 異同**：同 —— handler 與 renderer / Electron 無關、server bundle 用同一份；異 —— spec 設想「`handlers/` 純 JS 目錄複製進 tarball」，實際 esbuild 從 `headless-entry.ts` 的 import 圖打包即可（現行 `server-entry.js` 已是單檔 bundle），`build-server-bundle.mjs:358-367` 的 `handlers/` 複製步驟應刪除或改為只放 README，避免再次「目錄不存在而靜默略過」的假象
- **改動面與回歸風險**：
  - 高風險點 = `PtyManager` 建構子改 DI（本機終端 / Terminal Server proxy / heartbeat recovery 全走它；`main.ts:975`、`:1336-1338`、`:1507-1510`）與 `ClaudeAgentManager`（`main.ts:977`）。對策：Electron 端提供 `createElectronPtyDeps()` 保持原行為、逐領域搬遷、每張單 `npm run test:unit` + `npx vite build` + 本機 smoke（開終端 / claude-cli preset / Agent 面板）
  - 中風險 = `settings:save` 的 `buildMenu()` 副作用，以 `onSettingsSaved` hook 保留
  - 低風險 = git / fs / worktree（純 child_process / fs，`git/git-ipc.ts` 已示範 `registerHandler` 外置模式，`main.ts:2665`）

### 4. headless 環境語意

| 面向 | 現況證據 | 建議語意 |
|---|---|---|
| 設定來源 | T0385：`<dataDir>/settings.json`（`headless-handlers.ts`）；router 讀 `app.getPath('userData')/settings.json`（`claude-runtime-router.ts:123`） | headless 統一以 `dataDir` 為 userData（router / agent-manager / terminal handlers 共用一個 `getSettings(dataDir)`）。⚠️ **推測**：`settings:load` 整份代理 ⇒ 遠端視窗的**外觀類設定（字型 / 主題 / status line）也來自遠端、首次為預設值**，使用者可能感覺「設定不見」。驗證方式：部署 T0385 JS 後開 WSL profile 觀察。若屬實，另案拆「client UI 設定 vs server runtime 設定」 |
| shell 路徑 | systemd user service 實測環境 `SHELL=/bin/bash`、`PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/usr/games:/usr/local/games:/snap/bin`（讀 `/proc/<MainPID>/environ`，唯讀）；`PtyManager.getDefaultShell` Linux：`$SHELL` → `/bin/bash` → `/bin/sh`，參數 `-l -i`（`pty-manager.ts:361-409`） | 終端走 login shell 會載入 `~/.profile` 等，PATH 正確；`settings:get-shell-path` 直接重用 `resolveShellPath(type, { platform: process.platform, env: process.env })`（`main.ts:2172-2183`，無耦合）。注意 `auto` 在 Linux 無 `$SHELL` 時 fallback `/bin/zsh`（`shell-path-resolver.ts`）與 PtyManager 的 `/bin/bash` 不一致——P0 順手對齊 |
| PTY 重連語意 | **direct 模式 `create()` 無冪等**（冪等只在 Terminal Server 模式，`pty-manager.ts:416`）；renderer reload / 重連會以相同 id 重送 `pty:create`（`pty-manager.ts:413-415` 註解 T0111）；且舊行程 exit 時 `instances.delete(id)` 會刪掉新 entry | **P0 必修**：direct 模式同 id 已存在即回 `true`（不重開）；client 斷線不 kill PTY（BAT 重開可接回）；斷線期間輸出靠 50 行 ring buffer（`:66-67`）回放——是否回放列為 P0 設計項。另需「孤兒 PTY」回收策略（例如無 client 連線超過 N 小時） |
| helper / env | `BAT_HELPER_DIR` 以 `app.isPackaged` 判斷（`pty-manager.ts:41-45`），bundle 內 `__dirname` 推出的路徑錯誤；`bat-notify.mjs` / `bat-terminal.mjs` 不在 server bundle | P0：headless 不注入 `BAT_HELPER_DIR`（或注入空值）；`BAT_REMOTE_PORT/TOKEN` **不要**注入 headless 自己的 token 到遠端 shell（遠端程序可讀 env）——P3 若要遠端 Tower 通知再設計 |
| path sandbox（裁決 Q2） | `path-guard.ts` 無耦合，但白名單來自本機 window registry（`main.ts:1185-1199` → `rebuildWorkspaceAllowlist`，`:1484` 啟動、`:2114` 每次 `workspace:save`）；headless 無 registry ⇒ 全拒 | 新增 proxied channel（暫名 `workspace:sync-roots`，path-aware `array-of-strings`）：client 在 remote 連線完成與每次 `workspace:save`（本機）後，把該視窗 workspace roots 經 PathTranslator 轉成 server 路徑推給 headless；headless 以 per-connection 集合取聯集 rebuild。未推送前 fs 全拒（fail-closed） |
| claude runtime（裁決 Q3） | bundle 內 claude 為 `node_modules/@anthropic-ai/claude-code/bin/claude`（POSIX wrapper，`build-server-bundle.mjs:333-351`；WSL 實測 `bin/` 只有 `claude`）；但三份 embedded resolver **一律找 `bin/claude.exe`**（`claude-runtime-router.ts:82-107`、`claude-agent-manager.ts:107-134`、`main.ts:2259-2266`；BUG-052 註解假設所有平台都有 `claude.exe`） | 每個 deployment 各自 router（spec §1.4 / C-4）。P1 必修：embedded resolver 合一並對 bundle 版型找 `bin/claude`（headless 由 deps 注入 `<installRoot>/node_modules/@anthropic-ai/claude-code/bin/claude`）。embedded spawn 注入 `DISABLE_AUTOUPDATER=1` + `DISABLE_UPDATES=1`（防 BUG-059 同型：自更新會 rename `~/.local/bat-server` 內的 binary）；system 模式不注入（CLAUDE.md T0372 規則）。system 偵測：service PATH 無 `~/.local/bin`，但 `claude-resolver.ts:156-164` 已 fallback 掃 `~/.local/bin`，可用 |
| auth | WSL 實測：無系統 claude（login PATH）、`~/.claude/.credentials.json` **不存在**；`claude:auth-login` 本機亦為 stub | P1：`claude:auth-status` 走遠端；未登入時 Agent 面板提示「開一個終端分頁執行 claude 登入」（P0 完成後才可行），提示中的指令用 `claude:get-cli-path` 回傳的遠端路徑 |
| profile | headless 無 profile store（T0385 A-3） | 維持 stub，不在 PLAN-036 擴充 |

### 5. 安全

`pty:create` 上線 = token 持有者取得遠端使用者 shell（Docker 則為 container root）。現有防線複核：

| 防線 | 證據 | 評估 |
|---|---|---|
| TLS + fingerprint pinning（TOFU） | `remote-server.ts` https + `FileCertificateProvider`；cert / token 檔 `mode: 0o600`（`certificate.ts:97-98`、`secrets.ts:165`） | 足夠 |
| token 驗證 + 暴力破解節流 | 5 次 / 60s → ban 10 分鐘（`remote-server.ts:60-62`、`:84-99`、`:304-311`）；auth 逾時；未認證 frame 即斷線（`:358-363`）；`maxPayload`（`:300`） | 足夠；建議加固：token 比對改 `crypto.timingSafeEqual`（現為 `===`，`:248-250`） |
| bind 介面 | headless 預設 `localhost`（`headless-entry.ts:127`）；WSL unit 不帶 `--bind-interface`（`write-systemd-unit.ts:104-115`）⇒ 127.0.0.1，經 WSL2 localhost forwarding；SSH 經 tunnel 到遠端 127.0.0.1 | WSL / SSH 足夠 |
| **Docker（缺口，推測）** | `docker-lifecycle.ts:75` `-p ${port}:9876` **未綁 host 127.0.0.1** ⇒ host 所有介面暴露；container 內 bat-server 不帶 `--bind-interface` ⇒ 綁 container 的 127.0.0.1（`Dockerfile:22` ENTRYPOINT），**推測** `-p` 轉發根本連不到；`Dockerfile:20` HEALTHCHECK 打 `/health` 但 `remote-server.ts` 無此路由（grep 無結果） | 需修（不阻擋 P0，但 Docker profile 一旦可用即是 LAN 上的 root shell）：host 端 `-p 127.0.0.1:${port}:9876`、container 內 `--bind-interface all`、補或移除 HEALTHCHECK。驗證方式：本機 `docker run` 後 `curl -k https://127.0.0.1:<port>` / 檢查 `docker inspect` health 狀態 |

需新增的限制：(1) headless registry 只註冊 parity 清單內的 channel（不暴露任何本機專屬能力）；(2) 遠端 shell env 不注入 server token（§4）；(3) fs 白名單 fail-closed（§4）；(4) `pty:create` 的 `shell` 參數來自 client，headless 端驗證為絕對路徑且存在（防把任意字串當執行檔）。

### 6. 驗證策略

- **可常態化**：T0385 / 本研究的 harness（in-process `createHeadlessServer` + `ws` 客戶端 + 真 node-pty）可直接寫成 vitest：檔頭 `// @vitest-environment node`（全域 env 為 jsdom，`vite.config.ts:15`），放 `electron/remote/__tests__/`（已在 include，`vite.config.ts:22`），用 port `0`、`mkdtemp` dataDir。內容：parity test、electron-free guard、`pty:create → write → output → kill → exit` 端到端、重送 `pty:create` 冪等、fs 白名單 fail-closed
- `tests/headless-server.test.ts`（tsx 腳本，不在 vitest include）建議併入上述 vitest，避免兩套
- **T0385 C 節部署工具缺口應在 Phase 1 一併補**（建議；P0 的實機驗收全靠它）：`scripts/dev-deploy-headless.mjs` —— 以 `build-server-bundle.mjs` 相同 esbuild 設定只產 JS，複製到指定 install root（WSL 目標用 `wsl.exe` + array args，**需 `--yes` 才覆寫並自動備份 `.bak`**，預設 dry-run），不重建 tarball；`fetch:baseline --skip` 與 local-tarball override 次要，可延後
- 證據分道：unit / 整合（vitest）→ `npx vite build` → 本機 headless smoke → WSL 實機（使用者）→ 安裝版（release 線，另案）

### 7. 分階段拆單

依賴骨架：**A（守門骨架）→ B（router + PtyManager DI）→ C（pty 上線）** 為 P0 串行主線；D（部署工具）可與 B 平行；P2 只依賴 A，可與 P1 平行；P1 依賴 B。詳見最後一節表格。

P0「可用」驗收定義（建議寫入 C 單）：WSL profile 開出視窗 → 預設終端出現 bash prompt → 輸入 / resize / kill / restart / cwd 正確 → 關閉 BAT 重開後同 id 終端不重複 spawn。

### 8. 與其他 PLAN 的關係

| 對象 | 建議 |
|---|---|
| PLAN-035 Phase 2 / 3 | 程式碼**無硬依賴**（PLAN-035 動 `src/components/setup-wizard/` 與 `electron/wsl-*`，PLAN-036 動 `electron/handlers/`、`electron/pty-manager.ts`、`electron/remote/headless-*`，檔案不重疊），可平行。但**價值依賴**：沒有 P0，裝得再自動 WSL profile 也只是空視窗 ⇒ 排程上建議 **PLAN-036 P0 優先**，PLAN-035 Phase 2 有餘力再平行；PLAN-035 的端到端實機驗收腳本應在 P0 後加入「開終端」一步 |
| PLAN-015 | 無依賴（renderer 雙 render path）。同為「雙實作漂移」反模式，PLAN-036 的 parity test 作法可回饋 PLAN-015 |
| `App.tsx` `remote.connect` 不帶 fingerprint（T0385 觀察） | **不歸 PLAN-036**：屬遠端信任鏈（PLAN-018 / T0182 TOFU）問題，影響所有遠端 profile，與 handler 無關 ⇒ 建議**獨立 BUG 單**（可與任何 Phase 平行；改 `src/App.tsx` initProfile 的 connect 呼叫帶上 profile `remoteFingerprint`，或改由 main 重用已 pin 驗證的 client） |
| `claude:abort-session` 未綁 IPC（§1） | 獨立 BUG（本機即壞；修法 = 加入 `PROXIED_CHANNELS` 並列入 parity） |
| Docker bind / `-p` 暴露 / HEALTHCHECK（§5） | 獨立 BUG（Docker 線），建議在 Docker profile 可用前修 |

### 建議工單清單

| # | 暫定標題 | 階段 | sizing | affects_files（主要） | 依賴 | 可否平行 |
|---|---|---|---|---|---|---|
| A | headless handler 共用骨架 + 防漂移守門（`electron/handlers/types.ts`、parity test、electron-free guard、vitest headless harness；刪 bundle `handlers/` 假複製） | P0 | M | `electron/handlers/types.ts`（新）、`electron/remote/headless-entry.ts`、`electron/remote/headless-handlers.ts`、`electron/remote/__tests__/headless-parity.test.ts`（新）、`electron/remote/__tests__/helpers/headless-harness.ts`（新）、`scripts/build-server-bundle.mjs`、`tests/headless-server.test.ts`（併入後移除） | — | 首張；與 D 平行 |
| B | 去 Electron 化：`claude-runtime-router` 設定注入 + embedded resolver 合一（含 bundle `bin/claude`）+ `PtyManager` DI（`emit` / `dataDir` / `helperDir`） | P0 | M | `electron/claude-runtime-router.ts`、`electron/pty-manager.ts`、`electron/main.ts`（建構點 :975 / :1336-1338 / :1507-1510）、`electron/__tests__/claude-runtime-router.test.ts`、`electron/__tests__/pty-manager-deps.test.ts`（新） | （A 的 types 可先行，弱依賴） | 與 A、D 平行（`main.ts` 小衝突需排序 merge） |
| C | `pty:*` + `settings:get-shell-path` 共用註冊並上線 headless；direct 模式 `pty:create` 冪等；斷線不 kill；headless env（不注入 helper dir / server token）；shell 參數驗證；shell `auto` fallback 對齊 | P0 | M | `electron/handlers/pty.ts`（新）、`electron/main.ts`（:1964-1976 / :2172-2183）、`electron/pty-manager.ts`、`electron/shell-path-resolver.ts`、`electron/remote/headless-entry.ts`、`electron/remote/__tests__/headless-pty.test.ts`（新） | A、B | 串行 |
| D | 本機 headless dev 部署工具（JS-only esbuild → install root；WSL 目標 dry-run 預設、`--yes` + `.bak`） | P0（工具） | S | `scripts/dev-deploy-headless.mjs`（新）、`package.json`（script）、`docs/remote-dev-overview.md` | — | 與 A、B 平行 |
| — | **P0 實機驗收閘門**（使用者，WSL；用 D 部署） | P0 | — | — | C、D | — |
| E | `ClaudeAgentManager` DI（`emit` / `notifier` / `getSettings` / embedded resolver） | P1 | M | `electron/claude-agent-manager.ts`、`electron/main.ts`（:977）、相關 tests | B | 與 G、H 平行 |
| F | `claude:*` 共用註冊並上線 headless；archive 三個改 always-local；codex / stub 類列 `HEADLESS_UNSUPPORTED` + UI 降級；`PROXIED_EVENTS` 補 `claude:turn-end`、`claude:runtime-degraded`、`claude:runtime-warning`；embedded 注入 `DISABLE_UPDATES` | P1 | L | `electron/handlers/claude.ts`（新）、`electron/main.ts`（:2198-2660）、`electron/remote/protocol.ts`、`electron/remote/headless-entry.ts`、`src/components/ClaudeAgentPanel.tsx`（降級 UI）、tests | E | 串行（接 E） |
| G | 遠端 claude 登入引導（`auth-status` 未登入 → 提示在終端分頁執行登入；i18n） | P1 | S | `src/components/ClaudeAgentPanel.tsx`、`src/locales/*` | C、F | 串行（接 F） |
| H | `git:*` / `git-scaffold:*` / `github:*` / `worktree:*` 共用註冊並上線 headless | P2 | M | `electron/handlers/git.ts`（新）、`electron/git/git-ipc.ts`、`electron/main.ts`（:2314-2340 / :2665-2880）、`electron/remote/headless-entry.ts`、tests | A | 與 E/F 平行 |
| I | `fs:*` / `image:read-as-data-url` 上線 headless + `workspace:sync-roots`（client 推送轉換後 roots，fail-closed） | P2 | M | `electron/handlers/fs.ts`（新）、`electron/main.ts`（:2885-3020 + remote connect / `workspace:save` 後推送）、`electron/remote/protocol.ts`、`electron/remote/path-aware-channels.ts`、`electron/path-guard.ts`、tests | A | 與 E/F/H 平行（`protocol.ts` 與 F 需排序 merge） |
| J | always-local 改分類：`snippet:*`、`settings:get-logging-info`、`settings:cleanup-logs`（→ `ALWAYS_LOCAL_CHANNELS`，parity 清單同步） | P3 | S | `electron/main.ts`（:3055-3057）、parity test | A | 可平行 |
| K | 遠端 Tower 通知：headless `terminal:*`（`create-with-command` / `create-agent-command` / `notify`）+ `terminal:notified` 走 broadcastHub；遠端 shell 的 helper / token 注入設計 | P3 | M | `electron/handlers/terminal.ts`（新）、`electron/terminal-command-handlers.ts`、`electron/main.ts`（:1978-2040）、`scripts/build-server-bundle.mjs`（是否帶 helper） | C | 可與 P1/P2 平行 |

獨立 BUG 候選（不屬 PLAN-036，可隨時平行）：

| 暫定標題 | sizing | affects_files |
|---|---|---|
| `claude:abort-session` 未列入 `PROXIED_CHANNELS` ⇒ 本機 / 遠端 abort 皆無 IPC handler | S | `electron/remote/protocol.ts` |
| `App.tsx` initProfile `remote.connect` 不帶 fingerprint，取代已 pin 驗證的 client | S | `src/App.tsx`、`electron/main.ts`（`remote:connect` :3256） |
| Docker：`-p` 未綁 127.0.0.1、container 內未 `--bind-interface all`（推測連不上）、HEALTHCHECK `/health` 無路由 | S-M | `electron/docker-lifecycle.ts`、`docker/Dockerfile`、`electron/remote/remote-server.ts` |

### 偏差 / 風險

- **工單狀態被外部還原**：23:36:44 已將 frontmatter 改為 `IN_PROGRESS` + `started_at`，但塔台 commit `d64ce08`（23:47:17，本身未含 T0386）前後此檔被還原回 HEAD 內容（`git status` 乾淨、`status: TODO`）。收尾時重新寫入 `started_at`（保留原 23:36:44 系統取值）與最終狀態。建議塔台檢查 commit 流程是否有 `git checkout -- _ct-workorders/` / stash 類動作會吃掉 Worker 未提交的工單編輯
- WSL PoC 唯讀引用了 `~/.local/bat-server/bin/node` 與其 `node_modules`（`NODE_PATH`），未寫入該目錄；實驗檔在 `/tmp/t0386-poc`，已刪
- 「外觀設定來自遠端」（§4）與 Docker 連線問題（§5）為**推測**，已附驗證方式
- 本研究未跑 `npm run test:unit` / `vite build`（未改產品程式碼）

### 變更檔案

- 本工單檔（僅回報區與 metadata）。未改任何產品程式碼；未碰 T0387 平行進行中的未追蹤檔（`electron/remote/ssh-wizard-verify.ts` 等）

### Commit

- 單一 commit，`git commit --only` 僅本工單檔；未 push。hash 見 commit 後 `git log`（回報區寫入在 commit 之前，不自我引用）
