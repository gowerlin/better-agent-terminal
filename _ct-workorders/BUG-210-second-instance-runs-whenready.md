---
schema_version: 1
schema_kind: bug
id: BUG-210
title: "第二個 BAT 實例（沒拿到 single-instance lock）在 app.quit() 後仍跑 whenReady 的啟動流程，與主實例結束重疊時可能 fork 出新的 Terminal Server"
status: CLOSED
severity: low
reproducibility: "sometimes（T0823 本機 e2e 以帶 `--installer-quit-request` 的第二個實例實測；不帶參數的一般第二個實例為同一路徑的推論）"
created_at: "2026-11-04T03:04:55+0800"
updated_at: "2026-11-04T03:34:22+0800"
closed_at: "2026-11-04T03:34:22+0800"
closed_reason: "v0.7.4-pre.6 發佈（pre-release run 41701904056，tests job 含 second-instance-startup source guard 綠）；修正已以隔離實例 e2e 驗證（T0825）"
fixed_at: "2026-11-04T03:15:53+0800"
fixed_by: T0825
fix_commit: "bfde0beb"
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
| **狀態** | 🚫 CLOSED（`v0.7.4-pre.6` 發佈、CI Test gate 綠）；原 FIXED（T0825 `bfde0beb`：whenReady 開頭對「沒拿到 lock 或安裝程式請求行程」即 return；e2e 第二個實例 354 ms 結束、無 whenReady 之後的啟動行、無新 Terminal Server；待發版） |
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
- 2026-11-04 03:15 → FIXED（T0825 `bfde0beb`）：沒拿到 lock 的實例在 whenReady 第一個敘述 return 並記 `[startup] second instance: handed off to the running BAT, skipping startup`；ready 前模組層副作用逐項盤點皆無害、未搬動；單元 source guard＋突變 4 / 4、e2e 2 / 2（plain / `--profile=`；對照組拿掉修正 2 / 2 失敗、第二個實例 2.45 s 才結束並跑了 tray / terminal-server 偵測）、T0823 e2e 不回歸；typecheck 0 / 0、unit 406 檔 / 7124、legacy 472 / 33、vite build。待 `0.7.4-pre.6` 發佈（CI Test gate）後 CLOSED。
- 2026-11-04 03:34 → CLOSED：`v0.7.4-pre.6` 發佈（pre-release run `41701904056`，tests job 綠，含 `second-instance-startup.test.ts` source guard）；行為已由 T0825 隔離實例 e2e 驗證（plain / `--profile=`＋對照組）。
