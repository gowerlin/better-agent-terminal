---
schema_version: 1
schema_kind: bug
id: BUG-210
title: "第二個 BAT 實例（沒拿到 single-instance lock）在 app.quit() 後仍跑 whenReady 的啟動流程，與主實例結束重疊時可能 fork 出新的 Terminal Server"
status: FIXING
severity: low
reproducibility: "sometimes（T0823 本機 e2e 以帶 `--installer-quit-request` 的第二個實例實測；不帶參數的一般第二個實例為同一路徑的推論）"
created_at: "2026-11-04T03:04:55+0800"
updated_at: "2026-11-04T03:04:55+0800"
impact:
  - startup
  - terminal-server
links:
  discovered_in: "T0823 回報區〈實作中發現並修正的三件事〉1、〈後續建議〉1"
  related: [T0823, T0825, PLAN-063, D268]
---
# BUG-210 — 第二個實例仍跑 whenReady

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟢 low（主實例在跑時通常無害；與主實例結束的時間點重疊時可能多 fork 一個 Terminal Server、讀掉一次性的紀錄檔） |
| 可重現 | 有時（時間點重疊才有後果） |
| **狀態** | ⏳ FIXING（T0825，D268） |
| 回報者 | 塔台（T0823 實測） |

## 現象

`electron/main.ts`：`const gotTheLock = app.requestSingleInstanceLock()`；沒拿到 lock 時呼叫 `app.quit()`，但 `app.quit()` 不會阻止 `app.whenReady().then(…)` 執行（T0823 本機 e2e 實測）。第二個實例因此在退出前跑了部分啟動流程（建 tray、`UpgradeInterruptionCheck.begin()`、`startTerminalServer()` 等）。T0823 遇到的情況：帶 `--installer-quit-request` 的請求行程在主實例結束、釋放 lock 與 Terminal Server 之後跑起完整啟動，讀掉紀錄並 fork 了新 server（pid 檔殘留）。T0823 只替請求行程加了 `if (installerQuitRequestProcess) return`；一般的第二個實例（使用者再點一次捷徑、檔案總管開啟等）仍走同一路徑。

預期：沒拿到 lock 的實例只把 argv 交給主實例（`second-instance`）就結束，不執行任何啟動步驟。

## 重現步驟

1. BAT 執行中（預設 runtime）。
2. 再啟動一次 BAT（不帶參數）；或在主實例正在結束時啟動。
3. 觀察第二個實例的 debug log 是否有 `[startup] app.whenReady fired`、Terminal Server 啟動等行；時間點重疊時是否多出 server / pid 檔。

## 修正方向

- `!gotTheLock` 時 whenReady 一律在開頭 return（與 T0823 的 `installerQuitRequestProcess` 同一處），並確認 `ready` 之前的模組層副作用（IPC 註冊、logger、`app-paths-bootstrap`、early crash capture）對第二個實例無害或也跳過。

## 狀態歷程

- 2026-11-04 03:04 開單並 → FIXING（D268：併入 `0.7.4-pre.6` 這一批，T0825）。
