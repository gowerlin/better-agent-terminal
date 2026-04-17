# Bug Tracker

> ⚠️ 此文件由 `*sync` 自動生成，請勿手動編輯。
> 最後更新：2026-04-17 17:12 (UTC+8)
>
> 統計:🔴 Open: 0 | ⏳ Fixing: 0 | ✅ Fixed: 0 | 🧪 Verify: 0 | 🚫 Closed: 6 | ⛔ Won't Fix: 0 | **Total: 6**
>
> 📦 已歸檔：29 張（_archive/bugs/）

## 🔴 Open / 處理中

（目前無 Open bug）

## ⏳ 修復中 (FIXING)

（目前無 FIXING bug）

## ✅ 已修復

（目前無 Fixed bug — 全部已 CLOSED）

## 🧪 驗收中 (VERIFY)

（目前無 VERIFY bug）

## 🚫 已關閉 (CLOSED)

| ID | 標題 | 嚴重度 | 關閉時間 | 連結 |
|----|------|--------|---------|------|
| BUG-035 | PtyManager watchdog 在 shutdown 期間誤觸發 re-fork，產生孤兒 terminal-server | 🟡 Medium | 2026-04-17 17:12 | [BUG-035](BUG-035-watchdog-refork-during-shutdown.md) |
| BUG-034 | Quit Dialog checkbox 勾選後 Terminal Server 未結束（托盤 + File 皆中） | 🟡 Medium | 2026-04-17 17:12 | [BUG-034](BUG-034-checkbox-terminal-server-leak.md) |
| BUG-033 | 托盤 Quit 無 Dialog 直接退出，Terminal Server 殘留背景 | 🔴 High | 2026-04-17 17:12 | [BUG-033](BUG-033-tray-quit-no-dialog-server-leak.md) |
| BUG-032 | Helper scripts 未打包進安裝程式 + cwd-relative 路徑假設 | 🔴 High | 2026-04-17 13:58 | [BUG-032](BUG-032-helper-scripts-packaging-and-resolution.md) |
| BUG-031 | 外部 PTY 被分配到錯的 workspace（非 active） | 🟡 Medium | 2026-04-17 17:12 | [BUG-031](BUG-031-external-terminal-ui-not-synced.md) |
| BUG-030 | bat-terminal.mjs Git Bash MSYS 路徑轉換污染 | 🔴 High | 2026-04-17 02:42 | [BUG-030](BUG-030-bat-terminal-msys-path-conv.md) |

> 本輪 CLOSED 依據（D044）：
> - BUG-031：runtime 驗證通過（T0137 commit `f325d1d`）
> - BUG-033：T0145 情境 8.1-8.4 四條 Quit 路徑全綠（T0147 commit `ef867a2`）
> - BUG-034：T0145 情境 9.1-9.3 打包驗收通過（T0149 commit `cd460d2`）
> - BUG-035：T0145 情境 9.1 通過，log 無 re-forking（T0150 commit `31b4ec2`）
> - 歷史 CLOSED 已歸檔至 _archive/bugs/（29 張）

## ⛔ 不修復 (WONTFIX)

（目前無 WONTFIX bug）
