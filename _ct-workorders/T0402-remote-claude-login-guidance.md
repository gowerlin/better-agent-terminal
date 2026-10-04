---
schema_version: 1
schema_kind: workorder
id: T0402
title: "PLAN-036 P1-G：Claude 面板未登入引導（遠端：開終端分頁執行登入）+ auth-status 在 exit≠0 時仍解析 stdout"
type: impl
status: DONE
repo: better-agent-terminal
project: PLAN-036
priority: P1
sizing: S
created_at: "2026-10-05T02:35:05+08:00"
started_at: "2026-10-05T02:36:32+08:00"
updated_at: "2026-10-05T02:44:13+08:00"
completed_at: "2026-10-05T02:44:13+08:00"
target_version: next
depends_on:
  - T0401
related:
  - "PLAN-036 P1 佇列（D130）：T0400 ✅ → T0401 ✅ → **T0402 G**；與 T0404 平行"
  - "T0401 回報區「遭遇問題」：`claude auth status` 未登入 exit 1，stdout 仍有 JSON"
  - "T0386 回報區 §4 auth 列"
affects_files:
  - electron/handlers/claude.ts
  - src/components/ClaudeAgentPanel.tsx
  - src/components/
  - src/lib/
  - src/locales/
  - electron/__tests__/
  - electron/remote/__tests__/headless-claude.test.ts
  - src/components/__tests__/
  - src/lib/__tests__/
interaction:
  mode_hint: on
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **使用者已裁決（02:34）**：`claude:auth-status` 在 `claude auth status` exit≠0 時，若 stdout 是含 `loggedIn` 欄位的 JSON 就照實回傳，否則照舊回 `null`。本機也套用。"
  - "🔴 T0404 平行中：不得碰 `electron/remote/remote-server.ts`、`electron/remote/headless-entry.ts`、`electron/pty-manager.ts`、`electron/remote/protocol.ts`。"
  - "🔴 不送真實 Claude API 對話；不在任何機器上實際執行登入。不得部署到 WSL。"
  - "🔴 **禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）。不 push。"
---

# T0402 — Claude 面板未登入引導（PLAN-036 P1-G）

## 元資料
- **工單編號**：T0402
- **任務名稱**：遠端 claude 登入引導
- **狀態**：DONE
- **建立時間**：2026-10-05 02:35 (UTC+8)
- **intervention_type**：fire-and-forget

## 背景

T0401 後遠端視窗的 Claude 面板可以開 session（WSL 實機 smoke S9 PASS：`get-cli-path` 為 bundle 路徑、embedded healthy、`auth-status → null`）。但 WSL 上沒登入：使用者送訊息只會看到 CLI 原文錯誤，`/whoami` 顯示 `Not logged in.`。`claude:auth-login` 本機與遠端都是 stub（`electron/handlers/claude.ts`），登入要在終端執行 claude。

另外 `claude auth status` 未登入時 exit 1、stdout 為 `{"loggedIn": false, "authMethod": "none", …}`，現行 handler（`electron/handlers/claude.ts:187` 起）走 err 分支回 `null`，分不出「未登入」與「runtime 壞掉」。

## 範圍

1. **auth-status**：依使用者裁決修改（見 memory_overrides 第 1 條）。stdout 解析失敗 / 非 JSON / 無 `loggedIn` ⇒ `null`；log 記錄 exit code
2. **未登入引導**（本機與遠端共用，文案依視窗類型調整）：
   - Claude 面板在 session 開始前或第一次送訊息失敗時，若 `auth-status` 回 `loggedIn: false`，顯示引導卡片：說明未登入、提供「開啟終端分頁登入」按鈕
   - 按鈕：在**同一視窗**（遠端視窗 ⇒ 遠端終端）開新終端分頁並打入登入指令。指令用 `claude:get-cli-path` 回傳的路徑（遠端為 bundle 內 claude），以 shell 安全的方式引用路徑；只打入、**不自動送出 Enter**，讓使用者確認
   - 登入完成後可按「重新檢查」重跑 `auth-status`
   - `auth-status` 為 `null`（無法判斷）時不顯示引導卡片，維持現行錯誤顯示
3. i18n：en / zh-TW / zh-CN

## 驗收條件

- [ ] unit：auth-status 的 exit≠0 + JSON stdout / exit≠0 + 非 JSON / exit 0 三種情況
- [ ] unit：引導卡片顯示條件（`loggedIn:false` 顯示；`true` / `null` 不顯示）、按鈕打入的指令（含路徑有空白的引用）、不自動送出
- [ ] headless harness（`headless-claude.test.ts`）：未登入時 `auth-status` 回 `{ loggedIn: false, … }`（不再是 `null`）
- [ ] `npm run test:unit` 全綠（基線 1258）；`npx tsc --noEmit` ≤ 40；`npx vite build` exit 0；`npm run test:e2e` 0 failed
- [ ] 回報區附使用者實機步驟（WSL 遠端視窗 → Claude 面板 → 引導卡片 → 終端分頁登入 → 重新檢查）

## 不在範圍
- 實作真正的 `claude:auth-login`（仍為 stub）
- codex 登入

## Sub-session 執行指示
1. 讀本工單 + T0401 回報區 + `electron/handlers/claude.ts`（auth-status / get-cli-path / auth-login）+ `src/components/ClaudeAgentPanel.tsx`（`/whoami`、session 啟動、錯誤顯示）+ 既有「開終端分頁並帶指令」的 renderer 流程（依實際位置）
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 實作 → 驗收
4. 填回報區；完成寫 **`DONE`**
5. `git commit --only` 實際改動檔 + 本工單；不 push
6. 依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

**DONE** — 範圍 1–3 全數實作；驗收條件 unit / headless harness / tsc / vite build / e2e 皆通過。`npm run test:unit` 唯一的 1 個失敗屬平行中 T0404 未提交的改動（見「遭遇問題」），與本單無關。實機步驟（WSL 遠端視窗）待使用者驗收。

**Landing Zone Check：PASS**
- C-0：frontmatter `repo: better-agent-terminal` ＝ `basename(REPO_ROOT)` `better-agent-terminal` ✅（REPO_ROOT `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）
- C-1：工單位於 REPO_ROOT 下 ✅；C-3：`affects_files` 皆存在（informational）；C-2：無 `branch` 欄位，HEAD = `main`
- `BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（證據，不比對）
- 派發 mode：`CT_MODE=on`、`CT_INTERACTIVE=0`

### 產出摘要

**1. auth-status（`electron/handlers/claude.ts`，本機與 headless 共用）**
- 新增 export `parseClaudeAuthStatus(stdout)` + `ClaudeAuthStatus` 型別：stdout 是 JSON object 且 `loggedIn` 為 boolean ⇒ 照實回傳；空 / 非 JSON / 陣列 / 無 `loggedIn` / `loggedIn` 非 boolean ⇒ `null`。
- handler 不論 exit code 都走 parse（依使用者裁決）；exit≠0 時記 log：可解析 ⇒ `logger.log('[auth-status] exit <code>, stdout reports loggedIn=…')`，不可解析 ⇒ `logger.error('[auth-status] exit <code>, stdout not a usable auth status', err)`。
- 行為變更提醒：exit 0 但 JSON 無 `loggedIn` 的情況，舊版回原物件、新版回 `null`（依範圍 1「無 `loggedIn` ⇒ null」）。既有呼叫端（`/whoami`、CodexAgentPanel）只讀 `status?.loggedIn`，不受影響。
- runtime 解析失敗仍回 `null`（契約不變）。

**2. 未登入引導（renderer）**
- `src/lib/claude-login-guide.ts`（新）：
  - `shouldShowClaudeLoginGuide(status)`：僅 `loggedIn === false` 為 true；`true` / `null` / `undefined` 皆不顯示。
  - `buildClaudeLoginCommand(cliPath, shellFamily)`：`<quoteCommandPath(cliPath)> auth login`（沿用 `src/utils/shell-quote.ts` 的 posix / pwsh / cmd 引用，與 claude-cli preset 同一套）；路徑空字串 fallback 為 `claude auth login`。`claude auth login` 子指令已以 `node_modules/@anthropic-ai/claude-code/bin/claude.exe auth --help` 確認存在（只看 help，未執行登入）。
  - `openClaudeLoginTerminal(deps)`：加分頁 → 取 shell 與 `claude:get-cli-path` → 以 `createPtyThenLaunch` 開**純 shell**（`type: 'terminal'`，不帶 agentPreset）→ 500ms 後 `pty.write(id, command)`，**不含 `\r`**，不自動送出。PTY 若非新建（restore）則不打字。
  - `getClaudeAuthStatus(fetch, { force })`：30 秒 TTL 共用快取，多個 Claude 面板同時掛載（restore workspace）只 spawn 一次 `claude auth status`；`force` 一律重抓；fetch reject 視為 `null`。
  - window event `claude-open-login-terminal`（detail `{ workspaceId }`）。
- `src/components/ClaudeLoginGuideCard.tsx`（新）：標題、本機 / 遠端兩種說明文案（遠端說明終端分頁開在遠端主機）、「指令只打入不執行」提示、「開啟終端分頁登入」與「重新檢查」按鈕（檢查中 disabled）、重新檢查後仍未登入的提示。
- `src/components/ClaudeAgentPanel.tsx`：
  - 掛載時（session 開始前）`refreshLoginGuide(false)`；`claude:error`（送訊息失敗）且卡片未顯示時 `refreshLoginGuide(true)`。
  - 卡片渲染在訊息列表底部（`messagesEndRef` 之前）；`isRemote` 取自既有 `isRemoteConnected` prop（App 對遠端 profile 視窗設 true）。
  - 「重新檢查」：force 重跑 `auth-status`；登入 ⇒ 卡片消失；仍 `loggedIn:false` ⇒ 顯示「仍未登入」；`null` ⇒ 卡片消失（維持現行錯誤顯示）。
  - 「開啟終端分頁」：dispatch `claude-open-login-terminal`（workspaceId 取 prop，缺時取 store 內該 terminal 的 workspaceId）。
- `src/components/WorkspaceView.tsx`：監聽上述 event（只處理自己 workspace），在**同一視窗**開新終端分頁並聚焦；`cwd` = workspace folder、env 合併 global + workspace envVars、帶 `workspaceId`（T0176），與既有 `handleAddTerminal` 一致。遠端視窗的 `pty.create` 本來就走遠端主機，故遠端視窗 ⇒ 遠端終端。
- `src/styles/claude-agent.css`：`.claude-login-guide*` 樣式（沿用既有 CSS 變數）。

**3. i18n**：`claude.loginGuideTitle / loginGuideBodyLocal / loginGuideBodyRemote / loginGuideTerminalHint / loginGuideOpenTerminal / loginGuideRecheck / loginGuideChecking / loginGuideStillLoggedOut`，en / zh-TW / zh-CN 三語齊備（`i18n-completeness.test.ts` PASS）。

**測試（新增 / 修改）**
- `electron/__tests__/claude-auth-status.test.ts`（新，5 tests）：mock `child_process.execFile` + runtime router，經 `registerClaudeHandlers` 取真 handler：exit 1 + JSON ⇒ JSON；exit 1 + 非 JSON ⇒ null；ENOENT 空 stdout ⇒ null；exit 0 + JSON ⇒ JSON；`parseClaudeAuthStatus` 邊界。
- `electron/remote/__tests__/headless-claude.test.ts`（改）：原「auth-status answers null」改為「回 `{ loggedIn: false, authMethod: 'none', … }`」。fake embedded 在 Windows 是 `where.exe` 複本、無法印 JSON，故以 `vi.mock('child_process')` 只攔截「對 fake embedded 的 `auth status`」回傳真 CLI 的未登入答覆（exit 1 + JSON stdout），其他 spawn 照走真 child_process。
- `src/lib/__tests__/claude-login-guide.test.ts`（新，8 tests）：顯示條件（false 顯示 / true、null、undefined 不顯示）、posix / pwsh / cmd 含空白與單引號路徑的引用、空路徑 fallback、開分頁打入的指令（含空白路徑）、**寫入內容不含 `\r` / `\n`**、非新建 PTY 不打字、快取 TTL / force、reject ⇒ null。
- `src/components/__tests__/claude-login-guide-card.test.tsx`（新，5 tests）：本機 / 遠端文案、按鈕回呼、檢查中 disabled、仍未登入提示。

**驗收證據**
| lane | 結果 |
|------|------|
| unit：auth-status 三情境 | ✅ PASS（`claude-auth-status.test.ts` 5/5） |
| unit：卡片顯示條件 / 指令引用 / 不自動送出 | ✅ PASS（`claude-login-guide.test.ts` 8/8、`claude-login-guide-card.test.tsx` 5/5）。顯示條件在 lib 層 `shouldShowClaudeLoginGuide` 驗證，未整個渲染 4000+ 行的 ClaudeAgentPanel |
| headless harness | ✅ PASS（`headless-claude.test.ts` 17/17，auth-status ⇒ `{ loggedIn: false, … }`） |
| `npm run test:unit` | ⚠️ 1275 passed / 1 failed / 1276（90 files）。失敗為 `scripts/__tests__/smoke-remote-headless.test.mjs` 的 `summarize()` 多出 `warned: 0`——來源是 T0404 未提交的 `scripts/smoke-remote-headless.mjs` 改動，非本單。本單新增 18 tests，1258 + 18 = 1276 |
| `npx tsc --noEmit` | ✅ 40 errors（≤ 40；本單檔案 0 筆） |
| `npx vite build` | ✅ exit 0 |
| `npm run test:e2e` | ✅ exit 0，6 passed / 8 skipped / 0 failed |
| runtime smoke（WSL 遠端視窗實機） | ⏳ 未執行（工單禁止部署到 WSL、禁止實際登入），交使用者依下方步驟驗收 |

### 使用者實機步驟

前置：本單 commit 後，以含本單的 BAT 版本更新 WSL 遠端 bat-server（auth-status 改動在 shared handler，**遠端需重新部署 server bundle 才會生效**；renderer 改動隨本機 BAT）。

1. 開 WSL 遠端 profile 視窗，確認該遠端主機上 claude **未登入**。
2. 新增一個 Claude Agent 分頁 → 面板訊息區底部應出現「Claude 尚未登入」卡片，文案為「遠端主機上的 Claude Code 尚未登入…終端分頁會開在遠端主機上…」。
   - （或：送一則訊息 → 出現 CLI 原文錯誤後，卡片隨之出現。）
3. 按「開啟終端分頁登入」→ 同一視窗新增一個終端分頁並自動聚焦；約 0.5 秒後提示字元後出現 `'<bundle 路徑>/node_modules/@anthropic-ai/claude-code/bin/claude' auth login`，**游標停在行尾、未執行**。
4. 確認指令後按 Enter，依 CLI 指示完成登入（瀏覽器 OAuth / 貼 code）。
5. 回到 Claude Agent 分頁按「重新檢查」→ 卡片消失。若仍顯示「仍未登入…」代表登入未完成。
6. 送一則訊息確認可正常回覆；若仍報未登入錯誤，輸入 `/new` 重開 session 再試（見遭遇問題 R2）。
7. 對照：本機視窗在已登入狀態下開 Claude Agent 分頁 → 不應出現卡片；`/whoami` 顯示帳號。

### 互動紀錄
無

### Renew 歷程
無

### 遭遇問題

1. **`npm run test:unit` 1 failed（非本單）**：`scripts/__tests__/smoke-remote-headless.test.mjs > runSmoke (fake server) > passes S1-S9…` 期待 `{ ok, passed: 9, total: 9 }`，實得多 `warned: 0`。該欄位來自工作樹中 T0404 未提交的 `scripts/smoke-remote-headless.mjs` diff（`const warned = …`），本單未碰該檔。T0404 收尾時應同步更新該測試。
2. 平行中 T0404 的未提交改動（`electron/pty-manager.ts`、`electron/remote/remote-server.ts`、`electron/remote/headless-entry.ts`、`electron/remote/__tests__/helpers/headless-harness.ts`、`scripts/smoke-remote-headless.mjs`、`electron/__tests__/pty-manager-limits.test.ts`、T0404 工單）皆未納入本單 commit；本單 headless 測試未使用任何 harness 新 API。
3. smoke S9（`scripts/smoke-remote-headless.mjs:656`）原本就接受 `null` 或 `{ loggedIn: boolean }`，本單改動後 WSL smoke 的 S9 evidence 會從 `auth-status → null` 變成 `auth-status → loggedIn=false (none)`，仍 PASS。

**殘餘風險**
- R1：遠端 auth-status 新行為需重新部署 server bundle；未部署前遠端仍回 `null` ⇒ 遠端視窗不會顯示卡片（退化為現行行為，不會壞）。
- R2：登入前已啟動的 SDK session 子行程是否會即時讀到新憑證未實測（不得送真實 API 對話）；若登入後仍失敗，`/new` 重開 session 可解。本單**未**在重新檢查成功時自動 reset session，避免清掉既有對話。
- R3：`cmd` shell 的 `%VAR%` 無法跳脫（`shell-quote.ts` 既有已知限制），路徑含 `%` 時可能被展開；bundle / 安裝路徑實務上不含 `%`。

### Commit
`85916f8` feat(claude): not-logged-in guide card + auth-status parses stdout on exit≠0 (T0402)（`git commit --only`，未 push）

### 回報時間
2026-10-05T02:43:10+08:00
