---
schema_version: 1
schema_kind: workorder
id: T0486
title: "tsc 基線清零（BUG-061 CodexAgentPanel 29 + 其他 7）+ 新增 typecheck / typecheck:electron scripts 與 electron 基線"
type: implementation
status: TODO
repo: better-agent-terminal
project: D139
priority: P2
sizing: M
created_at: "2026-10-13T23:13:05+08:00"
started_at: null
updated_at: "2026-10-13T23:13:05+08:00"
completed_at: null
target_version: v0.6.0-pre.5
depends_on: []
related:
  - "BUG-061；L146（`typecheck:electron` script 建議）"
  - "塔台 2026-10-13 23:11 實測 `npx tsc --noEmit -p .` 36 錯：`CodexAgentPanel.tsx` 29、`src/utils/__tests__/terminal-keyboard-event.test.ts` 5、`src/types/agent-profiles.ts` 1、`src/components/setup-wizard/__tests__/integration.transitions.test.ts` 1"
affects_files:
  - "src/components/CodexAgentPanel.tsx"
  - "src/types/"
  - "src/utils/__tests__/terminal-keyboard-event.test.ts"
  - "src/components/setup-wizard/__tests__/integration.transitions.test.ts"
  - "electron/preload.ts"
  - "package.json"
  - "tsconfig.json"
  - "tsconfig.node.json"
renew_count: 0
workdir: main repo
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "✅ 本單授權改 `package.json` 的 `scripts`（新增 typecheck 類 script）；其他欄位與 `package-lock.json` 不動"
  - "🔴 修型別不改行為：型別缺漏的 IPC 呼叫，先 trace `electron/preload.ts` / main handler 是否存在——存在則補型別；不存在即死呼叫，回報區列出並以最小改動處理（附理由），不得新增 handler"
  - "🔴 `electron/preload.ts` 只允許補型別相關宣告（T0491 稍後會改 preload）"
  - "🔴 不改 `.github/workflows/`（CI gate 是否加入由塔台決定，回報區提建議）"
  - "🔴 **批次並行（D139）**：同一工作樹有其他 Worker 同時進行。commit 一律 `git commit --only <本單檔案…>`，不得 stage / commit 他人檔案；全套測試或 build 若因他人未提交的 WIP 失敗，於回報區列出失敗檔與歸屬，並以本單檔案相關測試為準（不得為此修改他人範圍的檔案）"
  - "🔴 **不改 `CLAUDE.md`**（除非本單 frontmatter 另有授權）：需更新的文件內容寫在回報區「CLAUDE.md 建議文字」，由 T0493 統一套用"
  - "🔴 tsc：本單改動的檔案不得新增 `tsc` 錯誤（總數會因 T0486 並行變動，以檔案為單位比較）"
  - "🔴 不得以預設實例（無 `--runtime`）啟動 source build（BUG-119 migration 會作用在使用者真實資料目錄）；需要啟動時用 `--runtime=<高號碼>` 或 e2e isolated runtime，結束只刪自己建立的目錄"
  - "🔴 不 push、不觸發 workflow、不建 tag；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`；`gh` 一律帶 `-R gowerlin/better-agent-terminal`（唯讀）；換行維持各檔現況"
---

# T0486 — tsc 基線清零（BUG-061 CodexAgentPanel 29 + 其他 7）+ 新增 typecheck / typecheck:electron scripts 與 electron 基線

## A. `tsc --noEmit -p .` 清零

- 逐檔修正 36 個錯誤（分類見 BUG-061）；unused 宣告確認無引用再移除
- 測試檔的型別錯誤以正確型別 / fixture 修正，不用 `any` / `@ts-ignore` 掩蓋（必要時 `@ts-expect-error` 附理由並列出）

## B. typecheck scripts

- `typecheck`（= `tsc --noEmit -p .`）與 `typecheck:electron`（electron 端 tsconfig，例如 `tsconfig.node.json`；T0480 回報提及 TS6307 / TS2802 / `main.ts:197` 等既有錯誤）
- electron 端：記錄目前錯誤數為基線（回報區附清單）；低成本、不改行為的順手修，其餘留基線
- CI gate 方案寫回報區（不改 workflow）

## 驗收條件

- [ ] `npx tsc --noEmit -p .` = 0（附輸出）
- [ ] `npm run typecheck` / `npm run typecheck:electron` 可執行（附數字）
- [ ] `npm run test:unit` 全綠（標註他人 WIP 影響）；`npx vite build` exit 0
- [ ] 回報區：死呼叫清單、CI gate 建議、CLAUDE.md 建議文字、BUG-061 可結案證據

## Sub-session 執行指示

1. 讀本工單 + D139 + 「related」列出的來源 + affects_files
2. 填 `started_at`、`status: IN_PROGRESS`（取系統時間，R-G001）
3. 實作 → 驗收 → 填回報區 → `DONE`；`git commit --only` 本單檔案與改動；不 push；依派發 mode 通知塔台

---

## 回報區

（Worker 填寫）
