---
schema_version: 1
schema_kind: workorder
id: T0412
title: "PLAN-037 E：跨視窗安裝執行——requestInstall 佇列（main）+ 遠端 profile 視窗取件、建終端分頁、打入指令 + 完成標記、完成後重新偵測與 toast"
type: impl
status: DONE
started_at: "2026-10-05T03:25:06+08:00"
updated_at: "2026-10-05T03:41:32+08:00"
completed_at: "2026-10-05T03:41:32+08:00"
repo: better-agent-terminal
project: PLAN-037
priority: P2
sizing: L
created_at: "2026-10-05T03:23:47+08:00"
target_version: next
depends_on:
  - T0409
  - T0410
  - T0411
related:
  - "T0407 回報區 §4 執行模型（安裝段）；T0409 / T0410 / T0411 回報區「給後續工單的備註」"
  - "D133；T0413（同批平行，入口；以本單定義的 API 呼叫）"
affects_files:
  - electron/main.ts
  - electron/preload.ts
  - src/types/electron.d.ts
  - src/types/remote-tools.ts
  - src/hooks/useRemoteToolInstall.ts
  - src/lib/remote-tools/
  - src/App.tsx
  - src/components/WorkspaceView.tsx
  - src/components/remote-tools/
  - src/locales/en.json
  - src/locales/zh-TW.json
  - src/locales/zh-CN.json
  - electron/__tests__/
  - src/hooks/__tests__/
  - src/lib/remote-tools/__tests__/
  - src/components/__tests__/
interaction:
  mode_hint: on
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **API 契約（T0413 平行依此實作，不得改名）**：`window.electronAPI.remoteTools.requestInstall({ profileId, toolId, kind })` → `Promise<{ ok: true } | { ok: false, error: string }>`，`kind: 'install' | 'update'`。請求只帶 **toolId + kind**，不帶指令字串；遠端視窗以自己的 `detectHere()` + `buildInstallPlan` / `buildUpdatePlan` 重建指令。"
  - "🔴 T0413 平行中：不得碰 `src/components/setup-wizard/`、`src/components/ProfilePanel.tsx`、`src/components/profiles/`。"
  - "🔴 **不得在任何機器上實際執行安裝**（實機安裝是 T0414）；測試以 mock PTY / fake output 驗證。不得部署到 WSL。"
  - "🔴 `profileId` / `toolId` / `kind` 在 main 端驗證（profileId 比照 `remote:detect-arch`；toolId ∈ `REMOTE_TOOL_IDS`；kind 為二值）。"
  - "🔴 **禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）。不 push。"
---

# T0412 — 跨視窗安裝執行（PLAN-037 E）

## 元資料
- **工單編號**：T0412
- **任務名稱**：remote-tools 安裝執行
- **狀態**：DONE
- **建立時間**：2026-10-05 03:23 (UTC+8)
- **intervention_type**：fire-and-forget
- **預估規模**：L；**降級策略**：先完成「遠端視窗內直接安裝」（範圍 2）並 commit，跨視窗佇列（範圍 1）未完成時回報 PARTIAL

## 背景

已完成：T0409 食譜與完成標記（`wrapWithSentinel` / `createSentinelMatcher` / `generateNonce`）、T0410 面板（`onInstall(plan)` 回呼）、T0411 偵測（`remoteTools.detect(profileId)` 本機短連線、`remoteTools.detectHere()` 遠端視窗內；WSL 實機 smoke S10 PASS）。使用者裁決（T0407 Q2）：確認框之後**自動執行**，安裝分頁開在**遠端 profile 視窗**裡（看得到、可輸入 sudo 密碼、可 Ctrl+C）。

## 範圍

1. **跨視窗佇列（本機視窗 → 遠端視窗）**
   - main：local-only `remote-tools:request-install`（即 preload `requestInstall`）驗證參數 → 暫存 `pendingInstalls: Map<profileId, Request>`（同 profile 新請求覆蓋舊的）→ 沿用 `app:open-new-instance`（`main.ts:3330`）邏輯開啟或聚焦該 profile 的視窗
   - local-only `remote-tools:take-pending-install`：只有**屬於該 profile 的遠端視窗**能取走（以 sender 視窗綁定的 profile 判斷），取走即刪除
2. **遠端視窗執行**（`src/hooks/useRemoteToolInstall.ts` + 掛載點）
   - 遠端連線完成後取件；或遠端視窗內的面板（host `remote-window`）直接觸發
   - `detectHere()` → 依 kind 重建 plan；unsupported ⇒ toast 原因並結束
   - 確保有 workspace（沒有就在遠端 `$HOME` 建「BAT Tools」——名稱與行為在回報區說明）→ 加終端分頁（**不帶 agentPreset**：`claude-cli*` 會注入 `DISABLE_UPDATES`，會擋 `claude install`）→ `createPtyThenLaunch`，`created === true` 才寫入 `wrapWithSentinel(plan.command, nonce) + '\r'`
   - `createSentinelMatcher(nonce)` 掛在該 PTY 的 output；exit 0 ⇒ 重新偵測並 toast 結果（以偵測結果為準：例如工具仍 missing 就顯示「未偵測到」，處理 T0409 指出的 `curl | sh` 失敗仍回 0 的情況）；非 0 ⇒ 保留分頁、toast「安裝失敗，請看終端輸出」
   - 不論成功失敗都提示「已開啟的其他終端分頁需重開才看得到 `~/.local/bin`」
   - 安裝分頁的 shell 必須是 POSIX 系（T0409 備註）；遠端 shell 為 fish 等時改用 `/bin/sh` 或提示
3. 遠端視窗內面板的 `onInstall` 也走範圍 2（不經 main）
4. i18n：toast / 提示文案（三語）

## 驗收條件

- [ ] main 單元測試：參數驗證、佇列覆蓋、只有對應 profile 的視窗能取件、取件後刪除
- [ ] hook 單元測試（mock PTY）：plan 重建、unsupported、`created:false` 不寫入、寫入內容 = sentinel 包裝 + `\r`、matcher 0 / 非 0 分支、成功後重新偵測但工具仍 missing ⇒ 顯示未偵測到
- [ ] 不帶 agentPreset 的斷言
- [ ] `npm run test:unit` 全綠（基線 1514）；`npx tsc --noEmit` ≤ 40；`npx vite build` exit 0；`npm run test:e2e` 0 failed
- [ ] 回報區附 T0414 實機步驟

## Sub-session 執行指示
1. 讀本工單 + T0407 §4 + T0409 / T0410 / T0411 回報區 + `src/lib/pty-replay.ts`（`createPtyThenLaunch`）+ `src/lib/claude-login-guide.ts`（T0402「開終端分頁並打入指令」範本）+ `main.ts:3330`
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 先範圍 2 → commit → 範圍 1 → 驗收
4. 填回報區；完成寫 **`DONE`**（只完成範圍 2 寫 `PARTIAL`）
5. `git commit --only` 實際改動檔 + 本工單；不 push
6. 依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態
DONE —— 範圍 1-4 全部完成，5 項驗收全部通過。未在任何機器上實際安裝；未部署 WSL；未 push。

**落點檢查**：PASS
- C-0：frontmatter `repo: better-agent-terminal` == `basename(REPO_ROOT)` `better-agent-terminal`
- C-1：工單位於 REPO_ROOT 之下
- C-3（資訊性）：前 5 項可測 entry 皆 present（`src/hooks/useRemoteToolInstall.ts` 為新檔 → 最近祖先 `src/hooks/`；其餘本身存在）
- C-2：工單未指定 branch；實際在 `main`
- `BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅作紀錄）
- 執行環境：`CT_MODE=on`、`CT_INTERACTIVE=0`

**驗收**

| # | 項目 | 結果 | 證據 |
|---|------|------|------|
| 1 | main 單元測試 | ✅ PASS | `electron/__tests__/remote-tool-install-queue.test.ts`（28 tests）：<br>• 參數驗證：13 種拒絕（profileId 缺 / 數字 / 空 / `../etc` / 空白 / `;`；toolId 未知 / 大小寫 / `__proto__`；kind 缺 / 其他值），且不回顯輸入<br>• 未知 / local profile 拒絕<br>• 開窗失敗（`remote-unreachable` / throw）⇒ 回錯誤並移除請求<br>• **同 profile 新請求覆蓋舊的**；開窗途中來了新請求，舊請求失敗時不會刪掉新的；不同 profile 互不影響<br>• **只有綁定該 profile 且已連線的視窗能取件**：他 profile / local / null / undefined / 未連線都拿不到，未連線也不會消耗請求<br>• **取件後刪除**；只回 `{ toolId, kind }`；逾時（5 分）丟棄<br>• 兩個 channel 都是 `ipcMain.handle`，不在 `PROXIED_CHANNELS` |
| 2 | hook 單元測試（mock PTY） | ✅ PASS | `src/lib/remote-tools/__tests__/install-runner.test.ts`（48 tests）+ `src/hooks/__tests__/useRemoteToolInstall.test.tsx`（9 tests）：<br>• plan 由 `detectHere()` 重建（install / update / root 無 sudo）<br>• unsupported（node `no-recipe`、git update、`sudo-missing`）⇒ toast 原因，不建分頁<br>• 偵測失敗；舊 server（`No handler for channel`）⇒ `server-too-old`；竄改 env ⇒ `invalidReport` 且不回顯<br>• `created:false` 與 `ok:false` ⇒ 不寫入，監聽解除<br>• 寫入內容 == `wrapWithSentinel(plan.command, nonce) + '\r'`<br>• matcher 0 ⇒ 重新偵測 + success；**0 但工具仍 missing ⇒「未偵測到」**；非 0（ANSI + 跨 chunk）⇒ 失敗 toast、不重新偵測；PTY 先結束 ⇒ aborted；以上結果都附「舊分頁需重開」提示<br>• fish ⇒ `/bin/sh` + 提示<br>• `$HOME` 探測：隱藏 PTY、格式字串回顯不誤判、拒收相對路徑 / `..` / `$(...)`、逾時、結束後 kill<br>• 跨視窗取件：未就緒不取、就緒後取一次、main ping 再取、壞的回應不執行 |
| 3 | 不帶 agentPreset 的斷言 | ✅ PASS | runner：`pty:create` options `not.toHaveProperty('agentPreset')` 加完整 `toEqual`。hook：store 內 terminal 的 `agentPreset` 為 undefined、`pty.create` 呼叫不含 `agentPreset`。直接安裝、BAT Tools、跨視窗三條路徑都有斷言 |
| 4 | 全套 | ✅ PASS | • `npm run test:unit`：105 files、**1614 passed**、1 skipped（基線 1514；本單 +85，其餘是已 commit 的 T0413）<br>• `npx tsc --noEmit`：**40**（= 基線；本單檔案 0 筆）<br>• `npx vite build`：exit 0；`dist-electron/main-*.js` 含 `remote-tools:take-pending-install`、`preload.js` 含 `remote-tools:request-install`<br>• `npm run test:e2e`：**6 passed、8 skipped、0 failed** |
| 5 | 回報區附 T0414 實機步驟 | ✅ PASS | 見下方「T0414 實機步驟」 |

**Commits**（皆 `git commit --only`，未 push）
- `e92e241` feat(remote-tools): run installs in the remote window (T0412 range 2+3, PLAN-037 E) —— 9 檔
- `968fe3f` feat(remote-tools): cross-window install queue (T0412 range 1, PLAN-037 E) —— 8 檔
- 本工單回報另以 chore commit 提交

### 產出摘要

**API 契約（T0413 已依此實作，未改名）**

```ts
window.electronAPI.remoteTools.requestInstall({ profileId, toolId, kind })
  // → Promise<{ ok: true } | { ok: false, error: string }>，kind: 'install' | 'update'
window.electronAPI.remoteTools.takePendingInstall()   // → { toolId, kind } | null（遠端視窗用）
window.electronAPI.remoteTools.onInstallPending(cb)   // → unsubscribe（main ping）
```
- 型別在 `src/types/remote-tools.ts`：`REMOTE_TOOL_INSTALL_KINDS` / `RemoteToolInstallRequest` / `RemoteToolInstallRequestResult`。
- T0413 的 `RemoteToolsEntry` 以 `as RequestInstallApi` 動態偵測這個 API。preload 補上之後安裝鈕就會出現，不需要改 T0413 的檔案。

**檔案**
| 檔案 | 內容 |
|------|------|
| `src/lib/remote-tools/install-request.ts`（新） | main 使用，不 import electron。<br>• `validateRemoteToolInstallRequest`<br>• `PendingRemoteToolInstalls`：`Map<profileId, …>`，新蓋舊，TTL 5 分；`discard` 只丟同一個請求物件<br>• `createRemoteToolInstallIpc(queue, deps)` → `requestInstall` / `takePendingInstall` |
| `electron/main.ts` | • `app:open-new-instance` 本體抽成 `openProfileWindows(profileId)`，行為不變，handler 改為呼叫它<br>• 新增 local-only `remote-tools:request-install`、`remote-tools:take-pending-install`<br>• 取件時：sender → `windowRegistry` entry 的 profileId；「已連線」沿用 `remote:client-status` 的規則（`remoteClient.isConnected && remoteClientProfileId === profileId`）<br>• `notifyProfileWindows` 對該 profile 的視窗送 `remote-tools:install-pending` |
| `electron/preload.ts` / `src/types/electron.d.ts` | `remoteTools.requestInstall` / `takePendingInstall` / `onInstallPending` |
| `src/lib/remote-tools/install-runner.ts`（新） | 純流程（依賴注入）：`runRemoteToolInstall(target, deps)`、`probeRemoteHome`、`selectInstallShell`、`completionNotice`、`parseRemoteToolInstallTarget`、`REMOTE_TOOL_INSTALL_HERE_EVENT` + `requestRemoteToolInstallHere(plan)` |
| `src/hooks/useRemoteToolInstall.ts`（新） | 接上 workspace / settings store、PTY API 與 toast。監聽面板事件（範圍 3）；`takePending` 為真時取件，收到 main ping 時再取（範圍 1） |
| `src/App.tsx` | • 新增 `profileReady`：initProfile 的 `workspaceStore.load()` 完成後設為 true<br>• 掛 `useRemoteToolInstall({ addToast: addRuntimeToast, takePending: profileReady && isRemoteConnected && !detachedWorkspaceId })` |
| `src/locales/{en,zh-TW,zh-CN}.json` | 新 namespace `remoteToolInstall.*`（各 +27 行，純新增）。刻意不放在 `remoteTools.*` 下：T0410 的 completeness 測試要求 `remoteTools.*` 的 key 集合**完全相等**，而該測試檔不在本單 affects_files |

**流程（遠端視窗內）**
1. **重建 plan**：`detectHere()` → `normalizeRecipeEnv` → 依 kind 呼叫 `buildInstallPlan` / `buildUpdatePlan`。
   - 舊 server 的 reject 轉成 `server-too-old`。
   - unsupported ⇒ toast `remoteTools.unsupported.<reason>` 後結束；env 不合法 ⇒ toast 後結束。
2. **工作區**：用目前 active 的；沒有就用第一個未歸檔的；都沒有就建「BAT Tools」（見下節）。
3. **Shell**：與一般終端同一來源（settings `shell` / `customShellPath` → `settings.getShellPath`，proxied 到遠端）。
   - basename 是 `sh` / `bash` / `zsh` / `dash` / `ksh` / `mksh` / `ash` / `yash` 時照用。
   - 其他（fish、nu、xonsh、pwsh…）或解析不到時改用 `/bin/sh`；原本是非 POSIX shell 時另外 toast 說明。
4. **建分頁**：`setActiveWorkspace` → `addTerminal(workspaceId)`（**不帶 agentPreset**）→ 改名「安裝 / 更新 <工具>」→ focus → 在同一個同步區塊內呼叫 `createPtyThenLaunch`。
   - 所有非同步準備都在加分頁前做完。原因：WorkspaceView 的 initTerminals 會在 await 之後用預設 shell 建 PTY，若讓它先跑，就會搶先建立同一個 PTY。
5. **寫入指令**：launch 只在 `created === true` 時被呼叫，延遲 500ms 寫入 `wrapWithSentinel(plan.command, nonce) + '\r'`。
   - `pty:create` 回 `ok:false` 或 `created:false` ⇒ toast「無法開啟終端分頁」，並解除監聽。
6. **完成判定**：`createSentinelMatcher(nonce)` 掛在該 PTY 的 `onOutput`，另外掛 `onExit`。
   - exit 0 ⇒ 再呼叫一次 `detectHere()`，**以偵測結果為準**：
     - `ok` ⇒ 成功
     - `too-old` ⇒ 警告
     - `not-on-path` ⇒ 資訊，附路徑
     - 其他（含 missing，即 `curl | sh` 失敗卻回 0 的情況）⇒「未偵測到」
   - 非 0 ⇒「指令失敗（結束代碼 N），請看終端輸出」，分頁保留。
   - PTY 先結束 ⇒「分頁在指令完成前就關閉了」。
   - exit 0 與非 0 兩種結果之後，都會再 toast「已開啟的其他終端分頁需重開才看得到 `~/.local/bin`」。
   - toast 使用 App 既有的 `CtToast`（`addRuntimeToast`），停留 10 秒。

**「BAT Tools」工作區（名稱與行為）**
- **名稱**：固定 `BAT Tools`，不翻譯，與 T0407 一致。
- **何時建立**：只在視窗內**沒有任何未歸檔工作區**時才建；有工作區就用 active 的那個。
- **路徑**：遠端 `$HOME`。
  - renderer 沒有任何 API 能取得遠端家目錄：`wsl:resolve-home` 只支援 WSL；新增 proxied channel 要改 protocol / headless 並重新部署，不在本單範圍。
  - 因此改用**隱藏探測 PTY**：id `bat-home-probe-<nonce>`，cwd `/`，shell `/bin/sh`，不加進任何工作區（UI 上看不到）。
  - 打入固定指令 `printf '\n__BAT_HOME_%s__%s__END__\n' '<nonce>' "$HOME"`，只插入 nonce。終端回顯的是格式字串，不會出現「nonce + `__/`」的組合，所以不會誤判。
  - 解析出的路徑必須符合 `^/[A-Za-z0-9._@+ /-]{0,510}$` 且不含 `..` 段。8 秒逾時；結束後一律 `pty.kill`。
- **探測失敗**（逾時、路徑不合法）⇒ toast「沒有可開啟安裝分頁的工作區，也找不到遠端家目錄，請先新增工作區」。
- 建立後設為 active，並 `workspaceStore.save()`。

**跨視窗（範圍 1）時序**
1. 本機視窗呼叫 `requestInstall`。
2. main 驗證參數、確認 profile 是 remote，存入佇列（同 profile 新蓋舊）。
3. main 呼叫 `openProfileWindows`：已開就 focus，否則還原或開新視窗。
   - 開窗失敗（例如 `remote-unreachable`）⇒ 移除請求，回 `{ ok: false, error }`。
   - 成功 ⇒ ping 該 profile 的視窗。
4. 遠端視窗在兩個時機取件：
   - `profileReady && isRemoteConnected` 變為 true 時取一次（新開的視窗）。
   - 收到 ping 時（原本就開著的視窗）。
5. 取件是原子操作（取走即刪），兩條路徑不會重複執行。
- 不在 `profileReady` 之前取件，因為 `workspaceStore.load()` 會整個覆寫 state，太早建的分頁會被蓋掉。

**範圍 3（遠端視窗內的面板）**
- `RemoteToolsPanel host="remote-window"` 的 `onInstall` 請用 `requestRemoteToolInstallHere`（`src/lib/remote-tools/install-runner.ts`）。
- 它只送 `{ toolId, kind }` 事件給本視窗的 hook；hook 走同一套流程重建 plan，不經過 main。
- 目前 repo 沒有任何地方以 `host="remote-window"` 掛面板（T0413 只做 wizard / profile），所以這條路徑目前只有測試覆蓋。日後掛面板時直接傳 `onInstall={requestRemoteToolInstallHere}` 即可。

### T0414 實機步驟

**前置**
- 本機用含 `968fe3f` 的 HEAD 跑 `npm run dev`（或打包）。
- WSL server 只需要有 T0411 的 `remote-tools:detect`（已部署，smoke 10/10）。本單**不需要**重新部署 server。

| # | 情境 | 步驟 | 預期 |
|---|------|------|------|
| 1 | 跨視窗、視窗未開 | 關閉 WSL Ubuntu-24.04 profile 視窗 → 在本機視窗的 Profile 面板展開該卡片 → claude「安裝」→ 確認 | WSL 視窗開啟，連線後 active 工作區出現「安裝 Claude Code」分頁，並自動執行 `curl -fsSL https://claude.ai/install.sh \| bash -s stable; printf …`。結束後 toast「Claude Code 已安裝並偵測到」與「舊分頁需重開」 |
| 2 | 不帶 agentPreset | #1 的分頁跑完後，在同一分頁執行 `env \| grep -E 'DISABLE_(UPDATES\|AUTOUPDATER)'` | 只有 `DISABLE_AUTOUPDATER=1`，**沒有** `DISABLE_UPDATES`；同時確認 `claude install` 沒被擋（T0407 剩餘風險 1） |
| 3 | 新 login shell | 在 WSL 視窗開新分頁：`command -v claude; claude --version` | 路徑為 `~/.local/bin/claude`，版本 ≥ 2.1.280。舊分頁的 `command -v claude` 仍是 `/mnt/c/...`（interop），證明「需重開」提示屬實 |
| 4 | 跨視窗、視窗已開 | WSL 視窗保持開啟 → 本機面板對 codex 按「安裝」 | WSL 視窗被 focus，立即出現新分頁並執行（main ping → take） |
| 5 | 新蓋舊 | 視窗未開時，快速對 uv、gh 各按一次安裝 | 只執行最後一個（gh），uv 不執行 |
| 6 | sudo 密碼 | 用沒有 NOPASSWD 的帳號或容器裝 gh（apt） | 分頁停在 sudo 密碼提示，可以輸入。按 Ctrl+C ⇒ toast「指令失敗（結束代碼 130）」，分頁保留 |
| 7 | curl \| sh 失敗卻回 0 | 斷網（或在 `/etc/hosts` 擋 `claude.ai`）後裝 claude | 標記回報 exit 0，但重新偵測後 toast「未偵測到 Claude Code」（T0409 剩餘風險） |
| 8 | 無工作區 ⇒ BAT Tools | 新建一個沒有工作區的 remote profile（或移除該視窗所有工作區）→ 從本機面板安裝 | 出現「BAT Tools」工作區，路徑為遠端 `$HOME`（例如 `/home/gower`），分頁 cwd 正確；遠端 `ps` 沒有殘留 `bat-home-probe-*` 的 shell |
| 9 | fish shell | 遠端 `chsh -s /usr/bin/fish`（或在 Settings 把自訂 shell 指向 fish）→ 安裝 | toast「fish 不是 POSIX shell，改用 /bin/sh」；分頁以 `/bin/sh` 執行，標記正常 |
| 10 | 更新 | claude 已安裝時按「更新」 | 分頁執行 `claude update; printf …`，toast「已更新」 |
| 11 | 開窗失敗 | 停掉 WSL 的 `bat-server.service` 後，從本機面板安裝 | 出現既有的「遠端無法連線」對話框，面板顯示安裝錯誤 `remote-unreachable`。之後恢復 server 再開視窗，**不會**自動安裝（請求已移除） |
| 12 | Docker root、無 sudo | 在 Docker profile 裝 git | 指令不含 `sudo`（`apt-get update && apt-get install -y git` 或 `apk add git`），成功後 toast |
| 13 | 逾時 | 視窗已開但連不上 server（未連線），超過 5 分鐘後才連上 | 不安裝（請求已過期） |

### 互動紀錄
無

### Renew 歷程
無

### 遭遇問題
1. **全 app 只有一條遠端連線**（既有架構，本單未改）：
   - `main.ts` 的 `remoteClient` / `remoteClientProfileId` 是單一全域變數，`remote:client-status` 只對最後連線的 profile 視窗回 `connected`。
   - 取件沿用同一規則，所以同時開兩個遠端 profile 視窗時，只有最後連線的那個能取件。
   - 另一個 profile 的請求會留在佇列，等該視窗重新連線，或 5 分鐘後過期。
2. **新分頁不一定看得到**：分頁會加到正確的工作區，並設為 active、取得 focus。但 WorkspaceView 的子頁籤（Terminal / Files / Git…）是元件內部狀態；使用者停在 Files 頁籤時，要自己切回 Terminal 才看得到。
3. **`$HOME` 探測需要一個暫時 PTY**：只在沒有工作區時執行，會短暫佔用遠端 PTY 配額（T0404 `maxInstances`）一格，結束即 kill。
4. **本機面板完成後不會自動更新**：本機視窗的 RemoteToolsPanel 不知道遠端已經裝完，要按「重新檢查」；結果 toast 顯示在遠端視窗。
5. **i18n namespace**：用 `remoteToolInstall.*` 而不是 `remoteTools.install.*`（原因見產出摘要）。若塔台希望併入 `remoteTools.*`，需要另開單，同步修改 `i18n-completeness.test.ts` 的預期 key 清單。
6. **測試檔曾跨測試污染**（產品碼未受影響）：前一個測試遺留的 500ms 延遲寫入，透過 mock closure 寫進了下一個測試的 `api`。已改成每個測試的 closure 綁定自己的 state 物件。
7. Git Bash 的 heredoc 一度解析失敗（`unexpected EOF while looking for matching`），改用 Write / Edit 工具寫入回報區。只影響工單編輯手法。

### 回報時間
2026-10-05T03:39:17+08:00
