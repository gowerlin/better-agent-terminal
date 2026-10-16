---
schema_version: 1
schema_kind: index
id: _bug-tracker
index_kind: bugs
generated_at: "2026-10-16T17:45:41+0800"
generator: control-tower-sync
source_globs:
  - _ct-workorders/BUG-*.md
exclude_globs:
  - _ct-workorders/_archive/**
  - _ct-workorders/examples/**
total: 67
breakdown:
  OPEN: 1
  FIXING: 0
  FIXED: 18
  VERIFY: 0
  CLOSED: 48
  WONTFIX: 0
---

# Bug Tracker

> ⚠️ 此文件由 `*sync` 自動生成，請勿手動編輯。
> 最後同步：2026-10-16 17:45 (UTC+8) — BUG-142 FIXED（T0568 `9988a117`，待下一版實機）

## 統計
- 🔴 Open: 1 | ⏳ Fixing: 0 | ✅ Fixed: 18 | 🧪 Verify: 0 | 🚫 Closed: 48 | ⛔ Won't Fix: 0 | **Total: 67**

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
| BUG-142 | claude CLI 分頁右鍵已貼上又跳 BAT 選單（T0568 `9988a117`：程式開滑鼠追蹤時不開選單，Shift + 右鍵照開） | 🟢 low | 2026-10-16 17:39 | [BUG-142](BUG-142-right-click-pastes-and-shows-menu-in-claude-tab.md) |
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
| BUG-141 | 精靈升級後段失敗取消，rollback 刪掉整個安裝（T0554 `38fe7421`：保留 `.bat-old` 至完成、取消換回舊樹 / 舊 unit 並重啟舊 service；WSL + SSH） | 🟡 medium | 2026-10-16 | [BUG-141](BUG-141-wizard-rollback-removes-upgraded-install.md) |
| BUG-139 | WSL 精靈覆蓋安裝不清舊檔，舊 bundle 殘留約 256 MiB（T0552 `f599f915`：解到暫存目錄後換名，WSL / SSH 共用） | 🟢 low | 2026-10-16 | [BUG-139](BUG-139-wsl-bundle-overlay-install-leaves-stale-files.md) |
| BUG-138 | WSL 精靈升級執行中的 bat-server 會換 port，既有 profile 失效（T0552 `f599f915`：沿用既有 unit port、更新既有 profile） | 🟡 medium | 2026-10-16 | [BUG-138](BUG-138-wsl-wizard-upgrade-changes-port.md) |
| BUG-140 | `--close-worker` 延遲期間切換工作區 / 終端焦點被算成使用者輸入，回收被取消（T0551 `92655e00`，pre.5 實機驗收 T0558：終端自動回應（focus / CPR / DA…）不算使用者輸入） | 🟡 medium | 2026-10-16 | [BUG-140](BUG-140-close-worker-cancelled-by-focus-not-typing.md) |
| BUG-123 | Profile（配置）對話框：WSL / SSH / Docker（headless）profile 狀態燈恆紅（T0513：燈號改以本機 registry 連線 + live 視窗為準，🟢/🟡/🔴/⚪ 四態、三語 tooltip、即時更新） | 🟢 low | 2026-10-14 | [BUG-123](BUG-123-profile-panel-remote-status-always-red.md) |
| BUG-124 | SSH 精靈：目標 sshd 禁止 port forwarding 時錯誤顯示成「沒有提供 TLS 憑證」，未指出真正原因（T0517 `213f587`：偵測 ssh `administratively prohibited`，三語提示 `AllowTcpForwarding`） | 🟢 low | 2026-10-14 | [BUG-124](BUG-124-ssh-wizard-forwarding-denied-misleading-tls-error.md) |
| BUG-126 | scan-skills / star commands：frontmatter 無 description 時 fallback 恆空字串（T0519 `aa26c76`：改用 `parseCommandDescription`） | 🟢 low | 2026-10-14 | [BUG-126](BUG-126-skill-description-fallback-never-leaves-frontmatter.md) |
| BUG-125 | claude:scan-skills：commands 以第一行當 description，帶 frontmatter 顯示 "---"（T0518 `b66b525`：commands 先讀 frontmatter description） | 🟢 low | 2026-10-14 | [BUG-125](BUG-125-scan-skills-command-description-frontmatter.md) |
| BUG-086 | WSL 設定精靈把「已裝 WSL 但無發行版」誤判為「找不到 WSL2」，引導使用者重裝 WSL | 🟢 low | 2026-10-14 | [BUG-086](BUG-086-wsl-wizard-no-distro-misreported-as-no-wsl.md) |
| BUG-109 | `/snippet` prompt 寫死 macOS `snippets.json` 路徑（T0441） | 🟢 low | 2026-10-14 | [BUG-109](BUG-109-snippet-prompt-hardcoded-macos-path.md) |
| BUG-106 | `worktree:merge` 呼叫已移除的 `WorktreeManager.mergeWorktree`（T0417，移除殘留） | 🟢 low | 2026-10-14 | [BUG-106](BUG-106-worktree-merge-calls-removed-method.md) |
| BUG-096 | renderer 遠端重連不帶 fingerprint，以未 pin 連線取代已驗證連線（T0419 / T0430 / T0442） | 🟡 medium | 2026-10-14 | [BUG-096](BUG-096-app-remote-connect-without-fingerprint.md) |
| BUG-110 | 遠端 profile 視窗未連線時 proxied channel 靜默改在本機執行（fail-open）（T0443） | 🔴 high | 2026-10-14 | [BUG-110](BUG-110-remote-window-falls-back-to-local-handlers.md) |
| BUG-112 | 從 remote profile 視窗 detach 出的 workspace 視窗路由視為本機（fail-open）（T0446） | 🔴 high | 2026-10-14 | [BUG-112](BUG-112-detached-workspace-window-remote-fail-open.md) |
| BUG-113 | Detached workspace 視窗顯示 Workspace not found（自 `512c118` 多視窗重構起 detach 失效）（T0453） | 🟡 medium | 2026-10-14 | [BUG-113](BUG-113-detached-workspace-not-found.md) |
| BUG-100 | `ssh.stopServer` / `ssh.uninstallBundle` 只有型別宣告（T0426，實作 IPC） | 🟡 medium | 2026-10-14 | [BUG-100](BUG-100-ssh-stop-server-uninstall-bundle-ipc-missing.md) |
| BUG-099 | 設定精靈取消時不 rollback 失敗中的步驟（T0426） | 🟢 low | 2026-10-14 | [BUG-099](BUG-099-wizard-cancel-skips-failed-step-rollback.md) |
| BUG-098 | SSH 精靈 direct 模式整條路徑不通（T0425，移除 direct） | 🟡 medium | 2026-10-14 | [BUG-098](BUG-098-ssh-wizard-direct-mode-unreachable.md) |
| BUG-093 | SSH 精靈驗證階段沒有建 SSH tunnel，「取得 TLS 指紋」與「連線測試」連到本機 `localhost:9876`（主機 BAT 自己），pin 進 profile 的指紋是錯的 | 🔴 high | 2026-10-14 | [BUG-093](BUG-093-ssh-wizard-verifies-local-host-not-remote.md) |
| BUG-088 | SSH 設定精靈寫出的 systemd unit / launchd plist 含字面 `~`，服務無法啟動（BUG-087 缺陷 B 的 SSH 版） | 🔴 high | 2026-10-14 | [BUG-088](BUG-088-ssh-wizard-service-unit-literal-tilde.md) |
| BUG-121 | SSH unit / plist 傳 `BAT_REMOTE_PORT` / `BAT_REMOTE_BIND`，bat-server 只讀 `--port` / `BAT_SERVER_PORT` → 監聽 54321、wizard verify 失敗 | 🔴 high | 2026-10-14 | [BUG-121](BUG-121-ssh-service-unit-wrong-port-env-name.md) |
| BUG-120 | SSH wizard 解 bundle 沒 `--strip-components=1` → `<installPath>/staging/…`，unit `bin/bat-server` 203/EXEC | 🔴 high | 2026-10-14 | [BUG-120](BUG-120-ssh-wizard-bundle-extracts-into-staging-subdir.md) |
| BUG-115 | `release.ps1 -Snapshot` 必定失敗：prebuild 以 snapshot 版號重跑 fetch:baseline → 404（T0488 修：baseline 取基底版號） | 🟢 low | 2026-10-14 | [BUG-115](BUG-115-release-ps1-snapshot-prebuild-fetch-baseline-404.md) |
| BUG-117 | mac x64 dmg 內嵌 arm64 原生 binary（已證實：claude / codex / node-pty / whisper 等）→ Intel Mac 內嵌 claude、codex、語音不可用、PTY 降級 | 🔴 high | 2026-10-14 | [BUG-117](BUG-117-mac-x64-dmg-ships-arm64-native-binaries.md) |
| BUG-061 | `CodexAgentPanel.tsx` baseline tsc errors（dev-only；T0486 清零 36 → 0） | 🟢 low | 2026-10-14 | [BUG-061](BUG-061-codex-agent-panel-tsc-baseline-errors.md) |
| BUG-122 | Profile（配置）對話框 remote 卡片展開後「遠端 AI 工具」只佔右半、左欄空白；對話框偏窄（T0512：`profile-card*` 補 CSS、對話框 `min(1040px, 90vw)`、profile 端工具卡片 grid） | 🟢 low | 2026-10-14 | [BUG-122](BUG-122-profile-panel-remote-card-empty-left-column.md) |
| BUG-119 | userData 分裂：`snippet-db` import 時取 userData（早於 `setName`）→ 日誌 / Crashes / snippets 在 `better-agent-terminal/`、設定在 `BetterAgentTerminal/`；runtime 實例共用 snippets | 🟡 medium | 2026-10-14 | [BUG-119](BUG-119-userdata-split-logs-snippets-vs-settings.md) |
| BUG-114 | 派工分頁 `terminal-created result=ok` 但 Worker 未執行 `/ct-exec`（或 commit 前停住），塔台無啟動訊號（T0490 根因 / T0497 修：bat-terminal 以 frame id 比對回應；裝 pre.5 後生效） | 🟡 medium | 2026-10-14 | [BUG-114](BUG-114-dispatched-worker-never-runs-ct-exec.md) |
| BUG-104 | remote-tools 的 codex 安裝食譜卡在 installer 的「Start Codex now? [y/N]」互動提示 | 🟡 medium | 2026-10-05 | [BUG-104](BUG-104-codex-install-recipe-blocks-on-start-prompt.md) |
| BUG-103 | RemoteServer auth metadata `serverEnv` 寫死 `native`，WSL headless 也回 native 且缺 `wslDistro` / `serverHome` | 🟢 low | 2026-10-05 | [BUG-103](BUG-103-remote-server-auth-meta-server-env-hardcoded-native.md) |
| BUG-102 | PtyManager 強制 `LANG` / `LC_ALL=en_US.UTF-8`，WSL Ubuntu 無此 locale → 遠端終端開頭印 setlocale 警告並退回 C locale | 🟡 medium | 2026-10-05 | [BUG-102](BUG-102-pty-forces-en-us-locale-missing-on-wsl.md) |
| BUG-101 | 本機 Terminal Server 模式的終端「重新啟動」會讓終端失聯：舊 PTY 的 onExit 無條件刪掉同 id 的新 entry | 🔴 high | 2026-10-05 | [BUG-101](BUG-101-terminal-server-restart-loses-terminal.md) |
| BUG-095 | `claude:abort-session` 只進 handler registry、未列入 `PROXIED_CHANNELS`，沒有 `ipcMain.handle` → Claude / Codex 面板的中止（abort）呼叫一律失敗 | 🔴 high | 2026-10-05 | [BUG-095](BUG-095-claude-abort-session-not-bound-to-ipc.md) |
| BUG-087 | WSL 精靈「寫入 systemd 使用者服務」失敗：linger 未帶使用者、unit 檔 `~` 不展開、失敗後 bundle 被回滾 | 🔴 high | 2026-10-04 | [BUG-087](BUG-087-wsl-wizard-systemd-step-linger-tilde-rollback.md) |
| BUG-089 | WSL 精靈把 Mirrored 網路模式誤判為 NAT（default route 含 `via` 即判 NAT 的啟發式不成立） | 🟡 medium | 2026-10-04 | [BUG-089](BUG-089-wsl-network-mode-misdetected-as-nat.md) |
| BUG-090 | 設定精靈「取得 TLS 指紋」永久卡住：伺服器沒有 `/fingerprint` HTTP handler，IPC 也沒有 timeout（WSL / SSH / Docker 共用） | 🔴 high | 2026-10-04 | [BUG-090](BUG-090-wizard-fetch-fingerprint-hangs-forever.md) |
| BUG-091 | WSL bat-server 埠與主機 BAT RemoteServer 衝突（預設都是 9876），且 `startService` 把「啟動後立刻崩潰」誤判為成功 | 🔴 high | 2026-10-04 | [BUG-091](BUG-091-wsl-server-port-conflict-and-false-start-success.md) |
| BUG-092 | 沒有 `wsl.exe` 連線時 WSL 約 15 秒就關閉發行版，bat-server 跟著停止，WSL profile 連不上 | 🔴 high | 2026-10-04 | [BUG-092](BUG-092-wsl-distro-idle-shutdown-stops-bat-server.md) |
| BUG-094 | WSL / SSH 遠端 profile 連得上 headless bat-server，但 `profile:load-snapshot` 無 handler，被錯報成「伺服器未執行或 6 秒未回應」 | 🔴 high | 2026-10-04 | [BUG-094](BUG-094-headless-server-missing-profile-load-snapshot.md) |
| BUG-071 | Setup Wizard install-server-bundle 硬性失敗：server bundle tarball 自動取得未實作 | 🔴 high | 2026-10-04 | [BUG-071](BUG-071-server-bundle-download-flow-missing.md) |
| BUG-085 | Codex CLI 0.160 在提權的 Windows 上拒絕啟動 daemon，Codex CLI 終端 preset 直接失敗 | 🟡 medium | 2026-10-04 | [BUG-085](BUG-085-codex-cli-daemon-refuses-elevated-windows.md) |
| BUG-084 | 內嵌 Claude CLI 2.1.113 被服務端拒絕 Claude 5 主力模型（claude_code_version_too_old） | 🔴 high | 2026-10-04 | [BUG-084](BUG-084-embedded-claude-cli-too-old-for-claude-5.md) |
| BUG-083 | Codex agent 出錯，測試者指稱需更新 codex 版本（內嵌 0.124.0，上游 0.160.0） | 🟡 medium | 2026-10-04 | [BUG-083](BUG-083-codex-agent-errors-outdated-bundled-cli.md) |
| BUG-082 | 跨專案工單前綴（CP-/CT-）被結構化派工路徑拒收，且四處 ID 規則彼此不一致 | 🔴 high | 2026-09-02 | [BUG-082](BUG-082-workorder-id-prefix-rejected-by-structured-dispatch.md) |
| BUG-078 | ct-drift-telemetry.ts 引用 node:fs/path/os 觸發 D090 guard，CI verify-renderer-imports fail | 🔴 high | 2026-09-02 | [BUG-078](BUG-078-ct-drift-telemetry-renderer-node-imports-d090-violation.md) |
| BUG-074 | SSH setup wizard：input step 在使用者輸入前就顯示 failed | 🟡 medium | 2026-09-02 | [BUG-074](BUG-074-ssh-wizard-input-step-shows-failed-on-init.md) |
| BUG-073 | Docker setup wizard：daemon 未運作時錯誤訊息純技術，無 actionable 引導 | 🟡 medium | 2026-09-02 | [BUG-073](BUG-073-docker-wizard-daemon-not-running-error-handling.md) |
| BUG-072 | WSL setup wizard：systemd linger 失敗訊息不友善 + bat-server.service timeout | 🟡 medium | 2026-09-02 | [BUG-072](BUG-072-wsl-systemd-linger-error-handling.md) |

> 💡 BUG-079/080 已於 2026-05-19 歸檔；BUG-081 於 2026-09-02 歸檔 → [_archive/bugs/](_archive/bugs/)
>
> ⚠️ BUG-072/073/074 以 **field evidence** 就地結案（上線 101 天零回饋），**非人工 smoke**；
> BUG-078 則有 CI 正面證據。結案依據差異見各 BUG 文末結案紀錄。

## ⛔ 不修復 (WONTFIX)

| ID | 標題 | 嚴重度 | 標記時間 | 連結 |
|----|------|--------|---------|------|
| _（無）_ | | | | |
