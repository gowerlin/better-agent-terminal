# Bug Tracker

> ⚠️ 此文件由 `*sync` 自動生成，請勿手動編輯。
> 最後更新：2026-04-19 11:36 (UTC+8)
>
> 統計：🔴 Open: 1 | ⏳ Fixing: 0 | ✅ Fixed: 0 | 🧪 Verify: 1 | 🚫 Closed: 12 | ⛔ Won't Fix: 0 | **Total: 14**
>
> 📦 已歸檔：35 張（_archive/bugs/）
>
> 本 session 事件:
> - BUG-045 OPEN → CLOSED(使用者驗收通過,原截圖回報問題已解;archive 面屬塔台推測延伸,不列入本 BUG 範圍)
> - BUG-048 新增 → 研究完成待修(T0206 `c6d3d97` 研究 DONE,推薦 Option B,下 session 派 T0207 修復)
> - T0203 完成(research,`5fe3f6a`,7 min,4-8x)→ 推薦 Option B
> - BUG-042 OPEN → FIXING → CLOSED(T0204 `85f5743`,純刪死碼 -28 行,tsc 0 errors,PLAN-019 型別債清零)
> - BUG-049 新增 → FIXING → CLOSED(T0205 `5f10e7e`,bat-notify.mjs TLS port,**使用者兩次確認 YOLO end-to-end 跑通**)
> - T0206 研究完成(5 觸發點全盤點 + 現象 1/2 根因 100% 證據 + FileTree API 缺口)

## 🔴 Open / 處理中

| ID | 標題 | 嚴重度 | 建立時間 | 連結 |
|----|------|--------|---------|------|
| BUG-048 | CT Panel 瀏覽檔案首次點擊 Preview 空白 + 目錄樹未同步 | 🟡 Medium | 2026-04-19 10:42 | [BUG-048](BUG-048-ct-panel-browse-file-first-click-preview-empty-and-tree-not-synced.md) |

## ⏳ 修復中 (FIXING)

（目前無 FIXING bug）

## ✅ 已修復

（目前無 Fixed bug）

## 🧪 驗收中 (VERIFY)

| ID | 標題 | 嚴重度 | 修復時間 | 連結 |
|----|------|--------|---------|------|
| BUG-047 | Claude SDK 路徑未處理 app.asar.unpacked（V1 裝機即壞,Rico 回報） | 🟡 Medium | 2026-04-19 02:03 | [BUG-047](BUG-047-claude-sdk-path-asar-unpacked-resolve.md) |

## 🚫 已關閉 (CLOSED)

| ID | 標題 | 嚴重度 | 關閉時間 | 連結 |
|----|------|--------|---------|------|
| BUG-049 | bat-notify.mjs TLS 遷移漏修(T0205 `5f10e7e`,YOLO end-to-end 首次跑通) | 🟡 Medium | 2026-04-19 11:05 | [BUG-049](BUG-049-bat-notify-tls-migration-missed.md) |
| BUG-042 | TerminalPanel 呼叫不存在的 WorkspaceStore action(T0204 Option B 修復,純刪死碼) | 🟡 Medium | 2026-04-19 10:50 | [BUG-042](BUG-042-terminalpanel-missing-store-actions.md) |
| BUG-045 | `*sync` Parser / Backlog 面板顯示（T0195 + T0196 修復,使用者驗收通過） | 🟢 Low | 2026-04-19 10:36 | [BUG-045](BUG-045-sync-parser-tolerance-and-archive.md) |
| BUG-046 | BAT dispatcher silent fail（TLS protocol mismatch 雙重翻案後確認） | 🔴 High | 2026-04-19 03:12 | [BUG-046](BUG-046-bat-dispatch-interactive-flag-silent-fail.md) |
| BUG-044 | 塔台 CT Panel「包含封存」勾選無效（T0196 修復） | 🟢 Low | 2026-04-19 01:25 | [BUG-044](BUG-044-ct-panel-include-archived-toggle-noop.md) |
| BUG-043 | Worker YOLO mode 偶發失效（複測正常,疑 BUG-046 副作用誤判） | 🟡 Medium | 2026-04-19 01:25 | [BUG-043](BUG-043-worker-yolo-mode-sporadic-failure.md) |
| BUG-041 | YOLO mode Worker 端未偵測（Phase 2 Worker 無狀態化 v4.3.0 完結） | 🟡 Medium | 2026-04-18 21:30 | [BUG-041](BUG-041-yolo-mode-worker-side-not-detected.md) |
| BUG-040 | bat-terminal workspace 錯派（Phase 1 CT-T004 v4.2.2） | 🟡 Medium | 2026-04-18 21:00 | [BUG-040](BUG-040-bat-terminal-workspace-misroute.md) |
| BUG-039 | bat-terminal unknown-arg passthrough（塔台直接 CLOSED） | 🟡 Medium | 2026-04-18 14:45 | [BUG-039](BUG-039-bat-terminal-unknown-arg-passthrough.md) |
| BUG-038 | ELECTRON_RUN_AS_NODE=1 洩漏至 terminal 子 shell（BAT 內跑 Electron app 失敗） | 🟡 Medium | 2026-04-18 03:01 | [BUG-038](BUG-038-electron-run-as-node-env-leak.md) |
| BUG-037 | Git 圖譜 panel 內容全黑（T0156 regression） | 🟡 Medium | 2026-04-18 00:43 | [BUG-037](BUG-037-git-graph-panel-blank-content.md) |
| BUG-034 | Quit Dialog checkbox 勾選後 Terminal Server 未結束 | 🟡 Medium | 2026-04-17 17:12 | [BUG-034](BUG-034-checkbox-terminal-server-leak.md) |

## ⛔ 不修復 (WONTFIX)

（目前無 WONTFIX bug）
