---
schema_version: 1
schema_kind: workorder
id: T0538
title: "PLAN-041 D：分頁列標示 Worker（工單編號 / 已回報），右鍵批次關閉已回報的 Worker 分頁"
type: implementation
status: PENDING
repo: better-agent-terminal
project: PLAN-041
priority: P3
sizing: S-M
created_at: "2026-10-15T16:13:05+0800"
updated_at: "2026-10-15T16:13:05+0800"
target_version: "0.6.1-pre.3"
depends_on: [T0535, T0537]
related:
  - PLAN-041（方案 D，使用者 2026-10-15 16:1x 指示納入「完整版」）
  - T0534（研究回報 §4 方案 D）
  - D144
affects_files:
  - src/components/ThumbnailBar.tsx
  - src/components/TerminalThumbnail.tsx
  - src/components/WorkspaceView.tsx
  - src/stores/workspace-store.ts
  - src/App.tsx
  - src/types/index.ts
  - src/locales/*.json
  - src/**/__tests__/
  - e2e/
  - CLAUDE.md
  - _ct-workorders/T0538-worker-tab-marker-batch-close.md
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 不碰使用者正在用的 BAT（port 9876、真實 userData）。e2e 一律隔離實例，不耗 token。"
  - "🔴 **禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）；寫檔 LF；不 push；不跑全套 e2e（L141）。`src/styles/settings.css` 的 M 狀態不是你的變更，不要 commit 它；commit 用 `--only`。"
  - "🔴 改 `src/**` 驗收 `npm run typecheck` = 0；`npx vite build` 成功。"
  - "🔴 關閉一律走 T0535 的共用關閉函式；批次關閉**必須**先在頁面內顯示確認（列出將關閉的分頁），不得用 `window.confirm`。"
---

# T0538 — Worker 分頁標示與批次關閉

## 背景

T0537 完成後，每個 Worker 分頁都存有 `towerTerminalId` / `workorder`。本單把它顯示出來，並提供人工批次關閉，作為 CT 自動回收（CT-T011，預設關閉）之外的手動路徑。

## 任務

1. **標示**：Worker 分頁（有 `towerTerminalId`）在分頁列 / 縮圖列顯示工單編號（例如小標籤 `T0535`），tooltip 說明「由 <塔台分頁名稱> 派出」。不改變既有標題 / alias 的顯示與編輯。
2. **「已回報」狀態**：BAT 收到 `terminal:notify`，且 `target` 是某塔台、`source` 等於該塔台某 Worker 的 `workorder`（ct-exec 以 `--source "T####"` 呼叫）時，把該 Worker 標成「已回報」。只做顯示，不自動關閉。狀態是否持久化由 Worker 決定並說明（建議隨 T0537 欄位一起存，重開後仍顯示）。
3. **批次關閉**：
   - 塔台分頁的右鍵選單：「關閉已回報的 Worker 分頁（N）」
   - Worker 分頁的右鍵選單：「關閉此 Worker」（等同 ✕，沿用既有確認規則）
   - 批次關閉前顯示頁面內確認，列出將關閉的分頁（工單編號 + 標題）；確認後逐一走 T0535 的共用關閉函式，不清 worktree。N = 0 時選項停用。
   - detached 視窗中的 Worker 也要涵蓋（事件 / 呼叫需送到持有該分頁的視窗）。
4. **i18n**：三語（`src/locales/*.json`）。
5. **文件**：CLAUDE.md「Worker 分頁回收（PLAN-041）」補 UI 說明。

## 驗收條件

- [ ] 單元測試：「已回報」比對（source 對應 workorder、target 對應塔台；不相符不標示）、批次清單計算、N = 0 停用
- [ ] e2e（隔離實例）：派兩張單 → 一張回報 → 塔台右鍵只列出已回報的那張 → 確認後關閉、另一張保留；detached 視窗的 Worker 同樣適用
- [ ] 既有分頁列（標題、alias、拖曳、縮圖）行為不變
- [ ] `npm run typecheck` = 0、`npx vite build` 成功、相關單元測試全綠

## 回報區

（Worker 填寫）
