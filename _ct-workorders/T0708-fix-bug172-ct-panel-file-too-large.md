---
schema_version: 1
schema_kind: workorder
id: T0708
title: "BUG-172：指揮塔面板讀檔失敗（含 File too large）時顯示錯誤，不再靜默變空或讓工單消失"
type: implementation
status: DONE
repo: better-agent-terminal
project: ""
priority: P2
sizing: S
created_at: "2026-10-29T09:46:36+0800"
started_at: "2026-10-29T09:47:37+0800"
updated_at: "2026-10-29T09:54:35+0800"
completed_at: "2026-10-29T09:54:35+0800"
depends_on: []
related:
  - "BUG-172（現象、根因、各 loader 行號）"
  - "BMad-Guide 塔台 ADVISORY 2026-10-29（CT D408，`memory-protocol.md` § BAT 塔台面板讀取契約：熱檔預算 400 KB，BAT 讀取上限 512 KiB）"
  - "T0701（總覽的讀取路徑已會顯示 `File too large`，`electron/handlers/ct-config.ts:50`）"
  - "`src/components/FileTree.tsx:39` / `PathLinker.tsx:220` 既有的 `File too large (<n>KB)` 顯示寫法"
affects_files:
  - src/components/ControlTowerPanel.tsx
  - "ControlTowerPanel 內畫臭蟲／待辦／決策／工單清單的子元件（若錯誤需在子元件顯示）"
  - "src/locales/en.json、src/locales/zh-TW.json、src/locales/zh-CN.json（`controlTower.*` 讀取錯誤 key）"
  - "src/components/__tests__/（新測試或既有 ControlTowerPanel 測試補項）"
  - _ct-workorders/T0708-fix-bug172-ct-panel-file-too-large.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 範圍：只改 renderer 的顯示。`fs:readFile`（`electron/handlers/fs.ts`）的 512 KiB 上限與回傳形狀**不改**（共用 handler）；不改 `electron/**`、CLAUDE.md、`src/types/backlog.ts`、`src/types/bug-tracker.ts`（T0709 同時在改）。"
  - "🔴 行為：區分「檔案不存在」與「讀取失敗」。`readFile` 回 `error`（`File too large` 帶 `size`，或其他錯誤）時：臭蟲／待辦／決策頁顯示錯誤訊息（含檔名；`File too large` 另含 KB 數），不是空清單；工單清單中讀取失敗的工單仍列出（狀態 `UNKNOWN`、可辨識為讀取失敗），不得消失。epics、sprint yaml、歸檔工單／BUG／PLAN 也用同樣規則，若改動成本明顯偏高可只做主要四處並在回報區列出未處理的位置與理由。待辦補優先級讀 PLAN 檔失敗時維持現狀（保留原 entry），不另顯示。"
  - "🔴 檔案不存在（`Failed to read file` 且檔案確實不存在、或專案沒有該檔）時維持現在的空清單行為，不要對沒有 `_backlog.md` 的專案顯示錯誤；判斷方式自行決定（例如先 `fs:stat` 或依既有 readdir 結果），回報區寫明。"
  - "🔴 文字一律 i18n（三個 locale），沿用 `controlTower.*` 命名慣例；不寫死中文。"
  - "🔴 驗證：RTL 測試模擬 `readFile` 回 `{ error: 'File too large', size }`：三頁顯示錯誤、工單清單仍有該工單；檔案不存在時三頁仍是空清單、無錯誤。`npm run test:unit` 全綠、`npm run typecheck` = 0、`npx vite build` 成功。"
  - "🔴 Git：`git commit --only <檔案>`；不 push、不觸發 workflow、不建 tag。T0709 同時在 repo 內工作：只 commit 本單 `affects_files`。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF。工單完成狀態寫 `DONE`（不要寫 FIXED，那是 BUG 單狀態）；BUG-172 單與 `_bug-tracker.md` 由塔台更新，不要改。"
  - "🔴 公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」。yolo：不得問使用者，判讀問題問塔台（每輪最多 3 題）。"
---

# T0708 — BUG-172：指揮塔面板讀檔失敗時顯示錯誤

## 背景

CT 檔案超過 512 KiB 時，`fs:readFile` 回 `File too large`、沒有內容。總覽（T0701）會顯示錯誤，但臭蟲、待辦、決策三頁變成空清單，超大的工單直接從清單消失，使用者會以為「沒有東西」。詳見 BUG-172。

## 實作

1. `ControlTowerPanel.tsx` 各 loader 區分「不存在」與「讀取失敗」，讀取失敗時保存錯誤狀態。
2. 三頁顯示錯誤訊息；工單清單保留讀取失敗的工單。
3. 三個 locale 補 key。
4. RTL 測試。

## 驗收

- [ ] 臭蟲／待辦／決策頁在 `File too large` 時顯示錯誤（含檔名、KB 數），不是空清單
- [ ] 讀取失敗的工單仍出現在清單中
- [ ] 檔案不存在時行為不變（空清單、無錯誤）
- [ ] 文字走 i18n（三個 locale）
- [ ] `npm run test:unit` 全綠；`npm run typecheck` = 0；`npx vite build` 成功

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 待塔台決策（僅 yolo Worker 有問題時）

（無）

### 互動紀錄

（無：yolo，未向塔台提問）

### 完成狀態

**DONE**

落地檢查：**PASS**。C-0 `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`（REPO_ROOT = 本 repo 主 checkout，未設 `CT_HOME`，非 worktree）；C-1 PASS；C-3 PASS（`src/components/ControlTowerPanel.tsx` 存在）；C-2 工單無 `branch` 欄位（目前 `main`）。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）。

### 實作摘要

- `ControlTowerPanel.tsx` 新增 `readCtFile(path, file)`：回 `loaded` / `missing` / `error`。`File too large` 直接判為錯誤（帶 `size`）；其他錯誤再 `fs:stat`，stat 為 null → `missing`（維持空清單），有 stat → 錯誤。判斷方式與 T0701 `loadTowerOverview` 相同；`fs:stat` 例外也當成不存在。`formatCtReadError(t, e)` 產生訊息（含相對檔名；`File too large` 另含 KB 數，四捨五入，與 `FileTree.tsx` 相同算法）。
- 套用位置（工單列的全部，無未處理項目）：
  - 臭蟲 `_bug-tracker.md`、待辦 `_backlog.md`、決策 `_decision-log.md`：錯誤時該頁顯示 `⚠️ 無法讀取 <檔名>：…`，不顯示「沒有…」空清單文字。
  - 工單清單（含歸檔工單）：讀取失敗的工單以 `UNKNOWN`（「❔ No status」）列出，標題位置顯示讀取錯誤訊息，計入 total / no status。toast：讀取失敗的工單沿用 baseline 中的上次狀態去比對，避免檔案變回可讀時誤報「完成」等通知。
  - epics（`BmadEpicsView`）：錯誤時顯示錯誤，不顯示「No Epic data」空狀態。
  - sprint yaml：依序嘗試的候選路徑中，若沒有任何一個成功解析，回報第一個讀取失敗的檔案；總覽（`TowerOverview`）在沒有 sprint 資料時顯示 `📊 Sprint` 區塊的錯誤（T0701「sprint 區塊只在有 sprint-status.yaml 時」不變：有錯誤代表檔案存在）。
  - 歸檔 BUG／PLAN：讀取失敗的檔案列在對應頁（勾「包含封存」時）的錯誤訊息中；因 `BugEntry` / `BacklogEntry` 型別（`src/types/bug-tracker.ts` / `backlog.ts`，本單不得改）需要解析內容才有狀態等欄位，沒有做成清單中的佔位項目。
  - 待辦補優先級讀 PLAN 檔失敗：維持原 entry（行為不變，未改）。
- 子元件新增可選 prop：`BugTrackerView` / `BacklogView` / `DecisionsView` / `BmadEpicsView` 的 `readErrors?: string[]`、`TowerOverview` 的 `sprintReadError?: string | null`；不傳時行為與原本相同。錯誤元素沿用既有 class（`ct-empty-list` / `ct-overview-muted`）並加 `ct-read-error`，**未改 CSS**。
- i18n：三個 locale 新增 `controlTower.readError.tooLarge` / `controlTower.readError.failed`。
- 未改：`electron/**`、`fs:readFile`、CLAUDE.md、`src/types/backlog.ts`、`src/types/bug-tracker.ts`、`src/types/control-tower.ts`。

### 驗證證據

| 項目 | 結果 |
|---|---|
| 新測試 `src/components/__tests__/control-tower-panel-read-errors.test.tsx`（5 項：`readCtFile` 四種結果、訊息格式；File too large 時臭蟲／待辦／決策／epics／sprint 顯示錯誤、無空清單文字、工單 T0002 仍在清單（No status + 錯誤訊息、total = 2）；檔案存在但其他錯誤時顯示 `Failed to read file`；檔案不存在時四頁空清單、無錯誤） | PASS |
| 相關既有測試 `control-tower-panel-toasts.test.tsx`、`tower-overview.test.tsx` | PASS（3 檔 29 項） |
| `npm run test:unit` | PASS：339 檔、6033 passed / 3 skipped（stderr 有既有的 node-pty `AttachConsole failed` 與 canvas `getContext` 雜訊，非失敗） |
| `npm run typecheck` | 0（exit 0） |
| `npx vite build` | 成功（exit 0） |
| 實機（BAT 視窗開超過 512 KiB 的 CT 檔） | 未做，僅單元測試 |

`validated_sha`：驗證時 HEAD 為 `c2a4a8ef`（T0709 收尾 commit）＋本單未 commit 變更；驗證後 commit 為 `50fe08d3`，內容即為驗證時的工作樹變更，之後未再改產品檔。

### 遭遇問題

- 無阻擋。執行期間 T0709 在同一 repo commit 了 3 筆（`809eab0d` / `2671b864` / `c2a4a8ef`），與本單檔案無交集；本單只 commit 自己的 `affects_files`。
- 偏離／補充：`TowerOverview.tsx` 與 `BmadEpicsView.tsx` 不在原列舉檔名內，屬 affects_files「ControlTowerPanel 內畫清單的子元件」範圍（sprint / epics 的錯誤要在該處顯示）。

### Commit

- 產品：`50fe08d329eddcb0d8c30fec6b5b60dd4ed7b952` `fix(ct): show CT panel read errors instead of empty lists (T0708, BUG-172)`（10 檔）
- 工單：本檔另一筆 commit（`chore: T0708 report, DONE (ct)`）
- 未 push、未觸發 workflow、未建 tag。BUG-172 與 `_bug-tracker.md` 未動（交塔台）。

### 回報時間

2026-10-29T09:54:35+0800
