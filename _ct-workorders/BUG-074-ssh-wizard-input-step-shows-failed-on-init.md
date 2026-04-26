# BUG-074 — SSH setup wizard：configure-host input step 在使用者還沒輸入前就顯示為 failed 狀態

## Metadata

| 欄位 | 內容 |
|------|------|
| BUG 編號 | BUG-074 |
| 標題 | SSH wizard 第 1 步「設定 SSH 主機資訊」是 input step（要使用者輸入 SSH host），但 wizard 開啟時**立即顯示為 failed 狀態**（紅 X + 錯誤訊息「SSH host is required」+ Retry/Skip/Cancel 按鈕） |
| 嚴重度 | 🟡 Medium（UX 不直觀；使用者誤以為 wizard 已壞） |
| 可重現 | 100%（任何使用者開 SSH wizard 都看到第 1 步是 failed 狀態） |
| Workaround | 使用者點「重試」或自行理解這是 input prompt 而非 error（不直觀） |
| 狀態 | 🐛 OPEN |
| 建立時間 | 2026-04-27 00:?? (UTC+8) |
| 報告者 | 使用者（PLAN-030 完工後實機跑 SSH wizard，screenshot #9） |
| 影響範圍 | `src/components/setup-wizard/steps/ssh/configure-host.ts` 的 step state 邏輯 / SetupWizardShell 對 input step 的渲染 |
| Root cause | input step 設計上應在等待使用者輸入時為 `running` 或 `awaiting-input` 狀態（不算 failed），但目前實作在使用者還沒輸入時直接拋 validation error → step status 變 failed → 渲染為紅 X + Retry/Skip 按鈕。等於把「等待輸入」誤等同「失敗」。 |
| 相關 PLAN | PLAN-007（SSH deployment 路徑）/ PLAN-030（Stepper status 設計層面） |
| 相關 BUG | BUG-072 / BUG-073（同類 — wizard UX 不友善 family） |
| Release target | 視 wizard error UX 整體策略一起評估 |

## 現象

### 觸發步驟

1. 開 BAT v0.4.1
2. Profile config → `+ 更多 ▼` → 「+ SSH Profile」
3. Wizard 一打開 → 第 1 步「設定 SSH 主機資訊」**立即顯示**：
   - 紅 X 圖示
   - 錯誤訊息：「SSH host is required (pick an alias from ~/.ssh/config or type host).」
   - Retry / Skip / Cancel 按鈕
4. 使用者**完全沒看到輸入框**，誤以為 wizard 開啟即失敗

### 預期行為

input step 應有專屬狀態（如 `awaiting-input` / `pending-user-input`），渲染為：

```
🔵 設定 SSH 主機資訊

請選擇主機 alias 或輸入 host：
[alias dropdown]  或  [host text input]
[port: 22]  [user: <auto-detected>]
[認證方式: 金鑰 ▼]

[繼續]  [取消]
```

而**不是**紅 X + Retry 按鈕。

### Stepper 狀態擴充（可能要動 T0307 元件）

現有 `StepStatus` 沒有 `awaiting-input`，需評估：
- **A** 加新 status `awaiting-input`，視覺：藍色框 + 圖示 🔵 + 不顯示 Retry/Skip
- **B** 用既有 `running` status + step.error = null 區分（純 CSS 處理）
- **C** input step 完全不參與 stepper status flow，render 為獨立 prompt UI

塔台建議 [A]（語意清楚）或 [B]（最小變動）。

## 後續處理

塔台建議：與 BUG-072 / BUG-073 一起派 **Wizard Error UX overhaul** 工單群（或 PLAN-031）統一處理。
