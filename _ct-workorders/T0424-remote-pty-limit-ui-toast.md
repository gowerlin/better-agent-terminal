---
schema_version: 1
schema_kind: workorder
id: T0424
title: "遠端 PTY 達上限（PtyLimitError）時 renderer 顯示提示，而非空白終端"
type: implementation
status: PENDING
repo: better-agent-terminal
project: PLAN-036
priority: P2
sizing: S
created_at: "2026-10-05T05:35:22+08:00"
started_at: null
updated_at: "2026-10-05T05:35:22+08:00"
completed_at: null
target_version: next
depends_on:
  - T0419
related:
  - "T0404 回報區 / PLAN-036「T0404 後續建議」：renderer `pty.create` 為 fire-and-forget，達上限時使用者只看到空白終端"
  - "`electron/pty-manager.ts` PtyLimitError（約 :79、:569）；`headless-entry.ts` `HEADLESS_MAX_PTYS_DEFAULT = 64` / `BAT_SERVER_MAX_PTYS`"
  - "T0403（`pty:create` 回傳 `{ ok, created }`）"
  - "D134（本 session 排程表第 8 列）"
affects_files:
  - src/components/WorkspaceView.tsx
  - src/stores/workspace-store.ts
  - src/App.tsx
  - src/lib/pty-replay.ts
  - electron/handlers/pty.ts
  - electron/pty-manager.ts
  - src/locales/en.json
  - src/locales/zh-TW.json
  - src/locales/zh-CN.json
  - src/__tests__/
  - electron/__tests__/
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **先確認現況**：以程式碼證據回答 (a) 達上限時 `pty:create` 對 renderer 回什麼（reject？`{ ok: false, error }`？）；(b) renderer 各呼叫點（`WorkspaceView.tsx`、`workspace-store.ts`、`App.tsx`、`pty-replay.ts`、`useRemoteToolInstall.ts`）是否 await 並處理結果；(c) 本機 Electron PtyManager 是否也有上限（本機行為不得改變，除非本機也會遇到同樣空白終端）。"
  - "🔴 UI 呈現：沿用專案既有 toast 機制（找現有 toast 元件 / store，不要新造），並在該終端區塊寫一行可讀訊息（i18n 三語：en / zh-TW / zh-CN）。錯誤辨識用結構化欄位（error code / name），**不要**以英文訊息字串比對。"
  - "🔴 依賴 T0419（同改 `src/App.tsx`）。開工前 `git log --oneline -3` 確認。"
  - "🔴 同工作樹有其他 Worker 平行。**只跑 `npm run test:unit` + `npx tsc --noEmit`；不跑 `npx vite build` / `npm run test:e2e`**（L141）。"
  - "🔴 **禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）；`git commit --only`；不 push；不部署 WSL。"
---

# T0424 — 遠端 PTY 達上限 UI 提示

## 背景

T0404 為 headless server 加了 PTY 上限（預設 64，`BAT_SERVER_MAX_PTYS` 可調）與孤兒回收。超過上限時 `pty:create` 被拒（`PtyLimitError`），但 renderer 的 `pty.create` 為 fire-and-forget → 使用者只看到空白終端，不知道原因。

## 範圍

1. 現況確認（memory_overrides 第 1 條）
2. 讓上限錯誤以結構化形式回到 renderer（若 T0403 的 `{ ok, created }` 結果可擴充 `{ ok: false, code: 'PTY_LIMIT', limit }` 即沿用；跨 RemoteClient 代理時 error 序列化需實測可保留 code）
3. renderer 在建立終端處處理：toast + 終端區塊訊息；不自動重試
4. i18n 三語
5. 測試：handler 回傳結構、renderer 處理（RTL）、代理序列化保留 code

## 驗收條件

- [ ] 回報區附現況結論
- [ ] `npm run test:unit` 全綠；`npx tsc --noEmit` ≤ 40
- [ ] 回報區附實機步驟（WSL：`BAT_SERVER_MAX_PTYS=2` 之類設定低上限 → 開第 3 個終端看到提示）；實機由使用者執行，本單不部署

## Sub-session 執行指示
1. 讀本工單 + T0404 回報區 + `electron/pty-manager.ts` / `electron/handlers/pty.ts`
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 現況確認 → 實作 → 驗收
4. 填回報區；完成寫 **`DONE`**
5. `git commit --only` 實際改動檔 + 本工單；不 push
6. 依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

### 產出摘要

### 遭遇問題

### 回報時間
