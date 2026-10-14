---
schema_version: 1
schema_kind: workorder
id: T0521
title: "指揮塔面板：切換工作區不再把既有工單當成新工單 / 狀態變更跳 toast（BUG-127）"
type: implementation
status: DONE
repo: better-agent-terminal
project: BUG-127
priority: P2
sizing: S
created_at: "2026-10-14T13:19:21+0800"
started_at: "2026-10-14T13:21:25+0800"
updated_at: "2026-10-14T13:27:27+0800"
completed_at: "2026-10-14T13:27:27+0800"
target_version: "0.6.0-pre.8"
related:
  - BUG-127
affects_files:
  - src/components/ControlTowerPanel.tsx
  - src/components/__tests__/
  - src/__tests__/
  - src/styles/
  - _ct-workorders/T0521-ct-panel-toast-flood-on-workspace-switch.md
  - _ct-workorders/BUG-127-ct-panel-toast-flood-on-workspace-switch.md
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 不碰使用者正在用的 BAT（port 9876、真實 userData）；e2e / 截圖一律隔離實例。不消耗 Claude token。"
  - "🔴 **禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）；寫檔 LF；不 push；不跑全套 e2e（L141）。`src/styles/settings.css` 的 M 狀態不是你的變更，不要 commit 它。"
  - "🔴 與 T0522 並行（T0522 改 `src/components/TerminalPanel.tsx`）：commit 用 `git commit --only <自己的檔案>`，不要 `git add -A`。"
  - "🔴 改 `src/**` 驗收 `npm run typecheck` = 0；renderer 日誌用 `window.electronAPI.debug.log`。"
---

# T0521 — 指揮塔面板切換工作區 toast 洪水（BUG-127）

## 背景

Gary（mac）回報，在兩個工作區之間切換時，右側指揮塔面板疊出一整排 `📋 新工單: T000x` 和 `✅ T0001 已完成` toast，半透明地蓋住面板分頁和標題，他稱為「殘影」。截圖、現象和塔台初步定位見 **BUG-127**（請先讀並看截圖 `D:\Downloads\messageImage_1791954959950.jpg`）。

一句話推定根因：`ControlTowerPanel.tsx` 的 `prevOrdersRef`（:72）只在第一次載入（`size === 0`）時當基準線，切換工作區後沒有重設，新工作區的工單全部被判成新工單或狀態變更。

## 任務

1. **複核根因**：確認切換工作區時面板是重新 mount，還是同一個 instance 換了 `workspaceFolderPath`；也確認多個工作區各有自己的面板時（keep-alive / 隱藏但仍 mounted）會不會互相影響。結論寫進回報區
2. **修正（塔台裁決 2026-10-14 13:2x，使用者確認核心問題：「切換 WORKSPACE 是否需要重複出現工單更新提示」→ 不需要）**：
   - **切換工作區本身絕不觸發 toast**，同一則更新不得因來回切換重複出現
   - 基準線**以工作區為 key**（例如 `Map<workspaceFolderPath, Map<id, status>>`），不是單一 `prevOrdersRef`：
     - 第一次看到某工作區 → 靜默建立基準線
     - 切回已看過的工作區 → 跟**該工作區自己**上次的基準線比對；離開期間真的有新增 / 狀態變更，**最多提示一次**，然後更新基準線，之後再切換不會重複。若 Worker 判斷「切回時補提示」也會造成干擾，可以改成完全不補提示、只靜默更新；兩種都可接受，取捨寫進回報區
   - 同一工作區停留期間的新增 / 狀態變更照常即時通知
   - 要防非同步競態：舊工作區的載入結果晚到時，不得污染新工作區的基準線，也不得用舊工作區的資料發 toast
3. **toast 本身**：檢查切換工作區時，舊工作區留下的 toast 是否應清除；toast 疊加過多時要不要設上限 / 合併（例如超過 N 則合併為「N 張新工單」）。由 Worker 判斷，低成本就做，取捨寫進回報區
4. **視覺「殘影」**：判斷截圖的半透明重疊是否只是大量 toast 疊在一起的效果。若 toast 樣式本身（背景透明度、z-index、定位）會讓文字和底下的面板混在一起難以辨識，順手修。mac 專屬的合成層問題 AI 驗不了，記錄判斷即可
5. 檢查其他依「前次狀態」比對的通知（例如 BUG / PLAN 狀態變更）是否有同樣問題，有就一起修

## 驗證

- 單元測試：同一工作區新增工單 → toast；狀態變更 → toast；切換到另一個工作區（有既有工單）→ **不**發 toast；切回原工作區 → 不發 toast；舊工作區的載入結果晚到 → 不污染
- `npm run typecheck` = 0、`npx vite build` exit 0；`npm run test:unit` 全套無回歸
- 可行的話，用隔離實例做 e2e 或截圖（兩個帶 `_ct-workorders/` 的暫存工作區，切換後確認沒有 toast），附截圖路徑。成本高就以單元測試為主，在回報區說明

## 驗收條件

- [ ] 切換工作區不再跳既有工單的「新工單」/「已完成」toast；來回切換 N 次，同一則更新最多提示一次
- [ ] 同一工作區真正新增 / 狀態變更仍會通知
- [ ] BUG-127：`status: FIXED`、`fixed_at`、body 狀態列與「根因與修正」段同步

## Sub-session 執行指示

1. 讀本工單、BUG-127、截圖
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 實作 → 驗證 → 填回報區（DONE / PARTIAL / BLOCKED）
4. commit 本單檔案（`--only`）；不 push；依派發 mode 通知塔台

---

## 回報區

### 結果摘要

**狀態：DONE**（2026-10-14T13:26:26+0800）

切換工作區不再跳既有工單的「新工單」/「已完成」toast；同一工作區內的新增 / 狀態變更照常即時通知；舊工作區晚到的載入結果一律丟棄；toast 改為不透明底色。

### Landing Zone Check — PASS

- C-0：frontmatter `repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal` → PASS
- C-1：工單位於 `REPO_ROOT/_ct-workorders/` → PASS
- C-3：`src/components/ControlTowerPanel.tsx` 存在、`src/components/__tests__/` 存在 → PASS（informational）
- C-2：工單無 `branch` 欄位，HEAD = `main`
- `BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）；`CT_MODE=yolo`、`CT_INTERACTIVE=0`

### 1. 根因複核

- **右側邊欄（Gary 的情境）是同一個 instance 換 `workspaceFolderPath`**：`src/App.tsx:1167-1169` 以 `key={panel}`（`'control-tower'`）渲染 `renderDockablePanel(panel)`，`:848-850` 傳 `workspaceFolderPath={activeWorkspace.folderPath}`。切換工作區不 remount，`prevOrdersRef` 沿用舊工作區的 map。舊邏輯只在 `prevMap.size === 0` 時靜默建基準線，所以新工作區每張 id 不在舊 map 的工單都判成「新工單」、同 id 不同狀態（截圖的 T0001）判成「狀態變更」→ toast 洪水。塔台初步定位正確。
- **主窗格 docked（`WorkspaceView.tsx:1140`）是每個工作區各一個 instance**：`App.tsx:1098-1101` 以 `key={workspace.id}` 保持 mounted（隱藏的加 `hidden` class）。每個 instance 的 `workspaceFolderPath` 固定、各有自己的 ref，**不會互相影響**，也沒有這個 bug；隱藏中的 instance 仍會偵測並發 toast，但 ToastItem 的計時器照跑、到時自動消失，切過去最多看到幾秒內的真實更新。
- 另一個舊邏輯缺陷：工作區一開始 0 張工單時 `size === 0` 永遠成立，第一張新工單不會通知。新邏輯以「基準線是否屬於這個目錄」判斷，已一併修正（單元測試涵蓋）。
- **非同步競態**：`loadWorkOrders` 對每個檔案逐一 `await readFile`，切換時舊工作區的讀取可能晚到，舊碼會把舊工作區的清單 `setWorkOrders` 到新工作區、並以它覆寫基準線。

### 2. 修正（`src/components/ControlTowerPanel.tsx`）

- 新增純函式 `diffWorkOrders(baseline, ctDir, orders)` 與 `WorkOrderBaseline { ctDir, statuses }`：基準線**帶著所屬的 `_ct-workorders/` 路徑**；載入結果的目錄與基準線不同（首次載入、切換工作區後）→ 只建立基準線、不產生通知；同目錄才比對。通知種類與文字和舊版完全相同。
- **取捨（工單允許的第二種）：切回工作區時不補提示，只靜默更新基準線。** 沒採用 `Map<workspaceFolderPath, …>` 補提示，理由：
  1. 面板只 watch 目前工作區的目錄，離開期間的變更本來就看不到過程；切回時一次補出多則 toast 正是這次被抱怨的形態（即使「最多一次」，來回切兩個忙碌的工作區仍會每次跳一批）
  2. 使用者裁決「切換 WORKSPACE 不需要重複出現工單更新提示」；Worker 完成本來就有 `bat-notify` 送到 Tower 終端，面板 toast 不是唯一通知管道
  3. 單一帶路徑的基準線等同「以工作區為 key」且只保留目前那一個，不需要清理多工作區的 map
- **競態防護**：`currentWorkspaceRef` + `isStale(folder)`；`loadWorkOrders` 另加遞增序號（`orderLoadSeqRef` / `appliedOrderLoadSeqRef`），工作區已換或較新的載入已套用時整筆丟棄（不 set state、不動基準線、不發 toast）；`loading` 只由最新一次載入清除。讀取失敗（目錄消失）時基準線重設為 `null`，之後目錄回來的第一次載入靜默。
- 同樣的過期防護也加到其他 loader（sprint / bugs / backlog / decisions / BMad workflow / epics / 三個 archived loader），避免舊工作區的資料晚到後顯示在新工作區。

### 3. toast 本身

- **切換工作區時清除面板上的 toast**（effect on `workspaceFolderPath`，逐一 `dismissToast`）。
- **合併**：單次載入新工單 > `MAX_NEW_ORDER_TOASTS`（3）→ 合併為一則 `📋 新工單: T0014, T0013, T0012 +2`；不新增 i18n key。
- **上限**：面板同時最多 `MAX_VISIBLE_CT_TOASTS`（5）則，超過由最舊的開始 dismiss。
- 都只在 `ControlTowerPanel` 內處理，**未改共用的 `CtToast.tsx` / `useCtToast`**（App / Claude / Codex / Terminal / WorkspaceView 也在用，且 T0522 正在改 `TerminalPanel.tsx`）。

### 4. 視覺「殘影」

- 判斷：主因是 toast 本身**半透明**——`.ct-toast-success/info/warning` 的背景是 `rgba(..., 0.15)`，底下面板分頁、標題、工單卡片的文字直接透出來，疊 9 則就成了截圖那片「殘影」。不是 z-index 或定位問題（`z-index: 100`、`position: absolute` 正常）。
- 修正（`src/styles/control-tower.css`）：背景改為 `linear-gradient(<同一 tint>, <同一 tint>), var(--bg-secondary)`，色調不變、底色不透明。這是共用 class，其他用 `CtToast` 的地方（runtime / agent notice toast）一併變成不透明，屬可讀性改善、不影響版面。
- mac 專屬合成層問題 AI 無法驗證；以截圖判斷，現象完全可由半透明 + 大量疊加解釋。

### 5. 其他依「前次狀態」比對的通知

`ControlTowerPanel` 內只有工單 (`detectStatusChanges`) 會比對前次狀態發 toast；BUG / PLAN / decision / sprint 只更新顯示、不發通知（`grep addToast` 確認）。無同類問題。

### 修改檔案

- `src/components/ControlTowerPanel.tsx`
- `src/styles/control-tower.css`（僅 toast 三個背景）
- `src/components/__tests__/control-tower-panel-toasts.test.tsx`（新增）
- `_ct-workorders/T0521-…`、`_ct-workorders/BUG-127-…`

### 驗證

| Lane | 結果 | 證據 |
|---|---|---|
| 單元測試（新） | PASS | `control-tower-panel-toasts.test.tsx` 8/8：純函式 3 案（首次 / 換目錄靜默、同目錄 new+completed+started、空工作區第一張新工單會通知）；元件 5 案（同工作區新增 / 完成 → toast；A↔B 來回 3 次 → 0 toast；離開期間 A 有變更 → 切回不提示、再來回也不重播；切換清除舊 toast；A 的讀取被 hold 住→切到 C→A 晚到：不顯示 A 的工單、無 toast、C 的後續變更仍正確通知；5 張新工單合併為一則、逐張 8 則後畫面只留 5 則） |
| 變異檢查 | PASS | 暫時把 `baseline.ctDir !== ctDir` 拿掉 → 4 案失敗；暫時讓 `superseded()` 恆為 false → 晚到案失敗。皆已還原（以檔案備份複製回，未用 git restore） |
| `npm run typecheck` | PASS | exit 0 |
| `npm run test:unit` 全套 | PASS | 213 files / 3542 passed / 1 skipped，exit 0（`AttachConsole failed` 為 node-pty Windows 既有雜訊） |
| `npx vite build` | PASS | exit 0 |
| e2e / 截圖 | 未做 | 需在隔離實例建兩個帶 `_ct-workorders/` 的工作區並把指揮塔 dock 到右側邊欄，成本高；以元件層級測試（真的 render `ControlTowerPanel`、rerender 換 `workspaceFolderPath`，與右側邊欄同一路徑）取代。mac 視覺需真人複驗 |

註：typecheck / build / 全套測試執行時工作樹含 T0522 並行中的未 commit 變更（`TerminalPanel.tsx`、`electron/*`），結果涵蓋兩者。

### Commit

`5962450` `fix(control-tower): no work-order toasts on workspace switch (T0521, BUG-127)`（`git commit --only`，只含本單 4 個檔案；`src/styles/settings.css` 與 T0522 檔案未納入）。未 push。

### 偏差 / 後續

- 無範圍外修改。共用 `.ct-toast-*` 背景改為不透明會影響所有 `CtToast` 使用處（預期內的可讀性改善）。
- 建議驗收：mac 上兩個帶工單的工作區來回切換，確認右側指揮塔無 toast；在當前工作區新增工單 / 改狀態仍跳 toast。
