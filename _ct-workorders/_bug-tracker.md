# Bug Tracker

> ⚠️ 此文件由 `*sync` 自動生成，請勿手動編輯。
> 最後更新：2026-04-17 16:49 (UTC+8)
>
> 統計:🔴 Open: 1 | ⏳ Fixing: 0 | ✅ Fixed: 2 | 🧪 Verify: 1 | 🚫 Closed: 2 | ⛔ Won't Fix: 0 | **Total: 6**
>
> 📦 已歸檔：29 張（_archive/bugs/）

## 🔴 Open / 處理中

| ID | 標題 | 嚴重度 | 建立時間 | 連結 |
|----|------|--------|---------|------|
| BUG-035 | PtyManager watchdog 在 shutdown 期間誤觸發 re-fork，產生孤兒 terminal-server | 🟡 Medium | 2026-04-17 16:49 | [BUG-035](BUG-035-watchdog-refork-during-shutdown.md) |

> BUG-035：T0149 修 BUG-034 early-return 後才顯現化的 pre-existing race（watchdog 把 graceful TCP close 誤判為 crash）；T0150 修復工單已派發（加 `beginShutdown()` + guard，無需研究）

## ⏳ 修復中 (FIXING)

（目前無 FIXING bug）

## ✅ 已修復

| ID | 標題 | 嚴重度 | 修復時間 | 連結 |
|----|------|--------|---------|------|
| BUG-034 | Quit Dialog checkbox 勾選後 Terminal Server 未結束（托盤 + File 皆中） | 🟡 Medium | 2026-04-17 16:20 | [BUG-034](BUG-034-checkbox-terminal-server-leak.md) |
| BUG-031 | 外部 PTY 被分配到錯的 workspace（非 active） | 🟡 Medium | 2026-04-17 03:02 | [BUG-031](BUG-031-external-terminal-ui-not-synced.md) |

> BUG-034：T0149 commit `cd460d2`，方案 C 實作完成（SIGTERM → TCP shutdown → pidfile wait → taskkill/SIGKILL）+ tcpSocket leak 修復 + 誤報 log 移除；等 T0145 情境 8 打包驗收 → CLOSED

> ⏳ 待 rebuild + 重裝 BAT 後做 runtime 驗證 → CLOSED

## 🧪 驗收中 (VERIFY)

| ID | 標題 | 嚴重度 | 驗證時間 | 連結 |
|----|------|--------|---------|------|
| BUG-033 | 托盤 Quit 無 Dialog 直接退出，Terminal Server 殘留背景 | 🔴 High | 2026-04-17 15:14 | [BUG-033](BUG-033-tray-quit-no-dialog-server-leak.md) |

> BUG-033：T0147 修復完成（commit `ef867a2`），dev serve 四路徑已通過；等 T0145 打包驗收覆蓋後 → CLOSED

## 🚫 已關閉 (CLOSED)

| ID | 標題 | 嚴重度 | 關閉時間 | 連結 |
|----|------|--------|---------|------|
| BUG-032 | Helper scripts 未打包進安裝程式 + cwd-relative 路徑假設 | 🔴 High | 2026-04-17 13:58 | [BUG-032](BUG-032-helper-scripts-packaging-and-resolution.md) |
| BUG-030 | bat-terminal.mjs Git Bash MSYS 路徑轉換污染 | 🔴 High | 2026-04-17 02:42 | [BUG-030](BUG-030-bat-terminal-msys-path-conv.md) |

> 歷史 CLOSED 已歸檔至 _archive/bugs/（29 張）
> BUG-032 關閉依據：T0143 Task B 全綠（D036）

## ⛔ 不修復 (WONTFIX)

（目前無 WONTFIX bug）
