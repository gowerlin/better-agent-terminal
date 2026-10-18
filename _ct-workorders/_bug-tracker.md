---
schema_version: 1
schema_kind: index
id: _bug-tracker
index_kind: bugs
generated_at: "2026-10-18T09:47:39+0800"
generator: control-tower-sync
source_globs:
  - _ct-workorders/BUG-*.md
exclude_globs:
  - _ct-workorders/_archive/**
  - _ct-workorders/examples/**
total: 39
breakdown:
  OPEN: 1
  FIXING: 0
  FIXED: 19
  VERIFY: 0
  CLOSED: 19
  WONTFIX: 0
---

# Bug Tracker

> ⚠️ 此文件由 `*sync` 自動生成，請勿手動編輯。
> 最後同步：2026-10-18 11:22 (UTC+8) — BUG-154 CLOSED（pre.8 T0614 目視，D157）

## 統計
- 🔴 Open: 1 | ⏳ Fixing: 0 | ✅ Fixed: 19 | 🧪 Verify: 0 | 🚫 Closed: 19 | ⛔ Won't Fix: 0 | **Total: 39**

## 🔴 Open / 處理中

| ID | 標題 | 嚴重度 | 建立時間 | 連結 |
|----|------|--------|---------|------|
| BUG-136 | macOS 舊 Codex 分頁打字嚴重延遲、Renderer 約 100% CPU；新分頁正常，期間 GPU 崩潰 5 次（根因未定，待 Gary 區分測試） | 🟡 medium | 2026-10-15 13:13 | [BUG-136](BUG-136-macos-old-terminal-typing-lag-renderer-cpu.md) |

## ⏳ 修復中 (FIXING)

| ID | 標題 | 嚴重度 | 修復時間 | 連結 |
|----|------|--------|---------|------|

## ✅ 已修復

| ID | 標題 | 嚴重度 | 修復時間 | 連結 |
|----|------|--------|---------|------|
| BUG-147 | Recovery「重新開始」時舊 Terminal Server 刪掉新 server 的 pid / port 檔 | 🟢 low | 2026-10-17 20:17 | [BUG-147](BUG-147-recovery-fresh-start-pid-file-race.md) |
| BUG-146 | BAT 重開且 Terminal Server 存活時，Recovery 提示回答前還原分頁另起 direct shell | 🟡 medium | 2026-10-17 20:17 | [BUG-146](BUG-146-recovery-prompt-pending-spawns-direct-shell.md) |
| BUG-137 | 程序已結束的分頁按 ⏻ 重啟沒有任何反應（T0539 `2ff55bdd`：restart 失敗改以同 id 重建；T0534 衍生） | 🟢 low | 2026-10-15 17:30 | [BUG-137](BUG-137-restart-button-no-op-on-exited-terminal.md) |
| BUG-135 | focus fallback 跨工作區（adopt / 刪除 / 封存工作區、外部終端、reload；T0532 `8b5251a8`，含新工作區空狀態不閃） | 🟢 low | 2026-10-15 01:43 | [BUG-135](BUG-135-adopt-detached-focus-crosses-workspace.md) |
| BUG-134 | 空工作區透出隱藏工作區的終端畫面，無法操作（連國盛；T0531 `d41280ae`：隱藏工作區 active 分頁真正隱藏 + 空狀態 + focus 不跨工作區） | 🟡 medium | 2026-10-15 01:26 | [BUG-134](BUG-134-empty-workspace-shows-other-terminal.md) |
| BUG-133 | detached 視窗「開啟設定」無反應（T0530 `5bacb583`：改由父主視窗開 Settings） | 🟢 low | 2026-10-14 18:16 | [BUG-133](BUG-133-detached-window-open-settings-noop.md) |
| BUG-132 | agent CLI 沿用別的分頁的 `BAT_*` → 派工落點 / 完成通知送錯塔台（T0527 `a371ce5`：cwd 一致性檢查、yolo 拒派、`--agent` 簡寫；遠端與 PID 鏈根治未做） | 🟡 medium | 2026-10-14 17:17 | [BUG-132](BUG-132-agent-cli-stale-bat-env-misroutes-dispatch.md) |
| BUG-130 | 終端分頁貼圖（Windows 回歸未重現，已加固 + log；mac 送 Ctrl+V） | 🟡 medium | 2026-10-14 13:56 | [BUG-130](BUG-130-terminal-image-paste-regression.md) |
| BUG-131 | 本機 PTY 重建路徑掉 env（heartbeat 復原 / restart customEnv） | 🟡 medium | 2026-10-14 13:54 | [BUG-131](BUG-131-pty-rebuild-drops-env.md) |
| BUG-129 | 塔台派工落到錯的工作區 / `--agent default` 解析錯（Gary） | 🟡 medium | 2026-10-14 13:48 | [BUG-129](BUG-129-tower-dispatch-lands-in-wrong-workspace.md) |
| BUG-128 | mac：Finder 拷貝後終端 Command+V 貼不上 | 🟡 medium | 2026-10-14 13:29 | [BUG-128](BUG-128-mac-cmd-v-finder-copy-no-paste.md) |
| BUG-127 | 指揮塔面板切換工作區時 toast 洪水（「殘影」） | 🟢 low | 2026-10-14 13:27 | [BUG-127](BUG-127-ct-panel-toast-flood-on-workspace-switch.md) |
| BUG-118 | 非 Windows 打包版（mac 兩 arch、Linux AppImage）缺 `claude-code/bin/claude.exe`（electron-builder 非 Windows 排除 `.exe`）→ 內嵌 claude 不可用 | 🔴 high | 2026-10-13 | [BUG-118](BUG-118-non-windows-package-missing-embedded-claude.md) |
| BUG-116 | macOS 0.6.0-pre.2 啟動即崩潰：main 載入 whisper addon 找不到 `darwin-arm64/whisper.node` → uncaught exception | 🔴 high | 2026-10-13 | [BUG-116](BUG-116-mac-arm64-whisper-addon-load-failure-crashes-main.md) |
| BUG-111 | 設定精靈 rollback 會刪 / 停使用者自己的 Docker 容器與資料（T0444） | 🔴 high | 2026-10-05 | [BUG-111](BUG-111-wizard-rollback-touches-user-owned-resources.md) |
| BUG-108 | Claude 面板圖片附件走 proxied 讀檔：本機工作區外圖片被 path guard 擋、遠端讀錯檔案系統（T0436） | 🟡 medium | 2026-10-05 | [BUG-108](BUG-108-image-attachment-read-path-denied.md) |
| BUG-107 | Electron 41 拖放檔案取不到路徑（`File.path` 已移除）（T0435；須與 T0437 同版） | 🟡 medium | 2026-10-05 | [BUG-107](BUG-107-drag-drop-file-path-missing-electron41.md) |
| BUG-097 | Docker 遠端埠全介面暴露、container 內 bind 不可達、HEALTHCHECK 無路由（T0418 / T0427 / T0428） | 🔴 high | 2026-10-05 | [BUG-097](BUG-097-docker-server-port-exposed-and-unreachable.md) |
| BUG-105 | 遠端路徑轉換只涵蓋 fs / git(7) / pty / image：claude:*（cwd）、github:*、git-scaffold:*、worktree:create 不轉 | 🔴 high | 2026-10-05 | [BUG-105](BUG-105-proxied-channels-missing-path-translation.md) |

## 🧪 驗收中 (VERIFY)

| ID | 標題 | 嚴重度 | 驗證時間 | 連結 |
|----|------|--------|---------|------|
| _（無）_ | | | | |

## 🚫 已關閉 (CLOSED)

| ID | 標題 | 嚴重度 | 關閉時間 | 連結 |
|----|------|--------|---------|------|
| BUG-154 | 結構化提問（`bat-notify --ask`）答覆後，仍在執行的 Worker 縮圖顯示 `✓` 並計入批次關閉（T0613 `7bfe225c`；pre.8 T0614 目視） | 🟡 medium | 2026-10-18 | [BUG-154](BUG-154-thumbnail-checkmark-after-structured-answer.md) |
| BUG-153 | Worker 分頁縮圖在 `T#### 提問`（等塔台答覆）時也顯示 `✓` 並計入批次關閉；hook `blocked` 時沒有專屬標示（T0609 `fbf641dc`；pre.7 T0612 目視） | 🟡 medium | 2026-10-18 | [BUG-153](BUG-153-worker-thumbnail-checkmark-on-question-and-blocked.md) |
| BUG-149 | `settings.json` 沒有 `shell` 鍵時，helper `--agent` 派出的 claude / codex Worker 起不來（引號以 posix 組、Windows 分頁是 pwsh；T0593 `e283abdc`：以 PtyManager 實際預設 shell 判斷） | 🔴 high | 2026-10-18 | [BUG-149](BUG-149-codex-dispatch-posix-quoting-without-shell-setting.md) |
| BUG-152 | 塔台以 helper 派出的 Worker 分頁會搶走鍵盤焦點，使用者正在打的字跑進 Worker 分頁 | 🟡 medium | 2026-10-18 | [BUG-152](BUG-152-dispatched-worker-tab-steals-focus.md) |
| BUG-151 | helper 派工指令寫入前打進新分頁的輸入被接在指令前面，Worker 起不來但 helper 仍 exit 0 | 🔴 high | 2026-10-18 | [BUG-151](BUG-151-dispatch-quoting-pwsh-in-git-bash-tab.md) |
| BUG-150 | claude-cli 分頁的 AskUserQuestion 一律回報 `blocked` / `permission`（應為 `question`），T0594 的回答後清除永遠不生效 | 🟡 medium | 2026-10-18 | [BUG-150](BUG-150-askuserquestion-blocked-reason-permission.md) |
| BUG-148 | Codex CLI 分頁的 BAT MCP 一律 `CONNECT_FAILED`（T0586 `8c7bd4c4`：codex 注入改帶 `mcp_servers.bat.env_vars` 轉送 `BAT_*` 名稱；pre.3 實機 `bat_whoami` PASS） | 🟡 medium | 2026-10-18 | [BUG-148](BUG-148-codex-mcp-shim-missing-bat-env.md) |
| BUG-144 | claude CLI 分頁選取文字後 Shift + 右鍵，選單只有「貼上」沒有「複製」（T0573 `6e4f3764`：claude 聚焦時重送追蹤 DECSET 清選取 → 放回 / 接回拖曳；同範圍重選經放開同步；pre.9 實機三項 PASS） | 🟢 low | 2026-10-17 | [BUG-144](BUG-144-shift-right-click-menu-missing-copy-in-claude-tab.md) |
| BUG-145 | 新分頁 / 還原 / ⏻ 重啟的 PTY 停在 120x30（T0572 `ecc00c60`：PTY 建立後重送 fit 尺寸；pre.8 實機 PASS） | 🟢 low | 2026-10-17 | [BUG-145](BUG-145-new-pty-stays-at-spawn-size.md) |
| BUG-143 | 終端右鍵選單按 Esc 關不掉（T0569 `fb66c0bc`：選單開著時 Esc 只關選單、不送進 PTY；pre.7 實機 PASS） | 🟢 low | 2026-10-16 | [BUG-143](BUG-143-terminal-context-menu-esc-not-closing.md) |
| BUG-142 | claude CLI 分頁右鍵已貼上又跳 BAT 選單（T0568 `9988a117`：程式開滑鼠追蹤時不開選單，Shift + 右鍵照開；pre.7 實機 PASS，Shift 選單缺「複製」另開 BUG-144） | 🟢 low | 2026-10-16 | [BUG-142](BUG-142-right-click-pastes-and-shows-menu-in-claude-tab.md) |
| BUG-141 | 精靈升級後段失敗取消，rollback 刪掉整個安裝（T0554 `38fe7421`：保留 `.bat-old` 至完成、取消換回舊樹 / 舊 unit 並重啟舊 service；WSL + SSH） | 🟡 medium | 2026-10-16 | [BUG-141](BUG-141-wizard-rollback-removes-upgraded-install.md) |
| BUG-139 | WSL 精靈覆蓋安裝不清舊檔，舊 bundle 殘留約 256 MiB（T0552 `f599f915`：解到暫存目錄後換名，WSL / SSH 共用） | 🟢 low | 2026-10-16 | [BUG-139](BUG-139-wsl-bundle-overlay-install-leaves-stale-files.md) |
| BUG-138 | WSL 精靈升級執行中的 bat-server 會換 port，既有 profile 失效（T0552 `f599f915`：沿用既有 unit port、更新既有 profile） | 🟡 medium | 2026-10-16 | [BUG-138](BUG-138-wsl-wizard-upgrade-changes-port.md) |
| BUG-140 | `--close-worker` 延遲期間切換工作區 / 終端焦點被算成使用者輸入，回收被取消（T0551 `92655e00`，pre.5 實機驗收 T0558：終端自動回應（focus / CPR / DA…）不算使用者輸入） | 🟡 medium | 2026-10-16 | [BUG-140](BUG-140-close-worker-cancelled-by-focus-not-typing.md) |
| BUG-099 | 設定精靈取消時不 rollback 失敗中的步驟（T0426） | 🟢 low | 2026-10-14 | [BUG-099](BUG-099-wizard-cancel-skips-failed-step-rollback.md) |
| BUG-117 | mac x64 dmg 內嵌 arm64 原生 binary（已證實：claude / codex / node-pty / whisper 等）→ Intel Mac 內嵌 claude、codex、語音不可用、PTY 降級 | 🔴 high | 2026-10-14 | [BUG-117](BUG-117-mac-x64-dmg-ships-arm64-native-binaries.md) |
| BUG-061 | `CodexAgentPanel.tsx` baseline tsc errors（dev-only；T0486 清零 36 → 0） | 🟢 low | 2026-10-14 | [BUG-061](BUG-061-codex-agent-panel-tsc-baseline-errors.md) |
| BUG-082 | 跨專案工單前綴（CP-/CT-）被結構化派工路徑拒收，且四處 ID 規則彼此不一致 | 🔴 high | 2026-09-02 | [BUG-082](BUG-082-workorder-id-prefix-rejected-by-structured-dispatch.md) |

> 💡 BUG-079/080 已於 2026-05-19 歸檔；BUG-081 於 2026-09-02 歸檔；2026-10-17 第七十一 session 歸檔 40 張（BUG-071–126 中已 CLOSED、未被引用者）→ [_archive/bugs/](_archive/bugs/)
>
> ⚠️ BUG-072/073/074 以 **field evidence** 就地結案（上線 101 天零回饋），**非人工 smoke**；
> BUG-078 則有 CI 正面證據。結案依據差異見各 BUG 文末結案紀錄。

## ⛔ 不修復 (WONTFIX)

| ID | 標題 | 嚴重度 | 標記時間 | 連結 |
|----|------|--------|---------|------|
| _（無）_ | | | | |
