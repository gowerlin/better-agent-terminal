---
schema_version: 1
schema_kind: bug
id: BUG-086
title: WSL 設定精靈把「已裝 WSL 但無發行版」誤判為「找不到 WSL2」，引導使用者重裝 WSL
status: FIXED
fix_commits: [4d814e9]
fixed_at: "2026-10-04T21:27:18+08:00"
severity: low
reproducibility: always
created_at: "2026-10-04T21:08:07+08:00"
updated_at: "2026-10-04T21:28:52+08:00"
impact:
  - setup-wizard-wsl
links:
  fix_workorder: T0378
  decision: D126
  related: [BUG-071, BUG-072, BUG-087]
---

# BUG-086 — WSL 精靈把「無發行版」誤報為「找不到 WSL2」

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟢 low（UX 引導錯誤；使用者照做 `wsl --install` 不會壞事，但不會解決問題） |
| 可重現 | 100%：Windows 已安裝 WSL（Store 版）但未註冊任何發行版 |
| **狀態** | ✅ FIXED（T0378 `4d814e9`；「無發行版」「沒裝 WSL」兩態僅 mock unit test 覆蓋，本機無法重現） |
| 回報者 | 塔台（2026-10-04 第五十一 session，BUG-071 實機驗收時發現；使用者截圖 + 塔台環境檢查） |

## 現象

`Add WSL Profile` → 設定精靈第 1 步「偵測目標環境」失敗：

```
Unable to detect WSL: Error invoking remote method 'wsl:list': Error: Command failed: wsl -l -v
```

右側說明顯示 **「找不到 WSL2 — 請先安裝 WSL2，然後重試。Windows 11 / 10 22H2 可在 PowerShell 執行 `wsl --install`。」**

- **預期**：辨識出「WSL 已安裝、沒有發行版」，引導 `wsl --install -d Ubuntu-24.04`（或 `wsl --list --online` 挑選）
- **實際**：一律歸類為「WSL 未安裝」，引導執行 `wsl --install`

## 塔台環境事實（2026-10-04 21:04，未做程式碼分析）

| 項目 | 值 |
|------|----|
| `wsl --version` | WSL **2.7.13.0**、核心 6.18.33.2-2（exit 0） |
| `wsl --status` | 預設版本 2（exit 0） |
| `wsl -l -v` | 「沒有已安裝的發行版」+ 提示 `wsl.exe --install <Distro>`，**exit -1** |
| 修復後 | 安裝 `Ubuntu-24.04` 後 `wsl -l -v` exit 0 ⇒ 確認 exit -1 純因「無發行版」 |

⇒ `wsl -l -v` 非零 exit **不等於** WSL 未安裝。精靈把兩種狀態混為一談。

## 相關程式碼位置（grep 定位，未分析）

- `electron/main.ts:3506` — `ipcMain.handle('wsl:list', () => wslDetect.list())`
- `electron/wsl-detect.ts` — 執行 `wsl -l -v`
- `src/components/setup-wizard/error-mapper.ts:127` — 「請先安裝 WSL2…`wsl --install`」文案
- `src/components/setup-wizard/steps/wsl/pick-wsl-distro.ts:22` — 已有 `No WSL distros found. Run \`wsl --install -d Ubuntu\` first.`，但偵測步驟先拋錯，走不到這裡

## 修復方向（候選，待工單細化）

1. `wsl-detect` 區分三態：WSL 未安裝 / 已安裝無發行版 / 有發行版（例如輔以 `wsl --status` 或 `wsl --version` 的 exit code）
2. `error-mapper` 增加「無發行版」分類與對應 i18n 文案，引導 `wsl --install -d Ubuntu-24.04`
3. 注意 `wsl.exe` 輸出為 **UTF-16LE**，判斷勿依賴本地化字串，以 exit code 為主
4. 補 unit test（`error-mapper` / 偵測分類）

## FIXED 證據（2026-10-04 21:28 UTC+8，塔台驗收 T0378）

- 修復 commit：`4d814e9`（T0378，22 files）
- 塔台重跑：`npm run test:unit` **55 files / 749 passed**（709 → 749）、`npx vite build` exit 0、`npx tsc --noEmit` **40**（= baseline）
- Worker 本機 runtime（`Ubuntu-24.04`）：見 T0378 回報區
- **待實機**：新 build 從頭跑 WSL 精靈 9/9
