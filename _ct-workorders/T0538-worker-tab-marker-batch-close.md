---
schema_version: 1
schema_kind: workorder
id: T0538
title: "PLAN-041 D：分頁列標示 Worker（工單編號 / 已回報），右鍵批次關閉已回報的 Worker 分頁"
type: implementation
status: DONE
repo: better-agent-terminal
project: PLAN-041
priority: P3
sizing: S-M
created_at: "2026-10-15T16:13:05+0800"
started_at: "2026-10-15T16:55:04+0800"
updated_at: "2026-10-15T17:04:34+0800"
completed_at: "2026-10-15T17:04:34+0800"
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

### 落地檢查

- 結果：**PASS**
- C-0：frontmatter `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal` → PASS（`REPO_ROOT` = `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）
- C-1：工單位於 `REPO_ROOT/_ct-workorders/` → PASS
- C-3：抽查 `src/components/ThumbnailBar.tsx` / `TerminalThumbnail.tsx` / `WorkspaceView.tsx` / `src/stores/workspace-store.ts` / `src/App.tsx` 皆存在 → PASS
- C-2：工單無 `branch` 欄位；目前 `main`
- 觀察到 `BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）；`CT_MODE=yolo`、`CT_INTERACTIVE=0`

### 結果摘要

1. **標示**：Worker 分頁（`towerTerminalId` + `workorder`）在縮圖列標題後顯示工單小標籤 `T####`（`.worker-badge`），tooltip「`<工單>` 的 Worker，由 `<塔台分頁標題>` 派出」+「已回報：<訊息>」/「尚未回報」；塔台不在同一清單時顯示塔台 id 前 8 碼。標題、alias、拖曳、縮圖內容不動。
2. **已回報**：`App.tsx` 的 `onTerminalNotified` 呼叫 `workspaceStore.markWorkerReported(info)`；比對 `findReportingWorkers`：`targetId` = Worker 的 `towerTerminalId` 且 `source`（trim + 大寫，文法 `/^(?:[A-Z]{2,4}-)?T\d+$/`，同 main `normalizeWorkorderId`）= 其 `workorder`。命中 → `TerminalInstance.workerReport = { message（≤200 字）, reportedAt }`、`notify()` + `save()`，標籤變 `✓ T####`（綠色）。只顯示，不自動關閉。
   - **持久化決定：持久化**（照工單建議）。`workerReport` 隨 T0537 欄位寫進 `workspace:save`，`toTerminalInstance` 載入時驗證型別（不合法即丟棄，T0538 前的資料不多任何 key）；detached reattach 的 `replaceWorkspaceTerminals` 保留（`restored ?? existing`）。
   - 同塔台同工單有多個 Worker（Renew 重派）時全部標示；後到的回報覆寫訊息。
3. **右鍵選單**（`TerminalThumbnail`）：
   - Worker 分頁：「關閉此 Worker」→ `WorkspaceView.handleCloseTerminal`（= ✕，確認規則不變）
   - 有 Worker 的塔台分頁：「關閉已回報的 Worker 分頁（N）」，N = `reportedWorkersOfTower`，N = 0 → `disabled`；沒有任何 Worker 的分頁不顯示此項
   - 點選 → 頁內確認 `.worker-batch-close-dialog`（列工單編號 + 標題，tooltip 為回報訊息；**未用 `window.confirm`**）→ 確認後逐一 `workspaceStore.closeTerminalNow(id, { cleanWorktree: false })`（T0535 共用關閉函式，不清 worktree），log `[T0538] closing reported Workers of tower=…`；確認框開著時清單分頁全被別處關掉 → 自動收起
   - **detached**：清單取自該 `WorkspaceView`（同一工作區）的分頁，因此一定在持有分頁的視窗執行；`terminal:notified` 本來就送所有視窗（含 detached），各視窗各自標示。e2e 已驗 detached 視窗內標示 + 批次關閉 + 存回父 entry。
4. **i18n**：`workerTabs.*` 8 個 key，en / zh-TW / zh-CN 三語（i18n-completeness 測試通過）。
5. **文件**：CLAUDE.md「Worker 分頁回收（PLAN-041 / T0535，D144）」新增「分頁標示與手動批次關閉（T0538，UI）」條目，驗證清單補新測試與 e2e。

### 變更檔案

- `src/types/index.ts`：`TerminalInstance.workerReport`
- `src/stores/workspace-store.ts`：`findReportingWorkers` / `workersOfTower` / `reportedWorkersOfTower`（純函式）、`markWorkerReported`、`workerOwnership` 載入驗證、`save()` 序列化、`replaceWorkspaceTerminals` 保留
- `src/App.tsx`：notify → `markWorkerReported` + `[T0538] Worker reported` log
- `src/components/TerminalThumbnail.tsx`：工單標籤、tooltip、兩個右鍵項目
- `src/components/ThumbnailBar.tsx`：計算塔台標題 / N 並傳入
- `src/components/WorkspaceView.tsx`：批次關閉 state、頁內確認、`onCloseWorker={handleCloseTerminal}`
- `src/locales/{en,zh-TW,zh-CN}.json`：`workerTabs.*`
- `src/styles/panels.css`（`.worker-badge`、確認清單）、`src/styles/context-menu.css`（`.context-menu-item:disabled`）
- 新增測試：`src/stores/__tests__/workspace-store.workerReport.test.ts`、`src/components/__tests__/worker-tab-marker.test.tsx`
- 新增 e2e：`e2e/t0538-worker-tab-batch-close.spec.ts`
- `CLAUDE.md`

### 驗證

| 項目 | 結果 | 證據 |
|---|---|---|
| `npm run typecheck` | ✅ PASS | exit 0（0 errors） |
| `npx vite build` | ✅ PASS | renderer + electron 產物建置成功 |
| 新單元測試（比對、批次清單、N = 0、持久化、元件選單、source guard） | ✅ PASS | `workspace-store.workerReport.test.ts`（12）+ `worker-tab-marker.test.tsx`（7）；含既有 `workerOwnership` / `closeTerminalNow` / i18n 共 105 tests 全綠 |
| `npm run test:unit`（全套） | ✅ PASS | 234 files，3900 passed / 1 skipped |
| e2e（隔離實例，不耗 token） | ✅ PASS | `npx playwright test e2e/t0538-worker-tab-batch-close.spec.ts` 1 passed：主視窗派 T0601 / T0602 → 回報前 N = 0 停用 → T0601 回報 → 只有 `✓ T0601` → Worker 選單有「關閉此 Worker」→ 塔台右鍵 (1) → 確認框只列 T0601 → 關閉，T0602 保留且已存清單正確；detached 視窗 T0603 / T0604 同流程，T0604 關閉、T0603 保留，父 entry 已存清單正確；debug log 含 `[T0538]` 三行。截圖（zh-TW UI）已目視確認標籤與確認框 |
| 既有分頁列行為（標題、alias、拖曳、縮圖） | ✅ PASS（測試面） | 只在標題 span 之後附加標籤、右鍵選單末尾附加項目；`remote-codex-degrade` 等 ThumbnailBar 既有測試全綠；拖曳 wrapper 未改 |

未跑全套 e2e（L141）；未碰使用者的 BAT（port 9876 / 真實 userData），e2e 皆隔離實例。

### 偏差 / 備註

- **affects_files 外**：`src/styles/panels.css`、`src/styles/context-menu.css`（標籤與停用選單項目的樣式，無法只靠 affects_files 內檔案完成）。未建新元件檔，確認框直接寫在 `WorkspaceView.tsx`。
- **已知限制**：批次清單只含同一工作區的 Worker。塔台與 Worker 在不同工作區（T0523 前的舊分頁，或塔台不在 window registry 時以 `--workspace` 落點）且分屬不同視窗時，renderer 無法把關閉送到另一視窗（需新增 main IPC，超出本單 affects_files）；這類 Worker 不列入，可在 Worker 分頁用「關閉此 Worker」。已寫進 CLAUDE.md。
- 塔台判定 = 「同工作區內有 `towerTerminalId` 指向它的分頁」；沒有 Worker 的分頁不顯示批次項目（有 Worker 但都未回報 → 顯示並停用）。
- e2e 斷言對 UI 語言中立（隔離實例跟隨 OS locale，本機為 zh-TW）。
- `src/styles/settings.css` 的既有 M 狀態未動、未 commit。

### Commit

- `8fd7bdf7` feat: T0538 mark Worker tabs and batch-close reported ones from the Tower (PLAN-041)（`git commit --only`，未 push）
