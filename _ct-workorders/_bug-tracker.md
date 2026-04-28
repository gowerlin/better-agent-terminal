# Bug Tracker

> ⚠️ 此文件由 `*sync` 自動生成，請勿手動編輯。
> 最後同步：2026-04-28 23:21 (UTC+8) — Session 42 BUG-078 新增 FIXING（T0348 派出，CI run 25060731646 D090 guard 攔到 T0346 漏網）。

## 統計
- 🔴 Open: 2 | ⏳ Fixing: 1 | ✅ Fixed: 0 | 🧪 Verify: 3 | 🚫 Closed: 15 | ⛔ Won't Fix: 0 | **Total: 21**

> 已歸檔 BUG（`_archive/bugs/`）：57 張

## 🔴 Open / 處理中

| ID | 標題 | 嚴重度 | 建立時間 | 連結 |
|----|------|--------|---------|------|
| BUG-071 | Setup Wizard install-server-bundle 硬性失敗（PLAN-031 T0321/T0322 已實作完成；等 T0324 DGX Spark dogfood VERIFY，工單 metadata 仍 OPEN） | 🔴 High | 2026-04-27 | [BUG-071](BUG-071-server-bundle-download-flow-missing.md) |
| BUG-061 | CodexAgentPanel.tsx baseline tsc errors（dev-only，非阻塞） | 🟢 Low | 2026-04-26 14:10 | [BUG-061](BUG-061-codex-agent-panel-tsc-baseline-errors.md) |

## ⏳ 修復中 (FIXING)

| ID | 標題 | 嚴重度 | 建立時間 | 連結 |
|----|------|--------|---------|------|
| BUG-078 | ct-drift-telemetry.ts 引用 node:fs/path/os 觸發 D090 guard，pre-release CI 三平台 build fail 阻塞 v0.5.0-pre.1（T0348 已派出，方案 A 搬到 electron/ + IPC） | 🔴 High | 2026-04-28 23:21 | [BUG-078](BUG-078-ct-drift-telemetry-renderer-node-imports-d090-violation.md) |

## ✅ 已修復

| ID | 標題 | 嚴重度 | 修復時間 | 連結 |
|----|------|--------|---------|------|

## 🧪 驗收中 (VERIFY)

| ID | 標題 | 嚴重度 | 驗證時間 | 連結 |
|----|------|--------|---------|------|
| BUG-072 | WSL wizard systemd linger 啟用失敗錯誤訊息不友善 + 連帶 service timeout（T0337 FIXED `57896e7` @2026-04-28 03:32 — 待 WSL 環境 smoke） | 🟡 Medium | 2026-04-27 | [BUG-072](BUG-072-wsl-systemd-linger-error-handling.md) |
| BUG-073 | Docker wizard：daemon 未運作時錯誤純技術，無 actionable 引導（T0336 FIXED `a8b2363` @2026-04-28 03:21 — 待人工 smoke） | 🟡 Medium | 2026-04-27 | [BUG-073](BUG-073-docker-wizard-daemon-not-running-error-handling.md) |
| BUG-074 | SSH wizard：configure-host input step 在使用者還沒輸入前就顯示 failed 狀態（T0335 FIXED `94733d7` @2026-04-28 03:10 — 待三平台 smoke） | 🟡 Medium | 2026-04-27 | [BUG-074](BUG-074-ssh-wizard-input-step-shows-failed-on-init.md) |

## 🚫 已關閉 (CLOSED)

| ID | 標題 | 嚴重度 | 關閉時間 | 連結 |
|----|------|--------|---------|------|
| BUG-077 | 指揮塔 UI 工單狀態 parser：T0313/T0314 metadata DONE 但 UI 顯示 Pending（PLAN-034 Sprint 5 收斂，T0346 commit `1780976`） | 🟡 Medium | 2026-04-28 20:11 | [BUG-077](BUG-077-control-tower-ui-status-parser-misreports-done-as-pending.md) |
| BUG-076 | Shell mapped error resolver 遺失 errorCode（T0339 FIXED `f711baf` @2026-04-28 06:16；T0338 integration test case #4 unskipped 自動驗證；304/304 全綠 0 regression） | 🟡 Medium | 2026-04-28 | [BUG-076](BUG-076-shell-mapped-error-resolver-loses-errorcode.md) |
| BUG-075 | BAT 內部終端 shell pref + MSYS path rewrite 雙 regression（T0341 MSYS env + T0343 prefix dual fix + T0342/T0344/T0345 三層 regression test） | 🔴 High | 2026-04-27 | [BUG-075](BUG-075-bat-terminal-shell-pref-and-msys-path-rewrite-regression.md) |
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
