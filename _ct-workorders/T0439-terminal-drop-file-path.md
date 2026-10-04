---
schema_version: 1
schema_kind: workorder
id: T0439
title: "終端拖放檔案：插入依 shell family 加引號的路徑（遠端視窗為 server 形式），不送 \\r；不可達 toast；先實測目前是否觸發 will-navigate → openExternal"
type: implementation
status: PENDING
repo: better-agent-terminal
project: BUG-105
priority: P2
sizing: S
created_at: "2026-10-05T05:51:45+08:00"
started_at: null
updated_at: "2026-10-05T05:51:45+08:00"
completed_at: null
target_version: next
depends_on:
  - T0438
related:
  - "T0421 研究拆單第 5 列（🟡 需先實測）"
  - "D119 / T0362（`quoteArgForShell(arg, shell)`，shell family quoting 既有實作）"
  - "D134 追加（T0421 拆單）"
affects_files:
  - src/components/TerminalPanel.tsx
  - src/components/WorkspaceView.tsx
  - electron/main.ts
  - src/locales/en.json
  - src/locales/zh-TW.json
  - src/locales/zh-CN.json
  - src/__tests__/
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **先確認現況**：拖檔到終端目前發生什麼（xterm 預設行為、是否觸發 `will-navigate` → `openExternal` 在本機開檔——若是，屬安全 / UX 問題，回報區明記）。只能靠程式碼與 e2e / RTL 驗證時，標明推論。"
  - "🔴 quoting 重用既有 `quoteArgForShell`（D119 / T0362），不要新寫一套。路徑解析用 T0437 的 `remote:resolve-client-paths(paths, 'local-file')`；本機視窗插入本機路徑。只插入文字，**不送 `\\r`**；多檔以空白分隔。"
  - "🔴 若發現 `will-navigate` 會開本機檔，在本單一併阻擋終端區的 drop 導航（`preventDefault`），並在回報區說明。"
  - "🔴 同工作樹有其他 Worker 平行。共用檔 commit 前 `git diff <file>` 確認只含本單 hunk。**只跑 `npm run test:unit` + `npx tsc --noEmit`；不跑 `npx vite build` / `npm run test:e2e`**（L141）。**禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）；`git commit --only`；不 push。"
---

# T0439 — 終端拖放檔案

## 範圍

1. 現況確認（memory_overrides 第 1 條）
2. 終端 drop handler：取路徑（T0435 API）→ 解析（T0437）→ quote → 寫入 PTY
3. 不可達 toast（重用 T0437 i18n key）
4. 測試：pwsh / bash / cmd 三種 shell family 的插入字串；遠端可達 / 不可達

## 驗收條件

- [ ] 回報區附現況結論
- [ ] `npm run test:unit` 全綠；`npx tsc --noEmit` ≤ 39
- [ ] 回報區附實機步驟

## Sub-session 執行指示
1. 讀本工單 + T0421 回報區 + T0435 / T0437 回報區
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 現況 → 實作 → 驗收
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
