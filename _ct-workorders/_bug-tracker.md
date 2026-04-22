# Bug Tracker

> ⚠️ 此文件由 `*sync` 自動生成,請勿手動編輯。

> 最後同步:2026-04-23 05:35 (UTC+8) — BUG-057 OPEN → CLOSED(T0245 單行 fix `translate: false`,使用者雙情境驗收通過,合計 50 min 閉環)

## 統計
- 🔴 Open: 0(熱區) | ⏳ Fixing: 0 | ✅ Fixed: 0 | 🧪 Verify: 0 | 🚫 Closed: 5(熱區) | ⛔ Won't Fix: 1(熱區) | **熱區 Total: 6**
- 📦 已歸檔:51 張(見 `_archive/bugs/`)
- 📊 整體 Total:57 張

## 🔴 Open / 處理中

| ID | 標題 | 嚴重度 | 建立時間 | 連結 |
|----|------|--------|---------|------|

## ⏳ 修復中 (FIXING)

| ID | 標題 | 嚴重度 | 建立時間 | 連結 |
|----|------|--------|---------|------|

## ✅ 已修復

| ID | 標題 | 嚴重度 | 修復時間 | 連結 |
|----|------|--------|---------|------|

## 🧪 驗收中 (VERIFY)

| ID | 標題 | 嚴重度 | 驗證時間 | 連結 |
|----|------|--------|---------|------|

## 🚫 已關閉 (CLOSED)

| ID | 標題 | 嚴重度 | 關閉時間 | 連結 |
|----|------|--------|---------|------|
| BUG-054 | PLAN-027 runtime 切換未覆蓋 BAT 終端 claude-cli preset 與 auth handlers | 🟡 Medium | 2026-04-22 19:50 | [BUG-054](BUG-054-runtime-switch-not-applied-to-terminal-and-auth.md) |
| BUG-053 | `probeClaudeHealth` 無法 spawn `.cmd` / `.bat` shim (Node 20+ CVE-2024-27980) | 🟢 Low | 2026-04-22 19:50 | [BUG-053](BUG-053-claude-resolver-probe-fails-on-cmd-bat-shims-node-20plus.md) |
| BUG-050 | Worker-side YOLO pipeline 退化:banner missing + clipboard fallback | 🟡 Medium | 2026-04-23 00:15 | [BUG-050](BUG-050-worker-yolo-pipeline-regression-banner-missing-clipboard-fallback.md) |
| BUG-056 | NSIS 打包版啟動即崩潰：`Cannot find module '@kutalia/whisper-node-addon'` (regression from `cb65614`,T0242 zero-diff fix via `npm install`) | 🔴 High | 2026-04-23 04:34 | [BUG-056](BUG-056-kutalia-whisper-node-addon-missing-in-packaged-nsis-install.md) |
| BUG-057 | 語音辨識改版後繁中被翻譯為英文 (regression from `cb65614`,@kutalia default `translate: true`,T0245 單行 fix `translate: false`) | 🔴 High | 2026-04-23 05:35 | [BUG-057](BUG-057-voice-transcription-translates-to-english-after-vulkan-regression.md) |

## ⛔ 不修復 (WONTFIX)

| ID | 標題 | 嚴重度 | 標記時間 | 連結 |
|----|------|--------|---------|------|
| BUG-055 | `node_modules/@anthropic-ai/claude-code/bin/` 殘留 `claude.exe.old.XXX` (SDK install hook) | 🟢 Low | 2026-04-23 00:25 | [BUG-055](BUG-055-claude-exe-old-residue-in-node-modules-sdk-install-hook.md) |
