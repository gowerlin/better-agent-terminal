---
schema_version: 1
schema_kind: workorder
id: T0403
title: "PLAN-036 遠端終端收尾 A：斷線期間輸出回放（pty:get-buffer）+ pty:create 回報是否新 spawn（還原 agent preset 不重打啟動指令）"
type: impl
status: DONE
started_at: "2026-10-05T01:54:57+08:00"
updated_at: "2026-10-05T02:07:47+08:00"
completed_at: "2026-10-05T02:07:47+08:00"
repo: better-agent-terminal
project: PLAN-036
priority: P1
sizing: M
created_at: "2026-10-05T01:53:54+08:00"
target_version: next
depends_on:
  - T0390
  - T0398
related:
  - "PLAN-036「P1 候選（T0390 回報，2026-10-05 00:41）」第 1、3 點；D130 波次 ②"
  - "T0396 smoke（`npm run smoke:remote:headless`）：S5 冪等、S6 斷線重連"
affects_files:
  - electron/pty-manager.ts
  - electron/handlers/pty.ts
  - electron/remote/protocol.ts
  - electron/remote/headless-channel-status.ts
  - electron/preload.ts
  - src/types/electron.d.ts
  - src/components/
  - src/stores/workspace-store.ts
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
  - "🔴 **相容性硬性要求**：client 必須同時能對接「舊 server」——使用者的 SSH / Docker / 其他 WSL 遠端可能仍跑 baseline bundle，`pty:create` 回 `true`、沒有 `pty:get-buffer`。舊回傳值一律視為「新建」（維持現行行為）；`pty:get-buffer` 回 `No handler` 時靜默略過回放。"
  - "🔴 **不得部署到 WSL、不得 restart `bat-server.service`**：完成後由塔台部署並跑 smoke。"
  - "🔴 本機 Terminal Server 模式（預設）與 direct 模式行為都要涵蓋；本機 BAT 重開 / View→Reload（T0111 recovery 路徑）不得回歸。"
  - "🔴 **禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）。不 push。"
---

# T0403 — PTY 回放 + create 結果（PLAN-036 遠端終端收尾 A）

## 元資料
- **工單編號**：T0403
- **任務名稱**：斷線輸出回放 + pty:create 是否新 spawn
- **狀態**：DONE
- **建立時間**：2026-10-05 01:53 (UTC+8)
- **intervention_type**：fire-and-forget
- **affects_files**：見 frontmatter（`main.ts` 若必須改，限最少行數並在回報區說明）

## 背景

PLAN-036 P0 後，遠端（WSL headless）PTY 在 client 斷線時不會被 kill（T0390；T0396 S6 實證），但有兩個體驗缺口（T0390 回報）：

1. **重開 BAT 後還原的遠端終端畫面是空的**，要按 Enter 才看到 prompt —— 斷線期間的輸出沒有回放
2. **`pty:create` 冪等後**，renderer 還原 terminal-driven agent preset（例如 claude-cli 分頁）時會把啟動指令**再打一次**進仍在跑 agent 的 shell。本機 Terminal Server 模式自 T0111 起就有同樣問題

現況：`pty-manager.ts` 有 `outputRingBuffers`（:409 `appendToRingBuffer`，以 `\n` 切行、留 50 行，供 supervisor 查詢 `getLastOutput`）——切行會丟掉 VT escape 的上下文，不適合直接拿來回放。`pty:create` handler 在 `electron/handlers/pty.ts:57`。

## 範圍

### A. `pty:create` 回報是否新 spawn
- 回傳值改為可區分「新建」與「已存在」（形狀由 Worker 決定，例如 `{ ok: true, created: boolean }`），**本機 IPC 與遠端 headless 同一份實作**（`handlers/pty.ts`）
- renderer 端以 helper 正規化回傳：`true` / 舊形狀 ⇒ `created: true`
- 還原 agent preset 時：`created === false` ⇒ **不送啟動指令**

### B. `pty:get-buffer(id)` 回放
- 新 channel，加入 `PROXIED_CHANNELS` 與 headless 註冊（parity 清單同步）；**結果只回呼叫者**，不廣播
- 新增 raw output buffer（與 supervisor 用的行式 ring buffer 分開），以位元組數上限（建議 256 KB / PTY，Worker 可調並說明）裁切；裁切點不得落在 ESC 序列中間（建議裁到某個 `\n` 之後）
- renderer：`created === false` 的終端先寫入 buffer，再接即時輸出。處理「取 buffer」與「即時 `pty:output`」之間的重疊（建議 buffer 帶序號 / 長度，renderer 丟棄重疊部分；做法由 Worker 決定並在回報區說明）
- PTY 結束（`pty:exit` / kill）時釋放 buffer

## 驗收條件

- [ ] unit：create 回傳兩種狀態；舊回傳值正規化；agent preset 還原在 `created:false` 時不送指令、`true` / 舊值時照送
- [ ] unit：raw buffer 上限裁切不切斷 ESC 序列、kill 後釋放、get-buffer 不廣播
- [ ] headless 整合測試（沿用 `electron/remote/__tests__/` 的 harness）：create → write marker → 斷線 → 重連 → `pty:create` 回 `created:false` → `pty:get-buffer` 含 marker
- [ ] parity / electron-free 守門測試仍綠
- [ ] `npm run test:unit` 全綠（基線 1191）；`npx tsc --noEmit` ≤ 40；`npx vite build` exit 0；`npm run test:e2e` 0 failed
- [ ] 回報區附「塔台實機驗收步驟」：部署後在 WSL 遠端視窗開 claude-cli 分頁 → 關 BAT 重開 → 畫面有回放、agent 沒被重打指令

## 不在範圍

- 孤兒 PTY 回收、BUG-103（T0404）
- `claude:*`（T0401）

## Sub-session 執行指示

1. 讀本工單 + PLAN-036 P1 候選段 + `electron/handlers/pty.ts` + `electron/pty-manager.ts`（create / output / ring buffer）+ renderer 還原與 agent preset 啟動流程（`src/components/WorkspaceView.tsx`、`src/stores/workspace-store.ts`、`src/App.tsx` T0111 段，依實際位置）
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

落點檢查：**PASS** —— C-0 `repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal`；C-1 工單在 REPO_ROOT 下；C-3 `affects_files` 前 5 項皆存在；C-2 無 `branch` 欄位（main）。`BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）。`CT_MODE=on`、`CT_INTERACTIVE=0`。

### 產出摘要

**A. `pty:create` 回報是否新 spawn**
- `electron/pty-manager.ts`：新增 `createWithResult(options) → { ok, created }`（`created = ok && 呼叫前 id 不在 instances`）。既有 `create()` 回 boolean 不變（`terminal-command-handlers.ts` / `restart()` / 既有測試照用）。
- `electron/handlers/pty.ts`（本機 IPC 與 headless 共用同一份）：`pty:create` 改回 `PtyCreateResult`；shell 被拒 / manager 未就緒回 `{ ok: false, created: false }`。
- `src/types/index.ts`：`PtyCreateResult` / `PtyReplayBuffer` 型別；`src/types/electron.d.ts`：`create` 回 `Promise<PtyCreateResult | boolean>`、新增 `getBuffer`。
- `src/lib/pty-replay.ts`（新）：`normalizePtyCreateResult`（`true` / `false` / undefined / 舊形狀 ⇒ `created: true`）、`createPtyWithReplay`、`createPtyThenLaunch(options, launch)`（`created === false` 不呼叫 `launch`）。
- `src/components/WorkspaceView.tsx`：還原迴圈的 terminal-driven agent preset 與 `startClaudeCliPty`（claude-cli / claude-cli-worktree，還原與新建共用）改走 `createPtyThenLaunch` ⇒ `created:false` 不送啟動指令（log `[T0403] ... launch command skipped`）；無 preset 的還原終端走 `createPtyWithReplay`（只為了回放）。新建終端（新 id）未動。

**B. `pty:get-buffer(id)` 回放**
- `PtyManager`：新增 raw replay buffer（`replayBuffers`，與 supervisor 用的 50 行 `outputRingBuffers` 分開），在 `flushPtyOutputs` 中**緊接 `pty:output` 廣播之後、同一 tick** append；`getReplayBuffer(id)` 回 `{ data, total }`（PTY 不存在回 `null`）。`kill`（server / direct 兩分支）、`pty:exit`（`handlePtyExit` / `handleDirectExit`，stale exit 不動）、`dispose` 時釋放；exit 後才 flush 的殘餘輸出不寫入。
- Terminal Server 重連回放（T0108 `handleReplayBuffer`）：buffer 為空時以 server 的行式回放**種入**，之後 View→Reload 仍有歷史；已有內容則不種（避免重複）。
- `pty:get-buffer` 註冊於 `handlers/pty.ts`（headless 自動上線）、加入 `PROXIED_CHANNELS`、`preload.ts` `pty.getBuffer`；結果只走 invoke-result 回呼叫者。`headless-channel-status.ts` 只補註解（channel 已註冊 ⇒ 不需列 unsupported，parity 綠）。
- `src/components/TerminalPanel.tsx`：輸出改經 `PtyOutputReplayer`；mount 時 `registerPtyReplaySink(terminalId, …)`。`created:false` 時（不論 create 在 mount 前或後完成）做一次回放；舊 server 回 `No handler` ⇒ 靜默略過、排隊中的即時輸出照序寫出。

**改動檔案**
- 產品：`electron/pty-manager.ts`、`electron/handlers/pty.ts`、`electron/remote/protocol.ts`、`electron/remote/headless-channel-status.ts`（註解）、`electron/preload.ts`、`src/types/electron.d.ts`、`src/types/index.ts`、`src/lib/pty-replay.ts`（新）、`src/components/TerminalPanel.tsx`、`src/components/WorkspaceView.tsx`
- 測試：`electron/__tests__/pty-replay-buffer.test.ts`（新，13）、`src/lib/__tests__/pty-replay.test.ts`（新，17）、`electron/remote/__tests__/headless-pty.test.ts`（改形狀 + 新增斷線回放整合測試）、`scripts/__tests__/smoke-remote-headless.test.mjs`（+2）、`e2e/plan036-p0.spec.ts`（1 行斷言）
- 工具：`scripts/smoke-remote-headless.mjs`
- `main.ts`：**未改**

### 設計說明（回傳形狀 / buffer 上限 / 重疊處理）

**回傳形狀**：`pty:create` → `{ ok: boolean, created: boolean }`。`created:false` = id 已有運行中的 PTY，未 spawn。舊 client 只看 truthiness（renderer 過去 fire-and-forget）不受影響；新 client 對接舊 server（bare `true` / 無 `pty:get-buffer`）時：`normalizePtyCreateResult(true) = { ok: true, created: true }` ⇒ 照舊送指令、不回放；`pty:get-buffer` reject 時 `PtyOutputReplayer` 吞掉錯誤、把排隊輸出照序寫出。

**`pty:get-buffer` → `{ data, total }`**：`data` = raw 輸出尾段（VT 序列完整保留）；`total` = spawn 以來累計字元數（`total - data.length` = `data` 在串流中的起點，供診斷 / 日後序號化）。

**Buffer 上限**：`REPLAY_BUFFER_MAX_CHARS = 256 * 1024`（UTF-16 code units，即 JS 字串長度，非位元組；以免每次 flush 都算 `Buffer.byteLength`）。超過 cap + 64K slack 才裁一次（忙碌終端不會每 16ms 重拷 256K），裁回 ≤ 256K。裁切點 `trimReplayBuffer`：視窗內第一個 `\n` 之後 → 沒有 `\n`（全螢幕 TUI 只用游標定位重繪）則從第一個 ESC 起（序列開頭、不會落在中間）→ 純文字則避開 surrogate pair 下半。

**重疊處理**（content-based，不依賴事件與 invoke reply 的到達順序）：
1. host 端 append 與廣播在同一 tick（先廣播再 append），所以 buffer 裡的每一段都已廣播過；buffer 一定在某個 flush 分段邊界結束。
2. renderer 開始回放時把即時 `pty:output` 排隊；reply 到達後，佇列中「已廣播且在讀 buffer 前」的分段恰好構成 buffer 的結尾 ⇒ `dropReplayedChunks` 丟掉「串接後為 buffer 後綴」的最長前綴，其餘接在 buffer 之後寫出。即使 WS 一次解出多個 frame、事件超前 invoke reply（ws 同步 emit）也正確。
3. TerminalPanel 通常比 `initTerminals` 先 mount（子 effect 先跑），create 回來前可能已寫入少量即時輸出；buffer 是其超集 ⇒ 若回放前已寫過即時輸出，先 `terminal.reset()` 再寫 buffer。create 先回來、view 後 mount 時由 registry 暫存請求，mount 即回放（此時畫面為空，不 reset）。

**涵蓋模式**
- 遠端 headless（direct mode）：buffer 跨 client 斷線存活 ⇒ 重開 BAT 有回放（本工單主目標）。
- 本機 direct / Terminal Server 模式 View→Reload：main 未重啟、instances 在 ⇒ `created:false` ⇒ 回放 + 不重打 agent 指令（T0111 起的同一缺陷一併修掉）。
- 本機 BAT 重開 + Terminal Server 存活：既有 T0108 行式回放廣播行為不變，另外種入 replay buffer。
- 本機 BAT 重開 + direct：PTY 已死 ⇒ `created:true` ⇒ 行為與以前相同。

**範圍外但必要的改動**（未列在 `affects_files`，回報備查）
- `scripts/smoke-remote-headless.mjs`：S3 / S5 原本嚴格 `=== true`，新形狀會讓塔台部署後跑 smoke 直接 FAIL。新增 `ptyCreateOutcome()` 同時接受新 / 舊 server；S5 對新 server 另要求 `created:false`。測試 +2（舊 server 形狀 8/8 PASS、新 server 誤報 `created:true` 時 S5 FAIL）。
- `e2e/plan036-p0.spec.ts`：E2 的 `expect(created).toBe(true)` → `toEqual({ ok: true, created: true })`。
- `src/types/index.ts`（型別）、`src/lib/pty-replay.ts` + 測試：沿用 repo 慣例放 `src/lib/`（同 `claude-error-classify.ts`），而非塞進 `src/components/`。agent preset 還原的「送不送指令」抽成 `createPtyThenLaunch` 在 `src/lib/__tests__` 做 unit 測試，未另寫 WorkspaceView 元件級測試（該元件相依過重）。

### 驗證結果

| 閘門 | 結果 |
|---|---|
| unit：create 兩種狀態 / 舊值正規化 / agent preset `created:false` 不送、`true` 與舊值照送 | ✅ `src/lib/__tests__/pty-replay.test.ts`、`electron/__tests__/pty-replay-buffer.test.ts` |
| unit：裁切不切 ESC、kill / exit 釋放、get-buffer 不 emit | ✅ 同上 |
| headless 整合（真 node-pty）：create → marker → 斷線 → 斷線期間延遲 marker → 重連 → `created:false` → `pty:get-buffer` 含兩個 marker、含 ESC、旁觀 client 沒收到、kill 後 `null` | ✅ `headless-pty.test.ts` T0403 案例 |
| parity / electron-free / proxied-binding 守門 | ✅ 4 files 30 tests |
| `npm run test:unit` | ✅ **84 files / 1224 passed**（基線 1191，+33） |
| `npx tsc --noEmit` | ✅ **40**（≤ 40） |
| `npx vite build` | ✅ exit 0 |
| `npm run test:e2e` | ✅ **6 passed / 8 skipped / 0 failed**（含 E2 BUG-101） |
| WSL 部署 / smoke / 實機 | ⏸ 依工單由塔台執行（未部署、未 restart `bat-server.service`） |

### 塔台實機驗收步驟

1. 部署：`npm run deploy:headless:dev -- --target wsl:Ubuntu-24.04 --expect-string pty:get-buffer --yes`（restart 後確認 `active`、指紋不變）。
2. 協定層：`npm run smoke:remote:headless -- --target wsl:Ubuntu-24.04` 應 8/8；S3 detail 顯示 `{"ok":true,"created":true}`、S5 顯示 `{"ok":true,"created":false}` 且 `$$` 不變。（同版 smoke 對舊 server 也應 8/8，S3/S5 顯示 `true`。）
3. BAT 本體需含本 commit（source build 或重新打包）。
4. WSL 遠端視窗：開一般終端，跑 `for i in $(seq 1 30); do echo line-$i; done`；再開 claude-cli 分頁，等 claude 出現輸入框，打一句話讓它回應。
5. 在 claude 回應中或之後**關閉 BAT**，等 10 秒（可另在 WSL 內 `touch` 檔案製造斷線期間變化），重開 BAT 並開同一 WSL 遠端視窗。
6. 預期：
   - 一般終端**不需按 Enter** 即看到 `line-1..30` 與 prompt；
   - claude-cli 分頁顯示 claude 先前畫面，**輸入框內沒有被打入 claude 執行檔路徑**（`debug.log` 有 `[T0403] claude-cli terminal=… launch command skipped` 與 `[T0403] replay terminal=… chars=N`）；
   - 新開的 claude-cli 分頁仍正常自動啟動 claude（`created:true` 路徑）。
7. 本機回歸：本機視窗開 claude-cli 分頁 → View→Reload → 同上（畫面回放、不重打指令）；BAT 完整重開（Terminal Server 復原提示選復原 / 新開兩條）照舊可用。

### 互動紀錄
無

### Renew 歷程
無

### 遭遇問題
- 無阻塞。
- 已知限制 / 後續候選：
  1. 回放只寫進 xterm；Thumbnail 預覽與 activity 指示只吃即時事件，還原後縮圖要等新輸出才有內容。
  2. 本機 Terminal Server crash 復原（`handleServerDeath` 重建 PTY）不清 replay buffer，新 shell 的回放會帶舊 shell 的尾段（無害，可視為歷史）。
  3. claude-cli-worktree 還原時仍先呼叫 `worktree:create`（既有行為，未動）。
  4. 全螢幕 TUI 若 256K 內完全沒有 `\n`，回放從某個 ESC 序列開頭起，前段模式狀態（例如 alt screen 切換）可能不在 buffer 內；claude-cli 實測輸出含 `\r\n`，影響有限。

### 回報時間
2026-10-05 02:07 (UTC+8)
