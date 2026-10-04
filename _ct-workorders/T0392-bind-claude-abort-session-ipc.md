---
schema_version: 1
schema_kind: workorder
id: T0392
title: "BUG-095 修復：`claude:abort-session` 綁上 IPC，並以測試守住「registerHandler 了卻沒有 IPC 綁定」的孤兒 channel"
type: implementation
status: IN_PROGRESS
priority: P1
sizing: S
created_at: "2026-10-04T23:58:00+08:00"
updated_at: "2026-10-05T00:02:02+08:00"
started_at: "2026-10-05T00:02:02+08:00"
completed_at: null
target_version: next
depends_on: []
related:
  - "BUG-095（修復對象）"
  - "T0386 回報區 §1"
  - "T0388（平行；parity test 以 `PROXIED_CHANNELS` 為準）"
affects_files:
  - electron/remote/protocol.ts
  - electron/remote/__tests__/
  - electron/__tests__/
interaction:
  mode_hint: on
  interactive: false
  intervention_type: none
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）。"
  - "🔴 本單**不改** `electron/main.ts`（T0387 執行中）。若修復必須改 `main.ts`，停下回報 PARTIAL 由塔台排程。"
  - "⚠️ T0388 平行建立 headless parity test（`PROXIED_CHANNELS` 每個 channel 需 headless 有 handler 或列入 `HEADLESS_UNSUPPORTED`）：若 T0388 已先 commit，新增到 `PROXIED_CHANNELS` 的 channel 需同步列入其 `HEADLESS_UNSUPPORTED`（P1）。不 push。"
---

# T0392 — 綁定 `claude:abort-session`

## 背景（BUG-095）

`claude:abort-session` 只 `registerHandler`（`electron/main.ts:2303`），不在 `PROXIED_CHANNELS`（`electron/remote/protocol.ts`），因此 `bindProxiedHandlersToIpc()`（`main.ts:3062-3089`）不會綁 `ipcMain.handle`；Claude / Codex 面板中止呼叫應一律 reject。

## 範圍

1. 盤點：`electron/main.ts`（及其他 `registerHandler` 呼叫檔，如 `electron/git/git-ipc.ts`）中所有 `registerHandler(channel, …)`，對照 `PROXIED_CHANNELS` 與獨立的 `ipcMain.handle(channel, …)`，列出孤兒清單（回報區表格：channel / 註冊位置 / renderer 呼叫點 / 影響）
2. 修復：把 `claude:abort-session`（及盤點出的其他確有 renderer 呼叫的孤兒）加入 `PROXIED_CHANNELS`
3. **守門測試**：靜態掃描 `registerHandler('<channel>'` 呼叫點，斷言每個 channel 在 `PROXIED_CHANNELS` 或在明確的 `REGISTRY_ONLY_CHANNELS`（例如只供 remote server 內部使用、附理由）—— 日後再有孤兒 CI 會紅
4. 不改 renderer 呼叫端

## 驗收

- 守門測試 + 既有測試：`npm run test:unit` 全綠（回報新數字）；`npx vite build` exit 0；`npx tsc --noEmit` ≤ **40**
- 回報區附孤兒盤點表
- **runtime 驗收（交使用者）**：Claude Agent 面板長回應中按中止（或 Esc），回應停止、debug log 無 `No handler registered` reject

## Sub-session 執行指示

1. 讀取本工單 + BUG-095
2. 填 `started_at`、`status: IN_PROGRESS`（**`date "+%Y-%m-%dT%H:%M:%S%z"` 取系統時間**，R-G001）
3. 實作 → 驗收
4. 填回報區；完成寫 **`DONE`**；BUG 狀態由塔台更新
5. commit 僅實際改動檔 + 新測試檔 + 本工單檔（`git commit --only ...`）
6. 依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 執行摘要（2026-10-05T00:06:30+08:00）

- **結果**：✅ DONE —— `claude:abort-session` 已加入 `PROXIED_CHANNELS`，由既有 `bindProxiedHandlersToIpc()` 綁上 `ipcMain.handle`；新增守門測試，日後再有孤兒 CI 會紅。
- **Landing Zone**：WARN —— C-0 `repo` 欄位 absent（觀察到 `basename(REPO_ROOT)` = `better-agent-terminal`）→ 以 C-1 + C-3 判定；C-1 PASS（工單位於 REPO_ROOT 下）；C-3 PASS（`electron/remote/protocol.ts` 存在）；C-2 無 `branch` 欄位（HEAD = `main`）。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）。
- **派發模式**：`CT_MODE=on`、`CT_INTERACTIVE=0`。

### 孤兒盤點表

掃描 `electron/**/*.ts`（排除 `__tests__`）所有字面 `registerHandler('<channel>'`（106 個 channel，來源：`electron/main.ts` 101、`electron/git/git-ipc.ts` 3、`electron/terminal-command-handlers.ts` 2 透過 `deps.registerHandler`），對照 `PROXIED_CHANNELS`（修復前 105 個）與獨立 `ipcMain.handle(…)`：

| channel | 註冊位置 | renderer 呼叫點 | 影響 | 處置 |
|---------|---------|----------------|------|------|
| `claude:abort-session` | `electron/main.ts:2303` | `electron/preload.ts:147-148` → `src/components/ClaudeAgentPanel.tsx:1302` / `:1475`、`src/components/CodexAgentPanel.tsx:1560` / `:1848` | Claude / Codex 面板中止 invoke 必 reject（`No handler registered`），中止無效 | ✅ 加入 `PROXIED_CHANNELS` |

- **唯一孤兒**。其餘 105 個 registered channel 全在 `PROXIED_CHANNELS`；無「registered 且另有獨立 `ipcMain.handle`」者；無「proxied 但未 registerHandler」者（headless 端另由 T0388 處理）。
- **反向交叉驗證**：`electron/preload.ts` 191 個 `ipcRenderer.invoke` channel，對照 `PROXIED_CHANNELS` ∪ 全部 `ipcMain.handle`（含跨行呼叫），**唯一**無綁定者亦為 `claude:abort-session`。
- `electron/remote/headless-entry.ts:102` 的 `registerHandler(registration.channel, …)` 為動態 channel（headless 預設 handler），不在靜態掃描範圍，亦不經 renderer IPC。

### 改動檔案

| 檔案 | 改動 |
|------|------|
| `electron/remote/protocol.ts` | `PROXIED_CHANNELS` Claude 段加 `'claude:abort-session'`；註解說明此 set 同時是 registerHandler channel 唯一的 IPC 綁定來源（BUG-095）並指向守門測試 |
| `electron/remote/__tests__/proxied-channels-binding.test.ts`（新） | 守門測試 5 項：(1) 掃描器 sanity（>50 channel、命中三個來源檔的代表 channel，防 regex 失效）；(2) `claude:abort-session` 已 registered 且 proxied；(3) 每個 registered channel ∈ `PROXIED_CHANNELS` ∪ 獨立 `ipcMain.handle` ∪ `REGISTRY_ONLY_CHANNELS`（失敗訊息附 `檔案:行號`）；(4) `REGISTRY_ONLY_CHANNELS` 條目必須真實 registered、未 proxied、附理由（防殘留）；(5) 每個 preload `ipcRenderer.invoke` channel 都有 IPC 綁定 |

- `REGISTRY_ONLY_CHANNELS` 目前為空 Map（盤點未發現「只供 remote server 內部使用」的 channel）。
- 掃描採整檔 regex（非逐行）：初版逐行掃描漏抓 `main.ts:3339` / `:3389` 的跨行 `ipcMain.handle(\n 'server-bundle:…'`，已修正。
- **未改** `electron/main.ts`、`electron/preload.ts`、renderer 呼叫端（符合 memory_overrides / 範圍 4）。

### 驗收證據

| lane | gate | 結果 | 證據 |
|------|------|------|------|
| tests | 守門測試 red/green | ✅ PASS | 有修復 5/5 pass；暫時移除 `'claude:abort-session'` 後 3 failed（訊息 `claude:abort-session (main.ts:2303)`），隨即還原，`git diff` 確認僅預期兩處改動 |
| tests | `npm run test:unit` | ✅ PASS | **68 files / 970 tests passed**（含本單新增 5 項） |
| build | `npx vite build` | ✅ PASS | exit 0 |
| build | `npx tsc --noEmit` | ✅ PASS | **40** 個 error（≤ 40）；本單兩檔 0 error |
| runtime | Claude Agent 面板長回應中按中止 / Esc | ⏳ 交使用者 | 未執行（需 GUI）。驗收點：回應停止、debug log 無 `No handler registered` reject |

> ⚠️ 驗收時工作樹含 T0387 未 commit 改動（`electron/main.ts`、`preload.ts`、setup-wizard 等 + 未追蹤測試），test / build / tsc 數字為「含 T0387 dirty tree」之結果。

### 偏差 / 備註

- 工單原 `status: TODO`（非 `PENDING`），直接轉 `IN_PROGRESS`。
- 守門測試第 5 項（preload invoke → 綁定）為範圍 3 的延伸：直接守住 BUG-095 的 renderer 端症狀，零額外 production 改動。
- **T0388 同步**：本單執行時 T0388 仍 `TODO`、`HEADLESS_UNSUPPORTED` 尚不存在，故未同步。⚠️ T0388 建 parity test 時，`claude:abort-session` 已在 `PROXIED_CHANNELS`，需在 headless 有 handler 或列入 `HEADLESS_UNSUPPORTED`（與 `claude:stop-session` 同類處理）。
- 副作用評估：加入 `PROXIED_CHANNELS` 後，remote profile 視窗的 abort 會 proxy 到遠端 server（與 `claude:stop-session` 一致）；BAT-hosted remote server 端 `main.ts:2303` 已有 handler。
- 未 push。

### Commit

見下方 commit 紀錄（`git commit --only`：`electron/remote/protocol.ts`、新測試檔、本工單檔）。
