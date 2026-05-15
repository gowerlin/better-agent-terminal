---
schema_version: 1
schema_kind: index
id: _bug-tracker
index_kind: bugs
generated_at: "2026-05-15T13:00:00+08:00"
generator: control-tower-sync
source_globs:
  - _ct-workorders/BUG-*.md
exclude_globs:
  - _ct-workorders/_archive/**
total: 23
breakdown:
  OPEN: 2
  FIXING: 0
  FIXED: 1
  VERIFY: 3
  CLOSED: 17
  WONTFIX: 0
---
# Bug Tracker

> ⚠️ 此文件由 `*sync` 自動生成，請勿手動編輯。
> 最後同步：2026-05-15 13:00 (UTC+8) — Session 43 BUG-080 → CLOSED（T0355 + T0356 雙 fix 完成；shell quoting hardening 收尾）

## 統計
- 🔴 Open: 2 | ⏳ Fixing: 0 | ✅ Fixed: 1 | 🧪 Verify: 3 | 🚫 Closed: 17 | ⛔ Won't Fix: 0 | **Total: 23**

> 已歸檔 BUG（`_archive/bugs/`）：57 張

## 🔴 Open / 處理中

| ID | 標題 | 嚴重度 | 建立時間 | 連結 |
|----|------|--------|---------|------|
| BUG-071 | Setup Wizard install-server-bundle 步驟硬性失敗：server bundle tarball 自動取得流程未實作 | 🔴 high | 2026-04-26 | [BUG-071](BUG-071-server-bundle-download-flow-missing.md) |
| BUG-061 | `src/components/CodexAgentPanel.tsx` baseline tsc errors（dev-only，pre-existing） | 🟢 low | 2026-04-26 | [BUG-061](BUG-061-codex-agent-panel-tsc-baseline-errors.md) |

## ⏳ 修復中 (FIXING)

| ID | 標題 | 嚴重度 | 建立時間 | 連結 |
|----|------|--------|---------|------|

（無）

## ✅ 已修復 (FIXED)

| ID | 標題 | 嚴重度 | 修復時間 | 連結 |
|----|------|--------|---------|------|
| BUG-078 | ct-drift-telemetry.ts 引用 node:fs/path/os 觸發 D090 guard，CI verify-renderer-imports fail 阻塞 v0.5.0-pre.1 release | 🔴 high | 2026-04-28 | [BUG-078](BUG-078-ct-drift-telemetry-renderer-node-imports-d090-violation.md) |

## 🧪 驗收中 (VERIFY)

| ID | 標題 | 嚴重度 | 驗證時間 | 連結 |
|----|------|--------|---------|------|
| BUG-072 | WSL setup wizard：systemd linger 啟用失敗時錯誤訊息不友善 + 連帶 bat-server.service timeout | 🟡 medium | 2026-04-27 | [BUG-072](BUG-072-wsl-systemd-linger-error-handling.md) |
| BUG-073 | Docker setup wizard：Docker daemon 未運作時錯誤訊息純技術，無 actionable 引導 | 🟡 medium | 2026-04-27 | [BUG-073](BUG-073-docker-wizard-daemon-not-running-error-handling.md) |
| BUG-074 | SSH setup wizard：configure-host input step 在使用者還沒輸入前就顯示為 failed 狀態 | 🟡 medium | 2026-04-27 | [BUG-074](BUG-074-ssh-wizard-input-step-shows-failed-on-init.md) |

## 🚫 已關閉 (CLOSED)

| ID | 標題 | 嚴重度 | 關閉時間 | 連結 |
|----|------|--------|---------|------|
| BUG-080 | resolveClaudeBaseCommand 雙引號包路徑無法防止 shell variable expansion（$、backtick） | 🟢 low | 2026-05-15 | [BUG-080](BUG-080-claude-cli-resolve-shell-quoting-hardening.md) |
| BUG-079 | BAT GitHub 功能找不到 gh CLI，但 gh 已安裝於 C:\Program Files\GitHub CLI\gh.exe (v2.92.0) | 🟡 medium | 2026-05-15 | [BUG-079](BUG-079-bat-github-feature-cannot-find-gh-cli.md) |
| BUG-077 | 指揮塔 UI 工單狀態 parser 將 DONE 工單顯示為 Pending | 🟡 medium | 2026-04-28 | [BUG-077](BUG-077-control-tower-ui-status-parser-misreports-done-as-pending.md) |
| BUG-076 | SetupWizardShell `resolveMappedErrorForSnapshot` 重 resolve 時遺失 errorCode，pure-errorCode registry entries 落 fallback | 🟡 medium | 2026-04-28 | [BUG-076](BUG-076-shell-mapped-error-resolver-loses-errorcode.md) |
| BUG-075 | BAT 內部終端 default shell preference 失效 + MSYS slash-command path rewrite 雙 regression（BUG-060 / L103 同族再現） | 🔴 high | 2026-04-27 | [BUG-075](BUG-075-bat-terminal-shell-pref-and-msys-path-rewrite-regression.md) |
| BUG-070 | Profile 配置 Dialog 的 Add 按鈕橫向溢出，建議改群組化下拉 | 🔴 high | 2026-04-26 | [BUG-070](BUG-070-profile-dialog-add-buttons-overflow.md) |
| BUG-069 | v0.4.1 NSIS install renderer crash：`require is not defined` in bundled renderer | 🔴 high | 2026-04-26 | [BUG-069](BUG-069-v041-nsis-renderer-require-not-defined.md) |
| BUG-068 | `RemoteClient.invoke` 中途 reconnect 換 translator，in-flight invoke 用 A 翻 args / 用 B 翻 result | 🟢 low | 2026-04-26 | [BUG-068](BUG-068-remoteclient-invoke-translator-swap-mid-flight.md) |
| BUG-067 | `RemoteClient.disconnect` 不 await `tunnel.stop()`，disconnect→reconnect 間 ssh 子行程 overlap | 🟡 medium | 2026-04-26 | [BUG-067](BUG-067-remoteclient-disconnect-no-await-tunnel-stop.md) |
| BUG-066 | `WizardRunner.run()` 失敗後 runPromise 不會重置，無法在同實例上重新啟動 | 🟢 low | 2026-04-26 | [BUG-066](BUG-066-wizardrunner-runpromise-not-restartable.md) |
| BUG-065 | `translateInvokeArgs` 預設只翻 args[0]，多 path arg channel（git:diff-files）跳過 args[1+] | 🟡 medium | 2026-04-26 | [BUG-065](BUG-065-translate-invoke-args-only-arg0.md) |
| BUG-064 | `classifyStderr` 只認英文 ssh stderr 訊息（i18n 脆弱） | 🟢 low | 2026-04-26 | [BUG-064](BUG-064-classifystderr-english-only.md) |
| BUG-063 | SshTunnel.stop / start error path 只發 SIGTERM，無 SIGKILL escalation | 🟡 medium | 2026-04-26 | [BUG-063](BUG-063-ssh-tunnel-no-sigkill-escalation.md) |
| BUG-062 | RemoteClient fingerprint mismatch 後未 early-return（race window token leak） | 🟡 medium | 2026-04-26 | [BUG-062](BUG-062-remoteclient-fingerprint-mismatch-no-early-return.md) |
| BUG-060 | YOLO 鏈式派發第二張工單起，BAT 終端 shell preference 未套用 Settings 配置 | 🟡 medium | 2026-04-26 | [BUG-060](BUG-060-yolo-dispatch-shell-preference-not-applied.md) |
| BUG-059 | Packaged BAT 內 embedded `claude.exe` 觸發 auto-update 失敗導致 binary missing | 🔴 high | 2026-04-25 | [BUG-059](BUG-059-embedded-claude-cli-autoupdate-fails-in-packaged-install.md) |
| BUG-055 | `node_modules/@anthropic-ai/claude-code/bin/` 殘留 `claude.exe.old.XXX`(SDK install hook) | 🟢 low | 2026-04-22 | [BUG-055](BUG-055-claude-exe-old-residue-in-node-modules-sdk-install-hook.md) |

## ⛔ 不修復 (WONTFIX)

| ID | 標題 | 嚴重度 | 標記時間 | 連結 |
|----|------|--------|---------|------|

（無）
