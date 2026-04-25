# Bug Tracker

> ⚠️ 此文件由 `*sync` 自動生成,請勿手動編輯。

> 最後同步:2026-04-25 14:43 (UTC+8) — Session 25 收工後 *sync 重建。BUG-058/059 新增並全數 CLOSED;BUG-055 重開後一同 CLOSED(D088);熱區 8 張全數閉環,可考慮批次歸檔。

## 統計
- 🔴 Open: 0(熱區) | ⏳ Fixing: 0 | ✅ Fixed: 0 | 🧪 Verify: 0 | 🚫 Closed: 8(熱區) | ⛔ Won't Fix: 0(熱區) | **熱區 Total: 8**
- 📦 已歸檔:51 張(見 `_archive/bugs/`)
- 📊 整體 Total:59 張

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
| BUG-053 | `probeClaudeHealth` 無法 spawn `.cmd` / `.bat` shim (Node 20+ CVE-2024-27980) | 🟢 Low | 2026-04-22 19:50 | [BUG-053](BUG-053-claude-resolver-probe-fails-on-cmd-bat-shims-node-20plus.md) |
| BUG-054 | PLAN-027 runtime 切換未覆蓋 BAT 終端 claude-cli preset 與 auth handlers | 🟡 Medium | 2026-04-22 19:50 | [BUG-054](BUG-054-runtime-switch-not-applied-to-terminal-and-auth.md) |
| BUG-050 | Worker-side YOLO pipeline 退化:banner missing + clipboard fallback | 🟡 Medium | 2026-04-23 00:15 | [BUG-050](BUG-050-worker-yolo-pipeline-regression-banner-missing-clipboard-fallback.md) |
| BUG-056 | NSIS 打包版啟動即崩潰:`Cannot find module '@kutalia/whisper-node-addon'` (regression from `cb65614`,T0242 zero-diff fix via `npm install`) | 🔴 High | 2026-04-23 04:34 | [BUG-056](BUG-056-kutalia-whisper-node-addon-missing-in-packaged-nsis-install.md) |
| BUG-057 | 語音辨識改版後繁中被翻譯為英文 (regression from `cb65614`,@kutalia default `translate: true`,T0245 單行 fix `translate: false`) | 🔴 High | 2026-04-23 05:35 | [BUG-057](BUG-057-voice-transcription-translates-to-english-after-vulkan-regression.md) |
| BUG-058 | 封裝佈署後 `$BAT_HELPER_DIR` 缺少 `_bat-*.mjs` helper scripts (T0247 修復 `extraResources.filter` glob,T0248 加靜態檢查防 drift) | 🔴 High | 2026-04-24 (v0.3.1) | [BUG-058](BUG-058-bat-helper-scripts-missing-in-packaged-install.md) |
| BUG-059 | Packaged BAT 內 embedded `claude.exe` 觸發 auto-update 失敗導致 binary missing (T0251 `DISABLE_AUTOUPDATER=1` env 注入 4 處) | 🔴 High | 2026-04-25 | [BUG-059](BUG-059-embedded-claude-cli-autoupdate-fails-in-packaged-install.md) |
| BUG-055 | `node_modules/@anthropic-ai/claude-code/bin/` 殘留 `claude.exe.old.XXX`(install hook,原 WONTFIX,T0250 反組譯找出真根因 → REOPEN → 與 BUG-059 同根因一同 CLOSED) | 🟢 Low | 2026-04-25 | [BUG-055](BUG-055-claude-exe-old-residue-in-node-modules-sdk-install-hook.md) |

## ⛔ 不修復 (WONTFIX)

| ID | 標題 | 嚴重度 | 標記時間 | 連結 |
|----|------|--------|---------|------|

> 💡 熱區 8 張 BUG 全數 🚫 CLOSED,可使用 `*archive` 批次歸檔(注意 BUG-055/059 為今日閉環,7 天後才符合預設 `archive_days` 門檻)。
