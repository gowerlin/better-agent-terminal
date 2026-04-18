# Bug Tracker

> ⚠️ 此文件由 `*sync` 自動生成，請勿手動編輯。
> 最後更新：2026-04-18 21:50 (UTC+8)
>
> 統計：🔴 Open: 0 | ⏳ Fixing: 0 | ✅ Fixed: 0 | 🧪 Verify: 0 | 🚫 Closed: 6 | ⛔ Won't Fix: 0 | **Total: 6**
>
> 📦 已歸檔：35 張（_archive/bugs/）
>
> 本 session 閉環：BUG-040 + BUG-041 CLOSED（Phase 2 v4.3.0 完結）

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
| BUG-038 | ELECTRON_RUN_AS_NODE=1 洩漏至 terminal 子 shell（BAT 內跑 Electron app 失敗） | 🟡 Medium | 2026-04-18 03:01 | [BUG-038](BUG-038-electron-run-as-node-env-leak.md) |
| BUG-037 | Git 圖譜 panel 內容全黑（T0156 regression，WorkspaceView 缺 case + PROXIED_CHANNELS 未 bridge） | 🟡 Medium | 2026-04-18 00:43 | [BUG-037](BUG-037-git-graph-panel-blank-content.md) |
| BUG-034 | Quit Dialog checkbox 勾選後 Terminal Server 未結束（托盤 + File 皆中） | 🟡 Medium | 2026-04-17 17:12 | [BUG-034](BUG-034-checkbox-terminal-server-leak.md) |

> 本輪 CLOSED 依據：
> - BUG-038：T0161 runtime 驗收通過（commit `9d734a8`，方案 B strip ELECTRON_RUN_AS_NODE from PTY children，D051）
> - BUG-037：T0158 runtime UAT 通過（commit `fbcf2d2`，方案 A + Layer 2 PROXIED_CHANNELS bridge）
> - BUG-034：T0145 情境 9.1-9.3 打包驗收通過（T0149 commit `cd460d2`）
>
> 熱區保留理由：
> - BUG-034：被 Active PLAN-013 🟢 IDEA 引用（Installer 檔案鎖定詢問 kill Terminal Server），日後實作時需回溯此 bug 的檢測與 kill 流程設計
> - BUG-037：2026-04-18 當日 CLOSED，未滿 archive_days 門檻
> - BUG-038：2026-04-18 當日 CLOSED，未滿 archive_days 門檻
>
> 歷史 CLOSED 已歸檔至 _archive/bugs/（35 張）
> 本輪（2026-04-18 05:45）新歸檔：BUG-030, BUG-031, BUG-032, BUG-033, BUG-035, BUG-036

## ⛔ 不修復 (WONTFIX)

（目前無 WONTFIX bug）
