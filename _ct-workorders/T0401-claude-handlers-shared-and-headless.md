---
schema_version: 1
schema_kind: workorder
id: T0401
title: "PLAN-036 P1-F：claude:* 搬入共用模組 electron/handlers/claude.ts 並上線 headless；archive 改 always-local；codex / stub 類 unsupported + UI 降級；PROXIED_EVENTS 補齊"
type: impl
status: DONE
repo: better-agent-terminal
project: PLAN-036
priority: P1
sizing: L
created_at: "2026-10-05T02:12:37+08:00"
started_at: "2026-10-05T02:13:40+08:00"
updated_at: "2026-10-05T02:31:08+08:00"
completed_at: "2026-10-05T02:31:08+08:00"
target_version: next
depends_on:
  - T0400
  - T0403
related:
  - "PLAN-036 P1 佇列（D130）：T0400 E ✅ → **T0401 F** → T0402 G"
  - "T0386 回報區 §1（claude:* 三分類 A / B / C）、§4（claude runtime / auth）、建議清單 F"
  - "T0400 回報區「後續建議」：`new ClaudeAgentManager(hostDeps)` 可直接用；`broadcastRuntimeEvent` 與 `createElectronClaudeEmit` 重複"
affects_files:
  - electron/handlers/claude.ts
  - electron/handlers/types.ts
  - electron/main.ts
  - electron/remote/protocol.ts
  - electron/remote/headless-entry.ts
  - electron/remote/headless-handlers.ts
  - electron/remote/headless-channel-status.ts
  - electron/claude-agent-manager.ts
  - src/components/ClaudeAgentPanel.tsx
  - src/components/
  - src/locales/
  - scripts/smoke-remote-headless.mjs
  - scripts/__tests__/smoke-remote-headless.test.mjs
  - electron/__tests__/
  - electron/remote/__tests__/
  - src/components/__tests__/
interaction:
  mode_hint: on
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **本機 Claude / Codex 面板行為不得改變**：搬移是逐字搬，handler 內部邏輯不重寫。e2e E1（43 個 `claude:*` 皆有 IPC 綁定）必須仍 PASS。"
  - "🔴 **不送真實 Claude API 對話**（不消耗 token）。headless 端以 harness 驗證註冊、`get-cli-path` / `detectRuntime` / `auth-status` / `get-supported-models` 等不需登入的 channel。"
  - "🔴 **不得部署到 WSL、不得 restart `bat-server.service`**：完成後由塔台部署並跑 smoke。"
  - "🔴 system runtime 絕不注入 `DISABLE_UPDATES`（CLAUDE.md T0372 規則）；headless embedded（bundle `bin/claude`）必須注入。"
  - "🔴 **禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）。不 push。"
---

# T0401 — claude:* 共用註冊 + headless 上線（PLAN-036 P1-F）

## 元資料
- **工單編號**：T0401
- **任務名稱**：claude:* 上遠端
- **狀態**：DONE
- **建立時間**：2026-10-05 02:12 (UTC+8)
- **intervention_type**：fire-and-forget
- **預估規模**：L
- **降級策略**：若 context 不足，先完成「1. 搬移（Electron 端行為不變）」並 commit，回報 **PARTIAL**，headless 上線與 UI 降級由塔台 Renew / 續單

## 背景

- P0 後遠端視窗有終端，但 Claude Agent 面板的 `claude:*` 在 headless 一律 `No handler for channel`（T0396 S8 實測）
- T0400 已讓 `ClaudeAgentManager` 不 import electron，建構子吃 `Pick<HostDeps, 'emit' | 'getSettings' | 'notifier'>`；headless 直接傳 `HostDeps`（無 notifier ⇒ 不發通知）
- T0389 已讓 `claude-runtime-router` 可在 headless 注入設定與 bundle `bin/claude` embedded 路徑
- `electron/main.ts:2226-2674`：43 個 `registerHandler('claude:...')`；`electron/remote/headless-channel-status.ts` 目前把 43 個 `claude:*` 列在 `HEADLESS_UNSUPPORTED`（P1）

## 範圍

### 1. 搬移（Electron 端行為不變）
- 新增 `electron/handlers/claude.ts` 的 `registerClaudeHandlers(register, deps)`，把 `main.ts` 的 `claude:*` 註冊逐字搬入；main.ts 改呼叫它並以 Electron deps 組裝
- 需要的 host 能力以 `HostDeps` 欄位注入（例如 `homeDir`、`dataDir`、取得 claude / codex manager 的 getter）；`electron/handlers/` 底下不得 import electron（`headless-electron-free.test.ts` 守門）
- 順手把 `main.ts` 的 `broadcastRuntimeEvent` 改用 deps.emit（T0400 建議），前提是行為不變

### 2. 分類（依 T0386 §1，與實作不符時照實作並在回報區列差異）
- **always-local**（加入 `ALWAYS_LOCAL_CHANNELS`）：`claude:archive-messages` / `claude:load-archived` / `claude:clear-archive`（renderer 訊息溢出的本機快取）
- **headless 不支援**（留在 `HEADLESS_UNSUPPORTED`，回明確錯誤）：codex 相關（`claude:set-codex-sandbox-mode` / `claude:set-codex-approval-policy` 等，server bundle 不含 codex）；本機也是 stub 的 `claude:auth-login` / `account-list` / `account-import-current` / `account-switch` / `rewind-to-prompt` 可在 headless 回同樣 stub（擇一，回報說明）
- **headless 支援**：其餘（session / 模型 / 權限 / 列表 / resume / fork / stop-task / rest / wake / context / meta / worktree-status / cleanup-worktree / scan-skills / scan-star-commands / get-statusline-extras / get-cli-path / detectRuntime / auth-status / auth-logout / abort-session 等）

### 3. headless 上線
- `headless-entry.ts` 組 headless `HostDeps`（dataDir 為 userData、`homeDir = os.homedir()`、無 notifier），建立 `ClaudeAgentManager` 並呼叫 `registerClaudeHandlers`
- 確認 headless embedded runtime 走 bundle `node_modules/@anthropic-ai/claude-code/bin/claude`，spawn env 注入 `DISABLE_AUTOUPDATER=1` + `DISABLE_UPDATES=1`；system runtime 不注入 `DISABLE_UPDATES`
- `PROXIED_EVENTS` 補 `claude:turn-end`、`claude:runtime-degraded`、`claude:runtime-warning`

### 4. UI 降級
- 遠端視窗（profile `type === 'remote'`）中：codex preset / codex 專屬控制隱藏或停用並顯示原因（i18n：`src/locales/` 各語系）
- 遠端 Claude 面板呼叫到 unsupported channel 時顯示可理解的訊息，不是原始 `No handler for channel`

### 5. smoke 跟進
- `scripts/smoke-remote-headless.mjs` S8 目前用 `claude:get-supported-models` 當「unsupported」探針，本單後會變成支援 ⇒ 改為從 `HEADLESS_UNSUPPORTED` 動態挑一個仍不支援的 channel（或固定用 `git:*` 系列，T0405 時再調整）；另新增 S9：`claude:get-cli-path` / `claude:detectRuntime` / `claude:auth-status` 經 headless 回傳合理值（不需登入）

## 驗收條件

- [ ] `main.ts` 不再有 `registerHandler('claude:`（grep 證據）；`electron/handlers/claude.ts` 不 import electron
- [ ] parity / electron-free / proxied-binding 守門測試綠；`HEADLESS_UNSUPPORTED` 的 claude 項目只剩第 2 點列的不支援類
- [ ] headless 整合測試（harness）：`get-cli-path` 回 bundle 路徑形狀、`detectRuntime`、`auth-status`（未登入狀態）、`get-supported-models`；unsupported channel 回明確錯誤；archive 三個不經 headless
- [ ] 單元測試：headless embedded spawn env 含 `DISABLE_UPDATES`，system 不含
- [ ] UI 降級測試（`src/components/__tests__/`）
- [ ] `npm run test:unit` 全綠（基線 1224）；`npx tsc --noEmit` ≤ 40；`npx vite build` exit 0；`npm run test:e2e` 0 failed（E1 必 PASS）
- [ ] 回報區附「塔台部署後 smoke 預期輸出」與「使用者實機步驟」（WSL 遠端視窗開 Claude 面板 → 未登入時看到什麼）

## 不在範圍

- 遠端登入引導 UX（T0402）
- 孤兒 PTY / BUG-103（T0404）；git / fs（T0405 / T0406）

## Sub-session 執行指示

1. 讀本工單 + T0386 回報區 §1 / §4 + T0400 回報區 + `electron/handlers/types.ts` / `pty.ts`（既有共用模組範本）+ `main.ts:2226-2674`
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 依 1 → 5 順序實作；第 1 步完成即可先 commit（降級策略）
4. 填回報區；完成寫 **`DONE`**（只完成第 1 步寫 `PARTIAL`）
5. `git commit --only` 實際改動檔 + 本工單；不 push
6. 依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態
**DONE** — 範圍 1-5 全部完成；所有本機驗證閘門 PASS。WSL 部署 / 實機 smoke 依 memory_overrides 留給塔台。

### 落點檢查（Landing Zone）
- **PASS**。C-0：frontmatter `repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal`（REPO_ROOT=`D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）。C-1 PASS。C-3 informational：前 5 個非萬用字元 affects_files 皆存在（新檔 `electron/handlers/claude.ts` 的上層 `electron/handlers/` 存在）。C-2：無 `branch` 欄位（在 `main` 上執行）。
- `BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅紀錄）；`CT_MODE=on`、`CT_INTERACTIVE=0`。

### 產出摘要

**1. 搬移（Electron 行為不變）**
- 新增 `electron/handlers/claude.ts`：`registerClaudeHandlers(register, deps)`，43 個 `claude:*` 從 `main.ts` 逐字搬入。只有 host 耦合改成 deps：`app.getPath('home')` → `deps.homeDir`；`broadcastRuntimeEvent(...)` → `deps.emit(...)`；module-level `claudeManager` / `codexManager` / `sessionManagerMap` → `getClaudeManager()` / `getCodexManager()` / `sessionKinds`；`MESSAGE_ARCHIVE_DIR` → `messageArchiveDir`；動態 import 路徑 `./claude-runtime-router` → `../claude-runtime-router`；inline type import 改為檔頭 `import type`。不 import electron。
- `main.ts`：`registerClaudeHandlers(registerHandler, { emit: createElectronClaudeEmit(getAllWindows), homeDir: app.getPath('home'), getClaudeManager, getCodexManager, sessionKinds: sessionManagerMap, messageArchiveDir: MESSAGE_ARCHIVE_DIR })`；`worktree:*` 留在原處。刪除 `broadcastRuntimeEvent`（與 `createElectronClaudeEmit` 逐行等價：每個未 destroyed 視窗 `webContents.send` + `broadcastHub.broadcast`），T0400 建議落地。`grep "registerHandler('claude:" electron/main.ts` → **0**。
- 唯一的 Electron 行為細節：codex preset 的 start / resume 先取 manager 再寫 `sessionKinds`（Electron 上 `getCodexManager` 只回 `codexManager`，結果相同；headless 才會在寫入前 throw）。

**2. 分類**：見下表。`HEADLESS_UNSUPPORTED` 的 claude 項只剩 2 個 codex 控制。stub 類選「headless 回同樣 stub」（共用模組兩端都註冊，回傳與本機一字不差，renderer 不需特判）。

**3. headless 上線**（`electron/remote/headless-entry.ts`）
- `createHeadlessClaudeModule({ installRoot })`：`configureRuntimeRouter({ getDataDir: () => host.dataDir, getEmbeddedLayout })` → `new ClaudeAgentManager(host)`（headless `HostDeps`：broadcastHub emit、無 notifier、`homeDir = os.homedir()`）→ `registerClaudeHandlers`（不傳 codex、不傳 archive dir）；disposer `killAll()` + `dispose()`（stop 時清 45s health timer）。
- `resolveHeadlessEmbeddedLayout(installRoot)`：`<installRoot>/node_modules/@anthropic-ai/claude-code/bin/claude` 存在 → `server-bundle` layout；不存在（repo 內執行）→ `node-modules`。`installRoot` 預設 `path.resolve(__dirname, '..', '..')`（bundle 的 `staging/`，與 `resolveBundleVersion` 同錨點）；`HeadlessServerOptions.installRoot` 可覆寫（測試用）。
- spawn env：`ClaudeAgentManager` 建構子 process-wide 設 `DISABLE_AUTOUPDATER=1`；`sdkSpawnEnv` 只對 embedded / system→embedded fallback 加 `DISABLE_UPDATES=1`，system 不傳 `options.env`（既有 T0372 邏輯，headless 直接沿用，已以 harness 測試驗證）。
- `PROXIED_EVENTS` 補 `claude:turn-end`、`claude:runtime-degraded`、`claude:runtime-warning`。

**4. UI 降級**
- `src/lib/remote-unsupported.ts`：`REMOTE_UNSUPPORTED_AGENT_PRESETS`（`codex-agent` / `codex-agent-worktree`）、`unsupportedRemoteChannel(err)`（解析 `No handler for channel: X`，含 Electron IPC 包裝字串）、`remoteUnsupportedMessage(err, t)`。
- `ThumbnailBar` 新 prop `unavailableAgents`：遠端視窗（`WorkspaceView` 依 `isRemoteConnected` 傳入）中 codex agent 項目以 `disabled` + `aria-disabled` + tooltip + 右側原因文字顯示，點擊不建立。
- `MainPanel`：遠端視窗中的 codex agent 終端改顯示 `RemoteAgentUnavailable`（說明遠端 bat-server 無 Codex），不掛 `CodexAgentPanel`。
- `ClaudeAgentPanel`：自動 start / resume 與送訊息的 invoke 失敗若是 `No handler for channel`，改在對話中顯示 system 訊息 `claude.remoteChannelUnsupported`（含 channel 名）並結束 streaming；其他錯誤照舊 rethrow（本機行為不變）。
- i18n：`claude.remoteChannelUnsupported` / `remoteCodexUnsupported` / `remoteCodexUnsupportedShort`（en / zh-TW / zh-CN）。

**5. smoke 跟進**（`scripts/smoke-remote-headless.mjs`）
- S8 探針改為 `claude:set-codex-sandbox-mode`（args `['smoke-probe','read-only']`）：server bundle 無 codex ⇒ **永久**不支援，且在 T0401 之前的 server 一樣不支援，T0405 時不必再調整。（.mjs 無法 import TS 的 `HEADLESS_UNSUPPORTED`，「動態挑選」改由 vitest 守門：探針必須在 `HEADLESS_UNSUPPORTED`。）
- 新增 S9：`claude:get-cli-path`（絕對 POSIX 路徑）/ `claude:detectRuntime`（embedded 存在且 `healthy`）/ `claude:auth-status`（`null` 或 `{ loggedIn: boolean }`）。對 T0401 之前的 server 會 FAIL 並註明「server predates T0401」。

**變更檔案**
- 新增：`electron/handlers/claude.ts`、`electron/remote/__tests__/headless-claude.test.ts`、`src/lib/remote-unsupported.ts`、`src/lib/__tests__/remote-unsupported.test.ts`、`src/components/RemoteAgentUnavailable.tsx`、`src/components/__tests__/remote-codex-degrade.test.tsx`
- 修改：`electron/main.ts`、`electron/remote/headless-entry.ts`、`electron/remote/headless-channel-status.ts`、`electron/remote/protocol.ts`、`electron/remote/__tests__/proxied-channels-binding.test.ts`、`src/components/ClaudeAgentPanel.tsx`、`src/components/MainPanel.tsx`、`src/components/ThumbnailBar.tsx`、`src/components/WorkspaceView.tsx`、`src/styles/resize.css`、`src/locales/{en,zh-TW,zh-CN}.json`、`scripts/smoke-remote-headless.mjs`、`scripts/__tests__/smoke-remote-headless.test.mjs`
- 未動（affects_files 有列但不需要）：`electron/handlers/types.ts`、`electron/claude-agent-manager.ts`

**驗證（本機）**

| 閘門 | 結果 | 證據 |
|---|---|---|
| `main.ts` 無 `registerHandler('claude:` / `handlers/claude.ts` 不 import electron | PASS | grep 皆 0；`headless-electron-free.test.ts` 綠（bundle 圖已含 `claude.ts` + `claude-agent-manager.ts`） |
| parity / electron-free / proxied-binding | PASS | `electron/remote/__tests__` 全綠；binding 掃描器擴充為同時掃 `electron/handlers/*.ts` 的 `register('…')`（否則 `claude:send-message` 會從掃描結果消失） |
| headless 整合（harness） | PASS | `headless-claude.test.ts` 17 tests：get-cli-path 回 bundle 形狀路徑、detectRuntime、auth-status（無登入 → `null`）、get-supported-models（builtins + SDK-only）、stub、codex 拒絕、archive 不在 headless、runtime-degraded / warning 送達 client |
| spawn env 單元 | PASS | 同檔：embedded → `DISABLE_UPDATES=1`；system → 不傳 `env`；system→embedded fallback → `DISABLE_UPDATES=1`；`DISABLE_AUTOUPDATER=1` |
| UI 降級 | PASS | `remote-codex-degrade.test.tsx` 6 tests + `remote-unsupported.test.ts` 8 tests |
| `npm run test:unit` | PASS | 87 files / **1258 passed**（基線 1224，+34） |
| `npx tsc --noEmit` | PASS | **40**（≤ 40；與搬移後基準同一組錯誤，無新增） |
| `npx vite build` | PASS | exit 0 |
| `npm run test:e2e` | PASS | 6 passed / 8 skipped（PLAN-031 既有 `test.skip`）/ **0 failed**；E1 log：`PROXIED_CHANNELS claude:* sweep: 43 channel(s), unbound: none` |
| WSL 部署 / 實機 smoke | 未執行（依 memory_overrides 由塔台） | — |

### channel 分類最終表

| 類別 | channel | 數量 | 與 T0386 §1 差異 |
|---|---|---|---|
| headless 支援（共用模組註冊） | start-session / send-message / stop-session / abort-session / set-permission-mode / set-model / set-effort / reset-session / get-supported-models / get-account-info / get-supported-commands / get-supported-agents / get-session-meta / get-worktree-status / cleanup-worktree / resolve-permission / resolve-ask-user / list-sessions / resume-session / fork-session / stop-task / rest-session / wake-session / is-resting / fetch-subagent-messages / scan-skills / scan-star-commands / get-context-usage / get-statusline-extras / get-cli-path / detectRuntime / auth-status / auth-logout | 33 | 一致 |
| headless 回同樣 stub | auth-login / account-list / account-import-current / account-switch / rewind-to-prompt | 5 | T0386 列為 C 類「回同樣 stub 即可」；採用此選項，故不在 `HEADLESS_UNSUPPORTED` |
| always-local（`ALWAYS_LOCAL_CHANNELS`） | archive-messages / load-archived / clear-archive | 3 | 一致（B 類）；headless 不註冊 |
| headless 不支援（`HEADLESS_UNSUPPORTED`，P1） | set-codex-sandbox-mode / set-codex-approval-policy | 2 | 一致（C 類）；另外 start / resume / list-sessions 帶 codex preset 時 headless 丟 `CODEX_UNSUPPORTED_MESSAGE` |
| 合計 | | 43 | |

### 塔台部署後 smoke 預期輸出

部署（本單 JS 進 bundle）後：`node scripts/smoke-remote-headless.mjs --target wsl:Ubuntu-24.04`

```
PASS S1 … (serverPlatform=linux …)
PASS S2 … S7（同 T0403，不變）
PASS S8 unsupported channel returns an explicit error — claude:set-codex-sandbox-mode → invoke-error "No handler for channel: claude:set-codex-sandbox-mode"
PASS S9 claude:get-cli-path / detectRuntime / auth-status answer without a login — get-cli-path → <installRoot>/node_modules/@anthropic-ai/claude-code/bin/claude; embedded <同路徑> v2.1.289 healthy; system none; auth-status → null (not logged in / no status)
[smoke] cleanup: no smoke PTY left (…)
[smoke] RESULT: 9/9 PASS
```

- WSL 上無系統 claude（T0386 §4）⇒ `system none`；`~/.claude/.credentials.json` 不存在 ⇒ `auth-status → null`。若已登入則為 `loggedIn=true (…)`，同樣 PASS。
- **未部署**時跑新 smoke：S1-S8 PASS、S9 FAIL `No handler for channel: claude:get-cli-path — server predates T0401`（8/9）。
- S9 的 `detectRuntime` 會在 server 上執行一次 bundle claude `--version`、`auth-status` 執行一次 `claude auth status`；都不送 API 對話。

### 使用者實機步驟

1. 塔台部署後，開 WSL 遠端 profile 視窗。
2. 新增 Agent 選單（「+」）：**Codex Agent 為灰色**，右側與 tooltip 顯示「遠端伺服器不支援」，點擊無反應；Claude Agent V1 / V2 可選。
3. 開 **Claude Agent V1**：面板正常顯示（不再出現 `No handler for channel: claude:start-session`）。未登入時：
   - 輸入 `/whoami` → 顯示 `Not logged in.`
   - 直接送訊息 → session 會啟動，但 CLI 回報未登入（訊息內容為 claude CLI 原文，例如要求 `/login` 或 API key）。登入引導 UX 不在本單（T0402）。
   - 模型清單可打開（builtins + CLI 回報的模型）。
4. 若視窗連到**舊版** bat-server（未部署本單）：開 session / 送訊息時對話中出現 system 訊息「遠端伺服器無法處理此請求（claude:…）。請更新遠端主機上的 server bundle…」，而非毫無反應。
5. 若遠端 workspace 預設 agent 為 Codex（或既有 Codex 分頁）：該分頁顯示「遠端視窗不支援 Codex Agent…」說明，不會嘗試啟動。

### 互動紀錄
無

### Renew 歷程
無

### 遭遇問題
- **偏差（affects_files 外的檔案）**：`src/lib/remote-unsupported.ts` + 其測試、`src/styles/resize.css`（disabled 選單樣式）。皆為第 4 點 UI 降級所需；helper 放 `src/lib/` 沿用 `claude-error-classify.ts` 的慣例。
- **proxied-channels-binding 掃描器**：原 regex 只認 `registerHandler('…')`，搬移後 `claude:*` 改經 `register('…')` 註冊會讓守門測試誤判；已擴充為也掃 `electron/handlers/` 下的 `register('…')`（lookbehind 防誤配 `foo.register(`）。
- **`claude auth status` 未登入時 exit 1**（本機實測 embedded 2.1.289 + 空 `CLAUDE_CONFIG_DIR`：stdout 有 `{"loggedIn": false, "authMethod": "none", …}`，exit code 1）⇒ 既有 handler 走 `err` 分支回 `null`。本單依「逐字搬」不改；**T0402 若要區分「未登入」與「runtime 壞掉」，需在 exit≠0 時仍嘗試 parse stdout**（會同時改變本機行為，需塔台裁決）。
- `docs/remote-dev-overview.md:214` 的 smoke 表仍寫 S8 探針為 `claude:get-supported-models`、且無 S9（docs 不在 affects_files，未改）——建議塔台順手或下一張單更新。
- `claude:auth-status` 在 Windows 對非 PE 檔 `execFile` 會同步丟 `EFTYPE`（promise reject 而非 `null`）——既有行為，與遠端無關，僅測試時遇到（測試改用真正可執行但非 claude 的檔案）。

### Commit
`git commit --only` 本單 + 上列產品 / 測試檔（訊息含 T0401），不 push；hash 見 `git log --grep T0401`。

### 回報時間
2026-10-05T02:30:18+08:00
