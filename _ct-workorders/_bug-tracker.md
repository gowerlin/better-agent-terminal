---
schema_version: 1
schema_kind: index
id: _bug-tracker
index_kind: bugs
generated_at: "2026-10-26T03:20:15+0800"
generator: control-tower-sync
source_globs:
  - _ct-workorders/BUG-*.md
exclude_globs:
  - _ct-workorders/_archive/**
  - _ct-workorders/examples/**
total: 35
breakdown:
  OPEN: 0
  FIXING: 0
  FIXED: 28
  VERIFY: 0
  CLOSED: 7
  WONTFIX: 0
---

# Bug Tracker

> ⚠️ 此文件由 `*sync` 自動生成，請勿手動編輯。
> 最後同步：2026-10-26 03:20 (UTC+8) — 第九十五 session `*archive`：歸檔 21 張已 CLOSED、未被引用的 BUG（BUG-082、138–141、143–145、148–155、157、160–163）；熱區 Fixed 28 / Closed 7

## 統計
- 🔴 Open: 0 | ⏳ Fixing: 0 | ✅ Fixed: 28 | 🧪 Verify: 0 | 🚫 Closed: 7 | ⛔ Won't Fix: 0 | **Total: 35**

## 🔴 Open / 處理中

| ID | 標題 | 嚴重度 | 建立時間 | 連結 |
|----|------|--------|---------|------|

## ⏳ 修復中 (FIXING)

| ID | 標題 | 嚴重度 | 修復時間 | 連結 |
|----|------|--------|---------|------|

## ✅ 已修復

| ID | 標題 | 嚴重度 | 修復時間 | 連結 |
|----|------|--------|---------|------|
| BUG-171 | 「終端重置」後多個分頁 `[Process exited with code 1]`：NTP 時鐘跳變讓 heartbeat 誤判、recovery 沒關舊 server；T0704 `68ab2a42` + T0705 `d7ffa080`，待下一個預覽版實機驗收 | 🔴 high | 2026-10-25 | [BUG-171](BUG-171-idle-terminals-exit-1-after-terminal-reset.md) |
| BUG-165 | macOS：Codex CLI 分頁內捲動不夠順；T0698 `ec4b3c13` 依累積行數送多個滾輪回報（上限 8），隨 pre.6 發佈，待外部測試者A 實機驗收 | 🟢 low | 2026-10-22 | [BUG-165](BUG-165-macos-codex-cli-scroll-not-smooth.md) |
| BUG-170 | yolo 提問備援重派後舊 Worker 分頁讓回收 AMBIGUOUS；CT v5.12.0 / v5.12.1 重派前先 `--close-worker`（CT-T022），T0695 / T0696 實機驗收通過 | 🟢 low | 2026-10-22 | [BUG-170](BUG-170-yolo-fallback-redispatch-leaves-old-worker-tab.md) |
| BUG-169 | 安裝版的 helper 回報版號 v0.0.0；T0691 以 electron-builder `afterPack` 寫只含 name / version 的 `resources/package.json`，打包後 `helper-version` 檢查（`b0ff5673`），等下一個預覽版安裝版驗收 | 🟢 low | 2026-10-21 | [BUG-169](BUG-169-installed-helpers-report-version-0.0.0.md) |
| BUG-168 | `tests/` 底下沒被跑到的測試失敗與逾時（全部測試過時）；T0680–T0685 修正並收進 vitest／`test:legacy`，ubuntu 試跑 5760 / 0 + 472 / 0；擋版 T0686 | 🟢 low | 2026-10-21 | [BUG-168](BUG-168-tests-dir-tsx-suites-failing-and-timing-out.md) |
| BUG-167 | `tests/profile-manager-migration.test.ts` 2 項斷言過時（T0277 / T0282 加的 `dockerMounts`、`serverHome` 沒跟上；T0678 `d90b3b50`，13 / 0） | 🟢 low | 2026-10-21 | [BUG-167](BUG-167-profile-manager-migration-test-stale-assertions.md) |
| BUG-166 | Agent 被訊號結束後的分頁，滑鼠回報被當成文字輸入 shell（T0671 研究；T0672 `64209d44` 自動 / 手動重設滑鼠追蹤；待 外部測試者A 確認、未發版） | 🟡 medium | 2026-10-19 | [BUG-166](BUG-166-mouse-reports-leak-as-text-after-agent-exit.md) |
| BUG-159 | codex 分頁在 BAT MCP 未注入、非系統管理員時接上 codex 共用 daemon，helper 讀到其他分頁的 `BAT_*`（T0651 `5b1be0f5`） | 🟢 low | 2026-10-18 | [BUG-159](BUG-159-codex-shared-daemon-inherits-other-tab-env.md) |
| BUG-156 | Docker 設定精靈容器埠固定 `127.0.0.1:9876`，與 BAT RemoteServer 預設埠衝突（T0649 `99abe9a1`） | 🟡 medium | 2026-10-18 | [BUG-156](BUG-156-docker-wizard-port-9876-conflicts-bat-server.md) |
| BUG-147 | Recovery「重新開始」時舊 Terminal Server 刪掉新 server 的 pid / port 檔 | 🟢 low | 2026-10-17 20:17 | [BUG-147](BUG-147-recovery-fresh-start-pid-file-race.md) |
| BUG-146 | BAT 重開且 Terminal Server 存活時，Recovery 提示回答前還原分頁另起 direct shell | 🟡 medium | 2026-10-17 20:17 | [BUG-146](BUG-146-recovery-prompt-pending-spawns-direct-shell.md) |
| BUG-137 | 程序已結束的分頁按 ⏻ 重啟沒有任何反應（T0539 `2ff55bdd`：restart 失敗改以同 id 重建；T0534 衍生） | 🟢 low | 2026-10-15 17:30 | [BUG-137](BUG-137-restart-button-no-op-on-exited-terminal.md) |
| BUG-135 | focus fallback 跨工作區（adopt / 刪除 / 封存工作區、外部終端、reload；T0532 `8b5251a8`，含新工作區空狀態不閃） | 🟢 low | 2026-10-15 01:43 | [BUG-135](BUG-135-adopt-detached-focus-crosses-workspace.md) |
| BUG-134 | 空工作區透出隱藏工作區的終端畫面，無法操作（連國盛；T0531 `d41280ae`：隱藏工作區 active 分頁真正隱藏 + 空狀態 + focus 不跨工作區） | 🟡 medium | 2026-10-15 01:26 | [BUG-134](BUG-134-empty-workspace-shows-other-terminal.md) |
| BUG-133 | detached 視窗「開啟設定」無反應（T0530 `5bacb583`：改由父主視窗開 Settings） | 🟢 low | 2026-10-14 18:16 | [BUG-133](BUG-133-detached-window-open-settings-noop.md) |
| BUG-132 | agent CLI 沿用別的分頁的 `BAT_*` → 派工落點 / 完成通知送錯塔台（T0527 `a371ce5`：cwd 一致性檢查、yolo 拒派、`--agent` 簡寫；遠端與 PID 鏈根治未做） | 🟡 medium | 2026-10-14 17:17 | [BUG-132](BUG-132-agent-cli-stale-bat-env-misroutes-dispatch.md) |
| BUG-130 | 終端分頁貼圖（Windows 回歸未重現，已加固 + log；mac 送 Ctrl+V） | 🟡 medium | 2026-10-14 13:56 | [BUG-130](BUG-130-terminal-image-paste-regression.md) |
| BUG-131 | 本機 PTY 重建路徑掉 env（heartbeat 復原 / restart customEnv） | 🟡 medium | 2026-10-14 13:54 | [BUG-131](BUG-131-pty-rebuild-drops-env.md) |
| BUG-129 | 塔台派工落到錯的工作區 / `--agent default` 解析錯（外部測試者A） | 🟡 medium | 2026-10-14 13:48 | [BUG-129](BUG-129-tower-dispatch-lands-in-wrong-workspace.md) |
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
| BUG-164 | macOS GPU 程序在建立 / 切換終端分頁時以同一個 CHECK 崩潰（T0668 符號化；T0669 `32d62a45` macOS 停用 Graphite + 崩潰後重建；外部測試者A 以 v0.7.1-pre.3 確認約 4h40m 0 次崩潰） | 🟢 low | 2026-10-19 | [BUG-164](BUG-164-macos-gpu-process-check-crash-on-tab-create-switch.md) |
| BUG-136 | macOS 舊 Codex 分頁打字嚴重延遲、Renderer 約 100% CPU：縮圖預覽字串無上限累積（T0666 根因、T0667 `a9f0ad5a` 加上限；外部測試者A 以 v0.7.1-pre.3 確認） | 🟡 medium | 2026-10-19 | [BUG-136](BUG-136-macos-old-terminal-typing-lag-renderer-cpu.md) |
| BUG-158 | 遠端設定畫面殘留英文字樣、缺 zh-TW key；SSH 認證失敗訊息提到「帳號密碼」（T0652 `15a792d4`；0.7.1-pre.2 T0663 實機） | 🟢 low | 2026-10-18 | [BUG-158](BUG-158-remote-ui-english-strings-and-password-wording.md) |
| BUG-142 | claude CLI 分頁右鍵已貼上又跳 BAT 選單（T0568 `9988a117`：程式開滑鼠追蹤時不開選單，Shift + 右鍵照開；pre.7 實機 PASS，Shift 選單缺「複製」另開 BUG-144） | 🟢 low | 2026-10-16 | [BUG-142](BUG-142-right-click-pastes-and-shows-menu-in-claude-tab.md) |
| BUG-099 | 設定精靈取消時不 rollback 失敗中的步驟（T0426） | 🟢 low | 2026-10-14 | [BUG-099](BUG-099-wizard-cancel-skips-failed-step-rollback.md) |
| BUG-117 | mac x64 dmg 內嵌 arm64 原生 binary（已證實：claude / codex / node-pty / whisper 等）→ Intel Mac 內嵌 claude、codex、語音不可用、PTY 降級 | 🔴 high | 2026-10-14 | [BUG-117](BUG-117-mac-x64-dmg-ships-arm64-native-binaries.md) |
| BUG-061 | `CodexAgentPanel.tsx` baseline tsc errors（dev-only；T0486 清零 36 → 0） | 🟢 low | 2026-10-14 | [BUG-061](BUG-061-codex-agent-panel-tsc-baseline-errors.md) |

> 💡 BUG-079/080 已於 2026-05-19 歸檔；BUG-081 於 2026-09-02 歸檔；2026-10-17 第七十一 session 歸檔 40 張（BUG-071–126 中已 CLOSED、未被引用者）；2026-10-26 第九十五 session 歸檔 21 張（BUG-082、138–163 中已 CLOSED、未被引用者）→ [_archive/bugs/](_archive/bugs/)
>
> ⚠️ BUG-072/073/074 以 **field evidence** 就地結案（上線 101 天零回饋），**非人工 smoke**；
> BUG-078 則有 CI 正面證據。結案依據差異見各 BUG 文末結案紀錄。

## ⛔ 不修復 (WONTFIX)

| ID | 標題 | 嚴重度 | 標記時間 | 連結 |
|----|------|--------|---------|------|
| _（無）_ | | | | |
