---
schema_version: 1
schema_kind: workorder
id: T0521
title: "指揮塔面板：切換工作區不再把既有工單當成新工單 / 狀態變更跳 toast（BUG-127）"
type: implementation
status: PENDING
repo: better-agent-terminal
project: BUG-127
priority: P2
sizing: S
created_at: "2026-10-14T13:19:21+0800"
started_at: null
updated_at: "2026-10-14T13:19:21+0800"
completed_at: null
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

（Worker 填寫）
