# PLAN-019-typescript-debt-cleanup

## 元資料
- **編號**：PLAN-019
- **標題**：清理 fork 既有 TypeScript 技術債（`tsc --noEmit` ~20 errors）
- **狀態**：IDEA
- **優先級**：🟢 Low
- **建立時間**：2026-04-18 07:35 (UTC+8)
- **完成時間**：（完成時填入）
- **發現來源**：T0165 PARTIAL 回報區「遭遇問題 #1」
- **關聯**：T0165（升級時順帶發現，非本輪範圍）

## 描述

Fork 在執行 T0165 時，sub-session 跑 `tsc --noEmit` 發現約 20 個 TypeScript 錯誤，分布於：
- `ThumbnailBar`
- `UpdateNotification`
- `WorkspaceView`
- `main.tsx`
- 其他若干模組（待精確盤點）

**關鍵事實**：
- 這些錯誤**全數存在於 T0165 升級前**，與 effort level / SDK 升級無關
- Fork 的正式 build 流程是 `npx vite build`（不跑 tsc strict），build 流程**全綠**
- 因此不影響 runtime、不影響 release；純屬維護品質問題

## 為什麼 Low 優先

1. **不影響 build / runtime**：vite build 照過，產品可正常交付
2. **不阻塞任何功能**：新功能開發不會被這些既有錯誤卡住
3. **與 upstream 同步無關**：這些錯誤可能也存在於 upstream（繼承），或 fork 演進過程累積，與同步策略無直接影響

## 為什麼值得追蹤

1. **`tsc` 檢查失去價值**：若持續累積，`tsc --noEmit` 無法作為新變更的 regression 防護
2. **IDE 訊號雜訊**：開發時 IDE 會一直顯示這些錯誤，干擾判斷新引入的真錯誤
3. **潛在 bug 隱藏風險**：有些錯誤（如 any cast / missing type）可能遮蔽真 bug
4. **未來升級 TS / React 版本的阻力**：技術債愈深，升級愈痛

## 建議執行方式（實作階段再定）

選項 A：**一次清光**（2-4h）
- 逐檔修正，可能分批 commit
- 風險：改動範圍可能大，需搭配 smoke test

選項 B：**分模組清理**（每輪 0.5-1h）
- 每次清一個模組（如只清 ThumbnailBar），獨立 commit
- 風險低，但時程拉長

選項 C：**降低 strict 層級**（10 分鐘）
- 調整 tsconfig 放寬檢查
- 治標不治本，**不建議**

## 前置工作（實作前需先做）

- [ ] 精確盤點：列出所有 20+ 錯誤的 **檔案 / 錯誤類型 / 錯誤訊息摘要**
- [ ] 分類：真 bug / 型別不精確 / 第三方型別缺失 / 需要 `// @ts-expect-error` 的情境
- [ ] 評估各分類的處理成本
- [ ] 決定要走選項 A 還是 B

## 相關工單
（實作階段另開 T####）

## 備註

- **無時程壓力**：可長期掛在 backlog，等有空檔時清
- **可作為新手任務**：分模組清理是很好的 fork 熟悉過程
- **與 PLAN-015 思路類似**：技術債追蹤型 PLAN，非必要但值得做
