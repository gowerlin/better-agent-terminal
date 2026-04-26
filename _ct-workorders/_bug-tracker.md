# Bug Tracker

> ⚠️ 此文件由 `*sync` 自動生成，請勿手動編輯。
> 最後同步：2026-04-26 22:?? (UTC+8) — Session 34 起手新增 BUG-070（Profile Dialog Add 按鈕溢出）。

## 統計
- 🔴 Open: 1 | ⏳ Fixing: 0 | ✅ Fixed: 0 | 🧪 Verify: 0 | 🚫 Closed: 12 | ⛔ Won't Fix: 0 | **Total: 13**

> 已歸檔 BUG（`_archive/bugs/`）：57 張

## 🔴 Open / 處理中

| ID | 標題 | 嚴重度 | 建立時間 | 連結 |
|----|------|--------|---------|------|
| BUG-061 | CodexAgentPanel.tsx baseline tsc errors（dev-only，非阻塞） | 🟢 Low | 2026-04-26 14:10 | [BUG-061](BUG-061-codex-agent-panel-tsc-baseline-errors.md) |

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
| BUG-070 | Profile Dialog Add 按鈕橫向溢出（T0306 commit `014da72`，使用者實機驗收通過） | 🔴 High | 2026-04-27 | [BUG-070](BUG-070-profile-dialog-add-buttons-overflow.md) |
| BUG-069 | v0.4.1 NSIS renderer `require is not defined`（T0303+T0304 commit `e8bb389`，使用者實機驗收通過） | 🔴 High | 2026-04-27 | [BUG-069](BUG-069-v041-nsis-renderer-require-not-defined.md) |
| BUG-068 | RemoteClient.invoke 中途換 translator（freeze per-invoke） | 🟢 Low | 2026-04-26 | [BUG-068](BUG-068-remoteclient-invoke-translator-swap-mid-flight.md) |
| BUG-067 | RemoteClient.disconnect 不 await tunnel.stop() | 🟡 Medium | 2026-04-26 | [BUG-067](BUG-067-remoteclient-disconnect-no-await-tunnel-stop.md) |
| BUG-066 | WizardRunner.run() 失敗後 runPromise 不 reset | 🟢 Low | 2026-04-26 | [BUG-066](BUG-066-wizardrunner-runpromise-not-restartable.md) |
| BUG-065 | translateInvokeArgs 只翻 args[0]（schema-driven 修復） | 🟡 Medium | 2026-04-26 | [BUG-065](BUG-065-translate-invoke-args-only-arg0.md) |
| BUG-064 | classifyStderr 只認英文 ssh stderr（i18n 脆弱） | 🟢 Low | 2026-04-26 | [BUG-064](BUG-064-classifystderr-english-only.md) |
| BUG-063 | SshTunnel 只發 SIGTERM 無 SIGKILL escalation | 🟡 Medium | 2026-04-26 | [BUG-063](BUG-063-ssh-tunnel-no-sigkill-escalation.md) |
| BUG-062 | RemoteClient fingerprint mismatch 未 early-return | 🟡 Medium | 2026-04-26 | [BUG-062](BUG-062-remoteclient-fingerprint-mismatch-no-early-return.md) |
| BUG-060 | YOLO 鏈式派發第二張起 BAT 終端 shell preference 未套用 | 🟡 Medium | 2026-04-26 14:30 | [BUG-060](BUG-060-yolo-dispatch-shell-preference-not-applied.md) |
| BUG-059 | embedded claude-cli auto-update 在 packaged install 失敗 | 🔴 High | 2026-04-25 | [BUG-059](BUG-059-embedded-claude-cli-autoupdate-fails-in-packaged-install.md) |
| BUG-055 | claude.exe `.old.*` 殘留 in node_modules（SDK install hook） | 🟡 Medium | 2026-04-25 | [BUG-055](BUG-055-claude-exe-old-residue-in-node-modules-sdk-install-hook.md) |

## ⛔ 不修復 (WONTFIX)

| ID | 標題 | 嚴重度 | 標記時間 | 連結 |
|----|------|--------|---------|------|
