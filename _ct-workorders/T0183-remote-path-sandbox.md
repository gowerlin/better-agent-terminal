# 工單 T0183-remote-path-sandbox

## 元資料
- **工單編號**：T0183
- **任務名稱**：Remote path sandbox + image cap（PLAN-018 第二張）
- **類型**：implementation
- **狀態**：TODO
- **建立時間**：2026-04-18 20:00 (UTC+8)
- **預估工時**：1-2h
- **優先級**：🔴 High（P0 資安）
- **Renew 次數**：0

## 前置條件

- **PLAN-018 PLANNED**：Remote 資安加固
- **T0181 DONE**（`4822dbd`）：拆分研究報告 `_report-t0181-plan-018-breakdown.md` **§D 為本工單權威規格**
- **T0164 DONE**：Upstream sync 研究
- **Upstream commit**：`3a0af80`（path sandbox 部分）

## 權威規格

**閱讀順序**：
1. `_report-t0181-plan-018-breakdown.md` **§D**（完整規格：修改檔案清單含精確行號、改動方向、AC 對照表、測試策略）
2. `_report-t0181-plan-018-breakdown.md` **§H**（Fork 客製化熱區 — 必須保留）
3. `_report-t0181-plan-018-breakdown.md` **§I.1** R4（symlink 處理風險）

## 修改範圍（摘要，完整見報告 §D）

- **新增**：`path-guard.ts`（或集中於 `main.ts` IPC handler 的驗證邏輯）
- **工作流程**：
  - FS IPC handler 加 workspace 路徑沙盒驗證（reject `..` 跨越根目錄、reject absolute path 外部 workspace）
  - Image IPC 加大小上限（cap）
  - Symlink 處理：跳出 workspace 則 skip，**不 throw**（AC-7 明確要求）

## 驗收條件

見 `_report-t0181-plan-018-breakdown.md` §D 的 AC 對照表。

**commit 訊息**：`feat(remote): path sandbox + image cap (PLAN-018 T0183)`

## 互動規則

**禁止 Worker 互動**（規格已完整）。

## 依賴

- **可並行**：與 T0182 **無依賴**（不同模組），可同日執行
- **無下游依賴**

## 備註

- 實作時注意 Windows path separator（`\` vs `/`）— sandbox 驗證需統一用 `path.resolve` + `path.relative`
- 若發現 fork 既有 workspace loader 已有部分驗證邏輯 → 沿用並擴充，**不**重建（參考報告 §H fork 客製化熱區）

---

## 回報區

> 以下由 sub-session 填寫

（待填：執行摘要、AC 驗收結果、修改檔案清單、Commit、Renew 歷程、DONE 時間）
