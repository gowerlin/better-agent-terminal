# Bug Tracker — better-agent-terminal

> 最後更新：2026-04-12 (UTC+8)（T0064 歸檔更新）
>
> 統計：🔴 Open: 1 | ✅ Fixed: 13 | 🚫 Closed: 1 | 總計: 15

---

## 🔴 Open / 處理中

| ID | 標題 | 嚴重度 | 狀態 | 報修時間 | 連結 |
|----|------|--------|------|---------|------|
| BUG-012 | Alt buffer 捲動殘影（ghost text） | 🟡 Medium | 🔍 上游追蹤（#46898） | 2026-04-11 | [詳細](BUG-012-alt-buffer-scroll-ghost-text.md) |

---

## ✅ 已修復

| ID | 標題 | 嚴重度 | 狀態 | 修復工單 | 連結 |
|----|------|--------|------|---------|------|
| BUG-001 | Claude OAuth 登入 paste 被截斷 | 🔴 High | ✅ FIXED (T0006) / runtime 待驗 | T0006 | [詳細](BUG-001-claude-oauth-paste-truncated.md) |
| BUG-002 | 右鍵功能表位置嚴重位移 | 🟡 Medium | ✅ FIXED (T0008+T0012) / runtime 待驗 | T0012 | [詳細](BUG-002-context-menu-offset.md) |
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

---

## 🚫 已關閉 / WONTFIX

| ID | 標題 | 嚴重度 | 關閉原因 | 關閉時間 | 連結 |
|----|------|--------|---------|---------|------|
| BUG-007 | 右鍵標記時顯示 OSC 52 調試訊息 | 🟢 Low | 🚫 上游行為（Claude Code CLI），無法修復 | 2026-04-12 | [詳細](_archive/bugs/BUG-007-osc52-debug-message-pollutes-terminal.md) |

---

## 📝 備註

- BUG-001/002：runtime 驗證尚未完成，code fix 已確認
- BUG-008：runtime 驗證待使用者確認
- BUG-012：上游 issue anthropics/claude-code#46898，等 upstream 修復
- 下一個 BUG 編號：**BUG-016**
