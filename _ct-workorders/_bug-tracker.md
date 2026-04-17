# Bug Tracker

> ⚠️ 此文件由 `*sync` 自動生成，請勿手動編輯。
> 最後更新：2026-04-17 15:15 (UTC+8)
>
> 統計:🔴 Open: 0 | ⏳ Fixing: 0 | ✅ Fixed: 1 | 🧪 Verify: 1 | 🚫 Closed: 2 | ⛔ Won't Fix: 0 | **Total: 4**
>
> 📦 已歸檔：29 張（_archive/bugs/）

## 🔴 Open / 處理中

（目前無 Open bug）

## ⏳ 修復中 (FIXING)

（目前無 FIXING bug）

## ✅ 已修復

| ID | 標題 | 嚴重度 | 修復時間 | 連結 |
|----|------|--------|---------|------|
| BUG-031 | 外部 PTY 被分配到錯的 workspace（非 active） | 🟡 Medium | 2026-04-17 03:02 | [BUG-031](BUG-031-external-terminal-ui-not-synced.md) |

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
