---
schema_version: 1
schema_kind: workorder
id: T0403
title: "PLAN-036 遠端終端收尾 A：斷線期間輸出回放（pty:get-buffer）+ pty:create 回報是否新 spawn（還原 agent preset 不重打啟動指令）"
type: impl
status: PENDING
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
- **狀態**：PENDING
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

### 產出摘要

### 設計說明（回傳形狀 / buffer 上限 / 重疊處理）

### 塔台實機驗收步驟

### 互動紀錄
無

### Renew 歷程
無

### 遭遇問題

### 回報時間
