---
schema_version: 1
schema_kind: bug
id: BUG-213
title: "Windows PTY holder 繼承 BAT 主行程可繼承的 handle：BAT 由帶 pipe 的呼叫端啟動時，升級後保留的 holder 讓呼叫端一直等不到 `close`"
status: OPEN
severity: low
reproducibility: "always（帶 pipe 啟動 BAT 時；T0862 run `41942234283` 實測 Playwright `ElectronApplication.close()` 卡到 30 分鐘逾時）"
created_at: "2026-11-05T09:33:33+08:00"
updated_at: "2026-11-05T09:33:33+08:00"
impact:
  - pty-holder
  - windows
links:
  discovered_in: "T0862 回報區〈遭遇問題〉1、〈後續建議〉2"
  related: [T0862, T0859, PLAN-065, D286]
---
# BUG-213 — PTY holder 繼承啟動者的 handle

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟢 low（從檔案總管 / 開始功能表啟動沒有 pipe，不受影響） |
| 可重現 | ✅ 帶 pipe 啟動時必定 |
| **狀態** | 🔴 OPEN（後續；不擋 `0.7.5-pre.1`） |
| 回報者 | 塔台（T0862 Worker 發現） |

## 現象（預期 vs 實際）

- **預期**：BAT 主行程結束後，啟動 BAT 的呼叫端（終端、啟動器、IDE、測試框架）拿到 `close` / 結束事件。
- **實際**：BAT 主行程從呼叫端繼承了可繼承的 pipe handle，它啟動 holder（`spawn`，`electron/main.ts` `forkTerminalServer`）時 holder 再繼承下去；holder 在升級後保留，pipe 一直沒關，呼叫端等不到 `close`。

## 證據

- T0862 run `41942234283`：9 個情境中 8 個卡在 `ElectronApplication.close()` 到 30 分鐘逾時；產品行為本身正確（BAT 2.4–4 s 內結束）。spec 改以 `spawn`（`stdio: 'ignore'`）＋ CDP 啟動後 PASS（`c72247e5`）。

## 處置方向（待開單時由 Worker 查證）

- Windows 上 holder `spawn` 時只讓 stdio 與 `ipc` 被繼承（不讓 BAT 主行程其他可繼承 handle 傳下去），或在 BAT 主行程啟動時把繼承來的標準 handle 設成不可繼承。
- 🔴 改 holder 啟動路徑後要重跑 W6（`windows-upgrade-acceptance.yml`，指令見 `docs/agent-guide/pty-holder.md`）。holder 的啟動是新版的行為，不是已發佈版本的解除安裝 / quit 行為，發佈後仍可修。
