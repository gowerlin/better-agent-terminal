---
schema_version: 1
schema_kind: workorder
id: T0508
title: "收尾：helper-connection-hygiene 計時敏感測試改為確定性 + detached 關窗兩個邊界（flush 中再 detach、quit 對話框取消後的 rename 遺失）"
type: implementation
status: TODO
repo: better-agent-terminal
project: D139
priority: P3
sizing: S
created_at: "2026-10-14T00:38:51+08:00"
started_at: null
updated_at: "2026-10-14T00:38:51+08:00"
completed_at: null
target_version: v0.6.0-pre.5
depends_on:
  - "T0504"
related:
  - "T0504 回報區「驗證」：`electron/remote/__tests__/helper-connection-hygiene.test.ts:299`「a half-open helper frees its slot under the connection cap」全套跑時偶發失敗一次，單獨重跑通過（T0451 既有、計時敏感）"
  - "T0504 回報區「偏差 / 殘餘風險」：(1) quit 確認對話框開著時關 detached 視窗 → `isAppQuitting` 已 true 不 flush，若接著取消 quit，≤ 30 s 的 rename 遺失；(2) flush 期間（≤ 1.5 s）對同 workspace 再按 detach 會 focus 正在關閉的視窗"
  - "T0504 `electron/renderer-flush.ts`（`requestRendererFlush` / `flushBeforeClose`）、`DETACHED_CLOSE_FLUSH_TIMEOUT_MS`"
affects_files:
  - "electron/remote/__tests__/helper-connection-hygiene.test.ts"
  - "electron/main.ts"
  - "electron/renderer-flush.ts"
  - "electron/__tests__/"
  - "e2e/"
renew_count: 0
workdir: main repo
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 A：先找出不穩定的根因（計時 / 事件順序 / 連線關閉偵測），以假時鐘或事件等待取代固定 sleep；不得放寬斷言或加大 timeout 了事；不得改產品常數（T0451 / PLAN-039 規則：測試不得為縮短等待改產品常數）。全套連跑 ≥ 5 次穩定"
  - "🔴 B：不得破壞 T0491 / T0504 順序保證（save → flush:done → closed → reattached）；quit 路徑不得重複 flush 或死鎖"
  - "🔴 批次並行（D139）：`git commit --only` 本單檔案；不改 CLAUDE.md（建議文字寫回報區由 T0493 套用）；`npm run typecheck` / `npm run typecheck:electron` 維持 0"
  - "🔴 不得以預設實例（無 `--runtime`）啟動 source build；e2e 一律 isolated runtime"
  - "🔴 不 push、不觸發 workflow；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`；換行維持各檔現況"
---

# T0508 — 不穩定測試 + detached 關窗邊界

## A. helper-connection-hygiene 測試確定化

- 重現（全套 / 單檔反覆跑）並找出根因；改為確定性等待
- 驗證：該檔連跑 20 次、全套 `npm run test:unit` 連跑 5 次皆綠

## B. detached 關窗邊界

1. quit 取消：quit 流程中關閉的 detached 視窗，若 quit 被取消（`isAppQuitting` 復原的時點），確保其最後狀態有寫入（例如 quit 確認期間不跳過 flush，或取消時補 flush——擇一說明，不得造成 quit 時重複 flush）
2. flush 中再 detach 同 workspace：等待舊視窗關閉完成後再開新視窗（或明確拒絕並提示），不得 focus 一個即將關閉的視窗
3. 測試：單元（`renderer-flush` / main 接線 source guard 或可測抽出）；可行時 e2e

## 驗收條件

- [ ] A：根因說明 + 連跑證據
- [ ] B：單元（+ e2e 若可行）；既有 `detached-*` / `smoke` / `plan039-multi-remote` e2e 回歸
- [ ] `npm run test:unit`、`npx vite build`、`npm run typecheck`、`npm run typecheck:electron`
- [ ] 回報區：CLAUDE.md 建議文字、`git diff --stat`

## Sub-session 執行指示

1. 讀本工單 + D139 + T0504 / T0491 回報區 + 相關檔案
2. 填 `started_at`、`status: IN_PROGRESS`（取系統時間，R-G001）
3. 實作 → 驗收 → 填回報區 → `DONE`；`git commit --only` 本單檔案與改動；不 push；依派發 mode 通知塔台

---

## 回報區

（Worker 填寫）
