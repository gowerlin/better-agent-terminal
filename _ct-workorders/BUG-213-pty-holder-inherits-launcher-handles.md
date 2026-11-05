---
schema_version: 1
schema_kind: bug
id: BUG-213
title: "Windows PTY holder 繼承 BAT 主行程可繼承的 handle：BAT 由帶 pipe 的呼叫端啟動時，升級後保留的 holder 讓呼叫端一直等不到 `close`"
status: FIXING
severity: low
reproducibility: "always（帶 pipe 啟動 BAT 時；T0862 run `41942234283` 實測 Playwright `ElectronApplication.close()` 卡到 30 分鐘逾時）"
created_at: "2026-11-05T09:33:33+08:00"
updated_at: "2026-11-05T09:40:53+0800"
impact:
  - pty-holder
  - windows
links:
  discovered_in: "T0862 回報區〈遭遇問題〉1、〈後續建議〉2"
  related: [T0862, T0865, T0866, T0859, PLAN-065, D286, D290, D291]
---
# BUG-213 — PTY holder 繼承啟動者的 handle

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟢 low（從檔案總管 / 開始功能表啟動沒有 pipe，不受影響） |
| 可重現 | ✅ 帶 pipe 啟動時必定 |
| **狀態** | ⏳ FIXING（T0865 查證 → D291 選 N-API addon → T0866 修正＋重跑 W6） |
| 回報者 | 塔台（T0862 Worker 發現） |

## 現象（預期 vs 實際）

- **預期**：BAT 主行程結束後，啟動 BAT 的呼叫端（終端、啟動器、IDE、測試框架）拿到 `close` / 結束事件。
- **實際**：BAT 主行程從呼叫端繼承了可繼承的 pipe handle，它啟動 holder（`spawn`，`electron/main.ts` `forkTerminalServer`）時 holder 再繼承下去；holder 在升級後保留，pipe 一直沒關，呼叫端等不到 `close`。

## 證據

- T0862 run `41942234283`：9 個情境中 8 個卡在 `ElectronApplication.close()` 到 30 分鐘逾時；產品行為本身正確（BAT 2.4–4 s 內結束）。spec 改以 `spawn`（`stdio: 'ignore'`）＋ CDP 啟動後 PASS（`c72247e5`）。

## 處置方向（待開單時由 Worker 查證）

- Windows 上 holder `spawn` 時只讓 stdio 與 `ipc` 被繼承（不讓 BAT 主行程其他可繼承 handle 傳下去），或在 BAT 主行程啟動時把繼承來的標準 handle 設成不可繼承。
- 🔴 改 holder 啟動路徑後要重跑 W6（`windows-upgrade-acceptance.yml`，指令見 `docs/agent-guide/pty-holder.md`）。holder 的啟動是新版的行為，不是已發佈版本的解除安裝 / quit 行為，發佈後仍可修。

## 查證（T0865，2026-11-05）

- **重現**（Windows 11、開發機的 Electron `45.2.1` 二進位，不跑安裝檔）：呼叫端以 Playwright `_electron.launch` 的 stdio（`['ignore','pipe','pipe','pipe','pipe']`）啟動 Electron，Electron 主行程以 holder 的同一組選項（`spawn`、`detached: true`、`stdio: ['ignore','ignore','ignore','ipc']`、`windowsHide: true`）起一個持續 20 s 的 node 子程序後 `app.exit(0)`：
  - 呼叫端在 1.6 s 收到 `exit`，8 s 內**沒有** `close`；仍開著的是 **4 個 pipe**（fd 1、2、3、4，呼叫端給的全部 pipe）。
  - 同樣的 Electron 程式、呼叫端改用 `stdio: 'ignore'` → 1.6 s 收到 `close`（= T0862 spec 的繞法）。
  - 沒有 holder 的舊路徑（`child_process.fork`，`ELECTRON_RUN_AS_NODE` 子程序）：**同樣** 4 個 pipe 都沒關。⇒ 不是 holder 才有：T0859 前，BAT 結束時保留的 Terminal Server 也會讓呼叫端等不到 `close`。
  - 對照：父程序換成純 Node（同樣的 `spawn` 選項）→ 1.6 s 收到 `close`。Node 啟動時會呼叫 libuv `uv_disable_stdio_inheritance()`（把繼承來的標準 handle 與 CRT fd 設為不可繼承），Electron 主行程沒有。
- **原因**：Windows 上 libuv `uv_spawn` 以 `CreateProcessW(bInheritHandles = TRUE)` 建立子程序（`ipc` 與 stdio 要靠繼承傳過去），沒有用 `PROC_THREAD_ATTRIBUTE_HANDLE_LIST`；所以 Electron 主行程裡所有可繼承的 handle（包含從呼叫端繼承來、仍是可繼承的 pipe）都會傳給子程序。
- **修正需要原生程式碼**：要讓 holder 不帶走這些 handle，只能在 BAT 主行程把它們設為不可繼承（`SetHandleInformation(h, HANDLE_FLAG_INHERIT, 0)`），或用 handle list 建立子程序。Node / Electron 的 JS API 都沒有這兩種能力（`child_process` 沒有對應選項；關掉 fd 0–2 再開 NUL 會讓 `GetStdHandle` 指向已關閉的 handle，也讓呼叫端收不到 BAT 的輸出，不可靠）。⇒ T0865 依停止條件回報 PARTIAL，選項見 T0865 回報區。
