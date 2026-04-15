# BUG-026 — _bmad-output/ 目錄未被 file watch 監聽

## 狀態
**🚫 CLOSED** (T0105 修復，人工驗收通過 2026-04-13)

## 發現時間
2026-04-13 18:17 UTC+8（T0102 靜態分析附帶發現）

## 現象描述

CT 面板的 file watch 只監聽 `_ct-workorders/` 目錄（recursive），**未監聽 `_bmad-output/`**。

**影響頁籤**：
- **Workflow 頁籤**：讀取 `_bmad-output/planning-artifacts/` 和 `_bmad-output/implementation-artifacts/`
- **Epics 頁籤**：讀取 `_bmad-output/planning-artifacts/epics.md`

**預期行為**：修改 `_bmad-output/` 下的文件後，CT 面板自動刷新對應頁籤
**實際行為**：需要手動點擊「↻」按鈕才能看到更新

## 根因

`electron/main.ts`（或對應的 IPC handler）中，`fsSync.watch` 只設定了 `_ct-workorders/` 路徑：

```js
// 目前只有這個
fsSync.watch(ctWorkordersPath, { recursive: true }, handler)

// 缺少
fsSync.watch(bmadOutputPath, { recursive: true }, handler)
```

## 嚴重度
**🟡 Medium** — 功能降級但不崩潰，有手動刷新 workaround

## 修復方向

在 file watch 初始化時，額外加入 `_bmad-output/` 的監聽：
1. 偵測 `_bmad-output/` 是否存在（不存在時跳過，不報錯）
2. 若存在，加入 recursive watch
3. 觸發事件時，重新載入 bmadWorkflow 和 epics 資料

## 相關
- **發現於**：T0102（CT 面板資料來源診斷）
- **修復工單**：待派（T0105+）
