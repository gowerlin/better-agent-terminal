---
schema_version: 1
schema_kind: bug
id: BUG-127
title: "指揮塔面板：在兩個工作區之間切換時，右上角疊出一整排「新工單: T000x」toast（外部測試者A 稱「殘影」），蓋住面板分頁與標題"
status: FIXED
severity: low
reproducibility: always
created_at: "2026-10-14T13:19:21+0800"
updated_at: "2026-10-14T13:27:16+0800"
fixed_at: "2026-10-14T13:27:16+0800"
impact:
  - control-tower-panel
  - ui-notification
links:
  discovered_in: "外部測試者A 回報（mac，LINE 2026-10-14 13:16，版本未確認）"
  fix_workorder: T0521
  related: []
---

# BUG-127 — 切換工作區時指揮塔面板 toast 洪水（「殘影」）

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟢 low（誤導 + 遮擋面板；功能未壞） |
| 可重現 | 推定必現（兩個工作區都有 `_ct-workorders/` 時） |
| **狀態** | ✅ FIXED（T0521，待 mac 實機驗收） |
| 回報者 | 外部測試者A（mac） |

## 現象

- 截圖：`D:\Downloads\messageImage_1791954959950.jpg`
- 外部測試者A 原話：「我在這裡兩個專案做切換，右邊會出現殘影」。左側 Sidebar 有兩個工作區（`<專案B>` / `<專案D>`）
- 右側指揮塔面板上方（紅框）疊了一整列 toast：`📋 新工單: T0008`、`T0009`、`T0007`、`T0006`、`T0005`、`T0004`、`T0003`、`T0002`，還有 `✅ T0001 已完成`。這些 toast 半透明疊在面板分頁（總覽 / 工單 / 史詩 / 工作流程 / 待審 / 決策）和標題「指揮塔」上，看起來像殘影
- 工單清單本身正常（T0001-T0009，1 active / 8 done）

## 預期

- 切換工作區只是換顯示內容，不應把新工作區裡既有的工單當成「新工單」或「狀態變更」跳 toast
- 只有同一個工作區內真正新增工單或狀態變更時才通知

## 塔台初步定位（Worker 須複核）

- `src/components/ControlTowerPanel.tsx:72` `prevOrdersRef`，以及 `:296-326` `detectStatusChanges`：只有 `prevMap.size === 0`（第一次載入）時才把結果當基準線、不發 toast
- 切換工作區（`workspaceFolderPath` 改變）時，沒看到 `prevOrdersRef` 重設的地方 ⇒ 新工作區的工單 id 不在舊 map 裡，每一張都算「新工單」；id 相同但狀態不同的（例如 T0001）則算「狀態變更」⇒ 截圖裡的 toast 洪水
- 「半透明 / 殘影」的視覺效果，可能只是大量 toast 疊在一起的樣子，也可能另有 mac 合成層問題，Worker 判斷

## 根因與修正

**根因（T0521 複核確認）**：右側邊欄的指揮塔面板是單一 instance（`src/App.tsx` `key={panel}`），切換工作區只換 `workspaceFolderPath`、不 remount。`prevOrdersRef` 只在 `size === 0` 時靜默建基準線、切換時不重設 ⇒ 新工作區的工單全被當成新工單 / 狀態變更。主窗格 docked 的面板每個工作區各一個 instance，不受影響。「殘影」來自 toast 背景 `rgba(..., 0.15)` 半透明，底下面板文字透出，9 則疊加後看起來像殘影；與 mac 合成層無關（可由截圖完整解釋，AI 無法實機驗證）。

**修正（T0521）**：
- `diffWorkOrders()`：基準線帶所屬 `_ct-workorders/` 路徑；載入目錄與基準線不同（首次、切換後）只靜默建基準線，同目錄才比對。切回工作區不補提示（取捨見 T0521 回報區）
- 非同步競態：舊工作區晚到的載入結果整筆丟棄（所有 loader）；工單載入另以序號擋亂序
- 切換工作區清除面板 toast；單次 > 3 張新工單合併為一則；面板最多同時 5 則
- `.ct-toast-*` 背景改為 tint 疊在 `var(--bg-secondary)` 上的不透明底色
- 驗證：`src/components/__tests__/control-tower-panel-toasts.test.tsx`（8 案）、`npm run typecheck` = 0、`npm run test:unit` 全綠、`npx vite build` exit 0
