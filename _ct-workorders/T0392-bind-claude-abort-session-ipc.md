---
schema_version: 1
schema_kind: workorder
id: T0392
title: "BUG-095 修復：`claude:abort-session` 綁上 IPC，並以測試守住「registerHandler 了卻沒有 IPC 綁定」的孤兒 channel"
type: implementation
status: TODO
priority: P1
sizing: S
created_at: "2026-10-04T23:58:00+08:00"
updated_at: "2026-10-04T23:58:00+08:00"
started_at: null
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
