---
schema_version: 1
schema_kind: workorder
id: T0599
title: "BUG-152：helper 派出的 Worker 分頁不搶鍵盤焦點（D154）"
type: bugfix
status: FIXED
repo: better-agent-terminal
project: PLAN-047
priority: P2
sizing: S
created_at: "2026-10-18T03:13:30+0800"
started_at: "2026-10-18T03:15:32+0800"
updated_at: "2026-10-18T03:27:14+0800"
completed_at: "2026-10-18T03:27:14+0800"
commit: 95cfa2b0
depends_on: [T0598]
related:
  - BUG-152
  - D154
  - "BUG-135 / T0532（`addExternalTerminal` 落在非 active 工作區不搶 focus 的既有規則；`src/stores/__tests__/workspace-store.focusFallback.test.ts`）"
  - "T0598 回報區（焦點被搶的日誌與機制）"
  - "並行工單 T0600（Worker 啟動確認：hook / helper / query channel，不碰 renderer store）"
affects_files:
  - src/stores/workspace-store.ts
  - "src/App.tsx / src/components/WorkspaceView.tsx / src/components/TerminalPanel.tsx（只在外部分頁加入或 focus 路徑需要時）"
  - "electron/ 下送出外部分頁事件給 renderer 的位置（只在需要帶「來源 = helper 派工」標記時；不得碰 T0600 的檔案：`electron/terminal-blocked-state.ts`、`electron/bat-mcp-launch.ts`、`electron/terminal-query-handlers.ts`、`scripts/bat-hook.mjs`、`scripts/bat-terminal.mjs`、`scripts/bat-mcp.mjs`）"
  - "src/stores/__tests__/workspace-store.focusFallback.test.ts 或新增的對應測試"
  - "e2e/（新增一支：派工時焦點留在塔台分頁）"
  - "docs/agent-guide/（找到描述外部分頁焦點的主題檔時一併更新；沒有則在 worker-tab-recycle.md 或 bat-mcp-shim.md 補一句）"
  - _ct-workorders/T0599-dispatched-worker-tab-no-focus-steal.md
renew_count: 0
workdir: main repo
interaction:
  mode_hint: on
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 不 push、不觸發 workflow、不建 tag、不改版號；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF；含反斜線的內容用 Write / Edit 工具（L129）。`src/styles/settings.css` 的 M 不是你的變更。"
  - "🔴 並行：T0600 同時在主 checkout 改 hook / helper / query channel 相關檔與 `CLAUDE.md`。你不碰它的檔；`CLAUDE.md` 原則上不改（若必須改，只 commit 自己的 hunk）。commit 一律 `git commit --only <你的檔>`，commit 前 `git diff --cached` 只能有你的變更。"
  - "🔴 範圍（D154）：只有 helper 派出的分頁（`terminal:create-agent-command` / `terminal:create-with-command` 經 helper 建立）不搶焦點。手動開的分頁（`+` 選單、快捷鍵）、UI 上的 ct-exec / ct-done 按鈕、還原分頁的行為一律不變。不加 Settings 開關。"
  - "🔴 不得在使用者正在使用的 BAT 分頁送任何輸入；實機重現用隔離實例或 e2e。"
---

# T0599 — helper 派出的 Worker 分頁不搶焦點

## 背景

BUG-152。`addExternalTerminal`（`src/stores/workspace-store.ts`）在分頁落在 active 工作區時設 `focusedTerminalId`，TerminalPanel 的 `isActive` effect 隨之 `terminal.focus()`。塔台派工時使用者常在塔台分頁打字，焦點被搶走後字跑進 Worker 分頁（BUG-151 的觸發條件；T0598 已讓輸入不再破壞啟動指令，但仍誤送）。

## 要做的事

1. 找出 helper 派出的分頁如何進入 renderer（`addExternalTerminal` 的呼叫端與 main 送出的事件），判斷能否辨識「helper 派工」來源；不能時在事件 payload 加一個來源標記（不改 helper 對外契約）。
2. helper 派工的分頁：加入分頁清單與縮圖、維持既有標題規則（`externalTerminalTitle`），但**不**改變 `focusedTerminalId`、不呼叫 `terminal.focus()`、不切換目前顯示的分頁。若目前顯示的分頁會被切換（active terminal），一併保持不變，並在回報區說明原本的行為。
3. 其他來源（手動、UI 按鈕、還原、detached 取回）行為不變；既有 BUG-135 測試全綠。
4. 測試：store 單元測試（helper 來源不搶 focus / 其他來源照舊）；e2e（隔離實例：塔台分頁取得焦點 → helper 派工 → 焦點仍在塔台分頁，於塔台分頁打字只進塔台 PTY；Worker 分頁照常出現在清單）。

## 驗收

- `npm run test:unit` 全綠（回報 passed / files 數）；`npm run typecheck` = 0；`npm run typecheck:electron` = 0；`npx vite build` 成功；新增 e2e 與 `e2e/t0598-dispatch-input-before-command.spec.ts`、`e2e/t0523-dispatch-workspace.spec.ts` 通過。
- 回報區：原本的焦點 / active 分頁行為、改動摘要、測試、實機驗收步驟（給使用者：在塔台分頁打字時派一張單，字仍留在塔台分頁）。
- commit 只含 `affects_files`；訊息 `fix(dispatch): …（BUG-152, T0599）`。

---

## 回報區

### 結果摘要

✅ FIXED。helper 派出的 Worker 分頁不再搶鍵盤焦點，也不切換顯示中的分頁；其他來源行為不變。product commit `95cfa2b0`。

### Landing check

- PASS。C-0：`repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal` → PASS；C-1 PASS（工單在 `REPO_ROOT/_ct-workorders/` 下）；C-3：前 5 個可測項目都存在 → PASS；C-2：工單無 `branch` 欄位（目前 `main`）。
- `CT_HOME` 未設（非 worktree 隔離）；`CT_MODE=yolo`、`CT_INTERACTIVE=0`；`BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）。

### 原本的焦點 / active 分頁行為

- `addExternalTerminal`（`src/stores/workspace-store.ts`）只由 `App.tsx` 的 `onCreatedExternally` 呼叫；`terminal:created-externally` 只在呼叫端沒有視窗（`!_ctx.windowId`）時由 `createWithCommand`（`electron/terminal-command-handlers.ts`）發出，也就是 helper 或其他經 RemoteServer 的呼叫者。UI 的 `+`、ct-exec / ct-done 按鈕都是先 `addTerminal` 再 `createWithCommand`，帶 windowId，不經這條路。
- 分頁落在 active 工作區時把 `focusedTerminalId` 設成新分頁。WorkspaceView 顯示的分頁就是 `focusedTerminalId`（`mainTerminal`，`.terminal-wrapper.active`），所以**顯示中的分頁和鍵盤焦點一起換到 Worker**：MainPanel `isActive` 跟著換，TerminalPanel `isActive` effect 在 rAF 內呼叫 `terminal.focus()`。落在非 active 工作區時本來就不搶（BUG-135 / T0532）。
- 可辨識性：main 能辨識。helper 經範圍權杖連線時 `invokeHandler` 帶 `HandlerContext.helper`（T0582），正式環境的 `create-agent-command` 直接呼叫 `createWithCommand(_ctx, …)`（`handlers/terminal.ts` 沒傳 `invokeHandler`），所以 helper 身分一路傳得到。server-token 連線（例如另一個 BAT 以遠端 profile 連進來的視窗）沒有 `helper`。

### 改動摘要

- `electron/terminal-command-handlers.ts`：`HandlerContext.helper` 存在時，`terminal:created-externally` payload 加 `dispatchedByHelper: true`。本檔的區域 `HandlerContext` 補 `helper?: HandlerHelperIdentity`（type import）。helper 對外契約、exit code 都不變。另外更新 T0598 註解（新分頁「已有焦點」改成「可能有」）。
- `src/stores/workspace-store.ts` `addExternalTerminal`：`takesFocus = 落在 active 工作區 && !info.dispatchedByHelper`；分頁照常加入清單 / 縮圖，標題照 `externalTerminalTitle`。
- `electron/preload.ts`、`src/types/electron.d.ts`：事件型別加 `dispatchedByHelper?: boolean`（只改型別；preload 本來就整包轉送 payload）。
- `docs/agent-guide/bat-mcp-shim.md`：BUG-151 段原本寫「焦點未改」，改成指向新增的 BUG-152 段（範圍、原行為、修正、副作用、驗證）。CLAUDE.md 沒有改。
- 遠端 headless：handler 共用，helper 派工同樣帶標記；path-aware 轉送只多蓋 `remote: true`，其他欄位保留。

### 偏離 / 附註

- `electron/preload.ts`、`src/types/electron.d.ts` 不在 `affects_files` 的字面清單內，但屬於「送外部分頁事件給 renderer」的型別鏡像，只改型別。
- `deps.invokeHandler` 轉呼叫（`create-agent-command` → `create-with-command`，只有舊測試注入，正式環境 Electron / headless 都沒注入）不會傳 `helper`，所以走那條路時不會帶標記。這次沒改它的簽章。
- 以 server token 從外部呼叫 helper 腳本（例如 e2e `t0598` / `t0551` 從測試程序直接跑）的情況沒有標記，行為與以前相同，仍會搶焦點。實際塔台在分頁內用的是 `batcap.` 範圍權杖，會帶標記。
- 副作用：Worker 分頁在使用者第一次切過去之前不會 fit，PTY 維持 spawn 尺寸 120x30。這是 T0572 已知的「背景分頁」限制，已寫進 docs。

### 測試

- `npm run test:unit`：**5086 passed / 7 failed / 3 skipped（292 files：288 passed / 4 failed）**。7 個失敗全在 T0600 同時在改、尚未 commit 的範圍：`electron/__tests__/blocked-hooks-launch.test.ts`、`electron/__tests__/terminal-blocked-state.test.ts`、`electron/__tests__/terminal-query-handlers.test.ts`、`scripts/__tests__/bat-hook.test.mjs`。斷言差異是「多一個 hook 事件 / 多一個 state 欄位」（6 vs 5 項、8 vs 7 欄），來源是 T0600 未 commit 的 `bat-mcp-launch.ts` / `terminal-blocked-state.ts` / `terminal-query-handlers.ts` / `bat-hook.mjs`，與本單無關。本單相關的檔都綠：`workspace-store.focusFallback.test.ts`（+3：helper 在 active 工作區不搶、在非 active 不搶、沒有標記照舊；既有 BUG-135 測試全綠）、`terminal-handlers.test.ts`（+1：helper ctx 的 agent / raw 派工帶 `dispatchedByHelper`，server-token client 不帶）、`workspace-store-remote-external-terminal.test.ts`、`terminal-command-handlers.test.ts`、`headless-electron-free.test.ts`。
- `npm run typecheck` = 0；`npm run typecheck:electron` = 0（第一次跑出 1 個 TS2339 `helper`，補型別後為 0）。
- `npx vite build` 成功。
- e2e（隔離實例，先 `npx vite build`）：`e2e/t0599-dispatch-no-focus-steal.spec.ts`、`e2e/t0598-dispatch-input-before-command.spec.ts`、`e2e/t0523-dispatch-workspace.spec.ts` → **3 passed**。
  - t0599 的流程：塔台分頁取得焦點 → 在塔台分頁內用自己的 `batcap.` 權杖派工（自訂 CLI 跑 `echo`，不耗 token）→ `created-externally` 帶 `dispatchedByHelper: true` → Worker 分頁出現（2 個 wrapper），顯示中的仍是塔台分頁（index 0），焦點在其中 → Worker 的啟動指令照常執行 → 鍵盤輸入 `echo T0599TYPED` + Enter 只出現在塔台 PTY 輸出，Worker 輸出裡沒有。
  - 反向驗證：暫時拿掉 store 的 `!info.dispatchedByHelper` 再 build，t0599 失敗（顯示中的分頁 index = 1，也就是 Worker）。還原後重新 build，3 支都通過。
- 驗證時的 HEAD：`38dd75b8`（主 checkout 含 T0600 未 commit 的變更）。

### 實機驗收步驟（給使用者）

1. 安裝含本修正的版本後，開一個塔台分頁（claude / codex），讓它停在輸入框。
2. 請塔台派一張單（helper `bat-terminal.mjs … --skill ct-exec --workorder T####`）。在 Worker 分頁出現的前後，一直在塔台分頁打字。
3. 預期：Worker 分頁出現在分頁列 / 縮圖，標題照舊（`<Agent> · Worker · T####`）。畫面仍停在塔台分頁，打的字全部留在塔台的輸入框，Worker 分頁裡沒有那些字，啟動指令也正常。
4. 對照：用 `+` 開新分頁、或在 Control Tower 面板按 ct-exec / ct-done，仍會切到新分頁並取得焦點（行為不變）。

### Commit

- `95cfa2b0` fix(dispatch): helper-dispatched Worker tabs no longer take the keyboard focus（BUG-152, T0599）。用 `git commit --only` 提交 8 個檔，不含 T0600 的檔與 `src/styles/settings.css`。未 push。
- 工單檔另以一個 commit 提交。

### 互動紀錄

- 無（yolo，沒有向塔台提問）。
