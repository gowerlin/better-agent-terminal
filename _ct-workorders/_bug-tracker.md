# Bug Tracker — better-agent-terminal

> 最後更新：2026-04-13 14:02 (UTC+8)（T0087：BUG-001 → 🚫 CLOSED）
>
> 統計：🔴 Open: 0 | 🧪 Verify: 0 | ✅ Fixed: 18 | 🚫 Closed: 4 | 總計: 22

---

## 🔴 Open / 處理中

（目前無 Open bug）

---

## 🧪 驗收中 (VERIFY)

（目前無 VERIFY bug）

---

## ✅ 已修復

| ID | 標題 | 嚴重度 | 狀態 | 修復工單 | 連結 |
|----|------|--------|------|---------|------|
| BUG-003 | `voice:downloadModel` IPC handler 未註冊 | 🔴 High | ✅ FIXED (T0013) | T0013 | [詳細](_archive/bugs/BUG-003-voice-download-model-ipc-not-registered.md) |
| BUG-004 | AudioContext 崩潰（語音錄音啟動時 BAT 閃退） | 🔴 High | ✅ FIXED (T0017-β) | T0017-β | [詳細](_archive/bugs/BUG-004-audiocontext-crash-on-voice-start.md) |
| BUG-005 | whisper addon `require` 回傳 undefined（packaged） | 🔴 High | ✅ FIXED (T0018) | T0018 | [詳細](_archive/bugs/BUG-005-whisper-addon-require-undefined-packaged.md) |
| BUG-006 | AudioWorklet 在 packaged build 無法載入 | 🔴 High | ✅ FIXED (T0020) | T0020 | [詳細](_archive/bugs/BUG-006-audioworklet-cannot-load-packaged.md) |
| BUG-008 | 終端捲動造成 overlay UI 錯位 | 🟡 Medium | ✅ FIXED (T0028) / runtime 待驗 | T0028 | [詳細](_archive/bugs/BUG-008-terminal-scroll-overlay-misposition.md) |
| BUG-009 | 右鍵「貼上」後 focus 未還給 CLI | 🟡 Medium | ✅ FIXED (T0044) | T0044 | [詳細](_archive/bugs/BUG-009-context-menu-paste-focus-lost.md) |
| BUG-010 | Alt buffer 鍵盤事件被 xterm 攔截 | 🟡 Medium | ✅ FIXED (T0047) | T0047 | [詳細](_archive/bugs/BUG-010-alt-buffer-keyboard-events-intercepted.md) |
| BUG-011 | IME 輸入法 guard | 🟡 Medium | ✅ FIXED (T0033-C) | T0033-C | [詳細](_archive/bugs/BUG-011-ime-input-method-guard.md) |
| BUG-013 | Tab 切換離開終端 → 畫面全黑 | 🔴 High | ✅ FIXED (T0047) | T0047 | [詳細](_archive/bugs/BUG-013-tab-switch-black-screen.md) |
| BUG-014 | Ctrl+滾輪縮放終端字體失效 | 🟡 Medium | ✅ FIXED (T0047) | T0047 | [詳細](_archive/bugs/BUG-014-ctrl-scroll-font-zoom-broken.md) |
| BUG-015 | 終端字體從黑體變細明體（CJK fallback） | 🟡 Medium | ✅ FIXED (T0047) | T0047 | [詳細](_archive/bugs/BUG-015-terminal-font-cjk-fallback.md) |
| BUG-016 | ControlTowerPanel 無限循環 + 重複 key（T0072/T0073 regression） | 🔴 High | ✅ FIXED (T0074) | T0074 | [詳細](BUG-016-control-tower-panel-infinite-loop-and-duplicate-key.md) |
| BUG-017 | BMad Workflow/Epics 無法偵測非當前工作區的 _bmad-output | 🟡 Medium | ✅ FIXED (T0076) | T0076 | [詳細](BUG-017-bmad-output-not-detected-in-workspace.md) |
| BUG-018 | 切換工作區後其他頁籤未更新（停留在舊專案） | 🔴 High | ✅ FIXED (T0076) | T0076 | [詳細](BUG-018-workspace-switch-tabs-not-refreshed.md) |
| BUG-019 | Epics 頁籤顯示舊版 KanbanView 而非 BmadEpicsView | 🟡 Medium | ✅ FIXED (T0076) | T0076 | [詳細](BUG-019-epics-tab-shows-kanban-instead-of-bmad-view.md) |
| BUG-020 | Workflow 頁籤內容下方殘留「Sprint」標籤 | 🟡 Medium | ✅ FIXED (T0076) | T0076 | [詳細](BUG-020-stray-sprint-label-in-workflow-tab.md) |
| BUG-021 | VS Code 開啟失敗（ENOENT）無 UI 錯誤提示 | 🟡 Medium | ✅ FIXED (T0079) | T0079 | [詳細](BUG-021-vscode-enoent-no-error-handling.md) |
| BUG-022 | Settings 設定 VS Code Insiders 完整路徑後仍報「找不到執行檔」（引號問題） | 🔴 High | ✅ FIXED (T0082) | T0082 | [詳細](BUG-022-vscode-custom-path-not-used.md) |

---

## 🚫 已關閉 / WONTFIX

| ID | 標題 | 嚴重度 | 關閉原因 | 關閉時間 | 連結 |
|----|------|--------|---------|---------|------|
| BUG-002 | 右鍵功能表位置嚴重位移 | 🟡 Medium | 🚫 人工驗收通過 | 2026-04-13 | [詳細](BUG-002-context-menu-offset.md) |
| BUG-007 | 右鍵標記時顯示 OSC 52 調試訊息 | 🟢 Low | 🚫 上游行為（Claude Code CLI），無法修復 | 2026-04-12 | [詳細](_archive/bugs/BUG-007-osc52-debug-message-pollutes-terminal.md) |
| BUG-012 | Alt buffer 捲動殘影（ghost text） | 🟡 Medium | 🚫 人工驗收通過，v0.0.9-pre.1 確認 | 2026-04-13 | [詳細](BUG-012-alt-buffer-scroll-ghost-text.md) |
| BUG-001 | Claude OAuth 登入 paste 被截斷 | 🔴 High | 🚫 根因釐清為使用情境誤用，以 UX 改善取代（T0087） | 2026-04-13 | [詳細](BUG-001-claude-oauth-paste-truncated.md) |

---

## 📝 備註

- BUG-001：🚫 CLOSED（2026-04-13 根因釐清為使用情境誤用，T0087 UX 改善）
- BUG-002：🚫 CLOSED（2026-04-13 人工驗收通過）
- BUG-012：🚫 CLOSED（2026-04-13 人工驗收通過，v0.0.9-pre.1 確認修復）
- 下一個 BUG 編號：**BUG-023**
